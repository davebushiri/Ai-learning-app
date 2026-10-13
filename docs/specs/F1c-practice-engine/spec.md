# F1c: Practice engine, Applied AI track module 1

**Status:** Draft (awaiting learning-designer review, then principal-architect design review)
**Phase:** F1 (interrupt priority, founder direction in [thread 0007](../../team/threads/0007-applied-ai-aws-track.md)) | **Links:** [user-flow.md](../../foundation/user-flow.md), [data-and-evidence.md](../../foundation/data-and-evidence.md), [voice-first.md](../../foundation/voice-first.md), ADRs [0001](../../adr/0001-sqlite-storage-and-append-only-event-log.md)–[0006](../../adr/0006-pack-format-v1.md)
**Revision:** 1 (2026-10-13)

## Problem
The founder has a 60-minute technical interview on AI fluency (RAG, agents, embeddings, production evidence) this week or next. The only working loop is the trades game. It has one mode, needs exactly 3 mistakes per card, has no mastery and still leaks answers on its legacy route. F1c adds a **separate, server-owned practice engine** that runs the Applied AI track, module 1 (LLM foundations and RAG), in four modes. It grades offline, because there is no API key. The founder's constraints are small increments, reuse, no rebuild, and nothing that takes over the founder's preparation time.

## Isolation from the existing game (binding)
- **New surface only:** `web/practice.html`, `web/practice/*.js`, `web/practice/practice.css`, routes under `/api/practice/*`, `server/routes/practice*.js`, `server/services/practice*.js` and content in `packs/applied-ai/`.
- **Untouched:** `web/app.js`, `web/index.html`, `web/api.js`, `web/styles.css`, `server/routes/{health,scenarios,grade}.js`, `server/services/{assessment,content,ai-client}.js`, `server/prompts/*`, `server/ai/*`, `shared/{mock-grader,scoring,contract,pack}.js` and `packs/demo-trades/**`. The F1a golden replay (61 runs) and F1a Wave 2 tickets are therefore unaffected. Wave 2 stays on hold.
- **Additive edits to shared infrastructure, one ticket each:**
  - `server/index.js`: route registration and the practice loader call;
  - `shared/events.js`: three new verbs;
  - `server/db.js`: one new read function.
- **Reused as-is:** `web/speech.js` (`speak`, `stopSpeaking`, `wait`, `canListen`, `listen`), `server/db.js` (`appendEvents`, `eventsForAttempt`, `putPack`), `server/http.js` (`readBody`, `sendJson`, `HttpError`, static serving), `shared/events.js` (`makeEvent`, `newId`, `validateEvent`), and the loader pattern of `server/packs.js` (validate first, skip with a warning, canonical JSON, immutable per version, deep freeze, `Map` registry). The `shared/mock-grader.js` matching techniques are reimplemented, not imported. Its module still holds subject synonyms, and its signature is card-shaped. See [ARCH-5].
- **No prompt, no gateway call, no model routing change.** Invariants 3 and 4 are untouched, and the eval gate is not triggered.

## Exercise schema (practice pack format v1) [ARCH DECISION NEEDED: ARCH-3]
All pack text is untrusted (ADR 0006). It is validated before use and rendered as text only.

**Layout**
```
packs/applied-ai/
  practice.json              # manifest (never named pack.json; see ARCH-1)
  schedule.json
  exercises/<exerciseId>.json
  reference/<referenceId>.md # trusted reference: never contains a flawed statement
```

**Manifest `practice.json`**
```jsonc
{ "format": "practice-v1", "id": "applied-ai", "version": 1, "title": "Applied AI",
  "modules": [{ "id": "m1-llm-rag", "title": "LLM foundations and RAG", "exercises": ["<exerciseId>", "…"] }],
  "lexicon": { "synonyms": { "<term>": ["<form>", "…"] } },   // optional; matched as data, never in a prompt
  "provenance": { "builtBy": "<who>" } }
```

**Common exercise fields (all required unless marked optional)**
| Field | Type | Rule |
|---|---|---|
| `id` | string | `^[a-z0-9-]{1,60}$`, equals the file name without `.json`, unique in the pack |
| `module` | string | a `modules[].id` in the manifest that lists this exercise |
| `type` | `"learn" \| "catch" \| "scenario" \| "interview"` | |
| `objective` | string | ≤ 300 chars, shown before the attempt |
| `prerequisites` | string[] | exercise ids in this pack (may be empty); shown, not enforced |
| `difficulty` | 1 \| 2 \| 3 | |
| `concepts` | string[] | ≥ 1 id `^[a-z0-9-]{1,60}$`; mastery keys |
| `referenceIds` | string[] | ≥ 1; each `reference/<id>.md` exists |
| `sources` | `[{title, url, verified: boolean}]` | ≥ 1; `url` starts with `https://` |
| `followUp` | `{question, rubric: string[]}` or a string | a string is self-rated only (never matched). Content rule: it MUST probe failure modes or trade-offs |
| `transfer` | `{scenario: string, rubric: string[]}` | rubric ≥ 1 item |

**`catch`**
```jsonc
"narration": [{ "id": "s1", "text": "…" }],      // 1–20 statements, ids unique ^[a-z0-9-]{1,20}$
"answerKey": {
  "planted": [{                                    // 0..n; zero planted is allowed
    "statementId": "s3",
    "misconception": "…",                          // the authored misconception; never model output
    "whyWrong": "…",
    "acceptableCorrections": ["…", "…"],           // ≥ 1; [0] is a complete sentence that replaces the statement
    "exceptions": "…",                             // when the statement would be true; "" if none
    "kind": "overgeneralization",                  // ^[a-z0-9-]{1,40}$
    "rubric": { "explain": ["…"], "correct": ["…"] } // each ≥ 1 item
  }],
  "clean": ["s1", "s2", "s4"] }
```
Every narration id appears in exactly one of `planted[].statementId` and `clean`.

