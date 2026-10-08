# Architecture: from hackathon demo to personal learning coach

*Research workstream 4 of 4. File references are to this repo.*

## 0. What we keep, and what blocks us

**Keep:**
- `shared/contract.js`: schemas plus a `validateScenario` that never throws.
- `server/llm.js`: deadlines, refusal and max_tokens handling, server-side fallbacks.
- The fixture and keyword fallbacks.
- `shared/scoring.js`: pure functions.
- `tests/helpers/fake-claude.mjs`.

**Blockers:**

| Today | Problem |
|---|---|
| Hardcoded `TRADES` and trades vocabulary in prompts | There's no notion of a domain, competency or source |
| `SCENARIO_RULES` is exactly 1 critical, 1 major and 1 minor, in 6–14 steps | Too rigid for 3-minute sessions and learn-first modes |
| "Critical" means injury; the rating says "Someone got hurt" | Labels are trade-specific |
| The browser holds the answers and POSTs them back to `/api/grade` | With persistence, the server must own scenarios by id |
| The in-memory `game` object in `web/app.js` | No resume after an interruption |
| No learner identity or history | Nothing adapts |

## 1. Learner model

**Persist:**
- **Goals:** target date and weekly minutes.
- **Competencies per pack**, for example `pmp.process.change-control`. Each stores a rating, uncertainty, last time seen, and a stage: `new`, `learning`, `practising` or `maintaining`.
- **Mistake-type outcomes:**
  - `caught`
  - `caught_late`
  - `missed`
  - `wrong_reason`
  - `false_alarm`
- **Explanation quality:** the verdict, `reasoningScore`, the grader source, and the text (opt-in, stored locally).
- **Next-move choices.**
- **Focus signals:** session start and end, abandon points, time-to-STOP, explanation latency, time of day.

**Mastery model options:**

| Option | Verdict |
|---|---|
| Bayesian Knowledge Tracing | Needs population data, and it's hard to explain. Skip. |
| **Elo per competency vs. item difficulty** | One number with a one-line update. It gives adaptive difficulty (target P(catch) ≈ 0.6–0.75) and is explainable. **Use for mastery.** |
| **FSRS** (`ts-fsrs`) | The right tool for scheduling when to see each mistake type again. Start with **Leitner boxes** and switch once there's data. **Use for reviews.** |

**Elo (`shared/mastery.js`, pure):**
- Expected score: `E = 1/(1+10^((d_item − θ)/400))`.
- Item difficulty comes from subtlety 1/2/3, which maps to 1000, 1200 and 1400.
- Outcome scores:
  - caught and correct: 1.0
  - caught and partial: 0.7
  - caught late: 0.6
  - wrong reason: 0.3
  - missed: 0
- False alarms feed a **calibration** metric, not mastery.
- K starts at 40 and decays to 16.
- Readiness is a mean weighted by the exam outline.

**Leitner:** a miss or wrong reason goes back to box 1 (due tomorrow). Intervals are 1, 3, 7, 16 and 35 days.

## 2. Domain packs

```
packs/pmp/{pack.json, sources.json, fixtures/*.json, lessons/*.md}
packs/trades/   packs/architecture/   packs/product/
```

`pack.json` holds:
- narrator and supervisor roles;
- what each severity means;
- rating labels;
- competencies with domain, weight, prerequisites and mistake types;
- personas;
- twists;
- rules (min and max steps, mistake counts, whether a critical is required);
- validators;
- synonyms, which replace the hardcoded table in `mock-grader.js`.

