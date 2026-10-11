// Crossword layout for vocabulary words (pure; unit-tested in Node).
// Classic rules: words run across or down, cross only on matching letters, and never sit side by side
// or end-to-end with another word, so every run of 2+ letters in the grid is exactly one placed word.
// Several orderings are tried (longest first + seeded shuffles); the best layout wins:
// most words placed, then fewest separate pieces, then most crossings, then smallest area.
import { rng, shuffle } from './model.js';

const ACROSS = 'across';
const DOWN = 'down';
const STEP = { [ACROSS]: [0, 1], [DOWN]: [1, 0] };
const key = (r, c) => `${r},${c}`;

/** Grid letters only: A–Z, uppercased ("Ice-cream" → "ICECREAM", "don't" → "DONT"). */
export function cleanWord(word) {
  return String(word || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z]/g, '');
}

// ---- layout state: map of "r,c" → { letter, across: bool, down: bool } ----

function newLayout() { return { cells: new Map(), placed: [], minR: 0, maxR: -1, minC: 0, maxC: -1, crossings: 0 }; }

function cloneBox(L) { return { minR: L.minR, maxR: L.maxR, minC: L.minC, maxC: L.maxC }; }

/** Bounding box after adding a word (or the current box if the layout is empty). */
function boxWith(L, r, c, len, dir) {
  const [dr, dc] = STEP[dir];
  const r2 = r + dr * (len - 1), c2 = c + dc * (len - 1);
  if (!L.placed.length) return { minR: r, maxR: r2, minC: c, maxC: c2 };
  return { minR: Math.min(L.minR, r), maxR: Math.max(L.maxR, r2), minC: Math.min(L.minC, c), maxC: Math.max(L.maxC, c2) };
}

/** Number of crossings if `ans` fits at (r,c,dir), or -1 if it breaks a rule. */
function fit(L, ans, r, c, dir, maxSize) {
  const [dr, dc] = STEP[dir];
  const other = dir === ACROSS ? DOWN : ACROSS;
  // Nothing directly before the start or after the end.
  if (L.cells.has(key(r - dr, c - dc)) || L.cells.has(key(r + dr * ans.length, c + dc * ans.length))) return -1;
  let crossings = 0;
  for (let i = 0; i < ans.length; i++) {
    const rr = r + dr * i, cc = c + dc * i;
    const cell = L.cells.get(key(rr, cc));
    if (cell) {
      // Shared cell: same letter, and only where a word of the other direction passes.
      if (cell.letter !== ans[i] || cell[dir] || !cell[other]) return -1;
      crossings++;
    } else if (L.cells.has(key(rr + dc, cc + dr)) || L.cells.has(key(rr - dc, cc - dr))) {
      return -1; // a new letter must not touch a neighbour sideways
    }
  }
  if (crossings === ans.length) return -1;
  const b = boxWith(L, r, c, ans.length, dir);
  if (b.maxR - b.minR + 1 > maxSize || b.maxC - b.minC + 1 > maxSize) return -1;
  return crossings;
}

function place(L, item, r, c, dir, crossings) {
  const [dr, dc] = STEP[dir];
  for (let i = 0; i < item.answer.length; i++) {
    const k = key(r + dr * i, c + dc * i);
    // Fresh cell objects, so a copied layout never shares mutable cells.
    L.cells.set(k, { ...(L.cells.get(k) || { letter: item.answer[i], across: false, down: false }), [dir]: true });
  }
  Object.assign(L, boxWith(L, r, c, item.answer.length, dir));
  L.placed.push({ ...item, row: r, col: c, dir, crossings });
  L.crossings += crossings;
}

const area = (b) => (b.maxR - b.minR + 1) * (b.maxC - b.minC + 1);
const squareness = (b) => Math.abs((b.maxR - b.minR) - (b.maxC - b.minC));

const copyLayout = (L) => ({ ...L, cells: new Map(L.cells), placed: L.placed.slice() });

/** Every legal crossing spot for a word, best first (seeded noise breaks ties / explores). */
function crossingSpots(L, item, maxSize, rand, noise) {
  const spots = new Map();
  for (const [k, cell] of L.cells) {
    const [r0, c0] = k.split(',').map(Number);
    for (let i = 0; i < item.answer.length; i++) {
      if (item.answer[i] !== cell.letter) continue;
      for (const dir of [ACROSS, DOWN]) {
        if (cell[dir]) continue;
        const [dr, dc] = STEP[dir];
        const r = r0 - dr * i, c = c0 - dc * i;
        const x = fit(L, item.answer, r, c, dir, maxSize);
        if (x < 1) continue;
        const b = boxWith(L, r, c, item.answer.length, dir);
        const id = `${r},${c},${dir}`;
        if (!spots.has(id)) spots.set(id, { r, c, dir, crossings: x, score: x * 1000 - (area(b) + squareness(b) * 2) + rand() * noise });
      }
    }
  }
  return [...spots.values()].sort((a, b) => b.score - a.score);
}

