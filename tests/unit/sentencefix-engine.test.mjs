import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  grade, normalize, labCategory, labAccepts, LAB_CHOICES, rng, newProgress, TEST_RESERVE, pickSession,
  recordAnswer, markSessionSeen, summarizeTest, hint, explainErrors, markErrors, stepByStep,
} from '../../js/sentencefix/engine.js';

// Small hand-written fixtures (the real bank is checked separately, only if it exists).
const CAP = {
  id: 'T-CAP-1', skill: 'capitalization', difficulty: 'easy',
  incorrect: 'my teacher, ms. lopez, reads to us every friday.',
  correct: 'My teacher, Ms. Lopez, reads to us every Friday.',
  accepted: ['Every Friday, my teacher, Ms. Lopez, reads to us.'],
  errors: [
    { category: 'capitalization', wrong: 'my', right: 'My', explanation: 'A sentence starts with a capital letter.' },
    { category: 'capitalization', wrong: 'ms.', right: 'Ms.', explanation: 'Titles like Ms. start with a capital.' },
    { category: 'capitalization', wrong: 'lopez', right: 'Lopez', explanation: 'Names start with a capital.' },
    { category: 'capitalization', wrong: 'friday', right: 'Friday', explanation: 'Days of the week start with a capital.' },
  ],
  hints: ['type', 'where', 'specific'],
};
const MIX = {
  id: 'T-MIX-1', skill: 'mixed', difficulty: 'hard',
  incorrect: 'the dogs was barking at there neighbor',
  correct: 'The dogs were barking at their neighbor.',
  accepted: [],
  errors: [
    { category: 'capitalization', wrong: 'the', right: 'The', explanation: 'Start with a capital.' },
    { category: 'grammar', wrong: 'was', right: 'were', explanation: 'More than one dog, so use were.' },
    { category: 'spelling', wrong: 'there', right: 'their', explanation: 'Their means belonging to them.' },
    { category: 'punctuation', wrong: 'neighbor', right: 'neighbor.', explanation: 'A telling sentence ends with a period.' },
  ],
};
const COMMA = {
  id: 'T-COM-1', skill: 'commas', difficulty: 'medium',
  incorrect: 'We bought apples oranges and pears.',
  correct: 'We bought apples, oranges, and pears.',
  accepted: ['We bought apples, oranges and pears.'],
  errors: [
    { category: 'punctuation', wrong: 'apples', right: 'apples,', explanation: 'Commas separate items in a list.' },
    { category: 'punctuation', wrong: 'oranges', right: 'oranges,', explanation: 'Commas separate items in a list.' },
  ],
};
const SPELL = {
  id: 'T-SPL-1', skill: 'spelling', difficulty: 'easy',
  incorrect: 'We recieved a big box of crayons yesterday.',
  correct: 'We received a big box of crayons yesterday.',
  accepted: [],
  errors: [{ category: 'spelling', wrong: 'recieved', right: 'received', explanation: 'i before e, except after c.' }],
};
const POSS = {
  id: 'T-POS-1', skill: 'possessives-contractions', difficulty: 'easy',
  incorrect: 'The dogs bone is under the table.',
  correct: "The dog's bone is under the table.",
  accepted: [],
  errors: [{ category: 'punctuation', wrong: 'dogs', right: "dog's", explanation: 'An apostrophe shows the bone belongs to the dog.' }],
};

// ---------- Grading ----------

test('the answer key and an accepted alternative are correct', () => {
  const g = grade(CAP, 'My teacher, Ms. Lopez, reads to us every Friday.');
  assert.equal(g.result, 'correct');
  assert.deepEqual(g.fixed, [0, 1, 2, 3]);
  assert.match(g.message, /Every mistake is fixed/);
  assert.equal(grade(CAP, 'Every Friday, my teacher, Ms. Lopez, reads to us.').result, 'correct');
  assert.equal(grade(COMMA, 'We bought apples, oranges and pears.').result, 'correct'); // no Oxford comma is fine
});

