# F1a: Tickets

**Status:** Draft. Spec: [`spec.md`](spec.md). Decisions: [thread 0003](../../team/threads/0003-f1-engine-core-proposal.md) (architect DECISION and PM DECISION, both binding).

Legend: [P] = can run in parallel with other [P] tickets in the same group (no shared files). Tickets without [P] run in the order of their `Depends on`.

## Rules for every ticket in this spec

- **Merge gate:** nothing except F1a-T01 and F1a-T02 merges before F1a-T03 (golden baseline) has merged.
- **Golden replay after every wave:** QA runs `node tests/golden/run.mjs --replay` after the last ticket of each wave. Any diff outside `tests/fixtures/golden/allow-list.json` is a blocker bug.
- **Deny-list ratchet (from F1a-T10 on):** a ticket that removes a deny-listed word from `server/`, `shared/`, `web/` or `scripts/` lowers the matching count in `tests/fixtures/deny-list-allow.json` in the same change. That one-file edit is allowed for every ticket after T10 and is not a file-list deviation. No ticket may raise a count or add an entry.
- **Changed assertions:** any existing test whose assertion changes is listed in the ticket as `old → new`. Path-only or setup-only edits are listed as such.
- **`shared/contract.js` ownership:** Wave 1 → F1a-T07 only. Wave 2 → F1a-T13 only.
- **No prompt text, template or schema change anywhere in F1a** (FR-027). A diff that changes the rendered output of `server/prompts/*` fails review.
- **`package.json` and `.gitignore`:** edited only by F1a-T06 (see spec OI-8).
- **Run your own tests against a DB:** spawned servers use `DB_PATH=:memory:` (set by the helper after T06); tests that inspect events spawn with `DB_PATH=<temp file>` and open it read-only afterwards.

## Group 0 (Wave 0): baseline and safe refactors

### F1a-T01 [P] Acceptance tests from the spec scenarios
- **Owner:** qa-engineer
- **Size:** M
- **Depends on:** none
- **Files:** create `tests/acceptance/F1a.test.js`, `tests/acceptance/helpers.mjs`, `tests/e2e/F1a.e2e.mjs`
- **Interfaces:**
  - Consumes: the routes and shapes in spec FR-001 to FR-012 (not yet built); `startServer(env)` from `tests/helpers/server.mjs`; `startFakeClaude()` from `tests/helpers/fake-claude.mjs`.
  - Produces: `leakScan(json: unknown) → string[]` in `tests/acceptance/helpers.mjs`, returning the JSON paths of any key in `["error","why","summary","correctAction","consequence","keywords","severity"]` (allowing `caught.severity` and `caught.correctAction` only in STOP responses, and `missed[]` only in complete responses). F1a-T19 reuses it.
- **Acceptance:** every acceptance scenario in spec US1–US6 and every edge case has at least one named test. HTTP-level tests (US1 API parts, US4, US5, US6, edge cases) live in `tests/acceptance/F1a.test.js` and run in `npm test`. Browser tests (US1–US3 in voice and text mode) live in `tests/e2e/F1a.e2e.mjs` and run with `node tests/e2e/F1a.e2e.mjs` (Playwright, global install, `MOCK=1`, free port, stubbed `speechSynthesis` and `SpeechRecognition`, `page.clock`, 390 px and 1280 px, zero console errors).
- **Tests that prove it:** each test is named `"<US#>.<scenario#> <title>"` or `"edge: <title>"`. Until its implementing ticket merges, each test is declared with `{ todo: 'F1a-T##' }` so `npm test` stays green. QA removes the `todo` when verifying that ticket.
- **Notes:** The tests are written from the spec, not from the code. Note: `npm test` only picks up `tests/acceptance/` after F1a-T06 widens the glob; run the file directly until then.

### F1a-T02 [P] Injectable rng for the scenario user prompt
- **Owner:** backend-engineer
- **Size:** S
- **Depends on:** none
- **Files:** modify `server/prompts/scenario.js`; create `tests/scenario-prompt-rng.test.js`
- **Interfaces:**
  - Produces: `scenarioUserPrompt(tradeId, trade, recentSummaries = [], rng = Math.random) → string`. `pick(a)` becomes `pick(a, rng)` using `Math.floor(rng() * a.length)`. The parameter names `tradeId`/`trade` stay (prompt file; renamed in F1b).
- **Acceptance:** FR-028. With `rng` omitted, behavior is unchanged. With a fixed `rng`, the output is a pure function of the inputs. No other text changes; no `VERSION` (T05 adds it).
- **Tests that prove it:** `tests/scenario-prompt-rng.test.js`: "same rng sequence gives byte-identical prompt", "rng () => 0 picks the first hint, twist and name", "default rng still varies names over 200 calls", "frozen snapshot: electrical with rng () => 0.5 equals the stored string" (snapshot inline in the test, generated from the pre-change code).
- **Notes:** Behavior-neutral, so it may merge before T03. `tests/validator.test.js:231-263` must pass unchanged.

### F1a-T03 Golden baseline capture (merge prerequisite)
- **Owner:** qa-engineer
- **Size:** M
- **Depends on:** F1a-T02
- **Files:** create `tests/golden/run.mjs`, `tests/golden/harness.mjs`, `tests/golden/scripts.mjs`, `tests/golden/browser-stubs.js`, `tests/fixtures/golden/manifest.json`, `tests/fixtures/golden/allow-list.json`, `tests/fixtures/golden/runs/*.json`
- **Interfaces:**
  - Produces: CLI `node tests/golden/run.mjs --capture | --replay [--repeat N] [--only <runId>]`; exit 0 = no diff outside the allow-list.
  - Golden run file `tests/fixtures/golden/runs/<runId>.json`: `{runId, mode: "mock"|"live-fake", speech: "voice"|"text", fixture, script, displayed: string[], spoken: string[], points: number[], score: number, rating: string, outcomeLine: string|null, grades: [{verdict, source}], prompts: [{kind, system, user, schemaSha256}]}`.
  - `manifest.json`: `{capturedAt, gitSha: string|null, treeSha256, node, chromium, runs: string[]}`. `treeSha256` = sha256 over the sorted `path\0content` of every file in `server/`, `shared/`, `web/`, `fixtures/`.
  - `allow-list.json`: `["grade-aborted-electrical-voice", "grade-aborted-electrical-text", "complete-aborted-electrical-voice", "complete-aborted-electrical-text"]`.
