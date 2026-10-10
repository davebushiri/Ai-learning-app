// Shared helpers for the F1a acceptance tests (F1a-T01a). F1a-T01b and F1a-T19a reuse leakScan.
//
// Everything here observes what an API caller sees: HTTP responses, fake Claude's /__log,
// and the SQLite file the server writes (opened by the test only after or beside the server,
// the way spec US4's "independent test" describes). Nothing imports product code.

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { startServer } from '../helpers/server.mjs';

// ---------------------------------------------------------------------------
// leakScan (spec FR-011, ADR 0003 Verification + Amendment 1, review S3)
// ---------------------------------------------------------------------------

const ANSWER_KEYS = new Set(['why', 'summary', 'correctAction', 'consequence', 'keywords', 'severity']);
const STOP_ALLOWED = new Set(['severity', 'correctAction']); // only directly under the top-level `caught`

const childPath = (base, key) =>
  typeof key === 'number' ? `${base}[${key}]` : /^[A-Za-z_$][\w$]*$/.test(key) ? `${base}.${key}` : `${base}[${JSON.stringify(key)}]`;

/**
 * Returns the JSON paths (`$.a.b[0].c`) of every answer field in `json`.
 * Flagged keys: why, summary, correctAction, consequence, keywords, severity, and `error`
 * only when its value is not a string. Allowed: `$.caught.severity` and `$.caught.correctAction`
 * when kind = 'stop'; anything under `$.missed[...]` when kind = 'complete'.
 * Never throws: a cycle is reported as the path "<cycle>", an unreadable value as "<unreadable>".
 */
export function leakScan(json, { kind = 'other' } = {}) {
  const hits = [];
  const ancestors = new Set();
  const walk = (value, at, parentKey, depth) => {
    if (value === null || typeof value !== 'object') return;
    if (ancestors.has(value)) { hits.push('<cycle>'); return; }
    ancestors.add(value);
    try {
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) walk(value[i], childPath(at, i), null, depth + 1);
        return;
      }
      for (const key of Object.keys(value)) {
        const v = value[key];
        const p = childPath(at, key);
        if (kind === 'complete' && depth === 0 && key === 'missed') continue; // the reveal is allowed
        const allowedHere = kind === 'stop' && depth === 1 && parentKey === 'caught' && STOP_ALLOWED.has(key);
        if (ANSWER_KEYS.has(key) && !allowedHere) hits.push(p);
        if (key === 'error' && typeof v !== 'string') hits.push(p);
        walk(v, p, depth === 0 ? key : null, depth + 1);
      }
    } catch {
      hits.push('<unreadable>');
    } finally {
      ancestors.delete(value);
    }
  };
  try { walk(json, '$', null, 0); } catch { hits.push('<unreadable>'); }
  return hits;
}

// ---------------------------------------------------------------------------
// Frozen expectations (spec US1, FR-001, FR-003; values frozen inline, never read from a legacy route)
// ---------------------------------------------------------------------------

export const SUBJECT = 'demo-trades';
export const ATTEMPT_ID_RE = /^att_[0-9A-HJKMNP-TV-Z]{26}$/;
export const CARD_ID_LIVE_RE = /^card_[0-9A-HJKMNP-TV-Z]{26}$/;
export const SCENARIOS = [
  { id: 'electrical', label: 'Electrical: replace a receptacle' },
  { id: 'hvac', label: 'HVAC: braze a suction line' },
  { id: 'automotive', label: 'Automotive: front brake job' }
];
// Mistake step ids per scenario, and the last step id (setup data, frozen from today's cards).
export const CARDS = {
  electrical: { mistakes: { 3: 'critical', 5: 'major', 7: 'minor' }, lastStepId: 10, firstCleanStepId: 1 },
  hvac: { mistakes: { 3: 'major', 5: 'critical', 7: 'minor' }, lastStepId: 10, firstCleanStepId: 1 },
  automotive: { mistakes: { 3: 'critical', 5: 'minor', 7: 'major' }, lastStepId: 9, firstCleanStepId: 1 }
};
// MOCK explanations that today's keyword grader rates `correct` (0.8) on the electrical card.
export const GOOD = {
  3: "he didn't test it, it could still be live",
  5: 'it needs ground fault protection by the sink',
  7: 'backstab connections loosen, use the side screw terminals'
};
export const PUBLIC_CARD_KEYS = ['apprentice', 'id', 'setting', 'steps', 'subject', 'title'];
export const STOP_KEYS = ['caught', 'feedback', 'points', 'reasoningScore', 'source', 'total', 'verdict'];
export const CAUGHT_KEYS = ['correctAction', 'errorStepId', 'severity', 'stepsLate'];
export const COMPLETE_KEYS = ['caughtCount', 'cleanRunLine', 'falseAlarms', 'maxPossible', 'missed', 'missedCritical',
  'mistakeCount', 'ratingKey', 'ratingLabel', 'skippedStepIds', 'total'];
export const MISSED_KEYS = ['consequence', 'correctAction', 'points', 'severity', 'stepId', 'summary'];
export const LLM_OUTCOMES = ['ok', 'timeout', 'refusal', 'fallback', 'mock'];
export const LIVE_DEADLINES = { GRADE_DEADLINE_MS: '1500', SCENARIO_DEADLINE_MS: '2000' };

// ---------------------------------------------------------------------------
// Servers, temp databases, HTTP
// ---------------------------------------------------------------------------

