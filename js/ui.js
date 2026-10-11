// Tiny DOM helpers shared by all views.

/** h('button', { class: 'btn', onclick }, 'Label', child, [more]) — attributes, then children (strings/nodes/arrays/null). */
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k in el && typeof v !== 'string' && k !== 'list') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, children);
  return el;
}

export function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const clear = (el) => { while (el.firstChild) el.firstChild.remove(); return el; };

/** Replace an element's children, skipping null/false (unlike the native replaceChildren, which prints "null"). */
export const fill = (el, ...children) => append(clear(el), children);

export function btn(label, onclick, cls = '', attrs = {}) {
  return h('button', { type: 'button', class: `btn ${cls}`.trim(), onclick, ...attrs }, label);
}

export function link(label, href, cls = '', attrs = {}) {
  return h('a', { href, class: cls, ...attrs }, label);
}

/** Page wrapper: title (h1, focused after navigation), optional back link, body. */
export function page({ title, back, backLabel = 'Back', subtitle, actions, cls = '' }, ...body) {
  return h('section', { class: `page ${cls}`.trim() },
    h('div', { class: 'page-head' },
      back ? h('a', { href: back, class: 'back-link' }, h('span', { 'aria-hidden': 'true' }, '‹ '), backLabel) : null,
      h('h1', { tabindex: '-1' }, title),
      subtitle ? h('p', { class: 'subtitle' }, subtitle) : null,
      actions ? h('div', { class: 'page-actions' }, actions) : null),
    ...body);
}

let toastTimer;
export function toast(message, kind = 'info') {
  let el = document.getElementById('toast');
  if (!el) {
    el = h('div', { id: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(el);
  }
  el.className = `toast toast-${kind} show`;
  el.textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3500);
}

/** Accessible modal dialog. Resolves with the value of the clicked button (or null on cancel / Escape). */
let dialogCount = 0;
export function dialog({ title, body, buttons = [{ label: 'OK', value: true, cls: 'btn-primary' }], cancel = 'Cancel' }) {
  return new Promise((resolve) => {
    const prev = document.activeElement;
    const behind = [...document.body.children].filter((el) => !el.classList.contains('overlay') && !el.inert);
    const titleId = `dlg-title-${++dialogCount}`;
    const value = (b) => (typeof b.value === 'function' ? b.value() : b.value);
    const close = (v) => {
      overlay.remove(); document.removeEventListener('keydown', onKey, true);
      behind.forEach((el) => { el.inert = false; });
      if (prev && prev.focus) prev.focus();
      resolve(v);
    };
    const focusables = () => [...box.querySelectorAll('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])')].filter((el) => !el.disabled);
    const onKey = (e) => {
      if (!document.body.contains(overlay) || overlay !== [...document.querySelectorAll('.overlay')].pop()) return;
      if (e.key === 'Escape' && cancel) { e.preventDefault(); close(null); }
      if (e.key === 'Tab') { // keep keyboard focus inside the dialog
        const f = focusables(); if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    };
    const main = buttons[buttons.length - 1];
    // A form so that Enter in a text field triggers the main button.
    const box = h('form', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, onsubmit: (e) => { e.preventDefault(); if (main) close(value(main)); } },
      h('h2', { id: titleId }, title),
      typeof body === 'string' ? h('p', null, body) : body,
      h('div', { class: 'dialog-buttons' },
        cancel ? btn(cancel, () => close(null), 'btn-ghost') : null,
        buttons.map((b) => btn(b.label, () => close(value(b)), b.cls || 'btn-primary'))));
    const overlay = h('div', { class: 'overlay', onclick: (e) => { if (e.target === overlay && cancel) close(null); } }, box);
    document.body.append(overlay);
    behind.forEach((el) => { el.inert = true; });
    document.addEventListener('keydown', onKey, true);
    const first = box.querySelector('input, textarea, select') || box.querySelector('.dialog-buttons .btn:last-child');
    if (first) first.focus();
  });
}

export const confirmDialog = (title, body, okLabel = 'Yes', danger = false) =>
  dialog({ title, body, buttons: [{ label: okLabel, value: true, cls: danger ? 'btn-danger' : 'btn-primary' }] });

export function alertDialog(title, body) { return dialog({ title, body, buttons: [{ label: 'OK', value: true }], cancel: null }); }

export function field(label, input, hint) {
  const id = input.id || (input.id = 'f_' + Math.random().toString(36).slice(2, 9));
  return h('div', { class: 'field' }, h('label', { for: id }, label), hint ? h('p', { class: 'hint', id: id + '_hint' }, hint) : null, input);
}

export function badge(text, kind = '') { return h('span', { class: `badge ${kind ? 'badge-' + kind : ''}`.trim() }, text); }

export function progressBar(done, total, label) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(total), 'aria-valuenow': String(done), 'aria-label': label || `${done} of ${total}` },
    h('div', { class: 'progress-fill', style: { width: pct + '%' } }));
}

export function emptyState(text, ...actions) { return h('div', { class: 'empty' }, h('p', null, text), actions.length ? h('div', { class: 'row' }, actions) : null); }

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function pct(score, total) { return total ? Math.round((score / total) * 100) : 0; }

export function fmtDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
