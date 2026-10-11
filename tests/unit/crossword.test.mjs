import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCrossword, cleanWord, checkCell, checkPuzzle, nextCell, prevCell, wordAt } from '../../js/crossword.js';

const TWELVE = ['Produce', 'Exception', 'Installment', 'Peculiar', 'Employee', 'Fortunate', 'Ignorant', 'Melancholy',
  'Trustworthy', 'Constellations', 'Irritating', 'Distracted'];
const SEVEN = ['sincere', 'agreeable', 'capable', 'impartial', 'author', 'generous', 'diligent'];
const toEntries = (words) => words.map((word, i) => ({ id: `v${i}`, word, clue: `Clue for ${word}` }));

/** Every maximal run of 2+ letters (both directions) must be exactly one placed word, and vice versa. */
function assertValid(p, maxSize = 15) {
  assert.ok(p.width <= maxSize && p.height <= maxSize, `grid ${p.width}x${p.height} too big`);
  assert.equal(p.cells.length, p.height);
  p.cells.forEach((row) => assert.equal(row.length, p.width));
  const at = (r, c) => p.cells[r]?.[c] || null;
  const runs = [];
  for (const [dir, dr, dc] of [['across', 0, 1], ['down', 1, 0]]) {
    for (let r = 0; r < p.height; r++) {
      for (let c = 0; c < p.width; c++) {
        if (!at(r, c) || at(r - dr, c - dc)) continue;
        let len = 0, s = '';
        while (at(r + dr * len, c + dc * len)) { s += at(r + dr * len, c + dc * len).letter; len++; }
        if (len >= 2) runs.push(`${dir}:${r},${c}:${s}`);
      }
    }
  }
  const words = [...p.across.map((e) => ({ ...e, d: 'across' })), ...p.down.map((e) => ({ ...e, d: 'down' }))];
  const placed = words.map((e) => `${e.d}:${e.row},${e.col}:${e.answer}`);
  assert.deepEqual(runs.sort(), placed.sort(), 'runs in the grid must equal the placed words');
  // Every letter cell belongs to some word; the grid is trimmed (no empty edge rows/cols).
  const covered = new Set();
  for (const e of words) for (let i = 0; i < e.length; i++) covered.add(e.d === 'across' ? `${e.row},${e.col + i}` : `${e.row + i},${e.col}`);
  p.cells.forEach((row, r) => row.forEach((cell, c) => { if (cell) assert.ok(covered.has(`${r},${c}`)); }));
  assert.ok(p.cells[0].some(Boolean) && p.cells[p.height - 1].some(Boolean));
  assert.ok(p.cells.some((row) => row[0]) && p.cells.some((row) => row[p.width - 1]));
  // Numbering: reading order, a number exactly where an across or down word starts.
  let n = 0;
  p.cells.forEach((row, r) => row.forEach((cell, c) => {
    if (!cell) return;
    const starts = words.filter((e) => e.row === r && e.col === c);
    if (starts.length) { n++; assert.equal(cell.number, n, `cell ${r},${c}`); starts.forEach((e) => assert.equal(e.number, n)); }
    else assert.equal(cell.number, undefined);
  }));
  return words;
}

function pieces(p) {
  const seen = new Set();
  let n = 0;
  p.cells.forEach((row, r) => row.forEach((cell, c) => {
    if (!cell || seen.has(`${r},${c}`)) return;
    n++;
    const stack = [[r, c]];
    seen.add(`${r},${c}`);
    while (stack.length) {
      const [a, b] = stack.pop();
      for (const [x, y] of [[a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]]) {
        if (p.cells[x]?.[y] && !seen.has(`${x},${y}`)) { seen.add(`${x},${y}`); stack.push([x, y]); }
      }
    }
  }));
  return n;
}

test('cleaning: letters only, uppercase', () => {
  assert.equal(cleanWord('Ice-cream'), 'ICECREAM');
  assert.equal(cleanWord("don't"), 'DONT');
  assert.equal(cleanWord(' New York '), 'NEWYORK');
  const p = buildCrossword(toEntries(['Ice-cream', "don't", 'a', '!!']), { seed: 1 });
  assertValid(p);
  const answers = [...p.across, ...p.down].map((e) => e.answer).sort();
  assert.deepEqual(answers, ['DONT', 'ICECREAM']);
  assert.deepEqual(p.unplaced.map((u) => u.word).sort(), ['!!', 'a']);
});

test('the 12 sample vocabulary words: all placed, valid, within 15x15', () => {
  const entries = toEntries(TWELVE);
  const p = buildCrossword(entries, { seed: 1 });
  const words = assertValid(p);
  assert.equal(words.length, 12);
  assert.deepEqual(p.unplaced, []);
  assert.deepEqual(words.map((e) => e.id).sort(), entries.map((e) => e.id).sort());
  for (const e of words) assert.equal(e.clue, `Clue for ${TWELVE[+e.id.slice(1)]}`);
  console.log(`  12 words: ${p.width}x${p.height}, ${pieces(p)} connected piece(s)`);
  assert.ok(pieces(p) <= 3);
});

test('the 7 words: all placed and connected', () => {
  for (const seed of [1, 2, 3, 42]) {
    const p = buildCrossword(toEntries(SEVEN), { seed });
    assert.equal(assertValid(p).length, 7);
    assert.equal(pieces(p), 1);
  }
});

