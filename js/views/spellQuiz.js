// Spelling practice and test. The word is heard, never shown, until the answer is checked (practice)
// or the test is submitted. Typed answers are graded exactly (docs/GRADING.md); nothing is auto-corrected.
import { h, fill, page, btn, link, progressBar, confirmDialog, toast, emptyState } from '../ui.js';
import { saveAttempt } from '../store.js';
import { newSeed, nowIso, rng, shuffle, isCorrectAnswer } from '../model.js';
import { blankSentence } from '../vocab.js';
import { speak, speakButton, speechSupported, stopSpeaking, RATES } from '../speech.js';
import { loadLesson, themed } from './lesson.js';
import { attemptDetail } from './results.js';
import { setLeaveGuard, go } from '../router.js';

export const spellPractice = (ctx) => spellSession(ctx, 'practice');
export const spellTest = (ctx) => spellSession(ctx, 'test');

const draftKey = (st, snap, mode, only) => `ww-quiz:${st.id}:${snap.weekId}:v${snap.version}:spelling:${mode}:${only || ''}`;
const readDraft = (k) => { try { return JSON.parse(sessionStorage.getItem(k) || 'null'); } catch { return null; } };
const writeDraft = (k, v) => { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* still works without */ } };
const dropDraft = (k) => { try { sessionStorage.removeItem(k); } catch { /* ignore */ } };

/** Order of words: teacher order when the parent chose it or when a grown-up must read the list aloud. */
export function spellingOrder(items, { seed, teacherOrder }) {
  return teacherOrder ? items.slice() : shuffle(items, rng(seed));
}

async function spellSession({ params, query }, mode) {
  const L = await loadLesson(params);
  if (L.error) return L.error;
  const { st, snap, base } = L;
  const title = mode === 'test' ? 'Spelling test' : 'Spelling practice';
  const only = query.only ? query.only.split(',').filter(Boolean) : null;
  const items = only ? snap.spelling.filter((s) => only.includes(s.id)) : snap.spelling;
  if (!items.length) return themed(st, page({ title, back: base, backLabel: 'This week' }, emptyState('No spelling words this week.')));
  const audio = speechSupported();
  const key = draftKey(st, snap, mode, query.only);
  const draft = readDraft(key);
  const seed = draft ? draft.seed : newSeed();
  const teacherOrder = !audio || (mode === 'test' && snap.settings?.spellingTestOrder === 'teacher');
  const words = spellingOrder(items, { seed, teacherOrder });
  const s = new SpellSession({ st, snap, base, mode, title, only, seed, words, key, draft, audio, teacherOrder });
  return themed(st, s.render());
}

class SpellSession {
  constructor(o) {
    Object.assign(this, o);
    this.answers = o.draft ? o.draft.answers : {};
    this.firstTry = o.draft?.firstTry || {};
    this.done = o.draft?.done || {};
    this.idx = o.draft ? Math.min(o.draft.idx || 0, o.words.length - 1) : 0;
    this.startedAt = o.draft ? o.draft.startedAt : nowIso();
    this.started = !!o.draft;
    this.finished = false;
  }

  persist() { writeDraft(this.key, { seed: this.seed, answers: this.answers, firstTry: this.firstTry, done: this.done, idx: this.idx, startedAt: this.startedAt }); }

  render() {
    this.body = h('div', { class: 'quiz spell-quiz' });
    this.live = h('div', { class: 'sr-only', 'aria-live': 'assertive', role: 'status' });
    this.root = page({ title: this.title, back: this.base, backLabel: 'This week', cls: 'student',
      subtitle: this.only ? `Missed words · ${this.words.length} word${this.words.length === 1 ? '' : 's'}` : (this.mode === 'test' ? `${this.words.length} words · ${this.teacherOrder ? 'teacher\'s order' : 'mixed-up order'}` : `${this.words.length} words`) }, this.live, this.body);
    if (this.mode === 'test') setLeaveGuard(async () => { const ok = this.finished || await confirmDialog('Leave the test?', 'Your answers so far are kept on this device, so you can come back and finish it.', 'Leave'); if (ok) stopSpeaking(); return ok; });
    else setLeaveGuard(() => { stopSpeaking(); return true; });
    this.persist();
    if (this.started) { if (this.draft) setTimeout(() => toast('Welcome back! Your answers were kept.'), 50); this.show(false); } else this.intro();
    return this.root;
  }

