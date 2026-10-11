// Sentence Fix: a guided writing activity — Learn → Practice → Thinking Lab → Test.
// Content: data/sentence-fix/bank.json (150 reviewed third-grade sentences). Grading and question choice:
// js/sentencefix/engine.js (rule-based, no AI). Progress and test results are saved per student on this device
// (store 'sentencefix'); resetting practice never deletes test results.
import { h, fill, page, btn, link, toast, confirmDialog, emptyState, progressBar } from '../ui.js';
import * as store from '../store.js';
import * as E from '../sentencefix/engine.js';
import { requireStudent, themeClass, avatar } from './common.js';
import { go } from '../router.js';

export const SKILLS = {
  capitalization: { name: 'Capital letters', icon: '🔠' },
  'ending-punctuation': { name: 'End marks', icon: '❗' },
  commas: { name: 'Commas', icon: '⸴' },
  spelling: { name: 'Spelling', icon: '🔤' },
  'verb-tense': { name: 'Verb tense', icon: '⏰' },
  'subject-verb': { name: 'Subject and verb', icon: '🤝' },
  homophones: { name: 'Sound-alike words', icon: '👂' },
  'possessives-contractions': { name: 'Apostrophes', icon: '’' },
  mixed: { name: 'Mixed mistakes', icon: '🧩' },
};
const MODES = {
  learn: { n: 1, name: 'Learn', icon: '💡', desc: 'Watch how mistakes get fixed' },
  practice: { n: 2, name: 'Practice', icon: '✏️', desc: 'Fix 10 sentences, with hints' },
  lab: { n: 3, name: 'Thinking Lab', icon: '🔬', desc: 'Name the mistake, then fix it' },
  test: { n: 4, name: 'Test', icon: '📝', desc: '15 sentences, no hints' },
};
const SIZE = { practice: 10, lab: 10, test: 15, learn: 3 };

let bankPromise = null;
/** The content bank (cached). */
export function loadBank() {
  bankPromise = bankPromise || fetch(new URL('../../data/sentence-fix/bank.json', import.meta.url)).then((r) => { if (!r.ok) throw new Error('The sentences could not be loaded.'); return r.json(); });
  return bankPromise;
}

async function load(params) {
  const st = await requireStudent(params.sid);
  const bank = await loadBank();
  const byId = new Map(bank.items.map((it) => [it.id, it]));
  const saved = await store.getSfProgress(st.id);
  const state = { engine: E.newProgress(), introSeen: false, done: {}, current: null, ...(saved || {}) };
  if (!state.engine) state.engine = E.newProgress();
  const save = () => store.saveSfProgress(st.id, state);
  return { st, bank, items: bank.items, byId, state, save, home: `#/s/${st.id}/sentence-fix` };
}

const shell = (ctx, opts, ...body) => h('div', { class: themeClass(ctx.st) },
  page({ cls: 'kid sentencefix area-sentencefix', actions: [avatar(ctx.st), h('span', { class: 'who' }, ctx.st.displayName)], ...opts }, ...body));

