---
id: m2-ref-01
title: Tool use and function calling
module: m2
verified: 2026-10-15
status: trusted reference (no planted errors)
---

# Tool use and function calling

## Objective

Explain what tool use is, who executes a tool call, what the round trip looks like, what a tool schema does and does not guarantee, and why tool descriptions are part of the prompt.

## Explanation

**A tool** is a capability you describe to the model: a name, a plain-language description, and a JSON schema for its inputs. "Function calling" is another name for the same thing.

**The model never executes anything itself.** Anthropic's docs describe tool use as a contract: you specify what operations exist and their input shape; the model decides when and how to call them; "it emits a structured request, your code (or Anthropic's servers) runs the operation, and the result flows back into the conversation."

**The round trip (client tools):**
1. You send the request with a `tools` array and the user's message.
2. The model replies with `stop_reason: "tool_use"` and one or more `tool_use` blocks. Each has an `id`, the tool `name` and an `input` object.
3. Your application runs the operation (a database query, an HTTP call, a file write).
4. You send the result back in a `tool_result` block that carries the matching `tool_use_id`. The tool results must come first in that user message.
5. The model continues: another tool call, or a final answer.

**Client tools vs server tools.** Client tools run in your application, so you own execution, timeouts, permissions and logging. Server tools (for example web search or code execution on Anthropic's platform) run on the provider's infrastructure; you enable them and read the results.

**The model sees only what you give it.** It sees the tool's name, description and schema, and the result you return. It never sees your implementation.

**Choosing tools.** With `tool_choice: auto` (the default) the model decides whether to call a tool; you can also force any tool, a specific tool, or none. The model can call several tools in one turn (parallel tool use) unless you disable it.

**What a schema guarantees.** With strict tool use (`strict: true`), the model's tool inputs always match your schema exactly. That guarantees **shape and types**, not that the values are right or allowed. A perfectly valid `customer_id` can still be the wrong customer, or one the current user may not touch. Authorization and business-rule checks belong in your code, on every call.

**Errors.** If a tool fails, return the error in the `tool_result` with `is_error: true`. Anthropic recommends instructive messages ("Rate limit exceeded. Retry after 60 seconds.") over opaque ones, so the model can adapt. For an invalid call (a missing parameter), the docs say Claude typically retries 2–3 times with corrections before apologising to the user.

**Tool descriptions are prompts.** Anthropic's agent guidance says tool definitions deserve as much prompt-engineering attention as the main prompt: clear names, example usage, edge cases, and clear boundaries between similar tools. Make tools hard to misuse (their coding agent became reliable once a tool required absolute file paths). Their tool-writing guidance adds:
- consolidate several API calls into one task-shaped tool rather than wrapping every endpoint;
- namespace tools by service (`crm_search`, `billing_search`);
- return high-signal, human-readable results rather than raw IDs;
- paginate or truncate large results (Claude Code caps tool responses at 25,000 tokens by default).

**Cost.** Tool definitions are input tokens on every request, and enabling tools adds a tool-use system prompt of a few hundred tokens (the count is model-specific and published per model).

**When tools fit, and when they don't** (Anthropic's guidance):
- **Fit:** actions with side effects; fresh or external data; guaranteed-shape outputs; calling existing systems. "If you're writing a regex to extract a decision from model output, that decision should have been a tool call."
- **Don't fit:** the model can answer from training alone; one-shot Q&A with no side effects; a trivial task where the extra round trip would dominate.

**Tool results are untrusted input.** Results often carry text from outside your control (web pages, emails, customer notes). Anthropic's docs warn that such content may contain instructions meant to redirect the model (indirect prompt injection), and recommend keeping it inside `tool_result` blocks rather than in system prompts. See m2-ref-06.

**MCP (Model Context Protocol)** is an open protocol for exposing tools and data sources to models through a standard client–server interface, so one tool server can serve many agent hosts. It changes how tools are packaged, not the rules above.

## Systems-engineering analogy

**A tool call is like a work order raised by a planner and carried out by a technician.** The planner (the model) writes what should be done and with which part numbers; the technician (your code) checks the order, does the work, and reports back.

**Where it breaks down:**
- A real planner is accountable and consistent. The model can write a perfectly formatted order for the wrong machine, or be talked into one by text it read.
- In a plant, the technician's authority is fixed by role. In software, your code is the only place authority exists; if it executes whatever the order says, there is no check at all.
- A work-order form constrains fields. A strict schema does the same, and no more: it can't know whether the value in a valid field is the right one.

## Watch for

- The model requests; your application executes. Every control you need (timeouts, permissions, logging, idempotency) lives in that execution step.
- A schema-valid call is a well-formed call, not a correct or authorized one. Check values against the logged-in user and business rules.
- Description wording changes tool choice. Write and test descriptions like prompts.
- A tool result is data from outside the model, and can be hostile.

## AWS mapping (verify)

- The Bedrock Converse API supports tool use through a tool configuration in the request; the application runs the tool and returns the result. `verified: "UNVERIFIED"`
- Bedrock Agents define tools as *action groups* (an OpenAPI schema or function details), fulfilled either by a Lambda function or by *return of control* to your application. `verified: "UNVERIFIED"` (search snippet of the AWS user guide only)
- Amazon Bedrock AgentCore Gateway turns existing APIs and Lambda functions into agent tools and, since GA (October 2025), connects to existing MCP servers. `verified: "UNVERIFIED"` (AWS What's New snippet and secondary coverage only)

## Sources

- Anthropic docs, Tool use with Claude (overview): https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview (fetched 2026-10-15)
- Anthropic docs, How tool use works: https://platform.claude.com/docs/en/agents-and-tools/tool-use/how-tool-use-works (fetched 2026-10-15)
- Anthropic docs, Handle tool calls: https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls (fetched 2026-10-15)
- Anthropic, Building effective agents (December 2024), appendix on prompt-engineering tools: https://www.anthropic.com/engineering/building-effective-agents (fetched 2026-10-15)
- Anthropic, Writing effective tools for agents: https://www.anthropic.com/engineering/writing-tools-for-agents (fetched 2026-10-15)
- Model Context Protocol, building a client: https://modelcontextprotocol.io/docs/develop/build-client (linked from the Anthropic tool-use page; not fetched)
- AWS to verify: https://docs.aws.amazon.com/bedrock/latest/userguide/tool-use.html
- AWS to verify: https://docs.aws.amazon.com/bedrock/latest/userguide/agents-action-add.html
- AWS to verify: https://aws.amazon.com/about-aws/whats-new/2025/10/amazon-bedrock-agentcore-available
