import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeTiles, chunks, checkBuild, wordLetters } from '../../js/wordbuild.js';

const WORDS = ['rushed', 'blasted', 'washed', 'winked', 'opened', 'buzzed', 'asked', 'called', 'lifted', 'landed',
  'hunted', 'screamed', 'stepped', 'handed', 'crashed', 'rings', 'snacks', 'glasses', 'desks', 'jumps', 'buzzes',
  'crashes', 'shops', 'boxes', 'trees', 'mends', 'tables', 'flashes', 'bushes', 'thanks'];
const sorted = (arr) => arr.slice().sort().join('');

test('tiles hold exactly the word letters, never in spelling order', () => {
  for (const word of WORDS) {
    for (const seed of [1, 2, 3, 99]) {
      const tiles = makeTiles(word, { seed });
      assert.equal(sorted(tiles.map((t) => t.letter)), sorted([...word]), word);
      assert.notEqual(tiles.map((t) => t.letter).join(''), word, `${word} seed ${seed}`);
      assert.equal(new Set(tiles.map((t) => t.id)).size, tiles.length);
    }
  }
  // Two-letter words still get mixed up; one-letter words cannot be.
  assert.equal(makeTiles('at', { seed: 1 }).map((t) => t.letter).join(''), 'ta');
  assert.deepEqual(makeTiles('a', { seed: 1 }).map((t) => t.letter), ['a']);
  assert.deepEqual(makeTiles('', { seed: 1 }), []);
});

test('tiles keep case and skip punctuation', () => {
  assert.equal(sorted(makeTiles('Ice-cream', { seed: 1 }).map((t) => t.letter)), sorted([...'Icecream']));
  assert.deepEqual(wordLetters("don't"), ['d', 'o', 'n', 't']);
});

test('extra tiles are distractors from likely mix-ups; word order still hidden', () => {
  for (const word of WORDS) {
    const tiles = makeTiles(word, { seed: 5, extra: 3 });
    assert.equal(tiles.length, word.length + 3);
    const own = tiles.filter((t) => !t.extra);
    assert.equal(sorted(own.map((t) => t.letter)), sorted([...word]));
    assert.notEqual(own.map((t) => t.letter).join(''), word);
    assert.equal(tiles.filter((t) => t.extra).length, 3);
  }
  const ed = makeTiles('rushed', { seed: 1, extra: 2 }).filter((t) => t.extra).map((t) => t.letter).sort();
  assert.deepEqual(ed, ['d', 't']);
  assert.ok(makeTiles('stepped', { seed: 1, extra: 3 }).some((t) => t.extra && t.letter === 'p'));
  assert.ok(makeTiles('glasses', { seed: 1, extra: 2 }).some((t) => t.extra && t.letter === 'z'));
});

test('deterministic with a seed', () => {
  assert.deepEqual(makeTiles('screamed', { seed: 7, extra: 2 }), makeTiles('screamed', { seed: 7, extra: 2 }));
  const variety = new Set([1, 2, 3, 4, 5].map((seed) => makeTiles('screamed', { seed }).map((t) => t.letter).join('')));
  assert.ok(variety.size > 1);
});

test('chunks join back to the word for all 30 sample words', () => {
  for (const word of WORDS) {
    const parts = chunks(word);
    assert.equal(parts.join(''), word, word);
    assert.ok(parts.length >= 2, `${word} → ${parts}`);
    assert.ok(parts.every(Boolean));
  }
  assert.deepEqual(chunks('jumped'), ['jump', 'ed']);
  assert.deepEqual(chunks('glasses'), ['glass', 'es']);
  assert.deepEqual(chunks('tables'), ['table', 's']);
  assert.deepEqual(chunks('boxes'), ['box', 'es']);
  assert.deepEqual(chunks('trees'), ['tree', 's']);
  assert.deepEqual(chunks('unhappy'), ['un', 'hap', 'py']);
  assert.deepEqual(chunks('Opened'), ['Open', 'ed']);
  for (const w of ['carried', 'constellations', 'trustworthy', 'melancholy', 'cat', 'a', 'rewrite']) assert.equal(chunks(w).join(''), w);
  assert.deepEqual(chunks(''), []);
});

test('checkBuild tracks progress', () => {
  assert.deepEqual(checkBuild('jumps', []), { done: false, correctSoFar: 0, nextIndexWrong: -1 });
  assert.deepEqual(checkBuild('jumps', ['j', 'u']), { done: false, correctSoFar: 2, nextIndexWrong: -1 });
  assert.deepEqual(checkBuild('jumps', ['j', 'o', 'm']), { done: false, correctSoFar: 1, nextIndexWrong: 1 });
  assert.deepEqual(checkBuild('jumps', ['J', 'U', 'M', 'P', 'S']), { done: true, correctSoFar: 5, nextIndexWrong: -1 });
  assert.deepEqual(checkBuild('jumps', ['j', 'u', 'm', 'p', 's', 's']), { done: false, correctSoFar: 5, nextIndexWrong: 5 });
  // Tiles can be passed straight in.
  const tiles = [...'jumps'].map((letter, i) => ({ id: `t${i}`, letter }));
  assert.equal(checkBuild('jumps', tiles).done, true);
});
