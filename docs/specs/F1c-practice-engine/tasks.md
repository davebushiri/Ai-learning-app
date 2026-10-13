# F1c: Tickets

**Status:** Draft (revision 1, 2026-10-13). Not buildable until the learning review and the principal-architect design review are done, and ARCH-1 to ARCH-8 are ruled. Spec: [`spec.md`](spec.md). Binding: ADRs 0001–0006 with all amendments (an ADR wins over this file).

Legend: [P] = can run in parallel with other [P] tickets in the same wave (no shared files).

## Rules for every ticket in this spec
- **Isolation (SC-002).** No ticket touches the spec's "Untouched" list. `server/index.js`, `shared/events.js`, `server/db.js` and `server/packs.js` are edited **only** by the tickets named below, additively.
- **Golden replay** (`node tests/golden/run.mjs --replay`) runs after Waves A, B and C. Any diff is a blocker bug.
- **`todo` mapping.** Acceptance and e2e tests that wait on a ticket are declared `{ todo: 'F1c-T##' }`. F1c-T01a widens the guardrail so these reasons pass. QA removes a ticket's `todo` markers when verifying that ticket.
- **Changed assertions** are listed as `old → new`.
- **No prompt, gateway or model-routing change** in any F1c ticket.
- **Shared-file sequences (never in parallel):**
  - `server/index.js` T04 → T08; `server/routes/practice.js` and `server/services/practice.js` T04 → T07;
  - `web/practice/app.js`, `web/practice.html`, `web/practice/copy.js`, `web/practice/api.js` and `web/practice/practice.css` T05 → T06 → T09 → T10;
  - `server/packs.js` F1c-T02 only, which must merge before F1a-T18 (ARCH-1);
  - `tests/acceptance/F1c.test.js` and `tests/e2e/F1c.e2e.mjs` are changed after T01a / T01b only by QA `todo` removals.
- **Wave order.**
  - **Wave A** (usable text-mode catch loop): T01a, T02, T03 [P] → T04 → T05.
  - **Wave B:** T01b, T06, T07, T08 [P]. T11 [P] whenever OQ-1 is signed off (after T02).
  - **Wave C:** T09 → T10.

## Shared shapes (referenced by several tickets)
```ts
type Status = 'met' | 'partial' | 'not_met' | 'uncertain'
type Dim = { status: Status, matched: string[], missing: string[] }
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
    items: string[],                          // rubric items
    alternatives?: string[],                  // each matched as one item (acceptableCorrections)
    architectures?: {id: string, mustInclude: string[]}[] } },
  flawedText?: string,                        // FR-021(c)
  redFlags?: string[], strongSignals?: string[],
  lexicon: { synonyms: Record<string, string[]> } }
type GraderOutput = {
  dimensions: { [name: string]: Dim & { confidence: 'high' | 'low' } },
  redFlagsMatched: string[], strongSignalsMatched: string[], architectureId: string | null,
  graderSource: 'matcher', graderVersion: string }
```

---

## Wave A: the text-mode catch loop

### F1c-T01a [P] Acceptance tests (HTTP), labelled matcher set, guardrails
- **Owner:** qa-engineer · **Size:** M · **Depends on:** none (written from the spec)
- **Files:**
  - create `tests/acceptance/F1c.test.js`, `tests/acceptance/practice-helpers.mjs`, `tests/fixtures/practice/accept-pack/**` (a neutral fictional subject: `practice.json`, `schedule.json`, `exercises/*.json` covering every type with at least one zero-planted catch, and `reference/*.md`), and `tests/fixtures/practice/labelled-answers.json`;
  - modify `tests/acceptance/todo-guardrail.test.js`, `tests/tools/check-ticket.mjs`, `tests/ownership.test.js` and `tests/fixtures/deny-list.json`.
