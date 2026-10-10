// F1a-T05 (FR-027, ADR 0005 + Amendment 1): every prompt module exports an
// integer VERSION and a PROMPT {id, system, schema, render, fingerprintInputs}.
// The fingerprints are frozen here so any change to system text, user template
// or schema fails this test until VERSION is bumped and the eval gate is passed.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { gradeUserPrompt } from '../server/prompts/grade.js';
import { scenarioUserPrompt } from '../server/prompts/scenario.js';

const PROMPTS_DIR = fileURLToPath(new URL('../server/prompts/', import.meta.url));
// trades.js is pack data, not a prompt; T07b deletes it and removes this exclusion.
const EXCLUDED = new Set(['trades.js']);

async function loadPromptModules() {
  const files = readdirSync(PROMPTS_DIR).filter(f => f.endsWith('.js') && !EXCLUDED.has(f)).sort();
  return Promise.all(files.map(async f => ({ file: f, mod: await import(pathToFileURL(join(PROMPTS_DIR, f))) })));
}

// The algorithm T08a's promptFingerprint must reproduce.
function fingerprint(p) {
  const h = createHash('sha256');
  h.update(p.system);
  h.update(JSON.stringify(p.schema));
  for (const i of p.fingerprintInputs) h.update(p.render(i));
  return h.digest('hex');
}

// FR-038 deny-list seed, inline on purpose.
const SEED_WORDS = ['trade', 'trades', 'journeyman', 'electrical', 'electrician', 'hvac', 'automotive',
  'receptacle', 'breaker', 'gfci', 'gfi', 'backstab', 'nitrogen', 'nitro', 'refrigerant', 'braze', 'brazing',
  'extinguisher', 'caliper', 'jack stand', 'jackstand', 'de-energized', 'deenergized', 'nec', 'osha', 'epa',
  'jobsite', 'got hurt'];

test('every module in server/prompts except trades.js exports an integer VERSION ≥ 1 and PROMPT {id, system, schema, render, fingerprintInputs}', async () => {
  const mods = await loadPromptModules();
  assert.ok(mods.length >= 2, 'expected at least grade.js and scenario.js');
  for (const { file, mod } of mods) {
    assert.ok(Number.isInteger(mod.VERSION) && mod.VERSION >= 1, `${file} VERSION`);
    const p = mod.PROMPT;
    assert.ok(p && typeof p === 'object', `${file} PROMPT`);
    assert.equal(typeof p.id, 'string', `${file} PROMPT.id`);
    assert.ok(p.id.length > 0, `${file} PROMPT.id non-empty`);
    assert.equal(typeof p.system, 'string', `${file} PROMPT.system`);
    assert.ok(p.schema && typeof p.schema === 'object', `${file} PROMPT.schema`);
    assert.equal(typeof p.render, 'function', `${file} PROMPT.render`);
    assert.ok(Array.isArray(p.fingerprintInputs) && p.fingerprintInputs.length >= 4, `${file} fingerprintInputs`);
    for (const i of p.fingerprintInputs) assert.equal(typeof p.render(i), 'string', `${file} render returns a string`);
    assert.equal('PROMPT_ID' in mod, false, `${file} must not export PROMPT_ID (review B1)`);
  }
});

test('PROMPT ids are unique', async () => {
  const ids = (await loadPromptModules()).map(m => m.mod.PROMPT?.id);
  assert.equal(new Set(ids).size, ids.length, ids.join(', '));
});

test('render equals the legacy function for every fingerprint input', async () => {
  const { PROMPT: grade } = await import('../server/prompts/grade.js');
  const { PROMPT: scenario } = await import('../server/prompts/scenario.js');
  assert.equal(grade.fingerprintInputs.length, 4);
  for (const i of grade.fingerprintInputs) {
    assert.equal(grade.render(i), gradeUserPrompt(i.scenario, i.stepId, i.errorStepId, i.explanation));
  }
  assert.ok(scenario.fingerprintInputs.length >= 4);
  for (const i of scenario.fingerprintInputs) {
    assert.equal(scenario.render(i), scenarioUserPrompt(i.key, i.entry, i.recentSummaries ?? [], i.rng));
  }
});

test('fingerprint inputs cover each template branch', async () => {
  const { PROMPT: grade } = await import('../server/prompts/grade.js');
  const { PROMPT: scenario } = await import('../server/prompts/scenario.js');
  const g = grade.fingerprintInputs;
  assert.ok(g.some(i => i.errorStepId != null && i.stepId === i.errorStepId && i.explanation.trim()), 'on-time catch');
  assert.ok(g.some(i => i.errorStepId != null && i.stepId === i.errorStepId + 1), 'late catch');
  assert.ok(g.some(i => i.errorStepId === null), 'false alarm');
  assert.ok(g.some(i => !String(i.explanation ?? '').trim()), 'empty explanation');
  const s = scenario.fingerprintInputs;
  assert.ok(s.some(i => i.entry.criticalHints?.length), 'with criticalHints');
  assert.ok(s.some(i => !i.entry.criticalHints), 'without criticalHints');
  assert.ok(s.some(i => i.entry.twists?.length), 'with twists');
  assert.ok(s.some(i => i.recentSummaries?.length), 'with recent summaries');
  for (const i of s) {
    assert.equal(typeof i.rng, 'function', 'every scenario input has an rng');
    assert.equal(i.rng(), 0, 'rng is () => 0');
  }
});

test('fingerprintInputs contain none of the FR-038 seed words (inline list)', async () => {
  for (const { file, mod } of await loadPromptModules()) {
    const text = JSON.stringify(mod.PROMPT.fingerprintInputs).toLowerCase();
    for (const w of SEED_WORDS) {
      const re = new RegExp(`\\b${w.replace(/[-\s]/g, m => `\\${m}`)}\\b`);
      assert.doesNotMatch(text, re, `${file} fingerprintInputs contain "${w}"`);
    }
  }
});

test('grade and scenario fingerprints equal the frozen hex values', async () => {
  // Computed from the pre-change text (commit dade9ef) with these exact inputs.
  // Changing either value requires a VERSION bump and the eval gate (inv. 4).
  const { PROMPT: grade } = await import('../server/prompts/grade.js');
  const { PROMPT: scenario } = await import('../server/prompts/scenario.js');
  assert.equal(fingerprint(grade), '4f7d7c35478e9a60d6360077141122098571b07d8890f62deb5138bc7fca1b08');
  assert.equal(fingerprint(scenario), '9de348f4d973f1323754e6c33e2ff75614a50ca4ac0943f444255591774fb898');
});
