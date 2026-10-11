// Decode, validate and resize images on the device. Nothing is uploaded anywhere.

export const MAX_FILE_BYTES = 30 * 1024 * 1024;
const OK_TYPES = /^image\/(jpeg|jpg|png|webp|gif|bmp|heic|heif)$/i;

export class ImageError extends Error {}

/** Check a picked file before decoding. Throws ImageError with a parent-friendly message. */
export function checkFile(file) {
  if (!file) throw new ImageError('No file was chosen.');
  const type = file.type || '';
  const name = file.name || 'This file';
  if (!OK_TYPES.test(type) && !/\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(name)) throw new ImageError(`${name} is not a picture. Choose a JPEG or PNG photo or screenshot.`);
  if (file.size > MAX_FILE_BYTES) throw new ImageError(`${name} is too large (${Math.round(file.size / 1048576)} MB). The limit is 30 MB.`);
  if (file.size === 0) throw new ImageError(`${name} is empty.`);
}

/** Decode to a drawable (ImageBitmap or HTMLImageElement), honouring the photo's rotation. */
export async function decode(file) {
  checkFile(file);
  try {
    if (globalThis.createImageBitmap) return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch { /* fall back to <img> */ }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } catch {
    const heic = /hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name || '');
    throw new ImageError(heic
      ? `${file.name} is an iPhone HEIC photo this browser cannot open. On iPhone, choose the photo through the photo picker (it converts to JPEG), or take a screenshot of it.`
      : `${file.name || 'This picture'} could not be opened. It may be damaged or in an unsupported format.`);
  } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
}

const dims = (src) => ({ w: src.naturalWidth || src.width, h: src.naturalHeight || src.height });

/** Draw `src` scaled so its longest side is at most `maxSide`, optionally rotated by 90° steps. Returns a canvas. */
export function toCanvas(src, maxSide = 2000, rotate = 0) {
  const { w, h } = dims(src);
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const sw = Math.round(w * scale), sh = Math.round(h * scale);
  const quarter = ((rotate % 360) + 360) % 360;
  const swap = quarter === 90 || quarter === 270;
  const c = document.createElement('canvas');
  c.width = swap ? sh : sw; c.height = swap ? sw : sh;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((quarter * Math.PI) / 180);
  ctx.drawImage(src, -sw / 2, -sh / 2, sw, sh);
  return c;
}

export function canvasToBlob(canvas, type = 'image/jpeg', quality = 0.85) {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new ImageError('The picture could not be saved.'))), type, quality));
}

/** Resize a picked file for storage (illustrations ≈ 1000 px, source pages ≈ 1800 px). */
export async function prepareForStorage(file, maxSide = 1000) {
  const src = await decode(file);
  const keepPng = /png|gif/i.test(file.type) && maxSide <= 1000;
  const blob = await canvasToBlob(toCanvas(src, maxSide), keepPng ? 'image/png' : 'image/jpeg', 0.85);
  if (src.close) src.close();
  return blob;
}
