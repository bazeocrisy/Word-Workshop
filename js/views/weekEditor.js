// The one consolidated parent screen for a week: add words (photo / paste / type / sample), check every item,
// resolve warnings, and approve. Every change is saved immediately to the week's working copy.
import { h, append, fill, page, btn, link, field, dialog, toast, badge, confirmDialog, alertDialog, fmtDateTime } from '../ui.js';
import * as store from '../store.js';
import {
  newVocabItem, newSpellingItem, vocabFlags, spellingFlags, approvalBlockers, weekStatus, weekLabel, displayDefinition, nowIso,
} from '../model.js';
import { suggestGroups, SPELLING_GROUPS, SOUND_GROUPS } from '../spelling.js';
import { parseVocabText, parseSpellingText, splitSections, toLines, parseSentenceLines } from '../parse.js';
import { prepareForStorage, ImageError } from '../images.js';
import { statusBadge, confirmDeleteWeek } from './parent.js';
import { go } from '../router.js';

const clone = (x) => JSON.parse(JSON.stringify(x));

export async function weekEditor({ params }) {
  const week = await store.getWeek(params.wid);
  if (!week) return page({ title: 'Week not found', back: '#/parent', backLabel: 'Parent area' }, h('p', null, 'This week no longer exists.'));
  const student = await store.getStudent(week.studentId);
  const snapshots = await store.listSnapshots(week.id);
  return new Editor(week, student, snapshots).render();
}

function sourceBadge(it) {
  if (!it.sentence) return badge('No sentence', 'grey');
  if (it.sentenceSource === 'generated') return badge('Sample sentence — check it', 'info');
  if (it.sentenceSource === 'pasted') return badge('Pasted sentence', 'info');
  if (it.sentenceSource === 'ocr') return badge('From photo', 'info');
  return badge('Your sentence', 'grey');
}

const linesToText = (lines) => lines.map((l) => l.text).join('\n');

class Editor {
  constructor(week, student, snapshots) {
    this.w = week; this.student = student; this.snapshots = snapshots;
    this.queue = Promise.resolve();
  }

  get who() { return this.student ? this.student.displayName : 'The student'; }

  // ── Saving: the whole working copy is written in one transaction; saves run in order. ──
  save(log) {
    const data = clone({ vocab: this.w.vocab, spelling: this.w.spelling, settings: this.w.settings, title: this.w.title, focus: this.w.focus, startDate: this.w.startDate, endDate: this.w.endDate, sources: this.w.sources });
    this.queue = this.queue.then(async () => {
      try {
        const saved = await store.editWeek(this.w.id, (w) => { Object.assign(w, data); }, log);
        this.w.revision = saved.revision; this.w.editLog = saved.editLog;
      } catch (e) { toast('Could not save: ' + e.message, 'error'); }
      this.refreshSummary();
    });
    return this.queue;
  }

  render() {
    this.root = page({
      title: weekLabel(this.w), back: '#/parent', backLabel: 'Parent area', cls: 'parent editor',
      subtitle: `For ${this.who}${this.w.focus ? ' · Focus: ' + this.w.focus : ''}`,
      actions: [this.statusSlot = h('span', null, statusBadge(this.w)), btn('Edit details', () => this.editDetails(), 'btn-ghost btn-small')],
    },
    this.statusNotice = h('div', { 'aria-live': 'polite' }),
    this.addPanel(),
    this.layout = h('div', { class: 'editor-layout' },
      h('div', { class: 'editor-main' },
        this.spellingSection = h('section', { class: 'card', 'aria-labelledby': 'sec-sp' }),
        this.vocabSection = h('section', { class: 'card', 'aria-labelledby': 'sec-vo' })),
      this.sourcesAside = h('aside', { class: 'editor-sources', 'aria-label': 'Source pages' })),
    this.approvePanel = h('section', { class: 'card approve-panel', 'aria-labelledby': 'sec-ap' }),
    this.historyPanel = h('section', { class: 'card' }),
    h('div', { class: 'row' }, btn('Delete this week', () => confirmDeleteWeek(this.w.id), 'btn-ghost')));
    this.renderSpelling(); this.renderVocab(); this.renderSources(); this.refreshSummary(); this.renderHistory();
    return this.root;
  }

