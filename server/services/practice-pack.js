// Practice pack format v1: validator, loader and registry (ADR 0008; F1c spec "Exercise schema").
//
// All practice pack text is untrusted, so a pack is validated before anything reads it, and a bad
// pack is skipped with one [practice] warning: the server still starts. It follows the
// server/packs.js pattern: canonical JSON stored once per (id, version), deep freeze, Map
// registries. Answer keys and rubrics never leave this module except through the practice
// service; anything sent to the browser before grading goes through toPublicExercise.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from '../http.js';
import { getDb } from '../db.js';
import * as subjectPacks from '../packs.js';

const DEFAULT_DIR = path.join(ROOT, 'packs');
const FORMAT = 'practice-v1';
const LIMITS = {
  string: 2000, array: 20, narration: 20, exercises: 100, alternatives: 8, note: 200,
  referenceBytes: 50 * 1024, synonymTerms: 200, synonymForms: 20, diagnostic: 6, objective: 300
};
const ID_RE = /^[a-z0-9-]{1,60}$/;
const STATEMENT_RE = /^[a-z0-9-]{1,20}$/;
const KIND_RE = /^[a-z0-9-]{1,40}$/;
const TYPES = ['learn', 'catch', 'scenario', 'interview'];
const BLOCK_KINDS = ['diagnostic', 'learn', 'catch', 'scenario', 'interview', 'review'];
const PRACTICE_KINDS = new Set(['catch', 'scenario', 'interview', 'review']);
const NO_EXERCISE_KINDS = new Set(['diagnostic', 'review']);
const MIN_PRACTICE_SHARE = 0.6; // "mostly practice": a provisional product choice (spec)

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const isMap = v => v instanceof Map;

// Lowercase words separated by single spaces, so case, punctuation and spacing don't hide a match.
const normalize = s => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function validatePracticePack(input) {
  const problems = [];
  try {
    check(input, problems);
  } catch (err) {
    // A getter or proxy in hostile input must not crash the caller.
    problems.push(`pack could not be read: ${err?.name ?? 'error'}`);
  }
  return problems;
}

