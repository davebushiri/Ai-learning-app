---
id: m1-ref-03
title: Structured outputs
module: m1
verified: 2026-10-13
status: trusted reference (no planted errors)
---

# Structured outputs

## Objective

Explain what structured outputs guarantee (shape), what they do not guarantee (truth), the edge cases where even the shape can fail, and how to handle each in production.

## Explanation

**The problem.** Software downstream of a model needs machine-readable output: a JSON object with known fields and types. Free text asked to "reply in JSON" usually works, but sometimes produces invalid JSON, a missing field or an extra commentary sentence.

**Structured outputs** constrain generation to a JSON schema you supply. Anthropic's docs describe this as constrained decoding: the response is valid JSON that matches the schema, with required fields and field types enforced, so you no longer need retries for schema violations. Several providers offer a similar feature; another common pattern is defining a "tool" whose input schema is the shape you want.

**What it guarantees: shape, not truth.** A schema can force `"refund_eligible": true|false`. It cannot force the right value. A perfectly valid object can contain a fabricated policy number. Validation of *content* is a separate layer: business-rule checks, cross-checking against source data, grounding checks and evaluation.

**Documented edge cases where even the shape can fail** (Anthropic docs, as of the verified date):
- **Refusal:** if the model refuses, the refusal takes precedence and the output may not match the schema (`stop_reason: "refusal"`).
- **Truncation:** if generation hits `max_tokens`, output may be incomplete and not match the schema.
- **Unsupported schema features** (for example some numeric and string-length constraints, recursive schemas) are rejected with an error, so some constraints must be checked in your own code.
- **Enum casing** is not guaranteed; compare enum values case-insensitively.

So production code still checks the stop reason, parses defensively, validates business rules, and has a non-AI fallback.

**Why it matters for RAG.** A grounded answer is often returned as a structure such as `{answer, citations[], confidence, abstained}`. Structure makes abstention and citations machine-checkable: the application can refuse to display an answer with no citations, or route an abstention to a human.

## Systems-engineering analogy

**A schema is an interface control document (ICD) plus a message-format check on a bus.** It guarantees that the frame has the right fields, types and lengths, so receivers can parse it.

**Where it breaks down:**
- A CAN frame that passes a format check can still carry a wrong sensor value; the same is true here. Format validity is not plausibility. You still need range and plausibility checks, which in an LLM system means content validation.
- A bus message either arrives well-formed or is flagged. A model can refuse or be cut off mid-object, which you must detect from the stop reason.
- ICDs are versioned and change-controlled; schemas sent to a model should be too, because a schema change changes behavior.

## Common misconceptions

- "Schema-valid means correct." No: it means parseable and well-typed.
- "Structured outputs mean no validation code is needed." No: refusals, truncation, unsupported constraints and wrong values all need handling.
- "Asking for JSON in the prompt is the same as structured outputs." No: prompting is best-effort; constrained decoding enforces the schema (within the documented limits).

## AWS mapping (verify)

- The Bedrock Converse API supports tool use, where a tool's JSON input schema can be used to obtain structured output from supported models. `verified: "UNVERIFIED"`
- Whether a schema-constrained output mode equivalent to Anthropic's `output_config.format` is available for a given model on Bedrock must be checked per model. `verified: "UNVERIFIED"`

## Sources

- Anthropic, Structured outputs: https://platform.claude.com/docs/en/build-with-claude/structured-outputs (fetched 2026-10-13)
- AWS to verify: https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference.html
- AWS to verify: https://docs.aws.amazon.com/bedrock/latest/userguide/tool-use.html
