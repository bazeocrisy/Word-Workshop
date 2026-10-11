// Word building: the child rebuilds a spelling word from shuffled letter tiles (pure; unit-tested in Node).
import { rng, shuffle } from './model.js';

const VOWELS = 'aeiou';
const isVowel = (ch) => VOWELS.includes(ch.toLowerCase());

/** The letters a child places, in order (spaces, hyphens and apostrophes are not tiles). */
export const wordLetters = (word) => [...String(word || '').trim()].filter((ch) => /\p{L}/u.test(ch));

/** Likely mix-ups for this word, most useful first (never repeats). */
function confusions(word) {
  const w = word.toLowerCase();
  const out = [];
  const add = (...chs) => chs.forEach((ch) => { if (!out.includes(ch)) out.push(ch); });
  if (w.endsWith('ed')) add('t', 'd');
  if (/(s|x|z|ch|sh)es$/.test(w)) add('z', 's');
  else if (w.endsWith('s')) add('z', 'e');
  // Doubled consonants: offer one more of that letter (stepped → an extra p tempts "steppped"/"steped").
  for (let i = 1; i < w.length; i++) if (w[i] === w[i - 1] && !isVowel(w[i])) add(w[i]);
  if (/ck/.test(w)) add('k', 'c');
  // Vowel swaps: the vowels this word does not use.
  for (const v of VOWELS) if (w.includes(v)) add(...[...VOWELS].filter((x) => !w.includes(x)));
  add(...VOWELS);
  return out;
}

/**
 * Tiles for a word: [{ id, letter }] shuffled with the seed, plus `extra` distractor letters.
 * The word's own tiles are never left in spelling order (unless the word is under 2 letters
 * or every letter is the same).
 */
export function makeTiles(word, { seed = 1, extra = 0 } = {}) {
  const letters = wordLetters(word);
  const rand = rng(seed);
  const target = letters.join('');
  let tiles = letters.map((letter, i) => ({ id: `t${i}`, letter }));
  if (letters.length >= 2) {
    for (let n = 0; n < 8 && tiles.map((t) => t.letter).join('') === target; n++) tiles = shuffle(tiles, rand);
    // Still in order after several shuffles (tiny words): rotate by one.
    if (tiles.map((t) => t.letter).join('') === target) tiles = [...tiles.slice(1), tiles[0]];
  }
  const upper = target.length > 1 && target === target.toUpperCase() && target !== target.toLowerCase();
  const extras = confusions(target).slice(0, Math.max(0, extra));
  extras.forEach((ch, i) => {
    // Inserting never changes the order of the word's own tiles.
    const at = Math.floor(rand() * (tiles.length + 1));
    tiles.splice(at, 0, { id: `x${i}`, letter: upper ? ch.toUpperCase() : ch, extra: true });
  });
  return tiles;
}

const PREFIXES = ['un', 're'];
// Endings, longest first. "es" only after s, x, z, ch, sh (glass-es, box-es) — otherwise "s" (table-s).
const SUFFIXES = [
  ['ing', () => true], ['est', () => true], ['ed', () => true],
  ['es', (stem) => /(s|x|z|ch|sh)$/.test(stem)], ['er', () => true], ['ly', () => true],
  ['s', (stem) => !stem.endsWith('s')],
];

const BLENDS = new Set(['bl', 'br', 'ch', 'cl', 'cr', 'dr', 'fl', 'fr', 'gl', 'gr', 'ph', 'pl', 'pr', 'sc', 'sh', 'sk', 'sl', 'sm', 'sn', 'sp', 'st', 'sw', 'th', 'tr', 'wh', 'wr']);

/** Syllable-ish split of a stem by vowel groups (VC|CV and V|CV); short stems stay whole. */
function syllables(stem) {
  const s = stem.toLowerCase();
  if (s.length < 5) return [stem];
  const v = (i) => i >= 0 && i < s.length && /[aeiouy]/.test(s[i]) && !(s[i] === 'y' && i === 0);
  const cuts = [];
  let i = 0;
  while (i < s.length && !v(i)) i++;          // leading consonants
  while (i < s.length) {
    while (i < s.length && v(i)) i++;         // vowel group
    const start = i;
    while (i < s.length && !v(i)) i++;        // consonant run
    if (i >= s.length) break;                 // word ends in consonants
    // A final silent e is not its own syllable (ta-ble stays "table").
    if (i === s.length - 1 && s[i] === 'e') break;
    const run = i - start;
    // One consonant goes right (ba-con); two split (hap-py); longer runs keep an ending blend together (mel-an-choly).
    const cut = run <= 1 ? start : run === 2 ? start + 1 : BLENDS.has(s.slice(i - 2, i)) ? i - 2 : i - 1;
    if (cut > 0) cuts.push(cut);
  }
  const parts = [];
  let last = 0;
  for (const c of cuts) { parts.push(stem.slice(last, c)); last = c; }
  parts.push(stem.slice(last));
  return parts.filter(Boolean);
}

/** Helpful chunks for easier building: prefix, stem pieces, ending. Always joins back to the word. */
export function chunks(word) {
  const w = String(word || '').trim();
  if (!w) return [];
  const lower = w.toLowerCase();
  let start = 0, end = w.length;
  const head = [], tail = [];
  const pre = PREFIXES.find((p) => lower.startsWith(p) && lower.length - p.length >= 4);
  if (pre) { head.push(w.slice(0, pre.length)); start = pre.length; }
  for (const [suf, ok] of SUFFIXES) {
    const stem = lower.slice(start, end - suf.length);
    if (lower.endsWith(suf) && stem.length >= 3 && ok(stem)) { tail.push(w.slice(end - suf.length)); end -= suf.length; break; }
  }
  return [...head, ...syllables(w.slice(start, end)), ...tail];
}

/**
 * Progress check while building. letters = tiles placed so far (strings), compared case-insensitively.
 * Returns { done, correctSoFar, nextIndexWrong } where correctSoFar counts right letters from the start
 * and nextIndexWrong is the index of the first wrong letter (-1 if none).
 */
export function checkBuild(word, letters) {
  const target = wordLetters(word).map((ch) => ch.toLowerCase());
  const placed = (letters || []).map((ch) => String(ch?.letter ?? ch ?? '').toLowerCase());
  let correctSoFar = 0;
  while (correctSoFar < placed.length && correctSoFar < target.length && placed[correctSoFar] === target[correctSoFar]) correctSoFar++;
  const nextIndexWrong = correctSoFar < placed.length ? correctSoFar : -1;
  return { done: nextIndexWrong === -1 && placed.length === target.length && target.length > 0, correctSoFar, nextIndexWrong };
}