  // ── Status + approval ──
  refreshSummary() {
    const st = weekStatus(this.w);
    fill(this.statusSlot, statusBadge(this.w));
    const msg = {
      draft: ['', 'This week is empty. Add words with a photo, by pasting a list, or by typing them.'],
      'pending-review': ['notice-warn', `${this.who} cannot see this week yet. Check each word, then approve the week at the bottom of the page.`],
      approved: ['notice-ok', `Approved (version ${this.w.approvedVersion}). ${this.who} can study this week.`],
      'pending-changes': ['notice-warn', `You changed this week after approving it. ${this.who} still sees version ${this.w.approvedVersion} until you approve again.`],
    }[st];
    fill(this.statusNotice, h('div', { class: `card notice ${msg[0]}` }, h('p', null, msg[1])));
    const blockers = approvalBlockers(this.w);
    const all = [...this.w.vocab, ...this.w.spelling];
    const checked = all.filter((i) => i.reviewed).length;
    const approveBtn = btn(st === 'pending-changes' ? `Approve version ${this.w.approvedVersion + 1}` : 'Approve this week', () => this.approve(), 'btn-primary btn-big approve-btn', { disabled: blockers.length > 0 || st === 'approved' });
    fill(this.approvePanel, 
      h('h2', { id: 'sec-ap' }, 'Approve'),
      h('p', null, `${checked} of ${all.length} words checked.`),
      st === 'approved' ? h('p', { class: 'hint' }, 'Nothing has changed since the last approval.')
        : blockers.length ? h('div', null, h('p', { class: 'hint' }, 'Before you can approve:'), h('ul', { class: 'blockers' }, blockers.slice(0, 12).map((b) => h('li', null, b))), blockers.length > 12 ? h('p', { class: 'hint' }, `…and ${blockers.length - 12} more.`) : null)
          : h('p', { class: 'ok-text' }, 'Everything is checked. Approving makes this version available to the student.'),
      blockers.length && st !== 'approved' ? btn('Go to the next word to check', () => this.jumpToNext(), 'btn-ghost next-check') : null,
      approveBtn);
  }

  jumpToNext() {
    const cards = [...this.root.querySelectorAll('[data-item]')];
    const target = cards.find((c) => !c.classList.contains('is-reviewed') || c.querySelector('.flag-warn'));
    if (!target) return;
    target.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    (target.querySelector('.flag-warn .ack-box') || target.querySelector('.word-input'))?.focus({ preventScroll: true });
  }

  async approve() {
    await this.queue;
    try {
      const w = await store.approveWeek(this.w.id);
      toast(`Approved! Version ${w.approvedVersion} is ready for ${this.who}.`);
      go(`#/parent/week/${this.w.id}`);
    } catch (e) {
      await alertDialog('Not approved yet', h('div', null, h('p', null, e.message), e.blockers ? h('ul', null, e.blockers.slice(0, 10).map((b) => h('li', null, b))) : null));
    }
  }

  renderHistory() {
    const versions = this.snapshots.map((s) => h('li', null, `Version ${s.version} — approved ${fmtDateTime(s.approvedAt)} — ${s.spelling.length} spelling, ${s.vocab.length} vocabulary`));
    const log = [...(this.w.editLog || [])].reverse().slice(0, 60).map((e) => h('li', null, `${fmtDateTime(e.at)} — ${e.action}${e.detail ? ': ' + e.detail : ''}`));
    fill(this.historyPanel, 
      h('h2', null, 'Versions and history'),
      versions.length ? h('ul', null, versions) : h('p', { class: 'hint' }, 'Not approved yet.'),
      h('details', null, h('summary', null, 'Change history'), log.length ? h('ul', { class: 'log' }, log) : h('p', { class: 'hint' }, 'No changes yet.')));
  }

  // ── Adding content ──
  addPanel() {
    const empty = !this.w.vocab.length && !this.w.spelling.length;
    return h('section', { class: 'card add-panel', 'aria-labelledby': 'sec-add' },
      h('h2', { id: 'sec-add' }, 'Add words'),
      h('div', { class: 'add-grid' },
        link(h('span', null, h('span', { class: 'add-icon', 'aria-hidden': 'true' }, '📷'), ' Upload photos'), `#/parent/week/${this.w.id}/import`, 'btn btn-primary btn-big'),
        btn(h('span', null, h('span', { class: 'add-icon', 'aria-hidden': 'true' }, '📋'), ' Paste or type a list'), () => this.pasteDialog(), 'btn-ghost btn-big paste-btn'),
        empty ? btn(h('span', null, h('span', { class: 'add-icon', 'aria-hidden': 'true' }, '🧪'), ' Load the sample week'), () => this.loadSample(), 'btn-ghost btn-big sample-btn') : null),
      h('p', { class: 'hint' }, 'Photos are read on this device. Everything you add starts as a draft for you to check.'));
  }

  async loadSample() {
    const { sampleItems } = await import('../sample.js');
    try {
      const s = await sampleItems();
      this.w.vocab.push(...s.vocab); this.w.spelling.push(...s.spelling);
      if (!this.w.focus) this.w.focus = s.focus;
      this.w.sources.push(s.source);
      await this.save({ action: 'sample loaded', detail: `${s.spelling.length} spelling, ${s.vocab.length} vocabulary (unverified sample data)` });
      toast('Sample words added. Check each one before approving.');
      go(`#/parent/week/${this.w.id}`);
    } catch (e) { toast(e.message, 'error'); }
  }

