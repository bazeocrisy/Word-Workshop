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
  if (/^(words?|terms?|vocabulary words?)\s*[\t:|\-–—]?\s*(definitions?|meanings?)$/i.test(t)) return true; // table header
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

const JOINED_NOTE = 'This definition was joined from two lines. Check it against the sheet.';
const TRAILING_FUNCTION_WORD = /\b(a|an|the|and|or|of|to|in|on|for|with|that|by|from|at|as|is|are|be|who|which|when|where|but|than|your|their|its|over|under|about|into)$/i;

/** Is `next` the continuation of an unfinished definition `def`? */
function continues(def, next) {
  const d = String(def || '').trim(), n = String(next || '').trim();
  if (!d || !n || /[.!?;]$/.test(d)) return false;
  if (splitPair(n)) return false;
  if (TRAILING_FUNCTION_WORD.test(d)) return true;            // "…a picture or / Pattern seen from Earth"
  const startsWithFunctionWord = LEADING_FUNCTION_WORD.test(n); // "…works / for money"
  // A short lower-case line could be the next vocabulary word ("…pattern / peculiar"), so it needs a stronger sign.
  if (isWordLike(n) && n.split(/\s+/).length <= 2) return startsWithFunctionWord;
  return /^[a-z(]/.test(n);
}
/** True while a column of definitions is still being matched to an earlier column of words. */
function fillingColumn(items) {
  let n = 0; while (n < items.length && items[items.length - 1 - n].kind === 'text') n++;
  let k = 0; while (n + k < items.length && items[items.length - 1 - n - k].kind === 'word') k++;
  return k >= 2 && n >= 1 && n < k;
}
const LEADING_FUNCTION_WORD = /^(a|an|the|and|or|of|to|in|on|for|with|that|by|from|at|as|is|are|be|who|which|when|where|but|than|your|their|its|over|under|about|into)\b/i;

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
    // A wrapped definition: the previous line's definition is unfinished and this line continues it.
    const prevItem = items[items.length - 1];
    const prevDef = prevItem ? (prevItem.kind === 'pair' ? prevItem.definition : prevItem.kind === 'text' ? prevItem.text : '') : '';
    const join = prevDef && number == null && !fillingColumn(items) && continues(prevDef, text)
      && (TRAILING_FUNCTION_WORD.test(prevDef.trim()) || !isHeading(text)); // "…a picture or / Pattern…" beats the heading check
    if (!join && isHeading(text)) { ignored.push(text); continue; }
    if (join) {
      if (prevItem.kind === 'pair') prevItem.definition += ' ' + text; else prevItem.text += ' ' + text;
      prevItem.conf = minConf(prevItem.conf, ln.conf); prevItem.joined = true;
      continue;
    }
    const pair = splitPair(text);
    if (pair) items.push({ kind: 'pair', ...pair, number, conf: ln.conf });
    else if (isWordLike(text) && text.split(/\s+/).length <= 2) items.push({ kind: 'word', word: text.replace(/[.,;:]$/, ''), number, conf: ln.conf });
    else items.push({ kind: 'text', text, number, conf: ln.conf });
  }
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const joinNote = (x) => (x && x.joined ? [JOINED_NOTE] : []);
    if (it.kind === 'pair') { rows.push({ word: it.word, definition: it.definition, conf: it.conf, number: it.number, notes: joinNote(it) }); continue; }
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
        rows.push({ word: it.word, definition: next.text, conf: minConf(it.conf, next.conf), number: it.number, notes: joinNote(next) });
        i += 1; continue;
      }
      rows.push({ word: it.word, definition: '', conf: it.conf, number: it.number, notes: ['No definition was found for this word.'] });
      continue;
    }
    // Text with no word before it: continuation of the previous definition, or a row whose separator was lost.
    const prev = rows[rows.length - 1];
    if (prev && prev.definition && it.number == null && continues(prev.definition, it.text)) {
      prev.definition += ' ' + it.text; prev.conf = minConf(prev.conf, it.conf);
      if (!prev.notes.includes(JOINED_NOTE)) prev.notes.push(JOINED_NOTE);
      continue;
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
const STOPWORDS = new Set(['the', 'a', 'an', 'and', 'is', 'are', 'on', 'in', 'of', 'to', 'for', 'your', 'our', 'will', 'be', 'please', 'this', 'that', 'with', 'by', 'at', 'we', 'you', 'have', 'has', 'every', 'each', 'night', 'test', 'friday', 'monday']);
function looksLikeSentence(raw, ws) {
  if (/[.!?]$/.test(raw.trim())) return true;
  return ws.length >= 3 && ws.some((w) => STOPWORDS.has(w.toLowerCase()));
}

export function parseSpellingLines(lines) {
  const tokens = [];
  const ignored = [];
  const notes = [];
  for (const ln of lines) {
    let raw = String(ln.text ?? '').replace(/ /g, ' ').trim();
    if (!raw) continue;
    // "Bonus: stepped" / "Challenge words: tomorrow, yesterday" — keep the words, mention the label.
    const label = /^([\p{L} ]{2,30}):\s*(\S.*)$/u.exec(raw);
    if (label && label[2].split(/[\s,;]+/).filter(Boolean).every((x) => WORD_RE.test(x.replace(/[.,;]$/, '')))) {
      if (!/^(spelling|words?|word list|list|spelling words?|spelling list)$/i.test(label[1].trim())) notes.push(`Words after "${label[1].trim()}:" were included. Remove them if they are not part of the test.`);
      raw = label[2];
    }
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
      const ws = word.split(/\s+/);
      if (ws.length > 1) {
        // Words separated by single spaces (a word bank, or how photo-text tools return a row) are separate
        // spelling words. A line that reads like a sentence or note is set aside and shown to the parent.
        if (ws.every((x) => WORD_RE.test(x)) && !looksLikeSentence(p, ws)) ws.forEach((x) => tokens.push({ word: x, number: null, conf: ln.conf }));
        else ignored.push(p);
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
    if (/^(reminders?|notes?|homework|upcoming|important dates|dates|news|announcements?|math|reading|science|social studies)\b/i.test(t) && t.split(/\s+/).length <= 4) { cur = 'unknown'; continue; }
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
