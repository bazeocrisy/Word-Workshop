import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spellingChange, endingSound, suggestGroups, groupItems } from '../../js/spelling.js';

const sample = JSON.parse(fs.readFileSync(new URL('../../sample-data/spelling.json', import.meta.url), 'utf8'));

test('sample list: only "stepped" doubles its consonant; the rest just add -ed', () => {
  const byKey = {};
  for (const w of sample.words) (byKey[spellingChange(w.word).key] ||= []).push(w.word);
  assert.deepEqual(byKey.double, ['stepped']);
  assert.equal(byKey['add-ed'].length, 14);
  assert.equal(spellingChange('stepped').base, 'step');
  assert.equal(spellingChange('buzzed').base, 'buzz', 'buzz already ends in zz');
  assert.equal(spellingChange('called').base, 'call', 'call already ends in ll');
});

test('sample list: -ed pronunciation groups', () => {
  const groups = {};
  for (const w of sample.words) (groups[endingSound(w.word).key] ||= []).push(w.word);
  assert.deepEqual(groups.id.sort(), ['blasted', 'handed', 'hunted', 'landed', 'lifted']);
  assert.deepEqual(groups.t.sort(), ['asked', 'crashed', 'rushed', 'stepped', 'washed', 'winked']);
  assert.deepEqual(groups.d.sort(), ['buzzed', 'called', 'opened', 'screamed']);
});

test('spelling change and sound are separate ideas', () => {
  const g = suggestGroups('stepped');
  assert.equal(g.spelling.key, 'double');
  assert.equal(g.sound.key, 't');
  assert.match(g.spelling.reason, /step → stepped/);
});

test('other -ed rules', () => {
  const k = (w) => spellingChange(w).key;
  assert.equal(k('hoped'), 'drop-e'); assert.equal(spellingChange('hoped').base, 'hope');
  assert.equal(k('hopped'), 'double'); assert.equal(spellingChange('hopped').base, 'hop');
  assert.equal(k('cried'), 'y-to-i'); assert.equal(spellingChange('cried').base, 'cry');
  assert.equal(k('played'), 'add-ed');
  assert.equal(k('danced'), 'drop-e'); assert.equal(k('judged'), 'drop-e'); assert.equal(k('smiled'), 'drop-e');
  assert.equal(k('fixed'), 'add-ed'); assert.equal(k('visited'), 'check', 'visit+ed vs invite+d cannot be told from letters'); assert.equal(k('rained'), 'add-ed');
  assert.equal(k('added'), 'add-ed', 'add is a double-letter base');
  assert.equal(k('tied'), 'check'); assert.equal(k('speed'), 'check');
  assert.equal(k('running'), 'other'); assert.equal(k('shed'), 'other');
  assert.equal(endingSound('hated').key, 'id'); assert.equal(endingSound('danced').key, 't');
  assert.equal(endingSound('cried').key, 'd'); assert.equal(endingSound('hoped').key, 't');
  assert.equal(endingSound('laughed'), null, 'gh: cannot tell from letters');
  assert.equal(endingSound('running'), null);
});

test('groupItems keeps first-appearance order', () => {
  const items = ['rushed', 'stepped', 'landed'].map((w) => ({ word: w, groups: suggestGroups(w) }));
  const g = groupItems(items, 'sound');
  assert.deepEqual(g.map((x) => x.key), ['t', 'id']);
  assert.deepEqual(g[0].items.map((i) => i.word), ['rushed', 'stepped']);
});

test('review fixes: longer silent-e words are not called "just add -ed" (Milestone 2 review, Major 1)', () => {
  const k = (w) => spellingChange(w).key;
  for (const w of ['decided', 'invited', 'escaped', 'surprised', 'excited', 'exploded', 'erased', 'admired', 'completed']) assert.notEqual(k(w), 'add-ed', w);
  for (const w of ['replaced', 'noticed', 'rescued', 'glued', 'sneezed']) assert.equal(k(w), 'drop-e', w);
  assert.equal(spellingChange('replaced').base, 'replace');
  assert.equal(spellingChange('quizzed').base, 'quiz');
  assert.equal(k('quizzed'), 'double');
  assert.equal(k('buzzed'), 'add-ed');
  assert.notEqual(spellingChange('controlled').base, 'controll');
  for (const w of ['opened', 'happened', 'listened', 'offered', 'entered', 'wondered', 'traveled', 'colored']) assert.equal(k(w), 'add-ed', w);
  assert.equal(endingSound('decided').key, 'id', 'sound still known when the spelling rule is unclear');
  assert.equal(endingSound('escaped').key, 't');
  assert.equal(endingSound('admired').key, 'd');
});
