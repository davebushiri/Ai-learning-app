// Grading a STOP: live Claude grading with a keyword-grader fallback.

import { clampGrade } from '../../shared/contract.js';
import { mockGrade } from '../../shared/mock-grader.js';
import { MOCK, ai as llm } from './ai-client.js';
import { noteLive } from './live-status.js';

const MAX_EXPLANATION_CHARS = 2000;

export async function grade(body) {
  const { scenario, stepId } = body;
  const explanation = String(body.explanation ?? '').slice(0, MAX_EXPLANATION_CHARS);
  // A STOP only counts as a catch if it targets a step that really has a mistake.
  const target = body.errorStepId ?? null;
  const errorStepId = target !== null && scenario.steps.some(s => s.id === target && s.error) ? target : null;
  if (MOCK) return { ...mockGrade(scenario, errorStepId, explanation), source: 'mock' };
  try {
    // False alarms go to Claude too, so the learner hears why the step was fine.
    const g = clampGrade(await llm.gradeExplanation({ scenario, stepId, errorStepId, explanation }));
    if (!g.feedback.trim()) throw new Error('Claude returned empty feedback');
    // The server, not the model, decides whether this was a false alarm.
    if (errorStepId === null) g.verdict = 'false_alarm';
    else if (g.verdict === 'false_alarm') g.verdict = 'wrong';
    noteLive('grade');
    return { ...g, source: 'live' };
  } catch (err) {
    noteLive('grade', err);
    console.warn(`[grade] live grading failed, using keyword grader: ${err.message}`);
    return { ...mockGrade(scenario, errorStepId, explanation), source: 'mock-fallback' };
  }
}
