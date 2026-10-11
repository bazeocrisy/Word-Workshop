# Word Workshop project plan

## Phase 0 — Repo initialization (ChatGPT)
Initialize main and development branch; add requirements, sample data, test plan, and Claude handoff. No app code committed.

## Phase 1 — Architecture proposal (Claude)
Review requirements, inspect repository, propose stack, OCR path, image strategy, storage, page layout, mobile behavior, risks, and expected costs. Stop for approval before implementing.

## Phase 2 — Working offline-first core
Student selection; create/edit weekly lists; mandatory approval; save/reopen week; backups. Tests for student isolation and persistence.

## Phase 3 — Study and assessment
Vocabulary and spelling cards, example sentences, pattern grouping, speech, graded practice/test, missed-word review, results; realistic tests.

## Phase 4 — Photo extraction
Image upload, real OCR, editable review interface, ambiguity flags, re-upload, error paths, test on actual original screenshots. Reject silently modified definitions.

## Phase 5 — Visual cards
Sample illustrations plus managed image uploads; decide on external image generator only after architecture/pricing/privacy review.

## Release gates
- Independent code/test audit and educational accuracy audit.
- Manual iPhone, iPad, desktop verification.
- No unapproved changes to source definitions.
- No client-side API secrets.
- No merge/deploy without owner sign-off.

## Open decisions
Exact OCR engine; whether to use online image generation; whether persistent storage should be IndexedDB; later sync support. These require proposal, not assumptions.
