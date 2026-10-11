// Spelling "Build the word": the child hears a word and puts letter tiles in order. The word is not shown (or named
// in any accessible label) until it is built correctly. Typing a letter picks a matching tile; Backspace takes one back.
import { h, fill, page, btn, link, emptyState, progressBar } from '../ui.js';
import { loadLesson } from './lesson.js';
import { themeClass, avatar } from './common.js';
import { speakButton, speak, RATES } from '../speech.js';
import { makeTiles, chunks, checkBuild, wordLetters } from '../wordbuild.js';
import { shuffle, rng } from '../model.js';

export async function wordBuildView({ params }) {
  const { st, snap, error } = await loadLesson(params);
  if (error) return error;
  const back = `#/s/${st.id}/spelling?w=${snap.weekId}`;
  const shell = (...body) => h('div', { class: themeClass(st) }, page({ title: 'Build the word', back, backLabel: 'Spelling', cls: 'kid area-spelling build-page', actions: [avatar(st), h('span', { class: 'who' }, st.displayName)] }, ...body));
  const words = snap.spelling.filter((s) => wordLetters(s.word).length >= 2);
  if (!words.length) return shell(emptyState('There are no spelling words to build yet.'));
  const seed = Date.now() % 100000;
  const order = shuffle(words, rng(seed));
  let i = 0, firstTry = 0;
  const box = h('div', { class: 'build' });

  const drawWord = () => {
    if (i >= order.length) {
      fill(box, h('section', { class: 'card sf-summary' }, h('p', { class: 'sf-intro-icon', 'aria-hidden': 'true' }, '🧱'),
        h('h2', null, `You built ${order.length} words! ${firstTry} on the first try.`),
        h('div', { class: 'row' }, btn('Build them again', () => { i = 0; firstTry = 0; drawWord(); }, 'btn-primary btn-big'), link('Back to Spelling', back, 'btn btn-ghost btn-big'))));
      return;
    }
    const it = order[i];
    const letters = wordLetters(it.word);
    const tiles = makeTiles(letters.join(''), { seed: seed + i, extra: letters.length > 4 ? 2 : 1 });
    const placed = []; // tile ids in order
    let tries = 0, solved = false, showParts = false;
    const slots = h('div', { class: 'build-slots', 'aria-label': `${letters.length} letter spaces` });
    const tray = h('div', { class: 'build-tray', role: 'group', 'aria-label': 'Letter tiles' });
    const msg = h('div', { class: 'build-msg', 'aria-live': 'polite' });
    const parts = chunks(letters.join('')).map((c) => c.length);
    const draw = (wrongAt = -1) => {
      let n = 0; const ends = new Set(); parts.reduce((a, len) => { ends.add(a + len - 1); return a + len; }, 0);
      fill(slots, letters.map((_, k) => {
        const t = tiles.find((x) => x.id === placed[k]);
        return h('button', { type: 'button', class: `build-slot ${t ? 'is-full' : ''} ${k === wrongAt ? 'is-wrong' : ''} ${solved ? 'is-right' : ''} ${showParts && ends.has(k) && k < letters.length - 1 ? 'part-end' : ''}`,
          'aria-label': t ? `Space ${k + 1}: ${t.letter}. Tap to take it back.` : `Space ${k + 1}: empty`, disabled: solved || !t, onclick: () => { placed.splice(k, 1); draw(); } }, t ? t.letter : '');
      }));
      fill(tray, tiles.map((t) => h('button', { type: 'button', class: 'build-tile', disabled: solved || placed.includes(t.id), 'aria-label': `Letter ${t.letter}`,
        onclick: () => { if (placed.length < letters.length) { placed.push(t.id); draw(); if (placed.length === letters.length) check(); } } }, t.letter)));
      void n;
    };
    const check = () => {
      const r = checkBuild(letters.join(''), placed.map((id) => tiles.find((x) => x.id === id).letter));
      tries++;
      if (r.done) {
        solved = true; if (tries === 1) firstTry++;
        draw();
        fill(msg, h('div', { class: 'sf-good' }, h('p', { class: 'sf-big' }, `🎉 ${it.word}`), btn(i === order.length - 1 ? 'Finish ›' : 'Next word ›', () => { i++; drawWord(); box.querySelector('.build-hear button')?.focus(); }, 'btn-primary btn-big build-next')));
        speak(it.word).catch(() => {});
      } else {
        draw(r.nextIndexWrong);
        fill(msg, h('p', { class: 'sf-try' }, 'Not quite. The red space needs a different letter. Tap it to take it back, then try again.'));
      }
    };
    const keys = (e) => {
      if (solved || !box.isConnected) return;
      if (e.key === 'Backspace') { if (placed.length) { placed.pop(); draw(); } e.preventDefault(); return; }
      if (/^[a-z]$/i.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const t = tiles.find((x) => !placed.includes(x.id) && x.letter.toLowerCase() === e.key.toLowerCase());
        if (t && placed.length < letters.length) { placed.push(t.id); draw(); if (placed.length === letters.length) check(); }
      }
    };
    document.removeEventListener('keydown', box._keys || (() => {}));
    box._keys = keys; document.addEventListener('keydown', keys);
    fill(box,
      h('div', { class: 'sf-counter' }, h('p', null, `Word ${i + 1} of ${order.length}`), progressBar(i, order.length, `Word ${i + 1} of ${order.length}`)),
      h('section', { class: 'card build-card' },
        h('h2', null, 'Listen, then build the word.'),
        h('div', { class: 'row build-hear' },
          speakButton('🔊 Hear the word', () => it.word, { ariaLabel: 'Hear the word', cls: 'btn-primary btn-big' }),
          speakButton('🐢 Slowly', () => it.word, { rate: RATES.slow, ariaLabel: 'Hear the word slowly', cls: 'btn-ghost' }),
          it.sentence ? speakButton('Sentence', () => it.sentence, { ariaLabel: 'Hear the word in a sentence', cls: 'btn-ghost' }) : null),
        slots, tray, msg,
        h('div', { class: 'row' },
          btn('↺ Start over', () => { if (!solved) { placed.length = 0; draw(); fill(msg, ''); } }, 'btn-ghost build-clear'),
          btn('💡 Show the parts', () => { showParts = true; draw(); }, 'btn-ghost build-parts'))));
    draw();
  };
  drawWord();
  return shell(box);
}