function check(input, problems) {
  if (!isObj(input)) { problems.push('pack must be an object'); return; }
  const { manifest, schedule, exercises, references } = input;
  const add = msg => problems.push(msg);

  // Generic shape helpers. Each reports at `where` and returns whether the value is usable.
  const str = (v, where, { max = LIMITS.string, optional = false, allowEmpty = false } = {}) => {
    if (v === undefined && optional) return true;
    if (typeof v !== 'string' || (!allowEmpty && !v.trim())) { add(`${where} must be a non-empty string`); return false; }
    if (v.length > max) { add(`${where} is longer than ${max} chars`); return false; }
    return true;
  };
  const arr = (v, where, { min = 0, max = LIMITS.array } = {}) => {
    if (!Array.isArray(v)) { add(`${where} must be an array`); return false; }
    if (v.length < min) { add(`${where} must have at least ${min} entr${min === 1 ? 'y' : 'ies'}`); return false; }
    if (v.length > max) { add(`${where} has more than ${max} entries`); return false; }
    return true;
  };
  const obj = (v, where) => {
    if (isObj(v)) return true;
    add(`${where} must be an object`);
    return false;
  };
  const strList = (v, where, opts) => {
    if (arr(v, where, opts)) v.forEach((s, i) => str(s, `${where}[${i}]`));
  };
  // A rubric item is one or more alternatives separated by '|' (C1).
  const item = (v, where) => {
    if (!str(v, where)) return;
    const alts = v.split('|');
    if (alts.some(a => !a.trim())) add(`${where} has an empty alternative`);
    if (alts.length > LIMITS.alternatives) add(`${where} has more than ${LIMITS.alternatives} alternatives`);
  };
  const items = (v, where, { min = 0 } = {}) => {
    if (arr(v, where, { min })) v.forEach((s, i) => item(s, `${where}[${i}]`));
  };
  const question = (v, where) => {
    if (obj(v, where)) { str(v.question, `${where}.question`); items(v.rubric, `${where}.rubric`, { min: 1 }); }
  };
  const idList = (v, where, known, opts) => {
    if (!arr(v, where, opts)) return;
    v.forEach((id, i) => {
      if (typeof id !== 'string' || !known.has(id)) add(`${where}[${i}] is not an exercise in this pack`);
    });
  };

  // --- manifest ---
  const moduleOf = new Map(); // exerciseId -> module id that lists it
  if (obj(manifest, 'practice.json')) {
    if (manifest.format !== FORMAT) add(`practice.json format must be "${FORMAT}"`);
    if (typeof manifest.id !== 'string' || !ID_RE.test(manifest.id)) add('practice.json id must match ^[a-z0-9-]{1,60}$');
    if (!Number.isInteger(manifest.version) || manifest.version < 1) add('practice.json version must be an integer >= 1');
    str(manifest.title, 'practice.json title');
    if (manifest.provenance !== undefined) obj(manifest.provenance, 'practice.json provenance');
    if (arr(manifest.modules, 'practice.json modules', { min: 1 })) {
      const ids = new Set();
      manifest.modules.forEach((m, i) => {
        const where = `practice.json modules[${i}]`;
        if (!obj(m, where)) return;
        if (typeof m.id !== 'string' || !ID_RE.test(m.id)) add(`${where}.id must match ^[a-z0-9-]{1,60}$`);
        else if (ids.has(m.id)) add(`${where}.id ${m.id} is a duplicate`);
        else ids.add(m.id);
        str(m.title, `${where}.title`);
        if (!arr(m.exercises, `${where}.exercises`, { min: 1, max: LIMITS.exercises })) return;
        m.exercises.forEach((id, j) => {
          if (typeof id !== 'string') { add(`${where}.exercises[${j}] must be a string`); return; }
          if (moduleOf.has(id)) add(`${where}.exercises[${j}] ${id} is listed twice`);
          else moduleOf.set(id, m.id);
          if (!isMap(exercises) || !exercises.has(id)) add(`${where}.exercises[${j}] ${id} has no exercise file`);
        });
      });
    }
    if (manifest.lexicon !== undefined && obj(manifest.lexicon, 'practice.json lexicon')) {
      const syn = manifest.lexicon.synonyms;
      if (obj(syn, 'practice.json lexicon.synonyms')) {
        const terms = Object.keys(syn);
        if (terms.length > LIMITS.synonymTerms) add(`practice.json lexicon.synonyms has more than ${LIMITS.synonymTerms} terms`);
        for (const t of terms.slice(0, LIMITS.synonymTerms)) {
          str(t, `practice.json lexicon.synonyms term "${t.slice(0, 40)}"`, { max: 200 });
          strList(syn[t], `practice.json lexicon.synonyms.${t.slice(0, 40)}`, { max: LIMITS.synonymForms });
        }
      }
    }
  }

  // --- references ---
  const refs = isMap(references) ? references : new Map();
  if (!isMap(references)) add('references must be a Map');
  for (const [id, text] of refs) {
    if (typeof text !== 'string') { add(`reference ${id} must be text`); continue; }
    if (Buffer.byteLength(text, 'utf8') > LIMITS.referenceBytes) add(`reference ${id} is larger than 50 KB`);
  }

  // --- exercises ---
  const known = isMap(exercises) ? new Set([...exercises.keys()].filter(k => typeof k === 'string')) : new Set();
  if (!isMap(exercises)) add('exercises must be a Map');
  else {
    if (exercises.size === 0) add('exercises must have at least 1 entry');
    if (exercises.size > LIMITS.exercises) add(`exercises has more than ${LIMITS.exercises} entries`);
    for (const [key, ex] of exercises) checkExercise(key, ex);
  }

  function checkExercise(key, ex) {
    const at = `exercise ${String(key).slice(0, 60)}:`;
    if (!obj(ex, `${at} file`)) return;
    if (typeof ex.id !== 'string' || !ID_RE.test(ex.id)) add(`${at} id must match ^[a-z0-9-]{1,60}$`);
    else if (ex.id !== key) add(`${at} id ${ex.id} must equal the file name`);
    if (typeof ex.module !== 'string' || moduleOf.get(key) !== ex.module) add(`${at} module must be the manifest module that lists it`);
    if (!TYPES.includes(ex.type)) add(`${at} type must be one of ${TYPES.join(', ')}`);
    str(ex.objective, `${at} objective`, { max: LIMITS.objective });
    idList(ex.prerequisites, `${at} prerequisites`, known);
    if (![1, 2, 3].includes(ex.difficulty)) add(`${at} difficulty must be 1, 2 or 3`);
    if (arr(ex.concepts, `${at} concepts`, { min: 1 })) {
      ex.concepts.forEach((c, i) => {
        if (typeof c !== 'string' || !ID_RE.test(c)) add(`${at} concepts[${i}] must match ^[a-z0-9-]{1,60}$`);
      });
    }
    if (arr(ex.referenceIds, `${at} referenceIds`, { min: 1 })) {
      ex.referenceIds.forEach((r, i) => {
        if (typeof r !== 'string' || !refs.has(r)) add(`${at} referenceIds[${i}] ${String(r).slice(0, 60)} has no reference file`);
      });
    }
    if (arr(ex.sources, `${at} sources`, { min: 1 })) {
      ex.sources.forEach((s, i) => {
        const w = `${at} sources[${i}]`;
        if (!obj(s, w)) return;
        str(s.title, `${w}.title`);
        if (str(s.url, `${w}.url`) && !s.url.startsWith('https://')) add(`${w}.url must start with https://`);
        if (typeof s.verified !== 'boolean') add(`${w}.verified must be a boolean`);
        str(s.note, `${w}.note`, { optional: true, max: LIMITS.note });
      });
    }
    if (typeof ex.followUp === 'string') str(ex.followUp, `${at} followUp`);
    else question(ex.followUp, `${at} followUp`);
    if (obj(ex.transfer, `${at} transfer`)) {
      str(ex.transfer.scenario, `${at} transfer.scenario`);
      items(ex.transfer.rubric, `${at} transfer.rubric`, { min: 1 });
    }

    if (ex.type === 'catch' || ex.type === 'learn') checkNarration(ex, at);
    if (ex.type === 'catch') checkAnswerKey(ex, at);
    if (ex.type === 'learn' && arr(ex.teachBack, `${at} teachBack`, { min: 1 })) {
      ex.teachBack.forEach((q, i) => question(q, `${at} teachBack[${i}]`));
    }
    if (ex.type === 'scenario') checkScenario(ex, at);
    if (ex.type === 'interview') {
      str(ex.question, `${at} question`);
      checkOpenRubric(ex.rubric, at);
      if (arr(ex.followUps, `${at} followUps`, { min: 1 })) {
        ex.followUps.forEach((f, i) => {
          if (typeof f === 'string') str(f, `${at} followUps[${i}]`);
          else question(f, `${at} followUps[${i}]`);
        });
      }
    }
  }

  function checkNarration(ex, at) {
    if (!arr(ex.narration, `${at} narration`, { min: 1, max: LIMITS.narration })) return;
    const ids = new Set();
    ex.narration.forEach((n, i) => {
      const w = `${at} narration[${i}]`;
      if (!obj(n, w)) return;
      if (typeof n.id !== 'string' || !STATEMENT_RE.test(n.id)) add(`${w}.id must match ^[a-z0-9-]{1,20}$`);
      else if (ids.has(n.id)) add(`${w}.id ${n.id} is a duplicate`);
      else ids.add(n.id);
      str(n.text, `${w}.text`);
    });
  }

  function checkAnswerKey(ex, at) {
    const key = ex.answerKey;
    if (!obj(key, `${at} answerKey`)) return;
    const narration = Array.isArray(ex.narration) ? ex.narration.filter(isObj) : [];
    const textOf = new Map(narration.map(n => [n.id, n.text]));
    const count = new Map(); // statement id -> times listed across planted and clean
    const bump = id => count.set(id, (count.get(id) ?? 0) + 1);

    if (arr(key.planted, `${at} answerKey.planted`)) {
      key.planted.forEach((p, i) => {
        const w = `${at} answerKey.planted[${i}]`;
        if (!obj(p, w)) return;
        if (typeof p.statementId !== 'string' || !textOf.has(p.statementId)) add(`${w}.statementId is not a narration id`);
        else bump(p.statementId);
        str(p.misconception, `${w}.misconception`);
        str(p.whyWrong, `${w}.whyWrong`);
        strList(p.acceptableCorrections, `${w}.acceptableCorrections`, { min: 1 });
        str(p.exceptions, `${w}.exceptions`, { allowEmpty: true });
        if (typeof p.kind !== 'string' || !KIND_RE.test(p.kind)) add(`${w}.kind must match ^[a-z0-9-]{1,40}$`);
        if (obj(p.rubric, `${w}.rubric`)) {
          items(p.rubric.explain, `${w}.rubric.explain`, { min: 1 });
          items(p.rubric.correct, `${w}.rubric.correct`, { min: 1 });
        }
        checkReferenceIntegrity(ex, at, p.statementId, textOf.get(p.statementId));
      });
    }
    if (arr(key.clean, `${at} answerKey.clean`, { max: LIMITS.narration })) {
      key.clean.forEach((id, i) => {
        if (typeof id !== 'string' || !textOf.has(id)) add(`${at} answerKey.clean[${i}] is not a narration id`);
        else bump(id);
      });
    }
    for (const id of textOf.keys()) {
      const n = count.get(id) ?? 0;
      if (n !== 1) add(`${at} statement ${id} must be in exactly one of planted and clean (found ${n})`);
    }
  }

  // Heuristic (spec): a trusted reference must never contain a planted (flawed) statement.
  function checkReferenceIntegrity(ex, at, statementId, text) {
    if (typeof text !== 'string' || !Array.isArray(ex.referenceIds)) return;
    const needle = normalize(text);
    if (!needle) return;
    for (const r of ex.referenceIds) {
      const ref = typeof r === 'string' ? refs.get(r) : undefined;
      if (typeof ref === 'string' && normalize(ref).includes(needle)) {
        add(`${at} planted statement ${statementId} appears in reference ${r}`);
      }
    }
  }

  function checkOpenRubric(rubric, at) {
    if (!obj(rubric, `${at} rubric`)) return;
    items(rubric.mustCover, `${at} rubric.mustCover`, { min: 1 });
    items(rubric.strongSignals, `${at} rubric.strongSignals`);
    items(rubric.redFlags, `${at} rubric.redFlags`);
  }

  function checkScenario(ex, at) {
    str(ex.brief, `${at} brief`);
    strList(ex.constraints, `${at} constraints`);
    if (arr(ex.clarifications, `${at} clarifications`)) {
      ex.clarifications.forEach((c, i) => {
        const w = `${at} clarifications[${i}]`;
        if (!obj(c, w)) return;
        items(c.askAbout, `${w}.askAbout`, { min: 1 });
        str(c.reveal, `${w}.reveal`);
      });
    }
    if (arr(ex.acceptableArchitectures, `${at} acceptableArchitectures`, { min: 1 })) {
      const ids = new Set();
      ex.acceptableArchitectures.forEach((a, i) => {
        const w = `${at} acceptableArchitectures[${i}]`;
        if (!obj(a, w)) return;
        if (typeof a.id !== 'string' || !ID_RE.test(a.id)) add(`${w}.id must match ^[a-z0-9-]{1,60}$`);
        else if (ids.has(a.id)) add(`${w}.id ${a.id} is a duplicate`);
        else ids.add(a.id);
        str(a.summary, `${w}.summary`);
        if (a.mustInclude !== undefined) items(a.mustInclude, `${w}.mustInclude`, { min: 1 });
        if (a.strengths !== undefined) strList(a.strengths, `${w}.strengths`);
        if (a.tradeoffs !== undefined) strList(a.tradeoffs, `${w}.tradeoffs`);
      });
    }
    if (arr(ex.challenges, `${at} challenges`, { min: 1 })) {
      ex.challenges.forEach((c, i) => question(c, `${at} challenges[${i}]`));
    }
    checkOpenRubric(ex.rubric, at);
  }

  // --- schedule ---
  if (!obj(schedule, 'schedule.json')) return;
  const { days, minutesPerDay } = schedule;
  const daysOk = Number.isInteger(days) && days >= 1 && days <= LIMITS.array;
  if (!daysOk) add(`schedule.json days must be an integer from 1 to ${LIMITS.array}`);
  const mpdOk = Number.isInteger(minutesPerDay) && minutesPerDay >= 1;
  if (!mpdOk) add('schedule.json minutesPerDay must be a positive integer');
  idList(schedule.diagnostic, 'schedule.diagnostic', known, { min: 1, max: LIMITS.diagnostic });
  if (!arr(schedule.plan, 'schedule.plan', { min: 1 })) return;
  if (daysOk && schedule.plan.length !== days) add(`schedule.plan must have exactly ${days} entries`);
  let total = 0;
  let practice = 0;
  schedule.plan.forEach((d, i) => {
    const w = `schedule.plan[${i}]`;
    if (!obj(d, w)) return;
    if (d.day !== i + 1) add(`${w}.day must be ${i + 1}`);
    if (!arr(d.blocks, `${w}.blocks`, { min: 1 })) return;
    let sum = 0;
    d.blocks.forEach((b, j) => {
      const bw = `${w}.blocks[${j}]`;
      if (!obj(b, bw)) return;
      if (!BLOCK_KINDS.includes(b.kind)) add(`${bw}.kind must be one of ${BLOCK_KINDS.join(', ')}`);
      if (!Number.isInteger(b.minutes) || b.minutes < 1) { add(`${bw}.minutes must be a positive integer`); return; }
      sum += b.minutes;
      if (PRACTICE_KINDS.has(b.kind)) practice += b.minutes;
      if (NO_EXERCISE_KINDS.has(b.kind)) {
        if (b.exercises !== undefined) add(`${bw}.exercises must be omitted for ${b.kind}`);
      } else {
        idList(b.exercises, `${bw}.exercises`, known, { min: 1 });
      }
    });
    total += sum;
    if (mpdOk && sum !== minutesPerDay) add(`${w} minutes sum to ${sum}, not minutesPerDay ${minutesPerDay}`);
  });
  if (total > 0 && practice / total < MIN_PRACTICE_SHARE) {
    add(`schedule.plan practice blocks are ${practice} of ${total} minutes; they must be at least ${MIN_PRACTICE_SHARE * 100}%`);
  }
}

