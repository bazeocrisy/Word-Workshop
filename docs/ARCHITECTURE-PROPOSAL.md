# Word Workshop — architecture proposal (Phase 1)

Status: **proposal for owner approval. No app code written.** Builds on REQUIREMENTS.md, ARCHITECTURE.md, PROJECT-PLAN.md, TEST-PLAN.md and CLAUDE-HANDOFF.md; it does not replace them.

## 1. Frontend stack

| Choice | Proposal | Why |
|---|---|---|
| Framework | None: plain HTML, CSS, JavaScript ES modules, no build step | Small app; nothing to compile or break; easy for an independent reviewer to audit. Same approach as the family's existing math study site. |
| Routing | Hash routes (`#/student/:id`, `#/parent/week/:id`, …) | Works under the GitHub Pages base path `/Word-Workshop/` with no 404 tricks. |
| Storage | IndexedDB via a small hand-written promise wrapper (no library) | Holds image blobs, larger quota than localStorage, transactional writes, so a failed save can't leave half a week. |
| Offline / install | Web app manifest + small service worker (Phase 2 end) | Lets the parent "Add to Home Screen" on iPhone/iPad, which also protects data from Safari eviction (see risks). |
| OCR | Tesseract.js, self-hosted in `vendor/`, loaded only on the photo-import screen | Runs on the device; photos never leave it. Apache-2.0. |
| Speech | Web Speech API `speechSynthesis` | Built into the browser, free. |
| Tests | `node --test` for pure logic + a dependency-free headless-Chrome harness (adapted from Math Lab) for real-browser flows | No npm dependencies to install or maintain. |

## 2. Data model (extends ARCHITECTURE.md)

```
Student       {id, displayName, grade, createdAt}
Week          {id, studentId, startDate, endDate, status:'draft'|'approved',
               sourceInfo, createdAt, approvedAt, approvedVersion, editLog[]}
VocabularyItem{id, weekId, order, word,
               ocrText|null,            // what OCR read (raw, never shown to student)
               sourceDefinition,        // parent-verified transcription of the teacher's words
               approvedDefinition|null, // set only by approval; defaults to sourceDefinition
               definitionEdited:boolean,// true if approved ≠ source → labelled "Parent-edited"
               reviewFlags[], exampleSentence|null, sentenceSource, imageRef|null, status}
SpellingItem  {id, weekId, order, word, patternGroup, groupReason, groupConfirmed,
               exampleSentence|null, status}
ApprovedSnapshot {weekId, version, approvedAt, vocab[], spelling[]}   // what students see
Attempt       {id, weekId, studentId, snapshotVersion, activity, mode:'practice'|'test',
               startedAt, submittedAt, answers[], score, total, misses[]}
Image         {id, blob, mimeType, width, height, source:'upload'|'icon'|'generated', approvedAt}
```

Key rule: **students only ever read `ApprovedSnapshot`.** The parent edits a working copy; changes after approval put the week back to "changes pending" until re-approved, and the student keeps the last approved version meanwhile. Attempts record the snapshot version, so later edits never rewrite old scores.

Definition integrity: answer keys and study cards read `approvedDefinition` from the snapshot only. `sourceDefinition` changes only through an explicit "Correct transcription" action, which writes an `editLog` entry (old, new, timestamp). No code path writes dictionary text.

## 3. Screens and workflow

**Student side (no draft content ever reachable)**
1. **Who's studying?** — big profile cards (one per student) + small "Parent" link.
2. **Student home** — current approved week; tiles: Vocabulary (Study / Practice / Test), Spelling (Study / Practice / Test), Review missed words, My results. Week switcher for past approved weeks.
3. **Vocabulary study** — flashcard: illustration, word, 🔊 button; flip shows "Teacher's definition" (exact approved text) and example sentence (labelled if not from the teacher).
4. **Vocabulary practice** — mixed multiple choice (word→definition, definition→word), fill in the blank, typed word, matching; immediate feedback with the right answer.
5. **Vocabulary test** — same formats, no feedback until Submit; results page: score/total, %, each miss with correct answer, "Practice these".
6. **Spelling study** — list in teacher order, with toggle "Group by pattern" showing each group's reason (e.g. "double the final consonant: step → stepped").
7. **Spelling practice** — hear word (normal / slow / replay), type, immediate feedback.
8. **Spelling test** — hear word and sentence (sentence shown with ____), type; word never visible; Submit → score, %, misses, "Practice missed words".
9. **My results** — history per week and activity.