**`learn`:** `narration` (as in catch; no answer key), plus `teachBack: [{question, rubric: string[]}]` (≥ 1).

**`scenario`**
```jsonc
"brief": "…", "constraints": ["…"],
"clarifications": [{ "askAbout": ["…"], "reveal": "…" }],
"acceptableArchitectures": [{ "id": "…", "summary": "…", "mustInclude": ["…"] }],   // ≥ 1
"challenges": [{ "question": "…", "rubric": ["…"] }],                               // ≥ 1
"rubric": { "mustCover": ["…"], "strongSignals": ["…"], "redFlags": ["…"] }
```

**`interview`:** `question`, `rubric: {mustCover[] (≥ 1), strongSignals[], redFlags[]}`, `followUps: [{question, rubric: string[]}]` (≥ 1).

The draft's bare `followUp` string, bare `acceptableArchitectures[]`, `challenges[]` and `followUps[]` strings, and the scenario `rubric` are formalized above so that each one can be matched. The content author must use these shapes (OQ-4).

**Caps (validator):**
- strings ≤ 2000 chars;
- ≤ 20 items per array, except `narration` ≤ 20 and `exercises` ≤ 100;
- reference files ≤ 50 KB;
- `lexicon.synonyms` ≤ 200 terms × 20 forms.

**Reference integrity check:** the normalized text of every `planted` statement must not appear, as a substring, in the normalized text of any reference file that the exercise lists. This heuristic is automated; human review still applies.

**`schedule.json`**
```jsonc
{ "days": 7, "minutesPerDay": 120,
  "diagnostic": ["<exerciseId>", "…"],                        // 1–6 exercises, run on day 1
  "plan": [{ "day": 1, "blocks": [{ "kind": "diagnostic" | "learn" | "catch" | "scenario" | "interview" | "review",
                                    "minutes": 30, "exercises": ["<exerciseId>"] }] }] }   // exercises omitted for review/diagnostic
```
Rules: `plan` has exactly `days` entries numbered `1..days`. Each day's minutes sum to `minutesPerDay`. Practice kinds (`catch`, `scenario`, `interview`, `review`) are ≥ 60% of total minutes ("mostly practice"; a provisional product choice). The defaults are 7 days × 120 min.

## User stories (prioritized; each independently testable)

### US1: Catch-and-correct in text mode (P1) — first usable loop
The learner opens `/practice.html`, picks the track and a catch exercise, and reads statements appearing at reading pace. They press **Stop** (or Space) on a wrong statement and type what's wrong and the correct version. They see per-dimension feedback and the corrected statement, then continue. At the end they see what they missed, the reference and rubric, and rate themselves.
**Why P1:** this is the core practice the founder needs this week. Everything else builds on it.
**Independent test:** with only F1c-T02–T05 merged, a catch exercise from the fixture pack completes keyboard-only, and its events rebuild the result.
**Acceptance scenarios (text mode; the voice twins are in US2):**
1. Given the picker, when the learner starts a catch exercise, then `POST /api/practice/attempts` returns narration `{id, text}` only, and no response before grading contains any hidden key (FR-004).
2. Given statement `s3` is planted, when the learner stops on `s3` and submits an answer covering the rubric, then detection is `hit`, explanation and correction are `met`, and the copy `fb.hit.met` plus `say.corrected` appear. Narration then continues at `s4`.
3. Given `s2` is clean, when the learner stops on `s2`, then detection is `false_interruption`, the copy `fb.false` appears, nothing about any other statement is returned, and narration restarts `s2` from its beginning.
4. Given the stop lands 1500 ms into `s4` and `s3` is planted and uncaught, then the stop is attributed to `s3` (`late_hit`), and `s4` is re-shown from its start after feedback (FR-012).
5. Given an answer with valid alternative wording that matches an `acceptableCorrections` entry but not `rubric.correct`, then correction is `met` (FR-020).
6. Given a long answer (≥ 20 content words) that matches no rubric item, then the dimension is `uncertain`, the copy shows "Uncertain: flagged for review", and no score is shown (FR-021).
7. Given the narration ends, when complete is called, then missed planted statements are revealed with `whyWrong` and `correctedText`, followed by the reference (as text), sources (unverified ones marked "(not yet verified)") and each answered stop's rubric with matched and missing items. The learner can rate each answered stop "I had it", "Partly" or "I missed it" (FR-016).
8. Given a zero-planted exercise and no stops, when complete is called, then `cleanPass: true` and the copy `end.clean` appears.
9. Given the learner presses "Show the reference (counts as assisted)" mid-narration, then the reference appears, and every later graded stop in this attempt has `assisted: true`. Earlier stops keep `assisted: false` (FR-015).
10. Given the stop request fails at the network level, then `err.net` appears, the typed answer is kept, and "Try again" re-posts it idempotently (FR-008).