// --- public projection (FR-004): built by allow-list, never by deleting fields ---

export function toPublicExercise(ex) {
  const pub = {
    id: ex.id, module: ex.module, type: ex.type, objective: ex.objective, difficulty: ex.difficulty,
    concepts: [...ex.concepts], prerequisites: [...ex.prerequisites]
  };
  if (ex.type === 'catch' || ex.type === 'learn') pub.narration = ex.narration.map(n => ({ id: n.id, text: n.text }));
  if (ex.type === 'scenario') {
    pub.brief = ex.brief;
    pub.constraints = [...ex.constraints];
  }
  if (ex.type === 'learn') pub.firstPrompt = { part: 'teachBack:0', prompt: ex.teachBack[0].question };
  if (ex.type === 'interview') pub.firstPrompt = { part: 'interview', prompt: ex.question };
  return pub;
}

// --- loader and registry ---

// Maps, not plain objects: a learner-supplied id like "__proto__" must never resolve to an
// inherited property.
let registry = new Map(); // trackId -> { track, schedule, exercises: Map, references: Map }

function deepFreeze(v) {
  if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const k of Object.keys(v)) deepFreeze(v[k]);
  }
  return v;
}

const fail = reason => { throw Object.assign(new Error(reason), { packReason: true }); };

function readText(file, label) {
  try {
    return readFileSync(file, 'utf8');
  } catch (e) {
    fail(`${label}: cannot be read (${e.code ?? 'error'})`);
  }
}

