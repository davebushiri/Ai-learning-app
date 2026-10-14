# F1c: Practice engine, Applied AI track module 1

**Status:** Approved (revision 3: Wave A.1 fix wave added after the Wave A code review)
**Phase:** F1 (interrupt priority, founder direction in [thread 0007](../../team/threads/0007-applied-ai-aws-track.md)) | **Links:** [user-flow.md](../../foundation/user-flow.md), [data-and-evidence.md](../../foundation/data-and-evidence.md), [voice-first.md](../../foundation/voice-first.md), ADRs [0001](../../adr/0001-sqlite-storage-and-append-only-event-log.md)–[0006](../../adr/0006-pack-format-v1.md), [0008](../../adr/0008-practice-engine-and-practice-pack-format-v1.md), [0002 Amendments 3 and 4](../../adr/0002-event-schema-v1.md), [0006 Amendment 3](../../adr/0006-pack-format-v1.md); design review and Wave A code review in [`review.md`](review.md); Wave A QA report in [`qa-report.md`](qa-report.md)
**Revision:** 3 (2026-10-14). Revision 3 applies the Wave A code review (W-B1, W-B2, W-S1, W-S3–W-S6; W-S2 moves to F1c-T06), ADR 0002 Amendment 4, the QA report's ship conditions, bugs F1c-B20, B21 and B22, and product decisions PD-4 to PD-8 (below). It adds Wave A.1 (F1c-T12 to T16) in tasks.md. Revision 2 (2026-10-13) applies the design review's C1–C15, the learning-designer's matcher findings B2 and B3 and follow-up drafts B4 ([`docs/research/applied-ai/module-1/REVIEW.md`](../../research/applied-ai/module-1/REVIEW.md)), and product decisions PD-1 to PD-3 (below). Revision 1: first draft.

## Problem
The founder has a 60-minute technical interview on AI fluency (RAG, agents, embeddings, production evidence) this week or next. The only working loop is the trades game. It has one mode, needs exactly 3 mistakes per card, has no mastery and still leaks answers on its legacy route. F1c adds a **separate, server-owned practice engine** (ADR 0008) that runs the Applied AI track, module 1 (LLM foundations and RAG), in four modes. It grades offline, because there is no API key. The founder's constraints are small increments, reuse, no rebuild, and nothing that takes over the founder's preparation time.

## Isolation from the existing game (binding)
- **New surface only:** `web/practice.html`, `web/practice/*.js`, `web/practice/practice.css`, routes under `/api/practice/*`, `server/routes/practice*.js`, `server/services/practice*.js` and content in `packs/applied-ai/`.
- **Untouched:** `web/app.js`, `web/index.html`, `web/api.js`, `web/styles.css`, `server/routes/{health,scenarios,grade}.js`, `server/services/{assessment,content,ai-client}.js`, `server/prompts/*`, `server/ai/*`, `shared/{mock-grader,scoring,contract,pack}.js` and `packs/demo-trades/**`. The F1a golden replay (61 runs) is therefore unaffected. F1a Wave 2 stays on hold; the shared files are sequenced in tasks.md "Shared-file sequences" (C7).
- **Additive edits to shared infrastructure, one ticket each:**
  - `server/index.js`: route registration and the practice loader call (F1c-T04, F1c-T08);
  - `shared/events.js`: three new verbs (F1c-T04);
  - `server/db.js`: one new read function (F1c-T08);
  - `server/packs.js`: one guarded line (F1c-T02, ADR 0008 ARCH-1);
  - `web/speech.js`: one optional `onSegment({text, isFinal})` callback in `listen()` (F1c-T06, ADR 0008 ARCH-6). `web/app.js` doesn't pass it, so its behavior is unchanged and the golden replay shows 0 diffs.
- **Reused as-is:** `web/speech.js` (`speak`, `stopSpeaking`, `wait`, `canListen`, `listen`) through `web/practice/speech.js`, the only practice module that imports it (ADR 0008); `server/db.js` (`appendEvents`, `eventsForAttempt`, `putPack`); `server/http.js` (`readBody`, `sendJson`, `HttpError`, static serving); `shared/events.js` (`makeEvent`, `newId`, `validateEvent`); and the loader pattern of `server/packs.js` (validate first, skip with a warning, canonical JSON, immutable per version, deep freeze, `Map` registry). The `shared/mock-grader.js` techniques are reimplemented in the server-only `server/services/practice-matcher.js`, not imported (ADR 0008 ARCH-5).
- **No prompt, no gateway call, no model routing change.** Invariants 3 and 4 are untouched, and the eval gate is not triggered. A guard test makes this structural: no practice module imports `server/ai/*` or `server/prompts/*`, and they never import a practice module (ADR 0006 Amendment 3).

## Exercise schema (practice pack format v1, ADR 0008)
All pack text is untrusted (ADR 0006). It is validated before use and rendered as text only.

**Layout**
```
packs/applied-ai/
  practice.json              # manifest (never named pack.json; ADR 0008)
  schedule.json
  exercises/<exerciseId>.json
  reference/<referenceId>.md # trusted reference: never contains a flawed statement
```

**Manifest `practice.json`**
```jsonc
{ "format": "practice-v1", "id": "applied-ai", "version": 1, "title": "Applied AI",
  "modules": [{ "id": "m1", "title": "LLM foundations and RAG", "exercises": ["<exerciseId>", "…"] }],
  "lexicon": { "synonyms": { "<term>": ["<form>", "…"] } },   // optional; matched as data, never in a prompt
  "provenance": { "builtBy": "<who>" } }
```
The practice loader runs after `loadPacks()`. It refuses (one `[practice]` warning) a manifest whose `id` `getPack(id)` already holds, because both engines share the `subject_pack` key space (ADR 0008).

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
| `sources` | `[{title, url, verified: boolean, note?: string}]` | ≥ 1; `url` starts with `https://`; `note` ≤ 200 chars (C2) |
| `followUp` | `{question, rubric: string[]}` or a string | a string is self-rated only (never matched). Content rule: it MUST probe failure modes or trade-offs |
| `transfer` | `{scenario: string, rubric: string[]}` | rubric ≥ 1 item |

**Rubric items (every `rubric`, `explain`, `correct`, `mustCover`, `strongSignals`, `redFlags`, `mustInclude` and `askAbout` entry) (C1).** An item is one or more alternatives separated by `|`, for example `"weights unchanged|no training"`. The validator rejects an item with an empty alternative (`"a||b"`, `"a|"`) and an item with more than 8 alternatives.

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
"acceptableArchitectures": [{ "id": "…", "summary": "…",
   "mustInclude": ["…"], "strengths": ["…"], "tradeoffs": ["…"] }],   // ≥ 1; mustInclude, strengths, tradeoffs optional (C2)
