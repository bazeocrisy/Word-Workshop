// Photo import: choose photos → read them on this device → check the text beside each photo → add as drafts.
// Nothing here is ever approved automatically; every imported word lands in the week editor unchecked.
import { h, fill, page, btn, link, field, toast, progressBar, confirmDialog } from '../ui.js';
import * as store from '../store.js';
import { newVocabItem, newSpellingItem, weekLabel, nowIso } from '../model.js';
import { suggestGroups } from '../spelling.js';
import { parseVocabLines, parseSpellingLines, splitSections, splitPair, isHeading, stripMarker } from '../parse.js';
import { decode, toCanvas, canvasToBlob, checkFile, ImageError } from '../images.js';
import { go } from '../router.js';

const MAX_PAGES = 6;

export async function importView({ params }) {
  const week = await store.getWeek(params.wid);
  if (!week) return page({ title: 'Week not found', back: '#/parent' });
  const student = await store.getStudent(week.studentId);
  return new Importer(week, student).render();
}

/** Decide which lines are spelling and which are vocabulary. */
export function classifyLines(lines, target) {
  const s = splitSections(lines);
  if (target === 'spelling') return { spelling: lines, vocab: [], note: '' };
  if (target === 'vocab') return { spelling: [], vocab: lines, note: '' };
  if (s.spelling.length || s.vocab.length) {
    return { spelling: s.spelling, vocab: s.vocab, leftover: s.unknown, note: s.unknown.length ? 'Lines before the first "Spelling" or "Vocabulary" heading were left out.' : '' };
  }
  // No headings: lines that look like "word – definition" mean a vocabulary sheet.
  const body = lines.filter((l) => !isHeading(stripMarker(l.text).text));
  const paired = body.filter((l) => splitPair(stripMarker(l.text).text)).length;
  const vocab = body.length && paired / body.length >= 0.4;
  return vocab ? { spelling: [], vocab: lines, note: 'This looks like a vocabulary sheet.' } : { spelling: lines, vocab: [], note: 'This looks like a spelling list.' };
}

class Importer {
  constructor(week, student) { this.w = week; this.student = student; this.pages = []; }

  render() {
    this.body = h('div', { class: 'import' });
    this.root = page({ title: 'Upload photos', back: `#/parent/week/${this.w.id}`, backLabel: 'Back to the week', cls: 'parent',
      subtitle: `${weekLabel(this.w)} · ${this.student?.displayName || ''}` }, this.body);
    this.choose();
    return this.root;
  }

  // ── Step 1: choose photos ──
  choose() {
    const input = h('input', { type: 'file', accept: 'image/*', multiple: true, id: 'photo-input', class: 'sr-only' });
    input.addEventListener('change', () => this.addFiles([...input.files]));
    this.target = this.target || 'auto';
    const target = h('select', { id: 'import-target' },
      h('option', { value: 'auto', selected: this.target === 'auto' }, 'Let the app decide (uses headings like "Spelling" and "Vocabulary")'),
      h('option', { value: 'spelling', selected: this.target === 'spelling' }, 'Only spelling words'),
      h('option', { value: 'vocab', selected: this.target === 'vocab' }, 'Only vocabulary words and definitions'));
    target.addEventListener('change', () => { this.target = target.value; });
    this.thumbs = h('div', { class: 'thumbs' });
    this.errors = h('div', { 'aria-live': 'polite' });
    fill(this.body,
      h('section', { class: 'card' },
        h('h2', null, '1. Choose photos or screenshots'),
        h('p', { class: 'hint' }, `Up to ${MAX_PAGES} pages (JPEG, PNG or other common picture types). Take the photo straight on, in good light, with the whole list in view. The photos stay on this device.`),
        h('div', { class: 'row' }, btn('📷 Choose photos', () => input.click(), 'btn-primary btn-big'), input),
        this.errors, this.thumbs,
        field('What is on these pages?', target)),
      h('section', { class: 'card' },
        h('h2', null, '2. Read the words'),
        this.readBtn = btn('Read the photos', () => this.readAll(), 'btn-primary btn-big read-btn', { disabled: !this.pages.length }),
        h('p', { class: 'hint' }, 'The first time, the photo reader downloads about 7 MB from this site. After that the browser keeps a copy, so it starts faster.')),
      h('details', { class: 'card tip' }, h('summary', null, 'Tip: the quickest way on iPhone or iPad'),
        h('p', null, 'In the Photos app, press and hold the text in the photo, choose "Select All" and "Copy". Then go back to the week, choose "Paste or type a list" and paste. Your phone\'s own text reader is often more accurate than the one in this app.'),
        link('Back to the week', `#/parent/week/${this.w.id}`, 'btn btn-ghost btn-small')));
    this.drawThumbs();
  }

