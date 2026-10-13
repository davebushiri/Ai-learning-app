---
id: m1-ref-02
title: Inference, temperature and sampling
module: m1
verified: 2026-10-13
status: trusted reference (no planted errors)
---

# Inference, temperature and sampling

## Objective

Explain how a model produces text one token at a time, what temperature and related sampling settings change, and why low temperature does not make a system correct or fully repeatable.

## Explanation

**Inference** is running a trained model to get an output. The weights are fixed during inference. An autoregressive language model produces its answer one token at a time: given everything so far, it computes a probability for each possible next token, one token is chosen, it is appended, and the loop repeats until a stop condition (an end token, a stop sequence or the `max_tokens` limit).

**Sampling settings decide how the next token is chosen** from that probability distribution:
- **Temperature** reshapes the distribution. Lower values concentrate probability on the most likely tokens (more conservative, more consistent phrasing). Higher values flatten it (more varied, more surprising word choices).
- **Top-p (nucleus) and top-k** limit the candidate set to the most likely tokens (by cumulative probability, or by count) before choosing.
- Providers differ in ranges, defaults and which combinations a model accepts; some recent models restrict or ignore some sampling parameters. Check the specific model's documentation rather than assuming.

**Low temperature is not determinism.** Anthropic's glossary states that even at temperature 0, results are not fully deterministic and identical inputs may produce different outputs across calls, on its own service and through cloud providers. Design and test as if outputs vary.

**Low temperature is not correctness.** Temperature changes how the model chooses among what it already considers likely. If the model's most likely answer is wrong, or the needed fact is missing from its context, a low temperature produces the same wrong answer more consistently. Grounding (see m1-ref-04) addresses missing knowledge; temperature does not.

**Practical defaults.** For extraction, classification and grounded question answering, teams usually prefer lower temperature for consistency. For brainstorming or varied phrasing, higher. Either way, the setting is a tuning knob to evaluate, not a quality guarantee.

**Cost and latency** scale with tokens: input tokens are processed, and output tokens are generated one after another, so long outputs take longer. Time to first token (TTFT) is a common responsiveness metric.

## Systems-engineering analogy

**Temperature is like the gain on a dither or noise-injection setting in a control loop.** Turning it down makes the output track the nominal path more tightly; turning it up explores more around it.

**Where it breaks down:**
- In a control loop the nominal path is the designed setpoint. In a language model the "nominal" path is just the most probable continuation, which can be confidently wrong. There is no setpoint for truth.
- Zero dither on a deterministic controller gives bit-identical output. Zero temperature on a hosted model still may not, because of how inference is served.
- Validation of a controller can rely on repeatability. Validation of an LLM feature needs statistical evaluation over many runs and many inputs.

## Common misconceptions

- "Temperature 0 makes the output perfectly repeatable." Not guaranteed (provider docs say so explicitly).
- "Lower temperature fixes hallucination." It can cut errors that come from sampling unlikely tokens, but it reduces variation, not missing knowledge; a wrong but likely answer stays wrong.
- "The model learns from each call during inference." No: weights are fixed during inference.
- "Higher temperature makes the model smarter or more creative in reasoning." It makes word choices more varied; it can also increase errors.

## AWS mapping (verify)

- Bedrock model invocation (InvokeModel and the Converse API) exposes inference parameters such as temperature, top-p and maximum tokens; supported parameters and ranges differ by model provider. `verified: "UNVERIFIED"`
- An AWS parameter page for Anthropic Claude on Bedrock lists temperature 0–1 with default 1, and notes some newer Claude models accept temperature or top-p but not both. `verified: "UNVERIFIED"` (seen only as a search snippet)

## Sources

- Anthropic, Glossary (temperature, TTFT, pretraining): https://platform.claude.com/docs/en/about-claude/glossary (fetched 2026-10-13)
- AWS to verify: https://docs.aws.amazon.com/bedrock/latest/userguide/inference-parameters.html
- AWS to verify: https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-anthropic-claude-messages-request-response.html
