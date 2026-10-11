// Parent dashboard, new-week dialog and settings.
import { h, page, link, btn, field, dialog, toast, badge, confirmDialog, emptyState } from '../ui.js';
import { listStudents, listWeeks, createWeek, addStudent, updateStudent, removeStudent, getMeta, COLORS, deleteWeek, getWeek } from '../store.js';
import { weekStatus, STATUS_LABELS, weekLabel, schoolWeekOf } from '../model.js';
import { avatar, deviceNotice, pinEnabled, setPin, askPinDialog, lockParent } from './common.js';
import { go } from '../router.js';

const STATUS_KIND = { draft: 'grey', 'pending-review': 'warn', approved: 'ok', 'pending-changes': 'warn' };

export function statusBadge(week) {
  const s = weekStatus(week);
  return badge(STATUS_LABELS[s], STATUS_KIND[s]);
}

async function backupReminder() {
  const last = await getMeta('lastBackupAt');
  const days = last ? (Date.now() - new Date(last).getTime()) / 864e5 : Infinity;
  if (days < 7) return null;
  return h('div', { class: 'card notice notice-warn', role: 'note' },
    h('p', null, last ? `Your last backup was ${Math.floor(days)} days ago.` : 'You have not made a backup yet.'),
    h('p', { class: 'hint' }, 'Safari on iPhone and iPad can remove saved website data after about a week without use. Adding Word Workshop to your Home Screen and making regular backups keeps your lessons safe.'),
    link('Make a backup', '#/parent/backup', 'btn btn-primary'));
}

export async function newWeekDialog(studentId, students) {
  const def = schoolWeekOf();
  const who = h('select', null, students.map((s) => h('option', { value: s.id, selected: s.id === studentId }, s.displayName)));
  const start = h('input', { type: 'date', value: def.startDate, required: true });
  const end = h('input', { type: 'date', value: def.endDate });
  start.addEventListener('change', () => {
    const [y, m, d] = start.value.split('-').map(Number);
    if (!y) return;
    const e = new Date(y, m - 1, d + 4);
    end.value = `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, '0')}-${String(e.getDate()).padStart(2, '0')}`;
  });
  const title = h('input', { type: 'text', maxlength: '60', placeholder: 'Optional, e.g. Unit 3 Week 2' });
  const v = await dialog({ title: 'New week', body: h('div', null, field('Student', who), h('div', { class: 'two-col' }, field('Starts', start), field('Ends', end)), field('Name (optional)', title)),
    buttons: [{ label: 'Create week', value: () => ({ studentId: who.value, startDate: start.value, endDate: end.value, title: title.value.trim() }) }] });
  if (!v) return null;
  if (!v.startDate) { toast('Choose a start date.', 'error'); return null; }
  if (v.endDate && v.endDate < v.startDate) { toast('The end date is before the start date.', 'error'); return null; }
  const w = await createWeek(v.studentId, { startDate: v.startDate, endDate: v.endDate || v.startDate, title: v.title });
  go(`#/parent/week/${w.id}`);
  return w;
}

export async function parentDashboard() {
  const students = await listStudents();
  const cards = [];
  for (const st of students) {
    const weeks = await listWeeks(st.id);
    cards.push(h('section', { class: 'card student-card', 'aria-labelledby': `ps-${st.id}` },
      h('div', { class: 'card-head' }, avatar(st), h('h2', { id: `ps-${st.id}` }, st.displayName, st.grade ? h('span', { class: 'muted' }, ` · Grade ${st.grade}`) : null)),
      weeks.length ? h('ul', { class: 'admin-weeks', role: 'list' }, weeks.map((w) => h('li', null,
        h('a', { href: `#/parent/week/${w.id}`, class: 'admin-week' }, h('span', null, weekLabel(w)), statusBadge(w)))))
        : h('p', { class: 'hint' }, 'No weeks yet.'),
      h('div', { class: 'row' },
        btn('New week', () => newWeekDialog(st.id, students), 'btn-primary'),
        link('Results', `#/parent/results/${st.id}`, 'btn btn-ghost'))));
  }
  return page({ title: 'Parent area', back: '#/', backLabel: 'Students', cls: 'parent',
    subtitle: 'Upload or type this week\'s words, check them, then approve the week so your child can study it.' },
  await backupReminder(),
  students.length ? cards : emptyState('Add a student in Settings to get started.', link('Settings', '#/parent/settings', 'btn btn-primary')),
  h('nav', { class: 'row parent-nav', 'aria-label': 'Parent tools' },
    link('Backup & restore', '#/parent/backup', 'btn btn-ghost'),
    link('Settings', '#/parent/settings', 'btn btn-ghost'),
    (await pinEnabled()) ? btn('Lock parent area', () => { lockParent(); go('#/'); }, 'btn-ghost') : null),
  deviceNotice());
}

