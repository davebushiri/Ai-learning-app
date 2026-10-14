// F1c acceptance tests, HTTP level (F1c-T01a). Written from docs/specs/F1c-practice-engine/spec.md
// (revision 2) before the engine exists. A test waiting on a ticket carries that ticket's ID as its todo reason;
// QA removes the marker when verifying that ticket (tasks.md "todo mapping").
//
// Fixtures: tests/fixtures/practice/accept-pack (QA-owned, fictional subject "Kite Craft"), and the
// labelled answer sets for SC-003 / SC-003b. The answer texts below are rows of labelled-answers.json.
//
// C3: no test here calls the card engine's routes; the card engine is observed only through
// listSubjects() and the server log.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  ACCEPT_PACK_DIR, CLASSES, acceptPacksDir, FR004_KEYS, LEAK_ALLOW, PRA_ID_RE, ROOT, TRACK,
  allEvents, api, eventsFor, evaluateThresholds, formatConfusion, graderInputFor, ok, practiceLeakScan,
  readLabelled, readM1Labelled, readPackDir, request, startPractice, tempDbPath
} from './practice-helpers.mjs';

const PACK = readPackDir();
const EX = id => PACK.exercises.get(id);
const LINES = EX('catch-lines');
const planted = id => LINES.answerKey.planted.find(p => p.statementId === id);
const narr = (ex, id) => ex.narration.find(n => n.id === id).text;

// Answers (rows of labelled-answers.json).
const A_S3_MET = 'A thicker line is heavier and has more drag, so it pulls the kite lower in the sky. Use a thinner line and the kite climbs higher.';
const A_S3_ALT = 'Heavier line drags the kite lower. Use a slim cord and the kite gains altitude.';
const A_S3_PARTIAL = 'The heavier line adds weight.';
const A_S3_WRONG = 'Thicker line is fine, it just looks nicer to the crowd.';
const A_S5_NEGATED = 'Check for frays before every flight, because sunlight and rubbing weaken the line over time and its rating does not last.';
const A_LONG = 'Kites are colourful toys that families enjoy at beaches and parks during long summer holidays, and many people collect unusual designs from different countries around the world, then decorate their walls with bright ribbons, paper tails and painted dragons.';
const A_INTERVIEW_MET = 'First I check the wind direction, clear an open area around me, and have a helper hold the kite while I let out line.';
const A_INTERVIEW_REJECTS = "Check the wind direction, keep an open space around me and get a helper to hold the kite. I wouldn't sprint downwind.";
const A_INTERVIEW_FLAG = "I'd sprint downwind to get it up fast, after I check the wind direction and clear an open area.";
const A_DESIGN_MET = "Put spectators behind a barrier, fly away from the road, and hold a safety briefing for fliers before we start. I'd check the forecast too.";
const A_DESIGN_PARTIAL = 'Put spectators behind a barrier and enjoy the show.';
const A_CH0_MET = 'Keep a few spare light wind kites ready, and if it gets too calm, pause the display while we wait.';
const A_CH1_MET = 'Fly away from the road and put marshals at the edge with barrier tape.';
const A_WORKSHOP_NO_ARCH = 'Give a kit for each child, keep an adult at every table, and leave time to decorate.';

const STOP_KEYS = ['assisted', 'attributedStatementId', 'detection', 'result', 'reveal', 'statementId'];
const PUBLIC_KEYS = new Set(['id', 'module', 'type', 'objective', 'difficulty', 'concepts', 'prerequisites', 'narration', 'brief', 'constraints', 'firstPrompt']);
const keys = o => Object.keys(o ?? {}).sort();
const noLeak = (json, allow, label) => assert.deepEqual(practiceLeakScan(json, { allow }), [], `${label} leaks an FR-004 key`);
// The status of a part's dimension, whatever wrapper the result uses ({status} Dim, or {<dim>: Dim}).
const statusOf = (result, dim) => result?.[dim]?.status ?? result?.dimensions?.[dim]?.status ?? result?.status ?? null;
const hasNumber = v => (typeof v === 'number' ? true : v && typeof v === 'object' ? Object.values(v).some(hasNumber) : false);

// One server for tests that only read their own attempt; tests that read progress or the DB start their own.
let shared = null;
const sharedApi = async () => api((await (shared ??= startPractice())).url);
after(async () => { if (shared) await (await shared.catch(() => null))?.stop(); });

async function fresh(t, { db = false, packsDir } = {}) {
  const tmp = db ? tempDbPath() : null;
  const srv = await startPractice({ packsDir, dbPath: tmp?.dbPath });
  t.after(async () => { await srv.stop(); tmp?.cleanup(); });
  return { srv, A: api(srv.url), dbPath: tmp?.dbPath };
}

const begin = async (A, exercise, extra) => ok(await A.start(exercise, extra), `start ${exercise}`);
const stopOk = async (A, id, body) => ok(await A.stop(id, { elapsedMs: 800, via: 'button', stopLatencyMs: null, ...body }), `stop ${body.statementId}`);

// =============================================================================================
// Runs now: helpers, fixtures and guard checks (no product code needed)
// =============================================================================================

test('helper: practiceLeakScan reports every FR-004 key at any depth by its JSON path', () => {
  const body = { attemptId: 'x', exercise: { narration: [{ id: 's1', text: 't' }], answerKey: { planted: [] } }, list: [{ deep: { note: 'n' } }] };
  assert.deepEqual(practiceLeakScan(body), ['exercise.answerKey', 'exercise.answerKey.planted', 'list[0].deep.note']);
  for (const k of FR004_KEYS) assert.deepEqual(practiceLeakScan({ a: [{ [k]: 1 }] }), [`a[0].${k}`], k);
  assert.deepEqual(practiceLeakScan({ attemptId: 'x', exercise: { id: 'e', narration: [] } }), []);
});

test('helper: practiceLeakScan allow patterns: [] matches any index and allows everything beneath', () => {
  const schedule = { plan: [{ day: 1, blocks: [{ kind: 'catch', minutes: 30 }, { kind: 'review', x: { reveal: 1 } }] }], kind: 'top' };
  // Only the kind at plan[].blocks[].kind is allowed: a reveal elsewhere in a block is still a leak.
  assert.deepEqual(practiceLeakScan(schedule, { allow: LEAK_ALLOW.schedule }), ['plan[0].blocks[1].x.reveal', 'kind']);
  assert.deepEqual(practiceLeakScan({ reveal: { whyWrong: 'w', correctedText: 'c' }, result: { reveal: 1 } }, { allow: LEAK_ALLOW.stop }), ['result.reveal']);
  assert.deepEqual(practiceLeakScan({ concepts: [{ readiness: { transfer: true } }, { transfer: 1 }] }, { allow: LEAK_ALLOW.progress }), ['concepts[1].transfer']);
  assert.deepEqual(practiceLeakScan({ revealed: 1, reference2: 1 }, { allow: ['reveal', 'reference'] }), [], 'a pattern is a whole path, not a prefix of a key');
  assert.deepEqual(practiceLeakScan({ reference: [{ id: 'r', text: 't' }] }, { allow: LEAK_ALLOW.assist }), []);
});

test('helper: practiceLeakScan never throws; a cycle gives "<cycle>"', () => {
  const a = { x: {} };
  a.x.self = a;
  assert.deepEqual(practiceLeakScan(a), ['<cycle>']);
  const bad = { get reveal() { throw new Error('boom'); } };
  assert.doesNotThrow(() => practiceLeakScan(bad));
  for (const v of [null, undefined, 1, 'reveal', [], [[[]]], Symbol('s')]) assert.deepEqual(practiceLeakScan(v), []);
  assert.doesNotThrow(() => practiceLeakScan({ reveal: 1 }, { allow: 'nope' }));
});

test('helper: LEAK_ALLOW is frozen and holds exactly the FR-004 exceptions', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(LEAK_ALLOW)), {
    stop: ['reveal'], clarification: ['reveal'], assist: ['reference'], schedule: ['plan[].blocks[].kind'],
    progress: ['concepts[].readiness.transfer'], other: []
  });
  assert.ok(Object.isFrozen(LEAK_ALLOW) && Object.values(LEAK_ALLOW).every(Object.isFrozen));
  assert.equal(FR004_KEYS.length, 29);
});

test('helper: evaluateThresholds applies the SC-003 thresholds', () => {
  const rows = (cls, expect, actuals) => actuals.map(actual => ({ class: cls, expect, actual }));
  const good = [
    ...rows('clear', 'met', ['met', 'met']), ...rows('incorrect', 'not_met', ['not_met', 'partial']),
    ...rows('valid-alternative', ['met', 'partial'], ['met', 'partial', 'met', 'met']),
    ...rows('partial', 'partial', ['partial', 'uncertain', 'partial', 'partial', 'partial']),
    ...rows('should-flag', 'uncertain', ['uncertain', 'uncertain', 'uncertain', 'uncertain', 'partial'])
  ];
  assert.deepEqual(evaluateThresholds(good).failures, []);
  const bad = [...rows('clear', 'met', ['met', 'partial']), ...rows('incorrect', 'not_met', ['met', 'uncertain', 'uncertain']),
    ...rows('valid-alternative', 'met', ['not_met', 'met', 'met', 'met'])];
  const f = evaluateThresholds(bad).failures.map(x => x.split(':')[0]);
  assert.deepEqual(f, ['clear → met (100%)', 'incorrect → met (0%)', 'valid-alternative → not_met (0%)', 'clear + incorrect → uncertain (≤ 20%)']);
});

