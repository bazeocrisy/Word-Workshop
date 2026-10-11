# Product requirements — Word Workshop v1

## Primary users
Parent administrator and two students: Chris II (grade 3) and Gabriella (grade 5). Support changing profile labels and adding students later. No login required in v1.

## Weekly workflow
1. Parent selects student and creates a week.
2. Parent uploads photo(s)/screenshots or enters spelling and vocabulary records manually.
3. System extracts words and literal teacher definitions from photos (if OCR is available). Parent can correct, reorder, add, or remove items.
4. Every imported item is labeled `needs_review`; parent must explicitly approve the entire week. Low-confidence text and suspected definition mismatches require attention; never auto-correct source definitions.
5. Approved content becomes accessible to the student.
6. Student studies, practices, takes graded spelling and vocabulary tests.
7. Scores and missed words are retained per student/week.

## Vocabulary
- Keep teacher source definition separate from generated explanation, sentence, and illustration.
- Exact original definition and approved definition fields; preserve both and edit audit metadata.
- Illustrated flashcards (may use curated local illustrations until safe generation is configured).
- Example sentence with age-appropriate real-world context.
- Multiple choice, fill in blank, typed word response, and matching.
- Practice gives immediate guidance; tests hide answers until submitted.
- Grade deterministically and display missed words and correct answers at end.

## Spelling
- Store newsletter list in its original order and allow teacher list overrides.
- Group by actual spelling transformation and optionally pronunciation of -ed (/t/, /d/, /id/); show reason for grouping and avoid incorrect claims.
- Text-to-speech word and sentence; test requires typing without visible answer. Include replay and non-audio accessibility fallback.
- Exact spelling comparison case-insensitive; trim surrounding whitespace, but do not ignore internal misspellings.
- Results out of total, percentage, missed words, practice missed.

## Data and reliability
- Persist students, weeks, review state, attempts, and scores across refresh on same browser using IndexedDB/local storage (choose robust approach and justify).
- Export/import complete backup as JSON. GitHub Pages cannot sync data across devices by itself; explain clearly.
- No accidental overwrites across student profiles or weeks.
- Support desktop/iPad/iPhone, keyboard navigation, readable type, visual contrast.
- Do not claim OCR/AI image generation works until integrated and tested end-to-end.
- Images/uploads of children or school material must not be committed to a public repository or external service without parent approval.
- No embedded secrets in browser JS, repository, or GitHub Pages.

## Definition integrity acceptance rule
A teacher definition displayed in a study card or used to generate answer keys MUST originate from the parent-approved exact transcription. Any alternate definition is explicitly labeled separately. Flag questionable source pairings instead of replacing them.

## Non-goals v1
No logins, online synchronization, leaderboards, monetization, social features, complex animations, or automatic deployment without owner approval.
