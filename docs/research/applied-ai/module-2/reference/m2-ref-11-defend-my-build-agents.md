---
id: m2-ref-11
title: Defend my build - how this app relates to agents (honest talking points)
module: m2
verified: 2026-10-15
status: trusted reference (no planted errors). Facts are taken from docs/research/applied-ai/defend-my-build.md; re-check numbers there before the interview.
---

# Defend my build: how this app relates to agents (honest talking points)

## Objective

Talk about agents using your own project truthfully: what the app does, why it doesn't use an agent, which production habits carry over, what you would add, and what you must not claim.

## The facts (from the dossier)

- **The product has no agents and no tool calling.** It makes two single-shot calls (generate a scenario, grade an answer) with structured JSON output, no `tools` array and no loop (dossier §3, `gateway.js` request body).
- **Every call goes through one gateway** that enforces a JSON schema, a hard deadline (`AbortSignal.timeout`; 8 s for grading, 40 s for scenarios), `maxRetries: 1`, typed error handling, a **required** non-AI fallback, and exactly one log row per call with prompt version, model, latency and tokens (dossier §2.1).
- **No live model call has been verified in this repo.** All "live" tests run against a fake Claude server that simulates hangs, 429s, refusals and bad JSON (dossier §2.6, §3).
- **The server, not the model, decides false alarms** in grading, and model output is validated after the schema (dossier §2.1, §5.4).
- **The practice engine** (the second engine) keeps answers on the server, appends events for every stop, answer, grade and self-rating, and grades with a deterministic matcher that says "uncertain" instead of guessing. A held-out test set caught overfitted grader changes, and they were dropped. The keyword grader still fails its own pre-registered accuracy gates, so self-rating is the learner's main signal (dossier update, 2026-10-14/15).
- **The development process was multi-agent:** seven AI agent roles (PM, architect, engineers, QA, evals, learning designer) with tool allow-lists, file ownership, decision rights and review gates. The code is AI-written under your direction; you set direction, designed the process and gates, made the recorded decisions, playtested and merged (dossier §4).
- **Not built:** RAG, embeddings, agents, AWS, deployment, real users (dossier §3, §6).

## Talking points that are true

1. **"The app doesn't need an agent, and here's why."** Both AI tasks in the app are single-step: generate one scenario, grade one answer. The guidance is to use the simplest design that works (m2-ref-03), so a single structured call through a gateway fits. An agent would add cost, latency, variation and a larger attack surface for no gain. Present this as a justification of the design, not as a decision you recorded at the time: the repo has no record of agents being considered and rejected.
2. **"The production habits an agent needs are the ones the app's gateway enforces."** The gateway was AI-written under your direction; say so if asked who built it. Map them:

| Agent production concern (m2-ref-08) | What exists in this app | Honest gap |
|---|---|---|
| Bounded calls, flaky dependencies | Hard deadline per call, `maxRetries: 1`, typed timeout handling | No multi-step loop, so no step cap or budget per task |
| Degrade, don't stall | A fallback is a required parameter of every AI call, and the UI labels it | No tool errors to handle, because there are no tools |
| Observability and cost | One log row per call: prompt version, model, ms, tokens | No multi-step traces; dollar cost is never computed |
| Model proposes, code decides | Schema, then parse and validate; the server overrides the model on false alarms | No tool authorization, because there are no tools |
| Untrusted input | Learner text is fenced and capped in the grading prompt | Pack text is not yet fenced in the scenario prompt (known gap) |
| Evaluation discipline | Failure-mode tests against a fake API, a golden replay, a blind held-out set that caught overfitting | No model-quality measurement and no live calls; the keyword grader fails its own accuracy gates |

3. **"I have real experience orchestrating AI agents, as a development team."** Roles with tool allow-lists (least privilege), file ownership (no two agents writing the same file), decision rights, and gates (spec, design review, test-driven build, QA verdict, code review, human merge). Lessons:
   - when agents were cut off by a usage limit, their mixed checkpoint commit broke per-ticket traceability, so the rule became one checkpoint per ticket (a partial-failure lesson);
   - a held-out set, written blind, showed that grader tuning had overfit (an evaluation lesson).
   Say clearly that this is agents used to **build** software, not an agent shipped **in** the product.
4. **"How I would add one small agent" (an idea, not built).** A tutor agent that answers questions about this codebase with **read-only** tools (`search_repo`, `read_file`), a step cap, a deadline per step, all calls through the same gateway, and an evaluation of about 20 real questions graded on the final answer, run several times each. That reuses the gateway's guarantees and keeps the blast radius at zero writes.

## Don't claim

- that you built, shipped or ran an agent or tool calling in this product;
- that you weighed agents and rejected them at design time (no such decision is recorded; argue the fit now instead);
- that the grader works well (it fails its own accuracy gates);
- that anything is "in production", deployed, or has users;
- that you measured model or grader quality against human labels with live calls;
- that you hand-wrote the code;
- anything about AWS from experience.

## How to say it in one breath

"In my own project the AI tasks are single-step, so it uses structured single calls through a gateway with deadlines, bounded retries, a required fallback and per-call logging, rather than an agent. It's tested against a simulated API; there are no live calls or users yet. Where I do have agent experience is running a team of AI coding agents with least-privilege tools, ownership rules and review gates. If I added an agent, it would be read-only first, with step caps, budgets and an evaluation on repeated trials."

## Sources

- `docs/research/applied-ai/defend-my-build.md` (the dossier; repo-internal, read 2026-10-15)
- `docs/team/threads/0007-applied-ai-aws-track.md` (held-out evaluation result and founder decision, 2026-10-15; repo-internal)
- m2-ref-03 (workflows vs agents) and m2-ref-08 (production failure modes) in this module
