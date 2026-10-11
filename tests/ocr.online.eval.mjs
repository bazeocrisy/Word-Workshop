// Online-reader accuracy on the real school photos, against the deployed reader server (Worker).
// Costs about 2–7 cents per photo on the owner's Anthropic account (2 photos ≈ 10 cents). Step-by-step: docs/ONLINE-READER-SETUP.md.
//
//   PowerShell:  $env:READER_URL = "https://word-workshop-reader.<you>.workers.dev"; npm run test:ocr:online
//   The passphrase is asked for at a prompt (not typed into the command line, so it stays out of the shell history).
//   PING_ONLY=1 → only the free connection check (no photo is sent, nothing is charged).
//
// Uses the same photos and truth files as `npm run test:ocr`:
//   local-fixtures/spelling*.jpg|png → sample-data/spelling.json
//   local-fixtures/vocab*.jpg|png    → sample-data/vocabulary.json
// Browsers send an Origin header; this sends the app's (READER_ORIGIN, default https://bazeocrisy.github.io) so the
// request looks like the app's. (Origin is not a lock; the passphrase is.)
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { ROOT } from './lib/harness.mjs';
import { spellingMetrics, vocabMetrics, pct } from './lib/ocrMetrics.mjs';
import { toReading } from '../js/cloudOcr.js';

// On-device results on the same photos (docs/OCR.md, measured 2026-10-11), for comparison.
const ON_DEVICE = { spelling: '14/15 words exact', vocab: 'as taken 3/12 words, 0/12 exact definitions; table mode at best 9/12 words, 4/12 exact definitions, 7/12 pairs' };

const { READER_URL, READER_ORIGIN = 'https://bazeocrisy.github.io', PING_ONLY } = process.env;
if (!READER_URL) { console.log('Set READER_URL to the reader server address (it ends in .workers.dev).'); process.exit(1); }
async function askPassphrase() {
  if (process.env.READER_PASSPHRASE) return process.env.READER_PASSPHRASE;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  rl._writeToOutput = (s) => { if (/Passphrase/.test(s)) process.stdout.write(s); }; // do not echo what is typed
  const p = await new Promise((r) => rl.question('Passphrase for the reader server: ', r));
  rl.close(); process.stdout.write('\n');
  return p.trim();
}
const PASS = await askPassphrase();
const post = (body) => fetch(READER_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Reader-Key': PASS, Origin: READER_ORIGIN }, body: JSON.stringify(body) });

// 1. Free check first: the server answers, the passphrase is right, and Anthropic accepts the key and model.
const ping = await post({ ping: true });
const pingBody = await ping.json().catch(() => ({}));
console.log(`Connection check: HTTP ${ping.status} ${ping.ok ? `OK (model ${pingBody.model})` : JSON.stringify(pingBody)}`);
if (!ping.ok) {
  console.log({ 401: 'Wrong passphrase.', 403: 'The server refused this origin (check ALLOWED_ORIGINS).', 500: 'The server is missing its key or passphrase, or the passphrase is shorter than 20 characters.', 502: 'Anthropic did not accept the API key or the model name.' }[ping.status] || 'Fix the server before measuring.');
  process.exit(1);
}
if (PING_ONLY) process.exit(0);

const dir = path.join(ROOT, 'local-fixtures');
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^(spelling|vocab).*\.(jpe?g|png)$/i.test(f)) : [];
if (!files.length) { console.log('BLOCKED: no spelling*/vocab* photos in local-fixtures/'); process.exit(0); }

const spellingTruth = JSON.parse(fs.readFileSync(path.join(ROOT, 'sample-data/spelling.json'), 'utf8')).words.sort((a, b) => a.order - b.order).map((w) => w.word);
const vocabTruth = JSON.parse(fs.readFileSync(path.join(ROOT, 'sample-data/vocabulary.json'), 'utf8')).items.sort((a, b) => a.order - b.order).map((i) => ({ word: i.word, definition: i.sourceDefinition }));

const summary = [];
for (const f of files) {
  const kind = /^spelling/i.test(f) ? 'spelling' : 'vocab';
  const bytes = fs.readFileSync(path.join(dir, f));
  const mediaType = /\.png$/i.test(f) ? 'image/png' : 'image/jpeg';
  const t0 = Date.now();
  const res = await post({ image: bytes.toString('base64'), mediaType, target: kind });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n=== ${f} (${kind}) · ${secs} s · HTTP ${res.status} ===`);
  if (!res.ok) { console.log(await res.text()); summary.push(`${f}: FAILED (HTTP ${res.status})`); continue; }
  const r = toReading(await res.json(), kind);
  if (r.notes.length) console.log('reader notes:', r.notes.join(' | '));
  if (kind === 'spelling') {
    const m = spellingMetrics(spellingTruth, r.spelling.map((x) => x.word));
    console.log(`spelling words: ${m.exactWords}/${m.expected} exact, order ${pct(m.orderAccuracy)}`);
    if (m.missing.length) console.log('  missing:', m.missing.join(', '));
    if (m.extra.length) console.log('  extra:', m.extra.join(', '));
    console.log('  flagged unsure:', r.spelling.filter((x) => x.unsure).map((x) => x.word).join(', ') || 'none');
    summary.push(`Spelling: online ${m.exactWords}/${m.expected} exact (order ${pct(m.orderAccuracy)}), ${secs} s · on device ${ON_DEVICE.spelling}`);
  } else {
    const m = vocabMetrics(vocabTruth, r.vocabulary);
    const exact = Math.round(m.definitionExact * m.expected), pairs = Math.round(m.pairingAccuracy * m.expected);
    console.log(`vocabulary words: ${m.wordsFound}/${m.expected}; definitions exact ${exact}/${m.expected}, character accuracy ${pct(m.definitionCharAccuracy)}; correct pairs ${pairs}/${m.expected}`);
    for (const p of m.problems) console.log('  ' + p);
    if (m.extraRows.length) console.log('  extra rows:', m.extraRows.join(', '));
    console.log('  flagged unsure:', r.vocabulary.filter((x) => x.unsure).map((x) => x.word).join(', ') || 'none');
    summary.push(`Vocabulary: online ${m.wordsFound}/${m.expected} words, ${exact}/${m.expected} exact definitions, ${pairs}/${m.expected} pairs, ${secs} s · on device ${ON_DEVICE.vocab}`);
  }
}
console.log('\nSUMMARY (record in docs/OCR.md → "Online photo reader → Accuracy on the real photos")');
for (const s of summary) console.log('- ' + s);
console.log('Every word still arrives as an unchecked draft; these numbers decide how much the parent has to correct.');