test('fixture: accept-pack covers every type, a zero-planted catch, a string interview follow-up and a scenario with no mustInclude', () => {
  const { manifest, schedule, exercises, references } = PACK;
  const all = [...exercises.values()];
  assert.deepEqual(new Set(all.map(e => e.type)), new Set(['catch', 'learn', 'interview', 'scenario']));
  assert.deepEqual(manifest.modules.flatMap(m => m.exercises).sort(), [...exercises.keys()].sort());
  assert.ok(all.some(e => e.type === 'catch' && e.answerKey.planted.length === 0), 'zero-planted catch');
  assert.ok(all.some(e => e.type === 'interview' && e.followUps.some(f => typeof f === 'string')), 'string interview follow-up');
  assert.ok(all.some(e => e.type === 'scenario' && e.acceptableArchitectures.every(a => !a.mustInclude)), 'scenario without mustInclude');
  assert.ok(all.some(e => e.type === 'scenario' && e.acceptableArchitectures.some(a => a.mustInclude)), 'scenario with mustInclude');
  for (const e of all) {
    for (const r of e.referenceIds) assert.ok(references.has(r), `${e.id}: reference ${r}`);
    if (e.type !== 'catch') continue;
    for (const p of e.answerKey.planted) {
      const text = narr(e, p.statementId).toLowerCase();
      for (const r of e.referenceIds) assert.ok(!references.get(r).toLowerCase().includes(text), `${e.id}: ${p.statementId} is in reference ${r}`);
    }
  }
  assert.ok(all.some(e => e.sources.some(s => s.verified === false && typeof s.note === 'string')), 'an unverified source with a note');
  assert.ok(schedule.diagnostic.length >= 1 && schedule.plan.length === schedule.days);
});

test('fixture: labelled-answers.json has ≥ 40 rows, ≥ 8 per class and the required cases, each on a real part', () => {
  const rows = readLabelled();
  assert.ok(Array.isArray(rows) && rows.length >= 40, `rows: ${rows.length}`);
  for (const c of CLASSES) assert.ok(rows.filter(r => r.class === c).length >= 8, `class ${c} has < 8 rows`);
  const expectByClass = { clear: 'met', 'should-flag': 'uncertain' };
  for (const [i, r] of rows.entries()) {
    assert.deepEqual(keys(r).filter(k => !['tags', 'note'].includes(k)), ['answer', 'class', 'exercise', 'expect', 'part'], `row ${i}`);
    assert.ok(CLASSES.includes(r.class), `row ${i} class`);
    if (expectByClass[r.class]) assert.equal(r.expect, expectByClass[r.class], `row ${i} expect`);
    const ex = EX(r.exercise);
    assert.ok(ex, `row ${i}: exercise ${r.exercise}`);
    assert.doesNotThrow(() => graderInputFor(ex, r.part, r.answer), `row ${i}: part ${r.part}`);
  }
  const tagged = tag => rows.filter(r => r.tags?.includes(tag));
  const pipeRow = r => JSON.stringify(graderInputFor(EX(r.exercise), r.part, '').input.dimensions).includes('|');
  assert.ok(tagged('pipe-alt').length >= 3 && tagged('pipe-alt').every(pipeRow), 'rows on | items (C1)');
  assert.ok(tagged('negated-item').length >= 2, 'negated rubric item rows (PD-2)');
  for (const r of tagged('negated-item')) assert.equal(r.class, 'clear');
  assert.ok(tagged('rejected-red-flag').some(r => /wouldn.t/i.test(r.answer) && r.expect === 'met'), 'a rejected red flag row');
  assert.ok(tagged('asserted-red-flag').some(r => r.expect === 'uncertain'), 'an asserted red flag row');
  assert.ok(tagged('two-of-three').length >= 2, '3-item dimensions answered with 2 items (PD-3)');
  assert.ok(tagged('stuffed').length >= 2 && tagged('stuffed').every(r => r.expect === 'partial'), 'keyword-list rows capped at partial (FR-019)');
  for (const c of CLASSES) {
    assert.ok(rows.some(r => r.class === c && r.part.startsWith('stop:')), `${c}: stop-level row`);
    assert.ok(rows.some(r => r.class === c && !r.part.startsWith('stop:')), `${c}: answer-level row`);
  }
});

test('fixture: m1-labelled-answers.json has one row per research answer with its fields copied', () => {
  const src = JSON.parse(readFileSync(path.join(ROOT, 'docs/research/applied-ai/module-1/exercises/_matcher-test-answers.json'), 'utf8'));
  const m1 = readM1Labelled();
  const expected = src.items.flatMap(it => (it.answers ?? []).map(a => ({ exercise: it.exercise, statementId: it.statementId, class: a.class, text: a.text, expected: a.expected })));
  assert.equal(m1.rows.length, expected.length);
  assert.deepEqual(m1.rows.map(({ exercise, statementId, class: c, text, expected: e }) => ({ exercise, statementId, class: c, text, expected: e })), expected);
  for (const r of m1.rows) {
    for (const [dim, v] of Object.entries(r.expected)) {
      assert.deepEqual(r.expect[dim], v.includes(' or ') ? v.split(' or ') : v, `${r.exercise} ${r.class} ${dim}`);
    }
  }
  assert.deepEqual(m1.draftSynonyms, src.proposedLexicon.synonyms);
});

test('C3: no F1c test calls the card engine routes (subjects, trades, scenario)', () => {
  const files = ['tests/acceptance/F1c.test.js', 'tests/acceptance/practice-helpers.mjs', 'tests/e2e/F1c.e2e.mjs']
    .map(f => path.join(ROOT, f)).filter(existsSync);
  const banned = new RegExp(`/api/(${['subj' + 'ects', 'tra' + 'des', 'scen' + 'ario'].join('|')})(?![a-z])`);
  for (const f of files) assert.doesNotMatch(readFileSync(f, 'utf8'), banned, f);
});

// =============================================================================================
// F1c-T02: pack format and loader; SC-010
// =============================================================================================

test('accept-pack validates with 0 problems and loads as track kite-craft', async () => {
  const { validatePracticePack, loadPracticePacks, listTracks } = await import('../../server/services/practice-pack.js');
  const { openDb } = await import('../../server/db.js');
  assert.deepEqual(validatePracticePack(PACK), []);
  const tracks = loadPracticePacks(acceptPacksDir(), openDb(':memory:'), { getPack: () => null });
  assert.ok(tracks.has(TRACK));
  assert.deepEqual(listTracks(), [{ id: TRACK, title: 'Kite Craft', version: 1 }]);
});

test('SC-010 invalid practice pack: server up, one [practice] warning, listSubjects() unchanged and no [packs] warning', async t => {
  const { loadPacks, listSubjects } = await import('../../server/packs.js');
  const { loadPracticePacks, listTracks } = await import('../../server/services/practice-pack.js');
  const { openDb } = await import('../../server/db.js');
  const logs = [];
  const orig = { warn: console.warn, error: console.error, log: console.log };
  for (const k of Object.keys(orig)) console[k] = (...a) => logs.push(a.join(' '));
  const dir = mkdtempSync(path.join(tmpdir(), 'f1c-sc010-'));
  t.after(() => { Object.assign(console, orig); rmSync(dir, { recursive: true, force: true }); });

  loadPacks(path.join(ROOT, 'packs'), openDb(':memory:'));
  const before = structuredClone(listSubjects());
  logs.length = 0;
  cpSync(path.join(ROOT, 'packs', 'demo-trades'), path.join(dir, 'demo-trades'), { recursive: true });
  cpSync(ACCEPT_PACK_DIR, path.join(dir, 'kite-craft'), { recursive: true });
  mkdirSync(path.join(dir, 'broken'));
  writeFileSync(path.join(dir, 'broken', 'practice.json'), JSON.stringify({ format: 'practice-v1', id: 'broken', version: 1 }));

  const db = openDb(':memory:');
  loadPacks(dir, db);
  loadPracticePacks(dir, db);
  Object.assign(console, orig);
  assert.deepEqual(listSubjects(), before);
  assert.deepEqual(logs.filter(l => l.includes('[packs]')), []);
  const practice = logs.filter(l => l.startsWith('[practice]'));
  assert.equal(practice.length, 1, logs.join('\n'));
  assert.match(practice[0], /^\[practice\] broken skipped: /);
  assert.deepEqual(listTracks().map(x => x.id), [TRACK]);
});

// =============================================================================================
// F1c-T03: SC-003 matcher thresholds on the QA-labelled set
// =============================================================================================