"challenges": [{ "question": "…", "rubric": ["…"] }],                 // ≥ 1
"rubric": { "mustCover": ["…"], "strongSignals": ["…"], "redFlags": ["…"] }
```
`strengths` and `tradeoffs` are revealed at complete and never matched.

**`interview`:** `question`, `rubric: {mustCover[] (≥ 1), strongSignals[], redFlags[]}`, `followUps[]` (≥ 1). Each `followUps` item is `{question, rubric: string[]}` or a string. A string item is self-rated only, with `result: null`, like a string `followUp` (C2).

**Format mapping of the module-1 drafts (F1c-T11, format only; C12).** `verified`: a string starting `fetched-` → `true`, anything else → `false`, with the original string in `note`. `challenges[]`: `challenge` → `question`, `expected` → `rubric`. Architecture `id` = the slug of `name` (`name` itself is dropped). Module id `m1`. Reference files renamed to `<referenceId>.md`. `diagnostic.json` (10 items, not exercises) stays in research; F1c adds no new exercise type.

**Caps (validator):**
- strings ≤ 2000 chars;
- ≤ 20 items per array, except `narration` ≤ 20 and `exercises` ≤ 100;
- ≤ 8 `|` alternatives per rubric item;
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
Rules: `plan` has exactly `days` entries numbered `1..days`. Each day's minutes sum to `minutesPerDay`. Practice kinds (`catch`, `scenario`, `interview`, `review`) are ≥ 60% of total minutes ("mostly practice"; a provisional product choice). The defaults are 7 days × 120 min. For module 1, the PM and the learning-designer record the 7-day plan and the ≤ 6 diagnostic exercise ids in thread 0007 before F1c-T11 (C12).

## Product decisions (revision 2)
- **PD-1 (readiness with string follow-ups; architect's product note, REVIEW.md B4).** Every module-1 `followUp` and interview `followUps` entry is a string, so it is self-rated only. **Decision:** readiness also counts graded scenario challenges (FR-053), instead of converting every follow-up into a rubric in F1c-T11. On top of that, F1c-T11 adopts the learning-designer's two drafted rubrics (REVIEW.md B4) for catch-06 and catch-08, keeping their question text, if the content author agrees in thread 0007; otherwise they stay strings. **Why:** this needs no new content before the interview and is one projection rule in F1c-T08. Converting every module-1 follow-up (16 `followUp` plus the interview `followUps`) is authoring work on founder-owned drafts and would delay T11. Concepts with neither kind of evidence honestly show `n/a` (FR-054). **Later:** rubric-bearing follow-ups become the authoring standard from module 2 on.
- **PD-2 (negation polarity; REVIEW.md B2, option (a)).** Negators are content tokens, never stopwords. The negation check skips a rubric item that itself contains a negator. A red flag counts only when it isn't negated (FR-021, FR-022). **Why:** correcting a misconception usually means saying "not", so the revision-1 rule made right answers `uncertain` and penalized answers that reject an anti-pattern. Authors may still rephrase items positively where that reads naturally.
- **PD-3 (met threshold; REVIEW.md B3).** `met` needs `ceil(n × 2/3 − 1e-9)` matched items, so a 3-item dimension needs 2, not 3 (FR-018). The same epsilon applies to the item-coverage ratio (FR-017).

## Product decisions (revision 3, Wave A.1)
- **PD-4 (FR-019 stuffing threshold, F1c-B20 / W-B1).** I accept the architect's `matcher@2` rule and set `stuffedMaxFunctionShare = 0.2` (FR-019).
  - **Why 0.2:** every value from 0.05 to 0.30 passes SC-003 on the measured sets. 0.2 sits below the lowest function-word share measured on a correct concise sentence (0.27) and above a 5-word keyword list padded with one article (1/6 ≈ 0.17), so that list is still capped.
  - **It is provisional.** I revisit it in thread 0007 if either of these happens: a labelled keyword list reaches `met`, or a correct sentence is capped (including the dictated rows QA adds in F1c-T01b, per the architect's dictation RISK).
  - **The evidence is thin** (2 keyword lists). So the merge also needs the enlarged labelled sets, SC-012 below.
- **PD-5 (skip = not scored, W-B2).** I adopt ADR 0002 Amendment 4 as written.
  - The reveal lists a skipped planted statement with the copy `missed.notGraded`. It never uses the word "Missed" for it, and it is never counted in `summary.misses`.
  - `sum.line` is unchanged, and no `summary.notGraded` count is added (Later). The not-scored line is enough to explain the gap, and adding a count would change a copy string that the founder already knows.
- **PD-6 (repeat stops, W-S1).** Repeat detection is keyed on a client `stopId` (FR-008).
  - A retry ("Try again") reuses the `stopId` and gets the stored body.
  - A new STOP press on the same statement is a new stop. That is the FR-037 replay path, after a late hit or a false interruption.
  - Requests without `stopId` keep the revision-2 rule, so older clients and tests behave as before.
- **PD-7 (self-rating failure is visible, W-S4).** A failed self-rating shows and speaks `err.rate` under that row, with a Try again button (inv. 7). A lost rating silently removes an SC-004 data point.
- **PD-8 (favicon vs SC-005).** **Fixed, not exempted.** `web/practice.html` declares an empty inline icon (`<link rel="icon" href="data:,">`), so the browser never requests `/favicon.ico` on the practice page, and SC-005's "0 console errors" stays literal with no filter. The card game's own 404 on `/` stays with thread 0006 and F1a, because `web/index.html` is on the Untouched list.
- **Deferred from the Wave A code review, with reasons:**
  - **W-S2 (a STOP in the gap after the last statement) → F1c-T06.** In text mode, `end.catch` is shown and `complete` is called at once, so there is no gap. In Wave A voice mode, STOP is by button or Space only. The gap only matters once the hotword lands in T06, which rewrites this handler anyway. T06 gains the acceptance line and test.
  - **O1 (backend appending bugs to tasks.md)** is a process note: bugs go through QA or thread 0007. **O2 (T05's manual browser record)** is collected by QA in F1c-T16.

## User stories (prioritized; each independently testable)

**Hands-free rule (inv. 8, C11):** one tap starts a session (browsers require a user activation before audio and the mic). Everything after that tap chains by voice: within an exercise, from the reveal or `done` to the next exercise, and from the progress page into review or the diagnostic.

### US1: Catch-and-correct in text mode (P1): first usable loop
The learner opens `/practice.html`, picks the track and a catch exercise, and reads statements appearing at reading pace. They press **Stop** (or Space) on a wrong statement and type what's wrong and the correct version. They see per-dimension feedback and the corrected statement, then continue. At the end they see what they missed, the reference, the sources and the rubric, and rate themselves.
**Why P1:** this is the core practice the founder needs this week. Everything else builds on it.
**Independent test:** with only F1c-T02–T05 merged, a catch exercise from the fixture pack completes keyboard-only, and its events rebuild the result.
**Acceptance scenarios (text mode; the voice twins are in US2):**
1. Given the picker, when the learner starts a catch exercise, then `POST /api/practice/attempts` returns narration `{id, text}` only, and no response before grading contains any hidden key (FR-004).
2. Given statement `s3` is planted, when the learner stops on `s3` and submits an answer covering the rubric, then detection is `hit`, explanation and correction are `met`, and the copy `fb.hit.met` plus `say.corrected` appear. Narration then continues at `s4`.
3. Given `s2` is clean, when the learner stops on `s2`, then detection is `false_interruption`, the copy `fb.false` appears, nothing about any other statement is returned, and narration restarts `s2` from its beginning.
4. Given the stop lands 1500 ms into `s4` and `s3` is planted and uncaught, then the stop is attributed to `s3` (`late_hit`), and `s4` is re-shown from its start after feedback (FR-012).
5. Given an answer with valid alternative wording that matches an `acceptableCorrections` entry but not `rubric.correct`, then correction is `met` (FR-020).
6. Given a long answer (≥ 20 content words) that matches no rubric item, then the dimension is `uncertain`, the copy shows "Uncertain: flagged for review", and no score is shown (FR-021).
7. Given the narration ends, when complete is called, then missed planted statements are revealed with `whyWrong` and `correctedText`, followed by the reference (as text), sources (as links per FR-039; unverified ones marked "(not yet verified)") and each answered stop's rubric with matched and missing items. The learner can rate each answered stop "I had it", "Partly" or "I missed it" (FR-016).
8. Given a zero-planted exercise and no stops, when complete is called, then `cleanPass: true` and the copy `end.clean` appears.
9. Given the learner presses "Show the reference (counts as assisted)" mid-narration, then the reference appears, and every later graded stop in this attempt has `assisted: true`. Earlier stops keep `assisted: false` (FR-015).
10. Given the stop request fails at the network level, then `err.net` appears, the typed answer is kept, and "Try again" re-posts it idempotently (FR-008).
11. Given an answer that corrects the statement with a negation ("it is not fully deterministic") against a rubric item that itself contains a negator, then that item is matched and the dimension is not made `uncertain` by the negation rule (FR-021(b), PD-2).
12. Given the reveal, when the learner presses **Next**, then the next exercise starts: the next one in today's plan once F1c-T10 has merged, the picker before that (FR-058).
13. Given a stop on planted `s3` whose request failed (`err.net`), when the learner presses **Skip this stop** and the set runs to the end without `s3` being caught, then the `complete` request carries `skipped: [{statementId: "s3", elapsedMs}]`. The reveal shows `s3` with the copy `missed.notGraded`, and the word "Missed" appears in no line about `s3`. `summary.misses` doesn't count `s3`, and the stored `completed` event lists `s3` in `notGradedStatementIds`, not in `missedStatementIds` (FR-009a, PD-5).
14. Given a late hit on `s3` from a stop 800 ms into clean `s4`, when `s4` replays and the learner stops on `s4` again, then the second stop is a new stop: detection `false_interruption`, the copy `fb.false` appears, and a second `stopped`/`explained`/`graded` triple is written. Pressing **Try again** after a failed stop request re-sends the same `stopId` and gets the stored body, with no new events (FR-008, PD-6).
15. Given the reveal, when a self-rating request fails, then `err.rate` appears under that row with a **Try again** button, and the rating buttons keep their previous pressed state. Try again re-posts the same rating, and on success the button gets `aria-pressed="true"` and the error is removed (PD-7).

### US2: Catch-and-correct in voice mode (P1)
The same loop, hands-free: statements are spoken. Saying "stop" cuts speech immediately, and the learner dictates into an editable transcript, then says "send". Feedback and the corrected statement are spoken, and narration resumes. At the reveal, "next" moves on.
**Why P1:** voice-first is invariant 8. It is how the founder practises away from the desk.
**Independent test:** in e2e with the speech stubs, a full catch exercise completes, and the next one starts, with no clicks after Start.
**Acceptance scenarios (voice mode):**
1. Given narration is speaking `s3`, when the recognizer yields an interim result containing "stop", then `speechSynthesis.cancel()` is called within 300 ms (fake clock), `s3` stays highlighted as the interrupted statement, and listening for the answer starts (FR-030, FR-031).
2. Given dictation is in progress, when the learner edits the textarea, then dictation stops and the typed edit is kept. Nothing is submitted until "send", the Submit button or Enter (FR-033).
3. Given a final recognition segment (`onSegment` with `isFinal: true`) equal to "send" or "send it", then that word is removed from the answer and the answer is submitted (FR-034).
4. Given a hit, then the feedback text is spoken exactly as displayed, followed by "Corrected: {correctedText}", and narration resumes at the next statement (FR-035, inv. 9).
5. Given a late hit, then after feedback the interrupted statement is spoken again from its start.
6. Given the current statement's own text contains a hotword phrase, then the hotword fires only if a recognition segment consists of the phrase alone (FR-032).
7. Given speech recognition is unavailable or permission is denied, then `mic.denied` is shown and spoken, the session continues in text mode, and the Stop button and Space keep working (FR-036).
8. Given voice mode, then the Stop button and Space still stop narration at any time.
9. Given the reveal or `done` state, then `next.hint` is spoken and shown, and when the recognizer yields a final segment "next", the next exercise starts exactly as the Next button would (FR-058).
10. **(Wave A.1, voice twin of US1.13.)** Given voice mode and a skipped stop on planted `s3`, then `err.net` is spoken exactly as shown when the request fails. At the reveal, the `missed.notGraded` line for `s3` is spoken exactly as shown, in the position where missed lines are spoken (after `sum.line`) (FR-035).
11. **(Wave A.1, voice twin of US1.15.)** Given voice mode and a failed self-rating, then `err.rate` is spoken exactly as shown. Retrying is by the Try again button; the voice rating commands arrive with F1c-T06, and saying the rating again then retries it.
12. **(F1c-T06, deferred W-S2.)** Given voice mode and the last statement has finished, when the learner stops (hotword, button or Space) while `end.catch` is being spoken, then the stop is posted for the last statement, with `elapsedMs` measured from that statement's start, and is graded like any stop on it (edge case "stop in the gap").

### US3: Learn mode with teach-back (P2)
The learner hears (voice) or reads (text) an error-free explanation. They answer each teach-back question by voice or text. After the last answer they see the rubric and reference, rate themselves, then answer the follow-up and transfer questions.
**Independent test:** a learn exercise completes in voice mode and in text mode, writing one `graded` per teach-back question.
**Acceptance scenarios:**
1. Given voice mode, when the narration ends, then "Teach it back: {question}" is spoken and shown, and listening starts. Given text mode, the same prompt is shown with a focused textarea.
2. Given learn mode, then no Stop control is shown and there is no hotword. "pause" / "resume" are Later.
3. Given each answer, the response contains `next` (the next question, or `null`) and no result. Results, the rubric and the reference arrive at complete (FR-041).
4. Given the reveal, voice: "continue" goes to the follow-up and "next" skips to the next exercise. Text: the Continue and Next buttons do the same (FR-058).

### US4: Technical interview format (P2)
The learner gets an interview question, answers by voice or text, then answers each follow-up in turn. At complete they see mustCover, strongSignals and redFlags with their matches, and rate themselves.
**Independent test:** an interview exercise in both modes yields an `explanation` dimension from mustCover, a `defense` dimension per rubric-bearing follow-up, and `result: null` for each string follow-up.
**Acceptance scenarios:**
1. Voice: the question is spoken as "Interview question: {question}". Text: it is shown. Each answer returns the next follow-up as `next.prompt`, with no grading feedback until complete.
2. Given an answer that matches a `redFlags` item with no negator before it, then that dimension is `uncertain` (never `met`), and the red flag is listed at reveal (FR-022).
3. Given an answer that names and rejects a red flag ("I wouldn't fine-tune for knowledge"), then the red flag is not counted and the dimension is not made `uncertain` by it (FR-022, PD-2).
4. Given a string follow-up, then its answer is stored, its result is `null`, and it can be self-rated at reveal (C2).

### US5: Customer scenario (P2)
The learner reads or hears a brief and constraints. They ask clarifying questions, and each matching clarification is revealed once. They say "ready" (voice) or press Ready (text), describe a design, and answer the customer's challenges. They get results at complete.
**Independent test:** a scenario exercise in both modes; one clarification revealed by a matching question; a non-matching question gets `clarify.none`.
**Acceptance scenarios:**
1. Given a question that matches an `askAbout` term, then `Customer: {reveal}` is shown and spoken. Asking again returns the same reveal and writes one more `clarified` event.
2. Given a design answer that matches no `acceptableArchitectures[].mustInclude` set, then the explanation status is at most `partial`. If the answer has ≥ 20 content words and matches nothing, the status is `uncertain` (FR-021, FR-043).
3. Given a scenario whose architectures have no `mustInclude`, then the design status equals the `mustCover` status (FR-043).

### US6: Progress, schedule, diagnostic and review weaknesses (P3)
The learner sees today's plan (day N of 7) from `schedule.json`. They can run the diagnostic (no assist) and see per-concept mastery (independent and assisted shown separately), readiness criteria, and a flagged-for-review list with self-ratings. "Review weak spots" starts the exercise for the weakest concept.
**Independent test:** after a scripted set of attempts, `GET …/progress` equals a frozen expected projection, and the same projection results after a server restart.
**Acceptance scenarios:**
1. Given no practice events yet, then the progress page shows Day 1 and the diagnostic block first. Voice: the page title, today's blocks and `progress.commands` are spoken. Text: they are shown.
2. Given an assisted `met` and an independent `not_met` on the same concept, then `independent.score` is 0 and `assisted.score` is 1. They are never merged (FR-052).
3. Given a diagnostic attempt, then the assist control is absent, and `POST …/assist` returns 400.
4. Given "Review weak spots" (button, or the voice command "review" on the progress page), then the exercise started is the least recently attempted exercise covering the lowest-scoring independent concept (FR-056). With no review items, `review.empty` is shown and spoken.
5. Every readiness panel shows the copy `progress.provisional`.
6. Given the progress page, when the learner says "diagnostic" or presses "Run the diagnostic", then the first diagnostic exercise not yet done starts with `mode: "diagnostic"` (the first one if all are done) (FR-057, FR-058).
7. Given a concept covered only by exercises with string follow-ups and no scenario challenges, then "Failure modes and trade-offs" and "Defends a decision" show `n/a`. Given 2 scenario challenges answered `met` independently for a concept, both show "Met" (FR-053, PD-1).

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
| `missed.item` | Missed: {text} {whyWrong} Corrected: {correctedText} | Each missed planted statement (a `missed[]` item without `notGraded`) |
| `missed.notGraded` | Not scored, you skipped this stop: {text} {whyWrong} Corrected: {correctedText} | **(Wave A.1, PD-5)** Each `missed[]` item with `notGraded: true`. Shown in `#missed-list`, and spoken in the same position as `missed.item` |
| `status.met` / `.partial` / `.not_met` / `.uncertain` | Covered / Partly covered / Not covered / Uncertain: flagged for review | Status labels |
| `dim.*` | Explanation / Correction / Transfer / Trade-offs / Defense, rendered as "{dim}: {status}" | Dimension rows in feedback and reveal. Spoken after the feedback text, one per row |
| `selfrate.prompt` | Compare your answer with the reference. How did you do? | Per answered part at reveal |
| `selfrate.options` | I had it / Partly / I missed it | Buttons. Voice: "had it", "partly", "missed it" |
| `next.hint` | Say "next" or press Next for the next exercise. | Reveal and `done` states, after the self-rating prompt (C11) |
| `btn.next` | Next | Button label (shown only), `#next-btn` |
| `plan.done` | That's everything planned for today. Your progress is saved. | "next" when today's plan has no exercise left; then the progress page opens (F1c-T10) |
| `q.teachBack` | Teach it back: {question} | Learn |
| `q.interview` | Interview question: {question} | Interview |
| `q.followUp` | Follow-up: {question} | Interview follow-ups and the common follow-up |
| `q.transfer` | New situation: {scenario} | Transfer |
| `sc.brief` | Customer brief: {brief} Constraints: {c1}; {c2}. Ask the customer anything, or say "ready" when you want to give your design. | Scenario start (text mode: "or press Ready") |
| `sc.reveal` | Customer: {reveal} | Clarification matched |
| `clarify.none` | The customer doesn't have more on that. | No match |
| `sc.design` | Describe your design. | After "ready" |
| `sc.challenge` | The customer pushes back: {question} | Each challenge |
| `err.net` | Couldn't reach the server. Your answer is still here. Try again, or skip and this stop won't be scored. | Stop request failed; buttons "Try again", "Skip this stop" ("Skip" not shown for non-stop answers). From Wave A.1 the promise holds: a skipped stop is never scored as a miss (FR-009a) |
| `err.rate` | Couldn't save your rating. Try again. | **(Wave A.1, PD-7)** A self-rating request failed. Shown under that answered part's rating buttons, and spoken in voice mode |
| `btn.retry` | Try again | **(Wave A.1)** Button label (shown only), the `button.rate-retry` next to `err.rate` |
| `mic.denied` | The microphone isn't available. Type your answer instead. | No recognizer, permission denied, or 3 recognizer errors in a row |
| `src.unverified` | (not yet verified) | Shown only, after a source with `verified: false` |
| `progress.provisional` | Readiness thresholds are a provisional product choice. | Progress page, shown and spoken on open |
| `progress.commands` | Say "review" to practise your weak spots, or "diagnostic" to run the diagnostic. | Progress page, shown and spoken after `progress.provisional` (C11) |
| `btn.review` / `btn.diagnostic` | Review weak spots / Run the diagnostic | Button labels (shown only), `#review-btn`, `#diagnostic-btn` |
| `review.empty` | Nothing to review yet. Start with today's plan. | "review" when `GET …/review` returns no items |
| `done` | Done. Your progress is saved. | After transfer; followed by `next.hint` |

