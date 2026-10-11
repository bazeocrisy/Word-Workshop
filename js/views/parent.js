// Parent dashboard (create, continue and manage lessons), results index and settings.
import { h, page, link, btn, field, toast, badge, confirmDialog, emptyState } from '../ui.js';
import { listStudents, listWeeks, addStudent, updateStudent, removeStudent, getMeta, COLORS, deleteWeek, getWeek } from '../store.js';
import { weekStatus, STATUS_LABELS, weekLabel } from '../model.js';
import { DEMO_STUDENTS } from '../store.js';
import { avatar, themeClass, deviceNotice, pinEnabled, setPin, askPinDialog, lockParent } from './common.js';
import { resumeHref, resumeStage, stageLabel, lessonHref } from './lessonSteps.js';
import { go } from '../router.js';
import * as cloud from '../cloudOcr.js';

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

export async function parentDashboard() {
  const students = await listStudents();
  const drafts = [], approved = [];
  for (const st of students) for (const w of await listWeeks(st.id)) {
    if (w.approvedVersion) approved.push({ st, w });
    // In progress: never approved, or approved and then changed (the student still sees the approved version).
    if (!w.approvedVersion || weekStatus(w) === 'pending-changes') drafts.push({ st, w });
  }
  drafts.sort((x, y) => String(y.w.updatedAt).localeCompare(String(x.w.updatedAt)));
  const counts = (w) => `${w.vocab.length} vocabulary · ${w.spelling.length} spelling`;

  const draftRows = await Promise.all(drafts.map(async ({ st, w }) => h('li', { class: 'lesson-row' },
    avatar(st),
    h('div', { class: 'lesson-main' },
      h('span', { class: 'lesson-name' }, `${st.displayName} · ${weekLabel(w)} `, statusBadge(w)),
      h('span', { class: 'lesson-meta' }, counts(w), ' · ', w.approvedVersion ? `Changes not approved yet; ${st.displayName} still sees version ${w.approvedVersion}` : stageLabel(await resumeStage(w)))),
    h('div', { class: 'lesson-actions' },
      link('Continue', await resumeHref(w), 'btn btn-primary btn-small continue-draft', { 'aria-label': `Continue ${st.displayName}'s lesson, ${weekLabel(w)}` }),
      // An approved lesson has results; deleting it is done deliberately from the lesson page, not from this list.
      w.approvedVersion ? null : btn('Delete', () => confirmDeleteWeek(w.id), 'btn-ghost btn-small', { 'aria-label': `Delete ${st.displayName}'s draft lesson, ${weekLabel(w)}` })))));

  const approvedFor = (st) => {
    const mine = approved.filter((x) => x.st.id === st.id);
    return h('section', { class: 'card student-card', 'aria-labelledby': `ps-${st.id}` },
      h('div', { class: 'card-head' }, avatar(st), h('h3', { id: `ps-${st.id}` }, st.displayName, st.grade ? h('span', { class: 'muted' }, ` · Grade ${st.grade}`) : null)),
      mine.length ? h('ul', { class: 'admin-weeks', role: 'list' }, mine.map(({ w }) => h('li', null,
        h('a', { href: `${lessonHref(w.id)}?stage=check`, class: 'admin-week' },
          h('span', null, weekLabel(w), w.archived ? h('span', { class: 'muted' }, ' (archived)') : null, h('span', { class: 'lesson-meta' }, counts(w))),
          statusBadge(w)))))
        : h('p', { class: 'hint' }, 'No approved lessons yet.'),
      h('div', { class: 'row' }, link(`${st.displayName}'s results`, `#/parent/results/${st.id}`, 'btn btn-ghost btn-small')));
  };

  return page({ title: 'Parent area', back: '#/', backLabel: 'Home', cls: 'parent dashboard',
    subtitle: 'Create each week\'s lesson, check it, and approve it so your child can study it.' },
  students.length ? h('section', { class: 'card create-card', 'aria-labelledby': 'pd-create' },
    h('h2', { id: 'pd-create' }, 'New week'),
    h('p', null, 'Upload or type the teacher\'s spelling and vocabulary lists, check every word, then approve.'),
    link(h('span', null, h('span', { 'aria-hidden': 'true' }, '＋ '), 'Create this week\'s lesson'), '#/parent/new', 'btn btn-primary btn-big create-lesson'))
    : emptyState('Add a student in Settings to get started.', link('Settings', '#/parent/settings', 'btn btn-primary')),
  students.some((x) => DEMO_STUDENTS.some((d) => d.displayName === x.displayName)) ? h('div', { class: 'card notice' }, h('p', null, 'The profiles start with demo names. Change them to your children\'s names in Settings (names stay on this device).'), link('Rename in Settings', '#/parent/settings', 'btn btn-ghost btn-small')) : null,
  await backupReminder(),
  h('div', { class: 'dash-grid' },
    h('section', { class: 'dash-col', 'aria-labelledby': 'pd-drafts' },
      h('h2', { id: 'pd-drafts' }, `Lessons in progress (${drafts.length})`),
      drafts.length ? h('ul', { class: 'lesson-list card', role: 'list' }, draftRows)
        : h('p', { class: 'hint' }, 'None. Lessons you start but have not approved yet appear here, so you can continue them later.')),
    h('section', { class: 'dash-col', 'aria-labelledby': 'pd-approved' },
      h('h2', { id: 'pd-approved' }, 'Approved lessons'),
      h('p', { class: 'hint' }, 'Open a lesson to change it. Changes need approving again before your child sees them.'),
      students.map(approvedFor))),
  h('section', { 'aria-labelledby': 'pd-tools' },
    h('h2', { id: 'pd-tools' }, 'Results, backup and settings'),
    h('nav', { class: 'row parent-nav', 'aria-label': 'Parent tools' },
      link('Student results', '#/parent/results', 'btn btn-ghost'),
      link('Backup & restore', '#/parent/backup', 'btn btn-ghost'),
      link('Settings', '#/parent/settings', 'btn btn-ghost'),
      (await pinEnabled()) ? btn('Lock parent area', () => { lockParent(); go('#/'); }, 'btn-ghost') : null)),
  deviceNotice());
}

