---
id: m2-ref-08
title: Agent failure modes in production - loops, runaway cost, flaky tools, partial failure, idempotency
module: m2
verified: 2026-10-15
status: trusted reference (no planted errors)
---

# Agent failure modes in production: loops, runaway cost, flaky tools, partial failure, idempotency

## Objective

Recognise the failure modes that appear once an agent runs for real users, and name the control for each.

## Explanation

### Loops
- **What happens:** the agent calls the same tool with the same arguments again and again, or alternates between two actions, because a tool keeps failing, a goal can't be reached, or it never sees the result it expects.
- **Controls (outside the model):** a step cap; a per-task token or cost budget; repeated-call detection (same tool and arguments N times); no-progress checks; escalation when any limit fires. Sampling settings such as temperature don't bound a loop; loops happen at any temperature.

### Runaway cost
- **Why it happens:** each step resends the growing conversation, so cost grows faster than the step count; parallel subagents multiply it; a loop runs until something stops it.
- **Controls:** hard budgets per task and per user; spend alerts per hour or day (not only the monthly bill); prompt caching for the stable prefix; smaller models for routine steps; truncating large tool results; logging tokens per step so cost per task is visible.

### Flaky tools
- **What happens:** timeouts, rate limits, 5xx errors, partial or malformed responses.
- **Controls:**
  - a timeout on every tool call;
  - bounded retries with exponential backoff and jitter, only for calls that are safe to repeat;
  - a circuit breaker that stops calling a failing dependency for a while;
  - an instructive error result (`is_error: true`, what failed, what to try) so the model can adapt or tell the user;
  - a fallback path (a human, a "we'll follow up" message), so the run degrades instead of stalling.

### Partial failure
- **What happens:** a multi-step task fails after some steps already changed the world (the order was cancelled, the rebooking failed).
- **Controls:**
  - durable task state recording which steps completed;
  - **resume from the last completed step** rather than restarting (Anthropic's research team built systems "to resume from where the agent was when the errors occurred");
  - compensating actions to undo partial work (the "saga" pattern);
  - an honest report to the user of what was and wasn't done.

### Idempotency
- **The problem:** retries are everywhere: your HTTP client, the SDK, a queue redelivering, and the model itself calling a tool again after an unclear result. A retried write without protection can charge, refund or email twice.
- **Idempotency keys:** each **logical action** gets one unique key, created by your code (for example derived from the order ID and the action), stored, and sent with every attempt of that action. The server records the key and treats repeats as duplicates, returning the original result instead of acting again. Amazon's Builders' Library describes this as a caller-provided client request token (EC2's `ClientToken`).
- **The key must be stable across retries.** A key generated fresh on each call (by the model or by a retry loop) defeats the mechanism: every attempt looks new.
- **Check-then-act** is a second layer: before refunding, look up whether a refund for this order already exists.

### Versioning
- A prompt, model or tool change mid-task can break a running agent. Pin versions per run and roll out gradually; Anthropic's research team used rainbow deployments to avoid disrupting running agents.

### Observability
- Trace every step (model call, tool call, arguments, result, tokens, latency) under one task ID, so failures can be diagnosed and cost per task computed.

## Systems-engineering analogy

**This is fault-tolerant design for a distributed control system.** Watchdogs bound loops, current limits bound cost, debounced retries handle noisy sensors, and transaction logs make recovery safe.

**Where it breaks down:**
- A controller's retry logic is fixed code. Here the model can decide on its own to call a tool again, so the protection must sit in the tool, not in the caller.
- Physical actions are often visibly done or not done. A timed-out API call may have succeeded, which is exactly why idempotency keys exist.
- Plant faults follow physics. Agent faults can be triggered by text in the input.

## Watch for

- Retries are kept, and made safe with stable idempotency keys per logical action.
- Loops and cost are bounded by budgets, caps and detection in code, with alerts that fire within hours.
- A half-finished task resumes from saved state or compensates; it doesn't blindly re-run completed side effects.
- Every tool call has a timeout and a clear error result, so the run degrades instead of hanging.

## AWS mapping (verify)

- AWS Step Functions states support `Retry` (with backoff) and `Catch` settings, used to build sagas with compensating steps. `verified: "UNVERIFIED"`
- AWS SDKs retry throttled and transient errors by default, with configurable retry modes. `verified: "UNVERIFIED"`
- Amazon's Builders' Library articles "Making retries safe with idempotent APIs" and "Timeouts, retries, and backoff with jitter" describe client request tokens and jittered backoff. `verified: "UNVERIFIED"` (search snippets only; aws.amazon.com not reachable here)

## Sources

- Anthropic, How we built our multi-agent research system (2025), stateful errors, resume, rainbow deployments, tracing: https://www.anthropic.com/engineering/multi-agent-research-system (fetched 2026-10-15)
- Anthropic docs, Handle tool calls (`is_error`, instructive error messages): https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls (fetched 2026-10-15)
- Anthropic, Building effective agents (stopping conditions): https://www.anthropic.com/engineering/building-effective-agents (fetched 2026-10-15)
- Amazon Builders' Library, Making retries safe with idempotent APIs: https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/ (search snippets only, 2026-10-15)
- Amazon Builders' Library, Timeouts, retries, and backoff with jitter: https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/ (cited from memory; not fetched)
- Stripe API docs, Idempotent requests: https://docs.stripe.com/api/idempotent_requests (cited from memory; not fetched)
- AWS to verify: https://docs.aws.amazon.com/step-functions/latest/dg/concepts-error-handling.html
