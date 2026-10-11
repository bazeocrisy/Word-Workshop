// Milestone 6: printable sheets (approved content only), print CSS, pictures workflow.
import { APPROVED_SAMPLE } from './helpers.mjs';

export default {
  name: 'print',
  async run({ b, check }) {
    await b.fresh();
    const { sid, wid } = await b.js(APPROVED_SAMPLE);
    await b.go(`#/print/${wid}`);
    let t = await b.text();
    if (process.env.DEBUG) console.log(t.slice(0, 500), b.errors);
    check('weekly sheet has the spelling list in order with practice lines', /Spelling words/.test(t) && t.indexOf('rushed') < t.indexOf('crashed') && /write each word twice/.test(t));
    check('vocabulary study guide shows each word with its exact teacher definition and sentence', /Vocabulary study guide/.test(t) && /The ability to keep promises/.test(t) && /farmers market/.test(t));
    check('pictures are off by default (saves ink) and can be turned on', (await b.js(`return document.querySelectorAll('.vg-pic').length;`)) === 0);
    await b.js(`[...document.querySelectorAll('.print-controls input[type=checkbox]')][0].click(); await new Promise((r) => setTimeout(r, 300)); return 1;`);
    check('turning on pictures adds them to the guide', (await b.js(`return document.querySelectorAll('.vg-pic').length;`)) === 12);
    await b.js(`[...document.querySelectorAll('.print-controls input[type=checkbox]')][1].click(); await new Promise((r) => setTimeout(r, 200)); return 1;`);
    t = await b.text();
    check('spelling list can be grouped by pattern', /Double the last letter/.test(t));

    // Print media: site chrome and buttons hidden; sections break onto new pages.
    await b.send('Emulation.setEmulatedMedia', { media: 'print' });
    const pr = await b.js(`return {
      header: getComputedStyle(document.querySelector('.site-header')).display,
      controls: getComputedStyle(document.querySelector('.print-controls')).display,
      breakBefore: getComputedStyle(document.querySelectorAll('.print-section')[1]).breakBefore };`);
    await b.send('Emulation.setEmulatedMedia', { media: '' });
    check('print view hides the app header and buttons and starts each sheet on a new page', pr.header === 'none' && pr.controls === 'none' && pr.breakBefore === 'page', pr);

    // Read-aloud list for the no-speech fallback.
    await b.go(`#/print/${wid}?only=spelling&readaloud=1`);
    t = await b.text();
    check('read-aloud list gives the grown-up each word with its sentence in teacher order', /for the grown-up to read aloud/.test(t) && /rushed — We rushed to the bus stop/.test(t) && !/Vocabulary study guide/.test(t));

    // Unapproved weeks cannot be printed.
    const draft = await b.js(`return (await WW.store.createWeek(${JSON.stringify(sid)}, { startDate: '2026-11-02', endDate: '2026-11-06' })).id;`);
    await b.js(`await WW.store.editWeek(${JSON.stringify(draft)}, (w) => { w.spelling.push(WW.model.newSpellingItem({ word: 'secretword' })); }, { action: 't' }); return 1;`);
    await b.go(`#/print/${draft}`);
    t = await b.text();
    check('a week that is not approved cannot be printed', /not been approved/.test(t) && !/secretword/.test(t));

    // Results print with missed-word practice.
    await b.js(`await WW.store.saveAttempt({ studentId: ${JSON.stringify(sid)}, weekId: ${JSON.stringify(wid)}, snapshotVersion: 1, subject: 'spelling', activity: 'spelling', activityLabel: 'Spelling', mode: 'test', submittedAt: new Date().toISOString(), score: 13, total: 15, questions: [], missed: [{ itemId: 'a', word: 'stepped' }, { itemId: 'b', word: 'screamed' }] }); return 1;`);
    await b.go(`#/print/results/${sid}`);
    t = await b.text();
    check('results print lists attempts and a missed-word practice sheet', /Results — Alex/.test(t) && /13\/15 \(87%\)/.test(t) && /Missed-word practice/.test(t) && /stepped/.test(t));

    // Picture idea + honest placeholder.
    const prompt = await b.js(`const { picturePrompt, generateIllustration, GENERATION } = await import('./js/illustrations.js');
      const snap = await WW.store.getApprovedLesson(${JSON.stringify(wid)});
      let threw = false; try { await generateIllustration(); } catch { threw = true; }
      return { text: picturePrompt({ word: 'Melancholy', sourceDefinition: 'A sad or gloomy condition', parentDefinition: null, sentence: snap.vocab[7].sentence }, 3), threw, enabled: GENERATION.enabled };`);
    check('picture idea describes the approved meaning, child-safe, with no text in the picture', /Melancholy/.test(prompt.text) && /A sad or gloomy condition/.test(prompt.text) && /No words, letters or numbers/.test(prompt.text));
    check('automatic generation is not enabled and cannot pretend to run', prompt.threw && prompt.enabled === false);
  },
};
