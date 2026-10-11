// Export / restore all app data on this device. Restoring replaces everything, after validation,
// and keeps the replaced data as a one-step undo.
import { SCHEMA_VERSION } from './model.js';
import { APP_ID, parseBackupText } from './backupFormat.js';
import { dumpAll, replaceAll, getMeta, setMeta } from './store.js';

const UNDO_KEY = 'undoRestore';

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

async function dataUrlToBlob(url) { return (await fetch(url)).blob(); }

export async function buildBackup() {
  const all = await dumpAll();
  const images = [];
  for (const im of all.images) {
    const { blob, ...rest } = im;
    images.push({ ...rest, dataUrl: await blobToDataUrl(blob) });
  }
  return {
    app: APP_ID, schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(),
    note: 'Word Workshop backup. Contains student names, word lists and results. Keep it private.',
    data: { ...all, images, meta: all.meta.filter((m) => m.key !== UNDO_KEY) },
  };
}

export function backupFileName(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `word-workshop-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
}

export function downloadText(text, name, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function exportBackup() {
  const b = await buildBackup();
  downloadText(JSON.stringify(b), backupFileName());
  await setMeta('lastBackupAt', b.exportedAt);
  return b;
}

/** Turn a validated backup into storable records (pictures back to blobs). */
async function toRecords(obj) {
  const d = obj.data;
  const images = [];
  for (const im of d.images) {
    const { dataUrl, ...rest } = im;
    images.push({ ...rest, blob: await dataUrlToBlob(dataUrl) });
  }
  return { ...d, images, meta: d.meta.filter((m) => m.key !== UNDO_KEY) };
}

export { parseBackupText };

/** Replace all data with a validated backup. The previous data is kept for "Undo restore". */
export async function restoreBackup(text) {
  const parsed = parseBackupText(text);
  if (!parsed.ok) { const e = new Error('Backup not restored.'); e.errors = parsed.errors; throw e; }
  const records = await toRecords(parsed.obj);
  const current = await dumpAll();
  current.meta = current.meta.filter((m) => m.key !== UNDO_KEY);
  records.meta.push({ key: UNDO_KEY, value: { at: new Date().toISOString(), data: current } });
  await replaceAll(records);
  return parsed.summary;
}

export async function hasUndo() { return !!(await getMeta(UNDO_KEY)); }

export async function undoRestore() {
  const u = await getMeta(UNDO_KEY);
  if (!u) throw new Error('There is nothing to undo.');
  await replaceAll(u.data);
}
