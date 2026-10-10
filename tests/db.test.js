// F1a-T06: server/db.js and migration 001 (ADR 0001, ADR 0002, thread 0004 ruling 4).
// Raw SQL in this file is test-side inspection only; product code reaches SQLite through db.js.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { openDb, DEFAULT_DB_PATH } from '../server/db.js';
import { makeEvent } from '../shared/events.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = mkdtempSync(path.join(tmpdir(), 'f1a-t06-'));
after(() => rmSync(TMP, { recursive: true, force: true }));
let n = 0;
const tmpFile = () => path.join(TMP, `db-${++n}`, 'nested', 'app.db');

const withRaw = (file, fn) => { const d = new DatabaseSync(file); try { return fn(d); } finally { d.close(); } };
const userVersion = file => withRaw(file, d => d.prepare('PRAGMA user_version').get().user_version);
const isAppendOnly = err => err?.code === 'ERR_SQLITE_ERROR' && /event is append-only/.test(err.message);

const ctx = attemptId => ({ subject: 'demo-trades@1', attemptId, promptVersions: {} });
const ev = (attemptId, verb = 'started', over = {}) =>
  makeEvent({ verb, object: { type: 'card', id: 'fx_demo-trades_1_electrical' }, result: { source: 'fixture' }, context: ctx(attemptId), ...over });

const card = (over = {}) => ({
  id: 'fx_demo-trades_1_electrical', subject_id: 'demo-trades', subject_version: 1, mode: 'stop',
  competency_id: null, mistake_types_json: null, subtlety: null,
  card: { title: 'Replace a receptacle', steps: [{ id: 1, line: 'x' }] }, verify_json: null, status: 'ok',
  prompt_version: null, model: null, source: 'fixture', created_at: '2026-10-10T00:00:00.000Z', ...over
});

// A file DB with one event, for the raw-SQL tests.
function migratedFileWithEvent() {
  const file = tmpFile();
  const db = openDb(file);
  db.appendEvents([ev('att_raw')]);
  db.close();
  return file;
}

test('node:sqlite is imported only in server/db.js', () => {
  const offenders = [];
  const walk = dir => {
    for (const name of readdirSync(dir)) {
      const p = path.join(dir, name);
      if (statSync(p).isDirectory()) { if (name !== 'node_modules') walk(p); continue; }
      if (/\.(m?js|cjs|html)$/.test(name) && readFileSync(p, 'utf8').includes('node:sqlite')) offenders.push(path.relative(ROOT, p));
    }
  };
  for (const d of ['server', 'shared', 'web', 'scripts']) if (existsSync(path.join(ROOT, d))) walk(path.join(ROOT, d));
  assert.deepEqual(offenders, [path.join('server', 'db.js')]);
});

