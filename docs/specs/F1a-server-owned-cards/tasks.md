# F1a: Tickets

**Status:** Approved (revision 4: the pressure test in [thread 0004](../../team/threads/0004-f1a-pressure-test.md) applied: the architect's rulings, ADR 0003 Amendment 3, ADR 0005 Amendment 2, and the PM's splits. T01, T03, T07, T08, T13, T17 and T19 are split into sequential parts; `projectAttempt` moved from T06 to T13a. Revision 3: [`review.md`](review.md) "Re-review (round 2)" changes 1–4, S12, S13 and O3). Spec: [`spec.md`](spec.md). Binding: ADRs 0001–0007 including Amendment 1 of 0002, 0003, 0005 and 0006, Amendment 2 of 0002, 0003 and 0005, Amendment 3 of 0003, and Amendment 1 of 0004 (the ADR wins over this file), and the DECISIONs in [thread 0003](../../team/threads/0003-f1-engine-core-proposal.md) and [thread 0004](../../team/threads/0004-f1a-pressure-test.md).

Legend: [P] = can run in parallel with other [P] tickets in the same group (no shared files). Tickets without [P] run in the order of their `Depends on`. **Split tickets** keep the original number with a letter suffix (T07a, T07b). The parts of one split always run in letter order, never in parallel, and each part has its own PR, tests and review.

## Rules for every ticket in this spec

