# Third-party files

Kept in the repository and served from this site (no third-party CDN), so photos never leave the device and no other website is contacted.

| Folder | Package | Version | Licence | Source |
|---|---|---|---|---|
| `tesseract/tesseract.min.js`, `tesseract/worker.min.js` | tesseract.js | 5.1.1 | Apache-2.0 | npm `tesseract.js@5.1.1` (`dist/`) |
| `tesseract/core/*.wasm.js` | tesseract.js-core | 5.1.1 | Apache-2.0 (`core/LICENSE`) | npm `tesseract.js-core@5.1.1` (LSTM-only builds, SIMD and non-SIMD) |
| `tesseract/lang/eng.traineddata.gz` | @tesseract.js-data/eng | 1.0.0 (`4.0.0_best_int`) | MIT (package); Tesseract data Apache-2.0 | npm `@tesseract.js-data/eng@1.0.0` |
| `pdfjs/pdf.min.mjs`, `pdfjs/pdf.worker.min.mjs`, `pdfjs/standard_fonts/` | pdfjs-dist | 4.10.38 | Apache-2.0 (`pdfjs/LICENSE`) | npm `pdfjs-dist@4.10.38` (`build/`, `standard_fonts/`); used for Reading Passage PDFs |
| `english-words/words.js` | ENABLE word list (`enable1.txt`), stored as a Bloom filter built by `english-words/build.mjs` | 172,823 words | Public domain | `dolph/dictionary` on GitHub; see `english-words/README.md` |

The tesseract files are unmodified. `english-words/words.js` is derived (about 290 KB) and loaded with the Sentence Fix grader. About 11 MB in the repository; a browser downloads about 7 MB of it (one engine build plus the English data), only when the parent first uses "Upload photos".
