# Sentence Fix — Independent Educational Audit (Agent 5)

Branch `claude/student-first-v3`. Audited: `data/sentence-fix/bank.json` (all 150 items read one by one), `docs/SENTENCE-FIX-CURRICULUM.md`, `js/sentencefix/engine.js`. Independent grading tests: `tests/unit/sentencefix-grading-audit.test.mjs`. Nothing in the bank, the engine, or other app code was changed.

## 1. Summary

| | |
|---|---|
| Items reviewed | **150 / 150** |
| Items PASS | **89** |
| Items REVISE | **61** (1 for factual content, 7 for Major issues, 34 only because an accepted answer is missing for the optional opening-phrase comma, and the rest for Minor polish) |
| Content findings | **Critical 2** (C1 factual, C2 systemic grading of optional commas), **Major 7**, **Minor 11** |
| Engine findings | **Critical 2** (+ C2 shared), **Major 5**, **Minor 2** |
| Audit test run | `node --test tests/unit/sentencefix-grading-audit.test.mjs` → `tests 295, pass 229, fail 0, todo 66` |
| **Content bank verdict** | **NOT APPROVED.** Critical and Major findings remain. All of them have small fixes that can be applied directly (section 9). |
| **Grading engine verdict** | **NOT APPROVED.** Some valid answers get marked incorrect, and some clearly wrong answers go to review (section 10). |

### Counts verified (skill × difficulty), matching the owner's targets exactly

| Skill | Easy | Medium | Hard | Total | Target |
|---|---|---|---|---|---|
| capitalization | 5 | 6 | 4 | 15 | 15 ✔ |
| ending-punctuation | 6 | 6 | 3 | 15 | 15 ✔ |
| commas | 4 | 7 | 4 | 15 | 15 ✔ |
| spelling | 7 | 12 | 6 | 25 | 25 ✔ |
| verb-tense | 6 | 9 | 5 | 20 | 20 ✔ |
| subject-verb | 4 | 7 | 4 | 15 | 15 ✔ |
| homophones | 4 | 7 | 4 | 15 | 15 ✔ |
| possessives-contractions | 4 | 7 | 4 | 15 | 15 ✔ |
| mixed | 0 | 4 | 11 | 15 | 15 ✔ |
| **Total** | **40** ✔ | **65** ✔ | **45** ✔ | **150** | |

The bank has the right structure. Every item has an id, skill, difficulty, context, incorrect, correct, accepted, errors (each with category, wrong, right and explanation), exactly 3 hints, and tags. Error counts fit every difficulty band: easy 1–2, medium 2–3, hard 3–5. Every single-skill item uses only its own skill's Lab category. Every item that combines skills is labelled `mixed`, and its tags list the skills it combines. Applying the documented fixes in order turns `incorrect` into exactly `correct` for all 150 items, so no mistake is left undocumented and the key never adds a change silently.

**Owner decision needed (not counted as a defect):** the owner's brief describes "hard" as "3–5 mistakes … multiple skills combined". The brief also fixes the skill counts (only 15 mixed items) and says single-skill items must not combine skills. Both cannot be true at once. The designer resolved this by making hard single-skill items combine several *rules* within one skill. Only the 11 hard mixed items actually combine skills. I agree with this reading, but the owner should confirm it.

## 2. Item status (all 150)

