// Independent grading audit for Sentence Fix (Agent 5). See docs/SENTENCE-FIX-AUDIT.md.
//
// Feeds grade() realistic third-grade answers, not just the answer key. Each case states the
// EDUCATIONALLY correct outcome. Cases where the engine currently disagrees are marked
// { todo: 'engine defect: …' } (or 'bank: …' when the fix belongs in the content), so the suite
// stays green while documenting the problem.
//
// Expectations:
//   'correct'   → must be correct
//   'incorrect' → must be incorrect (never correct, never review)
//   'ok'        → a valid answer a teacher would accept: must NOT be incorrect (correct or review)
//   'review'    → must be review
//   'empty'     → must be empty
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { grade } from '../../js/sentencefix/engine.js';

const bank = JSON.parse(readFileSync(new URL('../../data/sentence-fix/bank.json', import.meta.url), 'utf8'));
const items = bank.items;
const byId = new Map(items.map((i) => [i.id, i]));
const item = (id) => {
  const it = byId.get(id);
  assert.ok(it, `missing item ${id}`);
  return it;
};

function check(id, answer, expect) {
  const g = grade(item(id), answer);
  const info = `${id} ← ${JSON.stringify(answer)} → ${g.result} (${g.message})`;
  if (expect === 'ok') assert.notEqual(g.result, 'incorrect', info);
  else assert.equal(g.result, expect, info);
}

/** Apply every documented fix left to right, except the one at index `skip` (left as the original mistake). */
function applyExcept(it, skip) {
  let cur = 0, out = '';
  it.errors.forEach((e, i) => {
    const p = it.incorrect.indexOf(e.wrong, cur);
    out += it.incorrect.slice(cur, p) + (i === skip ? e.wrong : e.right);
    cur = p + e.wrong.length;
  });
  return out + it.incorrect.slice(cur);
}

