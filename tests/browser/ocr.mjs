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
    check('headings and notes are separated from the words (Reminders not imported)', !/Picture day/.test(shown.sp + shown.vo) && /Left out/.test(shown.preview), shown.preview);
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

    // A blank photo → no words found, with next steps.
    await b.go(`#/parent/week/${wid}/import`);
    await b.js(pickFiles(`(async () => { const c = document.createElement('canvas'); c.width = 800; c.height = 600; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 800, 600); return [new File([await new Promise((r) => c.toBlob(r, 'image/png'))], 'blank.png', { type: 'image/png' })]; })()`));
    await b.click('.read-btn');
    t = await b.js(waitForReview);
    check('a photo with no text says no words were found and offers typing instead', /No words were found/.test(t) && /Type or paste instead/.test(t), t.slice(0, 300));
  },
};