// ── Menu ──
export async function sfMenu({ params }) {
  const ctx = await load(params);
  const { st, state, home } = ctx;
  const root = h('div');
  const draw = () => {
    if (!state.introSeen) {
      fill(root, h('section', { class: 'card sf-intro' },
        h('p', { class: 'sf-intro-icon', 'aria-hidden': 'true' }, '✏️'),
        h('h2', null, 'Every sentence has mistakes to fix.'),
        h('p', null, 'You will learn the rules, practise with hints, think about the kind of mistake, and then take a test.'),
        h('ol', { class: 'sf-path sf-path-mini' }, Object.values(MODES).map((m) => h('li', null, h('span', { 'aria-hidden': 'true' }, m.icon), ' ', m.name))),
        btn('Let\'s start!', async () => { state.introSeen = true; await ctx.save(); draw(); root.querySelector('.sf-step')?.focus(); }, 'btn-primary btn-big sf-start')));
      return;
    }
    const cur = state.current;
    const nextMode = ['learn', 'practice', 'lab', 'test'].find((m) => !state.done?.[m]) || 'practice';
    const missed = (state.engine.missed || []).filter((id) => ctx.byId.has(id));
    fill(root,
      cur && cur.ids?.length && cur.index < cur.ids.length ? h('div', { class: 'card sf-continue' },
        h('p', null, h('strong', null, `Keep going: ${MODES[cur.mode].name}`), ` · sentence ${cur.index + 1} of ${cur.ids.length}`),
        h('div', { class: 'row' }, link('Continue ›', `${home}/${cur.mode}`, 'btn btn-primary btn-big sf-continue-btn'),
          btn('Start over', async () => { if (await confirmDialog('Start over?', 'Your unfinished set will be cleared. Your test scores stay saved.', 'Start over')) { state.current = null; await ctx.save(); draw(); } }, 'btn-ghost')))
        : null,
      h('ol', { class: 'sf-path', role: 'list' }, Object.entries(MODES).map(([key, m]) => h('li', null,
        h('a', { href: `${home}/${key}`, class: `sf-step ${state.done?.[key] ? 'is-done' : ''} ${key === nextMode ? 'is-next' : ''}` },
          h('span', { class: 'sf-step-num', 'aria-hidden': 'true' }, state.done?.[key] ? '✓' : String(m.n)),
          h('span', { class: 'sf-step-icon', 'aria-hidden': 'true' }, m.icon),
          h('span', { class: 'sf-step-name' }, m.name),
          h('span', { class: 'sf-step-desc' }, m.desc),
          key === nextMode ? h('span', { class: 'sf-step-next' }, 'Next') : null)))),
      h('div', { class: 'row sf-menu-links' },
        missed.length ? link(`🔁 Practice my misses (${missed.length})`, `${home}/practice?misses=1`, 'btn btn-ghost sf-misses') : null,
        link('📊 My test results', `${home}/results`, 'btn btn-ghost')),
      h('details', { class: 'sf-reset' }, h('summary', null, 'Start fresh'),
        h('p', { class: 'hint' }, 'This forgets which sentences you have practised, so you see them again. Your test scores stay saved.'),
        btn('Reset my practice', async () => {
          if (!(await confirmDialog('Reset your practice?', 'You will start your practice from the beginning. Your test scores will NOT be deleted.', 'Reset practice'))) return;
          state.engine = E.newProgress(); state.current = null; state.done = { ...state.done, practice: false, lab: false };
          await ctx.save(); toast('Practice reset. Your test scores are still saved.'); draw();
        }, 'btn-ghost sf-reset-btn')));
  };
  draw();
  return shell(ctx, { title: 'Sentence Fix', back: `#/s/${st.id}`, backLabel: 'Home', subtitle: state.introSeen ? 'Find the mistakes and fix them.' : null }, root);
}

// ── Shared pieces ──
function sentenceCard(item, label = 'This sentence has mistakes:') {
  return h('div', { class: 'sf-sentence-card' }, h('p', { class: 'sf-label' }, label), h('p', { class: 'sf-incorrect', lang: 'en' }, item.incorrect));
}

function answerBox(item, value, onInput, id = 'sf-answer') {
  // Spell-check and auto-correct are off: the red underline would give spelling answers away.
  const ta = h('textarea', { id, class: 'sf-answer', rows: 3, spellcheck: 'false', autocomplete: 'off', autocorrect: 'off', autocapitalize: 'off', 'data-gramm': 'false' }, value ?? item.incorrect);
  // The box grows with the sentence so long sentences never hide inside it on a phone.
  const fit = () => { if (!ta.isConnected) return; ta.style.height = 'auto'; ta.style.height = `${ta.scrollHeight + 6}px`; };
  ta.addEventListener('input', () => { onInput(ta.value); fit(); });
  ta.addEventListener('focus', fit);
  const kick = (n = 0) => (ta.isConnected ? fit() : n < 30 && requestAnimationFrame(() => kick(n + 1)));
  kick();
  return ta;
}

function explanationList(item) {
  return h('ul', { class: 'sf-explain' }, E.explainErrors(item).map((e) => h('li', null,
    h('span', { class: 'sf-wrong' }, e.wrong), h('span', { 'aria-hidden': 'true' }, ' → '), h('span', { class: 'sf-sr' }, ' should be '), h('span', { class: 'sf-right' }, e.right), h('span', { class: 'sf-why' }, ` ${e.explanation}`))));
}

const counter = (i, n) => h('div', { class: 'sf-counter' }, h('p', null, `Sentence ${i + 1} of ${n}`), progressBar(i, n, `Sentence ${i + 1} of ${n}`));

