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

// Game rules a playable scenario must follow. The scenario prompt asks for the
// same things in prose (server/prompts/scenario.js); the JSON schema can't
// express counts, positions, or spacing, so they are checked here.
export const SCENARIO_RULES = {
  minSteps: 6,
  maxSteps: 14,
  maxLineChars: 400,     // one or two spoken sentences
  maxSummaryChars: 120,  // shown on the score screen
  maxTextChars: 800,     // why / correctAction / consequence
  minKeywords: 3,
  cleanLeadIn: 2,        // no mistake in the first two steps
  severities: { critical: 1, major: 1, minor: 1 } // exactly one of each
};

const isPlainObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const nonEmptyString = v => typeof v === 'string' && v.trim().length > 0;

// Returns a list of problems; empty list means the scenario is usable.
// Used to reject bad LLM output (and fall back to a fixture) and in tests.
// Never throws, whatever it is given.
// Optional `opts.trade`: the trade id the scenario was requested for.
export function validateScenario(s, opts = {}) {
  try {
    return scenarioProblems(s, opts ?? {});
  } catch (err) {
    return [`scenario could not be checked: ${String(err?.message ?? err).slice(0, 200)}`];
  }
}

function scenarioProblems(s, opts) {
  const R = SCENARIO_RULES;
  const problems = [];
  if (!isPlainObject(s)) return ['scenario is not an object'];
  for (const k of ['id', 'trade', 'title', 'setting', 'apprentice']) {
    if (!nonEmptyString(s[k])) problems.push(`missing ${k}`);
  }
  if (opts.trade && nonEmptyString(s.trade) && s.trade !== opts.trade) {
    problems.push(`trade is ${s.trade.slice(0, 40)}, expected ${opts.trade}`);
  }
  if (!Array.isArray(s.steps)) {
    problems.push('steps must be an array');
    return problems;
  }
  const n = s.steps.length;
  if (n < R.minSteps || n > R.maxSteps) {
    problems.push(`needs ${R.minSteps} to ${R.maxSteps} steps (has ${n})`);
    if (n > R.maxSteps * 4) return problems; // don't itemize hundreds of steps
  }

  const ids = new Set();
  const mistakeIdx = [];
  const sevCount = { critical: 0, major: 0, minor: 0 };
  s.steps.forEach((step, i) => {
    const at = `step ${i + 1}`;
    if (!isPlainObject(step)) {
      problems.push(`${at}: is not an object`);
      return;
    }
    if (!Number.isSafeInteger(step.id) || step.id < 1) problems.push(`${at}: id must be a positive integer`);
    else if (ids.has(step.id)) problems.push(`${at}: duplicate id ${step.id}`);
    ids.add(step.id);

    if (!nonEmptyString(step.line)) problems.push(`${at}: missing line`);
    else if (step.line.length > R.maxLineChars) problems.push(`${at}: line is over ${R.maxLineChars} characters (${step.line.length})`);

    if (step.error === null) return;
    if (!isPlainObject(step.error)) {
      problems.push(`${at}: error must be null or a mistake object`);
      return;
    }
    mistakeIdx.push(i);
    const e = step.error;
    if (!SEVERITIES.includes(e.severity)) problems.push(`${at}: bad severity`);
    else sevCount[e.severity]++;
    for (const k of ['summary', 'why', 'correctAction', 'consequence']) {
      if (!nonEmptyString(e[k])) problems.push(`${at}: error missing ${k}`);
      else if (e[k].length > (k === 'summary' ? R.maxSummaryChars : R.maxTextChars)) problems.push(`${at}: error ${k} is too long`);
    }
    if (!Array.isArray(e.keywords)) {
      problems.push(`${at}: error.keywords must be an array`);
    } else {
      if (!e.keywords.every(nonEmptyString)) problems.push(`${at}: every keyword must be a non-empty string`);
      const good = e.keywords.filter(nonEmptyString).length;
      if (good < R.minKeywords) problems.push(`${at}: needs at least ${R.minKeywords} keywords (has ${good})`);
    }
  });

  // Placement: a learner who reacts one line late must still land on the right
  // mistake, and the last line gets almost no reaction time.
  if (mistakeIdx.some(i => i < R.cleanLeadIn)) problems.push(`no mistake allowed in the first ${R.cleanLeadIn} steps`);
  if (n > 0 && mistakeIdx.includes(n - 1)) problems.push('no mistake allowed on the last step');
  for (let k = 1; k < mistakeIdx.length; k++) {
    if (mistakeIdx[k] - mistakeIdx[k - 1] < 2) {
      problems.push(`mistakes at steps ${mistakeIdx[k - 1] + 1} and ${mistakeIdx[k] + 1} are adjacent; put a correct step between them`);
    }
  }

  if (mistakeIdx.length < 1) problems.push('needs at least one mistake');
  const wanted = Object.entries(R.severities);
  if (wanted.some(([sev, count]) => sevCount[sev] !== count) || mistakeIdx.length !== wanted.length) {
    const has = mistakeIdx.map(i => s.steps[i].error.severity).map(v => (SEVERITIES.includes(v) ? v : 'invalid')).join(', ') || 'none';
    problems.push(`needs exactly one critical, one major, and one minor mistake (has ${has})`);
  }
  return problems;
}

export function clampGrade(g) {
  return {
    verdict: VERDICTS.includes(g?.verdict) ? g.verdict : 'wrong',
    reasoningScore: Math.max(0, Math.min(1, Number(g?.reasoningScore) || 0)),
    feedback: String(g?.feedback || '')
  };
}
