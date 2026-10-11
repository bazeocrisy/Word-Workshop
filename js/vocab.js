// Vocabulary question generation and grading (pure; unit-tested in Node).
// Questions use ONLY the approved snapshot. Rules that keep questions fair:
//  • distractors never share the target's (normalised) definition or word, and never repeat each other;
//  • fill-in-the-blank needs a sentence containing the exact word once, and drops distractor words that
//    already appear in that sentence;
//  • if two approved words share a definition, either word is accepted where that definition is the prompt;
//  • a question that cannot be made fair is skipped and reported, never graded.
import { compareKey, isCorrectAnswer, rng, shuffle, findWord } from './model.js';

export const VOCAB_ACTIVITIES = {
  'def-mc': { label: 'Choose the meaning', short: 'Meaning', desc: 'See a word, pick its definition.' },
  'word-mc': { label: 'Choose the word', short: 'Word', desc: 'Read a definition, pick the word.' },
  blank: { label: 'Fill in the blank', short: 'Blank', desc: 'Pick the word that completes the sentence.' },
  match: { label: 'Match words and meanings', short: 'Match', desc: 'Match each word to its definition.' },
  write: { label: 'Write the word', short: 'Write', desc: 'Read a definition, type the word.' },
  mixed: { label: 'Mixed', short: 'Mixed', desc: 'A bit of everything, one question per word.' },
};

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const MAX_OPTIONS = 4;
const MATCH_SIZE = 5;

function blankSentence(sentence, word) {
  const i = findWord(sentence, word);
  if (i < 0) return null;
  return sentence.slice(0, i) + '_____' + sentence.slice(i + word.length);
}

const countIn = (sentence, word) => {
  const esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (String(sentence).match(new RegExp(`(^|[^\\p{L}])${esc}(?![\\p{L}])`, 'giu')) || []).length;
};

/** Pick up to n distractor items: different word, different definition, no two with the same definition. */
function distractors(target, items, n, rand, extraOk = () => true) {
  const tDef = compareKey(target.definition), tWord = compareKey(target.word);
  const seenDefs = new Set([tDef]), seenWords = new Set([tWord]);
  const out = [];
  for (const it of shuffle(items, rand)) {
    if (out.length >= n) break;
    const d = compareKey(it.definition), w = compareKey(it.word);
    if (it.id === target.id || seenDefs.has(d) || seenWords.has(w) || !extraOk(it)) continue;
    seenDefs.add(d); seenWords.add(w); out.push(it);
  }
  return out;
}

function mcOptions(correct, wrong, rand, textOf) {
  const opts = shuffle([correct, ...wrong], rand).map((it, i) => ({ key: LETTERS[i], text: textOf(it), itemId: it.id }));
  return { options: opts, answerKey: opts.find((o) => o.itemId === correct.id).key };
}

/** Words whose definition is identical to this one (normally just the item itself). */
const sameDefinition = (item, items) => items.filter((x) => compareKey(x.definition) === compareKey(item.definition)).map((x) => x.word);

export function makeQuestion(type, item, items, rand) {
  const base = { type, itemId: item.id, word: item.word, definition: item.definition, sentence: item.sentence || '' };
  if (type === 'def-mc') {
    const wrong = distractors(item, items, MAX_OPTIONS - 1, rand);
    if (!wrong.length) return { skip: 'Needs at least two words with different definitions.' };
    return { ...base, prompt: item.word, ...mcOptions(item, wrong, rand, (x) => x.definition), correctText: item.definition };
  }
  if (type === 'word-mc') {
    const wrong = distractors(item, items, MAX_OPTIONS - 1, rand);
    if (!wrong.length) return { skip: 'Needs at least two words with different definitions.' };
    return { ...base, prompt: item.definition, definitionKind: item.definitionKind, ...mcOptions(item, wrong, rand, (x) => x.word), correctText: item.word };
  }
  if (type === 'blank') {
    if (!item.sentence) return { skip: 'No example sentence.' };
    if (countIn(item.sentence, item.word) !== 1) return { skip: 'The example sentence does not contain the exact word once.' };
    const wrong = distractors(item, items, MAX_OPTIONS - 1, rand, (x) => countIn(item.sentence, x.word) === 0);
    if (!wrong.length) return { skip: 'Not enough other words to choose from.' };
    return { ...base, prompt: blankSentence(item.sentence, item.word), ...mcOptions(item, wrong, rand, (x) => x.word), correctText: item.word };
  }
  if (type === 'write') {
    return { ...base, prompt: item.definition, definitionKind: item.definitionKind, accepted: sameDefinition(item, items), correctText: item.word };
  }
  throw new Error('Unknown question type ' + type);
}

