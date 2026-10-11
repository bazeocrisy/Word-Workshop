# Word Workshop — final implementation directive (from the owner, 2026-10-10)

Recorded verbatim in substance so reviewers and resumed sessions work from the same instructions.

## Mission
Build a complete, reliable, mobile-friendly spelling and vocabulary learning application for elementary school students in 3rd and 5th grade. Minimize weekly preparation for parents while giving students an effective way to study, practice, and complete graded assessments.
**Primary experience: Upload → Review → Approve → Study → Practice → Test → Review Results.** Keep it simple. No unnecessary features or complicated navigation.

## 1. Before coding
Read all docs and sample data incl. the architecture proposal. Preserve existing work. Use the approved vanilla JS/HTML/CSS/IndexedDB/GitHub Pages architecture unless a serious technical issue requires a documented change. Two roles: Builder (UI, implementation, tests, fixes) and Independent Reviewer (requirements, educational accuracy, security, functionality, test results). Resolve routine questions internally.

## 2. Student and weekly lesson management
Separate student profiles using generic demo names in the public repo; independent lessons, history and scores per student; create a week and select its date; reopen previous weeks; clear draft / pending review / approved / pending changes states; simple student dashboard with Vocabulary, Spelling, Study, Practice, Test, Results; parent dashboard for creating and managing lessons. The student interface must never expose unapproved lesson content.

## 3. Photo upload and extraction — core requirement
JPEG/PNG and common browser formats; one or multiple pages. Genuine on-device OCR. Extraction should: read spelling and vocabulary content; preserve original order when possible; separate words from definitions; detect headings/irrelevant text; flag uncertain or missing information; display the source image beside extracted content; create an editable draft, never an auto-approved lesson. Test against the actual school photographs when available locally; never commit them. Measure word extraction, definition accuracy and word–definition pairing accuracy; do not claim OCR passes based only on synthetic images. On failure give clear feedback and allow manual correction/entry. If on-device OCR is insufficient, report it and propose a secure alternative; no exposed keys, no paid processing without approval.

## 4. Manual entry and parent review
Type or paste lists; add/edit/delete/reorder; correct OCR; edit example sentences; review definitions; approve an entire week. One consolidated review screen. Every imported item explicitly reviewed; unresolved warnings require acknowledgement or correction before approval. Teacher definition integrity is mandatory: store original transcription separately from any parent-edited definition; never silently substitute dictionary/generated/rewritten text; record corrections; preserve approved snapshots; previous results stay linked to the exact version tested.

## 5. Vocabulary study
Card: word, exact approved teacher definition, meaningful illustration or clearly identified temporary fallback, age-appropriate real-world example sentence, audio pronunciation, easy navigation. Generate sample sentences for the provided list, editable before approval, separate from the teacher definition. Illustrations must reinforce meaning. Support uploaded illustrations now; design a secure integration point for future automatic generation. Do not describe emojis/decorative icons as AI-generated illustrations. Report credential/paid/backend needs separately.

## 6. Vocabulary practice
Multiple choice (definition), reverse multiple choice (word from definition), fill in the blank (meaningful sentence), matching, written response (type the word). Practice: immediate feedback, explanations, optional retry, progress indicators, practice missed words. No ambiguous questions or multiple-valid distractors. Use approved data only.

## 7. Vocabulary tests
Separate assessment activities and a mixed test. No feedback before submission; correct answers not in hidden text or accessible hints during testing. Deterministic grading with documented normalization; grade every response; show correct answers and misses after submission; save to correct student, week and approved version. If more than one response could reasonably be correct, flag the question rather than grade unfairly.

## 8. Spelling study
Original newsletter order; example sentence for every word; audio word; hear the sentence; normal and slow playback; replay; grouping by spelling pattern; separate grouping by ending pronunciation when applicable. Do not confuse spelling transformations with pronunciation. Verify regular -ed and consonant doubling for "stepped". Parent can correct suggested groups.

## 9. Spelling practice
Hear word; hear sentence; type; check; immediate feedback; retry missed. Fallback when speech synthesis is unavailable; clear handling of unsupported devices/voices.

## 10. Spelling test
Randomized order unless parent chooses teacher order. Speak word and sentence; display sentence with target removed; never display correct spelling before submission; replay; typed answer required; grade on submit; score, percentage, correct and incorrect answers; Practice Missed Words. Ignore leading/trailing whitespace and capitalization; enforce letter sequence; no silent autocorrect.

## 11. Results and progress
Separate per child and week: activity, mode, date, score, percentage, missed words, lesson version. Parent can view previous attempts and print results. Focused practice for missed words. Retakes never overwrite previous assessments.

## 12. Persistence and backups
IndexedDB; refresh persistence; multiple profiles; archived weeks; versioned lessons; export all to JSON; validate and import; recover from malformed files; clear warning before replacing data; explain data is on this device only, no sync. No API secrets in frontend.

## 13. Interface and accessibility
Clean, welcoming, colorful. iPhone, iPad, Android, desktop. Large touch targets, readable text, clear instructions, keyboard support, accessible labels. No unnecessary animation, leaderboards, accounts, distractions. Consistent layouts and navigation.

## 14. Printable resources
Weekly spelling lists; vocabulary study guides with definitions; results and missed-word practice. Readable, sensible page breaks, low ink.

## 15. Sample data
Use the existing sample JSON; treat as unverified; never auto-approve sample definitions; preserve mismatch warnings. Never commit real photos, results or personal backups.

## 16. Quality assurance
Automated tests for: approval enforcement, definition integrity, student isolation, OCR error/correction workflows, vocabulary answer keys, matching and distractor uniqueness, spelling grading, audio fallback, test answer-leak prevention, result persistence, backup/restore, versioned lessons, GitHub Pages base path. Independent Reviewer examines code and results; findings classified Critical/Major/Minor; fix and recheck Critical and Major before a milestone is complete. Document limitations of tests that cannot be automated.

## 17. Workflow
Milestones: 1 Core app, profiles, storage · 2 Weekly lesson editor and approval · 3 Vocabulary learning and assessment · 4 Spelling learning and assessment · 5 Photograph extraction and verification · 6 Illustrated cards and printables · 7 Full-system testing and final audit. Each: implement, test, review, fix, recheck, commit, update docs/STATUS.md, proceed. Don't ask routine questions. Keep checkpoint docs for resumption.

## 18. Stop conditions
Pause only for: paid service/new expenditure; security or privacy decision; significant scope/architecture change; missing credentials/permissions; a teacher's definition needing parent judgment; merge/deploy authorization. Never merge to main; never deploy without explicit approval.

## 19. Final acceptance report
Features implemented; incomplete/blocked/deferred; test results and failures; OCR accuracy on real photos if supplied; reviewer findings and resolution; mobile/desktop verification; commit and branch; security/privacy notes; deployment readiness; owner steps before deployment. Do not mark complete unless every required feature passed or is explicitly reported blocked/deferred.
