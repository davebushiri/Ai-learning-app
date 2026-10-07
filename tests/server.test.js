// Server resilience: runs server/index.js as a child process.
// MOCK mode for request hardening; LIVE mode against tests/helpers/fake-claude.mjs for grading rules.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './helpers/server.mjs';
import { startFakeClaude } from './helpers/fake-claude.mjs';
import { rawRequest, postGrade, getJson, loadFixture } from './helpers/http.mjs';

const scenario = loadFixture('electrical.json');
const mistake = scenario.steps.find(s => s.error);
const clean = scenario.steps.find(s => !s.error);
const catchBody = { scenario, stepId: mistake.id, errorStepId: mistake.id, explanation: "he didn't test it, it could still be live" };
const falseAlarmBody = { scenario, stepId: clean.id, errorStepId: null, explanation: 'he should lock it out' };

describe('MOCK server', () => {
  let app;
  before(async () => { app = await startServer({ MOCK: '1' }); });
  after(() => app.stop());

  const healthOk = async () => assert.equal((await getJson(`${app.url}/api/health`)).status, 200);

  test('BRAIN-01: malformed URL and Host header do not crash the server', async () => {
    for (const req of [
      'GET //%5B HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n',
      'GET //x:abc/ HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n',
      'GET / HTTP/1.1\r\nHost: [\r\nConnection: close\r\n\r\n',
      'GET /api/health HTTP/1.1\r\nHost: [\r\nConnection: close\r\n\r\n'
    ]) {
      const status = await rawRequest(app.url, req);
      assert.ok([200, 400, 404].includes(status), `${JSON.stringify(req)} -> ${status}`);
      await healthOk();
    }
    assert.ok(app.alive());
  });

  test('BRAIN-09: trade must be an own key of TRADES', async () => {
    for (const trade of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
      assert.equal((await getJson(`${app.url}/api/scenario?trade=${trade}`)).status, 400, trade);
    }
    assert.equal((await getJson(`${app.url}/api/scenario?trade=electrical`)).status, 200);
  });

  test('BRAIN-09: bad grade bodies get 400/413, not 500', async () => {
    assert.equal((await postGrade(app.url, '{bad')).status, 400);
    assert.equal((await postGrade(app.url, 'null')).status, 400);
    assert.equal((await postGrade(app.url, { scenario: { steps: 'abc' } })).status, 400);
    assert.equal((await postGrade(app.url, { scenario: { steps: [null] } })).status, 400);
    const big = JSON.stringify({ ...catchBody, explanation: 'x'.repeat(1_100_000) });
    assert.equal((await postGrade(app.url, big)).status, 413);
    await healthOk();
  });

  test('BRAIN-09: non-string and huge explanations are coerced', async () => {
    const r = await postGrade(app.url, { ...catchBody, explanation: 12345 });
    assert.equal(r.status, 200);
    assert.equal(r.json.source, 'mock');
    assert.equal((await postGrade(app.url, { ...catchBody, explanation: 'live '.repeat(20_000) })).status, 200);
    assert.ok(app.alive());
  });

  test('BRAIN-08: one log line per API request with route, source and ms', async () => {
    await postGrade(app.url, catchBody);
    assert.match(app.output(), /\[api\] POST \/api\/grade 200 mock \d+ ms/);
  });
});

describe('LIVE server against fake Claude', () => {
  let stub, app;
  before(async () => {
    stub = await startFakeClaude();
    app = await startServer({ MOCK: '0', ANTHROPIC_API_KEY: 'sk-fake', ANTHROPIC_BASE_URL: stub.url, GRADE_DEADLINE_MS: '1500' });
  });
  after(async () => { await app.stop(); await stub.close(); });

  test('BRAIN-03: Claude false_alarm on a real mistake becomes wrong, still live', async () => {
    stub.setMode({ grade: { verdict: 'false_alarm', reasoningScore: 0.4, feedback: 'Step was fine.' } });
    const r = await postGrade(app.url, catchBody);
    assert.equal(r.json.verdict, 'wrong');
    assert.equal(r.json.source, 'live');
  });

  test('BRAIN-03: false alarms are graded by Claude once, verdict forced to false_alarm', async () => {
    stub.reset();
    stub.setMode({ grade: { verdict: 'correct', reasoningScore: 1, feedback: 'Fair point, but that step was fine.' } });
    const r = await postGrade(app.url, falseAlarmBody);
    assert.equal(r.json.verdict, 'false_alarm');
    assert.equal(r.json.source, 'live');
    assert.equal(r.json.feedback, 'Fair point, but that step was fine.');
    assert.equal(stub.log.filter(e => e.kind === 'grade').length, 1);
  });

  test('BRAIN-09: explanation is capped at 2000 chars before it reaches Claude', async () => {
    stub.reset();
    await postGrade(app.url, { ...catchBody, explanation: 'q'.repeat(5000) });
    const prompt = JSON.stringify(stub.log.at(-1).user);
    assert.ok(prompt.includes('q'.repeat(100)) && !prompt.includes('q'.repeat(2001)));
  });

  test('BRAIN-03: STOP aimed at a clean step id is treated as a false alarm', async () => {
    stub.setMode({ grade: { verdict: 'correct', reasoningScore: 1, feedback: 'ok' } });
    const r = await postGrade(app.url, { ...falseAlarmBody, errorStepId: clean.id });
    assert.equal(r.json.verdict, 'false_alarm');
  });

  test('BRAIN-03: empty feedback falls back to the keyword grader', async () => {
    stub.setMode({ grade: { verdict: 'correct', reasoningScore: 1, feedback: '   ' } });
    const r = await postGrade(app.url, catchBody);
    assert.equal(r.json.source, 'mock-fallback');
    assert.ok(r.json.feedback.trim());
  });

  test('BRAIN-08: happy grade logs a [claude] line and sets lastLiveOkAt', async () => {
    stub.setMode({});
    const r = await postGrade(app.url, catchBody);
    assert.equal(r.json.source, 'live');
    assert.match(app.output(), /\[claude\] grade \d+ ms claude-opus-5-5 end_turn 1234\/321 tokens msg_stub_\d+/);
    const health = (await getJson(`${app.url}/api/health`)).json;
    assert.equal(health.mode, 'live');
    assert.ok(health.lastLiveOkAt);
  });

  test('BRAIN-08: 401 shows up in /api/health lastLiveError', async () => {
    stub.setMode({ status: 401 });
    const r = await postGrade(app.url, catchBody);
    assert.equal(r.json.source, 'mock-fallback');
    const health = (await getJson(`${app.url}/api/health`)).json;
    assert.match(health.lastLiveError, /401/);
    assert.match(app.output(), /\[claude\] grade failed after \d+ ms status=401 request=req_stub_\d+/);
  });
});
