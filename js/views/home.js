// First screen: "Who is learning today?" — big name cards. Grown-ups' settings and backup are a small link at
// the bottom (behind the parent PIN when one is set).
import { h, page, link } from '../ui.js';
import { listStudents } from '../store.js';
import { avatar, themeClass } from './common.js';

export async function homeView() {
  const students = await listStudents();
  return page({ title: 'Who is learning today?', cls: 'kid home' },
    students.length
      ? h('ul', { class: 'profile-grid', role: 'list' }, students.map((s) =>
        h('li', null, h('a', { href: `#/s/${s.id}`, class: `profile-card ${themeClass(s)}` },
          avatar(s, 'avatar-lg'),
          h('span', { class: 'profile-name' }, s.displayName),
          s.grade ? h('span', { class: 'profile-grade' }, `Grade ${s.grade}`) : null))))
      : h('p', null, 'No students yet. A grown-up can add one in Settings.'),
    h('p', { class: 'grownups' }, link(h('span', null, h('span', { 'aria-hidden': 'true' }, '⚙️ '), 'Grown-ups: settings and backup'), '#/parent/settings', 'grownups-link')));
}
