// F1a-T02 (FR-028): scenarioUserPrompt takes an optional rng so callers and
// the golden harness can make the rendered prompt deterministic. The default
// (Math.random) must behave exactly as before.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scenarioUserPrompt } from '../server/prompts/scenario.js';

// The pack's scenario entries keyed by id, passed as `trade` exactly as the legacy live path does.
const pack = JSON.parse(readFileSync(new URL('../packs/demo-trades/pack.json', import.meta.url), 'utf8'));
const TRADES = Object.fromEntries(pack.scenarios.map(e => [e.id, e]));

// Deterministic draw sequence: replays the same values on every fresh instance.
const seq = values => { let i = 0; return () => values[i++ % values.length]; };

test('same rng sequence gives byte-identical prompt', () => {
  const draws = [0.13, 0.71, 0.42];
  for (const [id, trade] of Object.entries(TRADES)) {
    const a = scenarioUserPrompt(id, trade, ['x'], seq(draws));
    const b = scenarioUserPrompt(id, trade, ['x'], seq(draws));
    assert.equal(a, b, id);
  }
  // Different draws must be able to change the output, or the rng is ignored.
  const lo = scenarioUserPrompt('electrical', TRADES.electrical, [], () => 0);
  const hi = scenarioUserPrompt('electrical', TRADES.electrical, [], () => 0.999);
  assert.notEqual(lo, hi);
});

test('rng () => 0 picks the first hint, twist and name', () => {
  const t = TRADES.electrical;
  const p = scenarioUserPrompt('electrical', t, [], () => 0);
  assert.equal(p.match(/Draw the critical mistake from: (.+)/)[1], t.criticalHints[0].trim());
  assert.equal(p.match(/Jobsite twist to include: (.+)/)[1], t.twists[0]);
  assert.equal(p.match(/Apprentice name: (.+)/)[1], 'Danny');
});

test('default rng still varies names over 200 calls', () => {
  const names = new Set();
  for (let i = 0; i < 200; i++) {
    names.add(scenarioUserPrompt('electrical', TRADES.electrical).match(/Apprentice name: (\w+)/)[1]);
  }
  assert.ok(names.size >= 2, [...names].join());
});

test('frozen snapshot: electrical with rng () => 0.5 equals the stored string', () => {
  // Generated from the pre-change code with Math.random stubbed to () => 0.5.
  const expected = 'Trade id: electrical\nJob: A first-year electrical apprentice replaces a countertop receptacle near a kitchen sink in an occupied home.\nHazard areas to draw mistakes from: lockout / verifying de-energized (live-dead-live), GFCI requirements near water, terminations, box fill, grounding\nDraw the critical mistake from: grounding and the equipment ground\nJobsite twist to include: a handyman did the last repair and it shows\nApprentice name: Tasha\n\nWrite a fresh scenario.';
  assert.equal(scenarioUserPrompt('electrical', TRADES.electrical, [], () => 0.5), expected);
});
