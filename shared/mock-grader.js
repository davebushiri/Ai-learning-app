// Keyword grader used when there is no API key (MOCK mode) or the live grader
// fails mid-demo. It is deliberately simple; the real grading lives in
// server/prompts/grade.js.

export function mockGrade(scenario, errorStepId, explanation) {
  const step = scenario.steps.find(s => s.id === errorStepId);
  if (!step?.error) {
    return {
      verdict: 'false_alarm',
      reasoningScore: 0,
      feedback: 'That step was actually fine. Stopping the job costs time, so save the STOP for real hazards.'
    };
  }
  const text = (explanation || '').toLowerCase();
  const hits = step.error.keywords.filter(k => text.includes(k.toLowerCase())).length;
  if (hits >= 2) {
    return { verdict: 'correct', reasoningScore: 1, feedback: `Exactly. ${step.error.why}` };
  }
  if (hits === 1) {
    return { verdict: 'partial', reasoningScore: 0.5, feedback: `You're onto it. ${step.error.why}` };
  }
  return {
    verdict: 'wrong',
    reasoningScore: 0,
    feedback: `Right moment to stop, but that's not the problem. ${step.error.why}`
  };
}
