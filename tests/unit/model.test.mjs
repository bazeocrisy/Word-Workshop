import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  normalizeAnswer, isCorrectAnswer, newVocabItem, newSpellingItem, newWeek, vocabFlags, spellingFlags,
  approvalBlockers, buildSnapshot, snapshotIntegrityErrors, weekStatus, displayDefinition, findWord, rng, shuffle, schoolWeekOf,
} from '../../js/model.js';
import { validateBackup, parseBackupText } from '../../js/backupFormat.js';

const vocabSample = JSON.parse(fs.readFileSync(new URL('../../sample-data/vocabulary.json', import.meta.url), 'utf8'));

test('normalization: trims, ignores case, keeps internal letters', () => {
  assert.equal(normalizeAnswer('  Rushed '), 'rushed');
  assert.equal(normalizeAnswer('in  spite\tof'), 'in spite of');
  assert.equal(normalizeAnswer('don’t'), "don't");
  assert.ok(isCorrectAnswer(' STEPPED ', 'stepped'));
  assert.ok(!isCorrectAnswer('steped', 'stepped'));
  assert.ok(!isCorrectAnswer('step ped', 'stepped'));
  assert.ok(!isCorrectAnswer('', 'stepped'));
  assert.ok(!isCorrectAnswer('   ', ''), 'blank never counts as correct');
});

test('findWord matches whole words only', () => {
  assert.ok(findWord('The produce was fresh.', 'produce') >= 0);
  assert.equal(findWord('They produced a play.', 'produce'), -1);
  assert.ok(findWord('Produce is on sale.', 'produce') === 0);
});

function sampleWeek() {
  const w = newWeek({ studentId: 'st1', startDate: '2026-10-12', endDate: '2026-10-16' });
  w.vocab = vocabSample.items.map((it) => newVocabItem({ word: it.word, definition: it.sourceDefinition, origin: 'sample', importedFlags: it.reviewFlags }));
  return w;
}

test('sample data loads as needs-review, flags preserved, nothing approved', () => {
  const w = sampleWeek();
  assert.equal(weekStatus(w), 'pending-review');
  const trust = w.vocab.find((v) => v.word === 'Trustworthy');
  const flags = vocabFlags(trust, w).filter((f) => f.code.startsWith('imported:'));
  assert.equal(flags.length, 1);
  assert.match(flags[0].message, /do not auto-correct/);
  const blockers = approvalBlockers(w);
  assert.ok(blockers.some((b) => /Trustworthy/.test(b)));
  assert.ok(blockers.some((b) => /not been marked as checked/.test(b)));
});

test('heuristic flags: Irritating and Distracted read like verb definitions; Fortunate hints its answer', () => {
  const w = sampleWeek();
  const codes = (word) => vocabFlags(w.vocab.find((v) => v.word === word), w).map((f) => f.code);
  assert.ok(codes('Irritating').includes('possible-mismatch'));
  assert.ok(codes('Distracted').includes('possible-mismatch'));
  assert.ok(codes('Fortunate').includes('definition-contains-word'));
  assert.ok(!codes('Produce').includes('possible-mismatch'));
});

test('approval requires review + acknowledgement; definitions are never changed by approval', () => {
  const w = sampleWeek();
  for (const v of w.vocab) {
    v.sentence = `Here is a sentence about ${v.word.toLowerCase()} today.`;
    v.reviewed = true;
    v.ackKeys = vocabFlags(v, w).filter((f) => f.level === 'warning').map((f) => f.key);
  }
  assert.deepEqual(approvalBlockers(w), []);
  const snap = buildSnapshot(w, 1);
  assert.deepEqual(snapshotIntegrityErrors(snap), []);
  snap.vocab.forEach((sv, i) => {
    assert.equal(sv.definition, vocabSample.items[i].sourceDefinition, 'exact teacher wording');
    assert.equal(sv.definitionKind, 'teacher');
  });
});

test('editing a definition re-raises acknowledged mismatch warnings; parent wording is labelled', () => {
  const w = sampleWeek();
  const d = w.vocab.find((v) => v.word === 'Distracted');
  d.ackKeys = vocabFlags(d, w).map((f) => f.key);
  assert.ok(vocabFlags(d, w).every((f) => f.acknowledged));
  d.parentDefinition = 'Not paying attention because something else took your focus';
  assert.equal(displayDefinition(d).kind, 'parent-edited');
  assert.equal(d.sourceDefinition, 'To prevent something from continuing as usual', 'teacher wording kept');
  assert.ok(vocabFlags(d, w).some((f) => f.code.startsWith('imported:') && !f.acknowledged));
});