  intro() {
    const notice = this.audio
      ? h('p', null, this.mode === 'test' ? 'Listen to each word, then type it. You can hear it again as many times as you like. Your score appears after you submit.' : 'Listen to each word, type it, then press Check.')
      : h('div', { class: 'card notice notice-warn' },
        h('p', null, h('strong', null, 'Sound is not available on this device.')),
        h('p', null, 'Ask a grown-up to read each word and its sentence aloud. The words go in the teacher\'s order, so the grown-up can read from the printed list.'),
        link('Open the grown-up\'s word list', `#/print/${this.snap.weekId}?only=spelling&readaloud=1`, 'btn btn-ghost btn-small'));
    fill(this.body, h('div', { class: 'card' }, notice,
      h('div', { class: 'row' }, btn(this.mode === 'test' ? 'Start the test' : 'Start practice', () => { this.started = true; this.show(true); }, 'btn-primary btn-big start-btn'))));
  }

  sayWord(rate = RATES.normal) { if (this.audio) speak(this.words[this.idx].word, { rate }); }

  header() {
    const n = this.words.length;
    const count = this.mode === 'test' ? Object.values(this.answers).filter((a) => String(a || '').trim()).length : Object.keys(this.done).length;
    return h('div', { class: 'quiz-head' }, h('p', { class: 'counter' }, `Word ${this.idx + 1} of ${n}`), progressBar(count, n, `${this.mode === 'test' ? 'Answered' : 'Finished'} ${count} of ${n}`));
  }

  show(autoplay) {
    const w = this.words[this.idx];
    const lock = this.mode === 'practice' && this.done[this.idx];
    const shown = w.sentence ? blankSentence(w.sentence, w.word) : null;
    const input = h('input', { type: 'text', class: 'answer-input spell-input', id: 'spell-answer', autocomplete: 'off', autocapitalize: 'none', autocorrect: 'off', spellcheck: 'false', inputmode: 'text', value: this.answers[this.idx] ?? '', disabled: lock, 'aria-describedby': shown ? 'spell-sentence spell-help' : 'spell-help' });
    input.addEventListener('input', () => { this.answers[this.idx] = input.value; this.persist(); if (this.mode === 'test') this.body.querySelector('.quiz-head')?.replaceWith(this.header()); });
    this.feedback = h('div', { class: 'feedback', 'aria-live': 'polite' });
    const audioRow = this.audio
      ? h('div', { class: 'row listen' },
        speakButton('Hear the word', () => w.word, { cls: 'btn-primary', ariaLabel: 'Hear the word' }),
        speakButton('Slowly', () => w.word, { rate: RATES.slow, ariaLabel: 'Hear the word slowly' }),
        w.sentence ? speakButton('Hear it in a sentence', () => w.sentence, { ariaLabel: 'Hear the word in a sentence' }) : null)
      : h('p', { class: 'notice-inline' }, `Grown-up: read word number ${this.idx + 1} and its sentence.`);
    const form = h('form', { class: 'question card', onsubmit: (e) => { e.preventDefault(); this.mode === 'practice' ? this.check() : this.next(1, true); } },
      audioRow,
      shown ? h('p', { class: 'q-sentence', id: 'spell-sentence' }, shown) : h('p', { class: 'hint' }, 'No sentence for this word.'),
      h('label', { for: 'spell-answer', class: 'label' }, 'Type the word'),
      input, h('p', { class: 'hint', id: 'spell-help' }, 'Spelling counts. Capital letters do not.'),
      this.feedback, this.controls());
    fill(this.body, this.header(), form);
    if (this.mode === 'practice' && this.done[this.idx]) this.showFeedback(true);
    if (!lock) input.focus({ preventScroll: true }); else form.querySelector('.quiz-controls .btn')?.focus({ preventScroll: true });
    if (autoplay) this.sayWord();
  }

  controls() {
    const last = this.idx === this.words.length - 1;
    if (this.mode === 'practice') {
      const done = this.done[this.idx];
      return h('div', { class: 'row quiz-controls' },
        done ? null : h('button', { type: 'submit', class: 'btn btn-primary btn-big' }, 'Check'),
        done ? (last ? btn('Finish', () => this.finish(), 'btn-primary btn-big') : btn('Next word ›', () => this.next(1, true), 'btn-primary btn-big')) : null);
    }
    return h('div', { class: 'row quiz-controls' },
      this.idx > 0 ? btn('‹ Previous', () => this.next(-1, false), 'btn-ghost btn-big') : null,
      last ? btn('Review and submit', () => this.review(), 'btn-primary btn-big') : h('button', { type: 'submit', class: 'btn btn-primary btn-big' }, 'Next word ›'));
  }

  next(d, autoplay) {
    if (d > 0 && this.mode === 'test' && this.idx === this.words.length - 1) { this.review(); return; }
    this.idx = Math.min(Math.max(0, this.idx + d), this.words.length - 1);
    this.persist(); this.show(autoplay);
  }

