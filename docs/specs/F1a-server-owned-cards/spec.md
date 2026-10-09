# F1a: Server-owned cards on the new foundation

**Status:** Draft
**Phase:** F1 | **Links:** docs/foundation/system-architecture.md, docs/foundation/data-and-evidence.md, docs/foundation/voice-first.md, docs/foundation/decisions.md (D7, D8, D10, D12, D13), docs/team/threads/0003-f1-engine-core-proposal.md (architect DECISION and PM DECISION are binding)

## Problem

Today the server sends every planted mistake (`step.error`: severity, summary, why, correctAction, consequence, keywords) to the browser before the learner says anything (`server/index.js:159-165`), and the browser resolves STOPs, scores the run and even grades offline from those answers (`web/app.js:117,161,211`; `web/api.js:36`). That breaks invariant 2 (D12), so no grade or score can be trusted as evidence. Nothing is stored: there is no event log, no card record and no LLM call log, so F2 (learner model, resume, planner) has nothing to build on. Subject words also sit in engine code (`shared/scoring.js:74-79`, `shared/mock-grader.js:12-25`, `web/app.js:228`). F1a moves cards, STOP resolution, grading and scoring to the server, records every action as an append-only event in SQLite, puts the trades content into `packs/demo-trades`, and proves with a golden replay that the learner sees and hears exactly what they did before.

**Scope boundary (from thread 0003):** F1a changes **no prompt text and no model-facing schema**. Prompt rewrites, fencing pack text, the `SCENARIO_SCHEMA.trade` rename and the eval scaffold are F1b.

## Glossary (used throughout)

| Term | Meaning |
|---|---|
| **Card** | The stored content of one playable scenario (title, setting, apprentice, steps with their hidden mistakes). Server-only. |
| **Public card** | `{id, subject, title, setting, apprentice, steps:[{id, line}]}`. The only card data the browser ever receives before grading. |
| **Attempt** | One play of one card, identified by `attemptId`. Its state (caught set, points, total) is rebuilt from events. |
| **Voice mode (F1)** | "Read aloud" is on (narration and feedback are spoken through `web/speech/`) and the learner may dictate the explanation with the mic button. The hotword "stop" and voice commands are F2 (`voice-first.md` §7). |
| **Text mode (F1)** | "Read aloud" is off (reading-time pauses instead of speech) and the explanation is typed, then Enter or Submit. |
| **Golden run** | One scripted play recorded by the harness: displayed strings, spoken strings, outbound prompts, grading outcomes. |

## User stories (prioritized; each independently testable)

### US1: Play a card whose answers stay on the server (P1)
The learner picks a job, starts it, listens to or reads the narration, stops the apprentice, explains, hears or reads feedback, and sees the results. Everything looks and sounds exactly as it does today. The difference is invisible: the browser never holds a mistake's answer until that STOP is graded, and the results come from the server.

**Why P1:** It closes the only data-integrity hole in the product (inv. 2) and is the precondition for every F2 feature.
**Independent test:** Run the golden matrix against the F1a build; the learner-visible layer diffs empty against the baseline, and the leak scan finds no answer field in any response before the crediting STOP.

**Acceptance scenarios:**
1. **Given** MOCK mode and the setup screen with "Read aloud" checked (voice mode), **when** the learner picks "Electrical: replace a receptacle", presses "Start the job", presses STOP while line 3 is being spoken, dictates "he didn't test it, it could still be live" with the mic and presses Submit, **then** the feedback panel shows "Good catch!", the feedback text, "+N points" and "Graded by: keyword grader"; the string passed to `speak()` for feedback equals the text shown in `#feedback-text`; line 3 gets the `caught` class; the top-bar score equals the STOP response's `total`; and no response received before that STOP response contained `error`, `why`, `summary`, `consequence`, `keywords`, `severity` or `correctAction`.
2. **Given** the same setup with "Read aloud" unchecked (text mode), **when** the learner presses Space during line 3, types the same explanation and presses Enter, **then** the same verdict, feedback text, points and line marking appear, no `speechSynthesis.speak` call is made, and the same leak-scan condition holds.
3. **Given** voice mode, **when** the learner presses STOP during line 1 (a clean step with no mistake in the previous step) and submits "he should lock it out", **then** the panel shows "False alarm", the feedback is spoken exactly as displayed, "-75 points" is shown, line 1 gets `false-alarm`, and the STOP response has `caught: null` and no field naming or locating any other step's mistake.
4. **Given** text mode, **when** the learner does the same as scenario 3 by typing, **then** the same display results, with no speech.
5. **Given** voice mode, **when** the learner presses STOP during line 4 (one step after the critical mistake on line 3) and explains correctly, **then** the server credits the line-3 mistake with `stepsLate: 1`, line 3 (not line 4) gets `caught`, and points equal `scoreStop({severity:'critical', stepsLate:1, verdict, reasoningScore})`.
6. **Given** text mode, **when** the learner does scenario 5 by typing, **then** the same outcome.
7. **Given** voice mode and a learner who never presses STOP, **when** the last line finishes, **then** the results screen shows the pack's rating label "Someone got hurt", the total and max, "Caught 0 of 3 mistakes · 0 false alarms", the three missed mistakes with their summary, consequence and "Should have: …", and speaks "Here's what happened next. {critical consequence}". All of these values come from the `complete` response.
8. **Given** text mode and the same never-stop run, **when** the last line finishes, **then** the same results are displayed and nothing is spoken.
9. **Given** voice mode and a run where all three mistakes are caught on time with correct explanations, **when** the last line finishes, **then** the rating "Journeyman eyes" is shown and the pack's clean-run line "Clean job. Nobody got hurt." is spoken.
10. **Given** text mode and the same perfect run, **when** the last line finishes, **then** the same rating is shown and nothing is spoken.

