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
