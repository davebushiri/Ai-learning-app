// Shared helpers for the F1c acceptance tests (F1c-T01a). F1c-T01b (e2e) reuses the pack paths
// and practiceLeakScan.
//
// Everything here observes what an API caller sees (HTTP responses, the SQLite file the server
// writes, opened read-only) or reads QA-owned fixture data. The only product imports are done
// by the tests themselves, lazily, for the in-process labelled sets (spec SC-003, SC-003b).

import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../helpers/server.mjs';
import { request } from './helpers.mjs';

export { request, tempDbPath, allEvents, eventsFor } from './helpers.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '..', '..');
export const FIXTURES = path.join(ROOT, 'tests', 'fixtures', 'practice');
export const ACCEPT_PACK_DIR = path.join(FIXTURES, 'accept-pack');
export const TRACK = 'kite-craft'; // accept-pack's manifest id
export const PRA_ID_RE = /^pra_[0-9A-HJKMNP-TV-Z]{26}$/;

// ---------------------------------------------------------------------------
// practiceLeakScan (spec FR-004, SC-001; review C5)
// ---------------------------------------------------------------------------

export const FR004_KEYS = Object.freeze([
  'answerKey', 'planted', 'clean', 'misconception', 'whyWrong', 'acceptableCorrections', 'exceptions', 'kind',
  'rubric', 'explain', 'correct', 'mustCover', 'strongSignals', 'redFlags', 'clarifications', 'askAbout', 'reveal',
  'acceptableArchitectures', 'mustInclude', 'strengths', 'tradeoffs', 'challenges', 'followUps', 'followUp',
  'transfer', 'reference', 'sources', 'note', 'correctedText'
]);
const FLAGGED = new Set(FR004_KEYS);

const freezeAll = o => Object.freeze(Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Object.freeze([...v])])));

// Exactly the FR-004 exception paths, by response kind. `complete` and later responses are not scanned.
export const LEAK_ALLOW = freezeAll({
  stop: ['reveal'],
  clarification: ['reveal'],
  assist: ['reference'],
  schedule: ['plan[].blocks[].kind'],
  progress: ['concepts[].readiness.transfer'],
  other: []
});

const childPath = (base, key) => {
  if (typeof key === 'number') return `${base}[${key}]`;
  const name = /^[A-Za-z_$][\w$]*$/.test(key) ? key : `[${JSON.stringify(key)}]`;
  if (!base) return name;
  return name.startsWith('[') ? `${base}${name}` : `${base}.${name}`;
};

// `plan[3].blocks[0].kind` → `plan[].blocks[].kind`; a pattern allows its path and everything beneath.
const allowedBy = (p, patterns) => {
  const generic = p.replace(/\[\d+\]/g, '[]');
  return patterns.some(pat => generic === pat || generic.startsWith(`${pat}.`) || generic.startsWith(`${pat}[`));
};

/**
 * The JSON paths (`a.b[2].c`) of every FR-004 key in `json` whose path matches no `allow` pattern.
 * Never throws: a cycle is reported as "<cycle>", an unreadable value as "<unreadable>".
 */
export function practiceLeakScan(json, { allow = [] } = {}) {
  const hits = [];
  const patterns = Array.isArray(allow) ? allow.filter(a => typeof a === 'string') : [];
  const ancestors = new Set();
  const walk = (value, at) => {
    if (value === null || typeof value !== 'object') return;
    if (ancestors.has(value)) { hits.push('<cycle>'); return; }
    ancestors.add(value);
    try {
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) walk(value[i], childPath(at, i));
        return;
      }
      for (const key of Object.keys(value)) {
        const p = childPath(at, key);
        if (allowedBy(p, patterns)) continue; // allowed, with everything beneath it
        if (FLAGGED.has(key)) hits.push(p);
        walk(value[key], p);
      }
    } catch {
      hits.push('<unreadable>');
    } finally {
      ancestors.delete(value);
    }
  };
  try { walk(json, ''); } catch { hits.push('<unreadable>'); }
  return hits;
}

// ---------------------------------------------------------------------------
// Fixture packs (read as data)
// ---------------------------------------------------------------------------

const readJson = file => JSON.parse(readFileSync(file, 'utf8'));

