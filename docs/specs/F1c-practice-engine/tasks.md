# F1c: Tickets

**Status:** Approved (revision 5: F1c-T11's gates all cleared; module-1 schedule recorded)
**Revision history:** revision 5 (2026-10-14): F1c-T11's content and merge gates all cleared in thread 0007 (spec PD-11; OQ-1, OQ-3, OQ-5 and OQ-6 resolved). T11 copies `schedule.json` exactly from the thread 0007 PM DECISION of 2026-10-14. No new tickets and no Files changes. Revision 4 (2026-10-14): the architect's Wave A.1 re-check (APPROVED) applied. New F1c-T17 (frontend, the F1c-B23 fix: one skip per statement, `err.rejected` on a 4xx; spec PD-9, FR-059, FR-060, SC-013), gated before F1c-T11 merges and before F1c-T01b runs and merges. F1c-T06 gains the OQ-7 voice commands and the "back" command (spec PD-10, FR-061). Shared-file sequence, Wave B order, T01b, T06, T11, the summary and the B23 status updated. Revision 3 (2026-10-14): Wave A.1 (F1c-T12 to T16) added to turn the Wave A verdicts (architect CHANGES REQUESTED, QA DON'T SHIP) into SHIP: W-B1/B20 (`matcher@2`), W-B2 (ADR 0002 Am. 4 skipped stops), W-S1, W-S3–W-S6, B21, B22 and the favicon (spec PD-4 to PD-8). W-S2 moves into F1c-T06. Shared-file sequences, T01b, T04, T06, T07 and T11 updated to match. Revision 2 (2026-10-13): [`review.md`](review.md) "Design review" (APPROVED WITH CHANGES) applied: C1–C15, plus the learning-designer's B2/B3 matcher fixes and PD-1 to PD-3 (spec "Product decisions"). Every Files line is now a single line with backticked paths (C6). Shared-file sequences gain the cross-spec order with F1a Wave 2 (C7), mirrored in F1a `tasks.md` rev 4.7. Revision 1: first draft. Spec: [`spec.md`](spec.md). Binding: ADRs 0001–0006 with all amendments, ADR 0008, ADR 0002 Amendment 3 and ADR 0006 Amendment 3 (an ADR wins over this file).

Legend: [P] = can run in parallel with other [P] tickets in the same wave (no shared files).

## Rules for every ticket in this spec
- **Isolation (SC-002).** No ticket touches the spec's "Untouched" list. `server/index.js`, `shared/events.js`, `server/db.js`, `server/packs.js` and `web/speech.js` are edited **only** by the tickets named below, additively.
- **Files lines (C6).** `npm run check:ticket <id>` reads only the ticket's single `- **Files:**` line and its backticked paths (`tests/tools/check-ticket.mjs:52`); text in parentheses is ignored. Never put a path only in a sub-bullet or in parentheses.
- **Golden replay** (`node tests/golden/run.mjs --replay`) runs after Waves A, B and C, and after F1c-T06. Any diff is a blocker bug.
- **`todo` mapping.** Acceptance and e2e tests that wait on a ticket are declared `{ todo: 'F1c-T##' }`. F1c-T01a widens the guardrail so these reasons pass. QA removes a ticket's `todo` markers when verifying that ticket. F1a-T19b counts only `F1a-` todos (F1a rev 4.7).
- **Changed assertions** are listed as `old → new`.
- **No prompt, gateway or model-routing change** in any F1c ticket.
- **Shared-file sequences (never in parallel):**
  - F1c-internal: `server/index.js` T04 → T08; `server/routes/practice.js` T04 → T07; `server/services/practice.js` and `tests/practice-catch.test.js` T04 → T13 → T07; `server/services/practice-matcher.js` and `tests/practice-matcher.test.js` T03 → T12; `web/practice/app.js`, `web/practice.html`, `web/practice/copy.js`, `web/practice/state.js` and `tests/practice-web-state.test.js` T05 → T14 → T17 → T06 → T09 → T10 (each later ticket touches only those of these files it lists); `web/practice/api.js` and `web/practice/practice.css` T05 → T06 → T09 → T10; `web/practice/commands.js` and `tests/practice-web-commands.test.js` T06 only; `server/packs.js` T02 only; `web/speech.js` T06 only; `tests/acceptance/F1c.test.js` is changed after T01a only by F1c-T15 → F1c-T16 (Wave A.1, listed `old → new`) and by QA `todo` removals; `tests/e2e/F1c.e2e.mjs` is changed after T01b only by QA `todo` removals.
  - **Wave A.1 merge order:** F1c-T15 → F1c-T13 → F1c-T12 (T12 merges after T13, because T13 makes `tests/practice-catch.test.js` assert `MATCHER_VERSION` instead of `'matcher@1'`, and after T15's SC-012 rows and QA's `matcher@1` validity record exist). F1c-T14 merges at any point. F1c-T16 verifies last.
  - **Cross-spec order with F1a Wave 2 (C7; F1a is on hold, mirrored in F1a `tasks.md` rev 4.7):**

    | File | F1c | F1a Wave 2 | Order |
    |---|---|---|---|
    | `server/index.js` | T04, T08 | T12, T18 | F1c-T04 → F1c-T08 → F1a-T12 → F1a-T18 |
    | `shared/events.js`, `tests/events.test.js` | T04 | T13a | F1c-T04 → F1a-T13a |
    | `server/packs.js` | T02 | T18 (comment) | F1c-T02 → F1a-T18 |
    | `web/speech.js` | T06 (`onSegment`) | T15 deletes it and rewrites `web/practice/speech.js`; T24 | F1c-T06 → F1a-T15 → F1a-T24 |
    | `npm test` `# todo` count | T01a, T01b add `F1c-` todos | T19b requires 0 `F1a-` todos | no order needed |
- **Wave order.**
  - **Wave A** (usable text-mode catch loop): T01a, T02, T03 [P] → T04 → T05. Built; verdicts CHANGES REQUESTED / DON'T SHIP (review.md, qa-report.md).
  - **Wave A.1** (fix wave; turns Wave A into SHIP): T12, T13, T14, T15 [P] → T16. **Done:** QA SHIP and architect APPROVED (2026-10-14).
  - **Wave B** (revision 4 order):
    - **Frontend lane:** T17 → T06. T17 (the F1c-B23 gate) starts now; T06 starts after T17 merges, because they share `web/practice/*` and T06 wires T17's `#rejected` panel to voice.
    - **Backend lane:** T07 (after T13) and T08 [P], unchanged. T11 [P] after T02, T03, T12 and its content gates; **T11 merges only after T17 has merged** (plus the founder's ARCH-2).
    - **QA:** T01b may be written now. **Its run for the verdict and its merge wait for T17** (it carries the B23 e2e tests with no `todo`).
    - T17 shares no file with T07, T08, T11 or T01b, so it runs in parallel with all of them.
  - **Wave C:** T09 → T10.

## Shared shapes (referenced by several tickets)
```ts
type Status = 'met' | 'partial' | 'not_met' | 'uncertain'
type Dim = { status: Status, matched: string[], missing: string[] }   // matched/missing hold whole item strings, '|' included
type Rating = 'had_it' | 'partly' | 'missed_it'
type Part = `stop:${statementId}` | `teachBack:${i}` | 'interview' | `followUps:${i}` | 'design' | `challenges:${i}` | 'followUp' | 'transfer'
type PublicExercise = {                       // built by allow-list, never by deleting fields
  id, module, type, objective, difficulty, concepts: string[], prerequisites: string[],
  narration?: {id, text}[],                   // catch, learn
  brief?: string, constraints?: string[],     // scenario
  firstPrompt?: {part: Part, prompt: string}  // learn: teachBack:0; interview: 'interview'; absent for catch and scenario
}
type GraderInput = {
  answer: string,
  dimensions: { [name in 'explanation'|'correction'|'transfer'|'tradeoffs'|'defense']?: {
    items: string[],                          // rubric items; each may hold '|' alternatives
    alternatives?: string[],                  // each matched as one item (acceptableCorrections)
    architectures?: {id: string, mustInclude?: string[]}[] } },   // no mustInclude anywhere → design = mustCover status
  flawedText?: string,                        // FR-021(c)
  redFlags?: string[], strongSignals?: string[],
  lexicon: { synonyms: Record<string, string[]> } }
type GraderOutput = {
  dimensions: { [name: string]: Dim & { confidence: 'high' | 'low' } },
  redFlagsMatched: string[],                  // un-negated matches only (FR-022)
  strongSignalsMatched: string[], architectureId: string | null,
  graderSource: 'matcher', graderVersion: string }
type Grader = (input: GraderInput) => GraderOutput   // synchronous in F1c (ADR 0008 ARCH-7)
```

---

## Wave A: the text-mode catch loop

### F1c-T01a [P] Acceptance tests (HTTP), labelled matcher sets, guardrails
- **Owner:** qa-engineer · **Size:** M · **Depends on:** none (written from the spec)
- **Files:** create `tests/acceptance/F1c.test.js`, `tests/acceptance/practice-helpers.mjs`, `tests/fixtures/practice/accept-pack/**`, `tests/fixtures/practice/labelled-answers.json`, `tests/fixtures/practice/m1-labelled-answers.json`; modify `tests/acceptance/todo-guardrail.test.js`, `tests/tools/check-ticket.mjs`, `tests/ownership.test.js`, `tests/fixtures/deny-list.json`
  - `accept-pack/**` is a neutral fictional subject: `practice.json`, `schedule.json`, `exercises/*.json` covering every type with at least one zero-planted catch, one interview with a string follow-up, one scenario whose architectures have no `mustInclude`, and `reference/*.md`.
- **Interfaces:**
  - Consumes: every route and shape in F1c-T04, T07 and T08 (not yet built); `startServer(env)` from `tests/helpers/server.mjs` with `PRACTICE_PACKS_DIR` and `DB_PATH`; `listSubjects()` from `server/packs.js`; `matcherGrade` (T03) and the loader (T02) in-process for the labelled sets.
  - Produces:
    - `practiceLeakScan(json, {allow: string[]}) → string[]` (C5): the JSON paths (`a.b[2].c`) of every FR-004 key whose path doesn't match an `allow` pattern. A pattern is a dotted path where `[]` matches any index, and it allows the key at that path and everything beneath it. Never throws; a cycle gives `"<cycle>"`.
    - `LEAK_ALLOW = {stop: ['reveal'], clarification: ['reveal'], assist: ['reference'], schedule: ['plan[].blocks[].kind'], progress: ['concepts[].readiness.transfer'], other: []}` (exported, frozen; exactly the FR-004 exceptions).
    - `labelled-answers.json` (accept-pack, SC-003): `[{exercise, part, answer, class: 'clear' | 'incorrect' | 'partial' | 'valid-alternative' | 'should-flag', expect: Status}]`, ≥ 40 rows and ≥ 8 per class. It MUST include rows on `|` items (C1), rows whose correct answer negates against a rubric item containing a negator, a row that rejects a red flag ("I wouldn't …"), a row that asserts a red flag, and 3-item dimensions answered with exactly 2 items (PD-2, PD-3).
    - `m1-labelled-answers.json` (SC-003b): one row per answer in `docs/research/applied-ai/module-1/exercises/_matcher-test-answers.json`, keeping its `exercise`, `statementId`, `class`, `text` and `expected`; an `expected` value written as "x or y" becomes `expect: ['x', 'y']`. The draft `synonyms` list is copied into the file's header as `draftSynonyms` for T11 (data only; the test reads the lexicon from the loaded pack).
- **Acceptance:**
  - Every HTTP-level scenario in US1, US3–US6 and every server edge case has a named test.
  - SC-001 (scan scope per C5), SC-003, SC-003b, SC-009 and SC-010 (per C3) are each asserted.
  - The required cases are clear, incorrect, partial, valid alternative and flagged uncertain, at the stop and answer level.
  - No F1c test calls `/api/subjects`, `/api/trades` or `/api/scenario` (C3).
- **Changed assertions:**
  - `todo-guardrail.test.js`: `TICKET` `/^F1a-T\d\d[a-d]?$/` → `/^F1[ac]-T\d\d[a-d]?$/`; test title updated to match; scanner case `'F1b-T01'` → `'F1d-T01'` (still a violation); add accepted case `'F1c-T04'`.
  - `check-ticket.mjs`: `TICKET_ID` widened the same way; `tests/acceptance/F1c.test.js` and `tests/e2e/F1c.e2e.mjs` added to the always-allowed list.
  - `ownership.test.js`: malformed-id stderr regex `/\^F1a-T\\d\\d\[a-d\]\?\$/` → the widened pattern.
  - `deny-list.json`: + `rag`, `embedding`, `embeddings`, `vector`, `vectors`, `bedrock`, `aws`, `sagemaker`, `opensearch`, `kendra`, `chunking`, `reranker`, `reranking`, `hallucination`, `hallucinations`, `fine-tuning`, `applied-ai` (C15). All have 0 current hits in `server/ shared/ web/ scripts/` (verified 2026-10-13); `deny-list-allow.json` is unchanged.
- **Tests that prove it:** named `"<US#>.<n> <title>"` or `"edge: <title>"`. Required:
  - "US1.1 start returns narration only (leak scan)";
  - "US1.2 hit met";
  - "US1.3 false interruption returns nothing about other statements";
  - "US1.4 late hit inside 2000 ms; same stop at 2001 ms is a false interruption";
  - "US1.5 valid alternative correction met";
  - "US1.6 long unmatched answer is uncertain, flagged in progress";
  - "US1.8 zero-planted clean pass";
  - "US1.9 assisted only after assist";
  - "US1.11 negated correction against a negated rubric item is met, not uncertain";
  - "US4.3 a rejected red flag is not counted";
  - "US4.4 string follow-up result null, self-ratable";
  - "US5.3 no mustInclude: design equals mustCover";
  - "US6.7 readiness from scenario challenges; n/a with string follow-ups only";
  - "edge: repeat stop identical body, no new events";
  - "edge: stop after complete 409";
  - "edge: att_ id on practice routes 404";
  - "edge: 413 and 400";
  - "SC-001 leak scan over every pre-complete response and the tracks, schedule, progress and review routes";
  - "SC-003 labelled set thresholds" (prints the per-class confusion table as a TAP diagnostic);
  - "SC-003b module-1 labelled set thresholds" (`todo: 'F1c-T11'`; prints the confusion table);
  - "SC-009 progress identical after restart";
  - "SC-010 invalid practice pack: server up, one [practice] warning, listSubjects() unchanged and no [packs] warning".
- **Notes:** runs in `npm test`. The SC-003 pack is the QA-owned `accept-pack`, not the engineers' fixture or the real content. `docs/research/**` is read, never edited.

### F1c-T02 [P] Practice pack format, validator and loader
- **Owner:** backend-engineer · **Size:** M · **Depends on:** none (ARCH-1 and ARCH-3 ruled, ADR 0008)
- **Files:** create `server/services/practice-pack.js`, `tests/practice-pack.test.js`, `tests/fixtures/practice/pack-basic/**`; modify `server/packs.js`, `tests/pack.test.js`
  - `pack-basic/**`: a neutral fictional subject; ≥ 1 exercise per type, 1 zero-planted catch, 1 string interview follow-up.
  - `server/packs.js`: exactly one guarded line that skips, silently, a directory with `practice.json` and no `pack.json` (ADR 0008). If both exist, `pack.json` loads as before.
- **Interfaces (produces):**
  - `validatePracticePack({manifest, schedule, exercises: Map<string, object>, references: Map<string, string>}) → string[]`: every spec schema rule and cap, the reference-integrity check, and the C1/C2 rules: rubric items with `|` alternatives (reject an empty alternative and > 8 alternatives); `sources[]` = `{title, url, verified: boolean, note?: string ≤ 200}`; interview `followUps[]` items `{question, rubric}` or string; `acceptableArchitectures[]` = `{id, summary, mustInclude?, strengths?, tradeoffs?}`. It never throws.
  - `loadPracticePacks(dir = process.env.PRACTICE_PACKS_DIR || <ROOT>/packs, db = getDb(), {getPack} = <server/packs.js>) → Map<trackId, Track>`. It never throws, warns `[practice] <dir> skipped: <reasons>`, refuses an id that `getPack(id)` holds, stores canonical JSON through `db.putPack({id, version, json, provenance})`, and refuses on `'conflict'`.
  - `listTracks() → {id, title, version}[]`, `getTrack(id) → Track | null`, `getExercise(trackId, exerciseId) → Exercise | null` (deep-frozen), `getReferences(trackId, ids: string[]) → {id, text}[]`, `getSchedule(trackId) → Schedule | null`, `getExercises(trackId) → Map<string, Exercise>`.
  - `toPublicExercise(ex) → PublicExercise` (allow-list).
  - `Track = {id, version, title, modules: [{id, title, exercises: string[]}], lexicon: {synonyms}}`.
- **Acceptance:** FR-001, FR-002, FR-004 (projection, including `strengths`, `tradeoffs`, `note`), SC-010 (loader half).
- **Tests that prove it:** `tests/practice-pack.test.js`:
  - "pack-basic validates with 0 problems";
  - "zero-planted catch is valid";
  - "statement in both planted and clean fails";
  - "narration id in neither fails";
  - "missing reference file fails";
  - "reference containing a planted statement fails";
  - "schedule minutes must sum to minutesPerDay";
  - "practice share below 60% fails";
  - "caps enforced";
  - "rubric item with an empty | alternative fails; 9 alternatives fails; 8 passes";
  - "sources: boolean verified with optional note ≤ 200 passes; string verified fails";
  - "string interview followUps pass; architecture without mustInclude passes";
  - "garbage input never throws";
  - "changed pack same version refused";
  - "practice id already held by getPack is refused with one [practice] warning";
  - "toPublicExercise emits only allow-listed keys for each type".
  - `tests/pack.test.js`: "a directory with practice.json and no pack.json is skipped with no [packs] warning".
- **Notes:** reuses the `server/packs.js` pattern (canonicalJson can be imported from there). Engine code holds no subject words and no track-id literal.

### F1c-T03 [P] Rubric-concept matcher (offline grader)
- **Owner:** backend-engineer · **Size:** M · **Depends on:** none (ARCH-5 ruled: option (a), ADR 0008)
- **Files:** create `server/services/practice-matcher.js`, `tests/practice-matcher.test.js`
- **Interfaces (produces):**
  - `MATCHER_VERSION = 'matcher@1'` (F1c-T12 bumps it to `'matcher@2'` and adds `stuffedMaxFunctionShare: 0.2`);
  - `MATCHER_RULES` (frozen): `{itemCoverage: 0.6, metRatio: 2/3, epsilon: 1e-9, minWords: 3, longAnswerWords: 20, negationWindow: 3, echoCoverage: 0.8, stuffedMaxRest: 2, maxAlternatives: 8, negators: ['not', 'no', 'never', 'isnt', 'arent', 'doesnt', 'dont', 'didnt', 'cannot', 'cant', 'wont', 'wouldnt', 'shouldnt', 'without']}`;
  - `matcherGrade(input: GraderInput) → GraderOutput` (sync, pure);
  - `matchClarification(question: string, clarifications: {askAbout: string[]}[], lexicon) → number | null`;
  - `combineOverall(dims: Dim[]) → Status` (FR-011).
- **Acceptance:** FR-013, FR-014, FR-017–FR-022 (with C1, PD-2, PD-3), FR-020, FR-043 (as `combine`, including the no-`mustInclude` rule).
- **Tests that prove it:**
  - "item match needs ceil(0.6n) tokens; n ≤ 2 needs all";
  - "an item matches through any | alternative; matched reports the whole item" (C1);
  - "word-start match with stemming (tested hits test; online does not hit line)";
  - "lexicon synonym satisfies a token";
  - "met / partial / not_met thresholds";
  - "met threshold is ceil(n × 2/3 − 1e-9): 2 of 3 met, 2 of 2 met, 1 of 2 partial, 3 of 4 met, 2 of 4 partial" (PD-3);
  - "fewer than 3 content words is not_met";
  - "stuffed answer capped at partial";
  - "valid alternative correction met when rubric.correct not";
  - "best architecture wins; no mustInclude means design equals mustCover";
  - "long unmatched answer is uncertain";
  - "negation before a matched token is uncertain";
  - "negation is skipped when the matched alternative itself contains a negator" (PD-2: answer "temperature zero is still not fully deterministic" against `not fully deterministic at zero` → matched, not uncertain);
  - "negators are content tokens: 'consistent and identical' does not match 'more consistent not identical'" (PD-2);
  - "apostrophes are removed: wouldn't is the negator wouldnt";
  - "echoing the flawed statement is uncertain";
  - "red flag makes uncertain";
  - "a negated red flag is not counted and not listed" (PD-2: "I wouldn't fine-tune for knowledge" against `fine-tuning for knowledge`);
  - "never throws on non-string input";
  - "overall combination table".
- **Notes:**
  - Reimplements the techniques of `shared/mock-grader.js`: normalize, stem, word-start regex, stuffing. The stopword list is generic English **minus every negator**, and the module holds no subject words.
  - Server-only: never import it from `web/`.

### F1c-T04 Catch attempt API, events and wiring
- **Owner:** backend-engineer · **Size:** M · **Depends on:** F1c-T02, F1c-T03 (ARCH-4 ruled, ADR 0002 Amendment 3)
- **Files:** create `server/services/practice.js`, `server/routes/practice.js`, `tests/practice-catch.test.js`; modify `server/index.js`, `shared/events.js`, `tests/events.test.js`
  - `server/index.js`: import the route; call `loadPracticePacks()` after `loadPacks()`.
  - `shared/events.js`: VERBS + `'self-rated'`, `'assisted'`, `'clarified'`.
  - `tests/events.test.js`: old → new: the expected `VERBS` list gains those 3.
- **Interfaces:**
  - Consumes: T02's loader functions and `toPublicExercise`; T03's `matcherGrade` and `combineOverall`; `db.appendEvents` and `db.eventsForAttempt`; `makeEvent` and `newId('pra')`.
  - Produces:
    - `createPracticeService({db, grader = matcherGrade, now = Date.now}) → {startAttempt, submitStop, assist, complete, selfRate}`. Throws `TypeError` if `grader` isn't a function (C4). `grader` is called synchronously (FR-023). The service holds no state outside the event log; each attempt is rebuilt by `projectPracticeAttempt(events)` (exported).
    - `GRACE_MS = 2000` (exported).
    - `handle(req, res, url) → boolean`. It matches only the exact paths below and returns `false` otherwise, so later route modules are reached. Any `:id` not starting `pra_` → 404.
  - **Routes:**
    - `GET /api/practice/tracks → [{id, title, version}]`
    - `GET /api/practice/tracks/:track → {id, title, version, modules: [{id, title, exercises: [{id, type, objective, difficulty, concepts, prerequisites}]}]}` | 404
    - `POST /api/practice/attempts {track, exercise, mode?: 'practice' | 'diagnostic' | 'review'} → {attemptId, exercise: PublicExercise, assistAllowed}`. 400 on a bad mode, or on a diagnostic for an exercise not in `schedule.diagnostic`; 404 on an unknown track or exercise.
    - `POST /api/practice/attempts/:id/stops {statementId, elapsedMs, answer, via?, stopLatencyMs?} → {statementId, attributedStatementId, detection: 'hit' | 'late_hit' | 'false_interruption', assisted, result: null | {explanation: Dim, correction: Dim, overall: Status}, reveal: null | {statementId, misconception, whyWrong, exceptions, correctedText}}`
    - `POST /api/practice/attempts/:id/assist {} → {assisted: true, reference: [{id, text}]}`. 400 if diagnostic; idempotent.
    - `POST /api/practice/attempts/:id/complete {lastStatementId?} → {summary: {planted, hits, lateHits, misses, falseInterruptions, notReached, cleanPass, flagged}, missed: [{statementId, text, misconception, whyWrong, exceptions, correctedText}], answered: [{part, answer, result, rubric: {explain, correct}, acceptableCorrections, selfRating: Rating | null}], reference: [{id, text}], sources: [{title, url, verified, note?}], followUp: {question, graded: boolean}, transfer: {scenario}}` (catch). Idempotent.
    - `POST /api/practice/attempts/:id/self-ratings {part, rating} → {part, rating, matcherStatus}`. 400 before complete, or for a part with no answer.
  - Events exactly as the spec's "Events and metrics" table (ADR 0002 Amendment 3), with `context.engine = 'practice'` and `object.part` on every `self-rated`.
- **Acceptance:** FR-004–FR-012, FR-014–FR-016, FR-023 (injected sync grader, `TypeError`), FR-050 (catch verbs), edge cases for stops, complete and engine isolation.
- **Tests that prove it:** `tests/practice-catch.test.js` (in-process service on a `:memory:` DB plus one spawned-server HTTP smoke test with `PRACTICE_PACKS_DIR` set to a **folder of packs** that contains `pack-basic/`, e.g. `tests/fixtures/practice`; pointing it at `pack-basic` itself loads 0 tracks, F1c-B22):
  - "hit writes stopped/explained/graded in one append, in seq order, all valid";
  - "false interruption: result and reveal null";
  - "grace: 2000 ms late hit, 2001 ms false interruption, caught previous not re-attributed";
  - "repeat stop identical body, no events";
  - "backwards stop 400; after complete 409; non-catch 400";
  - "assist marks later grades only; diagnostic assist 400; idempotent";
  - "complete idempotent; notReached vs missed; cleanPass";
  - "self-rated copies matcherStatus and carries object.part";
  - "injected grader is used; a non-function grader throws TypeError";
  - "an att_ id on /api/practice/attempts returns 404" (C7);
  - "every practice event carries context.engine 'practice'" (C7);
  - "practice modules and server/ai, server/prompts never import each other" (C7; grep guard, ADR 0006 Amendment 3);
  - "listSubjects() is unchanged with and without practice packs loaded, and no [packs] warning is logged" (C3).
  - `tests/events.test.js`: updated VERBS assertion.
- **Notes:**
  - Grading is synchronous, so there are no awaits between reading events and appending them, and no in-flight map.
  - Answers are truncated to 2000 chars.

### F1c-T05 Practice page, text-mode catch loop
- **Owner:** frontend-engineer · **Size:** M · **Depends on:** F1c-T04 contract (may build against the shapes above in parallel; integrates when T04 merges)
- **Files:** create `web/practice.html`, `web/practice/app.js`, `web/practice/api.js`, `web/practice/copy.js`, `web/practice/state.js`, `web/practice/speech.js`, `web/practice/practice.css`, `tests/practice-web-state.test.js`
- **Interfaces:**
  - Consumes: T04's routes; `speak`, `stopSpeaking`, `wait`, `canListen` and `listen` from `/speech.js`, **only** through `web/practice/speech.js` (C8; `speak(text, {enabled: false})` gives reading-pace timing in text mode).
  - Produces:
    - **`speech.js`:** re-exports `speak`, `stopSpeaking`, `wait`, `canListen` and `listen` from `/speech.js`, unchanged. It is the only practice module that imports the shared speech module (ADR 0008).
    - **`state.js` (pure, Node-importable, no `window`):**
      - `resumeIndex(stopResponse, interruptedIndex) → number` (FR-037);
      - `feedbackText(stopResponse) → string` (copy `fb.*`, with `fb.late.prefix`);
      - `dimLines(result) → string[]`;
      - `summaryLine(summary) → string`;
      - `missedLine(item) → string`.
    - **`copy.js`:** `COPY` (frozen), keyed by the spec copy-table ids. T05 adds every id used by the text catch loop, plus `next.hint` and `btn.next`.
    - **`api.js`:** `fetchTracks()`, `fetchTrack(id)`, `startAttempt(body)`, `postStop(id, body)`, `postAssist(id)`, `postComplete(id, body)`, `postSelfRating(id, body)`, each with a 12 s timeout that throws a typed `NetworkError`.
    - **DOM ids** (QA's e2e depends on them):
      - picker: `#track-list`, `#exercise-list`, `#picker-msg`, `#voice-toggle`;
      - narration: `#intro`, `#statements` (`li[data-statement-id]`, `.current`, `.interrupted`, `.corrected`), `#stop-btn`, `#assist-btn`, `#reference`;
      - answer: `#answer-panel`, `#answer-prompt`, `#answer-input`, `#submit-btn`;
      - network error: `#net-error`, `#retry-btn`, `#skip-btn`;
      - feedback: `#feedback-panel`, `#feedback-text`, `#feedback-dims`, `#continue-btn`;
      - reveal: `#reveal`, `#summary-line`, `#missed-list`, `#answered-list` (`li[data-part]` containing `button[data-rating]`), `#sources-list` (`li > a`), `#next-hint`, `#next-btn`.
  - **Next (FR-058, Wave A behavior):** `#next-btn` opens the picker. F1c-T10 changes its target to the next exercise in today's plan.
  - **Sources (C13, FR-039):** each source is `<a>` with `a.href = url` set by property, `rel="noopener noreferrer"`, title via `textContent`, then `src.unverified` as text when `verified` is false.
- **Acceptance:** US1.1–US1.12 in text mode; FR-005, FR-035 (text displayed equals the `speak()` argument whenever voice is on), FR-036 (text half), FR-038 (`via: 'button' | 'key'`), FR-039, FR-058 (Wave A half). All pack text uses `textContent`; the reference goes in a `pre-wrap` block.
- **Tests that prove it:** `tests/practice-web-state.test.js`:
  - "resume after hit is next; after late hit or false interruption is the interrupted statement";
  - "feedbackText for each overall and late prefix";
  - "summaryLine singular/plural";
  - "copy strings equal the spec table" (frozen inline);
  - "no web/practice file imports server/ or mock-grader" (grep);
  - "only web/practice/speech.js imports /speech.js" (C8; grep for import specifiers resolving to `web/speech.js` or `web/speech/**`, so the test stays valid after F1a-T15);
  - "sources are built with a.href by property and rel noopener noreferrer; no innerHTML in web/practice" (grep, C13).
  - A manual real-browser check in text mode at 390 px and 1280 px is recorded in the PR.
- **Notes:** do not import or fork `web/app.js`. Link `styles.css` read-only, with practice styles in `practice.css`. The page title is "Practice", with no subject words.

---

## Wave A.1: fix wave (Wave A code review and QA report)

**Goal:** turn the Wave A verdicts into SHIP with the smallest change. The architect re-checks only the diff and the test output (review.md, "Verdict").

**Ships when** (QA, F1c-T16):
- `matcher@2` passes SC-003 on the enlarged accept-pack set, plus SC-012, US1.5 and US1.11;
- W-B2 is fixed (FR-009a);
- the FR-050 test follows the B21 ruling and asserts `MATCHER_VERSION`;
- the `F1c-T03` and `F1c-T04` todo markers are gone, and `npm test` shows `# fail 0`;
- the golden replay shows 0 diffs.

**Scope decisions (spec PD-4 to PD-8):**
- **In Wave A.1:** W-B1, W-B2, W-S1, W-S3, W-S4, W-S5, W-S6, B21, B22, and the favicon.
- **Moved:** W-S2 moves to F1c-T06.

### F1c-T12 [P] `matcher@2`: FR-019 function-word share (F1c-B20, W-B1)
- **Owner:** backend-engineer · **Size:** S · **Depends on:** none to build. **Merge** waits on F1c-T13 (it makes `tests/practice-catch.test.js` version-agnostic) and on F1c-T15 (the SC-012 rows, plus QA's `matcher@1` validity record).
- **Files:** modify `server/services/practice-matcher.js`, `tests/practice-matcher.test.js`
- **Interfaces:**
  - Consumes: nothing new.
  - Produces (the signatures are unchanged; only these values change):
    - `MATCHER_VERSION = 'matcher@2'`;
    - `MATCHER_RULES` (still frozen) gains `stuffedMaxFunctionShare: 0.2`, and every other key and value is unchanged;
    - `matcherGrade(input: GraderInput) → GraderOutput`, where `graderVersion` is `'matcher@2'`.
  - Internal: `makeAnswer` also returns `functionShare = raw.filter(w is in STOPWORDS).length / raw.length`, where `raw` is every word, before stopword and length filtering (the negation window's tokens), and 0 when `raw` is empty. At `practice-matcher.js:227`: `stuffed = (total - removed.size <= R.stuffedMaxRest) && functionShare < R.stuffedMaxFunctionShare`.
- **Acceptance:**
  - FR-019 as rewritten in revision 3: the cap fires only when (a) and (b) both hold, and (b) is strict.
  - FR-014: the version is bumped.
  - `STOPWORDS` is unchanged, and no word is added anywhere (inv. 1, FR-003).
  - Proven at QA verify (F1c-T16): SC-003 on the enlarged set, SC-012, US1.5 and US1.11.
- **Tests that prove it:** `tests/practice-matcher.test.js`:
  - "a concise correct sentence with ≤ 2 leftover words is not capped";
  - "a comma-separated keyword list of rubric words is capped at partial";
  - "a list padded with one article is still capped";
  - "the function-word share boundary is strict: share 0.2 is not capped, 1/6 is". Example: items `['kettle', 'lantern', 'orbit']`; "the kettle lantern orbit harbor" (1 of 5) → `met`; "kettle lantern orbit harbor beacon the" (1 of 6) → `partial`.
  - Old → new: "version and rules are exported and frozen": `'matcher@1'` → `'matcher@2'` (both assertions), plus `MATCHER_RULES.stuffedMaxFunctionShare === 0.2`.
  - "stuffed answer capped at partial" stays unchanged and still passes (its answers have no function words).
- **Notes:**
  - The threshold is the PM's (spec PD-4).
  - If any assertion outside this Files line changes result under `matcher@2` (other than the `'matcher@1'` strings that F1c-T13 and F1c-T16 replace), stop and report it in thread 0007. Don't edit another ticket's file.
  - No prompt, gateway or model change, so the eval gate isn't triggered.

### F1c-T13 [P] Catch service: skipped stops are not graded, `stopId` repeats, assist after complete, transitive import guard (W-B2, W-S1, W-S3, W-S5, B21 test)
- **Owner:** backend-engineer · **Size:** M · **Depends on:** none (ADR 0002 Am. 4 ruled; W-S1 proposed by the architect, product rule in spec PD-6)
- **Files:** modify `server/services/practice.js`, `tests/practice-catch.test.js`
  - `server/routes/practice.js` is **not** changed: it already passes the parsed body through.
- **Interfaces:**
  - **Consumes:** the existing `attribute()`, `projectPracticeAttempt`, `db.appendEvents` and `MATCHER_VERSION`.
  - **Produces (all additive):**
    - `POST /api/practice/attempts/:id/stops {statementId, elapsedMs, answer, via?, stopLatencyMs?, stopId?: string}`. The response shape is unchanged. `stopId` must match `^[A-Za-z0-9_-]{8,64}$`, otherwise 400. Repeat rules are exactly spec FR-008:
      - same `stopId` and same statement → the stored body, no events;
      - same `stopId` and another statement → 400;
      - new `stopId` → a new stop;
      - no `stopId` → the revision-2 rule (the latest stop on that statement).
    - `stopped.result.stopId`: present only when the request carried one.
    - `projectPracticeAttempt(events)` stops gain `stopId: string | null`, and a repeat body is rebuilt from the stop with that `stopId`.
    - `POST /api/practice/attempts/:id/complete {lastStatementId?, skipped?: [{statementId: string, elapsedMs?: number}]}`. Validation, attribution, reached range and stored lists are exactly spec FR-009a.
      - The response shape is as in T04, plus `missed[]` = the union of missed and not-graded ids in narration order, where a not-graded item carries `notGraded: true` and other items have no such key.
      - `summary` is unchanged, and `summary.misses` = `missedStatementIds.length`.
    - `completed.result` gains `skippedStatementIds: string[]` and `notGradedStatementIds: string[]`, always written.
    - `assist(attemptId)`: once `a.completed` is set, it returns `{assisted: true, reference}` and appends nothing (W-S3).
  - Example `completed.result` (catch-watering with `s2` planted, skipped at 300 ms, then the set finishes):
    ```json
    {"hits":0,"lateHits":0,"misses":0,"falseInterruptions":0,"notReached":0,"cleanPass":false,"flagged":0,
     "missedStatementIds":[],"notReachedStatementIds":[],"skippedStatementIds":["s2"],"notGradedStatementIds":["s2"]}
    ```
- **Acceptance:** FR-008, FR-009, FR-009a; the spec edge cases "Repeat and re-stop", "Skipped stops at complete" and "Assist after complete"; ADR 0002 Am. 4 (both verification tests); W-S5.
- **Tests that prove it:** `tests/practice-catch.test.js`:
  - "a false interruption writes graded with outcome false_alarm and overall null" (Am. 4; asserts the exact result `{dimensions: {}, overall: null, outcome: 'false_alarm', assisted: false, confidence: 'high', graderSource: 'matcher', graderVersion: MATCHER_VERSION, latencyMs: 0}`);
  - "a skipped stop on a planted statement is notGraded, not missed; caught, missed, notGraded and notReached are disjoint and cover every planted statement" (Am. 4);
  - "skipped: a skip inside 2000 ms of the next statement marks the previous planted statement notGraded; a skip on a clean or already-caught statement changes no count and keeps cleanPass";
  - "skipped: a statement skipped and then caught is caught, not notGraded";
  - "skipped: a skipped statement after lastStatementId is notGraded, not notReached";
  - "skipped: not an array, 21 entries, a non-object entry or an unknown statementId is 400; a repeat complete ignores skipped";
  - "stopId: the same stopId returns the stored body with no events; the same stopId on another statement is 400; a malformed stopId is 400";
  - "stopId: a new stopId after a late hit is a new stop, a false interruption with its own triple (W-S1)";
  - "stopId is stored on stopped only when sent";
  - "assist after complete returns the same body and writes no event" (W-S3);
  - "practice modules never reach server/ai or server/prompts, transitively": the walk follows relative import specifiers from every `server/{services,routes}/practice*.js` until closure, and fails on any reached path under `server/ai/` or `server/prompts/`, or on `ai-client`/`llm.js` (W-S5).
- **Changed assertions (old → new):**
  - "hit writes stopped/explained/graded in one append, in seq order, all valid" and "self-rated copies matcherStatus and carries object.part": `'matcher@1'` → `MATCHER_VERSION`, imported from `server/services/practice-matcher.js` (so the file passes under `matcher@1` and `@2`).
  - "complete idempotent; notReached vs missed; cleanPass": the `completed[0].result` deepEqual gains `skippedStatementIds: [], notGradedStatementIds: []`.
  - "practice modules and server/ai, server/prompts never import each other": keeps its reverse half (`server/ai`, `server/prompts` never import a practice module). Its forward half is replaced by the transitive test above.
  - "repeat stop identical body, no events" stays unchanged and must pass (requests without `stopId`).
- **Notes:**
  - Grading and attribution stay synchronous, with no `await` between reading events and appending (ADR 0002 Am. 3).
  - Skipped entries are attributed only against graded stops, never against each other.
  - Validate `skipped` only on the first `complete`. The existing idempotent early return stays first.

### F1c-T14 [P] Practice page: skip bookkeeping and the not-scored line, `stopId`, self-rating error, favicon (W-B2, W-S1, W-S4, PD-8)
- **Owner:** frontend-engineer · **Size:** M · **Depends on:** the F1c-T13 contract. Build in parallel: the T04 server ignores unknown body fields, so this ticket can merge before or after T13.
- **Files:** modify `web/practice/app.js`, `web/practice/state.js`, `web/practice/copy.js`, `web/practice.html`, `tests/practice-web-state.test.js`
  - `web/practice/api.js` is **not** changed: `postStop` and `postComplete` already send any body.
- **Interfaces:**
  - **Consumes:** T13's `stopId` and `skipped` request fields, and `missed[].notGraded`.
  - **Produces, `state.js` (pure, Node-importable):**
    - `newStopId() → string`. Uses `crypto.randomUUID()` when it is a function; otherwise 16 bytes from `crypto.getRandomValues` as 32 lowercase hex chars. The result always matches `^[A-Za-z0-9_-]{8,64}$`.
    - `completeRequest(lastStatementId: string | null, skipped: {statementId: string, elapsedMs: number}[]) → {lastStatementId?: string, skipped?: {statementId, elapsedMs}[]}`. A key is left out when its value is `null` or empty.
    - `missedLine(item)` → `missed.notGraded` when `item.notGraded === true`, otherwise `missed.item` as today. Whitespace is normalized as today.
  - **Produces, `copy.js`:** adds `missed.notGraded`, `err.rate` and `btn.retry`, with exactly the spec copy-table text.
  - **Produces, `app.js`:**
    - `S.skipped = []` is reset in `start()`.
    - `onStop` sets `S.stop.stopId = newStopId()`. `submitStop` sends `stopId`. Try again re-sends the same `S.stop`, so the same `stopId`.
    - `onSkip` pushes `{statementId: S.stop.statementId, elapsedMs: S.stop.elapsedMs}` onto `S.skipped` before replaying the statement.
    - `complete()` posts `completeRequest(last?.id ?? null, S.skipped)`.
    - `rate()` on failure:
      - adds, inside that `li[data-part]`, one `p.rate-error` (`role="status"`) whose text is set with `say()`, so it is shown and spoken (FR-035), plus one `button.rate-retry` labelled `btn.retry` that re-posts the same rating;
      - leaves `aria-pressed` unchanged.
      - On success, it removes both and sets `aria-pressed` as today.
      - At most one `.rate-error` per row.
  - **Produces, `practice.html`:** exactly one added line in `<head>`, `<link rel="icon" href="data:,">` (PD-8).
  - **DOM (QA's e2e depends on these):** `li[data-part] p.rate-error`, `li[data-part] button.rate-retry`. Every existing id is unchanged.
- **Acceptance:**
  - US1.13–US1.15 (text) and US2.10–US2.11 (voice).
  - The client halves of FR-008 and FR-009a.
  - FR-035 for `missed.notGraded` and `err.rate`. The reveal already speaks every `#missed-list` child, so the not-scored line is spoken where missed lines are.
  - PD-8: no `/favicon.ico` request from `/practice.html`.
  - No `innerHTML`; all text through `textContent`.
- **Tests that prove it:** `tests/practice-web-state.test.js`:
  - "missedLine for a not-graded item says it was not scored and never says Missed";
  - "completeRequest sends skipped only when non-empty and lastStatementId only when known";
  - "newStopId is unique per call and matches the server pattern";
  - "practice.html declares an empty inline icon" (source check for `<link rel="icon" href="data:,">`);
  - old → new: "copy strings equal the spec table": the frozen expected object gains `missed.notGraded`, `err.rate` and `btn.retry`.
  - **Manual real-browser check, recorded in the PR, in text and voice mode at 390 and 1280 px:**
    - abort a stop request, then Skip, and finish the set: the reveal shows the `missed.notGraded` line;
    - set DevTools offline, then rate: `err.rate` appears, and Try again succeeds once back online;
    - 0 console errors on a fresh load of `/practice.html`.
- **Notes:**
  - `sum.line` is unchanged (PD-5).
  - W-S2 (STOP during `end.catch`) is **not** in this ticket; it is in F1c-T06.
  - Don't touch `web/index.html` or `web/app.js` (Untouched list).

### F1c-T15 [P] Enlarged labelled sets and the SC-012 module-1 check (architect's overfitting RISK)
- **Owner:** qa-engineer · **Size:** S · **Depends on:** none. **Must merge before F1c-T12 merges.**
- **Files:** modify `tests/fixtures/practice/m1-labelled-answers.json`, `tests/fixtures/practice/labelled-answers.json`, `tests/acceptance/F1c.test.js`, `docs/specs/F1c-practice-engine/qa-report.md`
- **Interfaces:**
  - Consumes: `matcherGrade` and `combineOverall` (in-process), `graderInputFor` from `tests/acceptance/practice-helpers.mjs` (unchanged), and the draft catch exercises in `docs/research/applied-ai/module-1/exercises/*.json` (read, never edited).
  - **Produces, in `m1-labelled-answers.json`:**
    - A new top-level `qaRows` array. `rows` stays a verbatim copy of the research file, so the existing fixture test is unchanged for it.
    - Each `qaRows` item is `{exercise, statementId, part: "stop:<id>", class, tags: ["keyword-list"] | ["short-correct"], text, expect: {explanation, correction, overall}}`. `expect` values may be arrays of alternatives, as in `rows`. There is no `expected` field, because that field is the research file's own.
    - Plus `qaRowsNote` (who, when, why).
    - **≥ 2 `keyword-list` rows,** on 2 different module-1 catch exercises:
      - comma-separated rubric words for one planted statement, with at most one function word;
      - `class: "partial"`, `expect.overall: "partial"`.
    - **≥ 2 `short-correct` rows,** on 2 different module-1 catch exercises:
      - one or two sentences of ≤ 25 words, correct by the draft's `whyWrong` and `acceptableCorrections`;
      - written so that ≤ 2 content words remain after the matched forms are removed (FR-019(a) fires);
      - `class: "clear"`, `expect.overall: "met"`.
  - **Produces, in `labelled-answers.json` (accept-pack):**
    - + ≥ 1 row tagged `stuffed` that is a keyword list padded with exactly one article (`class: "partial"`, `expect: "partial"`);
    - + ≥ 1 row tagged `short-correct` (`class: "clear"`, `expect: "met"`) on a part other than the 6 rows B20 lists.
    - Every existing fixture rule still holds.
- **Acceptance:**
  - SC-003 (revision 3, enlarged set) and SC-012 can each be run as a named test.
  - The SC-012 validity check (spec SC-012) is recorded in `qa-report.md` under "Wave A.1", from a run on `matcher@1`, **before** T12 merges. It must show every `short-correct` row as `partial` and every `keyword-list` row as `partial`. If a short-correct row isn't capped under `matcher@1`, it doesn't test FR-019: rewrite it.
- **Tests that prove it:** `tests/acceptance/F1c.test.js`:
  - new: "fixture: m1 qaRows hold ≥ 2 keyword-list rows expecting partial and ≥ 2 short-correct rows expecting met, each on a planted statement of a module-1 draft catch exercise";
  - new: "SC-012 FR-019 on module-1 wording: keyword lists partial, short correct sentences met (research drafts, draftSynonyms)", `{ todo: 'F1c-T12' }`. It prints one diagnostic line per row (exercise, tag, expected, actual).
  - old → new: "SC-003b module-1 labelled set thresholds" grades `rows` and `qaRows` (still `todo: 'F1c-T11'`);
  - old → new: "fixture: labelled-answers.json has ≥ 40 rows, …" also asserts ≥ 3 `stuffed` rows and ≥ 1 `short-correct` row.
- **Notes:** the learning-designer may review the new module-1 rows in thread 0007 (spec LR-9). That review is advisory and doesn't block the merge.

### F1c-T16 Wave A.1 acceptance updates, todo removal and re-verify (B21, W-S6, ship verdict)
- **Owner:** qa-engineer · **Size:** M · **Depends on:** F1c-T15 (same test file). Write the tests now, with todo markers. Remove each marker once its ticket (T12, T13, T14) has merged and the test passes.
- **Files:** modify `tests/acceptance/F1c.test.js`, `tests/acceptance/practice-helpers.mjs`, `docs/specs/F1c-practice-engine/qa-report.md`
  - `practice-helpers.mjs`: only if a request helper needs to pass the new `stopId` or `skipped` fields.
- **Interfaces:** consumes T12's `MATCHER_VERSION`, T13's routes and fields, and T14's DOM (browser check only).
- **Changed assertions:** "FR-050 catch events: …", old → new:
  - the verb list `['started','stopped','explained','graded','stopped','explained','completed','self-rated']` → `['started','stopped','explained','graded','stopped','explained','graded','completed','self-rated']`;
  - new assertion: the second `graded.result` has `overall: null`, `outcome: 'false_alarm'` and `dimensions: {}`, in the same append as its `stopped`/`explained`;
  - `'matcher@1'` → `MATCHER_VERSION` (imported) in both places (W-S6);
  - the `stopped.result` deepEqual is unchanged (no `stopId` is sent there).
- **New tests** (`todo: 'F1c-T13'` until T13 merges):
  - "US1.13 a skipped stop is not scored: notGraded at the reveal, not counted in misses, stored in notGradedStatementIds";
  - "US1.14 a new stopId after a late hit is a new stop (false interruption); Try again with the same stopId returns the stored body with no events";
  - "edge: skipped validation 400 (not an array, 21 entries, a non-object entry, an unknown statementId); a repeat complete ignores skipped";
  - "edge: a malformed stopId is 400; the same stopId on another statement is 400";
  - "edge: assist after complete writes no event".
- **Todo removals:** `F1c-T03` (SC-003), all 25 `F1c-T04`, `F1c-T12` (SC-012) and the `F1c-T13` markers above. The `F1c-T07`, `T08` and `T11` markers stay.
- **Acceptance (the SHIP conditions above):**
  - `npm test` passes with `# fail 0`, and no `F1c-T03`, `F1c-T04`, `F1c-T12` or `F1c-T13` todo remains;
  - SC-003 passes on the enlarged set, and SC-012 passes;
  - US1.5, US1.11 and FR-050 pass;
  - golden replay: 0 diffs;
  - **real-browser re-check** (the qa-report harness, text and voice, 390 and 1280 px):
    - US1.13/US2.10, the skip path, shows and speaks `missed.notGraded` (FR-035 probe), and no "Missed:" line for that statement;
    - US1.15/US2.11, the self-rating failure;
    - **0 console errors, with no filter**, including the first fresh context on `/practice.html` (PD-8);
    - T05's 390/1280 px record (O2).
  - QA appends a `DECISION` to thread 0007 with separate Functional and AI-quality verdicts.
- **Tests that prove it:** the named tests above, plus the quoted `npm test` and golden replay output in `qa-report.md` "Wave A.1".

---

## Wave B: voice, other modes and progress (backend), e2e

### F1c-T17 [P] Practice page: one skip per statement; a refused request gets `err.rejected` and a way back (F1c-B23, inv. 7)
- **Owner:** frontend-engineer · **Size:** M · **Depends on:** F1c-T14 (merged; same files). **Gate:** must merge before F1c-T11 merges and before F1c-T01b runs and merges. F1c-T06 starts after it (same files).
- **Files:** modify `web/practice/app.js`, `web/practice/state.js`, `web/practice/copy.js`, `web/practice.html`, `tests/practice-web-state.test.js`
  - `web/practice/api.js` is **not** changed: `ApiError` (with `status`) and `NetworkError` already exist and are imported from it. No server file changes: the FR-009a rule stays as it is.
- **Interfaces:**
  - **Consumes:** `ApiError` and `NetworkError` from `web/practice/api.js` (unchanged); the T14 `S.skipped`, `completeRequest`, `netError({skip, retry})`, `say()` and `openPicker()`; `pickTrack(id)` (existing, in `app.js`).
  - **Produces, `state.js` (pure, Node-importable, no `window`):**
    - `recordSkip(skipped: {statementId: string, elapsedMs: number}[], entry: {statementId: string, elapsedMs: number}) → {statementId, elapsedMs}[]` (FR-059). Returns a **new** array and never mutates its input.
      - A `statementId` not yet in the list is appended.
      - A `statementId` already in the list keeps its position. Its `elapsedMs` becomes the new value only if that is smaller. An `elapsedMs` that isn't a finite number counts as larger than any finite one.
      - An entry whose `statementId` isn't a non-empty string returns a copy of the list unchanged.
    - `errorKind(err: unknown) → 'rejected' | 'net'` (FR-060): `'rejected'` exactly when `err instanceof ApiError` and `400 ≤ err.status ≤ 499`; otherwise `'net'`. It imports `ApiError` from `./api.js` and never reads `err.message`.
  - **Produces, `copy.js`:** adds `err.rejected` and `btn.picker`, with exactly the spec copy-table text:
    - `err.rejected`: `The server can't continue this exercise, and trying again won't help. Say "back" or press Back to exercises.`
    - `btn.picker`: `Back to exercises`
  - **Produces, `practice.html`:** one new panel, directly after `#net-error`:
    ```html
    <section id="rejected" class="practice-panel error" role="alert" hidden>
      <p id="rejected-msg"></p>
      <div class="row"><button id="picker-btn" class="primary" type="button"></button></div>
    </section>
    ```
    Every existing id is unchanged. `#picker-btn`'s label is set from `COPY['btn.picker']` with `textContent` when the panel is shown.
  - **Produces, `app.js`:**
    - `onSkip`: `S.skipped = recordSkip(S.skipped, {statementId: S.stop.statementId, elapsedMs: S.stop.elapsedMs})` replaces the `push`.
    - `rejected() → Promise<void>`: `S.gen++`; `S.phase = 'rejected'`; hides `#net-error`, `#answer-panel`, `#feedback-panel`, `#stop-btn`, `#stop-hint` and `#assist-btn`; shows `#rejected`; sets the `#picker-btn` label; focuses `#picker-btn`; returns `say($('rejected-msg'), COPY['err.rejected'])` (shown and spoken, FR-035). F1c-T06 arms the voice "back" command when this promise resolves.
    - `complete()` catch: `errorKind(err) === 'rejected' ? rejected() : netError({skip: false, retry: complete})`.
    - `submitStop()` catch: `errorKind(err) === 'rejected' ? rejected() : netError({skip: true, retry: submitStop})`. `S.pending` is cleared in both cases.
    - `backToPicker()`, wired to `#picker-btn` click: hides `#rejected`, calls `openPicker()`, then `pickTrack(S.track)`, so the exercise list is re-fetched (a pack version may have changed).
    - `openPicker()`'s hidden-panel list gains `'rejected'`.
  - **DOM (QA's e2e depends on these):** `#rejected`, `#rejected-msg`, `#picker-btn`.
- **Acceptance:**
  - **FR-059:** after any number of skips, `S.skipped` holds at most one entry per statement, with the smallest `elapsedMs`. The `complete` body therefore never exceeds the narration length.
  - **FR-060:** a 4xx at `complete` or at a stop shows `err.rejected` in `#rejected` and never `err.net`; no Try again or Skip is shown; Back to exercises opens the picker with the exercise list re-fetched. A `NetworkError` or a 5xx keeps `err.net` with Try again (and Skip at a stop), unchanged.
  - **FR-035:** in voice mode, the `speak()` argument for `err.rejected` equals `#rejected-msg`'s normalized `textContent`.
  - US1.16, US1.17 (text) and US2.13 (voice, button half; the "back" voice command is F1c-T06's).
  - No `innerHTML`; all text through `textContent`. No change to `web/index.html` or `web/app.js` (Untouched list).
  - **QA verification (closes F1c-B23; SC-013):** QA re-runs, against the real server in text and voice mode at 390 px and 1280 px, and records in `qa-report.md` under "F1c-B23":
    - the scratch scenario `bug-21-skips-text-1280` and its voice and 390 px twins: 21 failed stops on `s1`, each skipped, then the set runs out. Expected: exactly 1 `complete` request, status 200, `skipped` with exactly 1 entry for `s1`, and the reveal shown; 3 of 3 runs;
    - **a mid-exercise pack-version 404:** start `catch-lines` from a temporary copy of the fixture packs, stop the server, bump that pack's `version` in `practice.json`, restart on the same `DB_PATH`, then (i) press Stop and submit, and (ii) in a second attempt, let the set run out. Expected in both: the request returns 404, `err.rejected` is shown (and spoken, equal to the shown text, in voice mode), `#net-error` is never shown, no further request goes to that attempt, and `#picker-btn` opens the picker in 1 action, from which a new attempt starts (200);
    - a forced `NetworkError` and a forced 500 at `complete`: `err.net` with Try again, as before.
- **Tests that prove it:** `tests/practice-web-state.test.js`:
  - "recordSkip keeps one entry per statement with the smallest elapsedMs, in first-skip order" (example: skips `s1@900`, `s2@50`, `s1@300`, `s1@1200` → `[{s1, 300}, {s2, 50}]`);
  - "recordSkip never mutates its input; a non-finite elapsedMs never replaces a finite one; a missing statementId changes nothing";
  - "21 skips on one statement give one entry; one skip on each of 20 statements gives 20 entries";
  - "the client skip list fits the server cap: MAX_SKIPPED ≥ LIMITS.narration" (source check: reads `server/services/practice.js` and `server/services/practice-pack.js` as text, extracts `MAX_SKIPPED = <n>` and the `narration: <n>` entry of `LIMITS`, fails if either isn't found, and asserts the first ≥ the second; no server import);
  - "errorKind: ApiError 400, 404, 409 and 499 are rejected; ApiError 500 and 503, NetworkError, a plain Error and undefined are net";
  - "practice.html has a hidden #rejected panel with #rejected-msg and #picker-btn" (source check);
  - old → new: "copy strings equal the spec table": the frozen expected object gains `err.rejected` and `btn.picker`.
  - **Manual real-browser check, recorded in the PR, in text and voice mode at 390 and 1280 px:** a forced 404 at `complete` and at a stop (DevTools request override) shows `err.rejected` and Back to exercises reaches the picker; a forced 500 and offline still show `err.net`; 0 console errors on a fresh load other than the deliberate failures.
- **Notes:**
  - The fix is client-only. The server rule (at most 20 entries, else 400) stays, per the architect.
  - Keep the request classification in `errorKind` only: `app.js` doesn't compare `status` itself (CLAUDE.md "typed error classes").
  - The voice commands ("back", and OQ-7's "try again" and "skip") are F1c-T06's, because `commands.js` and the recognizer arrive there.

### F1c-T01b [P] Acceptance tests, browser level (e2e)
- **Owner:** qa-engineer · **Size:** M · **Depends on:** F1c-T01a (accept-pack), F1c-T05 (DOM ids), F1c-T15 (same fixture file). **Revision 4:** may be written now; its verdict run and merge wait for F1c-T17 (the F1c-B23 gate).
- **Files:** create `tests/e2e/F1c.e2e.mjs`; modify `tests/fixtures/practice/labelled-answers.json`
- **Interfaces:**
  - Consumes: the T05, T06, T09 and T10 DOM ids; `tests/golden/browser-stubs.js`, reused and not edited. If it lacks a `SpeechRecognition` stub, define one inline in this file that emits scripted interim and final segments (per-result `isFinal`).
  - Uses the F1a timing contract (`page.clock`, held utterances, DOM-keyed actions).
- **Acceptance:** US1 (text) and US2 (voice), plus the voice/text halves of US3–US6 as `todo` until T09 and T10. Covers SC-005, SC-006, SC-007 and SC-011, and the injected-error half of SC-013 (revision 4), with 0 console errors at 390 px and 1280 px.
- **Tests that prove it:**
  - "US2.1 hotword cancels speech within 300 ms, interrupted statement kept";
  - "US2.2 typing stops dictation, nothing auto-submits";
  - "US2.3 'send' submits without the word";
  - "US2.4 corrected statement spoken then resume";
  - "US2.6 hotword inside statement text needs the bare phrase";
  - "US2.7 mic denied falls back to text";
  - "US2.9 'next' at the reveal starts the next exercise";
  - "US1.10 network abort keeps the answer, Try again idempotent";
  - "US1.12 Next button opens the next exercise";
  - "US1.13 / US2.10 skipped stop is shown as not scored, never Missed, and spoken as shown" (`todo: 'F1c-T14'` until T14 merges);
  - "US1.15 / US2.11 a failed self-rating shows err.rate and Try again succeeds" (`todo: 'F1c-T14'` until T14 merges);
  - "SC-011 hands-free: catch, next, review with 0 clicks after Start" (`todo: 'F1c-T10'`);
  - **revision 4 (F1c-T17; no `todo`, because T17 merges first):**
    - "US1.16 / US2.13 a 4xx at complete shows err.rejected, never err.net, and Back to exercises opens the picker" (route-level 404 injection; voice twin asserts the spoken text equals `#rejected-msg`);
    - "US1.16 a 4xx at a stop shows err.rejected; a 500 and a network abort still show err.net with Try again";
    - "US1.17 21 skips on one statement send one skipped entry and reach the reveal";
  - **revision 4 (F1c-T06):** "US2.13 'back' after err.rejected has been spoken opens the picker" and "US2.14 'try again' and 'skip' at err.net act only after err.net has been spoken" (`todo: 'F1c-T06'` until T06 merges);
  - each with its text-mode twin where the spec lists one.
- **Notes:**
  - Runs outside `npm test` (`node tests/e2e/F1c.e2e.mjs`, `MOCK=1`).
  - **`PRACTICE_PACKS_DIR` is a folder of packs (F1c-B22):** copy `tests/fixtures/practice/accept-pack` to `<tmp>/kite-craft` (as `acceptPacksDir()` in `tests/acceptance/practice-helpers.mjs` does) and set `PRACTICE_PACKS_DIR=<tmp>`. Pointing it at `accept-pack` itself loads 0 tracks, silently.
  - **SC-005 console check (PD-8):** count every console error from the first fresh browser context on `/practice.html`, with no filter. Aborts the test injects on purpose are asserted in their own test and kept out of SC-005's count.
  - Add one real dictated answer per SC-003 class to `labelled-answers.json` (tag `dictated`), per the architect's dictation RISK in thread 0007. If one of them breaks FR-019, report it in thread 0007 for the PM (PD-4 revisit). This is the one fixture edit T01b makes, after F1c-T15.

### F1c-T06 [P] Voice for catch: hotword, barge-in, editable dictation, command parser
- **Owner:** frontend-engineer · **Size:** M · **Depends on:** F1c-T05, F1c-T14, F1c-T17 (shared `web/practice/*` files; T17's `#rejected` panel and `rejected()` promise) (ARCH-6 ruled, ADR 0008)
- **Files:** create `web/practice/voice.js`, `web/practice/commands.js`, `tests/practice-web-commands.test.js`; modify `web/speech.js`, `web/practice/app.js`, `web/practice.html`, `web/practice/copy.js`, `web/practice/practice.css`
  - `web/speech.js` (C8): exactly one additive change, an optional `onSegment({text, isFinal})` callback in `listen()`, called once per recognition result. No other line changes; `web/app.js` doesn't pass it.
  - `web/practice.html`: `#mic-btn`, `#mic-msg`. `web/practice/copy.js`: `mic.denied`.
- **Interfaces:**
  - Consumes: `listen` (with `onSegment`), `canListen`, `speak` and `stopSpeaking` through `web/practice/speech.js` (unchanged: it re-exports `listen`, so the new option passes through).
  - Produces:
    - **`web/speech.js`:** `listen({onInterim, onSegment} = {}) → {result: Promise<string>, stop()}`; `onSegment({text: string, isFinal: boolean})` per result; everything else unchanged.
    - **`commands.js` (pure; every command in the spec table, including C11):**
      - `isHotword(segment: string, statementText: string) → boolean` (FR-032; phrases "stop", "hold on");
      - `parseCommand(segment: string, state: 'narrating' | 'answering' | 'feedback' | 'reveal' | 'done' | 'clarifying' | 'progress' | 'net-error' | 'net-error-stop' | 'rejected') → null | {cmd: 'stop' | 'send' | 'done' | 'continue' | 'rate' | 'next' | 'ready' | 'review' | 'diagnostic' | 'retry' | 'skip' | 'picker', rating?: Rating}`. States and commands exactly as the spec's voice-command table ("had it" / "partly" / "missed it" → `rate` in `reveal`). **Revision 4 (OQ-7, PD-10, FR-061):**
        - `'net-error'` (a failed `complete`): "try again" → `{cmd: 'retry'}`;
        - `'net-error-stop'` (a failed stop, `#skip-btn` visible): "try again" → `{cmd: 'retry'}`, "skip" → `{cmd: 'skip'}`;
        - `'rejected'`: "back" or "back to exercises" → `{cmd: 'picker'}`;
        - each only on a final segment that, normalized exactly as for "send" (FR-034), equals the phrase (the FR-032 bare-phrase rule); `null` for anything else.
      - `errorCommandState({panel: 'net' | 'rejected', skip: boolean, spoken: boolean}) → 'net-error' | 'net-error-stop' | 'rejected' | null` (revision 4, the echo guard): `null` while `spoken` is false; otherwise `'rejected'` for `panel: 'rejected'`, `'net-error-stop'` for `panel: 'net'` with `skip: true`, and `'net-error'` for `panel: 'net'` with `skip: false`.
      - `stripCommand(text: string) → string`.
    - **`voice.js`:**
      - `startHotword({getStatementText, onStop}) → {stop()}`, active only while narrating;
      - `startDictation({onText, onCommand}) → {stop()}`, with fallback to text after 3 consecutive recognizer errors;
      - `startCommands({state: () => string, onCommand}) → {stop()}`: listens for state commands in `reveal`, `done`, `progress`, and (revision 4) `net-error`, `net-error-stop` and `rejected`.
  - Wires "next" in `reveal` and `done` to the same handler as `#next-btn` (FR-058).
  - **Revision 4 wiring (FR-061), in `app.js`:**
    - `netError()` records `spoken: false`, and sets it to `true` when its `say()` promise for `err.net` resolves; T17's `rejected()` promise does the same for `err.rejected`. The command state is `errorCommandState(...)` while either panel is shown. Hiding the panel (any button, or a command) ends that state, so a late-resolving utterance never arms a hidden panel.
    - `retry` runs the same handler as `#retry-btn`; `skip` the same as `#skip-btn`; `picker` the same as `#picker-btn` (`backToPicker()`, F1c-T17).
    - The copy is unchanged (`err.net` already names both words; `err.rejected` names "back").
- **Acceptance:** US2.1–US2.9 and US2.12; FR-030–FR-038 (voice half), FR-058 (voice "next"). `stopSpeaking()` is called synchronously in the stop handler, and `stopLatencyMs` is measured with `performance.now()`. Golden replay shows 0 diffs after this ticket.
  - **W-S2, moved here from the Wave A code review (spec PD-8 deferrals):** STOP (hotword, button or Space) is accepted while `end.catch` is spoken (`phase === 'ending'`). `#stop-btn` stays visible until `complete` is called. The stop is posted for the last statement with `elapsedMs` measured from that statement's start and a fresh `stopId`, and the pending `complete` is cancelled until narration ends again.
  - Every new stop keeps the F1c-T14 `stopId` behavior (one `newStopId()` per press; Try again re-sends it).
  - **Revision 4 (OQ-7 closed, PD-10, FR-061; architect ruling, inv. 8):** US2.13 (voice half) and US2.14. In voice mode, "try again" retries and "skip" skips at `err.net`, and "back" / "back to exercises" opens the picker at `err.rejected`, each exactly as its button. None of them acts while its panel's message is still being spoken, or inside a longer segment. "skip" never acts when `#skip-btn` is hidden.
- **Tests that prove it:** `tests/practice-web-commands.test.js`:
  - "stop / hold on detected in narrating only";
  - "hotword inside statement text needs the bare phrase";
  - "send and send it only as a whole final segment";
  - "done stops without submit";
  - "had it / partly / missed it map to ratings in reveal";
  - "next in reveal and done only";
  - "continue in feedback and reveal";
  - "ready in clarifying only";
  - "review and diagnostic in progress only";
  - "commands ignored outside their state";
  - "web/speech.js diff adds only the onSegment option" (source check: `listen` still works without it).
  - **Revision 4 (OQ-7, the architect's named tests, plus the B23 way out):**
    - "try again retries in net-error and net-error-stop only, as a whole final segment";
    - "skip skips in net-error-stop only, as a whole final segment";
    - "back and back to exercises open the picker in rejected only, as a whole final segment";
    - "a segment containing 'try again' inside a longer sentence does nothing" (e.g. "let me try again later" → `null` in `net-error-stop`; the same for "skip that one" and "go back a bit" in their states);
    - "errorCommandState arms only after the error message has been spoken" (`spoken: false` → `null` for every panel; then `'net-error'`, `'net-error-stop'` and `'rejected'` as specified).
  - The real-browser check also covers US2.12: a Space press during `end.catch` on an exercise whose last statement is planted gives a hit on it.
  - **Revision 4 real-browser check (voice, recorded in the PR):** with the stop request failing, saying "try again" while `err.net` is still being spoken does nothing, and saying it after does re-post the same `stopId`; "skip" after the utterance skips; with a forced 404 at `complete`, "back" after `err.rejected` has been spoken opens the picker.
  - `node tests/golden/run.mjs --replay`: 0 diffs.
  - The real-browser check (Chrome) is recorded in voice and text mode.

### F1c-T07 [P] Learn, interview, scenario, follow-up and transfer API
- **Owner:** backend-engineer · **Size:** M · **Depends on:** F1c-T04, F1c-T13 (shared `server/services/practice.js`)
- **Files:** modify `server/services/practice.js`, `server/routes/practice.js`; create `tests/practice-modes.test.js`
- **Interfaces:**
  - Consumes: T03's `matcherGrade` and `matchClarification`.
  - Produces:
    - `POST /api/practice/attempts/:id/answers {part, answer}`:
      - main parts (in order) return `{part, next: {part, prompt} | null}`;
      - `followUp` and `transfer` (after complete) return `{part, result: Dim | null, rubric: string[] | null}`.
      - a string `followUp` or string `followUps:i` is stored with `graded.result.dimensions = {}` and `overall: null`; its response result is `null`.
    - `POST /api/practice/attempts/:id/clarifications {question} → {reveal: string | null}` (scenario only, before `design`).
    - `complete` extended to every type; `answered[]` items carry `rubric` per part type (`null` for string follow-ups). Interview and scenario also return `rubricFull: {mustCover, strongSignals, redFlags}`, `strongSignalsMatched`, `redFlagsMatched` (un-negated only) and `architectureId`; scenario returns `architectures: [{id, summary, strengths, tradeoffs}]`.
    - `self-ratings` accepts every answered part; for a string follow-up `matcherStatus` is `null`.
  - Part-to-dimension mapping:
    - `teachBack:i` → explanation;
    - `interview` → explanation (mustCover);
    - `design` → explanation (FR-043; no `mustInclude` anywhere → mustCover status);
    - rubric-bearing `followUps:i` and `challenges:i` → defense;
    - rubric-bearing `followUp` → tradeoffs;
    - `transfer` → transfer.
- **Acceptance:** FR-040–FR-043, FR-022, US3–US5 at the API level, FR-004 for `next`, `firstPrompt` and the clarification `reveal`.
- **Tests that prove it:**
  - "learn teach-back parts in order; out of order 400; repeat identical";
  - "main-part responses carry no result";
  - "followUp before complete 400";
  - "string followUp result null";
  - "string followUps:i result null, self-rated with matcherStatus null";
  - "interview red flag uncertain; negated red flag not counted";
  - "scenario clarification reveal once-matched, none otherwise";
  - "clarification after design 400";
  - "design is min(mustCover, best architecture); no mustInclude equals mustCover";
  - "complete reveals rubricFull and architectures only after complete".

### F1c-T08 [P] Progress, mastery, readiness, schedule, review and diagnostic API
- **Owner:** backend-engineer · **Size:** M · **Depends on:** F1c-T04 (ARCH-8 ruled, ADR 0002 Amendment 3)
- **Files:** create `server/services/practice-progress.js`, `server/routes/practice-progress.js`, `tests/practice-progress.test.js`; modify `server/index.js`, `server/db.js`, `tests/db.test.js`
  - `server/index.js`: register the route after `practice.js`.
  - `server/db.js`: add `eventsForEngine({actor, engine}) → Event[]` = `SELECT … WHERE actor = ? AND json_extract(context_json, '$.engine') = ? ORDER BY seq`. No index and no migration (C9).
- **Interfaces (produces):**
  - `projectPractice(events: Event[], track: Track, exercises: Map<string, Exercise>) → ProgressBody` (pure; C14). It keeps only events whose `context.subject` matches `^<track.id>@`. Events for exercise ids absent from `exercises` are left out of mastery and readiness, and counted in `counts` (C9).
  - Readiness per spec FR-053/FR-054 (PD-1): `failureModesTradeoffs` = a rubric-bearing `followUp` `tradeoffs` met, or `defense` met on ≥ 2 distinct gradable defense parts (`challenges:i`, rubric-bearing `followUps:i`); `defendDecision` = ≥ 1. String follow-ups never count and never make a criterion satisfiable.
  - `GET /api/practice/tracks/:track/progress → ProgressBody`:
    ```
    { track, provisional: true,
      concepts: [{ id,
        independent: {score: number | null, n, level: 'none' | 'learning' | 'developing' | 'strong'},
        assisted:    {score: number | null, n, level},
        readiness: {explainUnaided, detectAndCorrect, transfer, failureModesTradeoffs, defendDecision} }],  // each true | false | 'n/a'
      flagged: [{attemptId, exerciseId, part, at, selfRating: Rating | null}],
      counts: {attempts, completed, falseInterruptions, outOfVersion} }
    ```
  - `GET /api/practice/tracks/:track/schedule → {days, minutesPerDay, today, diagnostic: [{id, done}], plan: [{day, blocks: [{kind, minutes, exercises: [{id, done}]}]}]}`; `done` = a practice `completed` event exists for that exercise id.
  - `GET /api/practice/tracks/:track/review → {items: [{concept, score: number | null, exerciseId}]}` (≤ 3).
- **Acceptance:** FR-051–FR-057, SC-009, FR-004 (schedule and progress responses pass `practiceLeakScan` with `LEAK_ALLOW`).
- **Tests that prove it:**
  - "assisted and independent never merge";
  - "uncertain excluded from mastery and listed in flagged";
  - "level thresholds";
  - "readiness criteria each and n/a when no exercise can satisfy";
  - "failureModesTradeoffs from 2 scenario challenges met; defendDecision from 1; string follow-ups give n/a" (PD-1);
  - "explainUnaided ignores learn teach-back";
  - "detectAndCorrect needs 2 distinct statements";
  - "events of another track or an exercise absent from the current version are excluded and counted" (C9);
  - "today counts distinct UTC dates, capped at days";
  - "review picks weakest concept, least recent exercise";
  - "projection equals frozen body; identical after reopen of the same DB file".
  - `tests/db.test.js`: "eventsForEngine filters by actor and engine in seq order"; "a missing context.engine is not returned for engine 'practice'".

### F1c-T11 [P] Move reviewed module-1 content into packs/applied-ai
- **Owner:** backend-engineer · **Size:** S · **Depends on:** F1c-T02, F1c-T03, F1c-T12 (SC-003b runs on `matcher@2`); OQ-1 sign-off, the 7-day plan and ≤ 6 diagnostic ids (PM + learning-designer, C12) and the content author's answer to OQ-6, each recorded in thread 0007. **Merge** also waits on the founder's ARCH-2 confirmation (OQ-5) in thread 0007, and (revision 4) on F1c-T17 having merged (the F1c-B23 gate: T11 is when the founder starts on real content, and pack edits mid-attempt cause the 404 that B23 turns into a stall).
- **Gate status (revision 5, 2026-10-14): all gates cleared; T11 may start.** Each is recorded in thread 0007:
  - OQ-1 sign-off: cleared (lead DECISION; the learning-designer's REVIEW.md plus `verified: false` labels; the founder does not fact-check).
  - 7-day plan and ≤ 6 diagnostic ids: cleared (PM DECISION, spec PD-11). Copy its `schedule.json` block exactly.
  - OQ-6: cleared (lead DECISION as content author: the two PD-1 rubrics and the synonym list are accepted, so the "Content additions" below apply).
  - Merge, OQ-5 / ARCH-2: cleared (founder DECISION, "Yes, go ahead").
  - Merge, F1c-T17: cleared (architect APPROVED, commit 23aa509; it awaits the human merge like the rest of the branch, so T11 lands after it on the same branch).
  - Code dependencies F1c-T02, T03 and T12 are done (architect and QA approvals in thread 0007).
- **Files:** create `packs/applied-ai/practice.json`, `packs/applied-ai/schedule.json`, `packs/applied-ai/exercises/*.json`, `packs/applied-ai/reference/*.md`, `tests/practice-content.test.js`
- **Interfaces:** consumes `validatePracticePack`, `loadPracticePacks` and `matcherGrade`; copies from `docs/research/applied-ai/module-1/`, which is read, never edited.
- **Format mapping only (C12):**
  - `verified`: a string starting `fetched-` → `true`; anything else → `false`; the original string goes in `note`.
  - `challenges`: `challenge` → `question`, `expected` → `rubric`.
  - architecture `id` = the slug of `name` (lowercase, non-alphanumerics → `-`, trimmed); `name` dropped; `strengths`, `tradeoffs` kept.
  - module id `m1`; reference files renamed to `<referenceId>.md`.
  - `practice.json` built from the thread 0007 records; `schedule.json` copied exactly from the PM DECISION of 2026-10-14 (spec PD-11).
  - `diagnostic.json` and `_matcher-test-answers.json` are not copied.
- **Content additions (the author agreed in thread 0007, OQ-6; PD-1):**
  - catch-06 `followUp` → `{question: <existing text>, rubric: ["both stages can contribute", "right chunk ranked low|buried mid-context", "fix ranking and prompt evidence order"]}`;
  - catch-08 `followUp` → `{question: <existing text>, rubric: ["measure recall@k|hit rate", "measure answer quality|faithfulness", "latency and cost per query"]}`;
  - `practice.json` `lexicon.synonyms` = the learning-designer's draft list (`_matcher-test-answers.json`), with forms that fail FR-017 word-start matching dropped and listed in the PR.
- **Acceptance:**
  - `packs/applied-ai` validates with 0 problems.
  - Module `m1` has ≥ 1 exercise of each type and ≥ 1 zero-planted catch.
  - The schedule has 7 days × 120 min, practice ≥ 60%, and a non-empty `diagnostic` of ≤ 6 ids. For this pack: deep-equal to the thread 0007 block (practice 780/840, the 6 diagnostic ids in order).
  - Every source whose draft `verified` isn't `fetched-*` has `verified: false` and its original string in `note`.
  - SC-003b passes (QA removes the `F1c-T11` todo when verifying).
  - `listSubjects()` from `server/packs.js` is unchanged (C3).
- **Tests that prove it:** `tests/practice-content.test.js`:
  - "applied-ai validates";
  - "each type present";
  - "zero-planted present";
  - "schedule defaults";
  - "verified mapping keeps the original string in note";
  - "planted/clean partitions equal the drafts" (no statement moved);
  - "loader stores applied-ai@1 once".
- **Notes:** content edits beyond format and the additions above need the author's agreement in thread 0007. `docs/research/**` is founder-owned and is read, not edited.

---

## Wave C: the remaining screens

### F1c-T09 Learn, interview, scenario, follow-up and transfer screens
- **Owner:** frontend-engineer · **Size:** M · **Depends on:** F1c-T06, F1c-T07
- **Files:** create `web/practice/modes.js`, `tests/practice-web-modes.test.js`; modify `web/practice/app.js`, `web/practice.html`, `web/practice/api.js`, `web/practice/copy.js`, `web/practice/practice.css`
  - `web/practice/api.js`: `postAnswer`, `postClarification`. `web/practice/copy.js`: `q.*`, `sc.*`, `clarify.none`, `done`, `intro.learn`.
- **Interfaces:**
  - Consumes: T07's routes; T06's `parseCommand` (`continue` in `reveal` → the follow-up; `next` in `reveal` and `done`).
  - Produces:
    - `modes.js` (pure): `promptText(next, exerciseType) → string` (copy `q.*` / `sc.*`) and `clarifyText(reveal) → string`;
    - DOM ids: `#question-text`, `#customer-log`, `#clarify-input`, `#clarify-btn`, `#ready-btn`. The answer panel ids are reused.
- **Acceptance:** US3–US5 in voice and text mode. Follow-up and transfer run after every catch reveal via "continue" / Continue; "next" / Next skips them. String follow-ups show no result and offer self-rating. No Stop control or hotword in learn mode. `done` is followed by `next.hint`. FR-035 for every prompt.
- **Tests that prove it:** `tests/practice-web-modes.test.js`:
  - "promptText per part type equals copy table";
  - "clarifyText reveal vs none";
  - "sc.brief joins constraints with '; '".
  - The real-browser check is recorded in both modes.

### F1c-T10 Progress, schedule, diagnostic and review screen
- **Owner:** frontend-engineer · **Size:** M · **Depends on:** F1c-T08, F1c-T09
- **Files:** create `web/practice/progress.js`, `tests/practice-web-progress.test.js`; modify `web/practice/app.js`, `web/practice.html`, `web/practice/api.js`, `web/practice/copy.js`, `web/practice/practice.css`
  - `web/practice/api.js`: `fetchProgress`, `fetchSchedule`, `fetchReview`. `web/practice/copy.js`: `progress.provisional`, `progress.commands`, `btn.review`, `btn.diagnostic`, `review.empty`, `plan.done`, plus the level and criteria labels below.
- **Interfaces:**
  - Consumes: T08's routes; T06's `startCommands` and `parseCommand` (`review`, `diagnostic` in `progress`).
  - Produces:
    - `progress.js` (pure):
      - `conceptRows(body) → {id, independent, assisted, criteria: {label, value: 'Met' | 'Not yet' | 'n/a'}[]}[]`;
      - `todayLines(schedule) → string[]`;
      - `nextInPlan(schedule) → {kind: 'exercise', id: string, mode: 'practice' | 'diagnostic'} | {kind: 'review'} | null`: walks today's blocks in order and returns the first exercise not done (a `diagnostic` block yields the first `diagnostic[]` entry not done, with `mode: 'diagnostic'`; a `review` block yields `{kind: 'review'}` once per day); `null` when nothing is left.
      - `firstDiagnostic(schedule) → string`: the first `diagnostic[]` id not done, else the first id.
    - DOM ids: `#progress`, `#today-plan`, `#concept-table`, `#flagged-list`, `#review-btn`, `#diagnostic-btn`, `#provisional-note`, `#progress-commands`.
  - **Next (FR-058):** `#next-btn` and voice "next" now start `nextInPlan(schedule)`; `{kind: 'review'}` starts the first review item with `mode: 'review'` (or speaks `review.empty` and continues the walk); `null` speaks `plan.done` and opens the progress page. If the schedule request fails, the picker opens.
  - Labels:
    - levels: "Not started", "Learning", "Developing", "Strong";
    - criteria: "Explains unaided", "Detects and corrects", "Transfers", "Failure modes and trade-offs", "Defends a decision".
  - Independent and assisted columns are always separate.
- **Acceptance:** US6.1–US6.7 in voice and text mode; FR-058 (plan-aware next, review and diagnostic by voice). Diagnostic attempts are started with `mode: 'diagnostic'`, and `#assist-btn` is hidden.
- **Tests that prove it:** `tests/practice-web-progress.test.js`:
  - "conceptRows keeps assisted separate";
  - "n/a rendered as n/a";
  - "todayLines for day 1 lists diagnostic first";
  - "nextInPlan: first undone exercise, diagnostic mode for the diagnostic block, review block once, null when finished";
  - "firstDiagnostic returns the first undone id, else the first";
  - "provisional note and progress commands text equal copy".
  - The real-browser check is recorded in both modes.

## Ticket summary
| Ticket | Owner | Size | Depends on | Wave |
|---|---|---|---|---|
| F1c-T01a [P] | qa-engineer | M | none | A |
| F1c-T02 [P] | backend-engineer | M | none | A |
| F1c-T03 [P] | backend-engineer | M | none | A |
| F1c-T04 | backend-engineer | M | T02, T03 | A |
| F1c-T05 | frontend-engineer | M | T04 (contract) | A |
| F1c-T12 [P] | backend-engineer | S | none; merge after T13 and T15 | A.1 |
| F1c-T13 [P] | backend-engineer | M | none | A.1 |
| F1c-T14 [P] | frontend-engineer | M | T13 (contract only) | A.1 |
| F1c-T15 [P] | qa-engineer | S | none; merges before T12 | A.1 |
| F1c-T16 | qa-engineer | M | T15; todo removal after T12, T13, T14 | A.1 |
| F1c-T17 [P] | frontend-engineer | M | T14; gate: merges before T11 merges and before T01b runs/merges | B (first, frontend lane) |
| F1c-T01b [P] | qa-engineer | M | T01a, T05, T15; verdict run and merge after T17 | B |
| F1c-T06 [P] | frontend-engineer | M | T05, T14, T17 ([P] with T07, T08, T11, T01b; never with T17) | B (after T17) |
| F1c-T07 [P] | backend-engineer | M | T04, T13 | B |
| F1c-T08 [P] | backend-engineer | M | T04 | B |
| F1c-T11 [P] | backend-engineer | S | T02, T03, T12, thread-0007 content gates; merge: founder ARCH-2 and T17 (revision 5: all cleared) | B (ready) |
| F1c-T09 | frontend-engineer | M | T06, T07 | C |
| F1c-T10 | frontend-engineer | M | T08, T09 | C |

**[P] collision check:**
- **Wave A:** T01a touches only `tests/acceptance/*`, `tests/fixtures/practice/accept-pack/**`, the two labelled-answer files, the guardrail files and `deny-list.json`. T02 touches `server/services/practice-pack.js`, `server/packs.js`, `tests/practice-pack.test.js`, `tests/pack.test.js` and `tests/fixtures/practice/pack-basic/**`. T03 touches only its two new files. No overlap.
- **Wave A.1:** No file overlap:
  - T12 touches only `server/services/practice-matcher.js` and `tests/practice-matcher.test.js`.
  - T13 touches only `server/services/practice.js` and `tests/practice-catch.test.js`.
  - T14 touches only `web/practice/{app,state,copy}.js`, `web/practice.html` and `tests/practice-web-state.test.js`.
  - T15 touches the two labelled-answer files, `tests/acceptance/F1c.test.js` and `qa-report.md`.
  - T16 shares `tests/acceptance/F1c.test.js` and `qa-report.md` with T15, so it runs after T15 (not [P]).
  - The only cross-ticket coupling is a merge-order one: T12 changes the grader version that T13's tests read through `MATCHER_VERSION`, so T13 merges first.
- **Wave B:** T17 touches `web/practice/{app,state,copy}.js`, `web/practice.html` and `tests/practice-web-state.test.js`. T06 touches `web/practice/*`, `web/speech.js` and its new test. T07 touches `server/services/practice.js`, `server/routes/practice.js` and its new test. T08 touches the new `practice-progress` files, `server/index.js`, `server/db.js` and `tests/db.test.js`. T11 touches `packs/applied-ai/**` and its new test. T01b touches its one new file and `labelled-answers.json`. **T17 and T06 share `web/practice/app.js`, `copy.js` and `practice.html`, so T06 is not [P] with T17 and runs after it (revision 4).** T17 has no overlap with T07, T08, T11 or T01b (T17's source check only reads two server files). No other overlap.

## Bugs (QA appends)

## Bugs

*Filed by backend-engineer while building F1c-T03 (2026-10-13).*

### F1c-B10 [minor] catch-01's correction rubric repeats the flawed statement
- Its first alternative ("bigger window means more input fits") nearly matches the misconception, so an incorrect answer earns correction partial. · Owner: content author (T11)

### F1c-B11 [major] FR-021(a) "uncertain" applies per dimension, so one missed dimension makes the whole answer uncertain
- This causes most valid-alternative answers to come out uncertain (catch-01, catch-04, catch-06, catch-08). · Owner: technical-product-manager, with principal-architect

### F1c-B12 [major] Lexicon and rubric gaps fail valid alternative wordings
- E.g. "faithful" vs "faithfulness", "old", "near", "junk", "pricier". Only 1 of 6 valid alternatives in module 1 is met today, against SC-003's ≥ 75%. · Owner: content author + learning-designer (T11 lexicon)

### F1c-B13 [minor] Prefix-only matching: "faithful" doesn't hit "faithfulness"
- Accepted limit; fix through the lexicon. · Owner: content author

**Matcher rules the spec didn't spell out** (principal-architect to confirm at code review): the negation window counts every word and stops at `. ; : ! ?`; the PD-2 exception covers red flags and strong signals; red flags and echoes make every dimension uncertain; lexicon lookups go one way; 4-letter plurals are stripped.

*Filed by qa-engineer while finishing F1c-T01a (2026-10-14).*

### F1c-B20 [major] FR-019 stuffing cap marks concise correct answers `partial`; SC-003 fails (clear → met 80%, valid-alternative → met 50%)
- **Steps:** `node --test --test-name-pattern="SC-003 labelled" tests/acceptance/F1c.test.js` (in-process `matcherGrade` on `tests/fixtures/practice/labelled-answers.json`, accept-pack lexicon).
- **Expected:** SC-003 thresholds: `clear` → `met` 100%; `valid-alternative` → `met` ≥ 75%.
- **Actual:** `clear` 8/10 met (2 partial); `valid-alternative` 4/8 met (4 partial). All 6 misses hit the FR-019 cap: each answer matches enough items for `met` (e.g. scenario-festival design matches 3/3 `mustCover`; interview followUps:0 matches 2/2), but ≤ 2 content words remain after removing every matched form, so status is capped at `partial`. Example: "Let the line go slack and turn away from people so it lands safely." → defense `partial` with both items matched (rest: "lands", "safely"). Removal spans all dimensions and the matched `acceptableCorrections` entry, so a full natural stop answer ("Check for frays before every flight, because sunlight and rubbing weaken the line over time and its rating does not last.") leaves 2 words and is capped on both dimensions.
- **Evidence:** TAP diagnostics of the SC-003 test (confusion table in the QA report); with the cap disabled in a scratch copy all 43 original rows match their labels, but the 2 new `stuffed` rows (bare keyword lists) then come out `met`, so removing the cap is not the fix. The same cause fails US1.5 and US1.11 at HTTP level.
- **Suspected file:** `server/services/practice-matcher.js` `grade()` (`stuffed = total - removed.size <= R.stuffedMaxRest`), and FR-019's wording, which doesn't separate a short sentence from a keyword list (e.g. a list has no function words; a sentence does).
- **Owner:** technical-product-manager with principal-architect (FR-019 rule), then backend-engineer (matcher, `MATCHER_VERSION` bump). SC-003 stays `todo: 'F1c-T03'` until fixed.
- **Status (PM, 2026-10-14):** ruled. FR-019 is rewritten (`matcher@2`, `stuffedMaxFunctionShare = 0.2`, spec PD-4). Fixed by F1c-T12, gated by F1c-T15 (SC-012) and verified by F1c-T16. QA closes it at verify.

### F1c-B21 [minor] Spec contradiction: is `graded` written on a false interruption?
- **Steps:** spec data table: `graded` "with every stop hit or answer", but its `outcome` lists `false_alarm`. T04 WIP writes `graded` for a false interruption.
- **Expected vs actual:** acceptance test "FR-050 catch events…" follows the table row (no `graded` on a false interruption); T04 WIP writes one (`started, stopped, explained, graded, stopped, explained, graded, completed, self-rated`).
- **Evidence:** `node --test --test-name-pattern="FR-050" tests/acceptance/F1c.test.js`.
- **Suspected file:** `docs/specs/F1c-practice-engine/spec.md` (events table), `server/services/practice.js`.
- **Owner:** technical-product-manager to rule; QA updates the test to match the ruling.
- **Status (PM, 2026-10-14): closed in the spec.** Per the architect's ruling (ADR 0002 Am. 4), the events table's `graded` "When" cell now reads "with every stop (a false interruption gets `overall: null`, `outcome: false_alarm`) and every answer". The test update is F1c-T16, and the backend test is in F1c-T13.

### F1c-B22 [minor] tasks.md says `PRACTICE_PACKS_DIR` = a pack folder; the loader reads a folder of packs
- **Steps:** T04 notes "`PRACTICE_PACKS_DIR=tests/fixtures/practice/pack-basic`" and T01b notes "`PRACTICE_PACKS_DIR` set to accept-pack"; `loadPracticePacks` (FR-002) reads `<dir>/<name>/practice.json`.
- **Expected vs actual:** pointing it at accept-pack itself loads 0 tracks, silently (no warning). QA tests copy accept-pack to `<tmp>/kite-craft` (`acceptPacksDir()` in `tests/acceptance/practice-helpers.mjs`); T01b must do the same.
- **Suspected file:** `docs/specs/F1c-practice-engine/tasks.md` (T04, T01b notes).
- **Owner:** technical-product-manager.
- **Status (PM, 2026-10-14): closed.** Spec FR-002 now says "a folder of pack folders", with examples. The T04 test note uses a folder of packs containing `pack-basic/`, and the T01b notes copy accept-pack to `<tmp>/kite-craft` and point `PRACTICE_PACKS_DIR` at `<tmp>`.

*Filed by qa-engineer while verifying F1c-T16 (2026-10-14).*

### F1c-B23 [minor] More than 20 skips in one exercise: `complete` returns 400 and the page offers a "Try again" that can never succeed
- **Steps:** real server (`PRACTICE_PACKS_DIR=tests/fixtures/practice`, `MOCK=1`), text mode, 1280 px. Start `catch-lines`. 21 times: press Stop on `s1`, make the stop request fail at the network level (in-page fetch rejection), press **Skip this stop** (`s1` replays). Let the set run to the end. Then press **Try again** 3 times.
- **Expected:** the learner reaches the reveal, or at least sees a message that is true and a way forward (invariant 7: degrade, never stall). The server rule (FR-009a, at most 20 entries, else 400) is correct and isn't in question.
- **Actual:** `web/practice/app.js` `onSkip` pushes onto `S.skipped` with no limit and no de-duplication, and `complete()` sends all 21 entries. `POST …/complete` returns 400 (`skipped must be an array of at most 20 entries`). `complete()` maps every error, including this `ApiError` 400, to `err.net` ("Couldn't reach the server…", which is untrue) with **Try again** and no Skip. Every Try again re-sends the same 21 entries and gets 400 again (4 of 4 requests were 400). The reveal never appears, and no `completed` event is written, so the attempt's hits are never summarised. The only way out is a reload.
- **Evidence:** scratch harness `e2e-waveA1.mjs` scenario `bug-21-skips-text-1280`, 3/3 checks reproduce it. Screenshot `/tmp/claude-0/-home-user/0355a50c-9f07-57a8-b4c8-1ac26d9678c5/scratchpad/f1c-t16/bug-21-skips-text-1280-complete-400-try-again.png`. Server side: acceptance test "edge: skipped validation 400 (… 21 entries …)" passes, so the 400 is by design.
- **Severity: minor; doesn't block the Wave A.1 ship.** It needs 21 failed stop requests in one exercise (the fixture and module-1 draft catch exercises have 2 to 8 statements), followed by a `complete` that does reach the server. Nothing is corrupted: the event log stays valid and append-only, and a reload gets back to the picker. It is still a real stall with a false message, so it must be fixed before T01b's e2e and before the founder uses the page on a bad connection.
- **Suspected file:** `web/practice/app.js` (`onSkip`, `complete()`). The error mapping in `complete()` (any non-network error → `err.net` + endless retry) is the general cause; the unbounded `S.skipped` is this instance of it.
- **Owner:** technical-product-manager chooses the policy, then frontend-engineer. Options: (a) the client keeps at most 20 entries (first 20, or the latest per `statementId`, which changes attribution only for repeat skips on one statement); (b) after 20 skips the Skip button is hidden and `err.net` offers Try again only; (c) on an `ApiError` 4xx from `complete`, show a different message and a way back to the picker instead of `err.net`. (c) is needed whichever of (a) or (b) is chosen.
- **Status (PM, 2026-10-14, revision 4): ruled; fix ticketed as F1c-T17 (frontend-engineer).** The architect classed it an inv. 7 defect, not blocking Wave A.1, and gated before F1c-T11 merges and before F1c-T01b (review.md "Wave A.1 re-check"). Policy (spec PD-9): a variant of (a), one skip per statement with the **smallest** `elapsedMs` (not the latest; it preserves the server's attribution exactly), plus (c) for a 4xx at `complete` **and** at a stop: `err.rejected` with Back to exercises, by button and (from F1c-T06) by voice "back". (b) is rejected. `NetworkError` and 5xx keep `err.net`. The server rule is unchanged. QA closes B23 after re-running `bug-21-skips` and a mid-exercise pack-version 404 (SC-013, F1c-T17 acceptance).
