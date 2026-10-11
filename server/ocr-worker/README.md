# Online photo reader (Cloudflare Worker)

An optional server that lets Word Workshop read worksheet photos with Claude's vision model instead of the
on-device reader. The Anthropic API key stays on this server; the app only knows the server's address and a
shared passphrase. Photos are passed through to Anthropic and not stored here.

Why: the on-device reader (Tesseract) gets the spelling newsletter mostly right but reads at best 4 of 12
vocabulary definitions exactly from the real vocabulary photo (see `docs/OCR.md`). A vision model reads the
whole page, including tables of cards and pale text, and returns word–definition pairs directly.

## What you need
- An Anthropic API account with billing (console.anthropic.com). **Set a monthly spend limit** there; that is
  the real cost guard. Expect a few cents per photo with the default model.
- A free Cloudflare account.
- Node.js 18+ on your computer (for `npx wrangler`).

## Set up (about 10 minutes)
```sh
cd server/ocr-worker
npx wrangler login                          # opens the browser to sign in to Cloudflare
npx wrangler secret put ANTHROPIC_API_KEY   # paste the key from console.anthropic.com
npx wrangler secret put READER_PASSPHRASE   # make up a long passphrase; you will type it in the app once
npx wrangler deploy                         # prints the address, e.g. https://word-workshop-reader.<you>.workers.dev
```
`wrangler.toml` already allows only `https://bazeocrisy.github.io` to call the reader. If the app is served
from somewhere else (or you test locally), add that origin to `ALLOWED_ORIGINS`, comma-separated.

## Turn it on in the app
Parent area → **Settings** → **Online photo reader**: paste the address, enter the passphrase, tick
**Read worksheet photos online**, **Test connection**, then **Save**. This is per browser: do it on each
device the parent uses. The passphrase is kept in that browser only and is not included in backups.

## Measure it on the real photos
With the photos in `local-fixtures/` (git-ignored):
```sh
READER_URL=https://word-workshop-reader.<you>.workers.dev READER_PASSPHRASE=… npm run test:ocr:online
```

## Settings (`wrangler.toml` `[vars]`)
| Name | Default | Meaning |
|---|---|---|
| `ALLOWED_ORIGINS` | `https://bazeocrisy.github.io` | Websites allowed to call the reader |
| `MODEL` | `claude-sonnet-5-5` | Anthropic model. `claude-haiku-5-5` is cheaper and faster but less exact; `claude-opus-5-5` for the hardest photos |
| `DAILY_LIMIT` | `60` | Photos per day per server instance (best-effort; use the Anthropic spend limit as the real cap) |

## Safety
- The key is a Cloudflare secret; it is never sent to the browser or committed.
- Requests need the right `Origin` and passphrase (compared in constant time); photos are capped at 4.5 MB.
- The model is told to copy text exactly and never correct the teacher's wording, and to mark anything it is not
  sure of. Every word still arrives in the app as an unchecked draft that the parent compares with the photo.
- If the reader is down, refuses, or runs out of daily allowance, the app reads the photo on the device instead
  and tells the parent why.
