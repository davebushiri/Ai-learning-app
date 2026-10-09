# 0002. Event schema v1 (`shared/events.js`) and the F1 verb subset

**Status:** Accepted
**Date:** 2026-10-09   **Deciders:** principal-architect
**Thread:** [0003](../team/threads/0003-f1-engine-core-proposal.md) (A2, risk "chatty events")

## Context
- D8 makes events xAPI-shaped, and `data-and-evidence.md` §1 gives the shape and full verb list. F1 needs only enough to rebuild an attempt (the caught set, the last STOP) and to give F2 projections real data.
- The `id TEXT PRIMARY KEY` table in `data-and-evidence.md` §2 has no reliable order: `at` collides at millisecond resolution.
- Per-line `step-shown` requests would add a new way for narration to stall (inv. 7), and nothing in F1 would read them.

## Options considered
1. **The full verb vocabulary in F1**: rejected. It writes data with no consumer and no tests behind it.
2. **Ordering by `at`**: rejected, because of ties. **Ordering by the implicit rowid**: works, but only by accident. **An explicit `seq INTEGER PRIMARY KEY`**: chosen.
3. **A per-row schema version column**: rejected for now (YAGNI). Changes are additive only, and a breaking change needs a new ADR that adds the column.
4. **`step-shown` per line from the browser**: rejected. See below.

## Decision
`shared/events.js` is pure. It exports `VERBS` (the full vocabulary from `data-and-evidence.md` §1), `OUTCOMES`, `makeEvent(...)`, `validateEvent(e)` (which returns a list of problems and never throws), and `projectAttempt(events)`, which rebuilds attempt state: `{cardId, caughtStepIds, lastStopStepId, stopsByStepId, completed}`.

**Shape:** `{id, at, actor, verb, object, result, context}`
- `id`: `evt_` followed by a ULID, generated with `crypto.getRandomValues`, which works in both Node and the browser.
- `at`: an ISO timestamp.
- `actor`: `"learner_1"` in F1, an opaque id.
- `object`: `{type: "card", id: cardId, step?: stepId}`.
- `result`: an object or `null`.
- `context`: `{subject: "<packId>@<version>", attemptId, promptVersions: {…}}`.

**Table** (in `001-init.sql`):
```sql
CREATE TABLE event (seq INTEGER PRIMARY KEY, id TEXT NOT NULL UNIQUE, at TEXT NOT NULL,
  actor TEXT NOT NULL, verb TEXT NOT NULL, object_json TEXT NOT NULL,
  result_json TEXT, context_json TEXT NOT NULL);
CREATE INDEX event_attempt ON event (json_extract(context_json, '$.attemptId'));
```

**Verbs F1 writes** (the server is the only writer):

| Verb | When | `object.step` | `result` |
|---|---|---|---|
| `started` | Attempt created and card served | — | `{source}` |
| `stopped` | STOP graded (written in one transaction with the next two) | the `stepId` sent | `{targetStepId: int \| null, stepsLate: 0 \| 1 \| null}` |
| `explained` | Same transaction | the `stepId` sent | `{text, chars}`, with text capped at 2000 chars |
| `graded` | Same transaction | the `stepId` sent | `{verdict, reasoningScore, graderSource, outcome, points, latencyMs}` |
| `step-shown` | Once, at complete, from the body's `lastStepShown` | `lastStepShown` | `null` |
| `completed` | Complete (written once) | — | `{total, maxPossible, caughtCount, mistakeCount, falseAlarms, ratingKey, missedStepIds}` |

- **`graded.outcome`** is `caught`, `caught_late` (`stepsLate > 0`), `wrong_reason` (verdict `wrong`), or `false_alarm`. `missed` is recorded through `completed.missedStepIds`.
- **`context.promptVersions`** carries `scenario@N` on `started` for live cards and `grade@N` on `graded` whenever the gateway attempted the prompt. That includes the case where it then fell back, so fallback rate can be computed per version.
- `mode-assigned`, `mode-*` and the other verbs wait for F2 and F3.

**Change rule.** Changes are additive only: new verbs, and new optional fields. Old events are never rewritten (inv. 6), so every reader must handle every shape ever written. Renaming or removing a field needs a new ADR.

## Consequences
- Positive: attempts are a projection of events, with no `attempt` table, so a server restart loses nothing. It matches the foundation's event shape, and there's no per-line request.
- Negative / risks: attempts that are never completed leave only `started` and `stopped` events, with no `step-shown`. The abandon-step metric therefore waits for F2. The `explained.text` field is learner data, and stays local (`data-and-evidence.md` §6).
- Follow-ups: update the event table in `data-and-evidence.md` §2 (done in this change).

## Verification
- Unit tests check that `validateEvent` accepts each F1 verb's example and rejects missing fields, and that it never throws on garbage input.
- A unit test checks that `projectAttempt` rebuilds the caught set from a recorded event list.
- An HTTP test checks that one full attempt writes exactly `started`, the `stopped`/`explained`/`graded` triplets, `step-shown` and `completed`, in that `seq` order, and that each passes `validateEvent`.
