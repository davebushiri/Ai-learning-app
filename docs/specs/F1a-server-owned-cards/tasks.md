# F1a: Tickets

**Status:** In review (revision 2, answering [`review.md`](review.md) CHANGES REQUESTED). Spec: [`spec.md`](spec.md). Binding: ADRs 0001–0007 including Amendment 1 of 0002, 0003, 0005 and 0006 (the ADR wins over this file), and the DECISIONs in [thread 0003](../../team/threads/0003-f1-engine-core-proposal.md).

Legend: [P] = can run in parallel with other [P] tickets in the same group (no shared files). Tickets without [P] run in the order of their `Depends on`.

## Rules for every ticket in this spec

- **Merge gate:** nothing except F1a-T01 and F1a-T02 merges before F1a-T03 (golden baseline) has merged.
- **Golden replay after every wave:** QA runs `node tests/golden/run.mjs --replay` after the last ticket of each wave. Any diff outside `tests/fixtures/golden/allow-list.json` is a blocker bug. A flaky run is a harness bug ticket, never an allow-list entry (review R2).
- **Deny-list ratchet (from F1a-T10 on):** a ticket that removes a deny-listed word from `server/`, `shared/`, `web/` or `scripts/` lowers the matching count in `tests/fixtures/deny-list-allow.json` in the same change. That one-file edit is allowed for every ticket after T10 and is not a file-list deviation. No ticket may raise a count or add an entry.
- **Changed assertions:** any existing test whose assertion changes is listed in the ticket as `old → new`. Path-only or setup-only edits are listed as such.
- **Shared files are edited in sequence, never in parallel:** `shared/contract.js` T07 → T13; `shared/scoring.js` T21 → T18; `server/index.js` T04 → T07 → T12 → T18; `server/services/content.js` T04 → T07 → T08 → T12 → T18; `server/services/assessment.js` T04 → T08 → T13 → T18; `tests/helpers/fake-claude.mjs` T03 → T07 → T09; `tests/prompt-version.test.js` T05 → T07; `tests/helpers/http.mjs` T07 → T16; `tests/llm-deadline.test.js` T08 → T16; `web/app.js` T15 → T17.
- **No prompt text, template or schema change anywhere in F1a** (FR-027). A diff that changes a frozen fingerprint (T05) fails review.
- **Ownership:** per the `CLAUDE.md` table (founder DECISION on OI-8, thread 0003). `package.json`, `.gitignore`, `packs/**`, `README.md` are `backend-engineer`'s. Recorded helper exceptions (review S10): T06 edits `tests/helpers/server.mjs`, T07 edits the path in `tests/helpers/fake-claude.mjs`; QA acknowledges both in T09's PR.
- **Run your own tests against a DB:** spawned servers use `DB_PATH=:memory:` (set by the helper after T06); tests that inspect events spawn with `DB_PATH=<temp file>` and open it read-only afterwards.

## Group 0 (Wave 0): baseline and safe refactors

### F1a-T01 [P] Acceptance tests from the spec scenarios
- **Owner:** qa-engineer
- **Size:** M
- **Depends on:** none
- **Files:** create `tests/acceptance/F1a.test.js`, `tests/acceptance/helpers.mjs`, `tests/e2e/F1a.e2e.mjs`
- **Interfaces:**
  - Consumes: the routes and shapes in spec FR-001–FR-012, FR-035, FR-042–FR-047 (not yet built); `startServer(env)` from `tests/helpers/server.mjs`; `startFakeClaude()` from `tests/helpers/fake-claude.mjs`.
  - Produces: `leakScan(json: unknown, {kind: 'stop' | 'complete' | 'other'}) → string[]` in `tests/acceptance/helpers.mjs`. Returns the JSON paths of any key in `["why","summary","correctAction","consequence","keywords","severity"]`, plus the key `error` **only when its value is not a string** (ADR 0003 Amendment 1; review S3). Allowed: `caught.severity` and `caught.correctAction` when `kind = 'stop'`; anything under `missed[]` when `kind = 'complete'`. Never throws (cyclic input → path `"<cycle>"`). F1a-T19 reuses it.
- **Acceptance:** every acceptance scenario in spec US1–US6 and every edge case has at least one named test. HTTP-level tests (US1 API parts, US4, US5, US6, the Skip consequence at the API level, edge cases) live in `tests/acceptance/F1a.test.js` and run in `npm test`. Browser tests (US1–US3 in voice and text mode, including US2.5–US2.14) live in `tests/e2e/F1a.e2e.mjs` and run with `node tests/e2e/F1a.e2e.mjs` (Playwright, global install, `MOCK=1`, free port, stubbed `speechSynthesis` and `SpeechRecognition`, `page.clock`, 390 px and 1280 px, zero console errors). Failure states are produced with `page.route` (abort or fulfil with a status).
- **Tests that prove it:** each test is named `"<US#>.<scenario#> <title>"` or `"edge: <title>"`. Required, among all others: "leakScan: {error:'unknown subject'} is clean, {error:{why:'x'}} is flagged" (S3); "US2.5 skip on the critical line: skippedStepIds [3] sent and stored, line 3 critical · not graded, total -100, max 300, results note shown and spoken" (B9, B10) and its text-mode twin; "US2.7 skip on a clean line costs no false alarm" and twin; "US2.9 nothing truly missed but one not graded: clean-run line not spoken" and twin; "US2.13 4xx focuses Skip this stop"; "US2.14 lost response then skip: the server's graded STOP stands"; "edge: skippedStepIds validation"; "edge: second STOP in flight gets 409"; "US4.6 completed.result.skippedStepIds". Until its implementing ticket merges, each test is declared with `{ todo: 'F1a-T##' }` so `npm test` stays green. QA removes the `todo` when verifying that ticket.
- **Notes:** written from the spec, not the code. `npm test` only picks up `tests/acceptance/` after F1a-T06 widens the glob; run the file directly until then.

### F1a-T02 [P] Injectable rng for the scenario user prompt
- **Owner:** backend-engineer
- **Size:** S
- **Depends on:** none
- **Files:** modify `server/prompts/scenario.js`; create `tests/scenario-prompt-rng.test.js`
- **Interfaces:**
  - Produces: `scenarioUserPrompt(tradeId, trade, recentSummaries = [], rng = Math.random) → string`. `pick(a)` becomes `pick(a, rng)` using `Math.floor(rng() * a.length)`. The parameter names `tradeId`/`trade` stay (prompt file; renamed in F1b).
- **Acceptance:** FR-028. With `rng` omitted, behavior is unchanged. With a fixed `rng`, the output is a pure function of the inputs. No other text changes; no `VERSION` (T05 adds it).
- **Tests that prove it:** `tests/scenario-prompt-rng.test.js`: "same rng sequence gives byte-identical prompt", "rng () => 0 picks the first hint, twist and name", "default rng still varies names over 200 calls", "frozen snapshot: electrical with rng () => 0.5 equals the stored string" (snapshot inline in the test, generated from the pre-change code).
- **Notes:** behavior-neutral, so it may merge before T03. `tests/validator.test.js:231-263` must pass unchanged.