test('migrations run once and set user_version to 1', () => {
  const file = tmpFile();
  openDb(file).close();
  assert.equal(userVersion(file), 1);
  const names = withRaw(file, d => d.prepare(
    "SELECT name FROM sqlite_master WHERE type IN ('table','trigger','index') AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r => r.name));
  assert.deepEqual(names, ['card', 'event', 'event_attempt', 'event_no_delete', 'event_no_update', 'llm_call', 'subject_pack']);
});

test('re-opening a migrated file DB runs nothing', () => {
  const file = tmpFile();
  const a = openDb(file);
  a.appendEvents([ev('att_keep')]);
  a.close();
  const b = openDb(file); // a re-run of 001 would throw on CREATE TABLE event
  assert.equal(b.eventsForAttempt('att_keep').length, 1);
  b.close();
  assert.equal(userVersion(file), 1);
});

test('a failing migration throws [db] migration 001 failed and leaves user_version 0', () => {
  const file = tmpFile();
  mkdirSync(path.dirname(file), { recursive: true });
  // A stray llm_call table makes 001 fail part-way, after it has created event.
  withRaw(file, d => d.exec('CREATE TABLE llm_call (x)'));
  assert.throws(() => openDb(file), err => /^\[db\] migration 001 failed: .*llm_call/.test(err.message));
  assert.equal(userVersion(file), 0);
  const tables = withRaw(file, d => d.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(r => r.name));
  assert.deepEqual(tables, ['llm_call'], 'the partial migration rolled back');
});

test('UPDATE on event throws append-only', () => {
  const file = migratedFileWithEvent();
  withRaw(file, d => assert.throws(() => d.exec("UPDATE event SET verb = 'completed'"), isAppendOnly));
  withRaw(file, d => assert.equal(d.prepare('SELECT verb FROM event').get().verb, 'started'));
});

test('DELETE on event throws append-only', () => {
  const file = migratedFileWithEvent();
  withRaw(file, d => assert.throws(() => d.exec('DELETE FROM event'), isAppendOnly));
  withRaw(file, d => assert.equal(d.prepare('SELECT count(*) AS n FROM event').get().n, 1));
});

test('live card with NULL or empty prompt_version or model is rejected', () => {
  const db = openDb(':memory:');
  const live = { id: 'card_01', source: 'live', prompt_version: 'scenario@1', model: 'claude-x' };
  for (const bad of [{ prompt_version: null }, { prompt_version: '' }, { model: null }, { model: '' }, { prompt_version: null, model: null }]) {
    assert.throws(() => db.putCard(card({ ...live, ...bad })), /CHECK constraint failed/, JSON.stringify(bad));
  }
  db.putCard(card(live));
  assert.equal(db.getCard('card_01').source, 'live');
  assert.equal(db.getCard('card_01').prompt_version, 'scenario@1');
  db.close();
});

test('fixture card with NULL stamps is accepted', () => {
  const db = openDb(':memory:');
  db.putCard(card());
  assert.deepEqual(db.getCard('fx_demo-trades_1_electrical'), card());
  db.close();
});

test('source other than fixture or live is rejected', () => {
  const db = openDb(':memory:');
  for (const source of ['cache', '', 'LIVE', null]) {
    assert.throws(() => db.putCard(card({ id: `c_${source}`, source })), /constraint failed/, String(source));
  }
  db.close();
});

test('putCard is idempotent by id', () => {
  const db = openDb(':memory:');
  db.putCard(card());
  db.putCard(card({ card: { title: 'changed' } }));
  assert.deepEqual(db.getCard('fx_demo-trades_1_electrical').card, card().card);
  assert.equal(db.getCard('nope'), null);
  db.close();
});

test('appendEvents writes all or nothing (an invalid second event leaves zero rows)', () => {
  const db = openDb(':memory:');
  const bad = { ...ev('att_aon'), verb: 'hacked' };
  assert.throws(() => db.appendEvents([ev('att_aon'), bad]), /hacked/);
  assert.deepEqual(db.eventsForAttempt('att_aon'), []);
  // a SQLite-level failure (duplicate id) on the second event also writes nothing
  const first = ev('att_aon');
  assert.throws(() => db.appendEvents([first, { ...ev('att_aon'), id: first.id }]), /UNIQUE/);
  assert.deepEqual(db.eventsForAttempt('att_aon'), []);
  db.close();
});

test('after a failed appendEvents, the next appendEvents succeeds', () => {
  const db = openDb(':memory:');
  const first = ev('att_rb');
  assert.throws(() => db.appendEvents([first, { ...ev('att_rb'), id: first.id }]), /UNIQUE/);
  db.appendEvents([ev('att_rb', 'started'), ev('att_rb', 'stopped')]);
  assert.deepEqual(db.eventsForAttempt('att_rb').map(e => e.verb), ['started', 'stopped']);
  db.close();
});

test('eventsForAttempt returns only that attempt in seq order', () => {
  const db = openDb(':memory:');
  // same `at` for all, and ids not in insertion order: only seq can order them
  const at = '2026-10-10T00:00:00.000Z';
  const a = ['started', 'stopped', 'explained', 'graded'].map(v => ({ ...ev('att_a', v, { at }) }));
  a[0].id = 'evt_Z'; a[1].id = 'evt_A'; a[2].id = 'evt_M'; a[3].id = 'evt_B';
  db.appendEvents([a[0], ev('att_b')]);
  db.appendEvents([a[1], a[2], a[3]]);
  db.appendEvents([ev('att_b', 'completed')]);
  const got = db.eventsForAttempt('att_a');
  assert.deepEqual(got.map(e => e.id), ['evt_Z', 'evt_A', 'evt_M', 'evt_B']);
  assert.deepEqual(got[1], a[1], 'JSON columns parsed back to the appended event');
  assert.deepEqual(db.eventsForAttempt('att_none'), []);
  db.close();
});

test('eventsForAttempt uses the event_attempt index (EXPLAIN QUERY PLAN)', () => {
  const src = readFileSync(path.join(ROOT, 'server', 'db.js'), 'utf8');
  const where = "WHERE json_extract(context_json, '$.attemptId') = ?";
  assert.ok(src.includes(where), 'db.js queries with the indexed expression exactly');
  const file = migratedFileWithEvent();
  const plan = withRaw(file, d => d.prepare(`EXPLAIN QUERY PLAN SELECT * FROM event ${where} ORDER BY seq`).all('att_raw'));
  assert.ok(plan.some(r => /USING INDEX event_attempt/.test(r.detail)), JSON.stringify(plan));
});

test('putPack returns inserted, same, conflict', () => {
  const db = openDb(':memory:');
  const pack = { id: 'demo-trades', version: 1, json: '{"a":1}', provenance: '{"builtBy":"hand"}' };
  assert.equal(db.putPack(pack), 'inserted');
  assert.equal(db.putPack(pack), 'same');
  assert.equal(db.putPack({ ...pack, json: '{"a":2}' }), 'conflict');
  assert.equal(db.putPack({ ...pack, version: 2, json: '{"a":2}' }), 'inserted');
  assert.equal(db.putPack(pack), 'same', 'a conflict did not overwrite the stored pack');
  db.close();
});

test('logLlmCall writes one llm_call row with every column', () => {
  const file = tmpFile();
  const db = openDb(file);
  const row = { id: 'llm_01', at: '2026-10-10T00:00:00.000Z', pipeline: 'grade', prompt_version: 'grade@1', model: 'claude-x',
    ms: 1234, input_tokens: 10, output_tokens: 20, cache_read: 0, cost_usd: null, outcome: 'ok' };
  db.logLlmCall(row);
  db.close();
  assert.deepEqual(withRaw(file, d => ({ ...d.prepare('SELECT * FROM llm_call').get() })), row);
});

test('file DB is created with its directory and journal_mode wal', () => {
  const file = tmpFile();
  assert.equal(existsSync(path.dirname(file)), false);
  openDb(file).close();
  assert.ok(existsSync(file));
  assert.equal(withRaw(file, d => d.prepare('PRAGMA journal_mode').get().journal_mode), 'wal');
});

test('DEFAULT_DB_PATH is absolute and under the repo root', () => {
  assert.ok(path.isAbsolute(DEFAULT_DB_PATH));
  assert.equal(DEFAULT_DB_PATH, path.join(ROOT, 'data', 'app.db'));
});

test('getDb before initDb throws', async () => {
  const fresh = await import(`../server/db.js?fresh=${Date.now()}`); // its own module state
  assert.throws(() => fresh.getDb(), /^Error: db not initialised$/);
  const db = fresh.initDb(':memory:');
  assert.equal(fresh.getDb(), db);
  db.close();
});

test('Db exposes exactly its seven methods and no handle', () => {
  const db = openDb(':memory:');
  assert.deepEqual(Object.keys(db).sort(),
    ['appendEvents', 'close', 'eventsForAttempt', 'getCard', 'logLlmCall', 'putCard', 'putPack']);
  assert.ok(Object.values(db).every(v => typeof v === 'function'));
  db.close();
});

test('Db returns plain objects', () => {
  const db = openDb(':memory:');
  db.appendEvents([ev('att_plain')]);
  db.putCard(card());
  const [e] = db.eventsForAttempt('att_plain');
  const c = db.getCard(card().id);
  for (const [what, x] of [['event', e], ['event.result', e.result], ['event.object', e.object], ['event.context', e.context],
    ['card row', c], ['card row .card', c.card]]) {
    assert.equal(Object.getPrototypeOf(x), Object.prototype, what);
  }
  db.close();
});