| # | id | skill | diff | status | note |
|---|---|---|---|---|---|
| 1 | SF-CAP-001 | capitalization | easy | PASS |  |
| 2 | SF-CAP-002 | capitalization | easy | PASS |  |
| 3 | SF-CAP-003 | capitalization | easy | PASS |  |
| 4 | SF-CAP-004 | capitalization | easy | PASS |  |
| 5 | SF-CAP-005 | capitalization | easy | PASS |  |
| 6 | SF-CAP-006 | capitalization | medium | PASS |  |
| 7 | SF-CAP-007 | capitalization | medium | REVISE | Minor m6: hint 3 assumes Dr. Kim is "her" |
| 8 | SF-CAP-008 | capitalization | medium | PASS |  |
| 9 | SF-CAP-009 | capitalization | medium | REVISE | Add comma-less opening-phrase answer to `accepted` (**Critical** C2, systemic); Minor m10: "Moon" graded incorrect |
| 10 | SF-CAP-010 | capitalization | medium | REVISE | Add comma-less opening-phrase answer to `accepted` (**Critical** C2, systemic) |
| 11 | SF-CAP-011 | capitalization | medium | REVISE | Add comma-less opening-phrase answer to `accepted` (**Critical** C2, systemic) |
| 12 | SF-CAP-012 | capitalization | hard | REVISE | Add comma-less opening-phrase answer to `accepted` (**Critical** C2, systemic) |
| 13 | SF-CAP-013 | capitalization | hard | PASS |  |
| 14 | SF-CAP-014 | capitalization | hard | PASS |  |
| 15 | SF-CAP-015 | capitalization | hard | PASS |  |
| 16 | SF-END-001 | ending-punctuation | easy | PASS |  |
| 17 | SF-END-002 | ending-punctuation | easy | PASS |  |
| 18 | SF-END-003 | ending-punctuation | easy | PASS |  |
| 19 | SF-END-004 | ending-punctuation | easy | PASS |  |
| 20 | SF-END-005 | ending-punctuation | easy | PASS |  |
| 21 | SF-END-006 | ending-punctuation | easy | PASS |  |
| 22 | SF-END-007 | ending-punctuation | medium | PASS |  |
| 23 | SF-END-008 | ending-punctuation | medium | PASS |  |
| 24 | SF-END-009 | ending-punctuation | medium | PASS |  |
| 25 | SF-END-010 | ending-punctuation | medium | PASS |  |
| 26 | SF-END-011 | ending-punctuation | medium | REVISE | Add comma-less opening-phrase answer to `accepted` (**Critical** C2, systemic) |
| 27 | SF-END-012 | ending-punctuation | medium | REVISE | **Major** M4: "morning!" is a valid exclamation, graded incorrect; add to `accepted` |
| 28 | SF-END-013 | ending-punctuation | hard | REVISE | **Major** M4: "A storm is coming!" valid, graded incorrect; add to `accepted` |
| 29 | SF-END-014 | ending-punctuation | hard | PASS |  |
| 30 | SF-END-015 | ending-punctuation | hard | REVISE | Minor m4: add "Bats are amazing animals!" to `accepted` |
| 31 | SF-COM-001 | commas | easy | PASS |  |
| 32 | SF-COM-002 | commas | easy | PASS |  |
| 33 | SF-COM-003 | commas | easy | PASS |  |
| 34 | SF-COM-004 | commas | easy | PASS |  |
| 35 | SF-COM-005 | commas | medium | PASS |  |
| 36 | SF-COM-006 | commas | medium | PASS |  |
| 37 | SF-COM-007 | commas | medium | PASS |  |
| 38 | SF-COM-008 | commas | medium | PASS |  |
| 39 | SF-COM-009 | commas | medium | REVISE | Add comma-less opening-phrase answer to `accepted` (**Critical** C2, systemic) |
| 40 | SF-COM-010 | commas | medium | PASS |  |
| 41 | SF-COM-011 | commas | medium | PASS |  |
| 42 | SF-COM-012 | commas | hard | PASS |  |
| 43 | SF-COM-013 | commas | hard | PASS |  |
| 44 | SF-COM-014 | commas | hard | REVISE | **Major** M6: near-duplicate frame of SF-COM-008 ("Well I … but I …"); rewrite |
| 45 | SF-COM-015 | commas | hard | REVISE | Minor m10: child writing "Moon" is marked incorrect; add `accepted` |
| 46 | SF-SPL-001 | spelling | easy | PASS |  |
| 47 | SF-SPL-002 | spelling | easy | PASS |  |
| 48 | SF-SPL-003 | spelling | easy | PASS |  |
| 49 | SF-SPL-004 | spelling | easy | PASS |  |
| 50 | SF-SPL-005 | spelling | easy | PASS |  |
| 51 | SF-SPL-006 | spelling | easy | PASS |  |
| 52 | SF-SPL-007 | spelling | easy | PASS |  |
| 53 | SF-SPL-008 | spelling | medium | REVISE | Minor m5: hint 3 wording is confusing |
| 54 | SF-SPL-009 | spelling | medium | REVISE | Add comma-less opening-phrase answer to `accepted` (**Critical** C2, systemic) |
| 55 | SF-SPL-010 | spelling | medium | REVISE | Minor m5: hint 3 "wrong two letters" misleading (letters are swapped) |
| 56 | SF-SPL-011 | spelling | medium | PASS |  |
| 57 | SF-SPL-012 | spelling | medium | PASS |  |
| 58 | SF-SPL-013 | spelling | medium | PASS |  |
| 59 | SF-SPL-014 | spelling | medium | REVISE | Add comma-less opening-phrase answer to `accepted` (**Critical** C2, systemic) |
| 60 | SF-SPL-015 | spelling | medium | PASS |  |
| 61 | SF-SPL-016 | spelling | medium | PASS |  |
| 62 | SF-SPL-017 | spelling | medium | PASS |  |
| 63 | SF-SPL-018 | spelling | medium | PASS |  |
| 64 | SF-SPL-019 | spelling | medium | PASS |  |
| 65 | SF-SPL-020 | spelling | hard | PASS |  |
| 66 | SF-SPL-021 | spelling | hard | REVISE | Add comma-less opening-phrase answer to `accepted` (**Critical** C2, systemic) |
| 67 | SF-SPL-022 | spelling | hard | REVISE | Add comma-less opening-phrase answer to `accepted` (**Critical** C2, systemic) |
| 68 | SF-SPL-023 | spelling | hard | PASS |  |
| 69 | SF-SPL-024 | spelling | hard | REVISE | Add comma-less opening-phrase answer to `accepted` (**Critical** C2, systemic) |
| 70 | SF-SPL-025 | spelling | hard | PASS |  |
| 71 | SF-TEN-001 | verb-tense | easy | PASS |  |
| 72 | SF-TEN-002 | verb-tense | easy | REVISE | Add comma-less opening-phrase answer to `accepted` (**Critical** C2, systemic) |
| 73 | SF-TEN-003 | verb-tense | easy | REVISE | Add comma-less opening-phrase answer to `accepted` (**Critical** C2, systemic) |
| 74 | SF-TEN-004 | verb-tense | easy | PASS |  |
| 75 | SF-TEN-005 | verb-tense | easy | PASS |  |
| 76 | SF-TEN-006 | verb-tense | easy | REVISE | Add comma-less opening-phrase answer to `accepted` (**Critical** C2, systemic) |
| 77 | SF-TEN-007 | verb-tense | medium | REVISE | Add comma-less opening-phrase answer to `accepted` (**Critical** C2, systemic) |
| 78 | SF-TEN-008 | verb-tense | medium | REVISE | Add comma-less opening-phrase answer to `accepted` (**Critical** C2, systemic) |
| 79 | SF-TEN-009 | verb-tense | medium | REVISE | Add comma-less opening-phrase answer to `accepted` (**Critical** C2, systemic) |
| 80 | SF-TEN-010 | verb-tense | medium | REVISE | Add comma-less opening-phrase answer to `accepted` (**Critical** C2, systemic) |
| 81 | SF-TEN-011 | verb-tense | medium | REVISE | Add comma-less opening-phrase answer to `accepted` (**Critical** C2, systemic) |
| 82 | SF-TEN-012 | verb-tense | medium | REVISE | Add comma-less opening-phrase answer to `accepted` (**Critical** C2, systemic) |
| 83 | SF-TEN-013 | verb-tense | medium | REVISE | Add comma-less opening-phrase answer to `accepted` (**Critical** C2, systemic) |
| 84 | SF-TEN-014 | verb-tense | medium | REVISE | Add comma-less opening-phrase answer to `accepted` (**Critical** C2, systemic) |
| 85 | SF-TEN-015 | verb-tense | medium | REVISE | Minor m1: "sit" also has an agreement error; use "sits" |
| 86 | SF-TEN-016 | verb-tense | hard | REVISE | Add comma-less opening-phrase answer to `accepted` (**Critical** C2, systemic) |
| 87 | SF-TEN-017 | verb-tense | hard | REVISE | Add comma-less opening-phrase answer to `accepted` (**Critical** C2, systemic); Minor m8: 21 words (hard max 20) |
| 88 | SF-TEN-018 | verb-tense | hard | PASS |  |
| 89 | SF-TEN-019 | verb-tense | hard | REVISE | Add comma-less opening-phrase answer to `accepted` (**Critical** C2, systemic) |
| 90 | SF-TEN-020 | verb-tense | hard | REVISE | Add comma-less opening-phrase answer to `accepted` (**Critical** C2, systemic) |
| 91 | SF-SVA-001 | subject-verb | easy | REVISE | **Major** M3: valid "were" answer marked incorrect; add to `accepted` |
| 92 | SF-SVA-002 | subject-verb | easy | PASS |  |
| 93 | SF-SVA-003 | subject-verb | easy | PASS |  |
| 94 | SF-SVA-004 | subject-verb | easy | PASS |  |
| 95 | SF-SVA-005 | subject-verb | medium | PASS |  |
| 96 | SF-SVA-006 | subject-verb | medium | REVISE | Minor m9: "only has six" → add natural "has only six" to `accepted` |
| 97 | SF-SVA-007 | subject-verb | medium | PASS |  |
| 98 | SF-SVA-008 | subject-verb | medium | PASS |  |
| 99 | SF-SVA-009 | subject-verb | medium | PASS |  |
| 100 | SF-SVA-010 | subject-verb | medium | PASS |  |
| 101 | SF-SVA-011 | subject-verb | medium | PASS |  |
| 102 | SF-SVA-012 | subject-verb | hard | REVISE | Add comma-less opening-phrase answer to `accepted` (**Critical** C2, systemic) |
| 103 | SF-SVA-013 | subject-verb | hard | PASS |  |
| 104 | SF-SVA-014 | subject-verb | hard | PASS |  |
| 105 | SF-SVA-015 | subject-verb | hard | REVISE | Minor m6: hint 3 says "Two brothers" and gives two answers outright |
| 106 | SF-HOM-001 | homophones | easy | PASS |  |
| 107 | SF-HOM-002 | homophones | easy | PASS |  |
| 108 | SF-HOM-003 | homophones | easy | PASS |  |
| 109 | SF-HOM-004 | homophones | easy | PASS |  |
| 110 | SF-HOM-005 | homophones | medium | PASS |  |
| 111 | SF-HOM-006 | homophones | medium | PASS |  |
| 112 | SF-HOM-007 | homophones | medium | REVISE | Minor m8: 17 words (medium target 9–16) |
| 113 | SF-HOM-008 | homophones | medium | PASS |  |
| 114 | SF-HOM-009 | homophones | medium | REVISE | Add comma-less opening-phrase answer to `accepted` (**Critical** C2, systemic) |
| 115 | SF-HOM-010 | homophones | medium | PASS |  |
| 116 | SF-HOM-011 | homophones | medium | REVISE | Minor m2: circular explanation for rode |
| 117 | SF-HOM-012 | homophones | hard | PASS |  |
| 118 | SF-HOM-013 | homophones | hard | PASS |  |
| 119 | SF-HOM-014 | homophones | hard | REVISE | Minor m4: hint 2 "the word after a" is ambiguous |
| 120 | SF-HOM-015 | homophones | hard | REVISE | **Critical** C1: factually wrong (the moon is not always in the daytime sky); rewrite |
| 121 | SF-POS-001 | possessives-contractions | easy | REVISE | Minor m3: "can not" → "cannot" in explanation/hint |
| 122 | SF-POS-002 | possessives-contractions | easy | PASS |  |
| 123 | SF-POS-003 | possessives-contractions | easy | PASS |  |
| 124 | SF-POS-004 | possessives-contractions | easy | PASS |  |
| 125 | SF-POS-005 | possessives-contractions | medium | REVISE | Minor m8: 8 words (medium target 9–16) |
| 126 | SF-POS-006 | possessives-contractions | medium | PASS |  |
| 127 | SF-POS-007 | possessives-contractions | medium | PASS |  |
| 128 | SF-POS-008 | possessives-contractions | medium | PASS |  |
| 129 | SF-POS-009 | possessives-contractions | medium | PASS |  |
| 130 | SF-POS-010 | possessives-contractions | medium | PASS |  |
| 131 | SF-POS-011 | possessives-contractions | medium | PASS |  |
| 132 | SF-POS-012 | possessives-contractions | hard | PASS |  |
| 133 | SF-POS-013 | possessives-contractions | hard | REVISE | **Major** M2: "coachs chairs" ambiguous (coach's / coaches'); make it "coach's chair" |
| 134 | SF-POS-014 | possessives-contractions | hard | PASS |  |
| 135 | SF-POS-015 | possessives-contractions | hard | REVISE | Minor m3: "can not" → "cannot" in explanation/hint |
| 136 | SF-MIX-001 | mixed | medium | REVISE | **Major** M5: near-duplicate of SF-SPL-001 (same frame, same "freind"); rewrite |
| 137 | SF-MIX-002 | mixed | medium | REVISE | Add comma-less opening-phrase answer to `accepted` (**Critical** C2, systemic) |
| 138 | SF-MIX-003 | mixed | medium | REVISE | Minor m8: 8 words (medium target 9–16) |
| 139 | SF-MIX-004 | mixed | medium | PASS |  |
| 140 | SF-MIX-005 | mixed | hard | REVISE | Minor m6/m7: hint 3 "the boys" (friends unspecified); hint 1 "four kinds" ≠ Lab categories; Add comma-less opening-phrase answer to `accepted` (C2) |
| 141 | SF-MIX-006 | mixed | hard | PASS |  |
| 142 | SF-MIX-007 | mixed | hard | REVISE | Add comma-less opening-phrase answer to `accepted` (**Critical** C2, systemic) |
| 143 | SF-MIX-008 | mixed | hard | REVISE | Minor m7: hint 1 "three kinds" but only 2 Lab categories |
| 144 | SF-MIX-009 | mixed | hard | REVISE | Add comma-less opening-phrase answer to `accepted` (**Critical** C2, systemic); Minor m3/m7: "can not", hint 1 "four kinds" |
| 145 | SF-MIX-010 | mixed | hard | REVISE | Minor m7: hint 1 "four kinds" but 3 Lab categories |
| 146 | SF-MIX-011 | mixed | hard | REVISE | Minor m7: hint 1 "four kinds" but 3 Lab categories; Add comma-less opening-phrase answer to `accepted` (C2) |
| 147 | SF-MIX-012 | mixed | hard | REVISE | Minor m7: hint 1 "four kinds" but 3 Lab categories |
| 148 | SF-MIX-013 | mixed | hard | REVISE | **Major** M1: "every Saturday … after school" is illogical; change to "after lunch" |
| 149 | SF-MIX-014 | mixed | hard | REVISE | Add comma-less opening-phrase answer to `accepted` (**Critical** C2, systemic) |
| 150 | SF-MIX-015 | mixed | hard | REVISE | Minor m7: hint 1 "four kinds" but 3 Lab categories |

