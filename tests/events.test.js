// F1a-T06: shared/events.js (ADR 0002 + Amendments 1, 2). Pure module, no DB.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VERBS, OUTCOMES, newId, makeEvent, validateEvent } from '../shared/events.js';

const valid = (over = {}) => ({
  id: 'evt_01J0000000000000000000000A', at: '2026-10-10T07:42:11.204Z', actor: 'learner_1',
  verb: 'started', object: { type: 'card', id: 'fx_demo-trades_1_electrical' }, result: { source: 'fixture' },
  context: { subject: 'demo-trades@1', attemptId: 'att_01J0000000000000000000000A', promptVersions: {} },
  ...over
});

test('VERBS is the full data-and-evidence §1 vocabulary plus the practice verbs, and OUTCOMES its six outcomes', () => {
  assert.deepEqual([...VERBS].sort(), [
    'planned', 'started', 'step-shown', 'resumed', 'abandoned', 'completed',
    'stopped', 'explained', 'graded', 'chose',
    'flagged', 'rated-fairness', 'probe-answered',
    'mode-assigned', 'mode-switched', 'mode-fallback', 'voice-command', 'stt-corrected',
    'subject-built', 'subject-edited', 'map-change-accepted',
    'self-rated', 'assisted', 'clarified' // ADR 0002 Amendment 3 (F1c-T04)
  ].sort());
  assert.deepEqual([...OUTCOMES].sort(), ['caught', 'caught_late', 'clean_pass', 'false_alarm', 'missed', 'wrong_reason']);
});

test('newId matches ^<prefix>_[0-9A-HJKMNP-TV-Z]{26}$ for evt, att, card, llm', () => {
  for (const prefix of ['evt', 'att', 'card', 'llm']) {
    assert.match(newId(prefix), new RegExp(`^${prefix}_[0-9A-HJKMNP-TV-Z]{26}$`));
  }
});

test('1000 ids are unique and the 10-char time prefix never decreases', () => {
  const ids = Array.from({ length: 1000 }, () => newId('evt').slice(4));
  assert.equal(new Set(ids).size, 1000);
  for (let i = 1; i < ids.length; i++) {
    assert.ok(ids[i].slice(0, 10) >= ids[i - 1].slice(0, 10), `time prefix decreased at ${i}`);
  }
});

test('newId encodes the current time in its 10-char prefix', () => {
  const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const before = Date.now();
  const t = [...newId('evt').slice(4, 14)].reduce((n, c) => n * 32 + ALPHABET.indexOf(c), 0);
  assert.ok(t >= before && t <= Date.now(), `decoded ${t}`);
});

test('makeEvent fills id, at, actor', () => {
  const e = makeEvent({ verb: 'started', object: { type: 'card', id: 'c1' }, context: valid().context });
  assert.match(e.id, /^evt_[0-9A-HJKMNP-TV-Z]{26}$/);
  assert.ok(!Number.isNaN(Date.parse(e.at)) && e.at === new Date(e.at).toISOString());
  assert.equal(e.actor, 'learner_1');
  assert.equal(e.result, null);
  assert.deepEqual(validateEvent(e), []);
  const given = makeEvent({ verb: 'graded', object: { type: 'card', id: 'c1', step: 3 }, result: { outcome: 'caught' },
    context: valid().context, actor: 'learner_2', at: '2026-01-01T00:00:00.000Z' });
  assert.equal(given.actor, 'learner_2');
  assert.equal(given.at, '2026-01-01T00:00:00.000Z');
  assert.deepEqual(given.result, { outcome: 'caught' });
});

test('validateEvent accepts every VERBS verb', () => {
  for (const verb of VERBS) assert.deepEqual(validateEvent(valid({ verb })), [], verb);
});

test('validateEvent rejects unknown verb, missing attemptId, missing subject', () => {
  assert.ok(validateEvent(valid({ verb: 'hacked' })).length > 0);
  const { attemptId, ...noAttempt } = valid().context;
  assert.ok(validateEvent(valid({ context: noAttempt })).length > 0);
  const { subject, ...noSubject } = valid().context;
  assert.ok(validateEvent(valid({ context: noSubject })).length > 0);
  // the other checked fields (ticket Interfaces)
  for (const bad of [{ id: '' }, { at: 'not a date' }, { actor: '' }, { object: { id: 'c1' } }, { object: { type: 'card' } },
    { context: { subject: 'demo-trades@1', attemptId: 'att_x' } }, { context: { ...valid().context, promptVersions: null } },
    { context: { ...valid().context, promptVersions: [] } }, { result: 'x' }]) {
    assert.ok(validateEvent(valid(bad)).length > 0, JSON.stringify(bad));
  }
});

test("validateEvent never throws on null, [], 'x' and a cyclic object", () => {
  const cyclic = valid();
  cyclic.self = cyclic;
  cyclic.context.loop = cyclic.context;
  const hostile = new Proxy({}, { get() { throw new Error('boom'); }, has() { throw new Error('boom'); } });
  for (const input of [null, undefined, [], 'x', 42, cyclic, hostile, { object: hostile, context: hostile }]) {
    const problems = validateEvent(input);
    assert.ok(Array.isArray(problems));
  }
  assert.ok(validateEvent(null).length > 0);
  assert.ok(validateEvent([]).length > 0);
  assert.ok(validateEvent('x').length > 0);
});
