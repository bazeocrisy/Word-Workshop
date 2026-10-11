# Word Workshop — build status (checkpoint log)

Branches: `main` is live (v1 + four-step wizard, PR #1 and PR #2, deployed 2026-10-11 with owner approval) · `claude/parent-ux-v2` (Redesign 2.0 lesson workspace, awaiting owner approval). Never merge or deploy without owner approval.
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

## UX correction: landing page and lesson wizard (2026-10-11, branch `claude/ux-wizard`)
The first real parent test showed parents could not find where to upload worksheets or enter words. The learning, OCR, testing and storage engines are unchanged; the parent experience is reorganised around creating a weekly lesson. **Not merged or deployed; awaiting owner review.**

**Screens**
- **Landing page (`#/`)**: explains the purpose. *Parents: create and manage lessons* has the primary **Create this week's lesson** button, Continue buttons for up to two unfinished lessons (hidden while a parent PIN locks the parent area), and Manage lessons / Results / Settings / Backup. *Students: study and test* has the profile cards (approved lessons only, as before).
- **Header**: Home and Parents links on every screen.
- **Parent dashboard (`#/parent`)**: prominent *Create this week's lesson*; *Lessons in progress* (never approved, or changed since approval) with status, step and Continue; *Approved lessons* per student; *Results, backup and settings*. New results index `#/parent/results`.
- **Wizard** (`js/views/wizard.js`, `js/views/lessonSteps.js`):
  1. `#/parent/new` or `/parent/week/:wid/start`: **Student and week.** The student is chosen with large radio cards. Dates default to the coming Monday–Friday. Errors are explained inline. A lesson for the same student whose dates overlap is refused, and "Open that lesson" is offered instead. An approved lesson stays with its student.
  2. `/words`: **Add words.** There are separate **Vocabulary** and **Spelling** sections. Each offers upload (the photo reader opens preset to that subject and returns here), *Paste or type a list* (preset to that subject), and *Add one word*. Vocabulary is added as word + definition exactly as written. Entries can be edited, removed and reordered. Either subject may be empty. The section counts and photo-confidence badges stay visible. Half-typed entries survive a reload or a trip to Upload. Continuing with an un-added entry asks *Add it / Leave it out*.
  3. `/review`: **Review.** This step uses the existing editor cards, with vocabulary first. It shows teacher definitions exactly, "First captured as …", ⚠️ warnings with acknowledgements, sentences, pictures, spelling patterns, source photos beside the words, a progress bar, and *Go to the next word to check*.
  4. `/approve`: **Approve.** It shows vocabulary, spelling, checked and open-warning counts. If anything is unfinished, it lists what is left with a button back to Review, and no approve button is shown. Otherwise the parent must tick *I have compared every word, spelling and definition with the teacher's sheets* before **Approve and give to …** is enabled. Approval goes through `store.approveWeek` (blockers and integrity checks re-run, immutable snapshot). Afterwards the app opens the student's lesson list.
- Every change autosaves to the lesson as before. The step reached is remembered (`meta` key `wizard:<lessonId>`, removed when the lesson is deleted). The existing all-in-one lesson page (`#/parent/week/:wid`) stays for approved lessons.
- **Visual**: wider main area (1120 px) on parent screens, with student screens kept at 880 px. Two-column layouts on desktop (landing areas, dashboard, Vocabulary/Spelling side by side). Step indicator. A sticky Back/Continue bar. Coloured section borders. Large labelled buttons.

**Tests**
- `npm test`: 61/61.
- `npm run test:browser`: 237/237. This includes the new `wizard` suite (64 checks covering the owner's 10 acceptance scenarios plus review regressions). The `responsive` suite now covers 18 screens, including the four wizard steps, at 375, 390, 768, 1024 and 1366 px.
- `tests/walkthrough.mjs` (Sept 28 newsletter, through the wizard) completed with no errors:
  - **Parent: 72 actions.** 16 are navigation and upload; 26 acknowledge warnings and 22 tick words. The warning count reflects the current OCR's stricter flags; the earlier measured run had fewer.
  - Navigation went up by about 7 compared with the old single screen. Uploading the newsletter and the vocabulary page in their own sections takes 8 actions instead of 4. On the photo page, the parent can still set "What is on these pages?" to *Let the app decide* and upload both pages at once.

**Independent review (2026-10-11):** no Critical findings.
- **Major (fixed):** a half-typed definition was lost on reload because textarea content was set as an attribute. A test was added.
- **Minor (fixed):**
  - Same-tick double submit could create two lessons.
  - Same-tick double click could add a word twice.
  - *Leave it out* did not discard the typed word.
  - Deleting a lesson left its wizard note.
  - Approved-then-changed lessons were not listed as in progress. They now are, with Continue to the lesson page and no Delete in that list.
  - On a phone, the dashboard's create button was below two notices. The notices now come after it.
  - Draft names were shown on the home page while a PIN was set. They are now hidden while locked.
- **Not changed (owner to confirm):** after approval the parent lands in the student's lesson list, as the requirement says, not back in the parent area.

**Second round (fresh-browser review of the whole workflow, 8 owner checks):** added a visible "All changes saved" status and **Save and finish later**. Approval now opens the new lesson, where Study, Practice and Test are ready. Reviewer found 1 Major: on tablets and phones the Spelling upload and paste buttons (and on phones the vocabulary paste button) were below the first screen or under the bottom bar. Fixed with a block of all four buttons at the top of Add words on narrow screens; "Add one word" folds there, and the bottom bar is one row on phones. Minor fixes: the approve action comes first in Step 4; student cards no longer overflow. Re-review: all 8 checks pass at 1366, 768 and 390 px. Totals: 61 unit tests, 245 browser checks. Branch head 2e9b887 plus this note; not merged or deployed.

**Not verified:** real phones, tablets and screen readers; a timed session with a real parent.

## Redesign 2.0: parent workspace (2026-10-11, branch `claude/parent-ux-v2`)
The owner's real-world test showed the four-step wizard still cost too many screens and actions, and that the separate photo tool felt like leaving the app. This redesign makes the existing features easier to find and use; it adds no new features. **Not merged or deployed; awaiting owner approval.**

**What a parent sees**
- **Landing page (`#/`)**: *Parents: create and manage lessons*: **Create this week's lesson**, *Continue unfinished lesson* (hidden while a PIN locks the parent area), and *Manage lessons*. *Students: study and test* holds the profile cards. Backup reminders, settings and the "saved on this device" note moved to the parent area, settings and backup screens.
- **Lesson workspace (`#/parent/new`, `#/parent/lesson/:id?stage=add|check|finish`)**: one screen, three stages.
  - **Add**: student, week (Mon–Fri default; end follows start) and an optional name at the top. Vocabulary and Spelling cards sit side by side, each with *Upload … worksheet*, *Type or paste* (inline, with a live preview) and *Add one word* (inline).
    - Upload is preset to the card's subject. The photo is read on the device on the same screen, with a progress bar, and the words go straight to Check.
    - *One photo with both lists?* covers a combined upload.
    - The lesson is saved with the first word. A second lesson for the same student and week is refused, with a link to the existing one.
  - **Check**: every word is an editable row.
    - Vocabulary rows: number, word, the teacher's exact definition, status, ⋯. Spelling rows: number, word, status, ⋯.
    - The worksheet photo sits beside the rows on wide screens. It is larger, follows the row being edited, and enlarges in place. Phones get a Photos viewer, so the parent keeps their place.
    - *Needs attention* lists the words with problems (reader unsure, misread numbering, possible mismatch, duplicates…). Each takes one fix, or one *Looks right*.
    - The other words are confirmed with one action per subject: *I checked these N words against the sheet*.
    - Editing the spelling word or the vocabulary definition counts as checking that row. Editing only a vocabulary word does not.
    - The ⋯ menu offers move up/down, move to the other subject, and delete. Moving keeps the definition and asks first.
    - *Other text found* keeps every line the reader could not place, with *+ Vocabulary / + Spelling* to recover a word.
    - Sentence and picture status is shown per word. *Add sentences…* opens the existing helper; *Continue without sentences* is one action per subject.
    - *Words in a grid of cards? Read as a table* re-reads a vocabulary photo with the corner tool.
  - **Finish**: summary (student, week, vocabulary and spelling counts, checked, unresolved issues) and what is left, each with a link to it. One explicit **Approve and give to {student}** appears only when nothing is left. Approval still goes through `store.approveWeek` (blockers and definition-integrity checks, immutable snapshot), then opens the student's lesson page (Study / Practice / Test).
  - Everything saves as it happens ("Saved"). The stage is remembered (meta `wizard:<id>`), and half-typed text survives reloads. Old wizard addresses open the matching stage. The earlier all-in-one lesson page stays as *Spelling patterns, test order, history and more*.
- **Code**:
  - `js/views/workspace.js` (subclasses the existing `Editor`) and `js/views/lessonSteps.js`.
  - `js/photoImport.js`: inline reading, using the same extraction and matching as the photo page (`buildDraftItems` and `markTableCorners` extracted from `importView.js`).
  - The four-step wizard (`wizard.js`) was removed.
- **Data**: no schema change.
  - New optional fields: `item.sourceId`, `spellingItem.movedFrom`, and `source.otherText`, `source.target`, `source.table`.
  - Backups round-trip; the reviewer verified this.

**Real-world walkthrough** (`tests/walkthrough.mjs`; real UI, every parent action counted; photos in git-ignored local-fixtures/):

| Worksheets | Parent actions | Screen changes | OCR corrections | Estimated time* |
|---|---|---|---|---|
| Sept 28 newsletter, sentence helper (same as the earlier 72-action measurement) | **32** + 6 in another app (was 72 + 6) | 2 | 1 | ~4 min |
| Sept 28 newsletter, without sentences | **25** | 2 | 1 | ~3 min |
| Oct 12 photos, vocabulary photo as taken | **54** | 2 | spelling 1, vocabulary 16 | ~8 min |
| Oct 12 photos, vocabulary read as a table (4 corner drags + 2 counts) | **50** | 2 | spelling 1, vocabulary 13 | ~7 min |

\*Estimated, not timed with a person: 3 s per click, 4 s + 0.35 s per character for each typed field, 3 s per word to compare with the sheet, plus the measured reading time (desktop, 30–47 s).

Every run ended with an approved lesson that exactly matches the teacher's sheets, and the student page opened with Study / Practice / Test. Screen changes: home → workspace → student lesson; Add, Check and Finish switch on the same screen.

**OCR problems vs interface problems**
- **OCR, not interface:**
  - The vocabulary photo of Oct 12 is read badly: 3/12 words as taken, 7/12 words and 4/12 exact definitions as a table. That is 13–16 of the corrections and most of the typing (312–477 characters).
  - The reader also flags many words it read correctly. On Sept 28, 14 of 15 flagged words were right, which costs 14 *Looks right* clicks.
  - Both need better source photos or an owner-approved online reader. They are not UI defects.
- **Interface, fixed:**
  - The separate photo screen and its raw text boxes are gone.
  - One warning acknowledgement per warning became one decision per word.
  - Ticking each word became one confirmation per subject.
  - One "no sentence" acknowledgement per word became one decision per subject.
  - The four wizard screens became one workspace.

**Independent review**
- Round 1: no Critical. 3 Major, all fixed:
  - Editing only a vocabulary word marked the row checked and cleared definition warnings.
  - Moving to the other subject dropped the definition.
  - Text being typed was lost when a photo finished reading.
- 3 Minor, all fixed:
  - Drafts leaked into the next new lesson.
  - "Photo reader read" was shown for typed words.
  - An off-screen workspace could change the address.
- Notes, also fixed: Escape and click-outside close the ⋯ menu; 44 px targets; larger photo that follows the row, with zoom in place.
- Round 2: all six findings confirmed fixed; one new Minor (long vocabulary words cut off on desktop after the photo panel grew) fixed by giving the word column a minimum width; the skip link is now 44 px.
- All 10 owner checks pass at 1366, 768 and 390 px.
- Tests: 61 unit; 229 browser checks, including the new `workspace` suite (56).

**Not verified**: real phones and tablets, a timed session with a real parent, screen readers.

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

## Online photo reader (2026-10-11, branch `claude/online-ocr`)
Optional Claude-vision photo reader behind an owner-deployed Cloudflare Worker (`server/ocr-worker/`), set up per browser in Settings, with automatic fallback to on-device reading. Details, privacy and cost: docs/OCR.md. Not deployed; real-photo accuracy not yet measured (needs the owner's API key: `npm run test:ocr:online`). Totals: 67 unit tests; browser suite adds 11 checks (`onlineReader`). In this Linux/Chromium test environment 8 existing on-device OCR checks fail identically with and without this change (Tesseract reads an extra "HT" row from the synthetic vocabulary page); they pass on Windows Chrome/Edge per earlier runs.
Applied and checked on Windows (2026-10-11): 67 unit tests and 241 browser checks pass (Chrome). Follow-up fix: the page's Content-Security-Policy blocked every request to the reader (verified with a real request), so `connect-src` now also allows `https://*.workers.dev`, Settings accepts only a workers.dev address, and a browser check makes a real request to confirm it is not blocked. The photo-upload test helpers now wait for reading to start instead of a fixed 300 ms (a timing race seen once).
