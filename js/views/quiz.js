// Vocabulary practice (immediate feedback, retry) and tests (no feedback until submitted).
import { h, fill, page, btn, link, progressBar, confirmDialog, toast, emptyState } from '../ui.js';
import { saveAttempt } from '../store.js';
import { newSeed, nowIso } from '../model.js';
import { buildActivity, grade, possiblePoints, VOCAB_ACTIVITIES } from '../vocab.js';
import { speakButton } from '../speech.js';
import { loadLesson, themed } from './lesson.js';
import { attemptDetail } from './results.js';
import { setLeaveGuard, go } from '../router.js';

export const vocabPractice = (ctx) => vocabSession(ctx, 'practice');
export const vocabTest = (ctx) => vocabSession(ctx, 'test');

const draftKey = (st, snap, mode, activity, only) => `ww-quiz:${st.id}:${snap.weekId}:v${snap.version}:vocab:${mode}:${activity}:${only || ''}`;
const readDraft = (k) => { try { return JSON.parse(sessionStorage.getItem(k) || 'null'); } catch { return null; } };
const writeDraft = (k, v) => { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full / blocked: the session still works */ } };
const dropDraft = (k) => { try { sessionStorage.removeItem(k); } catch { /* ignore */ } };

async function vocabSession({ params, query }, mode) {
  const L = await loadLesson(params);
  if (L.error) return L.error;
  const { st, snap, base } = L;
  const title = mode === 'test' ? 'Vocabulary test' : 'Vocabulary practice';
  if (!snap.vocab.length) return themed(st, page({ title, back: base, backLabel: 'This week' }, emptyState('No vocabulary words this week.')));
  const activity = query.type;
  if (!activity || !VOCAB_ACTIVITIES[activity]) return themed(st, picker(st, snap, base, mode, title));
  const only = query.only ? query.only.split(',').filter(Boolean) : null;
  const key = draftKey(st, snap, mode, activity, query.only);
  const draft = readDraft(key);
  const seed = draft ? draft.seed : newSeed();
  const { questions, skipped } = buildActivity(activity, snap.vocab, { seed, only });
  if (!questions.length) {
    return themed(st, page({ title, back: `${base}/vocab/${mode}`, backLabel: 'Choose an activity' },
      emptyState(`This activity is not available for these words. ${skipped.map((s) => s.reason)[0] || ''}`)));
  }
  const s = new Session({ st, snap, base, mode, activity, only, seed, questions, skipped, key, draft, title });
  return themed(st, s.render());
}

function picker(st, snap, base, mode, title) {
  const acts = Object.entries(VOCAB_ACTIVITIES);
  return page({ title, back: base, backLabel: 'This week', cls: 'student',
    subtitle: mode === 'test' ? 'Tests are graded. You will see your answers after you finish.' : 'Practice shows you right away if you are correct.' },
  h('div', { class: 'tiles' }, acts.map(([k, a]) => h('a', { href: `${base}/vocab/${mode}?type=${k}`, class: 'tile' },
    h('span', { class: 'tile-label' }, a.label), h('span', { class: 'tile-desc' }, a.desc)))));
}

class Session {
  constructor(o) {
    Object.assign(this, o);
    this.responses = o.draft ? o.draft.responses : {};
    this.idx = o.draft ? Math.min(o.draft.idx || 0, o.questions.length - 1) : 0;
    this.startedAt = o.draft ? o.draft.startedAt : nowIso();
    this.firstTry = o.draft?.firstTry || {};   // practice: first result per question
    this.done = o.draft?.done || {};           // practice: question finished (correct or answer shown)
    this.total = possiblePoints(o.questions);
    this.finished = false;
  }

  persist() { writeDraft(this.key, { seed: this.seed, responses: this.responses, idx: this.idx, startedAt: this.startedAt, firstTry: this.firstTry, done: this.done }); }

