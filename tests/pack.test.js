// F1a-T07a: the pack loader (server/packs.js), the pack's scenario files and the startup order
// in server/index.js (ADR 0006 + Amendment 1, ADR 0001; review B4, B5, B6).
//
// Expected values are frozen inline (thread 0004): the old fixtures and server/prompts/trades.js
// are deleted by F1a-T07b, so nothing here compares against them.

import { test, describe, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import {
  cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { openDb } from '../server/db.js';
import { loadPacks, getPack, listSubjects, listScenarios, getScenarioEntry } from '../server/packs.js';
import { scenarioUserPrompt } from '../server/prompts/scenario.js';
import { startServer } from './helpers/server.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACKS_DIR = path.join(ROOT, 'packs');
const DEMO_DIR = path.join(PACKS_DIR, 'demo-trades');
const IDS = ['electrical', 'hvac', 'automotive'];

// sha256 of fixtures/scenarios/*.json as they were before F1a-T07a (frozen 2026-10-10).
const FIXTURE_SHA256 = {
  'electrical.json': '84e63b89d667020b89001f3773fab16e3110ad7bc89f0c61135d57625dd9219e',
  'brazing.json': 'cf419be1cb8510df2a61b6ea2a99f5f50c6e133558bef115087070f6e2113533',
  'brakes.json': 'e61f01431394e4f4813788ffcd77f9e415278d0b177b9a633d6622623d9e21fe'
};

// scenarioUserPrompt(id, TRADES[id], [], () => r) rendered from the pre-T07a code (trades.js).
// electrical@0.5 is T02's snapshot in tests/scenario-prompt-rng.test.js.
const PROMPT_SNAPSHOTS = {
  "electrical": {
    "0": "Trade id: electrical\nJob: A first-year electrical apprentice replaces a countertop receptacle near a kitchen sink in an occupied home.\nHazard areas to draw mistakes from: lockout / verifying de-energized (live-dead-live), GFCI requirements near water, terminations, box fill, grounding\nDraw the critical mistake from: verifying the circuit is dead before touching it\nJobsite twist to include: the homeowner is cooking dinner and wants the kitchen back fast\nApprentice name: Danny\n\nWrite a fresh scenario.",
    "0.5": "Trade id: electrical\nJob: A first-year electrical apprentice replaces a countertop receptacle near a kitchen sink in an occupied home.\nHazard areas to draw mistakes from: lockout / verifying de-energized (live-dead-live), GFCI requirements near water, terminations, box fill, grounding\nDraw the critical mistake from: grounding and the equipment ground\nJobsite twist to include: a handyman did the last repair and it shows\nApprentice name: Tasha\n\nWrite a fresh scenario.",
    "0.999": "Trade id: electrical\nJob: A first-year electrical apprentice replaces a countertop receptacle near a kitchen sink in an occupied home.\nHazard areas to draw mistakes from: lockout / verifying de-energized (live-dead-live), GFCI requirements near water, terminations, box fill, grounding\nDraw the critical mistake from: a second circuit or shared neutral in the same box\nJobsite twist to include: the homeowner keeps asking if the dishwasher will still work\nApprentice name: Mo\n\nWrite a fresh scenario."
  },
  "hvac": {
    "0": "Trade id: hvac\nJob: An HVAC apprentice brazes a replacement section of copper suction line on a residential split system outdoors.\nHazard areas to draw mistakes from: hot work and fire prevention, nitrogen purge while brazing, heat protection of valves, refrigerant recovery, pressure and vacuum testing\nDraw the critical mistake from: hot work and fire prevention\nJobsite twist to include: it is ninety five degrees out and the customer wants cooling today\nApprentice name: Danny\n\nWrite a fresh scenario.",
    "0.5": "Trade id: hvac\nJob: An HVAC apprentice brazes a replacement section of copper suction line on a residential split system outdoors.\nHazard areas to draw mistakes from: hot work and fire prevention, nitrogen purge while brazing, heat protection of valves, refrigerant recovery, pressure and vacuum testing\nDraw the critical mistake from: pressure testing with the right gas through a regulator\nJobsite twist to include: the nitrogen bottle is almost empty\nApprentice name: Tasha\n\nWrite a fresh scenario.",
    "0.999": "Trade id: hvac\nJob: An HVAC apprentice brazes a replacement section of copper suction line on a residential split system outdoors.\nHazard areas to draw mistakes from: hot work and fire prevention, nitrogen purge while brazing, heat protection of valves, refrigerant recovery, pressure and vacuum testing\nDraw the critical mistake from: electrical disconnect at the condenser before working on it\nJobsite twist to include: the homeowner's kids are playing in the yard\nApprentice name: Mo\n\nWrite a fresh scenario."
  },
  "automotive": {
    "0": "Trade id: automotive\nJob: An automotive apprentice replaces front brake pads and rotors on a sedan in a small shop with no lift available.\nHazard areas to draw mistakes from: vehicle support (jack stands), caliper and hose handling, brake dust, torque specs, pumping the pedal and road testing\nDraw the critical mistake from: vehicle support and jack stands\nJobsite twist to include: the customer is waiting in the lobby and asks for it in an hour\nApprentice name: Danny\n\nWrite a fresh scenario.",
    "0.5": "Trade id: automotive\nJob: An automotive apprentice replaces front brake pads and rotors on a sedan in a small shop with no lift available.\nHazard areas to draw mistakes from: vehicle support (jack stands), caliper and hose handling, brake dust, torque specs, pumping the pedal and road testing\nDraw the critical mistake from: wheel and lug nut tightening\nJobsite twist to include: the shop is out of the right brake cleaner\nApprentice name: Tasha\n\nWrite a fresh scenario.",
    "0.999": "Trade id: automotive\nJob: An automotive apprentice replaces front brake pads and rotors on a sedan in a small shop with no lift available.\nHazard areas to draw mistakes from: vehicle support (jack stands), caliper and hose handling, brake dust, torque specs, pumping the pedal and road testing\nDraw the critical mistake from: caliper and bracket fasteners\nJobsite twist to include: the lug nuts were put on with an impact last time and are stuck\nApprentice name: Mo\n\nWrite a fresh scenario."
  }
};

const tempDir = prefix => mkdtempSync(path.join(tmpdir(), prefix));

// Copies demo-trades into a temp packs dir so a test can add or change packs without touching
// the repo.
function tempPacks() {
  const dir = tempDir('f1a-packs-');
  cpSync(DEMO_DIR, path.join(dir, 'demo-trades'), { recursive: true });
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

function writePack(dir, name, files) {
  for (const [rel, content] of Object.entries(files)) {
    const file = path.join(dir, name, rel);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content));
  }
}

// Captures console.warn for the duration of one test.
let warnings;
let realWarn;
beforeEach(() => { warnings = []; realWarn = console.warn; console.warn = (...a) => warnings.push(a.join(' ')); });
afterEach(() => { console.warn = realWarn; });

describe('pack scenario files', () => {
  test('scenario files are byte-identical to the pre-T07a fixtures (sha256 frozen)', () => {
    for (const [name, sha] of Object.entries(FIXTURE_SHA256)) {
      const bytes = readFileSync(path.join(DEMO_DIR, 'scenarios', name));
      assert.equal(createHash('sha256').update(bytes).digest('hex'), sha, name);
    }
  });
});

describe('loadPacks against the repo packs', () => {
  let db;
  before(() => { db = openDb(':memory:'); loadPacks(PACKS_DIR, db); });
  after(() => db.close());

  test('loadPacks twice writes one subject_pack row and three card rows fx_demo-trades_1_<id> with NULL stamps', () => {
    const dir = tempDir('f1a-packdb-');
    try {
      const file = path.join(dir, 'app.db');
      const fileDb = openDb(file);
      const first = loadPacks(PACKS_DIR, fileDb);
      const second = loadPacks(PACKS_DIR, fileDb);
      fileDb.close();
      assert.deepEqual([...first.keys()], ['demo-trades']);
      assert.deepEqual([...second.keys()], ['demo-trades']);

      const ro = new DatabaseSync(file, { readOnly: true });
      try {
        const packs = ro.prepare('SELECT id, version, provenance_json FROM subject_pack').all().map(r => ({ ...r }));
        assert.deepEqual(packs, [{ id: 'demo-trades', version: 1, provenance_json: '{"builtBy":"hand"}' }]);
        const cards = ro.prepare(`SELECT id, subject_id, subject_version, prompt_version, model, source
          FROM card ORDER BY id`).all().map(r => ({ ...r }));
        assert.deepEqual(cards, ['automotive', 'electrical', 'hvac'].map(id => ({
          id: `fx_demo-trades_1_${id}`, subject_id: 'demo-trades', subject_version: 1,
          prompt_version: null, model: null, source: 'fixture'
        })));
      } finally {
        ro.close();
      }
      assert.deepEqual(warnings, []);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('the stored fixture card is the pack scenario file', () => {
    const stored = db.getCard('fx_demo-trades_1_hvac');
    assert.deepEqual(stored.card, JSON.parse(readFileSync(path.join(DEMO_DIR, 'scenarios', 'brazing.json'), 'utf8')));
  });

  test('pack entries render byte-identical scenario prompts to T02\'s snapshot', () => {
    for (const id of IDS) {
      const entry = getScenarioEntry('demo-trades', id);
      for (const [r, expected] of Object.entries(PROMPT_SNAPSHOTS[id])) {
        assert.equal(scenarioUserPrompt(id, entry, [], () => Number(r)), expected, `${id} rng ${r}`);
      }
    }
  });

  test('getScenarioEntry returns the flat entry with its card and card id', () => {
    const e = getScenarioEntry('demo-trades', 'automotive');
    assert.deepEqual(Object.keys(e).sort(), ['brief', 'card', 'cardId', 'criticalHints', 'hazardHints', 'id', 'label', 'twists']);
    assert.equal(e.cardId, 'fx_demo-trades_1_automotive');
    assert.equal(e.label, 'Automotive: front brake job');
    assert.equal(e.card.id, 'auto-brakes-01');
  });

  test('listSubjects and listScenarios return ids and labels in pack order', () => {
    assert.deepEqual(listSubjects(), [{ id: 'demo-trades', title: 'Trades demo' }]);
    assert.deepEqual(listScenarios('demo-trades'), [
      { id: 'electrical', label: 'Electrical: replace a receptacle' },
      { id: 'hvac', label: 'HVAC: braze a suction line' },
      { id: 'automotive', label: 'Automotive: front brake job' }
    ]);
    assert.equal(listScenarios('nope'), null);
  });

  test('getPack returns the pack with each scenario\'s card loaded', () => {
    const p = getPack('demo-trades');
    assert.equal(p.version, 1);
    assert.equal(p.copy.cleanRun, 'Clean job. Nobody got hurt.');
    assert.deepEqual(p.scenarios.map(s => s.card.id), ['electrical-receptacle-01', 'hvac-brazing-01', 'auto-brakes-01']);
  });

  test('getScenarioEntry rejects __proto__, constructor, toString, hasOwnProperty', () => {
    assert.ok(getScenarioEntry('demo-trades', 'electrical'), 'positive control: a real id resolves');
    for (const k of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
      assert.equal(getScenarioEntry('demo-trades', k), null, `scenario ${k}`);
      assert.equal(getScenarioEntry(k, 'electrical'), null, `pack ${k}`);
      assert.equal(getPack(k), null, `getPack ${k}`);
      assert.equal(listScenarios(k), null, `listScenarios ${k}`);
    }
    assert.equal(getScenarioEntry('demo-trades', 42), null);
    assert.equal(getScenarioEntry('demo-trades'), null);
  });
});

describe('loadPacks refuses and skips bad packs', () => {
  let tmp, db;
  beforeEach(() => { tmp = tempPacks(); db = openDb(':memory:'); });
  afterEach(() => { db.close(); tmp.cleanup(); });

  test('an invalid pack in a temp dir is skipped and logged; the valid one still loads', () => {
    writePack(tmp.dir, 'broken', { 'pack.json': { id: 'broken', version: 1 } });
    const packs = loadPacks(tmp.dir, db);
    assert.deepEqual([...packs.keys()], ['demo-trades']);
    assert.equal(warnings.length, 1, warnings.join('\n'));
    assert.match(warnings[0], /^\[packs\] broken skipped: .*title must be a non-empty string/);
    assert.equal(getPack('broken'), null);
    assert.ok(db.getCard('fx_demo-trades_1_electrical'));
  });

  test('a pack.json that is not JSON is skipped and logged', () => {
    writePack(tmp.dir, 'garbled', { 'pack.json': '{ not json' });
    assert.deepEqual([...loadPacks(tmp.dir, db).keys()], ['demo-trades']);
    assert.match(warnings.join('\n'), /^\[packs\] garbled skipped: /);
  });

  test('a pack whose scenario file fails validateScenario is skipped and stores nothing', () => {
    const pack = JSON.parse(readFileSync(path.join(DEMO_DIR, 'pack.json'), 'utf8'));
    pack.id = 'bad-card';
    writePack(tmp.dir, 'bad-card', {
      'pack.json': pack,
      'scenarios/electrical.json': { id: 'x', steps: [] },
      'scenarios/brazing.json': readFileSync(path.join(DEMO_DIR, 'scenarios', 'brazing.json'), 'utf8'),
      'scenarios/brakes.json': readFileSync(path.join(DEMO_DIR, 'scenarios', 'brakes.json'), 'utf8')
    });
    assert.deepEqual([...loadPacks(tmp.dir, db).keys()], ['demo-trades']);
    assert.match(warnings.join('\n'), /^\[packs\] bad-card skipped: electrical\.json: /m);
    assert.equal(db.getCard('fx_bad-card_1_hvac'), null);
    assert.equal(db.putPack({ id: 'bad-card', version: 1, json: '{}' }), 'inserted', 'no subject_pack row was written');
  });

  test('a missing scenario file skips the pack', () => {
    rmSync(path.join(tmp.dir, 'demo-trades', 'scenarios', 'brakes.json'));
    assert.deepEqual([...loadPacks(tmp.dir, db).keys()], []);
    assert.match(warnings.join('\n'), /^\[packs\] demo-trades skipped: brakes\.json: /);
  });

  test('a changed pack.json without a version bump is refused', () => {
    loadPacks(tmp.dir, db);
    const file = path.join(tmp.dir, 'demo-trades', 'pack.json');
    const pack = JSON.parse(readFileSync(file, 'utf8'));
    pack.title = 'Trades demo, edited';
    writeFileSync(file, JSON.stringify(pack));
    assert.deepEqual([...loadPacks(tmp.dir, db).keys()], []);
    assert.match(warnings.join('\n'), /^\[packs\] demo-trades skipped: demo-trades@1 differs from the stored copy; bump its version/);
    assert.equal(getPack('demo-trades'), null);
    assert.deepEqual(listSubjects(), []);
  });

  test('a changed scenario file without a version bump is refused', () => {
    loadPacks(tmp.dir, db);
    const file = path.join(tmp.dir, 'demo-trades', 'scenarios', 'electrical.json');
    const card = JSON.parse(readFileSync(file, 'utf8'));
    card.title = 'Replace a kitchen receptacle, edited';
    writeFileSync(file, JSON.stringify(card));
    assert.deepEqual([...loadPacks(tmp.dir, db).keys()], []);
    assert.match(warnings.join('\n'), /^\[packs\] demo-trades skipped: demo-trades@1 differs from the stored copy/);
    assert.equal(db.getCard('fx_demo-trades_1_electrical').card.title, 'Replace a kitchen countertop receptacle');
  });

  test('whitespace and key order in pack.json are not a change (canonical JSON)', () => {
    loadPacks(tmp.dir, db);
    const file = path.join(tmp.dir, 'demo-trades', 'pack.json');
    const pack = JSON.parse(readFileSync(file, 'utf8'));
    const reordered = Object.fromEntries(Object.entries(pack).reverse());
    writeFileSync(file, JSON.stringify(reordered, null, 4));
    assert.deepEqual([...loadPacks(tmp.dir, db).keys()], ['demo-trades']);
    assert.deepEqual(warnings, []);
  });

  test('a bumped version loads alongside the stored one', () => {
    loadPacks(tmp.dir, db);
    const file = path.join(tmp.dir, 'demo-trades', 'pack.json');
    const pack = JSON.parse(readFileSync(file, 'utf8'));
    pack.title = 'Trades demo, edited';
    pack.version = 2;
    writeFileSync(file, JSON.stringify(pack));
    assert.equal(loadPacks(tmp.dir, db).get('demo-trades').version, 2);
    assert.ok(db.getCard('fx_demo-trades_2_electrical'));
    assert.ok(db.getCard('fx_demo-trades_1_electrical'));
  });

  // F1c-T02 (ADR 0008 ARCH-1): practice packs share packs/ and are loaded by the practice loader.
  test('a directory with practice.json and no pack.json is skipped with no [packs] warning', () => {
    writePack(tmp.dir, 'practice-only', { 'practice.json': { format: 'practice-v1', id: 'practice-only' } });
    assert.deepEqual([...loadPacks(tmp.dir, db).keys()], ['demo-trades']);
    assert.deepEqual(warnings, []);
  });

  test('a directory with both practice.json and pack.json loads pack.json as before', () => {
    writePack(tmp.dir, 'demo-trades', { 'practice.json': { format: 'practice-v1' } });
    assert.deepEqual([...loadPacks(tmp.dir, db).keys()], ['demo-trades']);
    assert.deepEqual(warnings, []);
  });

  test('a missing packs dir loads nothing and does not throw', () => {
    assert.deepEqual([...loadPacks(path.join(tmp.dir, 'nope'), db).keys()], []);
    assert.match(warnings.join('\n'), /^\[packs\] /);
  });
});

describe('server startup (B6)', () => {
  test('server exits non-zero with [db] migration 001 failed and never listens', async () => {
    const dir = tempDir('f1a-migrate-');
    try {
      const file = path.join(dir, 'app.db');
      const raw = new DatabaseSync(file);
      raw.exec('CREATE TABLE event (x)'); // user_version stays 0, so 001 runs and collides
      raw.close();
      let app = null;
      const err = await startServer({ MOCK: '1', DB_PATH: file }).then(a => { app = a; return null; }, e => e);
      if (app) await app.stop();
      assert.ok(err, 'the server must not start listening');
      assert.match(err.message, /server exited \([1-9]\d*\)/);
      assert.match(err.message, /\[db\] migration 001 failed: /);
      assert.doesNotMatch(err.message, /on http:\/\/localhost/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('server with an invalid pack in PACKS still starts', async () => {
    // loadPacks has no env hook (ticket note), so run a copy of the app whose packs/ has a bad pack.
    const root = tempDir('f1a-approot-');
    let child = null;
    try {
      for (const d of ['server', 'shared', 'packs', 'web']) cpSync(path.join(ROOT, d), path.join(root, d), { recursive: true });
      cpSync(path.join(ROOT, 'package.json'), path.join(root, 'package.json'));
      symlinkSync(path.join(ROOT, 'node_modules'), path.join(root, 'node_modules'), 'dir');
      writePack(path.join(root, 'packs'), 'broken', { 'pack.json': { id: 'broken' } });

      child = spawn(process.execPath, [path.join(root, 'server', 'index.js')], {
        env: { ...process.env, PORT: '0', MOCK: '1', DB_PATH: ':memory:' },
        stdio: ['ignore', 'pipe', 'pipe']
      });
      let out = '';
      child.stdout.on('data', d => (out += d));
      child.stderr.on('data', d => (out += d));
      const port = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`server did not start:\n${out}`)), 5000);
        child.once('exit', code => { clearTimeout(timer); reject(new Error(`server exited (${code}):\n${out}`)); });
        child.stdout.on('data', () => {
          const m = out.match(/on http:\/\/localhost:(\d+)/);
          if (m) { clearTimeout(timer); resolve(m[1]); }
        });
      });
      const res = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(5000) });
      assert.equal(res.status, 200);
      const warnAt = out.indexOf('[packs] broken skipped: ');
      assert.ok(warnAt >= 0, out);
      assert.ok(warnAt < out.indexOf('on http://localhost'), 'packs load before listen');
    } finally {
      if (child && child.exitCode === null) {
        const exited = new Promise(r => child.once('exit', r));
        child.kill();
        await exited;
      }
      rmSync(root, { recursive: true, force: true });
    }
  });
});
