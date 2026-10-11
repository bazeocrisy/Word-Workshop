# Word Workshop

A simple weekly spelling and vocabulary study web app for elementary students (grades 3 and 5).

**Upload → Review → Approve → Study → Practice → Test → Review Results.**

## Project status
Version 1 built on the `claude/build-v1` branch and awaiting owner sign-off. **Not merged to `main` and not deployed.** Progress, review findings and limitations: [`docs/STATUS.md`](docs/STATUS.md).

## What it does
- **Parent:** on the first screen choose **Create this week's lesson**. Four steps: (1) student and week, (2) add words, with separate Vocabulary and Spelling sections, each offering photo upload (read on the device), paste a list, or add one word, (3) review every word against the source, (4) approve. Unfinished lessons can be continued from the first screen or the parent area. Students only ever see approved versions.
- **Teacher definitions are kept exactly.** The original capture, the verified teacher wording and any parent wording are stored separately; every correction is recorded.
- **Student:** vocabulary flashcards with pictures, sentences and audio; five practice and test activities; spelling study grouped by spelling pattern and by -ed sound; spelling practice and tests read aloud.
- **Results** for each student and week, linked to the exact lesson version, with missed-word practice and printable sheets.
- **Backup and restore** of everything as one file. Data stays in this browser on this device; there is no account and no sync.

## Using it
Open `index.html` from a web server (GitHub Pages, or `npx serve` / any static server). It does not work from `file://`. On iPhone and iPad, add it to the Home Screen so Safari keeps the data.

## Development
- No build step and no runtime dependencies: plain HTML, CSS and JavaScript modules. Tesseract.js (photo reading) is vendored in `vendor/`.
- `npm test`: unit tests (Node ≥ 22).
- `npm run test:browser`: end-to-end tests in headless Chrome/Edge, served under `/Word-Workshop/` like GitHub Pages (set `CHROME_PATH` if needed; `SHOTS=1` saves screenshots).
- `npm run test:ocr`: photo-extraction accuracy. Put real photos in `local-fixtures/` (git-ignored); never commit them.

Docs: [architecture](docs/ARCHITECTURE-PROPOSAL.md) · [directive](docs/IMPLEMENTATION-DIRECTIVE.md) · [grading rules](docs/GRADING.md) · [photo extraction](docs/OCR.md) · [pictures](docs/ILLUSTRATIONS.md) · [manual device tests](docs/MANUAL-TESTS.md) · [deployment](docs/DEPLOYMENT.md)

Claude is the implementation owner; the parent approves merges and deployment.
