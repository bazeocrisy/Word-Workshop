// End-to-end browser tests (headless Chrome/Edge over CDP, no dependencies).
// Serves the repo under /Word-Workshop/ exactly like GitHub Pages and drives the app like a parent and a student.
// Run: npm run test:browser   (set CHROME_PATH if Chrome/Edge is not found; SHOTS=1 saves screenshots)
import path from 'node:path';
import { ROOT, BASE, startServer, startBrowser } from './lib/harness.mjs';
import { suites } from './browser/index.mjs';

const results = [];
export function check(name, ok, detail) {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? '✔' : '✖'} ${name}${!ok && detail !== undefined ? ' — ' + JSON.stringify(detail).slice(0, 600) : ''}`);
}

const LIVE = process.env.LIVE_URL;
const server = LIVE ? { origin: '', missing: [], close() {} } : await startServer();
const b = await startBrowser();
const URL = LIVE ? LIVE.replace(/\/?$/, '/') : server.origin + BASE;
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;

// Navigate by hash and wait for the router to finish rendering.
b.go = async (hash) => {
  // A test in progress asks before leaving; tests that navigate away accept it.
  await b.js(`location.hash = ${JSON.stringify(hash)}; await new Promise((r) => setTimeout(r, 60));
    const leave = [...document.querySelectorAll('.dialog .btn-primary')].find((x) => x.textContent === 'Leave');
    if (leave) { leave.click(); await new Promise((r) => setTimeout(r, 60)); }
    await WW.whenRendered();`);
  await b.wait(60);
};
b.text = () => b.js(`return document.getElementById('app').innerText;`);
b.fresh = async () => {
  await b.load(URL + 'index.html');
  await b.js(`for (let i = 0; i < 100 && !window.WW?.ready; i++) await new Promise((r) => setTimeout(r, 50)); await WW.db.deleteDatabase(); sessionStorage.clear(); localStorage.clear();`);
  await b.load('about:blank');
  await b.load(URL + 'index.html#/');
  await b.js(`for (let i = 0; i < 100 && !window.WW?.ready; i++) await new Promise((r) => setTimeout(r, 50));`);
};
b.click = (selector, textMatch) => b.js(`
  const els = [...document.querySelectorAll(${JSON.stringify(selector)})].filter((e) => ${textMatch ? `e.textContent.trim().match(${textMatch})` : 'true'});
  if (!els.length) throw new Error('No element for ' + ${JSON.stringify(selector + ' ' + (textMatch || ''))});
  els[0].click(); return true;`);
b.settle = async () => { await b.js('await new Promise((r) => setTimeout(r, 30)); await WW.whenRendered();'); await b.wait(60); };
b.shotIf = async (name) => { if (process.env.SHOTS) await b.shot(path.join(ROOT, 'tests', 'screenshots', name + '.png')); };

try {
  await b.viewport(390, 844);
  for (const s of suites) {
    if (only && !only.includes(s.name)) continue;
    console.log(`\n── ${s.name} ──`);
    try { await s.run({ b, check, URL, server }); }
    catch (e) { check(`${s.name}: suite crashed`, false, e.message); }
  }
  if (!LIVE) check('no missing files (all paths resolve under /Word-Workshop/)', server.missing.length === 0, server.missing);
  check('no JavaScript errors', b.errors.length === 0, b.errors.slice(0, 5));
} finally {
  b.close();
  server.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} browser checks passed`);
process.exit(failed.length ? 1 : 0);