### US2: Catch-and-correct in voice mode (P1)
The same loop, hands-free: statements are spoken. Saying "stop" cuts speech immediately, and the learner dictates into an editable transcript, then says "send". Feedback and the corrected statement are spoken, and narration resumes.
**Why P1:** voice-first is invariant 8. It is how the founder practises away from the desk.
**Independent test:** in e2e with the speech stubs, a full catch exercise completes with no clicks after Start.
**Acceptance scenarios (voice mode):**
1. Given narration is speaking `s3`, when the recognizer yields an interim result containing "stop", then `speechSynthesis.cancel()` is called within 300 ms (fake clock), `s3` stays highlighted as the interrupted statement, and listening for the answer starts (FR-030, FR-031).
2. Given dictation is in progress, when the learner edits the textarea, then dictation stops and the typed edit is kept. Nothing is submitted until "send", the Submit button or Enter (FR-033).
3. Given a final recognition segment equal to "send" or "send it", then that word is removed from the answer and the answer is submitted (FR-034).
4. Given a hit, then the feedback text is spoken exactly as displayed, followed by "Corrected: {correctedText}", and narration resumes at the next statement (FR-035, inv. 9).
5. Given a late hit, then after feedback the interrupted statement is spoken again from its start.
6. Given the current statement's own text contains a hotword phrase, then the hotword fires only if a recognition segment consists of the phrase alone (FR-032).
7. Given speech recognition is unavailable or permission is denied, then `mic.denied` is shown and spoken, the session continues in text mode, and the Stop button and Space keep working (FR-036).
8. Given voice mode, then the Stop button and Space still stop narration at any time.

### US3: Learn mode with teach-back (P2)
The learner hears (voice) or reads (text) an error-free explanation. They answer each teach-back question by voice or text. After the last answer they see the rubric and reference, rate themselves, then answer the follow-up and transfer questions.
**Independent test:** a learn exercise completes in voice mode and in text mode, writing one `graded` per teach-back question.
**Acceptance scenarios:**
1. Given voice mode, when the narration ends, then "Teach it back: {question}" is spoken and shown, and listening starts. Given text mode, the same prompt is shown with a focused textarea.
2. Given learn mode, then no Stop control is shown and there is no hotword. "pause" / "resume" are Later.
3. Given each answer, the response contains `next` (the next question, or `null`) and no result. Results, the rubric and the reference arrive at complete (FR-041).

### US4: Technical interview format (P2)
The learner gets an interview question, answers by voice or text, then answers each follow-up in turn. At complete they see mustCover, strongSignals and redFlags with their matches, and rate themselves.
**Independent test:** an interview exercise in both modes yields an `explanation` dimension from mustCover and a `defense` dimension per follow-up.
**Acceptance scenarios:**
1. Voice: the question is spoken as "Interview question: {question}". Text: it is shown. Each answer returns the next follow-up as `next.prompt`, with no grading feedback until complete.
2. Given an answer that matches a `redFlags` item, then that dimension is `uncertain` (never `met`), and the red flag is listed at reveal (FR-022).

### US5: Customer scenario (P2)
The learner reads or hears a brief and constraints. They ask clarifying questions, and each matching clarification is revealed once. They say "ready" (voice) or press Ready (text), describe a design, and answer the customer's challenges. They get results at complete.
**Independent test:** a scenario exercise in both modes; one clarification revealed by a matching question; a non-matching question gets `clarify.none`.
**Acceptance scenarios:**
1. Given a question that matches an `askAbout` term, then `Customer: {reveal}` is shown and spoken. Asking again returns the same reveal and writes one more `clarified` event.
2. Given a design answer that matches no `acceptableArchitectures[].mustInclude` set, then the explanation status is at most `partial`. If the answer has ≥ 20 content words and matches nothing, the status is `uncertain` (FR-021, FR-043).

### US6: Progress, schedule, diagnostic and review weaknesses (P3)
The learner sees today's plan (day N of 7) from `schedule.json`. They can run the diagnostic (no assist) and see per-concept mastery (independent and assisted shown separately), readiness criteria, and a flagged-for-review list with self-ratings. "Review weak spots" starts the exercise for the weakest concept.
**Independent test:** after a scripted set of attempts, `GET …/progress` equals a frozen expected projection, and the same projection results after a server restart.
**Acceptance scenarios:**
1. Given no practice events yet, then the progress page shows Day 1 and the diagnostic block first. Voice: the page title and today's blocks are spoken. Text: they are shown.
2. Given an assisted `met` and an independent `not_met` on the same concept, then `independent.score` is 0 and `assisted.score` is 1. They are never merged (FR-052).
3. Given a diagnostic attempt, then the assist control is absent, and `POST …/assist` returns 400.
4. Given "Review weak spots", then the exercise started is the least recently attempted exercise covering the lowest-scoring independent concept (FR-056).
5. Every readiness panel shows the copy `progress.provisional`.

## Spoken copy (exact; shown text equals spoken text unless marked "shown only")
`{x}` comes from the pack or the server and is rendered with `textContent`. These strings live in `web/practice/copy.js` (F1c-T05 creates it; later tickets append).

