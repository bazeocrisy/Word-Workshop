# Photo extraction (OCR)

## How it works
1. The parent chooses up to 6 photos or screenshots (JPEG, PNG, WebP, GIF, BMP; iPhone HEIC works where the browser can open it, and the iPhone photo picker normally converts to JPEG).
2. Each page can be turned left/right. Pages are scaled to at most 2200 px.
3. On the device, the page is cleaned (greyscale + local adaptive threshold to remove shadows and uneven light) and read by Tesseract.js 5 (English LSTM model). If the reader is unsure (< 80% average), the original image is read as well and the more confident result is kept.
4. Wide gaps between words become column breaks, so two-column worksheets keep word and definition apart. One-character marks at page edges (binder holes, borders, shadows) are removed.
5. Lines are sorted into spelling and vocabulary using headings ("Spelling", "Vocabulary"); without headings, a page where most lines are "word – definition" is treated as vocabulary. Headings, names/dates, table headers and notes ("Reminders…") are left out and listed.
6. The parent sees each photo beside two editable text boxes, the list of words the reader was unsure about, and a live preview. Nothing is added until they choose "Add to the week as drafts".
7. Every imported word arrives in the week editor **unchecked**, with the reader's confidence (the least certain word in its line). Confidence under 80% raises a warning that must be resolved or acknowledged. The source photos and the raw reader text are stored with the week for comparison and audit.
8. Students see nothing until the parent approves the week.

Privacy: photos are processed in the browser and stored only in this device's storage (and in backups the parent downloads). Nothing is uploaded. The reader engine (~11 MB) is served from this site and cached.

## Accuracy — what has and has not been measured
Run `npm run test:ocr`. It compares extraction with the human transcription in `sample-data/`.

**Real school photos: NOT YET MEASURED (blocked).** The original photographs are not in the repository (and must not be, because it is public). To measure, copy them into `local-fixtures/` (git-ignored) named `spelling*.jpg` and `vocab*.jpg` and run `npm run test:ocr`.

Synthetic pages (generated from the sample data, then rotated, shadowed, noised and JPEG-compressed to look photographed). These show the pipeline works; they are **not** evidence of real-photo accuracy:

| Synthetic page | Words | Definitions exact | Character accuracy | Pairing | Order |
|---|---|---|---|---|---|
| Newsletter spelling list (3 numbered columns, 2° tilt) | 15/15 | — | — | — | 100% |
| Vocabulary table (2° tilt, light shadow) | 12/12 | 100% | 100% | 100% | — |
| Vocabulary table, harsh (5° tilt, heavy shadow, noise, low JPEG quality) | 11/12 | 50% | 97.8% | 91.7% | — |

The harsh case shows the typical failure mode: small letter errors ("fryits", "pajq", "Distracteq"). These are why parent review is mandatory and why the confidence warnings exist.

Speed: 1.5–4.5 s per page on a desktop in headless Chrome. Phones are slower (expect roughly 5–20 s per page). First use downloads the reader.

## Known limits
- Handwriting is not supported reliably.
- Very slanted (> ~8°), curled, dark or blurry photos lose accuracy; turn and retake.
- Complex newsletter layouts (text boxes, decorative fonts) may put lines in the wrong box; the parent can move lines between the boxes.
- The iPhone/iPad's own Live Text ("Paste or type a list") is often more accurate and is offered as a tip.

## If on-device OCR proves insufficient on the real photos
A secure alternative (requires owner approval because it costs money and sends photos off the device):
- A small server the owner controls (e.g. a Cloudflare Worker) holding an API key, never exposed to the browser.
- The browser sends a photo only when the parent chooses "Read with the online reader"; the server asks a vision model (e.g. Claude) for structured `{spelling: [...], vocabulary: [{word, definition}]}` and returns it.
- Output is still a draft with mandatory parent review; the teacher's wording is never rewritten.
- Rough cost: a few cents per photo at current API prices; Cloudflare Workers free tier covers the server. Needs: Anthropic API account with billing and a spend cap, Cloudflare account, a shared passphrase entered once on the parent's device, rate limiting, and the parent's agreement that photos of school material are sent to the provider.
Not implemented. No keys exist in this repository.
