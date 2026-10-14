# F1c: Tickets

**Status:** Approved (revision 2: design review applied)
**Revision history:** revision 2 (2026-10-13): [`review.md`](review.md) "Design review" (APPROVED WITH CHANGES) applied: C1–C15, plus the learning-designer's B2/B3 matcher fixes and PD-1 to PD-3 (spec "Product decisions"). Every Files line is now a single line with backticked paths (C6). Shared-file sequences gain the cross-spec order with F1a Wave 2 (C7), mirrored in F1a `tasks.md` rev 4.7. Revision 1: first draft. Spec: [`spec.md`](spec.md). Binding: ADRs 0001–0006 with all amendments, ADR 0008, ADR 0002 Amendment 3 and ADR 0006 Amendment 3 (an ADR wins over this file).

Legend: [P] = can run in parallel with other [P] tickets in the same wave (no shared files).

## Rules for every ticket in this spec
- **Isolation (SC-002).** No ticket touches the spec's "Untouched" list. `server/index.js`, `shared/events.js`, `server/db.js`, `server/packs.js` and `web/speech.js` are edited **only** by the tickets named below, additively.
- **Files lines (C6).** `npm run check:ticket <id>` reads only the ticket's single `- **Files:**` line and its backticked paths (`tests/tools/check-ticket.mjs:52`); text in parentheses is ignored. Never put a path only in a sub-bullet or in parentheses.
- **Golden replay** (`node tests/golden/run.mjs --replay`) runs after Waves A, B and C, and after F1c-T06. Any diff is a blocker bug.
- **`todo` mapping.** Acceptance and e2e tests that wait on a ticket are declared `{ todo: 'F1c-T##' }`. F1c-T01a widens the guardrail so these reasons pass. QA removes a ticket's `todo` markers when verifying that ticket. F1a-T19b counts only `F1a-` todos (F1a rev 4.7).
- **Changed assertions** are listed as `old → new`.
- **No prompt, gateway or model-routing change** in any F1c ticket.
- **Shared-file sequences (never in parallel):**
  - F1c-internal: `server/index.js` T04 → T08; `server/routes/practice.js` and `server/services/practice.js` T04 → T07; `web/practice/app.js`, `web/practice.html`, `web/practice/copy.js`, `web/practice/api.js` and `web/practice/practice.css` T05 → T06 → T09 → T10; `web/practice/commands.js` and `tests/practice-web-commands.test.js` T06 only; `server/packs.js` T02 only; `web/speech.js` T06 only; `tests/acceptance/F1c.test.js` and `tests/e2e/F1c.e2e.mjs` are changed after T01a / T01b only by QA `todo` removals.
  - **Cross-spec order with F1a Wave 2 (C7; F1a is on hold, mirrored in F1a `tasks.md` rev 4.7):**

    | File | F1c | F1a Wave 2 | Order |
    |---|---|---|---|
    | `server/index.js` | T04, T08 | T12, T18 | F1c-T04 → F1c-T08 → F1a-T12 → F1a-T18 |
    | `shared/events.js`, `tests/events.test.js` | T04 | T13a | F1c-T04 → F1a-T13a |
    | `server/packs.js` | T02 | T18 (comment) | F1c-T02 → F1a-T18 |
    | `web/speech.js` | T06 (`onSegment`) | T15 deletes it and rewrites `web/practice/speech.js`; T24 | F1c-T06 → F1a-T15 → F1a-T24 |
    | `npm test` `# todo` count | T01a, T01b add `F1c-` todos | T19b requires 0 `F1a-` todos | no order needed |
- **Wave order.**
  - **Wave A** (usable text-mode catch loop): T01a, T02, T03 [P] → T04 → T05. Ready to build now.
  - **Wave B:** T01b, T06, T07, T08 [P]. T11 [P] after T02, T03 and its content gates.
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
  - `MATCHER_VERSION = 'matcher@1'`;
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
- **Tests that prove it:** `tests/practice-catch.test.js` (in-process service on a `:memory:` DB plus one spawned-server HTTP smoke test with `PRACTICE_PACKS_DIR=tests/fixtures/practice/pack-basic`):
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

## Wave B: voice, other modes and progress (backend), e2e

### F1c-T01b [P] Acceptance tests, browser level (e2e)
- **Owner:** qa-engineer · **Size:** M · **Depends on:** F1c-T01a (accept-pack), F1c-T05 (DOM ids)
- **Files:** create `tests/e2e/F1c.e2e.mjs`
- **Interfaces:**
  - Consumes: the T05, T06, T09 and T10 DOM ids; `tests/golden/browser-stubs.js`, reused and not edited. If it lacks a `SpeechRecognition` stub, define one inline in this file that emits scripted interim and final segments (per-result `isFinal`).
  - Uses the F1a timing contract (`page.clock`, held utterances, DOM-keyed actions).
