// Pure lesson-model logic: no DOM, no storage. Shared by the app and the Node unit tests.

export const SCHEMA_VERSION = 1;

export function uid(prefix = 'id') {
  const rnd = (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
    : Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  return `${prefix}_${rnd}`;
}

export const nowIso = () => new Date().toISOString();

/**
 * Answer normalization (documented in docs/GRADING.md):
 * Unicode NFC, curly quotes/apostrophes → straight, trim leading/trailing whitespace,
 * collapse runs of internal whitespace to one space, lowercase. Nothing else: letters must match exactly.
 */
export function normalizeAnswer(s) {
  return String(s ?? '').normalize('NFC')
    .replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Looser key used only to detect duplicate words/definitions (never for grading). */
export function compareKey(s) {
  return normalizeAnswer(s).replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim();
}

export function isCorrectAnswer(given, expected) {
  const g = normalizeAnswer(given);
  return g !== '' && g === normalizeAnswer(expected);
}

// ── Items ────────────────────────────────────────────────────────────────────

export function newVocabItem({ word = '', definition = '', origin = 'typed', ocrConfidence = null, importedFlags = [], sentence = '', sentenceSource = null } = {}) {
  const def = String(definition ?? '');
  return {
    id: uid('v'), word: String(word ?? '').trim(),
    originalTranscription: def,        // first capture (typed / pasted / OCR / sample). Never changed afterwards.
    sourceDefinition: def,             // parent-verified teacher wording. Changed only via "correct transcription" (logged).
    parentDefinition: null,            // optional parent wording, shown labelled "Parent-edited".
    definitionLog: [],
    sentence: String(sentence ?? ''), sentenceSource: sentence ? (sentenceSource || 'parent') : null,
    image: null,                       // { ref, kind: 'upload' | 'sample', alt }
    importedFlags: importedFlags.map(String), ackKeys: [], reviewed: false,
    origin, ocrConfidence,
  };
}

export function newSpellingItem({ word = '', origin = 'typed', ocrConfidence = null, sentence = '', sentenceSource = null } = {}) {
  return {
    id: uid('s'), word: String(word ?? '').trim(), originalTranscription: String(word ?? ''),
    sentence: String(sentence ?? ''), sentenceSource: sentence ? (sentenceSource || 'parent') : null,
    groups: null,                      // { spelling: {key,label,reason}, sound: {key,label,reason}|null, source: 'auto'|'parent' }
    ackKeys: [], reviewed: false, origin, ocrConfidence,
  };
}

/** The definition students see: the parent's wording if set, else the verified teacher wording. */
export function displayDefinition(item) {
  const parent = item.parentDefinition != null && String(item.parentDefinition).trim() !== '';
  return parent ? { text: item.parentDefinition, kind: 'parent-edited' } : { text: item.sourceDefinition, kind: 'teacher' };
}

// ── Flags ────────────────────────────────────────────────────────────────────

const LOW_CONFIDENCE = 80;

/** Does `sentence` contain `word` exactly (whole word, case-insensitive)? Returns the match index or -1. */
export function findWord(sentence, word) {
  const w = String(word || '').trim();
  if (!w) return -1;
  const esc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`(^|[^\\p{L}])(${esc})(?![\\p{L}])`, 'iu').exec(String(sentence || ''));
  return m ? m.index + m[1].length : -1;
}

function countWord(sentence, word) {
  const w = String(word || '').trim();
  if (!w) return 0;
  const esc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (String(sentence || '').match(new RegExp(`(^|[^\\p{L}])${esc}(?![\\p{L}])`, 'giu')) || []).length;
}

/** Stem used to notice a definition that gives the answer away (e.g. "fortune" inside the definition of "fortunate"). */
function stemOf(word) {
  const w = compareKey(word).replace(/ /g, '');
  return w.length <= 5 ? w : w.slice(0, Math.max(5, Math.ceil(w.length * 0.6)));
}

/** Does the definition contain a recognisable part of the word (so it would give the answer away)? */
export function definitionHintsWord(word, definition) {
  const w = String(word || '').trim();
  return !!w && !!String(definition || '').trim() && compareKey(definition).includes(stemOf(w));
}

/** Heuristic: definition phrased like a verb ("To …") for a word that looks like an adjective/participle. */
function looksLikePosMismatch(word, definition) {
  const w = compareKey(word), d = compareKey(definition);
  if (!/^to /.test(d)) return false;
  return /(ing|ed|ful|ous|ive|able|ible|y|ant|ent|al|ic)$/.test(w);
}

/**
 * All warnings for one vocabulary item (in context of its week). Each flag:
 * { key, code, level: 'warning' | 'info', message, acknowledged }
 * Warnings block approval until fixed or acknowledged; info never blocks.
 */
export function vocabFlags(item, week) {
  const flags = [];
  const def = displayDefinition(item).text;
  const W = compareKey(item.word), D = W + '|' + compareKey(def), S = W + '|' + compareKey(item.sentence);
  const add = (code, level, message, fp = D) => flags.push({ code, level, message, key: `${code}|${fp}`, acknowledged: false });
  if (!item.word.trim()) add('missing-word', 'warning', 'The word is missing.');
  if (!String(def).trim()) add('missing-definition', 'warning', 'The definition is missing.');
  for (const f of item.importedFlags || []) add('imported:' + compareKey(f).slice(0, 40), 'warning', f);
  if (item.ocrConfidence != null && item.ocrConfidence < LOW_CONFIDENCE) add('ocr-low-confidence', 'warning', `The photo reader was unsure (${Math.round(item.ocrConfidence)}% confident). Compare with the photo.`);
  const others = (week?.vocab || []).filter((x) => x.id !== item.id);
  if (item.word.trim() && others.some((x) => compareKey(x.word) === compareKey(item.word))) add('duplicate-word', 'warning', 'This word appears more than once.');
  if (String(def).trim() && others.some((x) => compareKey(displayDefinition(x).text) === compareKey(def))) add('duplicate-definition', 'warning', 'Another word has the same definition, so quiz questions could have two right answers.');
  if (item.word.trim() && String(def).trim() && compareKey(def).includes(stemOf(item.word))) add('definition-contains-word', 'info', 'The definition contains part of the word, which can hint the answer.');
  if (looksLikePosMismatch(item.word, def)) add('possible-mismatch', 'warning', 'Possible mismatch: the definition reads like an action ("To …") but the word looks like a describing word. Check it against the teacher\'s sheet. Do not change the teacher\'s wording unless the sheet differs.');
  if (!item.sentence.trim()) add('missing-sentence', 'warning', 'No example sentence. The fill-in-the-blank question will skip this word.', S);
  else if (countWord(item.sentence, item.word) !== 1) add('sentence-missing-word', 'warning', `The example sentence should contain the exact word "${item.word}" once, or fill-in-the-blank will skip it.`, S);
  if (item.sentenceSource === 'generated') add('generated-sentence', 'info', 'Example sentence was written by the app\'s sample generator, not the teacher. Check it fits.', S);
  return flags.map((f) => ({ ...f, acknowledged: (item.ackKeys || []).includes(f.key) }));
}

export function spellingFlags(item, week) {
  const flags = [];
  const W = compareKey(item.word), S = W + '|' + compareKey(item.sentence);
  const add = (code, level, message, fp = W) => flags.push({ code, level, message, key: `${code}|${fp}`, acknowledged: false });
  if (!item.word.trim()) add('missing-word', 'warning', 'The word is missing.');
  else if (!/^[\p{L}][\p{L}'’-]*( [\p{L}'’-]+)*$/u.test(item.word.trim())) add('not-a-word', 'warning', 'Contains numbers or symbols. Check the spelling against the list.');
  if (item.ocrConfidence != null && item.ocrConfidence < LOW_CONFIDENCE) add('ocr-low-confidence', 'warning', `The photo reader was unsure (${Math.round(item.ocrConfidence)}% confident). Compare with the photo.`);
  const others = (week?.spelling || []).filter((x) => x.id !== item.id);
  if (item.word.trim() && others.some((x) => compareKey(x.word) === compareKey(item.word))) add('duplicate-word', 'warning', 'This word appears more than once.');
  if (!item.sentence.trim()) add('missing-sentence', 'warning', 'No example sentence. The test will say the word only.', S);
  else if (countWord(item.sentence, item.word) !== 1) add('sentence-missing-word', 'warning', `The sentence should contain the exact word "${item.word}" once so it can be hidden during the test.`, S);
  if (item.groups && item.groups.spelling && item.groups.spelling.key === 'check') add('pattern-unsure', 'info', 'The app could not work out the spelling pattern. Choose one or leave it under "Other".');
  if (item.sentenceSource === 'generated') add('generated-sentence', 'info', 'Example sentence was written by the app\'s sample generator, not the teacher. Check it fits.', S);
  return flags.map((f) => ({ ...f, acknowledged: (item.ackKeys || []).includes(f.key) }));
}

