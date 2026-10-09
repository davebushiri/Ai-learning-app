# 0007. A plain Node eval runner for F1 (not promptfoo), with recordings and a pinned pending ratchet

**Status:** Accepted (technical). Amends [`open-source-landscape.md`](../foundation/open-source-landscape.md) §5 item 5. **Pending founder:** the cost cap (F-2), the API key (F-3), labels (F-1), and the initial pending entries (F-6).
**Date:** 2026-10-09   **Deciders:** principal-architect
**Thread:** [0003](../team/threads/0003-f1-engine-core-proposal.md) (E1, E4, follow-ups 2–3). Dissent recorded: this overrides a foundation recommendation.

## Context
- Inv. 4 needs an eval gate. The founder's DECISION in thread 0002 pulls `evals/`, `scripts/eval-prompts.js`, `npm run eval:live` and replay into F1.
- `open-source-landscape.md` §5 item 5 said "promptfoo implements the prompt eval gate".
- The evals-engineer checked `promptfoo@0.124.1`: it is 31.7 MB unpacked, with 76 direct dependencies, including telemetry (`posthog-node`), `python-shell` and express. It needs Node ≥ 22.22.0.
- Its Anthropic provider would call the SDK directly. That would bypass our gateway's deadline, effort, schema format and `server-side-fallback` settings, which breaks inv. 3. So we would have to write a custom provider that calls our gateway anyway.
- There is no API key yet, so no live run can happen (F-3).

## Options considered
1. **promptfoo as a dev dependency**: rejected for F1, for the size, telemetry and Node-floor reasons above, and because of the gateway bypass. It is MIT, so licensing isn't the issue.
2. **Inspect AI** (MIT, Python): rejected. It adds a second language runtime.
3. **A plain Node script that calls our gateway**: chosen, at about 200 lines plus a pure metrics module.

## Decision
- **`scripts/eval-prompts.js`** runs prompts through `server/ai/gateway.js` and never through the SDK directly. It injects a recording `logCall` sink ([0005](0005-ai-gateway-and-prompt-registry.md)).
- **`evals/metrics.js`** is pure. It computes κ, the confusion matrix and a bootstrap CI from recordings.
- F1 covers the grader set only (the 32 cases).
- **Recordings** go in `tests/fixtures/recorded/<promptId>@<VERSION>.json`, in the format from thread 0003 E4:
  - a header of `{promptId, promptVersion, promptSha256 = promptFingerprint(PROMPT), model, effort, sdkVersion, runDate, setSha256, labelsSha256, priceTable}`;
  - `calls[]`, which holds the raw content blocks.

  `npm test` replays them through `responseText` and `JSON.parse`, with no network.
- **`npm run eval:live`** refuses to run unless `ANTHROPIC_API_KEY` and `EVAL_COST_CAP_USD` are both set. It aborts when the amount spent plus the worst-case cost of the next call would exceed the cap. The **cap value is pending founder F-2**; the proposal is $6 per run and $25 per month.

**Pending ratchet.** `evals/pending.json` holds `[{promptId, version, promptSha256, reason, decision}]`.
- A prompt passes the staleness test if it has a recording whose `promptSha256` matches its current fingerprint, **or** a pending entry with a matching `promptSha256`.
- Because the hash is pinned, a text change with no recording still fails, so inv. 4 holds with no key.
- Every entry's `decision` links a founder DECISION, which is checked in review.
- **The initial `grade@1` and `scenario@1` entries are pending founder F-6.** Technically they pin today's unchanged text, so they are safe.

**Revisit at F3,** when verifier and safety sets exist. Adopt promptfoo then only if it runs offline through a custom provider that calls our gateway, and only as an optional dev install.

## Consequences
- Positive: no new dependency, and the eval path uses the same gateway as production. Staleness is enforced in `npm test` without a key.
- Negative / risks:
  - We own about 200 lines that promptfoo would have given us, with no web viewer.
  - The 32-case κ is a regression baseline, not the success criterion κ ≥ 0.6 (thread 0003, PM DECISION §3).
- Follow-ups: update `open-source-landscape.md` §1, §4, §5 and §6 (done in this change). The evals-engineer owns `evals/`, the script and recordings.

## Verification
- `evals/metrics.js` is checked against hand-computed synthetic recordings. The same recording produces byte-identical metrics JSON.
- The staleness test fails when a prompt's fingerprint has neither a recording nor a pending entry.
- `eval:live` exits non-zero with a clear message when there's no key or no cap. It aborts at the cap against fake-claude's fixed `usage`.
- A `grep` test asserts that `scripts/eval-prompts.js` doesn't import `@anthropic-ai/sdk`.
