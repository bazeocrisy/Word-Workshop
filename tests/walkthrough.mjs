// Real-world walkthrough of the parent workflow (Add → Check → Finish) on the teacher's own worksheets, then the
// student opening the lesson. Drives the real UI and counts every parent action, every screen change and every
// correction needed because the photo reader got something wrong. Photos stay in git-ignored local-fixtures/.
//
// Run: node tests/walkthrough.mjs                      → Oct 12–16 photos (spelling-original.jpg, vocab-original.jpg)
//      FIXTURE=sept28 node tests/walkthrough.mjs       → Sept 28 newsletter (two clean pages)
//      VOCAB=table   … reads the vocabulary photo as a table of cards (corners from vocab-original.corners.json)
//      SENTENCES=helper … adds sentences with the copy/paste sentence helper instead of continuing without them
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, BASE, startServer, startBrowser } from './lib/harness.mjs';

const FIX = path.join(ROOT, 'local-fixtures');
const FIXTURE = process.env.FIXTURE || 'oct12';
const VOCAB_MODE = process.env.VOCAB || 'photo';
const SENTENCES = process.env.SENTENCES || 'skip';
let spellingFile, vocabFile, truth, label;
if (FIXTURE === 'sept28') {
  const t = JSON.parse(fs.readFileSync(path.join(FIX, 'sept28-newsletter.truth.json'), 'utf8'));
  spellingFile = 'sept28-newsletter-p1.png'; vocabFile = 'sept28-newsletter-p2.png';
  truth = { spelling: t.spelling, vocab: t.vocab };
  label = 'Sept 28–Oct 2 newsletter (2 clean pages, not camera photos)';
} else {
  spellingFile = 'spelling-original.jpg'; vocabFile = 'vocab-original.jpg';
  truth = {
    spelling: JSON.parse(fs.readFileSync(path.join(ROOT, 'sample-data/spelling.json'), 'utf8')).words.sort((a, b) => a.order - b.order).map((w) => w.word),
    vocab: JSON.parse(fs.readFileSync(path.join(ROOT, 'sample-data/vocabulary.json'), 'utf8')).items.sort((a, b) => a.order - b.order).map((i) => ({ word: i.word, definition: i.sourceDefinition })),
  };
  label = 'Oct 12–16 school photos (newsletter + 12-card vocabulary table, 1152 × 1536 phone photos)';
}
for (const f of [spellingFile, vocabFile]) if (!fs.existsSync(path.join(FIX, f))) { console.log(`BLOCKED: ${f} not found in local-fixtures/.`); process.exit(0); }
const corners = VOCAB_MODE === 'table' ? JSON.parse(fs.readFileSync(path.join(FIX, 'vocab-original.corners.json'), 'utf8')) : null;

const MOCK_SPEECH = `window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { speak(u) { setTimeout(() => { u.onstart && u.onstart(); setTimeout(() => u.onend && u.onend(), 10); }, 5); }, cancel() {}, getVoices() { return [{ name: 't', lang: 'en-US', localService: true }]; }, addEventListener() {}, removeEventListener() {} } });`;
// Count every change of screen (address path); stage changes inside the workspace do not change the screen.
const COUNT_SCREENS = `window.__screens = 0; let __p = location.hash.split('?')[0]; addEventListener('hashchange', () => { const p = location.hash.split('?')[0]; if (p !== __p) { window.__screens++; __p = p; } });`;

