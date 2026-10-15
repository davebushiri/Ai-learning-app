---
id: m2-ref-04
title: Memory and state in agents
module: m2
verified: 2026-10-15
status: trusted reference (no planted errors)
---

# Memory and state in agents

## Objective

Explain where an agent's "memory" actually lives, how to manage a finite context window over long tasks, where task state belongs, and the risks of long-term memory.

## Explanation

**The model is stateless between calls.** Each API request contains everything the model sees: system prompt, tools, conversation, tool results. "Memory" is whatever your application chooses to send.

**Four kinds of state, four homes:**
1. **Working context:** the current conversation and tool results inside the context window.
2. **Session and task state:** what step the task is on, which IDs are involved, what has already been done. Keep it explicit and durable in your own store, so a crashed run can resume.
3. **Long-term memory:** facts and preferences kept across sessions (a customer's preferred delivery slot). Stored outside the model and loaded or retrieved when relevant.
4. **System-of-record data:** orders, bookings, balances. Authoritative; read through tools when needed, never trusted from memory or notes.

**Context is a finite resource.** Anthropic's context-engineering post: "as the number of tokens in the context window increases, the model's ability to accurately recall information from that context decreases" (context rot). Every token is also paid for on every call, and adds latency. A bigger window raises the ceiling; it doesn't remove the need to choose what goes in.

**Techniques for long tasks** (same post):
- **Compaction:** summarise a conversation nearing the limit and continue from the summary. "The art of compaction lies in the selection of what to keep versus what to discard."
- **Tool-result clearing:** once a tool result deep in the history has been used, drop the raw output.
- **Structured note-taking:** the agent writes notes "persisted to memory outside of the context window" and reads them back later (Anthropic provides a memory tool for this pattern).
- **Sub-agents with clean context windows** that return "a condensed, distilled summary" (see m2-ref-05).
- **Just-in-time retrieval:** keep lightweight identifiers (file paths, record IDs, links) and load the data through tools when it's needed.

**Risks of long-term memory:**
- **Staleness:** a remembered fact can be out of date; check the system of record for anything that matters.
- **Memory poisoning:** content the agent read (a web page, an email, a customer note) can contain instructions; if saved to memory unfiltered, it persists and steers later sessions. Write only verified facts, with their source.
- **Privacy and retention:** memory can hold personal data; it needs scoping, retention limits and deletion on request.
- **Cross-user leakage:** memory must be scoped to the user or tenant it belongs to.

## Systems-engineering analogy

**Agent memory is a shift-handover log.** The next shift (the next model call) knows only what is written in the log and on the board; anything not handed over is gone.

**Where it breaks down:**
- A handover log is written by a responsible person. An agent's notes can be written from text an attacker planted.
- The log has a fixed format. A context window degrades gradually as it fills; it doesn't just run out.
- The plant's state is in the plant, not in the log. Likewise the order's true state is in the order system, not in the agent's notes.

## Watch for

- Each call starts blank: if the app didn't send it, the model doesn't have it.
- Large windows still cost money, add latency, and lose recall as they fill, so compaction and retrieval remain design work.
- Task state belongs in your own durable store; authoritative data belongs in the system of record.
- Anything saved to long-term memory needs a trusted source, a scope, and a way to delete it.

## AWS mapping (verify)

- Amazon Bedrock AgentCore Memory offers short-term (session) and long-term memory with extraction strategies; GA added a self-managed strategy. `verified: "UNVERIFIED"` (search snippets of the GA announcement only)
- Bedrock Agents support session state (session attributes) and an optional memory feature that retains session summaries across sessions for a configurable period. `verified: "UNVERIFIED"`

## Sources

- Anthropic, Effective context engineering for AI agents (2025): https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents (fetched 2026-10-15)
- Anthropic docs, How tool use works (memory tool listed as an Anthropic-schema client tool): https://platform.claude.com/docs/en/agents-and-tools/tool-use/how-tool-use-works (fetched 2026-10-15)
- Anthropic docs, Context windows (context rot): https://platform.claude.com/docs/en/build-with-claude/context-windows (fetched 2026-10-13 for module 1)
- AWS to verify: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/memory.html
- AWS to verify: https://docs.aws.amazon.com/bedrock/latest/userguide/agents-memory.html