| id | Text (shown and spoken) | When |
|---|---|---|
| `picker.empty` | No practice tracks are loaded. | `GET /api/practice/tracks` returns `[]` |
| `intro.catch` | Listen for statements that are wrong. Say "stop", press Stop or press Space when you hear one. Some sets have no errors. | Before catch narration (text mode: shown only; "say" is still listed) |
| `intro.learn` | Listen to the explanation. Afterwards you'll teach it back. | Before learn narration |
| `prompt.stop` | What's wrong, and what should it say? | After a STOP |
| `fb.hit.met` | Good catch. {whyWrong} | Hit, overall `met` |
| `fb.hit.partial` | You caught it. Here's the full picture: {whyWrong} | Hit, overall `partial` |
| `fb.hit.not_met` | Right statement to stop on. Here's why it's wrong: {whyWrong} | Hit, overall `not_met` |
| `fb.hit.uncertain` | Right statement to stop on. I can't score your answer reliably, so it's flagged for review. {whyWrong} | Hit, overall `uncertain` |
| `fb.late.prefix` | That was the previous statement. | Prepended (with one space) to any `fb.hit.*` on a late hit |
| `fb.false` | That statement is accurate. Let's carry on. | False interruption |
| `say.corrected` | Corrected: {correctedText} | After a hit's feedback, before resuming; also shown under the statement |
| `btn.assist` | Show the reference (counts as assisted) | Button label (shown only) |
| `assist.spoken` | The reference is on screen. Answers from here on count as assisted. | After assist |
| `end.catch` | That's the end of the set. | Narration finished |
| `sum.line` | Caught {hits} of {planted}. Missed {misses}. Stopped on {f} accurate statement. / …{f} accurate statements. | Reveal (singular only when f = 1) |
| `end.clean` | This set had no errors, and you didn't stop on any accurate statement. Well judged. | `cleanPass: true` |
| `missed.item` | Missed: {text} {whyWrong} Corrected: {correctedText} | Each missed planted statement |
| `status.met` / `.partial` / `.not_met` / `.uncertain` | Covered / Partly covered / Not covered / Uncertain: flagged for review | Status labels |
| `dim.*` | Explanation / Correction / Transfer / Trade-offs / Defense, rendered as "{dim}: {status}" | Dimension rows in feedback and reveal. Spoken after the feedback text, one per row |
| `selfrate.prompt` | Compare your answer with the reference. How did you do? | Per answered part at reveal |
| `selfrate.options` | I had it / Partly / I missed it | Buttons. Voice: "had it", "partly", "missed it" |
| `q.teachBack` | Teach it back: {question} | Learn |
| `q.interview` | Interview question: {question} | Interview |
| `q.followUp` | Follow-up: {question} | Interview follow-ups and the common follow-up |
| `q.transfer` | New situation: {scenario} | Transfer |
| `sc.brief` | Customer brief: {brief} Constraints: {c1}; {c2}. Ask the customer anything, or say "ready" when you want to give your design. | Scenario start (text mode: "or press Ready") |
| `sc.reveal` | Customer: {reveal} | Clarification matched |
| `clarify.none` | The customer doesn't have more on that. | No match |
| `sc.design` | Describe your design. | After "ready" |
| `sc.challenge` | The customer pushes back: {question} | Each challenge |
| `err.net` | Couldn't reach the server. Your answer is still here. Try again, or skip and this stop won't be scored. | Stop request failed; buttons "Try again", "Skip this stop" ("Skip" not shown for non-stop answers) |
| `mic.denied` | The microphone isn't available. Type your answer instead. | No recognizer, permission denied, or 3 recognizer errors in a row |
| `src.unverified` | (not yet verified) | Shown only, after a source with `verified: false` |
| `progress.provisional` | Readiness thresholds are a provisional product choice. | Progress page, shown and spoken on open |
| `done` | Done. Your progress is saved. | After transfer |

**Voice commands (matched before anything is treated as an answer, only in the listed state):**

| Command | State |
|---|---|
| "stop", "hold on" | Narrating (catch) |
| "send", "send it" | Answering. Must be the whole final segment |
| "done" | Answering. Stops dictation without submitting |
| "continue" | Feedback |
| "had it", "partly", "missed it" | Self-rating |
| "ready" | Scenario clarifying |

**Text mode:** Stop button or Space · Enter submits (Shift+Enter inserts a newline) · buttons for everything else.

**Repair paths:**
- **Misheard answer:** edit the transcript, or press "Talk again", which replaces the text.
- **Hotword missed:** the button and Space always work.
- **Wrong stop:** a false interruption costs nothing beyond the count.
- **Grade looks wrong:** self-rate "I missed it" or "I had it". The disagreement is recorded for κ.
- **Network failure:** "Try again" or "Skip this stop".
- **Mic failure:** automatic switch to text mode.

## Edge cases
- **Unknown track or exercise** → 404 `{error}`. **Unknown attempt** → 404. **Bad JSON** → 400. **Body over 1 MB** → 413 (`readBody`).
- **Stop on an unknown `statementId`** → 400. **Stop on a statement earlier than the last graded stop** → 400. **Stop on the same `statementId` as an already-graded stop** → 200 with the stored body, and no new events. **Stop after complete** → 409. **Stop on a non-catch attempt** → 400.
- **Answer text:** empty → allowed, and all dimensions are `not_met`. Over 2000 chars → truncated server-side, and `explained.result.chars` holds the original length.
- **`elapsedMs` missing, negative or non-integer** → treated as a large value (no grace attribution). It is a client claim, an accepted risk as in ADR 0003.
- **Grace attribution only applies** if the previous statement is planted and uncaught. A stop in the gap after the last statement is attributed to the last statement.
- **Early complete** (the learner leaves mid-narration): planted statements after `lastStatementId` are `notReached`, never `missed`.
- **Invalid practice pack:**
  - The server starts, logs one `[practice] <dir> skipped: <reasons>` warning, and `GET /api/practice/tracks` omits it.
  - The old game's `/api/subjects` is unchanged in every case.
  - A changed pack without a version bump is refused (immutability, as in ADR 0006).
