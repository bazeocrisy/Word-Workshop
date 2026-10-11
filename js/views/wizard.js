// "Create this week's lesson": a guided four-step process for the parent.
//   1 Student and week → 2 Add words → 3 Review → 4 Approve
// Every change is saved to the week's working copy as it happens (the same store and rules as the week editor), and
// the step reached is remembered, so a parent can leave at any point and continue later. Approval goes through
// store.approveWeek, which re-checks every blocker and builds the immutable snapshot; nothing here bypasses it.
import { h, fill, page, btn, link, field, toast, badge, dialog, alertDialog, progressBar, emptyState } from '../ui.js';
import * as store from '../store.js';
import {
  newVocabItem, newSpellingItem, approvalBlockers, weekStatus, weekLabel, schoolWeekOf, STATUS_LABELS, vocabFlags, spellingFlags, nowIso,
} from '../model.js';
import { suggestGroups } from '../spelling.js';
import { Editor } from './weekEditor.js';
import { avatar, themeClass } from './common.js';
import { go } from '../router.js';

import { STEPS, stepHref, stepKey, stepLabel, rememberStep, resumeHref } from './lessonSteps.js';

function stepper(current, wid) {
  const at = STEPS.findIndex((s) => s.key === current);
  return h('nav', { class: 'stepper', 'aria-label': 'Lesson steps' }, h('ol', null, STEPS.map((s, i) => {
    const state = i < at ? 'done' : i === at ? 'current' : 'todo';
    // Numbers only: an earlier step is not necessarily finished (e.g. Review with words still unchecked).
    const inner = [h('span', { class: 'step-num', 'aria-hidden': 'true' }, String(i + 1)),
      h('span', { class: 'step-label' }, s.label),
      h('span', { class: 'sr-only' }, state === 'current' ? ' (this step)' : '')];
    return h('li', { class: `step step-${state}` },
      wid && i !== at ? h('a', { href: stepHref(wid, s.key) }, inner) : h('span', { 'aria-current': state === 'current' ? 'step' : null }, inner));
  })));
}

function wizardPage({ step, week, student, title, intro }, ...body) {
  const who = student ? `For ${student.displayName}` : null;
  return page({ title, back: '#/parent', backLabel: 'Parent area', cls: 'parent wizard',
    subtitle: [stepLabel(step), who, week ? weekLabel(week) : null].filter(Boolean).join(' · ') },
  stepper(step, week?.id), intro ? h('p', { class: 'wizard-intro' }, intro) : null, ...body);
}

const wizardNav = (...children) => h('div', { class: 'wizard-nav' }, children);
const backLink = (href, label) => link(h('span', null, h('span', { 'aria-hidden': 'true' }, '‹ '), label), href, 'btn btn-ghost wizard-back');

async function loadWeek(wid) {
  const week = await store.getWeek(wid);
  if (!week) return { error: page({ title: 'Lesson not found', back: '#/parent', backLabel: 'Parent area' }, emptyState('This lesson no longer exists.', link('Create a lesson', '#/parent/new', 'btn btn-primary'))) };
  return { week, student: await store.getStudent(week.studentId) };
}

const overlaps = (a, b) => a.startDate <= (b.endDate || b.startDate) && b.startDate <= (a.endDate || a.startDate);
const plusDays = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); const e = new Date(y, m - 1, d + n); return `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, '0')}-${String(e.getDate()).padStart(2, '0')}`; };

