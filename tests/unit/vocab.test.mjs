import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildActivity, makeQuestion, grade, possiblePoints, makeMatchRounds } from '../../js/vocab.js';
import { rng, compareKey } from '../../js/model.js';

const sample = JSON.parse(fs.readFileSync(new URL('../../sample-data/vocabulary.json', import.meta.url), 'utf8'));
const sentences = JSON.parse(fs.readFileSync(new URL('../../sample-data/sample-sentences.json', import.meta.url), 'utf8'));
const items = sample.items.map((it, i) => ({ id: 'v' + i, word: it.word, definition: it.sourceDefinition, definitionKind: 'teacher', sentence: sentences.vocabulary[it.word] }));

test('every sample sentence contains its exact word once', () => {
  for (const it of items) assert.equal(it.sentence.toLowerCase().split(/[^a-z]+/).filter((w) => w === it.word.toLowerCase()).length, 1, it.word);
  for (const [w, s] of Object.entries(sentences.spelling)) assert.equal(s.toLowerCase().split(/[^a-z]+/).filter((x) => x === w).length, 1, w);
});

test('answer keys: the keyed option is always the right one, and only one option is right', () => {
  for (let seed = 1; seed <= 40; seed++) {
    for (const type of ['def-mc', 'word-mc', 'blank']) {
      const { questions, skipped } = buildActivity(type, items, { seed });
      assert.equal(skipped.length, 0);
      assert.equal(questions.length, 12);
      for (const q of questions) {
        const item = items.find((i) => i.id === q.itemId);
        const right = q.options.filter((o) => (type === 'def-mc' ? compareKey(o.text) === compareKey(item.definition) : compareKey(o.text) === compareKey(item.word)));
        assert.equal(right.length, 1, `${type} ${item.word}`);
        assert.equal(right[0].key, q.answerKey);
        assert.equal(new Set(q.options.map((o) => compareKey(o.text))).size, q.options.length, 'no duplicate options');
        assert.equal(q.options.length, 4);
        assert.equal(grade(q, q.answerKey).points, 1);
        assert.equal(grade(q, q.options.find((o) => o.key !== q.answerKey).key).points, 0);
        assert.equal(grade(q, undefined).points, 0, 'unanswered is wrong');
      }
    }
  }
});

test('fill in the blank hides the word and never offers a word already in the sentence', () => {
  const { questions } = buildActivity('blank', items, { seed: 7 });
  for (const q of questions) {
    assert.ok(q.prompt.includes('_____'));
    assert.ok(!q.prompt.toLowerCase().includes(q.word.toLowerCase()), q.prompt);
    for (const o of q.options) if (o.key !== q.answerKey) assert.ok(!new RegExp(`\\b${o.text}\\b`, 'i').test(q.prompt));
  }
});

test('written answers: case and outer spaces ignored, spelling enforced', () => {
  const q = makeQuestion('write', items[11], items, rng(1)); // Distracted
  assert.equal(grade(q, '  distracted ').points, 1);
  assert.equal(grade(q, 'DISTRACTED').points, 1);
  assert.equal(grade(q, 'distracte').points, 0);
  assert.equal(grade(q, 'distracted.').points, 0);
  assert.equal(grade(q, '').points, 0);
});

test('two words with the same definition: no ambiguous options, either word accepted when written', () => {
  const twin = [...items, { id: 'x', word: 'Odd', definition: 'Strange or unusual', definitionKind: 'teacher', sentence: 'That is an odd hat.' }];
  for (let seed = 1; seed <= 30; seed++) {
    const { questions } = buildActivity('word-mc', twin, { seed });
    for (const q of questions.filter((x) => ['Peculiar', 'Odd'].includes(x.word))) {
      assert.ok(!(q.options.some((o) => o.text === 'Peculiar') && q.options.some((o) => o.text === 'Odd')), 'both twins offered');
    }
  }
  const w = makeQuestion('write', twin.find((x) => x.word === 'Odd'), twin, rng(1));
  assert.equal(grade(w, 'peculiar').points, 1);
});

test('matching: rounds of up to 5, no one-pair round, graded per pair', () => {
  const rounds = makeMatchRounds(items, rng(3));
  assert.deepEqual(rounds.map((r) => r.pairs.length), [5, 5, 2]);
  const r = rounds[0];
  const right = Object.fromEntries(r.pairs.map((p) => [p.itemId, r.options.find((o) => o.text === p.correctText).key]));
  assert.deepEqual(grade(r, right), { ...grade(r, right), points: 5, possible: 5 });
  const oneWrong = { ...right, [r.pairs[0].itemId]: right[r.pairs[1].itemId] };
  assert.equal(grade(r, oneWrong).points, 4);
  assert.equal(grade(r, {}).points, 0);
  const eleven = makeMatchRounds(items.slice(0, 11), rng(3));
  assert.deepEqual(eleven.map((x) => x.pairs.length), [5, 6], 'a leftover single pair joins the previous round');
});

test('mixed: one question per word; falls back when a word has no sentence', () => {
  const noSentence = items.map((it, i) => (i === 0 ? { ...it, sentence: '' } : it));
  for (let seed = 1; seed <= 20; seed++) {
    const { questions, skipped } = buildActivity('mixed', noSentence, { seed });
    assert.equal(questions.length, 12);
    assert.equal(skipped.length, 0);
    assert.notEqual(questions.find((q) => q.itemId === 'v0').type, 'blank');
  }
  assert.equal(possiblePoints(buildActivity('mixed', items, { seed: 1 }).questions), 12);
});

test('blank skips words without a usable sentence and reports why', () => {
  const r = buildActivity('blank', items.map((it, i) => (i < 2 ? { ...it, sentence: i === 0 ? '' : 'No target here.' } : it)), { seed: 1 });
  assert.equal(r.questions.length, 10);
  assert.equal(r.skipped.length, 2);
});

test('missed-word practice restricts targets but keeps all words as distractors', () => {
  const r = buildActivity('def-mc', items, { seed: 2, only: ['v3'] });
  assert.equal(r.questions.length, 1);
  assert.equal(r.questions[0].options.length, 4);
});

test('same seed → same quiz (reproducible attempts)', () => {
  assert.deepEqual(buildActivity('mixed', items, { seed: 99 }), buildActivity('mixed', items, { seed: 99 }));
});
