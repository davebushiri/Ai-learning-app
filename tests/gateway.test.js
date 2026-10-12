// F1a-T08a (ADR 0005 + Amendments 1 and 2): the AI gateway, tested route-independently
// (thread 0004). Unit tests inject a fake client {beta: {messages: {create}}}; the
// in-process tests use a real SDK client pointed at fake Claude and log into openDb(':memory:').

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHash } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { createGateway, promptFingerprint, responseText } from '../server/ai/gateway.js';
import { MODEL } from '../server/ai/models.js';
import * as gradePrompt from '../server/prompts/grade.js';
import * as scenarioPrompt from '../server/prompts/scenario.js';
import { clampGrade } from '../shared/contract.js';
import { openDb } from '../server/db.js';
import { startFakeClaude } from './helpers/fake-claude.mjs';

const GRADE_INPUT = gradePrompt.PROMPT.fingerprintInputs[0];
const SCENARIO_INPUT = scenarioPrompt.PROMPT.fingerprintInputs[0];
const GOOD = { verdict: 'correct', reasoningScore: 0.8, feedback: 'Nice catch.' };
const FALLBACK = { verdict: 'wrong', reasoningScore: 0, feedback: 'keyword grader' };
const feedbackCheck = g => (String(g?.feedback ?? '').trim() ? [] : ['Claude returned empty feedback']);

const message = (over = {}) => ({
  id: 'msg_unit', type: 'message', role: 'assistant', model: 'claude-served', stop_reason: 'end_turn',
  content: [{ type: 'text', text: JSON.stringify(GOOD) }], usage: { input_tokens: 10, output_tokens: 5 }, ...over
});

// A fake client whose create() resolves with `reply` (or throws it if it's an Error).
function fakeClient(reply) {
  const calls = [];
  const create = async (body, opts) => {
    calls.push({ body, opts });
    if (reply instanceof Error) throw reply;
    return reply;
  };
  return { calls, client: { beta: { messages: { create } } } };
}

function unitGateway(reply) {
  const { calls, client } = fakeClient(reply);
  const rows = [];
  const gw = createGateway({ client, logCall: r => rows.push(r) });
  return { calls, rows, run: gw.run };
}

const gradeRun = (extra = {}) => ({
  prompt: gradePrompt, input: GRADE_INPUT, live: true, effort: 'low', deadlineMs: 1500,
  normalize: clampGrade, accept: feedbackCheck, fallback: () => FALLBACK, ...extra
});

// Silence the gateway's [claude] lines in unit tests while still letting tests read them.
function captureConsole(t) {
  const lines = [];
  t.mock.method(console, 'log', (...a) => lines.push(a.join(' ')));
  t.mock.method(console, 'warn', (...a) => lines.push(a.join(' ')));
  return lines;
}

describe('gateway argument guards (S12)', () => {
  test('run without fallback rejects with TypeError', async () => {
    const { run, rows, calls } = unitGateway(message());
    await assert.rejects(run(gradeRun({ fallback: undefined })), TypeError);
    await assert.rejects(run(gradeRun({ fallback: 'nope' })), TypeError);
    assert.equal(rows.length, 0);
    assert.equal(calls.length, 0);
  });

  test('run with a prompt lacking VERSION rejects with TypeError', async () => {
    const { PROMPT } = gradePrompt;
    const bad = [
      { PROMPT },
      { PROMPT, VERSION: 0 },
      { PROMPT, VERSION: '1' },
      { PROMPT, VERSION: 1.5 },
      { PROMPT: { ...PROMPT, id: undefined }, VERSION: 1 },
      { PROMPT: { ...PROMPT, id: '' }, VERSION: 1 },
      { VERSION: 1 },
      undefined
    ];
    const { run, rows, calls } = unitGateway(message());
    for (const prompt of bad) {
      await assert.rejects(run(gradeRun({ prompt })), TypeError, JSON.stringify(prompt));
    }
    assert.equal(rows.length, 0, 'no llm_call row for a bad prompt');
    assert.equal(calls.length, 0);
  });

  test('run accepts a plain {PROMPT, VERSION} object', async t => {
    captureConsole(t);
    const { run, rows } = unitGateway(message());
    const r = await run(gradeRun({ prompt: { PROMPT: gradePrompt.PROMPT, VERSION: 3 } }));
    assert.equal(r.source, 'live');
    assert.equal(r.meta.promptVersion, 'grade@3');
    assert.equal(rows[0].prompt_version, 'grade@3');
  });
});

