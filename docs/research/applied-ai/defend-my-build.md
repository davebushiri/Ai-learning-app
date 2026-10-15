# Defend my build: a factual dossier on this app

**Purpose:** prepare the founder to talk about this app honestly in an Amazon technical interview. The hiring manager's ask (quoted in [thread 0007](../../team/threads/0007-applied-ai-aws-track.md)) is: "AI fluency / experience with RAG, agents, embeddings, practical hands on experience with evidence of taking into production."

**Update (2026-10-14, lead), read this first.** Since `bb3fb1d` the team built a second engine, the **practice engine (F1c)**, at `/practice.html` and `/api/practice/*`. The rows marked *(updated 2026-10-14)* below changed. The original card game is unchanged: everything said about it below still holds, including its security gaps.
- **Server-owned answers, in the practice engine only.** A started exercise is sent through an allow-list (`server/services/practice-pack.js` `toPublicExercise`). Rubrics, reference text and corrections leave the server only after a graded stop, an explicit "show the reference" (marked assisted), or completion (`server/services/practice.js`). QA's leak scan of every network response found none before completion (`docs/specs/F1c-practice-engine/qa-report.md`).
- **Events written per attempt, in the practice engine only.** Every stop, answer, grade, skip, assist and self-rating is appended with `engine: 'practice'`, and the append-only triggers apply (`tests/practice-catch.test.js`).
- **A deterministic grader with a measured gate, not an LLM.** `server/services/practice-matcher.js` (`matcher@2`) does rubric matching with negation handling and an "uncertain, flagged for review" outcome instead of guessing. It is gated on a 48-answer labelled set (SC-003) plus 7 module-1 rows (SC-012), with pre-registered thresholds. Honest story: v1 failed its own gate (80% and 50% against 100% and 75%), QA filed the bug, and the architect's rule change passed every threshold. Caveat: the rule was tuned and gated on the same small set, which the team recorded as an overfitting risk (thread 0007).
- **Held-out evaluation caught overfitting (2026-10-15).** To raise module-1 scores, the team widened the grader's synonym lists and rubric alternatives. Six of those changes were written after seeing the labelled answers. Before any change, QA committed a separate 30-answer held-out set (`72d4a75`), written blind from the narration and reference only. It was graded once (`docs/specs/F1c-practice-engine/qa-report.md`, "SC-003c held-out grading"):
  - **The suspect fixes:** they lifted the training-set gate from 50% to 83%, but on the held-out set the with-and-without versions graded every answer identically, so the gain was overfit and those fixes were dropped.
  - **The rest:** it improved held-out results (clear answers met 1/6 → 4/6, false "uncertain" 23% → 8%), but stayed far below the gates.
  - **Decision:** the founder stopped tuning the keyword grader and kept self-rating as the main signal. That is the pre-registered trigger for an LLM grader, which stays deferred (no API key).
  - **Honest caveats:** one person labelled the set, and 30 rows is small.
- **Still true:** no live Claude call, no RAG or embeddings in the product (module 1 *teaches* RAG; the app does no retrieval), no agents, no AWS, no deployment, no users besides the founder.
- **Updated numbers:** `npm test` on 2026-10-14: `# tests 475 / # pass 389 / # fail 0 / # todo 86`. Git: 131 commits on `team/agents`, 128 authored by Claude, 2 founder PR merges, 1 by legtar. The 61-run golden replay still shows 0 diffs (digest `cc1c3558d43c7e02`).

**Basis (original):** branch `team/agents` at `bb3fb1d` (2026-10-13). Everything below was checked in the code, config, tests and git history. Each claim cites its evidence path. **Uncertain** marks anything that couldn't be verified.

**Test run quoted (fresh, 2026-10-13, `npm test`):**
```
# tests 304
# suites 17
# pass 241
# fail 0
# cancelled 0
# skipped 0
# todo 63
# duration_ms 7488
```
The 63 todos are acceptance tests for tickets that aren't built yet (Wave 2). They are mapped to tickets in `tests/acceptance/F1a.test.js` and `tests/acceptance/todo-guardrail.test.js`. `CLAUDE.md` still says "~100 tests". That figure is out of date.

---

## 1. What the app is and does today

**In one sentence:** a browser game. An AI "apprentice" narrates a trade job (electrical, HVAC brazing, a brake job) step by step, and some steps contain planted mistakes. The learner hits STOP, explains what is wrong by voice or text, and gets graded and scored.

**The loop, as implemented** (`web/app.js`, phases `setup -> playing -> explaining -> grading -> feedback -> done`):
1. **Setup.** `init()` calls `GET /api/health` (the MOCK/LIVE badge) and `GET /api/trades` (the job dropdown). Evidence: `web/app.js` `init`, `server/routes/health.js`, `server/routes/scenarios.js`.
2. **Start.** `GET /api/scenario?trade=…`, or `&source=fixture` when "Use cached scenario" is ticked. With an API key the server would generate the scenario with Claude; otherwise it serves the pack's fixture card. Evidence: `server/services/content.js`, `web/api.js` `fetchScenario`.
3. **Narration.** Lines are spoken with the browser's `speechSynthesis`, with a 900 ms gap between lines (`web/speech.js` `speak`, `web/app.js` `STEP_GAP_MS`). With voice off, a line waits for its reading time.
4. **STOP.** The STOP button or the Space key. The browser itself works out which mistake is credited (`resolveStop`, `web/app.js:117`).
5. **Explain.** A textarea, or dictation through the Web Speech API in Chrome or Edge (`web/speech.js` `listen`).
6. **Grade.** `POST /api/grade` with the **whole scenario** and the explanation (`web/api.js` `gradeStop`). The server grades with Claude through the gateway, or falls back to the keyword grader (`server/services/assessment.js`). If the server can't be reached, the browser grades locally (`web/api.js:36`).
7. **Score.** Computed in the browser (`scoreStop`, `scoreRun` from `shared/scoring.js`; `web/app.js:161,211`).
8. **Results.** The rating, the total out of the maximum, and "What happened next" for each missed mistake. The worst miss's consequence is read aloud.

