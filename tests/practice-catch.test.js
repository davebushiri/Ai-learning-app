// F1c-T04: catch attempt API, events and wiring (ADR 0008, ADR 0002 Amendment 3; spec FR-004–FR-016,
// FR-023, FR-050). In-process service on a :memory: DB, plus one spawned-server HTTP smoke test.

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from '../server/db.js';
import { validateEvent } from '../shared/events.js';
import { loadPacks, listSubjects } from '../server/packs.js';
import { loadPracticePacks } from '../server/services/practice-pack.js';
import { createPracticeService, projectPracticeAttempt, trackSummary, GRACE_MS } from '../server/services/practice.js';
import { MATCHER_VERSION } from '../server/services/practice-matcher.js';
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

// F1c-T13: a catch with four planted statements, so caught, missed, not graded and not reached can all
// occur in one attempt. Written into the temp copy only; the pack-basic fixture is not touched.
const plantedItem = (statementId, word) => ({
  statementId, misconception: `The ${word} step is harmless.`, whyWrong: `The ${word} step harms the vines.`,
  acceptableCorrections: [`Skip the ${word} step.`], exceptions: '', kind: 'wrong-step',
  rubric: { explain: [`${word} harms vines`], correct: [`skip ${word}`] }
});
const CATCH_MULTI = {
  id: 'catch-multi', module: 'm1', type: 'catch', objective: 'Catch four vine mistakes.',
  prerequisites: [], difficulty: 2, concepts: ['bed-care'], referenceIds: ['ref-beds'],
  sources: [{ title: 'Moonberry almanac', url: 'https://example.org/almanac', verified: true }],
  followUp: 'Which step matters most?', transfer: { scenario: 'A friend grows sunberries on a wall.', rubric: ['walls hold heat'] },
  narration: [
    { id: 's1', text: 'I loosen the soil around each vine.' },
    { id: 's2', text: 'I paint the vines with salt water.' },
    { id: 's3', text: 'I tie the vines with copper wire.' },
    { id: 's4', text: 'I shake the vines every morning.' },
    { id: 's5', text: 'I cover the bed with straw.' },
    { id: 's6', text: 'I cut every second vine at the root.' }
  ],
  answerKey: {
    planted: [plantedItem('s2', 'salt'), plantedItem('s3', 'copper'), plantedItem('s4', 'shaking'), plantedItem('s6', 'cutting')],
    clean: ['s1', 's5']
  }
};