function readJson(file, label) {
  const text = readText(file, label);
  try {
    return JSON.parse(text);
  } catch (e) {
    fail(`${label}: not valid JSON (${e.message})`);
  }
}

// Files in a sub-folder with one extension, keyed by name without it. A missing folder is empty:
// the validator then reports the missing exercises or references.
function readFolder(dir, ext, read) {
  const out = new Map();
  let names = [];
  try {
    names = readdirSync(dir, { withFileTypes: true }).filter(d => d.isFile() && d.name.endsWith(ext)).map(d => d.name).sort();
  } catch {
    return out;
  }
  if (names.length > LIMITS.exercises) fail(`${path.basename(dir)}: more than ${LIMITS.exercises} files`);
  for (const n of names) out.set(n.slice(0, -ext.length), read(path.join(dir, n), `${path.basename(dir)}/${n}`));
  return out;
}

function loadOne(packDir, db, getPack, seen) {
  const manifest = readJson(path.join(packDir, 'practice.json'), 'practice.json');
  const schedule = readJson(path.join(packDir, 'schedule.json'), 'schedule.json');
  const exercises = readFolder(path.join(packDir, 'exercises'), '.json', readJson);
  const references = readFolder(path.join(packDir, 'reference'), '.md', readText);
  const problems = validatePracticePack({ manifest, schedule, exercises, references });
  if (problems.length) fail(problems.join('; '));

  // Both engines share the subject_pack key space (ADR 0008).
  if (getPack(manifest.id)) fail(`id ${manifest.id} is already a subject pack`);
  if (seen.has(manifest.id)) fail(`id ${manifest.id} is already a practice pack`);

  const sorted = m => Object.fromEntries([...m].sort(([a], [b]) => (a < b ? -1 : 1)));
  const stored = db.putPack({
    id: manifest.id,
    version: manifest.version,
    json: subjectPacks.canonicalJson({ manifest, schedule, exercises: sorted(exercises), references: sorted(references) }),
    provenance: manifest.provenance === undefined ? null : JSON.stringify(manifest.provenance)
  });
  if (stored === 'conflict') fail(`${manifest.id}@${manifest.version} differs from the stored copy; bump its version`);

  const track = {
    id: manifest.id, version: manifest.version, title: manifest.title,
    modules: manifest.modules.map(m => ({ id: m.id, title: m.title, exercises: [...m.exercises] })),
    lexicon: { synonyms: structuredClone(manifest.lexicon?.synonyms ?? {}) }
  };
  return { track, schedule, exercises, references };
}

