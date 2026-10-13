// Pack loader (ADR 0006 + Amendments 1 and 2). Runs once at startup, before listen.
//
// All pack text is untrusted, so a pack is validated before anything reads it, and a bad pack
// is skipped with one [packs] warning: the server still starts. Packs are immutable per version:
// pack.json plus every scenario file is stored as canonical JSON, and a different copy under the
// same (id, version) refuses the pack until its version is bumped. Events say demo-trades@1, so
// the content behind that name must never change.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from './http.js';
import { getDb } from './db.js';
import { validatePack } from '../shared/pack.js';
import { validateScenario } from '../shared/contract.js';

const DEFAULT_DIR = path.join(ROOT, 'packs');

// Maps, not plain objects: a learner-supplied id like "__proto__" or "toString" must never
// resolve to an inherited property.
let registry = new Map(); // packId -> { pack, entries: Map<scenarioId, entry> }

// Keys sorted recursively, no whitespace, so formatting and key order are not a change.
export function canonicalJson(value) {
  const sort = v => {
    if (Array.isArray(v)) return v.map(sort);
    if (v !== null && typeof v === 'object') {
      return Object.fromEntries(Object.keys(v).sort().map(k => [k, sort(v[k])]));
    }
    return v;
  };
  return JSON.stringify(sort(value));
}

function deepFreeze(v) {
  if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const k of Object.keys(v)) deepFreeze(v[k]);
  }
  return v;
}

const fail = reason => { throw Object.assign(new Error(reason), { packReason: true }); };

function readJson(file, label) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch (e) {
    fail(`${label}: cannot be read (${e.code ?? 'error'})`);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    fail(`${label}: not valid JSON (${e.message})`);
  }
}

function loadOne(packDir, db) {
  const pack = readJson(path.join(packDir, 'pack.json'), 'pack.json');
  const problems = validatePack(pack);
  if (problems.length) fail(problems.join('; '));

  const scenarioFiles = {};
  for (const s of pack.scenarios) {
    if (Object.hasOwn(scenarioFiles, s.fixture)) continue;
    const card = readJson(path.join(packDir, 'scenarios', s.fixture), s.fixture);
    const cardProblems = validateScenario(card);
    if (cardProblems.length) fail(`${s.fixture}: ${cardProblems.join('; ')}`);
    scenarioFiles[s.fixture] = card;
  }

  const stored = db.putPack({
    id: pack.id,
    version: pack.version,
    json: canonicalJson({ pack, scenarios: scenarioFiles }),
    provenance: JSON.stringify(pack.provenance)
  });
  if (stored === 'conflict') fail(`${pack.id}@${pack.version} differs from the stored copy; bump its version`);

  const createdAt = new Date().toISOString();
  const entries = new Map();
  const scenarios = pack.scenarios.map(s => {
    const card = structuredClone(scenarioFiles[s.fixture]);
    const cardId = `fx_${pack.id}_${pack.version}_${s.id}`;
    // Fixture cards keep NULL stamps (FR-015); putCard inserts each id once.
    db.putCard({
      id: cardId, subject_id: pack.id, subject_version: pack.version, card,
      prompt_version: null, model: null, source: 'fixture', created_at: createdAt
    });
    const { fixture, ...flat } = s;
    entries.set(s.id, { ...flat, card, cardId });
    return { ...s, card };
  });
  return { pack: { ...pack, scenarios }, entries };
}

// Loads every <dir>/<id>/pack.json. Never throws: each failure skips that pack with a warning.
export function loadPacks(dir = DEFAULT_DIR, db = getDb()) {
  const next = new Map();
  let names = [];
  try {
    names = readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).sort();
  } catch (e) {
    console.warn(`[packs] ${path.basename(dir)} skipped: cannot be read (${e.code ?? 'error'})`);
  }
  for (const name of names) {
    // ADR 0008 (ARCH-1): a practice pack (practice.json, no pack.json) belongs to the practice loader.
    if (existsSync(path.join(dir, name, 'practice.json')) && !existsSync(path.join(dir, name, 'pack.json'))) continue;
    try {
      const loaded = loadOne(path.join(dir, name), db);
      deepFreeze(loaded.pack);
      for (const entry of loaded.entries.values()) deepFreeze(entry);
      next.set(loaded.pack.id, loaded);
    } catch (e) {
      // A database error here is not a pack problem, but it still must not stop startup.
      console.warn(`[packs] ${name} skipped: ${e.packReason ? e.message : `${e.name}: ${e.message}`}`);
    }
  }
  registry = next;
  return new Map([...next].map(([id, p]) => [id, p.pack]));
}

const lookup = id => (typeof id === 'string' ? registry.get(id) ?? null : null);

export function getPack(id) {
  return lookup(id)?.pack ?? null;
}

export function listSubjects() {
  return [...registry.values()].map(({ pack }) => ({ id: pack.id, title: pack.title }));
}

export function listScenarios(packId) {
  const p = lookup(packId);
  return p ? p.pack.scenarios.map(s => ({ id: s.id, label: s.label })) : null;
}

export function getScenarioEntry(packId, scenarioId) {
  const p = lookup(packId);
  if (!p || typeof scenarioId !== 'string') return null;
  return p.entries.get(scenarioId) ?? null;
}