// ── Week status and approval ─────────────────────────────────────────────────

export function newWeek({ studentId, startDate, endDate, title = '', focus = '' }) {
  return {
    id: uid('w'), studentId, startDate, endDate, title, focus,
    vocab: [], spelling: [], settings: { spellingTestOrder: 'random' },
    sources: [], revision: 0, approvedRevision: null, approvedVersion: 0, approvedAt: null,
    editLog: [], createdAt: nowIso(), updatedAt: nowIso(),
  };
}

export const STATUS_LABELS = {
  draft: 'Draft', 'pending-review': 'Needs review', approved: 'Approved', 'pending-changes': 'Changes pending',
};

/**
 * Fingerprint of what students would see (words, definitions, sentences, pictures, groups, settings, dates).
 * Review ticks and acknowledgements are not content, so re-ticking a box does not make a week "Changes pending".
 */
export function contentKey(week) {
  const s = buildSnapshot(week, 0, '');
  const text = JSON.stringify([s.title, s.focus, s.startDate, s.endDate, s.settings, s.vocab, s.spelling]);
  let h1 = 0x811c9dc5, h2 = 5381;
  for (let i = 0; i < text.length; i++) { const c = text.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619); h2 = (Math.imul(h2, 33) + c) | 0; }
  return (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16) + ':' + text.length;
}

