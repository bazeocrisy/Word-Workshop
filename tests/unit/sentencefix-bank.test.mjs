// Structural and mechanical checks for the Sentence Fix content bank.
// Run: node --test tests/unit/sentencefix-bank.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const bank = JSON.parse(fs.readFileSync(new URL('../../data/sentence-fix/bank.json', import.meta.url), 'utf8'));
const items = bank.items;

const CATEGORIES = ['spelling', 'capitalization', 'punctuation', 'grammar'];
const SKILL_COUNTS = {
  capitalization: 15, 'ending-punctuation': 15, commas: 15, spelling: 25, 'verb-tense': 20,
  'subject-verb': 15, homophones: 15, 'possessives-contractions': 15, mixed: 15,
};
const CODES = {
  capitalization: 'CAP', 'ending-punctuation': 'END', commas: 'COM', spelling: 'SPL', 'verb-tense': 'TEN',
  'subject-verb': 'SVA', homophones: 'HOM', 'possessives-contractions': 'POS', mixed: 'MIX',
};
const DIFF_COUNTS = { easy: 40, medium: 65, hard: 45 };
const ERROR_RANGE = { easy: [1, 2], medium: [2, 3], hard: [3, 5] };
const WORD_RANGE = { easy: [7, 12], medium: [9, 16], hard: [12, 20] };
const CONTEXTS = ['school', 'science', 'nature', 'sports', 'community', 'history', 'family', 'everyday'];
// The Thinking Lab category each single skill must use (see docs/SENTENCE-FIX-CURRICULUM.md).
const SKILL_CATEGORY = {
  capitalization: 'capitalization', 'ending-punctuation': 'punctuation', commas: 'punctuation',
  'possessives-contractions': 'punctuation', spelling: 'spelling', homophones: 'spelling',
  'verb-tense': 'grammar', 'subject-verb': 'grammar',
};
const ENDS_WITH_MARK = /[.?!]"?$/;
const isLetter = (ch) => ch !== undefined && /[A-Za-z0-9]/.test(ch);
const words = (s) => s.trim().split(/\s+/).length;

/** Apply each error's wrong→right once, left to right, from a moving cursor. */
function applyErrors(item) {
  let s = item.incorrect;
  let cursor = 0;
  for (const e of item.errors) {
    const at = s.indexOf(e.wrong, cursor);
    if (at < 0) return { ok: false, why: `"${e.wrong}" not found after position ${cursor}` };
    // The match must be a whole word/phrase, not part of a longer word.
    if (isLetter(e.wrong[0]) && isLetter(s[at - 1])) return { ok: false, why: `"${e.wrong}" matched inside a word` };
    if (isLetter(e.wrong.at(-1)) && isLetter(s[at + e.wrong.length])) return { ok: false, why: `"${e.wrong}" matched inside a word` };
    s = s.slice(0, at) + e.right + s.slice(at + e.wrong.length);
    cursor = at + e.right.length;
  }
  return { ok: true, result: s };
}

test('bank header', () => {
  assert.equal(bank.version, 1);
  assert.deepEqual(bank.categories, CATEGORIES);
  assert.ok(Array.isArray(items));
});

test('exactly 150 items with well-formed, unique ids', () => {
  assert.equal(items.length, 150);
  const ids = new Set();
  for (const it of items) {
    assert.match(it.id, /^SF-(CAP|END|COM|SPL|TEN|SVA|HOM|POS|MIX)-\d{3}$/, it.id);
    assert.equal(it.id.split('-')[1], CODES[it.skill], `${it.id} code matches skill`);
    assert.ok(!ids.has(it.id), `duplicate id ${it.id}`);
    ids.add(it.id);
  }
});

test('skill and difficulty counts', () => {
  const bySkill = {}, byDiff = {};
  for (const it of items) {
    bySkill[it.skill] = (bySkill[it.skill] || 0) + 1;
    byDiff[it.difficulty] = (byDiff[it.difficulty] || 0) + 1;
  }
  assert.deepEqual(bySkill, SKILL_COUNTS);
  assert.deepEqual(byDiff, DIFF_COUNTS);
});

test('required fields, hints, contexts, tags', () => {
  for (const it of items) {
    for (const k of ['id', 'skill', 'difficulty', 'context', 'incorrect', 'correct']) {
      assert.equal(typeof it[k], 'string', `${it.id} ${k}`);
      assert.ok(it[k].length > 0, `${it.id} ${k} non-empty`);
    }
    assert.ok(CONTEXTS.includes(it.context), `${it.id} context ${it.context}`);
    assert.ok(Array.isArray(it.accepted), `${it.id} accepted`);
    assert.ok(Array.isArray(it.errors) && it.errors.length >= 1, `${it.id} errors`);
    assert.ok(Array.isArray(it.hints) && it.hints.length === 3, `${it.id} has 3 hints`);
    for (const h of it.hints) assert.ok(typeof h === 'string' && h.trim().length > 0, `${it.id} hint non-empty`);
    assert.equal(new Set(it.hints).size, 3, `${it.id} hints differ`);
    for (const h of it.hints) assert.notEqual(h.trim(), it.correct, `${it.id} hint must not give away the answer`);
    assert.ok(Array.isArray(it.tags) && it.tags.length >= 1, `${it.id} tags`);
    for (const t of it.tags) assert.ok(t in SKILL_CATEGORY, `${it.id} tag ${t} is a skill name`);
    assert.equal(new Set(it.tags).size, it.tags.length, `${it.id} tags unique`);
    if (it.skill === 'mixed') assert.ok(it.tags.length >= 2, `${it.id} mixed lists 2+ skills`);
    else assert.deepEqual(it.tags, [it.skill], `${it.id} single-skill tag`);
  }
});