test('harmless spaces and curly quotes are ignored, case and punctuation are not', () => {
  assert.equal(grade(CAP, '  My teacher,  Ms. Lopez , reads to us every Friday .  ').result, 'correct');
  assert.equal(grade(CAP, 'My teacher, Ms. Lopez, reads to us every Friday. ').result, 'correct');
  assert.equal(grade(POSS, 'The dog’s bone is under the table.').result, 'correct');
  assert.equal(normalize('“Hi,”  she said .'), '"Hi," she said.');
  assert.notEqual(grade(CAP, 'my teacher, Ms. Lopez, reads to us every Friday.').result, 'correct');
});

test('copying the sentence unchanged: incorrect, every mistake still there', () => {
  const g = grade(CAP, CAP.incorrect);
  assert.equal(g.result, 'incorrect');
  assert.deepEqual(g.unfixed, [0, 1, 2, 3]);
  assert.deepEqual(g.fixed, []);
  assert.deepEqual(g.extraChanges, []);
  assert.equal(g.message, 'You fixed 0 of 4 mistakes. Look again!');
  assert.deepEqual(grade(MIX, MIX.incorrect).unfixed, [0, 1, 2, 3]);
});

test('partly fixed: incorrect with the right counts', () => {
  const g = grade(CAP, 'My teacher, Ms. lopez, reads to us every friday.');
  assert.equal(g.result, 'incorrect');
  assert.deepEqual(g.fixed, [0, 1]);
  assert.deepEqual(g.unfixed, [2, 3]);
  assert.match(g.message, /You fixed 2 of 4 mistakes/);
  const m = grade(MIX, 'The dogs was barking at their neighbor.');
  assert.deepEqual([m.result, m.fixed, m.unfixed], ['incorrect', [0, 2, 3], [1]]);
  const c = grade(COMMA, 'We bought apples oranges, and pears.');
  assert.deepEqual([c.result, c.fixed, c.unfixed], ['incorrect', [1], [0]]);
});

test('every planted mistake fixed but a new misspelling: incorrect', () => {
  const g = grade(CAP, 'My teacher, Ms. Lopez, reeds to us every Friday.');
  assert.equal(g.result, 'incorrect');
  assert.deepEqual(g.unfixed, []);
  assert.deepEqual(g.extraChanges.filter((x) => x.clear).map((x) => [x.expected, x.got]), [['reads', 'reeds']]);
  assert.match(g.message, /spelling/);
  assert.equal(grade(MIX, 'The dog were barking at their neighbor.').result, 'incorrect');
});

test('a new misspelling of the very word that was wrong is still incorrect', () => {
  const g = grade(SPELL, 'We receieved a big box of crayons yesterday.');
  assert.equal(g.result, 'incorrect');
  assert.deepEqual(g.unfixed, [0]);
});

test('word order change or a synonym: review, never incorrect', () => {
  for (const answer of [
    'My teacher, Ms. Lopez, reads every Friday to us.', // moved words
    'My teacher, Ms. Lopez, reads to us each Friday.', // synonym
    'My teacher, Ms. Lopez, reads to us on every Friday.', // extra word
    'On Fridays, Ms. Lopez reads to our class.', // big rewrite
  ]) {
    const g = grade(CAP, answer);
    assert.equal(g.result, 'review', answer);
    assert.match(g.message, /grown-up/);
  }
  assert.equal(grade(SPELL, 'We got a big box of crayons yesterday.').result, 'review');
});

test('missing final period, lowercase first word, dropped or doubled word: incorrect', () => {
  const noPeriod = grade(CAP, 'My teacher, Ms. Lopez, reads to us every Friday');
  assert.equal(noPeriod.result, 'incorrect');
  assert.deepEqual(noPeriod.unfixed, []);
  const lower = grade(SPELL, 'we received a big box of crayons yesterday.');
  assert.equal(lower.result, 'incorrect');
  assert.match(lower.message, /capital/);
  assert.equal(grade(COMMA, 'We bought apples, oranges, pears.').result, 'incorrect');
  assert.equal(grade(CAP, 'My teacher, Ms. Lopez, reads to to us every Friday.').result, 'incorrect');
  assert.equal(grade(CAP, 'My teacher, Ms. Lopez,reads to us every Friday.').result, 'incorrect'); // missing space
});

