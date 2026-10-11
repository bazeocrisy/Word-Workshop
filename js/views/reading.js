// Reading Passage: a child adds a passage (PDF, photo, or typed/pasted text), reads it on screen with a text-size
// control, and marks it as read. Passages are saved per student on this device. No questions in this release.
import { h, fill, page, btn, link, toast, confirmDialog, emptyState } from '../ui.js';
import * as store from '../store.js';
import { uid, nowIso } from '../model.js';
import { prepareForStorage, ImageError } from '../images.js';
import { requireStudent, themeClass, avatar } from './common.js';
import { go } from '../router.js';

const MAX_PDF = 20 * 1024 * 1024;
const SIZES = [1, 1.15, 1.3, 1.5, 1.75, 2];
const KIND = { pdf: { icon: '📄', name: 'PDF' }, photo: { icon: '📷', name: 'Photo' }, text: { icon: '📝', name: 'Typed' } };
const sizeKey = (sid) => `ww-reading-size:${sid}`;
const getSize = (sid) => { try { const v = Number(localStorage.getItem(sizeKey(sid))); return SIZES.includes(v) ? v : 1.15; } catch { return 1.15; } };
const setSize = (sid, v) => { try { localStorage.setItem(sizeKey(sid), String(v)); } catch { /* ignore */ } };

const wrap = (st, opts, ...body) => h('div', { class: themeClass(st) }, page({ cls: 'kid reading area-reading', actions: [avatar(st), h('span', { class: 'who' }, st.displayName)], ...opts }, ...body));

/** "Easy reading" text: paragraphs from blank lines (typed/pasted) — the child's own line breaks are kept. */
export const toParagraphs = (text) => String(text || '').replace(/\r\n?/g, '\n').split(/\n\s*\n/).map((p) => p.replace(/[ \t]+/g, ' ').trim()).filter(Boolean);
const wordCount = (paras) => paras.join(' ').split(/\s+/).filter(Boolean).length;

export async function readingList({ params }) {
  const st = await requireStudent(params.sid);
  const passages = await store.listPassages(st.id);
  const add = link(h('span', null, h('span', { 'aria-hidden': 'true' }, '＋ '), 'Add a passage'), `#/s/${st.id}/reading/add`, 'btn btn-primary btn-big add-passage');
  return wrap(st, { title: 'Reading Passage', back: `#/s/${st.id}`, backLabel: 'Home' },
    passages.length ? h('ul', { class: 'passage-list', role: 'list' }, passages.map((p) => h('li', null,
      h('a', { href: `#/s/${st.id}/reading/${p.id}`, class: `passage-card ${p.readAt ? 'is-read' : ''}` },
        h('span', { class: 'passage-icon', 'aria-hidden': 'true' }, KIND[p.kind]?.icon || '📄'),
        h('span', { class: 'passage-title' }, p.title),
        h('span', { class: 'passage-meta' }, p.readAt ? '✓ Read' : 'Not read yet', p.words ? ` · ${p.words} words` : ''))))) :
      h('div', { class: 'card hub-empty' }, h('p', { class: 'hub-empty-icon', 'aria-hidden': 'true' }, '📖'), h('h2', null, 'No passages yet'), h('p', null, 'Add the reading passage from school: a PDF, a photo, or type it in.')),
    h('div', { class: 'row' }, add));
}

