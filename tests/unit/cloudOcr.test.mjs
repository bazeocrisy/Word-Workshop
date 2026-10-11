import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toReading, draftInputs, UNSURE_NOTE } from '../../js/cloudOcr.js';
import { compareKey } from '../../js/model.js';
import worker, { cleanResult, readWorksheet, TOOL } from '../../server/ocr-worker/worker.js';

const sample = {
  spelling: [
    { number: 2, word: 'buzzed', unsure: false }, { number: 1, word: 'rushed', unsure: false },
    { number: 4, word: 'opened', unsure: true }, { number: null, word: '  ', unsure: false },
  ],
  vocabulary: [
    { word: 'Produce', definition: 'Fresh  fruits and\nvegetables', unsure: false },
    { word: 'Peculiar', definition: '', unsure: true },
  ],
  notes: ['Bottom row partly cut off'],
  model: 'claude-sonnet-5-5',
};

test('online reading: teacher order, cleaned text, missing numbers noted', () => {
  const r = toReading(sample);
  assert.equal(r.online, true);
  assert.deepEqual(r.spelling.map((x) => x.word), ['rushed', 'buzzed', 'opened']);
  assert.equal(r.vocabulary[0].definition, 'Fresh fruits and vegetables');
  assert.ok(r.notes.includes('Bottom row partly cut off'));
  assert.ok(r.notes.some((n) => /Number 3 was not found/.test(n)));
  assert.equal(r.lines[0].text, '1. rushed');
  assert.ok(r.confidence > 0 && r.confidence < 100);
});

test('online reading: the page type the parent chose wins', () => {
  assert.equal(toReading(sample, 'vocab').spelling.length, 0);
  assert.equal(toReading(sample, 'spelling').vocabulary.length, 0);
  assert.equal(toReading({}).confidence, 0);
});

test('online reading: unsure words are below the warning threshold and carry a note', () => {
  const r = toReading(sample);
  const { ctx, sp, vo } = draftInputs(r, compareKey);
  assert.deepEqual(sp.map((x) => x.word), ['rushed', 'buzzed', 'opened']);
  assert.ok(ctx.spRows.get(compareKey('opened')).conf < 80);
  assert.deepEqual(ctx.spRows.get(compareKey('opened')).notes, [UNSURE_NOTE]);
  assert.ok(ctx.spRows.get(compareKey('rushed')).conf >= 80);
  assert.equal(vo[0].definition, 'Fresh fruits and vegetables');
  const notes = ctx.rowNotes.get(compareKey('Peculiar'));
  assert.ok(notes.includes(UNSURE_NOTE) && notes.some((n) => /No definition/.test(n)));
  assert.equal(ctx.readRows.vo.length, 2);
});

test('worker: cleanResult drops malformed fields', () => {
  const r = cleanResult({ spelling: [{ word: 'a', number: '3' }, null, { word: 5 }], vocabulary: 'x', notes: [1, 'ok'] });
  assert.deepEqual(r, { spelling: [{ number: null, word: 'a', unsure: false }], vocabulary: [], notes: ['ok'] });
});

