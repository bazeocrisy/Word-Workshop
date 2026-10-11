import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseVocabText, parseSpellingText, parseVocabLines, splitSections, parseSentenceLines, isHeading } from '../../js/parse.js';

test('vocab: common separators', () => {
  const { rows } = parseVocabText('Vocabulary Words\n1. Produce - Fresh fruits and vegetables\n2. Exception: A case where a rule does not apply\nPeculiar\tstrange or unusual\nEmployee — Someone who works for money');
  assert.deepEqual(rows.map((r) => r.word), ['Produce', 'Exception', 'Peculiar', 'Employee']);
  assert.equal(rows[0].definition, 'Fresh fruits and vegetables');
  assert.equal(rows[2].definition, 'strange or unusual');
});

test('vocab: definition on the next line, and wrapped definitions', () => {
  const { rows } = parseVocabText('Constellations\nA group of stars in the night sky that make up a picture\nor a pattern\nPeculiar\nstrange or unusual');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].definition, 'A group of stars in the night sky that make up a picture or a pattern');
  assert.equal(rows[1].word, 'Peculiar');
});

test('vocab: column of words then column of definitions is paired by order and flagged', () => {
  const { rows } = parseVocabText('Produce\nException\nPeculiar\nFresh fruits and vegetables\nA case where a rule does not apply\nstrange or unusual');
  assert.equal(rows.length, 3);
  assert.equal(rows[2].definition, 'strange or unusual');
  assert.ok(rows.every((r) => r.notes.some((n) => /order/.test(n))));
});

test('vocab: OCR row without a separator is guessed and flagged', () => {
  const { rows } = parseVocabLines([{ text: 'Melancholy A sad or gloomy condition', conf: 71 }]);
  assert.equal(rows[0].word, 'Melancholy');
  assert.equal(rows[0].definition, 'A sad or gloomy condition');
  assert.equal(rows[0].conf, 71);
  assert.ok(rows[0].notes.length);
});

test('vocab: word without a definition is kept and flagged; headings ignored', () => {
  const { rows, ignored } = parseVocabText('Name: ____ Date: ____\nVOCABULARY WORDS\nTrustworthy');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].definition, '');
  assert.ok(ignored.length >= 2);
});

test('spelling: one per line, commas, numbers in columns restore teacher order', () => {
  assert.deepEqual(parseSpellingText('rushed\nblasted\nwashed').words.map((w) => w.word), ['rushed', 'blasted', 'washed']);
  assert.deepEqual(parseSpellingText('rushed, blasted; washed').words.map((w) => w.word), ['rushed', 'blasted', 'washed']);
  const cols = parseSpellingText('Spelling Words\n1. rushed    4. winked\n2. blasted   5. opened\n3. washed    6. buzzed');
  assert.deepEqual(cols.words.map((w) => w.word), ['rushed', 'blasted', 'washed', 'winked', 'opened', 'buzzed']);
  assert.deepEqual(cols.notes, []);
});

test('spelling: missing numbers are reported', () => {
  const r = parseSpellingText('1. rushed\n2. blasted\n4. winked');
  assert.match(r.notes[0], /3/);
});

test('sections: a newsletter page is split by headings', () => {
  const lines = ['Room 12 News', 'Spelling Words', '1. rushed', '2. blasted', 'Vocabulary', 'Produce - Fresh fruits and vegetables'].map((text) => ({ text, conf: 90 }));
  const s = splitSections(lines);
  assert.equal(s.spelling.length, 2);
  assert.equal(s.vocab.length, 1);
  assert.equal(s.unknown.length, 1);
});

test('headings', () => {
  assert.ok(isHeading('Spelling Words'));
  assert.ok(isHeading('Week of 10/12'));
  assert.ok(isHeading('10/12/2026'));
  assert.ok(!isHeading('rushed'));
  assert.ok(!isHeading('Produce - Fresh fruits and vegetables'));
});

test('sentences pasted back are matched to words', () => {
  const { found, unmatched } = parseSentenceLines('rushed: We rushed home.\nThe rocket blasted off.\nNothing here.', ['rushed', 'blasted']);
  assert.equal(found.get('rushed'), 'We rushed home.');
  assert.equal(found.get('blasted'), 'The rocket blasted off.');
  assert.deepEqual(unmatched, ['Nothing here.']);
});

test('review fixes: word banks and two-per-line lists become separate words (M2 review, Major 2)', () => {
  assert.deepEqual(parseSpellingText('rushed blasted washed winked\nopened buzzed asked called').words.map((w) => w.word),
    ['rushed', 'blasted', 'washed', 'winked', 'opened', 'buzzed', 'asked', 'called']);
  assert.deepEqual(parseSpellingText('rushed blasted\nwashed winked').words.map((w) => w.word), ['rushed', 'blasted', 'washed', 'winked']);
  const bonus = parseSpellingText('1. rushed\n2. blasted\nBonus: stepped\nChallenge words: tomorrow, yesterday');
  assert.deepEqual(bonus.words.map((w) => w.word), ['rushed', 'blasted', 'stepped', 'tomorrow', 'yesterday']);
  assert.ok(bonus.notes.some((n) => /Bonus/.test(n)) && bonus.notes.some((n) => /Challenge/.test(n)));
  const note = parseSpellingText('rushed\nPlease practice every night.\nblasted');
  assert.deepEqual(note.words.map((w) => w.word), ['rushed', 'blasted']);
  assert.ok(note.ignored.some((x) => /practice/.test(x)), 'the note is shown as ignored, not lost silently');
});

test('review fixes: wrapped definitions are joined and flagged (M2 review, Major 3)', () => {
  let { rows } = parseVocabText('Employee - Someone who works\nfor money\nPeculiar - strange or unusual');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].definition, 'Someone who works for money');
  assert.ok(rows[0].notes.some((n) => /joined/.test(n)));
  ({ rows } = parseVocabText('Constellations - A group of stars in the night sky that make up a picture or\nPattern seen from Earth'));
  assert.equal(rows[0].definition, 'A group of stars in the night sky that make up a picture or Pattern seen from Earth');
  ({ rows } = parseVocabText('constellations\na group of stars that make a pattern\npeculiar\nstrange or unusual'));
  assert.deepEqual(rows.map((r) => r.word), ['constellations', 'peculiar'], 'a lower-case next word is not swallowed');
});

test('review fixes: table header and non-word sections are not imported', () => {
  const { rows } = parseVocabText('Word\tDefinition\nProduce\tFresh fruits and vegetables');
  assert.deepEqual(rows.map((r) => r.word), ['Produce']);
  const s = splitSections(['Vocabulary', 'Produce - Fresh fruits and vegetables', 'Reminders', 'Picture day is Tuesday.'].map((text) => ({ text, conf: null })));
  assert.equal(s.vocab.length, 1);
});

test('stray numbers and marks from photos are not spelling words', () => {
  const r = parseSpellingText('rushed\tn]\t4\nblasted');
  assert.deepEqual(r.words.map((w) => w.word), ['rushed', 'blasted']);
});