export async function settingsView() {
  const students = await listStudents();
  const rows = students.map((st) => {
    const name = h('input', { type: 'text', value: st.displayName, maxlength: '30' });
    const grade = h('select', null, ['', 'K', 1, 2, 3, 4, 5, 6, 7, 8].map((g) => h('option', { value: String(g), selected: String(st.grade ?? '') === String(g) }, g === '' ? '—' : `Grade ${g}`)));
    const color = h('select', null, COLORS.map((c) => h('option', { value: c, selected: st.color === c }, c[0].toUpperCase() + c.slice(1))));
    return h('div', { class: 'card student-edit' },
      h('div', { class: 'card-head' }, avatar(st), h('h2', null, st.displayName)),
      h('div', { class: 'three-col' }, field('Name', name), field('Grade', grade), field('Colour', color)),
      h('div', { class: 'row' },
        btn('Save', async () => {
          if (!name.value.trim()) { toast('Enter a name.', 'error'); return; }
          await updateStudent(st.id, { displayName: name.value.trim(), grade: grade.value === '' ? null : (isNaN(+grade.value) ? grade.value : +grade.value), color: color.value });
          toast('Saved.'); go('#/parent/settings');
        }, 'btn-primary'),
        btn('Remove', async () => {
          if (!(await confirmDialog('Remove student?', `Remove ${st.displayName}? This is only possible when they have no weeks or results.`, 'Remove', true))) return;
          try { await removeStudent(st.id); toast('Removed.'); go('#/parent/settings'); } catch (e) { toast(e.message, 'error'); }
        }, 'btn-ghost')));
  });
  const pinOn = await pinEnabled();
  return page({ title: 'Settings', back: '#/parent', backLabel: 'Parent area', cls: 'parent' },
    h('h2', null, 'Students'),
    h('p', { class: 'hint' }, 'Profiles start with demo names. Change them to your children\'s names; names are stored only on this device.'),
    rows,
    btn('Add a student', async () => { await addStudent({ displayName: 'New student', grade: null }); go('#/parent/settings'); }, 'btn-ghost'),
    h('h2', null, 'Parent PIN'),
    h('p', { class: 'hint' }, pinOn ? 'A PIN is set. Children need it to open the parent area.' : 'No PIN is set. Anyone using this device can open the parent area.'),
    h('div', { class: 'row' },
      btn(pinOn ? 'Change PIN' : 'Set a PIN', async () => { if (await askPinDialog()) go('#/parent/settings'); }, 'btn-ghost'),
      pinOn ? btn('Remove PIN', async () => { await setPin(null); toast('PIN removed.'); go('#/parent/settings'); }, 'btn-ghost') : null),
    h('h2', null, 'Speech'),
    h('p', null, link('Test the voice on this device', '#/parent/speech', 'btn btn-ghost')),
    deviceNotice());
}

export async function confirmDeleteWeek(weekId) {
  const w = await getWeek(weekId);
  if (!w) return;
  const ok = await confirmDialog('Delete this week?', `Delete ${weekLabel(w)} with all its versions and results? This cannot be undone. Consider making a backup first.`, 'Delete week', true);
  if (!ok) return;
  await deleteWeek(weekId);
  toast('Week deleted.');
  go('#/parent');
}
