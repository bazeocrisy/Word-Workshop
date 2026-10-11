// Milestone 5: photo upload → on-device OCR → review beside the photo → drafts in the week (never approved).
// Uses SYNTHETIC pages (generated, made to look photographed). Real-photo accuracy: npm run test:ocr.
import { SYNTHETIC } from '../lib/synthetic.mjs';

const pickFiles = (expr) => `
  const files = await (${expr});
  const input = document.getElementById('photo-input');
  const before = document.querySelectorAll('.thumb-page').length + '|' + (document.querySelector('.notice-error')?.innerText || '');
  const dt = new DataTransfer(); for (const f of files) dt.items.add(f);
  input.files = dt.files; input.dispatchEvent(new Event('change'));
  const now = () => document.querySelectorAll('.thumb-page').length + '|' + (document.querySelector('.notice-error')?.innerText || '');
  for (let i = 0; i < 100 && now() === before; i++) await new Promise((r) => setTimeout(r, 100));
  return document.getElementById('app').innerText;`;
const waitForReview = `for (let i = 0; i < 600 && !document.querySelector('.commit-btn, .notice-error'); i++) await new Promise((r) => setTimeout(r, 200)); return document.getElementById('app').innerText;`;

export default {
  name: 'ocr',
  async run({ b, check }) {
    await b.fresh();
    const [sid] = await b.js(`return (await WW.store.listStudents()).map((s) => s.id);`);
    const wid = await b.js(`return (await WW.store.createWeek(${JSON.stringify(sid)}, { startDate: '2026-10-12', endDate: '2026-10-16' })).id;`);
    await b.js(SYNTHETIC + ' return 1;');
    await b.go(`#/parent/week/${wid}/import`);
    let t = await b.text();
    check('photo import page explains photos stay on the device', /stay on this device/.test(t) && /Choose photos/.test(t));

    // Unsupported file → clear message, nothing added.
    t = await b.js(pickFiles(`[new File(['hello'], 'notes.txt', { type: 'text/plain' })]`));
    check('a non-picture file is refused with a clear message', /notes\.txt is not a picture/.test(t), t.slice(0, 300));
    check('Read button stays disabled with no pages', await b.js(`return document.querySelector('.read-btn').disabled;`));

    // Two pages: spelling newsletter + vocabulary sheet.
    t = await b.js(pickFiles(`Promise.all([window.__makeSynthetic('spelling'), window.__makeSynthetic('vocab')])`));
    check('two pages are added with rotate/remove controls', (await b.js(`return document.querySelectorAll('.thumb-page').length;`)) === 2 && /Turn page 1 right/.test(await b.js(`return document.querySelector('.thumb-page').innerHTML;`)));
    await b.click('.read-btn');
    t = await b.js(waitForReview);
    check('pages are read on the device and shown for checking', /Check the text against the photo/.test(t), t.slice(0, 300));
    const shown = await b.js(`return { photos: document.querySelectorAll('.ocr-photo img').length, sp: document.getElementById('ocr-spelling').value, vo: document.getElementById('ocr-vocab').value, preview: document.querySelector('.paste-preview').innerText };`);
    check('each source photo is displayed beside the extracted text', shown.photos === 2);
    check('headings and notes are separated from the words (Reminders not imported)', !/Picture day|Reminders|Weekly News|Name:/.test(shown.sp + shown.vo), { sp: shown.sp, vo: shown.vo.slice(0, 200) });
    check('preview finds 15 spelling and 12 vocabulary words', /15 spelling words/.test(shown.preview) && /12 vocabulary words/.test(shown.preview), shown.preview);

    // Parent fixes a line before adding (correction workflow), then adds as drafts.
    await b.js(`const ta = document.getElementById('ocr-vocab'); ta.value = ta.value.replace('Fresh fruits and vegetables', 'Fresh fruit and vegetables'); ta.dispatchEvent(new Event('input'));
      ta.value += '\\nProducts – Things that are made'; ta.dispatchEvent(new Event('input'));
      const sp = document.getElementById('ocr-spelling'); sp.value = sp.value.replace('hunted', 'hunnted') + '\\nrusted'; sp.dispatchEvent(new Event('input')); return 1;`);
    await b.click('.commit-btn');
    await b.wait(800); await b.settle();
    const wk = await b.js(`return await WW.store.getWeek(${JSON.stringify(wid)});`);
    const typedSp = wk.spelling.find((s) => s.word === 'rusted');
    const typedVo = wk.vocab.find((v) => v.word === 'Products');
    check('rows typed on the review screen are stored as typed, not as corrections of similar reader words',
      typedSp && typedSp.origin === 'typed' && typedVo && typedVo.origin === 'typed' && typedVo.definitionLog.length === 0 && wk.spelling.find((s) => s.word === 'rushed').origin === 'ocr', { typedSp, typedVo });
    wk.spelling = wk.spelling.filter((s) => s !== typedSp); wk.vocab = wk.vocab.filter((v) => v !== typedVo);
    check('imported words land in the week as unchecked drafts', wk.spelling.length === 15 && wk.vocab.length === 12 && [...wk.spelling, ...wk.vocab].every((x) => !x.reviewed && x.origin === 'ocr'));
    check('spelling words keep the teacher\'s numbered order', wk.spelling.map((s) => s.word).join(',') === 'rushed,blasted,washed,winked,opened,buzzed,asked,called,lifted,landed,hunnted,screamed,stepped,handed,crashed', wk.spelling.map((s) => s.word));
    check('words and definitions are paired correctly', wk.vocab.find((v) => v.word === 'Trustworthy')?.sourceDefinition === 'The ability to keep promises' && wk.vocab.find((v) => v.word === 'Constellations')?.sourceDefinition.endsWith('a pattern'));
    check('reader confidence is stored on each word', wk.vocab.every((v) => typeof v.ocrConfidence === 'number') && wk.spelling.every((s) => typeof s.ocrConfidence === 'number'));
    const produce = wk.vocab.find((v) => v.word === 'Produce');
    check('a definition corrected on the review screen keeps what the reader read and logs the correction',
      produce.originalTranscription === 'Fresh fruits and vegetables' && produce.sourceDefinition === 'Fresh fruit and vegetables'
      && produce.definitionLog.length === 1 && produce.definitionLog[0].from === 'Fresh fruits and vegetables', produce);
    const hun = wk.spelling.find((s) => s.word === 'hunnted');
    const buz = wk.spelling.find((s) => s.word === 'buzzed');
    check('a spelling word changed on the review screen remembers the reader\'s version; others on the same line keep their confidence',
      hun && hun.originalTranscription === 'hunted' && typeof buz.ocrConfidence === 'number', { hun, buz: buz && buz.ocrConfidence });
    check('source pages are kept with the raw reader text', wk.sources.filter((s) => s.kind === 'photo').length === 2 && wk.sources.every((s) => s.kind !== 'photo' || (s.imageRef && s.ocrText.length > 50)));
    check('the week is not approved by importing', !wk.approvedVersion);
    t = await b.text();
    check('editor shows the source pages for comparison', /Source pages \(2\)/.test(t));
    check('editor shows the raw text the photo reader found', (await b.js(`return document.querySelectorAll('.raw-ocr pre').length;`)) === 2);
    check('editor shows "First captured as" for the corrected definition', /First captured as: "Fresh fruits and vegetables"/.test(t));
    await b.go(`#/s/${sid}/w/${wid}`);
    check('students cannot see imported words before approval', /not ready yet/.test(await b.text()));

    // Table of word cards (the teacher's real vocabulary format), photographed at a slant: the parent marks the
    // table corners and the number of cards; each card is read on its own.
    const w3 = await b.js(`return (await WW.store.createWeek(${JSON.stringify(sid)}, { startDate: '2026-11-09', endDate: '2026-11-13' })).id;`);
    await b.go(`#/parent/week/${w3}/import`);
    await b.js(pickFiles(`Promise.all([window.__makeSynthetic('cards', { rotate: 3 })])`));
    await b.click('.corners-btn');
    await b.wait(300);
    const tool = await b.js(`
      const stage = document.querySelector('.corner-stage'); const handles = [...stage.querySelectorAll('.corner-handle')];
      const img = stage.querySelector('img'); const W = img.naturalWidth, H = img.naturalHeight;
      // keyboard: arrow keys move a handle
      const before = handles[0].style.left; handles[0].focus(); handles[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      const movedByKey = handles[0].style.left !== before;
      // drag each handle onto the table's corners
      const r = stage.getBoundingClientRect();
      window.__cardsCorners.forEach((p, k) => {
        const cx = r.left + (p.x / W) * r.width, cy = r.top + (p.y / H) * r.height;
        handles[k].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: cx, clientY: cy, pointerId: 1 }));
        handles[k].dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: cx, clientY: cy, pointerId: 1 }));
        handles[k].dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: cx, clientY: cy, pointerId: 1 }));
      });
      const sels = document.querySelectorAll('.dialog .grid-count'); sels[0].value = '4'; sels[1].value = '3';
      return { handles: handles.length, named: handles.every((x) => /corner of the table/.test(x.getAttribute('aria-label'))), movedByKey };`);
    check('corner tool: four labelled handles, movable by keyboard and by dragging', tool.handles === 4 && tool.named && tool.movedByKey, tool);
    await b.click('.dialog .btn-primary', '/Use these corners/');
    await b.wait(200);
    check('the page shows that table corners are marked', /Table corners marked/.test(await b.js(`return document.querySelector('.corners-btn').textContent;`)));
    await b.click('.read-btn');
    await b.js(waitForReview);
    const tv = await b.js(`return document.getElementById('ocr-vocab').value;`);
    const pairs = tv.split('\n').filter(Boolean);
    const expected = { Produce: 'Fresh fruits and vegetables', Constellations: 'A group of stars in the night sky that make up a picture or a pattern', Distracted: 'To prevent something from continuing as usual', Trustworthy: 'The ability to keep promises' };
    check('table mode reads all 12 cards, each word with its own definition', pairs.length === 12 && Object.entries(expected).every(([w, d]) => tv.includes(`${w} – ${d}`)), tv.slice(0, 400));
    await b.click('.commit-btn'); await b.wait(800); await b.settle();
    const w3d = await b.js(`return await WW.store.getWeek(${JSON.stringify(w3)});`);
    check('card words arrive as unchecked drafts with a "check each card" warning', w3d.vocab.length === 12 && w3d.vocab.every((v) => !v.reviewed && v.importedFlags.some((f) => /table of word cards/.test(f))));
    const refused = await b.js(`try { await WW.store.approveWeek(${JSON.stringify(w3)}); return 'approved'; } catch (e) { return (e.blockers || []).length; }`);
    check('approval stays blocked until the parent checks every imported card', typeof refused === 'number' && refused >= 12, refused);
    await b.js(`
      const li = [...document.querySelectorAll('[data-item]')].find((x) => x.querySelector('.word-input')?.value === 'Peculiar');
      const ta = li.querySelector('.teacher-def'); ta.value = 'strange or unusual (corrected)'; ta.dispatchEvent(new Event('change'));
      await new Promise((r) => setTimeout(r, 400)); return 1;`);
    const pec3 = await b.js(`return (await WW.store.getWeek(${JSON.stringify(w3)})).vocab.find((v) => v.word === 'Peculiar');`);
    check('a parent correction to a card definition is recorded with the original reading', pec3.originalTranscription === 'strange or unusual' && pec3.definitionLog.at(-1).to === 'strange or unusual (corrected)');

    // A blank photo → no words found, with next steps.
    await b.go(`#/parent/week/${wid}/import`);
    await b.js(pickFiles(`(async () => { const c = document.createElement('canvas'); c.width = 800; c.height = 600; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 800, 600); return [new File([await new Promise((r) => c.toBlob(r, 'image/png'))], 'blank.png', { type: 'image/png' })]; })()`));
    await b.click('.read-btn');
    t = await b.js(waitForReview);
    check('a photo with no text says no words were found and offers typing instead', /No words were found/.test(t) && /Type or paste instead/.test(t), t.slice(0, 300));
  },
};