## 3. Findings by severity

### Critical

**C1 — SF-HOM-015: the science content is wrong.**
"Do you know where the moon goes during the day? It is still there in the sky." This teaches that the moon is always in the daytime sky. In fact it is below the horizon for about half of each day, and on many days it cannot be seen in daylight at all. Rewrite so the sentence is true but keeps the same three homophone mistakes:
- incorrect: `Do you no wear the moon is during the day? Sometimes it is still up their in the sky.`
- correct: `Do you know where the moon is during the day? Sometimes it is still up there in the sky.`
- errors: unchanged (`no`→`know`, `wear`→`where`, `their`→`there`) with the same explanations.
- hint 2: `Look at the words after "Do you" and the word after "still up."` Hints 1 and 3 stay the same. The sentence has 19 words.

**C2 — Systemic: leaving out an *optional* opening-phrase comma is graded incorrect, with no review (34 items).**
The curriculum calls the comma after a short opening phrase optional, and SF-CAP-006 accepts both "On Saturday we…" and "On Saturday, we…". Everywhere else the comma is written into both `incorrect` and `correct` and is never added to `accepted`. When a child retypes "Yesterday my dad cooked spaghetti for dinner." (SF-TEN-002), the engine reports a *dropped* mark, which counts as clear, and returns **incorrect**. That marks a correct US-English answer wrong. The accepted-answer rules are also inconsistent: CAP-006 accepts the comma-less form but the other 34 items do not. **Fix in the bank:** add the comma-less sentence to `accepted` for each item in the table in section 9.2. The audit tests list all 34 as `todo`. A second option is an engine rule (see E3), but the bank fix is deterministic and needs no code change.

