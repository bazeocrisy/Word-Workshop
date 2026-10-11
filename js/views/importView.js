// Photo import: choose photos → read them on this device → check the text beside each photo → add as drafts.
// Nothing here is ever approved automatically; every imported word lands in the week editor unchecked.
import { h, fill, page, btn, link, field, toast, progressBar, confirmDialog, dialog } from '../ui.js';
import * as store from '../store.js';
import { newVocabItem, newSpellingItem, weekLabel, nowIso, similarity, compareKey } from '../model.js';
import { suggestGroups } from '../spelling.js';
import { parseVocabLines, parseSpellingLines, splitSections, splitPair, isHeading, stripMarker } from '../parse.js';
import { decode, toCanvas, canvasToBlob, checkFile, ImageError } from '../images.js';
import { extractNumberedList, voteNumbered, pairCardGrid, vocabStart } from '../layout.js';
import { go } from '../router.js';

const MAX_PAGES = 6;

export async function importView({ params, query = {} }) {
  const week = await store.getWeek(params.wid);
  if (!week) return page({ title: 'Week not found', back: '#/parent' });
  const student = await store.getStudent(week.studentId);
  return new Importer(week, student, query).render();
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

/**
 * Turn the reader's lines (per page) into the starting text for the two review boxes.
 * 1. A numbered word list anywhere on the pages ("1. rings  9. boxes") is the spelling list, even when the
 *    spelling box sits beside another box on the same lines.
 * 2. After a "Vocabulary" heading, a grid of word cards is paired by column; otherwise lines are parsed as a list.
 * 3. If neither is found, fall back to headings / "word – definition" detection (classifyLines).
 * Returns { spText, voText, conf: Map(line → confidence), notes: [], rowNotes: Map(word key → notes) }.
 */
export function extractPages(pages, target) {
  const all = pages.flatMap((p) => p.lines);
  const conf = new Map();
  const notes = [];
  const rowNotes = new Map();
  const spRows = new Map(); // word key → { conf, notes } as the reader produced it
  let spText = null, voText = null;
  if (target !== 'vocab') {
    const list = voteNumbered([extractNumberedList(all), ...pages.flatMap((p) => (p.alternatives || []).map((alt) => extractNumberedList(alt)))]);
    if (list) {
      const lines = list.items.map((it) => { const t = `${it.number}. ${it.word}`; conf.set(t, it.conf); spRows.set(compareKey(it.word), { conf: it.conf, notes: it.notes || [] }); return t; });
      spText = lines.join('\n');
      notes.push(...list.notes);
      list.items.filter((it) => it.notes.length).forEach((it) => notes.push(`${it.word}: ${it.notes.join(' ')}`));
    }
  }
  if (target !== 'spelling') {
    const rows = [];
    let headingFound = false;
    // Pages the parent marked as a table of word cards were read card by card.
    for (const p of pages) if (p.cards) { headingFound = true; rows.push(...p.cards.filter((c) => c.word || c.definition).map((c) => ({ ...c, word: c.word || 'Unreadable' }))); }
    for (const p of pages) {
      if (p.cards) continue;
      const start = vocabStart(p.lines);
      if (start < 0 && target !== 'vocab') continue;
      headingFound = true;
      const region = p.lines.slice(start + 1);
      const grid = pairCardGrid(region);
      if (grid) rows.push(...grid);
      else rows.push(...parseVocabLines(region).rows);
    }
    if (rows.length) {
      voText = rows.map((r) => { const t = `${r.word} – ${r.definition}`; conf.set(t, r.conf ?? null); if (r.notes?.length) rowNotes.set(compareKey(r.word), r.notes); return t; }).join('\n');
    } else if (headingFound) notes.push('A "Vocabulary" heading was found, but no words under it could be read. Type or paste them.');
  }
  if (spText == null && voText == null) {
    const cls = classifyLines(all, target);
    for (const l of all) conf.set(l.text.trim(), l.conf);
    return { spText: cls.spelling.map((l) => l.text).join('\n'), voText: cls.vocab.map((l) => l.text).join('\n'), conf, notes: cls.note ? [cls.note] : [], rowNotes, spRows };
  }
  return { spText: spText || '', voText: voText || '', conf, notes, rowNotes, spRows };
}

class Importer {
  constructor(week, student, query = {}) {
    this.w = week; this.student = student; this.pages = [];
    // From the lesson wizard: ?for=vocab|spelling presets what is on the pages; ?from=wizard returns to "Add words".
    if (query.for === 'vocab' || query.for === 'spelling') this.target = query.for;
    this.back = query.from === 'wizard' ? `#/parent/week/${week.id}/words` : `#/parent/week/${week.id}`;
  }

  render() {
    this.body = h('div', { class: 'import' });
    const title = { vocab: 'Upload the vocabulary worksheet', spelling: 'Upload the spelling list' }[this.target] || 'Upload photos';
    this.root = page({ title, back: this.back, backLabel: this.back.endsWith('/words') ? 'Back to Add words' : 'Back to the week', cls: 'parent',
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
        link('Back', this.back, 'btn btn-ghost btn-small')));
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
          btn('↺', () => { p.rotate = (p.rotate + 270) % 360; p.corners = null; this.drawThumbs(); }, 'btn-ghost btn-small', { 'aria-label': `Turn page ${i + 1} left` }),
          btn('↻', () => { p.rotate = (p.rotate + 90) % 360; p.corners = null; this.drawThumbs(); }, 'btn-ghost btn-small', { 'aria-label': `Turn page ${i + 1} right` }),
          btn('Remove', () => { this.pages.splice(i, 1); this.drawThumbs(); }, 'btn-ghost btn-small', { 'aria-label': `Remove page ${i + 1}` })),
        h('div', { class: 'row' }, btn(p.corners ? '✓ Table corners marked' : 'Mark table corners', () => this.markCorners(p, i), `btn-small ${p.corners ? 'btn-primary' : 'btn-ghost'} corners-btn`, { 'aria-label': `Mark the corners of a table of word cards on page ${i + 1}` })));
    }));
  }

  /**
   * Corner tool for a vocabulary sheet laid out as a table of cards and photographed at an angle: the parent drags
   * four handles onto the table's outer corners; the app straightens the table and reads each card on its own.
   */
  async markCorners(p, i) {
    p.rotate = p.rotate || 0;
    const c = this.pageCanvas(p);
    const { detectTable } = await import('../perspective.js');
    let pts = p.corners ? p.corners.map((q) => ({ ...q })) : (detectTable(c)?.corners || [{ x: c.width * 0.1, y: c.height * 0.1 }, { x: c.width * 0.9, y: c.height * 0.1 }, { x: c.width * 0.9, y: c.height * 0.6 }, { x: c.width * 0.1, y: c.height * 0.6 }]);
    const names = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];
    const img = h('img', { src: c.toDataURL('image/jpeg', 0.8), alt: `Page ${i + 1}`, class: 'corner-img', draggable: 'false' });
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg'); svg.setAttribute('class', 'corner-svg'); svg.setAttribute('viewBox', `0 0 ${c.width} ${c.height}`); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true');
    const poly = document.createElementNS(svgNS, 'polygon'); svg.append(poly);
    const stage = h('div', { class: 'corner-stage' }, img, svg);
    const handles = pts.map((q, k) => h('button', { type: 'button', class: 'corner-handle', 'data-autofocus': k === 0 ? '' : null, 'aria-label': `${names[k]} corner of the table. Drag, or use the arrow keys to move it.` }));
    stage.append(...handles);
    const place = () => {
      handles.forEach((hd, k) => { hd.style.left = `${(pts[k].x / c.width) * 100}%`; hd.style.top = `${(pts[k].y / c.height) * 100}%`; });
      poly.setAttribute('points', pts.map((q) => `${q.x},${q.y}`).join(' '));
    };
    handles.forEach((hd, k) => {
      hd.addEventListener('pointerdown', (e) => {
        e.preventDefault(); try { hd.setPointerCapture(e.pointerId); } catch { /* synthetic or lost pointer */ }
        const move = (ev) => { const r = stage.getBoundingClientRect(); pts[k] = { x: Math.max(0, Math.min(c.width, ((ev.clientX - r.left) / r.width) * c.width)), y: Math.max(0, Math.min(c.height, ((ev.clientY - r.top) / r.height) * c.height)) }; place(); };
        const up = () => { hd.removeEventListener('pointermove', move); hd.removeEventListener('pointerup', up); };
        hd.addEventListener('pointermove', move); hd.addEventListener('pointerup', up);
      });
      hd.addEventListener('keydown', (e) => {
        const step = (e.shiftKey ? 20 : 4) * (c.width / stage.getBoundingClientRect().width || 1);
        const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
        if (!d) return;
        e.preventDefault(); pts[k] = { x: Math.max(0, Math.min(c.width, pts[k].x + d[0])), y: Math.max(0, Math.min(c.height, pts[k].y + d[1])) }; place();
      });
    });
    place();
    const count = (label, value) => h('select', { 'aria-label': label, class: 'grid-count' }, h('option', { value: '' }, 'Auto'), [1, 2, 3, 4, 5, 6, 7, 8].map((n) => h('option', { value: String(n), selected: value === n }, String(n))));
    const colsSel = count('Cards across', p.cols), rowsSel = count('Cards down', p.rows);
    const v = await dialog({ title: 'Mark the table corners', body: h('div', null,
      h('p', { class: 'hint' }, 'Use this for a vocabulary sheet laid out as a table of word cards. Drag the four round handles onto the outside corners of the table (not the whole page). The app will straighten the table and read each card on its own.'),
      stage,
      h('div', { class: 'two-col' }, field('Cards across', colsSel), field('Cards down', rowsSel)),
      h('p', { class: 'hint' }, 'Count the cards on the sheet, or leave Auto.')),
    buttons: [...(p.corners ? [{ label: 'Remove corners', value: 'remove', cls: 'btn-ghost' }] : []), { label: 'Use these corners', value: 'use' }] });
    if (v === 'use') { p.corners = pts; p.cols = Number(colsSel.value) || null; p.rows = Number(rowsSel.value) || null; }
    if (v === 'remove') { p.corners = null; p.cols = p.rows = null; }
    this.drawThumbs();
    this.thumbs.querySelectorAll('.corners-btn')[i]?.focus();
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
        const read = p.corners ? (canvas, opts) => ocr.readTable(canvas, p.corners, { ...opts, cols: p.cols, rows: p.rows }) : (canvas, opts) => ocr.readPage(canvas, { ...opts, target: this.target });
        const res = await read(this.pageCanvas(p), {
          onProgress: (m) => {
            if (m.status === 'reading cards') setProgress(Math.round((base + m.progress / this.pages.length) * 100), 100, `Reading the word cards on page ${i + 1} of ${this.pages.length}… ${Math.round(m.progress * 100)}%`);
            else if (m.status === 'reading again') setProgress(Math.round((base + (0.3 + 0.7 * m.progress) / this.pages.length) * 100), 100, `Some list numbers were hard to read. Reading page ${i + 1} again more carefully (${Math.round(m.progress * 100)}%)…`);
            else if (m.status === 'recognizing text') setProgress(Math.round((base + m.progress / this.pages.length) * 100), 100, `Reading page ${i + 1} of ${this.pages.length}… ${Math.round(m.progress * 100)}%`);
            else if (/loading|initializ/.test(m.status || '')) setProgress(Math.round(base * 100), 100, `Getting the photo reader ready (page ${i + 1} of ${this.pages.length})…`);
          },
        });
        results.push({ page: p, ...res });
      } catch (e) {
        console.warn(e);
        if (/could not be loaded/.test(e && e.message)) { this.failed('The photo reader could not be loaded. Check the internet connection and try again, or type or paste the words instead.'); return; }
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
      h('div', { class: 'row' }, btn('Try again', () => this.choose(), 'btn-primary'), link('Type or paste instead', this.back, 'btn btn-ghost'))));
  }

  // ── Step 3: check the text beside each photo, then add as drafts ──
  reviewStep() {
    const allLines = this.results.flatMap((r) => r.lines);
    const ex = extractPages(this.results, this.target);
    this.confMap = ex.conf;
    this.rowNotes = ex.rowNotes;
    this.spRows = ex.spRows || new Map();
    const totalWords = allLines.reduce((n, l) => n + l.text.split(/\s+/).filter(Boolean).length, 0);
    // What the reader actually read, before any edits on this screen (kept as the original transcription).
    this.readRows = { vo: parseVocabLines(this.linesOf(ex.voText)).rows, words: allLines.flatMap((l) => l.words || []) };
    // Only words that made it into the boxes matter to the parent (not headings or notes that were left out).
    const inBoxes = new Set(`${ex.spText} ${ex.voText}`.toLowerCase().split(/[^\p{L}'’]+/u).filter(Boolean));
    const unsure = allLines.flatMap((l) => l.unsure || []).filter((u) => inBoxes.has(u.text.toLowerCase().replace(/[^\p{L}'’]+/gu, '')));
    const spText = h('textarea', { rows: 10, id: 'ocr-spelling', class: 'ocr-text' }, ex.spText);
    const voText = h('textarea', { rows: 12, id: 'ocr-vocab', class: 'ocr-text' }, ex.voText);
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
        h('figcaption', null, `Page ${i + 1} · reader confidence ${r.confidence}%${Math.abs(r.skew || 0) >= 2.5 ? ` · straightened by ${Math.abs(r.skew)}°` : ''}`));
    });
    const nothing = totalWords === 0;
    fill(this.body,
      nothing ? h('div', { class: 'card notice notice-error', role: 'alert' },
        h('p', null, h('strong', null, 'No words were found in these photos.')),
        h('p', null, 'Try a clearer photo taken straight on in good light, turn the page the right way up, or type or paste the words.'),
        h('div', { class: 'row' }, btn('Try other photos', () => { this.pages = []; this.choose(); }, 'btn-primary'), link('Type or paste instead', this.back, 'btn btn-ghost'))) : null,
      h('div', { class: 'card notice notice-warn' },
        h('p', null, h('strong', null, 'Check the text against the photo. '), 'The photo reader makes mistakes, especially with shadows, slanted photos and handwriting. Fix anything here, or later in the week editor. Nothing is shown to students until you approve the week.'),
        ex.notes.length ? h('ul', { class: 'import-notes' }, ex.notes.map((n) => h('li', null, n))) : null,
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

  /**
   * Turn reviewed rows into draft items, keeping what the photo reader actually read as the original transcription.
   * A row the parent changed on the review screen is matched back to the reader's row; the reader's text becomes
   * originalTranscription and the parent's change is logged as a correction. Rows typed from scratch are 'typed'.
   */
  buildItems(sp, vo) {
    const at = nowIso();
    let corrected = 0;
    const clean = (t) => t.replace(/[.,;:]$/, '');
    // Spelling: each reader word can back only one item. Exact matches first, then close misreadings (≥ 75%).
    const words = this.readRows.words.map((w) => ({ ...w, text: clean(w.text), used: false }));
    const readFor = sp.map(() => null);
    // A word exactly as the reader produced it (main or extra readings) is the reader's, with the vote's confidence and notes.
    sp.forEach((x, i) => {
      const rr = this.spRows.get(compareKey(x.word));
      if (!rr || rr.used) return;
      rr.used = true; readFor[i] = { text: x.word, conf: rr.conf, notes: rr.notes };
      const w = words.find((r) => !r.used && compareKey(r.text) === compareKey(x.word)); if (w) w.used = true; // claimed: not available for fuzzy matching
    });
    sp.forEach((x, i) => { if (readFor[i]) return; const w = words.find((r) => !r.used && compareKey(r.text) === compareKey(x.word)); if (w) { w.used = true; readFor[i] = w; } });
    sp.forEach((x, i) => {
      if (readFor[i]) return;
      let best = null, bs = 0;
      for (const r of words) { const sm = similarity(r.text, x.word); if (!r.used && sm >= 0.75 && sm > bs) { bs = sm; best = r; } }
      if (best) { best.used = true; readFor[i] = best; }
    });
    const spItems = sp.map((x, i) => {
      const read = readFor[i];
      const it = newSpellingItem({ word: x.word, origin: read ? 'ocr' : 'typed', ocrConfidence: read ? read.conf : null, importedFlags: read && read.notes ? read.notes : [] });
      if (read) { it.originalTranscription = read.text; if (compareKey(read.text) !== compareKey(x.word)) corrected++; }
      it.groups = suggestGroups(x.word);
      return it;
    });
    // Vocabulary: a row is the reader's row only if the word is nearly the same (≥ 75%), or fairly close AND the
    // definition is recognisably the same. Otherwise it is a row the parent typed.
    const rows = this.readRows.vo;
    const used = new Set();
    const sameRow = (r, x) => { const ws = similarity(r.word, x.word); return ws >= 0.75 || (ws >= 0.6 && similarity(r.definition, x.definition) >= 0.6); };
    const voItems = vo.map((x, i) => {
      let match = rows[i] && !used.has(i) && sameRow(rows[i], x) ? i : -1;
      if (match < 0) { let bs = 0; rows.forEach((r, j) => { const sm = similarity(r.word, x.word); if (!used.has(j) && sameRow(r, x) && sm > bs) { bs = sm; match = j; } }); }
      if (match < 0) return newVocabItem({ word: x.word, definition: x.definition, origin: 'typed', importedFlags: x.notes });
      used.add(match);
      const read = rows[match];
      const it = newVocabItem({ word: x.word, definition: read.definition, origin: 'ocr', ocrConfidence: read.conf, importedFlags: [...new Set([...(this.rowNotes?.get(compareKey(read.word)) || []), ...x.notes])] });
      if (x.definition !== read.definition) {
        it.sourceDefinition = x.definition;
        it.definitionLog.push({ field: 'sourceDefinition', from: read.definition, to: x.definition, at, reason: 'Corrected on the photo review screen' });
        corrected++;
      } else if (x.word !== read.word) corrected++;
      return it;
    });
    return { spItems, voItems, corrected };
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
    const { spItems, voItems, corrected } = this.buildItems(sp, vo);
    await store.editWeek(this.w.id, (w) => {
      if (replace) { if (spItems.length) w.spelling = []; if (voItems.length) w.vocab = []; }
      w.spelling.push(...spItems); w.vocab.push(...voItems);
      w.sources.push(...sources);
    }, { action: 'photos read', detail: `${sources.length} page(s): ${spItems.length} spelling, ${voItems.length} vocabulary added as drafts${corrected ? `; ${corrected} corrected on the review screen (recorded)` : ''}. Raw reader text kept with the source pages (${rawText.length} characters).` });
    toast(`Added ${spItems.length + voItems.length} words as drafts. Check each one against the photo.`);
    go(this.back);
  }
}
