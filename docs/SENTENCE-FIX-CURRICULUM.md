# Sentence Fix Curriculum (Grade 3)

Bank: `data/sentence-fix/bank.json` (150 items). Checks: `node --test tests/unit/sentencefix-bank.test.mjs`.

The child sees `incorrect`, fixes it, and is graded against `correct` plus any `accepted` alternatives. In the Thinking Lab the child first picks the **category** of each mistake, then fixes it, with three hints that get more specific each time.

## Skills

| Skill (`skill`) | Code | What it practices |
|---|---|---|
| capitalization | CAP | First word, I, names, titles (Mr./Ms./Dr.), family titles used as names, days, months, holidays, cities, states, countries, languages, parks, rivers, streets, teams |
| ending-punctuation | END | Period, question mark, wrong end mark, end marks between two or three short sentences, indirect questions (end with a period) |
| commas | COM | Lists of three or more, dates, city and state, after Yes/No/Well, direct address, before a quotation, before *and/but/so* joining two complete sentences |
| spelling | SPL | Common grade-3 words, plural -es (box, fox, bush), -ed/-ing spelling rules (stop → stopped, run → running, hope → hoping, carry → carried) |
| verb-tense | TEN | Past tense with a clear time cue (yesterday, last week, in 1620), irregular past forms (catch → caught, go → went) |
| subject-verb | SVA | is/are, has/have, -s verbs with one vs. more than one; subjects are always clear (names, "two," "each," "both") |
| homophones | HOM | there/their, to/too/two, hear/here, knew/new, won/one, buy/by, write/right, flour/flower, sea/see, whole/hole, hour/our, deer/dear, road/rode, sale/sail, pears/pairs, know/no, where/wear |
| possessives-contractions | POS | Singular possessives (Mia's), plural possessives (students', foxes'), contractions (can't, don't, it's, I'm, we're, you're, they're, let's, won't, isn't), its vs. it's |
| mixed | MIX | Two to four of the skills above in one sentence |

## Difficulty

| Level | Mistakes | Length target | Notes |
|---|---|---|---|
| easy | 1–2 | ~7–12 words | Everyday grade-3 words, one skill |
| medium | 2–3 | ~9–16 words | One skill, often two sentences or two rules |
| hard | 3–5 | ~12–20 words | Several mistakes; mixed items combine several skills |

Length targets are guides; the test only warns when an item is outside them and fails when it is more than 3 words outside.

## Thinking Lab category rules

Each mistake has exactly one main `category` (and, rarely, a second acceptable `altCategory`; see below):

- **spelling**: a misspelled word (freind → friend), **including** spelling-rule mistakes on the right word in the right tense (stoped → stopped, carryed → carried, hopeing → hoping, boxs → boxes), **and** homophone mix-ups where a different word must be chosen (there → their, too → two, by → buy).
- **capitalization**: a missing capital letter (or a capital that must be lowercase).
- **punctuation**: end marks, commas, quotation marks, and **all apostrophe fixes**: possessives (Mias → Mia's, brothers → brothers') and contractions (cant → can't).
- **grammar**: wrong verb tense (walk → walked when the sentence says "last Friday"), made-up verb forms for irregular verbs (goed → went, catched → caught, runned → ran), subject-verb agreement (is → are, have → has, don't → doesn't).

Rules for words that could fall into two groups:

1. **its/it's, your/you're, their/they're**: if the fix is adding or removing an apostrophe in a contraction or possessive (Its → It's, it's → its, Youre → You're, Theyre → They're), it is **punctuation**. If the fix is swapping in a different homophone (there → their, their → there), it is **spelling**. Homophone items never test its/it's or your/you're; those live in possessives-contractions.
2. **Past-tense mistakes**: if the child used the right verb and tense but broke a spelling rule (stoped, carryed), it is **spelling**. If the verb form itself is wrong (goed, eated, runned) or the tense is wrong, it is **grammar**. Verb-tense items only use the grammar kind; the spelling kind lives in spelling items.
3. **don't → doesn't** is grammar (agreement), not punctuation, because the apostrophe is already right.
4. A single `wrong` span never mixes two categories. When a word needs two fixes (for example, a lowercase word that also needs an end mark), the sentence is written so the end mark falls on a different word.

### `altCategory` (a second acceptable Lab answer)

An error may carry an optional `altCategory` (one of the four categories, never the same as `category`). It is used only when a reasonable teacher could file the mistake either way. The Lab accepts either choice. `category` stays the main answer, and the feedback can explain why (for example: "This is a spelling-rule mistake: the verb and tense are right, only the spelling is wrong."). The current bank uses it in 16 places:

- Homophones that are verbs: new → knew, one → won, no → know (category spelling, altCategory grammar). Items: HOM-004, HOM-005, HOM-013 (twice), HOM-015.
- Spelling-rule verb endings: runing, stoped, carryed, hopeing (category spelling, altCategory grammar). Items: SPL-013, SPL-015, SPL-016, SPL-023 (twice).
- don't → doesn't (category grammar, altCategory punctuation). Item: SVA-003.
- its / it's (category punctuation, altCategory spelling, because many classrooms teach it as a homophone pair). Items: POS-003, POS-007, POS-014, POS-015, MIX-015.

Made-up irregular past forms (goed, catched, eated) have no `altCategory`: they are always grammar. Contractions that are not real words without the apostrophe (cant, dont, Youre) are always punctuation.

Single-skill items only use their skill's category (as `category`; `altCategory` may name another): capitalization → capitalization; ending-punctuation, commas, possessives-contractions → punctuation; spelling, homophones → spelling; verb-tense, subject-verb → grammar. There are no exceptions in the current bank.

## Accepted alternatives

`accepted` lists other fully correct answers (51 items):

- **Lists** (COM-005, 009, 012, 013, 014): `correct` leaves out the comma before *and* (beans, peas, carrots and lettuce). The version with that comma is in `accepted`. Only the comma before *and* is optional; the other list commas are documented errors.
- **Optional comma after an opening phrase or short opening clause** (Last week / In 1620 / On our hike / When the bell rang / As we hurried out the door). The comma is in both `incorrect` and `correct`, so it is never a mistake, and the comma-less sentence is always in `accepted` (combined with any other accepted variant). The test enforces this for every item that starts with such a phrase. Commas that ARE taught stay required: after Yes/No/Well, after the name of the person spoken to, before a quotation, in dates, between city and state, and before *and/but/so* joining two sentences.
- **End marks**: "!" is accepted where the sentence is a natural exclamation (END-008 "Isn't that amazing!", END-012 "this morning!", END-013 "A storm is coming!", END-015 "Bats are amazing animals!"). Questions always need "?".
- **Other valid answers**: doesn't / does not (SVA-003); "were" with no time cue (SVA-001); "had" with "this year" (SVA-004); "has only six" (SVA-006); "Moon" capitalized (CAP-009).

Nothing listed in `accepted` still contains a documented error.

## Item format notes

- `errors` are listed left to right. Replacing each `wrong` with its `right` once, moving left to right, turns `incorrect` into exactly `correct`. The test checks this and checks that each match is a whole word or phrase.
- For a missing mark, `wrong` is the word before it (for example, `store` → `store.` or `Yes` → `Yes,`).
- Hints: (1) the kind of mistake, (2) where to look, (3) a specific clue that does not write out the answer. In mixed items, hint 1 names the mistakes using the four Lab categories (capital letter, spelling, punctuation, grammar), so it never steers the child toward a wrong Lab choice. Hints do not assume facts the sentence does not state, such as a person's gender.
- Facts in science, nature and history items are checked. For example, the moon is only "sometimes" in the daytime sky, and "honeybees" (not all bees) make honey.
- Explanations say "cannot", never "can not".
- Straight apostrophes and quotation marks only. American spelling.

## Contexts

school, science, nature, sports, community, history, family, everyday.

## Counts (skill × difficulty)

| Skill | Easy | Medium | Hard | Total |
|---|---|---|---|---|
| capitalization | 5 | 6 | 4 | 15 |
| ending-punctuation | 6 | 6 | 3 | 15 |
| commas | 4 | 7 | 4 | 15 |
| spelling | 7 | 12 | 6 | 25 |
| verb-tense | 6 | 9 | 5 | 20 |
| subject-verb | 4 | 7 | 4 | 15 |
| homophones | 4 | 7 | 4 | 15 |
| possessives-contractions | 4 | 7 | 4 | 15 |
| mixed | 0 | 4 | 11 | 15 |
| **Total** | **40** | **65** | **45** | **150** |
