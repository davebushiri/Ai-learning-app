// validateScenario enforces the game rules that the scenario prompt only asks
// for in prose. A live scenario that breaks them is replaced by the fixture.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { validateScenario, SCENARIO_RULES } from '../shared/contract.js';
import { TRADES } from '../server/prompts/trades.js';
import { SCENARIO_SYSTEM, scenarioUserPrompt } from '../server/prompts/scenario.js';

const dir = new URL('../fixtures/scenarios/', import.meta.url);
const load = f => JSON.parse(readFileSync(new URL(f, dir)));
const electrical = () => load('electrical.json');

const mistake = (severity, keywords = ['tester', 'live', 'dead']) =>
  ({ severity, summary: 's', why: 'w', correctAction: 'c', consequence: 'q', keywords });
const clean = id => ({ id, line: `line ${id}`, error: null });
const wrap = steps => ({ id: 'x', trade: 'electrical', title: 't', setting: 's', apprentice: 'Sam', steps });
// 8 steps, mistakes at steps 3, 5, 7 (indexes 2, 4, 6). Valid as built.
const good = () => wrap([
  clean(1), clean(2),
  { id: 3, line: 'l', error: mistake('critical') }, clean(4),
  { id: 5, line: 'l', error: mistake('major') }, clean(6),
  { id: 7, line: 'l', error: mistake('minor') }, clean(8)
]);
const has = (problems, re) => problems.some(p => re.test(p));

// ---- fixtures -------------------------------------------------------------

for (const file of readdirSync(dir).filter(f => f.endsWith('.json'))) {
  test(`fixture ${file} passes the strict rules for its own trade`, () => {
    const s = load(file);
    const tradeId = Object.keys(TRADES).find(id => TRADES[id].fixture === file);
    assert.deepEqual(validateScenario(s, { trade: tradeId }), []);
  });
}

// Content guideline (also asked of live scenarios). brazing.json is pending its
// own rewrite (BRAIN-13) and still has 6 keywords on one mistake.
for (const file of ['electrical.json', 'brakes.json']) {
  test(`fixture ${file}: every mistake has 8 to 12 lowercase keywords`, () => {
    for (const step of load(file).steps.filter(st => st.error)) {
      const kw = step.error.keywords;
      assert.ok(kw.length >= 8 && kw.length <= 12, `step ${step.id}: ${kw.length} keywords`);
      for (const k of kw) assert.equal(k, k.toLowerCase(), `step ${step.id}: "${k}"`);
    }
  });
}

test('the hand-built good scenario is valid (so the cases below test one rule each)', () => {
  assert.deepEqual(validateScenario(good()), []);
});

// ---- contract-probe cases (C/contract-probe.mjs) ---------------------------

test('A: adjacent mistakes are rejected', () => {
  const s = good();
  s.steps[3].error = s.steps[4].error; // mistakes at steps 3 and 4
  s.steps[4].error = null;
  assert.ok(has(validateScenario(s), /adjacent/));
});

test('B: a mistake on the last step is rejected', () => {
  const s = good();
  s.steps[7].error = s.steps[6].error;
  s.steps[6].error = null;
  assert.ok(has(validateScenario(s), /last step/));
});

test('C: empty-string keywords are rejected', () => {
  const s = good();
  s.steps[2].error.keywords = ['', 'x', 'y', 'z'];
  assert.ok(has(validateScenario(s), /non-empty string/));
});

test('D: an empty keyword list is rejected', () => {
  const s = good();
  s.steps[2].error.keywords = [];
  assert.ok(has(validateScenario(s), /at least 3 keywords/));
});

test('E: non-string keywords are rejected', () => {
  const s = good();
  s.steps[2].error.keywords = [42, 'live', 'dead', 'tester'];
  assert.ok(has(validateScenario(s), /non-empty string/));
});

test('F: a null step returns a problem instead of throwing', () => {
  const s = good();
  s.steps[0] = null;
  assert.ok(has(validateScenario(s), /step 1: is not an object/));
});

test('G: mistake at step 1 and error:false are rejected', () => {
  const s = good();
  s.steps[0].error = mistake('critical');
  s.steps[1].error = false;
  const p = validateScenario(s);
  assert.ok(has(p, /first 2 steps/));
  assert.ok(has(p, /step 2: error must be null or a mistake object/));
});

