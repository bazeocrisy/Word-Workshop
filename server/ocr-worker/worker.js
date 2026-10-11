// Word Workshop online photo reader: a Cloudflare Worker that keeps the Anthropic API key off the browser.
// The app sends one worksheet photo; the Worker asks Claude's vision model to transcribe the spelling list and the
// vocabulary words with their definitions exactly as printed, and returns structured JSON. Nothing is stored here.
//
// Secrets / variables (set with `wrangler secret put …` or in wrangler.toml [vars]):
//   ANTHROPIC_API_KEY   (secret)  Anthropic API key. Set a monthly spend limit in the Anthropic Console.
//   READER_PASSPHRASE   (secret)  Shared passphrase the parent enters once in the app's Settings.
//   ALLOWED_ORIGINS     (var)     Comma-separated origins allowed to call this, e.g. https://bazeocrisy.github.io
//   MODEL               (var)     Optional. Defaults to claude-sonnet-5-5.
//   DAILY_LIMIT         (var)     Optional. Photos per day per Worker instance (best-effort). Default 60.

const DEFAULT_MODEL = 'claude-sonnet-5-5';
const MAX_IMAGE_BYTES = 4.5 * 1024 * 1024; // decoded size; the Anthropic API accepts up to 5 MB per image
const MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export const PROMPT = `You are transcribing a school worksheet photo for a parent who will check every word against the sheet.

Find:
1. The SPELLING word list (usually numbered, often in a box titled "Spelling" or "Spelling words"). Return each word with its number exactly as printed, in the teacher's order.
2. The VOCABULARY words with their definitions (often a table or grid of cards: the word in large/bold type, the definition underneath or beside it). Return each word and its definition.

Rules:
- Copy text EXACTLY as printed: same spelling, same capitalisation, same punctuation, same wording. Never correct, improve, shorten or complete the teacher's text. If the teacher made a typo, keep the typo.
- A definition that wraps over several lines is one definition: join the lines with single spaces.
- Leave out headings, names, dates, page titles, instructions, homework notes, example sentences and anything that is not a spelling word or a vocabulary word/definition.
- Do not invent anything. If part of a word or definition is cut off, blurred, covered or too small to read, transcribe what you can and set "unsure": true. Also set "unsure": true whenever you are not certain of every letter.
- If there is no spelling list, return an empty spelling array; the same for vocabulary.
- Record anything the parent should know (e.g. "bottom row partly cut off", "number 7 is missing on the sheet") in notes.
Call the record_worksheet tool with the result.`;

export const TOOL = {
  name: 'record_worksheet',
  description: 'Record the spelling words and vocabulary words/definitions transcribed exactly from the worksheet photo.',
  input_schema: {
    type: 'object',
    properties: {
      spelling: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            number: { type: ['integer', 'null'], description: 'The list number as printed, or null if unnumbered.' },
            word: { type: 'string' },
            unsure: { type: 'boolean' },
          },
          required: ['word', 'unsure'],
        },
      },
      vocabulary: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            word: { type: 'string' },
            definition: { type: 'string', description: 'Exactly as printed.' },
            unsure: { type: 'boolean' },
          },
          required: ['word', 'definition', 'unsure'],
        },
      },
      notes: { type: 'array', items: { type: 'string' } },
    },
    required: ['spelling', 'vocabulary', 'notes'],
  },
};

const TARGET_HINT = {
  spelling: 'This photo shows only the spelling list. Return an empty vocabulary array.',
  vocab: 'This photo shows only vocabulary words and definitions. Return an empty spelling array (numbered steps or instructions are not a spelling list).',
  auto: 'The photo may show a spelling list, vocabulary words, or both.',
};

let day = '', used = 0; // best-effort per-instance daily counter; the real cost guard is the Anthropic spend limit

function cors(origin, env) {
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const ok = origin && allowed.includes(origin);
  return {
    ok,
    headers: ok ? {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Reader-Key',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    } : { Vary: 'Origin' },
  };
}

const json = (body, status, headers) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

/** Constant-time string comparison (passphrase check). */
function same(a, b) {
  a = String(a || ''); b = String(b || '');
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}

/** Keep only well-formed fields from the model's tool input. */
export function cleanResult(input) {
  const str = (s) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '');
  const spelling = (Array.isArray(input?.spelling) ? input.spelling : [])
    .map((x) => ({ number: Number.isInteger(x?.number) ? x.number : null, word: str(x?.word), unsure: !!x?.unsure }))
    .filter((x) => x.word);
  const vocabulary = (Array.isArray(input?.vocabulary) ? input.vocabulary : [])
    .map((x) => ({ word: str(x?.word), definition: str(x?.definition), unsure: !!x?.unsure }))
    .filter((x) => x.word || x.definition);
  const notes = (Array.isArray(input?.notes) ? input.notes : []).map(str).filter(Boolean).slice(0, 20);
  return { spelling, vocabulary, notes };
}

export async function readWorksheet({ image, mediaType, target }, env, fetchImpl = fetch) {
  const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: env.MODEL || DEFAULT_MODEL,
      max_tokens: 4096,
      temperature: 0,
      tools: [TOOL],
      tool_choice: { type: 'tool', name: TOOL.name },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
          { type: 'text', text: `${PROMPT}\n\n${TARGET_HINT[target] || TARGET_HINT.auto}` },
        ],
      }],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw Object.assign(new Error(`Anthropic API ${res.status}`), { status: res.status, detail: detail.slice(0, 300) });
  }
  const data = await res.json();
  const call = (data.content || []).find((c) => c.type === 'tool_use' && c.name === TOOL.name);
  if (!call) throw new Error('The model did not return a transcription.');
  return { ...cleanResult(call.input), model: data.model, truncated: data.stop_reason === 'max_tokens' };
}

export default {
  async fetch(request, env) {
    const { ok, headers } = cors(request.headers.get('Origin'), env);
    if (request.method === 'OPTIONS') return new Response(null, { status: ok ? 204 : 403, headers });
    if (!ok) return json({ error: 'origin not allowed' }, 403, headers);
    if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, headers);
    if (!env.ANTHROPIC_API_KEY || !env.READER_PASSPHRASE) return json({ error: 'reader not configured' }, 500, headers);
    if (!same(request.headers.get('X-Reader-Key'), env.READER_PASSPHRASE)) return json({ error: 'wrong passphrase' }, 401, headers);

    let body;
    try { body = await request.json(); } catch { return json({ error: 'bad request' }, 400, headers); }
    if (body && body.ping) return json({ ok: true, model: env.MODEL || DEFAULT_MODEL }, 200, headers); // "Test connection"
    const { image, mediaType = 'image/jpeg', target = 'auto' } = body || {};
    if (typeof image !== 'string' || !image || !MEDIA_TYPES.has(mediaType)) return json({ error: 'bad request' }, 400, headers);
    if (image.length * 0.75 > MAX_IMAGE_BYTES) return json({ error: 'photo too large' }, 413, headers);

    const today = new Date().toISOString().slice(0, 10);
    if (today !== day) { day = today; used = 0; }
    if (++used > Number(env.DAILY_LIMIT || 60)) return json({ error: 'daily limit reached' }, 429, headers);

    try {
      return json(await readWorksheet({ image, mediaType, target }, env), 200, headers);
    } catch (e) {
      console.error(e.message, e.detail || '');
      return json({ error: 'reader failed', status: e.status || null }, 502, headers);
    }
  },
};
