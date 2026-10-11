# Manual device checklist

Automated tests run in headless Chrome at phone, tablet and desktop sizes, with speech mocked. They cannot prove real speech output, real camera photos, iOS Safari storage behaviour or printing on paper. Run this checklist on real devices before or right after deployment. Tick each box and note the device/browser.

Devices: ☐ iPhone (Safari) ☐ iPad (Safari) ☐ Android phone (Chrome) ☐ Windows or Mac (Chrome/Edge/Safari)

## Setup
- ☐ Open the site; the two demo profiles appear. Rename them to your children in Parent area → Settings.
- ☐ iPhone/iPad: Share → Add to Home Screen; open from the icon (protects data from Safari's 7-day clean-up).
- ☐ Optional: set a parent PIN; check a child cannot open the parent area without it.

## Photo extraction (real photos — the key unmeasured item)
- ☐ Take a photo of this week's newsletter and the vocabulary sheet with the phone camera; upload both in one go.
- ☐ The reader downloads the first time (needs internet), then reads each page in under ~30 s.
- ☐ Compare the text boxes with the photos. Note how many words/definitions were wrong: ____ / ____.
- ☐ Add as drafts; the editor shows the source pages beside the words; low-confidence words are flagged.
- ☐ Import a second time: the reader starts faster than the first time (the browser keeps its copy). Note: the app needs an internet connection to open; it is not an offline app.
- ☐ Also try "Paste or type a list" with text copied from the photo by the phone (Live Text). Which was more accurate? ____
- ☐ For an exact accuracy number, copy the photos to `local-fixtures/` on the computer and run `npm run test:ocr`.

## Speech
- ☐ Settings → Test the voice: you hear "stepped…" at normal and slow speed. iPhone: silent switch off.
- ☐ Spelling test: after tapping Start, the first word is spoken; Next speaks the next word; replay works.
- ☐ "Playing…" appears only while speech is actually running. (A muted device still counts as playing — the app cannot detect the volume — so check the silent switch and volume first.)

## Study, practice, test (child does this)
- ☐ Flashcards: tap Next through all cards; pictures load; definitions match the teacher sheet.
- ☐ Each vocabulary activity (meaning, word, blank, match, write) works with touch and with an external keyboard.
- ☐ A spelling test: the word is never visible before submitting; results show score and missed words; "Practice missed words" works.
- ☐ Rotate the tablet and refresh the page mid-test: answers are kept. (Closing the tab ends an unfinished test; finished results are always saved.)

## Data
- ☐ Backup → Download backup; open the file list to confirm it saved.
- ☐ On a second device, Restore from that file; the weeks and results appear.
- ☐ Try restoring a non-backup file: it is refused and nothing changes.

## Printing
- ☐ Print the weekly sheets (or Save as PDF): spelling list on page 1, vocabulary guide on page 2, readable, no buttons.
- ☐ Print results and the missed-word practice sheet.

## Accessibility spot checks
- ☐ iOS VoiceOver or Android TalkBack: the question is read when a quiz opens; feedback is announced.
- ☐ Keyboard only on a computer: complete a spelling test and a vocabulary test without the mouse.
