// Reading a vocabulary sheet laid out as a table of word cards (word on top, definition underneath), from a
// photo the parent has straightened by marking the table's corners. Each card is read on its own, in a few
// ways, and the most consistent reading wins. Pairing cannot go wrong: word and definition come from one card.
import { preprocess, DEFAULT_PSM } from './ocr.js';
import { findGrid } from './perspective.js';

/**
 * Infer the cell grid inside a straightened table whose outer border is the rectangle (x0,y0)–(x1,y1).
 * Uses ruling lines where they are visible and equal spacing where they are not.
 */
export function inferGrid(canvas, box, counts = {}) {
  const g = findGrid(canvas) || { xs: [], ys: [] };
  const fit = (lines, a, b, maxN, forced) => {
    const inner = lines.filter((p) => p > a + (b - a) * 0.08 && p < b - (b - a) * 0.08);
    let best = { n: forced || 1, err: Infinity };
    for (let n = 2; n <= maxN && !forced; n++) {
      const step = (b - a) / n;
      // every detected inner line must sit close to a multiple of step
      const err = inner.reduce((s, p) => s + Math.min(...Array.from({ length: n - 1 }, (_, k) => Math.abs(p - (a + step * (k + 1))))), 0) / Math.max(1, inner.length);
      const tol = step * 0.15;
      if (inner.length && err > tol) continue;
      const covered = inner.length / (n - 1);
      const score = err / step - covered * 0.5 + (inner.length ? 0 : 1);
      if (score < best.err) best = { n, err: score };
    }
    const step = (b - a) / best.n;
    const cuts = [a];
    for (let k = 1; k < best.n; k++) {
      const guess = a + step * k;
      const near = inner.filter((p) => Math.abs(p - guess) < step * 0.2).sort((p, q) => Math.abs(p - guess) - Math.abs(q - guess))[0];
      cuts.push(near ?? guess);
    }
    cuts.push(b);
    return cuts;
  };
  // The parent may say how many cards go across and down; otherwise the rulings decide.
  const xs = fit(g.xs, box.x0, box.x1, 6, counts.cols);
  let ys = fit(g.ys, box.y0, box.y1, 8, counts.rows);
  // No row rulings found at all: count the cards from the text. In each column, text lines close together belong
  // to one card; a bigger gap starts the next card. The most common count across columns is the row count.
  const innerRows = g.ys.filter((p) => p > box.y0 + (box.y1 - box.y0) * 0.08 && p < box.y1 - (box.y1 - box.y0) * 0.08);
  if (!innerRows.length && !counts.rows) {
    const counts = [];
    for (let c = 0; c < xs.length - 1; c++) counts.push(textBlocks(canvas, xs[c], xs[c + 1], box.y0, box.y1));
    counts.sort((a, b) => a - b);
    const n = counts[Math.floor(counts.length / 2)];
    if (n >= 1 && n <= 8) { ys = []; for (let k = 0; k <= n; k++) ys.push(box.y0 + ((box.y1 - box.y0) * k) / n); }
  }
  return { xs, ys, detected: g };
}

/** Number of separate text blocks (cards) in a vertical strip of the table. */
function textBlocks(canvas, x0, x1, y0, y1) {
  const pad = (x1 - x0) * 0.06;
  const sx = Math.round(x0 + pad), sw = Math.max(1, Math.round(x1 - x0 - 2 * pad)), sy = Math.round(y0), sh = Math.max(1, Math.round(y1 - y0));
  const strip = document.createElement('canvas'); strip.width = sw; strip.height = sh;
  strip.getContext('2d').drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
  const bin = preprocess(strip);
  const d = bin.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, sw, sh).data;
  const inkRow = []; for (let y = 0; y < sh; y++) { let n = 0; for (let x = 0; x < sw; x++) if (d[(y * sw + x) * 4] === 0) n++; inkRow.push(n > sw * 0.01); }
  const runs = []; let start = -1;
  inkRow.forEach((v, y) => { if (v && start < 0) start = y; if (!v && start >= 0) { runs.push([start, y]); start = -1; } });
  if (start >= 0) runs.push([start, sh]);
  const lines = runs.filter(([a, b]) => b - a >= 4);
  if (!lines.length) return 0;
  const gaps = lines.slice(1).map((r, i) => r[0] - lines[i][1]);
  if (!gaps.length) return 1;
  const sorted = [...gaps].sort((a, b) => a - b);
  const typical = sorted[Math.floor(sorted.length / 3)];
  return 1 + gaps.filter((gp) => gp > Math.max(typical * 2.2, sh * 0.04)).length;
}

