// Model routing and per-pipeline limits for the AI gateway (ADR 0005 Amendment 1).
// Until F1a-T08b deletes server/llm.js, these duplicate its constants on purpose.

export const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5-5';
// Grading happens live while the learner waits, so it runs at low effort for latency.
export const SCENARIO_EFFORT = process.env.SCENARIO_EFFORT || 'medium';
export const GRADE_EFFORT = process.env.GRADE_EFFORT || 'low';
// Hard wall-clock limits per call, including SDK retries and retry-after waits.
export const SCENARIO_DEADLINE_MS = Number(process.env.SCENARIO_DEADLINE_MS) || 40000;
export const GRADE_DEADLINE_MS = Number(process.env.GRADE_DEADLINE_MS) || 8000;
