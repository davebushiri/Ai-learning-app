// F1c-T02: practice pack format v1, validator and loader (ADR 0008; spec FR-001, FR-002, FR-004,
// SC-010 loader half). The fixture is tests/fixtures/practice/pack-basic, a fictional subject.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from '../server/db.js';
import {
  validatePracticePack, loadPracticePacks, listTracks, getTrack, getExercise, getExercises,
  getReferences, getSchedule, toPublicExercise
} from '../server/services/practice-pack.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASIC = path.join(HERE, 'fixtures', 'practice', 'pack-basic');
const readJson = f => JSON.parse(readFileSync(f, 'utf8'));

// Reads pack-basic into the validator's input shape; a fresh copy each call, so tests can mutate.
function basic() {
  const exercises = new Map();
  for (const f of readdirSync(path.join(BASIC, 'exercises')).sort()) {
    exercises.set(f.replace(/\.json$/, ''), readJson(path.join(BASIC, 'exercises', f)));
  }
  const references = new Map();
  for (const f of readdirSync(path.join(BASIC, 'reference')).sort()) {
    references.set(f.replace(/\.md$/, ''), readFileSync(path.join(BASIC, 'reference', f), 'utf8'));
  }
  return {
    manifest: readJson(path.join(BASIC, 'practice.json')),
    schedule: readJson(path.join(BASIC, 'schedule.json')),
    exercises, references
  };
}

const problemsOf = input => validatePracticePack(input);
const assertFails = (input, re) => {
  const problems = problemsOf(input);
  assert.ok(problems.some(p => re.test(p)), `expected a problem matching ${re}, got:\n${problems.join('\n')}`);
};

