# Third-party files

Kept in the repository and served from this site (no third-party CDN), so photos never leave the device and no other website is contacted.

| Folder | Package | Version | Licence | Source |
|---|---|---|---|---|
| `tesseract/tesseract.min.js`, `tesseract/worker.min.js` | tesseract.js | 5.1.1 | Apache-2.0 | npm `tesseract.js@5.1.1` (`dist/`) |
| `tesseract/core/*.wasm.js` | tesseract.js-core | 5.1.1 | Apache-2.0 (`core/LICENSE`) | npm `tesseract.js-core@5.1.1` (LSTM-only builds, SIMD and non-SIMD) |
| `tesseract/lang/eng.traineddata.gz` | @tesseract.js-data/eng | 1.0.0 (`4.0.0_best_int`) | MIT (package); Tesseract data Apache-2.0 | npm `@tesseract.js-data/eng@1.0.0` |

Files are unmodified. About 11 MB in the repository; a browser downloads about 7 MB of it (one engine build plus the English data), only when the parent first uses "Upload photos".
