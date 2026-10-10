// The only file that imports node:sqlite (ADR 0001). It exposes named domain functions and never
// the DatabaseSync handle, so a later swap to another driver stays inside this file.
//
// Two node:sqlite behaviours shape the code (thread 0004 ruling 4):
// - A failed statement inside BEGIN leaves the connection in the transaction, so every write
//   rolls back explicitly; otherwise every later BEGIN throws until the process restarts.
// - Rows have a null prototype, so every reader copies them into plain objects.

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateEvent } from '../shared/events.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS = path.join(ROOT, 'server', 'migrations');

export const DEFAULT_DB_PATH = path.join(ROOT, 'data', 'app.db');

function inTransaction(handle, fn) {
  handle.exec('BEGIN');
  try {
    fn();
    handle.exec('COMMIT');
  } catch (e) {
    try { handle.exec('ROLLBACK'); } catch {}
    throw e;
  }
}

function migrate(handle) {
  const current = handle.prepare('PRAGMA user_version').get().user_version;
  const pending = readdirSync(MIGRATIONS)
    .map(name => ({ name, m: /^(\d{3})-.+\.sql$/.exec(name) }))
    .filter(f => f.m && Number(f.m[1]) > current)
    .sort((a, b) => Number(a.m[1]) - Number(b.m[1]));
  for (const { name, m } of pending) {
    const sql = readFileSync(path.join(MIGRATIONS, name), 'utf8');
    try {
      inTransaction(handle, () => {
        handle.exec(sql);
        handle.exec(`PRAGMA user_version = ${Number(m[1])}`);
      });
    } catch (e) {
      throw new Error(`[db] migration ${m[1]} failed: ${e.message}`);
    }
  }
}

const parse = text => (text == null ? null : JSON.parse(text));

const toEvent = r => ({
  id: r.id, at: r.at, actor: r.actor, verb: r.verb,
  object: parse(r.object_json), result: parse(r.result_json), context: parse(r.context_json)
});

const toCard = r => ({
  id: r.id, subject_id: r.subject_id, subject_version: r.subject_version, mode: r.mode,
  competency_id: r.competency_id, mistake_types_json: r.mistake_types_json, subtlety: r.subtlety,
  card: parse(r.json), verify_json: r.verify_json, status: r.status,
  prompt_version: r.prompt_version, model: r.model, source: r.source, created_at: r.created_at
});

export function openDb(file) {
  const inMemory = file === ':memory:';
  if (!inMemory) mkdirSync(path.dirname(file), { recursive: true });
  const handle = new DatabaseSync(file);
  try {
    if (!inMemory) {
      handle.exec('PRAGMA journal_mode = WAL');
      handle.exec('PRAGMA busy_timeout = 5000');
    }
    migrate(handle);
  } catch (e) {
    handle.close();
    throw e;
  }

  const insertEvent = handle.prepare(`INSERT INTO event (id, at, actor, verb, object_json, result_json, context_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)`);
  const selectAttempt = handle.prepare(
    `SELECT * FROM event WHERE json_extract(context_json, '$.attemptId') = ? ORDER BY seq`);
  const insertCard = handle.prepare(`INSERT INTO card (id, subject_id, subject_version, mode, competency_id,
    mistake_types_json, subtlety, json, verify_json, status, prompt_version, model, source, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING`);
  const selectCard = handle.prepare('SELECT * FROM card WHERE id = ?');
  const insertPack = handle.prepare(`INSERT INTO subject_pack (id, version, json, provenance_json, created_at)
    VALUES (?, ?, ?, ?, ?) ON CONFLICT (id, version) DO NOTHING`);
  const selectPack = handle.prepare('SELECT json FROM subject_pack WHERE id = ? AND version = ?');
  const insertCall = handle.prepare(`INSERT INTO llm_call (id, at, pipeline, prompt_version, model, ms, input_tokens,
    output_tokens, cache_read, cost_usd, outcome) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  // Idempotent inserts use ON CONFLICT on the key, never INSERT OR IGNORE: OR IGNORE also
  // swallows CHECK and NOT NULL violations, so a bad card would vanish silently (F1a-B31).
  const v = x => x ?? null; // node:sqlite refuses to bind undefined

  return {
    appendEvents(events) {
      if (!Array.isArray(events)) throw new TypeError('appendEvents expects an array of events');
      events.forEach((e, i) => {
        const problems = validateEvent(e);
        if (problems.length) throw new Error(`[db] invalid event ${i}: ${problems.join('; ')}`);
      });
      inTransaction(handle, () => {
        for (const e of events) {
          insertEvent.run(e.id, e.at, e.actor, e.verb, JSON.stringify(e.object),
            e.result == null ? null : JSON.stringify(e.result), JSON.stringify(e.context));
        }
      });
    },
    eventsForAttempt(attemptId) {
      return selectAttempt.all(attemptId).map(toEvent);
    },
    putCard(row) {
      insertCard.run(row.id, v(row.subject_id), v(row.subject_version), v(row.mode), v(row.competency_id),
        v(row.mistake_types_json), v(row.subtlety), JSON.stringify(row.card), v(row.verify_json), v(row.status),
        v(row.prompt_version), v(row.model), v(row.source), v(row.created_at));
    },
    getCard(id) {
      const r = selectCard.get(id);
      return r ? toCard(r) : null;
    },
    putPack({ id, version, json, provenance }) {
      // Packs are immutable per version (ADR 0006): never overwrite, only report.
      const { changes } = insertPack.run(id, version, json, v(provenance), new Date().toISOString());
      if (changes) return 'inserted';
      return selectPack.get(id, version).json === json ? 'same' : 'conflict';
    },
    logLlmCall(row) {
      insertCall.run(row.id, v(row.at), v(row.pipeline), v(row.prompt_version), v(row.model), v(row.ms),
        v(row.input_tokens), v(row.output_tokens), v(row.cache_read), v(row.cost_usd), v(row.outcome));
    },
    close() {
      handle.close();
    }
  };
}

let processDb = null;

export function initDb(file = process.env.DB_PATH || DEFAULT_DB_PATH) {
  processDb = openDb(file);
  return processDb;
}

export function getDb() {
  if (!processDb) throw new Error('db not initialised');
  return processDb;
}
