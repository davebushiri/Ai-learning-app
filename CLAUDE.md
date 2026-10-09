# CLAUDE.md

Project instructions for Claude Code and every agent working in this repo.

## What this is

A **subject-agnostic, voice-first learning game**. An AI apprentice narrates doing a task and makes planted mistakes. The learner says "stop", explains what's wrong and why, and is graded. A learner model and a planner personalize practice, and a built-in experiment measures whether learning happens.

**Source of truth for design:** [`docs/foundation/`](docs/foundation/). Read its README before changing anything structural. Specs and tickets live in [`docs/specs/`](docs/specs/).

## Commands

```bash
npm install
npm test                 # node --test, must pass before any commit (currently ~100 tests, ~6 s)
npm run mock             # app on :3000 with no API key (fixtures + keyword grading)
npm start                # live mode (needs ANTHROPIC_API_KEY in .env)
npm run simulate         # scoring balance table
```

**Live-path tests use the fake Claude API** in `tests/helpers/fake-claude.mjs`. Tests must never call the real API.

## Stack (decided; see docs/foundation/decisions.md)

- **Runtime:** Node 22+, ESM, plain `http`, no framework.
- **Frontend:** vanilla JS, no build step. It's a PWA.
- **Shared code:** `shared/` holds pure modules that run unchanged in both the browser and Node.
- **Storage:** SQLite behind `server/db.js`. The append-only event log is the source of truth.
- **AI:** Claude through `@anthropic-ai/sdk`, structured outputs only, routed through the AI gateway.
- **Libraries:** taken from [`docs/foundation/open-source-landscape.md`](docs/foundation/open-source-landscape.md). **MIT, Apache, BSD or ISC only. No GPL or AGPL code.**

## Invariants

Breaking one of these is a blocking review finding.

1. **Subject-agnostic engine.** No subject words in engine code or prompts. Subject content lives only in packs.
2. **The server owns cards.** The browser never receives a mistake's answer before the STOP is graded.
3. **Every AI call goes through the gateway** with:
   - a JSON schema;
   - a hard deadline (`AbortSignal.timeout`, `maxRetries: 1`);
   - a non-AI fallback;
   - a logged `{promptId, promptVersion, model, ms, tokens}`.
4. **Prompts export a `VERSION`.** Any text change bumps it and must pass the prompt eval gate. The gate is run by `evals-engineer` and triggered by the lead, never by the prompt's author. The live run is opt-in, with a cost cap; recordings are replayed in `npm test`.
5. **Untrusted text is fenced.** Learner text, uploads and pack text inside prompts are wrapped in tags and treated as data, never as instructions.
6. **Events are append-only.** Mastery, schedules and dashboards are projections that can always be rebuilt.
7. **Degrade, never stall or crash.** Bad input returns 400 or 413. Slow AI falls back, and the fallback is visible to the user.
8. **Voice-first, text always available.** Every flow works hands-free, and every flow works with text.
9. **Spoken text equals displayed text.**

## How work flows (the agent team)

| Step | Who | Output |
|---|---|---|
| 1. Spec | `technical-product-manager` | `docs/specs/<id>/spec.md` and `tasks.md` (tickets), with pre-registered thresholds and spoken-copy tables |
| 1b. Learning review | `learning-designer` (on call, when the spec touches learning flow, assessment or feedback) | `learning-review.md`. It advises; the PM decides. |
| 2. Design review | `principal-architect` | Spec approved or changes requested; an ADR if a new decision is made |
| 3. Build | `backend-engineer`, `frontend-engineer` (in parallel; each ticket lists the files it may touch) | Code plus tests, using test-driven development |
| 3b. Eval gate | `evals-engineer` (on call, when a diff touches `server/prompts/*`, a `VERSION` or model routing) | Live eval report and recordings for replay |
| 4. Verify | `qa-engineer` | Acceptance tests, a full run and an evidence report with **separate Functional and AI-quality verdicts**. Bugs are filed as new tickets. |
| 5. Code review | `principal-architect` | Blocking and non-blocking findings checked against the invariants |
| 6. Merge | Human | — |

**Discussion:** ideas, pushback, pressure tests, research and decisions all happen in threads in [`docs/team/`](docs/team/), using the `team-discussion` skill. Product questions are decided by the PM, technical questions by the architect, and ship / don't ship by QA. **The founder decides scope, money, direction and any deadlock.** Anything said in a live session must be written into a thread to count.

**Skills every agent follows:** `test-driven-development`, `verification-before-completion`, `writing-specs` (PM), and `architecture-decision-records` (architect), and `team-discussion` (everyone).

## File ownership (one owning role per path)

| Path | Owner (the only writer) |
|---|---|
| `server/**` including `server/prompts/*` (prompt text), `shared/**`, `scripts/` (except `eval-prompts.js`) | `backend-engineer` |
| `web/**` | `frontend-engineer` |
| `tests/**` (except `tests/fixtures/recorded/`) | `qa-engineer`, plus the ticket's engineer for that ticket's unit tests |
| `evals/**`, `scripts/eval-prompts.js`, `tests/fixtures/recorded/` | `evals-engineer` |
| `docs/specs/<id>/spec.md`, `tasks.md` | `technical-product-manager` (QA appends bugs) |
| `docs/specs/<id>/learning-review.md` | `learning-designer` |
| `docs/adr/`, `docs/foundation/`, `docs/specs/<id>/review.md` | `principal-architect` |
| `docs/team/threads/*` | Everyone, append-only |

Specialists (`evals-engineer`, `learning-designer`) never edit product code. They advise, and the existing deciders decide.

## Definition of done (every ticket)

- [ ] Acceptance criteria from the ticket are met, each one shown by a test or recorded evidence.
- [ ] `npm test` passes on a fresh run, with the output quoted.
- [ ] No invariant is broken. Any new decision is recorded as an ADR.
- [ ] Only the files listed in the ticket were touched, or the deviation is explained.
- [ ] Docs are updated if behavior or a contract changed.
- [ ] Any UI change was checked in a real browser, in both voice and text mode.

## Conventions

- **Style:** small focused files; match surrounding style; comments explain *why*.
- **Errors:** use typed SDK error classes, never match on error-message strings.
- **Commits:** imperative subject line, then a body explaining why. Don't push to `main`.
- **Copied code:** if you copy from an open-source project, record it in [`.claude/THIRD_PARTY.md`](.claude/THIRD_PARTY.md) with its license.