// Runs for real (T03 is merged) and prints the confusion table. It stays a todo on F1c-T03 because the
// matcher misses two thresholds (bug F1c-B20, FR-019 stuffing cap on concise correct answers); QA removes
// the marker when B20 is fixed and this passes.
test('SC-003 labelled set thresholds', { todo: 'F1c-T03' }, async t => {
  const { matcherGrade, combineOverall, MATCHER_VERSION } = await import('../../server/services/practice-matcher.js');
  const lexicon = PACK.manifest.lexicon;
  const rows = readLabelled().map(r => {
    const { input, dims } = graderInputFor(EX(r.exercise), r.part, r.answer, lexicon);
    const out = matcherGrade(input);
    assert.equal(out.graderSource, 'matcher');
    assert.equal(out.graderVersion, MATCHER_VERSION);
    const ds = dims.map(d => out.dimensions[d]);
    const actual = ds.length === 2 ? combineOverall(ds) : ds[0].status;
    return { ...r, actual, dims: Object.fromEntries(dims.map(d => [d, out.dimensions[d].status])) };
  });
  const { table, lines, failures } = evaluateThresholds(rows);
  for (const l of [...formatConfusion(table), ...lines]) t.diagnostic(l);
  for (const r of rows.filter(r => r.actual !== r.expect)) t.diagnostic(`differs: ${r.class} ${r.exercise} ${r.part} expect ${r.expect} got ${r.actual} ${JSON.stringify(r.dims)}`);
  assert.deepEqual(failures, []);
});

// =============================================================================================
// F1c-T11: SC-003b, the module-1 set against packs/applied-ai
// =============================================================================================

test('SC-003b module-1 labelled set thresholds', { todo: 'F1c-T11' }, async t => {
  const { matcherGrade, combineOverall } = await import('../../server/services/practice-matcher.js');
  const { loadPracticePacks, getExercise, getTrack } = await import('../../server/services/practice-pack.js');
  const { openDb } = await import('../../server/db.js');
  const tracks = loadPracticePacks(path.join(ROOT, 'packs'), openDb(':memory:'), { getPack: () => null });
  assert.ok(tracks.has('applied-ai'), 'packs/applied-ai loads');
  const { lexicon } = getTrack('applied-ai');
  const asList = v => (Array.isArray(v) ? v : [v]);
  const dimMisses = [];
  const rows = readM1Labelled().rows.map(r => {
    const ex = getExercise('applied-ai', r.exercise);
    assert.ok(ex, `exercise ${r.exercise}`);
    const out = matcherGrade(graderInputFor(ex, r.part, r.text, lexicon).input);
    const got = { explanation: out.dimensions.explanation.status, correction: out.dimensions.correction.status };
    got.overall = combineOverall([out.dimensions.explanation, out.dimensions.correction]);
    for (const d of ['explanation', 'correction']) if (!asList(r.expect[d]).includes(got[d])) dimMisses.push(`${r.exercise} ${r.class} ${d}: expect ${r.expect[d]} got ${got[d]}`);
    return { class: r.class, expect: r.expect.overall, actual: got.overall };
  });
  const { table, lines, failures } = evaluateThresholds(rows);
  for (const l of [...formatConfusion(table), ...lines, ...dimMisses.map(m => `dimension differs: ${m}`)]) t.diagnostic(l);
  assert.deepEqual(failures, []);
});

// =============================================================================================
// F1c-T04: catch attempt API (US1, US6.3, server edge cases)
// =============================================================================================

test('US1.1 start returns narration only (leak scan)', { todo: 'F1c-T04' }, async () => {
  const A = await sharedApi();
  const r = await A.start('catch-lines');
  const body = ok(r, 'start');
  assert.deepEqual(keys(body), ['assistAllowed', 'attemptId', 'exercise']);
  assert.match(body.attemptId, PRA_ID_RE);
  assert.equal(body.assistAllowed, true);
  assert.deepEqual(body.exercise.narration, LINES.narration.map(({ id, text }) => ({ id, text })));
  for (const k of Object.keys(body.exercise)) assert.ok(PUBLIC_KEYS.has(k), `exercise.${k} is not in the PublicExercise allow-list`);
  assert.equal(body.exercise.firstPrompt, undefined, 'catch has no firstPrompt');
  noLeak(body, LEAK_ALLOW.other, 'start');
  for (const p of LINES.answerKey.planted) assert.ok(!r.text.includes(p.whyWrong) && !r.text.includes(p.acceptableCorrections[0]), 'answer text in start body');
});

test('US1.2 hit met', { todo: 'F1c-T04' }, async () => {
  const A = await sharedApi();
  const { attemptId } = await begin(A, 'catch-lines');
  const r = await A.stop(attemptId, { statementId: 's3', elapsedMs: 900, answer: A_S3_MET, via: 'button', stopLatencyMs: null });
  const body = ok(r, 'stop s3');
  assert.deepEqual(keys(body), STOP_KEYS);
  assert.equal(body.detection, 'hit');
  assert.equal(body.attributedStatementId, 's3');
  assert.equal(body.assisted, false);
  assert.equal(body.result.explanation.status, 'met');
  assert.equal(body.result.correction.status, 'met');
  assert.equal(body.result.overall, 'met');
  const p = planted('s3');
  assert.deepEqual(body.reveal, { statementId: 's3', misconception: p.misconception, whyWrong: p.whyWrong, exceptions: p.exceptions, correctedText: p.acceptableCorrections[0] });
  noLeak(body, LEAK_ALLOW.stop, 'stop');
  assert.ok(!hasNumber(body.result), 'no numeric score is returned (FR-013)');
});

test('US1.3 false interruption returns nothing about other statements', { todo: 'F1c-T04' }, async () => {
  const A = await sharedApi();
  const { attemptId } = await begin(A, 'catch-lines');
  const r = await A.stop(attemptId, { statementId: 's2', elapsedMs: 3000, answer: 'braided line stretches more', via: 'key', stopLatencyMs: 12 });
  const body = ok(r, 'stop s2');
  assert.deepEqual(body, { statementId: 's2', attributedStatementId: 's2', detection: 'false_interruption', assisted: false, result: null, reveal: null });
  for (const s of ['s3', 's5']) {
    assert.ok(!r.text.includes(`"${s}"`), `body mentions ${s}`);
    assert.ok(!r.text.includes(planted(s).whyWrong), `body carries ${s}'s whyWrong`);
  }
});

test('US1.4 late hit inside 2000 ms; same stop at 2001 ms is a false interruption', { todo: 'F1c-T04' }, async () => {
  const A = await sharedApi();
  for (const [elapsedMs, detection] of [[1500, 'late_hit'], [2000, 'late_hit'], [2001, 'false_interruption'], [0, 'late_hit']]) {
    const { attemptId } = await begin(A, 'catch-lines');
    const body = await stopOk(A, attemptId, { statementId: 's4', elapsedMs, answer: A_S3_MET });
    assert.equal(body.detection, detection, `elapsedMs ${elapsedMs}`);
    assert.equal(body.statementId, 's4');
    assert.equal(body.attributedStatementId, detection === 'late_hit' ? 's3' : 's4', `elapsedMs ${elapsedMs}`);
    if (detection === 'late_hit') {
      assert.equal(body.result.overall, 'met');
      assert.equal(body.reveal.statementId, 's3');
    } else {
      assert.equal(body.result, null);
      assert.equal(body.reveal, null);
    }
  }
  // A previous statement that was already caught is never re-attributed.
  const { attemptId } = await begin(A, 'catch-lines');
  assert.equal((await stopOk(A, attemptId, { statementId: 's3', answer: A_S3_MET })).detection, 'hit');
  const again = await stopOk(A, attemptId, { statementId: 's4', elapsedMs: 500, answer: A_S3_MET });
  assert.equal(again.detection, 'false_interruption');
  assert.equal(again.attributedStatementId, 's4');
});

test('US1.5 valid alternative correction met', { todo: 'F1c-T04' }, async () => {
  const A = await sharedApi();
  const { attemptId } = await begin(A, 'catch-lines');
  const body = await stopOk(A, attemptId, { statementId: 's3', answer: A_S3_ALT });
  assert.equal(body.detection, 'hit');
  assert.equal(body.result.correction.status, 'met', JSON.stringify(body.result));
});

test('US1.6 long unmatched answer is uncertain, flagged in progress', { todo: 'F1c-T08' }, async t => {
  const { A } = await fresh(t);
  const { attemptId } = await begin(A, 'catch-lines');
  const body = await stopOk(A, attemptId, { statementId: 's3', answer: A_LONG });
  assert.equal(body.result.explanation.status, 'uncertain');
  assert.equal(body.result.overall, 'uncertain');
  assert.ok(!hasNumber(body.result), 'no score is shown for an uncertain result');
  const progress = ok(await A.progress(), 'progress');
  assert.deepEqual(progress.flagged.map(({ attemptId: a, exerciseId, part, selfRating }) => ({ a, exerciseId, part, selfRating })),
    [{ a: attemptId, exerciseId: 'catch-lines', part: 'stop:s3', selfRating: null }]);
  const line = progress.concepts.find(c => c.id === 'line-care');
  assert.equal(line.independent.n, 0, 'uncertain is excluded from mastery (FR-052)');
});

