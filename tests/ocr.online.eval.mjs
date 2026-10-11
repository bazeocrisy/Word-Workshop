// Online-reader accuracy on the real school photos (costs a few cents per photo on the owner's Anthropic account).
//
//   READER_URL=https://word-workshop-reader.<you>.workers.dev READER_PASSPHRASE=… npm run test:ocr:online
//
// Uses the same photos and truth files as `npm run test:ocr`:
//   local-fixtures/spelling*.jpg|png → sample-data/spelling.json
//   local-fixtures/vocab*.jpg|png    → sample-data/vocabulary.json
// The reader server only accepts requests from its ALLOWED_ORIGINS, so this sends that Origin header
// (READER_ORIGIN, default https://bazeocrisy.github.io).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/harness.mjs';
import { spellingMetrics, vocabMetrics, pct } from './lib/ocrMetrics.mjs';
import { toReading } from '../js/cloudOcr.js';

const { READER_URL, READER_PASSPHRASE, READER_ORIGIN = 'https://bazeocrisy.github.io' } = process.env;
if (!READER_URL || !READER_PASSPHRASE) { console.log('Set READER_URL and READER_PASSPHRASE.'); process.exit(1); }

const dir = path.join(ROOT, 'local-fixtures');
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^(spelling|vocab).*\.(jpe?g|png)$/i.test(f)) : [];
if (!files.length) { console.log('BLOCKED: no spelling*/vocab* photos in local-fixtures/'); process.exit(0); }

const spellingTruth = JSON.parse(fs.readFileSync(path.join(ROOT, 'sample-data/spelling.json'), 'utf8')).words.sort((a, b) => a.order - b.order).map((w) => w.word);
const vocabTruth = JSON.parse(fs.readFileSync(path.join(ROOT, 'sample-data/vocabulary.json'), 'utf8')).items.sort((a, b) => a.order - b.order).map((i) => ({ word: i.word, definition: i.sourceDefinition }));

for (const f of files) {
  const kind = /^spelling/i.test(f) ? 'spelling' : 'vocab';
  const bytes = fs.readFileSync(path.join(dir, f));
  const mediaType = /\.png$/i.test(f) ? 'image/png' : 'image/jpeg';
  const t0 = Date.now();
  const res = await fetch(READER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Reader-Key': READER_PASSPHRASE, Origin: READER_ORIGIN },
    body: JSON.stringify({ image: bytes.toString('base64'), mediaType, target: kind }),
  });
  console.log(`\n=== ${f} (${kind}) · ${Date.now() - t0} ms · HTTP ${res.status} ===`);
  if (!res.ok) { console.log(await res.text()); continue; }
  const r = toReading(await res.json(), kind);
  if (r.notes.length) console.log('notes:', r.notes.join(' | '));
  if (kind === 'spelling') {
    const m = spellingMetrics(spellingTruth, r.spelling.map((x) => x.word));
    console.log(`spelling words: ${m.exactWords}/${m.expected} exact, order ${pct(m.orderAccuracy)}`);
    if (m.missing.length) console.log('  missing:', m.missing.join(', '));
    if (m.extra.length) console.log('  extra:', m.extra.join(', '));
    console.log('  flagged unsure:', r.spelling.filter((x) => x.unsure).map((x) => x.word).join(', ') || 'none');
  } else {
    const m = vocabMetrics(vocabTruth, r.vocabulary);
    console.log(`vocabulary words: ${m.wordsFound}/${m.expected}; definitions exact ${pct(m.definitionExact)}, character accuracy ${pct(m.definitionCharAccuracy)}; pairing ${pct(m.pairingAccuracy)}`);
    for (const p of m.problems) console.log('  ' + p);
    console.log('  flagged unsure:', r.vocabulary.filter((x) => x.unsure).map((x) => x.word).join(', ') || 'none');
  }
}