describe('validatePracticePack', () => {
  test('pack-basic validates with 0 problems', () => {
    assert.deepEqual(problemsOf(basic()), []);
  });

  test('zero-planted catch is valid', () => {
    const p = basic();
    assert.equal(p.exercises.get('catch-clean').answerKey.planted.length, 0);
    p.exercises.delete('catch-watering');
    p.manifest.modules[0].exercises = p.manifest.modules[0].exercises.filter(id => id !== 'catch-watering');
    p.schedule.diagnostic = ['catch-clean'];
    p.schedule.plan[0].blocks[2].exercises = ['catch-clean'];
    assert.deepEqual(problemsOf(p), []);
  });

  test('statement in both planted and clean fails', () => {
    const p = basic();
    p.exercises.get('catch-watering').answerKey.clean.push('s2');
    assertFails(p, /catch-watering.*s2.*exactly one of planted and clean/);
  });

  test('narration id in neither fails', () => {
    const p = basic();
    p.exercises.get('catch-watering').answerKey.clean = ['s1'];
    assertFails(p, /catch-watering.*s3.*exactly one of planted and clean/);
  });

  test('missing reference file fails', () => {
    const p = basic();
    p.references.delete('ref-harvest');
    assertFails(p, /interview-harvest.*referenceIds\[0\].*ref-harvest/);
  });

  test('reference containing a planted statement fails', () => {
    const p = basic();
    // Case, punctuation and spacing differences don't hide it: the check normalizes both sides.
    p.references.set('ref-beds', p.references.get('ref-beds') + '\nI  WATER the bed at noon, so the berries stay cool!\n');
    assertFails(p, /catch-watering.*planted statement s2.*ref-beds/);
  });

  test('schedule minutes must sum to minutesPerDay', () => {
    const p = basic();
    p.schedule.plan[1].blocks[2].minutes = 15;
    assertFails(p, /schedule\.plan\[1\].*65.*minutesPerDay 60/);
  });

  test('practice share below 60% fails', () => {
    const p = basic();
    // Day 1: 10 diagnostic + 40 learn + 10 catch; day 2: 30 learn + 20 interview + 10 review.
    p.schedule.plan[0].blocks[1].minutes = 40;
    p.schedule.plan[0].blocks[2].minutes = 10;
    p.schedule.plan[1].blocks[0] = { kind: 'learn', minutes: 30, exercises: ['learn-beds'] };
    assertFails(p, /practice.*40 of 120 minutes.*60%/);
  });

  test('caps enforced', () => {
    const cases = [
      [p => { p.exercises.get('scenario-orchard').brief = 'x'.repeat(2001); }, /scenario-orchard.*brief.*2000/],
      [p => { p.exercises.get('learn-beds').objective = 'x'.repeat(301); }, /learn-beds.*objective.*300/],
      [p => { p.exercises.get('scenario-orchard').constraints = Array(21).fill('c'); }, /scenario-orchard.*constraints.*20/],
      [p => {
        p.exercises.get('catch-clean').narration = Array.from({ length: 21 }, (_, i) => ({ id: `s${i}`, text: 't' }));
      }, /catch-clean.*narration.*20/],
      [p => { p.references.set('ref-beds', 'a'.repeat(50 * 1024 + 1)); }, /reference ref-beds.*50 KB/],
      [p => {
        p.manifest.lexicon.synonyms = Object.fromEntries(Array.from({ length: 201 }, (_, i) => [`t${i}`, ['f']]));
      }, /lexicon\.synonyms.*200/],
      [p => { p.manifest.lexicon.synonyms.water = Array(21).fill('f'); }, /lexicon\.synonyms\.water.*20/],
      [p => { p.manifest.modules[0].exercises = Array(101).fill('learn-beds'); }, /modules\[0\]\.exercises.*100/],
      [p => { p.exercises.get('scenario-orchard').sources[0].note = 'n'.repeat(201); }, /scenario-orchard.*sources\[0\]\.note.*200/]
    ];
    for (const [mutate, re] of cases) {
      const p = basic();
      mutate(p);
      assertFails(p, re);
    }
  });

  test('rubric item with an empty | alternative fails; 9 alternatives fails; 8 passes', () => {
    for (const bad of ['a||b', 'a|', '|a', 'a| |b']) {
      const p = basic();
      p.exercises.get('interview-harvest').rubric.mustCover = [bad];
      assertFails(p, /interview-harvest.*rubric\.mustCover\[0\].*empty alternative/);
    }
    const nine = basic();
    nine.exercises.get('catch-watering').answerKey.planted[0].rubric.correct = [Array(9).fill('w').join('|')];
    assertFails(nine, /catch-watering.*rubric\.correct\[0\].*more than 8 alternatives/);

    const eight = basic();
    eight.exercises.get('catch-watering').answerKey.planted[0].rubric.correct = [Array(8).fill('w').join('|')];
    assert.deepEqual(problemsOf(eight), []);
  });

  test('sources: boolean verified with optional note ≤ 200 passes; string verified fails', () => {
    const ok = basic();
    ok.exercises.get('learn-beds').sources = [
      { title: 'A', url: 'https://a.example', verified: true, note: 'n'.repeat(200) },
      { title: 'B', url: 'https://b.example', verified: false }
    ];
    assert.deepEqual(problemsOf(ok), []);

    const bad = basic();
    bad.exercises.get('learn-beds').sources[0].verified = 'fetched-2026-10-13';
    assertFails(bad, /learn-beds.*sources\[0\]\.verified must be a boolean/);

    const http = basic();
    http.exercises.get('learn-beds').sources[0].url = 'http://a.example';
    assertFails(http, /learn-beds.*sources\[0\]\.url must start with https:\/\//);
  });

  test('string interview followUps pass; architecture without mustInclude passes', () => {
    const p = basic();
    p.exercises.get('interview-harvest').followUps = ['Only a string?', 'Another string?'];
    for (const a of p.exercises.get('scenario-orchard').acceptableArchitectures) {
      delete a.mustInclude; delete a.strengths; delete a.tradeoffs;
    }
    assert.deepEqual(problemsOf(p), []);

    const bad = basic();
    bad.exercises.get('interview-harvest').followUps = [{ question: 'Q?' }];
    assertFails(bad, /interview-harvest.*followUps\[0\]\.rubric/);
  });

  test('garbage input never throws', () => {
    const hostile = { get manifest() { throw new Error('boom'); } };
    const inputs = [
      undefined, null, 42, 'x', [], {}, hostile,
      { manifest: null, schedule: null, exercises: null, references: null },
      { manifest: [], schedule: 'x', exercises: new Map([['a', null]]), references: new Map([['r', 42]]) },
      { ...basic(), exercises: new Map([['__proto__', { id: '__proto__', type: 'catch', narration: 7 }]]) },
      { ...basic(), exercises: { not: 'a map' } }
    ];
    for (const input of inputs) {
      const problems = validatePracticePack(input);
      assert.ok(Array.isArray(problems) && problems.length > 0, `expected problems for ${String(input)}`);
      assert.ok(problems.every(p => typeof p === 'string'));
    }
  });
});

describe('toPublicExercise', () => {
  const ALLOWED = {
    catch: ['id', 'module', 'type', 'objective', 'difficulty', 'concepts', 'prerequisites', 'narration'],
    learn: ['id', 'module', 'type', 'objective', 'difficulty', 'concepts', 'prerequisites', 'narration', 'firstPrompt'],
    scenario: ['id', 'module', 'type', 'objective', 'difficulty', 'concepts', 'prerequisites', 'brief', 'constraints'],
    interview: ['id', 'module', 'type', 'objective', 'difficulty', 'concepts', 'prerequisites', 'firstPrompt']
  };

  test('toPublicExercise emits only allow-listed keys for each type', () => {
    const p = basic();
    const seen = new Set();
    for (const ex of p.exercises.values()) {
      // A stray secret on the source never reaches the projection (allow-list, not delete-list).
      const pub = toPublicExercise({ ...ex, secret: 'x' });
      seen.add(ex.type);
      assert.deepEqual(Object.keys(pub).sort(), [...ALLOWED[ex.type]].sort(), ex.id);
      if (pub.narration) {
        for (const n of pub.narration) assert.deepEqual(Object.keys(n).sort(), ['id', 'text']);
      }
    }
    assert.deepEqual([...seen].sort(), ['catch', 'interview', 'learn', 'scenario']);

    assert.deepEqual(toPublicExercise(p.exercises.get('learn-beds')).firstPrompt,
      { part: 'teachBack:0', prompt: 'Why water at dusk?' });
    assert.deepEqual(toPublicExercise(p.exercises.get('interview-harvest')).firstPrompt,
      { part: 'interview', prompt: 'How do you know a moonberry is ready?' });
    assert.deepEqual(toPublicExercise(p.exercises.get('catch-watering')).narration.map(n => n.id), ['s1', 's2', 's3']);
  });
});

describe('loadPracticePacks', () => {
  let dir, db, warnings, realWarn;
  const noPacks = { getPack: () => null };
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'f1c-practice-'));
    cpSync(BASIC, path.join(dir, 'pack-basic'), { recursive: true });
    db = openDb(':memory:');
    warnings = [];
    realWarn = console.warn;
    console.warn = (...a) => warnings.push(a.join(' '));
  });
  afterEach(() => {
    console.warn = realWarn;
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  test('pack-basic loads into deep-frozen registries', () => {
    const tracks = loadPracticePacks(dir, db, noPacks);
    assert.deepEqual(warnings, []);
    assert.deepEqual([...tracks.keys()], ['moonberry']);
    assert.deepEqual(listTracks(), [{ id: 'moonberry', title: 'Moonberry growing', version: 1 }]);
    const track = getTrack('moonberry');
    assert.deepEqual(Object.keys(track).sort(), ['id', 'lexicon', 'modules', 'title', 'version']);
    assert.deepEqual(track.lexicon, { synonyms: { water: ['irrigate', 'soak'] } });
    const ex = getExercise('moonberry', 'catch-watering');
    assert.ok(Object.isFrozen(ex) && Object.isFrozen(ex.answerKey.planted[0].rubric.explain));
    assert.equal(getExercise('moonberry', '__proto__'), null);
    assert.equal(getExercise('nope', 'catch-watering'), null);
    assert.equal(getTrack('__proto__'), null);
    assert.deepEqual([...getExercises('moonberry').keys()].sort(),
      ['catch-clean', 'catch-watering', 'interview-harvest', 'learn-beds', 'scenario-orchard']);
    assert.deepEqual(getReferences('moonberry', ['ref-harvest', 'missing']).map(r => r.id), ['ref-harvest']);
    assert.match(getReferences('moonberry', ['ref-harvest'])[0].text, /pale blue/);
    assert.equal(getSchedule('moonberry').minutesPerDay, 60);
    assert.equal(getSchedule('nope'), null);
    assert.equal(db.putPack({ id: 'moonberry', version: 1, json: '{}' }), 'conflict', 'a subject_pack row was stored');
  });

  test('an invalid practice pack is skipped with one [practice] warning', () => {
    const file = path.join(dir, 'pack-basic', 'exercises', 'catch-watering.json');
    const ex = readJson(file);
    ex.answerKey.clean = ['s1'];
    writeFileSync(file, JSON.stringify(ex));
    assert.deepEqual([...loadPracticePacks(dir, db, noPacks).keys()], []);
    assert.equal(warnings.length, 1, warnings.join('\n'));
    assert.match(warnings[0], /^\[practice\] pack-basic skipped: .*s3/);
    assert.deepEqual(listTracks(), []);
  });

  test('a directory without practice.json is ignored silently; a missing dir warns, never throws', () => {
    mkdirSync(path.join(dir, 'other'));
    writeFileSync(path.join(dir, 'other', 'pack.json'), '{}');
    assert.deepEqual([...loadPracticePacks(dir, db, noPacks).keys()], ['moonberry']);
    assert.deepEqual(warnings, []);
    assert.deepEqual([...loadPracticePacks(path.join(dir, 'nope'), db, noPacks).keys()], []);
    assert.match(warnings.join('\n'), /^\[practice\] /);
  });

  test('changed pack same version refused', () => {
    loadPracticePacks(dir, db, noPacks);
    const file = path.join(dir, 'pack-basic', 'exercises', 'learn-beds.json');
    const ex = readJson(file);
    ex.objective = 'Edited objective.';
    writeFileSync(file, JSON.stringify(ex, null, 2));
    assert.deepEqual([...loadPracticePacks(dir, db, noPacks).keys()], []);
    assert.equal(warnings.length, 1, warnings.join('\n'));
    assert.match(warnings[0], /^\[practice\] pack-basic skipped: moonberry@1 differs from the stored copy; bump its version/);
    assert.equal(getTrack('moonberry'), null);
  });

  test('practice id already held by getPack is refused with one [practice] warning', () => {
    const getPack = id => (id === 'moonberry' ? { id } : null);
    assert.deepEqual([...loadPracticePacks(dir, db, { getPack }).keys()], []);
    assert.equal(warnings.length, 1, warnings.join('\n'));
    assert.match(warnings[0], /^\[practice\] pack-basic skipped: id moonberry is already a subject pack/);
    assert.equal(db.putPack({ id: 'moonberry', version: 1, json: '{}' }), 'inserted', 'nothing was stored');
  });
});
