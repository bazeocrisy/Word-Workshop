# Online photo reader: setup and accuracy test (owner's checklist)

The online reader is optional. It sends a worksheet photo to a small server you own (a Cloudflare Worker), which asks
Anthropic's Claude to transcribe it. The Anthropic API key stays on that server. Until you finish these steps and
turn the reader on in Settings, nothing changes and photos are read on the device.

**Before you start.** Do this only after you approve deployment. The security review of PR #4 found no remaining
Critical or Major problems (docs/STATUS.md). Expected cost:
- about 2–5 cents per photo;
- about $0.40–$1 a month for 16–20 photos;
- at most about $4.30 a month for 60 photos.

The Cloudflare Worker is free.

> **Status (2026-10-11):** steps 1–5 are done. The reader runs at https://word-workshop-reader.bazeocrisy.workers.dev and read both real photos perfectly (docs/OCR.md). On this PC, if PowerShell says "running scripts is disabled", type `npx.cmd` / `npm.cmd` instead of `npx` / `npm`.

## 1. Accounts and the spending limit (about 10 minutes, in the browser)
1. **Anthropic** (console.anthropic.com): sign in, add billing, then go to **Settings → Limits** and set a
   **monthly spend limit of $5**.
   - This is the only hard cap on cost.
   - If the Console lets you, create a separate workspace called "Word Workshop" with its own $5 limit and make the
     key there.
2. **Create an API key** (**API keys → Create key**, name it `word-workshop-reader`).
   - Keep the page open. You paste the key once, in step 3, and never anywhere else.
   - Don't save it in a file, an email or a chat.
3. **Cloudflare** (dash.cloudflare.com): create a free account if you don't have one.

## 2. Make the passphrase (on this PC)
In PowerShell:
```powershell
node -e "console.log(crypto.randomUUID())"
```
Copy the output (36 characters) into your password manager.
- It is the passphrase for the reader server and for the app's Settings.
- Don't use a shorter or made-up phrase: the server refuses passphrases under 20 characters, because there is no
  lockout after wrong guesses.

## 3. Deploy the reader server (about 5 minutes)
The server code is on the `claude/online-ocr` branch.
```powershell
cd $HOME\Projects\Word-Workshop
git fetch; git checkout claude/online-ocr; git pull
cd server\ocr-worker
npx wrangler login                          # opens the browser: allow access to your Cloudflare account
npx wrangler secret put ANTHROPIC_API_KEY   # paste the Anthropic key at the prompt, press Enter
npx wrangler secret put READER_PASSPHRASE   # paste the passphrase from step 2 at the prompt, press Enter
npx wrangler deploy                         # prints the address, e.g. https://word-workshop-reader.<you>.workers.dev
```
- Write down the address that `deploy` prints.
- Paste the key and passphrase **only at the `secret put` prompts**, never on a command line or in a file.
- `.dev.vars` and `.wrangler/` are git-ignored, so local secrets can't be committed by accident.

## 4. Free connection check (no photo sent, no cost)
```powershell
cd $HOME\Projects\Word-Workshop
$env:READER_URL = "https://word-workshop-reader.<you>.workers.dev"
$env:PING_ONLY = "1"; npm run test:ocr:online; Remove-Item Env:PING_ONLY
```
Type the passphrase when asked; it is not shown.

**Expected:** `Connection check: HTTP 200 OK (model claude-sonnet-5-5)`.

If it fails:

| Response | What to fix |
|---|---|
| 401 | Wrong passphrase |
| 500 | The server is missing its key or passphrase, or the passphrase is shorter than 20 characters (redo step 3) |
| 502 | Anthropic rejected the key or model (check the key in the Console) |

## 5. Accuracy test on the real school photos (about 10 cents)
The photos `spelling-original.jpg` and `vocab-original.jpg` are already in the git-ignored `local-fixtures/` folder.
```powershell
npm run test:ocr:online
```
- It sends the 2 photos and compares the result with the teacher's lists in `sample-data/`.
- It ends with a SUMMARY comparing the online reader with the on-device reader. On-device results so far:
  - spelling: 14/15 words;
  - vocabulary at best: 9/12 words, 4/12 exact definitions.
- Send me the SUMMARY lines. I will record them in docs/OCR.md.

**How to judge the result.** Every word still arrives as an unchecked draft, so this is about how much you have to
correct. The reader is worth turning on if it gets:
- the spelling list right (15/15, or 14/15 with the miss flagged as unsure);
- most vocabulary definitions exactly right (for example, 10/12 or better).

If it does much worse, leave it off: nothing changes for the family.

## 6. If the results are good: finishing (needs your approval)
1. Done: the app's security setting now allows only `https://word-workshop-reader.bazeocrisy.workers.dev`.
   Next, you approve merging PR #4.
2. After the site updates, open **Parent area → Settings → Online photo reader** in each browser you use:
   1. Paste the address and passphrase.
   2. Tick **Read worksheet photos online**.
   3. Press **Test connection**, then **Save**.
3. Set a **parent PIN** in Settings, so children can't send photos.

## Turning it off or removing it
- **Off for one browser:** untick **Read worksheet photos online** in Settings.
- **Off everywhere:** in the Anthropic Console, delete the key, or run `npx wrangler delete` in `server\ocr-worker`.
  The app then reads on the device and tells the parent why.