**Voice commands (matched before anything is treated as an answer, only in the listed state):**

| Command | State | Action |
|---|---|---|
| "stop", "hold on" | Narrating (catch) | STOP |
| "send", "send it" | Answering. Must be the whole final segment | Submit |
| "done" | Answering | Stops dictation without submitting |
| "continue" | Feedback; reveal (once F1c-T09 has merged) | Resume narration; go to the follow-up |
| "had it", "partly", "missed it" | Reveal (self-rating) | Rate the current part |
| "next" | Reveal; `done` | Next exercise (FR-058) |
| "ready" | Scenario clarifying | Go to design |
| "review" | Progress page | Start review (FR-056) |
| "diagnostic" | Progress page | Start the diagnostic (FR-057) |

**Text mode:** Stop button or Space · Enter submits (Shift+Enter inserts a newline) · buttons for everything else (Next, Continue, Ready, Review weak spots, Run the diagnostic).

**Repair paths:**
- **Misheard answer:** edit the transcript, or press "Talk again", which replaces the text.
- **Hotword missed:** the button and Space always work.
- **Wrong stop:** a false interruption costs nothing beyond the count.
- **Grade looks wrong:** self-rate "I missed it" or "I had it". The disagreement is recorded for κ.
- **Network failure:** "Try again" (re-sends the same `stopId`; never double-counted) or "Skip this stop" (shown as `missed.notGraded` at the reveal; never a miss).
- **Self-rating failure (Wave A.1):** `err.rate` plus the Try again button; pressing a rating button again also retries.
- **Mic failure:** automatic switch to text mode.
- **Command not heard ("next", "review", "diagnostic"):** the matching button always works.