- **Acceptance:** SC-001 can be evaluated. The baseline is captured from the code before any F1a ticket except T01 and T02, run 3× with byte-identical output before it is committed.
  - **Matrix (61 runs):**
    - MOCK × 3 fixtures × 8 scripts × {voice, text} = 48. Scripts: `perfect`, `late-by-one`, `false-alarm` (STOP on line 1 only), `missed-critical` (STOP on major and minor only), `never-stop`, `empty-explanation` (STOP on the critical line, submit empty), `wrong-explanation` (STOP on the critical line, "his shoes are untied"), `double-stop` (STOP on a mistake, then STOP on the next line).
    - LIVE against fake Claude, cached card, text: 3 fixtures × {`perfect`, `false-alarm`} = 6.
    - LIVE, live-generated card, text, `perfect`: 1.
    - LIVE, fake Claude `hang` on grade, text, `perfect`: 1. LIVE, fake Claude `429` with retry-after 60, text, `perfect`: 1.
    - Allow-listed failure runs, MOCK electrical, {voice, text}: `grade-aborted` (`page.route` aborts the first grade request), `complete-aborted` (aborts the first results request; in the baseline there is none, so the run records the normal results) = 4.
  - **Layers recorded:** displayed strings (transcript lines with speaker, verdict label, feedback text, points, source line, score, results fields, missed items, every panel message); `speechSynthesis.speak` texts in order; `document.activeElement` id after each panel change; outbound prompts from fake Claude `/__log`; grade verdict and source. Screenshots at 390 and 1280 px are saved under the OS temp dir as a diff aid, not committed and not asserted.
  - **Normalization:** `Date.now()`-based ids are replaced by `<id>`. In the one live-generated run, the lines starting "Draw the critical mistake from:", "Jobsite twist to include:" and "Apprentice name:" are masked (spec OI-10; replaced by an env seed if the architect decides so).
  - The harness spawns the server with `DB_PATH=:memory:` so it works unchanged after T06.
- **Tests that prove it:** `node tests/golden/run.mjs --capture` then `--replay --repeat 3` exits 0 on the baseline; quote the output in the PR.
- **Notes:** This checkout has no git; record `gitSha: null` and rely on `treeSha256` (spec OI-7). Explanation strings per fixture and step are fixed in `scripts.mjs` (test code may read pack or fixture files).

### F1a-T04 [P] Split `server/index.js` into routes and services (zero test changes)
- **Owner:** backend-engineer
- **Size:** M
- **Depends on:** F1a-T03
- **Files:** modify `server/index.js`; create `server/http.js`, `server/routes/health.js`, `server/routes/scenarios.js`, `server/routes/grade.js`, `server/services/content.js`, `server/services/assessment.js`, `server/services/live-status.js`, `server/services/ai-client.js`
- **Interfaces:**
  - Produces:
    - `server/http.js`: `class HttpError(status, message)`, `sendJson(res, status, data)`, `readBody(req) → Promise<object>` (413 over 1,000,000 bytes, 400 on bad JSON), `serveStatic(res, pathname)`, `MIME`.
    - `server/services/live-status.js`: `liveStatus {lastLiveOkAt, lastLiveError}`, `noteLive(what, err?)`.
    - `server/services/ai-client.js`: `export const MOCK: boolean`, `export const ai` = `null` in MOCK, else the module from `await import('../llm.js')`. This is the **only** place that chooses the AI module (T08 changes this one import).
    - `server/services/content.js`: `getScenario(tradeId, source) → Promise<{scenario, source}>` (moved verbatim).
    - `server/services/assessment.js`: `grade(body) → Promise<GradeResponse>` (moved verbatim).
    - Each route module: `handle(req, res, url) → Promise<boolean>` (true if it handled the request). `server/index.js` keeps env loading, `process.on('unhandledRejection')`, the `[api]` log line, the dispatcher loop, the 404 and error handling, and `listen`.
- **Acceptance:** Pure move. Every existing test passes with zero test-file changes; golden replay is empty; the startup line `… on http://localhost:<port> …` is unchanged.
- **Tests that prove it:** the full existing suite (`npm test`, 97 pass) and `node tests/golden/run.mjs --replay`.
- **Notes:** Required first by the architect (A4): W1–W4 all edit `index.js` today. Keep function bodies byte-identical where possible so the diff reads as a move.

### F1a-T05 [P] `PROMPT_ID` and `VERSION` exports
- **Owner:** backend-engineer
- **Size:** S
- **Depends on:** F1a-T02, F1a-T03
- **Files:** modify `server/prompts/grade.js`, `server/prompts/scenario.js`; create `tests/prompt-version.test.js`
- **Interfaces:**
  - Produces: `export const PROMPT_ID = 'grade'; export const VERSION = 1;` in `grade.js`; `PROMPT_ID = 'scenario'; VERSION = 1` in `scenario.js`.
- **Acceptance:** FR-027. No other change to either file.
- **Tests that prove it:** `tests/prompt-version.test.js`: "every module in server/prompts exports PROMPT_ID (string) and VERSION (positive integer)", "PROMPT_IDs are unique", "GRADE_SYSTEM and SCENARIO_SYSTEM sha256 equal the values frozen in the test" (freezes today's text so a silent text change fails until F1b's staleness test replaces this check).
- **Notes:** `[ARCH DECISION NEEDED: ADR-xxxx gateway and prompt registry]` on the export names. `server/prompts/trades.js` is not a prompt and is deleted by T07; the test skips non-prompt modules by requiring a `*_SYSTEM` export.

## Group 1 (Wave 1): storage, packs, gateway