**Parent side** (behind an optional 4-digit PIN — a speed bump for kids, not security)
10. **Parent dashboard** — students, their weeks with status badges (Draft / Needs review / Approved / Changes pending), backup reminder.
11. **Week editor** — two tabs (Spelling, Vocabulary). Add items three ways: *Type*, *Paste text*, *From photo*. Rows can be reordered, edited, removed; flags shown inline.
12. **Photo import** — choose photo(s) → rotate/crop → on-device OCR with progress → lines listed with confidence beside the photo → parent marks each line as word / definition / ignore (headers) → draft rows, all `needs_review`.
13. **Review & approve** — every item must be ticked as checked against the source; unresolved flags must be resolved or explicitly acknowledged; suggested spelling groups confirmed; images approved. "Approve week" is disabled until all are done; records approvedAt.
14. **Backup & restore** — export everything to one JSON file; import with validation and a preview before anything is replaced.
15. **Settings** — student names/grades, add student, PIN, speech voice and speed test.

## 4. Storage and backup

- One IndexedDB database; each write is a single transaction. On first launch request `navigator.storage.persist()`.
- **Backup file**: `{app:'word-workshop', schemaVersion, exportedAt, students, weeks, items, snapshots, attempts, images (base64)}`. Images are resized to ~1000 px before storing, so backups stay small.
- **Restore** validates the whole file (schema, ids, every approved definition traceable to a source definition) before touching storage. Malformed files are rejected with a reason. v1 restore = full replace after a preview and an automatic download of the current data first. Per-student merge can come later.
- **No cross-device sync** — GitHub Pages only serves files. Each browser has its own data; moving data means exporting a backup and importing it on the other device. The app will say so plainly.

## 5. Photo extraction — recommended approach

Three intake paths, all producing **drafts only**:

1. **Type** (always available).
2. **Paste text** — parent uses the phone's built-in text recognition (iPhone/iPad Live Text, Google Lens, Windows Snipping Tool "Copy text") and pastes into the app, which splits it into word/definition rows. Free, private, usually more accurate than in-browser OCR, and no code risk. **Recommended primary path for v1.**
3. **From photo (in-app OCR)** — Tesseract.js on the device, with grayscale/contrast/threshold preprocessing and manual rotate/crop. Honest expectation: fine on flat, well-lit, typed text; weak on angled, shadowed, two-column worksheets and on handwriting. Will be measured against the real photos in Phase 4 and shipped only if it saves the parent time; otherwise it stays labelled "experimental".

Every path ends in the same review screen with the photo beside the text. Low-confidence words are highlighted. Headers ("Spelling Words", "Vocabulary") are offered as "ignore".

**Optional later enhancement (separate approval):** server-side OCR through a small Cloudflare Worker that holds an Anthropic API key and sends the photo to Claude's vision model, returning structured word/definition JSON. Much better on messy photos and two-column layouts, and the same Worker could draft example sentences. Needs: Anthropic API account with billing, free Cloudflare account, a shared passphrase entered once on the parent's device (never in the repo), rate limiting, and a monthly spend cap. Photos of school material would leave the device — the parent's call.

## 6. Illustrated vocabulary cards — recommended approach

No API keys, no generation in v1:

1. **Icon picker** — parent picks one or two emoji-style icons per word (searchable picker). Zero cost, works offline. Sample week pre-suggested (Produce 🥕🍎, Constellations ✨🌌, Fortunate 🍀, Employee 🧑‍🔧 …). Abstract words (Exception, Ignorant) are hard to show with icons; for those the card can show a text-only scene description.
2. **Upload an image** — a photo, a drawing, or a picture made elsewhere. Resized locally, stored only in the browser, never committed or sent anywhere.
3. **"Copy picture prompt"** — the app builds a child-safe description from the word and approved definition, e.g. *"A simple, friendly cartoon for a 3rd grader showing 'melancholy': a sad or gloomy condition — a child sitting by a rainy window. No text in the image."* The parent pastes it into any image tool they already use and uploads the result.

Every image is part of week approval; students never see an unapproved image. Cards always work without an image.

**Optional Phase 5:** automatic generation through the same Worker pattern as server OCR, with a separate image provider (Claude does not generate images), per-image parent approval, and cached results.

## 7. Spelling and vocabulary logic