  async addFiles(files) {
    const errs = [];
    for (const f of files) {
      if (this.pages.length >= MAX_PAGES) { errs.push(`Only ${MAX_PAGES} pages at a time. ${f.name} was not added.`); continue; }
      try {
        checkFile(f);
        const bmp = await decode(f);
        const canvas = toCanvas(bmp, 2200);
        if (bmp.close) bmp.close();
        this.pages.push({ name: f.name || `Page ${this.pages.length + 1}`, canvas, rotate: 0 });
      } catch (e) { errs.push(e instanceof ImageError ? e.message : `${f.name} could not be opened.`); }
    }
    fill(this.errors, errs.length ? h('div', { class: 'notice notice-error card', role: 'alert' }, h('ul', null, errs.map((e) => h('li', null, e)))) : null);
    this.drawThumbs();
  }

  pageCanvas(p) { return p.rotate ? toCanvas(p.canvas, 2200, p.rotate) : p.canvas; }

  drawThumbs() {
    if (this.readBtn) this.readBtn.disabled = !this.pages.length;
    fill(this.thumbs, this.pages.map((p, i) => {
      const c = this.pageCanvas(p);
      const img = h('img', { src: c.toDataURL('image/jpeg', 0.6), alt: `Page ${i + 1}: ${p.name}` });
      return h('figure', { class: 'thumb-page' }, img, h('figcaption', null, `Page ${i + 1}`),
        h('div', { class: 'row' },
          btn('↺', () => { p.rotate = (p.rotate + 270) % 360; this.drawThumbs(); }, 'btn-ghost btn-small', { 'aria-label': `Turn page ${i + 1} left` }),
          btn('↻', () => { p.rotate = (p.rotate + 90) % 360; this.drawThumbs(); }, 'btn-ghost btn-small', { 'aria-label': `Turn page ${i + 1} right` }),
          btn('Remove', () => { this.pages.splice(i, 1); this.drawThumbs(); }, 'btn-ghost btn-small', { 'aria-label': `Remove page ${i + 1}` })));
    }));
  }

  // ── Step 2: read ──
  async readAll() {
    const status = h('p', { class: 'ocr-status', 'aria-live': 'polite' }, 'Getting the photo reader ready…');
    const bar = h('div');
    const setProgress = (done, total, label) => { fill(bar, progressBar(done, total, label)); status.textContent = label; };
    fill(this.body, h('section', { class: 'card' }, h('h2', null, 'Reading the photos…'), status, bar, h('p', { class: 'hint' }, 'This can take up to a minute per page on a phone. Keep this screen open.')));
    let ocr;
    try { ocr = await import('../ocr.js'); } catch { this.failed('The photo reader could not be loaded.'); return; }
    const results = [];
    for (let i = 0; i < this.pages.length; i++) {
      const p = this.pages[i];
      const base = i / this.pages.length;
      try {
        const res = await ocr.readPage(this.pageCanvas(p), {
          onProgress: (m) => {
            if (m.status === 'recognizing text') setProgress(Math.round((base + m.progress / this.pages.length) * 100), 100, `Reading page ${i + 1} of ${this.pages.length}… ${Math.round(m.progress * 100)}%`);
            else if (/loading|initializ/.test(m.status || '')) setProgress(Math.round(base * 100), 100, `Getting the photo reader ready (page ${i + 1} of ${this.pages.length})…`);
          },
        });
        results.push({ page: p, ...res });
      } catch (e) {
        console.warn(e);
        this.failed(navigator.onLine === false
          ? 'The photo reader needs an internet connection the first time it is used. Connect and try again, or type or paste the words instead.'
          : 'The photo reader stopped with an error. Try again, try a smaller or clearer photo, or type or paste the words instead.');
        return;
      }
    }
    this.results = results;
    this.reviewStep();
  }

