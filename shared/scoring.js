// Scoring rules — owned by the Ringmaster. Pure functions, no DOM, no network,
// so they run in the browser and in `npm test`. Tune the numbers in RULES.

export const RULES = {
  // Base points for catching a mistake, by severity.
  catchPoints: { minor: 100, major: 200, critical: 300 },
  // How many steps after the mistake a STOP still counts as catching it.
  graceSteps: 1,
  // Multiplier by how late the catch was (index = steps late).
  latenessMultiplier: [1, 0.5],
  // Points scale from this floor up to 1.0 as reasoningScore goes 0 -> 1.
  reasoningFloor: 0.5,
  // A wrong explanation on a real mistake still gets partial credit for stopping.
  wrongExplanationMultiplier: 0.25,
  // -75 keeps "hit STOP on every step" from scoring as a good supervisor (see npm run simulate).
  falseAlarmPenalty: -75,
  missedPenalty: { minor: -25, major: -75, critical: -300 }
};

// When the learner hits STOP while step `stepIndex` is playing, which mistake
// are they catching? Looks at the current step, then back up to `graceSteps`.
// Returns { errorStepId, stepsLate } or null for a false alarm.
export function resolveStop(scenario, stepIndex, caughtIds = new Set(), rules = RULES) {
  for (let late = 0; late <= rules.graceSteps; late++) {
    const step = scenario.steps[stepIndex - late];
    if (step?.error && !caughtIds.has(step.id)) {
      return { errorStepId: step.id, stepsLate: late };
    }
  }
  return null;
}

// Points for a single STOP, given the grader's verdict.
export function scoreStop({ severity, stepsLate = 0, verdict, reasoningScore = 0 }, rules = RULES) {
  if (verdict === 'false_alarm' || !severity) return rules.falseAlarmPenalty;
  const base = rules.catchPoints[severity] ?? 0;
  const late = rules.latenessMultiplier[stepsLate] ?? 0;
  const reasoning = rules.reasoningFloor + (1 - rules.reasoningFloor) * reasoningScore;
  const explanation = verdict === 'wrong' ? rules.wrongExplanationMultiplier : 1;
  return Math.round(base * late * reasoning * explanation);
}

// Final tally. `events` is the list the game records:
//   { type: 'catch', stepId, errorStepId, stepsLate, verdict, reasoningScore, points }
//   { type: 'false_alarm', stepId, points }
export function scoreRun(scenario, events, rules = RULES) {
  const caught = new Set(events.filter(e => e.type === 'catch').map(e => e.errorStepId));
  const missed = scenario.steps
    .filter(s => s.error && !caught.has(s.id))
    .map(s => ({ stepId: s.id, ...s.error, points: rules.missedPenalty[s.error.severity] ?? 0 }));

  const earned = events.reduce((sum, e) => sum + (e.points ?? 0), 0);
  const penalties = missed.reduce((sum, m) => sum + m.points, 0);
  const total = earned + penalties;

  const maxPossible = scenario.steps
    .filter(s => s.error)
    .reduce((sum, s) => sum + (rules.catchPoints[s.error.severity] ?? 0), 0);

  const missedCritical = missed.some(m => m.severity === 'critical');
  return {
    total,
    maxPossible,
    caughtCount: caught.size,
    mistakeCount: scenario.steps.filter(s => s.error).length,
    falseAlarms: events.filter(e => e.type === 'false_alarm').length,
    missed,
    missedCritical,
    rating: rate(total, maxPossible, missedCritical)
  };
}

function rate(total, max, missedCritical) {
  if (missedCritical) return 'Someone got hurt';
  const pct = max > 0 ? total / max : 0;
  if (pct >= 0.85) return 'Journeyman eyes';
  if (pct >= 0.6) return 'Solid supervisor';
  if (pct >= 0.3) return 'Keep watching';
  return 'Back to the classroom';
}