**Server routes, the complete list** (`server/index.js` ROUTES): `GET /api/health`, `GET /api/trades`, `GET /api/scenario`, `POST /api/grade`, plus static files from `web/` and `shared/`. Nothing else exists. The designed `/api/attempts…` routes (ADR 0003) are **not built**.

**Visible fallbacks:** the UI labels where each scenario and grade came from: "live", "cached (fallback)", "keyword grader (fallback)" and so on (`web/app.js` `SCENARIO_SOURCE`, `GRADE_SOURCE`, `showSource`). This is invariant 7, "fallback visible".

**Content:** one pack, `packs/demo-trades/` (3 scenarios: `electrical.json`, `brazing.json`, `brakes.json`). Each fixture card has 3 mistakes (critical, major, minor).

---

## 2. Architecture as implemented

Size: about 2,100 lines of product code (`server/`, `shared/`, `web/`) and about 7,400 lines of test code. The runtime has one dependency, `@anthropic-ai/sdk ^0.132.0` (`package.json`). It uses plain Node `http` with no framework, vanilla JS with no build step, and `node:sqlite`.

### 2.1 The AI gateway (`server/ai/gateway.js`, `server/ai/models.js`, `server/services/ai-client.js`)

| Property | Implementation | Evidence |
|---|---|---|
| One call site | `client.beta.messages.create(...)` appears only here | `gateway.js:56`; grep test in `tests/gateway-wiring.test.js` |
| Structured output | `output_config: { effort, format: { type: 'json_schema', schema: PROMPT.schema } }`; schemas `SCENARIO_SCHEMA`, `GRADE_SCHEMA` with `additionalProperties: false` | `gateway.js:62`, `shared/contract.js` |
| Hard deadline | `signal: AbortSignal.timeout(deadlineMs)`; grade 8 s, scenario 40 s (env-overridable) | `gateway.js:69`, `models.js` |
| Bounded retries | `maxRetries: 1`; the signal also caps the SDK's retry-after sleeps | `gateway.js:69` |
| Typed errors | Timeouts are detected with `instanceof Anthropic.APIUserAbortError`, never by matching message text | `gateway.js:75` |
| Output validation | `responseText`, then `JSON.parse`, then `normalize` (for example `clampGrade`), then `accept` (for example `validateScenario`). Any problem means the fallback is served. `refusal` and `max_tokens` are treated as failures. | `gateway.js:85-95`, ADR 0005 Amendment 2 |
| Required non-AI fallback | `run()` throws `TypeError` without a `fallback` function. Grading falls back to `mockGrade` and scenarios to the fixture card. | `gateway.js` `checkArgs`, `services/assessment.js`, `services/content.js` |
| Server-side model fallback | The `betas: ['server-side-fallback-2026-07-01']` and `fallbacks: 'default'` request fields | `gateway.js:64-66`. **Uncertain:** never exercised against the real API (see §3) |
| Exactly one `llm_call` row per `run()` | `{id, at, pipeline, prompt_version, model, ms, input_tokens, output_tokens, cache_read, cost_usd, outcome}`, written **before** the fallback runs. Outcomes are `ok`, `timeout`, `refusal`, `fallback` and `mock`. A logging failure never changes the answer. | `gateway.js:127`, `db.js` `logLlmCall`, `migrations/001-init.sql` |
| Prompt identity | Each prompt module exports `VERSION` (an integer) and `PROMPT = {id, system, schema, render, fingerprintInputs}`. The request carries an `x-prompt-id: grade@1` header. | `server/prompts/grade.js`, `server/prompts/scenario.js`, `tests/prompt-version.test.js` |
| Prompt fingerprint | sha256 over system, schema and every `render(fingerprintInput)`. Tests freeze both fingerprints, so a one-word edit fails without a `VERSION` bump. | `gateway.js:17` `promptFingerprint`; `tests/gateway.test.js` "promptFingerprint equals T05's frozen values" |
| Health signal | `/api/health` reports `lastLiveOkAt` and `lastLiveError`, so a bad key can't hide behind a "LIVE" badge | `services/live-status.js` |

**Why** (ADR 0005, `docs/adr/0005-ai-gateway-and-prompt-registry.md`):
- one place where invariants 3 and 4 can be enforced and tested;
- the mock and fallback paths are logged too, so every call is accounted for;
- the fingerprint defines what counts as a "text change".

**Rejected:**
- keeping `llm.js` and adding logging (the fallback paths would stay outside it);
- hashing only the system text (template and schema changes would slip through);
- clamping inside `accept` or after `run()`;
- having the gateway return a placeholder when `fallback()` throws.

**Gaps you should know about:**
- `cost_usd` is always `null`, because there is no price table in code (`gateway.js:130`).
- ADR 0005 **Amendment 3** (reject a missing or non-positive `deadlineMs`; `models.js` should default any non-positive-integer env value) is **decided but not in code**. `checkArgs` has no `deadlineMs` check, and `models.js` uses `Number(env) || default`, so `-1` passes. Source: review finding W1-S1 in `docs/specs/F1a-server-owned-cards/review.md:631`.

