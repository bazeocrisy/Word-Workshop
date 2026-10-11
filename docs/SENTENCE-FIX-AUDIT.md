# Sentence Fix — Independent Educational Audit (Agent 5)

> **FINAL status (section 19):** **Content bank: APPROVED. All 150 items PASS.** **Grading engine: NOT APPROVED** (f304309). M-1 is verified fixed. N-2 (Major) is a regression: the safety net now sends "Our new players has", "My older brothers is" and "Some robins is" to review. N-1 (Critical, older and narrow): "Maya or Leo is" and "Neither Maya nor Leo is" are marked incorrect. The engine is APPROVED once N-1 and N-2 are fixed. Audit tests: 745 tests, 731 pass, 0 fail, 14 todo.

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

---

## 12. Re-audit (after commit 2931f45 "Sentence Fix: curriculum revised per independent audit…")

Sections 1–11 above record the first audit. **This section supersedes their verdicts.**

### 12.1 Scope and method
- I compared `bank.json` with its previous version item by item. **79 items differ.** The commit message says 80, so one item listed there has no data change.
- I re-audited all 79 changed items in full against the 8 criteria:
  1. every documented error is really in the incorrect sentence;
  2. the corrected sentence is sound;
  3. the explanations are right;
  4. the hints progress and do not give the answer away;
  5. the difficulty level fits;
  6. the vocabulary is grade 3;
  7. no correct answer is left out of `accepted`, and nothing in `accepted` is wrong;
  8. accepted answers are handled the same way across items.
- I re-checked the whole bank for regressions:
  - Counts are still 40 / 65 / 45 and 15 / 15 / 15 / 25 / 20 / 15 / 15 / 15 / 15 by skill.
  - All items are now inside their word-count bands. The old drifts in POS-005, MIX-003, HOM-007 and TEN-017 are fixed.
  - No duplicate or near-duplicate items remain.
  - The documented fixes still turn every `incorrect` sentence into exactly its `correct` sentence.
  - Single-skill items use only their skill's main category.
- I reviewed all 16 `altCategory` assignments and the new `labAccepts()`.
- I tested 88 fresh hand-written student answers (`RE_CASES`) plus Lab tests, in addition to the first-audit suite.

### 12.2 Changed items: status

78 PASS, 1 REVISE.

| id | what changed | status | note |
|---|---|---|---|
| SF-CAP-007 | hints | PASS |  |
| SF-CAP-009 | accepted +3 | PASS |  |
| SF-CAP-010 | accepted +1 | PASS |  |
| SF-CAP-011 | accepted +1 | PASS |  |
| SF-CAP-012 | accepted +1 | PASS |  |
| SF-CAP-013 | accepted +1 | PASS |  |
| SF-END-011 | accepted +1 | PASS |  |
| SF-END-012 | accepted +1 | PASS |  |
| SF-END-013 | accepted +1 | PASS |  |
| SF-END-015 | accepted +1 | PASS |  |
| SF-COM-009 | accepted +2 | PASS |  |
| SF-COM-013 | accepted +2 | PASS |  |
| SF-COM-014 | rewritten; accepted +0; hints | PASS |  |
| SF-COM-015 | rewritten | PASS |  |
| SF-SPL-008 | hints | PASS |  |
| SF-SPL-009 | accepted +1 | PASS |  |
| SF-SPL-010 | hints | PASS |  |
| SF-SPL-013 | altCategory runing→grammar | PASS |  |
| SF-SPL-014 | accepted +1 | PASS |  |
| SF-SPL-015 | altCategory stoped→grammar | PASS |  |
| SF-SPL-016 | altCategory carryed→grammar | PASS |  |
| SF-SPL-021 | accepted +1 | PASS |  |
| SF-SPL-022 | accepted +1 | PASS |  |
| SF-SPL-023 | altCategory hopeing→grammar, stoped→grammar | PASS |  |
| SF-SPL-024 | accepted +1 | PASS |  |
| SF-TEN-002 | accepted +1 | PASS |  |
| SF-TEN-003 | accepted +1 | PASS |  |
| SF-TEN-006 | accepted +1 | PASS |  |
| SF-TEN-007 | accepted +1 | PASS |  |
| SF-TEN-008 | accepted +1 | PASS |  |
| SF-TEN-009 | accepted +1 | PASS |  |
| SF-TEN-010 | accepted +1 | PASS |  |
| SF-TEN-011 | accepted +1 | PASS |  |
| SF-TEN-012 | accepted +1 | PASS |  |
| SF-TEN-013 | accepted +1 | PASS |  |
| SF-TEN-014 | accepted +1 | PASS |  |
| SF-TEN-015 | rewritten; accepted +1 | PASS |  |
| SF-TEN-016 | accepted +1 | PASS |  |
| SF-TEN-017 | rewritten; accepted +1 | PASS |  |
| SF-TEN-018 | accepted +1 | PASS |  |
| SF-TEN-019 | accepted +1 | PASS |  |
| SF-TEN-020 | accepted +1 | PASS |  |
| SF-SVA-001 | accepted +1 | PASS |  |
| SF-SVA-003 | altCategory don't→punctuation | REVISE | **REVISE (Major R1)**: remove `"altCategory": "punctuation"`; it contradicts curriculum rule 3 (the apostrophe is already right, so punctuation is not a defensible answer) |
| SF-SVA-004 | accepted +1 | PASS |  |
| SF-SVA-006 | accepted +1 | PASS |  |
| SF-SVA-009 | rewritten; hints | PASS |  |
| SF-SVA-012 | accepted +1 | PASS |  |
| SF-SVA-015 | hints | PASS |  |
| SF-HOM-004 | altCategory new→grammar | PASS |  |
| SF-HOM-005 | altCategory one→grammar | PASS |  |
| SF-HOM-007 | rewritten | PASS |  |
| SF-HOM-009 | accepted +1 | PASS |  |
| SF-HOM-011 | explanation | PASS |  |
| SF-HOM-013 | altCategory new→grammar, one→grammar | PASS |  |
| SF-HOM-014 | accepted +1; hints | PASS |  |
| SF-HOM-015 | rewritten; altCategory no→grammar; hints | PASS |  |
| SF-POS-001 | explanation; hints | PASS |  |
| SF-POS-003 | altCategory Its→spelling | PASS |  |
| SF-POS-005 | rewritten | PASS |  |
| SF-POS-007 | altCategory it's→spelling | PASS |  |
| SF-POS-013 | rewritten; hints | PASS |  |
| SF-POS-014 | altCategory its→spelling | PASS |  |
| SF-POS-015 | altCategory its→spelling; hints | PASS |  |
| SF-MIX-001 | rewritten; hints | PASS |  |
| SF-MIX-002 | accepted +1; hints | PASS |  |
| SF-MIX-003 | rewritten; hints | PASS |  |
| SF-MIX-004 | hints | PASS |  |
| SF-MIX-005 | accepted +1; hints | PASS |  |
| SF-MIX-006 | hints | PASS |  |
| SF-MIX-007 | accepted +1; hints | PASS |  |
| SF-MIX-008 | hints | PASS |  |
| SF-MIX-009 | accepted +1; explanation; hints | PASS |  |
| SF-MIX-010 | hints | PASS |  |
| SF-MIX-011 | accepted +1; hints | PASS |  |
| SF-MIX-012 | hints | PASS |  |
| SF-MIX-013 | rewritten; hints | PASS |  |
| SF-MIX-014 | accepted +1; hints | PASS |  |
| SF-MIX-015 | altCategory Its→spelling; hints | PASS |  |

