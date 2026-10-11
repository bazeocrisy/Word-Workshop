// The parent's lesson workspace: one screen with three stages, Add → Check → Finish.
//   Add:    student and school week at the top; Vocabulary and Spelling side by side, each with Upload (read on this
//           device, right here), Type or paste, and Add one word.
//   Check:  every word as an editable row beside the source photos. Words the reader was unsure about (or that have
//           another problem) are listed under "Needs attention"; the rest are confirmed per subject in one action.
//   Finish: a compact summary and one explicit approval, which goes through store.approveWeek (blockers and
//           definition-integrity checks re-run; immutable snapshot).
// Every change is saved immediately, and the stage reached is remembered so the parent can leave and come back.
import { h, fill, page, btn, link, toast, badge, dialog, alertDialog, confirmDialog, progressBar, emptyState } from '../ui.js';
import * as store from '../store.js';
import {
  newVocabItem, newSpellingItem, vocabFlags, spellingFlags, approvalBlockers, weekStatus, weekLabel, schoolWeekOf, nowIso, compareKey,
} from '../model.js';
import { suggestGroups } from '../spelling.js';
import { parseVocabText, parseSpellingText, splitPair, stripMarker } from '../parse.js';
import { Editor } from './weekEditor.js';
import { avatar, themeClass } from './common.js';
import { STAGES, stageKey, lessonHref } from './lessonSteps.js';
import { go } from '../router.js';

// Warnings about the example sentence are handled together (one "skip" per subject), not word by word.
const SENTENCE_CODES = new Set(['missing-sentence', 'sentence-missing-word']);
// Warnings that only describe how the photo reader read the text; the parent typing the text replaces them.
const READER_CODE = (code) => code === 'ocr-low-confidence' || code.startsWith('imported:');
const overlaps = (a, b) => a.startDate <= (b.endDate || b.startDate) && b.startDate <= (a.endDate || a.startDate);
const plusDays = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); const e = new Date(y, m - 1, d + n); return `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, '0')}-${String(e.getDate()).padStart(2, '0')}`; };
const label = (long, short) => h('span', null, h('span', { class: 'lbl-long' }, long), h('span', { class: 'lbl-short', 'aria-hidden': 'true' }, short));
const SUBJECT = { vocab: { name: 'Vocabulary', icon: '💡', other: 'spelling' }, spelling: { name: 'Spelling', icon: '🔤', other: 'vocab' } };

export async function lessonWorkspace({ params = {}, query = {} }) {
  const students = await store.listStudents();
  let week = null;
  if (params.wid) {
    week = await store.getWeek(params.wid);
    if (!week) return page({ title: 'Lesson not found', back: '#/parent', backLabel: 'Parent area' }, emptyState('This lesson no longer exists.', link('Create a lesson', '#/parent/new', 'btn btn-primary')));
  }
  if (!students.length) return page({ title: 'Create this week\'s lesson', back: '#/parent', backLabel: 'Parent area', cls: 'parent' }, emptyState('Add a student first.', link('Add a student in Settings', '#/parent/settings', 'btn btn-primary')));
  let stage = STAGES.includes(query.stage) ? query.stage : null;
  if (!stage && week) stage = await store.getMeta(stageKey(week.id));
  if (!STAGES.includes(stage)) stage = week && week.vocab.length + week.spelling.length ? 'check' : 'add';
  return new Workspace(week, students, stage, query).render();
}

class Workspace extends Editor {
  constructor(week, students, stage, query) {
    super(week || { id: '' }, null, []);
    this.w = week; this.students = students; this.stage = stage;
    this.student = week ? students.find((s) => s.id === week.studentId) : null;
    this.preselect = week ? week.studentId : (students.some((s) => s.id === query.student) ? query.student : students.length === 1 ? students[0].id : null);
    this.home = week ? lessonHref(week.id) : '#/parent/new';
    this.fresh = new Set(); // ids of words just added from a photo or a list (highlighted once)
    this.open = {}; // which add panels / row details are open
    this.pagesInMemory = new Map(); // source id → canvas read this session (for "read as a table")
  }

  titleText() { return this.w ? `${this.who}'s lesson · ${weekLabel(this.w)}` : 'Create this week\'s lesson'; }
  retitle() { const h1 = this.root?.querySelector('h1'); if (h1) h1.textContent = this.titleText(); document.title = `${this.titleText()} · Word Workshop`; }

  get who() { return this.student ? this.student.displayName : 'the student'; }
  get items() { return this.w ? [...this.w.vocab, ...this.w.spelling] : []; }

  // ── State helpers ──
  flagsOf(kind, it) { return (kind === 'vocab' ? vocabFlags : spellingFlags)(it, this.w).filter((f) => f.level === 'warning' && !f.acknowledged); }
  issues(kind, it) { return this.flagsOf(kind, it).filter((f) => !SENTENCE_CODES.has(f.code)); }
  status(kind, it) { return this.issues(kind, it).length ? 'attention' : it.reviewed ? 'checked' : 'tocheck'; }
  counts() {
    const c = { attention: [], tocheck: 0, checked: 0, noSentence: { vocab: [], spelling: [] } };
    for (const kind of ['vocab', 'spelling']) for (const it of this.list(kind)) {
      const s = this.status(kind, it);
      if (s === 'attention') c.attention.push({ kind, it }); else c[s]++;
      if (this.flagsOf(kind, it).some((f) => SENTENCE_CODES.has(f.code))) c.noSentence[kind].push(it);
    }
    return c;
  }
  list(kind) { return this.w ? (kind === 'vocab' ? this.w.vocab : this.w.spelling) : []; }

  // ── Saving ──
  save(log) {
    if (this.saveState) this.saveState.textContent = 'Saving…';
    const p = super.save(log);
    p.then(() => { if (this.saveState) this.saveState.textContent = 'Saved'; });
    return p;
  }
  refreshSummary() { this.drawTabs(); this.drawBar(); }

  /** Create the lesson the first time something is added (student and week must be chosen; one lesson per week). */
  async ensureWeek() {
    if (this.w) return true;
    const sid = this.root.querySelector('input[name=ws-student]:checked')?.value;
    const v = this.dates();
    const problem = !sid ? 'Choose who this lesson is for.' : !v.startDate ? 'Choose the school week.' : v.endDate < v.startDate ? 'The end date is before the start date.' : null;
    if (problem) { this.detailsMsg(problem); (sid ? this.root.querySelector('#ws-start') : this.root.querySelector('input[name=ws-student]'))?.focus(); return false; }
    if (await this.clash(sid, v)) return false;
    if (this.creating) return false;
    this.creating = true;
    try {
      this.w = await store.createWeek(sid, v);
      this.student = this.students.find((s) => s.id === sid);
      this.home = lessonHref(this.w.id);
      for (const k of ['vocab', 'spelling']) for (const which of ['one', 'paste']) {
        try {
          const old = `ww-ws:new:${k}:${which}`; const v = sessionStorage.getItem(old);
          if (v) sessionStorage.setItem(this.draftKey(k, which), v);
          sessionStorage.removeItem(old);
        } catch { /* ignore */ }
      }
      history.replaceState(null, '', `${this.home}?stage=${this.stage}`);
      await this.remember();
      this.drawDetails(); this.retitle();
      return true;
    } finally { this.creating = false; }
  }

  async clash(sid, v) {
    const other = (await store.listWeeks(sid)).find((w) => w.id !== this.w?.id && overlaps(w, v));
    if (!other) { this.detailsMsg(''); return false; }
    const st = this.students.find((s) => s.id === sid);
    this.detailsMsg(h('span', null, `${st.displayName} already has a lesson for ${weekLabel(other)}. `, link('Open that lesson', lessonHref(other.id), 'open-existing')));
    return true;
  }

  dates() {
    const start = this.root.querySelector('#ws-start')?.value || '';
    const end = this.root.querySelector('#ws-end')?.value || start;
    return { startDate: start, endDate: end || start, title: (this.root.querySelector('#ws-title')?.value || '').trim() };
  }

