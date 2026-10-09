# 0002. Event schema v1 (`shared/events.js`) and the F1 verb subset

**Status:** Accepted. Amended 2026-10-09 (Amendments 1 and 2, below).
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

## Amendment 1 (2026-10-09, F1a spec review)
Additive only, under the change rule above. Reasons are in [`docs/specs/F1a-server-owned-cards/review.md`](../specs/F1a-server-owned-cards/review.md) (B2, B3, B10).
- **`graded.result` gains `feedback`** (string, at most 2000 chars). A repeated STOP must return the identical body ([0003](0003-server-owned-card-and-attempt-api.md)), and the feedback text is stored nowhere else.
- **`completed.result` gains `skippedStepIds: int[]`.** It is always present and may be empty. It is copied from the `complete` body, and lists the STOPs the learner skipped after "Couldn't reach the grader". It is recorded in F1a because a skipped catch is otherwise indistinguishable from a miss in every later projection, and events can't be corrected afterwards.
- **Write rule.** A STOP's `stopped`, `explained` and `graded` are appended **after** grading, in one `appendEvents` transaction. Nothing for a STOP is written before its grade is known. A failed grade or failed write leaves no partial STOP.
- **`step-shown` stays one event, written at complete.** Per-step events derived on the server are rejected: they record an inference rather than an observation, and for abandoned attempts the last `stopped.object.step` already gives the furthest step known.
- **`context.promptVersions`** lists only the prompts the gateway actually sent to a model for that event, including ones that then fell back. In MOCK mode, and for an explicitly requested cached card, it is `{}`.
- **Ids.** `evt_` ULIDs are unique, but not ordered within one millisecond. Order is always `seq`.
- **Repeat `complete`.** The repeat body is recomputed from the card, the events and the pack, all of which are immutable. It is not stored in `completed.result`.
- `projectAttempt(events)` stays in `shared/events.js` (pure), and returns the names above: `{cardId, caughtStepIds, lastStopStepId, stopsByStepId, completed}`.

## Amendment 2 (2026-10-09, F1a re-review, spec OI-13 (b))
Additive. Reasons are in [`docs/specs/F1a-server-owned-cards/review.md`](../specs/F1a-server-owned-cards/review.md) "Re-review (round 2)". The PM chose Skip Option B ("not graded") in [thread 0003](../team/threads/0003-f1-engine-core-proposal.md).
- **`completed.result` gains `notGradedStepIds: int[]`.** F1a always writes it (possibly empty). Readers treat a missing field as `[]`. It lists the mistakes that a skipped stop would have credited and that were still uncaught at complete (`notGradedStepIdsFor` in `shared/scoring.js`).
- **`completed.result.missedStepIds` excludes not-graded mistakes.** For every `completed` event, the caught set (from `projectAttempt`), `missedStepIds` and `notGradedStepIds` are disjoint, and together they cover every mistake on the card. A projection that reads `missedStepIds` as "true misses" stays correct without knowing about skips.
- **The stored ids are the record. Never recompute them.** `notGradedStepIds` depends on `RULES.graceSteps` at the time, and that is engine code, not immutable data. A repeat `complete` and every later projection (F2 mastery and FSRS, F3 catch rate) read `skippedStepIds` and `notGradedStepIds` from the stored `completed` event. They never call `notGradedStepIdsFor` again. This narrows Amendment 1's "repeat body is recomputed": text fields still come from the card and pack, and the skip and not-graded sets come from the log.
- Rejected: leaving `notGradedStepIds` out, so it would be re-derived from `skippedStepIds`. That re-derivation silently changes historic attempts when the grace rule changes.
