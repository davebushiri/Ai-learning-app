---
id: m2-ref-03
title: Workflows vs agents, and when not to use an agent
module: m2
verified: 2026-10-15
status: trusted reference (no planted errors)
---

# Workflows vs agents, and when not to use an agent

## Objective

Tell a workflow from an agent, name the common workflow patterns, and decide when an agent is justified, when a workflow is better, and when neither is needed.

## Explanation

**Definitions** (Anthropic, *Building effective agents*):
- **Workflows** are "systems where LLMs and tools are orchestrated through predefined code paths."
- **Agents** are "systems where LLMs dynamically direct their own processes and tool usage, maintaining control over how they accomplish tasks."

Both are "agentic systems". The difference is who decides the next step: your code, or the model.

**Start with the simplest thing.** The same post recommends "finding the simplest solution possible, and only increasing complexity when needed." For many applications a single, well-prompted model call with retrieval and examples is enough.

**Common workflow patterns:**
- **Prompt chaining:** fixed sequence of model calls, with code checks ("gates") between them.
- **Routing:** classify the input, then send it to a specialised prompt, model or flow.
- **Parallelisation:** split independent subtasks (sectioning), or run the same task several times and vote.
- **Orchestrator–workers:** a model breaks a task down at run time and delegates the parts; the results are combined.
- **Evaluator–optimiser:** one call generates, another critiques, in a loop with a stopping rule.

**When an agent is justified.** The steps can't be predicted in advance; the number of steps varies; the environment gives feedback after each action; you can tolerate some variation; and you can check success. Coding and open-ended research are the classic fits.

**When a workflow is better.** The procedure is known and stable (extract → validate → match → post), audits need the same path every time, the latency budget is tight, or errors are expensive and hard to detect. A workflow is easier to test, cheaper, faster and more predictable.

**When neither is needed.** A single lookup or a single transformation (classify, summarise, extract into a schema) is one call. Exact or aggregate data comes from a system of record through a query, not from model reasoning.

**The costs that come with autonomy:** more model calls per task (cost and latency), run-to-run variation, compounding errors, a larger security surface (the model chooses which tools to call), and harder evaluation. Anthropic recommends "extensive testing in sandboxed environments, along with the appropriate guardrails."

**Hybrids are normal.** A router sends predictable intents to workflows and only open-ended ones to an agent. A workflow can contain one bounded agentic step. Irreversible actions often stay as coded steps outside the agent, after validation.

**Frameworks.** Frameworks make agents quick to start but can hide the prompts and responses underneath, which makes debugging harder. Anthropic suggests starting with the API directly and understanding the underlying code if you adopt a framework.

**Decide with evidence.** Build the simpler design first as a baseline, measure it on real cases, and adopt the agent only if it is clearly better on the measures that matter (task success, cost, latency, safety).

## Systems-engineering analogy

**A workflow is a released work instruction; an agent is a skilled technician sent with a goal and a toolbox.** You write a work instruction when the job is the same every time; you send a technician when the fault could be anything.

**Where it breaks down:**
- A technician's judgment is stable and accountable from one day to the next. A model's choices vary between runs of the same task.
- A technician knows when to stop and call for help. A model has to be given explicit limits and escalation rules.
- A work instruction can be validated once. An agent's behaviour has to be evaluated statistically, over many runs.

## Watch for

- The question to ask is "who chooses the next step?", not "does it call tools?". A workflow can call many tools.
- More autonomy is not more accuracy. For a fixed procedure, it usually adds variation, cost and latency.
- A baseline (single call or workflow) measured on the same cases is what makes "the agent is better" a claim you can defend.

## AWS mapping (verify)

- AWS Step Functions orchestrates deterministic workflows and can call Bedrock models as steps. `verified: "UNVERIFIED"`
- Amazon Bedrock Flows (formerly Prompt Flows) builds fixed multi-step generative AI workflows. `verified: "UNVERIFIED"` (name and status to check)
- Bedrock Agents and Amazon Bedrock AgentCore are the agentic options. `verified: "UNVERIFIED"`

## Sources

- Anthropic, Building effective agents (December 2024): https://www.anthropic.com/engineering/building-effective-agents (fetched 2026-10-15)
- Anthropic docs, How tool use works ("when to use tools, and when not to"): https://platform.claude.com/docs/en/agents-and-tools/tool-use/how-tool-use-works (fetched 2026-10-15)
- AWS to verify: https://docs.aws.amazon.com/step-functions/latest/dg/connect-bedrock.html
- AWS to verify: https://docs.aws.amazon.com/bedrock/latest/userguide/flows.html
