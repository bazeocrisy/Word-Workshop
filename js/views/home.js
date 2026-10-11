// Landing page: what Word Workshop is for, with one area for parents (create and manage lessons)
// and one for students (study and test approved lessons).
import { h, page, link } from '../ui.js';
import { listStudents, listWeeks } from '../store.js';
import { weekLabel, weekStatus } from '../model.js';
import { avatar, themeClass, parentLocked } from './common.js';
import { resumeHref } from './lessonSteps.js';

export async function homeView() {
  const students = await listStudents();
  // Unfinished lessons (never approved, or changed since approval), most recently changed first, so a parent can
  // pick up where they left off. Not listed while a parent PIN locks the parent area.
  const drafts = [];
  if (!(await parentLocked())) for (const s of students) for (const w of await listWeeks(s.id)) if (!w.approvedVersion || weekStatus(w) === 'pending-changes') drafts.push({ s, w });
  drafts.sort((a, b) => String(b.w.updatedAt).localeCompare(String(a.w.updatedAt)));
  const resume = await Promise.all(drafts.slice(0, 2).map(async ({ s, w }) => link(
    h('span', null, h('span', { class: 'resume-what' }, `Continue unfinished lesson: ${s.displayName}`), h('span', { class: 'resume-when' }, weekLabel(w))),
    await resumeHref(w), 'btn btn-ghost resume-btn')));

  const parent = h('section', { class: 'card home-area home-parent', 'aria-labelledby': 'home-parent' },
    h('h2', { id: 'home-parent' }, 'Parents: create and manage lessons'),
    h('p', null, 'Add the teacher\'s spelling and vocabulary lists for the week, from a photo or by typing. Check them, then approve the lesson.'),
    link(h('span', null, h('span', { 'aria-hidden': 'true' }, '＋ '), 'Create this week\'s lesson'), '#/parent/new', 'btn btn-primary btn-big create-lesson'),
    resume.length ? h('div', { class: 'resume-list' }, resume) : null,
    h('div', { class: 'row home-links' }, link('Manage lessons', '#/parent', 'btn btn-ghost manage-lessons')));

  const kids = h('section', { class: 'card home-area home-students', 'aria-labelledby': 'home-students' },
    h('h2', { id: 'home-students' }, 'Students: study and test'),
    h('p', null, 'Pick your name to study, practise and take tests on the lessons a grown-up has approved.'),
    students.length
      ? h('ul', { class: 'profile-grid', role: 'list' }, students.map((s) =>
        h('li', null, h('a', { href: `#/s/${s.id}`, class: `profile-card ${themeClass(s)}` },
          avatar(s, 'avatar-lg'),
          h('span', { class: 'profile-name' }, s.displayName),
          s.grade ? h('span', { class: 'profile-grade' }, `Grade ${s.grade}`) : null))))
      : h('p', { class: 'hint' }, 'No students yet. A grown-up can add one in Settings.'));

  return page({ title: 'Word Workshop', cls: 'home',
    subtitle: 'Weekly spelling and vocabulary practice, made from your child\'s school lists.' },
  h('div', { class: 'home-grid' }, parent, kids));
}
