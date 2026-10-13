<!-- Research commissioned by the founder on 2026-10-13 (thread 0006). Written by a research agent; saved by the lead. -->

# Narration voice research report

## 0. What the code does now (web/speech.js)

There are two problems in `web/speech.js`, and both can be fixed now at no cost.

- **`pickVoice()` actively picks older voices.** The regex `/male|guy|david|alex/` prefers Microsoft David on Windows and Alex on macOS. Both are older, robotic-sounding voices.
  - The regex is also buggy: "male" matches "Female", so the gender filter does nothing.
  - Otherwise it takes the first `en-US` voice, which is usually the lowest-quality one installed.
- **Long lines are not split up.** Each line is spoken as one utterance. Chrome's network "Google …" voices are known to cut off after about 15 seconds or 200–300 characters, often silently (Chromium bug 679437). If we start preferring Google voices, we must speak one sentence per utterance.

## 1. Learning science on voice

| Claim | Evidence | Strength |
|---|---|---|
| A human voice beats a machine voice (Mayer's voice principle) | 4 of 4 comparisons, median d≈0.8. All used early-2000s synthesisers. | Moderate, but dated |
| Modern TTS closes the gap | Mayer & DaPra 2012: no learning difference between human and modern synthetic voice. Craig & Schroeder (J. Educ. Computing Research, about 2017–19): a modern engine matched a human voice on learning and credibility, and beat an old engine on transfer. Dinçer 2022 compared human, old-machine and modern-machine voices. | Moderate. Several small studies; I found no meta-analysis. |
| Enthusiasm and emotional prosody raise learning | Mixed. One study found an enthusiastic human narrator improved transfer. A study with 244 learners using Alexa's enthusiasm levels found lower cognitive load but no gain in performance. Zhao & Mayer 2021 found emotional synthetic voices had no consistent effect on learning. | Weak and mixed |
| Speech rate | Comprehension holds up to about 275 wpm (Foulke & Sticht). UCLA (Murphy et al.) found little loss up to 2× playback. Normal speech is about 150 wpm. | Moderate |
| Accent | Most studies found no learning penalty, but learners rated foreign-accented speakers lower, and one study found a transfer advantage for a standard accent. | Weak |
| Gender | An ASU thesis tested male and female classic and modern synthetic voices and found no effect. | Weak (small n) |

**What this means for us:**
- The robotic quality is what plausibly costs learning and attention. Once a voice sounds natural, its gender and accent barely matter, so letting the learner choose is safe.
- Learners do judge a voice they dislike, which is an engagement risk.
- Default to a natural voice with neutral-to-warm prosody at about 1.0×. Let learners speed it up.
- Don't spend money on "emotional" TTS for learning gains.
- Our own experiment can test this. Log the voice and engine with each event, so voice can be a covariate or an A/B arm.

## 2. TTS options compared

| Option | Quality | Latency | Cost | Licence | Offline / browser |
|---|---|---|---|---|---|
| Browser `speechSynthesis`, best voice on the device | Varies by device. Good: macOS/iOS "Enhanced" and "Premium" voices (the user must download them in Settings), Edge's "Microsoft … Online (Natural)" voices, Chrome's "Google US English". Bad: old SAPI and eSpeak voices. | Near zero | Free | Built into the OS | Local voices work offline. Google and Edge Natural voices need the network (`localService=false`). Android Chrome returns a poor voice list. |
| Kokoro-82M in the browser (kokoro-js) | High. It was #1 on TTS Arena at launch. 28 English voices (20 US, 8 UK). | First load downloads about 86–92 MB (q8, WASM) or about 310 MB (fp32, WebGPU), then it is cached. Unverified blog figures: roughly real time on WASM, 1.5–6× real time on WebGPU. Weak phones will be slow. | Free | Apache-2.0 code and weights | Fully offline after the first load. Streams sentence by sentence (`TextSplitterStream`). |
| Kokoro on the server (Node `cpu`, or Python) | Same as in the browser | Community reports range from about 5× to over 30× real time on CPU, and about 100× on GPU. Pre-render the card narration once and cache it. | Hosting CPU only | Apache-2.0 | Cached audio files work offline through Workbox. |
| Google Cloud TTS | Standard/WaveNet are good; Neural2 and Chirp 3 HD are very good | Low (cloud) | $4 (Standard/WaveNet), $16 (Neural2), $30 (Chirp HD) per 1M characters, with a free monthly allowance | Proprietary API | Online only |
| Azure Neural | Very good | Low | $15 per 1M characters (Neural), $22 (HD) | Proprietary | Online |
| Amazon Polly | Standard is poor; Neural and Generative are good | Low | $4 (Standard), $16 (Neural), $30 (Generative) per 1M characters | Proprietary | Online |
| OpenAI TTS | Very good | Low | $15 per 1M characters (tts-1), $30 (tts-1-hd). gpt-4o-mini-tts is billed by token, about $16 per 1M characters by one estimate. | Proprietary | Online |
| ElevenLabs | Best expressiveness | Low (Flash) | About $40–50 (Flash) to $80–100 (v2/v3) per 1M characters; sources conflict | Proprietary | Online |
| Cartesia | Very good, very low latency | Lowest | Credit plans: $39/month for 1.25M credits, $239/month for 8M | Proprietary | Online |
| Deepgram Aura-2 (a bonus option) | Good | Low | $30 per 1M characters | Proprietary | Online |

Cloud prices come from 2026 comparison blogs, the most recent dated 2026-10-08, and they conflict. **Check the vendors' own pricing pages before committing.** Piper stays excluded because it is GPL.

**Fit with our invariants:**
- Kokoro and cloud APIs both say exactly the text they are given, so spoken text still equals displayed text (inv. 9). Key the audio cache on a hash of the exact text plus the voice, so cached audio can never drift from what is displayed.
- A cloud TTS call is effectively an AI call. It should go through the gateway pattern (inv. 3), with a deadline, logging, and **fallback to browser `speechSynthesis`** that the user can see (inv. 7).
- STOP must stay instant: `audio.pause()` is instant, just like `synth.cancel()`. Make `stopSpeaking()` stop both.

## 3. Voice-picker design

1. **Listing voices.** Call `getVoices()`, then listen for `voiceschanged`, because Chrome fills the list asynchronously.
   - Filter by `lang` to the pack's language family.
   - Hide the macOS novelty voices: Albert, Bad News, Bells, Boing, Bubbles, Cellos, Good News, Jester, Organ, Superstar, Trinoids, Whisper, Wobble, Zarvox.
   - Group the list into "Natural", "Standard" and "Needs internet" (`localService=false`).
   - Once Kokoro ships, list its voices as a separate engine.
2. **Default ranking.** Score voice names in this order: "Natural", "Neural", "Premium", "Enhanced", "Google", then any other local voice. Penalise known older voices (David, Zira, Alex, eSpeak).
   - Prefer a local voice when offline.
   - This alone fixes most of the "robotic" complaint.
3. **Controls.**
   - Rate slider from 0.8 to 1.5×, default 1.0. The research supports letting people speed up.
   - Pitch hidden under "advanced" and default 1.0, because moving pitch away from 1.0 makes voices sound more robotic.
   - A **Preview** button that speaks a fixed sample sentence.
4. **Remembering the choice.** Save `{engine, voiceURI, name, lang, rate, pitch}` in localStorage, wrapped in try/catch, and in the user profile on the server so it follows the learner. Optionally append a `voice_pref_set` event, which keeps the event log the source of truth and supports the experiment covariate.
5. **When the saved voice isn't on this device.** `voiceURI` and `name` behave differently across browsers. Try matches in this order:
   1. exact `voiceURI`;
   2. exact `name`;
   3. the same name stem (for example "Samantha" in "Samantha (Enhanced)");
   4. the same `lang` from the ranked list;
   5. the default.

   Show a quiet note such as "Your voice 'X' isn't on this device; using Y", which is visible degradation (inv. 7). Save preferences per device and keep a separate global default.
6. **Hands-free and text.** The picker is reachable by keyboard and screen reader. Spoken commands can be added later ("faster", "slower", "next voice"). Turning voice off still falls back to the reading-time delay already in `speak()`.

## 4. Recommendation: a staged plan

**Stage A (now, free, about a day of work).** Do this first; it is the best value.
- Replace `pickVoice` with the ranker above.
- Speak one sentence per utterance (this fixes the Chrome cutoff).
- Add the picker: voice, rate, preview and persistence.
- Tell testers to install a macOS or iOS Premium voice, or to use Edge.

**Stage B (next, free).** Use Kokoro for **card narration**, as the landscape doc already plans.
- Pre-render each card's narration **on the server** with kokoro-js on the Node CPU path. Cache it as audio files and serve them through Workbox.
- This gives every device, including weak phones and Android, the same high-quality voice without a 90–300 MB browser download.
- Keep live feedback on browser TTS. Optionally offer Kokoro in the browser as an opt-in "high-quality offline voice" for desktop Chrome or Edge with WebGPU.
- Gate it with the doc's existing criterion: under 20 s per card on the server, and the founder prefers it to the browser voice.

**Stage C (pay only if needed).** A paid API is worth it in three cases:
- Kokoro feedback latency on the server is too slow for live, personalised feedback;
- we need languages or accents Kokoro lacks;
- a blind preference test of Kokoro against a cloud voice clearly favours the cloud voice.

Start with Google Neural2, Azure Neural or OpenAI tts-1 (about $15–16 per 1M characters). Choose ElevenLabs or Cartesia only if expressiveness or sub-100 ms latency proves to matter.

**Rough cost for the founder plus 20 testers.** These rest on my own assumptions:
- about 20k characters per session (narration plus feedback);
- 21 people doing 20 sessions a month, which is about 8.4M characters a month uncached.

| Engine | Monthly cost |
|---|---|
| Browser TTS or Kokoro (Stages A and B) | $0, plus about $5–25 for a small server |
| Google/Polly Standard ($4 per 1M) | About $35 |
| OpenAI, Azure or Neural2 (about $15 per 1M) | About $125–135 |
| ElevenLabs ($40–100 per 1M) | About $340–840 |

Caching card narration (Stage B) means only feedback is billed, which cuts these figures by more than half. At 5 sessions a month per person, divide by 4.

## Sources
- Voice principle: [Cambridge Handbook chapter](https://www.cambridge.org/core/books/abs/cambridge-handbook-of-multimedia-learning/principles-of-multimedia-learning-based-on-social-cues-personalization-voice-and-image-principles/19309D764FD015A556334531A463DE03), [ReadSpeaker e-learning voices summary](https://0-www-readspeaker-com.midhudsonlibraries.org/blog/elearning-voice), [ReadSpeaker synthetic voices white paper](https://0-assets--www-readspeaker-com.midhudsonlibraries.org/uploads/The-Promise-of-Synthetic-Voices_IT.pdf), [Dinçer 2022](https://doaj.org/article/a14435a205f54240bdd0b0db2fa06f91), [Education and Information Technologies 2022](https://www.doi.org/10.1007/s10639-022-11255-6)
- Enthusiasm and prosody: [Emerald, ILS 2020](https://emerald.com/insight/content/doi/10.1108/ILS-11-2019-0124/full/html), [Zhao & Mayer, APS 2021](https://www.psychologicalscience.org/conventions/archive/2021icps/paper/34371/), [MMU study](https://shdl.mmu.edu.my/10430/)
- Speech rate: [The Debrief on the UCLA study](https://thedebrief.org/speed-learning-is-possible-but-up-to-a-point/), [DTIC compressed-speech report](https://apps.dtic.mil/sti/pdfs/AD0701150.pdf)
- Accent and gender: [UC eScholarship accent study](https://escholarship.org/uc/item/7pv8512s), [SIU dissertation](https://opensiuc.lib.siu.edu/dissertations/803), [ASU gender thesis](https://keep.lib.asu.edu/system/files/c7/220468/Lefevre_asu_0010N_19540.pdf), [Gunadarma "Role of speaker's voice"](https://library.gunadarma.ac.id/journal/social-cues-in-multimedia-learning-role-of-speakers-voice)
- Browser speech: [Flavio Copes, Speech Synthesis API](https://flaviocopes.com/speech-synthesis-api/), [`localService` reference](https://reference.codeproject.com/dom/SpeechSynthesisVoice/localService), [PhET Chrome cutoff issue](https://github.com/phetsims/utterance-queue/issues/60), [Caktus "The Halting Problem"](https://www.caktusgroup.com/blog/2025/11/03/the-halting-problem/), [Readium WebSpeech notes](https://readium.org/speech/docs/WebSpeech.html) (I couldn't load this page; its content comes from a search summary)
- Kokoro: [kokoro.js README](https://github.com/hexgrad/kokoro/tree/main/kokoro.js), [npm kokoro-js](https://www.npmjs.com/package/kokoro-js), [Replicate model card](https://replicate.com/kjjk10/kokoro-82m), [offlinetts guide](https://offlinetts.com/blog/kokoro-tts-complete-guide/), [Hacker News thread with xenova](https://hn.svelte.dev/item/42973769)
- Pricing: [Inventive HQ cost calculator](https://inventivehq.com/tools/developer/tts-stt-api-cost-calculator), [Novita 2026 comparison](https://blogs.novita.ai/best-text-to-speech-api-2026/), [Gradium pricing guide](https://gradium.ai/content/how-to-compare-tts-pricing-across-providers-2026), [Fora Soft on ElevenLabs alternatives](https://www.forasoft.com/blog/article/elevenlabs-alternatives)

**Caveats:**
- The Kokoro speed figures come from blogs, not measurements. Benchmark on our own devices before relying on them.
- The year of the Craig & Schroeder paper is uncertain (2017 or 2019); check it before citing.
- I couldn't confirm whether Safari shows downloaded Premium and Enhanced voices in `getVoices()`. Test on a real device.