### Major

**M1 — SF-MIX-013: the context is illogical.** "…every Saturday at the gym on Elm Street after school": there is no school on Saturday.
- incorrect: `Kai and Noah plays basketball every saturday at the gym on elm street after lunch`
- correct: `Kai and Noah play basketball every Saturday at the gym on Elm Street after lunch.`
- error 4: wrong `lunch` → right `lunch.` with explanation "A telling sentence ends with a period." Hints stay the same.

**M2 — SF-POS-013: the possessive is ambiguous.** In "sit in the coachs chairs", plural *chairs* suggests several coaches, so `coaches'` is a defensible fix. The key accepts only `coach's`, and the engine marks `coaches'` incorrect as a near-miss spelling.
- incorrect: `Lets go watch Kofis game, but we shouldnt sit in the coachs chair.`
- correct: `Let's go watch Kofi's game, but we shouldn't sit in the coach's chair.`
- hint 2: `Look at the first word, whose game it is, the word that means "should not," and whose chair it is.`

**M3 — SF-SVA-001: a valid answer is marked wrong.** "Maya and Leo **were** in the same reading group." agrees with its subject and nothing in the sentence fixes the time. The engine treats `were` as a misspelling of `are` and returns incorrect (see E1). Add `accepted: ["Maya and Leo were in the same reading group."]`.

