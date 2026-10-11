import { h, page, link, btn, field, dialog, toast } from '../ui.js';
import { getMeta, setMeta, getStudent } from '../store.js';

export function errorPage(e) {
  return page({ title: 'Something went wrong', back: '#/', backLabel: 'Home' },
    h('div', { class: 'card notice notice-error' },
      h('p', null, e && e.message ? e.message : String(e)),
      h('p', null, 'Your saved work is not affected. Go back and try again.')));
}

export function notFoundPage() {
  return page({ title: 'Page not found', back: '#/', backLabel: 'Home' }, h('p', null, 'That page does not exist.'), link('Go home', '#/', 'btn btn-primary'));
}

export function themeClass(student) { return student && student.color ? `theme-${student.color}` : 'theme-sky'; }

export async function requireStudent(sid) {
  const st = await getStudent(sid);
  if (!st) throw new Error('That student profile was not found.');
  return st;
}

export function avatar(student, size = '') {
  const initial = (student.displayName || '?').trim().charAt(0).toUpperCase();
  return h('span', { class: `avatar ${themeClass(student)} ${size}`.trim(), 'aria-hidden': 'true' }, initial);
}

// ── Parent PIN (a speed bump for children, not security) ──

const SESSION_KEY = 'ww-parent-unlocked';

async function hashPin(pin, salt) {
  const data = new TextEncoder().encode(salt + ':' + pin);
  if (globalThis.crypto && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let x = 5381; for (const b of data) x = ((x << 5) + x + b) | 0; return 'djb2:' + x;
}

export async function pinEnabled() { return !!(await getMeta('parentPin')); }

export async function setPin(pin) {
  if (!pin) { await setMeta('parentPin', null); sessionStorage.removeItem(SESSION_KEY); return; }
  const salt = Math.random().toString(36).slice(2, 10);
  await setMeta('parentPin', { salt, hash: await hashPin(pin, salt) });
  sessionStorage.setItem(SESSION_KEY, '1');
}

export async function checkPin(pin) {
  const p = await getMeta('parentPin');
  if (!p) return true;
  return (await hashPin(pin, p.salt)) === p.hash;
}

export function lockParent() { try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ } }

/** Wrap a parent view: shows a PIN prompt when a PIN is set and this tab has not unlocked yet. */
export function parentOnly(view) {
  return async (ctx) => {
    let unlocked = false;
    try { unlocked = sessionStorage.getItem(SESSION_KEY) === '1'; } catch { /* ignore */ }
    if (unlocked || !(await pinEnabled())) return view(ctx);
    const input = h('input', { type: 'password', inputmode: 'numeric', autocomplete: 'off', maxlength: '8', class: 'pin-input', 'aria-describedby': 'pin-msg' });
    const msg = h('p', { id: 'pin-msg', class: 'hint', 'aria-live': 'polite' }, 'Enter the parent PIN.');
    const form = h('form', { class: 'card narrow', onsubmit: async (e) => {
      e.preventDefault();
      if (await checkPin(input.value)) { sessionStorage.setItem(SESSION_KEY, '1'); dispatchEvent(new HashChangeEvent('hashchange')); }
      else { msg.textContent = 'That PIN is not right. Try again.'; msg.classList.add('error-text'); input.value = ''; input.focus(); }
    } }, field('Parent PIN', input), msg, h('div', { class: 'row' }, h('button', { type: 'submit', class: 'btn btn-primary' }, 'Unlock'), link('Back to students', '#/', 'btn btn-ghost')));
    return page({ title: 'Parent area', back: '#/', backLabel: 'Students' }, form);
  };
}

export async function askPinDialog() {
  const a = h('input', { type: 'password', inputmode: 'numeric', maxlength: '8', autocomplete: 'new-password' });
  const b = h('input', { type: 'password', inputmode: 'numeric', maxlength: '8', autocomplete: 'new-password' });
  const v = await dialog({ title: 'Set a parent PIN', body: h('div', null, h('p', { class: 'hint' }, '4 to 8 digits. This keeps children out of the parent area on a shared device. It is not a password and does not encrypt data.'), field('New PIN', a), field('Type it again', b)),
    buttons: [{ label: 'Save PIN', value: () => ({ a: a.value, b: b.value }) }] });
  if (!v) return false;
  if (!/^\d{4,8}$/.test(v.a)) { toast('The PIN must be 4 to 8 digits.', 'error'); return false; }
  if (v.a !== v.b) { toast('The two PINs did not match.', 'error'); return false; }
  await setPin(v.a);
  toast('Parent PIN saved.');
  return true;
}

export function deviceNotice() {
  return h('p', { class: 'device-note' }, 'Everything is saved in this browser on this device only. It does not sync to other devices. Use Backup to keep a copy or move it.');
}

export { btn };