- **Acceptance:** US1 (text) and US2 (voice), plus the voice/text halves of US3–US6 as `todo` until T09 and T10. Covers SC-005, SC-006, SC-007 and SC-011, with 0 console errors at 390 px and 1280 px.
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
  - "SC-011 hands-free: catch, next, review with 0 clicks after Start" (`todo: 'F1c-T10'`);
  - each with its text-mode twin where the spec lists one.
- **Notes:** runs outside `npm test` (`node tests/e2e/F1c.e2e.mjs`, `MOCK=1`, `PRACTICE_PACKS_DIR` set to accept-pack).

### F1c-T06 [P] Voice for catch: hotword, barge-in, editable dictation, command parser
- **Owner:** frontend-engineer · **Size:** M · **Depends on:** F1c-T05 (ARCH-6 ruled, ADR 0008)
- **Files:** create `web/practice/voice.js`, `web/practice/commands.js`, `tests/practice-web-commands.test.js`; modify `web/speech.js`, `web/practice/app.js`, `web/practice.html`, `web/practice/copy.js`, `web/practice/practice.css`
  - `web/speech.js` (C8): exactly one additive change, an optional `onSegment({text, isFinal})` callback in `listen()`, called once per recognition result. No other line changes; `web/app.js` doesn't pass it.
  - `web/practice.html`: `#mic-btn`, `#mic-msg`. `web/practice/copy.js`: `mic.denied`.
- **Interfaces:**
  - Consumes: `listen` (with `onSegment`), `canListen`, `speak` and `stopSpeaking` through `web/practice/speech.js` (unchanged: it re-exports `listen`, so the new option passes through).
  - Produces:
    - **`web/speech.js`:** `listen({onInterim, onSegment} = {}) → {result: Promise<string>, stop()}`; `onSegment({text: string, isFinal: boolean})` per result; everything else unchanged.
    - **`commands.js` (pure; every command in the spec table, including C11):**
      - `isHotword(segment: string, statementText: string) → boolean` (FR-032; phrases "stop", "hold on");
      - `parseCommand(segment: string, state: 'narrating' | 'answering' | 'feedback' | 'reveal' | 'done' | 'clarifying' | 'progress') → null | {cmd: 'stop' | 'send' | 'done' | 'continue' | 'rate' | 'next' | 'ready' | 'review' | 'diagnostic', rating?: Rating}`. States and commands exactly as the spec's voice-command table ("had it" / "partly" / "missed it" → `rate` in `reveal`).
      - `stripCommand(text: string) → string`.
    - **`voice.js`:**
      - `startHotword({getStatementText, onStop}) → {stop()}`, active only while narrating;
      - `startDictation({onText, onCommand}) → {stop()}`, with fallback to text after 3 consecutive recognizer errors;
      - `startCommands({state: () => string, onCommand}) → {stop()}`: listens for state commands in `reveal`, `done` and `progress`.
  - Wires "next" in `reveal` and `done` to the same handler as `#next-btn` (FR-058).
- **Acceptance:** US2.1–US2.9; FR-030–FR-038 (voice half), FR-058 (voice "next"). `stopSpeaking()` is called synchronously in the stop handler, and `stopLatencyMs` is measured with `performance.now()`. Golden replay shows 0 diffs after this ticket.
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
  - `node tests/golden/run.mjs --replay`: 0 diffs.
  - The real-browser check (Chrome) is recorded in voice and text mode.

### F1c-T07 [P] Learn, interview, scenario, follow-up and transfer API
- **Owner:** backend-engineer · **Size:** M · **Depends on:** F1c-T04
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
- **Owner:** backend-engineer · **Size:** S · **Depends on:** F1c-T02, F1c-T03; OQ-1 sign-off, the 7-day plan and ≤ 6 diagnostic ids (PM + learning-designer, C12) and the content author's answer to OQ-6, each recorded in thread 0007. **Merge** also waits on the founder's ARCH-2 confirmation (OQ-5) in thread 0007.
- **Files:** create `packs/applied-ai/practice.json`, `packs/applied-ai/schedule.json`, `packs/applied-ai/exercises/*.json`, `packs/applied-ai/reference/*.md`, `tests/practice-content.test.js`
- **Interfaces:** consumes `validatePracticePack`, `loadPracticePacks` and `matcherGrade`; copies from `docs/research/applied-ai/module-1/`, which is read, never edited.
- **Format mapping only (C12):**
  - `verified`: a string starting `fetched-` → `true`; anything else → `false`; the original string goes in `note`.
  - `challenges`: `challenge` → `question`, `expected` → `rubric`.
  - architecture `id` = the slug of `name` (lowercase, non-alphanumerics → `-`, trimmed); `name` dropped; `strengths`, `tradeoffs` kept.
  - module id `m1`; reference files renamed to `<referenceId>.md`.
  - `practice.json` and `schedule.json` built from the thread 0007 records.
  - `diagnostic.json` and `_matcher-test-answers.json` are not copied.
