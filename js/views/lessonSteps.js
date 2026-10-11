// The lesson workspace's stages and "where to continue" (kept small: the home page and dashboard use it).
import * as store from '../store.js';

export const STAGES = ['add', 'check', 'finish'];
const LABELS = { add: 'Add words', check: 'Check words', finish: 'Finish' };
// Stage names used by the earlier four-step wizard, so saved progress and old links still work.
const OLD = { start: 'add', words: 'add', review: 'check', approve: 'finish' };
export const lessonHref = (wid) => `#/parent/lesson/${wid}`;
export const stageKey = (wid) => `wizard:${wid}`;
export const stageLabel = (key) => `Next: ${LABELS[key] || LABELS.add}`;

/** The stage an unfinished lesson was left at (or the sensible one for its contents). */
export async function resumeStage(week) {
  const k = await store.getMeta(stageKey(week.id));
  if (STAGES.includes(k)) return k;
  if (OLD[k]) return OLD[k];
  return week.vocab.length + week.spelling.length ? 'check' : 'add';
}

/** Where "Continue" takes the parent. */
export async function resumeHref(week) { return `${lessonHref(week.id)}?stage=${await resumeStage(week)}`; }

/** Old wizard addresses (#/parent/week/:wid/start|words|review|approve) open the workspace at the matching stage. */
export const oldStage = (key) => OLD[key];
