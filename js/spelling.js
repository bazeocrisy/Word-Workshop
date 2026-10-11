// Spelling-pattern suggestions for -ed words. Two separate ideas, never mixed:
//   1. spelling change  — how the letters change when -ed is added (step → stepped)
//   2. ending sound     — how the -ed is pronounced (/t/, /d/ or /ɪd/)
// These are suggestions only; the parent confirms or corrects them before approval.

export const SPELLING_GROUPS = {
  'add-ed': { label: 'Just add -ed', explain: 'Add -ed to the base word with no other change.' },
  double: { label: 'Double the last letter, then add -ed', explain: 'Short vowel + one consonant at the end: double the consonant before adding -ed.' },
  'drop-e': { label: 'Ends in e: just add -d', explain: 'The base word already ends in e, so only -d is added.' },
  'y-to-i': { label: 'Change y to i, then add -ed', explain: 'Consonant + y at the end: change y to i before adding -ed.' },
  check: { label: 'Check me', explain: 'The app could not tell which rule applies.' },
  other: { label: 'Other words', explain: 'No automatic pattern.' },
};

export const SOUND_GROUPS = {
  t: { label: '-ed sounds like /t/', explain: 'After a quiet (voiceless) sound like p, k, s, sh, ch, f or x, -ed sounds like t.' },
  d: { label: '-ed sounds like /d/', explain: 'After a voiced sound (like l, m, n, r, b, g, v, z or a vowel), -ed sounds like d.' },
  id: { label: '-ed sounds like /id/ (extra syllable)', explain: 'After t or d, -ed adds a whole syllable: land-ed.' },
};

// Base words that really end in a double letter (so -ed is "just add").
const DOUBLE_BASES = new Set(['add', 'odd', 'ebb', 'err', 'purr', 'egg', 'inn', 'butt', 'putt', 'buzz', 'fizz', 'fuzz', 'jazz', 'whizz']);
const VOWEL = /[aeiou]/;

function group(key, base, extra, stem = null) {
  return { key, label: SPELLING_GROUPS[key].label, reason: extra || SPELLING_GROUPS[key].explain, base, stem: stem || base };
}

const vowelGroups = (s) => (s.match(/[aeiouy]+/g) || []).length;
// Unstressed endings that take plain -ed (open → opened, offer → offered, travel → traveled).
const PLAIN_ENDINGS = /(en|er|on|el|om|um|ow)$/;
// Common words whose base ends in silent e but whose letters look plain (create → created).
const SILENT_E_BASES = new Set(['create', 'delete', 'complete', 'locate', 'donate', 'rotate', 'relate', 'translate', 'debate', 'operate', 'celebrate', 'decorate', 'educate', 'separate', 'update', 'invite', 'decide', 'provide', 'divide', 'explode', 'escape', 'ignore', 'explore', 'adore', 'compare', 'prepare', 'declare', 'inhale', 'exhale', 'change', 'arrange', 'exchange', 'range', 'surprise', 'excite', 'erase', 'admire', 'promise', 'practice', 'continue', 'behave', 'arrive', 'describe', 'imagine', 'examine', 'determine']);