  detailsMsg(content) { if (this.detailsError) fill(this.detailsError, content || ''); }

  async remember() { if (this.w) { try { await store.setMeta(stageKey(this.w.id), this.stage); } catch { /* not essential */ } } }

  // ── Page ──
  render() {
    this.tabs = h('nav', { class: 'ws-tabs', 'aria-label': 'Lesson stages' });
    this.details = h('section', { class: 'ws-details', 'aria-label': 'Lesson details' });
    this.body = h('div', { class: 'ws-body' });
    this.saveState = h('span', { class: 'save-status', 'aria-live': 'polite' }, this.w ? 'Saved' : '');
    this.nextBtn = h('span');
    this.root = page({ title: this.titleText(), back: '#/parent', backLabel: 'Parent area', cls: 'parent workspace' },
      this.details, this.tabs, this.progressEl = h('div', { class: 'ws-progress', 'aria-live': 'polite' }), this.body,
      h('div', { class: 'ws-bar' }, this.saveState, this.photoBtn = h('span'), this.nextBtn));
    this.rendering = true;
    this.show(this.stage, { focus: false });
    this.rendering = false;
    return this.root;
  }

  /** Still the page on screen? (A photo can finish reading after the parent went elsewhere.) */
  onScreen() { return this.rendering || this.root.isConnected; }

  /** Save the field the parent is typing in (as leaving it would) and remember where they were. */
  async commitTyping() {
    const el = document.activeElement;
    if (!el || !this.root.contains(el) || !/^(INPUT|TEXTAREA)$/.test(el.tagName)) return null;
    const row = el.closest('[data-item]');
    const where = { id: row?.dataset.item, cls: [...el.classList].find((c) => c.startsWith('ws-')), id2: el.id, start: el.selectionStart, end: el.selectionEnd };
    el.dispatchEvent(new Event('change', { bubbles: true }));
    await this.queue;
    return where;
  }

  restoreTyping(where) {
    if (!where) return;
    const el = where.id ? this.root.querySelector(`[data-item="${where.id}"] .${where.cls}`) : where.id2 ? this.root.querySelector('#' + where.id2) : null;
    if (!el) return;
    el.focus({ preventScroll: true });
    try { el.setSelectionRange(where.start, where.end); } catch { /* not a text field */ }
  }

  async show(stage, { focus = true } = {}) {
    if (!this.onScreen()) return;
    this.stage = stage;
    if (this.w) { history.replaceState(null, '', `${this.home}?stage=${stage}`); this.remember(); }
    this.drawTabs(); this.drawDetails(); this.drawProgress();
    if (stage === 'add') this.drawAdd(); else if (stage === 'check') this.drawCheck(); else this.drawFinish();
    this.drawBar();
    if (focus) { window.scrollTo(0, 0); this.tabs.querySelector('[aria-current]')?.focus(); }
  }

  drawTabs() {
    if (!this.tabs) return;
    const c = this.w ? this.counts() : null;
    const n = this.items.length;
    const tab = (key, num, label, note) => h('button', { type: 'button', class: `ws-tab ${this.stage === key ? 'is-current' : ''}`, 'aria-current': this.stage === key ? 'step' : null, disabled: !this.w && key !== 'add',
      onclick: () => this.show(key) }, h('span', { class: 'ws-tab-num', 'aria-hidden': 'true' }, num), h('span', { class: 'ws-tab-label' }, label), note ? h('span', { class: 'ws-tab-note' }, note) : null);
    fill(this.tabs,
      tab('add', '1', 'Add', n ? `${n} word${n === 1 ? '' : 's'}` : null),
      tab('check', '2', 'Check', c && n ? (c.attention.length ? `${c.attention.length} need attention` : c.tocheck ? `${c.tocheck} to check` : 'All checked') : null),
      tab('finish', '3', 'Finish', this.w?.approvedVersion && weekStatus(this.w) === 'approved' ? 'Approved' : null));
  }

  drawBar() {
    const next = { add: ['Check the words ›', 'check'], check: ['Finish ›', 'finish'] }[this.stage];
    fill(this.nextBtn, next ? btn(next[0], async () => { if (!this.w && !(await this.ensureWeek())) return; await this.queue; this.show(next[1]); }, 'btn-primary ws-next', { disabled: !this.items.length && !!next }) : '');
    fill(this.photoBtn, this.stage === 'check' && this.sources().length ? btn('🖼 Photos', () => this.photoViewer(this.photoId), 'btn-ghost ws-photos-btn', { 'aria-label': 'View the worksheet photos' }) : '');
  }

  // ── Lesson details (student, week, name) ──
  drawDetails() {
    const w = this.w;
    // Outside Add, the details are one line (they cannot be forgotten: the lesson already exists).
    if (w && this.stage !== 'add') {
      this.detailsError = null;
      this.details.classList.add('is-compact');
      fill(this.details, h('p', { class: 'ws-details-line' }, this.student ? avatar(this.student) : null,
        h('strong', null, this.who), ` · ${weekLabel(w)}`, ' ', btn('Change', () => this.show('add'), 'btn-link ws-change-details')));
      return;
    }
    this.details.classList.remove('is-compact');
    const locked = !!w?.approvedVersion;
    const def = schoolWeekOf();
    this.detailsError = h('div', { class: 'form-error', role: 'alert' });
    const choices = this.students.map((s) => {
      const r = h('input', { type: 'radio', name: 'ws-student', value: s.id, checked: s.id === (w ? w.studentId : this.preselect), disabled: locked && s.id !== w.studentId });
      r.addEventListener('change', () => this.detailsChanged());
      return h('label', { class: `ws-student ${themeClass(s)}` }, r, avatar(s), h('span', { class: 'ws-student-name' }, s.displayName, s.grade ? h('span', { class: 'muted' }, ` · Grade ${s.grade}`) : null));
    });
    const start = h('input', { type: 'date', id: 'ws-start', value: w ? w.startDate : def.startDate });
    const end = h('input', { type: 'date', id: 'ws-end', value: w ? w.endDate : def.endDate });
    const title = h('input', { type: 'text', id: 'ws-title', maxlength: '60', value: w?.title || '', placeholder: 'Lesson name (optional)' });
    start.addEventListener('change', () => { if (start.value) end.value = plusDays(start.value, 4); this.detailsChanged(); });
    end.addEventListener('change', () => this.detailsChanged());
    title.addEventListener('change', () => this.detailsChanged());
    fill(this.details,
      h('fieldset', { class: 'ws-who' }, h('legend', null, 'Student'), h('div', { class: 'ws-students' }, choices)),
      h('div', { class: 'ws-when' },
        h('div', { class: 'field' }, h('label', { for: 'ws-start' }, 'Week starts'), start),
        h('div', { class: 'field' }, h('label', { for: 'ws-end' }, 'Ends'), end),
        h('div', { class: 'field ws-name' }, h('label', { for: 'ws-title' }, 'Lesson name'), title)),
      this.detailsError);
  }

  async detailsChanged() {
    if (!this.w) { const sid = this.root.querySelector('input[name=ws-student]:checked')?.value; if (sid) await this.clash(sid, this.dates()); return; }
    const sid = this.root.querySelector('input[name=ws-student]:checked')?.value || this.w.studentId;
    const v = this.dates();
    if (!v.startDate || v.endDate < v.startDate) { this.detailsMsg(!v.startDate ? 'Choose the school week.' : 'The end date is before the start date.'); return; }
    if (await this.clash(sid, v)) return;
    const changed = sid !== this.w.studentId || v.startDate !== this.w.startDate || v.endDate !== this.w.endDate || v.title !== (this.w.title || '');
    if (!changed) return;
    Object.assign(this.w, v);
    if (!this.w.approvedVersion) { this.w.studentId = sid; this.student = this.students.find((s) => s.id === sid); }
    this.queue = this.queue.then(() => store.editWeek(this.w.id, (x) => { Object.assign(x, v); if (!x.approvedVersion) x.studentId = sid; }, { action: 'details changed', detail: `${this.who} · ${v.startDate} – ${v.endDate}${v.title ? ' · ' + v.title : ''}` })
      .then((saved) => { this.w.revision = saved.revision; this.w.editLog = saved.editLog; }));
    if (this.saveState) this.saveState.textContent = 'Saving…';
    await this.queue;
    if (this.saveState) this.saveState.textContent = 'Saved';
    this.retitle();
  }

