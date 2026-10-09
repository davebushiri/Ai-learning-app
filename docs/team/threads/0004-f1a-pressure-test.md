# 0004: F1a pressure test

**Type:** PRESSURE-TEST
**Status:** open
**Opened by:** lead · 2026-10-09
**Decider:** technical-product-manager (scope) · principal-architect (technical) · qa-engineer (testability)
**Targets:** `docs/specs/F1a-server-owned-cards/` (spec.md and tasks.md, revision 3, Approved)
**Participants:** qa-engineer, backend-engineer, frontend-engineer, technical-product-manager, learning-designer (on call)

## Context

F1a was approved after two design-review rounds (thread 0003; `review.md`). Before any engineer starts, each role tries to break it from its own angle (`docs/team/README.md`, ritual 2). Every `RISK` must get a `RESPONSE`: fixed in the spec, accepted with a reason, or turned into a ticket.

## Question(s) for the team

1. **QA:** Which criteria can't be tested, and which failure paths are missing?
2. **Backend and frontend:** What isn't feasible, what work is hidden, and are the estimates honest? Do the ticket interfaces hold together for the person building them?
3. **PM:** Is there user value or scope creep at risk? Is 21 tickets right for F1a?
4. **Learning designer:** The voice prompt after a silent STOP, "Say 'skip' if you're not sure" (`voice-first.md:50`). How should that learner-chosen skip be scored, compared with the grader-failure "not graded" skip?

---

<!-- Entries go below, append-only. -->

### qa-engineer · 2026-10-09 · RISK
**The golden replay and the e2e suite have no timing contract, so the gate will be slow, and "flaky" will be decided by luck.** F1a-T03 (`tasks.md:43-65`) says nothing about a fake clock or how the speech stub decides when a line ends. Only T01 mentions `page.clock` (`tasks.md:28`). Today's text-mode narration runs in real time: `max(1500, words×330)` per line (`web/speech.js:303,330`) plus 900 ms (`web/app.js:9`). Measured on the three fixtures, one text run is 63.8–74.1 s of narration. That makes the 33 text runs about 37 min per replay, and `--repeat 3` (SC-001) about 1.8 h, before counting the voice runs. Scenarios like "STOP while line 3 is being spoken" or "late-by-one" become races if the stub fires `onend` immediately.

I also verified in Chromium at `/opt/pw-browsers` that after `page.clock.install()` and `runFor(13000)`, `setTimeout(…,12000)` fires but `AbortSignal.timeout(12000)` stays pending. So the "12 s client timeout" branch of US2.1, FR-031 and FR-032 can't be fast-forwarded. Under a fake clock, a `page.route` that never answers makes the test hang.
· L: H · I: H · Mitigation: add a timing contract to T03 and T01:
- Install `page.clock` before `goto`.
- `browser-stubs.js` holds each utterance until the harness releases it.
- STOP actions are keyed on "line N appended" while the clock is paused.
- Live-fake runs pin `GRADE_DEADLINE_MS=1500` and `SCENARIO_DEADLINE_MS=2000`, recorded in `manifest.json`.
- Acceptance includes a runtime budget (one replay ≤ 10 min).
- The spec names exactly one real-time 12 s test per surface (STOP and complete, text mode). Every other failure uses `page.route` abort or status. Otherwise the frontend makes the timeout clock-controllable (`setTimeout` plus `AbortController`); that is the frontend's call.

### qa-engineer · 2026-10-09 · RISK
**The golden harness breaks at T07 or T17, and neither ticket is allowed to fix it.** T03 says scripts "may read pack or fixture files" (`tasks.md:65`). T07 deletes `fixtures/scenarios/*.json` (`tasks.md:171`). The grade-aborted runs abort a URL that is `/api/grade` at capture time (`web/api.js:234`) and becomes `/api/attempts/:id/stops` after T17. Neither T07's nor T17's `Files:` list includes `tests/golden/**`. The merge gate (`tasks.md:9-10`) would then block on a harness bug in the middle of a wave.
· L: M · I: H · Mitigation: add to T03's acceptance:
- At replay, the harness reads no file under `fixtures/`, `packs/` or `server/`; explanations and line indices are frozen inline in `scripts.mjs`.
- Abort routes match both the old and new URL shapes (`**/api/grade`, `**/api/attempts/*/stops`, `**/api/attempts/*/complete`).
- A self-test runs one replay with `fixtures/` renamed.

