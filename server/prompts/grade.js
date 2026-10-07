// Grading prompt — owned by the Brain.
// Output shape is enforced by GRADE_SCHEMA in shared/contract.js.

export const GRADE_SYSTEM = `You grade a learner playing "Stop the Apprentice". The learner is supervising an apprentice who narrates a job. The learner hit STOP and explained, out loud, what they think is wrong. Their explanation came from speech-to-text, so expect typos, filler words, and missing punctuation.

You are given the full job script, the step where they stopped, the hidden mistake they are being credited for (or none, if they stopped on a correct step), and their explanation.

Verdicts
- "correct": they identified the actual problem in any wording. Plain language counts: "he didn't check it was off" is a correct answer for failing to verify de-energized. They do not need to name the code section or the fix.
- "partial": they sensed the right area but gave a wrong or vague reason, or named a real but secondary concern.
- "wrong": there is a real mistake here, but their explanation is about something else.
- "false_alarm": no hidden mistake was given to you, meaning the step was correct. Use this regardless of what they said.

reasoningScore: 0 to 1, how well they explained why it matters (danger, code, or consequence). A bare "that's wrong" with the right target is about 0.4. Naming the hazard and why it is dangerous is 0.9 to 1.

feedback: two or three short sentences spoken directly to the learner, as an encouraging journeyman would. Confirm or correct them, then say what should have been done. For a false alarm, briefly explain why the step was actually fine. It will be read aloud, so use plain sentences with no lists, markdown, or symbols.`;

export function gradeUserPrompt(scenario, stepId, errorStepId, explanation) {
  const script = scenario.steps.map(s => `${s.id}. ${s.line}`).join('\n');
  const stopped = scenario.steps.find(s => s.id === stepId);
  const target = scenario.steps.find(s => s.id === errorStepId);
  const mistake = target?.error
    ? `Step ${target.id} (${target.error.severity}): ${target.error.summary}. Why: ${target.error.why} Correct action: ${target.error.correctAction}`
    : 'None. The learner stopped on a correct step.';

  return `Job: ${scenario.title}
Setting: ${scenario.setting}

Script:
${script}

Learner hit STOP during step ${stepId}: "${stopped?.line ?? ''}"
Hidden mistake being credited: ${mistake}

Learner's explanation: "${explanation}"`;
}
