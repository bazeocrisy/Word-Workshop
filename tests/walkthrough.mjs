// Sunday-workflow walkthrough: drives the real UI the way a parent and a student would and counts every manual
// action. Uses the teacher newsletter pages in local-fixtures/ (git-ignored). Speech is simulated.
// Run: node tests/walkthrough.mjs   (needs local-fixtures/sept28-newsletter-p1.png and -p2.png)
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, BASE, startServer, startBrowser } from './lib/harness.mjs';

const FIX = path.join(ROOT, 'local-fixtures');
const pages = ['sept28-newsletter-p1.png', 'sept28-newsletter-p2.png'].map((f) => path.join(FIX, f));
if (!pages.every((p) => fs.existsSync(p))) { console.log('BLOCKED: newsletter pages not found in local-fixtures/.'); process.exit(0); }
const SENTENCE_MODE = process.env.SENTENCES || 'helper'; // 'helper' (copy/paste via a writing tool) or 'skip' (acknowledge "no sentence")

const MOCK_SPEECH = `window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { speak(u) { setTimeout(() => { u.onstart && u.onstart(); setTimeout(() => u.onend && u.onend(), 10); }, 5); }, cancel() {}, getVoices() { return [{ name: 't', lang: 'en-US', localService: true }]; }, addEventListener() {}, removeEventListener() {} } });`;

const steps = { parent: [], external: [], student: [] };
const act = (who, what, n = 1) => { steps[who].push({ what, n }); };