test('US1.7 complete reveals missed statements, reference, sources and rubrics; answered stops are self-ratable', { todo: 'F1c-T04' }, async () => {
  const A = await sharedApi();
  const { attemptId } = await begin(A, 'catch-lines');
  await stopOk(A, attemptId, { statementId: 's3', answer: A_S3_MET });
  const done = ok(await A.complete(attemptId, { lastStatementId: 's6' }), 'complete');
  assert.deepEqual(done.summary, { planted: 2, hits: 1, lateHits: 0, misses: 1, falseInterruptions: 0, notReached: 0, cleanPass: false, flagged: 0 });
  const p5 = planted('s5');
  assert.deepEqual(done.missed, [{ statementId: 's5', text: narr(LINES, 's5'), misconception: p5.misconception, whyWrong: p5.whyWrong, exceptions: p5.exceptions, correctedText: p5.acceptableCorrections[0] }]);
  assert.equal(done.answered.length, 1);
  const [a] = done.answered;
  assert.equal(a.part, 'stop:s3');
  assert.equal(a.answer, A_S3_MET);
  assert.equal(a.result.overall, 'met');
  assert.ok(a.result.explanation.matched.length >= 2 && Array.isArray(a.result.explanation.missing));
  assert.deepEqual(a.rubric, planted('s3').rubric);
  assert.deepEqual(a.acceptableCorrections, planted('s3').acceptableCorrections);
  assert.equal(a.selfRating, null);
  assert.deepEqual(done.reference, [{ id: 'lines', text: PACK.references.get('lines') }]);
  assert.deepEqual(done.sources, LINES.sources);
  assert.deepEqual(done.followUp, { question: LINES.followUp, graded: false });
  assert.deepEqual(done.transfer, { scenario: LINES.transfer.scenario });

  const rated = ok(await A.selfRate(attemptId, { part: 'stop:s3', rating: 'had_it' }), 'self-rate');
  assert.deepEqual(rated, { part: 'stop:s3', rating: 'had_it', matcherStatus: 'met' });
  assert.equal((await A.selfRate(attemptId, { part: 'stop:s3', rating: 'great' })).status, 400, 'unknown rating');
});

test('US1.8 zero-planted clean pass', { todo: 'F1c-T04' }, async () => {
  const A = await sharedApi();
  const { attemptId, exercise } = await begin(A, 'catch-clean');
  assert.equal(exercise.narration.length, 4);
  const done = ok(await A.complete(attemptId, { lastStatementId: 's4' }), 'complete');
  assert.deepEqual(done.summary, { planted: 0, hits: 0, lateHits: 0, misses: 0, falseInterruptions: 0, notReached: 0, cleanPass: true, flagged: 0 });
  assert.deepEqual(done.missed, []);
  // A stop on an accurate statement spoils the clean pass.
  const second = await begin(A, 'catch-clean');
  assert.equal((await stopOk(A, second.attemptId, { statementId: 's2', answer: 'it is wrong' })).detection, 'false_interruption');
  const spoiled = ok(await A.complete(second.attemptId, { lastStatementId: 's4' }), 'complete 2');
  assert.equal(spoiled.summary.cleanPass, false);
  assert.equal(spoiled.summary.falseInterruptions, 1);
});

test('US1.9 assisted only after assist', { todo: 'F1c-T04' }, async () => {
  const A = await sharedApi();
  const { attemptId } = await begin(A, 'catch-lines');
  assert.equal((await stopOk(A, attemptId, { statementId: 's3', answer: A_S3_MET })).assisted, false);
  const assist = ok(await A.assist(attemptId), 'assist');
  assert.deepEqual(assist, { assisted: true, reference: [{ id: 'lines', text: PACK.references.get('lines') }] });
  noLeak(assist, LEAK_ALLOW.assist, 'assist');
  assert.equal((await stopOk(A, attemptId, { statementId: 's5', answer: A_S5_NEGATED })).assisted, true);
  const done = ok(await A.complete(attemptId, { lastStatementId: 's6' }), 'complete');
  assert.deepEqual(done.answered.map(x => x.part), ['stop:s3', 'stop:s5']);
});

test('US1.11 negated correction against a negated rubric item is met, not uncertain', { todo: 'F1c-T04' }, async () => {
  const A = await sharedApi();
  const { attemptId } = await begin(A, 'catch-lines');
  const body = await stopOk(A, attemptId, { statementId: 's5', answer: A_S5_NEGATED });
  assert.equal(body.detection, 'hit');
  assert.equal(body.result.correction.status, 'met', JSON.stringify(body.result));
  assert.notEqual(body.result.explanation.status, 'uncertain');
  assert.equal(body.result.overall, 'met');
});

test('US6.3 diagnostic attempt: no assist; only schedule.diagnostic ids; bad mode 400', { todo: 'F1c-T04' }, async () => {
  const A = await sharedApi();
  const diag = await begin(A, 'catch-lines', { mode: 'diagnostic' });
  assert.equal(diag.assistAllowed, false);
  assert.equal((await A.assist(diag.attemptId)).status, 400);
  assert.equal((await A.start('catch-clean', { mode: 'diagnostic' })).status, 400, 'not in schedule.diagnostic');
  // A JSON null for the optional mode is not specified either way (T04: `mode?`), so only clearly bad values are asserted.
  for (const mode of ['exam', 1, 'DIAGNOSTIC']) assert.equal((await A.start('catch-lines', { mode })).status, 400, `mode ${mode}`);
  assert.equal(ok(await A.start('catch-lines', { mode: 'review' }), 'review mode').assistAllowed, true);
});

test('FR-055 tracks list and track detail', { todo: 'F1c-T04' }, async () => {
  const A = await sharedApi();
  const list = ok(await A.tracks(), 'tracks');
  assert.deepEqual(list, [{ id: TRACK, title: 'Kite Craft', version: 1 }]);
  const detail = ok(await A.track(), 'track');
  const m = PACK.manifest.modules[0];
  assert.deepEqual(detail, {
    id: TRACK, title: 'Kite Craft', version: 1,
    modules: [{ id: m.id, title: m.title, exercises: m.exercises.map(id => {
      const e = EX(id);
      return { id, type: e.type, objective: e.objective, difficulty: e.difficulty, concepts: e.concepts, prerequisites: e.prerequisites };
    }) }]
  });
  noLeak(list, LEAK_ALLOW.other, 'tracks');
  noLeak(detail, LEAK_ALLOW.other, 'track');
});

test('FR-050 catch events: one stopped/explained/graded append per stop, completed once, engine practice, self-rated carries part', { todo: 'F1c-T04' }, async t => {
  const { A, dbPath } = await fresh(t, { db: true });
  const { attemptId } = await begin(A, 'catch-lines');
  await stopOk(A, attemptId, { statementId: 's3', answer: A_S3_MET, via: 'voice', stopLatencyMs: 40 });
  await stopOk(A, attemptId, { statementId: 's4', elapsedMs: 5000, answer: 'no' });
  await A.complete(attemptId, { lastStatementId: 's6' });
  await A.complete(attemptId, { lastStatementId: 's6' });
  await A.selfRate(attemptId, { part: 'stop:s3', rating: 'partly' });
  const ev = eventsFor(dbPath, attemptId);
  assert.deepEqual(ev.map(e => e.verb), ['started', 'stopped', 'explained', 'graded', 'stopped', 'explained', 'completed', 'self-rated']);
  const seqs = ev.slice(1, 4).map(e => e.seq);
  assert.deepEqual(seqs, [seqs[0], seqs[0] + 1, seqs[0] + 2], 'one append, in seq order');
  for (const e of ev) {
    assert.equal(e.context.engine, 'practice');
    assert.equal(e.context.subject, `${TRACK}@1`);
    assert.equal(e.context.mode, 'practice');
    assert.equal(e.context.exerciseType, 'catch');
    assert.equal(e.context.module, 'k1');
    assert.equal(e.object.type, 'exercise');
    assert.equal(e.object.id, 'catch-lines');
    assert.equal(e.object.step, undefined);
  }
  const [stopped, , graded] = ev.slice(1, 4);
  assert.deepEqual(stopped.result, { attributedStatementId: 's3', detection: 'hit', elapsedMs: 800, via: 'voice', stopLatencyMs: 40 });
  assert.equal(graded.result.graderSource, 'matcher');
  assert.equal(graded.result.graderVersion, 'matcher@1');
  assert.equal(graded.result.assisted, false);
  assert.equal(graded.result.outcome, 'caught');
  const rated = ev.at(-1);
  assert.equal(rated.object.part, 'stop:s3');
  assert.deepEqual(rated.result, { rating: 'partly', matcherStatus: 'met', graderVersion: 'matcher@1' });
});

test('edge: repeat stop identical body, no new events', { todo: 'F1c-T04' }, async t => {
  const { A, dbPath } = await fresh(t, { db: true });
  const { attemptId } = await begin(A, 'catch-lines');
  const first = await stopOk(A, attemptId, { statementId: 's3', answer: A_S3_MET });
  const n = allEvents(dbPath).length;
  const again = await stopOk(A, attemptId, { statementId: 's3', answer: 'a different answer entirely', elapsedMs: 10 });
  assert.deepEqual(again, first);
  assert.equal(allEvents(dbPath).length, n, 'a repeat writes no events (FR-008)');
});

