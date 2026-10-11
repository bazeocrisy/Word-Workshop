// Shared loader for student lesson screens: always the approved snapshot of the student's own week.
import { h, page, emptyState } from '../ui.js';
import { getApprovedLesson, getSnapshot } from '../store.js';
import { requireStudent, themeClass } from './common.js';

export async function loadLesson(params, version) {
  const st = await requireStudent(params.sid);
  let snap = await getApprovedLesson(params.wid);
  if (snap && version && Number(version) !== snap.version) snap = await getSnapshot(params.wid, Number(version));
  if (!snap || snap.studentId !== st.id) {
    return { error: page({ title: 'Lesson not available', back: `#/s/${st.id}`, backLabel: 'My weeks' }, emptyState('This lesson is not ready yet. Ask a grown-up to approve it.')) };
  }
  return { st, snap, base: `#/s/${st.id}/w/${snap.weekId}` };
}

export function themed(st, el) { return h('div', { class: themeClass(st) }, el); }