### F1a-T03 Golden baseline capture (merge prerequisite)
- **Owner:** qa-engineer
- **Size:** M
- **Depends on:** F1a-T02
- **Files:** create `tests/golden/run.mjs`, `tests/golden/harness.mjs`, `tests/golden/scripts.mjs`, `tests/golden/browser-stubs.js`, `tests/fixtures/golden/manifest.json`, `tests/fixtures/golden/allow-list.json`, `tests/fixtures/golden/runs/*.json`; modify `tests/helpers/fake-claude.mjs`
- **Interfaces:**
  - Produces (`tests/helpers/fake-claude.mjs`, review B11): every `/__log` entry gains `system` (the request's `system` as one string: a string as is, an array of text blocks joined with `"\n"`) and `schemaSha256` (sha256 hex of `JSON.stringify(body.output_config.format.schema)`, `null` if absent). Existing fields and routing are unchanged.
  - Produces: CLI `node tests/golden/run.mjs --capture | --replay [--repeat N] [--only <runId>]`; exit 0 = no diff outside the allow-list.
  - Golden run file `tests/fixtures/golden/runs/<runId>.json`: `{runId, mode: "mock"|"live-fake", speech: "voice"|"text", fixture, script, displayed: string[], spoken: string[], focus: string[], points: number[], score: number, rating: string, outcomeLine: string|null, grades: [{verdict, source}], prompts: [{kind, system, user, schemaSha256}]}`.
  - `manifest.json`: `{capturedAt, gitSha: string|null, treeSha256, node, chromium, runs: string[]}`. `gitSha` = `git rev-parse HEAD` output, or `null` when git is missing or exits non-zero (review OI-7). `treeSha256` = sha256 over the sorted `path\0content` of every file in `server/`, `shared/`, `web/`, `fixtures/`; always recorded.
  - `allow-list.json`: `["grade-aborted-electrical-voice", "grade-aborted-electrical-text", "complete-aborted-electrical-voice", "complete-aborted-electrical-text"]`. This file never grows.
- **Acceptance:** SC-001 can be evaluated. The baseline is captured from the code before any F1a ticket except T01 and T02, run 3× with byte-identical output before it is committed.
  - **Matrix (61 runs):**
    - MOCK × 3 fixtures × 8 scripts × {voice, text} = 48. Scripts: `perfect`, `late-by-one`, `false-alarm` (STOP on line 1 only), `missed-critical` (STOP on major and minor only), `never-stop`, `empty-explanation` (STOP on the critical line, submit empty), `wrong-explanation` (STOP on the critical line, "his shoes are untied"), `double-stop` (STOP on a mistake, then STOP on the next line).
    - LIVE against fake Claude, cached card, text: 3 fixtures × {`perfect`, `false-alarm`} = 6.
    - LIVE, live-generated card, text, `perfect`: 1.
    - LIVE, fake Claude `hang` on grade, text, `perfect`: 1. LIVE, fake Claude `429` with retry-after 60, text, `perfect`: 1.
    - Allow-listed failure runs, MOCK electrical, {voice, text}: `grade-aborted` (`page.route` aborts the first grade request), `complete-aborted` (aborts the first results request; in the baseline there is none, so the run records the normal results) = 4.
  - **Layers recorded:** learner-visible (displayed strings: transcript lines with speaker, verdict label, feedback text, points, source line, score, results fields, missed items, every panel message; `speechSynthesis.speak` texts in order; `document.activeElement` id after each panel change) and outbound-prompt (`system`, `user`, `schemaSha256` per fake-Claude call, from `/__log`); plus grade verdict and source. Screenshots at 390 and 1280 px go to the OS temp dir as a diff aid, not committed and not asserted.
  - **Normalization:** `Date.now()`-based ids are replaced by `<id>`. In the one live-generated run only (review OI-10), the **value** after each of the three labels "Draw the critical mistake from: ", "Jobsite twist to include: " and "Apprentice name: " is replaced by `<masked>`, and the harness asserts the value is a member of its source list: the electrical entry's `criticalHints`, else its `hazardHints` split on commas and trimmed, plus the literal `any of the hazard areas`; its `twists`, else `DEFAULT_TWISTS`; `APPRENTICE_NAMES`. The three lists are frozen as constants in `tests/golden/scripts.mjs`, copied from `server/prompts/trades.js` and `server/prompts/scenario.js` at capture time (no prompt file is edited, no seed env var). The rest of the prompt is compared byte for byte; a non-member value is a diff.
  - The harness spawns the server with `DB_PATH=:memory:` so it works unchanged after T06.
- **Tests that prove it:** `node tests/golden/run.mjs --capture` then `--replay --repeat 3` exits 0 on the baseline; quote the output in the PR. Full `npm test` passes with the `fake-claude.mjs` change (no assertion changes).
- **Notes:** explanation strings per fixture and step are fixed in `scripts.mjs` (test code may read pack or fixture files). Later edits to `fake-claude.mjs`: T07 (path only), then T09 (routing).

### F1a-T04 [P] Split `server/index.js` into routes and services (zero test changes)
- **Owner:** backend-engineer
- **Size:** M
- **Depends on:** F1a-T03
- **Files:** modify `server/index.js`; create `server/http.js`, `server/routes/health.js`, `server/routes/scenarios.js`, `server/routes/grade.js`, `server/services/content.js`, `server/services/assessment.js`, `server/services/live-status.js`, `server/services/ai-client.js`
- **Interfaces:**
  - Produces:
    - `server/http.js`: `class HttpError(status, message)`, `sendJson(res, status, data)`, `readBody(req) → Promise<object>` (413 over 1,000,000 bytes, 400 on bad JSON), `serveStatic(res, pathname)`, `MIME`, `ROOT` (absolute repo root).
    - `server/services/live-status.js`: `liveStatus {lastLiveOkAt, lastLiveError}`, `noteLive(what, err?)`.
    - `server/services/ai-client.js`: `export const MOCK: boolean`, `export const ai` = `null` in MOCK, else the module from `await import('../llm.js')`. This is the **only** place that chooses the AI module (T08 replaces it).
    - `server/services/content.js`: `getScenario(tradeId, source) → Promise<{scenario, source}>` (moved verbatim).
    - `server/services/assessment.js`: `grade(body) → Promise<GradeResponse>` (moved verbatim).
    - Each route module: `handle(req, res, url) → Promise<boolean>` (true if it handled the request). `server/index.js` keeps env loading, `process.on('unhandledRejection')`, the `[api]` log line, the dispatcher loop, the 404 and error handling, and `listen`.
- **Acceptance:** pure move. Every existing test passes with zero test-file changes; golden replay is empty; the startup line `… on http://localhost:<port> …` is unchanged.
- **Tests that prove it:** the full existing suite (`npm test`, 97 pass) and `node tests/golden/run.mjs --replay`.
- **Notes:** required first by the architect (A4). Keep function bodies byte-identical where possible so the diff reads as a move.

### F1a-T05 [P] `VERSION` and `PROMPT` exports, frozen fingerprints
- **Owner:** backend-engineer
- **Size:** S
- **Depends on:** F1a-T02, F1a-T03
- **Files:** modify `server/prompts/grade.js`, `server/prompts/scenario.js`; create `tests/prompt-version.test.js`
- **Interfaces (ADR 0005 + Amendment 1; review B1, S5):**
  - Produces in `grade.js`: `export const VERSION = 1;` and `export const PROMPT = {id: 'grade', system: GRADE_SYSTEM, schema: GRADE_SCHEMA, render: (i) => gradeUserPrompt(i.scenario, i.stepId, i.errorStepId, i.explanation), fingerprintInputs: [4 inputs]}`. `GRADE_SCHEMA` is imported from `shared/contract.js` (import only, no contract change).
  - Produces in `scenario.js`: `export const VERSION = 1;` and `export const PROMPT = {id: 'scenario', system: SCENARIO_SYSTEM, schema: SCENARIO_SCHEMA, render: (i) => scenarioUserPrompt(i.key, i.entry, i.recentSummaries ?? [], i.rng), fingerprintInputs: [≥ 4 inputs]}`.
  - `fingerprintInputs` (synthetic content, none of the FR-038 seed words): grade = on-time catch, late catch (`stepId = errorStepId + 1`), false alarm (`errorStepId: null`), empty explanation. Scenario = with `criticalHints`, without `criticalHints`, with `twists`, with recent summaries; every scenario input has `rng: () => 0`.
  - Fingerprint algorithm (the one `promptFingerprint` in T08 must reproduce): `createHash('sha256')`, `update(system)`, `update(JSON.stringify(schema))`, then `update(render(i))` for each `fingerprintInputs` entry in order; `digest('hex')`.
  - `PROMPT_ID` is **not** exported (dropped per review B1). No existing export is renamed or removed.
- **Acceptance:** FR-027. `render(i)` returns exactly what `gradeUserPrompt` / `scenarioUserPrompt` return for the same arguments. No text, template or schema changes.
- **Tests that prove it:** `tests/prompt-version.test.js`: "every module in server/prompts except trades.js exports an integer VERSION ≥ 1 and PROMPT {id, system, schema, render, fingerprintInputs}" (the `trades.js` exclusion is by file name; T07 removes it when it deletes the file), "PROMPT ids are unique", "render equals the legacy function for every fingerprint input", "fingerprintInputs contain none of the FR-038 seed words (inline list)", "grade and scenario fingerprints equal the frozen hex values" (values computed from the pre-change text and pasted into the test).

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
      - `appendEvents(events: Event[]) → void`: one transaction; every event must pass `validateEvent`, otherwise it throws and writes nothing; on any error writes nothing.
      - `eventsForAttempt(attemptId: string) → Event[]`: `WHERE json_extract(context_json, '$.attemptId') = ?` exactly (so `event_attempt` is used), `ORDER BY seq`, JSON columns parsed.
      - `putCard(row: CardRow) → void` (INSERT OR IGNORE on `id`); `getCard(id: string) → CardRow | null` (`json` parsed into `card`).
      - `putPack({id, version, json: string, provenance: string}) → 'inserted' | 'same' | 'conflict'`: inserts if `(id, version)` is new; else compares `json` with the stored value.
      - `logLlmCall(row: LlmCallRow) → void`; `close()`.
    - `CardRow = {id, subject_id, subject_version, mode: 'stop', competency_id: null, mistake_types_json: null, subtlety: null, card: object, verify_json: null, status: 'ok', prompt_version: string|null, model: string|null, source: 'fixture'|'live', created_at}`. `LlmCallRow` = the `llm_call` columns (FR-026).
  - Migration `001-init.sql`: `event` (`seq INTEGER PRIMARY KEY`, columns per `data-and-evidence.md` §2), `subject_pack`, `card`, `llm_call`; `card` CHECKs `source IN ('fixture','live')` and `source <> 'live' OR (length(prompt_version) > 0 AND length(model) > 0)` (`prompt_version`, `model` nullable); triggers `event_no_update` and `event_no_delete` doing `SELECT RAISE(ABORT, 'event is append-only')`; index `event_attempt` on `json_extract(context_json, '$.attemptId')`.
  - Produces (`shared/events.js`, pure, browser-safe):
    - `VERBS` (the full `data-and-evidence.md` §1 vocabulary), `OUTCOMES` (§1's six outcomes).
    - `newId(prefix: 'evt'|'att'|'card'|'llm') → string`: `<prefix>_` + 26-char Crockford ULID (time + `crypto.getRandomValues`).
    - `makeEvent({verb, object, result = null, context, actor = 'learner_1', at = new Date().toISOString()}) → Event` with `id = newId('evt')`.
    - `validateEvent(e: unknown) → string[]` (empty = valid; any `VERBS` verb; checks `id`, `at`, `actor`, `object.type`, `object.id`, `context.subject`, `context.attemptId`, `context.promptVersions` is an object). Never throws.
    - `projectAttempt(events: Event[]) → {cardId: string|null, caughtStepIds: number[], lastStopStepId: number|null, stopsByStepId: {[stepId]: {stopped, explained, graded}}, completed: Event|null}`. `caughtStepIds` = every non-null `stopped.result.targetStepId` in `seq` order (today's browser rule, `web/app.js:160-169`); `lastStopStepId` = `object.step` of the last `stopped`.
  - `package.json`: `engines.node` → `">=22.13"`; `scripts.test` → `node --test "tests/**/*.test.js"`; add `scripts["check:ticket"]` → `node tests/tools/check-ticket.mjs` (the target file arrives in T11; harmless until then, review O1).
  - `.gitignore`: add `data/`.
  - `tests/helpers/server.mjs`: default env gains `DB_PATH: ':memory:'` (caller's env still overrides).
- **Acceptance:** FR-013 (db module), FR-014, FR-015, FR-017 (id format), FR-018, FR-041. Nothing calls the DB yet; golden replay is empty.
- **Tests that prove it:** `tests/db.test.js`: "node:sqlite is imported only in server/db.js" (grep over `server/`, `shared/`, `web/`, `scripts/`; B9), "migrations run once and set user_version to 1", "re-opening a migrated file DB runs nothing", "a failing migration throws [db] migration 001 failed and leaves user_version 0", "UPDATE on event throws append-only", "DELETE on event throws append-only", "live card with NULL or empty prompt_version or model is rejected", "fixture card with NULL stamps is accepted", "source other than fixture or live is rejected", "putCard is idempotent by id", "appendEvents writes all or nothing (an invalid second event leaves zero rows)", "eventsForAttempt returns only that attempt in seq order", "eventsForAttempt uses the event_attempt index (EXPLAIN QUERY PLAN)", "putPack returns inserted, same, conflict", "file DB is created with its directory and journal_mode wal", "DEFAULT_DB_PATH is absolute and under the repo root", "getDb before initDb throws". `tests/events.test.js`: "newId matches ^<prefix>_[0-9A-HJKMNP-TV-Z]{26}$ for evt, att, card, llm", "1000 ids are unique and the 10-char time prefix never decreases" (S2), "makeEvent fills id, at, actor", "validateEvent accepts every VERBS verb", "validateEvent rejects unknown verb, missing attemptId, missing subject", "validateEvent never throws on null, [], 'x' and a cyclic object" (B9), "projectAttempt returns cardId, caughtStepIds, lastStopStepId, stopsByStepId, completed".
- **Notes:** the `ExperimentalWarning` on stderr is expected; do not suppress it with a flag that changes behavior.

### F1a-T20 [P] Pack format v1: `pack.json` and `shared/pack.js`
- **Owner:** backend-engineer
- **Size:** S
- **Depends on:** F1a-T03
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
- **Tests that prove it:** `tests/pack-format.test.js`: "demo-trades pack.json validates", "validatePack never throws on null, [], 'x', a cyclic object and a 5 MB string" (B9), "validatePack rejects 3 tiers, a missing copy.falseAlarmFeedback, a fixture name with a slash", "ratingLabel maps all 5 keys to today's 5 strings" (B9; literals frozen in the test), "copy, severity, synonyms and scenario fields equal today's literals" (compared with imports of `trades.js`, `mock-grader.js` before T07 deletes them; frozen literals after).
- **Notes:** split from T07 by the size rule; it takes pure work off the backend critical path (review R1).

### F1a-T07 Pack loader, startup order and fixture move
- **Owner:** backend-engineer
- **Size:** M
- **Depends on:** F1a-T06, F1a-T20
- **Files:** create `packs/demo-trades/scenarios/electrical.json`, `packs/demo-trades/scenarios/brazing.json`, `packs/demo-trades/scenarios/brakes.json`, `server/packs.js`, `tests/pack.test.js`; modify `server/index.js`, `server/services/content.js`, `server/routes/scenarios.js`, `shared/contract.js`, `scripts/simulate.js`, `tests/contract.test.js`, `tests/validator.test.js`, `tests/scoring.test.js`, `tests/mock-grader.test.js`, `tests/game-balance.test.js`, `tests/helpers/http.mjs`, `tests/helpers/fake-claude.mjs`, `tests/prompt-version.test.js`, `tests/pack-format.test.js`; delete `server/prompts/trades.js`, `fixtures/scenarios/electrical.json`, `fixtures/scenarios/brazing.json`, `fixtures/scenarios/brakes.json`
- **Interfaces (ADR 0006 + Amendment 1, ADR 0001; review B4, B5, B6):**
  - Scenario files: today's `fixtures/scenarios/*.json` moved **byte-identical** (git move).
  - Produces (`server/packs.js`):
    - `loadPacks(dir = <ROOT>/packs, db = getDb()) → Map<string, Pack>`: for each `<dir>/<id>/pack.json`: `validatePack`; load every `fixture` and run `validateScenario` on it; then `db.putPack({id, version, json: canonicalJson({pack, scenarios: {<fixture>: <content>}}), provenance})`. Canonical JSON = keys sorted recursively, no whitespace. `'conflict'` → refuse the pack. Any failure → skip the pack with `console.warn('[packs] <dir name> skipped: <reason>')`. For each scenario of a loaded pack: `db.putCard({id: \`fx_${pack.id}_${pack.version}_${scenario.id}\`, subject_id: pack.id, subject_version: pack.version, card, prompt_version: null, model: null, source: 'fixture', …})`.
    - `getPack(id) → Pack | null` (own-key safe); `listSubjects() → [{id, title}]`; `listScenarios(packId) → [{id, label}] | null`; `getScenarioEntry(packId, scenarioId) → {id, label, brief, hazardHints, criticalHints?, twists?, card, cardId} | null` (own-key safe). `Pack = pack.json` fields with each scenario's `card` loaded.
  - Changes (`server/index.js`): before `listen`, `initDb()` then `loadPacks()`. If `initDb` throws, print its message to stderr and `process.exit(1)`; never listen. An invalid pack only warns.
  - Changes (`shared/contract.js`): adds `toPublicCard(card, {id, subject}) → {id, subject, title, setting, apprentice, steps: [{id, line}]}` (allow-list copy; never spreads or deletes). `validateScenario` no longer reads or checks `trade` (`opts.trade` removed). The header comment drops "journeyman" and the `trade` field. `SCENARIO_SCHEMA` and `GRADE_SCHEMA` unchanged.
  - Changes (`server/services/content.js`, `server/routes/scenarios.js`): legacy routes read the pack via `LEGACY_SUBJECT = 'demo-trades'` (removed by T18). `GET /api/trades` → `listScenarios(LEGACY_SUBJECT)`; `GET /api/scenario?trade=` → `getScenarioEntry`; live generation passes the flat entry as `trade`; the fixture path returns a deep copy of `entry.card`. Legacy JSON responses are unchanged for all three ids.
  - `scripts/simulate.js`: reads every `packs/*/pack.json` and plays each scenario's fixture (no pack id hard-coded); output table unchanged for demo-trades.
- **Acceptance:** FR-019 (scenarios half), FR-020 (loader, refusal), FR-013 (startup order), FR-015 (fixture ids, NULL stamps). Golden replay empty.
- **Changed tests:**
  - `tests/contract.test.js`: fixture dir → `packs/demo-trades/scenarios/`; "every trade points at an existing fixture" → "every pack scenario points at an existing fixture" (same assertion over `pack.scenarios`); `TRADES` import removed.
  - `tests/validator.test.js`: fixture dir and the `TRADES` loops read `pack.scenarios` (same assertions); "fixture passes the strict rules for its own trade" → "pack fixture passes the strict rules" (`validateScenario(s)` with no opts); **"J: trade mismatch is rejected…" deleted** (the check no longer exists; the server sets the subject).
  - `tests/scoring.test.js`, `tests/mock-grader.test.js`, `tests/game-balance.test.js`, `tests/helpers/http.mjs` (`loadFixture`), `tests/helpers/fake-claude.mjs` (`FIXTURE` constant): path only.
  - `tests/prompt-version.test.js`: the `trades.js` exclusion removed (setup only).
  - `tests/pack-format.test.js`: literals previously compared with `trades.js` / `mock-grader.js` imports are frozen inline (setup only, same values).
- **Tests that prove it:** `tests/pack.test.js`: "loadPacks twice writes one subject_pack row and three card rows fx_demo-trades_1_<id> with NULL stamps", "scenario files are byte-identical to the pre-T07 fixtures (sha256 frozen)", "pack entries render byte-identical scenario prompts to T02's snapshot", "an invalid pack in a temp dir is skipped and logged; the valid one still loads", "a changed pack.json without a version bump is refused" (B9), "a changed scenario file without a version bump is refused" (R3), "getScenarioEntry rejects __proto__, constructor, toString, hasOwnProperty", "toPublicCard returns exactly the public keys (deep key allow-list)", "server exits non-zero with [db] migration 001 failed and never listens" (spawn with `DB_PATH` pointing at a file that has `user_version 0` and a conflicting `event` table), "server with an invalid pack in PACKS still starts".
- **Notes:** `loadPacks`'s `dir` is overridable only through its parameter; tests call it directly (no env hook in product code).

### F1a-T08 AI gateway, prompt registry and `llm_call`
- **Owner:** backend-engineer
- **Size:** M
- **Depends on:** F1a-T05, F1a-T07
- **Files:** create `server/ai/gateway.js`, `server/ai/models.js`, `tests/gateway.test.js`; modify `server/services/ai-client.js`, `server/services/content.js`, `server/services/assessment.js`, `tests/llm-deadline.test.js`; delete `server/llm.js`
- **Interfaces (ADR 0005 + Amendment 1; review B1):**
  - Produces (`server/ai/models.js`): `MODEL`, `SCENARIO_EFFORT`, `GRADE_EFFORT` (same env defaults as `llm.js:9-12`), `SCENARIO_DEADLINE_MS` (env, default 40000), `GRADE_DEADLINE_MS` (env, default 8000).
  - Produces (`server/ai/gateway.js`):
    - `createGateway({client, logCall}) → {run}`.
    - `run({prompt, input, live, effort, deadlineMs, accept = () => [], fallback}) → Promise<{data, source: 'live'|'mock'|'fallback', meta: {promptVersion: string, model: string, ms: number, outcome}}>`. `prompt` is the prompt module namespace (`import * as gradePrompt from '../prompts/grade.js'`), so `run` reads `prompt.PROMPT` and `prompt.VERSION`; `promptVersion = \`${PROMPT.id}@${VERSION}\``. `fallback` is required: `run` rejects with `TypeError` if it isn't a function.
      - `live: false` → `data = await fallback()`, no request, outcome `mock`.
      - `live: true` → `client.messages.create({model: MODEL, system, messages: [{role:'user', content: PROMPT.render(input)}], output_config: {format: {type:'json_schema', schema: PROMPT.schema}}, …today's body from llm.js:35-49 incl. the server-side-fallback-2026-07-01 beta and fallbacks:'default'}, {signal: AbortSignal.timeout(deadlineMs), maxRetries: 1, headers: {'x-prompt-id': promptVersion}})`; parse with `responseText`; `accept(data)` problems, a throw, a refusal or an abort → `data = await fallback()`.
      - Outcome: `ok`, `timeout` (abort), `refusal` (`stop_reason === 'refusal'`), `fallback` (anything else, including `accept` problems), `mock`.
      - Exactly one `logCall(row)` per `run()`: `{id: newId('llm'), at, pipeline: PROMPT.id, prompt_version: promptVersion, model: response.model ?? MODEL, ms, input_tokens, output_tokens, cache_read: usage.cache_read_input_tokens ?? 0, cost_usd: null, outcome}` (tokens 0 when there was no response). A throwing `logCall` is caught and `console.warn`ed and never changes the result.
      - Console lines unchanged (BRAIN-08): `[claude] <promptId> <ms> ms <model> <stop_reason> <in>/<out> tokens <id>` and `[claude] <promptId> failed after <ms> ms status=… request=…: …`.
    - `promptFingerprint(promptModule.PROMPT) → string` (T05's algorithm); `responseText(content) → string` (moved verbatim).
  - Changes (`server/services/ai-client.js`): exports `MOCK`, and `gateway = createGateway({client, logCall: (row) => getDb().logLlmCall(row)})`, where `client` is built exactly as `llm.js` builds it today (`null` in MOCK). No other module constructs a client.
  - Changes (`server/services/content.js`, `server/services/assessment.js`): the legacy scenario and grade paths call `gateway.run` with `live: !MOCK`, the deadline constants, `accept` = `validateScenario` problems (scenario) or today's clamp plus non-empty feedback check (grade), and `fallback` = today's fixture card / `mockGrade` call. Route `source` mapping (FR-029): grade `live → "live"`, `mock → "mock"`, `fallback → "mock-fallback"`; scenario `live → "live"`, `mock → "fixture"`, `fallback → "fixture-fallback"`. Legacy responses are unchanged.
- **Acceptance:** FR-024, FR-025, FR-026, FR-027 (fingerprint), FR-029 (legacy paths); SC-007, SC-008 (existing deadline tests keep their thresholds).
- **Changed tests:** `tests/llm-deadline.test.js`: import of `responseText` from `../server/llm.js` → `../server/ai/gateway.js` (import only; no assertion changes).
- **Tests that prove it:** `tests/gateway.test.js`: unit (injected fake `client` and `logCall`): "run without fallback rejects with TypeError", "live:false calls fallback, sends nothing and logs outcome mock", "accept problems (empty feedback, invalid scenario) give outcome fallback and the fallback data" (B9), "abort gives outcome timeout", "refusal gives outcome refusal", "a throwing logCall does not change the result", "exactly one logCall per run", "promptFingerprint equals T05's frozen values"; static: "messages.create appears only in server/ai/gateway.js, which contains maxRetries: 1 and AbortSignal.timeout" (B9); server (`DB_PATH` temp file): "every request carries x-prompt-id grade@1 or scenario@1" (a minimal header-capture server inside the test, since fake Claude routes on headers only after T09), "happy LIVE grade writes one llm_call row ok with tokens 1234/321", "LIVE hang writes outcome timeout and the grade falls back within 2.5 s at GRADE_DEADLINE_MS=1500", "500 writes outcome fallback", "MOCK grade on the legacy route writes one llm_call row with outcome mock and prompt_version grade@1" (B9), "the [claude] console line format is unchanged".
- **Notes:** `server/llm.js` must have no importer left (grep in the PR). `server/ai/*` must contain no deny-listed word (drop the "trade hazard" example from the `llm.js:42` comment).

### F1a-T09 [P] fake Claude routes on `x-prompt-id`
- **Owner:** qa-engineer
- **Size:** S
- **Depends on:** F1a-T08
- **Files:** modify `tests/helpers/fake-claude.mjs`; create `tests/fake-claude-routing.test.js`
- **Interfaces:**
  - Consumes: header `x-prompt-id: <promptId>@<VERSION>` (T08).
  - Produces: `kind` = the header's part before `@` (`"grade"` | `"scenario"`); `/__log` entries gain `promptId` (the full header value) and keep T03's `system` and `schemaSha256`. A request without the header gets HTTP 500 `{type:'error', error:{type:'api_error', message:'stub: missing x-prompt-id'}}` and a log entry with `kind: null`. Schema sniffing (`fake-claude.mjs:72`) is removed; header comment updated.
- **Acceptance:** FR-040; spec US5 scenario 5.
- **Tests that prove it:** `tests/fake-claude-routing.test.js`: "grade call is logged with kind grade and promptId grade@1", "scenario call is logged with kind scenario", "request without x-prompt-id gets 500 and is logged", "log entries carry system and schemaSha256"; `tests/server.test.js` kind assertions still hold (full suite).
- **Notes:** closes QA's 0003 RISK on silent misrouting. The PR acknowledges the two backend helper edits (T06, T07) as recorded exceptions (review S10).

### F1a-T10 [P] Deny-list ratchet
- **Owner:** qa-engineer
- **Size:** S
- **Depends on:** F1a-T08
- **Files:** create `tests/fixtures/deny-list.json`, `tests/fixtures/deny-list-allow.json`, `tests/deny-list.test.js`
- **Interfaces:**
  - Produces: `deny-list.json` = `{words: string[]}` with at least the FR-038 seed; `deny-list-allow.json` = `[{file, word, count}]` generated from the tree after T07 and T08.
- **Acceptance:** FR-037, FR-038. Scans `server/`, `shared/`, `web/`, `scripts/` (all file types), excluding `packs/`, `fixtures/`, `tests/`, `node_modules/`; case-insensitive; word boundaries (a multi-word entry matches with any whitespace between words). Fails on an unlisted hit, and on a listed count above the actual count, with a message naming file, word and both counts.
- **Tests that prove it:** `tests/deny-list.test.js`: "no unlisted subject words in engine code", "allow-list counts match exactly (shrink the list when you remove a word)", "matcher: word boundaries (fetchTrades is not a hit, trade-select is)", "matcher: case-insensitive, multi-word phrases".
- **Notes:** lands after T07/T08 so the first allow-list reflects the post-Wave-1 tree. From here on, see the ratchet rule at the top.

### F1a-T11 [P] File-ownership test and `check:ticket`
- **Owner:** qa-engineer
- **Size:** S
- **Depends on:** F1a-T06
- **Files:** create `tests/ownership.test.js`, `tests/tools/check-ticket.mjs`
- **Interfaces (review OI-7; founder DECISION on OI-8 in thread 0003, rows now in `CLAUDE.md`):**
  - `tests/ownership.test.js` parses the "File ownership" table in `CLAUDE.md` into `[{glob, owner, except: string[]}]`. Parse rules: each backticked token in the Path cell is a glob; `<id>` means one path segment; a token without `/` is relative to the directory of the previous token in the same cell (`docs/specs/<id>/spec.md`, `tasks.md`); tokens inside "(except …)" are exclusions of the preceding glob; `dir/` and `dir/**` mean everything below `dir`. Owner = the first backticked role in the Owner cell, else its first word lowercased (`everyone`, `founder`).
  - Paths: `git ls-files -co --exclude-standard`. If `git` is missing or exits non-zero: walk the filesystem excluding `.git/`, `node_modules/` and the plain line patterns in `.gitignore`, call `t.diagnostic('ownership: git unavailable, used filesystem walk')`, and still assert. Never `skip`.
  - `node tests/tools/check-ticket.mjs <ticketId> [--base <ref>]` (default base `main`): reads the ticket's `Files:` line from `docs/specs/*/tasks.md`; changed files = `git diff --name-only <base>` plus `git ls-files -o --exclude-standard`; exit 0 when all are listed (the `deny-list-allow.json` ratchet edit and QA's `todo` removals in `tests/acceptance/F1a.test.js` always allowed), exit 1 listing each extra file, exit 2 with `git unavailable: list changed files by hand in the QA report` when git is missing or fails. Not part of `npm test`.
- **Acceptance:** FR-039. The test fails if the table can't be parsed or any path has zero or more than one owner.
- **Tests that prove it:** `tests/ownership.test.js`: "CLAUDE.md ownership table parses", "every listed path has exactly one owner", "unowned path is reported" (synthetic list), "path matching two rows is reported" (synthetic), "without git: filesystem walk with a diagnostic, never skipped" (runs the lister with `PATH` emptied), "check-ticket exits 2 without git".
- **Notes:** unblocked by the founder's OI-8 DECISION. If a real tracked path is still unowned, file it as a bug against this spec (PM), don't edit `CLAUDE.md`. T19 depends on this ticket so it can't slip out of F1a.

## Group 2 (Wave 2): server-owned cards and web switch-over

### F1a-T12 Subjects, scenario list, attempt start and card persistence
- **Owner:** backend-engineer
- **Size:** M
- **Depends on:** F1a-T09, F1a-T10
- **Files:** create `server/routes/attempts.js`, `server/routes/subjects.js`, `server/services/session.js`, `tests/attempts.test.js`; modify `server/index.js`, `server/routes/scenarios.js`, `server/services/content.js`
- **Interfaces (ADR 0003 + Amendment 1; review OI-6, S4):**
  - Consumes: `getPack`, `listSubjects`, `listScenarios`, `getScenarioEntry` (T07); `toPublicCard` (T07); `gateway`, `MOCK` (T08); `getDb()`, `newId`, `makeEvent` (T06); `scenario` prompt module (T05).
  - Produces:
    - `GET /api/subjects` → 200 `[{id, title}]` (`listSubjects()`).
    - `GET /api/scenarios?subject=<packId>` → 200 `[{id, label}]`; unknown, missing or non-own-key subject → 400 `{error}`.
    - `POST /api/attempts` body `{subject, scenario, source?: "fixture"}` → 200 `{attemptId, card: PublicCard, source}`; 400 for unknown or non-own-key `subject`/`scenario`, a non-object body or a `source` other than `"fixture"`; 413 over 1 MB.
    - `content.cardForAttempt(subjectId, scenarioId, source) → Promise<{card, cardId, source: 'live'|'fixture'|'fixture-fallback', promptVersions}>`. `source === 'fixture'` → the fixture card, no `run()`, `promptVersions: {}`. Otherwise `gateway.run({prompt: scenarioPrompt, input: {key, entry, recentSummaries}, live: !MOCK, effort: SCENARIO_EFFORT, deadlineMs: SCENARIO_DEADLINE_MS, accept: validateScenario, fallback: () => fixture card})`; on gateway `live`, `db.putCard({id: newId('card'), …, prompt_version: meta.promptVersion, model: meta.model, source: 'live'})` **before** returning; source mapping per FR-029. `promptVersions = {scenario: meta.promptVersion}` when `meta.outcome !== 'mock'`, else `{}`.
    - `server/services/session.js`: `createSession({db, packs, gateway, mock}) → Session` (dependencies injected so tests can pass a fake `db` or `gateway`) and `getSession() → Session` (memoised default from `getDb()`, `server/packs.js`, `ai-client.js`). `Session.startAttempt({subjectId, scenarioId, source}) → Promise<{attemptId, card: PublicCard, source}>`: `attemptId = newId('att')`; appends one `started` with `db.appendEvents([…])`: `object {type:'card', id: cardId}`, `result {source}`, `context {subject: \`${pack.id}@${pack.version}\`, attemptId, promptVersions}`. No version string is hard-coded in `server/`.
  - `card.subject` is the pack id (`"demo-trades"`); `card.id` is `fx_demo-trades_1_<scenarioId>` or `card_<ULID>`.
- **Acceptance:** FR-001, FR-002, FR-003, FR-010 (start route), FR-011 (start route), FR-016 (`started`), FR-017, FR-029 (start), FR-035. `/api/health` unchanged. Legacy routes untouched. Golden replay empty.
- **Tests that prove it:** `tests/attempts.test.js`: "GET /api/subjects returns [{id:'demo-trades', title}]", "scenarios list equals the legacy /api/trades list", "unknown and prototype-key subjects/scenarios get 400", "start returns exactly the public card keys (deep key allow-list) and passes leakScan", "MOCK start: card.id fx_demo-trades_1_electrical, card.subject demo-trades", "two starts on the same card get different attemptIds", "MOCK start writes one started event with subject demo-trades@1 and promptVersions {} and one llm_call row scenario@1 outcome mock", "LIVE start with source fixture writes no llm_call row and promptVersions {}" (B9), "LIVE start writes the card row (source live, scenario@1, non-empty model) before responding and started.promptVersions {scenario:'scenario@1'}", "LIVE hang falls back to fixture-fallback within 3 s at SCENARIO_DEADLINE_MS=2000, llm_call outcome timeout, started.promptVersions {scenario:'scenario@1'}", "invalid live scenario falls back, llm_call outcome fallback, no card_ row", "/api/health body has no new keys".
- **Notes:** lower `deny-list-allow.json` counts only if this ticket removes a hit.

### F1a-T13 STOP route: server-side resolution, grading and scoring
- **Owner:** backend-engineer
- **Size:** M
- **Depends on:** F1a-T12
- **Files:** modify `server/routes/attempts.js`, `server/services/session.js`, `server/services/assessment.js`, `shared/mock-grader.js`, `shared/contract.js`, `tests/mock-grader.test.js`; create `tests/stops.test.js`
- **Interfaces (ADR 0002 + 0003, both with Amendment 1; review B2, B8, B12, S9):**
  - Consumes: `resolveStop`, `scoreStop`, `RULES` (`shared/scoring.js`, unchanged); `projectAttempt` (T06); `gateway` and the `grade` prompt module (T05, T08); `getPack(id).grading`, `.copy` (T07).
  - Produces:
    - `POST /api/attempts/:attemptId/stops` body `{stepId: integer, explanation: string}` → 200 `{verdict, reasoningScore, feedback, source, points, total, caught: null | {errorStepId, stepsLate, severity, correctAction}}`; 400 bad body, `stepId` not in the card, or position before the last graded STOP's position; 404 unknown or malformed attempt; 409 after complete or while a STOP is in flight; 413 over 1 MB; 500 `{error:"server error"}` only when `appendEvents` throws.
    - `session.planStop(card, projection, stepId) → {kind: 'replay'} | {kind: 'reject', status: 400 | 409, error: string} | {kind: 'grade', idx: number, target: {errorStepId, stepsLate} | null}` (pure, exported for tests). Runs FR-007 checks 1–4 in order using `idx = card.steps.findIndex(s => s.id === stepId)` and the last graded STOP's position; for `grade`, `target = resolveStop(card, idx, new Set(projection.caughtStepIds))`.
    - `Session.submitStop(attemptId, {stepId, explanation}) → Promise<StopResponse>`: `projectAttempt(db.eventsForAttempt(attemptId))`; `planStop`; `replay` → body rebuilt from the stored `stopped` and `graded` events plus the card (`total` = sum of `graded.result.points` up to and including that STOP in `seq` order); in-flight check (module `Map<attemptId, true>`; present → 409); set the mark; grade via `assessment.gradeStop`; score with `scoreStop`; then **one** `db.appendEvents([stopped, explained, graded])`; release the mark in `finally` with `inFlight.delete(attemptId)`. Nothing is written before the grade is known.
    - Event results: `stopped.result {targetStepId: errorStepId | null, stepsLate: 0 | 1 | null}`; `explained.result {text, chars}` (≤ 2000); `graded.result {verdict, reasoningScore, graderSource, outcome, points, latencyMs, feedback}` with `outcome` per the spec's precedence; `graded.context.promptVersions = {grade: meta.promptVersion}` when `meta.outcome !== 'mock'`, else `{}`; `{}` on `stopped` and `explained`. `object = {type:'card', id: cardId, step: stepId}`.
    - `assessment.gradeStop({card, stepId, errorStepId, explanation, pack}) → Promise<{verdict, reasoningScore, feedback, source, outcome, promptVersion, latencyMs}>`: today's `grade()` logic (`index.js:87-108`) through `gateway.run` with `fallback = () => mockGrade(card, errorStepId, explanation, {synonyms: pack.grading?.synonyms ?? {}, falseAlarmFeedback: pack.copy.falseAlarmFeedback})`; the server-decides-false-alarm rule (FR-006). The legacy `grade(body)` passes the demo-trades lexicon so the legacy route keeps today's verdicts.
    - `mockGrade(scenario, errorStepId, explanation, lexicon = {synonyms: {}, falseAlarmFeedback: 'That step was fine.'}) → {verdict, reasoningScore, feedback}`: the `SYNONYMS` constant and its subject comments removed.
    - `shared/contract.js`: header comment documents PublicCard, StopRequest, StopResponse, CompleteRequest, CompleteResponse (spec FR-001, FR-004, FR-005, FR-008); no code change.
- **Acceptance:** FR-004, FR-005, FR-006, FR-007, FR-010, FR-011 (STOP), FR-016 (STOP triplet), FR-018, FR-022, FR-029 (grade).
- **Changed tests:** `tests/mock-grader.test.js`: every `mockGrade(x, id, t)` → `mockGrade(x, id, t, DEMO_LEXICON)` where `DEMO_LEXICON` is read from `packs/demo-trades/pack.json` (setup only; every assertion unchanged).
- **Tests that prove it:** `tests/stops.test.js`: "on-time catch: caught has exactly errorStepId, stepsLate, severity, correctAction", "one-late STOP credits the earlier mistake with stepsLate 1 and marks it by errorStepId", "false alarm: caught null, verdict false_alarm, -75, passes leakScan", "already-caught mistake is not credited twice (double-stop)", "points equal scoreStop and total is cumulative", "same stepId returns the identical body and writes no events", "two concurrent STOPs: one 200, one 409, one graded event" (gateway stub that resolves after 100 ms; B8), "in-flight mark is released after a failed grade (next STOP is accepted)" (S9), "position before the last STOP gets 400 and no events", "planStop with non-ascending ids [1,2,3,5,4,6,7,8,9]: stepId 5 then 4 is accepted and resolveStop gets the position" (B12), "stepId 0, 99, '3', null get 400", "unknown attempt 404", "STOP after complete 409", "explanation over 2000 chars is truncated before grading and in explained.result.text", "an aborted grade writes no STOP events and the same STOP is then graded once" (gateway stub that rejects; B2, B9), "appendEvents throwing answers 500, writes nothing and the next request still works" (fake `db`), "server killed mid-grade: after restart on the same DB there is no stopped/explained/graded for that STOP" (US4.5), "a STOP writes exactly stopped, explained, graded in one seq run with the ADR result shapes", "MOCK graded.context.promptVersions is {} and LIVE is {grade:'grade@1'}", "live: model false_alarm on a real mistake becomes wrong", "live hang falls back to mock-fallback within 2.5 s", "MOCK verdicts for demo-trades equal the legacy /api/grade verdicts (3 cards × every step × 4 explanations)".
- **Notes:** the browser still imports `mockGrade` until T17; its 3-argument call keeps working with the subject-free default.

### F1a-T21 [P] Rating keys and Option B scoring in `shared/scoring.js`
- **Owner:** backend-engineer
- **Size:** S
- **Depends on:** F1a-T07
- **Files:** modify `shared/scoring.js`; create `tests/not-graded.test.js`, `tests/rating-keys.test.js`
- **Interfaces (ADR 0006 Amendment 1; spec FR-021, FR-047; review B4, B10):**
  - `RULES.ratingTiers = [0.85, 0.6, 0.3]` (today's thresholds, moved).
  - `notGradedStepIdsFor(card, skippedStepIds: number[], caughtStepIds: number[], rules = RULES) → number[]`: walk the skipped ids in position order; for each, `resolveStop(card, position, new Set([...caught, ...notGradedSoFar]), rules)`; each non-null `errorStepId` is added.
  - `scoreRun(scenario, events, rules = RULES, {notGradedStepIds = []} = {})`: the second parameter is unchanged. Adds `ratingKey ∈ RATING_KEYS` (`missedCritical` when a critical mistake is truly missed, else `tier0`–`tier3` by `rules.ratingTiers`). A not-graded mistake gets no missed penalty, is left out of `maxPossible` and `missedCritical`, stays in `mistakeCount`, and appears in `missed[]` in step order with `notGraded: true` and `points: 0`. The legacy `rating` string stays until T18.
- **Acceptance:** FR-021 (key half), FR-047. With `notGradedStepIds` empty, every existing output field equals today's.
- **Tests that prove it:** `tests/rating-keys.test.js`: "every fixture × simulate player gives the ratingKey whose demo-trades label (ratingLabel) equals today's rating string". `tests/not-graded.test.js`: "skip on the critical line: notGradedStepIdsFor returns [3]", "skip on a clean line returns []", "skip one line after a mistake (within graceSteps) returns that mistake", "two mistakes within reach: only the one resolveStop would credit", "an already-caught mistake is never not graded", "scoreRun with notGradedStepIds [3] on electrical never-stop: total -100, maxPossible 300, missedCritical false, ratingKey tier3, line 3 item notGraded true and points 0", "all three not graded: maxPossible 0, ratingKey tier3", "empty notGradedStepIds equals today's scoreRun for all fixtures × simulate players". Existing `tests/scoring.test.js` passes unchanged.
- **Notes:** [P] with T12 and T13 (no shared files). Whether `notGraded` crosses the wire is OI-13 (T14); computing it is decided (review B10).

### F1a-T14 Complete route with `skippedStepIds`
- **Owner:** backend-engineer
- **Size:** M
- **Depends on:** F1a-T13, F1a-T21. **Merge blocked on spec OI-13** ([ARCH DECISION NEEDED]) for the three fields marked below; everything else may be built and reviewed now.
- **Files:** modify `server/routes/attempts.js`, `server/services/session.js`; create `tests/complete.test.js`
- **Interfaces (ADR 0002 + 0003, both with Amendment 1; review B3, B10, B12):**
  - `POST /api/attempts/:attemptId/complete` body `{lastStepShown: integer, skippedStepIds?: integer[]}` → 200 `{total, maxPossible, caughtCount, mistakeCount, falseAlarms, missedCritical, ratingKey, ratingLabel, cleanRunLine, missed: [{stepId, severity, summary, consequence, correctAction, points, notGraded?}], skippedStepIds}`. `notGraded: true` on items (OI-13 a) and the `skippedStepIds` echo of the effective ids (OI-13 c) are the PM proposal. 404 unknown or malformed attempt; 400 per the validation below.
  - `Session.completeAttempt(attemptId, {lastStepShown, skippedStepIds = []}) → Promise<CompleteResponse>`:
    - **Already completed** → body recomputed from the card, the events (including the stored `completed.result.skippedStepIds`) and the pack; the request values are ignored; nothing written.
    - **Validation (first call):** `lastStepShown` is a step id of the card whose position is ≥ the last graded STOP's position; `skippedStepIds` is an array of unique integer step ids of the card, each at a position ≤ `lastStepShown`'s position. Otherwise 400, nothing written.
    - **Effective skips** = `skippedStepIds` minus ids with a graded STOP. `notGradedStepIds = notGradedStepIdsFor(card, effective, caughtStepIds)`; `scoreRun(card, stops, RULES, {notGradedStepIds})`; `ratingLabel(pack.ratings, ratingKey)`; `cleanRunLine = pack.copy.cleanRun`.
    - Writes **one** `db.appendEvents([stepShown, completed])`: `step-shown` with `object.step = lastStepShown` and `result: null`; `completed.result {total, maxPossible, caughtCount, mistakeCount, falseAlarms, ratingKey, missedStepIds, skippedStepIds: effective}` plus `notGradedStepIds` (OI-13 b; `missedStepIds` excludes not-graded ids under the proposal). Both events have `promptVersions: {}`.
  - `why` and `keywords` never appear.
- **Acceptance:** FR-008, FR-009, FR-016 (complete pair), FR-021 (`ratingLabel` on the wire), FR-043, FR-047 (wire).
- **Tests that prove it:** `tests/complete.test.js`: "never-stop run: ratingKey missedCritical, label Someone got hurt, three missed items with exactly the six keys", "perfect run: tier0, label Journeyman eyes, cleanRunLine Clean job. Nobody got hurt.", "values equal scoreRun on the stored card", "complete never sends why or keywords", "second complete returns the identical body; one step-shown, one completed", "STOP after complete gets 409", "lastStepShown not a step id, or at a position before the last STOP, gets 400", "one full attempt (2 STOPs) writes exactly started, 2 × (stopped, explained, graded), step-shown (step = lastStepShown, result null), completed in seq order, and every event passes validateEvent" (B3, B9), "projectAttempt rebuilds total, caughtCount and falseAlarms of the first body" (US4.4), "skip on line 3 after a failed STOP: completed.result.skippedStepIds [3], line 3 item notGraded, total -100, maxPossible 300, ratingKey tier3" (B9, B10), "skip on a clean line: no penalty, nothing notGraded, skippedStepIds kept", "skip then a late STOP that credits the mistake: caught, not notGraded", "skipped id that has a graded STOP is dropped from completed.result.skippedStepIds and from the echo", "missing skippedStepIds is stored as []", "skippedStepIds non-array, non-integer, unknown id, duplicate or after lastStepShown gets 400 and writes nothing", "repeat complete with different skippedStepIds returns the first body".
- **Notes:** if the architect declines OI-13 (a), drop `notGraded` from the wire and the browser labels items itself; (b) drop `notGradedStepIds`; (c) drop the echo. Each is a field removal plus its test.

### F1a-T15 [P] `web/speech/` facade, zero behavior change
- **Owner:** frontend-engineer
- **Size:** S
- **Depends on:** F1a-T03
- **Files:** create `web/speech/index.js`, `web/speech/web-speech.js`; modify `web/app.js` (imports and the renamed calls only); delete `web/speech.js`
- **Interfaces:**
  - Produces (`web/speech/index.js`): `speak(text, {enabled = true, rate = 1.05} = {}) → Promise<void>`; `listen({onInterim} = {}) → {result: Promise<string>, stop()}`; `onHotword(phrases: string[], handler: (phrase) => void) → () => void` (no-op in F1); `cancel()` (today's `stopSpeaking`: cancels speech **and** the pending `wait`); `wait(ms) → Promise<void>`; `capabilities = {canSpeak: boolean, canListen: boolean, hotword: false}`.
  - `web/speech/web-speech.js`: today's `web/speech.js` implementation (provider), imported only by `index.js`.
  - `web/app.js`: `import { speak, cancel, wait, capabilities, listen } from './speech/index.js'`; `stopSpeaking()` → `cancel()`; `canListen` → `capabilities.canListen`. No other line changes.
- **Acceptance:** FR-034, FR-036.
- **Tests that prove it:** `node tests/golden/run.mjs --replay` empty (all 48 MOCK runs, voice and text); real-browser check in Chrome, voice and text, at 390 and 1280 px, zero console errors (screenshots in the PR).
- **Notes:** may run any time after T03, in parallel with T12–T14 and T21 (`web/speech.js` has no deny-list hits). Must merge before T17.

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
- **Tests that prove it:** the ported files pass against the F1a build; the old-route versions are deleted in this ticket.
- **Notes:** parallel with T17 (no shared files). Must merge before T18 removes the old routes.

### F1a-T17 Web switch-over: no answers, no grading in the browser, Skip and results states
- **Owner:** frontend-engineer
- **Size:** M
- **Depends on:** F1a-T14, F1a-T15. Same OI-13 merge block as T14 for the `notGraded` and `skippedStepIds` fields it reads.
- **Files:** modify `web/app.js`, `web/api.js`, `web/index.html`, `web/styles.css`
- **Interfaces:**
  - Consumes: `GET /api/subjects`, `GET /api/scenarios?subject=`, `POST /api/attempts`, `POST /api/attempts/:attemptId/stops`, `POST /api/attempts/:attemptId/complete` (T12–T14).
  - Produces (`web/api.js`, no import of `/shared/*`): `fetchSubjects() → [{id, title}]`; `fetchScenarios(subject) → [{id, label}]`; `startAttempt({subject, scenario, cached}) → {attemptId, card, source}` (live first with `AbortSignal.timeout(50000)`, then `source:'fixture'` reported as `fixture-fallback` on failure, as today); `postStop(attemptId, {stepId, explanation}) → StopResponse` (12 s timeout; throws `GraderUnreachableError` with `status: number | null` on network error, timeout or any non-2xx); `completeAttempt(attemptId, {lastStepShown, skippedStepIds}) → CompleteResponse` (12 s timeout; throws `ResultsUnreachableError`).
  - `web/app.js`:
    - `game = {attemptId, card, stepIndex, total, pendingStop: {stepId} | null, skippedStepIds: number[], graderFailures: number}`; no `steps[].error`, no `caught` set, no `events`. The subject id is `subjects[0].id` (never a literal in `web/`).
    - Setup `<option>`s are built with `document.createElement('option')`, `.value = id`, `.textContent = label` (FR-045, review B7).
    - `submitExplanation` → `postStop`; `isCatch = r.caught !== null`; `markLine(isCatch ? r.caught.errorStepId : stepId, …)`; score = `r.total`; fix text `" Here's the right way: " + r.caught.correctAction` appended only when `r.caught !== null && r.verdict !== 'correct'` (review S6). `GRADE_SOURCE['local-fallback']` removed.
    - `graderErrorText(repeat: boolean) → string` returns the copy-table text. On `GraderUnreachableError`: `graderFailures += 1`; show `#grader-error` with `graderErrorText(graderFailures > 1)`, the explanation textbox stays visible with its content, buttons `#retry-grade-btn` "Try again" and `#skip-stop-btn` "Skip this stop"; speak the same string once when "Read aloud" is on. Focus: "Try again" on a first failure with `status === null` or ≥ 500; "Skip this stop" on a 4xx or when `graderFailures > 1`. "Try again" re-sends the textbox's current content for the same `stepId`. "Skip this stop" pushes `stepId` onto `skippedStepIds` (unique), resets `graderFailures`, closes the panel and resumes narration at the next line. A success resets `graderFailures`.
    - `finish` is async: `completeAttempt(attemptId, {lastStepShown: <last shown step id>, skippedStepIds})`. On failure: `#results-error` with the copy-table text, `#retry-results-btn` "Retry results" focused, `#again-btn` visible, spoken once per showing. On success: rating from `ratingLabel`; summary from the values; each `missed[]` item rendered with `escapeHtml` as "{severity} · missed · {points} pts", or "{severity} · not graded" when `notGraded`; then summary, consequence and "Should have" lines.
    - `runEndLine(result) → string | null` (FR-046, review OI-9): the critical, else first, item without `notGraded` → `"Here's what happened next. " + consequence`; else `null` if any item is `notGraded`; else `result.cleanRunLine`.
    - `resultsNote(n) → string | null`: `null` for `n = 0`; `"1 stop wasn't graded, so it isn't in your score."`; `"{n} stops weren't graded, so they aren't in your score."` for `n ≥ 2`. `n = result.skippedStepIds.length` (OI-13 c; if declined, `game.skippedStepIds.length`). Shown in `#results-note` via `textContent`; in voice mode spoken after `runEndLine` (when not null).
  - `web/index.html`: `id="trade-select"` → `id="scenario-select"`; markup for `#grader-error`, `#results-error`, `#results-note`. No other copy changes (see spec Later).
- **Acceptance:** FR-030, FR-031, FR-032, FR-033, FR-035, FR-036, FR-042, FR-044, FR-045, FR-046; US1–US3 in voice and text mode; removes every deny-list hit in `web/` (lower `deny-list-allow.json` to zero for `web/`).
- **Tests that prove it:** `node tests/golden/run.mjs --replay`: empty diff except the 4 allow-listed runs; `node tests/e2e/F1a.e2e.mjs`: US1–US3 scenarios (voice and text) pass, including US2.5–US2.14; "a scenario label containing <b>x</b> is shown literally" (`page.route` on `/api/scenarios`; B7); leak check in the browser (no `/api/*` response before each STOP response contains an answer field; `localStorage` empty); zero console errors at 390 and 1280 px (screenshots in the PR).
- **Notes:** no browser-side grading in any form (A3); offline queueing is F2. The two failure states (grader unreachable, results unreachable) are the only intended learner-visible changes outside failure runs.

### F1a-T18 Remove the legacy routes, finish the engine-code sweep, update the README
- **Owner:** backend-engineer
- **Size:** M
- **Depends on:** F1a-T16, F1a-T17
- **Files:** modify `server/index.js`, `server/routes/scenarios.js`, `server/services/content.js`, `server/services/assessment.js`, `shared/scoring.js`, `scripts/simulate.js`, `README.md`, `tests/scoring.test.js`, `tests/game-balance.test.js`, `tests/fixtures/deny-list-allow.json`; delete `server/routes/grade.js`
- **Interfaces:**
  - Removes: `GET /api/trades`, `GET /api/scenario`, `POST /api/grade` (→ 404 via the dispatcher's fallback); `LEGACY_SUBJECT`; `getScenario`; the `scenario.trade = …` stamp; legacy `grade(body)`; `scoreRun().rating` and every rating label string in `shared/scoring.js`.
  - `scripts/simulate.js`: prints `ratingLabel(pack.ratings, r.ratingKey)` for the pack each card came from; `PLAYERS` and `playRun` signatures unchanged.
  - `README.md` (`README.md:24-25, 45, 52, 111`; review S7): the diagram and API sections document `GET /api/subjects`, `GET /api/scenarios`, `POST /api/attempts`, `…/stops`, `…/complete`; `local-fallback` removed from the source list; `llm.js` → `server/ai/gateway.js`.
- **Acceptance:** FR-012, FR-021 (labels gone), FR-048 (route strings), SC-002 (route half), SC-003.
- **Changed tests:**
  - `tests/scoring.test.js`: `r.rating === 'Someone got hurt'` → `r.ratingKey === 'missedCritical'`; `r.rating === 'Journeyman eyes'` → `r.ratingKey === 'tier0'`.
  - `tests/game-balance.test.js`: `r.rating === <label>` → `ratingLabel(DEMO.ratings, r.ratingKey) === <same label>` for every rating assertion (labels unchanged; `DEMO` read from the pack).
- **Tests that prove it:** "legacy routes return 404" (in `tests/acceptance/F1a.test.js`, `todo` removed by QA); `tests/deny-list.test.js` green with SC-003's allow-list; full `npm test` green; golden replay as in T17.

### F1a-T19 Guardrails, answer-leak test and F1a exit evidence
- **Owner:** qa-engineer
- **Size:** S
- **Depends on:** F1a-T18, F1a-T11
- **Files:** create `tests/no-answer-leak.test.js`, `tests/guardrails.test.js`, `docs/specs/F1a-server-owned-cards/qa-report.md`; modify `tests/acceptance/F1a.test.js` (remove remaining `todo` markers)
- **Interfaces:**
  - Consumes: `leakScan` (T01); all F1a routes.
- **Acceptance:** FR-011, FR-030, FR-048, SC-001–SC-005, SC-010, SC-011.
  - The leak test plays every demo-trades card in MOCK and LIVE-against-fake-Claude, with every STOP pattern from the golden scripts, and asserts `leakScan` is empty on every response before the crediting STOP and on every false-alarm response; that `caught` holds only the credited mistake; that `/packs/demo-trades/pack.json`, `/../packs/demo-trades/pack.json`, `/shared/../packs/demo-trades/pack.json` and `/packs/demo-trades/scenarios/electrical.json` return 403 or 404; and that the three legacy routes return 404.
  - Final evidence: `node tests/golden/run.mjs --replay --repeat 3` exit 0; fresh `npm test` with `# fail 0`, `# todo 0`, `# skipped 0`; `deny-list-allow.json` matches SC-003; `node tests/e2e/F1a.e2e.mjs` passes; `npm run check:ticket` output (or the exit-2 manual list) for each ticket. All quoted in `qa-report.md` with separate Functional and AI-quality verdicts.
- **Tests that prove it:** `tests/no-answer-leak.test.js`: "no answer field before the crediting STOP (3 cards × MOCK/LIVE × scripts)", "false-alarm responses reference no mistake", "pack and scenario files are not served", "legacy routes are gone". `tests/guardrails.test.js` (B9): "no file under web/ imports mock-grader or scoring, or calls scoreStop, scoreRun or resolveStop", "no route string /api/scenario, /api/grade or /api/trades in server/".

## Order at a glance

| Wave | Ticket | Owner | Size | Depends on |
|---|---|---|---|---|
| 0 | F1a-T01 [P] | qa-engineer | M | none |
| 0 | F1a-T02 [P] | backend-engineer | S | none |
| 0 | F1a-T03 | qa-engineer | M | T02 |
| 0 | F1a-T04 [P] | backend-engineer | M | T03 |
| 0 | F1a-T05 [P] | backend-engineer | S | T02, T03 |
| 1 | F1a-T06 | backend-engineer | M | T04 |
| 1 | F1a-T20 [P] | backend-engineer | S | T03 |
| 1 | F1a-T07 | backend-engineer | M | T06, T20 |
| 1 | F1a-T08 | backend-engineer | M | T05, T07 |
| 1 | F1a-T09 [P] | qa-engineer | S | T08 |
| 1 | F1a-T10 [P] | qa-engineer | S | T08 |
| 1 | F1a-T11 [P] | qa-engineer | S | T06 |
| 2 | F1a-T12 | backend-engineer | M | T09, T10 |
| 2 | F1a-T13 | backend-engineer | M | T12 |
| 2 | F1a-T21 [P] | backend-engineer | S | T07 |
| 2 | F1a-T14 | backend-engineer | M | T13, T21 (merge: OI-13) |
| 2 | F1a-T15 [P] | frontend-engineer | S | T03 |
| 2 | F1a-T16 [P] | qa-engineer | M | T14 |
| 2 | F1a-T17 | frontend-engineer | M | T14, T15 (merge: OI-13) |
| 2 | F1a-T18 | backend-engineer | M | T16, T17 |
| 2 | F1a-T19 | qa-engineer | S | T18, T11 |

**What can start now (review.md):** T01, T02, then T03. T04 and T05 after T03. T20 after T03.

**[P] collision check:** T01 ∥ T02 (tests/acceptance, tests/e2e vs. prompts/scenario.js). T04 ∥ T05 ∥ T20 (index.js, routes, services vs. prompts vs. packs/pack.json, shared/pack.js, tests/pack-format). T07 → T08 sequential (both edit `server/services/content.js`; review). T09 ∥ T10 ∥ T11 (fake-claude.mjs vs. deny-list files vs. ownership files). T21 ∥ T12, T13 (shared/scoring.js vs. server and contract.js). T15 ∥ T12–T14, T21 (web/speech, web/app.js vs. server and shared). T16 ∥ T17 (tests vs. web). The two `web/app.js` edits (T15, T17) are sequential.

## Bugs (QA appends)