/** Work out the base word and spelling-change rule for an -ed word. */
export function spellingChange(word) {
  const w = String(word || '').trim().toLowerCase();
  if (!/^[a-z]+$/.test(w) || !w.endsWith('ed') || w.length < 4) return group('other', null);
  const stem = w.slice(0, -2);
  // cried → cry (consonant + ied). Short words like "tied"/"died" are ambiguous (tie/die), so ask.
  if (w.endsWith('ied')) {
    if (w.length > 4 && !VOWEL.test(w.at(-4))) { const base = w.slice(0, -3) + 'y'; return group('y-to-i', base, `${base} → ${w}`); }
    return group('check', null, null, w.slice(0, -2));
  }
  // shed, sled: no vowel left once -ed is removed, so not an -ed word.
  if (!/[aeiouy]/.test(stem)) return group('other', null);
  // freed (free + d) vs speed / succeed (not -ed words at all): can't tell from letters.
  if (w.endsWith('eed')) return group('check', null, null, stem);
  if (SILENT_E_BASES.has(stem + 'e')) { const base = stem + 'e'; return group('drop-e', base, `${base} → ${w}`); }
  const last = stem.at(-1), prev = stem.at(-2);
  if (stem.length >= 3 && last === prev && !VOWEL.test(last)) {
    // quizzed: quiz is short vowel + z, so the z doubles (buzz/fizz already end in zz).
    if (last === 'z' && !DOUBLE_BASES.has(stem) && /^(qu|[^aeiou])*[aeiou]zz$/.test(stem) && vowelGroups(stem.replace(/^qu/, 'q')) === 1) {
      const base = stem.slice(0, -1); return group('double', base, `${base} → ${w}: short vowel and one consonant, so double the z.`);
    }
    // controlled vs installed: a longer word ending in ll could be either — ask.
    if (last === 'l' && vowelGroups(stem) >= 2) return group('check', null, null, stem);
    if ('lsfz'.includes(last) || DOUBLE_BASES.has(stem)) return group('add-ed', stem, `${stem} + ed → ${w}`);
    const base = stem.slice(0, -1);
    return group('double', base, `${base} → ${w}: short vowel and one consonant, so double the ${last}.`);
  }
  // One-syllable consonant-vowel-consonant stem that did NOT double ⇒ the base ends in silent e (hope → hoped).
  if (/^[^aeiouy]*[aeiou][^aeiouwxy]$/.test(stem)) { const base = stem + 'e'; return group('drop-e', base, `${base} → ${w}`); }
  // English words don't end in these letter clusters, so the base must end in e: danced, judged, charged, solved, bubbled.
  if (/(nc|rc|dg|rg|v|[bpgktdfz]l)$/.test(stem)) { const base = stem + 'e'; return group('drop-e', base, `${base} → ${w}`); }
  // replaced, noticed, rescued, glued, sneezed: English words rarely end in a vowel + c, in u, or in a vowel + z.
  if (/([aeiou]c|u|[aeiou]z)$/.test(stem)) { const base = stem + 'e'; return group('drop-e', base, `${base} → ${w}`); }
  // Longer words ending vowel + consonant: decided/invited (silent e) vs opened/visited (plain). Only the
  // common unstressed endings are safe to call; everything else is for the parent to decide.
  if (vowelGroups(stem) >= 2 && /[aeiou][^aeiouwxy]$/.test(stem) && !/[aeiou]{2}[^aeiouwxy]$/.test(stem)) {
    if (PLAIN_ENDINGS.test(stem) && !/(it|et)$/.test(stem)) return group('add-ed', stem, `${stem} + ed → ${w}`);
    return group('check', null, null, stem);
  }
  // sensed / lapsed / changed / banged: could end in silent e or not — let the parent decide.
  if (/(rs|ls|ns|ps|ng)$/.test(stem)) return group('check', null, null, stem);
  return group('add-ed', stem, `${stem} + ed → ${w}`);
}

/** Pronunciation of -ed, from the base word's final sound. null = can't tell from the letters. */
export function endingSound(word, change = spellingChange(word)) {
  if (change.key === 'other') return null;
  // When the spelling rule is unclear, the sound can usually still be told from the stem (decid → /id/).
  const base = change.base || change.stem;
  if (!base) return null;
  const s = (key, why) => ({ key, label: SOUND_GROUPS[key].label, reason: why || SOUND_GROUPS[key].explain });
  if (/[td]e?$/.test(base)) return s('id', `${base} ends in ${base.replace(/e$/, '').at(-1)}, so -ed adds a syllable.`);
  if (/(gh|th|[^s]se|^se|[^zs]s|c)$/.test(base)) return null; // laugh, bathe/bath, raise/chase, bus: depends on the word
  if (/(ss|sh|tch|ch|ck|ke|k|pe|p|ff|fe|f|x|ce)$/.test(base)) return s('t', `${base} ends with a quiet sound, so -ed sounds like t.`);
  return s('d', `${base} ends with a voiced sound, so -ed sounds like d.`);
}

/** Suggested groups for a spelling word (used when the parent adds or imports words). */
export function suggestGroups(word) {
  const sp = spellingChange(word);
  const snd = endingSound(word, sp);
  return {
    spelling: { key: sp.key, label: sp.label, reason: sp.reason },
    sound: snd,
    source: 'auto',
  };
}

/** Group spelling items for study: [{ key, label, reason, items }] in first-appearance order. */
export function groupItems(items, kind = 'spelling') {
  const map = new Map();
  for (const it of items) {
    const g = it.groups && it.groups[kind];
    const key = g ? g.key : 'none';
    if (!map.has(key)) map.set(key, { key, label: g ? g.label : (kind === 'sound' ? 'Sound not grouped' : 'Other words'), explain: g ? (SPELLING_GROUPS[g.key] || SOUND_GROUPS[g.key] || {}).explain || '' : '', items: [] });
    map.get(key).items.push(it);
  }
  return [...map.values()];
}
