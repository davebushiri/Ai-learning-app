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