- **Reference markdown** is shown with `textContent` in a `white-space: pre-wrap` block. HTML in it appears as literal text.
- **Self-rating:** before complete, or for a part with no learner answer (a miss) → 400. Repeat ratings append, and the latest wins in projections.
- **Hotword echo:** TTS audio heard by the mic. Handled by FR-032. Headphones are recommended in the intro help text (shown only).
- **Assist is idempotent.** A second call returns the same reference and writes no second `assisted` event.
- **A concept with no exercise that can satisfy a readiness criterion** shows that criterion as "n/a" (FR-054). It is never counted as met.

## Functional requirements

**Content and loading**
- **FR-001:** `validatePracticePack(manifest, files)` MUST apply every schema rule and cap above. It returns a list of problems, never throws, and accepts zero-planted catch exercises. The old `validateScenario` (exactly 3 mistakes) is unchanged and is not used by this engine.
- **FR-002:** `loadPracticePacks(dir)` MUST load every `packs/<dir>/practice.json` at startup, before listen, using the `server/packs.js` pattern:
  - validate first, then skip with one `[practice]` warning;
  - deep-freeze;
  - use `Map` registries;
  - store canonical JSON of the manifest, schedule, exercises and references through `db.putPack`, and refuse on `'conflict'`.
  - A directory without `practice.json` is ignored silently by this loader.
  - The directory defaults to `packs/`, and `PRACTICE_PACKS_DIR` overrides it, so tests can load fixture packs.
- **FR-003:** Engine code (`server/**/practice*`, `web/practice*`) MUST contain no subject words. It passes the deny-list test with the Applied AI words added (F1c-T01a) and an unchanged allow-list.

**Server owns answers**
- **FR-004:** Every response before grading MUST be built by the allow-list projection `toPublicExercise(ex)`. It MUST NOT contain, at any depth, the keys `answerKey`, `planted`, `clean`, `misconception`, `whyWrong`, `acceptableCorrections`, `exceptions`, `kind`, `rubric`, `explain`, `correct`, `mustCover`, `strongSignals`, `redFlags`, `clarifications`, `askAbout`, `reveal`, `acceptableArchitectures`, `mustInclude`, `challenges`, `followUps`, `followUp`, `transfer`, `reference`, `sources` or `correctedText`.
  - **Exceptions:**
    - a hit's stop response carries `reveal` for that statement only;
    - `answers.next.prompt` and `exercise.firstPrompt` carry question text only;
    - the `assist` response carries `reference` because the learner asked for it, and from then on the attempt is assisted;
    - `complete` and later responses carry the reveal.
- **FR-005:** The browser MUST NOT import any module under `server/` or `shared/mock-grader.js`, and MUST NOT compute detection, dimensions or attribution.

**Catch attempt API** (shapes in tasks.md F1c-T04)
- **FR-006:** `POST /api/practice/attempts` MUST create an attempt `pra_<ULID>`, write `started` and return `{attemptId, exercise, assistAllowed}`.
- **FR-007:** `POST /api/practice/attempts/:id/stops` MUST:
  - resolve attribution (FR-012);
  - grade a hit with the matcher;
  - write `stopped`, `explained` and `graded` in one `appendEvents` call, after grading;
  - return the stop response.
  - Order and replay rules are as in the edge cases. Grading is synchronous, so no in-flight state exists.
- **FR-008:** A repeated stop on the same `statementId` MUST return a body identical to the first, and write no events.
- **FR-009:** `POST /api/practice/attempts/:id/complete` MUST be idempotent. It writes `completed` once, and returns the summary, missed reveals, answered parts with results and rubrics, references, sources, `followUp.question` and `transfer.scenario`.
- **FR-010:** On a hit, the stop response MUST include `reveal: {statementId, misconception, whyWrong, exceptions, correctedText}`, where `correctedText = acceptableCorrections[0]`, and `result: {explanation, correction, overall}`. On a false interruption, `reveal` and `result` are `null`.
- **FR-011:** `overall` MUST be:
  - `uncertain` if either dimension is uncertain;
  - otherwise `met` if both are met;
  - otherwise `not_met` if both are not met;
  - otherwise `partial`.
- **FR-012 (grace window):** if the stopped statement is clean or already caught, the previous statement is planted and uncaught, and `0 ≤ elapsedMs ≤ GRACE_MS`, the stop MUST be attributed to the previous statement with detection `late_hit`.
  - `GRACE_MS = 2000` is a named constant (provisional product choice).
  - Otherwise detection is `hit` (the stopped statement is planted and uncaught) or `false_interruption`.

**Offline assessment (the matcher)**
- **FR-013:** The matcher MUST report each dimension separately as `{status: "met" | "partial" | "not_met" | "uncertain", matched: string[], missing: string[]}`.
  - **Dimensions:**
    - `detection` (`hit` / `late_hit` / `miss` / `false_interruption`, counted per attempt);
    - `explanation`;
    - `correction`;
    - `transfer`;
    - `tradeoffs` (the common follow-up);
    - `defense` (interview follow-ups and scenario challenges).
  - It never returns a numeric score to the client.
