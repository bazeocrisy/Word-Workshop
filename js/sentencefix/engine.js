// Sentence Fix game engine (pure; unit-tested in Node, no DOM).
// A child sees a sentence with planted mistakes and types the fixed sentence. This module:
//  • grades the answer against the model sentence, mistake by mistake (never guesses "wrong" when unsure:
//    a genuinely different rewrite is sent to a grown-up as "review");
//  • sorts items into Thinking Lab categories;
//  • picks seeded, repeat-avoiding sessions and keeps a small per-student progress record;
//  • builds hints, explanations, highlight segments and step-by-step fixes for Learn mode.

import { WORD_FILTER } from '../../vendor/english-words/words.js'; // English word list (public domain ENABLE)

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

// ---------- Word knowledge (small lists, enough for grade-3 sentences) ----------

// Irregular past tenses → base verb. "goed", "go", "goes" for "went" are wrong forms, not rewrites.
const IRREGULAR_PAST = {
  went: 'go', caught: 'catch', grew: 'grow', swam: 'swim', found: 'find', knew: 'know', taught: 'teach',
  read: 'read', ate: 'eat', ran: 'run', threw: 'throw', sang: 'sing', drew: 'draw', made: 'make', wrote: 'write',
  saw: 'see', came: 'come', took: 'take', gave: 'give', got: 'get', said: 'say', told: 'tell', sat: 'sit',
  bought: 'buy', brought: 'bring', thought: 'think', flew: 'fly', drove: 'drive', rode: 'ride', won: 'win',
  hid: 'hide', began: 'begin', broke: 'break', built: 'build', felt: 'feel', kept: 'keep', left: 'leave',
  lost: 'lose', met: 'meet', paid: 'pay', sent: 'send', slept: 'sleep', spent: 'spend', stood: 'stand',
  fell: 'fall', held: 'hold', heard: 'hear', did: 'do', had: 'have', rose: 'rise', chose: 'choose',
  froze: 'freeze', wore: 'wear', blew: 'blow', dug: 'dig', hung: 'hang', spoke: 'speak', woke: 'wake',
  shook: 'shake', forgot: 'forget', understood: 'understand', sold: 'sell', sewed: 'sew', fed: 'feed',
  led: 'lead', hit: 'hit', cut: 'cut', put: 'put', shut: 'shut', let: 'let', bit: 'bite', slid: 'slide',
  swung: 'swing', stuck: 'stick', spun: 'spin', drank: 'drink', rang: 'ring', sank: 'sink', shone: 'shine',
};
// Past participles: "swum" for "swam" is a wrong verb form, not a rewrite.
const PARTICIPLE = {
  swam: 'swum', sang: 'sung', drank: 'drunk', rang: 'rung', began: 'begun', sank: 'sunk', ate: 'eaten', wrote: 'written',
  rode: 'ridden', saw: 'seen', took: 'taken', gave: 'given', went: 'gone', threw: 'thrown', drew: 'drawn', grew: 'grown',
  knew: 'known', flew: 'flown', blew: 'blown', broke: 'broken', chose: 'chosen', froze: 'frozen', spoke: 'spoken',
  woke: 'woken', wore: 'worn', shook: 'shaken', forgot: 'forgotten', hid: 'hidden', fell: 'fallen', drove: 'driven',
  rose: 'risen', bit: 'bitten',
};
// Homophones (and near-homophones) children mix up. Typing one for another is a mistake, not a rewrite.
const HOMOPHONES = new Set(('there their they\'re to too two your you\'re its it\'s no know new knew by buy bye ' +
  'hear here right write rite pair pear pare sea see one won ate eight for four whole hole hour our week weak ' +
  'through threw blue blew son sun flour flower which witch wood would tail tale meet meat road rode mail male ' +
  'plain plane peace piece sale sail bear bare dear deer wear where we\'re were whose who\'s than then ' +
  'principal principle break brake cent sent scent knot not made maid night knight red read reed road rowed ' +
  'some sum tide tied toe tow wait weight way weigh wore war allowed aloud ant aunt be bee berry bury cell sell ' +
  'flew flu grown groan hair hare herd heard hi high hole knows nose pail pale passed past rain reign rein ' +
  'sew so sow stair stare steal steel tail waist waste').split(' '));
// Real words children commonly confuse (sound-alike or look-alike): one typed for another is a mistake.
const CONFUSABLES = [['our', 'are', 'hour'], ['then', 'than'], ['where', 'were', 'wear', "we're"], ['of', 'off'],
  ['your', "you're"], ['to', 'too', 'two'], ['there', 'their', "they're"], ['its', "it's"], ['accept', 'except'],
  ['lose', 'loose'], ['quiet', 'quite'], ['whose', "who's"], ['affect', 'effect']];
