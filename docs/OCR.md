# Photo extraction (OCR)

## How it works
1. The parent chooses up to 6 photos or screenshots (JPEG, PNG, WebP, GIF, BMP; iPhone HEIC works where the browser can open it, and the iPhone photo picker normally converts to JPEG).
2. Each page can be turned left/right. Pages are scaled to at most 2200 px (well under the iPhone canvas limit).
   The tilt is measured automatically; pages tilted 2.5° or more are straightened before reading (shown as "straightened by N°").
3. On the device, the page is cleaned (greyscale + local adaptive threshold to remove shadows and uneven light) and read by Tesseract.js 5 (English LSTM model). If the reader is unsure (< 80% average), the original image is read as well and the more confident result is kept.
4. Wide gaps between words become column breaks, so two-column worksheets keep word and definition apart. One-character marks at page edges (binder holes, borders, shadows) are removed.
5. Lines are sorted into spelling and vocabulary using headings ("Spelling", "Vocabulary"); without headings, a page where most lines are "word – definition" is treated as vocabulary. Headings, names/dates, table headers and notes ("Reminders…") are left out and listed.
6. The parent sees each photo beside two editable text boxes, the list of words the reader was unsure about, and a live preview. Nothing is added until they choose "Add to the week as drafts".
7. Every imported word arrives in the week editor **unchecked**, with the reader's confidence (vocabulary: the least certain word in its line; spelling: the word itself). Confidence under 80% raises a warning that must be resolved or acknowledged. If the parent corrected text on the review screen, what the reader actually read is kept as the original transcription and the change is logged as a correction ("First captured as …" in the editor). The source photos and the full raw reader text are stored with the week and shown under each source page.
8. Students see nothing until the parent approves the week.

Privacy: photos are processed in the browser and stored only in this device's storage (and in backups the parent downloads). Nothing is uploaded. The reader (about 7 MB to download) is served from this site, never from another website; the browser keeps a copy so later use starts faster. The app itself needs a connection to open (it is not an offline app).

## Accuracy — what has and has not been measured
Run `npm run test:ocr`. It compares extraction with the human transcription in `sample-data/`.

**Real school photos: NOT YET MEASURED (blocked).** The original photographs are not in the repository (and must not be, because it is public). To measure, copy them into `local-fixtures/` (git-ignored) named `spelling*.jpg` and `vocab*.jpg` and run `npm run test:ocr`.

Synthetic pages (generated from the sample data, then rotated, shadowed, noised and JPEG-compressed to look photographed). These show the pipeline works; they are **not** evidence of real-photo accuracy:

| Synthetic page | Words | Definitions exact | Pairing | Order |
|---|---|---|---|---|
| Spelling list (3 numbered columns), 2° | 15/15 | — | — | 100% |
| Spelling list, 5° / 7° | 15/15 / 15/15 | — | — | 100% |
| Spelling list, 7° + heavy shadow, noise, JPEG 0.4 | 15/15 | — | — | 100% |
| Spelling list, −9° | 13/15 | — | — | 47% |
| Vocabulary table, 2° | 12/12 | 100% | 100% | — |
| Vocabulary table, 5° | 12/12 | 100% | 100% | — |
| Vocabulary table, 8° | 11/12 | 92% | 92% | — |
| Vocabulary table, 5° + heavy shadow, noise, JPEG 0.55 | 12/12 | 92% | 100% | — |
| Vocabulary table, 2° + very heavy shadow | 12/12 | 100% | 100% | — |

Before automatic straightening was added (Milestone 5 review), accuracy fell sharply beyond about 4° (e.g. spelling 7°: 4/15; vocabulary 8°: 5/12). The typical remaining failure is a small letter error ("Instaliment", "fryits"), which is why parent review is mandatory and why confidence warnings exist.

Speed: 1.5–4.5 s per page on a desktop in headless Chrome. Phones are slower (expect roughly 5–20 s per page). First use downloads the reader.

## Known limits
- Handwriting is not supported reliably.
- Tilts up to about 7° are straightened automatically on synthetic pages; beyond about 8°, curled pages, dark or blurry photos lose accuracy. Hold the phone flat above the page and retake if many words are wrong.
- Complex newsletter layouts (text boxes, decorative fonts) may put lines in the wrong box; the parent can move lines between the boxes.
- The iPhone/iPad's own Live Text ("Paste or type a list") is often more accurate and is offered as a tip.

## If on-device OCR proves insufficient on the real photos
A secure alternative (requires owner approval because it costs money and sends photos off the device):
- A small server the owner controls (e.g. a Cloudflare Worker) holding an API key, never exposed to the browser.
- The browser sends a photo only when the parent chooses "Read with the online reader"; the server asks a vision model (e.g. Claude) for structured `{spelling: [...], vocabulary: [{word, definition}]}` and returns it.
- Output is still a draft with mandatory parent review; the teacher's wording is never rewritten.
- Rough cost: a few cents per photo at current API prices; Cloudflare Workers free tier covers the server. Needs: Anthropic API account with billing and a spend cap, Cloudflare account, a shared passphrase entered once on the parent's device, rate limiting, and the parent's agreement that photos of school material are sent to the provider.
Not implemented. No keys exist in this repository.