test('empty answers', () => {
  for (const a of ['', '   ', '\n\t', null, undefined]) assert.equal(grade(CAP, a).result, 'empty');
});

test('very long, repeated and odd unicode input is handled quickly and never marked correct', () => {
  const t0 = Date.now();
  const longs = ['x '.repeat(5000), CAP.incorrect.repeat(50), (CAP.correct + ' ').repeat(40), '\u{1F600}'.repeat(2000) + ' café'];
  for (const a of longs) {
    const g = grade(CAP, a);
    assert.ok(['incorrect', 'review'].includes(g.result), a.slice(0, 20));
  }
  assert.equal(grade(CAP, CAP.incorrect.repeat(50)).result, 'incorrect');
  assert.ok(Date.now() - t0 < 2000);
});

// ---------- Thinking Lab ----------

test('labCategory: one kind of mistake, or more than one', () => {
  assert.equal(labCategory(CAP), 'capitalization');
  assert.equal(labCategory(SPELL), 'spelling');
  assert.equal(labCategory(COMMA), 'punctuation');
  assert.equal(labCategory(MIX), 'more-than-one');
  assert.deepEqual(LAB_CHOICES.map((c) => c.label), ['Spelling', 'Capital letters', 'Punctuation', 'Grammar', 'More than one type']);
  assert.ok(LAB_CHOICES.some((c) => c.value === labCategory(MIX)));
});

test('labAccepts: a mistake that fits two kinds accepts either, and "more than one" only when it can be', () => {
  const KNEW = { errors: [{ category: 'spelling', altCategory: 'grammar', wrong: 'new', right: 'knew' }] };
  assert.ok(labAccepts(KNEW, 'spelling'));
  assert.ok(labAccepts(KNEW, 'grammar'));
  assert.ok(!labAccepts(KNEW, 'punctuation'));
  assert.ok(!labAccepts(KNEW, 'more-than-one'), 'one mistake is one kind');
  const TWO = { errors: [{ category: 'spelling', altCategory: 'grammar' }, { category: 'grammar' }] };
  assert.ok(labAccepts(TWO, 'grammar'));
  assert.ok(labAccepts(TWO, 'more-than-one'));
  assert.ok(!labAccepts(TWO, 'spelling'));
  assert.ok(labAccepts(CAP, 'capitalization') && !labAccepts(CAP, 'more-than-one'));
  assert.ok(labAccepts(MIX, 'more-than-one') && !labAccepts(MIX, 'grammar'));
  for (const it of [CAP, MIX, COMMA, SPELL, POSS]) assert.ok(labAccepts(it, labCategory(it)), it.id);
});

// ---------- Grading: real-word slips, marks and commas ----------

const fx = (incorrect, correct, errors, accepted = []) => ({ id: 'FX', skill: 'mixed', incorrect, correct, accepted, errors: errors.map(([wrong, right, category = 'grammar']) => ({ wrong, right, category })) });

test('a real word that may be a fair rewrite goes to review; a known wrong form is incorrect', () => {
  const sva = fx('Maya and Leo is in the same group.', 'Maya and Leo are in the same group.', [['is', 'are']]);
  assert.equal(grade(sva, 'Maya and Leo were in the same group.').result, 'review'); // a different tense, not a typo
  assert.equal(grade(sva, 'Maya and Leo am in the same group.').result, 'incorrect'); // agreement
  const cant = fx('I cant find my sock.', "I can't find my sock.", [['cant', "can't", 'punctuation']]);
  assert.equal(grade(cant, 'I cannot find my sock.').result, 'review');
  assert.equal(grade(cant, 'I can not find my sock.').result, 'review');
  assert.equal(grade(cant, "I ca'nt find my sock.").result, 'incorrect');
  const tense = fx('Last week, Mia catched the ball and goes home.', 'Last week, Mia caught the ball and went home.', [['catched', 'caught'], ['goes', 'went']]);
  for (const a of ['Last week, Mia catch the ball and went home.', 'Last week, Mia caught the ball and goed home.', 'Last week, Mia caught the ball and go home.']) {
    assert.equal(grade(tense, a).result, 'incorrect', a);
  }
  const hom = fx('My brother new the answer.', 'My brother knew the answer.', [['new', 'knew', 'spelling']]);
  assert.equal(grade(hom, 'My brother no the answer.').result, 'incorrect');
  const there = fx('There is three apples.', 'There are three apples.', [['is', 'are']]);
  assert.equal(grade(there, "There's three apples.").result, 'incorrect');
});

