# 0005. AI gateway, prompt registry, `x-prompt-id` header, and what counts as a prompt text change

**Status:** Accepted. Founder F-4 = (a): W7's prompt rewrite is held at the gate until a key and labels exist. Amended 2026-10-09 (Amendments 1 and 2, below).
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

## Amendment 1 (2026-10-09, F1a spec review)
Clarifications only. Reasons are in [`docs/specs/F1a-server-owned-cards/review.md`](../specs/F1a-server-owned-cards/review.md) (B1, OI-4).
- **When to call `run()`.** Every place where the live path would call a model calls `run()`. In MOCK mode it calls it with `live: false`, which logs outcome `mock`. A cached card the client asked for explicitly (`source: "fixture"`) is not an AI call, so there is no `run()`, no `llm_call` row and no `promptVersions`.
- **F1a staging.** F1a exports `VERSION` and `PROMPT = {id, system, schema, render, fingerprintInputs}` from each prompt module. `promptFingerprint` goes in the gateway. `fingerprintInputs` covers each template branch:
  - grade: an on-time catch, a late catch, a false alarm, and an empty explanation;
  - scenario: with and without `criticalHints`, `twists` and recent summaries, with a fixed `rng`.
  
  An F1a test freezes both fingerprints, so the F-6 `pending` entries in F1b pin exactly those values. The staleness test itself is F1b.
- **`server/ai/models.js`** holds `MODEL`, the effort constants and the deadline constants (env-overridable, defaults 40000 / 8000).
- **Console lines.** Today's `[claude] …` console lines stay byte-compatible (`tests/server.test.js` BRAIN-08).

## Amendment 2 (2026-10-09, F1a pressure test, thread 0004)
Additive changes to `run()` and clarifications. Reasons are in [thread 0004](../team/threads/0004-f1a-pressure-test.md) (backend RISK "run() drops the error", QA RISKs "failure matrix" and "timing contract").
- **`run()` result `meta` gains `error: string | null`.** It is `null` for `ok` and `mock`. For `timeout` it is exactly `Claude <promptId> timed out after <deadlineMs> ms`, which is today's `llm.js:53` text. For an SDK error it is `err.message` unchanged, so `/api/health.lastLiveError` keeps matching `/401/`. For other failures it is a short reason: `Claude declined: <category>`, `Claude response was cut off (max_tokens)`, `Claude returned no text`, the JSON parse message, or the `accept` problems joined with `"; "`. `meta.error` goes to server logs and `/api/health` only. It is never put in an HTTP body, an event or an `llm_call` row (no new column).
- **Services keep their side effects.** `content` and `assessment` call `noteLive(what)` on `ok` and `noteLive(what, {message: meta.error})` on `timeout`, `refusal` or `fallback`. They also keep today's `[grade] live grading failed, using keyword grader: <meta.error>` and `[scenario] live generation failed, using fixture: <meta.error>` warn lines. MOCK calls neither, as today. The gateway owns only the `[claude] …` lines.
- **`run()` gains `normalize(data) → data`** (optional, default identity). Order on the live path: `responseText` → `JSON.parse` → `normalize` → `accept(normalized)` → problems mean fallback. `normalize` never runs on `fallback()` output, and a throw inside it counts as outcome `fallback`. Grade uses `normalize: clampGrade` and `accept: g => g.feedback.trim() ? [] : ['Claude returned empty feedback']`. Scenario uses `normalize` for today's id stamping and `accept: validateScenario`. The decision's "accept … for example clampGrade" was imprecise, because `clampGrade` is a transform. Rejected: clamping inside `accept` (a validator with side effects), and clamping in the caller after `run()` (a second fallback path outside the gateway, with its own logging gap). The server-decides-false-alarm rule (FR-006) stays in the caller.
- **The call is `client.beta.messages.create(body, {signal: AbortSignal.timeout(deadlineMs), maxRetries: 1, headers: {'x-prompt-id': …}})`.** `betas` and `fallbacks` need the beta resource. Injected test clients have the shape `{beta: {messages: {create}}}`. The grep guardrail for `messages.create` matches `beta.messages.create`, so "one call site" still holds.
- **Outcome by what ended the call**, using typed SDK classes (never message text):

  | What happened | `outcome` | `source` |
  |---|---|---|
  | Valid data, including text after a `fallback` block | `ok` | `live` |
  | `Anthropic.APIUserAbortError`: a hang, or a `retry-after` the SDK would sleep past the deadline (verified on SDK 0.132.0: 429 with `retry-after: 60` at 1500 ms throws this at 1502 ms after 1 request) | `timeout` | `fallback` |
  | `stop_reason === 'refusal'` | `refusal` | `fallback` |
  | Any other SDK error after the one retry (400, 401, 429 with a short `retry-after`, 500, 529, connection error) | `fallback` | `fallback` |
  | `stop_reason === 'max_tokens'` (even if the text parses), empty text, non-JSON, a throw in `normalize`, `accept` problems (wrong-schema JSON) | `fallback` | `fallback` |
  | `live: false` | `mock` | `mock` |

  Every row writes exactly one `llm_call` row and answers within `deadlineMs + 1 s`.
- **Scope of the `AbortSignal.timeout` rule.** Inv. 3's deadline rule covers model calls in the gateway. Browser request timeouts in `web/api.js` are not AI calls. They use `setTimeout` plus `AbortController`, cleared when the request settles, so Playwright's `page.clock` can drive them (`page.clock` does not fake `AbortSignal.timeout`; QA EVIDENCE in thread 0004).
- **Verification:** unit tests in `tests/gateway.test.js` with an injected client cover every row of the table, plus "timeout meta.error is 'Claude grade timed out after 1500 ms'" and "normalize runs before accept and never on fallback data". The fake-Claude failure matrix test drives each row through `POST /api/attempts` and `POST …/stops`.