- **Interfaces:**
  - Consumes: every route and shape in F1c-T04, T07 and T08 (not yet built); `startServer(env)` from `tests/helpers/server.mjs` with `PRACTICE_PACKS_DIR` and `DB_PATH`.
  - Produces:
    - `practiceLeakScan(json, {allow: string[]}) → string[]` (JSON paths of any FR-004 key outside `allow`; never throws; a cycle gives `"<cycle>"`);
    - `labelled-answers.json`: `[{exercise, part, answer, class: 'clear' | 'incorrect' | 'partial' | 'valid-alternative' | 'should-flag', expect: Status}]`, with ≥ 40 rows and ≥ 8 per class.
- **Acceptance:**
  - Every HTTP-level scenario in US1, US3–US6 and every server edge case has a named test.
  - SC-001, SC-003, SC-009 and SC-010 are each asserted.
  - The required cases are clear, incorrect, partial, valid alternative and flagged uncertain, at the stop and answer level.
- **Changed assertions:**
  - `todo-guardrail.test.js`: `TICKET` `/^F1a-T\d\d[a-d]?$/` → `/^F1[ac]-T\d\d[a-d]?$/`; test title updated to match; scanner case `'F1b-T01'` → `'F1d-T01'` (still a violation); add accepted case `'F1c-T04'`.
  - `check-ticket.mjs`: `TICKET_ID` widened the same way; `tests/acceptance/F1c.test.js` and `tests/e2e/F1c.e2e.mjs` added to the always-allowed list.
  - `ownership.test.js`: malformed-id stderr regex `/\^F1a-T\\d\\d\[a-d\]\?\$/` → the widened pattern.
  - `deny-list.json`: + `rag`, `embedding`, `embeddings`, `vector`, `vectors`, `bedrock`, `aws`, `sagemaker`, `opensearch`, `kendra`, `chunking`, `reranker`, `reranking`, `hallucination`, `hallucinations`, `fine-tuning`. These have 0 current hits in `server/ shared/ web/ scripts/` (verified 2026-10-13); `deny-list-allow.json` is unchanged.
- **Tests that prove it:** named `"<US#>.<n> <title>"` or `"edge: <title>"`. Required:
  - "US1.1 start returns narration only (leak scan)";
  - "US1.2 hit met";
  - "US1.3 false interruption returns nothing about other statements";
  - "US1.4 late hit inside 2000 ms; same stop at 2001 ms is a false interruption";
  - "US1.5 valid alternative correction met";
  - "US1.6 long unmatched answer is uncertain, flagged in progress";
  - "US1.8 zero-planted clean pass";
  - "US1.9 assisted only after assist";
  - "edge: repeat stop identical body, no new events";
  - "edge: stop after complete 409";
  - "edge: 413 and 400";
  - "SC-003 labelled set thresholds" (prints the per-class confusion table as a TAP diagnostic);
  - "SC-009 progress identical after restart";
  - "SC-010 invalid practice pack: server up, one [practice] warning, /api/subjects unchanged".
- **Notes:** runs in `npm test`. The pack is the QA-owned `accept-pack`, not the engineers' fixture or the real content.

### F1c-T02 [P] Practice pack format, validator and loader
- **Owner:** backend-engineer · **Size:** M · **Depends on:** ARCH-1 and ARCH-3 rulings
- **Files:**
  - create `server/services/practice-pack.js`, `tests/practice-pack.test.js` and `tests/fixtures/practice/pack-basic/**` (a neutral fictional subject; ≥ 1 exercise per type, 1 zero-planted catch);
  - modify `server/packs.js` (ARCH-1 option (a): skip directories that contain `practice.json` without warning; one guarded line) and `tests/pack.test.js` (add one test).
