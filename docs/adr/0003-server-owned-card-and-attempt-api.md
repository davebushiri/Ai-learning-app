# 0003. Server-owned card and attempt API, and when answers are revealed

**Status:** Accepted. Amended 2026-10-09 (below).
**Date:** 2026-10-09   **Deciders:** principal-architect
**Thread:** [0003](../team/threads/0003-f1-engine-core-proposal.md) (A2). Dissent recorded there: backend and frontend preferred the name `runId`.

## Context
- Inv. 2 and D12 say the browser must never hold an answer before its STOP is graded. Today `GET /api/scenario` sends every `step.error`, and `POST /api/grade` trusts a scenario sent by the client (`server/index.js:157-173`).
- The browser runs `resolveStop`, `scoreStop` and `scoreRun` itself (`web/app.js:117,160-170,211`). `markLine` needs the credited mistake's step id. The feedback panel needs `correctAction` (`app.js:188`). The score shows a running total (`app.js:259`).
- A card can be replayed, so run state can't live on the card (backend's and frontend's risk in 0003).

## Options considered
1. **Key the state on `cardId`**: rejected. Two plays would share one caught set.
2. **`runId`**: rejected for naming only. The foundation event model already uses `context.attemptId`, and `sessionId` is reserved for F2's multi-card sitting.
3. **A `reveal` wrapper object plus a separate catch flag**: rejected in favor of frontend's single `caught` object. One object instead of two, and it holds exactly what `app.js` uses.
4. **Keeping `/api/scenario` and `/api/grade` after the switch**: rejected. They are the leak.

## Decision
The card holds content. An **attempt** (`attemptId` = `att_` followed by a ULID) holds run state, rebuilt from events ([0002](0002-event-schema-v1.md)). Scoring stays in `shared/scoring.js` but runs only on the server.

**`GET /api/scenarios?subject=demo-trades`** returns `[{id, label}]` and replaces `/api/trades`.

**`POST /api/attempts`**
- **Body:** `{subject: "demo-trades", scenario: "electrical", source?: "fixture"}`.
- **Returns:** `{attemptId, card: {id, subject, title, setting, apprentice, steps: [{id, line}]}, source}`.
  - `source` is `live`, `fixture` or `fixture-fallback`.
  - The public card is built by an **allow-list** projection, `toPublicCard(card)` in `shared/contract.js`, an additive change. It is never built by deleting fields.
- **Before any card is served, it is written as a `card` row.** Fixture cards get the deterministic id `fx_<packId>_<packVersion>_<scenarioId>` and are inserted once. Live cards get `card_` plus a ULID and carry `prompt_version` and `model`:
  ```sql
  CHECK (source IN ('fixture','live')),
  CHECK (source <> 'live' OR (prompt_version IS NOT NULL AND model IS NOT NULL))
  ```

**`POST /api/attempts/:attemptId/stops`**
- **Body:** `{stepId: int, explanation: string}`. The explanation is truncated to 2000 chars, and an empty one is allowed.
- **Returns:**
  ```
  { verdict: "correct" | "partial" | "wrong" | "false_alarm",
    reasoningScore: 0..1,
    feedback: string,
    source: "live" | "mock" | "mock-fallback",
    points: int,           // scoreStop() for this STOP
    total: int,            // running sum of points over this attempt's graded STOPs (what #score shows)
    caught: null | { errorStepId: int, stepsLate: 0 | 1, severity: "minor" | "major" | "critical", correctAction: string } }
  ```