  async pasteDialog() {
    const target = h('select', null, h('option', { value: 'spelling' }, 'Spelling words'), h('option', { value: 'vocab' }, 'Vocabulary words and definitions'), h('option', { value: 'both' }, 'Both (the text has "Spelling" and "Vocabulary" headings)'));
    const text = h('textarea', { rows: 9, placeholder: 'Spelling: one word per line, or separated by commas.\nVocabulary: Word - definition (one per line).' });
    const replace = h('input', { type: 'checkbox' });
    const preview = h('div', { class: 'paste-preview', 'aria-live': 'polite' });
    const doParse = () => {
      if (target.value === 'both') {
        const s = splitSections(toLines(text.value));
        return { sp: s.spelling.length ? parseSpellingText(linesToText(s.spelling)) : null, vo: s.vocab.length ? parseVocabText(linesToText(s.vocab)) : null };
      }
      return target.value === 'spelling' ? { sp: parseSpellingText(text.value) } : { vo: parseVocabText(text.value) };
    };
    const update = () => {
      const r = doParse();
      const parts = [];
      if (r.sp) parts.push(h('p', null, h('strong', null, `${r.sp.words.length} spelling words: `), r.sp.words.map((w) => w.word).join(', ') || '—'), ...r.sp.notes.map((n) => h('p', { class: 'warn-text' }, n)));
      if (r.vo) parts.push(h('p', null, h('strong', null, `${r.vo.rows.length} vocabulary words: `), r.vo.rows.map((x) => x.word + (x.definition ? '' : ' (no definition)')).join(', ') || '—'));
      const ign = [...(r.sp?.ignored || []), ...(r.vo?.ignored || [])];
      if (ign.length) parts.push(h('p', { class: 'hint' }, h('strong', null, 'Left out (headings or notes): '), ign.join(' · ')));
      if (target.value === 'both' && !r.sp && !r.vo) parts.push(h('p', { class: 'warn-text' }, 'No "Spelling" or "Vocabulary" headings found.'));
      fill(preview, ...parts);
    };
    text.addEventListener('input', update); target.addEventListener('change', update);
    const ok = await dialog({ title: 'Paste or type a list', body: h('div', null,
      field('What is in the text?', target), field('Words', text, 'Tip: on iPhone or iPad you can copy text straight from a photo (press and hold the text in Photos), then paste it here.'),
      h('label', { class: 'check' }, replace, h('span', null, 'Replace the words already in this week (instead of adding to them)')), preview),
    buttons: [{ label: 'Add words', value: true }] });
    if (!ok) return;
    const r = doParse();
    const addSp = (r.sp?.words || []).filter((x) => x.word);
    const addVo = r.vo?.rows || [];
    if (!addSp.length && !addVo.length) { toast('No words were found in the text.', 'error'); return; }
    if (replace.checked) {
      const what = [addSp.length ? `${this.w.spelling.length} spelling` : '', addVo.length ? `${this.w.vocab.length} vocabulary` : ''].filter(Boolean).join(' and ');
      if (!(await confirmDialog('Replace existing words?', `This removes the ${what} words already in this week.`, 'Replace', true))) return;
      if (addSp.length) this.w.spelling = [];
      if (addVo.length) this.w.vocab = [];
    }
    for (const x of addSp) { const it = newSpellingItem({ word: x.word, origin: 'pasted' }); it.groups = suggestGroups(x.word); this.w.spelling.push(it); }
    for (const x of addVo) this.w.vocab.push(newVocabItem({ word: x.word, definition: x.definition, origin: 'pasted', importedFlags: x.notes }));
    await this.save({ action: 'words added', detail: `pasted ${addSp.length} spelling, ${addVo.length} vocabulary${replace.checked ? ' (replaced)' : ''}` });
    this.renderSpelling(); this.renderVocab();
    toast(`Added ${addSp.length + addVo.length} words. Check each one.`);
  }

  async editDetails() {
    const start = h('input', { type: 'date', value: this.w.startDate || '' });
    const end = h('input', { type: 'date', value: this.w.endDate || '' });
    const title = h('input', { type: 'text', value: this.w.title || '', maxlength: '60' });
    const focus = h('input', { type: 'text', value: this.w.focus || '', maxlength: '60', placeholder: 'e.g. -ed endings' });
    const v = await dialog({ title: 'Week details', body: h('div', null, h('div', { class: 'two-col' }, field('Starts', start), field('Ends', end)), field('Name (optional)', title), field('Spelling focus (optional)', focus)),
      buttons: [{ label: 'Save', value: () => ({ startDate: start.value, endDate: end.value, title: title.value.trim(), focus: focus.value.trim() }) }] });
    if (!v) return;
    if (!v.startDate || (v.endDate && v.endDate < v.startDate)) { toast('Check the dates.', 'error'); return; }
    Object.assign(this.w, v);
    await this.save({ action: 'details changed', detail: `${v.startDate} – ${v.endDate}` });
    go(`#/parent/week/${this.w.id}`);
  }

