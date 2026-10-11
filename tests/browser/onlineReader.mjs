// Online photo reader (optional): settings, reading a worksheet through the reader server, and falling back to the
// on-device reader when the server refuses. The server is replaced by a stub of window.fetch (no network, no cost).
import { SYNTHETIC } from '../lib/synthetic.mjs';

const type = (sel, value) => `{ const el = document.querySelector(${JSON.stringify(sel)});
  el.focus(); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }`;
const pause = (ms = 300) => `await new Promise((r) => setTimeout(r, ${ms}));`;
const lessonId = 'return location.hash.split("/")[3].split("?")[0];';
const upload = (target, kind) => `const f = await window.__makeSynthetic('${kind}');
  const input = document.querySelector('input[type=file][data-target="${target}"]');
  const dt = new DataTransfer(); dt.items.add(f); input.files = dt.files; input.dispatchEvent(new Event('change'));
  for (let i = 0; i < 500 && !document.querySelector('.ws-reading, .ws-read-error'); i++) await new Promise((r) => setTimeout(r, 20));
  for (let i = 0; i < 600 && (document.querySelector('.ws-reading')); i++) await new Promise((r) => setTimeout(r, 200));
  await new Promise((r) => setTimeout(r, 300));
  return { stage: document.querySelector('.ws-tab.is-current .ws-tab-label')?.textContent, error: document.querySelector('.ws-read-error')?.innerText || null };`;

const READER = 'https://reader.example.workers.dev/';
// Stub server: answers like server/ocr-worker/worker.js. status 200 with the reply, or an error status.
const stub = (status, reply) => `window.__readerCalls = [];
  const realFetch = window.__realFetch || (window.__realFetch = window.fetch);
  window.fetch = async (url, init) => {
    if (String(url) !== ${JSON.stringify(READER)}) return realFetch(url, init);
    const body = JSON.parse(init.body); window.__readerCalls.push({ headers: init.headers, body: { ...body, image: body.image ? body.image.length : 0 } });
    return new Response(JSON.stringify(${status === 200 ? JSON.stringify(reply) : JSON.stringify({ error: 'x' })}), { status: ${status}, headers: { 'Content-Type': 'application/json' } });
  };`;

const REPLY = {
  model: 'claude-sonnet-5-5', notes: ['Bottom row partly cut off'],
  spelling: [],
  vocabulary: [
    { word: 'Produce', definition: 'Fresh fruits and vegetables', unsure: false },
    { word: 'Exception', definition: 'A case where a rule does not apply', unsure: false },
    { word: 'Peculiar', definition: 'Strange or unusual', unsure: true },
  ],
};

