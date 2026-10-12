// F1a acceptance tests, HTTP level (F1a-T01a). Written from docs/specs/F1a-server-owned-cards/spec.md,
// ADR 0002/0003/0005 and their amendments, and thread 0004, not from the code.
//
// Each test is named "<US#>.<scenario#> <title>" or "edge: <title>" and, until the ticket that
// implements it merges, is declared with the todo option set to that ticket's ID (with suffix).
// QA removes a ticket's todo markers when it verifies that ticket. The scenario -> ticket table
// is a grep of the todo reasons in this file (thread 0004); there is no second list to keep in sync.
// tests/acceptance/todo-guardrail.test.js fails on any todo reason that isn't an F1a ticket ID.
//
// LIVE tests run against tests/helpers/fake-claude.mjs with GRADE_DEADLINE_MS=1500 and
// SCENARIO_DEADLINE_MS=2000. Every server gets its own temp-file DB_PATH, read back read-only.

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { startFakeClaude, happyScenario, happyGrade } from '../helpers/fake-claude.mjs';
import { rawRequest } from '../helpers/http.mjs';
import { scoreStop } from '../../shared/scoring.js';
import {
  leakScan, SUBJECT, ATTEMPT_ID_RE, CARD_ID_LIVE_RE, SCENARIOS, CARDS, GOOD,
  PUBLIC_CARD_KEYS, STOP_KEYS, CAUGHT_KEYS, COMPLETE_KEYS, MISSED_KEYS,
  tempDbPath, startApp, get, post, startAttempt, postStop, postComplete, begin, stopOk, completeOk,
  waitUntil, allEvents, eventsFor, bare, llmCalls, cardRow, cardRows, triplets, assertLlmRow,
  assertNoUnroutedCalls, fallbackContent
} from './helpers.mjs';

const ELECTRICAL_CARD_ID = 'fx_demo-trades_1_electrical';
const FALSE_ALARM_FEEDBACK = 'That step was actually fine. Stopping the job costs time, so save the STOP for real hazards.';
const CLEAN_RUN = 'Clean job. Nobody got hurt.';
const PACK_JSON = new URL('../../packs/demo-trades/pack.json', import.meta.url);
const readPack = () => JSON.parse(readFileSync(PACK_JSON, 'utf8'));
const sortedKeys = o => Object.keys(o).sort();
const verbs = events => events.map(e => e.verb);
const TRIPLET = ['stopped', 'explained', 'graded'];

// ---------------------------------------------------------------------------
// leakScan (pure; these run green from day one)
// ---------------------------------------------------------------------------

describe('leakScan', () => {
  test("leakScan: {error:'unknown subject'} is clean, {error:{why:'x'}} is flagged", () => {
    assert.deepEqual(leakScan({ error: 'unknown subject' }, { kind: 'other' }), []);
    const hits = leakScan({ error: { why: 'x' } }, { kind: 'other' });
    assert.ok(hits.includes('$.error'), `non-string error is flagged: ${hits}`);
    assert.ok(hits.includes('$.error.why'), `why inside it is flagged: ${hits}`);
  });

  test('leakScan: every answer key is flagged at any depth with its JSON path', () => {
    const card = { steps: [{ id: 1, line: 'x' }, { id: 2, line: 'y', error: { severity: 'major', summary: 's', why: 'w', correctAction: 'c', consequence: 'q', keywords: ['k'] } }] };
    assert.deepEqual(leakScan({ card }, { kind: 'other' }).sort(), [
      '$.card.steps[1].error',
      '$.card.steps[1].error.consequence', '$.card.steps[1].error.correctAction', '$.card.steps[1].error.keywords',
      '$.card.steps[1].error.severity', '$.card.steps[1].error.summary', '$.card.steps[1].error.why'
    ]);
  });

  test('leakScan: a public card and a list of scenarios are clean', () => {
    assert.deepEqual(leakScan({ attemptId: 'att_x', card: { id: 'c', subject: 's', title: 't', setting: 'x', apprentice: 'a', steps: [{ id: 1, line: 'l' }] }, source: 'fixture' }), []);
    assert.deepEqual(leakScan(SCENARIOS), []);
  });

  test("leakScan: kind 'stop' allows only caught.severity and caught.correctAction", () => {
    const body = { verdict: 'correct', caught: { errorStepId: 3, stepsLate: 0, severity: 'critical', correctAction: 'c' } };
    assert.deepEqual(leakScan(body, { kind: 'stop' }), []);
    assert.deepEqual(leakScan(body, { kind: 'other' }).sort(), ['$.caught.correctAction', '$.caught.severity']);
    assert.deepEqual(leakScan({ ...body, caught: { ...body.caught, why: 'w', summary: 's' } }, { kind: 'stop' }).sort(), ['$.caught.summary', '$.caught.why']);
    assert.deepEqual(leakScan({ severity: 'major', other: { caught: { severity: 'x' } } }, { kind: 'stop' }).sort(), ['$.other.caught.severity', '$.severity']);
  });

  test("leakScan: kind 'complete' allows anything under missed[] only", () => {
    const missed = [{ stepId: 3, severity: 'critical', summary: 's', consequence: 'q', correctAction: 'c', points: -300, why: 'w' }];
    assert.deepEqual(leakScan({ total: 1, missed }, { kind: 'complete' }), []);
    assert.deepEqual(leakScan({ total: 1, missed }, { kind: 'stop' }).length, 5);
    assert.deepEqual(leakScan({ missed: [], extra: { why: 'w' } }, { kind: 'complete' }), ['$.extra.why']);
  });

  test('leakScan: never throws; a cycle is reported as <cycle>; scalars are clean', () => {
    const a = { x: 1 };
    a.self = a;
    assert.deepEqual(leakScan(a), ['<cycle>']);
    for (const v of [null, undefined, 0, 'why', true, [], {}]) assert.deepEqual(leakScan(v), []);
    const shared = { ok: 1 };
    assert.deepEqual(leakScan({ a: shared, b: shared }), [], 'a shared (non-cyclic) reference is not a cycle');
    const hostile = { get why() { throw new Error('boom'); } };
    assert.doesNotThrow(() => leakScan(hostile));
  });
});

// ---------------------------------------------------------------------------
// MOCK server (keyword grader, fixture cards). A fake Claude is started too, only to prove
// MOCK never calls it (US5.3).
// ---------------------------------------------------------------------------

