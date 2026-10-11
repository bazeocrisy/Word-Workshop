// Photo-extraction accuracy report.
//
// REAL PHOTOS: put the school photos in local-fixtures/ (git-ignored, never committed):
//   local-fixtures/spelling*.jpg|png   → compared with sample-data/spelling.json
//   local-fixtures/vocab*.jpg|png      → compared with sample-data/vocabulary.json
// Then run: npm run test:ocr
// Without real photos the real-photo section reports BLOCKED. The SYNTHETIC section (generated pages made to look
// photographed) only shows that the pipeline works; it is never evidence of real-photo accuracy.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, BASE, startServer, startBrowser } from './lib/harness.mjs';
import { SYNTHETIC } from './lib/synthetic.mjs';
import { spellingMetrics, vocabMetrics, pct } from './lib/ocrMetrics.mjs';

const spellingTruth = JSON.parse(fs.readFileSync(path.join(ROOT, 'sample-data/spelling.json'), 'utf8')).words.sort((a, b) => a.order - b.order).map((w) => w.word);
const vocabTruth = JSON.parse(fs.readFileSync(path.join(ROOT, 'sample-data/vocabulary.json'), 'utf8')).items.sort((a, b) => a.order - b.order).map((i) => ({ word: i.word, definition: i.sourceDefinition }));

// Same code path as the app's photo import: read each page, classify lines, parse.
const PIPELINE = `
window.__extract = async function (files, target) {
  const { decode, toCanvas } = await import('./js/images.js');
  const ocr = await import('./js/ocr.js');
  const { classifyLines } = await import('./js/views/importView.js');
  const { parseSpellingLines, parseVocabLines } = await import('./js/parse.js');
  const lines = []; const confs = []; const t0 = performance.now();
  for (const f of files) { const res = await ocr.readPage(toCanvas(await decode(f), 2200)); lines.push(...res.lines); confs.push(res.confidence); }
  const cls = classifyLines(lines, target);
  return { ms: Math.round(performance.now() - t0), confidence: confs, rawLines: lines.map((l) => l.text),
    spelling: parseSpellingLines(cls.spelling).words.map((w) => w.word), vocab: parseVocabLines(cls.vocab).rows.map((r) => ({ word: r.word, definition: r.definition, notes: r.notes })) };
};`;

function report(label, kind, out) {
  console.log(`\n=== ${label} ===`);
  console.log(`time ${out.ms} ms · reader confidence ${out.confidence.join(', ')}%`);
  if (kind === 'spelling') {
    const m = spellingMetrics(spellingTruth, out.spelling);
    console.log(`spelling words: ${m.exactWords}/${m.expected} exact (recall ${pct(m.wordRecall)}, precision ${pct(m.wordPrecision)}), order ${pct(m.orderAccuracy)}`);
    if (m.missing.length) console.log('  missing:', m.missing.join(', '));
    if (m.extra.length) console.log('  extra:', m.extra.join(', '));
    return m;
  }
  const m = vocabMetrics(vocabTruth, out.vocab);
  console.log(`vocabulary words: ${m.wordsFound}/${m.expected} (recall ${pct(m.wordRecall)}); definitions exact ${pct(m.definitionExact)}, character accuracy ${pct(m.definitionCharAccuracy)}; word–definition pairing ${pct(m.pairingAccuracy)}`);
  for (const p of m.problems) console.log('  ' + p);
  if (m.extraRows.length) console.log('  extra rows:', m.extraRows.join(', '));
  return m;
}

const server = await startServer();
const b = await startBrowser();
const summary = { real: 'BLOCKED: no photos in local-fixtures/', synthetic: {} };
try {
  await b.load(server.origin + BASE + 'index.html');
  await b.wait(500);
  await b.js(SYNTHETIC + PIPELINE + ' return 1;');

  // Real photos
  const dir = path.join(ROOT, 'local-fixtures');
  const photos = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)) : [];
  if (!photos.length) console.log('\nREAL PHOTOS: BLOCKED — no photos found in local-fixtures/. Accuracy on the real school photos has NOT been measured.');
  else {
    summary.real = {};
    for (const kind of ['spelling', 'vocab']) {
      const mine = photos.filter((f) => f.toLowerCase().startsWith(kind));
      if (!mine.length) { console.log(`\nREAL PHOTOS (${kind}): none named ${kind}*`); continue; }
      const payload = mine.map((f) => ({ name: f, type: /png$/i.test(f) ? 'image/png' : 'image/jpeg', b64: fs.readFileSync(path.join(dir, f)).toString('base64') }));
      const out = await b.js(`const files = ${JSON.stringify(payload)}.map((p) => new File([Uint8Array.from(atob(p.b64), (c) => c.charCodeAt(0))], p.name, { type: p.type }));
        return await window.__extract(files, ${JSON.stringify(kind === 'vocab' ? 'vocab' : 'spelling')});`);
      summary.real[kind] = report(`REAL PHOTOS — ${kind} (${mine.join(', ')})`, kind, out);
      if (process.env.VERBOSE) console.log(out.rawLines.join('\n'));
    }
  }

  // Synthetic pages (pipeline check only)
  const CASES = [['spelling', {}], ['vocab', {}], ['spelling', { rotate: 5 }], ['spelling', { rotate: 7 }], ['spelling', { rotate: -9 }], ['vocab', { rotate: 5 }], ['vocab', { rotate: 8 }], ['vocab', { rotate: 5, shadow: 0.7, noise: 30, quality: 0.55 }], ['spelling', { rotate: 7, shadow: 0.7, noise: 30, quality: 0.4 }], ['vocab', { rotate: 2, shadow: 0.9 }]];
  for (const [kind, opts] of CASES) {
    const out = await b.js(`const f = await window.__makeSynthetic(${JSON.stringify(kind)}, ${JSON.stringify(opts)}); return await window.__extract([f], 'auto');`);
    const label = `SYNTHETIC (not a real photo) — ${kind} ${JSON.stringify(opts)}`;
    summary.synthetic[label] = report(label, kind, out);
  }
} finally { b.close(); server.close(); }
fs.mkdirSync(path.join(ROOT, 'tests', 'output'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'tests', 'output', 'ocr-report.json'), JSON.stringify(summary, null, 2));
console.log('\nSaved tests/output/ocr-report.json (git-ignored).');
