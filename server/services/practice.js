// Practice engine session service (ADR 0008; spec FR-006–FR-016, FR-023; events per ADR 0002 Am. 3).
// It holds no state outside the event log: every call rebuilds its attempt with projectPracticeAttempt.
// The grader is synchronous (ARCH-7), so each write reads events, grades and appends with no await in
// between, and no in-flight map is needed.

import { HttpError } from '../http.js';
import { makeEvent, newId } from '../../shared/events.js';
import { getTrack, getExercise, getReferences, getSchedule, toPublicExercise } from './practice-pack.js';
import { matcherGrade, combineOverall, MATCHER_VERSION } from './practice-matcher.js';

export const GRACE_MS = 2000; // FR-012, provisional product choice (LR-5)
const MAX_ANSWER_CHARS = 2000;
const MODES = ['practice', 'diagnostic', 'review'];
const VIAS = ['voice', 'button', 'key'];
const RATINGS = ['had_it', 'partly', 'missed_it'];
const STATUSES = ['met', 'partial', 'not_met', 'uncertain'];
const PRA_ID = /^pra_[0-9A-HJKMNP-TV-Z]{26}$/; // practice routes handle only pra_ ids (ADR 0002 Am. 3)

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const strings = v => (Array.isArray(v) ? v.filter(x => typeof x === 'string') : []);
const bad = msg => new HttpError(400, msg);
const notFound = msg => new HttpError(404, msg);

/** Rebuilds one practice attempt from its events (in seq order). Null if there is no `started`. */
export function projectPracticeAttempt(events) {
  const list = Array.isArray(events) ? events : [];
  const started = list.find(e => e?.verb === 'started');
  if (!started) return null;
  const ctx = started.context;
  const at = ctx.subject.lastIndexOf('@');
  const p = {
    attemptId: ctx.attemptId, trackId: ctx.subject.slice(0, at), version: Number(ctx.subject.slice(at + 1)),
    exerciseId: started.object.id, context: ctx, assistAllowed: started.result?.assistAllowed === true,
    assisted: false, stops: [], completed: null, selfRatings: {}
  };
  const stopOf = e => p.stops.findLast(s => s.statementId === e.object.statement);
  for (const e of list) {
    if (e.verb === 'assisted') p.assisted = true;
    else if (e.verb === 'stopped') p.stops.push({ statementId: e.object.statement, ...e.result, answer: null, graded: null });
    else if (e.verb === 'explained' && stopOf(e)) stopOf(e).answer = e.result.text;
    else if (e.verb === 'graded' && stopOf(e)) stopOf(e).graded = e.result;
    else if (e.verb === 'completed') p.completed ??= e.result;
    else if (e.verb === 'self-rated') p.selfRatings[e.object.part] = e.result.rating; // latest wins
  }
  return p;
}

// A grader dimension, normalized so a malformed injected grader degrades to uncertain, never crashes.
function dimOf(out, name) {
  const d = isObj(out) && isObj(out.dimensions) ? out.dimensions[name] : null;
  if (!isObj(d) || !STATUSES.includes(d.status)) return { status: 'uncertain', matched: [], missing: [], confidence: 'low' };
  return { status: d.status, matched: strings(d.matched), missing: strings(d.missing), confidence: d.confidence === 'low' ? 'low' : 'high' };
}

const publicDim = d => ({ status: d.status, matched: [...d.matched], missing: [...d.missing] });
const publicResult = g => ({
  explanation: publicDim(g.dimensions.explanation), correction: publicDim(g.dimensions.correction), overall: g.overall
});
const plantedOf = (ex, statementId) => ex.answerKey.planted.find(p => p.statementId === statementId);
const textOf = (ex, statementId) => ex.narration.find(n => n.id === statementId).text;
const revealOf = p => ({
  statementId: p.statementId, misconception: p.misconception, whyWrong: p.whyWrong,
  exceptions: p.exceptions, correctedText: p.acceptableCorrections[0]
});
const isAnswered = s => s.detection !== 'false_interruption' && s.graded != null;
const partOf = s => `stop:${s.attributedStatementId}`;

function stopBody(stop, ex) {
  const hit = isAnswered(stop);
  return {
    statementId: stop.statementId, attributedStatementId: stop.attributedStatementId, detection: stop.detection,
    assisted: stop.graded?.assisted === true,
    result: hit ? publicResult(stop.graded) : null,
    reveal: hit ? revealOf(plantedOf(ex, stop.attributedStatementId)) : null
  };
}