export default {
  name: 'onlineReader',
  async run({ b, check }) {
    await b.fresh();
    // Settings: the section exists; saving stores the address and passphrase in this browser only.
    await b.go('#/parent/settings');
    let t = await b.text();
    check('settings: an optional online photo reader section explains cost and privacy', /Online photo reader/.test(t) && /Anthropic/.test(t) && /cents per photo/.test(t));
    await b.js(`${stub(200, REPLY)} return 1;`);
    await b.js(`${type('.online-reader input[type=url]', READER)} ${type('.online-reader input[type=password]', 'family-reader-pass-2026-oct')} document.getElementById('online-reader-on').click(); return 1;`);
    await b.click('.online-reader .btn-ghost', '/Test connection/'); await b.wait(400);
    check('settings: Test connection reaches the reader with the passphrase', /Connected/.test(await b.js(`return document.querySelector('.online-reader [aria-live]').textContent;`))
      && (await b.js(`return window.__readerCalls[0].headers['X-Reader-Key'];`)) === 'family-reader-pass-2026-oct');
    await b.click('.online-reader .btn-primary', '/Save/'); await b.wait(200);
    const cfg = await b.js(`return JSON.parse(localStorage.getItem('ww-online-reader'));`);
    check('settings: saved in this browser', cfg && cfg.url === READER && cfg.passphrase === 'family-reader-pass-2026-oct' && cfg.enabled);
    await b.go('#/parent'); await b.go('#/parent/settings');
    check('settings: the saved passphrase is not shown back in the page', (await b.js(`return document.querySelector('.online-reader input[type=password]').value;`)) === ''
      && /Saved/.test(await b.js(`return document.querySelector('.online-reader input[type=password]').placeholder;`)));
    check('settings: says photos leave the device, go to Anthropic, cost money, and recommends a PIN', /Photos leave this device/.test(await b.text()) && /Anthropic/.test(await b.text()) && /cents per photo/.test(await b.text()) && /parent PIN/.test(await b.text()));
    await b.js(`${type('.online-reader input[type=password]', 'short')} return 1;`);
    await b.click('.online-reader .btn-primary', '/Save/'); await b.wait(200);
    check('settings: a short passphrase is refused', (await b.js(`return JSON.parse(localStorage.getItem('ww-online-reader')).passphrase;`)) === 'family-reader-pass-2026-oct');
    const backupText = await b.js(`const m = await import(new URL('js/backup.js', location.href).href); return JSON.stringify(await m.buildBackup());`);
    const csp = await b.js(`const seen = []; const on = (e) => seen.push(e.violatedDirective); document.addEventListener('securitypolicyviolation', on);
      try { await (window.__realFetch || fetch)('https://word-workshop-reader.example.workers.dev/', { method: 'POST', body: '{}' }); } catch { /* no such server: fine */ }
      await new Promise((r) => setTimeout(r, 300)); document.removeEventListener('securitypolicyviolation', on); return seen;`);
    check('the page may contact a Cloudflare Workers reader (not blocked by its security policy)', csp.length === 0, csp);
    check('settings: the passphrase is not in backups', backupText.length > 100 && !backupText.includes('family-reader-pass-2026-oct') && !backupText.includes('reader.example'));

    // Reading a vocabulary photo online.
    await b.js(SYNTHETIC + ' return 1;');
    const [alex] = await b.js(`return (await WW.store.listStudents()).map((s) => s.id);`);
    await b.go('#/parent/new');
    await b.js(`document.querySelector('input[name=ws-student][value="${alex}"]').click(); ${type('#ws-start', '2026-11-09')} ${pause(200)} return 1;`);
    await b.js(`window.__labels = []; new MutationObserver(() => { const x = document.querySelector('.ws-reading'); if (x) window.__labels.push(x.innerText); }).observe(document.getElementById('app'), { childList: true, subtree: true, characterData: true }); return 1;`);
    let r = await b.js(upload('vocab', 'vocab'));
    check('online: while reading, the screen says the photo goes to the online reader (Anthropic), not "on this device"', await b.js(`return window.__labels.some((x) => /online reader \\(Anthropic\\)/.test(x)) && !window.__labels.some((x) => /on this device/.test(x));`));
    const wid = await b.js(lessonId);
    let wk = await b.js(`return await WW.store.getWeek(${JSON.stringify(wid)});`);
    const call = await b.js(`return window.__readerCalls.at(-1);`);
    check('online: the photo is sent once, as the vocabulary page, with the passphrase', call && call.body.target === 'vocab' && call.body.mediaType === 'image/jpeg' && call.body.image > 1000 && call.headers['X-Reader-Key'] === 'family-reader-pass-2026-oct', call);
    check('online: the words arrive in Check with the reader\'s exact definitions', r.stage === 'Check' && !r.error && wk.vocab.map((v) => v.word).join() === 'Produce,Exception,Peculiar'
      && wk.vocab[1].sourceDefinition === 'A case where a rule does not apply' && wk.vocab[1].originalTranscription === 'A case where a rule does not apply', { r, wk: wk.vocab });
    check('online: every word is an unchecked draft read from the photo', wk.vocab.every((v) => !v.reviewed && v.origin === 'ocr'));
    check('online: a word the reader was unsure about needs attention', wk.vocab[2].ocrConfidence < 80 && wk.vocab[2].importedFlags.some((f) => /not sure/.test(f)) && wk.vocab[0].ocrConfidence >= 80);
    check('online: the source photo records which reader read it', /^online/.test(wk.sources[0].reader) && /Produce – Fresh fruits/.test(wk.sources[0].ocrText));
    t = await b.text();
    const viewer = async () => { await b.click('.ws-photos-btn'); await b.wait(300); const v = await b.js(`return document.querySelector('.dialog')?.innerText || '';`); await b.js(`[...document.querySelectorAll('.dialog .btn')].find((x) => x.textContent === 'Close')?.click(); return 1;`); await b.wait(150); return v; };
    check('online: the reader\'s own warning ("Bottom row partly cut off") is on screen, saying the online reader was used', /with the online reader/.test(t) && /Bottom row partly cut off/.test(t), t.slice(0, 800));
    const v1 = await viewer();
    check('online: the photo (phone viewer) says which reader read it, with its warning', /read by the online reader/.test(v1) && /Bottom row partly cut off/.test(v1), v1);

    // The server refuses (wrong passphrase): the photo is read on this device instead, and the parent is told.
    await b.js(`${stub(401)} return 1;`);
    await b.go('#/parent/new');
    await b.js(`document.querySelector('input[name=ws-student][value="${alex}"]').click(); ${type('#ws-start', '2026-11-16')} ${pause(200)} return 1;`);
    r = await b.js(upload('spelling', 'spelling'));
    const wid2 = await b.js(lessonId);
    wk = await b.js(`return await WW.store.getWeek(${JSON.stringify(wid2)});`);
    check('fallback: a refused online reading is read on this device instead', r.stage === 'Check' && wk.spelling.length >= 10 && wk.sources[0].reader === 'on device', { r, n: wk.spelling.length });
    check('fallback: the reason is kept with the photo for the parent', (wk.sources[0].notes || []).some((n) => /passphrase is wrong/.test(n) && /read on this device instead/.test(n)), wk.sources[0].notes);
    const shown = () => b.js(`return document.querySelector('.ws-read-notice')?.innerText || '';`);
    check('fallback: the switch to on-device reading is explained on screen', /on this device/.test(await shown()) && /passphrase is wrong/.test(await shown()), await shown());
    await b.click('.ws-tab:nth-child(1)'); await b.wait(150); await b.click('.ws-tab:nth-child(2)'); await b.wait(150);
    check('fallback: the explanation stays until the parent dismisses it', /passphrase is wrong/.test(await shown()));
    const v2 = await viewer();
    check('fallback: the photo (phone viewer) says it was read on this device, and why', /read on this device/.test(v2) && /passphrase is wrong/.test(v2), v2);
    await b.click('.ws-read-notice-ok'); await b.wait(100);
    check('fallback: OK dismisses it', !(await shown()));
  },
};