// ── Step 1: student and week ──
export async function wizardStart({ params = {}, query = {} }) {
  let week = null, student = null;
  if (params.wid) { const r = await loadWeek(params.wid); if (r.error) return r.error; ({ week, student } = r); await rememberStep(week.id, 'start'); }
  const students = await store.listStudents();
  if (!students.length) return wizardPage({ step: 'start', title: 'Create this week\'s lesson' }, emptyState('Add a student first.', link('Add a student in Settings', '#/parent/settings', 'btn btn-primary')));
  const def = schoolWeekOf();
  const chosen = week ? week.studentId : (students.some((s) => s.id === query.student) ? query.student : students.length === 1 ? students[0].id : null);
  const locked = !!week?.approvedVersion; // an approved lesson belongs to its student for good (its snapshots and scores do)
  const choices = students.map((s) => h('label', { class: `student-choice ${themeClass(s)}` },
    h('input', { type: 'radio', name: 'wz-student', value: s.id, checked: s.id === chosen, disabled: locked && s.id !== chosen }),
    avatar(s), h('span', { class: 'choice-name' }, s.displayName), s.grade ? h('span', { class: 'muted' }, `Grade ${s.grade}`) : null));
  const start = h('input', { type: 'date', value: week ? week.startDate : def.startDate, required: true, id: 'wz-start' });
  const end = h('input', { type: 'date', value: week ? week.endDate : def.endDate, id: 'wz-end' });
  start.addEventListener('change', () => { if (start.value) end.value = plusDays(start.value, 4); });
  const title = h('input', { type: 'text', maxlength: '60', value: week?.title || '', placeholder: 'For example: Unit 3 Week 2', id: 'wz-title' });
  const errors = h('div', { class: 'form-error', role: 'alert' });
  const next = h('button', { type: 'submit', class: 'btn btn-primary btn-big wizard-next' }, 'Continue to Add words ›');

  let busy = false; // a double tap must not create two lessons (set before the first await)
  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    busy = true;
    try { await submitOnce(); } finally { busy = false; }
  };
  const submitOnce = async () => {
    const sid = form.querySelector('input[name=wz-student]:checked')?.value;
    const v = { startDate: start.value, endDate: end.value || start.value, title: title.value.trim() };
    const problems = [];
    if (!sid) problems.push(['Choose who this lesson is for.', form.querySelector('input[name=wz-student]')]);
    if (!v.startDate) problems.push(['Choose the date the school week starts.', start]);
    else if (v.endDate < v.startDate) problems.push(['The end date is before the start date.', end]);
    fill(errors, problems.length ? h('ul', null, problems.map((p) => h('li', null, p[0]))) : '');
    if (problems.length) { problems[0][1]?.focus(); return; }
    // One lesson per student per school week: offer the existing one instead of making a duplicate.
    const clash = (await store.listWeeks(sid)).find((w) => w.id !== week?.id && overlaps(w, v));
    if (clash) {
      const st = students.find((s) => s.id === sid);
      const open = await dialog({ title: 'There is already a lesson for this week',
        body: h('div', null, h('p', null, `${st.displayName} already has a lesson for ${weekLabel(clash)} (${STATUS_LABELS[weekStatus(clash)]}, ${clash.vocab.length} vocabulary and ${clash.spelling.length} spelling words).`),
          h('p', null, 'Open that lesson to add to it or change it, or choose different dates.')),
        buttons: [{ label: 'Open that lesson', value: true }], cancel: 'Choose other dates' });
      if (open) go(await resumeHref(clash)); else start.focus();
      return;
    }
    next.disabled = true;
    try {
      if (!week) {
        const w = await store.createWeek(sid, v);
        go(stepHref(w.id, 'words'));
        return;
      }
      const changed = sid !== week.studentId || v.startDate !== week.startDate || v.endDate !== week.endDate || v.title !== (week.title || '');
      if (changed) await store.editWeek(week.id, (w) => { Object.assign(w, v); if (!w.approvedVersion) w.studentId = sid; }, { action: 'details changed', detail: `${v.startDate} – ${v.endDate}${v.title ? ' · ' + v.title : ''}` });
      go(stepHref(week.id, 'words'));
    } catch (err) {
      next.disabled = false;
      fill(errors, h('p', null, `The lesson could not be saved: ${err.message || err}. Nothing was lost; try again.`));
    }
  };
  const form = h('form', { class: 'card wizard-form', onsubmit: submit, novalidate: true },
    h('fieldset', { class: 'student-choices' }, h('legend', null, 'Who is this lesson for?'),
      locked ? h('p', { class: 'hint' }, 'This lesson has been approved, so it stays with this student.') : null,
      h('div', { class: 'choice-grid' }, choices)),
    h('fieldset', null, h('legend', null, 'Which school week?'),
      h('div', { class: 'two-col' }, field('Week starts', start), field('Week ends', end)),
      field('Lesson name (optional)', title, 'Leave empty to call it "Week of …".')),
    errors,
    wizardNav(backLink('#/parent', 'Cancel'), next));
  return wizardPage({ step: 'start', week, student, title: week ? 'Student and week' : 'Create this week\'s lesson',
    intro: 'A lesson holds one week of vocabulary words, spelling words, or both. Your child sees it only after you check and approve it.' }, form);
}

