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
window.__extract = async function (files, target, cornersList = [], gridList = []) {
  const { decode, toCanvas } = await import('./js/images.js');
  const ocr = await import('./js/ocr.js');
  const { extractPages } = await import('./js/views/importView.js');
  const { parseSpellingLines, parseVocabLines } = await import('./js/parse.js');
  const pages = []; const confs = []; const t0 = performance.now();
  for (const [i, f] of files.entries()) {
    const canvas = toCanvas(await decode(f), 2200);
    const res = cornersList[i] ? await ocr.readTable(canvas, cornersList[i], gridList[i] || {}) : await ocr.readPage(canvas, { target });
    pages.push(res); confs.push(res.confidence);
  }
  const lines = pages.flatMap((p) => p.lines);
  const ex = extractPages(pages, target);
  const toL = (t) => t.split(String.fromCharCode(10)).map((x) => ({ text: x, conf: ex.conf.get(x.trim()) ?? null }));
  return { ms: Math.round(performance.now() - t0), confidence: confs, rawLines: lines.map((l) => l.text),
    notes: ex.notes, spelling: parseSpellingLines(toL(ex.spText)).words.map((w) => w.word), vocab: parseVocabLines(toL(ex.voText)).rows.map((r) => ({ word: r.word, definition: r.definition, notes: r.notes })) };
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
      // <photo>.corners.json: the table corners a parent would mark ('careful' and 'rough' placements).
      const cornerFiles = mine.map((f) => path.join(dir, f.replace(/\.[^.]+$/, '') + '.corners.json'));
      const modes = [['as photographed (no corners marked)', mine.map(() => null)]];
      if (cornerFiles.some((cf) => fs.existsSync(cf))) {
        const specs = cornerFiles.map((cf) => (fs.existsSync(cf) ? JSON.parse(fs.readFileSync(cf, 'utf8')) : null));
        for (const which of ['careful', 'rough']) if (specs.some((sp) => sp && sp[which])) {
          modes.push([`table corners marked (${which}), card counts on Auto`, specs.map((sp) => (sp && sp[which]) || null), []]);
          if (specs.some((sp) => sp && sp.grid)) modes.push([`table corners marked (${which}), card counts entered (${specs.find((sp) => sp && sp.grid).grid.cols} × ${specs.find((sp) => sp && sp.grid).grid.rows})`, specs.map((sp) => (sp && sp[which]) || null), specs.map((sp) => (sp && sp.grid) || {})]);
        }
      }
      summary.real[kind] = {};
      for (const [label, corners, grids = []] of modes) {
        const out = await b.js(`const files = ${JSON.stringify(payload)}.map((p) => new File([Uint8Array.from(atob(p.b64), (c) => c.charCodeAt(0))], p.name, { type: p.type }));
          return await window.__extract(files, ${JSON.stringify(kind === 'vocab' ? 'vocab' : 'spelling')}, ${JSON.stringify(corners)}, ${JSON.stringify(grids)});`);
        summary.real[kind][label] = report(`REAL PHOTOS — ${kind} (${mine.join(', ')}) — ${label}`, kind, out);
        if (process.env.VERBOSE) console.log(out.rawLines.join('\n') + '\n--- rows ---\n' + (kind === 'vocab' ? out.vocab.map((r) => r.word + ' :: ' + r.definition).join('\n') : out.spelling.join(', ')));
      }
    }
  }

  // Any local-fixtures/<name>.truth.json: { label, files: [...], spelling: [...], vocab: [{word, definition}] }
  // scores those images against that transcription (used for real documents of other weeks).
  const truths = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.truth.json')) : [];
  summary.truthFiles = {};
  for (const tf of truths) {
    const truth = JSON.parse(fs.readFileSync(path.join(dir, tf), 'utf8'));
    const payload = truth.files.map((f) => ({ name: f, type: /png$/i.test(f) ? 'image/png' : 'image/jpeg', b64: fs.readFileSync(path.join(dir, f)).toString('base64') }));
    const out = await b.js(`const files = ${JSON.stringify(payload)}.map((p) => new File([Uint8Array.from(atob(p.b64), (c) => c.charCodeAt(0))], p.name, { type: p.type }));
      return await window.__extract(files, 'auto');`);
    console.log(`\n=== ${truth.label} ===`);
    console.log(`time ${out.ms} ms · reader confidence ${out.confidence.join(', ')}%`);
    const sm = spellingMetrics(truth.spelling, out.spelling);
    if (truth.spelling.length) {
      console.log(`spelling words: ${sm.exactWords}/${sm.expected} exact (recall ${pct(sm.wordRecall)}, precision ${pct(sm.wordPrecision)}), order ${pct(sm.orderAccuracy)}`);
      if (sm.missing.length) console.log('  missing:', sm.missing.join(', '));
      if (sm.extra.length) console.log('  extra (non-words imported as spelling):', sm.extra.join(' | '));
    }
    let vm = null;
    if (truth.vocab.length) {
      vm = vocabMetrics(truth.vocab, out.vocab);
      console.log(`vocabulary words: ${vm.wordsFound}/${vm.expected}; definitions exact ${pct(vm.definitionExact)}, character accuracy ${pct(vm.definitionCharAccuracy)}; pairing ${pct(vm.pairingAccuracy)}; extra rows ${vm.extraRows.length}`);
      for (const p of vm.problems) console.log('  ' + p);
    }
    if (process.env.VERBOSE) { console.log('--- raw reader lines ---\n' + out.rawLines.join('\n')); console.log('--- vocab rows ---\n' + out.vocab.map((r) => r.word + ' :: ' + r.definition).join('\n')); }
    summary.truthFiles[truth.label] = { spelling: sm, vocab: vm };
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
