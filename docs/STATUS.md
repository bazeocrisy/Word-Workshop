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
| 1 | Core application, profiles, storage | Built, tests passing; independent review in progress |
| 2 | Weekly lesson editor and approval | Not started |
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

## Known limitations / decisions log
- Data lives in one browser on one device; no sync (by design, documented in the UI).
- Demo names only in code; the pre-existing `docs/REQUIREMENTS.md` and `sample-data/*.json` (written by the planning phase) still contain the children's first names. Left untouched to preserve existing work; owner may wish to edit them.