- **What the fields mean:**
  - `caught` is non-null exactly when the server's `resolveStop` found an uncaught mistake. The server forces the verdict to `false_alarm` when `caught` is null, and never to `false_alarm` when it isn't (today's `index.js:99-100` rule).
  - The frontend reads `isCatch = caught !== null`, uses `markLine(caught?.errorStepId ?? stepId)`, and builds "Here's the right way: " followed by `caught.correctAction` itself.
  - A false alarm returns `caught: null`, and nothing in the body refers to any other step.
- **How `stepId` is checked, against this attempt's graded STOPs:**
  - not an id in the card → 400;
  - lower than the last graded STOP → 400;
  - **equal to an already-graded STOP → 200 with the stored result**, with no regrading and no new events. This makes "Try again" safe when a response was lost;
  - higher → resolve, grade, score, and write the events.
- **Other errors:** a second request while one STOP is in flight for the same attempt → 409. A STOP after complete → 409. An unknown attempt → 404. Bad JSON → 400. A body over 1 MB → 413.

**`POST /api/attempts/:attemptId/complete`**
- **Body:** `{lastStepShown: int}`.
- **Returns:**
  ```
  { total, maxPossible, caughtCount, mistakeCount, falseAlarms, missedCritical,
    ratingKey, ratingLabel,          // key from scoring, label from the pack (0006)
    cleanRunLine,                    // the pack's copy.cleanRun
    missed: [{ stepId, severity, summary, consequence, correctAction, points }] }
  ```
- It is idempotent. `step-shown` and `completed` are written once, and repeat calls return the same body.
- `missed[]` is the only place answers to missed mistakes appear. `why` and `keywords` are never sent, because the card can be replayed and keywords are the fallback grader's key.

**Removal.** `/api/scenario`, `/api/grade` and `/api/trades` are deleted inside F1a, after the web switches over. F1a can't close while any of them exists.

## Consequences
- Positive: closes inv. 2. W5 stays at size M because the response carries `caught`, `points` and `total`. A server restart doesn't lose an attempt.
- Negative / risks:
  - Results now need the network. This is handled by frontend's "Retry results" state with the running total.
  - On a false alarm, the grader's feedback is model text written with the whole card in view, so it could hint at a nearby mistake. This is an eval case for the evals-engineer in F1b, not a contract field.
  - The STOP request trusts the client's `stepId` timing, as today; it is range- and order-checked only.
- Follow-ups: the PM copies these shapes into the F1a spec. The spec's copy table owns the "Couldn't reach the grader" and "Retry results" copy.

## Verification
- **Leak test:** every response before grading (`/api/scenarios`, `POST /api/attempts`, false-alarm STOPs) is scanned recursively for the keys `error`, `why`, `correctAction`, `consequence`, `keywords`, `severity` and `summary`. Any hit fails the test.
- **Idempotency tests:** the same STOP posted twice gives an identical body and a single `graded` event, and so does complete.
- **Order tests:** a backwards `stepId` → 400, a STOP after complete → 409.
- A `grep` test asserts that no route named `/api/scenario` or `/api/grade` exists after F1a.

## Amendment 1 (2026-10-09, F1a spec review)
Additive. Reasons are in [`docs/specs/F1a-server-owned-cards/review.md`](../specs/F1a-server-owned-cards/review.md) (OI-1, OI-5, OI-6, B5, B8, B10, B13).
- **`GET /api/subjects`** returns 200 `[{id, title}]` for the loaded packs. The browser takes the subject id from it, because the id `demo-trades` contains a deny-listed word and so can't be hard-coded in `web/`. Rejected: a `subjects` field in `/api/health` (health reports liveness, not the catalog), and exempting pack ids from the deny-list (a hole in the ratchet).
- **`card.subject`** in the public card is the pack id (`"demo-trades"`), the same value the client sent. The version lives in the event context.
- **Order checks use the step's position**, `card.steps.findIndex(s => s.id === stepId)`, never the numeric id, because `validateScenario` doesn't require ids in order. `resolveStop` gets that index.
- **`complete` body:** `{lastStepShown: int, skippedStepIds?: int[]}`. Each skipped id must be a step id of the card, unique, and not after `lastStepShown`; otherwise the server returns 400. Ids that already have a graded STOP are ignored (the server's record wins). The ids go into `completed.result.skippedStepIds` ([0002](0002-event-schema-v1.md) Amendment 1). Whether a skipped mistake is scored as missed or "not graded" is a product decision for the F1a spec; the contract carries the ids either way.
- **Concurrency stays 409.** A second STOP while one is in flight for the same attempt returns 409. The spec's per-attempt queue is rejected: it adds waiting work, and idempotent replay already makes a retry safe. The in-flight mark is released in `finally`.
- **Fixture card stamps are NULL.** `prompt_version` and `model` stay NULL for `source = 'fixture'`, as in the CHECK above. Placeholder strings such as `"none"` are rejected, because they look like a real version in per-version queries.
- **Leak test.** The key `error` is flagged only when its value is not a string. HTTP error bodies are `{error: "<message>"}`.