- **Merge gate:** nothing except F1a-T01a, F1a-T01b, F1a-T02 and F1a-T03a merges before F1a-T03b (golden baseline complete) has merged.
- **`todo` mapping (thread 0004):** every acceptance or e2e test that waits on a ticket is declared `{ todo: 'F1a-T##' }` with the implementing ticket's ID, including its suffix (`F1a-T13b`, `F1a-T17c`). A guardrail test (F1a-T01a) fails on any `todo` reason that doesn't match `/^F1a-T\d\d[a-d]?$/`. QA removes a ticket's `todo` markers when it verifies that ticket, never later in a sweep. A `todo` left at F1a-T19b is a blocker bug against its ticket. The scenario → ticket table is the grep of these reasons.
- **No test compares against something a later ticket deletes (thread 0004):** no new test uses a legacy route (`/api/grade`, `/api/trades`, `/api/scenario`), `server/llm.js` or `scoreRun().rating` as its expected value. Expected values are frozen inline or in a named fixture. Any test that must still use a legacy route is listed in F1a-T18's Files with `old → new`. None is expected.
- **Every happy-path LIVE test asserts `source: 'live'`** (T08a, T08b, T12, T13b, T16), and from T09 on every test file that starts fake Claude asserts in `after` that its `/__log` has zero `kind: null` entries (SC-007).
- **Golden replay after every wave:** QA runs `node tests/golden/run.mjs --replay` after the last ticket of each wave. Any diff outside `tests/fixtures/golden/allow-list.json` is a blocker bug. A flaky run is a harness bug ticket, never an allow-list entry (review R2).
- **Deny-list ratchet (from F1a-T10 on):** a ticket that removes a deny-listed word from `server/`, `shared/`, `web/` or `scripts/` lowers the matching count in `tests/fixtures/deny-list-allow.json` in the same change. That one-file edit is allowed for every ticket after T10 and is not a file-list deviation. No ticket may raise a count or add an entry.
- **Changed assertions:** any existing test whose assertion changes is listed in the ticket as `old → new`. Path-only or setup-only edits are listed as such.
- **Shared files are edited in sequence, never in parallel:**
  - `shared/contract.js` T07b → T13b; `shared/scoring.js` T21 → T18; `shared/events.js` T06 → T13a; `shared/mock-grader.js` T13b only.
  - `server/index.js` T04 → T07a → T12 → T18; `server/routes/scenarios.js` T04 → T07b → T12 → T18; `server/services/content.js` T04 → T07b → T08b → T12 → T18; `server/services/assessment.js` T04 → T08b → T13b → T18; `server/services/ai-client.js` T04 → T08b; `server/routes/attempts.js` T12 → T13b → T14; `server/services/session.js` T12 → T13b → T14.
  - `scripts/simulate.js` T07b → T18.
  - `tests/helpers/fake-claude.mjs` T03a → T07b → T09; `tests/golden/**` and `tests/fixtures/golden/**` T03a → T03b; `tests/prompt-version.test.js` T05 → T07b; `tests/pack-format.test.js` T20 → T07b; `tests/events.test.js` T06 → T13a; `tests/mock-grader.test.js` T07b → T13b; `tests/gateway.test.js` T08a → T09 (the `after` hook only); `tests/scoring.test.js` T07b → T18; `tests/game-balance.test.js` T07b → T18; `tests/helpers/http.mjs` T07b → T16; `tests/llm-deadline.test.js` T08b → T16; `tests/acceptance/F1a.test.js` T01a → QA's verification of each ticket (`todo` removals); `tests/e2e/F1a.e2e.mjs` T01b → QA's verification of each ticket.
  - `web/api.js` T17b only; `web/copy.js` T17a only; `web/app.js` T15 → T17b → T17c → T17d; `web/index.html` T17b → T17c → T17d; `web/styles.css` T17c → T17d.
  - (Review round 2, O3, and thread 0004: these are already sequenced by `Depends on`; listed so a re-plan can't parallelise them.)
- **No prompt text, template or schema change anywhere in F1a** (FR-027). A diff that changes a frozen fingerprint (T05) fails review.
- **Ownership:** per the `CLAUDE.md` table (founder DECISION on OI-8, thread 0003). `package.json`, `.gitignore`, `packs/**`, `README.md` are `backend-engineer`'s. Recorded helper exceptions (review S10): T06 edits `tests/helpers/server.mjs`, T07b edits the path in `tests/helpers/fake-claude.mjs`; QA acknowledges both in T09's PR.
- **Run your own tests against a DB:** spawned servers use `DB_PATH=:memory:` (set by the helper after T06); tests that inspect events spawn with `DB_PATH=<temp file>` and open it read-only afterwards.

## Group 0 (Wave 0): baseline and safe refactors

### F1a-T01a [P] Acceptance tests, HTTP level (in `npm test`)
- **Owner:** qa-engineer
- **Size:** M
- **Depends on:** none
- **Files:** create `tests/acceptance/F1a.test.js`, `tests/acceptance/helpers.mjs`, `tests/acceptance/todo-guardrail.test.js`
- **Interfaces:**
  - Consumes: the routes and shapes in spec FR-001–FR-012, FR-024–FR-029, FR-035, FR-042–FR-047 (not yet built); `startServer(env)` from `tests/helpers/server.mjs`; `startFakeClaude()` from `tests/helpers/fake-claude.mjs`.
  - Produces: `leakScan(json: unknown, {kind: 'stop' | 'complete' | 'other'}) → string[]` in `tests/acceptance/helpers.mjs`. Returns the JSON paths of any key in `["why","summary","correctAction","consequence","keywords","severity"]`, plus the key `error` **only when its value is not a string** (ADR 0003 Amendment 1; review S3). Allowed: `caught.severity` and `caught.correctAction` when `kind = 'stop'`; anything under `missed[]` when `kind = 'complete'`. Never throws (cyclic input → path `"<cycle>"`). F1a-T01b and F1a-T19a reuse it.
- **Acceptance:** every HTTP-level acceptance scenario (US1 API parts, US4, US5 including US5.6, US6 API parts, the Skip consequence at the API level) and every server-side edge case has at least one named test in `tests/acceptance/F1a.test.js`, which runs in `npm test`. LIVE tests pin `GRADE_DEADLINE_MS=1500` and `SCENARIO_DEADLINE_MS=2000`.
- **Tests that prove it:** each test is named `"<US#>.<scenario#> <title>"` or `"edge: <title>"`. Required, among all others:
  - "leakScan: {error:'unknown subject'} is clean, {error:{why:'x'}} is flagged" (S3);
  - "edge: skippedStepIds validation"; "US4.6 completed.result.skippedStepIds and notGradedStepIds"; "US2.14 lost response then skip: the server's graded STOP stands" (API half);
  - "edge: same STOP twice in flight joins: both 200, identical body, one triplet, one grade call" and "edge: different stepId while one is in flight gets 409 and writes nothing" (ADR 0003 Amendment 3; LIVE against fake Claude with a delayed grade);
  - "edge: complete while a STOP is in flight gets 409 and writes nothing" (LIVE, delayed grade);
  - "edge: fake-Claude failure matrix (start)" (`todo: 'F1a-T12'`) and "edge: fake-Claude failure matrix (stops)" (`todo: 'F1a-T13b'`): one table-driven test per route over the 9 modes {hang, 429 `retry-after: 60`, 500, 529, refusal, `max_tokens` + truncated JSON, non-JSON text, wrong-schema `{}`, fallback block}. Each row asserts 200; `source` `fixture-fallback` / `mock-fallback` (`live` for the fallback block); `ms ≤ deadline + 1000`; exactly one new `llm_call` row whose `outcome` is FR-026's value for that mode; and `started` with `promptVersions {scenario:'scenario@1'}`, or exactly one triplet with `graded.context.promptVersions {grade:'grade@1'}`. Wrong-schema rows are `{}` (no `feedback`).
  - `tests/acceptance/todo-guardrail.test.js`: "every todo reason in tests/acceptance and tests/e2e matches /^F1a-T\d\d[a-d]?$/" (reads the source of every `*.js` / `*.mjs` file that exists under those two directories).
  - Until its implementing ticket merges, each test is declared with `{ todo: 'F1a-T##' }` (with suffix) so `npm test` stays green. QA removes the `todo` when verifying that ticket. If this ticket has already merged, QA adds the thread-0004 tests in the same file before verifying the ticket they name.
- **Notes:** written from the spec, not the code. `npm test` only picks up `tests/acceptance/` after F1a-T06 widens the glob; run the file directly until then.

### F1a-T01b Acceptance tests, browser level (e2e)
- **Owner:** qa-engineer
- **Size:** M
- **Depends on:** F1a-T01a (`leakScan`), F1a-T03a (`tests/golden/browser-stubs.js` and the timing contract)
- **Files:** create `tests/e2e/F1a.e2e.mjs`
- **Interfaces:**
  - Consumes: `leakScan` from `tests/acceptance/helpers.mjs`; `tests/golden/browser-stubs.js` (held utterances; reused, not edited); the DOM ids in spec US1–US3 and FR-049 (`#grader-error`, `#retry-grade-btn`, `#skip-stop-btn`, `#results-error`, `#retry-results-btn`, `#results-note`, `#result-rating`, `#stop-btn`, `#again-btn`, `#setup-msg`, `#scenario-select`).
  - Produces: CLI `node tests/e2e/F1a.e2e.mjs` (Playwright, global install, `MOCK=1`, free port, 390 px and 1280 px, zero console errors).
- **Acceptance:** every browser-level acceptance scenario (US1–US3 in voice and text mode, including US1.11–US1.12, US2.1–US2.18 and US3.1–US3.8) has at least one named test. **Timing contract (same as T03a):** (1) `page.clock.install()` before `page.goto`; (2) each `speechSynthesis.speak` utterance is held until the test releases it, and `cancel()` ends held utterances with Chromium's events; (3) actions are keyed on DOM state ("line N appended", panel visible), never on elapsed time; (4) time moves only through `page.clock.runFor`, and only while no `/api/*` request is pending (track `request`, `requestfinished`, `requestfailed`). The only exception is the client-timeout tests, which hold the route and run the clock 12 000 ms. Failure states use `page.route` abort or a fulfilled status. Abort patterns match both URL shapes (`**/api/grade` or `**/api/attempts/*/stops`; `**/api/attempts/*/complete`). Budget: the suite runs in ≤ 10 min, and the time is quoted in each verification.
- **Tests that prove it:** named as in T01a. Required, among all others: "US2.5 skip on the critical line: skippedStepIds [3] sent and stored, line 3 critical · not graded, total -100, max 300, results note shown and spoken, focus on #stop-btn after Skip" (B9, B10) and its text-mode twin; "US2.7 skip on a clean line costs no false alarm" and twin; "US2.9 nothing truly missed but one not graded: clean-run line not spoken" and twin; "US2.13 4xx focuses Skip this stop"; "US2.1 STOP client timeout at 12 000 ms shows the panel" (`todo: 'F1a-T17c'`); "US3.1 complete client timeout at 12 000 ms shows #results-error" (`todo: 'F1a-T17b'`); "edge: a 409 on complete shows #results-error" (voice and text; `page.route` fulfils `…/complete` with 409; review round 2, change 3); "US2.15 Skip, Submit and mic are disabled while a STOP request is pending" and "a double press on Try again sends one request"; "US2.17 mic during the spoken error cancels speech before listening"; "US2.18 Enter in the error state runs Try again with the edited text"; "US3.6 focus on #result-rating after a successful Retry results"; "US3.7 Run another job during a pending complete: results never appear over setup"; "no speechSynthesis.speak after #again-btn"; "US1.11 empty subjects list shows No jobs are available right now. with 0 console errors" (`page.route` fulfils `/api/subjects` with `[]`); "role=alert on both error messages, aria-describedby on their buttons, role=status on #results-note" (DOM attribute assertions). Todo reasons per the mapping rule (`F1a-T17b`, `F1a-T17c`, `F1a-T17d`).
- **Notes:** may start when T01a and T03a merge. It runs outside `npm test`. QA re-runs it to verify T12–T18.

### F1a-T02 [P] Injectable rng for the scenario user prompt
- **Owner:** backend-engineer
- **Size:** S
- **Depends on:** none
- **Files:** modify `server/prompts/scenario.js`; create `tests/scenario-prompt-rng.test.js`
- **Interfaces:**
  - Produces: `scenarioUserPrompt(tradeId, trade, recentSummaries = [], rng = Math.random) → string`. `pick(a)` becomes `pick(a, rng)` using `Math.floor(rng() * a.length)`. The parameter names `tradeId`/`trade` stay (prompt file; renamed in F1b).
- **Acceptance:** FR-028. With `rng` omitted, behavior is unchanged. With a fixed `rng`, the output is a pure function of the inputs. No other text changes; no `VERSION` (T05 adds it).
- **Tests that prove it:** `tests/scenario-prompt-rng.test.js`: "same rng sequence gives byte-identical prompt", "rng () => 0 picks the first hint, twist and name", "default rng still varies names over 200 calls", "frozen snapshot: electrical with rng () => 0.5 equals the stored string" (snapshot inline in the test, generated from the pre-change code).
- **Notes:** behavior-neutral, so it may merge before T03b. `tests/validator.test.js:231-263` must pass unchanged.

### F1a-T03a Golden harness and MOCK baseline
- **Owner:** qa-engineer
- **Size:** M
- **Depends on:** F1a-T02
- **Files:** create `tests/golden/run.mjs`, `tests/golden/harness.mjs`, `tests/golden/scripts.mjs`, `tests/golden/browser-stubs.js`, `tests/golden-isolation.test.js`, `tests/fixtures/golden/manifest.json`, `tests/fixtures/golden/allow-list.json`, `tests/fixtures/golden/runs/*.json` (the 52 MOCK runs); modify `tests/helpers/fake-claude.mjs`
- **Scope of the split (thread 0004):** T03a builds the harness, the timing contract and isolation, and captures the 48 MOCK runs plus the 4 allow-listed runs. T03b adds the 9 LIVE-against-fake-Claude runs (including masking) and certifies the full 61-run baseline. The "Interfaces", "Matrix", "Layers" and "Normalization" text below is shared; each part's acceptance says which runs it owns.
- **Interfaces:**
  - Produces (`tests/helpers/fake-claude.mjs`, review B11): every `/__log` entry gains `system` (the request's `system` as one string: a string as is, an array of text blocks joined with `"\n"`) and `schemaSha256` (sha256 hex of `JSON.stringify(body.output_config.format.schema)`, `null` if absent). Existing fields and routing are unchanged.
  - Produces: CLI `node tests/golden/run.mjs --capture | --replay [--repeat N] [--only <runId>] [--expect-aborts]`; exit 0 = no diff outside the allow-list and every abort check passed.
  - Golden run file `tests/fixtures/golden/runs/<runId>.json`: `{runId, mode: "mock"|"live-fake", speech: "voice"|"text", fixture, script, displayed: string[], spoken: string[], focus: string[], points: number[], score: number, rating: string, outcomeLine: string|null, grades: [{verdict, source}], prompts: [{kind, system, user, schemaSha256}], abortsFired: number}`. `abortsFired` is recorded at replay and never diffed.
  - `manifest.json`: `{capturedAt, gitSha: string|null, treeSha256, node, chromium, env: {GRADE_DEADLINE_MS, SCENARIO_DEADLINE_MS}, runs: string[]}`. `gitSha` = `git rev-parse HEAD` output, or `null` when git is missing or exits non-zero (review OI-7). `treeSha256` = sha256 over the sorted `path\0content` of every file in `server/`, `shared/`, `web/`, `fixtures/`; capture-time metadata only, **never compared at replay**.
  - **Isolation (thread 0004):** at replay the harness reads only `tests/golden/**` and `tests/fixtures/golden/**`. Explanations, line indices and the three masking lists are inline in `scripts.mjs`. The server is spawned only through `tests/helpers/server.mjs`.
  - **Abort routes:** `grade-aborted` aborts the first request matching `**/api/grade` or `**/api/attempts/*/stops`; `complete-aborted` aborts the first request matching `**/api/attempts/*/complete`. A `grade-aborted` run with `abortsFired: 0` always fails. With `--expect-aborts` (T17d's and T19b's evidence), a `complete-aborted` run with 0 also fails; before T17b there is no `complete` request, which is why that check needs the flag.
  - **Results wait:** the results step waits for `#results-screen:not([hidden])` or a visible `#results-error`.
  - **Timing contract:** (1) `page.clock.install()` before `page.goto`; (2) `browser-stubs.js` holds each `speechSynthesis.speak` utterance until the harness releases it, and `cancel()` ends held utterances with the same events Chromium fires; (3) script actions are keyed on DOM state ("line N appended", panel visible), never on elapsed time; (4) time moves only through `page.clock.runFor`, and only while no `/api/*` request is pending (the harness tracks `request`, `requestfinished`, `requestfailed`); (5) live-fake runs pin `GRADE_DEADLINE_MS=1500` and `SCENARIO_DEADLINE_MS=2000`, recorded in `manifest.env`; (6) budget: one `--replay` of 61 runs ≤ 10 min, quoted in the PR.
  - `allow-list.json`: `["grade-aborted-electrical-voice", "grade-aborted-electrical-text", "complete-aborted-electrical-voice", "complete-aborted-electrical-text"]`. This file never grows.
- **Acceptance (T03a):** the 48 MOCK runs and the 4 allow-listed runs are captured from the code before any F1a ticket except T01a, T01b and T02, and replayed 3× with byte-identical output before they are committed. `--replay` for those 52 runs takes ≤ 9 min. `tests/golden-isolation.test.js` is in `npm test`.
  - **Matrix (61 runs; T03a owns the MOCK and allow-listed rows, T03b the LIVE rows):**
    - MOCK × 3 fixtures × 8 scripts × {voice, text} = 48. Scripts: `perfect`, `late-by-one`, `false-alarm` (STOP on line 1 only), `missed-critical` (STOP on major and minor only), `never-stop`, `empty-explanation` (STOP on the critical line, submit empty), `wrong-explanation` (STOP on the critical line, "his shoes are untied"), `double-stop` (STOP on a mistake, then STOP on the next line).
    - LIVE against fake Claude, cached card, text: 3 fixtures × {`perfect`, `false-alarm`} = 6.
    - LIVE, live-generated card, text, `perfect`: 1.
    - LIVE, fake Claude `hang` on grade, text, `perfect`: 1. LIVE, fake Claude `429` with retry-after 60, text, `perfect`: 1.
    - Allow-listed failure runs, MOCK electrical, {voice, text}: `grade-aborted` (aborts the first request matching either grade URL shape), `complete-aborted` (aborts the first `…/complete` request; in the baseline there is none, so the run records the normal results) = 4.
  - **Layers recorded:** learner-visible (displayed strings: transcript lines with speaker, verdict label, feedback text, points, source line, score, results fields, missed items, every panel message; `speechSynthesis.speak` texts in order; `document.activeElement` id after each panel change) and outbound-prompt (`system`, `user`, `schemaSha256` per fake-Claude call, from `/__log`); plus grade verdict and source. Screenshots at 390 and 1280 px go to the OS temp dir as a diff aid, not committed and not asserted.
  - **Normalization:** `Date.now()`-based ids are replaced by `<id>`. In the one live-generated run only (review OI-10), the **value** after each of the three labels "Draw the critical mistake from: ", "Jobsite twist to include: " and "Apprentice name: " is replaced by `<masked>`, and the harness asserts the value is a member of its source list: the electrical entry's `criticalHints`, else its `hazardHints` split on commas and trimmed, plus the literal `any of the hazard areas`; its `twists`, else `DEFAULT_TWISTS`; `APPRENTICE_NAMES`. The three lists are frozen as constants in `tests/golden/scripts.mjs`, copied from `server/prompts/trades.js` and `server/prompts/scenario.js` at capture time (no prompt file is edited, no seed env var). The rest of the prompt is compared byte for byte; a non-member value is a diff.
  - The harness spawns the server with `DB_PATH=:memory:` so it works unchanged after T06.
- **Tests that prove it (T03a):** `node tests/golden/run.mjs --capture` then `--replay --repeat 3` exits 0 on the 52 runs; quote the output and the time in the PR. `tests/golden-isolation.test.js`: "no file in tests/golden/ contains a path string under fixtures/, packs/, server/ or shared/"; "the harness spawns the server only through tests/helpers/server.mjs". A `grade-aborted` run whose route pattern is changed to a URL that is never requested fails with `abortsFired: 0` (shown once in the PR). Full `npm test` passes with the `fake-claude.mjs` change (no assertion changes).
- **Notes:** explanation strings and line indices per fixture and step are inline in `scripts.mjs`; nothing under `fixtures/`, `packs/`, `server/` or `shared/` is read at replay (the old note allowing it is withdrawn, thread 0004). Rejected: a self-test that renames `fixtures/` (a crash would leave the tree broken). Later edits to `fake-claude.mjs`: T07b (path only), then T09 (routing).

### F1a-T03b Golden LIVE runs and the complete baseline (merge prerequisite)
- **Owner:** qa-engineer
- **Size:** M
- **Depends on:** F1a-T03a
- **Files:** modify `tests/golden/run.mjs`, `tests/golden/harness.mjs`, `tests/golden/scripts.mjs`, `tests/fixtures/golden/manifest.json`; create `tests/fixtures/golden/runs/*.json` (the 9 LIVE runs)
- **Interfaces:** as in T03a. Adds the LIVE-against-fake-Claude mode: fake Claude is started by the harness with `startFakeClaude()`, the server with `GRADE_DEADLINE_MS=1500` and `SCENARIO_DEADLINE_MS=2000` (written to `manifest.env`); the outbound-prompt layer is read from `/__log`; masking and membership checks per "Normalization".
- **Acceptance:** the 9 LIVE runs in the matrix are captured, and the full 61-run baseline replays 3× with byte-identical output before commit. `--replay` of 61 runs ≤ 10 min. SC-001 can now be evaluated, and the merge gate lifts when this ticket merges.
- **Tests that prove it:** `node tests/golden/run.mjs --replay --repeat 3` exits 0 on all 61 runs (output and time quoted in the PR); one deliberately wrong masked value (a name not in `APPRENTICE_NAMES`, injected in a scratch copy of a run file) is reported as a diff; full `npm test` green.

### F1a-T04 [P] Split `server/index.js` into routes and services (zero test changes)
- **Owner:** backend-engineer
- **Size:** M
- **Depends on:** F1a-T03b
- **Files:** modify `server/index.js`; create `server/http.js`, `server/routes/health.js`, `server/routes/scenarios.js`, `server/routes/grade.js`, `server/services/content.js`, `server/services/assessment.js`, `server/services/live-status.js`, `server/services/ai-client.js`
- **Interfaces:**
  - Produces:
    - `server/http.js`: `class HttpError(status, message)`, `sendJson(res, status, data)`, `readBody(req) → Promise<object>` (413 over 1,000,000 bytes, 400 on bad JSON), `serveStatic(res, pathname)`, `MIME`, `ROOT` (absolute repo root).
    - `server/services/live-status.js`: `liveStatus {lastLiveOkAt, lastLiveError}`, `noteLive(what, err?)`.
    - `server/services/ai-client.js`: `export const MOCK: boolean`, `export const ai` = `null` in MOCK, else the module from `await import('../llm.js')`. This is the **only** place that chooses the AI module (T08b replaces it).
    - `server/services/content.js`: `getScenario(tradeId, source) → Promise<{scenario, source}>` (moved verbatim).
    - `server/services/assessment.js`: `grade(body) → Promise<GradeResponse>` (moved verbatim).
    - Each route module: `handle(req, res, url) → Promise<boolean>` (true if it handled the request). `server/index.js` keeps env loading, `process.on('unhandledRejection')`, the `[api]` log line, the dispatcher loop, the 404 and error handling, and `listen`.
- **Acceptance:** pure move. Every existing test passes with zero test-file changes; golden replay is empty; the startup line `… on http://localhost:<port> …` is unchanged.
- **Tests that prove it:** the full existing suite (`npm test`, 97 pass) and `node tests/golden/run.mjs --replay`.
- **Notes:** required first by the architect (A4). Keep function bodies byte-identical where possible so the diff reads as a move.

### F1a-T05 [P] `VERSION` and `PROMPT` exports, frozen fingerprints
- **Owner:** backend-engineer
- **Size:** S
- **Depends on:** F1a-T02, F1a-T03b
- **Files:** modify `server/prompts/grade.js`, `server/prompts/scenario.js`; create `tests/prompt-version.test.js`
- **Interfaces (ADR 0005 + Amendment 1; review B1, S5):**
  - Produces in `grade.js`: `export const VERSION = 1;` and `export const PROMPT = {id: 'grade', system: GRADE_SYSTEM, schema: GRADE_SCHEMA, render: (i) => gradeUserPrompt(i.scenario, i.stepId, i.errorStepId, i.explanation), fingerprintInputs: [4 inputs]}`. `GRADE_SCHEMA` is imported from `shared/contract.js` (import only, no contract change).
  - Produces in `scenario.js`: `export const VERSION = 1;` and `export const PROMPT = {id: 'scenario', system: SCENARIO_SYSTEM, schema: SCENARIO_SCHEMA, render: (i) => scenarioUserPrompt(i.key, i.entry, i.recentSummaries ?? [], i.rng), fingerprintInputs: [≥ 4 inputs]}`.
  - `fingerprintInputs` (synthetic content, none of the FR-038 seed words): grade = on-time catch, late catch (`stepId = errorStepId + 1`), false alarm (`errorStepId: null`), empty explanation. Scenario = with `criticalHints`, without `criticalHints`, with `twists`, with recent summaries; every scenario input has `rng: () => 0`.
  - Fingerprint algorithm (the one `promptFingerprint` in T08a must reproduce): `createHash('sha256')`, `update(system)`, `update(JSON.stringify(schema))`, then `update(render(i))` for each `fingerprintInputs` entry in order; `digest('hex')`.
  - `PROMPT_ID` is **not** exported (dropped per review B1). No existing export is renamed or removed.
- **Acceptance:** FR-027. `render(i)` returns exactly what `gradeUserPrompt` / `scenarioUserPrompt` return for the same arguments. No text, template or schema changes.
- **Tests that prove it:** `tests/prompt-version.test.js`: "every module in server/prompts except trades.js exports an integer VERSION ≥ 1 and PROMPT {id, system, schema, render, fingerprintInputs}" (the `trades.js` exclusion is by file name; T07b removes it when it deletes the file), "PROMPT ids are unique", "render equals the legacy function for every fingerprint input", "fingerprintInputs contain none of the FR-038 seed words (inline list)", "grade and scenario fingerprints equal the frozen hex values" (values computed from the pre-change text and pasted into the test).

## Group 1 (Wave 1): storage, packs, gateway

### F1a-T06 SQLite, migrations and the event log
- **Owner:** backend-engineer
- **Size:** M
- **Depends on:** F1a-T04
- **Files:** create `server/db.js`, `server/migrations/001-init.sql`, `shared/events.js`, `tests/db.test.js`, `tests/events.test.js`; modify `package.json`, `.gitignore`, `tests/helpers/server.mjs`
- **Interfaces (ADR 0001, ADR 0002 + Amendment 1; review B2, B5, S1, S2):**
  - Produces (`server/db.js`, the only importer of `node:sqlite`):
    - `DEFAULT_DB_PATH` = `<ROOT>/data/app.db` (absolute, resolved against the repo root, never the working directory).
    - `openDb(path: string) → Db`: opens `DatabaseSync`; for a file path creates the parent directory and sets `journal_mode=WAL` and `busy_timeout=5000`; runs pending `server/migrations/NNN-*.sql` in order, each in one transaction that ends with `PRAGMA user_version = NNN`. A failing migration rolls back and throws `Error('[db] migration NNN failed: <message>')`.
    - `initDb(path = process.env.DB_PATH || DEFAULT_DB_PATH) → Db`: opens the process database and stores it. `getDb() → Db`: returns it, throws `Error('db not initialised')` before `initDb`.
    - `Db` has exactly these methods and never exposes the `DatabaseSync` handle:
      - `appendEvents(events: Event[]) → void`: one transaction; every event must pass `validateEvent`, otherwise it throws and writes nothing; on any error writes nothing. The transaction is exactly `exec('BEGIN')` … `exec('COMMIT')` with `catch (e) { try { exec('ROLLBACK') } catch {} throw e }`; never branch on `isTransaction` (thread 0004). Each migration uses the same pattern.
      - `eventsForAttempt(attemptId: string) → Event[]`: `WHERE json_extract(context_json, '$.attemptId') = ?` exactly (so `event_attempt` is used), `ORDER BY seq`, JSON columns parsed.
      - `putCard(row: CardRow) → void` (INSERT OR IGNORE on `id`); `getCard(id: string) → CardRow | null` (`json` parsed into `card`).
      - **Every reader returns plain objects** (thread 0004): each row is copied into an object literal and its JSON columns are `JSON.parse`d, so `node:sqlite`'s null-prototype rows never escape `server/db.js`.
      - `putPack({id, version, json: string, provenance: string}) → 'inserted' | 'same' | 'conflict'`: inserts if `(id, version)` is new; else compares `json` with the stored value.
      - `logLlmCall(row: LlmCallRow) → void`; `close()`.
    - `CardRow = {id, subject_id, subject_version, mode: 'stop', competency_id: null, mistake_types_json: null, subtlety: null, card: object, verify_json: null, status: 'ok', prompt_version: string|null, model: string|null, source: 'fixture'|'live', created_at}`. `LlmCallRow` = the `llm_call` columns (FR-026).
  - Migration `001-init.sql`: `event` (`seq INTEGER PRIMARY KEY`, columns per `data-and-evidence.md` §2), `subject_pack`, `card`, `llm_call`; `card` CHECKs `source IN ('fixture','live')` and `source <> 'live' OR (length(prompt_version) > 0 AND length(model) > 0)` (`prompt_version`, `model` nullable); triggers `event_no_update` and `event_no_delete` doing `SELECT RAISE(ABORT, 'event is append-only')`; index `event_attempt` on `json_extract(context_json, '$.attemptId')`.
  - Produces (`shared/events.js`, pure, browser-safe):
    - `VERBS` (the full `data-and-evidence.md` §1 vocabulary), `OUTCOMES` (§1's six outcomes).
    - `newId(prefix: 'evt'|'att'|'card'|'llm') → string`: `<prefix>_` + 26-char Crockford ULID (time + `crypto.getRandomValues`).
    - `makeEvent({verb, object, result = null, context, actor = 'learner_1', at = new Date().toISOString()}) → Event` with `id = newId('evt')`.
    - `validateEvent(e: unknown) → string[]` (empty = valid; any `VERBS` verb; checks `id`, `at`, `actor`, `object.type`, `object.id`, `context.subject`, `context.attemptId`, `context.promptVersions` is an object). Never throws.
    - `projectAttempt` is **not** in this ticket: it moved to F1a-T13a, its first consumer (thread 0004).
  - `package.json`: `engines.node` → `">=22.13"`; `scripts.test` → `node --test "tests/**/*.test.js"`; add `scripts["check:ticket"]` → `node tests/tools/check-ticket.mjs` (the target file arrives in T11; harmless until then, review O1).
  - `.gitignore`: add `data/`.
  - `tests/helpers/server.mjs`: default env gains `DB_PATH: ':memory:'` (caller's env still overrides).
- **Acceptance:** FR-013 (db module), FR-014, FR-015, FR-017 (id format), FR-018 (all but `projectAttempt`, plus plain objects and explicit rollback), FR-041, SC-006 (by the two named append-only tests). Nothing calls the DB yet; golden replay is empty.
- **Tests that prove it:** `tests/db.test.js`: "node:sqlite is imported only in server/db.js" (grep over `server/`, `shared/`, `web/`, `scripts/`; B9), "migrations run once and set user_version to 1", "re-opening a migrated file DB runs nothing", "a failing migration throws [db] migration 001 failed and leaves user_version 0", "UPDATE on event throws append-only", "DELETE on event throws append-only", "live card with NULL or empty prompt_version or model is rejected", "fixture card with NULL stamps is accepted", "source other than fixture or live is rejected", "putCard is idempotent by id", "appendEvents writes all or nothing (an invalid second event leaves zero rows)", "eventsForAttempt returns only that attempt in seq order", "eventsForAttempt uses the event_attempt index (EXPLAIN QUERY PLAN)", "putPack returns inserted, same, conflict", "file DB is created with its directory and journal_mode wal", "DEFAULT_DB_PATH is absolute and under the repo root", "getDb before initDb throws", "after a failed appendEvents, the next appendEvents succeeds", "Db returns plain objects" (`Object.getPrototypeOf(x) === Object.prototype` for an event, its `result` and a card row). `tests/events.test.js`: "newId matches ^<prefix>_[0-9A-HJKMNP-TV-Z]{26}$ for evt, att, card, llm", "1000 ids are unique and the 10-char time prefix never decreases" (S2), "makeEvent fills id, at, actor", "validateEvent accepts every VERBS verb", "validateEvent rejects unknown verb, missing attemptId, missing subject", "validateEvent never throws on null, [], 'x' and a cyclic object" (B9).
- **Notes:** the `ExperimentalWarning` on stderr is expected; do not suppress it with a flag that changes behavior. Size stays M after the move of `projectAttempt` (thread 0004).

### F1a-T20 [P] Pack format v1: `pack.json` and `shared/pack.js`
- **Owner:** backend-engineer
- **Size:** S
- **Depends on:** F1a-T03b
- **Files:** create `packs/demo-trades/pack.json`, `shared/pack.js`, `tests/pack-format.test.js`
- **Interfaces (ADR 0006 + Amendment 1; review B4):**
  - Produces `packs/demo-trades/pack.json` (values copied verbatim: scenarios from `server/prompts/trades.js`, severity meanings from `server/prompts/scenario.js:13`, ratings from `shared/scoring.js:73-80`, clean run from `web/app.js:228`, synonyms and false-alarm text from `shared/mock-grader.js`):
    ```json
    {
      "id": "demo-trades",
      "version": 1,
      "title": "Trades demo",
      "severity": { "critical": "…", "major": "…", "minor": "…" },
      "ratings": { "missedCritical": "Someone got hurt",
                   "tiers": ["Journeyman eyes", "Solid supervisor", "Keep watching", "Back to the classroom"] },
      "copy": { "cleanRun": "Clean job. Nobody got hurt.",
                "falseAlarmFeedback": "That step was actually fine. Stopping the job costs time, so save the STOP for real hazards." },
      "grading": { "synonyms": { "…": ["…"] } },
      "scenarios": [
        { "id": "electrical", "label": "Electrical: replace a receptacle", "brief": "…", "hazardHints": "…",
          "criticalHints": ["…"], "twists": ["…"], "fixture": "electrical.json" },
        { "id": "hvac", "label": "HVAC: braze a suction line", "…": "…", "fixture": "brazing.json" },
        { "id": "automotive", "label": "Automotive: front brake job", "…": "…", "fixture": "brakes.json" }
      ],
      "provenance": { "builtBy": "hand" }
    }
    ```
    Scenario order is today's `listTrades()` order. No `format` field, no `generation` wrapper, no `cards/` directory.
  - Produces (`shared/pack.js`, pure, browser-safe):
    - `validatePack(p: unknown) → string[]`: never throws; requires the fields above; `id` matches `^[a-z0-9-]{1,40}$`; `version` integer ≥ 1; exactly 4 `ratings.tiers`; caps: ≤ 50 scenarios, every string ≤ 2000 chars, ≤ 200 synonym terms with ≤ 20 strings each; `fixture` matches `^[a-z0-9-]+\.json$`.
    - `RATING_KEYS = ['missedCritical', 'tier0', 'tier1', 'tier2', 'tier3']`.
    - `ratingLabel(ratings, key) → string | null`: `missedCritical` → `ratings.missedCritical`; `tierN` → `ratings.tiers[N]`; anything else → `null`.
- **Acceptance:** FR-019 (pack.json half), FR-020 (`validatePack`), FR-021 (`ratingLabel`), FR-023 for the copied values. Nothing reads the pack yet; golden replay empty.
- **Tests that prove it:** `tests/pack-format.test.js`: "demo-trades pack.json validates", "validatePack never throws on null, [], 'x', a cyclic object and a 5 MB string" (B9), "validatePack rejects 3 tiers, a missing copy.falseAlarmFeedback, a fixture name with a slash", "ratingLabel maps all 5 keys to today's 5 strings" (B9; literals frozen in the test), "copy, severity, synonyms and scenario fields equal today's literals" (compared with imports of `trades.js`, `mock-grader.js` before T07b deletes them; frozen literals after).
- **Notes:** split from the old T07 by the size rule; it takes pure work off the backend critical path (review R1).

### F1a-T07a Pack loader, startup order and pack scenario files
- **Owner:** backend-engineer
- **Size:** M
- **Depends on:** F1a-T06, F1a-T20
- **Files:** create `packs/demo-trades/scenarios/electrical.json`, `packs/demo-trades/scenarios/brazing.json`, `packs/demo-trades/scenarios/brakes.json`, `server/packs.js`, `tests/pack.test.js`; modify `server/index.js`
- **Interfaces (ADR 0006 + Amendment 1, ADR 0001; review B4, B5, B6):**
  - Scenario files: today's `fixtures/scenarios/*.json` **copied byte-identical** into the pack. The originals stay until F1a-T07b deletes them, so no existing test changes in this ticket (thread 0004 split).
  - Produces (`server/packs.js`):
    - `loadPacks(dir = <ROOT>/packs, db = getDb()) → Map<string, Pack>`: for each `<dir>/<id>/pack.json`: `validatePack`; load every `fixture` and run `validateScenario` on it; then `db.putPack({id, version, json: canonicalJson({pack, scenarios: {<fixture>: <content>}}), provenance})`. Canonical JSON = keys sorted recursively, no whitespace. `'conflict'` → refuse the pack. Any failure → skip the pack with `console.warn('[packs] <dir name> skipped: <reason>')`. For each scenario of a loaded pack: `db.putCard({id: \`fx_${pack.id}_${pack.version}_${scenario.id}\`, subject_id: pack.id, subject_version: pack.version, card, prompt_version: null, model: null, source: 'fixture', …})`.
    - `getPack(id) → Pack | null` (own-key safe); `listSubjects() → [{id, title}]`; `listScenarios(packId) → [{id, label}] | null`; `getScenarioEntry(packId, scenarioId) → {id, label, brief, hazardHints, criticalHints?, twists?, card, cardId} | null` (own-key safe). `Pack = pack.json` fields with each scenario's `card` loaded.
  - Changes (`server/index.js`): before `listen`, `initDb()` then `loadPacks()`. If `initDb` throws, print its message to stderr and `process.exit(1)`; never listen. An invalid pack only warns.
- **Acceptance:** FR-019 (scenarios half), FR-020 (loader, refusal), FR-013 (startup order), FR-015 (fixture ids, NULL stamps). Every existing test passes unchanged; golden replay empty.
- **Tests that prove it:** `tests/pack.test.js`: "loadPacks twice writes one subject_pack row and three card rows fx_demo-trades_1_<id> with NULL stamps", "scenario files are byte-identical to the pre-T07a fixtures (sha256 frozen)", "pack entries render byte-identical scenario prompts to T02's snapshot", "an invalid pack in a temp dir is skipped and logged; the valid one still loads", "a changed pack.json without a version bump is refused" (B9), "a changed scenario file without a version bump is refused" (R3), "getScenarioEntry rejects __proto__, constructor, toString, hasOwnProperty", "server exits non-zero with [db] migration 001 failed and never listens" (spawn with `DB_PATH` pointing at a file that has `user_version 0` and a conflicting `event` table), "server with an invalid pack in PACKS still starts".
- **Notes:** `loadPacks`'s `dir` is overridable only through its parameter; tests call it directly (no env hook in product code).

### F1a-T07b Legacy routes read the pack; `toPublicCard`; old fixtures removed
- **Owner:** backend-engineer
- **Size:** M
- **Depends on:** F1a-T07a, F1a-T05
- **Files:** modify `server/services/content.js`, `server/routes/scenarios.js`, `shared/contract.js`, `scripts/simulate.js`, `tests/contract.test.js`, `tests/validator.test.js`, `tests/scoring.test.js`, `tests/mock-grader.test.js`, `tests/game-balance.test.js`, `tests/helpers/http.mjs`, `tests/helpers/fake-claude.mjs`, `tests/prompt-version.test.js`, `tests/pack-format.test.js`; delete `server/prompts/trades.js`, `fixtures/scenarios/electrical.json`, `fixtures/scenarios/brazing.json`, `fixtures/scenarios/brakes.json`
- **Interfaces (ADR 0006 + Amendment 1, ADR 0003; review B4, B6):**
  - Consumes: `getPack`, `listScenarios`, `getScenarioEntry` (T07a).
  - Changes (`shared/contract.js`): adds `toPublicCard(card, {id, subject}) → {id, subject, title, setting, apprentice, steps: [{id, line}]}` (allow-list copy; never spreads or deletes). `validateScenario` no longer reads or checks `trade` (`opts.trade` removed). The header comment drops "journeyman" and the `trade` field. `SCENARIO_SCHEMA` and `GRADE_SCHEMA` unchanged.
  - Changes (`server/services/content.js`, `server/routes/scenarios.js`): legacy routes read the pack via `LEGACY_SUBJECT = 'demo-trades'` (removed by T18). `GET /api/trades` → `listScenarios(LEGACY_SUBJECT)`; `GET /api/scenario?trade=` → `getScenarioEntry`; live generation passes the flat entry as `trade`; the fixture path returns a deep copy of `entry.card`. Legacy JSON responses are unchanged for all three ids.
  - `scripts/simulate.js`: reads every `packs/*/pack.json` and plays each scenario's fixture (no pack id hard-coded); output table unchanged for demo-trades.
- **Acceptance:** FR-019 (the pack is the only copy of the scenarios), FR-001 (`toPublicCard`), FR-023 (legacy responses and `npm run simulate` output unchanged). Golden replay empty (the harness reads no product file, T03a).
- **Changed tests:**
  - `tests/contract.test.js`: fixture dir → `packs/demo-trades/scenarios/`; "every trade points at an existing fixture" → "every pack scenario points at an existing fixture" (same assertion over `pack.scenarios`); `TRADES` import removed.
  - `tests/validator.test.js`: fixture dir and the `TRADES` loops read `pack.scenarios` (same assertions); "fixture passes the strict rules for its own trade" → "pack fixture passes the strict rules" (`validateScenario(s)` with no opts); **"J: trade mismatch is rejected…" deleted** (the check no longer exists; the server sets the subject).
  - `tests/scoring.test.js`, `tests/mock-grader.test.js`, `tests/game-balance.test.js`, `tests/helpers/http.mjs` (`loadFixture`), `tests/helpers/fake-claude.mjs` (`FIXTURE` constant): path only.
  - `tests/prompt-version.test.js`: the `trades.js` exclusion removed (setup only).
  - `tests/pack-format.test.js`: literals previously compared with `trades.js` / `mock-grader.js` imports are frozen inline (setup only, same values).
- **Tests that prove it:** `tests/contract.test.js`: "toPublicCard returns exactly the public keys (deep key allow-list)"; the changed tests above pass with their stated edits only; full `npm test` green (`# tests` ≥ 97 after deleting "J: trade mismatch…", because `toPublicCard` adds one); `npm run simulate` output for demo-trades byte-identical to before (diff quoted in the PR).
- **Notes:** split from the old T07 (thread 0004). No file under `fixtures/scenarios/` may have an importer left (grep in the PR).

### F1a-T08a [P] AI gateway module and `llm_call` logging (new files only)
- **Owner:** backend-engineer
- **Size:** M
- **Depends on:** F1a-T05, F1a-T06
- **Files:** create `server/ai/gateway.js`, `server/ai/models.js`, `tests/gateway.test.js`
- **Scope of the split (thread 0004):** T08a builds and unit-tests the gateway; nothing imports it yet, so it runs in parallel with T07a, T07b, T11 and T20. T08b wires the services to it and deletes `server/llm.js`. Until T08b, `server/ai/models.js` duplicates `llm.js`'s constants; that is intended.
- **Interfaces (ADR 0005 + Amendments 1 and 2; review B1):**
  - Produces (`server/ai/models.js`): `MODEL`, `SCENARIO_EFFORT`, `GRADE_EFFORT` (same env defaults as `llm.js:9-12`), `SCENARIO_DEADLINE_MS` (env, default 40000), `GRADE_DEADLINE_MS` (env, default 8000).
  - Produces (`server/ai/gateway.js`):
    - `createGateway({client, logCall}) → {run}`.
    - `run({prompt, input, live, effort, deadlineMs, normalize = (d) => d, accept = () => [], fallback}) → Promise<{data, source: 'live'|'mock'|'fallback', meta: {promptVersion: string, model: string, ms: number, outcome, error: string | null}}>`. `prompt` is the prompt module namespace (`import * as gradePrompt from '../prompts/grade.js'`) or any plain `{PROMPT, VERSION}` object, so `run` reads `prompt.PROMPT` and `prompt.VERSION`; `promptVersion = \`${PROMPT.id}@${VERSION}\``. Argument guards (review S12), checked before anything else, each rejecting with `TypeError` and writing no `llm_call` row: `fallback` isn't a function; `prompt.PROMPT?.id` isn't a non-empty string; `prompt.VERSION` isn't an integer ≥ 1.
      - `live: false` → `data = await fallback()`, no request, outcome `mock`.
      - `live: true` → `client.beta.messages.create({model: MODEL, system, messages: [{role:'user', content: PROMPT.render(input)}], output_config: {format: {type:'json_schema', schema: PROMPT.schema}}, …today's body from llm.js:35-49, verbatim, incl. its `betas` entry for the server-side-fallback-2026-07-01 beta and fallbacks:'default'}, {signal: AbortSignal.timeout(deadlineMs), maxRetries: 1, headers: {'x-prompt-id': promptVersion}})`. Injected test clients have the shape `{beta: {messages: {create}}}`. Live path order: `responseText` → `JSON.parse` → `normalize` → `accept(normalized)`; problems, a throw (including in `normalize`), a refusal, `max_tokens` or an abort → `data = await fallback()`. `normalize` never runs on fallback data.
      - Outcome, by what ended the call (ADR 0005 Amendment 2 table; typed SDK classes, never message text): valid data, including text after a fallback block → `ok`; `Anthropic.APIUserAbortError` (a hang, or a `retry-after` past the deadline) → `timeout`; `stop_reason === 'refusal'` → `refusal`; any other SDK error after the one retry, `stop_reason === 'max_tokens'` (even if the text parses), empty text, non-JSON, a throw in `normalize`, `accept` problems → `fallback`; `live: false` → `mock`.
      - `meta.error`: `null` for `ok` and `mock`; exactly `` `Claude ${PROMPT.id} timed out after ${deadlineMs} ms` `` for `timeout`; `err.message` unchanged for an SDK error; otherwise a short reason (`Claude declined: <category>`, `Claude response was cut off (max_tokens)`, `Claude returned no text`, the JSON parse message, or the `accept` problems joined with `"; "`). Never put in an HTTP body, an event or `llm_call`.
      - Exactly one `logCall(row)` per `run()`: `{id: newId('llm'), at, pipeline: PROMPT.id, prompt_version: promptVersion, model: response.model ?? MODEL, ms, input_tokens, output_tokens, cache_read: usage.cache_read_input_tokens ?? 0, cost_usd: null, outcome}` (tokens 0 when there was no response). A throwing `logCall` is caught and `console.warn`ed and never changes the result.
      - Console lines unchanged (BRAIN-08): `[claude] <promptId> <ms> ms <model> <stop_reason> <in>/<out> tokens <id>` and `[claude] <promptId> failed after <ms> ms status=… request=…: …`.
    - `promptFingerprint(promptModule.PROMPT) → string` (T05's algorithm); `responseText(content) → string` (copied verbatim from `llm.js`; T08b deletes the original).
- **Acceptance:** FR-024 (including the S12 argument guards, `normalize`, `meta.error`, `client.beta.messages.create`), FR-025, FR-026 (every row of ADR 0005 Amendment 2's outcome table), FR-027 (fingerprint); SC-007 (gateway half). Route-independent: no test in this ticket starts the app server or uses a legacy route (thread 0004).
- **Tests that prove it:** `tests/gateway.test.js`:
  - Unit, injected fake client `{beta: {messages: {create}}}` and fake `logCall`: "run without fallback rejects with TypeError", "run with a prompt lacking VERSION rejects with TypeError" (also `VERSION: 0`, `VERSION: '1'`, and `PROMPT.id` missing or `''`; S12), "run accepts a plain {PROMPT, VERSION} object", "live:false calls fallback, sends nothing and logs outcome mock", "accept problems (empty feedback, wrong-schema {}) give outcome fallback and the fallback data" (B9), "max_tokens gives outcome fallback even when the text parses", "non-JSON text gives outcome fallback", "a throw in normalize gives outcome fallback", "normalize runs before accept and never on fallback data", "{verdict:'bogus', feedback:'x'} is normalized to wrong and is ok", "refusal gives outcome refusal", "timeout meta.error is 'Claude grade timed out after 1500 ms'", "an SDK error's meta.error is err.message unchanged", "a throwing logCall does not change the result", "exactly one logCall on every exit path (one per outcome-table row)", "promptFingerprint equals T05's frozen values".
  - In-process with a real SDK client (`new Anthropic({apiKey: 'sk-fake', baseURL: stub.url})`) pointed at fake Claude, `logCall` into `openDb(':memory:')`: "happy LIVE grade writes one llm_call row ok with tokens 1234/321 and source live", "hang gives outcome timeout within deadline + 1 s at 1500 ms", "429 with retry-after 60 gives outcome timeout within deadline + 1 s", "500 and 529 give outcome fallback", "the [claude] console line format is unchanged" (captured from `console`), "every request carries x-prompt-id grade@1 or scenario@1" (a minimal header-capture server inside the test, since fake Claude routes on headers only after T09).
- **Notes:** `server/ai/*` must contain no deny-listed word (drop the "trade hazard" example from the `llm.js:42` comment when copying).

### F1a-T08b Wire services to the gateway; delete `server/llm.js`
- **Owner:** backend-engineer
- **Size:** M
- **Depends on:** F1a-T07b, F1a-T08a
- **Files:** modify `server/services/ai-client.js`, `server/services/content.js`, `server/services/assessment.js`, `tests/llm-deadline.test.js`; create `tests/gateway-wiring.test.js`; delete `server/llm.js`
- **Interfaces (ADR 0005 + Amendments 1 and 2):**
  - Consumes: `createGateway`, `responseText` (T08a); `MODEL`, deadline and effort constants (T08a); `noteLive(what, err?)` (T04); `getDb()` (T06).
  - Changes (`server/services/ai-client.js`): exports `MOCK`, and `gateway = createGateway({client, logCall: (row) => getDb().logLlmCall(row)})`, where `client` is built exactly as `llm.js` builds it today (`null` in MOCK). No other module constructs a client.
  - Changes (`server/services/content.js`, `server/services/assessment.js`): the legacy scenario and grade paths call `gateway.run` with `live: !MOCK`, the deadline constants, and: grade `normalize: clampGrade`, `accept: g => g.feedback.trim() ? [] : ['Claude returned empty feedback']`, `fallback` = today's `mockGrade` call; scenario `normalize` = today's id stamping, `accept: validateScenario`, `fallback` = today's fixture card. The server-decides-false-alarm rule (FR-006) stays in the caller. Route `source` mapping (FR-029): grade `live → "live"`, `mock → "mock"`, `fallback → "mock-fallback"`; scenario `live → "live"`, `mock → "fixture"`, `fallback → "fixture-fallback"`. **Side effects kept (ADR 0005 Amendment 2):** on `ok` call `noteLive(what)`; on `timeout`, `refusal` or `fallback` call `noteLive(what, {message: meta.error})` and keep `[grade] live grading failed, using keyword grader: <meta.error>` and `[scenario] live generation failed, using fixture: <meta.error>`; MOCK calls neither. Legacy responses are unchanged.
- **Acceptance:** FR-024 (single call site), FR-029 (legacy paths), FR-048 (`messages.create` guardrail); SC-007, SC-008 (existing deadline tests keep their thresholds). `tests/server.test.js` BRAIN-08 (`/401/` in `/api/health.lastLiveError`) and `tests/llm-deadline.test.js` (`/timed out after 1500 ms/`) pass with **no assertion change**.
- **Changed tests:** `tests/llm-deadline.test.js`: import of `responseText` from `../server/llm.js` → `../server/ai/gateway.js` (import only; no assertion changes).
- **Tests that prove it:** `tests/gateway-wiring.test.js`: static "messages.create appears only in server/ai/gateway.js, which contains maxRetries: 1 and AbortSignal.timeout" (B9), "no file imports server/llm.js"; the full existing suite green with no assertion change. (The old "MOCK grade on the legacy route writes one llm_call row" moved to T13b as "MOCK STOP writes one llm_call row grade@1 outcome mock"; thread 0004.)
- **Notes:** `server/llm.js` must have no importer left (grep in the PR).

### F1a-T09 [P] fake Claude routes on `x-prompt-id`
- **Owner:** qa-engineer
- **Size:** S
- **Depends on:** F1a-T08b
- **Files:** modify `tests/helpers/fake-claude.mjs`, `tests/gateway.test.js` (an `after` hook only); create `tests/fake-claude-routing.test.js`
- **Interfaces:**
  - Consumes: header `x-prompt-id: <promptId>@<VERSION>` (T08a).
  - Produces: `kind` = the header's part before `@` (`"grade"` | `"scenario"`); `/__log` entries gain `promptId` (the full header value) and keep T03a's `system` and `schemaSha256`. A request without the header gets HTTP 500 `{type:'error', error:{type:'api_error', message:'stub: missing x-prompt-id'}}` and a log entry with `kind: null`. Schema sniffing (`fake-claude.mjs:72`) is removed; header comment updated.
  - Produces (`tests/helpers/fake-claude.mjs`): `assertNoUnroutedCalls(stub) → Promise<void>`: reads `/__log` and fails the test with the offending entries if any has `kind: null` (SC-007). Every test file that starts fake Claude calls it in `after`: this ticket adds it to `tests/gateway.test.js`; T12, T13b and T01a's files use it from the start; T16 adds it to `tests/server.test.js` and `tests/llm-deadline.test.js`.
- **Acceptance:** FR-040; spec US5 scenario 5; SC-007 (unrouted half).
- **Tests that prove it:** `tests/fake-claude-routing.test.js`: "grade call is logged with kind grade and promptId grade@1", "scenario call is logged with kind scenario", "request without x-prompt-id gets 500 and is logged", "log entries carry system and schemaSha256", "assertNoUnroutedCalls fails on a kind:null entry and passes on a clean log"; `tests/server.test.js` kind assertions still hold (full suite).
- **Notes:** closes QA's 0003 RISK on silent misrouting. The PR acknowledges the two backend helper edits (T06, T07b) as recorded exceptions (review S10).

### F1a-T10 [P] Deny-list ratchet
- **Owner:** qa-engineer
- **Size:** S
- **Depends on:** F1a-T08b
- **Files:** create `tests/fixtures/deny-list.json`, `tests/fixtures/deny-list-allow.json`, `tests/deny-list.test.js`
- **Interfaces:**
  - Produces: `deny-list.json` = `{words: string[]}` with at least the FR-038 seed; `deny-list-allow.json` = `[{file, word, count}]` generated from the tree after T07b and T08b.
- **Acceptance:** FR-037, FR-038. Scans `server/`, `shared/`, `web/`, `scripts/` (all file types), excluding `packs/`, `fixtures/`, `tests/`, `node_modules/`; case-insensitive; word boundaries (a multi-word entry matches with any whitespace between words). Fails on an unlisted hit, and on a listed count above the actual count, with a message naming file, word and both counts.
- **Tests that prove it:** `tests/deny-list.test.js`: "no unlisted subject words in engine code", "allow-list counts match exactly (shrink the list when you remove a word)", "matcher: word boundaries (fetchTrades is not a hit, trade-select is)", "matcher: case-insensitive, multi-word phrases".
- **Notes:** lands after T07b/T08b so the first allow-list reflects the post-Wave-1 tree. From here on, see the ratchet rule at the top.

### F1a-T11 [P] File-ownership test and `check:ticket`
- **Owner:** qa-engineer
- **Size:** S
- **Depends on:** F1a-T06
- **Files:** create `tests/ownership.test.js`, `tests/tools/check-ticket.mjs`
- **Interfaces (review OI-7; founder DECISION on OI-8 in thread 0003, rows now in `CLAUDE.md`):**
  - `tests/ownership.test.js` parses the "File ownership" table in `CLAUDE.md` into `[{glob, owner, except: string[]}]`. Parse rules: each backticked token in the Path cell is a glob; `<id>` means one path segment; a token without `/` is relative to the directory of the previous token in the same cell (`docs/specs/<id>/spec.md`, `tasks.md`); tokens inside "(except …)" are exclusions of the preceding glob; `dir/` and `dir/**` mean everything below `dir`. Owner = the first backticked role in the Owner cell, else its first word lowercased (`everyone`, `founder`).
  - Paths: `git ls-files -co --exclude-standard`. If `git` is missing or exits non-zero: walk the filesystem excluding `.git/`, `node_modules/` and the plain line patterns in `.gitignore`, call `t.diagnostic('ownership: git unavailable, used filesystem walk')`, and still assert. Never `skip`.
  - `node tests/tools/check-ticket.mjs <ticketId> [--base <ref>]` (default base `main`): `<ticketId>` matches `^F1a-T\d\d[a-d]?$` (split tickets such as `F1a-T07a` are distinct tickets; `F1a-T07` matches no heading and exits 1 with "unknown ticket"); reads the ticket's `Files:` line from `docs/specs/*/tasks.md`; changed files = `git diff --name-only <base>` plus `git ls-files -o --exclude-standard`; exit 0 when all are listed (the `deny-list-allow.json` ratchet edit and QA's `todo` removals in `tests/acceptance/F1a.test.js` and `tests/e2e/F1a.e2e.mjs` always allowed), exit 1 listing each extra file, exit 2 with `git unavailable: list changed files by hand in the QA report` when git is missing or fails. Not part of `npm test`.
- **Acceptance:** FR-039. The test fails if the table can't be parsed or any path has zero or more than one owner.
- **Tests that prove it:** `tests/ownership.test.js`: "CLAUDE.md ownership table parses", "every listed path has exactly one owner", "unowned path is reported" (synthetic list), "path matching two rows is reported" (synthetic), "without git: filesystem walk with a diagnostic, never skipped" (runs the lister with `PATH` emptied), "check-ticket exits 2 without git", "check-ticket finds the Files line of a suffixed ticket (F1a-T07a) and rejects the bare F1a-T07".
- **Notes:** unblocked by the founder's OI-8 DECISION. If a real tracked path is still unowned, file it as a bug against this spec (PM), don't edit `CLAUDE.md`. T19b depends on this ticket so it can't slip out of F1a.

## Group 2 (Wave 2): server-owned cards and web switch-over

### F1a-T12 Subjects, scenario list, attempt start and card persistence
- **Owner:** backend-engineer
- **Size:** M
- **Depends on:** F1a-T09, F1a-T10
- **Files:** create `server/routes/attempts.js`, `server/routes/subjects.js`, `server/services/session.js`, `tests/attempts.test.js`; modify `server/index.js`, `server/routes/scenarios.js`, `server/services/content.js`
- **Interfaces (ADR 0003 + Amendment 1; review OI-6, S4):**
  - Consumes: `getPack`, `listSubjects`, `listScenarios`, `getScenarioEntry` (T07a); `toPublicCard` (T07b); `gateway`, `MOCK` (T08b); `getDb()`, `newId`, `makeEvent` (T06); `scenario` prompt module (T05); `assertNoUnroutedCalls` (T09).
  - Produces:
    - `GET /api/subjects` → 200 `[{id, title}]` (`listSubjects()`).
    - `GET /api/scenarios?subject=<packId>` → 200 `[{id, label}]`; unknown, missing or non-own-key subject → 400 `{error}`.
    - `POST /api/attempts` body `{subject, scenario, source?: "fixture"}` → 200 `{attemptId, card: PublicCard, source}`; 400 for unknown or non-own-key `subject`/`scenario`, a non-object body or a `source` other than `"fixture"`; 413 over 1 MB.
    - `content.cardForAttempt({db, packs, gateway, mock}, subjectId, scenarioId, source) → Promise<{card, cardId, source: 'live'|'fixture'|'fixture-fallback', promptVersions}>` (review round 2, change 4). It uses **only** the passed dependencies: `packs.getScenarioEntry(subjectId, scenarioId)` for the entry and fixture card, `gateway.run` for generation, `db.putCard` for the live card, `live: !mock`. `source === 'fixture'` → the fixture card, no `run()`, `promptVersions: {}`. Otherwise `gateway.run({prompt: scenarioPrompt, input: {key, entry, recentSummaries: []}, live: !mock, effort: SCENARIO_EFFORT, deadlineMs: SCENARIO_DEADLINE_MS, normalize: <today's id stamping, as in T08b>, accept: validateScenario, fallback: () => fixture card})` (`recentSummaries` is always `[]`: today's call passes none; thread 0004); on `timeout`, `refusal` or `fallback` it calls `noteLive` and keeps the `[scenario] …` warn line, as T08b; on gateway `live`, `db.putCard({id: newId('card'), …, prompt_version: meta.promptVersion, model: meta.model, source: 'live'})` **before** returning; source mapping per FR-029. `promptVersions = {scenario: meta.promptVersion}` when `meta.outcome !== 'mock'`, else `{}`. The legacy `getScenario` path keeps the `ai-client.js` defaults (`gateway`, `MOCK`) and doesn't call `cardForAttempt` with anything else.
    - `server/services/session.js`: `createSession({db, packs, gateway, mock}) → Session`, where `db: Db` (T06), `packs: {getPack, getScenarioEntry}` (the `server/packs.js` namespace satisfies it), `gateway: {run}` (T08a), `mock: boolean`. Each `Session` passes these down to every service it calls; tests pass a fake `db`, `packs` or `gateway`. `getSession() → Session` is the memoised default `createSession({db: getDb(), packs: <server/packs.js namespace>, gateway, mock: MOCK})` (`gateway`, `MOCK` from `ai-client.js`), used only by `server/routes/attempts.js`. **Rule:** no function that `Session` calls (directly or through `content`/`assessment`) may import `gateway` or call `getDb()` itself; only `getSession()` and the legacy routes read the module defaults. `Session.startAttempt({subjectId, scenarioId, source}) → Promise<{attemptId, card: PublicCard, source}>`: `attemptId = newId('att')`; appends one `started` with `db.appendEvents([…])`: `object {type:'card', id: cardId}`, `result {source}`, `context {subject: \`${pack.id}@${pack.version}\`, attemptId, promptVersions}`. No version string is hard-coded in `server/`.
  - `card.subject` is the pack id (`"demo-trades"`); `card.id` is `fx_demo-trades_1_<scenarioId>` or `card_<ULID>`.
- **Acceptance:** FR-001, FR-002, FR-003, FR-010 (start route), FR-011 (start route), FR-016 (`started`), FR-017, FR-029 (start), FR-035. `/api/health` unchanged. Legacy routes untouched. Golden replay empty.
- **Tests that prove it:** `tests/attempts.test.js` (calls `assertNoUnroutedCalls` in `after`; every happy-path LIVE test asserts `source: 'live'`): "GET /api/subjects returns [{id:'demo-trades', title}]", "scenarios list equals the frozen list" (the three `{id, label}` pairs inline, in today's order: electrical, hvac, automotive; never compared with `/api/trades`, which T18 deletes), "unknown and prototype-key subjects/scenarios get 400", "start returns exactly the public card keys (deep key allow-list) and passes leakScan", "MOCK start: card.id fx_demo-trades_1_electrical, card.subject demo-trades", "two starts on the same card get different attemptIds", "MOCK start writes one started event with subject demo-trades@1 and promptVersions {} and one llm_call row scenario@1 outcome mock", "LIVE start with source fixture writes no llm_call row and promptVersions {}" (B9), "LIVE start writes the card row (source live, scenario@1, non-empty model) before responding and started.promptVersions {scenario:'scenario@1'}", "LIVE hang falls back to fixture-fallback within 3 s at SCENARIO_DEADLINE_MS=2000, llm_call outcome timeout, started.promptVersions {scenario:'scenario@1'}", "invalid live scenario falls back, llm_call outcome fallback, no card_ row", "/api/health body has no new keys"; unit (no server): "startAttempt with an injected stub gateway, fake db and fake packs calls only the injected run, putCard and getScenarioEntry" (LIVE-style `mock: false`; the stub `run` returns `source: 'live'` and records its calls; assert exactly 1 recorded `run` call, 1 `putCard` and the `started` event on the fake db's `appendEvents`; change 4).
- **Notes:** lower `deny-list-allow.json` counts only if this ticket removes a hit. T01a's "edge: fake-Claude failure matrix (start)" is `todo: 'F1a-T12'`; QA removes the `todo` when verifying this ticket.

### F1a-T13a [P] `projectAttempt`, STOP planning and the frozen MOCK verdict table (pure)
- **Owner:** backend-engineer
- **Size:** M
- **Depends on:** F1a-T06, F1a-T07b
- **Files:** modify `shared/events.js`, `tests/events.test.js`; create `server/services/stop-plan.js`, `tests/stop-plan.test.js`, `tests/fixtures/f1a-mock-verdicts.json`, `tests/mock-verdicts.test.js`
- **Scope of the split (thread 0004):** the pure half of the old T13, with no route, no DB write and no service change, so it runs in parallel with T08b–T12 and T21 (no shared files). T13b builds the route on it. `projectAttempt` moved here from T06 (its first consumer; its home stays `shared/events.js`, ADR 0002 unaffected).
- **Interfaces (ADR 0002 + Amendments 1–2, ADR 0003 + Amendments 1–3; review B12):**
  - Consumes: `resolveStop`, `RULES` (`shared/scoring.js`, unchanged); `validateEvent`, `makeEvent` (T06); `packs/demo-trades/pack.json` and its scenario files (T07a, T20); today's 3-argument `mockGrade` (unchanged in this ticket).
  - Produces (`shared/events.js`, pure, browser-safe): `projectAttempt(events: Event[]) → {cardId: string|null, caughtStepIds: number[], lastStopStepId: number|null, stopsByStepId: {[stepId]: {stopped, explained, graded}}, completed: Event|null}`. `caughtStepIds` = every non-null `stopped.result.targetStepId` in `seq` order (today's browser rule, `web/app.js:160-169`); `lastStopStepId` = `object.step` of the last `stopped`.
  - Produces (`server/services/stop-plan.js`, pure; no import of `gateway`, `ai-client` or `db`):
    - `planStop(card, projection, stepId) → {kind: 'replay'} | {kind: 'reject', status: 400 | 409, error: string} | {kind: 'grade', idx: number, target: {errorStepId, stepsLate} | null}`. Runs FR-007 checks 1–4 in order using `idx = card.steps.findIndex(s => s.id === stepId)` and the last graded STOP's position; for `grade`, `target = resolveStop(card, idx, new Set(projection.caughtStepIds))`. Check 5 (in flight) is not here; it is in T13b's `submitStop`.
    - `stopReplayBody(card, projection, stepId) → StopResponse`: the body rebuilt from the stored `stopped` and `graded` events plus the card (`caught` from `stopped.result.targetStepId` and the card's step; `total` = sum of `graded.result.points` up to and including that STOP in `seq` order).
  - Produces `tests/fixtures/f1a-mock-verdicts.json`: `[{cardId, stepId, explanation, verdict, reasoningScore, feedback}]` for 3 cards × every step × 4 explanations (on-time correct, synonym-only, wrong, empty), generated once from the pre-change 3-argument `mockGrade` **before** T13b edits it, by a one-off script whose output is committed (the script is not kept).
- **Acceptance:** FR-018 (`projectAttempt`), FR-007 checks 1–4 (pure), FR-022 (the frozen expectation that T13b must keep). Nothing calls these yet; golden replay empty.
- **Tests that prove it:** `tests/events.test.js`: "projectAttempt returns cardId, caughtStepIds, lastStopStepId, stopsByStepId, completed", "projectAttempt on [] returns nulls and empty sets". `tests/stop-plan.test.js`: "planStop: completed attempt → reject 409", "stepId 0, 99, '3', null → reject 400", "graded stepId → replay", "position before the last graded STOP → reject 400", "planStop with non-ascending ids [1,2,3,5,4,6,7,8,9]: stepId 5 then 4 is accepted and resolveStop gets the position" (B12), "stopReplayBody equals the first body for an on-time catch, a late catch and a false alarm". `tests/mock-verdicts.test.js`: "mockGrade(card, id, text, DEMO_LEXICON) equals the frozen table for every row" (`DEMO_LEXICON` read from `pack.json`; the 4th argument is ignored by today's function and used after T13b, so this test passes before and after).

### F1a-T13b STOP route: server-side resolution, grading and scoring
- **Owner:** backend-engineer
- **Size:** M
- **Depends on:** F1a-T12, F1a-T13a
- **Files:** modify `server/routes/attempts.js`, `server/services/session.js`, `server/services/assessment.js`, `shared/mock-grader.js`, `shared/contract.js`, `tests/mock-grader.test.js`; create `tests/stops.test.js`
- **Interfaces (ADR 0002 + 0003, both with Amendments 1–2, ADR 0003 Amendment 3, ADR 0005 Amendment 2; review B2, B8, B12, S9; round 2 changes 3–4, S13):**
  - Consumes: `resolveStop`, `scoreStop`, `RULES` (`shared/scoring.js`, unchanged); `projectAttempt` (T13a); `planStop`, `stopReplayBody` (T13a); the `grade` prompt module (T05); the Session's injected `db`, `packs` (`getPack(id).grading`, `.copy`) and `gateway` (T12's `createSession`); `assertNoUnroutedCalls` (T09).
  - Produces:
    - `POST /api/attempts/:attemptId/stops` body `{stepId: integer, explanation: string}` → 200 `{verdict, reasoningScore, feedback, source, points, total, caught: null | {errorStepId, stepsLate, severity, correctAction}}`; 400 bad body, `stepId` not in the card, or position before the last graded STOP's position; 404 unknown or malformed attempt; 409 after complete, or while a STOP for a **different** `stepId` is in flight (a same-`stepId` STOP in flight joins it); 413 over 1 MB; 500 `{error:"server error"}` on a storage failure (`appendEvents` throws) or an unexpected internal error (for example `gateway.run` rejects), with no events written and the process still serving (FR-010; review S13).
    - `Session.submitStop(attemptId, {stepId, explanation}) → Promise<StopResponse>`: `projectAttempt(db.eventsForAttempt(attemptId))`; `planStop` (T13a); `replay` → `stopReplayBody` (T13a); **check 5 (ADR 0003 Amendment 3):** if `inFlight.get(attemptId)` exists, then same `stepId` → return its `promise` (the joiner writes no events, makes no grade call, and its `explanation` is ignored; if the promise rejects, the joiner gets the same 500); different `stepId` → 409 `{error}`. Otherwise set `inFlight.set(attemptId, {stepId, promise})`, where `promise` grades via `assessment.gradeStop`, scores with `scoreStop`, then makes **one** `db.appendEvents([stopped, explained, graded])`; the request that set the entry deletes it in `finally` with `inFlight.delete(attemptId)`. Nothing is written before the grade is known.
    - **In-flight mark (round 2, change 3; ADR 0003 Amendment 3):** `inFlight = new Map<attemptId, {stepId: number, promise: Promise<StopResponse>}>()` is created inside `createSession`, one per `Session` instance, never at module level. `submitStop` and T14's `completeAttempt` both read it, so two test sessions never share marks. `submitStop` MUST NOT `await` anything between `db.eventsForAttempt(attemptId)` and either `inFlight.set(…)` or returning the joined promise (the `Db` methods are synchronous); the first `await` is the grade call. Correct for **one server process per DB file** only (ADR 0003 Amendment 3).
    - Event results: `stopped.result {targetStepId: errorStepId | null, stepsLate: 0 | 1 | null}`; `explained.result {text, chars}` (≤ 2000); `graded.result {verdict, reasoningScore, graderSource, outcome, points, latencyMs, feedback}` with `outcome` per the spec's precedence; `graded.context.promptVersions = {grade: meta.promptVersion}` when `meta.outcome !== 'mock'`, else `{}`; `{}` on `stopped` and `explained`. `object = {type:'card', id: cardId, step: stepId}`.
    - `assessment.gradeStop({gateway, mock}, {card, stepId, errorStepId, explanation, pack}) → Promise<{verdict, reasoningScore, feedback, source, outcome, promptVersion, latencyMs}>` (round 2, change 4): today's `grade()` logic (`index.js:87-108`) through the **passed** `gateway.run` with `live: !mock`, `normalize: clampGrade`, `accept: g => g.feedback.trim() ? [] : ['Claude returned empty feedback']` and `fallback = () => mockGrade(card, errorStepId, explanation, {synonyms: pack.grading?.synonyms ?? {}, falseAlarmFeedback: pack.copy.falseAlarmFeedback})`; `noteLive` and the `[grade] …` warn line as in T08b; the server-decides-false-alarm rule (FR-006) in the caller. `gradeStop` doesn't import `gateway` or `MOCK` and doesn't call `getDb()`. The legacy `grade(body)` passes the `ai-client.js` defaults (`{gateway, mock: MOCK}`) and the demo-trades lexicon so the legacy route keeps today's verdicts.
    - `mockGrade(scenario, errorStepId, explanation, lexicon = {synonyms: {}, falseAlarmFeedback: 'That step was fine.'}) → {verdict, reasoningScore, feedback}`: the `SYNONYMS` constant and its subject comments removed.
    - `shared/contract.js`: header comment documents PublicCard, StopRequest, StopResponse, CompleteRequest, CompleteResponse (spec FR-001, FR-004, FR-005, FR-008); no code change.
- **Acceptance:** FR-004, FR-005, FR-006, FR-007 (including check 5's join), FR-010, FR-011 (STOP), FR-016 (STOP triplet), FR-018 (state from `projectAttempt` only), FR-022, FR-026 (stops route), FR-029 (grade); SC-007 (stops route). T01a's "edge: fake-Claude failure matrix (stops)" is `todo: 'F1a-T13b'`; QA removes it when verifying this ticket.
- **Changed tests:** `tests/mock-grader.test.js`: every `mockGrade(x, id, t)` → `mockGrade(x, id, t, DEMO_LEXICON)` where `DEMO_LEXICON` is read from `packs/demo-trades/pack.json` (setup only; every assertion unchanged).
- **Tests that prove it:** `tests/stops.test.js` (calls `assertNoUnroutedCalls` in `after`; every happy-path LIVE test asserts `source: 'live'`): "on-time catch: caught has exactly errorStepId, stepsLate, severity, correctAction", "one-late STOP credits the earlier mistake with stepsLate 1 and marks it by errorStepId", "false alarm: caught null, verdict false_alarm, -75, passes leakScan", "already-caught mistake is not credited twice (double-stop)", "points equal scoreStop and total is cumulative", "same stepId returns the identical body and writes no events", "same STOP twice in flight: both 200, identical body, one triplet, one grade call" and "different stepId while one is in flight: 409, no events" (gateway stub that resolves after 100 ms; B8, ADR 0003 Amendment 3; these replace "one 200, one 409"), "a joined request whose leader's grade rejects gets 500 and the next STOP is graded once", "in-flight mark is released after a failed grade (next STOP is accepted)" (S9), "position before the last STOP gets 400 and no events", "stepId 0, 99, '3', null get 400", "unknown attempt 404", "STOP after complete 409", "explanation over 2000 chars is truncated before grading and in explained.result.text", "an aborted grade answers 500 {error:'server error'}, writes no STOP events, and the same STOP is then graded once" (`createSession` with a gateway stub whose `run` rejects once; B2, B9, S13), "two Sessions from createSession don't share in-flight marks" (change 3), "appendEvents throwing answers 500, writes nothing and the next request still works" (fake `db`), "server killed mid-grade: after restart on the same DB there is no stopped/explained/graded for that STOP" (US4.5), "a STOP writes exactly stopped, explained, graded in one seq run with the ADR result shapes", "MOCK graded.context.promptVersions is {} and LIVE is {grade:'grade@1'}", "live: model false_alarm on a real mistake becomes wrong", "live hang falls back to mock-fallback within 2.5 s", "MOCK STOP writes one llm_call row grade@1 outcome mock" (moved from T08; thread 0004), "MOCK STOP verdicts equal the frozen table" (every row of `tests/fixtures/f1a-mock-verdicts.json` through `POST …/stops`, never compared with `/api/grade`, which T18 deletes); `tests/mock-verdicts.test.js` (T13a) still passes after the `mockGrade` change.
- **Notes:** the browser still imports `mockGrade` until T17b; its 3-argument call keeps working with the subject-free default. The legacy `grade(body)` passes the demo-trades lexicon in this ticket, so the legacy route and the golden MOCK runs keep today's verdicts.

### F1a-T21 [P] Rating keys and Option B scoring in `shared/scoring.js`
- **Owner:** backend-engineer
- **Size:** S
- **Depends on:** F1a-T07b
- **Files:** modify `shared/scoring.js`; create `tests/not-graded.test.js`, `tests/rating-keys.test.js`
- **Interfaces (ADR 0006 Amendment 1; spec FR-021, FR-047; review B4, B10):**
  - `RULES.ratingTiers = [0.85, 0.6, 0.3]` (today's thresholds, moved).
  - `notGradedStepIdsFor(card, skippedStepIds: number[], caughtStepIds: number[], rules = RULES) → number[]`: walk the skipped ids in position order; for each, `resolveStop(card, position, new Set([...caught, ...notGradedSoFar]), rules)`; each non-null `errorStepId` is added.
  - `scoreRun(scenario, events, rules = RULES, {notGradedStepIds = []} = {})`: the second parameter is unchanged. Adds `ratingKey ∈ RATING_KEYS` (`missedCritical` when a critical mistake is truly missed, else `tier0`–`tier3` by `rules.ratingTiers`). A not-graded mistake gets no missed penalty, is left out of `maxPossible` and `missedCritical`, stays in `mistakeCount`, and appears in `missed[]` in step order with `notGraded: true` and `points: 0`. The legacy `rating` string stays until T18.
- **Acceptance:** FR-021 (key half), FR-047. With `notGradedStepIds` empty, every existing output field equals today's.
- **Tests that prove it:** `tests/rating-keys.test.js`: "every fixture × simulate player gives the ratingKey whose demo-trades label (ratingLabel) equals the frozen label" (an inline frozen `[{fixture, player, label}]` table generated from today's `r.rating` before the change; the test never reads `r.rating`, which T18 removes; thread 0004). `tests/not-graded.test.js`: "skip on the critical line: notGradedStepIdsFor returns [3]", "skip on a clean line returns []", "skip one line after a mistake (within graceSteps) returns that mistake", "two mistakes within reach: only the one resolveStop would credit", "an already-caught mistake is never not graded", "scoreRun with notGradedStepIds [3] on electrical never-stop: total -100, maxPossible 300, missedCritical false, ratingKey tier3, line 3 item notGraded true and points 0", "all three not graded: maxPossible 0, ratingKey tier3", "empty notGradedStepIds equals today's scoreRun for all fixtures × simulate players". Existing `tests/scoring.test.js` passes unchanged.
- **Notes:** [P] with T12, T13a and T13b (no shared files). The `notGraded` key is present only when true (OI-13 (a), ADR 0003 Amendment 2), so with `notGradedStepIds` empty every `missed[]` item keeps exactly today's keys. T14 puts it on the wire unchanged.

### F1a-T14 Complete route with `skippedStepIds`
- **Owner:** backend-engineer
- **Size:** M
- **Depends on:** F1a-T13b, F1a-T21. (The OI-13 merge block is lifted: review.md round 2 ruling, ADR 0002 Amendment 2, ADR 0003 Amendment 2.)
- **Files:** modify `server/routes/attempts.js`, `server/services/session.js`; create `tests/complete.test.js`
- **Interfaces (ADR 0002 + 0003, both with Amendments 1–2; ADR 0004 Amendment 1; review B3, B10, B12; round 2 changes 1–3):**
  - `POST /api/attempts/:attemptId/complete` body `{lastStepShown: integer, skippedStepIds?: integer[]}` → 200 `{total, maxPossible, caughtCount, mistakeCount, falseAlarms, missedCritical, ratingKey, ratingLabel, cleanRunLine, missed: [{stepId, severity, summary, consequence, correctAction, points, notGraded?}], skippedStepIds: integer[]}`. `notGraded` is present **only** on not-graded items, always `true`, with `points: 0`; ordinary items have exactly the six keys `stepId, severity, summary, consequence, correctAction, points`; card order. `skippedStepIds` is always present and holds the effective ids (equal to `completed.result.skippedStepIds`). `notGradedStepIds` is never on the wire. 404 unknown or malformed attempt; 409 while a STOP is in flight; 400 per the validation below.
  - `Session.completeAttempt(attemptId, {lastStepShown, skippedStepIds = []}) → Promise<CompleteResponse>`, checks in this order:
    1. **Unknown attempt** → 404.
    2. **Already completed** → body rebuilt with nothing written and the request values ignored: text fields from the card and pack; `skippedStepIds` and `notGradedStepIds` taken from the stored `completed.result` (missing `notGradedStepIds` → `[]`); `scoreRun(card, stops, RULES, {notGradedStepIds: <stored>})`. It MUST NOT call `notGradedStepIdsFor` (ADR 0002 Amendment 2; change 2).
    3. **A STOP in flight for this attempt** (any entry in the Session's shared `inFlight` map from T13b, whatever its `stepId`) → 409 `{error}`, nothing written (change 3; ADR 0003 Amendment 3 keeps this 409).
    4. **Validation (first call):** `lastStepShown` is a step id of the card whose position is ≥ the last graded STOP's position; `skippedStepIds` is an array of unique integer step ids of the card, each at a position ≤ `lastStepShown`'s position. Otherwise 400, nothing written.
    5. **Effective skips** = `skippedStepIds` minus ids with a graded STOP. `notGradedStepIds = notGradedStepIdsFor(card, effective, caughtStepIds)`; `scoreRun(card, stops, RULES, {notGradedStepIds})`; `ratingLabel(pack.ratings, ratingKey)`; `cleanRunLine = pack.copy.cleanRun`.
    6. Writes **one** `db.appendEvents([stepShown, completed])`: `step-shown` with `object.step = lastStepShown` and `result: null`; `completed.result {total, maxPossible, caughtCount, mistakeCount, falseAlarms, ratingKey, missedStepIds, skippedStepIds: effective, notGradedStepIds}`, where `missedStepIds` excludes not-graded ids, so caught, `missedStepIds` and `notGradedStepIds` are disjoint and cover every mistake. Both events have `promptVersions: {}`.
  - **No `await` in the read-then-write section (change 3):** `completeAttempt` MUST NOT `await` anything between `db.eventsForAttempt(attemptId)` and `db.appendEvents([stepShown, completed])`; steps 1–6 run synchronously, so a STOP can't interleave and a STOP that starts afterwards gets FR-007 check 1 (409).
  - `why` and `keywords` never appear.
- **Acceptance:** FR-008 (including `notGraded?` and the `skippedStepIds` echo), FR-009 (stored ids on repeat; 409 while a STOP is in flight), FR-016 (complete pair), FR-021 (`ratingLabel` on the wire), FR-043 (`notGradedStepIds`, partition), FR-047 (wire).
- **Tests that prove it:** `tests/complete.test.js`: "never-stop run: ratingKey missedCritical, label Someone got hurt, three missed items with exactly the six keys", "perfect run: tier0, label Journeyman eyes, cleanRunLine Clean job. Nobody got hurt.", "values equal scoreRun on the stored card", "complete never sends why or keywords", "second complete returns the identical body; one step-shown, one completed", "STOP after complete gets 409", "lastStepShown not a step id, or at a position before the last STOP, gets 400", "one full attempt (2 STOPs) writes exactly started, 2 × (stopped, explained, graded), step-shown (step = lastStepShown, result null), completed in seq order, and every event passes validateEvent" (B3, B9), "projectAttempt rebuilds total, caughtCount and falseAlarms of the first body" (US4.4), "skip on line 3 after a failed STOP: completed.result.skippedStepIds [3], line 3 item notGraded, total -100, maxPossible 300, ratingKey tier3" (B9, B10), "skip on a clean line: no penalty, nothing notGraded, skippedStepIds kept", "skip then a late STOP that credits the mistake: caught, not notGraded", "skipped id that has a graded STOP is dropped from completed.result.skippedStepIds and from the echo", "missing skippedStepIds is stored as []", "skippedStepIds non-array, non-integer, unknown id, duplicate or after lastStepShown gets 400 and writes nothing", "repeat complete with different skippedStepIds returns the first body", "a never-stop run's missed items have exactly six keys and no notGraded key" (change 1), "the skippedStepIds echo is always present ([] with no skips) and equals completed.result.skippedStepIds" (change 1), "caught, missedStepIds and notGradedStepIds are disjoint and cover every mistake (all fixtures × the skip scripts)" (change 1; the skip scripts, defined in the test, per fixture with `lastStepShown` = the last step id: `skip-critical` (skip on the critical mistake's line, no STOPs), `skip-clean` (skip on the first step without a mistake), `skip-late` (skip one step after the critical mistake), `skip-all-mistakes` (skip on every mistake's line), `skip-then-late-stop` (skip on the critical line, then a correct STOP on the next line)), "repeat complete uses the stored notGradedStepIds" (change 2: `createSession({db: fakeDb, …})` where `fakeDb.eventsForAttempt` returns a `completed` event whose `notGradedStepIds` differs from what `notGradedStepIdsFor` would give; the body's `missed[]` flags, `total` and `maxPossible` follow the stored value), "complete while a STOP is in flight gets 409 and writes nothing; after the STOP returns, complete succeeds and counts it" (change 3: `createSession` with a gateway stub whose `run` resolves after 100 ms; `complete` posted while it is pending).
- **Notes:** the browser counts its results note from the echo (T17d), so a STOP the server graded but whose response was lost is never counted as "not graded" (US2.14).

### F1a-T15 [P] `web/speech/` facade, zero behavior change
- **Owner:** frontend-engineer
- **Size:** S
- **Depends on:** F1a-T03b
- **Files:** create `web/speech/index.js`, `web/speech/web-speech.js`; modify `web/app.js` (imports and the renamed calls only); delete `web/speech.js`
- **Interfaces:**
  - Produces (`web/speech/index.js`): `speak(text, {enabled = true, rate = 1.05} = {}) → Promise<void>`; `listen({onInterim} = {}) → {result: Promise<string>, stop()}`; `onHotword(phrases: string[], handler: (phrase) => void) → () => void` (no-op in F1); `cancel()` (today's `stopSpeaking`: cancels speech **and** the pending `wait`); `wait(ms) → Promise<void>`; `capabilities = {canSpeak: boolean, canListen: boolean, hotword: false}`.
  - `web/speech/web-speech.js`: today's `web/speech.js` implementation (provider), imported only by `index.js`.
  - `web/app.js`: `import { speak, cancel, wait, capabilities, listen } from './speech/index.js'`; `stopSpeaking()` → `cancel()`; `canListen` → `capabilities.canListen`. No other line changes.
- **Acceptance:** FR-034, FR-036.
- **Tests that prove it:** `node tests/golden/run.mjs --replay` empty (all 48 MOCK runs, voice and text); real-browser check in Chrome, voice and text, at 390 and 1280 px, zero console errors (screenshots in the PR).
- **Notes:** may run any time after T03b, in parallel with T12–T14, T21 and T17a (`web/speech.js` has no deny-list hits). Must merge before T17b.

### F1a-T16 [P] Port the legacy server tests to the attempt routes
- **Owner:** qa-engineer
- **Size:** M
- **Depends on:** F1a-T14
- **Files:** modify `tests/server.test.js`, `tests/llm-deadline.test.js`, `tests/helpers/http.mjs`
- **Interfaces:**
  - Produces (`tests/helpers/http.mjs`): `startAttempt(baseUrl, body) → {status, json, ms}`; `postStop(baseUrl, attemptId, body) → {status, json, ms}`; `postComplete(baseUrl, attemptId, body) → {status, json, ms}`. `postGrade` removed.
- **Acceptance:** every BRAIN-01/02/03/08/09 and P1-6 guarantee is kept against the new routes with the same thresholds. Changed assertions (old → new):
  - BRAIN-09 "trade must be an own key of TRADES" → "subject and scenario must be own keys" (`POST /api/attempts`, 400 for the four prototype keys, 200 for `electrical`).
  - BRAIN-09 "bad grade bodies get 400/413" → same statuses on `POST /api/attempts/:id/stops` (`'{bad'`, `'null'`, `{stepId:'abc'}`, `[null]`, 1.1 MB).
  - BRAIN-08 log regex `POST \/api\/grade 200 mock` → `POST \/api\/attempts\/att_[0-9A-Z]{26}\/stops 200 mock`.
  - llm-deadline "happy path": `s.json.trade === 'electrical'` → `s.json.card.subject === 'demo-trades'` and `s.json.source === 'live'`; "scenario: hanging API falls back" → via `POST /api/attempts`, same 3 s bound.
  - All other assertions unchanged (verdict rewrites, 2000-char cap, 1 grade call, empty-feedback fallback, 401 in health, ≤ 1 retry, fallback-block parsing).
  - Added (thread 0004): every happy-path LIVE test in both files asserts `source === 'live'`; both files call `assertNoUnroutedCalls` (T09) in `after`.
- **Tests that prove it:** the ported files pass against the F1a build; the old-route versions are deleted in this ticket.
- **Notes:** parallel with T17a–T17d (no shared files). Must merge before T18 removes the old routes.

### F1a-T17a [P] Pure copy module `web/copy.js`
- **Owner:** frontend-engineer
- **Size:** S
- **Depends on:** F1a-T03b
- **Files:** create `web/copy.js`, `tests/web-copy.test.js`
- **Scope of the T17 split (thread 0004):** the old T17 is four sequential parts. T17a is the pure copy module (no DOM, runs in parallel with backend Wave 2). T17b switches the app to the attempt API on the happy path and adds the results-error state. T17c adds the grader-error panel and Skip. T17d adds the not-graded results and the results note. T17b, T17c and T17d all edit `web/app.js`, so they run strictly in that order.
- **Interfaces:**
  - Produces (`web/copy.js`; imports nothing, no DOM or `window` access, no subject word; scanned by the deny-list; byte-identical copy):
    - `feedbackText(r: {feedback: string, verdict: string, caught: null | {correctAction: string}}) → string`: `r.feedback`, plus `" Here's the right way: " + r.caught.correctAction` only when `r.caught !== null && r.verdict !== 'correct'` (review S6). Byte-identical to today's join at `web/app.js:188`.
    - `graderErrorText(repeat: boolean) → string`: `false` → "Couldn't reach the grader. Your answer is still here. Try again, or skip and this stop won't be scored."; `true` → "Still can't reach the grader. Try again, or skip this stop."
    - `runEndLine(result: CompleteResponse) → string | null` (FR-046, review OI-9): the critical, else first, `missed[]` item without `notGraded` → `"Here's what happened next. " + consequence`; else `null` if any item is `notGraded`; else `result.cleanRunLine`.
    - `resultsNote(n: number) → string | null`: `null` for `n = 0`; `"1 stop wasn't graded, so it isn't in your score."` for 1; `"{n} stops weren't graded, so they aren't in your score."` for `n ≥ 2` (digits).
    - `RESULTS_ERROR_TEXT = "Couldn't load your results yet. Retry to see what you missed and the right way to do it."`; `NO_JOBS_TEXT = "No jobs are available right now."`.
- **Acceptance:** FR-033 (one builder per new string), FR-046; every new row of the spec's copy table. Nothing imports `web/copy.js` yet; golden replay empty.
- **Tests that prove it:** `tests/web-copy.test.js` (this ticket's unit tests, written by the frontend engineer): "graderErrorText(false) and (true) equal the copy table", "resultsNote(0) is null; 1, 2 and 3 equal the copy table", "runEndLine picks the critical truly missed item", "runEndLine picks the first truly missed item when no critical is missed", "runEndLine never picks a notGraded item and returns null when only notGraded items remain", "runEndLine returns cleanRunLine when nothing is missed", "feedbackText appends the fix only when caught and verdict is not correct" (4 cases), "RESULTS_ERROR_TEXT and NO_JOBS_TEXT equal the copy table", "copy.js has no import statement and no document or window reference" (source scan).

### F1a-T17b Web switch-over: attempt API, happy path and results error
- **Owner:** frontend-engineer
- **Size:** M
- **Depends on:** F1a-T14, F1a-T15, F1a-T17a
- **Files:** modify `web/app.js`, `web/api.js`, `web/index.html`
- **Interfaces:**
  - Consumes: `GET /api/subjects`, `GET /api/scenarios?subject=`, `POST /api/attempts`, `POST /api/attempts/:attemptId/stops`, `POST /api/attempts/:attemptId/complete` (T12–T14); everything in `web/copy.js` (T17a).
  - Produces (`web/api.js`, no import of `/shared/*`): `fetchSubjects() → [{id, title}]`; `fetchScenarios(subject) → [{id, label}]`; `startAttempt({subject, scenario, cached}) → {attemptId, card, source}` (live first with a 50 000 ms timeout, then `source:'fixture'` reported as `fixture-fallback` on failure, as today); `postStop(attemptId, {stepId, explanation}) → StopResponse` (12 000 ms timeout; throws `GraderUnreachableError` with `status: number | null` on network error, timeout or any non-2xx); `completeAttempt(attemptId, {lastStepShown, skippedStepIds}) → CompleteResponse` (12 000 ms timeout; throws `ResultsUnreachableError` with `status: number | null`). **Every timeout is `setTimeout` plus `AbortController`, cleared when the request settles; never `AbortSignal.timeout`** (ADR 0005 Amendment 2, so `page.clock` drives it). `fetchHealth` stays. The legacy `fetchTrades`, `fetchScenario`, `gradeStop` and the `mock-grader` import are removed.
  - `web/app.js`:
    - `game = {attemptId, card, stepIndex, total, pendingStop: {stepId} | null, skippedStepIds: number[], graderFailures: number}`; no `steps[].error`, no `caught` set, no `events`. The subject id is `subjects[0].id` (never a literal in `web/`). No import from `/shared/scoring.js`.
    - Setup `<option>`s are built with `document.createElement('option')`, `.value = id`, `.textContent = label` (FR-045, review B7). If `fetchSubjects()` or `fetchScenarios()` returns `[]`: `#setup-msg.textContent = NO_JOBS_TEXT`, `#start-btn.disabled = true`, no exception (FR-035).
    - `submitExplanation` → `postStop`; `isCatch = r.caught !== null`; `markLine(isCatch ? r.caught.errorStepId : stepId, …)`; score = `r.total`; feedback = `feedbackText(r)`. `GRADE_SOURCE['local-fallback']` removed. **Interim until T17c:** on `GraderUnreachableError`, Submit is re-enabled and reset to its normal label, the explanation stays in the textbox, and nothing new is displayed or spoken (no stall; T17c replaces this with the panel).
    - `finish` is async: `completeAttempt(attemptId, {lastStepShown: <last shown step id>, skippedStepIds})`. On success: rating from `ratingLabel`; summary from the values; each `missed[]` item built with `createElement` and `textContent` (no `innerHTML`) as "{severity} · missed · {points} pts", then the summary, consequence and "Should have" lines; `li.classList` gets the severity only if it is `critical`, `major` or `minor` (FR-045); in voice mode `speak(runEndLine(result))` when not null. On `ResultsUnreachableError`: `#results-error-msg.textContent = RESULTS_ERROR_TEXT`, `#retry-results-btn` "Retry results" focused, `#again-btn` visible, the same string spoken once per showing in voice mode. A successful retry renders the normal results and moves focus to `#result-rating` (FR-049).
    - `resultsToken` (like today's `runToken`): bumped by `#again-btn`, checked after every `await` in `finish` and the retry path; a stale response or speech is dropped (FR-050). "Retry results" is disabled while its request is pending.
  - `web/index.html`: `id="trade-select"` → `id="scenario-select"`; markup for `#results-error` (`<p id="results-error-msg" role="alert">` and `<button id="retry-results-btn" aria-describedby="results-error-msg">Retry results</button>`); `tabindex="-1"` on `#result-rating`. No other copy changes (see spec Later).
- **Acceptance:** FR-030, FR-032, FR-035, FR-036 (the 57 runs that aren't allow-listed are unchanged), FR-045, FR-046 (run-end speech), FR-049 (results-error half), FR-050 (`resultsToken` half); US1 (including US1.11–US1.12), US3 and US6.1–US6.4 in voice and text mode.
- **Tests that prove it:** `node tests/golden/run.mjs --replay`: empty diff except the 4 allow-listed runs; `node tests/e2e/F1a.e2e.mjs`: the US1, US3 and US6 tests (voice and text), "US3.1 complete client timeout at 12 000 ms shows #results-error", "edge: a 409 on complete shows #results-error" (T01b's test; round 2 change 3: a 409 is a non-2xx, so the results-error path handles it with no extra code), "US3.6 focus on #result-rating after a successful Retry results", "US3.7 Run another job during a pending complete: results never appear over setup", "US1.11 empty subjects list" (0 console errors), "a scenario label containing <b>x</b> is shown literally" (`page.route` on `/api/scenarios`; B7), "a missed item with severity '<x>' gets no class and shows the text literally" (`page.route` on `…/complete`), leak check in the browser (no `/api/*` response before each STOP response contains an answer field; `localStorage` empty); zero console errors at 390 and 1280 px (screenshots in the PR). QA removes the `F1a-T17b` todos when verifying.
- **Notes:** no browser-side grading in any form (A3); offline queueing is F2. **Interim state:** between T17b and T17c a failed STOP only re-enables Submit, and between T17c and T17d a not-graded item is shown as an ordinary missed item with 0 points. Wave 2 is not done until T17d. No release, deploy or founder playtest is cut from a commit between T17b and T17d.

### F1a-T17c Grader-error panel, Skip and the STOP-side guards
- **Owner:** frontend-engineer
- **Size:** M
- **Depends on:** F1a-T17b
- **Files:** modify `web/app.js`, `web/index.html`, `web/styles.css`
- **Interfaces:**
  - Consumes: `postStop`, `GraderUnreachableError` (T17b); `graderErrorText` (T17a); `cancel`, `listen`, `speak` (T15).
  - `web/app.js`:
    - On `GraderUnreachableError`: `graderFailures += 1`; show `#grader-error` with `#grader-error-msg.textContent = graderErrorText(graderFailures > 1)`; the explanation textbox stays visible with its content; buttons `#retry-grade-btn` "Try again" and `#skip-stop-btn` "Skip this stop"; speak the same string once when "Read aloud" is on. Focus: "Try again" on a first failure with `status === null` or ≥ 500; "Skip this stop" on a 4xx or when `graderFailures > 1`. "Try again" re-sends the textbox's current content for the same `stepId`. **In the error state, Submit and Enter run the Try-again path** (FR-050). "Skip this stop" pushes `stepId` onto `skippedStepIds` (unique), resets `graderFailures`, bumps `stopToken`, closes the panel, resumes narration at the next line and moves focus to `#stop-btn` (FR-049). A success resets `graderFailures`.
    - `stopToken`: checked after every `await` in the STOP path; a stale response is dropped (no feedback panel, no second `play()` loop).
    - While a STOP request is pending (first send or retry): `#retry-grade-btn`, `#skip-stop-btn`, Submit, Enter-to-submit and `#mic-btn` are disabled, so a double press sends one request.
    - `toggleMic` calls `cancel()` before `listen()` (FR-050).
    - `finish` sends the collected `skippedStepIds`.
  - `web/index.html`: markup for `#grader-error`: `<p id="grader-error-msg" role="alert">`, `<button id="retry-grade-btn" aria-describedby="grader-error-msg">Try again</button>`, `<button id="skip-stop-btn" aria-describedby="grader-error-msg">Skip this stop</button>`.
  - `web/styles.css`: the fixed-bottom panel (`styles.css:74`) holds the message, the textbox and the buttons at 390 px.
- **Acceptance:** FR-031, FR-033, FR-042, FR-049 (grader half, focus after Skip), FR-050 (STOP half); US2.1–US2.4 and US2.11–US2.18 in voice and text mode.
- **Tests that prove it:** `node tests/e2e/F1a.e2e.mjs`: US2.1–US2.4 and US2.11–US2.18 (voice and text), "US2.1 STOP client timeout at 12 000 ms shows the panel", "a double press on Try again sends one request", "US2.15 Skip, Submit and mic are disabled while a STOP request is pending", "US2.17 mic during the spoken error cancels speech before listening", "US2.18 Enter in the error state runs Try again with the edited text", "focus on #stop-btn after Skip", "role=alert and aria-describedby on the grader-error panel", "at 390 px the message, textbox and both buttons are inside the viewport" (bounding boxes); `node tests/golden/run.mjs --replay`: empty diff except the 4 allow-listed runs, and both `grade-aborted` runs record `abortsFired: 1`; zero console errors at 390 and 1280 px (screenshots in the PR). QA removes the `F1a-T17c` todos when verifying.

### F1a-T17d Skip results: not-graded items and the results note
- **Owner:** frontend-engineer
- **Size:** S
- **Depends on:** F1a-T17c
- **Files:** modify `web/app.js`, `web/index.html`, `web/styles.css`
- **Interfaces:**
  - Consumes: `CompleteResponse.missed[].notGraded`, `CompleteResponse.skippedStepIds` (T14); `resultsNote`, `runEndLine` (T17a).
  - `web/app.js`: a `missed[]` item with `notGraded: true` is shown as "{severity} · not graded" (no points) with `li.classList.add('not-graded')`, then its summary, consequence and "Should have" lines (FR-044). `#results-note.textContent = resultsNote(n)` with `n = result.skippedStepIds.length` from the `complete` response (OI-13 (c)), never `game.skippedStepIds.length`; hidden when `null`. In voice mode: `speak(runEndLine(result))` when not null, then check `resultsToken`, then `speak(resultsNote(n))` when not null (FR-046, FR-050).
  - `web/index.html`: `<p id="results-note" role="status" hidden>` on the results screen.
  - `web/styles.css`: `.missed li.not-graded` has no danger border (today every item gets it, `styles.css:90`), so a not-graded item doesn't look like a failure.
- **Acceptance:** FR-044, FR-046, FR-049 (`role="status"`), FR-050 (token between the two `speak()` calls); US2.5–US2.10 in voice and text mode; SC-011. By the end of this ticket every deny-list hit in `web/` is gone (`deny-list-allow.json` has zero `web/` entries; each T17 part lowers the counts it removes).
- **Tests that prove it:** `node tests/e2e/F1a.e2e.mjs`: US2.5–US2.10 (voice and text), "no speechSynthesis.speak after #again-btn", "role=status on #results-note", the full suite passes in ≤ 10 min; `node tests/golden/run.mjs --replay --expect-aborts`: empty diff except the 4 allow-listed runs, and every allow-listed run fired its abort; zero console errors at 390 and 1280 px (screenshots in the PR). QA removes the `F1a-T17d` todos when verifying.
- **Notes:** the two failure states (grader unreachable, results unreachable) are the only intended learner-visible changes outside failure runs.

### F1a-T18 Remove the legacy routes, finish the engine-code sweep, update the README
- **Owner:** backend-engineer
- **Size:** M
- **Depends on:** F1a-T16, F1a-T17d
- **Files:** modify `server/index.js`, `server/routes/scenarios.js`, `server/services/content.js`, `server/services/assessment.js`, `shared/scoring.js`, `scripts/simulate.js`, `README.md`, `tests/scoring.test.js`, `tests/game-balance.test.js`, `tests/fixtures/deny-list-allow.json`; delete `server/routes/grade.js`
- **Interfaces:**
  - Removes: `GET /api/trades`, `GET /api/scenario`, `POST /api/grade` (→ 404 via the dispatcher's fallback); `LEGACY_SUBJECT`; `getScenario`; the `scenario.trade = …` stamp; legacy `grade(body)`; `scoreRun().rating` and every rating label string in `shared/scoring.js`.
  - `scripts/simulate.js`: prints `ratingLabel(pack.ratings, r.ratingKey)` for the pack each card came from; `PLAYERS` and `playRun` signatures unchanged.
  - `README.md` (`README.md:24-25, 45, 52, 111`; review S7): the diagram and API sections document `GET /api/subjects`, `GET /api/scenarios`, `POST /api/attempts`, `…/stops`, `…/complete`; `local-fallback` removed from the source list; `llm.js` → `server/ai/gateway.js`.
- **Acceptance:** FR-012, FR-021 (labels gone), FR-048 (route strings), SC-002 (route half), SC-003.
- **Changed tests:**
  - `tests/scoring.test.js`: `r.rating === 'Someone got hurt'` → `r.ratingKey === 'missedCritical'`; `r.rating === 'Journeyman eyes'` → `r.ratingKey === 'tier0'`.
  - `tests/game-balance.test.js`: `r.rating === <label>` → `ratingLabel(DEMO.ratings, r.ratingKey) === <same label>` for every rating assertion (labels unchanged; `DEMO` read from the pack).
- **Tests that prove it:** "legacy routes return 404" (in `tests/acceptance/F1a.test.js`, `todo` removed by QA); `tests/deny-list.test.js` green with SC-003's allow-list; full `npm test` green with no other test changes (no new test uses a legacy route, per the rule at the top; if one is found, it is added here as `old → new` and the deviation is explained); golden replay as in T17d.

### F1a-T19a Answer-leak test and guardrails
- **Owner:** qa-engineer
- **Size:** M
- **Depends on:** F1a-T18, F1a-T01a
- **Files:** create `tests/no-answer-leak.test.js`, `tests/guardrails.test.js`
- **Interfaces:**
  - Consumes: `leakScan` (T01a); all F1a routes; `assertNoUnroutedCalls` (T09).
- **Acceptance:** FR-011, FR-030, FR-048, SC-002.
  - The leak test plays every demo-trades card in MOCK and LIVE-against-fake-Claude, with every STOP pattern from the golden scripts (patterns inline in the test), and asserts `leakScan` is empty on every response before the crediting STOP and on every false-alarm response; that `caught` holds only the credited mistake; that `/packs/demo-trades/pack.json`, `/../packs/demo-trades/pack.json`, `/shared/../packs/demo-trades/pack.json` and `/packs/demo-trades/scenarios/electrical.json` return 403 or 404; and that the three legacy routes return 404.
- **Tests that prove it:** `tests/no-answer-leak.test.js`: "no answer field before the crediting STOP (3 cards × MOCK/LIVE × scripts)", "false-alarm responses reference no mistake", "pack and scenario files are not served", "legacy routes are gone". `tests/guardrails.test.js` (B9): "no file under web/ imports mock-grader or scoring, or calls scoreStop, scoreRun or resolveStop", "no route string /api/scenario, /api/grade or /api/trades in server/".

### F1a-T19b F1a exit evidence and `qa-report.md`
- **Owner:** qa-engineer
- **Size:** M
- **Depends on:** F1a-T19a, F1a-T11, F1a-T01b
- **Files:** create `tests/perf/stop-latency.mjs`, `docs/specs/F1a-server-owned-cards/qa-report.md`
- **Interfaces:**
  - Produces: CLI `node tests/perf/stop-latency.mjs` (MOCK, spawned through `tests/helpers/server.mjs`): 10 warm-up STOPs excluded, then 100 sequential measured `POST /api/attempts/:id/stops`, one per fresh attempt; prints `{n: 100, p50, p95, max, node, cpu}` as JSON. Not in `npm test`.
- **Acceptance:** SC-001, SC-003, SC-004, SC-005, SC-009, SC-010, SC-011, and the AI-quality verdict (spec "AI-quality thresholds"). Final evidence, all quoted in `qa-report.md` with **separate Functional and AI-quality verdicts**: `node tests/golden/run.mjs --replay --repeat 3 --expect-aborts` exit 0, with the time; fresh `npm test` with `# fail 0`, `# todo 0`, `# skipped 0`, `# tests` ≥ 97; `node tests/e2e/F1a.e2e.mjs` passes at 390 and 1280 px with 0 todos and the time (≤ 10 min); `deny-list-allow.json` matches SC-003; the SC-009 p95 and machine (a p95 above 200 ms is filed as a bug ticket, not a failed assertion); `npm run check:ticket <id>` output (or the exit-2 manual list) for every ticket in this file, including each split part.
- **Tests that prove it:** the evidence above. A `todo` still present in `tests/acceptance/` or `tests/e2e/` is a blocker bug against the ticket it names (QA removed each ticket's todos when verifying it; this ticket doesn't sweep them).

## Order at a glance

| Wave | Ticket | Owner | Size | Depends on |
|---|---|---|---|---|
| 0 | F1a-T01a [P] | qa-engineer | M | none |
| 0 | F1a-T01b | qa-engineer | M | T01a, T03a |
| 0 | F1a-T02 [P] | backend-engineer | S | none |
| 0 | F1a-T03a | qa-engineer | M | T02 |
| 0 | F1a-T03b | qa-engineer | M | T03a |
| 0 | F1a-T04 [P] | backend-engineer | M | T03b |
| 0 | F1a-T05 [P] | backend-engineer | S | T02, T03b |
| 1 | F1a-T06 | backend-engineer | M | T04 |
| 1 | F1a-T20 [P] | backend-engineer | S | T03b |
| 1 | F1a-T07a | backend-engineer | M | T06, T20 |
| 1 | F1a-T07b | backend-engineer | M | T07a, T05 |
| 1 | F1a-T08a [P] | backend-engineer | M | T05, T06 |
| 1 | F1a-T08b | backend-engineer | M | T07b, T08a |
| 1 | F1a-T09 [P] | qa-engineer | S | T08b |
| 1 | F1a-T10 [P] | qa-engineer | S | T08b |
| 1 | F1a-T11 [P] | qa-engineer | S | T06 |
| 2 | F1a-T12 | backend-engineer | M | T09, T10 |
| 2 | F1a-T13a [P] | backend-engineer | M | T06, T07b |
| 2 | F1a-T13b | backend-engineer | M | T12, T13a |
| 2 | F1a-T21 [P] | backend-engineer | S | T07b |
| 2 | F1a-T14 | backend-engineer | M | T13b, T21 |
| 2 | F1a-T15 [P] | frontend-engineer | S | T03b |
| 2 | F1a-T16 [P] | qa-engineer | M | T14 |
| 2 | F1a-T17a [P] | frontend-engineer | S | T03b |
| 2 | F1a-T17b | frontend-engineer | M | T14, T15, T17a |
| 2 | F1a-T17c | frontend-engineer | M | T17b |
| 2 | F1a-T17d | frontend-engineer | S | T17c |
| 2 | F1a-T18 | backend-engineer | M | T16, T17d |
| 2 | F1a-T19a | qa-engineer | M | T18, T01a |
| 2 | F1a-T19b | qa-engineer | M | T19a, T11, T01b |

30 tickets (revision 3 had 21), all S or M; the scope is unchanged apart from the thread-0004 additions (failure matrix, timing contract, join, accessibility, stale-response guards, empty-list copy). Backend critical path: T04 → T06 → T07a → T07b → T08b → T09/T10 → T12 → T13b → T14 → T18. T08a, T13a, T20 and T21 come off it. The backend engineer may build T08a while T07a/T07b are in review, and T13a while T08b–T12 are.

**What can start now (thread 0004):** T01a and T02 at once; T03a after T02; T01b after T01a and T03a; everything else when its `Depends on` merges and, except T01a, T01b, T02 and T03a, after T03b (merge gate). T15 and T17a may start any time after T03b. The architect verifies the thread-0004 rulings in code review against the tests they name.

**[P] collision check:** T01a ∥ T02 (tests/acceptance vs. prompts/scenario.js). T04 ∥ T05 ∥ T20 (index.js, routes, services vs. prompts vs. packs/pack.json, shared/pack.js, tests/pack-format). T08a ∥ T07a, T07b, T11, T20 (server/ai/*, tests/gateway.test.js vs. packs, server/packs.js, index.js, content.js, contract.js, tests vs. ownership files vs. pack.json). T07a → T07b → T08b sequential (`server/services/content.js`, test files). T09 ∥ T10 ∥ T11 (fake-claude.mjs and gateway.test.js `after` hook vs. deny-list files vs. ownership files). T13a ∥ T08b, T09, T10, T11, T12, T21 (shared/events.js, server/services/stop-plan.js, tests/events.test.js, tests/stop-plan.test.js, tests/mock-verdicts.test.js, the verdict fixture vs. their files; T13a starts after T07b). T21 ∥ T12, T13a, T13b (shared/scoring.js vs. server, events.js, mock-grader.js, contract.js). T15 ∥ T17a ∥ T12–T14, T21 (web/speech, web/app.js vs. web/copy.js vs. server and shared). T16 ∥ T17a–T17d (tests vs. web). Split parts never run in parallel: T01a → T01b, T03a → T03b, T07a → T07b, T08a → T08b, T13a → T13b, T17a → T17b → T17c → T17d, T19a → T19b. The `web/app.js` edits run T15 → T17b → T17c → T17d.

## Bugs (QA appends)