export function createPracticeService({ db, grader = matcherGrade, now = Date.now } = {}) {
  if (typeof grader !== 'function') throw new TypeError('grader must be a function');

  const event = (context, verb, object, result) =>
    makeEvent({ verb, object, result, context, at: new Date(now()).toISOString() });

  function load(attemptId) {
    if (typeof attemptId !== 'string' || !PRA_ID.test(attemptId)) throw notFound('attempt not found');
    const a = projectPracticeAttempt(db.eventsForAttempt(attemptId));
    if (!a) throw notFound('attempt not found');
    const track = getTrack(a.trackId);
    const ex = track && track.version === a.version ? getExercise(a.trackId, a.exerciseId) : null;
    if (!ex) throw notFound('attempt exercise is not loaded');
    return { a, track, ex };
  }
  const reload = attemptId => projectPracticeAttempt(db.eventsForAttempt(attemptId));

  function startAttempt(body) {
    if (!isObj(body)) throw bad('body must be an object');
    const mode = body.mode ?? 'practice';
    if (!MODES.includes(mode)) throw bad('mode must be practice, diagnostic or review');
    const track = getTrack(body.track);
    if (!track) throw notFound('unknown track');
    const ex = getExercise(track.id, body.exercise);
    if (!ex) throw notFound('unknown exercise');
    if (mode === 'diagnostic' && !getSchedule(track.id)?.diagnostic.includes(ex.id)) {
      throw bad('exercise is not in the diagnostic');
    }
    const attemptId = newId('pra');
    const context = {
      subject: `${track.id}@${track.version}`, attemptId, promptVersions: {}, engine: 'practice',
      module: ex.module, mode, exerciseType: ex.type
    };
    const assistAllowed = mode !== 'diagnostic';
    db.appendEvents([event(context, 'started', { type: 'exercise', id: ex.id }, { assistAllowed })]);
    return { attemptId, exercise: toPublicExercise(ex), assistAllowed };
  }

  // FR-012: hit, late_hit (grace window on the previous statement) or false_interruption.
  function attribute(a, ex, idx, elapsedMs) {
    const ids = ex.narration.map(n => n.id);
    const planted = new Set(ex.answerKey.planted.map(p => p.statementId));
    const caught = new Set(a.stops.filter(isAnswered).map(s => s.attributedStatementId));
    const uncaughtPlanted = sid => planted.has(sid) && !caught.has(sid);
    if (uncaughtPlanted(ids[idx])) return { detection: 'hit', attributedStatementId: ids[idx] };
    const inGrace = Number.isInteger(elapsedMs) && elapsedMs >= 0 && elapsedMs <= GRACE_MS;
    if (idx > 0 && inGrace && uncaughtPlanted(ids[idx - 1])) return { detection: 'late_hit', attributedStatementId: ids[idx - 1] };
    return { detection: 'false_interruption', attributedStatementId: ids[idx] };
  }

  function grade(a, track, ex, statementId, text) {
    const p = plantedOf(ex, statementId);
    const t0 = now();
    const out = grader({
      answer: text,
      dimensions: {
        explanation: { items: [...p.rubric.explain] },
        correction: { items: [...p.rubric.correct], alternatives: [...p.acceptableCorrections] }
      },
      flawedText: textOf(ex, statementId),
      lexicon: track.lexicon ?? { synonyms: {} }
    });
    const dimensions = { explanation: dimOf(out, 'explanation'), correction: dimOf(out, 'correction') };
    const dims = Object.values(dimensions);
    return {
      dimensions, overall: combineOverall(dims), assisted: a.assisted,
      confidence: dims.some(d => d.confidence === 'low') ? 'low' : 'high',
      graderSource: 'matcher',
      graderVersion: typeof out?.graderVersion === 'string' ? out.graderVersion : MATCHER_VERSION,
      latencyMs: now() - t0
    };
  }

  function submitStop(attemptId, body) {
    if (!isObj(body)) throw bad('body must be an object');
    const { a, track, ex } = load(attemptId);
    if (a.completed) throw new HttpError(409, 'attempt is complete');
    if (ex.type !== 'catch') throw bad('stops are only for catch exercises');
    const ids = ex.narration.map(n => n.id);
    const idx = typeof body.statementId === 'string' ? ids.indexOf(body.statementId) : -1;
    if (idx === -1) throw bad('unknown statementId');
    const repeat = a.stops.find(s => s.statementId === body.statementId);
    if (repeat) return stopBody(repeat, ex); // FR-008: same body, no events
    if (a.stops.some(s => ids.indexOf(s.statementId) > idx)) throw bad('stop is earlier than the last stop');
    if (body.answer != null && typeof body.answer !== 'string') throw bad('answer must be a string');

    const answer = body.answer ?? '';
    const text = answer.slice(0, MAX_ANSWER_CHARS);
    const elapsedMs = Number.isInteger(body.elapsedMs) ? body.elapsedMs : null; // a client claim (ADR 0003)
    const { detection, attributedStatementId } = attribute(a, ex, idx, body.elapsedMs);
    const graded = detection === 'false_interruption'
      // Detection is the server's call, not the grader's: nothing is graded, but the outcome is recorded.
      ? { dimensions: {}, overall: null, assisted: a.assisted, confidence: 'high', graderSource: 'matcher', graderVersion: MATCHER_VERSION, latencyMs: 0 }
      : grade(a, track, ex, attributedStatementId, text);
    graded.outcome = { hit: 'caught', late_hit: 'caught_late', false_interruption: 'false_alarm' }[detection];

    const object = { type: 'exercise', id: ex.id, statement: body.statementId, part: `stop:${attributedStatementId}` };
    db.appendEvents([
      event(a.context, 'stopped', object, {
        attributedStatementId, detection, elapsedMs,
        via: VIAS.includes(body.via) ? body.via : null,
        stopLatencyMs: Number.isFinite(body.stopLatencyMs) && body.stopLatencyMs >= 0 ? body.stopLatencyMs : null
      }),
      event(a.context, 'explained', object, { text, chars: answer.length }),
      event(a.context, 'graded', object, graded)
    ]);
    // Built from the log, exactly as a repeat stop is, so the two bodies are identical.
    return stopBody(reload(attemptId).stops.at(-1), ex);
  }

  function assist(attemptId) {
    const { a, track, ex } = load(attemptId);
    if (!a.assistAllowed) throw bad('assist is not allowed in a diagnostic');
    if (!a.assisted) db.appendEvents([event(a.context, 'assisted', { type: 'exercise', id: ex.id }, { kind: 'reference' })]);
    return { assisted: true, reference: getReferences(track.id, ex.referenceIds) };
  }

  function completeBody(a, track, ex) {
    const c = a.completed;
    return {
      summary: {
        planted: ex.answerKey.planted.length, hits: c.hits, lateHits: c.lateHits, misses: c.misses,
        falseInterruptions: c.falseInterruptions, notReached: c.notReached, cleanPass: c.cleanPass, flagged: c.flagged
      },
      // Stored id lists are the record and are never recomputed (ADR 0002 Am. 2).
      missed: c.missedStatementIds.map(sid => ({ ...revealOf(plantedOf(ex, sid)), text: textOf(ex, sid) })),
      answered: a.stops.filter(isAnswered).map(s => {
        const p = plantedOf(ex, s.attributedStatementId);
        return {
          part: partOf(s), answer: s.answer, result: publicResult(s.graded),
          rubric: { explain: [...p.rubric.explain], correct: [...p.rubric.correct] },
          acceptableCorrections: [...p.acceptableCorrections], selfRating: a.selfRatings[partOf(s)] ?? null
        };
      }),
      reference: getReferences(track.id, ex.referenceIds),
      sources: ex.sources.map(s => ({ title: s.title, url: s.url, verified: s.verified, ...(s.note !== undefined && { note: s.note }) })),
      followUp: typeof ex.followUp === 'string'
        ? { question: ex.followUp, graded: false }
        : { question: ex.followUp.question, graded: true },
      transfer: { scenario: ex.transfer.scenario }
    };
  }

  function complete(attemptId, body = {}) {
    if (!isObj(body)) throw bad('body must be an object');
    const { a, track, ex } = load(attemptId);
    if (ex.type !== 'catch') throw bad('complete is only for catch exercises');
    if (a.completed) return completeBody(a, track, ex); // FR-009: idempotent
    const ids = ex.narration.map(n => n.id);
    let lastIdx = ids.length - 1;
    if (body.lastStatementId != null) {
      lastIdx = typeof body.lastStatementId === 'string' ? ids.indexOf(body.lastStatementId) : -1;
      if (lastIdx === -1) throw bad('unknown lastStatementId');
    }
    lastIdx = Math.max(lastIdx, ...a.stops.map(s => ids.indexOf(s.statementId)));
    const caught = new Set(a.stops.filter(isAnswered).map(s => s.attributedStatementId));
    const uncaught = ex.answerKey.planted.map(p => p.statementId).filter(sid => !caught.has(sid));
    const missedStatementIds = uncaught.filter(sid => ids.indexOf(sid) <= lastIdx);
    const notReachedStatementIds = uncaught.filter(sid => ids.indexOf(sid) > lastIdx);
    const count = d => a.stops.filter(s => s.detection === d).length;
    const falseInterruptions = count('false_interruption');
    db.appendEvents([event(a.context, 'completed', { type: 'exercise', id: ex.id }, {
      hits: count('hit'), lateHits: count('late_hit'), misses: missedStatementIds.length, falseInterruptions,
      notReached: notReachedStatementIds.length,
      cleanPass: ex.answerKey.planted.length === 0 && falseInterruptions === 0 && lastIdx === ids.length - 1,
      flagged: a.stops.filter(s => s.graded?.overall === 'uncertain').length,
      missedStatementIds, notReachedStatementIds
    })]);
    return completeBody(reload(attemptId), track, ex);
  }

  function selfRate(attemptId, body) {
    if (!isObj(body)) throw bad('body must be an object');
    const { a, ex } = load(attemptId);
    if (!a.completed) throw bad('self-rating opens after complete');
    if (!RATINGS.includes(body.rating)) throw bad('rating must be had_it, partly or missed_it');
    const stop = a.stops.find(s => isAnswered(s) && partOf(s) === body.part);
    if (!stop) throw bad('part has no answer to rate');
    const matcherStatus = stop.graded.overall;
    db.appendEvents([event(a.context, 'self-rated', { type: 'exercise', id: ex.id, part: body.part },
      { rating: body.rating, matcherStatus, graderVersion: stop.graded.graderVersion })]);
    return { part: body.part, rating: body.rating, matcherStatus };
  }

  return { startAttempt, submitStop, assist, complete, selfRate };
}
