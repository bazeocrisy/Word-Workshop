import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractNumberedList, pairCardGrid, vocabStart } from '../../js/layout.js';

// Shapes taken from what the reader returned for a real teacher newsletter (spelling box beside another box).
const seg = (text, x0, x1, conf = 90) => ({ text, x0, x1, conf });
const line = (...segments) => ({ text: segments.map((s) => s.text).join('\t'), conf: 90, segments });

test('numbered spelling list is found even when lines mix two boxes; gaps and duplicates are explained', () => {
  const lines = [
    line(seg('WHAT WERE LEARNING TED) SPELLING WORDS', 50, 1000)),
    line(seg('e Math - Multiplication &', 50, 500), seg('1. rings', 600, 750), seg('9. boxes', 850, 1000)),
    line(seg('Division', 50, 200), seg('2. snacks', 600, 760), seg('10. trees', 850, 1000)),
    line(seg('. Reading -Poetry &', 50, 400), seg('3. glasses', 600, 780), seg('11. mends', 850, 1000)),
    line(seg('Memoir', 50, 200), seg('4. desks', 600, 740), seg('12. tables', 850, 1000)),
    line(seg('* Writing - Narrative', 50, 400), seg('5. jumps', 600, 740), seg('13. flashes', 850, 1000)),
    line(seg('e Spelling - -s/-es', 50, 400), seg('6. b', 600, 640)),
    line(seg('buzzes', 600, 720), seg('14. bushes', 850, 1000)),
    line(seg('eo ELA - Review', 50, 400), seg('15. thank', 850, 1000)),
    line(seg('* Social Studies -', 50, 400), seg('» crashes', 600, 740), seg('15. thanks', 850, 1000)),
    line(seg('Government', 50, 300), seg('8. shops', 600, 740)),
  ];
  const r = extractNumberedList(lines);
  assert.deepEqual(r.items.map((i) => i.word), ['rings', 'snacks', 'glasses', 'desks', 'jumps', 'buzzes', 'crashes', 'shops', 'boxes', 'trees', 'mends', 'tables', 'flashes', 'bushes', 'thanks']);
  assert.ok(r.notes.some((n) => /15 was read twice/.test(n)));
  assert.ok(r.items.find((i) => i.word === 'crashes').notes.length, 'guessed number is flagged');
});

test('a number and its word read as separate pieces are joined', () => {
  const lines = [1, 2, 3, 4, 5].map((n) => line(seg(`${n}.`, 600, 630), seg(['crawl', 'yawn', 'straw', 'lawn', 'prawn'][n - 1], 660, 760)));
  assert.deepEqual(extractNumberedList(lines).items.map((i) => i.word), ['crawl', 'yawn', 'straw', 'lawn', 'prawn']);
});

test('fewer than five numbered words is not treated as a spelling list', () => {
  assert.equal(extractNumberedList([line(seg('1. Math', 0, 100)), line(seg('2. Reading', 0, 100))]), null);
});

test('vocabulary card grid is paired by column, including a card that sits lower', () => {
  const lines = [
    line(seg('vocabulary', 50, 250), seg('things, usually with the', 700, 1000)),
    line(seg('sincere', 80, 220), seg('agreeable', 330, 520), seg('capable', 620, 760)),
    line(seg('trustworthy &', 60, 250), seg('enjoyable or', 340, 510), seg('having the', 610, 770)),
    line(seg('genuine', 90, 210), seg('pleasant', 360, 490), seg('ability to do', 600, 780), seg('impartial', 860, 1010)),
    line(seg('or achieve', 620, 760)),
    line(seg('fair & just', 870, 1000)),
    line(seg('author', 90, 200), seg('generous', 350, 500), seg('diligent', 620, 760)),
    line(seg('a writer of a', 60, 240), seg('being willing', 340, 510), seg('showing care', 600, 780)),
    line(seg('book, article,', 60, 240), seg('to share', 360, 490), seg('in one’s work', 600, 780)),
    line(seg('or report', 90, 210)),
  ];
  const start = vocabStart(lines);
  assert.equal(start, 0);
  const rows = pairCardGrid(lines.slice(start + 1));
  const map = Object.fromEntries(rows.map((r) => [r.word, r.definition]));
  assert.deepEqual(map, {
    sincere: 'trustworthy & genuine', agreeable: 'enjoyable or pleasant', capable: 'having the ability to do or achieve',
    impartial: 'fair & just', author: 'a writer of a book, article, or report', generous: 'being willing to share', diligent: 'showing care in one’s work',
  });
  assert.ok(rows.every((r) => r.notes.some((n) => /grid of word cards/.test(n))));
});

test('a two-column word/definition table is not mistaken for a card grid', () => {
  const lines = [
    line(seg('Word', 100, 200), seg('Definition', 500, 700)),
    line(seg('Produce', 100, 250), seg('Fresh fruits and vegetables', 500, 1000)),
    line(seg('Exception', 100, 280), seg('A case where a rule does not apply', 500, 1100)),
    line(seg('Peculiar', 100, 250), seg('strange or unusual', 500, 800)),
  ];
  assert.equal(pairCardGrid(lines), null);
});

test('real-photo numbering: a missing period and a misread number are recovered', async () => {
  const { extractNumberedList, voteNumbered } = await import('../../js/layout.js');
  // shapes from the real Oct 12 newsletter photo: "T rushed" (1. misread), "10 landed" (no period)
  const lines = [
    line(seg('e Math - Properties of', 50, 400), seg('T rushed', 520, 640), seg('g. callec', 760, 880)),
    line(seg('Multiplication', 50, 300), seg('2. blasted', 520, 660), seg('9. lifted', 760, 880)),
    line(seg('Reading', 50, 300), seg('3. washed', 520, 660), seg('10 landed', 760, 900)),
    line(seg('Because of Winn-Dixie', 50, 400), seg('4. winked', 520, 660), seg('11. hunted', 760, 900)),
    line(seg('Writing', 50, 300), seg('5. opened', 520, 660), seg('12. screamed', 760, 920)),
  ];
  const r = extractNumberedList(lines);
  const byN = Object.fromEntries(r.items.map((i) => [i.number, i.word]));
  assert.equal(byN[1], 'rushed', 'number guessed from the column position');
  assert.equal(byN[10], 'landed', 'number without a period');
  assert.ok(r.items.find((i) => i.number === 1).notes.some((n) => /from its position/.test(n)));
  // voting across readings fixes "callec" → "called" when other readings agree
  const other = { items: [{ number: 8, word: 'called', conf: 90, notes: [] }, { number: 1, word: 'rushed', conf: 90, notes: [] }], notes: [] };
  const other2 = { items: [{ number: 8, word: 'called', conf: 88, notes: [] }], notes: [] };
  const v = voteNumbered([r, other, other2]);
  assert.equal(v.items.find((i) => i.number === 8).word, 'called');
  assert.ok(v.items.find((i) => i.number === 8).notes.some((n) => /Readings differed/.test(n)));
});

test('voting never gives one word to two numbers', async () => {
  const { voteNumbered } = await import('../../js/layout.js');
  const a = { items: [{ number: 2, word: 'blasted', conf: 90, notes: [] }, { number: 5, word: 'blasted', conf: 70, notes: ['Its number was not readable; it was placed as number 5 from its position. Check the word and the order.'] }], notes: [] };
  const b = { items: [{ number: 2, word: 'blasted', conf: 92, notes: [] }], notes: [] };
  const v = voteNumbered([a, b]);
  assert.deepEqual(v.items.map((i) => [i.number, i.word]), [[2, 'blasted']]);
});
