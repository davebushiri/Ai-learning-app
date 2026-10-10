// F1a-T20: pack format v1 (ADR 0006 + Amendment 1). FR-019, FR-020, FR-021, FR-023.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { validatePack, ratingLabel, RATING_KEYS } from '../shared/pack.js';
// Today's sources of the copied values. T07b deletes or rewires these and
// replaces the imports with frozen literals.
import { TRADES, listTrades } from '../server/prompts/trades.js';
import { SCENARIO_SYSTEM } from '../server/prompts/scenario.js';
import { mockGrade } from '../shared/mock-grader.js';

const PACK_URL = new URL('../packs/demo-trades/pack.json', import.meta.url);
const loadPack = () => JSON.parse(readFileSync(PACK_URL, 'utf8'));

test('demo-trades pack.json validates', () => {
  assert.deepEqual(validatePack(loadPack()), []);
});

test('validatePack never throws on null, [], \'x\', a cyclic object and a 5 MB string', () => {
  const cyclic = { id: 'demo-trades' };
  cyclic.self = cyclic;
  cyclic.scenarios = [cyclic];
  const huge = 'x'.repeat(5 * 1024 * 1024);
  const hugePack = { ...loadPack(), title: huge };
  const cases = { null: null, undefined, '[]': [], "'x'": 'x', 42: 42, cyclic, '5 MB string': huge, 'pack with a 5 MB title': hugePack };
  for (const [name, input] of Object.entries(cases)) {
    const problems = validatePack(input);
    assert.ok(Array.isArray(problems), 'returns an array');
    assert.ok(problems.length > 0, `rejects ${name}`);
    assert.ok(problems.every(p => typeof p === 'string'));
  }
});

test('validatePack rejects 3 tiers', () => {
  const p = loadPack();
  p.ratings.tiers = p.ratings.tiers.slice(0, 3);
  assert.ok(validatePack(p).length > 0);
});

test('validatePack rejects a missing copy.falseAlarmFeedback', () => {
  const p = loadPack();
  delete p.copy.falseAlarmFeedback;
  assert.ok(validatePack(p).length > 0);
});

test('validatePack rejects a fixture name with a slash', () => {
  const p = loadPack();
  p.scenarios[0].fixture = '../electrical.json';
  assert.ok(validatePack(p).length > 0);
  p.scenarios[0].fixture = 'sub/electrical.json';
  assert.ok(validatePack(p).length > 0);
});

test('validatePack rejects a scenario without a non-empty string hazardHints (keeps F1a-B15 unreachable)', () => {
  for (const bad of [undefined, '', '   ', 7, ['a']]) {
    const p = loadPack();
    if (bad === undefined) delete p.scenarios[1].hazardHints; else p.scenarios[1].hazardHints = bad;
    assert.ok(validatePack(p).length > 0, `rejects hazardHints=${JSON.stringify(bad)}`);
  }
});

test('validatePack rejects a bad id, a non-integer version and missing required fields', () => {
  const cases = [
    p => { p.id = 'Demo Trades'; },
    p => { p.id = 'a'.repeat(41); },
    p => { p.version = 0; },
    p => { p.version = 1.5; },
    p => { p.version = '1'; },
    p => { delete p.title; },
    p => { delete p.severity.minor; },
    p => { delete p.ratings.missedCritical; },
    p => { delete p.copy.cleanRun; },
    p => { delete p.provenance; },
    p => { delete p.provenance.builtBy; },
    p => { p.scenarios = []; },
    p => { delete p.scenarios[0].brief; },
    p => { delete p.scenarios[0].label; },
    p => { delete p.scenarios[0].id; },
    p => { p.scenarios[0].criticalHints = 'not an array'; },
    p => { p.scenarios[0].twists = [1]; },
    p => { p.grading.synonyms = { test: 'check' }; }
  ];
  for (const mutate of cases) {
    const p = loadPack();
    mutate(p);
    assert.ok(validatePack(p).length > 0, `rejects ${mutate}`);
  }
});

test('validatePack accepts a pack without the optional grading, criticalHints and twists', () => {
  const p = loadPack();
  delete p.grading;
  for (const s of p.scenarios) { delete s.criticalHints; delete s.twists; }
  assert.deepEqual(validatePack(p), []);
});

test('validatePack enforces the caps on scenarios, string length and synonyms', () => {
  const tooMany = loadPack();
  tooMany.scenarios = Array.from({ length: 51 }, (_, i) => ({ ...tooMany.scenarios[0], id: `s${i}` }));
  assert.ok(validatePack(tooMany).length > 0, '51 scenarios');

  const longString = loadPack();
  longString.scenarios[2].twists.push('y'.repeat(2001));
  assert.ok(validatePack(longString).length > 0, 'string over 2000 chars');

  const atLimit = loadPack();
  atLimit.scenarios[2].twists.push('y'.repeat(2000));
  assert.deepEqual(validatePack(atLimit), [], 'string of exactly 2000 chars');

  const manyTerms = loadPack();
  manyTerms.grading.synonyms = Object.fromEntries(Array.from({ length: 201 }, (_, i) => [`t${i}`, ['a']]));
  assert.ok(validatePack(manyTerms).length > 0, '201 synonym terms');

  const manyForms = loadPack();
  manyForms.grading.synonyms.test = Array.from({ length: 21 }, (_, i) => `f${i}`);
  assert.ok(validatePack(manyForms).length > 0, '21 forms for one term');
});

