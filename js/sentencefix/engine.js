// Sentence Fix game engine (pure; unit-tested in Node, no DOM).
// A child sees a sentence with planted mistakes and types the fixed sentence. This module:
//  • grades the answer against the model sentence, mistake by mistake (never guesses "wrong" when unsure:
//    a genuinely different rewrite is sent to a grown-up as "review");
//  • sorts items into Thinking Lab categories;
//  • picks seeded, repeat-avoiding sessions and keeps a small per-student progress record;
//  • builds hints, explanations, highlight segments and step-by-step fixes for Learn mode.

const MAX_CHARS = 400; // longest answer we align (longer input is cut, never crashes)
const DEFAULT_SIZE = { learn: 3, practice: 10, lab: 10, test: 15 };
const DIFFICULTIES = ['easy', 'medium', 'hard'];
const END_MARKS = new Set(['.', '!', '?']);
const CLOSERS = new Set(['"', "'", ')', ']']);

// ---------- Text helpers ----------

/** Curly quotes/apostrophes → straight ones. Length-preserving, so character positions stay valid. */
const straightQuotes = (s) => String(s ?? '').replace(/[‘’‚‛′]/g, "'").replace(/[“”„‟″]/g, '"');

/** Remove only harmless differences: outer/extra spaces, spaces before , . ! ? ; : and curly quotes. Case and punctuation stay. */
export function normalize(s) {
  return straightQuotes(String(s ?? '').normalize('NFC')).replace(/\s+/g, ' ').trim().replace(/ +([,.!?;:])/g, '$1');
}

// Words (letters/digits, with apostrophes or hyphens inside, plus a possessive "dogs'") or single marks.
const TOKEN = /[\p{L}\p{M}\p{N}]+(?:['-][\p{L}\p{M}\p{N}]+)*(?:(?<=[sS])'(?![\p{L}\p{N}]))?|\S/gu;
const WORD_CHAR = /[\p{L}\p{N}]/u;
const isWord = (t) => WORD_CHAR.test(t);
const lc = (t) => t.toLowerCase();

/** Split text into tokens with their character positions: [{ t, s, e }]. */
export function tokenize(text) {
  const out = [];
  for (const m of String(text).matchAll(TOKEN)) out.push({ t: m[0], s: m.index, e: m.index + m[0].length });
  return out;
}

/** Join tokens back into readable text (no space before marks). */
const joinTokens = (toks) => toks.join(' ').replace(/ +([,.!?;:)\]])/g, '$1').replace(/([(\[]) +/g, '$1');

/** Longest common subsequence of two token lists → matched index pairs [[i, j], ...] in order. */
function lcsPairs(a, b) {
  const n = a.length, m = b.length, w = m + 1;
  const dp = new Uint16Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * w + j] = a[i] === b[j] ? dp[(i + 1) * w + j + 1] + 1 : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
    }
  }
  const pairs = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { pairs.push([i, j]); i++; j++; }
    else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) i++;
    else j++;
  }
  return pairs;
}

/** Runs of differences between two token lists: [{ a0, a1, b0, b1 }] (half-open ranges). */
function diffHunks(a, b) {
  const pairs = [[-1, -1], ...lcsPairs(a, b), [a.length, b.length]];
  const hunks = [];
  for (let k = 0; k < pairs.length - 1; k++) {
    const a0 = pairs[k][0] + 1, a1 = pairs[k + 1][0], b0 = pairs[k][1] + 1, b1 = pairs[k + 1][1];
    if (a1 > a0 || b1 > b0) hunks.push({ a0, a1, b0, b1 });
  }
  return hunks;
}