// ── Step 2: add words ──
export async function wizardWords({ params }) {
  const r = await loadWeek(params.wid);
  if (r.error) return r.error;
  await rememberStep(r.week.id, 'words');
  return new WordsStep(r.week, r.student, []).render();
}

class WordsStep extends Editor {
  constructor(...a) { super(...a); this.home = stepHref(this.w.id, 'words'); this.drafts = {}; }

  refreshSummary() { this.countVo.textContent = String(this.w.vocab.length); this.countSp.textContent = String(this.w.spelling.length); }

  render() {
    this.navMsg = h('div', { class: 'form-error', role: 'alert' });
    const empty = !this.w.vocab.length && !this.w.spelling.length;
    this.root = wizardPage({ step: 'words', week: this.w, student: this.student, title: 'Add this week\'s words',
      intro: 'Add the vocabulary words, the spelling words, or both. Upload a photo of the teacher\'s sheet, paste a list, or type the words one at a time. Everything is saved as you go.' },
    h('div', { class: 'subject-grid' }, this.subjectPanel('vocab'), this.subjectPanel('spelling')),
    empty ? h('p', { class: 'hint' }, 'Just trying Word Workshop? ', btn('Fill in the sample week', () => this.loadSample(), 'btn-ghost btn-small sample-btn')) : null,
    this.navMsg,
    wizardNav(backLink(stepHref(this.w.id, 'start'), 'Back'), btn('Continue to Review ›', () => this.next(), 'btn-primary btn-big wizard-next')));
    this.renderVocab(); this.renderSpelling(); this.refreshSummary();
    return this.root;
  }

  subjectPanel(kind) {
    const vo = kind === 'vocab';
    const draftKey = `ww-add:${this.w.id}:${kind}`;
    let saved = {};
    try { saved = JSON.parse(sessionStorage.getItem(draftKey) || '{}'); } catch { /* ignore */ }
    const word = h('input', { type: 'text', autocomplete: 'off', spellcheck: 'false', autocapitalize: vo ? null : 'none', class: `new-word ${vo ? 'add-vo' : 'add-sp'}`, value: saved.word || '' });
    const def = vo ? h('textarea', { rows: 2, class: 'new-def' }, saved.def || '') : null; // a textarea's text is its content, not a value attribute
    const keep = () => { try { sessionStorage.setItem(draftKey, JSON.stringify({ word: word.value, def: def?.value || '' })); } catch { /* ignore */ } };
    word.addEventListener('input', keep); def?.addEventListener('input', keep);
    const msg = h('p', { class: 'form-error', role: 'alert' });
    const discard = () => { word.value = ''; if (def) def.value = ''; try { sessionStorage.removeItem(draftKey); } catch { /* ignore */ } };
    let adding = false; // a double click must not add the word twice
    const add = async () => {
      if (adding) return;
      const w = word.value.trim(), d = def ? def.value.trim() : '';
      if (!w) { fill(msg, vo && d ? 'Type the word for this definition.' : 'Type a word first.'); word.focus(); return; }
      fill(msg, '');
      adding = true;
      try {
        if (vo) this.w.vocab.push(newVocabItem({ word: w, definition: d, origin: 'typed' }));
        else { const it = newSpellingItem({ word: w }); it.groups = suggestGroups(w); this.w.spelling.push(it); }
        await this.save({ action: 'added', detail: `${vo ? 'vocabulary' : 'spelling'} "${w}" (typed)` });
        discard();
        this.rerender(kind);
        toast(`Added "${w}".`);
        word.focus();
      } finally { adding = false; }
    };
    this.drafts[kind] = () => (word.value.trim() || (def && def.value.trim()) ? { word, def, add, discard } : null);
    const id = `wz-h-${kind}`;
    const count = h('span', { class: 'count-pill' }, '0');
    if (vo) this.countVo = count; else this.countSp = count;
    const list = h('div', { class: 'entry-list' });
    if (vo) this.vocabSection = list; else this.spellingSection = list;
    return h('section', { class: `card subject-panel subject-panel-${kind}`, 'aria-labelledby': id },
      h('h2', { id }, h('span', { 'aria-hidden': 'true' }, vo ? '💡 ' : '🔤 '), vo ? 'Vocabulary' : 'Spelling', ' ', count, h('span', { class: 'sr-only' }, ' words')),
      h('p', { class: 'hint' }, vo ? 'Words with the teacher\'s definitions, copied exactly.' : 'The spelling list, in the teacher\'s order.'),
      h('div', { class: 'add-actions' },
        link(h('span', null, h('span', { 'aria-hidden': 'true' }, '📷 '), vo ? 'Upload vocabulary worksheet' : 'Upload spelling list or newsletter'),
          `#/parent/week/${this.w.id}/import?for=${kind}&from=wizard`, `btn btn-primary upload-${kind}`),
        btn(h('span', null, h('span', { 'aria-hidden': 'true' }, '📋 '), 'Paste or type a list'), () => this.pasteDialog(kind), `btn-ghost paste-${kind}`)),
      h('form', { class: 'add-one', onsubmit: (e) => { e.preventDefault(); add(); } },
        h('h3', null, 'Add one word'),
        field(vo ? 'Word' : 'Spelling word', word),
        vo ? field('Definition, exactly as the teacher wrote it', def) : null,
        msg,
        h('button', { type: 'submit', class: `btn btn-ghost add-one-btn add-one-${kind}` }, vo ? '+ Add vocabulary word' : '+ Add spelling word')),
      list);
  }

