// Perspective correction for photos of a page or table taken at an angle (the page looks like a trapezoid).
// Finds the long, continuous ruling lines of a table (or the edges of a boxed sheet), takes the outermost
// near-horizontal and near-vertical ones, and maps that quadrilateral back to a rectangle.
// If nothing convincing is found, it returns null and the photo is read as it is.
import { preprocess } from './ocr.js';

/** Binary ink mask (1 = dark) of a canvas scaled to `width` px wide. */
export function inkMask(canvas, width) {
  const k = Math.min(1, width / canvas.width);
  const c = document.createElement('canvas');
  c.width = Math.round(canvas.width * k); c.height = Math.round(canvas.height * k);
  c.getContext('2d').drawImage(canvas, 0, 0, c.width, c.height);
  const bin = preprocess(c);
  const d = bin.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data;
  const m = new Uint8Array(c.width * c.height);
  for (let i = 0; i < m.length; i++) m[i] = d[i * 4] === 0 ? 1 : 0;
  return { m, w: c.width, h: c.height, k };
}

/**
 * Long straight dark lines, found with a Hough transform and then checked for continuity
 * (table rulings are unbroken; rows of text are not). Returns [{ a, b, c, angle, len }] with a·x + b·y = c.
 */
export function findLines(mask, orientation) {
  const { w, h } = mask;
  // Keep only thin dark lines: dark here, light a few pixels to either side (across the line). This drops thick
  // text strokes, solid dark areas and the edge of the paper against a dark table.
  const src = mask.m, m = new Uint8Array(w * h), d = 3;
  for (let y = d; y < h - d; y++) for (let x = d; x < w - d; x++) {
    const i = y * w + x;
    if (!src[i]) continue;
    m[i] = orientation === 'h' ? (!src[i - d * w] && !src[i + d * w] ? 1 : 0) : (!src[i - d] && !src[i + d] ? 1 : 0);
  }
  const degs = [];
  for (let a = -35; a <= 35; a += 0.5) degs.push(orientation === 'h' ? 90 + a : a); // normal angle of the line
  const diag = Math.ceil(Math.hypot(w, h));
  const acc = new Uint32Array(degs.length * (2 * diag + 1));
  const cs = degs.map((d) => Math.cos((d * Math.PI) / 180)), sn = degs.map((d) => Math.sin((d * Math.PI) / 180));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!m[y * w + x]) continue;
    for (let t = 0; t < degs.length; t++) acc[t * (2 * diag + 1) + Math.round(x * cs[t] + y * sn[t]) + diag]++;
  }
  const span = orientation === 'h' ? w : h;
  const cands = [];
  for (let t = 0; t < degs.length; t++) for (let r = 0; r < 2 * diag + 1; r++) {
    const v = acc[t * (2 * diag + 1) + r];
    if (v < span * 0.3) continue;
    cands.push({ t, r: r - diag, v });
  }
  cands.sort((p, q) => q.v - p.v);
  const lines = [];
  for (const cd of cands.slice(0, 400)) {
    if (lines.some((l) => Math.abs(l.t - cd.t) <= 6 && Math.abs(l.r - cd.r) <= 6)) continue;
    // Continuity: walk the line; count the longest run of ink (allowing small gaps).
    const a = cs[cd.t], b = sn[cd.t], c = cd.r;
    let run = 0, best = 0, gap = 0, inkCount = 0, steps = 0;
    for (let s = 0; s < span; s++) {
      let x, y;
      if (orientation === 'h') { x = s; y = (c - a * x) / b; } else { y = s; x = (c - b * y) / a; }
      const xi = Math.round(x), yi = Math.round(y);
      if (xi < 1 || yi < 1 || xi >= w - 1 || yi >= h - 1) continue;
      steps++;
      const ink = m[yi * w + xi] || m[(yi - 1) * w + xi] || m[(yi + 1) * w + xi] || m[yi * w + xi - 1] || m[yi * w + xi + 1];
      if (ink) { inkCount++; run += 1 + gap; gap = 0; best = Math.max(best, run); } else if (++gap > 6) { run = 0; gap = 0; }
    }
    if (best >= span * 0.35 && inkCount / Math.max(1, steps) > 0.35) lines.push({ t: cd.t, r: cd.r, a, b, c, angle: degs[cd.t], len: best });
    if (lines.length > 40) break;
  }
  return lines;
}

