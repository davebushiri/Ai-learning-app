# Decisions and open questions

## Decided

| # | Decision | Rationale | Alternatives rejected |
|---|---|---|---|
| D1 | **Subject-agnostic engine. All subject content lives in versioned packs.** | Build the foundation once and prove it on any subject | Hard-coding a first domain (the earlier PMP-first plan) |
| D2 | **Subjects are AI-built with the learner in the loop.** Hand-authored packs use the same format. | Lifelong learning means any topic; the review step guards quality | Only curated packs: doesn't scale to personal goals |
| D3 | **Prerequisites stay shallow and editable,** marked by confidence | LLMs extract prerequisite links poorly | A deep auto-generated prerequisite graph |
| D4 | **The learner's own errors reshape the pack** (Mistake Miner) | LLM-imagined mistakes don't match real learner errors; yours do | Static AI-generated mistake libraries |
| D5 | **The competency ladder:** lesson → guided → stop → next move → review | Error-finding hurts novices without prior knowledge | Straight into hidden-mistake play |
| D6 | **Coarse rubric** (identified yes/partly/no; why 0–2; fix 0–2) plus a confidence flag and deferral | LLM-human grading agreement degrades with finer rubrics; deferral improves accuracy | A fine 0–10 score |
| D7 | **Event-sourced storage in SQLite,** projections rebuildable | Formula changes without data loss; a full audit trail for the evidence | Mutable mastery tables only |
| D8 | **xAPI-shaped events** | Familiar to L&D buyers and exportable later | A custom ad-hoc log |
| D9 | **Built-in trained vs. held-out evidence design** | The only clean way to show learning with one learner | Engagement metrics only |
| D10 | **Every AI output is stamped with prompt version and model, and prompt changes go through an eval gate** | Comparable data; no silent regressions | Editing prompts freely |
| D11 | **Vanilla JS, Node, SQLite, PWA; no framework** | Solo founder; the existing stack works and is tested | React/Next rewrite |
| D12 | **Server owns cards; the client never sees answers before grading** | Integrity of the data and the evidence | Client-held scenarios (the hackathon shortcut) |
| D13 | **The trades scenarios become `packs/demo-trades`,** used in onboarding | Keeps the hackathon work and teaches the mechanic in 30 s | Dropping them |
| D14 | **Voice-first sessions, with full text mode as an option. A within-person A/B test (randomized per session) checks the choice** | Hands-free active listening suits focus; speaking the explanation is the self-explanation step. The test confirms it for you. | Text-first with voice optional |
| D15 | **Assemble, don't rebuild.** Use permissive open-source libraries for everything except the differentiators. No GPL/AGPL code in our codebase. See [`open-source-landscape.md`](open-source-landscape.md). | The core loop exists nowhere; everything around it does | Building speech, scheduling and evals ourselves |
| D16 | **Team: 5 core agents plus 2 on-call specialists (`evals-engineer`, `learning-designer`), one owning role per path; specialists never edit product code** | The gaps were independent AI-quality measurement and learning design; adding agents brings cost and blurs ownership, so on call with strict file ownership. See [team thread 0002](../team/threads/0002-is-this-the-right-team.md). | Keep 5 (QA owns evals); a standing 8–10 agent team |
| D17 | **Storage on `node:sqlite` behind `server/db.js`; forward-only migrations; append-only `event` enforced by triggers.** See [ADR 0001](../adr/0001-sqlite-storage-and-append-only-event-log.md). | No new dependency; inv. 6 enforced by the database itself | `better-sqlite3` now; code-only append-only; a migration library |
| D18 | **Event schema v1:** xAPI shape, `evt_` + ULID ids, `seq` ordering, the F1 verbs `started`/`stopped`/`explained`/`graded`/`step-shown`/`completed`; additive-only changes. See [ADR 0002](../adr/0002-event-schema-v1.md). | Attempts rebuild from events; no per-line request | Full vocabulary in F1; ordering by `at`; per-line `step-shown` |
| D19 | **Server-owned card and attempt API** (`/api/attempts`, `…/stops`, `…/complete`); `caught: null \| {errorStepId, stepsLate, severity, correctAction}` revealed only after grading. See [ADR 0003](../adr/0003-server-owned-card-and-attempt-api.md). | Closes inv. 2; `attemptId` matches the event model | `runId`; a `reveal` wrapper; keeping `/api/scenario` and `/api/grade` |
| D20 | **No grading in the browser;** an unreachable grader shows "Try again or skip". See [ADR 0004](../adr/0004-no-grading-in-the-browser.md). | Any grading on the client needs the answers on the client | Obfuscated keywords on the client; offline grading in F1 |
| D21 | **AI gateway `server/ai/gateway.js`** with a required fallback, one `llm_call` row per call, an `x-prompt-id` header, and a prompt fingerprint that defines a "text change". See [ADR 0005](../adr/0005-ai-gateway-and-prompt-registry.md). | Inv. 3 and inv. 4 become structural and testable | Keeping `llm.js`; hashing the system text only; byte-identical-but-unfenced prompts |
| D22 | **Pack format v1:** pack text is always untrusted and fenced; `scoreRun` returns a rating *key* and the pack holds the labels. See [ADR 0006](../adr/0006-pack-format-v1.md). | Subject words leave `shared/` and `web/`; packs immutable per version | Full `ai-flow.md` §3 format now; trusted hand-authored packs |
| D23 | **A plain Node eval runner through the gateway in F1, not promptfoo;** recordings replayed in `npm test`; a pinned `pending` ratchet. Amends `open-source-landscape.md` §5 item 5. See [ADR 0007](../adr/0007-plain-node-eval-runner.md). | promptfoo's provider would bypass the gateway; 76 dependencies plus telemetry | promptfoo now; Inspect AI (Python) |