## Edge cases
- **Unknown track or exercise** → 404 `{error}`. **Unknown attempt** → 404. **Bad JSON** → 400. **Body over 1 MB** → 413 (`readBody`).
- **Engine isolation (ADR 0002 Amendment 3):** an `att_` id on any `/api/practice/attempts/:id/*` route → 404. A `pra_` id on the card engine's `/api/attempts/:id/*` routes → 404 (F1a-T12).
- **Stop on an unknown `statementId`** → 400. **Stop on a statement earlier than the last graded stop** → 400. **Stop after complete** → 409. **Stop on a non-catch attempt** → 400.
- **Repeat and re-stop (FR-008, PD-6; revision 3):**
  - A stop whose `stopId` matches a stored stop on the same `statementId` → 200 with that stored body, and no new events.
  - The same `stopId` on a different `statementId` → 400.
  - A malformed `stopId` (not a string matching `^[A-Za-z0-9_-]{8,64}$`) → 400.
  - A new `stopId` on a statement that already has a stop → a new stop, attributed by FR-012 against the stops graded so far. The statement is clean or already caught, so this is normally a `false_interruption`.
  - A stop **without** `stopId` on a statement that already has a stop → 200 with the stored body of the latest stop on that statement, and no new events (the revision-2 rule).
  - **Accepted risk:** if a stop was graded on the server but its response was lost, and the learner then presses Skip and stops again on the same planted statement, the new stop is a `false_interruption` and the learner hears `fb.false`. This needs a lost response plus a skip plus a re-stop. The reveal still lists the statement as caught.
- **Skipped stops at complete (FR-009a, ADR 0002 Am. 4):**
  - A skipped entry that FR-012 attributes to a planted statement still uncaught at complete makes that statement **not graded**.
  - A skipped entry on a clean statement, or on a statement that is caught by the time of complete, changes no count. A skip that would have been a false interruption is not counted as one, so `cleanPass` can still be true.
  - A skipped statement after `lastStatementId` extends the reached range, so its statement is never `notReached`.
  - A repeat `complete` ignores `skipped` and returns the stored body (FR-009).
- **Stop in the gap after the last statement:** attributed to the last statement. The client half moves to F1c-T06 (W-S2, PD-8 deferrals); the server already accepts it.
- **Assist after complete (W-S3):** returns the same body as any assist, and writes no `assisted` event.
- **Answer text:** empty → allowed, and all dimensions are `not_met`. Over 2000 chars → truncated server-side, and `explained.result.chars` holds the original length.
- **`elapsedMs` missing, negative or non-integer** → treated as a large value (no grace attribution). It is a client claim, an accepted risk as in ADR 0003.
- **Grace attribution only applies** if the previous statement is planted and uncaught.
- **Early complete** (the learner leaves mid-narration): planted statements after `lastStatementId` are `notReached`, never `missed`.
- **Invalid practice pack:**
  - The server starts, logs one `[practice] <dir> skipped: <reasons>` warning, and `GET /api/practice/tracks` omits it.
  - The card engine is unaffected: `listSubjects()` from `server/packs.js` deep-equals the same call with no practice pack present, and no `[packs]` warning is logged (C3). No F1c test calls `/api/subjects`, `/api/trades` or `/api/scenario`.
  - A changed pack without a version bump is refused (immutability, as in ADR 0006).
  - A manifest id already held by `getPack(id)` is refused.
- **Pack version bump:** events for exercise ids absent from the current pack version are left out of mastery and readiness, and counted in `counts` (C9).
- **Reference markdown** is shown with `textContent` in a `white-space: pre-wrap` block. HTML in it appears as literal text.
- **Source links:** a source whose `url` fails the `https://` check never loads (validator), so the client never builds a non-https link (FR-039).
- **Self-rating:** before complete, or for a part with no learner answer (a miss or a not-graded statement) → 400. Repeat ratings append, and the latest wins in projections. A failed request shows `err.rate` (PD-7).
- **Hotword echo:** TTS audio heard by the mic. Handled by FR-032. Headphones are recommended in the intro help text (shown only).
- **Assist is idempotent.** A second call returns the same reference and writes no second `assisted` event.
- **A concept with no exercise that can satisfy a readiness criterion** shows that criterion as "n/a" (FR-054). It is never counted as met.
- **"next" with no plan available** (before F1c-T10, or the schedule request fails): the picker is shown.