  // ── Stage 1: Add ──
  drawAdd() {
    fill(this.body,
      h('div', { class: 'ws-subjects' }, this.addCard('vocab'), this.addCard('spelling')),
      h('div', { class: 'ws-combined' }, this.uploadButton('auto', '📷 One photo with both lists? Upload it here', 'btn-ghost btn-small upload-both')));
  }

  uploadButton(target, text, cls, short) {
    const input = h('input', { type: 'file', accept: 'image/*', multiple: true, class: 'sr-only', tabindex: '-1', 'aria-hidden': 'true', dataset: { target } });
    input.addEventListener('change', () => { const files = [...input.files]; input.value = ''; if (files.length) this.importPhotos(files, target); });
    return h('span', { class: 'upload-wrap' }, btn(short ? label(text, short) : text, () => input.click(), `${cls} upload-btn upload-${target}`, short ? { 'aria-label': text.replace(/^\S+ /, '') } : {}), input);
  }

  addCard(kind) {
    const S = SUBJECT[kind];
    const n = this.list(kind).length;
    const panel = h('div', { class: 'ws-panel' });
    const card = h('section', { class: `card ws-subject ws-subject-${kind}`, 'aria-labelledby': `ws-h-${kind}` },
      h('h2', { id: `ws-h-${kind}` }, h('span', { 'aria-hidden': 'true' }, S.icon + ' '), S.name, ' ', h('span', { class: 'count-pill' }, String(n)), h('span', { class: 'sr-only' }, ' words')),
      h('div', { class: 'ws-actions' },
        this.uploadButton(kind, kind === 'vocab' ? '📷 Upload vocabulary worksheet' : '📷 Upload spelling worksheet or newsletter', 'btn-primary', '📷 Upload'),
        btn(label(kind === 'vocab' ? '📋 Type or paste vocabulary' : '📋 Type or paste spelling words', '📋 Paste'), () => this.togglePanel(kind, 'paste', panel), `btn-ghost paste-${kind}`, { 'aria-expanded': String(this.open[`${kind}:panel`] === 'paste'), 'aria-label': kind === 'vocab' ? 'Type or paste vocabulary' : 'Type or paste spelling words' }),
        btn(label('＋ Add one word', '＋ One word'), () => this.togglePanel(kind, 'one', panel), `btn-ghost add-one-${kind}`, { 'aria-expanded': String(this.open[`${kind}:panel`] === 'one'), 'aria-label': `Add one ${kind === 'vocab' ? 'vocabulary' : 'spelling'} word` })),
      panel,
      n ? h('p', { class: 'ws-sum' }, this.summaryLine(kind), ' ', btn('Check them ›', () => this.show('check'), 'btn-link')) : h('p', { class: 'hint' }, kind === 'vocab' ? 'No vocabulary yet. Leave this empty if there is none this week.' : 'No spelling words yet. Leave this empty if there are none this week.'));
    if (this.open[`${kind}:panel`]) this.drawPanel(kind, this.open[`${kind}:panel`], panel);
    return card;
  }

  summaryLine(kind) {
    const list = this.list(kind);
    const att = list.filter((it) => this.status(kind, it) === 'attention').length;
    return `${list.length} word${list.length === 1 ? '' : 's'}${att ? ` · ${att} need${att === 1 ? 's' : ''} attention` : ''}.`;
  }

  togglePanel(kind, which, panel) {
    this.open[`${kind}:panel`] = this.open[`${kind}:panel`] === which ? null : which;
    this.drawAdd();
    this.body.querySelector(`.ws-subject-${kind} .ws-panel input, .ws-subject-${kind} .ws-panel textarea`)?.focus();
  }

  draftKey(kind, which) { return `ww-ws:${this.w?.id || 'new'}:${kind}:${which}`; }
  readDraft(kind, which) { try { return JSON.parse(sessionStorage.getItem(this.draftKey(kind, which)) || '{}'); } catch { return {}; } }
  writeDraft(kind, which, v) { try { if (v) sessionStorage.setItem(this.draftKey(kind, which), JSON.stringify(v)); else sessionStorage.removeItem(this.draftKey(kind, which)); } catch { /* ignore */ } }

  drawPanel(kind, which, panel) {
    const vo = kind === 'vocab';
    const msg = h('p', { class: 'form-error', role: 'alert' });
    if (which === 'paste') {
      const saved = this.readDraft(kind, 'paste');
      const ta = h('textarea', { rows: 6, id: `ws-paste-${kind}`, class: 'ws-paste',
        placeholder: vo ? 'One word per line with its definition, e.g.\nProduce – Fresh fruits and vegetables' : 'One word per line, or separated by commas, e.g.\nrushed, blasted, washed' }, saved.text || '');
      const preview = h('p', { class: 'hint', 'aria-live': 'polite' });
      const parse = () => (vo ? parseVocabText(ta.value).rows : parseSpellingText(ta.value).words.filter((x) => x.word));
      const upd = () => { const r = parse(); preview.textContent = r.length ? `${r.length} word${r.length === 1 ? '' : 's'}: ${r.slice(0, 12).map((x) => x.word).join(', ')}${r.length > 12 ? '…' : ''}${vo && r.some((x) => !x.definition) ? ' (some have no definition yet)' : ''}` : ''; };
      ta.addEventListener('input', () => { this.writeDraft(kind, 'paste', { text: ta.value }); upd(); });
      const add = btn('Add these words', async () => {
        const rows = parse();
        if (!rows.length) { fill(msg, 'Type or paste at least one word.'); ta.focus(); return; }
        if (!(await this.ensureWeek())) return;
        const added = vo ? rows.map((x) => newVocabItem({ word: x.word, definition: x.definition, origin: 'pasted', importedFlags: x.notes }))
          : rows.map((x) => { const it = newSpellingItem({ word: x.word, origin: 'pasted' }); it.groups = suggestGroups(x.word); return it; });
        this.list(kind).push(...added);
        await this.save({ action: 'words added', detail: `pasted ${added.length} ${vo ? 'vocabulary' : 'spelling'}` });
        this.writeDraft(kind, 'paste', null);
        this.open[`${kind}:panel`] = null;
        added.forEach((it) => this.fresh.add(it.id));
        toast(`Added ${added.length} ${vo ? 'vocabulary' : 'spelling'} word${added.length === 1 ? '' : 's'}.`);
        this.drawAdd();
        this.body.querySelector(`.ws-subject-${kind} .paste-${kind}`)?.focus();
      }, `btn-primary ws-paste-add ws-paste-add-${kind}`);
      fill(panel, h('div', { class: 'ws-inline' },
        h('label', { for: `ws-paste-${kind}` }, vo ? 'Vocabulary words and the teacher\'s definitions' : 'Spelling words, in the teacher\'s order'),
        h('p', { class: 'hint' }, 'Tip: on a phone you can copy the text straight from a photo (press and hold it in Photos), then paste it here.'),
        ta, preview, msg, h('div', { class: 'row' }, add, btn('Cancel', () => { this.open[`${kind}:panel`] = null; this.drawAdd(); }, 'btn-ghost'))));
      upd();
      return;
    }
    const saved = this.readDraft(kind, 'one');
    const word = h('input', { type: 'text', id: `ws-one-word-${kind}`, autocomplete: 'off', spellcheck: 'false', autocapitalize: vo ? null : 'none', value: saved.word || '', class: 'ws-one-word' });
    const def = vo ? h('input', { type: 'text', id: `ws-one-def-${kind}`, autocomplete: 'off', value: saved.def || '', class: 'ws-one-def' }) : null;
    const keep = () => this.writeDraft(kind, 'one', word.value || def?.value ? { word: word.value, def: def?.value || '' } : null);
    word.addEventListener('input', keep); def?.addEventListener('input', keep);
    let adding = false;
    const form = h('form', { class: 'ws-inline ws-one', onsubmit: async (e) => {
      e.preventDefault();
      if (adding) return;
      const w = word.value.trim(), d = def ? def.value.trim() : '';
      if (!w) { fill(msg, 'Type the word first.'); word.focus(); return; }
      adding = true;
      try {
        if (!(await this.ensureWeek())) return;
        const it = vo ? newVocabItem({ word: w, definition: d, origin: 'typed' }) : Object.assign(newSpellingItem({ word: w }), { groups: suggestGroups(w) });
        it.reviewed = true; // typed by the parent: already checked by them
        this.list(kind).push(it);
        await this.save({ action: 'added', detail: `${vo ? 'vocabulary' : 'spelling'} "${w}" (typed)` });
        word.value = ''; if (def) def.value = ''; this.writeDraft(kind, 'one', null); fill(msg, '');
        toast(`Added "${w}".`);
        this.drawAdd();
        this.body.querySelector(`#ws-one-word-${kind}`)?.focus();
      } finally { adding = false; }
    } },
    h('div', { class: vo ? 'ws-one-grid' : 'ws-one-grid ws-one-grid-1' },
      h('div', { class: 'field' }, h('label', { for: `ws-one-word-${kind}` }, vo ? 'Word' : 'Spelling word'), word),
      vo ? h('div', { class: 'field' }, h('label', { for: `ws-one-def-${kind}` }, 'Definition, exactly as the teacher wrote it'), def) : null,
      h('button', { type: 'submit', class: `btn btn-primary ws-one-add ws-one-add-${kind}` }, 'Add')),
    msg);
    fill(panel, form);
  }