Notes on the substantive rewrites, all PASS:
- **HOM-015:** "Sometimes it is still up there" is now accurate.
- **COM-015:** the Golden Gate Bridge did open on May 27, 1937. That was Pedestrian Day; cars crossed from May 28. The date fact repeats the earlier comma frame without reusing the moon landing.
- **MIX-013:** "after lunch" removes the Saturday/school contradiction.
- **POS-013:** "the coach's chair" now has only one reading.
- **MIX-001 and COM-014:** they no longer duplicate SPL-001 and COM-008.
- **SVA-009:** "Honeybees" makes the science accurate.
- **TEN-015:** "sits" removes the hidden agreement error.
- **Mixed-item hints:** hint 1 in every mixed item now uses the Lab category words.
- **Wording fixes:** "cannot", the gender-neutral hints and the circular explanation of "rode" are all fixed.

### 12.3 Accepted-answer consistency
The optional opening comma is now handled the same way across the bank. Every item whose sentence opens with an opening phrase or a short opening clause lists the comma-less form in `accepted` (51 items carry accepted answers in total). The bank test enforces this, and so do my 34 `OPTIONAL_INTRO` tests, all of which pass.

Commas that are taught stay required, and the engine still marks them incorrect when they are missing. These are commas after Yes/No/Well, after the name of the person spoken to, before a quotation, in dates, between city and state, and in lists.

Two policy notes, not defects:
- **COM-013, HOM-014, TEN-015:** the rule now also covers short opening *clauses* ("As we hurried out the door", "When the bell rang"). Chicago and AP style allow this, and the grade-3 standards do not teach introductory-clause commas, so it is acceptable.
- **Exclamation points:** "!" is accepted only where the sentence is a natural exclamation, and questions always need "?". This is consistent.

### 12.4 Thinking Lab: `altCategory` review (16 errors)

| Errors | Main / alt | Verdict |
|---|---|---|
| new→knew (HOM-004, HOM-013), one→won (HOM-005, HOM-013), no→know (HOM-015) | spelling / grammar | **Defensible.** The right word is a verb and the explanation talks about tense. |
| runing, stoped, carryed, hopeing (SPL-013, SPL-015, SPL-016, SPL-023 ×2) | spelling / grammar | **Defensible.** These are verb endings. The main category stays right under rule 2. |
| Its/it's (POS-003, POS-007, POS-014, POS-015, MIX-015) | punctuation / spelling | **Defensible.** Many classrooms teach its/it's as a homophone pair. |
| don't→doesn't (SVA-003) | grammar / **punctuation** | **Not defensible. Major R1.** The curriculum's own rule 3 says "don't → doesn't is grammar (agreement), not punctuation, because the apostrophe is already right." Accepting Punctuation rewards exactly the misconception rule 3 rules out, and the curriculum document now contradicts itself. **Fix:** delete `"altCategory": "punctuation"` from SF-SVA-003's error. Then change the curriculum's altCategory list to "15 places" and remove the SVA-003 bullet. The `todo` test `Lab: SF-SVA-003 … must not accept "punctuation"` will pass once this is done. |

Behaviour of `labAccepts()`, checked on all 150 items:
- The main category of every item is always accepted.
- A category that no error carries, as either its category or its altCategory, is never accepted.
- Made-up irregular past tenses such as "catched" stay Grammar only, as documented.
- An item with an altCategory also accepts "More than one type". For example, SPL-016 accepts it if the child files "carryed" under Grammar and "togeather" under Spelling. That is logically consistent.

One Minor consistency point (m-R2): POS-006 "Were → We're" is a real-word pair just like Its/It's, but it has no `altCategory: "spelling"`. This is optional; add it for consistency or leave it as it is.

### 12.5 Grading engine: re-test

**First-audit defects E1–E9 are all fixed.** All 66 former `todo` tests now pass as ordinary tests:
- E1: "cannot" and "were" go to review or correct, never incorrect.
- E2: "!" is handled the same way on every item.
- E3: optional commas are handled.
- E4 and E5: a missing end mark and "." for "?" inside quotes are now incorrect.
- E6: goed, swimed, finded, catch, teach, knowed, am, There's, "they're" for "their" and "no" for "knew" are all incorrect.
- E7: misplaced added commas are incorrect.
- E8: "Mr Patel" and "March, 4" are incorrect.
- E9: "a hour" is incorrect.