  check() {
    const w = this.words[this.idx];
    const given = String(this.answers[this.idx] ?? '');
    if (!given.trim()) { fill(this.feedback, h('p', { class: 'warn-text' }, 'Type the word first.')); return; }
    const ok = isCorrectAnswer(given, w.word);
    if (this.firstTry[this.idx] == null) this.firstTry[this.idx] = { given, ok };
    if (ok) { this.done[this.idx] = true; this.persist(); this.show(false); return; }
    this.persist();
    this.live.textContent = 'Not quite. Listen again and try once more.';
    fill(this.feedback, h('div', { class: 'fb fb-wrong' },
      h('p', { class: 'fb-title' }, '✗ Not quite. Listen again and try once more.'),
      h('div', { class: 'row' },
        btn('Try again', () => { fill(this.feedback); const i = this.body.querySelector('.spell-input'); i.select(); i.focus(); this.sayWord(); }, 'btn-ghost'),
        btn('Show the word', () => { this.done[this.idx] = true; this.persist(); this.show(false); }, 'btn-ghost'))));
  }

  showFeedback() {
    const w = this.words[this.idx];
    const given = String(this.answers[this.idx] ?? '');
    const ok = isCorrectAnswer(given, w.word);
    this.live.textContent = ok ? `Correct! ${w.word}` : `The word is ${w.word}. You typed ${given || 'nothing'}.`;
    fill(this.feedback, ok
      ? h('div', { class: 'fb fb-right' }, h('p', { class: 'fb-title' }, '✓ Correct! ', h('span', { class: 'spell-reveal' }, w.word)),
        w.groups?.spelling?.reason && w.groups.spelling.key !== 'other' ? h('p', { class: 'muted' }, w.groups.spelling.reason) : null)
      : h('div', { class: 'fb fb-shown' }, h('p', { class: 'fb-title' }, 'The word is: ', h('span', { class: 'spell-reveal' }, w.word)),
        h('p', null, 'You typed: ', h('strong', null, given || '—')),
        w.groups?.spelling?.reason && w.groups.spelling.key !== 'other' ? h('p', { class: 'muted' }, w.groups.spelling.reason) : null));
  }

  async review() {
    const blanks = this.words.map((w, i) => i).filter((i) => !String(this.answers[i] ?? '').trim());
    stopSpeaking();
    fill(this.body, h('div', { class: 'card' },
      h('h2', { tabindex: '-1' }, 'Ready to submit?'),
      h('p', null, `You typed ${this.words.length - blanks.length} of ${this.words.length} words.`),
      blanks.length ? h('div', null, h('p', { class: 'warn-text' }, 'Not typed yet:'),
        h('div', { class: 'row' }, blanks.map((i) => btn(`Word ${i + 1}`, () => { this.idx = i; this.show(true); }, 'btn-ghost btn-small')))) : null,
      h('div', { class: 'row' },
        btn('‹ Go back', () => this.show(false), 'btn-ghost btn-big'),
        btn('Submit test', async () => {
          if (blanks.length && !(await confirmDialog('Submit with blanks?', `${blanks.length} word${blanks.length === 1 ? ' is' : 's are'} not typed. Blank answers are marked wrong.`, 'Submit anyway'))) return;
          this.finish();
        }, 'btn-primary btn-big submit-test'))));
    this.body.querySelector('h2').focus();
  }

  async finish() {
    stopSpeaking();
    let score = 0;
    const rows = this.words.map((w, i) => {
      const r = this.mode === 'practice' ? (this.firstTry[i] || { given: '', ok: false }) : { given: String(this.answers[i] ?? ''), ok: isCorrectAnswer(this.answers[i], w.word) };
      if (r.ok) score++;
      return { itemId: w.id, word: w.word, type: 'spell', promptShort: `Word ${i + 1}`, given: r.given.trim(), correct: w.word, isCorrect: r.ok };
    });
    const attempt = {
      studentId: this.st.id, weekId: this.snap.weekId, snapshotVersion: this.snap.version, subject: 'spelling',
      activity: 'spelling', activityLabel: 'Spelling' + (this.only ? ' (missed words)' : ''), mode: this.mode,
      order: this.teacherOrder ? 'teacher' : 'random', audio: this.audio,
      seed: this.seed, startedAt: this.startedAt, submittedAt: nowIso(), score, total: this.words.length,
      questions: rows, missed: rows.filter((r) => !r.isCorrect).map((r) => ({ itemId: r.itemId, word: r.word })), skipped: [],
    };
    let saved;
    try { saved = await saveAttempt(attempt); } catch (e) { toast('Your result could not be saved: ' + e.message, 'error'); return; }
    this.finished = true;
    dropDraft(this.key);
    fill(this.body, h('h2', { tabindex: '-1', class: 'result-title' }, this.mode === 'test' ? 'Spelling test results' : 'Practice complete'),
      attemptDetail(saved),
      h('div', { class: 'row' }, link('Back to this week', this.base, 'btn btn-ghost'), btn(this.mode === 'test' ? 'Take the test again' : 'Practice again', () => go(`${this.base}/spell/${this.mode}`), 'btn-ghost')));
    this.body.querySelector('.result-title').focus();
  }
}
