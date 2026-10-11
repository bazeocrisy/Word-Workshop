# Deployment (GitHub Pages) — only after owner approval

Nothing here has been done. The owner must approve the merge and the deployment.

## Before deploying
1. Read `docs/STATUS.md` (open items and limitations) and decide whether the photo-reading accuracy on real photos must be measured first (`npm run test:ocr` with photos in `local-fixtures/`).
2. Optional privacy edit: `docs/REQUIREMENTS.md` and `sample-data/*.json` (from the planning phase) mention the children's first names. The app itself uses demo names. The repository and the site are public.
3. Run `npm test` and `npm run test:browser` on the branch; both must pass.

## Deploy
1. Merge `claude/build-v1` into `main` (pull request).
2. GitHub → repository Settings → Pages → Source: "Deploy from a branch", Branch: `main`, folder `/ (root)`. Save.
3. Wait for the Pages build (Actions tab), then open `https://bazeocrisy.github.io/Word-Workshop/`.
4. Verify the live site: `LIVE_URL=https://bazeocrisy.github.io/Word-Workshop/ npm run test:browser`.
5. Run the device checklist in `docs/MANUAL-TESTS.md`.

## Notes
- Everything is static; no server, database, account or secret is needed. There are no API keys anywhere.
- The site is public, but each family's data stays in their own browser. Nobody else can see it.
- Updating later: push to `main`; GitHub Pages republishes. Saved data in browsers is kept (the database schema is versioned).
- Costs: $0 (GitHub Pages for a public repository).
