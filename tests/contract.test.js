import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import * as contract from '../shared/contract.js';
import { validateScenario } from '../shared/contract.js';
import { mockGrade } from '../shared/mock-grader.js';

const dir = new URL('../packs/demo-trades/scenarios/', import.meta.url);
const load = f => JSON.parse(readFileSync(new URL(f, dir)));
const pack = JSON.parse(readFileSync(new URL('../packs/demo-trades/pack.json', import.meta.url)));

for (const file of readdirSync(dir).filter(f => f.endsWith('.json'))) {
  test(`fixture ${file} matches the contract`, () => {
    assert.deepEqual(validateScenario(load(file)), []);
  });
}

test('every pack scenario points at an existing fixture', () => {
  const files = readdirSync(dir);
  for (const { id, ...t } of pack.scenarios) {
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

test('toPublicCard returns exactly the public keys (deep key allow-list)', () => {
  assert.equal(typeof contract.toPublicCard, 'function');
  const card = load('electrical.json');
  // Extra keys anywhere must never be copied through.
  card.secret = 'top';
  card.steps[0].hint = 'step';
  Object.defineProperty(card, 'hidden', { value: 'x', enumerable: false });
  const pub = contract.toPublicCard(card, { id: 'fx_demo-trades_1_electrical', subject: 'demo-trades' });
  assert.deepEqual(Object.keys(pub).sort(), ['apprentice', 'id', 'setting', 'steps', 'subject', 'title']);
  assert.equal(pub.id, 'fx_demo-trades_1_electrical');
  assert.equal(pub.subject, 'demo-trades');
  assert.equal(pub.title, card.title);
  assert.equal(pub.setting, card.setting);
  assert.equal(pub.apprentice, card.apprentice);
  assert.equal(pub.steps.length, card.steps.length);
  pub.steps.forEach((step, i) => {
    assert.deepEqual(Object.keys(step).sort(), ['id', 'line'], `step ${i + 1}`);
    assert.equal(step.id, card.steps[i].id);
    assert.equal(step.line, card.steps[i].line);
  });
  // No answer text survives anywhere in the serialized card.
  const text = JSON.stringify(pub);
  for (const step of card.steps.filter(st => st.error)) assert.ok(!text.includes(step.error.why), 'no why');
  assert.ok(!/"(error|trade|keywords|secret|hint)"/.test(text), text);
  // A copy: changing the public card leaves the stored card alone.
  pub.steps[0].line = 'changed';
  assert.notEqual(card.steps[0].line, 'changed');
});