**M4 — SF-END-012, SF-END-013 (and Minor: SF-END-015): exclamation points are valid here.** "My puppy ran away this morning!" and "A storm is coming!" are natural exclamations, and END-008 already accepts "!" on "Isn't that amazing". The engine currently returns **incorrect** for these answers (see E2). Add:
- END-012 `accepted`: `My puppy ran away this morning! Can you help me look for him?`
- END-013 `accepted`: `A storm is coming! Did you close the windows? We should bring the plants inside.`
- END-015 (Minor) `accepted`: `Why do bats sleep during the day? They hunt for food at night. Bats are amazing animals!`

**M5 — SF-MIX-001 is a near-duplicate of SF-SPL-001.** "my freind Ava sits next to me in art class" and "My freind Jamal sits next to me in class." use the same frame and the same misspelling.
- incorrect: `my sister Ava used bright colers in art class`
- correct: `My sister Ava used bright colors in art class.`
- errors: `my`→`My` (capitalization, "The first word of a sentence starts with a capital letter."); `colers`→`colors` (spelling, "Colors is spelled c-o-l-o-r-s."); `class`→`class.` (punctuation, "A telling sentence ends with a period.")
- hints: (1) unchanged; (2) `Look at the first word, the word that names things like red and blue, and the end of the sentence.` (3) `Capitalize the first word, fix one vowel in the word for red and blue, and end the telling sentence.`

**M6 — SF-COM-014 is a near-duplicate frame of SF-COM-008.** Both follow "Well I … but I/it …" (opening Well, then a comma before *but*).
- incorrect: `Mom I packed crayons glue and paper but I forgot the scissors.`
- correct: `Mom, I packed crayons, glue and paper, but I forgot the scissors.`
- accepted: `Mom, I packed crayons, glue, and paper, but I forgot the scissors.`
- errors: `Mom`→`Mom,` ("Use a comma to set off the name of the person you are talking to."); `crayons`→`crayons,` (list); `paper`→`paper,` (before *but*). The explanations for the last two stay the same.
- hints: (2) `Look at the name of the person being spoken to, the list of supplies, and the word "but."` (3) `Add a comma after "Mom," between the supplies, and before "but." A comma before "and" is OK too.`

**M7 — Systemic: Thinking Lab categories a teacher could dispute.** The documented rules settle these cases, but a third grader choosing between Spelling and Grammar could reasonably pick either one:
- Homophones that are verbs, where the explanation itself talks about tense: `new`→`knew` (SF-HOM-004, SF-HOM-013, explained as "Knew is the past tense of know"), `one`→`won` (SF-HOM-005, SF-HOM-013), and `no`→`know` (SF-HOM-015). By rule these are Spelling, but a child who answers Grammar because "knew is the past tense" has a defensible answer.
- Spelling-rule inflections: `carryed`→`carried` (SF-SPL-016), `stoped`→`stopped` (SF-SPL-015, SF-SPL-023), `hopeing`→`hoping` (SF-SPL-023), `runing`→`running` (SF-SPL-013). By rule 2 these are Spelling. Hint 1 says "misspelled word", which helps, but a child who picks before reading hints may say Grammar.

Recommended fix, in the Lab rather than the content: add an optional `altCategory` field to an error (for example `"altCategory": "grammar"` on the errors above). The Lab should then accept either answer and show a feedback line such as "This is a spelling-rule mistake: the verb and tense are right, only the spelling is wrong." If the Lab is not changed, at least begin hint 1 of each HOM item listed above with "Spelling: …", for example `Spelling: look for a word that sounds right but is the wrong word.`

### Minor

- **m1 SF-TEN-015:** "Sofia grabs her lunch and **sit**". `sit` is also an agreement error in the present tense, so the item has a hidden second rule. Change the incorrect sentence to `When the bell rang, Sofia grabs her lunch and sits with her friends.` and change error 2 to `sits`→`sat`: "The bell already rang, so use the past tense. The past tense of sit is sat."
- **m2 SF-HOM-011:** "Rode means you rode on something" is circular. Use `A road is a street. Rode is the past tense of ride.`
- **m3 SF-POS-001, SF-POS-015, SF-MIX-009:** "Can't is short for can not" should say *cannot*. Use explanation `Can't is short for cannot. The apostrophe takes the place of the missing letters.` Change POS-001 hint 3 to `This word is a short way to say "cannot."` Change POS-015 hint 2 and MIX-009 hint 2 to `the word that means "cannot,"`.
- **m4 SF-HOM-014:** hint 2 "the word after 'a'" is ambiguous because there are two a's. Use `Look at the word before "the market," the word after "a sign for a," and the fruit.` (END-015 is also part of m4; see M4.)
- **m5 SF-SPL-008:** use hint 3 `One word does not look the way it sounds. The other word is missing a vowel.` **SF-SPL-010:** use hint 3 `One word has the i and e switched. The other word has its last two letters in the wrong order.`
- **m6** Hint wording that assumes facts the sentence does not state. SF-SVA-015 hint 3: `More than one brother needs a verb for more than one. One dad needs a verb with s. One job needs a verb for one thing.` This also stops the hint from giving away "are" and "is". SF-MIX-005 hint 3: `…show the moves belong to Tariq and his friends…` in place of "the boys". SF-CAP-007 hint 3: `The doctor's title, the doctor's name, and the month all need capitals.`
- **m7** The mixed-item hint 1 counts "kinds" that do not match the 4 Lab categories. A homophone is listed as a kind separate from spelling, even though it is Spelling in the Lab, which can mislead the Lab category choice. Use:
  - MIX-005: `Look for capital-letter mistakes, two spelling mistakes (one is a word that sounds right but is the wrong word), and a missing end mark.`
  - MIX-008: `Look for capital-letter mistakes and punctuation mistakes (a missing comma and a missing question mark).`
  - MIX-009: `Look for a capital-letter mistake, a spelling mistake, and two punctuation mistakes (an apostrophe and an end mark).`
  - MIX-010: `Look for two punctuation mistakes (a comma and an end mark), a grammar mistake with a verb, and a spelling mistake with a word that sounds right.`
  - MIX-011: `Look for a capital-letter mistake, a grammar mistake with a verb, a spelling mistake with a word that sounds right, and a missing end mark.`
  - MIX-012: `Look for punctuation mistakes (a comma and an end mark), a capital-letter mistake, and a spelling mistake.`
  - MIX-015: `Look for two punctuation mistakes (an apostrophe and an end mark), a grammar mistake with a verb, and a spelling mistake.`
