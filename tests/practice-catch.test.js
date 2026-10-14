// F1c-T04: catch attempt API, events and wiring (ADR 0008, ADR 0002 Amendment 3; spec FR-004–FR-016,
// FR-023, FR-050). In-process service on a :memory: DB, plus one spawned-server HTTP smoke test.

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from '../server/db.js';
import { validateEvent } from '../shared/events.js';
import { loadPacks, listSubjects } from '../server/packs.js';
import { loadPracticePacks } from '../server/services/practice-pack.js';
import { createPracticeService, projectPracticeAttempt, trackSummary, GRACE_MS } from '../server/services/practice.js';
import { startServer } from './helpers/server.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const BASIC = path.join(HERE, 'fixtures', 'practice', 'pack-basic');
const noPacks = { getPack: () => null };
const TRACK = 'moonberry';
const GOOD = 'Water drops in strong light make the leaves scorch; water at dusk instead.';

// FR-004 keys that must never appear before grading (the start response has no exceptions).
const HIDDEN = ['answerKey', 'planted', 'clean', 'misconception', 'whyWrong', 'acceptableCorrections', 'exceptions',
  'kind', 'rubric', 'explain', 'correct', 'mustCover', 'strongSignals', 'redFlags', 'clarifications', 'askAbout',
  'reveal', 'acceptableArchitectures', 'mustInclude', 'strengths', 'tradeoffs', 'challenges', 'followUps',
  'followUp', 'transfer', 'reference', 'sources', 'note', 'correctedText'];
function hiddenKeys(v, out = []) {
  if (Array.isArray(v)) v.forEach(x => hiddenKeys(x, out));
  else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) {
      if (HIDDEN.includes(k)) out.push(k);
      hiddenKeys(x, out);
    }
  }
  return out;
}

let packsDir;
before(() => {
  packsDir = mkdtempSync(path.join(tmpdir(), 'f1c-t04-'));
  cpSync(BASIC, path.join(packsDir, 'pack-basic'), { recursive: true });
});
after(() => rmSync(packsDir, { recursive: true, force: true }));

// A fresh DB and service per test. Every appendEvents call is recorded, so "one append" is observable.
function setup(opts = {}) {
  const db = openDb(':memory:');
  loadPracticePacks(packsDir, db, noPacks);
  const appends = [];
  const spyDb = { ...db, appendEvents(events) { appends.push(events.map(e => e.verb)); return db.appendEvents(events); } };
  const svc = createPracticeService({ db: spyDb, ...opts });
  return { db, svc, appends, events: id => db.eventsForAttempt(id) };
}

const status = fn => {
  try { fn(); } catch (e) { return e.status; }
  return 200;
};

