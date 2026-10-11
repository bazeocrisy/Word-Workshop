// Layout-aware extraction for real school pages, where boxes sit side by side (a "Spelling words" box next to
// "What we're learning") and vocabulary is a grid of cards (word on top, definition underneath).
// Input lines come from ocr.js: { text, conf, segments: [{ text, x0, x1, conf }], page }.
// Pure functions; everything produced is still a draft for the parent to check.

const WORD = /^[\p{L}][\p{L}'’-]*$/u;
// "1. rushed", "1) rushed" and "10 landed" (the period lost in a photo)
const NUMBERED = /^[•*»>·\-–]*\s*\(?(\d{1,2})(?:[.)]\s*|\s+)(.*)$/u;
// "T rushed", "g. callec": a list number misread as a letter or mark, then the word
const GARBLED = /^[^\p{L}\d\s]{0,2}[\p{L}\d]{1,2}[.,]?\s+([\p{L}][\p{L}'’-]+)$/u;
const cleanWord = (w) => String(w).replace(/^[^\p{L}]+|[^\p{L}'’]+$/gu, '');

/**
 * Find a numbered word list ("1. rings   9. boxes") anywhere on the page, even when each line also contains text
 * from a neighbouring box. Returns null unless at least 5 numbered single words are found.
 * → { items: [{ number, word, conf, notes }], notes: [], used: Set<line index> }
 */
export function extractNumberedList(lines) {
  const found = [];
  const orphans = [];
  lines.forEach((ln, li) => {
    const raw = ln.segments && ln.segments.length ? ln.segments : [{ text: ln.text, conf: ln.conf }];
    // "1." and "crawl" read as separate pieces (wide gap after the number): join them.
    const segs = [];
    for (let i = 0; i < raw.length; i++) {
      const t = raw[i].text.trim();
      if (/^[•*»>·\-–]*\s*\(?\d{1,2}[.)]$/u.test(t) && raw[i + 1] && WORD.test(cleanWord(raw[i + 1].text)) && !/\s/.test(raw[i + 1].text.trim())) {
        segs.push({ ...raw[i], text: `${t} ${raw[i + 1].text.trim()}`, conf: Math.min(raw[i].conf ?? 100, raw[i + 1].conf ?? 100), x1: raw[i + 1].x1 });
        i++;
      } else segs.push(raw[i]);
    }
    const hasNumbered = segs.some((s) => NUMBERED.test(s.text.trim()));
    segs.forEach((s, si) => {
      const t = s.text.trim();
      const m = NUMBERED.exec(t);
      if (m) {
        const n = Number(m[1]);
        let word = cleanWord(m[2]);
        // "6. b" with the word wrapped onto the next line ("buzzes	14. bushes")
        if (word.length <= 1) {
          const next = lines[li + 1]?.segments?.[0]?.text?.trim();
          if (next && WORD.test(cleanWord(next)) && !NUMBERED.test(next) && cleanWord(next).toLowerCase().startsWith(word.toLowerCase())) { word = cleanWord(next); orphans.push({ consumed: `${li + 1}:0` }); }
        }
        if (word && WORD.test(word) && n >= 1 && n <= 40 && !/\s/.test(m[2].trim())) found.push({ number: n, word, conf: s.conf ?? ln.conf, line: li, x0: s.x0 });
        return;
      }
      const g = GARBLED.exec(t);
      if (g && s.x0 != null) { orphans.push({ word: g[1], conf: Math.min(s.conf ?? ln.conf ?? 100, 60), line: li, x0: s.x0, key: `${li}:${si}`, garbled: true }); return; }
      // An unnumbered single word in a line of numbered items probably lost its number to a mark ("» crashes").
      if (hasNumbered && WORD.test(cleanWord(t)) && !/\s/.test(t.replace(/^[^\p{L}]+/u, '')) && si > 0) orphans.push({ word: cleanWord(t), conf: s.conf ?? ln.conf, line: li, x0: s.x0, key: `${li}:${si}` });
    });
  });
  if (found.length < 5) return null;
  const consumed = new Set(orphans.filter((o) => o.consumed).map((o) => o.consumed));
  const candidates = orphans.filter((o) => o.word && !consumed.has(o.key));
  const notes = [];
  // Same number read twice ("15. thank" and "15. thanks"): keep the longer reading, tell the parent.
  const byNum = new Map();
  for (const f of found) {
    const prev = byNum.get(f.number);
    if (!prev) { byNum.set(f.number, f); continue; }
    if (prev.word.toLowerCase() === f.word.toLowerCase()) continue;
    const keep = f.word.length > prev.word.length ? f : prev;
    notes.push(`Number ${f.number} was read twice ("${prev.word}" and "${f.word}"); "${keep.word}" was kept. Check it.`);
    byNum.set(f.number, keep);
  }
  const max = Math.max(...byNum.keys());
  const missing = [];
  for (let n = 1; n <= max; n++) if (!byNum.has(n)) missing.push(n);
  const items = [...byNum.values()].sort((a, b) => a.number - b.number).map((f) => ({ number: f.number, word: f.word, conf: f.conf, notes: [] }));
  let strays = candidates.filter((c) => !items.some((i) => i.word.toLowerCase() === c.word.toLowerCase()));
  // A word whose number was unreadable sits in a column of numbered words: one row below "2. blasted" is 3.
  const width = Math.max(1, ...found.map((f) => f.x0 ?? 0)) || 1;
  for (const st of [...strays]) {
    if (st.x0 == null) continue;
    const col = found.filter((f) => f.x0 != null && Math.abs(f.x0 - st.x0) < width * 0.08);
    const near = col.sort((a, b) => Math.abs(a.line - st.line) - Math.abs(b.line - st.line))[0];
    if (!near) continue;
    const n = near.number + (st.line - near.line);
    if (n < 1 || n > 40 || items.some((i) => i.number === n) || Math.abs(st.line - near.line) > 3) continue;
    items.push({ number: n, word: st.word, conf: Math.min(st.conf ?? 60, 70), notes: [`Its number was not readable; it was placed as number ${n} from its position. Check the word and the order.`] });
    strays = strays.filter((x) => x !== st);
    const mi = missing.indexOf(n); if (mi >= 0) missing.splice(mi, 1);
  }
  items.sort((a, b) => a.number - b.number);
  // Exactly one missing number and exactly one stray word next to the list: the stray word is that number.
  if (missing.length === 1 && strays.length === 1) {
    items.push({ number: missing[0], word: strays[0].word, conf: strays[0].conf, notes: [`Its number was not readable; it was placed as number ${missing[0]}. Check the order.`] });
    items.sort((a, b) => a.number - b.number);
    missing.length = 0;
  } else if (strays.length) {
    notes.push(`Possible words without a readable number: ${strays.map((s) => s.word).join(', ')}. Add them if they belong to the list.`);
  }
  if (missing.length) notes.push(`Number${missing.length > 1 ? 's' : ''} ${missing.join(', ')} ${missing.length > 1 ? 'were' : 'was'} not found. A word may be missing.`);
  return { items, notes, lines: new Set(found.map((f) => f.line)) };
}

/**
 * Combine several readings of the same numbered list (the page read in different ways): for each number the
 * word most readings agree on wins (ties → most confident). Disagreements and gaps are reported.
 */
export function voteNumbered(lists) {
  const ok = lists.filter(Boolean);
  if (!ok.length) return null;
  if (ok.length === 1) return ok[0];
  const byNum = new Map();
  for (const l of ok) for (const it of l.items) {
    const m = byNum.get(it.number) || new Map();
    const key = it.word.toLowerCase();
    const v = m.get(key) || { word: it.word, n: 0, conf: 0, notes: it.notes };
    const guessed = (it.notes || []).some((n) => /placed as number/.test(n));
    v.n += guessed ? 0.5 : 1; v.conf = Math.max(v.conf, it.conf ?? 0); m.set(key, v); byNum.set(it.number, m);
  }
  const notes = [];
  // A word can belong to only one number: it stays where it has the most support.
  const support = new Map();
  for (const [number, m] of byNum) for (const [key, v] of m) { const s = support.get(key); if (!s || v.n > s.n || (v.n === s.n && v.conf > s.conf)) support.set(key, { number, n: v.n, conf: v.conf }); }
  for (const [number, m] of byNum) for (const key of [...m.keys()]) if (support.get(key).number !== number) m.delete(key);
  for (const [number, m] of [...byNum]) if (!m.size) byNum.delete(number);
  const items = [...byNum.entries()].sort((a, b) => a[0] - b[0]).map(([number, m]) => {
    const c = [...m.values()].sort((a, b) => b.n - a.n || b.conf - a.conf);
    const n = [...m.values()].reduce((s, v) => s + v.n, 0);
    const itemNotes = [...(c[0].notes || [])];
    if (c.length > 1) itemNotes.push(`Readings differed (${c.map((v) => v.word).join(' / ')}); "${c[0].word}" was chosen. Check it.`);
    return { number, word: c[0].word, conf: c.length > 1 ? Math.min(c[0].conf, 70) : c[0].conf, notes: itemNotes, votes: n };
  });
  const max = Math.max(...items.map((i) => i.number));
  const missing = []; for (let k = 1; k <= max; k++) if (!items.some((i) => i.number === k)) missing.push(k);
  if (missing.length) notes.push(`Number${missing.length > 1 ? 's' : ''} ${missing.join(', ')} ${missing.length > 1 ? 'were' : 'was'} not found. A word may be missing.`);
  return { items, notes, lines: ok[0].lines };
}

/**
 * Vocabulary laid out as a grid of cards: a row of words, then definition lines under each word.
 * Works from segment positions. Returns null if no grid is found.
 * → [{ word, definition, conf, notes }]
 */
export function pairCardGrid(lines) {
  const isWordSeg = (s) => WORD.test(cleanWord(s.text)) && !/\s/.test(s.text.trim()) && cleanWord(s.text).length >= 2;
  const HEADER = /^(words?|terms?|definitions?|meanings?|name|date)$/i;
  const isWordRow = (ln) => ln.segments && ln.segments.length >= 2 && ln.segments.every(isWordSeg) && !ln.segments.some((s) => HEADER.test(cleanWord(s.text)));
  if (!lines.some(isWordRow)) return null;
  // A two-column table ("Produce    Fresh fruits and vegetables" on each line) is not a card grid.
  const tableRows = lines.filter((ln) => ln.segments && ln.segments.length === 2 && isWordSeg(ln.segments[0]) && /\s/.test(ln.segments[1].text.trim())).length;
  if (tableRows >= 3 && tableRows >= lines.filter((l) => l.segments && l.segments.length).length * 0.4) return null;
  const rows = [];
  let cols = null;
  const close = () => { if (cols) for (const c of cols) rows.push(c); cols = null; };
  const center = (s) => (s.x0 + s.x1) / 2;
  for (const ln of lines) {
    if (!ln.segments || !ln.segments.length) continue;
    if (isWordRow(ln)) {
      close();
      cols = ln.segments.map((s) => ({ word: cleanWord(s.text), x0: s.x0, x1: s.x1, parts: [], conf: s.conf, notes: [] }));
      continue;
    }
    if (!cols) continue;
    for (const s of ln.segments) {
      const c = center(s);
      let best = null, dist = Infinity;
      for (const col of cols) { const d = Math.abs(c - (col.x0 + col.x1) / 2); if (d < dist) { dist = d; best = col; } }
      const width = Math.max(...cols.map((col) => col.x1 - col.x0), s.x1 - s.x0);
      // A single word far from every column is a card that sits lower than the others ("impartial").
      if (isWordSeg(s) && dist > width * 0.9) {
        cols.push({ word: cleanWord(s.text), x0: s.x0, x1: s.x1, parts: [], conf: s.conf, notes: ['This card was not in line with the others; check its definition.'] });
        continue;
      }
      if (dist > width) continue; // text from another part of the page
      best.parts.push(s.text.trim());
      best.conf = Math.min(best.conf ?? 100, s.conf ?? 100);
    }
  }
  close();
  const out = rows.filter((r) => r.parts.length).map((r) => ({
    word: r.word, definition: r.parts.join(' ').replace(/\s+/g, ' ').trim(), conf: r.conf,
    notes: [...r.notes, 'Read from a grid of word cards: each definition was matched to the word above it. Check each pair.'],
  }));
  return out.length >= 2 ? out : null;
}

/** Where vocabulary starts: after the last heading-like segment that mentions vocabulary or quiz words. */
export function vocabStart(lines) {
  let at = -1;
  lines.forEach((ln, i) => {
    const segs = ln.segments && ln.segments.length ? ln.segments : [{ text: ln.text }];
    if (segs.some((s) => /^(vocabulary|vocab|vocabulary words?|words for quiz.*|quiz words?)$/i.test(s.text.trim().replace(/[^\p{L} ]/gu, '').trim()))) at = i;
  });
  return at;
}
