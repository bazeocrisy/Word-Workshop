// Student-first home: a child picks their name, then one of four big cards — Vocabulary, Spelling, Reading Passage,
// Sentence Fix. Vocabulary and Spelling pages list the activities for the child's newest words, with "Add new words".
import { h, page, link, emptyState } from '../ui.js';
import * as store from '../store.js';
import { weekLabel } from '../model.js';
import { requireStudent, themeClass, avatar } from './common.js';

export const AREAS = {
  vocab: { name: 'Vocabulary', icon: '💡', cls: 'area-vocab', blurb: 'Learn what words mean' },
  spelling: { name: 'Spelling', icon: '🔤', cls: 'area-spelling', blurb: 'Listen and spell your words' },
  reading: { name: 'Reading Passage', icon: '📖', cls: 'area-reading', blurb: 'Read your passage' },
  sentencefix: { name: 'Sentence Fix', icon: '✏️', cls: 'area-sentencefix', blurb: 'Find and fix the mistakes' },
};

/** Approved lessons (newest first) that have words for this subject. */
async function lessonsFor(sid, subject) {
  const snaps = await store.listApprovedWeeks(sid);
  return snaps.filter((s) => (subject === 'vocab' ? s.vocab : s.spelling).length)
    .sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)));
}

export async function studentHub({ params }) {
  const st = await requireStudent(params.sid);
  const [vo, sp, passages, sfTests] = await Promise.all([lessonsFor(st.id, 'vocab'), lessonsFor(st.id, 'spelling'), store.listPassages(st.id), store.listSfTests(st.id)]);
  const note = {
    vocab: vo[0] ? `${vo[0].vocab.length} words to learn` : 'Add your words',
    spelling: sp[0] ? `${sp[0].spelling.length} words to practise` : 'Add your words',
    reading: passages.length ? `${passages.length} passage${passages.length === 1 ? '' : 's'}` : 'Add a passage',
    sentencefix: sfTests[0] ? `Last test: ${sfTests[0].correct}/${sfTests[0].total - (sfTests[0].review || 0)}` : 'Learn, practise and test',
  };
  const href = { vocab: `#/s/${st.id}/vocab`, spelling: `#/s/${st.id}/spelling`, reading: `#/s/${st.id}/reading`, sentencefix: `#/s/${st.id}/sentence-fix` };
  return h('div', { class: themeClass(st) },
    page({ title: `Hi, ${st.displayName}!`, back: '#/', backLabel: 'Change student', subtitle: 'What do you want to do today?', cls: 'kid kid-home' },
      h('ul', { class: 'area-grid', role: 'list' }, Object.entries(AREAS).map(([key, a]) => h('li', null,
        h('a', { href: href[key], class: `area-card ${a.cls}` },
          h('span', { class: 'area-icon', 'aria-hidden': 'true' }, a.icon),
          h('span', { class: 'area-name' }, a.name),
          h('span', { class: 'area-blurb' }, a.blurb),
          h('span', { class: 'area-note' }, note[key])))))));
}

const tile = (label, href, icon, desc, cls = '') => h('a', { href, class: `tile big-tile ${cls}`.trim() },
  h('span', { class: 'tile-icon', 'aria-hidden': 'true' }, icon), h('span', { class: 'tile-label' }, label), desc ? h('span', { class: 'tile-desc' }, desc) : null);

/** The child's newest test for this lesson and subject, for "Practice missed words". */
async function lastMissed(st, snap, subject) {
  const tests = (await store.listAttempts({ studentId: st.id, weekId: snap.weekId })).filter((a) => a.subject === subject && a.mode === 'test');
  const ids = [...new Set((tests[0]?.missed || []).map((m) => m.itemId))].filter((id) => (subject === 'vocab' ? snap.vocab : snap.spelling).some((x) => x.id === id));
  return ids;
}

function weekPicker(st, lessons, current, subject) {
  if (lessons.length < 2) return null;
  return h('details', { class: 'week-pick' }, h('summary', null, 'Other word lists'),
    h('ul', { class: 'week-list', role: 'list' }, lessons.filter((s) => s.weekId !== current.weekId).map((s) =>
      h('li', null, link(h('span', null, h('span', { class: 'week-name' }, weekLabel(s)), h('span', { class: 'week-meta' }, `${(subject === 'vocab' ? s.vocab : s.spelling).length} words`)),
        `#/s/${st.id}/${subject === 'vocab' ? 'vocab' : 'spelling'}?w=${s.weekId}`, 'week-link')))));
}