- **Interfaces (produces):**
  - `validatePracticePack({manifest, schedule, exercises: Map<string, object>, references: Map<string, string>}) → string[]`: every spec schema rule, cap and the reference-integrity check. It never throws.
  - `loadPracticePacks(dir = process.env.PRACTICE_PACKS_DIR || <ROOT>/packs, db = getDb()) → Map<trackId, Track>`. It never throws, warns `[practice] <dir> skipped: <reasons>`, stores canonical JSON through `db.putPack({id, version, json, provenance})`, and refuses on `'conflict'`.
  - `listTracks() → {id, title, version}[]`, `getTrack(id) → Track | null`, `getExercise(trackId, exerciseId) → Exercise | null` (deep-frozen), `getReferences(trackId, ids: string[]) → {id, text}[]`, `getSchedule(trackId) → Schedule | null`.
  - `toPublicExercise(ex) → PublicExercise` (allow-list).
  - `Track = {id, version, title, modules: [{id, title, exercises: string[]}], lexicon: {synonyms}}`.
- **Acceptance:** FR-001, FR-002, FR-004 (projection), SC-010 (loader half).
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
  - "garbage input never throws";
  - "changed pack same version refused";
  - "toPublicExercise emits only allow-listed keys for each type".
  - `tests/pack.test.js`: "a directory with practice.json and no pack.json is skipped with no [packs] warning".
- **Notes:** reuses the `server/packs.js` pattern (canonicalJson can be imported from there). Engine code holds no subject words.

### F1c-T03 [P] Rubric-concept matcher (offline grader)
- **Owner:** backend-engineer · **Size:** M · **Depends on:** ARCH-5 ruling (assumes option (a))
- **Files:** create `server/services/practice-matcher.js`, `tests/practice-matcher.test.js`
- **Interfaces (produces):**
  - `MATCHER_VERSION = 'matcher@1'`;
  - `MATCHER_RULES` (frozen): `{itemCoverage: 0.6, metRatio: 0.67, minWords: 3, longAnswerWords: 20, negationWindow: 3, echoCoverage: 0.8, stuffedMaxRest: 2}`;
  - `matcherGrade(input: GraderInput) → GraderOutput` (sync, pure);
  - `matchClarification(question: string, clarifications: {askAbout: string[]}[], lexicon) → number | null`;
  - `combineOverall(dims: Dim[]) → Status` (FR-011).
- **Acceptance:** FR-013, FR-014, FR-017–FR-022, FR-043 (as `combine`), FR-020.
- **Tests that prove it:**
  - "item match needs ceil(0.6n) tokens; n ≤ 2 needs all";
  - "word-start match with stemming (tested hits test; online does not hit line)";
  - "lexicon synonym satisfies a token";
  - "met / partial / not_met thresholds";
  - "fewer than 3 content words is not_met";
  - "stuffed answer capped at partial";
  - "valid alternative correction met when rubric.correct not";
  - "best architecture wins";
  - "long unmatched answer is uncertain";
  - "negation before a matched token is uncertain";
  - "echoing the flawed statement is uncertain";
  - "red flag makes uncertain";
  - "never throws on non-string input";
  - "overall combination table".
- **Notes:**
  - Reimplements the techniques of `shared/mock-grader.js`: normalize, stem, word-start regex, stuffing. The stopword list is generic English, and the module holds no subject words.
  - Server-only: never import it from `web/`.

### F1c-T04 Catch attempt API, events and wiring
- **Owner:** backend-engineer · **Size:** M · **Depends on:** F1c-T02, F1c-T03, ARCH-4 ruling
- **Files:**
  - create `server/services/practice.js`, `server/routes/practice.js`, `tests/practice-catch.test.js`;
  - modify `server/index.js` (import the route, call `loadPracticePacks()` after `loadPacks()`), `shared/events.js` (VERBS + `'self-rated'`, `'assisted'`, `'clarified'`) and `tests/events.test.js` (old → new: the expected `VERBS` list gains those 3).