- **Spelling grading**: trim surrounding whitespace, compare case-insensitively, everything else exact. Blank = wrong.
- **-ed grouping** suggested by rules, confirmed by parent:
  - spelling change: double final consonant (step→stepped), drop e (bake→baked), y→i (cry→cried), just add -ed;
  - sound: /ɪd/ after t or d; /t/ after voiceless sounds; /d/ otherwise.
  - Where letters don't settle the sound (e.g. "laughed", "fixed", "-th" endings) the word goes to "Check me" instead of a guessed group.
  - Sample week result: /ɪd/ blasted, lifted, landed, hunted, handed · /t/ rushed, washed, winked, asked, crashed, stepped · /d/ opened, buzzed, called, screamed · spelling change: only *stepped* doubles the consonant.
- **Vocab distractors** come from the other approved definitions in the same week, de-duplicated by normalized text so two options can never both be right. Fill in the blank needs an approved example sentence; items without one skip that format.
- **Automatic review flags** (flag only, never change text): duplicate word, duplicate definition, OCR low confidence, definition contains a form of the word (answer leak), definition starts with "To …" while the word looks like an adjective/participle (possible mismatch).
- Sample-data observations for the parent's check (not changes): *Distracted* and *Trustworthy* already flagged; *Irritating* ("To anger or bother") also reads like a verb definition for an adjective; *Fortunate*'s definition contains "fortune", which hints the answer.

## 8. Speech

- Speak only from a tap (iOS requirement); wait for `voiceschanged`; prefer an English voice; normal and slow (≈0.7) speed; replay.
- If `speechSynthesis` is missing or no voice loads, the app says "Audio isn't available on this device" — it never shows a play state that didn't happen. Non-audio fallback for the spelling test: "Parent reads aloud" mode with a printable word list for the parent; the student screen still hides the word.

## 9. Milestones and test gates

| Phase | Delivers | Gate before moving on |
|---|---|---|
| 2 Core | Profiles, week editor (type + paste), approval + snapshots, IndexedDB, backup/restore, PIN, manifest | Unit + browser tests: student/week isolation, persistence across reload, drafts unreachable by students, definition integrity through save/reload/export/import, malformed import rejected, base path `/Word-Workshop/` |
| 3 Study & tests | Flashcards, practice and tests for both subjects, -ed grouping, speech, results, missed-word review | Answer-key tests, distractor uniqueness, no answer leaks in test DOM, grading edge cases, all 15 spelling words in order, keyboard-only run, phone/tablet/desktop viewports |
| 4 Photos | Photo import + Tesseract.js, review UI | Accuracy measured on the real photos (kept locally, not committed); go/no-go on Tesseract reported with numbers |
| 5 Visual cards | Icon picker, uploads, picture prompts | Image approval enforced; backups include images |

Each phase: builder commits on `claude/build-v1`, `docs/STATUS.md` updated, independent review, manual iPhone/iPad check, then owner sign-off. No merge or deploy without approval.

## 10. Risks

1. **Original photos are not in the repo.** OCR can't be evaluated until the owner provides them. The repo is public, so they should go in a git-ignored local folder, not be committed.
2. **iPhone/iPad Safari can delete website data** after about 7 days without use. Mitigations: install to Home Screen (exempt), `storage.persist()`, backup reminder.
3. **Tesseract.js accuracy and speed on phones** — likely poor on angled/shadowed two-column sheets; 5–20 s per photo; ~5–15 MB download on first use (cached after).
4. **Speech voices differ by device**; some have none.
5. **Answers live in the browser** — a determined child with developer tools could find them. Acceptable for a family study app.
6. **-ed rules have exceptions** — handled by parent confirmation and "Check me".
7. **Example sentences have no source yet** (not in sample data). Needs a decision.
8. **Public repo**: student first names already appear in docs/sample data. Real photos, scores and backups must never be committed.

## 11. Costs

| Item | Cost |
|---|---|
| Core app (Phases 2–5 as proposed) | **$0** — GitHub Pages (public repo), no paid libraries or services |
| Optional server OCR via Cloudflare Worker + Claude (Opus 5.5, $4/$20 per million tokens) | Worker free tier; ≈ $0.02–0.04 per photo → under $1/month at a few photos a week; set a spend cap |
| Optional AI image generation (Phase 5, separate provider) | Roughly $0.02–0.20 per image depending on provider/quality — to be priced from current rates before approval |

## 12. Decisions needed from the owner

1. Approve the stack (vanilla JS, IndexedDB, hash routes, no build).
2. Approve OCR plan: Type + Paste text as primary, on-device Tesseract as measured/experimental, server OCR deferred.
3. Provide the original photos locally for Phase 4.
4. Example sentences: parent writes them / Claude drafts the sample week's sentences now for parent approval / later via optional server.
5. Parent PIN: yes or no.