export async function readingAdd({ params }) {
  const st = await requireStudent(params.sid);
  const msg = h('div', { class: 'form-error', role: 'alert' });
  const title = h('input', { type: 'text', id: 'passage-title', maxlength: '80', placeholder: 'For example: The Busy Beaver' });
  const text = h('textarea', { id: 'passage-text', rows: 12, class: 'passage-input', placeholder: 'Type or paste the passage here. Leave an empty line between paragraphs.' });
  const busy = h('p', { class: 'hint', 'aria-live': 'polite' });
  let saving = false;
  const finish = async (rec) => {
    const p = await store.savePassage({ id: uid('ps'), studentId: st.id, createdAt: nowIso(), ...rec });
    toast('Your passage is saved.');
    go(`#/s/${st.id}/reading/${p.id}`);
  };
  const pick = (accept, onFile) => {
    const input = h('input', { type: 'file', accept, class: 'sr-only', tabindex: '-1', 'aria-hidden': 'true' });
    input.addEventListener('change', async () => {
      const f = input.files[0]; input.value = '';
      if (!f || saving) return;
      saving = true; fill(msg, '');
      try { await onFile(f); } catch (e) { console.warn(e); fill(msg, e instanceof ImageError ? e.message : (e.friendly || 'That file could not be opened. Try another one.')); } finally { saving = false; busy.textContent = ''; }
    });
    return input;
  };
  const pdfInput = pick('application/pdf,.pdf', async (f) => {
    if (f.size > MAX_PDF) throw Object.assign(new Error('big'), { friendly: 'That PDF is too large (the limit is 20 MB).' });
    busy.textContent = 'Opening the PDF…';
    const { openPdf } = await import('../pdfDoc.js');
    let doc;
    try { doc = await openPdf(f); } catch { throw Object.assign(new Error('pdf'), { friendly: 'That file is not a PDF this app can open.' }); }
    const t = await doc.text(); doc.close();
    const ref = await store.saveImage(new Blob([await f.arrayBuffer()], { type: 'application/pdf' }), { kind: 'passage', name: f.name });
    await finish({ title: title.value.trim() || f.name.replace(/\.pdf$/i, ''), kind: 'pdf', fileRef: ref, pages: doc.numPages, paragraphs: t.paragraphs, words: t.words });
  });
  const photoInput = pick('image/*', async (f) => {
    busy.textContent = 'Saving the photo…';
    const blob = await prepareForStorage(f, 2400);
    const ref = await store.saveImage(blob, { kind: 'passage', name: f.name });
    await finish({ title: title.value.trim() || 'My passage photo', kind: 'photo', fileRef: ref });
  });
  const saveText = btn('Save my passage', async () => {
    const paras = toParagraphs(text.value);
    if (!paras.length) { fill(msg, 'Type or paste the passage first.'); text.focus(); return; }
    if (saving) return; saving = true;
    try { await finish({ title: title.value.trim() || paras[0].split(/\s+/).slice(0, 6).join(' '), kind: 'text', paragraphs: paras, words: wordCount(paras) }); } finally { saving = false; }
  }, 'btn-primary save-text');
  return wrap(st, { title: 'Add a passage', back: `#/s/${st.id}/reading`, backLabel: 'Reading Passage' },
    h('div', { class: 'field' }, h('label', { for: 'passage-title' }, 'Name of the passage (you can skip this)'), title),
    h('div', { class: 'choice-cards' },
      h('div', { class: 'choice-card' }, btn(h('span', null, h('span', { class: 'choice-icon', 'aria-hidden': 'true' }, '📄'), 'Upload a PDF'), () => pdfInput.click(), 'btn-primary btn-big add-pdf'), pdfInput),
      h('div', { class: 'choice-card' }, btn(h('span', null, h('span', { class: 'choice-icon', 'aria-hidden': 'true' }, '📷'), 'Upload a photo'), () => photoInput.click(), 'btn-primary btn-big add-photo'), photoInput)),
    busy, msg,
    h('section', { class: 'card', 'aria-labelledby': 'type-h' }, h('h2', { id: 'type-h' }, 'Or type or paste it'),
      h('label', { for: 'passage-text', class: 'sr-only' }, 'Passage text'), text, h('div', { class: 'row' }, saveText)));
}