/** Start (or continue) a session for this mode; returns the session object in state.current. */
async function session(ctx, mode, query) {
  const { state } = ctx;
  // ?ids= names the exact sentences (a test's misses or this set's misses); otherwise use everything missed so far.
  const misses = query.misses === '1' ? (query.ids ? query.ids.split(',') : (state.engine.missed || [])).filter((id) => ctx.byId.has(id)) : null;
  const skill = SKILLS[query.skill] ? query.skill : null;
  const fresh = query.new === '1';
  const cur = state.current;
  if (!fresh && cur && cur.mode === mode && cur.index < cur.ids.length && (!misses || cur.misses) && (!skill || cur.skill === skill)) return cur;
  const seed = `${ctx.st.id}:${mode}:${Date.now()}`;
  const ids = E.pickSession(ctx.items, state.engine, { mode, size: SIZE[mode], skill: skill || undefined, seed, onlyIds: misses && misses.length ? misses : undefined });
  state.current = { mode, ids, index: 0, answers: {}, skill, misses: !!(misses && misses.length), seed, startedAt: new Date().toISOString() };
  state.engine = E.markSessionSeen(state.engine, ids);
  await ctx.save();
  // Reloading the page now continues this set instead of starting another one.
  if (fresh) { try { history.replaceState(null, '', location.hash.replace(/([?&])new=1(&|$)/, '$1').replace(/[?&]$/, '')); } catch { /* ignore */ } }
  return state.current;
}

// ── Learn ──
export async function sfLearn({ params, query }) {
  const ctx = await load(params);
  const skill = SKILLS[query.skill] ? query.skill : null;
  const title = 'Learn';
  if (!skill) {
    return shell(ctx, { title, back: ctx.home, backLabel: 'Sentence Fix', subtitle: 'Pick what you want to learn about.' },
      h('ul', { class: 'skill-grid', role: 'list' }, Object.entries(SKILLS).map(([key, s]) => h('li', null,
        link(h('span', null, h('span', { class: 'skill-icon', 'aria-hidden': 'true' }, s.icon), h('span', { class: 'skill-name' }, s.name)), `${ctx.home}/learn?skill=${key}`, 'skill-card')))));
  }
  const ids = E.pickSession(ctx.items, ctx.state.engine, { mode: 'learn', size: SIZE.learn, skill, seed: `${ctx.st.id}:learn:${skill}:${Date.now()}` });
  ctx.state.engine = E.markSessionSeen(ctx.state.engine, ids);
  await ctx.save();
  const box = h('div', { class: 'sf-learn' });
  let ex = 0, step = 0;
  const draw = () => {
    const item = ctx.byId.get(ids[ex]);
    if (!item) { fill(box, emptyState('There are no examples for this right now.')); return; }
    const errs = E.explainErrors(item);
    const steps = E.stepByStep(item);
    const n = errs.length;
    const parts = [h('p', { class: 'sf-label' }, `Example ${ex + 1} of ${ids.length}`)];
    if (step === 0) {
      parts.push(h('h2', null, `This sentence has ${n} mistake${n === 1 ? '' : 's'}. Can you spot ${n === 1 ? 'it' : 'them'}?`),
        h('p', { class: 'sf-incorrect sf-marked' }, E.markErrors(item).map((seg) => (seg.errorIndex == null ? seg.text : h('mark', { class: 'sf-mistake' }, seg.text)))));
    } else if (step <= n) {
      const e = errs[step - 1];
      parts.push(h('h2', null, `Fix ${step} of ${n}`),
        h('p', { class: 'sf-fix' }, h('span', { class: 'sf-wrong' }, e.wrong), h('span', { 'aria-hidden': 'true' }, '  →  '), h('span', { class: 'sf-sr' }, ' becomes '), h('span', { class: 'sf-right' }, e.right)),
        h('p', { class: 'sf-why-big' }, e.explanation),
        h('p', { class: 'sf-step-sentence' }, steps[step - 1]));
    } else {
      parts.push(h('h2', null, 'All fixed! 🎉'), h('p', { class: 'sf-correct' }, item.correct));
      if (!ctx.state.done.learn) { ctx.state.done.learn = true; ctx.save(); }
    }
    const nav = h('div', { class: 'row sf-nav' });
    if (step <= n) nav.append(btn(step === 0 ? 'Show me the first fix ›' : step < n ? 'Next fix ›' : 'See the fixed sentence ›', () => { step++; draw(); focusTop(); }, 'btn-primary btn-big sf-next'));
    else {
      nav.append(btn('Show me again', () => { step = 0; draw(); focusTop(); }, 'btn-ghost sf-again'));
      if (ex < ids.length - 1) nav.append(btn('Another example ›', () => { ex++; step = 0; draw(); focusTop(); }, 'btn-primary sf-another'));
      nav.append(link(`Practise ${SKILLS[skill].name} ›`, `${ctx.home}/practice?skill=${skill}&new=1`, 'btn btn-primary sf-go-practice'));
    }
    if (step > 0 && step <= n) nav.append(btn('Start this example again', () => { step = 0; draw(); focusTop(); }, 'btn-ghost sf-again'));
    fill(box, h('div', { class: 'card sf-learn-card' }, parts), nav);
  };
  const focusTop = () => box.querySelector('h2')?.focus?.();
  draw();
  return shell(ctx, { title: `Learn: ${SKILLS[skill].name}`, back: `${ctx.home}/learn`, backLabel: 'Pick a skill' }, box);
}