test('deterministic for a seed; validity holds across seeds', () => {
  const a = buildCrossword(toEntries(TWELVE), { seed: 9 });
  const b = buildCrossword(toEntries(TWELVE), { seed: 9 });
  assert.deepEqual(a, b);
  let placed = 0;
  for (const seed of [2, 3, 4]) {
    const p = buildCrossword(toEntries(TWELVE), { seed });
    const n = assertValid(p).length;
    placed += n;
    assert.equal(n + p.unplaced.length, 12);
  }
  console.log(`  12 words over 3 more seeds: ${placed}/36 placed`);
});

test('smaller maxSize is respected; leftovers reported', () => {
  const p = buildCrossword(toEntries(TWELVE), { seed: 1, maxSize: 9 });
  const words = assertValid(p, 9);
  assert.equal(words.length + p.unplaced.length, 12);
  assert.ok(p.unplaced.some((u) => u.word === 'Constellations')); // 14 letters cannot fit in 9
});

test('single word, duplicates, empty input', () => {
  const one = buildCrossword([{ id: 'a', word: 'Peculiar', clue: 'Strange' }], { seed: 1 });
  assert.equal(one.width, 8);
  assert.equal(one.height, 1);
  assert.deepEqual(one.across.map((e) => [e.number, e.answer, e.clue]), [[1, 'PECULIAR', 'Strange']]);
  assert.equal(one.cells[0][0].number, 1);

  const dup = buildCrossword(toEntries(['author', 'author', 'generous']), { seed: 1 });
  const words = assertValid(dup);
  assert.equal(words.length + dup.unplaced.length, 3);
  assert.ok(words.filter((e) => e.answer === 'AUTHOR').length >= 1);

  for (const empty of [[], null, undefined]) {
    const p = buildCrossword(empty);
    assert.deepEqual(p, { width: 0, height: 0, cells: [], across: [], down: [], unplaced: [] });
  }
});

test('checkCell / checkPuzzle', () => {
  const p = buildCrossword(toEntries(SEVEN), { seed: 1 });
  const words = assertValid(p);
  const blank = p.cells.map((row) => row.map(() => ''));
  const full = p.cells.map((row) => row.map((cell) => (cell ? cell.letter.toLowerCase() : '')));
  const total = p.cells.flat().filter(Boolean).length;
  assert.deepEqual(checkPuzzle(p, blank), { correctCells: 0, totalCells: total, wordsCorrect: [] });
  const done = checkPuzzle(p, full);
  assert.equal(done.correctCells, total);
  assert.deepEqual(done.wordsCorrect.sort(), words.map((e) => e.id).sort());
  // Fill only the first across word.
  const e = p.across[0];
  const partial = p.cells.map((row) => row.map(() => ''));
  for (let i = 0; i < e.length; i++) partial[e.row][e.col + i] = e.answer[i];
  assert.deepEqual(checkPuzzle(p, partial).wordsCorrect, [e.id]);
  assert.ok(checkCell(p, e.row, e.col, e.answer[0].toLowerCase()));
  assert.ok(!checkCell(p, e.row, e.col, 'Q') || e.answer[0] === 'Q');
  const empty = p.cells.flat().indexOf(null);
  if (empty >= 0) assert.equal(checkCell(p, Math.floor(empty / p.width), empty % p.width, 'A'), false);
});

test('wordAt / nextCell / prevCell navigation', () => {
  const p = buildCrossword(toEntries(SEVEN), { seed: 1 });
  const e = p.across[0];
  assert.equal(wordAt(p, e.row, e.col, 'across').id, e.id);
  assert.equal(wordAt(p, e.row, e.col + 1, 'across').id, e.id);
  // A cell only in an across word, asked for "down", falls back to the across word.
  for (let i = 0; i < e.length; i++) {
    const down = p.down.find((d) => d.col === e.col + i && e.row >= d.row && e.row < d.row + d.length);
    if (!down) { assert.equal(wordAt(p, e.row, e.col + i, 'down').id, e.id); break; }
  }
  assert.equal(wordAt(p, -1, -1, 'across'), null);

  assert.deepEqual(nextCell(p, e.row, e.col, 'across'), { row: e.row, col: e.col + 1, direction: 'across' });
  assert.deepEqual(prevCell(p, e.row, e.col + 1, 'across'), { row: e.row, col: e.col, direction: 'across' });
  // End of a word: jump to the first cell of the next clue.
  const list = [...p.across, ...p.down];
  const n = list[1];
  assert.deepEqual(nextCell(p, e.row, e.col + e.length - 1, 'across'), { row: n.row, col: n.col, direction: n.direction });
  // Start of the first word: back to the last cell of the last clue (wraps).
  const last = list[list.length - 1];
  const lastCell = last.direction === 'across' ? { row: last.row, col: last.col + last.length - 1 } : { row: last.row + last.length - 1, col: last.col };
  assert.deepEqual(prevCell(p, e.row, e.col, 'across'), { ...lastCell, direction: last.direction });
  // Down navigation moves down a row.
  const d = p.down[0];
  assert.deepEqual(nextCell(p, d.row, d.col, 'down'), { row: d.row + 1, col: d.col, direction: 'down' });
  assert.equal(nextCell(p, -5, -5, 'down'), null);
});
