// Redesign 2.0: the parent's lesson workspace (Add → Check → Finish on one screen) and the simplified landing page.
// Covers the owner's review list: lesson creation is obvious; vocabulary and spelling entry are easy to find; photo
// uploads reach the Check stage in the right subject; definitions and spelling words are edited in place and the
// edits persist; approval stays mandatory; existing lessons and scores survive; old wizard addresses still work.
import { SYNTHETIC } from '../lib/synthetic.mjs';
import { APPROVED_SAMPLE } from './helpers.mjs';

const type = (sel, value, i = 0) => `{ const el = document.querySelectorAll(${JSON.stringify(sel)})[${i}];
  if (!el) throw new Error('No field ' + ${JSON.stringify(sel)});
  el.focus(); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }`;
const pause = (ms = 300) => `await new Promise((r) => setTimeout(r, ${ms}));`;
const lessonId = 'return location.hash.split("/")[3].split("?")[0];';
const stage = 'return document.querySelector(".ws-tab.is-current .ws-tab-label")?.textContent;';
// Upload a generated worksheet through the given file input and wait until the reading is finished.
const upload = (target, kind) => `const f = await window.__makeSynthetic('${kind}');
  const input = document.querySelector('input[type=file][data-target="${target}"]');
  const dt = new DataTransfer(); dt.items.add(f); input.files = dt.files; input.dispatchEvent(new Event('change'));
  for (let i = 0; i < 500 && !document.querySelector('.ws-reading, .ws-read-error'); i++) await new Promise((r) => setTimeout(r, 20));
  for (let i = 0; i < 600 && (document.querySelector('.ws-reading')); i++) await new Promise((r) => setTimeout(r, 200));
  await new Promise((r) => setTimeout(r, 300));
  return { stage: document.querySelector('.ws-tab.is-current .ws-tab-label')?.textContent, error: document.querySelector('.ws-read-error')?.innerText || null };`;

