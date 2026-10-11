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
import { grade, labAccepts, labCategory } from '../../js/sentencefix/engine.js';

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
  ['SF-POS-013', 'Let\'s go watch Kofi\'s game, but we shouldn\'t sit in the coaches\' chairs.', 'incorrect'], // re-audit decision: the key is now "the coach's chair" (one chair, one coach), so "coaches'" is the wrong possessive for this sentence (like "fox's" in POS-015) and "chairs" changes an untouched word
  ['SF-POS-014', 'I’m sure Grandpa’s old photos are in the attic, but it’s too dark to look today.', 'correct'],
  ['SF-POS-015', 'The foxes\' den is under a log, and we can\'t see it, but we know its there.', 'incorrect'],
  // mixed
  ['SF-MIX-001', 'My sister Ava used bright colors in art class', 'incorrect'], // revised item: missing end mark
  ['SF-MIX-002', 'Last Sunday, we went to the Zoo with our cousins.', 'incorrect'],
  ['SF-MIX-005', 'On Friday, Tariq and his friends practiced their soccer moves at the park until dark?', 'incorrect'],
  ['SF-MIX-007', 'In 1776 American leaders met in Philadelphia and signed the Declaration of Independence to start a new country.', 'ok'],
  ['SF-MIX-008', 'Mrs. Jones asked, “Who wants to help plant flowers at the park?”', 'correct'],
  ['SF-MIX-008', 'Mrs. Jones asked, "Who wants to help plant flowers at the park."', 'incorrect'],
  ['SF-MIX-010', 'Yes, we finished our projects, but Leah and Nora are still painting they\'re poster.', 'incorrect'],
  ['SF-MIX-012', 'Isaac asked his dad, "can we go to the library after lunch?"', 'incorrect'],
  ['SF-MIX-013', 'Kai and Noah play basketball every Saturday at the gym on Elm street after lunch.', 'incorrect'], // revised item: half of the street name
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

// ================================================================ RE-AUDIT (after the curriculum revision
// and the engine fixes for E1–E9). Fresh realistic answers, not used in the first audit. The revised
// items (MIX-001, COM-014, HOM-015, COM-015, MIX-013, POS-013, TEN-015, SVA-009 …) are included.
// The minor engine leftovers found there (misspelled target, dropped appositive/tag comma, confusable real word,
// stacked end marks, comma joining only two items) are fixed and now run as normal assertions.