test('edge: stop after complete 409', { todo: 'F1c-T04' }, async () => {
  const A = await sharedApi();
  const { attemptId } = await begin(A, 'catch-lines');
  ok(await A.complete(attemptId, { lastStatementId: 's2' }), 'complete');
  assert.equal((await A.stop(attemptId, { statementId: 's3', elapsedMs: 100, answer: A_S3_MET })).status, 409);
});

test('edge: att_ id on practice routes 404', { todo: 'F1c-T04' }, async () => {
  const A = await sharedApi();
  for (const id of ['att_01J00000000000000000000000', 'pra_01J00000000000000000000000', 'nope']) {
    for (const [route, body] of [['stops', { statementId: 's1', elapsedMs: 1, answer: 'x' }], ['assist', {}], ['complete', {}],
      ['self-ratings', { part: 'stop:s3', rating: 'had_it' }], ['answers', { part: 'design', answer: 'x' }], ['clarifications', { question: 'x' }]]) {
      const r = await A.post(`/api/practice/attempts/${id}/${route}`, body);
      assert.equal(r.status, 404, `${id} ${route}: ${r.status}`);
      assert.equal(typeof r.json?.error, 'string');
    }
  }
});

test('edge: unknown track, exercise or attempt 404', { todo: 'F1c-T04' }, async () => {
  const A = await sharedApi();
  assert.equal((await A.track('nope')).status, 404);
  assert.equal((await A.track('__proto__')).status, 404);
  assert.equal((await A.post('/api/practice/attempts', { track: 'nope', exercise: 'catch-lines' })).status, 404);
  assert.equal((await A.start('nope')).status, 404);
  assert.equal((await A.start('toString')).status, 404);
});

test('edge: 413 and 400', { todo: 'F1c-T04' }, async () => {
  const A = await sharedApi();
  const { attemptId } = await begin(A, 'catch-lines');
  for (const p of ['/api/practice/attempts', `/api/practice/attempts/${attemptId}/stops`]) {
    assert.equal((await A.post(p, '{"track":')).status, 400, `${p} bad JSON`);
    assert.equal((await A.post(p, JSON.stringify({ answer: 'x'.repeat(1024 * 1024 + 10) }))).status, 413, `${p} over 1 MB`);
  }
  for (const body of [[], 'null', '"x"', { track: 1, exercise: {} }]) {
    const s = (await A.post('/api/practice/attempts', body)).status;
    assert.ok(s === 400 || s === 404, `start ${JSON.stringify(body)}: ${s}`);
  }
  assert.equal((await A.tracks()).status, 200, 'server still up');
});

test('edge: stop on an unknown statement, an earlier statement or a non-catch attempt is 400', { todo: 'F1c-T04' }, async () => {
  const A = await sharedApi();
  const { attemptId } = await begin(A, 'catch-lines');
  assert.equal((await A.stop(attemptId, { statementId: 'zz', elapsedMs: 1, answer: 'x' })).status, 400);
  assert.equal((await A.stop(attemptId, { statementId: { id: 's3' }, elapsedMs: 1, answer: 'x' })).status, 400);
  await stopOk(A, attemptId, { statementId: 's5', answer: A_S5_NEGATED });
  assert.equal((await A.stop(attemptId, { statementId: 's3', elapsedMs: 1, answer: A_S3_MET })).status, 400, 'backwards stop');
  const learn = await begin(A, 'learn-wind');
  assert.equal((await A.stop(learn.attemptId, { statementId: 's1', elapsedMs: 1, answer: 'x' })).status, 400, 'US3.2: no stops in learn');
});

test('edge: empty answer is not_met; an answer over 2000 chars is truncated and chars keeps its length', { todo: 'F1c-T04' }, async t => {
  const { A, dbPath } = await fresh(t, { db: true });
  const one = await begin(A, 'catch-lines');
  const empty = await stopOk(A, one.attemptId, { statementId: 's3', answer: '' });
  assert.equal(empty.detection, 'hit');
  assert.deepEqual([empty.result.explanation.status, empty.result.correction.status, empty.result.overall], ['not_met', 'not_met', 'not_met']);
  const two = await begin(A, 'catch-lines');
  const long = `${A_S3_MET} ${'x'.repeat(2600)}`;
  await stopOk(A, two.attemptId, { statementId: 's3', answer: long });
  const explained = eventsFor(dbPath, two.attemptId).find(e => e.verb === 'explained');
  assert.equal(explained.result.text.length, 2000);
  assert.equal(explained.result.chars, long.length);
});

test('edge: elapsedMs missing, negative or non-integer gives no grace attribution', { todo: 'F1c-T04' }, async () => {
  const A = await sharedApi();
  for (const elapsedMs of [undefined, -5, 1.5, '100', null]) {
    const { attemptId } = await begin(A, 'catch-lines');
    const r = await A.stop(attemptId, { statementId: 's4', elapsedMs, answer: A_S3_MET, via: 'button', stopLatencyMs: null });
    assert.equal(ok(r, `elapsedMs ${elapsedMs}`).detection, 'false_interruption', `elapsedMs ${JSON.stringify(elapsedMs)}`);
  }
  // Grace only applies when the previous statement is planted: s1 is clean.
  const { attemptId } = await begin(A, 'catch-lines');
  assert.equal((await stopOk(A, attemptId, { statementId: 's2', elapsedMs: 300, answer: 'x y z' })).detection, 'false_interruption');
});

test('edge: early complete: planted statements after lastStatementId are notReached, not missed', { todo: 'F1c-T04' }, async () => {
  const A = await sharedApi();
  const { attemptId } = await begin(A, 'catch-lines');
  const done = ok(await A.complete(attemptId, { lastStatementId: 's4' }), 'complete');
  assert.deepEqual(done.missed.map(m => m.statementId), ['s3']);
  assert.equal(done.summary.misses, 1);
  assert.equal(done.summary.notReached, 1);
  assert.equal(done.summary.cleanPass, false);
});

test('edge: complete is idempotent and writes completed once', { todo: 'F1c-T04' }, async t => {
  const { A, dbPath } = await fresh(t, { db: true });
  const { attemptId } = await begin(A, 'catch-lines');
  await stopOk(A, attemptId, { statementId: 's3', answer: A_S3_MET });
  const first = ok(await A.complete(attemptId, { lastStatementId: 's6' }), 'complete 1');
  const second = ok(await A.complete(attemptId, { lastStatementId: 's6' }), 'complete 2');
  assert.deepEqual(second, first);
  assert.equal(eventsFor(dbPath, attemptId).filter(e => e.verb === 'completed').length, 1);
});

test('edge: self-rating before complete, or for a part with no answer, is 400', { todo: 'F1c-T04' }, async () => {
  const A = await sharedApi();
  const { attemptId } = await begin(A, 'catch-lines');
  await stopOk(A, attemptId, { statementId: 's3', answer: A_S3_MET });
  assert.equal((await A.selfRate(attemptId, { part: 'stop:s3', rating: 'had_it' })).status, 400, 'before complete');
  ok(await A.complete(attemptId, { lastStatementId: 's6' }), 'complete');
  assert.equal((await A.selfRate(attemptId, { part: 'stop:s5', rating: 'missed_it' })).status, 400, 'a miss has no answer');
  assert.equal((await A.selfRate(attemptId, { part: 'stop:zz', rating: 'had_it' })).status, 400, 'unknown part');
});

test('edge: assist is idempotent: same reference, one assisted event', { todo: 'F1c-T04' }, async t => {
  const { A, dbPath } = await fresh(t, { db: true });
  const { attemptId } = await begin(A, 'catch-lines');
  const one = ok(await A.assist(attemptId), 'assist 1');
  const two = ok(await A.assist(attemptId), 'assist 2');
  assert.deepEqual(two, one);
  const assisted = eventsFor(dbPath, attemptId).filter(e => e.verb === 'assisted');
  assert.equal(assisted.length, 1);
  assert.deepEqual(assisted[0].result, { kind: 'reference' });
});