let packsDir;
before(() => {
  packsDir = mkdtempSync(path.join(tmpdir(), 'f1c-t04-'));
  const dir = path.join(packsDir, 'pack-basic');
  cpSync(BASIC, dir, { recursive: true });
  writeFileSync(path.join(dir, 'exercises', 'catch-multi.json'), JSON.stringify(CATCH_MULTI));
  const manifest = JSON.parse(readFileSync(path.join(dir, 'practice.json'), 'utf8'));
  manifest.modules[0].exercises.push('catch-multi');
  writeFileSync(path.join(dir, 'practice.json'), JSON.stringify(manifest));
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
    assert.equal(graded.result.graderVersion, MATCHER_VERSION);
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
    assert.deepEqual(completed[0].result, { hits: 0, lateHits: 0, misses: 1, falseInterruptions: 0, notReached: 0, cleanPass: false, flagged: 0, missedStatementIds: ['s2'], notReachedStatementIds: [], skippedStatementIds: [], notGradedStatementIds: [] });
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
    assert.deepEqual(rated[1].result, { rating: 'had_it', matcherStatus: 'met', graderVersion: MATCHER_VERSION });
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

describe('F1c-T13: skipped stops, stopId repeats, assist after complete (ADR 0002 Am. 4; FR-008, FR-009a)', () => {
  const SID_A = 'stopA_000001';
  const SID_B = 'stopB-000002';
  const completedOf = (events, id) => events(id).find(e => e.verb === 'completed').result;

  test('a false interruption writes graded with outcome false_alarm and overall null', () => {
    const { svc, events } = setup();
    const { attemptId } = svc.startAttempt({ track: TRACK, exercise: 'catch-watering' });
    svc.submitStop(attemptId, { statementId: 's1', elapsedMs: 9999, answer: 'the bed is too high' });
    const evs = events(attemptId);
    assert.deepEqual(evs.map(e => e.verb), ['started', 'stopped', 'explained', 'graded']);
    assert.deepEqual(evs[3].result, {
      dimensions: {}, overall: null, outcome: 'false_alarm', assisted: false, confidence: 'high',
      graderSource: 'matcher', graderVersion: MATCHER_VERSION, latencyMs: 0
    });
    for (const e of evs) assert.deepEqual(validateEvent(e), [], e.verb);
  });

  test('a skipped stop on a planted statement is notGraded, not missed; caught, missed, notGraded and notReached are disjoint and cover every planted statement', () => {
    const { svc, events } = setup();
    const { attemptId } = svc.startAttempt({ track: TRACK, exercise: 'catch-multi' });
    assert.equal(svc.submitStop(attemptId, { statementId: 's2', elapsedMs: 100, answer: 'salt harms vines, skip salt' }).detection, 'hit');
    const body = svc.complete(attemptId, { lastStatementId: 's5', skipped: [{ statementId: 's4', elapsedMs: 9999 }] });
    const c = completedOf(events, attemptId);
    assert.deepEqual(c.missedStatementIds, ['s3']);
    assert.deepEqual(c.notGradedStatementIds, ['s4']);
    assert.deepEqual(c.skippedStatementIds, ['s4']);
    assert.deepEqual(c.notReachedStatementIds, ['s6']);
    assert.equal(c.misses, 1);
    assert.equal(c.notReached, 1);
    assert.deepEqual(body.summary, { planted: 4, hits: 1, lateHits: 0, misses: 1, falseInterruptions: 0, notReached: 1, cleanPass: false, flagged: body.summary.flagged });
    const caught = body.answered.map(x => x.part.slice('stop:'.length));
    const groups = [caught, c.missedStatementIds, c.notGradedStatementIds, c.notReachedStatementIds];
    const all = groups.flat();
    assert.equal(new Set(all).size, all.length, 'disjoint');
    assert.deepEqual(all.sort(), ['s2', 's3', 's4', 's6'], 'cover every planted statement');
    // Response: the union in narration order; only the not-graded item carries notGraded.
    assert.deepEqual(body.missed.map(m => m.statementId), ['s3', 's4']);
    assert.equal('notGraded' in body.missed[0], false);
    assert.equal(body.missed[1].notGraded, true);
    assert.equal(body.missed[1].text, 'I shake the vines every morning.');
    assert.equal(body.missed[1].correctedText, 'Skip the shaking step.');
    assert.deepEqual(svc.complete(attemptId, {}), body, 'repeat complete returns the stored body');
  });

  test('skipped: a skip inside 2000 ms of the next statement marks the previous planted statement notGraded; a skip on a clean or already-caught statement changes no count and keeps cleanPass', () => {
    const { svc, events } = setup();
    const late = svc.startAttempt({ track: TRACK, exercise: 'catch-watering' }).attemptId;
    const body = svc.complete(late, { skipped: [{ statementId: 's3', elapsedMs: 500 }] });
    assert.deepEqual(completedOf(events, late), {
      hits: 0, lateHits: 0, misses: 0, falseInterruptions: 0, notReached: 0, cleanPass: false, flagged: 0,
      missedStatementIds: [], notReachedStatementIds: [], skippedStatementIds: ['s3'], notGradedStatementIds: ['s2']
    });
    assert.deepEqual(body.missed.map(m => [m.statementId, m.notGraded]), [['s2', true]]);
    // Outside the grace window the same skip is on a clean statement: s2 stays missed.
    const outside = svc.startAttempt({ track: TRACK, exercise: 'catch-watering' }).attemptId;
    svc.complete(outside, { skipped: [{ statementId: 's3', elapsedMs: 2001 }] });
    assert.deepEqual(completedOf(events, outside).missedStatementIds, ['s2']);
    assert.deepEqual(completedOf(events, outside).notGradedStatementIds, []);

    const clean = svc.startAttempt({ track: TRACK, exercise: 'catch-clean' }).attemptId;
    const cb = svc.complete(clean, { skipped: [{ statementId: 's1' }, { statementId: 's2', elapsedMs: 100 }] });
    assert.deepEqual(cb.summary, { planted: 0, hits: 0, lateHits: 0, misses: 0, falseInterruptions: 0, notReached: 0, cleanPass: true, flagged: 0 });
    assert.deepEqual(cb.missed, []);

    const caught = svc.startAttempt({ track: TRACK, exercise: 'catch-watering' }).attemptId;
    svc.submitStop(caught, { statementId: 's2', elapsedMs: 0, answer: GOOD });
    const kb = svc.complete(caught, { skipped: [{ statementId: 's2', elapsedMs: 0 }, { statementId: 's3', elapsedMs: 100 }] });
    assert.deepEqual(kb.summary, { planted: 1, hits: 1, lateHits: 0, misses: 0, falseInterruptions: 0, notReached: 0, cleanPass: false, flagged: 0 });
    assert.deepEqual(kb.missed, []);
    assert.deepEqual(completedOf(events, caught).skippedStatementIds, ['s2', 's3']);
    assert.deepEqual(completedOf(events, caught).notGradedStatementIds, []);
  });

  test('skipped: a statement skipped and then caught is caught, not notGraded', () => {
    const { svc, events } = setup();
    const { attemptId } = svc.startAttempt({ track: TRACK, exercise: 'catch-watering' });
    // The s2 stop failed and was skipped; a later stop on s3 inside the grace window catches s2.
    assert.equal(svc.submitStop(attemptId, { statementId: 's3', elapsedMs: 300, answer: GOOD }).detection, 'late_hit');
    const body = svc.complete(attemptId, { skipped: [{ statementId: 's2', elapsedMs: 900 }] });
    assert.equal(body.summary.lateHits, 1);
    assert.equal(body.summary.misses, 0);
    assert.deepEqual(body.missed, []);
    assert.deepEqual(completedOf(events, attemptId).notGradedStatementIds, []);
    assert.deepEqual(completedOf(events, attemptId).skippedStatementIds, ['s2']);
  });

  test('skipped: a skipped statement after lastStatementId is notGraded, not notReached', () => {
    const { svc, events } = setup();
    const { attemptId } = svc.startAttempt({ track: TRACK, exercise: 'catch-watering' });
    const body = svc.complete(attemptId, { lastStatementId: 's1', skipped: [{ statementId: 's2', elapsedMs: 50 }] });
    assert.equal(body.summary.notReached, 0);
    assert.equal(body.summary.misses, 0);
    const c = completedOf(events, attemptId);
    assert.deepEqual(c.notReachedStatementIds, []);
    assert.deepEqual(c.notGradedStatementIds, ['s2']);
  });

  test('skipped: not an array, 21 entries, a non-object entry or an unknown statementId is 400; a repeat complete ignores skipped', () => {
    const { svc, events } = setup();
    const id = svc.startAttempt({ track: TRACK, exercise: 'catch-watering' }).attemptId;
    const entry = { statementId: 's1' };
    for (const skipped of ['s2', { statementId: 's2' }, 7, Array(21).fill(entry), ['s2'], [null], [[entry]], [{ statementId: 's9' }], [{}], [{ statementId: 2 }]]) {
      assert.equal(status(() => svc.complete(id, { skipped })), 400, JSON.stringify(skipped).slice(0, 40));
    }
    assert.equal(events(id).filter(e => e.verb === 'completed').length, 0, 'a 400 writes nothing');
    const ok = svc.complete(id, { skipped: Array(20).fill(entry) });
    assert.deepEqual(completedOf(events, id).skippedStatementIds, ['s1'], 'request order, no duplicates');
    assert.deepEqual(svc.complete(id, { skipped: 'garbage', lastStatementId: 's9' }), ok);
    assert.deepEqual(svc.complete(id, { skipped: [{ statementId: 's2' }] }), ok);
    assert.equal(events(id).filter(e => e.verb === 'completed').length, 1);
    const nul = svc.startAttempt({ track: TRACK, exercise: 'catch-watering' }).attemptId;
    assert.equal(status(() => svc.complete(nul, { skipped: null })), 200, 'null is absent');
    assert.deepEqual(completedOf(events, nul).skippedStatementIds, []);
  });

  test('stopId: the same stopId returns the stored body with no events; the same stopId on another statement is 400; a malformed stopId is 400', () => {
    const { svc, events } = setup();
    const { attemptId } = svc.startAttempt({ track: TRACK, exercise: 'catch-watering' });
    const first = svc.submitStop(attemptId, { statementId: 's2', elapsedMs: 100, answer: GOOD, stopId: SID_A });
    const n = events(attemptId).length;
    assert.deepEqual(svc.submitStop(attemptId, { statementId: 's2', elapsedMs: 5, answer: 'different', stopId: SID_A }), first);
    assert.equal(events(attemptId).length, n);
    assert.equal(status(() => svc.submitStop(attemptId, { statementId: 's3', elapsedMs: 5, answer: 'x', stopId: SID_A })), 400);
    for (const stopId of ['short', 'a'.repeat(65), 'has space1', 'bad/char1', 12345678, ['abcdefgh'], {}]) {
      assert.equal(status(() => svc.submitStop(attemptId, { statementId: 's3', elapsedMs: 5, answer: 'x', stopId })), 400, String(stopId));
    }
    assert.equal(events(attemptId).length, n);
    assert.equal(status(() => svc.submitStop(attemptId, { statementId: 's3', answer: 'x', stopId: 'a'.repeat(64) })), 200, '64 chars is valid');
  });

  test('stopId: a new stopId after a late hit is a new stop, a false interruption with its own triple (W-S1)', () => {
    const { svc, events } = setup();
    const { attemptId } = svc.startAttempt({ track: TRACK, exercise: 'catch-watering' });
    const late = svc.submitStop(attemptId, { statementId: 's3', elapsedMs: 800, answer: GOOD, stopId: SID_A });
    assert.equal(late.detection, 'late_hit');
    const again = svc.submitStop(attemptId, { statementId: 's3', elapsedMs: 300, answer: 'the glow is wrong', stopId: SID_B });
    assert.deepEqual(again, { statementId: 's3', attributedStatementId: 's3', detection: 'false_interruption', assisted: false, result: null, reveal: null });
    const evs = events(attemptId);
    assert.deepEqual(evs.map(e => e.verb), ['started', 'stopped', 'explained', 'graded', 'stopped', 'explained', 'graded']);
    assert.deepEqual(evs.slice(4).map(e => e.object.part), ['stop:s3', 'stop:s3', 'stop:s3']);
    assert.equal(evs[6].result.outcome, 'false_alarm');
    assert.equal(evs[5].result.text, 'the glow is wrong');
    // Try again re-sends a stopId: each gets its own stored body. No stopId: the latest stop on the statement.
    assert.deepEqual(svc.submitStop(attemptId, { statementId: 's3', answer: 'y', stopId: SID_A }), late);
    assert.deepEqual(svc.submitStop(attemptId, { statementId: 's3', answer: 'y', stopId: SID_B }), again);
    assert.deepEqual(svc.submitStop(attemptId, { statementId: 's3', answer: 'y' }), again);
    assert.equal(events(attemptId).length, 7);
    const p = projectPracticeAttempt(events(attemptId));
    assert.deepEqual(p.stops.map(s => [s.stopId, s.detection, s.answer]), [[SID_A, 'late_hit', GOOD], [SID_B, 'false_interruption', 'the glow is wrong']]);
    const body = svc.complete(attemptId, {});
    assert.deepEqual([body.summary.lateHits, body.summary.falseInterruptions, body.summary.misses], [1, 1, 0]);
  });

  test('stopId is stored on stopped only when sent', () => {
    const { svc, events } = setup();
    const { attemptId } = svc.startAttempt({ track: TRACK, exercise: 'catch-watering' });
    svc.submitStop(attemptId, { statementId: 's1', elapsedMs: 9999, answer: 'x' });
    svc.submitStop(attemptId, { statementId: 's2', elapsedMs: 0, answer: GOOD, stopId: SID_A });
    const [plain, withId] = events(attemptId).filter(e => e.verb === 'stopped');
    assert.equal('stopId' in plain.result, false);
    assert.equal(withId.result.stopId, SID_A);
    for (const e of events(attemptId)) assert.deepEqual(validateEvent(e), [], e.verb);
    assert.deepEqual(projectPracticeAttempt(events(attemptId)).stops.map(s => s.stopId), [null, SID_A]);
  });

  test('assist after complete returns the same body and writes no event (W-S3)', () => {
    const { svc, events } = setup();
    const { attemptId } = svc.startAttempt({ track: TRACK, exercise: 'catch-watering' });
    svc.complete(attemptId, {});
    const n = events(attemptId).length;
    const help = svc.assist(attemptId);
    assert.equal(help.assisted, true);
    assert.deepEqual(help.reference.map(r => r.id), ['ref-beds']);
    assert.equal(events(attemptId).length, n);
    assert.equal(events(attemptId).filter(e => e.verb === 'assisted').length, 0);
    const other = svc.startAttempt({ track: TRACK, exercise: 'catch-watering' }).attemptId;
    assert.deepEqual(svc.assist(other), help, 'same body as any assist');
  });
});

describe('guards', () => {
  const walk = dir => readdirSync(dir).flatMap(n => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : [];
  });
  const specifiers = file => [...readFileSync(file, 'utf8').matchAll(/(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g)].map(m => m[1]);

  // Every file reachable from `entries` through relative import specifiers, until closure (W-S5).
  const reachable = entries => {
    const seen = new Set();
    const queue = [...entries];
    while (queue.length) {
      const f = queue.shift();
      if (seen.has(f)) continue;
      seen.add(f);
      if (!existsSync(f) || !f.endsWith('.js')) continue;
      for (const s of specifiers(f)) if (s.startsWith('.')) queue.push(path.resolve(path.dirname(f), s));
    }
    return [...seen];
  };
  const forbidden = (files, root) => files.map(f => path.relative(root, f).split(path.sep).join('/'))
    .filter(r => /^server\/(ai|prompts)\//.test(r) || /(^|\/)(ai-client[^/]*|llm\.js)$/.test(r));

  test('practice modules never reach server/ai or server/prompts, transitively', () => {
    const practice = [...walk(path.join(ROOT, 'server', 'services')), ...walk(path.join(ROOT, 'server', 'routes'))]
      .filter(f => /^practice.*\.js$/.test(path.basename(f)));
    assert.ok(practice.length >= 4, practice.join(', '));
    const closure = reachable(practice);
    assert.ok(closure.some(f => f.endsWith(path.join('server', 'packs.js'))), 'the walk follows transitive imports');
    assert.deepEqual(forbidden(closure, ROOT), []);

    // The walk catches a forbidden module two hops away (so this guard can fail).
    const tmp = mkdtempSync(path.join(tmpdir(), 'f1c-t13-walk-'));
    try {
      for (const d of ['server/services', 'server/ai', 'server/lib']) mkdirSync(path.join(tmp, d), { recursive: true });
      writeFileSync(path.join(tmp, 'server/services/practice-x.js'), "import { y } from '../lib/helper.js';\n");
      writeFileSync(path.join(tmp, 'server/lib/helper.js'), "export { z } from '../ai/gateway.js';\nimport '../llm.js';\n");
      writeFileSync(path.join(tmp, 'server/ai/gateway.js'), 'export const z = 1;\n');
      writeFileSync(path.join(tmp, 'server/llm.js'), '');
      assert.deepEqual(forbidden(reachable([path.join(tmp, 'server/services/practice-x.js')]), tmp).sort(), ['server/ai/gateway.js', 'server/llm.js']);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('server/ai and server/prompts never import a practice module', () => {
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
