// Milestone 2: week editor, sample data, paste import, review/acknowledge, approval, versions, isolation.
export default {
  name: 'lessons',
  async run({ b, check }) {
    await b.fresh();
    const [alex, jordan] = await b.js(`return (await WW.store.listStudents()).map((s) => s.id);`);
    const wid = await b.js(`return (await WW.store.createWeek(${JSON.stringify(alex)}, { startDate: '2026-10-12', endDate: '2026-10-16' })).id;`);
    const W = JSON.stringify(wid);
    await b.go(`#/parent/week/${wid}`);
    let t = await b.text();
    check('editor offers photo, paste and sample', /Upload photos/.test(t) && /Paste or type a list/.test(t) && /Load the sample week/.test(t));

    // Load sample data.
    await b.click('.sample-btn');
    await b.wait(600); await b.settle();
    let wk = await b.js(`return await WW.store.getWeek(${W});`);
    check('sample week loads 15 spelling and 12 vocabulary words', wk.spelling.length === 15 && wk.vocab.length === 12, [wk.spelling.length, wk.vocab.length]);
    check('sample spelling keeps the original order', wk.spelling.map((s) => s.word).join(',') === 'rushed,blasted,washed,winked,opened,buzzed,asked,called,lifted,landed,hunted,screamed,stepped,handed,crashed');
    check('sample items are not reviewed and not approved', wk.vocab.every((v) => !v.reviewed) && !wk.approvedVersion && WW_status(wk) === 'pending-review');
    check('sample sentences are labelled as generated', wk.vocab.every((v) => v.sentenceSource === 'generated') && wk.spelling.every((s) => s.sentenceSource === 'generated'));
    check('sample definitions are stored exactly as transcribed', wk.vocab.find((v) => v.word === 'Distracted').sourceDefinition === 'To prevent something from continuing as usual');
    t = await b.text();
    check('editor shows the imported Trustworthy/Distracted warnings', (t.match(/do not auto-correct/g) || []).length >= 2, t.length);
    check('approve button is disabled before review', await b.js(`return document.querySelector('.approve-btn').disabled;`));
    const refused = await b.js(`try { await WW.store.approveWeek(${W}); return 'approved'; } catch (e) { return (e.blockers || []).length; }`);
    check('store refuses approval while items are unchecked', typeof refused === 'number' && refused > 20, refused);

    // Student cannot see it.
    await b.go(`#/s/${alex}/w/${wid}`);
    check('student cannot open the unreviewed sample week', /not ready yet/.test(await b.text()));

    // Parent reviews everything: acknowledge every warning, tick every item.
    await b.go(`#/parent/week/${wid}`);
    const clicks = await b.js(`
      const pause = () => new Promise((r) => setTimeout(r, 15));
      let n = 0;
      for (let guard = 0; guard < 400; guard++) {
        const box = [...document.querySelectorAll('.ack-box')].find((x) => !x.checked);
        if (!box) break;
        box.click(); n++; await pause();
      }
      for (let guard = 0; guard < 400; guard++) {
        const box = [...document.querySelectorAll('.reviewed-box')].find((x) => !x.checked);
        if (!box) break;
        box.click(); n++; await pause();
      }
      await new Promise((r) => setTimeout(r, 500));
      return n;`);
    t = await b.text();
    check('after checking every item the week can be approved', /Everything is checked/.test(t) && !(await b.js(`return document.querySelector('.approve-btn').disabled;`)), { clicks, tail: t.slice(-500) });
    await b.click('.approve-btn');
    await b.wait(400); await b.settle();
    wk = await b.js(`return await WW.store.getWeek(${W});`);
    const snap1 = await b.js(`return await WW.store.getApprovedLesson(${W});`);
    check('approval creates version 1', wk.approvedVersion === 1 && snap1 && snap1.version === 1);
    check('approved definitions are the exact teacher wording', snap1.vocab.every((v) => v.definitionKind === 'teacher' && v.definition === v.teacherDefinition) && snap1.vocab.find((v) => v.word === 'Trustworthy').definition === 'The ability to keep promises');
    check('approved spelling keeps teacher order and groups', snap1.spelling.map((s) => s.word)[12] === 'stepped' && snap1.spelling[12].groups.spelling.key === 'double');
    t = await b.text();
    check('editor shows Approved state', /Approved \(version 1\)/.test(t));

    // Student side.
    await b.go(`#/s/${alex}`);
    t = await b.text();
    check('student now sees the approved week', /15 spelling · 12 vocabulary/.test(t), t.slice(0, 300));
    await b.go(`#/s/${alex}/w/${wid}`);
    t = await b.text();
    check('week home shows Spelling and Vocabulary with Study/Practice/Test', /Spelling/.test(t) && /Vocabulary/.test(t) && (t.match(/Study/g) || []).length >= 2 && (t.match(/Practice/g) || []).length >= 2 && (t.match(/Test/g) || []).length >= 2);
    await b.go(`#/s/${jordan}/w/${wid}`);
    check('another student cannot open an approved week by URL', /not ready yet|not available/.test(await b.text()));
    const jordanWeeks = await b.js(`return (await WW.store.listApprovedWeeks(${JSON.stringify(jordan)})).length;`);
    check("approved week does not appear in the other student's list", jordanWeeks === 0);

    // Correct a transcription in the UI → changes pending; student still sees v1.
    await b.go(`#/parent/week/${wid}`);
    await b.js(`
      const li = [...document.querySelectorAll('[data-item]')].find((x) => x.querySelector('.word-input')?.value === 'Peculiar');
      const ta = li.querySelector('.teacher-def'); ta.value = 'strange or unusual.'; ta.dispatchEvent(new Event('change'));
      await new Promise((r) => setTimeout(r, 400)); return true;`);
    wk = await b.js(`return await WW.store.getWeek(${W});`);
    const pec = wk.vocab.find((v) => v.word === 'Peculiar');
    check('transcription correction is logged with old and new wording', pec.definitionLog.length === 1 && pec.definitionLog[0].from === 'strange or unusual' && pec.definitionLog[0].to === 'strange or unusual.' && pec.originalTranscription === 'strange or unusual');
    check('editing an approved week shows Changes pending', WW_status(wk) === 'pending-changes' && /still sees version 1/.test(await b.text()));
    const stillV1 = await b.js(`return (await WW.store.getApprovedLesson(${W})).vocab.find((v) => v.word === 'Peculiar').definition;`);
    check('student still sees version 1 while changes are pending', stillV1 === 'strange or unusual');

    // Use own wording for Distracted, re-check, approve v2.
    await b.js(`
      const li = [...document.querySelectorAll('[data-item]')].find((x) => x.querySelector('.word-input')?.value === 'Distracted');
      li.querySelector('.own-box').click(); await new Promise((r) => setTimeout(r, 50));
      const ta = li.querySelector('.parent-def'); ta.value = 'Not paying attention because something else took your focus'; ta.dispatchEvent(new Event('change'));
      await new Promise((r) => setTimeout(r, 400));
      for (let g = 0; g < 50; g++) { const box = [...document.querySelectorAll('.ack-box')].find((x) => !x.checked); if (!box) break; box.click(); await new Promise((r) => setTimeout(r, 30)); }
      for (let g = 0; g < 50; g++) { const box = [...document.querySelectorAll('.reviewed-box')].find((x) => !x.checked); if (!box) break; box.click(); await new Promise((r) => setTimeout(r, 30)); }
      await new Promise((r) => setTimeout(r, 400)); return true;`);
    await b.click('.approve-btn');
    await b.wait(400); await b.settle();
    const snap2 = await b.js(`return await WW.store.getApprovedLesson(${W});`);
    const versions = await b.js(`return (await WW.store.listSnapshots(${W})).map((s) => s.version);`);
    const dis = snap2.vocab.find((v) => v.word === 'Distracted');
    check('re-approval creates version 2 and keeps version 1', snap2.version === 2 && versions.join() === '1,2', versions);
    check('parent wording is labelled parent-edited; teacher wording kept alongside', dis.definitionKind === 'parent-edited' && dis.teacherDefinition === 'To prevent something from continuing as usual');
    check('corrected transcription is used in version 2', snap2.vocab.find((v) => v.word === 'Peculiar').definition === 'strange or unusual.');
    const v1 = await b.js(`return (await WW.store.getSnapshot(${W}, 1)).vocab.find((v) => v.word === 'Distracted');`);
    check('version 1 is unchanged by later edits', v1.definition === 'To prevent something from continuing as usual' && v1.definitionKind === 'teacher');

    // Paste a list into a new week; reorder and delete through the UI.
    const w2 = await b.js(`return (await WW.store.createWeek(${JSON.stringify(jordan)}, { startDate: '2026-10-19', endDate: '2026-10-23' })).id;`);
    await b.go(`#/parent/week/${w2}`);
    await b.click('.paste-btn');
    await b.wait(100);
    await b.js(`const ta = document.querySelector('.dialog textarea'); ta.value = 'Spelling Words\\n1. hoped\\n2. hopped\\n3. cried'; ta.dispatchEvent(new Event('input')); return true;`);
    const prev = await b.js(`return document.querySelector('.paste-preview').innerText;`);
    check('paste preview shows the parsed words', /3 spelling words: hoped, hopped, cried/.test(prev), prev);
    await b.click('.dialog .btn-primary', '/Add words/');
    await b.wait(500);
    let w2d = await b.js(`return await WW.store.getWeek(${JSON.stringify(w2)});`);
    check('pasted words are added as unchecked drafts with suggested patterns', w2d.spelling.map((s) => s.word).join() === 'hoped,hopped,cried' && w2d.spelling.every((s) => !s.reviewed && s.origin === 'pasted') && w2d.spelling[1].groups.spelling.key === 'double');
    await b.js(`document.querySelector('[data-item] .mv-down').click(); await new Promise((r) => setTimeout(r, 300)); return true;`);
    w2d = await b.js(`return await WW.store.getWeek(${JSON.stringify(w2)});`);
    check('parent can reorder words', w2d.spelling.map((s) => s.word).join() === 'hopped,hoped,cried', w2d.spelling.map((s) => s.word));
    await b.js(`document.querySelectorAll('[data-item] .del-btn')[2].click(); await new Promise((r) => setTimeout(r, 100)); return true;`);
    await b.click('.dialog .btn-danger', '/Delete/');
    await b.wait(300);
    w2d = await b.js(`return await WW.store.getWeek(${JSON.stringify(w2)});`);
    check('parent can delete a word (after confirming)', w2d.spelling.map((s) => s.word).join() === 'hopped,hoped');
    // Change a suggested pattern.
    await b.js(`const s = document.querySelector('[data-item] .sound-select'); s.value = 'd'; s.dispatchEvent(new Event('change')); await new Promise((r) => setTimeout(r, 300)); return true;`);
    w2d = await b.js(`return await WW.store.getWeek(${JSON.stringify(w2)});`);
    check('parent can correct a suggested pattern', w2d.spelling[0].groups.sound.key === 'd' && w2d.spelling[0].groups.source === 'parent');
    const log = await b.js(`return (await WW.store.getWeek(${JSON.stringify(w2)})).editLog.map((e) => e.action);`);
    check('changes are recorded in the week history', ['words added', 'reordered', 'deleted', 'pattern changed'].every((a) => log.includes(a)), log);

    // Backup round trip with a real picture blob.
    const rt = await b.js(`
      const c = document.createElement('canvas'); c.width = 40; c.height = 30; const x = c.getContext('2d'); x.fillStyle = '#f00'; x.fillRect(0, 0, 20, 30);
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      const ref = await WW.store.saveImage(blob, { kind: 'upload' });
      const bk = await import('./js/backup.js');
      const text = JSON.stringify(await bk.buildBackup());
      const before = await WW.store.dumpAll();
      await bk.restoreBackup(text);
      const after = await WW.store.dumpAll();
      const img = after.images.find((i) => i.id === ref);
      const same = img && img.blob.size === blob.size && img.blob.type === 'image/png';
      const snaps = JSON.stringify(after.snapshots.map((s) => s.vocab.map((v) => v.definition)));
      return { same, snapsEqual: snaps === JSON.stringify(before.snapshots.map((s) => s.vocab.map((v) => v.definition))), weeks: after.weeks.length };`);
    check('backup round trip restores pictures and approved definitions exactly', rt.same && rt.snapsEqual && rt.weeks === 2, rt);
  },
};

function WW_status(w) {
  const has = w.vocab.length + w.spelling.length > 0;
  if (!w.approvedVersion) return has ? 'pending-review' : 'draft';
  return w.revision === w.approvedRevision ? 'approved' : 'pending-changes';
}
