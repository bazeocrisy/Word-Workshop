// Milestone 3: vocabulary flashcards, practice, tests, results, missed-word practice, answer-leak checks.
import { APPROVED_SAMPLE, CURRENT_VOCAB_QUESTIONS } from './helpers.mjs';

export default {
  name: 'vocab',
  async run({ b, check }) {
    await b.fresh();
    const { sid, wid } = await b.js(APPROVED_SAMPLE);
    const base = `#/s/${sid}/w/${wid}`;

    // Flashcards
    await b.go(`${base}/vocab/study`);
    let t = await b.text();
    check('flashcards start at card 1 of 12', /Card 1 of 12/.test(t));
    check('card shows word, teacher definition label and exact text', /Produce/.test(t) && /Teacher's definition/.test(t) && /Fresh fruits and vegetables/.test(t));
    check('card shows the example sentence', /farmers market/.test(t));
    const pic = await b.js(`const i = document.querySelector('.card-picture img'); return i && { ok: i.complete && i.naturalWidth > 0, alt: i.alt };`);
    check('card shows the sample illustration with alt text', pic && pic.ok && pic.alt.length > 10, pic);
    check('sample illustration is labelled as a sample', /Sample illustration/.test(t));
    await b.click('.fc-nav .btn-primary');
    await b.wait(200);
    t = await b.text();
    check('Next moves to card 2', /Card 2 of 12/.test(t) && /Exception/.test(t));
    await b.js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); await new Promise((r) => setTimeout(r, 200)); return 1;`);
    check('arrow keys move between cards', /Card 3 of 12/.test(await b.text()));
    const speakBtns = await b.js(`return [...document.querySelectorAll('.speak-btn')].map((x) => x.getAttribute('aria-label'));`);
    check('card has word and sentence audio, each at normal and slow speed', speakBtns.length === 4, speakBtns);
    const noPicNote = await b.js(`
      const snap = await WW.store.getApprovedLesson(window.__W);
      const { fallbackLabel } = await import('./js/illustrations.js'); return fallbackLabel();`);
    check('missing pictures use an honest "Picture coming soon" label', noPicNote === 'Picture coming soon');

    // Activity picker lists all 5 activity types + mixed.
    await b.go(`${base}/vocab/practice`);
    t = await b.text();
    check('practice offers all five activity types and mixed', ['Choose the meaning', 'Choose the word', 'Fill in the blank', 'Match words and meanings', 'Write the word', 'Mixed'].every((x) => t.includes(x)));

    // Practice: wrong → feedback + retry; right → correct; first-try score saved.
    await b.go(`${base}/vocab/practice?type=def-mc`);
    let r = await b.js(`${CURRENT_VOCAB_QUESTIONS}
      const q = qs[0];
      const wrong = q.options.find((o) => o.key !== q.answerKey).key;
      document.querySelector(\`input[value="\${wrong}"]\`).click();
      document.querySelector('form.question').requestSubmit();
      await new Promise((r) => setTimeout(r, 100));
      const fb1 = document.querySelector('.feedback').innerText;
      document.querySelector(\`input[value="\${q.answerKey}"]\`).click();
      document.querySelector('form.question').requestSubmit();
      await new Promise((r) => setTimeout(r, 100));
      return { fb1, fb2: document.querySelector('.feedback').innerText, n: qs.length };`);
    check('practice: a wrong answer gets immediate feedback with retry', /Not quite/.test(r.fb1) && /Try again/.test(r.fb1), r.fb1);
    check('practice: the correct answer is confirmed with its meaning', /Correct!/.test(r.fb2) && /means/.test(r.fb2), r.fb2);
    const a11y = await b.js(`return { focus: document.activeElement.textContent, live: document.querySelector('.quiz [role=status], .page [role=status]')?.textContent || '' };`);
    check('after a correct answer, focus moves to Next and the result is announced', /Next|Finish/.test(a11y.focus) && /Correct/.test(a11y.live), a11y);
    const named = await b.js(`
      const fs = document.querySelector('.choices'); const ids = (fs.getAttribute('aria-labelledby') || '').split(' ');
      return ids.map((id) => document.getElementById(id)?.textContent || '').join(' | ');`);
    check('answer choices are labelled with the question itself (word shown), not just the instruction', /What does this word mean\?/.test(named) && named.split(' | ')[1].length > 2, named);
    // answer the rest correctly
    await b.js(`${CURRENT_VOCAB_QUESTIONS}
      for (let i = 0; i < qs.length; i++) {
        if (i > 0) { document.querySelector(\`input[value="\${qs[i].answerKey}"]\`).click(); document.querySelector('form.question').requestSubmit(); await new Promise((r) => setTimeout(r, 40)); }
        const nb = [...document.querySelectorAll('.quiz-controls .btn')].find((x) => /Next|Finish/.test(x.textContent));
        nb.click(); await new Promise((r) => setTimeout(r, 60));
      }
      await new Promise((r) => setTimeout(r, 400)); return 1;`);
    t = await b.text();
    let attempts = await b.js(`return await WW.store.listAttempts({ studentId: window.__S });`);
    check('practice result is saved with first-try scoring (11/12)', attempts.length === 1 && attempts[0].mode === 'practice' && attempts[0].score === 11 && attempts[0].total === 12, attempts.map((a) => [a.mode, a.score, a.total]));
    check('practice result screen lists the missed word and offers missed-word practice', /Missed words \(1\)/.test(t) && /Practice missed words/.test(t));

    // Test: no feedback; no answer-key markers in the DOM.
    await b.go(`${base}/vocab/test?type=word-mc`);
    r = await b.js(`${CURRENT_VOCAB_QUESTIONS}
      const radios = [...document.querySelectorAll('.choices input')];
      const attrSets = radios.map((x) => [...x.attributes].map((a) => a.name).sort().join(','));
      const labels = [...document.querySelectorAll('.choice')].map((l) => [...l.attributes].map((a) => a.name + '=' + a.value).join(','));
      return { same: new Set(attrSets).size === 1, sameLabels: new Set(labels).size === 1, n: qs.length };`);
    check('test: answer options carry no correctness markers', r.same && r.sameLabels, r);
    // Answer: first 9 right, then 3 wrong; check that no feedback appears.
    r = await b.js(`${CURRENT_VOCAB_QUESTIONS}
      let sawFeedback = false;
      for (let i = 0; i < qs.length; i++) {
        const q = qs[i];
        const pick = i < 9 ? q.answerKey : q.options.find((o) => o.key !== q.answerKey).key;
        document.querySelector(\`input[value="\${pick}"]\`).click();
        if (/Correct|Not quite/.test(document.getElementById('app').innerText)) sawFeedback = true;
        const nb = [...document.querySelectorAll('.quiz-controls .btn')].find((x) => /Next|Review/.test(x.textContent));
        nb.click(); await new Promise((r) => setTimeout(r, 50));
        if (/Correct|Not quite/.test(document.getElementById('app').innerText)) sawFeedback = true;
      }
      return { sawFeedback, text: document.getElementById('app').innerText };`);
    check('test: no correctness feedback before submitting', !r.sawFeedback);
    check('test: review screen before submitting', /Ready to submit\?/.test(r.text) && /answered 11 of 11/.test(r.text), r.text.slice(0, 200));
    await b.click('.submit-test');
    await b.wait(400);
    t = await b.text();
    check('test: graded result 9/11 (82%) with correct answers shown; Fortunate skipped as unfair', /9 \/ 11/.test(t) && /82%/.test(t) && /Not asked/.test(t) && /Correct answer:/.test(t), t.slice(0, 300));
    attempts = await b.js(`return await WW.store.listAttempts({ studentId: window.__S });`);
    const test1 = attempts.find((a) => a.mode === 'test');
    check('test result saved to the right student, week and lesson version', test1 && test1.studentId === sid && test1.weekId === wid && test1.snapshotVersion === 1 && test1.missed.length === 2 && test1.questions.length === 11);

    // Written test: the target word must not be in the page while answering.
    await b.go(`${base}/vocab/test?type=write`);
    r = await b.js(`${CURRENT_VOCAB_QUESTIONS}
      const leaks = [];
      for (let i = 0; i < qs.length; i++) {
        const html = document.documentElement.outerHTML.toLowerCase();
        if (html.includes(qs[i].word.toLowerCase())) leaks.push(qs[i].word);
        const input = document.querySelector('.answer-input');
        input.value = i === 0 ? '  ' + qs[i].word.toUpperCase() + ' ' : i === 1 ? qs[i].word.slice(0, -1) : qs[i].word; input.dispatchEvent(new Event('input'));
        const nb = [...document.querySelectorAll('.quiz-controls .btn')].find((x) => /Next|Review/.test(x.textContent));
        nb.click(); await new Promise((r) => setTimeout(r, 40));
      }
      return leaks;`);
    check('written test: the answer word never appears in the page (incl. hidden text and labels)', r.length === 0, r);
    await b.click('.submit-test'); await b.wait(400);
    attempts = await b.js(`return await WW.store.listAttempts({ studentId: window.__S });`);
    const w1 = attempts.find((a) => a.activity === 'write');
    check('written test grading: case/outer spaces ignored, a missing letter is wrong', w1 && w1.score === 10 && w1.total === 11 && w1.missed.length === 1, w1 && [w1.score, w1.missed]);

    // Draft persistence: answer 2 questions, reload, answers kept.
    await b.go(`${base}/vocab/test?type=def-mc`);
    await b.js(`${CURRENT_VOCAB_QUESTIONS}
      document.querySelector(\`input[value="\${qs[0].answerKey}"]\`).click();
      [...document.querySelectorAll('.quiz-controls .btn')].find((x) => /Next/.test(x.textContent)).click(); await new Promise((r) => setTimeout(r, 50));
      document.querySelector(\`input[value="\${qs[1].answerKey}"]\`).click(); return 1;`);
    await b.reload();
    await b.js(`for (let i = 0; i < 100 && !window.WW?.ready; i++) await new Promise((r) => setTimeout(r, 50)); window.__W = ${JSON.stringify(wid)}; window.__S = ${JSON.stringify(sid)}; return 1;`);
    await b.settle();
    r = await b.js(`return { t: document.getElementById('app').innerText, checked: !!document.querySelector('.choices input:checked') };`);
    check('a test in progress survives a page refresh', /Question 2 of 12/.test(r.t) && r.checked, r.t.slice(0, 200));

    // Leaving a test asks first.
    await b.js(`location.hash = '#/'; await new Promise((r) => setTimeout(r, 150)); return 1;`);
    const dlg = await b.js(`return document.querySelector('.dialog h2')?.textContent;`);
    check('leaving a test in progress asks for confirmation', dlg === 'Leave the test?', dlg);
    await b.click('.dialog .btn-primary', '/Leave/');
    await b.settle();
    check('choosing Leave goes to the requested page', (await b.js('return location.hash;')) === '#/');

    // Matching practice.
    await b.go(`${base}/vocab/practice?type=match`);
    r = await b.js(`${CURRENT_VOCAB_QUESTIONS}
      const q = qs[0];
      for (const [i, p] of q.pairs.entries()) {
        const sel = document.querySelectorAll('.match select')[i];
        const opt = q.options.find((o) => o.text === p.correctText);
        sel.value = opt.key; sel.dispatchEvent(new Event('change'));
      }
      document.querySelector('form.question').requestSubmit(); await new Promise((r) => setTimeout(r, 100));
      return { fb: document.querySelector('.feedback').innerText, rounds: qs.length, sizes: qs.map((x) => x.pairs.length) };`);
    check('matching: rounds of up to five pairs; all-correct confirmed', /Correct/.test(r.fb) && r.rounds === 3 && r.sizes.join() === '5,5,2', r);

    // Blank practice prompt hides the word.
    await b.go(`${base}/vocab/practice?type=blank`);
    r = await b.js(`${CURRENT_VOCAB_QUESTIONS} return { prompt: document.querySelector('.q-sentence').innerText, word: qs[0].word };`);
    check('fill-in-the-blank shows the sentence with the word removed', r.prompt.includes('_____') && !r.prompt.toLowerCase().includes(r.word.toLowerCase()), r);

    // Mixed test has one question per word.
    await b.go(`${base}/vocab/test?type=mixed`);
    t = await b.text();
    check('mixed test: one question per word (12)', /Question 1 of 12/.test(t));

    // Retake keeps old results; results page lists them.
    await b.go(`${base}/vocab/test?type=word-mc`);
    await b.js(`${CURRENT_VOCAB_QUESTIONS}
      for (let i = 0; i < qs.length; i++) {
        document.querySelector(\`input[value="\${qs[i].answerKey}"]\`).click();
        [...document.querySelectorAll('.quiz-controls .btn')].find((x) => /Next|Review/.test(x.textContent)).click(); await new Promise((r) => setTimeout(r, 40));
      }
      document.querySelector('.submit-test').click(); await new Promise((r) => setTimeout(r, 400)); return 1;`);
    attempts = await b.js(`return (await WW.store.listAttempts({ studentId: window.__S })).filter((a) => a.activity === 'word-mc' && a.mode === 'test').map((a) => a.score);`);
    check('retaking a test adds a new result and keeps the old one', attempts.length === 2 && attempts.includes(9) && attempts.includes(11), attempts);
    await b.go(`#/s/${sid}/results`);
    t = await b.text();
    check('student results list activity, mode, score, missed words and version', /Choose the word/.test(t) && /Test/.test(t) && /Practice/.test(t) && /9\/11 \(82%\)/.test(t) && /v1/.test(t));

    // Missed-word practice uses only missed words.
    const href = await b.js(`const a = (await WW.store.listAttempts({ studentId: window.__S })).find((x) => x.score === 9); const m = await import('./js/views/results.js'); return m.missedPracticeHref(a);`);
    await b.go(href);
    t = await b.text();
    check('missed-word practice contains only the missed words', /Question 1 of 2/.test(t) && /missed words/.test(t), t.slice(0, 200));

    // Another student sees none of these results.
    const other = await b.js(`const s = (await WW.store.listStudents())[1]; return (await WW.store.listAttempts({ studentId: s.id })).length;`);
    check("results are not shared with the other student", other === 0);
  },
};
