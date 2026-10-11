// The lesson wizard's steps and "where to continue" (kept small: the home page and dashboard use it).
import * as store from '../store.js';

export const STEPS = [
  { key: 'start', label: 'Student and week' },
  { key: 'words', label: 'Add words' },
  { key: 'review', label: 'Review' },
  { key: 'approve', label: 'Approve' },
];
export const stepHref = (wid, key) => `#/parent/week/${wid}/${key}`;
export const stepKey = (wid) => `wizard:${wid}`;
export const stepLabel = (key) => { const i = STEPS.findIndex((s) => s.key === key); return `Step ${i + 1} of 4: ${STEPS[i].label}`; };

export async function rememberStep(wid, key) { try { await store.setMeta(stepKey(wid), key); } catch { /* not essential */ } }

/** The step an unfinished lesson was left at (or the sensible one for its contents). */
export async function resumeStep(week) {
  const k = await store.getMeta(stepKey(week.id));
  if (STEPS.some((s) => s.key === k)) return k;
  return week.vocab.length + week.spelling.length ? 'review' : 'words';
}

/** Where "Continue" takes the parent: the wizard for unfinished lessons, the lesson editor for approved ones. */
export async function resumeHref(week) {
  if (week.approvedVersion) return `#/parent/week/${week.id}`;
  return stepHref(week.id, await resumeStep(week));
}
