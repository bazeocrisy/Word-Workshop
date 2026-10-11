# Architecture decisions required before implementation

## Delivery
GitHub repository: `bazeocrisy/Word-Workshop`. Target: mobile-first static site suitable for GitHub Pages. Claude proposes the minimal frontend stack before implementing.

## Essential architectural boundary
Static GitHub Pages does **not** supply a secret-bearing server or private database. It is unsuitable for storing OCR or image-generation service API keys in client JavaScript.

## Photo extraction options
1. Prefer an evaluated client-side OCR library (e.g., Tesseract.js) for privacy and static compatibility, with quality tested using the supplied angled/shadowed photographs. Be candid about confidence and mobile performance.
2. If quality is insufficient, propose a secure server-side OCR service as a separate approved enhancement with pricing, hosting, privacy, and account requirements.

Parent review is mandatory regardless of OCR reliability. OCR output should be a draft only.

## Illustration strategy
For v1, support manually supplied or locally bundled sample educational illustrations and generate text descriptions for additional artwork. Automatic AI image creation is not a built-in GitHub Pages capability. Propose a secure image-generation backend separately; do not advertise it as finished or use exposed API keys.

## Audio
Use Web Speech API speechSynthesis where supported. Check voices, replay, slow speech, iOS initiation requirements, and clear fallback if unavailable. Do not pretend playback occurred when unsupported.

## Data model proposal
Student {id,displayName,grade}
Week {id,studentId,startDate,endDate,status:'draft'|'approved',sourceInfo,approvedAt,createdAt}
VocabularyItem {id,weekId,order,word,sourceDefinition,approvedDefinition,reviewFlags,exampleSentence,imageRef}
SpellingItem {id,weekId,order,word,patternGroup,exampleSentence}
Attempt {id,weekId,studentId,activity,mode,startedAt,submittedAt,answers,score,total,misses}

Store parent approval date and editing trail. All data owned by this app in browser storage should be exportable and restorable.

## Governance
Do architecture approval first; then code in small testable increments on `claude/build-v1`. Never merge or deploy until parent approval.
