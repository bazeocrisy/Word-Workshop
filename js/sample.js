// Load the bundled sample lists (sample-data/*.json) into a week as UNVERIFIED drafts.
// Nothing is approved; the planning-phase review flags are kept; sentences are labelled as generated.
import { newVocabItem, newSpellingItem } from './model.js';
import { suggestGroups } from './spelling.js';

async function json(path) {
  const r = await fetch(path, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`Could not load ${path}.`);
  return r.json();
}

export async function sampleItems() {
  const [vocab, spelling, sentences, pictures] = await Promise.all([
    json('sample-data/vocabulary.json'), json('sample-data/spelling.json'), json('sample-data/sample-sentences.json'),
    json('assets/illustrations/sample/index.json').catch(() => ({})),
  ]);
  const vocabItems = [...vocab.items].sort((a, b) => a.order - b.order).map((it) => {
    const v = newVocabItem({
      word: it.word, definition: it.sourceDefinition, origin: 'sample', importedFlags: it.reviewFlags || [],
      sentence: sentences.vocabulary[it.word] || '', sentenceSource: 'generated',
    });
    const pic = pictures[it.word.toLowerCase()];
    if (pic) v.image = { ref: `sample:${pic.file}`, kind: 'sample', alt: pic.alt };
    return v;
  });
  const spellingItems = [...spelling.words].sort((a, b) => a.order - b.order).map((it) => {
    const s = newSpellingItem({ word: it.word, origin: 'sample', sentence: sentences.spelling[it.word] || '', sentenceSource: 'generated' });
    s.groups = suggestGroups(it.word);
    return s;
  });
  return {
    vocab: vocabItems, spelling: spellingItems, focus: spelling.focus || '',
    source: { kind: 'sample', at: new Date().toISOString(), note: `${vocab.source}; ${spelling.source}` },
  };
}