const intersect = (l1, l2) => {
  const det = l1.a * l2.b - l2.a * l1.b;
  if (Math.abs(det) < 1e-9) return null;
  return { x: (l1.c * l2.b - l2.c * l1.b) / det, y: (l1.a * l2.c - l2.a * l1.c) / det };
};

/**
 * Detect the outer quadrilateral of a ruled table. Returns { corners: [tl, tr, br, bl] in full-image pixels,
 * keystone, lines } or null when there is no clear table.
 */
export function detectTable(canvas) {
  const mask = inkMask(canvas, 900);
  const hs = findLines(mask, 'h'), vs = findLines(mask, 'v');
  if (hs.length < 2 || vs.length < 2) return null;
  // position of a line at the middle of the image
  const yAt = (l, x) => (l.c - l.a * x) / l.b, xAt = (l, y) => (l.c - l.b * y) / l.a;
  const top = hs.reduce((p, q) => (yAt(q, mask.w / 2) < yAt(p, mask.w / 2) ? q : p));
  const bottom = hs.reduce((p, q) => (yAt(q, mask.w / 2) > yAt(p, mask.w / 2) ? q : p));
  const left = vs.reduce((p, q) => (xAt(q, mask.h / 2) < xAt(p, mask.h / 2) ? q : p));
  const right = vs.reduce((p, q) => (xAt(q, mask.h / 2) > xAt(p, mask.h / 2) ? q : p));
  const corners = [intersect(top, left), intersect(top, right), intersect(bottom, right), intersect(bottom, left)];
  if (corners.some((p) => !p)) return null;
  const tooSmall = (yAt(bottom, mask.w / 2) - yAt(top, mask.w / 2)) < mask.h * 0.12 || (xAt(right, mask.h / 2) - xAt(left, mask.h / 2)) < mask.w * 0.3;
  if (tooSmall) return null;
  const inside = corners.every((p) => p.x > -mask.w * 0.05 && p.x < mask.w * 1.05 && p.y > -mask.h * 0.05 && p.y < mask.h * 1.05);
  if (!inside) return null;
  const s = 1 / mask.k;
  return { corners: corners.map((p) => ({ x: p.x * s, y: p.y * s })), lines: { h: hs.length, v: vs.length } };
}

/**
 * Cell grid of an upright (already straightened) table: positions of the vertical and horizontal rulings,
 * found from thin dark lines that run most of the way across. Returns { xs, ys } (including the outer borders)
 * or null. Only grids of 2–6 columns and 1–8 rows are accepted.
 */
export function findGrid(canvas) {
  const mask = inkMask(canvas, 1200);
  const { w, h } = mask, src = mask.m;
  // Continuity: a ruling is dark (within ±2 px, as rulings bend a little in photos) along most of the table;
  // a column or row of text never is.
  const dark = (x, y) => x >= 0 && y >= 0 && x < w && y < h && src[y * w + x];
  // Lines in photos bend (curled paper), so each quarter of a line may sit a few pixels higher or lower:
  // a ruling counts when at least 3 of its 4 quarters are mostly dark somewhere within ±8 px.
  const SHIFT = 8, PARTS = 4;
  const rowAt = (y) => { const c = new Float64Array(w); for (let x = 0; x < w; x++) c[x] = dark(x, y - 1) || dark(x, y) || dark(x, y + 1) ? 1 : 0; return c; };
  const colAt = (x) => { const c = new Float64Array(h); for (let y = 0; y < h; y++) c[y] = dark(x - 1, y) || dark(x, y) || dark(x + 1, y) ? 1 : 0; return c; };
  const rowCache = Array.from({ length: h }, (_, y) => rowAt(y)), colCache = Array.from({ length: w }, (_, x) => colAt(x));
  const partCover = (cache, pos, len, n) => {
    const parts = [];
    for (let p = 0; p < PARTS; p++) {
      const a = Math.floor((p * len) / PARTS), b = Math.floor(((p + 1) * len) / PARTS);
      let best = 0;
      for (let d = -SHIFT; d <= SHIFT; d++) {
        const line = cache[pos + d]; if (!line) continue;
        let s = 0; for (let i = a; i < b; i++) s += line[i];
        best = Math.max(best, s / (b - a));
      }
      parts.push(best);
    }
    parts.sort((u, v) => v - u);
    return parts[PARTS - 2] >= 0.55 ? parts.slice(0, PARTS - 1).reduce((s, v) => s + v, 0) / (PARTS - 1) : 0;
  };
  const colCover = new Float64Array(w), rowCover = new Float64Array(h);
  for (let x = 0; x < w; x++) colCover[x] = partCover(colCache, x, h, w);
  for (let y = 0; y < h; y++) rowCover[y] = partCover(rowCache, y, w, h);
  const peaks = (cover, len) => {
    const out = [];
    const order = [...cover.keys()].sort((a, b) => cover[b] - cover[a]);
    for (const i of order) {
      if (cover[i] < 0.55) break;
      if (out.some((p) => Math.abs(p - i) < len * 0.06)) continue;
      out.push(i);
      if (out.length >= 10) break;
    }
    return out.sort((a, b) => a - b);
  };
  const xs = peaks(colCover, w), ys = peaks(rowCover, h);
  if (!xs.length && !ys.length) return null;
  const s = 1 / mask.k;
  return { xs: xs.map((x) => x * s), ys: ys.map((y) => y * s) };
}

