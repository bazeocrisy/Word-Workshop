// Pure backup-file validation (no DOM, no storage) so it can be unit-tested in Node.
// The validator must never throw: any malformed input becomes a list of readable errors.
import { SCHEMA_VERSION, snapshotIntegrityErrors, itemIntegrityErrors } from './model.js';

export const APP_ID = 'word-workshop';
export const MAX_BACKUP_BYTES = 200 * 1024 * 1024;
const ID_RE = /^[A-Za-z0-9_@.-]{1,80}$/;

const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const isStr = (x) => typeof x === 'string';
const isInt = (x, min = 0) => Number.isInteger(x) && x >= min;
const isArr = Array.isArray;
const strOrNull = (x) => x === null || x === undefined || isStr(x);

function checkVocabItem(v, where, err) {
  if (!isObj(v)) return err(`${where}: a vocabulary item is malformed.`);
  const bad = [];
  for (const k of ['id', 'word', 'originalTranscription', 'sourceDefinition', 'sentence']) if (!isStr(v[k])) bad.push(k);
  if (!strOrNull(v.parentDefinition)) bad.push('parentDefinition');
  if (!strOrNull(v.sentenceSource)) bad.push('sentenceSource');
  for (const k of ['ackKeys', 'importedFlags', 'definitionLog']) if (!isArr(v[k])) bad.push(k);
  if (typeof v.reviewed !== 'boolean') bad.push('reviewed');
  if (v.image != null && !(isObj(v.image) && isStr(v.image.ref))) bad.push('image');
  if (bad.length) err(`${where}: vocabulary item "${isStr(v.word) ? v.word : '?'}" is missing or has bad fields (${bad.join(', ')}).`);
}

function checkSpellingItem(s, where, err) {
  if (!isObj(s)) return err(`${where}: a spelling item is malformed.`);
  const bad = [];
  for (const k of ['id', 'word', 'originalTranscription', 'sentence']) if (!isStr(s[k])) bad.push(k);
  if (!strOrNull(s.sentenceSource)) bad.push('sentenceSource');
  if (!isArr(s.ackKeys)) bad.push('ackKeys');
  if (typeof s.reviewed !== 'boolean') bad.push('reviewed');
  if (s.groups != null && !(isObj(s.groups) && isObj(s.groups.spelling))) bad.push('groups');
  if (bad.length) err(`${where}: spelling word "${isStr(s.word) ? s.word : '?'}" is missing or has bad fields (${bad.join(', ')}).`);
}