// ── Practice and Thinking Lab ──
export const sfPractice = (c) => fixSession(c, 'practice');
export const sfLab = (c) => fixSession(c, 'lab');

async function fixSession({ params, query }, mode) {
  const ctx = await load(params);
  const s = await session(ctx, mode, query);
  const box = h('div', { class: 'sf-session' });
  const restart = btn('New set', async () => {
    if (!(await confirmDialog('Start a new set?', 'You will get new sentences. Your test scores stay saved.', 'New set'))) return;
    ctx.state.current = null; await ctx.save(); go(`${ctx.home}/${mode}?new=1${s.skill ? `&skill=${s.skill}` : ''}`);
  }, 'btn-ghost btn-small sf-new-set');
  const draw = () => {
    if (s.index >= s.ids.length) return drawSummary();
    const item = ctx.byId.get(s.ids[s.index]);
    const a = s.answers[item.id] = s.answers[item.id] || { text: item.incorrect, tries: 0, hints: 0, first: null, result: null, labTries: 0, labDone: mode !== 'lab' };
    const feedback = h('div', { class: 'sf-feedback', 'aria-live': 'polite' });
    const hintBox = h('div', { class: 'sf-hints', 'aria-live': 'polite' });
    const persist = () => ctx.save();
    const ta = answerBox(item, a.text, (v) => { a.text = v; });
    ta.addEventListener('change', persist);
    const drawHints = () => fill(hintBox, a.hints ? h('ol', { class: 'sf-hint-list' }, Array.from({ length: a.hints }, (_, i) => h('li', null, E.hint(item, i + 1, { unfixed: a.lastGrade?.unfixed })))) : '');
    const hintBtn = btn('💡 Hint', () => { if (a.hints < 3) { a.hints++; drawHints(); persist(); } hintBtn.disabled = a.hints >= 3; }, 'btn-ghost sf-hint-btn', { disabled: a.hints >= 3 });
    const next = () => { s.index++; persist(); draw(); window.scrollTo(0, 0); box.querySelector('.sf-label, h2')?.focus?.(); };
    const nextBtn = (label = 'Next sentence ›') => btn(s.index === s.ids.length - 1 ? 'Finish ›' : label, next, 'btn-primary btn-big sf-next');
    const showResult = () => {
      const g = a.lastGrade;
      if (!g) { fill(feedback, ''); return; }
      if (g.result === 'correct') {
        fill(feedback, h('div', { class: 'sf-good' }, h('p', { class: 'sf-big' }, '🎉 You fixed it!'), h('p', { class: 'sf-correct' }, item.correct),
          h('details', null, h('summary', null, 'Why?'), explanationList(item)), nextBtn()));
      } else if (g.result === 'review') {
        fill(feedback, h('div', { class: 'sf-review' }, h('p', { class: 'sf-big' }, '🤔 Your sentence is different from ours.'),
          h('p', null, 'The app can\'t check it for sure. Compare it with this sentence:'), h('p', { class: 'sf-correct' }, item.correct), nextBtn()));
      } else if (g.result === 'empty') {
        fill(feedback, h('p', { class: 'sf-try' }, 'Type your fixed sentence in the box first.'));
      } else {
        const reveal = a.tries >= 2 || a.revealed;
        fill(feedback, h('div', { class: 'sf-try' }, h('p', { class: 'sf-big' }, `Not yet! ${g.message}`),
          h('div', { class: 'row' }, btn('Try again', () => { ta.focus(); }, 'btn-primary sf-try-again'),
            !reveal ? null : btn('Show the answer', () => { a.revealed = true; persist(); showResult(); }, 'btn-ghost sf-show-answer')),
          a.revealed ? h('div', { class: 'sf-reveal' }, h('p', null, 'Here is the fixed sentence:'), h('p', { class: 'sf-correct' }, item.correct), explanationList(item), nextBtn()) : null));
      }
    };
    const check = async () => {
      const g = E.grade(item, ta.value);
      a.text = ta.value; a.lastGrade = { result: g.result, message: g.message, unfixed: g.unfixed };
      if (g.result !== 'empty') {
        a.tries++;
        if (a.first == null) { a.first = g.result; ctx.state.engine = E.recordAnswer(ctx.state.engine, item, g, { mode, attempt: 1 }); }
        if (g.result === 'correct') a.result = 'correct';
      }
      await persist(); showResult();
    };
    const fixArea = h('div', { class: 'sf-fix-area' },
      h('label', { for: 'sf-answer', class: 'sf-label' }, 'Write the sentence the right way:'), ta,
      h('div', { class: 'row sf-actions' }, btn('✔ Check my sentence', check, 'btn-primary btn-big sf-check'), hintBtn,
        btn('↺ Start over', () => { ta.value = item.incorrect; a.text = item.incorrect; persist(); ta.dispatchEvent(new Event('input')); ta.focus(); }, 'btn-ghost sf-start-over')),
      hintBox, feedback);
    drawHints(); hintBtn.disabled = a.hints >= 3; showResult();
    // Thinking Lab: first say what kind of mistake it is.
    let labPart = null;
    if (mode === 'lab' && !a.labDone) {
      const want = E.labCategory(item);
      const msg = h('div', { class: 'sf-lab-msg', 'aria-live': 'polite' });
      labPart = h('section', { class: 'card sf-lab', 'aria-labelledby': 'lab-q' }, h('h2', { id: 'lab-q', tabindex: '-1' }, 'What kind of mistake is in this sentence?'),
        h('div', { class: 'lab-choices' }, E.LAB_CHOICES.map((c) => btn(c.label, async () => {
          a.labTries++;
          // Some mistakes can fairly be called two kinds (e.g. a verb homophone); the engine accepts either.
          if (E.labAccepts ? E.labAccepts(item, c.value) : c.value === want) { a.labDone = true; a.labRight = a.labTries === 1; await persist(); toast(`Yes! ${c.label}.`); draw(); return; }
          if (a.labTries >= 2) {
            const right = E.LAB_CHOICES.find((x) => x.value === want);
            fill(msg, h('div', { class: 'sf-try' }, h('p', null, `It is: ${right.label}.`), h('p', null, labReason(item, want)),
              btn('Now fix it ›', async () => { a.labDone = true; await persist(); draw(); }, 'btn-primary sf-lab-continue')));
          } else fill(msg, h('p', { class: 'sf-try' }, `Not quite. ${E.hint(item, 1)} Try again.`));
          await persist();
        }, `btn-ghost lab-choice lab-${c.value}`))), msg);
    }
    fill(box, counter(s.index, s.ids.length), h('section', { class: 'card sf-q' }, sentenceCard(item), labPart || fixArea));
  };
  const drawSummary = () => {
    const firstRight = s.ids.filter((id) => s.answers[id]?.first === 'correct').length;
    const missedHere = s.ids.filter((id) => s.answers[id]?.first === 'incorrect');
    if (!ctx.state.done[mode]) { ctx.state.done[mode] = true; }
    ctx.state.current = null; ctx.save();
    fill(box, h('section', { class: 'card sf-summary' }, h('p', { class: 'sf-intro-icon', 'aria-hidden': 'true' }, '🌟'),
      h('h2', null, `You fixed ${firstRight} of ${s.ids.length} on your first try!`),
      h('div', { class: 'row' },
        missedHere.length ? link(`Practice my misses (${missedHere.length})`, `${ctx.home}/practice?misses=1&new=1&ids=${missedHere.join(',')}`, 'btn btn-primary btn-big') : null,
        link(mode === 'lab' ? 'New Thinking Lab set' : 'New practice set', `${ctx.home}/${mode}?new=1`, 'btn btn-ghost btn-big sf-new'),
        link('Sentence Fix home', ctx.home, 'btn btn-ghost'))));
  };
  draw();
  return shell(ctx, { title: mode === 'lab' ? 'Thinking Lab' : (s.misses ? 'Practice my misses' : 'Practice'), back: ctx.home, backLabel: 'Sentence Fix',
    subtitle: s.skill ? SKILLS[s.skill].name : null }, h('div', { class: 'sf-tools' }, restart), box);
}