const RE_CASES = [
  // revised items
  ['SF-MIX-001', 'My sister Ava used bright colors in art class.', 'correct'],
  ['SF-MIX-001', 'My sister Ava used bright collers in art class.', 'incorrect'], // new misspelling of the target
  ['SF-MIX-001', 'My Sister Ava used bright colors in art class.', 'incorrect'], // over-capitalized
  ['SF-MIX-001', 'My sister Ava used bright colours in art class.', 'incorrect'], // British spelling in a US bank
  ['SF-COM-014', 'Mom, I packed crayons, glue and paper but I forgot the scissors.', 'incorrect'], // one comma left out
  ['SF-COM-014', 'Mom I packed crayons, glue and paper, but I forgot the scissors.', 'incorrect'],
  ['SF-COM-014', 'Mom, I packed crayons, glue, and paper, but, I forgot the scissors.', 'incorrect'], // added comma
  ['SF-COM-014', 'Mom, I packed crayons, glue, and paper, but I forgot the scissors.', 'correct'], // Oxford comma
  ['SF-COM-014', 'Mom, I packed crayons, glue and paper, but I forgot my scissors.', 'ok'], // harmless word swap
  ['SF-HOM-015', 'Do you know where the moon is during the day? Sometimes it is still up there in the sky.', 'correct'],
  ['SF-HOM-015', 'Do you know where the moon is during the day? Sometimes it\'s still up there in the sky.', 'ok'], // contraction
  ['SF-HOM-015', 'Do you now where the moon is during the day? Sometimes it is still up there in the sky.', 'incorrect'],
  ['SF-HOM-015', 'Do you know where the moon is during the day? Sometimes it is still up they\'re in the sky.', 'incorrect'],
  ['SF-HOM-015', 'Do you know where the moon is during the day. Sometimes it is still up there in the sky.', 'incorrect'],
  ['SF-COM-015', 'No, Theo, the Golden Gate Bridge in San Francisco opened on May 27, 1937.', 'correct'],
  ['SF-COM-015', 'No, Theo the Golden Gate Bridge in San Francisco opened on May 27, 1937.', 'incorrect'],
  ['SF-COM-015', 'No, Theo, the Golden Gate Bridge in San Francisco, opened on May 27, 1937.', 'incorrect'], // added comma
  ['SF-COM-015', 'No, Theo, the Golden Gate Bridge in San Francisco opened on May, 27 1937.', 'incorrect'], // misplaced comma
  ['SF-COM-015', 'No, Theo, the golden gate bridge in San Francisco opened on May 27, 1937.', 'incorrect'],
  ['SF-MIX-013', 'Kai and Noah play basketball every Saturday at the gym on Elm Street after lunch', 'incorrect'],
  ['SF-MIX-013', 'Kai and Noah play basket ball every Saturday at the gym on Elm Street after lunch.', 'incorrect'],
  ['SF-POS-013', 'Let\'s go watch Kofi\'s game, but we shouldn\'t sit in the coaches\' chair.', 'incorrect'],
  ['SF-POS-013', 'Let\'s go watch Kofi\'s game, but we should not sit in the coach\'s chair.', 'ok'], // full form
  ['SF-TEN-015', 'When the bell rang Sofia grabbed her lunch and sat with her friends.', 'correct'], // optional clause comma
  ['SF-TEN-015', 'When the bell rang, Sofia grabbed her lunch and sits with her friends.', 'incorrect'],
  ['SF-TEN-015', 'When the bell rang, Sofia grabbed her lunch and sitted with her friends.', 'incorrect'],
  ['SF-SVA-009', 'Honeybees make honey, and each bee have a special job in the hive.', 'incorrect'],
  ['SF-SVA-009', 'Bees make honey, and each bee has a special job in the hive.', 'ok'],
  ['SF-SVA-004', 'Our players had new jerseys this year.', 'correct'],
  ['SF-SVA-004', 'Our players haves new jerseys this year.', 'incorrect'],
  // optional comma omitted (+ another mistake must still be caught)
  ['SF-TEN-006', 'Last spring our town builded a new playground.', 'incorrect'],
  ['SF-TEN-002', 'Yesterday my dad cooked spagetti for dinner.', 'incorrect'],
  ['SF-CAP-011', 'For Thanksgiving we drove to my aunts house in Ohio.', 'incorrect'],
  ['SF-TEN-017', 'In 1620 the Pilgrims sailed on a ship that was called the Mayflower and the trip took many weeks.', 'ok'],
  // "!" for "."
  ['SF-END-002', 'The leaves on the maple tree turn red in the fall!', 'ok'],
  ['SF-END-007', 'The bus is late again! Do you think it will come soon?', 'ok'],
  ['SF-MIX-001', 'My sister Ava used bright colors in art class!', 'ok'],
  ['SF-END-004', 'How many laps can you swim without stopping.', 'incorrect'], // questions still need "?"
  // cannot / full forms
  ['SF-POS-001', 'I cannot find my other sock anywhere.', 'ok'],
  ['SF-POS-015', 'The foxes\' den is under a log, and we cannot see it, but we know it\'s there.', 'ok'],
  ['SF-MIX-009', 'On Tuesday, our puppy turns two, and my brother cannot believe how big he is.', 'ok'],
  ['SF-POS-003', 'It is going to snow tonight, so wear your hat.', 'ok'],
  ['SF-POS-009', 'The city\'s new library will not open until next month.', 'ok'],
  // over-regularized and wrong verb forms
  ['SF-TEN-004', 'The wind blewed the leaves across the yard last night.', 'incorrect'],
  ['SF-TEN-005', 'I ated two pancakes for breakfast this morning.', 'incorrect'],
  ['SF-TEN-003', 'Last week, Mia caughted the ball with one hand.', 'incorrect'],
  ['SF-TEN-011', 'Last summer, my sister and I swum in the lake and found a smooth rock.', 'incorrect'],
  ['SF-TEN-013', 'Last Saturday, my aunt made bread, and we eated it while it was still warm.', 'incorrect'],
  ['SF-TEN-014', 'Last month, our class wrote letters to the mayor, and she sended us a reply.', 'incorrect'],
  ['SF-TEN-018', 'At the swim meet yesterday, Hana jumped into the pool and swum so fast that she won a blue ribbon.', 'incorrect'],
  // wrong homophone
  ['SF-HOM-008', 'Please rite your name at the top of the paper and hand it in by noon.', 'incorrect'],
  ['SF-HOM-005', 'Our team won the game, and the players threw they\'re caps in the air.', 'incorrect'],
  ['SF-HOM-012', 'They\'re are too many leaves in the yard, so we will rake them in a big pile over here.', 'incorrect'],
  ['SF-HOM-011', 'A dear ran across the road in front of our car.', 'incorrect'],
  ['SF-MIX-003', 'Please don\'t forget to bring you\'re lunch to school tomorrow.', 'incorrect'],
  // added comma
  ['SF-COM-005', 'We planted, beans, peas, carrots and lettuce in the school garden.', 'incorrect'],
  ['SF-COM-011', 'Lucia, you can paint the sign, and, Omar can hang it up.', 'incorrect'],
  ['SF-COM-012', 'Yes, Mrs. Gomez, our class collected cans, bottles, and, boxes for the recycling drive.', 'incorrect'],
  ['SF-COM-004', 'My grandparents moved to a small house, in Tucson, Arizona.', 'incorrect'],
  // a/an
  ['SF-HOM-010', 'Our family ate an whole pizza in less than an hour.', 'incorrect'],
  ['SF-HOM-010', 'Our family ate a whole pizza in less than a hour.', 'incorrect'],
  // fully correct alternatives that are not listed → never incorrect
  ['SF-HOM-009', 'Long ago, sailors used the stars to find their way across the ocean.', 'ok'],
  ['SF-TEN-020', 'Yesterday, the power went out, so we got flashlights and told stories until the lights came back on.', 'ok'],
  ['SF-END-009', 'Our class pet is a turtle named Pickles. What should we feed it?', 'ok'],
  ['SF-POS-008', 'My two brothers\' bikes are in the garage, but Dad\'s car is not.', 'ok'],
  ['SF-SVA-015', 'My brothers were cleaning the garage, and Dad said we could go swimming when the job was done.', 'ok'],
  ['SF-SVA-002', 'Look! The robins were building a nest in our tree.', 'ok'],
  ['SF-COM-006', 'No, Diego, I didn\'t see who kicked the ball.', 'ok'],
  ['SF-COM-004', 'My grandparents moved to a small house in Tucson, AZ.', 'ok'],
  // other typical slips
  ['SF-MIX-012', 'Isaac asked his dad, "Can we go to the library after lunch"?', 'incorrect'], // ? outside quotes (US)
  ['SF-MIX-012', 'Isaac asked his Dad, "Can we go to the library after lunch?"', 'incorrect'],
  ['SF-MIX-008', 'Mrs. Jones asked "Who wants to help plant flowers at the park?"', 'incorrect'],
  ['SF-MIX-007', 'In 1776, American leaders met in Philadelphia and signed the Declaration of Independance to start a new country.', 'incorrect'],
  ['SF-MIX-014', 'On April 22, our class celebrated Earth day by picking up trash in the park.', 'incorrect'],
  ['SF-MIX-015', 'Its time for recess, but Hugo wants to finish his drawing of a dinosaur first.', 'incorrect'],
  ['SF-MIX-004', 'Squirrels hide acorns in the ground before Winter comes.', 'incorrect'],
  ['SF-SPL-019', 'Two baby fox\'s were hiding under the bushes near our tent.', 'incorrect'],
  ['SF-SPL-013', 'Diego was running so fast that he almost trippped on the grass.', 'incorrect'],
  ['SF-POS-012', 'They\'re hanging all the student\'s drawings in the hallway, and Ms. Lee\'s class can\'t wait to see them.', 'incorrect'],
  ['SF-CAP-014', 'Mrs. Okafor said that I could read my Report about Harriet Tubman on Friday.', 'incorrect'],
  ['SF-CAP-004', 'Our soccer coach Mr. Patel ran laps with us.', 'incorrect'],
  // former minor engine leftovers (clearly wrong; used to be sent to review)
  ['SF-SVA-003', 'My little sister dosent like spicy food at all.', 'incorrect'],
  ['SF-CAP-015', 'My brother\'s team the Hilltop Hawks won the big game against the Lakeview Lions on Saturday.', 'incorrect'],
  ['SF-POS-011', 'Abraham Lincoln\'s face is on the penny isn\'t it?', 'incorrect'],
  ['SF-HOM-006', 'We mixed flour and water to make clay for are science project.', 'incorrect'],
  ['SF-END-010', 'The library has a new reading room. When does it open?.', 'incorrect'],
  ['SF-POS-011', 'Abraham Lincoln\'s face is on the penny, is not it?', 'incorrect'],
  ['SF-HOM-014', 'When we went to the market, we saw a sign for a sale on fresh pears, and peaches.', 'incorrect'],
];

