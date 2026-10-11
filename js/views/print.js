// Print-friendly sheets. Only approved lesson content is ever printed.
import { h, fill, page, btn, link, emptyState, pct, fmtDateTime } from '../ui.js';
import { getApprovedLesson, getStudent, listAttempts, listWeeks, imageUrl } from '../store.js';
import { weekLabel } from '../model.js';
import { groupItems } from '../spelling.js';
import { SUBJECT_LABEL } from './results.js';

function controls(extra = []) {
  return h('div', { class: 'print-controls no-print' },
    h('div', { class: 'row' }, btn('🖨️ Print', () => window.print(), 'btn-primary btn-big print-btn'), ...extra, btn('‹ Back', () => history.back(), 'btn-ghost')),
    h('p', { class: 'hint' }, 'Tip: in the print window choose "Save as PDF" to keep a copy. Pictures are off unless you turn them on, to save ink.'));
}

export async function printWeek({ params, query }) {
  const snap = await getApprovedLesson(params.wid);
  if (!snap) return page({ title: 'Nothing to print', back: '#/' }, emptyState('This week has not been approved yet, so there is nothing to print.'));
  const student = await getStudent(snap.studentId);
  const show = query.only || 'all';
  const readAloud = query.readaloud === '1';
  let withPictures = query.pictures === '1';
  let grouped = query.grouped === '1';
  const sheet = h('div', { class: 'sheet' });
  const head = (title) => h('header', { class: 'sheet-head' }, h('h1', null, title), h('p', null, `${student ? student.displayName + ' · ' : ''}${weekLabel(snap)}`));

  const spellingSheet = () => {
    if (!snap.spelling.length) return null;
    if (readAloud) {
      return h('section', { class: 'print-section' }, head('Spelling words — for the grown-up to read aloud'),
        h('p', { class: 'print-note' }, 'Read the number, the word, then the sentence, then the word again. The words are in the teacher\'s order, the same order the app uses when sound is not available.'),
        h('ol', { class: 'readaloud' }, snap.spelling.map((s) => h('li', null, h('strong', null, s.word), s.sentence ? ` — ${s.sentence}` : ''))));
    }
    const list = grouped
      ? groupItems(snap.spelling, 'spelling').map((g) => h('div', { class: 'print-group' }, h('h3', null, g.label), h('ul', { class: 'print-words' }, g.items.map((s) => h('li', null, s.word)))))
      : h('ol', { class: 'print-words print-words-cols' }, snap.spelling.map((s) => h('li', null, s.word)));
    return h('section', { class: 'print-section' }, head('Spelling words'),
      snap.focus ? h('p', { class: 'print-note' }, `Focus: ${snap.focus}`) : null,
      list,
      h('h2', null, 'Practice: write each word twice'),
      h('table', { class: 'practice-grid' }, h('tbody', null, snap.spelling.map((s, i) => h('tr', null, h('td', { class: 'pg-num' }, String(i + 1)), h('td', { class: 'pg-word' }, s.word), h('td', { class: 'pg-line' }), h('td', { class: 'pg-line' }))))));
  };

  const vocabSheet = async () => {
    if (!snap.vocab.length) return null;
    const rows = [];
    for (const v of snap.vocab) {
      const url = withPictures && v.image ? await imageUrl(v.image.ref) : null;
      rows.push(h('tr', null,
        h('td', { class: 'vg-word' }, h('strong', null, v.word), url ? h('img', { src: url, alt: v.image.alt || '', class: 'vg-pic' }) : null),
        h('td', null, v.definition, v.definitionKind === 'parent-edited' ? h('span', { class: 'print-tag' }, ' (parent-edited)') : null),
        h('td', { class: 'vg-sentence' }, v.sentence || '')));
    }
    return h('section', { class: 'print-section' }, head('Vocabulary study guide'),
      h('p', { class: 'print-note' }, 'Definitions are the teacher\'s wording unless marked parent-edited.'),
      h('table', { class: 'vocab-guide' }, h('thead', null, h('tr', null, h('th', null, 'Word'), h('th', null, 'Definition'), h('th', null, 'Example sentence'))), h('tbody', null, rows)));
  };

  const draw = async () => {
    const parts = [];
    if (show === 'all' || show === 'spelling') parts.push(spellingSheet());
    if ((show === 'all' || show === 'vocab') && !readAloud) parts.push(await vocabSheet());
    fill(sheet, parts.filter(Boolean).length ? parts : emptyState('Nothing to print for this week.'));
  };
  const pics = h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: withPictures, onchange: (e) => { withPictures = e.target.checked; draw(); } }), h('span', null, 'Include pictures'));
  const grp = h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: grouped, onchange: (e) => { grouped = e.target.checked; draw(); } }), h('span', null, 'Group spelling words by pattern'));
  await draw();
  return h('div', { class: 'print-page' }, controls([!readAloud && show !== 'spelling' ? pics : null, !readAloud && show !== 'vocab' ? grp : null].filter(Boolean)), sheet);
}

export async function printResults({ params, query }) {
  const st = await getStudent(params.sid);
  if (!st) return page({ title: 'Student not found', back: '#/' });
  let attempts = await listAttempts({ studentId: st.id });
  if (query.week) attempts = attempts.filter((a) => a.weekId === query.week);
  const weeks = new Map((await listWeeks(st.id)).map((w) => [w.id, w]));
  const missed = new Map();
  for (const a of attempts) for (const m of a.missed || []) missed.set(m.word, (missed.get(m.word) || 0) + 1);
  const missedList = [...missed.entries()].sort((x, y) => y[1] - x[1]);
  return h('div', { class: 'print-page' }, controls(),
    h('div', { class: 'sheet' },
      h('section', { class: 'print-section' },
        h('header', { class: 'sheet-head' }, h('h1', null, `Results — ${st.displayName}`), h('p', null, `Printed ${fmtDateTime(new Date().toISOString())}`)),
        attempts.length ? h('table', { class: 'results-print' },
          h('thead', null, h('tr', null, ['Date', 'Week', 'Activity', 'Mode', 'Score', 'Missed words', 'Version'].map((t) => h('th', null, t)))),
          h('tbody', null, attempts.map((a) => h('tr', null,
            h('td', null, fmtDateTime(a.submittedAt)), h('td', null, weeks.get(a.weekId) ? weekLabel(weeks.get(a.weekId)) : '—'),
            h('td', null, `${SUBJECT_LABEL[a.subject]}: ${a.activityLabel}`), h('td', null, a.mode === 'test' ? 'Test' : 'Practice'),
            h('td', null, `${a.score}/${a.total} (${pct(a.score, a.total)}%)`), h('td', null, [...new Set((a.missed || []).map((m) => m.word))].join(', ') || '—'), h('td', null, `v${a.snapshotVersion}`))))) : h('p', null, 'No results yet.')),
      missedList.length ? h('section', { class: 'print-section' },
        h('h2', null, 'Missed-word practice'),
        h('p', { class: 'print-note' }, 'Write each word three times. Say each letter as you write it.'),
        h('table', { class: 'practice-grid' }, h('tbody', null, missedList.map(([w, n]) => h('tr', null, h('td', { class: 'pg-word' }, w, n > 1 ? h('span', { class: 'print-tag' }, ` (missed ${n}×)`) : null), h('td', { class: 'pg-line' }), h('td', { class: 'pg-line' }), h('td', { class: 'pg-line' })))))) : null));
}