  // ── Photos: read right here, then show the words in Check ──
  async importPhotos(files, target) {
    if (!(await this.ensureWeek())) return;
    if (this.job && !this.job.error) { toast('Wait for the photo being read to finish.', 'error'); return; }
    const subject = { vocab: 'vocabulary worksheet', spelling: 'spelling worksheet', auto: 'worksheet' }[target];
    const job = this.job = { label: 'Opening the photo…', frac: 0, error: null, subject };
    const redraw = () => this.drawProgress();
    redraw();
    const { openPhotos, readPhoto, draftsFromReading, saveSource, readerError } = await import('../photoImport.js');
    const { pages, errors } = await openPhotos(files);
    if (!pages.length) { job.error = errors.join(' ') || 'That file could not be opened.'; redraw(); return; }
    const added = { vocab: [], spelling: [] };
    for (const [i, p] of pages.entries()) {
      let result;
      try {
        result = await readPhoto(p, { target, onProgress: (f, label) => { job.frac = (i + f) / pages.length; job.label = pages.length > 1 ? `Photo ${i + 1} of ${pages.length}: ${label}` : label; redraw(); } });
      } catch (e) { console.warn(e); job.error = readerError(e); redraw(); return; }
      const d = draftsFromReading(result, target);
      const src = await saveSource(p, result, { target, otherText: d.other, notes: d.notes });
      this.pagesInMemory.set(src.id, p.canvas);
      for (const it of [...d.voItems, ...d.spItems]) it.sourceId = src.id;
      added.vocab.push(...d.voItems); added.spelling.push(...d.spItems);
      // Through the same save queue as every other change, so nothing typed meanwhile is overwritten.
      this.w.vocab.push(...d.voItems); this.w.spelling.push(...d.spItems); this.w.sources.push(src);
      await this.save({ action: 'photo read', detail: `${p.name}: ${d.spItems.length} spelling, ${d.voItems.length} vocabulary added as drafts${d.other.length ? `; ${d.other.length} other line(s) kept for checking` : ''}${errors.length ? '; ' + errors.join(' ') : ''}` });
    }
    const n = added.vocab.length + added.spelling.length;
    if (!n) { job.error = 'No words were found in this photo. Try a clearer photo taken straight on, in good light, or type or paste the words.'; redraw(); return; }
    this.job = null;
    if (!this.onScreen()) return; // the words are saved; the parent will see them when they come back
    [...added.vocab, ...added.spelling].forEach((it) => this.fresh.add(it.id));
    const att = [...added.vocab.map((it) => this.status('vocab', it)), ...added.spelling.map((it) => this.status('spelling', it))].filter((x) => x === 'attention').length;
    this.done = `Read ${n} ${added.vocab.length && added.spelling.length ? '' : added.vocab.length ? 'vocabulary ' : 'spelling '}word${n === 1 ? '' : 's'} from the photo${att ? `; ${att} need${att === 1 ? 's' : ''} attention` : ''}. Compare them with the photo.`;
    const where = await this.commitTyping();
    this.focusKind = where ? null : added.vocab.length ? 'vocab' : 'spelling';
    await this.show('check', { focus: false });
    this.restoreTyping(where);
  }

  drawProgress() {
    const job = this.job;
    if (!job && this.done) { const msg = this.done; this.done = null; fill(this.progressEl, h('div', { class: 'card notice notice-ok ws-read-done', role: 'status' }, h('p', null, msg))); return; }
    if (!job) { fill(this.progressEl, ''); return; }
    if (job.error) { fill(this.progressEl, h('div', { class: 'card notice notice-error ws-read-error', role: 'alert' }, h('p', null, job.error), btn('OK', () => { this.job = null; this.drawProgress(); }, 'btn-ghost btn-small'))); return; }
    fill(this.progressEl, h('div', { class: 'card ws-reading' }, h('p', null, h('strong', null, `Reading the ${job.subject} on this device… `), job.label), progressBar(Math.round(job.frac * 100), 100, 'Reading the photo')));
  }

  // ── Stage 2: Check ──
  sources() { return (this.w?.sources || []).filter((s) => s.kind === 'photo' && s.imageRef); }

  drawCheck() {
    const c = this.counts();
    const srcs = this.sources();
    this.layoutEl = h('div', { class: `ws-check ${srcs.length ? 'has-photos' : ''}` },
      h('div', { class: 'ws-check-main' },
        c.attention.length ? this.attentionCard(c) : null,
        this.vocabSection = h('section', { class: 'card ws-table ws-table-vocab', 'aria-labelledby': 'ws-t-vocab' }),
        this.spellingSection = h('section', { class: 'card ws-table ws-table-spelling', 'aria-labelledby': 'ws-t-spelling' }),
        this.otherSection = h('div')),
      srcs.length ? (this.photosAside = h('aside', { class: 'ws-photos', 'aria-label': 'Worksheet photos' })) : null);
    fill(this.body, this.layoutEl);
    this.layoutEl.addEventListener('focusin', (e) => this.followRow(e));
    this.renderVocab(); this.renderSpelling(); this.drawOther();
    this.fresh.clear(); // highlighted once
    if (srcs.length) this.drawPhotos();
    if (this.focusKind) { const k = this.focusKind; this.focusKind = null; requestAnimationFrame(() => this.body.querySelector(`.ws-table-${k}`)?.scrollIntoView({ block: 'start' })); }
  }

  attentionCard(c) {
    return h('section', { class: 'card ws-attention', 'aria-labelledby': 'ws-att' },
      h('h2', { id: 'ws-att' }, `Needs attention (${c.attention.length})`),
      h('p', { class: 'hint' }, 'Compare these with the photo. Fix the word, or choose "Looks right".'),
      h('ul', { class: 'ws-att-list' }, c.attention.map(({ kind, it }) => h('li', null,
        btn(h('span', null, h('strong', null, it.word || '(no word)'), ` · ${SUBJECT[kind].name} · `, this.issues(kind, it)[0]?.message.split('. ')[0]), () => this.jumpTo(it.id), 'btn-link ws-att-link')))));
  }

  jumpTo(id) {
    const row = this.body.querySelector(`[data-item="${id}"]`);
    if (!row) return;
    row.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    row.querySelector('input, textarea')?.focus({ preventScroll: true });
  }