for (const [id, answer, expect, todo] of RE_CASES) {
  test(`re-audit ${id}: ${JSON.stringify(answer)} → ${expect}`, todo ? { todo } : {}, () => check(id, answer, expect));
}

test('re-audit: at least 30 new hand-written answers', () => assert.ok(RE_CASES.length >= 30));

// Rules added for the minor leftovers: more clearly wrong answers, and valid answers that must stay correct/ok.
const RULE_CASES = [
  // misspelled try at the fix (up to 3 letters off, 6+ letters, same first letter)
  ['SF-SVA-003', 'My little sister dosnt like spicy food at all.', 'incorrect'],
  ['SF-SVA-003', 'My little sister does not like spicy food at all.', 'correct'],
  ['SF-SVA-003', 'My little sister doesn\'t like spicy food at all!', 'ok'],
  // required appositive / tag-question commas; optional commas stay optional
  ['SF-CAP-015', 'My brother\'s team, the Hilltop Hawks won the big game against the Lakeview Lions on Saturday.', 'incorrect'],
  ['SF-CAP-004', 'Our soccer coach, Mr. Patel ran laps with us.', 'incorrect'],
  ['SF-CAP-004', 'Our soccer coach, Mr. Patel, ran laps with us.', 'correct'],
  ['SF-POS-011', 'Abraham Lincoln\'s face is on the penny, is it not?', 'ok'],
  ['SF-COM-005', 'We planted beans, peas, carrots and lettuce in the school garden.', 'correct'],
  ['SF-CAP-012', 'Last June my family camped at Yellowstone National Park with Uncle Ray and Aunt Bea.', 'ok'],
  // commonly confused real words
  ['SF-CAP-005', 'George Washington was the first president off the United States.', 'incorrect'],
  ['SF-HOM-006', 'We mixed flour and water to make clay for our art project.', 'ok'], // real synonym swap
  // stacked end marks
  ['SF-END-010', 'The library has a new reading room. When does it open?!', 'incorrect'],
  ['SF-CAP-001', 'Our class visited the library on Monday.!', 'incorrect'],
  ['SF-COM-001', 'Yes, we can borrow two books from the library today!', 'ok'], // "Yes, that's it!" style
  ['SF-END-012', 'My puppy ran away this morning! Can you help me look for him?', 'ok'],
  // comma before "and": fine in a series of 3+ or before a clause, wrong between two items
  ['SF-SPL-003', 'The butterfly had beautiful orange, and black wings.', 'incorrect'],
  ['SF-HOM-014', 'When we went to the market, we saw a sign for a sale on fresh pears and peaches.', 'correct'],
  ['SF-COM-011', 'Lucia, you can paint the sign, and Omar can hang it up.', 'correct'],
  ['SF-COM-014', 'Mom, I packed crayons, glue, and paper, but I forgot the scissors.', 'correct'],
  ['SF-SPL-022', 'Every morning, our teacher writes a question on the board, and we write our answers in our journals.', 'correct'],
  ['SF-TEN-008', 'Last week, we planted seeds in cups, and we watched them sprout.', 'ok'], // ", and" + new subject
  ['SF-HOM-007', 'Dad and I rode to the store to buy milk, and eggs.', 'incorrect'], // two items, no clause
  // ", and" + a second verb for the same subject: some teachers accept the comma → a grown-up checks it
  ['SF-TEN-008', 'Last week, we planted seeds in cups, and watched them sprout.', 'review'],
  ['SF-TEN-011', 'Last summer, my sister and I swam in the lake, and found a smooth rock.', 'review'],
  ['SF-TEN-015', 'When the bell rang, Sofia grabbed her lunch, and sat with her friends.', 'review'],
  ['SF-TEN-018', 'At the swim meet yesterday, Hana jumped into the pool, and swam so fast that she won a blue ribbon.', 'review'],
  ['SF-TEN-020', 'Yesterday, the power went out, so we found flashlights, and told stories until the lights came back on.', 'review'],
  ['SF-COM-007', 'Ms. Lee smiled, and said, "Yes, we can have extra recess today."', 'review'],
  // ", and" joining just two things stays wrong
  ['SF-HOM-006', 'We mixed flour, and water to make clay for our science project.', 'incorrect'],
  ['SF-SPL-003', 'The butterfly had beautiful orange, and black wings.', 'incorrect'],
  // real words are never misspellings (F-1/F-2); small words may be left out in a rewrite (F-3)
  ['SF-SPL-013', 'Diego was sprinting so fast that he almost tripped on the grass.', 'ok'],
  ['SF-CAP-001', 'Our class visited the libary on Monday.', 'incorrect'], // non-word stays a misspelling
  ['SF-SVA-010', 'Jin and his brother play tennis, and Jin wins most of games.', 'ok'],
  ['SF-HOM-015', 'Do you know where the moon is during the day? Sometimes it is still up there in sky.', 'ok'],
];

