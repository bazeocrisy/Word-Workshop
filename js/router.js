// Hash router: '#/s/:sid/w/:wid?type=mc' → { params, query }. Works under any base path (GitHub Pages).

const routes = [];
let notFound = null;
let current = null;
let leaveGuard = null;

export function route(pattern, view) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/\//g, '\\/').replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ re, keys, view });
}
export function fallback(view) { notFound = view; }

export function parseHash(hash = location.hash) {
  const raw = hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = raw.split('?');
  return { path, query: Object.fromEntries(new URLSearchParams(qs)) };
}

export function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }

/** A view can block navigation (e.g. during a test) by registering a guard that returns true to allow leaving. */
export function setLeaveGuard(fn) { leaveGuard = fn; }

let lastHash = location.hash;
let rendering = Promise.resolve();

export async function render() {
  const target = location.hash;
  if (leaveGuard && target !== lastHash) {
    const ok = await leaveGuard();
    if (!ok) { history.replaceState(null, '', lastHash || '#/'); return; }
  }
  leaveGuard = null;
  lastHash = target;
  const { path, query } = parseHash(target);
  const root = document.getElementById('app');
  const token = Symbol('render');
  current = token;
  for (const r of routes) {
    const m = r.re.exec(path);
    if (!m) continue;
    const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    rendering = show(r.view, { params, query, path }, root, token);
    return rendering;
  }
  if (notFound) rendering = show(notFound, { params: {}, query, path }, root, token);
  return rendering;
}

async function show(view, ctx, root, token) {
  root.setAttribute('aria-busy', 'true');
  let el;
  try { el = await view(ctx); }
  catch (e) {
    console.warn(e);
    const { errorPage } = await import('./views/common.js');
    el = errorPage(e);
  }
  if (current !== token) return; // a newer navigation won
  root.replaceChildren(el);
  root.removeAttribute('aria-busy');
  window.scrollTo(0, 0);
  const h1 = root.querySelector('h1');
  if (h1) h1.focus({ preventScroll: true });
  document.title = (h1 ? h1.textContent + ' · ' : '') + 'Word Workshop';
  document.dispatchEvent(new CustomEvent('ww:rendered', { detail: ctx }));
}

export function start() {
  window.addEventListener('hashchange', render);
  return render();
}

export const whenRendered = () => rendering;