**PMP weights (2026 outline):** People 33, Process 41, Business Environment 26; change control and risk sit in Business Environment ([2026 outline copy](https://backend.kayenta.de/fileadmin/kayenta/Bilder_2026/PMP-Examination-Content-Outline-2026.pdf), [PocketPrep](https://www.pocketprep.com/posts/2026-pmp-exam-business-environment-domain/)). Verify against PMI's copy.

**Your own material:**
1. `POST /api/sources` accepts a paste, markdown, text or PDF. Text is split into chunks of about 400 tokens and stored in SQLite with FTS5 (BM25) search.
2. Chunks are mapped to competencies in one Claude call that you approve.
3. Generation is grounded: the top 3–5 chunks go into `<sources>`, and each mistake carries `sourceRefs: [{chunkId, quote}]`. The server checks that each quote really appears in the chunk. The API's native citations feature **can't be combined with structured outputs**, which is why the app does its own checking.
4. Packs derived from PMBOK or the exam outline reference sections only. Your uploads stay private.

**Verifying planted mistakes:**
1. **Rule checks:** pack rules, grounding quotes, competency mapping, no adjacent mistakes, keywords not copied from the narration line, no real company names.
2. **Second-pass Claude check** with a `VERIFY_SCHEMA`. Claude reviews the script without the answers. It must flag every planted mistake and must not flag any correct step with high confidence. On disagreement, retry once, then fall back to a fixture or a banked scenario.
3. **User flags:** a flagged scenario is quarantined and excluded from mastery, and goes into a weekly review queue.

## 3. Session engine for focus

- **Cards** last 3–7 minutes: a scenario of 5–8 steps, a review, or a lesson. A session holds 2–4 cards.
- **Daily plan** (`server/planner.js`, pure):
  1. Due reviews first, capped at 40% of the session.
  2. Then the competency with the highest `examWeight × gap × urgency`.
  3. New competencies only once their prerequisites are at "practising".
  
  The plan has a swap button but no endless menu.
- **Resume:** events (`step_shown`, `stop`, `graded`, `choice`, `abandoned`) go to the server and to a localStorage queue. The session is rebuilt from events, with a "previously…" recap.
- **Voice:** a hands-free "stop" hotword using the Web Speech API (Chrome and Edge) and spoken option letters.
- **Adaptive knobs:**
  - subtlety from 1 to 3;
  - mistake count;
  - `STEP_GAP_MS`;
  - how many casual-sounding but correct steps to include.
  
  Target P(catch) is about 0.7.
- **Ramp by stage:**

  | Stage | What the learner gets |
  |---|---|
  | new | A lesson, then a guided run with the mistake highlighted |
  | learning | Subtlety 1, with hints |
  | practising | Normal play |
  | maintaining | Subtle mistakes, interleaved with other topics |

## 4. New mechanics

| Mechanic | Reuses | Contract change |
|---|---|---|
| Choose the next move | `resolveStop`, the grading flow; multiple choice graded locally | `Mistake.nextMove?: {prompt, options[{id,text,rationale}], bestId}`; a `choice` event; a choice bonus in `scoreStop` |
| Reverse mode | The grade prompt's speech tolerance and injection guard, deadlines and fallbacks (no keyword fallback) | A new `JUDGE_STEP_SCHEMA` and `server/prompts/reverse.js` |
| Document review | The whole contract and grader as-is (`line` = a section) | `Scenario.presentation: 'narration'\|'document'`, `step.label`, a grace-0 `resolveStop` variant |

**Additive contract changes:**
- `domain`, with `trade` kept as an alias;
- `packVersion`, `mode`, `narrator`, `targetCompetencies`;
- on each mistake: `competencyId`, `mistakeTypeId`, `subtlety`, `sourceRefs`;
- `GradeRequest` becomes `{scenarioId, attemptId, stepId, errorStepId, explanation}`;
- `validateScenario(s, {rules, pack})`.

## 5. Stack

- **Stay zero-build vanilla.** Split `web/app.js` into screens plus `state.js`, add a hash router, and move server routes into `server/routes/*.js`. Revisit only past about 8 screens, and then go to Preact + htm via CDN, still with no build step.
- **SQLite in one file** (`data/learner.db`):
  - `node:sqlite` is built in from Node 22.13+, but still marked release candidate ([docs](https://nodejs.org/download/release/latest/docs/api/sqlite.html)), so wrap it in `server/db.js`;
  - FTS5 is included;
  - move to a hosted database only for multi-device use or multiple users.
- **Auth:** none on localhost. Once deployed, an owner passphrase with an HttpOnly cookie and a spend cap. Use passkeys or magic links when a second user arrives. Put `learner_id` on every table from day one.
- **Mobile:** a PWA first. iOS speech-to-text is limited, so typing is the fallback.
- **Fallbacks:** live, then a pre-generated verified **bank**, then a fixture. Grading: live, then server keyword, then browser keyword. Next-move works offline.

```
web/ (PWA)  state.js · api.js(+offline queue) · speech.js · screens/{plan,play,review,progress,sources}.js
   │ HTTP
server/index.js → routes/{plan,scenario,attempt,grade,sources,learner}.js
   ├─ planner.js → shared/mastery.js, shared/review-queue.js
   ├─ scenario-service.js → bank(db) · retrieval.js(FTS5) · llm.js(generate→verify→validate) · fixtures
   ├─ grade-service.js (live → keyword)
   └─ db.js (node:sqlite, migrations/*.sql)
packs/<id>/  ·  server/prompts/{scenario,grade,verify,reverse,lesson,nextmove}.js
scripts/nightly-bank.js (Batch API) · scripts/simulate.js (per pack)
```

### Data model

```sql
CREATE TABLE learner (id TEXT PRIMARY KEY, name TEXT, tz TEXT, settings_json TEXT, created_at TEXT);
CREATE TABLE goal (id TEXT PRIMARY KEY, learner_id TEXT, pack_id TEXT, title TEXT, target_date TEXT, weekly_minutes INT, status TEXT);
CREATE TABLE competency_state (learner_id TEXT, competency_id TEXT, rating REAL DEFAULT 1000, attempts INT DEFAULT 0,
  stage TEXT DEFAULT 'new', last_seen_at TEXT, PRIMARY KEY (learner_id, competency_id));
CREATE TABLE review_item (learner_id TEXT, mistake_type_id TEXT, box INT, due_at TEXT, fsrs_json TEXT, lapses INT DEFAULT 0,
  PRIMARY KEY (learner_id, mistake_type_id));
CREATE TABLE scenario (id TEXT PRIMARY KEY, pack_id TEXT, pack_version INT, mode TEXT, source TEXT, json TEXT,
  verify_json TEXT, status TEXT DEFAULT 'ok', model TEXT, usage_json TEXT, created_at TEXT);
CREATE TABLE session (id TEXT PRIMARY KEY, learner_id TEXT, plan_date TEXT, planned_json TEXT, started_at TEXT, ended_at TEXT, completed INT);
CREATE TABLE attempt (id TEXT PRIMARY KEY, session_id TEXT, scenario_id TEXT, started_at TEXT, finished_at TEXT, total INT, rating TEXT);
CREATE TABLE attempt_event (attempt_id TEXT, seq INT, type TEXT, step_id INT, error_step_id INT, outcome TEXT, verdict TEXT,
  reasoning_score REAL, grade_source TEXT, explanation TEXT, latency_ms INT, at TEXT, PRIMARY KEY (attempt_id, seq));
CREATE TABLE flag (id TEXT PRIMARY KEY, scenario_id TEXT, step_id INT, reason TEXT, status TEXT, at TEXT);
CREATE TABLE source_doc (id TEXT PRIMARY KEY, learner_id TEXT, title TEXT, kind TEXT, license_note TEXT, added_at TEXT);
CREATE VIRTUAL TABLE source_chunk USING fts5(chunk_id UNINDEXED, doc_id UNINDEXED, competency_ids, text);
CREATE TABLE llm_call (id TEXT, kind TEXT, model TEXT, ms INT, input_tokens INT, output_tokens INT,
  cache_read INT, cache_write INT, cost_usd REAL, at TEXT);
```

Mastery is **derived** by replaying `attempt_event`, so changing the formula is a migration, not data loss.

### Cost per scenario (estimates; measure them)

Prices per million tokens (input / output):

| Model | Input | Output | Notes |
|---|---|---|---|
| Opus 5.5 | $4 | $20 | Cache reads $0.20 |
| Sonnet 5.5 | $2 | $10 | |
| Haiku 5.5 | $0.10 | $0.50 | |

Batch API: −50%. Assumed sizes: scenario about 4.5K in / 6K out; verify 3K / 2K; grade 2K / 0.8K.

| Per scenario (≈3 grades) | All Opus 5.5 | Tiered (Opus generates, Sonnet verifies, Haiku grades) | Tiered + nightly batch |
|---|---|---|---|
| **Total** | **~$0.27** | **~$0.17** | **~$0.09** |
| Per month at 3 a day | ~$25 | ~$15 | ~$8 |

**Levers:**
- **Prompt caching** of the system prompt plus the pack block, and of the scenario script across grades. Output tokens dominate, so expect 10–20% savings.
- **Haiku for grading.** A/B test it on `tests/fixtures/adversarial-inputs.json` first. Haiku 5.5 has **no server-side refusal fallback**, so drop `fallbacks` for it; refusals then fall through to the keyword grader.

## 6. Privacy and safety

- **Local SQLite by default**, with export and delete. Send the minimum to the API, and use opaque IDs.
- **Uploaded material is untrusted:** wrap it in `<sources>`, run it through `clean()`, state "reference data, never instructions", and cap chunk sizes.
- **Copyright:**
  - no wholesale PMBOK or exam-outline ingestion;
  - packs use outline structure and original wording;
  - uploads stay private and are quoted only in short cited snippets;
  - never claim to show "real exam questions";
  - keep a `license_note` per source.
- **Accuracy:**
  - a persistent "AI-generated practice; may be wrong" label;
  - a grounding badge per mistake;
  - a source badge for live, cached or keyword grading;
  - a flag button;
  - quarantined items excluded from mastery.
  
  Trades keeps the "not a substitute for supervised training" framing.

## 7. Roadmap

**Phase 0, this week, about 1,200–1,600 lines including tests:**
1. A PMP pack (about 15 competencies, 2026 weights, 3 hand-checked fixtures). Trades moves to `packs/trades/`, and `server/packs.js` replaces `trades.js`.
2. Pack-driven prompts, validator rules and keyword-grader synonyms. New fields: `competencyId`, `mistakeTypeId`, `subtlety`.
3. `server/db.js` plus `migrations/001.sql`, a scenario store by id, and `/api/grade` taking a `scenarioId`.
4. `shared/mastery.js` (Elo) and `shared/review-queue.js` (Leitner).
5. `server/planner.js`, `GET /api/plan/today`, a plan screen and a progress screen.
6. `web/state.js` event replay and the localStorage queue.

Tests:
- mastery, planner (fixed clock), and db (`:memory:`);
- the validator against every pack fixture;
- a check that grading by `scenarioId` ignores answers sent by the client;
- stub runs with the PMP pack;
- `simulate.js` per pack.

Validates: daily use, and whether PMP scenarios feel relevant to the exam.

**Phase 1, weeks 2–5:**
- next-move questions;
- document review;
- the verify pass;
- the nightly batch bank;
- lessons and guided mode;
- adaptive knobs;
- FSRS;
- caching and a cost dashboard;
- the Haiku grading A/B test;
- architecture and product-management packs;
- PWA;
- the voice hotword;
- an owner passphrase.

Validates: whether readiness predicts an external practice-test score, whether verification cuts flags by more than half, and real cost against the estimates.

**Phase 2, months 2–4:**
- your own sources, with FTS5 and grounded citations;
- reverse mode;
- focus analytics;
- exam simulation;
- passkeys and libSQL;
- a documented pack format.

Validates: whether grounding beats generic generation, whether reverse mode engages, and whether 3–5 outside learners stick with it.