  // After any change in Check: redraw the summary pieces without losing the parent's place.
  refreshCheck(kind, id) {
    this.drawTabs(); this.drawBar();
    const c = this.counts();
    const att = this.body.querySelector('.ws-attention');
    const fresh = c.attention.length ? this.attentionCard(c) : null;
    if (att && fresh) att.replaceWith(fresh); else if (att) att.remove(); else if (fresh) this.body.querySelector('.ws-check-main')?.prepend(fresh);
    if (kind) {
      const row = this.body.querySelector(`[data-item="${id}"]`);
      const it = this.list(kind).find((x) => x.id === id);
      const el = document.activeElement;
      const inRow = row && row.contains(el) ? { cls: [...el.classList].find((c) => c.startsWith('ws-')), start: el.selectionStart, end: el.selectionEnd } : null;
      if (row && it) row.replaceWith(this.row(kind, it, this.list(kind).indexOf(it)));
      if (inRow?.cls) this.restoreTyping({ id, ...inRow });
      this.drawTableFoot(kind);
    }
  }

  renderVocab() { if (this.stage === 'check' && this.vocabSection) this.drawTable('vocab'); else if (this.stage === 'add') this.drawAdd(); }
  renderSpelling() { if (this.stage === 'check' && this.spellingSection) this.drawTable('spelling'); else if (this.stage === 'add') this.drawAdd(); }

  drawTable(kind) {
    const S = SUBJECT[kind];
    const vo = kind === 'vocab';
    const list = this.list(kind);
    const sec = vo ? this.vocabSection : this.spellingSection;
    const foot = h('div', { class: 'ws-foot', id: `ws-foot-${kind}` });
    fill(sec,
      h('div', { class: 'ws-table-head' },
        h('h2', { id: `ws-t-${kind}` }, h('span', { 'aria-hidden': 'true' }, S.icon + ' '), `${S.name} (${list.length})`),
        h('div', { class: 'ws-table-tools' },
          this.uploadButton(kind, vo ? '📷 Upload worksheet' : '📷 Upload worksheet', 'btn-ghost btn-small'),
          btn('＋ Add a word', () => this.addRow(kind), `btn-ghost btn-small ws-add-row ws-add-row-${kind}`))),
      list.length ? [
        h('div', { class: `ws-cols ws-cols-${kind}`, 'aria-hidden': 'true' }, h('span', null, '#'), h('span', null, vo ? 'Word' : 'Spelling word'), vo ? h('span', null, 'Teacher\'s exact definition') : null, h('span', null, 'Status'), h('span')),
        h('ol', { class: 'ws-rows', 'aria-label': `${S.name} words` }, list.map((it, i) => this.row(kind, it, i))),
      ] : h('p', { class: 'hint ws-empty' }, vo ? 'No vocabulary in this lesson.' : 'No spelling words in this lesson.', ' ', btn('Add words', () => this.show('add'), 'btn-link')),
      foot);
    this.drawTableFoot(kind);
  }

  drawTableFoot(kind) {
    const foot = this.body.querySelector(`#ws-foot-${kind}`);
    if (!foot) return;
    const vo = kind === 'vocab';
    const list = this.list(kind);
    if (!list.length) { fill(foot, ''); return; }
    const tocheck = list.filter((it) => this.status(kind, it) === 'tocheck');
    const att = list.filter((it) => this.status(kind, it) === 'attention').length;
    const noSentence = list.filter((it) => this.flagsOf(kind, it).some((f) => f.code === 'missing-sentence'));
    const withSentence = list.filter((it) => it.sentence.trim()).length;
    const pics = vo ? list.filter((it) => it.image).length : 0;
    fill(foot,
      h('div', { class: 'ws-confirm' },
        tocheck.length ? btn(`✓ I checked ${tocheck.length === list.length ? 'all' : 'the other'} ${tocheck.length} ${vo ? 'vocabulary words and definitions' : 'spelling words'} against the sheet`, () => this.confirmAll(kind), `btn-primary ws-confirm-${kind}`)
          : h('p', { class: att ? 'warn-text' : 'ok-text' }, att ? `${att} word${att === 1 ? '' : 's'} still need${att === 1 ? 's' : ''} attention (above).` : `All ${list.length} ${vo ? 'vocabulary' : 'spelling'} words are checked.`)),
      h('p', { class: 'ws-extras' },
        h('span', null, `Example sentences: ${withSentence} of ${list.length}`),
        vo ? h('span', null, ` · Pictures: ${pics} of ${list.length}`) : null,
        ' ', btn('Add sentences…', () => this.sentenceHelper(kind), 'btn-link'),
        noSentence.length ? [' ', btn(`Continue without sentences for ${noSentence.length}`, () => this.skipSentences(kind, noSentence), `btn-link ws-skip-${kind}`)] : null),
      noSentence.length ? h('p', { class: 'hint' }, vo ? 'Without a sentence, the fill-in-the-blank question skips that word; everything else works.' : 'Without a sentence, the spelling test says the word only.') : null);
  }

  row(kind, it, idx) {
    const vo = kind === 'vocab';
    const st = this.status(kind, it);
    const issues = this.issues(kind, it);
    const li = h('li', { class: `ws-row is-${st} ${this.fresh.has(it.id) ? 'is-new' : ''}`, dataset: { item: it.id } });
    const word = h('input', { type: 'text', value: it.word, class: 'ws-word', autocomplete: 'off', spellcheck: 'false', autocapitalize: vo ? null : 'none', 'aria-label': `${SUBJECT[kind].name} word ${idx + 1}` });
    word.addEventListener('change', () => this.editText(kind, it, 'word', word.value));
    const def = vo ? h('textarea', { rows: 1, class: 'ws-def', 'aria-label': `Teacher's definition of ${it.word || 'word ' + (idx + 1)}` }, it.sourceDefinition) : null;
    def?.addEventListener('change', () => this.editText(kind, it, 'definition', def.value));
    const statusCell = h('div', { class: 'ws-status' },
      st === 'attention' ? [
        badge('Needs attention', 'warn'),
        btn('Looks right', () => this.looksRight(kind, it), 'btn-ghost btn-small ws-looks-right', { 'aria-label': `${it.word}: looks right` })]
        : btn(st === 'checked' ? '✓ Checked' : 'To check', () => this.toggleChecked(kind, it), `ws-chip ${st === 'checked' ? 'is-on' : ''} ws-check-toggle`, { 'aria-pressed': String(st === 'checked'), 'aria-label': `${it.word}: ${st === 'checked' ? 'checked (press to undo)' : 'mark as checked'}` }));
    const more = this.rowMenu(kind, it, idx);
    const extras = this.rowExtras(kind, it);
    li.append(h('span', { class: 'ws-num', 'aria-hidden': 'true' }, String(idx + 1)), word);
    if (def) li.append(def);
    li.append(statusCell, more);
    if (st === 'attention') li.append(h('ul', { class: 'ws-issues' }, issues.map((f) => h('li', null, f.message))));
    li.append(extras);
    if (it.parentDefinition != null) def?.after(h('p', { class: 'hint ws-own' }, `Students see your wording: "${it.parentDefinition}"`));
    if (vo && it.origin === 'ocr' && it.originalTranscription && it.originalTranscription !== it.sourceDefinition) (def || word).after(h('p', { class: 'hint ws-orig' }, `Photo reader read: "${it.originalTranscription}"`));
    return li;
  }

  rowMenu(kind, it, idx) {
    const list = this.list(kind);
    const other = SUBJECT[kind].other;
    if (!Workspace.menuKeys) {
      Workspace.menuKeys = true;
      document.addEventListener('keydown', (e) => { if (e.key !== 'Escape') return; const m = document.querySelector('.ws-menu[open]'); if (m) { m.open = false; m.querySelector('summary').focus(); } });
      document.addEventListener('click', (e) => { document.querySelectorAll('.ws-menu[open]').forEach((m) => { if (!m.contains(e.target)) m.open = false; }); });
    }
    const d = h('details', { class: 'ws-menu' },
      h('summary', { 'aria-label': `More for ${it.word || 'this word'}` }, '⋯'),
      h('div', { class: 'ws-menu-list' },
        btn('Move up', () => this.move(kind, it, -1), 'btn-ghost btn-small', { disabled: idx === 0 }),
        btn('Move down', () => this.move(kind, it, 1), 'btn-ghost btn-small', { disabled: idx === list.length - 1 }),
        btn(`Move to ${SUBJECT[other].name}`, () => this.moveSubject(kind, it), 'btn-ghost btn-small ws-move-subject'),
        btn('Delete', () => this.remove(kind, it), 'btn-ghost btn-small ws-delete')));
    return d;
  }

