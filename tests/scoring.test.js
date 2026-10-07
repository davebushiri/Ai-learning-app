import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveStop, scoreStop, scoreRun, RULES } from '../shared/scoring.js';

const scenario = JSON.parse(readFileSync(new URL('../fixtures/scenarios/electrical.json', import.meta.url)));
const idx = id => scenario.steps.findIndex(s => s.id === id);

test('STOP on the mistake step targets that mistake', () => {
  assert.deepEqual(resolveStop(scenario, idx(3)), { errorStepId: 3, stepsLate: 0 });
});

test('STOP one step late still counts, flagged as late', () => {
  assert.deepEqual(resolveStop(scenario, idx(4)), { errorStepId: 3, stepsLate: 1 });
});

test('STOP on a clean step with no recent mistake is a false alarm', () => {
  assert.equal(resolveStop(scenario, idx(1)), null);
  assert.equal(resolveStop(scenario, idx(9)), null);
});

test('an already-caught mistake cannot be caught twice', () => {
  assert.equal(resolveStop(scenario, idx(4), new Set([3])), null);
});

test('early, well-reasoned critical catch earns full points', () => {
  assert.equal(scoreStop({ severity: 'critical', stepsLate: 0, verdict: 'correct', reasoningScore: 1 }), 300);
});

test('late catches and weak reasoning earn less', () => {
  const early = scoreStop({ severity: 'major', stepsLate: 0, verdict: 'correct', reasoningScore: 1 });
  const late = scoreStop({ severity: 'major', stepsLate: 1, verdict: 'correct', reasoningScore: 1 });
  const weak = scoreStop({ severity: 'major', stepsLate: 0, verdict: 'correct', reasoningScore: 0 });
  assert.ok(late < early);
  assert.ok(weak < early);
});

test('false alarm is penalized', () => {
  assert.equal(scoreStop({ severity: null, verdict: 'false_alarm' }), RULES.falseAlarmPenalty);
});

test('missing the critical mistake is flagged and heavily penalized', () => {
  const r = scoreRun(scenario, []);
  assert.equal(r.missedCritical, true);
  assert.equal(r.rating, 'Someone got hurt');
  assert.equal(r.missed.length, 3);
  assert.ok(r.total < 0);
});

test('perfect run gets the top rating', () => {
  const events = scenario.steps.filter(s => s.error).map(s => ({
    type: 'catch', stepId: s.id, errorStepId: s.id, stepsLate: 0, verdict: 'correct', reasoningScore: 1,
    points: scoreStop({ severity: s.error.severity, stepsLate: 0, verdict: 'correct', reasoningScore: 1 })
  }));
  const r = scoreRun(scenario, events);
  assert.equal(r.total, r.maxPossible);
  assert.equal(r.missed.length, 0);
  assert.equal(r.rating, 'Journeyman eyes');
});