const curly = (s) => s.replace(/'/g, '’').replace(/"([^"]*)"/g, '“$1”');

// ---------------------------------------------------------------- Programmatic: all 150 items

test('bank has 150 items', () => assert.equal(items.length, 150));

test('every key and accepted answer grades correct, also with harmless variations', () => {
  for (const it of items) {
    for (const key of [it.correct, ...(it.accepted || [])]) {
      check(it.id, key, 'correct');
      check(it.id, `  ${key}  `, 'correct'); // outer spaces / trailing space
      check(it.id, key.replace(/ /g, '  '), 'correct'); // double spaces (incl. after commas)
      check(it.id, key.replace(/, /g, ',   '), 'correct'); // extra spaces after commas
      check(it.id, curly(key), 'correct'); // curly apostrophes and quotes
      check(it.id, `${key}\n`, 'correct');
    }
  }
});

test('empty and whitespace-only answers are empty', () => {
  for (const it of items) for (const a of ['', '   ', '\n\t ']) check(it.id, a, 'empty');
});

test('copying the incorrect sentence unchanged is incorrect', () => {
  for (const it of items) check(it.id, it.incorrect, 'incorrect');
});

test('fixing every mistake but one is incorrect (each mistake left in turn)', () => {
  for (const it of items) {
    if (it.errors.length < 2) continue;
    it.errors.forEach((_, i) => check(it.id, applyExcept(it, i), 'incorrect'));
  }
});

test('lowercase first letter of the key is incorrect', () => {
  for (const it of items) {
    const lower = it.correct[0].toLowerCase() + it.correct.slice(1);
    if (lower !== it.correct) check(it.id, lower, 'incorrect');
  }
});

// Leaving off the final end mark must be incorrect, also when the documented mistake was a WRONG
// end mark (e.g. "boots." → "boots?").
for (const it of items) {
  const noEnd = it.correct.replace(/[.?!]("?)$/, '$1');
  test(`missing final end mark is incorrect: ${it.id}`, () => check(it.id, noEnd, 'incorrect'));
}

// A question written with a period must be incorrect (also inside closing quotation marks).
for (const it of items.filter((i) => /\?"?$/.test(i.correct))) {
  const asPeriod = it.correct.replace(/\?("?)$/, '.$1');
  test(`period instead of question mark is incorrect: ${it.id}`, () => check(it.id, asPeriod, 'incorrect'));
}

// Leaving out an OPTIONAL comma after a short opening phrase (≤ 4 words) is still correct US English.
// The curriculum calls these commas optional; the engine treats a dropped opening-phrase comma as
// optional (review at worst), and the bank lists comma-less forms in `accepted`.
const OPTIONAL_INTRO = [
  'SF-CAP-009', 'SF-CAP-010', 'SF-CAP-011', 'SF-CAP-012', 'SF-END-011', 'SF-SPL-009', 'SF-SPL-014',
  'SF-SPL-021', 'SF-SPL-022', 'SF-SPL-024', 'SF-TEN-002', 'SF-TEN-003', 'SF-TEN-006', 'SF-TEN-007',
  'SF-TEN-008', 'SF-TEN-009', 'SF-TEN-010', 'SF-TEN-011', 'SF-TEN-012', 'SF-TEN-013', 'SF-TEN-014',
  'SF-TEN-016', 'SF-TEN-017', 'SF-TEN-019', 'SF-TEN-020', 'SF-SVA-012', 'SF-HOM-009', 'SF-COM-009',
  'SF-MIX-002', 'SF-MIX-005', 'SF-MIX-007', 'SF-MIX-009', 'SF-MIX-011', 'SF-MIX-014',
];
for (const id of OPTIONAL_INTRO) {
  test(`omitting the optional opening-phrase comma is not marked wrong: ${id}`, () => {
    const it = item(id);
    const m = it.correct.match(/^([^,"]+), /);
    assert.ok(m && m[1].split(' ').length <= 4, `${id} should start with a short opening phrase`);
    check(id, it.correct.replace(/^([^,"]+), /, '$1 '), 'ok');
  });
}
test('control: SF-CAP-006 accepts the opening comma both ways', () => {
  check('SF-CAP-006', 'On Saturday we helped clean up Maple Street Park.', 'correct');
  check('SF-CAP-006', 'On Saturday, we helped clean up Maple Street Park.', 'correct');
});

// ---------------------------------------------------------------- Hand-written realistic answers

const CASES = [
  // capitalization
  ['SF-CAP-001', 'Our class visited the library on monday.', 'incorrect'], // one mistake left
  ['SF-CAP-001', 'Our Class visited the library on Monday.', 'incorrect'], // over-capitalized common noun
  ['SF-CAP-001', 'Our class visted the library on Monday.', 'incorrect'], // new misspelling
  ['SF-CAP-001', 'Our class visited the library on Monday', 'incorrect'], // missing end mark
  ['SF-CAP-002', 'My Grandma and I baked bread for the neighbors.', 'incorrect'], // "my grandma" stays lowercase
  ['SF-CAP-002', 'My grandma and I baked bread for our neighbors.', 'ok'], // harmless word swap → review
  ['SF-CAP-003', 'We saw a moose near Lake superior last summer.', 'incorrect'], // half of a two-word name
  ['SF-CAP-004', 'Our soccer coach, Mr Patel, ran laps with us.', 'incorrect'], // US: Mr. needs its period
  ['SF-CAP-006', 'On Saturday we helped clean up Maple Street park.', 'incorrect'],
  ['SF-CAP-013', 'On the Fourth Of July, people in Boston watch fireworks over the Charles River.', 'incorrect'],
  ['SF-CAP-014', 'Mrs. Okafor said that I could read my report about Harriet Tubman on friday.', 'incorrect'],
  ['SF-CAP-015', 'My brother\'s team, The Hilltop Hawks, won the big game against the Lakeview Lions on Saturday.', 'incorrect'],
  // ending punctuation
  ['SF-END-001', 'Did you finish your spelling homework last night.', 'incorrect'], // "." on a question
  ['SF-END-003', 'Where did I leave my red rain boots', 'incorrect'],
  ['SF-END-005', 'Water turns into ice when it gets very cold', 'incorrect'],
  ['SF-END-007', 'The bus is late again. Do you think it will come soon.', 'incorrect'],
  ['SF-END-008', 'Ants can carry things much heavier than their bodies. Isn\'t that amazing!', 'correct'],
  ['SF-END-008', 'Ants can carry things much heavier than their bodies. Isn\'t that amazing.', 'incorrect'],
  ['SF-END-009', 'Our class pet is a turtle named Pickles, what should we feed him?', 'incorrect'], // comma splice
  ['SF-END-012', 'My puppy ran away this morning! Can you help me look for him?', 'ok'],
  ['SF-END-013', 'A storm is coming! Did you close the windows? We should bring the plants inside.', 'ok'],
  ['SF-END-014', 'Is the game at noon? I packed snacks and water. Should we bring chairs too.', 'incorrect'],
  // commas
  ['SF-COM-001', 'Yes,  we can borrow two books from the library today.', 'correct'], // double space after comma
  ['SF-COM-003', 'Our town was founded on March, 4 1852.', 'incorrect'], // comma in the wrong place
  ['SF-COM-005', 'We planted beans, peas, carrots, and lettuce in the school garden.', 'correct'], // Oxford comma accepted
  ['SF-COM-005', 'We planted beans, peas, carrots, and, lettuce in the school garden.', 'incorrect'],
  ['SF-COM-006', 'No, Diego I did not see who kicked the ball.', 'incorrect'],
  ['SF-COM-008', 'Well, I wanted to play outside but, it started to rain.', 'incorrect'],
  ['SF-COM-010', 'Sam, do you know what happened on December 17, 1903.', 'incorrect'],
  ['SF-COM-011', 'Lucia, you can paint the sign and Omar can hang it up.', 'incorrect'],
  ['SF-COM-013', 'As we hurried out the door, Dad called out, “Kenji, grab your jacket, shoes and backpack.”', 'correct'],
  ['SF-COM-014', 'Well, I packed, crayons, glue and paper, but I forgot the scissors.', 'incorrect'],
  // spelling
  ['SF-SPL-001', 'My frend Jamal sits next to me in class.', 'incorrect'],
  ['SF-SPL-005', 'We will test the magnets again tomorow.', 'incorrect'],
  ['SF-SPL-011', 'My neighbor finally helped us carry the heavy boxxes upstairs.', 'incorrect'],
  ['SF-SPL-016', 'The two birds carryed twigs and grass together to build a nest.', 'incorrect'],
  ['SF-SPL-016', 'The two birds carried twigs and grass togather to build a nest.', 'incorrect'],
  ['SF-SPL-020', 'Our class did an experiment to see which paper towel could hold the most water', 'incorrect'],
  ['SF-SPL-023', 'Aisha was hoping to win the race, but she stoped to help a friend who fell.', 'incorrect'],
  ['SF-SPL-024', 'Many years ago, childrens walked to a small school and wrote their lessons on little chalkboards every day.', 'incorrect'],
  // verb tense
  ['SF-TEN-001', 'We walks to the science museum last Friday.', 'incorrect'],
  ['SF-TEN-001', 'We went to the science museum last Friday.', 'ok'], // synonym → review
  ['SF-TEN-003', 'Last week, Mia catch the ball with one hand.', 'incorrect'],
  ['SF-TEN-005', 'I eat two pancakes for breakfast this morning.', 'incorrect'],
  ['SF-TEN-007', 'Yesterday, Ms. Chen readed us a story, and then we drew pictures about it.', 'incorrect'],
  ['SF-TEN-009', 'Long ago, people sewed their own clothes and growed their own food.', 'incorrect'],
  ['SF-TEN-011', 'Last summer, my sister and I swimed in the lake and found a smooth rock.', 'incorrect'],
  ['SF-TEN-012', 'Last Sunday morning, the sun rose, and the birds sang in the trees.', 'ok'],
  ['SF-TEN-016', 'Last Tuesday, our class goed outside at noon, and we traced our shadows with chalk while Mr. Ross took pictures.', 'incorrect'],
  ['SF-TEN-017', 'In 1620, the Pilgrims sailed to America on a ship called the Mayflower, and the trip took many weeks.', 'ok'],
  ['SF-TEN-019', 'Last weekend, Grandpa teach me to fish, and I caught a big trout that we cooked for dinner.', 'incorrect'],
  ['SF-TEN-020', 'Yesterday, the power went out, so we finded flashlights and told stories until the lights came back on.', 'incorrect'],
  // subject-verb agreement
  ['SF-SVA-001', 'Maya and Leo were in the same reading group.', 'ok'],
  ['SF-SVA-001', 'Maya and Leo am in the same reading group.', 'incorrect'],
  ['SF-SVA-003', 'My little sister does not like spicy food at all.', 'correct'],
  ['SF-SVA-003', 'My little sister doesnt like spicy food at all.', 'incorrect'],
  ['SF-SVA-006', 'A spider has eight legs, but an insect has only six.', 'ok'], // word order → review
  ['SF-SVA-011', 'There\'s three apples in the bowl, and Omar wants one.', 'incorrect'],
  ['SF-SVA-012', 'Every Friday, Mr. Park\'s students take a spelling test, and Ravi always gets every word right because he studys hard.', 'incorrect'],
  ['SF-SVA-014', 'Owls hunt at night, but a hawk hunt during the day, and both birds have sharp claws.', 'incorrect'],
  ['SF-SVA-015', 'My brothers are cleaning the garage, and Dad says we can go swimming when the job is finished.', 'ok'],
  // homophones
  ['SF-HOM-001', 'We walked over they\'re to see the new puppy.', 'incorrect'],
  ['SF-HOM-002', 'I have too pencils and an eraser in my desk.', 'incorrect'],
  ['SF-HOM-004', 'My brother no the answer to the riddle.', 'incorrect'],
  ['SF-HOM-008', 'Please write your name at the top of the paper and hand it in bye noon.', 'incorrect'],
  ['SF-HOM-010', 'Our family ate a whole pizza in less than a hour.', 'incorrect'],
  ['SF-HOM-012', 'There are too many leaves in the yard, so we will rake them in a big pile over there.', 'incorrect'],
  ['SF-HOM-013', 'Jamal knowed he could win the race, so he trained hard for two weeks and won the gold medal.', 'incorrect'],
  ['SF-HOM-014', 'When we went to the market, we saw a sign for a sale on fresh pairs and peaches.', 'incorrect'],
  // possessives and contractions
  ['SF-POS-001', 'I can not find my other sock anywhere.', 'ok'],
  ['SF-POS-001', 'I cannot find my other sock anywhere.', 'ok'],
  ['SF-POS-001', 'I ca\'nt find my other sock anywhere.', 'incorrect'],
  ['SF-POS-002', 'Mias\' backpack is hanging on the hook by the door.', 'incorrect'],
  ['SF-POS-006', 'We\'re going to visit the zoo, and I am so excited.', 'ok'],
  ['SF-POS-007', 'The bird flapped it\'s wings, but it didn\'t fly very far.', 'incorrect'],
  ['SF-POS-008', 'My two brother\'s bikes are in the garage, but Dad\'s car isn\'t.', 'incorrect'],
  ['SF-POS-013', 'Let\'s go watch Kofi\'s game, but we shouldn\'t sit in the coaches\' chairs.', 'ok', 'bank: "coachs chairs" is ambiguous (one coach or several); change to "the coach\'s chair" or accept "coaches\'"'],
  ['SF-POS-014', 'I’m sure Grandpa’s old photos are in the attic, but it’s too dark to look today.', 'correct'],
  ['SF-POS-015', 'The foxes\' den is under a log, and we can\'t see it, but we know its there.', 'incorrect'],
  // mixed
  ['SF-MIX-001', 'My friend Ava sits next to me in art class', 'incorrect'],
  ['SF-MIX-002', 'Last Sunday, we went to the Zoo with our cousins.', 'incorrect'],
  ['SF-MIX-005', 'On Friday, Tariq and his friends practiced their soccer moves at the park until dark?', 'incorrect'],
  ['SF-MIX-007', 'In 1776 American leaders met in Philadelphia and signed the Declaration of Independence to start a new country.', 'ok'],
  ['SF-MIX-008', 'Mrs. Jones asked, “Who wants to help plant flowers at the park?”', 'correct'],
  ['SF-MIX-008', 'Mrs. Jones asked, "Who wants to help plant flowers at the park."', 'incorrect'],
  ['SF-MIX-010', 'Yes, we finished our projects, but Leah and Nora are still painting they\'re poster.', 'incorrect'],
  ['SF-MIX-012', 'Isaac asked his dad, "can we go to the library after lunch?"', 'incorrect'],
  ['SF-MIX-013', 'Kai and Noah play basketball every Saturday at the gym on Elm street after school.', 'incorrect'],
  ['SF-MIX-015', 'It\'s time for recess, but Hugo wants to finish his drawing of a dinosaur first', 'incorrect'],
];

for (const [id, answer, expect, todo] of CASES) {
  test(`${id}: ${JSON.stringify(answer)} → ${expect}`, todo ? { todo } : {}, () => check(id, answer, expect));
}

test('hand-written sample covers every skill and difficulty with 40+ responses and 60+ items overall', () => {
  assert.ok(CASES.length >= 40);
  const ids = new Set(CASES.map((c) => c[0]));
  const skills = new Set([...ids].map((id) => item(id).skill));
  const levels = new Set([...ids].map((id) => item(id).difficulty));
  assert.equal(skills.size, 9);
  assert.equal(levels.size, 3);
  assert.ok(ids.size >= 60, `hand-written items: ${ids.size}`);
});