// Loads every <dir>/<name>/practice.json. Never throws: each failure skips that pack with a warning.
export function loadPracticePacks(
  dir = process.env.PRACTICE_PACKS_DIR || DEFAULT_DIR,
  db = getDb(),
  { getPack } = subjectPacks
) {
  const next = new Map();
  let names = [];
  try {
    names = readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).sort();
  } catch (e) {
    console.warn(`[practice] ${path.basename(dir)} skipped: cannot be read (${e.code ?? 'error'})`);
  }
  for (const name of names) {
    const packDir = path.join(dir, name);
    if (!existsSync(path.join(packDir, 'practice.json'))) continue; // not a practice pack
    try {
      const loaded = loadOne(packDir, db, getPack, next);
      deepFreeze(loaded.track);
      deepFreeze(loaded.schedule);
      for (const ex of loaded.exercises.values()) deepFreeze(ex);
      next.set(loaded.track.id, loaded);
    } catch (e) {
      // A database error here is not a pack problem, but it still must not stop startup.
      console.warn(`[practice] ${name} skipped: ${e.packReason ? e.message : `${e.name}: ${e.message}`}`);
    }
  }
  registry = next;
  return new Map([...next].map(([id, p]) => [id, p.track]));
}

const lookup = id => (typeof id === 'string' ? registry.get(id) ?? null : null);

export function listTracks() {
  return [...registry.values()].map(({ track }) => ({ id: track.id, title: track.title, version: track.version }));
}

export function getTrack(id) {
  return lookup(id)?.track ?? null;
}

export function getExercise(trackId, exerciseId) {
  const t = lookup(trackId);
  if (!t || typeof exerciseId !== 'string') return null;
  return t.exercises.get(exerciseId) ?? null;
}

// A copy, so a caller can't add to or remove from the registry.
export function getExercises(trackId) {
  const t = lookup(trackId);
  return t ? new Map(t.exercises) : new Map();
}

export function getReferences(trackId, ids) {
  const t = lookup(trackId);
  if (!t || !Array.isArray(ids)) return [];
  return ids.filter(id => typeof id === 'string' && t.references.has(id)).map(id => ({ id, text: t.references.get(id) }));
}

export function getSchedule(trackId) {
  return lookup(trackId)?.schedule ?? null;
}
