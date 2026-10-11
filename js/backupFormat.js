// Pure backup-file validation (no DOM, no storage) so it can be unit-tested in Node.
import { SCHEMA_VERSION, snapshotIntegrityErrors } from './model.js';

export const APP_ID = 'word-workshop';
export const MAX_BACKUP_BYTES = 200 * 1024 * 1024;

const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
const isStr = (x) => typeof x === 'string';

/**
 * Validate a parsed backup object. Returns { ok, errors, summary }. Nothing is written unless ok.
 * Checks structure, ids, cross-references and the definition-integrity rule on every snapshot.
 */
export function validateBackup(obj) {
  const errors = [];
  const err = (m) => { if (errors.length < 25) errors.push(m); };
  if (!isObj(obj)) return { ok: false, errors: ['This file is not a Word Workshop backup (not a JSON object).'], summary: null };
  if (obj.app !== APP_ID) err('This file is not a Word Workshop backup (missing app name).');
  if (!Number.isInteger(obj.schemaVersion)) err('The backup has no version number.');
  else if (obj.schemaVersion > SCHEMA_VERSION) err(`This backup was made by a newer version of Word Workshop (format ${obj.schemaVersion}). Update the app first.`);
  const d = obj.data;
  if (!isObj(d)) { err('The backup has no data section.'); return { ok: false, errors, summary: null }; }
  for (const k of ['students', 'weeks', 'snapshots', 'attempts', 'images', 'meta']) if (!Array.isArray(d[k])) err(`The backup is missing its "${k}" list.`);
  if (errors.length) return { ok: false, errors, summary: null };

  const ids = (list, label) => {
    const seen = new Set();
    list.forEach((r, i) => {
      if (!isObj(r) || !isStr(r.id) || !r.id) { err(`${label} #${i + 1} has no id.`); return; }
      if (seen.has(r.id)) err(`${label} id "${r.id}" appears twice.`);
      seen.add(r.id);
    });
    return seen;
  };
  const studentIds = ids(d.students, 'Student');
  const weekIds = ids(d.weeks, 'Week');
  ids(d.snapshots, 'Lesson version');
  ids(d.attempts, 'Result');
  const imageIds = ids(d.images, 'Image');

  d.students.forEach((s) => { if (isObj(s) && !isStr(s.displayName)) err(`Student "${s.id}" has no name.`); });
  const weekById = new Map(d.weeks.filter(isObj).map((w) => [w.id, w]));
  d.weeks.forEach((w) => {
    if (!isObj(w)) return;
    if (!studentIds.has(w.studentId)) err(`Week "${w.id}" belongs to a student that is not in the backup.`);
    if (!Array.isArray(w.vocab) || !Array.isArray(w.spelling)) err(`Week "${w.id}" is missing its word lists.`);
    (w.vocab || []).forEach((v) => {
      if (!isObj(v) || !isStr(v.word) || !isStr(v.sourceDefinition) || !isStr(v.originalTranscription)) err(`Week "${w.id}" has a vocabulary item without its word or teacher definition.`);
    });
  });
  const snapKeys = new Set();
  d.snapshots.forEach((s) => {
    if (!isObj(s)) return;
    snapKeys.add(`${s.weekId}@${s.version}`);
    if (!weekIds.has(s.weekId)) err(`Lesson version "${s.id}" belongs to a week that is not in the backup.`);
    if (s.id !== `${s.weekId}@${s.version}`) err(`Lesson version "${s.id}" has an inconsistent id.`);
    if (!Array.isArray(s.vocab) || !Array.isArray(s.spelling)) { err(`Lesson version "${s.id}" is missing its word lists.`); return; }
    for (const e of snapshotIntegrityErrors(s)) err(`Lesson version "${s.id}": ${e}`);
    for (const v of s.vocab) if (v.image && isStr(v.image.ref) && !v.image.ref.startsWith('sample:') && !imageIds.has(v.image.ref)) err(`Lesson version "${s.id}" uses a picture that is not in the backup.`);
  });
  weekById.forEach((w) => { if (w.approvedVersion && !snapKeys.has(`${w.id}@${w.approvedVersion}`)) err(`Week "${w.id}" says it is approved but its approved lesson is missing.`); });
  d.attempts.forEach((a) => {
    if (!isObj(a)) return;
    if (!studentIds.has(a.studentId)) err(`Result "${a.id}" belongs to a student that is not in the backup.`);
    if (!weekIds.has(a.weekId)) err(`Result "${a.id}" belongs to a week that is not in the backup.`);
    else if (weekById.get(a.weekId).studentId !== a.studentId) err(`Result "${a.id}" is linked to another student's week.`);
    if (!snapKeys.has(`${a.weekId}@${a.snapshotVersion}`)) err(`Result "${a.id}" refers to a lesson version that is not in the backup.`);
    if (!Number.isFinite(a.score) || !Number.isFinite(a.total)) err(`Result "${a.id}" has no score.`);
  });
  d.images.forEach((im) => { if (isObj(im) && !(isStr(im.dataUrl) && /^data:image\/(png|jpeg|webp|gif);base64,/.test(im.dataUrl))) err(`Image "${im.id}" is not a valid picture.`); });
  d.meta.forEach((m, i) => { if (!isObj(m) || !isStr(m.key)) err(`Setting #${i + 1} is malformed.`); });

  const summary = {
    exportedAt: obj.exportedAt || null, students: d.students.length, weeks: d.weeks.length,
    approvedVersions: d.snapshots.length, results: d.attempts.length, pictures: d.images.length,
    studentNames: d.students.map((s) => s && s.displayName).filter(isStr),
  };
  return { ok: errors.length === 0, errors, summary };
}

export function parseBackupText(text) {
  if (typeof text !== 'string' || !text.trim()) return { ok: false, errors: ['The file is empty.'], summary: null };
  if (text.length > MAX_BACKUP_BYTES) return { ok: false, errors: ['The file is too large to be a Word Workshop backup.'], summary: null };
  let obj;
  try { obj = JSON.parse(text); } catch { return { ok: false, errors: ['The file is damaged or is not a backup (it is not valid JSON).'], summary: null }; }
  return { ...validateBackup(obj), obj };
}