const LETTERS = /\p{L}/u;
const junkLine = (t) => !LETTERS.test(t) || /^[^\p{L}]*\p{L}{1,2}[^\p{L}]*$/u.test(t.trim()) || /^[—–\-_=~|.\s]+$/.test(t);

/**
 * Split one card's text into headword and definition. The headword must be a single word near the TOP of the
 * card (a word from the definition is never promoted to headword); everything below it is the definition.
 */
export function splitCard(lines, cellH = Infinity) {
  const clean = lines.map((l) => ({ ...l, text: l.text.replace(/[|_~=]+/g, ' ').replace(/\s+/g, ' ').trim() })).filter((l) => l.text && !junkLine(l.text));
  const isWord = (l) => /^[\p{L}][\p{L}'’-]*$/u.test(l.text.replace(/[^\p{L}'’ -]/gu, '').trim()) && l.text.split(' ').length <= 2;
  const top = (l) => l.y0 == null || l.y0 < cellH * 0.38;
  const wi = clean.findIndex((l) => isWord(l) && top(l));
  const defLines = wi >= 0 ? clean.slice(wi + 1) : clean.filter((l) => l.y0 != null && l.y0 > cellH * 0.22);
  if (wi < 0) return { word: null, wordConf: 0, definition: defLines.map((l) => l.text).join(' ').trim(), defConf: defLines.length ? Math.min(...defLines.map((l) => l.conf)) : 0, defMean: defLines.length ? defLines.reduce((s, l) => s + l.conf, 0) / defLines.length : 0 };
  const word = clean[wi].text.replace(/[^\p{L}'’-]/gu, '');
  return { word, wordConf: clean[wi].conf, definition: defLines.map((l) => l.text).join(' ').trim(), defConf: defLines.length ? Math.min(...defLines.map((l) => l.conf)) : 0, defMean: defLines.length ? defLines.reduce((s, l) => s + l.conf, 0) / defLines.length : 0 };
}

const VARIANTS = [
  { scale: 2, mode: 'plain', psm: '6' },
  { scale: 2, mode: 'contrast', psm: '6' },
  { scale: 2, mode: 'clean', psm: '6' },
  { scale: 2, mode: 'plain', psm: '4' },
  { scale: 1, mode: 'contrast', psm: '6' },
];
// One crop per card. (Shifted extra crops were tried on the real photo and made results worse: a crop that cuts
// the headword lets a definition line win the headword vote.)
const CROPS = [{ dy: 0, dx: 0, grow: 0 }];

/** Greyscale with the darkest 2% → black and the lightest 2% → white: faint text on a coloured card stands out. */
export function contrast(canvas) {
  const x = canvas.getContext('2d', { willReadFrequently: true });
  const img = x.getImageData(0, 0, canvas.width, canvas.height); const d = img.data;
  const g = new Uint8ClampedArray(d.length / 4); const hist = new Uint32Array(256);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) { g[p] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; hist[g[p]]++; }
  let lo = 0, hi = 255, acc = 0; const n = g.length;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc > n * 0.02) { lo = v; break; } }
  acc = 0; for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc > n * 0.02) { hi = v; break; } }
  const span = Math.max(1, hi - lo);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) { const v = Math.max(0, Math.min(255, ((g[p] - lo) * 255) / span)); d[i] = d[i + 1] = d[i + 2] = v; }
  x.putImageData(img, 0, 0); return canvas;
}

