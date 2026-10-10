-- 001: the event log and the F1a stores (ADR 0001, ADR 0002, ADR 0003, ADR 0005, ADR 0006;
-- columns per docs/foundation/data-and-evidence.md §2). Run by server/db.js in one transaction.

-- Truth. seq gives the order: `at` collides at millisecond resolution (ADR 0002).
CREATE TABLE event (
  seq INTEGER PRIMARY KEY,
  id TEXT NOT NULL UNIQUE,
  at TEXT NOT NULL,
  actor TEXT NOT NULL,
  verb TEXT NOT NULL,
  object_json TEXT NOT NULL,
  result_json TEXT,
  context_json TEXT NOT NULL
);
CREATE INDEX event_attempt ON event (json_extract(context_json, '$.attemptId'));

-- Inv. 6, enforced by the database rather than by convention (ADR 0001).
CREATE TRIGGER event_no_update BEFORE UPDATE ON event BEGIN SELECT RAISE(ABORT, 'event is append-only'); END;
CREATE TRIGGER event_no_delete BEFORE DELETE ON event BEGIN SELECT RAISE(ABORT, 'event is append-only'); END;

CREATE TABLE subject_pack (
  id TEXT,
  version INT,
  json TEXT,
  provenance_json TEXT,
  created_at TEXT,
  PRIMARY KEY (id, version)
);

-- A CHECK passes when it evaluates to NULL, so the NULL tests are spelled out: length(NULL) > 0
-- is NULL, not false, and would let a live card with no stamps through (F1a-B30).
CREATE TABLE card (
  id TEXT PRIMARY KEY,
  subject_id TEXT,
  subject_version INT,
  mode TEXT,
  competency_id TEXT,
  mistake_types_json TEXT,
  subtlety INT,
  json TEXT,
  verify_json TEXT,
  status TEXT,
  prompt_version TEXT,
  model TEXT,
  source TEXT NOT NULL,
  created_at TEXT,
  CHECK (source IN ('fixture','live')),
  CHECK (source <> 'live' OR (prompt_version IS NOT NULL AND model IS NOT NULL
                              AND length(prompt_version) > 0 AND length(model) > 0))
);

CREATE TABLE llm_call (
  id TEXT PRIMARY KEY,
  at TEXT,
  pipeline TEXT,
  prompt_version TEXT,
  model TEXT,
  ms INT,
  input_tokens INT,
  output_tokens INT,
  cache_read INT,
  cost_usd REAL,
  outcome TEXT
);
