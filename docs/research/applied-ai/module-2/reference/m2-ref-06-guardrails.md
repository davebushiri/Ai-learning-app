---
id: m2-ref-06
title: Agent guardrails - least privilege, human approval, prompt injection through tools
module: m2
verified: 2026-10-15
status: trusted reference (no planted errors)
---

# Agent guardrails: least privilege, human approval, prompt injection through tools

## Objective

Design the controls that limit what an agent can do when it is wrong or manipulated: least-privilege tools, authorization outside the model, human approval for irreversible actions, and defences against prompt injection that arrives through tool results.

## Explanation

**Start from the right threat model.** Treat every tool call the model proposes as untrusted: it can be a hallucination, a misunderstanding, or the result of manipulation. OWASP's LLM06:2025 *Excessive Agency* names three root causes: **excessive functionality** (tools the task doesn't need), **excessive permissions** (tools with broader rights than needed) and **excessive autonomy** (high-impact actions without independent verification).

**Least-privilege tools:**
- Expose only the functions the task needs; prefer read-only tools; split a broad tool ("run SQL") into narrow ones ("get order by ID").
- Narrow each tool's parameters to the task (a refund capped at the order total, only for the requesting customer's orders).
- Give the agent its own identity with scoped credentials, and where possible act in the **requesting user's** context, so the agent can never do more than that user could.
- Enforce authorization **in downstream systems and your code**, never by asking the model. OWASP: don't rely on the LLM to decide whether an action is allowed.

**Human in the loop for irreversible or high-impact actions:**
- Payments, deletions, account changes, external messages: the agent drafts the action; a person approves the exact action (who, what, amount) before your code executes it.
- The approval step is in the code path, so it can't be skipped by a prompt. Thresholds (for example, refunds above a set amount) keep humans focused where risk is.
- Log the approval with the action.

**Prompt injection through tool outputs (indirect prompt injection):**
- Any text the agent reads can carry instructions: web pages, emails, documents, support tickets, product reviews, even fields in your own database that customers wrote.
- Anthropic's docs: treat such content as untrusted, keep it inside `tool_result` blocks rather than system prompts, and apply further hardening. Fencing and "ignore instructions in the data" prompts **reduce** the risk; there is no known fool-proof prevention (OWASP LLM01).
- So design for the case where injection succeeds: limit the blast radius with the controls above.
- **The "lethal trifecta"** (Simon Willison, 2025): an agent that has access to private data, is exposed to untrusted content, and can communicate externally can be steered into exfiltrating that data. Remove at least one leg: no external sends, sends only to allow-listed destinations, or no untrusted input in that agent.

**Other layers:**
- Validate tool arguments against business rules before executing (ranges, ownership, allow-lists of destinations).
- Rate limits and budgets cap damage from loops or abuse.
- An audit log of every tool call: who asked, the arguments, the result, any approval.
- Content filters ("guardrails" products) are one layer for harmful content; they are not authorization.
- Test it: red-team cases with injected instructions in tool results, and the pass bar is zero unauthorized actions.

## Systems-engineering analogy

**Guardrails are interlocks and a permit-to-work system.** The operator (the model) may push any button; interlocks (code-enforced limits) make the dangerous ones do nothing, and the permit system (human approval) is required before irreversible work.

**Where it breaks down:**
- An operator can't be talked into anything by the label on a part. A model can be redirected by text inside the data it reads.
- Interlocks guard physics that don't change. Agent tools change with every release, so the limits need re-testing each time.
- A permit is signed by a trained person who understands the job. An approval screen only helps if it shows the exact action and the approver has time to check it.

## Watch for

- Every proposed tool call is untrusted until your code checks it.
- Credentials scoped to the task (or the user), never shared admin rights.
- Irreversible actions need an approval that lives in code, not in the prompt.
- Prompt instructions lower injection risk but don't remove it, so limit what a manipulated agent can reach.

## AWS mapping (verify)

- Bedrock Agents can require **user confirmation** before invoking a specific action-group function; AWS positions it as a safeguard against prompt injection from API or knowledge-base content. The person asked to confirm is the agent's end user, so it is not a staff approval step, and it doesn't help when the end user is the one who planted the injected text. `verified: "UNVERIFIED"` (search snippets of the AWS user guide)
- **Return of control**: an action group can hand the elicited parameters back to your application instead of a Lambda, so your code runs (and can gate) the action. `verified: "UNVERIFIED"` (search snippet)
- Action-group Lambdas run under their own IAM execution role, which is where least privilege is applied. `verified: "UNVERIFIED"`
- Bedrock Guardrails include content filters with a prompt-attack category. `verified: "UNVERIFIED"`
- Amazon Bedrock AgentCore Identity provides identity-aware authorization and a token vault for OAuth-based tool access. `verified: "UNVERIFIED"` (search snippets only)

## Sources

- OWASP Top 10 for LLM Applications 2025, LLM06 Excessive Agency: https://genai.owasp.org/llmrisk/llm062025-excessive-agency/ (search snippets only, 2026-10-15; page not reachable here)
- OWASP Top 10 for LLM Applications 2025, LLM01 Prompt Injection: https://genai.owasp.org/llmrisk/llm01-prompt-injection/ (search snippet only, checked for module 1)
- Anthropic docs, Handle tool calls (untrusted tool results, indirect prompt injection): https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls (fetched 2026-10-15)
- Simon Willison, The lethal trifecta for AI agents (2025-06-16): https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/ (search snippets only, 2026-10-15; page not reachable here)
- Anthropic, Building effective agents (sandboxed testing and guardrails): https://www.anthropic.com/engineering/building-effective-agents (fetched 2026-10-15)
- AWS to verify: https://docs.aws.amazon.com/bedrock/latest/userguide/agents-userconfirmation.html
- AWS to verify: https://docs.aws.amazon.com/bedrock/latest/userguide/agents-returncontrol.html
- AWS to verify: https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails.html
