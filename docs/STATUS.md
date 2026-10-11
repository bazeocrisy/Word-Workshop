# Word Workshop — build status (checkpoint log)

Branch: `claude/build-v1` · Never merged to `main`, never deployed without owner approval.
Architecture: `docs/ARCHITECTURE-PROPOSAL.md` (vanilla JS ES modules, IndexedDB, hash routes, no build step).

## How to resume
1. `git pull` on `claude/build-v1`; read this file top to bottom.
2. `npm test` (Node unit tests) and `npm run test:browser` (headless Chrome, serves the repo under `/Word-Workshop/`).
3. Continue with the first milestone not marked **Complete** below. Never rewrite completed milestones without a recorded reason.

## Milestones

| # | Milestone | State |
|---|---|---|
| 1 | Core application, profiles, storage | **Complete** — reviewed; 5 Major + 7 Minor findings fixed (see below) |
| 2 | Weekly lesson editor and approval | Built, tests passing; independent review in progress |
| 3 | Vocabulary learning and assessment | Not started |
| 4 | Spelling learning and assessment | Not started |
| 5 | Photograph extraction and verification | Not started |
| 6 | Illustrated-card workflow and printable materials | Not started |
| 7 | Full-system testing and final audit | Not started |

## Milestone 1 — Core application, profiles, storage
- App shell, hash router, accessible dialog/toast helpers, colourful mobile-first CSS.
- IndexedDB stores: students, weeks (parent working copies), snapshots (approved lesson versions), attempts (append-only results), images, meta.
- Generic demo profiles (Alex, Grade 3; Jordan, Grade 5) created on first run; parent can rename, recolour, add, remove (removal blocked while a student has weeks/results).
- Weeks: create with date picker (defaults to this Monday–Friday), list per student with status (Draft / Needs review / Approved / Changes pending).
- Student side reads approved snapshots only; unapproved or other students' weeks are unreachable even by URL.
- Backup: export everything (pictures included) to JSON; restore validates structure, ids, cross-links, definition integrity; malformed files rejected with reasons; restore replaces all data after confirmation and keeps a one-step undo.
- Optional parent PIN (salted SHA-256 in IndexedDB; a speed bump for children, not security).
- Web app manifest + icons for Add to Home Screen. `navigator.storage.persist()` requested.
- Tests: 13 unit, 28 browser checks.

### Milestone 1 review (independent reviewer) — resolution
No Critical findings. Major: M1 async mutator could silently lose edits → `editWeek` mutators must be synchronous, `transact` rejects if work outlives the transaction. M2 malformed backup crashed the validator → validator never throws. M3 validator accepted records the app could not use → field-level shape checks, id charset, snapshot/week student match, schemaVersion ≥ 1, transcription-correction invariant. M4 skip link opened "Page not found" → focuses #app without changing the hash. M5 approval/versioning/isolation untested → covered in tests/browser/lessons.mjs. Minor fixed: N1 bad %-encoding, N2 null transaction error, N3 dialog focus trap + Enter submits + unique ids + inert background, N4 undo-restore shows its date and can be discarded, N6 field labels name the student, N7 integrity invariant, N9 restore keeps setup flag. Not changed: N5 (cross-tab race between two parent tabs; very unlikely, documented), N8 (images are already immutable: a new upload creates a new record and image records are never deleted, so old versions keep their pictures).

## Milestone 2 — Weekly lesson editor and approval
- One consolidated editor/review screen per week: add by photo (Milestone 5), paste/type (with live preview; spelling and/or vocabulary; numbered column lists keep teacher order), typing one word at a time, or the bundled sample week.
- Every item: edit, reorder, delete (confirmed). Vocabulary keeps `originalTranscription` (first capture, never changed), `sourceDefinition` (teacher wording; corrections logged with old/new text) and optional `parentDefinition` (shown labelled "Parent-edited").
- Automatic warnings (missing/duplicate word or definition, OCR low confidence, possible word/definition mismatch, missing sentence or sentence without the exact word, imported planning-phase flags). Warnings must be fixed or acknowledged; every item must be ticked "checked" before approval.
- Spelling pattern suggestions (spelling change and ending sound kept separate) with parent override and custom patterns; spelling test order setting (mixed-up by default, or teacher order).
- Example sentences: sample sentences for the provided lists (labelled "Sample sentence — check it"); parent can type or use the sentence helper (copy a request into any writing tool, paste "word: sentence" lines back).
- Approval creates an immutable snapshot version; edits after approval show "Changes pending" while students keep the previous version; version list and change history shown.
- Vocabulary pictures: upload (resized on device), bundled sample illustrations for the sample words, "Picture idea" text. No automatic generation (see illustrations.js integration point).
- Tests: 30 unit, 61 browser checks.

## Known limitations / decisions log
- Data lives in one browser on one device; no sync (by design, documented in the UI).
- Demo names only in code; the pre-existing `docs/REQUIREMENTS.md` and `sample-data/*.json` (written by the planning phase) still contain the children's first names. Left untouched to preserve existing work; owner may wish to edit them.