  failed(message) {
    fill(this.body, h('div', { class: 'card notice notice-error', role: 'alert' }, h('p', null, message),
      h('div', { class: 'row' }, btn('Try again', () => this.choose(), 'btn-primary'), link('Type or paste instead', `#/parent/week/${this.w.id}`, 'btn btn-ghost'))));
  }

  // ── Step 3: check the text beside each photo, then add as drafts ──
  reviewStep() {
    const allLines = this.results.flatMap((r) => r.lines);
    this.confMap = new Map(allLines.map((l) => [l.text.trim(), l.conf]));
    const totalWords = allLines.reduce((n, l) => n + l.text.split(/\s+/).filter(Boolean).length, 0);
    const cls = classifyLines(allLines, this.target);
    const unsure = allLines.flatMap((l) => l.unsure || []);
    const spText = h('textarea', { rows: 10, id: 'ocr-spelling', class: 'ocr-text' }, cls.spelling.map((l) => l.text).join('\n'));
    const voText = h('textarea', { rows: 12, id: 'ocr-vocab', class: 'ocr-text' }, cls.vocab.map((l) => l.text).join('\n'));
    const replace = h('input', { type: 'checkbox' });
    const preview = h('div', { class: 'paste-preview', 'aria-live': 'polite' });
    const update = () => {
      const r = this.parse(spText.value, voText.value);
      fill(preview,
        h('p', null, h('strong', null, `${r.sp.words.length} spelling words: `), r.sp.words.map((w) => w.word).join(', ') || '—'),
        ...r.sp.notes.map((n) => h('p', { class: 'warn-text' }, n)),
        h('p', null, h('strong', null, `${r.vo.rows.length} vocabulary words: `), r.vo.rows.map((x) => x.word + (x.definition ? '' : ' (no definition)')).join(', ') || '—'),
        [...r.sp.ignored, ...r.vo.ignored].length ? h('p', { class: 'hint' }, h('strong', null, 'Left out (headings or notes): '), [...r.sp.ignored, ...r.vo.ignored].join(' · ')) : null);
    };
    spText.addEventListener('input', update); voText.addEventListener('input', update);
    const photos = this.results.map((r, i) => {
      const url = this.pageCanvas(r.page).toDataURL('image/jpeg', 0.8);
      return h('figure', { class: 'ocr-photo' }, h('a', { href: url, target: '_blank', rel: 'noopener', 'aria-label': `Open page ${i + 1} full size` }, h('img', { src: url, alt: `Page ${i + 1} as uploaded` })),
        h('figcaption', null, `Page ${i + 1} · reader confidence ${r.confidence}%`));
    });
    const nothing = totalWords === 0;
    fill(this.body,
      nothing ? h('div', { class: 'card notice notice-error', role: 'alert' },
        h('p', null, h('strong', null, 'No words were found in these photos.')),
        h('p', null, 'Try a clearer photo taken straight on in good light, turn the page the right way up, or type or paste the words.'),
        h('div', { class: 'row' }, btn('Try other photos', () => { this.pages = []; this.choose(); }, 'btn-primary'), link('Type or paste instead', `#/parent/week/${this.w.id}`, 'btn btn-ghost'))) : null,
      h('div', { class: 'card notice notice-warn' },
        h('p', null, h('strong', null, 'Check the text against the photo. '), 'The photo reader makes mistakes, especially with shadows, slanted photos and handwriting. Fix anything here, or later in the week editor. Nothing is shown to students until you approve the week.'),
        cls.note ? h('p', null, cls.note) : null,
        unsure.length ? h('p', null, h('strong', null, 'The reader was unsure about: '), unsure.slice(0, 30).map((u) => `"${u.text}" (${u.conf}%)`).join(', ')) : null),
      h('div', { class: 'ocr-layout' },
        h('div', { class: 'ocr-photos' }, photos),
        h('div', { class: 'ocr-texts' },
          field('Spelling words (one per line, or as on the page)', spText),
          field('Vocabulary (word – definition, as on the page)', voText, 'Move lines between the boxes if the app put them in the wrong place. Delete lines that are not words.'),
          preview,
          h('label', { class: 'check' }, replace, h('span', null, 'Replace the words already in this week (instead of adding to them)')),
          h('div', { class: 'row' },
            btn('Add to the week as drafts', () => this.commit(spText.value, voText.value, replace.checked), 'btn-primary btn-big commit-btn'),
            btn('Start over', () => { this.pages = []; this.choose(); }, 'btn-ghost')))));
    update();
    this.body.querySelector('h2, .notice')?.scrollIntoView?.({ block: 'start' });
  }

