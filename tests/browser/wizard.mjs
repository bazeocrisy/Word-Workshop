// UX correction: landing page, parent dashboard and the four-step "Create this week's lesson" wizard.
// Covers the owner's acceptance list: discoverability, vocabulary-only / spelling-only / both, photo import for each
// subject from the wizard, correcting reader mistakes, leaving and resuming, student isolation, and that earlier
// approved lessons and scores are untouched.
import { SYNTHETIC } from '../lib/synthetic.mjs';
import { APPROVED_SAMPLE } from './helpers.mjs';

// Set a field's value like a person typing, then leaving the field.
const type = (sel, value, i = 0) => `{ const el = document.querySelectorAll(${JSON.stringify(sel)})[${i}];
  if (!el) throw new Error('No field ' + ${JSON.stringify(sel)});
  el.focus(); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }`;
const settleSaves = 'await new Promise((r) => setTimeout(r, 250));';
const REVIEW_ALL = `
  const pause = () => new Promise((r) => setTimeout(r, 15));
  for (let g = 0; g < 400; g++) { const x = [...document.querySelectorAll('.ack-box')].find((c) => !c.checked); if (!x) break; x.click(); await pause(); }
  for (let g = 0; g < 400; g++) { const x = [...document.querySelectorAll('.reviewed-box')].find((c) => !c.checked); if (!x) break; x.click(); await pause(); }
  await new Promise((r) => setTimeout(r, 400)); return 1;`;
const pickFiles = (expr) => `
  const files = await (${expr});
  const input = document.getElementById('photo-input');
  const dt = new DataTransfer(); for (const f of files) dt.items.add(f);
  input.files = dt.files; input.dispatchEvent(new Event('change'));
  for (let i = 0; i < 100 && !document.querySelector('.thumb-page'); i++) await new Promise((r) => setTimeout(r, 100));
  return 1;`;
const waitForReview = `for (let i = 0; i < 600 && !document.querySelector('.commit-btn, .notice-error'); i++) await new Promise((r) => setTimeout(r, 200)); return 1;`;