describe('catch attempts (service)', () => {
  test('start returns narration only and writes started (no hidden key)', () => {
    const { svc, events } = setup();
    const body = svc.startAttempt({ track: TRACK, exercise: 'catch-watering' });
    assert.match(body.attemptId, /^pra_[0-9A-HJKMNP-TV-Z]{26}$/);
    assert.equal(body.assistAllowed, true);
    assert.deepEqual(body.exercise.narration.map(n => n.id), ['s1', 's2', 's3']);
    assert.deepEqual(hiddenKeys(body), []);
    const [e] = events(body.attemptId);
    assert.equal(e.verb, 'started');
    assert.deepEqual(e.result, { assistAllowed: true });
    assert.deepEqual(e.object, { type: 'exercise', id: 'catch-watering' });
  });

  test('start: unknown track or exercise 404; bad mode 400; diagnostic outside schedule 400', () => {
    const { svc } = setup();
    assert.equal(status(() => svc.startAttempt({ track: 'nope', exercise: 'catch-watering' })), 404);
    assert.equal(status(() => svc.startAttempt({ track: TRACK, exercise: 'nope' })), 404);
    assert.equal(status(() => svc.startAttempt({ track: TRACK })), 404);
    assert.equal(status(() => svc.startAttempt({ track: TRACK, exercise: 'catch-watering', mode: 'exam' })), 400);
    assert.equal(status(() => svc.startAttempt({ track: TRACK, exercise: 'catch-clean', mode: 'diagnostic' })), 400);
    assert.equal(svc.startAttempt({ track: TRACK, exercise: 'catch-watering', mode: 'diagnostic' }).assistAllowed, false);
    assert.equal(status(() => svc.startAttempt(null)), 400);
  });

  test('hit writes stopped/explained/graded in one append, in seq order, all valid', () => {
    const { svc, events, appends } = setup();
    const { attemptId } = svc.startAttempt({ track: TRACK, exercise: 'catch-watering' });
    const body = svc.submitStop(attemptId, { statementId: 's2', elapsedMs: 900, answer: GOOD, via: 'key', stopLatencyMs: 12 });
    assert.equal(body.detection, 'hit');
    assert.equal(body.attributedStatementId, 's2');
    assert.equal(body.assisted, false);
    assert.equal(body.result.explanation.status, 'met');
    assert.equal(body.result.correction.status, 'met');
    assert.equal(body.result.overall, 'met');
    assert.deepEqual(Object.keys(body.result.explanation).sort(), ['matched', 'missing', 'status']);
    assert.deepEqual(body.reveal, {
      statementId: 's2', misconception: 'Midday watering cools the plant.',
      whyWrong: 'Water drops focus strong light and scorch the leaves.', exceptions: '',
      correctedText: 'I water the bed at dusk so the leaves do not scorch.'
    });
    assert.deepEqual(appends, [['started'], ['stopped', 'explained', 'graded']]);
    const evs = events(attemptId);
    assert.deepEqual(evs.map(e => e.verb), ['started', 'stopped', 'explained', 'graded']);
    for (const e of evs) assert.deepEqual(validateEvent(e), []);
    const [, stopped, explained, graded] = evs;
    assert.deepEqual(stopped.result, { attributedStatementId: 's2', detection: 'hit', elapsedMs: 900, via: 'key', stopLatencyMs: 12 });
    assert.deepEqual(explained.result, { text: GOOD, chars: GOOD.length });
    assert.equal(graded.result.outcome, 'caught');
    assert.equal(graded.result.graderSource, 'matcher');
    assert.equal(graded.result.graderVersion, 'matcher@1');
    assert.equal(graded.result.assisted, false);
    assert.equal(graded.result.confidence, 'high');
    assert.equal(graded.result.dimensions.correction.confidence, 'high');
    assert.equal(typeof graded.result.latencyMs, 'number');
    for (const e of evs.slice(1)) assert.deepEqual(e.object, { type: 'exercise', id: 'catch-watering', statement: 's2', part: 'stop:s2' });
  });

  test('false interruption: result and reveal null', () => {
    const { svc } = setup();
    const { attemptId } = svc.startAttempt({ track: TRACK, exercise: 'catch-watering' });
    const body = svc.submitStop(attemptId, { statementId: 's1', elapsedMs: 300, answer: 'the bed is too high' });
    assert.deepEqual(body, { statementId: 's1', attributedStatementId: 's1', detection: 'false_interruption', assisted: false, result: null, reveal: null });
  });

  test('grace: 2000 ms late hit, 2001 ms false interruption, caught previous not re-attributed', () => {
    assert.equal(GRACE_MS, 2000);
    const { svc } = setup();
    const a = svc.startAttempt({ track: TRACK, exercise: 'catch-watering' }).attemptId;
    const late = svc.submitStop(a, { statementId: 's3', elapsedMs: 2000, answer: GOOD });
    assert.equal(late.detection, 'late_hit');
    assert.equal(late.attributedStatementId, 's2');
    assert.equal(late.reveal.statementId, 's2');
    const b = svc.startAttempt({ track: TRACK, exercise: 'catch-watering' }).attemptId;
    assert.equal(svc.submitStop(b, { statementId: 's3', elapsedMs: 2001, answer: GOOD }).detection, 'false_interruption');
    for (const elapsedMs of [undefined, -1, 1.5, '10']) {
      const c = svc.startAttempt({ track: TRACK, exercise: 'catch-watering' }).attemptId;
      assert.equal(svc.submitStop(c, { statementId: 's3', elapsedMs, answer: GOOD }).detection, 'false_interruption', String(elapsedMs));
    }
    const d = svc.startAttempt({ track: TRACK, exercise: 'catch-watering' }).attemptId;
    assert.equal(svc.submitStop(d, { statementId: 's2', elapsedMs: 100, answer: GOOD }).detection, 'hit');
    const again = svc.submitStop(d, { statementId: 's3', elapsedMs: 500, answer: GOOD });
    assert.equal(again.detection, 'false_interruption');
    assert.equal(again.attributedStatementId, 's3');
  });

  test('repeat stop identical body, no events', () => {
    const { svc, events } = setup();
    const { attemptId } = svc.startAttempt({ track: TRACK, exercise: 'catch-watering' });
    const first = svc.submitStop(attemptId, { statementId: 's2', elapsedMs: 100, answer: GOOD });
    const n = events(attemptId).length;
    assert.deepEqual(svc.submitStop(attemptId, { statementId: 's2', elapsedMs: 5, answer: 'different' }), first);
    assert.equal(events(attemptId).length, n);
    const fi = svc.submitStop(attemptId, { statementId: 's3', elapsedMs: 100, answer: 'x' });
    assert.deepEqual(svc.submitStop(attemptId, { statementId: 's3', answer: 'y' }), fi);
  });

  test('backwards stop 400; after complete 409; non-catch 400', () => {
    const { svc } = setup();
    const { attemptId } = svc.startAttempt({ track: TRACK, exercise: 'catch-watering' });
    svc.submitStop(attemptId, { statementId: 's3', elapsedMs: 9999, answer: 'x' });
    assert.equal(status(() => svc.submitStop(attemptId, { statementId: 's2', answer: GOOD })), 400);
    assert.equal(status(() => svc.submitStop(attemptId, { statementId: 's9', answer: GOOD })), 400);
    assert.equal(status(() => svc.submitStop(attemptId, { answer: GOOD })), 400);
    assert.equal(status(() => svc.submitStop(attemptId, { statementId: 's3', answer: 42 })), 400);
    svc.complete(attemptId, {});
    assert.equal(status(() => svc.submitStop(attemptId, { statementId: 's3', answer: 'x' })), 409);
    const learn = svc.startAttempt({ track: TRACK, exercise: 'learn-beds' });
    assert.equal(learn.exercise.firstPrompt.part, 'teachBack:0');
    assert.equal(status(() => svc.submitStop(learn.attemptId, { statementId: learn.exercise.narration[0].id, answer: 'x' })), 400);
  });

  test('empty answer is allowed and not_met; an answer over 2000 chars is truncated with the original length', () => {
    const { svc, events } = setup();
    const { attemptId } = svc.startAttempt({ track: TRACK, exercise: 'catch-watering' });
    const body = svc.submitStop(attemptId, { statementId: 's2', elapsedMs: 0, answer: '' });
    assert.equal(body.result.overall, 'not_met');
    const b = svc.startAttempt({ track: TRACK, exercise: 'catch-watering' }).attemptId;
    svc.submitStop(b, { statementId: 's2', elapsedMs: 0, answer: 'a'.repeat(2500) });
    const explained = events(b).find(e => e.verb === 'explained');
    assert.equal(explained.result.chars, 2500);
    assert.equal(explained.result.text.length, 2000);
  });

  test('assist marks later grades only; diagnostic assist 400; idempotent', () => {
    const { svc, events } = setup();
    const { attemptId } = svc.startAttempt({ track: TRACK, exercise: 'catch-watering' });
    assert.equal(svc.submitStop(attemptId, { statementId: 's1', elapsedMs: 9999, answer: 'x' }).assisted, false);
    const help = svc.assist(attemptId);
    assert.equal(help.assisted, true);
    assert.deepEqual(help.reference.map(r => r.id), ['ref-beds']);
    assert.equal(typeof help.reference[0].text, 'string');
    assert.deepEqual(svc.assist(attemptId), help);
    assert.equal(svc.submitStop(attemptId, { statementId: 's2', elapsedMs: 0, answer: GOOD }).assisted, true);
    const evs = events(attemptId);
    assert.equal(evs.filter(e => e.verb === 'assisted').length, 1);
    assert.deepEqual(evs.find(e => e.verb === 'assisted').result, { kind: 'reference' });
    assert.deepEqual(evs.filter(e => e.verb === 'graded').map(e => e.result.assisted), [false, true]);
    const diag = svc.startAttempt({ track: TRACK, exercise: 'catch-watering', mode: 'diagnostic' }).attemptId;
    assert.equal(status(() => svc.assist(diag)), 400);
    assert.equal(events(diag).filter(e => e.verb === 'assisted').length, 0);
  });

  test('complete idempotent; notReached vs missed; cleanPass', () => {
    const { svc, events } = setup();
    const early = svc.startAttempt({ track: TRACK, exercise: 'catch-watering' }).attemptId;
    const left = svc.complete(early, { lastStatementId: 's1' });
    assert.deepEqual(left.summary, { planted: 1, hits: 0, lateHits: 0, misses: 0, falseInterruptions: 0, notReached: 1, cleanPass: false, flagged: 0 });
    assert.deepEqual(left.missed, []);

    const full = svc.startAttempt({ track: TRACK, exercise: 'catch-watering' }).attemptId;
    const body = svc.complete(full, {});
    assert.deepEqual(body.summary, { planted: 1, hits: 0, lateHits: 0, misses: 1, falseInterruptions: 0, notReached: 0, cleanPass: false, flagged: 0 });
    assert.deepEqual(body.missed, [{
      statementId: 's2', text: 'I water the bed at noon so the berries stay cool.', misconception: 'Midday watering cools the plant.',
      whyWrong: 'Water drops focus strong light and scorch the leaves.', exceptions: '',
      correctedText: 'I water the bed at dusk so the leaves do not scorch.'
    }]);
    assert.deepEqual(body.reference.map(r => r.id), ['ref-beds']);
    assert.deepEqual(body.sources, [{ title: 'Moonberry almanac', url: 'https://example.org/almanac', verified: true, note: 'fetched for tests' }]);
    assert.deepEqual(body.followUp, { question: 'When would watering at noon be acceptable?', graded: false });
    assert.deepEqual(body.transfer, { scenario: 'A friend grows sunberries in pots.' });
    assert.deepEqual(svc.complete(full, { lastStatementId: 's1' }), body);
    const completed = events(full).filter(e => e.verb === 'completed');
    assert.equal(completed.length, 1);
    assert.deepEqual(completed[0].result, { hits: 0, lateHits: 0, misses: 1, falseInterruptions: 0, notReached: 0, cleanPass: false, flagged: 0, missedStatementIds: ['s2'], notReachedStatementIds: [] });
    assert.equal(status(() => svc.complete(early, { lastStatementId: 's9' })), 200, 'already complete: stored body');
    const bad = svc.startAttempt({ track: TRACK, exercise: 'catch-watering' }).attemptId;
    assert.equal(status(() => svc.complete(bad, { lastStatementId: 's9' })), 400);

    const clean = svc.startAttempt({ track: TRACK, exercise: 'catch-clean' }).attemptId;
    assert.equal(svc.complete(clean, {}).summary.cleanPass, true);
    const noisy = svc.startAttempt({ track: TRACK, exercise: 'catch-clean' }).attemptId;
    svc.submitStop(noisy, { statementId: 's1', elapsedMs: 9999, answer: 'x' });
    assert.deepEqual(svc.complete(noisy, {}).summary, { planted: 0, hits: 0, lateHits: 0, misses: 0, falseInterruptions: 1, notReached: 0, cleanPass: false, flagged: 0 });
  });

  test('complete lists each answered stop with its rubric and acceptable corrections', () => {
    const { svc } = setup();
    const a = svc.startAttempt({ track: TRACK, exercise: 'catch-watering' }).attemptId;
    const stop = svc.submitStop(a, { statementId: 's3', elapsedMs: 100, answer: GOOD });
    const body = svc.complete(a, {});
    assert.equal(body.summary.lateHits, 1);
    assert.deepEqual(body.answered, [{
      part: 'stop:s2', answer: GOOD, result: stop.result,
      rubric: { explain: ['leaves scorch|burns the leaves', 'strong light'], correct: ['water at dusk|water in the evening'] },
      acceptableCorrections: ['I water the bed at dusk so the leaves do not scorch.', 'Water in the evening instead.'],
      selfRating: null
    }]);
  });

  test('self-rated copies matcherStatus and carries object.part', () => {
    const { svc, events } = setup();
    const { attemptId } = svc.startAttempt({ track: TRACK, exercise: 'catch-watering' });
    svc.submitStop(attemptId, { statementId: 's1', elapsedMs: 9999, answer: 'x' });
    const stop = svc.submitStop(attemptId, { statementId: 's2', elapsedMs: 0, answer: GOOD });
    assert.equal(status(() => svc.selfRate(attemptId, { part: 'stop:s2', rating: 'had_it' })), 400, 'before complete');
    svc.complete(attemptId, {});
    assert.equal(status(() => svc.selfRate(attemptId, { part: 'stop:s1', rating: 'had_it' })), 400, 'false interruption has no graded answer');
    assert.equal(status(() => svc.selfRate(attemptId, { part: 'stop:s3', rating: 'had_it' })), 400);
    assert.equal(status(() => svc.selfRate(attemptId, { part: 'stop:s2', rating: 'great' })), 400);
    assert.deepEqual(svc.selfRate(attemptId, { part: 'stop:s2', rating: 'partly' }), { part: 'stop:s2', rating: 'partly', matcherStatus: stop.result.overall });
    svc.selfRate(attemptId, { part: 'stop:s2', rating: 'had_it' });
    const rated = events(attemptId).filter(e => e.verb === 'self-rated');
    assert.equal(rated.length, 2);
    assert.deepEqual(rated[1].object, { type: 'exercise', id: 'catch-watering', part: 'stop:s2' });
    assert.deepEqual(rated[1].result, { rating: 'had_it', matcherStatus: 'met', graderVersion: 'matcher@1' });
    assert.equal(svc.complete(attemptId, {}).answered[0].selfRating, 'had_it', 'latest rating wins');
  });

  test('injected grader is used; a non-function grader throws TypeError', () => {
    const seen = [];
    const grader = input => {
      seen.push(input);
      const dim = { status: 'partial', matched: [], missing: ['m'], confidence: 'high' };
      return { dimensions: { explanation: dim, correction: dim }, redFlagsMatched: [], strongSignalsMatched: [], architectureId: null, graderSource: 'matcher', graderVersion: 'fake@9' };
    };
    const { svc, events } = setup({ grader });
    const { attemptId } = svc.startAttempt({ track: TRACK, exercise: 'catch-watering' });
    const body = svc.submitStop(attemptId, { statementId: 's2', elapsedMs: 0, answer: 'anything' });
    assert.equal(body.result.overall, 'partial');
    assert.equal(events(attemptId).find(e => e.verb === 'graded').result.graderVersion, 'fake@9');
    assert.equal(seen.length, 1);
    assert.equal(seen[0].answer, 'anything');
    assert.equal(seen[0].flawedText, 'I water the bed at noon so the berries stay cool.');
    assert.deepEqual(seen[0].dimensions.correction.alternatives, ['I water the bed at dusk so the leaves do not scorch.', 'Water in the evening instead.']);
    assert.deepEqual(seen[0].lexicon, { synonyms: { water: ['irrigate', 'soak'] } });
    for (const bad of [null, 'matcher', {}, 42]) {
      assert.throws(() => createPracticeService({ db: openDb(':memory:'), grader: bad }), TypeError);
    }
  });

  test('an att_ id on /api/practice/attempts returns 404 (service)', () => {
    const { svc } = setup();
    const att = 'att_01J0000000000000000000000A';
    assert.equal(status(() => svc.submitStop(att, { statementId: 's1', answer: 'x' })), 404);
    assert.equal(status(() => svc.assist(att)), 404);
    assert.equal(status(() => svc.complete(att, {})), 404);
    assert.equal(status(() => svc.selfRate(att, { part: 'stop:s1', rating: 'had_it' })), 404);
    assert.equal(status(() => svc.complete('pra_01J0000000000000000000000A', {})), 404, 'unknown pra_ id');
    for (const fn of ['submitStop', 'complete', 'selfRate']) assert.equal(status(() => svc[fn](att, [1])), 404, `${fn}: id before body`);
  });

  test('every practice event carries context.engine practice and passes validateEvent', () => {
    const { svc, events } = setup();
    const { attemptId } = svc.startAttempt({ track: TRACK, exercise: 'catch-watering', mode: 'review' });
    svc.submitStop(attemptId, { statementId: 's1', elapsedMs: 9999, answer: 'x' });
    svc.assist(attemptId);
    svc.submitStop(attemptId, { statementId: 's2', elapsedMs: 0, answer: GOOD });
    svc.complete(attemptId, {});
    svc.selfRate(attemptId, { part: 'stop:s2', rating: 'had_it' });
    const evs = events(attemptId);
    assert.deepEqual(evs.map(e => e.verb), ['started', 'stopped', 'explained', 'graded', 'assisted', 'stopped', 'explained', 'graded', 'completed', 'self-rated']);
    for (const e of evs) {
      assert.deepEqual(validateEvent(e), [], e.verb);
      assert.deepEqual(e.context, { subject: 'moonberry@1', attemptId, promptVersions: {}, engine: 'practice', module: 'm1', mode: 'review', exerciseType: 'catch' }, e.verb);
      assert.equal(e.object.step, undefined);
    }
    // The projection rebuilds the attempt from the log alone.
    const p = projectPracticeAttempt(evs);
    assert.equal(p.attemptId, attemptId);
    assert.equal(p.exerciseId, 'catch-watering');
    assert.equal(p.assisted, true);
    assert.deepEqual(p.stops.map(s => [s.statementId, s.detection]), [['s1', 'false_interruption'], ['s2', 'hit']]);
    assert.ok(p.completed);
  });

  test('trackSummary lists modules with exercise summaries only; unknown track is null', () => {
    setup();
    const t = trackSummary(TRACK);
    assert.deepEqual(Object.keys(t), ['id', 'title', 'version', 'modules']);
    const all = t.modules.flatMap(m => m.exercises);
    assert.ok(all.length >= 4);
    for (const e of all) assert.deepEqual(Object.keys(e), ['id', 'type', 'objective', 'difficulty', 'concepts', 'prerequisites']);
    assert.deepEqual(hiddenKeys(t), []);
    assert.equal(trackSummary('nope'), null);
    assert.equal(trackSummary(undefined), null);
  });

  test('the clock is injected: event times come from now()', () => {
    const t = Date.parse('2026-10-13T08:00:00.000Z');
    const { svc, events } = setup({ now: () => t });
    const { attemptId } = svc.startAttempt({ track: TRACK, exercise: 'catch-watering' });
    assert.equal(events(attemptId)[0].at, '2026-10-13T08:00:00.000Z');
  });
});

