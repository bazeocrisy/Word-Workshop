# Word Workshop test plan

## Ingestion
- Upload multiple JPEG/PNG photos; unsupported file and large file errors.
- OCR tilted/shadowed newsletter and vocabulary sheet; distinguish headers vs actual words.
- Manually insert and edit words and definitions.
- All extracted records default to draft; student cannot access before parent review.
- Review possible mismatches (e.g. Distracted, Trustworthy) without silently replacing definitions.
- Verify literal definition integrity after save, reload, backup export/import.

## Vocabulary
- Every approved word has an associated teacher definition.
- Matching, multiple-choice, blank, write-in answer keys are correct.
- Test distractors cannot accidentally contain multiple correct answers.
- Practice reveals feedback; test does not leak answers.
- Unknown/homograph/capitalization behavior defined.

## Spelling
- All 15 source words retained, original order.
- Spelling group accuracy including stepped and -ed pronunciation patterns.
- Speech word and sentence works when browser supports speechSynthesis.
- Replay without exposing word; hide target spelling in test sentences/UI.
- Typo, blank answer, case, whitespace, and exact-match grading.
- Summary accurately totals all 15 words; missed-only review.

## Storage & platforms
- Separate students and weeks, no cross-contamination.
- Refresh persistence, backup/restore, malformed import rejection.
- Keyboard-only usage, screen-reader names, reduced-motion compatibility.
- Responsive small-phone, iPad portrait/landscape, desktop.
- GitHub Pages base path `/Word-Workshop/` works with assets/routes.
- Test suite passes before requesting merge/release.