// Forms that only differ by agreement inside the same tense: one for another is an agreement mistake.
const AGREEMENT_SETS = [['is', 'are', 'am'], ['was', 'were'], ['has', 'have'], ['does', 'do'], ["doesn't", "don't"],
  ["isn't", "aren't"], ["wasn't", "weren't"], ["there's", 'there are'], ["here's", 'here are']];
// Common real words: a typed real word close to the key ("were" for "are") may be a rewrite, so never a "misspelling".
const REAL_WORDS = new Set(('a an the is are am was were be been being has have had do does did done can cannot ' +
  'could will would shall should may might must not no yes and or but so if as at by for from in into of on off ' +
  'to too two up down out over with he she it its we they you your i me him her us them his hers our ours their ' +
  'theirs there then than this that these those what when where who whom why how all any some one more most ' +
  'very just also each every both few many much said says see saw seen go goes went gone get got come came ' +
  'make made take took give gave run ran find found know knew grow grew').split(' '));
// Rare dictionary words that are really common misspellings ("stoped" for "stopped"): never count them as real.
const KNOWN_MISSPELLINGS = new Set(['wich', 'stoped', 'watter', 'wiling']);
// Helper verbs that take "n't" (can't → "ca", won't → "wo").
const NT_VERBS = new Set(['do', 'does', 'did', 'is', 'are', 'was', 'were', 'has', 'have', 'had', 'could', 'would',
  'should', 'must', 'need', 'might', 'ca', 'wo', 'sha', 'ai']);