async function subjectHub({ params, query }, subject) {
  const st = await requireStudent(params.sid);
  const a = AREAS[subject];
  const lessons = await lessonsFor(st.id, subject);
  const snap = lessons.find((s) => s.weekId === query.w) || lessons[0];
  const add = link(h('span', null, h('span', { 'aria-hidden': 'true' }, '＋ '), 'Add new words'), `#/s/${st.id}/add/${subject}`, 'btn btn-primary btn-big add-words');
  const wrap = (...body) => h('div', { class: themeClass(st) }, page({ title: a.name, back: `#/s/${st.id}`, backLabel: 'Home', cls: `kid subject-hub ${a.cls}`,
    actions: [avatar(st), h('span', { class: 'who' }, st.displayName)] }, ...body));
  if (!snap) {
    return wrap(h('div', { class: 'card hub-empty' }, h('p', { class: 'hub-empty-icon', 'aria-hidden': 'true' }, a.icon),
      h('h2', null, 'No words yet'), h('p', null, subject === 'vocab' ? 'Take a photo of your vocabulary sheet, or type the words.' : 'Take a photo of your spelling list, or type the words.'), add));
  }
  const base = `#/s/${st.id}/w/${snap.weekId}`;
  const missed = await lastMissed(st, snap, subject);
  const words = subject === 'vocab' ? snap.vocab : snap.spelling;
  const tiles = subject === 'vocab' ? [
    tile('Study cards', `${base}/vocab/study`, '📖', 'Look, listen and learn'),
    tile('Choose the meaning', `${base}/vocab/practice?type=def-mc`, '🎯', 'Pick the right meaning'),
    // Fill in the blank needs example sentences (worksheets often have none): offer Choose the word instead.
    words.some((w) => w.sentence) ? tile('Fill in the blank', `${base}/vocab/practice?type=blank`, '✏️', 'Finish the sentence') : tile('Choose the word', `${base}/vocab/practice?type=word-mc`, '✏️', 'Read the meaning, pick the word'),
    tile('Matching', `${base}/vocab/practice?type=match`, '🧩', 'Match words and meanings'),
    tile('Crossword', `${base}/vocab/crossword`, '🔠', 'Solve the puzzle'),
    missed.length ? tile('Practice missed words', `${base}/vocab/practice?type=mixed&only=${missed.join(',')}`, '🔁', `${missed.length} word${missed.length === 1 ? '' : 's'} to practise`, 'tile-missed') : null,
    tile('Test', `${base}/vocab/test?type=mixed`, '📝', 'Show what you know', 'tile-test'),
  ] : [
    tile('Study cards', `${base}/spell/study`, '📖', 'See and hear each word'),
    tile('Listen and spell', `${base}/spell/practice`, '🎧', 'Type the word you hear'),
    tile('Build the word', `${base}/spell/build`, '🧱', 'Put the letters in order'),
    missed.length ? tile('Practice missed words', `${base}/spell/practice?only=${missed.join(',')}`, '🔁', `${missed.length} word${missed.length === 1 ? '' : 's'} to practise`, 'tile-missed') : null,
    tile('Spelling test', `${base}/spell/test`, '📝', 'Show what you know', 'tile-test'),
  ];
  return wrap(
    h('section', { class: 'card hub-words', 'aria-labelledby': 'hub-h' },
      h('h2', { id: 'hub-h' }, `${weekLabel(snap)} · ${words.length} words`),
      h('p', { class: 'hub-word-list' }, words.slice(0, 24).map((w) => h('span', { class: 'word-chip' }, w.word))),
      h('div', { class: 'row' }, add, link('My results', `#/s/${st.id}/results?week=${snap.weekId}`, 'btn btn-ghost'))),
    h('div', { class: 'tiles big-tiles' }, tiles),
    weekPicker(st, lessons, snap, subject));
}

export const vocabHub = (ctx) => subjectHub(ctx, 'vocab');
export const spellingHub = (ctx) => subjectHub(ctx, 'spelling');

/** Old "week" address: send the child to the subject pages for that week. */
export async function weekChooser({ params }) {
  const st = await requireStudent(params.sid);
  const w = await store.getApprovedLesson(params.wid);
  if (!w || w.studentId !== st.id) return page({ title: 'Lesson not available', back: `#/s/${st.id}`, backLabel: 'Home' }, emptyState('This lesson is not ready yet.'));
  return h('div', { class: themeClass(st) }, page({ title: weekLabel(w), back: `#/s/${st.id}`, backLabel: 'Home', cls: 'kid' },
    h('ul', { class: 'area-grid area-grid-2', role: 'list' },
      w.vocab.length ? h('li', null, h('a', { href: `#/s/${st.id}/vocab?w=${w.weekId}`, class: 'area-card area-vocab' }, h('span', { class: 'area-icon', 'aria-hidden': 'true' }, '💡'), h('span', { class: 'area-name' }, 'Vocabulary'), h('span', { class: 'area-note' }, `${w.vocab.length} words`))) : null,
      w.spelling.length ? h('li', null, h('a', { href: `#/s/${st.id}/spelling?w=${w.weekId}`, class: 'area-card area-spelling' }, h('span', { class: 'area-icon', 'aria-hidden': 'true' }, '🔤'), h('span', { class: 'area-name' }, 'Spelling'), h('span', { class: 'area-note' }, `${w.spelling.length} words`))) : null)));
}