### 2.2 The fallback keyword grader (`shared/mock-grader.js`)
- How it matches: start-of-word matching with light stemming; keywords for the same idea count once; a synonym list for slang and speech-to-text errors ("juice", "nitro"); anti-stuffing, so an answer made only of keywords is capped at partial.
- It is used in MOCK mode, as the live grader's fallback, and (today) inside the browser.
- Each mistake's `keywords` field is written into the card.
- Tests: `tests/mock-grader.test.js` runs selected cases from the 32-case `tests/fixtures/adversarial-inputs.json` (14 correct, 6 partial, 7 wrong, 5 false_alarm). Labels are tagged "author". The founder has not labelled them (thread 0003 founder DECISION F-1, thread 0006 founder DECISION item 2).
- **Why** (ADR 0004 and ADR 0005): every AI call needs a deterministic, non-AI fallback, so a demo never stalls (invariant 7).
- **Known limitation:** the `SYNONYMS` table still holds trade words in `shared/`. That violates the subject-agnostic invariant, and the deny-list ratchet tracks it (§2.7).

### 2.3 SQLite append-only event store (`server/db.js`, `server/migrations/001-init.sql`, `shared/events.js`)
- **Single access point.** `node:sqlite` is imported only by `db.js` (grep test in `tests/db.test.js`). `db.js` exposes named functions and never the handle.
- **Migrations.** Forward-only `NNN-*.sql` files tracked by `PRAGMA user_version`, each run in a transaction. A failed migration stops the server (`server/index.js`).
- **Append-only by the database.** `event_no_update` and `event_no_delete` triggers (`001-init.sql:18-19`).
- **Ordering.** `seq INTEGER PRIMARY KEY`, because `at` collides at millisecond resolution (ADR 0002).
- **Event shape.** xAPI-shaped events `{id, at, actor, verb, object, result, context}` with `evt_` + ULID ids, validated by `validateEvent`, which never throws (`shared/events.js`).
- **Write rules (ADR 0001 Amendment 1):** `INSERT OR IGNORE`, `OR REPLACE` and `REPLACE INTO` are banned (a grep test enforces it). Idempotent inserts use `ON CONFLICT (key) DO NOTHING` (`db.js:85,88`). CHECKs are NULL-safe, and key columns are `NOT NULL` (`001-init.sql:31-50`).

**Why** (ADR 0001, ADR 0002):
- no new dependency;
- invariant 6 is enforced by the database rather than by convention;
- projections can always be rebuilt from events.

**Rejected:**
- `better-sqlite3` (a native build step);
- append-only enforced in code only;
- a migration library;
- `recursive_triggers` as the guard against `OR REPLACE`.

**What is actually written at runtime today:**
- `subject_pack` and fixture `card` rows, at startup (`server/packs.js`);
- `llm_call` rows, on every scenario or grade request that goes through the gateway.

**No `event` rows are written by any route.** `appendEvents` has no caller outside `db.js` and the tests. Attempts and events per play are Wave 2 (thread 0007, "Not implemented"). In the default config the DB is a file at `data/app.db` (gitignored). Tests use `:memory:`.

### 2.4 Packs (`packs/demo-trades/`, `shared/pack.js`, `server/packs.js`)
- **Format.** `pack.json` holds id, version, title, severity meanings, rating labels, copy, scenarios and provenance. Scenario cards sit in `scenarios/*.json`.
- **Validation.** `validatePack` is pure, never throws, and caps string lengths and counts. Cards are also checked with `validateScenario`.
- **Loader.** Runs at startup. A bad pack is skipped with one warning, and the server still starts.
- **Immutability per version.** Canonical JSON is stored in `subject_pack`. A changed pack under the same `(id, version)` is refused until its version is bumped (`server/packs.js` `loadOne`).
- **Defensive lookups.** The registry uses `Map`s, so ids like `__proto__` can't resolve to inherited properties. Loaded packs are deep-frozen.

**Why** (ADR 0006):
- subject content leaves the engine;
- all pack text is treated as untrusted, whoever wrote it, because packs will be AI-built later.

**Rejected:**
- the full future pack format now;
- trusting hand-authored packs;
- scoring that returns pack labels instead of keys.

### 2.5 The golden-replay harness (`tests/golden/`, `tests/fixtures/golden/`)
- **What it does.** Plays 61 scripted runs in headless Chromium through Playwright: perfect, late-by-one, false-alarm, missed-critical, never-stop, empty explanation, wrong explanation and double-stop, across 3 jobs and voice/text modes. It also runs 9 "live" runs against fake Claude: happy path, hang, 429, and a generated scenario. It records what the learner sees and hears, plus the outbound prompts (`tests/fixtures/golden/manifest.json`, `runs/`).
- **Determinism.** `page.clock`; stubbed `speechSynthesis` whose utterances are released by the harness; actions keyed on DOM state; time advanced only while no API request is pending (`tests/golden/harness.mjs` header).
- **Isolation.** At replay it may read only `tests/golden/**` and `tests/fixtures/golden/**` (enforced by `tests/golden-isolation.test.js`).
- **Certification.** Commit `dade9ef`: "The 61-run replay is byte-identical 3 times (about 2.3 min each); a one-word prompt change and an out-of-list draw both fail it."
- **Not part of `npm test`.** Run it with `node tests/golden/run.mjs --replay`. **This dossier did not re-run it.** The claim rests on the certifying commit.
- **Why** (thread 0004; spec F1a exit criterion (a), `docs/foundation/decisions.md` F1 row): a refactor of the whole foundation must not change anything a learner sees or anything sent to the model.