export function tempDbPath() {
  const dir = mkdtempSync(path.join(tmpdir(), 'f1a-acceptance-'));
  return { dir, dbPath: path.join(dir, 'app.db'), cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

// MOCK: keyword grading and fixtures. LIVE: against fake Claude with the pinned deadlines.
export function startApp({ live = false, stub = null, dbPath, env = {} } = {}) {
  const base = live
    ? { MOCK: '0', ANTHROPIC_API_KEY: 'sk-fake', ANTHROPIC_BASE_URL: stub.url, ...LIVE_DEADLINES }
    : { MOCK: '1', ...(stub ? { ANTHROPIC_BASE_URL: stub.url } : {}) };
  return startServer({ ...base, ...(dbPath ? { DB_PATH: dbPath } : {}), ...env });
}

export async function request(baseUrl, method, pathname, body) {
  const t0 = Date.now();
  const init = { method, signal: AbortSignal.timeout(15000) }; // a test-side cap, so a hung route fails instead of stalling
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  const res = await fetch(baseUrl + pathname, init);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text, ms: Date.now() - t0 };
}

export const get = (base, p) => request(base, 'GET', p);
export const post = (base, p, body) => request(base, 'POST', p, body);
export const startAttempt = (base, body) => post(base, '/api/attempts', body);
export const postStop = (base, attemptId, body) => post(base, `/api/attempts/${attemptId}/stops`, body);
export const postComplete = (base, attemptId, body) => post(base, `/api/attempts/${attemptId}/complete`, body);

// Starts an attempt and asserts it worked, so later failures point at the right step.
export async function begin(base, scenario = 'electrical', extra = {}) {
  const r = await startAttempt(base, { subject: SUBJECT, scenario, ...extra });
  assert.equal(r.status, 200, `POST /api/attempts ${scenario}: ${r.status} ${r.text}`);
  return r.json;
}

export async function stopOk(base, attemptId, stepId, explanation) {
  const r = await postStop(base, attemptId, { stepId, explanation });
  assert.equal(r.status, 200, `STOP ${stepId}: ${r.status} ${r.text}`);
  return r.json;
}

export async function completeOk(base, attemptId, body) {
  const r = await postComplete(base, attemptId, body);
  assert.equal(r.status, 200, `complete: ${r.status} ${r.text}`);
  return r.json;
}

// Polls (state, not elapsed time) until `pred` holds or `settled` resolves first; bounded.
export async function waitUntil(pred, { settled = null, timeoutMs = 5000 } = {}) {
  let done = false;
  settled?.then(() => (done = true), () => (done = true));
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (pred()) return true;
    if (done) return pred();
    await new Promise(r => setTimeout(r, 5));
  }
  return false;
}

// ---------------------------------------------------------------------------
// Reading what the server stored (read-only; spec US4 "open the DB read-only")
// ---------------------------------------------------------------------------

function withDb(dbPath, fn) {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try { return fn(db); } finally { db.close(); }
}

const parse = s => (s === null || s === undefined ? null : JSON.parse(s));
const toEvent = r => ({
  seq: r.seq, id: r.id, at: r.at, actor: r.actor, verb: r.verb,
  object: parse(r.object_json), result: parse(r.result_json), context: parse(r.context_json)
});

export const allEvents = dbPath =>
  withDb(dbPath, db => db.prepare('SELECT * FROM event ORDER BY seq').all().map(toEvent));

export const eventsFor = (dbPath, attemptId) => allEvents(dbPath).filter(e => e.context?.attemptId === attemptId);

// The event without `seq` (the shape validateEvent and projectAttempt take).
export const bare = ({ seq, ...e }) => e;

export const llmCalls = dbPath =>
  withDb(dbPath, db => db.prepare('SELECT * FROM llm_call ORDER BY rowid').all().map(r => ({ ...r })));

export const cardRow = (dbPath, id) =>
  withDb(dbPath, db => {
    const r = db.prepare('SELECT * FROM card WHERE id = ?').get(id);
    return r ? { ...r } : null;
  });

export const cardRows = dbPath => withDb(dbPath, db => db.prepare('SELECT * FROM card').all().map(r => ({ ...r })));

// The triplets (stopped, explained, graded) of one attempt, grouped by step.
export function triplets(events) {
  const by = {};
  for (const e of events) {
    if (!['stopped', 'explained', 'graded'].includes(e.verb)) continue;
    (by[e.object.step] ??= []).push(e.verb);
  }
  return by;
}

// SC-007: a well-formed llm_call row.
export function assertLlmRow(row, { pipeline, outcome }) {
  assert.ok(row, `expected an llm_call row for ${pipeline}`);
  assert.equal(row.pipeline, pipeline);
  assert.equal(row.prompt_version, `${pipeline}@1`);
  assert.ok(typeof row.model === 'string' && row.model.length > 0, 'model is a non-empty string');
  assert.ok(Number.isInteger(row.ms), 'ms is an integer');
  assert.ok(LLM_OUTCOMES.includes(row.outcome), `outcome ${row.outcome} is one of ${LLM_OUTCOMES}`);
  assert.equal(row.outcome, outcome, `${pipeline} outcome`);
}

// SC-007 / F1a-T09: zero unrouted (kind: null) requests in fake Claude's log. Uses T09's
// assertNoUnroutedCalls once it exists; until then, the same check on the in-process log.
export async function assertNoUnroutedCalls(stub) {
  const mod = await import('../helpers/fake-claude.mjs');
  if (typeof mod.assertNoUnroutedCalls === 'function') return mod.assertNoUnroutedCalls(stub);
  assert.deepEqual(stub.log.filter(e => e.kind === null), [], 'fake Claude received unrouted requests');
}

// A declined model's partial output, the hand-off marker, then the fallback model's answer.
export const fallbackContent = text => [
  { type: 'text', text: 'I would rather not' },
  { type: 'fallback', from: { model: 'claude-opus-5-5' }, to: { model: 'claude-fallback' }, trigger: null },
  { type: 'text', text }
];
