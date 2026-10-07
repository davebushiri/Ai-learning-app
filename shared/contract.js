// THE CONTRACT. Server, browser, fixtures, and tests all depend on these shapes.
// Change them only after telling the whole team.
//
// Scenario
//   { id, trade, title, setting, apprentice, steps: Step[] }
// Step
//   { id: number, line: string, error: Mistake | null }
// Mistake
//   { severity: "minor" | "major" | "critical",
//     summary,        // short label, shown on the score screen
//     why,            // why it's wrong, one or two sentences
//     correctAction,  // what a journeyman would do instead
//     consequence,    // "here's what happened next" if the learner misses it
//     keywords: [] }  // lowercase words a correct explanation would likely use (mock grader + hints)
//
// GradeRequest   { scenario, stepId, errorStepId: number | null, explanation }
// GradeResponse  { verdict: "correct" | "partial" | "wrong" | "false_alarm",
//                  reasoningScore: 0..1, feedback }

export const SEVERITIES = ['minor', 'major', 'critical'];
export const VERDICTS = ['correct', 'partial', 'wrong', 'false_alarm'];

// JSON Schemas used for Claude structured outputs (server/llm.js).
const MISTAKE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['severity', 'summary', 'why', 'correctAction', 'consequence', 'keywords'],
  properties: {
    severity: { type: 'string', enum: SEVERITIES },
    summary: { type: 'string' },
    why: { type: 'string' },
    correctAction: { type: 'string' },
    consequence: { type: 'string' },
    keywords: { type: 'array', items: { type: 'string' } }
  }
};

export const SCENARIO_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'trade', 'title', 'setting', 'apprentice', 'steps'],
  properties: {
    id: { type: 'string' },
    trade: { type: 'string' },
    title: { type: 'string' },
    setting: { type: 'string' },
    apprentice: { type: 'string' },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'line', 'error'],
        properties: {
          id: { type: 'integer' },
          line: { type: 'string' },
          error: { anyOf: [{ type: 'null' }, MISTAKE_SCHEMA] }
        }
      }
    }
  }
};

export const GRADE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['verdict', 'reasoningScore', 'feedback'],
  properties: {
    verdict: { type: 'string', enum: VERDICTS },
    reasoningScore: { type: 'number' },
    feedback: { type: 'string' }
  }
};

// Returns a list of problems; empty list means the scenario is usable.
// Used to reject bad LLM output (and fall back to a fixture) and in tests.
export function validateScenario(s) {
  const problems = [];
  if (!s || typeof s !== 'object') return ['scenario is not an object'];
  for (const k of ['id', 'trade', 'title', 'setting', 'apprentice']) {
    if (typeof s[k] !== 'string' || !s[k]) problems.push(`missing ${k}`);
  }
  if (!Array.isArray(s.steps) || s.steps.length < 4) {
    problems.push('needs at least 4 steps');
    return problems;
  }
  const ids = new Set();
  let errors = 0;
  let critical = 0;
  s.steps.forEach((step, i) => {
    if (!Number.isInteger(step.id)) problems.push(`step ${i}: id must be an integer`);
    if (ids.has(step.id)) problems.push(`step ${i}: duplicate id ${step.id}`);
    ids.add(step.id);
    if (typeof step.line !== 'string' || !step.line) problems.push(`step ${i}: missing line`);
    if (step.error) {
      errors++;
      const e = step.error;
      if (!SEVERITIES.includes(e.severity)) problems.push(`step ${i}: bad severity`);
      if (e.severity === 'critical') critical++;
      for (const k of ['summary', 'why', 'correctAction', 'consequence']) {
        if (typeof e[k] !== 'string' || !e[k]) problems.push(`step ${i}: error missing ${k}`);
      }
      if (!Array.isArray(e.keywords)) problems.push(`step ${i}: error.keywords must be an array`);
    }
  });
  if (errors < 1) problems.push('needs at least one mistake');
  if (critical < 1) problems.push('needs at least one critical mistake');
  return problems;
}

export function clampGrade(g) {
  return {
    verdict: VERDICTS.includes(g?.verdict) ? g.verdict : 'wrong',
    reasoningScore: Math.max(0, Math.min(1, Number(g?.reasoningScore) || 0)),
    feedback: String(g?.feedback || '')
  };
}
