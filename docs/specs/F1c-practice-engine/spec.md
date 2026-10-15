# F1c: Practice engine, Applied AI track (modules 1 and 2)

**Status:** Approved (revision 6: `matcher@3`, echo-safe reveal wordings, module 2 loaded as `m2`, days 4–5 of the schedule moved to module 2; Wave B.1 tickets F1c-T18 to T22. Architect design review of revision 6 requested in thread 0007)
**Phase:** F1 (interrupt priority, founder direction in [thread 0007](../../team/threads/0007-applied-ai-aws-track.md)) | **Links:** [user-flow.md](../../foundation/user-flow.md), [data-and-evidence.md](../../foundation/data-and-evidence.md), [voice-first.md](../../foundation/voice-first.md), ADRs [0001](../../adr/0001-sqlite-storage-and-append-only-event-log.md)–[0006](../../adr/0006-pack-format-v1.md), [0008](../../adr/0008-practice-engine-and-practice-pack-format-v1.md), [0002 Amendments 3 and 4](../../adr/0002-event-schema-v1.md), [0006 Amendment 3](../../adr/0006-pack-format-v1.md); design review and Wave A code review in [`review.md`](review.md); Wave A QA report in [`qa-report.md`](qa-report.md)
**Revision:** 6 (2026-10-15). Revision 6 applies the architect's `matcher@3` ruling (review.md "Ruling on the negator-bearing alternative flaw"; PD-13; FR-017, FR-021(b), FR-022 and PD-2 reworded; SC-014), the PM's reveal-wording calls (PD-14; FR-062; SC-015), the module-2 load (PD-15; FR-063; US7; SC-016) and the schedule swap (PD-16; FR-064). It also records, as a catch-up, the founder's 2026-10-15 DECISION (variant B2 lexicon adopted as pack version 2; SC-003b and SC-003c waived for module 1; self-rating is the learner's main signal; grader tuning stopped) as PD-12, and the architect's 60-character slug clause in the format mapping. New tickets: F1c-T18 to T22 (tasks.md "Wave B.1"). Revision 5 (2026-10-14) records the module-1 7-day plan and the 6 diagnostic ids (PD-11, LR-8; thread 0007, PM DECISION after the learning-designer's PROPOSAL), resolves OQ-1, OQ-3, OQ-5 and OQ-6 from the thread 0007 founder and lead DECISIONs, and adds the learning-designer's RISK "Later" items. No FR, SC or copy changes. Revision 4 applies the architect's Wave A.1 re-check (review.md "Wave A.1 re-check", APPROVED): the F1c-B23 policy and copy (PD-9; FR-059, FR-060; US1.16, US1.17, US2.13; SC-013; ticket F1c-T17, gated before F1c-T11 merges and before F1c-T01b) and the OQ-7 ruling (PD-10; FR-061; US2.14; in F1c-T06). OQ-7 is closed. Revision 3 (2026-10-14) applies the Wave A code review (W-B1, W-B2, W-S1, W-S3–W-S6; W-S2 moves to F1c-T06), ADR 0002 Amendment 4, the QA report's ship conditions, bugs F1c-B20, B21 and B22, and product decisions PD-4 to PD-8 (below). It adds Wave A.1 (F1c-T12 to T16) in tasks.md. Revision 2 (2026-10-13) applies the design review's C1–C15, the learning-designer's matcher findings B2 and B3 and follow-up drafts B4 ([`docs/research/applied-ai/module-1/REVIEW.md`](../../research/applied-ai/module-1/REVIEW.md)), and product decisions PD-1 to PD-3 (below). Revision 1: first draft.

## Problem
The founder has a 60-minute technical interview on AI fluency (RAG, agents, embeddings, production evidence) this week or next. The only working loop is the trades game. It has one mode, needs exactly 3 mistakes per card, has no mastery and still leaks answers on its legacy route. F1c adds a **separate, server-owned practice engine** (ADR 0008) that runs the Applied AI track, module 1 (LLM foundations and RAG), in four modes. It grades offline, because there is no API key. The founder's constraints are small increments, reuse, no rebuild, and nothing that takes over the founder's preparation time.

**Revision 6.** Module 1 has no agents content, and the hiring manager asked for agents by name. Module 2 (agents, and embeddings in depth) now exists as reviewed research drafts but isn't in the app. Separately, the matcher still credits a stated misconception in two ways: a negator-bearing rubric alternative matches an answer with no negator (8 of 13 module-1 planted stops exposed; catch-06 s6's own misconception earns correction `met`), and two reveal corrections share enough words with their flawed lines that echoing the flawed line earns correction credit and switches off the echo rule.

## Isolation from the existing game (binding)
- **New surface only:** `web/practice.html`, `web/practice/*.js`, `web/practice/practice.css`, routes under `/api/practice/*`, `server/routes/practice*.js`, `server/services/practice*.js` and content in `packs/applied-ai/`.
- **Untouched:** `web/app.js`, `web/index.html`, `web/api.js`, `web/styles.css`, `server/routes/{health,scenarios,grade}.js`, `server/services/{assessment,content,ai-client}.js`, `server/prompts/*`, `server/ai/*`, `shared/{mock-grader,scoring,contract,pack}.js` and `packs/demo-trades/**`. The F1a golden replay (61 runs) is therefore unaffected. F1a Wave 2 stays on hold; the shared files are sequenced in tasks.md "Shared-file sequences" (C7).
- **Additive edits to shared infrastructure, one ticket each:**
  - `server/index.js`: route registration and the practice loader call (F1c-T04, F1c-T08);
  - `shared/events.js`: three new verbs (F1c-T04);
  - `server/db.js`: one new read function (F1c-T08);
  - `server/packs.js`: one guarded line (F1c-T02, ADR 0008 ARCH-1);
  - `web/speech.js`: one optional `onSegment({text, isFinal})` callback in `listen()` (F1c-T06, ADR 0008 ARCH-6). `web/app.js` doesn't pass it, so its behavior is unchanged and the golden replay shows 0 diffs.
- **Reused as-is:** `web/speech.js` (`speak`, `stopSpeaking`, `wait`, `canListen`, `listen`) through `web/practice/speech.js`, the only practice module that imports it (ADR 0008); `server/db.js` (`appendEvents`, `eventsForAttempt`, `putPack`); `server/http.js` (`readBody`, `sendJson`, `HttpError`, static serving); `shared/events.js` (`makeEvent`, `newId`, `validateEvent`); and the loader pattern of `server/packs.js` (validate first, skip with a warning, canonical JSON, immutable per version, deep freeze, `Map` registry). The `shared/mock-grader.js` techniques are reimplemented in the server-only `server/services/practice-matcher.js`, not imported (ADR 0008 ARCH-5).
- **No prompt, no gateway call, no model routing change.** Invariants 3 and 4 are untouched, and the eval gate is not triggered. A guard test makes this structural: no practice module imports `server/ai/*` or `server/prompts/*`, and they never import a practice module (ADR 0006 Amendment 3).

## Exercise schema (practice pack format v1, ADR 0008)
All pack text is untrusted (ADR 0006). It is validated before use and rendered as text only.

**Layout**
```
packs/applied-ai/
  practice.json              # manifest (never named pack.json; ADR 0008)
  schedule.json
  exercises/<exerciseId>.json
  reference/<referenceId>.md # trusted reference: never contains a flawed statement
```

**Manifest `practice.json`**
```jsonc
{ "format": "practice-v1", "id": "applied-ai", "version": 1, "title": "Applied AI",
  "modules": [{ "id": "m1", "title": "LLM foundations and RAG", "exercises": ["<exerciseId>", "…"] }],
  "lexicon": { "synonyms": { "<term>": ["<form>", "…"] } },   // optional; matched as data, never in a prompt
  "provenance": { "builtBy": "<who>" } }
```
The practice loader runs after `loadPacks()`. It refuses (one `[practice]` warning) a manifest whose `id` `getPack(id)` already holds, because both engines share the `subject_pack` key space (ADR 0008).

**Common exercise fields (all required unless marked optional)**
| Field | Type | Rule |
|---|---|---|
| `id` | string | `^[a-z0-9-]{1,60}$`, equals the file name without `.json`, unique in the pack |
| `module` | string | a `modules[].id` in the manifest that lists this exercise |
| `type` | `"learn" \| "catch" \| "scenario" \| "interview"` | |
| `objective` | string | ≤ 300 chars, shown before the attempt |
| `prerequisites` | string[] | exercise ids in this pack (may be empty); shown, not enforced |
| `difficulty` | 1 \| 2 \| 3 | |
| `concepts` | string[] | ≥ 1 id `^[a-z0-9-]{1,60}$`; mastery keys |
| `referenceIds` | string[] | ≥ 1; each `reference/<id>.md` exists |
| `sources` | `[{title, url, verified: boolean, note?: string}]` | ≥ 1; `url` starts with `https://`; `note` ≤ 200 chars (C2) |
| `followUp` | `{question, rubric: string[]}` or a string | a string is self-rated only (never matched). Content rule: it MUST probe failure modes or trade-offs |
| `transfer` | `{scenario: string, rubric: string[]}` | rubric ≥ 1 item |

**Rubric items (every `rubric`, `explain`, `correct`, `mustCover`, `strongSignals`, `redFlags`, `mustInclude` and `askAbout` entry) (C1).** An item is one or more alternatives separated by `|`, for example `"weights unchanged|no training"`. The validator rejects an item with an empty alternative (`"a||b"`, `"a|"`) and an item with more than 8 alternatives.

**`catch`**
```jsonc
"narration": [{ "id": "s1", "text": "…" }],      // 1–20 statements, ids unique ^[a-z0-9-]{1,20}$
"answerKey": {
  "planted": [{                                    // 0..n; zero planted is allowed
    "statementId": "s3",
    "misconception": "…",                          // the authored misconception; never model output
    "whyWrong": "…",
    "acceptableCorrections": ["…", "…"],           // ≥ 1; [0] is a complete sentence that replaces the statement
    "exceptions": "…",                             // when the statement would be true; "" if none
    "kind": "overgeneralization",                  // ^[a-z0-9-]{1,40}$
    "rubric": { "explain": ["…"], "correct": ["…"] } // each ≥ 1 item
  }],
  "clean": ["s1", "s2", "s4"] }
```
Every narration id appears in exactly one of `planted[].statementId` and `clean`.

**`learn`:** `narration` (as in catch; no answer key), plus `teachBack: [{question, rubric: string[]}]` (≥ 1).

**`scenario`**
```jsonc
"brief": "…", "constraints": ["…"],
"clarifications": [{ "askAbout": ["…"], "reveal": "…" }],
"acceptableArchitectures": [{ "id": "…", "summary": "…",
   "mustInclude": ["…"], "strengths": ["…"], "tradeoffs": ["…"] }],   // ≥ 1; mustInclude, strengths, tradeoffs optional (C2)
"challenges": [{ "question": "…", "rubric": ["…"] }],                 // ≥ 1
"rubric": { "mustCover": ["…"], "strongSignals": ["…"], "redFlags": ["…"] }
```
`strengths` and `tradeoffs` are revealed at complete and never matched.

**`interview`:** `question`, `rubric: {mustCover[] (≥ 1), strongSignals[], redFlags[]}`, `followUps[]` (≥ 1). Each `followUps` item is `{question, rubric: string[]}` or a string. A string item is self-rated only, with `result: null`, like a string `followUp` (C2).

**Format mapping of the module-1 drafts (F1c-T11, format only; C12).** `verified`: a string starting `fetched-` → `true`, anything else → `false`, with the original string in `note`. `challenges[]`: `challenge` → `question`, `expected` → `rubric`. Architecture `id` = the slug of `name` (`name` itself is dropped); a slug longer than 60 characters is cut at the last `-` within 60, and the ids must stay unique (tested; architect ruling of 2026-10-15). Module id `m1`. Reference files renamed to `<referenceId>.md`. `diagnostic.json` (10 items, not exercises) stays in research; F1c adds no new exercise type.

**Format mapping of the module-2 drafts (F1c-T20, revision 6, PD-15).** The same mapping, applied to `docs/research/applied-ai/module-2/`: module id `m2`; reference files `m2-ref-NN-<topic>.md` renamed to `m2-ref-NN.md` (the `referenceIds` the exercises already use); `verified` strings `fetched-*` → `true`, every other value (`search-snippet-*`, `cited-from-memory-not-fetched`, `repo-internal-*`, `UNVERIFIED`) → `false`, with the original string in `note`. Every AWS claim therefore stays `verified: false`. `followUp` and interview `followUps` entries are already `{question, rubric}` and are copied as they are. Module 2's `diagnostic.json` (10 items, more than `LIMITS.diagnostic` = 6), `README.md` and `REVIEW.md` are not copied. The pack lexicon is unchanged by module 2.

**Caps (validator):**
- strings ≤ 2000 chars;
- ≤ 20 items per array, except `narration` ≤ 20 and `exercises` ≤ 100;
- ≤ 8 `|` alternatives per rubric item;
- reference files ≤ 50 KB;
- `lexicon.synonyms` ≤ 200 terms × 20 forms.

**Reference integrity check:** the normalized text of every `planted` statement must not appear, as a substring, in the normalized text of any reference file that the exercise lists. This heuristic is automated; human review still applies.

**`schedule.json`**
```jsonc
{ "days": 7, "minutesPerDay": 120,
  "diagnostic": ["<exerciseId>", "…"],                        // 1–6 exercises, run on day 1
  "plan": [{ "day": 1, "blocks": [{ "kind": "diagnostic" | "learn" | "catch" | "scenario" | "interview" | "review",
                                    "minutes": 30, "exercises": ["<exerciseId>"] }] }] }   // exercises omitted for review/diagnostic
```
Rules: `plan` has exactly `days` entries numbered `1..days`. Each day's minutes sum to `minutesPerDay`. Practice kinds (`catch`, `scenario`, `interview`, `review`) are ≥ 60% of total minutes ("mostly practice"; a provisional product choice). The defaults are 7 days × 120 min. For module 1, the PM and the learning-designer record the 7-day plan and the ≤ 6 diagnostic exercise ids in thread 0007 before F1c-T11 (C12). **Recorded (revision 5, PD-11):** the exact `schedule.json` is the block in thread 0007's PM DECISION of 2026-10-14. **Superseded (revision 6, PD-16):** from pack version 3, the exact `schedule.json` is the block in thread 0007's PM DECISION of 2026-10-15 (days 4–5 on module 2; module 2's interview-01 added to mock 2; days 1–3 and 7 and the diagnostic unchanged).