  // ── Sentence helper: copy a request into any writing tool the parent already uses, paste the answer back ──
  async sentenceHelper(kind) {
    const items = kind === 'vocab' ? this.w.vocab : this.w.spelling;
    if (!items.length) return;
    const grade = this.student?.grade ? `grade ${this.student.grade}` : 'elementary school';
    const request = [`Write one short, friendly example sentence for a ${grade} student for each word below.`,
      'Use the exact word, spelled exactly as shown, once in each sentence. Use everyday situations a child knows.',
      'Answer with one line per word in the form  word: sentence', '',
      ...items.map((it) => (kind === 'vocab' ? `${it.word} (meaning: ${displayDefinition(it).text})` : it.word))].join('\n');
    const req = h('textarea', { rows: 6, readonly: true }, request);
    const answer = h('textarea', { rows: 6, placeholder: 'word: sentence' });
    const onlyEmpty = h('input', { type: 'checkbox', checked: true });
    const v = await dialog({ title: 'Add example sentences', body: h('div', null,
      h('p', { class: 'hint' }, 'You can type a sentence straight into each word below. Or copy this request into a writing helper you already use, then paste its answer here. Pasted sentences still need your check.'),
      field('Request to copy', req), btn('Copy request', async () => { try { await navigator.clipboard.writeText(request); toast('Copied.'); } catch { req.select(); toast('Select and copy the text.'); } }, 'btn-ghost btn-small'),
      field('Paste the sentences here', answer), h('label', { class: 'check' }, onlyEmpty, h('span', null, 'Only fill words that have no sentence yet'))),
    buttons: [{ label: 'Use these sentences', value: () => answer.value }] });
    if (!v) return;
    const { found, unmatched } = parseSentenceLines(v, items.map((i) => i.word));
    let n = 0;
    for (const it of items) {
      if (!found.has(it.word) || (onlyEmpty.checked && it.sentence.trim())) continue;
      it.sentence = found.get(it.word); it.sentenceSource = 'pasted'; it.reviewed = false; n++;
    }
    await this.save({ action: 'sentences added', detail: `${n} ${kind === 'vocab' ? 'vocabulary' : 'spelling'} sentences pasted` });
    if (kind === 'vocab') this.renderVocab(); else this.renderSpelling();
    toast(`${n} sentence${n === 1 ? '' : 's'} added.${unmatched.length ? ` ${unmatched.length} line(s) did not match a word.` : ''}`);
  }

  // ── Shared item pieces ──
  rerender(kind) { if (kind === 'vocab') this.renderVocab(); else this.renderSpelling(); }

  listControls(kind, it, idx, list) {
    const move = async (d) => {
      if (this.moving) return; // a quick double tap must not undo itself
      const i = list.indexOf(it), j = i + d;
      if (i < 0 || j < 0 || j >= list.length) return;
      this.moving = true;
      [list[i], list[j]] = [list[j], list[i]];
      await this.save({ action: 'reordered', detail: `${kind} "${it.word}" moved ${d < 0 ? 'up' : 'down'}` });
      this.rerender(kind);
      this.moving = false;
      const card = this.root.querySelector(`[data-item="${it.id}"]`);
      (card?.querySelector(`.mv-${d < 0 ? 'up' : 'down'}:not([disabled])`) || card?.querySelector('.word-input'))?.focus();
    };
    return h('div', { class: 'item-controls' },
      btn('↑', () => move(-1), 'btn-ghost btn-small mv-up', { 'aria-label': `Move ${it.word || 'word'} up`, disabled: idx === 0 }),
      btn('↓', () => move(1), 'btn-ghost btn-small mv-down', { 'aria-label': `Move ${it.word || 'word'} down`, disabled: idx === list.length - 1 }),
      btn('Delete', async () => {
        if (!(await confirmDialog('Delete word?', `Delete "${it.word || 'this word'}" from this week?`, 'Delete', true))) return;
        const at = list.indexOf(it);
        list.splice(at, 1);
        await this.save({ action: 'deleted', detail: `${kind} "${it.word}"` });
        this.rerender(kind);
        const section = kind === 'vocab' ? this.vocabSection : this.spellingSection;
        const inputs = section.querySelectorAll('[data-item] .word-input');
        (inputs[Math.min(at, inputs.length - 1)] || section.querySelector(kind === 'vocab' ? '.add-vo' : '.add-sp'))?.focus();
      }, 'btn-ghost btn-small del-btn', { 'aria-label': `Delete ${it.word || 'word'}` }));
  }