export default {
  name: 'workspace',
  async run({ b, check }) {
    await b.fresh();
    const old = await b.js(APPROVED_SAMPLE);
    await b.js(`await WW.store.saveAttempt({ studentId: ${JSON.stringify(old.sid)}, weekId: ${JSON.stringify(old.wid)}, snapshotVersion: 1, subject: 'spelling', activity: 'spelling', activityLabel: 'Spelling', mode: 'test', submittedAt: new Date().toISOString(), score: 13, total: 15, questions: [], missed: [] }); return 1;`);
    const oldSnap = JSON.stringify(await b.js(`return await WW.store.getSnapshot(${JSON.stringify(old.wid)}, 1);`));
    const [alex, jordan] = await b.js(`return (await WW.store.listStudents()).map((s) => s.id);`);

    // Landing page: two obvious areas, no clutter.
    // (Word Workshop 3.0: the grown-ups' lesson workspace is reached from the parent area; the first screen is the
    // children's name picker, tested in the student suite.)
    await b.go('#/parent');
    let t = await b.text();
    const cta = await b.js(`const a = document.querySelector('a.create-lesson'); const r = a.getBoundingClientRect(); return { ok: r.bottom <= innerHeight && r.height > 0, text: a.textContent };`);
    check('parent area: "Create this week\'s lesson" is the visible primary action', cta.ok && /Create this week's lesson/.test(cta.text), cta);

    // Add stage: one screen with details and both subjects.
    await b.click('a.create-lesson'); await b.settle();
    t = await b.text();
    check('Create opens one workspace: student, week, and Vocabulary and Spelling with Upload, Paste and Add one word',
      (await b.js('return location.hash;')) === '#/parent/new' && /Student/.test(t) && /Week starts/.test(t)
      && (await b.js(`return ['.upload-vocab', '.paste-vocab', '.add-one-vocab', '.upload-spelling', '.paste-spelling', '.add-one-spelling'].every((s) => { const r = document.querySelector(s)?.getBoundingClientRect(); return r && r.height > 0 && r.bottom <= innerHeight; });`)), t.slice(0, 300));
    check('Check and Finish are not available before anything is added', await b.js(`return [...document.querySelectorAll('.ws-tab')].slice(1).every((x) => x.disabled);`));
    // Without a student, adding explains what is missing.
    await b.click('.add-one-vocab');
    await b.js(`${type('#ws-one-word-vocab', 'Fortunate')} document.getElementById('ws-one-word-vocab').form.requestSubmit(); ${pause()} return 1;`);
    check('adding without choosing a student says so (nothing saved)', /Choose who this lesson is for/.test(await b.text()) && (await b.js(`return (await WW.store.listWeeks(${JSON.stringify(alex)})).length + (await WW.store.listWeeks(${JSON.stringify(jordan)})).length;`)) === 1);
    // Duplicate week: the old approved lesson is Oct 12–16 for the first student.
    await b.js(`document.querySelector('input[name=ws-student][value="${old.sid}"]').click(); ${type('#ws-start', '2026-10-12')} ${pause(200)} return 1;`);
    t = await b.text();
    check('choosing a student and week that already has a lesson offers to open it instead', /already has a lesson for Week of Oct 12/.test(t) && !!(await b.js(`return document.querySelector('a.open-existing');`)), t.slice(0, 500));

    // 1) Vocabulary-only lesson, typed one word at a time.
    await b.js(`${type('#ws-start', '2026-10-19')} ${pause(200)} return 1;`);
    check('the end date follows the start date', (await b.js(`return document.getElementById('ws-end').value;`)) === '2026-10-23');
    await b.js(`${type('#ws-one-word-vocab', 'Fortunate')} ${type('#ws-one-def-vocab', 'Involving good luck or success')} document.getElementById('ws-one-word-vocab').form.requestSubmit(); ${pause(500)} return 1;`);
    const w1 = await b.js(lessonId);
    check('the first word creates the lesson and gives it its own address', /^w_/.test(w1) && /stage=add/.test(await b.js('return location.hash;')));
    await b.js(`${type('#ws-one-word-vocab', 'Ignorant')} ${type('#ws-one-def-vocab', 'Not having knowledge or awareness')} document.getElementById('ws-one-word-vocab').form.requestSubmit(); ${pause(500)} return 1;`);
    let wk = await b.js(`return await WW.store.getWeek(${JSON.stringify(w1)});`);
    check('typed vocabulary is saved with the exact definitions, already checked by the parent', wk.vocab.length === 2 && wk.vocab[1].sourceDefinition === 'Not having knowledge or awareness' && wk.vocab.every((v) => v.reviewed) && wk.studentId === old.sid);
    check('the save indicator says Saved', /Saved/.test(await b.js(`return document.querySelector('.save-status').textContent;`)));
    await b.click('.ws-next'); await b.settle();
    check('"Check the words" moves to Check on the same screen', (await b.js(stage)) === 'Check' && (await b.js(`return document.querySelectorAll('.ws-table-vocab .ws-row').length;`)) === 2);
    await b.click('.ws-tab:nth-child(3)'); await b.wait(150);
    t = await b.text();
    check('Finish lists what is left (sentences) and has no approve button yet', /no example sentence/.test(t) && !(await b.js(`return !!document.querySelector('.approve-btn');`)), t.slice(0, 600));
    await b.click('.fin-skip-sentences'); await b.wait(400);
    check('after "Continue without them" the lesson is ready to approve', !!(await b.js(`return document.querySelector('.approve-btn');`)) && /Ready to approve/.test(await b.text()));
    check('the Finish summary shows student, week, counts, issues and checked', await b.js(`const t = document.querySelector('.ws-summary').innerText; return /Student\\s*Alex/.test(t) && /Vocabulary words\\s*2/.test(t) && /Spelling words\\s*0/.test(t) && /Unresolved issues\\s*0/.test(t) && /Checked\\s*2 of 2/.test(t);`));
    await b.click('.approve-btn'); await b.wait(500); await b.settle();
    t = await b.text();
    check('approval opens the student\'s new words with Study cards, practice and Test', (await b.js('return location.hash;')) === `#/s/${old.sid}/vocab?w=${w1}` && /Study cards/.test(t) && /Choose the meaning/.test(t) && /Test/.test(t), t.slice(0, 300));
    const s1 = await b.js(`return await WW.store.getApprovedLesson(${JSON.stringify(w1)});`);
    check('the approved snapshot holds the teacher\'s exact definitions', s1 && s1.vocab[0].definition === 'Involving good luck or success' && s1.vocab[0].definitionKind === 'teacher' && s1.spelling.length === 0);

    // 2) Spelling-only lesson, pasted.
    await b.go(`#/parent/new?student=${jordan}`);
    check('a student can be preselected', await b.js(`return document.querySelector('input[name=ws-student][value="${jordan}"]').checked;`));
    await b.click('.add-one-vocab'); await b.wait(100);
    check('a new lesson starts with empty fields (nothing carried over from the last one)', (await b.js(`return document.getElementById('ws-one-word-vocab').value + document.getElementById('ws-one-def-vocab').value;`)) === '');
    await b.click('.add-one-vocab'); await b.wait(100);
    await b.js(`${type('#ws-start', '2026-10-19')} return 1;`);
    await b.click('.paste-spelling');
    await b.js(`${type('#ws-paste-spelling', 'rushed, blasted\nwashed\nwinked')} ${pause(100)} return 1;`);
    check('the paste box previews the words it will add', /4 words: rushed, blasted, washed, winked/.test(await b.text()));
    await b.click('.ws-paste-add-spelling'); await b.wait(500);
    const w2 = await b.js(lessonId);
    wk = await b.js(`return await WW.store.getWeek(${JSON.stringify(w2)});`);
    check('pasted spelling words are saved in order (not yet checked)', wk.spelling.map((s) => s.word).join() === 'rushed,blasted,washed,winked' && wk.spelling.every((s) => !s.reviewed));
    await b.click('.ws-next'); await b.settle();
    // Edit a spelling word in place.
    await b.js(`${type('.ws-table-spelling .ws-word', 'blastted', 1)} ${pause()} ${type('.ws-table-spelling .ws-word', 'blasted', 1)} ${pause()} return 1;`);
    wk = await b.js(`return await WW.store.getWeek(${JSON.stringify(w2)});`);
    check('a spelling word edited in its row is saved and counts as checked', wk.spelling[1].word === 'blasted' && wk.spelling[1].reviewed);
    await b.click('.ws-confirm-spelling'); await b.wait(400);
    check('one action confirms the other spelling words against the sheet', (await b.js(`return (await WW.store.getWeek(${JSON.stringify(w2)})).spelling.every((s) => s.reviewed);`)) && /All 4 spelling words are checked/.test(await b.text()));
    await b.click('.ws-skip-spelling'); await b.wait(300);
    await b.click('.ws-next'); await b.wait(200);
    await b.click('.approve-btn'); await b.wait(500); await b.settle();
    const s2 = await b.js(`return await WW.store.getApprovedLesson(${JSON.stringify(w2)});`);
    check('spelling-only lesson approved in the teacher\'s order', s2 && s2.spelling.map((s) => s.word).join() === 'rushed,blasted,washed,winked' && !s2.vocab.length);

    // 3) Both subjects from photos.
    await b.js(SYNTHETIC + ' return 1;');
    await b.go('#/parent/new');
    await b.js(`document.querySelector('input[name=ws-student][value="${alex}"]').click(); ${type('#ws-start', '2026-11-02')} ${pause(200)} return 1;`);
    let r = await b.js(upload('vocab', 'vocab'));
    const w3 = await b.js(lessonId);
    wk = await b.js(`return await WW.store.getWeek(${JSON.stringify(w3)});`);
    check('Upload vocabulary worksheet reads the photo right here and opens Check (no other screen)', r.stage === 'Check' && !r.error && wk.vocab.length === 12 && !wk.spelling.length && /#\/parent\/lesson\//.test(await b.js('return location.hash;')), { r, n: wk.vocab.length });
    check('Check shows the vocabulary as rows: word, exact definition, status', (await b.js(`return document.querySelectorAll('.ws-table-vocab .ws-row').length;`)) === 12
      && (await b.js(`return document.querySelector('.ws-table-vocab .ws-row .ws-def').value;`)) === wk.vocab[0].sourceDefinition);
    check('the worksheet photo is shown beside the words on a wide screen, or behind a Photos button on a phone',
      (await b.js(`return document.querySelectorAll('.ws-photos img').length;`)) === 1 && (await b.js(`return !!document.querySelector('.ws-photos-btn');`)));
    // Review M3: the parent keeps typing in a definition while the spelling photo is read; nothing is lost.
    const typing = b.js(upload('spelling', 'spelling'));
    await b.wait(700);
    await b.js(`const el = document.querySelectorAll('.ws-table-vocab .ws-def')[1]; el.focus(); el.value = 'Typed while the photo was being read'; el.dispatchEvent(new Event('input', { bubbles: true })); return 1;`);
    r = await typing;
    wk = await b.js(`return await WW.store.getWeek(${JSON.stringify(w3)});`);
    check('text typed while a photo is being read is saved, and the cursor stays in that field', wk.vocab[1].sourceDefinition === 'Typed while the photo was being read'
      && (await b.js(`return document.activeElement === document.querySelectorAll('.ws-table-vocab .ws-def')[1];`)), wk.vocab[1].sourceDefinition);
    check('Upload in the Spelling table adds the spelling words to the same lesson, staying in Check', r.stage === 'Check' && wk.spelling.length === 15 && wk.spelling[0].word === 'rushed' && wk.vocab.length === 12 && wk.sources.length === 2, r);
    check('text the reader could not place is kept under "Other text found", not thrown away', /Other text found in the photos/.test(await b.text()) && wk.sources.some((s) => (s.otherText || []).some((x) => /Reminders|Picture day/.test(x))));
    // Needs attention list.
    const att = await b.js(`return document.querySelectorAll('.ws-row.is-attention').length;`);
    check('uncertain words are grouped under "Needs attention"', att > 0 && (await b.text()).includes(`Needs attention (${att})`), att);
    // Correct a definition in place.
    const pIdx = wk.vocab.findIndex((v) => v.word === 'Produce');
    const readDef = wk.vocab[pIdx].sourceDefinition;
    await b.js(`${type('.ws-table-vocab .ws-def', 'Fresh fruit and vegetables!', pIdx)} ${pause()} return 1;`);
    wk = await b.js(`return await WW.store.getWeek(${JSON.stringify(w3)});`);
    const prod = wk.vocab[pIdx];
    check('a definition corrected in its row keeps what the reader read and logs the change', prod.sourceDefinition === 'Fresh fruit and vegetables!' && prod.originalTranscription === readDef && prod.definitionLog.some((l) => l.from === readDef && l.to === 'Fresh fruit and vegetables!') && prod.reviewed);
    check('the row shows what the photo reader read', (await b.text()).includes(`Photo reader read: "${readDef}"`));
    // Review M1: changing only a vocabulary WORD does not check the row or clear warnings about its definition.
    const attIdx = await b.js(`return [...document.querySelectorAll('.ws-table-vocab .ws-row')].findIndex((r) => r.classList.contains('is-attention'));`);
    if (attIdx >= 0) {
      const attWord = wk.vocab[attIdx].word;
      await b.js(`${type('.ws-table-vocab .ws-word', attWord + 'x', attIdx)} ${pause()} return 1;`);
      const after = await b.js(`return { cls: document.querySelectorAll('.ws-table-vocab .ws-row')[${attIdx}].className, it: (await WW.store.getWeek(${JSON.stringify(w3)})).vocab[${attIdx}] };`);
      check('changing only a vocabulary word leaves its definition warnings open (not auto-checked)', /is-attention/.test(after.cls) && !after.it.reviewed, after.cls);
      await b.js(`${type('.ws-table-vocab .ws-word', attWord, attIdx)} ${pause()} return 1;`);
    }
    // Review M2: moving a vocabulary word to Spelling and back keeps the teacher's definition and its history.
    const dIdx = wk.vocab.findIndex((v) => v.word === 'Distracted');
    if (dIdx >= 0) {
      const defBefore = wk.vocab[dIdx].sourceDefinition;
      await b.js(`const row = document.querySelectorAll('.ws-table-vocab .ws-row')[${dIdx}]; row.querySelector('.ws-menu summary').click(); ${pause(50)} row.querySelector('.ws-move-subject').click(); ${pause(200)} return 1;`);
      check('moving a vocabulary word with a definition asks first', /Move "Distracted" to Spelling\?/.test(await b.js(`return document.querySelector('.dialog')?.innerText || '';`)));
      await b.click('.dialog .btn-primary', '/Move to Spelling/'); await b.wait(400);
      await b.js(`const rows = document.querySelectorAll('.ws-table-spelling .ws-row'); const row = [...rows].find((r) => r.querySelector('.ws-word').value === 'Distracted'); row.querySelector('.ws-menu summary').click(); ${pause(50)} row.querySelector('.ws-move-subject').click(); ${pause(400)} return 1;`);
      const back = await b.js(`return (await WW.store.getWeek(${JSON.stringify(w3)})).vocab.find((v) => v.word === 'Distracted');`);
      check('moving it back to Vocabulary brings back the exact definition and what the reader read', back && back.sourceDefinition === defBefore && back.originalTranscription === wk.vocab[dIdx].originalTranscription, back);
      wk = await b.js(`return await WW.store.getWeek(${JSON.stringify(w3)});`);
    }
    // Keyboard: Escape closes the ⋯ menu.
    await b.js(`document.querySelector('.ws-table-vocab .ws-menu summary').click(); ${pause(50)} document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); ${pause(50)} return 1;`);
    check('Escape closes the ⋯ menu', !(await b.js(`return !!document.querySelector('.ws-menu[open]');`)));
    // Looks right on each attention word.
    let n = 0;
    for (let g = 0; g < 40; g++) {
      const has = await b.js(`const x = document.querySelector('.ws-looks-right'); if (!x) return false; const id = x.closest('[data-item]').dataset.item; x.click();
        for (let i = 0; i < 150 && document.querySelector('[data-item="' + id + '"] .ws-looks-right'); i++) await new Promise((r) => setTimeout(r, 20)); return true;`);
      if (!has) break; n++;
    }
    check('"Looks right" resolves each uncertain word with one action', n > 0 && !(await b.js(`return !!document.querySelector('.ws-attention');`)), { n, left: await b.js(`return [...document.querySelectorAll('.ws-row.is-attention')].map((r) => r.querySelector('.ws-word').value + ': ' + r.querySelector('.ws-issues')?.innerText);`), vocab: await b.js(`return (await WW.store.getWeek(location.hash.split('/')[3].split('?')[0])).vocab.length;`) });
    // Move a word between subjects and delete one, recover from other text.
    const lastSp = wk.spelling[14].word;
    await b.js(`const rows = document.querySelectorAll('.ws-table-spelling .ws-row'); const row = rows[rows.length - 1]; row.querySelector('.ws-menu summary').click(); ${pause(50)} row.querySelector('.ws-move-subject').click(); ${pause(400)} return 1;`);
    wk = await b.js(`return await WW.store.getWeek(${JSON.stringify(w3)});`);
    check('a word can be moved to the other subject', wk.spelling.length === 14 && wk.vocab.length === 13 && wk.vocab[12].word === lastSp);
    await b.js(`const rows = document.querySelectorAll('.ws-table-vocab .ws-row'); const row = rows[rows.length - 1]; row.querySelector('.ws-menu summary').click(); ${pause(50)} row.querySelector('.ws-delete').click(); ${pause(400)} return 1;`);
    wk = await b.js(`return await WW.store.getWeek(${JSON.stringify(w3)});`);
    check('a wrongly read word can be removed', wk.vocab.length === 12);
    // Confirm both subjects, skip sentences, approve.
    await b.click('.ws-confirm-vocab'); await b.wait(300);
    await b.click('.ws-confirm-spelling'); await b.wait(300);
    await b.click('.ws-tab:nth-child(3)'); await b.wait(200);
    await b.click('.fin-skip-sentences'); await b.wait(500);
    check('approval is offered only after every word is checked', !!(await b.js(`return document.querySelector('.approve-btn');`)));
    await b.click('.approve-btn'); await b.wait(500); await b.settle();
    const s3 = await b.js(`return await WW.store.getApprovedLesson(${JSON.stringify(w3)});`);
    check('the photo lesson is approved with the parent\'s correction', s3 && s3.vocab.length === 12 && s3.spelling.length === 14 && JSON.stringify(s3).includes('Fresh fruit and vegetables!'));
    await b.go(`#/s/${alex}/w/${w3}/vocab/study`);
    check('the student can study the new lesson straight away', /Produce|Exception|Installment/.test(await b.text()));

    // Approval stays mandatory: an unchecked word blocks it (UI and store).
    await b.go('#/parent/new');
    await b.js(`document.querySelector('input[name=ws-student][value="${jordan}"]').click(); ${type('#ws-start', '2026-11-09')} ${pause(200)} return 1;`);
    await b.click('.paste-vocab');
    await b.js(`${type('#ws-paste-vocab', 'Gloomy - Dark and sad')} return 1;`);
    await b.click('.ws-paste-add-vocab'); await b.wait(400);
    const w4 = await b.js(lessonId);
    await b.go(`#/parent/lesson/${w4}?stage=finish`);
    t = await b.text();
    check('an unchecked word blocks approval (no approve button; says what to do)', !(await b.js(`return !!document.querySelector('.approve-btn');`)) && /not been checked yet/.test(t));
    const refused = await b.js(`try { await WW.store.approveWeek(${JSON.stringify(w4)}); return false; } catch (e) { return !!e.blockers; }`);
    check('the store still refuses to approve an unchecked lesson', refused);

    // Leave and come back: the stage and half-typed text are kept.
    await b.go(`#/parent/lesson/${w4}?stage=add`);
    await b.click('.add-one-spelling');
    await b.js(`${type('#ws-one-word-spelling', 'crashe')} return 1;`);
    await b.go(`#/parent/lesson/${w4}?stage=check`);
    await b.reload();
    await b.js(`for (let i = 0; i < 100 && !window.WW?.ready; i++) await new Promise((r) => setTimeout(r, 50));`);
    await b.go('#/parent');
    t = await b.text();
    check('the parent area offers to continue the unfinished lesson', /Lessons in progress/.test(t) && /Jordan/.test(t), t.slice(0, 400));
    await b.js(`[...document.querySelectorAll('a.continue-draft')].find((a) => /Jordan/.test(a.getAttribute('aria-label') || '')).click(); return 1;`); await b.settle();
    check('Continue returns to the stage the parent left (Check)', (await b.js(stage)) === 'Check' && (await b.js(`return document.querySelector('.ws-table-vocab .ws-def')?.value;`)) === 'Dark and sad');
    await b.click('.ws-tab:nth-child(1)'); await b.wait(150);
    await b.click('.add-one-spelling'); await b.wait(100);
    check('half-typed text is still there after leaving and reloading', (await b.js(`return document.getElementById('ws-one-word-spelling').value;`)) === 'crashe');
    await b.go('#/parent');
    check('the parent area lists the unfinished lesson with its next stage', /Lessons in progress/.test(await b.text()) && /Next: Add words/.test(await b.text()));

    // Old addresses from the four-step wizard still open the lesson.
    await b.go(`#/parent/week/${w4}/review`);
    check('an old wizard address opens the workspace at the matching stage', (await b.js(stage)) === 'Check');

    // Students cannot see unapproved work; earlier lessons and scores are unchanged.
    await b.go(`#/s/${jordan}/w/${w4}`);
    check('a student cannot open an unapproved lesson', /not ready yet/.test(await b.text()));
    await b.go(`#/s/${jordan}/w/${w1}`);
    check('a student cannot open another student\'s lesson', /not ready yet|not available/.test(await b.text()));
    const afterSnap = JSON.stringify(await b.js(`return await WW.store.getSnapshot(${JSON.stringify(old.wid)}, 1);`));
    const atts = await b.js(`return (await WW.store.listAttempts({ weekId: ${JSON.stringify(old.wid)} })).map((a) => a.score + '/' + a.total);`);
    check('the earlier approved lesson and its score are unchanged', afterSnap === oldSnap && atts.join() === '13/15', atts);
    await b.go(`#/s/${old.sid}/results`);
    check('the earlier score still shows in the student\'s results', /13/.test(await b.text()));
  },
};
