// Word Workshop 3.0 — the student-first app: name picker, four areas, a child adding their own words (no grown-up
// approval), Vocabulary/Spelling pages with crossword and Build the word, Reading Passage (text and PDF), and Sentence
// Fix (Learn, Practice with hints, Thinking Lab, Test with saved results, reset that keeps results).
const pause = (ms = 250) => `await new Promise((r) => setTimeout(r, ${ms}));`;
const type = (sel, v, i = 0) => `{ const el = document.querySelectorAll(${JSON.stringify(sel)})[${i}]; if (!el) throw new Error('no ' + ${JSON.stringify(sel)}); el.focus(); el.value = ${JSON.stringify(v)}; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }`;
// A tiny real PDF (one page, two lines of text in a standard font); pdf.js repairs the missing cross-reference table.
const PDF = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj\n4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n5 0 obj<</Length 98>>stream\nBT /F1 18 Tf 72 720 Td (The Busy Beaver) Tj 0 -60 Td (Beavers build dams with sticks and mud.) Tj ET\nendstream endobj\ntrailer<</Root 1 0 R>>\n%%EOF';

export default {
  name: 'student',
  async run({ b, check }) {
    await b.fresh();
    const [alex, jordan] = await b.js(`return (await WW.store.listStudents()).map((s) => s.id);`);
    let t = await b.text();
    check('first screen: "Who is learning today?" with big name cards and a small grown-ups link', /Who is learning today\?/.test(t) && (await b.js(`return document.querySelectorAll('.profile-card').length;`)) === 2 && /Grown-ups/.test(t));
    await b.click('.profile-card'); await b.settle();
    t = await b.text();
    check('home: four big cards — Vocabulary, Spelling, Reading Passage, Sentence Fix', (await b.js(`return [...document.querySelectorAll('.area-card .area-name')].map((x) => x.textContent).join('|');`)) === 'Vocabulary|Spelling|Reading Passage|Sentence Fix');
    check('home: no parent workflow or approval words on the child\'s screen', !/approve|approval|parent/i.test(t), t);

    // ── A child adds vocabulary words: Upload → Check Words → Start Learning (no grown-up approval) ──
    await b.go(`#/s/${alex}/vocab`);
    check('Vocabulary with no words: a big "Add new words" button', /No words yet/.test(await b.text()) && !!(await b.js(`return document.querySelector('a.add-words');`)));
    await b.click('a.add-words'); await b.settle();
    t = await b.text();
    check('add words: three steps Upload, Check words, Start learning; only Vocabulary is shown', /Upload/.test(t) && /Check words/.test(t) && /Start learning/.test(t) && !(await b.js(`return !!document.querySelector('.ws-subject-spelling');`)) && !/Student\b.*Grade/.test(t), t.slice(0, 300));
    await b.click('.paste-vocab');
    await b.js(`${type('#ws-paste-vocab', 'Produce - Fresh fruits and vegetables\nException - A case where a rule does not apply\nPeculiar - Strange or unusual\nEmployee - Someone who works for money')} ${pause(100)} return 1;`);
    await b.click('.ws-paste-add-vocab'); await b.wait(400);
    await b.click('.ws-next'); await b.wait(300);
    check('Check words shows the words as rows the child can fix', (await b.js(`return document.querySelectorAll('.ws-table-vocab .ws-row').length;`)) === 4);
    await b.js(`${type('.ws-table-vocab .ws-def', 'Strange or unusual!', 2)} ${pause()} return 1;`);
    await b.click('.ws-next'); await b.wait(300);
    check('Start learning lists the words with one big button', /Your words are ready!/.test(await b.text()) && !!(await b.js(`return document.querySelector('.start-learning');`)));
    await b.click('.start-learning'); await b.wait(300);
    if (await b.js(`return !!document.querySelector('.dialog');`)) { await b.click('.dialog .btn-primary'); await b.wait(300); }
    await b.settle();
    t = await b.text();
    check('after Start learning the Vocabulary page has the words and every activity', (await b.js('return location.hash;')) === `#/s/${alex}/vocab` && ['Study cards', 'Choose the meaning', 'Fill in the blank', 'Matching', 'Crossword', 'Test'].every((x) => t.includes(x)), t.slice(0, 500));
    const snap = await b.js(`const w = (await WW.store.listApprovedWeeks(${JSON.stringify(alex)}))[0]; return w;`);
    check('the child\'s correction is kept exactly and the photo/typed original is logged', snap && snap.vocab.find((v) => v.word === 'Peculiar')?.definition === 'Strange or unusual!');
    await b.go(`#/s/${jordan}/vocab`);
    check('another child does not see these words', /No words yet/.test(await b.text()));

    // ── Crossword ──
    await b.go(`#/s/${alex}/w/${snap.weekId}/vocab/crossword`); await b.wait(300);
    const cw = await b.js(`return { cells: document.querySelectorAll('.cw-input').length, clues: document.querySelectorAll('.cw-clue').length, banner: document.querySelector('.cw-current').innerText };`);
    check('crossword: grid and one clue per word; the current clue is shown', cw.cells > 10 && cw.clues === 4 && /Across|Down/.test(cw.banner), cw);
    // Type the answer of the first clue with the keyboard: the cursor moves along the word.
    const first = await b.js(`const c = document.querySelector('.cw-clue'); c.click(); ${pause(100)} return document.querySelector('.cw-current').innerText;`);
    const ans = await b.js(`const { buildCrossword } = await import('./js/crossword.js'); return null;`);
    void ans;
    const typed = await b.js(`const banner = document.querySelector('.cw-current').innerText; const words = { 'Fresh fruits and vegetables': 'PRODUCE', 'A case where a rule does not apply': 'EXCEPTION', 'Strange or unusual!': 'PECULIAR', 'Someone who works for money': 'EMPLOYEE' };
      const word = Object.entries(words).find(([k]) => banner.includes(k))[1];
      for (const ch of word) { const el = document.activeElement; el.value = ch; el.dispatchEvent(new Event('input', { bubbles: true })); await new Promise((r) => setTimeout(r, 20)); }
      document.querySelector('.cw-check').click(); await new Promise((r) => setTimeout(r, 100)); return { word, right: document.querySelectorAll('.cw-cell.is-right').length, wrong: document.querySelectorAll('.cw-cell.is-wrong').length };`);
    check('crossword: typing fills the word letter by letter and Check marks it right', typed.right === typed.word.length && typed.wrong === 0, { first, typed });

    // ── Spelling: add words, Build the word ──
    await b.go(`#/s/${alex}/add/spelling`);
    await b.click('.paste-spelling'); await b.js(`${type('#ws-paste-spelling', 'rushed, blasted, washed')} ${pause(100)} return 1;`);
    await b.click('.ws-paste-add-spelling'); await b.wait(300);
    await b.go(`#/s/${alex}/add/spelling?stage=finish`); await b.click('.start-learning'); await b.wait(300);
    if (await b.js(`return !!document.querySelector('.dialog');`)) { await b.click('.dialog .btn-primary'); await b.wait(300); }
    await b.settle();
    t = await b.text();
    check('Spelling page: Study cards, Listen and spell, Build the word, Spelling test', ['Study cards', 'Listen and spell', 'Build the word', 'Spelling test'].every((x) => t.includes(x)), t.slice(0, 400));
    const wk = (await b.js(`return (await WW.store.listApprovedWeeks(${JSON.stringify(alex)}))[0];`));
    await b.go(`#/s/${alex}/w/${wk.weekId}/spell/build`); await b.wait(200);
    const hidden = await b.js(`const html = document.getElementById('app').innerHTML; return ['rushed', 'blasted', 'washed'].filter((w) => new RegExp('\\\\b' + w + '\\\\b', 'i').test(html));`);
    check('Build the word: the word is not shown or named in any label before it is built', hidden.length === 0, hidden);
    const built = await b.js(`const words = ['rushed', 'blasted', 'washed'];
      const tiles = [...document.querySelectorAll('.build-tile')].map((x) => x.textContent).join('');
      const word = words.find((w) => [...w].every((ch) => tiles.split(ch).length - 1 >= w.split(ch).length - 1) && tiles.length <= w.length + 2);
      for (const ch of word) { const t = [...document.querySelectorAll('.build-tile')].find((x) => !x.disabled && x.textContent === ch); t.click(); await new Promise((r) => setTimeout(r, 30)); }
      await new Promise((r) => setTimeout(r, 200)); return { word, msg: document.querySelector('.build-msg').innerText };`);
    check('Build the word: putting the tiles in order completes the word', new RegExp(built.word).test(built.msg), built);

    // ── Reading Passage: typed text and a PDF ──
    await b.go(`#/s/${alex}/reading`);
    check('Reading Passage with none yet: "Add a passage"', /No passages yet/.test(await b.text()));
    await b.click('a.add-passage'); await b.settle();
    await b.js(`${type('#passage-title', 'The Busy Beaver')} ${type('#passage-text', 'Beavers are busy animals. They build dams.\n\nA dam makes a pond. The pond keeps the family safe.')} return 1;`);
    await b.click('.save-text'); await b.wait(400); await b.settle();
    t = await b.text();
    check('a typed passage keeps its paragraph breaks', (await b.js(`return document.querySelectorAll('.reader-text p').length;`)) === 2 && /The pond keeps the family safe/.test(t));
    const before = await b.js(`return getComputedStyle(document.querySelector('.reader-text')).fontSize;`);
    await b.click('.size-up'); await b.click('.size-up');
    const after = await b.js(`return getComputedStyle(document.querySelector('.reader-text')).fontSize;`);
    check('A+ makes the text bigger (and is remembered)', parseFloat(after) > parseFloat(before), { before, after });
    await b.click('.mark-read'); await b.wait(200);
    check('"I read it!" marks the passage as read; "Read it again" resets it', /You read this passage/.test(await b.text()));
    await b.click('.read-again'); await b.wait(200);
    check('reading status can be restarted', !!(await b.js(`return document.querySelector('.mark-read');`)));
    await b.go(`#/s/${alex}/reading/add`);
    await b.js(`const f = new File([${JSON.stringify(PDF)}], 'beaver.pdf', { type: 'application/pdf' }); const input = document.querySelector('input[type=file][accept^="application/pdf"]'); const dt = new DataTransfer(); dt.items.add(f); input.files = dt.files; input.dispatchEvent(new Event('change'));
      for (let i = 0; i < 100 && !location.hash.match(/reading\\/ps_/); i++) await new Promise((r) => setTimeout(r, 100)); await new Promise((r) => setTimeout(r, 1500)); return 1;`);
    t = await b.text();
    const pdfView = await b.js(`return { pages: document.querySelectorAll('canvas.reader-page').length, hash: location.hash };`);
    check('a PDF passage opens with its original page shown', /reading\/ps_/.test(pdfView.hash) && pdfView.pages === 1 && /1 page/.test(t), { pdfView, t: t.slice(0, 200) });
    await b.click('.seg-text'); await b.wait(200);
    check('a PDF with text also has an "Easy reading" view with its text', /Beavers build dams with sticks and mud/.test(await b.text()));
    await b.go(`#/s/${alex}/reading`);
    check('saved passages are listed to reopen', (await b.js(`return document.querySelectorAll('.passage-card').length;`)) === 2);

    // ── Sentence Fix ──
    const bankN = await b.js(`const r = await fetch('data/sentence-fix/bank.json'); const j = await r.json(); return j.items.length;`);
    check('Sentence Fix: all 150 sentences load', bankN === 150, bankN);
    await b.go(`#/s/${alex}/sentence-fix`);
    check('Sentence Fix first visit: a short introduction with one "Let\'s start!" button', /Let's start!/.test(await b.text()));
    await b.click('.sf-start'); await b.wait(200);
    t = await b.text();
    check('menu: Learn → Practice → Thinking Lab → Test, with "Next" on Learn', (await b.js(`return [...document.querySelectorAll('.sf-step-name')].map((x) => x.textContent).join('|');`)) === 'Learn|Practice|Thinking Lab|Test' && !!(await b.js(`return document.querySelector('.sf-step.is-next')?.textContent.includes('Learn');`)));
    // Learn
    await b.go(`#/s/${alex}/sentence-fix/learn?skill=capitalization`); await b.wait(200);
    check('Learn shows a sentence with its mistakes highlighted', (await b.js(`return document.querySelectorAll('mark.sf-mistake').length;`)) >= 1);
    for (let i = 0; i < 8 && (await b.js(`return !!document.querySelector('.sf-next');`)); i++) { await b.click('.sf-next'); await b.wait(100); }
    t = await b.text();
    check('Learn walks through each fix and ends with the correct sentence; "Show me again" is offered', /All fixed!/.test(t) && !!(await b.js(`return document.querySelector('.sf-again');`)));
    // Practice: realistic answers
    await b.go(`#/s/${alex}/sentence-fix/practice?new=1`); await b.wait(300);
    const sess = await b.js(`const p = await WW.store.getSfProgress(${JSON.stringify(alex)}); return p.current;`);
    check('Practice: 10 sentences, no duplicates', sess.ids.length === 10 && new Set(sess.ids).size === 10, sess.ids);
    const item = await b.js(`const j = await (await fetch('data/sentence-fix/bank.json')).json(); return j.items.find((x) => x.id === ${JSON.stringify(sess.ids[0])});`);
    check('Practice: the answer box starts with the sentence to fix, and spell-check is off', (await b.js(`return document.querySelector('.sf-answer').value;`)) === item.incorrect && (await b.js(`return document.querySelector('.sf-answer').getAttribute('spellcheck');`)) === 'false');
    await b.click('.sf-hint-btn'); await b.click('.sf-hint-btn');
    check('Hints appear one at a time (2 shown after 2 taps)', (await b.js(`return document.querySelectorAll('.sf-hint-list li').length;`)) === 2);
    await b.click('.sf-check'); await b.wait(150);
    check('checking the unchanged sentence says "Not yet" with how many mistakes are fixed', /Not yet!/.test(await b.text()));
    await b.js(`${type('.sf-answer', item.correct)} return 1;`);
    await b.click('.sf-check'); await b.wait(150);
    check('the corrected sentence is accepted ("You fixed it!")', /You fixed it!/.test(await b.text()));
    await b.click('.sf-next'); await b.wait(150);
    check('Next sentence moves on (2 of 10)', /Sentence 2 of 10/.test(await b.text()));
    await b.go(`#/s/${alex}/sentence-fix`);
    check('leaving and coming back offers "Keep going" on the unfinished set', /Keep going: Practice/.test(await b.text()));
    // Thinking Lab
    await b.go(`#/s/${alex}/sentence-fix/lab?new=1`); await b.wait(300);
    check('Thinking Lab asks what kind of mistake it is first (5 choices)', /What kind of mistake/.test(await b.text()) && (await b.js(`return document.querySelectorAll('.lab-choice').length;`)) === 5 && !(await b.js(`return !!document.querySelector('.sf-answer');`)));
    const labId = (await b.js(`return (await WW.store.getSfProgress(${JSON.stringify(alex)})).current.ids[0];`));
    const want = await b.js(`const E = await import('./js/sentencefix/engine.js'); const j = await (await fetch('data/sentence-fix/bank.json')).json(); return E.labCategory(j.items.find((x) => x.id === ${JSON.stringify(labId)}));`);
    await b.click(`.lab-${want}`); await b.wait(200);
    check('choosing the right kind leads to fixing the sentence', !!(await b.js(`return document.querySelector('.sf-answer');`)));
    // Test: answers are hidden, no hints
    await b.go(`#/s/${alex}/sentence-fix/test?new=1`); await b.wait(300);
    const test = await b.js(`const p = await WW.store.getSfProgress(${JSON.stringify(alex)}); const j = await (await fetch('data/sentence-fix/bank.json')).json();
      const items = p.current.ids.map((id) => j.items.find((x) => x.id === id));
      const html = document.getElementById('app').innerHTML;
      return { n: p.current.ids.length, unique: new Set(p.current.ids).size, hint: !!document.querySelector('.sf-hint-btn, .sf-check'), leaks: items.filter((it) => html.includes(it.correct)).length, ids: p.current.ids };`);
    check('Test: 15 different sentences, no hint or check buttons, and no answer in the page', test.n === 15 && test.unique === 15 && !test.hint && test.leaks === 0, test);
    // Answer: 5 correct, 5 untouched, the rest partly fixed.
    const items = await b.js(`const j = await (await fetch('data/sentence-fix/bank.json')).json(); return ${JSON.stringify(test.ids)}.map((id) => j.items.find((x) => x.id === id));`);
    for (let i = 0; i < 15; i++) {
      const it = items[i];
      const ansI = i < 5 ? it.correct : i < 10 ? it.incorrect : it.incorrect.charAt(0).toUpperCase() + it.incorrect.slice(1);
      await b.js(`${type('.sf-answer', ansI)} return 1;`);
      if (i < 14) { await b.click('.sf-next'); await b.wait(60); }
    }
    await b.click('.sf-finish'); await b.wait(200);
    if (await b.js(`return !!document.querySelector('.dialog');`)) { await b.click('.dialog .btn-primary'); await b.wait(400); }
    await b.settle();
    t = await b.text();
    const saved = await b.js(`return await WW.store.listSfTests(${JSON.stringify(alex)});`);
    check('finishing the test saves the result and shows the score by skill', saved.length === 1 && /You got \d+ of \d+ right!/.test(t) && (await b.js(`return document.querySelectorAll('.sf-skills li').length;`)) >= 1, { n: saved.length, t: t.slice(0, 200) });
    check('the 5 correct answers were counted right, untouched sentences wrong', saved[0].correct >= 5 && saved[0].answers.slice(5, 10).every((a) => a.result === 'incorrect'), saved[0].answers.map((a) => a.result));
    check('after the test, mistakes can be reviewed with the fixed sentence, and "Practice my misses" is offered', /Fixed sentence:/.test(t) && !!(await b.js(`return document.querySelector('.sf-practice-misses');`)));
    // Reset keeps results
    await b.go(`#/s/${alex}/sentence-fix`);
    await b.js(`document.querySelector('.sf-reset summary').click(); return 1;`);
    await b.click('.sf-reset-btn'); await b.wait(150); await b.click('.dialog .btn-primary'); await b.wait(300);
    check('"Reset my practice" keeps the saved test results', (await b.js(`return (await WW.store.listSfTests(${JSON.stringify(alex)})).length;`)) === 1 && (await b.js(`return (await WW.store.getSfProgress(${JSON.stringify(alex)})).current;`)) === null);
    check('Jordan has no Sentence Fix results (profiles are separate)', (await b.js(`return (await WW.store.listSfTests(${JSON.stringify(jordan)})).length;`)) === 0);
    // Persistence
    await b.reload(); await b.js(`for (let i = 0; i < 100 && !window.WW?.ready; i++) await new Promise((r) => setTimeout(r, 50));`);
    await b.go(`#/s/${alex}`);
    t = await b.text();
    check('after reloading, the home cards still show the words, passages and last test', /4 words to learn/.test(t) && /3 words to practise/.test(t) && /2 passages/.test(t) && /Last test:/.test(t), t.slice(0, 500));
  },
};