test('end marks: "!" for "." is review, "." for "?" is incorrect, a missing mark is always incorrect', () => {
  const two = fx('My puppy ran away Can you help', 'My puppy ran away. Can you help?', [['away', 'away.', 'punctuation'], ['help', 'help?', 'punctuation']]);
  assert.equal(grade(two, 'My puppy ran away! Can you help?').result, 'review');
  assert.equal(grade(two, 'My puppy ran away. Can you help.').result, 'incorrect');
  assert.equal(grade(two, 'My puppy ran away. Can you help').result, 'incorrect');
  const q = fx('Where are my boots.', 'Where are my boots?', [['boots.', 'boots?', 'punctuation']]);
  assert.equal(grade(q, 'Where are my boots').result, 'incorrect');
  const quote = fx('Mom asked "who is hungry"', 'Mom asked, "Who is hungry?"', [['asked', 'asked,', 'punctuation'], ['"who', '"Who', 'capitalization'], ['hungry"', 'hungry?"', 'punctuation']]);
  assert.equal(grade(quote, 'Mom asked, "Who is hungry."').result, 'incorrect');
});

test('commas: an optional opening comma may be left out; added or misplaced commas are mistakes', () => {
  const intro = fx('last sunday, we went to the zoo.', 'Last Sunday, we went to the zoo.', [['last', 'Last', 'capitalization']]);
  assert.notEqual(grade(intro, 'Last Sunday we went to the zoo.').result, 'incorrect');
  const list = fx('We planted beans peas carrots and lettuce.', 'We planted beans, peas, carrots and lettuce.', [['beans', 'beans,', 'punctuation'], ['peas', 'peas,', 'punctuation']]);
  assert.notEqual(grade(list, 'We planted beans, peas, carrots, and lettuce.').result, 'incorrect'); // Oxford comma
  assert.equal(grade(list, 'We planted beans, peas, carrots, and, lettuce.').result, 'incorrect');
  assert.equal(grade(list, 'We planted, beans, peas, carrots and lettuce.').result, 'incorrect');
  const date = fx('It was founded on March 4 1852.', 'It was founded on March 4, 1852.', [['March 4', 'March 4,', 'punctuation']]);
  assert.equal(grade(date, 'It was founded on March, 4 1852.').result, 'incorrect');
  const title = fx('Our coach, mr. patel, ran.', 'Our coach, Mr. Patel, ran.', [['mr. patel', 'Mr. Patel', 'capitalization']]);
  assert.equal(grade(title, 'Our coach, Mr Patel, ran.').result, 'incorrect');
  const yes = fx('yes we can go.', 'Yes, we can go.', [['yes', 'Yes,', 'punctuation']]);
  assert.equal(grade(yes, 'Yes we can go.').result, 'incorrect');
});

test('a/an before a vowel sound', () => {
  const hour = fx('We ate in less than an our.', 'We ate in less than an hour.', [['our', 'hour', 'spelling']]);
  assert.equal(grade(hour, 'We ate in less than a hour.').result, 'incorrect');
  const apple = fx('I ate a apple.', 'I ate an apple.', [['a apple', 'an apple', 'grammar']]);
  assert.equal(grade(apple, 'I ate a apple.').result, 'incorrect');
  const owl = fx('I saw a owl yesterday', 'I saw an owl yesterday.', [['a owl', 'an owl'], ['yesterday', 'yesterday.', 'punctuation']]);
  assert.equal(grade(owl, 'I saw an owl yesterday.').result, 'correct');
});