describe('MOCK server', () => {
  let app, stub, tmp;
  before(async () => {
    stub = await startFakeClaude();
    tmp = tempDbPath();
    app = await startApp({ stub, dbPath: tmp.dbPath });
  });
  after(async () => {
    await app?.stop();
    try {
      await assertNoUnroutedCalls(stub);
    } finally {
      await stub?.close();
      tmp?.cleanup();
    }
  });
  const url = () => app.url;
  const db = () => tmp.dbPath;

  // --- US1 (API parts), FR-001..FR-005 ---

  test('edge: /api/health body is unchanged (mode, lastLiveOkAt, lastLiveError)', async () => {
    const r = await get(url(), '/api/health');
    assert.equal(r.status, 200);
    assert.deepEqual(sortedKeys(r.json), ['lastLiveError', 'lastLiveOkAt', 'mode']);
    assert.equal(r.json.mode, 'mock');
  });

  test("US1.11 GET /api/subjects returns [{id:'demo-trades', title}]", { todo: 'F1a-T12' }, async () => {
    const r = await get(url(), '/api/subjects');
    assert.equal(r.status, 200);
    assert.equal(r.json.length, 1);
    assert.deepEqual(sortedKeys(r.json[0]), ['id', 'title']);
    assert.equal(r.json[0].id, SUBJECT);
    assert.ok(typeof r.json[0].title === 'string' && r.json[0].title.length > 0);
    assert.deepEqual(leakScan(r.json), []);
  });

  test('edge: GET /api/scenarios?subject=demo-trades returns the frozen list in order', { todo: 'F1a-T12' }, async () => {
    const r = await get(url(), `/api/scenarios?subject=${SUBJECT}`);
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, SCENARIOS);
  });

  test('US1.1 start returns exactly the public card (fx id, subject demo-trades) and nothing leaks before the STOP', { todo: 'F1a-T12' }, async () => {
    const subjects = await get(url(), '/api/subjects');
    const list = await get(url(), `/api/scenarios?subject=${SUBJECT}`);
    assert.deepEqual(leakScan(subjects.json), []);
    assert.deepEqual(leakScan(list.json), []);
    for (const { id } of SCENARIOS) {
      const r = await startAttempt(url(), { subject: SUBJECT, scenario: id });
      assert.equal(r.status, 200, `${id}: ${r.text}`);
      assert.deepEqual(sortedKeys(r.json), ['attemptId', 'card', 'source']);
      assert.match(r.json.attemptId, ATTEMPT_ID_RE);
      assert.equal(r.json.source, 'fixture');
      assert.deepEqual(sortedKeys(r.json.card), PUBLIC_CARD_KEYS);
      assert.equal(r.json.card.id, `fx_${SUBJECT}_1_${id}`);
      assert.equal(r.json.card.subject, SUBJECT);
      assert.equal(r.json.card.steps.length, CARDS[id].lastStepId);
      for (const step of r.json.card.steps) assert.deepEqual(sortedKeys(step), ['id', 'line']);
      assert.deepEqual(leakScan(r.json, { kind: 'other' }), [], id);
    }
  });

  test('US1.1 STOP on the critical line with a correct explanation: Good catch, +270, total 270, caught line 3', { todo: 'F1a-T13b' }, async () => {
    const { attemptId } = await begin(url());
    const r = await stopOk(url(), attemptId, 3, GOOD[3]);
    assert.deepEqual(sortedKeys(r), STOP_KEYS);
    assert.equal(r.verdict, 'correct');
    assert.equal(r.points, 270);
    assert.equal(r.total, 270);
    assert.equal(r.source, 'mock');
    assert.deepEqual(sortedKeys(r.caught), CAUGHT_KEYS);
    assert.equal(r.caught.errorStepId, 3);
    assert.equal(r.caught.stepsLate, 0);
    assert.equal(r.caught.severity, 'critical');
    assert.ok(typeof r.caught.correctAction === 'string' && r.caught.correctAction.length > 0);
    assert.deepEqual(leakScan(r, { kind: 'stop' }), []);
  });

  test('US1.3 STOP on a clean line: False alarm, -75, caught null, nothing about any other step', { todo: 'F1a-T13b' }, async () => {
    const { attemptId } = await begin(url());
    const r = await stopOk(url(), attemptId, 1, 'he should lock it out');
    assert.deepEqual(sortedKeys(r), STOP_KEYS);
    assert.equal(r.verdict, 'false_alarm');
    assert.equal(r.points, -75);
    assert.equal(r.total, -75);
    assert.equal(r.caught, null);
    assert.deepEqual(leakScan(r, { kind: 'stop' }), []);
  });

  test('US1.5 STOP one line after the critical mistake credits line 3 with stepsLate 1 and scoreStop points', { todo: 'F1a-T13b' }, async () => {
    const { attemptId } = await begin(url());
    const r = await stopOk(url(), attemptId, 4, GOOD[3]);
    assert.equal(r.caught?.errorStepId, 3);
    assert.equal(r.caught.stepsLate, 1);
    assert.equal(r.caught.severity, 'critical');
    assert.notEqual(r.verdict, 'false_alarm');
    assert.equal(r.points, scoreStop({ severity: 'critical', stepsLate: 1, verdict: r.verdict, reasoningScore: r.reasoningScore }));
    assert.equal(r.total, r.points);
  });

  test('US1.7 never-stop run: Someone got hurt, total -400 of 600, three missed items with summary, consequence and fix', { todo: 'F1a-T14' }, async () => {
    const { attemptId } = await begin(url());
    const r = await postComplete(url(), attemptId, { lastStepShown: 10 });
    assert.equal(r.status, 200, r.text);
    const c = r.json;
    assert.deepEqual(sortedKeys(c), COMPLETE_KEYS);
    assert.equal(c.ratingKey, 'missedCritical');
    assert.equal(c.ratingLabel, 'Someone got hurt');
    assert.equal(c.total, -400);
    assert.equal(c.maxPossible, 600);
    assert.equal(c.caughtCount, 0);
    assert.equal(c.mistakeCount, 3);
    assert.equal(c.falseAlarms, 0);
    assert.equal(c.missedCritical, true);
    assert.deepEqual(c.skippedStepIds, []);
    assert.deepEqual(c.missed.map(m => [m.stepId, m.severity, m.points]), [[3, 'critical', -300], [5, 'major', -75], [7, 'minor', -25]]);
    for (const m of c.missed) {
      assert.deepEqual(sortedKeys(m), MISSED_KEYS, 'ordinary items have exactly six keys');
      for (const k of ['summary', 'consequence', 'correctAction']) assert.ok(typeof m[k] === 'string' && m[k].length > 0, k);
    }
    assert.deepEqual(leakScan(c, { kind: 'complete' }), []);
    assert.ok(!/"(why|keywords)"/.test(r.text), 'complete never sends why or keywords');
  });

  test('US1.9 perfect run: Journeyman eyes and the clean-run line', { todo: 'F1a-T14' }, async () => {
    const { attemptId } = await begin(url());
    for (const id of [3, 5, 7]) assert.equal((await stopOk(url(), attemptId, id, GOOD[id])).verdict, 'correct');
    const c = await completeOk(url(), attemptId, { lastStepShown: 10, skippedStepIds: [] });
    assert.equal(c.ratingKey, 'tier0');
    assert.equal(c.ratingLabel, 'Journeyman eyes');
    assert.equal(c.cleanRunLine, CLEAN_RUN);
    assert.equal(c.total, 540);
    assert.equal(c.maxPossible, 600);
    assert.equal(c.caughtCount, 3);
    assert.equal(c.falseAlarms, 0);
    assert.equal(c.missedCritical, false);
    assert.deepEqual(c.missed, []);
  });

  test('edge: two starts on the same card get different attemptIds', { todo: 'F1a-T12' }, async () => {
    const a = await begin(url());
    const b = await begin(url());
    assert.match(a.attemptId, ATTEMPT_ID_RE);
    assert.match(b.attemptId, ATTEMPT_ID_RE);
    assert.notEqual(a.attemptId, b.attemptId);
  });

  test('edge: two attempts on the same card do not share caught state', { todo: 'F1a-T13b' }, async () => {
    const a = await begin(url());
    const b = await begin(url());
    assert.equal((await stopOk(url(), a.attemptId, 3, GOOD[3])).caught?.errorStepId, 3);
    const rb = await stopOk(url(), b.attemptId, 3, GOOD[3]);
    assert.equal(rb.caught?.errorStepId, 3);
    assert.equal(rb.total, rb.points);
  });

  // --- US6 (API parts): subject words come from the pack ---

  test("US6.1 never-stop label is the pack's ratings.missedCritical", { todo: 'F1a-T14' }, async () => {
    const { attemptId } = await begin(url());
    const c = await completeOk(url(), attemptId, { lastStepShown: 10 });
    assert.equal(c.ratingLabel, readPack().ratings.missedCritical);
    assert.equal(c.ratingLabel, 'Someone got hurt');
  });

  test("US6.3 perfect-run cleanRunLine is the pack's copy.cleanRun", { todo: 'F1a-T14' }, async () => {
    const { attemptId } = await begin(url());
    for (const id of [3, 5, 7]) await stopOk(url(), attemptId, id, GOOD[id]);
    const c = await completeOk(url(), attemptId, { lastStepShown: 10 });
    assert.equal(c.cleanRunLine, readPack().copy.cleanRun);
    assert.equal(c.cleanRunLine, CLEAN_RUN);
  });

  test("US6.4 MOCK false-alarm feedback is the pack's copy.falseAlarmFeedback", { todo: 'F1a-T13b' }, async () => {
    const { attemptId } = await begin(url());
    const r = await stopOk(url(), attemptId, 1, 'he should lock it out');
    assert.equal(r.feedback, readPack().copy.falseAlarmFeedback);
    assert.equal(r.feedback, FALSE_ALARM_FEEDBACK);
  });

  test("US6.5 'it could still have juice' on line 3 gets today's verdict (partial, 0.4) through the pack's synonyms", { todo: 'F1a-T13b' }, async () => {
    const { attemptId } = await begin(url());
    const r = await stopOk(url(), attemptId, 3, 'it could still have juice');
    assert.equal(r.verdict, 'partial');
    assert.equal(r.reasoningScore, 0.4);
  });

  // --- US2 (API parts): the Skip consequence (Option B) ---

  test('US2.5 skip on the critical line (API): not graded, total -100 of 300, tier3, skippedStepIds [3]', { todo: 'F1a-T14' }, async () => {
    const { attemptId } = await begin(url());
    const c = await completeOk(url(), attemptId, { lastStepShown: 10, skippedStepIds: [3] });
    assert.equal(c.total, -100);
    assert.equal(c.maxPossible, 300);
    assert.equal(c.caughtCount, 0);
    assert.equal(c.mistakeCount, 3);
    assert.equal(c.falseAlarms, 0);
    assert.equal(c.missedCritical, false);
    assert.equal(c.ratingKey, 'tier3');
    assert.equal(c.ratingLabel, 'Back to the classroom');
    assert.deepEqual(c.skippedStepIds, [3]);
    assert.deepEqual(c.missed.map(m => [m.stepId, m.severity, m.points, m.notGraded]), [[3, 'critical', 0, true], [5, 'major', -75, undefined], [7, 'minor', -25, undefined]]);
    assert.deepEqual(sortedKeys(c.missed[0]), [...MISSED_KEYS, 'notGraded'].sort());
    for (const k of ['summary', 'consequence', 'correctAction']) assert.ok(c.missed[0][k].length > 0, `not-graded item still reveals ${k}`);
    assert.deepEqual(sortedKeys(c.missed[1]), MISSED_KEYS);
    assert.deepEqual(sortedKeys(c.missed[2]), MISSED_KEYS);
  });

  test('US2.7 skip on a clean line (API): no false-alarm penalty, nothing not graded, Journeyman eyes', { todo: 'F1a-T14' }, async () => {
    const { attemptId } = await begin(url());
    for (const id of [3, 5, 7]) await stopOk(url(), attemptId, id, GOOD[id]);
    const c = await completeOk(url(), attemptId, { lastStepShown: 10, skippedStepIds: [1] });
    assert.equal(c.total, 540);
    assert.equal(c.falseAlarms, 0);
    assert.equal(c.ratingKey, 'tier0');
    assert.equal(c.ratingLabel, 'Journeyman eyes');
    assert.deepEqual(c.missed, []);
    assert.deepEqual(c.skippedStepIds, [1]);
  });

  test('US2.9 skip on the critical line, every later mistake caught (API): line 3 not graded, nothing truly missed', { todo: 'F1a-T14' }, async () => {
    const { attemptId } = await begin(url());
    for (const id of [5, 7]) await stopOk(url(), attemptId, id, GOOD[id]);
    const c = await completeOk(url(), attemptId, { lastStepShown: 10, skippedStepIds: [3] });
    assert.deepEqual(c.missed.map(m => [m.stepId, m.notGraded, m.points]), [[3, true, 0]]);
    assert.equal(c.total, 270);
    assert.equal(c.maxPossible, 300);
    assert.equal(c.caughtCount, 2);
    assert.equal(c.missedCritical, false);
    assert.equal(c.ratingKey, 'tier0');
    assert.deepEqual(c.skippedStepIds, [3]);
  });

  test("US2.14 lost response then skip: the server's graded STOP stands", { todo: 'F1a-T14' }, async () => {
    const { attemptId } = await begin(url());
    await stopOk(url(), attemptId, 3, GOOD[3]); // the browser never saw this response
    const c = await completeOk(url(), attemptId, { lastStepShown: 10, skippedStepIds: [3] });
    assert.deepEqual(c.skippedStepIds, [], 'a graded id is dropped from the echo');
    assert.equal(c.caughtCount, 1);
    assert.equal(c.total, 270 - 75 - 25);
    assert.equal(c.maxPossible, 600);
    assert.deepEqual(c.missed.map(m => m.stepId), [5, 7]);
    assert.ok(c.missed.every(m => !('notGraded' in m)));
    const completed = eventsFor(db(), attemptId).find(e => e.verb === 'completed');
    assert.deepEqual(completed.result.skippedStepIds, []);
    assert.deepEqual(completed.result.notGradedStepIds, []);
  });

  // --- US4: append-only events ---

  test('US4.1 one attempt with two STOPs writes started, 2 x (stopped, explained, graded), step-shown, completed in seq order', { todo: 'F1a-T14' }, async () => {
    const { validateEvent } = await import('../../shared/events.js');
    const { attemptId } = await begin(url());
    await stopOk(url(), attemptId, 3, GOOD[3]);
    await stopOk(url(), attemptId, 5, GOOD[5]);
    await completeOk(url(), attemptId, { lastStepShown: 10 });
    const events = eventsFor(db(), attemptId);
    assert.deepEqual(verbs(events), ['started', ...TRIPLET, ...TRIPLET, 'step-shown', 'completed']);
    for (let i = 1; i < events.length; i++) assert.ok(events[i].seq > events[i - 1].seq, 'seq ascending');
    for (const e of events) {
      assert.deepEqual(validateEvent(bare(e)), [], `${e.verb} passes validateEvent`);
      assert.match(e.id, /^evt_[0-9A-HJKMNP-TV-Z]{26}$/);
      assert.equal(e.actor, 'learner_1');
      assert.equal(e.object.type, 'card');
      assert.equal(e.object.id, ELECTRICAL_CARD_ID);
      assert.deepEqual(e.context, { subject: 'demo-trades@1', attemptId, promptVersions: {} });
    }
    assert.deepEqual(events.slice(1, 7).map(e => e.object.step), [3, 3, 3, 5, 5, 5]);
    const [started, stopped, explained, graded] = events;
    assert.deepEqual(started.result, { source: 'fixture' });
    assert.deepEqual(stopped.result, { targetStepId: 3, stepsLate: 0 });
    assert.deepEqual(explained.result, { text: GOOD[3], chars: GOOD[3].length });
    assert.deepEqual(sortedKeys(graded.result), ['feedback', 'graderSource', 'latencyMs', 'outcome', 'points', 'reasoningScore', 'verdict']);
    assert.equal(graded.result.graderSource, 'mock');
    assert.equal(graded.result.outcome, 'caught');
    assert.equal(graded.result.points, 270);
    const stepShown = events.at(-2);
    assert.equal(stepShown.object.step, 10);
    assert.equal(stepShown.result, null);
    assert.deepEqual(sortedKeys(events.at(-1).result),
      ['caughtCount', 'falseAlarms', 'maxPossible', 'missedStepIds', 'mistakeCount', 'notGradedStepIds', 'ratingKey', 'skippedStepIds', 'total']);
  });

  test("US4.4 projectAttempt rebuilds the caught set, and the rebuilt complete equals the first for total, caughtCount and falseAlarms", { todo: 'F1a-T14' }, async () => {
    const { projectAttempt } = await import('../../shared/events.js');
    const { attemptId } = await begin(url());
    await stopOk(url(), attemptId, 1, 'he should lock it out');
    await stopOk(url(), attemptId, 3, GOOD[3]);
    const first = await completeOk(url(), attemptId, { lastStepShown: 10 });
    const p = projectAttempt(eventsFor(db(), attemptId).map(bare));
    assert.deepEqual(p.caughtStepIds, [3]);
    assert.equal(p.cardId, ELECTRICAL_CARD_ID);
    assert.equal(p.lastStopStepId, 3);
    assert.equal(p.completed?.verb, 'completed');
    const again = await completeOk(url(), attemptId, { lastStepShown: 10 });
    assert.equal(again.total, first.total);
    assert.equal(again.caughtCount, first.caughtCount);
    assert.equal(again.falseAlarms, 1);
    assert.equal(first.falseAlarms, 1);
    const stored = p.completed.result;
    assert.equal(stored.total, first.total);
    assert.equal(stored.caughtCount, first.caughtCount);
    assert.equal(stored.falseAlarms, first.falseAlarms);
  });

  test('US4.6 completed.result.skippedStepIds and notGradedStepIds', { todo: 'F1a-T14' }, async () => {
    const { attemptId } = await begin(url());
    const first = await completeOk(url(), attemptId, { lastStepShown: 10, skippedStepIds: [3] });
    const completed = eventsFor(db(), attemptId).find(e => e.verb === 'completed');
    assert.deepEqual(completed.result.skippedStepIds, [3]);
    assert.deepEqual(completed.result.notGradedStepIds, [3]);
    assert.deepEqual(completed.result.missedStepIds, [5, 7]);
    const second = await completeOk(url(), attemptId, { lastStepShown: 10, skippedStepIds: [3] });
    assert.deepEqual(second, first);
  });

  // --- US5 (MOCK part) ---

  test('US5.3 MOCK start without source and one STOP write two llm_call rows outcome mock, and fake Claude receives nothing', { todo: 'F1a-T13b' }, async () => {
    const before = llmCalls(db()).length;
    const { attemptId } = await begin(url());
    await stopOk(url(), attemptId, 3, GOOD[3]);
    const rows = llmCalls(db()).slice(before);
    assert.equal(rows.length, 2);
    assertLlmRow(rows.find(r => r.pipeline === 'scenario'), { pipeline: 'scenario', outcome: 'mock' });
    assertLlmRow(rows.find(r => r.pipeline === 'grade'), { pipeline: 'grade', outcome: 'mock' });
    assert.equal(stub.log.length, 0, 'MOCK never calls the model');
  });

  // --- STOP edge cases ---

  test('edge: same STOP sent twice returns the identical body and writes no events', { todo: 'F1a-T13b' }, async () => {
    const { attemptId } = await begin(url());
    const a = await stopOk(url(), attemptId, 3, GOOD[3]);
    const n = eventsFor(db(), attemptId).length;
    const b = await stopOk(url(), attemptId, 3, GOOD[3]);
    assert.deepEqual(b, a);
    assert.equal(eventsFor(db(), attemptId).length, n);
    assert.deepEqual(triplets(eventsFor(db(), attemptId)), { 3: TRIPLET });
  });

  test("edge: an edited answer re-sent for a graded STOP is ignored; explained.result.text holds what was graded", { todo: 'F1a-T13b' }, async () => {
    const { attemptId } = await begin(url());
    const a = await stopOk(url(), attemptId, 3, 'it could still have juice');
    const b = await stopOk(url(), attemptId, 3, GOOD[3]);
    assert.deepEqual(b, a);
    assert.equal(b.verdict, 'partial');
    const explained = eventsFor(db(), attemptId).filter(e => e.verb === 'explained');
    assert.deepEqual(explained.map(e => e.result.text), ['it could still have juice']);
  });

  test('edge: an already-caught mistake is not credited twice (STOP on 3, then on 4)', { todo: 'F1a-T13b' }, async () => {
    const { attemptId } = await begin(url());
    await stopOk(url(), attemptId, 3, GOOD[3]);
    const r = await stopOk(url(), attemptId, 4, GOOD[3]);
    assert.equal(r.caught, null);
    assert.equal(r.verdict, 'false_alarm');
    assert.equal(r.points, -75);
    assert.equal(r.total, 270 - 75);
  });

  test('edge: STOP at a position before the last graded STOP gets 400 and writes nothing', { todo: 'F1a-T13b' }, async () => {
    const { attemptId } = await begin(url());
    await stopOk(url(), attemptId, 5, GOOD[5]);
    const n = eventsFor(db(), attemptId).length;
    for (const stepId of [3, 4]) {
      const r = await postStop(url(), attemptId, { stepId, explanation: GOOD[3] });
      assert.equal(r.status, 400, `stepId ${stepId}`);
      assert.equal(typeof r.json?.error, 'string');
    }
    assert.equal(eventsFor(db(), attemptId).length, n);
  });

  test('edge: stepId not in the card (0, negative, non-integer, string, null, missing) gets 400 and writes nothing', { todo: 'F1a-T13b' }, async () => {
    const { attemptId } = await begin(url());
    for (const body of [{ stepId: 0 }, { stepId: -1 }, { stepId: 99 }, { stepId: 1.5 }, { stepId: '3' }, { stepId: null }, {}]) {
      const r = await postStop(url(), attemptId, { ...body, explanation: GOOD[3] });
      assert.equal(r.status, 400, JSON.stringify(body));
      assert.equal(typeof r.json?.error, 'string');
    }
    assert.deepEqual(verbs(eventsFor(db(), attemptId)), ['started']);
  });

  test('edge: STOP on an unknown or malformed attemptId gets 404 {error}', { todo: 'F1a-T13b' }, async () => {
    const { attemptId } = await begin(url()); // control: the route exists for a real attempt
    assert.equal((await postStop(url(), attemptId, { stepId: 3, explanation: 'x' })).status, 200);
    for (const id of ['att_00000000000000000000000000', 'att_IIIIIIIIIIIIIIIIIIIIIIIIII', 'nope', '__proto__', 'constructor']) {
      const r = await postStop(url(), id, { stepId: 3, explanation: 'x' });
      assert.equal(r.status, 404, id);
      assert.equal(typeof r.json?.error, 'string');
    }
  });

  test('edge: empty explanation is graded as today (MOCK: wrong, reasoningScore 0)', { todo: 'F1a-T13b' }, async () => {
    const { attemptId } = await begin(url());
    const r = await stopOk(url(), attemptId, 3, '');
    assert.equal(r.verdict, 'wrong');
    assert.equal(r.reasoningScore, 0);
    assert.equal(r.caught?.errorStepId, 3);
  });

  test('edge: explanation over 2000 chars is stored truncated; a non-string is coerced', { todo: 'F1a-T13b' }, async () => {
    const a = await begin(url());
    const long = 'live '.repeat(500); // 2500 chars
    await stopOk(url(), a.attemptId, 3, long);
    const text = eventsFor(db(), a.attemptId).find(e => e.verb === 'explained').result.text;
    assert.equal(text, long.slice(0, 2000));
    const b = await begin(url());
    await stopOk(url(), b.attemptId, 3, 12345);
    assert.equal(eventsFor(db(), b.attemptId).find(e => e.verb === 'explained').result.text, '12345');
  });

  test('edge: bad STOP bodies get 400 or 413, never 500, and the server keeps serving', { todo: 'F1a-T13b' }, async () => {
    const { attemptId } = await begin(url());
    for (const body of ['{bad', 'null', '[]', '"x"', { stepId: 'abc', explanation: 'x' }]) {
      assert.equal((await postStop(url(), attemptId, body)).status, 400, JSON.stringify(body));
    }
    const big = JSON.stringify({ stepId: 3, explanation: 'x'.repeat(1_100_000) });
    assert.equal((await postStop(url(), attemptId, big)).status, 413);
    assert.deepEqual(verbs(eventsFor(db(), attemptId)), ['started']);
    assert.equal((await get(url(), '/api/health')).status, 200);
    assert.ok(app.alive());
  });

  test('edge: appendEvents failing (DB write-locked by another connection) answers 500 server error, writes no triplet, and the next STOP works', { todo: 'F1a-T13b' }, async () => {
    const { attemptId } = await begin(url());
    const locker = new DatabaseSync(db());
    let r;
    locker.exec('BEGIN IMMEDIATE'); // holds the write lock; the server's busy_timeout runs out
    try {
      r = await postStop(url(), attemptId, { stepId: 3, explanation: GOOD[3] });
    } finally {
      locker.exec('ROLLBACK');
      locker.close();
    }
    assert.equal(r.status, 500);
    assert.deepEqual(r.json, { error: 'server error' });
    assert.deepEqual(verbs(eventsFor(db(), attemptId)), ['started']);
    assert.equal((await stopOk(url(), attemptId, 3, GOOD[3])).caught?.errorStepId, 3);
    assert.deepEqual(triplets(eventsFor(db(), attemptId)), { 3: TRIPLET });
    assert.ok(app.alive());
  });

  // --- complete edge cases ---

  test('edge: complete on an unknown or malformed attemptId gets 404 {error}', { todo: 'F1a-T14' }, async () => {
    const { attemptId } = await begin(url()); // control: the route exists for a real attempt
    assert.equal((await postComplete(url(), attemptId, { lastStepShown: 10 })).status, 200);
    for (const id of ['att_00000000000000000000000000', 'att_IIIIIIIIIIIIIIIIIIIIIIIIII', 'nope', '__proto__']) {
      const r = await postComplete(url(), id, { lastStepShown: 10 });
      assert.equal(r.status, 404, id);
      assert.equal(typeof r.json?.error, 'string');
    }
  });

  test('edge: STOP after complete gets 409 and writes nothing (checked before the stepId)', { todo: 'F1a-T14' }, async () => {
    const { attemptId } = await begin(url());
    await completeOk(url(), attemptId, { lastStepShown: 10 });
    const n = eventsFor(db(), attemptId).length;
    for (const stepId of [3, 99]) {
      const r = await postStop(url(), attemptId, { stepId, explanation: GOOD[3] });
      assert.equal(r.status, 409, `stepId ${stepId}`);
      assert.equal(typeof r.json?.error, 'string');
    }
    assert.equal(eventsFor(db(), attemptId).length, n);
  });

  test('edge: complete called twice returns the identical body; one step-shown and one completed; repeat values ignored', { todo: 'F1a-T14' }, async () => {
    const { attemptId } = await begin(url());
    await stopOk(url(), attemptId, 3, GOOD[3]);
    const first = await completeOk(url(), attemptId, { lastStepShown: 10, skippedStepIds: [] });
    assert.deepEqual(await completeOk(url(), attemptId, { lastStepShown: 10, skippedStepIds: [5] }), first);
    assert.deepEqual(await completeOk(url(), attemptId, { lastStepShown: 6 }), first);
    const v = verbs(eventsFor(db(), attemptId));
    assert.equal(v.filter(x => x === 'step-shown').length, 1);
    assert.equal(v.filter(x => x === 'completed').length, 1);
  });

  test('edge: complete with lastStepShown not a step id, or before the last graded STOP, gets 400 and writes nothing', { todo: 'F1a-T14' }, async () => {
    const { attemptId } = await begin(url());
    await stopOk(url(), attemptId, 5, GOOD[5]);
    const n = eventsFor(db(), attemptId).length;
    for (const body of [{}, { lastStepShown: 0 }, { lastStepShown: 11 }, { lastStepShown: '10' }, { lastStepShown: 2.5 }, { lastStepShown: 4 }]) {
      const r = await postComplete(url(), attemptId, body);
      assert.equal(r.status, 400, JSON.stringify(body));
      assert.equal(typeof r.json?.error, 'string');
    }
    assert.equal(eventsFor(db(), attemptId).length, n);
    assert.equal((await postComplete(url(), attemptId, { lastStepShown: 5 })).status, 200, 'lastStepShown at the last STOP is allowed');
  });

  test('edge: skippedStepIds validation', { todo: 'F1a-T14' }, async () => {
    const { attemptId } = await begin(url());
    const bad = [
      { lastStepShown: 10, skippedStepIds: 'x' },
      { lastStepShown: 10, skippedStepIds: 3 },
      { lastStepShown: 10, skippedStepIds: [3.5] },
      { lastStepShown: 10, skippedStepIds: ['3'] },
      { lastStepShown: 10, skippedStepIds: [null] },
      { lastStepShown: 10, skippedStepIds: [99] },
      { lastStepShown: 10, skippedStepIds: [0] },
      { lastStepShown: 10, skippedStepIds: [3, 3] },
      { lastStepShown: 4, skippedStepIds: [5] }
    ];
    for (const body of bad) {
      const r = await postComplete(url(), attemptId, body);
      assert.equal(r.status, 400, JSON.stringify(body));
      assert.equal(typeof r.json?.error, 'string');
    }
    assert.deepEqual(verbs(eventsFor(db(), attemptId)), ['started'], 'nothing written by a rejected complete');
    const ok = await completeOk(url(), attemptId, { lastStepShown: 10 });
    assert.deepEqual(ok.skippedStepIds, [], 'missing is treated as []');
    assert.deepEqual(eventsFor(db(), attemptId).find(e => e.verb === 'completed').result.skippedStepIds, []);
  });

  test('edge: a skipped stop followed by a STOP that credits the same mistake late: caught, not not-graded', { todo: 'F1a-T14' }, async () => {
    const { attemptId } = await begin(url());
    assert.equal((await stopOk(url(), attemptId, 4, GOOD[3])).caught?.errorStepId, 3);
    const c = await completeOk(url(), attemptId, { lastStepShown: 10, skippedStepIds: [3] });
    assert.deepEqual(c.skippedStepIds, [3]);
    assert.equal(c.caughtCount, 1);
    assert.ok(!c.missed.some(m => m.stepId === 3));
    assert.deepEqual(eventsFor(db(), attemptId).find(e => e.verb === 'completed').result.notGradedStepIds, []);
  });

  test('edge: every mistake not graded: maxPossible 0, tier3, three not-graded items', { todo: 'F1a-T14' }, async () => {
    const { attemptId } = await begin(url());
    const c = await completeOk(url(), attemptId, { lastStepShown: 10, skippedStepIds: [3, 5, 7] });
    assert.equal(c.maxPossible, 0);
    assert.equal(c.total, 0);
    assert.equal(c.ratingKey, 'tier3');
    assert.equal(c.ratingLabel, 'Back to the classroom');
    assert.deepEqual(c.missed.map(m => [m.stepId, m.notGraded, m.points]), [[3, true, 0], [5, true, 0], [7, true, 0]]);
    assert.deepEqual(c.skippedStepIds, [3, 5, 7]);
  });

  test('edge: caught, missedStepIds and notGradedStepIds are disjoint and cover every mistake (3 cards x skip scripts)', { todo: 'F1a-T14' }, async () => {
    for (const [scenario, card] of Object.entries(CARDS)) {
      const mistakes = Object.keys(card.mistakes).map(Number);
      const crit = mistakes.find(id => card.mistakes[id] === 'critical');
      const scripts = {
        'skip-critical': { stops: [], skipped: [crit], notGraded: [crit] },
        'skip-clean': { stops: [], skipped: [card.firstCleanStepId], notGraded: [] },
        'skip-late': { stops: [], skipped: [crit + 1], notGraded: [crit] },
        'skip-all-mistakes': { stops: [], skipped: mistakes, notGraded: mistakes },
        'skip-then-late-stop': { stops: [crit + 1], skipped: [crit], notGraded: [] }
      };
      for (const [name, s] of Object.entries(scripts)) {
        const label = `${scenario} ${name}`;
        const { attemptId } = await begin(url(), scenario);
        for (const stepId of s.stops) await stopOk(url(), attemptId, stepId, 'he skipped the check, it is not safe');
        await completeOk(url(), attemptId, { lastStepShown: card.lastStepId, skippedStepIds: s.skipped });
        const events = eventsFor(db(), attemptId);
        const caught = events.filter(e => e.verb === 'stopped' && e.result.targetStepId !== null).map(e => e.result.targetStepId);
        const { missedStepIds, notGradedStepIds } = events.find(e => e.verb === 'completed').result;
        assert.deepEqual([...notGradedStepIds].sort(), [...s.notGraded].sort(), `${label}: notGradedStepIds`);
        const all = [...caught, ...missedStepIds, ...notGradedStepIds];
        assert.equal(new Set(all).size, all.length, `${label}: disjoint`);
        assert.deepEqual([...all].sort(), [...mistakes].sort(), `${label}: covers every mistake`);
      }
    }
  });

  test('edge: bad complete bodies get 400 or 413, never 500', { todo: 'F1a-T14' }, async () => {
    const { attemptId } = await begin(url());
    for (const body of ['{bad', 'null', '[]', '"x"']) {
      assert.equal((await postComplete(url(), attemptId, body)).status, 400, body);
    }
    assert.equal((await postComplete(url(), attemptId, JSON.stringify({ lastStepShown: 10, pad: 'x'.repeat(1_100_000) }))).status, 413);
    assert.deepEqual(verbs(eventsFor(db(), attemptId)), ['started']);
    assert.ok(app.alive());
  });

  // --- start edge cases ---

  test('edge: unknown and prototype-key subject or scenario gets 400 on POST /api/attempts and GET /api/scenarios', { todo: 'F1a-T12' }, async () => {
    const keys = ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'nope'];
    for (const k of keys) {
      assert.equal((await get(url(), `/api/scenarios?subject=${k}`)).status, 400, `scenarios ${k}`);
      assert.equal((await startAttempt(url(), { subject: k, scenario: 'electrical' })).status, 400, `subject ${k}`);
      assert.equal((await startAttempt(url(), { subject: SUBJECT, scenario: k })).status, 400, `scenario ${k}`);
    }
    assert.equal((await get(url(), '/api/scenarios')).status, 400, 'missing subject');
    assert.equal((await startAttempt(url(), { subject: SUBJECT })).status, 400, 'missing scenario');
    assert.equal((await startAttempt(url(), { subject: SUBJECT, scenario: 'electrical' })).status, 200);
  });

  test("edge: a source other than 'fixture' gets 400", { todo: 'F1a-T12' }, async () => {
    for (const source of ['live', 'fixture-fallback', 1, null]) {
      assert.equal((await startAttempt(url(), { subject: SUBJECT, scenario: 'electrical', source })).status, 400, JSON.stringify(source));
    }
  });

  test('edge: bad start bodies get 400 or 413, never 500, and write nothing', { todo: 'F1a-T12' }, async () => {
    const n = allEvents(db()).length;
    for (const body of ['{bad', 'null', '[]', '"x"']) {
      assert.equal((await startAttempt(url(), body)).status, 400, body);
    }
    assert.equal((await startAttempt(url(), JSON.stringify({ subject: SUBJECT, scenario: 'electrical', pad: 'x'.repeat(1_100_000) }))).status, 413);
    assert.equal(allEvents(db()).length, n);
    assert.ok(app.alive());
  });

  // --- static files and legacy routes ---

  test('edge: pack and scenario files are never served statically (403 or 404)', async () => {
    assert.ok(existsSync(PACK_JSON), 'packs/demo-trades/pack.json exists');
    assert.ok(existsSync(new URL('../../packs/demo-trades/scenarios/electrical.json', import.meta.url)));
    for (const p of [
      '/packs/demo-trades/pack.json', '/../packs/demo-trades/pack.json', '/shared/../packs/demo-trades/pack.json',
      '/%2e%2e/packs/demo-trades/pack.json', '/shared/%2e%2e/packs/demo-trades/pack.json',
      '/packs/demo-trades/scenarios/electrical.json'
    ]) {
      const status = await rawRequest(url(), `GET ${p} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n`);
      assert.ok([403, 404].includes(status), `${p} -> ${status}`);
    }
  });

  test('legacy routes return 404', { todo: 'F1a-T18' }, async () => {
    assert.equal((await get(url(), '/api/scenario?trade=electrical')).status, 404);
    assert.equal((await get(url(), '/api/trades')).status, 404);
    assert.equal((await post(url(), '/api/grade', { stepId: 3, errorStepId: 3, explanation: 'x' })).status, 404);
  });
});

