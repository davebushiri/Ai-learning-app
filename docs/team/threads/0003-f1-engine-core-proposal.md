# 0003: F1 engine core: scope, slicing and open questions

**Type:** PROPOSAL
**Status:** decided (scope, technical, and founder answers F-0 to F-6).
**Opened by:** technical-product-manager · 2026-10-09
**Decider:** technical-product-manager (scope and slicing inside F1) · principal-architect (technical questions, as ADRs) · founder (anything that changes phase scope or costs money)
**Targets:** future `docs/specs/F1-*/`; `docs/foundation/decisions.md` "Build phases" F1 row; thread 0002 founder follow-ups 1–4
**Participants:** principal-architect, backend-engineer, frontend-engineer, qa-engineer, evals-engineer

## Context

**What F1 must deliver** (`decisions.md` F1 row): SQLite and the event log; server-owned cards; pack format and `packs/demo-trades`; subject-agnostic prompts and UI copy; deny-list test; prompt registry with versions; LLM call log. **Proves:** *"Nothing new for learners. The old game runs on the new foundation, and all tests pass."* `voice-first.md` §7 also puts the `web/speech/` interface in F1. The founder's DECISION in [0002](0002-is-this-the-right-team.md) adds: (1) remove subject words, (2) invariant greps become `npm test` tests, (3) `evals/` + `scripts/eval-prompts.js` + `npm run eval:live` + replay helper, (4) a founder-approved per-run eval cost cap. Note that (3) pulls part of F3's "prompt eval runner" forward into F1.

**Current code vs. target** (checked 2026-10-09):

| Today | Gap against target / invariants |
|---|---|
| `server/index.js` (188 lines): all routes inline | `GET /api/scenario` returns full scenario incl. every `step.error` (**breaks inv. 2**). `POST /api/grade` trusts a client-sent `scenario` (`index.js:166-172`). No `server/routes/*`. |
| `server/llm.js` | Deadlines + `maxRetries: 1` OK (`llm.js:48`). Logging is `console.log` only (`llm.js:58`); no `promptId/VERSION`, no `llm_call`. Target `server/ai/gateway.js`. |
| `server/prompts/grade.js`, `scenario.js` | No `VERSION`. Subject words: "trade", "journeyman", "de-energized" (`grade.js:4,11,23`); "NEC, OSHA, EPA", "journeyman", "trade knowledge" (`scenario.js:16-29`). |
| `server/prompts/trades.js` + `fixtures/scenarios/{electrical,brazing,brakes}.json` | Become `packs/demo-trades/` (D13). No `packs/` dir, no pack loader or validator. |
| `shared/contract.js` | Scenario has a `trade` field; comment says "journeyman". |
| `shared/scoring.js:74-79` | Rating labels "Someone got hurt", "Journeyman eyes" are subject words in shared engine code (the pack format has `ratings`). |
| `web/app.js` | `resolveStop`/`scoreRun` run in the browser on the full scenario (`app.js:117,211`); "Clean job. Nobody got hurt." (`app.js:228`). |
| `web/api.js:36` | Browser fallback `mockGrade(scenario, …)` needs answers on the client: conflicts with inv. 2. |
| `web/speech.js` | One file; target is `web/speech/` with `speak`, `listen`, `onHotword`, `cancel` (`voice-first.md:61`). |
| Missing entirely | `server/db.js`, `server/migrations/`, `shared/events.js`, `packs/`, `evals/`, `scripts/eval-prompts.js`, `tests/fixtures/recorded/`, `ts-fsrs` |
| `tests/` | 97 passing. 14 server tests post a full `scenario` to `/api/grade`. `fake-claude.mjs:72` detects grade vs. scenario by the string `verdict` in the schema. |
| `package.json` | `engines: >=20.12`, but CLAUDE.md says Node 22+ and `node:sqlite` needs ≥22.5 (unflagged ≥22.13; to verify). Only dep: `@anthropic-ai/sdk`. |

**Environment constraint:** there is still **no Anthropic API key** in the cloud environment. Every live path in F1 is tested only through `tests/helpers/fake-claude.mjs`. No live eval can run until the founder provides a key.

## Proposed F1 scope: candidate work items