function validate(obj) {
  const errors = [];
  const err = (m) => { if (errors.length < 25) errors.push(m); };
  if (!isObj(obj)) return { errors: ['This file is not a Word Workshop backup (not a JSON object).'], summary: null };
  if (obj.app !== APP_ID) err('This file is not a Word Workshop backup (missing app name).');
  if (!isInt(obj.schemaVersion, 1)) err('The backup has no valid version number.');
  else if (obj.schemaVersion > SCHEMA_VERSION) err(`This backup was made by a newer version of Word Workshop (format ${obj.schemaVersion}). Update the app first.`);
  const d = obj.data;
  if (!isObj(d)) { err('The backup has no data section.'); return { errors, summary: null }; }
  for (const k of ['students', 'weeks', 'snapshots', 'attempts', 'images', 'meta']) if (!isArr(d[k])) err(`The backup is missing its "${k}" list.`);
  if (errors.length) return { errors, summary: null };

  const ids = (list, label) => {
    const seen = new Set();
    list.forEach((r, i) => {
      if (!isObj(r) || !isStr(r.id) || !ID_RE.test(r.id)) { err(`${label} #${i + 1} has a missing or invalid id.`); return; }
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
    const where = `Week "${w.id}"`;
    if (!studentIds.has(w.studentId)) err(`${where} belongs to a student that is not in the backup.`);
    if (!isStr(w.startDate)) err(`${where} has no start date.`);
    if (!isInt(w.revision) || !isInt(w.approvedVersion ?? -1, 0)) err(`${where} has an invalid revision or version number.`);
    if (w.approvedRevision != null && !isInt(w.approvedRevision)) err(`${where} has an invalid approved revision.`);
    if (!isArr(w.editLog) || !isArr(w.sources ?? []) || !isObj(w.settings)) err(`${where} is missing its history or settings.`);
    if (!isArr(w.vocab) || !isArr(w.spelling)) { err(`${where} is missing its word lists.`); return; }
    w.vocab.forEach((v) => checkVocabItem(v, where, err));
    w.spelling.forEach((s) => checkSpellingItem(s, where, err));
    if (!errors.length) for (const e of itemIntegrityErrors(w)) err(`${where}: ${e}`);
  });
  const snapKeys = new Set();
  d.snapshots.forEach((s) => {
    if (!isObj(s)) return;
    const where = `Lesson version "${s.id}"`;
    if (!isInt(s.version, 1)) { err(`${where} has an invalid version number.`); return; }
    snapKeys.add(`${s.weekId}@${s.version}`);
    const wk = weekById.get(s.weekId);
    if (!wk) err(`${where} belongs to a week that is not in the backup.`);
    else if (s.studentId !== wk.studentId) err(`${where} is linked to a different student than its week.`);
    if (s.id !== `${s.weekId}@${s.version}`) err(`${where} has an inconsistent id.`);
    if (!isArr(s.vocab) || !isArr(s.spelling)) { err(`${where} is missing its word lists.`); return; }
    s.vocab.forEach((v) => {
      if (!isObj(v) || !isStr(v.word) || !isStr(v.definition) || !isStr(v.teacherDefinition) || !isStr(v.sentence ?? '')) err(`${where} has a malformed vocabulary entry.`);
      else if (v.image && isStr(v.image.ref) && !v.image.ref.startsWith('sample:') && !imageIds.has(v.image.ref)) err(`${where} uses a picture that is not in the backup.`);
    });
    s.spelling.forEach((v) => { if (!isObj(v) || !isStr(v.word) || !isStr(v.sentence ?? '')) err(`${where} has a malformed spelling entry.`); });
    for (const e of snapshotIntegrityErrors(s)) err(`${where}: ${e}`);
  });
  weekById.forEach((w) => { if (w.approvedVersion && !snapKeys.has(`${w.id}@${w.approvedVersion}`)) err(`Week "${w.id}" says it is approved but its approved lesson is missing.`); });
  d.attempts.forEach((a) => {
    if (!isObj(a)) return;
    if (!studentIds.has(a.studentId)) err(`Result "${a.id}" belongs to a student that is not in the backup.`);
    if (!weekIds.has(a.weekId)) err(`Result "${a.id}" belongs to a week that is not in the backup.`);
    else if (weekById.get(a.weekId).studentId !== a.studentId) err(`Result "${a.id}" is linked to another student's week.`);
    if (!snapKeys.has(`${a.weekId}@${a.snapshotVersion}`)) err(`Result "${a.id}" refers to a lesson version that is not in the backup.`);
    if (!isInt(a.score) || !isInt(a.total) || a.score > a.total) err(`Result "${a.id}" has an invalid score.`);
    if (a.questions != null && !isArr(a.questions)) err(`Result "${a.id}" has malformed answers.`);
  });
  d.images.forEach((im) => { if (isObj(im) && !(isStr(im.dataUrl) && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(im.dataUrl))) err(`Image "${im.id}" is not a valid picture.`); });
  d.meta.forEach((m, i) => { if (!isObj(m) || !isStr(m.key)) err(`Setting #${i + 1} is malformed.`); });

  const summary = {
    exportedAt: isStr(obj.exportedAt) ? obj.exportedAt : null, students: d.students.length, weeks: d.weeks.length,
    approvedVersions: d.snapshots.length, results: d.attempts.length, pictures: d.images.length,
    studentNames: d.students.map((s) => s && s.displayName).filter(isStr),
  };
  return { errors, summary };
}

/** Returns { ok, errors, summary }. Never throws. Nothing is written unless ok. */
export function validateBackup(obj) {
  try {
    const { errors, summary } = validate(obj);
    return { ok: errors.length === 0, errors, summary };
  } catch (e) {
    return { ok: false, errors: ['The backup is damaged and could not be read (' + (e && e.message ? e.message : 'unknown problem') + ').'], summary: null };
  }
}

export function parseBackupText(text) {
  if (typeof text !== 'string' || !text.trim()) return { ok: false, errors: ['The file is empty.'], summary: null };
  if (text.length > MAX_BACKUP_BYTES) return { ok: false, errors: ['The file is too large to be a Word Workshop backup.'], summary: null };
  let obj;
  try { obj = JSON.parse(text); } catch { return { ok: false, errors: ['The file is damaged or is not a backup (it is not valid JSON).'], summary: null }; }
  return { ...validateBackup(obj), obj };
}
