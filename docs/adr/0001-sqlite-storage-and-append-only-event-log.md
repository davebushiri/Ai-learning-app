# 0001. Storage on `node:sqlite`, forward-only migrations, trigger-enforced append-only event log

**Status:** Accepted. Amended 2026-10-10 (Amendment 1, SQL write rules). Render hosting stays out of F1 (founder F-5 confirmed, [thread 0003](../team/threads/0003-f1-engine-core-proposal.md) founder DECISION).
**Date:** 2026-10-09   **Deciders:** principal-architect
**Thread:** [0003](../team/threads/0003-f1-engine-core-proposal.md) (A1)

## Context
- D7 makes the event log the source of truth, and inv. 6 says events are append-only. Today there is no storage at all.
- The stack is Node 22+, and the only runtime dependency is `@anthropic-ai/sdk`. `open-source-landscape.md` §1 says to start with `node:sqlite` and switch to `better-sqlite3` only if it misbehaves.
- Checked 2026-10-09: Node v22.22.0, SQLite 3.50.4. `node:sqlite` loads without a flag but prints an `ExperimentalWarning` to stderr. `RAISE(ABORT)` triggers block UPDATE and DELETE, and `PRAGMA user_version` works.
- `render.yaml` uses the free plan with no persistent disk.

## Options considered
1. **`node:sqlite` behind `server/db.js`**: no new dependency, ships with Node. Con: experimental, so the API may still change.
2. **`better-sqlite3`** (MIT): mature. Con: a native build step, and a second runtime dependency we don't need yet.
3. **Append-only enforced in code only**: simpler. Con: any direct SQL can rewrite history, and nothing proves inv. 6. Rejected.
4. **A migration library** (for example umzug): rejected. Plain `NNN-*.sql` files plus `user_version` take about 30 lines.

## Decision
Use `node:sqlite`, wrapped by `server/db.js`, with `engines: ">=22.13"`. Enforce append-only on `event` with SQLite triggers. Migrations are forward-only SQL files tracked by `PRAGMA user_version`.

- **Narrow wrapper.** `server/db.js` is the only file that imports `node:sqlite`. It exports named domain functions (for example `appendEvents`, `eventsForAttempt`, `putCard`, `getCard`, `putPack`, `logLlmCall`, `close`) and never exposes the `DatabaseSync` handle. SQL lives only in `db.js` and `server/migrations/`. That keeps a later swap to `better-sqlite3` inside one file.
- **Append-only triggers** (in the first migration):
  ```sql
  CREATE TRIGGER event_no_update BEFORE UPDATE ON event BEGIN SELECT RAISE(ABORT, 'event is append-only'); END;
  CREATE TRIGGER event_no_delete BEFORE DELETE ON event BEGIN SELECT RAISE(ABORT, 'event is append-only'); END;
  ```
- **Migrations.** Files are `server/migrations/NNN-<name>.sql`, applied in number order when their number is above `user_version`. Each runs inside one transaction that also sets `PRAGMA user_version = NNN`. They are forward-only, with no down migrations. If a migration fails, the server refuses to start with a clear message. It never serves on a half-migrated schema.
- **Path.** `DB_PATH` sets the path, defaulting to `data/app.db`, which is gitignored and whose directory is created if missing. File databases use `journal_mode=WAL` and `busy_timeout=5000`. Tests set `DB_PATH=:memory:` through the helper's env, so every spawned server gets its own database. The server never detects that it's under test.
- **One writer per table.** `event` is written by the Session Engine, `card` by the card store (attempt start), `subject_pack` by the pack loader, and `llm_call` by the AI gateway.
- **Hosting.** Render stays out of F1: it's a mock demo with ephemeral data. Persistent hosting costs money, so it is **pending founder F-5**.

## Consequences
- Positive: no new dependency. Inv. 6 is enforced by the database, not by convention. Tests stay isolated with no rework of `tests/helpers/server.mjs`.
- Negative / risks: every server start prints the `ExperimentalWarning` to stderr. That's harmless, because the test helper reads only stdout. If the API changes, we swap to `better-sqlite3` behind `db.js`, which needs a new ADR because it adds a dependency (MIT).
- Follow-ups: change `engines` to `>=22.13`, add `data/` to `.gitignore`, and write migration `001-init.sql` with the tables in [0002](0002-event-schema-v1.md), [0003](0003-server-owned-card-and-attempt-api.md), [0005](0005-ai-gateway-and-prompt-registry.md) and [0006](0006-pack-format-v1.md).

## Verification
- A test runs UPDATE and DELETE on `event` and expects both to throw.
- A test migrates an empty `:memory:` database and asserts that `user_version` equals the highest migration number. Running the migrations a second time is a no-op.
- A `grep` test asserts that `node:sqlite` is imported only in `server/db.js`.

## Amendment 1 (2026-10-10, F1a-T06 build, bugs F1a-B30 and F1a-B31)
Additive. These are write rules for `server/db.js` and `server/migrations/`. They were checked on Node v22.22.0 and SQLite 3.50.4.
- **No conflict-resolution clauses on writes.** `INSERT OR IGNORE`, `INSERT OR REPLACE`, `REPLACE INTO` and `UPDATE OR …` are banned. `OR IGNORE` also skips rows that fail a CHECK or NOT NULL, so a live card with no stamps vanished with no error (B31). `OR REPLACE` is worse on `event`: it deletes the clashing row **without firing `event_no_delete`**, because `recursive_triggers` is off. Verified: `INSERT OR REPLACE` with an existing `id` rewrote history and returned `changes: 1`. That is a silent breach of inv. 6.
- **Idempotent inserts** use `INSERT … ON CONFLICT (<key columns>) DO NOTHING`. This ignores only a clash on that key. CHECK and NOT NULL are checked before uniqueness, so a bad row still throws even when its key already exists. `ON CONFLICT … DO UPDATE` on `event` is blocked by `event_no_update`.
- **CHECKs are NULL-safe.** A CHECK fails only when it is false, and anything compared with NULL is NULL. So every column a CHECK depends on is `NOT NULL`, or the CHECK spells out `IS NOT NULL` (B30). Key columns of rowid tables are `NOT NULL`, because SQLite lets a non-`INTEGER` `PRIMARY KEY` hold NULL (verified: two `card` rows with `id` NULL were both inserted).
- **`001-init.sql` may be edited in place until F1a merges to `main`.** No persistent database exists yet: Render is out of F1, `data/` is gitignored and tests use `:memory:`. Once F1a merges, schema changes go in `002-*.sql` and later files.
- **Rejected:** `PRAGMA recursive_triggers = ON` as the guard against `OR REPLACE`. It is per-connection state that a later driver swap could lose, and a ban that a grep test checks is simpler.
- **Verification:** a grep test in `tests/db.test.js` strips `//` and `--` comments from `server/**/*.js` and `server/migrations/*.sql`, then finds no match for `/\bOR\s+(IGNORE|REPLACE|ROLLBACK|ABORT|FAIL)\b|\bREPLACE\s+INTO\b/i`. The `db.js:93` comment that names the rule must not trip it. A test shows that `INSERT … ON CONFLICT (id) DO NOTHING` with an existing `id` and a failing CHECK still throws. A test shows that `card.id`, `subject_pack.(id, version)` and `llm_call.id` reject NULL.