let wordBits = null;
/** Is `w` (lowercase, no apostrophe) in the English word list? (Bloom filter: never misses a listed word.) */
function inWordList(w) {
  if (!wordBits) wordBits = Uint8Array.from(atob(WORD_FILTER.bits), (c) => c.charCodeAt(0));
  const fnv = (seed) => {
    let h = seed;
    for (const ch of w) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  };
  const { m, k } = WORD_FILTER, h1 = fnv(0x811c9dc5), h2 = fnv(0x050c5d1f) | 1;
  for (let i = 0; i < k; i++) {
    const b = ((h1 + Math.imul(i, h2)) >>> 0) % m;
    if (!(wordBits[b >> 3] & (1 << (b & 7)))) return false;
  }
  return true;
}
/** A real English word (or a contraction/possessive of one), as far as the word list can tell. */
function isRealWord(word) {
  const w = lc(String(word));
  if (!w || KNOWN_MISSPELLINGS.has(w)) return false;
  if (REAL_WORDS.has(w)) return true;
  if (w.includes('-')) return w.split('-').every(isRealWord);
  let m;
  if ((m = w.match(/^(.+)n't$/))) return NT_VERBS.has(m[1]);
  if ((m = w.match(/^(.+)'(s|re|ll|ve|d|m)$/)) || (m = w.match(/^(.+s)'$/))) return !m[1].includes("'") && inWordList(m[1]);
  return !w.includes("'") && inWordList(w);
}
// Small words a fair rewrite may leave out ("most games" for "most of the games").
const SMALL_WORDS = new Set(['of', 'the', 'a', 'an', 'that', 'very', 'really', 'just', 'also', 'all', 'still', 'some']);
// Contractions and their long forms count as the same words when checking equivalence.
const PRONOUN_IS = new Set(['it', 'he', 'she', 'that', 'there', 'here', 'what', 'who', 'where', 'how']);
const SUBJECTS = new Set(['i', 'you', 'he', 'she', 'it', 'we', 'they']);
/**
 * Words with contractions written out. invert: a "n't" word right before a subject pronoun is a question
 * ("isn't it?"), whose long form is "is it not", so the pronoun goes before "not".
 */
function expandWords(toks, invert = true) {
  const out = [];
  for (let i = 0; i < toks.length; i++) {
    const raw = toks[i];
    if (!isWord(raw)) continue;
    const t = lc(raw);
    let m;
    const neg = t === 'cannot' || t === "can't" ? 'can' : t === "won't" ? 'will' : (m = t.match(/^(.+)n't$/)) ? m[1] : null;
    if (neg) {
      const subj = invert && t !== 'cannot' && toks[i + 1] && SUBJECTS.has(lc(toks[i + 1]));
      if (subj) out.push(neg, lc(toks[++i]), 'not');
      else out.push(neg, 'not');
    }
    else if ((m = t.match(/^(.+)'re$/))) out.push(m[1], 'are');
    else if ((m = t.match(/^(.+)'m$/))) out.push(m[1], 'am');
    else if ((m = t.match(/^(.+)'ll$/))) out.push(m[1], 'will');
    else if ((m = t.match(/^(.+)'ve$/))) out.push(m[1], 'have');
    else if (t === "let's") out.push('let', 'us');
    else if ((m = t.match(/^(.+)'s$/)) && PRONOUN_IS.has(m[1])) out.push(m[1], 'is');
    else out.push(t);
  }
  return out;
}
const sameList = (a, b) => a.length === b.length && a.every((t, i) => t === b[i]);

/** a/an: does `article` suit the word after it? (vowel sound, with the common exceptions) */
function articleFits(article, next) {
  const w = lc(next || '');
  if (!w) return true;
  const vowelSound = (/^[aeiou]/.test(w) && !/^(uni|use|usu|uke|ure|eu|one|once)/.test(w)) || /^(hour|honest|honor|heir)/.test(w);
  return lc(article) === 'an' ? vowelSound : !vowelSound;
}

/** Possible stems of a word with a simple ending removed (walks/walked/walking → walk). */
function stems(w) {
  const s = new Set([w]);
  const add = (x) => x.length >= 2 && s.add(x);
  if (w.endsWith('ies')) add(`${w.slice(0, -3)}y`);
  if (w.endsWith('ied')) add(`${w.slice(0, -3)}y`);
  if (w.endsWith('es')) add(w.slice(0, -2));
  if (w.endsWith('s')) add(w.slice(0, -1));
  if (w.endsWith('ed')) { add(w.slice(0, -2)); add(w.slice(0, -1)); if (w.at(-3) === w.at(-4)) add(w.slice(0, -3)); }
  if (w.endsWith('ing')) { add(w.slice(0, -3)); add(`${w.slice(0, -3)}e`); }
  return s;
}

/**
 * Typed word `got` where the key has `exp`: a clear mistake ('capital', 'article', 'homophone', 'verb',
 * 'agreement', 'spelling') or null (could be a fair rewrite). `inSlot`: this is where a planted mistake was,
 * so another form of the same word (cook/cooked, want/wants) is also a mistake. `planted`: the planted mistake there.
 */
function wrongWord(exp, got, next, inSlot, planted) {
  const e = lc(exp), g = lc(got);
  if (e === g) return exp === got ? null : 'capital';
  if ((e === 'a' || e === 'an') && (g === 'a' || g === 'an')) return articleFits(got, next) ? null : 'article';
  if (HOMOPHONES.has(e) && HOMOPHONES.has(g)) return 'homophone';
  // The same with an ending ("reeds" for "reads", "pairs" for "pears"), when the spellings are close.
  const homStem = (w) => [...stems(w)].some((x) => HOMOPHONES.has(x));
  if (homStem(e) && homStem(g) && editDistance(e, g) <= 2) return 'homophone';
  if (CONFUSABLES.some((set) => set.includes(e) && set.includes(g))) return 'homophone';
  if (AGREEMENT_SETS.some((set) => set.includes(e) && set.includes(g))) return 'agreement';
  const base = IRREGULAR_PAST[e];
  if (base) {
    const forms = [base, `${base}s`, `${base}es`, `${base}ed`, `${base}d`, `${base}${base.at(-1)}ed`, `${e}ed`, `${base}ing`, PARTICIPLE[e]];
    if (forms.includes(g)) return 'verb';
  }
  if (inSlot && [...stems(e)].some((x) => stems(g).has(x))) return 'verb';
  const noApos = (x) => x.replace(/'/g, '');
  if (noApos(e) === noApos(g)) return 'spelling'; // apostrophe left out or misplaced: "cant", "does'nt"
  if (g.includes('our') && g.replace('our', 'or') === e) return 'spelling'; // British "colours" in a US bank
  // Plural and possessive forms of the same noun mixed up ("fox's" for "foxes", "coaches'" for "coach's").
  if ((e.includes("'") || g.includes("'")) && [...stems(noApos(e))].some((x) => stems(noApos(g)).has(x))) return 'spelling';
  // One where the key has more than one, or the other way round ("dog" for "dogs"): a changed number, not a rewrite.
  if (Math.min(e.length, g.length) >= 3 && (g === `${e}s` || g === `${e}es` || e === `${g}s` || e === `${g}es`)) return 'number';
  // A real word ("placed" for "planted", "hats" for "caps") may be a fair rewrite: never call it a misspelling,
  // unless it is one letter from both the fix and the planted mistake ("now" where "no" → "know").
  if (isRealWord(g)) return inSlot && planted && lc(planted) !== e && editDistance(e, g) === 1 && editDistance(lc(planted), g) === 1 ? 'spelling' : null;
  if (nearMiss(exp, got)) return 'spelling';
  // In a mistake's spot, a non-word a few letters off the fix ("dosent", "exsighted") is a misspelled try.
  if (inSlot && e[0] === g[0] && Math.min(e.length, g.length) >= 6 && editDistance(noApos(e), noApos(g)) <= 3) return 'spelling';
  return null;
}

/** Compare the key's tokens with the typed tokens word by word: a clear mistake kind, 'same', or null. */
function wordVerdict(exp, got, after, inSlot, planted) {
  if (exp.length !== got.length) {
    const squash = (toks) => lc(toks.join('')).replace(/-/g, '');
    return exp.length && squash(exp) === squash(got) ? 'spelling' : null;
  }
  let kind = 'same';
  for (let i = 0; i < exp.length; i++) {
    if (exp[i] === got[i]) continue;
    if (!isWord(exp[i]) || !isWord(got[i])) return null;
    const k = wrongWord(exp[i], got[i], got[i + 1] ?? after, inSlot, planted?.length === exp.length ? planted[i] : undefined);
    if (!k) return null;
    if (kind === 'same') kind = k;
  }
  return kind;
}

// ---------- Commas ----------

// Words that start an opening phrase ("Last Sunday, ...", "In 1776, ..."): its comma is optional.
const OPENERS = new Set(('in on at after before during last every yesterday today tomorrow tonight long when if since ' +
  'because for many this next first then finally later once while as outside inside earlier sometimes suddenly ' +
  'luckily soon each one some at by from until with without whenever').split(' '));
const YES_NO = new Set(['yes', 'no', 'well', 'oh', 'okay', 'ok', 'wow', 'hey']);
const WEEKDAYS = new Set(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);
const MONTHS = new Set(['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']);
const STATES = new Set(('alabama alaska arizona arkansas california colorado connecticut delaware florida georgia hawaii ' +
  'idaho illinois indiana iowa kansas kentucky louisiana maine maryland massachusetts michigan minnesota mississippi ' +
  'missouri montana nebraska nevada ohio oklahoma oregon pennsylvania tennessee texas utah vermont virginia ' +
  'washington wisconsin wyoming canada mexico england france').split(' '));
const CONJ = new Set(['and', 'or', 'but', 'so', 'yet', 'nor']);
const TAG_VERBS = new Set(['is', 'are', 'was', 'were', 'do', 'does', 'did', 'can', 'will', 'has', 'have', 'should', 'could', 'would']);
const TITLES = new Set(['mr', 'mrs', 'ms', 'dr', 'st', 'jr']);
// Words that can start a new clause after ", and" (a subject or its determiner, or "then"/"there").
const CLAUSE_STARTS = new Set(['i', 'you', 'he', 'she', 'it', 'we', 'they', 'the', 'a', 'an', 'my', 'our', 'your',
  'his', 'her', 'their', 'its', 'this', 'that', 'these', 'those', 'each', 'every', 'both', 'all', 'some', 'many',
  'then', 'there', 'here', 'now', 'later', 'soon', 'so', 'one', 'two']);
const isCap = (t) => !!t && isWord(t) && t[0] !== lc(t[0]);

/** Is the opening phrase before index k (no marks, ≤ 4 words, starts with an opener word)? */
function afterOpener(toks, k) {
  const before = toks.slice(0, k);
  return before.length > 0 && before.length <= 4 && before.every(isWord) && OPENERS.has(lc(before[0]));
}

/** A comma at index k of the model sentence that a clear rule requires (list, date, place, name, yes/no, speech). */
function commaRequired(C, k) {
  const prev = C[k - 1] || '', next = C[k + 1] || '';
  if (next === '"' || prev === '"') return true; // speech: asked, "Who ..."
  const startIdx = C[0] === '"' ? 1 : 0;
  if (k - 1 === startIdx && YES_NO.has(lc(prev))) return true;
  if (/^\d+$/.test(prev) && /^\d+$/.test(next)) return true; // March 4, 1852
  if (WEEKDAYS.has(lc(prev)) && MONTHS.has(lc(next))) return true; // Monday, May 3
  if (isCap(prev) && STATES.has(lc(next))) return true; // Boston, Massachusetts
  if (afterOpener(C, k)) return false;
  if (CONJ.has(lc(next)) && C.slice(Math.max(0, k - 6), k).includes(',')) return false; // Oxford / compound comma
  // A list: short items separated by commas, ending in "and"/"or".
  let words = 0;
  for (let i = k + 1; i < C.length; i++) {
    if (lc(C[i]) === 'and' || lc(C[i]) === 'or') { if (words >= 1 && words <= 3) return true; break; }
    if (C[i] === ',') { if (words < 1 || words > 3) break; words = 0; continue; }
    if (!isWord(C[i]) || ++words > 3) break;
  }
  if (k - 1 === startIdx && isCap(prev) && !OPENERS.has(lc(prev))) return true; // Sam, do you ...
  if (isCap(next) && END_MARKS.has(C[k + 2])) return true; // Thank you, Mom.
  // Tag question: "..., isn't it?"
  if ((/n't$/i.test(next) || TAG_VERBS.has(lc(next))) && SUBJECTS.has(lc(C[k + 2] || '')) && C[k + 3] === '?') return true;
  // A pair of commas around a short phrase in mid-sentence (appositive): "My team, the Hawks, won."
  const between = (from, step) => {
    let words = 0;
    for (let i = from; i >= 0 && i < C.length; i += step) {
      const t = C[i];
      if (t === ',') return words >= 1 && words <= 4 ? i : -1;
      if (t === '.' && TITLES.has(lc(C[i - 1] || ''))) continue; // Mr. Patel
      if (!isWord(t) || CONJ.has(lc(t)) || ++words > 4) return -1;
    }
    return -1;
  };
  const pair = (open, close) => open > startIdx + 1 && !afterOpener(C, open) && !CONJ.has(lc(C[close + 1] || ''))
    && isWord(C[open - 1] || '') && isWord(C[close + 1] || '');
  const fwd = between(k + 1, 1), back = between(k - 1, -1);
  if ((fwd >= 0 && pair(k, fwd)) || (back >= 0 && pair(back, k))) return true;
  return false;
}

/** A past-tense verb: ends in -ed ("watched") or a known irregular past ("swam", "told"). */
const isPastVerb = (t) => !isCap(t) && (/^[a-z]{2,}ed$/.test(t) || Object.hasOwn(IRREGULAR_PAST, t));
/** Could be a present-tense verb with -s ("runs", "watches"). */
const isPresentS = (t) => !isCap(t) && /^[a-z]{2,}[^s']s$/.test(t);
/** Does the part before index k have a present-tense verb ("is", "has", "does", or "he runs", "the dog barks")? */
function presentBefore(A, k) {
  for (let i = 1; i < k; i++) {
    const t = lc(A[i]);
    if (t === 'is' || t === 'has' || t === 'does') return true;
    if (!isPresentS(A[i])) continue;
    const p = lc(A[i - 1]);
    if (['he', 'she', 'it'].includes(p) || isCap(A[i - 1])) return true;
    if (isWord(A[i - 1]) && ['the', 'a', 'my', 'our', 'his', 'her', 'their', 'each', 'every', 'this', 'that'].includes(lc(A[i - 2] || ''))) return true;
  }
  return false;
}

/** A comma typed at index k of the answer where the model has none: fine only in an optional spot. */
function commaAllowed(A, k) {
  const next = A[k + 1] || '';
  if (CONJ.has(lc(next)) && isWord(A[k - 1] || '')) {
    if (!['and', 'or', 'nor'].includes(lc(next))) return true; // before "but"/"so": joins two sentences
    // Oxford comma: the last item of a list ("crayons, glue, and paper").
    let words = 0, i = k - 1;
    while (i >= 0 && isWord(A[i]) && words <= 3) { words++; i--; }
    if (A[i] === ',' && words >= 1 && words <= 3) return true;
    // Compound sentence: a new clause with its own subject follows ("..., and Omar can hang it up", "..., and the
    // dogs bark"), not just one more item ("pears, and peaches", "flour, and water to make clay").
    let tail = 0;
    for (let j = k + 2; j < A.length && isWord(A[j]); j++) tail++;
    const subj = A[k + 2] || '';
    if (tail >= 2 && (CLAUSE_STARTS.has(lc(subj)) || isCap(subj))) return true;
    // A second verb for the same subject ("smiled, and said", "jumps in, and swims"): some teachers accept this
    // comma, so it goes to a grown-up rather than being marked wrong.
    return tail >= 1 && (isPastVerb(subj) || (isPresentS(subj) && presentBefore(A, k)));
  }
  if (afterOpener(A, k)) return true;
  if (next === '"') return true; // before speech
  return false;
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
  'double-mark': 'A sentence ends with just one mark.',
  comma: 'Check where your commas go.',
  dropped: 'It looks like a word or mark went missing.',
  repeated: 'A word is written twice.',
  spacing: 'Check the spaces between your words.',
  article: 'Check "a" and "an".',
  homophone: 'Check words that sound the same but are spelled differently.',
  verb: 'Check the form of each action word.',
  agreement: 'Check that each action word matches who is doing it.',
  number: 'Check whether each word means one or more than one.',
};
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Decide whether one difference (expected tokens → typed tokens) is clearly a mistake: [kind, clear]. */
function classify(h, A, C, insBag, delBag) {
  const { exp, got } = h;
  const inBag = (bag, toks) => toks.every((t) => (bag.get(lc(t)) || 0) > 0);
  if (!got.length) {
    if (inBag(insBag, exp)) return ['moved', false];
    if (exp.length === 1 && exp[0] === ',') return ['comma', h.cStart != null && commaRequired(C, h.cStart)];
    // Leaving out only small words ("most games" for "most of the games") can be a fair rewrite.
    if (exp.every((t) => SMALL_WORDS.has(lc(t)))) return ['dropped', false];
    return ['dropped', true];
  }
  if (!exp.length) {
    if (inBag(delBag, got)) return ['moved', false];
    if (got.length === 1 && got[0] === ',') return ['comma', !commaAllowed(A, h.aStart)];
    const before = A[h.aStart - 1], after = A[h.aStart + got.length];
    const repeated = got.length === 1 && [before, after].some((t) => t && lc(t) === lc(got[0]));
    return repeated ? ['repeated', true] : ['added', false];
  }
  if (exp.length === 1 && got.length === 1) {
    const [e] = exp, [g] = got;
    if (isWord(e) && isWord(g)) {
      if (lc(e) === lc(g)) return h.expAtStart !== (h.aStart === 0) ? ['moved', false] : ['capital', true];
      const k = wrongWord(e, g, A[h.aStart + 1], false);
      return k ? [k, true] : ['different-word', false];
    }
    if (!isWord(e) && !isWord(g)) {
      const clear = END_MARKS.has(e) !== END_MARKS.has(g) || e === '?' || g === '?';
      return ['punctuation', clear];
    }
    return ['rewrite', false];
  }
  const k = wordVerdict(exp, got, A[h.aStart + got.length], false);
  if (k && k !== 'same') return [k, true];
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
 * What the child typed where one planted mistake was. winC = the model's tokens there, winW = the same with the
 * mistake left in, winA = what was typed. Returns 'fixed' | 'unfixed' | 'wrong' (a different mistake there) |
 * 'equal' (same words, e.g. "cannot" for "can't") | 'alt' ("!" for ".": a grown-up should check) | null.
 */
function judgeSlot(winA, winC, winW, after) {
  if (sameList(winA, winC)) return 'fixed';
  if (sameList(winA, winW)) return 'unfixed';
  if (winA.length === winC.length) {
    const diffs = winA.map((t, i) => i).filter((i) => winA[i] !== winC[i]);
    if (diffs.length === 1 && END_MARKS.has(winA[diffs[0]]) && END_MARKS.has(winC[diffs[0]])) {
      return winA[diffs[0]] === '?' || winC[diffs[0]] === '?' ? 'wrong' : 'alt';
    }
  }
  const words = (toks) => toks.filter(isWord).map(lc);
  if (winA.length && sameList(words(winA), words(winC))) return 'wrong'; // same words, wrong marks or capitals
  if (expandWords(winA).length) {
    const tail = after && isWord(after) ? [after] : []; // "isn't" + "it" → "is it not"
    const xa = expandWords([...winA, ...tail]);
    if (sameList(xa, expandWords([...winC, ...tail]))) return 'equal';
    if (sameList(expandWords([...winA, ...tail], false), expandWords([...winC, ...tail], false))) return 'wrong'; // "is not it?"
    if (sameList(xa, expandWords([...winW, ...tail]))) return 'wrong';
  }
  const k = wordVerdict(winC, winA, after, true, winW);
  return k && k !== 'same' ? 'wrong' : null;
}

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

  // Mostly rewritten (under 70% of the model's tokens kept): word-by-word checks can't be trusted, so only
  // the whole-sentence checks and mistakes still exactly present count.
  const kept = M.length - 2;
  const rewritten = C.length - kept >= 3 && kept < 0.7 * C.length;
  const status = new Array(errors.length).fill('unknown');
  const settled = new Set(); // judged from a different form typed in the spot: leave its tokens out of "extras"
  const hunks = [];

  // Each error's window: the tokens between the nearest matched anchors around it.
  const spans = L.spans.filter(Boolean).map((sp) => {
    let kL = 0;
    while (kL + 1 < M.length && M[kL + 1][0] < sp.cTok[0]) kL++;
    let kR = kL + 1;
    while (M[kR][0] < sp.cTok[1]) kR++;
    return { ...sp, kL, kR };
  }).sort((x, y) => x.kL - y.kL || x.cTok[0] - y.cTok[0]);

  for (const sp of spans) {
    const { wrongToks: w, rightToks: r } = sp;
    const caseOnly = w.length === r.length && w.every((t, i) => lc(t) === lc(r[i]));
    if (caseOnly && sp.cTok[0] === 0 && lc(A[0] || '') !== lc(r[0])) continue; // sentence start moved: can't tell
    const cFrom = M[sp.kL][0] + 1, cTo = M[sp.kR][0];
    const winC = C.slice(cFrom, cTo), winA = A.slice(M[sp.kL][1] + 1, M[sp.kR][1]);
    const off = sp.cTok[0] - cFrom;
    const winW = [...winC.slice(0, off), ...w, ...winC.slice(off + r.length)];
    const after = A[M[sp.kR][1]];
    const rightFirst = !(indexOfRun(w, r) >= 0 && w.length > r.length); // "the the" → "the": look for the wrong form first
    // 1. The window also holds changed neighbours (often another mistake): if they line up one-to-one,
    //    judge just this mistake's own tokens.
    const pre = off, post = winC.length - off - r.length, aFrom = M[sp.kL][1] + 1;
    const lines = (ci, ai) => lc(C[ci]) === lc(A[ai]) || nearMiss(C[ci], A[ai]) || spans.some((o) => o !== sp && ci >= o.cTok[0] && ci < o.cTok[1]);
    let verdict = null;
    if ((pre || post) && winA.length > pre + post
      && [...Array(pre).keys()].every((i) => lines(cFrom + i, aFrom + i))
      && [...Array(post).keys()].every((i) => lines(cTo - 1 - i, aFrom + winA.length - 1 - i))) {
      verdict = judgeSlot(winA.slice(pre, winA.length - post), r, w, after);
    }
    // 2. The right form is there (the child changed something next to it).
    if (!verdict && rightFirst && indexOfRun(winA, r) >= 0) verdict = 'fixed';
    // 3. Judge the whole window.
    if (!verdict) verdict = judgeSlot(winA, winC, winW, after);
    // A mostly rewritten sentence: only an exact leftover mistake counts; other judgements go to a grown-up.
    if (rewritten && (verdict === 'wrong' || verdict === 'equal')) verdict = null;
    if (verdict === 'fixed' || verdict === 'unfixed') { status[sp.index] = verdict; continue; }
    if (verdict === 'wrong') { status[sp.index] = 'unfixed'; settled.add(sp.index); continue; }
    if (verdict === 'equal') { status[sp.index] = 'fixed'; settled.add(sp.index); continue; }
    if (verdict === 'alt') continue; // unknown → review
    // 4. Otherwise the child changed more around it: is the right (or wrong) form somewhere in that part?
    const order = rightFirst ? ['fixed', 'unfixed'] : ['unfixed', 'fixed'];
    for (const o of order) if (indexOfRun(winA, o === 'fixed' ? r : w) >= 0) { status[sp.index] = o; break; }
  }

  // Group errors whose windows overlap, then compare each group with what was expected given each status.
  const groups = [];
  for (const sp of spans) {
    const last = groups[groups.length - 1];
    if (last && sp.kL < last.kR) { last.spans.push(sp); last.kR = Math.max(last.kR, sp.kR); }
    else groups.push({ kL: sp.kL, kR: sp.kR, spans: [sp] });
  }
  for (const g of groups) {
    const c0 = M[g.kL][0] + 1, c1 = M[g.kR][0], a0 = M[g.kL][1] + 1, a1 = M[g.kR][1];
    const segA = A.slice(a0, a1);
    const E = [];
    let j = c0;
    for (const sp of [...g.spans].sort((x, y) => x.cTok[0] - y.cTok[0])) {
      if (sp.cTok[0] < j) continue;
      while (j < sp.cTok[0]) E.push({ t: C[j], c: j }), j++;
      const st = status[sp.index], skip = st === 'unknown' || settled.has(sp.index);
      (st === 'unfixed' && !skip ? sp.wrongToks : sp.rightToks).forEach((t, i) => E.push({ t, c: i === 0 ? j : null, skip }));
      j = sp.cTok[1];
    }
    while (j < c1) E.push({ t: C[j], c: j }), j++;
    for (const h of diffHunks(E.map((e) => e.t), segA)) {
      const touched = h.a1 > h.a0 ? E.slice(h.a0, h.a1).some((e) => e.skip) : E[h.a0 - 1]?.skip || E[h.a0]?.skip;
      if (touched) continue;
      hunks.push({ exp: E.slice(h.a0, h.a1).map((e) => e.t), got: segA.slice(h.b0, h.b1), aStart: a0 + h.b0, cStart: E[h.a0]?.c ?? null, expAtStart: E[h.a0]?.c === 0 });
    }
  }
  // Differences outside every mistake's window.
  const inGroup = (k) => groups.some((g) => k >= g.kL && k < g.kR);
  for (let k = 0; k < M.length - 1; k++) {
    if (inGroup(k)) continue;
    const c0 = M[k][0] + 1, c1 = M[k + 1][0], a0 = M[k][1] + 1, a1 = M[k + 1][1];
    if (c1 > c0 || a1 > a0) hunks.push({ exp: C.slice(c0, c1), got: A.slice(a0, a1), aStart: a0, cStart: c0, expAtStart: c0 === 0 });
  }

  // Classify: words moved elsewhere are a rewrite (review), not a mistake.
  const bag = (key) => { const m = new Map(); hunks.forEach((h) => h[key].forEach((t) => m.set(lc(t), (m.get(lc(t)) || 0) + 1))); return m; };
  const insBag = bag('got'), delBag = bag('exp');
  const extras = hunks.map((h) => {
    const [kind, sure] = classify(h, A, C, insBag, delBag);
    const clear = sure && !rewritten;
    return { expected: joinTokens(h.exp), got: joinTokens(h.got), kind, clear, aStart: h.aStart, aEnd: h.aStart + h.got.length };
  });

  // Whole-sentence checks: capital at the start, mark at the end (always: it is what is being taught).
  const pending = (cIndex) => spans.some((sp) => status[sp.index] !== 'fixed' && cIndex >= sp.cTok[0] && cIndex < sp.cTok[1]);
  const aFirst = firstLetter(text), cFirst = firstLetter(L.cor);
  if (aFirst && aFirst !== aFirst.toUpperCase() && cFirst && cFirst !== cFirst.toLowerCase() && !pending(0)
    && !extras.some((x) => x.clear && x.aStart === 0)) {
    extras.push({ expected: C[0] || '', got: A[0] || '', kind: 'capital-start', clear: true, aStart: 0, aEnd: 1 });
  }
  const cEnd = endMark(C);
  if (cEnd && !endMark(A) && !extras.some((x) => x.clear && x.aEnd === A.length)) {
    extras.push({ expected: cEnd, got: '', kind: 'end-mark', clear: true, aStart: A.length, aEnd: A.length });
  }

  // Stacked end marks ("open?.", "room.!") that the model sentence does not have.
  for (let i = 0; i + 1 < A.length; i++) {
    if (!END_MARKS.has(A[i]) || !END_MARKS.has(A[i + 1])) continue;
    if (C.some((t, j) => t === A[i] && C[j + 1] === A[i + 1])) continue;
    if (!extras.some((x) => x.clear && x.aStart <= i + 1 && x.aEnd > i)) {
      extras.push({ expected: A[i], got: A[i] + A[i + 1], kind: 'double-mark', clear: true, aStart: i, aEnd: i + 2 });
    }
  }

  const fixed = [], unfixed = [], unknown = [];
  status.forEach((s, i) => (s === 'fixed' ? fixed : s === 'unfixed' ? unfixed : unknown).push(i));
  // Same words and marks as the model sentence but different spacing ("Lopez,reads").
  if (!unfixed.length && !unknown.length && !extras.length && sameList(A, C)) {
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

/**
 * Is `choice` a fair Thinking Lab answer? Some mistakes fit two kinds (an error's optional altCategory,
 * e.g. "new" → "knew" is spelling or grammar). True if each error can be given one of its kinds so that the
 * kinds used are exactly {choice}, or (for 'more-than-one') at least two different kinds.
 */
export function labAccepts(item, choice) {
  const options = (item?.errors || []).map((e) => [...new Set([e?.category, e?.altCategory].filter(Boolean))]).filter((o) => o.length);
  if (!options.length) return false;
  if (choice !== 'more-than-one') return options.every((o) => o.includes(choice));
  // Two different kinds are possible when two errors can be given different kinds.
  return options.some((o, i) => o.some((x) => options.some((p, j) => j !== i && p.some((y) => y !== x))));
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
