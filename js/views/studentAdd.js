// A child adds this week's words for one subject: Upload → Check Words → Start Learning.
// It is the lesson workspace (views/workspace.js) in student mode: one subject, no grown-up details or approval
// screen. Words go into the student's lesson for the current school week. "Start Learning" marks the words as
// checked and publishes them as the lesson the learning screens use (store.approveWeek: the same integrity checks
// and immutable version as before; the teacher's definitions are kept exactly).
import { h, fill, page, btn, link, toast, alertDialog, confirmDialog, emptyState } from '../ui.js';
import * as store from '../store.js';
import { vocabFlags, spellingFlags, schoolWeekOf, weekLabel } from '../model.js';
import { Workspace } from './workspace.js';
import { stageKey } from './lessonSteps.js';
import { requireStudent } from './common.js';
import { go } from '../router.js';

const NAME = { vocab: 'Vocabulary', spelling: 'Spelling' };
export const hubHref = (sid, subject) => `#/s/${sid}/${subject === 'vocab' ? 'vocab' : 'spelling'}`;
const overlaps = (a, b) => a.startDate <= (b.endDate || b.startDate) && b.startDate <= (a.endDate || a.startDate);

/** The student's lesson for the current school week (or null). */
export async function currentWeekLesson(sid) {
  const wk = schoolWeekOf();
  return (await store.listWeeks(sid)).find((w) => overlaps(w, wk)) || null;
}

export async function studentAdd({ params, query = {} }) {
  const st = await requireStudent(params.sid);
  const subject = params.subject === 'spelling' ? 'spelling' : params.subject === 'vocab' ? 'vocab' : null;
  if (!subject) return page({ title: 'Page not found', back: `#/s/${st.id}`, backLabel: 'Home' }, emptyState('That page does not exist.'));
  const week = await currentWeekLesson(st.id);
  const has = week && (subject === 'vocab' ? week.vocab : week.spelling).length;
  const stage = ['add', 'check', 'finish'].includes(query.stage) ? query.stage : has && week.approvedVersion == null ? 'check' : 'add';
  return new StudentWorkspace(week, [st], stage, st, subject).render();
}

class StudentWorkspace extends Workspace {
  constructor(week, students, stage, student, subject) {
    super(week, students, stage, { student: student.id });
    this.student = student; this.preselect = student.id; this.subject = subject;
    this.home = `#/s/${student.id}/add/${subject}`;
    this.hub = hubHref(student.id, subject);
  }

  titleText() { return this.subject === 'vocab' ? 'Add vocabulary words' : 'Add spelling words'; }
  retitle() { /* the title does not change in student mode */ }

  // Only this subject is shown here (the other subject has its own page).
  list(kind) { return kind === this.subject ? super.list(kind) : []; }

  render() {
    super.render();
    const back = this.root.querySelector('.back-link');
    if (back) { back.href = this.hub; back.lastChild.textContent = NAME[this.subject]; }
    this.root.classList.add('student-add', this.subject === 'vocab' ? 'area-vocab' : 'area-spelling');
    this.root.classList.remove('parent');
    return this.root;
  }

  /** The words go into this student's lesson for the current school week (created the first time). */
  async ensureWeek() {
    if (this.w) return true;
    if (this.creating) return false;
    this.creating = true;
    try {
      this.w = (await currentWeekLesson(this.student.id)) || await store.createWeek(this.student.id, { ...schoolWeekOf(), title: '' });
      await this.remember();
      return true;
    } finally { this.creating = false; }
  }

  drawDetails() {
    this.details.classList.add('is-compact');
    fill(this.details, h('p', { class: 'ws-details-line' }, h('strong', null, `${this.student.displayName}'s words`), ` · ${this.w ? weekLabel(this.w) : weekLabel(schoolWeekOf())}`));
  }

  drawTabs() {
    if (!this.tabs) return;
    super.drawTabs();
    const labels = { add: 'Upload', check: 'Check words', finish: 'Start learning' };
    this.tabs.querySelectorAll('.ws-tab').forEach((t, i) => { const l = t.querySelector('.ws-tab-label'); if (l) l.textContent = Object.values(labels)[i]; });
  }

  drawBar() {
    super.drawBar();
    const b = this.nextBtn.querySelector('button');
    if (b) b.textContent = this.stage === 'add' ? 'Check my words ›' : 'Start learning ›';
  }

  drawAdd() { fill(this.body, h('div', { class: 'ws-subjects ws-one-subject' }, this.addCard(this.subject))); }

  drawCheck() {
    super.drawCheck();
    const other = this.subject === 'vocab' ? this.spellingSection : this.vocabSection;
    if (other) other.hidden = true;
  }

  rowMenu(kind, it, idx) {
    const m = super.rowMenu(kind, it, idx);
    m.querySelector('.ws-move-subject')?.remove(); // the other subject is on its own page
    return m;
  }

  drawFinish() {
    if (!this.w) { this.show('add'); return; }
    const words = this.list(this.subject).filter((it) => it.word.trim());
    const c = this.counts();
    const flagged = c.attention.map(({ it }) => it.word).filter(Boolean);
    const start = btn(`Start learning ${words.length} word${words.length === 1 ? '' : 's'} ›`, () => this.startLearning(flagged), 'btn-primary btn-big start-learning', { disabled: !words.length });
    fill(this.body, h('section', { class: 'card ws-approve start-card' },
      h('h2', null, words.length ? 'Your words are ready!' : 'No words yet'),
      words.length ? h('p', { class: 'start-words' }, words.slice(0, 20).map((it) => h('span', { class: 'word-chip' }, it.word))) : h('p', null, 'Add some words first.'),
      flagged.length ? h('div', { class: 'card notice notice-warn' },
        h('p', null, h('strong', null, `Check ${flagged.length === 1 ? 'this word' : 'these words'} with your sheet: `), flagged.join(', ')),
        btn('Check them', () => this.show('check'), 'btn-ghost btn-small')) : null,
      start));
  }

  /** Publish the words for the learning screens. The student has looked at them; the teacher's text is unchanged. */
  async startLearning(flagged) {
    if (flagged.length && !(await confirmDialog('Start learning?', `${flagged.length} word${flagged.length === 1 ? ' was' : 's were'} marked to check. Did you compare ${flagged.length === 1 ? 'it' : 'them'} with your sheet?`, 'Yes, start learning'))) return;
    await this.queue;
    const w = this.w;
    w.vocab = w.vocab.filter((it) => it.word.trim());
    w.spelling = w.spelling.filter((it) => it.word.trim());
    for (const it of w.vocab) { it.reviewed = true; it.ackKeys = vocabFlags(it, w).filter((f) => f.level === 'warning').map((f) => f.key); }
    for (const it of w.spelling) { it.reviewed = true; it.ackKeys = spellingFlags(it, w).filter((f) => f.level === 'warning').map((f) => f.key); }
    await this.save({ action: 'checked by the student', detail: `${w.vocab.length} vocabulary, ${w.spelling.length} spelling` });
    try {
      await store.approveWeek(w.id);
      await store.setMeta(stageKey(w.id), null);
      toast('Your words are ready. Let\'s learn!');
      go(this.hub);
    } catch (e) {
      await alertDialog('Something needs fixing first', h('div', null, h('p', null, 'Please check your words again.'), e.blockers ? h('ul', null, e.blockers.slice(0, 6).map((b) => h('li', null, b))) : null));
    }
  }
}