  linesOf(text) { return String(text).split('\n').map((t) => ({ text: t, conf: this.confMap.get(t.trim()) ?? null })); }

  parse(spText, voText) {
    return { sp: parseSpellingLines(this.linesOf(spText)), vo: parseVocabLines(this.linesOf(voText)) };
  }

  async commit(spText, voText, replace) {
    const r = this.parse(spText, voText);
    const sp = r.sp.words.filter((x) => x.word);
    const vo = r.vo.rows;
    if (!sp.length && !vo.length) { toast('There are no words to add.', 'error'); return; }
    if (replace && !(await confirmDialog('Replace existing words?', 'This removes the words already in this week and adds the ones from the photos.', 'Replace', true))) return;
    // Save the source pages first (async work happens before the week transaction).
    const sources = [];
    const rawText = this.results.map((x, i) => `--- Page ${i + 1} ---\n` + x.lines.map((l) => l.text).join('\n')).join('\n');
    for (const [i, res] of this.results.entries()) {
      const blob = await canvasToBlob(toCanvas(this.pageCanvas(res.page), 1800), 'image/jpeg', 0.82);
      const ref = await store.saveImage(blob, { kind: 'source', name: res.page.name });
      sources.push({ kind: 'photo', imageRef: ref, name: res.page.name || `Page ${i + 1}`, at: nowIso(), confidence: res.confidence, ocrText: res.lines.map((l) => l.text).join('\n') });
    }
    const spItems = sp.map((x) => { const it = newSpellingItem({ word: x.word, origin: 'ocr', ocrConfidence: x.conf }); it.groups = suggestGroups(x.word); return it; });
    const voItems = vo.map((x) => newVocabItem({ word: x.word, definition: x.definition, origin: 'ocr', ocrConfidence: x.conf, importedFlags: x.notes }));
    await store.editWeek(this.w.id, (w) => {
      if (replace) { if (spItems.length) w.spelling = []; if (voItems.length) w.vocab = []; }
      w.spelling.push(...spItems); w.vocab.push(...voItems);
      w.sources.push(...sources);
    }, { action: 'photos read', detail: `${sources.length} page(s): ${spItems.length} spelling, ${voItems.length} vocabulary added as drafts. Raw reader text kept with the source pages (${rawText.length} characters).` });
    toast(`Added ${spItems.length + voItems.length} words as drafts. Check each one against the photo.`);
    go(`#/parent/week/${this.w.id}`);
  }
}