  renderVocab() {
    const list = this.w.vocab;
    fill(this.vocabSection, h('h3', null, 'This week\'s vocabulary'),
      list.length ? h('ol', { class: 'entries' }, list.map((it, i) => this.vocabRow(it, i, list))) : h('p', { class: 'hint empty-list' }, 'No vocabulary words yet. Leave this empty if there is no vocabulary this week.'));
    this.refreshSummary();
  }

  renderSpelling() {
    const list = this.w.spelling;
    fill(this.spellingSection, h('h3', null, 'This week\'s spelling list'),
      list.length ? h('ol', { class: 'entries' }, list.map((it, i) => this.spellingRow(it, i, list))) : h('p', { class: 'hint empty-list' }, 'No spelling words yet. Leave this empty if there is no spelling this week.'));
    this.refreshSummary();
  }

  sourceNote(it) {
    const notes = [];
    if (it.ocrConfidence != null) notes.push(badge(`From photo · ${Math.round(it.ocrConfidence)}% sure`, it.ocrConfidence < 80 ? 'warn' : 'info'));
    if (it.importedFlags?.length) notes.push(badge(`${it.importedFlags.length} thing${it.importedFlags.length === 1 ? '' : 's'} to check in Review`, 'warn'));
    return notes.length ? h('p', { class: 'entry-notes' }, notes) : null;
  }

  vocabRow(it, idx, list) {
    const word = h('input', { type: 'text', value: it.word, autocomplete: 'off', spellcheck: 'false', class: 'word-input', 'aria-label': `Vocabulary word ${idx + 1}` });
    word.addEventListener('change', async () => {
      const before = it.word; it.word = word.value.trim(); it.reviewed = false;
      await this.save({ action: 'edited', detail: `vocabulary "${before}" → "${it.word}"` });
    });
    const def = h('textarea', { rows: 2, class: 'teacher-def', 'aria-label': `Teacher's definition of vocabulary word ${idx + 1}` }, it.sourceDefinition);
    def.addEventListener('change', async () => {
      const from = it.sourceDefinition, to = def.value.trim();
      if (from === to) return;
      it.sourceDefinition = to; it.reviewed = false;
      it.definitionLog.push({ field: 'sourceDefinition', from, to, at: nowIso(), reason: 'Transcription corrected by parent' });
      await this.save({ action: 'teacher definition corrected', detail: `"${it.word}": "${from}" → "${to}"` });
    });
    return h('li', { class: 'entry', dataset: { item: it.id } },
      h('div', { class: 'item-head' }, h('span', { class: 'item-num', 'aria-hidden': 'true' }, String(idx + 1)), word, this.listControls('vocab', it, idx, list)),
      def, this.sourceNote(it));
  }

