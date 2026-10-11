// Milestone 7: every main screen at phone, tablet and desktop sizes — no sideways scrolling, tap targets ≥ 44 px,
// every control has an accessible name. SHOTS=1 saves screenshots to tests/screenshots/ (git-ignored).
import { APPROVED_SAMPLE } from './helpers.mjs';

const VIEWPORTS = [['small-phone', 320, 640], ['iphone-se', 375, 667], ['iphone', 390, 844], ['ipad-portrait', 768, 1024], ['ipad-landscape', 1024, 768], ['desktop', 1366, 900]];

const AUDIT = `
  const doc = document.documentElement;
  const wide = [...document.querySelectorAll('#app *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > doc.clientWidth + 1 && getComputedStyle(e).position !== 'fixed' && !e.closest('.table-wrap, .cw-wrap'); })
    .slice(0, 3).map((e) => e.tagName + '.' + e.className);
  const small = [...document.querySelectorAll('#app button, #app a.btn, #app .tile, #app select, #app input:not([type=checkbox]):not([type=radio]):not([type=file]), #app .check, #app .choice, #app .back-link')]
    .filter((e) => e.offsetParent && !e.closest('[hidden]') && !e.classList.contains('sr-only'))
    .map((e) => ({ t: (e.innerText || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 30), h: Math.round(e.getBoundingClientRect().height), w: Math.round(e.getBoundingClientRect().width) }))
    .filter((x) => x.h < 43.5 || x.w < 43.5);
  const unnamed = [...document.querySelectorAll('#app button, #app input, #app select, #app textarea, #app a[href]')].filter((e) => e.offsetParent || e.type === 'file')
    .filter((e) => {
      if (e.type === 'file' || e.type === 'hidden') return false;
      const label = e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || (e.id && document.querySelector('label[for="' + e.id + '"]')) || e.closest('label') || (e.textContent || '').trim() || e.title;
      return !label;
    }).slice(0, 3).map((e) => e.outerHTML.slice(0, 80));
  return { sw: doc.scrollWidth, cw: doc.clientWidth, wide, small: small.slice(0, 4), unnamed };`;

export default {
  name: 'responsive',
  async run({ b, check }) {
    await b.fresh();
    const { sid, wid } = await b.js(APPROVED_SAMPLE);
    // An unfinished lesson (sample words, nothing checked) for the wizard screens.
    const passage = await b.js(`const p = await WW.store.savePassage({ id: 'ps_resp', studentId: ${JSON.stringify(sid)}, title: 'The Busy Beaver', kind: 'text', paragraphs: ['Beavers are busy animals. They build dams across streams with sticks and mud.', 'A dam makes a pond.'], words: 20, createdAt: new Date().toISOString() }); return p.id;`);
    await b.js(`await WW.store.saveSfProgress(${JSON.stringify(sid)}, { introSeen: true, done: {}, current: null, engine: null }); return 1;`);
    const draft = await b.js(`const st = (await WW.store.listStudents())[1];
      const w = await WW.store.createWeek(st.id, { startDate: '2026-10-19', endDate: '2026-10-23' });
      const { sampleItems } = await import('./js/sample.js'); const s = await sampleItems();
      await WW.store.editWeek(w.id, (x) => { x.vocab = s.vocab; x.spelling = s.spelling; }, { action: 'test setup' });
      return w.id;`);
    const routes = [
      ['home', '#/'], ['student', `#/s/${sid}`], ['week', `#/s/${sid}/w/${wid}`],
      ['flashcard', `#/s/${sid}/w/${wid}/vocab/study`], ['vocab-practice', `#/s/${sid}/w/${wid}/vocab/practice?type=def-mc`],
      ['vocab-match', `#/s/${sid}/w/${wid}/vocab/practice?type=match`], ['spell-study', `#/s/${sid}/w/${wid}/spell/study`],
      ['parent', '#/parent'], ['editor', `#/parent/week/${wid}`], ['import', `#/parent/week/${wid}/import`],
      ['backup', '#/parent/backup'], ['settings', '#/parent/settings'], ['print', `#/print/${wid}`],
      ['lesson-new', '#/parent/new'], ['lesson-add', `#/parent/lesson/${draft}?stage=add`], ['lesson-check', `#/parent/lesson/${draft}?stage=check`],
      ['lesson-finish', `#/parent/lesson/${draft}?stage=finish`], ['results', '#/parent/results'],
      // Word Workshop 3.0 student screens
      ['kid-vocab', `#/s/${sid}/vocab`], ['kid-spelling', `#/s/${sid}/spelling`], ['kid-add', `#/s/${sid}/add/vocab`], ['kid-add-check', `#/s/${sid}/add/vocab?stage=check`],
      ['crossword', `#/s/${sid}/w/${wid}/vocab/crossword`], ['build', `#/s/${sid}/w/${wid}/spell/build`],
      ['reading', `#/s/${sid}/reading`], ['reading-add', `#/s/${sid}/reading/add`], ['reader', `#/s/${sid}/reading/${passage}`],
      ['sf-menu', `#/s/${sid}/sentence-fix`], ['sf-learn', `#/s/${sid}/sentence-fix/learn`], ['sf-learn-demo', `#/s/${sid}/sentence-fix/learn?skill=mixed`],
      ['sf-practice', `#/s/${sid}/sentence-fix/practice`], ['sf-lab', `#/s/${sid}/sentence-fix/lab?new=1`], ['sf-test', `#/s/${sid}/sentence-fix/test?new=1`], ['sf-results', `#/s/${sid}/sentence-fix/results`],
    ];
    for (const [vname, w, hgt] of VIEWPORTS) {
      await b.viewport(w, hgt);
      const fails = [];
      for (const [rname, hash] of routes) {
        await b.go('#/'); await b.go(hash);
        const r = await b.js(AUDIT);
        if (r.sw > r.cw || r.wide.length) fails.push(`${rname}: overflow ${JSON.stringify(r.wide)}`);
        if (r.small.length) fails.push(`${rname}: small ${JSON.stringify(r.small)}`);
        if (r.unnamed.length) fails.push(`${rname}: unnamed ${JSON.stringify(r.unnamed)}`);
        await b.shotIf(`${vname}-${rname}`);
      }
      check(`${vname} (${w}×${hgt}): no sideways scrolling, targets ≥ 44 px, every control named on ${routes.length} screens`, fails.length === 0, fails.slice(0, 6));
    }
    await b.viewport(390, 844);

    // Keyboard-only: a whole vocabulary practice question can be answered with the keyboard.
    await b.go(`#/s/${sid}/w/${wid}/vocab/practice?type=word-mc`);
    const kb = await b.js(`return document.activeElement.className + '|' + document.activeElement.tagName + '|' + document.querySelectorAll('[data-autofocus]').length;`);
    check('keyboard: focus starts on the question when a quiz opens', /q-instruction/.test(kb), kb);
  },
};