  rowExtras(kind, it) {
    const vo = kind === 'vocab';
    const key = `x:${it.id}`;
    const sentenceState = it.sentence.trim() ? ({ generated: 'sample sentence: check it', pasted: 'pasted sentence: check it' }[it.sentenceSource] || 'sentence ✓') : 'no sentence';
    const pictureState = vo ? (it.image ? (it.image.kind === 'sample' ? 'sample picture' : 'picture ✓') : 'no picture') : null;
    const d = h('details', { class: 'ws-extra', open: !!this.open[key] }, h('summary', null, [sentenceState, pictureState].filter(Boolean).join(' · ')));
    d.addEventListener('toggle', () => {
      this.open[key] = d.open;
      if (d.open && d.children.length === 1) d.append(this.extrasBody(kind, it));
    });
    if (d.open) d.append(this.extrasBody(kind, it));
    return d;
  }

  extrasBody(kind, it) {
    const vo = kind === 'vocab';
    const sid = `ws-se-${it.id}`;
    const sentence = h('textarea', { rows: 2, id: sid }, it.sentence);
    sentence.addEventListener('change', async () => {
      it.sentence = sentence.value.trim(); it.sentenceSource = it.sentence ? 'parent' : null;
      await this.save({ action: 'edited', detail: `sentence for "${it.word}"` }); this.refreshCheck(kind, it.id);
    });
    const parts = [h('div', { class: 'field' }, h('label', { for: sid }, `Example sentence (uses "${it.word}" once)`), sentence)];
    if (vo) {
      const useOwn = h('input', { type: 'checkbox', checked: it.parentDefinition != null });
      const own = h('textarea', { rows: 2, id: `ws-pd-${it.id}`, hidden: it.parentDefinition == null }, it.parentDefinition || '');
      const saveOwn = async (to) => {
        const from = it.parentDefinition; if (from === to) return;
        it.parentDefinition = to; it.definitionLog.push({ field: 'parentDefinition', from, to, at: nowIso() });
        await this.save({ action: to == null ? 'parent wording removed' : 'parent wording set', detail: `"${it.word}"${to ? ': "' + to + '"' : ''}` }); this.refreshCheck(kind, it.id);
      };
      useOwn.addEventListener('change', () => { own.hidden = !useOwn.checked; if (useOwn.checked) own.focus(); else saveOwn(null); });
      own.addEventListener('change', () => saveOwn(own.value.trim() || null));
      parts.push(h('label', { class: 'check' }, useOwn, h('span', null, 'Show students my own wording (the teacher\'s definition is kept)')), own,
        this.pictureBlock(it, () => this.refreshCheck(kind, it.id)));
    }
    return h('div', { class: 'ws-extra-body' }, parts);
  }

  async sentenceHelper(kind) {
    const before = new Map(this.list(kind).map((it) => [it.id, it.reviewed]));
    await super.sentenceHelper(kind);
    let restored = 0;
    for (const it of this.list(kind)) if (before.get(it.id) && !it.reviewed) { it.reviewed = true; restored++; }
    if (restored) await this.save({ action: 'checked', detail: `${restored} words stay checked (only their example sentences were added)` });
    if (this.stage === 'check') { this.drawTable(kind); this.refreshCheck(); }
  }

  // ── Row actions ──
  async editText(kind, it, field, value) {
    const v = value.trim();
    if (field === 'word') {
      if (v === it.word) return;
      const before = it.word; it.word = v;
      if (kind === 'spelling' && (!it.groups || it.groups.source === 'auto')) it.groups = v ? suggestGroups(v) : null;
      // A spelling row is just the word, so typing it is checking it. A vocabulary row also has a definition the
      // reader may have misread: changing only the word does not check (or clear warnings about) the definition.
      if (kind === 'spelling') this.typedByParent(kind, it);
      await this.save({ action: 'edited', detail: `${kind === 'vocab' ? 'vocabulary' : 'spelling'} "${before}" → "${v}"` });
    } else {
      const from = it.sourceDefinition;
      if (from === v) return;
      it.sourceDefinition = v;
      it.definitionLog.push({ field: 'sourceDefinition', from, to: v, at: nowIso(), reason: 'Transcription corrected by parent' });
      this.typedByParent(kind, it);
      await this.save({ action: 'teacher definition corrected', detail: `"${it.word}": "${from}" → "${v}"` });
    }
    this.refreshCheck(kind, it.id);
  }

  /** The parent typed the row's text (spelling word, or vocabulary definition): it counts as checked, and the
   *  "how the photo reader read it" warnings no longer apply. Other warnings (duplicates, mismatch…) stay. */
  typedByParent(kind, it) {
    it.reviewed = true;
    const keys = this.flagsOf(kind, it).filter((f) => READER_CODE(f.code)).map((f) => f.key);
    it.ackKeys = [...new Set([...(it.ackKeys || []), ...keys])];
  }

  async looksRight(kind, it) {
    const keys = this.issues(kind, it).map((f) => f.key);
    it.ackKeys = [...new Set([...(it.ackKeys || []), ...keys])];
    it.reviewed = true;
    await this.save({ action: 'checked', detail: `"${it.word}" looks right (${keys.length} warning${keys.length === 1 ? '' : 's'} accepted)` });
    this.refreshCheck(kind, it.id);
    this.nextAttention(it.id);
  }

  nextAttention(afterId) {
    const rows = [...this.body.querySelectorAll('.ws-row.is-attention')];
    const next = rows.find((r) => r.dataset.item !== afterId);
    (next?.querySelector('input') || this.body.querySelector(`[data-item="${afterId}"] .ws-check-toggle`))?.focus();
  }

  async toggleChecked(kind, it) {
    it.reviewed = !it.reviewed;
    await this.save({ action: it.reviewed ? 'checked' : 'unchecked', detail: `"${it.word}"` });
    this.refreshCheck(kind, it.id);
    this.body.querySelector(`[data-item="${it.id}"] .ws-check-toggle`)?.focus();
  }

  async confirmAll(kind) {
    const list = this.list(kind).filter((it) => this.status(kind, it) === 'tocheck');
    list.forEach((it) => { it.reviewed = true; });
    await this.save({ action: 'checked', detail: `${list.length} ${kind === 'vocab' ? 'vocabulary' : 'spelling'} words confirmed against the sheet` });
    this.drawTable(kind); this.refreshCheck();
    this.body.querySelector(`#ws-foot-${kind} button, #ws-foot-${kind} p`)?.focus?.();
  }

  async skipSentences(kind, items) {
    for (const it of items) {
      const keys = this.flagsOf(kind, it).filter((f) => f.code === 'missing-sentence').map((f) => f.key);
      it.ackKeys = [...new Set([...(it.ackKeys || []), ...keys])];
    }
    await this.save({ action: 'warning acknowledged', detail: `continue without example sentences for ${items.length} ${kind === 'vocab' ? 'vocabulary' : 'spelling'} words` });
    if (this.stage === 'finish') this.drawFinish(); else { this.drawTableFoot(kind); this.refreshCheck(); }
  }

  async addRow(kind) {
    const it = kind === 'vocab' ? newVocabItem({ origin: 'typed' }) : newSpellingItem({ word: '' });
    it.reviewed = true;
    this.list(kind).push(it);
    await this.save({ action: 'added', detail: `${kind} word (typed)` });
    this.drawTable(kind); this.refreshCheck();
    this.body.querySelector(`[data-item="${it.id}"] .ws-word`)?.focus();
  }

