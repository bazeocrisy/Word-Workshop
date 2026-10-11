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
| 4 | Spelling learning and assessment | **Complete** — reviewed; 1 Critical + 1 Major + 6 Minor findings fixed (see below) |
| 5 | Photograph extraction and verification | Real photos measured 2026-10-11: spelling 14/15; vocabulary 9/12 words, 4/12 exact definitions at best (table mode) — **vocabulary photo extraction not reliable enough; see docs/OCR.md** |
| 6 | Illustrated-card workflow and printable materials | **Complete** — reviewed with Milestone 5 |
| 7 | Full-system testing and final audit | **Complete** — final audit: no Critical/Major; Minor items fixed or listed below |

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

### Milestone 4 review — resolution
Critical fixed: a spelling word appearing twice in its sentence ("I washed my hands. Washed hands…") was only blanked once, showing the answer → every whole-word, any-case occurrence is now blanked (unit-tested). Major fixed: more silent-e words had non-word bases (tasted, typed, caused, raised, pleased, breathed…) → correct bases; plain words like rested/listed/played unchanged. Minor fixed: vocab test focus starts on the question (router honours data-autofocus); custom-pattern group headings get valid ids; a failed automatic first play now says "Tap Hear the word"; voices are looked up when the spelling screen opens and remembered, so later taps start speech immediately (iOS); the word number is part of the answer box description; "sound not available" shown once per page instead of under every button. Not changed: related forms (e.g. "rush" in a "rushed" sentence) are a hint, not the spelling; the parent sees and approves every sentence.

## Milestone 5 — Photograph extraction and verification
- Genuine on-device OCR (Tesseract.js 5.1.1, vendored in vendor/, Apache-2.0); nothing uploaded. See docs/OCR.md.
- Upload 1–6 pages; rotate/remove; unsupported/oversized/undecodable files refused with clear messages; "no words found" and reader-load failures explained with "Type or paste instead".
- Shadow-correcting preprocessing; column gaps → tabs; edge-noise removal; headings/notes left out and listed; numbered column lists restored to teacher order; wrapped definitions joined and flagged.
- Review step: each photo beside editable spelling/vocabulary text, unsure words listed, live preview; "Add to the week as drafts" (never approved). Items carry reader confidence (least certain word); <80% raises a warning. Source photos and raw reader text are kept with the week and shown beside the editor.
- Accuracy: `npm run test:ocr`. Real photos: BLOCKED until placed in local-fixtures/. Synthetic: 15/15 spelling, 12/12 vocabulary on mild distortion; harsh distortion 11/12 words, 50% exact definitions, 97.8% character accuracy.
- Tests: 19 browser checks (synthetic end-to-end through the UI).

## Milestone 6 — Illustrated cards and printable materials
- Pictures: bundled sample illustrations (12 hand-drawn SVGs for the sample words, labelled "Sample illustration"; installment redrawn after review), parent uploads (resized on device, describable alt text), "Picture idea" text, honest "Picture coming soon" placeholder. Every picture is approved with the week. Future generation: disabled integration point in js/illustrations.js; design and costs in docs/ILLUSTRATIONS.md. No keys, no network calls.
- Printables (approved content only): weekly spelling list (teacher order or grouped by pattern) with write-it-twice practice grid; read-aloud list for a grown-up (no-speech fallback); vocabulary study guide (word, teacher definition, sentence; pictures optional to save ink); results with missed-word practice sheet. Print CSS hides app chrome and starts each sheet on a new page.
- Tests: 13 print/picture browser checks.

