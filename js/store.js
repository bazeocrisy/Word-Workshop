// Domain operations on top of IndexedDB. Student-facing code reads lessons only through
// getApprovedLesson()/listApprovedWeeks(), which return frozen snapshots — never working drafts.
import { transact, get, getAll, getAllBy, put, del, STORES } from './db.js';
import { uid, nowIso, newWeek, buildSnapshot, approvalBlockers, snapshotIntegrityErrors, weekStatus } from './model.js';

export const DEMO_STUDENTS = [
  { displayName: 'Alex', grade: 3, color: 'sky' },
  { displayName: 'Jordan', grade: 5, color: 'berry' },
];
export const COLORS = ['sky', 'berry', 'mint', 'sun', 'grape', 'coral'];

// ── Students ─────────────────────────────────────────────────────────────────

export async function ensureSetup() {
  const done = await get('meta', 'setup');
  if (done) return false;
  await transact(['students', 'meta'], 'readwrite', (s) => {
    DEMO_STUDENTS.forEach((d, i) => s.students.put({ id: uid('st'), ...d, order: i, createdAt: nowIso() }));
    s.meta.put({ key: 'setup', at: nowIso() });
  });
  return true;
}

export async function listStudents() {
  return (await getAll('students')).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.displayName.localeCompare(b.displayName));
}
export const getStudent = (id) => get('students', id);

export async function addStudent({ displayName, grade, color }) {
  const all = await listStudents();
  const st = { id: uid('st'), displayName: displayName.trim() || 'New student', grade: Number(grade) || null, color: color || COLORS[all.length % COLORS.length], order: all.length, createdAt: nowIso() };
  await put('students', st);
  return st;
}

export async function updateStudent(id, patch) {
  return transact(['students'], 'readwrite', async (s, d) => {
    const st = await d(s.students.get(id));
    if (!st) throw new Error('Student not found.');
    const next = { ...st, ...patch, id };
    s.students.put(next);
    return next;
  });
}

/** Removal is only allowed when the student has no weeks or results, so nothing is lost by accident. */
export async function removeStudent(id) {
  const [weeks, attempts] = await Promise.all([getAllBy('weeks', 'studentId', id), getAllBy('attempts', 'studentId', id)]);
  if (weeks.length || attempts.length) throw new Error('This student still has weeks or results. Delete those first, or keep the profile.');
  await del('students', id);
}

// ── Weeks (parent working copies) ────────────────────────────────────────────

export async function createWeek(studentId, fields) {
  const st = await getStudent(studentId);
  if (!st) throw new Error('Student not found.');
  const w = newWeek({ studentId, ...fields });
  w.editLog.push({ at: nowIso(), action: 'created' });
  await put('weeks', w);
  return w;
}

export async function listWeeks(studentId) {
  const weeks = await getAllBy('weeks', 'studentId', studentId);
  return weeks.sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)) || String(b.createdAt).localeCompare(String(a.createdAt)));
}

export const getWeek = (id) => get('weeks', id);

/**
 * Change a week's working copy atomically. `mutate(week)` edits in place; `log` describes the change
 * ({ action, detail }). Any change bumps the revision, which moves an approved week to "Changes pending".
 */
export async function editWeek(id, mutate, log) {
  return transact(['weeks'], 'readwrite', async (s, d) => {
    const w = await d(s.weeks.get(id));
    if (!w) throw new Error('Week not found.');
    const r = await mutate(w);
    if (r === false) return w; // mutator decided nothing changed
    w.revision += 1;
    w.updatedAt = nowIso();
    if (log) w.editLog.push({ at: w.updatedAt, revision: w.revision, ...log });
    s.weeks.put(w);
    return w;
  });
}

/** Delete a week, its snapshots and its results. Parent must confirm in the UI. */
export async function deleteWeek(id) {
  return transact(['weeks', 'snapshots', 'attempts'], 'readwrite', async (s, d) => {
    const snaps = await d(s.snapshots.index('weekId').getAllKeys(id));
    const atts = await d(s.attempts.index('weekId').getAllKeys(id));
    snaps.forEach((k) => s.snapshots.delete(k));
    atts.forEach((k) => s.attempts.delete(k));
    s.weeks.delete(id);
  });
}