  async move(kind, it, d) {
    const list = this.list(kind); const i = list.indexOf(it), j = i + d;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    await this.save({ action: 'reordered', detail: `${kind} "${it.word}" moved ${d < 0 ? 'up' : 'down'}` });
    this.drawTable(kind);
    this.body.querySelector(`[data-item="${it.id}"] .ws-word`)?.focus();
  }

  async moveSubject(kind, it) {
    const to = SUBJECT[kind].other;
    if (kind === 'vocab' && (it.sourceDefinition || '').trim()
      && !(await confirmDialog(`Move "${it.word}" to Spelling?`, `Spelling words have no definition, so "${it.sourceDefinition}" will not be used. It is kept, and comes back if you move the word back to Vocabulary.`, 'Move to Spelling'))) return;
    const from = this.list(kind);
    from.splice(from.indexOf(it), 1);
    let moved;
    if (to === 'spelling') {
      moved = newSpellingItem({ word: it.word, origin: it.origin, ocrConfidence: it.ocrConfidence, sentence: it.sentence, sentenceSource: it.sentenceSource });
      moved.groups = suggestGroups(it.word);
      // Everything about the vocabulary item is kept with it (definition, what the reader read, corrections, picture).
      moved.movedFrom = { vocab: JSON.parse(JSON.stringify(it)) };
    } else if (it.movedFrom?.vocab) {
      moved = { ...it.movedFrom.vocab, word: it.word, reviewed: false, ackKeys: [] };
    } else {
      const p = splitPair(stripMarker(it.word).text);
      moved = newVocabItem({ word: p ? p.word : it.word, definition: p ? p.definition : '', origin: it.origin, ocrConfidence: it.ocrConfidence, sentence: it.sentence, sentenceSource: it.sentenceSource });
    }
    moved.sourceId = it.sourceId;
    this.list(to).push(moved);
    await this.save({ action: 'moved', detail: `"${it.word}" moved from ${kind} to ${to}${kind === 'vocab' && it.sourceDefinition ? ` (definition kept: "${it.sourceDefinition}")` : ''}` });
    this.drawTable('vocab'); this.drawTable('spelling'); this.refreshCheck();
    toast(`"${it.word}" moved to ${SUBJECT[to].name}.`);
    this.body.querySelector(`[data-item="${moved.id}"] .ws-word`)?.focus();
  }

  async remove(kind, it) {
    const list = this.list(kind); const at = list.indexOf(it);
    list.splice(at, 1);
    await this.save({ action: 'deleted', detail: `${kind} "${it.word}"` });
    this.drawTable(kind); this.refreshCheck();
    toast(`Deleted "${it.word || 'word'}".`);
    const rows = this.body.querySelectorAll(`.ws-table-${kind} .ws-row .ws-word`);
    (rows[Math.min(at, rows.length - 1)] || this.body.querySelector(`.ws-add-row-${kind}`))?.focus();
  }

  // Lines the reader found that did not become words: recoverable, never silently thrown away.
  drawOther() {
    const srcs = this.sources().filter((s) => s.otherText?.length);
    if (!srcs.length) { fill(this.otherSection, ''); return; }
    const total = srcs.reduce((n, s) => n + s.otherText.length, 0);
    fill(this.otherSection, h('details', { class: 'card ws-other', open: !!this.open.other },
      h('summary', null, `Other text found in the photos (${total} line${total === 1 ? '' : 's'})`),
      h('p', { class: 'hint' }, 'Headings, notes and anything the reader could not place. If a real word is here, add it to the right list.'),
      srcs.map((s) => h('div', null, srcs.length > 1 ? h('h3', null, s.name) : null,
        h('ul', { class: 'ws-other-list' }, s.otherText.map((t) => h('li', null, h('span', { class: 'ws-other-text' }, t),
          h('span', { class: 'ws-other-actions' },
            btn('+ Vocabulary', () => this.recover('vocab', t, s), 'btn-ghost btn-small', { 'aria-label': `Add "${t}" to vocabulary` }),
            btn('+ Spelling', () => this.recover('spelling', t, s), 'btn-ghost btn-small', { 'aria-label': `Add "${t}" to spelling` })))))))));
    this.otherSection.firstChild.addEventListener('toggle', (e) => { this.open.other = e.target.open; });
  }

  async recover(kind, text, src) {
    const clean = stripMarker(text).text.trim();
    let it;
    if (kind === 'vocab') { const p = splitPair(clean); it = newVocabItem({ word: p ? p.word : clean, definition: p ? p.definition : '', origin: 'ocr' }); }
    else { it = newSpellingItem({ word: clean.split(/\s+/)[0] || clean, origin: 'ocr' }); it.groups = suggestGroups(it.word); }
    it.sourceId = src.id;
    this.list(kind).push(it);
    src.otherText = src.otherText.filter((t) => t !== text);
    await this.save({ action: 'added', detail: `"${it.word}" recovered from other text in ${src.name}` });
    this.fresh.add(it.id);
    this.drawTable(kind); this.drawOther(); this.refreshCheck();
    this.jumpTo(it.id);
  }

  // ── Source photos: beside the words on wide screens; a viewer on phones that keeps the parent's place ──
  async drawPhotos() {
    const srcs = this.sources();
    if (!srcs.length || !this.photosAside) return;
    if (!srcs.some((x) => x.id === this.photoId)) this.photoId = srcs[0].id;
    const cur = srcs.find((x) => x.id === this.photoId);
    const url = await store.imageUrl(cur.imageRef);
    const subject = (x) => ({ vocab: 'Vocabulary sheet', spelling: 'Spelling sheet' }[x.target] || 'Worksheet');
    fill(this.photosAside,
      h('div', { class: 'ws-photo-head' }, h('h2', { class: 'ws-photos-h' }, 'Worksheet photo'),
        srcs.length > 1 ? h('div', { class: 'ws-photo-pick', role: 'group', 'aria-label': 'Choose a photo' }, srcs.map((x) =>
          btn(subject(x), () => { this.photoId = x.id; this.drawPhotos(); }, `btn-small ${x.id === cur.id ? 'btn-primary' : 'btn-ghost'}`, { 'aria-pressed': String(x.id === cur.id) }))) : null),
      url ? h('button', { type: 'button', class: 'ws-photo-zoom', 'aria-label': `Enlarge the photo: ${cur.name}`, onclick: () => this.photoViewer(cur.id) }, h('img', { src: url, alt: `Worksheet photo: ${cur.name}` })) : h('p', { class: 'hint' }, 'This photo is no longer stored on this device.'),
      h('p', { class: 'ws-photo-cap' }, cur.name, cur.table ? ' · read as a table of cards' : '', ' · tap to enlarge'),
      cur.target !== 'spelling' ? btn(cur.table ? 'Read the cards again' : 'Words in a grid of cards? Read as a table', () => this.readAsTable(cur), 'btn-ghost btn-small ws-table-mode') : null);
  }

  /** Show the photo a row came from when the parent works on that row. */
  followRow(e) {
    const row = e.target.closest?.('[data-item]');
    if (!row) return;
    const it = [...(this.w?.vocab || []), ...(this.w?.spelling || [])].find((x) => x.id === row.dataset.item);
    if (it?.sourceId && it.sourceId !== this.photoId && this.sources().some((x) => x.id === it.sourceId)) { this.photoId = it.sourceId; this.drawPhotos(); }
  }

  async photoViewer(startId) {
    const figs = [];
    const srcs = this.sources();
    const order = startId ? [...srcs.filter((x) => x.id === startId), ...srcs.filter((x) => x.id !== startId)] : srcs;
    for (const x of order) {
      const url = await store.imageUrl(x.imageRef);
      if (!url) continue;
      const img = h('img', { src: url, alt: `Worksheet photo: ${x.name}` });
      const zoom = btn('Zoom in', () => { const on = fig.classList.toggle('is-zoomed'); zoom.textContent = on ? 'Zoom out' : 'Zoom in'; }, 'btn-ghost btn-small');
      const fig = h('figure', { class: 'ws-viewer-fig' }, h('div', { class: 'ws-viewer-scroll' }, img), h('figcaption', null, x.name, ' ', zoom));
      figs.push(fig);
    }
    await dialog({ title: 'Worksheet photos', body: h('div', { class: 'ws-viewer' }, figs), buttons: [], cancel: 'Close' });
  }