/** Fallback: a free spot near the others (no crossing needed), smallest resulting area. */
function bestLoose(L, item, maxSize) {
  const len = item.answer.length;
  let best = null;
  for (let r = L.maxR - maxSize + 1; r <= L.minR + maxSize - 1; r++) {
    for (let c = L.maxC - maxSize + 1; c <= L.minC + maxSize - 1; c++) {
      for (const dir of [ACROSS, DOWN]) {
        const x = fit(L, item.answer, r, c, dir, maxSize);
        if (x < 0) continue;
        const b = boxWith(L, r, c, len, dir);
        const score = x * 1000 - area(b) - squareness(b) * 2;
        if (!best || score > best.score) best = { r, c, dir, crossings: x, score };
      }
    }
  }
  return best;
}

/**
 * Layout for one ordering of the words: a small beam search keeps the few best partial grids
 * (each word tried in its top few crossing spots), then a greedy pass finishes the best one.
 */
function layoutOnce(items, maxSize, rand, noise, beam = 6, branch = 3) {
  const fits = items.filter((it) => it.answer.length <= maxSize);
  const tooLong = items.filter((it) => it.answer.length > maxSize);
  if (!fits.length) return { L: newLayout(), pieces: 0, unplaced: tooLong };
  const first = newLayout();
  place(first, fits[0], 0, 0, ACROSS, 0);
  let states = [{ L: first, deferred: [] }];
  for (const it of fits.slice(1)) {
    const next = [];
    for (const st of states) {
      const spots = crossingSpots(st.L, it, maxSize, rand, noise).slice(0, branch);
      if (!spots.length) next.push({ L: st.L, deferred: [...st.deferred, it] });
      for (const sp of spots) {
        const L = copyLayout(st.L);
        place(L, it, sp.r, sp.c, sp.dir, sp.crossings);
        // New letters may give an earlier, stuck word somewhere to cross.
        const deferred = st.deferred.filter((d) => {
          const sp2 = crossingSpots(L, d, maxSize, rand, noise)[0];
          if (sp2) place(L, d, sp2.r, sp2.c, sp2.dir, sp2.crossings);
          return !sp2;
        });
        next.push({ L, deferred });
      }
    }
    const rank = (x) => -x.deferred.length * 1e6 + x.L.crossings * 1000 - (area(x.L) + squareness(x.L) * 2);
    states = next.sort((x, y) => rank(y) - rank(x)).slice(0, beam);
  }
  const { L } = states[0];
  let pending = states[0].deferred;
  while (pending.length) {
    // Place everything that can cross something, retrying until nothing more connects.
    let progress = true;
    while (progress) {
      progress = false;
      const left = [];
      for (const it of pending) {
        const spot = crossingSpots(L, it, maxSize, rand, noise)[0];
        if (spot) { place(L, it, spot.r, spot.c, spot.dir, spot.crossings); progress = true; } else left.push(it);
      }
      pending = left;
    }
    if (!pending.length) break;
    // Start a new piece with the first word that fits loose; the rest may then cross it.
    const idx = pending.findIndex((it) => {
      const spot = bestLoose(L, it, maxSize);
      if (!spot) return false;
      place(L, it, spot.r, spot.c, spot.dir, spot.crossings);
      return true;
    });
    if (idx < 0) break;
    pending.splice(idx, 1);
  }
  return { L, pieces: countPieces(L), unplaced: [...pending, ...tooLong] };
}

/** How many separate connected pieces the placed words form. */
function countPieces(L) {
  const owner = new Map();
  const parent = L.placed.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  L.placed.forEach((p, i) => {
    const [dr, dc] = STEP[p.dir];
    for (let j = 0; j < p.answer.length; j++) {
      const k = key(p.row + dr * j, p.col + dc * j);
      if (owner.has(k)) parent[find(i)] = find(owner.get(k)); else owner.set(k, i);
    }
  });
  return new Set(L.placed.map((_, i) => find(i))).size;
}

const better = (a, b) => {
  if (!b) return true;
  if (a.L.placed.length !== b.L.placed.length) return a.L.placed.length > b.L.placed.length;
  if (a.pieces !== b.pieces) return a.pieces < b.pieces;
  if (a.L.crossings !== b.L.crossings) return a.L.crossings > b.L.crossings;
  return area(a.L) < area(b.L);
};

/** Turn a finished layout into the puzzle shape: trimmed grid, numbered clues. */
function toPuzzle(result) {
  const { L } = result;
  if (!L.placed.length) return { width: 0, height: 0, cells: [], across: [], down: [], unplaced: result.unplaced.map(({ id, word }) => ({ id, word })) };
  const height = L.maxR - L.minR + 1, width = L.maxC - L.minC + 1;
  const cells = Array.from({ length: height }, () => Array(width).fill(null));
  for (const [k, cell] of L.cells) {
    const [r, c] = k.split(',').map(Number);
    cells[r - L.minR][c - L.minC] = { letter: cell.letter };
  }
  const startOf = new Map(L.placed.map((p) => [`${p.row - L.minR},${p.col - L.minC},${p.dir}`, p]));
  const across = [], down = [];
  let n = 0;
  const filled = (r, c) => r >= 0 && c >= 0 && r < height && c < width && cells[r][c] !== null;
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (!cells[r][c]) continue;
      const a = !filled(r, c - 1) && filled(r, c + 1);
      const d = !filled(r - 1, c) && filled(r + 1, c);
      if (!a && !d) continue;
      cells[r][c].number = ++n;
      for (const [is, dir, list] of [[a, ACROSS, across], [d, DOWN, down]]) {
        const p = is && startOf.get(`${r},${c},${dir}`);
        if (p) list.push({ number: n, row: r, col: c, length: p.answer.length, answer: p.answer, clue: p.clue, id: p.id, direction: dir });
      }
    }
  }
  return { width, height, cells, across, down, unplaced: result.unplaced.map(({ id, word }) => ({ id, word })) };
}