export async function approveWeek(id) {
  return transact(['weeks', 'snapshots'], 'readwrite', async (s, d) => {
    const w = await d(s.weeks.get(id));
    if (!w) throw new Error('Week not found.');
    const blockers = approvalBlockers(w);
    if (blockers.length) { const e = new Error('This week is not ready to approve.'); e.blockers = blockers; throw e; }
    if (weekStatus(w) === 'approved') return w;
    const version = (w.approvedVersion || 0) + 1;
    const snap = buildSnapshot(w, version);
    const errs = snapshotIntegrityErrors(snap);
    if (errs.length) throw new Error('Definition check failed: ' + errs.join(' '));
    w.approvedVersion = version;
    w.approvedRevision = w.revision;
    w.approvedAt = snap.approvedAt;
    w.editLog.push({ at: snap.approvedAt, revision: w.revision, action: 'approved', detail: `Version ${version}` });
    s.snapshots.put(snap);
    s.weeks.put(w);
    return w;
  });
}

// ── Student-facing (approved snapshots only) ─────────────────────────────────

export async function getSnapshot(weekId, version) { return get('snapshots', `${weekId}@${version}`); }

/** Latest approved lesson for a week, or null if it was never approved. */
export async function getApprovedLesson(weekId) {
  const w = await getWeek(weekId);
  if (!w || !w.approvedVersion) return null;
  return getSnapshot(weekId, w.approvedVersion);
}

/** Approved weeks for a student, newest first, as { week (summary only), snapshot }. */
export async function listApprovedWeeks(studentId) {
  const weeks = (await listWeeks(studentId)).filter((w) => w.approvedVersion);
  const out = [];
  for (const w of weeks) {
    const snap = await getSnapshot(w.id, w.approvedVersion);
    if (snap) out.push(snap);
  }
  return out;
}

export const listSnapshots = (weekId) => getAllBy('snapshots', 'weekId', weekId).then((a) => a.sort((x, y) => x.version - y.version));

// ── Attempts ─────────────────────────────────────────────────────────────────

/** Attempts are append-only: a retake is a new record; old results are never overwritten. */
export async function saveAttempt(attempt) {
  const rec = { id: uid('a'), ...attempt, savedAt: nowIso() };
  if (!rec.studentId || !rec.weekId || !rec.snapshotVersion) throw new Error('Result is missing its student, week or lesson version.');
  await transact(['attempts'], 'readwrite', async (s, d) => {
    if (await d(s.attempts.get(rec.id))) throw new Error('Duplicate result id.');
    s.attempts.put(rec);
  });
  return rec;
}

export async function listAttempts({ studentId, weekId } = {}) {
  let list = studentId ? await getAllBy('attempts', 'studentId', studentId) : weekId ? await getAllBy('attempts', 'weekId', weekId) : await getAll('attempts');
  if (weekId) list = list.filter((a) => a.weekId === weekId);
  return list.sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));
}

export const getAttempt = (id) => get('attempts', id);

// ── Images ───────────────────────────────────────────────────────────────────

export async function saveImage(blob, meta = {}) {
  const rec = { id: uid('img'), blob, type: blob.type, createdAt: nowIso(), ...meta };
  await put('images', rec);
  return rec.id;
}
export const getImage = (id) => get('images', id);

const urlCache = new Map();
export async function imageUrl(ref) {
  if (!ref) return null;
  if (ref.startsWith('sample:')) return `assets/illustrations/sample/${ref.slice(7)}`;
  if (urlCache.has(ref)) return urlCache.get(ref);
  const rec = await getImage(ref);
  if (!rec || !rec.blob) return null;
  const url = URL.createObjectURL(rec.blob);
  urlCache.set(ref, url);
  return url;
}

// ── Meta / settings ──────────────────────────────────────────────────────────

export async function getMeta(key, fallback = null) { const r = await get('meta', key); return r ? r.value : fallback; }
export async function setMeta(key, value) { await put('meta', { key, value }); }

// ── Whole-database export / replace (used by backup.js) ──────────────────────

export async function dumpAll() {
  return transact(STORES, 'readonly', async (s, d) => {
    const out = {};
    for (const n of STORES) out[n] = await d(s[n].getAll());
    return out;
  });
}

export async function replaceAll(data) {
  urlCache.forEach((u) => URL.revokeObjectURL(u));
  urlCache.clear();
  return transact(STORES, 'readwrite', async (s) => {
    for (const n of STORES) s[n].clear();
    for (const n of STORES) for (const rec of data[n] || []) s[n].put(rec);
  });
}