  /** Read a vocabulary photo again as a table of word cards; its words are replaced by the new reading. */
  async readAsTable(src) {
    const { markTableCorners } = await import('./importView.js');
    const { sourceCanvas, readPhoto, draftsFromReading, readerError } = await import('../photoImport.js');
    let canvas;
    try { canvas = this.pagesInMemory.get(src.id) || await sourceCanvas(src); } catch (e) { toast(e.message, 'error'); return; }
    const v = await markTableCorners(canvas, src.table || {}, `Worksheet photo: ${src.name}`, 'Read the cards');
    if (!v || v === 'remove') return;
    if (this.job && !this.job.error) { toast('Wait for the photo being read to finish.', 'error'); return; }
    const mine = this.w.vocab.filter((it) => it.sourceId === src.id);
    const changed = mine.filter((it) => it.reviewed || it.definitionLog.length).length;
    if (changed && !(await confirmDialog('Replace these words?', `Reading the photo again replaces its ${mine.length} vocabulary words, including ${changed} you already checked or corrected.`, 'Read again'))) return;
    const job = this.job = { label: 'Reading the word cards…', frac: 0, error: null, subject: 'vocabulary cards' };
    this.drawProgress();
    let result;
    try { result = await readPhoto({ canvas, corners: v.corners, cols: v.cols, rows: v.rows }, { target: 'vocab', onProgress: (f, label) => { job.frac = f; job.label = label; this.drawProgress(); } }); }
    catch (e) { console.warn(e); job.error = readerError(e); this.drawProgress(); return; }
    const d = draftsFromReading(result, 'vocab');
    if (!d.voItems.length) { job.error = 'No words were found. Check that the four handles are on the outside corners of the table, and the card counts are right.'; this.drawProgress(); return; }
    this.job = null; this.drawProgress();
    d.voItems.forEach((it) => { it.sourceId = src.id; this.fresh.add(it.id); });
    const firstAt = this.w.vocab.findIndex((it) => it.sourceId === src.id);
    this.w.vocab = this.w.vocab.filter((it) => it.sourceId !== src.id);
    this.w.vocab.splice(firstAt < 0 ? this.w.vocab.length : firstAt, 0, ...d.voItems);
    src.table = { corners: v.corners, cols: v.cols, rows: v.rows };
    src.otherText = d.other;
    await this.save({ action: 'photo read again as a table', detail: `${src.name}: ${mine.length} vocabulary replaced by ${d.voItems.length} from the cards` });
    if (!this.onScreen()) return;
    this.done = `Read ${d.voItems.length} word cards. Compare them with the photo.`;
    const where = await this.commitTyping();
    this.drawProgress(); this.drawCheck(); this.drawTabs(); this.drawBar();
    this.restoreTyping(where);
  }

  // ── Stage 3: Finish ──
  drawFinish() {
    if (!this.w) { this.show('add'); return; }
    const w = this.w;
    const c = this.counts();
    const st = weekStatus(w);
    const blockers = approvalBlockers(w);
    const all = this.items;
    const checked = all.filter((it) => it.reviewed).length;
    const noSent = c.noSentence.vocab.filter((it) => this.flagsOf('vocab', it).some((f) => f.code === 'missing-sentence')).length + c.noSentence.spelling.filter((it) => this.flagsOf('spelling', it).some((f) => f.code === 'missing-sentence')).length;
    const unresolved = c.attention.length + noSent; // what the parent can act on (unchecked words are shown separately)
    const dl = h('dl', { class: 'ws-summary' },
      [['Student', this.who], ['School week', weekLabel(w)], ['Vocabulary words', String(w.vocab.length)], ['Spelling words', String(w.spelling.length)],
        ['Checked', `${checked} of ${all.length}`], ['Unresolved issues', String(unresolved)]].map(([k, v]) => h('div', { class: k === 'Unresolved issues' ? (unresolved ? 'is-warn' : 'is-ok') : k === 'Checked' ? (checked === all.length ? 'is-ok' : 'is-warn') : '' }, h('dt', null, k), h('dd', null, v))));
    const todo = [];
    if (c.attention.length) todo.push(h('li', null, `${c.attention.length} word${c.attention.length === 1 ? '' : 's'} need${c.attention.length === 1 ? 's' : ''} attention. `, btn('Go to them', () => this.show('check'), 'btn-link fin-go-check')));
    if (c.tocheck) todo.push(h('li', null, `${c.tocheck} word${c.tocheck === 1 ? ' has' : 's have'} not been checked yet. `, btn('Check them', () => this.show('check'), 'btn-link fin-go-check')));
    if (noSent) todo.push(h('li', null, `${noSent} word${noSent === 1 ? ' has' : 's have'} no example sentence. `,
      btn('Continue without them', async () => { for (const k of ['vocab', 'spelling']) { const its = this.list(k).filter((it) => this.flagsOf(k, it).some((f) => f.code === 'missing-sentence')); if (its.length) await this.skipSentences(k, its); } }, 'btn-link fin-skip-sentences'),
      ' or ', btn('add sentences', () => this.show('check'), 'btn-link')));
    if (!all.length) todo.push(h('li', null, 'Add at least one word. ', btn('Add words', () => this.show('add'), 'btn-link')));
    const other = blockers.length && !todo.length ? h('ul', { class: 'blockers' }, blockers.slice(0, 8).map((b) => h('li', null, b))) : null;
    let action;
    if (st === 'approved') {
      action = h('div', { class: 'card notice notice-ok ws-approved' }, h('p', null, h('strong', null, `Approved (version ${w.approvedVersion}). `), `${this.who} can study this lesson.`),
        h('div', { class: 'row' }, link(`Open ${this.who}'s lesson`, `#/s/${w.studentId}/w/${w.id}`, 'btn btn-primary'), link('Parent area', '#/parent', 'btn btn-ghost')));
    } else if (blockers.length) {
      action = h('section', { class: 'card notice notice-warn', 'aria-labelledby': 'fin-todo' }, h('h2', { id: 'fin-todo' }, 'Before you approve'), h('ul', { class: 'ws-todo' }, todo), other);
    } else {
      const approve = btn(st === 'pending-changes' ? `Approve the changes for ${this.who}` : `Approve and give to ${this.who}`, async () => {
        approve.disabled = true;
        await this.queue;
        try {
          const done = await store.approveWeek(w.id);
          await store.setMeta(stageKey(w.id), null);
          toast(`Approved! ${this.who} can now study ${weekLabel(done)}.`);
          go(`#/s/${w.studentId}/w/${w.id}`);
        } catch (e) {
          approve.disabled = false;
          await alertDialog('Not approved yet', h('div', null, h('p', null, e.message), e.blockers ? h('ul', null, e.blockers.slice(0, 10).map((b) => h('li', null, b))) : null));
        }
      }, 'btn-primary btn-big approve-btn');
      action = h('section', { class: 'card ws-approve', 'aria-labelledby': 'fin-ok' }, h('h2', { id: 'fin-ok' }, 'Ready to approve'),
        h('p', null, `Every word has been checked against the teacher's sheets. ${this.who} will see exactly this version${st === 'pending-changes' ? ' (the earlier version stays until you approve)' : ''}; later changes need approving again.`),
        approve);
    }
    fill(this.body, h('div', { class: 'ws-finish' }, h('div', null, action, h('p', { class: 'hint ws-more' }, link('Spelling patterns, test order, history and more', `#/parent/week/${w.id}`, 'ws-more-link'))),
      h('section', { class: 'card', 'aria-labelledby': 'fin-sum' }, h('h2', { id: 'fin-sum' }, 'Summary'), dl)));
  }
}