describe('guards', () => {
  const walk = dir => readdirSync(dir).flatMap(n => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : [];
  });
  const specifiers = file => [...readFileSync(file, 'utf8').matchAll(/(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g)].map(m => m[1]);

  test('practice modules and server/ai, server/prompts never import each other', () => {
    const practice = [...walk(path.join(ROOT, 'server', 'services')), ...walk(path.join(ROOT, 'server', 'routes'))]
      .filter(f => /^practice/.test(path.basename(f)));
    assert.ok(practice.length >= 4, practice.join(', '));
    for (const f of practice) {
      for (const s of specifiers(f)) assert.doesNotMatch(s, /(^|\/)(ai|prompts)(\/|$)|llm\.js|ai-client/, `${path.relative(ROOT, f)} imports ${s}`);
    }
    for (const f of [...walk(path.join(ROOT, 'server', 'ai')), ...walk(path.join(ROOT, 'server', 'prompts'))]) {
      for (const s of specifiers(f)) assert.doesNotMatch(s, /practice/, `${path.relative(ROOT, f)} imports ${s}`);
    }
  });

  test('listSubjects() is unchanged with and without practice packs loaded, and no [packs] warning is logged', t => {
    const warnings = [];
    t.mock.method(console, 'warn', (...a) => warnings.push(a.join(' ')));
    const db = openDb(':memory:');
    loadPacks(path.join(ROOT, 'packs'), db);
    const without = listSubjects();
    const mixed = mkdtempSync(path.join(tmpdir(), 'f1c-t04-mixed-'));
    try {
      cpSync(path.join(ROOT, 'packs'), mixed, { recursive: true });
      cpSync(BASIC, path.join(mixed, 'pack-basic'), { recursive: true });
      loadPacks(mixed, db);
      loadPracticePacks(mixed, db);
      assert.deepEqual(listSubjects(), without);
      assert.ok(without.length >= 1);
      assert.deepEqual(warnings.filter(w => w.includes('[packs]')), []);
    } finally {
      rmSync(mixed, { recursive: true, force: true });
    }
  });
});

