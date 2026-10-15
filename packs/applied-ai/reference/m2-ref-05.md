---
id: m2-ref-05
title: Multi-agent orchestration and its trade-offs
module: m2
verified: 2026-10-15
status: trusted reference (no planted errors)
---

# Multi-agent orchestration and its trade-offs

## Objective

Explain the orchestrator–worker pattern, when splitting work across agents helps, what it costs, and how it fails.

## Explanation

**The common shape: orchestrator and workers.** A lead agent plans, splits the task, and hands parts to subagents; each subagent works with its own clean context window and returns a condensed result; the lead combines them. Anthropic's research feature uses this "orchestrator-worker pattern, where a lead agent coordinates the process while delegating to specialized subagents."

**Where it helps:** breadth-first work that splits into **independent** parts that can run in parallel (researching many sources at once), and work whose total context would overflow one window. Subagents also isolate context: each sees only its slice, which keeps windows short.

**Reported numbers (one system, one internal eval; treat as directional):**
- A multi-agent setup (Claude Opus 4 lead, Claude Sonnet 4 subagents) "outperformed single-agent Claude Opus 4 by 90.2%" on Anthropic's internal research evaluation.
- Agents used "about 4× more tokens than chat interactions", and multi-agent systems "about 15× more tokens than chats."
- So multi-agent pays off only when the task's value covers the extra tokens.

**Where it's a poor fit** (same post): domains that "require all agents to share the same context", work with "many dependencies between agents", and most coding tasks, which "involve fewer truly parallelizable tasks than research."

**How it fails:**
- **Coordination overhead and duplicated work:** vague task descriptions make subagents repeat each other's searches.
- **Over-spawning:** early versions made errors like "spawning 50 subagents for simple queries." Scale the effort to the task's complexity.
- **Lossy handoffs:** summaries passed between agents drop details the next agent needed.
- **Conflicting writes:** two agents editing the same record or file.
- **Compounding errors and harder debugging:** a failure can start in one agent and surface in another; you need end-to-end tracing.
- **Larger attack surface:** more prompts and tool sets that untrusted content can reach.

**Design rules that follow:**
- Start with one agent (or a workflow). Add agents only when parallel, independent breadth or context isolation justifies the cost, and show it on the same evaluation set as the single-agent baseline.
- Give each subagent a clear objective, an output format, tool boundaries and an effort budget.
- Keep shared state in one place (a store or the system of record), not in agents' heads.
- Trace every agent's calls under one task ID.

## Systems-engineering analogy

**An orchestrator with subagents is a program manager with work-package owners.** It works when work packages have clean interfaces and few dependencies; it bogs down when everyone needs the same drawing at the same time.

**Where it breaks down:**
- Human work-package owners share background knowledge and can ask a colleague. Subagents know only what's in their brief.
- Adding a person costs a salary; adding a subagent multiplies tokens on every task, whether it helps or not.
- A program manager notices duplicated effort over coffee. An orchestrator only notices what its prompt and traces make visible.

## Watch for

- Multi-agent is a trade: possible quality and speed on parallel breadth work, against several times the tokens and more failure modes.
- Shared, interdependent work (one record, sequential steps) is the case where splitting hurts.
- The evidence that justifies multi-agent is a comparison with a single-agent baseline on the same tasks, including cost.

## AWS mapping (verify)

- Bedrock Agents support multi-agent collaboration: a supervisor agent that routes to or coordinates collaborator agents. `verified: "UNVERIFIED"`
- Amazon Bedrock AgentCore Runtime added support for the Agent-to-Agent (A2A) protocol at GA (October 2025). `verified: "UNVERIFIED"` (search snippets only)

## Sources

- Anthropic, How we built our multi-agent research system (2025): https://www.anthropic.com/engineering/multi-agent-research-system (fetched 2026-10-15)
- Anthropic, Building effective agents (December 2024), orchestrator–workers pattern: https://www.anthropic.com/engineering/building-effective-agents (fetched 2026-10-15)
- Anthropic, Effective context engineering for AI agents (2025), sub-agent architectures: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents (fetched 2026-10-15)
- AWS to verify: https://docs.aws.amazon.com/bedrock/latest/userguide/agents-multi-agent-collaboration.html
- AWS to verify: https://aws.amazon.com/about-aws/whats-new/2025/10/amazon-bedrock-agentcore-available