- **FR-014:** Each `graded.result` MUST record `graderSource: "matcher"` and `graderVersion` (`MATCHER_VERSION`, e.g. `"matcher@1"`). Any change to matcher rules bumps it.
- **FR-015:** After `POST …/assist` (only when `mode ≠ diagnostic`), every later `graded` in the attempt MUST carry `assisted: true`. Earlier ones keep `false`. No hint, reference or correction is sent before an answer unless assist was requested.
- **FR-016:** `POST …/self-ratings {part, rating: "had_it" | "partly" | "missed_it"}` MUST write `self-rated` with the matcher's `overall` (or dimension status) for that part copied into `result.matcherStatus`. This allows κ to be computed from single events.
- **FR-017 (item match):** a rubric item MUST count as matched when at least `ceil(0.6 × n)` of its n content tokens appear in the answer. Items with n ≤ 2 need all of them.
  - **Content tokens:** stopword-free tokens of ≥ 2 chars.
  - **Token match:** matched at word start with light stemming (the mock-grader technique). Each token may also be satisfied by any of its pack `lexicon.synonyms` forms.
  - The matched forms are removed before the stuffing check.
- **FR-018 (status):**
  - `met` if matched items ≥ `ceil(0.67 × items)`;
  - `partial` if ≥ 1 item matched;
  - `not_met` if none matched and the answer has < 20 content words.
  - Answers with < 3 content words are `not_met`.
  - All ratios and counts are named constants in `MATCHER_RULES` (provisional).
- **FR-019 (stuffing):** if ≤ 2 content words remain after removing matched forms, the status MUST be capped at `partial`.
- **FR-020 (alternatives):**
  - `correction` is `met` if `rubric.correct` is met, or if any one `acceptableCorrections` entry, treated as a single item, is matched.
  - A scenario design is matched against each `acceptableArchitectures[].mustInclude` set, and the best one counts.
  - Wording is never penalized: no length, order or phrasing rule exists beyond FR-017–FR-022.
- **FR-021 (uncertain):** the dimension MUST be `uncertain`, with confidence `low` and no score, when any of these holds:
  - (a) none matched and the answer has ≥ 20 content words;
  - (b) a negator (`not`, `no`, `never`, `isnt`, `doesnt`, `dont`, `cannot`, `cant`, `wont`, `without`) occurs within 3 tokens before a matched token;
  - (c) the answer covers ≥ 80% of the content tokens of the flawed statement's text, and no correction alternative is matched.
- **FR-022:** an answer that matches any `redFlags` item MUST make its dimension `uncertain`, and the red flag MUST be listed at reveal.
- **FR-023 (seam):** the practice service MUST take its grader as an injected function, `grader(input) → DimensionResult` (sync or Promise; shape in tasks.md F1c-T03). The default is the matcher. A future live grader goes through the existing gateway with the matcher as its fallback. No prompt is added in F1c.

**Voice and text (web)**
- **FR-030:** STOP (hotword, button or Space) MUST call `stopSpeaking()` synchronously in the handler and keep `{statementId, statementIndex, elapsedMs}` of the interrupted statement.
- **FR-031:** The hotword MUST listen only while narrating. Explanations are recorded only after a STOP.
- **FR-032:** If the current statement's text contains a hotword phrase, the hotword fires only when one recognition segment, trimmed and lowercased, equals that phrase.
- **FR-033:** The answer textarea MUST stay editable while and after dictating. Typing stops dictation. Nothing auto-submits.
- **FR-034:** A final segment equal to "send" or "send it" MUST submit the answer, with the command removed. "done" MUST stop dictation without submitting.
- **FR-035:** Every `speak()` argument MUST equal the `textContent` of the element showing it, normalized with `replace(/\s+/g, ' ').trim()`.
- **FR-036:** Text mode MUST offer the full flow without a mic. Voice mode MUST fall back to text, for the session, on `mic.denied` conditions. The Stop button and Space always work.
- **FR-037:** After a hit, the client MUST show and speak `say.corrected`, then resume at the next statement. After a late hit or a false interruption, it MUST restart the interrupted statement from its beginning.
- **FR-038:** The client MUST send `via: "voice" | "button" | "key"` and `stopLatencyMs`, the time from the hotword or keydown to the `stopSpeaking()` call, or `null`.

**Other modes**
- **FR-040:** `POST /api/practice/attempts/:id/answers {part, answer}` MUST accept these parts by type:
  - learn: `teachBack:<i>`;
  - interview: `interview`, `followUps:<i>`;
  - scenario: `design`, `challenges:<i>`;
  - any type, after complete: `followUp`, `transfer`.
  - Main parts must be answered in order (otherwise 400). A repeat returns the stored body.
- **FR-041:** For main parts, the response MUST be `{part, next: {part, prompt} | null}` with no result. Results come at complete. For `followUp` and `transfer`, it MUST be `{part, result, rubric}`. A string `followUp` gets `result: null` and is self-rated only.
- **FR-042:** `POST …/clarifications {question}` (scenario only, before `design`) MUST return `{reveal: string | null}`. It matches `askAbout` terms with the FR-017 token rules, returns the first matching clarification, and writes `clarified`.
- **FR-043:** The scenario design status MUST be the lower of the `rubric.mustCover` status and the best architecture status, ordered `not_met < partial < met`. `uncertain` wins over all of them.

**Progress**
- **FR-050:** Events MUST use the existing `event` table. The new verbs are `self-rated`, `assisted` and `clarified` [ARCH-4]. Shapes are in "Events and metrics" below.
- **FR-051:** `GET /api/practice/tracks/:track/progress` MUST be a pure projection of practice events (`projectPractice(events, pack)`). Rebuilding it from the log after a restart gives an identical body.
- **FR-052 (mastery, provisional):**
  - The projection keeps two series per concept, `independent` and `assisted`, never merged.
  - Each confident result for an exercise's part counts toward all of that exercise's `concepts`: `met` = 1, `partial` = 0.5, `not_met` = 0, and a miss counts as a detection 0.
  - `score` = mean of the last 5 results; `n` = their count.
  - `level` is `none` (n = 0), `learning` (< 0.6), `developing` (< 0.8) or `strong` (≥ 0.8 and n ≥ 3).
  - `uncertain` results are excluded and listed in `flagged[]`.
