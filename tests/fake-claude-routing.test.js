// F1a-T09: fake Claude routes on the gateway's x-prompt-id header, not on the schema
// (FR-040, US5 scenario 5, SC-007 unrouted half). Also F1a-B05, B07, B08 and B09.

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as fake from './helpers/fake-claude.mjs';

const { startFakeClaude, happyScenario, happyGrade } = fake;
// Called through the namespace so a missing export fails one test, not the whole file.
const assertNoUnroutedCalls = stub => fake.assertNoUnroutedCalls(stub);

const FAKE = fileURLToPath(new URL('./helpers/fake-claude.mjs', import.meta.url));
const sha = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');
// Each schema names the *other* kind's field, so schema sniffing would misroute both.
const SCHEMA_WITHOUT_VERDICT = { type: 'object', properties: { steps: { type: 'array' } } };
const SCHEMA_WITH_VERDICT = { type: 'object', properties: { verdict: { type: 'string' } } };

function call(stub, { promptId, body = {} } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (promptId !== undefined) headers['x-prompt-id'] = promptId;
  return fetch(`${stub.url}/v1/messages`, {
    method: 'POST', headers,
    body: JSON.stringify({ model: 'claude-opus-5-5', max_tokens: 100, messages: [{ role: 'user', content: 'hi' }], ...body })
  });
}
const withSchema = schema => ({ output_config: { format: { type: 'json_schema', schema } } });
const textOf = async res => JSON.parse((await res.json()).content.find(b => b.type === 'text').text);

describe('fake Claude routing on x-prompt-id', () => {
  let stub;
  before(async () => { stub = await startFakeClaude(); });
  after(async () => { await stub.close(); });

  test('grade call is logged with kind grade and promptId grade@1', async () => {
    stub.reset();
    const res = await call(stub, { promptId: 'grade@1', body: withSchema(SCHEMA_WITHOUT_VERDICT) });
    assert.equal(res.status, 200);
    assert.deepEqual(await textOf(res), happyGrade());
    assert.equal(stub.log.length, 1);
    assert.equal(stub.log[0].kind, 'grade');
    assert.equal(stub.log[0].promptId, 'grade@1');
  });

  test('scenario call is logged with kind scenario', async () => {
    stub.reset();
    const res = await call(stub, { promptId: 'scenario@1', body: withSchema(SCHEMA_WITH_VERDICT) });
    assert.equal(res.status, 200);
    assert.deepEqual(await textOf(res), happyScenario());
    assert.equal(stub.log[0].kind, 'scenario');
    assert.equal(stub.log[0].promptId, 'scenario@1');
  });

  test('request without x-prompt-id gets 500 and is logged', async () => {
    stub.reset();
    const res = await call(stub, { body: withSchema(SCHEMA_WITH_VERDICT) });
    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), { type: 'error', error: { type: 'api_error', message: 'stub: missing x-prompt-id' } });
    assert.equal(stub.log.length, 1);
    assert.equal(stub.log[0].kind, null);
    assert.equal(stub.log[0].path, '/v1/messages');
  });

  test('log entries carry system and schemaSha256', async () => {
    stub.reset();
    await call(stub, { promptId: 'grade@1', body: { system: 'plain system', ...withSchema(SCHEMA_WITH_VERDICT) } });
    await call(stub, {
      promptId: 'scenario@1',
      body: { system: [{ type: 'text', text: 'block one' }, { type: 'text', text: 'block two', cache_control: { type: 'ephemeral' } }], ...withSchema(SCHEMA_WITHOUT_VERDICT) }
    });
    await call(stub, { promptId: 'grade@1', body: { system: 'no schema here' } });
    const [plain, blocks, none] = stub.log;
    assert.equal(plain.system, 'plain system');
    assert.equal(plain.schemaSha256, sha(SCHEMA_WITH_VERDICT));
    assert.equal(blocks.system, 'block one\nblock two');
    assert.equal(blocks.schemaSha256, sha(SCHEMA_WITHOUT_VERDICT));
    assert.equal(none.system, 'no schema here');
    assert.equal(none.schemaSha256, null);
  });

  test('assertNoUnroutedCalls rejects with an AssertionError on a kind:null entry and resolves on a clean log', async () => {
    stub.reset();
    await call(stub, { promptId: 'grade@1' });
    const clean = assertNoUnroutedCalls(stub);
    assert.ok(clean instanceof Promise, 'returns a promise');
    assert.equal(await clean, undefined);

    await call(stub); // unrouted
    await call(stub, { promptId: 'scenario@1' });
    let pending;
    assert.doesNotThrow(() => { pending = assertNoUnroutedCalls(stub); }, 'never throws synchronously');
    await assert.rejects(pending, err => {
      assert.ok(err instanceof assert.AssertionError, `AssertionError, got ${err?.constructor?.name}`);
      assert.match(err.message, /\/v1\/messages/);
      assert.match(err.message, /promptId[^\n]*null/);
      assert.doesNotMatch(err.message, /scenario@1/, 'routed entries are not listed');
      return true;
    });
  });
});

test('importing fake-claude.mjs from node -e does not throw', () => {
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(FAKE)})`], { encoding: 'utf8', timeout: 10_000 });
  assert.equal(r.status, 0, r.stderr);
});

test("the fake's generated card reads no file outside tests/", () => {
  const src = readFileSync(FAKE, 'utf8');
  for (const dir of ['fixtures/', 'packs/', 'server/', 'shared/']) {
    assert.ok(!src.includes(dir), `fake-claude.mjs mentions ${dir}`);
  }
  // Frozen values: today's pack card with the live stamping, a fresh copy on each call.
  const pack = JSON.parse(readFileSync(new URL('../packs/demo-trades/scenarios/electrical.json', import.meta.url), 'utf8'));
  const a = happyScenario();
  assert.deepEqual(a, { ...pack, id: 'live-' + pack.id, title: '[LIVE STUB] ' + pack.title });
  a.steps[0].line = 'mutated';
  assert.notEqual(happyScenario().steps[0].line, 'mutated');
});
