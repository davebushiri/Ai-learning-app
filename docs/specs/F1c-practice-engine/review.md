# F1c review: practice engine

## Design review (2026-10-13)

**Reviewer:** principal-architect · **Reviewed:** `spec.md` and `tasks.md` revision 1, against ADRs 0001–0007, F1a `tasks.md` Wave 2, the code at `496e0b3`, and the module-1 drafts in `docs/research/applied-ai/module-1/`. The learning review (LR-1 to LR-8) isn't in yet. Nothing ruled here depends on it.

### Verdict: APPROVED WITH CHANGES

The shape is right: a separate engine, server-owned from day one, sharing only storage, the event log and the static server, with nothing in the golden surface. No ticket has to break an invariant. **Wave A (T01a, T02, T03 → T04 → T05) may start as soon as the PM applies C1–C8.** No re-review is needed; I check the diff at code review. C9–C15 must be applied before their Wave B or C tickets start.

**Evidence gathered:**
- `npm test` at `496e0b3`, before any edit in this review: `# tests 304 / # pass 241 / # fail 0 / # todo 63`.
- The 16 proposed deny-list words have 0 hits in `server/ shared/ web/ scripts/` (`grep -rniwE`, per word).
- Module-1 content: a script over all 16 exercises found that every narration id is in exactly one of `planted` and `clean`; concept ids and `kind` match their patterns; no planted statement appears in its references; every `referenceIds` entry resolves to a file by prefix. 64 rubric items use `|` alternation.
- `tests/tools/check-ticket.mjs:52` reads backticked paths from the `- **Files:**` line only.
- `/api/subjects` doesn't exist yet: F1a-T12 creates it, and today's routes are `/api/health`, `/api/trades`, `/api/scenario` and `/api/grade`.
- `web/speech.js:57-78` `listen()` gives only cumulative text through `onInterim`, with no per-segment `isFinal`.

### Rulings
| # | Ruling | Recorded in |
|---|---|---|
| ARCH-1 | **(a).** `server/packs.js` skips, silently, a directory with `practice.json` and **no** `pack.json`, in one guarded line (F1c-T02). If both files exist, `pack.json` loads as before. Sequence: F1c-T02 → F1a-T18. | ADR 0008 |
| ARCH-2 | **The F2 hard rule doesn't block F1c.** Its reason is pack text in prompts, and practice packs enter no prompt. A guard test makes that structural. The rule's wording is a founder decision (F-0), so **the founder confirms this reading in thread 0007 before F1c-T11 merges.** Waves A–C are not blocked, because fixture packs don't ship. The live grader brings practice packs under the rule in full. | ADR 0006 Am. 3, ADR 0008 |
| ARCH-3 | **Practice pack format v1 accepted,** with C1 and C2. It shares the `subject_pack` key space. The practice loader runs after `loadPacks()` and refuses an id that `getPack(id)` holds. The manifest is named `practice.json`. | ADR 0008 |
| ARCH-4 | **Accepted, additively:** 3 new verbs; `context.engine: "practice"` (missing means `"card"`); `pra_` vs `att_` isolation, with each engine's routes returning 404 for the other's ids; `object.type: "exercise"` with string `statement`/`part`; result shapes as in the spec. | ADR 0002 Am. 3, `data-and-evidence.md` §1 |
| ARCH-5 | **(a)** `server/services/practice-matcher.js`, server-only and pure. Consolidate with `shared/mock-grader.js` after F1a-T13b merges. | ADR 0008 |
| ARCH-6 | **Neither option as posed.** `web/practice/speech.js` (created by T05) is the **only** practice module that imports `/speech.js`. When F1a-T15 builds the facade it rewrites that one file and forwards `onSegment` (C8). No re-export shim stays behind. | ADR 0008 |
| ARCH-7 | **The seam is synchronous in F1c** (`grader(input) → GraderOutput`). The later live grader is `gateway.run({…, fallback: () => matcherGrade(input)})` with a new fenced, versioned prompt. Going async needs the in-flight join (ADR 0003 Am. 3 pattern) in its own amendment. | ADR 0008 |
| ARCH-8 | **`json_extract` filter, no index, no migration.** The caller filters `context.subject` by `^<track>@` across versions. Add an index only if progress p95 is measured above 100 ms. | ADR 0002 Am. 3 |

### Findings (most severe first)

**F1. The schema rejects the real content** (spec "Exercise schema", T11). This is blocking for T11. Five mismatches:

| Content (`docs/research/applied-ai/module-1/`) | Spec | Resolution |
|---|---|---|
| Rubric items use `a\|b` alternation (64 items) | FR-017 has no alternation | **C1**: support it in the matcher |
| `sources[].verified` is a string (`fetched-2026-10-13`, `abstract-snippet-…`, `cited-from-memory-not-fetched`, `UNVERIFIED`) | boolean | **C2**: boolean plus optional `note`; T11 maps it (C12) |
| interview `followUps` are `string[]` | `{question, rubric}[]` | **C2**: allow strings, self-rated only |
| scenario `acceptableArchitectures` are `{name, summary, strengths, tradeoffs}` | `{id, summary, mustInclude}` | **C2**: `mustInclude` optional; T11 derives `id` |
| scenario `challenges` are `{challenge, expected}` | `{question, rubric}` | Rename in T11 (format only) |
| `module: "m1"`; `referenceIds: "m1-ref-01"` vs file `m1-ref-01-tokens-context-windows.md` | the manifest's module id; `reference/<id>.md` | T11: the manifest's module id is `m1`; rename the reference files to `<id>.md` |
| `diagnostic.json` holds 10 items, not exercises | `schedule.diagnostic` holds exercise ids | **C12**: no new type in F1c |
| no `practice.json` or `schedule.json` | required | **C12**: hidden authoring work |
| `followUp` is a string in all 16 | allowed | Product note: with strings, `failureModesTradeoffs` is `n/a` for every concept, and so is `defendDecision` unless challenges are graded. The PM decides whether that is acceptable for the interview. |

**F2. Invariant 8: two flows aren't hands-free.** Nothing in the voice command table moves from a reveal or `done` to the next exercise, and nothing starts "Review weak spots" or the diagnostic from the progress page. A single tap to start a session is acceptable, because browsers need a user gesture before audio and the mic. After that tap, every flow must chain by voice. → **C11**.

**F3. Tests point at a route that doesn't exist and is on F1a's legacy list.** SC-010, the T04 test "a server without practice packs still serves /api/subjects unchanged", and the edge cases all name `/api/subjects`. That route arrives only with F1a-T12. F1a's rule also bans new tests on `/api/trades`. → **C3**.

**F4. `check:ticket` can't read F1c's nested `Files:` bullets** (`check-ticket.mjs:52`). Every F1c ticket would exit 1 with "has no Files: line", so the per-ticket evidence in the definition of done would be impossible. → **C6**.

**F5. Leak-scan false positives.** FR-004's key list includes `kind` and `transfer`. Schedule blocks have `kind`, and progress readiness has `transfer`. As written, SC-001 fails on correct responses, or QA has to waive it by hand. → **C5**.

**F6. "Sync or Promise" grader contradicts "no in-flight state"** (FR-023 vs FR-007 and the T04 notes). An async grader would bring back the concurrent-STOP race that ADR 0003 Am. 3 fixed. → **C4**.

**F7. Hidden work: per-segment speech.** FR-032 ("a segment equal to the phrase") and FR-034 ("a final segment equal to send") need per-result `isFinal` text, and `listen()` doesn't expose it. T06 would otherwise have to build a second `SpeechRecognition` provider. → **C8**.

**F8. Collisions with F1a Wave 2 aren't sequenced.** F1a is on hold, but every one of these files is on a Wave 2 ticket:

| File | F1c | F1a Wave 2 | Order |
|---|---|---|---|
| `server/index.js` | T04, T08 | T12, T18 | F1c-T04 → F1c-T08 → F1a-T12 → F1a-T18 |
| `shared/events.js`, `tests/events.test.js` | T04 | T13a | F1c-T04 → F1a-T13a |
| `server/packs.js` | T02 | T18 (comment) | F1c-T02 → F1a-T18 (already listed) |
| `web/speech.js` | T06 (C8) | T15 deletes it; T24 | F1c-T06 → F1a-T15 → F1a-T24 |
| `npm test` `# todo` count | T01a, T01b add todos | T19b requires `# todo 0` | see C7 |

