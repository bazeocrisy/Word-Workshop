// Milestone 4: spelling study, practice, test, speech (mocked) and the no-speech fallback.
import { APPROVED_SAMPLE } from './helpers.mjs';

// A fake speech engine that records what was spoken and reports start/end like a real one.
const MOCK_SPEECH = `
  window.__spoken = [];
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
    speak(u) { window.__spoken.push({ text: u.text, rate: u.rate }); if (window.__silentSpeech) return; setTimeout(() => { u.onstart && u.onstart(); setTimeout(() => u.onend && u.onend(), 20); }, 5); },
    cancel() {}, getVoices() { return [{ name: 'Test voice', lang: 'en-US', localService: true }]; },
    addEventListener() {}, removeEventListener() {},
  } });`;
const NO_SPEECH = `Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true }); delete window.SpeechSynthesisUtterance;`;

const ready = `for (let i = 0; i < 100 && !window.WW?.ready; i++) await new Promise((r) => setTimeout(r, 50)); return 1;`;

export default {
  name: 'spelling',
  async run({ b, check, URL }) {
    const mock = await b.send('Page.addScriptToEvaluateOnNewDocument', { source: MOCK_SPEECH });
    try {
      await b.fresh();
      const { sid, wid } = await b.js(APPROVED_SAMPLE);
      const base = `#/s/${sid}/w/${wid}`;
      const words = ['rushed', 'blasted', 'washed', 'winked', 'opened', 'buzzed', 'asked', 'called', 'lifted', 'landed', 'hunted', 'screamed', 'stepped', 'handed', 'crashed'];

      // Study
      await b.go(`${base}/spell/study`);
      let t = await b.text();
      check('study lists all 15 words in teacher order', words.every((w) => t.includes(w)) && t.indexOf('rushed') < t.indexOf('blasted') && t.indexOf('handed') < t.indexOf('crashed'));
      check('every word shows its example sentence', (await b.js(`return document.querySelectorAll('.spell-sentence').length;`)) === 15);
      await b.js(`document.querySelector('.speak-btn').click(); await new Promise((r) => setTimeout(r, 80)); return 1;`);
      let spoken = await b.js(`return window.__spoken;`);
      check('tapping Word speaks the word', spoken.length === 1 && spoken[0].text === 'rushed', spoken);
      await b.js(`[...document.querySelectorAll('.speak-btn')][1].click(); await new Promise((r) => setTimeout(r, 80)); [...document.querySelectorAll('.speak-btn')][2].click(); await new Promise((r) => setTimeout(r, 80)); return 1;`);
      spoken = await b.js(`return window.__spoken;`);
      check('Slowly uses a slower rate; Sentence speaks the sentence', spoken[1].text === 'rushed' && spoken[1].rate < spoken[0].rate && /rushed to the bus stop/.test(spoken[2].text), spoken);
      await b.click('.seg .btn', '/Spelling patterns/');
      await b.wait(100);
      t = await b.text();
      check('spelling-pattern view: "stepped" is the only double-the-consonant word', /Double the last letter, then add -ed · 1/.test(t) && /step → stepped/.test(t) && /Just add -ed · 14/.test(t), t.slice(0, 600));
      await b.click('.seg .btn', '/Ending sounds/');
      await b.wait(100);
      t = await b.text();
      check('ending-sound view: /t/ 6, /d/ 4, /id/ 5 (separate from spelling patterns)', /sounds like \/t\/ · 6/.test(t) && /sounds like \/d\/ · 4/.test(t) && /\/id\/ \(extra syllable\) · 5/.test(t), t.slice(0, 400));

      // Practice
      await b.go(`${base}/spell/practice`);
      await b.click('.start-btn');
      await b.wait(150);
      const order = await b.js(`
        const k = Object.keys(sessionStorage).find((x) => x.includes(':spelling:practice:'));
        const d = JSON.parse(sessionStorage.getItem(k));
        const snap = await WW.store.getApprovedLesson(window.__W);
        const { spellingOrder } = await import('./js/views/spellQuiz.js');
        return spellingOrder(snap.spelling, { seed: d.seed, teacherOrder: false }).map((s) => s.word);`);
      spoken = await b.js(`return window.__spoken.slice(-1)[0];`);
      check('starting practice says the first word aloud (tap counts as permission on iPhone)', spoken && spoken.text === order[0], { spoken, first: order[0] });
      const html = await b.js(`return document.getElementById('app').innerHTML.toLowerCase();`);
      check('the word is not shown on screen before answering (sentence has a blank)', !html.includes(order[0]) && /_____/.test(html));
      await b.js(`const i = document.querySelector('.spell-input'); i.value = 'zzz'; i.dispatchEvent(new Event('input')); document.querySelector('form.question').requestSubmit(); await new Promise((r) => setTimeout(r, 80)); return 1;`);
      t = await b.text();
      check('practice: a wrong spelling gets immediate feedback with Try again', /Not quite/.test(t) && /Try again/.test(t) && !t.includes(order[0]));
      await b.js(`const i = document.querySelector('.spell-input'); i.value = '  ${'${'}0}'.replace('${'${'}0}', ''); return 1;`);
      await b.js(`const i = document.querySelector('.spell-input'); i.value = ' ' + ${JSON.stringify(order[0])}.toUpperCase() + ' '; i.dispatchEvent(new Event('input')); document.querySelector('form.question').requestSubmit(); await new Promise((r) => setTimeout(r, 80)); return 1;`);
      t = await b.text();
      check('practice: right spelling (any capitals, extra spaces) is accepted and shown', /Correct!/.test(t) && t.includes(order[0]));
      // finish the rest: word 2 wrong then show the answer, others right
      await b.js(`
        const order = ${JSON.stringify(order)};
        const next = () => [...document.querySelectorAll('.quiz-controls .btn')].find((x) => /Next|Finish/.test(x.textContent)).click();
        for (let i = 1; i < order.length; i++) {
          next(); await new Promise((r) => setTimeout(r, 50));
          const inp = document.querySelector('.spell-input');
          inp.value = i === 1 ? order[i] + 'x' : order[i]; inp.dispatchEvent(new Event('input'));
          document.querySelector('form.question').requestSubmit(); await new Promise((r) => setTimeout(r, 50));
          if (i === 1) { [...document.querySelectorAll('.fb .btn')].find((x) => /Show the word/.test(x.textContent)).click(); await new Promise((r) => setTimeout(r, 50)); }
        }
        next(); await new Promise((r) => setTimeout(r, 400)); return 1;`);
      let atts = await b.js(`return await WW.store.listAttempts({ studentId: window.__S });`);
      check('practice saved with first-try scoring (13/15: one wrong first try, one shown)', atts.length === 1 && atts[0].subject === 'spelling' && atts[0].mode === 'practice' && atts[0].score === 13 && atts[0].total === 15, atts.map((a) => [a.score, a.total]));
      t = await b.text();
      check('practice end offers "Practice missed words"', /Practice missed words/.test(t) && /Missed words \(2\)/.test(t));
      await b.click('a.btn', '/Practice missed words/');
      await b.settle();
      t = await b.text();
      check('missed-word practice contains only the 2 missed words', /2 words/.test(t), t.slice(0, 200));

      // Test
      await b.go(`${base}/spell/test`);
      await b.click('.start-btn');
      await b.wait(150);
      const torder = await b.js(`
        const k = Object.keys(sessionStorage).find((x) => x.includes(':spelling:test:'));
        const d = JSON.parse(sessionStorage.getItem(k));
        const snap = await WW.store.getApprovedLesson(window.__W);
        const { spellingOrder } = await import('./js/views/spellQuiz.js');
        return spellingOrder(snap.spelling, { seed: d.seed, teacherOrder: false }).map((s) => s.word);`);
      check('test order is mixed up (not the teacher order)', torder.join() !== words.join());
      const r = await b.js(`
        const order = ${JSON.stringify(torder)};
        const leaks = []; let sawFeedback = false;
        for (let i = 0; i < order.length; i++) {
          const page = (document.documentElement.outerHTML + document.title + location.href).toLowerCase();
          if (page.includes(order[i])) leaks.push(order[i]);
          const replay = window.__spoken.length; document.querySelector('.speak-btn').click(); await new Promise((r) => setTimeout(r, 40));
          if (window.__spoken.length !== replay + 1) leaks.push('no replay ' + i);
          const inp = document.querySelector('.spell-input');
          inp.value = i < 12 ? order[i] : (i === 12 ? order[i].slice(1) : ''); inp.dispatchEvent(new Event('input'));
          if (/Correct|Not quite/.test(document.getElementById('app').innerText)) sawFeedback = true;
          [...document.querySelectorAll('.quiz-controls .btn')].find((x) => /Next|Review/.test(x.textContent)).click(); await new Promise((r) => setTimeout(r, 40));
        }
        return { leaks, sawFeedback, text: document.getElementById('app').innerText };`);
      check('test: the correct spelling never appears in the page, title or URL before submitting', r.leaks.filter((x) => !/^no replay/.test(x)).length === 0, r.leaks);
      check('test: replay works for every word', !r.leaks.some((x) => /^no replay/.test(x)), r.leaks);
      check('test: no feedback before submitting', !r.sawFeedback);
      check('test: review lists the blank answers', /typed 13 of 15/.test(r.text) && /Not typed yet/.test(r.text), r.text.slice(0, 300));
      await b.click('.submit-test');
      await b.wait(150);
      await b.click('.dialog .btn-primary', '/Submit anyway/');
      await b.wait(500);
      t = await b.text();
      check('test result: 12/15 (80%) with correct and incorrect answers listed', /12 \/ 15/.test(t) && /80%/.test(t) && /no answer/.test(t) && /Correct answer:/.test(t), t.slice(0, 300));
      atts = await b.js(`return (await WW.store.listAttempts({ studentId: window.__S })).filter((a) => a.mode === 'test');`);
      check('test result saved with lesson version and missed words', atts.length === 1 && atts[0].snapshotVersion === 1 && atts[0].missed.length === 3 && atts[0].order === 'random');

      // Teacher order setting
      await b.js(`await WW.store.editWeek(window.__W, (w) => { w.settings.spellingTestOrder = 'teacher'; }, { action: 't' });
        const w = await WW.store.getWeek(window.__W); for (const it of w.spelling) it.reviewed = true; for (const it of w.vocab) it.reviewed = true;
        await WW.store.editWeek(window.__W, (x) => { x.spelling = w.spelling; x.vocab = w.vocab; }, { action: 't' }); await WW.store.approveWeek(window.__W); return 1;`);
      await b.go(base);
      await b.go(`${base}/spell/test`);
      await b.click('.start-btn'); await b.wait(150);
      spoken = await b.js(`return window.__spoken.slice(-1)[0].text;`);
      check('parent can choose teacher order for the test', spoken === 'rushed', spoken);
      await b.go(`${base}`);

      // Speech that never starts is reported honestly.
      await b.go(`${base}/spell/study`);
      await b.js(`window.__silentSpeech = true; document.querySelector('.speak-btn').click(); return 1;`);
      await b.wait(300);
      const early = await b.js(`return document.querySelector('.speak-status').textContent;`);
      await b.wait(4300);
      const late = await b.js(`return document.querySelector('.speak-status').textContent;`);
      check('never says "Playing…" when speech did not start; explains instead', !/Playing/.test(early) && /did not play/.test(late), { early, late });
    } finally {
      await b.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: mock.result.identifier });
    }

    // No speech at all on this device.
    const none = await b.send('Page.addScriptToEvaluateOnNewDocument', { source: NO_SPEECH });
    try {
      await b.load('about:blank');
      await b.load(URL + 'index.html#/');
      await b.js(ready);
      await b.js('sessionStorage.clear(); return 1;');
      const ids = await b.js(`return { sid: window.__S || (await WW.store.listStudents())[0].id, wid: (await WW.store.listWeeks((await WW.store.listStudents())[0].id))[0].id };`);
      await b.js(`window.__W = ${JSON.stringify(ids.wid)}; return 1;`);
      const base = `#/s/${ids.sid}/w/${ids.wid}`;
      await b.go(`${base}/spell/study`);
      let t = await b.text();
      check('no speech: study page says sound is unavailable and buttons are disabled', /Sound is not available/.test(t) && (await b.js(`return [...document.querySelectorAll('.spell-audio button')].every((x) => x.disabled);`)));
      await b.go(`${base}/spell/test`);
      t = await b.text();
      check('no speech: test explains the grown-up reads aloud, with a word list link', /Ask a grown-up to read each word/.test(t) && /grown-up's word list/.test(t));
      await b.click('.start-btn'); await b.wait(100);
      t = await b.text();
      check('no speech: words go in teacher order with a read-aloud prompt', /Grown-up: read word number 1/.test(t));
    } finally {
      await b.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: none.result.identifier });
    }
  },
};