  flagsBlock(it, allFlags, refresh) {
    const flags = allFlags.filter((f) => f.code !== 'generated-sentence');
    if (!flags.length) return null;
    return h('ul', { class: 'flags' }, flags.map((f) => {
      if (f.level === 'info') return h('li', { class: 'flag flag-info' }, h('span', { 'aria-hidden': 'true' }, 'ℹ️ '), f.message);
      const cb = h('input', { type: 'checkbox', checked: f.acknowledged, class: 'ack-box', dataset: { key: f.key } });
      cb.addEventListener('change', async () => {
        const card = cb.closest('[data-item]');
        it.ackKeys = (it.ackKeys || []).filter((k) => k !== f.key);
        if (cb.checked) it.ackKeys.push(f.key);
        await this.save({ action: cb.checked ? 'warning acknowledged' : 'warning reopened', detail: `"${it.word}": ${f.message}` });
        refresh();
        [...(card?.querySelectorAll('.ack-box') || [])].find((x) => x.dataset.key === f.key)?.focus(); // keep keyboard place
      });
      return h('li', { class: `flag ${f.acknowledged ? 'flag-ack' : 'flag-warn'}` },
        h('span', { class: 'flag-msg' }, h('span', { 'aria-hidden': 'true' }, '⚠️ '), f.message),
        h('label', { class: 'check' }, cb, h('span', null, 'I checked this; keep it as it is')));
    }));
  }

  reviewedBox(it, refresh, label) {
    const cb = h('input', { type: 'checkbox', checked: it.reviewed, class: 'reviewed-box' });
    cb.addEventListener('change', async () => {
      const card = cb.closest('[data-item]');
      it.reviewed = cb.checked;
      await this.save({ action: cb.checked ? 'checked' : 'unchecked', detail: `"${it.word}"` });
      refresh();
      card?.querySelector('.reviewed-box')?.focus(); // keep keyboard place
    });
    return h('label', { class: 'check reviewed' }, cb, h('span', null, label));
  }

  // ── Spelling ──
  renderSpelling() {
    const list = this.w.spelling;
    const order = h('select', null, h('option', { value: 'random', selected: this.w.settings.spellingTestOrder !== 'teacher' }, 'Mixed-up order'), h('option', { value: 'teacher', selected: this.w.settings.spellingTestOrder === 'teacher' }, 'Teacher\'s order'));
    order.addEventListener('change', async () => { this.w.settings.spellingTestOrder = order.value; await this.save({ action: 'setting', detail: `spelling test order: ${order.value}` }); });
    fill(this.spellingSection, 
      h('div', { class: 'section-head' }, h('h2', { id: 'sec-sp' }, `Spelling (${list.length})`)),
      list.length ? h('ol', { class: 'items' }, list.map((it, i) => this.spellingCard(it, i, list))) : h('p', { class: 'hint' }, 'No spelling words yet.'),
      h('div', { class: 'row' },
        btn('+ Add a spelling word', async () => { const it = newSpellingItem({ word: '' }); list.push(it); await this.save({ action: 'added', detail: 'spelling word (typed)' }); this.renderSpelling(); this.root.querySelector(`[data-item="${it.id}"] input`)?.focus(); }, 'btn-ghost add-sp'),
        list.length ? btn('Add example sentences…', () => this.sentenceHelper('spelling'), 'btn-ghost') : null),
      list.length ? field('Spelling test order', order, 'Mixed-up order is recommended so students cannot rely on remembering the list order.') : null);
  }

