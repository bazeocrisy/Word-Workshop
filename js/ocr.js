// On-device OCR with Tesseract.js (vendored in vendor/tesseract, Apache-2.0). Photos never leave the device.
// The engine (~7 MB with the English data) downloads from this site the first time and is then cached.
// Output is always a DRAFT: lines of text with the reader's confidence, for the parent to check.

const VENDOR = 'vendor/tesseract/';
let workerPromise = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (window.Tesseract) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('The photo reader could not be loaded.'));
    document.head.append(s);
  });
}

const abs = (p) => new URL(p, location.href).href;

/** Create (once) the OCR worker. `onProgress({ status, progress })` reports download/initialisation. */
export async function getWorker(onProgress) {
  if (!workerPromise) {
    workerPromise = (async () => {
      await loadScript(abs(VENDOR + 'tesseract.min.js'));
      const worker = await window.Tesseract.createWorker('eng', 1, {
        workerPath: abs(VENDOR + 'worker.min.js'),
        corePath: abs(VENDOR + 'core/'),
        langPath: abs(VENDOR + 'lang/'),
        gzip: true,
        logger: (m) => { if (workerPromise.onProgress) workerPromise.onProgress(m); },
        errorHandler: () => {},
      });
      await worker.setParameters({ preserve_interword_spaces: '1' });
      return worker;
    })();
    workerPromise.catch(() => { workerPromise = null; });
  }
  workerPromise.onProgress = onProgress;
  return workerPromise;
}

export async function terminate() {
  if (!workerPromise) return;
  try { (await workerPromise).terminate(); } catch { /* ignore */ }
  workerPromise = null;
}

/**
 * Clean up a photo for reading: greyscale, then a local (adaptive) threshold that removes uneven lighting
 * and shadows. Returns a new canvas.
 */
export function preprocess(src) {
  const w = src.width, h = src.height;
  const ctx = src.getContext('2d', { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const gray = new Float32Array(w * h);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) gray[p] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  // Integral image for fast local means.
  const integ = new Float64Array((w + 1) * (h + 1));
  for (let y = 1; y <= h; y++) {
    let row = 0;
    for (let x = 1; x <= w; x++) { row += gray[(y - 1) * w + (x - 1)]; integ[y * (w + 1) + x] = integ[(y - 1) * (w + 1) + x] + row; }
  }
  const r = Math.max(8, Math.round(Math.max(w, h) / 40));
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const octx = out.getContext('2d');
  const o = octx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
      const sum = integ[y1 * (w + 1) + x1] - integ[y0 * (w + 1) + x1] - integ[y1 * (w + 1) + x0] + integ[y0 * (w + 1) + x0];
      const mean = sum / ((x1 - x0) * (y1 - y0));
      const v = gray[y * w + x] < mean * 0.86 ? 0 : 255; // darker than its surroundings ⇒ ink
      const k = (y * w + x) * 4;
      o.data[k] = o.data[k + 1] = o.data[k + 2] = v; o.data[k + 3] = 255;
    }
  }
  octx.putImageData(o, 0, 0);
  return out;
}

/**
 * Turn Tesseract lines into our line format. A wide gap between words (a table or two-column sheet) becomes a
 * tab, so "Produce        Fresh fruits and vegetables" keeps word and definition apart.
 */
export function linesFromResult(data, pageWidth) {
  const out = [];
  for (const line of data.lines || []) {
    const words = (line.words || []).filter((x) => x.text && x.text.trim());
    if (!words.length) continue;
    const charW = words.reduce((n, x) => n + (x.bbox.x1 - x.bbox.x0) / Math.max(1, x.text.length), 0) / words.length;
    const gapLimit = Math.max(charW * 3.2, pageWidth * 0.035);
    let text = words[0].text;
    // Segments: runs of words separated by wide gaps, with their horizontal position (for column layouts).
    const segs = [{ words: [words[0]] }];
    for (let i = 1; i < words.length; i++) {
      const gap = words[i].bbox.x0 - words[i - 1].bbox.x1;
      text += (gap > gapLimit ? '\t' : ' ') + words[i].text;
      if (gap > gapLimit) segs.push({ words: [words[i]] }); else segs[segs.length - 1].words.push(words[i]);
    }
    text = cleanEdges(text);
    if (!text) continue;
    const segments = segs.map((sg) => ({
      text: sg.words.map((x) => x.text).join(' ').trim(),
      x0: Math.min(...sg.words.map((x) => x.bbox.x0)), x1: Math.max(...sg.words.map((x) => x.bbox.x1)),
      conf: Math.round(Math.min(...sg.words.map((x) => x.confidence))),
    })).filter((sg) => !isJunk(sg.text) && !isShortNoise(sg.text));
    const unsure = words.filter((x) => x.confidence < 75 && text.includes(x.text) && !isJunk(x.text)).map((x) => ({ text: x.text, conf: Math.round(x.confidence) }));
    // A line is only as trustworthy as its least certain real word, so one misread letter still gets flagged.
    const wordConfs = words.filter((x) => !isJunk(x.text)).map((x) => x.confidence);
    const conf = Math.round(Math.min(line.confidence, ...(wordConfs.length ? wordConfs : [line.confidence])));
    const kept = words.filter((x) => !isJunk(x.text) && text.includes(x.text)).map((x) => ({ text: x.text, conf: Math.round(x.confidence) }));
    out.push({ text, conf, unsure, words: kept, segments, bbox: line.bbox });
  }
  return out;
}

