import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mockGrade } from '../shared/mock-grader.js';

// The demo fixture is read at test time, so these follow its keywords as they change.
const electrical = JSON.parse(readFileSync(new URL('../fixtures/scenarios/electrical.json', import.meta.url)));
const adversarial = JSON.parse(readFileSync(new URL('./fixtures/adversarial-inputs.json', import.meta.url)));
const input = id => adversarial.find(x => x.id === id).explanation;

// A one-mistake scenario with fixed keywords, for cases that must not drift with the fixtures.
const withKeywords = keywords => ({
  steps: [
    { id: 1, line: 'Setting up.', error: null },
    { id: 2, line: 'Doing the risky thing.', error: { severity: 'critical', summary: 's', why: 'Here is why.', correctAction: 'Do it right.', consequence: 'c', keywords } }
  ]
});
// Electrical step 3 and brakes step 2/4 keywords as they were when these cases were written.
const ELEC_3 = ['test', 'tester', 'verify', 'meter', 'live', 'hot', 'dead', 'voltage', 'lights'];
const JACK = ['jack stand', 'stands', 'stand', 'support', 'jack', 'drop', 'fall', 'crush'];
const CALIPER = ['hose', 'hang', 'hook', 'wire', 'support', 'line'];

const ORDER = ['wrong', 'partial', 'correct'];
const atLeast = (got, min) => ORDER.indexOf(got) >= ORDER.indexOf(min);

test('plain-language demo answers on electrical step 3 are correct', () => {
  for (const t of [
    "he didn't test it, it could still be live",
    "he didn't check it was off",
    'he didnt check if it was still on',
    "he should make sure there's no power"
  ]) {
    assert.equal(mockGrade(electrical, 3, t).verdict, 'correct', t);
    assert.equal(mockGrade(withKeywords(ELEC_3), 2, t).verdict, 'correct', t);
  }
});

test('half answers on electrical step 3 get at least partial', () => {
  for (const t of ['it could still have power', 'he didnt use a tester']) {
    assert.ok(atLeast(mockGrade(electrical, 3, t).verdict, 'partial'), t);
    assert.ok(atLeast(mockGrade(withKeywords(ELEC_3), 2, t).verdict, 'partial'), t);
  }
});

test('the wrong-breaker reason is correct once the fixture lists breaker/circuit', (t) => {
  const kw = electrical.steps.find(s => s.id === 3).error.keywords;
  if (!kw.includes('breaker')) return t.skip('electrical.json step 3 has no breaker keyword yet');
  assert.equal(mockGrade(electrical, 3, 'the outlet could be on a different breaker').verdict, 'correct');
  assert.notEqual(mockGrade(electrical, 3, 'the kitchen lights went out').verdict, 'correct');
});

test('keyword stuffing and substring tricks are never correct', () => {
  assert.notEqual(mockGrade(withKeywords(ELEC_3), 2, input('A06')).verdict, 'correct');
  assert.notEqual(mockGrade(electrical, 3, input('A06')).verdict, 'correct');
  assert.notEqual(mockGrade(withKeywords(JACK), 2, input('A24')).verdict, 'correct'); // "understand" is not "stand"
  assert.notEqual(mockGrade(withKeywords(JACK), 2, input('A25')).verdict, 'correct');
});

test('"online deadline" does not hit the keyword "line"', () => {
  const g = mockGrade(withKeywords(CALIPER), 2, input('A30'));
  assert.equal(g.verdict, 'partial');
  assert.equal(g.reasoningScore, 0.2); // zero keyword hits
});

test('an off-topic answer at the right moment is partial and explains the problem', () => {
  const g = mockGrade(withKeywords(ELEC_3), 2, 'his shoes are untied');
  assert.deepEqual(g, { verdict: 'partial', reasoningScore: 0.2, feedback: "Right moment to stop. Here's the problem: Here is why." });
});

test('empty or one-word answers are wrong', () => {
  for (const t of ['', '   ', 'um', undefined, null]) {
    assert.equal(mockGrade(electrical, 3, t).verdict, 'wrong', String(t));
    assert.equal(mockGrade(electrical, 3, t).reasoningScore, 0);
  }
});

test('bad keyword lists do not throw', () => {
  assert.doesNotThrow(() => mockGrade(withKeywords([42, 'live']), 2, 'it is still live in there'));
  assert.doesNotThrow(() => mockGrade(withKeywords(undefined), 2, 'it is still live in there'));
  // An empty keyword must not match every answer.
  assert.equal(mockGrade(withKeywords(['', 'x']), 2, 'he forgot something').reasoningScore, 0.2);
  assert.doesNotThrow(() => mockGrade(withKeywords(['live']), 2, 12345));
});

test('slang and speech-to-text spellings count', () => {
  assert.equal(mockGrade(withKeywords(ELEC_3), 2, input('A02')).verdict, 'correct'); // juice
  assert.equal(mockGrade(withKeywords(['gfci', 'water', 'sink']), 2, input('A32')).verdict, 'correct'); // G F C I
});

test('scores are capped and the response shape is unchanged', () => {
  const g = mockGrade(electrical, 3, "he didn't test it, it could still be live");
  assert.deepEqual(Object.keys(g).sort(), ['feedback', 'reasoningScore', 'verdict']);
  assert.ok(g.reasoningScore <= 0.8);
  assert.equal(mockGrade(electrical, null, 'anything').verdict, 'false_alarm');
});
