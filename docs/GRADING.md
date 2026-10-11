# Grading rules

All grading is deterministic and happens in the browser (`js/model.js`, `js/vocab.js`).

## Typed answers (spelling, and "Write the word")
1. Unicode is normalised (NFC). Curly apostrophes/quotes become straight ones.
2. Leading and trailing spaces are removed; runs of spaces inside the answer become one space.
3. Capital letters are ignored.
4. Everything else must match exactly: every letter, in order. A missing, extra or swapped letter is wrong.
5. Nothing is auto-corrected. A blank answer is always wrong.

Examples for "stepped": `stepped`, ` Stepped `, `STEPPED` are right; `steped`, `stepped.`, `step ped`, `stepd` are wrong.

## Multiple choice (choose the meaning, choose the word, fill in the blank)
- Exactly one option is right. Distractors never have the same word or the same definition (compared ignoring case and punctuation) as the right answer, and never repeat each other.
- Fill in the blank never offers a word that already appears in the sentence.
- An unanswered question is wrong.

## Matching
- Each word is one point. A word is right when the chosen definition is the word's approved definition (identical definitions are interchangeable).

## Two words with the same definition
- Multiple choice never shows both words together. For "Write the word", either word is accepted.

## Questions that cannot be made fair
- They are skipped and listed on the result screen ("Not asked"), never graded. Example: fill in the blank for a word without an example sentence.

## Practice vs test
- Practice: the score is the number of questions answered correctly on the first try. Retries help learning but do not change the score.
- Test: graded once, on submit. Retakes create new results; old results are never changed.