describe('HTTP smoke (spawned server)', () => {
  let app;
  before(async () => { app = await startServer({ MOCK: '1', PRACTICE_PACKS_DIR: packsDir }); });
  after(() => app?.stop());
  const req = (method, p, body, raw) => fetch(app.url + p, {
    method, headers: { 'content-type': 'application/json' },
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body))
  }).then(async r => ({ status: r.status, body: await r.json() }));

  test('the catch loop over HTTP, with 404, 400 and 413 on bad input', async () => {
    assert.deepEqual((await req('GET', '/api/practice/tracks')).body, [{ id: 'moonberry', title: 'Moonberry growing', version: 1 }]);
    const track = await req('GET', '/api/practice/tracks/moonberry');
    assert.equal(track.status, 200);
    assert.deepEqual(track.body.modules[0].exercises.find(e => e.id === 'catch-watering'),
      { id: 'catch-watering', type: 'catch', objective: 'Catch the watering mistake.', difficulty: 1, concepts: ['bed-care'], prerequisites: [] });
    assert.equal((await req('GET', '/api/practice/tracks/nope')).status, 404);

    const start = await req('POST', '/api/practice/attempts', { track: TRACK, exercise: 'catch-watering' });
    assert.equal(start.status, 200);
    assert.deepEqual(hiddenKeys(start.body), []);
    const id = start.body.attemptId;
    const stop = await req('POST', `/api/practice/attempts/${id}/stops`, { statementId: 's2', elapsedMs: 10, answer: GOOD, via: 'button', stopLatencyMs: null });
    assert.equal(stop.status, 200);
    assert.equal(stop.body.detection, 'hit');
    assert.equal((await req('POST', `/api/practice/attempts/${id}/assist`, {})).body.assisted, true);
    const done = await req('POST', `/api/practice/attempts/${id}/complete`, {});
    assert.equal(done.status, 200);
    assert.equal(done.body.summary.hits, 1);
    const rate = await req('POST', `/api/practice/attempts/${id}/self-ratings`, { part: 'stop:s2', rating: 'had_it' });
    assert.deepEqual(rate.body, { part: 'stop:s2', rating: 'had_it', matcherStatus: 'met' });
    assert.equal((await req('POST', `/api/practice/attempts/${id}/stops`, { statementId: 's3', answer: 'x' })).status, 409);

    assert.equal((await req('POST', '/api/practice/attempts/att_01J0000000000000000000000A/stops', { statementId: 's2', answer: 'x' })).status, 404);
    assert.equal((await req('POST', '/api/practice/attempts/att_01J0000000000000000000000A/complete', {})).status, 404);
    assert.equal((await req('POST', `/api/practice/attempts/${id}/nope`, {})).status, 404);
    assert.equal((await req('POST', '/api/practice/attempts', { track: 'nope', exercise: 'x' })).status, 404);
    assert.equal((await req('POST', '/api/practice/attempts', undefined, '{bad')).status, 400);
    assert.equal((await req('POST', '/api/practice/attempts', undefined, '[1]')).status, 400);
    assert.equal((await req('POST', '/api/practice/attempts', undefined, JSON.stringify({ pad: 'x'.repeat(1_100_000) }))).status, 413);
    assert.ok(app.alive());
  });
});