test('error counts match difficulty', () => {
  for (const it of items) {
    const [lo, hi] = ERROR_RANGE[it.difficulty];
    assert.ok(it.errors.length >= lo && it.errors.length <= hi, `${it.id} (${it.difficulty}) has ${it.errors.length} errors`);
  }
});

test('error spans: wrong in incorrect, right in correct, valid category, short explanation', () => {
  for (const it of items) {
    for (const e of it.errors) {
      assert.ok(CATEGORIES.includes(e.category), `${it.id} category ${e.category}`);
      assert.ok(e.wrong.length > 0 && e.right.length > 0 && e.wrong !== e.right, `${it.id} wrong/right`);
      assert.ok(it.incorrect.includes(e.wrong), `${it.id} wrong "${e.wrong}" in incorrect`);
      assert.ok(it.correct.includes(e.right), `${it.id} right "${e.right}" in correct`);
      assert.equal(typeof e.explanation, 'string', `${it.id} explanation`);
      assert.ok(e.explanation.length > 0 && words(e.explanation) <= 20, `${it.id} explanation ≤ 20 words: ${e.explanation}`);
    }
  }
});

test('applying all errors to incorrect yields exactly correct', () => {
  for (const it of items) {
    const r = applyErrors(it);
    assert.ok(r.ok, `${it.id}: ${r.why}`);
    assert.equal(r.result, it.correct, it.id);
  }
});

test('sentence form: capitals, end marks, spacing, straight quotes', () => {
  for (const it of items) {
    assert.match(it.correct, /^"?[A-Z]/, `${it.id} correct starts with a capital`);
    assert.match(it.correct, ENDS_WITH_MARK, `${it.id} correct ends with . ? or !`);
    assert.notEqual(it.incorrect, it.correct, `${it.id} incorrect differs`);
    for (const s of [it.incorrect, it.correct, ...it.accepted]) {
      assert.equal(s, s.trim(), `${it.id} no outer spaces`);
      assert.ok(!/\s{2,}/.test(s), `${it.id} single spaces`);
      assert.ok(!/[‘’“”]/.test(s), `${it.id} straight quotes/apostrophes only`);
    }
    for (const a of it.accepted) {
      assert.match(a, ENDS_WITH_MARK, `${it.id} accepted ends with . ? or !`);
      assert.match(a, /^"?[A-Z]/, `${it.id} accepted starts with a capital`);
      assert.notEqual(a, it.correct, `${it.id} accepted differs from correct`);
      assert.notEqual(a, it.incorrect, `${it.id} accepted differs from incorrect`);
    }
    assert.equal(new Set(it.accepted).size, it.accepted.length, `${it.id} accepted unique`);
  }
});

test('no duplicate incorrect or correct texts', () => {
  const inc = new Set(), cor = new Set();
  for (const it of items) {
    assert.ok(!inc.has(it.incorrect), `duplicate incorrect: ${it.id}`);
    assert.ok(!cor.has(it.correct), `duplicate correct: ${it.id}`);
    inc.add(it.incorrect);
    cor.add(it.correct);
  }
});

test('single-skill items use only their own Thinking Lab category', () => {
  for (const it of items) {
    if (it.skill === 'mixed') continue;
    for (const e of it.errors) assert.equal(e.category, SKILL_CATEGORY[it.skill], `${it.id} "${e.wrong}"`);
  }
});

test('mixed items: errors span 2+ skills and every category is covered by a tag', () => {
  for (const it of items.filter((i) => i.skill === 'mixed')) {
    const tagCats = new Set(it.tags.map((t) => SKILL_CATEGORY[t]));
    for (const e of it.errors) assert.ok(tagCats.has(e.category), `${it.id} category ${e.category} covered by tags`);
  }
});

test('word counts near targets (warn only)', () => {
  const warnings = [];
  for (const it of items) {
    const [lo, hi] = WORD_RANGE[it.difficulty];
    const n = words(it.correct);
    if (n < lo || n > hi) warnings.push(`${it.id} ${it.difficulty} ${n} words`);
    assert.ok(n >= lo - 3 && n <= hi + 3, `${it.id} far outside word target (${n})`);
  }
  if (warnings.length) console.log(`word-count warnings (${warnings.length}):\n  ` + warnings.join('\n  '));
});