### US2: The grader can't be reached (P1)
If the server can't be reached, or answers 5xx, when the learner submits an explanation, the learner is told plainly, keeps what they said, and can try again or move on. No grading happens in the browser.

**Why P1:** Removing the browser fallback (`web/api.js:36`) is required by inv. 2; without this panel the game would stall, breaking inv. 7.
**Independent test:** Abort the STOP request in Playwright (`page.route`); the panel appears with the exact copy, the explanation is still in the textbox, "Try again" re-sends it and "Skip" resumes narration.

**Acceptance scenarios:**
1. **Given** voice mode and a STOP on line 3 with an explanation entered, **when** the STOP request fails (network error, timeout after 12 s, or a 5xx), **then** the panel shows "Couldn't reach the grader. Try again or skip." with buttons "Try again" and "Skip", the same sentence is spoken once, the explanation textbox still contains the learner's text, focus is on "Try again", the score is unchanged and no line is marked.
2. **Given** text mode and the same failure, **then** the same panel and copy are shown, nothing is spoken, and focus is on "Try again".
3. **Given** the panel is showing (either mode), **when** the learner presses "Try again" and the server now answers, **then** the normal feedback panel appears for that STOP exactly as in US1, and the server holds exactly one graded STOP for that step.
4. **Given** the panel is showing (either mode), **when** the learner presses "Skip", **then** the panel closes, no points are added, narration resumes at the next line, and the STOP button is enabled again.
5. **Given** the panel is showing and "Try again" fails again, **then** the panel is shown again with the same copy (spoken again in voice mode) and the learner can still choose "Skip".

### US3: Results can't be loaded (P2)
The results screen now needs the network. If the `complete` call fails, the learner sees their running total and can retry.

**Why P2:** Only visible on failure, but without it the end of a run could stall (inv. 7).
**Independent test:** Abort the `complete` request in Playwright; the results-failure state appears with the running total, and "Retry results" loads the normal results.

**Acceptance scenarios:**
1. **Given** voice mode, MOCK mode, and an electrical run with one STOP on line 3 graded `correct` (+270 points), **when** the last line ends and the `complete` request fails, **then** the results screen shows "Couldn't load your results. Your score so far is 270." and a "Retry results" button, that sentence is spoken once, focus is on "Retry results", and "Run another job" is still available.
2. **Given** text mode and the same failure, **then** the same copy is displayed, nothing is spoken, and focus is on "Retry results".
3. **Given** the results-failure state (either mode), **when** the learner presses "Retry results" and the server answers, **then** the normal results screen of US1 scenarios 7–10 appears, and the totals equal those of a run where `complete` succeeded first time.

### US4: Every action is recorded as an append-only event (P1, system)
Each start, STOP, explanation, grade and completion is written to SQLite as an xAPI-shaped event. The attempt's state can always be rebuilt from those events.

**Why P1:** D7 and inv. 6; the F2 learner model and resume are projections of this log.
**Independent test:** Run an attempt against a server with a temp-file `DB_PATH`, then open the DB: the expected events exist in order, UPDATE and DELETE on `event` throw, and rebuilding the attempt from its events reproduces the `complete` response's total and caught set.

**Acceptance scenarios:**
1. **Given** a server with `DB_PATH` set to a temp file, **when** an attempt is started, receives two STOPs and is completed with `lastStepShown` equal to the last step id, **then** the `event` table holds, for that `attemptId`, in order: 1 `started`, `step-shown` for every step id from the first to the last exactly once, 2 each of `stopped`, `explained` and `graded`, and 1 `completed`; each carries `context.subject = "demo-trades@1"` and `context.attemptId`.
2. **Given** any row in `event`, **when** `UPDATE event SET verb='x'` or `DELETE FROM event` is run, **then** SQLite raises an error and the row is unchanged.
3. **Given** a completed attempt, **when** its events are passed to the attempt projection, **then** the projected total, caught step ids and false-alarm count equal the `complete` response.

### US5: Every AI call is stamped and logged (P2, system)
Every Claude call goes through `server/ai/gateway.js`, carries its prompt id and version, and leaves an `llm_call` row.

**Why P2:** D10 and inv. 3; cost and fallback metrics depend on it. Learners see no change.
**Independent test:** Against fake Claude, a live start and a live STOP produce two `llm_call` rows with `pipeline`, `prompt_version`, `model`, `ms`, `input_tokens`, `output_tokens`, `outcome`; fake Claude's `/__log` shows the `x-prompt-id` header on each request.

**Acceptance scenarios:**
1. **Given** LIVE mode against fake Claude (happy path), **when** a live attempt starts and one STOP is graded, **then** `llm_call` has one row with `prompt_version = "scenario@1"` and one with `"grade@1"`, both `outcome = "ok"`, `model = "claude-opus-5-5"`, `input_tokens = 1234`, `output_tokens = 321`.
2. **Given** fake Claude hangs, **when** a STOP is graded with `GRADE_DEADLINE_MS=1500`, **then** the response arrives within 2.5 s with `source: "mock-fallback"` and an `llm_call` row with `outcome = "timeout"` exists.
3. **Given** fake Claude receives a request without an `x-prompt-id` header, **then** it answers 500 and logs the request, so a misrouted call can't pass silently.