## Product decisions (revision 2)
- **PD-1 (readiness with string follow-ups; architect's product note, REVIEW.md B4).** Every module-1 `followUp` and interview `followUps` entry is a string, so it is self-rated only. **Decision:** readiness also counts graded scenario challenges (FR-053), instead of converting every follow-up into a rubric in F1c-T11. On top of that, F1c-T11 adopts the learning-designer's two drafted rubrics (REVIEW.md B4) for catch-06 and catch-08, keeping their question text, if the content author agrees in thread 0007; otherwise they stay strings. **Why:** this needs no new content before the interview and is one projection rule in F1c-T08. Converting every module-1 follow-up (16 `followUp` plus the interview `followUps`) is authoring work on founder-owned drafts and would delay T11. Concepts with neither kind of evidence honestly show `n/a` (FR-054). **Later:** rubric-bearing follow-ups become the authoring standard from module 2 on.
- **PD-2 (negation polarity; REVIEW.md B2, option (a); amended in revision 6, `matcher@3`).** Negators are content tokens, never stopwords. **An alternative that contains a negator matches only an answer that contains a negator** (any negator, not necessarily the same one; revision 6, PD-13). When such an alternative does match, the negation check skips it. A red flag counts only when it isn't negated (FR-021, FR-022). **Why:** correcting a misconception usually means saying "not", so the revision-1 rule made right answers `uncertain` and penalized answers that reject an anti-pattern. The revision-6 clause closes the reverse hole: under FR-017's 60% rule, a 3+ token "X not Y" alternative used to match a positive restatement of the misconception with no negator at all, and then skipped the negation check. Authors should still phrase alternatives positively where that reads naturally, which also avoids the recall loss on positive paraphrases (architect RISK R5).
- **PD-3 (met threshold; REVIEW.md B3).** `met` needs `ceil(n × 2/3 − 1e-9)` matched items, so a 3-item dimension needs 2, not 3 (FR-018). The same epsilon applies to the item-coverage ratio (FR-017).

## Product decisions (revision 3, Wave A.1)
- **PD-4 (FR-019 stuffing threshold, F1c-B20 / W-B1).** I accept the architect's `matcher@2` rule and set `stuffedMaxFunctionShare = 0.2` (FR-019).
  - **Why 0.2:** every value from 0.05 to 0.30 passes SC-003 on the measured sets. 0.2 sits below the lowest function-word share measured on a correct concise sentence (0.27) and above a 5-word keyword list padded with one article (1/6 ≈ 0.17), so that list is still capped.
  - **It is provisional.** I revisit it in thread 0007 if either of these happens: a labelled keyword list reaches `met`, or a correct sentence is capped (including the dictated rows QA adds in F1c-T01b, per the architect's dictation RISK).
  - **The evidence is thin** (2 keyword lists). So the merge also needs the enlarged labelled sets, SC-012 below.
- **PD-5 (skip = not scored, W-B2).** I adopt ADR 0002 Amendment 4 as written.
  - The reveal lists a skipped planted statement with the copy `missed.notGraded`. It never uses the word "Missed" for it, and it is never counted in `summary.misses`.
  - `sum.line` is unchanged, and no `summary.notGraded` count is added (Later). The not-scored line is enough to explain the gap, and adding a count would change a copy string that the founder already knows.
- **PD-6 (repeat stops, W-S1).** Repeat detection is keyed on a client `stopId` (FR-008).
  - A retry ("Try again") reuses the `stopId` and gets the stored body.
  - A new STOP press on the same statement is a new stop. That is the FR-037 replay path, after a late hit or a false interruption.
  - Requests without `stopId` keep the revision-2 rule, so older clients and tests behave as before.
- **PD-7 (self-rating failure is visible, W-S4).** A failed self-rating shows and speaks `err.rate` under that row, with a Try again button (inv. 7). A lost rating silently removes an SC-004 data point.
- **PD-8 (favicon vs SC-005).** **Fixed, not exempted.** `web/practice.html` declares an empty inline icon (`<link rel="icon" href="data:,">`), so the browser never requests `/favicon.ico` on the practice page, and SC-005's "0 console errors" stays literal with no filter. The card game's own 404 on `/` stays with thread 0006 and F1a, because `web/index.html` is on the Untouched list.
- **Deferred from the Wave A code review, with reasons:**
  - **W-S2 (a STOP in the gap after the last statement) → F1c-T06.** In text mode, `end.catch` is shown and `complete` is called at once, so there is no gap. In Wave A voice mode, STOP is by button or Space only. The gap only matters once the hotword lands in T06, which rewrites this handler anyway. T06 gains the acceptance line and test.
  - **O1 (backend appending bugs to tasks.md)** is a process note: bugs go through QA or thread 0007. **O2 (T05's manual browser record)** is collected by QA in F1c-T16.

## Product decisions (revision 4, after the Wave A.1 re-check)
- **PD-9 (F1c-B23: a refused request is not a network error; inv. 7).** I adopt the architect's smallest fix. Of QA's options, I take a variant of (a) plus (c), and reject (b).
  - **(a) variant: one skip per statement (FR-059).** The client keeps one skip entry per `statementId`, the one with the smallest `elapsedMs`. The server's result is unchanged: a `hit` doesn't depend on `elapsedMs`, and a `late_hit` needs `elapsedMs ≤ GRACE_MS`, so the smallest entry gives every attribution any other entry on that statement could. The list then holds at most one entry per narration statement, so at most `LIMITS.narration` = 20 = the server cap, and the 400 can't be reached. The server rule (FR-009a) is unchanged.
  - **(c): a 4xx gets its own message and a way out (FR-060).** At `complete` and at a stop, an `ApiError` with status 400–499 shows `err.rejected` with one way out, **Back to exercises** (`#picker-btn`), and no Try again or Skip. A `NetworkError` or a 5xx keeps `err.net` exactly as today. A retry can never fix a 4xx, so offering one is the stall B23 describes. The likeliest trigger is a 404 after a server restart with a bumped pack version mid-attempt (likely during F1c-T11 content work), not 21 skips.
  - **(b) rejected:** hiding Skip after 20 skips takes away the learner's only honest way past a failing stop, and (a) makes the cap unreachable anyway.
  - **Copy:** one id, `err.rejected`, true at both a stop and `complete`. It promises nothing about saved work, because a 404 "attempt not found" (a reset database) would make that untrue. The voice way out is "back" (or "back to exercises"), wired by F1c-T06 (FR-061). Until F1c-T06 merges, the copy names a voice command that isn't live yet, the same accepted gap as `intro.catch`'s "Say 'stop'" in Wave A; the button always works.
  - **Not a learning change:** attribution, grading and the reveal are unchanged, so no learning-designer review is requested.
  - **Gate:** F1c-T17 merges before F1c-T11 merges (when the founder starts on real content, per the architect's RISK in thread 0007) and before F1c-T01b runs and merges.
- **PD-10 (OQ-7: voice "try again" and "skip" at `err.net`; architect ruling, inv. 8).** Adopted as ruled, in F1c-T06 (FR-061).
  - "try again" is active only while `#net-error` is shown. "skip" is active only while `#skip-btn` is also visible. "back" / "back to exercises" is active only while `#rejected` is shown.
  - **Echo guard:** `err.net` itself says "Try again" (and `err.rejected` says "back"), so each command arms only after its panel's utterance has finished. A command heard while the message is still being spoken does nothing.
  - **Whole phrase only:** the FR-032 bare-phrase rule. The command fires only when one final segment, normalized as for "send" (FR-034), equals the phrase. "try again" inside a longer sentence does nothing.
  - The copy is unchanged: `err.net` already names both words. The card game's `err.net` (`web/app.js`, Untouched) goes to F1a-T15's voice work.

## Product decisions (revision 5, module-1 schedule)
- **PD-11 (the 7-day plan and the diagnostic; C12, LR-8).** I accept the learning-designer's PROPOSAL in thread 0007 as written. F1c-T11 copies the `schedule.json` block from thread 0007's PM DECISION (2026-10-14) exactly.
  - **Diagnostic (6, in this order):** `m1-catch-01-context-window`, `m1-catch-02-rag-vs-finetune`, `m1-catch-03-pipeline-clean` (zero-error control), `m1-catch-04-embeddings`, `m1-catch-05-structured-outputs`, `m1-interview-04-evaluate-rag`.
  - **Why `interview-04` and not the `interview-03` swap:** evaluation and production evidence are the hiring manager's explicit ask. `interview-03` overlaps `catch-02`, would leave evaluation unplaced, and is mock 1's fresh item.
  - **Checked against the validator:** 7 days, each summing to 120 min; practice kinds 780/840 = 92.9% (≥ 60%); 6 diagnostic ids (≤ `LIMITS.diagnostic` = 6); no `exercises` on `diagnostic` or `review`; all 16 ids exist in the drafts. The "schedule defaults" test in F1c-T11 is the proof.
  - **Off-app minutes (about 175) are folded into the `review` and `interview` blocks named in the thread table.** No format change in F1c. The thread table is the founder's plan of record; the JSON is the app's view of it. The plan doesn't pass by labelling alone: excluding those minutes gives 72%, and also excluding the non-app parts of both mocks gives 62.7%, still ≥ 60%.
  - **Accepted consequence (learning-designer RISK):** FR-055 `done` is all-time, so the replay blocks on days 4, 5 and 7 show as done and "Next" skips them; the founder replays from the picker. Per-day `done` is Later.

## Product decisions (revision 6, `matcher@3` and module 2)
- **PD-12 (catch-up: the founder's DECISION of 2026-10-15, thread 0007).** Recorded, not re-decided.
  - `packs/applied-ai` is at version 2 with the variant-B2 lexicon (the learning-designer's rev2 proposal without its `suspectFixes`, and with `faithful.loyal` dropped). `tests/practice-content.test.js` proves it.
  - **SC-003b and SC-003c are waived for module 1 by the founder.** Both failures stay recorded in `qa-report.md`. The SC-003b test stays in `npm test` as a `todo: 'F1c-T11'` that prints its table, so a regression stays visible. The SC-003c held-out set is spent.
  - **Grader tuning has stopped.** The self-rating is the learner's main signal, and matcher grades are advisory. The UI keeps saying "Uncertain: flagged for review" honestly. There is no API key, so the live grader stays deferred.
  - Bugs: F1c-B10 is fixed by B2 (and F1c-T19 removes the last echo contact on catch-01 s2). F1c-B11 is closed as "works as designed" (architect ruling). F1c-B12 and B13 are closed by the founder's waiver, with B2 applied.
- **PD-13 (`matcher@3` is a correctness fix, not grader tuning).** I schedule the architect's R2 rule now, as F1c-T18, inside the founder's "stop tuning the keyword grader" direction.
  - **Why it falls outside "tuning":** tuning is changing rules or content to raise agreement on a labelled set. `matcher@3` moves no gate number (SC-003 7/7 with 0 rows changed, SC-012 7/7, SC-003b identical, held-out identical) and was not chosen to raise any of them. It removes a case where **a stated misconception earns credit**: catch-06 s6's own misconception text earns correction `met` under `matcher@2`, and 47 of 64 negator-bearing alternatives in the pack are exposed. A wrong `met` teaches the wrong thing days before the interview and inflates independent mastery. That breaks the safety rule that SC-003, SC-003b and SC-003c all keep at 100% ("incorrect → never `met`"), the one gate the founder did not waive.
  - **Cost:** one S backend ticket and one S QA ticket. Neither uses the founder's preparation time, and the founder's practice data stays valid: grades already stored keep `matcher@2` (FR-014, inv. 6), and SC-004 is reported per `graderVersion`.
  - **Founder override:** if the founder counts this as tuning, they say so in thread 0007, and F1c-T18 and F1c-T21 are dropped. Nothing else depends on them.
  - **Negators:** `havent`, `hasnt`, `wasnt` and `werent` are added in the same bump (architect: they change 0 measured rows, and R2 would be inconsistent without them). `aint` is not added (not in the ruling; Later).
  - **Known gap, accepted (architect RISK R4):** an incorrect answer that contains an unrelated negator ("no", "not" anywhere) still satisfies R2. F1c-T21 measures it with a labelled row instead of assuming it. The clause-scoped rule (R2c) is Later, once module 1's contrastive alternatives are rewritten positively.
- **PD-14 (reveal wordings; content correctness, not tuning).** These change pack text that is shown, and in two cases spoken, at the reveal. The exact strings and the hand trace are in tasks.md F1c-T19. This spec doesn't quote them, because the founder is the learner.
  - **catch-01 s2 `acceptableCorrections[1]`: accept the learning-designer's optional rewording.** The current text shares 7 of the 8 tokens it needs with the flawed line, so an echo plus one word earns correction `met`. The new text shares 4 of the 7 it needs (margin 3), and it is positive (no negator).
  - **catch-04 s6 `acceptableCorrections[0]` and catch-05 s5 `acceptableCorrections[0]`: reworded by me.** These are `correctedText`, spoken in `say.corrected` and `missed.item`. Each shares 7 tokens with its flawed line, which is exactly what FR-020 needs, so echoing the flawed line earns correction `met`, and FR-021(c) never fires. Both new texts are positive and use **none** of their flawed line's content words, directly or through a lexicon form (0 of 14 and 0 of 12 tokens; 9 and 8 are needed).
    - **The trade-off:** neither new text names its topic word, because that word is in the flawed line. The catch-04 s6 text says "encoder" where the flawed line says "embedding model", and the catch-05 s5 text says "the lowest randomness setting" instead of "temperature zero". The topic word still appears in the same reveal, in `misconception`, `whyWrong` and the flawed statement itself. LR-12 asks the learning-designer whether this teaches well enough.
  - **catch-04 s6 `acceptableCorrections[1]` is also reworded** (beyond the brief, same reason). It needs 5 tokens and the flawed line gives it 4, so a realistic incorrect answer that echoes the line and adds "index" earns correction `met`. The new text shares 0 of the 5 it needs.
  - **catch-04 s6 `correct[1]` "single model per index": confirmed, no change.** It is already in the pack (B2, rev2). The flawed line gives it 1 of the 2 tokens it needs, against 2 of 2 for the original "one model per index", so it no longer completes on the line alone. The residual contact (an echo plus "index") is listed under Later, with the module-1 positive rewrites.
  - **Rule from now on (FR-062):** no `acceptableCorrections` entry and no `correct` alternative may match its own planted stop's flawed line under the current matcher. F1c-T19 adds the echo probe test that enforces it for module 1, and F1c-T20 extends it to module 2.
  - The research drafts are not edited (founder-owned). The pack's divergence from the drafts is listed in `tests/practice-content.test.js`, as for B2.
- **PD-15 (module 2 in the app).** F1c-T20 loads `docs/research/applied-ai/module-2/` into `packs/applied-ai` as module `m2`, "Agents and embeddings in depth", with the format-only mapping above. That is 17 exercises (3 learn, 9 catch including 2 zero-error controls, 1 scenario, 4 interview) and 11 reference notes.
  - **Exercise order in `practice.json`:** the README's suggested order (learn-01, catch-01, catch-02, learn-02, catch-03, catch-04, catch-05, learn-03, catch-06, catch-07, catch-08, catch-09, scenario-01, interview-01, interview-02, interview-03, interview-04).
  - **The diagnostic stays module 1's 6 ids. Module 2's `diagnostic.json` is not copied** (REVIEW.md L7: 10 items against `LIMITS.diagnostic` = 6). Its items aren't exercises, the diagnostic already ran on day 1, and module 2 is first met on day 4. A module-2 placement set is Later.
  - **AWS claims stay `verified: false`** (19 rows in the module-2 README), under the same OQ-1 terms as module 1: there is a later fact pass once `docs.aws.amazon.com` is reachable, and the founder doesn't fact-check items they will practise on.
  - **No labelled answer set exists for module 2** (by instruction), and grader tuning has stopped (PD-12). So module 2's AI-quality gate is structural: it validates, it holds no exposed negator alternative (SC-014), and it passes the echo probe on every planted stop (SC-015). Module-2 grades are advisory, like module 1's.
  - **One pack bump for PD-14, PD-15 and PD-16 together: version 2 → 3,** in F1c-T20. F1c-T19's content edit lands in the same push as F1c-T20 and doesn't change `version`. The loader refuses changed content under a stored version, so running T19 alone against a database that holds `applied-ai@2` would drop the track. Bump between founder sessions, never mid-attempt (F1c-B23). If T20 is blocked on a module-2 content defect, T19 may land alone, and then it carries the bump to 3 and T20 bumps to 4.
  - **Defect handling:** if a module-2 draft fails validation or the echo probe, F1c-T20 does not fix the content. It names the exercise and statement ids (no text) in thread 0007, and the learning-designer fixes the draft, which the founder accepts or reverts as with any research edit.
  - **Mastery across modules:** where a module-2 exercise uses a concept id that module 1 also uses, both modules' results feed that concept. FR-052 is per concept, pack-wide; this is intended. Events stored under `applied-ai@2` stay in mastery, because every module-1 id is still in version 3 (FR-051).
  - **Readiness (PD-1):** every module-2 `followUp` and interview `followUps` entry is rubric-bearing, so `failureModesTradeoffs` and `defendDecision` are gradable for module-2 concepts.
- **PD-16 (the schedule swap; the module-2 README's advisory proposal, adopted with three adjustments).** Days 4 and 5 move to module 2. The exact block is in thread 0007's PM DECISION of 2026-10-15, and F1c-T20 copies it.
  - **Day 4, agents:** learn 20 (learn-01, learn-02) · catch 45 (catch-01, catch-02 zero-error, catch-03, catch-04, catch-05) · interview 35 (interview-02, interview-04) · review 20.
  - **Day 5, production, evaluation and embeddings:** learn 10 (learn-03) · catch 40 (catch-07, catch-08, catch-06 zero-error, catch-09) · interview 25 (interview-03) · review 45.
  - **Day 6, mock 2:** the interview block becomes m1 interview-01 (RAG design, still fresh) **plus m2 interview-01** (agent evaluation, still fresh) for the mock's "agents, 10 min" slot. Minutes are unchanged.
  - **Days 1–3 and 7 and the diagnostic are unchanged.** `interview-01` of both modules stays unseen until mock 2.
  - **Adjustments to the README's split, with reasons:**
    1. **m2 catch-04 (memory and state) moves to day 4,** so day 4 holds all of agent mechanics and day 5 holds production, evaluation and retrieval.
    2. **m2 catch-08 (agent evaluation, multi-agent) goes on day 5, not into day-7 review.** Day 7 is "no new material" by the plan's own rule, and the day before the interview runs day 7. On day 5 it sits next to catch-09, the "a signal isn't correctness" look-alike (one trial ≠ reliability; recall@k ≠ answer accuracy). That is the interleaving the plan already uses on day 4.
    3. **m2 interview-04 (defend my build, agents) is in day 4's interview block.** It replaces the off-app "defend, agents framing" pass with the same content, done aloud in the app. The founder reads `m2-ref-11` first (a reference note, safe to read; about 5 min inside the block).
  - **m2 scenario-01 is not scheduled.** It is available from the picker. Scheduling it is Later.
  - **Checked by hand against `validatePracticePack`** (F1c-T20's test is the proof):
    - every day sums to 120 min;
    - practice kinds total 750/840 = **89.3%** (gate ≥ 60%; the learning-designer's bound for the swap ≥ 85%);
    - excluding the about 160 off-app minutes (175 − the 20-min day-4 defend pass + 5 min of reading): 590/840 = 70.2%;
    - also excluding the non-app parts of both mocks (mock 1: 23 min; mock 2: 45 min, because the agents slot is now in-app): 522/840 = 62.1%;
    - 6 diagnostic ids; no `exercises` on `diagnostic` or `review` blocks; every id exists in pack version 3.
  - **Accepted cost:** module 1's planned second exposures on days 4–5 (catch-01/02/04/05/06/08, interview-03/04) go. Module-1 spacing now rests on the review blocks on days 4–7 (weakest concept first, FR-056) and on day 7's replays. That is the right trade for an interview that asks for agents by name, and module 1 has none. LR-11 asks the learning-designer to check it.

## User stories (prioritized; each independently testable)

**Hands-free rule (inv. 8, C11):** one tap starts a session (browsers require a user activation before audio and the mic). Everything after that tap chains by voice: within an exercise, from the reveal or `done` to the next exercise, and from the progress page into review or the diagnostic.

### US1: Catch-and-correct in text mode (P1): first usable loop
The learner opens `/practice.html`, picks the track and a catch exercise, and reads statements appearing at reading pace. They press **Stop** (or Space) on a wrong statement and type what's wrong and the correct version. They see per-dimension feedback and the corrected statement, then continue. At the end they see what they missed, the reference, the sources and the rubric, and rate themselves.
**Why P1:** this is the core practice the founder needs this week. Everything else builds on it.
**Independent test:** with only F1c-T02–T05 merged, a catch exercise from the fixture pack completes keyboard-only, and its events rebuild the result.
**Acceptance scenarios (text mode; the voice twins are in US2):**
1. Given the picker, when the learner starts a catch exercise, then `POST /api/practice/attempts` returns narration `{id, text}` only, and no response before grading contains any hidden key (FR-004).
2. Given statement `s3` is planted, when the learner stops on `s3` and submits an answer covering the rubric, then detection is `hit`, explanation and correction are `met`, and the copy `fb.hit.met` plus `say.corrected` appear. Narration then continues at `s4`.
3. Given `s2` is clean, when the learner stops on `s2`, then detection is `false_interruption`, the copy `fb.false` appears, nothing about any other statement is returned, and narration restarts `s2` from its beginning.
4. Given the stop lands 1500 ms into `s4` and `s3` is planted and uncaught, then the stop is attributed to `s3` (`late_hit`), and `s4` is re-shown from its start after feedback (FR-012).
5. Given an answer with valid alternative wording that matches an `acceptableCorrections` entry but not `rubric.correct`, then correction is `met` (FR-020).
6. Given a long answer (≥ 20 content words) that matches no rubric item, then the dimension is `uncertain`, the copy shows "Uncertain: flagged for review", and no score is shown (FR-021).
7. Given the narration ends, when complete is called, then missed planted statements are revealed with `whyWrong` and `correctedText`, followed by the reference (as text), sources (as links per FR-039; unverified ones marked "(not yet verified)") and each answered stop's rubric with matched and missing items. The learner can rate each answered stop "I had it", "Partly" or "I missed it" (FR-016).
8. Given a zero-planted exercise and no stops, when complete is called, then `cleanPass: true` and the copy `end.clean` appears.
9. Given the learner presses "Show the reference (counts as assisted)" mid-narration, then the reference appears, and every later graded stop in this attempt has `assisted: true`. Earlier stops keep `assisted: false` (FR-015).
10. Given the stop request fails at the network level, then `err.net` appears, the typed answer is kept, and "Try again" re-posts it idempotently (FR-008).
11. Given an answer that corrects the statement with a negation ("it is not fully deterministic") against a rubric item that itself contains a negator, then that item is matched and the dimension is not made `uncertain` by the negation rule (FR-021(b), PD-2).
12. Given the reveal, when the learner presses **Next**, then the next exercise starts: the next one in today's plan once F1c-T10 has merged, the picker before that (FR-058).
13. Given a stop on planted `s3` whose request failed (`err.net`), when the learner presses **Skip this stop** and the set runs to the end without `s3` being caught, then the `complete` request carries `skipped: [{statementId: "s3", elapsedMs}]`. The reveal shows `s3` with the copy `missed.notGraded`, and the word "Missed" appears in no line about `s3`. `summary.misses` doesn't count `s3`, and the stored `completed` event lists `s3` in `notGradedStatementIds`, not in `missedStatementIds` (FR-009a, PD-5).
14. Given a late hit on `s3` from a stop 800 ms into clean `s4`, when `s4` replays and the learner stops on `s4` again, then the second stop is a new stop: detection `false_interruption`, the copy `fb.false` appears, and a second `stopped`/`explained`/`graded` triple is written. Pressing **Try again** after a failed stop request re-sends the same `stopId` and gets the stored body, with no new events (FR-008, PD-6).
15. Given the reveal, when a self-rating request fails, then `err.rate` appears under that row with a **Try again** button, and the rating buttons keep their previous pressed state. Try again re-posts the same rating, and on success the button gets `aria-pressed="true"` and the error is removed (PD-7).
16. **(Revision 4, F1c-B23, PD-9.)** Given the narration has ended and `POST …/complete` returns a 4xx (for example a 404 after the server restarted with a bumped pack version), then `#rejected` shows `err.rejected`, `#net-error` stays hidden, and no Try again or Skip is offered. Pressing **Back to exercises** opens the picker with the track's exercise list re-fetched, and starting an exercise from it works. The same holds when a stop request returns a 4xx: `err.rejected` replaces `err.net`, and the answer panel closes. A `NetworkError` or a 5xx at either point still shows `err.net` with Try again, as in US1.10 (FR-060).
17. **(Revision 4, F1c-B23, PD-9.)** Given 21 failed stop requests on `s1`, each followed by **Skip this stop**, when the set runs to the end, then exactly one `complete` request is sent, its `skipped` holds exactly one entry for `s1` (the smallest `elapsedMs` of the 21), it returns 200, and the reveal appears (FR-059).

### US2: Catch-and-correct in voice mode (P1)
The same loop, hands-free: statements are spoken. Saying "stop" cuts speech immediately, and the learner dictates into an editable transcript, then says "send". Feedback and the corrected statement are spoken, and narration resumes. At the reveal, "next" moves on.
**Why P1:** voice-first is invariant 8. It is how the founder practises away from the desk.
**Independent test:** in e2e with the speech stubs, a full catch exercise completes, and the next one starts, with no clicks after Start.
**Acceptance scenarios (voice mode):**
1. Given narration is speaking `s3`, when the recognizer yields an interim result containing "stop", then `speechSynthesis.cancel()` is called within 300 ms (fake clock), `s3` stays highlighted as the interrupted statement, and listening for the answer starts (FR-030, FR-031).
2. Given dictation is in progress, when the learner edits the textarea, then dictation stops and the typed edit is kept. Nothing is submitted until "send", the Submit button or Enter (FR-033).
3. Given a final recognition segment (`onSegment` with `isFinal: true`) equal to "send" or "send it", then that word is removed from the answer and the answer is submitted (FR-034).
4. Given a hit, then the feedback text is spoken exactly as displayed, followed by "Corrected: {correctedText}", and narration resumes at the next statement (FR-035, inv. 9).
5. Given a late hit, then after feedback the interrupted statement is spoken again from its start.
6. Given the current statement's own text contains a hotword phrase, then the hotword fires only if a recognition segment consists of the phrase alone (FR-032).
7. Given speech recognition is unavailable or permission is denied, then `mic.denied` is shown and spoken, the session continues in text mode, and the Stop button and Space keep working (FR-036).
8. Given voice mode, then the Stop button and Space still stop narration at any time.
9. Given the reveal or `done` state, then `next.hint` is spoken and shown, and when the recognizer yields a final segment "next", the next exercise starts exactly as the Next button would (FR-058).
10. **(Wave A.1, voice twin of US1.13.)** Given voice mode and a skipped stop on planted `s3`, then `err.net` is spoken exactly as shown when the request fails. At the reveal, the `missed.notGraded` line for `s3` is spoken exactly as shown, in the position where missed lines are spoken (after `sum.line`) (FR-035).
11. **(Wave A.1, voice twin of US1.15.)** Given voice mode and a failed self-rating, then `err.rate` is spoken exactly as shown. Retrying is by the Try again button; the voice rating commands arrive with F1c-T06, and saying the rating again then retries it.
12. **(F1c-T06, deferred W-S2.)** Given voice mode and the last statement has finished, when the learner stops (hotword, button or Space) while `end.catch` is being spoken, then the stop is posted for the last statement, with `elapsedMs` measured from that statement's start, and is graded like any stop on it (edge case "stop in the gap").
13. **(Revision 4, voice twin of US1.16; F1c-T17, then F1c-T06.)** Given voice mode and a 4xx at `complete` or at a stop, then `err.rejected` is spoken exactly as shown (FR-035). From F1c-T06 on, once that utterance has finished, a final segment "back" or "back to exercises" opens the picker exactly as the button would. The same words said while `err.rejected` is still being spoken do nothing. Before F1c-T06 merges, the button is the way out (FR-060, FR-061).
14. **(Revision 4, OQ-7, F1c-T06.)** Given voice mode and a failed stop request, when `err.net` has finished being spoken and a final segment is "try again", then the stop is re-posted with the same `stopId`, exactly as the Try again button would. When the final segment is "skip", the stop is skipped exactly as **Skip this stop** would. "skip" does nothing when `#skip-btn` is hidden (a failed `complete`). Either phrase said while `err.net` is still being spoken, or inside a longer sentence ("let me try again later"), does nothing (FR-061).

### US3: Learn mode with teach-back (P2)
The learner hears (voice) or reads (text) an error-free explanation. They answer each teach-back question by voice or text. After the last answer they see the rubric and reference, rate themselves, then answer the follow-up and transfer questions.
**Independent test:** a learn exercise completes in voice mode and in text mode, writing one `graded` per teach-back question.
**Acceptance scenarios:**
1. Given voice mode, when the narration ends, then "Teach it back: {question}" is spoken and shown, and listening starts. Given text mode, the same prompt is shown with a focused textarea.
2. Given learn mode, then no Stop control is shown and there is no hotword. "pause" / "resume" are Later.
3. Given each answer, the response contains `next` (the next question, or `null`) and no result. Results, the rubric and the reference arrive at complete (FR-041).
4. Given the reveal, voice: "continue" goes to the follow-up and "next" skips to the next exercise. Text: the Continue and Next buttons do the same (FR-058).

### US4: Technical interview format (P2)
The learner gets an interview question, answers by voice or text, then answers each follow-up in turn. At complete they see mustCover, strongSignals and redFlags with their matches, and rate themselves.
**Independent test:** an interview exercise in both modes yields an `explanation` dimension from mustCover, a `defense` dimension per rubric-bearing follow-up, and `result: null` for each string follow-up.
**Acceptance scenarios:**
1. Voice: the question is spoken as "Interview question: {question}". Text: it is shown. Each answer returns the next follow-up as `next.prompt`, with no grading feedback until complete.
2. Given an answer that matches a `redFlags` item with no negator before it, then that dimension is `uncertain` (never `met`), and the red flag is listed at reveal (FR-022).
3. Given an answer that names and rejects a red flag ("I wouldn't fine-tune for knowledge"), then the red flag is not counted and the dimension is not made `uncertain` by it (FR-022, PD-2).
4. Given a string follow-up, then its answer is stored, its result is `null`, and it can be self-rated at reveal (C2).

### US5: Customer scenario (P2)
The learner reads or hears a brief and constraints. They ask clarifying questions, and each matching clarification is revealed once. They say "ready" (voice) or press Ready (text), describe a design, and answer the customer's challenges. They get results at complete.
**Independent test:** a scenario exercise in both modes; one clarification revealed by a matching question; a non-matching question gets `clarify.none`.
**Acceptance scenarios:**
1. Given a question that matches an `askAbout` term, then `Customer: {reveal}` is shown and spoken. Asking again returns the same reveal and writes one more `clarified` event.
2. Given a design answer that matches no `acceptableArchitectures[].mustInclude` set, then the explanation status is at most `partial`. If the answer has ≥ 20 content words and matches nothing, the status is `uncertain` (FR-021, FR-043).
3. Given a scenario whose architectures have no `mustInclude`, then the design status equals the `mustCover` status (FR-043).

### US6: Progress, schedule, diagnostic and review weaknesses (P3)
The learner sees today's plan (day N of 7) from `schedule.json`. They can run the diagnostic (no assist) and see per-concept mastery (independent and assisted shown separately), readiness criteria, and a flagged-for-review list with self-ratings. "Review weak spots" starts the exercise for the weakest concept.
**Independent test:** after a scripted set of attempts, `GET …/progress` equals a frozen expected projection, and the same projection results after a server restart.
**Acceptance scenarios:**
1. Given no practice events yet, then the progress page shows Day 1 and the diagnostic block first. Voice: the page title, today's blocks and `progress.commands` are spoken. Text: they are shown.
2. Given an assisted `met` and an independent `not_met` on the same concept, then `independent.score` is 0 and `assisted.score` is 1. They are never merged (FR-052).
3. Given a diagnostic attempt, then the assist control is absent, and `POST …/assist` returns 400.
4. Given "Review weak spots" (button, or the voice command "review" on the progress page), then the exercise started is the least recently attempted exercise covering the lowest-scoring independent concept (FR-056). With no review items, `review.empty` is shown and spoken.
5. Every readiness panel shows the copy `progress.provisional`.
6. Given the progress page, when the learner says "diagnostic" or presses "Run the diagnostic", then the first diagnostic exercise not yet done starts with `mode: "diagnostic"` (the first one if all are done) (FR-057, FR-058).
7. Given a concept covered only by exercises with string follow-ups and no scenario challenges, then "Failure modes and trade-offs" and "Defends a decision" show `n/a`. Given 2 scenario challenges answered `met` independently for a concept, both show "Met" (FR-053, PD-1).

### US7: Module 2, and no credit for a stated misconception (P1; revision 6)
The founder picks a module-2 exercise (agents, or embeddings in depth) and practises it exactly like module 1, by voice or by text. On days 4 and 5, "next" walks the module-2 items in the plan. Separately, an answer that restates a misconception never earns credit, whether it echoes the flawed line or restates the opposite of a "not" alternative without saying "not".
**Why P1:** agents are in the hiring manager's ask and absent from module 1. A misconception graded `met` teaches the wrong thing days before the interview.
**Independent test:** with F1c-T18 to T20 merged, `GET /api/practice/tracks/applied-ai` lists modules `m1` and `m2`. An m2 catch exercise runs to its reveal in both modes. The echo probe (SC-015) and the exposure probe (SC-014) pass on the whole pack.
**Acceptance scenarios:**
1. Given pack version 3 is loaded, when the picker opens (text and voice mode alike: the picker behaves exactly as it does for module 1 today), then the track lists module `m2`, "Agents and embeddings in depth", with its 17 exercises in the PD-15 order. Starting any of them returns narration or the first prompt only, and the response passes `practiceLeakScan` (FR-004, FR-063).
2. Given text mode and m2 catch-01, when the learner stops on a planted statement and types a correct answer, then the stop is graded and the hit feedback and `say.corrected` appear, exactly as in US1.2.
3. Given voice mode and the same stop, when the learner says "stop", dictates the answer and says "send", then the feedback and "Corrected: {correctedText}" are spoken exactly as shown (FR-035), and narration resumes, exactly as in US2.4.
4. Given text mode and m1 catch-05, when the learner stops on `s5` and types the flawed statement back word for word, then correction is not `met`, the dimensions are `uncertain`, and `fb.hit.uncertain` appears. The same holds for m1 catch-04 `s6` and m1 catch-01 `s2` (FR-021(c), FR-062).
5. Given voice mode and the same echo, dictated, then `fb.hit.uncertain` is spoken exactly as shown, followed by "Corrected: {correctedText}" with the revision-6 wording (FR-035).
6. Given a rubric alternative containing a negator (for example `beacon not lit tonight`), when an answer restates the opposite with no negator anywhere ("the beacon was lit tonight"), then that alternative doesn't match, and the dimension isn't credited through it. The same answer with "not", "never" or "hasn't" does match (FR-017, `matcher@3`). The client is unchanged, so voice and text behave alike: the dictated transcript is the answer text.
7. Given day 4 of the schedule and nothing done yet that day, when the learner says "next" (voice) or presses Next (text) at a reveal, then the next exercise is the first undone id of day 4's blocks: m2 learn-01 first (FR-058, once F1c-T10 has merged; the picker before that).
8. Given the learner was mid-attempt when the server restarted on pack version 3, when they stop or reach the end, then `err.rejected` appears (shown; spoken in voice mode), and **Back to exercises** (or "back", from F1c-T06) opens the picker with the version-3 track (FR-060, as in US1.16 and US2.13).

## Spoken copy (exact; shown text equals spoken text unless marked "shown only")
`{x}` comes from the pack or the server and is rendered with `textContent`. These strings live in `web/practice/copy.js` (F1c-T05 creates it; later tickets append).

| id | Text (shown and spoken) | When |
|---|---|---|
| `picker.empty` | No practice tracks are loaded. | `GET /api/practice/tracks` returns `[]` |
| `intro.catch` | Listen for statements that are wrong. Say "stop", press Stop or press Space when you hear one. Some sets have no errors. | Before catch narration (text mode: shown only; "say" is still listed) |
| `intro.learn` | Listen to the explanation. Afterwards you'll teach it back. | Before learn narration |
| `prompt.stop` | What's wrong, and what should it say? | After a STOP |
| `fb.hit.met` | Good catch. {whyWrong} | Hit, overall `met` |
| `fb.hit.partial` | You caught it. Here's the full picture: {whyWrong} | Hit, overall `partial` |
| `fb.hit.not_met` | Right statement to stop on. Here's why it's wrong: {whyWrong} | Hit, overall `not_met` |
| `fb.hit.uncertain` | Right statement to stop on. I can't score your answer reliably, so it's flagged for review. {whyWrong} | Hit, overall `uncertain` |
| `fb.late.prefix` | That was the previous statement. | Prepended (with one space) to any `fb.hit.*` on a late hit |
| `fb.false` | That statement is accurate. Let's carry on. | False interruption |
| `say.corrected` | Corrected: {correctedText} | After a hit's feedback, before resuming; also shown under the statement |
| `btn.assist` | Show the reference (counts as assisted) | Button label (shown only) |
| `assist.spoken` | The reference is on screen. Answers from here on count as assisted. | After assist |
| `end.catch` | That's the end of the set. | Narration finished |
| `sum.line` | Caught {hits} of {planted}. Missed {misses}. Stopped on {f} accurate statement. / …{f} accurate statements. | Reveal (singular only when f = 1) |
| `end.clean` | This set had no errors, and you didn't stop on any accurate statement. Well judged. | `cleanPass: true` |
| `missed.item` | Missed: {text} {whyWrong} Corrected: {correctedText} | Each missed planted statement (a `missed[]` item without `notGraded`) |
| `missed.notGraded` | Not scored, you skipped this stop: {text} {whyWrong} Corrected: {correctedText} | **(Wave A.1, PD-5)** Each `missed[]` item with `notGraded: true`. Shown in `#missed-list`, and spoken in the same position as `missed.item` |
| `status.met` / `.partial` / `.not_met` / `.uncertain` | Covered / Partly covered / Not covered / Uncertain: flagged for review | Status labels |
| `dim.*` | Explanation / Correction / Transfer / Trade-offs / Defense, rendered as "{dim}: {status}" | Dimension rows in feedback and reveal. Spoken after the feedback text, one per row |
| `selfrate.prompt` | Compare your answer with the reference. How did you do? | Per answered part at reveal |
| `selfrate.options` | I had it / Partly / I missed it | Buttons. Voice: "had it", "partly", "missed it" |
| `next.hint` | Say "next" or press Next for the next exercise. | Reveal and `done` states, after the self-rating prompt (C11) |
| `btn.next` | Next | Button label (shown only), `#next-btn` |
| `plan.done` | That's everything planned for today. Your progress is saved. | "next" when today's plan has no exercise left; then the progress page opens (F1c-T10) |
| `q.teachBack` | Teach it back: {question} | Learn |
| `q.interview` | Interview question: {question} | Interview |
| `q.followUp` | Follow-up: {question} | Interview follow-ups and the common follow-up |
| `q.transfer` | New situation: {scenario} | Transfer |
| `sc.brief` | Customer brief: {brief} Constraints: {c1}; {c2}. Ask the customer anything, or say "ready" when you want to give your design. | Scenario start (text mode: "or press Ready") |
| `sc.reveal` | Customer: {reveal} | Clarification matched |
| `clarify.none` | The customer doesn't have more on that. | No match |
| `sc.design` | Describe your design. | After "ready" |
| `sc.challenge` | The customer pushes back: {question} | Each challenge |
| `err.net` | Couldn't reach the server. Your answer is still here. Try again, or skip and this stop won't be scored. | A stop or `complete` request failed with a `NetworkError` or a 5xx (revision 4: never on a 4xx, FR-060); buttons "Try again", "Skip this stop" ("Skip" not shown for a failed `complete`). From Wave A.1 the promise holds: a skipped stop is never scored as a miss (FR-009a). Voice "try again" / "skip" from F1c-T06 (FR-061) |
| `err.rate` | Couldn't save your rating. Try again. | **(Wave A.1, PD-7)** A self-rating request failed. Shown under that answered part's rating buttons, and spoken in voice mode |
| `btn.retry` | Try again | **(Wave A.1)** Button label (shown only), the `button.rate-retry` next to `err.rate` |
| `err.rejected` | The server can't continue this exercise, and trying again won't help. Say "back" or press Back to exercises. | **(Revision 4, PD-9, F1c-T17)** A stop or `complete` request returned a 4xx (`ApiError`, status 400–499). Shown in `#rejected-msg` and spoken in voice mode; no Try again, no Skip. Voice "back" is live from F1c-T06 (FR-061) |
| `btn.picker` | Back to exercises | **(Revision 4, F1c-T17)** Button label (shown only), `#picker-btn` under `err.rejected` |
| `mic.denied` | The microphone isn't available. Type your answer instead. | No recognizer, permission denied, or 3 recognizer errors in a row |
| `src.unverified` | (not yet verified) | Shown only, after a source with `verified: false` |
| `progress.provisional` | Readiness thresholds are a provisional product choice. | Progress page, shown and spoken on open |
| `progress.commands` | Say "review" to practise your weak spots, or "diagnostic" to run the diagnostic. | Progress page, shown and spoken after `progress.provisional` (C11) |
| `btn.review` / `btn.diagnostic` | Review weak spots / Run the diagnostic | Button labels (shown only), `#review-btn`, `#diagnostic-btn` |
| `review.empty` | Nothing to review yet. Start with today's plan. | "review" when `GET …/review` returns no items |
| `done` | Done. Your progress is saved. | After transfer; followed by `next.hint` |

**Revision 6: no new copy id, no new voice command, no new repair path.** The changes are pack text, rendered through existing ids:

| What changes | Where it appears | Shown / spoken |
|---|---|---|
| m1 catch-04 `s6` and m1 catch-05 `s5` `acceptableCorrections[0]` (= `correctedText`; exact strings in tasks.md F1c-T19) | `say.corrected` after a hit; `missed.item` / `missed.notGraded` at the reveal | Shown and spoken, equal (FR-035) |
| m1 catch-01 `s2` `acceptableCorrections[1]`; m1 catch-04 `s6` `acceptableCorrections[1]` | The answered stop's rubric block at the reveal | Shown; spoken wherever the reveal speaks the rubric block today (no change) |
| Module title "Agents and embeddings in depth" and the 17 m2 exercises' `objective` text | Picker (`#exercise-list`) | Shown only, as for module 1 |
| m2 narration, feedback `{whyWrong}`, `{correctedText}`, prompts | Every existing copy id that takes pack text (`fb.*`, `say.corrected`, `missed.*`, `q.*`, `sc.*`) | As for module 1 |

Voice commands and repair paths are those above. A pack bump mid-attempt is repaired by `err.rejected` → **Back to exercises** / "back" (US7.8).

**Voice commands (matched before anything is treated as an answer, only in the listed state):**

| Command | State | Action |
|---|---|---|
| "stop", "hold on" | Narrating (catch) | STOP |
| "send", "send it" | Answering. Must be the whole final segment | Submit |
| "done" | Answering | Stops dictation without submitting |
| "continue" | Feedback; reveal (once F1c-T09 has merged) | Resume narration; go to the follow-up |
| "had it", "partly", "missed it" | Reveal (self-rating) | Rate the current part |
| "next" | Reveal; `done` | Next exercise (FR-058) |
| "ready" | Scenario clarifying | Go to design |
| "review" | Progress page | Start review (FR-056) |
| "diagnostic" | Progress page | Start the diagnostic (FR-057) |
| "try again" | `#net-error` shown, after `err.net` has finished being spoken. Whole final segment (revision 4, OQ-7, F1c-T06) | Same as the Try again button (FR-061) |
| "skip" | `#net-error` and `#skip-btn` shown, after `err.net` has finished being spoken. Whole final segment (revision 4, OQ-7, F1c-T06) | Same as Skip this stop (FR-061) |
| "back", "back to exercises" | `#rejected` shown, after `err.rejected` has finished being spoken. Whole final segment (revision 4, F1c-T06) | Same as Back to exercises (FR-060, FR-061) |

**Text mode:** Stop button or Space · Enter submits (Shift+Enter inserts a newline) · buttons for everything else (Next, Continue, Ready, Review weak spots, Run the diagnostic).

**Repair paths:**
- **Misheard answer:** edit the transcript, or press "Talk again", which replaces the text.
- **Hotword missed:** the button and Space always work.
- **Wrong stop:** a false interruption costs nothing beyond the count.
- **Grade looks wrong:** self-rate "I missed it" or "I had it". The disagreement is recorded for κ.
- **Network failure (`NetworkError` or 5xx):** "Try again" (re-sends the same `stopId`; never double-counted) or "Skip this stop" (shown as `missed.notGraded` at the reveal; never a miss). By voice, "try again" or "skip" once `err.net` has been spoken (F1c-T06).
- **Server refused the request (4xx, revision 4):** `err.rejected` with **Back to exercises**, or "back" once `err.rejected` has been spoken (F1c-T06). The picker re-fetches the track, so a new attempt runs on the pack version now loaded.
- **Self-rating failure (Wave A.1):** `err.rate` plus the Try again button; pressing a rating button again also retries.
- **Mic failure:** automatic switch to text mode.
- **Command not heard ("next", "review", "diagnostic"):** the matching button always works.

## Edge cases
- **Unknown track or exercise** → 404 `{error}`. **Unknown attempt** → 404. **Bad JSON** → 400. **Body over 1 MB** → 413 (`readBody`).
- **Engine isolation (ADR 0002 Amendment 3):** an `att_` id on any `/api/practice/attempts/:id/*` route → 404. A `pra_` id on the card engine's `/api/attempts/:id/*` routes → 404 (F1a-T12).
- **Stop on an unknown `statementId`** → 400. **Stop on a statement earlier than the last graded stop** → 400. **Stop after complete** → 409. **Stop on a non-catch attempt** → 400.
- **Repeat and re-stop (FR-008, PD-6; revision 3):**
  - A stop whose `stopId` matches a stored stop on the same `statementId` → 200 with that stored body, and no new events.
  - The same `stopId` on a different `statementId` → 400.
  - A malformed `stopId` (not a string matching `^[A-Za-z0-9_-]{8,64}$`) → 400.
  - A new `stopId` on a statement that already has a stop → a new stop, attributed by FR-012 against the stops graded so far. The statement is clean or already caught, so this is normally a `false_interruption`.
  - A stop **without** `stopId` on a statement that already has a stop → 200 with the stored body of the latest stop on that statement, and no new events (the revision-2 rule).
  - **Accepted risk:** if a stop was graded on the server but its response was lost, and the learner then presses Skip and stops again on the same planted statement, the new stop is a `false_interruption` and the learner hears `fb.false`. This needs a lost response plus a skip plus a re-stop. The reveal still lists the statement as caught.
- **Skipped stops at complete (FR-009a, ADR 0002 Am. 4):**
  - A skipped entry that FR-012 attributes to a planted statement still uncaught at complete makes that statement **not graded**.
  - A skipped entry on a clean statement, or on a statement that is caught by the time of complete, changes no count. A skip that would have been a false interruption is not counted as one, so `cleanPass` can still be true.
  - A skipped statement after `lastStatementId` extends the reached range, so its statement is never `notReached`.
  - A repeat `complete` ignores `skipped` and returns the stored body (FR-009).
- **Stop in the gap after the last statement:** attributed to the last statement. The client half moves to F1c-T06 (W-S2, PD-8 deferrals); the server already accepts it.
- **Assist after complete (W-S3):** returns the same body as any assist, and writes no `assisted` event.
- **Client errors at a stop or `complete` (revision 4, F1c-B23, FR-060):**
  - A 4xx → `err.rejected` and Back to exercises; no request is re-sent automatically or by any control on that panel. The attempt stays without `completed`, the abandoned-attempt shape readers already handle; no event is written by the client.
  - A `NetworkError` (offline, reset, or the 12 s deadline) or a 5xx → `err.net`, as before.
  - **Pack version bumped mid-attempt:** every later stop and `complete` on that attempt returns 404 "attempt exercise is not loaded" → `err.rejected`. Back to exercises re-fetches the track, so the new attempt uses the loaded version.
  - **Repeated skips on one statement:** the client keeps one entry per statement, the smallest `elapsedMs` (FR-059), so `skipped` never exceeds the narration length (≤ 20).
- **Answer text:** empty → allowed, and all dimensions are `not_met`. Over 2000 chars → truncated server-side, and `explained.result.chars` holds the original length.
- **`elapsedMs` missing, negative or non-integer** → treated as a large value (no grace attribution). It is a client claim, an accepted risk as in ADR 0003.
- **Grace attribution only applies** if the previous statement is planted and uncaught.
- **Early complete** (the learner leaves mid-narration): planted statements after `lastStatementId` are `notReached`, never `missed`.
- **Invalid practice pack:**
  - The server starts, logs one `[practice] <dir> skipped: <reasons>` warning, and `GET /api/practice/tracks` omits it.
  - The card engine is unaffected: `listSubjects()` from `server/packs.js` deep-equals the same call with no practice pack present, and no `[packs]` warning is logged (C3). No F1c test calls `/api/subjects`, `/api/trades` or `/api/scenario`.
  - A changed pack without a version bump is refused (immutability, as in ADR 0006).
  - A manifest id already held by `getPack(id)` is refused.
- **Pack version bump:** events for exercise ids absent from the current pack version are left out of mastery and readiness, and counted in `counts` (C9).
- **Revision 6 edge cases:**
  - **Version 2 → 3 with stored events:** every module-1 id is still in version 3, so `applied-ai@2` events stay in mastery and readiness. `outOfVersion` doesn't grow (FR-051).
  - **Content changed under a stored version** (F1c-T19 run alone against a database that holds `applied-ai@2`): the loader refuses the pack with one `[practice]` warning and the track disappears. That is a degrade, not a crash, and it is why T19 and T20 land in one push with one bump (PD-15).
  - **A module-2 draft fails validation or the echo probe:** F1c-T20 stops and reports ids only; nothing partial is loaded (PD-15).
  - **An answer that echoes the flawed line:** with no correction alternative matched, every dimension is `uncertain` (FR-021(c)). The echo probe (SC-015) proves no correction alternative completes on a flawed line.
  - **An incorrect answer with an incidental negator** ("No doubt …", "not sure, but …"): R2 is satisfied, so a negator-bearing alternative can still match it (architect RISK R4, accepted, PD-13). F1c-T21 measures it. If such a row grades overall `met`, it is a major bug.
  - **"hasn't", "haven't", "wasn't", "weren't"** within 3 words before a matched token now make that dimension `uncertain`, like the other negators (FR-021(b)).
  - **Grades from before the bump** keep `graderVersion: "matcher@2"` and are never regraded (FR-014). Progress and κ group by version.
- **Reference markdown** is shown with `textContent` in a `white-space: pre-wrap` block. HTML in it appears as literal text.
- **Source links:** a source whose `url` fails the `https://` check never loads (validator), so the client never builds a non-https link (FR-039).
- **Self-rating:** before complete, or for a part with no learner answer (a miss or a not-graded statement) → 400. Repeat ratings append, and the latest wins in projections. A failed request shows `err.rate` (PD-7).
- **Hotword echo:** TTS audio heard by the mic. Handled by FR-032. Headphones are recommended in the intro help text (shown only).
- **Assist is idempotent.** A second call returns the same reference and writes no second `assisted` event.
- **A concept with no exercise that can satisfy a readiness criterion** shows that criterion as "n/a" (FR-054). It is never counted as met.
- **"next" with no plan available** (before F1c-T10, or the schedule request fails): the picker is shown.

## Functional requirements

**Content and loading**
- **FR-001:** `validatePracticePack(manifest, files)` MUST apply every schema rule and cap above, including the `|` alternative rules. It returns a list of problems, never throws, and accepts zero-planted catch exercises. The old `validateScenario` (exactly 3 mistakes) is unchanged and is not used by this engine.
- **FR-002:** `loadPracticePacks(dir)` MUST load every `packs/<dir>/practice.json` at startup, after `loadPacks()` and before listen, using the `server/packs.js` pattern:
  - validate first, then skip with one `[practice]` warning;
  - refuse a manifest id that `getPack(id)` already holds;
  - deep-freeze;
  - use `Map` registries;
  - store canonical JSON of the manifest, schedule, exercises and references through `db.putPack`, and refuse on `'conflict'`.
  - A directory without `practice.json` is ignored silently by this loader. `server/packs.js` skips, silently, a directory with `practice.json` and no `pack.json` (ADR 0008 ARCH-1).
  - The directory defaults to `packs/`, and `PRACTICE_PACKS_DIR` overrides it, so tests can load fixture packs. **It is a folder of pack folders** (`<dir>/<packFolder>/practice.json`), never a single pack folder. Pointing it at a pack folder itself loads 0 tracks, with no warning (F1c-B22). Examples: `PRACTICE_PACKS_DIR=tests/fixtures/practice` loads both fixture tracks; the acceptance tests copy `accept-pack` into `<tmp>/kite-craft` with `acceptPacksDir()` from `tests/acceptance/practice-helpers.mjs`.
- **FR-003:** Engine code (`server/**/practice*`, `web/practice*`) MUST contain no subject words. It passes the deny-list test with the Applied AI words and the track id `applied-ai` added (F1c-T01a; C15) and an unchanged allow-list. Engine code reads the track id from the pack, never from a literal.
- **FR-062 (echo-safe corrections; revision 6, PD-14):** for every planted statement of every catch exercise in `packs/applied-ai`, the statement's own narration text, submitted as the answer to a stop on it and graded against the loaded pack and lexicon, MUST NOT grade correction `met` or overall `met`. For m1 catch-01 `s2`, m1 catch-04 `s6` and m1 catch-05 `s5`, overall MUST be `uncertain` (the FR-021(c) echo rule fires). Proved by the echo probe test (F1c-T19 for module 1, extended by F1c-T20 to module 2).
- **FR-063 (module 2 in the pack; revision 6, PD-15):** `packs/applied-ai` version 3 MUST hold module `m2` ("Agents and embeddings in depth") with exactly the 17 module-2 draft exercises, in the PD-15 order, each equal to its draft under the format mapping, plus the 11 reference notes renamed to `m2-ref-NN.md` byte for byte. It MUST validate with 0 problems, and module 1 (with its B2 and PD-14 edits) and the lexicon MUST be unchanged by it. Every source whose draft `verified` is not `fetched-*` MUST have `verified: false` and its original string in `note`. `listSubjects()` from `server/packs.js` is unchanged (C3).
- **FR-064 (schedule, revision 6, PD-16):** from version 3, `packs/applied-ai/schedule.json` MUST deep-equal the block in thread 0007's PM DECISION of 2026-10-15: 7 days × 120 min, practice kinds 750 of 840 min, the same 6 module-1 diagnostic ids in the same order.

**Server owns answers**
- **FR-004:** Every response before grading MUST be built by the allow-list projection `toPublicExercise(ex)` or an equivalent explicit shape. It MUST NOT contain, at any depth, the keys `answerKey`, `planted`, `clean`, `misconception`, `whyWrong`, `acceptableCorrections`, `exceptions`, `kind`, `rubric`, `explain`, `correct`, `mustCover`, `strongSignals`, `redFlags`, `clarifications`, `askAbout`, `reveal`, `acceptableArchitectures`, `mustInclude`, `strengths`, `tradeoffs`, `challenges`, `followUps`, `followUp`, `transfer`, `reference`, `sources`, `note` or `correctedText`.
  - **Exceptions (JSON-path patterns, `[]` matches any index; an allowed path also allows everything beneath it) (C5):**
    - stop response: `reveal` (a hit's reveal for that statement only; `null` otherwise);
    - clarification response: `reveal` (the matched clarification only);
    - `assist` response: `reference` (the learner asked for it, and from then on the attempt is assisted);
    - `GET …/schedule`: `plan[].blocks[].kind`;
    - `GET …/progress`: `concepts[].readiness.transfer`;
    - `answers.next.prompt` and `exercise.firstPrompt` carry question text only (no listed key);
    - `complete` and later responses for the attempt carry the reveal and are not scanned.
- **FR-005:** The browser MUST NOT import any module under `server/` or `shared/mock-grader.js`, and MUST NOT compute detection, dimensions or attribution.

**Catch attempt API** (shapes in tasks.md F1c-T04)
- **FR-006:** `POST /api/practice/attempts` MUST create an attempt `pra_<ULID>`, write `started` and return `{attemptId, exercise, assistAllowed}`.
- **FR-007:** `POST /api/practice/attempts/:id/stops` MUST:
  - resolve attribution (FR-012);
  - grade a hit with the grader;
  - write `stopped`, `explained` and `graded` in one `appendEvents` call, after grading, with no `await` between reading the attempt's events and appending;
  - return the stop response.
  - Order and replay rules are as in the edge cases. Grading is synchronous, so no in-flight state exists (ADR 0008 ARCH-7).
- **FR-008 (repeat stops; revision 3, PD-6, W-S1):** the stop request MAY carry `stopId: string` (`^[A-Za-z0-9_-]{8,64}$`, else 400), a random id the client makes once per STOP press and re-sends on Try again.
  - A stop whose `stopId` equals a stored stop's `stopId` on the same `statementId` MUST return a body identical to that stop's first response, and write no events. On a different `statementId` it MUST return 400.
  - A stop with a new `stopId` MUST be processed as a new stop (FR-007, FR-012), even when the statement already has a stop.
  - A stop without `stopId` on a statement that already has a stop MUST return the stored body of the latest stop on that statement, and write no events (the revision-2 rule).
  - The server stores `stopId` in `stopped.result.stopId`, only when the request carried one (additive; readers treat a missing value as `null`).
- **FR-009:** `POST /api/practice/attempts/:id/complete` MUST be idempotent. It writes `completed` once, and returns the summary, missed reveals, answered parts with results and rubrics, references, sources, `followUp.question` and `transfer.scenario`.
- **FR-009a (skipped stops; revision 3, ADR 0002 Am. 4, PD-5, W-B2):** the complete body MAY carry `skipped: [{statementId: string, elapsedMs?: number}]`.
  - **Validation:** `skipped` is absent, `null` or an array of at most 20 objects, and each `statementId` is a narration id of the exercise. Anything else → 400. `elapsedMs` follows the stop rule: missing, negative or non-integer means no grace attribution.
  - **Attribution:** each entry is attributed with the FR-012 rule, independently, against the stops graded so far. An entry that comes out `hit` or `late_hit` on a planted statement that is still uncaught makes that statement **not graded**.
  - **Reached range:** `lastIdx` = the maximum of `lastStatementId`'s index, every stop's index and every skipped entry's index.
  - **Stored record, in `completed.result`:**
    - `skippedStatementIds`: the entries' `statementId`s, in request order, without duplicates;
    - `notGradedStatementIds`: the not-graded planted ids, in narration order, without duplicates;
    - both are always written, possibly `[]`;
    - `missedStatementIds` and `misses` exclude not-graded ids. Caught, missed, not-graded and not-reached are disjoint and together cover every planted statement.
  - **Response:** `missed[]` lists the union of `missedStatementIds` and `notGradedStatementIds` in narration order. Each item for a not-graded statement carries `notGraded: true`; other items have no `notGraded` key. Both lists are read from the stored event (a missing `notGradedStatementIds` reads as `[]`), never recomputed. `summary` keeps its shape.
  - After the first `complete`, a repeat call ignores `skipped` and `lastStatementId` (FR-009).
- **FR-010:** On a hit, the stop response MUST include `reveal: {statementId, misconception, whyWrong, exceptions, correctedText}`, where `correctedText = acceptableCorrections[0]`, and `result: {explanation, correction, overall}`. On a false interruption, `reveal` and `result` are `null`.
- **FR-011:** `overall` MUST be:
  - `uncertain` if either dimension is uncertain;
  - otherwise `met` if both are met;
  - otherwise `not_met` if both are not met;
  - otherwise `partial`.
- **FR-012 (grace window):** if the stopped statement is clean or already caught, the previous statement is planted and uncaught, and `0 ≤ elapsedMs ≤ GRACE_MS`, the stop MUST be attributed to the previous statement with detection `late_hit`.
  - `GRACE_MS = 2000` is a named constant (provisional product choice).
  - Otherwise detection is `hit` (the stopped statement is planted and uncaught) or `false_interruption`.

**Offline assessment (the matcher)**
- **FR-013:** The matcher MUST report each dimension separately as `{status: "met" | "partial" | "not_met" | "uncertain", matched: string[], missing: string[]}`.
  - **Dimensions:**
    - `detection` (`hit` / `late_hit` / `miss` / `false_interruption`, counted per attempt);
    - `explanation`;
    - `correction`;
    - `transfer`;
    - `tradeoffs` (the common follow-up, when it has a rubric);
    - `defense` (rubric-bearing interview follow-ups and scenario challenges).
  - It never returns a numeric score to the client.
- **FR-014:** Each `graded.result` MUST record `graderSource: "matcher"` and `graderVersion` (`MATCHER_VERSION`; `"matcher@2"` from Wave A.1; `"matcher@3"` from F1c-T18, revision 6). Any change to matcher rules bumps it. Grades already stored under an older version are never regraded or rewritten (inv. 6), and SC-004 κ is reported per `graderVersion`.
- **FR-015:** After `POST …/assist` (only when `mode ≠ diagnostic`), every later `graded` in the attempt MUST carry `assisted: true`. Earlier ones keep `false`. No hint, reference or correction is sent before an answer unless assist was requested.
- **FR-016:** `POST …/self-ratings {part, rating: "had_it" | "partly" | "missed_it"}` MUST write `self-rated` with the matcher's `overall` (or dimension status) for that part copied into `result.matcherStatus`, or `null` for a self-rated-only part. This allows κ to be computed from single events.
- **FR-017 (item match):** a rubric item MUST count as matched when any of its `|` alternatives is matched (C1). An alternative with n content tokens is matched when at least `ceil(0.6 × n − 1e-9)` of them appear in the answer; alternatives with n ≤ 2 need all of them.
  - **Negator guard (`matcher@3`, revision 6, PD-2, PD-13):** an alternative whose content tokens include a negator MUST NOT match an answer whose content tokens include no negator, whatever its token count. Any negator in the answer satisfies the guard; it need not be the alternative's own. The guard applies wherever FR-017 matching is used: rubric items, `acceptableCorrections` entries (FR-020), `redFlags` and `strongSignals` (FR-022), `mustInclude` and `askAbout`.
  - **Content tokens:** stopword-free tokens of ≥ 2 chars, after lowercasing and removing apostrophes (`wouldn't` → `wouldnt`). **Negators are content tokens and never stopwords** (PD-2).
  - **Negators (`MATCHER_RULES.negators`):** `not`, `no`, `never`, `isnt`, `arent`, `doesnt`, `dont`, `didnt`, `cannot`, `cant`, `wont`, `wouldnt`, `shouldnt`, `without`, and from `matcher@3` also `havent`, `hasnt`, `wasnt`, `werent` (18 in all). The same list drives the negator guard, the negation window (FR-021(b)) and red-flag negation (FR-022).
  - **Token match:** matched at word start with light stemming (the mock-grader technique), and plain plurals of 4-letter words are stripped ("runs" → "run"). Each token may also be satisfied by any of its pack `lexicon.synonyms` forms. Lexicon lookups go one way: a rubric token equal to a key (or its stem) is satisfied by that key's forms, never the reverse. (Confirmed as built, Wave A code review.)
  - `matched` and `missing` report the whole item string, alternatives included.
  - The matched forms are removed before the stuffing check.
- **FR-018 (status):**
  - `met` if matched items ≥ `ceil(items × 2/3 − 1e-9)` (PD-3: 2 of 3, 2 of 2, 3 of 4);
  - `partial` if ≥ 1 item matched;
  - `not_met` if none matched and the answer has < 20 content words.
  - Answers with < 3 content words are `not_met`.
  - All ratios, counts and the epsilon are named constants in `MATCHER_RULES` (provisional).
- **FR-019 (stuffing; `matcher@2`, revision 3, PD-4, F1c-B20):** a `met` status MUST be capped at `partial` when **both** of these hold:
  - (a) ≤ `stuffedMaxRest` (2) content words remain after removing every matched form (all dimensions and the matched `acceptableCorrections` entry), unchanged from `matcher@1`;
  - (b) the answer's **function-word share** is < `stuffedMaxFunctionShare` (**0.2**, provisional, PD-4).
  - **Function-word share** = (the number of the answer's words that are in the matcher's existing generic-English `STOPWORDS` list) ÷ (the number of the answer's words). "The answer's words" are every word token, before stopword and length filtering: the same tokens the negation window counts. An answer with 0 words has share 0. `STOPWORDS` is unchanged, holds no negator and no subject word, and the rule adds no vocabulary.
  - **Why:** a keyword list has no grammar, and a concise correct sentence always does. Condition (a) alone capped concise correct sentences (F1c-B20).
- **FR-020 (alternatives):**
  - `correction` is `met` if `rubric.correct` is met, or if any one `acceptableCorrections` entry, treated as a single item, is matched.
  - A scenario design is matched against each `acceptableArchitectures[].mustInclude` set that exists, and the best one counts.
  - Wording is never penalized: no length, order or phrasing rule exists beyond FR-017–FR-022.
- **FR-021 (uncertain):** the dimension MUST be `uncertain`, with confidence `low` and no score, when any of these holds:
  - (a) none matched and the answer has ≥ 20 content words;
  - (b) a negator occurs within 3 tokens before a token that matched an item, **unless that item's matched alternative itself contains a negator** (PD-2). Under the FR-017 negator guard (`matcher@3`), such an alternative can only have matched an answer that contains a negator, so the skip never applies to a negator-free answer. The window counts every word, stopwords included, and stops at a sentence or clause break (`. ; : ! ?`);
  - (c) the answer covers ≥ 80% of the content tokens of the flawed statement's text, and no correction alternative is matched.
  - A matched red flag (FR-022) or an echo (c) makes **every** dimension of that answer `uncertain`. (Confirmed as built, Wave A code review.)
- **FR-022 (red flags):** a `redFlags` item counts as matched only when it matches under FR-017 **and** no negator occurs within 3 tokens before any of its matched tokens (PD-2). A matched red flag MUST make its dimension `uncertain`, and MUST be listed at reveal. A negated red flag is neither counted nor listed. The same un-negated rule applies to `strongSignals` (confirmed as built, Wave A code review). **Revision 6:** a red flag whose alternative contains a negator is also under the FR-017 negator guard, so a positively worded good answer can no longer fire it (architect ruling: 9 such red-flag alternatives in module-1 interviews and the scenario).
- **FR-023 (seam):** the practice service MUST take its grader as an injected function, `grader(input: GraderInput) → GraderOutput`, **synchronous in F1c (ADR 0008 ARCH-7)**; shapes in tasks.md. `createPracticeService` throws `TypeError` if `grader` isn't a function. The default is the matcher. A future live grader goes through the existing gateway with the matcher as its fallback, and making the seam async needs its own ADR amendment. No prompt is added in F1c.

**Voice and text (web)**
- **FR-030:** STOP (hotword, button or Space) MUST call `stopSpeaking()` synchronously in the handler and keep `{statementId, statementIndex, elapsedMs}` of the interrupted statement.
- **FR-031:** The hotword MUST listen only while narrating. Explanations are recorded only after a STOP.
- **FR-032:** If the current statement's text contains a hotword phrase, the hotword fires only when one recognition segment (`onSegment`), trimmed and lowercased, equals that phrase.
- **FR-033:** The answer textarea MUST stay editable while and after dictating. Typing stops dictation. Nothing auto-submits.
- **FR-034:** A final segment (`onSegment` with `isFinal: true`) equal to "send" or "send it" MUST submit the answer, with the command removed. "done" MUST stop dictation without submitting.
- **FR-035:** Every `speak()` argument MUST equal the `textContent` of the element showing it, normalized with `replace(/\s+/g, ' ').trim()`.
- **FR-036:** Text mode MUST offer the full flow without a mic. Voice mode MUST fall back to text, for the session, on `mic.denied` conditions. The Stop button and Space always work.
- **FR-037:** After a hit, the client MUST show and speak `say.corrected`, then resume at the next statement. After a late hit or a false interruption, it MUST restart the interrupted statement from its beginning.
- **FR-038:** The client MUST send `via: "voice" | "button" | "key"` and `stopLatencyMs`, the time from the hotword or keydown to the `stopSpeaking()` call, or `null`.
- **FR-039 (source links, C13):** each source MUST render as an `<a>` whose `href` is set by property (never by markup), with `rel="noopener noreferrer"`, and its title set with `textContent`. Only `https://` URLs reach the client (validator).
- **FR-058 (hands-free chaining, C11):** after the one tap that starts a session, every transition MUST be reachable by voice in voice mode and by a button in text mode:
  - "next" / Next in the reveal and `done` states starts the next exercise in today's plan (`nextInPlan`, F1c-T10), or speaks `plan.done` and opens the progress page when the plan has no exercise left. Before F1c-T10 merges, Next opens the picker.
  - "review" / Review weak spots and "diagnostic" / Run the diagnostic on the progress page, per US6.4 and US6.6.
  - Commands are parsed only in their listed state (`parseCommand`), and each has a unit test.
- **FR-059 (client skip list; revision 4, PD-9, F1c-B23):** the client MUST keep at most one `skipped` entry per `statementId`. A later skip on a statement already in the list replaces that entry's `elapsedMs` only when the new value is smaller (an `elapsedMs` that isn't a finite number counts as larger than any finite one). Entries keep the order of each statement's first skip. The server-side cap `MAX_SKIPPED` (20, `server/services/practice.js`) MUST stay ≥ `LIMITS.narration` (20, `server/services/practice-pack.js`), checked by a test.
- **FR-060 (client errors are not network errors; revision 4, PD-9, F1c-B23, inv. 7):** at a stop and at `complete`, the client MUST classify a failure with the typed error classes from `web/practice/api.js`, never by message text:
  - `ApiError` with `400 ≤ status ≤ 499` → **rejected**: hide `#net-error` and `#answer-panel`, show `#rejected` with `err.rejected` (shown and spoken, FR-035), focus `#picker-btn`, offer no Try again or Skip;
  - `NetworkError`, `ApiError` with status ≥ 500, or any other error → **net**: `err.net` with Try again (and Skip at a stop), unchanged.
  - Back to exercises (`#picker-btn`) MUST open the picker and re-fetch the current track's exercise list.
- **FR-061 (voice at error panels; revision 4, PD-10, OQ-7, F1c-T06, inv. 8):** in voice mode, "try again", "skip" and "back" / "back to exercises" MUST act exactly as their buttons, only in the states in the voice-command table. Each MUST arm only after its panel's message (`err.net` or `err.rejected`) has finished being spoken, and MUST fire only on a whole final segment equal to the phrase (the FR-032 / FR-034 rule).

**Other modes**
- **FR-040:** `POST /api/practice/attempts/:id/answers {part, answer}` MUST accept these parts by type:
  - learn: `teachBack:<i>`;
  - interview: `interview`, `followUps:<i>`;
  - scenario: `design`, `challenges:<i>`;
  - any type, after complete: `followUp`, `transfer`.
  - Main parts must be answered in order (otherwise 400). A repeat returns the stored body.
- **FR-041:** For main parts, the response MUST be `{part, next: {part, prompt} | null}` with no result. Results come at complete. For `followUp` and `transfer`, it MUST be `{part, result, rubric}`. A string `followUp` or string `followUps:<i>` gets `result: null` (and `rubric: null`) and is self-rated only.
- **FR-042:** `POST …/clarifications {question}` (scenario only, before `design`) MUST return `{reveal: string | null}`. It matches `askAbout` terms with the FR-017 token rules, returns the first matching clarification, and writes `clarified`.
- **FR-043:** The scenario design status MUST be the lower of the `rubric.mustCover` status and the best architecture status, ordered `not_met < partial < met`. `uncertain` wins over all of them. If no architecture has `mustInclude`, the design status equals the `mustCover` status (C2).

**Progress**
- **FR-050:** Events MUST use the existing `event` table. The new verbs are `self-rated`, `assisted` and `clarified` (ADR 0002 Amendment 3). Shapes are in "Events and metrics" below.
- **FR-051:** `GET /api/practice/tracks/:track/progress` MUST be a pure projection of practice events, `projectPractice(events, track, exercises)` (C14). Events come from `db.eventsForEngine({actor, engine: 'practice'})` (no index, no migration; ADR 0002 Amendment 3), filtered by `context.subject` matching `^<trackId>@` across versions. Events for exercise ids absent from the current pack version are left out of mastery and readiness, and counted in `counts` (C9). Rebuilding it from the log after a restart gives an identical body.
- **FR-052 (mastery, provisional):**
  - The projection keeps two series per concept, `independent` and `assisted`, never merged.
  - Each confident result for an exercise's part counts toward all of that exercise's `concepts`: `met` = 1, `partial` = 0.5, `not_met` = 0, and a miss counts as a detection 0.
  - **Revision 3 (ADR 0002 Am. 4):** a `graded` event with `overall: null` (a false interruption) records a detection, not a grade, and is never a mastery input. A not-graded statement (`completed.result.notGradedStatementIds`) counts neither as a hit nor as a miss.
  - `score` = mean of the last 5 results; `n` = their count.
  - `level` is `none` (n = 0), `learning` (< 0.6), `developing` (< 0.8) or `strong` (≥ 0.8 and n ≥ 3).
  - `uncertain` results are excluded and listed in `flagged[]`.
- **FR-053 (readiness, provisional product choice; PD-1):** each concept has five criteria, each met by independent confident results on exercises covering the concept only. A "gradable defense part" is a scenario `challenges:<i>` or a rubric-bearing interview `followUps:<i>`.
  - `explainUnaided`: interview `explanation` or scenario design `met`. A learn teach-back given right after the narration does not count (LR-1);
  - `detectAndCorrect`: ≥ 2 distinct planted statements with detection `hit`/`late_hit` and correction `met`;
  - `transfer`: transfer `met`;
  - `failureModesTradeoffs`: a rubric-bearing `followUp` with `tradeoffs` `met`, **or** `defense` `met` on ≥ 2 distinct gradable defense parts;
  - `defendDecision`: `defense` `met` on ≥ 1 gradable defense part.
- **FR-054:** a criterion that no exercise in the pack can satisfy for that concept MUST be reported as `"n/a"`, never as met. `failureModesTradeoffs` is `n/a` when no covering exercise has a rubric-bearing `followUp` and the covering exercises have < 2 gradable defense parts in total; `defendDecision` is `n/a` when they have none. String follow-ups never make a criterion satisfiable.
- **FR-055:** `GET /api/practice/tracks/:track` MUST return the modules and exercise summaries (F1c-T04). `GET /api/practice/tracks/:track/schedule` MUST return the schedule with `today` = 1 + the number of distinct UTC dates with a practice `started` event before today's date, capped at `days`, and per exercise `done` = a practice `completed` event exists for that exercise id (F1c-T08).
- **FR-056:** `GET /api/practice/tracks/:track/review` MUST return up to 3 concepts with n ≥ 1 or a flagged item, lowest independent score first. Each comes with the least recently attempted exercise covering it.
- **FR-057:** a diagnostic attempt is `POST /api/practice/attempts` with `mode: "diagnostic"` for an id in `schedule.diagnostic`. It has `assistAllowed: false`. Its results feed mastery like any independent result.

## Events and metrics
Shapes are binding per **ADR 0002 Amendment 3** (C10). All events are server-written through `db.appendEvents`. Each passes `validateEvent`.
- **context:** `{subject: "<trackId>@<version>", attemptId: "pra_…", promptVersions: {}, engine: "practice", module, mode: "practice" | "diagnostic" | "review", exerciseType}`. Readers treat a missing `engine` as `"card"`.
- **object:** `{type: "exercise", id: exerciseId, statement?: statementId, part?: part}`. `object.step` is never used: it is an integer in ADR 0002. **`self-rated` events MUST carry `object.part`** (C10).

| Verb | When | `result` | Used by |
|---|---|---|---|
| `started` | attempt created | `{assistAllowed}` | completion rate, `today` |
| `stopped` | catch stop graded (one transaction with the next two) | `{attributedStatementId, detection, elapsedMs, via, stopLatencyMs, stopId?}`; `stopId` only when the request carried one (FR-008) | time-to-STOP, stop latency (voice-first §3) |
| `explained` | with every stop or answer | `{text, chars}` (text ≤ 2000) | grader agreement relabels |
| `graded` | with every stop (a false interruption gets `overall: null`, `outcome: false_alarm`) and every answer | `{dimensions: {<name>: Dim & {confidence}}, overall, outcome?, assisted, confidence, graderSource: "matcher", graderVersion, latencyMs}`; `outcome` for stops: `caught` / `caught_late` / `false_alarm`. A false interruption's result is exactly `{dimensions: {}, overall: null, outcome: "false_alarm", assisted, confidence: "high", graderSource: "matcher", graderVersion, latencyMs: 0}` (ADR 0002 Am. 4, F1c-B21) | mastery, readiness, fallback rate (0 here), false-alarm rate. **Reader rule (Am. 4):** grader metrics (SC-004) and mastery count only `overall !== null` |
| `completed` | complete (once) | `{hits, lateHits, misses, falseInterruptions, notReached, cleanPass, flagged, missedStatementIds, notReachedStatementIds, skippedStatementIds, notGradedStatementIds}`. The last two are added in revision 3 (FR-009a); readers treat a missing one as `[]` | catch rate, clean-pass rate, skip rate |
| `assisted` **(new)** | first assist in an attempt | `{kind: "reference"}` | assisted vs independent |
| `self-rated` **(new)** | each rating | `{rating, matcherStatus, graderVersion}` | κ (SC-004) |
| `clarified` **(new)** | each clarification question | `{text, chars, revealIndex: int \| null}` | scenario behavior |

**Revision 6:** no new event and no new field. `graded.result.graderVersion` becomes `"matcher@3"` (F1c-T18). `context.subject` becomes `"applied-ai@3"` from the version-3 pack (F1c-T20). Readers already group by version (FR-014, FR-051). SC-004 κ and the uncertain share are reported per `graderVersion`, so the founder's `matcher@2` and `matcher@3` grades are never pooled.

**Revision 4 (F1c-B23, OQ-7):** no new event and no new field. A refused `complete` leaves the attempt without `completed` (the abandoned-attempt shape), which completion rate already counts. Voice commands at error panels are client-only.

## Success criteria (measurable; AI-quality thresholds pre-registered from data-and-evidence.md §5)
- **SC-001 (leak):** `practiceLeakScan` finds 0 FR-004 keys outside the FR-004 exception paths in 100% of runs, scanning every response for an attempt before that attempt's `complete`, and every response from `GET /api/practice/tracks`, `/tracks/:track`, `/tracks/:track/schedule`, `/tracks/:track/progress` and `/tracks/:track/review` (C5).
- **SC-002 (isolation):** the F1a golden replay shows 0 diffs after each F1c wave, including after F1c-T06's `onSegment` addition. Every pre-F1c test passes unchanged, except the listed `old → new` edits in F1c-T01a, F1c-T02 and F1c-T04. Across all F1c tickets, `git diff` is empty for the "Untouched" list above.
- **SC-003 (matcher, labelled set, functional gate):** on the QA-labelled set in `tests/fixtures/practice/labelled-answers.json` (≥ 40 answers, ≥ 8 per class, including `|` items, negated rubric items and negated red flags):
  - `clear` → `met` 100%;
  - `incorrect` → never `met` (100%);
  - `valid-alternative` → never `not_met` (100%), and `met` ≥ 75%;
  - `partial` → `partial` or `uncertain` ≥ 80%;
  - `should-flag` → `uncertain` ≥ 80%;
  - `uncertain` on the `clear` and `incorrect` classes ≤ 20%.
  - **Revision 3:** the set also holds F1c-T15's added rows (≥ 1 keyword list padded with one article, expected `partial`; ≥ 1 more short correct sentence, expected `met`), and SC-003 must pass on the enlarged set.
  - **SC-003b (module-1 set, same thresholds, gate for F1c-T11):** the same per-class thresholds on `tests/fixtures/practice/m1-labelled-answers.json`, built from the learning-designer's `docs/research/applied-ai/module-1/exercises/_matcher-test-answers.json` (its `expected` values; a row whose expected value lists alternatives, such as "partial or not_met", passes on any of them), graded against `packs/applied-ai` with its `lexicon`. **Revision 3:** the set is `rows` plus F1c-T15's `qaRows`. **Revision 6 (PD-12): waived for module 1 by the founder's DECISION of 2026-10-15,** after the held-out SC-003c failed for every content variant (qa-report.md). The test stays a printed `todo` as a regression record. Its "incorrect → never `met`" threshold is not waived in spirit: F1c-T18 to T20 must not raise it above 0%.
- **SC-012 (FR-019 on module-1 wording, gate for F1c-T12's merge; revision 3, PD-4):** on the `qaRows` of `m1-labelled-answers.json` (≥ 2 keyword lists and ≥ 2 short correct sentences, all on module-1 catch stops), graded against the research drafts in `docs/research/applied-ai/module-1/exercises/` with `draftSynonyms` as the lexicon:
  - keyword-list rows → `overall` `partial` in 100% of rows;
  - short-correct rows → `overall` `met` in 100% of rows.
  - **Validity check, recorded once by QA before T12 merges:** under `matcher@1`, every short-correct row comes out `partial`, which proves the rows exercise FR-019(a).
  - From F1c-T11 on, SC-003b covers these rows against `packs/applied-ai`, and SC-012 remains as a regression check.
- **SC-004 (AI quality in use, pre-registered, reported, not a ship gate):** over the founder's first 7-day schedule, with ≥ 30 self-rated parts:
  - Cohen's κ between `matcherStatus` (met / partial / not_met) and the self-rating (had_it / partly / missed_it) is ≥ 0.6 on non-uncertain parts;
  - the `uncertain` share of graded parts is ≤ 10%.
  - Both are computed only over `graded` events with `overall !== null` (ADR 0002 Am. 4), reported per `graderVersion`.
  - **A miss on either** makes the live grader (Later) the next priority once a key exists. Only the PM changes these thresholds, in a thread.
- **SC-005 (text loop):** the e2e runs a catch exercise (2 planted, 1 late hit, 1 false interruption) and a zero-planted exercise to their reveals, keyboard-only, at 390 px and 1280 px, with 0 console errors. **No console message is filtered or exempted**; the favicon 404 is fixed on the practice page (PD-8). Errors the test itself causes on purpose (injected network aborts) are asserted separately and are not part of this count.
- **SC-006 (barge-in):** from a hotword stub event or a Space keydown, `speechSynthesis.cancel()` is called within 300 ms of fake-clock time, in 100% of e2e runs.
- **SC-007 (spoken = shown):** every `speak()` argument in the e2e equals the normalized `textContent` of its element.
- **SC-008 (deny-list):** the deny-list test passes with the Applied AI words and `applied-ai` added, and `deny-list-allow.json` is unchanged.
- **SC-009 (rebuild):** `projectPractice` over the stored events equals the frozen expected progress body, before and after a server restart on the same DB file.
- **SC-010 (degrade):** an invalid practice pack leaves the server up, logs one `[practice]` warning, `/api/practice/tracks` omits the pack, and `listSubjects()` from `server/packs.js` deep-equals the same call with no practice pack, with no `[packs]` warning logged (C3).
- **SC-011 (hands-free):** in the e2e voice run, after the one Start tap, a catch exercise, the next exercise via "next", and a review started via "review" on the progress page complete with 0 clicks (FR-058).
- **SC-013 (no stall on a refused request; revision 4, F1c-B23, inv. 7):** in QA's real-browser re-run against the real server, in text and voice mode at 390 px and 1280 px:
  - `bug-21-skips` (21 failed stops on `s1`, each skipped): exactly 1 `complete` request, status 200, with exactly 1 `skipped` entry, and the reveal appears, in 3 of 3 runs;
  - a mid-exercise pack-version 404, once at a stop and once at `complete`: `err.rejected` is shown (and spoken in voice mode, equal to the shown text), `#net-error` is never shown, 0 further requests to that attempt follow, and `#picker-btn` opens the picker in 1 action, from which a new attempt starts with status 200, in 100% of runs;
  - a `NetworkError` and a 500 at `complete` still show `err.net` with Try again, in 100% of runs.
- **SC-014 (`matcher@3`, gate for F1c-T18's merge; revision 6, PD-13). Pre-registered before the build from the architect's measured R2 column (review.md, "Ruling on the negator-bearing alternative flaw" §3).** On the tree F1c-T18 merges into:
  - **no regression:** SC-003 passes all 7 checks on its 48 rows with 0 rows changing overall status against `matcher@2`; SC-012 is 7/7;
  - **SC-003b, informational (waived, PD-12) but reproduced:** clear → `met` 100%, incorrect → `met` 0%, valid-alternative → `not_met` 0%, valid-alternative → expected 50%, partial → partial or uncertain 88.9%, uncertain on clear + incorrect 6.3%, with exactly `rows[6]` and `rows[10]` changing a dimension (met → partial, overall still in `expect`). If F1c-T19 has merged first, any difference is listed by row index and explained by the wording change;
  - **exposure:** 0 of the negator-bearing alternatives in `packs/applied-ai` (64 today; more after F1c-T20) match their own text with the negators removed (was 47 under `matcher@2`);
  - **R4, measured (F1c-T21):** every `polarityRows` row (an incorrect answer with an incidental negator) grades overall not `met`. Its correction status is recorded in `qa-report.md` under `matcher@2` and `matcher@3`.
- **SC-015 (echo-safe corrections, gate for F1c-T19 and F1c-T20; revision 6, PD-14, FR-062):** the echo probe passes for 100% of planted statements in `packs/applied-ai`: 13 in module 1, and every planted statement in module 2's 7 planted catch exercises. For the three reworded stops, overall is `uncertain`.
- **SC-016 (module-2 content, gate for F1c-T20; revision 6, FR-063, FR-064):** `tests/practice-content.test.js` passes with: version 3; modules `['m1', 'm2']`; m2 holds every type and ≥ 1 zero-planted catch (2 expected); planted/clean partitions, sources mapping, exercise bodies and reference bytes equal to the module-2 drafts under the mapping; the schedule deep-equal to the 2026-10-15 block with practice 750/840; the loader storing `applied-ai@3` once with no `[practice]` warning. QA's start-every-exercise leak scan (F1c-T22) finds 0 FR-004 keys in 100% of the 33 start responses.

## Non-goals / Later
- Defend-my-build mode (must be grounded in the real repository; never fabricated).
- Curriculum modules beyond module 2, and the AWS mapping (docs.aws.amazon.com is blocked here; sources stay `verified: false` until checked). Module 2 (agents, embeddings in depth) is in from revision 6 (PD-15).
- Live LLM grader: new prompt, gateway call, eval gate, recordings, async seam with an in-flight join (ADR 0008). Only the sync seam (FR-023) ships now.
- Rubric-bearing follow-ups for the remaining module-1 `followUp` and `followUps` strings (PD-1); the authoring standard from module 2 on.
- `diagnostic.json`'s 10 items as a new exercise type.
- Parallel exercise sets and interleaved review (REVIEW.md H6, M6). Revision 5: these are the main fix for the thin module-1 pool, where most in-app time in the 7-day plan is replay and readiness overstates competence (learning-designer RISK, thread 0007).
- Moving the PMP drafts into this engine as a second pack.
- "change that", "repeat", "pause", "slower"/"faster", earcons, the silence prompt (OI-14), auto-continue setting, reference read-aloud.
- Editing the schedule in the UI (file only in F1c), a subject picker across engines, FSRS spacing, the trained / held-out experiment, mode A/B assignment.
- Offline queue and PWA install for the practice page.
- Retiring the old game or merging the two engines (ADR 0008 convergence trigger before F2's Session Engine is specced). Consolidating the matcher with `shared/mock-grader.js` after F1a-T13b.
- An expression index for `eventsForEngine`, only if progress p95 is measured above 100 ms.
- **From Wave A.1 (revision 3):**
  - a `summary.notGraded` count and a `sum.line` variant that mentions skipped stops (PD-5);
  - an `err.net` variant for a failed `complete`, whose text doesn't mention "your answer" or skipping. Today the same `err.net` string is shown, with no Skip button. (Revision 4 handles the 4xx half with `err.rejected`; the network/5xx wording stays Later.)
  - ~~voice commands for "try again" and "skip" at `err.net` (see OQ-7)~~ moved into F1c-T06 in revision 4 (PD-10, FR-061);
- **From revision 4 (F1c-B23):**
  - 4xx handling on the picker, start, assist and self-rating requests. They show "Couldn't reach the server." or `err.rate` on a 4xx today. None of them stalls (the learner can pick again, keep narrating, or press Next), so they stay as they are;
  - treating 408 or 429 as retryable: this server sends neither.
  - F1c-B11 (FR-021(a) per dimension vs per answer) and B12/B13 (lexicon gaps): these are SC-003b and F1c-T11 work, not Wave A.1.
- **From revision 5 (the module-1 schedule, PD-11; learning-designer PROPOSAL and RISK in thread 0007):**
  - per-day `done` for an exercise id repeated on a later day, so the replay blocks on days 4, 5 and 7 aren't shown as done and "Next" offers them;
  - an optional per-block `label` in `schedule.json` (for example "off-app: defend prep"), so the app's view matches the founder's plan. It is a format change, so it needs an architect ruling (ADR 0008) before it is specced;
  - ~~the module-2 (agents) swap on days 4–5~~ done in revision 6 (PD-16, F1c-T20);
  - Leadership Principles behavioral prep: an unverified assumption about Amazon loops. **Founder decision** (scope); not in the plan until the founder answers in thread 0007.
- **From revision 6 (`matcher@3`, module 2):**
  - the clause-scoped negator rule (R2c), which closes architect RISK R4, once module 1's contrastive "X not Y" alternatives are rewritten positively; and `aint` as a negator;
  - positive rewrites of module 1's contrastive alternatives at the next module-1 content edit (architect ruling §5), including the residual one-token contacts on catch-04 `s6` (`correct[1]` "single model per index" and "same model for queries and documents");
  - a module-2 placement set (at most 6 ids; REVIEW.md L7 suggests d01, d02, d04, d06, d08, d09), only if a module-2-first learner exists;
  - scheduling m2 scenario-01, and parallel exercise sets for the agent-guardrail family and retrieval evaluation (REVIEW.md L8);
  - the AWS fact pass for module 2's 19 UNVERIFIED claims, with module 1's 17;
  - a module-2 labelled answer set: only if grader tuning restarts, which is a founder call (PD-12);
  - deny-list additions for module-2 vocabulary (SC-008), if QA finds engine code at risk.

## Assumptions
- One learner (`learner_1`), one server process per DB file (ADR 0003 Amendment 3).
- Content is the drafts in `docs/research/applied-ai/module-1/` (founder-owned), reviewed in `REVIEW.md`, and moved by F1c-T11 with format-only mapping (C12), plus PD-1's two follow-up rubrics and the draft `lexicon.synonyms` from `_matcher-test-answers.json` (the author agreed: OQ-6, revision 5).
- Module-2 content is the drafts in `docs/research/applied-ai/module-2/` (founder-owned), written after the founder's "Write Module 2" DECISION, reviewed independently in its `REVIEW.md` (20 findings; the author's responses close F3, F11 and F12), and moved by F1c-T20 with format-only mapping (PD-15). The drafts are hand-traced only: no `validatePracticePack` or `matcherGrade` run exists yet. F1c-T20's tests are the first run. ARCH-2 (ADR 0006 Am. 3) covers module 2 on the same reading as module 1: pack text never enters a prompt.
- The practice page runs in both `npm run mock` and `npm start`, because it makes no AI call.
- The interview date is unknown ("this week or next", lead EVIDENCE in thread 0007), so Wave A ships first.

## Open questions
- **OQ-8 (founder; revision 6) [NEEDS CLARIFICATION, non-blocking]:** two reversible defaults for the founder to override in thread 0007 if they disagree. Until then the tickets proceed.
  - (a) PD-13 treats `matcher@3` as a correctness fix outside "stop tuning the keyword grader". If you count it as tuning, F1c-T18 and F1c-T21 are dropped.
  - (b) PD-15 loads module 2 into the app under the OQ-5 / ARCH-2 terms you accepted for module 1 (plain files, never sent to an AI, planted mistakes kept apart from the reference, AWS claims marked unverified). If you revert the module-2 research folder, F1c-T20 is reverted with it (one commit, plus a version bump).
- The founder's Leadership Principles question (revision 5) is a scope item under Later, not a blocker for any F1c ticket.
- Resolved in revision 5 (all in thread 0007):
  - **OQ-1** (who signs off module-1 content accuracy): **resolved** by the lead's DECISION of 2026-10-14 (a reversible default the founder may override there). The learning-designer's pedagogy review (REVIEW.md) is the teaching-quality sign-off. The founder does **not** fact-check module 1, because they are the learner and must not see the answers. Facts are covered by the `verified: false` labels and a later fact pass against official AWS docs once `docs.aws.amazon.com` is reachable. The founder's OQ-5 answer accepted moving the content with those labels.
  - **OQ-3** (is `schedule.json` alone "configurable schedule"): **resolved, yes**, by the lead's DECISION of 2026-10-14 (a reversible default). A UI setting stays under Later.
  - **OQ-5** (ARCH-2 / ADR 0006 Am. 3): **resolved, confirmed** by the founder's DECISION of 2026-10-14 ("Yes, go ahead"; the 17 AWS claims stay UNVERIFIED until checked). F1c-T11's OQ-5 merge gate is cleared.
  - **OQ-6** (PD-1's two follow-up rubrics and the draft synonym list): **resolved, accepted** by the lead, answering as content author, in the DECISION of 2026-10-14. Synonym forms that fail FR-017 are dropped and listed in T11's PR.
  - The C12 gate (the 7-day plan and ≤ 6 diagnostic ids) is recorded as PD-11 (PM DECISION of 2026-10-14).
- Resolved in revision 2: OQ-2 (date unknown; Wave A first), OQ-4 (C2 and C12 accept the drafts' shapes with format-only mapping).
- Resolved in revision 4: **OQ-7** (voice "try again" and "skip" at `err.net`). The architect ruled yes, for F1c-T06 (review.md "Wave A.1 re-check", thread 0007). Adopted as PD-10 and FR-061, with the B23 way out ("back") added under the same rule.

## Learning review
Requested from `learning-designer`; LR-1 to LR-8 are not in yet. The PM decides and records each call here. The designer's independent content review (REVIEW.md) is in: B1 → C1; B2 → PD-2; B3 → PD-3; B4 → PD-1. H1–H7 and M1–M6 are content items for the author, or Later.
- **LR-1:** Does a teach-back given right after the narration count as "explain unaided"? My call: no (FR-053).
- **LR-2:** Should catch feedback be immediate (after each stop) or deferred to the reveal?
- **LR-3:** Should interview and scenario results be withheld until complete?
- **LR-4:** Is the 3-point self-rating scale right, and is "self-rating against the reference" enough without a delay?
- **LR-5:** Is `GRACE_MS` = 2000 right?
- **LR-6:** Are the mastery and readiness thresholds sensible as provisional values?
- **LR-7:** Is "assisted = reference viewed" the right definition?
- **LR-8:** How should the diagnostic be composed? **Answered (revision 5)** in the learning-designer's PROPOSAL in thread 0007: 6 ids, ramping d1 → d3, with one zero-error control and one unaided open answer, and the mock items held fresh. **My call: accepted as proposed (PD-11), including `interview-04` over the optional swap.**
- **LR-9 (revision 3):** Is `stuffedMaxFunctionShare = 0.2` (PD-4) right from a learning point of view? Specifically: should a terse but correct spoken answer ever be capped at "Partly covered"? My call for now: 0.2, revisited on the T01b dictated rows.
- **LR-10 (revision 3):** Is the `missed.notGraded` wording right: "Not scored, you skipped this stop: …"? Should a skipped statement show its correction at all, or stay hidden for a later retry? My call for now: show it (ADR 0002 Am. 4 says the reveal still shows the correction).
- LR-9 and LR-10 are requested in thread 0007. They are advisory and do not block Wave A.1's merge. If a finding arrives before F1c-T16 is verified, I record my decision on it here.
- Revision 4 (PD-9, PD-10) changes error handling and voice commands only. Attribution, grading, feedback and the reveal are unchanged, so no learning review is requested for it.
- **Revision 6 touches assessment (`matcher@3`), feedback (reveal wordings) and the learning flow (module 2, the schedule), so a learning review applies.** Module 2's independent review is `docs/research/applied-ai/module-2/REVIEW.md`. My decisions on the findings that reach the PM:
  - **F1 (negator-bearing alternatives):** fixed in module-2 content by the reviewer. The rule the reviewer proposed for the architect became `matcher@3` in the architect's R2 form. R1, the reviewer's literal rule, was rejected, with dissent recorded. **Adopted as PD-13.**
  - **F2 (honesty in ref-11 and interview-04):** fixed. No PM action, except that the schedule puts interview-04 on day 4 (PD-16), aloud, in place of the off-app framing pass.
  - **F3, F11, F12:** fixed by the author (A1–A9). No PM action.
  - **L7 (10 diagnostic items against 6):** **decided: not copied.** The 7-day diagnostic stays module 1's 6 ids (PD-15). A module-2 placement set is Later.
  - **L8 (one item per concept):** **Later** (parallel sets), as for module 1.
  - **README "Proposed schedule swap":** **adopted with three adjustments** (PD-16): m2 catch-04 on day 4, m2 catch-08 on day 5 instead of day-7 review, and m2 interview-04 in day 4's interview block. m2 interview-01 is held fresh for mock 2 as proposed. The scenario is not scheduled.
  - **README "Matcher limits":** `havent`, `hasnt`, `wasnt` and `werent` are in `matcher@3`. `aint` and the 3-letter-token limit are Later. The trailing-negator red-flag limit stays, and authors keep red flags few and rare.
- **LR-11 (revision 6, advisory, requested in thread 0007):** are the three schedule adjustments (PD-16) sound? In particular: does losing module 1's day-4/5 replays, which leaves module-1 spacing to the review blocks and day 7, cost more than module 2's first exposures gain? And is five catch sets on day 4 too long for focus-friendly sittings? My call for now: as in PD-16. If the answer arrives before F1c-T20 merges and changes the block, I post a new block in thread 0007 and T20 copies that.
- **LR-12 (revision 6, advisory):** do the two reworded `correctedText` lines (PD-14) teach well without their topic word ("encoder" for "embedding model"; "the lowest randomness setting" for "temperature zero")? My call for now: yes, because the topic word is in the same reveal's misconception, `whyWrong` and flawed line, and an echo-safe correction is worth more than the term. An alternative wording comes to me in the thread and must pass SC-015.

## Architecture rulings (design review 2026-10-13; all ruled)
| # | Ruling | Recorded in |
|---|---|---|
| ARCH-1 | (a) one guarded line in `server/packs.js`; F1c-T02 → F1a-T18 | ADR 0008 |
| ARCH-2 | the F2 hard rule doesn't block F1c; founder confirms before F1c-T11 merges (OQ-5; **confirmed** 2026-10-14, thread 0007) | ADR 0006 Am. 3, ADR 0008 |
| ARCH-3 | practice pack format v1 accepted with C1 and C2 | ADR 0008 |
| ARCH-4 | 3 verbs, `context.engine`, `pra_`/`att_` isolation, `object.type: "exercise"` | ADR 0002 Am. 3 |
| ARCH-5 | (a) server-only `server/services/practice-matcher.js` | ADR 0008 |
| ARCH-6 | `web/practice/speech.js` is the single speech import; `onSegment` added by F1c-T06; F1a-T15 rewrites that one file | ADR 0008 |
| ARCH-7 | synchronous grader seam in F1c | ADR 0008 |
| ARCH-8 | `json_extract` filter, no index, no migration | ADR 0002 Am. 3 |

**Later rulings (recorded in review.md and thread 0007; no new ADR):**
| # | Ruling | Recorded in |
|---|---|---|
| R-B11 (2026-10-15) | FR-021(a) stays per dimension; F1c-B11 works as designed; 60-character slug cut confirmed | review.md "Ruling on F1c-B11 …" |
| R-M3 (2026-10-15) | `matcher@3` = R2 (a negator-bearing alternative needs a negator in the answer) plus `havent`, `hasnt`, `wasnt`, `werent`; no ADR, under ADR 0008's "any rule change bumps N" | review.md "Ruling on the negator-bearing alternative flaw" |

**For the architect's revision-6 design review (no new decision is proposed):** please confirm (1) that loading module 2 under ARCH-2 needs no ADR 0006 or ADR 0008 text beyond the existing reading, and (2) the version-bump sequencing in PD-15 (T19's content commit lands with T20's single bump 2 → 3, or carries the bump itself under the fallback).
