# Claude Code handoff — Word Workshop

You are the implementation engineer. ChatGPT handles product planning, educational requirements, and independent audit; parent owns approval.

Repository: https://github.com/bazeocrisy/Word-Workshop
Work exclusively on `claude/build-v1` (create locally tracking the remote branch). Never merge to main or deploy unless parent explicitly approves.

Read all documents under `docs/` and `sample-data/` before touching code.

FIRST task: inspect repo, review requirements and fixtures, and produce:
1. Proposed frontend stack and architecture
2. UX flow / wireframes
3. Local storage/backup design
4. Photo OCR feasibility with these real screenshots
5. Illustrated vocabulary card path without client-exposed secrets
6. Milestone list with test gates and risks

STOP for parent approval after architecture proposal. Do not start app implementation on the first run.

Important: exact teacher definitions are immutable source text unless manually approved by parent. Do not replace with dictionary meanings even if suspicious. OCR can hallucinate/miss content and requires review. Sample data is a human transcription from photographs and is flagged as unverified.

For implementation after approval: prefer one builder and an independent reviewer. Run test suites, maintain `docs/STATUS.md` as checkpoints, and report commits/results. No automatic publishing.
