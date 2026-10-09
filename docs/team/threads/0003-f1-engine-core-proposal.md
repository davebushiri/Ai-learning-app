# 0003: F1 engine core: scope, slicing and open questions

**Type:** PROPOSAL
**Status:** open
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