export async function readingView({ params }) {
  const st = await requireStudent(params.sid);
  const p = await store.getPassage(params.pid);
  if (!p || p.studentId !== st.id) return wrap(st, { title: 'Passage not found', back: `#/s/${st.id}/reading`, backLabel: 'Reading Passage' }, emptyState('This passage is not here any more.'));
  let size = getSize(st.id);
  const hasText = !!(p.paragraphs && p.paragraphs.length);
  let view = p.kind === 'pdf' ? 'pages' : p.kind === 'photo' ? 'photo' : 'text';
  const body = h('div', { class: 'reader-body', 'aria-live': 'off' });
  const sizeLabel = h('span', { class: 'size-label', 'aria-live': 'polite' });
  const apply = () => { body.style.setProperty('--reader-scale', String(size)); sizeLabel.textContent = `${Math.round(size * 100)}%`; };
  const resize = (d) => { const i = Math.max(0, Math.min(SIZES.length - 1, SIZES.indexOf(size) + d)); size = SIZES[i]; setSize(st.id, size); apply(); };
  const draw = async () => {
    if (view === 'text') { fill(body, h('article', { class: 'reader-text' }, h('h2', null, p.title), (p.paragraphs || []).map((t) => h('p', null, t)))); return; }
    const url = p.fileRef ? await store.imageUrl(p.fileRef) : null;
    if (!url) { fill(body, emptyState('The file for this passage is not on this device any more.')); return; }
    if (view === 'photo') { fill(body, h('figure', { class: 'reader-photo' }, h('img', { src: url, alt: `Photo of the passage: ${p.title}` }))); return; }
    fill(body, h('p', { class: 'hint' }, 'Opening the pages…'));
    try {
      const { openPdf } = await import('../pdfDoc.js');
      const blob = await (await fetch(url)).blob();
      const doc = await openPdf(blob);
      const pages = [];
      for (let n = 1; n <= doc.numPages; n++) { const c = await doc.page(n); c.className = 'reader-page'; c.setAttribute('role', 'img'); c.setAttribute('aria-label', `Page ${n} of ${doc.numPages}`); pages.push(c); }
      doc.close();
      fill(body, h('div', { class: 'reader-pages' }, pages));
    } catch (e) { console.warn(e); fill(body, emptyState('This PDF could not be shown. Try opening it again.')); }
  };
  const switcher = p.kind === 'pdf' && hasText ? h('div', { class: 'seg', role: 'group', 'aria-label': 'How to show the passage' },
    btn('Pages', () => { view = 'pages'; mark(); draw(); }, 'btn-small seg-pages'), btn('Easy reading', () => { view = 'text'; mark(); draw(); }, 'btn-small seg-text')) : null;
  const mark = () => switcher?.querySelectorAll('button').forEach((b) => { const on = (b.classList.contains('seg-text') && view === 'text') || (b.classList.contains('seg-pages') && view === 'pages'); b.className = `btn btn-small ${b.classList.contains('seg-text') ? 'seg-text' : 'seg-pages'} ${on ? 'btn-primary' : 'btn-ghost'}`; b.setAttribute('aria-pressed', String(on)); });
  const status = h('div', { class: 'read-status' });
  const drawStatus = () => fill(status,
    p.readAt ? [h('p', { class: 'ok-text' }, '✓ You read this passage.'), btn('Read it again', async () => { p.readAt = null; await store.savePassage(p); drawStatus(); toast('Ready to read again.'); }, 'btn-ghost read-again')]
      : btn('✓ I read it!', async () => { p.readAt = nowIso(); await store.savePassage(p); drawStatus(); toast('Great reading!'); }, 'btn-primary btn-big mark-read'));
  drawStatus();
  const remove = btn('Delete this passage', async () => {
    if (!(await confirmDialog('Delete this passage?', `"${p.title}" will be removed from this device. This cannot be undone.`, 'Delete', true))) return;
    await store.deletePassage(p.id); toast('Passage deleted.'); go(`#/s/${st.id}/reading`);
  }, 'btn-ghost btn-small delete-passage');
  const root = wrap(st, { title: p.title, back: `#/s/${st.id}/reading`, backLabel: 'Reading Passage', subtitle: [KIND[p.kind]?.name, p.words ? `${p.words} words` : null, p.pages ? `${p.pages} page${p.pages === 1 ? '' : 's'}` : null].filter(Boolean).join(' · ') },
    h('div', { class: 'reader-tools' }, switcher,
      h('div', { class: 'size-tools', role: 'group', 'aria-label': 'Text size' },
        btn('A−', () => resize(-1), 'btn-ghost size-down', { 'aria-label': 'Smaller' }), sizeLabel, btn('A+', () => resize(1), 'btn-ghost size-up', { 'aria-label': 'Bigger' }))),
    body, status, h('p', { class: 'reader-delete' }, remove));
  apply(); mark(); draw();
  return root;
}
