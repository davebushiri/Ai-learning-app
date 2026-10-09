# F1a: Server-owned cards on the new foundation

**Status:** In review (revision 2, answering the architect's CHANGES REQUESTED in [`review.md`](review.md))
**Phase:** F1 | **Links:** docs/foundation/system-architecture.md, docs/foundation/data-and-evidence.md, docs/foundation/voice-first.md, docs/foundation/decisions.md (D7, D8, D10, D12, D13), ADRs [0001](../../adr/0001-sqlite-storage-and-append-only-event-log.md)–[0007](../../adr/0007-plain-node-eval-runner.md) including the Amendment 1 of 0002, 0003, 0005 and 0006, [`review.md`](review.md), [`learning-review.md`](learning-review.md), [thread 0003](../../team/threads/0003-f1-engine-core-proposal.md) (architect, PM and founder DECISIONs are binding)

**Precedence:** where this spec and an ADR disagree, the ADR wins. Report the disagreement as a bug against this spec.

## Problem

Today the server sends every planted mistake (`step.error`: severity, summary, why, correctAction, consequence, keywords) to the browser before the learner says anything (`server/index.js:159-165`). The browser then resolves STOPs, scores the run and even grades offline from those answers (`web/app.js:117,161,211`; `web/api.js:36`). That breaks invariant 2 (D12), so no grade or score can be trusted as evidence. Nothing is stored: there is no event log, no card record and no LLM call log, so F2 (learner model, resume, planner) has nothing to build on. Subject words also sit in engine code (`shared/scoring.js:74-79`, `shared/mock-grader.js:12-25`, `web/app.js:228`). F1a moves cards, STOP resolution, grading and scoring to the server, records every action as an append-only event in SQLite, puts the trades content into `packs/demo-trades`, and proves with a golden replay that the learner sees and hears exactly what they did before, apart from two new failure states.

**Scope boundary (thread 0003):** F1a changes **no prompt text and no model-facing schema**. Prompt rewrites, fencing pack text, the `SCENARIO_SCHEMA.trade` rename and the eval scaffold are F1b.

## Glossary (used throughout)

| Term | Meaning |
|---|---|
| **Card** | The stored content of one playable scenario (title, setting, apprentice, steps with their hidden mistakes). Server-only. |
| **Public card** | `{id, subject, title, setting, apprentice, steps:[{id, line}]}`. The only card data the browser ever receives before grading. |
| **Attempt** | One play of one card, identified by `attemptId`. Its state is rebuilt from events by `projectAttempt(events)`. |
| **Position** | A step's index in `card.steps` (0-based), found with `card.steps.findIndex(s => s.id === stepId)`. All ordering, grace and `lastStepShown` checks use the position, never the numeric step id (ADR 0003 Amendment 1). |
| **Skipped stop** | A STOP whose request failed and which the learner then dismissed with "Skip this stop". The browser reports skipped step ids in the `complete` body. |
| **Not graded** | A mistake that the server's `resolveStop` would have credited at a skipped stop's position and that is still uncaught at complete. It earns and costs nothing (US2, FR-047). |
| **Voice mode (F1)** | "Read aloud" is on (narration and feedback are spoken through `web/speech/`) and the learner may dictate the explanation with the mic button. The hotword "stop" and voice commands are F2 (`voice-first.md` §7). |
| **Text mode (F1)** | "Read aloud" is off (reading-time pauses instead of speech) and the explanation is typed, then Enter or Submit. |
| **Golden run** | One scripted play recorded by the harness: displayed strings, spoken strings, outbound prompts, grading outcomes. |

## User stories (prioritized; each independently testable)

### US1: Play a card whose answers stay on the server (P1)
The learner picks a job, starts it, listens to or reads the narration, stops the apprentice, explains, hears or reads feedback, and sees the results. Everything looks and sounds exactly as it does today. The difference is invisible: the browser never holds a mistake's answer until that STOP is graded, and the results come from the server.

**Why P1:** It closes the only data-integrity hole in the product (inv. 2) and is the precondition for every F2 feature.
**Independent test:** Run the golden matrix against the F1a build; the learner-visible layer diffs empty against the baseline, and `leakScan` finds no answer field in any response before the crediting STOP.

**Acceptance scenarios** (electrical card: 10 lines; mistakes on line 3 critical, line 5 major, line 7 minor):
1. **Given** MOCK mode and the setup screen with "Read aloud" checked (voice mode), **when** the learner picks "Electrical: replace a receptacle", presses "Start the job", presses STOP while line 3 is being spoken, dictates "he didn't test it, it could still be live" with the mic and presses Submit, **then** the feedback panel shows "Good catch!", the feedback text, "+270 points" and "Graded by: keyword grader"; the string passed to `speak()` for feedback equals the text in `#feedback-text`; line 3 gets the `caught` class; the top-bar score equals the STOP response's `total` (270); and `leakScan` reports nothing for any response received before that STOP response.
2. **Given** the same setup with "Read aloud" unchecked (text mode), **when** the learner presses Space during line 3, types the same explanation and presses Enter, **then** the same verdict, feedback text, points and line marking appear, `speechSynthesis.speak` is never called, and the same leak-scan condition holds.
3. **Given** voice mode, **when** the learner presses STOP during line 1 and submits "he should lock it out", **then** the panel shows "False alarm", the feedback is spoken exactly as displayed, "-75 points" is shown, line 1 gets `false-alarm`, and the STOP response has `caught: null` and no field naming or locating any other step's mistake.
4. **Given** text mode, **when** the learner does the same as scenario 3 by typing, **then** the same display results, with no speech.
5. **Given** voice mode, **when** the learner presses STOP during line 4 (one line after the critical mistake) and explains correctly, **then** the server credits the line-3 mistake with `stepsLate: 1`, line 3 (not line 4) gets `caught`, and points equal `scoreStop({severity:'critical', stepsLate:1, verdict, reasoningScore})`.
6. **Given** text mode, **when** the learner does scenario 5 by typing, **then** the same outcome, with no speech.
7. **Given** voice mode and a learner who never presses STOP, **when** the last line finishes, **then** the results screen shows the label "Someone got hurt" (`ratings.missedCritical`), the total and max, "Caught 0 of 3 mistakes · 0 false alarms", the three missed mistakes with their summary, consequence and "Should have: …", and speaks "Here's what happened next. {critical consequence}". All values come from the `complete` response.
8. **Given** text mode and the same never-stop run, **when** the last line finishes, **then** the same results are displayed and nothing is spoken.
9. **Given** voice mode and a run where all three mistakes are caught on time with correct explanations, **when** the last line finishes, **then** the label "Journeyman eyes" (`ratings.tiers[0]`) is shown and the pack's clean-run line "Clean job. Nobody got hurt." is spoken.
10. **Given** text mode and the same perfect run, **when** the last line finishes, **then** the same label is shown and nothing is spoken.

### US2: The grader can't be reached (P1)
If the server can't be reached, answers 5xx, or answers 4xx when the learner submits an explanation, the learner is told plainly that their answer is kept, and can try again or skip this stop. No grading happens in the browser. **Skip consequence (PM DECISION, learning-review Option B):** a skipped stop is not scored. It earns nothing and costs nothing. If it was on an uncaught mistake (or one line after one, within `RULES.graceSteps`), that mistake is **not graded**: no missed penalty, left out of max possible and out of the "Someone got hurt" rating, and still revealed on the results screen with its summary, consequence and "Should have". A skipped stop on a clean line doesn't cost the false-alarm penalty. The skip is recorded in `completed.result.skippedStepIds`.

**Why P1:** Removing the browser fallback (`web/api.js:36`) is required by inv. 2; without this panel the game would stall (inv. 7). Scoring a caught mistake as missed would give the learner false feedback (learning-review finding 1).
**Independent test:** Abort the STOP request in Playwright (`page.route`); the panel appears with the exact copy, the explanation is still in the textbox, "Try again" re-sends it, and "Skip this stop" resumes narration and leads to a results screen with the not-graded item and the results note.

**Acceptance scenarios** (MOCK, electrical):
1. **Given** voice mode and a STOP on line 3 with an explanation entered, **when** the STOP request fails (network error, the 12 s client timeout, or a 5xx), **then** `#grader-error` shows "Couldn't reach the grader. Your answer is still here. Try again, or skip and this stop won't be scored." with buttons "Try again" and "Skip this stop"; the same sentence is spoken once; the explanation textbox is still visible and still contains the learner's text; focus is on "Try again"; the score is unchanged and no line is marked.
2. **Given** text mode and the same failure, **then** the same panel, copy and focus, and nothing is spoken.
3. **Given** voice mode and the panel showing, **when** the learner presses "Try again" and the server now answers, **then** the normal feedback panel appears for that STOP exactly as in US1 (feedback spoken as displayed), and the server holds exactly one `stopped`/`explained`/`graded` triplet for that step.
4. **Given** text mode and the panel showing, **when** the learner presses "Try again" and the server answers, **then** the same as scenario 3, with no speech.
5. **Given** voice mode, the panel showing for a STOP on line 3, **when** the learner presses "Skip this stop" and then never presses STOP again, **then** the panel closes, no points are added, narration resumes at line 4, STOP is enabled again; at run end the `complete` request body has `skippedStepIds: [3]`; the results show "Back to the classroom" (`tiers[3]`), total -100, max 300, "Caught 0 of 3 mistakes · 0 false alarms", the line-3 item labelled "critical · not graded" (no points), the major and minor items labelled "… · missed · {points} pts"; `#results-note` shows "1 stop wasn't graded, so it isn't in your score."; and the learner hears "Here's what happened next. {major consequence}" followed by "1 stop wasn't graded, so it isn't in your score."
6. **Given** text mode and the same skip run, **then** the same panel behavior and the same results are displayed, and nothing is spoken.
7. **Given** voice mode, a STOP on line 1 (a clean line) whose request fails, **when** the learner presses "Skip this stop", then catches all three mistakes on time with correct explanations, **then** the total has no -75, the label is "Journeyman eyes", no item is labelled "not graded", the clean-run line is spoken, then "1 stop wasn't graded, so it isn't in your score." is displayed in `#results-note` and spoken.
8. **Given** text mode and the same run as scenario 7, **then** the same display, and nothing is spoken.
9. **Given** voice mode, a STOP on line 3 whose request fails, the learner presses "Skip this stop", and every later line is caught on time with correct explanations, **when** results appear, **then** the line-3 item is "critical · not graded", nothing is truly missed, the clean-run line is **not** spoken, and only "1 stop wasn't graded, so it isn't in your score." is spoken (and displayed).
10. **Given** text mode and the same run as scenario 9, **then** the same display, and nothing is spoken.
11. **Given** voice mode and the panel showing, **when** "Try again" fails again, **then** the panel shows "Still can't reach the grader. Try again, or skip this stop.", that sentence is spoken once, and focus moves to "Skip this stop".
12. **Given** text mode and the same repeat failure, **then** the same copy and focus, and nothing is spoken.
13. **Given** either mode, **when** the STOP request gets a 4xx (for example 400 or 409), **then** the panel shows the first-showing copy of scenario 1 (spoken once in voice mode only) and focus is on "Skip this stop".
14. **Given** a STOP whose request reached the server and was graded, but whose response was lost, **when** the learner presses "Skip this stop" and completes, **then** the server's graded STOP stands: it counts in the results, its step id is ignored in `skippedStepIds`, and the note counts only the stops the server never graded (see OI-13 for how the browser learns that count).

### US3: Results can't be loaded (P2)
The results screen now needs the network. If the `complete` call fails, the learner is told why to retry: to see what they missed and the fix.

**Why P2:** Only visible on failure, but without it the end of a run could stall (inv. 7) and the learner could leave without the corrective reveal (learning-review finding 4).
**Independent test:** Abort the `complete` request in Playwright; the results-failure state appears, and "Retry results" loads the normal results.

**Acceptance scenarios:**
1. **Given** voice mode, MOCK mode, and an electrical run with one STOP on line 3 graded `correct`, **when** the last line ends and the `complete` request fails, **then** the results screen shows `#results-error` "Couldn't load your results yet. Retry to see what you missed and the right way to do it." with a "Retry results" button, that sentence is spoken once, focus is on "Retry results", "Run another job" is visible, and no rating, total or missed list is shown.
2. **Given** text mode and the same failure, **then** the same copy and focus are displayed, and nothing is spoken.
3. **Given** voice mode and the results-failure state, **when** the learner presses "Retry results" and the server answers, **then** the normal results screen of US1 scenarios 7–10 appears (run-end speech as in US1), and the values equal those of a run where `complete` succeeded first time.
4. **Given** text mode and the results-failure state, **when** the learner presses "Retry results" and the server answers, **then** the same, with no speech.
5. **Given** either mode and the results-failure state, **when** "Retry results" fails again, **then** the same copy is shown again (spoken again in voice mode) and focus stays on "Retry results".

### US4: Every action is recorded as an append-only event (P1, system)
Each start, STOP, explanation, grade and completion is written to SQLite as an xAPI-shaped event (ADR 0002 and its Amendment 1). The attempt's state can always be rebuilt from those events.

**Why P1:** D7 and inv. 6; the F2 learner model and resume are projections of this log.
**Independent test:** Run an attempt against a server with a temp-file `DB_PATH`, then open the DB read-only: the expected events exist in `seq` order, UPDATE and DELETE on `event` throw, and `projectAttempt` reproduces the `complete` response's totals.

**Acceptance scenarios:**
1. **Given** MOCK mode and a server with `DB_PATH` set to a temp file, **when** an electrical attempt is started, receives two STOPs and is completed with `lastStepShown: 10`, **then** the `event` table holds, for that `attemptId`, in `seq` order exactly: 1 `started`; 2 × (`stopped`, `explained`, `graded`); 1 `step-shown` with `object.step = 10` and `result: null`; 1 `completed`. Each has `context.subject = "demo-trades@1"`, `context.attemptId`, `object.id = "fx_demo-trades_1_electrical"`, `context.promptVersions = {}`, and passes `validateEvent`.
2. **Given** the same in LIVE mode against fake Claude with a live-generated card, **then** `started.context.promptVersions = {scenario: "scenario@1"}`, each `graded.context.promptVersions = {grade: "grade@1"}`, and `object.id` starts with `card_`.
3. **Given** any row in `event`, **when** `UPDATE event SET verb='x'` or `DELETE FROM event` is run, **then** SQLite raises an error and the row is unchanged.
4. **Given** a completed attempt, **when** its events are passed to `projectAttempt`, **then** `caughtStepIds` equals the caught set, and the session's rebuilt `complete` body equals the first response for `total`, `caughtCount` and `falseAlarms`.
5. **Given** a STOP whose grading never finishes because the server is killed mid-grade, **when** the server restarts on the same DB file, **then** that attempt has no `stopped`, `explained` or `graded` event, and the same STOP sent again is graded normally (one triplet).
6. **Given** an attempt completed with `skippedStepIds: [3]` after a failed STOP on line 3, **then** `completed.result.skippedStepIds = [3]`.

### US5: Every AI call is stamped and logged (P2, system)
Every place the live path would call Claude goes through `run()` on the gateway (`server/ai/gateway.js`, ADR 0005), carries its prompt id and version, and leaves an `llm_call` row, including MOCK and fallback paths.

**Why P2:** D10 and inv. 3; cost and fallback metrics depend on it. Learners see no change.
**Independent test:** Against fake Claude, a live start and a live STOP produce two `llm_call` rows; fake Claude's `/__log` shows the `x-prompt-id` header on each request.

**Acceptance scenarios:**
1. **Given** LIVE mode against fake Claude (happy path), **when** a live attempt starts and one STOP is graded, **then** `llm_call` has one row with `pipeline = "scenario"`, `prompt_version = "scenario@1"` and one with `pipeline = "grade"`, `prompt_version = "grade@1"`, both `outcome = "ok"`, `model = "claude-opus-5-5"`, `input_tokens = 1234`, `output_tokens = 321`.
2. **Given** fake Claude hangs, **when** a STOP is graded with `GRADE_DEADLINE_MS=1500`, **then** the response arrives within 2.5 s with `source: "mock-fallback"`, and an `llm_call` row with `outcome = "timeout"` exists.
3. **Given** MOCK mode, **when** an attempt starts without `source` and one STOP is graded, **then** `llm_call` has two rows with `outcome = "mock"` (one `scenario@1`, one `grade@1`), and fake Claude received nothing.
4. **Given** LIVE mode, **when** an attempt starts with `source: "fixture"`, **then** no `llm_call` row is written for the start and `started.context.promptVersions = {}`.
5. **Given** fake Claude receives a request without an `x-prompt-id` header, **then** it answers 500 and logs the request, so a misrouted call can't pass silently.

### US6: Subject words live in the pack, not the engine (P2)
Rating labels, the clean-run line, the keyword grader's synonyms and its false-alarm feedback come from `packs/demo-trades`. Engine code in `server/` (outside `server/prompts/`), `shared/`, `web/` and `scripts/` holds no deny-listed words. For demo-trades the learner sees and hears identical strings.

**Why P2:** Inv. 1 and exit criterion (c); it is also how a second pack becomes possible in F2.
**Independent test:** The deny-list test passes with an allow-list containing only `server/prompts/*` entries and `shared/contract.js` `trade` (≤ 2, the `SCENARIO_SCHEMA` occurrences); the golden replay is unchanged.

**Acceptance scenarios:**
1. **Given** voice mode and a never-stop run, **when** results appear, **then** the label displayed is `ratingLabel(pack.ratings, "missedCritical")` = the pack's `ratings.missedCritical` "Someone got hurt" (byte-identical to today's).
2. **Given** text mode and the same run, **then** the same label is displayed.
3. **Given** voice mode and a perfect run, **then** the spoken clean-run line is the pack's `copy.cleanRun` "Clean job. Nobody got hurt.".
4. **Given** text mode and MOCK mode, **when** the learner stops on a clean line, **then** the feedback text is the pack's `copy.falseAlarmFeedback` "That step was actually fine. Stopping the job costs time, so save the STOP for real hazards." (byte-identical).
5. **Given** voice mode and MOCK mode, **when** the learner dictates "it could still have juice" on electrical line 3, **then** the verdict equals today's (the pack's `grading.synonyms` maps "juice" to "live").
6. **Given** text mode and MOCK mode, **when** the learner types the same explanation, **then** the same verdict.