### 2.6 Fake-Claude test doubles (`tests/helpers/fake-claude.mjs`)
- **What it is.** A local HTTP server that imitates the Messages API. Tests point the real SDK at it with `ANTHROPIC_BASE_URL` and a fake key.
- **Failure modes:** delay, hang, any HTTP status with `retry-after`, `stop_reason` (refusal, max_tokens), raw or invalid content, and thinking blocks first.
- **Routing.** It routes on the `x-prompt-id` header. A request without the header gets a 500 and fails `assertNoUnroutedCalls`, so a misrouted call can't pass silently (F1a-T09, commit `4d1ac59`). It also logs the system text and a schema sha256, which the golden prompt layer uses.
- **Why** (thread 0003, environment constraint; founder DECISION F-3): there is no API key, and "tests must never call the real API" (`CLAUDE.md`). It replaced an earlier fake that guessed the call type by sniffing the schema (ADR 0005, Context).
- **Example tests** in `tests/gateway.test.js`: "hang gives outcome timeout within deadline + 1 s at 1500 ms", "429 with retry-after 60 gives outcome timeout within deadline + 1 s", "500 and 529 give outcome fallback", "refusal from fake Claude gives outcome refusal", "exactly one logCall on every exit path".

### 2.7 Deny-list and ownership guardrails
- **Deny-list ratchet** (`tests/deny-list.test.js`, `tests/fixtures/deny-list.json`, `deny-list-allow.json`).
  - Subject words such as "trade", "journeyman", "breaker" and "nitrogen" must not appear in `server/`, `shared/`, `web/` or `scripts/`.
  - Today's hits are baselined as `{file, word, count}` (37 entries now), and counts may only go down.
  - Why: invariant 1 (a subject-agnostic engine), founder DECISION in thread 0002, follow-up 2.
- **File ownership** (`tests/ownership.test.js`).
  - It parses the ownership table in `CLAUDE.md` and asserts that every tracked or untracked path has exactly one owning role.
  - `npm run check:ticket <id>` (`tests/tools/check-ticket.mjs`) compares a branch's changed files with the ticket's `Files:` line.
  - Why: decision D16 (one owning role per path; specialists never edit product code) and the "only the files listed" rule in the Definition of done.
- **Other structural tests:**
  - `node:sqlite` only in `db.js`;
  - `messages.create` only in `gateway.js`;
  - every prompt exports `VERSION`;
  - no SQL conflict clauses.

---

## 3. Implemented vs designed-but-not-built vs not started

| Area | Status | Evidence |
|---|---|---|
| Core game loop (narrate, STOP, explain, grade, score, results) | **Implemented** | `web/app.js`, `server/routes/*` |
| Voice in and out (browser TTS and STT) with text always available | **Implemented** (browser APIs, no cloud speech) | `web/speech.js`, `web/index.html` (`#explain-input`, `#mic-btn`) |
| AI gateway: schema, deadline, `maxRetries: 1`, fallback, `llm_call` | **Implemented and tested against fake Claude** | §2.1, `tests/gateway.test.js` |
| Deadline guard (ADR 0005 Amdt 3) | **Designed, not built** | `gateway.js` `checkArgs`, `models.js` |
| Prompt `VERSION` and frozen fingerprints | **Implemented** | `tests/prompt-version.test.js`, `tests/gateway.test.js` |
| Learner text fenced in the grade prompt | **Implemented** | `server/prompts/grade.js:13,32,59-61`; `tests/grade-prompt.test.js` |
| Pack text fenced in the scenario prompt | **Not built** (known violation, held for W7/F1b) | `server/prompts/scenario.js:56` puts `trade.brief` in unfenced; ADR 0006 "Today's unfenced uses" |
| SQLite store, migrations, append-only triggers | **Implemented** | §2.3, `tests/db.test.js` |
| Events written per attempt | *(updated 2026-10-14)* **Card game: designed, not built** (Wave 2: T12–T14). **Practice engine: implemented**, every event with `engine: 'practice'` (`tests/practice-catch.test.js`) | No caller of `appendEvents`; thread 0007 |
| Server-owned cards / attempt API (`/api/attempts`) | *(updated 2026-10-14)* **Card game: designed, not built.** **Practice engine: implemented** at `/api/practice/attempts` (`server/routes/practice.js`, `server/services/practice.js`) | ADR 0003; `server/routes/` has only the legacy routes; `toPublicCard` exists in `shared/contract.js:181` but nothing calls it |
| No grading in the browser | *(updated 2026-10-14)* **Card game: designed, not built.** **Practice engine: implemented**; the page imports nothing from `server/` or the mock grader (`tests/practice-web-state.test.js`) | ADR 0004; `web/api.js:2,36` still imports and calls `mockGrade` |
| Packs: format, validator, loader, immutability | **Implemented** (one pack) | §2.4, `tests/pack.test.js`, `tests/pack-format.test.js` |
| Golden replay (61 runs) | **Implemented, certified** (not re-run here) | `dade9ef`, `tests/fixtures/golden/manifest.json` |
| Deny-list ratchet, ownership test, `check:ticket` | **Implemented** | §2.7 |
| **Evals**: eval runner, metrics (κ, confusion matrix, bootstrap CI), recordings, staleness test, `eval:live` with a cost cap | **Designed, not built** | ADR 0007 decides it. `evals/`, `scripts/eval-prompts.js` and `tests/fixtures/recorded/` **do not exist**; `package.json` has no `eval:live` script |
| Human labels for the 32 grader cases | **Not done** | Founder DECISION F-1 said yes; thread 0006 founder DECISION item 2: "the founder asked what this is … Still open" |
| Cost tracking | **Designed** ($6 per run hard abort, $25 per month, founder F-2); `cost_usd` column exists but is always `null` | ADR 0007; `gateway.js:130` |
| **Live Claude calls** | **None verified in this repo.** No API key in this environment (`.env` absent; `ANTHROPIC_API_KEY` unset, checked 2026-10-13). Founder F-3: "later"; thread 0006: the key is "held until we're ready for beta testers". Every "live" test uses fake Claude. | Thread 0003 line 31; thread 0007 "Not implemented"; `docs/foundation/decisions.md` F-3 |
| Live Claude calls during the original hackathon | **Uncertain.** `README.md` and `DEMO.md` describe a LIVE mode and a "rehearse once live" plan, but nothing in the repo records a real call. Commit `7368e07` says its live-path tests ran "against a fake Claude API". | `DEMO.md`, `README.md`, `git show 7368e07` |
| **RAG** | **Not started.** No retrieval, chunking or citations anywhere. ("Sources and grounding" is listed under "Later".) | `grep` over `server shared web scripts`: the only hit for "rag" is the "wet rag" in `packs/demo-trades/scenarios/brazing.json`; `decisions.md` "Later" row |
| **Embeddings / vector store** | **Not started** | Same grep: no hits |
| **Agents / tool calling in the product** | **Not started.** The product makes two single-shot structured-output calls (scenario, grade) with no `tools` and no loop. | `gateway.js` request body |
| **AWS** | **Not started.** No AWS SDK, service or config. Thread 0007 notes docs.aws.amazon.com is blocked in this environment. | `package.json`; grep; thread 0007 |
| **Deployment** | **Config exists; deployment unverified.** `render.yaml` defines a Render free-plan web service with health check `/api/health` and no persistent disk. The README's "Deploy" checkbox is **unticked**. ADR 0001 keeps Render out of F1; F-5 says persistence costs money. | `render.yaml`; `README.md` Ringmaster list; ADR 0001 "Hosting". **Uncertain:** whether a Render deploy ever existed for the hackathon (`DEMO.md` mentions "the deployed URL"). |
| **Real users** | **None.** The only user evidence is the founder's own playtest. Tester consent is still being researched. | Thread 0006 founder EVIDENCE ("The app is really functional."); thread 0007 "production deployment and real users" under Not implemented; `docs/research/2026-10-playtest/tester-consent.md` |
| PWA (manifest, service worker, offline) | **Not built** (claimed in `CLAUDE.md` "It's a PWA") | `web/` has no manifest and no service worker |
| Learner model, planner, multi-subject, the A/B experiment | **Designed** (foundation docs F2–F4), **not started** | `docs/foundation/decisions.md` Build phases |