test('edge: invalid practice pack: server up, one [practice] warning, tracks omit it, no [packs] warning', { todo: 'F1c-T04' }, async t => {
  const dir = mkdtempSync(path.join(tmpdir(), 'f1c-badpack-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  cpSync(ACCEPT_PACK_DIR, path.join(dir, 'kite-craft'), { recursive: true });
  mkdirSync(path.join(dir, 'broken'));
  writeFileSync(path.join(dir, 'broken', 'practice.json'), '{"format": "practice-v1", "id": ');
  const { srv, A } = await fresh(t, { packsDir: dir });
  assert.deepEqual(ok(await A.tracks(), 'tracks').map(x => x.id), [TRACK]);
  const out = srv.output();
  assert.equal(out.split('\n').filter(l => l.startsWith('[practice]')).length, 1, out);
  assert.ok(!out.includes('[packs]'), out);
  assert.ok(srv.alive());
});

// =============================================================================================
// F1c-T07: learn, interview, scenario, follow-up and transfer (US3–US5)
// =============================================================================================

test('US3.3 learn: each answer returns the next question and no result; results arrive at complete', { todo: 'F1c-T07' }, async () => {
  const A = await sharedApi();
  const ex = EX('learn-wind');
  const start = await begin(A, 'learn-wind');
  assert.deepEqual(start.exercise.firstPrompt, { part: 'teachBack:0', prompt: ex.teachBack[0].question });
  assert.deepEqual(start.exercise.narration, ex.narration);
  const a0 = ok(await A.answer(start.attemptId, { part: 'teachBack:0', answer: 'Steady wind gives even lift, but gusts cause dives and sudden drops that are hard to control.' }), 'teachBack:0');
  assert.deepEqual(a0, { part: 'teachBack:0', next: { part: 'teachBack:1', prompt: ex.teachBack[1].question } });
  const a1 = ok(await A.answer(start.attemptId, { part: 'teachBack:1', answer: 'Find an open space to stand in.' }), 'teachBack:1');
  assert.deepEqual(a1, { part: 'teachBack:1', next: null });
  const done = ok(await A.complete(start.attemptId), 'complete');
  assert.deepEqual(done.answered.map(x => x.part), ['teachBack:0', 'teachBack:1']);
  assert.deepEqual(done.answered.map(x => statusOf(x.result, 'explanation')), ['met', 'partial']);
  assert.deepEqual(done.answered.map(x => x.rubric), ex.teachBack.map(q => q.rubric));
  assert.deepEqual(done.reference, [{ id: 'wind', text: PACK.references.get('wind') }]);
});

test('edge: learn teach-back out of order 400; repeat returns the stored body', { todo: 'F1c-T07' }, async () => {
  const A = await sharedApi();
  const { attemptId } = await begin(A, 'learn-wind');
  assert.equal((await A.answer(attemptId, { part: 'teachBack:1', answer: 'open space' })).status, 400);
  assert.equal((await A.answer(attemptId, { part: 'design', answer: 'x' })).status, 400, 'a part of another type');
  const first = ok(await A.answer(attemptId, { part: 'teachBack:0', answer: 'even lift' }), 'first');
  assert.deepEqual(ok(await A.answer(attemptId, { part: 'teachBack:0', answer: 'something else' }), 'repeat'), first);
});

test('US3.4 follow-up and transfer only after complete, each with its result and rubric', { todo: 'F1c-T07' }, async () => {
  const A = await sharedApi();
  const ex = EX('learn-wind');
  const { attemptId } = await begin(A, 'learn-wind');
  assert.equal((await A.answer(attemptId, { part: 'followUp', answer: 'fewer flying days' })).status, 400, 'followUp before complete');
  assert.equal((await A.answer(attemptId, { part: 'transfer', answer: 'wind direction' })).status, 400, 'transfer before complete');
  await A.answer(attemptId, { part: 'teachBack:0', answer: 'even lift and sudden drops' });
  await A.answer(attemptId, { part: 'teachBack:1', answer: 'open space with the wind at your back' });
  ok(await A.complete(attemptId), 'complete');
  const fu = ok(await A.answer(attemptId, { part: 'followUp', answer: 'You get fewer flying days and need special kites for light wind.' }), 'followUp');
  assert.equal(fu.part, 'followUp');
  assert.deepEqual(fu.rubric, ex.followUp.rubric);
  assert.equal(fu.result.status, 'met');
  const tr = ok(await A.answer(attemptId, { part: 'transfer', answer: 'Check which way the wind blows off the water, and expect a steady sea breeze that keeps the kite up all afternoon.' }), 'transfer');
  assert.deepEqual(tr.rubric, ex.transfer.rubric);
  assert.equal(tr.result.status, 'met');
});

test('US4.1 interview: the question first, then each follow-up as next.prompt, no grading until complete', { todo: 'F1c-T07' }, async () => {
  const A = await sharedApi();
  const ex = EX('interview-launch');
  const start = await begin(A, 'interview-launch');
  assert.deepEqual(start.exercise.firstPrompt, { part: 'interview', prompt: ex.question });
  const a = ok(await A.answer(start.attemptId, { part: 'interview', answer: A_INTERVIEW_MET }), 'interview');
  assert.deepEqual(a, { part: 'interview', next: { part: 'followUps:0', prompt: ex.followUps[0].question } });
  const b = ok(await A.answer(start.attemptId, { part: 'followUps:0', answer: 'Let the line go slack and turn away from people.' }), 'followUps:0');
  assert.deepEqual(b, { part: 'followUps:0', next: { part: 'followUps:1', prompt: ex.followUps[1] } });
  const c = ok(await A.answer(start.attemptId, { part: 'followUps:1', answer: 'Use a smaller kite.' }), 'followUps:1');
  assert.deepEqual(c, { part: 'followUps:1', next: null });
  for (const body of [start, a, b, c]) noLeak(body, LEAK_ALLOW.other, 'interview pre-complete');
});

test('US4.2 an asserted red flag makes the dimension uncertain and is listed at reveal', { todo: 'F1c-T07' }, async () => {
  const A = await sharedApi();
  const { attemptId } = await begin(A, 'interview-launch');
  await A.answer(attemptId, { part: 'interview', answer: A_INTERVIEW_FLAG });
  const done = ok(await A.complete(attemptId), 'complete');
  assert.equal(statusOf(done.answered.find(x => x.part === 'interview').result, 'explanation'), 'uncertain');
  assert.deepEqual(done.redFlagsMatched, ['sprint downwind']);
  assert.deepEqual(done.rubricFull, EX('interview-launch').rubric);
});

test('US4.3 a rejected red flag is not counted', { todo: 'F1c-T07' }, async () => {
  const A = await sharedApi();
  const { attemptId } = await begin(A, 'interview-launch');
  await A.answer(attemptId, { part: 'interview', answer: A_INTERVIEW_REJECTS });
  const done = ok(await A.complete(attemptId), 'complete');
  assert.deepEqual(done.redFlagsMatched, []);
  assert.equal(statusOf(done.answered.find(x => x.part === 'interview').result, 'explanation'), 'met');
});

test('US4.4 string follow-up result null, self-ratable', { todo: 'F1c-T07' }, async () => {
  const A = await sharedApi();
  const { attemptId } = await begin(A, 'interview-launch');
  await A.answer(attemptId, { part: 'interview', answer: A_INTERVIEW_MET });
  await A.answer(attemptId, { part: 'followUps:0', answer: 'Let the line go slack and turn away from people so it lands safely.' });
  await A.answer(attemptId, { part: 'followUps:1', answer: 'I would fly a smaller kite with a stronger line.' });
  const done = ok(await A.complete(attemptId), 'complete');
  const byPart = Object.fromEntries(done.answered.map(x => [x.part, x]));
  assert.equal(byPart['followUps:1'].result, null);
  assert.equal(byPart['followUps:1'].rubric, null);
  assert.equal(statusOf(byPart['followUps:0'].result, 'defense'), 'met');
  assert.deepEqual(ok(await A.selfRate(attemptId, { part: 'followUps:1', rating: 'partly' }), 'rate'), { part: 'followUps:1', rating: 'partly', matcherStatus: null });
  // The common follow-up is a string too: stored, result null.
  assert.deepEqual(ok(await A.answer(attemptId, { part: 'followUp', answer: 'The wind could change.' }), 'followUp'), { part: 'followUp', result: null, rubric: null });
});

test('US5.1 a matching clarification is revealed; asking again repeats it and writes one more clarified', { todo: 'F1c-T07' }, async t => {
  const { A, dbPath } = await fresh(t, { db: true });
  const ex = EX('scenario-festival');
  const start = await begin(A, 'scenario-festival');
  assert.equal(start.exercise.brief, ex.brief);
  assert.deepEqual(start.exercise.constraints, ex.constraints);
  assert.equal(start.exercise.firstPrompt, undefined);
  const one = ok(await A.clarify(start.attemptId, { question: 'What does the weather look like?' }), 'clarify 1');
  assert.deepEqual(one, { reveal: ex.clarifications[0].reveal });
  noLeak(one, LEAK_ALLOW.clarification, 'clarification');
  assert.deepEqual(ok(await A.clarify(start.attemptId, { question: 'What does the weather look like?' }), 'clarify 2'), one);
  assert.deepEqual(ok(await A.clarify(start.attemptId, { question: 'Is there parking for staff?' }), 'clarify none'), { reveal: null });
  const clarified = eventsFor(dbPath, start.attemptId).filter(e => e.verb === 'clarified');
  assert.deepEqual(clarified.map(e => e.result.revealIndex), [0, 0, null]);
  assert.equal(clarified[0].result.text, 'What does the weather look like?');
});

test('edge: clarification after design, or on a non-scenario attempt, is 400', { todo: 'F1c-T07' }, async () => {
  const A = await sharedApi();
  const { attemptId } = await begin(A, 'scenario-festival');
  ok(await A.answer(attemptId, { part: 'design', answer: A_DESIGN_MET }), 'design');
  assert.equal((await A.clarify(attemptId, { question: 'weather?' })).status, 400);
  const learn = await begin(A, 'learn-wind');
  assert.equal((await A.clarify(learn.attemptId, { question: 'weather?' })).status, 400);
});

test('US5.2 a design matching no mustInclude set is at most partial; a long unmatched design is uncertain', { todo: 'F1c-T07' }, async () => {
  const A = await sharedApi();
  const one = await begin(A, 'scenario-workshop');
  await A.answer(one.attemptId, { part: 'design', answer: A_WORKSHOP_NO_ARCH });
  const d1 = ok(await A.complete(one.attemptId), 'complete 1');
  assert.ok(['partial', 'not_met'].includes(statusOf(d1.answered.find(x => x.part === 'design').result, 'explanation')));
  assert.equal(d1.architectureId ?? null, null);
  const two = await begin(A, 'scenario-workshop');
  await A.answer(two.attemptId, { part: 'design', answer: A_LONG });
  const d2 = ok(await A.complete(two.attemptId), 'complete 2');
  assert.equal(statusOf(d2.answered.find(x => x.part === 'design').result, 'explanation'), 'uncertain');
});

test('US5.3 no mustInclude: design equals mustCover', { todo: 'F1c-T07' }, async () => {
  const A = await sharedApi();
  const ex = EX('scenario-festival');
  for (const [answer, status] of [[A_DESIGN_MET, 'met'], [A_DESIGN_PARTIAL, 'partial']]) {
    const { attemptId } = await begin(A, 'scenario-festival');
    const d = ok(await A.answer(attemptId, { part: 'design', answer }), 'design');
    assert.deepEqual(d, { part: 'design', next: { part: 'challenges:0', prompt: ex.challenges[0].question } });
    const done = ok(await A.complete(attemptId), 'complete');
    assert.equal(statusOf(done.answered.find(x => x.part === 'design').result, 'explanation'), status, answer);
    assert.deepEqual(done.architectures, ex.acceptableArchitectures.map(({ id, summary, strengths, tradeoffs }) => ({ id, summary, strengths, tradeoffs })));
  }
});

test('SC-001b leak scan over learn, interview and scenario responses before complete', { todo: 'F1c-T07' }, async () => {
  const A = await sharedApi();
  const seen = [];
  const scan = (r, kind, label) => { const b = ok(r, label); seen.push(label); noLeak(b, LEAK_ALLOW[kind], label); return b; };
  const learn = scan(await A.start('learn-wind'), 'other', 'start learn');
  scan(await A.answer(learn.attemptId, { part: 'teachBack:0', answer: 'even lift' }), 'other', 'teachBack:0');
  scan(await A.answer(learn.attemptId, { part: 'teachBack:1', answer: 'open space' }), 'other', 'teachBack:1');
  const iv = scan(await A.start('interview-launch'), 'other', 'start interview');
  scan(await A.answer(iv.attemptId, { part: 'interview', answer: A_INTERVIEW_FLAG }), 'other', 'interview');
  scan(await A.answer(iv.attemptId, { part: 'followUps:0', answer: 'let it go slack' }), 'other', 'followUps:0');
  for (const id of ['scenario-festival', 'scenario-workshop']) {
    const sc = scan(await A.start(id), 'other', `start ${id}`);
    scan(await A.clarify(sc.attemptId, { question: 'weather and budget and age?' }), 'clarification', `clarify ${id}`);
    scan(await A.clarify(sc.attemptId, { question: 'nothing relevant' }), 'clarification', `clarify none ${id}`);
    scan(await A.answer(sc.attemptId, { part: 'design', answer: A_DESIGN_MET }), 'other', `design ${id}`);
    scan(await A.answer(sc.attemptId, { part: 'challenges:0', answer: A_CH0_MET }), 'other', `challenges:0 ${id}`);
  }
  assert.equal(seen.length, 15);
});

// =============================================================================================
// F1c-T08: progress, schedule, review, diagnostic (US6, SC-001, SC-009)
// =============================================================================================

test('US6.1 no practice events: day 1, diagnostic first, provisional, nothing done', { todo: 'F1c-T08' }, async t => {
  const { A } = await fresh(t);
  const s = ok(await A.schedule(), 'schedule');
  noLeak(s, LEAK_ALLOW.schedule, 'schedule');
  const src = PACK.schedule;
  assert.deepEqual(s, {
    days: src.days, minutesPerDay: src.minutesPerDay, today: 1,
    diagnostic: src.diagnostic.map(id => ({ id, done: false })),
    plan: src.plan.map(d => ({ day: d.day, blocks: d.blocks.map(b => ({ kind: b.kind, minutes: b.minutes, exercises: (b.exercises ?? []).map(id => ({ id, done: false })) })) }))
  });
  assert.equal(s.plan[0].blocks[0].kind, 'diagnostic');
  const p = ok(await A.progress(), 'progress');
  noLeak(p, LEAK_ALLOW.progress, 'progress');
  assert.equal(p.provisional, true, 'US6.5');
  assert.deepEqual(p.concepts.map(c => c.id).sort(), ['launching', 'line-care', 'site-planning', 'wind-reading']);
  for (const c of p.concepts) {
    assert.deepEqual(c.independent, { score: null, n: 0, level: 'none' });
    assert.deepEqual(c.assisted, { score: null, n: 0, level: 'none' });
  }
  assert.deepEqual(p.flagged, []);
  assert.deepEqual(p.counts, { attempts: 0, completed: 0, falseInterruptions: 0, outOfVersion: 0 });
  assert.deepEqual(ok(await A.review(), 'review'), { items: [] }, 'US6.4: no review items');
});

test('US6.2 assisted and independent never merge', { todo: 'F1c-T08' }, async t => {
  const { A } = await fresh(t);
  const one = await begin(A, 'catch-lines');
  assert.equal((await stopOk(A, one.attemptId, { statementId: 's3', answer: A_S3_WRONG })).result.overall, 'not_met');
  const two = await begin(A, 'catch-lines');
  ok(await A.assist(two.attemptId), 'assist');
  assert.equal((await stopOk(A, two.attemptId, { statementId: 's3', answer: A_S3_MET })).result.overall, 'met');
  const line = ok(await A.progress(), 'progress').concepts.find(c => c.id === 'line-care');
  assert.equal(line.independent.score, 0);
  assert.equal(line.independent.n, 1);
  assert.equal(line.assisted.score, 1);
  assert.equal(line.assisted.n, 1);
});

test('US6.4 review picks the weakest independent concept and its least recently attempted exercise', { todo: 'F1c-T08' }, async t => {
  const { A } = await fresh(t);
  const clean = await begin(A, 'catch-clean');
  ok(await A.complete(clean.attemptId, { lastStatementId: 's4' }), 'clean');
  const lines = await begin(A, 'catch-lines');
  await stopOk(A, lines.attemptId, { statementId: 's3', answer: A_S3_WRONG });
  const fest = await begin(A, 'scenario-festival');
  ok(await A.answer(fest.attemptId, { part: 'design', answer: A_DESIGN_MET }), 'design');
  const r = ok(await A.review(), 'review');
  noLeak(r, LEAK_ALLOW.other, 'review');
  assert.deepEqual(r.items.map(i => i.concept), ['line-care', 'site-planning']);
  assert.deepEqual(r.items[0], { concept: 'line-care', score: 0, exerciseId: 'catch-clean' });
  assert.equal(r.items[1].score, 1);
});

test('US6.6 diagnostic ids report done once a diagnostic attempt completes', { todo: 'F1c-T08' }, async t => {
  const { A } = await fresh(t);
  const d = await begin(A, 'catch-lines', { mode: 'diagnostic' });
  ok(await A.complete(d.attemptId, { lastStatementId: 's6' }), 'complete');
  const s = ok(await A.schedule(), 'schedule');
  assert.deepEqual(s.diagnostic, [{ id: 'catch-lines', done: true }, { id: 'interview-launch', done: false }]);
  assert.deepEqual(s.plan[0].blocks[2].exercises, [{ id: 'catch-lines', done: true }, { id: 'catch-clean', done: false }]);
  assert.equal(s.today, 1);
});

test('US6.7 readiness from scenario challenges; n/a with string follow-ups only', { todo: 'F1c-T08' }, async t => {
  const { A } = await fresh(t);
  const f = await begin(A, 'scenario-festival');
  ok(await A.answer(f.attemptId, { part: 'design', answer: A_DESIGN_MET }), 'design');
  ok(await A.answer(f.attemptId, { part: 'challenges:0', answer: A_CH0_MET }), 'challenges:0');
  ok(await A.answer(f.attemptId, { part: 'challenges:1', answer: A_CH1_MET }), 'challenges:1');
  ok(await A.complete(f.attemptId), 'complete');
  const p = ok(await A.progress(), 'progress');
  noLeak(p, LEAK_ALLOW.progress, 'progress');
  const c = id => p.concepts.find(x => x.id === id).readiness;
  assert.equal(c('site-planning').failureModesTradeoffs, true);
  assert.equal(c('site-planning').defendDecision, true);
  assert.equal(c('site-planning').explainUnaided, true);
  assert.equal(c('line-care').failureModesTradeoffs, 'n/a');
  assert.equal(c('line-care').defendDecision, 'n/a');
  assert.equal(c('launching').failureModesTradeoffs, 'n/a', 'one gradable defense part is < 2 (FR-054)');
  assert.equal(c('launching').defendDecision, false);
});

test('edge: repeat self-ratings append and the latest wins in flagged', { todo: 'F1c-T08' }, async t => {
  const { A, dbPath } = await fresh(t, { db: true });
  const { attemptId } = await begin(A, 'catch-lines');
  await stopOk(A, attemptId, { statementId: 's3', answer: A_LONG });
  ok(await A.complete(attemptId, { lastStatementId: 's6' }), 'complete');
  ok(await A.selfRate(attemptId, { part: 'stop:s3', rating: 'had_it' }), 'rate 1');
  ok(await A.selfRate(attemptId, { part: 'stop:s3', rating: 'missed_it' }), 'rate 2');
  assert.equal(eventsFor(dbPath, attemptId).filter(e => e.verb === 'self-rated').length, 2);
  const p = ok(await A.progress(), 'progress');
  assert.deepEqual(p.flagged.map(f => [f.part, f.selfRating]), [['stop:s3', 'missed_it']]);
});

test('edge: pack version bump: events for exercises absent from the new version are excluded and counted', { todo: 'F1c-T08' }, async t => {
  const tmp = tempDbPath();
  const dir = mkdtempSync(path.join(tmpdir(), 'f1c-v2-'));
  t.after(() => { tmp.cleanup(); rmSync(dir, { recursive: true, force: true }); });
  const v1 = await startPractice({ dbPath: tmp.dbPath });
  try {
    const A = api(v1.url);
    const { attemptId } = await begin(A, 'catch-lines');
    await stopOk(A, attemptId, { statementId: 's3', answer: A_S3_MET });
  } finally { await v1.stop(); }
  // v2: catch-lines removed from the manifest, the schedule and the folder.
  const v2dir = path.join(dir, TRACK);
  cpSync(ACCEPT_PACK_DIR, v2dir, { recursive: true });
  rmSync(path.join(v2dir, 'exercises', 'catch-lines.json'));
  const m = JSON.parse(readFileSync(path.join(v2dir, 'practice.json'), 'utf8'));
  m.version = 2;
  m.modules[0].exercises = m.modules[0].exercises.filter(id => id !== 'catch-lines');
  writeFileSync(path.join(v2dir, 'practice.json'), JSON.stringify(m));
  const s = JSON.parse(readFileSync(path.join(v2dir, 'schedule.json'), 'utf8'));
  s.diagnostic = ['interview-launch'];
  for (const d of s.plan) for (const b of d.blocks) if (b.exercises) b.exercises = b.exercises.filter(id => id !== 'catch-lines');
  writeFileSync(path.join(v2dir, 'schedule.json'), JSON.stringify(s));
  const v2 = await startPractice({ dbPath: tmp.dbPath, packsDir: dir });
  t.after(() => v2.stop());
  assert.deepEqual(ok(await api(v2.url).tracks(), 'tracks'), [{ id: TRACK, title: 'Kite Craft', version: 2 }]);
  const p = ok(await api(v2.url).progress(), 'progress');
  assert.equal(p.concepts.find(c => c.id === 'line-care').independent.n, 0);
  assert.ok(p.counts.outOfVersion >= 1, JSON.stringify(p.counts));
});

test('SC-001 leak scan over every pre-complete response and the tracks, schedule, progress and review routes', { todo: 'F1c-T08' }, async t => {
  const { A } = await fresh(t);
  const seen = [];
  const scan = (r, kind, label) => { const b = ok(r, label); seen.push(label); noLeak(b, LEAK_ALLOW[kind], label); return b; };
  const routes = async when => {
    scan(await A.tracks(), 'other', `${when} tracks`);
    scan(await A.track(), 'other', `${when} track`);
    scan(await A.schedule(), 'schedule', `${when} schedule`);
    scan(await A.progress(), 'progress', `${when} progress`);
    scan(await A.review(), 'other', `${when} review`);
  };
  await routes('before');
  for (const mode of ['practice', 'diagnostic', 'review']) {
    const st = scan(await A.start('catch-lines', { mode }), 'other', `start ${mode}`);
    scan(await A.stop(st.attemptId, { statementId: 's2', elapsedMs: 3000, answer: 'x y z', via: 'key', stopLatencyMs: 5 }), 'stop', `false stop ${mode}`);
    scan(await A.stop(st.attemptId, { statementId: 's3', elapsedMs: 100, answer: A_S3_MET, via: 'key', stopLatencyMs: 5 }), 'stop', `hit ${mode}`);
    scan(await A.stop(st.attemptId, { statementId: 's3', elapsedMs: 100, answer: A_S3_MET, via: 'key', stopLatencyMs: 5 }), 'stop', `repeat ${mode}`);
    if (mode !== 'diagnostic') scan(await A.assist(st.attemptId), 'assist', `assist ${mode}`);
    scan(await A.stop(st.attemptId, { statementId: 's5', elapsedMs: 100, answer: A_LONG, via: 'key', stopLatencyMs: 5 }), 'stop', `uncertain ${mode}`);
    ok(await A.complete(st.attemptId, { lastStatementId: 's6' }), 'complete'); // the reveal: not scanned (FR-004)
  }
  const clean = scan(await A.start('catch-clean'), 'other', 'start clean');
  ok(await A.complete(clean.attemptId, { lastStatementId: 's4' }), 'complete clean');
  await routes('after');
  assert.equal(seen.length, 10 + 3 * 4 + 2 + 1);
});

test('SC-009 progress identical after restart', { todo: 'F1c-T08' }, async t => {
  const tmp = tempDbPath();
  t.after(() => tmp.cleanup());
  let attemptC;
  const s1 = await startPractice({ dbPath: tmp.dbPath });
  let before;
  try {
    const A = api(s1.url);
    const a = await begin(A, 'catch-lines');
    await stopOk(A, a.attemptId, { statementId: 's3', answer: A_S3_MET });
    ok(await A.complete(a.attemptId, { lastStatementId: 's6' }), 'complete A'); // s5 missed: detection 0
    const b = await begin(A, 'catch-clean');
    ok(await A.complete(b.attemptId, { lastStatementId: 's4' }), 'complete B');
    const c = await begin(A, 'catch-lines');
    attemptC = c.attemptId;
    ok(await A.assist(c.attemptId), 'assist C');
    await stopOk(A, c.attemptId, { statementId: 's3', answer: A_S3_PARTIAL });
    await stopOk(A, c.attemptId, { statementId: 's5', answer: A_LONG });
    ok(await A.complete(c.attemptId, { lastStatementId: 's6' }), 'complete C');
    before = ok(await A.progress(), 'progress before');
  } finally { await s1.stop(); }
  const s2 = await startPractice({ dbPath: tmp.dbPath });
  t.after(() => s2.stop());
  const afterRestart = ok(await api(s2.url).progress(), 'progress after');
  assert.deepEqual(afterRestart, before, 'identical after restart');

  // The frozen body, from spec FR-051–FR-054 (concepts compared in id order; `at` is the stop's event time).
  const s5Times = eventsFor(tmp.dbPath, attemptC).filter(e => e.object.statement === 's5').map(e => e.at);
  const body = structuredClone(before);
  assert.ok(s5Times.includes(body.flagged?.[0]?.at), `flagged[0].at ${body.flagged?.[0]?.at} is the s5 stop's time`);
  body.flagged[0].at = '<s5 stop>';
  body.concepts.sort((x, y) => x.id.localeCompare(y.id));
  const none = { score: null, n: 0, level: 'none' };
  assert.deepEqual(body, {
    track: TRACK, provisional: true,
    concepts: [
      { id: 'launching', independent: none, assisted: none,
        readiness: { explainUnaided: false, detectAndCorrect: 'n/a', transfer: false, failureModesTradeoffs: 'n/a', defendDecision: false } },
      { id: 'line-care', independent: { score: 0.5, n: 2, level: 'learning' }, assisted: { score: 0.5, n: 1, level: 'learning' },
        readiness: { explainUnaided: 'n/a', detectAndCorrect: false, transfer: false, failureModesTradeoffs: 'n/a', defendDecision: 'n/a' } },
      { id: 'site-planning', independent: none, assisted: none,
        readiness: { explainUnaided: false, detectAndCorrect: 'n/a', transfer: false, failureModesTradeoffs: false, defendDecision: false } },
      { id: 'wind-reading', independent: none, assisted: none,
        readiness: { explainUnaided: 'n/a', detectAndCorrect: 'n/a', transfer: false, failureModesTradeoffs: false, defendDecision: 'n/a' } }
    ],
    flagged: [{ attemptId: attemptC, exerciseId: 'catch-lines', part: 'stop:s5', at: '<s5 stop>', selfRating: null }],
    counts: { attempts: 3, completed: 3, falseInterruptions: 0, outOfVersion: 0 }
  });
});