- **Interfaces:**
  - Consumes: T02's loader functions and `toPublicExercise`; T03's `matcherGrade` and `combineOverall`; `db.appendEvents` and `db.eventsForAttempt`; `makeEvent` and `newId('pra')`.
  - Produces:
    - `createPracticeService({db, grader = matcherGrade, now = Date.now}) → {startAttempt, submitStop, assist, complete, selfRate}`. The service holds no state outside the event log; each attempt is rebuilt by `projectPracticeAttempt(events)` (exported).
    - `GRACE_MS = 2000` (exported).
    - `handle(req, res, url) → boolean`. It matches only the exact paths below and returns `false` otherwise, so later route modules are reached.
  - **Routes:**
    - `GET /api/practice/tracks → [{id, title, version}]`
    - `GET /api/practice/tracks/:track → {id, title, version, modules: [{id, title, exercises: [{id, type, objective, difficulty, concepts, prerequisites}]}]}` | 404
    - `POST /api/practice/attempts {track, exercise, mode?: 'practice' | 'diagnostic' | 'review'} → {attemptId, exercise: PublicExercise, assistAllowed}`. 400 on a bad mode, or on a diagnostic for an exercise not in `schedule.diagnostic`; 404 on an unknown track or exercise.
    - `POST /api/practice/attempts/:id/stops {statementId, elapsedMs, answer, via?, stopLatencyMs?} → {statementId, attributedStatementId, detection: 'hit' | 'late_hit' | 'false_interruption', assisted, result: null | {explanation: Dim, correction: Dim, overall: Status}, reveal: null | {statementId, misconception, whyWrong, exceptions, correctedText}}`
    - `POST /api/practice/attempts/:id/assist {} → {assisted: true, reference: [{id, text}]}`. 400 if diagnostic; idempotent.
    - `POST /api/practice/attempts/:id/complete {lastStatementId?} → {summary: {planted, hits, lateHits, misses, falseInterruptions, notReached, cleanPass, flagged}, missed: [{statementId, text, misconception, whyWrong, exceptions, correctedText}], answered: [{part, answer, result, rubric: {explain, correct}, acceptableCorrections, selfRating: Rating | null}], reference: [{id, text}], sources: [{title, url, verified}], followUp: {question, graded: boolean}, transfer: {scenario}}` (catch). Idempotent.
    - `POST /api/practice/attempts/:id/self-ratings {part, rating} → {part, rating, matcherStatus}`. 400 before complete, or for a part with no answer.
  - Events exactly as the spec's "Events and metrics" table, with `context.engine = 'practice'`.
- **Acceptance:** FR-004–FR-012, FR-014–FR-016, FR-023 (injected grader), FR-050 (catch verbs), edge cases for stops and complete.
- **Tests that prove it:** `tests/practice-catch.test.js` (in-process service on a `:memory:` DB plus one spawned-server HTTP smoke test with `PRACTICE_PACKS_DIR=tests/fixtures/practice/pack-basic`):
  - "hit writes stopped/explained/graded in one append, in seq order, all valid";
  - "false interruption: result and reveal null";
  - "grace: 2000 ms late hit, 2001 ms false interruption, caught previous not re-attributed";
  - "repeat stop identical body, no events";
  - "backwards stop 400; after complete 409; non-catch 400";
  - "assist marks later grades only; diagnostic assist 400; idempotent";
  - "complete idempotent; notReached vs missed; cleanPass";
  - "self-rated copies matcherStatus";
  - "injected grader is used";
  - "a server without practice packs still serves /api/subjects unchanged".
  - `tests/events.test.js`: updated VERBS assertion.
- **Notes:**
  - Grading is synchronous, so there are no awaits between reading events and appending them, and no in-flight map.
  - Answers are truncated to 2000 chars.

