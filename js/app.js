import { route, fallback, start, render, whenRendered } from './router.js';
import * as store from './store.js';
import * as model from './model.js';
import * as db from './db.js';
import { h } from './ui.js';
import { homeView } from './views/home.js';
import { studentHub, vocabHub, spellingHub, weekChooser } from './views/hub.js';
import { parentDashboard, settingsView, resultsIndex } from './views/parent.js';
import { backupView } from './views/backupView.js';
import { notFoundPage, parentOnly } from './views/common.js';

const lazy = (path, name) => async (ctx) => (await import(path))[name](ctx);

// Student: pick a name, then four areas (Vocabulary, Spelling, Reading Passage, Sentence Fix)
route('/', homeView);
route('/s/:sid', studentHub);
route('/s/:sid/vocab', vocabHub);
route('/s/:sid/spelling', spellingHub);
route('/s/:sid/add/:subject', lazy('./views/studentAdd.js', 'studentAdd'));
route('/s/:sid/reading', lazy('./views/reading.js', 'readingList'));
route('/s/:sid/reading/add', lazy('./views/reading.js', 'readingAdd'));
route('/s/:sid/reading/:pid', lazy('./views/reading.js', 'readingView'));
route('/s/:sid/sentence-fix', lazy('./views/sentencefix.js', 'sfMenu'));
route('/s/:sid/sentence-fix/learn', lazy('./views/sentencefix.js', 'sfLearn'));
route('/s/:sid/sentence-fix/practice', lazy('./views/sentencefix.js', 'sfPractice'));
route('/s/:sid/sentence-fix/lab', lazy('./views/sentencefix.js', 'sfLab'));
route('/s/:sid/sentence-fix/test', lazy('./views/sentencefix.js', 'sfTest'));
route('/s/:sid/sentence-fix/results', lazy('./views/sentencefix.js', 'sfResults'));
route('/s/:sid/sentence-fix/results/:tid', lazy('./views/sentencefix.js', 'sfResult'));
route('/s/:sid/results', lazy('./views/results.js', 'studentResults'));
route('/s/:sid/w/:wid', weekChooser);
route('/s/:sid/w/:wid/vocab/crossword', lazy('./views/crosswordView.js', 'crosswordView'));
route('/s/:sid/w/:wid/spell/build', lazy('./views/wordBuildView.js', 'wordBuildView'));
route('/s/:sid/w/:wid/vocab/study', lazy('./views/vocabStudy.js', 'vocabStudy'));
route('/s/:sid/w/:wid/vocab/practice', lazy('./views/quiz.js', 'vocabPractice'));
route('/s/:sid/w/:wid/vocab/test', lazy('./views/quiz.js', 'vocabTest'));
route('/s/:sid/w/:wid/spell/study', lazy('./views/spellStudy.js', 'spellStudy'));
route('/s/:sid/w/:wid/spell/practice', lazy('./views/spellQuiz.js', 'spellPractice'));
route('/s/:sid/w/:wid/spell/test', lazy('./views/spellQuiz.js', 'spellTest'));
route('/s/:sid/attempt/:aid', lazy('./views/results.js', 'attemptView'));
// Printing (approved content only)
route('/print/:wid', lazy('./views/print.js', 'printWeek'));
route('/print/results/:sid', lazy('./views/print.js', 'printResults'));
// Parent
route('/parent', parentOnly(parentDashboard));
// The lesson workspace: Add → Check → Finish on one screen (views/workspace.js)
const workspace = lazy('./views/workspace.js', 'lessonWorkspace');
route('/parent/new', parentOnly(workspace));
route('/parent/lesson/:wid', parentOnly(workspace));
// Addresses from the earlier four-step wizard open the matching stage.
for (const old of ['start', 'words', 'review', 'approve']) {
  route(`/parent/week/:wid/${old}`, parentOnly((ctx) => workspace({ ...ctx, query: { ...ctx.query, stage: { start: 'add', words: 'add', review: 'check', approve: 'finish' }[old] } })));
}
route('/parent/results', parentOnly(resultsIndex));
route('/parent/settings', parentOnly(settingsView));
route('/parent/backup', parentOnly(backupView));
route('/parent/speech', parentOnly(lazy('./views/speechTest.js', 'speechTest')));
route('/parent/results/:sid', parentOnly(lazy('./views/results.js', 'parentResults')));
route('/parent/week/:wid', parentOnly(lazy('./views/weekEditor.js', 'weekEditor')));
route('/parent/week/:wid/import', parentOnly(lazy('./views/importView.js', 'importView')));
fallback(notFoundPage);

// Exposed for the automated browser tests and for debugging. Not used by the app itself.
window.WW = { store, model, db, render, whenRendered };

// The skip link must not change the hash (the router would treat '#app' as a page).
document.querySelector('.skip-link')?.addEventListener('click', (e) => { e.preventDefault(); document.getElementById('app').focus(); });

async function boot() {
  try {
    await store.ensureSetup();
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  } catch (e) {
    document.getElementById('app').replaceChildren(h('section', { class: 'page' }, h('h1', null, 'Word Workshop cannot save data here'),
      h('p', null, e.message), h('p', null, 'Try a normal (not private) browser window, or another browser.')));
    window.WW.ready = true;
    return;
  }
  await start();
  window.WW.ready = true;
}
boot();