## Spoken and displayed copy (inv. 9)

F1a must not change any existing learner-facing string for demo-trades. The table lists every string the F1a tickets touch or move, plus the new failure and skip states. Every **new** string is built once by one function and passed both to the DOM (`textContent`) and, in voice mode, to `speak()`, so spoken text equals displayed text (FR-033).

| Moment | Displayed (exact) | Spoken in voice mode (exact) | Source after F1a | Voice input (F1) | Repair path |
|---|---|---|---|---|---|
| Narration line | `{apprentice}` label + `{line}` | `{line}` | Public card | — | — |
| Scenario choice | `<option>` text = `{label}` | — | `GET /api/scenarios`, set via `textContent` (FR-045) | — | — |
| Explain prompt | "What's wrong, and why?" | — | `web/index.html` (unchanged) | Mic button "🎤 Talk" / "■ Done talking" | Edit the textbox before Submit |
| Grading | Submit button reads "Grading…" | — | `web/app.js` (unchanged) | — | — |
| Feedback (no fix) | `{feedback}` | `{feedback}` | STOP response `feedback` | — | — |
| Feedback (with fix) | `{feedback} Here's the right way: {caught.correctAction}`. The fix is appended **only when `caught !== null` and `verdict !== 'correct'`** (`web/app.js:188`) | identical | STOP response `feedback` + `caught.correctAction`; joining copy stays in `web/app.js` | — | — |
| Verdict label | "Good catch!" / "Close…" / "Right moment, wrong reason" / "False alarm" | — (not spoken today; unchanged) | `web/app.js` | — | — |
| Points | "+{points} points" / "{points} points" | — | STOP response `points` | — | — |
| Grade source | "Graded by: Claude" / "keyword grader" / "keyword grader (fallback)" | — | STOP response `source`. "offline grader (fallback)" is **removed** (no browser grading). | — | — |
| MOCK false-alarm feedback | "That step was actually fine. Stopping the job costs time, so save the STOP for real hazards." | identical | `pack.json` `copy.falseAlarmFeedback` | — | — |
| **Grader unreachable, first showing (new)** | "Couldn't reach the grader. Your answer is still here. Try again, or skip and this stop won't be scored." + buttons "Try again", "Skip this stop"; the explanation textbox stays visible with the learner's text | "Couldn't reach the grader. Your answer is still here. Try again, or skip and this stop won't be scored." (once per showing) | `web/app.js` | Mic still available to re-dictate into the textbox | "Try again" re-sends the textbox's current content for the same `stepId` (idempotent on the server). "Skip this stop" closes the panel, records the step id as skipped and resumes narration at the next line. Focus: "Try again"; on a 4xx, "Skip this stop". |
| **Grader unreachable, repeat showing (new)** | "Still can't reach the grader. Try again, or skip this stop." + the same buttons | "Still can't reach the grader. Try again, or skip this stop." (once per showing) | `web/app.js` | as above | as above. Focus: "Skip this stop" (second consecutive failure). |
| Rating label | e.g. "Someone got hurt", "Journeyman eyes", "Solid supervisor", "Keep watching", "Back to the classroom" | — | `complete` response `ratingLabel` (`ratingLabel(pack.ratings, ratingKey)`) | — | — |
| Results summary | "Caught {c} of {m} mistakes · {f} false alarm(s)" | — | `web/app.js` copy, values from `complete` | — | — |
| Missed item | "{severity} · missed · {points} pts", "**{summary}.** {consequence}", "Should have: {correctAction}" | — | `complete` response `missed[]` | — | — |
| **Not-graded item (new)** | "{severity} · not graded", "**{summary}.** {consequence}", "Should have: {correctAction}" | — (list items aren't spoken today) | `complete` response `missed[]` item with `notGraded: true` | — | — |
| Run end, a mistake truly missed | (heading "What happened next" and the list) | "Here's what happened next. {consequence of the critical, else the first, truly missed item}" (items with `notGraded` are never chosen) | `runEndLine(result)` in `web/app.js` | — | — |
| Run end, nothing missed and nothing not graded | — (pre-existing gap, OI-9) | "Clean job. Nobody got hurt." | `runEndLine(result)` → `complete` response `cleanRunLine` (`copy.cleanRun`) | — | — |
| Run end, nothing truly missed but ≥ 1 not graded | — | nothing from `runEndLine` (the run wasn't verifiably clean); only the results note below | `runEndLine(result)` returns `null` | — | — |
| **Results note (new; shown when ≥ 1 stop was skipped and not graded by the server)** | `#results-note`: "1 stop wasn't graded, so it isn't in your score." / "{n} stops weren't graded, so they aren't in your score." (n ≥ 2, digits) | identical, spoken after the run-end line | `resultsNote(n)` in `web/app.js`; `n` per OI-13 | — | — |
| **Results unreachable (new)** | `#results-error`: "Couldn't load your results yet. Retry to see what you missed and the right way to do it." + button "Retry results"; "Run another job" stays visible | identical (once per showing) | `web/app.js` | — | "Retry results" re-calls `complete` (idempotent); "Run another job" returns to setup |
| Start failure | "Couldn't load the job: {message}" | — | `web/app.js` (unchanged) | — | Press "Start the job" again |

Hotword "stop", "change that", "skip" and other voice commands are F2. In F1a every action in both modes is a button, Space or Enter. The button "Skip this stop" means "move on; this stop isn't graded", which is the meaning F2's voice command "skip" must keep (learning-review finding 6).

## Edge cases

- **Same STOP sent twice** (retry after a lost response, double click, two tabs) → if the step id already has a graded STOP, the server returns 200 with the identical stored body and writes no events (ADR 0003).
- **Second STOP while one is in flight for the same attempt** → 409 `{error}`, no events. The browser shows the grader-unreachable panel (4xx: focus on "Skip this stop"); "Try again" later gets the stored body (ADR 0003 Amendment 1; review B8). The in-flight mark is released in `finally` and deleted from its map.
- **STOP at a position before the last graded STOP's position** → 400 `{error}`; no events.
- **Step ids not in ascending order** (for example a live card with ids `[1,2,3,5,4,6,7,8,9]`) → order, grace and `lastStepShown` checks use positions, so a forward move is never rejected and `resolveStop` credits the right line (review B12).
- **`stepId` not in the card** (0, negative, non-integer, string, missing) → 400.
- **STOP or complete on an unknown or malformed `attemptId`** → 404 `{error}`.
- **STOP after `complete`** → 409 `{error}`.
- **Grade fails or the server dies mid-grade** → nothing is written for that STOP: the triplet is appended only after grading, in one `appendEvents` transaction (review B2). A retry with the same `stepId` is a new STOP.
- **`appendEvents` throws** (disk full, locked) → the route answers 500 `{error:"server error"}`, the process keeps running, and no event of the triplet exists. The browser shows the US2 or US3 failure state.
- **`complete` called twice** → the second call returns the identical body, recomputed from card, events and pack; the repeat body's values (including `skippedStepIds`) are ignored; exactly one `step-shown` and one `completed` exist.
- **`complete` with `lastStepShown` not a step id of the card, or at a position before the last graded STOP** → 400.
- **`skippedStepIds`** not an array of integers, containing an id not in the card, a duplicate, or an id at a position after `lastStepShown` → 400. Missing → treated as `[]`. Ids that already have a graded STOP are ignored (server truth wins).
- **Skip after a STOP that actually reached the server** (response lost) → the server's graded STOP stands; the `complete` values may exceed the browser's running total; the results screen shows the server values (US2.14).
- **A skipped stop followed by a graded STOP that credits the same mistake late** (skip on line 3, STOP on line 4 credits line 3 with `stepsLate: 1`) → the mistake is caught, not "not graded".
- **Two mistakes within reach of one skipped stop** → only the one `resolveStop` would credit (current line first, then up to `graceSteps` back, skipping caught ones) is not graded; the other stays missed.
- **Every mistake not graded** (three failed stops, all skipped) → `maxPossible` is 0, so the rating rule's `pct` is 0 and the label is `tiers[3]`. Accepted for F1a (three consecutive failures); the note says "3 stops weren't graded, so they aren't in your score." Revisit in the F2 Results spec.
- **A client claims skips it never made** → accepted risk with one learner (review R4); the claim is logged in `completed.result.skippedStepIds` and F3's catch rate excludes attempts with skips.
- **Orphan attempts** → a live start that times out in the browser, followed by the cached retry, leaves an attempt with `started` only (review S8). Accepted. The F2 completion-rate metric must exclude attempts with no `stopped` and no `completed`.
- **Empty explanation** → graded as today (MOCK: verdict `wrong`, reasoningScore 0; live: `(no explanation given)`).
- **Explanation longer than 2000 chars** → truncated to 2000 before grading and in `explained.result.text`; non-string → coerced to string.
- **Body over 1,000,000 bytes** → 413. **Body not JSON, `null`, or an array** → 400. Never 500.
- **`subject` or `scenario` is `__proto__`, `constructor`, `toString`, `hasOwnProperty` or unknown** → 400 on `POST /api/attempts` and `GET /api/scenarios`.
- **Live generation fails, times out or returns an invalid scenario** → the pack's fixture card is served with `source: "fixture-fallback"`; the failed call has an `llm_call` row (`timeout` or `fallback`); no `card_…` row is written for the invalid scenario.
- **Live generation succeeds** → the `card` row is written before the response is sent; a crash after the write leaves an orphan card row, which is acceptable.
- **A migration fails at startup** → the process exits non-zero with `[db] migration NNN failed: …` before listening; it never serves on a half-migrated schema.
- **An invalid pack in `packs/`** → skipped with a logged reason at startup; the server still starts; its id answers 400 as unknown.
- **A pack changed on disk without a `version` bump** (`pack.json` or any scenario file) → `putPack` reports a conflict, the loader refuses that pack with a logged reason, and its id answers 400 as unknown.
- **Path traversal or direct fetch of pack files** (`/packs/demo-trades/pack.json`, `/../packs/…`, `/shared/../packs/…`) → 403 or 404; pack content is never served statically.
- **Pack text with markup** (a scenario label `<b>x</b>`) → shown literally; never parsed as HTML (FR-045).
- **No `git`, or `git` fails** → the ownership test walks the filesystem, prints a TAP diagnostic and still asserts; it never skips (FR-039).

## Functional requirements

### Card and attempt API (ADR 0003 + Amendment 1)
- **FR-001:** `POST /api/attempts` with body `{subject: "demo-trades", scenario: "<scenario id>", source?: "fixture"}` MUST return 200 `{attemptId, card: {id, subject, title, setting, apprentice, steps: [{id, line}]}, source}`. `card` MUST be built by the allow-list projection `toPublicCard(card, {id, subject})` in `shared/contract.js`; no other key may appear anywhere in the body. `card.subject` is the pack id (`"demo-trades"`). `card.id` is `fx_<packId>_<packVersion>_<scenarioId>` for fixture cards (`fx_demo-trades_1_electrical`) and `card_<ULID>` for live cards. `source` is `"live"`, `"fixture"` or `"fixture-fallback"`.
- **FR-002:** `attemptId` MUST match `^att_[0-9A-HJKMNP-TV-Z]{26}$` and be unique per call; two attempts on the same card MUST NOT share caught state.
- **FR-003:** `GET /api/scenarios?subject=demo-trades` MUST return 200 `[{id, label}]` with the same ids, labels and order that `GET /api/trades` returns today: `electrical`, `hvac`, `automotive`.
- **FR-004:** `POST /api/attempts/:attemptId/stops` with body `{stepId, explanation}` MUST find the step's position `idx`, resolve the STOP with `resolveStop(card, idx, caughtSet)`, grade it through the gateway (live with keyword fallback, or MOCK keyword), score it with `scoreStop`, append the events (FR-016), and return 200 `{verdict, reasoningScore, feedback, source, points, total, caught}`. `total` is the sum of `points` over all graded STOPs in the attempt up to and including this one.
- **FR-005:** `caught` MUST be `null` when the STOP resolves to no mistake (false alarm), and otherwise exactly `{errorStepId, stepsLate, severity, correctAction}` for the credited mistake only. A response MUST NOT contain `why`, `summary`, `consequence` or `keywords` for any mistake, nor any field about a mistake other than the credited one.
- **FR-006:** The server, not the model, MUST decide false alarms, as today (`index.js:98-100`): no credited mistake → `verdict: "false_alarm"`; credited mistake and the model says `false_alarm` → `verdict: "wrong"`. `source` is `"live"`, `"mock"` or `"mock-fallback"`.
- **FR-007:** STOP checks MUST run in this order, each by position: (1) attempt already completed → 409; (2) `stepId` not an integer id of the card → 400; (3) `stepId` already has a graded STOP → 200 with the stored body (recomputed from events and card), no events; (4) position before the last graded STOP's position → 400; (5) a STOP already in flight for this attempt → 409; (6) otherwise resolve, grade, score and write. Every non-200 writes no events.
- **FR-008:** `POST /api/attempts/:attemptId/complete` with body `{lastStepShown: int, skippedStepIds?: int[]}` MUST validate the body (edge cases), and return 200 `{total, maxPossible, caughtCount, mistakeCount, falseAlarms, missedCritical, ratingKey, ratingLabel, cleanRunLine, missed: [{stepId, severity, summary, consequence, correctAction, points}]}`, with the Option B additions of FR-047 and OI-13. Values MUST equal `scoreRun` on the stored card, the attempt's graded STOPs and the not-graded set. `missed[]` is the only place `summary`, `consequence` and `correctAction` of uncaught mistakes appear; `why` and `keywords` are never sent.
- **FR-009:** `complete` MUST be idempotent: `step-shown` and `completed` are written once, and repeat calls return the identical body, recomputed from card, events and pack (ADR 0002 Amendment 1). A STOP after `complete` MUST return 409.
- **FR-010:** Unknown or malformed `attemptId` MUST return 404; malformed bodies MUST return 400; bodies over 1,000,000 bytes MUST return 413; no input may produce a 500 or crash the process (a storage failure is the only 500, FR-016).
- **FR-011:** No response from any route, and no static file, MUST contain a mistake's `severity`, `summary`, `why`, `correctAction`, `consequence` or `keywords` before the STOP that credits that mistake, except `missed[]` in the `complete` response. A key `error` is a leak only when its value is not a string (HTTP error bodies are `{error: "<message>"}`). Files under `packs/` MUST NOT be served statically.
- **FR-012:** By F1a close, `GET /api/scenario`, `POST /api/grade` and `GET /api/trades` MUST return 404 and no route string `/api/scenario`, `/api/grade` or `/api/trades` may remain in `server/`. Until then they keep working unchanged so the web keeps running between waves.

### Storage and events (ADR 0001, 0002 + Amendment 1)
- **FR-013:** `server/db.js` MUST be the only file importing `node:sqlite`. It exports `openDb(path) → Db`, `initDb(path) → Db` (opens the process database) and `getDb() → Db` (throws if `initDb` hasn't run). `Db` has exactly `appendEvents`, `eventsForAttempt`, `putCard`, `getCard`, `putPack`, `logLlmCall`, `close` and never exposes the `DatabaseSync` handle. `DB_PATH` defaults to `data/app.db` resolved against the repo root; file databases use `journal_mode=WAL` and `busy_timeout=5000`. Migrations `server/migrations/NNN-*.sql` run forward-only, each in one transaction that sets `PRAGMA user_version`. `server/index.js` MUST call `initDb` and `loadPacks` **before** `listen`; a migration failure exits non-zero with `[db] migration NNN failed: <message>`. The server MUST NOT detect that it is under test.
- **FR-014:** Migration `001` MUST create `event` (with `seq INTEGER PRIMARY KEY`, ADR 0002), `subject_pack`, `card` and `llm_call` with the columns in `data-and-evidence.md` §2, the triggers `event_no_update` and `event_no_delete` that `RAISE(ABORT, 'event is append-only')`, and the index `event_attempt` on `json_extract(context_json, '$.attemptId')`.
- **FR-015:** The `card` table MUST carry ADR 0003's checks, tightened to non-empty strings: `CHECK (source IN ('fixture','live'))` and `CHECK (source <> 'live' OR (length(prompt_version) > 0 AND length(model) > 0))`. Fixture cards have NULL `prompt_version` and `model` and id `fx_<packId>_<packVersion>_<scenarioId>`, inserted once. A fallback card is the fixture card row.
- **FR-016:** The server MUST append: `started` on attempt start; for each new STOP, **after** grading, `stopped`, `explained` and `graded` in one `appendEvents` transaction (nothing for a STOP is written before its grade is known); on the first `complete`, one `step-shown` (`object.step = lastStepShown`, `result: null`) and one `completed`, in one `appendEvents` transaction. There MUST be no per-line `step-shown` and no `step-shown` on STOP. A failed `appendEvents` writes none of its events and the route answers 500.
- **FR-017:** Every event MUST have the shape `{id, at, actor, verb, object, result, context}`: `id` = `evt_` + ULID; `actor` = `"learner_1"`; `object = {type: "card", id: cardId, step?}`; `context = {subject: "<packId>@<packVersion>", attemptId, promptVersions}`. `promptVersions` lists only prompts the gateway actually sent to a model for that event, including ones that then fell back: `{scenario: "scenario@1"}` on `started` for a live or fallen-back start, `{grade: "grade@1"}` on `graded` when a grade prompt was sent, `{}` in MOCK mode, for an explicit `source: "fixture"` start, and on all other events. Result shapes are in "Events and metrics".
- **FR-018:** `shared/events.js` (pure, browser-safe) MUST export `VERBS` (the full `data-and-evidence.md` §1 vocabulary), `OUTCOMES` (§1's six outcomes), `newId(prefix)`, `makeEvent(...)`, `validateEvent(e) → string[]` (accepts any `VERBS` verb, never throws on any input) and `projectAttempt(events) → {cardId, caughtStepIds, lastStopStepId, stopsByStepId, completed}`. All attempt state used by STOP and complete MUST come from `projectAttempt` over `eventsForAttempt` plus the card, never from memory (except the in-flight mark). The server MUST write only the six F1 verbs.

### Packs (ADR 0006 + Amendment 1)
- **FR-019:** `packs/demo-trades/pack.json` MUST hold `id`, `version`, `title`, `severity {critical, major, minor}`, `ratings {missedCritical, tiers: [4 labels, best first]}`, `copy {cleanRun, falseAlarmFeedback}`, `grading {synonyms}` (today's `SYNONYMS`, verbatim), flat `scenarios: [{id, label, brief, hazardHints, criticalHints?, twists?, fixture}]` and `provenance {builtBy: "hand"}`. `fixture` names a file under `packs/demo-trades/scenarios/`; the three files are today's `fixtures/scenarios/*.json`, byte-identical. No `format` field, no `generation` wrapper, no `cards/` directory.
- **FR-020:** `validatePack(p) → string[]` MUST live in `shared/pack.js` (pure, never throws, caps string lengths and counts, exactly 4 tiers). `server/packs.js` loads packs at startup: an invalid pack, or one whose scenario file fails `validateScenario`, is skipped with a logged reason. Each valid pack is recorded with `putPack`, which compares `pack.json` plus every scenario file (canonical JSON) with the stored `(id, version)` row and refuses the pack on a mismatch. Each fixture card is inserted once with `putCard`.
- **FR-021:** `scoreRun` MUST return `ratingKey` ∈ `missedCritical`, `tier0`–`tier3`, using `RULES.ratingTiers = [0.85, 0.6, 0.3]` (today's thresholds). `ratingLabel(ratings, key)` in `shared/pack.js` maps keys to labels. By F1a close `shared/scoring.js` MUST NOT contain the `rating` field or any label string.
- **FR-022:** `shared/mock-grader.js` `mockGrade(card, errorStepId, explanation, lexicon)` MUST take `{synonyms, falseAlarmFeedback}` from the pack, with no subject words in the module. For demo-trades, every verdict, score and feedback string MUST equal today's.
- **FR-023:** For demo-trades, every learner-visible string (rating labels, clean-run line, false-alarm feedback, keyword verdicts) MUST be byte-identical to today's.

### AI gateway and prompt registry (ADR 0005 + Amendment 1)
- **FR-024:** `server/ai/gateway.js` MUST export `createGateway({client, logCall}) → {run}`, `promptFingerprint(PROMPT) → string` and `responseText(content)`. `run({prompt, input, live, effort, deadlineMs, accept, fallback}) → Promise<{data, source: "live"|"mock"|"fallback", meta}>`; `fallback` is required. `messages.create` MUST appear only in this file, with `signal: AbortSignal.timeout(deadlineMs)`, `maxRetries: 1`, the JSON schema in `output_config.format`, today's `server-side-fallback-2026-07-01` beta and `fallbacks: 'default'`, and `responseText` parsing. `server/ai/models.js` holds `MODEL`, `SCENARIO_EFFORT`, `GRADE_EFFORT`, `SCENARIO_DEADLINE_MS` (default 40000) and `GRADE_DEADLINE_MS` (default 8000), all env-overridable as today. `server/llm.js` MUST be deleted.
- **FR-025:** Every request MUST send the header `x-prompt-id: <PROMPT.id>@<VERSION>` (`grade@1`, `scenario@1`).
- **FR-026:** Each `run()` MUST write exactly one `llm_call` row through `logCall`: `{id: "llm_"+ULID, at, pipeline: PROMPT.id, prompt_version: "<id>@<VERSION>", model (served model; the requested `MODEL` when there was no response), ms, input_tokens, output_tokens, cache_read, cost_usd: null, outcome}`, with `outcome` ∈ `ok | timeout | refusal | fallback | mock`. `fallback` covers any other failure, including rejection by `accept`. A failing `logCall` is caught and warned and never changes the result. Today's `[claude] …` console lines MUST stay byte-compatible with `tests/server.test.js` BRAIN-08.
- **FR-027:** Each prompt module MUST export `VERSION` (`1`) and `PROMPT = {id, system, schema, render(input), fingerprintInputs}`. No prompt text, template or schema may change: `render` returns exactly what `gradeUserPrompt` / `scenarioUserPrompt` return today. `fingerprintInputs` cover each template branch (grade: on-time catch, late catch, false alarm, empty explanation; scenario: with and without `criticalHints`, `twists` and recent summaries, fixed `rng`) using synthetic content with no deny-listed word. Both fingerprints are frozen in a test.
- **FR-028:** `scenarioUserPrompt` MUST accept an optional `rng` (default `Math.random`) as its fourth parameter; for the same draws its output MUST be byte-identical to today's.
- **FR-029:** Every place where the live path would call a model MUST call `run()`; in MOCK mode with `live: false` (outcome `mock`). An explicitly requested cached card (`source: "fixture"`) is not an AI call: no `run()`, no `llm_call` row. Services map the gateway's `source` to route values: grade `live → "live"`, `mock → "mock"`, `fallback → "mock-fallback"`; scenario `live → "live"`, `mock → "fixture"`, `fallback → "fixture-fallback"`. `graded.result.graderSource` and `started.result.source` carry the route value.

### Web
- **FR-030:** The browser MUST hold only the public card, STOP responses and the `complete` response. No file under `web/` may import `mock-grader` or `scoring`, or call `resolveStop`, `scoreStop` or `scoreRun`.
- **FR-031:** When a STOP request fails (network error, 12 s timeout, or any non-2xx), the browser MUST show `#grader-error` with the copy-table text for a first or repeat showing, keep the explanation textbox visible with its content, and offer "Try again" and "Skip this stop". Focus goes to "Try again" on a first showing after a network error, timeout or 5xx; to "Skip this stop" on a 4xx or on a second consecutive failure.
- **FR-032:** The results screen MUST be rendered from the `complete` response. When that request fails (network error, 12 s timeout, any non-2xx), the browser MUST show `#results-error` with the copy-table text and "Retry results", with "Run another job" visible.
- **FR-033:** Every new string MUST be built once and passed both to the DOM and, in voice mode, to `speak()` (inv. 9). No new string may be spoken without being displayed.
- **FR-034:** All speech MUST go through `web/speech/index.js`, exporting `speak(text, {enabled, rate}) → Promise<void>`, `listen({onInterim}) → {result: Promise<string>, stop()}`, `onHotword(phrases, handler) → unsubscribe` (no-op in F1), `cancel()`, `wait(ms) → Promise<void>` and `capabilities: {canSpeak, canListen, hotword: false}`. `web/speech.js` MUST be deleted. Behavior MUST NOT change.
- **FR-035:** `GET /api/subjects` MUST return 200 `[{id, title}]` for the loaded packs. The browser MUST take the subject id from `subjects[0].id`, never from a string in `web/`. `/api/health` is unchanged.
- **FR-036:** Learner-visible behavior MUST be unchanged for demo-trades (golden replay), except the two allow-listed failure-state runs (US2, US3).

### Skip, Option B (PM DECISION; contract additions pending OI-13)
- **FR-042:** On "Skip this stop", the browser MUST add the pending STOP's `stepId` to a per-attempt `skippedStepIds` list (unique, in order), resume narration at the next line, and send the list in the `complete` body (`[]` when empty).
- **FR-043:** On the first `complete`, the server MUST validate `skippedStepIds` (edge cases), drop ids that have a graded STOP, store the remaining ids in `completed.result.skippedStepIds` (always present, possibly empty), and compute the not-graded mistakes with FR-047.
- **FR-044:** The results screen MUST show a `missed[]` item with `notGraded: true` as "{severity} · not graded" (no points) followed by its summary, consequence and "Should have" lines, and MUST show `#results-note` with `resultsNote(n)` when `n ≥ 1` (n per OI-13).
- **FR-045:** Pack text in the browser MUST be rendered as text: scenario `<option>`s are built with `document.createElement('option')`, `.value` and `.textContent`; no pack-derived string is assigned to `innerHTML` without `escapeHtml`.
- **FR-046:** `runEndLine(result) → string | null` in `web/app.js` MUST build the run-end sentence in one function: the "Here's what happened next. {consequence}" line for the critical, else the first, truly missed item (never a `notGraded` item); else `null` when any item is `notGraded`; else `cleanRunLine`. In voice mode the browser speaks `runEndLine(result)` (when not null) and then `resultsNote(n)` (when shown).
- **FR-047:** `shared/scoring.js` MUST export `notGradedStepIdsFor(card, skippedStepIds, caughtStepIds, rules = RULES) → number[]`: for each skipped id in position order, `resolveStop(card, position, caught ∪ notGradedSoFar, rules)`; each non-null `errorStepId` is not graded. `scoreRun(card, stops, rules = RULES, {notGradedStepIds = []} = {})` MUST then: give a not-graded mistake no missed penalty; leave it out of `maxPossible` and `missedCritical`; keep it in `mistakeCount`; list it in `missed[]` in step order with `notGraded: true` and `points: 0`. With `notGradedStepIds` empty, every output equals today's.

### Guardrails in `npm test`
- **FR-037:** A deny-list test MUST scan `server/`, `shared/`, `web/` and `scripts/` (excluding `packs/`, `fixtures/`, `tests/`) case-insensitively on word boundaries for the words in `tests/fixtures/deny-list.json`, and MUST fail on any hit not listed in `tests/fixtures/deny-list-allow.json` (`[{file, word, count}]`) and on any listed count above the actual count (counts only go down).
- **FR-038:** The deny-list seed MUST contain at least: `trade`, `trades`, `journeyman`, `electrical`, `electrician`, `hvac`, `automotive`, `receptacle`, `breaker`, `gfci`, `gfi`, `backstab`, `nitrogen`, `nitro`, `refrigerant`, `braze`, `brazing`, `extinguisher`, `caliper`, `jack stand`, `jackstand`, `de-energized`, `deenergized`, `nec`, `osha`, `epa`, `jobsite`, `got hurt`. Engine concept words (`apprentice`, `job`, `supervisor`, `step`, `mistake`) are not on the list.
- **FR-039:** A file-ownership test MUST map every path to exactly one owner parsed from the `CLAUDE.md` table, failing if the parse fails. Paths come from `git ls-files -co --exclude-standard`. When `git` is missing or exits non-zero, the test walks the filesystem excluding `.git/`, `node_modules/` and the plain line patterns in `.gitignore`, calls `t.diagnostic('ownership: git unavailable, used filesystem walk')`, and still asserts; it never skips. `npm run check:ticket <id>` compares a ticket's changed files with its `Files:` list and, without git, exits 2 with `git unavailable: list changed files by hand in the QA report` (not part of `npm test`).
- **FR-040:** `tests/helpers/fake-claude.mjs` MUST route on the `x-prompt-id` header (`kind` = the part before `@`) and MUST answer 500 and log any request without it. `/__log` entries MUST include `promptId`, `system` and `schemaSha256`.
- **FR-041:** `npm test` MUST run `tests/**/*.test.js` (so `tests/acceptance/` runs), and `package.json` `engines.node` MUST be `>=22.13`.
- **FR-048:** Grep guardrails in `npm test`: `node:sqlite` is imported only in `server/db.js`; `messages.create` appears only in `server/ai/gateway.js`, which contains `maxRetries: 1` and `AbortSignal.timeout`; no file under `web/` imports `mock-grader` or `scoring` or calls `resolveStop`, `scoreStop` or `scoreRun`; no route string `/api/scenario`, `/api/grade` or `/api/trades` remains in `server/` (from F1a close).

## Events and metrics

All events follow ADR 0002 and its Amendment 1. The server is the only writer. Order is always `seq`.

| Verb | When | `object` | `result` | `context.promptVersions` | Used by |
|---|---|---|---|---|---|
| `started` | `POST /api/attempts` | `{type:"card", id: cardId}` | `{source}` (`live` \| `fixture` \| `fixture-fallback`) | `{scenario:"scenario@1"}` if the gateway sent the prompt (live or fell back), else `{}` | Completion rate (F2), attempt identity |
| `stopped` | New STOP, after grading, in one transaction with the next two | `{type:"card", id, step: stepId}` | `{targetStepId: int \| null, stepsLate: 0 \| 1 \| null}` | `{}` | Catch rate (F3 primary metric), calibration |
| `explained` | same transaction | `{type:"card", id, step}` | `{text, chars}` (text ≤ 2000 chars) | `{}` | Explanation quality, Mistake Miner (F4) |
| `graded` | same transaction | `{type:"card", id, step}` | `{verdict, reasoningScore, graderSource, outcome, points, latencyMs, feedback}` | `{grade:"grade@1"}` if sent, else `{}` | Fallback rate per version, κ (F3), mastery (F2) |
| `step-shown` | First `complete`, one event, same transaction as `completed` | `{type:"card", id, step: lastStepShown}` | `null` | `{}` | Furthest step shown (F2) |
| `completed` | First `complete` | `{type:"card", id}` | `{total, maxPossible, caughtCount, mistakeCount, falseAlarms, ratingKey, missedStepIds, skippedStepIds}` (+ OI-13 proposal `notGradedStepIds`) | `{}` | Completion rate, outcomes `missed`; skips |

- **`graded.result.outcome`** (precedence top to bottom): no credited mistake → `false_alarm`; verdict `wrong` → `wrong_reason`; `stepsLate > 0` → `caught_late`; else `caught`.
- **`graded.result.latencyMs`** is the grading time in ms; `feedback` is the exact feedback returned (needed for idempotent replay).
- **`llm_call`** rows (FR-026) feed the cost and fallback-rate metrics; MOCK rows carry outcome `mock`.
- **Metric rules recorded now for later specs:** F3 catch rate excludes attempts whose `completed.result.skippedStepIds` is non-empty (review R4); F2 completion rate excludes attempts with no `stopped` and no `completed` (review S8).
- `context.mode`, `assignedMode` and `mode-assigned` are not emitted in F1a (F2/F3).

Example `graded` event (MOCK mode; exact shape per ADR 0002):

```json
{
  "id": "evt_01JAB3K9Q4X5V7M2N8P0R1S2T3",
  "at": "2026-10-09T07:42:11.204Z",
  "actor": "learner_1",
  "verb": "graded",
  "object": { "type": "card", "id": "fx_demo-trades_1_electrical", "step": 3 },
  "result": { "verdict": "correct", "reasoningScore": 0.8, "graderSource": "mock", "outcome": "caught",
              "points": 270, "latencyMs": 4, "feedback": "Good catch. …" },
  "context": { "subject": "demo-trades@1", "attemptId": "att_01JAB3K8Z0Y1X2W3V4U5T6S7R8", "promptVersions": {} }
}
```

## Success criteria (measurable)

**Exit criteria from the 0003 PM DECISION:**
- **SC-001 (a) Golden replay:** `node tests/golden/run.mjs --replay --repeat 3` against the F1a build exits 0: in 3 consecutive runs, every run in the golden matrix (F1a-T03) shows an empty diff on the learner-visible layer (displayed strings, spoken strings in order, points, rating label, outcome line, focus after each panel change) and the outbound-prompt layer (system text, user text and `schemaSha256` per fake-Claude call), except the four run ids in `tests/fixtures/golden/allow-list.json` (grade request aborted and complete request aborted, voice and text). The allow-list never grows; a flaky run is a harness bug.
- **SC-002 (b) Old routes gone:** `GET /api/scenario?trade=electrical`, `POST /api/grade` and `GET /api/trades` return 404, and `tests/no-answer-leak.test.js` passes over all three demo-trades cards in MOCK and LIVE-against-fake-Claude.
- **SC-003 (c) Deny-list:** `tests/fixtures/deny-list-allow.json` contains only entries whose `file` matches `server/prompts/*.js`, plus at most one entry `{file: "shared/contract.js", word: "trade", count: ≤2}`; zero entries under `web/`, `scripts/`, other `server/` paths or other `shared/` files.
- **SC-004 (e) Full suite green:** a fresh `npm test` exits 0 with `# fail 0`, `# todo 0`, `# skipped 0`, and `# tests` ≥ 97. Every test whose assertion changed is listed, old → new, in the ticket that changed it.

**Further criteria:**
- **SC-005:** In 100% of acceptance-test attempts, the event sequence matches US4 scenario 1 (as adjusted for the number of STOPs) and every event passes `validateEvent`; the rebuilt `complete` body equals the first one exactly.
- **SC-006:** UPDATE and DELETE on `event` throw in 100% of attempts in `tests/db.test.js`.
- **SC-007:** 100% of `run()` calls in `npm test` leave exactly one `llm_call` row with non-empty `pipeline`, `prompt_version`, `model`, integer `ms` and an `outcome` in the five values; 100% of fake-Claude requests carry `x-prompt-id`.
- **SC-008:** Deadlines are unchanged: with fake Claude hanging, a STOP answers `source: "mock-fallback"` in < 2.5 s at `GRADE_DEADLINE_MS=1500`, and an attempt start answers `fixture-fallback` in < 3 s at `SCENARIO_DEADLINE_MS=2000`.
- **SC-009:** In MOCK mode, p95 latency of `POST /api/attempts/:id/stops` over 100 sequential requests (one per fresh attempt) on one machine is ≤ 200 ms.
- **SC-010:** Real-browser check: 0 console errors in the golden matrix and the F1a e2e suite at 390 px and 1280 px, voice and text.
- **SC-011:** In 100% of the e2e skip runs (US2.5–US2.10, voice and text), the displayed labels, note and spoken strings equal the copy table, and the stored `completed.result.skippedStepIds` equals the skipped ids.

**AI-quality thresholds (pre-registered):** F1a changes no prompt text, schema or model routing, so no κ, verifier or defect threshold applies (0003 PM DECISION §3). The AI-quality verdict for F1a is: SC-001's outbound-prompt layer is empty, the two prompt fingerprints equal the values frozen by F1a-T05, **and** SC-007 holds. No `VERSION` changes in F1a; any diff that changes one fails review.

## Non-goals / Later

- **FSRS / `ts-fsrs`:** F2 (no consumer in F1).
- **Render deployment and persistent hosting:** out of F1 (money, founder).
- **`mode-assigned`, `mode-switched`, `mode-fallback`, `voice-command` events:** F2/F3.
- **Prompt text changes (F1b):** pack-supplied vocabulary in `grade.js`/`scenario.js`, fencing pack text (inv. 5), dropping or renaming `SCENARIO_SCHEMA.trade`, any `VERSION` bump.
- **Eval scaffold (F1b):** `evals/`, `scripts/eval-prompts.js`, `npm run eval:live`, recordings, staleness and the `pending` ratchet.
- **Hotword, voice commands, barge-in, earcons, automatic voice → text fallback:** F2. A "Still grading…" cue at about 4 s so the wait before a failure isn't silent (learning review, Later).
- **Offline grading queue:** F2 or later (ADR 0004). It removes the Skip trade-off at its root.
- **Run-end inv. 9 gap (OI-9), F2 Results spec backlog:** voice mode speaks summary and fix as well as consequence ("Here's what happened next. {consequence} The mistake: {summary}. Should have: {correctAction}."), and the clean-run line is displayed. Must ship before hands-free play. Also reconcile "Clean job" spoken after several false alarms, and the all-not-graded rating (edge cases).
- **Disputing a grade** (🚩, `user-flow.md` §6): F2+.
- **Splitting `web/app.js` into screens and `state.js`; resume after reload; `GET /api/attempts/:id`:** F2.
- **Subject copy in `web/index.html` that isn't on the deny-list** (placeholder "He didn't test that it was dead…", the "Job" label): F1b with the agnostic-copy sweep.
- **Cost in `llm_call.cost_usd`:** F1b (needs the price table from E3).

## Assumptions

- Node ≥ 22.13 with `node:sqlite` (verified 22.22.0); its stderr `ExperimentalWarning` is harmless because the test helper matches stdout.
- Playwright and Chromium are installed globally (`/opt/node22/bin/playwright`, `/opt/pw-browsers`); F1a adds no npm dependency. The golden harness and browser checks run outside `npm test`.
- `git` works in this checkout (review OI-7); the fallback exists for tarballs and CI caches.
- The three demo-trades fixtures are the only cards; no learner data exists to migrate.
- There is still no Anthropic API key; every live path is proven against `tests/helpers/fake-claude.mjs`.
- One learner per server (`actor: "learner_1"`); no auth.

## Learning-review findings: PM decisions

| Finding | Decision |
|---|---|
| 1. Skip scores a caught mistake as missed | **Option B adopted** (US2, FR-042–FR-047). |
| 2. Skip leaves no trace | Recorded in `completed.result.skippedStepIds` (architect ruling B10, ADR 0002 Amendment 1). |
| 3. Grader-unreachable copy | Adopted, Option B variant, with the "Skip this stop" button. |
| 4. Results-unreachable copy | Adopted, the version without a number. US3.1 and the copy table changed together. |
| 5. OI-9 run-end gap | Deferred to F2 with the architect's conditions (OI-9). |
| 6. Minor | Adopted: focus to "Skip this stop" on a 4xx or the second consecutive failure; the shorter repeat-showing copy; "skip" keeps one meaning in F2. |

## Open items

| # | Item | For | Status |
|---|---|---|---|
| OI-1 | `card.subject`, `cleanRunLine`, `missed[]` keys, 409 after complete, idempotent replay, concurrency | — | **Resolved** by [review.md](review.md) OI-1 and B8: `card.subject = "demo-trades"`; the rest per ADR 0003 + Amendment 1; concurrency → 409 (FR-007). |
| OI-2 | Event schema v1 layout | — | **Resolved** by review.md B3: ADR 0002 + Amendment 1 ("Events and metrics", FR-016–FR-018). |
| OI-3 | Pack fields and rating keys | — | **Resolved** by review.md B4: ADR 0006 + Amendment 1 (FR-019–FR-021); the spec's keys are withdrawn. |
| OI-4 | Prompt export names; MOCK paths in `llm_call` | — | **Resolved** by review.md B1: `VERSION` + `PROMPT`; MOCK writes `mock` rows; explicit fixture writes none (FR-024–FR-029). |
| OI-5 | Stamps for hand-authored cards | — | **Resolved** by review.md B5: NULL stamps; `"none"` withdrawn (FR-015). |
| OI-6 | How the browser learns the subject id | — | **Resolved** by review.md OI-6: `GET /api/subjects` (FR-035). |
| OI-7 | Ownership test without git | — | **Resolved** by review.md OI-7 (FR-039, F1a-T11, F1a-T03 manifest). |
| OI-8 | File ownership gaps (39 of 86 tracked files matched no `CLAUDE.md` row) | — | **Resolved** by the founder DECISION in thread 0003 (2026-10-09): the rows recommended in [review.md](review.md) "OI-8" were added to the `CLAUDE.md` ownership table. F1a-T11 is unblocked; `README.md` (F1a-T18) and `package.json` / `.gitignore` (F1a-T06) are `backend-engineer`'s; `qa-report.md` (F1a-T19) is `qa-engineer`'s. |
| OI-9 | Pre-existing inv. 9 gap at run end | — | **Resolved (deferred)** by review.md OI-9: no third golden diff; F1a-T17 builds `runEndLine(result)` (FR-046); the F2 Results spec carries the learning-review §5 criterion; it ships before hands-free play; no new F1a string repeats the gap (FR-033). Logged under Later. |
| OI-10 | Deterministic prompt layer for the live-generated golden run | — | **Resolved** by review.md OI-10: mask only the values after the three labels, with a membership check; no seed env var (F1a-T03). |
| OI-11 | Learning-designer review of US2/US3 | — | **Resolved**: delivered in `learning-review.md`; PM decisions in the table above; architect ruling on finding 2 is review.md B10. |
| OI-12 | Founder F-5: W10 in F1 | — | **Resolved** by the founder DECISION in thread 0003 (F-5 confirmed), cited in review.md: F1a-T15 stays. |
| OI-13 | **Option B contract additions beyond ADR 0003 Amendment 1.** The amendment carries `skippedStepIds` in the `complete` body and `completed.result`; review.md B10 names `scoreRun(…, {notGradedStepIds})` and `missed[]` items with `notGraded: true`. Not yet in an ADR: (a) `notGraded: true` (and `points: 0`) on `complete` response `missed[]` items; (b) whether `completed.result.missedStepIds` excludes not-graded mistakes and whether `completed.result` gains `notGradedStepIds: int[]` (always present), since re-deriving them later depends on `RULES.graceSteps` at the time; (c) whether the `complete` response echoes the server's effective `skippedStepIds: int[]`, so the browser's note counts only stops the server never graded (US2.14). **PM proposal:** yes to all three, additive. If (c) is declined, the browser counts its local skips and US2.14's note may over-count in the lost-response case. Blocks F1a-T14 and F1a-T17 only. | principal-architect | [ARCH DECISION NEEDED] |