/** Results: one entry per student. */
export async function resultsIndex() {
  const students = await listStudents();
  return page({ title: 'Student results', back: '#/parent', backLabel: 'Parent area', cls: 'parent' },
    students.length ? h('ul', { class: 'profile-grid', role: 'list' }, students.map((st) => h('li', null,
      h('a', { href: `#/parent/results/${st.id}`, class: `profile-card ${themeClass(st)}` }, avatar(st, 'avatar-lg'), h('span', { class: 'profile-name' }, st.displayName), h('span', { class: 'profile-grade' }, 'See results')))))
      : emptyState('No students yet.'));
}

export async function settingsView() {
  const students = await listStudents();
  const rows = students.map((st) => {
    const name = h('input', { type: 'text', value: st.displayName, maxlength: '30' });
    const grade = h('select', null, ['', 'K', 1, 2, 3, 4, 5, 6, 7, 8].map((g) => h('option', { value: String(g), selected: String(st.grade ?? '') === String(g) }, g === '' ? '—' : `Grade ${g}`)));
    const color = h('select', null, COLORS.map((c) => h('option', { value: c, selected: st.color === c }, c[0].toUpperCase() + c.slice(1))));
    return h('div', { class: 'card student-edit' },
      h('div', { class: 'card-head' }, avatar(st), h('h2', null, st.displayName)),
      h('div', { class: 'three-col' }, field(`Name (${st.displayName})`, name), field(`Grade (${st.displayName})`, grade), field(`Colour (${st.displayName})`, color)),
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
    onlineReaderSettings(pinOn),
    deviceNotice());
}

/** Optional online photo reader: address + passphrase of the family's own reader server (see docs/OCR.md). */
function onlineReaderSettings(pinOn) {
  const cfg = cloud.getConfig() || { url: '', passphrase: '', enabled: false };
  const url = h('input', { type: 'url', value: cfg.url || cloud.READER_ORIGIN, placeholder: cloud.READER_ORIGIN, autocomplete: 'off', spellcheck: 'false' });
  // The saved passphrase is never put back into the page; leaving the field empty keeps it.
  const pass = h('input', { type: 'password', value: '', autocomplete: 'off', placeholder: cfg.passphrase ? 'Saved (leave empty to keep it)' : '' });
  const on = h('input', { type: 'checkbox', checked: !!cfg.enabled, id: 'online-reader-on' });
  const msg = h('p', { class: 'hint', 'aria-live': 'polite' }, cfg.enabled ? 'On: worksheet photos are read online.' : 'Off: worksheet photos are read on this device.');
  const read = () => ({ url: url.value.trim(), passphrase: pass.value || cfg.passphrase, enabled: on.checked });
  const MIN_PASS = 20; // long enough that it cannot be guessed by trying many (the reader server does not lock out)
  // The site's security policy only lets the app connect to the family's reader server (see index.html).
  const sameReader = (u) => { try { return new URL(u).origin === cloud.READER_ORIGIN; } catch { return false; } };
  const valid = (c) => sameReader(c.url) && c.passphrase;
  return h('section', { class: 'online-reader' },
    h('h2', null, 'Online photo reader (optional)'),
    h('p', { class: 'hint' }, 'Reads worksheet photos much more accurately than the reader on this device, especially vocabulary tables. Words still arrive as drafts for you to check.'),
    h('ul', { class: 'hint online-reader-terms' },
      h('li', null, h('strong', null, 'Photos leave this device: '), 'when it is on, each worksheet photo you upload is sent to your own reader server and from there to Anthropic (the company that makes Claude) to be read. Anthropic says uploaded images are not stored after the request and are not used for training; check your account\'s terms in the Anthropic Console.'),
      h('li', null, h('strong', null, 'Cost: '), 'about 2 to 5 cents per photo on your Anthropic account. Set a monthly spending limit there.'),
      h('li', null, h('strong', null, 'Children: '), 'set a parent PIN (above) so children cannot use it.')),
    field('Reader address', url, `Your reader server: ${cloud.READER_ORIGIN}`),
    field('Passphrase', pass, `At least ${MIN_PASS} characters, the same one you gave the reader server. Stored only in this browser; not included in backups.`),
    h('label', { class: 'check' }, on, h('span', null, 'Read worksheet photos online')),
    h('div', { class: 'row' },
      btn('Save', () => {
        const c = read();
        if (c.enabled && !valid(c)) { toast(`Enter the reader address (${cloud.READER_ORIGIN}) and the passphrase first.`, 'error'); return; }
        if (pass.value && pass.value.length < MIN_PASS) { toast(`The passphrase must be at least ${MIN_PASS} characters.`, 'error'); return; }
        if (!c.url && !c.passphrase) { cloud.setConfig(null); msg.textContent = 'Removed. Photos are read on this device.'; toast('Saved.'); return; }
        if (!cloud.setConfig(c)) { toast('This browser would not save the setting.', 'error'); return; }
        msg.textContent = c.enabled ? 'On: worksheet photos are read online.' : 'Off: worksheet photos are read on this device.';
        pass.value = ''; pass.placeholder = 'Saved (leave empty to keep it)'; cfg.passphrase = c.passphrase;
        if (c.enabled && !pinOn) msg.textContent += ' Tip: set a parent PIN so children cannot use it.';
        toast('Saved.');
      }, 'btn-primary'),
      btn('Test connection', async () => {
        const c = read();
        if (!valid(c)) { msg.textContent = `Enter the reader address (${cloud.READER_ORIGIN}) and the passphrase first.`; return; }
        msg.textContent = 'Testing…';
        try { const r = await cloud.ping(c); msg.textContent = `Connected: the reader server and Anthropic accepted it${r.model ? ` (${r.model})` : ''}. Remember to Save.`; }
        catch (e) { msg.textContent = e.status === 502 ? 'The reader server answered, but Anthropic did not accept its API key or model name. Check the server\'s settings.' : (e.message || 'Could not connect.'); }
      }, 'btn-ghost')),
    msg);
}

export async function confirmDeleteWeek(weekId) {
  const w = await getWeek(weekId);
  if (!w) return;
  const ok = await confirmDialog('Delete this week?', `Delete ${weekLabel(w)} with all its versions and results? This cannot be undone. Consider making a backup first.`, 'Delete week', true);
  if (!ok) return;
  await deleteWeek(weekId);
  for (const kind of ['vocab', 'spelling']) { try { sessionStorage.removeItem(`ww-add:${weekId}:${kind}`); } catch { /* ignore */ } }
  toast('Week deleted.');
  go('#/parent');
}
