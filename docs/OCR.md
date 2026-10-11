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

### The two original school photographs (measured 2026-10-11)
Supplied by the owner as `spelling-original.jpg` (Oct 12–16 newsletter) and `vocab-original.jpg` (12-card vocabulary table), both 1152 × 1536 JPEGs, kept only in git-ignored `local-fixtures/`. Compared with the transcription in `sample-data/`.

**Spelling (15 words), photo as taken:**

| | Words exact | Wrong words | Order |
|---|---|---|---|
| Before today's fixes | 9/15 (60%) | 0 | 60% |
| After | **14/15 (93%)** | 1, flagged ("opene" at #5) | 93% |

Wrong: **opened** came out as "opene" at #5; it is flagged "Only some readings of the photo found this word here". Every word that not all readings agreed on (8 of 15 on this photo) carries a warning into the week editor that the parent must resolve before approval. Fixes: list numbers read without their period ("10 landed") or misread ("T rushed" = 1.) are recovered from the column position; when the list is incomplete the page is read four more ways (enlarged, and in sparse-text mode) and each number is voted on.

**Vocabulary (12 cards in a table, photographed at an angle):**

| Mode | Words found | Definitions exact | Character accuracy | Correct word–definition pairs |
|---|---|---|---|---|
| Photo as taken (before and after) | 3/12 (25%) | 0/12 (0%) | 27% | 0/12 (0%) |
| Table corners marked + card counts entered (4 × 3), corners placed roughly | **9/12 (75%)** | **4/12 (33%)** | 92% | **7/12 (58%)** |
| Table corners marked carefully, counts entered | 5/12 (42%) | 2/12 (17%) | 74% | 3/12 (25%) |
| Corners marked, counts left on Auto | 1–5/12 | 0–2/12 | — | 1–3/12 |

With corners marked roughly + 4 × 3: exact — Employee, Ignorant, Constellations, Irritating; near-misses — Fortunate ("Involving" capital I), Installment ("one" for "over"), Melancholy (stray ":"); truncated — Trustworthy ("…to keep" without "promises"), Distracted (missing "To prevent"); failed — Produce, Exception, Peculiar (the pale green top row). Results vary by several cards with small changes in corner placement.

**Assessment:** on-device reading of this vocabulary photo is **not reliable enough for weekly use**. The limit is the image: the definitions are about 8–9 pixels tall (the photo appears to be a downscaled copy — a phone camera photo is about 4032 × 3024), the page is curled, and the top row is pale text on green. Every imported card is still a draft that the parent must check and correct before approval, so nothing wrong reaches a child; but the parent would retype or fix most definitions. Recommended, in order: (1) try the full-resolution original photo from the phone; (2) use the phone's own text recognition (Live Text / Google Lens) and "Paste or type a list"; (3) if neither is good enough, the secure online reader described below (requires owner approval and a small cost).

### Table mode (added 2026-10-11)
For a vocabulary sheet laid out as a table of cards, the parent taps "Mark table corners" on the page, drags four handles (also movable with arrow keys) onto the table's outer corners and, optionally, enters how many cards go across and down. The app straightens the table (perspective correction), finds the card grid (ruling lines where visible, equal spacing otherwise), reads each card separately in five ways, and keeps the most confident, most agreed reading. Word and definition always come from the same card, so pairing errors come only from unreadable text. On synthetic card tables (straight or tilted 4° with shadow and noise) it reads 12/12 cards exactly.

**Earlier status (kept for the record):** real school photos were not available until 2026-10-11.

Synthetic pages (generated from the sample data, then rotated, shadowed, noised and JPEG-compressed to look photographed). These show the pipeline works; they are **not** evidence of real-photo accuracy:

| Synthetic page | Words | Definitions exact | Pairing | Order |
|---|---|---|---|---|
| Spelling list (3 numbered columns), 2° | 15/15 | — | — | 100% |
| Spelling list, 5° / 7° | 15/15 / 15/15 | — | — | 100% |
| Spelling list, 7° + heavy shadow, noise, JPEG 0.4 | 15/15 | — | — | 100% |
| Spelling list, −9° | 15/15 | — | — | 100% |
| Vocabulary table, 2° | 12/12 | 100% | 100% | — |
| Vocabulary table, 5° | 12/12 | 100% | 100% | — |
| Vocabulary table, 8° | 11/12 | 92% | 92% | — |
| Vocabulary table, 5° + heavy shadow, noise, JPEG 0.55 | 12/12 | 92% | 100% | — |
| Vocabulary table, 2° + very heavy shadow | 12/12 | 100% | 100% | — |

Before automatic straightening was added (Milestone 5 review), accuracy fell sharply beyond about 4° (e.g. spelling 7°: 4/15; vocabulary 8°: 5/12). The typical remaining failure is a small letter error ("Instaliment", "fryits"), which is why parent review is mandatory and why confidence warnings exist.

Speed (desktop, headless Chrome): clean pages 1–3 s; a real phone photo whose numbered list is incomplete about 20 s (it is read four more times); a table of 12 cards about 10–12 s. Phones are several times slower: expect up to 1–2 minutes for a difficult page (not measured on a device). Enlarged images are capped at 12 megapixels to stay within iPhone/iPad canvas limits. First use downloads the reader.

### Real teacher documents of other weeks (supplementary, 2026-10-11)
Before the owner supplied the original photographs, two of the teacher's real newsletters for other weeks were found in the parent's files and used as supplementary evidence. Neither is a camera photo: one is a clean digital rendering (Sept 28–Oct 2, two pages: newsletter + vocabulary page), the other a colourised redraw saved from ChatGPT (Sept 21–25). Ground truth was transcribed by eye. They stay in `local-fixtures/` (git-ignored) with `*.truth.json` files; `npm run test:ocr` scores them.

| Document | Before layout fix | After layout fix |
|---|---|---|
| Sept 28 newsletter: 15 spelling words | 1/15 | **15/15, teacher order 100%** (#7's number unreadable → placed as 7 and flagged; #15 read twice → flagged) |
| Sept 28 vocabulary page: 7 quiz words in a grid of cards | 2/7 words, 0% pairing | **7/7 words, 100% pairing, 6/7 definitions exact** ("pleasant" read as "blaasant", flagged as unsure) |
| Sept 21 newsletter (redraw, thin coloured fonts): 15 spelling words | 2/15 | **11/15**, 1 wrong ("HOMEWORK" read as #3, flagged); missing numbers listed for the parent |

The layout fix (Oct 11): a numbered list is found anywhere on the page even when the spelling box shares lines with a neighbouring box; a "1." read apart from its word is re-joined; vocabulary card grids are paired by column position; headings and notes no longer reach the review boxes; the "unsure" list only names words that are in the boxes.

## Known limits
- Handwriting is not supported reliably.
- Tilts up to about 7° are straightened automatically on synthetic pages; beyond about 8°, curled pages, dark or blurry photos lose accuracy. Hold the phone flat above the page and retake if many words are wrong.
- Complex newsletter layouts (text boxes, decorative fonts) may put lines in the wrong box; the parent can move lines between the boxes.
- The iPhone/iPad's own Live Text ("Paste or type a list") is often more accurate and is offered as a tip.

## Online photo reader (optional, added 2026-10-11)
Because on-device reading of the vocabulary photo is not reliable, the app can now use an online reader instead.
It is **off until the parent sets it up** (Settings → Online photo reader).

- `server/ocr-worker/`: a Cloudflare Worker the owner deploys. It holds the Anthropic API key (a Cloudflare secret, never in the browser or this repository), checks the page's origin and a shared passphrase, and asks Claude's vision model (default `claude-sonnet-5-5`) to transcribe the spelling list and the vocabulary words/definitions **exactly as printed**, through a forced tool call that returns `{ spelling: [{ number, word, unsure }], vocabulary: [{ word, definition, unsure }], notes }`. Nothing is stored on the server. Setup: `server/ocr-worker/README.md`.
- `js/cloudOcr.js`: settings (address + passphrase in this browser's localStorage, not in backups), sending the photo (JPEG, long side ≤ 2400 px), and turning the reply into draft items through the same `buildDraftItems` as on-device reading.
- When it is on, every uploaded photo (including vocabulary tables; no corner marking needed) is read online. If the server cannot be reached, refuses (passphrase, origin, size, daily limit) or fails, the photo is read on the device instead and the reason is kept with the source photo.
- Review is unchanged: every word is an unchecked draft; words the model marks as unsure get confidence 60% (below the 80% warning threshold) and a "check it against the photo" note; the reply text is kept with the source photo as the reader's transcription; the source records which reader read it.
- The page's Content-Security-Policy (`index.html`) allows connections only to this site and to `https://*.workers.dev`, so the reader must be deployed as a Cloudflare Worker on its workers.dev address (Settings refuses other addresses). Without this the browser blocks every request to the reader and each photo falls back to on-device reading.
- Privacy: with the reader on, worksheet photos leave the device and go to the owner's Worker and to Anthropic. The settings text says so and states the cost (a few cents per photo).
- Tests: `tests/unit/cloudOcr.test.mjs` (conversion, worker origin/passphrase/size checks, request to the API with a stubbed network) and the browser suite `onlineReader` (settings, a vocabulary photo read through a stubbed server into Check, fallback to on-device reading on a refusal).

**Accuracy on the real photos: not measured yet.** No API key exists in this environment. After deploying, run `READER_URL=… READER_PASSPHRASE=… npm run test:ocr:online` with the photos in `local-fixtures/` and record the results here. Note the vocabulary photo itself is low resolution (1152 × 1536, definitions about 8–9 px tall); a full-resolution phone photo will help any reader.