test('ratingLabel maps all 5 keys to today\'s 5 strings', () => {
  const { ratings } = loadPack();
  assert.deepEqual(RATING_KEYS, ['missedCritical', 'tier0', 'tier1', 'tier2', 'tier3']);
  // Frozen from shared/scoring.js:73-80 as of F1a-T20.
  const today = {
    missedCritical: 'Someone got hurt',
    tier0: 'Journeyman eyes',
    tier1: 'Solid supervisor',
    tier2: 'Keep watching',
    tier3: 'Back to the classroom'
  };
  for (const key of RATING_KEYS) assert.equal(ratingLabel(ratings, key), today[key], key);
});

test('ratingLabel returns null for unknown keys and bad ratings', () => {
  const { ratings } = loadPack();
  for (const key of ['tier4', 'tier-1', 'rating', '', undefined, 'constructor', '__proto__', 'tiers']) {
    assert.equal(ratingLabel(ratings, key), null, String(key));
  }
  assert.equal(ratingLabel(null, 'tier0'), null);
  assert.equal(ratingLabel({}, 'missedCritical'), null);
});

test('copy, severity, synonyms and scenario fields equal today\'s literals', () => {
  const p = loadPack();
  assert.equal(p.id, 'demo-trades');
  assert.equal(p.version, 1);
  assert.equal(p.title, 'Trades demo');
  assert.deepEqual(p.provenance, { builtBy: 'hand' });
  for (const k of ['format', 'generation', 'cards']) assert.ok(!(k in p), `no ${k} field`);

  // Clean-run line: web/app.js:228.
  assert.equal(p.copy.cleanRun, 'Clean job. Nobody got hurt.');
  assert.ok(readFileSync(new URL('../web/app.js', import.meta.url), 'utf8').includes(`'${p.copy.cleanRun}'`));

  // False-alarm feedback: today's mockGrade on a step without an error.
  const scenario = { steps: [{ id: 1, line: 'x', error: null }] };
  assert.equal(p.copy.falseAlarmFeedback, mockGrade(scenario, 1, 'anything at all').feedback);

  // Severity meanings: server/prompts/scenario.js:13.
  for (const sev of ['critical', 'major', 'minor']) {
    assert.ok(SCENARIO_SYSTEM.includes(`"${sev}" (${p.severity[sev]})`), sev);
  }

  // Synonyms: SYNONYMS in shared/mock-grader.js is not exported, so it is frozen here.
  assert.deepEqual(p.grading.synonyms, {
    test: ['check', 'verify', 'make sure', 'volt stick', 'tick tester', 'probe', 'measure', 'meter'],
    live: ['alive', 'hot', 'power', 'energized', 'electric', 'juice', 'voltage', 'still on', 'dead', 'off', 'de-energized', 'deenergized', 'no power'],
    dead: ['live', 'off', 'de-energized', 'deenergized', 'no power'],
    circuit: ['different breaker', 'another breaker', 'other breaker', 'separate breaker', 'wrong breaker'],
    gfci: ['ground fault', 'gfi', 'gfic', 'g f c i', 'g f i'],
    backstab: ['stab', 'push in', 'push-in', 'quick connect'],
    nitrogen: ['nitro', 'n2', 'dry nitrogen'],
    purge: ['purging', 'flow'],
    extinguisher: ['fire bottle', 'fire extinguisher'],
    'jack stand': ['jackstand', 'stands', 'axle stand'],
    pump: ['pump up', 'seat the pads', 'bring the pads out', 'pads back out', 'pads out'],
    pedal: ['brakes']
  });
  const mockSrc = readFileSync(new URL('../shared/mock-grader.js', import.meta.url), 'utf8');
  for (const [term, forms] of Object.entries(p.grading.synonyms)) {
    const key = /^[a-z]+$/.test(term) ? term : `'${term}'`;
    assert.ok(mockSrc.includes(`  ${key}: [${forms.map(f => `'${f}'`).join(', ')}]`), `synonyms.${term} matches mock-grader.js`);
  }

  // Scenarios: server/prompts/trades.js, in listTrades() order.
  assert.deepEqual(p.scenarios.map(s => s.id), listTrades().map(t => t.id));
  assert.deepEqual(p.scenarios, listTrades().map(({ id }) => ({ id, ...TRADES[id] })));
});