// {manifest, schedule, exercises: Map, references: Map}: the shape validatePracticePack takes (F1c-T02).
export function readPackDir(dir = ACCEPT_PACK_DIR) {
  const exercises = new Map();
  for (const f of readdirSync(path.join(dir, 'exercises')).filter(f => f.endsWith('.json')).sort()) {
    exercises.set(f.replace(/\.json$/, ''), readJson(path.join(dir, 'exercises', f)));
  }
  const references = new Map();
  for (const f of readdirSync(path.join(dir, 'reference')).filter(f => f.endsWith('.md')).sort()) {
    references.set(f.replace(/\.md$/, ''), readFileSync(path.join(dir, 'reference', f), 'utf8'));
  }
  return { manifest: readJson(path.join(dir, 'practice.json')), schedule: readJson(path.join(dir, 'schedule.json')), exercises, references };
}

export const readLabelled = () => readJson(path.join(FIXTURES, 'labelled-answers.json'));
export const readM1Labelled = () => readJson(path.join(FIXTURES, 'm1-labelled-answers.json'));

// ---------------------------------------------------------------------------
// Server and HTTP
// ---------------------------------------------------------------------------

// PRACTICE_PACKS_DIR (spec FR-002) is a directory OF packs: the loader reads <dir>/<name>/practice.json.
// accept-pack is one pack, so tests point the server at a temp parent holding a copy of it as
// <tmp>/kite-craft (made once per process, removed on exit).
let acceptParent = null;
export function acceptPacksDir() {
  if (acceptParent) return acceptParent;
  acceptParent = mkdtempSync(path.join(tmpdir(), 'f1c-accept-'));
  cpSync(ACCEPT_PACK_DIR, path.join(acceptParent, TRACK), { recursive: true });
  process.once('exit', () => rmSync(acceptParent, { recursive: true, force: true }));
  return acceptParent;
}

// Every F1c server runs MOCK (no AI call is made by the practice engine anyway) on a free port.
export const startPractice = ({ packsDir = acceptPacksDir(), dbPath, env = {} } = {}) =>
  startServer({ MOCK: '1', PRACTICE_PACKS_DIR: packsDir, ...(dbPath ? { DB_PATH: dbPath } : {}), ...env });

export function api(base) {
  const get = p => request(base, 'GET', p);
  const post = (p, body = {}) => request(base, 'POST', p, body);
  const att = id => `/api/practice/attempts/${encodeURIComponent(id)}`;
  const tr = id => `/api/practice/tracks/${encodeURIComponent(id)}`;
  return {
    get, post,
    tracks: () => get('/api/practice/tracks'),
    track: (id = TRACK) => get(tr(id)),
    progress: (id = TRACK) => get(`${tr(id)}/progress`),
    schedule: (id = TRACK) => get(`${tr(id)}/schedule`),
    review: (id = TRACK) => get(`${tr(id)}/review`),
    start: (exercise, extra = {}) => post('/api/practice/attempts', { track: TRACK, exercise, ...extra }),
    stop: (id, body) => post(`${att(id)}/stops`, body),
    assist: id => post(`${att(id)}/assist`, {}),
    complete: (id, body = {}) => post(`${att(id)}/complete`, body),
    selfRate: (id, body) => post(`${att(id)}/self-ratings`, body),
    answer: (id, body) => post(`${att(id)}/answers`, body),
    clarify: (id, body) => post(`${att(id)}/clarifications`, body)
  };
}

// Asserts a 200 and returns the parsed body, so a failure names the step.
export function ok(r, label) {
  assert.equal(r.status, 200, `${label}: ${r.status} ${r.text}`);
  assert.ok(r.json !== null, `${label}: body is not JSON: ${r.text}`);
  return r.json;
}

// ---------------------------------------------------------------------------
// Labelled sets (SC-003, SC-003b): the grader input a part implies (tasks.md "Shared shapes",
// F1c-T07 part-to-dimension mapping), and the pre-registered thresholds.
// ---------------------------------------------------------------------------

const asItems = rubric => (Array.isArray(rubric) ? rubric : null);

