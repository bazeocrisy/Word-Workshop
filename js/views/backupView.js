import { h, fill, page, btn, toast, dialog, alertDialog } from '../ui.js';
import { exportBackup, parseBackupText, restoreBackup, undoInfo, undoRestore, discardUndo } from '../backup.js';
import { getMeta } from '../store.js';
import { fmtDateTime } from '../ui.js';
import { go } from '../router.js';

export async function backupView() {
  const last = await getMeta('lastBackupAt');
  const file = h('input', { type: 'file', accept: 'application/json,.json', id: 'restore-file' });
  const out = h('div', { 'aria-live': 'polite' });

  file.addEventListener('change', async () => {
    fill(out, );
    const f = file.files[0];
    if (!f) return;
    const text = await f.text().catch(() => '');
    const parsed = parseBackupText(text);
    if (!parsed.ok) {
      out.append(h('div', { class: 'card notice notice-error', role: 'alert' },
        h('p', null, h('strong', null, 'This file cannot be restored. Nothing was changed.')),
        h('ul', null, parsed.errors.map((e) => h('li', null, e)))));
      file.value = '';
      return;
    }
    const s = parsed.summary;
    out.append(h('div', { class: 'card' },
      h('h3', null, 'Backup contents'),
      h('ul', null,
        h('li', null, `Made: ${s.exportedAt ? fmtDateTime(s.exportedAt) : 'unknown'}`),
        h('li', null, `Students: ${s.students} (${s.studentNames.join(', ')})`),
        h('li', null, `Weeks: ${s.weeks}, approved versions: ${s.approvedVersions}`),
        h('li', null, `Results: ${s.results}, pictures: ${s.pictures}`)),
      h('div', { class: 'notice notice-warn' }, h('p', null, 'Restoring replaces ALL data on this device (every student, week and result) with this backup. You can undo it once afterwards.')),
      btn('Replace all data with this backup', async () => {
        const ok = await dialog({ title: 'Replace all data?', body: 'Everything currently on this device will be replaced by the backup.', buttons: [{ label: 'Replace all data', value: true, cls: 'btn-danger' }] });
        if (!ok) return;
        try { await restoreBackup(text); toast('Backup restored.'); go('#/parent'); }
        catch (e) { await alertDialog('Restore failed', (e.errors || [e.message]).join(' ')); }
      }, 'btn-danger')));
  });

  const info = await undoInfo();
  const undo = info ? h('section', { class: 'card' },
    h('h2', null, 'Undo last restore'),
    h('p', { class: 'hint' }, `A backup was restored on ${fmtDateTime(info.at)}. You can put back the data that was here before it. Anything added since then (new weeks or results) would be lost.`),
    h('div', { class: 'row' },
      btn('Undo restore', async () => {
        if (!(await dialog({ title: 'Undo restore?', body: `This replaces the current data with what was on this device before ${fmtDateTime(info.at)}. Weeks and results added since then will be lost.`, buttons: [{ label: 'Undo restore', value: true, cls: 'btn-danger' }] }))) return;
        await undoRestore(); toast('Previous data restored.'); go('#/parent');
      }, 'btn-ghost'),
      btn('Forget the old data', async () => { await discardUndo(); toast('Old data removed.'); go('#/parent/backup'); }, 'btn-ghost'))) : null;

  return page({ title: 'Backup & restore', back: '#/parent', backLabel: 'Parent area', cls: 'parent' },
    h('div', { class: 'card notice' },
      h('p', null, 'Word Workshop saves everything in this browser on this device. It does not sync between devices.'),
      h('p', null, 'To keep your lessons safe or move them to another device, download a backup file and restore it there.')),
    h('section', { class: 'card' },
      h('h2', null, 'Download a backup'),
      h('p', { class: 'hint' }, last ? `Last backup: ${fmtDateTime(last)}` : 'No backup made yet.'),
      h('p', { class: 'hint' }, 'The file contains names, word lists, pictures and results. Keep it private; do not upload it to a public website.'),
      btn('Download backup', async () => { try { await exportBackup(); toast('Backup downloaded.'); go('#/parent/backup'); } catch (e) { toast('Backup failed: ' + e.message, 'error'); } }, 'btn-primary')),
    h('section', { class: 'card' },
      h('h2', null, 'Restore from a backup'),
      h('label', { for: 'restore-file', class: 'file-label' }, 'Choose a backup file (.json)'), file, out),
    undo);
}