  spellingCard(it, idx, list) {
    const li = h('li', { class: 'item', dataset: { item: it.id } });
    const flagsSlot = h('div');
    const reviewedSlot = h('div');
    const refresh = () => {
      fill(flagsSlot, this.flagsBlock(it, spellingFlags(it, this.w), refresh) || '');
      fill(reviewedSlot, this.reviewedBox(it, refresh, 'Checked against the list'));
      li.classList.toggle('is-reviewed', it.reviewed);
    };
    const word = h('input', { type: 'text', value: it.word, autocapitalize: 'none', autocomplete: 'off', spellcheck: 'false', class: 'word-input', 'aria-label': `Spelling word ${idx + 1}` });
    const groupsSlot = h('div');
    word.addEventListener('change', async () => {
      const before = it.word; it.word = word.value.trim(); it.reviewed = false;
      if (!it.groups || it.groups.source === 'auto') it.groups = it.word ? suggestGroups(it.word) : null;
      await this.save({ action: 'edited', detail: `spelling "${before}" → "${it.word}"` });
      fill(groupsSlot, this.groupEditors(it, refresh)); refresh();
    });
    const sid = `ss-${it.id}`;
    const sentence = h('textarea', { rows: 2, id: sid, class: 'sentence-input' }, it.sentence);
    const srcSlot = h('span', null, sourceBadge(it));
    sentence.addEventListener('change', async () => {
      it.sentence = sentence.value.trim(); it.sentenceSource = it.sentence ? 'parent' : null; it.reviewed = false;
      await this.save({ action: 'edited', detail: `sentence for "${it.word}"` }); fill(srcSlot, sourceBadge(it)); refresh();
    });
    groupsSlot.append(this.groupEditors(it, refresh));
    append(li, [
      h('div', { class: 'item-head' }, h('span', { class: 'item-num', 'aria-hidden': 'true' }, `${idx + 1}`), word, this.listControls('spelling', it, idx, list)),
      it.ocrConfidence != null ? h('p', { class: 'hint' }, `From photo · read as "${it.originalTranscription}" (${Math.round(it.ocrConfidence)}% sure)`) : null,
      h('div', { class: 'field' }, h('div', { class: 'label-row' }, h('label', { for: sid }, 'Example sentence'), srcSlot), sentence),
      groupsSlot, flagsSlot, reviewedSlot]);
    refresh();
    return li;
  }

  groupEditors(it, refresh) {
    if (!it.word) return '';
    const g = it.groups || suggestGroups(it.word);
    const isCustom = !!g.spelling?.key?.startsWith('custom:');
    const sp = h('select', { 'aria-label': `Spelling pattern for ${it.word}`, class: 'pattern-select' }, Object.entries(SPELLING_GROUPS).map(([k, v]) => h('option', { value: k, selected: g.spelling?.key === k }, v.label)),
      h('option', { value: 'custom', selected: isCustom }, 'My own pattern…'));
    const custom = h('input', { type: 'text', value: isCustom ? g.spelling.label : '', placeholder: 'e.g. Vowel team "ai"', 'aria-label': `Own pattern name for ${it.word}`, hidden: !isCustom });
    const snd = h('select', { 'aria-label': `Ending sound for ${it.word}`, class: 'sound-select' }, h('option', { value: '', selected: !g.sound }, 'No sound group'),
      Object.entries(SOUND_GROUPS).map(([k, v]) => h('option', { value: k, selected: g.sound?.key === k }, v.label)));
    const apply = async () => {
      custom.hidden = sp.value !== 'custom';
      if (sp.value === 'custom' && !custom.value.trim()) { custom.focus(); return; }
      const spelling = sp.value === 'custom' ? { key: 'custom:' + custom.value.trim().toLowerCase(), label: custom.value.trim(), reason: 'Pattern chosen by the parent.' }
        : { key: sp.value, label: SPELLING_GROUPS[sp.value].label, reason: sp.value === g.spelling?.key && g.spelling.reason ? g.spelling.reason : SPELLING_GROUPS[sp.value].explain };
      const sound = snd.value ? { key: snd.value, label: SOUND_GROUPS[snd.value].label, reason: snd.value === g.sound?.key && g.sound.reason ? g.sound.reason : SOUND_GROUPS[snd.value].explain } : null;
      it.groups = { spelling, sound, source: 'parent' }; it.reviewed = false;
      await this.save({ action: 'pattern changed', detail: `"${it.word}": ${spelling.label}${sound ? '; ' + sound.label : ''}` });
      refresh();
    };
    sp.addEventListener('change', apply); custom.addEventListener('change', apply); snd.addEventListener('change', apply);
    const summary = `Pattern: ${g.spelling?.label || '—'}${g.sound ? ' · ' + g.sound.label.replace('-ed sounds like ', '') : ''}`;
    return h('details', { class: 'groups' }, h('summary', null, summary, g.source === 'parent' ? '' : ' (suggested)'),
      h('div', { class: 'two-col' },
        h('div', { class: 'field' }, h('span', { class: 'label' }, 'Spelling pattern'), sp, custom, h('p', { class: 'hint' }, g.spelling?.reason || '')),
        h('div', { class: 'field' }, h('span', { class: 'label' }, 'Ending sound'), snd, h('p', { class: 'hint' }, g.sound?.reason || ''))),
      h('p', { class: 'hint' }, g.source === 'parent' ? 'Pattern set by you.' : 'Suggested by the app. Change it if it is wrong.'));
  }