---

## 4. How it was built

**Git facts** (`git log` on `team/agents`):

| Fact | Value |
|---|---|
| Commits | **96** |
| Authored by "Claude <noreply@anthropic.com>" | **93**, all with `Co-Authored-By: Claude Opus 5.5` |
| Authored by `davebushiri` (the founder) | **2**, both GitHub PR merges (`000711f` PR #1, `3868c70` PR #2) |
| Authored by `legtar` | **1**, the initial commit `40faa92` (1,570 lines: the hackathon app, including `server/llm.js`, the prompts, `web/app.js` and the fixtures) |
| Date range | 2026-10-07 to 2026-10-13 (about one week) |
| Remotes | `origin` = `davebushiri/ai-learning-app`; `upstream` = `legtar/agent-hackathon` (push disabled) |

**Origin.** The app started as a hackathon project with a team. The README has a "Team split" (Brain, Stage, Ringmaster roles). Decision Q8, "Ownership with the hackathon team", is open in `docs/foundation/decisions.md`, and `docs/research/README.md:162` notes it too. **Uncertain:** who `legtar` is, and who wrote the initial commit's code. Ask the founder; don't guess in the interview.

**Process: an AI multi-agent role team.**
- **Roles.** Seven agent definitions in `.claude/agents/`: `technical-product-manager`, `principal-architect`, `backend-engineer`, `frontend-engineer`, `qa-engineer`, plus the on-call `evals-engineer` and `learning-designer`. Each has YAML frontmatter with a tool allow-list and a model (`opus` for the PM and architect, `inherit` for the rest).
- **Skills.** Five process skills in `.claude/skills/`: TDD, verification-before-completion, writing-specs, architecture-decision-records and team-discussion.
- **Flow.** Spec, then design review, then TDD build, then QA with separate Functional and AI-quality verdicts, then code review, then a human merge (`CLAUDE.md` "How work flows").
- **Threads.** Seven discussion threads in `docs/team/threads/`, with typed entries: 51 RISK, 24 RESPONSE, 16 POSITION, 16 DECISION, 11 EVIDENCE and 2 CHALLENGE headings (counted by `grep "^### "`). They include blind first rounds and assigned devil's advocates (thread 0002, 0003, 0004).
- **ADRs.** Seven ADRs (`docs/adr/0001–0007`), several amended after bugs were found. They are indexed as decisions D17–D23 in `docs/foundation/decisions.md`.
- **Spec.** One spec, `docs/specs/F1a-server-owned-cards/`: `spec.md`, `tasks.md` (revision 4.6, about 40 tickets and bug entries B01–B76), `review.md` and `learning-review.md`.
- **Tickets done.** Waves 0 and 1 are done, judging by the certifying commits: T01a, T01b, T02, T03a, T03b, T04, T05, T06, T07a, T07b, T08a, T08b, T09, T10, T11 and T20. Wave 2 (T12–T19, T21–T24) is on hold (thread 0006, thread 0007).
- **Test growth:** 33 to 97 tests in the hackathon "Brain hardening" commit (`7368e07`), and 304 now.

**The founder's role (count and quote precisely):**
- **Founder DECISION entries: 8.** Thread 0002: 1. Thread 0003: 2. Thread 0004: 3. Thread 0006: 2. (`grep "^### founder · .* · DECISION"`.) There is also one lead-recorded "DECISION (recorded for the founder; confirm or redirect)" in thread 0001, and 2 founder EVIDENCE entries in thread 0006 (one is the template line).
- Every founder entry says it was "recorded by the lead … from the founder's chat answers". So the founder spoke through chat, and the lead AI session wrote the entries.
- **What the founder decided:**
  - team composition: 5 core roles plus 2 on-call (thread 0002);
  - phase scope and the F2 hard rule (F-0);
  - labelling (F-1);
  - the eval cost cap (F-2);
  - key timing (F-3);
  - holding the prompt rewrite at the gate (F-4);
  - deferring hosting persistence (F-5);
  - the pending entries (F-6);
  - the ownership table (OI-8, B53);
  - go/no-go for Wave 0 and Wave 1;
  - playtest findings and direction (thread 0006): the scroll bug, voices, the PMP pack exception, research requests.
- **What the founder can honestly claim:**
  - product direction;
  - designing and steering the AI-agent development process (roles, decision rights, gates);
  - approving architecture and scope decisions;
  - setting cost and quality policy;
  - playtesting;
  - merging.
- **What the founder can't claim:** writing the code by hand. Git shows no founder-authored code commits, so the code is AI-written under the founder's direction. Where the hackathon base came from is a separate open question (above).

---

## 5. Interview-ready talking points (each with evidence)

### 5.1 Decisions and rejected alternatives
- **The gateway as the one choke point** (ADR 0005). The fallback is a required parameter, so "every AI call has a non-AI fallback" is a property of the function signature, not a code-review hope. Rejected: patching `llm.js`, because the fallback paths would stay unlogged.
- **Prompt fingerprinting** (ADR 0005). A hash over system, schema and rendered templates defines a "text change" mechanically. Rejected: hashing only the system text.
- **A plain Node eval runner instead of promptfoo** (ADR 0007). promptfoo@0.124.1 was 31.7 MB with 76 dependencies and telemetry, and its Anthropic provider would bypass the gateway's deadline and schema settings. Inspect AI was rejected because it needs a Python runtime. **Say "decided", not "built".**
- **`node:sqlite` with trigger-enforced append-only** (ADR 0001). Rejected: `better-sqlite3`, append-only in code only, and a migration library.
- **No grading in the browser** (ADR 0004). Rejected: obfuscated keywords on the client, because they still leak the answers. **Say "decided", not "built".**
- **A server-owned attempt API with an allow-list projection** (`toPublicCard`, ADR 0003). Rejected: keying state on `cardId`, and a separate `reveal` object.
- **Skip is "not graded"** (ADR 0004 Amendment 1, a PM decision after the learning-designer review). Scoring a skipped catch as missed would give false feedback.

### 5.2 Bugs caught (good stories, all documented)
- **F1a-B30 (NULL-unsafe CHECK).**
  - Bug: `CHECK (source <> 'live' OR (length(prompt_version) > 0 …))` passes when the stamps are NULL, because `length(NULL)` is NULL and a CHECK fails only on false. A NULL `source` also passed. Separately, SQLite let two `card` rows with a NULL `id` in.
  - Fix: `NOT NULL` keys and explicit `IS NOT NULL` checks.
  - Evidence: `tasks.md` F1a-B30, `001-init.sql:31-50`, ADR 0001 Amendment 1.
- **F1a-B31 (`INSERT OR IGNORE` hides errors).**
  - Bug: a live card with no stamps vanished silently, because `OR IGNORE` also swallows CHECK and NOT NULL violations.
  - Wider finding: `INSERT OR REPLACE` on `event` deletes the clashing row **without firing the no-delete trigger** (`recursive_triggers` is off). That silently rewrites "append-only" history (verified, `changes: 1`).
  - Fix: `ON CONFLICT (key) DO NOTHING`, plus a repo-wide grep ban.
  - Evidence: `tasks.md` F1a-B31, `db.js:85-93`, `tests/db.test.js`.
- **F1a-B20.** The golden harness's "results" check matched the results screen even when the error state was showing, so the "Retry results" path went untested. Fixed; a negative proof shows Retry is now pressed. Evidence: `tasks.md` F1a-B20, commit `2833d1d`.
- **F1a-B76.** Caught **before** it happened. A planned UI rename (`#trade-select` to `#scenario-select`) would have broken 57 frozen golden runs. Scheduled as a harness fix (T22) sequenced ahead of the rename. Evidence: `tasks.md` F1a-B76, commit `117a461`.
- **The usage-limit interruption.** Three agents were cut off at once by the account's session usage limit. Their unfinished work was saved as one mixed checkpoint commit. Evidence: commit `d2b18a0`, "WIP: partial F1a-T07a, T08a and T11 (agents stopped by usage limit)".
- **F1a-B52 (mixed commits break traceability).** Because the checkpoints `d2b18a0`, `7cec5c8` and `90f090c` mixed tickets, `check:ticket` couldn't isolate one ticket's diff. Mitigation: per-ticket file manifests posted in thread 0004, certifying commits per ticket, and "one checkpoint per ticket from now on". Evidence: `tasks.md` F1a-B52. **A good lesson about orchestrating AI agents.**
- **Also worth knowing:**
  - B06: an exit-listener leak in the test helper.
  - B60: `mockGrade` throws on non-array keywords. It is still open, assigned to T13b, and the reason Amendment 3 says "fallbacks must not throw".
  - Hackathon era (`7368e07`): a crash on a malformed URL, and Claude being able to veto a real catch, fixed by having the server decide false alarms (`services/assessment.js`).

### 5.3 Evaluation approach
- **Built:**
  - deterministic tests of every failure mode against fake Claude;
  - frozen prompt fingerprints;
  - a 61-run golden replay of the learner-visible and outbound-prompt layers;
  - a 32-case adversarial input set for the keyword grader, covering messy speech-to-text, slang, keyword stuffing and injection attempts;
  - game-balance tests and a scoring simulator with 9 scripted player types (`tests/game-balance.test.js`, `scripts/simulate.js`).
- **Designed, not built:**
  - grader agreement with human labels (Cohen's κ, a confusion matrix, a bootstrap CI);
  - recordings of real responses replayed in `npm test`;
  - a staleness ratchet that blocks prompt changes without a recording or an approved pending entry;
  - a cost-capped `eval:live` (ADR 0007).
- **Measured model quality:** **none.** No live calls, no labels. F1a's pre-registered AI-quality verdict is explicitly "no prompt change", not a quality score (`spec.md:339`).
- **Honest framing:** "I built the scaffolding that makes AI behavior testable and regressions visible. The quality measurement against human labels is designed and costed, but it waits on an API key and my labels."

### 5.4 Security
- **Implemented:**
  - Learner text is fenced in `<learner_explanation>`, angle brackets are stripped so it can't close its own tag, and it is capped at 1,500 characters. The system prompt says the content is data, and an injection-only answer is graded "wrong" (`server/prompts/grade.js:13,32`; tests in `tests/grade-prompt.test.js`).
  - The server, not the model, decides false alarms (`services/assessment.js`).
  - Request bodies are capped at 1 MB (413), bad JSON gets 400, and static serving guards against path traversal (`server/http.js`).
  - Pack validation and `Map` lookups block prototype-key tricks (`server/packs.js`).
  - The UI escapes HTML (`web/app.js` `escapeHtml`).
- **Not enforced yet in the card game (say so).** *(updated 2026-10-14: the new practice engine does enforce these; see the update at the top.)*
  - **Answers reach the browser before grading.** `GET /api/scenario` returns the full card including every `error` (`server/routes/scenarios.js:20`).
  - `POST /api/grade` **trusts a client-sent scenario**, so a client could forge the answer key (ADR 0003, Context).
  - The browser grades and scores locally (`web/api.js:36`, `web/app.js:117,161,211`).
  - Pack text goes into the scenario prompt unfenced (`server/prompts/scenario.js:56`; ADR 0006).
  - The fix is designed (ADRs 0003 and 0004, Wave 2 tickets T12–T18 and T19a's answer-leak test) but not built.

### 5.5 Latency, cost, deployment
- **Latency.**
  - Hard deadlines of 8 s for grading and 40 s for scenarios cover retries and `retry-after` waits (`server/ai/models.js`).
  - Browser timeouts are 12 s and 50 s (`web/api.js`).
  - Grading runs at `low` effort for latency (`models.js` comment).
  - Tested: "hang gives outcome timeout within deadline + 1 s" (`tests/gateway.test.js`).
  - **No real-model latency has been measured.**
- **Cost.**
  - Design: a $6-per-run hard abort and $25 per month for evals (founder F-2, ADR 0007).
  - Token counts and `cache_read` are logged per call.
  - `cost_usd` is never computed.
  - No real spend has happened.
- **Deployment.** A Render blueprint exists (`render.yaml`, free plan, health check, no persistent disk). It is not deployed as part of this work, and persistence is deferred because it costs money (F-5). **This is not "in production".**

---

## 6. Gaps vs the hiring manager's ask

| Ask | Does this project evidence it? |
|---|---|
| AI fluency | **Partly, and genuinely.** Structured outputs with JSON schema; deadlines and bounded retries; typed error handling; refusal and `max_tokens` handling; prompt versioning and fingerprints; prompt-injection fencing; deterministic test doubles; a designed eval methodology (κ, recordings, cost caps). |
| RAG | **No.** |
| Agents | **Not in the product.** The *development process* used a multi-agent team of AI coding agents (role prompts, tool allow-lists, file ownership, decision rights, review gates). That is real experience of orchestrating agents, but it isn't an agent the founder shipped in an app. |
| Embeddings | **No.** |
| Practical hands-on | **Partly.** The founder directed, reviewed, played and decided. The code was written by an AI coding assistant (§4). |
| Evidence of taking into production | **No.** No deployment verified, no real users, no live model calls. |

**Small, honest additions that would give real RAG and embeddings experience inside this app.** They fit thread 0007's own requirement of a "trusted reference kept separate from flawed narration".
1. **Retrieval with citations over the trusted reference notes.**
   - Add a `reference/` folder of short notes to a pack: for demo-trades, the `why` and `correctAction` text already in the cards; for the Applied AI track, the curriculum notes.
   - Chunk the notes. Embed them once with an embeddings API, or start with BM25 or TF-IDF in plain JS as a no-cost baseline.
   - Store the vectors in SQLite. A brute-force cosine search is fine at this size.
   - At grading time, retrieve the top-k chunks for the stopped step, put them in the grade prompt inside a fenced `<reference>` tag, and require the feedback to cite chunk ids (add a `citations` array to `GRADE_SCHEMA`).
   - This reuses the gateway (schema, deadline, fallback, logging) unchanged.
2. **A tiny retrieval eval.**
   - Hand-label about 20 (query, relevant chunk) pairs, and measure recall@k and MRR for BM25 against embeddings.
   - It fits ADR 0007's plain-Node-runner approach, and the founder can do the labelling.
3. **One small agent with tool calling**, if time allows: a "defend my build" tutor whose tools are `search_repo(query)` and `read_file(path)` over this repo, with read-only tools, a turn cap and a deadline per step. It must go through the gateway pattern, so the invariants hold.
4. **Do part of it yourself.** Write the chunker or the cosine function by hand, and run one real, cost-capped live call once a key exists. That is the only route to an honest "I built it" claim.

The process rules still apply: these additions need a spec ticket, an ADR (new storage and dependency decisions) and the eval gate. They are suggestions, not decisions. The founder decides scope (`CLAUDE.md`).

**Don't claim:**
- that it is "in production", "deployed" or "has users";
- that you "built RAG", "used embeddings" or "built agents" in this product;
- that you "measured grader accuracy" or "evaluated the model": no live calls and no labels exist;
- that "answers never reach the client": that is designed, not enforced;
- that "events are recorded per play": the store exists, but no route writes events;
- that you "hand-wrote the code": 93 of 96 commits are AI-authored, and the founder's 2 are PR merges;
- that it is "a PWA" or "works offline";
- anything about AWS.

---

## 7. Likely interviewer questions, with evidence-backed answers

| Question | Honest answer | Evidence |
|---|---|---|
| "Walk me through the architecture." | Browser (vanilla JS, Web Speech) → Node HTTP routes → services → one AI gateway → Claude, with a deterministic fallback on every call. SQLite holds packs, cards, an LLM call log and an append-only event table. | §2; `server/index.js`, `server/ai/gateway.js`, `server/db.js` |
| "How do you handle LLM failures?" | Each call has a hard deadline (`AbortSignal.timeout`) and `maxRetries: 1`. Typed errors map to outcomes `timeout`, `refusal` and `fallback`. Output is schema-constrained and validated again. A required fallback is always served, the UI labels it, and every call writes one log row. | `gateway.js:56-95,127-133`; `tests/gateway.test.js` |
| "How do you get reliable JSON?" | Structured outputs with a strict JSON schema, then parse, normalize, and validate the game rules (`validateScenario` enforces 3 mistakes, spacing, no mistake in the first two or last step). | `gateway.js:62`, `shared/contract.js` |
| "How do you test without calling the model?" | A fake Messages API server driven by modes (hang, 429, refusal, bad JSON), routed by an `x-prompt-id` header so misroutes fail loudly. Plus a 61-run browser golden replay. | `tests/helpers/fake-claude.mjs`, `tests/golden/` |
| "How do you know the grader is any good?" | Today I don't, and I'm upfront about that. The evaluation is designed: blind human labels on 32 cases, Cohen's κ, recordings replayed in CI, a cost cap. It's held until there's a key and labels. The keyword fallback has adversarial unit tests. | ADR 0007; `tests/mock-grader.test.js`; thread 0006 founder DECISION item 2 |
| "Prompt injection?" | Learner text is fenced and sanitized, and the system prompt treats it as data. The server overrides the model on the false-alarm verdict. Known gap: pack text in the scenario prompt isn't fenced yet, so non-trades packs are blocked until it is. | `server/prompts/grade.js`; ADR 0006 "F2 hard rule" |
| "Can a user cheat?" | Yes, today. The legacy route sends the answers to the browser and trusts the client's scenario. The server-owned attempt API that fixes it is designed and specified, with an answer-leak test planned. | `server/routes/scenarios.js:20`; ADR 0003; `tasks.md` T19a |
| "How do you manage prompt changes?" | `VERSION` per prompt; a sha256 fingerprint over system, schema and rendered branches, frozen in tests; a request header carrying `id@VERSION`; a designed eval gate run by a separate role, not the prompt's author. | `server/prompts/*.js`, `gateway.js:17`, `CLAUDE.md` invariant 4 |
| "Latency budget?" | Grading 8 s server-side and 12 s at the browser; low effort for grading. Never measured against the real model. | `models.js`, `web/api.js` |
| "Cost?" | Tokens are logged per call; there's an approved eval cap of $6 per run and $25 per month. Dollar cost isn't computed yet, and there's been no spend. | `gateway.js:127-130`; ADR 0007 |
| "Is it in production? Users?" | No. A Render blueprint exists but isn't deployed as part of this work. The only user is me, playtesting. | `render.yaml`; thread 0006, 0007 |
| "Did you use RAG, embeddings or agents?" | Not in the product. I used a team of AI coding agents to build it, and designed the roles, decision rights and gates. Here's how I'd add retrieval with citations (§6). | `.claude/agents/`, `docs/team/` |
| "What did *you* do vs the AI?" | I set direction and scope, designed the agent process and gates, made 8 recorded decisions (cost caps, eval policy, holding a prompt change until it can be evaluated, ownership), playtested and found the scroll bug, and merged. The AI wrote the code. | §4; `git log`; `docs/team/threads/*` |
| "Hardest bug?" | SQLite NULL semantics: a CHECK that passes on NULL, and `INSERT OR REPLACE` silently deleting "append-only" rows without firing the trigger. It ended in a database-enforced fix and a grep ban in CI. | F1a-B30/B31; ADR 0001 Amendment 1 |
| "What went wrong in the process?" | Agents hit a usage limit mid-task and left a mixed checkpoint commit. That broke per-ticket traceability (B52). We added per-ticket manifests and one checkpoint per ticket. | `d2b18a0`; F1a-B52 |
| "Why not a framework or promptfoo?" | Solo founder, a small surface, one dependency. promptfoo would bypass the gateway's guarantees and pull in 76 dependencies plus telemetry. | D11, ADR 0007 |
| "What would you do next?" | Finish the server-owned attempt API (it closes the cheating gap and starts writing events), then get a key and labels to run the eval gate, then add grounded retrieval with citations. | Thread 0007; `tasks.md` Wave 2; §6 |

---

### Open uncertainties to resolve with the founder before the interview
1. Who `legtar` is, and who wrote the hackathon initial commit (`40faa92`); the hackathon team's ownership (Q8).
2. Whether any real Claude call or Render deploy happened during the hackathon (`DEMO.md` implies a deployed URL and one live rehearsal; nothing in the repo proves either).
3. The golden replay was certified in `dade9ef` but was not re-run for this dossier.

---

## Lead's note on the open questions (2026-10-13)

- **`legtar` and the initial commit.** `legtar` owns the team repo `legtar/agent-hackathon`. The initial foundation code was written by the lead AI session during the hackathon and sent as a tarball, then pushed by a hackathon teammate. The founder later forked it to this repo. Either way, the founder didn't hand-write it.
- **Live calls and Render deploy during the hackathon.** The lead has no record of either. Treat them as unverified unless the founder has evidence.