### F1a-T06 SQLite, migrations and the event log
- **Owner:** backend-engineer
- **Size:** M
- **Depends on:** F1a-T04
- **Files:** create `server/db.js`, `server/migrations/001-init.sql`, `shared/events.js`, `tests/db.test.js`, `tests/events.test.js`; modify `package.json`, `.gitignore`, `tests/helpers/server.mjs`
- **Interfaces:**
  - Produces (`server/db.js`):
    - `openDb(path: string) → Db`: opens with `node:sqlite` `DatabaseSync`, creates the parent directory for a file path, runs pending migrations from `server/migrations/NNN-*.sql` in order, each in a transaction, then sets `PRAGMA user_version = NNN`.
    - `getDb() → Db`: process singleton, `openDb(process.env.DB_PATH || 'data/app.db')`, opened lazily on first call.
    - `Db.appendEvent(e: Event) → void`; `Db.eventsForAttempt(attemptId: string) → Event[]` (insertion order, JSON columns parsed); `Db.insertCard(row: CardRow) → void` (INSERT OR IGNORE on `id`); `Db.getCard(id: string) → CardRow | null` (`json` parsed into `card`); `Db.upsertPack({id, version, json, provenance}) → void` (INSERT OR IGNORE); `Db.insertLlmCall(row: LlmCallRow) → void`; `Db.close()`.
    - `CardRow = {id, subject_id, subject_version, mode: 'stop', competency_id: null, mistake_types_json: null, subtlety: null, card (object), verify_json: null, status: 'ok', prompt_version, model, source, created_at}`. `LlmCallRow` = the `llm_call` columns.
  - Produces (`shared/events.js`, pure, browser-safe):
    - `VERBS_F1 = ['started','step-shown','stopped','explained','graded','completed']`.
    - `newId(prefix: 'evt'|'att'|'card'|'llm') → string`: `<prefix>_` plus a 26-char Crockford ULID (time + `crypto.getRandomValues`).
    - `makeEvent({verb, object, result?, context, actor = 'learner_1', at = new Date().toISOString()}) → Event` with `id = newId('evt')`.
    - `validateEvent(e) → string[]` (empty = valid; checks verb in `VERBS_F1`, `context.subject`, `context.attemptId`).
  - Migration `001-init.sql`: tables `event`, `subject_pack`, `card`, `llm_call` exactly as in `data-and-evidence.md` §2; `card.prompt_version` and `card.model` `NOT NULL CHECK (length(...) > 0)`; triggers `event_no_update` (BEFORE UPDATE ON event) and `event_no_delete` (BEFORE DELETE ON event) doing `SELECT RAISE(ABORT, 'event log is append-only')`; index on `json_extract(context_json, '$.attemptId')`.
  - `package.json`: `engines.node` → `">=22.13"`; `scripts.test` → `node --test "tests/**/*.test.js"`; add `scripts["check:ticket"]` → `node tests/tools/check-ticket.mjs`.
  - `.gitignore`: add `data/`.
  - `tests/helpers/server.mjs`: default env gains `DB_PATH: ':memory:'` (caller's env still overrides).
- **Acceptance:** FR-013, FR-014, FR-015, FR-017 (id format), FR-041. Nothing calls the DB yet; golden replay is empty.
- **Tests that prove it:** `tests/db.test.js`: "migrations run once and set user_version to 1", "re-opening a migrated file DB runs nothing", "UPDATE on event throws append-only", "DELETE on event throws append-only", "card without prompt_version or model is rejected", "insertCard is idempotent by id", "eventsForAttempt returns only that attempt, in insertion order", "DB_PATH file is created with its directory". `tests/events.test.js`: "newId matches ^evt_[0-9A-HJKMNP-TV-Z]{26}$", "1000 ids are unique and sortable by time", "makeEvent fills id, at, actor", "validateEvent rejects unknown verb and missing attemptId".
- **Notes:** `[ARCH DECISION NEEDED: ADR-xxxx storage]` on the `"none"` stamps (FR-015). The `ExperimentalWarning` on stderr is expected; do not suppress it with a flag that changes behavior. The `tests/helpers/server.mjs` edit is the only helper change in this ticket (exception to QA ownership, needed so test servers never write `data/app.db`).

### F1a-T07 [P] Pack format v1 and `packs/demo-trades`
- **Owner:** backend-engineer
- **Size:** M
- **Depends on:** F1a-T06
- **Files:** create `packs/demo-trades/pack.json`, `packs/demo-trades/cards/electrical.json`, `packs/demo-trades/cards/brazing.json`, `packs/demo-trades/cards/brakes.json`, `server/packs.js`, `tests/pack.test.js`; modify `server/services/content.js`, `server/routes/scenarios.js`, `shared/contract.js`, `scripts/simulate.js`, `tests/contract.test.js`, `tests/validator.test.js`, `tests/scoring.test.js`, `tests/mock-grader.test.js`, `tests/game-balance.test.js`, `tests/helpers/http.mjs`, `tests/helpers/fake-claude.mjs`; delete `server/prompts/trades.js`, `fixtures/scenarios/electrical.json`, `fixtures/scenarios/brazing.json`, `fixtures/scenarios/brakes.json`
- **Interfaces:**
  - Produces `packs/demo-trades/pack.json` (example; values copied verbatim from `trades.js`, `scoring.js:73-80`, `app.js:228`, `mock-grader.js:12-25,42`):
    ```json
    {
      "format": 1,
      "id": "demo-trades",
      "version": 1,
      "scenarios": [
        { "id": "electrical", "label": "Electrical: replace a receptacle", "card": "cards/electrical.json",
          "generation": { "brief": "…", "hazardHints": "…", "criticalHints": ["…"], "twists": ["…"] } },
        { "id": "hvac", "label": "HVAC: braze a suction line", "card": "cards/brazing.json", "generation": { "…": "…" } },
        { "id": "automotive", "label": "Automotive: front brake job", "card": "cards/brakes.json", "generation": { "…": "…" } }
      ],
      "ratings": { "missed-critical": "Someone got hurt", "excellent": "Journeyman eyes", "solid": "Solid supervisor",
                   "developing": "Keep watching", "beginning": "Back to the classroom" },
      "copy": { "cleanRun": "Clean job. Nobody got hurt.",
                "falseAlarmFeedback": "That step was actually fine. Stopping the job costs time, so save the STOP for real hazards." },
      "grading": { "synonyms": { "test": ["check", "verify", "…"], "…": ["…"] } }
    }
    ```
    Card files are today's fixtures, byte-identical except the `"trade"` line is removed.
  - Produces (`server/packs.js`): `loadPacks(dir = '<repo>/packs') → Map<string, Pack>` (validates each, skips and `console.warn`s invalid ones, records each valid pack via `getDb().upsertPack` and each card via `getDb().insertCard` with `prompt_version:'none', model:'none', source:'fixture'`; called once, lazily); `getPack(id) → Pack | null` (own-key safe); `listScenarios(packId) → [{id, label}] | null`; `getScenarioEntry(packId, scenarioId) → {id, label, card, generation} | null` (own-key safe); `validatePack(json) → string[]`. `Pack = {id, version, ratings, copy, grading, scenarios: [{id, label, card: Card, generation}]}`.
  - Changes (`shared/contract.js`): `validateScenario` no longer requires or checks `trade` (`opts.trade` removed); header comment drops "journeyman" and the `trade` field from the Scenario description. `SCENARIO_SCHEMA` and `GRADE_SCHEMA` unchanged.
  - Changes (`server/services/content.js`, `server/routes/scenarios.js`): legacy routes read from the pack via a module constant `LEGACY_SUBJECT = 'demo-trades'` (removed by T18). `GET /api/trades` → `listScenarios(LEGACY_SUBJECT)`; `GET /api/scenario?trade=` → validated with `getScenarioEntry`; live generation calls `ai.generateScenario(id, entry.generation)`; fixture path returns a deep copy of `entry.card` plus `trade: id` so the legacy response is unchanged.
- **Acceptance:** FR-019, FR-020; FR-023 for the moved values. Legacy routes return the same JSON as before for all three ids (including `trade`). Golden replay empty.
- **Changed tests:**
  - `tests/contract.test.js`: fixture dir → `packs/demo-trades/cards/`; "every trade points at an existing fixture" → "every pack scenario points at an existing card" (same assertion over `pack.scenarios`); `TRADES` import removed.
  - `tests/validator.test.js`: fixture dir and the `TRADES` loops read `pack.scenarios[].generation` (same assertions); "fixture passes the strict rules for its own trade" → "pack card passes the strict rules" (`validateScenario(s)` with no opts); **"J: trade mismatch is rejected…" deleted** (the check no longer exists; the server sets the subject).
  - `tests/scoring.test.js`, `tests/mock-grader.test.js`, `tests/game-balance.test.js`, `tests/helpers/http.mjs` (`loadFixture`), `tests/helpers/fake-claude.mjs` (`FIXTURE` constant): path only.
  - `scripts/simulate.js`: reads every `packs/*/pack.json` and plays each listed card (no pack id hard-coded, so `scripts/` stays free of deny-listed words); output table unchanged for demo-trades.
- **Tests that prove it:** `tests/pack.test.js`: "demo-trades pack validates", "ratings, copy and synonyms equal today's literals" (literals frozen in the test), "generation entries render byte-identical scenario prompts to the frozen T02 snapshot", "an invalid pack in a temp dir is skipped and logged, server-side load still returns the valid ones", "getScenarioEntry rejects __proto__, constructor, toString, hasOwnProperty", "loadPacks twice writes one subject_pack row and three card rows".
- **Notes:** `[ARCH DECISION NEEDED: ADR-xxxx pack format v1]` on field names and rating keys. `fake-claude.mjs` gets only the path edit here; T09 does the routing change.

### F1a-T08 [P] AI gateway, prompt registry and `llm_call`
- **Owner:** backend-engineer
- **Size:** M
- **Depends on:** F1a-T05, F1a-T06
- **Files:** create `server/ai/gateway.js`, `server/ai/models.js`, `tests/gateway.test.js`; modify `server/services/ai-client.js`, `tests/llm-deadline.test.js`; delete `server/llm.js`
- **Interfaces:**
  - Consumes: `getDb().insertLlmCall(row)` (T06); `PROMPT_ID`, `VERSION` (T05).
  - Produces (`server/ai/models.js`): `MODEL`, `SCENARIO_EFFORT`, `GRADE_EFFORT` (same env defaults as `llm.js:9-12`).
  - Produces (`server/ai/gateway.js`):
    - `generateScenario(scenarioKey: string, generation: object, {withMeta = false} = {}) → Promise<object | {value, meta: {promptVersion, model, llmCallId}}>`.
    - `gradeExplanation({scenario, stepId, errorStepId, explanation}) → Promise<object>`.
    - `responseText(content) → string` (moved verbatim).
    - Internal `askForJson({promptId, version, system, user, schema, effort, deadlineMs})`: same request body as `llm.js:35-49`, plus request option `headers: {'x-prompt-id': `${promptId}@${version}`}`; deadlines from `SCENARIO_DEADLINE_MS` / `GRADE_DEADLINE_MS` env (40000 / 8000).
    - On every attempted call, one `llm_call` row: `{id: newId('llm'), at, pipeline: promptId, prompt_version: 'grade@1', model: response.model ?? MODEL, ms, input_tokens, output_tokens, cache_read: usage.cache_read_input_tokens ?? 0, cost_usd: null, outcome}` with `outcome` = `ok` | `timeout` (abort) | `refusal` (`stop_reason === 'refusal'`) | `fallback` (any other throw). A failing `insertLlmCall` is caught and `console.warn`ed; it never changes the call's result.
    - Console lines unchanged: `[claude] <promptId> <ms> ms <model> <stop_reason> <in>/<out> tokens <id>` and `[claude] <promptId> failed after <ms> ms status=… request=…: …`.
  - Changes (`server/services/ai-client.js`): `await import('../llm.js')` → `await import('../ai/gateway.js')`.
- **Acceptance:** FR-024, FR-025, FR-026; SC-007, SC-008 (existing deadline tests keep their thresholds).
- **Changed tests:** `tests/llm-deadline.test.js`: import of `responseText` from `../server/llm.js` → `../server/ai/gateway.js` (import only; no assertion changes).
- **Tests that prove it:** `tests/gateway.test.js` (LIVE server against fake Claude, `DB_PATH` temp file): "every request carries x-prompt-id grade@1 or scenario@1", "happy grade writes one llm_call row ok with tokens 1234/321", "hang writes outcome timeout and the grade falls back within 2.5 s", "refusal writes outcome refusal", "500 writes outcome fallback", "llm_call insert failure does not change the grade", "the [claude] console line format is unchanged".
- **Notes:** `[ARCH DECISION NEEDED: ADR-xxxx gateway and prompt registry]` on whether MOCK paths also write `llm_call` (spec FR-029); MOCK paths are wired in T12/T13, not here. Fake Claude doesn't log request headers until T09, so the header test in `tests/gateway.test.js` points `ANTHROPIC_BASE_URL` at a minimal capture server inside the test file that records request headers and answers like fake Claude's happy path. `server/llm.js` must have no importer left (`grep` in PR). `server/ai/*` must contain no deny-listed word (drop the "trade hazard" example from the `llm.js:42` comment).

### F1a-T09 [P] fake Claude routes on `x-prompt-id`
- **Owner:** qa-engineer
- **Size:** S
- **Depends on:** F1a-T07, F1a-T08
- **Files:** modify `tests/helpers/fake-claude.mjs`; create `tests/fake-claude-routing.test.js`
- **Interfaces:**
  - Consumes: header `x-prompt-id: <promptId>@<VERSION>` (T08).
  - Produces: `kind` = the header's part before `@` (`"grade"` | `"scenario"`); `/__log` entries gain `promptId` (full header value); a request without the header gets HTTP 500 `{type:'error', error:{type:'api_error', message:'stub: missing x-prompt-id'}}` and a log entry with `kind: null`. Schema sniffing (`fake-claude.mjs:72`) is removed. Header comment updated.
- **Acceptance:** FR-040; spec US5 scenario 3.
- **Tests that prove it:** `tests/fake-claude-routing.test.js`: "grade call is logged with kind grade and promptId grade@1", "scenario call is logged with kind scenario", "request without x-prompt-id gets 500 and is logged", "existing server.test.js kind assertions still hold" (run as part of the full suite).
- **Notes:** Closes QA's 0003 RISK on silent misrouting.

### F1a-T10 [P] Deny-list ratchet
- **Owner:** qa-engineer
- **Size:** S
- **Depends on:** F1a-T07, F1a-T08
- **Files:** create `tests/fixtures/deny-list.json`, `tests/fixtures/deny-list-allow.json`, `tests/deny-list.test.js`
- **Interfaces:**
  - Produces: `deny-list.json` = `{words: string[]}` with at least the FR-038 seed; `deny-list-allow.json` = `[{file, word, count}]` generated from the tree after T07 and T08.
- **Acceptance:** FR-037, FR-038. Scans `server/`, `shared/`, `web/`, `scripts/` (all file types), excluding `packs/`, `fixtures/`, `tests/`, `node_modules/`; case-insensitive; word boundaries (a multi-word entry matches with any whitespace between words). Fails on an unlisted hit, and on a listed count above the actual count, with a message naming file, word and both counts.
- **Tests that prove it:** `tests/deny-list.test.js`: "no unlisted subject words in engine code", "allow-list counts match exactly (shrink the list when you remove a word)", "matcher: word boundaries (fetchTrades is not a hit, trade-select is)", "matcher: case-insensitive, multi-word phrases".
- **Notes:** Lands after T07/T08 so the first allow-list reflects the post-wave-1 tree and parallel tickets don't fight over it. From here on, see the ratchet rule at the top.

### F1a-T11 [P] File-ownership test and `check:ticket`
- **Owner:** qa-engineer
- **Size:** S
- **Depends on:** F1a-T06
- **Files:** create `tests/ownership.test.js`, `tests/tools/check-ticket.mjs`
- **Interfaces:**
  - Produces: `tests/ownership.test.js` parses the "File ownership" table in `CLAUDE.md` into `[{pattern, owner, except?}]` and asserts every tracked path maps to exactly one owner. `node tests/tools/check-ticket.mjs <ticketId> [--base <ref>]` reads the ticket's `Files:` line from `docs/specs/*/tasks.md`, lists changed files with `git diff --name-only <base>...HEAD`, and exits 1 listing any file outside the ticket (the ratchet allow-list edit is always allowed).
- **Acceptance:** FR-039. If the `CLAUDE.md` table can't be parsed, the test fails. Without git: behavior per spec OI-7 (not decided; must not fail, must not skip silently).
- **Tests that prove it:** `tests/ownership.test.js`: "CLAUDE.md ownership table parses", "every tracked path has exactly one owner", "unowned path is reported" (synthetic list), "behavior without git" (per the OI-7 decision).
- **Notes:** **Flagged for QA + principal-architect at spec review (OI-7):** this checkout reports "not a git repo", so `git ls-files` and `git diff` cannot run here. `package.json`, `.gitignore`, `packs/**`, `fixtures/**`, `render.yaml` and `data/` are not in the table today (OI-8); the test will report them until the table covers them, so the table fix must land before this test can go green. This ticket is blocked on OI-7 and OI-8.

## Group 2 (Wave 2): server-owned cards and web switch-over

### F1a-T12 Attempt start, scenario list and card persistence
- **Owner:** backend-engineer
- **Size:** M
- **Depends on:** F1a-T09, F1a-T10
- **Files:** create `server/routes/attempts.js`, `server/services/session.js`, `tests/attempts.test.js`; modify `server/index.js`, `server/routes/scenarios.js`, `server/routes/health.js`, `server/services/content.js`
- **Interfaces:**
  - Consumes: `getPack`, `listScenarios`, `getScenarioEntry` (T07); `generateScenario(key, generation, {withMeta:true})` (T08); `getDb()`, `newId`, `makeEvent` (T06); `PROMPT_ID`/`VERSION` (T05).
  - Produces:
    - `GET /api/scenarios?subject=<packId>` → 200 `[{id, label}]`; unknown, missing or non-own-key subject → 400 `{error}`.
    - `GET /api/health` → today's fields plus `subjects: string[]` (loaded pack ids) `[ARCH DECISION NEEDED: ADR-xxxx card/attempt API, FR-035]`.
    - `POST /api/attempts` body `{subject, scenario, source?: "fixture"}` → 200 `{attemptId, card: {id, subject, title, setting, apprentice, steps: [{id, line}]}, source}`; 400 for unknown or non-own-key `subject`/`scenario`, non-object body; 413 over 1 MB.
    - `content.getCard(subjectId, scenarioId, source) → Promise<{card: Card, cardId: string, source: 'live'|'fixture'|'fixture-fallback'}>`. Live: `validateScenario`, then `getDb().insertCard({id: newId('card'), subject_id, subject_version, card, prompt_version: 'scenario@1', model: meta.model, source: 'live', …})` **before** returning; failure → pack card with `fixture-fallback`.
    - `session.startAttempt({subjectId, scenarioId, source}) → Promise<{attemptId, card: PublicCard, source}>`; appends `started` (`object {type:'card', id: cardId}`, `result {source}`, `context {subject: `${pack.id}@${pack.version}`, attemptId, promptVersions: {scenario: `${scenario PROMPT_ID}@${VERSION}`, grade: `${grade PROMPT_ID}@${VERSION}`}}`, which is `demo-trades@1`, `scenario@1`, `grade@1` today; none of these values is hard-coded in `server/`).
    - `session.publicCard(card, cardId, subjectId) → PublicCard` (allow-list copy of exactly `title, setting, apprentice` and `steps[].{id, line}`; never spreads the card).
  - `card.subject` value `[ARCH DECISION NEEDED: ADR-xxxx card/attempt API]`: PM proposal `"demo-trades"` (the pack id; the version lives in events).
- **Acceptance:** FR-001, FR-002, FR-003, FR-010 (start route), FR-011 (start route), FR-016 (`started`), FR-017. Legacy routes untouched. Golden replay empty.
- **Tests that prove it:** `tests/attempts.test.js`: "scenarios list equals the legacy /api/trades list", "unknown and prototype-key subjects/scenarios get 400", "start returns exactly the public card keys (deep key allow-list)", "two starts on the same card get different attemptIds", "MOCK start writes one started event with subject demo-trades@1", "live start writes the card row before responding (row exists when the response arrives)", "live hang falls back to fixture-fallback within 3 s with SCENARIO_DEADLINE_MS=2000", "invalid live scenario falls back and is not stored as a card", "health lists subjects".
- **Notes:** MOCK paths and fixture-fallback record their source on the event and card (FR-029); whether they also write `llm_call` follows the ADR. Lower `deny-list-allow.json` counts only if this ticket removes a hit.

### F1a-T13 STOP route: server-side resolution, grading and scoring
- **Owner:** backend-engineer
- **Size:** M
- **Depends on:** F1a-T12
- **Files:** modify `server/routes/attempts.js`, `server/services/session.js`, `server/services/assessment.js`, `shared/mock-grader.js`, `shared/contract.js`, `tests/mock-grader.test.js`; create `tests/stops.test.js`
- **Interfaces:**
  - Consumes: `resolveStop`, `scoreStop`, `RULES` (`shared/scoring.js`, unchanged); `gradeExplanation` (T08); `getPack(id).grading`, `.copy` (T07).
  - Produces:
    - `POST /api/attempts/:attemptId/stops` body `{stepId: integer, explanation: string}` → 200 `{verdict, reasoningScore, feedback, source, points, total, caught: null | {errorStepId, stepsLate, severity, correctAction}}`; 400 bad body, unknown `stepId`, or `stepId` below the previous STOP; 404 unknown attempt; 409 after complete `[ARCH DECISION NEEDED: ADR-xxxx card/attempt API]`; 413 over 1 MB.
    - `session.submitStop(attemptId, {stepId, explanation}) → Promise<StopResponse>`: per-attempt promise-chain lock; same `stepId` as a graded STOP → stored body, no events; else appends `step-shown` (missing ids up to `stepId`), `stopped`, `explained`, then grades and appends `graded` (result includes the full StopResponse fields so the projection can replay it).
    - `session.projectAttempt(card, events) → {caughtIds: Set<number>, lastStopStepId: number|null, stops: Map<number, StopResponse>, shownStepIds: Set<number>, total: number, completed: object|null}` (pure).
    - `assessment.gradeStop({card, stepId, errorStepId, explanation, pack}) → Promise<{verdict, reasoningScore, feedback, source}>`: logic of today's `grade()` (`index.js:87-108`), MOCK and fallback via `mockGrade(card, errorStepId, explanation, pack.grading && {synonyms: pack.grading.synonyms, falseAlarmFeedback: pack.copy.falseAlarmFeedback})`. Legacy `grade(body)` also passes the demo-trades lexicon so the legacy route keeps today's verdicts.
    - `mockGrade(scenario, errorStepId, explanation, lexicon = {synonyms: {}, falseAlarmFeedback: 'That step was fine.'}) → {verdict, reasoningScore, feedback}`: `SYNONYMS` constant and its trade comments removed; default false-alarm text has no subject words.
    - `shared/contract.js`: header comment documents PublicCard, StopRequest, StopResponse, CompleteResponse (spec FR-001, FR-004, FR-005, FR-008); no code change.
- **Acceptance:** FR-004, FR-005, FR-006, FR-007, FR-010, FR-011 (STOP), FR-016 (`step-shown`, `stopped`, `explained`, `graded`), FR-018, FR-022.
- **Changed tests:** `tests/mock-grader.test.js`: every `mockGrade(x, id, t)` → `mockGrade(x, id, t, DEMO_LEXICON)` where `DEMO_LEXICON` is read from `packs/demo-trades/pack.json` (setup only; every assertion unchanged).
- **Tests that prove it:** `tests/stops.test.js`: "on-time catch: caught has exactly errorStepId, stepsLate, severity, correctAction", "one-late STOP credits the earlier mistake with stepsLate 1", "false alarm: caught null, verdict false_alarm, -75, no other step referenced", "already-caught mistake is not credited twice (double-stop)", "points equal scoreStop and total is cumulative", "same stepId returns the identical body and writes no events", "two concurrent identical STOPs produce one graded event", "lower stepId gets 400 and no events", "stepId 0, 99, '3', null get 400", "unknown attempt 404", "explanation over 2000 chars is truncated before grading", "live: model false_alarm on a real mistake becomes wrong", "live hang falls back to mock-fallback within 2.5 s", "events for a STOP are step-shown…, stopped, explained, graded in order", "projection rebuilds total and caught set from events", "MOCK verdicts for demo-trades equal the legacy /api/grade verdicts for the same inputs (all 3 cards × every step × 4 explanations)".
- **Notes:** `shared/contract.js` is owned by this ticket in Wave 2. The browser still imports `mockGrade` until T17; its 3-argument call keeps working with the subject-free default.

### F1a-T14 Complete route and rating keys
- **Owner:** backend-engineer
- **Size:** M
- **Depends on:** F1a-T13
- **Files:** modify `server/routes/attempts.js`, `server/services/session.js`, `shared/scoring.js`; create `tests/complete.test.js`, `tests/rating-keys.test.js`
- **Interfaces:**
  - Produces:
    - `POST /api/attempts/:attemptId/complete` body `{lastStepShown: integer}` → 200 `{total, maxPossible, caughtCount, mistakeCount, falseAlarms, missedCritical, missed: [{stepId, severity, summary, consequence, correctAction, points}], ratingKey, ratingLabel, cleanRunLine}`; 400 if `lastStepShown` isn't a step id or is below the last STOP; 404 unknown attempt `[ARCH DECISION NEEDED: ADR-xxxx card/attempt API, field names]`.
    - `session.completeAttempt(attemptId, {lastStepShown}) → CompleteResponse`: first call appends missing `step-shown` events and one `completed`; repeat calls return the stored body (from the `completed` event's result) unchanged.
    - `scoreRun(scenario, events, rules = RULES)` additionally returns `ratingKey ∈ RATING_KEYS`; export `RATING_KEYS = ['missed-critical','excellent','solid','developing','beginning']`, mapped from today's thresholds (missedCritical; ≥0.85; ≥0.6; ≥0.3; else). The legacy `rating` string stays until T18 so the current web keeps working.
    - `ratingLabel = pack.ratings[ratingKey]`; `cleanRunLine = pack.copy.cleanRun`.
- **Acceptance:** FR-008, FR-009, FR-016 (`completed`), FR-021 (key half).
- **Tests that prove it:** `tests/complete.test.js`: "never-stop run: missed-critical, three missed items with exactly the six keys, label Someone got hurt", "perfect run: excellent, label Journeyman eyes, cleanRunLine Clean job. Nobody got hurt.", "values equal scoreRun on the stored card", "second complete returns the identical body and there is one completed event", "STOP after complete gets 409", "lastStepShown below the last STOP or not a step gets 400", "step-shown covers every step once after complete". `tests/rating-keys.test.js`: "every fixture × simulate player gives the ratingKey whose demo-trades label equals today's rating string".

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
- **Notes:** May run any time after T03, in parallel with T12–T14 (no shared files). Must merge before T17 so both `web/app.js` edits are sequential and done by the same engineer.

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
  - llm-deadline "happy path": `s.json.trade === 'electrical'` → `s.json.card.subject === <ADR value>` and `s.json.source === 'live'`; "scenario: hanging API falls back" → via `POST /api/attempts`, same 3 s bound.
  - All other assertions unchanged (verdict rewrites, 2000-char cap, 1 grade call, empty-feedback fallback, 401 in health, ≤ 1 retry, fallback-block parsing).
- **Tests that prove it:** the ported files pass against the F1a build; the old-route versions are deleted in this ticket.
- **Notes:** Parallel with T17 (no shared files). Must merge before T18 removes the old routes.

### F1a-T17 Web switch-over: no answers, no grading in the browser
- **Owner:** frontend-engineer
- **Size:** M
- **Depends on:** F1a-T14, F1a-T15
- **Files:** modify `web/app.js`, `web/api.js`, `web/index.html`, `web/styles.css`
- **Interfaces:**
  - Consumes: `GET /api/health` (`subjects`), `GET /api/scenarios?subject=`, `POST /api/attempts`, `POST /api/attempts/:attemptId/stops`, `POST /api/attempts/:attemptId/complete` (T12–T14).
  - Produces (`web/api.js`): `fetchHealth()`; `fetchScenarios(subject) → [{id,label}]`; `startAttempt({subject, scenario, cached}) → {attemptId, card, source}` (live first with `AbortSignal.timeout(50000)`, then `source:'fixture'` with `source` reported as `fixture-fallback` on failure, as today); `postStop(attemptId, {stepId, explanation}) → StopResponse` (12 s timeout; throws `GraderUnreachableError` on network error, timeout or any non-2xx); `completeAttempt(attemptId, {lastStepShown}) → CompleteResponse` (12 s timeout; throws `ResultsUnreachableError`). No import of `/shared/*`.
  - `web/app.js`: `game` holds `{attemptId, card, stepIndex, total, pendingStop: {stepId} }`; no `scenario.steps[].error`, no `caught` set, no `events`. `onStop` records `stepId = card.steps[stepIndex].id` only. `submitExplanation` calls `postStop`; `isCatch = Boolean(r.caught)`; `markLine(isCatch ? r.caught.errorStepId : stepId, …)`; score = `r.total`; fix text uses `r.caught.correctAction`. `finish` is async and calls `completeAttempt` with `lastStepShown` = last shown step id; rating from `ratingLabel`; clean-run speech from `cleanRunLine`. `GRADE_SOURCE['local-fallback']` removed. The subject id comes from `health.subjects[0]` (per the FR-035 ADR).
  - New UI states (copy exactly as the spec's copy table): `#grader-error` panel ("Couldn't reach the grader. Try again or skip.", buttons `#retry-grade-btn` "Try again", `#skip-stop-btn` "Skip"); results failure (`#results-error` "Couldn't load your results. Your score so far is {total}.", button `#retry-results-btn` "Retry results"; `#again-btn` stays visible). Each message is built once, set as `textContent`, and passed to `speak()` when "Read aloud" is on. Focus moves to the primary button of each new state.
  - `web/index.html`: `id="trade-select"` → `id="scenario-select"`; markup for the two new states. No other copy changes (placeholder and "Job" label stay; see spec Later).
- **Acceptance:** FR-030, FR-031, FR-032, FR-033, FR-035, FR-036; US1–US3 in voice and text mode; removes every deny-list hit in `web/` (lower `deny-list-allow.json` to zero for `web/`).
- **Tests that prove it:** `node tests/golden/run.mjs --replay` — empty diff except the 4 allow-listed runs; `node tests/e2e/F1a.e2e.mjs` US1–US3 scenarios (voice and text) pass; leak check in the browser: no `/api/*` response before each STOP response contains an answer field, and `localStorage` is empty; zero console errors at 390 and 1280 px (screenshots in the PR).
- **Notes:** No browser-side grading in any form (A3); offline queueing is F2. The two new states are the only intended learner-visible changes.

### F1a-T18 Remove the legacy routes and finish the engine-code sweep
- **Owner:** backend-engineer
- **Size:** M
- **Depends on:** F1a-T16, F1a-T17
- **Files:** modify `server/index.js`, `server/routes/scenarios.js`, `server/services/content.js`, `server/services/assessment.js`, `shared/scoring.js`, `scripts/simulate.js`, `tests/scoring.test.js`, `tests/game-balance.test.js`, `tests/fixtures/deny-list-allow.json`; delete `server/routes/grade.js`
- **Interfaces:**
  - Removes: `GET /api/trades`, `GET /api/scenario`, `POST /api/grade` (→ 404 via the dispatcher's fallback); `LEGACY_SUBJECT`; `getScenario`; the `scenario.trade = …` stamp; legacy `grade(body)`; `scoreRun().rating` and every rating label string in `shared/scoring.js`.
  - `scripts/simulate.js`: prints `pack.ratings[r.ratingKey]` for the pack each card came from (T07's `packs/*/pack.json` loop); `PLAYERS` and `playRun` signatures unchanged.
- **Acceptance:** FR-012, FR-021 (labels gone), SC-002 (route half), SC-003.
- **Changed tests:**
  - `tests/scoring.test.js`: `r.rating === 'Someone got hurt'` → `r.ratingKey === 'missed-critical'`; `r.rating === 'Journeyman eyes'` → `r.ratingKey === 'excellent'`.
  - `tests/game-balance.test.js`: `r.rating === <label>` → `DEMO.ratings[r.ratingKey] === <same label>` for every rating assertion (labels unchanged; `DEMO` read from the pack).
- **Tests that prove it:** "legacy routes return 404" (in `tests/acceptance/F1a.test.js`, todo removed by QA); `tests/deny-list.test.js` green with SC-003's allow-list; full `npm test` green; golden replay as in T17.

### F1a-T19 Answer-leak invariant test and F1a exit evidence
- **Owner:** qa-engineer
- **Size:** S
- **Depends on:** F1a-T18
- **Files:** create `tests/no-answer-leak.test.js`; modify `tests/acceptance/F1a.test.js` (remove remaining `todo` markers)
- **Interfaces:**
  - Consumes: `leakScan` (T01); all F1a routes.
- **Acceptance:** FR-011, SC-001, SC-002, SC-003, SC-004, SC-005, SC-010.
  - The leak test plays every demo-trades card in MOCK and LIVE-against-fake-Claude, with every STOP pattern from the golden scripts, and asserts `leakScan` is empty on every response before the crediting STOP and on every false-alarm response; that `caught` holds only the credited mistake; that `/packs/demo-trades/pack.json`, `/../packs/demo-trades/pack.json`, `/shared/../packs/demo-trades/pack.json` and `/fixtures/scenarios/electrical.json` return 403 or 404; and that the three legacy routes return 404.
  - Final evidence: `node tests/golden/run.mjs --replay --repeat 3` exit 0; fresh `npm test` with `# fail 0`, `# todo 0`, `# skipped 0`; `deny-list-allow.json` matches SC-003; `node tests/e2e/F1a.e2e.mjs` passes. All quoted in `docs/specs/F1a-server-owned-cards/qa-report.md` with separate Functional and AI-quality verdicts.
- **Tests that prove it:** `tests/no-answer-leak.test.js`: "no answer field before the crediting STOP (3 cards × MOCK/LIVE × scripts)", "false-alarm responses reference no mistake", "pack and fixture files are not served", "legacy routes are gone".

## Order at a glance

| Wave | Ticket | Owner | Size | Depends on |
|---|---|---|---|---|
| 0 | F1a-T01 [P] | qa-engineer | M | none |
| 0 | F1a-T02 [P] | backend-engineer | S | none |
| 0 | F1a-T03 | qa-engineer | M | T02 |
| 0 | F1a-T04 [P] | backend-engineer | M | T03 |
| 0 | F1a-T05 [P] | backend-engineer | S | T02, T03 |
| 1 | F1a-T06 | backend-engineer | M | T04 |
| 1 | F1a-T07 [P] | backend-engineer | M | T06 |
| 1 | F1a-T08 [P] | backend-engineer | M | T05, T06 |
| 1 | F1a-T09 [P] | qa-engineer | S | T07, T08 |
| 1 | F1a-T10 [P] | qa-engineer | S | T07, T08 |
| 1 | F1a-T11 [P] | qa-engineer | S | T06 (blocked on OI-7, OI-8) |
| 2 | F1a-T12 | backend-engineer | M | T09, T10 |
| 2 | F1a-T13 | backend-engineer | M | T12 |
| 2 | F1a-T14 | backend-engineer | M | T13 |
| 2 | F1a-T15 [P] | frontend-engineer | S | T03 |
| 2 | F1a-T16 [P] | qa-engineer | M | T14 |
| 2 | F1a-T17 | frontend-engineer | M | T14, T15 |
| 2 | F1a-T18 | backend-engineer | M | T16, T17 |
| 2 | F1a-T19 | qa-engineer | S | T18 |

**[P] collision check:** T01 ∥ T02 (tests/acceptance, tests/e2e vs. prompts/scenario.js). T04 ∥ T05 (index.js, routes, services vs. prompts). T07 ∥ T08 (packs, content.js, scenarios route, contract.js, test paths vs. server/ai, ai-client.js, llm.js, llm-deadline import). T10 ∥ T11 ∥ T09 (deny-list files vs. ownership files vs. fake-claude.mjs). T15 ∥ T12–T14 (web/speech, web/app.js vs. server). T16 ∥ T17 (tests vs. web). The two `web/app.js` edits (T15, T17) are sequential.

## Bugs (QA appends)
