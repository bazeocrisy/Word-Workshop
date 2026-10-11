// In-page snippets shared by browser suites.

/** Create a week for the first student from the sample data, review everything, approve. Sets window.__S / __W. */
export const APPROVED_SAMPLE = `
  const st = (await WW.store.listStudents())[0];
  const w = await WW.store.createWeek(st.id, { startDate: '2026-10-12', endDate: '2026-10-16' });
  const { sampleItems } = await import('./js/sample.js');
  const s = await sampleItems();
  await WW.store.editWeek(w.id, (x) => {
    x.vocab = s.vocab; x.spelling = s.spelling; x.focus = s.focus;
    for (const it of x.vocab) { it.reviewed = true; it.ackKeys = WW.model.vocabFlags(it, x).map((f) => f.key); }
    for (const it of x.spelling) { it.reviewed = true; it.ackKeys = WW.model.spellingFlags(it, x).map((f) => f.key); }
  }, { action: 'test setup' });
  await WW.store.approveWeek(w.id);
  window.__S = st.id; window.__W = w.id;
  return { sid: st.id, wid: w.id };
`;

/** Rebuild the current vocab session's questions from its saved seed (the answer key is never in the page). */
export const CURRENT_VOCAB_QUESTIONS = `
  const [hpath, hq = ''] = location.hash.split('?');
  const qp = new URLSearchParams(hq);
  const mode = hpath.endsWith('/test') ? 'test' : 'practice';
  const activity = qp.get('type');
  const suffix = ':vocab:' + mode + ':' + activity + ':' + (qp.get('only') || '');
  const key = Object.keys(sessionStorage).find((k) => k.startsWith('ww-quiz:') && k.endsWith(suffix));
  const d = JSON.parse(sessionStorage.getItem(key));
  const only = qp.get('only') ? qp.get('only').split(',') : null;
  const snap = await WW.store.getApprovedLesson(window.__W);
  const { buildActivity } = await import('./js/vocab.js');
  const qs = buildActivity(activity, snap.vocab, { seed: d.seed, only }).questions;
`;
