import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { validateScenario } from '../shared/contract.js';
import { mockGrade } from '../shared/mock-grader.js';
import { TRADES } from '../server/prompts/trades.js';

const dir = new URL('../fixtures/scenarios/', import.meta.url);
const load = f => JSON.parse(readFileSync(new URL(f, dir)));

for (const file of readdirSync(dir).filter(f => f.endsWith('.json'))) {
  test(`fixture ${file} matches the contract`, () => {
    assert.deepEqual(validateScenario(load(file)), []);
  });
}

test('every trade points at an existing fixture', () => {
  const files = readdirSync(dir);
  for (const [id, t] of Object.entries(TRADES)) {
    assert.ok(files.includes(t.fixture), `${id} -> ${t.fixture} missing`);
  }
});

test('validator rejects a scenario with no critical mistake', () => {
  const s = load('electrical.json');
  s.steps = s.steps.map(step => (step.error ? { ...step, error: { ...step.error, severity: 'minor' } } : step));
  assert.ok(validateScenario(s).some(p => p.includes('critical')));
});

test('mock grader: good explanation is correct, unrelated one is wrong, clean step is false alarm', () => {
  const s = load('electrical.json');
  assert.equal(mockGrade(s, 3, "he never tested it, it could still be live").verdict, 'correct');
  assert.notEqual(mockGrade(s, 3, 'his shoes are untied').verdict, 'correct');
  assert.equal(mockGrade(s, null, 'anything').verdict, 'false_alarm');
});