  render() {
    this.body = h('div', { class: 'quiz' });
    this.live = h('div', { class: 'sr-only', 'aria-live': 'assertive', role: 'status' });
    this.root = page({ title: this.title, back: this.base, backLabel: 'This week', cls: 'student',
      subtitle: `${VOCAB_ACTIVITIES[this.activity].label}${this.only ? ' · missed words' : ''}` }, this.live, this.body);
    if (this.mode === 'test') {
      setLeaveGuard(async () => this.finished || confirmDialog('Leave the test?', 'Your answers so far are kept on this device, so you can come back and finish it.', 'Leave'));
    }
    this.persist();
    if (this.draft) setTimeout(() => toast(this.mode === 'test' ? 'Welcome back! Your test answers were kept.' : 'Continuing where you left off.'), 50);
    this.show();
    return this.root;
  }

  header() {
    const n = this.questions.length;
    return h('div', { class: 'quiz-head' },
      h('p', { class: 'counter' }, `Question ${this.idx + 1} of ${n}`),
      progressBar(this.mode === 'test' ? Object.keys(this.responses).length : Object.keys(this.done).length, n, `${this.mode === 'test' ? 'Answered' : 'Finished'} ${this.mode === 'test' ? Object.keys(this.responses).length : Object.keys(this.done).length} of ${n}`));
  }

  show() {
    const q = this.questions[this.idx];
    const qid = `q${this.idx}`;
    const form = h('form', { class: 'question card', onsubmit: (e) => { e.preventDefault(); this.mode === 'practice' ? this.check() : this.next(1); } });
    form.append(...this.promptEls(q, qid), this.answerEl(q, qid));
    this.feedback = h('div', { class: 'feedback', 'aria-live': 'polite' });
    form.append(this.feedback);
    form.append(this.controls(q));
    fill(this.body, this.header(), form);
    if (this.mode === 'practice' && this.done[this.idx]) this.showFeedback(grade(q, this.responses[this.idx]), true);
    // Focus the instruction (screen readers then read the question); after a finished practice question, focus Next.
    const doneQ = this.mode === 'practice' && this.done[this.idx];
    (doneQ ? form.querySelector('.quiz-controls .btn') : form.querySelector('.q-instruction'))?.focus({ preventScroll: true });
  }

  promptEls(q, qid) {
    if (q.type === 'def-mc') return [h('p', { class: 'q-instruction', id: qid, tabindex: '-1', 'data-autofocus': '' }, 'What does this word mean?'), h('p', { class: 'q-word', id: `${qid}-p` }, q.prompt),
      speakButton('Hear the word', () => q.prompt, { ariaLabel: 'Hear the word' })];
    if (q.type === 'word-mc' || q.type === 'write') return [h('p', { class: 'q-instruction', id: qid, tabindex: '-1' }, q.type === 'write' ? 'Type the word that means:' : 'Which word means:'),
      h('blockquote', { class: 'q-def', id: `${qid}-p` }, q.prompt, q.definitionKind === 'parent-edited' ? h('span', { class: 'badge badge-grey' }, 'parent-edited') : null),
      speakButton('Hear the definition', () => q.prompt, { ariaLabel: 'Hear the definition' })];
    if (q.type === 'blank') return [h('p', { class: 'q-instruction', id: qid, tabindex: '-1' }, 'Which word fits in the blank?'), h('p', { class: 'q-sentence', id: `${qid}-p` }, q.prompt),
      speakButton('Hear the sentence', () => q.prompt.replace(/_+/g, 'blank'), { ariaLabel: 'Hear the sentence' })];
    if (q.type === 'match') return [h('p', { class: 'q-instruction', id: qid, tabindex: '-1' }, q.rounds > 1 ? `Match each word to its meaning (set ${q.round} of ${q.rounds}).` : 'Match each word to its meaning.')];
    return [];
  }

