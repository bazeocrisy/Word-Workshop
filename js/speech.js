// Text-to-speech with the browser's built-in speechSynthesis.
// Rules: speak only from a tap/click (required on iPhone/iPad); never show "playing" unless the browser
// actually started speaking; say clearly when sound is not available.
import { h } from './ui.js';

export const RATES = { normal: 0.9, slow: 0.6 };
const START_TIMEOUT = 4000;

export function speechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function' && !!window.speechSynthesis;
}

let voicePromise = null;
let cachedVoice; // undefined until voices have been looked up
/** Resolve the best English voice (or null to use the browser default). Voices load asynchronously. */
export function getVoice() {
  if (!speechSupported()) return Promise.resolve(null);
  if (voicePromise) return voicePromise;
  voicePromise = new Promise((resolve) => {
    const pick = () => {
      const voices = speechSynthesis.getVoices() || [];
      if (!voices.length) return false;
      const en = voices.filter((v) => /^en[-_]?/i.test(v.lang));
      const pref = ['en-US', 'en-GB', 'en-AU', 'en-CA'];
      const byLang = (l) => en.filter((v) => v.lang.replace('_', '-') === l);
      // Prefer voices that run on the device; an online voice would send the words to the voice provider.
      const local = (list) => list.find((v) => v.localService) || null;
      cachedVoice = pref.map(byLang).map(local).find(Boolean) || local(en) || null; // null → the browser's default voice
      resolve(cachedVoice);
      return true;
    };
    if (pick()) return;
    const onChange = () => { if (pick()) speechSynthesis.removeEventListener?.('voiceschanged', onChange); };
    speechSynthesis.addEventListener?.('voiceschanged', onChange);
    setTimeout(() => { if (cachedVoice === undefined) cachedVoice = null; resolve(null); }, 1500); // some browsers never fire voiceschanged; the default voice still works
  });
  return voicePromise;
}

/**
 * Speak text. Resolves 'done' after speech ends, 'unsupported', 'error', or 'no-start' (the browser did not
 * begin speaking — e.g. no voices installed, or iOS blocked it). `onStart` fires only when speech really starts.
 */
export async function speak(text, { rate = RATES.normal, onStart } = {}) {
  if (!speechSupported()) return 'unsupported';
  // Use the remembered voice without waiting, so speech starts inside the tap (iOS); otherwise look it up.
  const voice = cachedVoice !== undefined ? cachedVoice : await getVoice();
  return new Promise((resolve) => {
    try { speechSynthesis.cancel(); } catch { /* ignore */ }
    const u = new SpeechSynthesisUtterance(String(text));
    if (voice) u.voice = voice;
    u.lang = voice ? voice.lang : 'en-US';
    u.rate = rate;
    let started = false;
    const timer = setTimeout(() => { if (!started) { try { speechSynthesis.cancel(); } catch { /* ignore */ } resolve('no-start'); } }, START_TIMEOUT);
    u.onstart = () => { started = true; clearTimeout(timer); if (onStart) onStart(); };
    u.onend = () => { clearTimeout(timer); resolve(started ? 'done' : 'no-start'); };
    u.onerror = (e) => { clearTimeout(timer); resolve(e && (e.error === 'interrupted' || e.error === 'canceled') ? 'done' : 'error'); };
    try { speechSynthesis.speak(u); } catch { clearTimeout(timer); resolve('error'); }
  });
}

export function stopSpeaking() { if (speechSupported()) { try { speechSynthesis.cancel(); } catch { /* ignore */ } } }

/**
 * A "hear it" button. `getText()` is called on tap (so the text is never placed in the page). The status line
 * reports honestly: "Playing…" only after speech starts; an explanation if it could not play.
 */
export function speakButton(label, getText, { rate = RATES.normal, cls = 'btn-ghost', ariaLabel } = {}) {
  const status = h('span', { class: 'speak-status', 'aria-live': 'polite' });
  if (!speechSupported()) {
    return h('span', { class: 'speak-wrap' }, h('button', { type: 'button', class: `btn ${cls}`, disabled: true, 'aria-label': `${ariaLabel || label} (sound is not available on this device)` }, '🔇 ', label));
  }
  const b = h('button', { type: 'button', class: `btn ${cls} speak-btn`, 'aria-label': ariaLabel || label }, h('span', { 'aria-hidden': 'true' }, '🔊 '), label);
  b.addEventListener('click', async () => {
    status.textContent = '';
    b.classList.remove('speaking');
    const r = await speak(getText(), { rate, onStart: () => { b.classList.add('speaking'); status.textContent = 'Playing…'; } });
    b.classList.remove('speaking');
    status.textContent = r === 'done' ? '' : r === 'no-start'
      ? 'The sound did not play. Check the volume and silent switch, then try again.'
      : 'The sound could not play on this device.';
  });
  return h('span', { class: 'speak-wrap' }, b, status);
}