describe('gateway outcomes with an injected client', () => {
  test('live:false calls fallback, sends nothing and logs outcome mock', async () => {
    const { run, rows, calls } = unitGateway(message());
    const r = await run(gradeRun({ live: false }));
    assert.deepEqual(r.data, FALLBACK);
    assert.equal(r.source, 'mock');
    assert.equal(r.meta.outcome, 'mock');
    assert.equal(r.meta.error, null);
    assert.equal(calls.length, 0);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].outcome, 'mock');
    assert.equal(rows[0].model, MODEL);
    assert.equal(rows[0].input_tokens, 0);
    assert.equal(rows[0].output_tokens, 0);
  });

  test('a live ok call sends the ADR 0005 body and options to client.beta.messages.create', async t => {
    captureConsole(t);
    const { run, calls } = unitGateway(message());
    const r = await run(gradeRun());
    assert.equal(r.source, 'live');
    assert.equal(r.meta.outcome, 'ok');
    assert.equal(r.meta.error, null);
    assert.equal(r.meta.model, 'claude-served');
    assert.deepEqual(r.data, GOOD);
    const { body, opts } = calls[0];
    assert.equal(body.model, MODEL);
    assert.equal(body.max_tokens, 16000);
    assert.equal(body.system, gradePrompt.PROMPT.system);
    assert.deepEqual(body.messages, [{ role: 'user', content: gradePrompt.PROMPT.render(GRADE_INPUT) }]);
    assert.deepEqual(body.output_config, { effort: 'low', format: { type: 'json_schema', schema: gradePrompt.PROMPT.schema } });
    assert.deepEqual(body.betas, ['server-side-fallback-2026-07-01']);
    assert.equal(body.fallbacks, 'default');
    assert.ok(opts.signal instanceof AbortSignal);
    assert.equal(opts.maxRetries, 1);
    assert.deepEqual(opts.headers, { 'x-prompt-id': 'grade@1' });
  });

  test('accept problems (empty feedback, wrong-schema {}) give outcome fallback and the fallback data', async t => {
    captureConsole(t);
    for (const text of ['{"verdict":"correct","reasoningScore":1,"feedback":"  "}', '{}']) {
      const { run, rows } = unitGateway(message({ content: [{ type: 'text', text }] }));
      const r = await run(gradeRun());
      assert.equal(r.meta.outcome, 'fallback', text);
      assert.equal(r.source, 'fallback');
      assert.deepEqual(r.data, FALLBACK);
      assert.equal(r.meta.error, 'Claude returned empty feedback');
      assert.equal(rows[0].outcome, 'fallback');
    }
  });

  test('accept problems are joined with "; " in meta.error', async t => {
    captureConsole(t);
    const { run } = unitGateway(message());
    const r = await run(gradeRun({ accept: () => ['a is bad', 'b is bad'] }));
    assert.equal(r.meta.error, 'a is bad; b is bad');
  });

  test('max_tokens gives outcome fallback even when the text parses', async t => {
    captureConsole(t);
    const { run, rows } = unitGateway(message({ stop_reason: 'max_tokens' }));
    const r = await run(gradeRun());
    assert.equal(r.meta.outcome, 'fallback');
    assert.deepEqual(r.data, FALLBACK);
    assert.equal(r.meta.error, 'Claude response was cut off (max_tokens)');
    assert.equal(rows[0].input_tokens, 10, 'tokens are logged when there was a response');
  });

  test('non-JSON text gives outcome fallback', async t => {
    captureConsole(t);
    const { run } = unitGateway(message({ content: [{ type: 'text', text: 'not json {' }] }));
    const r = await run(gradeRun());
    assert.equal(r.meta.outcome, 'fallback');
    assert.deepEqual(r.data, FALLBACK);
    let parseMessage;
    try { JSON.parse('not json {'); } catch (e) { parseMessage = e.message; }
    assert.equal(r.meta.error, parseMessage);
  });

  test('empty text gives outcome fallback with "Claude returned no text"', async t => {
    captureConsole(t);
    const { run } = unitGateway(message({ content: [] }));
    const r = await run(gradeRun());
    assert.equal(r.meta.outcome, 'fallback');
    assert.equal(r.meta.error, 'Claude returned no text');
  });

  test('a throw in normalize gives outcome fallback', async t => {
    captureConsole(t);
    const { run } = unitGateway(message());
    const r = await run(gradeRun({ normalize: () => { throw new Error('normalize broke'); } }));
    assert.equal(r.meta.outcome, 'fallback');
    assert.deepEqual(r.data, FALLBACK);
    assert.equal(r.meta.error, 'normalize broke');
  });

  test('normalize runs before accept and never on fallback data', async t => {
    captureConsole(t);
    const order = [];
    const normalize = d => { order.push(['normalize', d]); return { ...d, stamped: true }; };
    const accept = d => { order.push(['accept', d]); return []; };
    const ok = unitGateway(message());
    const r = await ok.run(gradeRun({ normalize, accept }));
    assert.deepEqual(order.map(o => o[0]), ['normalize', 'accept']);
    assert.equal(order[1][1].stamped, true, 'accept sees the normalized data');
    assert.equal(r.data.stamped, true);

    order.length = 0;
    for (const reply of [message({ stop_reason: 'max_tokens' }), new Anthropic.APIUserAbortError()]) {
      const fb = unitGateway(reply);
      const f = await fb.run(gradeRun({ normalize, accept }));
      assert.deepEqual(f.data, FALLBACK, 'fallback data is returned as is');
    }
    const mock = unitGateway(message());
    await mock.run(gradeRun({ live: false, normalize, accept }));
    assert.deepEqual(order, [], 'neither hook runs on fallback or mock data');
  });

  test("{verdict:'bogus', feedback:'x'} is normalized to wrong and is ok", async t => {
    captureConsole(t);
    const { run } = unitGateway(message({ content: [{ type: 'text', text: '{"verdict":"bogus","feedback":"x"}' }] }));
    const r = await run(gradeRun());
    assert.equal(r.meta.outcome, 'ok');
    assert.equal(r.source, 'live');
    assert.deepEqual(r.data, { verdict: 'wrong', reasoningScore: 0, feedback: 'x' });
  });

  test('refusal gives outcome refusal', async t => {
    captureConsole(t);
    const { run, rows } = unitGateway(message({ stop_reason: 'refusal', stop_details: { category: 'cyber' } }));
    const r = await run(gradeRun());
    assert.equal(r.meta.outcome, 'refusal');
    assert.equal(r.source, 'fallback');
    assert.deepEqual(r.data, FALLBACK);
    assert.equal(r.meta.error, 'Claude declined: cyber');
    assert.equal(rows[0].outcome, 'refusal');
  });

  test("timeout meta.error is 'Claude grade timed out after 1500 ms'", async t => {
    captureConsole(t);
    const { run, rows } = unitGateway(new Anthropic.APIUserAbortError());
    const r = await run(gradeRun());
    assert.equal(r.meta.outcome, 'timeout');
    assert.equal(r.source, 'fallback');
    assert.equal(r.meta.error, 'Claude grade timed out after 1500 ms');
    assert.equal(rows[0].model, MODEL, 'requested model when there was no response');
    assert.equal(rows[0].input_tokens, 0);
  });

  test("an SDK error's meta.error is err.message unchanged", async t => {
    captureConsole(t);
    const err = new Anthropic.AuthenticationError(401, { type: 'error', error: { type: 'authentication_error', message: 'bad key' } }, undefined, new Headers());
    const { run } = unitGateway(err);
    const r = await run(gradeRun());
    assert.equal(r.meta.outcome, 'fallback');
    assert.equal(r.meta.error, err.message);
    assert.match(r.meta.error, /401/);
  });

  test('a throwing logCall does not change the result', async t => {
    const lines = captureConsole(t);
    const { client } = fakeClient(message());
    const gw = createGateway({ client, logCall: () => { throw new Error('disk full'); } });
    const r = await gw.run(gradeRun());
    assert.equal(r.source, 'live');
    assert.equal(r.meta.outcome, 'ok');
    assert.deepEqual(r.data, GOOD);
    assert.ok(lines.some(l => l.includes('disk full')), 'the logCall failure is warned');
    const m = await gw.run(gradeRun({ live: false }));
    assert.equal(m.source, 'mock');
  });

  test('exactly one logCall on every exit path (one per outcome-table row)', async t => {
    captureConsole(t);
    const fbBlock = [
      { type: 'text', text: '{"verdict": "corr' },
      { type: 'fallback', from: { model: 'a' }, to: { model: 'b' }, trigger: null },
      { type: 'text', text: JSON.stringify(GOOD) }
    ];
    const rows = [
      ['valid data', message(), {}, 'ok', 'live'],
      ['text after a fallback block', message({ content: fbBlock }), {}, 'ok', 'live'],
      ['APIUserAbortError', new Anthropic.APIUserAbortError(), {}, 'timeout', 'fallback'],
      ['refusal', message({ stop_reason: 'refusal' }), {}, 'refusal', 'fallback'],
      ['SDK 500', new Anthropic.InternalServerError(500, undefined, 'boom', new Headers()), {}, 'fallback', 'fallback'],
      ['connection error', new Anthropic.APIConnectionError({ message: 'ECONNREFUSED' }), {}, 'fallback', 'fallback'],
      ['max_tokens', message({ stop_reason: 'max_tokens' }), {}, 'fallback', 'fallback'],
      ['empty text', message({ content: [] }), {}, 'fallback', 'fallback'],
      ['non-JSON', message({ content: [{ type: 'text', text: 'nope' }] }), {}, 'fallback', 'fallback'],
      ['normalize throws', message(), { normalize: () => { throw new Error('x'); } }, 'fallback', 'fallback'],
      ['accept problems', message({ content: [{ type: 'text', text: '{}' }] }), {}, 'fallback', 'fallback'],
      ['live:false', message(), { live: false }, 'mock', 'mock']
    ];
    for (const [name, reply, extra, outcome, source] of rows) {
      const { run, rows: logged } = unitGateway(reply);
      const r = await run(gradeRun(extra));
      assert.equal(logged.length, 1, `${name}: one logCall`);
      assert.equal(logged[0].outcome, outcome, `${name}: logged outcome`);
      assert.equal(r.meta.outcome, outcome, `${name}: meta.outcome`);
      assert.equal(r.source, source, `${name}: source`);
      assert.equal(r.meta.error === null, outcome === 'ok' || outcome === 'mock', `${name}: meta.error`);
      const row = logged[0];
      assert.match(row.id, /^llm_[0-9A-HJKMNP-TV-Z]{26}$/, name);
      assert.ok(!Number.isNaN(Date.parse(row.at)), name);
      assert.equal(row.pipeline, 'grade', name);
      assert.equal(row.prompt_version, 'grade@1', name);
      assert.ok(Number.isInteger(row.ms) && row.ms >= 0, name);
      assert.equal(row.cost_usd, null, name);
      assert.equal(row.cache_read, 0, name);
      assert.equal('error' in row, false, `${name}: meta.error never goes into llm_call`);
    }
  });

  test('cache_read comes from usage.cache_read_input_tokens', async t => {
    captureConsole(t);
    const { run, rows } = unitGateway(message({ usage: { input_tokens: 1, output_tokens: 2, cache_read_input_tokens: 7 } }));
    await run(gradeRun());
    assert.equal(rows[0].cache_read, 7);
  });
});