/** draft: empty · pending-review: has content, never approved · approved · pending-changes: content changed since approval. */
export function weekStatus(week) {
  const has = (week.vocab?.length || 0) + (week.spelling?.length || 0) > 0;
  if (!week.approvedVersion) return has ? 'pending-review' : 'draft';
  if (week.approvedContentKey) return contentKey(week) === week.approvedContentKey ? 'approved' : 'pending-changes';
  return week.revision === week.approvedRevision ? 'approved' : 'pending-changes';
}

export function approvalBlockers(week) {
  const out = [];
  if (!(week.vocab.length + week.spelling.length)) out.push('Add at least one spelling or vocabulary word.');
  const check = (items, flagFn, label) => items.forEach((it, i) => {
    const name = it.word || `${label} #${i + 1}`;
    if (!it.reviewed) out.push(`${label} "${name}" has not been marked as checked.`);
    for (const f of flagFn(it, week)) if (f.level === 'warning' && !f.acknowledged) out.push(`${label} "${name}": ${f.message}`);
  });
  check(week.vocab, vocabFlags, 'Vocabulary');
  check(week.spelling, spellingFlags, 'Spelling');
  return out;
}

/** Freeze the approved lesson. Students only ever read snapshots. */
export function buildSnapshot(week, version, approvedAt = nowIso()) {
  return {
    id: `${week.id}@${version}`, weekId: week.id, studentId: week.studentId, version, approvedAt, sourceRevision: week.revision,
    title: week.title, focus: week.focus, startDate: week.startDate, endDate: week.endDate,
    settings: { ...week.settings },
    vocab: week.vocab.map((it) => {
      const d = displayDefinition(it);
      return {
        id: it.id, word: it.word.trim(), definition: d.text, definitionKind: d.kind, teacherDefinition: it.sourceDefinition,
        sentence: it.sentence.trim(), sentenceSource: it.sentenceSource, image: it.image ? { ...it.image } : null,
      };
    }),
    spelling: week.spelling.map((it) => ({
      id: it.id, word: it.word.trim(), sentence: it.sentence.trim(), sentenceSource: it.sentenceSource,
      groups: it.groups ? JSON.parse(JSON.stringify(it.groups)) : null,
    })),
  };
}

/** Integrity rule: every teacher-kind definition in a snapshot is exactly the parent-verified teacher wording. */
export function snapshotIntegrityErrors(snap) {
  const errs = [];
  for (const v of snap.vocab || []) {
    if (!v || typeof v !== 'object') { errs.push('A vocabulary entry is malformed.'); continue; }
    if (v.definitionKind === 'teacher' && v.definition !== v.teacherDefinition) errs.push(`"${v.word}": definition differs from the teacher's wording but is not marked parent-edited.`);
    if (!['teacher', 'parent-edited'].includes(v.definitionKind)) errs.push(`"${v.word}": unknown definition kind.`);
  }
  return errs;
}

/**
 * Working-copy integrity: the verified teacher wording may differ from the original capture only through a
 * logged "transcription corrected" entry whose final value is the current wording.
 */
export function itemIntegrityErrors(week) {
  const errs = [];
  for (const it of week.vocab || []) {
    if (it.sourceDefinition === it.originalTranscription) continue;
    const log = (it.definitionLog || []).filter((e) => e.field === 'sourceDefinition');
    if (!log.length || log[log.length - 1].to !== it.sourceDefinition) errs.push(`"${it.word}": the teacher's definition was changed without a recorded correction.`);
  }
  return errs;
}

export function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  if (!y) return String(iso);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function weekLabel(week) {
  const range = week.startDate ? `${formatDate(week.startDate)}${week.endDate ? ' – ' + formatDate(week.endDate) : ''}` : 'Undated week';
  return week.title ? `${week.title} (${range})` : `Week of ${range}`;
}

/** Monday..Friday of the week containing `date` (local). */
export function schoolWeekOf(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const monday = new Date(d); monday.setDate(d.getDate() + (day === 0 ? 1 : day === 6 ? 2 : 1 - day));
  const friday = new Date(monday); friday.setDate(monday.getDate() + 4);
  const iso = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  return { startDate: iso(monday), endDate: iso(friday) };
}

/** Small seeded PRNG so quizzes can be reproduced from the seed saved with an attempt. */
export function rng(seed) {
  let a = (seed >>> 0) || 0x9e3779b9;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function shuffle(arr, rand = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export const newSeed = () => Math.floor(Math.random() * 2 ** 31);