/** Why the mistake belongs to that kind (Thinking Lab), in child-friendly words. */
function labReason(item, want) {
  const ex = E.explainErrors(item)[0];
  if (want === 'more-than-one') return 'This sentence has different kinds of mistakes: ' + [...new Set(E.explainErrors(item).map((e) => ({ spelling: 'spelling', capitalization: 'capital letters', punctuation: 'punctuation', grammar: 'grammar' }[e.category])))].join(', ') + '.';
  return ex ? ex.explanation : '';
}

// ── Test ──
export async function sfTest({ params, query }) {
  const ctx = await load(params);
  const s = await session(ctx, 'test', query);
  const box = h('div', { class: 'sf-session sf-test' });
  const draw = () => {
    const item = ctx.byId.get(s.ids[s.index]);
    const a = s.answers[item.id] = s.answers[item.id] || { text: item.incorrect };
    const ta = answerBox(item, a.text, (v) => { a.text = v; });
    ta.addEventListener('change', () => ctx.save());
    const go2 = async (d) => { a.text = ta.value; s.index = Math.max(0, Math.min(s.ids.length - 1, s.index + d)); await ctx.save(); draw(); window.scrollTo(0, 0); };
    const last = s.index === s.ids.length - 1;
    fill(box, counter(s.index, s.ids.length),
      h('section', { class: 'card sf-q' }, sentenceCard(item),
        h('label', { for: 'sf-answer', class: 'sf-label' }, 'Write the sentence the right way:'), ta,
        h('p', { class: 'hint' }, 'No hints in the test. Do your best! You can go back and change your answers before you finish.')),
      h('div', { class: 'row sf-nav' },
        s.index > 0 ? btn('‹ Back', () => go2(-1), 'btn-ghost sf-prev') : null,
        last ? btn('Finish the test ✓', () => { a.text = ta.value; finish(); }, 'btn-primary btn-big sf-finish') : btn('Next ›', () => go2(1), 'btn-primary btn-big sf-next')),
      h('p', { class: 'sf-dots', 'aria-label': 'Sentences' }, s.ids.map((id, i) => btn(String(i + 1), async () => { a.text = ta.value; s.index = i; await ctx.save(); draw(); },
        `sf-dot ${i === s.index ? 'is-current' : ''} ${s.answers[id] && s.answers[id].text !== ctx.byId.get(id)?.incorrect ? 'is-changed' : ''}`, { 'aria-label': `Sentence ${i + 1}`, 'aria-current': i === s.index ? 'step' : null }))));
  };
  const finish = async () => {
    await ctx.save();
    const unchanged = s.ids.filter((id) => (s.answers[id]?.text ?? ctx.byId.get(id).incorrect) === ctx.byId.get(id).incorrect).length;
    if (unchanged && !(await confirmDialog('Finish the test?', `You did not change ${unchanged} sentence${unchanged === 1 ? '' : 's'}. Finish anyway?`, 'Finish'))) return;
    const answers = s.ids.map((id) => { const it = ctx.byId.get(id); const answer = s.answers[id]?.text ?? it.incorrect; return { id, answer, grade: E.grade(it, answer) }; });
    const sum = E.summarizeTest(answers.map((x) => ctx.byId.get(x.id)), answers);
    for (const x of answers) ctx.state.engine = E.recordAnswer(ctx.state.engine, ctx.byId.get(x.id), x.grade, { mode: 'test' });
    const rec = await store.saveSfTest(ctx.st.id, {
      mode: 'test', ids: s.ids, startedAt: s.startedAt, submittedAt: new Date().toISOString(),
      answers: answers.map((x) => ({ id: x.id, answer: x.answer, result: x.grade.result, fixed: x.grade.fixed, unfixed: x.grade.unfixed })),
      total: sum.total, correct: sum.correct, incorrect: sum.incorrect, review: sum.review, scorePercent: sum.scorePercent, bySkill: sum.bySkill, missedIds: sum.missedIds,
    });
    ctx.state.current = null; ctx.state.done.test = true; await ctx.save();
    go(`${ctx.home}/results/${rec.id}`);
  };
  draw();
  return shell(ctx, { title: 'Sentence Fix Test', back: ctx.home, backLabel: 'Sentence Fix' }, box);
}