### US6: Subject words live in the pack, not the engine (P2)
Rating labels, the clean-run line, the keyword grader's synonyms and its false-alarm feedback come from `packs/demo-trades`. Engine code in `server/` (outside `server/prompts/`), `shared/`, `web/` and `scripts/` holds no deny-listed words. For demo-trades the learner sees and hears the identical strings.

**Why P2:** Inv. 1 and exit criterion (c); it is also how a second pack becomes possible in F2.
**Independent test:** The deny-list test passes with an allow-list containing only `server/prompts/*` entries and `shared/contract.js` `trade` (≤ 2, the `SCENARIO_SCHEMA` occurrences); the golden replay is unchanged.

**Acceptance scenarios:**
1. **Given** voice mode and a never-stop run, **when** results appear, **then** the rating label displayed is the pack's `ratings["missed-critical"]` value "Someone got hurt" (byte-identical to today's).
2. **Given** text mode and the same run, **then** the same label is displayed.
3. **Given** voice mode and a perfect run, **then** the spoken clean-run line is the pack's `copy.cleanRun` "Clean job. Nobody got hurt.".
4. **Given** text mode and MOCK mode, **when** the learner stops on a clean step, **then** the feedback text is the pack's `copy.falseAlarmFeedback` "That step was actually fine. Stopping the job costs time, so save the STOP for real hazards." (byte-identical to today's).
5. **Given** voice mode and MOCK mode, **when** the learner dictates "it could still have juice" on electrical line 3, **then** the verdict is the same as today's (the pack's synonym list maps "juice" to "live").

## Spoken and displayed copy (inv. 9)

F1a must not change any existing learner-facing string for demo-trades. The table lists every string the F1a tickets touch or move, plus the two new failure states.

| Moment | Displayed (exact) | Spoken in voice mode (exact) | Source after F1a | Voice input (F1) | Repair path |
|---|---|---|---|---|---|
| Narration line | `{apprentice}` label + `{line}` | `{line}` | Public card | — | — |
| Explain prompt | "What's wrong, and why?" | — | `web/index.html` (unchanged) | Mic button "🎤 Talk" / "■ Done talking" | Edit the textbox before Submit |
| Grading | Submit button reads "Grading…" | — | `web/app.js` (unchanged) | — | — |
| Feedback (no fix) | `{feedback}` | `{feedback}` | STOP response `feedback` | — | — |
| Feedback (with fix) | `{feedback} Here's the right way: {caught.correctAction}` | identical | STOP response `feedback` + `caught.correctAction`; joining copy stays in `web/app.js` | — | — |
| Verdict label | "Good catch!" / "Close…" / "Right moment, wrong reason" / "False alarm" | — (not spoken today; unchanged) | `web/app.js` | — | — |
| Points | "+{points} points" / "{points} points" | — | STOP response `points` | — | — |
| Grade source | "Graded by: Claude" / "keyword grader" / "keyword grader (fallback)" | — | STOP response `source`. The label "offline grader (fallback)" is **removed** (no browser grading). | — | — |
| MOCK false alarm feedback | "That step was actually fine. Stopping the job costs time, so save the STOP for real hazards." | identical | `packs/demo-trades/pack.json` `copy.falseAlarmFeedback` | — | — |
| **Grader unreachable (new)** | "Couldn't reach the grader. Try again or skip." + buttons "Try again", "Skip"; explanation kept in the textbox | "Couldn't reach the grader. Try again or skip." (once per showing) | `web/app.js` | Mic still available to re-dictate | "Try again" re-sends the textbox content for the same STOP; "Skip" drops the STOP and resumes narration at the next line |
| Rating label | e.g. "Someone got hurt", "Journeyman eyes", "Solid supervisor", "Keep watching", "Back to the classroom" | — | `complete` response `ratingLabel` (from `pack.json` `ratings`) | — | — |
| Results summary | "Caught {c} of {m} mistakes · {f} false alarm(s)" | — | `web/app.js` copy, values from `complete` | — | — |
| Missed item | "{severity} · missed · {points} pts", "**{summary}.** {consequence}", "Should have: {correctAction}" | — | `complete` response `missed[]` | — | — |
| Run end, a mistake missed | (heading "What happened next" and the missed list) | "Here's what happened next. {consequence of the critical, else first, missed}" | `web/app.js` copy + `missed[]` | — | — |
| Run end, nothing missed | — (see open item OI-9) | "Clean job. Nobody got hurt." | `complete` response `cleanRunLine` (from `pack.json` `copy.cleanRun`) | — | — |
| **Results unreachable (new)** | "Couldn't load your results. Your score so far is {total}." + button "Retry results"; "Run another job" stays visible | "Couldn't load your results. Your score so far is {total}." (once per showing) | `web/app.js`; `{total}` = last STOP response `total`, or 0 | — | "Retry results" re-calls `complete` (idempotent); "Run another job" returns to setup |
| Start failure | "Couldn't load the job: {message}" | — | `web/app.js` (unchanged) | — | Press "Start the job" again |

