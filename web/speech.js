// Browser speech: text-to-speech for the apprentice, speech-to-text for the learner.
// Speech recognition only works reliably in Chrome/Edge; the UI always keeps a text box.

const synth = window.speechSynthesis;
let voice = null;

function pickVoice() {
  const voices = synth?.getVoices() ?? [];
  voice = voices.find(v => /en-US/i.test(v.lang) && /male|guy|david|alex/i.test(v.name))
    ?? voices.find(v => /en-US/i.test(v.lang))
    ?? voices[0]
    ?? null;
}
if (synth) {
  pickVoice();
  synth.onvoiceschanged = pickVoice;
}

// Speak `text`. Resolves when finished or cancelled. Falls back to a
// reading-time delay when voice is off or unsupported.
export function speak(text, { enabled = true, rate = 1.05 } = {}) {
  if (!enabled || !synth) return wait(readingTimeMs(text));
  return new Promise(resolve => {
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.rate = rate;
    u.onend = u.onerror = () => resolve();
    synth.speak(u);
  });
}

let cancelWait = null;

// Cuts off speech and any pending wait() so STOP feels instant.
export function stopSpeaking() {
  synth?.cancel();
  cancelWait?.();
}

export function wait(ms) {
  return new Promise(resolve => {
    const t = setTimeout(done, ms);
    function done() { clearTimeout(t); cancelWait = null; resolve(); }
    cancelWait = done;
  });
}

function readingTimeMs(text) {
  return Math.max(1500, text.split(/\s+/).length * 330);
}

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
export const canListen = Boolean(Recognition);

// Start listening. Returns { stop, result } where `result` resolves with the
// final transcript. `onInterim` gets live partial text for the textbox.
export function listen({ onInterim } = {}) {
  const rec = new Recognition();
  rec.lang = 'en-US';
  rec.interimResults = true;
  rec.continuous = true;
  let finalText = '';
  const result = new Promise((resolve, reject) => {
    rec.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript + ' ';
        else interim += r[0].transcript;
      }
      onInterim?.((finalText + interim).trim());
    };
    rec.onerror = e => (e.error === 'no-speech' || e.error === 'aborted' ? resolve(finalText.trim()) : reject(e.error));
    rec.onend = () => resolve(finalText.trim());
  });
  rec.start();
  return { stop: () => rec.stop(), result };
}
