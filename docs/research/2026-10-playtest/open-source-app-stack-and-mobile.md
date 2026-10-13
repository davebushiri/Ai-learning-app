<!-- Research commissioned by the founder on 2026-10-13 (thread 0006). Written by a research agent; saved by the lead. Stack changes need ADRs from the principal-architect. -->

# Open-source options for a modern UI, a modern backend and a path to mobile (2026-10-13)

**How licences were checked.**
- ✅ means checked this session against the npm registry, GitHub repo search (stars, last push, archived flag) or the raw LICENSE file.
- 🔎 means it comes from web search or prior knowledge; check it before relying on it.
- No repo files were edited.

**Licence flags at a glance:**
- **MPL-2.0:** `web-push` ✅ and `@capgo/capacitor-speech-recognition` ✅. MPL is weak copyleft at the file level and is not on our D15 allow-list.
- **FSL (source-available, not OSI open source):**
  - Sentry server is FSL-1.1-Apache-2.0 ✅.
  - PowerSync service is FSL-1.1-ALv2 ✅.
- **Custom terms:** Replicache, at roci.dev/terms ✅.
- **Open core with commercial folders:**
  - PostHog `ee/` ✅;
  - Langfuse `ee/` ✅;
  - GrowthBook `enterprise/` ✅;
  - RxDB premium plugins 🔎.