### F1c-T05 Practice page, text-mode catch loop
- **Owner:** frontend-engineer · **Size:** M · **Depends on:** F1c-T04 contract (may build against the shapes above in parallel; integrates when T04 merges)
- **Files:** create `web/practice.html`, `web/practice/app.js`, `web/practice/api.js`, `web/practice/copy.js`, `web/practice/state.js`, `web/practice/practice.css`, `tests/practice-web-state.test.js`
- **Interfaces:**
  - Consumes: T04's routes; `speak`, `stopSpeaking` and `wait` from `/speech.js` (`speak(text, {enabled: false})` gives reading-pace timing in text mode).
  - Produces:
    - **`state.js` (pure, Node-importable, no `window`):**
      - `resumeIndex(stopResponse, interruptedIndex) → number` (FR-037);
      - `feedbackText(stopResponse) → string` (copy `fb.*`, with `fb.late.prefix`);
      - `dimLines(result) → string[]`;
      - `summaryLine(summary) → string`;
      - `missedLine(item) → string`.
    - **`copy.js`:** `COPY` (frozen), keyed by the spec copy-table ids.
    - **`api.js`:** `fetchTracks()`, `fetchTrack(id)`, `startAttempt(body)`, `postStop(id, body)`, `postAssist(id)`, `postComplete(id, body)`, `postSelfRating(id, body)`, each with a 12 s timeout that throws a typed `NetworkError`.
    - **DOM ids** (QA's e2e depends on them):
      - picker: `#track-list`, `#exercise-list`, `#picker-msg`, `#voice-toggle`;
      - narration: `#intro`, `#statements` (`li[data-statement-id]`, `.current`, `.interrupted`, `.corrected`), `#stop-btn`, `#assist-btn`, `#reference`;
      - answer: `#answer-panel`, `#answer-prompt`, `#answer-input`, `#submit-btn`;
      - network error: `#net-error`, `#retry-btn`, `#skip-btn`;
      - feedback: `#feedback-panel`, `#feedback-text`, `#feedback-dims`, `#continue-btn`;
      - reveal: `#reveal`, `#summary-line`, `#missed-list`, `#answered-list` (`li[data-part]` containing `button[data-rating]`), `#sources-list`, `#next-btn`.
- **Acceptance:** US1.1–US1.10 in text mode; FR-005, FR-035 (text displayed equals the `speak()` argument whenever voice is on), FR-036 (text half), FR-038 (`via: 'button' | 'key'`). All pack text uses `textContent`; the reference goes in a `pre-wrap` block.
- **Tests that prove it:** `tests/practice-web-state.test.js`:
  - "resume after hit is next; after late hit or false interruption is the interrupted statement";
  - "feedbackText for each overall and late prefix";
  - "summaryLine singular/plural";
  - "copy strings equal the spec table" (frozen inline);
  - "no web/practice file imports server/ or mock-grader" (grep).
  - A manual real-browser check in text mode at 390 px and 1280 px is recorded in the PR.
- **Notes:** do not import or fork `web/app.js`. Link `styles.css` read-only, with practice styles in `practice.css`. The page title is "Practice", with no subject words.

---

## Wave B: voice, other modes and progress (backend), e2e

### F1c-T01b [P] Acceptance tests, browser level (e2e)
- **Owner:** qa-engineer · **Size:** M · **Depends on:** F1c-T01a (accept-pack), F1c-T05 (DOM ids)
- **Files:** create `tests/e2e/F1c.e2e.mjs`
- **Interfaces:**
  - Consumes: the T05 and T06 DOM ids; `tests/golden/browser-stubs.js`, reused and not edited. If it lacks a `SpeechRecognition` stub, define one inline in this file that emits scripted interim and final segments.
  - Uses the F1a timing contract (`page.clock`, held utterances, DOM-keyed actions).
- **Acceptance:** US1 (text) and US2 (voice), plus the voice/text halves of US3–US6 as `todo` until T09 and T10. Covers SC-005, SC-006 and SC-007, with 0 console errors at 390 px and 1280 px.
- **Tests that prove it:**
  - "US2.1 hotword cancels speech within 300 ms, interrupted statement kept";
  - "US2.2 typing stops dictation, nothing auto-submits";
  - "US2.3 'send' submits without the word";
  - "US2.4 corrected statement spoken then resume";
  - "US2.6 hotword inside statement text needs the bare phrase";
  - "US2.7 mic denied falls back to text";
  - "US1.10 network abort keeps the answer, Try again idempotent";
  - each with its text-mode twin where the spec lists one.
- **Notes:** runs outside `npm test` (`node tests/e2e/F1c.e2e.mjs`, `MOCK=1`, `PRACTICE_PACKS_DIR` set to accept-pack).

### F1c-T06 [P] Voice for catch: hotword, barge-in, editable dictation
- **Owner:** frontend-engineer · **Size:** M · **Depends on:** F1c-T05, ARCH-6 ruling
- **Files:**
  - create `web/practice/voice.js` (browser glue), `web/practice/commands.js` (pure), `tests/practice-web-commands.test.js`;
  - modify `web/practice/app.js`, `web/practice.html` (`#mic-btn`, `#mic-msg`), `web/practice/copy.js` (`mic.denied`) and `web/practice/practice.css`.
- **Interfaces:**
  - Consumes: `listen`, `canListen`, `speak` and `stopSpeaking` from `/speech.js`.
  - Produces:
    - **`commands.js`:**
      - `isHotword(segment: string, statementText: string) → boolean` (FR-032; phrases "stop", "hold on");
      - `parseCommand(segment: string, state: 'narrating' | 'answering' | 'feedback' | 'selfrating' | 'clarifying') → null | {cmd: 'stop' | 'send' | 'done' | 'continue' | 'rate' | 'ready', rating?: Rating}`;
      - `stripCommand(text: string) → string`.
    - **`voice.js`:**
      - `startHotword({getStatementText, onStop}) → {stop()}`, active only while narrating;
      - `startDictation({onText, onCommand}) → {stop()}`, with fallback to text after 3 consecutive recognizer errors.
- **Acceptance:** US2.1–US2.8; FR-030–FR-038 (voice half). `stopSpeaking()` is called synchronously in the stop handler, and `stopLatencyMs` is measured with `performance.now()`.
- **Tests that prove it:** `tests/practice-web-commands.test.js`:
  - "stop / hold on detected in narrating only";
  - "hotword inside statement text needs the bare phrase";
  - "send and send it only as a whole final segment";
  - "done stops without submit";
  - "had it / partly / missed it map to ratings";
  - "commands ignored outside their state".
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
    - `POST /api/practice/attempts/:id/clarifications {question} → {reveal: string | null}` (scenario only, before `design`).
    - `complete` extended to every type; `answered[]` items carry `rubric` per part type. Interview and scenario also return `rubricFull: {mustCover, strongSignals, redFlags}`, `strongSignalsMatched`, `redFlagsMatched` and `architectureId`.
    - `self-ratings` accepts every answered part.
  - Part-to-dimension mapping:
    - `teachBack:i` → explanation;
    - `interview` → explanation (mustCover);
    - `design` → explanation (FR-043);
    - `followUps:i` and `challenges:i` → defense;
    - `followUp` → tradeoffs;
    - `transfer` → transfer.
- **Acceptance:** FR-040–FR-043, FR-022, US3–US5 at the API level, FR-004 for `next` and `firstPrompt`.
- **Tests that prove it:**
  - "learn teach-back parts in order; out of order 400; repeat identical";
  - "main-part responses carry no result";
  - "followUp before complete 400";
  - "string followUp result null";
  - "interview red flag uncertain";
  - "scenario clarification reveal once-matched, none otherwise";
  - "clarification after design 400";
  - "design is min(mustCover, best architecture)";
  - "complete reveals rubricFull only after complete".

### F1c-T08 [P] Progress, mastery, readiness, schedule, review and diagnostic API
- **Owner:** backend-engineer · **Size:** M · **Depends on:** F1c-T04, ARCH-8 ruling
- **Files:**
  - create `server/services/practice-progress.js`, `server/routes/practice-progress.js`, `tests/practice-progress.test.js`;
  - modify `server/index.js` (register the route after `practice.js`), `server/db.js` (add `eventsForEngine({actor, engine}) → Event[]`, ordered by `seq`) and `tests/db.test.js` (add tests).
- **Interfaces (produces):**
  - `projectPractice(events: Event[], track: Track, exercises: Map) → ProgressBody` (pure).
  - `GET /api/practice/tracks/:track/progress → ProgressBody`:
    ```
    { track, provisional: true,
      concepts: [{ id,
        independent: {score: number | null, n, level: 'none' | 'learning' | 'developing' | 'strong'},
        assisted:    {score: number | null, n, level},
        readiness: {explainUnaided, detectAndCorrect, transfer, failureModesTradeoffs, defendDecision} }],  // each true | false | 'n/a'
      flagged: [{attemptId, exerciseId, part, at, selfRating: Rating | null}],
      counts: {attempts, completed, falseInterruptions} }
    ```
  - `GET /api/practice/tracks/:track/schedule → {days, minutesPerDay, today, diagnostic: [{id, done}], plan: [{day, blocks: [{kind, minutes, exercises: [{id, done}]}]}]}`.
  - `GET /api/practice/tracks/:track/review → {items: [{concept, score: number | null, exerciseId}]}` (≤ 3).
- **Acceptance:** FR-051–FR-057, SC-009.
- **Tests that prove it:**
  - "assisted and independent never merge";
  - "uncertain excluded from mastery and listed in flagged";
  - "level thresholds";
  - "readiness criteria each and n/a when no exercise can satisfy";
  - "explainUnaided ignores learn teach-back";
  - "detectAndCorrect needs 2 distinct statements";
  - "today counts distinct UTC dates, capped at days";
  - "review picks weakest concept, least recent exercise";
  - "projection equals frozen body; identical after reopen of the same DB file".
  - `tests/db.test.js`: "eventsForEngine filters by actor and engine in seq order".

### F1c-T11 [P] Move reviewed module-1 content into packs/applied-ai
- **Owner:** backend-engineer · **Size:** S · **Depends on:** F1c-T02; OQ-1 sign-off recorded in thread 0007
- **Files:** create `packs/applied-ai/practice.json`, `packs/applied-ai/schedule.json`, `packs/applied-ai/exercises/*.json`, `packs/applied-ai/reference/*.md` (copied from `docs/research/applied-ai/module-1/`, changing only the format to fit the schema), `tests/practice-content.test.js`
- **Interfaces:** consumes `validatePracticePack` and `loadPracticePacks`.
- **Acceptance:**
  - `packs/applied-ai` validates with 0 problems.
  - Module `m1-llm-rag` has ≥ 1 exercise of each type and ≥ 1 zero-planted catch.
  - The schedule has 7 days × 120 min, practice ≥ 60%, and a non-empty `diagnostic`.
  - Every source with an unverified service-specific claim has `verified: false`.
  - `/api/subjects` is unchanged.
- **Tests that prove it:** `tests/practice-content.test.js`:
  - "applied-ai validates";
  - "each type present";
  - "zero-planted present";
  - "schedule defaults";
  - "loader stores applied-ai@1 once".
- **Notes:** content edits beyond format need the author's agreement in thread 0007. `docs/research/**` is founder-owned and is read, not edited.

---

## Wave C: the remaining screens

### F1c-T09 Learn, interview, scenario, follow-up and transfer screens
- **Owner:** frontend-engineer · **Size:** M · **Depends on:** F1c-T06, F1c-T07
- **Files:**
  - create `web/practice/modes.js`, `tests/practice-web-modes.test.js`;
  - modify `web/practice/app.js`, `web/practice.html`, `web/practice/api.js` (`postAnswer`, `postClarification`), `web/practice/copy.js` (`q.*`, `sc.*`, `clarify.none`, `done`, `intro.learn`) and `web/practice/practice.css`.
- **Interfaces:**
  - Consumes: T07's routes.
  - Produces:
    - `modes.js` (pure): `promptText(next, exerciseType) → string` (copy `q.*` / `sc.*`) and `clarifyText(reveal) → string`;
    - DOM ids: `#question-text`, `#customer-log`, `#clarify-input`, `#clarify-btn`, `#ready-btn`. The answer panel ids are reused.
- **Acceptance:** US3–US5 in voice and text mode. Follow-up and transfer run after every catch reveal. No Stop control or hotword in learn mode. FR-035 for every prompt.
- **Tests that prove it:** `tests/practice-web-modes.test.js`:
  - "promptText per part type equals copy table";
  - "clarifyText reveal vs none";
  - "sc.brief joins constraints with '; '".
  - The real-browser check is recorded in both modes.

### F1c-T10 Progress, schedule, diagnostic and review screen
- **Owner:** frontend-engineer · **Size:** M · **Depends on:** F1c-T08, F1c-T09
- **Files:**
  - create `web/practice/progress.js`, `tests/practice-web-progress.test.js`;
  - modify `web/practice/app.js`, `web/practice.html`, `web/practice/api.js` (`fetchProgress`, `fetchSchedule`, `fetchReview`), `web/practice/copy.js` (`progress.provisional`, plus the level and criteria labels below) and `web/practice/practice.css`.
- **Interfaces:**
  - Produces:
    - `progress.js` (pure): `conceptRows(body) → {id, independent, assisted, criteria: {label, value: 'Met' | 'Not yet' | 'n/a'}[]}[]` and `todayLines(schedule) → string[]`;
    - DOM ids: `#progress`, `#today-plan`, `#concept-table`, `#flagged-list`, `#review-btn`, `#diagnostic-btn`, `#provisional-note`.
  - Labels:
    - levels: "Not started", "Learning", "Developing", "Strong";
    - criteria: "Explains unaided", "Detects and corrects", "Transfers", "Failure modes and trade-offs", "Defends a decision".
  - Independent and assisted columns are always separate.
- **Acceptance:** US6.1–US6.5 in voice and text mode. Diagnostic attempts are started with `mode: 'diagnostic'`, and `#assist-btn` is hidden.
- **Tests that prove it:** `tests/practice-web-progress.test.js`:
  - "conceptRows keeps assisted separate";
  - "n/a rendered as n/a";
  - "todayLines for day 1 lists diagnostic first";
  - "provisional note text equals copy".
  - The real-browser check is recorded.

## Ticket summary
| Ticket | Owner | Size | Depends on | Wave |
|---|---|---|---|---|
| F1c-T01a [P] | qa-engineer | M | none | A |
| F1c-T02 [P] | backend-engineer | M | ARCH-1, ARCH-3 | A |
| F1c-T03 [P] | backend-engineer | M | ARCH-5 | A |
| F1c-T04 | backend-engineer | M | T02, T03, ARCH-4 | A |
| F1c-T05 | frontend-engineer | M | T04 (contract) | A |
| F1c-T01b [P] | qa-engineer | M | T01a, T05 | B |
| F1c-T06 [P] | frontend-engineer | M | T05, ARCH-6 | B |
| F1c-T07 [P] | backend-engineer | M | T04 | B |
| F1c-T08 [P] | backend-engineer | M | T04, ARCH-8 | B |
| F1c-T11 [P] | backend-engineer | S | T02, OQ-1 | B (content-gated) |
| F1c-T09 | frontend-engineer | M | T06, T07 | C |
| F1c-T10 | frontend-engineer | M | T08, T09 | C |

**[P] collision check:**
- **Wave A:** T01a touches only `tests/acceptance/*`, `tests/fixtures/practice/accept-pack/**`, `tests/fixtures/practice/labelled-answers.json`, the guardrail files and `deny-list.json`. T02 touches `server/services/practice-pack.js`, `server/packs.js`, `tests/practice-pack.test.js`, `tests/pack.test.js` and `tests/fixtures/practice/pack-basic/**`. T03 touches only its two new files. No overlap.
- **Wave B:** T06 touches `web/practice/*` only. T07 touches `server/services/practice.js`, `server/routes/practice.js` and its new test. T08 touches the new `practice-progress` files, `server/index.js`, `server/db.js` and `tests/db.test.js`. T11 touches `packs/applied-ai/**` and its new test. T01b touches its one new file. No overlap.

## Bugs (QA appends)