## Functional requirements

**Content and loading**
- **FR-001:** `validatePracticePack(manifest, files)` MUST apply every schema rule and cap above, including the `|` alternative rules. It returns a list of problems, never throws, and accepts zero-planted catch exercises. The old `validateScenario` (exactly 3 mistakes) is unchanged and is not used by this engine.
- **FR-002:** `loadPracticePacks(dir)` MUST load every `packs/<dir>/practice.json` at startup, after `loadPacks()` and before listen, using the `server/packs.js` pattern:
  - validate first, then skip with one `[practice]` warning;
  - refuse a manifest id that `getPack(id)` already holds;
  - deep-freeze;
  - use `Map` registries;
  - store canonical JSON of the manifest, schedule, exercises and references through `db.putPack`, and refuse on `'conflict'`.
  - A directory without `practice.json` is ignored silently by this loader. `server/packs.js` skips, silently, a directory with `practice.json` and no `pack.json` (ADR 0008 ARCH-1).
  - The directory defaults to `packs/`, and `PRACTICE_PACKS_DIR` overrides it, so tests can load fixture packs. **It is a folder of pack folders** (`<dir>/<packFolder>/practice.json`), never a single pack folder. Pointing it at a pack folder itself loads 0 tracks, with no warning (F1c-B22). Examples: `PRACTICE_PACKS_DIR=tests/fixtures/practice` loads both fixture tracks; the acceptance tests copy `accept-pack` into `<tmp>/kite-craft` with `acceptPacksDir()` from `tests/acceptance/practice-helpers.mjs`.
- **FR-003:** Engine code (`server/**/practice*`, `web/practice*`) MUST contain no subject words. It passes the deny-list test with the Applied AI words and the track id `applied-ai` added (F1c-T01a; C15) and an unchanged allow-list. Engine code reads the track id from the pack, never from a literal.

