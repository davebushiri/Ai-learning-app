// BRAIN-02: every Claude call has a hard deadline, and fallback responses parse.
// Runs server/index.js in LIVE mode against tests/helpers/fake-claude.mjs with short deadlines.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './helpers/server.mjs';
import { startFakeClaude, happyGrade, happyScenario } from './helpers/fake-claude.mjs';
import { postGrade, getJson, loadFixture } from './helpers/http.mjs';
import { responseText } from '../server/llm.js';

const scenario = loadFixture('electrical.json');
const mistake = scenario.steps.find(s => s.error);
const catchBody = { scenario, stepId: mistake.id, errorStepId: mistake.id, explanation: "he didn't test it, it could still be live" };

// A declined model's partial output, the hand-off marker, then the fallback model's answer.
const fallbackContent = json => [
  { type: 'text', text: '{"verdict": "corr' },
  { type: 'fallback', from: { model: 'claude-opus-5-5' }, to: { model: 'claude-fallback' }, trigger: null },
  { type: 'text', text: json.slice(0, 10) },
  { type: 'text', text: json.slice(10) }
];

test('responseText joins text blocks after the last fallback block', () => {
  assert.equal(responseText([{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }]), 'ab');
  assert.equal(responseText([{ type: 'thinking' }, { type: 'text', text: '{}' }]), '{}');
  assert.equal(responseText(fallbackContent('{"x":1}')), '{"x":1}');
  assert.equal(responseText([{ type: 'text', text: 'x' }, { type: 'fallback' }]), '');
});

describe('deadlines against fake Claude', () => {
  let stub, app;
  before(async () => {
    stub = await startFakeClaude();
    app = await startServer({
      MOCK: '0', ANTHROPIC_API_KEY: 'sk-fake', ANTHROPIC_BASE_URL: stub.url,
      GRADE_DEADLINE_MS: '1500', SCENARIO_DEADLINE_MS: '2000'
    });
  });
  after(async () => { await app.stop(); await stub.close(); });

  test('grade: hanging API falls back to keyword grader within 2.5s', async () => {
    stub.setMode({ hang: true });
    const r = await postGrade(app.url, catchBody);
    assert.equal(r.json.source, 'mock-fallback');
    assert.ok(r.ms < 2500, `${r.ms} ms`);
    assert.match(app.output(), /timed out after 1500 ms/);
  });

  test('grade: 429 with retry-after 60 falls back within 2.5s', async () => {
    stub.setMode({ status: 429, retryAfter: '60' });
    const r = await postGrade(app.url, catchBody);
    assert.equal(r.json.source, 'mock-fallback');
    assert.ok(r.ms < 2500, `${r.ms} ms`);
  });

  test('scenario: hanging API falls back to the fixture within 3s', async () => {
    stub.setMode({ hang: true });
    const r = await getJson(`${app.url}/api/scenario?trade=electrical`);
    assert.equal(r.json.source, 'fixture-fallback');
    assert.ok(r.ms < 3000, `${r.ms} ms`);
  });

  test('happy path is live, with at most one retry per call', async () => {
    stub.reset();
    const s = await getJson(`${app.url}/api/scenario?trade=electrical`);
    assert.equal(s.json.source, 'live');
    assert.equal(s.json.trade, 'electrical');
    assert.equal((await postGrade(app.url, catchBody)).json.source, 'live');
    stub.setMode({ status: 500 });
    await postGrade(app.url, catchBody);
    assert.equal(stub.log.filter(e => e.applied.status === 500).length, 2);
  });

  test('P1-6: JSON after a fallback block is parsed (grade and scenario)', async () => {
    stub.setMode({ content: fallbackContent(JSON.stringify(happyGrade())) });
    const g = await postGrade(app.url, catchBody);
    assert.equal(g.json.source, 'live');
    assert.equal(g.json.verdict, 'correct');
    stub.setMode({ content: fallbackContent(JSON.stringify(happyScenario())) });
    const s = await getJson(`${app.url}/api/scenario?trade=electrical`);
    assert.equal(s.json.source, 'live');
  });
});
