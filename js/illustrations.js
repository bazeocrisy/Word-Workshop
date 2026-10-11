// Vocabulary pictures.
// Today: parent-uploaded pictures and bundled sample illustrations, both approved with the week.
// Picture ideas: a child-safe description the parent can draw from or paste into a tool they already use.
//
// FUTURE AUTOMATIC GENERATION — integration point (NOT ENABLED, nothing here contacts any service):
// A generator must run on a server the owner controls (e.g. a small Cloudflare Worker) that holds the API key.
// The browser would call `generateIllustration()` below with only the word, approved definition and grade;
// the server returns an image, which is stored as { kind: 'generated' } and still needs parent approval
// like any other picture. No API key may ever be placed in this repository or in browser code.
// See docs/ILLUSTRATIONS.md.
import { displayDefinition } from './model.js';

export const GENERATION = Object.freeze({ enabled: false, endpoint: null });

export function picturePrompt(item, grade) {
  const def = displayDefinition(item).text;
  const who = grade ? `a grade ${grade} student` : 'an elementary school student';
  const scene = item.sentence ? ` Show a scene like: "${item.sentence}"` : '';
  return [
    `A simple, friendly, colourful cartoon picture that helps ${who} remember the word "${item.word}", which means: ${def}.${scene}`,
    'Make the meaning obvious at a glance. Kind, everyday setting. No words, letters or numbers in the picture.',
    'Nothing scary, no real people, no brand names.',
  ].join('\n');
}

/** Future server call. Disabled: throws so no code path can silently pretend a picture was generated. */
export async function generateIllustration() {
  throw new Error('Automatic picture generation is not set up. It needs a separate, owner-approved server; see docs/ILLUSTRATIONS.md.');
}

/** What a student card shows when there is no approved picture: an honest placeholder, not a fake illustration. */
export function fallbackLabel() { return 'Picture coming soon'; }