- **Content additions (only if the author agrees in thread 0007, OQ-6; PD-1):**
  - catch-06 `followUp` → `{question: <existing text>, rubric: ["both stages can contribute", "right chunk ranked low|buried mid-context", "fix ranking and prompt evidence order"]}`;
  - catch-08 `followUp` → `{question: <existing text>, rubric: ["measure recall@k|hit rate", "measure answer quality|faithfulness", "latency and cost per query"]}`;
  - `practice.json` `lexicon.synonyms` = the learning-designer's draft list (`_matcher-test-answers.json`), with forms that fail FR-017 word-start matching dropped and listed in the PR.
- **Acceptance:**
  - `packs/applied-ai` validates with 0 problems.
  - Module `m1` has ≥ 1 exercise of each type and ≥ 1 zero-planted catch.
  - The schedule has 7 days × 120 min, practice ≥ 60%, and a non-empty `diagnostic` of ≤ 6 ids.
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
| F1c-T01b [P] | qa-engineer | M | T01a, T05 | B |
| F1c-T06 [P] | frontend-engineer | M | T05 | B |
| F1c-T07 [P] | backend-engineer | M | T04 | B |
| F1c-T08 [P] | backend-engineer | M | T04 | B |
| F1c-T11 [P] | backend-engineer | S | T02, T03, thread-0007 content gates; merge: founder ARCH-2 | B (content-gated) |
| F1c-T09 | frontend-engineer | M | T06, T07 | C |
| F1c-T10 | frontend-engineer | M | T08, T09 | C |

**[P] collision check:**
- **Wave A:** T01a touches only `tests/acceptance/*`, `tests/fixtures/practice/accept-pack/**`, the two labelled-answer files, the guardrail files and `deny-list.json`. T02 touches `server/services/practice-pack.js`, `server/packs.js`, `tests/practice-pack.test.js`, `tests/pack.test.js` and `tests/fixtures/practice/pack-basic/**`. T03 touches only its two new files. No overlap.
- **Wave B:** T06 touches `web/practice/*`, `web/speech.js` and its new test. T07 touches `server/services/practice.js`, `server/routes/practice.js` and its new test. T08 touches the new `practice-progress` files, `server/index.js`, `server/db.js` and `tests/db.test.js`. T11 touches `packs/applied-ai/**` and its new test. T01b touches its one new file. No overlap.

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

### F1c-B21 [minor] Spec contradiction: is `graded` written on a false interruption?
- **Steps:** spec data table: `graded` "with every stop hit or answer", but its `outcome` lists `false_alarm`. T04 WIP writes `graded` for a false interruption.
- **Expected vs actual:** acceptance test "FR-050 catch events…" follows the table row (no `graded` on a false interruption); T04 WIP writes one (`started, stopped, explained, graded, stopped, explained, graded, completed, self-rated`).
- **Evidence:** `node --test --test-name-pattern="FR-050" tests/acceptance/F1c.test.js`.
- **Suspected file:** `docs/specs/F1c-practice-engine/spec.md` (events table), `server/services/practice.js`.
- **Owner:** technical-product-manager to rule; QA updates the test to match the ruling.

### F1c-B22 [minor] tasks.md says `PRACTICE_PACKS_DIR` = a pack folder; the loader reads a folder of packs
- **Steps:** T04 notes "`PRACTICE_PACKS_DIR=tests/fixtures/practice/pack-basic`" and T01b notes "`PRACTICE_PACKS_DIR` set to accept-pack"; `loadPracticePacks` (FR-002) reads `<dir>/<name>/practice.json`.
- **Expected vs actual:** pointing it at accept-pack itself loads 0 tracks, silently (no warning). QA tests copy accept-pack to `<tmp>/kite-craft` (`acceptPacksDir()` in `tests/acceptance/practice-helpers.mjs`); T01b must do the same.
- **Suspected file:** `docs/specs/F1c-practice-engine/tasks.md` (T04, T01b notes).
- **Owner:** technical-product-manager.