// ---------- Selection ----------

const SKILLS = ['capitalization', 'ending-punctuation', 'commas', 'spelling', 'verb-tense', 'subject-verb', 'homophones', 'possessives-contractions', 'mixed'];
const BANK = [];
SKILLS.forEach((skill, s) => {
  for (let i = 0; i < 16 + (s % 2); i++) {
    BANK.push({ id: `B-${s}-${String(i).padStart(2, '0')}`, skill, difficulty: ['easy', 'medium', 'hard'][i % 3], errors: [] });
  }
});
const byId = new Map(BANK.map((i) => [i.id, i]));

test('rng is deterministic per seed', () => {
  const a = rng('abc'), b = rng('abc'), c = rng(42);
  const xs = [a(), a(), a()];
  assert.deepEqual(xs, [b(), b(), b()]);
  assert.ok(xs.every((x) => x >= 0 && x < 1));
  assert.notDeepEqual(xs, [c(), c(), c()]);
});

test('test reserve: about 20%, at least 2 per skill, stable', () => {
  const r = TEST_RESERVE(BANK);
  assert.ok(r.size >= BANK.length * 0.15 && r.size <= BANK.length * 0.25, String(r.size));
  for (const skill of SKILLS) assert.ok(BANK.filter((i) => i.skill === skill && r.has(i.id)).length >= 2, skill);
  assert.deepEqual([...TEST_RESERVE([...BANK].reverse())].sort(), [...r].sort());
});

test('sessions: no duplicates, deterministic, sizes', () => {
  for (const mode of ['learn', 'practice', 'lab', 'test']) {
    const ids = pickSession(BANK, newProgress(), { mode, seed: 7 });
    assert.equal(new Set(ids).size, ids.length, mode);
    assert.equal(ids.length, { learn: 3, practice: 10, lab: 10, test: 15 }[mode]);
    assert.deepEqual(pickSession(BANK, newProgress(), { mode, seed: 7 }), ids);
  }
  assert.notDeepEqual(pickSession(BANK, newProgress(), { mode: 'practice', seed: 1 }), pickSession(BANK, newProgress(), { mode: 'practice', seed: 2 }));
});

test('practice prefers unseen items, keeps the test reserve out, mixes skills, honours filters', () => {
  const reserve = TEST_RESERVE(BANK);
  let p = newProgress();
  const first = pickSession(BANK, p, { mode: 'practice', size: 10, seed: 'a' });
  assert.ok(first.every((id) => !reserve.has(id)));
  assert.ok(new Set(first.map((id) => byId.get(id).skill)).size >= 4);
  p = markSessionSeen(p, first);
  const second = pickSession(BANK, p, { mode: 'practice', size: 10, seed: 'a' });
  assert.ok(second.every((id) => !first.includes(id)), 'unseen first');
  const learn = pickSession(BANK, p, { mode: 'learn', skill: 'commas', seed: 3 });
  assert.equal(learn.length, 3);
  assert.ok(learn.every((id) => byId.get(id).skill === 'commas' && !reserve.has(id)));
  const hard = pickSession(BANK, p, { mode: 'lab', skill: 'spelling', difficulty: 'hard', size: 4, seed: 3 });
  assert.ok(hard.every((id) => byId.get(id).difficulty === 'hard' && byId.get(id).skill === 'spelling'));
});

test('practice leans toward weak skills', () => {
  const p = { ...newProgress(), stats: Object.fromEntries(SKILLS.map((s) => [s, s === 'homophones' ? { right: 0, wrong: 10 } : { right: 10, wrong: 0 }])) };
  const ids = pickSession(BANK, p, { mode: 'practice', size: 12, seed: 5 });
  const weak = ids.filter((id) => byId.get(id).skill === 'homophones').length;
  assert.ok(weak >= 3, `homophones picked ${weak} times`);
  assert.ok(new Set(ids.map((id) => byId.get(id).skill)).size >= 3, 'still mixed');
});