// ---------------------------------------------------------------------------
// LIVE server against fake Claude (GRADE_DEADLINE_MS=1500, SCENARIO_DEADLINE_MS=2000)
// ---------------------------------------------------------------------------

describe('LIVE server against fake Claude', () => {
  let app, stub, tmp;
  before(async () => {
    stub = await startFakeClaude();
    tmp = tempDbPath();
    app = await startApp({ live: true, stub, dbPath: tmp.dbPath });
  });
  after(async () => {
    await app?.stop();
    try {
      await assertNoUnroutedCalls(stub);
    } finally {
      await stub?.close();
      tmp?.cleanup();
    }
  });
  const url = () => app.url;
  const db = () => tmp.dbPath;
  // Every test leaves fake Claude on the happy path; the log is never cleared, so the
  // after hook sees every request this file made.
  const happy = () => stub.setMode({});

  // A STOP that is held in fake Claude for `delayMs`, with a check that it is still pending.
  async function stopInFlight(attemptId, stepId, explanation, delayMs = 800) {
    stub.setMode({ delayMs });
    const from = stub.log.length;
    let settled = false;
    const pending = postStop(url(), attemptId, { stepId, explanation });
    pending.then(() => (settled = true), () => (settled = true));
    await waitUntil(() => stub.log.slice(from).some(e => e.kind === 'grade'), { settled: pending });
    return { pending, stillPending: () => !settled, from };
  }

  test('US5.1 a live start and a live STOP write two llm_call rows ok (scenario@1, grade@1, claude-opus-5-5, 1234/321)', { todo: 'F1a-T13b' }, async () => {
    happy();
    const before = llmCalls(db()).length;
    const from = stub.log.length;
    const start = await begin(url());
    assert.equal(start.source, 'live');
    assert.match(start.card.id, CARD_ID_LIVE_RE);
    const r = await stopOk(url(), start.attemptId, 3, GOOD[3]);
    assert.equal(r.source, 'live');
    const rows = llmCalls(db()).slice(before);
    assert.equal(rows.length, 2);
    for (const pipeline of ['scenario', 'grade']) {
      const row = rows.find(x => x.pipeline === pipeline);
      assertLlmRow(row, { pipeline, outcome: 'ok' });
      assert.equal(row.model, 'claude-opus-5-5');
      assert.equal(row.input_tokens, 1234);
      assert.equal(row.output_tokens, 321);
      assert.match(row.id, /^llm_[0-9A-HJKMNP-TV-Z]{26}$/);
    }
    assert.deepEqual(stub.log.slice(from).map(e => e.promptId), ['scenario@1', 'grade@1'], 'x-prompt-id on every request (FR-025)');
  });

  test("US4.2 LIVE attempt with a live card: started {scenario:'scenario@1'}, each graded {grade:'grade@1'}, object.id card_", { todo: 'F1a-T14' }, async () => {
    happy();
    const start = await begin(url());
    assert.equal(start.source, 'live');
    await stopOk(url(), start.attemptId, 3, GOOD[3]);
    await stopOk(url(), start.attemptId, 5, GOOD[5]);
    await completeOk(url(), start.attemptId, { lastStepShown: 10 });
    const events = eventsFor(db(), start.attemptId);
    assert.deepEqual(verbs(events), ['started', ...TRIPLET, ...TRIPLET, 'step-shown', 'completed']);
    for (const e of events) {
      assert.match(e.object.id, CARD_ID_LIVE_RE);
      assert.equal(e.object.id, start.card.id);
      assert.equal(e.context.subject, 'demo-trades@1');
      const expected = e.verb === 'started' ? { scenario: 'scenario@1' } : e.verb === 'graded' ? { grade: 'grade@1' } : {};
      assert.deepEqual(e.context.promptVersions, expected, e.verb);
    }
    assert.deepEqual(events[0].result, { source: 'live' });
    assert.ok(events.filter(e => e.verb === 'graded').every(e => e.result.graderSource === 'live'));
  });

  test('edge: a successful live generation writes the card row (source live, scenario@1, model) before the response', { todo: 'F1a-T12' }, async () => {
    happy();
    const start = await begin(url());
    assert.equal(start.source, 'live');
    const row = cardRow(db(), start.card.id);
    assert.ok(row, 'card row exists when the response arrives');
    assert.equal(row.source, 'live');
    assert.equal(row.prompt_version, 'scenario@1');
    assert.ok(typeof row.model === 'string' && row.model.length > 0);
    assert.equal(row.subject_id, SUBJECT);
    assert.equal(row.subject_version, 1);
    assert.deepEqual(leakScan(start, { kind: 'other' }), []);
    assert.deepEqual(sortedKeys(start.card), PUBLIC_CARD_KEYS);
  });

  test('US5.4 LIVE start with source fixture makes no AI call: no llm_call row, promptVersions {}', { todo: 'F1a-T12' }, async () => {
    happy();
    const before = llmCalls(db()).length;
    const from = stub.log.length;
    const start = await begin(url(), 'electrical', { source: 'fixture' });
    assert.equal(start.source, 'fixture');
    assert.equal(start.card.id, ELECTRICAL_CARD_ID);
    assert.equal(llmCalls(db()).length, before);
    assert.equal(stub.log.length, from, 'fake Claude received nothing');
    const [started] = eventsFor(db(), start.attemptId);
    assert.deepEqual(started.context.promptVersions, {});
  });

  test('US5.2 fake Claude hangs: the STOP answers mock-fallback within 2.5 s and logs outcome timeout', { todo: 'F1a-T13b' }, async () => {
    happy();
    const { attemptId } = await begin(url(), 'electrical', { source: 'fixture' });
    const before = llmCalls(db()).length;
    stub.setMode({ hang: true });
    const r = await postStop(url(), attemptId, { stepId: 3, explanation: GOOD[3] });
    happy();
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.source, 'mock-fallback');
    assert.ok(r.ms < 2500, `${r.ms} ms`);
    const rows = llmCalls(db()).slice(before);
    assert.equal(rows.length, 1);
    assertLlmRow(rows[0], { pipeline: 'grade', outcome: 'timeout' });
  });

  test('edge: an invalid live scenario falls back to the fixture card, logs outcome fallback and writes no card_ row', { todo: 'F1a-T12' }, async () => {
    const s = happyScenario();
    s.steps = s.steps.slice(0, 3); // too few steps for validateScenario
    stub.setMode({ scenario: s });
    const before = llmCalls(db()).length;
    const liveCards = cardRows(db()).filter(c => c.source === 'live').length;
    const r = await startAttempt(url(), { subject: SUBJECT, scenario: 'electrical' });
    happy();
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.source, 'fixture-fallback');
    assert.equal(r.json.card.id, ELECTRICAL_CARD_ID);
    const rows = llmCalls(db()).slice(before);
    assert.equal(rows.length, 1);
    assertLlmRow(rows[0], { pipeline: 'scenario', outcome: 'fallback' });
    assert.equal(cardRows(db()).filter(c => c.source === 'live').length, liveCards);
  });

  test('edge: live model false_alarm on a real mistake becomes wrong; live correct on a clean line becomes false_alarm', { todo: 'F1a-T13b' }, async () => {
    const { attemptId } = await begin(url(), 'electrical', { source: 'fixture' });
    stub.setMode({ grade: { verdict: 'false_alarm', reasoningScore: 0.2, feedback: 'Not a problem.' } });
    const a = await stopOk(url(), attemptId, 3, GOOD[3]);
    assert.equal(a.verdict, 'wrong');
    assert.equal(a.caught?.errorStepId, 3);
    assert.equal(a.source, 'live');
    const b2 = await begin(url(), 'electrical', { source: 'fixture' });
    stub.setMode({ grade: happyGrade() });
    const b = await stopOk(url(), b2.attemptId, 1, 'looks wrong');
    happy();
    assert.equal(b.verdict, 'false_alarm');
    assert.equal(b.caught, null);
    assert.equal(b.points, -75);
  });

  // --- US5.6: the fake-Claude failure matrix (ADR 0005 Amendment 2 table; FR-026) ---

  const truncated = text => text.slice(0, Math.floor(text.length / 2));
  const MATRIX = [
    { mode: 'hang', outcome: 'timeout', set: () => ({ hang: true }) },
    { mode: '429 retry-after 60', outcome: 'timeout', set: () => ({ status: 429, retryAfter: '60' }) },
    { mode: '500', outcome: 'fallback', set: () => ({ status: 500 }) },
    { mode: '529', outcome: 'fallback', set: () => ({ status: 529 }) },
    { mode: 'refusal', outcome: 'refusal', set: () => ({ stopReason: 'refusal', stopDetails: { type: 'refusal', category: 'cyber' }, content: [] }) },
    { mode: 'max_tokens + truncated JSON', outcome: 'fallback', set: kind => ({ stopReason: 'max_tokens', ...(kind === 'grade' ? { gradeText: truncated(JSON.stringify(happyGrade())) } : { scenarioText: truncated(JSON.stringify(happyScenario())) }) }) },
    { mode: 'non-JSON text', outcome: 'fallback', set: kind => (kind === 'grade' ? { gradeText: 'Sure! The learner is right.' } : { scenarioText: 'Here is a scenario for you.' }) },
    { mode: 'wrong-schema {}', outcome: 'fallback', set: kind => (kind === 'grade' ? { grade: {} } : { scenario: {} }) },
    { mode: 'fallback block', outcome: 'ok', set: kind => ({ content: fallbackContent(JSON.stringify(kind === 'grade' ? happyGrade() : happyScenario())) }) }
  ];

  test('edge: fake-Claude failure matrix (start)', { todo: 'F1a-T12' }, async () => {
    const problems = [];
    for (const row of MATRIX) {
      const check = (ok, what) => { if (!ok) problems.push(`${row.mode}: ${what}`); };
      try {
        const before = llmCalls(db()).length;
        stub.setMode(row.set('scenario'));
        const r = await startAttempt(url(), { subject: SUBJECT, scenario: 'electrical' });
        happy();
        check(r.status === 200, `status ${r.status} ${r.text.slice(0, 200)}`);
        if (r.status !== 200) continue;
        const want = row.outcome === 'ok' ? 'live' : 'fixture-fallback';
        check(r.json.source === want, `source ${r.json.source}, want ${want}`);
        check(r.ms <= 2000 + 1000, `${r.ms} ms > deadline + 1000`);
        check(row.outcome === 'ok' ? CARD_ID_LIVE_RE.test(r.json.card.id) : r.json.card.id === ELECTRICAL_CARD_ID, `card.id ${r.json.card.id}`);
        const rows = llmCalls(db()).slice(before);
        check(rows.length === 1, `${rows.length} new llm_call rows`);
        check(rows[0]?.pipeline === 'scenario' && rows[0]?.prompt_version === 'scenario@1', `row ${JSON.stringify(rows[0])}`);
        check(rows[0]?.outcome === row.outcome, `outcome ${rows[0]?.outcome}, want ${row.outcome}`);
        const events = eventsFor(db(), r.json.attemptId);
        check(events.length === 1 && events[0].verb === 'started', `events ${verbs(events)}`);
        check(JSON.stringify(events[0]?.context?.promptVersions) === JSON.stringify({ scenario: 'scenario@1' }), `promptVersions ${JSON.stringify(events[0]?.context?.promptVersions)}`);
        check(events[0]?.result?.source === want, `started.result.source ${events[0]?.result?.source}`);
      } catch (err) {
        happy();
        problems.push(`${row.mode}: threw ${err.message}`);
      }
    }
    assert.deepEqual(problems, []);
  });

  test('edge: fake-Claude failure matrix (stops)', { todo: 'F1a-T13b' }, async () => {
    const problems = [];
    for (const row of MATRIX) {
      const check = (ok, what) => { if (!ok) problems.push(`${row.mode}: ${what}`); };
      try {
        happy();
        const { attemptId } = await begin(url(), 'electrical', { source: 'fixture' });
        const before = llmCalls(db()).length;
        stub.setMode(row.set('grade'));
        const r = await postStop(url(), attemptId, { stepId: 3, explanation: GOOD[3] });
        happy();
        check(r.status === 200, `status ${r.status} ${r.text.slice(0, 200)}`);
        if (r.status !== 200) continue;
        const want = row.outcome === 'ok' ? 'live' : 'mock-fallback';
        check(r.json.source === want, `source ${r.json.source}, want ${want}`);
        check(r.ms <= 1500 + 1000, `${r.ms} ms > deadline + 1000`);
        check(r.json.caught?.errorStepId === 3, `caught ${JSON.stringify(r.json.caught)}`);
        const rows = llmCalls(db()).slice(before);
        check(rows.length === 1, `${rows.length} new llm_call rows`);
        check(rows[0]?.pipeline === 'grade' && rows[0]?.prompt_version === 'grade@1', `row ${JSON.stringify(rows[0])}`);
        check(rows[0]?.outcome === row.outcome, `outcome ${rows[0]?.outcome}, want ${row.outcome}`);
        const events = eventsFor(db(), attemptId);
        check(JSON.stringify(verbs(events)) === JSON.stringify(['started', ...TRIPLET]), `events ${verbs(events)}`);
        const graded = events.find(e => e.verb === 'graded');
        check(JSON.stringify(graded?.context?.promptVersions) === JSON.stringify({ grade: 'grade@1' }), `graded.promptVersions ${JSON.stringify(graded?.context?.promptVersions)}`);
        check(graded?.result?.graderSource === want, `graderSource ${graded?.result?.graderSource}`);
      } catch (err) {
        happy();
        problems.push(`${row.mode}: threw ${err.message}`);
      }
    }
    assert.deepEqual(problems, []);
  });

  // --- in-flight STOPs (ADR 0003 Amendment 3) ---

  test('edge: same STOP twice in flight joins: both 200, identical body, one triplet, one grade call', { todo: 'F1a-T13b' }, async () => {
    happy();
    const { attemptId } = await begin(url(), 'electrical', { source: 'fixture' });
    const first = await stopInFlight(attemptId, 3, GOOD[3]);
    assert.ok(first.stillPending(), 'the first STOP is still being graded');
    const second = postStop(url(), attemptId, { stepId: 3, explanation: GOOD[3] });
    const [a, b] = await Promise.all([first.pending, second]);
    happy();
    assert.equal(a.status, 200, a.text);
    assert.equal(b.status, 200, b.text);
    assert.deepEqual(b.json, a.json);
    assert.deepEqual(verbs(eventsFor(db(), attemptId)), ['started', ...TRIPLET]);
    assert.equal(stub.log.slice(first.from).filter(e => e.kind === 'grade').length, 1);
  });

  test("edge: an edited answer sent while the same STOP is in flight is ignored; explained holds the first text", { todo: 'F1a-T13b' }, async () => {
    happy();
    const { attemptId } = await begin(url(), 'electrical', { source: 'fixture' });
    const first = await stopInFlight(attemptId, 3, GOOD[3]);
    assert.ok(first.stillPending());
    const second = postStop(url(), attemptId, { stepId: 3, explanation: 'a completely different answer' });
    const [a, b] = await Promise.all([first.pending, second]);
    happy();
    assert.deepEqual(b.json, a.json);
    const explained = eventsFor(db(), attemptId).filter(e => e.verb === 'explained');
    assert.deepEqual(explained.map(e => e.result.text), [GOOD[3]]);
  });

  test('edge: different stepId while one is in flight gets 409 and writes nothing', { todo: 'F1a-T13b' }, async () => {
    happy();
    const { attemptId } = await begin(url(), 'electrical', { source: 'fixture' });
    const first = await stopInFlight(attemptId, 3, GOOD[3]);
    assert.ok(first.stillPending());
    const other = await postStop(url(), attemptId, { stepId: 5, explanation: GOOD[5] });
    assert.equal(other.status, 409, other.text);
    assert.equal(typeof other.json?.error, 'string');
    assert.deepEqual(sortedKeys(other.json), ['error'], '409 body stays {error}');
    const a = await first.pending;
    happy();
    assert.equal(a.status, 200);
    assert.deepEqual(triplets(eventsFor(db(), attemptId)), { 3: TRIPLET }, 'nothing for step 5');
    assert.equal(stub.log.slice(first.from).filter(e => e.kind === 'grade').length, 1);
  });

  test('edge: complete while a STOP is in flight gets 409 and writes nothing', { todo: 'F1a-T14' }, async () => {
    happy();
    const { attemptId } = await begin(url(), 'electrical', { source: 'fixture' });
    const first = await stopInFlight(attemptId, 3, GOOD[3]);
    assert.ok(first.stillPending());
    const c = await postComplete(url(), attemptId, { lastStepShown: 10 });
    assert.equal(c.status, 409, c.text);
    assert.equal(typeof c.json?.error, 'string');
    const a = await first.pending;
    happy();
    assert.equal(a.status, 200);
    assert.deepEqual(verbs(eventsFor(db(), attemptId)), ['started', ...TRIPLET], 'no step-shown or completed');
    const after = await completeOk(url(), attemptId, { lastStepShown: 10 });
    assert.equal(after.caughtCount, 1, 'complete after the STOP returns counts it');
  });

  // --- positions, not ids (ADR 0003 Amendment 1; review B12) ---

  test('edge: step ids not in ascending order: order checks use positions and resolveStop credits the right line', { todo: 'F1a-T13b' }, async () => {
    const s = happyScenario();
    const ids = [1, 2, 3, 5, 4, 6, 7, 8, 9, 10];
    s.steps = s.steps.map((step, i) => ({ ...step, id: ids[i] })); // mistakes stay at positions 2, 4, 6 (ids 3, 4, 7)
    stub.setMode({ scenario: s });
    const start = await begin(url());
    happy();
    assert.equal(start.source, 'live');
    assert.deepEqual(start.card.steps.map(x => x.id), ids);
    const a = await stopOk(url(), start.attemptId, 5, GOOD[3]); // position 3: one late for id 3
    assert.deepEqual([a.caught?.errorStepId, a.caught?.stepsLate], [3, 1]);
    const b = await stopOk(url(), start.attemptId, 4, GOOD[5]); // position 4: a forward move with a lower id
    assert.deepEqual([b.caught?.errorStepId, b.caught?.stepsLate], [4, 0]);
  });

  test('edge: explanation over 2000 chars is truncated before grading and in explained.result.text', { todo: 'F1a-T13b' }, async () => {
    happy();
    const { attemptId } = await begin(url(), 'electrical', { source: 'fixture' });
    const long = 'a'.repeat(1995) + 'Z'.repeat(10) + 'Y'.repeat(10); // 2015 chars; the cut falls inside the Zs
    const from = stub.log.length;
    await stopOk(url(), attemptId, 3, long);
    const sent = stub.log.slice(from).find(e => e.kind === 'grade')?.user ?? '';
    assert.ok(sent.includes('a'.repeat(1995) + 'Z'.repeat(5)), 'the first 2000 chars reach the model');
    assert.ok(!sent.includes('Z'.repeat(6)) && !sent.includes('Y'), 'nothing past 2000 chars reaches the model');
    assert.equal(eventsFor(db(), attemptId).find(e => e.verb === 'explained').result.text, long.slice(0, 2000));
  });

  test('US5.5 a model request without x-prompt-id gets 500 and is logged with kind null', { todo: 'F1a-T09' }, async () => {
    const own = await startFakeClaude(); // its own stub: this test makes an unrouted call on purpose
    try {
      const res = await fetch(`${own.url}/v1/messages`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: 'x', messages: [] }) });
      assert.equal(res.status, 500);
      assert.equal((await res.json()).error?.message, 'stub: missing x-prompt-id');
      assert.equal(own.log.at(-1)?.kind, null);
      const { assertNoUnroutedCalls: strict } = await import('../helpers/fake-claude.mjs');
      await assert.rejects(Promise.resolve().then(() => strict(own)));
    } finally {
      await own.close();
    }
  });
});