- **FR-053 (readiness, provisional product choice):** each concept has five criteria, each met by independent confident results only:
  - `explainUnaided`: interview `explanation` or scenario design `met`. A learn teach-back given right after the narration does not count (LR-1);
  - `detectAndCorrect`: ≥ 2 distinct planted statements with detection `hit`/`late_hit` and correction `met`;
  - `transfer`: transfer `met`;
  - `failureModesTradeoffs`: follow-up `tradeoffs` `met`;
  - `defendDecision`: `defense` `met`.
- **FR-054:** a criterion that no exercise in the pack can satisfy for that concept MUST be reported as `"n/a"`, never as met.
- **FR-055:** `GET /api/practice/tracks/:track` MUST return the modules, exercise summaries, schedule and `today`, where `today` = 1 + the number of distinct UTC dates with a practice `started` event before today's date, capped at `days`.
- **FR-056:** `GET /api/practice/tracks/:track/review` MUST return up to 3 concepts with n ≥ 1 or a flagged item, lowest independent score first. Each comes with the least recently attempted exercise covering it.
- **FR-057:** a diagnostic attempt is `POST /api/practice/attempts` with `mode: "diagnostic"` for an id in `schedule.diagnostic`. It has `assistAllowed: false`. Its results feed mastery like any independent result.

## Events and metrics
All events are server-written through `db.appendEvents`. Each passes `validateEvent`.
- **context:** `{subject: "applied-ai@1", attemptId: "pra_…", promptVersions: {}, engine: "practice", module, mode: "practice" | "diagnostic" | "review", exerciseType}`.
- **object:** `{type: "exercise", id: exerciseId, statement?: statementId, part?: part}`. `object.step` is never used: it is an integer in ADR 0002.

| Verb | When | `result` | Used by |
|---|---|---|---|
| `started` | attempt created | `{assistAllowed}` | completion rate, `today` |
| `stopped` | catch stop graded (one transaction with the next two) | `{attributedStatementId, detection, elapsedMs, via, stopLatencyMs}` | time-to-STOP, stop latency (voice-first §3) |
| `explained` | with every stop or answer | `{text, chars}` (text ≤ 2000) | grader agreement relabels |
| `graded` | with every stop hit or answer | `{dimensions: {<name>: Dim}, overall, outcome?, assisted, confidence, graderSource: "matcher", graderVersion, latencyMs}`; `outcome` for stops: `caught` / `caught_late` / `false_alarm` | mastery, readiness, fallback rate (0 here) |
| `completed` | complete (once) | `{hits, lateHits, misses, falseInterruptions, notReached, cleanPass, flagged, missedStatementIds, notReachedStatementIds}` | catch rate, clean-pass rate |
| `assisted` **(new)** | first assist in an attempt | `{kind: "reference"}` | assisted vs independent |
| `self-rated` **(new)** | each rating | `{rating, matcherStatus, graderVersion}` | κ (SC-004) |
| `clarified` **(new)** | each clarification question | `{text, chars, revealIndex: int \| null}` | scenario behavior |

## Success criteria (measurable; AI-quality thresholds pre-registered from data-and-evidence.md §5)
- **SC-001 (leak):** 0 hidden keys (FR-004 list) in any pre-grade response across the whole acceptance suite, in 100% of runs.
- **SC-002 (isolation):** the F1a golden replay shows 0 diffs. Every pre-F1c test passes unchanged, except the listed `old → new` edits in F1c-T01a and F1c-T04. Across all F1c tickets, `git diff` is empty for the "Untouched" list above.
- **SC-003 (matcher, labelled set, functional gate):** on the QA-labelled set in `tests/fixtures/practice/labelled-answers.json` (≥ 40 answers, ≥ 8 per class):
  - `clear` → `met` 100%;
  - `incorrect` → never `met` (100%);
  - `valid-alternative` → never `not_met` (100%), and `met` ≥ 75%;
  - `partial` → `partial` or `uncertain` ≥ 80%;
  - `should-flag` → `uncertain` ≥ 80%;
  - `uncertain` on the `clear` and `incorrect` classes ≤ 20%.
- **SC-004 (AI quality in use, pre-registered, reported, not a ship gate):** over the founder's first 7-day schedule, with ≥ 30 self-rated parts:
  - Cohen's κ between `matcherStatus` (met / partial / not_met) and the self-rating (had_it / partly / missed_it) is ≥ 0.6 on non-uncertain parts;
  - the `uncertain` share of graded parts is ≤ 10%.
  - **A miss on either** makes the live grader (Later) the next priority once a key exists. Only the PM changes these thresholds, in a thread.
- **SC-005 (text loop):** the e2e runs a catch exercise (2 planted, 1 late hit, 1 false interruption) and a zero-planted exercise to their reveals, keyboard-only, at 390 px and 1280 px, with 0 console errors.
- **SC-006 (barge-in):** from a hotword stub event or a Space keydown, `speechSynthesis.cancel()` is called within 300 ms of fake-clock time, in 100% of e2e runs.
- **SC-007 (spoken = shown):** every `speak()` argument in the e2e equals the normalized `textContent` of its element.
- **SC-008 (deny-list):** the deny-list test passes with the Applied AI words added, and `deny-list-allow.json` is unchanged.
- **SC-009 (rebuild):** `projectPractice` over the stored events equals the frozen expected progress body, before and after a server restart on the same DB file.
- **SC-010 (degrade):** an invalid practice pack leaves the server up, logs one `[practice]` warning, `/api/practice/tracks` omits the pack, and `/api/subjects` is unchanged.

