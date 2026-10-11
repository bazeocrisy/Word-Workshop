import { route, fallback, start, render, whenRendered } from './router.js';
import * as store from './store.js';
import * as model from './model.js';
import * as db from './db.js';
import { h } from './ui.js';
import { homeView } from './views/home.js';
import { studentHome, weekHome } from './views/student.js';
import { parentDashboard, settingsView } from './views/parent.js';
import { backupView } from './views/backupView.js';
import { notFoundPage, parentOnly } from './views/common.js';

const lazy = (path, name) => async (ctx) => (await import(path))[name](ctx);

// Student
route('/', homeView);
route('/s/:sid', studentHome);
route('/s/:sid/results', lazy('./views/results.js', 'studentResults'));
route('/s/:sid/w/:wid', weekHome);
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
route('/parent/settings', parentOnly(settingsView));
route('/parent/backup', parentOnly(backupView));
route('/parent/speech', parentOnly(lazy('./views/speechTest.js', 'speechTest')));
route('/parent/results/:sid', parentOnly(lazy('./views/results.js', 'parentResults')));
route('/parent/week/:wid', parentOnly(lazy('./views/weekEditor.js', 'weekEditor')));
route('/parent/week/:wid/import', parentOnly(lazy('./views/importView.js', 'importView')));
fallback(notFoundPage);

// Exposed for the automated browser tests and for debugging. Not used by the app itself.
window.WW = { store, model, db, render, whenRendered };

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