  spellingRow(it, idx, list) {
    const word = h('input', { type: 'text', value: it.word, autocapitalize: 'none', autocomplete: 'off', spellcheck: 'false', class: 'word-input', 'aria-label': `Spelling word ${idx + 1}` });
    word.addEventListener('change', async () => {
      const before = it.word; it.word = word.value.trim(); it.reviewed = false;
      if (!it.groups || it.groups.source === 'auto') it.groups = it.word ? suggestGroups(it.word) : null;
      await this.save({ action: 'edited', detail: `spelling "${before}" → "${it.word}"` });
    });
    return h('li', { class: 'entry', dataset: { item: it.id } },
      h('div', { class: 'item-head' }, h('span', { class: 'item-num', 'aria-hidden': 'true' }, String(idx + 1)), word, this.listControls('spelling', it, idx, list)),
      this.sourceNote(it));
  }

  async next() {
    // A word typed into "Add one word" but not added yet must not be lost silently.
    for (const kind of ['vocab', 'spelling']) {
      const d = this.drafts[kind]?.();
      if (!d) continue;
      const v = await dialog({ title: 'Add the word you typed?', body: `"${d.word.value.trim() || d.def?.value.trim()}" is typed in ${kind === 'vocab' ? 'Vocabulary' : 'Spelling'} but has not been added yet.`,
        buttons: [{ label: 'Leave it out', value: 'skip', cls: 'btn-ghost' }, { label: 'Add it', value: 'add' }] });
      if (!v) return;
      if (v === 'skip') d.discard();
      else { await d.add(); if (this.drafts[kind]?.()) return; }
    }
    await this.queue;
    if (!this.w.vocab.length && !this.w.spelling.length) {
      fill(this.navMsg, h('p', null, 'Add at least one vocabulary or spelling word before you continue.'));
      this.root.querySelector('.new-word')?.focus();
      return;
    }
    go(stepHref(this.w.id, 'review'));
  }
}

// ── Step 3: review ──
export async function wizardReview({ params }) {
  const r = await loadWeek(params.wid);
  if (r.error) return r.error;
  if (!r.week.vocab.length && !r.week.spelling.length) { go(stepHref(r.week.id, 'words')); return h('p', null, 'Add words first…'); }
  await rememberStep(r.week.id, 'review');
  return new ReviewStep(r.week, r.student, []).render();
}

class ReviewStep extends Editor {
  constructor(...a) { super(...a); this.home = stepHref(this.w.id, 'review'); }

  render() {
    this.progress = h('div', { 'aria-live': 'polite' });
    this.root = wizardPage({ step: 'review', week: this.w, student: this.student, title: 'Check every word',
      intro: 'Compare each word with the teacher\'s sheet. Fix any reading mistakes, deal with each ⚠️ warning, then tick the "Checked" box. Example sentences and pictures are optional; add or check them here.' },
    this.progress,
    this.layout = h('div', { class: 'editor-layout' },
      h('div', { class: 'editor-main' },
        this.vocabSection = h('section', { class: 'card', 'aria-labelledby': 'sec-vo' }),
        this.spellingSection = h('section', { class: 'card', 'aria-labelledby': 'sec-sp' })),
      this.sourcesAside = h('aside', { class: 'editor-sources', 'aria-label': 'Source pages' })),
    wizardNav(backLink(stepHref(this.w.id, 'words'), 'Back to Add words'), btn('Continue to Approve ›', async () => { await this.queue; go(stepHref(this.w.id, 'approve')); }, 'btn-primary btn-big wizard-next')));
    this.renderVocab(); this.renderSpelling(); this.renderSources(); this.refreshSummary();
    return this.root;
  }

  refreshSummary() {
    const all = [...this.w.vocab, ...this.w.spelling];
    const checked = all.filter((i) => i.reviewed).length;
    const warnings = openWarnings(this.w);
    const done = checked === all.length && !warnings;
    fill(this.progress, h('div', { class: `card review-summary ${done ? 'notice-ok' : ''}` },
      h('p', null, h('strong', null, `${checked} of ${all.length} words checked`), warnings ? ` · ${warnings} warning${warnings === 1 ? '' : 's'} still open` : ''),
      progressBar(checked, all.length, 'Words checked'),
      done ? h('p', { class: 'ok-text' }, 'Everything is checked. Continue to Approve.') : btn('Go to the next word to check', () => this.jumpToNext(), 'btn-ghost btn-small next-check')));
  }
}

