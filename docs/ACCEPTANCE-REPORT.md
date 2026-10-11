# Word Workshop — acceptance review (2026-10-11)

Branch `claude/build-v1`. Not merged, not deployed. No paid services added.

## 1. Photo extraction on the two original school photographs — BLOCKED
The two original photographs (week of Oct 12–16: the "-ed" spelling list and the 12-word vocabulary sheet behind `sample-data/`) are **not on the build computer**. The school folders on the Desktop contain only:
- `Sept 21 - Sept 25/`: four PNGs that are byte-identical to "ChatGPT Image …" downloads (a colourised newsletter redraw and three ChatGPT-made study sheets);
- `Sept 28-Oct 1/`: two PDFs generated with ReportLab (a clean rendering of the teacher's two-page newsletter, and a ChatGPT-made "Vocabulary Adventure" booklet).

No accuracy figure for the original photos is reported. Synthetic results are not substituted.
**To unblock:** copy the two photos into `local-fixtures/` named `spelling….jpg` and `vocab….jpg` (git-ignored) and run `npm run test:ocr`. The run prints exact word recognition, definition accuracy and pairing accuracy against `sample-data/`.

### What testing on the teacher's real newsletters (other weeks) found
These are real teacher layouts, but not camera photos and not the requested originals. Ground truth was transcribed by eye. Full details: `docs/OCR.md`.

| Document | Before | After the fix made today |
|---|---|---|
| Sept 28 newsletter, spelling (15) | **1/15** | 15/15 exact, order 100% |
| Sept 28 vocabulary page, card grid (7) | **2/7, pairing 0%** | 7/7 words, pairing 100%, 6/7 definitions exact |
| Sept 21 newsletter redraw, spelling (15) | **2/15** | 7/15 found, 0 wrong; missing numbers listed |

**Finding:** before today, photo extraction did not work on this teacher's real format. The earlier tests used pages drawn by the app itself, in a simpler layout. The reader read the text, but the app's layout step mixed the spelling box with the box beside it, and could not pair a grid of vocabulary cards. Both are fixed and covered by tests. Accuracy on real camera photos (tilt, shadow, glare, curl) remains **unmeasured**.

## 2. Sunday workflow walkthrough (measured)
Script: `tests/walkthrough.mjs`. It drives the real UI as a parent and then as a student. Input: the Sept 28 newsletter (2 pages, 15 spelling + 7 vocabulary). Browser: desktop Chrome, phone-sized window, speech simulated.

| Step | Result |
|---|---|
| Create week | 3 actions (Parent area → New week → Create; default Monday–Friday) |
| Upload + read 2 pages | 3 actions; reading took 9 s on a desktop (a phone will be slower, not measured) |
| Review screen | 15 + 7 words found. Notes shown: "#15 read twice — 'thanks' kept", "crashes: number unreadable, placed as #7", unsure words "crashes", "or", "blaasant". The parent corrects "blaasant" → "pleasant" (1 action). |
| Add as drafts | 1 action; the source photos and raw reader text are kept |
| Sentences | none exist for new words (see §3) |
| Review definitions + approve | 32 approval blockers before review when no sentences are added; 10 acknowledgements + 22 "checked" ticks + Approve |
| Student | flashcards (no picture: "Picture coming soon"), vocabulary practice and test (mixed), spelling study, practice and test; 4 results saved, all linked to version 1 |

No errors. The automated run takes 24 s; a person takes far longer (see §7).

## 3. Example sentences for NEW weekly words — audit
- Sentences exist only for the bundled sample list. **New words arrive with no sentence.**
- The parent has three choices per week:
  1. **Type each sentence** in the editor (22 sentences for 15 + 7 words).
  2. **Sentence helper:** copy a ready-made request, paste it into a writing tool the parent already uses (ChatGPT, etc.), copy the answer back, and paste. Two rounds (spelling, vocabulary); every pasted sentence is marked for checking.
  3. **Skip:** acknowledge "No example sentence" for each word (22 clicks). The child then loses the spelling-test sentence (the word only is spoken) and fill-in-the-blank questions for those words.
- **Conclusion: yes, without an outside tool the parent must create each sentence manually.** The app itself generates none for new words.

## 4. Illustrations for NEW vocabulary words — audit
- The 12 bundled SVGs cover only the sample words. **There is no automatic illustration of new words.**
- A new word shows "Picture coming soon" until the parent uploads a picture (one at a time: Add a picture → choose file; optional description).
- "Picture idea" writes a description the parent can paste into an image tool they already use; the parent then saves the image and uploads it.
- **Conclusion: illustrations for new words are entirely manual today.** Automated illustration generation must not be claimed.

## 5. Simplest practical options to automate sentences and pictures
| Option | Sentences | Pictures | Where it runs | Cost | Effort / notes |
|---|---|---|---|---|---|
| A. Today's copy/paste helper with the parent's own ChatGPT | ✔ (2 copy/paste rounds) | ✖ (one word at a time by hand) | Parent's existing tool | $0 extra | Exists now |
| B. Bulk picture upload (select many images at once, matched to words by file name or order) | — | Faster manual path: ~7 actions instead of ~28 | Local, in the browser | $0 | Small change; not built |
| C. "Paste a whole week" format: the helper asks the writing tool for `word: sentence` for both lists in one round | ✔ (1 round instead of 2) | — | Local + parent's tool | $0 | Small change; not built |
| D. Simple local templates ("Can you spell *rushed*?") | Low quality, not meaningful real-world sentences | — | Local | $0 | Not recommended (fails §5 "age-appropriate real-world sentence") |
| E. On-device AI (Chrome built-in AI / WebGPU models) | Possible on some desktops | Not practical on phones | Local | $0 | Unreliable on iPhone/iPad; large downloads; not recommended now |
| F. Small owner-controlled server (e.g. Cloudflare Worker) + Claude API | ✔ automatic, ~1 request/week | ✖ (Claude does not make images) | External, secure (key on server) | ≈ $0.01–0.05/week; Worker free tier | Needs owner approval, API account with spend cap, passphrase on the parent's device. The same server could also read the photos (better OCR on messy photos) |
| G. Same server + an image-generation API | — | ✔ automatic, parent approves each | External | ≈ $0.02–0.20 per picture → about $0.15–2.40 per 12-word week (to be confirmed) | Needs owner approval; children's-content safety review; still parent-approved |

**Recommendation for lowest effort without new cost:** C + B (both local, small changes) on top of A. **Fully automatic** needs F (sentences, about pennies per week) and G (pictures, a few dollars per month at most), both behind a server the owner controls. None are built, as instructed.

## 6. Real-device testing
| Device / browser | Status |
|---|---|
| Windows 11 desktop, Chrome (headless, real engine) | **Verified (automated):** 167 browser checks pass; real system speech **started and finished** after a genuine click using the on-device voice "Microsoft David"; audible output not checked by ear |
| Windows 11 desktop, Microsoft Edge | **Verified (automated):** the same 167 checks pass; real speech started and finished with the same voice |
| iPhone (Safari) | **UNVERIFIED** — no device available |
| iPad (Safari) | **UNVERIFIED** |
| Android (Chrome) | **UNVERIFIED** |
| Printing on paper | **UNVERIFIED** (print layout checked in print-emulation and PDF only) |
| Camera photos taken on a phone | **UNVERIFIED** |
| Screen readers (VoiceOver / TalkBack) | **UNVERIFIED** (accessible names checked automatically) |

## 7. Time and manual steps to prepare a new week (15 spelling + 7 vocabulary)
Step counts are **measured** by the walkthrough; times are **estimates** (not timed with a person).

| Approach | Parent actions in the app | Actions in another tool | Estimated time |
|---|---|---|---|
| Photos, no sentences, no pictures | 63 (22 of them are "no sentence" acknowledgements) | 0 | ~10–12 min (2 min photos/upload, ~2 min checking the text against the photo, ~5–7 min reading each word and ticking it) |
| Photos + sentence helper, no pictures | 49 | 6 | ~15–20 min (adds ~3–5 min generating and checking 22 sentences) |
| Photos + sentence helper + a picture for each of 7 words, made one by one in an image tool | ~77 | ~27 | ~30–40 min (each picture ~1.5–2 min) |
| Same with 12 vocabulary words (like the sample week) | ~100 | ~40 | ~40–50 min |
| Typing all 22 sentences by hand instead of the helper | +22 typed sentences | 0 | add ~10–15 min |

Most of the in-app actions are the mandatory "checked" ticks and warning acknowledgements: one per word, plus one per warning.

## 8. Feature status
### Fully working (verified by automated tests on desktop Chrome and Edge)
- Profiles, weeks with dates, statuses, archive; student sees approved versions only.
- Paste/type entry; edit, reorder, delete; consolidated review; approval enforcement; teacher-definition integrity with logged corrections; versioned snapshots; results linked to versions.
- Photo upload with on-device reading, straightening, review beside the photo, drafts never auto-approved; real newsletter layout (numbered spelling box beside another box, vocabulary card grid) on the one clean real document available.
- Vocabulary flashcards, five practice/test activities + mixed, fair question rules, results, missed-word practice.
- Spelling study (pattern groups and sound groups), practice and test with speech, no-speech fallback, teacher/mixed order.
- Results history, printables, backup/restore with validation and undo, PIN, responsive layout, security policy.

### Partially working
- **Photo extraction:** works on the clean Sept 28 newsletter; partial on the Sept 21 redraw (7/15 found, none wrong); **real camera photos not measured**.
- **Example sentences:** automatic only for the sample list; new words need typing, the copy/paste helper, or skipping.
- **Illustrations:** 12 sample pictures only; new words need manual uploads; no automatic generation.
- **Speech on desktop:** engine starts and ends with an on-device voice; audibility not verified by ear.

### Unverified
- Accuracy on the two original school photographs (photos not available).
- iPhone, iPad and Android: Safari storage, speech, camera photos, touch use, Home Screen install.
- Paper printing; screen-reader use on real devices.
- Real parent time (the times above are estimates).

## 9. Changes made during this review (committed)
- Layout-aware extraction for real newsletters (`js/layout.js`; numbered list anywhere, re-joining "1." with its word, card-grid pairing, headings kept out of the boxes) and unit tests.
- A warning when imported text contains an unsuitable word (a harsh synthetic photo turned "luck" into a rude word; that must never reach a child unnoticed).
- The "reader was unsure" list only names words that are in the review boxes.
- `npm run test:ocr` scores any `local-fixtures/*.truth.json`; `tests/walkthrough.mjs` measures the Sunday workflow.
