// Spelling study: the teacher's list in order, with sentences and audio, plus two separate groupings —
// by spelling change (how the letters change) and by ending sound (how -ed is said). They are never mixed.
import { h, fill, page, btn, link, emptyState } from '../ui.js';
import { speakButton, speechSupported, RATES } from '../speech.js';
import { groupItems } from '../spelling.js';
import { loadLesson, themed } from './lesson.js';

export async function spellStudy({ params, query }) {
  const L = await loadLesson(params);
  if (L.error) return L.error;
  const { st, snap, base } = L;
  const items = snap.spelling;
  if (!items.length) return themed(st, page({ title: 'Spelling words', back: base, backLabel: 'This week' }, emptyState('No spelling words this week.')));
  const hasSound = items.some((i) => i.groups && i.groups.sound);
  const views = [['list', 'Teacher\'s order'], ['spelling', 'Spelling patterns'], ...(hasSound ? [['sound', 'Ending sounds']] : [])];
  let view = views.some(([k]) => k === query.view) ? query.view : 'list';
  const slot = h('div');
  const tabs = h('div', { class: 'seg', role: 'group', 'aria-label': 'How to show the words' });

  const wordRow = (it, n) => h('li', { class: 'spell-row' },
    n != null ? h('span', { class: 'item-num', 'aria-hidden': 'true' }, String(n)) : null,
    h('div', { class: 'spell-main' },
      h('p', { class: 'spell-word' }, it.word),
      it.sentence ? h('p', { class: 'spell-sentence' }, it.sentence) : null,
      h('div', { class: 'row spell-audio' },
        speakButton('Word', () => it.word, { ariaLabel: `Hear ${it.word}`, cls: 'btn-ghost btn-small' }),
        speakButton('Slowly', () => it.word, { rate: RATES.slow, ariaLabel: `Hear ${it.word} slowly`, cls: 'btn-ghost btn-small' }),
        it.sentence ? speakButton('Sentence', () => it.sentence, { ariaLabel: `Hear the sentence for ${it.word}`, cls: 'btn-ghost btn-small' }) : null)));

  function draw() {
    fill(tabs, views.map(([k, label]) => btn(label, () => { view = k; history.replaceState(null, '', `${base}/spell/study?view=${k}`); draw(); }, `btn-small ${view === k ? 'btn-primary' : 'btn-ghost'}`, { 'aria-pressed': String(view === k) })));
    if (view === 'list') { fill(slot, h('ol', { class: 'spell-list', role: 'list' }, items.map((it, i) => wordRow(it, i + 1)))); return; }
    const groups = groupItems(items, view);
    fill(slot,
      h('p', { class: 'hint' }, view === 'spelling' ? 'Grouped by how the letters change when -ed is added.' : 'Grouped by how the -ed ending sounds when you say the word.'),
      groups.map((g) => h('section', { class: 'card spell-group', 'aria-labelledby': `g-${view}-${g.key}` },
        h('h2', { id: `g-${view}-${g.key}` }, g.label, h('span', { class: 'count' }, ` · ${g.items.length}`)),
        g.explain ? h('p', { class: 'hint' }, g.explain) : null,
        h('ul', { class: 'spell-list', role: 'list' }, g.items.map((it) => {
          const reason = it.groups && it.groups[view] && it.groups[view].reason;
          const row = wordRow(it, null);
          if (reason && reason !== g.explain) row.querySelector('.spell-main').insertBefore(h('p', { class: 'spell-reason' }, reason), row.querySelector('.spell-audio'));
          return row;
        })))));
  }
  draw();
  return themed(st, page({ title: 'Spelling words', back: base, backLabel: 'This week', cls: 'student', subtitle: snap.focus ? `This week: ${snap.focus}` : null },
    speechSupported() ? null : h('div', { class: 'card notice notice-warn' }, h('p', null, 'Sound is not available on this device, so the words cannot be read aloud here. A grown-up can read them to you.')),
    tabs, slot,
    h('div', { class: 'row' }, link('Practice spelling', `${base}/spell/practice`, 'btn btn-primary'), link('Print the list', `#/print/${snap.weekId}?only=spelling`, 'btn btn-ghost'))));
}