- **m8** Word count drifts outside the target band. SF-POS-005 (8): `Owens new soccer ball rolled under Aunt Rosas red car.` → `Owen's new soccer ball rolled under Aunt Rosa's red car.` SF-MIX-003 (8): `Please dont forget too bring your lunch to school tomorrow.` → `Please don't forget to bring your lunch to school tomorrow.` SF-HOM-007 (17): remove "our bikes": `Dad and I rode to the store to by milk and too loaves of bread.` → `Dad and I rode to the store to buy milk and two loaves of bread.` SF-TEN-017 (21): remove "to America": `In 1620, the Pilgrims sail on a ship that is called the Mayflower, and the trip takes many weeks.` → `In 1620, the Pilgrims sailed on a ship that was called the Mayflower, and the trip took many weeks.`
- **m9 SF-SVA-006:** "an insect only has six" is less natural than "has only six". Add `accepted: ["A spider has eight legs, but an insect has only six."]`. Today the engine sends this to review, which is acceptable.
- **m10 SF-CAP-009, SF-COM-015:** many teachers and NASA style capitalize "Moon". A child who writes "Moon" is currently graded **incorrect** (over-capitalization). Either add accepted variants with "Moon", or write "Neil Armstrong became the first person to walk on the moon" knowing this risk. Lowercase is standard for grade 3, so this is Minor.
- **m11 Repeated targets** (no change required, but vary them if items are rewritten): `becuase` ×3 (SPL-002/017/021), `freind` ×3 (SPL-001/023, MIX-001), `untill` ×3, `realy` ×2, `wich` ×2, `littel` ×2, `stoped` ×2, `beatiful` ×2, `nieghbor(hood)` ×2, `catched` ×2 (TEN-003/019), `swimmed` ×2 (TEN-011/018), `finded` ×2 (TEN-011, MIX-011), `one→won` ×2 (HOM-005/013). The moon landing appears in both CAP-009 and COM-015. "No + name" opens both COM-006 and COM-015. A compound subject with is/plays appears in SVA-001, SVA-010, MIX-010 and MIX-013.

## 4. Duplicates / near-duplicates
- **Major:** SF-MIX-001 ≈ SF-SPL-001 (M5); SF-COM-014 ≈ SF-COM-008 (M6).
- **Minor:** the repeated targets and topics in m11.
- No exact duplicate sentences.

## 5. Incorrect answer keys
- No answer key is grammatically wrong. Every `correct` sentence is standard US English, and every `accepted` entry is error-free (Oxford-comma variants, "Isn't that amazing!", "does not").
- Content error: SF-HOM-015 is factually wrong (C1).
- Logic error: SF-MIX-013 (M1).

## 6. Ambiguous grammar / missing accepted alternatives
- Optional opening-phrase comma: 34 items (C2).
- SF-SVA-001 `were` (M3). SF-POS-013 `coach's`/`coaches'` (M2). Exclamation points in END-012/013/015 (M4). SF-SVA-006 word order (m9). "Moon" (m10).
- Checked and acceptable: the Oxford comma is treated the same way in all five list items (COM-005/009/012/013/014: the key has no serial comma and the serial comma is accepted), and no list of three appears outside the commas skill. Contraction ↔ full form: SVA-003 accepts "does not". In POS items the contraction is the skill being tested, so a full form ("can not", "I am") correctly goes to review, not correct. The exception is "cannot", which the engine wrongly marks incorrect (E1). Synonyms and rewrites (for example "went" for "walked", "the sun rose", "a ship called the Mayflower") go to review, which is appropriate.

## 7. Vocabulary
No item uses vocabulary beyond grade 3. The hardest words are tied to the history and science topics where they belong: *Declaration of Independence*, *Mayflower*, *experiment*, *recycling drive*, *neighborhood*. Names are diverse and appropriate, and no item contains sensitive content. Facts checked: the Wright brothers (Dec 17, 1903), the moon landing (July 20, 1969), the Pilgrims (1620, a voyage of many weeks), the Declaration (Philadelphia, 1776), Earth Day (April 22), Lincoln on the penny, Boston fireworks over the Charles River, ants carrying heavy loads, spiders vs. insects, owls by night and hawks by day, and water freezing. All are correct except HOM-015.

## 8. Missing hints / explanations; skill tags and categories
- All 150 items have 3 hints and an explanation for every error. The hints move from type to location to a specific clue, and none writes out the full corrected sentence. Some hint 3s name a single fixed word (SVA-003, SVA-009, SVA-014, SVA-015, HOM-012). That is allowed for a hint 3; only SVA-015, which gives two of its three answers, is flagged (m6).
- Explanations state the rules correctly: comma rules, its/it's, irregular pasts, plural -es, doubling, dropping e, y→i. The weak spots are m2 (circular explanation) and m3 ("can not").
- Skill tags match the errors in all 150 items. The Lab categories follow the documented rules in every item. The disputable boundary cases are listed in M7, and the hint wording that conflicts with the Lab categories is m7.

## 9. Recommended revisions (apply directly)

### 9.1 Item edits
See C1, M1, M2, M5, M6, m1, m2, m3, m4, m5, m6, m7 and m8 above for exact text. Accepted additions: M3, M4, m9, m10.