/** Read every card. Returns rows [{ word, definition, conf, notes, cell: [r, c] }] in reading order. */
export async function readCards(worker, canvas, grid, onProgress) {
  const rows = [];
  const total = (grid.ys.length - 1) * (grid.xs.length - 1) * VARIANTS.length * CROPS.length;
  let done = 0;
  const readings = [];
  try {
  for (const v of VARIANTS) {
    await worker.setParameters({ tessedit_pageseg_mode: v.psm });
    for (let r = 0; r < grid.ys.length - 1; r++) for (let c = 0; c < grid.xs.length - 1; c++) for (const crop of CROPS) {
      const W0 = grid.xs[c + 1] - grid.xs[c], H0 = grid.ys[r + 1] - grid.ys[r];
      const pad = Math.round(W0 * 0.02);
      const sx = Math.max(0, grid.xs[c] + pad + crop.dx * W0 - crop.grow * W0), sy = Math.max(0, grid.ys[r] + pad + crop.dy * H0 - crop.grow * H0);
      const sw = Math.min(canvas.width - sx, W0 - 2 * pad + 2 * crop.grow * W0), sh = Math.min(canvas.height - sy, H0 - 2 * pad + 2 * crop.grow * H0);
      const cell = document.createElement('canvas');
      const k = Math.min(v.scale, Math.sqrt(12e6 / Math.max(1, sw * sh)));
      cell.width = Math.round(sw * k); cell.height = Math.round(sh * k);
      const x = cell.getContext('2d'); x.imageSmoothingQuality = 'high'; x.fillStyle = '#fff'; x.fillRect(0, 0, cell.width, cell.height);
      x.drawImage(canvas, sx, sy, sw, sh, 0, 0, cell.width, cell.height);
      const img = v.mode === 'clean' ? preprocess(cell) : v.mode === 'contrast' ? contrast(cell) : cell;
      const { data } = await worker.recognize(img);
      const lines = (data.lines || []).map((l) => ({ text: l.text.trim(), conf: Math.round(l.confidence), y0: l.bbox ? l.bbox.y0 : null })).filter((l) => l.text);
      (readings[r * (grid.xs.length - 1) + c] ||= []).push(splitCard(lines, cell.height));
      if (onProgress) onProgress(++done / total);
    }
  }
  } finally {
    await worker.setParameters({ tessedit_pageseg_mode: DEFAULT_PSM }); // always restore, even after an error
  }
  readings.forEach((cands, i) => {
    const all = cands.filter(Boolean);
    const ok = all.filter((k) => k.word);
    if (!all.length) return;
    // Word: most confident reading, with a bonus when several readings agree.
    const votes = new Map();
    for (const k of ok) { const key = k.word.toLowerCase(); const v = votes.get(key) || { n: 0, conf: 0, word: k.word }; v.n++; v.conf = Math.max(v.conf, k.wordConf); votes.set(key, v); }
    const bestWord = [...votes.values()].sort((a, b) => (b.conf + 8 * (b.n - 1)) - (a.conf + 8 * (a.n - 1)))[0] || { word: '', n: 0, conf: 0 };
    // Definition: the reading the OCR was most sure of; agreement between readings raises it.
    const defs = all.filter((k) => k.definition);
    const defVotes = new Map();
    for (const k of defs) { const v = defVotes.get(k.definition) || { n: 0, mean: 0, min: 0, text: k.definition }; v.n++; v.mean = Math.max(v.mean, k.defMean); v.min = Math.max(v.min, k.defConf); defVotes.set(k.definition, v); }
    const bestDef = [...defVotes.values()].sort((a, b) => (b.mean + 8 * (b.n - 1)) - (a.mean + 8 * (a.n - 1)))[0];
    const notes = ['Read from a table of word cards (each card read on its own). Check the word and definition against the photo.'];
    if (!bestWord.word) notes.push('The word on this card could not be read; type it from the photo.');
    else if (bestWord.n < ok.length / 2) notes.push('The readings of this word disagreed; check its spelling.');
    if (!bestDef) notes.push('No definition could be read on this card.');
    rows.push({ word: bestWord.word, definition: bestDef ? bestDef.text : '', conf: Math.min(bestWord.conf, bestDef ? Math.round(bestDef.mean) : 0), notes, cell: [Math.floor(i / (grid.xs.length - 1)), i % (grid.xs.length - 1)] });
  });
  return rows;
}