const steps = [];
const act = (what, n = 1, kind = 'click') => { if (n > 0) steps.push({ what, n, kind }); };
const fixes = { spelling: [], vocab: [] };
const server = await startServer();
const b = await startBrowser();
await b.send('Page.addScriptToEvaluateOnNewDocument', { source: MOCK_SPEECH + COUNT_SCREENS });
const U = server.origin + BASE;
const js = b.js;
const settle = async (ms = 200) => { await b.wait(ms); await js('await WW.whenRendered(); return 1;'); };
const click = async (sel, n = 0) => { await js(`const e = document.querySelectorAll(${JSON.stringify(sel)})[${n}]; if (!e) throw new Error('missing ' + ${JSON.stringify(sel)}); e.click(); return 1;`); await settle(); };
const typeInto = (sel, value, i = 0) => js(`const el = document.querySelectorAll(${JSON.stringify(sel)})[${i}]; if (!el) throw new Error('no ' + ${JSON.stringify(sel)}); el.focus(); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); await new Promise((r) => setTimeout(r, 250)); return 1;`);
const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ');
const sim = (a, b) => { a = norm(a).toLowerCase(); b = norm(b).toLowerCase(); if (!a || !b) return 0; const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return 1 - d[a.length][b.length] / Math.max(a.length, b.length); };
let typedChars = 0;

const upload = async (target, file) => {
  const payload = { name: file, type: /png$/i.test(file) ? 'image/png' : 'image/jpeg', b64: fs.readFileSync(path.join(FIX, file)).toString('base64') };
  const t0 = Date.now();
  await js(`const p = ${JSON.stringify(payload)}; const f = new File([Uint8Array.from(atob(p.b64), (c) => c.charCodeAt(0))], p.name, { type: p.type });
    const input = document.querySelector('input[type=file][data-target="${target}"]'); const dt = new DataTransfer(); dt.items.add(f); input.files = dt.files; input.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 400)); for (let i = 0; i < 1500 && document.querySelector('.ws-reading'); i++) await new Promise((r) => setTimeout(r, 200)); await new Promise((r) => setTimeout(r, 400)); return 1;`);
  return (Date.now() - t0) / 1000;
};
const rows = (kind) => js(`return [...document.querySelectorAll('.ws-table-${kind} .ws-row')].map((r) => ({ id: r.dataset.item, word: r.querySelector('.ws-word').value, def: r.querySelector('.ws-def')?.value ?? null }));`);