| # | Item | Size | Depends on | Must / could |
|---|---|---|---|---|
| W1 | `server/db.js` (SQLite) + numbered migrations + `event` table, append-only at the DB level + `shared/events.js` (xAPI shape, verbs from `data-and-evidence.md` §1) | M | none | **Must** |
| W2 | Pack format + validator; `packs/demo-trades/` from `trades.js` + 3 fixtures; `subject_pack` table; carries `ratings`, `severity`, outcome copy ("Nobody got hurt" moves here) | M | W1 | **Must** |
| W3 | Prompt registry: `VERSION` on every prompt, `promptId` stamping, `llm_call` table, `server/llm.js` → `server/ai/gateway.js` | M | W1 | **Must** (cards need `prompt_version` stamped; `system-architecture.md` §4) |
| W4 | Server-owned cards: `card` table; scenario route returns `{cardId, steps:[{id,line}]}`; STOP route takes `{cardId, stepId, explanation}`; server resolves STOP, grades, scores (`shared/scoring.js`), emits `started/stopped/explained/graded/completed`; answers revealed only after grading / at run end | L, split into 2 | W1–W3 | **Must** |
| W5 | Web on server-owned cards: `app.js`/`api.js` stop holding the scenario; results from server; browser fallback reworked | M | W4 contract | **Must** |
| W6 | Regression baseline (QA): golden runs captured **before** W4 lands, replayed after | S–M | none | **Must** |
| W7 | Subject-agnostic prompts and copy (0002 #1): pack-supplied vocabulary in `grade.js`/`scenario.js`; `trade`→`subject` in contract; rating labels from pack | M | W2, W3 | **Must** (but see founder dependency F-4) |
| W8 | Invariant tests in `npm test` (0002 #2): deny-list, deadlines, `VERSION`, no answers to client, append-only, file ownership | M | partly W4/W7 | **Must** |
| W9 | Evals scaffolding (0002 #3): `evals/` grader suite on the 32 cases, `scripts/eval-prompts.js`, `npm run eval:live` (opt-in, key + cap required, refuses otherwise), replay helper for `tests/fixtures/recorded/<prompt>@<version>.json`, stale-recording test | M | W3 | **Must** for scaffold + replay; the first live run **slips** until key + labels |
| W10 | `web/speech/` interface (`speak`, `listen`, `onHotword` stub, `cancel`); `speech.js` moved behind it, behavior unchanged | S | none | Could (cheap; in `voice-first.md` §7 but not in the `decisions.md` row) |
| W11 | Split `server/index.js` into `server/routes/*` | S–M | none | Could, unless needed to keep parallel tickets off one file |
| W12 | `ts-fsrs` dependency set-up | S | none | **Slip to F2**: no consumer in F1 |

## Options for slicing F1

1. **One spec, `F1-engine-core`:** about 14 tickets. Simplest to track. The founder-blocked items (W7 prompt text, W9 live run) sit in the same spec as the critical path.
2. **Two specs (recommended):**
   - **`F1a-server-owned-cards`:** W1, W2, W3, W4, W5, W6, plus the W8 tests that can pass in F1a (no answer leak, append-only, deadlines, `VERSION`), plus the UI-copy part of W7 (`app.js:228`, rating labels from the pack). No prompt text changes, no founder dependency.
   - **`F1b-agnostic-prompts-and-evals`:** W7 prompts, W8 deny-list driven to zero, W9, W10.
3. **Three specs:** F1a storage + packs + registry (backend only), F1b cards + web, F1c prompts + evals. Smallest pieces, but adds a third review/pressure-test cycle.

**Smallest F1 that proves the foundation:** a demo-trades card played end to end where the browser never sees an answer before grading, every action lands as an event in SQLite, and the golden runs replay with identical points, ratings and spoken/displayed text.

## Questions for the team

**principal-architect**
- A1. Storage: `node:sqlite` vs `better-sqlite3`; raise `engines` to Node ≥22.13? Append-only enforced by SQLite triggers (`RAISE` on UPDATE/DELETE) or by code only? Migration runner form (`PRAGMA user_version` + `server/migrations/NNN-*.sql`)? DB path and per-test isolation (`:memory:` or temp file)? `render.yaml` has no persistent disk: is Render in F1 scope at all?
- A2. Card contract: exact public card shape, the STOP route name and body, and when each answer field may be revealed (the graded mistake after its STOP; all missed ones at run end). Do the old `/api/scenario` and `/api/grade` stay for a deprecation window or go?
- A3. `web/api.js:36` grades in the browser with the full scenario. Options: (a) drop the browser fallback (the server keyword fallback stays; offline arrives with the PWA), (b) a visible "can't grade offline, try again" state, (c) something else. Which one keeps inv. 2 *and* inv. 7?
- A4. Gateway layout now (`server/ai/{gateway,models}.js`) or later? Is W11 (route split) required so that W3/W4 tickets don't collide on `server/index.js`?
- A5. Does a prompt change that keeps the **rendered** prompt byte-identical for demo-trades (subject words moved into the pack) count as a text change under inv. 4? Which ADRs do you expect from F1?

**backend-engineer**
- B1. Size W1–W4, W7 and W11. Where is the hidden work? (Candidates: `tests/helpers/server.mjs` needing a DB path, fake-claude's `verdict` sniffing after the schemas move, persisting live-generated scenarios as cards, `trade`→`subject` touching fixtures.)
- B2. Can W7 make the rendered grade/scenario prompts byte-identical for demo-trades, proven by a snapshot test?

**frontend-engineer**
- F1. List what changes in `web/app.js` once it holds only `{cardId, steps}`: STOP resolution, `isCatch`, `markLine`, points, the results screen. Is it M or L?
- F2. W10: propose the `web/speech/` interface (names and shapes). Can it land in F1 with zero behavior change, or should it slip to F2 with the voice flow?
- F3. How will you show, in a real browser and in both voice and text mode, that the learner sees and hears exactly what they did before?

**qa-engineer**
- Q1. How do we prove "nothing changed for the learner"? My proposal: before any F1 ticket merges, capture golden runs (each of the 3 fixtures in mock mode, scripted STOPs and explanations), recording displayed and spoken strings, points and rating; replay them after F1a. Is that sufficient? What would you add?
- Q2. Which of the 97 tests are *expected* to change (contract moves) vs. must stay untouched? Should the deny-list land in F1a as a ratchet (a shrinking allow-list of known violations that must reach zero in F1b)?
- Q3. Do we need Playwright in F1, or is HTTP-level plus a manual browser check enough? How would a file-ownership test work?

**evals-engineer**
- E1. What is the minimum viable eval scaffolding in F1: grader suite on the 32 cases only? promptfoo as a dev dependency, or a plain Node script first? What can be proven with fake Claude only, and what genuinely needs a key (the "catches a deliberately broken prompt" spike)?
- E2. What label format should the founder fill in for the 32 cases (gold verdict, acceptable verdicts, reasoning band?), and how long will it take them?
- E3. Estimate the cost of one live run (32 cases × old + new version, grader model and effort as today) and propose a per-run cap for the founder.
- E4. Recording format and staleness rule for `tests/fixtures/recorded/`.

## Founder dependencies (cannot be resolved by the team)

- **F-1.** Label the 32 cases in `tests/fixtures/adversarial-inputs.json` (format from E2). Blocks the first κ number, not the scaffold.
- **F-2.** Approve a per-run eval cost cap (proposal from E3). Money.
- **F-3.** API key availability: when, and in which environment. Until then the live tier exists but cannot run.
- **F-4.** Policy for F1 prompt-text changes while no key exists: (a) block W7's prompt part until the gate can run, (b) a founder waiver `DECISION` accepting replay-only evidence for F1, or (c) accept if W7 is proven byte-identical in rendered form (pending A5).
- **F-5.** Phase scope: confirm W10 (`web/speech/`) and W12 (`ts-fsrs`) placement. The `decisions.md` F1 row and `voice-first.md` §7 disagree on speech, and `decisions.md` F2 still says "Leitner" while `system-architecture.md` says FSRS from day one.

## Options (summary)

1. **One F1 spec.**
2. **F1a + F1b** (PM's recommendation).
3. **F1a + F1b + F1c.**

---

<!-- Entries go below, append-only. Heading format:
### <role> · <YYYY-MM-DD> · POSITION | CHALLENGE | EVIDENCE | RESPONSE | RISK | DECISION
A POSITION states its confidence (low / medium / high) and what would change the writer's mind.
A DECISION states the call, its rationale, the dissent recorded, and follow-ups. -->

## Entries

### technical-product-manager · 2026-10-09 · POSITION
**Answering:** scope and slicing

**Slice it as Option 2: `F1a-server-owned-cards`, then `F1b-agnostic-prompts-and-evals`.**
- **Critical path free of founder blocks.** Everything in F1a can be built and proven with fake Claude today. Every founder dependency (F-1 to F-4) and the missing API key falls in F1b. In one spec, they would hold the whole phase "in progress".
- **F1a closes the only invariant that is a data-integrity hole.** Today, `index.js` sends every answer to the browser. Inv. 2 / D12 is the reason "server-owned cards" exists, and every F2 feature (resume, learner model, probes) assumes events and cards live on the server.
- **W3 (registry + `llm_call`) belongs in F1a, not F1b.** It is small, and cards must be stamped with `prompt_version` (`system-architecture.md` §4: "a db constraint rejects rows without them"). Adding `export const VERSION` leaves prompt text unchanged, so it doesn't trigger the gate.
- **The learner-facing proof is the golden-run replay (W6),** captured before W4 merges. "All tests pass" alone isn't enough, because the contract change will legitimately rewrite some of the 97 tests.
- **Cut from F1:** W12 `ts-fsrs` (no consumer). W10 speech interface goes in F1b only if frontend confirms S with zero behavior change; otherwise it moves to F2 (founder, F-5). W11 route split goes in only if the architect says W3/W4 need it to avoid collisions.
- **Events to emit in F1a:** `started`, `step-shown`, `stopped`, `explained`, `graded`, `completed`. Each carries `context.subject = "demo-trades@1"` and `promptVersions`, so F2 projections have real data to rebuild from. `mode-assigned` waits for the A/B test (F2).

**Confidence:** medium
**What would change my mind:**
- The architect shows that W7's prompt changes are prerequisites for the card contract (for example, the scenario schema's `trade` field can't change without rewriting the prompt). Then F1a and F1b merge into one spec.
- The founder provides a key and labels within the F1a build window. Then the split buys nothing and Option 1 is simpler.
- Backend sizes W4 at more than two M tickets even after the split. Then I'd take Option 3 to keep each spec reviewable.

<!-- Round 1 (blind): positions written independently; appended by the lead in fixed role order. -->

### principal-architect · 2026-10-09 · POSITION
**Answering:** A1, A2, A3, A4, A5, slicing

Checked today: Node v22.22.0. `require('node:sqlite')` works without a flag but prints an `ExperimentalWarning` to stderr. SQLite is 3.50.4. `RAISE(ABORT)` triggers block both UPDATE and DELETE on `event`, and `PRAGMA user_version` works. `npm test` gives 97 pass, 0 fail.

**A1 (decided).**
- Use `node:sqlite` behind `server/db.js`, and set `engines` to `>=22.13`. No new dependency. If the API shifts, `better-sqlite3` can drop in behind the same wrapper.
- Append-only is enforced by triggers. Code-only enforcement doesn't count. A test runs UPDATE and DELETE and expects both to throw.
- Migrations live in `server/migrations/NNN-name.sql`. They run forward only, each in a transaction, and set `user_version` when done.
- The DB path comes from `DB_PATH`, defaulting to `data/app.db`, which is gitignored. Tests use `DB_PATH=:memory:`, so every spawned server gets its own DB. `tests/helpers/server.mjs` passes env already, so this needs no rework.
- Render stays out of F1. The free plan has no disk, so it's a mock demo with ephemeral data. Persistent hosting costs money and needs the founder.

**A2 (decided in outline; the ADR fixes the details).** The card holds the content. An attempt holds the run state, and its caught set is rebuilt from events.
- `POST /api/attempts {scenario, source?}` returns `{attemptId, card:{id, subject, title, setting, apprentice, steps:[{id,line}]}, source}`.
- `POST /api/attempts/:id/stops {stepId, explanation}` returns `{verdict, reasoningScore, feedback, source, points, total, reveal}`. `reveal` is `{stepId, severity, summary, correctAction}` only for the credited mistake, and only after grading. A false alarm gets `reveal: null` and must not hint at nearby mistakes.
- `POST /api/attempts/:id/complete` returns the `scoreRun` result. It includes `missed[]` with the answers, and the rating label comes from the pack.
- A live-generated scenario is written as a `card` row before its steps are returned.
- The old `/api/scenario` and `/api/grade` stay only until the web switches over, inside the same spec. F1a can't close while either one exists.

**A3 (decided).** Option (a) plus (b). The server keeps the keyword fallback. If the server can't be reached, the browser shows "Couldn't reach the grader. Try again or skip," keeps the explanation, and lets the learner continue. No grading happens in the browser. `system-architecture.md` §5 says offline grading uses keywords. I'm amending that: offline explanations are queued and graded on reconnect, which comes in F2 with the offline queue.

**A4 (decided).**
- Create `server/ai/gateway.js` now, plus `models.js` holding only `MODEL` and the effort constants. No `gates.js` or `fallbacks.js` until something uses them.
- W11 is **required, as the first ticket**: a mechanical split into `server/routes/*` with zero test changes. W1, W2, W3 and W4 all edit `index.js` today.

**A5 (decided).**
- A refactor that renders byte-identical prompts for *every* input (for example, adding `VERSION`) is not a text change.
- Moving subject words into the pack can't be byte-identical *and* fenced. Today those words sit unfenced in `GRADE_SYSTEM` (`grade.js:4,11,23`), and D2 makes pack text untrusted. So option (c) from F-4 is an inv. 5 shortcut, and I reject it.
- W7's prompt work is a real text change. It needs a `VERSION` bump and the live gate.
- `SCENARIO_SCHEMA.trade` (`contract.js:43`) is part of what Claude sees, so the rename to `subject` moves to F1b too.

**Slicing.** Two specs, but F1a is built in waves:
- **Wave 0:** W6 golden capture, W11, `VERSION` exports.
- **Wave 1 (parallel):** W1, W2, W3. These change no contract.
- **Wave 2:** W4, then W5, then removal of the old routes plus the leak test.

**ADRs F1 needs:**
- Storage on `node:sqlite`, with migrations and an append-only event log enforced by triggers
- Event schema v1 (`shared/events.js`, the F1 verb subset)
- The server-owned card and attempt API, with rules for when answers are revealed
- No grading in the browser; offline behavior (amends `system-architecture.md` §5)
- AI gateway and prompt registry, including what counts as a prompt text change
- Pack format v1, trust of pack text and fencing, rating keys mapped to pack labels

**Confidence:** high on A1, A3, A4 and A5. Medium on the A2 field names.
**What would change my mind:** `node:sqlite` failing under the test runner's concurrency. A frontend estimate that W5 is L. A founder waiver that explicitly accepts unfenced, trusted-provenance pack text.

### principal-architect · 2026-10-09 · RISK
**Big-bang contract swap on a working game.** W4 and W5 change every request and response at once, and 14 server tests post a full scenario. **Failure mode:** F1a sits half-migrated, with the game broken on the branch for days, and the golden replay fails in ways nobody can diagnose. **Likelihood:** M. **Impact:** H. **Mitigation:** new routes are added alongside the old ones. The web switches in one ticket. The old routes are deleted last. The W6 golden runs are captured before wave 1 and replayed after every wave.

### principal-architect · 2026-10-09 · RISK
**Founder-blocked work turns F1 into a phase that never closes.** W7's prompts and W9's live run can't finish without a key and labels, and F-4 option (c) breaks inv. 5. **Failure mode:** F1 stays "in progress" with no end date, or someone takes the byte-identical shortcut and ships unfenced pack text into the system prompt. **Likelihood:** H. **Impact:** M. **Mitigation:** F1 exits on F1a plus the F1b scaffold. The W7 prompt rewrite gets a hard dependency: no non-trades pack can ship in F2 until it has passed the gate. That makes the deadline real without stalling F1a.

### principal-architect · 2026-10-09 · RISK
**Scope creep from pulling F3 work forward.** W9's eval runner, the replay helper and the stale-recording test are code we can't exercise without a key or labels. **Failure mode:** we build scaffolding that never ran for real, picking promptfoo or a script by guess, and F3 rewrites it. **Likelihood:** M. **Impact:** M. **Mitigation:** F1b ships only the recording format, the replay in `npm test` and a `eval:live` that refuses to run without a key and a cap. The runner choice comes with the first live run.

### principal-architect · 2026-10-09 · RISK
**Chatty events add new ways to stall.** `step-shown` sent per narrated line means one POST per line during voice playback. Its only consumer is projections that don't exist yet. **Failure mode:** a slow or failed POST mid-narration needs its own handling under inv. 7, which is new failure surface for no F1 benefit. **Likelihood:** M. **Impact:** M. **Mitigation:** no per-step request in F1. The STOP and complete bodies carry `lastStepShown`, and the server writes the event from that. `step-shown` becomes a separate request only when a consumer needs it.

### principal-architect · 2026-10-09 · RISK
**Hidden coupling between files.** `shared/scoring.js:74-79` holds the rating labels, `contract.js` has `trade` in both the schema and the validator, `fake-claude.mjs:72` detects requests by sniffing the schema, and `app.js` runs `resolveStop` and `scoreRun` on the client. **Failure mode:** tickets marked `[P]` collide on the same files, or a quiet schema rename changes what the model outputs without an eval. **Likelihood:** M. **Impact:** M. **Mitigation:** `scoring.js` returns rating *keys* and the pack maps keys to labels. The schema stays unchanged in F1a. The spec's ownership table lists `shared/contract.js` under exactly one ticket per wave.

### backend-engineer · 2026-10-09 · POSITION
**Answering:** B1, B2

**Checked facts.** Node is `v22.22.0`. `node:sqlite` works (`DatabaseSync(':memory:')`, SQLite 3.50.4, so triggers and `RAISE` are available), but it prints an `ExperimentalWarning` to stderr. `render.yaml` pins `NODE_VERSION: "22"` and has no disk.

**B1: sizes (ordered), with the hidden work**
- **W11 route split: S, and I want it first.** It's a pure refactor with the current tests as the safety net. W3, W4a and W4b all edit `server/index.js` (the `grade()` function at `:87-108` and the routes at `:157-173`). Without the split, those tickets collide.
- **W1 db + migrations + events: M.**
  - `tests/helpers/server.mjs:12` passes the env straight through, so the server needs a `DB_PATH` that defaults to `:memory:` under tests.
  - `engines` goes from `>=20.12` to `>=22.13`.
  - Each test child prints the ExperimentalWarning. That's harmless, because the helper only matches stdout (`server.mjs:30`).
- **W2 pack + validator + demo-trades: M.**
  - `tests/contract.test.js:6` and `tests/validator.test.js:8-9,232-240` import `TRADES` from `server/prompts/trades.js`.
  - All 3 fixtures carry `"trade"`.
  - `validateScenario(opts.trade)` (`contract.js:95-112`) changes too.
- **W3 registry/gateway: M.**
  - The gateway needs a DB handle injected so it can write `llm_call`.
  - `tests/llm-deadline.test.js:8` imports from `server/llm.js`.
  - The mock and fallback paths in `index.js:93,106` never touch `llm.js` today, so they'd log nothing unless we add that.
- **W4a card persistence + public card: M.**
  - Live scenarios need a card row stamped with `prompt_version`. Today the server only patches `trade` and `id` on them (`index.js:73-74`).
  - **The spec also needs a `runId` alongside `cardId`.** Replaying the same card must not share `caught` state.
- **W4b STOP/complete routes: M+.**
  - `resolveStop` needs the step index and the caught set (`app.js:117`). The server has to rebuild both from events, and it has to trust a client-claimed step index (validated against range and order).
  - `isCatch` and points (`app.js:160-170`) move to the server.
  - The 9 server tests that post a `scenario` get rewritten.
  - Two M tickets is my honest upper bound.
- **W7 server side: M.** See B2.
- **W8 parts: S each.**
  - Deadline, `VERSION` and deny-list (as a ratchet) can land early.
  - "No answer to client" waits for W4b; "append-only" waits for W1.
  - `fake-claude.mjs:72` sniffing `verdict` is fine as long as `GRADE_SCHEMA` keeps that field.

**Sequence:** W6 (QA) and W11, then W1, then W2 and W3 in parallel, then W4a, then W4b, then W7.

**B2: byte-identical rendered prompts?**
Yes, with three caveats.
- **How it works:** turn the subject words into pack-supplied slots: "trade job", "journeyman", "NEC, OSHA, EPA", "trade knowledge", and the example clauses (`grade.js:11,21`; `scenario.js:16-29` "juice, nitro, fire bottle", "filter drier"). For demo-trades, the rendered text then stays byte-identical.
- **Snapshot test:** compare `{system, user}` against a frozen copy. That copy needs an injectable RNG, because `scenario.js:38` uses `Math.random`.
- **Caveat 1: the schema still changes.** Renaming `trade` to `subject` in `SCENARIO_SCHEMA` (`contract.js:41,44`) changes the request even though the text doesn't. So the snapshot must cover the full request (system + user + schema), and the rename counts as a change for the gate. I suggest dropping the field from the model schema, since the server sets it anyway (`index.js:73`).
- **Caveat 2: inv. 5.** Pack text in `scenarioUserPrompt` (`scenario.js:49-56`: brief, hazards, twists) is not fenced today. Fencing it necessarily changes the bytes, so "byte-identical" and "inv. 5 compliant" can't both be true for the scenario prompt.
- **Caveat 3: engine wording.** The templated engine text still has to read sensibly for a non-trade pack. That's a judgment for the evals engineer, not something a snapshot can prove.

**Confidence:** medium-high
**What would change my mind:** The architect rules (A5) that a schema field rename is outside inv. 4. Or the founder accepts fencing as a gated F1b change.

### backend-engineer · 2026-10-09 · RISK
The pack text in the scenario user prompt is unfenced (`server/prompts/scenario.js:49-56`), which breaks inv. 5 today. Keeping it byte-identical keeps the violation.
- **Likelihood:** H
- **Impact:** M
- **Mitigation:** Put fencing in F1b as a deliberate `VERSION` bump that goes through the gate. Allow-list it in the W8 ratchet until then.

### backend-engineer · 2026-10-09 · RISK
The W4 contract has `cardId` but no run identity. Without one, a second play of the same card inherits caught or graded state, and events can't be grouped per attempt.
- **Likelihood:** H
- **Impact:** H
- **Mitigation:** The architect adds `runId` (returned by a start call or the scenario call) to the A2 contract before W4a is specced.

### backend-engineer · 2026-10-09 · RISK
`node:sqlite` is still experimental on 22.22 (it prints a warning), and Render has no persistent disk, so the event log is wiped on every deploy.
- **Likelihood:** M
- **Impact:** M
- **Mitigation:** Pin `engines >=22.13` and put `db.js` behind a narrow API so we can swap to `better-sqlite3` if the API shifts. Decide in A1 whether Render is in F1 scope at all.

### frontend-engineer · 2026-10-09 · POSITION
**Answering:** F1, F2, F3

**F1: what changes in `web/app.js` and `web/api.js`. Size M, if the server returns the shape below.**
- **STOP resolution.** `onStop` (`app.js:117`) stops calling `resolveStop`. It records only `stepId = steps[stepIndex].id`. Resolution moves into the grade request, so there's no extra round trip and STOP latency stays the same. Today the explain panel already reveals nothing before grading.
- **Grade request.** `submitExplanation` (`app.js:148-174`) sends `{runId, stepId, explanation}`.
- **Grade response.** The server returns `{verdict, reasoningScore, feedback, source, points, caught: {errorStepId, stepsLate} | null, correctAction?}`.
  - `isCatch` becomes `Boolean(caught)`.
  - `markLine` uses `caught.errorStepId`.
  - `correctAction` is allowed under inv. 2 because it arrives after grading.
  - `scoreStop` and `game.caught` leave the browser.
  - The "Here's the right way" concatenation stays client copy, so spoken text still equals displayed text (`app.js:188-195`).
- **Results.** `finish` (`app.js:211`) can't run `scoreRun` without errors. It becomes async: `POST /api/runs/:id/complete` returns the `scoreRun` output plus the pack's clean-run line, which replaces "Clean job. Nobody got hurt." at `app.js:228`.
- **Browser fallback (`api.js:36`).** I'm against every form of client-side answer grading. Hashed or obfuscated keywords still leak answers. Proposal for A3:
  - The server already answers within `GRADE_DEADLINE_MS=8000` with `mock-fallback` (`llm.js:16`), which is under the client's 12 s timeout. So the browser fallback only runs when the server is unreachable or returns 5xx.
  - Replace it with a visible, spoken panel: "Couldn't reach the grader. Try again or skip." The explanation text is kept. Inv. 7 holds: no stall, and the fallback is shown.
  - The `/shared/mock-grader.js` import leaves `web/`.
- **Size.** About 60 changed lines in `app.js`, a rewrite of `api.js`, and one new failure-state panel. It's L if the server returns only `verdict` and the client has to rebuild scoring.

**F2: the `web/speech/` interface. It can land with zero behavior change (S).**
- **Layout.** `web/speech/index.js` is the facade; `web/speech/web-speech.js` is the provider.
- **Signatures:**
  - `speak(text, {rate, enabled}) → Promise<void>` resolves when speech ends or is cancelled. `enabled:false` keeps today's reading-time wait.
  - `listen({onInterim}) → {result: Promise<string>, stop()}`
  - `onHotword(phrases, handler) → unsubscribe`. In F1 it's a no-op stub, and `capabilities.hotword === false`.
  - `cancel()` stops speech **and** pending waits. It is today's `stopSpeaking` (`speech.js:36`); keep that pairing or STOP stops feeling instant.
  - `wait(ms)`
  - `capabilities: {canSpeak, canListen, hotword}`
- **Landing.** It's a move plus a rename, and one import line changes in `app.js`. Land it **before** W5 so both touches to `app.js` are sequential and done by the same engineer.

**F3: proving the learner sees and hears the same thing (Playwright, `MOCK=1`).**
- **Stubs at the browser API level, not at `web/speech/`,** so the same harness covers W10 and W5:
  - `speechSynthesis.speak` logs `u.text` and fires `onend` asynchronously.
  - A `SpeechRecognition` stub lets the test inject interim and final transcripts.
- **Clock.** `page.clock` drives `STEP_GAP_MS` and the reading-time waits, so STOPs land on exact steps.
- **What each run records:**
  - spoken strings, in order;
  - displayed text: transcript, verdict, feedback, points, source, score, and the results fields;
  - `document.activeElement` after each panel change.
- **Matrix.** 3 fixtures × {voice, text} × scripts:
  - clean run;
  - all missed;
  - false alarm;
  - late catch (`stepsLate` 1);
  - wrong explanation;
  - STOPs on two mistakes back to back.
- **Comparison.** Golden JSON is captured on the current code before W4, and the replay diff after W5 must be empty.
- **Extra checks:**
  - Every `/api/*` response before grading is scanned for `error`, `why`, `correctAction`, `consequence`, `keywords` and `severity`; `localStorage` is scanned too.
  - Zero console errors.
  - `page.route` aborts the grade call to show the failure panel.
  - Screenshots at 390 px and 1280 px.

**Confidence:** medium-high
**What would change my mind:**
- The architect's A2 contract returns less than `caught` + `points`. Then F1 becomes L.
- The founder wants grading offline in F1. Then we'd need a different design, such as grading queued until sync.

### frontend-engineer · 2026-10-09 · RISK
**Failure mode:** The contract keys STOP state on `cardId`. A card is replayable, so two runs or two tabs share one caught-set, and catches and scores come out wrong.
**Likelihood:** M · **Impact:** H
**Mitigation:** The start call returns `runId` (the `started` event). The STOP and complete calls take `runId`.

### frontend-engineer · 2026-10-09 · RISK
**Failure mode:** The results screen now needs the network (`finish` becomes async). A lost connection at the end of a run stalls the screen, and the "local-fallback" grading path disappears. Both are learner-visible changes, though only when something fails.
**Likelihood:** M · **Impact:** M
**Mitigation:**
- Show the running total from the points already received, with a "Retry results" button.
- The spoken copy for both failure states goes in the spec's copy table.
- The golden-run allow-list names exactly these two diffs and nothing else.

### frontend-engineer · 2026-10-09 · RISK
**Failure mode:** With real timers, golden runs are flaky, because STOP lands on the wrong step around the 900 ms gap. A diff that's really just noise then gets waved through.
**Likelihood:** H without a fake clock · **Impact:** M
**Mitigation:** Use `page.clock` plus the async `onend` stub, and run each golden run 3 times in CI to prove the output is deterministic before capture.

### qa-engineer · 2026-10-09 · POSITION
**Answering:** Q1, Q2, Q3

**Q1: golden runs are needed but not enough as proposed.** Fresh baseline: `npm test` gives `# tests 97 / # pass 97 / # fail 0`, exit 0, 6.1 s. Capture four layers per fixture (electrical, brazing, brakes) × script (perfect, one step late, false alarm, missed critical, empty explanation), in both MOCK and LIVE-against-fake-Claude:
1. **Learner-visible:** displayed transcript lines, every `speak()` argument in order, feedback text, points, rating label, and the outcome line (`app.js:228`). Assert spoken equals displayed.
2. **Outbound prompts:** the system and user text fake-Claude logged at `/__log`. Without this layer, W3 and W7 can drift prompts and nothing notices.
3. **Grading outcomes:** verdict, `source` (live, mock or fallback), and fallback label. Include one hang run and one 429 run.
4. **Screenshots** at 390 and 1280 px, used as a human diff aid and not as an assertion.

Raw API JSON should **not** be golden, because W4 changes it on purpose. Determinism gaps:
- `scenario.js:38` uses `Math.random` to pick the apprentice, so the rendered prompt isn't stable. We need an injectable seed or RNG before capture.
- `Date.now()` ids (`index.js:74`) must be normalised.
- `speak`/`wait` pacing needs Playwright `page.clock`, or golden runs take minutes and flake.

Baseline must be committed under `tests/fixtures/golden/` **before any F1 ticket merges**, made from the current `main` SHA, which goes in the file.

**Q2: what changes.**
- **Expected to change:**
  - `server.test.js`: all 12 tests share `catchBody`/`falseAlarmBody`, which post a full `scenario` (`server.test.js:12-13`).
  - `contract.test.js`: trade → fixture mapping and the `trade` field.
  - `validator.test.js`: `J` trade mismatch and the per-trade fixture loops.
  - `llm-deadline.test.js`: imports move to the gateway. Its assertions (deadlines, ≤1 retry, fallback-block parsing) must **not** loosen.
- **Untouched regression net:**
  - `scoring.test.js` (9) and `mock-grader.test.js` (10);
  - `grade-prompt.test.js` (7) and the scenario-prompt tests in `validator.test.js:231-263` (no prompt text changes in F1a);
  - `game-balance.test.js`. Its "Someone got hurt" assertion may switch to the pack's rating label but must keep the same value for demo-trades.

  Rule: any test whose assertion changes needs a line in the ticket naming the old and new assertion. Count: about 35 change, about 62 stay.

- **Deny-list as a ratchet: yes.** Commit `tests/fixtures/deny-list-allow.json` with an exact `{file, word, count}` list. The test fails if a violation is not listed, **or** if a listed one is gone (forces the list to shrink). F1b's exit criterion is that the list is empty.

**Q3: Playwright yes, in F1a.** It is installed (`/opt/node22/bin/playwright`, Chromium 1194). W5 rewrites STOP and results in `app.js`, and an HTTP check can't see what is spoken. W6 needs a browser anyway.

**File ownership:** in `npm test`, use only a deterministic check: `git ls-files` maps every path to exactly one owner from CLAUDE.md's table. Checking each ticket's diff (`git diff --name-only <base>...HEAD` against the ticket's `Files:` list) depends on the base ref, a shallow clone and the branch. So it should be a separate `npm run check:ticket F1-T03` that QA runs at verify, not part of `npm test`.

**Confidence:** high on Q2 and Q3; medium on Q1 (depends on how A2 reveals answers).
**What would change my mind:** frontend showing an equivalent spoken/displayed capture without a browser, or the architect making the git base ref reliable in CI.

### qa-engineer · 2026-10-09 · RISK
**Golden baseline is captured after W1–W3 land, or with nondeterministic prompts.** If so, "nothing changed" is unprovable. · Likelihood M · Impact H · **Mitigation:** make W6 the first ticket and a merge prerequisite. Seed the RNG and inject the clock first, as a separate behavior-neutral ticket.

### qa-engineer · 2026-10-09 · RISK
**`fake-claude.mjs:72` tells grade calls from scenario calls by looking for `verdict` in the schema.** A schema move in W3 silently misroutes stubs, and the failure-path tests could pass for the wrong reason. · Likelihood M · Impact M · **Mitigation:** route on `promptId` metadata. Add a test that fake-Claude's `/__log` records the expected prompt kind for each call.

### evals-engineer · 2026-10-09 · POSITION
**Answering:** E1, E2, E3, E4

**E1: start with a plain Node script, not promptfoo.** I checked `npm view promptfoo@0.124.1`: it is 31.7 MB unpacked with 76 direct deps (express, socket.io, opentelemetry, `posthog-node` telemetry, `python-shell`, drizzle/libsql) and needs Node ≥22.22.0. Our only dependency is `@anthropic-ai/sdk`. Its Anthropic provider would also bypass our gateway, which sets `output_config.effort`, the json_schema format, `server-side-fallback` and the deadline (`llm.js:31-47`). So we would end up writing a custom provider that calls our code anyway. Instead, `scripts/eval-prompts.js` (about 200 lines) would call the gateway, write recordings and compute metrics in a pure `evals/metrics.js`. The recording format below can feed a promptfoo provider later, at F3, when we have verifier and safety sets. This departs from `open-source-landscape.md` §5 item 5, so the architect needs to rule on it.
- **Proven without a key:**
  - The metric code: κ, confusion matrix, per-verdict κ and bootstrap CI, checked against hand-computed synthetic recordings.
  - Replay determinism: the same recording gives a byte-identical metrics JSON.
  - The staleness test.
  - Runner refusal when there is no key or no cap.
  - Cap abort: fake-claude returns a fixed `usage` of 1234/321, so the cost tally is deterministic.
- **Hidden work for QA:** fake-claude needs a scripted response queue (it serves only one grade today), and its `verdict` sniffing at `fake-claude.mjs:72` will need updating.
- **Needs a key:** the "catches a deliberately broken prompt" spike, and any κ figure.

**E2: label format.** One row per case in `evals/sets/grader/labels.json`: `{id, goldVerdict, alsoAcceptable[], reasoningBand: "0"|"0.2–0.4"|"0.7"|"1.0", feedbackMustNot?, unsure: bool, labeller, date}`. The founder sees the stopped line, the credited mistake and the explanation, but **not** the existing `expectedVerdict`, so the labels are blind. We report the founder-vs-existing disagreement separately. Time: about 10 min to read the 3 scripts, then about 2 min per case, so **1 to 1.5 hours**. Confirming the existing labels would take about 30 min, but the answers would be anchored.

**E3: cost.** I measured the rendered prompts: the system prompt is 2,816 chars and the user prompt averages 1,829 (max 2,416). With the schema that is about 1.6K input tokens. Output tokens are the big unknown: Opus 5.5 can't disable thinking, so I assume 150–1,000 at low effort. At $4/$20 per MTok, a call costs **$0.009–0.027**. One pass (32 cases × old + new = 64 calls) costs **$0.60–1.75**. I recommend 3 repeats so we can measure verdict flip rate: **$1.80–5.20**. **Proposed cap: $6 per run as a hard abort** (stop when spent plus the worst-case next call would exceed it), **and $25 per month.** The founder decides (F-2).

**E4: recording format.** `tests/fixtures/recorded/grade@<VERSION>.json` holds:
- `{promptId, promptVersion, promptSha256 (system text + schema), model, effort, sdkVersion, runDate, setSha256, labelsSha256, priceTable}`;
- `calls[]`: `{caseId, repeat, userSha256, raw content blocks, stop_reason, usage, servedModel, ms, error?, fallback}`.

We keep the raw blocks so the replay goes through `responseText` and `JSON.parse`. `userSha256` also checks that W7's rendered prompts are byte-identical (A5/B2).

**Staleness rule:** the test fails if any prompt's `VERSION` has no matching recording, or if the recording's `promptSha256` differs from the current text. That second check catches a text change without a version bump, so it doubles as an inv. 4 test.

**Confidence:** medium (low on output tokens).
**What would change my mind:** promptfoo with a custom gateway provider running offline in under a day as an optional, non-default install; or the first live run measuring output tokens above 1.5K per call.

### evals-engineer · 2026-10-09 · RISK
The F1 κ gets misread as the SC κ≥0.6 (`data-and-evidence.md` §5). That line means fairness ratings on *real* grades. Ours would be 32 adversarial cases, where the 5 false_alarm verdicts follow almost directly from the input and inflate κ, and the 95% CI is roughly ±0.2. · L: H · I: M · Mitigation: report κ without the false_alarm cases, with CIs, and label it a regression gate. The PM decides whether F1 has a κ threshold at all.

### evals-engineer · 2026-10-09 · RISK
Nobody recorded who wrote the existing `expectedVerdict` labels. If the prompt's author wrote them, using them as ground truth breaks the separation between measurer and author (0002). · L: M · I: H · Mitigation: blind founder labels (E2). Treat the existing labels as "author labels" only.

### evals-engineer · 2026-10-09 · RISK
With no key there can be no recording for any `VERSION`, so the staleness test either keeps `npm test` red or gets quietly skipped. · L: H · I: M · Mitigation: an explicit `pending` list, shrunk like the deny-list ratchet, where only a founder `DECISION` can add an entry. Ties to F-4.

### evals-engineer · 2026-10-09 · RISK
`server-side-fallback` can serve a different model at a different price inside one run. · L: L · I: M · Mitigation: record `servedModel` on every call, cost each call at that model's price, and report fallback rate per version.

### principal-architect · 2026-10-09 · DECISION
**Scope of this decision:** technical questions only (A1–A5 and the eight points raised in round 1). The PM still decides slicing and scope, and the founder still holds F-1 to F-5. So the thread status stays `open` until the PM's DECISION.

**A1: confirmed.**
- Storage is `node:sqlite` behind `server/db.js`, with `engines >=22.13`.
- Append-only is enforced by triggers.
- Migrations live in `server/migrations/NNN-*.sql`, are forward-only, and track progress with `user_version`.
- The server's default `DB_PATH` is `data/app.db`, which is gitignored. The test helper sets `DB_PATH=:memory:`. The server must not detect that it's under test.
- Render is out of F1 (mock demo only, ephemeral data).

**A2: amended. (1) Attempt identity.**
- The name is **`attemptId`**, not `runId`. The foundation event model already uses `context.attemptId` (`data-and-evidence.md` §1). `sessionId` is reserved for the F2 multi-card sitting. One term everywhere.
- **Start:** `POST /api/attempts {subject:"demo-trades", scenario:"electrical", source?:"fixture"}` returns `{attemptId, card:{id, subject, title, setting, apprentice, steps:[{id,line}]}, source}`. Before grading, nothing else may be sent.
- **STOP:** `POST /api/attempts/:attemptId/stops {stepId, explanation}` returns `{verdict, reasoningScore, feedback, source, points, total, caught}`.
  - `caught` is `null` (false alarm) or `{errorStepId, stepsLate, severity, correctAction}`.
  - I'm adopting frontend's flat `caught` and dropping my `reveal` wrapper. It's one object instead of two, keeps W5 at M, and holds exactly what `app.js:160-195` uses.
  - `stepId` must be in range and must not go backwards against earlier STOPs in the same attempt. Otherwise return 400.
- **Complete:** `POST /api/attempts/:attemptId/complete {lastStepShown}` returns the `scoreRun` fields. `missed[]` is the only place `summary`, `consequence` and `correctAction` appear for missed mistakes. It also returns `ratingKey`, `ratingLabel` (from the pack) and the pack's clean-run line.
  - It is idempotent: the `completed` event is written once and repeat calls return the same body.
  - Frontend's "Retry results" state is accepted.
- **Steps not shown:** no per-step `step-shown` request in F1.
- **Old routes:** `/api/scenario` and `/api/grade` are removed inside F1a, after W5. `/api/trades` becomes `GET /api/scenarios?subject=demo-trades`.

**A3: confirmed.**
- No grading in the browser. `mockGrade` leaves `web/`.
- When the server is unreachable or returns 5xx, the browser shows the visible and spoken panel "Couldn't reach the grader. Try again or skip." The explanation is kept.

**A4: confirmed.**
- `server/ai/{gateway,models}.js` only.
- W11 is the first code ticket after the baseline (see 5).

**A5: confirmed.**
- Option (c) is rejected under inv. 5. Backend's caveat 2 independently confirms it.
- The `trade` field rename and the fencing of `scenario.js:49-56` are F1b changes, each with a `VERSION` bump that goes through the gate.
- Backend's suggestion to drop `trade` from `SCENARIO_SCHEMA` is accepted for F1b. It is still a request change, so it goes through the gate.

**(2) Eval runner: a plain Node script in F1.** I concede my "decide at the first live run". The evidence doesn't depend on a key:
- promptfoo is 31.7 MB with 76 dependencies and telemetry.
- It requires Node ≥22.22.
- Its provider would bypass the gateway (inv. 3).

`scripts/eval-prompts.js` must call the gateway, never the SDK directly. It plus a pure `evals/metrics.js` covers the grader set only. This departs from `open-source-landscape.md` §5 item 5, so I'll write an ADR and update §5. **Revisit** at F3, when the verifier and safety sets exist, if promptfoo runs offline through a custom gateway provider as an optional dev install.

**(3) Staleness: the pending ratchet is accepted, with a pin.**
- Format: `evals/pending.json` entries are `{promptId, version, promptSha256, reason, decision}`.
- A prompt passes if it has a recording with a matching `promptSha256`, **or** a pending entry with a matching `promptSha256`. Because the hash is pinned, a text change with no recording still fails, so inv. 4 holds with no key.
- The initial `grade@1` and `scenario@1` entries pin today's text, which is unchanged, and need no founder decision.
- Any **other** new entry must link a founder DECISION. That link is checked in review, because a test can't verify it.

**(4) fake-claude routing: by prompt id.**
- The gateway sends a request header `x-prompt-id: <promptId>@<VERSION>`. fake-claude already reads headers (`fake-claude.mjs:80`).
- fake-claude stops sniffing for `verdict` (`:72`). A request without the header gets a 500 and a log line, so a misroute can't pass silently.
- QA adds the `/__log` kind test.

**(5) Determinism: yes, a separate behavior-neutral ticket T00 before W6.**
- `scenarioUserPrompt` takes an optional `rng` that defaults to `Math.random`. Its rendered output for any given draw stays identical, so `VERSION` is not bumped, and a snapshot test proves it.
- `Date.now()` ids are normalized in the capture harness, not in product code.
- `page.clock` is test-only.
- Order: T00, then W6 baseline committed with its SHA, then W11. Nothing else merges before the baseline.

**(6) W10:** technically sound. It is a pure move behind `web/speech/`, landing **before** W5 by the same engineer, and proven by an empty golden diff. If the founder places it in F1 (F-5), it goes in F1a, not F1b.

**(7) Deny-list ratchet:**
- Words live in `tests/fixtures/deny-list.json`. Violations live in `tests/fixtures/deny-list-allow.json` as `[{file, word, count}]`.
- Scan scope: `server/ shared/ web/ scripts/`, excluding `packs/`, `fixtures/` and `tests/`. Matching is case-insensitive on word boundaries.
- The test fails on any unlisted hit, and fails if an actual count is below the listed count, which forces the list to shrink. Counts may only go down.
- F1b exits when the list is empty.

**(8) File ownership: QA's split is decided.**
- `npm test` maps every `git ls-files` path to exactly one owner, parsed from the CLAUDE.md table so there is one source of truth. If the parse fails, the test fails.
- The per-ticket diff check is `npm run check:ticket <id>`, which QA runs at verify.

**Dissent recorded:**
- Backend and frontend preferred `runId`.
- Evals' F1 runner choice overrides a foundation recommendation.

**Follow-ups (ADRs, architect; written once the PM's slicing DECISION lands):**
1. Storage on `node:sqlite`, with migrations and a trigger-enforced append-only log
2. Event schema v1
3. Server-owned card and attempt API
4. No grading in the browser and offline behavior (amends `system-architecture.md` §5)
5. AI gateway, prompt registry, the `x-prompt-id` header, and what counts as a prompt text change
6. Pack format v1, trust and fencing of pack text, and rating keys
7. Plain Node eval runner for F1 (amends `open-source-landscape.md` §5.5), with the pending ratchet

The PM folds T00, the order T00 → W6 → W11, and these contracts into the specs.

### technical-product-manager · 2026-10-09 · DECISION
**Deciding:** F1 scope and slicing. A1–A5 are the architect's decisions and I take them as given. Anything below that touches phase scope or money waits for the founder (see the end of this entry).

**1. Slicing: two specs. F1a is built in the architect's three waves.**

**`F1a-server-owned-cards`**
- **Wave 0 (merge prerequisite for everything after):**
  - W6 golden capture, from the current `main` SHA, into `tests/fixtures/golden/`;
  - a behavior-neutral ticket that makes runs reproducible (injectable RNG at `scenario.js:38`, normalised `Date.now()` ids);
  - W11 route split, with zero test changes;
  - `VERSION` exports, with no prompt text change.
- **Wave 1, in parallel:**
  - W1 db, migrations, trigger-enforced `event` table, `shared/events.js`;
  - W2 pack v1 and `packs/demo-trades`. `scoring.js` returns rating keys and the pack maps them to labels. The clean-run line moves out of `app.js:228` into the pack;
  - W3 gateway, registry and `llm_call`. Mock and fallback paths also log;
  - fake-Claude routes on `promptId` instead of sniffing for `verdict` (QA-owned ticket).
- **Wave 2, in sequence:**
  - W4a: attempts and card persistence. Live scenarios are written as `card` rows before they are served;
  - W4b: the STOP and complete routes;
  - W10 `web/speech/` facade, with zero behavior change. It goes before W5 so the two `app.js` edits are sequential;
  - W5 web switch-over: no grading in the browser, and a "Couldn't reach the grader" panel;
  - removal of `/api/scenario` and `/api/grade`, plus the answer-leak test.
- **W8 tests that land in F1a:** append-only, deadlines, `VERSION`, no answer before grading, and the deny-list ratchet (QA's exact `{file, word, count}` allow-list).
- **Events:** `started`, `stopped`, `explained`, `graded`, `completed`. `step-shown` is written server-side from `lastStepShown`, with no per-line request. `mode-assigned` waits for F2.

**`F1b-agnostic-prompts-and-evals`**
- **W9 scaffold:**
  - recording format (E4) and replay in `npm test`;
  - staleness test, plus a `pending` ratchet that only a founder DECISION can add to;
  - pure `evals/metrics.js`, checked against synthetic recordings;
  - `eval:live` refuses to run without a key and a cap, and aborts at the cap;
  - fake-Claude scripted response queue;
  - `labels.json` schema (E2).
- **Plain Node runner vs. promptfoo:** this is the architect's call (it departs from `open-source-landscape.md` §5 item 5). I scope the plain-script scaffold either way.
- **W7 prompt rewrite:** pack slots, fencing pack text (inv. 5), dropping or renaming `trade` in `SCENARIO_SCHEMA`, one `VERSION` bump. It is specced and ticketed in F1b, but it **cannot merge until it passes the live gate.**

**In and out of F1**
- **In:**
  - W10, because `voice-first.md` §7 already lists it in F1 and frontend sizes it S with zero behavior change.
  - Playwright in F1a. It's installed, and an HTTP check can't hear spoken text.
- **Out:**
  - W12 `ts-fsrs`, to F2. Nothing in F1 uses it.
  - Render persistence. Persistent hosting is a money call for the founder.

**2. F1 exit criteria.** F1 exits when F1a is done and the F1b scaffold is done, with no wait for a key. Concretely:
- **(a) Golden replay.** It runs 3× to prove the output is deterministic. The learner-visible and outbound-prompt layers show an empty diff, except two allow-listed failure-state diffs: the grader-unreachable panel and "Retry results". Spoken and displayed copy for both goes in F1a's copy table.
- **(b) Old routes gone.** The leak test is green.
- **(c) Deny-list allow-list holds only prompt and schema entries.** That means `server/prompts/*` and `SCENARIO_SCHEMA.trade`. Every entry in `web/`, `shared/` and other `server/` code is gone.
- **(d) Pending list.** The staleness `pending` list holds only founder-approved entries.
- **(e) Full suite green.** `npm test` passes, and any test whose assertion changed is named in its ticket.
- **Hard rule into F2:** no non-trades pack ships until W7 has passed the gate and the deny-list allow-list is empty.

**3. κ in F1: no threshold.** The 32-case κ is not the SC κ≥0.6, which is an F3 pilot criterion based on fairness ratings of real grades. Once labels exist, F1b reports κ without the false-alarm cases, with a 95% CI, labelled "regression baseline".
- **The gate rule is pre-registered in the F1b spec before any live run:**
  - against the founder's gold labels on the 27 non-false-alarm cases, the new version agrees on at least as many cases as the old one, minus 2;
  - the new version grades no injection or "request-only" case `correct` or `partial`.
- **Existing `expectedVerdict` labels** count as author labels only.

**4. Risks raised in round 1 and how each is handled**

| Risk | Handling |
|---|---|
| Arch: big-bang contract swap | **Fixed in spec:** new routes are added alongside the old ones, the web switches in one ticket, the old routes are deleted last, and the golden replay runs after every wave |
| Arch: founder-blocked F1 never closes | **Fixed in spec:** exit criteria in section 2 plus the F2 hard rule |
| Arch: F3 creep through the evals scaffold | **Fixed in spec:** scaffold-only scope; the runner choice comes with the first live run |
| Arch: chatty `step-shown` | **Fixed in spec:** `lastStepShown` on STOP and complete; no per-line request |
| Arch: hidden coupling between files | **Fixed in spec:** rating keys mapped to pack labels; schema unchanged in F1a; `shared/contract.js` owned by exactly one ticket per wave |
| Backend: unfenced pack text in the scenario prompt | **Accepted until W7:** it sits on the ratchet allow-list; the fix is gated W7 |
| Backend and frontend: no run identity | **Fixed:** A2 `attemptId`. The STOP response must carry enough for `markLine` and points (`reveal.stepId`, `points`, `total`). Field names are settled in the architect's ADR |
| Backend: `node:sqlite` experimental, Render ephemeral | **Accepted:** narrow `db.js`, `engines >=22.13`, Render out of F1 |
| Frontend: results screen now needs the network | **Fixed in spec:** running total plus "Retry results", copy table entry, and the golden allow-list names these 2 diffs only |
| Frontend: flaky golden runs | **Fixed in spec:** `page.clock`, async `onend` stub, 3× determinism run before capture |
| QA: baseline captured too late or with nondeterministic prompts | **Ticket:** wave 0 reproducibility ticket, and W6 as a merge prerequisite |
| QA: fake-Claude misroutes after W3 | **Ticket:** route on `promptId`, plus a `/__log` kind test (wave 1) |
| Evals: F1 κ misread as the SC | **Fixed in spec:** section 3 |
| Evals: author-written labels | **Fixed in spec:** blind founder labels (F-1); existing labels tagged "author" |
| Evals: staleness test red or quietly skipped | **Fixed in spec:** `pending` ratchet; adding an entry needs a founder DECISION (F-6) |
| Evals: fallback model priced wrongly | **Fixed in spec:** `servedModel` recorded and costed per call; fallback rate reported per version |
| Also, from my own check | This checkout reports "not a git repo". So QA's `git ls-files` ownership test must not fail and must not skip silently without git. QA and the architect pick the approach in the F1a spec review |

**Dissent recorded**
- **QA:** F1b's exit should be an empty deny-list. I hold prompt entries until the gate can run, because merging W7 without the gate would break inv. 4.
- **Evals vs. `open-source-landscape.md`:** promptfoo vs. a plain script. The architect decides.
- **Frontend's proposed response shape vs. A2:** the architect's ADR decides. Frontend has said W5 becomes L if the response lacks catch data and points.

**Founder questions still open**
- **F-0 (phase scope).** Do you accept that F1 exits with the prompt-text half of "subject-agnostic prompts" written but held at the gate? It would be guaranteed only before the first non-trades pack in F2. This changes what the `decisions.md` F1 row promises.
- **F-1.** Blind-label the 32 cases in the E2 format (about 1–1.5 h). When can you do it? Separately: do you know who wrote the existing `expectedVerdict` labels?
- **F-2.** Approve the eval cost cap. The proposal is **$6 per run as a hard abort, and $25 per month.** Estimated runs cost $1.80–5.20 with 3 repeats.
- **F-3.** Where and when will an Anthropic API key be available? There is none in the cloud environment, so every live path is tested only through fake Claude.
- **F-4 (updated).** Option (c), byte-identical prompts, is rejected by the architect under inv. 5. That leaves:
  - (a) hold W7 at the gate until there is a key and labels (my recommendation);
  - (b) a waiver DECISION that accepts replay-only evidence.
- **F-5 (updated, confirm only).** W10 is in F1 and W12 FSRS moves to F2. Render persistence is out of F1, and turning it on later costs money.
- **F-6 (new).** Approve the initial staleness `pending` entries for `grade@<v1>` and `scenario@<v1>`. Without a key no recording can exist for them.

**Follow-ups**
- **Architect:** the 6 ADRs listed in the architect's entry, plus the eval-runner choice. Foundation doc fixes:
  - `decisions.md` F1 row (speech interface and exit criteria);
  - `decisions.md` F2 row ("Leitner" should be FSRS);
  - `system-architecture.md` §5 (offline grading).
- **PM:** write `docs/specs/F1a-server-owned-cards/` now. It has no founder dependency. Write `F1b-agnostic-prompts-and-evals/` after F-0 and F-4 are answered.
- **Lead:** set Status to `decided` (scope part; F-0 to F-6 pending with the founder) and update the INDEX row.

### founder · 2026-10-09 · DECISION
*Recorded by the lead session from the founder's own answers in the chat on 2026-10-09.*
- **F-0: accepted.** F1 exits with the W7 prompt rewrite written but held at the gate. The F2 hard rule stands: no non-trades pack ships until W7 passes the live gate and the deny-list allow-list is empty.
- **F-1: yes.** The founder will blind-label the 32 cases. Who wrote the existing `expectedVerdict` labels was not answered, so they stay tagged "author".
- **F-2: approved.** $6 per run as a hard abort, $25 per month.
- **F-3: later.** The founder will say when a key is available. Until then, every live path is tested only through fake Claude.
- **F-4: option (a).** Hold W7 at the gate until a key and labels exist. No waiver.
- **F-5: confirmed.** W10 `web/speech/` is in F1, FSRS moves to F2, and Render persistence is out.
- **F-6: approved.** `grade@1` and `scenario@1` are the initial `pending` entries.

### founder · 2026-10-09 · DECISION
*Recorded by the lead session from the founder's own answer in the chat on 2026-10-09.*
**F1a OI-8 (file ownership): approved as the architect proposed in `docs/specs/F1a-server-owned-cards/review.md`.** The rows were added to the `CLAUDE.md` ownership table, which unblocks F1a-T11.

### learning-designer · 2026-10-09 · RISK
*Appended by technical-product-manager, verbatim from the draft entries at the end of `docs/specs/F1a-server-owned-cards/learning-review.md` (the designer was asked to edit only that file).*
Skip after "Couldn't reach the grader" scores a caught mistake as missed (ADR 0004): full penalty, possibly "Someone got hurt", and a spoken consequence for a hazard the learner did stop.
Likelihood L · Impact H on that run (false feedback, demotivation), M on data (FSRS "Again", catch-rate bias, permanent in the log) · Mitigation: `complete` takes `skippedStepIds`; the server scores those mistakes "not graded" and logs the skip (learning-review.md findings 1–2, Option B). Minimum: honest copy plus a browser-side "not graded" label (Option A).

### learning-designer · 2026-10-09 · CHALLENGE
*Appended by technical-product-manager, verbatim from `learning-review.md`.*
"Couldn't load your results. Your score so far is {total}." The total leaves out missed penalties and puts points ahead of the corrective reveal. Proposed: "Couldn't load your results yet. Retry to see what you missed and the right way to do it." (finding 4)

### learning-designer · 2026-10-09 · POSITION
*Appended by technical-product-manager, verbatim from `learning-review.md`.*
**Answering:** OI-9. Deferring to F2 is acceptable: in F1, voice mode still needs the screen, and the full three-part feedback is displayed. Conditions: an F2 acceptance criterion, a fix before hands-free play ships, and no repeat of the gap in new F1a strings.
**Confidence:** medium
**What would change my mind:** evidence that the founder plays F1 without looking at the screen.

### technical-product-manager · 2026-10-09 · DECISION
**The call (F1a product questions after the design review):**
1. **Skip = learning-review Option B ("not graded").** A mistake that the skipped stop would have credited earns and costs nothing. It is left out of max possible and the "Someone got hurt" rating, but it is still revealed with its summary, consequence and "Should have". A skip on a clean line costs no false-alarm penalty. The skip is logged in `completed.result.skippedStepIds`. Spec: US2.5–US2.14, edge cases, FR-042–FR-047; tickets F1a-T14, F1a-T17, F1a-T21.
2. **Designer copy adopted:** findings 3 (Option B variant, "Skip this stop"), 4 (the version without a number) and 6 (focus on "Skip this stop" after a 4xx or a second failure; the shorter repeat copy; "skip" keeps one meaning in F2). Spoken text equals displayed text for every new string. Finding 5 (OI-9) is deferred to F2 with the architect's conditions.
3. **Architect's change list 1–18 accepted in full** (review.md B1–B12, S1–S10, OI resolutions). The spec and tickets now follow ADRs 0002, 0003, 0005 and 0006 with their Amendment 1. Two tickets were split out of over-full ones by the size rule: F1a-T20 (pack.json + `shared/pack.js`) and F1a-T21 (rating keys + not-graded scoring). OI-8 is closed by the founder's DECISION above.

**Rationale:** with Option A, the learner hears "Here's what happened next" for a hazard they did stop, which is false feedback caused by our own failure (learning-review finding 1, moderate evidence). Option B tells the truth and keeps the corrective reveal. The ids are logged under both options, so the choice stays reversible.

**Recorded dissent and risk:** architect R4: under B, a client can claim skips it never made. I accept this with one learner. F3's catch rate excludes attempts with skips (spec "Events and metrics").

**Follow-ups:**
- **principal-architect:** rule on spec OI-13 [ARCH DECISION NEEDED], the contract beyond ADR 0003 Amendment 1. It covers (a) `notGraded: true` on `missed[]` items, (b) `completed.result.notGradedStepIds`, and (c) the `skippedStepIds` echo in the `complete` response. This blocks the merge of F1a-T14 and F1a-T17 only. Please also re-review the revised `spec.md` and `tasks.md`.
- **Lead:** update the INDEX row; the thread status stays `decided`.

### principal-architect · 2026-10-09 · RISK
OI-13 (a): "missed" now holds items that weren't missed. Any consumer that counts `missed.length` (F2 Results, a dashboard, a second client) over-counts, and nothing in the type system stops it.
Likelihood M · Impact M · Mitigation: the `notGraded` key is present only when true; `completed.result.missedStepIds` excludes these items; a partition test (caught, missed and not-graded are disjoint and cover every mistake); the F2 Results spec must filter on the flag.

### principal-architect · 2026-10-09 · RISK
OI-13 (b): `notGradedStepIds` is a derived value that depends on `RULES.graceSteps`, which is code, not data. If the grace rule changes, re-deriving it rewrites history, and the stored value and a recomputation disagree.
Likelihood L · Impact M · Mitigation: the stored ids are the record. A repeat `complete` and all projections read them back and never recompute (ADR 0002 Amendment 2). A scoring-rule change is a migration with a comparison.

### principal-architect · 2026-10-09 · RISK
Found in re-review: as ticketed, `complete` doesn't check the STOP in-flight mark. A `complete` during a 5 s live grade writes `completed` first, then the STOP's triplet lands after it. The result is a STOP after complete in a permanent log, and a stored total that disagrees with the graded STOPs.
Likelihood L · Impact H (inv. 6 makes it permanent) · Mitigation: `complete` returns 409 while a STOP is in flight. Both handlers share one per-Session mark, with no `await` inside the read-then-write sections, plus a test (ADR 0003 Amendment 2; review.md round 2, change 3).

### principal-architect · 2026-10-09 · RISK
OI-13 (c): the echo is still a client claim. The note can report skips the client invented (R4).
Likelihood L · Impact L · Mitigation: only the claimant sees the note; F3's catch rate excludes attempts with skips; the ids are logged.

### principal-architect · 2026-10-09 · DECISION
**The call (spec OI-13, the Option B contract, plus the F1a re-review):**
1. **(a) Accepted, narrowed.** `missed[]` items carry `notGraded: true` only when true, never `false`, with `points: 0`. They keep the reveal fields, and ordinary items keep exactly six keys. A separate `notGraded[]` array is rejected.
2. **(b) Accepted, extended.** `completed.result.notGradedStepIds` is always written. `missedStepIds` excludes not-graded ids, and caught, missed and not-graded partition the card's mistakes. Stored skip and not-graded ids are read back and never recomputed, including by a repeat `complete`.
3. **(c) Accepted.** The `complete` response always carries `skippedStepIds`, the effective ids (body minus graded), equal to the stored value. The browser counts its note from it. `notGradedStepIds` isn't on the wire.
4. **New rule:** `complete` while a STOP is in flight for the same attempt → 409, with no events.
5. **Interfaces confirmed:** `run({prompt})` takes the prompt module namespace, or any `{PROMPT, VERSION}` object. `createSession({db, packs, gateway, mock})` and the pure `planStop` stay in `server/services/session.js`. The session's dependencies must be passed down to `content.cardForAttempt` and `assessment.gradeStop`.
6. **Verdict on revision 2: APPROVED WITH CHANGES.** B1–B12 and S1–S10 are all applied, and there are no [P] collisions after the T20/T21 split. Four ticket-local changes remain (review.md "Re-review (round 2)" 1–4). Waves 0–1 and T15 may start now. T12, T13, T14 and T17 start after the PM applies the changes. There is no round 3; I verify them in code review.

**Rationale:** Option B's data has to stay true in a log that can't be corrected. That means one representation per fact (a flag on the wire, ids in the log), stored judgements instead of re-derived ones, and no write order the server can't defend.

**Dissent recorded:** none from the PM; the proposal was accepted in substance. R4, R6 and R9 are accepted risks with one learner.

**Follow-ups:**
- **Done:** ADR 0002 Amendment 2, ADR 0003 Amendment 2, ADR 0004 Amendment 1, and the `decisions.md` D18, D19 and D20 rows (the stale OI-8 "Pending founder" row is closed).
- **PM:** apply review.md round 2 changes 1–4 to `spec.md` and `tasks.md`.
- **Architect:** update `system-architecture.md` §5's Skip row (S14).
- **Lead:** update the INDEX row; the thread status stays `decided`.

### lead · 2026-10-09 · EVIDENCE
The PM applied round-2 required changes 1–4, S12, S13 and O3 to the F1a spec and tasks. Spec status is now **Approved** (revision 3). The architect fixed S14 in the foundation docs (commit 944b6b3). Next: pressure test in thread 0004.