→ **C7**.

**F9. Minor shape mismatches.** FR-051 says `projectPractice(events, pack)`, but T08 says `(events, track, exercises)`. Source links have no rendering rule. → **C13**, **C14**.

**Invariant check per ticket:**
- **Inv. 1:** clean, with the deny-list additions. **Optional C15:** add `applied-ai` so the track id can't be hard-coded in engine code.
- **Inv. 2:** clean, with C5.
- **Inv. 3–4:** untouched, and the guard test in ADR 0008 makes that structural.
- **Inv. 5:** clean. No prompt; text is rendered with `textContent`; C13 covers links.
- **Inv. 6:** clean. Every write goes through append-only `appendEvents`, and repeat ratings append.
- **Inv. 7:** clean. There's no AI path. The matcher never throws; bad input gets 400 or 413; a bad pack is skipped with a warning; the client times out after 12 s with Try again.
- **Inv. 8:** F2 (C11).
- **Inv. 9:** clean through FR-035 and SC-007.

**F1c-internal [P] collisions:** none found, and C8 adds `web/speech.js` to T06 only.

### Required changes for the PM (exact)
**Before Wave A**
- **C1 (FR-017, T03, T01a).** A rubric item is one or more alternatives separated by `|`:
  - The item is matched if any alternative matches under the existing token rule.
  - `matched` and `missing` report the whole item string.
  - The validator rejects an empty alternative, and more than 8 per item.
  - Add the T03 test "an item matches through any | alternative".
  - T01a's labelled set includes `|` items.
- **C2 (schema, T02).** Four changes:
  - `sources[]` = `{title, url, verified: boolean, note?: string ≤ 200}`.
  - interview `followUps[]` items may be a string. A string follow-up is self-rated only (`result: null`), like `followUp`.
  - `acceptableArchitectures[]` = `{id, summary, mustInclude?: string[], strengths?: string[], tradeoffs?: string[]}`. FR-043: if no architecture has `mustInclude`, the design status equals the `mustCover` status.
  - Add `strengths`, `tradeoffs` and `note` to the FR-004 key list (revealed at complete).
- **C3 (SC-010, T04, edge cases, T01a).** Replace every "/api/subjects unchanged" with an in-process check: "`listSubjects()` from `server/packs.js` deep-equals the same call with no practice pack, and no `[packs]` warning is logged". No F1c test calls `/api/subjects`, `/api/trades` or `/api/scenario`.
- **C4 (FR-023, T04).** Change "sync or Promise" to "synchronous in F1c (ADR 0008)". `createPracticeService` throws `TypeError` if `grader` isn't a function.
- **C5 (FR-004, SC-001, T01a).** `practiceLeakScan`'s `allow` takes JSON-path patterns with `[]` wildcards. The suite allows exactly the FR-004 exceptions plus `plan[].blocks[].kind` (schedule) and `concepts[].readiness.transfer` (progress). SC-001 scans every response before that attempt's `complete`, and also `GET /api/practice/tracks`, `/tracks/:track`, `/schedule`, `/progress` and `/review`.
- **C6 (tasks.md, all tickets).** Put each ticket's file list on its single `- **Files:**` line, with backticked paths (`check-ticket.mjs:52`). Sub-bullets may stay as notes after it.
- **C7 (both tasks.md files; PM owns both).**
  - Add the F8 order table to F1c "Shared-file sequences", and mirror it in F1a's sequences.
  - F1a-T15's Files gain `web/practice/speech.js` and the `onSegment` forwarding.
  - F1a-T12 gains the test "a pra_ id on /api/attempts returns 404".
  - F1a-T19b's `# todo 0` becomes "0 todos with an `F1a-` reason". Recommended over forcing F1c to finish first.
  - F1c-T04 gains the tests "an att_ id on /api/practice/attempts returns 404", "every practice event carries context.engine 'practice'", and "practice modules and server/ai, server/prompts never import each other".
- **C8 (T05, T06; ARCH-6).**
  - T05 creates `web/practice/speech.js`, which re-exports `speak`, `stopSpeaking`, `wait`, `canListen` and `listen`. It is the only practice import of `/speech.js`. Add the test "only web/practice/speech.js imports /speech.js".
  - T06 Files add `web/speech.js`, with exactly one additive change: an optional `onSegment({text, isFinal})` callback in `listen()`, called per result. No other line changes, and the golden replay shows 0 diffs after T06.

**Before Wave B or C tickets**
- **C9 (T08; ARCH-8).** `eventsForEngine` as in ADR 0002 Am. 3: no index and no migration. `projectPractice` filters `context.subject` by `^<track>@`. Events for exercise ids absent from the current pack version are left out of mastery and readiness, and counted in `counts`.
- **C10 (spec "Events and metrics").** Cite ADR 0002 Am. 3 and remove the `[ARCH-4]` marker. `self-rated.object.part` is required.
- **C11 (copy and voice tables; T06, T09, T10; inv. 8).**
  - Add "next" in the reveal and `done` states: the next exercise in today's plan, or the picker when the plan is finished.
  - Add "review" and "diagnostic" on the progress page.
  - Add the spoken copy for each, plus a test per command in `commands.js`.
  - State in the spec: "one tap starts a session (browser user-activation); everything after it chains by voice".
- **C12 (T11).**
  - Format mappings only:
    - `verified`: `fetched-*` → `true`; anything else → `false`; the original string goes in `note`.
    - `challenges`: `challenge` → `question` and `expected` → `rubric`.
    - architecture `id` = the slug of `name`.
    - module id `m1`.
    - reference files renamed to `<referenceId>.md`.
  - **Hidden work to assign:**
    - `practice.json` and `schedule.json` don't exist in the content. The PM, with the learning-designer, records the 7-day plan and the ≤ 6 diagnostic exercise ids in thread 0007 before T11.
    - `diagnostic.json`'s 10 items stay in research (Later). F1c adds no new exercise type.
  - T11's Depends gain the founder's ARCH-2 confirmation.
- **C13 (T05).** Render sources as `<a>` with `href` set by property, after the validator's `https://` check, with `rel="noopener noreferrer"`.
- **C14 (FR-051).** Align to `projectPractice(events, track, exercises)`.
- **C15 (optional, T01a).** Add `applied-ai` to `deny-list.json`.

### Risks (devil's advocate; also in thread 0007)
1. **Two engines become permanent:** two pack formats, two matchers, two event shapes. H/M. ADR 0008 sets a convergence trigger before F2's Session Engine is specced.
2. **Offline grades mislead the founder days before the interview.** M/H. Uncertain results are shown and never scored, the rubric and reference are always revealed, and self-rating plus SC-004 κ is reported. Treat matcher grades as advisory.
3. **The build eats preparation time or misses the window.** H/H. Ship Wave A only before the interview. The module-1 files are readable as study notes today.
4. **Hotword echo:** the TTS voice triggers "stop" through the mic. M/M. FR-032, the headphone hint, and the Stop button and Space always work.

## Wave A code review (2026-10-14)

**Reviewer:** principal-architect · **Reviewed:** `7b29784..be1047e` on `team/agents`. That covers T03 `3430878`, T02 `7d758a2`, T01a `c7f7cfd` `6bbc8ba` `60ecb97`, T04 `0020cd6` `092b245`, and T05 `01b369f` `be1047e`. Checked against the CLAUDE.md invariants, ADR 0008, ADR 0002 Am. 3, ADR 0006 Am. 3, ADR 0004 Am. 1 and spec revision 2.

### Verdict: CHANGES REQUESTED

The engine is well built. Answers stay on the server, events are append-only and stamped, the module boundaries hold, and the golden surface is untouched. Two blocking findings remain, and both are small. Once W-B1 and W-B2 are fixed and the listed tests pass, Wave A can merge without another review: I re-check the diff and the test output only.