const t0 = Date.now();
let readSecs = 0;
let firstRead = null;
try {
  await b.viewport(1366, 900);
  await b.load(U + 'index.html'); await b.wait(400);
  await js('for (let i = 0; i < 100 && !window.WW?.ready; i++) await new Promise((r) => setTimeout(r, 50)); await WW.db.deleteDatabase(); sessionStorage.clear(); return 1;');
  await b.load('about:blank'); await b.load(U + 'index.html#/'); await b.wait(500);

  // ── Add ──
  await click('a.create-lesson'); act('Create this week\'s lesson (home page)');
  await js(`document.querySelector('input[name=ws-student]').click(); return 1;`); act('Choose the student (week defaults to the coming Monday–Friday)');
  readSecs += await upload('vocab', vocabFile); act('Upload vocabulary worksheet'); act('Choose the photo', 1, 'file');
  firstRead = { vocab: await rows('vocab') };
  if (VOCAB_MODE === 'table') {
    // Same photo read as a table of word cards: the parent drags the four corners and enters the card counts.
    await click('.ws-table-mode'); act('Words in a grid of cards? Read as a table');
    const c = corners.rough;
    await js(`const box = document.querySelector('.corner-stage').getBoundingClientRect(); const img = document.querySelector('.corner-img');
      const W = img.naturalWidth, H = img.naturalHeight; const pts = ${JSON.stringify(c)};
      [...document.querySelectorAll('.corner-handle')].forEach((hd, k) => { const x = box.left + pts[k].x / W * box.width, y = box.top + pts[k].y / H * box.height;
        hd.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y, pointerId: 1 })); hd.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x, clientY: y, pointerId: 1 })); hd.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x, clientY: y, pointerId: 1 })); });
      const sels = document.querySelectorAll('.grid-count'); sels[0].value = '${corners.grid.cols}'; sels[1].value = '${corners.grid.rows}'; return 1;`);
    act('Drag the four table corners', 4, 'drag'); act('Enter cards across and down', 2);
    const tr = Date.now();
    await js(`[...document.querySelectorAll('.dialog .btn-primary')].find((x) => /Read the cards/.test(x.textContent)).click();
      await new Promise((r) => setTimeout(r, 500)); for (let i = 0; i < 1500 && document.querySelector('.ws-reading'); i++) await new Promise((r) => setTimeout(r, 200)); await new Promise((r) => setTimeout(r, 600)); return 1;`);
    readSecs += (Date.now() - tr) / 1000; act('Read the cards');
    firstRead.vocabTable = await rows('vocab');
  }
  readSecs += await upload('spelling', spellingFile); act('Upload spelling worksheet (from the Spelling table)'); act('Choose the photo', 1, 'file');
  firstRead.spelling = await rows('spelling');
  const attentionBefore = await js(`return document.querySelectorAll('.ws-row.is-attention').length;`);

  // ── Check: correct what the reader got wrong, comparing with the sheet ──
  // Spelling: the list is numbered, so fix each position in place; add missing words; remove extras.
  let sp = await rows('spelling');
  for (let i = 0; i < truth.spelling.length; i++) {
    if (i < sp.length) {
      if (norm(sp[i].word) !== truth.spelling[i]) { await typeInto('.ws-table-spelling .ws-word', truth.spelling[i], i); typedChars += truth.spelling[i].length; act(`Fix spelling #${i + 1}: "${sp[i].word}" → "${truth.spelling[i]}"`, 1, 'type'); fixes.spelling.push(`#${i + 1} "${sp[i].word}" → "${truth.spelling[i]}"`); }
    } else {
      await click('.ws-add-row-spelling'); act('Add a missing spelling word');
      await typeInto('.ws-table-spelling .ws-word', truth.spelling[i], i); typedChars += truth.spelling[i].length; act(`Type "${truth.spelling[i]}"`, 1, 'type'); fixes.spelling.push(`missing #${i + 1} "${truth.spelling[i]}" added`);
    }
    sp = await rows('spelling');
  }
  while ((sp = await rows('spelling')).length > truth.spelling.length) {
    const last = sp.length - 1;
    await js(`const r = document.querySelectorAll('.ws-table-spelling .ws-row')[${last}]; r.querySelector('.ws-menu summary').click(); await new Promise((x) => setTimeout(x, 50)); r.querySelector('.ws-delete').click(); await new Promise((x) => setTimeout(x, 400)); return 1;`);
    act(`Remove extra spelling row "${sp[last].word}"`, 2); fixes.spelling.push(`extra "${sp[last].word}" removed`);
  }
  // Vocabulary: match rows to the sheet's words (order does not matter for vocabulary); fix word and definition
  // fields that differ; delete rows that match nothing; add words the reader missed.
  let vo = await rows('vocab');
  const used = new Set();
  for (const t of truth.vocab) {
    let best = -1, bs = 0.55;
    vo.forEach((r, i) => { if (used.has(i)) return; const s = Math.max(sim(r.word, t.word), 0.9 * sim(`${r.word} ${r.def}`, `${t.word} ${t.definition}`)); if (s > bs) { bs = s; best = i; } });
    if (best >= 0) {
      used.add(best);
      const r = vo[best];
      if (norm(r.word) !== t.word) { await typeInto('.ws-table-vocab .ws-word', t.word, best); typedChars += t.word.length; act(`Fix word "${r.word}" → "${t.word}"`, 1, 'type'); fixes.vocab.push(`word "${r.word}" → "${t.word}"`); }
      if (norm(r.def) !== t.definition) { await typeInto('.ws-table-vocab .ws-def', t.definition, best); typedChars += t.definition.length; act(`Fix definition of "${t.word}"`, 1, 'type'); fixes.vocab.push(`definition of ${t.word}: "${norm(r.def)}" → "${t.definition}"`); }
    } else t.missing = true;
  }
  const extras = vo.map((r, i) => ({ r, i })).filter((x) => !used.has(x.i)).reverse();
  for (const { r, i } of extras) {
    await js(`const row = document.querySelectorAll('.ws-table-vocab .ws-row')[${i}]; row.querySelector('.ws-menu summary').click(); await new Promise((x) => setTimeout(x, 50)); row.querySelector('.ws-delete').click(); await new Promise((x) => setTimeout(x, 400)); return 1;`);
    act(`Remove misread row "${r.word}"`, 2); fixes.vocab.push(`extra row "${r.word} – ${norm(r.def).slice(0, 40)}" removed`);
  }
  for (const t of truth.vocab.filter((x) => x.missing)) {
    await click('.ws-add-row-vocab'); act('Add a missing vocabulary word');
    const n = (await rows('vocab')).length - 1;
    await typeInto('.ws-table-vocab .ws-word', t.word, n); await typeInto('.ws-table-vocab .ws-def', t.definition, n);
    typedChars += t.word.length + t.definition.length; act(`Type "${t.word}" and its definition`, 2, 'type'); fixes.vocab.push(`missing "${t.word}" added`);
  }
  // Remaining "Needs attention" words were compared with the sheet and are right.
  let looks = 0;
  for (let g = 0; g < 80; g++) { const has = await js(`const x = document.querySelector('.ws-looks-right'); if (x) x.click(); return !!x;`); if (!has) break; looks++; await b.wait(250); }
  act('"Looks right" on a flagged word (after comparing with the photo)', looks);
  for (const k of ['vocab', 'spelling']) if (await js(`return !!document.querySelector('.ws-confirm-${k}');`)) { await click(`.ws-confirm-${k}`); act(`"I checked the ${k === 'vocab' ? 'vocabulary' : 'spelling'} words against the sheet"`); }

  // ── Sentences ──
  if (SENTENCES === 'helper') {
    const answer = async (kind) => js(`const items = (await WW.store.getWeek(location.hash.split('/')[3].split('?')[0]))['${kind === 'vocab' ? 'vocab' : 'spelling'}'];
      return items.map((it) => it.word + ': ' + 'We talked about the word ' + it.word + ' in class today.').join('\\n');`);
    for (const k of ['vocab', 'spelling']) {
      await js(`[...document.querySelectorAll('#ws-foot-${k} .btn-link')].find((x) => /Add sentences/.test(x.textContent)).click(); return 1;`); await settle(); act(`Open "Add sentences…" (${k})`);
      act('Copy the request'); act(`Paste the request into a writing helper, generate, copy the answer (${k})`, 3, 'external');
      const text = await answer(k);
      await js(`const tas = document.querySelectorAll('.dialog textarea'); tas[1].value = ${JSON.stringify(text)}; return 1;`); act('Paste the answer');
      await click('.dialog .btn-primary'); act('Use these sentences'); await settle(400);
    }
  }

  // ── Finish ──
  await click('.ws-next'); act('Finish');
  if (await js(`return !!document.querySelector('.fin-skip-sentences');`)) { await click('.fin-skip-sentences'); act('Continue without example sentences'); }
  const ready = await js(`return !!document.querySelector('.approve-btn');`);
  const finishText = await js(`return document.getElementById('app').innerText;`);
  if (!ready) throw new Error('Not ready to approve: ' + finishText.slice(0, 600));
  await click('.approve-btn'); act('Approve and give to the student');
  await settle(600);
  const wid = await js(`return location.hash.split('/')[4];`);
  const snap = await js(`return await WW.store.getApprovedLesson(${JSON.stringify(wid)});`);
  const parentScreens = await js('return window.__screens;');

  // ── Student ──
  const opened = await js(`return /Study/.test(document.getElementById('app').innerText) && /Practice/.test(document.getElementById('app').innerText) && /Test/.test(document.getElementById('app').innerText);`);
  await js(`document.querySelector('.tile').click(); await new Promise((r) => setTimeout(r, 300)); await WW.whenRendered(); return 1;`);
  const studyText = await js(`return document.getElementById('app').innerText.slice(0, 200);`);

  // ── Report ──
  const by = (kind) => steps.filter((s) => s.kind === kind).reduce((n, s) => n + s.n, 0);
  const parent = steps.filter((s) => s.kind !== 'external').reduce((n, s) => n + s.n, 0);
  const exactSp = truth.spelling.filter((w, i) => firstRead.spelling[i]?.word === w).length;
  const firstVo = firstRead.vocabTable || firstRead.vocab;
  const exactVoWords = truth.vocab.filter((t) => firstVo.some((r) => norm(r.word) === t.word)).length;
  const exactVoDefs = truth.vocab.filter((t) => firstVo.some((r) => norm(r.word) === t.word && norm(r.def) === t.definition)).length;
  // Estimated parent time: 3 s per click, 4 s per photo pick, 2 s per drag, 4 s + 0.35 s per character typed,
  // 3 s to compare each word with the sheet, plus the measured reading time (desktop; phones are slower).
  const words = truth.spelling.length + truth.vocab.length;
  const est = by('click') * 3 + by('file') * 4 + by('drag') * 2 + by('type') * 4 + typedChars * 0.35 + words * 3 + readSecs;
  console.log(`\nREAL-WORLD WALKTHROUGH — ${label}`);
  console.log(`Vocabulary photo read: ${VOCAB_MODE === 'table' ? 'as a table of cards (rough corners, 4 × 3)' : 'as taken'} · sentences: ${SENTENCES}`);
  console.log(`OCR (before any correction): spelling ${exactSp}/${truth.spelling.length} exact in place; vocabulary words ${exactVoWords}/${truth.vocab.length}, exact word+definition ${exactVoDefs}/${truth.vocab.length}.`);
  console.log(`"Needs attention" after reading: ${attentionBefore} words.`);
  console.log(`OCR corrections typed or removed: spelling ${fixes.spelling.length}, vocabulary ${fixes.vocab.length}`);
  for (const k of ['spelling', 'vocab']) fixes[k].forEach((f) => console.log(`  ${k}: ${f}`));
  console.log(`Approved: ${snap.spelling.length} spelling, ${snap.vocab.length} vocabulary; matches the sheets: spelling ${snap.spelling.map((s) => s.word).join() === truth.spelling.join() ? 'yes' : 'NO'}, vocabulary ${truth.vocab.every((t) => snap.vocab.some((v) => v.word === t.word && v.definition === t.definition)) ? 'yes' : 'NO'}`);
  console.log(`Student: lesson page with Study/Practice/Test ${opened ? 'yes' : 'NO'}; first tile opened: ${studyText.split('\n')[0]}`);
  console.log(`\nPARENT ACTIONS: ${parent} (clicks ${by('click')}, photo picks ${by('file')}, drags ${by('drag')}, typed fields ${by('type')} with ${typedChars} characters)${by('external') ? ` + ${by('external')} in another app` : ''}`);
  for (const s of steps) console.log(`  ${String(s.n).padStart(3)}  ${s.what}${s.kind === 'external' ? ' (other app)' : ''}`);
  console.log(`\nScreen changes for the parent: ${parentScreens} (home → lesson workspace → student lesson page); stages Add/Check/Finish switch on the same screen.`);
  console.log(`Photo reading time (desktop, headless): ${readSecs.toFixed(0)} s. Estimated parent time: about ${Math.round(est / 60)} min (${Math.round(est)} s; estimate, not timed with a person).`);
  console.log(`Errors: ${b.errors.length ? b.errors.join(' | ') : 'none'} · automated run ${((Date.now() - t0) / 1000).toFixed(0)} s`);
} finally { b.close(); server.close(); }
