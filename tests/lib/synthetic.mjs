// In-page code that draws SYNTHETIC test pages (clearly not real photos) from the sample data, then makes them
// look photographed: slight rotation, an uneven shadow, sensor noise and JPEG compression.
// Used to test that the photo pipeline works end to end. Real-photo accuracy is measured separately
// (tests/ocr.eval.mjs) and must never be claimed from these.
export const SYNTHETIC = `
window.__makeSynthetic = async function (kind, { rotate = 2, shadow = 0.45, noise = 18, quality = 0.72 } = {}) {
  const vocab = await (await fetch('sample-data/vocabulary.json')).json();
  const spelling = await (await fetch('sample-data/spelling.json')).json();
  const W = 1600, H = 2000;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.fillStyle = '#111'; x.textBaseline = 'top';
  if (kind === 'vocab') {
    x.font = 'bold 54px Arial'; x.fillText('Vocabulary Words', 120, 90);
    x.font = '34px Arial'; x.fillText('Name: ______________   Date: __________', 120, 175);
    x.font = 'bold 36px Arial'; x.fillText('Word', 120, 260); x.fillText('Definition', 560, 260);
    x.fillRect(110, 310, 1380, 3);
    let y = 335;
    for (const it of vocab.items) {
      x.font = 'bold 36px Arial'; x.fillText(it.word, 120, y);
      x.font = '34px Arial';
      const words = it.sourceDefinition.split(' '); let line = ''; let ly = y;
      for (const w of words) { const t = line ? line + ' ' + w : w; if (x.measureText(t).width > 900) { x.fillText(line, 560, ly); line = w; ly += 44; } else line = t; }
      x.fillText(line, 560, ly);
      y = ly + 88;
    }
  } else if (kind === 'cards') {
    // The teacher's real format: a 4 × 3 table of cards, word on top, definition centred underneath.
    // Table occupies (100, 260) – (1500, 1460); window.__cardsTable holds its corners.
    x.font = 'bold 60px Arial'; x.fillText('VOCABULARY', 560, 150);
    const X0 = 100, Y0 = 260, CW = 350, CH = 400;
    x.lineWidth = 3; x.strokeStyle = '#333';
    for (let r = 0; r <= 3; r++) { x.beginPath(); x.moveTo(X0, Y0 + r * CH); x.lineTo(X0 + 4 * CW, Y0 + r * CH); x.stroke(); }
    for (let c = 0; c <= 4; c++) { x.beginPath(); x.moveTo(X0 + c * CW, Y0); x.lineTo(X0 + c * CW, Y0 + 3 * CH); x.stroke(); }
    x.textAlign = 'center';
    vocab.items.forEach((it, i) => {
      const r = Math.floor(i / 4), c = i % 4, cx = X0 + c * CW + CW / 2;
      x.fillStyle = '#1d4ed8'; x.font = 'bold 40px Arial'; x.fillText(it.word, cx, Y0 + r * CH + 30);
      x.fillStyle = '#222'; x.font = '30px Arial';
      const words = it.sourceDefinition.split(' '); let line = ''; let ly = Y0 + r * CH + 110;
      for (const w of words) { const t = line ? line + ' ' + w : w; if (x.measureText(t).width > CW - 40) { x.fillText(line, cx, ly); line = w; ly += 40; } else line = t; }
      x.fillText(line, cx, ly);
    });
    x.textAlign = 'left';
    window.__cardsTable = [{ x: X0, y: Y0 }, { x: X0 + 4 * CW, y: Y0 }, { x: X0 + 4 * CW, y: Y0 + 3 * CH }, { x: X0, y: Y0 + 3 * CH }];
  } else {
    x.font = 'bold 56px Georgia'; x.fillText('Room 12 Weekly News', 120, 90);
    x.font = '32px Georgia'; x.fillText('Week of October 12', 120, 170);
    x.font = 'bold 44px Arial'; x.fillText('Spelling Words', 120, 270);
    x.font = '36px Arial'; x.fillText('Focus: -ed endings', 120, 335);
    const words = spelling.words.map((w) => w.word);
    for (let i = 0; i < words.length; i++) {
      const col = Math.floor(i / 5), row = i % 5;
      x.fillText((i + 1) + '. ' + words[i], 140 + col * 470, 420 + row * 70);
    }
    x.font = 'bold 44px Arial'; x.fillText('Reminders', 120, 830);
    x.font = '34px Georgia'; x.fillText('Picture day is Tuesday. Please return library books.', 120, 900);
  }
  // Photograph it: rotate, add a soft shadow across one side, noise, then JPEG.
  const p = document.createElement('canvas'); p.width = W; p.height = H;
  const q = p.getContext('2d');
  q.fillStyle = '#d9d4c7'; q.fillRect(0, 0, W, H);
  q.translate(W / 2, H / 2); q.rotate(rotate * Math.PI / 180); q.drawImage(c, -W / 2, -H / 2); q.setTransform(1, 0, 0, 1, 0, 0);
  if (kind === 'cards') { // where the table corners ended up after the rotation (what a parent would mark)
    const t = rotate * Math.PI / 180, cs = Math.cos(t), sn = Math.sin(t);
    window.__cardsCorners = window.__cardsTable.map((p) => ({ x: W / 2 + (p.x - W / 2) * cs - (p.y - H / 2) * sn, y: H / 2 + (p.x - W / 2) * sn + (p.y - H / 2) * cs }));
  }
  const g = q.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.55, 'rgba(0,0,0,' + (shadow * 0.25) + ')'); g.addColorStop(1, 'rgba(0,0,0,' + shadow + ')');
  q.fillStyle = g; q.fillRect(0, 0, W, H);
  const img = q.getImageData(0, 0, W, H);
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < img.data.length; i += 4) { const n = (rnd() - 0.5) * noise; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; }
  q.putImageData(img, 0, 0);
  const blob = await new Promise((r) => p.toBlob(r, 'image/jpeg', quality));
  return new File([blob], 'synthetic-' + kind + '.jpg', { type: 'image/jpeg' });
};
`;