// ── Results ──
export async function sfResults({ params }) {
  const ctx = await load(params);
  const tests = await store.listSfTests(ctx.st.id);
  return shell(ctx, { title: 'My test results', back: ctx.home, backLabel: 'Sentence Fix' },
    tests.length ? h('ul', { class: 'sf-history', role: 'list' }, tests.map((t) => h('li', null,
      link(h('span', null, h('span', { class: 'week-name' }, `${t.correct} of ${t.total - (t.review || 0)} right`), h('span', { class: 'week-meta' }, new Date(t.submittedAt || t.savedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }))),
        `${ctx.home}/results/${t.id}`, 'week-link'))))
      : emptyState('No tests yet. Take a test when you are ready!', link('Take a test', `${ctx.home}/test`, 'btn btn-primary')));
}

export async function sfResult({ params }) {
  const ctx = await load(params);
  const t = (await store.listSfTests(ctx.st.id)).find((x) => x.id === params.tid);
  if (!t) return shell(ctx, { title: 'Result not found', back: `${ctx.home}/results`, backLabel: 'My test results' }, emptyState('This result is not here.'));
  const scored = t.total - (t.review || 0);
  const icon = { correct: '✅', incorrect: '❌', review: '🤔', empty: '❌' };
  const label = { correct: 'Right', incorrect: 'Not yet', review: 'A grown-up can check this one', empty: 'No answer' };
  return shell(ctx, { title: 'Test results', back: ctx.home, backLabel: 'Sentence Fix' },
    h('section', { class: 'card sf-score' }, h('p', { class: 'sf-intro-icon', 'aria-hidden': 'true' }, t.scorePercent >= 80 ? '🏆' : t.scorePercent >= 50 ? '🌟' : '💪'),
      h('h2', null, `You got ${t.correct} of ${scored} right!`),
      t.review ? h('p', null, `${t.review} sentence${t.review === 1 ? ' is' : 's are'} different from our answer, so the app did not count ${t.review === 1 ? 'it' : 'them'}. Ask a grown-up to check.`) : null,
      h('ul', { class: 'sf-skills' }, Object.entries(t.bySkill || {}).map(([k, v]) => h('li', null, h('span', null, SKILLS[k]?.name || k), progressBar(v.correct, v.total, `${SKILLS[k]?.name || k}: ${v.correct} of ${v.total}`), h('span', null, `${v.correct}/${v.total}`)))),
      h('div', { class: 'row' },
        t.missedIds?.length ? link(`Practice my misses (${t.missedIds.length})`, `${ctx.home}/practice?misses=1&new=1&ids=${t.missedIds.join(',')}`, 'btn btn-primary btn-big sf-practice-misses') : null,
        link('Take another test', `${ctx.home}/test?new=1`, 'btn btn-ghost btn-big'), link('Sentence Fix home', ctx.home, 'btn btn-ghost'))),
    h('section', { class: 'card', 'aria-labelledby': 'rev-h' }, h('h2', { id: 'rev-h' }, 'Look at your answers'),
      h('ol', { class: 'sf-review-list' }, t.answers.map((x) => {
        const it = ctx.byId.get(x.id);
        if (!it) return null;
        return h('li', { class: `sf-rev sf-rev-${x.result}` }, h('p', { class: 'sf-rev-head' }, h('span', { 'aria-hidden': 'true' }, icon[x.result] + ' '), label[x.result]),
          h('p', null, h('strong', null, 'You wrote: '), x.answer),
          x.result !== 'correct' ? [h('p', null, h('strong', null, 'Fixed sentence: '), h('span', { class: 'sf-correct-inline' }, it.correct)), x.result === 'incorrect' ? explanationList(it) : null] : null);
      }))));
}