// ---------------------------------------------------------------------------
// Restarts and storage: each test owns its servers and its DB file.
// ---------------------------------------------------------------------------

describe('restarts and storage', () => {
  test('US4.5 server killed mid-grade: after restart no stopped/explained/graded exists, and the same STOP is graded once', { todo: 'F1a-T13b' }, async () => {
    const stub = await startFakeClaude();
    const tmp = tempDbPath();
    let app = null;
    try {
      app = await startApp({ live: true, stub, dbPath: tmp.dbPath });
      const { attemptId } = await begin(app.url, 'electrical', { source: 'fixture' });
      stub.setMode({ delayMs: 1000 });
      const from = stub.log.length;
      const pending = postStop(app.url, attemptId, { stepId: 3, explanation: GOOD[3] }).catch(err => err);
      assert.ok(await waitUntil(() => stub.log.slice(from).some(e => e.kind === 'grade'), { settled: pending }), 'grade request reached the model');
      app.child.kill('SIGKILL');
      await app.stop();
      await pending;
      stub.setMode({});
      app = await startApp({ live: true, stub, dbPath: tmp.dbPath });
      assert.deepEqual(verbs(eventsFor(tmp.dbPath, attemptId)), ['started']);
      const r = await stopOk(app.url, attemptId, 3, GOOD[3]);
      assert.equal(r.source, 'live');
      assert.deepEqual(triplets(eventsFor(tmp.dbPath, attemptId)), { 3: TRIPLET });
    } finally {
      await app?.stop();
      try {
        await assertNoUnroutedCalls(stub);
      } finally {
        await stub.close();
        tmp.cleanup();
      }
    }
  });

  test('US4.3 UPDATE and DELETE on event raise append-only and leave the rows unchanged', { todo: 'F1a-T12' }, async () => {
    const tmp = tempDbPath();
    try {
      const app = await startApp({ dbPath: tmp.dbPath });
      try {
        await begin(app.url);
      } finally {
        await app.stop();
      }
      const before = allEvents(tmp.dbPath);
      assert.ok(before.length >= 1);
      const db = new DatabaseSync(tmp.dbPath);
      try {
        assert.throws(() => db.exec("UPDATE event SET verb = 'x'"), /append-only/);
        assert.throws(() => db.exec('DELETE FROM event'), /append-only/);
      } finally {
        db.close();
      }
      assert.deepEqual(allEvents(tmp.dbPath), before);
    } finally {
      tmp.cleanup();
    }
  });

  test('edge: a pack changed without a version bump is refused at startup: subjects [], its id answers 400, the server still serves', { todo: 'F1a-T12' }, async () => {
    const tmp = tempDbPath();
    let app = null;
    try {
      app = await startApp({ dbPath: tmp.dbPath });
      await app.stop();
      const db = new DatabaseSync(tmp.dbPath);
      try {
        const { changes } = db.prepare("UPDATE subject_pack SET json = '{\"changed\":true}' WHERE id = ? AND version = 1").run(SUBJECT);
        assert.equal(changes, 1, 'the stored demo-trades@1 row exists');
      } finally {
        db.close();
      }
      app = await startApp({ dbPath: tmp.dbPath });
      const subjects = await get(app.url, '/api/subjects');
      assert.equal(subjects.status, 200);
      assert.deepEqual(subjects.json, []);
      assert.equal((await get(app.url, `/api/scenarios?subject=${SUBJECT}`)).status, 400);
      assert.equal((await startAttempt(app.url, { subject: SUBJECT, scenario: 'electrical' })).status, 400);
      assert.match(app.output(), /\[packs\] demo-trades skipped: /);
      assert.equal((await get(app.url, '/api/health')).status, 200);
    } finally {
      await app?.stop();
      tmp.cleanup();
    }
  });

  test('edge: a failing migration exits non-zero with [db] migration 001 failed and never listens', async () => {
    const tmp = tempDbPath();
    try {
      const db = new DatabaseSync(tmp.dbPath);
      db.exec('CREATE TABLE event (x)'); // user_version stays 0, so 001 runs and collides
      db.close();
      let app = null;
      const err = await startApp({ dbPath: tmp.dbPath }).then(a => { app = a; return null; }, e => e);
      if (app) await app.stop();
      assert.ok(err, 'the server must not start listening');
      assert.match(err.message, /server exited \([1-9]\d*\)/);
      assert.match(err.message, /\[db\] migration 001 failed: /);
    } finally {
      tmp.cleanup();
    }
  });
});