  answerEl(q, qid) {
    const saved = this.responses[this.idx];
    const lock = this.mode === 'practice' && this.done[this.idx];
    const store = (v) => { this.responses[this.idx] = v; this.persist(); if (this.mode === 'test') this.refreshProgress(); };
    if (q.type === 'write') {
      const input = h('input', { type: 'text', class: 'answer-input', autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false', 'aria-labelledby': `${qid} ${qid}-p`, value: saved ?? '', disabled: lock });
      input.addEventListener('input', () => store(input.value));
      return h('div', { class: 'field' }, input);
    }
    if (q.type === 'match') {
      const cur = saved || {};
      return h('div', { class: 'match' }, q.pairs.map((p, i) => {
        const id = `${qid}-m${i}`;
        const sel = h('select', { id, disabled: lock }, h('option', { value: '' }, 'Choose a meaning…'), q.options.map((o) => h('option', { value: o.key, selected: cur[p.itemId] === o.key }, o.text)));
        sel.addEventListener('change', () => { const next = { ...(this.responses[this.idx] || {}) }; if (sel.value) next[p.itemId] = sel.value; else delete next[p.itemId]; store(next); });
        return h('div', { class: 'match-row' }, h('label', { for: id, class: 'match-word' }, p.word), sel);
      }));
    }
    // multiple choice
    return h('fieldset', { class: 'choices', 'aria-labelledby': `${qid} ${qid}-p` }, q.options.map((o) => {
      const input = h('input', { type: 'radio', name: qid, value: o.key, checked: saved === o.key, disabled: lock });
      input.addEventListener('change', () => store(o.key));
      return h('label', { class: 'choice' }, input, h('span', { class: 'choice-key', 'aria-hidden': 'true' }, o.key), h('span', { class: 'choice-text' }, o.text));
    }));
  }

  refreshProgress() {
    const head = this.body.querySelector('.quiz-head');
    if (head) head.replaceWith(this.header());
  }

  answered(q) {
    const r = this.responses[this.idx];
    if (q.type === 'match') return r && Object.keys(r).length > 0;
    return r != null && String(r).trim() !== '';
  }

  controls(q) {
    const last = this.idx === this.questions.length - 1;
    if (this.mode === 'practice') {
      const done = this.done[this.idx];
      return h('div', { class: 'row quiz-controls' },
        done ? null : h('button', { type: 'submit', class: 'btn btn-primary btn-big' }, 'Check'),
        done ? (last ? btn('Finish', () => this.finish(), 'btn-primary btn-big') : btn('Next ›', () => this.next(1), 'btn-primary btn-big')) : null);
    }
    return h('div', { class: 'row quiz-controls' },
      this.idx > 0 ? btn('‹ Previous', () => this.next(-1), 'btn-ghost btn-big') : null,
      last ? btn('Review and submit', () => this.review(), 'btn-primary btn-big') : h('button', { type: 'submit', class: 'btn btn-primary btn-big' }, 'Next ›'));
  }

  next(d) {
    this.idx = Math.min(Math.max(0, this.idx + d), this.questions.length - 1);
    this.persist(); this.show();
  }

  // ── Practice ──
  check() {
    const q = this.questions[this.idx];
    const r0 = this.responses[this.idx];
    if (!this.answered(q) || (q.type === 'match' && Object.keys(r0 || {}).length < q.pairs.length)) { fill(this.feedback, h('p', { class: 'warn-text' }, q.type === 'write' ? 'Type your answer first.' : q.type === 'match' ? 'Choose a meaning for every word first.' : 'Choose an answer first.')); return; }
    const g = grade(q, this.responses[this.idx]);
    if (this.firstTry[this.idx] == null) this.firstTry[this.idx] = g;
    if (g.points === g.possible) { this.done[this.idx] = true; this.persist(); this.show(); return; }
    this.persist();
    this.showFeedback(g, false);
  }

  showFeedback(g, final) {
    const q = this.questions[this.idx];
    const allRight = g.points === g.possible;
    const explain = q.type === 'match'
      ? h('ul', null, g.results.map((r) => h('li', null, r.isCorrect ? '✓ ' : '✗ ', h('strong', null, r.word), ' means: ', r.correct)))
      : h('div', null, h('p', null, h('strong', null, q.word), ' means: ', q.definition), q.sentence ? h('p', { class: 'muted' }, `Example: ${q.sentence}`) : null);
    if (allRight) {
      fill(this.feedback, h('div', { class: 'fb fb-right' }, h('p', { class: 'fb-title' }, '✓ Correct!'), explain));
      this.live.textContent = 'Correct! ' + this.feedback.textContent.replace('✓ Correct!', '').trim();
      return;
    }
    if (final) {
      this.live.textContent = 'The answer is ' + (q.type === 'match' ? 'shown below.' : q.correctText);
      fill(this.feedback, h('div', { class: 'fb fb-shown' }, h('p', { class: 'fb-title' }, 'The answer:'), q.type === 'match' ? explain : h('p', null, h('strong', null, q.correctText)), q.type === 'match' ? null : explain));
      return;
    }
    this.live.textContent = q.type === 'match' ? `${g.points} of ${g.possible} right. Fix the others.` : 'Not quite. Try again or show the answer.';
    fill(this.feedback, h('div', { class: 'fb fb-wrong' },
      h('p', { class: 'fb-title' }, q.type === 'match' ? `✗ ${g.points} of ${g.possible} right. Fix the others.` : '✗ Not quite.'),
      h('div', { class: 'row' },
        btn('Try again', () => { fill(this.feedback); (this.body.querySelector('input[type=text]') || this.body.querySelector('.choices input:checked') || this.body.querySelector('.choices input, .match select'))?.focus(); }, 'btn-ghost'),
        btn('Show the answer', () => { this.done[this.idx] = true; this.persist(); this.show(); }, 'btn-ghost'))));
  }

  // ── Test ──
  async review() {
    const unanswered = this.questions.map((q, i) => [q, i]).filter(([q, i]) => {
      const r = this.responses[i];
      if (q.type === 'match') return !r || Object.keys(r).length < q.pairs.length;
      return r == null || String(r).trim() === '';
    }).map(([, i]) => i);
    fill(this.body, h('div', { class: 'card' },
      h('h2', null, 'Ready to submit?'),
      h('p', null, `You answered ${this.questions.length - unanswered.length} of ${this.questions.length} questions.`),
      unanswered.length ? h('div', null, h('p', { class: 'warn-text' }, 'Not answered yet:'),
        h('div', { class: 'row' }, unanswered.map((i) => btn(`Question ${i + 1}`, () => { this.idx = i; this.show(); }, 'btn-ghost btn-small')))) : null,
      h('div', { class: 'row' },
        btn('‹ Go back', () => this.show(), 'btn-ghost btn-big'),
        btn('Submit test', () => this.submit(unanswered.length), 'btn-primary btn-big submit-test'))));
    this.body.querySelector('h2').setAttribute('tabindex', '-1');
    this.body.querySelector('h2').focus();
  }

  async submit(unanswered) {
    if (unanswered && !(await confirmDialog('Submit with blanks?', `${unanswered} question${unanswered === 1 ? ' is' : 's are'} not answered. Blank answers are marked wrong.`, 'Submit anyway'))) return;
    await this.finish();
  }

  async finish() {
    const rows = [];
    let score = 0;
    this.questions.forEach((q, i) => {
      const g = this.mode === 'practice' ? (this.firstTry[i] || grade(q, undefined)) : grade(q, this.responses[i]);
      score += g.points;
      for (const r of g.results) rows.push({ ...r, type: q.type, promptShort: q.type === 'match' ? `Match: ${r.word}` : q.type === 'def-mc' ? `Meaning of "${q.word}"` : q.type === 'blank' ? q.prompt : `Word for: ${q.prompt}` });
    });
    const missed = rows.filter((r) => !r.isCorrect).map((r) => ({ itemId: r.itemId, word: r.word }));
    const attempt = {
      studentId: this.st.id, weekId: this.snap.weekId, snapshotVersion: this.snap.version, subject: 'vocab',
      activity: this.activity, activityLabel: VOCAB_ACTIVITIES[this.activity].label + (this.only ? ' (missed words)' : ''), mode: this.mode,
      seed: this.seed, startedAt: this.startedAt, submittedAt: nowIso(), score, total: this.total,
      questions: rows, missed, skipped: this.skipped,
    };
    let saved;
    try { saved = await saveAttempt(attempt); } catch (e) { toast('Your result could not be saved: ' + e.message, 'error'); return; }
    this.finished = true;
    dropDraft(this.key);
    fill(this.body, h('h2', { tabindex: '-1', class: 'result-title' }, this.mode === 'test' ? 'Test results' : 'Practice complete'),
      attemptDetail(saved),
      h('div', { class: 'row' }, link('Back to this week', this.base, 'btn btn-ghost'), btn(this.mode === 'test' ? 'Take another test' : 'Practice again', () => go(`${this.base}/vocab/${this.mode}`), 'btn-ghost')));
    this.body.querySelector('.result-title').focus();
  }
}
