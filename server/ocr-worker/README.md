# Online photo reader (Cloudflare Worker)

An optional server that lets Word Workshop read worksheet photos with Claude's vision model instead of the
on-device reader. The Anthropic API key stays on this server; the app only knows the server's address and a
shared passphrase. Photos are passed through to Anthropic and not stored here.

Why: the on-device reader (Tesseract) gets the spelling newsletter mostly right but reads at best 4 of 12
vocabulary definitions exactly from the real vocabulary photo (see `docs/OCR.md`). A vision model reads the
whole page, including tables of cards and pale text, and returns word–definition pairs directly.

## What you need
- An Anthropic API account with billing (console.anthropic.com). **Set a monthly spend limit of $5** there.
  It is the only hard cap on cost. Expect about 2–5 cents per photo with the default model
  (about $0.40–$1 for a typical month of 16–20 photos).
- A free Cloudflare account.
- Node.js 18+ on your computer (for `npx wrangler`).

## Set up (about 10 minutes)
```sh
cd server/ocr-worker
npx wrangler login                          # opens the browser to sign in to Cloudflare
npx wrangler secret put ANTHROPIC_API_KEY   # paste the key from console.anthropic.com
npx wrangler secret put READER_PASSPHRASE   # paste a long random passphrase (see below); you will type it in the app once
npx wrangler deploy                         # prints the address, e.g. https://word-workshop-reader.<you>.workers.dev
```
**Passphrase:** use at least 20 random characters. The reader has no lockout, so a short or guessable passphrase
could be found by trying many. To make one, run `node -e "console.log(crypto.randomUUID())"` and paste the output
at the `secret put` prompt and later in the app (it is not saved in your shell history that way).

`wrangler.toml` lets pages from `https://bazeocrisy.github.io` call the reader from a browser. This is not a lock:
any program can claim any origin, and that origin is shared by every GitHub Pages site of this account. The
passphrase is what keeps others out. If the app is served from somewhere else (or you test locally), add that
origin to `ALLOWED_ORIGINS`, comma-separated.

**After deploying:** the app's security policy (`index.html`, `connect-src`) allows any `*.workers.dev` address so
that the reader works before its address is known. Replace `https://*.workers.dev` with your reader's exact
address (for example `https://word-workshop-reader.<you>.workers.dev`) in a follow-up change.

## Turn it on in the app
Parent area → **Settings** → **Online photo reader**: paste the address, enter the passphrase, tick
**Read worksheet photos online**, **Test connection** (it checks that Anthropic accepts the key and model; it costs
nothing), then **Save**. Set a parent PIN too, so children cannot send photos. This is per browser: do it on each
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
| `MODEL` | `claude-sonnet-5-5` | Anthropic model. `claude-haiku-5-5` is much cheaper but less exact; `claude-opus-5-5` for the hardest photos (about twice the Sonnet price) |
| `DAILY_LIMIT` | `60` | Photos per day per server instance. Best-effort only: Cloudflare runs many instances and restarts them, so this is not a budget. The Anthropic spend limit is the cap. |

## Safety
- The key is a Cloudflare secret; it is never sent to the browser or committed. `.dev.vars` and `.wrangler/` are
  git-ignored; never put the key or passphrase in a file, a commit, or a command line.
- Requests need the passphrase (compared in constant time); browsers also need an allowed `Origin`. Photos are
  capped at 4.5 MB and replies at 6000 tokens.
- Cost: the Anthropic Console monthly spend limit is the only hard cap. `DAILY_LIMIT` slows casual misuse only.
- The app stores the passphrase in that browser's localStorage. Any page on the same origin
  (`https://bazeocrisy.github.io`, i.e. any GitHub Pages site of this account) could read it. Only turn the reader
  on in browsers you trust, and set a parent PIN.
- The model is told to copy text exactly and never correct the teacher's wording, and to mark anything it is not
  sure of. Every word still arrives in the app as an unchecked draft that the parent compares with the photo.
- If the reader is down, refuses, or runs out of daily allowance, the app reads the photo on the device instead
  and tells the parent why.
