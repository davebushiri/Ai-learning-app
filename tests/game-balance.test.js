// Game-design guarantees. If a RULES tweak breaks one of these, the game
// rewards the wrong behavior; rethink the tweak rather than the test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { PLAYERS, playRun } from '../scripts/simulate.js';

const dir = new URL('../fixtures/scenarios/', import.meta.url);
const fixtures = readdirSync(dir)
  .filter(f => f.endsWith('.json'))
  .map(f => [f, JSON.parse(readFileSync(new URL(f, dir)))]);

for (const [file, scenario] of fixtures) {
  const score = name => playRun(scenario, PLAYERS[name]);

  test(`${file}: a perfect run earns the max and the top rating`, () => {
    const r = score('perfect');
    assert.equal(r.total, r.maxPossible);
    assert.equal(r.rating, 'Journeyman eyes');
  });

  test(`${file}: missing a critical mistake always reads "Someone got hurt"`, () => {
    assert.equal(score('misses critical').rating, 'Someone got hurt');
    assert.equal(score('never stops').rating, 'Someone got hurt');
  });

  test(`${file}: reacting one step late still catches every mistake`, () => {
    const r = score('late by one');
    assert.equal(r.caughtCount, r.mistakeCount);
    assert.equal(r.falseAlarms, 0);
  });

  test(`${file}: ordering of skill is respected`, () => {
    const t = name => score(name).total;
    assert.ok(t('perfect') > t('nervous (+2 FA)'));
    assert.ok(t('perfect') > t('late by one'));
    assert.ok(t('perfect') > t('vague but right'));
    assert.ok(t('nervous (+2 FA)') > t('spams STOP, smart'));
    assert.ok(t('spams STOP, smart') > t('spams STOP, blind'));
  });

  test(`${file}: spamming STOP never rates as a good supervisor`, () => {
    for (const name of ['spams STOP, smart', 'spams STOP, blind']) {
      assert.ok(['Keep watching', 'Back to the classroom'].includes(score(name).rating), name);
    }
  });

  test(`${file}: mistakes are spaced out and the last step is clean`, () => {
    const errorIdx = scenario.steps.flatMap((s, i) => (s.error ? [i] : []));
    for (let k = 1; k < errorIdx.length; k++) {
      assert.ok(errorIdx[k] - errorIdx[k - 1] >= 2, `mistakes at steps ${errorIdx[k - 1] + 1} and ${errorIdx[k] + 1} are adjacent`);
    }
    assert.equal(scenario.steps.at(-1).error, null, 'last step has a mistake');
  });
}
