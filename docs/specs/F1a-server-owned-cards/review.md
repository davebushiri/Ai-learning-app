# F1a design review: server-owned cards

**Reviewer:** principal-architect · **Date:** 2026-10-09 · **Reviewed:** `spec.md` and `tasks.md` (PM draft), `learning-review.md`, against ADRs 0001–0007 and the founder DECISION in [thread 0003](../../team/threads/0003-f1-engine-core-proposal.md) (F-0 to F-6).

## Verdict: CHANGES REQUESTED

The spec is well shaped. The slicing, the waves, the golden replay as a merge gate, the copy table, the leak scan and the ratchet are all sound, and nothing in it breaks an invariant by design. **But it was written against the thread entries rather than the accepted ADRs.** About a third of the exact interfaces in the tickets contradict ADRs 0002, 0003, 0005 and 0006. Engineers build to the tickets, so the tickets must be fixed before Wave 1 starts.

**What can start now:** F1a-T02, and F1a-T03 once B11 is applied. Both are unaffected by the contract fixes. T01 should wait for the corrected shapes.

**Evidence gathered in this review (2026-10-09):**
- `npm test`: `# tests 97`, `# pass 97`, `# fail 0`, `# skipped 0`, `# todo 0`.
- `git status` works in `/home/user/ai-learning-app`, on branch `team/agents`. `git ls-files` lists 86 files.
- Deny-list hits in engine code outside `server/prompts/`, by file:
  - `server/index.js`: 11
  - `shared/mock-grader.js`: 10
  - `shared/contract.js`: 8
  - `web/api.js`: 4
  - `web/app.js`: 4
  - `server/llm.js`: 3
  - `shared/scoring.js`: 2
  - `web/index.html`: 1
  - `web/speech.js`: 0 (so T15 never touches the ratchet file)

**ADR changes made in this review** (additive amendments; no decision text changed):
- [0002 Amendment 1](../../adr/0002-event-schema-v1.md): adds `graded.result.feedback` and `completed.result.skippedStepIds`; one write transaction per STOP; one `step-shown` event; the `promptVersions` rule.
- [0003 Amendment 1](../../adr/0003-server-owned-card-and-attempt-api.md): adds `GET /api/subjects`; `card.subject` is the pack id; order checks by position; `skippedStepIds`; 409 kept; NULL stamps; the leak-scan `error` rule.
- [0005 Amendment 1](../../adr/0005-ai-gateway-and-prompt-registry.md): when `run()` is called; F1a stages `PROMPT` plus the fingerprint; `models.js` contents.
- [0006 Amendment 1](../../adr/0006-pack-format-v1.md): grader lexicon in the pack; flat `scenarios[]`; immutability covers the whole pack; rating keys restated.
- ADR status lines and `docs/adr/README.md` updated with the founder's F-0 to F-6 answers.

---

## Blocking findings (most severe first)

**B1. The gateway interface contradicts ADR 0005** (T08, FR-024, FR-026, FR-027, FR-029, T05).
- **What's wrong:** T08 keeps `llm.js`'s shape. It exports `generateScenario` and `gradeExplanation`, imports `getDb()` itself, and leaves fallbacks in the services. ADR 0005 decided `createGateway({client, logCall}) → {run}`, with `run({prompt, input, live, effort, deadlineMs, accept, fallback}) → {data, source, meta}`.
- **Why it matters:**
  - **Required fallback.** It is *the* structural guarantee of inv. 3: an AI call without a fallback can't be written.
  - **MOCK goes through the gateway.** `live:false` logs `mock`, which answers the founder-binding PM DECISION "mock and fallback paths also log".
  - **`logCall` is injected.** That keeps the gateway free of `db.js` and lets the F1b eval runner reuse it (ADR 0007).
- **Also wrong:**
  - FR-027 / T05 `PROMPT_ID` must be the ADR's `VERSION` plus `PROMPT`.
  - FR-026's outcome list lacks `mock`.
  - FR-024's `models.js` must also hold the deadline constants.
- **Smallest fix:** rewrite T08's interface to ADR 0005 and its Amendment 1. T05 exports `VERSION` plus `PROMPT = {id, system, schema, render, fingerprintInputs}`, with no text change. T08 adds `promptFingerprint`. The service maps the gateway's `source` to the route values: grade `live|mock|mock-fallback`, scenario `live|fixture|fixture-fallback`. This decides **OI-4**.

**B2. A STOP's events are written before grading, so a partial STOP can be stored** (T13 `submitStop`, FR-016).
- **What's wrong:** T13 appends `step-shown…`, `stopped` and `explained`, *then* grades (up to 8 s), *then* appends `graded`.
- **Concrete input:** `POST …/stops {stepId:3}` while fake Claude hangs. Restart the server, or have `appendEvent` throw (disk full), before `graded` is written. The log now holds `stopped(3)` with no `graded`. The learner presses Try again with `stepId:3`. FR-007 doesn't define this case: it isn't "an already-graded STOP", and `lastStopStepId` is 3, so it is neither lower nor higher. Depending on the projection, the learner gets a 400, a regrade with duplicate `stopped` events, or a STOP that counts as caught with no points.
- **Smallest fix:** grade first, then write `stopped`, `explained` and `graded` in one `db.appendEvents([...])` transaction (ADR 0001 names `appendEvents`; ADR 0002 says "one transaction"; amendment 1 makes it the write rule). T06's `appendEvent(e)` becomes `appendEvents(list)`.

**B3. Event shapes contradict ADR 0002** (spec "Events and metrics", FR-016, FR-017, US4.1, T06, T13, T14).

| Spec says | ADR 0002 (wins) | Why |
|---|---|---|
| `step-shown` for every step up to each STOP and to `lastStepShown` | **One** `step-shown` at complete, `object.step = lastStepShown`, `result: null` | Derived per-step rows are inferences, not observations. ADR verification expects exactly `started`, triplets, `step-shown`, `completed`. |
| `stopped.result {outcome, errorStepId, stepsLate}` | `{targetStepId, stepsLate}`. `outcome` lives on `graded` | `wrong_reason` can't be known before grading |
| `graded.result {…, total}` / "full StopResponse fields" | `{verdict, reasoningScore, graderSource, outcome, points, latencyMs, feedback}` (`feedback` added by Amendment 1) | `total` and `caught` can be derived; `feedback` can't, and idempotent replay needs it |
| `completed.result` with `missedCritical` | `{total, maxPossible, caughtCount, mistakeCount, falseAlarms, ratingKey, missedStepIds, skippedStepIds}` | `missedCritical` is derivable from `ratingKey`. `skippedStepIds` is new (B10). |
| `promptVersions {scenario, grade}` on every event | `scenario@N` on `started` for live cards; `grade@N` on `graded` when a prompt was sent. `{}` in MOCK. | A version stamp means "this text produced it". Stamping MOCK rows with `grade@1` would corrupt per-version fallback rates. |
| `session.projectAttempt(card, events)` in `server/services/session.js` | `projectAttempt(events)` in `shared/events.js`, returning `{cardId, caughtStepIds, lastStopStepId, stopsByStepId, completed}` | Pure logic lives in `shared/`; F2's learner model reuses it |
| `VERBS_F1`; `validateEvent` rejects non-F1 verbs | Export `VERBS` (full vocabulary) and `OUTCOMES`. `validateEvent` accepts any `VERBS` verb. A test asserts that the server writes only the F1 six. | Readers must accept every shape ever written, and F2 adds verbs |
| T14: the repeat body is "from the `completed` event's result" | Recomputed from card + events + pack (Amendment 1) | `completed.result` doesn't hold `missed[]` or labels |
| Example event `object.id: "electrical-receptacle-01"` | `fx_demo-trades_1_electrical` (ADR 0003) | `card.id` is the server's id, never the fixture's internal id |

This decides **OI-2**. Smallest fix: replace the spec's events table and its example with ADR 0002 plus Amendment 1, and change US4.1 to "1 `started`, 2 × (`stopped`, `explained`, `graded`), 1 `step-shown` with `step = lastStepShown`, 1 `completed`".

**B4. Pack format and rating keys contradict ADR 0006** (FR-019, FR-021, T07, T14, T18, US6.1).
- **Rating keys:** use `missedCritical` and `tier0`–`tier3`, with `ratings: {missedCritical, tiers: [4 labels, best first]}`. The thresholds move to `RULES.ratingTiers`, unchanged. `ratingLabel(pack.ratings, key)` goes in `shared/pack.js`. The spec's `missed-critical` / `excellent` / `solid` / `developing` / `beginning` are rejected: evaluative names put a judgement into engine code, and tier indices map one-to-one to the thresholds.
- **Layout:**
  - Use `packs/demo-trades/scenarios/<file>` with flat `scenarios[]` entries `{id, label, brief, hazardHints, criticalHints?, twists?, fixture}`.
  - Drop the `generation` wrapper, the `cards/` directory and the `format` field.
  - Required fields the spec omits: `title`, `severity: {critical, major, minor}` (the meanings from `scenario.js:13`) and `provenance: {builtBy: "hand"}`.
- **Validator location:** `validatePack` goes in `shared/pack.js` (pure, never throws), not `server/packs.js`.
- **Accepted from the spec** (added to ADR 0006 by Amendment 1): `copy.falseAlarmFeedback` and `grading.synonyms`. ADR 0006 missed the keyword grader's vocabulary.
- **Missing:** the immutability check. The loader must refuse a pack whose stored `(id, version)` row differs from what is on disk. The comparison covers `pack.json` plus every scenario file. T07's `upsertPack` ("INSERT OR IGNORE") silently keeps the old row instead. ADR 0006's verification test "loader refuses a changed pack.json whose version wasn't bumped" is missing from T07.
- This decides **OI-3**. Smallest fix: replace T07's example `pack.json` and `loadPacks` notes; rename `upsertPack` → `putPack` (insert, or compare and refuse); update T14's `RATING_KEYS`, T18's changed tests and US6.1.

