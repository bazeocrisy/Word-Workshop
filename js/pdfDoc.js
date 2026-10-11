// Reading-passage PDFs, shown on this device with pdf.js (vendor/pdfjs, Apache-2.0; served from this site).
// Pages are drawn exactly as the document looks; the text (when the PDF has real text, not a scan) is also pulled out
// with its paragraph breaks so a child can read it larger.
const BASE = new URL('../vendor/pdfjs/', import.meta.url).href;
let lib = null;

async function pdfjs() {
  if (lib) return lib;
  lib = await import('../vendor/pdfjs/pdf.min.mjs');
  lib.GlobalWorkerOptions.workerSrc = BASE + 'pdf.worker.min.mjs';
  return lib;
}

/** Open a PDF Blob. Resolves { numPages, page(n) → canvas, text() → { paragraphs, words }, close() }. */
export async function openPdf(blob) {
  const { getDocument } = await pdfjs();
  const data = new Uint8Array(await blob.arrayBuffer());
  // No eval (the site's security policy forbids it); fonts that are not embedded come from this site.
  const doc = await getDocument({ data, isEvalSupported: false, standardFontDataUrl: BASE + 'standard_fonts/', useSystemFonts: true }).promise;
  return {
    numPages: doc.numPages,
    async page(n, width = 1400) {
      const p = await doc.getPage(n);
      const vp1 = p.getViewport({ scale: 1 });
      const vp = p.getViewport({ scale: Math.min(3, width / vp1.width) });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height);
      await p.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
      return canvas;
    },
    async text() {
      const paragraphs = [];
      for (let n = 1; n <= doc.numPages; n++) {
        const p = await doc.getPage(n);
        const tc = await p.getTextContent();
        paragraphs.push(...paragraphsFromItems(tc.items));
      }
      const words = paragraphs.join(' ').split(/\s+/).filter(Boolean).length;
      return { paragraphs, words };
    },
    close() { doc.destroy(); },
  };
}

/**
 * Group pdf.js text items into lines (by baseline) and lines into paragraphs: a new paragraph starts after a gap
 * clearly larger than the usual line spacing, or after a line that is indented. Pure; unit-tested.
 * items: [{ str, transform: [a, b, c, d, x, y], height?, hasEOL? }]
 */
export function paragraphsFromItems(items) {
  const lines = [];
  for (const it of items) {
    if (!it || typeof it.str !== 'string') continue;
    const x = it.transform?.[4] ?? 0, y = it.transform?.[5] ?? 0, size = Math.abs(it.transform?.[3] || it.height || 10);
    let line = lines.find((l) => Math.abs(l.y - y) < size * 0.5);
    if (!line) { line = { y, x, size, parts: [] }; lines.push(line); }
    line.x = Math.min(line.x, x); line.parts.push({ x, str: it.str });
  }
  lines.sort((a, b) => b.y - a.y); // top of the page first
  for (const l of lines) l.text = l.parts.sort((a, b) => a.x - b.x).map((p) => p.str).join('').replace(/\s+/g, ' ').trim();
  const kept = lines.filter((l) => l.text);
  if (!kept.length) return [];
  const gaps = kept.slice(1).map((l, i) => kept[i].y - l.y).filter((g) => g > 0).sort((a, b) => a - b);
  const usual = gaps.length ? gaps[Math.floor(gaps.length / 2)] : kept[0].size * 1.2;
  const left = Math.min(...kept.map((l) => l.x));
  const out = [];
  let cur = '';
  kept.forEach((l, i) => {
    const gap = i ? kept[i - 1].y - l.y : 0;
    const indented = l.x - left > l.size * 1.2;
    if (i && (gap > usual * 1.45 || indented) && cur) { out.push(cur); cur = ''; }
    // Join lines; a hyphen at a line end joins the two halves of a word.
    cur = !cur ? l.text : /[A-Za-z]-$/.test(cur) ? cur.slice(0, -1) + l.text : `${cur} ${l.text}`;
  });
  if (cur) out.push(cur);
  return out;
}