### qa-engineer · 2026-10-09 · RISK
**Most fake-Claude failure modes are never tested on the new routes.** At the HTTP level, F1a only exercises:
- hang (T12, T13);
- 500 (T08, legacy route);
- 429 and the fallback block (via T16's port);
- refusal and `accept`, only in T08's unit tests with an injected client.

These are never driven through `POST …/stops` or `POST /api/attempts` against fake Claude:
- 529;
- refusal;
- `stop_reason: max_tokens` with truncated JSON;
- non-JSON text;
- wrong-schema JSON.

None is checked for the visible label ("keyword grader (fallback)" or "cached (fallback)") within the deadline. FR-026 also leaves the outcome undefined for two cases: 429 with retry-after 60, which exceeds the deadline and so is aborted (`timeout` or `fallback`?), and max_tokens. US5.5's claim that "a misrouted call can't pass silently" is weak, because a 500 from a missing header just falls back. Only tests that assert `source: "live"` would catch it.
· L: M · I: H · Mitigation: add a T01 test "edge: fake-Claude failure matrix", one table-driven test per route. Modes: {hang, 429 ra=60, 500, 529, refusal, max_tokens+truncated, non-JSON, wrong-schema, fallback-block}. Each asserts: 200; `source` mock-fallback or fixture-fallback (or live for the fallback block); ≤ deadline + 1 s; exactly one `llm_call` row with a specified `outcome`; no `stopped`/`explained`/`graded` events missing. FR-026 pins the outcome for each mode. Every happy-path live test asserts `source: "live"`.

### qa-engineer · 2026-10-09 · RISK
**QA tickets are undersized, and QA sits on the critical path.**
- **T01 (M):** must name a test for every one of the 46 US scenarios (`spec.md:37-122`) and the 31 edge cases (`spec.md:157-187`), across two harnesses with voice and text twins, before any route exists. It also carries hidden round-2 additions (`tasks.md:29`).
- **T19 (S):** covers the leak test over 3 cards × MOCK/LIVE × 8 scripts, the guardrails, `--repeat 3` (≈ 2 h, per the first risk), e2e at two widths, `check:ticket` × 21 tickets, and `qa-report.md`.
- **T03 (M):** builds a 61-run Playwright harness with masking and stubs.
- **Critical path:** T03 gates every merge, and T09 and T10 gate T12.
- **`todo` mapping:** nothing maps each `{todo:'F1a-T##'}` to its ticket. T19 sweeps up "remaining" todos, so failing acceptance tests can surface only at the end. `node --test` reports a failing todo as green, so `npm test` passing after a merge says nothing about those tests.

· L: H · I: M · Mitigation:
- Resize T01 → L, or split it into T01a (HTTP, in `npm test`) and T01b (e2e).
- Resize T03 → L.
- Resize T19 → M, or split out the golden and e2e evidence as T19b.
- T01 ships a scenario → ticket table.
- Add a guardrail test: every `todo` reason matches `/^F1a-T\d\d$/`. QA removes a todo when it verifies that ticket, not in T19.

### qa-engineer · 2026-10-09 · RISK
**Two success criteria have no owner or can't be measured as written.**
- **SC-009** (p95 ≤ 200 ms over 100 STOPs, `spec.md:300`) appears in no ticket. `grep SC-009` matches only `spec.md:300`, and T19 covers "SC-001–SC-005, SC-010, SC-011". As a gating assertion in `npm test` it would be machine-dependent and flaky.
- **SC-007** says "100% of `run()` calls in `npm test`", but nothing counts calls across the suite. T08 only tests "exactly one logCall per run" on its own calls.
- **SC-006** is covered in practice by T06's db tests, but no ticket names it.

· L: H · I: L · Mitigation:
- Assign SC-009 to T19 as a scripted measurement outside `npm test` (warm-up excluded, fixed run count), reported in `qa-report.md`, not a gating assertion.
- Reword SC-007 to "every test that triggers `run()` asserts exactly one `llm_call` row, and fake Claude logs `kind: null` = 0 across the suite". It becomes provable once T09 lands.
- Map SC-006 to T06 by name.

### qa-engineer · 2026-10-09 · EVIDENCE
Checked, and these hold:
- **(verified) Fresh `npm test` today:** `# tests 97 / # pass 97 / # fail 0 / # skipped 0 / # todo 0`, so SC-004's floor of ≥ 97 matches. T07 deletes "J: trade mismatch…" (`tasks.md:184`), so later tickets must add at least one test to stay at or above 97.
- **(verified) `git` works in this checkout:** branch `team/agents`, HEAD `3e35ee5`. The OI-7 assumption holds, and T03's `gitSha` will not be null.
- **(verified) US2.5 arithmetic:** with `RULES` at `shared/scoring.js:6,17`, missing the major (-75) and minor (-25) gives -100, and max 300+200+100 minus the 300 critical gives 300. This matches `spec.md:59`.
- **(verified) FR-006** matches the current server rule (`index.js:98-100`).
- **(verified) Playwright clock:** `page.clock` does not fake `AbortSignal.timeout`. Script output: `{"abortSignalTimeout":"pending","setTimeout":"fired"}`, exit 0.
- **(inferred) Scenario prompt:** it holds no server-process state across runs (no recent-summaries cache in `server/index.js`), so golden runs don't depend on run order.

The files I cited are in /home/user/ai-learning-app: `docs/specs/F1a-server-owned-cards/spec.md`, `docs/specs/F1a-server-owned-cards/tasks.md`, `web/speech.js`, `web/api.js`, `web/app.js`, `tests/helpers/fake-claude.mjs` and `shared/scoring.js`.

### backend-engineer · 2026-10-09 · RISK
**T18 will break tests that T08, T12 and T13 add, and T18's file list doesn't include them.** T18 deletes `/api/grade`, `/api/trades`, `/api/scenario` and the legacy `grade(body)` (tasks.md:380). T16 ports only `tests/server.test.js` and `tests/llm-deadline.test.js` (tasks.md:341). Several new backend tests are specified against the legacy routes:
- `tests/gateway.test.js` (T08, tasks.md:211): "MOCK grade on the legacy route writes one llm_call row…". It also leaves the route unstated for "LIVE hang … at GRADE_DEADLINE_MS=1500", "500 writes outcome fallback" and "[claude] console line format". In T08 the only grade route is the legacy one.
- `tests/attempts.test.js` (T12, tasks.md:267): "scenarios list equals the legacy /api/trades list".
- `tests/stops.test.js` (T13, tasks.md:288): "MOCK verdicts for demo-trades equal the legacy /api/grade verdicts (3 cards × every step × 4 explanations)".
- `tests/rating-keys.test.js` (T21, tasks.md:301) breaks too if it compares against `r.rating`, which T18 removes.

At T18, `npm test` goes red or the ticket has an unlisted file deviation. · L: H · I: H · Mitigation:
- T12, T13 and T21 compare against frozen expected tables that T03's baseline or the pre-change code generates, never against a live legacy route or `r.rating`.
- T08's server tests say which route they use. Any that must use the legacy route get added to T18's Files with `old → new` lines.

### backend-engineer · 2026-10-09 · RISK
**T08's `run()` return value drops the error, but three things that must stay unchanged need it.**
- `/api/health.lastLiveError` comes from `noteLive(what, err)` using `err.message` (`server/index.js:81,104`). `tests/server.test.js:122-128` asserts `/401/` in it.
- `tests/llm-deadline.test.js:45` asserts `/timed out after 1500 ms/`. That text comes from `server/llm.js:53` through the `[grade] … failed, using keyword grader: <msg>` warn (`index.js:105`).

T08 says "no assertion changes" and lists only the two `[claude]` lines (tasks.md:205, 210), but `meta` is just `{promptVersion, model, ms, outcome}`, and nothing in T08 says who calls `noteLive`.

Two related gaps:
- `accept(data) → problems` can't apply `clampGrade`, which is a transform (`index.js:96`), so the order "clamp, then check feedback" is undefined.
- The spec says `client.messages.create`, but today's body uses `betas` + `fallbacks`, which only work on `client.beta.messages.create` (`llm.js:35,44`). Injected fake clients will be built to the wrong shape.

· L: H · I: M · Mitigation:
- Add `meta.error: string | null` to the `run()` result. For an abort it holds `Claude <id> timed out after <ms> ms`.
- `content` and `assessment` call `noteLive` and keep the `[grade]` and `[scenario]` warn lines.
- The grade path clamps inside `accept`'s caller: either a `parse` hook, or `run` returns the raw data and `assessment` clamps and re-checks it, which would need its own non-AI fallback path.
- Name `client.beta.messages.create` in T08.

### backend-engineer · 2026-10-09 · RISK
**The sizes aren't honest. T06, T07, T08 and T13 are L, not M, and the backend critical path is nine tickets in a row.**

| Ticket | What it contains | Where |
|---|---|---|
| T06 | 24 named tests, migrations, ULID, `projectAttempt` | |
| T07 | 5 creates, 14 modifies, 4 deletes, 10 tests, a startup-exit path, `simulate.js` rewritten for every pack | tasks.md:171 |
| T08 | 16 tests, plus moving both legacy paths onto the gateway and the gaps in the RISK above | |
| T13 | 22 tests, including restart-on-same-DB, replay-body reconstruction, the `mockGrade` lexicon change and the concurrency tests | |

Sequence: T04 → T06 → T07 → T08 → (T09, T10 by QA) → T12 → T13 → T14 → T18. Only T20 and T21 come off it. · L: H · I: M · Mitigation:
- Move `projectAttempt` from T06 to T13. T13 is its first consumer, and `stopsByStepId` is only exercised there.
- Split T07 into T07a (`server/packs.js`, scenario moves, `tests/pack.test.js`, startup order) and T07b (legacy rewire, `toPublicCard`, the nine test-file path edits).
- Split T13 into T13a (pure `planStop` plus the replay-body builder, unit tests) and T13b (route, write, concurrency and server tests).
- Relabel what remains honestly.

### backend-engineer · 2026-10-09 · RISK
**The in-flight 409 design is sound in one process, but it gives a spurious error on the most common retry.** The `Db` is synchronous (verified), so "no await between `eventsForAttempt` and `inFlight.set`" holds. `complete` has no await at all (tasks.md:318), so the two can't interleave. The weaknesses:
- **(a) Same-step retry.** A second request for the same `stepId` while the first is in flight gets 409 (FR-007 check 5, spec.md:198). Examples are a double tap or a lost response followed by a quick "Try again". The browser then shows the grader-error panel with focus on "Skip this stop" (spec.md:67, 158), even though the grade is about to land and will count.
- **(b) Process-local.** The mark lives in one process, so the design is only correct with a single server instance. That assumption is not written down anywhere I read.
- **(c) 409 is overloaded.** It means both "after complete" (permanent) and "in flight" (transient), so the client can't tell them apart.

· L: M · I: M · Mitigation:
- Store `Map<attemptId, {stepId, promise}>`. A same-`stepId` request awaits the pending promise and returns the same body; a different `stepId` or a `complete` still gets 409. One extra test with the 100 ms stub: "same STOP twice in flight: both 200, identical body, one graded event".
- Write the single-instance assumption into ADR 0003.
- Optionally add `code: 'completed' | 'in_flight'` to the 409 body. That is a contract change, so it's the architect's call.

### backend-engineer · 2026-10-09 · RISK
**Smaller `node:sqlite` gotchas the T06 interface doesn't cover.**
- Rows come back as `[Object: null prototype]`, so `assert.deepStrictEqual(row, {…})` fails. I confirmed this.
- After a failed statement inside `BEGIN`, `isTransaction` stays `true`, so `appendEvents` must `ROLLBACK` explicitly in `catch`. There's no better-sqlite3-style `transaction()` helper.
- `ExperimentalWarning` goes to stderr on every spawn. That's harmless, because `startServer` only matches stdout for the port.

Also, T12 passes `input: {key, entry, recentSummaries}` but never says where `recentSummaries` comes from. · L: M · I: L · Mitigation:
- `getCard` and `eventsForAttempt` return plain objects (`{...row}`), with a test "Db returns plain objects".
- `appendEvents` uses `BEGIN` / `COMMIT` / `ROLLBACK` in `try/catch`, with the existing all-or-nothing test.
- T12 says `recentSummaries: []`.

### backend-engineer · 2026-10-09 · EVIDENCE
`node --version` gives `v22.22.0`, which meets the `>=22.13` engines value in T06. Smoke test, run in the scratchpad with an in-memory DB except where noted:
```
ok UPDATE event SET context_json=1 -> ERR_SQLITE_ERROR 1811 event is append-only
ok DELETE FROM event -> ERR_SQLITE_ERROR 1811 event is append-only
detail: 'SEARCH event USING INDEX event_attempt (<expr>=?)'   # json_extract expression index is used
uv after rollback { user_version: 0 }                         # PRAGMA user_version inside BEGIN rolls back
sqlite { v: '3.50.4' }; ESM import('node:sqlite') ok; no --experimental flag needed
readOnly read while writer open (file DB, WAL): { n: 1 }
deepStrictEqual FAILS on row (null prototype)
isTransaction after failed stmt: true
(node) ExperimentalWarning: SQLite is an experimental feature …
```
- **Verified:** triggers with `RAISE(ABORT, …)` work and give a typed error code (`ERR_SQLITE_ERROR`, errcode 1811), so tests can assert on the code rather than the message. Transactional `user_version` works, the expression index is used, and a read-only reader works under WAL.
- **Inferred:** a 001 migration with a conflicting `event` table fails the `CREATE` as T07 expects. I did not run it.
- **Verified:** `node --test "tests/**/*.test.js"` gives `# tests 97 / # pass 97 / # fail 0`.

### frontend-engineer · 2026-10-09 · RISK
**A late or duplicate response corrupts the game state (T17, FR-031, FR-032, FR-042).** T17 describes the grader-error panel's appearance but not how it behaves over time.
- **Two "Try again" presses send two requests.** The second gets 409 (in flight, FR-007 check 5), so the error panel replaces a STOP that actually succeeded.
- **"Skip this stop" while a "Try again" is still pending.** Narration restarts, then the late 200 calls `showFeedback` in the middle of narration. Its "Back to work" button then starts a second `play()` loop.
- **Submit and Enter in the error state are undefined.** `submitExplanation` exits early unless `phase === 'explaining'` (`web/app.js:142`), and Enter goes to the same function (`app.js:274-276`). A text-mode learner who edits the kept answer and presses Enter gets nothing. Submit also stays stuck on "Grading…" (`app.js:145-146`) unless it is reset.
- **"Run another job" stays visible while `complete` is pending** (FR-032). A late success then calls `show('results-screen')` over the setup screen.

· L: H · I: H · Mitigation: add these to T17's interface:
- A `stopToken` and a `resultsToken`, like today's `runToken`, checked after every `await`. Skip and `#again-btn` bump them.
- While a STOP or `complete` request is pending, "Try again", "Skip this stop", Submit and the mic are disabled.
- In the error state, Submit and Enter both run the Try-again path.

Add e2e tests for:
- "Skip while Try again is pending: the late 200 is ignored, no feedback panel appears, narration continues"
- "a double press on Try again sends one request"
- "Run another job during a pending complete: results never appear over setup"

### frontend-engineer · 2026-10-09 · RISK
**Inv. 9 and voice: something can be spoken that isn't on screen, and the mic can record the app's own speech (FR-033, FR-046, copy table row "Grader unreachable").** Every new string is built once and passes inv. 9 on paper. Two cases break it in practice:
- **(a) The run-end speech is two sequential `speak()` calls.** `speak()` resolves when it is cancelled (`web/speech.js:24,28`). If the learner presses "Run another job" during `runEndLine`, the first promise resolves and the chain then speaks `resultsNote` over the setup screen. That is a string spoken but not displayed.
- **(b) The copy table says "Mic still available to re-dictate", but nothing cancels speech when the mic starts.** Also, `onInterim` overwrites the textbox (`app.js:131`). Pressing the mic while "Couldn't reach the grader…" is being spoken can transcribe the app's own words into the learner's kept answer. "Your answer is still here" then becomes false.

· L: M · I: H · Mitigation: in T17:
- `toggleMic` calls `cancel()` before `listen()` (one line).
- The results speech chain checks `resultsToken` between the two `speak()` calls.
- Add a voice e2e assertion: "no `speechSynthesis.speak` after `#again-btn`".

### frontend-engineer · 2026-10-09 · RISK
**T17 is L, not M, and the file list blocks unit tests (TDD).** By my count T17 involves:
- rewriting `api.js` (5 functions, 2 error classes, timeouts);
- reshaping the `game` state;
- the subjects-then-scenarios setup, with `<option>` elements built via `createElement`;
- the grader-error state and its handling (entry 1);
- an async `finish` with an error path, a retry, not-graded items, `runEndLine`, `resultsNote` and chained speech;
- markup for 3 new elements;
- CSS, including a 390 px layout of a fixed-bottom panel (`styles.css:74`) that now holds a textarea, 4 buttons and a message;
- the US1–US3 e2e suite in voice and text, golden replay, the browser leak check, the `<b>x</b>` test, the 409 test, the ratchet edit, and screenshots.

Separately, `graderErrorText`, `runEndLine` and `resultsNote` are pure functions, but `web/app.js` wires the DOM and calls `init()` when it is imported (`app.js:268-281`). That means `node --test` can't import them, and they can only be tested through Playwright.

· L: H · I: M · Mitigation:
- **Split T17** into:
  - **T17a:** `api.js` plus the happy-path switch-over; golden replay empty on the 57 runs that aren't allow-listed.
  - **T17b:** grader error and Skip (US2.1–US2.4, US2.11–US2.14).
  - **T17c:** results from `complete`, the results error, the note and the not-graded items (US3, US2.5–US2.10).
- **Add `web/copy.js`** (pure: `graderErrorText`, `resultsNote`, `runEndLine`, `feedbackText`) and **`tests/web-copy.test.js`** to the file list.
- Add `.missed li.not-graded` to `styles.css`. Today every item gets the danger border (`styles.css:90`), so "not graded" would look like a failure.

### frontend-engineer · 2026-10-09 · RISK
**Focus and accessibility gaps around the new states (FR-031, FR-032).** The spec sets focus only when an error panel appears.
- **(a) No `role="alert"` or `aria-live` on `#grader-error`, `#results-error` or `#results-note`.** In text mode the screen is the only channel. A screen-reader user lands on "Try again" and hears only the button name, never the message.
- **(b) Focus after Skip is undefined.** The Skip button hides, so focus drops to `<body>`.
- **(c) Focus after a successful "Retry results" is undefined.**
- **(d) Between the last line and the `complete` response,** the play screen stays frozen for up to 12 s. Nothing indicates it in text mode, and in voice mode it's silent. The copy table has no string for this, and adding a visible one would show up as a diff in all 48 MOCK golden runs.

· L: H · I: M · Mitigation: in T17 and the copy table:
- `role="alert"` on the two error messages, and `aria-describedby` from their buttons to the message. This adds no string, and the golden replay doesn't record ARIA.
- Focus after Skip goes to `#stop-btn`.
- Focus after a successful retry goes to `#result-rating` (`tabindex="-1"`). Both happen only in allow-listed runs, so there's no golden diff.
- Normal-path focus stays unchanged.
- PM decision for (d): either accept a silent wait (recorded alongside the "Still grading…" item under Later) or set `aria-busy` on `#results-screen` with no text.

### frontend-engineer · 2026-10-09 · RISK
**The golden harness is tied to URLs, so the allow-listed runs could silently stop testing the failure states (T03, T15, T17 evidence).**
- T03 defines `grade-aborted` as "`page.route` aborts the first grade request", and `complete-aborted` against a baseline that sends no `complete` request at all.
- If the harness matches `/api/grade`, then after T17 nothing is aborted. Those runs take the success path, and because they're allow-listed, the gate stays green while US2 and US3 go unchecked.
- The harness also has to wait for an asynchronous results screen.

T15 itself is fine. It is a mechanical rename, and `cancel()` keeps today's single `cancelWait` slot (`speech.js:33-47`).

· L: M · I: M · Mitigation:
- T03's `page.route` patterns cover both the old and new URLs: `/api/grade|/api/attempts/*/stops` and `/api/attempts/*/complete`.
- The harness asserts that each abort actually fired. A failure run where no abort fired fails the run.
- The results step waits for `#results-screen:not([hidden])` or `#results-error`.

### frontend-engineer · 2026-10-09 · RISK
**Small contract and rendering gaps (FR-008, FR-007, FR-035, FR-045).** The STOP and `complete` responses cover every field T17 needs (`errorStepId` for `markLine`, `correctAction` for the fix line, `total`, `ratingLabel`, `cleanRunLine`, `skippedStepIds`). The remaining gaps:
- **(a) The two 409s look the same to the browser.** The in-flight 409 can happen when the 12 s client timeout fires before the server has graded. My inference, not measured: the 8 s grade deadline plus a blocking synchronous SQLite `busy_timeout` of 5000 ms can exceed 12 s. The browser can't tell it apart from "after complete", so focus goes to Skip and the copy says "Couldn't reach the grader". That nudges the learner to skip a stop the server is grading right now.
- **(b) A replayed body reflects the original explanation, not the one the learner edited.**
- **(c) If `GET /api/subjects` returns `[]`,** `subjects[0].id` throws, and the learner sees "Can't reach the server: Cannot read properties of undefined".
- **(d) `<li class="${m.severity}">` is unescaped in an attribute** (`app.js:219`). Pack text reaches the DOM there. T17 only says "rendered with escapeHtml".

· L: L · I: M · Mitigation:
- (a) Accept, and record that server truth wins (US2.14). Optional improvement: the in-flight 409 body adds `retryable: true`, and the browser then focuses "Try again".
- (b) Accept, documented as an edge case.
- (c) Add a copy-table row: "No jobs are available right now."
- (d) T17 builds `missed[]` items with `createElement`/`textContent`, or escapes the class value as well.

### learning-designer · 2026-10-09 · POSITION
**Answering:** Q4

**How a "not sure" after a silent STOP is scored today.** There is no learner skip in the code. After a STOP (`web/app.js:110-123`) the explain panel offers only Submit or Enter. There is no cancel, skip or silence timer, and the prompt at `voice-first.md:50` belongs to F2's voice flow. So the only way a stuck learner can move on is to submit empty or near-empty text:
- **On a mistake (MOCK):** `mockGrade` returns `wrong`, reasoningScore 0, and feedback containing `why` (`shared/mock-grader.js:47-48`). LIVE mode sends "(no explanation given)", which the prompt grades `wrong` (`server/prompts/grade.js:13,55`).
- **Points:** `scoreStop` gives critical 300 × 0.5 × 0.25 = **+38**, major +25, minor +13 (`shared/scoring.js:34-40`). The mistake counts as **caught**.
- **What the learner sees:** "Right moment, wrong reason", plus "Here's the right way: {correctAction}" (`app.js:188`).
- **On a clean line:** `false_alarm`, **−75**.

F1a keeps all of this ("Empty explanation → graded as today"). It also records `explained.result.chars = 0`, so F2 can pick these stops out of the history later. **No F1a code change is needed, and none should be made** (golden replay).

**The two skips should be scored differently, because they mean different things.**

| | Grader-failure skip (F1a, Option B) | Learner "not sure" (F2) |
|---|---|---|
| Who failed | We did | The learner couldn't explain *yet* |
| What it tells us | Nothing | Real information: they noticed something but can't say why |
| Score on a mistake | Not graded: 0, left out of max and rating | **Exactly the empty-submit score** (+38 for an on-time critical); counts as caught |
| Score on a clean line | 0 | **−75 false alarm**, as today |
| Feedback | Revealed at results | **Full what / why / fix immediately** |
| Learner model (`data-and-evidence.md:79,84`) | No update; excluded | Recorded as its own outcome; FSRS Again (or at least Hard), **never "no update"** |

**Why I score it this way:**
1. **It closes an exploit.** If "not sure" were free on clean lines, the best strategy would be to STOP on every line and skip whenever unsure. That turns detection into free probing and undoes the −75 rule (`scoring.js:15`).
2. **Honesty should never cost points.** Saying "not sure" should score the same as typing nothing, never more and never less. Then the learner has no reason to type junk instead of admitting uncertainty, and any real attempt (≥ the floor) still beats skipping.
3. **This is the moment the learner learns most.** A failed attempt to retrieve the answer, followed straight away by the answer, improves later recall. The evidence is Kornell, Hays & Bjork 2009 and Metcalfe 2017 (`learning-science.md`; lab studies with word and fact material, moderate to strong). Applying it to explanations in this game is my extrapolation. Making it "not graded" and deferring the reveal throws that moment away.
4. **The planner needs this signal.** "Not graded → no update" would hide exactly the competencies the learner can't yet explain.

**What belongs in F1a, and what later:**
- **F1a (text only, so golden replay is unaffected):** strike or amend spec line 153, which binds F2's "skip" to "not graded". That sentence came from my learning-review finding 6; I retract that bullet.
- **Later (F2 voice flow and learner-model spec):**
  - A distinct outcome for "not sure", for example `graded.result.outcome = "unexplained"`; the shape is the architect's call.
  - A different spoken word from the "Skip this stop" button, so one word doesn't carry two scoring meanings. Draft: "Take your time. Say 'show me' if you're not sure."
  - A feedback label other than "Right moment, wrong reason".
  - Optionally, one staged hint (the area to look at) before the answer, per `user-flow.md`.

**Confidence:** high on the code facts and the exploit. Medium on Again vs Hard, which is the F2 learner-model spec's call.
**What would change my mind:** the PM making the STOP-everywhere probe impossible some other way (for example, capping skips per run), or founder play data showing "not sure" is almost never used.

### learning-designer · 2026-10-09 · RISK
**Failure mode:** Spec rev 3 line 153 locks F2's voice "skip" to "not graded". If F2 inherits that, "I'm not sure" becomes free on clean lines (STOP-everywhere exploit), produces no learner-model update (`data-and-evidence.md:79`), and delays the corrective reveal to the results screen.
**Likelihood:** M (the binding is written into an approved spec) · **Impact:** H (scoring integrity, plus mastery data that can't be corrected later)
**Mitigation:** PM edits line 153 in F1a. Suggested text: "'Skip this stop' means 'the grader failed; this stop isn't graded'. F2 must give the learner's 'not sure' a different word and its own scoring (thread 0004)." This is a text-only change, so no golden diff.

### learning-designer · 2026-10-09 · RISK
**Failure mode:** When every mistake is not graded, the learner is still labelled "Back to the classroom" (`tiers[3]`). In this edge case (spec Edge cases, "every mistake not graded") `maxPossible` = 0, so the rating rule's `pct` is 0. The worst competence label then goes to a run that has no information in it, caused by our failure. This is the same class of false feedback that Option B was adopted to remove (learning-review finding 1; Deci, Koestner & Ryan 1999: feedback must be informational, not controlling; strong meta-analysis, but applying it here is an extrapolation).
**Likelihood:** L (needs three failures in a row) · **Impact:** M (demotivating for the founder, and it erodes trust in grades)
**Mitigation:** Accept for F1a; it is outside the golden matrix. The F2 Results spec must show no rating when `maxPossible` = 0 and at least one mistake is not graded; the note line already explains why. Keep it under "Later".

### learning-designer · 2026-10-09 · RISK
**Failure mode:** The pre-registered F3 rule "catch rate excludes attempts with skips" (spec "Events and metrics") throws away whole attempts. Grader timeouts are more likely with long explanations (voice transcripts are longer) or on mobile networks, so the drop-out isn't random. It could bias the voice vs text comparison (`voice-first.md` §6). This is an inference, not measured.
**Likelihood:** L–M · **Impact:** M (it skews a primary metric of a pre-registered experiment)
**Mitigation:** For F3, not F1a (this is a metric rule, not behaviour): exclude only the not-graded mistakes from the denominator, using the stored `notGradedStepIds`, and report the skip rate per arm as a health check. F1a already stores everything this needs.