test('H: zero, negative, and duplicate ids are rejected', () => {
  const s = good();
  s.steps[0].id = 0;
  s.steps[1].id = -1;
  s.steps[3].id = 3;
  const p = validateScenario(s);
  assert.ok(has(p, /step 1: id must be a positive integer/));
  assert.ok(has(p, /step 2: id must be a positive integer/));
  assert.ok(has(p, /duplicate id 3/));
});

test('ids do not have to be 1..N (10, 20, 30 is fine)', () => {
  const s = good();
  s.steps.forEach((st, i) => { st.id = (i + 1) * 10; });
  assert.deepEqual(validateScenario(s), []);
});

test('I: 500 steps of 10k-char lines are rejected without listing every step', () => {
  const s = wrap(Array.from({ length: 500 }, (_, i) => ({ id: i + 1, line: 'blah '.repeat(2000), error: null })));
  const p = validateScenario(s);
  assert.ok(has(p, /needs 6 to 14 steps \(has 500\)/));
  assert.ok(p.length < 10);
});

test('I: a single line over the length limit is rejected', () => {
  const s = good();
  s.steps[3].line = 'x'.repeat(SCENARIO_RULES.maxLineChars + 1);
  assert.ok(has(validateScenario(s), /step 4: line is over/));
});

test('J: trade mismatch is rejected when the requested trade is given', () => {
  const s = good();
  s.trade = 'plumbing';
  assert.ok(has(validateScenario(s, { trade: 'electrical' }), /expected electrical/));
  assert.deepEqual(validateScenario(s), [], 'trade is only checked when asked');
});

// ---- counts, severities, step range ----------------------------------------

test('needs exactly one critical, one major and one minor', () => {
  for (const sevs of [['critical', 'critical', 'minor'], ['minor', 'minor', 'minor'], ['major', 'major', 'critical']]) {
    const s = good();
    [2, 4, 6].forEach((i, k) => { s.steps[i].error.severity = sevs[k]; });
    assert.ok(has(validateScenario(s), /exactly one critical, one major, and one minor/), sevs.join());
  }
  const four = wrap([clean(1), clean(2), ...[3, 5, 7, 9].flatMap(id => [{ id, line: 'l', error: mistake(id === 3 ? 'critical' : id === 5 ? 'major' : 'minor') }, clean(id + 1)])]);
  assert.ok(has(validateScenario(four), /exactly one critical/), 'four mistakes');
});

test('no mistakes at all is reported', () => {
  const s = good();
  s.steps.forEach(st => { st.error = null; });
  const p = validateScenario(s);
  assert.ok(has(p, /at least one mistake/));
  assert.ok(has(p, /critical/));
});

test('6 to 14 steps', () => {
  const s = electrical();
  s.steps = s.steps.slice(0, 5);
  assert.ok(has(validateScenario(s), /needs 6 to 14 steps \(has 5\)/));
  const long = electrical();
  for (let i = 11; i <= 15; i++) long.steps.push(clean(i));
  assert.ok(has(validateScenario(long), /has 15/));
});

test('whitespace-only line and missing mistake text are rejected', () => {
  const s = good();
  s.steps[3].line = '   ';
  s.steps[2].error.why = '  ';
  delete s.steps[4].error.consequence;
  const p = validateScenario(s);
  assert.ok(has(p, /step 4: missing line/));
  assert.ok(has(p, /step 3: error missing why/));
  assert.ok(has(p, /step 5: error missing consequence/));
});

// ---- A/scen-cases.mjs live-output cases -----------------------------------

test('every bad live-output case from scen-cases is rejected', () => {
  const crit = { ...electrical().steps[2].error };
  const edit = fn => { const s = electrical(); fn(s); return s; };
  const cases = {
    fencedText: 'not json',
    missingTitle: edit(s => { delete s.title; }),
    noCritical: edit(s => s.steps.forEach(st => st.error && (st.error.severity = 'minor'))),
    dupIds: edit(s => { s.steps[1].id = 1; }),
    emptyKeywords: edit(s => s.steps.forEach(st => st.error && (st.error.keywords = []))),
    emptyStringKeyword: edit(s => s.steps.forEach(st => st.error && (st.error.keywords = ['']))),
    thirtySteps: edit(s => { s.steps = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, line: 'step', error: i === 14 ? crit : null })); }),
    allStepsErrors: edit(s => s.steps.forEach(st => { st.error = crit; })),
    criticalOnLastStep: edit(s => { s.steps.forEach(st => { st.error = null; }); s.steps.at(-1).error = crit; }),
    criticalOnFirstStep: edit(s => { s.steps.forEach(st => { st.error = null; }); s.steps[0].error = crit; }),
    adjacent: edit(s => { s.steps.forEach(st => { st.error = null; }); s.steps[3].error = crit; s.steps[4].error = { ...crit, severity: 'major' }; }),
    hugeLine: edit(s => { s.steps[3].line = 'And then I keep going. '.repeat(400); }),
    whitespaceLine: edit(s => { s.steps[3].line = '   '; }),
    fourSteps: edit(s => { s.steps = s.steps.slice(0, 4); })
  };
  for (const [name, s] of Object.entries(cases)) {
    assert.ok(validateScenario(s).length >= 1, name);
  }
});