**Evidence (all run fresh in this review):**
- `npm test`: `# tests 443 / # pass 331 / # fail 0 / # todo 112`. Four F1c todos fail on real assertions:
  - SC-003 (`F1c-T03`);
  - US1.5 and US1.11 (`F1c-T04`, the same cause as B20);
  - FR-050 (`F1c-T04`, B21).
  - SC-003b fails only because `packs/applied-ai` doesn't exist yet (T11).
- Golden replay, `node tests/golden/run.mjs --replay`: **61 runs, 0 diffs**, digest `cc1c3558d43c7e02`. SC-002 holds after Wave A.
- `git diff 7b29784..HEAD` is **empty** on the spec's "Untouched" list, and on `server/db.js`, `server/ai/`, `server/prompts/` and `packs/`.
- `check:ticket`, run per ticket over its own commit range, reports `ok, all listed` for T01a (×3), T02, T03, T04 (×2) and T05 (×2).
- **Standing greps:**
  - Deny-list words (old and F1c additions, plus `kite`/`applied-ai`): 0 hits in `server/ shared/ web/ scripts/`. The one exception is the pre-existing allow-listed `breaker` in `shared/mock-grader.js:16`.
  - `messages.create`: only in `server/ai/gateway.js:56`.
  - No `UPDATE` or `DELETE` on `event`; the trigger is still in place.
  - Practice ↔ `server/ai`, `server/prompts`: no imports, **transitively included**. `practice*.js` reaches only `http.js`, `db.js`, `packs.js`, `shared/{events,pack,contract}.js`.
  - Web: no `innerHTML` in `web/practice`; `a.href` is set by property (`app.js:352`).

**Invariants:**
- 1: clean.
- 2: clean. The start body is the allow-list `toPublicExercise` (`practice-pack.js:347-360`). A stop returns `reveal`/`result` only for a graded hit on its attributed statement (`practice.js:68-76`). Rubric, references and sources first appear at `complete` or an explicit `assist`.
- 3–4: untouched.
- 5: clean, with no prompt and text-only rendering.
- 6: clean. Writes go only through `appendEvents`, and every event carries `engine: 'practice'`, built from the `started` context (`practice.js:124-129`).
- 7: one gap (W-S4).
- 8: Wave B.
- 9: clean. `say()` writes and speaks the same string.

**Status codes:**
- 400 on bad JSON, bad mode or body, an unknown, backwards or non-catch stop, a diagnostic assist, and self-rating before complete.
- 404 on an unknown track or exercise, a malformed or `att_` id (checked before the body), and an unknown attempt.
- 409 on a stop after complete.
- 413 from `readBody`.
- Every route error is an `HttpError` caught in `server/index.js`. I found no input that produces a 500.

### Blocking

**W-B1. FR-019's stuffing cap fails SC-003 (F1c-B20).**
- **Where:** `server/services/practice-matcher.js:227`, `stuffed = total - removed.size <= R.stuffedMaxRest`, applied at `:243`.
- **What's wrong:** concise correct sentences are capped at `partial`. On the accept-pack set this gives clear → met 80% and valid-alternative → met 50%, and US1.5 and US1.11 fail at HTTP level.
- **Concrete input:** "Let the line go slack and turn away from people so it lands safely." (interview-launch `followUps:0`). Both items match, but `defense` comes out `partial`.
- **Fix:** the rule in "B20 proposal" below, `matcher@2`. This is blocking because it's an acceptance criterion of T03 and T04, and the founder's first sessions would hear "partly covered" when they're right.

