# Vocabulary pictures

## What exists today
| Source | How it gets there | Shown to students as |
|---|---|---|
| **Sample illustrations** (12 hand-drawn SVGs in `assets/illustrations/sample/`, made for the sample word list) | Attached automatically when the parent loads the sample week | The picture, captioned "Sample illustration". Each must still be approved with the week. |
| **Parent-uploaded picture** (photo, drawing, screenshot, or a picture the parent made elsewhere) | "Add a picture" on a vocabulary word in the week editor. Resized on the device to ≤ 1000 px; stored only in this browser (and in backups). The parent can describe it for screen readers. | The picture. |
| **No picture yet** | — | An honest placeholder: "Picture coming soon". Not a fake illustration, not an emoji presented as artwork. |

"Picture idea" (week editor) writes a short, child-safe description of a picture that would show the word's approved meaning. The parent can draw from it, or paste it into a picture tool they already use, and then upload the result. Word Workshop does not create pictures and never claims to.

Every picture is part of the approved lesson version: changing or removing it un-checks the word and requires re-approval. Image records are never overwritten, so earlier approved versions keep their pictures.

## Future automatic generation — integration point (not enabled)
`js/illustrations.js` exports `GENERATION = { enabled: false }` and `generateIllustration()`, which currently throws. No code calls a generation service and no API key exists anywhere in this project.

A safe implementation would need owner approval because it costs money and sends data to a third party:
1. A small server the owner controls (for example a Cloudflare Worker) that holds the image-generation API key as a secret. The key is never sent to the browser or committed.
2. The browser sends only: word, approved definition, grade, and the picture-idea text. No names, photos or results.
3. The server enforces a shared passphrase entered once on the parent's device, a rate limit, and a monthly spend cap set with the provider.
4. The returned image is stored like an upload with `kind: 'generated'` and must be approved by the parent before students see it, exactly like any other picture.
5. Claude models do not generate images; a separate image provider would be needed. Typical public prices are a few cents to about $0.20 per image depending on provider and quality (to be confirmed at the time of approval). A 12-word week would cost well under $3 at the high end.
