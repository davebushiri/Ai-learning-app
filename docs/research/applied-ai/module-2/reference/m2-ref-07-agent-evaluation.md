---
id: m2-ref-07
title: Evaluating agents - task success, trajectory, reliability, cost and latency
module: m2
verified: 2026-10-15
status: trusted reference (no planted errors)
---

# Evaluating agents: task success, trajectory, reliability, cost and latency

## Objective

Plan an agent evaluation: what to measure (outcome, trajectory, reliability over repeated trials, cost and latency per task, safety), how to grade it, and how it continues after launch.

## Explanation

**Vocabulary** (Anthropic, *Demystifying evals for AI agents*):
- **Task:** "a single test with defined inputs and success criteria."
- **Trial:** one attempt at a task.
- **Grader:** "logic that scores some aspect of the agent's performance."
- **Transcript (trajectory):** "the complete record of a trial, including outputs, tool calls, reasoning, intermediate results."
- **Outcome:** "the final state in the environment at the end of the trial."

**1. Task success (outcome).** Check the end state, not the agent's claim: is the booking in the database, is the refund issued once, is the ticket closed with the right code? τ-bench, for example, scores agents by comparing the final database state with the annotated goal state. Anthropic: "it's often better to grade what the agent produced, not the path it took."

**2. Trajectory.** Read and grade the path for what the outcome can't show:
- policy and safety rules (no refund without approval, no data from another customer);
- wrong or unnecessary tool calls, loops, wasted steps;
- whether the agent asked for missing information instead of guessing.

Don't require one exact sequence of steps; Anthropic calls rigid step checks "overly brittle".

**3. Reliability over repeated trials.** Agents are non-deterministic, so one trial per task says little about consistency.
- **pass@k:** the chance of at least one success in k trials (fine when a person picks the best attempt).
- **pass^k:** the chance that **all** k trials succeed (what a customer-facing agent needs).
- Example: at 75% per-trial success, pass^3 ≈ 0.75³ ≈ 42%. τ-bench reported function-calling agents succeeding on under 50% of tasks, with pass^8 under 25% in its retail domain.

**4. Cost and latency per task.** Track tokens, model calls, tool calls, wall-clock time (median and 95th percentile) and cost per task, and cost per **successful** task. A correct answer at too high a cost or too slow can still fail the business case.

**5. Safety.** Unauthorized actions, data leaks and injection successes are counted separately, with a pre-set bar (often zero on the test set).

**Graders.** Code-based graders are "fast, cheap, objective" but "brittle to valid variations". Model-based (LLM-as-judge) graders handle open-ended output but need "calibration with human graders". Human graders are slow and expensive; use them to calibrate. Anthropic's rule: "deterministic graders where possible, LLM graders where necessary", and "Read the transcripts!"

**Building the set.**
- "20-50 simple tasks drawn from real failures is a great start." Grow it from production logs.
- **Capability** evals start at a low pass rate (tasks the agent struggles with); **regression** evals should stay near 100% and run on every prompt, model or tool change.
- Run against realistic data and services (sandboxes or recorded tool responses), including failure cases: tool timeouts, missing data, injected instructions.
- Set thresholds before running, and treat them as a release gate.

**After launch.** Trace every step under a task ID; monitor task success proxies, escalation rate, cost per task, latency and tool error rates; sample transcripts for review; feed new failures back into the set. Anthropic's research team found that "adding full production tracing let us diagnose why agents failed."

## Systems-engineering analogy

**Agent evaluation is a validation test campaign, not a single acceptance test.** Outcome checks are the functional tests, trajectory review is the process audit, and repeated trials are the reliability runs.

**Where it breaks down:**
- A hardware test repeated under the same conditions gives the same result. An agent may not, so a single pass proves little.
- Test fixtures are deterministic. An LLM judge is itself a model, and has to be validated against people.
- A released design doesn't change in the field. Prompts, models and tools change often, so the regression suite runs on every change.

## Watch for

- Grade the end state first; use the trajectory for safety, policy and efficiency.
- One trial per task can't show reliability; report pass^k for customer-facing agents.
- Cost and latency are measured per task, alongside success.
- LLM judges are calibrated against human labels before you trust them.

## AWS mapping (verify)

- Amazon Bedrock AgentCore Observability reports agent execution traces and metrics, integrating with CloudWatch and OpenTelemetry. `verified: "UNVERIFIED"` (search snippets only)
- Bedrock Agents return a trace of orchestration steps for each invocation, usable for trajectory review. `verified: "UNVERIFIED"`
- Bedrock model evaluation supports LLM-as-judge evaluation jobs. `verified: "UNVERIFIED"`

## Sources

- Anthropic, Demystifying evals for AI agents: https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents (fetched 2026-10-15)
- Anthropic, How we built our multi-agent research system (2025), evaluation and tracing: https://www.anthropic.com/engineering/multi-agent-research-system (fetched 2026-10-15)
- Yao et al. 2024, τ-bench: A Benchmark for Tool-Agent-User Interaction in Real-World Domains: https://arxiv.org/abs/2406.12045 (search snippets only, 2026-10-15; arXiv not reachable here)
- Anthropic, Writing effective tools for agents (metrics: runtime, tokens, tool errors): https://www.anthropic.com/engineering/writing-tools-for-agents (fetched 2026-10-15)
- AWS to verify: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/observability.html
- AWS to verify: https://docs.aws.amazon.com/bedrock/latest/userguide/trace-events.html