**B5. Card stamps and ids contradict ADR 0003** (FR-015, T06 migration, T07 `insertCard`).
- **Stamps:** ADR 0003's CHECK is `source IN ('fixture','live')` and `source <> 'live' OR (prompt_version IS NOT NULL AND model IS NOT NULL)`. Fixture cards get **NULL** stamps. The placeholder `"none"` reads like a real version in every `GROUP BY prompt_version`. You may tighten the live branch to non-empty strings (`length(...) > 0`). That decides **OI-5**.
- **Ids:** fixture card ids are `fx_<packId>_<packVersion>_<scenarioId>`, inserted once. T07 doesn't say which id it uses.

**B6. No ticket opens the database and loads packs at startup, and lazy opening serves on a half-migrated schema** (T06 `getDb()` "opened lazily", T07 `loadPacks` "called once, lazily", FR-020 "skipped … at startup").
- **Why it matters:** ADR 0001 says that if a migration fails, the server refuses to start with a clear message and never serves on a half-migrated schema. Opened lazily, the server prints its ready line, then answers 500 on every request.
- **Smallest fix:** T07 adds `server/index.js` to its files. Before `listen`, it calls `openDb` and runs migrations, then `loadPacks()`. A migration failure exits non-zero with `[db] migration NNN failed: …`, while an invalid pack is skipped with a warning. T08 doesn't touch `index.js`, so there is no Wave 1 collision.
- `DB_PATH`'s default `data/app.db` resolves against the repo root (`ROOT`), not the process's working directory.

**B7. Pack text is injected as raw HTML in the browser** (`web/app.js:50`, carried into T17).
- **What's wrong:** `$('trade-select').innerHTML = trades.map(t => \`<option value="${t.id}">${t.label}</option>\`)`. ADR 0006 says pack text is untrusted and rendered only as text.
- **Concrete input:** a pack scenario label `"<img src=x onerror=alert(1)>"` executes script on the setup screen. That's harmless with demo-trades, but T17 rewrites this exact line for `/api/scenarios`, and F2 packs are AI-built.
- **Smallest fix:** T17 builds the options with `document.createElement('option')`, setting `.value` and `.textContent`. Add a T17 test that an e2e-served label containing `<b>` is shown literally.

**B8. The concurrency rule contradicts ADR 0003** (edge case "Concurrent duplicates are serialized", FR-007, T13 "per-attempt promise-chain lock").
- ADR 0003 returns **409** for a second STOP while one is in flight, and Amendment 1 keeps it. The spec's queue is rejected:
  - it holds requests for up to 8 s;
  - it needs a map of promise chains that is never cleaned up;
  - idempotent replay already makes a retry safe.
- With 409, the browser shows the grader-unreachable panel, and Try again then gets the stored body. T13's test "two concurrent identical STOPs produce one graded event" still holds; assert one 200 and one 409.

**B9. Tests are missing for ADR verification items and acceptance criteria.** Each of these needs a named test in the ticket that owns the code:

| Check (source) | Add to |
|---|---|
| `node:sqlite` imported only in `server/db.js` (ADR 0001) | T06 `tests/db.test.js` |
| `validateEvent` never throws on garbage (`null`, `[]`, `"x"`, cyclic object) (ADR 0002) | T06 `tests/events.test.js` |
| `messages.create` only in `server/ai/gateway.js`, and that file contains `maxRetries: 1` and `AbortSignal.timeout` (ADR 0005, standing check) | T08 `tests/gateway.test.js` |
| MOCK grade writes one `llm_call` row with outcome `mock`; an explicit `source:"fixture"` start writes none (ADR 0005 Amendment 1) | T08 (grade), T12 (start) |
| `accept` rejection, for example empty feedback or an invalid scenario, gives outcome `fallback` (ADR 0005) | T08 |
| `validatePack` never throws on garbage; the loader refuses a changed pack without a version bump; `ratingLabel` maps all 5 keys to today's 5 strings (ADR 0006) | T07 `tests/pack.test.js` |
| No file under `web/` imports `mock-grader` or `scoring`, or calls `scoreStop`, `scoreRun` or `resolveStop` (ADR 0004, FR-030) | T19 |
| No route string `/api/scenario`, `/api/grade` or `/api/trades` in `server/` (ADR 0003) | T19 |
| One full attempt writes exactly the ADR 0002 sequence, in `seq` order, and every event passes `validateEvent` | T14 |
| A failed or aborted grade writes no STOP events (B2) | T13 |
| Skip consequence (B10) | T01, T14 and the e2e suite |

**B10. ADR 0004's Skip consequence is not stated, and a skip leaves no trace** (US2.4; learning review findings 1–2).
- ADR 0004 asks the spec to state what a skipped STOP on a real mistake costs. The spec says only "no points are added".
- **Technical ruling:** record skips in F1a either way. `complete` accepts `skippedStepIds`, which are stored in `completed.result.skippedStepIds` (ADR 0002 and 0003 Amendment 1). Otherwise F2's mastery and FSRS, and F3's catch rate, permanently count a catch as a miss.
- **The PM decides** between learning review Option A (scored as missed, with honest copy) and Option B (scored "not graded"). The contract carries the ids in both. Option B also needs:
  - `scoreRun(card, stops, rules, {notGradedStepIds})`. The mistakes counted as not graded are those `resolveStop` would have credited at a skipped position and that are still uncaught at complete;
  - `missed[]` items with `notGraded: true`;
  - a test for each.
- See risk R4 for the trust cost of Option B.

**B11. The golden baseline can't record the outbound-prompt layer** (T03).
- **What's wrong:** T03 records `prompts: [{kind, system, user, schemaSha256}]` from fake Claude's `/__log`, but `/__log` stores only `user`, with no `system` and no schema (`tests/helpers/fake-claude.mjs:153-158`).
- **Why it matters:** the baseline can only be captured once, before the changes it guards, so a baseline without system text makes half of SC-001 unverifiable for good.
- **Smallest fix:** add `tests/helpers/fake-claude.mjs` to T03's files. Log `system` and `schemaSha256` (sha256 of `JSON.stringify(output_config.format.schema)`). T07 (path) and T09 (routing) edit the file later, in sequence.

**B12. Step order is checked by numeric id, but ids aren't required to be in order** (FR-007, T13, ADR 0003 "lower than the last graded STOP").
- `validateScenario` requires step ids to be unique positive integers (`shared/contract.js:133-135`), not ascending.
- **Concrete input:** a live card with step ids `[1,2,3,5,4,6,7,8,9]` passes validation. The learner STOPs on the 4th line (`stepId 5`) and then on the 5th line (`stepId 4`). The server answers 400 "backwards" to a forward move. Separately, `resolveStop` takes an array **index**, so passing `stepId` credits the wrong line on any card whose ids aren't `1..N`.
- **Smallest fix:** the server maps `stepId → index = card.steps.findIndex(...)`, and all ordering, grace and `lastStepShown` checks use the index (ADR 0003 Amendment 1). Add a T13 test using a card with non-ascending ids.

---

## Open items resolved

| OI | Decision | Where |
|---|---|---|
| OI-1 | `card.subject = "demo-trades"` (the pack id). `cleanRunLine`, the six `missed[]` keys, 409 for a STOP after complete, and same-`stepId` idempotent replay are **already decided** in ADR 0003 (§complete, §stops). Concurrency → 409 (B8). | ADR 0003 + Amendment 1 |
| OI-2 | Event layout per ADR 0002 + Amendment 1 (B3) | ADR 0002 |
| OI-3 | Pack fields and rating keys per ADR 0006 + Amendment 1 (B4). Spec keys rejected. | ADR 0006 |
| OI-4 | `VERSION` + `PROMPT` exports; MOCK paths write `llm_call` rows with outcome `mock`; an explicit cached start writes none (B1) | ADR 0005 + Amendment 1 |
| OI-5 | NULL stamps for fixture cards; `"none"` rejected (B5) | ADR 0003 + Amendment 1 |
| OI-6 | New `GET /api/subjects` → `[{id, title}]`; the web uses `subjects[0].id`. `/api/health` is unchanged. T12 creates `server/routes/subjects.js` and doesn't modify `health.js`. | ADR 0003 Amendment 1 |
| OI-7 | See below | this review |
| OI-8 | Recommendation for the founder, below | this review |
| OI-9 | **Defer to F2; no third golden diff.** Rationale and conditions below | this review |
| OI-10 | **Masking, with a membership check;** no seed env var in product code. Details below | this review |
| OI-11 | Delivered (`learning-review.md`). The PM decides findings 1, 3, 4 and 6. The architect's ruling on finding 2 is B10. | — |
| OI-12 | Answered: founder F-5 confirmed, so T15 stays in F1a | thread 0003 founder DECISION |

**OI-7 (ownership test without git).** The premise is partly wrong. `git` works in this checkout; the "not a git repo" came from the agent harness's metadata, not from the repo. Keep a fallback anyway, for tarballs and CI caches:
- **Normal path:** `git ls-files -co --exclude-standard`. That is tracked files plus untracked files that aren't ignored, so a file a ticket just created is checked before it's committed. Plain `git ls-files` would miss it.
- **When `git` is missing or exits non-zero:** walk the filesystem, excluding `.git/`, `node_modules/` and the plain line patterns in `.gitignore`. Call `t.diagnostic('ownership: git unavailable, used filesystem walk')`, which shows in the TAP output, and still assert. Never `skip`, because SC-004 requires `# skipped 0`.
- **`check:ticket` without git:** exits 2 with `git unavailable: list changed files by hand in the QA report`. It isn't part of `npm test`.
- **Golden manifest:** `gitSha` comes from `git rev-parse HEAD` when available, otherwise `null`. `treeSha256` is always recorded.

**OI-9 (pre-existing inv. 9 gap at run end).**
- **Why defer:**
  - F1a doesn't introduce the gap.
  - Fixing it adds a displayed line to every results screen, which would diff all 48 MOCK golden runs and contradict exit criterion (a) as the founder accepted it under F-0 ("two allow-listed failure states").
  - The learning review (§5) judges the learning cost low in F1, because F1 voice mode still needs the screen.
- **Conditions:**
  1. T17 builds the run-end sentence in one function, `runEndLine(result)`, and passes it to `speak()`, so the F2 fix is a one-line display change.
  2. The F2 Results spec carries the learning review §5 acceptance criterion.
  3. It ships before hands-free play (the hotword or auto-continue).
  4. No *new* F1a string repeats the gap (FR-033).
