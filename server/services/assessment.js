// Grading a STOP: live Claude grading through the gateway, with a keyword-grader fallback.

import { clampGrade } from '../../shared/contract.js';
import { mockGrade } from '../../shared/mock-grader.js';
import * as gradePrompt from '../prompts/grade.js';
import { GRADE_DEADLINE_MS, GRADE_EFFORT } from '../ai/models.js';
import { MOCK, gateway } from './ai-client.js';
import { noteLive } from './live-status.js';

const MAX_EXPLANATION_CHARS = 2000;

// The gateway's source -> the legacy route's source (FR-029).
const SOURCE = { live: 'live', mock: 'mock', fallback: 'mock-fallback' };

export async function grade(body) {
  const { scenario, stepId } = body;
  const explanation = String(body.explanation ?? '').slice(0, MAX_EXPLANATION_CHARS);
  // A STOP only counts as a catch if it targets a step that really has a mistake.
  const target = body.errorStepId ?? null;
  const errorStepId = target !== null && scenario.steps.some(s => s.id === target && s.error) ? target : null;
  // False alarms go to Claude too, so the learner hears why the step was fine.
  const { data, source, meta } = await gateway.run({
    prompt: gradePrompt,
    input: { scenario, stepId, errorStepId, explanation },
    live: !MOCK,
    effort: GRADE_EFFORT,
    deadlineMs: GRADE_DEADLINE_MS,
    normalize: clampGrade,
    accept: g => (g.feedback.trim() ? [] : ['Claude returned empty feedback']),
    // Must not throw: the gateway has already written the llm_call row by now.
    fallback: () => mockGrade(scenario, errorStepId, explanation)
  });
  if (source === 'live') {
    // The server, not the model, decides whether this was a false alarm.
    if (errorStepId === null) data.verdict = 'false_alarm';
    else if (data.verdict === 'false_alarm') data.verdict = 'wrong';
    noteLive('grade');
  } else if (source === 'fallback') {
    noteLive('grade', { message: meta.error });
    console.warn(`[grade] live grading failed, using keyword grader: ${meta.error}`);
  }
  return { ...data, source: SOURCE[source] };
}