test('integrity check catches a teacher-labelled definition that was altered', () => {
  const snap = { vocab: [{ word: 'Produce', definition: 'Vegetables', teacherDefinition: 'Fresh fruits and vegetables', definitionKind: 'teacher' }] };
  assert.equal(snapshotIntegrityErrors(snap).length, 1);
});

test('week status lifecycle', () => {
  const w = newWeek({ studentId: 's', startDate: '2026-10-12' });
  assert.equal(weekStatus(w), 'draft');
  w.spelling.push(newSpellingItem({ word: 'rushed' }));
  w.revision = 1;
  assert.equal(weekStatus(w), 'pending-review');
  w.approvedVersion = 1; w.approvedRevision = 1;
  assert.equal(weekStatus(w), 'approved');
  w.revision = 2;
  assert.equal(weekStatus(w), 'pending-changes');
});

test('spelling flags: duplicates, symbols, sentence must contain the word', () => {
  const w = newWeek({ studentId: 's', startDate: '2026-10-12' });
  w.spelling = [newSpellingItem({ word: 'rushed', sentence: 'We rushed home.' }), newSpellingItem({ word: 'rushed' }), newSpellingItem({ word: 'wa5hed', sentence: 'I washed up.' })];
  const c = (i) => spellingFlags(w.spelling[i], w).map((f) => f.code);
  assert.ok(c(0).includes('duplicate-word'));
  assert.ok(!c(0).includes('missing-sentence'));
  assert.ok(c(1).includes('missing-sentence'));
  assert.ok(c(2).includes('not-a-word'));
  assert.ok(c(2).includes('sentence-missing-word'));
});

test('seeded shuffle is reproducible', () => {
  const a = shuffle([1, 2, 3, 4, 5, 6, 7, 8], rng(42));
  const b = shuffle([1, 2, 3, 4, 5, 6, 7, 8], rng(42));
  assert.deepEqual(a, b);
  assert.deepEqual([...a].sort(), [1, 2, 3, 4, 5, 6, 7, 8]);
});

test('school week defaults to Monday–Friday', () => {
  assert.deepEqual(schoolWeekOf(new Date(2026, 9, 14)), { startDate: '2026-10-12', endDate: '2026-10-16' });
  assert.deepEqual(schoolWeekOf(new Date(2026, 9, 18)), { startDate: '2026-10-19', endDate: '2026-10-23' }, 'Sunday → next week');
});

// ── Backup validation ──
function validBackup() {
  const w = sampleWeek();
  w.vocab.forEach((v) => { v.reviewed = true; });
  const snap = buildSnapshot(w, 1);
  w.approvedVersion = 1; w.approvedRevision = w.revision;
  return {
    app: 'word-workshop', schemaVersion: 1, exportedAt: '2026-10-10T00:00:00Z',
    data: {
      students: [{ id: 'st1', displayName: 'Alex', grade: 3 }], weeks: [w], snapshots: [snap],
      attempts: [{ id: 'a1', studentId: 'st1', weekId: w.id, snapshotVersion: 1, score: 3, total: 4 }],
      images: [], meta: [{ key: 'setup', value: true }],
    },
  };
}

test('backup: a valid backup passes', () => {
  const r = validateBackup(validBackup());
  assert.deepEqual(r.errors, []);
  assert.equal(r.summary.students, 1);
});

test('backup: malformed files are rejected with reasons', () => {
  assert.equal(parseBackupText('').ok, false);
  assert.equal(parseBackupText('{not json').ok, false);
  assert.equal(parseBackupText('[]').ok, false);
  assert.equal(validateBackup({ app: 'other', schemaVersion: 1, data: {} }).ok, false);
  const newer = validBackup(); newer.schemaVersion = 99;
  assert.match(validateBackup(newer).errors.join(' '), /newer version/);
  const orphan = validBackup(); orphan.data.attempts[0].studentId = 'ghost';
  assert.equal(validateBackup(orphan).ok, false);
  const crossed = validBackup(); crossed.data.students.push({ id: 'st2', displayName: 'Jordan' }); crossed.data.attempts[0].studentId = 'st2';
  assert.match(validateBackup(crossed).errors.join(' '), /another student/);
  const tampered = validBackup(); tampered.data.snapshots[0].vocab[0].definition = 'Something else';
  assert.match(validateBackup(tampered).errors.join(' '), /teacher's wording/);
  const dup = validBackup(); dup.data.students.push({ id: 'st1', displayName: 'Copy' });
  assert.match(validateBackup(dup).errors.join(' '), /appears twice/);
  const badImg = validBackup(); badImg.data.images.push({ id: 'i1', dataUrl: 'javascript:alert(1)' });
  assert.equal(validateBackup(badImg).ok, false);
  const lostSnap = validBackup(); lostSnap.data.snapshots = [];
  assert.equal(validateBackup(lostSnap).ok, false);
});