  // ── Vocabulary ──
  renderVocab() {
    const list = this.w.vocab;
    fill(this.vocabSection, 
      h('div', { class: 'section-head' }, h('h2', { id: 'sec-vo' }, `Vocabulary (${list.length})`)),
      list.length ? h('ol', { class: 'items' }, list.map((it, i) => this.vocabCard(it, i, list))) : h('p', { class: 'hint' }, 'No vocabulary words yet.'),
      h('div', { class: 'row' },
        btn('+ Add a vocabulary word', async () => { const it = newVocabItem({ origin: 'typed' }); list.push(it); await this.save({ action: 'added', detail: 'vocabulary word (typed)' }); this.renderVocab(); this.root.querySelector(`[data-item="${it.id}"] input`)?.focus(); }, 'btn-ghost add-vo'),
        list.length ? btn('Add example sentences…', () => this.sentenceHelper('vocab'), 'btn-ghost') : null));
  }

  vocabCard(it, idx, list) {
    const li = h('li', { class: 'item', dataset: { item: it.id } });
    const flagsSlot = h('div');
    const reviewedSlot = h('div');
    const origSlot = h('div');
    const refresh = () => {
      fill(flagsSlot, this.flagsBlock(it, vocabFlags(it, this.w), refresh) || '');
      fill(reviewedSlot, this.reviewedBox(it, refresh, 'Checked against the teacher\'s sheet'));
      li.classList.toggle('is-reviewed', it.reviewed);
      fill(origSlot, it.sourceDefinition !== it.originalTranscription ? h('p', { class: 'hint' }, `First captured as: "${it.originalTranscription}"`) : '');
    };
    const uid = it.id;
    const word = h('input', { type: 'text', value: it.word, autocomplete: 'off', spellcheck: 'false', class: 'word-input', 'aria-label': `Vocabulary word ${idx + 1}` });
    word.addEventListener('change', async () => {
      const before = it.word; it.word = word.value.trim(); it.reviewed = false;
      await this.save({ action: 'edited', detail: `vocabulary "${before}" → "${it.word}"` }); refresh();
    });
    const teacher = h('textarea', { rows: 2, id: `td-${uid}`, class: 'teacher-def' }, it.sourceDefinition);
    teacher.addEventListener('change', async () => {
      const from = it.sourceDefinition, to = teacher.value.trim();
      if (from === to) return;
      it.sourceDefinition = to; it.reviewed = false;
      it.definitionLog.push({ field: 'sourceDefinition', from, to, at: nowIso(), reason: 'Transcription corrected by parent' });
      await this.save({ action: 'teacher definition corrected', detail: `"${it.word}": "${from}" → "${to}"` }); refresh();
    });
    const useOwn = h('input', { type: 'checkbox', checked: it.parentDefinition != null, class: 'own-box' });
    const own = h('textarea', { rows: 2, id: `pd-${uid}`, class: 'parent-def' }, it.parentDefinition || '');
    const ownWrap = h('div', { class: 'field', hidden: it.parentDefinition == null }, h('label', { for: `pd-${uid}` }, 'Your wording (students see it labelled "Parent-edited")'), own);
    const saveOwn = async (to) => {
      const from = it.parentDefinition;
      if (from === to) return;
      it.parentDefinition = to; it.reviewed = false;
      it.definitionLog.push({ field: 'parentDefinition', from, to, at: nowIso() });
      await this.save({ action: to == null ? 'parent wording removed' : 'parent wording set', detail: `"${it.word}"${to ? ': "' + to + '"' : ''}` }); refresh();
    };
    useOwn.addEventListener('change', () => {
      ownWrap.hidden = !useOwn.checked;
      if (useOwn.checked) own.focus(); else saveOwn(null);
    });
    own.addEventListener('change', () => saveOwn(own.value.trim() || null));
    const sentence = h('textarea', { rows: 2, id: `se-${uid}`, class: 'sentence-input' }, it.sentence);
    const srcSlot = h('span', null, sourceBadge(it));
    sentence.addEventListener('change', async () => {
      it.sentence = sentence.value.trim(); it.sentenceSource = it.sentence ? 'parent' : null; it.reviewed = false;
      await this.save({ action: 'edited', detail: `sentence for "${it.word}"` }); fill(srcSlot, sourceBadge(it)); refresh();
    });
    append(li, [
      h('div', { class: 'item-head' }, h('span', { class: 'item-num', 'aria-hidden': 'true' }, `${idx + 1}`), word, this.listControls('vocab', it, idx, list)),
      it.ocrConfidence != null ? h('p', { class: 'hint' }, `From photo (${Math.round(it.ocrConfidence)}% sure)`) : null,
      h('div', { class: 'field' }, h('label', { for: `td-${uid}` }, 'Teacher\'s definition — exactly as written on the sheet'), teacher,
        h('p', { class: 'hint' }, 'Only change this to fix a reading or typing mistake. Every change is recorded.'), origSlot),
      h('label', { class: 'check' }, useOwn, h('span', null, 'Show my own wording instead')), ownWrap,
      h('div', { class: 'field' }, h('div', { class: 'label-row' }, h('label', { for: `se-${uid}` }, 'Example sentence'), srcSlot), sentence),
      this.pictureBlock(it, refresh),
      flagsSlot, reviewedSlot]);
    refresh();
    return li;
  }

