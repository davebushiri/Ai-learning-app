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

## Amendment 3 (2026-10-13, F1c design review, ARCH-4 and ARCH-8)
Additive, under the change rule above. Reasons are in [`docs/specs/F1c-practice-engine/review.md`](../specs/F1c-practice-engine/review.md) "Design review"; the engine is [0008](0008-practice-engine-and-practice-pack-format-v1.md).
- **New verbs:** `self-rated`, `assisted` and `clarified` join `VERBS`. They are new verbs, not reuses: `rated-fairness` rates the grader, while `self-rated` rates the learner's own answer against the reference. `chose` and `explained` mean something else.
- **`context.engine`:** practice events always carry `engine: "practice"`. **Readers treat a missing `engine` as `"card"`.** F1a events stay unchanged, and nothing is rewritten. Practice events also carry `context.mode` (`practice` | `diagnostic` | `review`), `context.module` and `context.exerciseType`. `context.promptVersions` is `{}` until a live grader exists.
- **`pra_` attempts:** practice `attemptId` = `pra_` + ULID (`newId('pra')`). **Isolation rule:** card-engine attempt routes and `projectAttempt` handle only `att_` ids, and a `pra_` id gets 404. Practice routes handle only `pra_` ids, and an `att_` id gets 404. Every future cross-attempt projection (F2 mastery and FSRS) filters on `context.engine` first.
- **`object`:** `{type: "exercise", id: exerciseId, statement?: string, part?: string}`. `object.step` stays an integer, and practice events never use it.
- **Result shapes for practice events:**
  - `graded`: `{dimensions: {<name>: {status, matched, missing, confidence}}, overall, outcome?, assisted, confidence, graderSource, graderVersion, latencyMs}`. `outcome` reuses `OUTCOMES` (`caught`, `caught_late`, `false_alarm`).
  - `completed`: the shape in the F1c spec "Events and metrics". Stored id lists are the record and are never recomputed (Amendment 2's rule).
  - `self-rated`: `{rating, matcherStatus, graderVersion}`; the latest rating per part wins in projections.
  - `assisted`: `{kind: "reference"}`, written once per attempt.
  - `clarified`: `{text, chars, revealIndex}`.
- **Write rule:** the same as Amendment 1. A stop's or answer's `explained` and `graded` (and `stopped`) are appended after grading in one `appendEvents` call, with no `await` between reading the attempt's events and appending (sync grader, [0008](0008-practice-engine-and-practice-pack-format-v1.md)).
- **Read (ARCH-8):** `db.eventsForEngine({actor, engine})` is `SELECT … WHERE actor = ? AND json_extract(context_json, '$.engine') = ? ORDER BY seq`. **No index and no migration.** One learner writes about 10⁴ rows a month, and a full scan of that is milliseconds. An expression index (migration `002`) is added only if `GET …/progress` p95 is measured above 100 ms. The caller filters `context.subject` by `^<trackId>@`, across all versions.
- **Verification:** `tests/events.test.js` VERBS assertion (old → new: + the 3 verbs); "every practice event passes validateEvent and carries context.engine"; `tests/db.test.js` "eventsForEngine filters by actor and engine in seq order"; F1a-T12 "a pra_ id on /api/attempts returns 404"; F1c-T04 "an att_ id on /api/practice/attempts returns 404".

## Amendment 4 (2026-10-14, F1c Wave A code review: F1c-B21 and finding W-B2)
Additive, under the change rule above. Reasons are in [`docs/specs/F1c-practice-engine/review.md`](../specs/F1c-practice-engine/review.md) "Wave A code review".
- **Every practice catch stop writes the triple, including a false interruption (B21).** This confirms Amendment 3's write rule ("a stop's … `stopped`, `explained`, `graded`") and its `outcome` list. It also matches the card engine, where `graded.outcome` has always included `false_alarm`. On a false interruption, `graded.result` is exactly `{dimensions: {}, overall: null, outcome: "false_alarm", assisted, confidence: "high", graderSource: "matcher", graderVersion, latencyMs: 0}`.
  - **Reader rule:** a `graded` event with `overall: null` records a detection, not a grade.
    - Every grader-quality metric (SC-004 κ and uncertain share, fallback rate, grader latency) and every mastery input counts only `graded` events with `overall !== null`.
    - Catch and false-alarm rates read `graded.result.outcome` the same way in both engines (a missing `context.engine` means `"card"`).
  - **Rejected:** no `graded` on a false interruption. The practice log would then be the only log where a stop has no `graded`. The F2 cross-engine projection would have to branch on engine to count false alarms, and the spec's own `outcome: false_alarm` could never be written.
- **A skipped practice stop is "not graded", never "missed" (W-B2).** [0004](0004-no-grading-in-the-browser.md) Amendment 1 applies to the practice engine.
  - **Request:** the practice `complete` body gains `skipped?: [{statementId, elapsedMs}]`: at most 20 entries, each `statementId` a narration id, otherwise 400. The client lists each stop the learner skipped after `err.net`.
  - **Attribution:** the server attributes each skipped entry with the same rule as a live stop (FR-012), against the stops graded so far. If the entry would be a `hit` or `late_hit` on a planted statement that is still uncaught at complete, that statement is **not graded**.
  - **Stored record:**
    - `completed.result` gains `skippedStatementIds: string[]` and `notGradedStatementIds: string[]`. Both are always written, possibly empty, and readers treat a missing field as `[]`.
    - `missedStatementIds` excludes not-graded ids. Caught, missed, not-graded and not-reached are disjoint, and together they cover every planted statement.
    - Stored ids are the record and are never recomputed (Amendment 2).
  - **Response:** in the `complete` response, `missed[]` items for not-graded statements carry `notGraded: true` (only when true). The reveal still shows the correction without calling it a miss.
- **Verification:**
  - `tests/practice-catch.test.js`:
    - "a false interruption writes graded with outcome false_alarm and overall null";
    - "a skipped stop on a planted statement is notGraded, not missed; caught, missed, notGraded and notReached are disjoint and cover every planted statement".
  - `tests/acceptance/F1c.test.js` FR-050: QA changes the expected verb list to include the second `graded`.
- **Note (2026-10-14, F1c Wave A.1 re-check, W-S1): `stopped.result.stopId`.** This is an additive optional field under the change rule, so it is recorded here rather than in a new amendment. The decision above is unchanged.
  - `stopId` is a string matching `^[A-Za-z0-9_-]{8,64}$`. The client sends it, and it is written only when sent. It is an opaque idempotency key, one per STOP press, and is re-sent on Try again.
  - **What readers must not assume:** one stop per statement. A new `stopId` on a statement that already has a stop is a new stop, with its own triple (normally `false_interruption`).
  - **How readers join:** they attach `explained` and `graded` to their `stopped` by `seq` within the stop's single `appendEvents` batch, never by `stopId`. Events without `stopId` (older events, or clients that don't send it) stay valid.
  - **Verification:** `tests/practice-catch.test.js` "stopId is stored on stopped only when sent" and "a new stopId after a late hit is a new stop, a false interruption with its own triple (W-S1)".
- **Note (2026-10-14, F1c-T17 code review, F1c-B23): how the client stays under the 20-entry cap.** This is a client rule, so it is a note; the decision above and the server rule are unchanged.
  - The client sends at most **one `skipped` entry per `statementId`**, the one with the smallest `elapsedMs` (FR-059, `web/practice/state.js` `recordSkip`). So the list never exceeds `LIMITS.narration` (20) = the cap.
  - **Why the stored record is the same:**
    - Skips are attributed against graded stops only, never against each other.
    - `hit` doesn't depend on `elapsedMs`, and `late_hit` needs `0 ≤ elapsedMs ≤ GRACE_MS`, so the smallest entry yields every attribution any other entry on that statement could.
    - `skippedStatementIds` is already de-duplicated.
  - A 4xx on `complete` is now shown as `err.rejected`, never retried (FR-060). The attempt stays without `completed`, the abandoned shape readers already handle.
  - **Verification:** `tests/practice-web-state.test.js`:
    - "recordSkip keeps one entry per statement with the smallest elapsedMs, in first-skip order";
    - "the client skip list fits the server cap: MAX_SKIPPED ≥ LIMITS.narration".
