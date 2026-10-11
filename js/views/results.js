// Results: one attempt in detail, and history lists for a student (student view) or for the parent.
import { h, page, link, emptyState, pct, fmtDateTime, badge } from '../ui.js';
import { listAttempts, getAttempt, listWeeks, getStudent } from '../store.js';
import { weekLabel } from '../model.js';
import { requireStudent, themeClass } from './common.js';

export const SUBJECT_LABEL = { vocab: 'Vocabulary', spelling: 'Spelling' };

function encouragement(p) {
  if (p === 100) return 'Perfect score! 🎉';
  if (p >= 80) return 'Great work! 🌟';
  if (p >= 60) return 'Good effort! Practice the missed words to get even better.';
  return 'Keep going! Practicing the missed words will help.';
}

export function missedPracticeHref(a) {
  const ids = [...new Set((a.missed || []).map((m) => m.itemId))].join(',');
  const base = `#/s/${a.studentId}/w/${a.weekId}`;
  return a.subject === 'spelling' ? `${base}/spell/practice?only=${ids}` : `${base}/vocab/practice?type=mixed&only=${ids}`;
}

/** Full result of one attempt (shown right after submitting, and from the history). */
export function attemptDetail(a, { heading = true } = {}) {
  const p = pct(a.score, a.total);
  const rows = (a.questions || []).map((q, i) => h('li', { class: `answer ${q.isCorrect ? 'answer-right' : 'answer-wrong'}` },
    h('span', { class: 'answer-mark', 'aria-hidden': 'true' }, q.isCorrect ? '✓' : '✗'),
    h('div', null,
      h('p', { class: 'answer-q' }, h('span', { class: 'sr-only' }, q.isCorrect ? 'Correct. ' : 'Incorrect. '), `${i + 1}. `, q.promptShort || q.word),
      h('p', null, h('span', { class: 'muted' }, 'Your answer: '), q.given ? h('strong', null, q.given) : h('em', null, 'no answer')),
      q.isCorrect ? null : h('p', null, h('span', { class: 'muted' }, 'Correct answer: '), h('strong', null, q.correct)))));
  const missedWords = [...new Set((a.missed || []).map((m) => m.word))];
  return h('div', { class: 'attempt' },
    heading ? h('div', { class: `score-card ${p >= 80 ? 'score-good' : p >= 60 ? 'score-ok' : 'score-low'}` },
      h('p', { class: 'score-big' }, `${a.score} / ${a.total}`),
      h('p', { class: 'score-pct' }, `${p}%`),
      h('p', null, encouragement(p))) : null,
    h('p', { class: 'muted' }, `${SUBJECT_LABEL[a.subject] || a.subject} · ${a.activityLabel} · ${a.mode === 'test' ? 'Test' : 'Practice'} · ${fmtDateTime(a.submittedAt)} · lesson version ${a.snapshotVersion}`),
    missedWords.length ? h('div', { class: 'card notice notice-warn' },
      h('p', null, h('strong', null, `Missed words (${missedWords.length}): `), missedWords.join(', ')),
      h('div', { class: 'row' }, link('Practice missed words', missedPracticeHref(a), 'btn btn-primary'))) : h('p', { class: 'ok-text' }, 'No missed words.'),
    (a.skipped || []).length ? h('p', { class: 'hint' }, `Not asked (could not be made fair): ${a.skipped.map((s) => `${s.word} — ${s.reason}`).join('; ')}`) : null,
    h('h2', null, 'Every answer'),
    h('ol', { class: 'answers' }, rows));
}

function attemptsTable(attempts, weeksById, hrefFor) {
  if (!attempts.length) return emptyState('No results yet.');
  return h('div', { class: 'table-wrap' }, h('table', { class: 'results-table' },
    h('thead', null, h('tr', null, ['Date', 'Week', 'Activity', 'Mode', 'Score', 'Missed', 'Version'].map((t) => h('th', { scope: 'col' }, t)))),
    h('tbody', null, attempts.map((a) => h('tr', null,
      h('td', null, link(fmtDateTime(a.submittedAt), hrefFor(a))),
      h('td', null, weeksById.get(a.weekId) ? weekLabel(weeksById.get(a.weekId)) : '—'),
      h('td', null, `${SUBJECT_LABEL[a.subject]}: ${a.activityLabel}`),
      h('td', null, a.mode === 'test' ? badge('Test', 'info') : badge('Practice', 'grey')),
      h('td', null, `${a.score}/${a.total} (${pct(a.score, a.total)}%)`),
      h('td', null, [...new Set((a.missed || []).map((m) => m.word))].join(', ') || '—'),
      h('td', null, `v${a.snapshotVersion}`))))));
}

export async function studentResults({ params, query }) {
  const st = await requireStudent(params.sid);
  let attempts = await listAttempts({ studentId: st.id });
  if (query.week) attempts = attempts.filter((a) => a.weekId === query.week);
  const weeks = await listWeeks(st.id);
  const byId = new Map(weeks.map((w) => [w.id, w]));
  return h('div', { class: themeClass(st) }, page({ title: `${st.displayName}'s results`, back: query.week ? `#/s/${st.id}/w/${query.week}` : `#/s/${st.id}`, backLabel: query.week ? 'This week' : 'My weeks', cls: 'student' },
    attemptsTable(attempts, byId, (a) => `#/s/${st.id}/attempt/${a.id}`)));
}

export async function attemptView({ params }) {
  const st = await requireStudent(params.sid);
  const a = await getAttempt(params.aid);
  if (!a || a.studentId !== st.id) return page({ title: 'Result not found', back: `#/s/${st.id}/results` }, emptyState('That result was not found.'));
  return h('div', { class: themeClass(st) }, page({ title: 'Result', back: `#/s/${st.id}/results`, backLabel: 'My results', cls: 'student' }, attemptDetail(a)));
}

export async function parentResults({ params }) {
  const st = await getStudent(params.sid);
  if (!st) return page({ title: 'Student not found', back: '#/parent' });
  const attempts = await listAttempts({ studentId: st.id });
  const weeks = await listWeeks(st.id);
  const byId = new Map(weeks.map((w) => [w.id, w]));
  return page({ title: `Results: ${st.displayName}`, back: '#/parent', backLabel: 'Parent area', cls: 'parent',
    actions: [link('Print results', `#/print/results/${st.id}`, 'btn btn-ghost btn-small')] },
  h('p', { class: 'hint' }, 'Every practice and test is kept. Retaking a test adds a new result; it never replaces an old one.'),
  attemptsTable(attempts, byId, (a) => `#/s/${st.id}/attempt/${a.id}`));
}