/**
 * Lay out a crossword. entries: [{ id, word, clue }]. Deterministic for a given seed.
 * Returns { width, height, cells, across, down, unplaced }.
 */
export function buildCrossword(entries, { seed = 1, maxSize = 15, tries = 40 } = {}) {
  const items = [];
  const skipped = [];
  for (const e of entries || []) {
    const answer = cleanWord(e.word);
    if (answer.length < 2) skipped.push({ id: e.id, word: e.word });
    else items.push({ id: e.id, word: e.word, clue: e.clue ?? '', answer });
  }
  const rand = rng(seed);
  const byLength = items.slice().sort((a, b) => b.answer.length - a.answer.length);
  let best = null;
  for (let t = 0; t < tries && items.length; t++) {
    const order = t === 0 ? byLength : t % 2 ? shuffle(items, rand)
      // Longest word first, rest shuffled: usually the most compact start.
      : [byLength[0], ...shuffle(byLength.slice(1), rand)];
    // Later tries also wobble the placement choice to explore other shapes.
    const result = layoutOnce(order, maxSize, rand, t < tries / 4 ? 1 : 60);
    if (better(result, best)) best = result;
    if (best.L.placed.length === items.length && best.pieces === 1 && t >= tries / 2) break;
  }
  const puzzle = toPuzzle(best || { L: newLayout(), unplaced: [] });
  puzzle.unplaced.push(...skipped);
  return puzzle;
}

// ---- play helpers ----

const entries = (p) => [...p.across, ...p.down];
const cellsOf = (e) => Array.from({ length: e.length }, (_, i) => e.direction === ACROSS ? [e.row, e.col + i] : [e.row + i, e.col]);
const contains = (e, r, c) => e.direction === ACROSS ? r === e.row && c >= e.col && c < e.col + e.length
  : c === e.col && r >= e.row && r < e.row + e.length;

/** Is `letter` right for this cell? Case-insensitive; false for black squares. */
export function checkCell(puzzle, row, col, letter) {
  const cell = puzzle.cells[row]?.[col];
  return !!cell && String(letter || '').toUpperCase() === cell.letter;
}

/** Grade a filled grid (answersGrid[r][c] = typed letter or ''). */
export function checkPuzzle(puzzle, answersGrid) {
  let correctCells = 0, totalCells = 0;
  puzzle.cells.forEach((row, r) => row.forEach((cell, c) => {
    if (!cell) return;
    totalCells++;
    if (checkCell(puzzle, r, c, answersGrid?.[r]?.[c])) correctCells++;
  }));
  const wordsCorrect = entries(puzzle).filter((e) => cellsOf(e).every(([r, c]) => checkCell(puzzle, r, c, answersGrid?.[r]?.[c]))).map((e) => e.id);
  return { correctCells, totalCells, wordsCorrect };
}

/** The clue entry covering this cell in `direction` (or the other direction if none), else null. */
export function wordAt(puzzle, row, col, direction = ACROSS) {
  const first = direction === DOWN ? puzzle.down : puzzle.across;
  const second = direction === DOWN ? puzzle.across : puzzle.down;
  return first.find((e) => contains(e, row, col)) || second.find((e) => contains(e, row, col)) || null;
}

function step(puzzle, row, col, direction, delta) {
  const e = wordAt(puzzle, row, col, direction);
  if (!e) return null;
  const cs = cellsOf(e);
  const i = cs.findIndex(([r, c]) => r === row && c === col) + delta;
  if (i >= 0 && i < cs.length) return { row: cs[i][0], col: cs[i][1], direction: e.direction };
  // Off the end of the word: jump to the next (or previous) clue, across then down, wrapping.
  const list = entries(puzzle);
  const j = (list.indexOf(e) + delta + list.length) % list.length;
  const n = list[j];
  const ncs = cellsOf(n);
  const [r, c] = delta > 0 ? ncs[0] : ncs[ncs.length - 1];
  return { row: r, col: c, direction: n.direction };
}

/** Next cell along the word; after the last letter, the first cell of the next word. */
export const nextCell = (puzzle, row, col, direction) => step(puzzle, row, col, direction, 1);
/** Previous cell along the word; before the first letter, the last cell of the previous word. */
export const prevCell = (puzzle, row, col, direction) => step(puzzle, row, col, direction, -1);