function openWarnings(w) {
  let n = 0;
  for (const it of w.vocab) n += vocabFlags(it, w).filter((f) => f.level === 'warning' && !f.acknowledged).length;
  for (const it of w.spelling) n += spellingFlags(it, w).filter((f) => f.level === 'warning' && !f.acknowledged).length;
  return n;
}

// ── Step 4: approve ──
export async function wizardApprove({ params }) {
  const r = await loadWeek(params.wid);
  if (r.error) return r.error;
  const { week: w, student } = r;
  await rememberStep(w.id, 'approve');
  const who = student ? student.displayName : 'The student';
  const st = weekStatus(w);
  const all = [...w.vocab, ...w.spelling];
  const checked = all.filter((i) => i.reviewed).length;
  const warnings = openWarnings(w);
  const blockers = approvalBlockers(w);
  const summary = h('dl', { class: 'approve-summary' },
    h('div', null, h('dt', null, 'Vocabulary words'), h('dd', null, String(w.vocab.length))),
    h('div', null, h('dt', null, 'Spelling words'), h('dd', null, String(w.spelling.length))),
    h('div', { class: checked === all.length ? 'is-ok' : 'is-warn' }, h('dt', null, 'Checked'), h('dd', null, `${checked} of ${all.length}`)),
    h('div', { class: warnings ? 'is-warn' : 'is-ok' }, h('dt', null, 'Open warnings'), h('dd', null, String(warnings))));
  const body = [h('section', { class: 'card', 'aria-labelledby': 'ap-sum' }, h('h2', { id: 'ap-sum' }, 'Summary'), summary)];
  if (st === 'approved') {
    body.push(h('div', { class: 'card notice notice-ok' }, h('p', null, `Approved (version ${w.approvedVersion}). ${who} can study this lesson.`),
      h('div', { class: 'row' }, link(`Open ${who}'s lessons`, `#/s/${w.studentId}`, 'btn btn-primary'), link('Parent area', '#/parent', 'btn btn-ghost'))));
  } else if (blockers.length) {
    body.push(h('section', { class: 'card notice notice-warn', 'aria-labelledby': 'ap-block' },
      h('h2', { id: 'ap-block' }, 'Not ready to approve yet'),
      h('p', null, `${who} cannot see this lesson until everything below is done.`),
      link(all.length ? 'Go back and check the words' : 'Go back and add words', stepHref(w.id, all.length ? 'review' : 'words'), 'btn btn-primary fix-btn'),
      h('ul', { class: 'blockers' }, blockers.slice(0, 12).map((b) => h('li', null, b))),
      blockers.length > 12 ? h('p', { class: 'hint' }, `…and ${blockers.length - 12} more.`) : null));
  } else {
    const verify = h('input', { type: 'checkbox', class: 'verify-box' });
    const approveBtn = btn(st === 'pending-changes' ? `Approve version ${w.approvedVersion + 1} for ${who}` : `Approve and give to ${who}`, async () => {
      if (!verify.checked) return;
      approveBtn.disabled = true;
      try {
        const done = await store.approveWeek(w.id);
        await store.setMeta(stepKey(w.id), null);
        toast(`Approved! ${who} can now study ${weekLabel(done)}.`);
        go(`#/s/${w.studentId}`);
      } catch (e) {
        approveBtn.disabled = false;
        await alertDialog('Not approved yet', h('div', null, h('p', null, e.message), e.blockers ? h('ul', null, e.blockers.slice(0, 10).map((b) => h('li', null, b))) : null));
      }
    }, 'btn-primary btn-big approve-btn', { disabled: true });
    verify.addEventListener('change', () => { approveBtn.disabled = !verify.checked; });
    body.push(h('section', { class: 'card approve-panel', 'aria-labelledby': 'ap-go' },
      h('h2', { id: 'ap-go' }, 'Approve'),
      h('p', { class: 'ok-text' }, 'Every word is checked and every warning is dealt with.'),
      h('label', { class: 'check verify' }, verify, h('span', null, 'I have compared every word, spelling and definition with the teacher\'s sheets.')),
      h('p', { class: 'hint' }, `Approving saves this lesson as version ${(w.approvedVersion || 0) + 1}. ${who} sees exactly this version; later changes need approving again.`),
      approveBtn));
  }
  return wizardPage({ step: 'approve', week: w, student, title: 'Approve the lesson' }, ...body,
    wizardNav(backLink(stepHref(w.id, 'review'), 'Back to Review')));
}