for (const [id, answer, expect] of RULE_CASES) {
  test(`new rule ${id}: ${JSON.stringify(answer)} → ${expect}`, () => check(id, answer, expect));
}

// ---------------------------------------------------------------- Thinking Lab (altCategory / labAccepts)

const CATS = ['spelling', 'capitalization', 'punctuation', 'grammar'];

test('Lab: the main category of every item is always accepted', () => {
  for (const it of items) assert.ok(labAccepts(it, labCategory(it)), it.id);
});

test('Lab: every altCategory is a real category and differs from category', () => {
  for (const it of items) {
    for (const e of it.errors) {
      if (!e.altCategory) continue;
      assert.ok(CATS.includes(e.altCategory), `${it.id} ${e.wrong}`);
      assert.notEqual(e.altCategory, e.category, `${it.id} ${e.wrong}`);
    }
  }
});

test('Lab: a category that no error can have is never accepted', () => {
  for (const it of items) {
    const possible = new Set(it.errors.flatMap((e) => [e.category, e.altCategory].filter(Boolean)));
    for (const c of CATS) if (!possible.has(c)) assert.equal(labAccepts(it, c), false, `${it.id} ${c}`);
  }
});

test('Lab: genuinely disputable boundary cases accept both answers', () => {
  assert.ok(labAccepts(item('SF-HOM-004'), 'spelling') && labAccepts(item('SF-HOM-004'), 'grammar')); // new → knew
  assert.ok(labAccepts(item('SF-POS-003'), 'punctuation') && labAccepts(item('SF-POS-003'), 'spelling')); // Its → It's
  assert.ok(labAccepts(item('SF-SPL-016'), 'spelling')); // carryed → carried
  assert.equal(labAccepts(item('SF-TEN-003'), 'spelling'), false); // catched is always grammar
});