describe('promptFingerprint and responseText', () => {
  test("promptFingerprint equals T05's frozen values", () => {
    assert.equal(promptFingerprint(gradePrompt.PROMPT), '4f7d7c35478e9a60d6360077141122098571b07d8890f62deb5138bc7fca1b08');
    assert.equal(promptFingerprint(scenarioPrompt.PROMPT), '9de348f4d973f1323754e6c33e2ff75614a50ca4ac0943f444255591774fb898');
  });

  test('responseText joins text blocks after the last fallback block', () => {
    assert.equal(responseText([{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }]), 'ab');
    assert.equal(responseText([{ type: 'thinking' }, { type: 'text', text: '{}' }]), '{}');
    assert.equal(responseText([{ type: 'text', text: 'x' }, { type: 'fallback' }]), '');
    assert.equal(responseText(), '');
  });
});

describe('gateway with a real SDK client against fake Claude', () => {
  let stub, db, rows, gw;
  before(async () => {
    stub = await startFakeClaude();
    db = openDb(':memory:');
    rows = [];
    // The row goes through the real llm_call insert; the copy lets the test read it back
    // (Db has no llm_call reader).
    const logCall = r => { db.logLlmCall(r); rows.push(r); };
    gw = createGateway({ client: new Anthropic({ apiKey: 'sk-fake', baseURL: stub.url }), logCall });
  });
  after(async () => { db.close(); await stub.close(); });

  const timed = async args => {
    const t0 = Date.now();
    const r = await gw.run(args);
    return { r, ms: Date.now() - t0 };
  };

  test('happy LIVE grade writes one llm_call row ok with tokens 1234/321 and source live', async t => {
    captureConsole(t);
    stub.reset();
    rows.length = 0;
    const { r } = await timed(gradeRun());
    assert.equal(r.source, 'live');
    assert.equal(r.meta.outcome, 'ok');
    assert.equal(r.data.verdict, 'correct');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].outcome, 'ok');
    assert.equal(rows[0].input_tokens, 1234);
    assert.equal(rows[0].output_tokens, 321);
    assert.equal(rows[0].model, 'claude-opus-5-5');
    assert.equal(stub.log.length, 1);
  });

  test('hang gives outcome timeout within deadline + 1 s at 1500 ms', async t => {
    captureConsole(t);
    stub.reset();
    stub.setMode({ hang: true });
    rows.length = 0;
    const { r, ms } = await timed(gradeRun());
    assert.equal(r.meta.outcome, 'timeout');
    assert.equal(r.source, 'fallback');
    assert.deepEqual(r.data, FALLBACK);
    assert.equal(r.meta.error, 'Claude grade timed out after 1500 ms');
    assert.ok(ms < 2500, `${ms} ms`);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].outcome, 'timeout');
  });

  test('429 with retry-after 60 gives outcome timeout within deadline + 1 s', async t => {
    captureConsole(t);
    stub.reset();
    stub.setMode({ status: 429, retryAfter: '60' });
    rows.length = 0;
    const { r, ms } = await timed(gradeRun());
    assert.equal(r.meta.outcome, 'timeout');
    assert.ok(ms < 2500, `${ms} ms`);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].outcome, 'timeout');
  });

  test('500 and 529 give outcome fallback', async t => {
    captureConsole(t);
    for (const status of [500, 529]) {
      stub.reset();
      stub.setMode({ status });
      rows.length = 0;
      const { r, ms } = await timed(gradeRun());
      assert.equal(r.meta.outcome, 'fallback', String(status));
      assert.equal(r.source, 'fallback');
      assert.match(r.meta.error, new RegExp(String(status)));
      assert.ok(ms < 2500, `${status}: ${ms} ms`);
      assert.equal(stub.log.length, 2, `${status}: one retry`);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].outcome, 'fallback');
    }
  });

  test('refusal from fake Claude gives outcome refusal', async t => {
    captureConsole(t);
    stub.reset();
    stub.setMode({ stopReason: 'refusal', stopDetails: { category: 'cyber' } });
    rows.length = 0;
    const { r } = await timed(gradeRun());
    assert.equal(r.meta.outcome, 'refusal');
    assert.equal(rows[0].outcome, 'refusal');
  });

  test('the [claude] console line format is unchanged', async t => {
    const lines = captureConsole(t);
    stub.reset();
    await gw.run(gradeRun());
    assert.ok(lines.some(l => /^\[claude\] grade \d+ ms claude-opus-5-5 end_turn 1234\/321 tokens msg_stub_\d+$/.test(l)), lines.join('\n'));
    stub.setMode({ status: 401 });
    await gw.run(gradeRun());
    assert.ok(lines.some(l => /^\[claude\] grade failed after \d+ ms status=401 request=req_stub_\d+: 401 /.test(l)), lines.join('\n'));
  });

  test('scenario run against fake Claude is ok with normalize and accept', async t => {
    captureConsole(t);
    stub.reset();
    rows.length = 0;
    const r = await gw.run({
      prompt: scenarioPrompt, input: SCENARIO_INPUT, live: true, effort: 'medium', deadlineMs: 2000,
      normalize: s => ({ ...s, id: 'stamped' }), accept: () => [], fallback: () => ({ id: 'fixture' })
    });
    assert.equal(r.source, 'live');
    assert.equal(r.data.id, 'stamped');
    assert.equal(rows[0].prompt_version, 'scenario@1');
    assert.equal(stub.log[0].effort, 'medium');
    assert.equal(stub.log[0].user, scenarioPrompt.PROMPT.render(SCENARIO_INPUT));
  });
});