/** A fragment that is page-edge noise rather than text: one character, or only punctuation/lines. */
export const isJunk = (t) => { const s = String(t).trim(); return s.length <= 1 || /^[^\p{L}\p{N}]+$/u.test(s); };

/** Remove noise fragments separated from the text by a wide gap (borders, binder holes, shadows). */
export function cleanEdges(text) {
  const segs = String(text).split('\t').map((s) => s.trim()).filter((s) => !isJunk(s));
  // Short fragments at either end of a row ("Ca", "Sa a") are shadow or margin noise, not a column of text.
  while (segs.length > 1 && isShortNoise(segs[segs.length - 1])) segs.pop();
  while (segs.length > 1 && isShortNoise(segs[0]) && !/^\d{1,2}[.)]/.test(segs[0])) segs.shift();
  const out = segs.join('\t');
  return /^[^\p{L}]*$/u.test(out) ? '' : out; // nothing but numbers/marks left
}

// (A bare list number such as "1." is kept: the word may be the next piece of the line.)
const isShortNoise = (s) => s.replace(/\s/g, '').length <= 3 && !/^\d{1,2}[.)]\s*\p{L}/u.test(s) && !/^\d{1,2}[.)]$/.test(s.trim());

/** Estimate how far the page is tilted (degrees), from the angle that lines up the dark pixels into the sharpest rows. */
export function estimateSkew(canvas) {
  const scale = Math.min(1, 1000 / Math.max(canvas.width, canvas.height));
  const small = document.createElement('canvas');
  small.width = Math.max(1, Math.round(canvas.width * scale)); small.height = Math.max(1, Math.round(canvas.height * scale));
  small.getContext('2d').drawImage(canvas, 0, 0, small.width, small.height);
  const bin = preprocess(small);
  const { width: w, height: h } = bin;
  const d = bin.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  const xs = [], ys = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4] === 0) { xs.push(x - w / 2); ys.push(y - h / 2); }
  if (xs.length < 200) return 0;
  const step = Math.max(1, Math.floor(xs.length / 60000));
  const size = Math.ceil(Math.hypot(w, h)) + 2;
  const score = (deg) => {
    const t = (deg * Math.PI) / 180, s = Math.sin(t), c = Math.cos(t);
    const hist = new Float64Array(size);
    for (let i = 0; i < xs.length; i += step) { const r = Math.round(ys[i] * c - xs[i] * s + size / 2); if (r >= 0 && r < size) hist[r]++; }
    let sum = 0; for (const v of hist) sum += v * v; return sum;
  };
  let best = 0, bestScore = -1;
  for (let a = -12; a <= 12; a += 0.5) { const sc = score(a); if (sc > bestScore) { bestScore = sc; best = a; } }
  const coarse = best;
  for (let a = coarse - 0.5; a <= coarse + 0.5; a += 0.1) { const sc = score(a); if (sc > bestScore) { bestScore = sc; best = a; } }
  return Math.round(best * 10) / 10;
}

/** Rotate a canvas by any angle (degrees), on a white background, keeping the whole page. */
export function rotateCanvas(src, deg) {
  const t = (deg * Math.PI) / 180, s = Math.abs(Math.sin(t)), c = Math.abs(Math.cos(t));
  const w = Math.round(src.width * c + src.height * s), h = Math.round(src.width * s + src.height * c);
  const out = document.createElement('canvas'); out.width = w; out.height = h;
  const x = out.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);
  x.translate(w / 2, h / 2); x.rotate(t); x.drawImage(src, -src.width / 2, -src.height / 2);
  return out;
}

const meanConf = (lines) => (lines.length ? lines.reduce((n, l) => n + l.conf, 0) / lines.length : 0);

/**
 * Read one page. Tries the shadow-corrected image first; if the reader is unsure, also tries the plain image
 * and keeps whichever result it was more confident about.
 */
export async function readPage(input, { onProgress } = {}) {
  const worker = await getWorker(onProgress);
  // Straighten tilted photos first: the reader loses accuracy quickly beyond a few degrees.
  const skew = estimateSkew(input);
  const canvas = Math.abs(skew) >= 2.5 ? rotateCanvas(input, -skew) : input; // small tilts read fine; rotating blurs a little
  const attempt = async (c, label) => {
    const { data } = await worker.recognize(c);
    return { lines: linesFromResult(data, c.width), label };
  };
  let best = await attempt(preprocess(canvas), 'cleaned');
  if (meanConf(best.lines) < 80) {
    const plain = await attempt(canvas, 'original');
    if (meanConf(plain.lines) > meanConf(best.lines) + 2) best = plain;
  }
  return { ...best, skew, confidence: Math.round(meanConf(best.lines)) };
}