test('Lab: SF-SVA-003 don\'t → doesn\'t must not accept "punctuation" (curriculum rule 3: the apostrophe is already right)', () => {
  assert.equal(labAccepts(item('SF-SVA-003'), 'punctuation'), false);
});

// ================================================================ ENGINE FOLLOW-UP (commit 0913ea4)
// Independent spot-check of the rules added for e-R1..e-R5. These are fresh answers, not taken from the
// engine agent's tests. VALID answers stress each new rule: real words a few letters from the key in a
// mistake's spot, tag questions written another way, appositives kept, confusable words used correctly
// elsewhere, "!"/"?" endings, ", and" + a short clause, and Oxford commas. They must never be 'incorrect'.
// WRONG answers must be 'incorrect'.

const F = {
  realWordSlot: 'engine defect (Critical, introduced by 0913ea4): e-R1 rule treats a REAL word in the mistake\'s spot (6+ letters, same first letter, ≤3 edits) as a misspelling; REAL_WORDS is too small to tell. Before 0913ea4 this was review.',
  realWordNear: 'engine defect (Critical, pre-existing): a real word 1–2 letters from the key or a model word (placed/planted, hats/caps) is graded as a misspelling',
  droppedWords: 'engine defect (Critical, pre-existing): dropping words in a valid rewrite ("most games" for "most of the games") is a clear "dropped" → incorrect',
  twoItemLongTail: 'engine (minor): a comma before "and" that joins only two nouns is still allowed when 3+ words follow ("flour, and water to make clay")',
};

