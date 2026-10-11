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
| 2 | Weekly lesson editor and approval | **Complete** — reviewed; 4 Major + 6 Minor findings fixed (see below) |
| 3 | Vocabulary learning and assessment | **Complete** — reviewed; 4 Major + 6 Minor findings fixed (see below) |
| 4 | Spelling learning and assessment | Built, tests passing; independent review in progress |
| 5 | Photograph extraction and verification | Built and tested on synthetic pages; **real-photo accuracy BLOCKED** (photos not supplied); review pending |
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

### Milestone 2 review — resolution
No Critical findings (definition integrity, approval enforcement and XSS checks passed). Major fixed: (1) -ed suggestions for longer silent-e words (decided, invited, escaped…) were "just add -ed" → now drop-e where letters prove it (replaced, rescued, sneezed) and "Check me" where they cannot (decided vs visited); quizzed/controlled fixed; sound is still suggested from the stem. (2) Paste parser dropped/merged word banks → single-space rows split into words, "Bonus:"/"Challenge words:" kept with a note, sentences/notes set aside and shown in the preview. (3) Wrapped definitions truncated → joined across lines and flagged "joined from two lines"; column layouts protected. (4) Keyboard focus lost after ticking → focus restored on the same checkbox; after delete/move/picture changes too. Minor fixed: table header lines ignored; "Reminders"-type headings end a section; double-tap ↑/↓ safe; re-ticking boxes no longer marks a week "Changes pending" (status now compares content fingerprint); parent can describe uploaded pictures (alt text); "Go to the next word to check" button; installment illustration redrawn (pay-over-time); validator item-id/approvedRevision/snapshot-entry-id checks. Accepted as-is: editing the teacher box is logged as a transcription correction (by design; parent rewording uses "my own wording").

## Milestone 3 — Vocabulary learning and assessment
- Flashcards: picture (or honest "Picture coming soon"), word, exact approved definition labelled "Teacher's definition" or "Definition (parent-edited)", example sentence, audio (word normal/slow, sentence), Back/Next and arrow keys.
- Five activity types + Mixed, for practice and for tests: choose the meaning, choose the word, fill in the blank, matching (rounds of ≤5), write the word.
- Fairness rules (js/vocab.js, unit-tested over many seeds): exactly one right option; distractors never share the target's word or definition and never repeat; blank needs a sentence with the exact word once and never offers a word already in the sentence; identical definitions → either word accepted; unfair questions are skipped and listed, never graded.
- Practice: immediate feedback, explanation (word means …, example), "Try again" or "Show the answer", progress bar, first-try scoring saved.
- Tests: no feedback until submitted; options carry no correctness markers; answer word never present in the page for written questions; review screen lists unanswered questions; confirmation to submit with blanks; leaving mid-test asks first; a test in progress survives a refresh (sessionStorage).
- Results: score, %, encouragement, every answer with the correct answer, missed words, "Practice missed words"; saved per student/week/lesson version; retakes add new results.
- Speech: speechSynthesis with voice selection, tap-to-start, honest status ("Playing…" only after start; explanation if it did not play), disabled with a message when unsupported. Parent "Test the voice" page.
- Grading rules: docs/GRADING.md.

### Milestone 3 review — resolution
No Critical findings (answer keys, leak checks on every question of a mixed test, version linkage and speech honesty all passed). Major fixed: (1) a word listed twice (e.g. two meanings of "bat") is never put in the same matching round — extra copies are skipped and reported; (2) remaining non-word -ed bases (changed→"chang", ignored→"ignor", compared, inhaled, created) → "Check me" or a correct silent-e base; (3) screen readers now hear the actual question: choices and answer box are labelled by instruction + prompt, and focus starts on the question; (4) after a correct practice answer focus moves to Next and the result is announced through a persistent live region (spelling too). Minor fixed: a definition that contains part of its word (sample: Fortunate/"fortune") is not used for "Choose the word" or "Write the word" (reported as not asked); practice matching needs every row before Check; Try again focuses the chosen answer; a definition shared by two words is asked once; the "Words after Note:" preview message only appears when words were kept; "word | definition" tables; toasts no longer linger over the next page.

## Milestone 4 — Spelling learning and assessment
- Study: teacher's order with example sentences; audio for word (normal and slow) and sentence; separate views "Spelling patterns" (how letters change) and "Ending sounds" (/t/, /d/, /id/) with the reason for each word. Sample list verified: only "stepped" doubles its consonant; /t/ 6, /d/ 4, /id/ 5.
- Practice: hear word / slowly / in a sentence; sentence shown with the word blanked; type; Check; immediate feedback; Try again or Show the word; first-try scoring; "Practice missed words".
- Test: mixed-up order by default (seeded, reproducible) or teacher order (parent setting); word spoken when each question opens (after a tap, as iPhone requires) with replay; sentence shown with the word removed; the correct spelling never appears in the page, title or URL before submitting (tested for every word); review screen; blanks confirmed and graded wrong; score, %, every answer; saved with version and order.
- No speech: buttons disabled with a clear message; tests/practice switch to teacher order with a "Grown-up: read word number N" prompt and a link to the printable read-aloud list. Speech that fails to start is reported ("did not play"), never shown as playing.
- Tests: 44 unit, 121 browser checks.

## Milestone 5 — Photograph extraction and verification
- Genuine on-device OCR (Tesseract.js 5.1.1, vendored in vendor/, Apache-2.0); nothing uploaded. See docs/OCR.md.
- Upload 1–6 pages; rotate/remove; unsupported/oversized/undecodable files refused with clear messages; "no words found" and reader-load failures explained with "Type or paste instead".
- Shadow-correcting preprocessing; column gaps → tabs; edge-noise removal; headings/notes left out and listed; numbered column lists restored to teacher order; wrapped definitions joined and flagged.
- Review step: each photo beside editable spelling/vocabulary text, unsure words listed, live preview; "Add to the week as drafts" (never approved). Items carry reader confidence (least certain word); <80% raises a warning. Source photos and raw reader text are kept with the week and shown beside the editor.
- Accuracy: `npm run test:ocr`. Real photos: BLOCKED until placed in local-fixtures/. Synthetic: 15/15 spelling, 12/12 vocabulary on mild distortion; harsh distortion 11/12 words, 50% exact definitions, 97.8% character accuracy.
- Tests: 19 browser checks (synthetic end-to-end through the UI).

## Known limitations / decisions log
- Data lives in one browser on one device; no sync (by design, documented in the UI).
- Demo names only in code; the pre-existing `docs/REQUIREMENTS.md` and `sample-data/*.json` (written by the planning phase) still contain the children's first names. Left untouched to preserve existing work; owner may wish to edit them.