test('test draws from the reserve first and mixes skills', () => {
  const reserve = TEST_RESERVE(BANK);
  const ids = pickSession(BANK, newProgress(), { mode: 'test', seed: 9 });
  assert.equal(ids.length, 15);
  assert.ok(ids.every((id) => reserve.has(id)));
  assert.ok(new Set(ids.map((id) => byId.get(id).skill)).size >= 8);
  // Bigger than the reserve: whole reserve, then items not in the last two sessions.
  let p = markSessionSeen(newProgress(), pickSession(BANK, newProgress(), { mode: 'practice', size: 40, seed: 1 }));
  const recent = new Set(p.recent.flat());
  const big = pickSession(BANK, p, { mode: 'test', size: reserve.size + 20, seed: 9 });
  assert.ok([...reserve].every((id) => big.includes(id)));
  assert.ok(big.filter((id) => !reserve.has(id)).every((id) => !recent.has(id)));
});

test('still works after every item has been seen (least recently seen first)', () => {
  let p = newProgress();
  for (const it of BANK) p = recordAnswer(p, it, { result: 'correct' }, { mode: 'practice' });
  for (const mode of ['learn', 'practice', 'lab', 'test']) {
    const ids = pickSession(BANK, p, { mode, size: 12, seed: 4 });
    assert.equal(ids.length, 12);
    assert.equal(new Set(ids).size, ids.length);
  }
  const oldest = BANK.filter((i) => !TEST_RESERVE(BANK).has(i.id)).slice(0, 3).map((i) => i.id);
  assert.deepEqual(pickSession(BANK, p, { mode: 'learn', seed: 4 }).sort(), oldest.sort());
  // Asking for more than exists returns everything once.
  const all = pickSession(BANK, p, { mode: 'practice', size: 999, seed: 4 });
  assert.equal(all.length, BANK.length);
  assert.equal(new Set(all).size, BANK.length);
});

test('onlyIds (practice my misses): exactly those, deduped and capped', () => {
  const ids = pickSession(BANK, newProgress(), { mode: 'practice', onlyIds: ['B-1-03', 'B-1-03', 'nope', 'B-2-04', 'B-3-05'], size: 2, seed: 1 });
  assert.deepEqual(ids, ['B-1-03', 'B-2-04']);
});

// ---------- Progress and scoring ----------

test('recordAnswer: stats, first attempt only, review not wrong, missed list', () => {
  const p0 = newProgress();
  let p = recordAnswer(p0, SPELL, { result: 'incorrect' }, { mode: 'practice' });
  assert.deepEqual(p0, newProgress(), 'original untouched');
  assert.deepEqual(p.stats.spelling, { right: 0, wrong: 1 });
  assert.deepEqual(p.missed, ['T-SPL-1']);
  assert.equal(p.seen['T-SPL-1'], p.tick);
  p = recordAnswer(p, SPELL, { result: 'correct' }, { mode: 'practice', attempt: 2 });
  assert.deepEqual(p.stats.spelling, { right: 0, wrong: 1 }, 'retry not counted');
  assert.deepEqual(p.missed, [], 'removed once correct');
  p = recordAnswer(p, CAP, 'review', { mode: 'test' });
  assert.equal(p.stats.capitalization, undefined);
  p = recordAnswer(p, CAP, grade(CAP, CAP.correct), { mode: 'test' });
  assert.deepEqual(p.stats.capitalization, { right: 1, wrong: 0 });
  p = recordAnswer(p, MIX, { result: 'incorrect' }, { mode: 'test' });
  p = recordAnswer(p, MIX, { result: 'incorrect' }, { mode: 'test' });
  assert.deepEqual(p.missed, ['T-MIX-1']);
  assert.deepEqual(JSON.parse(JSON.stringify(p)), p, 'plain JSON');
});