## Non-goals / Later
- Defend-my-build mode (must be grounded in the real repository; never fabricated).
- Curriculum modules B–G, and the AWS mapping (docs.aws.amazon.com is blocked here; sources stay `verified: false` until checked).
- Live LLM grader: new prompt, gateway call, eval gate, recordings. Only the seam (FR-023) ships now.
- Moving the PMP drafts into this engine as a second pack.
- "change that", "repeat", "pause", "slower"/"faster", earcons, the silence prompt (OI-14), auto-continue setting, reference read-aloud.
- Editing the schedule in the UI (file only in F1c), a subject picker across engines, FSRS spacing, the trained / held-out experiment, mode A/B assignment.
- Offline queue and PWA install for the practice page.
- Retiring the old game or merging the two engines.

## Assumptions
- One learner (`learner_1`), one server process per DB file (ADR 0003 Amendment 3).
- Content arrives as drafts in `docs/research/applied-ai/module-1/` (founder-owned; not present at revision 1) and is moved by F1c-T10 only after review (OQ-1).
- The practice page runs in both `npm run mock` and `npm start`, because it makes no AI call.

## Open questions
- **OQ-1** [NEEDS CLARIFICATION: founder] Who signs off module-1 content accuracy before F1c-T10 moves it: the founder, the learning-designer, or both? The proposal is that the learning-designer reviews pedagogy and the founder confirms the facts, both recorded in thread 0007.
- **OQ-2** [NEEDS CLARIFICATION: founder] Is the interview date known? If it is under 4 days away, the PM proposes shipping Wave A only (F1c-T02–T05: text catch) and doing the rest after.
- **OQ-3** [NEEDS CLARIFICATION: founder] Is "configurable schedule" satisfied by `schedule.json` alone in F1c? A UI setting is listed under Later.
- **OQ-4** [NEEDS CLARIFICATION: content author] The formalized shapes for `followUp`, `acceptableArchitectures`, `challenges`, `followUps` and the scenario `rubric` differ from the draft. Can the author use them?

## Learning review
Requested from `learning-designer` before design review. These are the items where I want advice; the PM decides and records each call here.
- **LR-1:** Does a teach-back given right after the narration count as "explain unaided"? My call: no (FR-053).
- **LR-2:** Should catch feedback be immediate (after each stop) or deferred to the reveal?
- **LR-3:** Should interview and scenario results be withheld until complete?
- **LR-4:** Is the 3-point self-rating scale right, and is "self-rating against the reference" enough without a delay?
- **LR-5:** Is `GRACE_MS` = 2000 right?
- **LR-6:** Are the mastery and readiness thresholds sensible as provisional values?
- **LR-7:** Is "assisted = reference viewed" the right definition?
- **LR-8:** How should the diagnostic be composed?

## Architecture decisions needed (principal-architect; ADR or amendment)
- **ARCH-1:** Coexistence with `server/packs.js`, which warns about and skips `packs/applied-ai/` because it has no `pack.json`.
  - (a) A one-line guard in `server/packs.js` silently skips directories that contain `practice.json`. This touches the F1a sequence `server/packs.js` T07a → T18. Recommended.
  - (b) Accept a warning on every boot.
  - (c) A separate root such as `practice-packs/`, which departs from the founder's `packs/applied-ai/`.
  - The F1c tickets assume (a) is done inside F1c-T02. If the architect picks otherwise, T02's Files change.
- **ARCH-2:** Scope of ADR 0006's "F2 hard rule" ("no pack other than demo-trades ships until W7"). Its rationale is unfenced pack text in prompts, which does not apply because practice pack text never enters a prompt. The architect rules on scope. If the rule applies literally, the founder must grant an exception.
- **ARCH-3:** The practice pack format v1 (schema above) as a new ADR. Includes: `subject_pack` reuse with ids unique across both engines, and the `practice.json` manifest name.
- **ARCH-4:** ADR 0002 amendment:
  - verbs `self-rated`, `assisted`, `clarified`;
  - `object.type: "exercise"` with string `statement` / `part`;
  - `context.engine`, `context.mode` and `context.exerciseType`;
  - the practice `graded.result` shape;
  - the `pra_` attempt prefix;
  - a rule that F1a's `projectAttempt` and attempt routes ignore `pra_` attempts.
  - Also updates the `data-and-evidence.md` §1 verb table.
- **ARCH-5:** Matcher placement.
  - (a) A new server-only pure module `server/services/practice-matcher.js` that reimplements the mock-grader techniques. Recommended: zero golden risk, and the browser can't import it.
  - (b) Extract shared text helpers from `shared/mock-grader.js`. This edits F1a-T13b's file during the hold.
- **ARCH-6:** `web/speech.js` reuse vs F1a-T15's planned `web/speech/index.js`. Rule needed: T15 either keeps `web/speech.js` as a re-export or updates the `web/practice/*` imports in the same change.
- **ARCH-7:** The grader seam signature (FR-023), so the later live grader can drop in through `gateway.run` with the matcher as `fallback`.
- **ARCH-8:** The new read `db.eventsForEngine({actor, engine})`: a `json_extract` filter, and whether it needs an index.