describe('x-prompt-id header', () => {
  let server, url;
  const seen = [];
  before(async () => {
    // Minimal capture server: fake Claude routes on this header only after T09.
    server = http.createServer(async (req, res) => {
      let raw = '';
      for await (const c of req) raw += c;
      const body = JSON.parse(raw);
      seen.push({ header: req.headers['x-prompt-id'], schemaSha: createHash('sha256').update(JSON.stringify(body.output_config.format.schema)).digest('hex') });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(message({ content: [{ type: 'text', text: '{"ok":true}' }] })));
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    url = `http://127.0.0.1:${server.address().port}`;
  });
  after(() => new Promise(r => { server.closeAllConnections(); server.close(r); }));

  test('every request carries x-prompt-id grade@1 or scenario@1', async t => {
    captureConsole(t);
    const gw = createGateway({ client: new Anthropic({ apiKey: 'sk-fake', baseURL: url }), logCall: () => {} });
    const g = await gw.run({ prompt: gradePrompt, input: GRADE_INPUT, live: true, deadlineMs: 1500, fallback: () => null });
    const s = await gw.run({ prompt: scenarioPrompt, input: SCENARIO_INPUT, live: true, deadlineMs: 1500, fallback: () => null });
    assert.equal(g.source, 'live');
    assert.equal(s.source, 'live');
    assert.deepEqual(seen.map(x => x.header), ['grade@1', 'scenario@1']);
  });
});
