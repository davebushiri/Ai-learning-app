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