### Milestones 5–6 review — resolution
No Critical findings. Major fixed: (1) text corrected on the photo review screen erased the reader's original reading and confidence → edited rows are matched back to what the reader read: that text stays as the original transcription, the change is logged as a correction, unchanged words keep their confidence, and the raw reader text is shown under each source page; (2) no-sound missed-word practice told the grown-up the wrong word number → the prompt uses the teacher's number from the printed list; (3) accuracy fell sharply beyond ~4° tilt and docs/OCR.md overstated tolerance → automatic straightening (projection-profile skew estimate, exact on synthetic tilts −9…9°) for tilts ≥ 2.5°, re-measured and documented. Minor fixed: short shadow fragments after a tab removed; stray numbers/marks not imported as words; specific message when the reader cannot load; offline/size wording corrected; practice sheets have boxed cells and room to write; missed-word sheet has a heading and covers the latest week only; more silent-e bases (guided, quoted, ached, clothed…). Flaky "unnamed link"/focus checks fixed (test used innerText inside a closed details; autofocus applied to every question type).

## Milestone 7 — Full-system testing and final audit
- Responsive/accessibility suite: 13 key screens × 5 viewports (iPhone SE, iPhone, iPad portrait/landscape, desktop) — no sideways scrolling, tap targets ≥ 44 px, every control named; keyboard focus starts on each quiz question.
- Content-Security-Policy (self-only scripts, styles, images, connections; no third-party hosts), with a test that fails on any violation and proves blocking works; no-referrer.
- Final independent audit: ~140 requirements traced, 133 met; end-to-end parent→student journey including edit/re-approve, backup, wipe and restore (byte-identical); XSS payloads in every text field and in a hostile backup — no execution; no secrets; no third-party requests; definition integrity, version linkage and isolation confirmed. No Critical or Major findings.
- Audit Minor items fixed: slow playback for sentences (not only words); paste picks "Both" when both headings are present; dashboard prompts renaming demo profiles; on-device voices preferred (an online voice would send words to its provider); a failed save now shows a dialog and reloads what is actually stored; weeks can be archived (hidden from the student's list, results kept); the architecture proposal no longer names the children.
- Docs: README, MANUAL-TESTS.md (real-device checklist), DEPLOYMENT.md (not performed), OCR.md, ILLUSTRATIONS.md, GRADING.md.
- Independent recheck of the Milestone 5–6 Major fixes: all three confirmed fixed, no new Critical/Major. Its two Minor notes were then fixed: rows typed fresh on the photo review screen are no longer mistaken for corrections of similar reader words (one-to-one, stricter matching), and a mostly numbered list keeps the teacher's order with unnumbered extras at the end.
- Totals: 51 unit tests, 167 browser checks, OCR evaluation (synthetic only; real photos blocked).

## Acceptance review (2026-10-11)
See docs/ACCEPTANCE-REPORT.md. Original photos not available (BLOCKED). Testing on the teacher's real newsletters exposed a layout defect (1/15 spelling, 0% vocabulary pairing); fixed with layout-aware extraction (js/layout.js) → 15/15 and 7/7 with 100% pairing on the clean Sept 28 newsletter, 7/15 with no wrong words on the Sept 21 redraw. Added an unsuitable-word warning for imported text. Sunday workflow measured with tests/walkthrough.mjs. Sentences and pictures for new words are manual (options in the report). Real speech verified to start/finish on Windows Chrome and Edge; mobile devices unverified. Totals: 57 unit tests, 167 browser checks (Chrome and Edge).

## Family-testing release (2026-10-11)
Published to GitHub Pages with the owner's approval for family testing (https://bazeocrisy.github.io/Word-Workshop/). OCR optimisation stopped at the owner's request; the limitations below are accepted for this release. Mandatory parent review and manual correction remain in place.

**Current OCR limitations**
- Spelling newsletter photo: 14/15 words; uncertain words are flagged and must be checked before approval.
- Vocabulary sheet photo: not reliable — best 9/12 words and 4/12 exact definitions with table mode (mark the table corners and enter the card counts); the pale green top row often fails. Expect to type or correct most definitions, or use the phone's text recognition and "Paste or type a list".
- Phone speed not measured: a difficult page may take 1–2 minutes.
- Handwriting, heavy curl/glare and very low-resolution photos are not supported reliably.
- Every imported word is a draft: nothing reaches a child until each word is checked and the week is approved.

**Other known limitations:** data stays in one browser on one device (use Backup to move it); sentences and pictures for new words are manual (sentence helper, picture uploads); iPhone/iPad/Android behaviour, speech audibility and paper printing have not been verified on real devices.

## Real-photo OCR results (2026-10-11)
The owner supplied the two original photos (kept in git-ignored local-fixtures/, never committed). `npm run test:ocr` against sample-data:
- **Spelling newsletter:** 14/15 words exact, in order (before: 9/15). #5 "opened" came out as "opene" and is flagged; all 8 words that not every reading agreed on carry warnings into the editor.
- **Vocabulary table:** photo as taken 3/12 words, 0/12 exact definitions, 0/12 pairs. With the new table mode (parent marks the table corners and enters 4 × 3): best 9/12 words, 4/12 exact definitions (33%), 7/12 correct pairs (58%), character accuracy 92%; careful corner placement gave 5/12. Unreliable: limited by the photo's resolution (1152 × 1536, apparently downscaled), curl and pale-on-green text.
- Fixes made: tolerant list numbering (missing period, misread number → position), multi-reading vote for incomplete numbered lists, table mode (corner tool with keyboard support, perspective correction, grid inference, per-card reading with voting), default page mode restored after extra readings, unreadable-card placeholder.
- Parent review is unchanged: every imported item is an unchecked draft; card rows carry a "check against the photo" warning; approval is blocked until all are checked; corrections are logged with the reader's original text (browser-tested).
- Independent review (2026-10-11): no Critical; 3 Major fixed — (1) single-reading/position-guessed spelling words and missing-period numbers are now flagged (confidence capped), "5." beats "5 minutes", and these notes reach the week editor as spelling warnings; words found only by extra readings are recorded as photo-read with confidence; (2) table mode no longer shows a false "No words were found" alert and keeps the raw card text for the audit trail; (3) enlarged images capped at 12 MP for iPhone/iPad. Minor fixed: extra readings skipped for vocabulary-only pages and shown with progress; reading mode restored in finally blocks; corner tool focus (opens on the first handle, returns to the page button), see-through handles; stale OCR doc lines.
- Totals: 61 unit tests, 175 browser checks (Chrome and Edge).
- Unresolved: vocabulary photo extraction needs a better source (full-resolution photo or phone text recognition) or an owner-approved online reader.

## Known limitations / decisions log
- Data lives in one browser on one device; no sync (by design, documented in the UI).
- Demo names only in code; the pre-existing `docs/REQUIREMENTS.md` and `sample-data/*.json` (planning files, already on `main`) still contain the children's first names, and git history keeps earlier versions. Owner decision.
- **Real-photo OCR:** spelling 14/15; vocabulary at best 9/12 words and 4/12 exact definitions with table mode (see docs/OCR.md). Not reliable enough for the vocabulary sheet from the supplied (downscaled) photo.
- **Example sentences:** generated only for the bundled sample list. For other weeks the parent types them, pastes them from any writing tool via the sentence helper, or acknowledges "No example sentence" (spelling test then says the word only; fill-in-the-blank skips the word). Automatic generation would need a paid, owner-approved service.
- **Pictures:** only the 12 sample words have bundled illustrations; others need a parent upload or show "Picture coming soon". Automatic generation is not built (integration point only).
- **Speech** depends on the device's voices; a muted device cannot be detected. If no on-device English voice exists, the browser's default voice is used, which on some browsers is an online voice.
- Not an offline app (no service worker); the reader download is cached by the browser.
- Answers live in the browser; a determined child with developer tools could find them. Acceptable for a family study app.
- Two parent tabs editing the same week at once could overwrite each other (very unlikely; not handled).
- Real iPhone/iPad/Android behaviour (speech, camera photos, Safari storage, printing) is verified only through the manual checklist (docs/MANUAL-TESTS.md), not automatically.