const FOLLOWUP = [
  // VALID: a real word near the key in the mistake's spot (the e-R1 rule)
  ['SF-SPL-013', 'Diego was racing so fast that he almost tripped on the grass.', 'ok'],
  ['SF-SPL-019', 'Two baby foxes were hiding under the benches near our tent.', 'ok'],
  ['SF-SPL-010', 'We found a piece of shell and a lively crab in the sand.', 'ok'],
  ['SF-SPL-025', 'Our neighborhood is planting trees in the park, so we need people who are wanting to help on Saturday.', 'ok'],
  ['SF-SPL-022', 'Every Monday, our teacher writes a question on the board, and we write our answers in our journals.', 'ok'],
  ['SF-SPL-008', 'Ms. Diaz said we could choose a difficult book to read.', 'ok'],
  // VALID: real words 1–2 letters away (older rule)
  ['SF-TEN-008', 'Last week, we placed seeds in cups and watched them sprout.', 'ok'],
  ['SF-HOM-005', 'Our team won the game, and the players threw their hats in the air.', 'ok'],
  // VALID: tag questions and questions written another way
  ['SF-POS-011', 'Abraham Lincoln\'s face is on the penny, is it not?', 'ok'],
  ['SF-POS-011', 'Abraham Lincoln\'s face is on the penny, right?', 'ok'],
  ['SF-END-008', 'Ants can carry things much heavier than their bodies. Is that not amazing?', 'ok'],
  // VALID: appositive kept, other words changed
  ['SF-CAP-004', 'Our soccer coach, Mr. Patel, jogged laps with us.', 'ok'],
  ['SF-CAP-015', 'My brother\'s team, the Hilltop Hawks, beat the Lakeview Lions on Saturday.', 'ok'],
  ['SF-CAP-015', 'My brother\'s team, the Hilltop Hawks, won the big game against the Lakeview Lions last Saturday.', 'ok'],
  // VALID: Oxford commas and ", and" + short clause
  ['SF-COM-012', 'Yes, Mrs. Gomez, our class collected cans, bottles, and boxes for the recycling drive.', 'correct'],
  ['SF-HOM-014', 'When we went to the market, we saw a sign for a sale on fresh pears, apples, and peaches.', 'ok'],
  ['SF-HOM-007', 'Dad and I rode to the store to buy milk, eggs, and two loaves of bread.', 'ok'],
  ['SF-TEN-011', 'Last summer, my sister and I swam in the lake, and we found a smooth rock.', 'ok'],
  ['SF-COM-011', 'Lucia, you can paint the sign, and I can hang it up.', 'ok'],
  ['SF-SVA-008', 'The mail carrier comes to our street every day and the dogs bark at her.', 'ok'], // optional compound comma
  ['SF-COM-008', 'Well, I wanted to play outside, but then it started to rain.', 'ok'],
  // VALID: confusable words (to/too/two, of, their, then) used correctly elsewhere
  ['SF-MIX-003', 'Please don\'t forget to bring your lunch to school tomorrow too.', 'ok'],
  ['SF-HOM-002', 'I have two pencils and an eraser in my desk too.', 'ok'],
  ['SF-SVA-011', 'There are three apples in the bowl, and Omar wants one of them.', 'ok'],
  ['SF-POS-014', 'I\'m sure Grandpa\'s old photos are in the attic, but it\'s too dark to look there today.', 'ok'],
  ['SF-HOM-010', 'Our family ate a whole pizza in less than one hour.', 'ok'],
  // VALID: "!" endings and other rewrites
  ['SF-SVA-002', 'Look! The robins are building a nest in our tree!', 'ok'],
  ['SF-HOM-012', 'There are too many leaves in the yard, so we will rake them in a big pile over here!', 'ok'],
  ['SF-TEN-020', 'Yesterday, the power went out, so we found candles and told stories until the lights came back on.', 'ok'],
  ['SF-TEN-015', 'When the bell rang, Sofia grabbed her lunchbox and sat with her friends.', 'ok'],
  ['SF-SVA-015', 'My brothers were cleaning the garage, and Dad said we could go swimming when the job was done.', 'ok'],
  ['SF-SVA-010', 'Jin and his brother play tennis, and Jin wins most games.', 'ok'],
  // WRONG: must be incorrect
  ['SF-SPL-013', 'Diego was runnig so fast that he almost tripped on the grass.', 'incorrect'],
  ['SF-SPL-018', 'I was so exsighted to open my birthday presents.', 'incorrect'], // misspelling 3 letters off
  ['SF-POS-011', 'Abraham Lincoln\'s face is on the penny, isnt it?', 'incorrect'],
  ['SF-POS-011', 'Abraham Lincoln\'s face is on the penny isn\'t it.', 'incorrect'],
  ['SF-CAP-015', 'My brother\'s team, the Hilltop Hawks won the big game against the Lakeview Lions on Saturday.', 'incorrect'],
  ['SF-END-001', 'Did you finish your spelling homework last night??', 'incorrect'],
  ['SF-END-010', 'The library has a new reading room. When does it open?!', 'incorrect'],
  ['SF-SVA-001', 'Maya and Leo our in the same reading group.', 'incorrect'],
  ['SF-TEN-007', 'Yesterday, Ms. Chen read us a story, and than we drew pictures about it.', 'incorrect'],
  ['SF-SPL-010', 'We found a piece off shell and a little crab in the sand.', 'incorrect'],
  ['SF-HOM-006', 'We mixed flour, and water to make clay for our science project.', 'incorrect'],
];

for (const [id, answer, expect, todo] of FOLLOWUP) {
  test(`follow-up ${id}: ${JSON.stringify(answer)} → ${expect}`, todo ? { todo } : {}, () => check(id, answer, expect));
}