const server = await startServer();
const b = await startBrowser();
await b.send('Page.addScriptToEvaluateOnNewDocument', { source: MOCK_SPEECH });
const U = server.origin + BASE;
const js = b.js;
const settle = async (ms = 150) => { await b.wait(ms); await js('await WW.whenRendered(); return 1;'); };
const click = async (sel, text) => { await js(`const e = [...document.querySelectorAll(${JSON.stringify(sel)})].find((x) => ${text ? `/${text}/.test(x.textContent)` : 'true'}); if (!e) throw new Error('missing ' + ${JSON.stringify(sel + ' ' + (text || ''))}); e.click(); return 1;`); await settle(); };
b.go = async (hash) => { await js('location.hash = ' + JSON.stringify(hash) + '; await new Promise((r) => setTimeout(r, 60)); const l = [...document.querySelectorAll(".dialog .btn-primary")].find((x) => x.textContent === "Leave"); if (l) { l.click(); await new Promise((r) => setTimeout(r, 60)); } await WW.whenRendered(); return 1;'); await b.wait(80); };
const t0 = Date.now();
try {
  await b.viewport(390, 844);
  await b.load(U + 'index.html'); await b.wait(400);
  await js('await WW.db.deleteDatabase(); sessionStorage.clear(); return 1;');
  await b.load('about:blank'); await b.load(U + 'index.html#/'); await b.wait(500);

  // ── Parent: create the week ──
  await click('a', 'Parent area'); act('parent', 'Open Parent area');
  await click('.student-card .btn-primary', 'New week'); act('parent', 'New week');
  await click('.dialog .btn-primary', 'Create week'); act('parent', 'Create week (default Monday–Friday dates)');
  const wid = await js('return location.hash.split("/").pop();');

  // ── Upload and read ──
  await click('a.btn', 'Upload photos'); act('parent', 'Upload photos');
  const payload = pages.map((p) => ({ name: path.basename(p), b64: fs.readFileSync(p).toString('base64') }));
  await js(`const files = ${JSON.stringify(payload)}.map((p) => new File([Uint8Array.from(atob(p.b64), (c) => c.charCodeAt(0))], p.name, { type: 'image/png' }));
    const input = document.getElementById('photo-input'); const dt = new DataTransfer(); files.forEach((f) => dt.items.add(f)); input.files = dt.files; input.dispatchEvent(new Event('change'));
    for (let i = 0; i < 100 && document.querySelectorAll('.thumb-page').length < 2; i++) await new Promise((r) => setTimeout(r, 100)); return 1;`);
  act('parent', 'Choose photos (pick both pages at once)');
  const tRead = Date.now();
  await click('.read-btn'); act('parent', 'Read the photos');
  await js(`for (let i = 0; i < 900 && !document.querySelector('.commit-btn'); i++) await new Promise((r) => setTimeout(r, 200)); return 1;`);
  const readSecs = (Date.now() - tRead) / 1000;
  const review = await js(`return { sp: document.getElementById('ocr-spelling').value, vo: document.getElementById('ocr-vocab').value, notes: [...document.querySelectorAll('.import-notes li, .notice p')].map((x) => x.innerText), preview: document.querySelector('.paste-preview').innerText };`);

  // ── Correct what the reader got wrong (compare with the photo) ──
  const fixes = [];
  const vo = review.vo.replace(/enjoyable or \S+$/m, (m) => { if (m !== 'enjoyable or pleasant') fixes.push(`"${m}" → "enjoyable or pleasant"`); return 'enjoyable or pleasant'; });
  await js(`const t = document.getElementById('ocr-vocab'); t.value = ${JSON.stringify(vo)}; t.dispatchEvent(new Event('input')); return 1;`);
  fixes.forEach((f) => act('parent', `Correct a misread on the review screen: ${f}`));
  await click('.commit-btn'); act('parent', 'Add to the week as drafts');
  await settle(800);

  // ── Sentences ──
  let w = await js(`return await WW.store.getWeek(${JSON.stringify(wid)});`);
  const counts = { spelling: w.spelling.length, vocab: w.vocab.length };
  if (SENTENCE_MODE === 'helper') {
    // What a parent would paste back from a writing helper (ChatGPT etc.). Written here for the test.
    const spellSentences = { rings: 'Her phone rings at dinner time.', snacks: 'We packed snacks for the trip.', glasses: 'Grandpa wears glasses to read.', desks: 'Our desks are in a circle.', jumps: 'The frog jumps into the pond.', buzzes: 'A bee buzzes near the flowers.', crashes: 'The wave crashes on the sand.', shops: 'Mom shops for food on Saturday.', boxes: 'We stacked the boxes in the garage.', trees: 'The trees turn orange in the fall.', mends: 'Dad mends the hole in my jacket.', tables: 'The tables in the lunchroom are long.', flashes: 'The camera flashes when it takes a picture.', bushes: 'A rabbit hid in the bushes.', thanks: 'She said thanks for the gift.' };
    const vocabSentences = { sincere: 'His sincere smile showed he was really happy for me.', agreeable: 'The weather was agreeable, so we ate outside.', capable: 'She is capable of riding her bike without help.', impartial: 'The referee stayed impartial and treated both teams the same.', author: 'The author signed my copy of her book.', generous: 'Our generous neighbor shared his apples with us.', diligent: 'A diligent student checks her work carefully.' };
    for (const [sec, map] of [['spelling', spellSentences], ['vocab', vocabSentences]]) {
      await js(`[...document.querySelectorAll('.btn')].filter((x) => /Add example sentences/.test(x.textContent))[${sec === 'spelling' ? 0 : 1}].click(); return 1;`); await settle(); act('parent', `Open "Add example sentences" (${sec})`);
      act('parent', 'Copy the request'); act('external', `Paste the request into a writing helper, generate, copy the answer (${sec})`, 3);
      await js(`const tas = document.querySelectorAll('.dialog textarea'); tas[1].value = ${JSON.stringify(Object.entries(map).map(([k, v]) => `${k}: ${v}`).join('\n'))}; return 1;`); act('parent', 'Paste the answer');
      await click('.dialog .btn-primary', 'Use these sentences'); act('parent', 'Use these sentences'); await settle(400);
    }
  }

  // ── Review every item: read it against the photo, resolve warnings, tick "checked" ──
  w = await js(`return await WW.store.getWeek(${JSON.stringify(wid)});`);
  const before = await js(`return WW.model.approvalBlockers(await WW.store.getWeek(${JSON.stringify(wid)})).length;`);
  const r = await js(`
    const pause = () => new Promise((r) => setTimeout(r, 25)); let acks = 0, ticks = 0; const kinds = {};
    for (let g = 0; g < 800; g++) { const box = [...document.querySelectorAll('.ack-box')].find((x) => !x.checked); if (!box) break; const msg = box.closest('.flag').querySelector('.flag-msg').innerText; const k = msg.replace(/"[^"]*"/g, '"…"').slice(0, 70); kinds[k] = (kinds[k] || 0) + 1; box.click(); acks++; await pause(); }
    for (let g = 0; g < 800; g++) { const box = [...document.querySelectorAll('.reviewed-box')].find((x) => !x.checked); if (!box) break; box.click(); ticks++; await pause(); }
    await new Promise((r) => setTimeout(r, 400)); return { acks, ticks, kinds };`);
  act('parent', 'Acknowledge warnings (after checking each against the photo)', r.acks);
  act('parent', 'Tick "Checked against the sheet/list" for each word', r.ticks);
  await click('.approve-btn'); act('parent', 'Approve this week');
  w = await js(`return await WW.store.getWeek(${JSON.stringify(wid)});`);
  const snap = await js(`return await WW.store.getApprovedLesson(${JSON.stringify(wid)});`);

  // ── Student ──
  const sid = w.studentId; const base = `#/s/${sid}/w/${wid}`;
  await b.go('#/'); act('student', 'Choose own profile and the week', 2); await b.go(base);
  await b.go(`${base}/vocab/study`); act('student', 'Open vocabulary flashcards');
  for (let i = 1; i < snap.vocab.length; i++) { await click('.fc-nav .btn-primary'); } act('student', 'Next through flashcards', snap.vocab.length - 1);
  const flash = await js(`return { pics: document.querySelectorAll('.card-picture img').length, placeholder: !!document.querySelector('.card-picture-empty'), sentence: !!document.querySelector('.fc-sentence') };`);
  const answerVocab = async (mode, type) => {
    await b.go(base); await b.go(`${base}/vocab/${mode}?type=${type}`); act('student', `Open vocabulary ${mode} (${type})`, 2);
    const res = await js(`
      const [hp, hq = ''] = location.hash.split('?'); const qp = new URLSearchParams(hq);
      const key = Object.keys(sessionStorage).find((k) => k.endsWith(':vocab:${mode}:${type}:'));
      const d = JSON.parse(sessionStorage.getItem(key)); const snap = await WW.store.getApprovedLesson(${JSON.stringify(wid)});
      const { buildActivity } = await import('./js/vocab.js'); const qs = buildActivity('${type}', snap.vocab, { seed: d.seed }).questions;
      let actions = 0;
      for (let i = 0; i < qs.length; i++) {
        const q = qs[i];
        if (q.type === 'write') { const inp = document.querySelector('.answer-input'); inp.value = q.word; inp.dispatchEvent(new Event('input')); }
        else if (q.type === 'match') { q.pairs.forEach((p, k) => { const s = document.querySelectorAll('.match select')[k]; s.value = q.options.find((o) => o.text === p.correctText).key; s.dispatchEvent(new Event('change')); actions++; }); actions--; }
        else document.querySelector('input[value="' + q.answerKey + '"]').click();
        actions++;
        if ('${mode}' === 'practice') { document.querySelector('form.question').requestSubmit(); actions++; await new Promise((r) => setTimeout(r, 40)); }
        const nb = [...document.querySelectorAll('.quiz-controls .btn')].find((x) => /Next|Review|Finish/.test(x.textContent)); nb.click(); actions++; await new Promise((r) => setTimeout(r, 40));
      }
      if ('${mode}' === 'test') { document.querySelector('.submit-test').click(); actions++; await new Promise((r) => setTimeout(r, 400)); }
      return { n: qs.length, actions, text: document.getElementById('app').innerText.slice(0, 120) };`);
    act('student', `Answer ${res.n} questions (${mode}, ${type})`, res.actions);
    return res;
  };
  const vp = await answerVocab('practice', 'mixed');
  const vt = await answerVocab('test', 'mixed');
  const spell = async (mode) => {
    await b.go(base); await b.go(`${base}/spell/${mode}`); act('student', `Open spelling ${mode}`, 2);
    await click('.start-btn'); act('student', 'Start');
    const res = await js(`
      const key = Object.keys(sessionStorage).find((k) => k.includes(':spelling:${mode}:'));
      const d = JSON.parse(sessionStorage.getItem(key)); const snap = await WW.store.getApprovedLesson(${JSON.stringify(wid)});
      const { spellingOrder } = await import('./js/views/spellQuiz.js');
      const order = spellingOrder(snap.spelling, { seed: d.seed, teacherOrder: snap.settings.spellingTestOrder === 'teacher' }).map((s) => s.word);
      let actions = 0;
      for (let i = 0; i < order.length; i++) {
        const inp = document.querySelector('.spell-input'); inp.value = order[i]; inp.dispatchEvent(new Event('input')); actions++;
        if ('${mode}' === 'practice') { document.querySelector('form.question').requestSubmit(); actions++; await new Promise((r) => setTimeout(r, 40)); }
        const nb = [...document.querySelectorAll('.quiz-controls .btn')].find((x) => /Next|Review|Finish/.test(x.textContent)); nb.click(); actions++; await new Promise((r) => setTimeout(r, 40));
      }
      if ('${mode}' === 'test') { document.querySelector('.submit-test').click(); actions++; await new Promise((r) => setTimeout(r, 400)); }
      return { n: order.length, actions, text: document.getElementById('app').innerText.slice(0, 160) };`);
    act('student', `Type ${res.n} words (${mode})`, res.actions);
    return res;
  };
  await b.go(`${base}/spell/study`); act('student', 'Open spelling study (listen to words)');
  const sp = await spell('practice');
  const st = await spell('test');
  const attempts = await js(`return (await WW.store.listAttempts({ studentId: ${JSON.stringify(sid)} })).map((a) => ({ s: a.subject, m: a.mode, score: a.score, total: a.total, v: a.snapshotVersion }));`);

  // ── Report ──
  const sum = (who) => steps[who].reduce((n, s) => n + s.n, 0);
  console.log(`\nSUNDAY WALKTHROUGH (sentences: ${SENTENCE_MODE}) — Sept 28–Oct 2 teacher newsletter, 2 pages (not camera photos)`);
  console.log(`Imported: ${counts.spelling} spelling, ${counts.vocab} vocabulary. Reading time (desktop, headless): ${readSecs.toFixed(1)} s.`);
  console.log('Review-screen notes shown:', review.notes.filter((n) => !/Check the text against/.test(n)).join(' | ') || 'none');
  console.log(`Corrections typed on the review screen: ${fixes.length} (${fixes.join('; ') || '—'})`);
  console.log(`Approval blockers before review: ${before}. Warnings acknowledged: ${r.acks}. Items ticked: ${r.ticks}.`);
  console.log('Warning kinds:'); for (const [k, v] of Object.entries(r.kinds)) console.log(`  ${v} × ${k}`);
  console.log(`Approved version ${w.approvedVersion}: ${snap.spelling.length} spelling, ${snap.vocab.length} vocabulary; sentences: ${snap.vocab.filter((v) => v.sentence).length + snap.spelling.filter((s) => s.sentence).length}/${snap.vocab.length + snap.spelling.length}; pictures: ${snap.vocab.filter((v) => v.image).length}/${snap.vocab.length}`);
  console.log(`Flashcard on screen: picture ${flash.pics ? 'yes' : 'no'}${flash.placeholder ? ' ("Picture coming soon")' : ''}, sentence ${flash.sentence ? 'yes' : 'no'}`);
  console.log('Results saved:', JSON.stringify(attempts));
  for (const who of ['parent', 'external', 'student']) {
    console.log(`\n${who.toUpperCase()} actions: ${sum(who)}`);
    for (const s of steps[who]) console.log(`  ${String(s.n).padStart(3)}  ${s.what}`);
  }
  console.log(`\nErrors: ${b.errors.length ? b.errors.join(' | ') : 'none'} · automated run ${((Date.now() - t0) / 1000).toFixed(0)} s`);
} finally { b.close(); server.close(); }