Hotword "stop", "change that", "skip" and other voice commands are F2. In F1a, every action in both modes is a button, Space or Enter.

## Edge cases

- **Same STOP sent twice** (retry after a lost response, double click, two tabs) → the second request with the same `stepId` returns the stored result of the first (200, identical body) and writes no new events. Concurrent duplicates are serialized per attempt; both get the same body. [ARCH DECISION NEEDED: ADR-xxxx card/attempt API — confirm "equal is not backwards" idempotent replay]
- **STOP on an earlier step than a previous STOP** → 400 `{error}`; no events written.
- **`stepId` not in the card** (0, negative, non-integer, string, missing) → 400.
- **STOP or complete on an unknown or malformed `attemptId`** → 404 `{error}`.
- **STOP after `complete`** → 409 `{error}`. [ARCH DECISION NEEDED: ADR-xxxx card/attempt API — status code]
- **`complete` called twice** → second call returns the identical body; exactly one `completed` event exists.
- **`complete` with `lastStepShown` below the last STOP's step, above the last step id, or not an integer** → 400.
- **Skip after a STOP that actually reached the server** (response lost) → the server's graded STOP stands; the `complete` totals (server truth) may exceed the browser's running total. The results screen shows the server values.
- **Empty explanation** → graded as today (MOCK: verdict `wrong`, reasoningScore 0; live: `(no explanation given)`).
- **Explanation longer than 2000 chars** → truncated to 2000 before grading (unchanged); non-string → coerced to string.
- **Body over 1,000,000 bytes** → 413. **Body not JSON, `null`, or an array** → 400. Never 500.
- **`subject` or `scenario` is `__proto__`, `constructor`, `toString`, `hasOwnProperty` or unknown** → 400 on `POST /api/attempts` and `GET /api/scenarios`.
- **Live generation fails, times out or returns an invalid scenario** → the pack card is served with `source: "fixture-fallback"` (unchanged behavior); the failed call has an `llm_call` row.
- **Live generation succeeds** → the card row is written before the response is sent; a crash after the write leaves an orphan card row, which is acceptable.
- **SQLite write fails** (disk full, locked) → the route answers 500 `{error:"server error"}` without crashing the process; the browser shows the US2 or US3 failure state.
- **Server restart mid-attempt with a file DB** → STOP and complete still work for that `attemptId`, because state is rebuilt from events.
- **An invalid pack in `packs/`** → that pack is skipped and logged at startup; the server still starts; its id answers 400 as unknown.
- **Path traversal or direct fetch of pack files** (`/packs/demo-trades/pack.json`, `/../packs/…`, `/shared/../packs/…`) → 403 or 404; pack content is never served statically.
- **No `git` or not a git checkout** (this cloud checkout reports "not a git repo") → the ownership test must neither fail nor skip silently. See OI-7.

## Functional requirements

### Card and attempt API
- **FR-001:** `POST /api/attempts` with body `{subject: "demo-trades", scenario: "<scenario id>", source?: "fixture"}` MUST return 200 `{attemptId, card: {id, subject, title, setting, apprentice, steps: [{id, line}]}, source}`. `source` is `"live"`, `"fixture"` or `"fixture-fallback"`. Before grading, nothing else may be sent: no key other than these may appear anywhere in the body. In MOCK mode or with `source: "fixture"`, the pack card is used.
- **FR-002:** `attemptId` MUST match `^att_[0-9A-HJKMNP-TV-Z]{26}$` (prefix plus ULID) and be unique per call; two attempts on the same card MUST NOT share caught state.
- **FR-003:** `GET /api/scenarios?subject=demo-trades` MUST return 200 `[{id, label}]` with the same ids, labels and order that `GET /api/trades` returns today: `electrical`, `hvac`, `automotive`.
- **FR-004:** `POST /api/attempts/:attemptId/stops` with body `{stepId, explanation}` MUST resolve the STOP on the server with `resolveStop` (current step, then up to `RULES.graceSteps` back, skipping already-caught mistakes), grade it (live with keyword fallback, or MOCK keyword), score it with `scoreStop`, and return 200 `{verdict, reasoningScore, feedback, source, points, total, caught}`. `total` is the sum of `points` over all graded STOPs in the attempt.
- **FR-005:** `caught` MUST be `null` when the STOP resolves to no mistake (false alarm), and otherwise exactly `{errorStepId, stepsLate, severity, correctAction}` for the credited mistake only. A response MUST NOT contain `why`, `summary`, `consequence` or `keywords` for any mistake, nor any field about a mistake other than the credited one.
- **FR-006:** The server, not the model, MUST decide false alarms, as today (`index.js:98-100`): no credited mistake → `verdict: "false_alarm"`; credited mistake and model says `false_alarm` → `verdict: "wrong"`. `source` is `"live"`, `"mock"` or `"mock-fallback"`.
- **FR-007:** A STOP whose `stepId` is not a step of the card, or is lower than the previous STOP's `stepId` in the attempt, MUST return 400 with no events written. A STOP equal to an already-graded STOP's `stepId` MUST return the stored body and write no events. STOPs for one attempt MUST be processed one at a time.
- **FR-008:** `POST /api/attempts/:attemptId/complete` with body `{lastStepShown}` MUST return 200 `{total, maxPossible, caughtCount, mistakeCount, falseAlarms, missedCritical, missed: [{stepId, severity, summary, consequence, correctAction, points}], ratingKey, ratingLabel, cleanRunLine}`. `missed[]` is the only place `summary`, `consequence` and `correctAction` of uncaught mistakes appear. Values MUST equal `scoreRun` on the stored card and the attempt's graded STOPs. [ARCH DECISION NEEDED: ADR-xxxx card/attempt API — the architect's entry names "the pack's clean-run line" without a field name; `cleanRunLine` and the exact `missed[]` item keys are the PM's proposal]
- **FR-009:** `complete` MUST be idempotent: the `completed` event is written once and repeat calls return the identical body. A STOP after `complete` MUST return 409.
- **FR-010:** Unknown or malformed `attemptId` MUST return 404; malformed bodies MUST return 400; bodies over 1,000,000 bytes MUST return 413; no input may produce a 500 or crash the process.
- **FR-011:** No response from any route, and no static file, MUST contain a mistake's `severity`, `summary`, `why`, `correctAction`, `consequence` or `keywords` before the STOP that credits that mistake, except `missed[]` in the `complete` response. Files under `packs/` MUST NOT be served statically.
- **FR-012:** By F1a close, `GET /api/scenario`, `POST /api/grade` and `GET /api/trades` MUST return 404. Until then they keep working unchanged so the web keeps running between waves.

