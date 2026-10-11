import { h, page } from '../ui.js';
import { speechSupported, getVoice, speakButton, RATES } from '../speech.js';

export async function speechTest() {
  const ok = speechSupported();
  const voice = ok ? await getVoice() : null;
  const voices = ok ? (speechSynthesis.getVoices() || []).filter((v) => /^en/i.test(v.lang)) : [];
  return page({ title: 'Test the voice', back: '#/parent/settings', backLabel: 'Settings', cls: 'parent' },
    h('div', { class: `card notice ${ok ? '' : 'notice-warn'}` },
      ok ? h('p', null, voice ? `This device will use the voice "${voice.name}" (${voice.lang}).` : 'This device will use its default voice.')
        : h('p', null, 'This browser cannot speak words aloud. Spelling practice and tests will show a "grown-up reads aloud" option instead.'),
      ok ? h('p', { class: 'hint' }, `${voices.length} English voice${voices.length === 1 ? '' : 's'} found. On iPhone and iPad, turn off the silent switch and turn the volume up.`) : null),
    ok ? h('div', { class: 'row' },
      speakButton('Normal speed', () => 'stepped. I stepped over the puddle on the sidewalk.', { rate: RATES.normal, cls: 'btn-primary' }),
      speakButton('Slow', () => 'stepped. I stepped over the puddle on the sidewalk.', { rate: RATES.slow })) : null);
}
