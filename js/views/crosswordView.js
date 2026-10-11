// Vocabulary crossword: the clues are the teacher's definitions; the answers are this week's words.
// Type in the squares (the cursor moves along the word), tap a square twice to switch across/down, or tap a clue.
import { h, fill, page, btn, link, toast, emptyState } from '../ui.js';
import { loadLesson } from './lesson.js';
import { themeClass, avatar } from './common.js';
import { buildCrossword, checkPuzzle, wordAt, nextCell, prevCell } from '../crossword.js';

const hash = (s) => { let x = 2166136261; for (const c of String(s)) { x ^= c.charCodeAt(0); x = Math.imul(x, 16777619); } return x >>> 0; };

export async function crosswordView({ params, query }) {
  const { st, snap, error } = await loadLesson(params);
  if (error) return error;
  const back = `#/s/${st.id}/vocab?w=${snap.weekId}`;
  const shell = (...body) => h('div', { class: themeClass(st) }, page({ title: 'Crossword', back, backLabel: 'Vocabulary', cls: 'kid area-vocab crossword-page', actions: [avatar(st), h('span', { class: 'who' }, st.displayName)] }, ...body));
  const entries = snap.vocab.map((v) => ({ id: v.id, word: v.word, clue: v.definition }));
  if (entries.length < 2) return shell(emptyState('A crossword needs at least two vocabulary words.'));
  const puzzleNo = Number(query.n) || 1;
  const pz = buildCrossword(entries, { seed: hash(`${snap.weekId}:${snap.version}:${puzzleNo}`), maxSize: 17 });
  const key = `ww-cross:${st.id}:${snap.weekId}:v${snap.version}:${puzzleNo}`;
  let saved = {}; try { saved = JSON.parse(sessionStorage.getItem(key) || '{}'); } catch { /* ignore */ }
  const answers = pz.cells.map((row, r) => row.map((c, k) => (c ? (saved[`${r},${k}`] || '') : null)));
  const persist = () => { const o = {}; answers.forEach((row, r) => row.forEach((v, k) => { if (v) o[`${r},${k}`] = v; })); try { sessionStorage.setItem(key, JSON.stringify(o)); } catch { /* ignore */ } };
  const all = [...pz.across.map((e) => ({ ...e, direction: 'across' })), ...pz.down.map((e) => ({ ...e, direction: 'down' }))];
  let cur = { row: all[0].row, col: all[0].col, direction: all[0].direction };
  let checked = false;

  const inputs = new Map();
  const grid = h('div', { class: 'cw-grid', role: 'grid', 'aria-label': 'Crossword', style: { gridTemplateColumns: `repeat(${pz.width}, var(--cw-cell))` } });
  pz.cells.forEach((row, r) => row.forEach((c, k) => {
    if (!c) { grid.append(h('div', { class: 'cw-block', 'aria-hidden': 'true' })); return; }
    const inp = h('input', { type: 'text', inputmode: 'text', maxlength: '1', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', class: 'cw-input', value: answers[r][k], 'aria-label': cellLabel(r, k) });
    inputs.set(`${r},${k}`, inp);
    inp.addEventListener('focus', () => { if (cur.row !== r || cur.col !== k) { cur = { row: r, col: k, direction: wordAt(pz, r, k, cur.direction)?.direction || cur.direction }; } highlight(); });
    inp.addEventListener('click', () => { if (cur.row === r && cur.col === k && wordAt(pz, r, k, other(cur.direction))?.direction === other(cur.direction)) { cur.direction = other(cur.direction); highlight(); } });
    inp.addEventListener('keydown', (e) => onKey(e, r, k));
    inp.addEventListener('input', () => { const ch = (inp.value.match(/[a-z]/i) || [''])[0].toUpperCase(); inp.value = ch; answers[r][k] = ch; persist(); clearMarks(); if (ch) move(1); });
    grid.append(h('div', { class: 'cw-cell' }, c.number ? h('span', { class: 'cw-num', 'aria-hidden': 'true' }, String(c.number)) : null, inp));
  }));
  function cellLabel(r, k) {
    const a = wordAt(pz, r, k, 'across'), d = wordAt(pz, r, k, 'down');
    const parts = [a && a.direction === 'across' ? `${a.number} across, letter ${k - a.col + 1} of ${a.length}` : null, d && d.direction === 'down' ? `${d.number} down, letter ${r - d.row + 1} of ${d.length}` : null].filter(Boolean);
    return parts.join('; ');
  }
  const other = (d) => (d === 'across' ? 'down' : 'across');
  const clueBanner = h('p', { class: 'cw-current', 'aria-live': 'polite' });
  const list = (dir) => h('section', { class: 'cw-clues', 'aria-labelledby': `cw-${dir}` }, h('h2', { id: `cw-${dir}` }, dir === 'across' ? 'Across' : 'Down'),
    h('ol', null, (dir === 'across' ? pz.across : pz.down).map((e) => h('li', { value: e.number },
      btn(h('span', null, h('strong', null, `${e.number}. `), e.clue, h('span', { class: 'muted' }, ` (${e.length})`)), () => { cur = { row: e.row, col: e.col, direction: dir }; inputs.get(`${e.row},${e.col}`)?.focus(); highlight(); }, `cw-clue cw-clue-${dir}-${e.number}`)))));
  const clueLists = h('div', { class: 'cw-lists' }, list('across'), list('down'));
  const highlight = () => {
    const w = wordAt(pz, cur.row, cur.col, cur.direction);
    if (w) cur.direction = w.direction;
    inputs.forEach((inp) => inp.parentElement.classList.remove('is-word', 'is-cur'));
    if (w) for (let i = 0; i < w.length; i++) { const r = w.row + (w.direction === 'down' ? i : 0), k = w.col + (w.direction === 'across' ? i : 0); inputs.get(`${r},${k}`)?.parentElement.classList.add('is-word'); }
    inputs.get(`${cur.row},${cur.col}`)?.parentElement.classList.add('is-cur');
    clueLists.querySelectorAll('.cw-clue').forEach((b) => b.classList.remove('is-cur'));
    if (w) { clueLists.querySelector(`.cw-clue-${w.direction}-${w.number}`)?.classList.add('is-cur'); fill(clueBanner, h('strong', null, `${w.number} ${w.direction === 'across' ? 'Across' : 'Down'}: `), w.clue, h('span', { class: 'muted' }, ` (${w.length} letters)`)); }
  };
  const focusCell = (c) => { if (!c) return; cur = { row: c.row, col: c.col, direction: c.direction || cur.direction }; inputs.get(`${c.row},${c.col}`)?.focus(); highlight(); };
  const move = (d) => focusCell(d > 0 ? nextCell(pz, cur.row, cur.col, cur.direction) : prevCell(pz, cur.row, cur.col, cur.direction));
  function onKey(e, r, k) {
    const arrows = { ArrowRight: [0, 1, 'across'], ArrowLeft: [0, -1, 'across'], ArrowDown: [1, 0, 'down'], ArrowUp: [-1, 0, 'down'] };
    if (arrows[e.key]) {
      e.preventDefault();
      const [dr, dk, dir] = arrows[e.key];
      if (cur.direction !== dir && wordAt(pz, r, k, dir)?.direction === dir) { cur.direction = dir; highlight(); return; }
      let rr = r + dr, kk = k + dk;
      while (rr >= 0 && kk >= 0 && rr < pz.height && kk < pz.width) { if (pz.cells[rr][kk]) { focusCell({ row: rr, col: kk, direction: cur.direction }); return; } rr += dr; kk += dk; }
    } else if (e.key === 'Backspace' && !inputs.get(`${r},${k}`).value) { e.preventDefault(); move(-1); const c = inputs.get(`${cur.row},${cur.col}`); if (c) { c.value = ''; answers[cur.row][cur.col] = ''; persist(); } }
    else if (e.key === 'Enter') { e.preventDefault(); const w = wordAt(pz, r, k, cur.direction); const i = all.findIndex((x) => x.number === w?.number && x.direction === w?.direction); const n = all[(i + 1) % all.length]; focusCell({ row: n.row, col: n.col, direction: n.direction }); }
  }
  const result = h('div', { class: 'cw-result', 'aria-live': 'polite' });
  const clearMarks = () => { if (!checked) return; checked = false; inputs.forEach((inp) => inp.parentElement.classList.remove('is-right', 'is-wrong')); fill(result, ''); };
  const check = () => {
    const res = checkPuzzle(pz, answers);
    checked = true;
    inputs.forEach((inp, kk) => { const [r, k] = kk.split(',').map(Number); const v = answers[r][k]; inp.parentElement.classList.toggle('is-right', !!v && v === pz.cells[r][k].letter); inp.parentElement.classList.toggle('is-wrong', !!v && v !== pz.cells[r][k].letter); });
    if (res.correctCells === res.totalCells) { fill(result, h('div', { class: 'card notice notice-ok' }, h('p', { class: 'sf-big' }, '🎉 You solved the whole crossword!'), link('Back to Vocabulary', back, 'btn btn-primary'))); toast('You solved it!'); }
    else fill(result, h('p', { class: 'cw-progress' }, `${res.correctCells} of ${res.totalCells} squares are right. ${res.wordsCorrect.length} of ${all.length} words are finished. Red squares need another look.`));
  };
  const unplaced = pz.unplaced.length ? h('p', { class: 'hint' }, `${pz.unplaced.length} word${pz.unplaced.length === 1 ? ' did' : 's did'} not fit in this puzzle. Try "New puzzle".`) : null;
  const root = shell(
    h('p', { class: 'hint cw-how' }, 'Read the clue, then type the word. Tap a square twice to switch between across and down.'),
    clueBanner,
    h('div', { class: 'cw-layout' }, h('div', { class: 'cw-wrap' }, grid), clueLists),
    unplaced,
    h('div', { class: 'row cw-actions' }, btn('✔ Check my answers', check, 'btn-primary btn-big cw-check'),
      btn('Clear', () => { answers.forEach((row, r) => row.forEach((v, k) => { if (v != null) answers[r][k] = ''; })); inputs.forEach((i) => { i.value = ''; }); persist(); clearMarks(); focusCell(all[0]); }, 'btn-ghost cw-clear'),
      link('New puzzle', `#/s/${st.id}/w/${snap.weekId}/vocab/crossword?n=${puzzleNo + 1}`, 'btn btn-ghost cw-new')),
    result);
  queueMicrotask(highlight);
  return root;
}