### Storage and events
- **FR-013:** `server/db.js` MUST open SQLite via `node:sqlite` at `process.env.DB_PATH`, defaulting to `data/app.db` (directory created if missing; `data/` gitignored). It MUST run `server/migrations/NNN-*.sql` forward-only, each in a transaction, setting `PRAGMA user_version` to the migration number. The server MUST NOT detect that it is under test.
- **FR-014:** Migration `001` MUST create `event`, `subject_pack`, `card` and `llm_call` with the columns in `data-and-evidence.md` §2, plus triggers that `RAISE(ABORT, …)` on any UPDATE or DELETE of `event`.
- **FR-015:** `card` rows MUST be rejected by a DB constraint when `prompt_version` or `model` is NULL or empty. Pack cards are stamped `prompt_version = "none"`, `model = "none"`, `source = "fixture"`. [ARCH DECISION NEEDED: ADR-xxxx storage — stamp values for hand-authored cards]
- **FR-016:** The server MUST append these events (shapes in "Events and metrics"): `started` on attempt start; `stopped`, `explained` and `graded` for each new STOP; `completed` on the first `complete`; `step-shown` for each step id not yet recorded, up to the STOP's `stepId` (on STOP) or `lastStepShown` (on complete). There MUST be no per-line `step-shown` request from the browser.
- **FR-017:** Every event MUST carry `context.subject = "<packId>@<packVersion>"` (`"demo-trades@1"`), `context.attemptId`, and `context.promptVersions` `{scenario, grade}` as `"<promptId>@<VERSION>"`. Event `id` MUST be `evt_` plus a ULID. `actor` is `"learner_1"` (no accounts in F1).
- **FR-018:** The attempt state used by STOP and complete (caught set, last STOP step, points, total, completed body) MUST be computed from the attempt's events plus its card, by one pure projection function, not from in-memory state.

