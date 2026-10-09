# 0005. AI gateway, prompt registry, `x-prompt-id` header, and what counts as a prompt text change

**Status:** Accepted (technical). Whether W7's prompt rewrite can merge without a live gate run is **pending founder F-4**.
**Date:** 2026-10-09   **Deciders:** principal-architect
**Thread:** [0003](../team/threads/0003-f1-engine-core-proposal.md) (A4, A5, follow-up 4)

## Context
- `server/llm.js` already has deadlines and `maxRetries: 1` (`llm.js:48`). But it only `console.log`s, has no `promptId` or `VERSION`, and writes no `llm_call` rows (inv. 3, inv. 4, D10).
- The mock and fallback paths in `server/index.js` never pass through `llm.js`, so they log nothing.
- `tests/helpers/fake-claude.mjs:72` tells a grade call from a scenario call by sniffing for `verdict` in the schema, which a schema move would silently break.
- A5 needs a rule for when a change is a "text change" that must bump `VERSION`.

## Options considered
1. **Keep `llm.js` and add logging**: rejected. Fallback and mock paths would still sit outside it, so "every call is logged" couldn't be enforced in one place.
2. **The full target layout now** (`gates.js`, `fallbacks.js`): rejected. Nothing would use them yet.
3. **Hash only the system text to detect changes**: rejected. Template and schema changes would slip through.

## Decision
Create `server/ai/gateway.js` and `server/ai/models.js`. `models.js` holds only `MODEL`, the effort constants and the deadline constants.

**Gateway API**

`createGateway({client, logCall})` returns `{run}`:
```
run({ prompt, input, live, effort, deadlineMs, accept, fallback }) -> { data, source: "live" | "mock" | "fallback", meta }
```
- `fallback` is **required**. That makes "every AI call has a non-AI fallback" a property of the gateway's signature.
- `accept(data)` returns a list of problems, for example `validateScenario`, `clampGrade` or a non-empty feedback check. Any problem counts as a failure, and the gateway serves the fallback.
- When `live` is false (MOCK mode), the gateway calls `fallback()` with no API call and logs outcome `mock`.
- `logCall` is injected. The server passes `db.logLlmCall`, and the eval runner passes its recording sink ([0007](0007-plain-node-eval-runner.md)).

**Rules**
- **One call site.** `messages.create` appears only in `server/ai/gateway.js`, with `signal: AbortSignal.timeout(deadlineMs)` and `maxRetries: 1`, and the JSON schema in `output_config.format`.
- **One `llm_call` row per `run()`:** `{id, at, pipeline: promptId, prompt_version: "<id>@<N>", model: served model (requested model if there was no response), ms, input_tokens, output_tokens, cache_read, cost_usd (null when there's no price), outcome}`.
  - `outcome` is `ok`, `timeout`, `refusal`, `fallback` (any other failure: an HTTP error, `max_tokens`, a parse error, or rejection by `accept`), or `mock`.
  - Any outcome other than `ok` or `mock` means the learner got the fallback, and its label is shown.
- **Header.** Every request sends `x-prompt-id: <promptId>@<VERSION>`. fake-claude routes on this header and returns 500 plus a log line when it's missing, so a misroute can't pass silently.

**Prompt registry**

Each `server/prompts/<id>.js` exports:
- `VERSION`, an integer ≥ 1;
- `PROMPT = {id, system, schema, render(input), fingerprintInputs}`.

`render` must be deterministic for a given input, so any randomness comes in as `input.rng`. `promptFingerprint(PROMPT)`, in the gateway, is the sha256 of `system`, then `JSON.stringify(schema)`, then `render(i)` for each of the `fingerprintInputs`.

**What counts as a text change (inv. 4)**
- **Not a text change:** a change that leaves the fingerprint unchanged. Examples are adding `VERSION`, renaming exports, or injecting an RNG that renders the same bytes for the same draw. No bump is needed.
- **A text change:** a change that alters the fingerprint, whether in the system text, the user template or the schema (including renaming or dropping `SCENARIO_SCHEMA.trade`). It **must** bump `VERSION` and pass the eval gate, which the evals-engineer runs and the lead triggers.
- **Model and effort changes** don't bump `VERSION`. They still trigger the gate, and recordings are keyed by model.
- **Byte-identical rendering doesn't excuse a change from fencing.** Moving pack words into slots while leaving them unfenced in the system prompt breaks inv. 5 ([0006](0006-pack-format-v1.md)). F-4's option (c) is rejected.

## Consequences
- Positive: inv. 3 and inv. 4 become structural and testable. Mock and fallback runs show up in `llm_call`. fake-claude routing is explicit.
- Negative / risks:
  - `fingerprintInputs` must cover each template branch. A branch not covered could change without a bump. The evals-engineer reviews coverage when adding a prompt.
  - W7's real text change can't pass the gate until there is an API key (F-3) and labels (F-1). Its merge policy is **pending founder F-4**.
- Follow-ups:
  - Move `llm.js` to `server/ai/gateway.js` and repoint `tests/llm-deadline.test.js` without loosening its assertions.
  - QA moves fake-claude to header routing and adds a `/__log` kind test.
  - Update `data-and-evidence.md` §2 `llm_call.outcome` (done in this change).

## Verification
- A `grep` test asserts that `messages.create` appears only in `server/ai/gateway.js`, and that the same file contains `maxRetries: 1` and `AbortSignal.timeout`.
- A test asserts that every module in `server/prompts/` exports an integer `VERSION` and a `PROMPT` with the fields above.
- A test asserts that every prompt's fingerprint matches a recording or a pinned pending entry ([0007](0007-plain-node-eval-runner.md)).
- Fake-claude scenarios cover hang, 429, refusal and invalid output. Each must produce the fallback within the deadline and exactly one `llm_call` row with the expected `outcome`.