function editDistance(a, b) {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

/** Position of the contiguous run `needle` inside `hay` (exact tokens), or -1. */
function indexOfRun(hay, needle) {
  if (!needle.length) return -1;
  outer: for (let i = 0; i + needle.length <= hay.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}

// ---------- Where each documented mistake is ----------

/** Find `needle` at or after `from`, preferring a whole-word match ("i" should not match inside "is"). */
function findText(hay, needle, from) {
  let p = hay.indexOf(needle, from), first = -1;
  while (p !== -1) {
    if (first === -1) first = p;
    const before = hay[p - 1] || '', after = hay[p + needle.length] || '';
    const okLeft = !isWord(needle[0]) || !isWord(before);
    const okRight = !isWord(needle[needle.length - 1]) || !isWord(after);
    if (okLeft && okRight) return p;
    p = hay.indexOf(needle, p + 1);
  }
  return first;
}

/** Token indices overlapping the character span [s, e) as [start, end); empty span → empty range at that spot. */
function tokenRange(tokens, s, e) {
  let a = -1, b = -1;
  tokens.forEach((t, i) => { if (t.s < e && t.e > s) { if (a < 0) a = i; b = i + 1; } });
  if (a >= 0) return [a, b];
  const at = tokens.findIndex((t) => t.s >= s);
  const i = at < 0 ? tokens.length : at;
  return [i, i];
}

/** Primary method: apply each error wrong→right, left to right, and check the result is the model sentence. */
function locateBySearch(inc, correct, errors) {
  let cursor = 0, out = '';
  const spans = [];
  for (const [index, err] of errors.entries()) {
    const wrong = straightQuotes(err?.wrong), right = straightQuotes(err?.right);
    if (!wrong) return null;
    const p = findText(inc, wrong, cursor);
    if (p < 0) return null;
    out += inc.slice(cursor, p);
    spans.push({ index, iStart: p, iEnd: p + wrong.length, cStart: out.length, cEnd: out.length + right.length, fix: String(err.right ?? '') });
    out += right;
    cursor = p + wrong.length;
  }
  out += inc.slice(cursor);
  if (normalize(out) !== normalize(correct)) return null;
  return { cor: out, spans };
}

/** Fallback when the bank's wrong/right pairs don't line up: assign the n-th difference to the n-th error. */
function locateByDiff(inc, correct, errors) {
  const cor = straightQuotes(correct);
  const I = tokenize(inc), C = tokenize(cor);
  const hunks = diffHunks(I.map((t) => t.t), C.map((t) => t.t));
  const spans = errors.map((err, index) => {
    const h = hunks[index];
    if (!h) return null;
    const iStart = h.a1 > h.a0 ? I[h.a0].s : (I[h.a0 - 1]?.e ?? 0);
    const iEnd = h.a1 > h.a0 ? I[h.a1 - 1].e : iStart;
    const cStart = h.b1 > h.b0 ? C[h.b0].s : (C[h.b0 - 1]?.e ?? 0);
    const cEnd = h.b1 > h.b0 ? C[h.b1 - 1].e : cStart;
    return { index, iStart, iEnd, cStart, cEnd, fix: cor.slice(cStart, cEnd) };
  });
  return { cor, spans };
}

const located = new WeakMap();

/** Work out (once per item) where every error sits, in characters and in tokens, in both sentences. */
function locate(item) {
  if (item && typeof item === 'object' && located.has(item)) return located.get(item);
  const inc = straightQuotes(item?.incorrect);
  const errors = Array.isArray(item?.errors) ? item.errors : [];
  const found = locateBySearch(inc, String(item?.correct ?? ''), errors) || locateByDiff(inc, String(item?.correct ?? ''), errors);
  const incTokens = tokenize(inc), corTokens = tokenize(found.cor);
  const spans = found.spans.map((sp) => {
    if (!sp) return null;
    let iTok = tokenRange(incTokens, sp.iStart, sp.iEnd), cTok = tokenRange(corTokens, sp.cStart, sp.cEnd);
    // A pure insertion/deletion (e.g. a missing comma) is checked together with the word beside it.
    if (iTok[0] === iTok[1] || cTok[0] === cTok[1]) {
      if (iTok[0] > 0 && cTok[0] > 0) { iTok = [iTok[0] - 1, iTok[1]]; cTok = [cTok[0] - 1, cTok[1]]; }
      else { iTok = [iTok[0], iTok[1] + 1]; cTok = [cTok[0], cTok[1] + 1]; }
    }
    // What to underline: the wrong text, or (for a missing mark) the word beside where it goes.
    const blank = sp.iEnd <= sp.iStart && iTok[1] > iTok[0];
    const markStart = blank ? incTokens[iTok[0]].s : sp.iStart, markEnd = blank ? incTokens[iTok[1] - 1].e : sp.iEnd;
    return {
      ...sp, iTok, cTok, markStart, markEnd,
      wrongToks: incTokens.slice(iTok[0], iTok[1]).map((t) => t.t),
      rightToks: corTokens.slice(cTok[0], cTok[1]).map((t) => t.t),
    };
  });
  const result = { inc, cor: found.cor, incTokens, corTokens, spans };
  if (item && typeof item === 'object') located.set(item, result);
  return result;
}

// ---------- Grading ----------

const MESSAGES = {
  empty: 'Type your fixed sentence in the box first.',
  correct: 'Great job! Every mistake is fixed.',
  review: 'This sentence is different from the one we expected, so a grown-up or your answer key should check it.',
};
const TIPS = {
  spelling: 'Check the spelling of each word.',
  capital: 'Check your capital letters.',
  'capital-start': 'Remember: a sentence starts with a capital letter.',
  'end-mark': "Don't forget the mark at the end of the sentence.",
  punctuation: 'Check your punctuation marks.',
  dropped: 'It looks like a word or mark went missing.',
  repeated: 'A word is written twice.',
  spacing: 'Check the spaces between your words.',
};
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Decide whether one difference (expected tokens → typed tokens) is clearly a mistake. */
function classify(h, A, insBag, delBag) {
  const { exp, got } = h;
  const inBag = (bag, toks) => toks.every((t) => (bag.get(lc(t)) || 0) > 0);
  if (!got.length) return inBag(insBag, exp) ? ['moved', false] : ['dropped', true];
  if (!exp.length) {
    if (inBag(delBag, got)) return ['moved', false];
    const before = A[h.aStart - 1], after = A[h.aStart + got.length];
    const repeated = got.length === 1 && [before, after].some((t) => t && lc(t) === lc(got[0]));
    return repeated ? ['repeated', true] : ['added', false];
  }
  if (exp.length === 1 && got.length === 1) {
    const [e] = exp, [g] = got;
    if (isWord(e) && isWord(g)) {
      if (lc(e) === lc(g)) return h.expAtStart !== (h.aStart === 0) ? ['moved', false] : ['capital', true];
      const d = editDistance(lc(e), lc(g));
      return d <= 2 && d < Math.min(e.length, g.length) ? ['spelling', true] : ['different-word', false];
    }
    if (!isWord(e) && !isWord(g)) {
      const clear = END_MARKS.has(e) !== END_MARKS.has(g) || e === '?' || g === '?';
      return ['punctuation', clear];
    }
    return ['rewrite', false];
  }
  // "every day" ↔ "everyday": same letters, split or joined differently.
  const squash = (toks) => lc(toks.join('')).replace(/-/g, '');
  if (squash(exp) === squash(got)) return ['spelling', true];
  return ['rewrite', false];
}

/** Same word with a small slip: different case, or at most 2 letters off (and not a whole short word swapped). */
function nearMiss(expected, got) {
  if (!isWord(expected) || !isWord(got)) return false;
  if (lc(expected) === lc(got)) return true;
  const d = editDistance(lc(expected), lc(got));
  return d <= 2 && d < Math.min(expected.length, got.length);
}

const firstLetter = (s) => (String(s).match(/\p{L}/u) || [''])[0];
const endMark = (toks) => {
  let i = toks.length - 1;
  while (i >= 0 && CLOSERS.has(toks[i])) i--;
  return i >= 0 && END_MARKS.has(toks[i]) ? toks[i] : null;
};

/**
 * Grade a typed answer. result is 'correct' | 'incorrect' | 'review' | 'empty'.
 * fixed / unfixed / unknown hold indexes into item.errors; extraChanges lists other differences
 * from the model sentence ({ expected, got, kind, clear }).
 */
export function grade(item, answer) {
  const errors = Array.isArray(item?.errors) ? item.errors : [];
  const text = normalize(answer);
  const done = (result, parts, message) => ({ result, fixed: [], unfixed: [], unknown: [], extraChanges: [], ...parts, message });
  if (!text) return done('empty', {}, MESSAGES.empty);
  const keys = [item?.correct, ...(Array.isArray(item?.accepted) ? item.accepted : [])].map(normalize).filter(Boolean);
  if (keys.includes(text)) return done('correct', { fixed: errors.map((_, i) => i) }, MESSAGES.correct);

  const L = locate(item);
  const A = tokenize(text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text).map((t) => t.t);
  const C = L.corTokens.map((t) => t.t);
  const M = [[-1, -1], ...lcsPairs(C, A), [C.length, A.length]]; // matched (correct, answer) pairs + ends

  const status = new Array(errors.length).fill('unknown');
  const near = new Set(); // unfixed by a small slip rather than the original wrong form
  const hunks = [];

  // Group errors whose neighbourhoods (between matched anchor tokens) overlap.
  const spans = L.spans.filter(Boolean).map((sp) => {
    let kL = 0;
    while (kL + 1 < M.length && M[kL + 1][0] < sp.cTok[0]) kL++;
    let kR = kL + 1;
    while (M[kR][0] < sp.cTok[1]) kR++;
    return { ...sp, kL, kR };
  }).sort((x, y) => x.kL - y.kL || x.cTok[0] - y.cTok[0]);
  const groups = [];
  for (const sp of spans) {
    const last = groups[groups.length - 1];
    if (last && sp.kL < last.kR) { last.spans.push(sp); last.kR = Math.max(last.kR, sp.kR); }
    else groups.push({ kL: sp.kL, kR: sp.kR, spans: [sp] });
  }

  for (const g of groups) {
    const c0 = M[g.kL][0] + 1, c1 = M[g.kR][0], a0 = M[g.kL][1] + 1, a1 = M[g.kR][1];
    const segA = A.slice(a0, a1);
    // Fixed if the right form is in this part of the answer; unfixed if the wrong form still is.
    for (const sp of g.spans) {
      const { wrongToks: w, rightToks: r } = sp;
      const caseOnly = w.length === r.length && w.every((t, i) => lc(t) === lc(r[i]));
      if (caseOnly && sp.cTok[0] === 0 && lc(A[0] || '') !== lc(r[0])) continue; // sentence start moved: can't tell
      const order = indexOfRun(w, r) >= 0 && w.length > r.length ? ['unfixed', 'fixed'] : ['fixed', 'unfixed'];
      for (const o of order) if (indexOfRun(segA, o === 'fixed' ? r : w) >= 0) { status[sp.index] = o; break; }
      // Near miss in the same spot ("receieved" for "received"): still a mistake, not a rewrite.
      if (status[sp.index] === 'unknown' && segA.length === c1 - c0) {
        const got = segA.slice(sp.cTok[0] - c0, sp.cTok[1] - c0);
        if (got.length === r.length && got.some((t, i) => t !== r[i]) && got.every((t, i) => t === r[i] || nearMiss(r[i], t))) { status[sp.index] = 'unfixed'; near.add(sp.index); }
      }
    }
    // Expected text for this part, given what the child did with each mistake; other differences are extras.
    const E = [];
    let j = c0;
    for (const sp of [...g.spans].sort((x, y) => x.cTok[0] - y.cTok[0])) {
      if (sp.cTok[0] < j) continue;
      while (j < sp.cTok[0]) E.push({ t: C[j], start: j === 0 }), j++;
      const st = status[sp.index];
      (st === 'unfixed' && !near.has(sp.index) ? sp.wrongToks : sp.rightToks).forEach((t, i) => E.push({ t, start: j === 0 && i === 0, skip: st === 'unknown' || near.has(sp.index) }));
      j = sp.cTok[1];
    }
    while (j < c1) E.push({ t: C[j], start: j === 0 }), j++;
    for (const h of diffHunks(E.map((e) => e.t), segA)) {
      const touched = h.a1 > h.a0 ? E.slice(h.a0, h.a1).some((e) => e.skip) : E[h.a0 - 1]?.skip || E[h.a0]?.skip;
      if (touched) continue;
      hunks.push({ exp: E.slice(h.a0, h.a1).map((e) => e.t), got: segA.slice(h.b0, h.b1), aStart: a0 + h.b0, expAtStart: h.a0 === 0 && c0 === 0 && (E[0]?.start ?? false) });
    }
  }
  // Differences outside every mistake's neighbourhood.
  const inGroup = (k) => groups.some((g) => k >= g.kL && k < g.kR);
  for (let k = 0; k < M.length - 1; k++) {
    if (inGroup(k)) continue;
    const c0 = M[k][0] + 1, c1 = M[k + 1][0], a0 = M[k][1] + 1, a1 = M[k + 1][1];
    if (c1 > c0 || a1 > a0) hunks.push({ exp: C.slice(c0, c1), got: A.slice(a0, a1), aStart: a0, expAtStart: c0 === 0 });
  }

  // Classify: words moved elsewhere are a rewrite (review), not a mistake.
  const bag = (key) => { const m = new Map(); hunks.forEach((h) => h[key].forEach((t) => m.set(lc(t), (m.get(lc(t)) || 0) + 1))); return m; };
  const insBag = bag('got'), delBag = bag('exp');
  // Mostly rewritten (under 70% of the model's tokens kept): word-by-word checks can't be trusted, so only
  // the whole-sentence checks below and mistakes still present count.
  const kept = M.length - 2;
  const rewritten = C.length - kept >= 3 && kept < 0.7 * C.length;
  const extras = hunks.map((h) => {
    const [kind, sure] = classify(h, A, insBag, delBag);
    const clear = sure && !rewritten;
    return { expected: joinTokens(h.exp), got: joinTokens(h.got), kind, clear, aStart: h.aStart, aEnd: h.aStart + h.got.length };
  });

  // Whole-sentence checks: capital at the start, mark at the end.
  const pending = (cIndex) => spans.some((sp) => status[sp.index] !== 'fixed' && cIndex >= sp.cTok[0] && cIndex < sp.cTok[1]);
  const aFirst = firstLetter(text), cFirst = firstLetter(L.cor);
  if (aFirst && aFirst !== aFirst.toUpperCase() && cFirst && cFirst !== cFirst.toLowerCase() && !pending(0)
    && !extras.some((x) => x.clear && x.aStart === 0)) {
    extras.push({ expected: C[0] || '', got: A[0] || '', kind: 'capital-start', clear: true, aStart: 0, aEnd: 1 });
  }
  const cEnd = endMark(C);
  if (cEnd && !endMark(A) && !pending(C.length - 1) && !extras.some((x) => x.clear && x.aEnd === A.length)) {
    extras.push({ expected: cEnd, got: '', kind: 'end-mark', clear: true, aStart: A.length, aEnd: A.length });
  }

  const fixed = [], unfixed = [], unknown = [];
  status.forEach((s, i) => (s === 'fixed' ? fixed : s === 'unfixed' ? unfixed : unknown).push(i));
  // Same words and marks as a key sentence but different spacing ("Lopez,reads").
  if (!unfixed.length && !unknown.length && !extras.length) {
    extras.push({ expected: normalize(item.correct), got: text, kind: 'spacing', clear: true, aStart: 0, aEnd: A.length });
  }
  const extraChanges = extras.map(({ expected, got, kind, clear }) => ({ expected, got, kind, clear }));
  const clearOnes = extras.filter((x) => x.clear);

  if (unfixed.length || clearOnes.length) {
    const lead = unfixed.length || unknown.length
      ? `You fixed ${fixed.length} of ${plural(errors.length, 'mistake')}.`
      : 'You fixed every mistake we hid, but something new went wrong.';
    const tip = clearOnes.length ? ` ${TIPS[clearOnes[0].kind] || ''}` : ' Look again!';
    return done('incorrect', { fixed, unfixed, unknown, extraChanges }, (lead + tip).trim());
  }
  return done('review', { fixed, unfixed, unknown, extraChanges }, MESSAGES.review);
}

// ---------- Thinking Lab ----------

export const LAB_CHOICES = [
  { value: 'spelling', label: 'Spelling' },
  { value: 'capitalization', label: 'Capital letters' },
  { value: 'punctuation', label: 'Punctuation' },
  { value: 'grammar', label: 'Grammar' },
  { value: 'more-than-one', label: 'More than one type' },
];

/** Which kind of mistake the sentence has: one category, or 'more-than-one'. */
export function labCategory(item) {
  const cats = [...new Set((item?.errors || []).map((e) => e?.category).filter(Boolean))];
  return cats.length === 1 ? cats[0] : 'more-than-one';
}

// ---------- Seeded randomness ----------

/** Stable 32-bit hash of a string (FNV-1a). */
export function hashString(s) {
  let h = 0x811c9dc5;
  for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/** Deterministic random numbers in [0, 1) from a string or number seed (mulberry32). */
export function rng(seed) {
  let a = typeof seed === 'number' && Number.isFinite(seed) ? seed >>> 0 : hashString(String(seed ?? ''));
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------- Progress ----------

/** A fresh per-student record (plain JSON). `recent` keeps the ids of the last two sessions. */
export function newProgress() {
  return { version: 1, seen: {}, tick: 0, stats: {}, missed: [], lastSession: null, recent: [] };
}

function copyProgress(p) {
  const base = newProgress();
  const src = p && typeof p === 'object' ? JSON.parse(JSON.stringify(p)) : {};
  return { ...base, ...src, seen: { ...(src.seen || {}) }, stats: { ...(src.stats || {}) }, missed: [...(src.missed || [])], recent: [...(src.recent || [])] };
}

const resultOf = (g) => (typeof g === 'string' ? g : g?.result);

/**
 * Record one answer (returns a new progress object). Stats count only right/wrong (review and empty don't),
 * only the first attempt (pass { attempt: 2 } or { firstAttempt: false } for retries), and not Learn mode.
 * The missed list gains incorrect items and drops them once answered correctly.
 */
export function recordAnswer(progress, item, gradeResult, { mode = 'practice', attempt = 1, firstAttempt } = {}) {
  const p = copyProgress(progress);
  const id = item?.id;
  if (!id) return p;
  const result = resultOf(gradeResult);
  p.tick += 1;
  p.seen[id] = p.tick;
  const first = firstAttempt ?? attempt <= 1;
  if (mode !== 'learn' && first && (result === 'correct' || result === 'incorrect')) {
    const skill = item.skill || 'mixed';
    const s = { right: 0, wrong: 0, ...(p.stats[skill] || {}) };
    if (result === 'correct') s.right += 1; else s.wrong += 1;
    p.stats[skill] = s;
  }
  if (result === 'incorrect' && !p.missed.includes(id)) p.missed.push(id);
  if (result === 'correct') p.missed = p.missed.filter((x) => x !== id);
  return p;
}

/** Mark a whole session's items as seen now and remember it among the last two sessions. */
export function markSessionSeen(progress, ids) {
  const p = copyProgress(progress);
  const list = [...new Set((ids || []).filter(Boolean))];
  p.tick += 1;
  for (const id of list) p.seen[id] = p.tick;
  p.recent = [...p.recent, list].slice(-2);
  return p;
}

// ---------- Test reserve and session picking ----------

const reserveCache = new WeakMap();

/**
 * About 20% of items held back for tests: per skill, round-robin across difficulties, lowest id-hash first.
 * At least 2 per skill when the skill has 4+ items. Deterministic for the same ids. Returns a Set of ids.
 */
export function TEST_RESERVE(items) {
  if (Array.isArray(items) && reserveCache.has(items)) return reserveCache.get(items);
  const bySkill = new Map();
  for (const it of items || []) {
    if (!it?.id) continue;
    if (!bySkill.has(it.skill)) bySkill.set(it.skill, []);
    bySkill.get(it.skill).push(it);
  }
  const reserve = new Set();
  for (const list of bySkill.values()) {
    const n = list.length;
    const k = n >= 4 ? Math.max(2, Math.round(n * 0.2)) : n >= 2 ? 1 : 0;
    const levels = [...new Set(list.map((i) => i.difficulty))].sort((a, b) => {
      const ia = DIFFICULTIES.indexOf(a), ib = DIFFICULTIES.indexOf(b);
      return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib) || String(a).localeCompare(String(b));
    });
    const queues = levels.map((d) => list.filter((i) => i.difficulty === d).sort((a, b) => hashString(a.id) - hashString(b.id) || (a.id < b.id ? -1 : 1)));
    let taken = 0;
    for (let round = 0; taken < k; round++) {
      let any = false;
      for (const q of queues) if (taken < k && q[round]) { reserve.add(q[round].id); taken++; any = true; }
      if (!any) break;
    }
  }
  if (Array.isArray(items)) reserveCache.set(items, reserve);
  return reserve;
}

/** Items ordered unseen first, then least recently seen; ties broken by the seeded random. */
function byRecency(list, seen, rand) {
  return list.map((it) => ({ it, r: rand(), t: Number.isFinite(seen[it.id]) ? seen[it.id] : -1 }))
    .sort((a, b) => a.t - b.t || a.r - b.r).map((x) => x.it);
}

function skillQueues(list, seen, rand) {
  const q = new Map();
  for (const it of byRecency(list, seen, rand)) {
    if (!q.has(it.skill)) q.set(it.skill, []);
    q.get(it.skill).push(it);
  }
  return q;
}

/** Practice/Lab: draw skills at random, weighted toward weak skills and unseen items, avoiding streaks. */
function drawWeighted(list, n, progress, rand) {
  const queues = skillQueues(list, progress.seen, rand);
  const out = [];
  let lastSkill = null;
  while (out.length < n) {
    const options = [...queues.entries()].filter(([, q]) => q.length).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    if (!options.length) break;
    const weights = options.map(([skill, q]) => {
      const s = progress.stats[skill] || {};
      const acc = ((s.right || 0) + 1) / ((s.right || 0) + (s.wrong || 0) + 2);
      let w = 0.5 + (1 - acc) * 2;
      if (!Number.isFinite(progress.seen[q[0].id])) w *= 3;
      if (skill === lastSkill && options.length > 1) w *= 0.3;
      return w;
    });
    let x = rand() * weights.reduce((a, b) => a + b, 0), i = 0;
    while (i < weights.length - 1 && x >= weights[i]) x -= weights[i++];
    const [skill, q] = options[i];
    out.push(q.shift());
    lastSkill = skill;
  }
  return out;
}

/** Test: take skills in turn (shuffled order each round) so every skill is represented. */
function drawRoundRobin(list, n, progress, rand) {
  const queues = skillQueues(list, progress.seen, rand);
  const out = [];
  while (out.length < n) {
    const skills = shuffleInPlace([...queues.keys()].filter((s) => queues.get(s).length).sort(), rand);
    if (!skills.length) break;
    for (const s of skills) if (out.length < n) out.push(queues.get(s).shift());
  }
  return out;
}

/**
 * Pick a session: an array of item ids.
 * opts: { mode: 'learn'|'practice'|'lab'|'test', size, skill, difficulty, seed, onlyIds }.
 * Never repeats an id; same inputs → same ids; falls back to least recently seen once everything is seen.
 */
export function pickSession(items, progress, opts = {}) {
  const mode = opts.mode || 'practice';
  const size = Math.max(0, Math.floor(Number(opts.size ?? DEFAULT_SIZE[mode] ?? 10)) || 0);
  const seenIds = new Set();
  const all = (items || []).filter((it) => it?.id && !seenIds.has(it.id) && seenIds.add(it.id))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (Array.isArray(opts.onlyIds)) {
    const known = new Set(all.map((i) => i.id));
    return [...new Set(opts.onlyIds)].filter((id) => known.has(id)).slice(0, size);
  }
  const p = copyProgress(progress);
  const rand = rng(`${opts.seed ?? 0}|${mode}|${opts.skill || ''}|${opts.difficulty || ''}`);
  const reserve = TEST_RESERVE(items);
  const pool = opts.skill ? all.filter((i) => i.skill === opts.skill) : all;
  // Requested difficulty first, then the rest of the pool if there aren't enough.
  const byDifficulty = (list) => (opts.difficulty ? [list.filter((i) => i.difficulty === opts.difficulty), list.filter((i) => i.difficulty !== opts.difficulty)] : [list]);
  const open = pool.filter((i) => !reserve.has(i.id)), held = pool.filter((i) => reserve.has(i.id));

  let tiers, draw;
  if (mode === 'test') {
    const recent = new Set((p.recent || []).flat());
    tiers = [held, open.filter((i) => !recent.has(i.id)), open.filter((i) => recent.has(i.id))];
    draw = drawRoundRobin;
  } else {
    tiers = [...byDifficulty(open), ...byDifficulty(held)];
    draw = mode === 'learn' ? (list, n) => byRecency(list, p.seen, rand).slice(0, n) : drawWeighted;
  }
  const out = [];
  for (const tier of tiers) {
    if (out.length >= size) break;
    out.push(...draw(tier, size - out.length, p, rand));
  }
  if (mode === 'test') shuffleInPlace(out, rand);
  return out.map((i) => i.id);
}

/** Score a finished test. answers: [{ id, answer, grade }] (grade = grade() result or its result string). */
export function summarizeTest(items, answers) {
  const byId = new Map((items || []).map((i) => [i.id, i]));
  const sum = { total: 0, correct: 0, incorrect: 0, review: 0, scorePercent: 0, bySkill: {}, missedIds: [] };
  for (const a of answers || []) {
    const result = resultOf(a?.grade);
    const skill = byId.get(a?.id)?.skill || 'mixed';
    const s = (sum.bySkill[skill] ||= { correct: 0, total: 0 });
    sum.total += 1;
    s.total += 1;
    if (result === 'correct') { sum.correct += 1; s.correct += 1; }
    else if (result === 'review') sum.review += 1;
    else { sum.incorrect += 1; sum.missedIds.push(a?.id); } // incorrect or left blank
  }
  const counted = sum.total - sum.review;
  sum.scorePercent = counted > 0 ? Math.round((100 * sum.correct) / counted) : 0;
  return sum;
}

// ---------- Hints, explanations, highlighting ----------

const CATEGORY_WORDS = { spelling: 'spelling', capitalization: 'capital letter', punctuation: 'punctuation', grammar: 'grammar' };
const HINT_KEYWORDS = new Set(['type', 'where', 'specific']);

/** Errors in sentence order, each with its original index. */
function ordered(item) {
  const { spans } = locate(item);
  return (item?.errors || []).map((e, index) => ({ e, index, at: spans[index]?.iStart ?? Infinity }))
    .sort((a, b) => a.at - b.at || a.index - b.index);
}

/**
 * A hint: level 1 = what kind of mistakes, 2 = where to look, 3 = a specific fix.
 * Uses the bank's own hint text when it has some. opts.unfixed (error indexes) targets level 3 at a mistake still left.
 */
export function hint(item, level = 1, opts = {}) {
  const lvl = Math.min(3, Math.max(1, Math.floor(level) || 1));
  const own = item?.hints?.[lvl - 1];
  if (typeof own === 'string' && own.trim() && !HINT_KEYWORDS.has(own.trim().toLowerCase())) return own.trim();
  const list = ordered(item);
  if (!list.length) return 'Read the sentence slowly, one word at a time.';
  if (lvl === 1) {
    const counts = new Map();
    list.forEach(({ e }) => counts.set(e.category, (counts.get(e.category) || 0) + 1));
    const kinds = [...counts.keys()].map((c) => CATEGORY_WORDS[c] || 'other');
    const named = kinds.length > 1 ? `${kinds.slice(0, -1).join(', ')} and ${kinds[kinds.length - 1]}` : kinds[0];
    return `This sentence has ${plural(list.length, 'mistake')}. Look for ${named} mistakes.`;
  }
  if (lvl === 2) return `Look closely at: ${list.map(({ e }) => `"${e.wrong}"`).join(', ')}.`;
  const left = Array.isArray(opts.unfixed) ? list.filter(({ index }) => opts.unfixed.includes(index)) : list;
  const { e } = left[0] || list[0];
  return `Try changing "${e.wrong}" to "${e.right}".${e.explanation ? ` ${e.explanation}` : ''}`;
}

/** Every mistake in sentence order: [{ wrong, right, category, explanation }]. */
export function explainErrors(item) {
  return ordered(item).map(({ e }) => ({ wrong: e.wrong, right: e.right, category: e.category, explanation: e.explanation || '' }));
}

/** The incorrect sentence cut into pieces for underlining: [{ text, errorIndex|null }], covering the whole string. */
export function markErrors(item) {
  const text = String(item?.incorrect ?? '');
  const { spans } = locate(item);
  const marks = spans.filter((s) => s && s.markEnd > s.markStart).sort((a, b) => a.markStart - b.markStart);
  const out = [];
  let pos = 0;
  for (const s of marks) {
    if (s.markStart < pos) continue; // never overlap
    if (s.markStart > pos) out.push({ text: text.slice(pos, s.markStart), errorIndex: null });
    out.push({ text: text.slice(s.markStart, s.markEnd), errorIndex: s.index });
    pos = s.markEnd;
  }
  if (pos < text.length || !out.length) out.push({ text: text.slice(pos), errorIndex: null });
  return out;
}

/** The sentence after each correction, one at a time, left to right. The last one is the model sentence. */
export function stepByStep(item) {
  const text = String(item?.incorrect ?? '');
  const correct = String(item?.correct ?? '');
  const { spans } = locate(item);
  const marks = spans.filter(Boolean).sort((a, b) => a.iStart - b.iStart);
  const steps = [];
  let pos = 0, head = '';
  for (const s of marks) {
    if (s.iStart < pos) continue;
    head += text.slice(pos, s.iStart) + s.fix;
    pos = s.iEnd;
    steps.push((head + text.slice(pos)).replace(/ {2,}/g, ' ')); // a removed word leaves no double space
  }
  if (!steps.length || normalize(steps[steps.length - 1]) !== normalize(correct)) steps.push(correct);
  else steps[steps.length - 1] = correct;
  return steps;
}