## Open questions

| # | Question | Options | How we'll decide |
|---|---|---|---|
| Q1 | Which 2 pilot subjects? | One you can judge plus one new to you (recommended) | You pick after Phase F1 |
| ~~Q2~~ | ~~Voice-first or text-first?~~ | Resolved: voice-first, see D14 | |
| Q3 | Grader model | Opus 5.5 low effort vs. Haiku 5.5 vs. Sonnet 5.5 | Eval set plus κ on your fairness ratings; cost per session |
| Q4 | How long is the evidence window? | 2, 3 or 4 weeks before crossover | Probe volume: we need about 20 or more probe items per arm |
| Q5 | Do probes use the same format as practice, or exam-style multiple choice? | Same format (cleaner comparison) vs. MCQ (transfer) | Probably both, tagged |
| Q6 | Reminders | None, local notifications (PWA), or email | Phase F3 |
| Q7 | Product name | "Stop the Apprentice" (umbrella), or something new | Before any public pilot |
| Q8 | Ownership with the hackathon team | Agreement, license, or a clean rewrite of the shared parts | Before commercial use |

## Pending founder (from [thread 0003](../team/threads/0003-f1-engine-core-proposal.md))

None of these is decided. Anything below marked "pending founder F-n" waits for the matching answer.

| # | Question | Team proposal | Blocks |
|---|---|---|---|
| F-0 | Phase scope: does F1 exit with the prompt-text half of "subject-agnostic prompts" written but held at the gate, guaranteed only before the first non-trades pack (F2 hard rule)? | Yes | The F1 row's exit criteria below; the F2 hard rule |
| F-1 | Blind-label the 32 grader cases (format: thread 0003 E2); who wrote the existing `expectedVerdict` labels? | About 1–1.5 h | The first κ baseline |
| F-2 | Eval cost cap | $6 per run as a hard abort; $25 per month | Any `eval:live` run ([ADR 0007](../adr/0007-plain-node-eval-runner.md)) |
| F-3 | When and where an Anthropic API key is available | — | Every live run; W7 passing the gate |
| F-4 | W7 prompt rewrite with no key: (a) hold at the gate, or (b) waiver accepting replay-only evidence. (Option (c), byte-identical prompts, is rejected under inv. 5; [ADR 0005](../adr/0005-ai-gateway-and-prompt-registry.md).) | (a) | W7 merge |
| F-5 | Confirm W10 (`web/speech/` facade) in F1, `ts-fsrs` in F2, Render persistence out of F1 (costs money) | Confirm | The F1 and F2 rows below; [ADR 0001](../adr/0001-sqlite-storage-and-append-only-event-log.md) hosting |
| F-6 | Approve the initial staleness `pending` entries `grade@1` and `scenario@1` | Approve (they pin unchanged text) | The staleness test in F1b ([ADR 0007](../adr/0007-plain-node-eval-runner.md)) |

## Build phases

| Phase | Scope | Proves |
|---|---|---|
| **F1: Engine core** | SQLite and the event log; server-owned cards; pack format and the `demo-trades` pack; subject-agnostic prompts and UI copy; deny-list test (as a ratchet); prompt registry with versions; LLM call log; the `web/speech/` facade (`speak`, `listen`, `onHotword` stub, `cancel`) with zero behavior change (pending founder F-5); eval scaffold (recordings, replay, staleness, `eval:live` that refuses without a key and cap). Split into specs `F1a-server-owned-cards` and `F1b-agnostic-prompts-and-evals` ([thread 0003](../team/threads/0003-f1-engine-core-proposal.md)). | Nothing new for learners. The old game runs on the new foundation, and all tests pass. **Exit criteria (pending founder F-0):** (a) golden replay, run 3×, shows an empty diff in the learner-visible and outbound-prompt layers, except two allow-listed failure states ("Couldn't reach the grader" and "Retry results"); (b) the old `/api/scenario` and `/api/grade` routes are gone and the answer-leak test is green; (c) the deny-list allow-list holds only `server/prompts/*` and `SCENARIO_SCHEMA.trade` entries; (d) the staleness `pending` list holds only founder-approved entries; (e) `npm test` is green, and every changed assertion is named in its ticket. F1 does not wait for an API key. **Hard rule into F2 (pending founder F-0):** no non-trades pack ships until the W7 prompt rewrite has passed the eval gate and the deny-list allow-list is empty. |
| **F2: Personal loop** | Subject Builder (SB-1 to SB-5) with map review; ladder stages; lesson, guided and stop cards; learner model (Elo plus FSRS via `ts-fsrs`, MIT; set-up moved here from F1, pending founder F-5); planner; Today, Session, Results and Progress screens; resume | You can build any subject and practise it daily |
| **F3: Quality and evidence** | Blind verifier and bank; nightly batch; rubric grader with confidence; fairness spot-checks; probes plus the trained/held-out experiment; evidence chart; prompt eval runner; cost dashboard | Whether it's trustworthy, and whether it teaches |
| **F4: Pilots** | Run 2 subjects for 4–8 weeks against the success criteria; Mistake Miner; next-move cards | The go/no-go data |
| **Later** | Sources and grounding, reverse mode, boss cards, multi-subject interleaving, accounts, other learners | |
