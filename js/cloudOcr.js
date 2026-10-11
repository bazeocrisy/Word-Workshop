// Online photo reader (optional). When the parent has set it up in Settings, a worksheet photo is sent to the
// family's own reader server (server/ocr-worker), which asks Claude's vision model for the spelling list and the
// vocabulary words/definitions exactly as printed. The API key lives only on that server. The address and passphrase
// are kept in this browser's localStorage (not in backups). Results are drafts like any other reading: every word
// arrives unchecked and the parent compares it with the photo before approval.

const KEY = 'ww-online-reader';
const UNSURE_CONF = 60;  // below the app's 80% warning threshold: the parent must look at it
const SURE_CONF = 95;
export const UNSURE_NOTE = 'The online reader was not sure of every letter here. Check it against the photo.';

/** { url, passphrase, enabled } or null. */
export function getConfig() {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || 'null');
    return c && c.url ? c : null;
  } catch { return null; }
}

export function setConfig(c) {
  try {
    if (!c) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify({ url: String(c.url).trim(), passphrase: String(c.passphrase || ''), enabled: !!c.enabled }));
    return true;
  } catch { return false; }
}

export const isEnabled = () => { const c = getConfig(); return !!(c && c.enabled && c.passphrase); };

export class OnlineReaderError extends Error {
  constructor(message, status = null) { super(message); this.name = 'OnlineReaderError'; this.status = status; }
}

/** Plain-language message for a failed online reading. */
export function friendlyError(status) {
  return ({
    401: 'The online reader passphrase is wrong. Check it in Settings.',
    403: 'The online reader refused this website. Check the reader server\'s allowed address.',
    413: 'The photo is too large for the online reader.',
    429: 'The online reader has reached its daily limit.',
  })[status] || 'The online reader could not read this photo.';
}

async function post(cfg, body, timeoutMs = 90000) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  let res;
  try {
    res = await fetch(cfg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Reader-Key': cfg.passphrase },
      body: JSON.stringify(body),
      signal: ctrl?.signal,
    });
  } catch (e) {
    throw new OnlineReaderError(navigator.onLine === false ? 'The online reader needs an internet connection.' : 'The online reader could not be reached.');
  } finally { if (timer) clearTimeout(timer); }
  if (!res.ok) throw new OnlineReaderError(friendlyError(res.status), res.status);
  return res.json();
}

/** "Test connection" in Settings. Resolves { ok, model } or throws OnlineReaderError. */
export const ping = (cfg = getConfig()) => post(cfg, { ping: true }, 20000);

/** JPEG data (base64, no prefix) for a canvas, scaled so the long side is at most maxSide. */
export async function canvasToBase64(canvas, maxSide = 2400, quality = 0.9) {
  let c = canvas;
  const k = maxSide / Math.max(canvas.width, canvas.height);
  if (k < 1) {
    c = document.createElement('canvas');
    c.width = Math.round(canvas.width * k); c.height = Math.round(canvas.height * k);
    const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(canvas, 0, 0, c.width, c.height);
  }
  return c.toDataURL('image/jpeg', quality).split(',')[1];
}

/**
 * Read one page online. Resolves a reader result the rest of the app understands:
 * { online: true, spelling, vocabulary, notes, lines, alternatives: [], confidence, skew: 0 }.
 */
export async function readOnline(canvas, { target = 'auto', onProgress = () => {} } = {}) {
  const cfg = getConfig();
  if (!cfg) throw new OnlineReaderError('The online reader is not set up.');
  onProgress(0.1, 'Sending the photo to the online reader…');
  const image = await canvasToBase64(canvas);
  onProgress(0.3, 'The online reader is reading the photo…');
  const data = await post(cfg, { image, mediaType: 'image/jpeg', target });
  onProgress(1, 'Done');
  return toReading(data, target);
}

/** Turn the server's JSON into the reader-result shape (pure; unit-tested). */
export function toReading(data, target = 'auto') {
  const str = (s) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '');
  let spelling = (Array.isArray(data?.spelling) ? data.spelling : []).map((x) => ({ number: Number.isInteger(x?.number) ? x.number : null, word: str(x?.word), unsure: !!x?.unsure })).filter((x) => x.word);
  let vocabulary = (Array.isArray(data?.vocabulary) ? data.vocabulary : []).map((x) => ({ word: str(x?.word), definition: str(x?.definition), unsure: !!x?.unsure })).filter((x) => x.word || x.definition);
  if (target === 'spelling') vocabulary = [];
  if (target === 'vocab') spelling = [];
  // Teacher order: by printed number when every word has one, otherwise as read.
  if (spelling.length && spelling.every((x) => x.number != null)) spelling = [...spelling].sort((a, b) => a.number - b.number);
  const notes = (Array.isArray(data?.notes) ? data.notes : []).map(str).filter(Boolean);
  if (data?.truncated) notes.push('The online reader stopped early; some words may be missing.');
  const nums = spelling.map((x) => x.number).filter((n) => n != null);
  if (nums.length === spelling.length && nums.length) {
    const missing = []; for (let n = 1; n <= Math.max(...nums); n++) if (!nums.includes(n)) missing.push(n);
    if (missing.length) notes.push(`Number${missing.length > 1 ? 's' : ''} ${missing.join(', ')} ${missing.length > 1 ? 'were' : 'was'} not found. A word may be missing.`);
  }
  const conf = (x) => (x.unsure ? UNSURE_CONF : SURE_CONF);
  // A text record of what the reader read (kept with the source photo for the audit trail).
  const lines = [
    ...spelling.map((x) => ({ text: `${x.number != null ? `${x.number}. ` : ''}${x.word}`, conf: conf(x), words: [{ text: x.word, conf: conf(x) }], segments: [] })),
    ...vocabulary.map((x) => ({ text: `${x.word} – ${x.definition}`, conf: conf(x), words: [], segments: [] })),
  ];
  const all = [...spelling, ...vocabulary];
  const confidence = all.length ? Math.round(all.reduce((n, x) => n + conf(x), 0) / all.length) : 0;
  return { online: true, model: data?.model || null, spelling, vocabulary, notes, lines, alternatives: [], skew: 0, confidence };
}

/**
 * Inputs for buildDraftItems (views/importView.js) from an online reading, so imported items carry the reader's
 * text as the original transcription, its confidence and its notes. Pure.
 * → { ctx: { readRows, spRows, rowNotes }, sp: [{ word, notes }], vo: [{ word, definition, notes }] }
 */
export function draftInputs(reading, compareKey) {
  const conf = (x) => (x.unsure ? UNSURE_CONF : SURE_CONF);
  const spRows = new Map();
  for (const x of reading.spelling) spRows.set(compareKey(x.word), { conf: conf(x), notes: x.unsure ? [UNSURE_NOTE] : [] });
  const rowNotes = new Map();
  const voRows = reading.vocabulary.map((x) => {
    const word = x.word || 'Unreadable';
    const notes = [...(x.unsure ? [UNSURE_NOTE] : []), ...(x.definition ? [] : ['No definition was found for this word.'])];
    if (notes.length) rowNotes.set(compareKey(word), notes);
    return { word, definition: x.definition, conf: conf(x), notes: [] };
  });
  return {
    ctx: { readRows: { vo: voRows, words: reading.spelling.map((x) => ({ text: x.word, conf: conf(x) })) }, spRows, rowNotes },
    sp: reading.spelling.map((x) => ({ word: x.word, notes: [] })),
    vo: voRows.map((r) => ({ word: r.word, definition: r.definition, notes: [] })),
  };
}
