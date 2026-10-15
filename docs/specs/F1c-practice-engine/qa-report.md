# F1c QA report: Wave A (T02, T03, T04, T05)

**Author:** qa-engineer · **Date:** 2026-10-14 · **Branch:** `team/agents` at `be1047e` (all Wave A work committed; nothing in this report was committed by QA)
**Scope:** F1c-T02 (pack format, validator, loader), T03 (matcher), T04 (catch attempt API, events, wiring), T05 (practice page, text-mode catch loop). T01a is QA's own ticket and is exercised here, not graded.
**Related:** [`tasks.md`](tasks.md) bugs F1c-B20, B21, B22 · [`review.md`](review.md) "Wave A code review" (W-B1, W-B2, W-S1–W-S6) · [thread 0007](../../team/threads/0007-applied-ai-aws-track.md)

## Current verdict (F1c-T16, Wave A + A.1, 2026-10-14): **SHIP**

| Verdict | Result |
|---|---|
| **Functional** | **PASS**. See "F1c-T16" at the end of this file. |
| **AI quality** | **PASS**. |
| **Final** | **SHIP**, with 1 new minor bug (F1c-B23) that doesn't block. |

The Wave A verdict below (DON'T SHIP) is kept as the record it was. It is superseded by the F1c-T16 section.

## Verdicts (Wave A, superseded)

| Verdict | Result | Why |
|---|---|---|
| **Functional** | **FAIL** | `npm test` is green and the golden replay shows 0 diffs, but 2 of the 25 T04 acceptance tests fail on real assertions: US1.5 and US1.11, both caused by F1c-B20. Review blocker W-B2 ("Skip this stop" is recorded as a miss) is open, and I reproduced it in the browser. FR-050 fails only because the test predates the architect's B21 ruling; the code matches the ruling (see below). |
| **AI quality** (deterministic matcher, SC-003) | **FAIL** | On the accept-pack labelled set: `clear` → `met` is **80%** (gate 100%) and `valid-alternative` → `met` is **50%** (gate ≥ 75%). Cause: F1c-B20, the FR-019 stuffing cap. No prompt, gateway or model change is in scope, so there is no evals-engineer live report and no recorded-replay tier for F1c. SC-003b waits on T11. |
| **Final** | **DON'T SHIP** | Both verdicts fail. QA can't waive the AI-quality failure; only a founder `DECISION` can. |

**What turns this into SHIP:**
1. `matcher@2` (the B20 fix, architect's proposal in thread 0007) passes SC-003, US1.5 and US1.11. Per the architect's overfitting RISK, it must also pass on the enlarged labelled sets: ≥ 2 module-1 keyword-list rows and ≥ 2 short correct module-1 sentences.
2. W-B2 is fixed (ADR 0002 Am. 4: `skipped` / `notGradedStatementIds`).
3. QA updates the FR-050 test to the B21 ruling and to `MATCHER_VERSION` (W-S6), then removes the `F1c-T04` todo markers.

## Regression (fresh, this session)

| Command | Result |
|---|---|
| `npm test` | exit 0 · `# tests 443` · `# pass 331` · `# fail 0` · `# todo 112` · `# skipped 0` |
| todo reasons in that run | F1a-T12 13, F1a-T13b 27, F1a-T14 22, F1a-T18 1, **F1c-T03 1, F1c-T04 25, F1c-T07 12, F1c-T08 10, F1c-T11 1** |
| `node tests/golden/run.mjs --replay` | exit 0 · `replay 1/1: 61 runs, 0 diffs, 0 allow-listed diffs, digest cc1c3558d43c7e02` (SC-002 holds after Wave A) |
| Ticket unit tests | `practice-pack` 19/19 · `practice-matcher` 27/27 · `practice-catch` 20/20 · `practice-web-state` 11/11 · `events` 8/8 · `pack` 21/21 (all `# fail 0`) |
| SC-002 untouched list | `git diff 80c6fc2~1 HEAD` on the "Untouched" list plus `web/speech.js`: empty. Shared files: only additive edits, by their owning tickets (`server/index.js`, `shared/events.js` by T04; `server/packs.js` by T02, the one guarded line) |
| File scope per ticket | T03 `ok, 2 changed file(s) … all listed`; T02 `ok, 13 changed file(s) … all listed`; T04's commits touch exactly its 6 Files paths; T05's touch exactly its 8 |

## Acceptance tests: `tests/acceptance/F1c.test.js` with `todo: 'F1c-T04'` removed

Run as a scratch copy, with absolute imports and only the `F1c-T04` and `F1c-T03` markers removed, against the real code: `# tests 60 / # pass 33 / # fail 4 / # todo 23`. The 23 todos left are the T07, T08 and T11 tests.

**T04-marked tests: 22 pass, 3 fail. All 3 failures are known bugs; none is new.**

| Test | Result | Note |
|---|---|---|
| US1.1 start returns narration only (leak scan) | pass | |
| US1.2 hit met | pass | |
| US1.3 false interruption returns nothing about other statements | pass | |
| US1.4 late hit inside 2000 ms; same stop at 2001 ms is a false interruption | pass | |
| US1.5 valid alternative correction met | **fail** | expected `met`, got `partial`: **B20** |
| US1.7 complete reveals missed statements, reference, sources and rubrics; answered stops are self-ratable | pass | |
| US1.8 zero-planted clean pass | pass | |
| US1.9 assisted only after assist | pass | |
| US1.11 negated correction against a negated rubric item is met, not uncertain | **fail** | expected `met`, got `partial`: **B20** (the negation rule itself works; the stuffing cap fires) |
| US6.3 diagnostic attempt: no assist; only schedule.diagnostic ids; bad mode 400 | pass | |
| FR-055 tracks list and track detail | pass | |
| FR-050 catch events: one stopped/explained/graded append per stop, … | **fail** | an extra `graded` on the false interruption: **B21**. The architect ruled the code correct (thread 0007 DECISION, ADR 0002 Am. 4). A scratch copy with the ruled expectation (`graded` with `overall: null`, `outcome: 'false_alarm'`, `dimensions: {}`, in one append) **passes** (1/1). QA's test update is pending. |
| edge: repeat stop identical body, no new events | pass | |
| edge: stop after complete 409 | pass | |
| edge: att_ id on practice routes 404 | pass | |
| edge: unknown track, exercise or attempt 404 | pass | |
| edge: 413 and 400 | pass | |
| edge: stop on an unknown statement, an earlier statement or a non-catch attempt is 400 | pass | |
| edge: empty answer is not_met; an answer over 2000 chars is truncated and chars keeps its length | pass | |
| edge: elapsedMs missing, negative or non-integer gives no grace attribution | pass | |
| edge: early complete: planted statements after lastStatementId are notReached, not missed | pass | |
| edge: complete is idempotent and writes completed once | pass | |
| edge: self-rating before complete, or for a part with no answer, is 400 | pass | |
| edge: assist is idempotent: same reference, one assisted event | pass | |
| edge: invalid practice pack: server up, one [practice] warning, tracks omit it, no [packs] warning | pass | |

Also in `npm test`, always run: SC-010 (loader half), the accept-pack validation, the C3 guard, and the `practiceLeakScan` / `LEAK_ALLOW` helper tests all pass.

## AI quality: SC-003 (matcher@1, accept-pack labelled set, 45 rows)

`SC-003 labelled set thresholds` (todo `F1c-T03`, run with the marker removed):

```
class             met       partial   not_met   uncertain
clear             8         2         0         0
incorrect         0         0         9         0
partial           0         10        0         0
valid-alternative 4         4         0         0
should-flag       0         0         0         8
clear → met (100%): 80%                       FAIL
incorrect → met (0%): 0%                       pass
valid-alternative → not_met (0%): 0%           pass
valid-alternative → expected (≥ 75%): 50%      FAIL
partial → partial or uncertain (≥ 80%): 100%   pass
should-flag → uncertain (≥ 80%): 100%          pass
clear + incorrect → uncertain (≤ 20%): 0%      pass
```

All 6 differing rows are `partial` where `met` was labelled: catch-lines `stop:s5` (×2 clear, ×1 valid-alt), `stop:s3` (valid-alt), scenario-festival `design`, and interview-launch `followUps:0`. Every one is the FR-019 cap (**F1c-B20**). The architect's measured `matcher@2` proposal (thread 0007) brings all 7 checks to pass on this set. That fix is not merged, so the verdict stands at FAIL.

- **SC-003b** (module-1 set): still `todo: 'F1c-T11'`. It fails with `packs/applied-ai loads` because the pack doesn't exist yet. Not gradeable in Wave A.
- **SC-004** (κ in use): not measurable until the founder has ≥ 30 self-rated parts.
- **Replay tier / evals-engineer:** not applicable. F1c adds no prompt and no gateway call (inv. 3–4 untouched; the T04 guard test "practice modules and server/ai, server/prompts never import each other" passes).

## Real-browser check (Chromium 1194, Playwright, real server)

**Setup:**
- Server: `PRACTICE_PACKS_DIR=tests/fixtures/practice PORT=0 npm run mock`, with `DB_PATH` set to a temp file, so the real T04 routes are used, not a stub.
- Speech: `tests/golden/browser-stubs.js` injected, plus an FR-035 probe. At every `speechSynthesis.speak()`, the probe requires an element on the page whose normalized `textContent` equals the spoken text.
- Network: every `/api/*` response body was captured and scanned.
- Determinism: run twice with identical results. Every server process was killed afterwards (`pgrep` showed none left).

**Main runs: 144 checks, 143 pass, 1 fail (the known favicon 404).**

| Scenario | Flow exercised | Result |
|---|---|---|
| text 1280 | picker (both tracks: kite-craft, moonberry) → catch-lines → false interruption on s2 (Space) → s2 restarts → hit on s3 (Stop button, typed answer) → `fb.hit.met` + `say.corrected` → resumes at s4 → s5 missed → reveal → self-rate → Next → picker → catch-clean → `end.clean` | all pass except the console check (below) |
| text 390 | false interruption → **late hit** (stop 56 ms into s4 → `late_hit` on s3, prefix shown, s4 re-shown) → **assist** mid-narration → stop on s5 → reveal "Caught 2 of 2. Missed 0. Stopped on 1 accurate statement." → self-rate → Next → clean pass | all pass, 0 console errors |
| voice 1280 | same as text 1280, with statements spoken through the stub | all pass, **FR-035: 21/21 utterances shown verbatim**, 0 console errors |
| voice 390 | same as text 390 (late hit 50 ms, assist in voice) | all pass, **FR-035: 26/26**, 0 console errors |

**Key assertions, all four scenarios:**
- **Picker:** both fixture tracks listed; only catch exercises offered in Wave A.
- **False interruption:** `detection: false_interruption`, `result: null`, `reveal: null`, `via: 'key'`. `fb.false` is shown, and the response contains no FR-004 key and none of s3's or s5's hidden strings.
- **Hit:** `detection: hit`, explanation/correction/overall `met` (answer A_S3_MET). Feedback equals `fb.hit.met` with `whyWrong`, and `Corrected: …` is shown under the statement and in the panel.
- **Late hit:** `attributedStatementId: s3`, `detection: late_hit`. Feedback starts with `fb.late.prefix`.
- **Missed mistake:** s5's `whyWrong` and corrections appear in **no** response body before `complete`. The reveal shows `Missed: {text} {whyWrong} Corrected: {correctedText}`.
- **Leaks, DOM:** before any stop, the full DOM (`outerHTML`) contains no `whyWrong`, misconception, correction, exception, rubric alternative or reference line.
- **Leaks, network:** `#reference` is empty before assist, and no non-stop response contains reference text before assist. `practiceLeakScan` with `LEAK_ALLOW` is clean over every pre-complete response (5 per run, or 7 with assist).
- **Assist** ("Show the reference (counts as assisted)", the Wave A form of "show hint"): the reference is shown with `textContent` (the `<b>…</b>` in the fixture appears as literal text, with 0 `<b>` elements). `assist.spoken` is shown. The stop after assist returns `assisted: true`; the earlier hit and false interruption stay `assisted: false`.
- **Reveal:** the summary line is correct, and the reference is literal text. Sources are `<a>` with an `https://` href and `rel="noopener noreferrer"`, and the unverified one is followed by "(not yet verified)". Answered stops show matched and missing rubric items. `next.hint` and Next are present.
- **Self-rating:** POST returns `{part: 'stop:s3', rating: 'partly', matcherStatus: 'met'}`, and the button gets `aria-pressed="true"`.
- **Zero-planted** (catch-clean, no stops): `complete.summary.cleanPass: true`, and `#summary-line` equals `end.clean`.
- **Text mode:** `speechSynthesis.speak` is never called (0 utterances).

**Keyboard-only pass (390 and 1280; 14/14):**
- Tab → voice toggle → Space (text mode) → Tab → track → Enter.
- The first exercise is focused → Enter.
- Space to stop, type, Enter to submit; Continue has focus → Enter.
- Tab to "I had it" → Enter (rated); Tab to Next → Enter → picker.
- 0 console errors.

**Exploratory (14/15; the 1 "fail" is the browser logging my own injected aborts, filtered the same way in the F1a harness):**
- **US1.10:** a stop aborted at the network level shows `err.net`, keeps the typed answer, and shows Try again and Skip. Try again returns feedback and writes exactly one `stopped`/`explained`/`graded` (checked in the SQLite event log).
- **Complete aborted:** `err.net` with no Skip. Try again reaches the reveal, and `completed` is written once.
- **Double STOP** (Space twice): one answer panel, and the second Space lands in the textarea (a stray leading space; cosmetic, not filed). **Double Submit:** one stop written.
- **Space during feedback:** ignored.
- **Empty answer on a planted statement:** `hit`, `not_met`, `fb.hit.not_met`.
- **Reload mid-answer:** back on the picker, 0 errors. The open attempt stays without `completed`; offline/resume is Later.
- **Long input:** the textarea caps at 2000 chars.
- **Review finding W-B2 reproduced:** a stop whose request failed, then "Skip this stop", leaves the reveal showing "Missed: Thicker line …" and `summary.misses: 2`, although `err.net` promises "this stop won't be scored". Already a blocking review finding; not refiled.

**Console errors: 0 attributable to the practice page.** The one error in the first context of a fresh browser is `Failed to load resource: 404` for `/favicon.ico`. It also happens on `/` (the card game), and it is listed under "Already known" in thread 0006. **RISK for SC-005 / T01b:** SC-005 requires 0 console errors. Either the app ships a favicon, or the PM rules on it. T01b must not silently filter it.

**Not in Wave A scope (checked as absent, not failed):** the voice hotword, dictation, "send" and voice "next" (T06), so in voice mode STOP is by button or Space only; the other exercise modes (T09); progress and plan-aware Next (T10).

**Screenshots:** `/tmp/claude-0/-home-user/0355a50c-9f07-57a8-b4c8-1ac26d9678c5/scratchpad/f1c-waveA-qa/`
- `{text,voice}-{1280,390}-01-picker.png`, `-02-narration.png`, `-03-false-interruption.png`, `-04-hit.png` (1280) / `-04-late-hit.png` (390), `-05-assist.png` (390), `-06-reveal.png`, `-07-self-rated.png`, `-08-clean-pass.png`;
- `kbd-{390,1280}-back-to-picker.png`;
- `explore-01-net-error-390.png`, `explore-02-empty-answer-1280.png`, `review-W-B2-skip-shown-as-missed.png`.

## Invariant checks

- **Answers before grading (inv. 2):** no FR-004 key outside the exceptions in any pre-complete response (API test and browser network scan). In the browser, the hidden strings of a planted statement appear only in that statement's own hit response, or at `complete`.
- **Malformed requests (inv. 7):** 400, 404, 409 and 413 edge tests pass. The server log showed no error lines during the browser runs.
- **Append-only (inv. 6):** events are only appended. Retries and repeats write no duplicates (repeat-stop, complete-idempotent and assist-idempotent tests, and the US1.10 event-log check).
- **Subject-agnostic (inv. 1):** the deny-list test passes in `npm test`, with the F1c words added.

## Bugs

**New bugs filed: none.** Every failure found maps to an existing bug or review finding:
- **F1c-B20** (major, open): US1.5, US1.11 and SC-003. Fix proposed as `matcher@2`; not merged.
- **F1c-B21** (minor): ruled by the architect (code stays). QA owes the FR-050 test update (also W-S6, assert `MATCHER_VERSION`).
- **F1c-B22** (minor, open): `PRACTICE_PACKS_DIR` is a folder of packs. Confirmed again: `tests/fixtures/practice` loads both fixture tracks.
- **Review W-B2** (blocking): reproduced in the browser (screenshot above).

**Not filed as duplicates:** backend's proposed **B30** duplicates **F1c-B20** (stuffing cap / concise answers `partial`), and **B31** duplicates **F1c-B21** (`graded` on a false interruption).

## QA follow-ups (owned by QA)
- Update FR-050 to the B21 ruling and `MATCHER_VERSION` (W-S6). Remove the 25 `F1c-T04` todo markers once B20 and W-B2 are fixed.
- Add ≥ 2 module-1 keyword-list rows and ≥ 2 short correct module-1 sentences to the labelled sets before `matcher@2` merges (architect RISK, thread 0007).
- T01b: turn the browser checks above into `tests/e2e/F1c.e2e.mjs`. The pack dir is a folder of packs (B22).

---

# Wave A.1

## F1c-T15: enlarged labelled sets and the SC-012 validity check (2026-10-14)

**Author:** qa-engineer · **Branch:** `team/agents` at `ae7fc73` (T12, T13 and T14 are WIP checkpoints on the branch; T15 is uncommitted in the working tree). Not committed by QA.

### Rows added

| File | Added | Class / expect | Exercises / parts |
|---|---|---|---|
| `tests/fixtures/practice/m1-labelled-answers.json` `qaRows` (new; `rows` untouched) | 3 `keyword-list` | `partial` / all dimensions `partial` | 3 different module-1 draft catch exercises (01, 04, 08); each list has at most one function word |
| same | 4 `short-correct` | `clear` / all dimensions `met` | 4 different module-1 draft catch exercises (02, 04, 05, 08); 16 to 24 words, 1 or 2 sentences |
| same | `qaRowsNote` | | who, when and why |
| `tests/fixtures/practice/labelled-answers.json` (accept-pack) | 1 `stuffed` (keyword list padded with exactly one article) | `partial` / `partial` | `learn-wind teachBack:1` |
| same | 2 `short-correct` | `clear` / `met` | `scenario-festival challenges:1`, `scenario-festival transfer` (neither is a B20 part) |

The accept-pack set is now 48 rows (12 clear, 9 incorrect, 11 partial, 8 valid-alternative, 8 should-flag).

### Validity check (spec SC-012): run on `matcher@1`, before T12 merges

**How:** T12's WIP checkpoint (`a9d7cb5`, `matcher@2`) is already in the working tree, so the run uses `matcher@1` exactly as committed at `303dbe8` (blob `4132545`, `MATCHER_VERSION = 'matcher@1'`, cap `total - removed.size <= stuffedMaxRest`). A Node module hook (`--import`, scratch only) redirects `server/services/practice-matcher.js` to that blob, and the **named tests run unchanged**:

`node --import <scratch>/v1-register.mjs --test --test-name-pattern="SC-012|SC-003 labelled" tests/acceptance/F1c.test.js` → exit 0, `# todo 2`. SC-012 diagnostics:

```
# matcher@1 m1-catch-01-context-window s2 keyword-list: expected partial, actual partial (explanation partial, correction partial)
# matcher@1 m1-catch-04-embeddings s6 keyword-list: expected partial, actual partial (explanation partial, correction partial)
# matcher@1 m1-catch-08-design-tradeoffs s5 keyword-list: expected partial, actual partial (explanation partial, correction partial)
# matcher@1 m1-catch-04-embeddings s6 short-correct: expected met, actual partial (explanation partial, correction partial)
# matcher@1 m1-catch-02-rag-vs-finetune s3 short-correct: expected met, actual partial (explanation partial, correction partial)
# matcher@1 m1-catch-05-structured-outputs s3 short-correct: expected met, actual partial (explanation partial, correction partial)
# matcher@1 m1-catch-08-design-tradeoffs s5 short-correct: expected met, actual partial (explanation partial, correction partial)
```

**Result: valid.** Under `matcher@1`, all 4 short-correct rows are `partial` and all 3 keyword-list rows are `partial`, as SC-012 requires. To show the `partial` comes from the FR-019(a) cap and not from too few matched items, the same rows were graded by a scratch copy of the `matcher@1` blob with the cap disabled (`stuffedMaxRest: -1`): all 7 rows are then `met` on both dimensions. So every row matches enough items for `met`, and FR-019(a) is what caps it: the short-correct rows test the cap, and the keyword-list rows test that the cap still fires.

The same `matcher@1` run of "SC-003 labelled set thresholds" on the enlarged accept-pack set: `clear` → `met` 8/12 (66.7%), `valid-alternative` → `met` 4/8 (50%). The 8 misses are the 6 B20 rows plus the 2 new short-correct rows, all `partial` from the cap, and the new `stuffed` row is `partial`. So the new accept-pack rows also exercise FR-019 under `matcher@1`.

### Informational only: the same tests on T12's unmerged WIP (`matcher@2`, working tree)

`node --test --test-name-pattern="fixture:|SC-012|SC-003" tests/acceptance/F1c.test.js` → `# tests 8 · # pass 5 · # fail 0 · # todo 3`. SC-012: 3/3 keyword-list `partial`, 4/4 short-correct `met`. SC-003 on 48 rows: `clear` → `met` 12/12, `valid-alternative` → `met` 8/8, all gates met. This is **not** the T16 verdict: T12 isn't merged, and QA re-runs at T16. The SC-012 marker stays `todo: 'F1c-T12'` as the ticket says.

### Tests (T15)

| Test | Result now |
|---|---|
| "fixture: m1 qaRows hold ≥ 2 keyword-list rows expecting partial and ≥ 2 short-correct rows expecting met, each on a planted statement of a module-1 draft catch exercise" (new) | pass. Red first against the HEAD fixtures (`qaRowsNote says who, when and why`) |
| "fixture: labelled-answers.json has ≥ 40 rows, …" (old → new: ≥ 3 `stuffed`, one padded with exactly one article; ≥ 1 `short-correct` `clear`/`met` on a non-B20 part) | pass. Red first against the HEAD fixture (`keyword-list rows capped at partial (FR-019)`) |
| "SC-012 FR-019 on module-1 wording: …" (new, `todo: 'F1c-T12'`) | todo. Fails under `matcher@1` (validity, above); passes on T12 WIP |
| "SC-003b module-1 labelled set thresholds" (old → new: grades `rows` + `qaRows`, still `todo: 'F1c-T11'`) | todo; fails at `packs/applied-ai loads` (T11 not built) |

### Regression (fresh, working tree with T12/T13/T14 WIP plus T15)

- `npm test` → exit 0 · `# tests 464` · `# pass 351` · `# fail 0` · `# todo 113` · `# skipped 0`. Todo reasons: F1a-T12 13, F1a-T13b 27, F1a-T14 22, F1a-T18 1, F1c-T03 1, F1c-T04 25, F1c-T07 12, F1c-T08 10, F1c-T11 1, **F1c-T12 1** (new).
- `node --test tests/acceptance/F1c.test.js` → `# tests 62 · # pass 12 · # fail 0 · # todo 50`.

### Notes for the lead
- **Merge order.** The merge order is T15 → T13 → T12, but T12's WIP checkpoint (`a9d7cb5`) is already on `team/agents` ahead of T15. The validity record above is pinned to the `303dbe8` blob, so it stays valid. Please don't treat the branch checkpoint as T12's merge.
- **LR-9.** The learning-designer may review the 7 module-1 `qaRows` in thread 0007 (advisory).

## F1c-T16: Wave A.1 acceptance updates, todo removal and re-verify (2026-10-14)

**Author:** qa-engineer · **Branch:** `team/agents` at `4737dba` (T12 `a9d7cb5`, T13 `b7024e7` + `4737dba`, T14 `ae7fc73`, T15 `be0fc29`). My only changes are `tests/acceptance/F1c.test.js`, this file and the F1c-B23 entry in `tasks.md`. `practice-helpers.mjs` is unchanged, because `api().stop/complete` already pass any body. Nothing is committed.

### Verdicts

| Verdict | Result | Why |
|---|---|---|
| **Functional** | **PASS** | `npm test` exit 0, `# fail 0`. Every ship condition in tasks.md "Wave A.1, Ships when" is met (table below). No `F1c-T03`, `F1c-T04`, `F1c-T12` or `F1c-T13` todo remains. The browser re-check is 210/210 at 390 and 1280 px, in text and voice, with 0 console errors and no filter. W-B2 is fixed and reproduced as fixed in the browser. |
| **AI quality** (deterministic matcher `matcher@2`; pre-registered SC-003 and SC-012 thresholds) | **PASS** | SC-003 on the enlarged 48-row accept-pack set meets every threshold (clear → met 100%, valid-alternative → expected 100%, partial 100%, should-flag 100%, uncertain over clear + incorrect 0%). SC-012 is 7/7: the keyword lists are `partial` and the short correct sentences are `met`. Validity: under `matcher@1` all 4 short-correct rows are `partial`, which I re-ran myself and which matches T15's record. Wave A.1 changes no prompt, gateway, model or `shared/` file, so the eval gate isn't triggered. There is no evals-engineer live report and no `tests/fixtures/recorded/` recording for F1c. The replay tier that applies is the golden replay: 0 diffs. |
| **Final** | **SHIP** | Both verdicts pass. The new bug F1c-B23 is minor and isn't a ship condition (reasons in the bug). SC-003b (T11), T07, T08 and T01b are later waves and aren't in this verdict. |

### Ship conditions (tasks.md Wave A.1)

| Condition | Result | Evidence |
|---|---|---|
| `matcher@2` passes SC-003 on the enlarged set | PASS | "SC-003 labelled set thresholds" (todo removed), table below |
| SC-012 | PASS | "SC-012 FR-019 on module-1 wording: …" (todo removed), 7/7 rows |
| US1.5, US1.11 | PASS | Both tests pass with the todo removed. Both fail on a copy running `matcher@1` (mutation check below) |
| W-B2 fixed (FR-009a) | PASS | "US1.13 a skipped stop is not scored …" and the "edge: skipped validation 400 …" API tests; in the browser, US1.13/US2.10 pass in 4 runs |
| FR-050 follows B21 and asserts `MATCHER_VERSION` | PASS | "FR-050 catch events: …" now expects `graded` after the false interruption, with the exact Am. 4 result, its own consecutive-seq append, and `MATCHER_VERSION` in 3 places. No `'matcher@1'` literal is left in the file except a comment |
| `F1c-T03`, `F1c-T04` (25), `F1c-T12` markers gone; `npm test` `# fail 0` | PASS | Todo reasons left in the run: F1a-T12 13, F1a-T13b 27, F1a-T14 22, F1a-T18 1, F1c-T07 12, F1c-T08 10, F1c-T11 1 |
| Golden replay 0 diffs | PASS | `replay 1/1: 61 runs, 0 diffs, 0 allow-listed diffs, digest cc1c3558d43c7e02`, exit 0 |
| Real-browser re-check | PASS | 210/210 checks (below) |

### Acceptance tests changed or added (`tests/acceptance/F1c.test.js`)

| Test | Covers | Result |
|---|---|---|
| "FR-050 catch events: …" (old → new per T16) | FR-050, B21, Am. 4, W-S6 | pass |
| "US1.13 a skipped stop is not scored: notGraded at the reveal, not counted in misses, stored in notGradedStatementIds" (new) | US1.13, FR-009a, PD-5. Also: a skip that would have been a false interruption keeps `cleanPass` | pass |
| "US1.14 a new stopId after a late hit is a new stop (false interruption); Try again with the same stopId returns the stored body with no events" (new) | US1.14, FR-008, PD-6, W-S1. `stopId` is stored when sent; a request without `stopId` keeps the rev-2 rule | pass |
| "edge: skipped validation 400 (not an array, 21 entries, a non-object entry, an unknown statementId); a repeat complete ignores skipped" (new) | FR-009a validation: 11 bad shapes, including `__proto__`. Rejected requests write nothing. 20 entries is OK and `null` is OK. A repeat complete ignores a valid, an invalid or a 30-entry `skipped` | pass |
| "edge: a malformed stopId is 400; the same stopId on another statement is 400" (new) | FR-008: 10 malformed values (7 and 65 chars, space, dot, non-ASCII, empty, number, object, array, boolean). 8 and 64 chars are accepted. Rejected requests write nothing, and the server stays up | pass |
| "edge: assist after complete writes no event" (new) | W-S3 | pass |
| 24 other T04 tests, SC-003, SC-012 | todo markers removed | all pass |

The new tests are marked as passing without a `todo: 'F1c-T13'` step, because T13 was already on the branch when I wrote them. **Mutation check (they bite):** I ran the same file on a scratch copy of HEAD with `server/services/practice.js` from `303dbe8` (before T13). All 5 new tests fail there and nothing else does. With `practice-matcher.js` from `303dbe8` (`matcher@1`) as well, SC-003, SC-012, US1.5 and US1.11 also fail. FR-050 passes on both copies, as expected: Wave A already wrote the Am. 4 `graded`, and the test reads `MATCHER_VERSION`.

### Regression (fresh, final working tree)

- `npm test` → exit 0 · `# tests 469` · `# pass 383` · `# fail 0` · `# cancelled 0` · `# skipped 0` · `# todo 86` (the Wave A.1 baseline before my edits was `464 / 351 / 0 / 113`).
- `node --test tests/acceptance/F1c.test.js` → `# tests 67 · # pass 44 · # fail 0 · # todo 23` (T07 12, T08 10, T11 1).
- Ticket unit tests: `practice-catch` 31/31; `practice-matcher` + `practice-web-state` 46/46 (`# fail 0`).
- `node tests/golden/run.mjs --replay` → exit 0 · `replay 1/1: 61 runs, 0 diffs, 0 allow-listed diffs, digest cc1c3558d43c7e02` (run twice, same digest).
- File scope: `git diff --stat 303dbe8 HEAD` touches 13 files, each inside its ticket's Files line (T12 2, T13 2, T14 5, T15 4). `web/practice/api.js`, `web/index.html` and `web/app.js` are untouched, and there is no `innerHTML` in `web/practice/*.js`.
- Orphan check: no `server/index.js` process was added by `npm test` or by my browser runs. Three orphaned test servers (PPID 1, started 03:40:05–03:40:08, before this session, `PORT=0 DB_PATH=:memory:`) were already running. I didn't start them and didn't kill them. They are probably left over from an engineer's earlier `npm test`.

### AI quality tables (`matcher@2`)

SC-003, accept-pack labelled set (48 rows):
```
class             met       partial   not_met   uncertain
clear             12        0         0         0
incorrect         0         0         9         0
partial           0         11        0         0
valid-alternative 8         0         0         0
should-flag       0         0         0         8
clear → met (100%): 100%
incorrect → met (0%): 0%
valid-alternative → not_met (0%): 0%
valid-alternative → expected (≥ 75%): 100%
partial → partial or uncertain (≥ 80%): 100%
should-flag → uncertain (≥ 80%): 100%
clear + incorrect → uncertain (≤ 20%): 0%
```
SC-012, module-1 `qaRows` (research drafts, `draftSynonyms`):
```
matcher@2 m1-catch-01-context-window s2 keyword-list: expected partial, actual partial (explanation partial, correction partial)
matcher@2 m1-catch-04-embeddings s6 keyword-list: expected partial, actual partial (explanation partial, correction partial)
matcher@2 m1-catch-08-design-tradeoffs s5 keyword-list: expected partial, actual partial (explanation partial, correction partial)
matcher@2 m1-catch-04-embeddings s6 short-correct: expected met, actual met (explanation met, correction met)
matcher@2 m1-catch-02-rag-vs-finetune s3 short-correct: expected met, actual met (explanation met, correction met)
matcher@2 m1-catch-05-structured-outputs s3 short-correct: expected met, actual met (explanation met, correction met)
matcher@2 m1-catch-08-design-tradeoffs s5 short-correct: expected met, actual met (explanation met, correction met)
```
Validity, re-run by me on `matcher@1` from `303dbe8`: every keyword-list row is `partial` and every short-correct row is `partial`. This is identical to the T15 record above.

### Real-browser re-check (Chromium 1194, Playwright, real server)

**Setup:**
- Server: `PRACTICE_PACKS_DIR=tests/fixtures/practice PORT=0 npm run mock`, with a temp `DB_PATH`. The event log was read from that file after each step.
- Speech: `tests/golden/browser-stubs.js` plus the FR-035 probe (each spoken text must equal the `textContent` of an element on the page).
- Failure injection: an in-page `fetch` wrapper. `reject` means the request never leaves; `lose` means the server handles the request and the response is lost. Because of this, the browser logs no "Failed to load resource" line of its own, and the console check runs **with no filter**.
- A separate pass used real `route.abort` and `context.setOffline` to confirm that real network failures behave the same.
- Script: `<scratchpad>/e2e-waveA1.mjs` (scratch, not committed). The server and browser were killed at the end.

**Result:** run 1 and run 2 (separate servers and DBs) both gave `checks 210 pass 210 fail 0`, exit 0, with 0 error or warning lines in the server log. The results were identical, so the check is deterministic.

| Scenario (both text and voice) | Width | Flow | Result |
|---|---|---|---|
| fresh first context | 1280 | first `/practice.html` load in a new browser | no `/favicon.ico` request (PD-8); 0 console errors |
| plan A: `text-1280`, `voice-1280`, `text-390-skip`, `voice-390-skip` | 1280, 390 | false interruption (Space) on s2 → s3 stop, **response lost** → `err.net`, answer kept → **Try again** → s5 stop, **request fails** → **Skip this stop** → reveal → **rating failures** → Next → catch-clean `end.clean` | all pass |
| plan B: `text-390`, `voice-390`, `text-1280-restop`, `voice-1280-restop` | 390, 1280 | false interruption on s2 → **late hit** on s4 (→ s3) → s4 replays → **stop on s4 again** → assist → hit s5 → reveal → rating failures → Next → clean pass | all pass |
| real network (`realnet-text-1280`) | 1280 | `route.abort` on a stop → Skip → reveal; `setOffline` → rating → back online → Try again | all pass; the 2 console lines are the browser's own log of the 2 injected failures (`net::ERR_INTERNET_DISCONNECTED`) |

**What was checked:**
- **US1.13 / US2.10 (W-B2):**
  - `complete` carries `{"lastStatementId":"s6","skipped":[{"statementId":"s5","elapsedMs":39}]}`.
  - The summary reads "Caught 1 of 2. Missed 0. Stopped on 1 accurate statement.".
  - `#missed-list` has exactly one line, equal to `missedLine({…, notGraded: true})`, starting "Not scored, you skipped this stop: ".
  - No "Missed:" text appears anywhere in the reveal.
  - The `completed` event has `notGradedStatementIds ["s5"]`, `missedStatementIds []` and `skippedStatementIds ["s5"]`.
  - No `stopped` event is written for s5.
  - Voice: `err.net` is spoken exactly as shown, and the not-graded line is spoken exactly as shown, after `sum.line`.
- **US1.14 (stopId):**
  - Try again re-sends the same `stopId` (a UUID, which matches `^[A-Za-z0-9_-]{8,64}$`).
  - The retry body is identical to the lost body.
  - The log has one `stopped` for s3, carrying that `stopId`.
  - Stopping again on the replayed s4 sends a new `stopId`, gets `false_interruption` and shows `fb.false`. The log has 2 triples on s4, and the second `graded` has `outcome: false_alarm`, `overall: null`.
  - The summary reads "Caught 2 of 2. Missed 0. Stopped on 2 accurate statements.".
  - With nothing skipped, `complete` carries no `skipped` key.
- **US1.15 / US2.11 (PD-7):**
  - A failed rating shows `p.rate-error` (`role="status"`, text `err.rate`) and `button.rate-retry` ("Try again"), and `aria-pressed` doesn't change.
  - Two failures in a row still leave one error and one retry button.
  - Try again re-posts `partly` → 200, `aria-pressed="true"`, and the error is removed.
  - A failed change to `had_it` keeps `partly` pressed, and retrying it succeeds.
  - Voice: `err.rate` is spoken exactly as shown.
- **The Wave A flows again:** false interruption, hit, late hit, assist (`assisted: true` only after it), reveal, self-rating, Next → picker, and the zero-planted `end.clean`. The SC-001 key-level leak scan is clean over every pre-complete response (8 per plan-B run).
- **Every scenario:**
  - FR-035: 29 to 32 utterances per voice run, each shown verbatim.
  - Text mode: 0 utterances.
  - No `/favicon.ico` request.
  - **0 console errors, no filter.**
  - No horizontal overflow (`scrollWidth ≤ innerWidth`) at 390 and 1280.

**Observation (not filed):** the not-scored line has the same red left border as a "Missed" line (`voice-390-skip-04-reveal-not-scored.png`). The spec doesn't define its style, and the text is right. Passed to the learning-designer's LR-10 review as a suggestion: a neutral border would match "not scored".

**Screenshots** (`/tmp/claude-0/-home-user/0355a50c-9f07-57a8-b4c8-1ac26d9678c5/scratchpad/f1c-t16/`, 58 files):
- plan A, `{text,voice}-1280-*` and `{text,voice}-390-skip-*`: `01-narration`, `02-net-error-lost-response`, `03-net-error-skip-offered`, `04-reveal-not-scored`, `07-rate-error`, `08-rate-ok`, `09-clean-pass`;
- plan B, `{text,voice}-390-*` and `{text,voice}-1280-restop-*`: `01-narration`, `02-late-hit`, `03-second-stop-false`, `04-reveal`, `07-rate-error`, `08-rate-ok`, `09-clean-pass`;
- `realnet-text-1280-rate-error-offline.png`;
- `bug-21-skips-text-1280-complete-400-try-again.png` (F1c-B23).

### Invariant checks

- **Inv. 2 (answers before grading):** the browser key-level leak scan is clean in every run. The API leak tests (US1.1, US1.3) pass.
- **Inv. 6 (append-only):** every rejected `complete` or `stop` (bad `skipped`, bad `stopId`, `stopId` on another statement) writes nothing. Repeats write nothing. `completed` is written once, even after 3 repeat calls with different bodies.
- **Inv. 7 (malformed input):** 21 malformed `skipped` and `stopId` values return 400, and the server stays up. In the client, F1c-B23 is a stall, but only after more than 20 skips.
- **Inv. 9 (spoken equals shown):** the FR-035 probe passes, including the new `missed.notGraded`, `err.net` and `err.rate` lines.

### Bugs

- **Closed at verify:** F1c-B20 (SC-003, US1.5 and US1.11 pass on `matcher@2`). F1c-B21 (the FR-050 test follows the ruling). W-B2 (US1.13 passes, in the API test and in the browser).
- **New: F1c-B23 [minor]**, "More than 20 skips in one exercise: `complete` returns 400 and the page offers a 'Try again' that can never succeed". Owner: the PM chooses the policy, then frontend-engineer. It doesn't block, because it needs 21 failed stop requests in one exercise (catch exercises have 2 to 8 statements), corrupts nothing, and a reload recovers. Root cause: `complete()` maps every error, including a 4xx, to `err.net` and an endless retry.

## SC-003c held-out grading (2026-10-15, graded once; the set is now spent as a gate)

**Set:** `tests/fixtures/practice/m1-holdout-answers.json`, committed in `72d4a75` before any `packs/applied-ai` content change. It has 30 rows: 6 clear, 7 incorrect, 8 partial and 9 valid-alternative. Rows are named by index only, and no answer text appears here. Per the fixture's rules, the set now joins SC-003b as training data, so the next content iteration needs a fresh held-out set. `gradedAt` and `gradedPackVersion` are left `null` for the lead to set with the content commit.

**Method (the SC-003b grading path):**
- Code: `loadPracticePacks(<packs>)`, then `getTrack('applied-ai').lexicon`, `graderInputFor`, the real `matcherGrade` (`matcher@2`), `combineOverall` and `evaluateThresholds` from `tests/acceptance/practice-helpers.mjs`.
- One process per pack. Script: `<scratch>/sc003c-grade.mjs`. Code base is HEAD `fff0d6a`, and the tree was clean.
- Packs graded:
  - **today:** `packs/applied-ai` at HEAD.
  - **A2:** all fixes from `lexicon-proposal.json` rev2.
  - **B2:** A2 without the `suspectFixes`.
- **Variant integrity (verified):**
  - I rebuilt A and B fresh from HEAD with backend's `lexapply.mjs` and the rev2 proposal (`33d4371`). Both are byte-identical to the scratch A2 and B2 `packs/applied-ai`.
  - The scratch copies differ from HEAD only in `packs/applied-ai` (plus an older copy of thread 0007), so the matcher and loader are the same code.
- **Harness check:** the real "SC-003b module-1 labelled set thresholds" test, run inside each copy, reproduces backend's numbers: valid-alt → expected is 83.3% on A2 and 50% on B2.

### Gate results (pre-registered SC-003b thresholds)

| Gate | today | A2 | B2 |
|---|---|---|---|
| clear → met (100%) | 16.7% FAIL | 66.7% FAIL | 66.7% FAIL |
| incorrect → met (0%) | 0% pass | 0% pass | 0% pass |
| valid-alt → not_met (0%) | 0% pass | 0% pass | 0% pass |
| valid-alt → expected (≥ 75%) | 0% FAIL | 22.2% FAIL | 22.2% FAIL |
| partial → partial or uncertain (≥ 80%) | 25% FAIL | 50% FAIL | 50% FAIL |
| clear + incorrect → uncertain (≤ 20%) | 23.1% FAIL | 7.7% pass | 7.7% pass |
| **SC-003c** | **FAIL (4 gates)** | **FAIL (3 gates)** | **FAIL (3 gates)** |

### Confusion tables (rows: expected class; columns: graded overall)

| today | met | partial | not_met | uncertain |
|---|---|---|---|---|
| clear (6) | 1 | 3 | 0 | 2 |
| incorrect (7) | 0 | 1 | 5 | 1 |
| partial (8) | 0 | 2 | 6 | 0 |
| valid-alternative (9) | 0 | 4 | 0 | 5 |

| A2 **and** B2 (identical) | met | partial | not_met | uncertain |
|---|---|---|---|---|
| clear (6) | 4 | 2 | 0 | 0 |
| incorrect (7) | 0 | 1 | 5 | 1 |
| partial (8) | 0 | 4 | 4 | 0 |
| valid-alternative (9) | 2 | 3 | 0 | 4 |

### Per row (overall; explanation/correction in brackets where they differ: m met, p partial, n not_met, u uncertain)

| Row | Exercise and stop | Class | today | A2 | B2 |
|---|---|---|---|---|---|
| 0 | catch-01 s2 | clear | uncertain (u/m) | met | met |
| 1 | catch-01 s2 | incorrect | not_met | not_met | not_met |
| 2 | catch-01 s4 | valid-alt | uncertain (u/p) | partial (m/p) | partial (m/p) |
| 3 | catch-01 s4 | partial | not_met | not_met | not_met |
| 4 | catch-02 s3 | clear | partial (p/m) | met | met |
| 5 | catch-02 s3 | incorrect | not_met | not_met | not_met |
| 6 | catch-02 s6 | valid-alt | uncertain (p/u) | uncertain (m/u) | uncertain (m/u) |
| 7 | catch-02 s6 | partial | partial (p/n) | partial (p/n) | partial (p/n) |
| 8 | catch-04 s3 | clear | met | met | met |
| 9 | catch-04 s3 | valid-alt | uncertain (u/u) | uncertain (u/p) | uncertain (u/p) |
| 10 | catch-04 s3 | incorrect | not_met | **partial (p/n)** | **partial (p/n)** |
| 11 | catch-04 s4 | valid-alt | partial (p/p) | met | met |
| 12 | catch-04 s4 | partial | not_met | partial (n/p) | partial (n/p) |
| 13 | catch-04 s6 | valid-alt | partial (p/m) | partial (p/m) | partial (p/m) |
| 14 | catch-04 s6 | incorrect | **partial (n/p)** | not_met | not_met |
| 15 | catch-05 s3 | partial | not_met | not_met | not_met |
| 16 | catch-05 s3 | valid-alt | uncertain (p/u) | uncertain (m/u) | uncertain (m/u) |
| 17 | catch-05 s5 | clear | partial (p/m) | partial (p/m) | partial (p/m) |
| 18 | catch-05 s5 | valid-alt | uncertain (u/u) | uncertain (u/u) | uncertain (u/u) |
| 19 | catch-05 s5 | incorrect | uncertain (u/u) | uncertain (u/u) | uncertain (u/u) |
| 20 | catch-05 s5 | partial | not_met | not_met | not_met |
| 21 | catch-06 s5 | valid-alt | partial (p/m) | met | met |
| 22 | catch-06 s6 | clear | uncertain (u/m) | partial (p/m) | partial (p/m) |
| 23 | catch-06 s6 | incorrect | not_met | not_met | not_met |
| 24 | catch-06 s6 | partial | not_met | not_met | not_met |
| 25 | catch-08 s4 | valid-alt | partial (p/m) | partial (p/m) | partial (p/m) |
| 26 | catch-08 s4 | partial | not_met | partial (p/n) | partial (p/n) |
| 27 | catch-08 s4 | incorrect | not_met | not_met | not_met |
| 28 | catch-08 s5 | clear | partial (p/m) | met | met |
| 29 | catch-08 s5 | partial | partial (p/n) | partial (p/n) | partial (p/n) |

### Findings

1. **The suspect fixes do not generalize: A2 and B2 are identical on all 30 held-out rows, down to each dimension.**
   - On SC-003b, the suspect fixes are worth 33 points of valid-alt → expected (A2 83.3% against B2 50%).
   - On the held-out set they are worth 0 rows, and on the 9 valid-alternative rows specifically the result is 2/9 in both.
   - **Limit:** the held-out set has no valid-alternative row on catch-01 s2 or catch-02 s3, where four of the six suspect edits sit. There, the suspect edits meet only clear and incorrect rows (0, 1, 4 and 5), which grade the same in A2 and B2. The two global keys (`one`, `outputs`) can reach every row and changed none.
   - So this is "no held-out support", not "proven harmful". Under the lead's decision rule (thread 0007), A2 does not clear the held-out gates, so the suspect fixes do not stay.
2. **No variant passes SC-003c, B2 included.**
   - The lexicon's non-suspect part does generalize somewhat. From today to A2/B2:
     - clear → met goes from 1/6 to 4/6;
     - valid-alt → met goes from 0/9 to 2/9;
     - partial → partial goes from 2/8 to 4/8;
     - uncertain on clear + incorrect goes from 23.1% to 7.7%.
   - Even so, the gap between training and held-out is large. For A2:
     - clear → met: 100% on SC-003b against 66.7% held-out;
     - valid-alt → expected: 83.3% against 22.2%;
     - partial: 100% against 50%.
   - Module-1 matcher grading is not at the pre-registered quality on unseen wording.
3. **Incorrect → met: 0 in every variant.** No incorrect held-out row was graded `met`.
   - **Watch (R3):** row 10 (catch-04 s3, incorrect) goes from `not_met` today to `partial` in A2 and B2, because its explanation becomes partial. Lexicon broadening has given partial credit to a wrong answer. This is the B10 failure shape on a new statement.
   - Row 14 (catch-04 s6, incorrect) has the reverse change: `partial` today, `not_met` in A2 and B2.
   - Row 19 (catch-05 s5, incorrect) is `uncertain` in all three.
4. **Harshness on partial answers:**
   - 4/8 partial rows grade `not_met` in A2 and B2 (rows 3, 15, 20 and 24), and 6/8 do today.
   - A half-right learner is told they are wrong. This is the larger miss, ahead of the valid-alternative one.
5. **Single rater:** QA wrote all the labels and there was no second rater. Disputed labels can be re-adjudicated, but the set is spent as a gate either way.

**AI-quality verdict on module-1 content (SC-003c):** **FAIL** for today, A2 and B2. Only a founder `DECISION` can waive it.
