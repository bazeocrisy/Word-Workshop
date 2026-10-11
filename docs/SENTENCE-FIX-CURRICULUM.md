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

Each mistake has exactly one category:

- **spelling**: a misspelled word (freind → friend), **including** spelling-rule mistakes on the right word in the right tense (stoped → stopped, carryed → carried, hopeing → hoping, boxs → boxes), **and** homophone mix-ups where a different word must be chosen (there → their, too → two, by → buy).
- **capitalization**: a missing capital letter (or a capital that must be lowercase).
- **punctuation**: end marks, commas, quotation marks, and **all apostrophe fixes**: possessives (Mias → Mia's, brothers → brothers') and contractions (cant → can't).
- **grammar**: wrong verb tense (walk → walked when the sentence says "last Friday"), made-up verb forms for irregular verbs (goed → went, catched → caught, runned → ran), subject-verb agreement (is → are, have → has, don't → doesn't).

Rules for words that could fall into two groups:

1. **its/it's, your/you're, their/they're**: if the fix is adding or removing an apostrophe in a contraction or possessive (Its → It's, it's → its, Youre → You're, Theyre → They're), it is **punctuation**. If the fix is swapping in a different homophone (there → their, their → there), it is **spelling**. Homophone items never test its/it's or your/you're; those live in possessives-contractions.
2. **Past-tense mistakes**: if the child used the right verb and tense but broke a spelling rule (stoped, carryed), it is **spelling**. If the verb form itself is wrong (goed, eated, runned) or the tense is wrong, it is **grammar**. Verb-tense items only use the grammar kind; the spelling kind lives in spelling items.
3. **don't → doesn't** is grammar (agreement), not punctuation, because the apostrophe is already right.
4. A single `wrong` span never mixes two categories. When a word needs two fixes (for example, a lowercase word that also needs an end mark), the sentence is written so the end mark falls on a different word.

Single-skill items only use their skill's category: capitalization → capitalization; ending-punctuation, commas, possessives-contractions → punctuation; spelling, homophones → spelling; verb-tense, subject-verb → grammar. There are no exceptions in the current bank.

## Accepted alternatives

`accepted` lists other fully correct answers (8 items):

- **Lists**: `correct` leaves out the comma before *and* (beans, peas, carrots and lettuce). The version with that comma is in `accepted`. Only the commas before *and* are optional; the others are documented errors.
- **Optional comma after a short opening phrase** (On Saturday we... / On Saturday, we...).
- **Isn't that amazing?** also accepts an exclamation point.
- **doesn't / does not**.

Optional commas after opening phrases are otherwise written into both `incorrect` and `correct` (for example, "Last week, we..."), so they are never marked as mistakes. Nothing listed in `accepted` still contains a documented error.

## Item format notes

- `errors` are listed left to right. Replacing each `wrong` with its `right` once, moving left to right, turns `incorrect` into exactly `correct`. The test checks this and checks that each match is a whole word or phrase.
- For a missing mark, `wrong` is the word before it (for example, `store` → `store.` or `Yes` → `Yes,`).
- Hints: (1) the kind of mistake, (2) where to look, (3) a specific clue that does not write out the answer.
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
