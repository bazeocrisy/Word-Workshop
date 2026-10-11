// Read worksheet photos into draft lesson items without a screen of its own (the lesson workspace shows progress and
// puts the results straight into its Check stage). Same on-device reader and the same extraction and matching rules
// as the photo page (views/importView.js); every item is an unchecked draft.
import { decode, toCanvas, canvasToBlob, checkFile, ImageError } from './images.js';
import { parseVocabLines, parseSpellingLines } from './parse.js';
import { extractPages, buildDraftItems } from './views/importView.js';
import * as store from './store.js';
import { nowIso } from './model.js';

export const MAX_PHOTOS = 6;

/** Open picture files as canvases. Returns { pages: [{ name, canvas }], errors: [message] }. */
export async function openPhotos(files) {
  const pages = [], errors = [];
  for (const f of files) {
    if (pages.length >= MAX_PHOTOS) { errors.push(`Only ${MAX_PHOTOS} photos at a time. ${f.name} was not added.`); continue; }
    try {
      checkFile(f);
      const bmp = await decode(f);
      pages.push({ name: f.name || `Photo ${pages.length + 1}`, canvas: toCanvas(bmp, 2200) });
      if (bmp.close) bmp.close();
    } catch (e) { errors.push(e instanceof ImageError ? e.message : `${f.name} could not be opened.`); }
  }
  return { pages, errors };
}

/** Friendly message for a reader failure. */
export function readerError(e) {
  if (/could not be loaded/.test(e && e.message)) return 'The photo reader could not be loaded. Check the internet connection and try again, or type or paste the words instead.';
  if (navigator.onLine === false) return 'The photo reader needs an internet connection the first time it is used. Connect and try again, or type or paste the words instead.';
  return 'The photo reader stopped with an error. Try again with a clearer photo, or type or paste the words instead.';
}

/**
 * Read one page. page.corners (optional) reads it as a table of word cards. onProgress(fraction 0..1, label).
 * Returns the reader result ({ lines, alternatives, confidence, cards? … }).
 */
export async function readPhoto(page, { target = 'auto', onProgress = () => {} } = {}) {
  const ocr = await import('./ocr.js');
  const opts = {
    target,
    onProgress: (m) => {
      if (m.status === 'reading cards') onProgress(m.progress, `Reading the word cards… ${Math.round(m.progress * 100)}%`);
      else if (m.status === 'reading again') onProgress(0.3 + 0.7 * m.progress, `Some list numbers were hard to read. Reading again more carefully… ${Math.round(m.progress * 100)}%`);
      else if (m.status === 'recognizing text') onProgress(m.progress * 0.95, `Reading the photo… ${Math.round(m.progress * 100)}%`);
      else if (/loading|initializ/.test(m.status || '')) onProgress(0.02, 'Getting the photo reader ready (the first time takes longer)…');
    },
  };
  return page.corners ? ocr.readTable(page.canvas, page.corners, { ...opts, cols: page.cols, rows: page.rows }) : ocr.readPage(page.canvas, opts);
}

const tokens = (t) => String(t || '').toLowerCase().match(/\p{L}{2,}/gu) || [];

/**
 * Draft items from one page's reading. Also returns the text the reader found that did not become a word
 * ("other text": headings, notes, unreadable bits) so the parent can recover a valid word from it.
 */
export function draftsFromReading(result, target = 'auto') {
  const results = [result];
  const ex = extractPages(results, target);
  const linesOf = (text) => String(text).split('\n').map((t) => ({ text: t, conf: ex.conf.get(t.trim()) ?? null }));
  const sp = parseSpellingLines(linesOf(ex.spText));
  const vo = parseVocabLines(linesOf(ex.voText));
  const allLines = result.lines || [];
  const readRows = { vo: vo.rows, words: allLines.flatMap((l) => l.words || []) };
  const { spItems, voItems } = buildDraftItems({ readRows, spRows: ex.spRows || new Map(), rowNotes: ex.rowNotes }, sp.words.filter((x) => x.word), vo.rows);
  const used = new Set([...spItems.map((i) => i.word), ...voItems.flatMap((i) => [i.word, i.sourceDefinition])].flatMap(tokens));
  const other = [...new Set([...sp.ignored, ...vo.ignored, ...allLines.map((l) => l.text.trim())
    .filter((t) => tokens(t).length && tokens(t).every((w) => !used.has(w)))])].slice(0, 80);
  return { spItems, voItems, notes: ex.notes || [], other };
}

/** Keep the photo with the lesson (a smaller JPEG) and describe it as a source page. */
export async function saveSource(page, result, extra = {}) {
  const blob = await canvasToBlob(toCanvas(page.canvas, 1800), 'image/jpeg', 0.82);
  const ref = await store.saveImage(blob, { kind: 'source', name: page.name });
  return { kind: 'photo', id: ref, imageRef: ref, name: page.name, at: nowIso(), confidence: result.confidence, ocrText: (result.lines || []).map((l) => l.text).join('\n'), ...extra };
}

/** A canvas for a stored source photo (to read it again, e.g. as a table of cards). */
export async function sourceCanvas(src) {
  const url = await store.imageUrl(src.imageRef);
  if (!url) throw new Error('The photo is no longer stored on this device.');
  const blob = await (await fetch(url)).blob();
  const bmp = await decode(blob);
  const c = toCanvas(bmp, 2200);
  if (bmp.close) bmp.close();
  return c;
}