### 9.2 C2 — comma-less answers to add to `accepted` (exact strings)

| id | add to `accepted` |
|---|---|
| SF-CAP-009 | `In July 1969 Neil Armstrong became the first person to walk on the moon.` |
| SF-CAP-010 | `Every Wednesday Ms. Rivera teaches us songs in Spanish.` |
| SF-CAP-011 | `For Thanksgiving we drove to my aunt's house in Ohio.` |
| SF-CAP-012 | `Last June my family camped at Yellowstone National Park with Uncle Ray and Aunt Bea.` |
| SF-END-011 | `Long ago people wrote letters with feather pens. Have you ever tried one?` |
| SF-SPL-009 | `In science we learned which animals sleep during the cold winter.` |
| SF-SPL-014 | `Long ago many people traveled across the country in covered wagons.` |
| SF-SPL-021 | `On Sunday my family went to the beach and stayed until the sun went down because it was really warm.` |
| SF-SPL-022 | `Every morning our teacher writes a question on the board, and we write our answers in our journals.` |
| SF-SPL-024 | `Many years ago children walked to a small school and wrote their lessons on little chalkboards every day.` |
| SF-TEN-002 | `Yesterday my dad cooked spaghetti for dinner.` |
| SF-TEN-003 | `Last week Mia caught the ball with one hand.` |
| SF-TEN-006 | `Last spring our town built a new playground.` |
| SF-TEN-007 | `Yesterday Ms. Chen read us a story, and then we drew pictures about it.` |
| SF-TEN-008 | `Last week we planted seeds in cups and watched them sprout.` |
| SF-TEN-009 | `Long ago people sewed their own clothes and grew their own food.` |
| SF-TEN-010 | `In the last game Carlos ran fast and threw the ball to first base.` |
| SF-TEN-011 | `Last summer my sister and I swam in the lake and found a smooth rock.` |
| SF-TEN-012 | `Last Sunday morning the sun came up, and the birds sang in the trees.` |
| SF-TEN-013 | `Last Saturday my aunt made bread, and we ate it while it was still warm.` |
| SF-TEN-014 | `Last month our class wrote letters to the mayor, and she sent us a reply.` |
| SF-TEN-016 | `Last Tuesday our class went outside at noon, and we traced our shadows with chalk while Mr. Ross took pictures.` |
| SF-TEN-017 | `In 1620 the Pilgrims sailed to America on a ship that was called the Mayflower, and the trip took many weeks.` |
| SF-TEN-019 | `Last weekend Grandpa taught me to fish, and I caught a big trout that we cooked for dinner.` |
| SF-TEN-020 | `Yesterday the power went out, so we found flashlights and told stories until the lights came back on.` |
| SF-SVA-012 | `Every Friday Mr. Park's students take a spelling test, and Ravi always gets every word right because he studies hard.` |
| SF-HOM-009 | `Long ago sailors used the stars to find their way across the sea.` |
| SF-COM-009 | `On our hike we saw deer, rabbits, turkeys and a red fox.`<br>`On our hike we saw deer, rabbits, turkeys, and a red fox.` |
| SF-MIX-002 | `Last Sunday we went to the zoo with our cousins.` |
| SF-MIX-005 | `On Friday Tariq and his friends practiced their soccer moves at the park until dark.` |
| SF-MIX-007 | `In 1776 American leaders met in Philadelphia and signed the Declaration of Independence to start a new country.` |
| SF-MIX-009 | `On Tuesday our puppy turns two, and my brother can't believe how big he is.` |
| SF-MIX-011 | `At the beach Elena found a starfish and two tiny crabs under a rock.` |
| SF-MIX-014 | `On April 22 our class celebrated Earth Day by picking up trash in the park.` |

If an item is also revised elsewhere in this report (SF-TEN-017 in m8), build its comma-less string from the revised sentence instead. SF-COM-009 has two strings because its Oxford-comma variant also needs a comma-less form.

## 10. Grading engine findings

The test file `tests/unit/sentencefix-grading-audit.test.mjs` contains 295 tests.

**Programmatic checks on all 150 items:**
- The key and every accepted answer grade **correct**. This holds unchanged and with outer or trailing spaces, double spaces (including after commas), extra spaces after commas, curly apostrophes and quotes, and a trailing newline.
- Empty or whitespace-only answers return **empty**.
- Copying the incorrect sentence unchanged returns **incorrect**.
- For every multi-error item, fixing every mistake but one returns **incorrect**, with each mistake left in turn.
- A lowercase first letter returns **incorrect**.
- A missing final end mark should return **incorrect**; 5 items currently return review (E4).
- On questions, "." instead of "?" should return **incorrect**; 2 items currently return review (E5).

**Hand-written cases:** 89 realistic third-grade answers on 76 different items, covering every skill and difficulty. Tests that expose a defect assert the correct educational result and are marked `todo`. The current run shows `pass 229, fail 0, todo 66`.