- **AGPL:** LibreLingo ✅ and Anki 🔎.
- **Archived (don't adopt):**
  - Pico CSS ✅;
  - Shoelace ✅ (it became Web Awesome);
  - Piper ✅.

## 1. Path to mobile

| Option | Licence / activity | Voice reality | One codebase? | Migration cost |
|---|---|---|---|---|
| **PWA as is** | n/a | **iOS:** Web Speech recognition works in Safari tabs (from 14.5), but **not in Home-Screen standalone PWAs or SFSafariViewController**. Feature detection passes and then nothing happens ([firt.dev](https://firt.dev/ios-14.5/), [WebKit 225298](https://bugs.webkit.org/show_bug.cgi?id=225298), [Apple forum 748048](https://developer.apple.com/forums/thread/748048)). Recognition goes through Apple's servers. iOS web push only works for installed apps (16.4+) 🔎. `speechSynthesis` works but needs a user gesture, and the voices vary 🔎. **Android Chrome:** Web Speech works (server-side). | Yes | 0 |
| **Capacitor** ([ionic-team/capacitor](https://github.com/ionic-team/capacitor)) | MIT ✅, 16.9k★, v8.5.3 (2026-10-07) | Runs inside WKWebView or Android WebView, and **neither exposes Web Speech recognition** ([WebKit 239816](https://bugs.webkit.org/show_bug.cgi?id=239816); Android WebView 🔎). So it **needs native plugins** (§4): SFSpeechRecognizer or SpeechAnalyzer (iOS 26+), Android SpeechRecognizer, AVSpeechSynthesizer. This is the most reliable voice that keeps the web UI. App Store and Play distribution. | Yes: the same `web/` folder is copied in, with no build required | Low. A new provider in `web/speech/`, plus Xcode and Android Studio projects. |
| **React Native / Expo** ([expo/expo](https://github.com/expo/expo)) | MIT ✅, 52.7k★, Expo SDK 57 (2026-10-12) | Native speech through community modules, `whisper.rn` (MIT ✅) and Expo push | No. The UI is rewritten in React Native (the game loop, screens and speech glue). `shared/` survives. | High (all of `web/`) |
| **Tauri 2 mobile** ([tauri-apps/tauri](https://github.com/tauri-apps/tauri)) | Apache-2.0 OR MIT ✅, 111.9k★ | Also a system WebView, so the same Web Speech gap as Capacitor. The mobile plugin ecosystem is thin and plugins are written in Rust, Swift and Kotlin 🔎. | Yes | Medium (Rust toolchain; fewer plugins) |
| **Flutter** ([flutter/flutter](https://github.com/flutter/flutter)) | BSD-3 ✅, 180k★ | Good native speech packages 🔎 | No. Dart rewrite, and `shared/` can't be reused. | Very high |

**Recommendation: PWA now, then Capacitor at the mobile phase.** Capacitor is the only option that keeps one codebase *and* gets native speech recognition on iOS. Because `web/speech/` is already a facade (`speak`, `listen`, `onHotword`, `cancel`), the native provider is a swap behind the facade, not a rewrite.

**Design implication for now:** iOS Home-Screen PWA users will have **no voice input**, so they need the Whisper/Moonshine fallback or text mode. The `mode-fallback` path (`voice-first.md`) must treat "detected but silent" as failure. Add a timeout-based check; don't trust `'webkitSpeechRecognition' in window`.

## 2. UI components, animation and framework choice

| Option | Licence / activity | Build needed? | Fit |
|---|---|---|---|
| **Web Awesome 3** ([shoelace-style/webawesome](https://github.com/shoelace-style/webawesome)) | MIT ✅ (free core; Pro is commercial 🔎), v3.14.0 (2026-09-24) | No (CDN or import map) | Web Components work with vanilla JS and with any later framework. **Shoelace is archived ✅**, so use Web Awesome. |
| **Open Props** | MIT ✅, 5.5k★, v1.7.23 | No | Design tokens (easing, shadows, gradients, animations) for a game-like feel. Pairs well with Web Awesome. |
| **Pico CSS** | MIT, **archived ✅** | No | Avoid. |
| **Ionic Framework** ([ionic-framework](https://github.com/ionic-team/ionic-framework)) | MIT ✅, 52.7k★, `@ionic/core` 9.0.7 | No: `@ionic/core` is Web Components and loads from a CDN 🔎 | Native-feel navigation, sheets and toasts. The best fit with Capacitor. Looks "app-like", not "game-like". |
| **Konsta UI** | MIT ✅, v5.5.0 | Yes (Tailwind + React, Vue or Svelte) | iOS/Material look. Only if we adopt Tailwind and a framework. |
| **shadcn/ui + Radix** | MIT 🔎 | Yes (React + Tailwind) | Polished, but forces React and a build. Overkill for about 8 screens. |
| **Tailwind v4** | MIT ✅, 4.3.3 | Yes (CLI) | Fine later. Not worth adding a build step for now. |
| **Motion** ([motiondivision/motion](https://github.com/motiondivision/motion)) | MIT ✅, 34k★, v14.2.0 (today) | No. `animate()` is vanilla JS. | Springs and timelines for score pops and streaks. Motion+ extras are paid 🔎. |
| **dotLottie-web** / lottie-web | MIT ✅ (`@lottiefiles/dotlottie-web` 0.81, active; `lottie-web` last released 2025-05) | No | Celebratory effects. Prefer dotLottie, which lottie-web's last release predates. |
| **Rive runtime** ([rive-app/rive-runtime](https://github.com/rive-app/rive-runtime), `@rive-app/canvas`) | Runtime MIT ✅ (v2.44.2, 2026-10-10). **The Rive editor is proprietary SaaS 🔎** (authoring lock-in, not a licence problem). | No | **Best mascot/avatar runtime.** State machines (idle, talking, "oops", celebrate) and a numeric input can drive mouth shapes from TTS boundary events. It has native runtimes for a later move. |

**Mascot:** Rive, with a Lottie fallback. No open-source mascot runtime beats it. Keep invariant 9: the mascot animates, but its caption is the exact spoken text.

**Build or no build: honest trade-offs**

*Stay no-build (vanilla + Web Components):*
- Pros: zero tooling, `shared/` runs unchanged, and Capacitor needs nothing more.
- Cons: hand-rolled state and rendering get messy beyond about 8 screens, and component tests are harder.

*Preact 11 + htm + @preact/signals:*
- Licences: Preact MIT ✅, released 2026-10-08; htm Apache-2.0 ✅. htm's last release was 2022, but it's tiny and stable.
- Pros: runs from an import map with **still no build**. You get components, signals and familiar JSX-like code for about 5 KB.
- Pros: it's the step `system-architecture.md` already names, and it can render Web Awesome and Ionic elements.

*Svelte 5 or Solid:*
- Licences: both MIT ✅.
- Pros: excellent developer experience and performance.
- Cons: both require a compiler/build.

*React:* only worth it if we go React Native, which we shouldn't.

**Recommendation:**
- Keep no-build. Adopt **Web Awesome + Open Props + Motion** now.
- Adopt **Preact + htm + signals via import map** at F2, or as soon as screens grow. It's incremental, one screen at a time, and needs no rewrite.
- Revisit Vite only at the mobile phase, and only if Ionic or an asset pipeline needs it.
- **This needs an ADR, because it amends D11.**

## 3. Backend features

| Area | Options (licence ✅ unless marked) | Fit and recommendation |
|---|---|---|
| **Auth** | **Better Auth** ([better-auth](https://github.com/better-auth/better-auth)), MIT, 30.3k★, v1.7.7: ships a `./node` handler for plain `http`, Kysely adapters for SQLite, and passkey/2FA/org plugins 🔎. It depends on `@better-auth/telemetry`, so confirm it's off. **SimpleWebAuthn**, MIT, v14.0.3: passkeys only, do it yourself. **Lucia** (MIT, 10.5k★): deprecated in 2025 and now a learning resource; its building blocks are `arctic` and `@oslojs` (MIT) 🔎. **Auth.js** (`@auth/core`, ISC): Next-oriented and now maintained by the Better Auth team 🔎. **Supabase Auth** or **PocketBase** only come with that whole BaaS. | **Better Auth** when a second user arrives (F2/F3). Check that it works with `node:sqlite`; its documented path is better-sqlite3 🔎. Keep `user_id` on events; auth tables sit outside the event log. **Needs an ADR.** |
| **Accounts and profiles** | Better Auth user table, plus our own `profile` projection | Profile and preferences are events, and the profile is a rebuildable projection (inv. 6). |
| **Sync and offline** | **Zero** (`rocicorp/mono`), Apache-2.0, needs Postgres. **Replicache**: custom terms ⚠. **ElectricSQL**, Apache-2.0, 10.4k★, needs Postgres. **PowerSync**: client Apache-2.0, **service FSL ⚠**. **RxDB**, Apache-2.0, 23.4k★; SQLite/Capacitor storage is premium 🔎. **cr-sqlite**, MIT, 3.8k★, activity slowing 🔎. **libSQL/Turso**, MIT, 17k / 24.7k★. **Dexie**, Apache-2.0. | **Don't adopt a sync engine.** They replicate server tables to clients, which works *against* inv. 2 (server-owned cards, answers never on the client). We need one-way, append-only upload. Build the planned offline queue: IndexedDB via Dexie (or `@capacitor-community/sqlite`, MIT, on mobile), client-generated event ids, and an idempotent `POST /events`. libSQL/Turso only if we need multi-region SQLite (`system-architecture.md` already says this). |
| **Push and reminders** (Q6) | **`web-push` npm: MPL-2.0 ⚠**. VAPID can be done in about 100 lines with `node:crypto`. **FCM** via `firebase-admin` (Apache 🔎) + `@capacitor/push-notifications`, MIT, 8.1.3. **`@capacitor/local-notifications`**, MIT: no server needed. Expo push needs Expo. | Q6 at F3: **local notifications first**, which need no backend. Server push later through FCM/APNs, or our own VAPID code to avoid MPL. |
| **Backend-as-a-service** | **Supabase**, Apache-2.0, 111k★, Postgres. **PocketBase**, MIT, 61k★, Go plus its own SQLite, pre-1.0. **Appwrite**, BSD-3, 57.7k★, Docker-heavy. | **Keep our Node server.** The gateway, server-owned cards, grading and event log are the product's core. A BaaS would duplicate them or force a rewrite of F1a. |
| **Payments (later)** | **Stripe** (`stripe` node SDK, MIT, v23). **RevenueCat**: `@revenuecat/purchases-capacitor` and `purchases-js` are MIT, but the service is proprietary SaaS. | Stripe for web. RevenueCat for App Store and Play in-app purchases, which digital learning content usually requires 🔎. Entitlements arrive as server-verified webhook events. |
| **Analytics and flags** | **PostHog**: MIT outside `ee/` ✅, 40k★; `posthog-js` Apache+MIT. **GrowthBook**: MIT outside `enterprise/` ✅, 8.5k★; SDK MIT. **OpenFeature** web SDK, Apache-2.0. **Unleash** client, Apache-2.0. | **Keep the pre-registered experiment in-house.** Do deterministic hash assignment on the server, log it as an event, and analyse from the event log. That keeps it reproducible and rebuildable. Add PostHog later for product funnels only. **Never send learner text or transcripts to it.** GrowthBook only if the experiment count grows. |
| **Error monitoring** | **Sentry SDKs** `@sentry/browser` / `@sentry/node`, MIT, v11.7.0. **Sentry server: FSL ⚠** (SaaS use is fine). **GlitchTip**, MIT ✅, accepts the Sentry SDK. | Sentry SDK pointed at Sentry SaaS or self-hosted GlitchTip, with `beforeSend` scrubbing of transcripts. Adopt before outside users. |
| **LLM observability** | **Langfuse**, MIT outside `ee/` ✅, 35.8k★, SDK MIT v3.39 | Already planned in the landscape doc: export from the gateway's `llm_call` log. No change. |

## 4. Voice stack for mobile

| Component | Licence / activity | Notes |
|---|---|---|
| `@capacitor-community/speech-recognition` | MIT ✅, but **v7.0.1, 2025-06**, while Capacitor is on v8 | Partial results; iOS Info.plist keys required. Stale, so it may need a fork. |
| `@capgo/capacitor-speech-recognition` | **MPL-2.0 ⚠**, v8.4.2 (today), 18★ | A fork of the community plugin with segmented sessions, punctuation, and an opt-in **iOS 26 on-device SpeechAnalyzer** path with fallback to SFSpeechRecognizer ([docs](https://capgo.app/docs/plugins/speech-recognition/)). Using it unmodified via npm is normally OK under MPL, but it needs a founder D15 exception. |
| `@capacitor-community/text-to-speech` | MIT ✅, v8.0.2 (2026-06) | AVSpeechSynthesizer and Android TTS. Use it for live feedback. |
| **sherpa-onnx** ([k2-fsa/sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx)) | Apache-2.0 ✅, 15.3k★, active | Offline STT, TTS (including Kokoro/VITS), **Silero VAD and keyword spotting** on iOS, Android and WASM. The strongest candidate for an on-device "stop" hotword on mobile. There's no Capacitor wrapper, so we'd write a thin plugin. |
| whisper.cpp | MIT ✅, 54.3k★ | Mature. `whisper.rn` (MIT) is React Native only. For Capacitor, use sherpa-onnx's Whisper/Moonshine or keep Transformers.js in the WebView. |
| Kokoro-82M | Apache-2.0 ✅ (`hexgrad/kokoro`, last push 2025-08) | Keep **server-side pre-rendered narration** (cached audio plays identically everywhere). On-device Kokoro through sherpa-onnx is optional. |
| VAD | `@ricky0123/vad-web`, ISC ✅ (works in a WebView); Silero in sherpa-onnx natively | |

**Recommendation:**
- Use native recognition and synthesis behind `web/speech/`.
- Write our own small MIT Capacitor plugin for recognition (fork the community plugin's Swift and Kotlin) rather than take the MPL dependency. Alternatively, ask the founder for an MPL exception.
- **Spike before committing:** barge-in "stop" while TTS is playing on an iPhone. It needs the AVAudioSession `playAndRecord` mode with echo cancellation 🔎. Also test SFSpeechRecognizer's per-request duration limits and rate limits 🔎.

## 5. Starters and templates to fork

| Project | Licence | Verdict |
|---|---|---|
| Anki / AnkiDroid | AGPL / GPL 🔎 | Not usable |
| LibreLingo | **AGPL-3.0 ✅** | Not usable |
| olmps/memo (Flutter SRS) | BSD-3 ✅, 1.9k★, last push 2024-07 | Stale, and a different stack. Study only. |
| ionic-conference-app / ionic-react-conference-app | MIT ✅, 3.6k / 526★, active | Reference for Ionic and Capacitor navigation and native setup. Don't fork. |
| pwa-builder/pwa-starter (Lit + Vite) | Licence not verified (no LICENSE at root) | Study only. **PWABuilder** (3.8k★) is useful for packaging the PWA to Play (TWA) and the Microsoft Store as an interim step. |
| Workbox | MIT ✅ | Already in the landscape doc |

**Verdict: fork nothing.** No permissive starter matches our loop, and F1a already has a better foundation than any of them.

## 6. Target stack and migration path

**Target:**
- the current Node `http` server, gateway, SQLite event log and `shared/`, unchanged;
- a web UI of vanilla JS, then Preact + htm via import map, with Web Awesome, Open Props, Motion and a Rive mascot;
- Capacitor for iOS and Android;
- native speech plugins behind `web/speech/`;
- Better Auth;
- the offline queue (Dexie or Capacitor SQLite) plus idempotent event upload;
- Sentry SDK, Langfuse and, later, PostHog;
- local notifications, then FCM/APNs;
- Stripe and RevenueCat later.

| Phase | Adopt | Touches F1a? | ADR? |
|---|---|---|---|
| **Now (F1)** | Nothing structural. Make sure `web/speech/` detects "API present but silent" (iOS standalone PWAs) and falls back. | No | No |
| **F2** | Web Awesome + Open Props + Motion. Preact + htm + signals (import map, no build), screen by screen. Rive mascot spike. Sentry SDK pointed at GlitchTip or SaaS. | No (only `web/`) | **Yes:** amend D11 (UI libraries and Preact) |
| **F2/F3** | Better Auth once there's a second user; `user_id` on events. Offline queue with client event ids and an idempotent `POST`. Local-notification reminders (Q6). | Additive routes and an event field | **Yes:** auth/accounts. **Yes:** event schema v2 if `user_id` or client ids change ADR 0002. |
| **Mobile** | Capacitor 8; native recognition (our own MIT plugin, or Capgo with an exception); community TTS plugin; sherpa-onnx "stop" spike; FCM/APNs push; RevenueCat. | No. Server routes, gateway and event log are unchanged. | **Yes:** mobile shell (Capacitor over React Native and Flutter). **Yes** if any MPL/FSL dependency is accepted (D15 exception). |

**Rejected:**
- a sync engine (conflicts with inv. 2; most need Postgres);
- a BaaS (duplicates the core);
- React Native / Flutter (they discard `web/`);
- running the A/B experiment in a third-party flag tool (its results must be rebuildable from our event log).

**Sources:**
- npm registry and GitHub search/raw LICENSE files, checked 2026-10-13
- [firt.dev iOS 14.5](https://firt.dev/ios-14.5/)
- [WebKit 225298](https://bugs.webkit.org/show_bug.cgi?id=225298), [239816](https://bugs.webkit.org/show_bug.cgi?id=239816)
- [Apple forum 748048](https://developer.apple.com/forums/thread/748048)
- [MagicBell iOS PWA guide](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide)
- [Capgo speech recognition docs](https://capgo.app/docs/plugins/speech-recognition/)
- [capacitor-community/speech-recognition](https://github.com/capacitor-community/speech-recognition)