/** Solve the 3×3 homography mapping src[i] → dst[i] (4 points). */
function homography(src, dst) {
  const A = [], B = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i], { x: u, y: v } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); B.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); B.push(v);
  }
  // Gaussian elimination
  const n = 8;
  for (let i = 0; i < n; i++) {
    let p = i; for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
    [A[i], A[p]] = [A[p], A[i]]; [B[i], B[p]] = [B[p], B[i]];
    for (let r = 0; r < n; r++) {
      if (r === i) continue;
      const f = A[r][i] / A[i][i];
      for (let c = i; c < n; c++) A[r][c] -= f * A[i][c];
      B[r] -= f * B[i];
    }
  }
  const hm = B.map((b, i) => b / A[i][i]);
  return [...hm, 1];
}

/**
 * Warp the quadrilateral `corners` of `src` (tl, tr, br, bl) into an upright rectangle, with a margin of the
 * surrounding page so text at the edges is kept. Output width ≈ `outWidth`.
 */
export function warpQuad(src, corners, outWidth = 2400, margin = 0.04) {
  const [tl, tr, br, bl] = corners;
  const wTop = Math.hypot(tr.x - tl.x, tr.y - tl.y), wBot = Math.hypot(br.x - bl.x, br.y - bl.y);
  const hL = Math.hypot(bl.x - tl.x, bl.y - tl.y), hR = Math.hypot(br.x - tr.x, br.y - tr.y);
  const W = outWidth, H = Math.round(outWidth * (Math.max(hL, hR) / Math.max(wTop, wBot)));
  const mx = W * margin, my = H * margin;
  const OW = Math.round(W + 2 * mx), OH = Math.round(H + 2 * my);
  // Map output (u, v) → source (x, y): homography from destination rectangle to source quad.
  const Hm = homography([{ x: mx, y: my }, { x: mx + W, y: my }, { x: mx + W, y: my + H }, { x: mx, y: my + H }], corners);
  const sctx = src.getContext('2d', { willReadFrequently: true });
  const sd = sctx.getImageData(0, 0, src.width, src.height).data;
  const out = document.createElement('canvas'); out.width = OW; out.height = OH;
  const octx = out.getContext('2d');
  const od = octx.createImageData(OW, OH);
  const sw = src.width, sh = src.height;
  for (let v = 0; v < OH; v++) for (let u = 0; u < OW; u++) {
    const z = Hm[6] * u + Hm[7] * v + 1;
    const x = (Hm[0] * u + Hm[1] * v + Hm[2]) / z, y = (Hm[3] * u + Hm[4] * v + Hm[5]) / z;
    const k = (v * OW + u) * 4;
    if (x < 0 || y < 0 || x >= sw - 1 || y >= sh - 1) { od.data[k] = od.data[k + 1] = od.data[k + 2] = 255; od.data[k + 3] = 255; continue; }
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    for (let ch = 0; ch < 3; ch++) {
      const p00 = sd[(y0 * sw + x0) * 4 + ch], p10 = sd[(y0 * sw + x0 + 1) * 4 + ch], p01 = sd[((y0 + 1) * sw + x0) * 4 + ch], p11 = sd[((y0 + 1) * sw + x0 + 1) * 4 + ch];
      od.data[k + ch] = p00 * (1 - fx) * (1 - fy) + p10 * fx * (1 - fy) + p01 * (1 - fx) * fy + p11 * fx * fy;
    }
    od.data[k + 3] = 255;
  }
  octx.putImageData(od, 0, 0);
  return out;
}