### Packs
- **FR-019:** `packs/demo-trades/pack.json` (pack format v1) MUST hold: `id`, `version`, `scenarios[]` (`id`, `label`, `card` path, `generation` = today's `brief`, `hazardHints`, `criticalHints`, `twists`), `ratings` (rating key → label), `copy.cleanRun`, `copy.falseAlarmFeedback`, and `grading.synonyms` (today's `SYNONYMS` object, verbatim). Its three card files are today's fixtures without the `trade` field. [ARCH DECISION NEEDED: ADR-xxxx pack format v1 — field names and rating keys]
- **FR-020:** Packs MUST be validated at load (structure plus `validateScenario` on every card). An invalid pack MUST be skipped with a logged reason, not crash the server. Each valid pack MUST be recorded once in `subject_pack` and each of its cards once in `card` (idempotent across restarts).
- **FR-021:** `shared/scoring.js` `scoreRun` MUST return a `ratingKey` (one of `missed-critical`, `excellent`, `solid`, `developing`, `beginning`, with today's thresholds) and MUST NOT contain rating label strings by F1a close. Labels come from the pack.
- **FR-022:** `shared/mock-grader.js` `mockGrade` MUST take the synonym map and the false-alarm feedback from the pack (`mockGrade(card, errorStepId, explanation, lexicon)`), with no subject words in the module. For demo-trades, every verdict, score and feedback string MUST equal today's.
- **FR-023:** For demo-trades, every learner-visible string (rating labels, clean-run line, false-alarm feedback, keyword verdicts) MUST be byte-identical to today's.

### AI gateway and prompt registry
- **FR-024:** Every Claude call MUST go through `server/ai/gateway.js`, keeping today's deadlines (`SCENARIO_DEADLINE_MS` 40000, `GRADE_DEADLINE_MS` 8000, env-overridable), `maxRetries: 1`, `AbortSignal.timeout`, structured JSON schema output, `server-side-fallback` beta and fallback-block parsing (`responseText`). `server/llm.js` MUST be deleted. `server/ai/models.js` holds only `MODEL` and the effort constants.
- **FR-025:** The gateway MUST send the request header `x-prompt-id: <promptId>@<VERSION>` (e.g. `grade@1`) on every call.
- **FR-026:** The gateway MUST write one `llm_call` row per attempted call: `id`, `at`, `pipeline` (= promptId), `prompt_version` (`"grade@1"`), `model` (the served model from the response, or `MODEL` on failure), `ms`, `input_tokens`, `output_tokens`, `cache_read`, `cost_usd` (NULL in F1a), `outcome` (`ok` | `timeout` | `refusal` | `fallback`, where `fallback` means any other failure that sent the caller to its non-AI fallback). It MUST keep today's `[claude] …` console lines byte-compatible with `tests/server.test.js` BRAIN-08.
- **FR-027:** Each prompt module MUST export `PROMPT_ID` (`"grade"`, `"scenario"`) and `VERSION` (`1`). No prompt text, template or schema may change in F1a; for every input, rendered `{system, user, schema}` MUST be byte-identical to today's. [ARCH DECISION NEEDED: ADR-xxxx gateway and prompt registry — export names `PROMPT_ID`/`VERSION` and integer versions]
- **FR-028:** `scenarioUserPrompt` MUST accept an optional `rng` (default `Math.random`) as its fourth parameter; for the same draws its output MUST be byte-identical to today's.
- **FR-029:** Grades and cards served without an AI call (MOCK, fixture, fallback) MUST be recorded: `graded.result.graderSource` and `card.source` always say which path served them. [ARCH DECISION NEEDED: ADR-xxxx gateway — whether MOCK paths also write `llm_call` rows with a `mock` outcome; the 0003 PM DECISION says "mock and fallback paths also log"]

### Web
- **FR-030:** The browser MUST hold only the public card, STOP responses and the complete response. `web/` MUST NOT import `/shared/scoring.js` or `/shared/mock-grader.js`, and MUST NOT call `resolveStop`, `scoreStop` or `scoreRun`.
- **FR-031:** When a STOP request fails (network error, 12 s timeout, or status ≥ 500), the browser MUST show the "Grader unreachable" state from the copy table, keep the explanation, and offer "Try again" and "Skip"; on a 4xx it MUST show the same state (a 4xx means a client bug; the learner still needs a way forward).
- **FR-032:** The results screen MUST be rendered from the `complete` response. When that request fails (network error, 12 s timeout, status ≥ 500), the browser MUST show the "Results unreachable" state from the copy table with "Retry results".
- **FR-033:** Every new string MUST be built once and passed both to the DOM and, in voice mode, to `speak()` (inv. 9).
- **FR-034:** All speech MUST go through `web/speech/index.js`, exporting `speak(text, {enabled, rate}) → Promise<void>`, `listen({onInterim}) → {result: Promise<string>, stop()}`, `onHotword(phrases, handler) → unsubscribe` (no-op in F1), `cancel()`, `wait(ms) → Promise<void>` and `capabilities: {canSpeak, canListen, hotword: false}`. `web/speech.js` MUST be deleted. Behavior MUST NOT change.
- **FR-035:** The browser MUST learn the subject id from the server, not from a hard-coded string in `web/`. [ARCH DECISION NEEDED: ADR-xxxx card/attempt API — PM proposal: `GET /api/health` adds `subjects: ["demo-trades"]`; alternatives: `GET /api/scenarios` without `subject` returns the only pack's list, or the deny-list exempts pack ids]
- **FR-036:** Learner-visible behavior MUST be unchanged for demo-trades (golden replay), except the two allow-listed failure states (US2, US3).

### Guardrails in `npm test`
- **FR-037:** A deny-list test MUST scan `server/`, `shared/`, `web/` and `scripts/` (excluding `packs/`, `fixtures/`, `tests/`) case-insensitively on word boundaries for the words in `tests/fixtures/deny-list.json`, and MUST fail on any hit not listed in `tests/fixtures/deny-list-allow.json` (`[{file, word, count}]`) and on any listed count above the actual count (counts only go down).
- **FR-038:** The deny-list seed MUST contain at least: `trade`, `trades`, `journeyman`, `electrical`, `electrician`, `hvac`, `automotive`, `receptacle`, `breaker`, `gfci`, `gfi`, `backstab`, `nitrogen`, `nitro`, `refrigerant`, `braze`, `brazing`, `extinguisher`, `caliper`, `jack stand`, `jackstand`, `de-energized`, `deenergized`, `nec`, `osha`, `epa`, `jobsite`, `got hurt`. Engine concept words (`apprentice`, `job`, `supervisor`, `step`, `mistake`) are not on the list.
- **FR-039:** A file-ownership test MUST map every tracked path to exactly one owner parsed from the `CLAUDE.md` table, failing if the parse fails. Its behavior without git is OI-7. `npm run check:ticket <id>` MUST compare a ticket's changed files with its `Files:` list.
- **FR-040:** `tests/helpers/fake-claude.mjs` MUST route on the `x-prompt-id` header (`kind` = the part before `@`) and MUST answer 500 and log any request without it. `/__log` entries MUST include `promptId`.
- **FR-041:** `npm test` MUST run `tests/**/*.test.js` (so `tests/acceptance/` runs), and `package.json` `engines.node` MUST be `>=22.13`.

## Events and metrics

All events are xAPI-shaped per `data-and-evidence.md` §1. Exact field layout is fixed by the event schema ADR. [ARCH DECISION NEEDED: ADR-xxxx event schema v1]

| Verb | When | `object` | `result` | Used by |
|---|---|---|---|---|
| `started` | `POST /api/attempts` | `{type:"card", id:cardId}` | `{source}` | Completion rate (F2), attempt identity |
| `step-shown` | Derived on STOP / complete | `{type:"card", id, step}` | — | Abandon step, time-to-STOP (F2) |
| `stopped` | New STOP | `{type:"card", id, step:stepId}` | `{outcome: "caught" \| "caught_late" \| "false_alarm", errorStepId, stepsLate}` | Catch rate (A/B primary metric in F3), calibration |
| `explained` | New STOP | `{type:"card", id, step}` | `{text, chars}` | Explanation quality, Mistake Miner (F4) |
| `graded` | After grading | `{type:"card", id, step}` | `{verdict, reasoningScore, graderSource, points, total, latencyMs}` | Fallback rate, κ (F3), mastery (F2) |
| `completed` | First `complete` | `{type:"card", id}` | `{total, maxPossible, caughtCount, mistakeCount, falseAlarms, missedCritical, ratingKey, missedStepIds}` | Completion rate, outcomes `missed` / `clean_pass` |

Example `graded` event (illustrative; the ADR fixes the shape):

```json
{
  "id": "evt_01JAB3K9Q4X5V7M2N8P0R1S2T3",
  "at": "2026-10-09T07:42:11.204Z",
  "actor": "learner_1",
  "verb": "graded",
  "object": { "type": "card", "id": "electrical-receptacle-01", "step": 3 },
  "result": { "verdict": "correct", "reasoningScore": 0.8, "graderSource": "mock", "points": 270, "total": 270, "latencyMs": 4 },
  "context": { "subject": "demo-trades@1", "attemptId": "att_01JAB3K8Z0Y1X2W3V4U5T6S7R8",
               "promptVersions": { "scenario": "scenario@1", "grade": "grade@1" } }
}
```

`context.mode`, `assignedMode` and `mode-assigned` are not emitted in F1a (F2/F3). `llm_call` rows (FR-026) feed the cost and fallback-rate metrics.

## Success criteria (measurable)

**Exit criteria from the 0003 PM DECISION:**
- **SC-001 (a) Golden replay:** `node tests/golden/run.mjs --replay --repeat 3` against the F1a build exits 0: in 3 consecutive runs, every run in the golden matrix (T03) shows an empty diff on the learner-visible layer (displayed strings, spoken strings in order, points, rating label, outcome line) and the outbound-prompt layer (system and user text and schema per fake-Claude call), except the two runs named in `tests/fixtures/golden/allow-list.json`: "grade request aborted" (US2 panel) and "complete request aborted" (US3 state).
- **SC-002 (b) Old routes gone:** `GET /api/scenario?trade=electrical`, `POST /api/grade` and `GET /api/trades` return 404, and the answer-leak test (`tests/no-answer-leak.test.js`) passes over all three demo-trades cards in MOCK and LIVE-against-fake-Claude.
- **SC-003 (c) Deny-list:** `tests/fixtures/deny-list-allow.json` contains only entries whose `file` matches `server/prompts/*.js`, plus at most one entry `{file: "shared/contract.js", word: "trade", count: ≤2}` (the `SCENARIO_SCHEMA` occurrences); zero entries under `web/`, `scripts/`, other `server/` paths or other `shared/` files.
- **SC-004 (e) Full suite green:** a fresh `npm test` exits 0 with `# fail 0`, `# todo 0`, `# skipped 0`, and `# tests` ≥ 97. Every test whose assertion changed is listed, old → new, in the ticket that changed it.

**Further criteria:**
- **SC-005:** 100% of event-coverage checks pass: in every acceptance-test attempt, the events match US4 scenario 1, and the projection reproduces the `complete` body's `total`, `caughtCount` and `falseAlarms` exactly.
- **SC-006:** UPDATE and DELETE on `event` throw in 100% of attempts in `tests/db.test.js`.
- **SC-007:** 100% of fake-Claude calls in `npm test` have exactly one `llm_call` row with non-empty `pipeline`, `prompt_version`, `model`, and integer `ms`; 100% carry the `x-prompt-id` header.
- **SC-008:** Deadlines are unchanged: with fake Claude hanging, a STOP answers with `source: "mock-fallback"` in < 2.5 s at `GRADE_DEADLINE_MS=1500`, and an attempt start answers `fixture-fallback` in < 3 s at `SCENARIO_DEADLINE_MS=2000` (ported from `tests/llm-deadline.test.js`).
- **SC-009:** In MOCK mode, p95 latency of `POST /api/attempts/:id/stops` over 100 sequential requests on one machine is ≤ 200 ms.
- **SC-010:** Real-browser check: 0 console errors in the golden matrix at 390 px and 1280 px, voice and text.

**AI-quality thresholds (pre-registered):** F1a changes no prompt text, schema or model routing, so no κ, verifier or defect threshold applies (0003 PM DECISION §3: the 32-case κ is a regression baseline in F1b, not the `data-and-evidence.md` §5 κ ≥ 0.6). The AI-quality verdict for F1a is: SC-001's outbound-prompt layer is empty (prompts byte-identical) **and** SC-007 holds. No `VERSION` changes in F1a; any diff that changes one fails review.

## Non-goals / Later

- **FSRS / `ts-fsrs`:** F2 (no consumer in F1).
- **Render deployment and persistent hosting:** out of F1 (money, founder).
- **`mode-assigned`, `mode-switched`, `mode-fallback`, `voice-command` events:** F2/F3.
- **Prompt text changes (F1b):** pack-supplied vocabulary in `grade.js`/`scenario.js`, fencing pack text (inv. 5), dropping or renaming `SCENARIO_SCHEMA.trade`, any `VERSION` bump.
- **Eval scaffold (F1b):** `evals/`, `scripts/eval-prompts.js`, `npm run eval:live`, recordings, staleness and `pending` ratchet.
- **Hotword, voice commands, barge-in, earcons, automatic voice → text fallback:** F2.
- **Offline grading queue:** F2 (A3: explanations queued and graded on reconnect).
- **Splitting `web/app.js` into screens and `state.js`; resume after reload:** F2.
- **Subject copy in `web/index.html` that isn't on the deny-list** (the textbox placeholder "He didn't test that it was dead…", the "Job" label): moved to the pack in F1b with the rest of the agnostic-copy sweep.
- **Cost in `llm_call.cost_usd`:** F1b (needs the price table from E3).
- **A `GET /api/attempts/:id` read route:** not needed until resume (F2).

## Assumptions

- Node ≥ 22.13 with `node:sqlite` (verified 22.22.0 in 0003); its stderr `ExperimentalWarning` is harmless because the test helper matches stdout.
- Playwright and Chromium are installed globally (`/opt/node22/bin/playwright`, `/opt/pw-browsers`); F1a adds no npm dependency. The golden harness and browser checks run outside `npm test`.
- The three demo-trades fixtures are the only cards; no learner data exists to migrate.
- There is still no Anthropic API key; every live path is proven against `tests/helpers/fake-claude.mjs`.
- One learner per server (`actor: "learner_1"`); no auth.

## Open items

| # | Item | For | Status |
|---|---|---|---|
| OI-1 | Field names the architect's entry defers: `card.subject` value (`"demo-trades"` vs `"demo-trades@1"`), `cleanRunLine`, `missed[]` keys, 409 for STOP after complete, idempotent same-`stepId` replay | principal-architect, ADR card/attempt API | [ARCH DECISION NEEDED: ADR-xxxx] |
| OI-2 | Event schema v1 exact layout (table above is the PM's proposal) | principal-architect | [ARCH DECISION NEEDED: ADR-xxxx] |
| OI-3 | Pack format v1 field names; rating keys `missed-critical`, `excellent`, `solid`, `developing`, `beginning` | principal-architect | [ARCH DECISION NEEDED: ADR-xxxx] |
| OI-4 | `PROMPT_ID`/`VERSION` export names; MOCK paths in `llm_call` or not (FR-029) | principal-architect | [ARCH DECISION NEEDED: ADR-xxxx] |
| OI-5 | Card stamps for hand-authored cards (`"none"`) | principal-architect | [ARCH DECISION NEEDED: ADR-xxxx] |
| OI-6 | How the browser learns the subject id (FR-035) | principal-architect | [ARCH DECISION NEEDED: ADR-xxxx] |
| OI-7 | **The ownership test has no git here.** This checkout reports "not a git repo", so `git ls-files` can't run. The test must neither fail nor skip silently. PM proposal: when `git ls-files` fails, walk the filesystem, excluding `node_modules/`, `.env`, `data/` and anything else in `.gitignore`, and print one visible line `ownership: git unavailable, used filesystem walk`. Alternative: a visible `t.skip('git unavailable')` that QA's report must list. `check:ticket` can't work without git at all; QA records the file list by hand in that case. The golden manifest's source id has the same problem: T03 records `gitSha: null` plus a `treeSha256` content hash. | qa-engineer + principal-architect, decided at F1a spec review | [ARCH DECISION NEEDED: ADR-xxxx] |
| OI-8 | Who owns `package.json` and `.gitignore`? They are not in the `CLAUDE.md` ownership table. These tickets assign them to `backend-engineer` (T06 only). | human (CLAUDE.md change) | [NEEDS CLARIFICATION] |
| OI-9 | **Pre-existing inv. 9 gap, frozen by the golden replay.** At run end, "Clean job. Nobody got hurt." is spoken but not displayed, and "Here's what happened next. {consequence}" is spoken while the screen shows the heading plus "{summary}. {consequence}". F1a moves the clean-run line into the pack without changing it. PM recommendation: fix in F2 with the Results screen; the alternative is a third allow-listed golden diff in F1a. | principal-architect | [ARCH DECISION NEEDED: ADR-xxxx or review.md] |
| OI-10 | How the golden harness makes the one live-generated-scenario run's prompt deterministic. PM default: the harness masks the three randomized lines ("Draw the critical mistake from", "Jobsite twist to include", "Apprentice name") in that run's outbound-prompt layer; T02's unit test proves the rng hook. Alternative: a `SCENARIO_RNG_SEED` env var read by the server. | principal-architect | [ARCH DECISION NEEDED: ADR-xxxx] |
| OI-11 | Learning-designer review of US2/US3 (the "Skip" path drops a STOP with no feedback; the failure copy). Learner-visible behavior is otherwise frozen by the golden replay, so the review is limited to these two states. | learning-designer, before architect hand-off | Requested; findings to be recorded here |
| OI-12 | Founder F-5: confirm W10 (`web/speech/`) is in F1 (placed in F1a, T15, per the 0003 PM DECISION). | founder | [NEEDS CLARIFICATION] |