**Fresh answers (88), with nothing marked wrongly:**
- **No invalid answer is marked correct.** "Correct" still requires an exact match with the key or an accepted answer.
- **No valid answer is marked incorrect.** Every unlisted valid alternative went to review or correct: "cannot" in POS-001, POS-015 and MIX-009; "It is", "will not", "is not", "didn't"; "ocean", "got", "feed it"; past-tense rewrites of SVA-015 and SVA-002; "Tucson, AZ"; "!" for "."; and opening commas left out.
- The typical third-grade mistakes are all incorrect:
  - over-regularized verbs: blewed, ated, caughted, swum, eated, sended, sitted;
  - wrong homophones: rite, they're, "They're are", dear, you're;
  - added commas: "planted, beans", "and, Omar", "and, boxes", "house, in", "San Francisco,";
  - a misplaced date comma: "May, 27";
  - a/an slips;
  - British spellings: colours, favourite;
  - "?" outside the quotation marks, a missing comma before a quotation, "his Dad";
  - over-capitalization: Sister, Winter, Report, golden gate bridge;
  - "fox's" or "coaches'" where the sentence fixes the number.

**SF-POS-013 decision.** The key is now "the coach's chair". The sentence fixes the number at one chair, so one coach. I therefore keep **incorrect** for both "coaches' chair" and "coaches' chairs". This matches how "fox's den" is treated in POS-015, and "chairs" also changes a word the child was not asked to fix. The test is now a normal assertion.

**Remaining engine findings, all Minor.** Each is a clearly wrong answer sent to a grown-up for review rather than marked incorrect. None marks a valid answer wrong. Each is a `todo` in `RE_CASES`.

| # | Case | Engine says | Should be |
|---|---|---|---|
| e-R1 | SVA-003 "dosent" (misspelling 3+ letters from "doesn't") | review | incorrect |
| e-R2 | CAP-015 appositive commas dropped ("team the Hilltop Hawks won"); POS-011 tag-question comma dropped ("penny isn't it?") | review | incorrect. Compound-sentence commas dropped (MIX-006, SPL-025) also go to review, which is defensible because style guides allow it in short compounds. |
| e-R3 | HOM-006, HOM-011: "are" for "our" in an untouched word | review | incorrect |
| e-R4 | END-010 "open?."; POS-011 "is not it?" | review | incorrect |
| e-R5 | HOM-014 "fresh pears, and peaches" (comma before *and* with only two items) | review | incorrect |

Suggested low-risk fixes:
- e-R1: allow distance 3 when the word is 6 letters or longer and shares its first letter.
- e-R2: treat a dropped comma as clear when the model has a pair of commas around a phrase that starts with "the" or a name, or before a tag question (", isn't it?", ", don't you?").
- e-R3: a small list of confusable function words (are/our, then/than, of/off, were/where), with a swap counting as clear.
- e-R4: two end marks in a row other than "?!" count as clear.
- e-R5: `commaAllowed` before *and* should require at least two earlier list commas.

### 12.6 Test output
`node --test tests/unit/sentencefix-grading-audit.test.mjs` gives `tests 389, pass 381, fail 0, todo 8` before the R1 fix. After commit 42bebc6 it gives `tests 389, pass 382, fail 0, todo 7`: the SVA-003 Lab check now passes as a normal assertion. `sentencefix-bank.test.mjs` gives 13/13.

The 8 `todo` tests are e-R1 to e-R5 (7 cases) and the SVA-003 altCategory check (R1). Every `todo` assertion currently fails, which confirms each finding is real. No todo passes by accident. `sentencefix-bank.test.mjs` (13/13) and `sentencefix-engine.test.mjs` (30/30) also pass.

### 12.7 FINAL VERDICT
- **Content bank: APPROVED. All 150 items PASS** with no Critical or Major issue. R1 was fixed in commit 42bebc6, and I verified the fix. The bank diff removes only `"altCategory": "punctuation"` from SF-SVA-003 and changes nothing else. The bank now has 15 `altCategory` fields, matching the curriculum, which says "15 places" and no longer lists SVA-003. The Lab test confirms SVA-003 no longer accepts Punctuation. Minor m-R2 (adding `altCategory: "spelling"` to POS-006 "Were → We're") stays optional and does not block approval.
- **Grading engine: APPROVED.** No Critical or Major defects remain. E1–E9 are fixed and verified. No invalid answer is marked correct, and no valid answer is marked incorrect. The five Minor leftovers (e-R1 to e-R5) only send clearly wrong answers to review, and they can be scheduled as polish.

---

## 13. Engine follow-up (commit 0913ea4: fixes for e-R1 to e-R5)

**This section supersedes the engine verdict in 12.7.**

**Method.** I wrote 43 fresh answers of my own, without reusing the engine agent's tests: 32 valid answers that stress the new rules and 11 wrong ones. They are in the `FOLLOWUP` cases in `tests/unit/sentencefix-grading-audit.test.mjs`. To tell new behaviour from old, I graded the same answers with the engine as it was just before 0913ea4 (`0913ea4~1`).

**What works.** All five Minor findings are now graded **incorrect**:
- e-R1: "dosent", "exsighted";
- e-R2: a dropped appositive comma or tag-question comma;
- e-R3: "our"/"than"/"off" in place of "are"/"then"/"of";
- e-R4: "?.", "??", "?!", "is not it?";
- e-R5: "pears, and peaches".

None of the new rules wrongly catches these valid answers:
- **Tag questions** written another way ("…, is it not?", "…, right?", "Is that not amazing?") go to review.
- **Kept appositives** with other words changed go to review.
- **Oxford commas in new lists** ("pears, apples, and peaches", "milk, eggs, and two loaves") go to review.
- **", and" + a short clause** ("…, and I can hang it up", "…, and we found a smooth rock") goes to review.
- **Dropped optional compound commas** go to review.
- **Confusable words used correctly elsewhere** (to/too/two, "of them", "there") go to review.
- **"!" endings** go to review.

All 11 wrong answers are **incorrect** except one, a Minor leftover (see below).