**W-B2. "Skip this stop" counts the statement as missed, against ADR 0004 Am. 1.**
- **Where:** `web/practice/app.js:269-276` (skip) tells the server nothing. `server/services/practice.js:250-253` (`complete`) then lists every uncaught planted statement up to `lastIdx` as `missedStatementIds`.
- **What's wrong:** the copy `err.net` promises "skip and this stop won't be scored". Instead the reveal says "Missed: …", and the stored `completed` event records a miss. Mastery (T08) will then read that miss as detection 0.
- **Why it matters:** ADR 0004 Am. 1 (the PM's Option B) rejected exactly this. ADR 0002 Am. 2 explains why it can't wait: stored id lists are the record, and events can't be corrected afterwards. The founder's first Wave A sessions would write permanent false misses. My design review missed this gap in the spec.
- **Smallest fix (ADR 0002 Am. 4):**
  - T05: on Skip, push `{statementId, elapsedMs}` onto `S.skipped`, and send `skipped` in the `complete` body.
  - T04: validate `skipped`, run the existing `attribute()` over it, and write `skippedStatementIds` and `notGradedStatementIds` in `completed`. `missed[]` items get `notGraded: true`, and `state.js` `missedLine` shows them without the word "Missed".
  - Add the two tests named in Am. 4.
  - The PM adds the request field, the result fields and a copy id for the not-graded line to the spec.

### Should fix (before the named ticket)

**W-S1 (before T06; PM + backend). The repeat-stop key conflates a retry with a second, real stop.**
- **Where:** `practice.js:177-178` keys idempotency on `statementId` alone. FR-037 replays the interrupted statement after a late hit or a false interruption, so stopping on it again is a designed path, not only a retry.
- **Concrete input:** catch-lines with `s3` planted and `s4` clean.
  1. Stop on `s4` at 800 ms. This is a `late_hit` on `s3`, and `s4` replays.
  2. Stop on `s4` again. The response is the stored late-hit body: "That was the previous statement. Good catch …" with `s3`'s correction. No `false_alarm` is recorded.
- **Fix:** the client sends a `stopId` (a random id per STOP press) and the server dedupes on it. A new `stopId` on a statement that already has a graded stop is a new stop: a false interruption, because the statement is clean or already caught. This is an additive field, and the PM updates FR-008 and the edge case.

**W-S2 (T05). A STOP in the gap after the last statement is dropped.**
- **Where:** `app.js:173` accepts STOP only while `phase === 'narrating'`. `endNarration` (`:313-322`) moves to `ending` and speaks `end.catch` (about 2 s in voice mode).
- **Why it matters:** the spec edge case says a stop in this gap is attributed to the last statement. Today a planted last statement can't be caught late.
- **Fix:** accept STOP in `ending` and post it with the last statement's id and `elapsedMs` measured from that statement's start.

**W-S3 (T04). `assist` after `complete` appends an `assisted` event** (`practice.js:205-210`). This is harmless today, but it puts a meaningless event in the log. **Fix:** return the same body with no event once `a.completed` is set.

**W-S4 (T05; inv. 7). A self-rating failure is silent** (`app.js:408-414`, `console.warn` only). The learner believes the rating was saved, and SC-004 loses the data point. **Fix:** show `err.net` inline under that row, with Try again.

**W-S5 (T04 test). The import guard is direct-only** (`tests/practice-catch.test.js:356-366`). I verified by hand that the transitive closure is clean today. **Fix:** walk relative imports transitively from each `practice*` module, so a future helper import can't open a path to `server/ai` silently. The walk is about 10 lines.

**W-S6 (QA). After W-B1, the hard-coded `'matcher@1'` assertions** in `tests/acceptance/F1c.test.js` (FR-050) must assert `MATCHER_VERSION` instead.

### Optional
- **O1.** `F1c-B10`–`B13` were appended to `tasks.md` by backend-engineer (`35e9e94`). The owner table says QA appends bugs. Next time, file them through QA or in thread 0007.
- **O2.** No record yet of T05's manual browser check at 390 and 1280 px. QA collects it at verify.

### Matcher rules backend asked me to confirm (B10–B13 note)
**Confirmed as built (matcher@1).** The PM should copy them into FR-017, FR-021 and FR-022 so the spec matches the code:
- the negation window counts every word and stops at `. ; : ! ?`;
- the PD-2 exception covers red flags and strong signals;
- a red flag or an echo makes every dimension of that answer `uncertain`;
- lexicon lookups go one way (key → forms);
- 4-letter plurals are stripped.

### Ruling on F1c-B21: a false interruption **does** write `graded` (outcome `false_alarm`)
**Ruling:** the code stays, and the test changes. ADR 0002 Am. 4 records it.

**Why:**
- **ADR 0002 Am. 3 already says so.** Its write rule is "a stop's `stopped`, `explained`, `graded`", and its `outcome` list includes `false_alarm`. With no `graded` on a false interruption, that outcome could never be written.
- **The card engine has always done this** (ADR 0002 base, `graded.outcome` ∈ … `false_alarm`). One shape per stop in both engines keeps the F2 cross-engine projection free of engine branches.
- **The risk is metric pollution.** A `graded` with `graderSource: 'matcher'` that the matcher never produced would inflate SC-004's denominators. Am. 4 adds the reader rule: grader metrics and mastery count only `overall !== null`.

**Who changes what:**
- **QA:** `tests/acceptance/F1c.test.js:482` gets the expected verb list `['started','stopped','explained','graded','stopped','explained','graded','completed','self-rated']`. Also assert that the second `graded.result` has `overall: null`, `outcome: 'false_alarm'` and `dimensions: {}`.
- **PM:** in the spec's "Events and metrics" table, change the `graded` "When" cell to "with every stop (a false interruption gets `overall: null`, `outcome: false_alarm`) and every answer". Close B21.
- **Backend:** add the T04 test "a false interruption writes graded with outcome false_alarm and overall null" (Am. 4 verification). No code change.

### F1c-B20 proposal: cap only keyword lists, measured by function-word share
**Rule (`matcher@2`; FR-019 rewritten):**
> The status is capped at `partial` when **both** of these hold:
> - (a) ≤ `stuffedMaxRest` (2) content words remain after removing matched forms (unchanged);
> - (b) fewer than `stuffedMaxFunctionShare` (0.2) of the answer's words are function words.
>
> "Function words" are the matcher's existing generic-English `STOPWORDS`, so the rule adds no new vocabulary and no subject words. The answer's words are every word before stopword removal, the same tokens the negation window counts.

**Why this feature:** a keyword list ("heavier line, more drag, kite lower …") has no grammar, and a concise sentence always does. FR-019's own failure mode is "rubric words with no explanation", and this targets exactly that. It keeps (a), so a long answer that happens to contain the rubric is never capped.

**Measured.** I ran the real matcher in a scratch copy with only line 227 swapped, over both labelled sets. The module-1 set has no `packs/applied-ai` yet (T11), so I graded it against the research drafts with `draftSynonyms` as the lexicon.

| SC-003, accept-pack (45 rows) | met | partial | not_met | uncertain | gate | matcher@1 | proposed |
|---|---|---|---|---|---|---|---|
| clear (10) | 10 | 0 | 0 | 0 | → met 100% | 80% ✗ | **100% ✓** |
| incorrect (9) | 0 | 0 | 9 | 0 | never met | 0% ✓ | 0% ✓ |
| partial (10, incl. 2 keyword lists) | 0 | 10 | 0 | 0 | partial/uncertain ≥ 80% | 100% ✓ | **100% ✓** (both lists stay `partial`) |
| valid-alternative (8) | 8 | 0 | 0 | 0 | never not_met; met ≥ 75% | 0%, 50% ✗ | **0%, 100% ✓** |
| should-flag (8) | 0 | 0 | 0 | 8 | uncertain ≥ 80% | 100% ✓ | 100% ✓ |
| uncertain on clear + incorrect | | | | | ≤ 20% | 0% | 0% |

| SC-003b proxy, module-1 drafts (24 rows) | met | partial | not_met | uncertain | gate | matcher@1 | proposed |
|---|---|---|---|---|---|---|---|
| clear (6) | 6 | 0 | 0 | 0 | 100% | 100% | 100% |
| incorrect (6) | 0 | 1 | 5 | 0 | never met | 0% | 0% |
| partial (6) | 0 | 4 | 2 | 0 | ≥ 80% | 66.7% ✗ | 66.7% ✗ |
| valid-alternative (6) | 0 | 2 | 0 | 4 | met ≥ 75% | 16.7% ✗ | 16.7% ✗ |

- **Margin.** Among answers where (a) fires, the lowest function-word share on a correct sentence is 0.27 ("Heavier line drags the kite lower. …"), and both keyword lists are 0.00. A sweep of the threshold from 0.05 to 0.30 passes SC-003 at every step. I picked 0.2, below the 0.27 floor, so that a list padded with one or two articles is still capped.
- **SC-003b is unchanged by any stuffing rule.** No module-1 answer triggers (a). Its misses are B11 (FR-021(a) per dimension: 4 valid alternatives are `uncertain`) and B12/B13 (lexicon gaps). I also tried FR-021(a) at answer level (uncertain only when *no* dimension matched). It moves 3 of the 4 `uncertain` valid alternatives to `partial`, so the expected-match share rises to 33.3%, but `met` stays at 0. B12 (the T11 lexicon) is the remaining lever.
- **SC-003b has no keyword-list rows, so it can't check this rule.** QA or the learning-designer should add two module-1 keyword lists (expected `partial`) to `m1-labelled-answers.json`.

**Rejected:**
- **Delete the cap.** The 2 keyword lists become `met`, and partial → partial/uncertain drops to 80%, right on the gate.
- **Cap only without causal connectives (because/so/since …).** "Put spectators behind a barrier, keep kites over the field, and brief the team on safety." is correct and has none, so it stays capped.
- **Cap only when matched tokens exceed some share of the answer (e.g. ≥ 0.9).** Correct concise sentences score 0.78–0.90 and the lists 1.00, but "Build at tables indoors with a kit for each child." is also 1.00. Coverage is what a good concise answer *should* have, so this can't separate them.

**Implementation (backend, after the PM accepts the threshold):**
- In `MATCHER_RULES`, add `stuffedMaxFunctionShare: 0.2`, and set `MATCHER_VERSION = 'matcher@2'`.
- In `makeAnswer`, also return `functionShare = raw.filter(stopword).length / raw.length`.
- At `:227`: `stuffed = rest <= stuffedMaxRest && functionShare < stuffedMaxFunctionShare`.
- **T03 tests:**
  - "a concise correct sentence with ≤ 2 leftover words is not capped";
  - "a comma-separated keyword list of rubric words is capped at partial";
  - "a list padded with one article is still capped".
- QA removes the `F1c-T03` todo on SC-003 once it passes.

The PM owns the number: 0.2 is a provisional product threshold, named in `MATCHER_RULES` like every other ratio.

## Wave A.1 re-check (2026-10-14)

**Reviewer:** principal-architect · **Reviewed:** the diff `303dbe8..c82f8de` and the test output only, as offered in the Wave A review. That covers T12 `a9d7cb5`, T13 `b7024e7` `4737dba`, T14 `ae7fc73`, T15 `be0fc29`, T16 `ad5950f`, and the B23 filing `c82f8de`. Checked against the CLAUDE.md invariants, ADR 0002 Am. 4, ADR 0004 Am. 1 and spec revision 3.

### Verdict: APPROVED

W-B1 and W-B2 are resolved. The Wave A.1 should-fix items (W-S1, W-S3, W-S4, W-S5, W-S6) are correct. F1c Wave A + A.1 may merge, and Wave B may start. F1c-B23 is an invariant-7 defect, but it doesn't block this merge. It is gated before F1c-T11 and T01b (see below).

**Evidence (run fresh in this re-check):**
- `npm test`: exit 0, `# tests 469 / # pass 383 / # fail 0 / # todo 86`. No `F1c-T03`, `T04`, `T12` or `T13` todo remains. The remaining todos are `F1a-T12` 13, `F1a-T13b` 27, `F1a-T14` 22, `F1a-T18` 1, `F1c-T07` 12, `F1c-T08` 10 and `F1c-T11` 1.
- Golden replay, `node tests/golden/run.mjs --replay`: `61 runs, 0 diffs, 0 allow-listed diffs, digest cc1c3558d43c7e02`. This is the same digest as at Wave A, so SC-002 holds.
- `git diff 303dbe8..c82f8de` is empty on `server/db.js`, `server/ai/`, `server/prompts/`, `shared/`, `packs/`, `web/index.html`, `web/app.js` and `web/speech.js`. The spec's Untouched list holds.
- `check:ticket`, per commit: T12, T13 (×2), T14 and T15 report `ok, all listed`. T16 also touched `docs/team/threads/0007…`. That file is append-only for everyone, and the diff only adds lines, so this is acceptable.
- **Standing greps:**
  - Deny-list words: 0 hits in lines this range adds under `server/ shared/ web/ scripts/`. The legacy card-game hits are pre-existing and unchanged.
  - `messages.create`: only in `server/ai/gateway.js`.
  - No `UPDATE` or `DELETE` on `event`.
  - No `innerHTML` in `web/practice`.
  - No `practice*` → `server/ai`/`server/prompts` import. This is now a transitive test, and it is shown able to fail (W-S5).

### Blocking findings: resolved
- **W-B1 (B20), resolved.**
  - **Code:** `practice-matcher.js:231` caps only when `rest ≤ 2` **and** `functionShare < 0.2`, and `MATCHER_VERSION` is `matcher@2` (`:8`). The new constant is named in `MATCHER_RULES` (`:19`), and `functionShare` counts every word before stopword removal (`:90`), as proposed.
  - **Tests:** `tests/practice-matcher.test.js` has the three named T03 tests, plus a strict-boundary test (share 0.2 is not capped; 1/6 is).
  - **Gates:** SC-003 passes on 48 rows, and SC-012 passes on the enlarged sets (7/7). No subject words were added.
- **W-B2, resolved, and it matches ADR 0002 Am. 4 clause by clause.**
  - **Request:** `skippedOf` (`practice.js:27-36`) maps absent or `null` to `[]`. It returns 400 for a non-array, more than 20 entries, or an unknown `statementId`.
  - **Attribution:** `attribute()` runs per entry against graded stops only (`:282-284`), the same rule as a live stop. A recorded stop always wins over a skip, so a stop that reached the server but lost its response is still caught.
  - **Stored record:** caught, missed, not-graded and not-reached are disjoint and cover every planted statement (`:285-289`). `skippedStatementIds` and `notGradedStatementIds` are always written (`:297-298`). A repeat `complete` reads them back and never recomputes them (`:271`, `:239`, missing → `[]`).
  - **Response:** `notGraded: true` appears only when true (`:249`). `missedLine` (`state.js:69-73`) never says "Missed" for it.
  - **Client:** `onSkip` records `{statementId, elapsedMs}` (`app.js:277`), and `completeRequest` sends it.
  - The two Am. 4 verification tests are present (`tests/practice-catch.test.js:386`, `:399`).

### Should-fix items: verified
- **W-S1 (stopId): correct.**
  - A known `stopId` replays its stored body with no events (`practice.js:197-201`). The same `stopId` on another statement is a 400. A new `stopId` is a new stop, attributed by the unchanged FR-012 rule, so the review's example now gives a `false_interruption` with its own triple (`tests/practice-catch.test.js:512`).
  - Without a `stopId`, the old rule holds. `findLast` equals the old `find`, because a client that sends no ids can never create a second stop on one statement.
  - **Projection:** the `explained`/`graded` events attach to the latest stop on the statement (`:50`). That is right, because a stop's triple is one `appendEvents` batch.
- **W-S3, correct.** No `assisted` event after `complete` (`:233`), with a test at `:547`.
- **W-S4, correct.** `err.rate` is shown and spoken under the row with Try again (`app.js:414-446`), and the pressed state changes only after the server confirms. FR-035 holds, because `say()` is used.
- **W-S5, correct.** The walk is transitive, and it includes a two-hop fixture that proves the guard can fail (`tests/practice-catch.test.js:560-600`).
- **W-S6, correct.** FR-050 asserts `MATCHER_VERSION` (`tests/acceptance/F1c.test.js:581`). No hard-coded `matcher@1` remains in an assertion.
- **W-S2** is deferred to T06 (PD decision). I agree, for the reason the PM gave.

### Rulings on pending questions
- **`stopped.result.stopId`: a note, not a new amendment.** It is an additive optional field under ADR 0002's change rule. It does change one thing readers rely on, though: a statement can now have more than one `stopped` event. So it is recorded as a dated note under ADR 0002 Am. 4, with the D18 row updated. The note says:
  - `stopId` is opaque and present only when sent;
  - readers must not assume one stop per statement;
  - readers attach `explained` and `graded` by `seq` within the stop's batch, never by `stopId`.
- **OQ-7: yes, for T06.** Invariant 8 requires it. T06 adds two rows to the command table. "try again" is active only while `net-error` is shown. "skip" is active only while `skip-btn` is visible. Both follow the FR-032 bare-phrase rule (a final segment equal to the phrase).
  - **Echo guard (the `err.net` copy itself says "Try again"):** the two commands arm only after the `err.net` utterance resolves.
  - **Tests:** one test per command in `commands.js`, plus "a segment containing 'try again' inside a longer sentence does nothing".
  - The copy is unchanged, because `err.net` already names both words. The card game's `err.net` is F1a's (`web/app.js` is Untouched) and goes to F1a-T15's voice work.
  - The way out that B23's fix adds must also have a voice command.
- **F1c-B23: an invariant-7 defect, not blocking for Wave A.1, and gated before F1c-T11 merges and before T01b.**
  - **Why it's real:** `complete()` (`app.js:331-339`) maps every error, including an `ApiError` 4xx that a retry can never fix, to `err.net` with endless Try again. That is a stall with an untrue message. 21 skips is one trigger. A more reachable one is a 404 "attempt exercise is not loaded" after a server restart with a bumped pack version mid-attempt, which is likely during T11 content iteration. `submitStop` (`:214-219`) has the same mapping, but its Skip is a way out.
  - **Why it doesn't block this merge:** the 21-skip trigger needs 21 failed stop requests in one exercise followed by a `complete` that reaches the server. Nothing is corrupted: an attempt without `completed` is the abandoned-attempt shape readers already handle, and a reload recovers. Wave A.1 removes a worse defect (permanent false misses, W-B2). Holding it would keep that defect live to avoid a far rarer one.
  - **Owned by me in part:** Am. 4's cap of 20 equals `LIMITS.narration` (`practice-pack.js:18`), but I didn't say how the client stays under it.
  - **Smallest fix (frontend; the PM picks the copy):**
    - (1) `onSkip` keeps **one entry per `statementId`, the one with the smallest `elapsedMs`**. This preserves the server's result exactly. A `hit` on the statement doesn't depend on `elapsedMs`, and a `late_hit` needs `elapsedMs ≤ GRACE_MS`, so the minimum entry yields every attribution any other entry on that statement could. The list is then at most `LIMITS.narration` = 20 entries, so the cap can't be reached. Add a pure `state.js` helper with a unit test, plus a test that `MAX_SKIPPED ≥ LIMITS.narration`.
    - (2) In `complete()`, an `ApiError` with a 4xx status shows a distinct message (not `err.net`) and a way back to the picker, by button and by voice. `NetworkError` and 5xx keep `err.net` with Try again. `submitStop` gets the same distinction for 4xx.
  - The server rule stays as it is.

### Optional
- **O3.** T12, T13 and T14 landed as commits titled "WIP … checkpoint". The content is complete and tested. Next time, squash or retitle before the merge, so `git log` reads as finished tickets.

## F1c-T17 code review (2026-10-14, the F1c-B23 fix)

**Reviewer:** principal-architect · **Diff:** `798b1d8..23aa509` (one commit) · **Files:** `web/practice/{app,state,copy}.js`, `web/practice.html`, `tests/practice-web-state.test.js`. That is exactly the ticket's Files line. No server, `api.js`, `web/index.html` or `web/app.js` change.

### Verdict: APPROVED

No blocking findings. F1c-T17 meets FR-059, FR-060 and FR-035 and holds invariants 7, 8 (with the accepted T06 gap) and 9, and ADR 0002 Am. 4. The F1c-T11 merge gate and the F1c-T01b run gate on T17 are cleared once a human merges it. B23 closes when QA records SC-013 in `qa-report.md`.

### Evidence (re-run by me, this turn)
- `npm test`: `# tests 475 / # pass 389 / # fail 0 / # todo 86` (exit 0). This matches the engineer's report.
- `node tests/golden/run.mjs --replay`: `replay 1/1: 61 runs, 0 diffs, 0 allow-listed diffs, digest cc1c3558d43c7e02` (exit 0).
- The engineer's real-browser check (scratchpad `f1c-t17-check.mjs`: real server in MOCK, a copy of the fixture packs, Chromium; text and voice at 390 and 1280 px), re-run: `checks 196 pass 196 fail 0`. It covers:
  - 21 skips on `s1`: 1 `complete` request, 200, `skipped` holds 1 entry with the smallest `elapsedMs`, reveal shown;
  - a **real** pack-version 404 at a stop and at `complete`: `err.rejected` shown (and spoken equal to the shown text in voice), `#net-error` hidden, no Try again or Skip, 0 further requests to the attempt over 2.5 s, `#picker-btn` focused; one click opens the picker with the track re-fetched (200), and a new attempt starts (200);
  - a forced `NetworkError` and 500 at `complete`, and a 500 at a stop, still show `err.net` with Try again (and Skip at the stop);
  - 0 unexpected console errors.
  One check (`Try again reaches reveal`) is a literal `true`. It follows a `waitForSelector('#reveal:not([hidden])')` that throws on timeout, so it isn't vacuous.
- **Standing checks:**
  - The subject-word grep finds only `shared/mock-grader.js:16` ("breaker"). That predates this diff and is owned by F1a-T13b.
  - `messages.create` appears only in `server/ai/gateway.js:56`.
  - No prompt or `VERSION` changed. No answer fields in the diff. No `innerHTML`. No `UPDATE` or `DELETE` on `event`.
  - Ownership is clean.

### Checked against the brief
- **Inv. 7 (degrade, never stall).** The B23 stall is gone on both paths.
  - `errorKind` (`state.js:110-111`) classifies by the typed class and status only, never `err.message`. A test pins that the duck-typed `{status: 404}` is `'net'`.
  - `submitStop` (`app.js:220`) and `complete` (`app.js:358`) branch on it. `S.pending` is cleared before the branch.
  - `rejected()` (`app.js:238-246`) bumps `gen`, so no narration or speech chain can resume. It sets `phase = 'rejected'`, so Stop, Space, Enter-submit and Skip are all inert.
  - The server's real 4xx surface for these routes is 400, 404 and 409 ("attempt is complete"). A retry can fix none of them, so mapping all of them to `rejected` is correct.
  - `NetworkError` covers the 12 s deadline. A repeated `complete` after a timeout is idempotent (`practice.js:271`), so `err.net` with Try again remains correct there.
  - If the re-fetch in `backToPicker` (`app.js:249-253`) fails, the picker shows "Couldn't reach the server." and stays usable.
- **Inv. 8 (voice-first, text always).** Text: the button works, and focus lands on it. Voice:
  - `err.rejected` is spoken.
  - The hands-free way out ("back") is F1c-T06's, per PD-9 and FR-061. Until T06 merges, the copy names a command that isn't live. That is the accepted gap, the same as `intro.catch` in Wave A. See RISK R1 in thread 0007.
- **Inv. 9 (spoken equals shown).** `rejected()` returns `say($('rejected-msg'), COPY['err.rejected'])`, one string for both. The browser check asserts the spoken text equals the normalized `#rejected-msg` and is spoken exactly once. `btn.picker` is shown only, as the copy table says. Both strings equal the spec table, which the frozen copy test pins.
- **ADR 0002 Am. 4.** The stored record is provably unchanged by the dedupe.
  - The server attributes each skip against **graded stops only**, never other skips (`practice.js:281-283`).
  - `hit` doesn't depend on `elapsedMs`. `late_hit` needs `0 ≤ elapsedMs ≤ GRACE_MS`, and `elapsedMs` is always a non-negative integer (`app.js:184`). So the smallest entry is in grace exactly when any entry on that statement is.
  - `skippedStatementIds` was already de-duplicated server-side. The `completed` event is therefore identical for the raw and the de-duplicated list.
  - The cap can no longer be reached. `tests/practice-web-state.test.js` pins `MAX_SKIPPED ≥ LIMITS.narration` against the source.
  - I added a dated note under Am. 4 recording the client rule, because the amendment said "the client lists each stop". The decision is unchanged.

### Should fix (not blocking)
- **T17-S1. The commit is titled "WIP F1c-T17: checkpoint …".** This is the third time (Wave A.1 O3). Squash or retitle it with an imperative subject before the merge, for example "Keep one skip per statement and show err.rejected on a 4xx (F1c-B23)", with a body giving the why (inv. 7, the T11 gate). Human merge step; no code change.
- **T17-S2. The FR-060 DOM wiring has no test in `npm test`.**
  - What isn't covered: `rejected()` instead of `err.net`; no further request to the attempt; `backToPicker` re-fetching the track.
  - Where the proof lives today: an untracked scratchpad script. The ticket's named unit tests are all present and pass, which is why this isn't blocking.
  - Smallest fix: QA's T01b rev-4 e2e tests ("US1.16 / US2.13 …", "US1.16 a 4xx at a stop …") land with no `todo`, as tasks.md already requires. QA records the SC-013 runs, with screenshots, in `qa-report.md` under "F1c-B23". B23 isn't closed on the engineer's report alone.

### Optional
- **T17-O1.** `app.js:297-298`: `S.stop && statementLi(...)` guards a value already dereferenced on line 297. The guard is dead. Drop it, or move the null check above both lines. This shape predates T17.
- **T17-O2.** `state.js:111` maps 408 and 429 to `rejected`. The server sends neither today. If a rate limiter or a proxy that returns them is ever added, carve those two into `'net'` (a retry can help), with a test row.

## Ruling on F1c-B11, the T11 slug deviation, and the SC-003b overfitting risk (2026-10-15)

**Reviewer:** principal-architect · **Base:** `4db8290` (F1c-T11) on `team/agents`. No code was changed. Every number below comes from the real `practice-matcher.js` in a scratch copy, with only the FR-021(a) line switched. The harness reuses `graderInputFor` and `evaluateThresholds` from `tests/acceptance/practice-helpers.mjs`. Rows are named by their index in `m1-labelled-answers.json` (`rows[i]`, `qaRows[i]`). This section quotes no answer text.

**Correction to the brief:** SC-003b has **31 rows**, not 27: 24 `rows` plus 7 `qaRows`. The two failing classes have 15 rows between them: valid-alternative (6) and partial (9).

### 1. F1c-B11: keep FR-021(a) per dimension. B11 closes as "works as designed", and its rows move to B12.

**Variants measured.** In every variant, a dimension that matched nothing in a long answer (≥ 20 content words) gets the status shown below.
- **(D) per dimension (today, `matcher@2`):** `uncertain`.
- **(A) answer level:** `uncertain` only when no dimension of the answer matched. Otherwise the dimension is `not_met`.
- **(X) rule off:** `not_met`. Measured only as a control.

| Gate | (D) per dimension | (A) answer level | (X) off |
|---|---|---|---|
| SC-003 (48 rows), all 7 checks | pass, 7/7 | pass, 7/7 (identical table) | **fails** should-flag → uncertain, 75% |
| SC-012 (7 rows) | 7/7 | 7/7 | 7/7 |
| SC-003b clear → met (10) | 100% | 100% | 100% |
| SC-003b incorrect → never met (6) | 0% met | 0% met | 0% met |
| SC-003b valid-alt → never not_met (6) | 0% | 0% | **16.7% ✗** |
| SC-003b valid-alt → expected (6; gate ≥ 75%, so 5 of 6) | **16.7% ✗** (1/6) | **33.3% ✗** (2/6) | 33.3% ✗ |
| SC-003b partial → partial/uncertain (9; gate ≥ 80%, so 8 of 9) | **77.8% ✗** (7/9) | **77.8% ✗** (7/9) | 77.8% ✗ |
| SC-003b uncertain on clear + incorrect | 0% | 0% | 0% |

SC-003b confusion matrices, (D) → (A):

| class | met | partial | not_met | uncertain |
|---|---|---|---|---|
| clear (10) | 10 → 10 | 0 → 0 | 0 → 0 | 0 → 0 |
| incorrect (6) | 0 → 0 | 1 → 1 | 5 → 5 | 0 → 0 |
| partial (9) | 0 → 0 | 7 → 7 | 2 → 2 | 0 → 0 |
| valid-alternative (6) | 0 → 0 | 2 → 5 | 0 → 0 | 4 → 1 |

Valid-alternative rows. Each cell gives explanation / correction → overall.

| row | expected overall | (D) | (A) | what (A) does |
|---|---|---|---|---|
| `rows[2]` | met | partial / **uncertain** → uncertain | partial / **not_met** → partial | asserts `not_met` on a correction the label says is valid |
| `rows[6]` | met | partial / met → partial | same | nothing (content) |
| `rows[10]` | met or partial | partial / **uncertain** → uncertain | partial / not_met → partial ✓ | the only row (A) gains |
| `rows[14]` | met or partial | not_met / partial → partial ✓ | same | — |
| `rows[18]` | met | uncertain / uncertain → uncertain | same | nothing: the whole answer matched nothing, so it is the case rule (a) exists for |
| `rows[22]` | met | **uncertain** / met → uncertain | **not_met** / met → partial | asserts `not_met` on an explanation the label says is valid |

**Why (D) stays:**
1. **(A) invents scores, which the founder ruled out.** In `rows[2]` and `rows[22]`, (A) turns an honest "can't read this dimension" into a confident `not_met` on a dimension the label calls valid. FR-052 and FR-053 would count it: for example, `detectAndCorrect` needs correction `met`. The learner would be scored down for wording the matcher can't parse. Under (D) the same dimension is flagged and left out of mastery.
2. **(A) gains one row, and only on a lenient label.** `rows[10]` passes only because its label also accepts `partial`. Valid-alternative goes from 1/6 to 2/6, and the partial class doesn't move.
3. **No other evidence favours (A).** SC-003 and SC-012 come out identical under (D) and (A). The control (X) shows that rule (a) earns its place: without it, SC-003 should-flag fails and a valid alternative becomes `not_met`.
4. **The fix is the same under either rule.** Once content makes a dimension match, it leaves rule (a) under (D) and (A) alike. The rule only decides what happens when content misses, and an honest flag beats a wrong `not_met`.

**B11 alone cannot reach the gates.** The best rule variant reaches valid-alternative 2/6 (33.3%) against the 5/6 the gate needs, and leaves partial at 7/9 against the 8/9 needed. **Under (D), 100% of the remaining gap is content work (B12, B13, B10). Under (A), at least 3 of the 4 missing valid-alternative rows (75%) and all of the partial gap would still be content work.**

Minimum content work to pass SC-003b under (D):
- **Valid-alternative: 4 more rows of `rows[2]`, `[6]`, `[10]`, `[18]`, `[22]`.** That is at least 5 dimension-level fixes:
  - `rows[6]`: explanation, 1 fix;
  - `rows[10]`: correction matching anything, 1 fix;
  - `rows[22]`: explanation, 1 fix;
  - `rows[2]` or `rows[18]`: both dimensions, 2 fixes.
- **Partial: 1 more row of `rows[13]` and `rows[17]`.** Each needs one dimension to reach `partial`.
- **B10 (`rows[3]`):** an incorrect answer earns correction `partial` because catch-01's correction rubric echoes the misconception. It doesn't fail a gate, because overall isn't `met`, but it is the same content pass and should be fixed in it.

**Who changes what:**
- **PM:** mark F1c-B11 resolved (works as designed) in `tasks.md`. Add the four `rows[]` ids above to B12 as its acceptance list. FR-021(a) and US1.6 stay unchanged. No `MATCHER_VERSION` bump.
- **Content author and learning-designer, B12/B13:** use the lexicon and rubric `|` alternatives only, with no matcher change. Every lexicon form must pass FR-017 word-start matching, like T11's dropped forms.
- **Backend:** none.

### 2. T11 deviation: the 60-character architecture slug is **confirmed**
- **The rule:** `ID_RE = ^[a-z0-9-]{1,60}$` (`practice-pack.js:21`, `:291`). The C12 slug of scenario-01's third architecture name is 77 characters long. Cutting it at the last hyphen within 60 gives a 59-character id.
- **Why the cut is safe:**
  - It is deterministic.
  - It sits in the test's `mapDraft`, and `tests/practice-content.test.js` asserts that the ids are valid and unique.
  - `architectureId` is a pack-internal key. Nothing outside the matcher reads it today (`grep` across `server/`, `web/` and `shared/`), and it is never a mastery key or an event field.
- **Rejected alternatives:**
  - Raising the limit is a format change under ADR 0008 for a cosmetic gain.
  - A hand-picked short id is a content edit that needs the author.
- **Follow-ups:**
  - **PM:** add one clause to C12 in `spec.md` and to T11's mapping in `tasks.md`: "a slug longer than 60 characters is cut at the last `-` within 60. The ids must stay unique (tested)."
  - **T07:** the scenario reveal shows `summary`, never the `id`, as the label. The cut drops the qualifier from the end of the name.

### 3. RISK: SC-003b is now a training set
The B12 lexicon will be written against the same 15 failing-class rows that SC-003b grades, using the per-row miss list the test prints. Passing then shows that the content fits those rows, not that the matcher reads new wordings. Small n makes this worse: one valid-alternative row is 16.7 points of the gate. The 24 `rows` were also written by the author of the draft lexicon.
- Likelihood: H · Impact: M (SC-004 κ in real use would catch it, but only after the founder's 7 days).
- **Mitigation (proposed; the PM owns gates and decides):**
  - **SC-003c held-out set.** QA writes and commits `tests/fixtures/practice/m1-holdout-answers.json` **before** the B12 content commit. The commit order is checkable in `git log`.
    - It has ≥ 6 valid-alternative, ≥ 6 partial, ≥ 4 incorrect and ≥ 4 clear rows, on ≥ 4 catch exercises.
    - Its texts are written from the exercise's narration and reference only. The writer sees neither the lexicon diff nor SC-003b's miss list.
    - The content author does not open the file.
  - **Graded once,** at content freeze, by QA, with the same thresholds. The result and the pack version go in `qa-report.md`. The test in `npm test` checks only the file's shape (no grading), so the result can't be iterated against.
  - **After grading, the set is spent.** It joins SC-003b as training data, and any later content iteration needs a fresh held-out set.
  - **Until then,** SC-003b passing is necessary but not sufficient, and matcher grades stay advisory (Design review risk 2).

## Ruling on the negator-bearing alternative flaw (module-2 REVIEW.md F1): `matcher@3` (2026-10-15)

**Reviewer:** principal-architect · **Base:** `47e1f96` on `team/agents`, `packs/applied-ai` at version 2 (B2 lexicon). No code, pack or test was changed and nothing is committed. Every number comes from the real `practice-matcher.js` and from variant copies of it in a scratch directory, run through `graderInputFor` and `evaluateThresholds` from `tests/acceptance/practice-helpers.mjs`. Rows are named by index. **This section quotes no answer, rubric or narration text.**

### 1. The flaw is confirmed (executed, not hand-traced)
- **Mechanism:** `matchAlternative` (`practice-matcher.js:118-129`) needs `ceil(0.6n)` of n tokens, so a 3+ token alternative matches without its negator. It sets `hasNegator` from the alternative, whether or not the negator was found, and `matchItem` (`:133-141`) then skips the negation check.
- **Synthetic repro (subject-neutral words):** item `heat wont stop loops | dial not stop loops`. An answer asserting the opposite, with no negator at all, grades the dimension **`met`** under `matcher@2`.
- **Live instance in module 1:** the pack's own `misconception` text for **catch-06 s6**, submitted as an answer, earns **correction `met`** under `matcher@2`. It gets `not_met` under `matcher@3`.

### 2. Exposure audit of `packs/applied-ai`
Method: every `|` alternative (and every `acceptableCorrections` string, which FR-020 matches whole) that contains a negator was probed with its own text minus the negators. "Exposed" means the item matches that probe.
- 64 negator-bearing alternatives; **47 exposed** under `matcher@2`; **0** under `matcher@3`. 17 are 2-token forms, which need both tokens and are safe today.
- **Planted stops exposed: 8 of 13 (19 alternatives).**

| Exercise | Stop | Exposed items (index, alternative) |
|---|---|---|
| m1-catch-01-context-window | s2 | `acceptableCorrections[0]`, `[1]` |
| m1-catch-01-context-window | s4 | `acceptableCorrections[0]` |
| m1-catch-02-rag-vs-finetune | s3 | `correct[1]` alt 0, alt 1; `acceptableCorrections[0]`, `[1]` |
| m1-catch-02-rag-vs-finetune | s6 | `explain[1]` alt 0 |
| m1-catch-04-embeddings | s3 | `explain[1]` alt 0; `acceptableCorrections[0]`, `[1]` |
| m1-catch-05-structured-outputs | s5 | `explain[0]` alt 0; `correct[0]` alt 0 |
| m1-catch-06-retrieval-vs-generation | s5 | `explain[2]` alt 0; `acceptableCorrections[1]` |
| m1-catch-06-retrieval-vs-generation | s6 | `explain[0]` alt 0; `explain[1]` alt 0; `acceptableCorrections[0]`, `[1]` |

Not exposed: catch-04 s4 and s6, catch-05 s3, catch-08 s4 and s5.
- **Outside the stops (28 alternatives):** `transfer` in catch-05, catch-07, catch-08, learn-01 (3), learn-02 (2) and interview-03/04; teach-backs in learn-01 and learn-02; interview-03 `mustCover` (2) and `strongSignals`; scenario-01 `challenges[0]` and `[4]` (2 each).
- **Red flags run the other way (9 alternatives):** interview-01 (2), interview-02 (2), interview-03 (1), interview-04 (3) and scenario-01 (1). A *good*, positively worded answer fires the red flag, and FR-021 then makes every dimension `uncertain`. `matcher@3` closes these too.

### 3. Rule variants measured

| Gate | `matcher@2` (today) | R1: the alternative's own negator token must be found | R2c: some negator in a clause where the alternative matched | **R2: the answer contains any negator** |
|---|---|---|---|---|
| SC-003 (48 rows), 7 checks | 7/7 green | 7/7 green, 0 rows change | 7/7 green, 0 rows change | **7/7 green, 0 rows change** |
| SC-012 | 7/7 | 7/7 | 7/7 | **7/7** |
| SC-003b clear → met (gate 100%) | 100% | **90% ✗** (`rows[4]`) | **90% ✗** (`rows[4]`) | **100%** |
| SC-003b incorrect → met (0%) | 0% | 0% | 0% | **0%** |
| SC-003b valid-alt → not_met (0%) | 0% | 0% | 0% | **0%** |
| SC-003b valid-alt → expected (≥ 75%) | 50% ✗ (waived) | 50% | 50% | **50%** |
| SC-003b partial → partial/uncertain (≥ 80%) | 88.9% | 88.9% | 88.9% | **88.9%** |
| SC-003b uncertain on clear + incorrect (≤ 20%) | 6.3% | 6.3% | 6.3% | **6.3%** |
| SC-003b dimensions changed | — | 3 (`rows[4]`, `[6]`, `[10]`) | 3 (same) | **2 (`rows[6]`, `[10]`, met → partial; overall still in `expect`)** |
| Exposed alternatives (§2 probe) | 47 | 0 | 0 | **0** |
| Pack-text sweep, 143 answers × 2 dimensions | — | 4 changed | 4 changed | **4 changed** (incl. the catch-06 s6 fix) |
| *Held-out SC-003c, spent; information only, not a gate* | *66.7 / 0 / 0 / 22.2 / 50 / 7.7* | *same; 1 dimension changes* | *same; 0 change* | *same; 0 change* |

A fourth variant (polarity: a matched token must sit in a negation window) was worse (SC-003b clear 80%) and is dropped.

**Why R1, the reviewer's literal rule, is rejected.** It fails the one SC-003b gate that passes today: `rows[4]` (clear, catch-02 s3) loses correction `met`. That row is correct. It matches a contrastive alternative of the form "X not Y" by saying Y positively in other words, and it uses a different negator from the alternative. R1 also refuses equivalent negators ("never" where the item says "not"). R2c fails the same row.

**Why R2 is enough.** Across all 109 labelled rows, 1 of 22 *incorrect* answers contains any negator, but most correct answers do (all 6 held-out clear rows, for instance). A negator anywhere in the answer is therefore a strong polarity signal at almost no recall cost.

### 4. Decision: `matcher@3` = R2 plus the four negators
1. **Rule (one line in `matchAlternative`, after `toks`):** an alternative whose content tokens include a negator returns `null` unless the answer's content tokens include at least one negator. PD-2's skip stays as it is for alternatives that do match.
2. **Negators:** add `havent`, `hasnt`, `wasnt` and `werent` to `MATCHER_RULES.negators` **in the same bump**. Measured alone and combined with R2, they change **0** rows in SC-003, SC-012, SC-003b and the held-out set, and 0 of the 286 sweep dimensions. One bump costs less than two, because every bump splits `graderVersion` across stored events. Under R2 they also count as "the answer contains a negator", so leaving them out would make R2 inconsistent.
3. `MATCHER_VERSION = 'matcher@3'`. `tests/practice-matcher.test.js:21` and `:28` move to `matcher@3`. Scratch full run with the change: the version assert is the only new failure.
4. **No ADR.** This is a rule change under ADR 0008's existing "any rule change bumps N" mechanism, the same way `matcher@2` was handled. Stored events keep `matcher@2` and are never rewritten (invariant 6). Projections can be rebuilt offline by re-grading the stored text.

### 5. Who does what
- **PM:**
  - File a bug ticket for `matcher@3` in `tasks.md`.
  - Amend PD-2, FR-017 and FR-021(b) in `spec.md`: "an alternative that contains a negator matches only an answer that contains a negator".
  - Add the four words to the negator list wherever it is written out.
  - Scheduling is your call within the founder's "stop tuning the grader" direction. **My view: this is a correctness fix, not tuning.** No gate number moves, and it removes a live wrong-credit case (catch-06 s6).
- **Backend (owner of `server/**`):**
  - Make the two changes and the version bump.
  - Add unit tests with subject-neutral words: (a) a positive restatement no longer matches a 3-token negator alternative; (b) the negated form still matches; (c) a different negator still matches; (d) `hasnt` within 3 words negates a matched token; (e) a red flag that contains a negator does not fire on a positive answer.
  - The SC-003, SC-012 and SC-003b runs must reproduce §3's R2 column.
- **QA:** add one SC-003b-style **incorrect** row whose wording carries an incidental negator, so R2's known gap (Risk 1) is measured, not assumed. Re-run the acceptance gates on the PR.
- **Content (module 1, next edit; module 2 already done):**
  - Rewrite contrastive "X not Y" alternatives positively where that reads naturally.
  - Separately: catch-04 s6 and catch-05 s5 still credit an echo of the flawed line through `acceptableCorrections[0]`. That issue is unchanged by `matcher@3` and is already on the PM's list.

### 6. Risks (devil's advocate; also in thread 0007)
1. **R2 is bypassed by an incidental negator.** An incorrect answer that says "no" or "not" anywhere still matches a negator alternative. L (1 of 22 labelled incorrect answers) · H. Mitigation: QA's row above. R2c is the tighter follow-up once contrastive alternatives are rewritten, because then `rows[4]` no longer depends on them.
2. **Recall loss on positive paraphrases.** Correct answers that state "Y" positively lose a contrastive alternative. Measured: 2 SC-003b dimensions and 3 of 286 sweep dimensions, with no gate moving. M · M. Mitigation: authors phrase alternatives positively, as module 2 now does.
3. **The new negators widen negation windows.** A correct answer containing "hasn't" next to a matched token becomes `uncertain`. Measured 0 changes, but on small sets. L · M. Mitigation: unit test (d), and the ≤ 20% gate on uncertain over clear + incorrect.
4. **The evidence is training data.** SC-003b is already a training set, and the held-out set is spent. The §2 probes are synthetic. Nothing here shows generalization; it shows only that the bug class is closed and no gate regresses.
5. **Order blindness is unchanged.** FR-017 is a bag of tokens, so "Y not X" still matches "X not Y" under every variant. Out of scope here, and a reason to keep matcher grades advisory.