// {input, dims}: the GraderInput for one part, and the dimension names whose combination is the part status.
export function graderInputFor(ex, part, answer, lexicon = { synonyms: {} }) {
  const base = { answer, lexicon };
  let m;
  if ((m = /^stop:(.+)$/.exec(part))) {
    const p = ex.answerKey.planted.find(x => x.statementId === m[1]);
    if (!p) throw new Error(`${ex.id}: ${m[1]} is not planted`);
    const flawedText = ex.narration.find(n => n.id === m[1]).text;
    return {
      dims: ['explanation', 'correction'],
      input: { ...base, flawedText, dimensions: {
        explanation: { items: p.rubric.explain },
        correction: { items: p.rubric.correct, alternatives: p.acceptableCorrections } } }
    };
  }
  if ((m = /^teachBack:(\d+)$/.exec(part))) return { dims: ['explanation'], input: { ...base, dimensions: { explanation: { items: ex.teachBack[+m[1]].rubric } } } };
  if (part === 'interview') {
    return { dims: ['explanation'], input: { ...base, redFlags: ex.rubric.redFlags, strongSignals: ex.rubric.strongSignals,
      dimensions: { explanation: { items: ex.rubric.mustCover } } } };
  }
  if (part === 'design') {
    return { dims: ['explanation'], input: { ...base, redFlags: ex.rubric.redFlags, strongSignals: ex.rubric.strongSignals,
      dimensions: { explanation: { items: ex.rubric.mustCover,
        architectures: ex.acceptableArchitectures.map(a => (a.mustInclude ? { id: a.id, mustInclude: a.mustInclude } : { id: a.id })) } } } };
  }
  if ((m = /^(followUps|challenges):(\d+)$/.exec(part))) {
    const items = asItems(ex[m[1]][+m[2]]?.rubric);
    if (!items) throw new Error(`${ex.id}: ${part} has no rubric (string follow-ups are self-rated only)`);
    return { dims: ['defense'], input: { ...base, dimensions: { defense: { items } } } };
  }
  if (part === 'followUp') {
    if (!asItems(ex.followUp?.rubric)) throw new Error(`${ex.id}: followUp has no rubric`);
    return { dims: ['tradeoffs'], input: { ...base, dimensions: { tradeoffs: { items: ex.followUp.rubric } } } };
  }
  if (part === 'transfer') return { dims: ['transfer'], input: { ...base, dimensions: { transfer: { items: ex.transfer.rubric } } } };
  throw new Error(`unknown part ${part}`);
}

export const STATUSES = ['met', 'partial', 'not_met', 'uncertain'];
export const CLASSES = ['clear', 'incorrect', 'partial', 'valid-alternative', 'should-flag'];
const asList = e => (Array.isArray(e) ? e : [e]);

/**
 * rows: [{class, expect: Status | Status[], actual: Status}]. Returns {table, lines, failures}.
 * Thresholds (spec SC-003, pre-registered): clear → met 100%; incorrect → never met; valid-alternative
 * → never not_met and in `expect` ≥ 75% (a listed alternative counts, SC-003b); partial → partial or
 * uncertain ≥ 80%; should-flag → uncertain ≥ 80%; uncertain over clear + incorrect together ≤ 20%.
 * A class with no rows has nothing to check (reported in `lines`).
 */
export function evaluateThresholds(rows) {
  const table = Object.fromEntries(CLASSES.map(c => [c, Object.fromEntries(STATUSES.map(s => [s, 0]))]));
  for (const r of rows) {
    table[r.class] ??= Object.fromEntries(STATUSES.map(s => [s, 0]));
    table[r.class][r.actual] = (table[r.class][r.actual] ?? 0) + 1;
  }
  const of = c => rows.filter(r => r.class === c);
  const share = (list, pred) => (list.length ? list.filter(pred).length / list.length : null);
  const failures = [];
  const lines = [];
  const check = (label, value, okFn) => {
    if (value === null) { lines.push(`${label}: no rows`); return; }
    const pct = `${Math.round(value * 1000) / 10}%`;
    lines.push(`${label}: ${pct}`);
    if (!okFn(value)) failures.push(`${label}: ${pct}`);
  };
  check('clear → met (100%)', share(of('clear'), r => r.actual === 'met'), v => v === 1);
  check('incorrect → met (0%)', share(of('incorrect'), r => r.actual === 'met'), v => v === 0);
  check('valid-alternative → not_met (0%)', share(of('valid-alternative'), r => r.actual === 'not_met'), v => v === 0);
  check('valid-alternative → expected (≥ 75%)', share(of('valid-alternative'), r => asList(r.expect).includes(r.actual)), v => v >= 0.75);
  check('partial → partial or uncertain (≥ 80%)', share(of('partial'), r => ['partial', 'uncertain'].includes(r.actual)), v => v >= 0.8);
  check('should-flag → uncertain (≥ 80%)', share(of('should-flag'), r => r.actual === 'uncertain'), v => v >= 0.8);
  check('clear + incorrect → uncertain (≤ 20%)', share([...of('clear'), ...of('incorrect')], r => r.actual === 'uncertain'), v => v <= 0.2);
  return { table, lines, failures };
}

export function formatConfusion(table) {
  const pad = (s, n) => String(s).padEnd(n);
  const out = [`${pad('class', 18)}${STATUSES.map(s => pad(s, 10)).join('')}`];
  for (const [c, counts] of Object.entries(table)) out.push(`${pad(c, 18)}${STATUSES.map(s => pad(counts[s] ?? 0, 10)).join('')}`);
  return out;
}
