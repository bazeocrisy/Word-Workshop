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
  for (const w of ['opened', 'happened', 'listened', 'offered', 'entered', 'wondered', 'traveled', 'followed', 'collected', 'complained', 'repeated']) assert.equal(k(w), 'add-ed', w);
  assert.equal(endingSound('decided').key, 'id', 'sound still known when the spelling rule is unclear');
  assert.equal(endingSound('escaped').key, 't');
  assert.equal(endingSound('admired').key, 'd');
});

test('M3 review: common silent-e words never get a non-word base (changed, ignored, compared, inhaled, created)', () => {
  for (const w of ['changed', 'arranged', 'exchanged', 'ignored', 'explored', 'adored', 'compared', 'prepared', 'declared', 'inhaled', 'exhaled', 'created', 'colored', 'banged']) {
    const c = spellingChange(w);
    assert.ok(c.key === 'check' || (c.key === 'drop-e' && c.base + 'd' === w), w + ' → ' + c.key + ' ' + c.base);
  }
  assert.equal(spellingChange('created').base, 'create');
  assert.equal(spellingChange('ignored').base, 'ignore');
});

test('M4 review: more silent-e words get a real base word', () => {
  const expect = { tasted: 'taste', wasted: 'waste', pasted: 'paste', typed: 'type', caused: 'cause', paused: 'pause', raised: 'raise', praised: 'praise', pleased: 'please', teased: 'tease', breathed: 'breathe', bathed: 'bathe' };
  for (const [w, base] of Object.entries(expect)) {
    const c = spellingChange(w);
    assert.equal(c.key, 'drop-e', w);
    assert.equal(c.base, base, w);
  }
  for (const w of ['rested', 'listed', 'posted', 'lasted', 'played', 'stayed', 'rained']) assert.equal(spellingChange(w).key, 'add-ed', w);
});

test('M5-6 review: qu/gu onsets and -the/-ache bases', () => {
  const exp = { guided: 'guide', quoted: 'quote', quaked: 'quake', ached: 'ache', basted: 'baste', clothed: 'clothe', soothed: 'soothe' };
  for (const [w, base] of Object.entries(exp)) assert.equal(spellingChange(w).base, base, w);
  assert.equal(spellingChange('skied').base, 'ski');
  assert.notEqual(spellingChange('biased').base, 'biase');
  assert.equal(spellingChange('quizzed').base, 'quiz');
});
