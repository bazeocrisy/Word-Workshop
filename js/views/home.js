import { h, page, link } from '../ui.js';
import { listStudents } from '../store.js';
import { avatar, themeClass, deviceNotice } from './common.js';

export async function homeView() {
  const students = await listStudents();
  return page({ title: 'Who is studying today?', cls: 'home' },
    students.length
      ? h('ul', { class: 'profile-grid', role: 'list' }, students.map((s) =>
        h('li', null, h('a', { href: `#/s/${s.id}`, class: `profile-card ${themeClass(s)}` },
          avatar(s, 'avatar-lg'),
          h('span', { class: 'profile-name' }, s.displayName),
          s.grade ? h('span', { class: 'profile-grade' }, `Grade ${s.grade}`) : null))))
      : h('p', null, 'No students yet. A grown-up can add one in the parent area.'),
    h('div', { class: 'home-parent' }, link('Parent area', '#/parent', 'btn btn-ghost', { 'aria-label': 'Parent area: add and approve weekly words' })),
    deviceNotice());
}