test('summarizeTest leaves review answers out of the percentage', () => {
  const items = [CAP, MIX, COMMA, SPELL, POSS];
  const answers = [
    { id: CAP.id, answer: CAP.correct, grade: grade(CAP, CAP.correct) },
    { id: MIX.id, answer: MIX.incorrect, grade: grade(MIX, MIX.incorrect) },
    { id: COMMA.id, answer: COMMA.correct, grade: grade(COMMA, COMMA.correct) },
    { id: SPELL.id, answer: 'We got a big box of crayons yesterday.', grade: grade(SPELL, 'We got a big box of crayons yesterday.') },
    { id: POSS.id, answer: POSS.correct, grade: 'correct' },
  ];
  const s = summarizeTest(items, answers);
  assert.deepEqual([s.total, s.correct, s.incorrect, s.review], [5, 3, 1, 1]);
  assert.equal(s.scorePercent, 75);
  assert.deepEqual(s.missedIds, [MIX.id]);
  assert.deepEqual(s.bySkill.capitalization, { correct: 1, total: 1 });
  assert.deepEqual(s.bySkill.mixed, { correct: 0, total: 1 });
});

// ---------- Learn helpers ----------

test('stepByStep fixes one mistake at a time and ends at the model sentence', () => {
  for (const it of [CAP, MIX, COMMA, SPELL, POSS]) {
    const steps = stepByStep(it);
    assert.equal(steps.length, it.errors.length);
    assert.equal(steps[steps.length - 1], it.correct);
  }
  assert.deepEqual(stepByStep(MIX).slice(0, 2), ['The dogs was barking at there neighbor', 'The dogs were barking at there neighbor']);
});

test('markErrors covers the whole sentence and underlines each mistake once', () => {
  for (const it of [CAP, MIX, COMMA, SPELL, POSS]) {
    const segs = markErrors(it);
    assert.equal(segs.map((s) => s.text).join(''), it.incorrect);
    assert.deepEqual(segs.filter((s) => s.errorIndex !== null).map((s) => s.errorIndex), it.errors.map((_, i) => i));
  }
  assert.deepEqual(markErrors(CAP).filter((s) => s.errorIndex !== null).map((s) => s.text), ['my', 'ms.', 'lopez', 'friday']);
});

test('hints go from general to specific; explanations in sentence order', () => {
  assert.match(hint(MIX, 1), /4 mistakes/);
  assert.match(hint(CAP, 1), /capital letter/);
  assert.match(hint(CAP, 2), /"my", "ms\.", "lopez", "friday"/);
  assert.match(hint(CAP, 3), /"my" to "My"/);
  assert.match(hint(CAP, 3, { unfixed: [2, 3] }), /"lopez" to "Lopez"/);
  assert.equal(hint({ ...SPELL, hints: ['Look for a spelling mistake.'] }, 1), 'Look for a spelling mistake.');
  const shuffled = { ...COMMA, errors: COMMA.errors };
  assert.deepEqual(explainErrors(shuffled).map((e) => e.wrong), ['apples', 'oranges']);
  assert.deepEqual(Object.keys(explainErrors(CAP)[0]).sort(), ['category', 'explanation', 'right', 'wrong']);
});

// ---------- The real bank (only when it exists) ----------

const BANK_PATH = new URL('../../data/sentence-fix/bank.json', import.meta.url);
test('content bank: every key and accepted answer is correct, every incorrect sentence is not', { skip: !existsSync(BANK_PATH) && 'bank.json not written yet' }, () => {
  const raw = JSON.parse(readFileSync(BANK_PATH, 'utf8'));
  const items = Array.isArray(raw) ? raw : raw.items;
  assert.ok(Array.isArray(items) && items.length > 0);
  for (const it of items) {
    assert.equal(grade(it, it.correct).result, 'correct', it.id);
    for (const alt of it.accepted || []) assert.equal(grade(it, alt).result, 'correct', `${it.id} accepted`);
    const g = grade(it, it.incorrect);
    assert.equal(g.result, 'incorrect', `${it.id} incorrect sentence`);
    assert.equal(stepByStep(it).at(-1), it.correct, `${it.id} steps`);
    assert.equal(markErrors(it).map((s) => s.text).join(''), it.incorrect, `${it.id} marks`);
  }
});
