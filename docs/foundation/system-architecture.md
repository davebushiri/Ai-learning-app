# System architecture

## 1. Layers and responsibilities

| Layer | Component | Responsibility | Talks to |
|---|---|---|---|
| **Experience** | Screens (`web/screens/*`) | Onboarding, Today, Session, Results, Progress, Subjects | API only |
| | `web/state.js` | Session state rebuilt from events; resume | Offline queue |
| | `web/speech/` | Voice-first layer: TTS, speech-to-text, "stop" hotword with barge-in, voice commands, earcons, automatic fallback to text. One interface, swappable providers. See [`voice-first.md`](voice-first.md). | — |
| | Offline queue | Buffers events when offline and syncs later | API |
| **API** | `server/routes/*` | Thin HTTP handlers: validate input, call a service, shape the output | Services |
| **Engine services** | Subject Builder | Goal → subject pack (AI flow SB) | AI gateway, Packs |
| | Content Engine | Slot spec → card, from the bank or generated and verified | AI gateway, Bank |
| | Session Engine | Runs cards, resolves STOPs server-side, emits events | Content, Assessment, Events |
| | Assessment | Grades explanations and next-move choices; runs probes | AI gateway |
| | Learner Model | Projections from events: mastery, stage, review queue, calibration | Events |
| | Planner | Today's plan from goals, the learner model and the bank | Learner Model, Bank |
| | Mistake Miner | Weekly proposals of pack changes | AI gateway, Events |
| **AI gateway** | `server/ai/*` | Prompt registry, model routing, deadlines, caching, schemas, quality gates, fallbacks, cost logging | Claude API |
| **Storage** | `server/db.js` (SQLite) | Event log (source of truth), packs, bank, projections, LLM call log | — |
| **Evaluation harness** | `tests/`, `scripts/` | Fake Claude, fixtures, adversarial sets, scoring simulator, prompt A/B runner | Everything, offline |

**Boundaries that must hold:**
- **The browser never holds answers before a STOP is graded.** Cards are stored server-side by id, and the client receives steps only. This closes the hackathon "won't do" item.
- **Services are subject-agnostic.** Only packs contain subject words, and a test greps engine prompts and code for a deny-list of subject terms.
- **Shared pure logic** (`shared/`) is used by both browser and server: scoring, mastery maths, the contract validator, and the keyword grader.
- **One writer per table.** The Session Engine is the only writer of events. Projections are rebuilt only by the Learner Model.

## 2. Module layout (target)

```
web/
  index.html  app.js (router)  state.js  api.js  speech.js
  screens/ onboarding.js today.js session.js results.js progress.js subjects.js
shared/
  contract.js   scoring.js   mastery.js   review-queue.js   mock-grader.js   events.js (event schema)
server/
  index.js (dispatcher)  db.js  migrations/*.sql
  routes/ subjects.js plan.js cards.js attempts.js grade.js progress.js health.js
  services/ subject-builder.js content.js session.js assessment.js learner-model.js planner.js miner.js
  ai/ gateway.js models.js gates.js fallbacks.js
  prompts/ subject-scope.js subject-map.js subject-mistakes.js subject-world.js subject-verify.js
           card-generate.js card-verify.js grade.js lesson.js coach.js miner.js   (each exports VERSION)
packs/
  demo-trades/ (today's 3 scenarios, hand-authored)   <user-built packs live in the DB, exportable as JSON>
scripts/ simulate.js  nightly-bank.js  eval-prompts.js  export-data.js
tests/   unit, service, gateway (fake Claude), e2e (Playwright), eval sets
```

The current files map onto this layout directly:

| Today | Becomes |
|---|---|
| `server/llm.js` | `server/ai/gateway.js` |
| `server/prompts/trades.js` | `packs/demo-trades/` |
| `server/index.js` routes | `server/routes/*` |
| `web/app.js` | Split into screens plus `state.js` |

## 3. Stack decisions

| Area | Choice | Why | Revisit when |
|---|---|---|---|
| Frontend | Vanilla ES modules, no build step, hash router, PWA | The current strength: zero tooling and shared modules run in the browser unchanged | More than about 8 screens, or a need for native app features. Next step would be Preact + htm via CDN, still with no build. |
| Backend | Node 22+, plain `http`, small dispatcher | Already built and tested. No framework lock-in. | Multiple developers or many routes |
| Storage | SQLite (`node:sqlite`, wrapped in `db.js` so `better-sqlite3` can replace it) | One file, zero ops, full-text search (FTS5), easy backup | Multi-device sync, then libSQL/Turso; other users, then Postgres |
| AI | Claude via `@anthropic-ai/sdk`, structured outputs, routing per pipeline | Existing integration and hardening | — |
| Spaced repetition | Leitner boxes, then FSRS via `ts-fsrs` | Leitner is about 20 lines. FSRS is open source and benchmarked best on recall prediction in its community benchmark (SuperMemo disputes the metric). | After about 4 weeks of review data |
| Auth | None on localhost; an owner passphrase when deployed; passkeys later | Personal use first | A second user |
| Hosting | Local first; Render for remote use (`render.yaml` exists) | — | — |

## 4. Governance: how quality is kept

The rules below govern the process, and each one has an automated check.

| Rule | Enforced by |
|---|---|
| Every AI output is schema-valid and passes pack rules | Gateway gates and `validateScenario`; failures fall back |
| Generated cards pass the blind verifier before entering the bank | Content Engine; the defect is logged if they don't |
| Every stored output carries prompt version and model | Gateway stamps it; a db constraint rejects rows without them |
| Prompt changes are evaluated before shipping | `scripts/eval-prompts.js` runs the old and new versions against the eval sets (adversarial answers, fixture cards, verifier probes) and must not regress beyond thresholds |
| No subject words in engine code or prompts | Deny-list test in `npm test` |
| Learner data stays local unless exported | No outbound calls except Claude; the minimum context per call; opaque IDs |
| Flags quarantine content immediately | Session Engine excludes quarantined cards; Learner Model excludes their events |
| Mastery formula changes are migrations, not edits | Projections are rebuilt from the event log; old and new values are compared in the migration |
| Cost stays visible | `llm_call` log, plus cost per session on the Progress screen and a monthly cap |

## 5. Failure behavior

| Failure | Behavior | Learner sees |
|---|---|---|
| Claude slow or down | Deadline, then fallback | "cached" or "keyword grader (fallback)" badge |
| Generated card fails the rules or the verifier | Regenerate once, then use a banked card or fixture | Nothing; logged as a defect |
| Subject Builder fails | Retry once, then offer starter templates or narrow the scope | "Let's narrow this down…" |
| Offline | The bank and lessons are cached by the PWA, and events are queued | "Offline: grading with keywords" |
| Malformed request | 400/413, never a crash | — |
| Data corruption | The event log is append-only; projections can be rebuilt; nightly file backup | — |