  pictureBlock(it, refresh) {
    const wrap = h('div', { class: 'picture-edit' });
    const altField = () => {
      const id = `alt-${it.id}`;
      const input = h('input', { type: 'text', id, class: 'alt-input', value: it.image.alt || '', maxlength: '120' });
      input.addEventListener('change', async () => {
        it.image = { ...it.image, alt: input.value.trim() || `Picture for ${it.word}` };
        await this.save({ action: 'picture description', detail: `"${it.word}": ${it.image.alt}` });
      });
      return h('div', { class: 'field' }, h('label', { for: id }, 'Describe the picture (read aloud by screen readers)'), input);
    };
    const draw = async () => {
      const url = it.image ? await store.imageUrl(it.image.ref) : null;
      const file = h('input', { type: 'file', accept: 'image/*', class: 'sr-only', id: `pic-${it.id}`, tabindex: '-1' });
      file.addEventListener('change', async () => {
        const f = file.files[0]; if (!f) return;
        try {
          const blob = await prepareForStorage(f, 1000);
          const ref = await store.saveImage(blob, { kind: 'upload', name: f.name });
          it.image = { ref, kind: 'upload', alt: `Picture for ${it.word}` }; it.reviewed = false;
          await this.save({ action: 'picture added', detail: `"${it.word}"` }); await draw(); refresh(); wrap.querySelector('.alt-input')?.focus();
        } catch (e) { toast(e instanceof ImageError ? e.message : 'That picture could not be used.', 'error'); }
      });
      fill(wrap, 
        h('span', { class: 'label' }, 'Picture'),
        h('div', { class: 'picture-row' },
          url ? h('img', { src: url, alt: it.image.alt || '', class: 'thumb' }) : h('div', { class: 'thumb thumb-empty' }, 'No picture'),
          h('div', null,
            h('p', { class: 'hint' }, it.image ? (it.image.kind === 'sample' ? 'Sample illustration that comes with the app. Check that it fits the meaning.' : 'Picture you added.') : 'Optional. Without one, students see a "picture coming soon" card.'),
            it.image && it.image.kind === 'upload' ? altField() : null,
            h('div', { class: 'row' },
              btn(it.image ? 'Change picture' : 'Add a picture', () => file.click(), 'btn-ghost btn-small'), file,
              it.image ? btn('Remove', async () => { it.image = null; it.reviewed = false; await this.save({ action: 'picture removed', detail: `"${it.word}"` }); await draw(); refresh(); wrap.querySelector('button')?.focus(); }, 'btn-ghost btn-small') : null,
              btn('Picture idea', () => this.copyPicturePrompt(it), 'btn-ghost btn-small')))));
    };
    draw();
    return wrap;
  }

  async copyPicturePrompt(it) {
    const { picturePrompt } = await import('../illustrations.js');
    const text = picturePrompt(it, this.student?.grade);
    const ta = h('textarea', { rows: 6, readonly: true }, text);
    await dialog({ title: `Picture idea for "${it.word}"`, body: h('div', null,
      h('p', { class: 'hint' }, 'Word Workshop does not make pictures itself. You can draw this, find a photo, or paste this description into a picture tool you already use, then choose "Add a picture".'), ta),
    buttons: [{ label: 'Copy', value: async () => { try { await navigator.clipboard.writeText(text); toast('Copied.'); } catch { toast('Select the text and copy it.'); } } }], cancel: 'Close' });
  }

  async renderSources() {
    const pages = (this.w.sources || []).filter((s) => s.kind === 'photo' && s.imageRef);
    this.layout.classList.toggle('has-sources', pages.length > 0);
    if (!pages.length) { fill(this.sourcesAside, ); return; }
    const figs = [];
    for (const p of pages) {
      const url = await store.imageUrl(p.imageRef);
      if (url) figs.push(h('figure', null, h('a', { href: url, target: '_blank', rel: 'noopener', 'aria-label': `Open ${p.name || 'source page'} full size` }, h('img', { src: url, alt: `Source page: ${p.name || 'photo'}` })), h('figcaption', null, p.name || 'Photo')));
    }
    fill(this.sourcesAside, h('details', { open: matchMedia('(min-width: 900px)').matches },
      h('summary', null, `Source pages (${figs.length})`), h('p', { class: 'hint' }, 'Compare each word with the original. Tap a page to open it full size.'), ...figs));
  }
}
