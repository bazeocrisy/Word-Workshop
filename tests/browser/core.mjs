// Milestone 1: profiles, storage, persistence, isolation, backup/restore, PIN, base path.
export default {
  name: 'core',
  async run({ b, check, URL }) {
    await b.fresh();
    let t = await b.text();
    check('home lists the two demo profiles', /Alex/.test(t) && /Jordan/.test(t) && /Grade 3/.test(t) && /Grade 5/.test(t), t.slice(0, 200));
    check('home explains data stays on this device', /this device only/.test(t));
    const ids = await b.js(`return (await WW.store.listStudents()).map((s) => s.id);`);
    check('two students created on first run', ids.length === 2);
    const [alex, jordan] = ids;

    await b.go(`#/s/${alex}`);
    t = await b.text();
    check('student with no approved weeks sees a friendly empty state', /No lessons are ready yet/.test(t), t);

    // Create weeks for both students through the parent UI.
    await b.go('#/parent');
    t = await b.text();
    check('parent dashboard shows both students', /Alex/.test(t) && /Jordan/.test(t));
    check('parent dashboard nudges for a first backup', /not made a backup yet/.test(t));
    await b.click('.student-card .btn-primary', '/New week/');
    await b.wait(100);
    const dlg = await b.js(`return { title: document.querySelector('.dialog h2')?.textContent, start: document.querySelector('.dialog input[type=date]')?.value };`);
    check('new-week dialog opens with a Monday start date', dlg.title === 'New week' && /^\d{4}-\d{2}-\d{2}$/.test(dlg.start) && new Date(dlg.start + 'T12:00').getDay() === 1, dlg);
    await b.js(`const d = document.querySelectorAll('.dialog input[type=date]'); d[0].value = '2026-10-12'; d[0].dispatchEvent(new Event('change')); return true;`);
    const endAuto = await b.js(`return document.querySelectorAll('.dialog input[type=date]')[1].value;`);
    check('end date follows the start date (Friday)', endAuto === '2026-10-16', endAuto);
    await b.click('.dialog .btn-primary', '/Create week/');
    await b.settle();
    const hash = await b.js('return location.hash;');
    check('creating a week opens its editor', /^#\/parent\/week\/w_/.test(hash), hash);
    const wid = hash.split('/').pop();

    await b.js(`await WW.store.createWeek(${JSON.stringify(jordan)}, { startDate: '2026-10-12', endDate: '2026-10-16' }); return true;`);
    const counts = await b.js(`return [(await WW.store.listWeeks(${JSON.stringify(alex)})).length, (await WW.store.listWeeks(${JSON.stringify(jordan)})).length];`);
    check('weeks are stored per student', counts[0] === 1 && counts[1] === 1, counts);

    // Persistence across reload.
    await b.reload();
    await b.js(`for (let i = 0; i < 100 && !window.WW?.ready; i++) await new Promise((r) => setTimeout(r, 50));`);
    const persisted = await b.js(`return !!(await WW.store.getWeek(${JSON.stringify(wid)}));`);
    check('week survives a page reload', persisted);
    await b.go('#/parent');
    t = await b.text();
    check('new empty week shows as Draft', /Draft/.test(t), t.slice(0, 400));

    // Student cannot open a week that is not approved, even by typing the URL.
    await b.go(`#/s/${alex}/w/${wid}`);
    t = await b.text();
    check('unapproved week is not reachable from the student side', /not ready yet/.test(t), t);
    await b.go(`#/s/${jordan}/w/${wid}`);
    t = await b.text();
    check('another student cannot open this week', /not ready yet|not available/.test(t), t);

    // Settings: rename a student.
    await b.go('#/parent/settings');
    await b.js(`const i = document.querySelector('.student-edit input[type=text]'); i.value = 'Riley'; return true;`);
    await b.click('.student-edit .btn-primary', '/Save/');
    await b.settle();
    const renamed = await b.js(`return (await WW.store.getStudent(${JSON.stringify(alex)})).displayName;`);
    check('parent can rename a student', renamed === 'Riley', renamed);
    const removeBlocked = await b.js(`try { await WW.store.removeStudent(${JSON.stringify(alex)}); return 'removed'; } catch (e) { return e.message; }`);
    check('a student with weeks cannot be removed by accident', /still has weeks/.test(removeBlocked), removeBlocked);

    // Backup round trip + malformed rejection (module API; the UI is exercised below).
    const rt = await b.js(`
      const bk = await import('./js/backup.js');
      const before = await WW.store.dumpAll();
      const backup = await bk.buildBackup();
      const text = JSON.stringify(backup);
      const bad = bk.parseBackupText('{"app":"word-workshop"');
      await WW.store.createWeek(${JSON.stringify(alex)}, { startDate: '2026-11-02', endDate: '2026-11-06' });
      await bk.restoreBackup(text);
      const after = await WW.store.dumpAll();
      const undoOk = await bk.hasUndo();
      return { badOk: bad.ok, badErr: bad.errors[0], weeksBefore: before.weeks.length, weeksAfter: after.weeks.length, students: after.students.length, undoOk };`);
    check('malformed backup is rejected with a reason', rt.badOk === false && /damaged|not valid/.test(rt.badErr), rt);
    check('restore replaces data with the backup contents', rt.weeksBefore === 2 && rt.weeksAfter === 2 && rt.students === 2, rt);
    check('restore keeps an undo copy', rt.undoOk === true);
    const undone = await b.js(`const bk = await import('./js/backup.js'); await bk.undoRestore(); return (await WW.store.dumpAll()).weeks.length;`);
    check('undo restore brings back the replaced data', undone === 3, undone);

    // Backup UI: malformed file shows errors and changes nothing.
    await b.go('#/parent/backup');
    t = await b.text();
    check('backup page says data does not sync', /does not sync/.test(t));
    const ui = await b.js(`
      const input = document.getElementById('restore-file');
      const dt = new DataTransfer(); dt.items.add(new File(['{"app":"nope"}'], 'x.json', { type: 'application/json' }));
      input.files = dt.files; input.dispatchEvent(new Event('change'));
      await new Promise((r) => setTimeout(r, 300));
      return { text: document.getElementById('app').innerText, weeks: (await WW.store.dumpAll()).weeks.length };`);
    check('backup page rejects a bad file and changes nothing', /cannot be restored/.test(ui.text) && ui.weeks === 3, ui.text.slice(-300));

    // PIN gate.
    await b.js(`const c = await import('./js/views/common.js'); await c.setPin('2468'); sessionStorage.clear(); return true;`);
    await b.go('#/parent');
    t = await b.text();
    check('parent area asks for the PIN when one is set', /Enter the parent PIN/.test(t) && !/New week/.test(t), t.slice(0, 200));
    await b.js(`document.querySelector('.pin-input').value = '1111'; document.querySelector('form').requestSubmit(); await new Promise((r) => setTimeout(r, 200)); return true;`);
    t = await b.text();
    check('wrong PIN is refused', /not right/.test(t));
    await b.js(`document.querySelector('.pin-input').value = '2468'; document.querySelector('form').requestSubmit(); return true;`);
    await b.settle();
    t = await b.text();
    check('correct PIN unlocks the parent area', /New week/.test(t), t.slice(0, 200));
    await b.js(`const c = await import('./js/views/common.js'); await c.setPin(null); return true;`);

    // Content-Security-Policy: pictures or scripts from other websites are blocked (and the test would notice).
    const before = b.errors.length;
    await b.js(`const i = new Image(); i.src = 'https://example.com/tracker.png'; document.body.append(i); await new Promise((r) => setTimeout(r, 300)); i.remove(); return 1;`);
    const cspErrors = b.errors.splice(before).filter((e) => /CSP violation: img-src/.test(e));
    check('security policy blocks content from other websites', cspErrors.length === 1, cspErrors);

    const manifest = await b.js(`const r = await fetch('manifest.webmanifest'); return r.ok && (await r.json()).start_url;`);
    check('web app manifest loads under the base path', manifest === './index.html', manifest);
  },
};
