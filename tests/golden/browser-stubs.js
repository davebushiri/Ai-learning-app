// Speech stubs for the golden harness (F1a-T03a timing contract, item 2).
// Injected with page.addInitScript before any page script runs.
//
// - speechSynthesis.speak() records the text and HOLDS the utterance: it never
//   ends on its own. The harness ends the head utterance with
//   window.__golden.release(), so "STOP while line N is being spoken" is a DOM
//   state, not a race.
// - cancel() ends the held utterances with the events Chromium fires: the one
//   being spoken gets `error` with error "interrupted", queued ones get
//   `error` with error "canceled".
// - SpeechRecognition is always present (so the mic button and its messages
//   don't depend on the machine). The harness dictates with
//   window.__golden.dictate(text); stop() then ends recognition like Chromium
//   (a final `end` event).
(() => {
  const spoken = [];
  const queue = []; // held utterances; queue[0] is "being spoken"
  let recognitions = [];

  function fire(target, ev) {
    target.dispatchEvent(ev); // runs onX handler properties and listeners
  }

  function startHead() {
    const u = queue[0];
    if (u) fire(u, new SpeechSynthesisEvent('start', { utterance: u, charIndex: 0, elapsedTime: 0 }));
  }

  const synth = new EventTarget();
  Object.assign(synth, {
    onvoiceschanged: null,
    speak(u) {
      spoken.push(String(u.text));
      queue.push(u);
      if (queue.length === 1) startHead();
    },
    cancel() {
      const held = queue.splice(0);
      held.forEach((u, i) => fire(u, new SpeechSynthesisErrorEvent('error', {
        utterance: u, charIndex: 0, elapsedTime: 0, error: i === 0 ? 'interrupted' : 'canceled'
      })));
    },
    pause() {},
    resume() {},
    getVoices: () => []
  });
  Object.defineProperties(synth, {
    speaking: { get: () => queue.length > 0 },
    pending: { get: () => queue.length > 1 },
    paused: { get: () => false }
  });
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });

  class FakeRecognition extends EventTarget {
    constructor() {
      super();
      this.lang = '';
      this.interimResults = false;
      this.continuous = false;
      this.onresult = this.onerror = this.onend = this.onstart = null;
      this.running = false;
    }
    _emit(type, extra = {}) {
      const ev = new Event(type);
      for (const [k, v] of Object.entries(extra)) Object.defineProperty(ev, k, { value: v });
      this.dispatchEvent(ev);
      this['on' + type]?.call(this, ev);
    }
    start() {
      this.running = true;
      recognitions.push(this);
      this._emit('start');
    }
    stop() {
      if (!this.running) return;
      this.running = false;
      recognitions = recognitions.filter(r => r !== this);
      this._emit('end');
    }
    abort() {
      if (!this.running) return;
      this._emit('error', { error: 'aborted' });
      this.stop();
    }
  }
  Object.defineProperty(window, 'SpeechRecognition', { value: FakeRecognition, configurable: true });
  Object.defineProperty(window, 'webkitSpeechRecognition', { value: FakeRecognition, configurable: true });

  window.__golden = {
    spoken,
    held: () => queue.length,
    // Ends the utterance being spoken, as if it finished normally.
    release() {
      const u = queue.shift();
      if (!u) return false;
      fire(u, new SpeechSynthesisEvent('end', { utterance: u, charIndex: 0, elapsedTime: 0 }));
      startHead();
      return true;
    },
    listening: () => recognitions.length,
    // One final result with the whole transcript, delivered to the active recognition.
    dictate(text) {
      const rec = recognitions[recognitions.length - 1];
      if (!rec) return false;
      if (!text) return true; // silence: nothing is recognised
      const alt = { transcript: text, confidence: 0.9 };
      const result = Object.assign([alt], { isFinal: true });
      rec._emit('result', { resultIndex: 0, results: [result] });
      return true;
    }
  };
})();
