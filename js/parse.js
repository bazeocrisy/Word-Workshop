// Turn pasted text or OCR lines into draft spelling words and vocabulary rows.
// Pure functions (no DOM). Everything produced here is a DRAFT for the parent to check.
// A "line" is { text, conf } where conf is OCR confidence 0–100 (null for typed/pasted text).

const HEADING_WORDS = /^(spelling|vocabulary|vocab|words?|word list|list|definitions?|name|date|week|unit|lesson|homework|test|quiz|newsletter|reminders?|this week|dear|important|notes?|due|focus|skill|phonics|pattern|sight words|bonus|challenge|teacher|class|grade|room|mrs?\.?|ms\.?)\b/i;
const NUMBER_PREFIX = /^\s*(?:\(?(\d{1,2})[.)\]:]|\(?(\d{1,2})\)|#(\d{1,2})|(\d{1,2})(?=\s))\s*/;
const BULLET_PREFIX = /^\s*[•●○◦▪■□\-*–·>]+\s*/;
const WORD_RE = /^[\p{L}][\p{L}'’-]*$/u;

const minConf = (...c) => { const v = c.filter((x) => x != null); return v.length ? Math.min(...v) : null; };

export function toLines(text) {
  return String(text ?? '').replace(/\r\n?/g, '\n').split('\n').map((t) => ({ text: t, conf: null }));
}

/** Strip numbering/bullets. Returns { text, number } where number is the list number if present. */
export function stripMarker(text) {
  let t = String(text ?? '').replace(/ /g, ' ').trim();
  let number = null;
  const m = NUMBER_PREFIX.exec(t);
  if (m) { number = Number(m[1] || m[2] || m[3] || m[4]); t = t.slice(m[0].length); }
  else t = t.replace(BULLET_PREFIX, '');
  return { text: t.trim(), number };
}

/** Headings and other text that is not a word or definition (titles, dates, notes to families). */
export function isHeading(text) {
  const t = String(text ?? '').trim();
  if (!t) return true;
  if (/^[\W\d_]+$/u.test(t)) return true; // only symbols / numbers / dates
  const words = t.split(/\s+/);
  if (/:$/.test(t) && words.length <= 5) return true;
  if (HEADING_WORDS.test(t) && words.length <= 6 && !/\s[-–—=:]\s|\t/.test(t)) return true;
  if (/^(spelling|vocabulary)\b/i.test(t)) return true;
  if (t.length > 3 && t === t.toUpperCase() && /[A-Z]/.test(t) && words.length >= 2 && words.length <= 5 && !/[-–—:=]/.test(t)) return true;
  if (/(https?:\/\/|www\.|@\w)/i.test(t)) return true;
  return false;
}

const isWordLike = (s) => {
  const parts = s.trim().split(/\s+/);
  return parts.length >= 1 && parts.length <= 3 && parts.every((p) => WORD_RE.test(p.replace(/[.,;]$/, '')));
};

/** Split "word - definition" (also : = – — tab or a wide gap). Returns null when there is no separator. */
export function splitPair(text) {
  const t = String(text ?? '');
  const seps = [/\t+/, /\s+[-–—=]\s+/, /\s*[–—]\s*/, /\s*:\s+/, /\s*=\s*/, /\s{3,}/, /(?<=\p{L})-\s+/u];
  for (const re of seps) {
    const m = re.exec(t);
    if (!m) continue;
    const word = t.slice(0, m.index).trim().replace(/[.,;:]$/, '');
    const def = t.slice(m.index + m[0].length).trim();
    if (word && def && isWordLike(word)) return { word, definition: def };
  }
  return null;
}

/**
 * Vocabulary rows from lines. Handles:
 *  "Word - definition" / "Word: definition" / tab or wide gap,
 *  word on one line with the definition on the next line(s),
 *  a column of words followed by a column of definitions (paired by order, flagged),
 *  OCR rows with no separator ("Produce Fresh fruits and vegetables": first word guessed, flagged).
 */
export function parseVocabLines(lines) {
  const rows = [];
  const ignored = [];
  const items = [];
  for (const ln of lines) {
    const { text, number } = stripMarker(ln.text);
    if (!text) continue;
    if (isHeading(text)) { ignored.push(text); continue; }
    const pair = splitPair(text);
    if (pair) items.push({ kind: 'pair', ...pair, number, conf: ln.conf });
    else if (isWordLike(text) && text.split(/\s+/).length <= 2) items.push({ kind: 'word', word: text.replace(/[.,;:]$/, ''), number, conf: ln.conf });
    else items.push({ kind: 'text', text, number, conf: ln.conf });
  }
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.kind === 'pair') { rows.push({ word: it.word, definition: it.definition, conf: it.conf, number: it.number, notes: [] }); continue; }
    if (it.kind === 'word') {
      // A block of k words followed by k definitions (two-column sheet read column by column).
      let k = 0; while (items[i + k] && items[i + k].kind === 'word') k++;
      let n = 0; while (items[i + k + n] && items[i + k + n].kind === 'text') n++;
      if (k >= 2 && n === k) {
        for (let j = 0; j < k; j++) rows.push({ word: items[i + j].word, definition: items[i + k + j].text, conf: minConf(items[i + j].conf, items[i + k + j].conf), number: items[i + j].number, notes: ['Words and definitions were matched by their order. Check each pair.'] });
        i += 2 * k - 1; continue;
      }
      const next = items[i + 1];
      if (next && next.kind === 'text') {
        rows.push({ word: it.word, definition: next.text, conf: minConf(it.conf, next.conf), number: it.number, notes: [] });
        i += 1; continue;
      }
      rows.push({ word: it.word, definition: '', conf: it.conf, number: it.number, notes: ['No definition was found for this word.'] });
      continue;
    }
    // Text with no word before it: continuation of the previous definition, or a row whose separator was lost.
    const prev = rows[rows.length - 1];
    if (prev && prev.definition && /^[a-z(]/.test(it.text) && it.number == null) {
      prev.definition += ' ' + it.text; prev.conf = minConf(prev.conf, it.conf); continue;
    }
    const m = /^([\p{L}][\p{L}'’-]*)\s+(.+)$/u.exec(it.text);
    if (m) rows.push({ word: m[1], definition: m[2], conf: it.conf, number: it.number, notes: ['The app guessed where the word ends and the definition begins. Check it.'] });
    else ignored.push(it.text);
  }
  const numbered = rows.length > 1 && rows.every((r) => r.number != null);
  if (numbered) rows.sort((a, b) => a.number - b.number);
  return { rows, ignored };
}

export const parseVocabText = (text) => parseVocabLines(toLines(text));

/**
 * Spelling words from lines. Accepts one word per line, comma/semicolon lists, and numbered lists laid out in
 * columns ("1. rushed   6. buzzed") — numbers restore the teacher's order.
 */
export function parseSpellingLines(lines) {
  const tokens = [];
  const ignored = [];
  for (const ln of lines) {
    const raw = String(ln.text ?? '').replace(/ /g, ' ').trim();
    if (!raw) continue;
    if (isHeading(stripMarker(raw).text) && !/\d/.test(raw.slice(0, 3))) { ignored.push(raw); continue; }
    // Split a line into numbered chunks if it has several numbers ("1. rushed 6. buzzed 11. hunted").
    const numbered = [...raw.matchAll(/(?:^|\s)\(?(\d{1,2})[.)\]:]?\s+([\p{L}][\p{L}'’-]*)/gu)];
    if (numbered.length >= 1 && numbered.map((m) => m[0]).join('').replace(/\s+/g, '').length >= raw.replace(/\s+/g, '').length * 0.8) {
      for (const m of numbered) tokens.push({ word: m[2], number: Number(m[1]), conf: ln.conf });
      continue;
    }
    const parts = stripMarker(raw).text.split(/[,;\t]|\s{2,}|\s+[•·|]\s+/).map((s) => s.trim()).filter(Boolean);
    for (const p of parts) {
      const word = p.replace(/[.,;:!?)"]+$/, '').replace(/^["(]+/, '');
      if (!word) continue;
      if (word.split(/\s+/).length > 2) {
        // A sentence or note rather than a word — keep single words only if the line is clearly a list.
        const ws = word.split(/\s+/);
        if (ws.every((x) => WORD_RE.test(x)) && parts.length === 1 && ws.length <= 6 && lines.length <= 2) ws.forEach((x) => tokens.push({ word: x, number: null, conf: ln.conf }));
        else ignored.push(word);
        continue;
      }
      tokens.push({ word, number: stripMarker(raw).number && parts.length === 1 ? stripMarker(raw).number : null, conf: ln.conf });
    }
  }
  const allNumbered = tokens.length > 1 && tokens.every((t) => t.number != null);
  if (allNumbered) tokens.sort((a, b) => a.number - b.number);
  const words = tokens.map((t) => ({
    word: t.word, conf: t.conf, number: t.number,
    notes: WORD_RE.test(t.word.replace(/\s/g, '')) ? [] : ['Contains numbers or symbols. Check the spelling.'],
  }));
  const notes = [];
  if (allNumbered) {
    const nums = tokens.map((t) => t.number);
    const missing = []; for (let n = 1; n <= Math.max(...nums); n++) if (!nums.includes(n)) missing.push(n);
    if (missing.length) notes.push(`Number${missing.length > 1 ? 's' : ''} ${missing.join(', ')} ${missing.length > 1 ? 'were' : 'was'} not found. A word may be missing.`);
  } else if (tokens.length > 1 && tokens.some((t) => t.number != null)) {
    notes.push('Some words were numbered and some were not; check the order.');
  }
  return { words, ignored, notes };
}

export const parseSpellingText = (text) => parseSpellingLines(toLines(text));

/**
 * Split a whole page (newsletter) into spelling and vocabulary sections using headings.
 * Returns { spelling: lines[], vocab: lines[], unknown: lines[] }.
 */
export function splitSections(lines) {
  const out = { spelling: [], vocab: [], unknown: [] };
  let cur = 'unknown';
  for (const ln of lines) {
    const t = String(ln.text || '').trim();
    if (/\bspelling\b/i.test(t) && t.split(/\s+/).length <= 6) { cur = 'spelling'; continue; }
    if (/\bvocab(ulary)?\b/i.test(t) && t.split(/\s+/).length <= 6) { cur = 'vocab'; continue; }
    out[cur].push(ln);
  }
  return out;
}

/** Parse "word: sentence" lines (pasted back from any sentence helper). */
export function parseSentenceLines(text, words) {
  const byKey = new Map(words.map((w) => [w.toLowerCase(), w]));
  const found = new Map();
  const unmatched = [];
  for (const raw of toLines(text)) {
    const { text: t } = stripMarker(raw.text);
    if (!t) continue;
    const m = /^([\p{L}][\p{L}'’ -]*?)\s*[:\-–—]\s+(.+)$/u.exec(t);
    if (m && byKey.has(m[1].trim().toLowerCase())) { found.set(byKey.get(m[1].trim().toLowerCase()), m[2].trim()); continue; }
    // A plain sentence: match it to the one word it contains.
    const hits = words.filter((w) => new RegExp(`(^|[^\\p{L}])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'iu').test(t));
    if (hits.length === 1 && !found.has(hits[0])) found.set(hits[0], t);
    else unmatched.push(t);
  }
  return { found, unmatched };
}