// ---- never throws ----------------------------------------------------------

test('never throws and always returns a non-empty list for junk input', () => {
  const hostile = new Proxy({}, { get() { throw new Error('boom'); } });
  const junk = [
    undefined, null, 0, 1, '', 'scenario', true, [], [1, 2], () => {}, Symbol('s'), 10n,
    {}, { steps: null }, { steps: 'abc' }, { steps: {} }, { steps: [null, undefined, 1, 'x', []] },
    wrap(Array.from({ length: 8 }, () => ({ id: '1', line: 5, error: 'oops' }))),
    wrap(Array.from({ length: 8 }, (_, i) => ({ id: i + 1, line: 'l', error: { severity: 'critical', keywords: 'live' } }))),
    wrap(Array.from({ length: 8 }, (_, i) => ({ id: i + 1, line: 'l', error: { severity: { toString: null } } }))),
    wrap([hostile, ...good().steps.slice(1)]),
    hostile,
    Object.create(null)
  ];
  for (const s of junk) {
    let p;
    assert.doesNotThrow(() => { p = validateScenario(s); }, String(typeof s));
    assert.ok(Array.isArray(p) && p.length >= 1, `expected problems for ${typeof s}`);
    assert.ok(p.every(x => typeof x === 'string'));
  }
  assert.doesNotThrow(() => validateScenario(good(), null));
});

// ---- BRAIN-12: scenario prompt ---------------------------------------------

test('scenario user prompt names a critical hazard, a twist and an apprentice', () => {
  for (const [id, trade] of Object.entries(TRADES)) {
    const p = scenarioUserPrompt(id, trade);
    assert.match(p, /Draw the critical mistake from: \S/);
    const hint = p.match(/Draw the critical mistake from: (.+)/)[1];
    const pool = trade.criticalHints ?? trade.hazardHints.split(',').map(x => x.trim());
    assert.ok(pool.includes(hint), `${id}: ${hint}`);
    const twist = p.match(/Jobsite twist to include: (.+)/)[1];
    assert.ok(Array.isArray(trade.twists) && trade.twists.length >= 3, `${id} has twists`);
    assert.ok(trade.twists.includes(twist), `${id}: ${twist}`);
    assert.match(p, /Apprentice name: [A-Z][a-z]+/);
    assert.ok(!p.includes('Do not reuse'), 'no recent list when none given');
  }
});

test('scenario user prompt varies the apprentice across calls', () => {
  const names = new Set();
  for (let i = 0; i < 200; i++) names.add(scenarioUserPrompt('electrical', TRADES.electrical).match(/Apprentice name: (\w+)/)[1]);
  assert.ok(names.size >= 2, [...names].join());
});

test('scenario user prompt lists recent mistakes to avoid when given', () => {
  const p = scenarioUserPrompt('hvac', TRADES.hvac, ['Brazing without flowing nitrogen', 'No extinguisher']);
  assert.match(p, /Do not reuse these mistakes from recent scenarios: Brazing without flowing nitrogen; No extinguisher/);
});

test('scenario user prompt works for a trade with no twists and odd hazard hints', () => {
  const p = scenarioUserPrompt('plumbing', { brief: 'Swap a water heater.', hazardHints: ' gas leaks ,, venting ' });
  assert.match(p, /Draw the critical mistake from: (gas leaks|venting)\n/);
  assert.match(p, /Jobsite twist to include: \S/);
});

test('scenario system prompt carries the rules the validator enforces', () => {
  assert.match(SCENARIO_SYSTEM, /exactly 3 mistakes/);
  assert.match(SCENARIO_SYSTEM, /No mistake in steps 1 or 2 or in the last step/);
  assert.match(SCENARIO_SYSTEM, /8 to 12 lowercase/);
  assert.match(SCENARIO_SYSTEM, /at most one may be an announced shortcut/);
});
