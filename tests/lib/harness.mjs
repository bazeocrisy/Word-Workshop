// Shared test harness: static server under /Word-Workshop/ (like GitHub Pages) + headless Chrome/Edge over CDP.
// No dependencies (Node 22+ for the built-in WebSocket).
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const BASE = '/Word-Workshop/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.gz': 'application/gzip', '.wasm': 'application/wasm', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };

export async function startServer() {
  const missing = [];
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    if (!url.startsWith(BASE)) { if (!url.endsWith('favicon.ico')) missing.push(url); res.writeHead(404).end(); return; }
    let file = path.join(ROOT, url.slice(BASE.length));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { missing.push(url); res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { origin: `http://127.0.0.1:${server.address().port}`, missing, close: () => server.close() };
}

export async function startBrowser() {
  const candidates = [process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean);
  const exe = candidates.find((p) => fs.existsSync(p));
  if (!exe) throw new Error('No Chrome/Edge found. Set CHROME_PATH.');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ww-chrome-'));
  const proc = spawn(exe, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
  let port;
  for (let i = 0; i < 150 && !port; i++) {
    await new Promise((r) => setTimeout(r, 100));
    try { port = fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch { /* not ready */ }
  }
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let nextId = 0;
  const pending = new Map();
  const errors = [];
  let loadWaiters = [];
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    if (msg.method === 'Page.loadEventFired') { loadWaiters.forEach((r) => r()); loadWaiters = []; }
    if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args.map((a) => a.value || a.description).join(' '));
  });
  const send = (method, params = {}) => {
    const id = ++nextId;
    ws.send(JSON.stringify({ id, method, params }));
    return new Promise((r) => pending.set(id, r));
  };
  await send('Page.enable');
  await send('Runtime.enable');
  const b = {
    errors, send,
    async js(expr) {
      const r = await send('Runtime.evaluate', { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true });
      if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'evaluate failed');
      return r.result.result.value;
    },
    wait: (ms) => new Promise((r) => setTimeout(r, ms)),
    /** Navigate and wait for the real load event (not a fixed delay), then let the page's scripts settle. */
    async load(url) {
      const loaded = new Promise((r) => { loadWaiters.push(r); setTimeout(r, 10000); });
      const res = await send('Page.navigate', { url });
      // Same-document (hash-only) navigations fire no load event.
      if (res.result && res.result.loaderId) await loaded;
      await b.wait(250);
    },
    /** Run page code that follows a link (e.g. a click) and wait for the new page's load event. */
    async navigate(expr) {
      const loaded = new Promise((r) => { loadWaiters.push(r); setTimeout(r, 10000); });
      await b.js(expr);
      await loaded;
      await b.wait(250);
    },
    async reload() {
      const loaded = new Promise((r) => { loadWaiters.push(r); setTimeout(r, 10000); });
      await send('Page.reload', {});
      await loaded;
      await b.wait(250);
    },
    async hash(h) { await b.js(`location.hash = '${h}';`); await b.wait(250); },
    async viewport(width, height, mobile = width < 1024) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
      await send('Emulation.setTouchEmulationEnabled', { enabled: mobile });
    },
    async shot(file, full = true) {
      const m = await b.js('return { w: document.documentElement.clientWidth, h: document.documentElement.scrollHeight };');
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full, clip: full ? { x: 0, y: 0, width: m.w, height: Math.min(m.h, 14000), scale: 1 } : undefined });
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, Buffer.from(r.result.data, 'base64'));
    },
    async key(key, shift = false) {
      const code = key === 'Tab' ? 'Tab' : key;
      const vk = { Tab: 9, Enter: 13, ' ': 32 }[key] || 0;
      const mods = shift ? 8 : 0;
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: vk, modifiers: mods });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk, modifiers: mods });
    },
    // Ask Chrome to quit, then make sure the whole process tree is gone (on Windows, proc.kill() alone can leave
    // headless Chrome running; hundreds of leftovers eventually stop new browsers from starting).
    close() {
      try { ws.send(JSON.stringify({ id: ++nextId, method: 'Browser.close' })); } catch { /* ignore */ }
      try { ws.close(); } catch { /* ignore */ }
      try {
        if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
        else proc.kill();
      } catch { /* ignore */ }
    }
  };
  return b;
}