/** Matching rounds of up to 5 pairs. Options are the de-duplicated definitions of the round. */
export function makeMatchRounds(items, rand) {
  const order = shuffle(items, rand);
  const rounds = [];
  for (let i = 0; i < order.length; i += MATCH_SIZE) {
    let chunk = order.slice(i, i + MATCH_SIZE);
    if (chunk.length === 1 && rounds.length) { rounds[rounds.length - 1].pairs.push(chunk[0]); continue; } // never a one-pair round
    rounds.push({ pairs: chunk });
  }
  return rounds.map((r, n) => {
    const defs = [];
    const seen = new Set();
    for (const it of shuffle(r.pairs, rand)) { const k = compareKey(it.definition); if (!seen.has(k)) { seen.add(k); defs.push(it.definition); } }
    return {
      type: 'match', round: n + 1, rounds: rounds.length,
      pairs: r.pairs.map((it) => ({ itemId: it.id, word: it.word, correctText: it.definition })),
      options: defs.map((text, i) => ({ key: String(i + 1), text })),
    };
  });
}

/**
 * Build an activity. `items` are snapshot vocab entries; `only` optionally restricts to item ids (missed-word practice).
 * Returns { questions, skipped: [{ word, type, reason }] }.
 */
export function buildActivity(activity, snapshotVocab, { seed = 1, only = null } = {}) {
  const rand = rng(seed);
  const all = snapshotVocab.filter((v) => v.word && v.definition);
  const targets = only ? all.filter((v) => only.includes(v.id)) : all;
  const skipped = [];
  if (activity === 'match') {
    if (targets.length < 2) return { questions: [], skipped: targets.map((t) => ({ word: t.word, type: 'match', reason: 'Matching needs at least two words.' })) };
    return { questions: makeMatchRounds(targets, rand), skipped };
  }
  const questions = [];
  const kinds = ['def-mc', 'word-mc', 'blank', 'write'];
  for (const item of shuffle(targets, rand)) {
    let order = activity === 'mixed' ? shuffle(kinds, rand) : [activity];
    let q = null; let reason = '';
    for (const k of order) {
      const r = makeQuestion(k, item, all, rand);
      if (!r.skip) { q = r; break; }
      reason = r.skip;
    }
    if (q) questions.push(q); else skipped.push({ word: item.word, type: activity, reason });
  }
  return { questions, skipped };
}

/**
 * Grade one question. `response`: option key (MC), text (write), or { itemId: optionKey } (match).
 * Returns { points, possible, results: [{ itemId, word, given, correct, isCorrect }] }.
 */
export function grade(q, response) {
  if (q.type === 'match') {
    const results = q.pairs.map((p) => {
      const key = response && response[p.itemId];
      const opt = q.options.find((o) => o.key === key);
      const isCorrect = !!opt && compareKey(opt.text) === compareKey(p.correctText);
      return { itemId: p.itemId, word: p.word, given: opt ? opt.text : '', correct: p.correctText, isCorrect };
    });
    return { points: results.filter((r) => r.isCorrect).length, possible: results.length, results };
  }
  let given = '', isCorrect = false;
  if (q.type === 'write') {
    given = String(response ?? '');
    isCorrect = (q.accepted || [q.word]).some((w) => isCorrectAnswer(given, w));
  } else {
    const opt = q.options.find((o) => o.key === response);
    given = opt ? opt.text : '';
    isCorrect = !!opt && response === q.answerKey;
  }
  return { points: isCorrect ? 1 : 0, possible: 1, results: [{ itemId: q.itemId, word: q.word, given, correct: q.correctText, isCorrect }] };
}

export const possiblePoints = (questions) => questions.reduce((n, q) => n + (q.type === 'match' ? q.pairs.length : 1), 0);