**Server owns answers**
- **FR-004:** Every response before grading MUST be built by the allow-list projection `toPublicExercise(ex)` or an equivalent explicit shape. It MUST NOT contain, at any depth, the keys `answerKey`, `planted`, `clean`, `misconception`, `whyWrong`, `acceptableCorrections`, `exceptions`, `kind`, `rubric`, `explain`, `correct`, `mustCover`, `strongSignals`, `redFlags`, `clarifications`, `askAbout`, `reveal`, `acceptableArchitectures`, `mustInclude`, `strengths`, `tradeoffs`, `challenges`, `followUps`, `followUp`, `transfer`, `reference`, `sources`, `note` or `correctedText`.
  - **Exceptions (JSON-path patterns, `[]` matches any index; an allowed path also allows everything beneath it) (C5):**
    - stop response: `reveal` (a hit's reveal for that statement only; `null` otherwise);
    - clarification response: `reveal` (the matched clarification only);
    - `assist` response: `reference` (the learner asked for it, and from then on the attempt is assisted);
    - `GET …/schedule`: `plan[].blocks[].kind`;
    - `GET …/progress`: `concepts[].readiness.transfer`;
    - `answers.next.prompt` and `exercise.firstPrompt` carry question text only (no listed key);
    - `complete` and later responses for the attempt carry the reveal and are not scanned.
- **FR-005:** The browser MUST NOT import any module under `server/` or `shared/mock-grader.js`, and MUST NOT compute detection, dimensions or attribution.

**Catch attempt API** (shapes in tasks.md F1c-T04)
- **FR-006:** `POST /api/practice/attempts` MUST create an attempt `pra_<ULID>`, write `started` and return `{attemptId, exercise, assistAllowed}`.
- **FR-007:** `POST /api/practice/attempts/:id/stops` MUST:
  - resolve attribution (FR-012);
  - grade a hit with the grader;
  - write `stopped`, `explained` and `graded` in one `appendEvents` call, after grading, with no `await` between reading the attempt's events and appending;
  - return the stop response.
  - Order and replay rules are as in the edge cases. Grading is synchronous, so no in-flight state exists (ADR 0008 ARCH-7).
- **FR-008 (repeat stops; revision 3, PD-6, W-S1):** the stop request MAY carry `stopId: string` (`^[A-Za-z0-9_-]{8,64}$`, else 400), a random id the client makes once per STOP press and re-sends on Try again.
  - A stop whose `stopId` equals a stored stop's `stopId` on the same `statementId` MUST return a body identical to that stop's first response, and write no events. On a different `statementId` it MUST return 400.
  - A stop with a new `stopId` MUST be processed as a new stop (FR-007, FR-012), even when the statement already has a stop.
  - A stop without `stopId` on a statement that already has a stop MUST return the stored body of the latest stop on that statement, and write no events (the revision-2 rule).
  - The server stores `stopId` in `stopped.result.stopId`, only when the request carried one (additive; readers treat a missing value as `null`).
- **FR-009:** `POST /api/practice/attempts/:id/complete` MUST be idempotent. It writes `completed` once, and returns the summary, missed reveals, answered parts with results and rubrics, references, sources, `followUp.question` and `transfer.scenario`.
- **FR-009a (skipped stops; revision 3, ADR 0002 Am. 4, PD-5, W-B2):** the complete body MAY carry `skipped: [{statementId: string, elapsedMs?: number}]`.
  - **Validation:** `skipped` is absent, `null` or an array of at most 20 objects, and each `statementId` is a narration id of the exercise. Anything else → 400. `elapsedMs` follows the stop rule: missing, negative or non-integer means no grace attribution.
  - **Attribution:** each entry is attributed with the FR-012 rule, independently, against the stops graded so far. An entry that comes out `hit` or `late_hit` on a planted statement that is still uncaught makes that statement **not graded**.
  - **Reached range:** `lastIdx` = the maximum of `lastStatementId`'s index, every stop's index and every skipped entry's index.
  - **Stored record, in `completed.result`:**
    - `skippedStatementIds`: the entries' `statementId`s, in request order, without duplicates;
    - `notGradedStatementIds`: the not-graded planted ids, in narration order, without duplicates;
    - both are always written, possibly `[]`;
    - `missedStatementIds` and `misses` exclude not-graded ids. Caught, missed, not-graded and not-reached are disjoint and together cover every planted statement.
  - **Response:** `missed[]` lists the union of `missedStatementIds` and `notGradedStatementIds` in narration order. Each item for a not-graded statement carries `notGraded: true`; other items have no `notGraded` key. Both lists are read from the stored event (a missing `notGradedStatementIds` reads as `[]`), never recomputed. `summary` keeps its shape.
  - After the first `complete`, a repeat call ignores `skipped` and `lastStatementId` (FR-009).
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
    - `tradeoffs` (the common follow-up, when it has a rubric);
    - `defense` (rubric-bearing interview follow-ups and scenario challenges).
  - It never returns a numeric score to the client.
- **FR-014:** Each `graded.result` MUST record `graderSource: "matcher"` and `graderVersion` (`MATCHER_VERSION`; `"matcher@2"` from Wave A.1). Any change to matcher rules bumps it. Grades already stored under an older version are never regraded or rewritten (inv. 6), and SC-004 κ is reported per `graderVersion`.
- **FR-015:** After `POST …/assist` (only when `mode ≠ diagnostic`), every later `graded` in the attempt MUST carry `assisted: true`. Earlier ones keep `false`. No hint, reference or correction is sent before an answer unless assist was requested.
- **FR-016:** `POST …/self-ratings {part, rating: "had_it" | "partly" | "missed_it"}` MUST write `self-rated` with the matcher's `overall` (or dimension status) for that part copied into `result.matcherStatus`, or `null` for a self-rated-only part. This allows κ to be computed from single events.
- **FR-017 (item match):** a rubric item MUST count as matched when any of its `|` alternatives is matched (C1). An alternative with n content tokens is matched when at least `ceil(0.6 × n − 1e-9)` of them appear in the answer; alternatives with n ≤ 2 need all of them.
  - **Content tokens:** stopword-free tokens of ≥ 2 chars, after lowercasing and removing apostrophes (`wouldn't` → `wouldnt`). **Negators are content tokens and never stopwords** (PD-2).
  - **Negators:** `not`, `no`, `never`, `isnt`, `arent`, `doesnt`, `dont`, `didnt`, `cannot`, `cant`, `wont`, `wouldnt`, `shouldnt`, `without` (`MATCHER_RULES.negators`).
  - **Token match:** matched at word start with light stemming (the mock-grader technique), and plain plurals of 4-letter words are stripped ("runs" → "run"). Each token may also be satisfied by any of its pack `lexicon.synonyms` forms. Lexicon lookups go one way: a rubric token equal to a key (or its stem) is satisfied by that key's forms, never the reverse. (Confirmed as built, Wave A code review.)
  - `matched` and `missing` report the whole item string, alternatives included.
  - The matched forms are removed before the stuffing check.
- **FR-018 (status):**
  - `met` if matched items ≥ `ceil(items × 2/3 − 1e-9)` (PD-3: 2 of 3, 2 of 2, 3 of 4);
  - `partial` if ≥ 1 item matched;
  - `not_met` if none matched and the answer has < 20 content words.
  - Answers with < 3 content words are `not_met`.
  - All ratios, counts and the epsilon are named constants in `MATCHER_RULES` (provisional).
- **FR-019 (stuffing; `matcher@2`, revision 3, PD-4, F1c-B20):** a `met` status MUST be capped at `partial` when **both** of these hold:
  - (a) ≤ `stuffedMaxRest` (2) content words remain after removing every matched form (all dimensions and the matched `acceptableCorrections` entry), unchanged from `matcher@1`;
  - (b) the answer's **function-word share** is < `stuffedMaxFunctionShare` (**0.2**, provisional, PD-4).
  - **Function-word share** = (the number of the answer's words that are in the matcher's existing generic-English `STOPWORDS` list) ÷ (the number of the answer's words). "The answer's words" are every word token, before stopword and length filtering: the same tokens the negation window counts. An answer with 0 words has share 0. `STOPWORDS` is unchanged, holds no negator and no subject word, and the rule adds no vocabulary.
  - **Why:** a keyword list has no grammar, and a concise correct sentence always does. Condition (a) alone capped concise correct sentences (F1c-B20).
- **FR-020 (alternatives):**
  - `correction` is `met` if `rubric.correct` is met, or if any one `acceptableCorrections` entry, treated as a single item, is matched.
  - A scenario design is matched against each `acceptableArchitectures[].mustInclude` set that exists, and the best one counts.
  - Wording is never penalized: no length, order or phrasing rule exists beyond FR-017–FR-022.
- **FR-021 (uncertain):** the dimension MUST be `uncertain`, with confidence `low` and no score, when any of these holds:
  - (a) none matched and the answer has ≥ 20 content words;
  - (b) a negator occurs within 3 tokens before a token that matched an item, **unless that item's matched alternative itself contains a negator** (PD-2). The window counts every word, stopwords included, and stops at a sentence or clause break (`. ; : ! ?`);
  - (c) the answer covers ≥ 80% of the content tokens of the flawed statement's text, and no correction alternative is matched.
  - A matched red flag (FR-022) or an echo (c) makes **every** dimension of that answer `uncertain`. (Confirmed as built, Wave A code review.)
- **FR-022 (red flags):** a `redFlags` item counts as matched only when it matches under FR-017 **and** no negator occurs within 3 tokens before any of its matched tokens (PD-2). A matched red flag MUST make its dimension `uncertain`, and MUST be listed at reveal. A negated red flag is neither counted nor listed. The same un-negated rule applies to `strongSignals` (confirmed as built, Wave A code review).
- **FR-023 (seam):** the practice service MUST take its grader as an injected function, `grader(input: GraderInput) → GraderOutput`, **synchronous in F1c (ADR 0008 ARCH-7)**; shapes in tasks.md. `createPracticeService` throws `TypeError` if `grader` isn't a function. The default is the matcher. A future live grader goes through the existing gateway with the matcher as its fallback, and making the seam async needs its own ADR amendment. No prompt is added in F1c.

**Voice and text (web)**
- **FR-030:** STOP (hotword, button or Space) MUST call `stopSpeaking()` synchronously in the handler and keep `{statementId, statementIndex, elapsedMs}` of the interrupted statement.
- **FR-031:** The hotword MUST listen only while narrating. Explanations are recorded only after a STOP.
- **FR-032:** If the current statement's text contains a hotword phrase, the hotword fires only when one recognition segment (`onSegment`), trimmed and lowercased, equals that phrase.
- **FR-033:** The answer textarea MUST stay editable while and after dictating. Typing stops dictation. Nothing auto-submits.
- **FR-034:** A final segment (`onSegment` with `isFinal: true`) equal to "send" or "send it" MUST submit the answer, with the command removed. "done" MUST stop dictation without submitting.
- **FR-035:** Every `speak()` argument MUST equal the `textContent` of the element showing it, normalized with `replace(/\s+/g, ' ').trim()`.
- **FR-036:** Text mode MUST offer the full flow without a mic. Voice mode MUST fall back to text, for the session, on `mic.denied` conditions. The Stop button and Space always work.
- **FR-037:** After a hit, the client MUST show and speak `say.corrected`, then resume at the next statement. After a late hit or a false interruption, it MUST restart the interrupted statement from its beginning.
- **FR-038:** The client MUST send `via: "voice" | "button" | "key"` and `stopLatencyMs`, the time from the hotword or keydown to the `stopSpeaking()` call, or `null`.
- **FR-039 (source links, C13):** each source MUST render as an `<a>` whose `href` is set by property (never by markup), with `rel="noopener noreferrer"`, and its title set with `textContent`. Only `https://` URLs reach the client (validator).
- **FR-058 (hands-free chaining, C11):** after the one tap that starts a session, every transition MUST be reachable by voice in voice mode and by a button in text mode:
  - "next" / Next in the reveal and `done` states starts the next exercise in today's plan (`nextInPlan`, F1c-T10), or speaks `plan.done` and opens the progress page when the plan has no exercise left. Before F1c-T10 merges, Next opens the picker.
  - "review" / Review weak spots and "diagnostic" / Run the diagnostic on the progress page, per US6.4 and US6.6.
  - Commands are parsed only in their listed state (`parseCommand`), and each has a unit test.

**Other modes**
- **FR-040:** `POST /api/practice/attempts/:id/answers {part, answer}` MUST accept these parts by type:
  - learn: `teachBack:<i>`;
  - interview: `interview`, `followUps:<i>`;
  - scenario: `design`, `challenges:<i>`;
  - any type, after complete: `followUp`, `transfer`.
  - Main parts must be answered in order (otherwise 400). A repeat returns the stored body.
- **FR-041:** For main parts, the response MUST be `{part, next: {part, prompt} | null}` with no result. Results come at complete. For `followUp` and `transfer`, it MUST be `{part, result, rubric}`. A string `followUp` or string `followUps:<i>` gets `result: null` (and `rubric: null`) and is self-rated only.
- **FR-042:** `POST …/clarifications {question}` (scenario only, before `design`) MUST return `{reveal: string | null}`. It matches `askAbout` terms with the FR-017 token rules, returns the first matching clarification, and writes `clarified`.
- **FR-043:** The scenario design status MUST be the lower of the `rubric.mustCover` status and the best architecture status, ordered `not_met < partial < met`. `uncertain` wins over all of them. If no architecture has `mustInclude`, the design status equals the `mustCover` status (C2).

**Progress**
- **FR-050:** Events MUST use the existing `event` table. The new verbs are `self-rated`, `assisted` and `clarified` (ADR 0002 Amendment 3). Shapes are in "Events and metrics" below.
- **FR-051:** `GET /api/practice/tracks/:track/progress` MUST be a pure projection of practice events, `projectPractice(events, track, exercises)` (C14). Events come from `db.eventsForEngine({actor, engine: 'practice'})` (no index, no migration; ADR 0002 Amendment 3), filtered by `context.subject` matching `^<trackId>@` across versions. Events for exercise ids absent from the current pack version are left out of mastery and readiness, and counted in `counts` (C9). Rebuilding it from the log after a restart gives an identical body.
- **FR-052 (mastery, provisional):**
  - The projection keeps two series per concept, `independent` and `assisted`, never merged.
  - Each confident result for an exercise's part counts toward all of that exercise's `concepts`: `met` = 1, `partial` = 0.5, `not_met` = 0, and a miss counts as a detection 0.
  - **Revision 3 (ADR 0002 Am. 4):** a `graded` event with `overall: null` (a false interruption) records a detection, not a grade, and is never a mastery input. A not-graded statement (`completed.result.notGradedStatementIds`) counts neither as a hit nor as a miss.
  - `score` = mean of the last 5 results; `n` = their count.
  - `level` is `none` (n = 0), `learning` (< 0.6), `developing` (< 0.8) or `strong` (≥ 0.8 and n ≥ 3).
  - `uncertain` results are excluded and listed in `flagged[]`.
- **FR-053 (readiness, provisional product choice; PD-1):** each concept has five criteria, each met by independent confident results on exercises covering the concept only. A "gradable defense part" is a scenario `challenges:<i>` or a rubric-bearing interview `followUps:<i>`.
  - `explainUnaided`: interview `explanation` or scenario design `met`. A learn teach-back given right after the narration does not count (LR-1);
  - `detectAndCorrect`: ≥ 2 distinct planted statements with detection `hit`/`late_hit` and correction `met`;
  - `transfer`: transfer `met`;
  - `failureModesTradeoffs`: a rubric-bearing `followUp` with `tradeoffs` `met`, **or** `defense` `met` on ≥ 2 distinct gradable defense parts;
  - `defendDecision`: `defense` `met` on ≥ 1 gradable defense part.
- **FR-054:** a criterion that no exercise in the pack can satisfy for that concept MUST be reported as `"n/a"`, never as met. `failureModesTradeoffs` is `n/a` when no covering exercise has a rubric-bearing `followUp` and the covering exercises have < 2 gradable defense parts in total; `defendDecision` is `n/a` when they have none. String follow-ups never make a criterion satisfiable.
- **FR-055:** `GET /api/practice/tracks/:track` MUST return the modules and exercise summaries (F1c-T04). `GET /api/practice/tracks/:track/schedule` MUST return the schedule with `today` = 1 + the number of distinct UTC dates with a practice `started` event before today's date, capped at `days`, and per exercise `done` = a practice `completed` event exists for that exercise id (F1c-T08).
- **FR-056:** `GET /api/practice/tracks/:track/review` MUST return up to 3 concepts with n ≥ 1 or a flagged item, lowest independent score first. Each comes with the least recently attempted exercise covering it.
- **FR-057:** a diagnostic attempt is `POST /api/practice/attempts` with `mode: "diagnostic"` for an id in `schedule.diagnostic`. It has `assistAllowed: false`. Its results feed mastery like any independent result.

## Events and metrics
Shapes are binding per **ADR 0002 Amendment 3** (C10). All events are server-written through `db.appendEvents`. Each passes `validateEvent`.
- **context:** `{subject: "<trackId>@<version>", attemptId: "pra_…", promptVersions: {}, engine: "practice", module, mode: "practice" | "diagnostic" | "review", exerciseType}`. Readers treat a missing `engine` as `"card"`.
- **object:** `{type: "exercise", id: exerciseId, statement?: statementId, part?: part}`. `object.step` is never used: it is an integer in ADR 0002. **`self-rated` events MUST carry `object.part`** (C10).

| Verb | When | `result` | Used by |
|---|---|---|---|
| `started` | attempt created | `{assistAllowed}` | completion rate, `today` |
| `stopped` | catch stop graded (one transaction with the next two) | `{attributedStatementId, detection, elapsedMs, via, stopLatencyMs, stopId?}`; `stopId` only when the request carried one (FR-008) | time-to-STOP, stop latency (voice-first §3) |
| `explained` | with every stop or answer | `{text, chars}` (text ≤ 2000) | grader agreement relabels |
| `graded` | with every stop (a false interruption gets `overall: null`, `outcome: false_alarm`) and every answer | `{dimensions: {<name>: Dim & {confidence}}, overall, outcome?, assisted, confidence, graderSource: "matcher", graderVersion, latencyMs}`; `outcome` for stops: `caught` / `caught_late` / `false_alarm`. A false interruption's result is exactly `{dimensions: {}, overall: null, outcome: "false_alarm", assisted, confidence: "high", graderSource: "matcher", graderVersion, latencyMs: 0}` (ADR 0002 Am. 4, F1c-B21) | mastery, readiness, fallback rate (0 here), false-alarm rate. **Reader rule (Am. 4):** grader metrics (SC-004) and mastery count only `overall !== null` |
| `completed` | complete (once) | `{hits, lateHits, misses, falseInterruptions, notReached, cleanPass, flagged, missedStatementIds, notReachedStatementIds, skippedStatementIds, notGradedStatementIds}`. The last two are added in revision 3 (FR-009a); readers treat a missing one as `[]` | catch rate, clean-pass rate, skip rate |
| `assisted` **(new)** | first assist in an attempt | `{kind: "reference"}` | assisted vs independent |
| `self-rated` **(new)** | each rating | `{rating, matcherStatus, graderVersion}` | κ (SC-004) |
| `clarified` **(new)** | each clarification question | `{text, chars, revealIndex: int \| null}` | scenario behavior |

## Success criteria (measurable; AI-quality thresholds pre-registered from data-and-evidence.md §5)
- **SC-001 (leak):** `practiceLeakScan` finds 0 FR-004 keys outside the FR-004 exception paths in 100% of runs, scanning every response for an attempt before that attempt's `complete`, and every response from `GET /api/practice/tracks`, `/tracks/:track`, `/tracks/:track/schedule`, `/tracks/:track/progress` and `/tracks/:track/review` (C5).
- **SC-002 (isolation):** the F1a golden replay shows 0 diffs after each F1c wave, including after F1c-T06's `onSegment` addition. Every pre-F1c test passes unchanged, except the listed `old → new` edits in F1c-T01a, F1c-T02 and F1c-T04. Across all F1c tickets, `git diff` is empty for the "Untouched" list above.
- **SC-003 (matcher, labelled set, functional gate):** on the QA-labelled set in `tests/fixtures/practice/labelled-answers.json` (≥ 40 answers, ≥ 8 per class, including `|` items, negated rubric items and negated red flags):
  - `clear` → `met` 100%;
  - `incorrect` → never `met` (100%);
  - `valid-alternative` → never `not_met` (100%), and `met` ≥ 75%;
  - `partial` → `partial` or `uncertain` ≥ 80%;
  - `should-flag` → `uncertain` ≥ 80%;
  - `uncertain` on the `clear` and `incorrect` classes ≤ 20%.
  - **Revision 3:** the set also holds F1c-T15's added rows (≥ 1 keyword list padded with one article, expected `partial`; ≥ 1 more short correct sentence, expected `met`), and SC-003 must pass on the enlarged set.
  - **SC-003b (module-1 set, same thresholds, gate for F1c-T11):** the same per-class thresholds on `tests/fixtures/practice/m1-labelled-answers.json`, built from the learning-designer's `docs/research/applied-ai/module-1/exercises/_matcher-test-answers.json` (its `expected` values; a row whose expected value lists alternatives, such as "partial or not_met", passes on any of them), graded against `packs/applied-ai` with its `lexicon`. **Revision 3:** the set is `rows` plus F1c-T15's `qaRows`.
- **SC-012 (FR-019 on module-1 wording, gate for F1c-T12's merge; revision 3, PD-4):** on the `qaRows` of `m1-labelled-answers.json` (≥ 2 keyword lists and ≥ 2 short correct sentences, all on module-1 catch stops), graded against the research drafts in `docs/research/applied-ai/module-1/exercises/` with `draftSynonyms` as the lexicon:
  - keyword-list rows → `overall` `partial` in 100% of rows;
  - short-correct rows → `overall` `met` in 100% of rows.
  - **Validity check, recorded once by QA before T12 merges:** under `matcher@1`, every short-correct row comes out `partial`, which proves the rows exercise FR-019(a).
  - From F1c-T11 on, SC-003b covers these rows against `packs/applied-ai`, and SC-012 remains as a regression check.
- **SC-004 (AI quality in use, pre-registered, reported, not a ship gate):** over the founder's first 7-day schedule, with ≥ 30 self-rated parts:
  - Cohen's κ between `matcherStatus` (met / partial / not_met) and the self-rating (had_it / partly / missed_it) is ≥ 0.6 on non-uncertain parts;
  - the `uncertain` share of graded parts is ≤ 10%.
  - Both are computed only over `graded` events with `overall !== null` (ADR 0002 Am. 4), reported per `graderVersion`.
  - **A miss on either** makes the live grader (Later) the next priority once a key exists. Only the PM changes these thresholds, in a thread.
- **SC-005 (text loop):** the e2e runs a catch exercise (2 planted, 1 late hit, 1 false interruption) and a zero-planted exercise to their reveals, keyboard-only, at 390 px and 1280 px, with 0 console errors. **No console message is filtered or exempted**; the favicon 404 is fixed on the practice page (PD-8). Errors the test itself causes on purpose (injected network aborts) are asserted separately and are not part of this count.
- **SC-006 (barge-in):** from a hotword stub event or a Space keydown, `speechSynthesis.cancel()` is called within 300 ms of fake-clock time, in 100% of e2e runs.
- **SC-007 (spoken = shown):** every `speak()` argument in the e2e equals the normalized `textContent` of its element.
- **SC-008 (deny-list):** the deny-list test passes with the Applied AI words and `applied-ai` added, and `deny-list-allow.json` is unchanged.
- **SC-009 (rebuild):** `projectPractice` over the stored events equals the frozen expected progress body, before and after a server restart on the same DB file.
- **SC-010 (degrade):** an invalid practice pack leaves the server up, logs one `[practice]` warning, `/api/practice/tracks` omits the pack, and `listSubjects()` from `server/packs.js` deep-equals the same call with no practice pack, with no `[packs]` warning logged (C3).
- **SC-011 (hands-free):** in the e2e voice run, after the one Start tap, a catch exercise, the next exercise via "next", and a review started via "review" on the progress page complete with 0 clicks (FR-058).

## Non-goals / Later
- Defend-my-build mode (must be grounded in the real repository; never fabricated).
- Curriculum modules B–G, and the AWS mapping (docs.aws.amazon.com is blocked here; sources stay `verified: false` until checked). The learning-designer recommends module 2 (agents) next (REVIEW.md H7).
- Live LLM grader: new prompt, gateway call, eval gate, recordings, async seam with an in-flight join (ADR 0008). Only the sync seam (FR-023) ships now.
- Rubric-bearing follow-ups for the remaining module-1 `followUp` and `followUps` strings (PD-1); the authoring standard from module 2 on.
- `diagnostic.json`'s 10 items as a new exercise type.
- Parallel exercise sets and interleaved review (REVIEW.md H6, M6).
- Moving the PMP drafts into this engine as a second pack.
- "change that", "repeat", "pause", "slower"/"faster", earcons, the silence prompt (OI-14), auto-continue setting, reference read-aloud.
- Editing the schedule in the UI (file only in F1c), a subject picker across engines, FSRS spacing, the trained / held-out experiment, mode A/B assignment.
- Offline queue and PWA install for the practice page.
- Retiring the old game or merging the two engines (ADR 0008 convergence trigger before F2's Session Engine is specced). Consolidating the matcher with `shared/mock-grader.js` after F1a-T13b.
- An expression index for `eventsForEngine`, only if progress p95 is measured above 100 ms.
- **From Wave A.1 (revision 3):**
  - a `summary.notGraded` count and a `sum.line` variant that mentions skipped stops (PD-5);
  - an `err.net` variant for a failed `complete`, whose text doesn't mention "your answer" or skipping. Today the same `err.net` string is shown, with no Skip button;
  - voice commands for "try again" and "skip" at `err.net` (see OQ-7);
  - F1c-B11 (FR-021(a) per dimension vs per answer) and B12/B13 (lexicon gaps): these are SC-003b and F1c-T11 work, not Wave A.1.

## Assumptions
- One learner (`learner_1`), one server process per DB file (ADR 0003 Amendment 3).
- Content is the drafts in `docs/research/applied-ai/module-1/` (founder-owned), reviewed in `REVIEW.md`, and moved by F1c-T11 with format-only mapping (C12), plus PD-1's two follow-up rubrics and the draft `lexicon.synonyms` from `_matcher-test-answers.json` if the author agrees.
- The practice page runs in both `npm run mock` and `npm start`, because it makes no AI call.
- The interview date is unknown ("this week or next", lead EVIDENCE in thread 0007), so Wave A ships first.

## Open questions
- **OQ-1** [NEEDS CLARIFICATION: founder] Who signs off module-1 content accuracy before F1c-T11 moves it: the founder, the learning-designer, or both? The proposal is that the learning-designer reviews pedagogy (done: REVIEW.md) and the founder confirms the facts, both recorded in thread 0007.
- **OQ-3** [NEEDS CLARIFICATION: founder] Is "configurable schedule" satisfied by `schedule.json` alone in F1c? A UI setting is listed under Later.
- **OQ-5** [NEEDS CLARIFICATION: founder] Confirm the architect's ARCH-2 reading in thread 0007: the F2 hard rule doesn't block practice packs that enter no prompt (ADR 0006 Amendment 3). Blocks F1c-T11's merge only.
- **OQ-6** [NEEDS CLARIFICATION: content author] Accept PD-1's two follow-up rubrics (catch-06, catch-08) and the draft synonym list into `packs/applied-ai`? If not, T11 moves the content without them.
- **OQ-7** [NEEDS CLARIFICATION: principal-architect, for F1c-T06 scope] Invariant 8 says every flow works hands-free, but `err.net` has only buttons, both in the card game and here. Should T06 add "try again" and "skip" as voice commands in a network-error state? I lean yes, as two rows in the command table. This was not introduced by Wave A.1.
- Resolved in revision 2: OQ-2 (date unknown; Wave A first), OQ-4 (C2 and C12 accept the drafts' shapes with format-only mapping).

## Learning review
Requested from `learning-designer`; LR-1 to LR-8 are not in yet. The PM decides and records each call here. The designer's independent content review (REVIEW.md) is in: B1 → C1; B2 → PD-2; B3 → PD-3; B4 → PD-1. H1–H7 and M1–M6 are content items for the author, or Later.
- **LR-1:** Does a teach-back given right after the narration count as "explain unaided"? My call: no (FR-053).
- **LR-2:** Should catch feedback be immediate (after each stop) or deferred to the reveal?
- **LR-3:** Should interview and scenario results be withheld until complete?
- **LR-4:** Is the 3-point self-rating scale right, and is "self-rating against the reference" enough without a delay?
- **LR-5:** Is `GRACE_MS` = 2000 right?
- **LR-6:** Are the mastery and readiness thresholds sensible as provisional values?
- **LR-7:** Is "assisted = reference viewed" the right definition?
- **LR-8:** How should the diagnostic be composed?
- **LR-9 (revision 3):** Is `stuffedMaxFunctionShare = 0.2` (PD-4) right from a learning point of view? Specifically: should a terse but correct spoken answer ever be capped at "Partly covered"? My call for now: 0.2, revisited on the T01b dictated rows.
- **LR-10 (revision 3):** Is the `missed.notGraded` wording right: "Not scored, you skipped this stop: …"? Should a skipped statement show its correction at all, or stay hidden for a later retry? My call for now: show it (ADR 0002 Am. 4 says the reveal still shows the correction).
- LR-9 and LR-10 are requested in thread 0007. They are advisory and do not block Wave A.1's merge. If a finding arrives before F1c-T16 is verified, I record my decision on it here.

## Architecture rulings (design review 2026-10-13; all ruled)
| # | Ruling | Recorded in |
|---|---|---|
| ARCH-1 | (a) one guarded line in `server/packs.js`; F1c-T02 → F1a-T18 | ADR 0008 |
| ARCH-2 | the F2 hard rule doesn't block F1c; founder confirms before F1c-T11 merges (OQ-5) | ADR 0006 Am. 3, ADR 0008 |
| ARCH-3 | practice pack format v1 accepted with C1 and C2 | ADR 0008 |
| ARCH-4 | 3 verbs, `context.engine`, `pra_`/`att_` isolation, `object.type: "exercise"` | ADR 0002 Am. 3 |
| ARCH-5 | (a) server-only `server/services/practice-matcher.js` | ADR 0008 |
| ARCH-6 | `web/practice/speech.js` is the single speech import; `onSegment` added by F1c-T06; F1a-T15 rewrites that one file | ADR 0008 |
| ARCH-7 | synchronous grader seam in F1c | ADR 0008 |
| ARCH-8 | `json_extract` filter, no index, no migration | ADR 0002 Am. 3 |
