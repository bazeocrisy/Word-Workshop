// Vocabulary flashcards: picture, word, exact approved definition, example sentence, audio.
import { h, fill, page, btn, link, emptyState } from '../ui.js';
import { imageUrl } from '../store.js';
import { speakButton, speechSupported, RATES } from '../speech.js';
import { fallbackLabel } from '../illustrations.js';
import { loadLesson, themed } from './lesson.js';
import { setLeaveGuard } from '../router.js';

export async function vocabStudy({ params, query }) {
  const L = await loadLesson(params);
  if (L.error) return L.error;
  const { st, snap, base } = L;
  const items = snap.vocab;
  if (!items.length) return themed(st, page({ title: 'Vocabulary flashcards', back: base, backLabel: 'This week' }, emptyState('No vocabulary words this week.')));
  let i = Math.min(Math.max(0, Number(query.card || 1) - 1), items.length - 1);
  const cardSlot = h('div', { class: 'flashcard-slot' });
  const counter = h('p', { class: 'counter', 'aria-live': 'polite' });
  const prev = btn('‹ Back', () => show(i - 1), 'btn-ghost btn-big');
  const next = btn('Next ›', () => show(i + 1), 'btn-primary btn-big');

  async function card(it) {
    const url = it.image ? await imageUrl(it.image.ref) : null;
    const pic = url
      ? h('figure', { class: 'card-picture' }, h('img', { src: url, alt: it.image.alt || `Picture for ${it.word}` }),
        it.image.kind === 'sample' ? h('figcaption', null, 'Sample illustration') : null)
      : h('div', { class: 'card-picture card-picture-empty', role: 'img', 'aria-label': fallbackLabel() }, h('span', { 'aria-hidden': 'true' }, '🖼️'), h('span', null, fallbackLabel()));
    return h('article', { class: 'flashcard', 'aria-labelledby': `fc-${it.id}` },
      pic,
      h('h2', { id: `fc-${it.id}`, class: 'fc-word' }, it.word),
      h('div', { class: 'row fc-audio' },
        speakButton('Hear the word', () => it.word, { ariaLabel: `Hear the word ${it.word}` }),
        speakButton('Slowly', () => it.word, { rate: RATES.slow, ariaLabel: `Hear ${it.word} slowly` })),
      h('section', { class: 'fc-def' },
        h('h3', null, it.definitionKind === 'parent-edited' ? 'Definition (parent-edited)' : 'Teacher\'s definition'),
        h('p', { class: 'fc-def-text' }, it.definition)),
      it.sentence ? h('section', { class: 'fc-sentence' },
        h('h3', null, 'Example sentence'),
        h('p', null, it.sentence),
        speakButton('Hear the sentence', () => it.sentence, { ariaLabel: 'Hear the example sentence' })) : null);
  }

  async function show(n) {
    i = Math.min(Math.max(0, n), items.length - 1);
    fill(cardSlot, await card(items[i]));
    counter.textContent = `Card ${i + 1} of ${items.length}`;
    prev.disabled = i === 0;
    next.disabled = i === items.length - 1;
    history.replaceState(null, '', `${base}/vocab/study?card=${i + 1}`);
  }

  const onKey = (e) => {
    if (e.target.closest?.('input, textarea, select')) return;
    if (e.key === 'ArrowRight') show(i + 1);
    if (e.key === 'ArrowLeft') show(i - 1);
  };
  document.addEventListener('keydown', onKey);
  setLeaveGuard(() => { document.removeEventListener('keydown', onKey); return true; });

  await show(i);
  return themed(st, page({ title: 'Vocabulary flashcards', back: base, backLabel: 'This week', cls: 'student' },
    speechSupported() ? null : h('div', { class: 'card notice notice-warn' }, h('p', null, 'Sound is not available on this device, so words cannot be read aloud here.')),
    counter, cardSlot,
    h('div', { class: 'row fc-nav' }, prev, next),
    h('p', { class: 'hint' }, 'Tip: use the arrow keys to move between cards.'),
    h('div', { class: 'row' }, link('Practice these words', `${base}/vocab/practice`, 'btn btn-ghost'))));
}
