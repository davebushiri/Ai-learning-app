# 0004. No grading in the browser; offline and unreachable-server behavior

**Status:** Accepted; amended 2026-10-09 (Skip is "not graded", below). Amends `system-architecture.md` §5 ("Offline: grading with keywords") and `ai-flow.md` §2 (grader fallback "server then browser").
**Date:** 2026-10-09   **Deciders:** principal-architect
**Thread:** [0003](../team/threads/0003-f1-engine-core-proposal.md) (A3)

## Context
- `web/api.js:36` falls back to `mockGrade(scenario, …)` in the browser. That needs the answers and their keywords on the client, which breaks inv. 2.
- The server already answers within the 8 s grade deadline, using its own keyword fallback (`mock-fallback`). That is under the client's 12 s timeout. So the browser fallback runs only when the server can't be reached or returns 5xx.
- Inv. 7 says degrade, never stall, and make the fallback visible.

## Options considered
1. **Hashed or obfuscated keywords in the browser**: rejected. They still leak the answers.
2. **Drop the browser fallback, keep the server keyword fallback, and show a visible "can't reach the grader" state**: chosen.
3. **Grade offline on the device now**: rejected. It is impossible without answers on the client, and the offline queue doesn't exist yet.

## Decision
**The browser never grades.** `shared/mock-grader.js` stays in `shared/`, because it is pure, but only the server imports it.

When the STOP request fails (the network is down, a 5xx, or the client timeout passes):
- the browser shows and speaks "Couldn't reach the grader. Try again or skip." The exact copy belongs to the F1a spec's copy table;
- it keeps the explanation text;
- it offers **Try again** and **Skip**.

**What those buttons do:**
- **Try again** re-posts the same `{stepId, explanation}`. That is safe because a repeated `stepId` is idempotent ([0003](0003-server-owned-card-and-attempt-api.md)).
- **Skip** resumes narration without recording the STOP, because the server never saw it. If that STOP was on a mistake, the mistake is scored as missed at run end. **Product consequence for the PM:** the spec must state this, or choose otherwise.

**Offline (future).** Explanations are queued and graded by the server on reconnect, with the points shown when they arrive. This comes with the offline queue and PWA work. It is **not in F1**, and its phase is not yet assigned.

## Consequences
- Positive: inv. 2 holds with no exceptions, and inv. 7 holds through a visible, spoken failure state.
- Negative / risks: with no network there is no grading at all in F1. The `local-fallback` source label disappears, which is one of the two allow-listed golden-run diffs.
- Follow-ups: in W5, remove the `/shared/mock-grader.js` import from `web/api.js`. Update the foundation docs (done in this change).

## Verification
- A `grep` test asserts that no file under `web/` imports `mock-grader` or calls `scoreStop`, `scoreRun` or `resolveStop`.
- A Playwright test uses `page.route` to abort the STOP request. The panel and its spoken copy must appear, the explanation must be kept, and there must be zero console errors.

## Amendment 1 (2026-10-09, F1a re-review)
This records the product consequence that this ADR asked the PM to decide. The decision text above is unchanged except for what Skip costs.
- **Skip is "not graded" (learning-review Option B; PM DECISION, [thread 0003](../team/threads/0003-f1-engine-core-proposal.md)).** The browser reports skipped step ids in the `complete` body. A mistake that a skipped stop would have credited, and that is still uncaught at complete, gets no missed penalty. It is left out of `maxPossible` and out of the missed-critical rating, and it is still revealed with its summary, consequence and fix. A skip on a clean line costs no false-alarm penalty. This replaces "the mistake is scored as missed at run end" above.
- **Still true:** the browser never grades, and the server never sees the skipped STOP itself. Only the skip's step id reaches the server, at complete. Contract: [0003](0003-server-owned-card-and-attempt-api.md) Amendments 1–2 and [0002](0002-event-schema-v1.md) Amendments 1–2.
- **Accepted risk:** the skip ids are a client claim (F1a review R4). With one learner it is negligible. F3's catch rate excludes attempts with skips.
- **Copy:** the F1a spec's copy table owns it ("Couldn't reach the grader. Your answer is still here. Try again, or skip and this stop won't be scored.", buttons "Try again" and "Skip this stop").