What works well: partial fixes, a mistake left in place, new misspellings (`visted`, `frend`, `togather`, `childrens`, `studys`), over-capitalization (`Class`, `Zoo`, `Grandma` after "my", `Of` in a title), wrong near-homophones (`they're` for *there*, `too` for *two*, `bye` for *by*, `its` for *it's*), apostrophe misplacement (`brother's` for *brothers'*, `ca'nt`, `Mias'`), "." on a question, `but,` after the conjunction, a comma splice, and `doesnt` are all **incorrect**. Valid rewrites (`went`, `the sun rose`, `a ship called the Mayflower`, `has only six`, `I am`, `can not`, `is finished`) go to **review**.

### Critical
- **E1 — A different real word is treated as a misspelling, so a valid answer is marked incorrect.** `nearMiss()` and the same-spot near-miss rule in `grade()` count any word within 2 letters of the key as a "slip". Failing cases:
  - SF-POS-001 `I cannot find my other sock anywhere.` → **incorrect** (cannot vs can't, distance 2). Yet `I can not find…` → review.
  - SF-SVA-001 `Maya and Leo were in the same reading group.` → **incorrect** (were vs are).
  - SF-SVA-015 `My brothers were cleaning the garage, and Dad said we could go swimming when the job was done.` → **incorrect**, although it is a consistent past-tense sentence.

  Suggested fix: before treating a word as a near miss, check that the typed word is not itself an ordinary dictionary word. A small list of common function words and verb forms would do (are/were/was/is/am, has/had/have, can/cannot, do/did/does). If it is such a word, return "unknown", which leads to review.
- **E2 — "!" is graded inconsistently.** When the documented mistake is a missing period (`wrong: "morning"`, `right: "morning."`), the bare word counts as the original mistake being left in place. So *any* other mark after it, "!" included, makes the answer **incorrect**. When the period was not a documented mistake, "!" goes to review. Across the bank, "!" in place of the final period is incorrect on 14 items and review on 120. Valid answers that fail: SF-END-012 `My puppy ran away this morning! Can you help me look for him?` and SF-END-013 `A storm is coming! Did you close the windows? We should bring the plants inside.` Suggested fix: when `right` is `wrong` plus an end mark and the typed text has `wrong` followed by a *different* end mark, mark the mistake unknown, which leads to review, unless the key mark is "?" (a question really needs "?").
- **E3 (same root cause as C2) — Dropping an optional comma is always clear.** `classify()` returns `['dropped', true]` for any missing mark, so `Yesterday my dad cooked spaghetti for dinner.` is **incorrect** on 34 items. The bank fix (section 9.2) is enough. An engine-level alternative: treat a dropped comma right after a sentence-opening phrase of 4 words or fewer as not clear.

### Major (clearly wrong answers sent to a grown-up as "review")
- **E4 — A missing end mark goes to review when the documented mistake was a wrong end mark.** Examples: SF-END-003 `Where did I leave my red rain boots`, and also END-005, END-006, END-010 and END-014. The cause is that `pending(C.length - 1)` skips the end-mark check while that mistake is "unknown". This is the very skill being taught. Suggested fix: if the answer has no end mark at all, add the `end-mark` extra no matter what the pending state is.
- **E5 — On a quoted question, "." in place of "?" goes to review.** Examples: SF-MIX-008 `Mrs. Jones asked, "Who wants to help plant flowers at the park."` and SF-MIX-012. The span `park"` → `park?"` is not recognized when the typed text is `park."`.
- **E6 — A wrong word or verb form more than 2 letters from the key is "unknown", so the answer goes to review.** These are the most common grade-3 tense mistakes, and every one is clearly wrong:
  - SF-TEN-003 `catch`
  - SF-TEN-009 `growed`
  - SF-TEN-011 `swimed`
  - SF-TEN-016 `goed`
  - SF-TEN-019 `teach`
  - SF-TEN-020 `finded`
  - SF-HOM-013 `knowed`
  - SF-HOM-004 `no` (for *knew*)
  - SF-SVA-001 `am`
  - SF-SVA-011 `There's three apples`
  - SF-MIX-010 `they're` (for *their*)

  Suggested fix: when the typed token occupies exactly the error's slot (the same anchors on both sides) and is a single word that is neither the key nor any accepted form, mark the mistake **unfixed**. Do this when the typed word is the original wrong word, a regular -ed form of the same stem, another form of the same verb, or a known homophone of the key. A simpler alternative is a per-error `alsoWrong` list in the bank (for example `["goed","go","goes"]`).
- **E7 — An added or misplaced comma is never "clear".** SF-COM-005 `…carrots, and, lettuce…` and SF-COM-014 `Well, I packed, crayons, …` go to review. In the commas skill, a comma added between words that the key keeps together should be **incorrect**.
- **E8 — A mark dropped or misplaced inside a mistake's own span goes to review.** SF-CAP-004 `Our soccer coach, Mr Patel, ran laps with us.` (the period of *Mr.* is gone) and SF-COM-003 `Our town was founded on March, 4 1852.` (comma in the wrong place) both go to review.

### Minor
- **E9:** SF-HOM-010 `…in less than a hour.` goes to review. a/an is classed as a "different-word", which is not clear.
- **E10 (observation, no change required):** `Yes,we can…` with no space after the comma is **incorrect** ("Check the spaces between your words."). That is defensible but strict. Capitalizing "Moon" or "President" is **incorrect**, which is a bank decision (m10).

### Engine verdict
**Not approved.** E1–E3 mark valid answers incorrect with no review. E4–E8 send unambiguous mistakes, several of them in the exact skill being practiced, to a grown-up instead of giving the child feedback. Once the bank's C2/M3/M4 additions are applied, E2 and E3 no longer affect *listed* answers, but the engine still needs E1 and E4–E8 fixed. Every case is a `todo` test in the audit file; each one should pass with no change to the test once the defect is fixed.

## 11. Final verdict
- **Content bank: NOT APPROVED.** There are 2 Critical findings (C1 HOM-015 factual error; C2 opening-comma answers missing from `accepted` on 34 items) and 7 Major findings (M1–M7). All have small, ready-to-apply fixes above. Once they are applied, the bank is approvable. The Minor items m1–m11 are recommended but should not block approval.
- **Grading engine: NOT APPROVED.** It has 2 Critical defects (E1, E2) plus E3 (shared with C2), and 5 Major defects (E4–E8).