test('follow-up: 25+ valid and 10+ wrong fresh answers', () => {
  assert.ok(FOLLOWUP.filter((c) => c[2] !== 'incorrect').length >= 25);
  assert.ok(FOLLOWUP.filter((c) => c[2] === 'incorrect').length >= 10);
});

// ================================================================ FINAL ENGINE RE-CHECK (commit 82020b0)
// Fresh answers (not the engine agent's) that stress the new rules: word list (real words never count as
// misspellings), KNOWN_MISSPELLINGS, "number" (one/more than one), plural/possessive, apostrophe, British
// spelling, dropped small words and the ", and" rule. VALID answers must never be 'incorrect'.

const G = {
  numberCoordinated: 'engine defect (Critical, kept by design in 82020b0): a deliberate number change WITH a matching verb ("the dog barks", "their cows give", "the stores close") is a valid rewrite, but the "number" rule marks it incorrect',
  numberIsolated: 'engine defect (Critical unless the owner rules otherwise): changing an untouched noun\'s number ("the neighbor", "the tree", "maple trees", "doors") still gives a valid sentence, and other real-word swaps go to review, but "number" marks it incorrect',
  numberSlot: 'engine defect (Critical): "bush" in the plural mistake\'s spot makes a valid sentence ("hiding under the bush"), but it is marked incorrect',
  pluralPossessive: 'engine defect (Critical): a valid plural possessive of an untouched word ("My brothers\' team") is marked incorrect by the plural/possessive rule',
  swapWords: 'engine defect (Critical, pre-existing): a synonym swap that moves a word ("has just six" for "only has six") counts as a clear "dropped" word ("only" is not a small word)',
  realWordTypo: 'engine (Major, trade-off of the word-list rule): a clear real-word misspelling of an untouched or fixed word ("diner", "fiend", "tied", "presence", "waked", "bored") now goes to review; before 82020b0 it was incorrect',
  twoItemComma: 'engine (Major): a comma joining just two noun phrases before "and" + "a/the/two" ("tape, and the scissors", "milk, and two loaves") is read as a compound sentence → review',
  droppedThe: 'engine (minor, by design): dropping "the" ungrammatically ("to science museum") goes to review',
};