export default {
  name: 'wizard',
  async run({ b, check }) {
    await b.fresh();
    // An earlier approved lesson with a score: it must survive everything below unchanged (acceptance 10).
    const old = await b.js(APPROVED_SAMPLE);
    await b.js(`await WW.store.saveAttempt({ studentId: ${JSON.stringify(old.sid)}, weekId: ${JSON.stringify(old.wid)}, snapshotVersion: 1, subject: 'spelling', activity: 'spelling', activityLabel: 'Spelling', mode: 'test', submittedAt: new Date().toISOString(), score: 13, total: 15, questions: [], missed: [] }); return 1;`);
    const oldSnap = JSON.stringify(await b.js(`return await WW.store.getSnapshot(${JSON.stringify(old.wid)}, 1);`));
    const [alex, jordan] = await b.js(`return (await WW.store.listStudents()).map((s) => s.id);`);

    // 1. Discoverability from the first screen (phone size).
    await b.go('#/');
    let t = await b.text();
    check('landing page explains the purpose and has a parent area and a student area',
      /Parents: create and manage lessons/.test(t) && /Students: study and test/.test(t) && /spelling and vocabulary/i.test(t), t.slice(0, 400));
    const cta = await b.js(`const a = document.querySelector('a.create-lesson'); const r = a.getBoundingClientRect(); return { text: a.textContent, top: r.top, bottom: r.bottom, vh: innerHeight };`);
    check('"Create this week\'s lesson" is visible without scrolling on a phone', /Create this week's lesson/.test(cta.text) && cta.bottom <= cta.vh, cta);
    check('student profile cards are on the landing page', (await b.js(`return document.querySelectorAll('.home-students .profile-card').length;`)) === 2);
    check('header has Home and Parents links', (await b.js(`return [...document.querySelectorAll('.top-nav a')].map((a) => a.textContent).join(',');`)) === 'Home,Parents');
    await b.click('a.create-lesson'); await b.settle();
    t = await b.text();
    check('the button opens step 1 of the lesson wizard', (await b.js('return location.hash;')) === '#/parent/new' && /Step 1 of 4/.test(t) && /Who is this lesson for\?/.test(t), t.slice(0, 300));
    check('the stepper shows all four steps', (await b.js(`return [...document.querySelectorAll('.stepper .step-label')].map((x) => x.textContent).join('|');`)) === 'Student and week|Add words|Review|Approve');

    // Step 1 validation: meaningful messages.
    await b.js(`${type('#wz-start', '2026-10-19')} ${type('#wz-end', '2026-10-12')} return 1;`);
    await b.click('.wizard-next'); await b.wait(100);
    t = await b.text();
    check('step 1 explains what is missing (no student, end before start)', /Choose who this lesson is for/.test(t), t.slice(0, 600));
    await b.js(`document.querySelector('input[name=wz-student][value="${alex}"]').click(); return 1;`);
    await b.click('.wizard-next'); await b.wait(100);
    check('step 1 refuses an end date before the start date', /end date is before the start date/.test(await b.text()));

    // 2. Vocabulary-only week, typed by hand.
    await b.js(`${type('#wz-start', '2026-10-19')} return 1;`);
    check('changing the start date moves the end date to Friday', (await b.js(`return document.getElementById('wz-end').value;`)) === '2026-10-23');
    await b.click('.wizard-next'); await b.settle();
    let hash = await b.js('return location.hash;');
    check('step 1 creates the lesson and goes to Add words', /^#\/parent\/week\/w_[^/]+\/words$/.test(hash), hash);
    const w1 = hash.split('/')[3];
    t = await b.text();
    check('Add words shows separate VOCABULARY and SPELLING sections with upload, paste and add-one actions',
      /Vocabulary/.test(t) && /Spelling/.test(t) && /Upload vocabulary worksheet/.test(t) && /Upload spelling list or newsletter/.test(t)
      && (await b.js(`return document.querySelectorAll('.paste-vocab, .paste-spelling, .add-one-vocab, .add-one-spelling').length;`)) === 4, t.slice(0, 600));
    await b.click('.wizard-next'); await b.wait(150);
    check('cannot continue with no words, with a clear message', /Add at least one vocabulary or spelling word/.test(await b.text()));
    await b.js(`${type('.subject-panel-vocab .new-word', 'Fortunate')} ${type('.subject-panel-vocab .new-def', 'Involving good luck or success')} return 1;`);
    await b.click('.add-one-vocab'); await b.js(settleSaves);
    // Paste a second word with the list tool (opens preset to vocabulary).
    await b.click('.paste-vocab'); await b.wait(100);
    check('the vocabulary paste tool opens preset to vocabulary', (await b.js(`return document.querySelector('.dialog select').value;`)) === 'vocab');
    await b.js(`${type('.dialog textarea', 'Ignorant - Not having knowledge or awareness')} return 1;`);
    await b.click('.dialog .btn-primary', '/Add words/'); await b.js(settleSaves);
    let wk = await b.js(`return await WW.store.getWeek(${JSON.stringify(w1)});`);
    check('typed and pasted vocabulary words are saved with the exact definitions',
      wk.vocab.length === 2 && wk.vocab[0].sourceDefinition === 'Involving good luck or success' && wk.vocab[1].sourceDefinition === 'Not having knowledge or awareness' && wk.spelling.length === 0, wk.vocab.map((v) => [v.word, v.sourceDefinition]));
    check('the entries are listed with a count', (await b.js(`return document.querySelector('.subject-panel-vocab .count-pill').textContent;`)) === '2'
      && (await b.js(`return document.querySelectorAll('.subject-panel-vocab .entry').length;`)) === 2);
    // Remove one and add it back (edit/remove in step 2).
    await b.js(`document.querySelectorAll('.subject-panel-vocab .del-btn')[1].click(); return 1;`); await b.wait(100);
    await b.click('.dialog .btn-danger', '/Delete/'); await b.js(settleSaves);
    check('an entry can be removed in Add words', (await b.js(`return (await WW.store.getWeek(${JSON.stringify(w1)})).vocab.length;`)) === 1);
    await b.js(`${type('.subject-panel-vocab .new-word', 'Ignorant')} ${type('.subject-panel-vocab .new-def', 'Not having knowledge or awareness')} return 1;`);
    await b.click('.add-one-vocab'); await b.js(settleSaves);
    await b.click('.wizard-next'); await b.settle();
    t = await b.text();
    check('Continue goes to Review with every word shown', /\/review$/.test(await b.js('return location.hash;')) && /Step 3 of 4/.test(t) && /0 of 2 words checked/.test(t), t.slice(0, 500));
    check('Review shows the teacher definitions exactly', (await b.js(`return [...document.querySelectorAll('.teacher-def')].map((x) => x.value).join('|');`)) === 'Involving good luck or success|Not having knowledge or awareness');
    await b.click('.wizard-next'); await b.settle();
    t = await b.text();
    check('Approve lists what is unfinished and offers no approve button yet', /Not ready to approve yet/.test(t) && /has not been marked as checked/.test(t) && !(await b.js(`return !!document.querySelector('.approve-btn');`)), t.slice(0, 600));
    await b.click('.fix-btn'); await b.settle();
    await b.js(REVIEW_ALL);
    check('Review shows when everything is checked', /Everything is checked/.test(await b.text()));
    await b.click('.wizard-next'); await b.settle();
    check('Approve shows the word counts', /Vocabulary words\s*2/.test(await b.text()) && /Spelling words\s*0/.test(await b.text()));
    check('approve stays disabled until the parent confirms the final check', await b.js(`return document.querySelector('.approve-btn').disabled;`));
    await b.click('.verify-box'); await b.wait(50);
    check('confirming enables approval', !(await b.js(`return document.querySelector('.approve-btn').disabled;`)));
    await b.click('.approve-btn'); await b.wait(400); await b.settle();
    hash = await b.js('return location.hash;');
    t = await b.text();
    check('approving returns to the student dashboard, where the lesson appears', hash === `#/s/${alex}` && /Week of Oct 19/.test(t), { hash, t: t.slice(0, 300) });
    const s1 = await b.js(`return await WW.store.getApprovedLesson(${JSON.stringify(w1)});`);
    check('vocabulary-only lesson is an approved snapshot with exact definitions and no spelling',
      s1 && s1.version === 1 && s1.vocab.length === 2 && s1.spelling.length === 0 && s1.vocab[0].definition === 'Involving good luck or success' && s1.vocab[0].definitionKind === 'teacher', s1 && s1.vocab[0]);

    // Duplicate week protection.
    await b.go('#/parent/new');
    await b.js(`document.querySelector('input[name=wz-student][value="${alex}"]').click(); ${type('#wz-start', '2026-10-19')} return 1;`);
    await b.click('.wizard-next'); await b.wait(200);
    t = await b.js(`return document.querySelector('.dialog')?.innerText || '';`);
    check('creating a second lesson for the same student and week is stopped and the existing one offered', /already a lesson/.test(t) && /Open that lesson/.test(t), t);
    await b.click('.dialog .btn-primary', '/Open that lesson/'); await b.settle();
    check('"Open that lesson" opens the existing approved lesson', (await b.js('return location.hash;')) === `#/parent/week/${w1}`);
    check('no duplicate lesson was created', (await b.js(`return (await WW.store.listWeeks(${JSON.stringify(alex)})).length;`)) === 2);

    // 3. Spelling-only week, typed, with Enter to add each word.
    await b.go(`#/parent/new?student=${jordan}`);
    check('the student can be preselected', await b.js(`return document.querySelector('input[name=wz-student][value="${jordan}"]').checked;`));
    await b.js(`${type('#wz-start', '2026-10-19')} return 1;`);
    await b.click('.wizard-next'); await b.settle();
    const w2 = (await b.js('return location.hash;')).split('/')[3];
    check('the same week for a different student is allowed', /\/words$/.test(await b.js('return location.hash;')));
    for (const w of ['rushed', 'blasted']) {
      await b.js(`${type('.subject-panel-spelling .new-word', w)} document.querySelector('.subject-panel-spelling .add-one').requestSubmit(); return 1;`);
      await b.js(settleSaves);
    }
    await b.click('.paste-spelling'); await b.wait(100);
    await b.js(`${type('.dialog textarea', 'washed, winked')} return 1;`);
    await b.click('.dialog .btn-primary', '/Add words/'); await b.js(settleSaves);
    // Fix a typo in step 2 and move a word.
    await b.js(`${type('.subject-panel-spelling .word-input', 'blastted', 1)} return 1;`); await b.js(settleSaves);
    await b.js(`${type('.subject-panel-spelling .word-input', 'blasted', 1)} return 1;`); await b.js(settleSaves);
    wk = await b.js(`return await WW.store.getWeek(${JSON.stringify(w2)});`);
    check('spelling words keep the order they were entered', wk.spelling.map((s) => s.word).join(',') === 'rushed,blasted,washed,winked' && !wk.vocab.length, wk.spelling.map((s) => s.word));
    await b.click('.wizard-next'); await b.settle();
    await b.js(REVIEW_ALL);
    await b.go(`#/parent/week/${w2}/approve`);
    await b.click('.verify-box'); await b.click('.approve-btn'); await b.wait(400); await b.settle();
    const s2 = await b.js(`return await WW.store.getApprovedLesson(${JSON.stringify(w2)});`);
    check('spelling-only lesson is approved in teacher order', s2 && s2.spelling.map((s) => s.word).join(',') === 'rushed,blasted,washed,winked' && s2.vocab.length === 0);

    // 4. Both subjects in one lesson.
    await b.go('#/parent/new');
    await b.js(`document.querySelector('input[name=wz-student][value="${alex}"]').click(); ${type('#wz-start', '2026-10-26')} ${type('#wz-title', 'Unit 3 Week 2')} return 1;`);
    await b.click('.wizard-next'); await b.settle();
    const w3 = (await b.js('return location.hash;')).split('/')[3];
    await b.js(`${type('.subject-panel-vocab .new-word', 'Peculiar')} ${type('.subject-panel-vocab .new-def', 'Strange or odd; unusual')} return 1;`);
    await b.click('.add-one-vocab'); await b.js(settleSaves);
    await b.js(`${type('.subject-panel-spelling .new-word', 'stepped')} return 1;`); await b.click('.add-one-spelling'); await b.js(settleSaves);
    await b.js(`${type('.subject-panel-spelling .new-word', 'handed')} return 1;`); await b.click('.add-one-spelling'); await b.js(settleSaves);
    await b.click('.wizard-next'); await b.settle();
    check('Review lists vocabulary first, then spelling', (await b.js(`return [...document.querySelectorAll('.editor-main h2')].map((x) => x.textContent).join('|');`)) === 'Vocabulary (1)|Spelling (2)');
    await b.js(REVIEW_ALL);
    await b.click('.wizard-next'); await b.settle();
    await b.click('.verify-box'); await b.click('.approve-btn'); await b.wait(400); await b.settle();
    const s3 = await b.js(`return await WW.store.getApprovedLesson(${JSON.stringify(w3)});`);
    check('a lesson with both subjects is approved with its name', s3 && s3.vocab.length === 1 && s3.spelling.length === 2 && /Unit 3 Week 2/.test(await b.text()));

    // 5–7. Photo import for each subject from the wizard, then correcting mistakes before approval.
    await b.js(SYNTHETIC + ' return 1;');
    await b.go('#/parent/new');
    await b.js(`document.querySelector('input[name=wz-student][value="${jordan}"]').click(); ${type('#wz-start', '2026-11-02')} return 1;`);
    await b.click('.wizard-next'); await b.settle();
    const w4 = (await b.js('return location.hash;')).split('/')[3];
    await b.click('a.upload-vocab'); await b.settle();
    t = await b.text();
    check('"Upload vocabulary worksheet" opens the photo reader set to vocabulary only',
      /Upload the vocabulary worksheet/.test(t) && (await b.js(`return document.getElementById('import-target').value;`)) === 'vocab' && /Back to Add words/.test(t), t.slice(0, 200));
    await b.js(pickFiles(`Promise.all([window.__makeSynthetic('vocab')])`));
    await b.click('.read-btn'); await b.js(waitForReview);
    await b.click('.commit-btn'); await b.wait(800); await b.settle();
    hash = await b.js('return location.hash;');
    wk = await b.js(`return await WW.store.getWeek(${JSON.stringify(w4)});`);
    check('after adding, the parent is back in Add words with the vocabulary listed', hash.endsWith(`/${w4}/words`) && wk.vocab.length === 12 && !wk.spelling.length
      && (await b.js(`return document.querySelectorAll('.subject-panel-vocab .entry').length;`)) === 12, { hash, n: wk.vocab.length });
    check('words from the photo show how sure the reader was', /From photo · \d+% sure/.test(await b.text()));
    await b.click('a.upload-spelling'); await b.settle();
    check('"Upload spelling list" opens the photo reader set to spelling only', (await b.js(`return document.getElementById('import-target').value;`)) === 'spelling');
    await b.js(pickFiles(`Promise.all([window.__makeSynthetic('spelling')])`));
    await b.click('.read-btn'); await b.js(waitForReview);
    await b.click('.commit-btn'); await b.wait(800); await b.settle();
    wk = await b.js(`return await WW.store.getWeek(${JSON.stringify(w4)});`);
    check('spelling from the photo is added to the same lesson in teacher order', wk.spelling.length === 15 && wk.spelling[0].word === 'rushed' && wk.vocab.length === 12, wk.spelling.map((s) => s.word));
    // Correct a definition in Add words and a spelling word in Review.
    const pIdx = wk.vocab.findIndex((v) => v.word === 'Produce');
    const readDef = wk.vocab[pIdx].sourceDefinition;
    await b.js(`${type('.subject-panel-vocab .teacher-def', 'Fresh fruit and vegetables!', pIdx)} return 1;`); await b.js(settleSaves);
    await b.click('.wizard-next'); await b.settle();
    await b.js(`${type('.editor-main .word-input', 'rushhed', 12)} return 1;`); await b.js(settleSaves);
    await b.js(`const i = [...document.querySelectorAll('.editor-main .word-input')].find((x) => x.value === 'rushhed'); i.value = 'rushed'; i.dispatchEvent(new Event('change')); return 1;`); await b.js(settleSaves);
    wk = await b.js(`return await WW.store.getWeek(${JSON.stringify(w4)});`);
    const prod = wk.vocab[pIdx];
    check('a corrected definition keeps what the reader read and logs the change', prod.sourceDefinition === 'Fresh fruit and vegetables!' && prod.originalTranscription === readDef
      && prod.definitionLog.some((l) => l.from === readDef && l.to === 'Fresh fruit and vegetables!'), prod);
    check('Review shows "First captured as" for the corrected definition', (await b.text()).includes(`First captured as: "${readDef}"`));
    check('the photo pages are shown beside the words in Review', /Source pages \(2\)/.test(await b.text()));
    await b.js(REVIEW_ALL);
    await b.click('.wizard-next'); await b.settle();
    await b.click('.verify-box'); await b.click('.approve-btn'); await b.wait(400); await b.settle();
    const s4 = await b.js(`return await WW.store.getApprovedLesson(${JSON.stringify(w4)});`);
    check('the photo lesson is approved with the parent\'s corrections', s4 && s4.vocab.length === 12 && s4.spelling.length === 15 && JSON.stringify(s4).includes('Fresh fruit and vegetables!'));

    // 8. Leave midway and resume.
    await b.go('#/parent/new');
    await b.js(`document.querySelector('input[name=wz-student][value="${alex}"]').click(); ${type('#wz-start', '2026-11-09')} return 1;`);
    await b.click('.wizard-next'); await b.settle();
    const w5 = (await b.js('return location.hash;')).split('/')[3];
    await b.js(`${type('.subject-panel-vocab .new-word', 'Melancholy')} ${type('.subject-panel-vocab .new-def', 'A feeling of sadness')} return 1;`);
    await b.click('.add-one-vocab'); await b.js(settleSaves);
    await b.js(`${type('.subject-panel-spelling .new-word', 'crashe')} return 1;`); // typed, not added yet
    await b.reload();
    await b.js(`for (let i = 0; i < 100 && !window.WW?.ready; i++) await new Promise((r) => setTimeout(r, 50));`);
    await b.go('#/');
    t = await b.text();
    check('the landing page offers to continue the unfinished lesson', /Continue Alex's lesson/.test(t) && /Nov 9/.test(t), t.slice(0, 600));
    await b.go('#/parent');
    t = await b.text();
    check('the dashboard lists the draft under Lessons in progress with its step', /Lessons in progress \(1\)/.test(t) && /Step 2 of 4: Add words/.test(t), t.slice(0, 800));
    await b.click('a.continue-draft'); await b.settle();
    check('Continue returns to the step the parent left', (await b.js('return location.hash;')) === `#/parent/week/${w5}/words`);
    check('the saved word and the half-typed word are both still there',
      (await b.js(`return document.querySelector('.subject-panel-vocab .word-input')?.value;`)) === 'Melancholy'
      && (await b.js(`return document.querySelector('.subject-panel-spelling .new-word').value;`)) === 'crashe');
    await b.click('.wizard-next'); await b.wait(150);
    check('continuing with a typed but un-added word asks about it', /Add the word you typed\?/.test(await b.js(`return document.querySelector('.dialog')?.innerText || '';`)));
    await b.click('.dialog .btn-primary', '/Add it/'); await b.wait(400); await b.settle();
    wk = await b.js(`return await WW.store.getWeek(${JSON.stringify(w5)});`);
    check('choosing "Add it" keeps the word and continues to Review', wk.spelling.map((s) => s.word).join() === 'crashe' && /\/review$/.test(await b.js('return location.hash;')));
    await b.go(`#/parent/week/${w5}/start`);
    check('Back to step 1 keeps the saved student and dates', await b.js(`return document.querySelector('input[name=wz-student][value="${alex}"]').checked && document.getElementById('wz-start').value === '2026-11-09';`));

    // 9. Students cannot reach unapproved work.
    await b.go(`#/s/${alex}`);
    t = await b.text();
    check('the draft is not in the student\'s list', !/Nov 9/.test(t) && /Oct 19/.test(t), t.slice(0, 400));
    await b.go(`#/s/${alex}/w/${w5}`);
    check('typing the draft\'s address as a student shows "not ready"', /not ready yet/.test(await b.text()));
    await b.go(`#/s/${jordan}/w/${w1}`);
    check('another student cannot open Alex\'s approved lesson', /not ready yet|not available/.test(await b.text()));

    // 10. The earlier lesson and its score are unchanged.
    const afterSnap = JSON.stringify(await b.js(`return await WW.store.getSnapshot(${JSON.stringify(old.wid)}, 1);`));
    const atts = await b.js(`return (await WW.store.listAttempts({ weekId: ${JSON.stringify(old.wid)} })).map((a) => a.score + '/' + a.total);`);
    check('the earlier approved lesson and its score are unchanged', afterSnap === oldSnap && atts.join() === '13/15', atts);
    await b.go('#/parent');
    t = await b.text();
    check('the dashboard lists approved lessons per student', /Approved lessons/.test(t) && (await b.js(`return document.querySelectorAll('.dash-col .admin-week').length;`)) === 5, t.slice(0, 900));
    await b.go('#/parent/results');
    check('Student results lists each student', (await b.js(`return document.querySelectorAll('a.profile-card').length;`)) === 2);
  },
};
