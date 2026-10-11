// Student dashboard and week home. Reads approved snapshots only.
import { h, page, link, emptyState } from '../ui.js';
import { listApprovedWeeks, getApprovedLesson, listAttempts } from '../store.js';
import { weekLabel } from '../model.js';
import { requireStudent, themeClass, avatar } from './common.js';

export async function studentHome({ params }) {
  const st = await requireStudent(params.sid);
  const weeks = await listApprovedWeeks(st.id);
  const body = weeks.length
    ? h('ul', { class: 'week-list', role: 'list' }, weeks.map((snap, i) => h('li', null,
      h('a', { href: `#/s/${st.id}/w/${snap.weekId}`, class: 'week-link' },
        h('span', { class: 'week-name' }, weekLabel(snap)),
        h('span', { class: 'week-meta' }, `${snap.spelling.length} spelling · ${snap.vocab.length} vocabulary${i === 0 ? ' · newest' : ''}`)))))
    : emptyState('No lessons are ready yet. Ask a grown-up to add and approve this week\'s words.');
  return h('div', { class: themeClass(st) },
    page({ title: `Hi, ${st.displayName}!`, back: '#/', backLabel: 'Switch student', subtitle: weeks.length ? 'Pick a week to study.' : null, cls: 'student' },
      body, h('p', null, link('My results', `#/s/${st.id}/results`, 'btn btn-ghost'))));
}

export async function weekHome({ params }) {
  const st = await requireStudent(params.sid);
  const snap = await getApprovedLesson(params.wid);
  if (!snap || snap.studentId !== st.id) return page({ title: 'Lesson not available', back: `#/s/${st.id}`, backLabel: 'My weeks' }, emptyState('This lesson is not ready yet. Ask a grown-up to approve it.'));
  const attempts = await listAttempts({ studentId: st.id, weekId: snap.weekId });
  const base = `#/s/${st.id}/w/${snap.weekId}`;
  const best = (subject) => {
    const tests = attempts.filter((a) => a.subject === subject && a.mode === 'test');
    if (!tests.length) return null;
    const last = tests[0];
    return h('p', { class: 'last-score' }, `Last test: ${last.score}/${last.total}`);
  };
  const tile = (label, href, icon, desc) => h('a', { href, class: 'tile' }, h('span', { class: 'tile-icon', 'aria-hidden': 'true' }, icon), h('span', { class: 'tile-label' }, label), desc ? h('span', { class: 'tile-desc' }, desc) : null);
  const subject = (title, key, count, icon, parts) => h('section', { class: `subject subject-${key}`, 'aria-labelledby': `h-${key}` },
    h('h2', { id: `h-${key}` }, h('span', { 'aria-hidden': 'true' }, icon + ' '), title, h('span', { class: 'count' }, ` · ${count} words`)),
    count ? h('div', { class: 'tiles' }, parts) : h('p', { class: 'hint' }, 'No words this week.'),
    best(key));
  return h('div', { class: themeClass(st) },
    page({ title: weekLabel(snap), back: `#/s/${st.id}`, backLabel: 'My weeks', cls: 'student',
      actions: [avatar(st), h('span', { class: 'who' }, st.displayName)] },
    subject('Spelling', 'spelling', snap.spelling.length, '🔤', [
      tile('Study', `${base}/spell/study`, '📖', 'See and hear the words'),
      tile('Practice', `${base}/spell/practice`, '✏️', 'Type what you hear'),
      tile('Test', `${base}/spell/test`, '📝', 'Graded spelling test')]),
    subject('Vocabulary', 'vocab', snap.vocab.length, '💡', [
      tile('Study', `${base}/vocab/study`, '📖', 'Flashcards'),
      tile('Practice', `${base}/vocab/practice`, '🎯', 'Five kinds of questions'),
      tile('Test', `${base}/vocab/test`, '📝', 'Graded vocabulary test')]),
    h('div', { class: 'row' },
      link('My results', `#/s/${st.id}/results?week=${snap.weekId}`, 'btn btn-ghost'),
      link('Print study sheets', `#/print/${snap.weekId}`, 'btn btn-ghost'))));
}