test('worker: asks for the tool (strict schema, low effort; no temperature, no forced tool choice) and returns its transcription', async () => {
  let sent;
  const fakeFetch = async (url, init) => {
    sent = { url, headers: init.headers, body: JSON.parse(init.body) };
    return new Response(JSON.stringify({ model: 'm', stop_reason: 'tool_use', content: [{ type: 'tool_use', name: TOOL.name, input: { spelling: [{ number: 1, word: 'rings', unsure: false }], vocabulary: [], notes: [] } }] }), { status: 200 });
  };
  const r = await readWorksheet({ image: 'AAAA', mediaType: 'image/jpeg', target: 'spelling' }, { ANTHROPIC_API_KEY: 'k' }, fakeFetch);
  assert.equal(sent.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(sent.headers['x-api-key'], 'k');
  // Current models reject a forced tool_choice and any temperature with HTTP 400 (security review, 2026-10-11).
  assert.equal(sent.body.tool_choice, undefined);
  assert.equal(sent.body.temperature, undefined);
  assert.equal(sent.body.tools[0].strict, true);
  assert.equal(sent.body.tools[0].input_schema.additionalProperties, false);
  assert.equal(sent.body.tools[0].input_schema.properties.spelling.items.additionalProperties, false);
  assert.deepEqual(sent.body.output_config, { effort: 'low' });
  assert.match(sent.body.messages[0].content[1].text, /Call the record_worksheet tool/);
  assert.equal(sent.body.messages[0].content[0].source.data, 'AAAA');
  assert.match(sent.body.messages[0].content[1].text, /only the spelling list/);
  assert.deepEqual(r.spelling, [{ number: 1, word: 'rings', unsure: false }]);
  assert.equal(r.truncated, false);
});

const env = { ANTHROPIC_API_KEY: 'k', READER_PASSPHRASE: 'secret', ALLOWED_ORIGINS: 'https://bazeocrisy.github.io' };
const req = (headers, body, method = 'POST') => new Request('https://reader.example/', { method, headers, body: body == null ? undefined : JSON.stringify(body) });
const ORIGIN = { Origin: 'https://bazeocrisy.github.io', 'Content-Type': 'application/json' };

test('worker: a refusal or a reply without the tool is an error (the app then reads on the device)', async () => {
  const reply = (body) => async () => new Response(JSON.stringify(body), { status: 200 });
  await assert.rejects(readWorksheet({ image: 'A', mediaType: 'image/jpeg' }, { ANTHROPIC_API_KEY: 'k' }, reply({ stop_reason: 'refusal', content: [] })), /declined/);
  await assert.rejects(readWorksheet({ image: 'A', mediaType: 'image/jpeg' }, { ANTHROPIC_API_KEY: 'k' }, reply({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'hi' }] })), /did not return a transcription/);
});

test('oversized replies are capped (items and characters)', () => {
  const big = { spelling: Array.from({ length: 300 }, (_, i) => ({ number: i + 1, word: 'w'.repeat(900), unsure: false })), vocabulary: [], notes: [] };
  const r = toReading(big);
  assert.equal(r.spelling.length, 100);
  assert.equal(r.spelling[0].word.length, 500);
  assert.equal(cleanResult(big).spelling.length, 100);
});

test('worker: refuses other websites, wrong passphrases and bad input; answers a ping', async () => {
  // "Test connection" asks Anthropic about the model (free). Stub the network: this test must not reach the internet.
  const realFetch = globalThis.fetch;
  let asked = null;
  globalThis.fetch = async (url, init) => { asked = { url: String(url), key: init?.headers?.['x-api-key'] }; return new Response('{}', { status: env.__modelStatus || 200 }); };
  try {
  assert.equal((await worker.fetch(req({ Origin: 'https://evil.example', 'X-Reader-Key': 'secret' }, { ping: true }), env)).status, 403);
  assert.equal((await worker.fetch(req({ ...ORIGIN, 'X-Reader-Key': 'nope' }, { ping: true }), env)).status, 401);
  assert.equal((await worker.fetch(req({ ...ORIGIN, 'X-Reader-Key': 'secret' }, { image: 'x', mediaType: 'text/html' }), env)).status, 400);
  const pre = await worker.fetch(req(ORIGIN, null, 'OPTIONS'), env);
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get('Access-Control-Allow-Origin'), 'https://bazeocrisy.github.io');
  const ping = await worker.fetch(req({ ...ORIGIN, 'X-Reader-Key': 'secret' }, { ping: true }), env);
  assert.equal(ping.status, 200);
  assert.equal((await ping.json()).ok, true);
  assert.equal(asked.url, 'https://api.anthropic.com/v1/models/claude-sonnet-5-5');
  assert.equal(asked.key, 'k');
  env.__modelStatus = 401; // wrong key: Test connection must not say "Connected"
  assert.equal((await worker.fetch(req({ ...ORIGIN, 'X-Reader-Key': 'secret' }, { ping: true }), env)).status, 502);
  delete env.__modelStatus;
  assert.equal((await worker.fetch(req({ ...ORIGIN, 'X-Reader-Key': 'secret' }, { image: 'A'.repeat(7e6) }), env)).status, 413);
  } finally { globalThis.fetch = realFetch; }
});