- This is a recorded, time-boxed exception, not a waiver of inv. 9.

**OI-10 (live-generated golden run).**
- Mask only the *value* after the three labels ("Draw the critical mistake from:", "Jobsite twist to include:", "Apprentice name:"), and assert that the masked value is a member of its source list:
  - the pack scenario's `criticalHints` (or its `hazardHints` split on commas);
  - `twists`, or `DEFAULT_TWISTS`;
  - `APPRENTICE_NAMES`.
- The rest of the prompt is compared byte for byte. T02's frozen snapshot proves the draw logic.
- A `SCENARIO_RNG_SEED` read by the server is rejected: it is a product-code hook whose only consumer is a test.

---

## Ticket checks

**Invariants 1–9.**
- **Inv. 1:** holds, via the ratchet (T10) and the exit allow-list (SC-003).
- **Inv. 2:** holds once B7 and B12 are fixed. The allow-list projection is good, and so is "complete never sends `why` or `keywords`".
- **Inv. 3:** holds only once B1 is fixed.
- **Inv. 4:** holds. No text changes; a frozen fingerprint (S5).
- **Inv. 5:** pack text in prompts stays unfenced until W7. That's accepted under F-0/F-4 and the F2 hard rule. The UI half is B7.
- **Inv. 6:** holds once B2 is fixed.
- **Inv. 7:** holds. Failure panels; 500 without a crash on a write failure; startup refusal (B6).
- **Inv. 8:** holds. Every US scenario has a voice and a text variant.
- **Inv. 9:** holds for the new strings. The pre-existing gap is OI-9.

**[P] collisions.**
- One collision, once B1 is applied: T08 must route the scenario call through `run()` in `server/services/content.js`, which T07 also edits. **Make T08 depend on T07**, and add `server/services/content.js` and `server/services/assessment.js` to T08's files. Both are backend tickets on the same critical path, so the cost is small.
- Every other pair checks out: T01∥T02, T04∥T05, T09∥T10∥T11, T15∥T12–T14 (`web/speech.js` has no deny-list hits) and T16∥T17.

**Waves and merge order.**
- The waves are sound.
- T11 has no dependents, so it could silently slip out of F1a. **Add T11 to T19's `Depends on`.** The founder's OI-8 answer must land before T19.
- The legacy routes stay alive until T18, after the web switch-over (T17) and the test port (T16). Good.

**Should fix**

- **S1. db API names** (T06):
  - Use ADR 0001's names: `appendEvents`, `eventsForAttempt`, `putCard`, `getCard`, `putPack`, `logLlmCall`, `close`.
  - `openDb(path)` returning an object with those methods is fine for test isolation, as long as the `DatabaseSync` handle is never exposed.
  - `eventsForAttempt` must query `json_extract(context_json, '$.attemptId') = ?` exactly, so the expression index is used.
- **S2. Flaky id test** (T06): "1000 ids are unique and sortable by time" will flake. Two ULIDs in the same millisecond sort randomly. Assert that ids are unique and that the 10-character time prefix never decreases. Order comes from `seq`.
- **S3. Leak scan false positive** (T01 `leakScan`): flagging the key `error` anywhere fails on every HTTP error body.
  - Concrete case: `POST /api/attempts {subject:"x"}` returns 400 `{error:"unknown subject"}`, and the scan reports `$.error`.
  - Fix: flag `error` only when its value is not a string (ADR 0003 Amendment 1).
- **S4. Name clash** (T12): `content.getCard` sits beside `db.getCard` with a different meaning. Rename it `content.cardForAttempt`.
- **S5. What T05 freezes** (T05): freeze `promptFingerprint`-equivalent hashes (system + schema + `render` over `fingerprintInputs`), not only `*_SYSTEM`. That pins template and schema too, and gives F1b's F-6 `pending` entries their exact values.
  - The "every module exports `VERSION` and `PROMPT`" test excludes `trades.js` by name, and T07 removes that exclusion when it deletes the file.
- **S6. Fix-line condition** (copy table, "Feedback (with fix)"): state the condition. The fix line is appended only when `caught` is non-null **and** `verdict !== 'correct'` (`web/app.js:188`). The golden replay would catch a mistake here, but the ticket should say it.
- **S7. README** (`README.md:24-25, 45, 52, 111`) documents `/api/scenario`, `/api/grade` and `local-fallback`. The definition of done requires docs to follow a contract change. Add it to T18, with the owner per OI-8.
- **S8. Orphan attempts** (T17 `startAttempt`): live-then-cached retry creates an orphan attempt (`started` with no `completed`). That's acceptable. List it under edge cases so the F2 completion rate excludes attempts with no STOP and no complete.
- **S9. In-flight mark** (T13): release the in-flight mark in `finally`, and delete it from the map when it's released, so the map doesn't grow.
- **S10. Helper edits** (T06, T07): backend editing `tests/helpers/server.mjs` and the `fake-claude.mjs` path is a recorded exception. It's fine as written. Have QA acknowledge it in T09's PR.
- **S11. Learning-review copy:** findings 3, 4 and 6 (copy and focus) fit inside the existing allow-listed runs and add no golden diff. Technically either choice is fine; it's the PM's call. If finding 4 is taken, US3.1 and the copy table change together.

**Optional**

- **O1.** T06 adds `scripts["check:ticket"]` before T11 creates the file it points to. That's harmless, but say so.
- **O2.** FR-034's facade adds `wait` and `capabilities` beyond `voice-first.md` §3's four names. That's fine; note it in `voice-first.md` when F2 adds the hotword.

---

## OI-8: file ownership recommendation (for the founder; `CLAUDE.md` not edited)

T11's test asserts that every listed file has exactly one owner. Today 39 of the 86 tracked files match no row: everything under `.claude/`, the root docs, `docs/research/`, the `docs/team` meta files, `fixtures/`, `package*.json` and `render.yaml`. Rows to add to the `CLAUDE.md` table:

| Path | Proposed owner | Note |
|---|---|---|
| `package.json`, `package-lock.json`, `.gitignore`, `.env.example` | `backend-engineer` | A new dependency still needs an ADR. A ticket may grant a named one-line exception (for example F1b's `eval:live` script line for `evals-engineer`), which is listed in its `Files:` and checked by `check:ticket`. |
| `render.yaml` | `backend-engineer` | Any change that costs money needs a founder DECISION |
| `packs/**` | `backend-engineer` | Format and file moves. A text change only through a PM ticket plus a pack `version` bump (ADR 0006 immutability) |
| `fixtures/**` | `backend-engineer` | Until T07 moves it into `packs/`; then delete the row |
| `README.md` | `backend-engineer` | It documents the running system and API (S7) |
| `docs/specs/<id>/qa-report.md` | `qa-engineer` | Created by T19 |
| `docs/specs/README.md` | `technical-product-manager` | |
| `docs/team/INDEX.md` | Everyone, rows only, per the team protocol | |
| `.claude/THIRD_PARTY.md` | Everyone, append-only | `CLAUDE.md` already requires recording copied code |
| `CLAUDE.md`, `.claude/agents/**`, `.claude/skills/**`, `docs/team/README.md`, `docs/team/templates/**`, `DEMO.md`, `PITCH.md`, `docs/research/**`, `docs/brain-backlog.md` | founder (human) | Process, positioning and research history |
| `data/` | none | Gitignored runtime data; never listed |

---

## Risks (devil's advocate)

| # | Failure mode | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | **One-engineer critical path.** T04→T06→T07→T08→T12→T13→T14→T18 is 8 sequential backend tickets, 7 of them M. A slip anywhere moves F1a's exit, and the pressure goes into "small" shortcuts in T13 and T14, where the correctness risk is (B2, B12). | M | M | Hold each ticket to its exact interface. Review T13 and T14 against ADR 0002 and 0003 before merge. Don't widen F1a. |
| R2 | **Golden flakiness erodes the gate.** 61 Playwright runs × 3. Once a flaky run appears, the pressure is to add it to the allow-list. | M | H | A flake is a harness bug ticket, never an allow-list entry. The allow-list file is fixed at T03's four ids, and the review rejects any growth. |
| R3 | **Repeat `complete` bodies depend on immutability.** If the loader's immutability check has a hole (for example, scenario files left out of the comparison), a repeat `complete` returns a different body than the first. | L | M | Amendment 1 compares `pack.json` plus every scenario file. Add a T07 test that edits a scenario file without a bump. |
| R4 | **Option B trusts client skip claims.** A client can list any step it never STOPped at in `skippedStepIds` and erase its missed penalties. With one learner the gameability is negligible, but it biases F3 catch rate exactly like the problem it fixes. | L | M | If B is chosen, F3 metrics exclude attempts with skips from catch rate rather than scoring them. The ids are in the log either way, so the choice stays reversible. |
| R5 | **`node:sqlite` breaks across a Node minor version** (it is experimental). | L | M | Already covered: the narrow `db.js` wrapper (ADR 0001). The ADR 0001 grep test (B9) keeps the wrapper narrow. |

---

## Changes the PM must make (numbered; re-submit for review)

1. **Gateway (B1):** rewrite FR-024, FR-026, FR-027, FR-029, T05 and T08 to ADR 0005 + Amendment 1:
   - exports are `VERSION` + `PROMPT` (drop `PROMPT_ID`);
   - `createGateway({client, logCall}).run({...fallback})`;
   - MOCK writes `mock` rows; an explicit `source:"fixture"` writes none;
   - `models.js` holds the deadline constants;
   - add `mock` to the outcome list;
   - T08 depends on T07 and adds `content.js` and `assessment.js` to its files.
2. **STOP writes (B2):** grade first, then write `stopped`, `explained` and `graded` in one `appendEvents` transaction. Fix FR-016, T06 (`appendEvents`) and T13, and add the test "aborted grade writes no events".
3. **Events (B3):** replace the events table, the example event, FR-016, FR-017 and US4.1 with ADR 0002 + Amendment 1:
   - one `step-shown` at complete;
   - the `stopped`, `graded` and `completed` result fields;
   - the `promptVersions` rule;
   - `projectAttempt(events)` in `shared/events.js` with the ADR's return names;
   - `VERBS`, `OUTCOMES`, and `validateEvent` over the full vocabulary;
   - the repeat-complete body recomputed;
   - `object.id` is the `fx_…` card id.
4. **Packs (B4):** rewrite FR-019, FR-021, the T07 example and notes, T14 and T18 to ADR 0006 + Amendment 1:
   - `ratings {missedCritical, tiers[4]}` with keys `missedCritical`/`tier0`–`tier3`, and `RULES.ratingTiers`;
   - `ratingLabel` and `validatePack` in `shared/pack.js`;
   - flat `scenarios[]` with `fixture` under `scenarios/`;
   - add `title`, `severity` and `provenance`;
   - keep `copy.falseAlarmFeedback` and `grading.synonyms`;
   - `putPack` with refusal on a changed pack, plus its test;
   - US6.1 reads `ratings.missedCritical`.
5. **Cards (B5):** FR-015 and T06 use ADR 0003's CHECK, with NULL stamps for fixture cards. T07 inserts fixture cards as `fx_<packId>_<version>_<scenarioId>`.
6. **Startup (B6):** T07 adds `server/index.js`. Open the DB, run migrations and load packs before `listen`. A migration failure exits non-zero; an invalid pack is skipped. `DB_PATH` resolves against the repo root.
7. **Untrusted labels (B7):** T17 builds the scenario `<option>`s with `textContent`, plus a test with a markup-bearing label.
8. **Concurrency (B8):** replace "serialized per attempt" with ADR 0003's 409 in the edge cases, FR-007 and T13, and update the concurrency test's expected statuses.
9. **Missing tests (B9):** add every row of the B9 table to the named ticket's "Tests that prove it".
10. **Skip (B10):**
    - add `skippedStepIds?` to the `complete` body (FR-008, T14, T17) and to `completed.result`;
    - decide learning review Option A or B, and state the Skip consequence in US2.4 and the edge cases, with tests;
    - fold in your decisions on learning review findings 3, 4 and 6 (copy table, US2.1, US3.1);
    - record the learning-designer's draft entries in a thread.
11. **Golden baseline (B11):** T03 adds `tests/helpers/fake-claude.mjs` to its files and logs `system` and `schemaSha256`.
12. **Step order (B12):** in FR-007, T13 and T14, all order, grace and `lastStepShown` checks work by step index (`findIndex` on `stepId`). Add the non-ascending-ids test.
13. **Subjects route (OI-6):** FR-035, T12 and T17 use `GET /api/subjects` → `[{id, title}]`. Drop `subjects` from `/api/health` and `health.js` from T12's files.
14. **Ownership without git (OI-7):** write the decision into FR-039 and T11: `git ls-files -co --exclude-standard`, a filesystem walk plus `t.diagnostic` without git, never skip, `check:ticket` exits 2. Update T03's manifest rule for `gitSha`.
15. **Run-end gap (OI-9):** record the deferral with its conditions in Open items and in F2's backlog, and add `runEndLine(result)` to T17.
16. **Live-run masking (OI-10):** in T03's normalization, mask the values only, with the membership check.
17. **Should-fix items:** apply S1–S10 (db names and index use; the id test; the leak scan's `error` rule; the `cardForAttempt` rename; the T05 fingerprint freeze; the fix-line condition; README in T18; orphan attempts in the edge cases; releasing the in-flight mark).
18. **Order:** add T11 to T19's `Depends on`. Mark OI-1 to OI-7, OI-9, OI-10 and OI-12 as resolved, citing this review. Leave OI-8 open for the founder, with the recommendation above.

---

## Re-review (round 2)

**Reviewer:** principal-architect · **Date:** 2026-10-09 · **Reviewed:** `spec.md` and `tasks.md` revision 2 (commit `9dc25c5`, 21 tickets, with T20 and T21 split out), and the PM DECISION at the end of [thread 0003](../../team/threads/0003-f1-engine-core-proposal.md) (Skip = Option B).

### Verdict: APPROVED WITH CHANGES

All of B1–B12 and S1–S10 are applied, and the OI resolutions are written into the spec. No ticket now has to break an invariant to be completed. Four changes remain (listed below). They are local to T12, T13, T14 and T17, and one of them fixes a correctness bug this round found.

- **Can start now:** Waves 0 and 1 (T01–T11, T20) and T15, unchanged.
- **Before T12, T13, T14 and T17 start:** the PM applies changes 1–4 to the spec and tickets.
- **No round 3:** I'll verify the four changes in code review against the tests they name.

**Evidence (2026-10-09, this round):**
- `npm test`: `# tests 97`, `# pass 97`, `# fail 0`, `# skipped 0`, `# todo 0`.
- `tasks.md` has 21 ticket headings, F1a-T01 to F1a-T21.

**ADR changes made in this round** (additive; no earlier decision text changed):
- [0002 Amendment 2](../../adr/0002-event-schema-v1.md): `completed.result.notGradedStepIds`; `missedStepIds` excludes not-graded mistakes; the caught, missed and not-graded sets partition the card's mistakes; stored ids are read back, never recomputed.
- [0003 Amendment 2](../../adr/0003-server-owned-card-and-attempt-api.md): `notGraded: true` on `missed[]` items, present only when true; the `skippedStepIds` echo; `complete` while a STOP is in flight → 409; repeat `complete` reads the stored ids.
- [0004 Amendment 1](../../adr/0004-no-grading-in-the-browser.md): Skip is "not graded" (PM Option B). This replaces "scored as missed".
- `docs/foundation/decisions.md`: D18, D19 and D20 rows updated. The stale OI-8 "Pending founder" row is closed, citing the founder DECISION.

### OI-13 ruling (Option B contract)

| Part | Ruling | Rule |
|---|---|---|
| (a) `notGraded: true` on `missed[]` items | **Accepted, narrowed** | Present **only** on not-graded items and never `false`, with `points: 0`. Ordinary items keep exactly six keys, so T14's test "three missed items with exactly the six keys" and the 48 MOCK golden runs are unaffected. Card order. A separate `notGraded[]` array is rejected: it duplicates the item shape, and a client that ignored it would lose the reveal. |
| (b) `completed.result.notGradedStepIds` | **Accepted, extended** | Always written; readers treat a missing field as `[]`. `missedStepIds` excludes not-graded ids. Caught, missed and not-graded are disjoint and cover every mistake. **Stored ids are the record:** a repeat `complete` and every later projection read `skippedStepIds` and `notGradedStepIds` from the stored event and never call `notGradedStepIdsFor` again, because the set depends on `RULES.graceSteps`, which is code and isn't immutable. |
| (c) `skippedStepIds` echo in the `complete` response | **Accepted** | Always present: the **effective** ids (body minus ids with a graded STOP), equal to `completed.result.skippedStepIds`. The browser's note uses `result.skippedStepIds.length`, so delete T17's "if declined" fallback. `notGradedStepIds` itself isn't on the wire; the flag carries it. |

### Interface choices (item 2 of the PM's follow-ups)

- **`run({prompt})` takes the prompt module namespace: confirmed.** `VERSION` stays a top-level export (inv. 4's single source), and the eval runner (ADR 0007) passes modules the same way. A plain object `{PROMPT, VERSION}` also satisfies it, which keeps unit tests simple. Should-fix S12 below adds a guard.
- **`session.js` exports `createSession({db, packs, gateway, mock})` and a pure `planStop(...)`: confirmed, with one correction (change 4).**
  - `planStop` stays in `server/services/session.js`, not `shared/`. It returns HTTP statuses, and it calls `resolveStop`, which ADR 0004 bans from `web/`. Putting it in `shared/` would invite browser use.
  - Injection must reach the code that calls the gateway. As written, `content.cardForAttempt` and `assessment.gradeStop` would use the module-level gateway from `ai-client.js`. In that case T13's tests with a stub gateway that "resolves after 100 ms" or "rejects" would never reach the stub.

### Bug found this round

**R2-B1. `complete` during an in-flight STOP writes `completed` before that STOP's triplet** (T13 and T14 as written; FR-007, FR-009).
- **Concrete input:** LIVE mode, fake Claude delays the grade by 5 s. `POST …/stops {stepId:3}`, then 1 s later `POST …/complete {lastStepShown:10}` from a second tab, or from a client whose STOP request it treats as failed.
- **What happens:** `completeAttempt` doesn't check the in-flight mark. It writes `step-shown` and `completed` (total 0, line 3 missed). Four seconds later `submitStop` appends `stopped`, `explained` and `graded` for line 3 and returns 200.
- **Result:** the log has a STOP after complete (FR-009 says that's a 409), and `completed.result.total` disagrees with the graded STOPs. Because events are permanent (inv. 6), F2 and F3 would each have to special-case the mismatch.
- **Fix:** change 3.

### B1–B12 and S1–S10: applied?

| Item | Status | Where |
|---|---|---|
| B1 gateway | Applied | FR-024–FR-029; T05 (`VERSION`, `PROMPT`, no `PROMPT_ID`); T08 (`createGateway`, required `fallback`, `mock` outcome, deadline constants in `models.js`, depends on T07, owns `content.js` and `assessment.js`) |
| B2 write after grading | Applied | FR-016; T06 `appendEvents`; T13 single transaction, and the test "an aborted grade writes no STOP events" |
| B3 event shapes | Applied | Events table, example (`fx_…` id), US4.1, FR-017, FR-018; `projectAttempt` in `shared/events.js`; `VERBS`, `OUTCOMES`; repeat body recomputed |
| B4 pack format and keys | Applied | FR-019–FR-021; T20 (`pack.json`, `validatePack`, `ratingLabel`, `RATING_KEYS`); T07 (`putPack` conflict, refusal tests); T21 `RULES.ratingTiers`; T18 changed tests; US6.1 |
| B5 stamps and ids | Applied | FR-015 (tightened CHECK); T06 tests; T07 `fx_<packId>_<version>_<scenarioId>` with NULL stamps |
| B6 startup | Applied | FR-013; T07 `index.js` (`initDb` and `loadPacks` before `listen`, exit 1); `DEFAULT_DB_PATH` under `ROOT`; the "never listens" test |
| B7 untrusted labels | Applied | FR-045; T17 `createElement`/`textContent`, and the `<b>x</b>` test |
| B8 409 | Applied | Edge cases, FR-007, T13 (one 200 and one 409) |
| B9 missing tests | Applied | All 11 rows appear under the named tickets (T06, T07, T08, T12, T13, T14, T19, T20, T01/e2e) |
| B10 skip | Applied, Option B | US2.5–US2.14, FR-042–FR-047, T14, T17, T21; contract settled by OI-13 above |
| B11 golden prompts | Applied | T03 owns `fake-claude.mjs` (`system`, `schemaSha256`); FR-040 |
| B12 positions | Applied | Glossary "Position", FR-007, T13 `planStop`, the non-ascending-ids test, T14 validation by position |
| S1 db names | Applied | FR-013, T06 (`openDb`/`initDb`/`getDb`; exact method list; `json_extract` query plus the EXPLAIN test) |
| S2 id test | Applied | T06 "10-char time prefix never decreases" |
| S3 leak scan `error` | Applied | FR-011, T01 `leakScan` and its test |
| S4 `cardForAttempt` | Applied | T12 |
| S5 fingerprint freeze | Applied | T05 algorithm, `trades.js` exclusion removed in T07; T08 reproduces it |
| S6 fix-line condition | Applied | Copy table, T17 |
| S7 README | Applied | T18 |
| S8 orphan attempts | Applied | Edge cases; metric rule in "Events and metrics" |
| S9 in-flight release | Applied | T13 `finally` + `delete`, and its test |
| S10 helper exceptions | Applied | Rules header; T09 acknowledges them |
| Changes 13–16, 18 | Applied | FR-035/T12 (no `health.js`); FR-039/T11/T03 manifest; FR-046 `runEndLine` and Later; T03 masking; T19 depends on T11 |

**The Option B numbers check out** against `shared/scoring.js` and the electrical card (critical 3, major 5, minor 7):
- **US2.5:** −75 − 25 = −100; max 200 + 100 = 300; −0.33 < 0.3 → `tier3`; run-end line uses the major item.
- **US2.9:** no item truly missed and one not graded → `runEndLine` returns `null`.
- **Two adjacent skips (3, 4):** the second resolves to `null`, because 3 is already in `notGradedSoFar`.

### [P] collisions and dependencies after the T20/T21 split

- **No collisions.**
  - T20 (`packs/demo-trades/pack.json`, `shared/pack.js`, `tests/pack-format.test.js`) shares no file with T04, T05 or T06. Its only later editor is T07, which depends on it.
  - T21 (`shared/scoring.js` and two new tests) shares no file with T12, T13 or T15. T13 only consumes `resolveStop` and `scoreStop`, both unchanged.
  - T11 could also run in parallel with T07 and T08. It touches only its own two files.
- **Dependencies are sound.**
  - T21 → T07 is needed (its tests read fixtures from `packs/` and the pack's labels).
  - T14 → T13 and T21; T18 → T16 and T17 (and T21 transitively), so `scoring.js` is edited T21 → T18.
  - Every [P] group's shared paths are sequenced through `Depends on`.
- **Documentation gap (optional O3):** the "Shared files are edited in sequence" rule leaves out six paths that are already sequenced by dependencies. Adding them stops a later re-plan from parallelising them by mistake:
  - `tests/mock-grader.test.js` T07 → T13;
  - `server/routes/scenarios.js` T04 → T07 → T12 → T18;
  - `scripts/simulate.js` T07 → T18;
  - `tests/scoring.test.js` T07 → T18;
  - `tests/game-balance.test.js` T07 → T18;
  - `tests/pack-format.test.js` T20 → T07.

### Remaining required changes (PM; before T12, T13, T14 and T17 start)

1. **Apply the OI-13 ruling.**
   - **OI-13 row:** mark it resolved, citing this section, ADR 0002 Amendment 2 and ADR 0003 Amendment 2.
   - **FR-008:** the response shape gains `missed[].notGraded?` (present only when true) and `skippedStepIds: int[]` (always present, the effective ids).
   - **FR-043:** `completed.result` gains `notGradedStepIds` (always present), and `missedStepIds` excludes those ids.
   - **"Events and metrics" `completed` row:** replace "(+ OI-13 proposal …)" with the field.
   - **T14:**
     - remove the "Merge blocked on spec OI-13" note and the decline paths in Notes;
     - add the tests "a never-stop run's missed items have exactly six keys and no `notGraded` key" and "caught, `missedStepIds` and `notGradedStepIds` are disjoint and cover every mistake (all fixtures × the skip scripts)".
   - **T17:**
     - remove the OI-13 merge block;
     - remove the `game.skippedStepIds.length` fallback in `resultsNote`.
2. **A repeat `complete` reads the stored ids** (ADR 0002 Amendment 2).
   - **Change:** in T14 "Already completed", the body takes `skippedStepIds` and `notGradedStepIds` from the stored `completed.result` and passes the stored `notGradedStepIds` to `scoreRun`. It doesn't call `notGradedStepIdsFor`.
   - **Test:** "repeat complete uses the stored notGradedStepIds". Build it with `createSession({db: fakeDb})`, where `fakeDb.eventsForAttempt` returns a `completed` event whose `notGradedStepIds` differs from what recomputation would give. The body must follow the stored value.
3. **`complete` while a STOP is in flight → 409** (R2-B1; ADR 0003 Amendment 2).
   - **Spec:**
     - add an edge case "`complete` while a STOP is in flight for the same attempt → 409, no events";
     - add it to FR-009.
   - **T13:** the in-flight `Map` belongs to the `Session` instance (created in `createSession`), not to the module, so both handlers share it and test sessions don't leak marks into each other.
   - **T13 and T14:** state that `submitStop` doesn't `await` between `eventsForAttempt` and setting the mark, and that `completeAttempt` doesn't `await` between `eventsForAttempt` and `appendEvents`.
   - **T14 test:** "complete while a STOP is in flight gets 409 and writes nothing; after the STOP returns, complete succeeds and counts it" (gateway stub that resolves after 100 ms).
   - **T17:** no change needed. A 409 on `complete` is a non-2xx, so the existing results-error state and "Retry results" handle it. Add one e2e assertion that a 409 on `complete` (via `page.route`) shows `#results-error`.
4. **Make the dependency injection exact** (T12, T13).
   - **`packs`:** in `createSession({db, packs, gateway, mock})`, `packs` is `{getPack, getScenarioEntry}`. The `server/packs.js` namespace satisfies it.
   - **Signatures:** the session passes its dependencies down:
     - `content.cardForAttempt({db, packs, gateway, mock}, subjectId, scenarioId, source)`;
     - `assessment.gradeStop({gateway, mock}, {card, stepId, errorStepId, explanation, pack})`.
   - **Legacy routes:** they pass the `ai-client.js` defaults.
   - **Rule:** no function that `Session` calls may import `gateway` or `getDb()` itself. Without this, T13's stub-gateway tests can't exercise the paths they name.

### Should fix (non-blocking)

- **S12. Guard the `prompt` argument** (T08): `run` rejects with `TypeError` when `prompt.PROMPT?.id` isn't a non-empty string or `prompt.VERSION` isn't an integer ≥ 1, the same treatment as a missing `fallback`. Add the test "run with a prompt lacking VERSION rejects with TypeError".
- **S13. FR-010 says a storage failure is "the only 500".**
  - **The conflict:** T13's "gateway stub that rejects" test needs a defined status, and the gateway never rejects except on a programming error (for example, a `fallback` that throws).
  - **Fix:** reword FR-010 to "a storage failure or an unexpected internal error answers 500 `{error:"server error"}`; never a crash; no events". The T13 test then asserts 500.
- **S14. Foundation follow-up (mine):** `system-architecture.md` §5 "Server unreachable (F1)" still says "Skip resumes without recording the STOP" and quotes the old copy. I'll update it to point at ADR 0004 Amendment 1 and the spec's copy table in my next foundation edit. This round was limited to ADRs and `decisions.md`.

### Risks (devil's advocate on Option B's contract)

| # | Failure mode | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R6 | **`missed[]` is overloaded.** A list called "missed" now holds items that weren't missed. Any consumer that counts `missed.length` (the F2 Results screen, a dashboard, a second client) over-counts. | M | M | The flag is present only when true; `missedStepIds` in the log excludes these items; change 1 adds the partition test; the F2 Results spec must filter on `notGraded`. |
| R7 | **Stored derived ids drift from the code.** `notGradedStepIds` freezes a judgement made under the current `graceSteps`. A later rule change makes old and new attempts disagree, and a projection that recomputes would contradict the log. | L | M | ADR 0002 Amendment 2: the log is the record, and projections and repeat `complete` read the stored ids (change 2). Changing a scoring rule is a migration with a comparison (`system-architecture.md` §4). |
| R8 | **A complete/STOP race corrupts the permanent log** (R2-B1). | L | H | Change 3: a shared in-flight mark, no `await` inside the read-then-write sections, and a test. |
| R9 | **The echo reflects client claims.** The note can say "3 stops weren't graded" for skips the client invented (R4). | L | L | Only the claimant sees the note; F3 excludes attempts with skips; the ids are logged. |

## Code review: Wave 0

**Reviewer:** principal-architect · **Date:** 2026-10-10 · **Scope:** F1a-T02 (`da42c2e`), F1a-T05 (`e552a90`), F1a-T04 (the `server/` part of WIP `7cec5c8`), and the test-only Wave 0 work (T01a `tests/acceptance/`, T03a/T03b `tests/golden/`) checked for invariant and ADR conformance. The `tests/e2e` part of `7cec5c8` and the rest of T01b are out of scope.

### Verdicts

| Ticket | Verdict |
|---|---|
| F1a-T02 | **APPROVED** |
| F1a-T05 | **APPROVED** (S2 to fix, non-blocking) |
| F1a-T04 | **APPROVED** on merge condition M1. S1 and S3 are non-blocking. Design points 1–4 are ruled below |
| T01a, T03a, T03b (test-only) | No invariant or ADR violation found |

### Evidence (run fresh this round)

- `npm test`, with the product code at `7cec5c8` and a clean tree: `# tests 110 / # pass 110 / # fail 0 / # todo 0`, `duration_ms 6554`.
- `node tests/golden/run.mjs --replay` (finished before QA's uncommitted B20 edit to `harness.mjs` at 19:48:47): `replay 1/1: 61 runs, 0 diffs, 0 allow-listed diffs, digest cc1c3558d43c7e02, 129.0 s`, exit 0. The `grade-aborted` runs show `aborts 1`; the `complete-aborted` runs show `aborts 0`, as expected before T17b.
- `node --test tests/acceptance/F1a.test.js tests/acceptance/todo-guardrail.test.js`: `# tests 76 / # pass 10 / # fail 0 / # todo 66`. The todo reasons are T07a ×2, T09, T12 ×13, T13b ×27, T14 ×22 and T18; all match `/^F1a-T\d\d[a-d]?$/`.
- **T05 fingerprints, recomputed independently.** In a scratch copy, I took `grade.js`, `scenario.js` and `contract.js` from `da42c2e^` (before any F1a ticket) and also from `dade9ef`. I fed T05's `fingerprintInputs` through the *old* functions (scenario: `Math.random` stubbed to `() => 0`), using sha256 of `system`, then `JSON.stringify(schema)`, then each `render(i)` in order, hex. Both trees give `grade 4f7d7c35…fca1b08` and `scenario 9de348f4…74fb898`, which equal the frozen values in `tests/prompt-version.test.js`. So T02 and T05 changed no prompt bytes, and FR-027 holds.
- **T04, old vs new.** Both servers ran in MOCK mode and took the same 15 requests: health, trades, unknown trade, `trade=__proto__`, fixture scenario, `GET /api/grade`, `POST /api/health`, unknown `/api/*`, static 404, encoded `..` traversal, grade with non-object steps, bad JSON, a body over 1 MB (413), a catch and a false alarm. Status codes, bodies and `[api]` lines (ms masked) are **identical**.
- **T04 design point 1, live check.** A scratch copy of the tree had a `.env` holding a fake key, `ANTHROPIC_BASE_URL` pointing at a local server that never answers, and `GRADE_DEADLINE_MS=1234`; the process env was scrubbed. Result: startup line `LIVE mode: Claude`, grade `source: mock-fallback` after 1257 ms, and `/api/health.lastLiveError` "… grade: Claude grade timed out after 1234 ms". So `.env` values still reach both `ai-client.js` (MOCK) and `llm.js` (deadlines).
- **Standing checks.**
  - `messages.create`: only in `server/llm.js:35`, with `AbortSignal.timeout(deadlineMs)` and `maxRetries: 1` at `:48` (the move to the gateway is T08a/T08b). The two `AbortSignal.timeout` hits in `web/api.js` are browser request timeouts, which ADR 0005 Amendment 2 scopes out; T17b replaces them.
  - `VERSION`: exported by `grade.js:7` and `scenario.js:7`.
  - No `UPDATE`/`DELETE` on `event` (there is no DB yet).
  - Answer fields: unchanged. The legacy `/api/scenario` still sends them by design until T18, and every new public route is still `todo`.
  - Subject words: the T04 files hold only moved legacy code (see S1 for the count).

### Blocking findings

None. Nothing in Wave 0 breaks an invariant, a contract or an ADR, and every acceptance criterion has its named test or evidence.

### Merge condition

- **M1 (F1a-T04, backend-engineer + lead): T04 has no commit of its own.**
  - Its code exists only inside WIP checkpoint `7cec5c8`, whose message says "Neither ticket is verified yet" and which also carries T01b's `tests/e2e/F1a.e2e.mjs`.
  - The ticket rule is one PR per ticket, and T04's acceptance says "zero test-file changes". A reviewer reading `7cec5c8` sees a test change under T04's name.
  - **Fix:** land T04 as its own commit or PR that touches exactly the 9 listed `server/` files. The message should explain why and quote the evidence above. QA's certification is already recorded in `7834eb8`. Alternatively, the lead records in the PR that `7cec5c8`'s `tests/e2e` hunk belongs to T01b. No code change is needed: the `server/` content of `7cec5c8` is approved as is.

### Should fix (non-blocking)

- **S1 (F1a-T04, backend-engineer): `server/index.js:1-6` still lists the four legacy routes.**
  - The dispatcher no longer defines them, line 1 says "three JSON endpoints", and `routes/scenarios.js:1-2` now repeats the same lines.
  - **Why it matters:** the split *raises* the count of `trade|electrical` hits in the moved code from 29 (old `index.js`) to 34. T10 baselines per-file counts after T07b/T08b, and F1 exit (c) needs the allow-list to shrink to `server/prompts/*` only.
  - **Fix:** replace `index.js:1-6` with one line, for example "HTTP entry point; routes are in server/routes/*". Do it in T04's commit (M1) or in T07a, which edits `index.js` next.
- **S2 (F1a-T05, backend-engineer → technical-product-manager): `e552a90` appended bug F1a-B15 to `tasks.md`.**
  - The ownership table gives `tasks.md` to the PM, with QA appending bugs. The deviation isn't explained in the commit, and the number skips B10–B14.
  - B15 itself is valid, and correctly deferred: fixing it would change prompt text, which F1a forbids (FR-027).
  - **Fix:** the PM ratifies B15 in place (no rewrite). From now on, engineers raise bugs through QA or a thread.
- **S3 (F1a-T04 → T06/T07a/T08a, backend-engineer): the env-at-load trap now rests on a comment only (`index.js:28-29`).**
  - Today only `ai-client.js` and `llm.js` read `process.env` at module load. T08a adds `server/ai/models.js`, which does too. `initDb` reads `DB_PATH` at call time (T06 interface), so it is safe.
  - **Fix:** T07a keeps every new `index.js` import that can reach `ai-client.js` or `ai/models.js` behind the dynamic import. T11 (or T07a) adds a static test: "server/index.js statically imports only `node:` builtins and `./http.js`".
- **S4 (F1a-T07b spec, technical-product-manager): required before T07b starts.**
  - `tests/scenario-prompt-rng.test.js:7` (T02) imports `TRADES` from `server/prompts/trades.js`, which T07b deletes. T07b's Files and Changed tests don't list this test.
  - **Fix:** add it to T07b as "`TRADES` import → the pack's scenario entries (setup only; the frozen snapshot string is unchanged)". Without it, T07b can't finish within its file list.
- **S5 (F1a-B20 fix, qa-engineer):** the uncommitted `tests/golden/harness.mjs:105` change redefines the `results` flag. Before it lands, run `--replay --repeat 3` with 0 diffs against the current baseline, which shows today's records don't change. If records do change, recapture under a named ticket with the 3× certification. Never cover a change with an allow-list entry (review R2).

### Rulings on the four T04 design points

1. **Dynamic `await import()` of `ai-client.js` and the routes after `loadEnvFile`: accepted.**
   - Static ESM imports are evaluated before the importer's body runs, so `MOCK` and `llm.js`'s constants would otherwise be read before `.env` is loaded. The live check above shows it works.
   - Rejected: a side-effect `import './env.js'` as the first static import. It works too, but it is a second way to express the same ordering, and the change is already verified. Revisit only if a third env-at-load module appears outside `server/ai/`.
   - Constraint: S3.
2. **`res.apiSource` for the `[api]` line: accepted.** It keeps `handle() → Promise<boolean>` exactly as the ticket specifies, and the `[api]` lines are byte-identical (evidence above).
   - Constraint for T12 and T13b: `POST /api/attempts` and `POST …/stops` set `res.apiSource = <response source>` so the line keeps its value. `complete` has no source and logs `-`.
   - Rejected: returning `{source}` from `handle`. It changes the ticket's interface for one log field.
3. **`/api/trades` in `routes/scenarios.js`: accepted.** ADR 0003 makes `/api/scenarios` its replacement, and the sequencing rule already runs `routes/scenarios.js` through T04 → T07b → T12 → T18. A `routes/trades.js` would be one more file for T18 to delete.
4. **Moved constants: accepted.**
   - `MAX_BODY_BYTES` stays private to `http.js`, because `readBody` is its only reader. `MIME` and `ROOT` are exported per the interface, and `STATIC_DIRS` stays private.
   - `MAX_EXPLANATION_CHARS` stays in `services/assessment.js`, the layer that clips the grader's input. Constraint for T13b: the STOP path's 2000-char clip (ADR 0003) reuses this one constant (export it), never a second literal `2000`.

### Test-only Wave 0 work (T01a, T03a, T03b)

- **No real API.** LIVE tests and golden runs set `ANTHROPIC_BASE_URL` to fake Claude, and the key is `sk-fake` (`tests/acceptance/helpers.mjs:107`, `tests/golden/harness.mjs:148`). MOCK runs force `MOCK=1`, so a developer's `.env` key can't switch them to live.
- **`leakScan`** (`helpers.mjs:31-60`) matches ADR 0003 Verification and Amendment 1:
  - it flags `error` only when the value isn't a string;
  - it allows `caught.severity` and `caught.correctAction` only at `$.caught` for `kind: 'stop'`, and allows all of `$.missed` only for `kind: 'complete'`;
  - it never throws. A clean step's `error: null` is flagged, which is correct: a null `error` reveals that the step is clean.
- **The failure matrix** (`F1a.test.js:880-890`) matches ADR 0005 Amendment 2's outcome table row for row: hang and 429 `retry-after: 60` → `timeout`; 500, 529, `max_tokens`, non-JSON and `{}` → `fallback`; refusal → `refusal`; fallback block → `ok`.
- **Golden isolation:** `tests/golden-isolation.test.js` passes in `npm test`. `treeSha256` reads product dirs only at `--capture` (`run.mjs:73-87`), as T03a allows.
- **Expected values:** no test uses a legacy route as its expected value. The only legacy-route uses are the T18 `todo` "returns 404" checks (`F1a.test.js:716-718`). `US1.5` uses `scoreStop` as its oracle, as spec US1.5 states; T13b's wiring is still checked through `severity` and `stepsLate`.
- **Known and filed, not repeated here:** B06 (an `exit` listener per server), B08 (the fake's generated card reads a product fixture; freeze it with T07b), B09.

### Risks (devil's advocate on what Wave 0 now freezes)

| # | Failure mode | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R10 | **The fingerprint has no separators.** `system ‖ schema ‖ render…` is hashed as one stream, so text moved across a boundary can, in principle, keep the hash. With 4–5 renders that each repeat the template's head, a moved prefix changes every render, so the realistic hole is tiny. But ADR 0005 fixes this exact algorithm, and T08a must reproduce it, so it can't be quietly fixed later. | L | M | Accept for F1. If it ever matters, a new ADR changes the algorithm, re-pins F-6's `pending` entries, and needs founder sign-off. It must never be changed silently in T08a. |
| R11 | **Fingerprint inputs live in the product prompt modules** (`grade.js` `FP_CARD`, `scenario.js` `FP_ENTRY`). Editing them changes the fingerprint without any prompt change, so it forces a `VERSION` bump and an eval run for nothing. And as the deny-list grows in F2, their synthetic words (wall, pipes, mirror) could start to hit. | M | L | The T05 test already scans them for the seed words. The F1b staleness test should report "inputs changed" separately from "text changed" before anyone bumps `VERSION`. |
| R12 | **The dynamic-import ordering is a convention, not a check.** A future static import of a route or service in `index.js` silently reads env before `.env` loads. In MOCK it would *look* fine, so `npm test` (all env passed explicitly) wouldn't catch it. | M | M | S3's static test. |
| R13 | **`res.apiSource` is an untyped expando on Node's response object.** A new route that forgets it logs `-`, and nobody notices, because no test reads `[api]` lines. | M | L | The T12/T13b constraint above. If the `[api]` line becomes a metric source, move it into a tested helper first. |

## Code review: Wave 1

**Reviewer:** principal-architect · **Date:** 2026-10-12 · **Scope:** F1a-T06 (`90f090c` + `620b3fc`, follow-up `1c6cdf8` + `32e7593`), T20 (`6a080e8`), T07a (`d2b18a0` + `4fd1d74`, manifest in thread 0004), T07b (`69acf28`), T08a (`d2b18a0`, manifest in thread 0004), T08b (`4140422`), T09 (`c42454a` + `4d1ac59`), T10 (`7d65254`), T11 (`d2b18a0` + `7054e7e`). Diff base `8cbd300` (end of Wave 0). Checked against the `CLAUDE.md` invariants, ADRs 0001–0007 with every amendment, and each ticket's rev 4.2/4.3 text. The PM's uncommitted rev 4.4 triage of `tasks.md` was read, and is referenced where it already covers a finding.

### Verdicts

| Ticket | Verdict |
|---|---|
| F1a-T06 | **APPROVED** |
| F1a-T20 | **APPROVED.** Its test's two source-text reads (B57) are removed in T13b under rev 4.4, which I confirm |
| F1a-T07a | **APPROVED.** W1-S2 is non-blocking |
| F1a-T07b | **APPROVED** |
| F1a-T08a | **APPROVED.** W1-S1 is non-blocking |
| F1a-T08b | **APPROVED** |
| F1a-T09 | **APPROVED** |
| F1a-T10 | **APPROVED.** W1-S4 is non-blocking |
| F1a-T11 | **CHANGES REQUESTED** (W1-B1) |

### Evidence (run fresh this round, `TMPDIR=…/scratchpad/arch-w1`)

- **`npm test`** (tree at `4d1ac59`; the only uncommitted file is the PM's `tasks.md`): `# tests 302 / # suites 17 / # pass 239 / # fail 0 / # cancelled 0 / # skipped 0 / # todo 63`, `# duration_ms 6788`, exit 0.
- **`node tests/golden/run.mjs --replay`:** `replay 1/1: 61 runs, 0 diffs, 0 allow-listed diffs, digest cc1c3558d43c7e02, 99.2 s`, exit 0. The digest is the same as Wave 0's.
- **Legacy routes, before and after.** I served `git archive 8cbd300` and HEAD side by side in MOCK and sent the same 9 requests to each: `/api/trades`, `/api/scenario` for all three ids, `source=fixture`, `__proto__`, an unknown id, no id, and one `POST /api/grade`. Bodies and status codes are **identical**. `npm run simulate` output is also byte-identical (T07b, FR-023).
- **Env load order, live.** I ran a copy of the tree with the process env scrubbed (`env -i`). Its `.env` held a fake key, `ANTHROPIC_BASE_URL` pointing at a server that never answers, `GRADE_DEADLINE_MS=1234`, `DB_PATH` and `PORT`. Results: startup said `LIVE mode: Claude`; grading returned `mock-fallback` after 1259 ms; `/api/health.lastLiveError` read "grade: Claude grade timed out after 1234 ms". The DB file named in `.env` held exactly one `llm_call` row `{pipeline: grade, prompt_version: grade@1, model: claude-opus-5-5, ms: 1240, tokens 0/0, outcome: timeout}` and three `fx_demo-trades_1_*` fixture cards with NULL stamps. So `.env` reaches `ai-client.js`, `ai/models.js`, `db.js` and the SDK client, and the fallback is labelled.
- **Standing checks.**
  - `messages.create` appears only at `server/ai/gateway.js:56`, with `AbortSignal.timeout(deadlineMs)` and `maxRetries: 1` at `:69`. `tests/gateway-wiring.test.js` enforces this.
  - Only `server/db.js` imports `node:sqlite` in product code. Tests open read-only handles, which the ADR allows.
  - No `UPDATE`, `DELETE`, `OR IGNORE`, `OR REPLACE` or `REPLACE INTO` appears in `server/` outside comments (grep, and `tests/db.test.js`).
  - `VERSION = 1` in `grade.js:7` and `scenario.js:7`. The frozen fingerprints `4f7d7c35…` and `9de348f4…` are unchanged (FR-027).
  - Subject words: `tests/deny-list.test.js` is green, and the allow-list matches the tree exactly.
  - Answer fields: no new public route exists yet. The legacy `/api/scenario` still sends the full card by design until T18.
- **Ownership.** Every ticket commit touches only its `Files:` line, plus `tasks.md` bug appends and QA's `todo` flips in `tests/acceptance/F1a.test.js`. The exception is in W1-S6. T09's `tests/gateway.test.js` diff is the `after` hook only, as allowed.

### Blocking findings

- **W1-B1 (F1a-T11, qa-engineer): `check:ticket` lacks rev 4.2's `--head <ref>` option and its named test.**
  - `tests/tools/check-ticket.mjs:84-93` parses only `--base`, and `:79-82` always adds untracked files. T11 (rev 4.2, F1a-B51) requires `--head`, under which the changed files are `git diff --name-only <base> <head>` only, with no untracked files. It also requires the test "check-ticket --base A --head B lists only files changed between A and B". Neither exists.
  - The likely cause: T11 was certified at `7054e7e`, before rev 4.2 (`ad8e5d4`) added this. But the ticket text is what binds.
  - **Why it matters:** T19b's method (a) is `check:ticket <id> -- --base <first>^ --head <last>`. Without `--head`, every clean-commit ticket falls back to a hand check, or gets a wrong answer: on the shared branch, a run without `--head` diffs against the working tree and counts every later ticket's files as extra. That is a missing acceptance test.
  - **Smallest fix:**
    - in `parseArgs`, accept `--head <ref>`;
    - in `changedFiles(base, head, cwd)`, run `git diff --name-only <base> <head>` and skip `ls-files -o` when `head` is set;
    - add the named test (a temp repo with two commits plus an untracked file; assert only commit B's files are listed);
    - update the usage line.
  - **Also (same PR):** the F1a-B50 assertions exist (`tests/ownership.test.js:222-232`), but inside "CLAUDE.md ownership table parses". Move them into the named test "a bare token after a concrete file is relative to its directory; after packs/** it is a root path (README.md is owned)", so the T19b evidence can cite it by name. No assertion change.
  - **Does not block Wave 2.** It blocks T11's closure and T19b.

No other finding breaks an invariant, a contract or an ADR.

### What was checked and holds (by focus area)

- **Storage (T06).**
  - The migration matches `data-and-evidence.md` §2 column for column. Keys and `source` are `NOT NULL`. The `card` CHECK is ADR 0003 Amendment 4's NULL-safe form. Both append-only triggers are present.
  - `putCard` and `putPack` use `ON CONFLICT (<key>) DO NOTHING` (`db.js:85, :88`).
  - Each migration and each `appendEvents` uses the explicit `BEGIN`/`COMMIT`/`ROLLBACK` pattern, and validation runs before `BEGIN`.
  - Readers copy rows into plain objects.
  - `Db` exposes exactly seven methods and no handle.
  - B06 (one shared `exit` listener) is fixed and tested.
  - The ADR 0001 Amendment 1 grep test also tests its own scanner against comments.
- **Packs (T20, T07a).**
  - `validatePack` is pure and never throws (it is wrapped). It caps counts and lengths, and its fixture regex rules out path traversal.
  - The loader validates each scenario file with `validateScenario` and stores canonical JSON of `pack.json` plus the scenario files. It refuses on `'conflict'` and inserts fixture cards with NULL stamps.
  - Lookups go through `Map`s, so `__proto__` is safe. Registry objects are deep-frozen, and every response gets a `structuredClone`.
  - On invariant 5: pack text reaches a prompt only through the legacy scenario route, and only for `demo-trades`. That is the known violation on the ratchet until W7 (ADR 0006). See W1-S3 for the gap this leaves from Wave 2 on.
- **Gateway (T08a, T08b).** Invariant 3 holds in full:
  - JSON schema in `output_config.format`;
  - `AbortSignal.timeout` and `maxRetries: 1`;
  - a required `fallback` (`TypeError` otherwise);
  - exactly one `llm_call` row per `run()`, written before `fallback()`, with `{pipeline: promptId, prompt_version, model, ms, input_tokens, output_tokens, cache_read}`;
  - the outcome comes from typed SDK classes, never from message text.
  
  The live-path order `responseText → JSON.parse → normalize → accept` matches ADR 0005 Amendment 2. The request body is `llm.js:35-49` verbatim, plus the header. Service wiring keeps `noteLive`, the warn lines and FR-029's source mapping. `ai-client.js` is the only client constructor. The env order holds (evidence above).
- **Cards (T07b).** `toPublicCard` (`shared/contract.js:181-190`) is a true allow-list: it builds a new object literal and copies six named keys and `{id, line}` per step. Its test adds non-enumerable and extra keys and scans the serialized output. `validateScenario` dropping `trade` loosens validation, which is backward compatible, and `SCENARIO_SCHEMA` is byte-unchanged.
- **Test tooling (T09, T10, T11).**
  - Fake Claude routes on the header. A missing header gets 500 and `kind: null`, and `assertNoUnroutedCalls` is async and rejects with an `AssertionError`.
  - The generated card is frozen inline (B08). Golden still shows 0 diffs, so the frozen card equals the old fixture.
  - B09 is fixed with a `realpath` guard.
  - The deny-list matcher's boundaries and phrases are tested.
  - The ownership parser follows the B50 rule.
  - Gaps: W1-B1, W1-S4, and B66 (now T16).

### Should fix (non-blocking)

- **W1-S1 (F1a-T08a follow-up, backend-engineer; PM to place it): `run()` doesn't guard `deadlineMs`, so a missing or bad deadline gives a silent permanent fallback.**
  - Concrete input: `gateway.run({prompt: gradePrompt, input, live: true, fallback})` with no `deadlineMs` returns `source: 'fallback'`, `outcome: 'fallback'`, and `meta.error` "The "delay" argument must be of type number. Received undefined". It sends **zero** requests. `deadlineMs: -1` (for example `GRADE_DEADLINE_MS=-1` in `.env`; `models.js:9-10` only defaults falsy values) gives the same result with `ERR_OUT_OF_RANGE`. Verified in scratch.
  - **Why it matters:** `AbortSignal.timeout(deadlineMs)` is evaluated inside the `try` at `gateway.js:55-79`, so a caller bug looks like a flaky model, not a bug. Invariant 3 still holds (no request goes out without a deadline), but the S12 guards exist to make exactly this kind of mistake loud.
  - **Fix:** in `checkArgs` (`gateway.js:33-40`), when `live` is true, throw `TypeError` unless `Number.isInteger(deadlineMs) && deadlineMs > 0`, and write no row. Add the case to "run with a prompt lacking VERSION rejects with TypeError" or a sibling test. In `models.js`, use the default for any value that isn't a positive integer.
  - **Ruling on the lead's open question (thread 0004, T08a EVIDENCE): a throwing `fallback()`.** Keep today's behavior: `run()` rejects after its row is written, and the route answers 500. There is no second fallback to fall back to, and the process stays up (invariant 7's "never crash"). The contract is that **a fallback must not throw**. F1a's only known breach is B60, which T13b fixes.
  - Both points are gateway rules. I will record them as ADR 0005 Amendment 3 in a separate docs change (this change touches only `review.md`).
- **W1-S2 (F1a-T07a follow-up, backend-engineer; PM to place it, for example with B70 in T18): the loader doesn't tie a pack's `id` to its directory name.**
  - Concrete input: `packs/a/pack.json` and `packs/b/pack.json`, both `id: "demo-trades"`, versions 1 and 2. Both load. `listSubjects()` returns one entry, and `getPack('demo-trades')` silently serves whichever directory sorts last (`packs.js:102, :111`). Verified in scratch.
  - **Why it matters:** ADR 0006's layout is `packs/<id>/pack.json`, and events name `<id>@<version>`. Two copies of one id make "which content is behind this name" depend on directory order.
  - **Fix:** in `loadOne`, `fail('pack id <id> does not match its directory <name>')` when `pack.id !== path.basename(packDir)`. Add a `tests/pack.test.js` case.
- **W1-S3 (F2 hard rule, qa-engineer; PM to place it in T12 or T19a): nothing structural stops a second pack from reaching the unfenced scenario prompt.**
  - From T12 on, `POST /api/attempts` takes `subject` from the client, and every directory under `packs/` loads. A second pack's `brief`, `hazardHints`, `criticalHints` and `twists` would go into the system-adjacent prompt unfenced (ADR 0006, "Today's unfenced uses"). The founder's F2 hard rule forbids that until W7 passes the gate, but today the rule is only a convention.
  - **Fix:** one test, "packs/ holds only demo-trades while the deny-list allow-list has a server/prompts entry". It reads `tests/fixtures/deny-list-allow.json`, so it relaxes by itself when W7 empties the list.
- **W1-S4 (F1a-T10, qa-engineer): the deny-list scan skips any directory *named* `packs`, `fixtures` or `tests` at any depth** (`tests/deny-list.test.js:12, :33`).
  - Concrete input: a new `web/fixtures/demo.js` containing "breaker" isn't scanned, and the test stays green.
  - The top-level `packs/`, `fixtures/` and `tests/` are never under the four scan roots anyway, so the exclusion only ever takes effect at depth, where it is a hole.
  - **Fix:** exclude only `node_modules`, or compare the path relative to the repo root (`packs/…`). Today's counts don't change.
- **W1-S5 (constraint for F1a-T13b, backend-engineer): `validatePack` accepts `grading.synonyms` keys such as `__proto__` and `constructor`** (`shared/pack.js:65`). Verified: a pack with a `"__proto__"` synonym term validates with zero problems, because `JSON.parse` makes it an own key.
  - When T13b moves the lexicon into `mockGrade`, iterate with `Object.entries` or `Object.hasOwn`, never `synonyms[word]` on a word taken from the learner's explanation. Add one `mock-grader.test.js` case with a `constructor` term. No `validatePack` change is needed.
- **W1-S6 (process, backend-engineer → technical-product-manager):** `69acf28` and `4140422` appended F1a-B57–B62 straight into `tasks.md`. That repeats Wave 0 S2, which said engineers raise bugs through QA or a thread. The bugs are valid, and rev 4.4 has triaged them. **Fix:** the PM ratifies them in place, as with B15, and the lead reminds the backend brief.

### Optional

- **W1-O1 (backend-engineer):**
  - `migrate()` (`db.js:31-48`) would run two files with the same number, and would never run a `002-b.sql` added after `002-a.sql` had been applied.
  - It also serves a DB whose `user_version` is above the highest file, which means a newer build migrated it.
  - Neither can happen while `001-init.sql` is the only file. Add "migration numbers are unique and contiguous" and "user_version above the highest migration refuses to start" when `002-*.sql` arrives.

### Bugs: does anything need the architect?

The PM's rev 4.4 triage (uncommitted at review time) covers every one of these. My technical view on each:

| Bug | Architect ruling |
|---|---|
| **B57** | **Concur** with rev 4.4: T13b deletes both source-text reads (`pack-format.test.js:149` `web/app.js`, `:174-177` `mock-grader.js`) and keeps the frozen literals. Both reads broke the "no test compares against something a later ticket deletes" rule. |
| **B60** | **Concur** (T13b `Array.isArray` guard). It also settles the throwing-fallback question: fallbacks must not throw (W1-S1 ruling). |
| **B61** | **Concur** (`contract.js:25` → T13b; `index.js:23`, `models.js:2` → T18). If W1-S1 lands in an earlier ticket that touches `models.js`, fix the comment there. |
| **B62** | **Concur** (T19a, comment only). |
| **B65** | **Concur with the deferral to F1b.** F1a can't send a third prompt id (FR-027; T08a pins `grade@1`/`scenario@1`). A grade call answered with a scenario body fails `accept`, and every happy-path LIVE test asserts `source: 'live'`. The F1b contract the PM wrote (500 plus `kind: null` for unknown ids) is the right one. |
| **B66** | **Concur** with `afterEach(() => assertNoUnroutedCalls(stub))` in T16 for `gateway.test.js`, `server.test.js` and `llm-deadline.test.js`. It is simpler than changing the helper, and it runs before the next `reset()`. The negative proof in the PR is required. |
| **B67** | **Concur** (Later; dead branch, no effect on SC-007). |
| **B68** | **Concur** (F1b W9). `times` plus `setMode` and injected gateway stubs cover every F1a sequence. |
| **B70** | **Concur** (T18 comment reword plus removal of the allow-list row; SC-003 needs it). W1-S2 fits in the same `server/packs.js` edit if the PM places it there. |
| **B71** | **Concur, closed as by design.** The inline seed is a frozen expected value, and the JSON may grow. The seed-present test already catches drift. |

### Risks (devil's advocate on what Wave 1 now freezes)

| # | Failure mode | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R14 | **Triggers don't cover DDL.** A future migration that does `DROP TABLE event`, or SQLite's 12-step "rebuild the table" ALTER pattern, erases history and the triggers with it. Invariant 6 then rests on review alone. | L | H | When `002-*.sql` arrives, add a migration test: the event row count and both triggers survive every migration, and no migration text matches `DROP TABLE event\b` or `ALTER TABLE event\b`. |
| R15 | **The row is logged before `fallback()` runs, and a throwing `logCall` is only warned.** If the DB write fails (disk full, a locked file opened by an outside tool), learners still get answers, but `llm_call` under-counts. Cost and fallback-rate metrics then go quietly wrong. | L | M | Accept for F1. In F3, when the cost dashboard reads `llm_call`, count `[gateway] llm_call log failed` warnings in `/api/health` so the gap is visible. |
| R16 | **An in-place edit of `001-init.sql` never reaches an existing local DB.** ADR 0001 Amendment 1 allows editing 001 until F1a merges. But `npm start` and `npm run mock` now persist to `data/app.db`, and once that file is at `user_version 1` the edited 001 is skipped. A developer's or agent's local server then runs silently on the older schema (for example, one without the NOT NULL keys), while `npm test` (`:memory:`) is green. | M | L | Any change that edits `001-init.sql` says "delete `data/` before the next local run" in its commit message. If it recurs before merge, `migrate()` stores a sha256 of each applied file and refuses to start on a mismatch. |
| R17 | **`deny-list-allow.json` counts are per file, not per location.** A ticket can remove one hit and add another of the same word in the same file, and the ratchet stays green. | M | L | Accept: review catches it, and the F1 exit needs the allow-list empty outside `server/prompts/*` anyway. If it recurs, store the line text, not just the count. |
