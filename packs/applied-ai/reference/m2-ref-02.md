---
id: m2-ref-02
title: The agent loop, stopping conditions and step limits
module: m2
verified: 2026-10-15
status: trusted reference (no planted errors)
---

# The agent loop, stopping conditions and step limits

## Objective

Describe the plan–act–observe loop, explain what ends it, and design the limits that keep it bounded: step caps, budgets, deadlines and loop detection.

## Explanation

**An agent is a loop around tool calls.** For client-executed tools, Anthropic's docs give the canonical shape:
1. Send the request with the tools and the conversation.
2. If `stop_reason` is `"tool_use"`, execute each requested tool and append the results.
3. Send the whole conversation again. Repeat while `stop_reason` is `"tool_use"`.
4. The loop exits on any other stop reason: `end_turn`, `max_tokens`, `stop_sequence` or `refusal`, "which means Claude has either produced a final answer or stopped for another reason that your application should handle."

**Plan, act, observe.** Each pass, the model reasons about what to do next (plan), requests a tool (act), and reads the result (observe). The ReAct paper (Yao et al., 2022) named this interleaving of reasoning and actions. Anthropic's guidance stresses that agents should "gain ground truth from the environment at each step", meaning tool results, not the model's own assumptions.

**The model stopping is not the task succeeding.** `end_turn` means the model stopped asking for tools. It doesn't prove the refund was issued or the ticket closed. Where you can, check the outcome in code (read the record back, validate the answer against the tool results).

**Stopping conditions you control.** Anthropic recommends adding stopping conditions "such as a maximum number of iterations" to keep control. In practice, combine several:
- **Step cap** (maximum loop iterations or tool calls).
- **Token or cost budget** per task, with a hard stop.
- **Wall-clock deadline** per task, and a **timeout per tool call**, so one slow service can't hang the run.
- **No-progress detection**: the same tool with the same arguments several times in a row, or no new information for N steps.
- **Human checkpoints**: pause for approval before risky actions or when blocked.

**Hitting a limit is its own outcome.** Report it as "unfinished", hand over what was done, and escalate (to a person or a fallback flow). Never present a capped run as a success. Log which limit fired, because cap hits are a signal for evaluation.

**Choosing the cap.** Set it from data, not taste: look at traces of successful runs (for example, the 95th percentile of steps) and add margin. Too low a cap cuts off valid tasks; too high a cap lets loops burn money. Revisit it when tools or prompts change.

**Why each step costs more.** Every iteration is a model call that resends the growing conversation, so tokens and latency rise with each step. Anthropic notes that agentic systems "often trade latency and cost for better task performance", and that autonomy brings "the potential for compounding errors": a wrong early observation steers every later step.

**Server-side loops.** When the provider runs tools (for example web search), it runs its own loop with an iteration limit; if the cap is hit, the response returns `stop_reason: "pause_turn"`, and you resend to continue. That is a different mechanism from your own client loop.

## Systems-engineering analogy

**The agent loop is a control loop with a watchdog.** The controller reads sensors (tool results), decides, actuates (tool calls), and repeats; the watchdog (step cap, budget, deadline) forces a safe state if the loop stops making progress.

**Where it breaks down:**
- A control loop has a known plant model and a defined setpoint. An agent's "setpoint" is a natural-language goal, and the model decides for itself when it thinks it is done.
- Sensor readings in a plant are physics. Tool results can be wrong, stale or written by an attacker.
- A controller gives the same output for the same input. A model may not, so the same task can take 4 steps on one run and 12 on the next.

## Watch for

- The loop condition is the stop reason; everything else (caps, budgets, deadlines, loop detection) is your code's job.
- "The model finished" and "the task succeeded" are separate checks.
- A cap hit is reported as unfinished and escalated, never shown as success.
- Caps come from measured runs, and each step's cost grows with the conversation.

## AWS mapping (verify)

- Bedrock Agents run the orchestration loop for you (by default a ReAct-style reason-and-act loop), calling action groups and knowledge bases; the trace shows each step. `verified: "UNVERIFIED"`
- Amazon Bedrock AgentCore Runtime hosts agent code you write (any framework) with session isolation and long-running sessions (reported as up to eight hours). `verified: "UNVERIFIED"` (search snippets of the GA announcement only)
- AWS Step Functions can host a bounded loop around model calls, with explicit retry, timeout and catch settings per state. `verified: "UNVERIFIED"`

## Sources

- Anthropic docs, How tool use works (the agentic loop; server-side loop and `pause_turn`): https://platform.claude.com/docs/en/agents-and-tools/tool-use/how-tool-use-works (fetched 2026-10-15)
- Anthropic, Building effective agents (December 2024): https://www.anthropic.com/engineering/building-effective-agents (fetched 2026-10-15)
- Anthropic, How we built our multi-agent research system (2025), "agents are stateful and errors compound": https://www.anthropic.com/engineering/multi-agent-research-system (fetched 2026-10-15)
- Yao et al. 2022, ReAct: Synergizing Reasoning and Acting in Language Models: https://arxiv.org/abs/2210.03629 (cited from memory; not fetched)
- AWS to verify: https://docs.aws.amazon.com/bedrock/latest/userguide/agents-how.html
- AWS to verify: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/what-is-bedrock-agentcore.html