### Critical: valid answers now marked incorrect
- **F-1 (introduced by 0913ea4).** The new e-R1 rule in `wrongWord()` marks a word in a mistake's slot as a misspelling when it has 6+ letters, the same first letter, is at most 3 edits away, and is not in `REAL_WORDS`. `REAL_WORDS` is a short list, so real words that are correct in context now count as misspellings. All four of these were **review** before 0913ea4 and are **incorrect** now:
  - SF-SPL-013 "Diego was **racing** so fast…" (racing/running, distance 3)
  - SF-SPL-019 "…hiding under the **benches** near our tent." (benches/bushes, distance 3)
  - SF-SPL-010 "…a **lively** crab in the sand." (lively/little, distance 3)
  - SF-SPL-025 "…people who are **wanting** to help…" (wanting/willing, distance 3)

  **Fix:** apply the distance-3 rule only when the typed word is *not* a dictionary word. Use a word list for that check (for example a common-English list of about 10,000 words, shipped as JSON), not `REAL_WORDS`. Otherwise, apply it only when the typed word shares the key's ending, as with "dosent"/"doesn't".
- **F-2 (pre-existing).** A real word 1–2 letters from a model word is graded as a misspelling. Examples: SF-TEN-008 "we **placed** seeds…" (placed/planted, in the mistake's slot) and SF-HOM-005 "…threw their **hats** in the air" (hats/caps, an untouched word). The same dictionary check fixes this: a typed real word becomes "different-word", which goes to review.
- **F-3 (pre-existing).** Words dropped in a valid rewrite are a clear "dropped" mistake. Example: SF-SVA-010 "…Jin wins most games." (the key has "most of the games"). Treat a dropped *function word* (of, the, a, that) as not clear when the rest of the sentence is unchanged.

### Minor
- **F-4.** SF-HOM-006 "We mixed flour, and water to make clay…" still goes to **review**. The e-R5 fix allows a comma before *and* whenever 3 or more words follow, so a comma joining only two nouns slips through when a long phrase comes after.

### Tests
`node --test tests/unit/sentencefix-grading-audit.test.mjs` gives `tests 453, pass 445, fail 0, todo 8`. The 8 todos are F-1 (4 cases), F-2 (2), F-3 (1) and F-4 (1). Each one currently fails, so each is a real defect. I did not change `engine.js` or `bank.json`.

### Engine verdict
**Grading engine: NOT APPROVED.**
- F-1 is a regression introduced by 0913ea4: valid answers that were review are now marked incorrect.
- F-2 and F-3 are older Critical cases of the same kind. My earlier tests did not exercise them.

The rest of 0913ea4 is sound. The engine can be approved once F-1 to F-3 are fixed and these 7 todo tests pass. F-4 is optional polish.

---

## 14. Final engine re-check (commit 82020b0: word list, number, plural/possessive, apostrophe and comma rules)

**This section supersedes the engine verdict in section 13.**

**Method.** I wrote 52 fresh answers of my own, without reusing the engine agent's tests: 32 valid and 20 wrong. They are in the `FINAL` cases in `tests/unit/sentencefix-grading-audit.test.mjs`. To tell new behaviour from old, I compared every result with the engine as it was just before 82020b0.

**F-1 to F-4 are fixed.** Real-word synonyms in a mistake's slot now go to review, both those from section 13 ("racing", "benches", "lively") and new ones ("hiked", "headed", "crayons", "eager … gifts", "lovely", "liquid", "new book"). So do synonyms elsewhere ("sticks", "trophy", "quiz", "truck", "pictures", "use"), a kept possessive or contraction with other words changed, ", and" before a second verb or a new clause, and a few small words added.

Wrong answers that are still correctly graded incorrect:
- homophones: buy/by, maid/made, eight/ate, hour/our, peace/piece;
- "orange, and black";
- "player have" and "two pencil";
- "Mias";
- "bike's".

### Critical: valid answers marked incorrect
None of these was caused by 82020b0. The new "number" and plural/possessive rules **keep** them incorrect on purpose, where a word-list check would have sent them to review.

| Case | Answer (valid English) | Why it is valid |
|---|---|---|
| **G-1** | SVA-008 "…and the **dog barks** at her." / SVA-007 "…their **cows give** lots of milk." / SPL-012 "…the **stores close** in ten minutes." | The noun and verb change number together, so the sentence is a deliberate, grammatical rewrite. |
| **G-2** | CAP-002 "…for the **neighbor**." / TEN-012 "…in the **tree**." / END-002 "…on the maple **trees**…" / POS-002 "…by the **doors**." | The number of a word the child was not asked to fix has changed. The sentence is still valid, and other real-word swaps already go to review. |
| **G-3** | SPL-019 "…hiding under the **bush** near our tent." | This is the plural-spelling mistake's own slot. The child avoided the -es rule, but the sentence is valid. |
| **G-4** | CAP-015 "My **brothers'** team, the Hilltop Hawks, …" | A valid plural possessive of a word that had no mistake (two brothers can share a team). |
| **G-5** | SVA-006 "…an insect has **just** six." | A synonym swap that also moves a word. "only" is not in `SMALL_WORDS`, so dropping it counts as a clear mistake. This one is older behaviour. |

**Fixes:**
- **G-1:** if a changed noun number comes with the matching verb-agreement change in the same clause, or the changed noun has no verb that agrees with it, treat it as a rewrite (review).
- **G-2:** this is an **owner decision**.
  - If changing the number of an untouched noun counts as a copying mistake, keep "incorrect" and close G-2.
  - If not, send it to review, as other real-word swaps already are.

  Note that the engine is currently inconsistent here. "tree"→"trees" (1 letter, real word) is incorrect, but "dinner"→"diner" (1 letter, real word) is review.
- **G-3:** in the slot, a real singular form of the key's noun should go to review.
- **G-4:** apply the plural/possessive rule only to the mistake's own words, or when the possessive is not a real possessive of the same noun.
- **G-5:** add "only" (and "just") to `SMALL_WORDS`, and treat a hunk that both drops and adds words as a rewrite.

### Major: clearly wrong answers now sent to review
- **G-6, a trade-off of the word-list rule:** real-word misspellings were incorrect before 82020b0 and are now review. Examples: "for **diner**" (dinner), "My **fiend** Jamal" (friend), "really **tied**" (tired), "birthday **presence**" (presents), "We **waked**" (walked), "on the **bored**" (board).

  Fix: a short list of common confusable real-word misspellings, treated like `KNOWN_MISSPELLINGS`, with pairs such as dinner/diner, friend/fiend, tired/tied, presents/presence, board/bored and walked/waked. Alternatively, merge these into the confusable groups.
- **G-7:** a comma that joins just two nouns before "and" followed by a/the/two is read as starting a new clause, so the answer goes to review. Examples: "the tape, and the scissors" (COM-002, incorrect before 82020b0), "milk, and two loaves", "a starfish, and two tiny crabs".

  Fix: after "and", require a verb within the next few words before calling it a clause.

### Minor
- **G-8, by design:** dropping "the" ungrammatically ("We walked to science museum") goes to review.

### Tests
`node --test tests/unit/sentencefix-grading-audit.test.mjs` gives `tests 520, pass 500, fail 0, todo 20`. I ran it on its own, one suite at a time. The 20 todos are:
- G-1: 3 cases
- G-2: 4 cases
- G-3, G-4, G-5: 1 case each
- G-6: 6 cases
- G-7: 3 cases
- G-8: 1 case

Every todo currently fails, so each one is a real finding. I did not change `engine.js` or `bank.json`.

### FINAL VERDICTS
- **Content bank: APPROVED.** All 150 items pass, with no Critical or Major findings (section 12.7). Nothing in this engine round changes the content verdict.
- **Grading engine: NOT APPROVED.** Valid answers are still marked incorrect:
  - **G-1:** a deliberate singular/plural rewrite with the matching verb;
  - **G-3:** "bush" in the plural mistake's slot;
  - **G-4:** "brothers'";
  - **G-5:** "has just six".
  - **G-2 is an owner decision:** either confirm that a changed noun number is a copying mistake, or send it to review.

  The engine can be approved once G-1, G-3, G-4 and G-5 are fixed and G-2 is either decided by the owner or fixed. G-6 and G-7 (Major) should also be fixed, because they reverse correct "incorrect" results that worked before. Nothing grades an invalid answer as correct, because "correct" still requires an exact match with the key or an accepted answer.

---

## 15. Last engine check (commit b4c62a8: numberBreaks, coordinatedNumber, possessive number, REAL_WORD_TYPOS, nounPhraseOnly)

**This section supersedes the engine verdict in section 14.**

**Method.** I wrote 53 fresh answers of my own, without reusing the engine agent's tests: 28 valid and 25 wrong. They are in the `LAST` cases in `tests/unit/sentencefix-grading-audit.test.mjs`. To tell new behaviour from old, I compared every result with the engine as it was just before b4c62a8.

**G-1 to G-7 are fixed, and the lead's G-2 decision is applied.** All of these valid answers go to review:
- **Number changes:**
  - a word that was not a mistake: "a baby fox was", "his friend", "our shadow", "the magnet", "a thank-you letter", "a little chalkboard", "a peach", "a turkey", "my cousins Jada and Kim";
  - an added or removed "a": "told a story".
- **Possessive number switches:** "my aunts' house", "the hallways".
- **Dropped small words:** "too", "only", "so".
- **Added words:** "best", "please".
- **", and" + a second verb:** "…clothes, and grew…", "…beach, and stayed…".

These wrong answers are still incorrect:
- **Number slips that break agreement:** "Many year ago", "The two bird", "The robin are", "planted bean".
- **"Mr. Parks'"** (a name) and **"photo's"**.
- **Two-item ", and" commas:** "shell, and a little crab", "pencils, and an eraser", "twigs, and grass".
- **"beech"**, which is on the typo list.
- **Planted mistakes left in place:** "freind", "foxes den", "were" for where.

### Critical: valid answers marked incorrect (both are older behaviour)
- **H-1: agreement fixed from the subject side.** The child makes the sentence agree by changing the *subject* and leaves the planted verb as it was. The sentence is fully valid, but the kept verb counts as "unfixed", so the answer is incorrect. Examples:
  - SVA-002 "Look! The **robin is** building a nest in our tree."
  - SVA-004 "Our **player has** new jerseys this year."
  - SVA-014 "…but **hawks hunt** during the day…"
  - SVA-010 "…and **they win** most of the games."
  - SVA-009 "…and **all bees have** a special job…"
  - SVA-005 "…the **book** in our library **is** for everyone."

  This is the same principle as the lead's G-2 decision: a grammatically valid change to a word the child wasn't asked to fix should go to review.

  **Fix:** in a grammar (agreement) slot where the planted verb is unchanged, check the typed subject just before it. If the subject's number or pronoun changed and the subject and verb now agree, mark the mistake "unknown", which leads to review.

  **Lead decision option:** if the lead rules that in subject-verb items the verb itself must be corrected, these can stay incorrect. In that case the explanation shown to the child should say so.
- **H-2: HOM-009 "…across the **seas**."** This is the plural of the homophone fix, and it is valid. The stem rule calls it a wrong verb form. **Fix:** in a homophone slot, the -s/-es form of the key should be judged by `numberBreaks`, like other number changes.

### Major: clearly wrong answers sent to review
- **H-3 (regression in b4c62a8).** If the child changes a noun's number so it no longer agrees with the unchanged verb right after it, the answer now goes to review. These were incorrect before b4c62a8:
  - SVA-008 "the **dog bark** at her"
  - SVA-007 "their **cows gives**"
  - SPL-012 "the **store close**"

  `numberBreaks` only looks at helper verbs (is/are/has/have…). **Fix:** if the next typed word is the key's own verb, unchanged, and it agreed with the key's noun, then changing the noun's number alone breaks agreement and should be marked `number`, so the answer is incorrect. This is the mirror case of `coordinatedNumber`.
- **H-4 (older behaviour).** A comma before "and" between two names goes to review. Examples: SVA-001 "**Maya, and Leo** are…" and CAP-012 "…with **Uncle Ray, and Aunt Bea**." **Fix:** after ", and", a capitalized name followed by a plural verb, a preposition or the end of the sentence is one more item, not a new clause.

### Minor (these go to a grown-up for review; no valid answer is marked wrong)
- **H-5:** "two **loaf**". Irregular plurals (loaf/loaves, leaf/leaves) are not -s/-es pairs.
- **H-6:** "Please don't forget **bring**…". The child left out the fix word "to".
- **H-7:** real-word or informal misspellings that are not on any list: "tipped" for tripped, "soap" for soup, "tonite". Consider adding tonite, nite, lite and thru to `KNOWN_MISSPELLINGS`.
- **H-8:** a stray ", and." at the end.
- **G-8, by design:** a dropped "the".

### Tests
`node --test tests/unit/sentencefix-grading-audit.test.mjs` gives `tests 579, pass 560, fail 0, todo 19`. I ran it on its own. The 19 todos are:
- H-1: 6 cases
- H-2: 1 case
- H-3: 3 cases
- H-4: 2 cases
- H-5 and H-6: 1 case each
- H-7: 3 cases
- H-8: 1 case
- G-8: 1 case

Every todo currently fails, so each one is a real finding. I did not change `engine.js` or `bank.json`.

### FINAL VERDICTS
- **Content bank: APPROVED.** All 150 items pass, with no Critical or Major findings (section 12.7).
- **Grading engine: NOT APPROVED.**
  - **Critical:** H-1 (agreement fixed from the subject side) and H-2 ("seas") mark valid answers incorrect. Both are older behaviour. H-1 needs either the fix above or an explicit lead decision.
  - **Major:** H-3 (b4c62a8 made "the dog bark", "their cows gives" and "the store close" go to review instead of incorrect) and H-4 (a comma between two names).

  Once H-1 to H-4 are resolved, the engine meets the approval bar. H-5 to H-8 and G-8 are Minor and can stay as todos. No invalid answer is ever graded correct.

---

## 16. Closing engine check (commit cd4c542: subject look-back, extended numberBreaks, irregular plurals, name commas, dropped "to", stray conjunctions)

**This section supersedes the engine verdict in section 15.**

**Method.** I wrote 50 fresh answers of my own, without reusing anyone else's tests: 32 valid and 18 wrong. They are in the `CLOSING` cases in `tests/unit/sentencefix-grading-audit.test.mjs`. To tell new behaviour from old, I compared every result with the engine as it was just before cd4c542.

**The risk the engine agent flagged ("the store close" rule on a compound noun after "the") does not misfire.** All of these valid answers go to review:
- "The leaf on the maple tree turns red"
- "The old tool in our museum shows how…"
- "blew the leaf across the yard"
- "planted a seed in a cup"
- "under a bush"
- "build their nest"
- "watch the fireworks over…"

The bank has no key in which a plural noun comes after a noun used as a describing word and before a preposition, except where an excluded word guards it (*thank-you*, *their*, *little*, *old*). So the rule's exclusions hold for the bank as it stands.

**H-1 to H-8 are fixed.** These valid answers go to review:
- **Agreement fixed from the subject side:** "A robin is", "hawks hunt", "the dog barks", "their cows give", "Jin plays tennis with his brother", "Mr. Park's student takes", "My brother is", "all of them have".
- **Irregular plurals:** "a loaf of bread", "the children", "kids".
- **"to" variants:** "don't forget your lunch", "remember to bring", "mixed … and made", "went into the market".
- **"and then":** "…, and then Omar can hang it up".

These wrong answers are incorrect: "each bees has", "childs", "Kai, and Noah", "The mail carrier come", "water make clay", "came back on and.", "two brother bikes".

### Critical: valid answers marked incorrect
- **K-1 (introduced by cd4c542).** The stray-conjunction rule treats "so" and "yet" at the end of a sentence as left-over words. These valid answers are marked incorrect:
  - SPL-012 "…in ten minutes **or so**."
  - END-010 "…Is it open **yet**?"
  - END-001 "Did you finish your spelling homework **yet**?"

  All three were review before cd4c542. **Fix:** apply the rule only to *and*, *but*, *or* and *nor*, and not to "or so".
- **K-2 (older behaviour; H-1 is not fully covered).** The child changes the subject to a collective or other singular noun, so the kept verb now agrees, but the verb still counts as unfixed:
  - SVA-004 "Our **team has** new jerseys."
  - SVA-012 "Mr. Park's **class takes**…"
  - SVA-015 "My **family is** cleaning…"
  - SVA-012 "**each of** Mr. Park's students **takes**…"

  In the last example, `subjectNumber`'s look-back stops at the period in "Mr.".

  **Fix:**
  - Skip title periods (Mr., Mrs., Ms., Dr.) in the look-back.
  - Treat "each/one/every … of" as singular.
  - When the typed subject contains a new noun that is not a number variant, and nothing marks it as plural (no plural determiner, no "and", no pronoun like "they"), mark the planted verb "unknown", so the answer goes to review.
- **K-3 (older behaviour, rare).** MIX-010 "…painting their **posters**." The missing period goes on "poster", so that word is a mistake's slot, and a number change there is judged as a wrong verb form. **Fix:** for a missing-mark mistake (where `right` is `wrong` plus a mark), judge the word itself like a word that was not a mistake.

### Major: clearly wrong answers sent to review
- **K-4 (introduced by cd4c542).** The look-back stops at "and", so a compound subject reads as singular, and these clear agreement errors now go to review. All three were incorrect before cd4c542:
  - SVA-001 "Maya **and a friend is**…"
  - SVA-015 "My brother **and a friend is**…"
  - SVA-010 "Jin **and a friend plays**…"

  **Fix:** if the look-back stops at "and" and there is a noun, name or pronoun before the "and", treat the subject as plural.

### Minor (these go to a grown-up for review; no valid answer is affected)
- **K-5, older behaviour:** number clashes that are not next to the noun: "**A** baby **foxes**", "**two** tiny **crab**", "tool … **show**", "children **walks**".
- **K-6:** wrong plurals that are also real verbs: "leafs", "loafs".
- **K-7:** "My grandma**, and I** baked…". The name-comma rule skips "I".
- **G-8, by design:** a dropped "the".

### Tests
`node --test tests/unit/sentencefix-grading-audit.test.mjs` gives `tests 637, pass 618, fail 0, todo 19`. I ran it on its own. The 19 todos are:
- K-1: 3 cases
- K-2: 4 cases
- K-3: 1 case
- K-4: 3 cases
- K-5: 4 cases
- K-6: 2 cases
- K-7: 1 case
- G-8: 1 case

Every todo currently fails, so each one is a real finding. I did not change `engine.js` or `bank.json`.

### FINAL VERDICTS
- **Content bank: APPROVED.** All 150 items pass, with no Critical or Major findings (section 12.7).
- **Grading engine: NOT APPROVED.**
  - **Critical:** K-1 ("or so" and "yet" marked incorrect; new in cd4c542), K-2 (subject changed to a collective or singular noun, so the kept verb now agrees, but the answer is still incorrect), and K-3 ("their posters").
  - **Major:** K-4 ("X and a friend is" now goes to review; new in cd4c542).

  The fixes are small and local. Once K-1 to K-4 are resolved and these 11 todo tests pass, only Minor review-direction items will remain (K-5, K-6, K-7, G-8). That meets the approval bar.

---

## 17. Verification check (commit ca3ca1d: K-1 to K-7)

**This section supersedes the engine verdict in section 16.**

**K-1 to K-4 are confirmed fixed.** All 11 of my section 16 todo cases now pass as normal assertions:
- "or so" and "yet" at the end of a sentence;
- the collective and title subjects ("Our team has", "Mr. Park's class takes", "My family is", "each of Mr. Park's students takes");
- "their posters";
- "X and a friend is/plays".

K-5 is 3 of 4 fixed, and K-6 and K-7 are fixed. "The old tool in our museum show…" stays a Minor todo, as the engine agent noted.

**Method.** I wrote 44 fresh answers of my own, without reusing anyone else's tests: 29 valid and 15 wrong. They are in the `VERIFY` cases in `tests/unit/sentencefix-grading-audit.test.mjs`, and they target the newest rules. I compared every Critical case with the engine as it was just before ca3ca1d.

**What works.** These valid answers go to review:
- **Subject look-back:** "Mrs. Park's class takes", "each one of Mr. Park's students takes", "every student in Mr. Park's class takes", "none of … takes", "Our soccer team has", "Our coach has", "My big brother is", "My brother Sam is", "Everyone is", "The mother robin is", "A pair of robins is", "the bees have".
- **Compound subjects with "and":** "Jin and Sam win", "The mail carrier and her dog come", "hawks and eagles hunt", "each of them has".
- **"a/an/one + plural" and "number + describing word":** "A pair of baby foxes were", "A few baby foxes were", "two tiny hermit crabs", "two new books", "the old maple tree", "the dry leaves", "two loaves".
- **Number changes after a determiner in a slot that only lacked an end mark:** "in the parks", "under the rocks".

These wrong answers are incorrect: "Jin and his brother play tennis and Jin win" and "…a farm and their cow give" (both with the comma dropped), "The two robins is", "Our players and coach has", "A baby foxes was", "the parks" with no end mark, "the books … is", "leafs" (×2), "the children walks", "three tiny crab".

**"wolfs" and other words in the scoped typo list.** That list is keyed to the key word, so "wolfs" is only flagged where the key itself says "wolves". No item has "wolves", so a valid "the dog wolfs his food" can never be flagged. The same applies to "leafs" and "loafs". Scoping protects the verb meanings.

**K-7 rule ("My X, and I").** In theory it could also catch a valid "My brother runs, and I walk.", but no key in the bank has that shape. It is not reachable today. Note it in case new items are added.

### Critical: valid answers marked incorrect (both are older behaviour and narrow)
- **L-1.** MIX-001 "My sister Ava used bright colors in **art classes**." This is a valid number change of the word that only lacked its end mark. The K-3 fix applies only when the/their/our… comes right before the word, so here the word is still judged as a wrong form.

  **Fix:** for a slot where `right` is `wrong` plus an end mark, judge a number change of the word with `numberBreaks`, whatever the word before it is. That follows the lead's G-2 decision.
- **L-2.** HOM-002 "I have **one pencil** and an eraser in my desk." is marked incorrect, while "I have **a pencil**…" goes to review. Both are valid. This is the "to"→"two" slot, and the G-3 precedent ("bush" in the plural slot) says review.

  **Fix:** treat "one" the same as "a/an" when the following noun becomes singular.

### Minor (review direction only)
- "**Everyone are** cleaning…"
- "The **robins family** is…"
- "two **loafs**" in words the child added
- SVA-013 "tool … **show**"
- G-8: a dropped "the" (by design)

### Tests
`node --test tests/unit/sentencefix-grading-audit.test.mjs` gives `tests 687, pass 680, fail 0, todo 7`. I ran it on its own. The 7 todos are L-1, L-2, the three Minor cases above, SVA-013 and G-8. Every todo currently fails, so each one is a real finding. I did not change `engine.js` or `bank.json`.

### FINAL VERDICTS
- **Content bank: APPROVED.** All 150 items pass, with no Critical or Major findings (section 12.7).
- **Grading engine: NOT APPROVED, but close.** No Major issue remains, and none was introduced by ca3ca1d. Two narrow, older Critical cases remain: L-1 ("in art classes.") and L-2 ("one pencil"). Each is a one-line rule change.

  Once L-1 and L-2 pass, only Minor review-direction items will remain, and the engine is **APPROVED** by the agreed bar. The lead may instead decide that these two answers can be graded incorrect, as an explicit decision like G-2. In that case the engine is **APPROVED** as it stands at ca3ca1d.

---

## 18. Final verdict check (commit fd0a87b: L-1, L-2 and the newest rules)

**This section supersedes the engine verdict in section 17.**

**L-1 and L-2 are confirmed fixed.** "in art classes." and "one pencil" go to review. "Everyone are" and the child-added "two loafs" are now incorrect.

**Method.** I wrote 34 fresh answers of my own, without reusing anyone else's tests: 27 valid and 7 wrong. They are in the `VERDICT` cases in `tests/unit/sentencefix-grading-audit.test.mjs`. I compared every Critical case with the engine as it was just before fd0a87b.

**The new "certain-only" rules do not misfire.** These valid look-alikes all go to review:
- **a/an + describing word + plural:** "under a few rocks", "a few pieces of shell", "a lot of shells", "a great many tiny crabs", "a few cards", "a few fresh pears", "a few flashlights".
- **Indefinite pronoun + have/do:** "Does anyone have chairs?", "Did everyone have their … homework?"
- **does/can/will + pronoun + verb:** "Does it open soon?", "How many laps can it swim…?"
- **very + describing word:** "turn very red".
- **Number words with a plural:** "two loaves of fresh bread", "some bushes", "two parks".
- **Subjects:** "Everyone in my family is", "Everyone on our team has", "Someone is", "the whole class takes", "each book … is", "every book … is", "every one of them has".

These wrong answers are incorrect: "does it opens", "Everybody are", "Nobody are".

### Critical: valid answers marked incorrect (older behaviour; the K-2 fix is incomplete)
- **M-1.** The new subject is followed by an *of/in* phrase, and the planted singular verb is kept. These are valid answers, but they are marked incorrect:
  - SVA-005 "…that **everything in our library is** for everyone."
  - SVA-005 "…that **the collection in our library is** for everyone."
  - SVA-002 "Look! **The family of robins is** building a nest…"

  They were incorrect before fd0a87b too. The cause is that `subjectNumber` takes the last word before the verb ("library", "robins") as the head of the subject.

  **Fix:**
  - Take the head as the last word before the first preposition (of/in/on/at…) in the look-back.
  - Count everyone, everything, someone, nothing and the like (the `ONE_PERSON` words) as one thing.

  Similar subjects with "each/every" before the noun ("each book in our library is") already work.

### Minor (review direction only)
- "**a tiny crabs**" (the number word was changed to "a" and the noun kept plural)
- "**three loafs**" in the mistake's own spot
- "for **breakfasts**." (a known side effect of the L-1 fix)
- "very **tireds**"
- SVA-013 "tool … **show**"
- SVA-002 "The **robins family** is"
- G-8: a dropped "the" (by design)

### Tests
`node --test tests/unit/sentencefix-grading-audit.test.mjs` gives `tests 722, pass 712, fail 0, todo 10`. I ran it on its own. The 10 todos are M-1 (3 cases) and the 7 Minor cases above. Every todo currently fails, so each one is a real finding. I did not change `engine.js` or `bank.json`.

### FINAL VERDICTS
- **Content bank: APPROVED.** All 150 items pass, with no Critical or Major findings (section 12.7).
- **Grading engine: NOT APPROVED, one narrow issue left.** No Major issue remains, and nothing in fd0a87b caused a problem. The only Critical item is M-1: a new subject followed by an *of/in* phrase, with the planted verb kept, is marked incorrect even though the sentence is valid. M-1 is older behaviour and needs a small change to how `subjectNumber` finds the subject.

  When M-1's 3 todo tests pass, only Minor review-direction items will remain, and the grading engine is **APPROVED**.

---

## 19. Safety-net check (commit f304309: M-1 and the "changed subject + kept verb" safety net)

**This section supersedes the engine verdict in section 18.**

**M-1 is confirmed fixed.** "everything in our library is", "the collection in our library is" and "The family of robins is" all go to review.

**Method.** I wrote 23 fresh answers of my own, without reusing anyone else's tests: 12 valid and 11 wrong. They are in the `NET` cases in `tests/unit/sentencefix-grading-audit.test.mjs`, and they probe the safety net in both directions. I compared every result with the engine as it was just before f304309.

**What works.**
- These valid answers go to review: "Each of our players has", "one of the dogs barks", "the pair of dogs barks", "A flock of robins is", "Mr. Park's class of students takes", "My brother Max is", "every bee in the hive has".
- These certain disagreements are incorrect: "Those robins is", "the two dogs barks", "They plays", "each of the bees have", "Jin and Sam plays".

### Critical: valid answers marked incorrect (older behaviour, narrow)
- **N-1.** Subjects joined by "or" or "nor" take the verb of the nearest noun, so these sentences are valid:
  - SVA-001 "**Maya or Leo is** in the same reading group."
  - SVA-001 "**Neither Maya nor Leo is** in the same reading group."

  The engine treats them like an "and" compound, so they are marked incorrect.

  **Fix:** count only "and" (not "or" or "nor") as a compound when deciding that a subject is certainly plural. Otherwise, let "or"/"nor" fall through to review.

### Major: clearly wrong answers sent to review (regression in f304309)
- **N-2.** The child keeps the key's own **plural** noun unchanged and only adds a describing word or determiner. The disagreement is certain, but the safety net now sends these to review. All five were incorrect before f304309:
  - SVA-004 "Our **new players has**…"
  - SVA-015 "My **older brothers is**…"
  - SVA-002 "The **baby robins is**…"
  - SVA-002 "**Some robins is**…"
  - SVA-005 "the **books on the shelves** in our library **is**…"

  **Fix:** add "the head noun is the key's own noun, unchanged" to the list of certain cases (that noun's number is known from the key). Also count "both" and "some + plural noun" as certainly plural. "both bees has" goes to review and was already like that before f304309.

### Minor (review direction only, unchanged)
- "a tiny crabs"
- "for breakfasts."
- "very tireds"
- SVA-013 "tool … show"
- "The robins family is"
- G-8: a dropped "the" (by design)

### Tests
`node --test tests/unit/sentencefix-grading-audit.test.mjs` gives `tests 745, pass 731, fail 0, todo 14`. I ran it on its own. The 14 todos are:
- N-1: 2 cases
- N-2: 5 cases
- "both bees has": 1 case
- the 6 Minor cases above

Every todo currently fails, so each one is a real finding. I did not change `engine.js` or `bank.json`.

### FINAL VERDICTS
- **Content bank: APPROVED.** All 150 items pass, with no Critical or Major findings (section 12.7).
- **Grading engine: NOT APPROVED.**
  - **Major, new in f304309:** N-2. The safety net sends clear agreement errors with the key's own plural noun to review.
  - **Critical, older and narrow:** N-1 ("Maya or Leo is").

  Both fixes are local to the safety net. One adds "key noun unchanged", "both" and "some + plural" as certain cases. The other stops treating "or"/"nor" as "and". When the 8 todo tests for N-1, N-2 and "both" pass, only Minor review-direction items will remain, and the grading engine is **APPROVED**.
