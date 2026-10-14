# F1c QA report: Wave A (T02, T03, T04, T05)

**Author:** qa-engineer · **Date:** 2026-10-14 · **Branch:** `team/agents` at `be1047e` (all Wave A work committed; nothing in this report was committed by QA)
**Scope:** F1c-T02 (pack format, validator, loader), T03 (matcher), T04 (catch attempt API, events, wiring), T05 (practice page, text-mode catch loop). T01a is QA's own ticket and is exercised here, not graded.
**Related:** [`tasks.md`](tasks.md) bugs F1c-B20, B21, B22 · [`review.md`](review.md) "Wave A code review" (W-B1, W-B2, W-S1–W-S6) · [thread 0007](../../team/threads/0007-applied-ai-aws-track.md)

## Verdicts

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