const FINAL = [
  // VALID: real-word synonyms in a mistake's spot or elsewhere → review
  ['SF-TEN-001', 'We hiked to the science museum last Friday.', 'ok'],
  ['SF-TEN-016', 'Last Tuesday, our class headed outside at noon, and we traced our shadows with chalk while Mr. Ross took pictures.', 'ok'],
  ['SF-MIX-001', 'My sister Ava used bright crayons in art class.', 'ok'],
  ['SF-SPL-018', 'I was so eager to open my birthday gifts.', 'ok'],
  ['SF-SPL-003', 'The butterfly had lovely orange and black wings.', 'ok'],
  ['SF-SPL-020', 'Our class did an experiment to see which paper towel could hold the most liquid.', 'ok'],
  ['SF-SPL-008', 'Ms. Diaz said we could choose a new book to read.', 'ok'],
  ['SF-SPL-016', 'The two birds carried sticks and grass together to build a nest.', 'ok'],
  ['SF-TEN-019', 'Last weekend, Grandpa taught me to fish, and I caught a big fish that we cooked for dinner.', 'ok'],
  ['SF-HOM-013', 'Jamal knew he could win the race, so he trained hard for two weeks and won the gold trophy.', 'ok'],
  ['SF-SVA-012', 'Every Friday, Mr. Park\'s students take a spelling quiz, and Ravi always gets every word right because he studies hard.', 'ok'],
  // VALID: possessives and contractions kept, other words changed
  ['SF-POS-005', 'Owen\'s new soccer ball rolled under Aunt Rosa\'s red truck.', 'ok'],
  ['SF-POS-014', 'I\'m sure Grandpa\'s old pictures are in the attic, but it\'s too dark to look today.', 'ok'],
  ['SF-POS-010', 'You\'re welcome to use Grace\'s umbrella if it starts to rain.', 'ok'],
  ['SF-SVA-010', 'Jin and his brother play tennis, and Jin wins most of their games.', 'ok'],
  // VALID: ", and" + a second verb or a clause; small words added
  ['SF-TEN-015', 'When the bell rang, Sofia grabbed her lunch, and sat with her friends.', 'ok'],
  ['SF-TEN-010', 'In the last game, Carlos ran fast, and he threw the ball to first base.', 'ok'],
  ['SF-HOM-008', 'Please write your full name at the top of the paper and hand it in by noon.', 'ok'],
  ['SF-COM-007', 'Ms. Lee smiled and said, "Yes, we can have extra recess today."', 'correct'],
  // VALID: one / more than one changed on purpose
  ['SF-HOM-001', 'We walked over there to see the new puppies.', 'ok'],
  ['SF-TEN-008', 'Last week, we planted seeds in a cup and watched them sprout.', 'ok'],
  ['SF-MIX-011', 'At the beach, Elena found a starfish and two tiny crabs under the rocks.', 'ok'],
  ['SF-SVA-008', 'The mail carrier comes to our street every day, and the dog barks at her.', 'ok', G.numberCoordinated],
  ['SF-SVA-007', 'My grandparents live on a farm, and their cows give lots of milk.', 'ok', G.numberCoordinated],
  ['SF-SPL-012', 'Dad and I believe the stores close in ten minutes.', 'ok', G.numberCoordinated],
  ['SF-CAP-002', 'My grandma and I baked bread for the neighbor.', 'ok', G.numberIsolated],
  ['SF-TEN-012', 'Last Sunday morning, the sun came up, and the birds sang in the tree.', 'ok', G.numberIsolated],
  ['SF-END-002', 'The leaves on the maple trees turn red in the fall.', 'ok', G.numberIsolated],
  ['SF-POS-002', 'Mia\'s backpack is hanging on the hook by the doors.', 'ok', G.numberIsolated],
  ['SF-SPL-019', 'Two baby foxes were hiding under the bush near our tent.', 'ok', G.numberSlot],
  ['SF-CAP-015', 'My brothers\' team, the Hilltop Hawks, won the big game against the Lakeview Lions on Saturday.', 'ok', G.pluralPossessive],
  ['SF-SVA-006', 'A spider has eight legs, but an insect has just six.', 'ok', G.swapWords],
  // WRONG: must be incorrect
  ['SF-SPL-015', 'The firefighters stopped buy our school to talk about safety.', 'incorrect'],
  ['SF-SPL-004', 'Grandma maid my favorite soup for dinner tonight.', 'incorrect'],
  ['SF-HOM-010', 'Our family eight a whole pizza in less than an hour.', 'incorrect'],
  ['SF-SPL-019', 'Two baby foxes were hiding under the bushes near hour tent.', 'incorrect'],
  ['SF-SPL-010', 'We found a peace of shell and a little crab in the sand.', 'incorrect'],
  ['SF-SPL-003', 'The butterfly had beautiful orange, and black wings.', 'incorrect'],
  ['SF-SVA-004', 'Our player have new jerseys this year.', 'incorrect'],
  ['SF-POS-002', 'Mias backpack is hanging on the hook by the door.', 'incorrect'],
  ['SF-POS-008', 'My two brothers bike\'s are in the garage, but Dad\'s car isn\'t.', 'incorrect'],
  ['SF-HOM-002', 'I have two pencil and an eraser in my desk.', 'incorrect'],
  ['SF-SPL-004', 'Grandma made my favorite soup for diner tonight.', 'incorrect', G.realWordTypo],
  ['SF-SPL-001', 'My fiend Jamal sits next to me in class.', 'incorrect', G.realWordTypo],
  ['SF-SPL-007', 'Our team was really tied after the long game.', 'incorrect', G.realWordTypo],
  ['SF-SPL-018', 'I was so excited to open my birthday presence.', 'incorrect', G.realWordTypo],
  ['SF-TEN-001', 'We waked to the science museum last Friday.', 'incorrect', G.realWordTypo],
  ['SF-SPL-022', 'Every morning, our teacher writes a question on the bored, and we write our answers in our journals.', 'incorrect', G.realWordTypo],
  ['SF-HOM-007', 'Dad and I rode to the store to buy milk, and two loaves of bread.', 'incorrect', G.twoItemComma],
  ['SF-MIX-011', 'At the beach, Elena found a starfish, and two tiny crabs under a rock.', 'incorrect', G.twoItemComma],
  ['SF-COM-002', 'Priya, please hand me the tape, and the scissors.', 'incorrect', G.twoItemComma],
  ['SF-TEN-001', 'We walked to science museum last Friday.', 'incorrect', G.droppedThe],
];

for (const [id, answer, expect, todo] of FINAL) {
  test(`final ${id}: ${JSON.stringify(answer)} → ${expect}`, todo ? { todo } : {}, () => check(id, answer, expect));
}

test('final re-check: 30+ fresh answers', () => assert.ok(FINAL.length >= 30));
