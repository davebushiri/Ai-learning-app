# 0007: Applied AI / AWS Solutions Architect track

**Type:** PROPOSAL
**Status:** open
**Opened by:** lead · 2026-10-13
**Decider:** founder (scope, priority) · technical-product-manager (spec) · principal-architect (technical)
**Targets:** a new practice engine and pack; the PMP track is preserved
**Participants:** technical-product-manager, principal-architect, learning-designer, backend-engineer, frontend-engineer, qa-engineer

## Context (founder direction, 2026-10-13; recorded by the lead from the founder's message)

The founder has a 60-minute technical interview at Amazon, this week or next. The hiring manager's guidance, quoted exactly: "In general, I am looking for AI fluency / experience with RAG, agents, embeddings, practical hands on experience with evidence of taking into production."

There is no job description or rubric. **Confirmed:** the quote above and the 60-minute technical format. **Everything else is a preparation assumption.**

**New immediate priority:** an Applied AI / AWS Solutions Architect learning track. The PMP track stays.

**Modes:**
- Learn: no planted errors; teach-back.
- Catch and correct: mixed statements, including error-free sets.
- Customer scenario.
- Technical interview.
- Defend my build: grounded in the real code; never fabricated.
- Review weaknesses.

**Curriculum:** A–G (LLM foundations, embeddings and retrieval, RAG, agents, AWS and security, evaluation and operations, solutions-architect reasoning). Portable concepts come first, then AWS mapping verified against official docs.

**Exercise requirements:**
- authored misconceptions, never model hallucination;
- trusted reference kept separate from flawed narration;
- rubric, follow-up question and transfer scenario for each exercise.

**Assessment dimensions:** detection, misses, false interruptions, explanation, correction, transfer. Assisted and independent results are tracked separately. Thresholds are provisional.

**Schedule:** configurable, defaulting to 7 days × 2 h.

**Process instruction from the founder:** small reviewable increments; reuse what works; don't rebuild; don't let app work eat the founder's preparation time.

## Lead's inspection of the current build (verified in code at 49352e6)

**Implemented and working (MOCK, fake Claude):**
- a single loop: pick a job, narrate lines (browser TTS), STOP by button or voice, explain by text or dictation, grade, score, results;
- the keyword grader (`shared/mock-grader.js`) and a live grader prompt (trades-specific);
- the AI gateway (deadlines, fallback, `llm_call` log);
- the SQLite event store and pack loader;
- 304 tests and the 61-run golden replay.

**Not implemented:**
- attempts and events written per play (F1a Wave 2);
- server-owned answers: the legacy route still sends mistakes to the browser;
- any mode other than the one loop;
- learner model, mastery, review, diagnostic;
- a subject picker;
- zero-mistake exercises: the validator requires exactly 3 mistakes;
- RAG, embeddings or AWS of any kind;
- any live Claude call: no API key, so everything ran against fake Claude;
- production deployment and real users.

**Environment limit:** docs.aws.amazon.com is blocked by this cloud environment's network policy. Service-specific claims stay marked "verify" until checked.

## Lead's proposal (reversible)

- **A separate practice engine** at its own page (`/practice.html`) and its own routes (`/api/practice/*`). It is server-owned from day one, and the content lives in `packs/applied-ai/`.
- **The existing game screen stays untouched,** so F1a's golden replay and Wave 2 are unaffected. The PMP drafts can move to the new engine later as a second pack.
- **Assessment is offline-first:** a rubric-concept matcher, plus a self-rating against the reference after each attempt. Low confidence is flagged for review, not scored. A live LLM grader joins through the gateway once there is a key.
- **F1a Wave 2 stays on hold** while this ships.

### technical-product-manager · 2026-10-13 · DECISION
*Appended by the lead from the PM's report; the spec is at `docs/specs/F1c-practice-engine/`.*
**Scope:** the F1c practice engine, 12 tickets in 3 waves.
- **Wave A** ships first: a usable text-mode catch-and-correct loop (T01a, T02, T03, T04, T05).
- **Wave B:** voice, the learn, interview and scenario API, progress and mastery, and the content move.
- **Wave C:** the remaining screens.

The existing game, its routes and the golden replay stay untouched. **Pre-registered:** SC-003 (matcher functional gate) and SC-004 (κ ≥ 0.6 against self-ratings over 7 days, reported, not a gate). All thresholds are provisional. **Next:** principal-architect design review of ARCH-1 to ARCH-8; learning-designer review LR-1 to LR-8.

### lead · 2026-10-13 · EVIDENCE
- **OQ-2 (interview date):** unknown, "this week or next". So Wave A ships first whatever the answer.
- **ARCH-2:** practice packs never enter a prompt, so the reason behind ADR 0006's F2 hard rule (unfenced pack text in prompts) doesn't apply. The architect rules. If the rule is applied literally, the founder's 2026-10-13 direction making this track the immediate priority is the request for an exception, to be confirmed by the founder.

### principal-architect · 2026-10-13 · RISK
- **Two engines become permanent** (two pack formats, two keyword matchers, two event shapes). Likelihood H · impact M · mitigation: ADR 0008's convergence trigger. Before F2's Session Engine is specced, an ADR either adopts or migrates the practice engine. No third engine is allowed.
- **Offline matcher grades mislead the founder days before the interview.** Likelihood M · impact H · mitigation: `uncertain` results are shown and never scored, the rubric and reference are always revealed, and self-rating gives SC-004 κ. Treat grades as advisory.
- **The build eats preparation time or misses the window.** Likelihood H · impact H · mitigation: ship Wave A only before the interview. `docs/research/applied-ai/module-1/` is readable as study notes today, whatever the build status.
- **Hotword echo** (the TTS voice triggers "stop"). Likelihood M · impact M · mitigation: FR-032 bare-phrase rule, the headphone hint, and the Stop button and Space always work.

### principal-architect · 2026-10-13 · DECISION
**Answering:** ARCH-1 to ARCH-8 (technical only). Full review: `docs/specs/F1c-practice-engine/review.md` "Design review".
**Verdict: APPROVED WITH CHANGES.** Wave A can start once the PM applies C1–C8. There's no re-review; I check the diff at code review.
- **ARCH-1:** (a). A one-line silent skip in `server/packs.js` when there's `practice.json` and no `pack.json`. Order: F1c-T02, then F1a-T18.
- **ARCH-2:** the F2 hard rule doesn't block F1c, because practice pack text enters no prompt, and a guard test enforces that. **Founder: please confirm this reading here before F1c-T11 ships real content.** The live grader later falls under the rule in full. (ADR 0006 Amendment 3)
- **ARCH-3:** practice pack format v1 accepted, widened for the real content (C1 `|` alternatives, C2 `verified` + `note`, string `followUps`, optional `mustInclude`). (ADR 0008)
- **ARCH-4:** accepted additively: 3 verbs; `context.engine: "practice"`, where a missing value means card; `pra_`/`att_` isolation with a 404 each way. (ADR 0002 Amendment 3)
- **ARCH-5:** (a), a server-only `practice-matcher.js`. Consolidate with mock-grader after F1a-T13b.
- **ARCH-6:** `web/practice/speech.js` is the single speech import. T06 adds an optional `onSegment` to `listen()`. F1a-T15 rewrites that one file and forwards `onSegment`.
- **ARCH-7:** the grader seam is synchronous in F1c. The live grader goes through `gateway.run` with the matcher as fallback, a fenced versioned prompt, and an in-flight-join amendment.
- **ARCH-8:** a `json_extract` filter, with no index and no migration until progress p95 is above 100 ms.

**Content check (T11):** the drafts are structurally sound: valid partitions, no planted text in the references. They need format-only mapping (C12). Two gaps are hidden work for the PM: `practice.json` and `schedule.json` don't exist, and `diagnostic.json` is items, not exercises.
**Dissent recorded:** none yet. The PM may contest C11 (inv. 8 voice "next" / "review") on scope. My view is that the invariant requires it.
**Follow-ups:** the PM applies C1–C15 to `spec.md` and `tasks.md`, and adds the F1a sequencing and test lines (C7). The founder confirms ARCH-2. ADR 0008, ADR 0002 Am. 3 and ADR 0006 Am. 3 are written, and `decisions.md` has D24.

### learning-designer · 2026-10-13 · RISK
**The matcher will misgrade correct corrections, even after C1.** Detail: `docs/research/applied-ai/module-1/REVIEW.md` B2–B3. Hand traces: `exercises/_matcher-test-answers.json`.
- **Failure mode 1 (polarity):** the FR-021(b) negation rule and FR-022 red flags ignore polarity. Correcting a misconception usually *is* a negation, so the textbook answer to catch-05 s5 ("still not fully deterministic") is predicted `uncertain`.
  - If `not`/`no` are stopwords, wrong answers match negative rubric items: "consistent and identical every time" matches `more consistent not identical`.
  - A strong interview answer that names and rejects a red flag ("I wouldn't fine-tune for knowledge") becomes `uncertain`.
- **Failure mode 2 (arithmetic):** `ceil(0.67 × 3) = 3` and `ceil(0.67 × 2) = 2`, so every catch dimension in module 1 needs 100% for `met`.
- **Likelihood:** H · **Impact:** H. SC-003 (valid-alternative ≥ 75% met) and SC-004 (uncertain ≤ 10%) are both likely to fail, and the learner hears "can't score" when right, days before the interview.
- **Mitigation (PM/architect decide):**
  - (1) Skip the negation check when the rubric item itself contains a negator. Count a red flag only when no negator precedes it.
  - (2) `metRatio = 2/3`, with an epsilon before `ceil`.
  - (3) Adopt the draft lexicon in `_matcher-test-answers.json`.
  - (4) QA adds its 24 answers to the T01a labelled set.

  C1 (`|` alternatives) already covers the third issue I found.

### learning-designer · 2026-10-13 · EVIDENCE
**Answering:** OQ-1 (content accuracy, the learning-designer half)
- **Checked:** the portable claims, against Anthropic docs fetched today (glossary, context windows, structured outputs, citations, reduce-hallucinations, embeddings, contextual retrieval): **verified**. arXiv and OWASP were unreachable, so Lewis, Liu, RAGAS and OWASP LLM01 are **secondary**.
- **11 fixes, logged in REVIEW.md:**
  - two contestable "clean" lines in the zero-error controls: catch-03 s2, and the catch-07 s4 prompt-injection overclaim;
  - a dated "different embedding models are never compatible" claim (Voyage 4 shared space; **secondary**);
  - the catch-08 s5 key, whose own cited source found top-20 best;
  - a missing caveat: Citations and structured outputs can't be combined (400);
  - a temperature misconception that contradicted its own file;
  - Lewis et al. wording.

  No AWS claim looks wrong; all stay UNVERIFIED. `docs/research/**` is founder-owned, so the founder accepts or reverts these at sign-off.
- **Pedagogy:** learn and planted modes are cleanly separated, zero-error controls exist, and every analogy states where it breaks down. Gaps:
  - tone tells (planted lines carry the absolutes);
  - catch-06 isn't subtle for d3;
  - one item per concept, so spaced review can only replay (Later: parallel sets);
  - every follow-up is a string, so FR-053 `failureModesTradeoffs` is `n/a` everywhere;
  - the scenario (~25 min) and diagnostic (~20 min) need splitting for focus-friendly sittings.
- **Interview fit:** RAG strong; embeddings and production thin; agents absent. Recommend the PM put M2 (agents) immediately after M1.

**Confidence:** high on the Anthropic-sourced facts and the matcher arithmetic; medium on the traces (no matcher exists yet; the stopword list is undefined).
**What would change my mind:** a matcher@1 run on `_matcher-test-answers.json` grading the clear and valid-alternative answers `met`, and the incorrect ones `not_met`.

### technical-product-manager · 2026-10-13 · DECISION
**Answering:** the architect's design review (C1–C15, product note on string follow-ups) and the learning-designer's RISK (B2, B3, B4). F1c `spec.md` and `tasks.md` are now **Approved (revision 2: design review applied)**.
- **Applied:** C1–C15 in full, including the optional C15 (`applied-ai` added to the deny-list). Every F1c Files line is single-line (C6). Engine-isolation, leak-scan and guard tests added (C3, C5, C7). Sync grader with `TypeError` (C4). `web/practice/speech.js` and `onSegment` (C8). Voice "next", "review" and "diagnostic" with copy and per-command tests (C11; I don't contest it). T11's format mapping and content gates (C12). Source links (C13). `projectPractice(events, track, exercises)` (C14).
- **F1a rev 4.7 (C7):** cross-spec order added. T12 depends on F1c-T08 and gains the `pra_` 404 test. T13a depends on F1c-T04. T15 depends on F1c-T06, takes `web/practice/speech.js` and forwards `onSegment`. T19b counts only `F1a-` todos.
- **PD-1, follow-ups:** readiness also counts graded scenario challenges. `failureModesTradeoffs` = a rubric `followUp` met, or `defense` met on ≥ 2 challenges or rubric follow-ups. `defendDecision` = ≥ 1. I chose this over converting every module-1 follow-up (16 `followUp` plus the interview `followUps`) in T11, because it needs no new authoring before the interview. T11 also adopts the learning-designer's B4 rubrics for catch-06 and catch-08 if the content author agrees here (OQ-6). Other concepts show `n/a`. Rubric follow-ups become the standard from module 2 on.
- **PD-2, negation (B2 (a)):** negators are content tokens, never stopwords. FR-021(b) skips an item whose matched alternative contains a negator. A red flag counts only when no negator precedes it within 3 tokens. Named T03 tests cover both cases.
- **PD-3, threshold (B3):** `met` = `ceil(n × 2/3 − 1e-9)` (2 of 3). A T03 test covers it.
- **Labelled sets:** T01a builds `m1-labelled-answers.json` from `_matcher-test-answers.json`. That is new SC-003b, the same thresholds against `packs/applied-ai`, gating T11. The draft synonym list goes into T11's `lexicon` if the author agrees.
- **Small call:** when today's plan is finished, "next" opens the progress page, not the picker, so that "review" stays reachable by voice.
- **Dissent recorded:** none. The architect's C11 view is adopted.
- **Wave A is ready to build now:** F1c-T01a, T02, T03 [P] → T04 → T05. No re-review; the architect checks the diff at code review.
- **Still open, founder:** OQ-1 (fact sign-off), OQ-3, OQ-5 (confirm ARCH-2 before T11 merges). **Content author:** OQ-6. **PM + learning-designer, before T11:** the 7-day plan and ≤ 6 diagnostic ids, recorded here.

### qa-engineer · 2026-10-14 · RISK
**Answering:** SC-003 / SC-003b, now that T02 and T03 are merged (F1c-T01a).
- **Failure mode:** matcher@1 misses the SC-003 functional gate on the QA-labelled set (45 rows): `clear` → `met` **80%** (gate 100%), `valid-alternative` → `met` **50%** (gate ≥ 75%). Every other SC-003 threshold passes (incorrect → met 0%, valid-alt → not_met 0%, partial → partial/uncertain 100%, should-flag → uncertain 100%, uncertain on clear+incorrect 0%). All 6 misses are the FR-019 stuffing cap firing on concise, complete sentences (filed **F1c-B20**). Disabling the cap fixes all 6 but lets 2 new keyword-list rows reach `met`, so FR-019 needs a better rule, not removal.
- **Preview of SC-003b (informational, not the gate):** grading the 24 module-1 rows against the *research drafts* with `draftSynonyms` gives clear 100%, incorrect → met 0%, but valid-alternative → met **16.7%** and partial → partial/uncertain **66.7%**. Consistent with B11/B12. The m1 set has no `should-flag` rows, so that threshold can't be checked there.
- **Likelihood:** H (measured) · **Impact:** H (US1.5 and US1.11 fail at HTTP level for the same cause; T04 can't be verified green on them).
- **Mitigation:** PM + architect rule on FR-019 wording; backend fixes the matcher with a `MATCHER_VERSION` bump. SC-003 stays a `F1c-T03` todo, run for real in `npm test` with its confusion table printed, until it passes. Evidence: `node --test --test-name-pattern="SC-003 labelled" tests/acceptance/F1c.test.js`.

### principal-architect · 2026-10-14 · DECISION
**Answering:** F1c-B21 (does a false interruption write `graded`?), plus the Wave A code-review verdict.
- **The call: yes.** Every practice catch stop writes `stopped`/`explained`/`graded`. A false interruption gets `graded.result = {dimensions: {}, overall: null, outcome: "false_alarm", …}`.
  - **The code stays.** QA changes `tests/acceptance/F1c.test.js:482` to expect the second `graded`, and also asserts `overall: null` and `outcome: 'false_alarm'` on it.
  - The PM fixes the spec table's `graded` "When" cell and closes B21.
  - Recorded as ADR 0002 Amendment 4, with the `decisions.md` D18 row updated.
- **Rationale:**
  - Am. 3 already lists `false_alarm` as a `graded` outcome and says "a stop's … graded". Without the event, that outcome could never be written.
  - The card engine has always written `graded` on a false alarm. One shape per stop keeps the F2 cross-engine projection free of engine branches.
  - The cost is grader-metric pollution, which the Am. 4 reader rule handles: grader metrics and mastery count only `overall !== null`.
- **Dissent recorded:** QA's test followed the spec's "with every stop hit or answer" wording. That was a fair reading of a contradictory spec, not an error.
- **Wave A verdict: CHANGES REQUESTED.** Two blockers, both small (details in `docs/specs/F1c-practice-engine/review.md` "Wave A code review"):
  - **W-B1:** B20 (below).
  - **W-B2:** "Skip this stop" records the statement as missed, against ADR 0004 Am. 1. The fix is the additive `skipped` / `notGradedStatementIds` in Am. 4.
- **Evidence:**
  - `npm test`: `# tests 443 / # pass 331 / # fail 0 / # todo 112`.
  - Golden replay: 61 runs, 0 diffs.
  - `check:ticket`: ok for every Wave A ticket.
  - Standing greps: clean.
- **Follow-ups:**
  - PM: the spec edits for B21, W-B2 and W-S1, and the FR-019 threshold (below).
  - Backend: `matcher@2`, `complete` with `skipped`, the W-S3 and W-S5 tests.
  - Frontend: Skip bookkeeping (W-B2), the gap STOP (W-S2), the self-rating error (W-S4).
  - QA: the FR-050 and `MATCHER_VERSION` assertions, and two module-1 keyword-list rows.

### principal-architect · 2026-10-14 · PROPOSAL
**Answering:** F1c-B20 (the FR-019 rule). The PM decides the threshold; backend implements.
- **Rule (`matcher@2`):** cap at `partial` only when ≤ 2 content words remain after removing matched forms (as today) **and** fewer than 20% of the answer's words are function words (the matcher's existing generic `STOPWORDS`; no new vocabulary). It is one condition on `practice-matcher.js:227`, plus one named constant, `stuffedMaxFunctionShare: 0.2`.
- **Measured** (the real matcher with only that line swapped):
  - **accept-pack SC-003:** all 7 checks pass, up from 5.
    - clear → met: 80% → **100%**.
    - valid-alternative → met: 50% → **100%**.
    - partial → partial/uncertain: **100%**. Both keyword lists stay `partial`.
    - incorrect → met 0%; should-flag → uncertain 100%; uncertain on clear + incorrect 0%.
  - **Module-1 drafts with `draftSynonyms` (SC-003b proxy):** unchanged at clear 100%, incorrect → met 0%, partial 66.7% ✗, valid-alt 16.7% ✗. No module-1 answer triggers the cap. Those misses are B11 and B12, not B20.
- **Margin:** correct sentences that hit the leftover-words condition have function-word shares ≥ 0.27, and the keyword lists have 0.00. Every threshold from 0.05 to 0.30 passes, and 0.2 still catches a list padded with an article or two.
- **Rejected:**
  - deleting the cap (the lists become `met`, and partial lands on the 80% gate);
  - "no causal connective" (a correct answer with "and … over … on" stays capped);
  - "matched share ≥ x" (correct concise sentences reach 1.00 too).
- **Confidence:** medium. The rule is measured on 45 + 24 rows, but only 2 of them are keyword lists.
- **What would change my mind:** a labelled keyword list that sneaks under the rule without being an explanation, or a correct sentence below a 0.2 share.

### principal-architect · 2026-10-14 · RISK
**Gaming: a learner pads a keyword list with function words** ("the heavier line and more drag so the kite lower …") and gets `met`. Likelihood L, impact L. The learner is the founder practising alone, so padding is self-deception, not fraud. Self-rating and κ (SC-004) expose drift. **Mitigation:** the T03 test "a list padded with one article is still capped". The live grader (Later) supersedes the matcher.

### principal-architect · 2026-10-14 · RISK
**Dictation strips grammar.** Speech recognition can deliver clipped fragments ("check frays sunlight rubbing weaken line"), which would be capped even though the learner said a sentence. Likelihood M once voice lands (T06), impact M. **Mitigation:** the transcript is editable before Send (FR-033), and a capped answer is `partial`, never `not_met`. QA adds one real dictated answer per class to the labelled set during T01b, and the PM revisits the 0.2 if it fails.

### principal-architect · 2026-10-14 · RISK
**Overfitting to 2 rows.** The keyword-list class has 2 examples, both authored by QA, and the module-1 set has none. The rule could look right only because the test data is thin. Likelihood M, impact M (a wrong `met` inflates independent mastery). **Mitigation:** before the B20 fix merges, QA or the learning-designer add ≥ 2 module-1 keyword-list rows (expected `partial`) and ≥ 2 short correct module-1 sentences. SC-003 and SC-003b must pass on the enlarged sets, not just today's.

### principal-architect · 2026-10-14 · RISK
**Matcher version churn splits the evidence.** `matcher@1` grades already in the log (from any founder sessions before the fix) are not comparable with `matcher@2`. Likelihood H if the founder practises before the fix, impact L. **Mitigation:** every `graded` is stamped with `graderVersion` (FR-014). Progress and κ group by version, and old grades are never regraded or rewritten (inv. 6).

### qa-engineer · 2026-10-14 · DECISION
**Answering:** ship / don't ship for F1c Wave A (T02, T03, T04, T05). Evidence in [`qa-report.md`](../../specs/F1c-practice-engine/qa-report.md).
- **The call: DON'T SHIP.**
  - **Functional: FAIL.** US1.5 and US1.11 fail (B20), and review blocker W-B2 is open (reproduced in the browser).
  - **AI quality: FAIL.** On SC-003, clear → met is 80% (gate 100%) and valid-alternative → met is 50% (gate ≥ 75%) (B20).
- **Rationale:**
  - **Regression is green:** `npm test` gives `# tests 443 / # pass 331 / # fail 0 / # todo 112`, and the golden replay gives 61 runs, 0 diffs.
  - **T04 acceptance**, with the todo markers removed in a scratch copy: 22 of 25 pass. FR-050 passes once the test follows the architect's B21 ruling.
  - **Real browser** (real server, text and voice, 390 and 1280 px): 143 of 144 checks pass. The one failure is the known favicon 404 from thread 0006. FR-035 is clean on 47 of 47 utterances, and no hidden key or answer text appears in the DOM or the network before an attempt or an assist.
- **Dissent recorded:** none.
- **Follow-ups:**
  - **Ships when:** `matcher@2` passes SC-003, US1.5 and US1.11 on the enlarged labelled sets; W-B2 is fixed; and QA updates FR-050 (the B21 ruling and W-S6).
  - **New bugs:** none. Backend's B30 and B31 are duplicates of B20 and B21 and were not filed.
  - **Favicon:** the founder or the PM must rule on the favicon 404 before SC-005 (T01b) can pass honestly.
  - **Waiver:** QA can't waive the AI-quality failure. Only a founder `DECISION` can.

### technical-product-manager · 2026-10-14 · DECISION
**Answering:** the architect's FR-019 PROPOSAL, the Wave A code review (W-B1, W-B2, W-S1–W-S6), QA's DON'T SHIP conditions, F1c-B20, B21, B22 and the favicon. This is applied as spec and tasks **revision 3**, with a fix wave, **Wave A.1**.

- **FR-019 threshold (B20, PD-4):** `stuffedMaxFunctionShare = 0.2`, accepted as proposed, in `matcher@2`. It sits mid-band (0.05–0.30 all pass), below the 0.27 correct-sentence floor, and still caps a 5-word list padded with one article. It is provisional. I revisit it here if a labelled keyword list reaches `met` or a correct sentence is capped, including T01b's dictated rows.
  - **Overfitting RISK accepted as a merge gate:** new **SC-012**. F1c-T15 adds ≥ 2 module-1 keyword lists (expected `partial`) and ≥ 2 short correct module-1 sentences (expected `met`) as `qaRows`, plus 2 accept-pack rows. QA records that the short rows are capped under `matcher@1` before T12 merges.
- **W-B2 (PD-5):** ADR 0002 Am. 4 is adopted as written (FR-009a).
  - New copy `missed.notGraded`: "Not scored, you skipped this stop: {text} {whyWrong} Corrected: {correctedText}".
  - `sum.line` is unchanged, and no `summary.notGraded` is added (Later).
- **B21:** the events-table "When" cell is fixed per the ruling. The reader rule (`overall !== null`) is added to FR-052 and SC-004. Closed in the spec.
- **B22:** FR-002 now says "a folder of pack folders". The T04 and T01b notes are fixed. Closed.
- **Should-fix items:**
  - **In Wave A.1:**
    - W-S1: `stopId`, and a request without one keeps the old rule (PD-6);
    - W-S3;
    - W-S4: new copy `err.rate` and `btn.retry` (PD-7);
    - W-S5;
    - W-S6.
    - All are cheap correctness fixes in files Wave A.1 already touches.
  - **Deferred: W-S2 → F1c-T06.** In text mode `complete` follows `end.catch` immediately, so there is no gap. In Wave A voice mode STOP is by button or Space only, and T06 rewrites this handler for the hotword. T06 gains US2.12 and the acceptance line.
- **Favicon (PD-8): fixed, not exempted.** `web/practice.html` gains `<link rel="icon" href="data:,">`, so SC-005 stays "0 console errors" with no filter. The card game's 404 stays with thread 0006, because `web/index.html` is Untouched.
- **Spec catch-up:** the matcher rules the architect confirmed as built are copied into FR-017, FR-021 and FR-022.
- **Tickets:**
  - F1c-T12 (backend, S, `matcher@2`);
  - F1c-T13 (backend, M, service: `skipped`, `stopId`, W-S3, W-S5, Am. 4 tests);
  - F1c-T14 (frontend, M, page: skip bookkeeping, not-scored line, `stopId`, `err.rate`, favicon);
  - F1c-T15 (QA, S, labelled rows, SC-012);
  - F1c-T16 (QA, M, FR-050 update, new acceptance tests, todo removal, re-verify).
  - T12, T13, T14 and T15 can run in parallel. Merge order: T15 → T13 → T12; T14 at any time; T16 last.
- **Dissent recorded:** none.
- **Follow-ups:**
  - **learning-designer:** please answer spec LR-9 (is 0.2 right for terse spoken answers?) and LR-10 (the `missed.notGraded` wording) here. Advisory; not merge-blocking.
  - **principal-architect:**
    - confirm that `stopped.result.stopId` (additive, present only when sent) needs no ADR 0002 text beyond a note;
    - rule on spec OQ-7 (voice "try again" / "skip" at `err.net`, inv. 8) for T06.
  - **Thread status** stays `open`: OQ-1, OQ-3, OQ-5 (founder) and OQ-6 (content author) are still pending.

### qa-engineer · 2026-10-14 · DECISION
**Answering:** F1c Wave A + A.1 ship / don't ship (F1c-T16). Evidence: [`qa-report.md`](../../specs/F1c-practice-engine/qa-report.md) "F1c-T16".
- **Functional: PASS.**
  - Fresh `npm test`: exit 0, `# tests 469 · # pass 383 · # fail 0 · # todo 86`. No `F1c-T03`, `T04`, `T12` or `T13` todo remains.
  - FR-050 follows the B21 ruling and asserts `MATCHER_VERSION` (W-S6).
  - 5 new A.1 acceptance tests (US1.13, US1.14, `skipped` and `stopId` validation, assist after complete) pass on HEAD. All 5 fail on the pre-T13 service, so they bite.
  - Golden replay: `61 runs, 0 diffs, digest cc1c3558d43c7e02`.
  - Real browser against the real server: 210/210 checks, run twice with identical results. Text and voice at 390 and 1280 px; US1.13/US2.10 (skip → not scored), US1.14 (`stopId` retry and re-stop), US1.15/US2.11 (rating error and Retry); no `/favicon.ico` request; **0 console errors, no filter**; FR-035 holds for every utterance.
- **AI quality: PASS.** On `matcher@2`, SC-003 meets every pre-registered threshold on 48 rows (clear → met 12/12, valid-alternative 8/8). SC-012 is 7/7. Its `matcher@1` validity, re-run by me, holds. No prompt, gateway or model change, so no live eval is due. The golden replay is the replay tier, with 0 diffs.
- **Call: SHIP** F1c Wave A + A.1. F1c-B20 and B21 and review finding W-B2 are verified fixed. Wave B may start.
- **Dissent recorded:** none.
- **Follow-ups:**
  - **New bug F1c-B23 [minor, doesn't block]:** more than 20 skips in one exercise make `complete` return 400. The page then shows `err.net` ("Couldn't reach the server"), and its Try again can never succeed (an inv. 7 stall, but only after 21 failed stops). The root cause is wider: `complete()` maps every 4xx to `err.net`.
    - **PM:** choose the policy (cap the client at 20, hide Skip after 20, and in any case handle a 4xx at `complete` with a different message and a way out).
    - **frontend-engineer:** fix it before T01b.
    - **principal-architect:** if you count this as a blocking inv. 7 finding, say so here and I'll re-run.
  - **learning-designer (LR-10, advisory):** the not-scored line has the same red border as a "Missed" line. A neutral style may fit "not scored" better.
  - **Lead:** three orphaned `server/index.js` test servers (PPID 1) have been running since 03:40, before this session. Not mine; I left them running.

### principal-architect · 2026-10-14 · DECISION
**Answering:** the F1c Wave A.1 re-check (W-B1, W-B2, should-fix items); the PM's two questions (`stopId`, OQ-7); QA's question on F1c-B23. Full detail: `docs/specs/F1c-practice-engine/review.md` "Wave A.1 re-check".
- **Verdict: APPROVED.** Wave A + A.1 may merge, and Wave B may start.
  - **W-B1** is fixed: `matcher@2`, with the cap at `practice-matcher.js:231`.
  - **W-B2** is fixed and matches ADR 0002 Am. 4 clause by clause (`practice.js:27-36`, `:282-298`).
  - W-S1, S3, S4, S5 and S6 are correct.
- **Evidence (run fresh):**
  - `npm test`: exit 0, `# tests 469 / # pass 383 / # fail 0 / # todo 86`.
  - Golden replay: `61 runs, 0 diffs, 0 allow-listed diffs, digest cc1c3558d43c7e02`.
  - The Untouched list and `server/ai`, `server/prompts`, `shared/` and `packs/` all have an empty diff.
  - Standing greps are clean on the added lines.
  - `check:ticket` is ok for T12–T15. T16's extra file is this thread, append-only.
- **`stopped.result.stopId`:** a note is enough, and no new amendment is needed. Because a statement can now have more than one stop, the note states the reader rule: join a triple by `seq` within its batch, never by `stopId`. Written under ADR 0002 Am. 4, with the D18 row updated.
- **OQ-7: yes, for T06** (inv. 8).
  - Two command rows: "try again" while `net-error` is shown, and "skip" while `skip-btn` is visible. Both use the FR-032 bare-phrase rule.
  - Both arm only after the `err.net` utterance has finished, because that copy itself says "Try again".
  - One test per command, plus the test "'try again' inside a longer sentence does nothing".
  - The card game's `err.net` goes to F1a-T15.
- **F1c-B23: an inv. 7 defect, not blocking for Wave A.1, gated before F1c-T11 merges and before T01b.**
  - **Root cause:** `complete()` maps every error, including a 4xx a retry can't fix, to `err.net` with endless Try again (`app.js:331-339`). A 404 after a mid-attempt restart with a bumped pack version is a likelier trigger than 21 skips.
  - **Why it doesn't block:** nothing is corrupted, and reload recovers. This merge removes a worse, permanent defect (W-B2).
  - **Fix (frontend; the PM picks the copy):**
    - (1) Keep one skip per `statementId`, the one with the smallest `elapsedMs`. This gives the server exactly the same attribution, and it bounds the list at `LIMITS.narration` = 20 = the cap.
    - (2) A 4xx at `complete` (and at a stop) shows a distinct message and a way back to the picker, by button and by voice. Network errors and 5xx keep `err.net`.
  - **Partly my gap:** Am. 4 set the cap without saying how the client stays under it.
- **Dissent recorded:** none so far. QA asked the question without arguing either way.
- **Follow-ups:**
  - **PM:** a B23 fix ticket gated before T11 and T01b; the OQ-7 rows in T06; the copy for the 4xx message.
  - **Frontend:** the B23 fix.
  - **QA:** re-run `bug-21-skips-text-1280` and a mid-attempt pack-version 404 on the fix.

### principal-architect · 2026-10-14 · RISK
**Deferring B23 lets a stall reach the founder.** If the founder practises on real content while the server restarts with an edited pack, `complete` returns 404, and the page loops on a false "Couldn't reach the server". Likelihood M during T11 content iteration · impact M (the session's summary is lost, and trust in the tool drops days before the interview). **Mitigation:** the fix is gated before F1c-T11 merges, which is when the founder starts on real content. A reload recovers, and the stops are already in the log.

### principal-architect · 2026-10-14 · RISK
**`skipped` is client-asserted and can't be verified.** Any client can list every planted statement as skipped and turn misses into "not graded", which inflates detection. Likelihood L (one learner, practising alone) · impact M (detection mastery reads high). **Mitigation:** the per-attempt `skippedStatementIds` are stored, so T08 can report a skip rate next to detection, and a high skip rate is visible rather than hidden. Revisit before any multi-learner or assessed use.

### principal-architect · 2026-10-14 · RISK
**`matcher@2` was tuned and gated on the same small labelled set.** SC-003 passes on 48 rows and SC-012 on 7 module-1 rows (with 24 more labelled module-1 rows behind SC-003b), but the threshold 0.2 was chosen by looking at those rows. Likelihood M · impact M (a dictated, grammar-poor correct answer is capped to `partial`, or a padded list reaches `met`). **Mitigation:** the PM's revisit trigger on 0.2, T01b's dictated rows, and SC-004 κ grouped by `graderVersion`. The 0.2 constant is named in `MATCHER_RULES`, so a change is one line plus a version bump.

### technical-product-manager · 2026-10-14 · DECISION
**Answering:** the architect's Wave A.1 re-check follow-ups: the F1c-B23 policy, fix ticket and copy; OQ-7 for T06. Applied as spec and tasks **revision 4**.
- **F1c-B23 (spec PD-9, FR-059, FR-060, SC-013) → new ticket F1c-T17 (frontend-engineer, M).** The architect's smallest fix, as proposed:
  - one skip per `statementId`, the **smallest** `elapsedMs` (pure `recordSkip` in `state.js`, plus a source-check test that `MAX_SKIPPED ≥ LIMITS.narration`);
  - an `ApiError` 400–499 at `complete` **or** at a stop shows the new `err.rejected` panel (`#rejected`) with **Back to exercises** (`#picker-btn`, re-fetches the track) and no Try again or Skip. `NetworkError` and 5xx keep `err.net`. Classification lives in one pure `errorKind(err)`, which uses `instanceof ApiError`.
  - QA's option (b) is rejected (hiding Skip removes the honest way past a failing stop). The server rule is unchanged.
  - **Copy:** `err.rejected` = "The server can't continue this exercise, and trying again won't help. Say "back" or press Back to exercises."; `btn.picker` = "Back to exercises". It promises nothing about saved work, which would be untrue after a 404 "attempt not found".
  - **Gate:** T17 merges before T11 merges and before T01b's verdict run and merge. QA's re-run (`bug-21-skips` and a mid-exercise pack-version 404, at a stop and at `complete`) is in T17's acceptance and closes B23.
- **OQ-7: closed (spec PD-10, FR-061), in F1c-T06 as ruled.** "try again" works while `#net-error` is shown. "skip" works only while `#skip-btn` is visible. The B23 way out, "back" / "back to exercises", works while `#rejected` is shown.
  - Each command arms only after its panel's utterance resolves (pure `errorCommandState`). Each is whole final segment only.
  - The tests are the architect's: one per command, plus "'try again' inside a longer sentence does nothing". The copy is unchanged.
- **Wave B ordering change:** the frontend lane is now **T17 → T06** (shared `web/practice/*`; T06 also wires T17's panel to voice). T07, T08 and T11's preparation are unaffected. T11's merge also waits on T17. T01b may be written now, but its run and merge wait on T17.
- **Accepted gap:** until T06 merges, `err.rejected` names a voice command ("back") that isn't live yet. This is the same gap as `intro.catch`'s "Say 'stop'" in Wave A, and the button always works.
- **Dissent recorded:** none.
- **Follow-ups:**
  - **frontend-engineer:** F1c-T17 now, then F1c-T06.
  - **qa-engineer:** the B23 re-run per T17's acceptance; the T01b additions.
  - **principal-architect:** check T17's diff at code review. No ADR is needed: client-only, no contract change.
  - The thread stays `open` (OQ-1, OQ-3, OQ-5, OQ-6).

### principal-architect · 2026-10-14 · DECISION
**Answering:** the F1c-T17 code review (F1c-B23 fix), diff `798b1d8..23aa509`
- **Call: APPROVED. No blocking findings.**
  - Inv. 7: a 4xx at a stop or at `complete` now shows `err.rejected` with one way out, not an endless Try again.
  - Inv. 9: `say()` uses one string for display and speech. The browser check asserts spoken = shown.
  - Inv. 8: holds for text. Voice "back" is F1c-T06's (accepted gap, PD-9).
  - ADR 0002 Am. 4: the `completed` record is provably unchanged by one-skip-per-statement.
  - Full reasoning and line refs: `docs/specs/F1c-practice-engine/review.md` "F1c-T17 code review".
- **Evidence, re-run by me:**
  - `npm test`: `# tests 475 / # pass 389 / # fail 0 / # todo 86`.
  - `node tests/golden/run.mjs --replay`: `61 runs, 0 diffs, 0 allow-listed diffs`.
  - The engineer's real-browser check, re-run: `checks 196 pass 196 fail 0`. It includes a real pack-version 404 at a stop and at `complete`, in text and voice at 390 and 1280 px.
- **Should fix, not blocking:**
  - (S1) Retitle or squash the "WIP … checkpoint" commit before the merge.
  - (S2) The FR-060 DOM wiring is proven only by a scratchpad script. QA's T01b rev-4 e2e tests (no `todo`) and the SC-013 record in `qa-report.md` close B23, not this review.
- **Docs:** a dated note under ADR 0002 Am. 4 records the client's one-entry-per-statement rule, with the D18 row updated. The decision is unchanged.
- **Gates:** with T17 merged, F1c-T11's T17 gate and F1c-T01b's run gate clear. T06 may start.
- **Dissent:** none recorded.

### principal-architect · 2026-10-14 · RISK
**R1. A voice-only dead end until T06.** `err.rejected` says 'Say "back"', but no recognizer is wired until F1c-T06. T11 is gated on T17, not T06, so the founder's voice-mode content iteration (the likeliest 404 source) can hit a panel the learner can only leave by hand.
- Likelihood: M · Impact: M
- **Mitigation:** run T06 straight after T17, as the plan already says. The founder plays in text mode, or keeps the button in reach, until T06 merges.

### principal-architect · 2026-10-14 · RISK
**R2. A blanket 4xx → `rejected` can mislabel a retryable status.** `errorKind` maps 408 and 429 to `rejected`. The server sends neither today. A future rate limiter, or a hosting proxy (Render), could, and the learner would lose an attempt that a retry would have saved.
- Likelihood: L · Impact: M
- **Mitigation:** whoever adds a limiter or a proxy rule also carves 408 and 429 into `'net'`, with a test row in "errorKind: …" (review T17-O2).

### principal-architect · 2026-10-14 · RISK
**R3. The UI behavior is proven outside `npm test`.**
- **The gap:** the `#rejected` branch, "no further request to the attempt" and the track re-fetch are checked only by an untracked scratchpad Playwright script. `npm test` covers the pure helpers. A later T06, T09 or T10 edit to `app.js` could route a 4xx back to `netError` with every unit test still green.
- Likelihood: M · Impact: M
- **Mitigation:** QA's T01b rev-4 e2e tests land without `todo` before T06 merges. QA records SC-013 in `qa-report.md` (review T17-S2).

### founder (recorded by the lead) · 2026-10-14 · DECISION
**OQ-5 / ARCH-2 confirmed.** Asked in the live session: "can your Module 1 practice content live in the app's repo as plain files under packs/applied-ai? It is only matched against your answers by the built-in grader, never sent to an AI or used as a prompt, and the planted mistakes stay separate from the trusted reference." The founder answered **"Yes, go ahead"**. The option they chose said the 17 AWS claims stay marked UNVERIFIED until checked against AWS docs. ADR 0006 Am. 3's reading stands; the F1c-T11 merge gate on OQ-5 is cleared.

### lead · 2026-10-14 · DECISION
Reversible defaults so F1c-T11 isn't blocked. The founder can override any of them here.
- **OQ-1 (content sign-off):** the learning-designer's pedagogy review (REVIEW.md, done) is the sign-off for teaching quality. **The founder does not fact-check module 1:** they are the learner and must not see the exercises' answers. Facts are covered by the `verified: false` labels plus a later fact pass against official AWS docs, once `docs.aws.amazon.com` is reachable (it is blocked by the network policy today). The founder's ARCH-2 answer accepted moving the content with those labels.
- **OQ-6 (content author):** the module-1 drafts were written by the team in this session, so the lead answers as author. **Accept** PD-1's catch-06 and catch-08 follow-up rubrics and the learning-designer's draft synonym list (with forms failing FR-017 dropped, as T11 says).
- **OQ-3 (schedule):** `schedule.json` alone satisfies "configurable schedule" for F1c. A UI setting stays under Later.
- **Still needed before T11 builds:** the 7-day plan and ≤ 6 diagnostic ids from the PM and learning-designer, recorded here.

### learning-designer · 2026-10-14 · PROPOSAL
**Answering:** the C12 / F1c-T11 content gate (7-day plan, ≤ 6 diagnostic ids) and spec LR-8 (diagnostic composition). Advisory: the PM decides; backend copies the JSON below into `packs/applied-ai/schedule.json`. Exercises are named by id only; nothing here quotes narration, keys or rubrics.

**Diagnostic (6 ids; run in this order, with a break after the third; about 40 min):**

| # | Id | d | Concepts it places |
|---|---|---|---|
| 1 | `m1-catch-01-context-window` | 1 | tokens, context window |
| 2 | `m1-catch-02-rag-vs-finetune` | 1 | prompting vs RAG vs fine-tuning, freshness, citations |
| 3 | `m1-catch-03-pipeline-clean` | 1 (zero-error) | pipeline, chunking, embeddings, retrieval, grounding, abstention; false-alarm baseline |
| 4 | `m1-catch-04-embeddings` | 2 | embeddings, similarity, BM25, hybrid |
| 5 | `m1-catch-05-structured-outputs` | 2 | structured outputs, temperature, validation |
| 6 | `m1-interview-04-evaluate-rag` | 3 | evaluation, faithfulness, abstention, access control, freshness (the "production" ask) |

- **Why these:** they ramp d1 → d3 and include one zero-error control and one open, unaided explanation. None needs module 2. Error-finding helps once some prior knowledge exists, and weaker learners need support (Große & Renkl 2007; Renkl 2014; **moderate**, school maths, extrapolated here). That is why only one d3 item is included.
- **Held back on purpose:** `catch-06`, `catch-07`, `catch-08`, the scenario and `interview-01/02/03`. They stay fresh for days 2–3 and for the mocks, so the mocks measure transfer, not memory of a seen item (REVIEW.md H6).
- **Testing before the lessons is fine here.** Every attempt ends in the reveal, which is corrective feedback. Pretesting followed by feedback improves later learning (Richland, Kornell & Kao 2009; **moderate**, lab text material; cited from memory, not fetched).
- **Swap if the PM wants d ≤ 2 only:** `m1-interview-03-when-not-rag` instead of #6. I advise against it: it overlaps #2 and leaves evaluation unplaced.

**The 7-day plan (120 min a day, as 3–4 sittings of 25–40 min, each built from 3–8 min exercises):**

| Day | Focus | In-app blocks (kind · min · ids) | Off-app time, counted inside the named block |
|---|---|---|---|
| 1 | Placement and foundations | diagnostic 40 · learn 20 (`learn-01`, `learn-02`, `learn-03`) · review 60 | 40 of review: **defend pass 1** |
| 2 | RAG failure modes (first exposures) | catch 35 (`catch-07`, `catch-06`, `catch-08`) · interview 20 (`interview-02`) · review 65 | 40 of review: **defend pass 2** |
| 3 | Design under constraints, plus **mock 1** | scenario 45 (`scenario-01`, in 2 sittings: clarify and design, then challenges) · interview 35 (`interview-03`, fresh) · review 40 | interview 35 = **timed mock 1** (30 min + 5 min debrief); 15 of review: debrief notes |
| 4 | **Agents: module 2 when available.** Fallback: an interleaved "signal ≠ correctness" set | catch 40 (`catch-04`, `catch-06`, `catch-05`) · interview 30 (`interview-04`) · review 50 | 20 of review: **defend, agents framing** |
| 5 | **Agents part 2: module 2 when available.** Fallback: interleaved "which tool" decisions | catch 35 (`catch-02`, `catch-08`, `catch-01`) · interview 25 (`interview-03`) · review 60 | 30 of review: **defend, eval, security, cost** |
| 6 | **Full timed mock (60 min)** and repair | interview 75 (`interview-01`, fresh) · review 45 | interview 75 = **mock 2** (60 + 15 debrief); 15 of review: fix the 2 worst answers |
| 7 | Consolidate: no new material | review 65 · catch 30 (`catch-03`, `catch-07`) · interview 25 (`interview-02`) | 15 of review: final defend pass |

All ids carry the `m1-` prefix (full ids are in the JSON). In-app review = "Review weak spots" (the weakest concept first, FR-056). Answer the **transfer** part every time an item is replayed.

**Defend-my-build passes** (source: `docs/research/applied-ai/defend-my-build.md`). Each pass is retrieval, not rereading: say it aloud closed-book, then check it against the dossier.
- **Pass 1:** §1, §3, §4 (the founder's role) and §6 "Don't claim". Give a 90-second opener: what it is, what I did, what the AI wrote, what isn't built. Settle the three "Open uncertainties" yourself.
- **Pass 2:**
  - sketch the §2 architecture from memory, then check it;
  - give 3 decisions from §5.1, each with its rejected alternative;
  - tell 2 bug stories from §5.2, ≤ 2 min each.
- **Day 4, agents framing:** §6 "Agents" and §4 "Process". Tell the real multi-agent development story, and give §6 item 3 as "how I *would* add one small agent". Never say "built".
- **Day 5:** §5.3–§5.5. For each, give one "built" line and one "designed, not built" line.
- **Day 7:** the opener once, plus the "Don't claim" list.

**Mock structure.**
- **Mock 1 (30 min):**
  - opener, 3 min;
  - `interview-03` aloud in the app, 12 min;
  - two §7 rows (production and users; grader quality), 10 min;
  - debrief, 5 min.
- **Mock 2 (60 min):**
  - opener and "what have you built", 5 min;
  - RAG design with `interview-01` and its follow-ups, 20 min;
  - "how do you know it works / production", 10 min (§5.3, §6);
  - agents, 10 min (a module-2 interview item if available, else the day-4 framing);
  - one decision and one bug deep-dive, 10 min;
  - the founder's questions for them, 5 min.
- **The timer paces the 60-minute format only. No score uses time, and there are no speed bonuses.** Stop latency is logged, not scored. Mock 2 is the one deliberate long sitting, because the real interview is 60 minutes (practice in the target format; inferred, not tested).

**If the interview comes sooner:**
- **≤ 2 days away:** diagnostic → defend passes 1 and 2 → `learn-02`, `learn-03`, `catch-06` → mock 2 shortened to 30 min → review weak spots.
- **The day before the interview:** run day 7 (no new material, sleep).
- **A missed day costs nothing:** `today` advances only on days with practice (FR-055), so there's no streak to break (learning-science.md §5).

**Evidence behind the shape:**
- **Retrieval practice:** every block, defend prep included, is answer-first-then-check (Roediger & Karpicke 2006; Dunlosky 2013; **strong**). Rereading is low-utility, so there are no reading-only blocks.
- **Spacing:** the retention interval is about 7 days, so the best gap is about 20–40% of that, 1.5–3 days (Cepeda 2008; **strong**). Every concept is first retrieved on days 1–3 and again 2–5 days later (for example `catch-04`/`05` and `interview-04`: day 1 → day 4; `catch-08`: day 2 → day 5; `interview-02`: day 2 → day 7).
- **Interleaving look-alikes only** (Brunmair & Richter 2019, g = 0.42; **moderate**, material-dependent, extrapolated):
  - day 4 mixes the "a signal isn't correctness" misconceptions (REVIEW.md M6);
  - day 5 mixes the "context window vs RAG vs fine-tuning vs system of record" decisions.
  - Unrelated items are not mixed.
- **Practice share:**
  - by `schedule.json` kind: 780 of 840 min, **92.9%** (the gate is ≥ 60%);
  - counting all 175 off-app minutes as non-practice: **72%**. Still above the gate, so the folding below doesn't let the plan pass by labelling alone.
- **Focus-friendly:** short exercises and sittings; the scenario is split (REVIEW.md M3). The evidence for fixed-break timers is **weak** (Biwer 2023), so there's no Pomodoro requirement.

**For backend (format rules, all within practice-v1):**
- `schedule.json` has no off-app kind. Off-app minutes are folded into the `review` or `interview` block named in the table. The **thread table is the founder's plan**; the JSON is the app's view of it.
- **Repeated ids are picker replays.** FR-055 `done` is all-time, so "Next" skips an id already completed. That applies to days 4, 5 and 7, which replay items from the picker on purpose.
- **Module 2 swap:**
  - When module 2 lands, replace the day 4–5 `catch` and `interview` ids with module-2 ids, and add a `learn` block of about 20 min each day, taken from that day's `review`.
  - Bump the pack version between sessions, never mid-attempt (B23, R1).
  - The share stays ≥ 85%.

```json
{
  "days": 7,
  "minutesPerDay": 120,
  "diagnostic": [
    "m1-catch-01-context-window",
    "m1-catch-02-rag-vs-finetune",
    "m1-catch-03-pipeline-clean",
    "m1-catch-04-embeddings",
    "m1-catch-05-structured-outputs",
    "m1-interview-04-evaluate-rag"
  ],
  "plan": [
    { "day": 1, "blocks": [
      { "kind": "diagnostic", "minutes": 40 },
      { "kind": "learn", "minutes": 20, "exercises": ["m1-learn-01-how-llms-answer", "m1-learn-02-rag-pipeline", "m1-learn-03-rag-failures"] },
      { "kind": "review", "minutes": 60 }
    ] },
    { "day": 2, "blocks": [
      { "kind": "catch", "minutes": 35, "exercises": ["m1-catch-07-access-freshness-clean", "m1-catch-06-retrieval-vs-generation", "m1-catch-08-design-tradeoffs"] },
      { "kind": "interview", "minutes": 20, "exercises": ["m1-interview-02-retrieval-vs-generation"] },
      { "kind": "review", "minutes": 65 }
    ] },
    { "day": 3, "blocks": [
      { "kind": "scenario", "minutes": 45, "exercises": ["m1-scenario-01-policy-assistant"] },
      { "kind": "interview", "minutes": 35, "exercises": ["m1-interview-03-when-not-rag"] },
      { "kind": "review", "minutes": 40 }
    ] },
    { "day": 4, "blocks": [
      { "kind": "catch", "minutes": 40, "exercises": ["m1-catch-04-embeddings", "m1-catch-06-retrieval-vs-generation", "m1-catch-05-structured-outputs"] },
      { "kind": "interview", "minutes": 30, "exercises": ["m1-interview-04-evaluate-rag"] },
      { "kind": "review", "minutes": 50 }
    ] },
    { "day": 5, "blocks": [
      { "kind": "catch", "minutes": 35, "exercises": ["m1-catch-02-rag-vs-finetune", "m1-catch-08-design-tradeoffs", "m1-catch-01-context-window"] },
      { "kind": "interview", "minutes": 25, "exercises": ["m1-interview-03-when-not-rag"] },
      { "kind": "review", "minutes": 60 }
    ] },
    { "day": 6, "blocks": [
      { "kind": "interview", "minutes": 75, "exercises": ["m1-interview-01-design-rag"] },
      { "kind": "review", "minutes": 45 }
    ] },
    { "day": 7, "blocks": [
      { "kind": "review", "minutes": 65 },
      { "kind": "catch", "minutes": 30, "exercises": ["m1-catch-03-pipeline-clean", "m1-catch-07-access-freshness-clean"] },
      { "kind": "interview", "minutes": 25, "exercises": ["m1-interview-02-retrieval-vs-generation"] }
    ] }
  ]
}
```
I checked this by hand against `validatePracticePack` (`server/services/practice-pack.js:306-342`): 7 entries numbered 1–7, each day summing to 120, no `exercises` on `diagnostic` or `review`, every id an existing module-1 file name, 6 diagnostic ids, and a 92.9% practice share. It hasn't been run, because the pack doesn't exist yet; T11's "schedule defaults" test will run it.

**Later (PM / founder; not in this proposal):**
- an optional per-block `label` so the app can show "off-app: defend prep" (the architect owns the format, ADR 0008);
- per-day `done` for ids repeated on a later day;
- parallel catch sets (H6);
- **an unverified assumption:** Amazon loops usually include Leadership Principles behavioral questions. The founder decides whether that prep fits.

**Confidence:** high on the validator fit and the spacing and interleaving rationale; medium on the time estimates per exercise (no timed founder runs yet).
**What would change my mind:**
- day-1 sittings running over about 40 min, which means cutting the in-app review, not the defend passes;
- a confirmed interview date inside 2 days, which means using the short-notice path;
- module 2 landing, which means the swap above.

### learning-designer · 2026-10-14 · RISK
- **Thin content pool, so most in-app time is replay.** Module 1 has 16 exercises, about 2.5 h of first exposures, in a 14 h plan. Replays test memory of the item, so readiness overstates competence (H6).
  - Likelihood H · Impact M.
  - **Mitigation:** the transfer part on every replay; `interview-01` and `interview-03` held fresh for the mocks; module 2 adds fresh items; parallel sets (Later).
- **"Next" skips replays.** FR-055 `done` is all-time, so the replay blocks on days 4, 5 and 7 show as done, and the founder may read the day as finished.
  - Likelihood H · Impact L.
  - **Mitigation:** this entry and the progress page; the picker is one tap; per-day `done` is Later (PM).
- **The dossier is stale against F1c.** `defend-my-build.md` is at `bb3fb1d`. Since then, per this thread's QA and architect entries:
  - the practice engine is server-owned and writes events per attempt;
  - the suite is 475 tests;
  - §5.4 "answers reach the browser" now applies only to the legacy game.
  
  Rehearsing old facts makes the founder under-claim or misstate. Likelihood M · Impact M.
  - **Mitigation:** the lead refreshes §3 and §5.4 and the test counts, with evidence, before day 2's pass 2 (the file is founder-owned).
- **Off-app minutes are folded into `review` and `interview`,** so the app's labels misdescribe about 175 min. Likelihood H · Impact L.
  - **Mitigation:** the thread table is the founder's plan; the share stays ≥ 60% even when those minutes are excluded.

### technical-product-manager · 2026-10-14 · DECISION
**Answering:** the learning-designer's PROPOSAL (C12 / F1c-T11 content gate, spec LR-8) and RISK; the lead's OQ-1, OQ-3 and OQ-6 defaults; the founder's OQ-5 answer. Applied as spec and tasks **revision 5** (spec PD-11).
- **The plan and the 6 diagnostic ids: accepted as proposed, no adjustment.** The diagnostic ramps d1 → d3, has one zero-error control and one unaided open answer, and keeps `catch-06/07/08`, the scenario and `interview-01/02/03` fresh. The plan spaces every concept 2–5 days apart and holds `interview-03` and `interview-01` fresh for mock 1 and mock 2.
- **T11 acceptance, checked by hand against `server/services/practice-pack.js:306-342` (`PRACTICE_KINDS` = catch, scenario, interview, review; `LIMITS.diagnostic` = 6):**
  - `days` 7, `minutesPerDay` 120. Day sums: 40+20+60, 35+20+65, 45+35+40, 40+30+50, 35+25+60, 75+45, 65+30+25, all 120. Total 840.
  - Practice share: 840 − diagnostic 40 − learn 20 = **780/840 = 92.9%** (gate ≥ 60%).
  - `diagnostic`: 6 ids (gate 1–6). No `exercises` on `diagnostic` or `review` blocks.
  - All 16 ids match a file in `docs/research/applied-ai/module-1/exercises/`.
  - T11's "schedule defaults" test is the proof that runs; this check is not a substitute for it.
- **Off-app labelling: folding accepted for F1c, no format change.** The thread table above is the founder's plan of record; `schedule.json` is the app's view of it. Folding can't game the gate: excluding the 175 off-app minutes gives 72%. My stricter check, which also counts the non-app parts of both mocks as non-practice (mock 1: 23 of 35 min; mock 2: 55 of 75 min), still gives 527/840 = **62.7%**. A per-block `label` is Later, and it is a format change, so it needs an architect ruling (ADR 0008).
- **`interview-04` stays as diagnostic #6; the `interview-03` swap is rejected.** Evaluation and production evidence are the hiring manager's explicit ask ("evidence of taking into production"). The swap overlaps #2 and leaves evaluation unplaced, and `interview-03` is mock 1's fresh item, so using it in the diagnostic would spoil the mock.
- **RISK entries:** all four mitigations accepted as written. The "Next skips replays" and parallel-sets items go into the spec's Later list. Dossier refresh is the lead's job (the file is founder-owned).
- **OQs closed in the spec:** OQ-1 (lead DECISION: learning-designer pedagogy sign-off plus `verified: false` labels and a later AWS fact pass; the founder doesn't fact-check items they will practise on), OQ-3 (lead DECISION: `schedule.json` alone), OQ-5 (founder DECISION: ARCH-2 confirmed), OQ-6 (lead DECISION as author: accept PD-1's two rubrics and the synonym list). **F1c-T11's gates are all cleared.** Its merge gates are cleared too: OQ-5, and F1c-T17 (approved, commit 23aa509, awaiting human merge like the rest of the branch).
- **For backend: copy this block exactly into `packs/applied-ai/schedule.json`.**
```json
{
  "days": 7,
  "minutesPerDay": 120,
  "diagnostic": [
    "m1-catch-01-context-window",
    "m1-catch-02-rag-vs-finetune",
    "m1-catch-03-pipeline-clean",
    "m1-catch-04-embeddings",
    "m1-catch-05-structured-outputs",
    "m1-interview-04-evaluate-rag"
  ],
  "plan": [
    { "day": 1, "blocks": [
      { "kind": "diagnostic", "minutes": 40 },
      { "kind": "learn", "minutes": 20, "exercises": ["m1-learn-01-how-llms-answer", "m1-learn-02-rag-pipeline", "m1-learn-03-rag-failures"] },
      { "kind": "review", "minutes": 60 }
    ] },
    { "day": 2, "blocks": [
      { "kind": "catch", "minutes": 35, "exercises": ["m1-catch-07-access-freshness-clean", "m1-catch-06-retrieval-vs-generation", "m1-catch-08-design-tradeoffs"] },
      { "kind": "interview", "minutes": 20, "exercises": ["m1-interview-02-retrieval-vs-generation"] },
      { "kind": "review", "minutes": 65 }
    ] },
    { "day": 3, "blocks": [
      { "kind": "scenario", "minutes": 45, "exercises": ["m1-scenario-01-policy-assistant"] },
      { "kind": "interview", "minutes": 35, "exercises": ["m1-interview-03-when-not-rag"] },
      { "kind": "review", "minutes": 40 }
    ] },
    { "day": 4, "blocks": [
      { "kind": "catch", "minutes": 40, "exercises": ["m1-catch-04-embeddings", "m1-catch-06-retrieval-vs-generation", "m1-catch-05-structured-outputs"] },
      { "kind": "interview", "minutes": 30, "exercises": ["m1-interview-04-evaluate-rag"] },
      { "kind": "review", "minutes": 50 }
    ] },
    { "day": 5, "blocks": [
      { "kind": "catch", "minutes": 35, "exercises": ["m1-catch-02-rag-vs-finetune", "m1-catch-08-design-tradeoffs", "m1-catch-01-context-window"] },
      { "kind": "interview", "minutes": 25, "exercises": ["m1-interview-03-when-not-rag"] },
      { "kind": "review", "minutes": 60 }
    ] },
    { "day": 6, "blocks": [
      { "kind": "interview", "minutes": 75, "exercises": ["m1-interview-01-design-rag"] },
      { "kind": "review", "minutes": 45 }
    ] },
    { "day": 7, "blocks": [
      { "kind": "review", "minutes": 65 },
      { "kind": "catch", "minutes": 30, "exercises": ["m1-catch-03-pipeline-clean", "m1-catch-07-access-freshness-clean"] },
      { "kind": "interview", "minutes": 25, "exercises": ["m1-interview-02-retrieval-vs-generation"] }
    ] }
  ]
}
```
- **Dissent recorded:** none. The learning-designer's own swap option is rejected, with the designer's agreement as stated in the PROPOSAL.
- **Follow-ups:**
  - **backend-engineer:** F1c-T11 may start now.
  - **founder:** whether Leadership Principles behavioral prep fits the 7 days (an unverified assumption; scope is yours). Until you answer, the plan has none.
  - **lead:** refresh `defend-my-build.md` §3, §5.4 and the test counts before day 2's pass 2.
  - **principal-architect:** none now. A per-block `label` comes to you only if it is pulled from Later.
- **Thread status** stays `open`: Wave B, LR-9 and LR-10 (advisory) and the founder's Leadership Principles question are still discussed here.

### learning-designer · 2026-10-15 · PROPOSAL
**Answering:** F1c-B10, B12, B13 (SC-003b on `packs/applied-ai`). Content only. The author agreed to lexicon and rubric changes (lead, OQ-6). The PM decides; backend applies. **The exact JSON edits are in `docs/research/applied-ai/module-1/lexicon-proposal.json`.** Founder: please don't open that file, because it quotes rubric text. This entry names exercises by id and statement id only.
- **Lexicon:** 48 new keys and 4 extended ones, each traced to a sentence in `packs/applied-ai/reference/m1-ref-01..08` or to the exercise's own key. Examples are negator contractions for `not` (B12 polarity), `faithfulness` (B13), and `queries` (B13: the stem misses the singular).
  - Keys whose token appears in an interview or scenario red flag are **deliberately not added**, so a red flag can't start firing on correct interview answers. Those gaps get item-level `|` alternatives instead.
  - Every form was checked against FR-017 word-start and stemming. I dropped forms that collapse to a common word (examples in the file's `designRules`).
- **Rubric `|` alternatives (at most 8 per item):** on catch-01 s2/s4, catch-02 s3/s6, catch-04 s3/s4/s6, catch-05 s3/s5, catch-06 s5/s6 and catch-08 s4/s5. Every original alternative is kept first and unchanged, except where B10 replaces it.
- **B10 (catch-01 s2, correction):** both items are rewritten so that they share no scoring tokens with the flawed statement, and the "more knowledge" contrast now needs a negator. As a result, an echo of the misconception no longer earns correction credit, and the FR-021(c) echo rule can fire again.
  - **Optional, PM wording call:** reword catch-01 s2 `acceptableCorrections[1]`. Its required tokens overlap the flawed statement by 7 of 8. It is spoken at reveal, so the text is in the file for the PM.
- **Measured: hand-traced, NOT run.** This session had no shell, so I couldn't import `matcherGrade`. I traced `matcher@2` by hand over all 31 SC-003b rows.
  - **All fixes:** clear → met 100%; incorrect → met 0%; valid-alt → not_met 0%; **valid-alt → expected 83.3% (5/6)**; **partial → partial/uncertain 100% (9/9)**; uncertain on clear + incorrect 6.3%.
  - One incorrect row (catch-01 s2) moves from partial to uncertain, which is the B10 echo rule working as intended.
- **Overfitting check:** I wrote the proposal to disk before opening the labelled rows.
  - **Pre-check fixes alone:** valid-alt reaches **50% (fails)** and partial reaches 88.9% (passes). Catch-06 s5 partial passes on B13 plus the `not` key.
  - **6 fixes were added after reading the rows** and are listed in the file's `suspectFixes`. Four have independent grounding (the exercises' own acceptable corrections, ref-08, plain English). The other two are row-driven:
    - one catch-01 s2 alternative fixes my own pre-check alternative's spelling (`sent` never reaches `send`), so its suspicion is low;
    - **one catch-02 s3 explanation alternative is close to verbatim from the row, and the valid-alt gate depends on it.** Without it, valid-alt is 66.7%, which fails.
  - The catch-06 s5 valid-alt row stays partial, and I did not chase it.
- **Held-out set:** per the lead's change of plan, QA writes it without seeing this diff. I wrote none, so I have no held-out number. **QA's held-out result, not SC-003b, should decide whether the suspect fixes stay.**

**Confidence:** medium on the traces (31 rows by hand; one slip could move a row), and high on the design rules.
**What would change my mind:** a real `matcherGrade` run on a scratch pack that disagrees with any traced row; QA's held-out valid-alt rate below 75%; or an interview labelled row that turns uncertain through the new `faithfulness` key.

### learning-designer · 2026-10-15 · RISK
- **SC-003b passes only through one fix that a labelled row prompted.** The gate then measures fit to its own rows. Likelihood M · Impact M (independent mastery reads high on catch-02 s3).
  - **Mitigation:** QA's blind held-out set is the gate for keeping the suspect fixes. Backend runs SC-003b for real on a scratch copy before T11 merges.
- **Pack-global keys widen interview and scenario mustCover** (more `met`). One new key shares a token with an interview-02 red flag. Likelihood M · Impact M.
  - **Mitigation:** re-run any interview labelled rows. That key is kept to its narrowest forms.
- **Polarity is still a matcher limit.** A negator up to 3 words before a rubric token marks the dimension uncertain, even in a correct answer that phrases the point as a negation. Content can only add negator-bearing short alternatives. Likelihood M · Impact M.
  - **Mitigation:** architect, Later. Uncertain results are shown, not scored.

### principal-architect · 2026-10-15 · DECISION
**Answering:** F1c-B11 (FR-021(a) per dimension or per answer), backend's T11 slug deviation, and the SC-003b overfitting risk. Full tables: `docs/specs/F1c-practice-engine/review.md`, "Ruling on F1c-B11 …". Rows are named by index in `m1-labelled-answers.json`. No answer text appears here.

- **Call 1: FR-021(a) stays per dimension. B11 closes as "works as designed", and its rows move to B12.** I measured with the real matcher in a scratch copy, changing only that line:

  | Gate | per dimension (today) | answer level |
  |---|---|---|
  | SC-003, 48 rows, 7 checks | 7/7 pass | 7/7 pass (identical) |
  | SC-012 | 7/7 | 7/7 |
  | SC-003b valid-alternative → expected (needs 5/6) | 1/6, 16.7% | 2/6, 33.3% |
  | SC-003b partial → partial/uncertain (needs 8/9) | 7/9, 77.8% | 7/9, 77.8% |

  - **Answer level invents scores.** On `rows[2]` and `rows[22]`, it turns an honest flag into a confident `not_met` on a dimension the label calls valid. That `not_met` would feed mastery and `detectAndCorrect`. The founder's rule ("uncertain, flag for review instead of inventing a score") rules it out.
  - **Its one gain is narrow.** It wins `rows[10]` only because that label also accepts `partial`.
  - **Rule (a) earns its place.** With it removed entirely, SC-003 should-flag fails (75%).
- **B11 alone can't reach the 75% gate.** The best rule variant reaches 33.3%. Under the per-dimension rule, **100% of the remaining SC-003b gap is content work (B12/B13)**. Under the answer-level rule, at least 75% would still be content work.
  - Content work needed under the per-dimension rule: at least **4 more valid-alternative rows** out of `rows[2]`, `[6]`, `[10]`, `[18]`, `[22]` (at least 5 dimension-level fixes), plus **1 partial row** out of `rows[13]`, `[17]`.
  - B10 (`rows[3]`, correction `partial` on an incorrect answer) belongs in the same content pass.
- **Call 2: the slug deviation is confirmed.** The id for scenario-01's third architecture is cut at the last hyphen within 60 characters (77 → 59). The cut is deterministic and tested for validity and uniqueness. `architectureId` is a pack-internal key: it is not an event field and not a mastery key.
  - The PM adds this clause to C12.
  - T07's reveal shows `summary` as the label, never the id.
- **Evidence:** `npm test` gives `# tests 486 / # pass 400 / # fail 0 / # todo 86` (SC-003b is still `todo: F1c-T11`).
- **Dissent:** backend's filing labels B11 a matcher defect. I hold that it is a content-coverage gap, for the reasons above.
- **Follow-ups:**
  - **PM:** resolve B11 in `tasks.md`, and give B12 the row list above as its acceptance list. Add the C12 slug clause. Decide on SC-003c below.
  - **Content author and learning-designer:** B12/B13 through the lexicon and `|` alternatives only.
  - **Backend:** no code change, no `MATCHER_VERSION` bump.
  - **QA:** SC-003c, if the PM accepts it.

### principal-architect · 2026-10-15 · RISK
**R1. SC-003b becomes a training set.** The B12 lexicon will be written against the same 15 failing-class rows that SC-003b grades. SC-003b has 31 rows in all (24 `rows` + 7 `qaRows`), not 27. The test prints a per-row miss list, so passing would prove fit, not generalization. One valid-alternative row is worth 16.7 points of the gate.
- Likelihood: H · Impact: M
- **Mitigation (proposed; the PM decides the gate):**
  - **SC-003c, a held-out set.** QA commits `tests/fixtures/practice/m1-holdout-answers.json` **before** the B12 content commit. The commit order is checkable.
    - At least 6 valid-alternative, 6 partial, 4 incorrect and 4 clear rows.
    - Written from the narration and reference only, without seeing the lexicon diff or SC-003b's miss list. The content author never opens the file.
  - **Graded once at content freeze,** with the same thresholds. QA records the result in `qa-report.md` with the pack version. `npm test` checks only the file's shape.
  - **Once graded, the set is spent:** it joins SC-003b, and the next content iteration needs a fresh set.

### principal-architect · 2026-10-15 · RISK
**R2. My ruling may push the uncertain share up in real use.** Long answers in unfamiliar wording get flagged rather than scored, so SC-004's "uncertain share ≤ 10%" may miss.
- Likelihood: M · Impact: M
- **Mitigation:** that miss is the pre-registered trigger for the live grader. It is the honest signal, so it is not a reason to change the rule. The share from rule (a) alone can be rebuilt offline by re-running the matcher on stored `explained.text`, with no new event field.

### principal-architect · 2026-10-15 · RISK
**R3. Broadening the lexicon can make incorrect answers match.** Wider synonym forms raise recall on valid wordings, and they also raise it on misconceptions. B10 is already one case: an incorrect answer earns correction `partial`.
- Likelihood: M · Impact: H (an incorrect answer graded `met` teaches the wrong thing)
- **Mitigation:**
  - SC-003b's "incorrect → never met" stays at 100%, and so does SC-003c's.
  - Every new lexicon form is checked so that it does not match the wording of the flawed statement it is meant to correct.
  - The B12 PR lists each added form with the row it targets.

### qa-engineer · 2026-10-15 · EVIDENCE
**Answering:** R1 (SC-003c held-out set)
- **Written:** `tests/fixtures/practice/m1-holdout-answers.json`, with 30 rows on 13 planted statements across catch-01, 02, 04, 05, 06 and 08. catch-03 and catch-07 have zero planted statements, so they can't hold stop rows.
  - By class: 9 valid-alternative, 8 partial, 7 incorrect and 6 clear, against minimums of 6/6/4/4.
  - Each row has `exercise`, `statementId`, `part`, `class`, `text`, `expect` with explanation, correction and overall, and `note`. The file has `gradedAt: null` and `gradedPackVersion: null`. This entry quotes no answer text.
- **How it was written (verified):**
  - I wrote it from the narration and `packs/applied-ai/reference` only.
  - From the answer key I read only the planted statement ids. I did not read rubrics, `acceptableCorrections`, `misconception` or `whyWrong`.
  - I did not open `practice.json`, `m1-labelled-answers.json`, any SC-003b miss list or any lexicon proposal.
  - `git status` at writing time showed `packs/` clean, so no B12/B13 content change had landed yet.
- **Shape test:** `tests/acceptance/F1c.test.js` "SC-003c holdout file shape …" checks only shape, never grades. It passes, and fails on three mutants: an unplanted id, `gradedAt` set, and only 3 clear rows.
- **`npm test`:** exit 0 · `# tests 487 · # pass 401 · # fail 0 · # todo 86`.
- **The commit order is checkable only once the lead commits this file ahead of the B12/B13 content commit.** Until then, R1's mitigation does not hold.
- **For the content author and learning-designer:** do not open the file.
- **Limit:** one labeller wrote the labels (QA), with no second rater. The PM still has to accept SC-003c as a gate. Until then it is QA evidence only.
**Confidence:** high (provenance and shape) · medium (labels, single rater)
**What would change my mind:** a content commit that lands before this file, or evidence that the writer saw the lexicon. Either would mean writing a fresh set.

### lead · 2026-10-15 · EVIDENCE
**Backend's real measurement of the lexicon proposal** (scratch copies; `packs/` unchanged; holdout file never opened). Rows are named by index only.
- **Validation:** variant A (all fixes) and variant B (no `suspectFixes`) both validate with 0 problems. Every item has ≤ 8 alternatives.
- **SC-003b gates, today / A / B:**
  - valid-alt → expected: 16.7% / **83.3%** / 50% (fails);
  - partial → partial or uncertain: 77.8% / 100% / 88.9%;
  - clear → met: 100% in all three; incorrect → met: 0% in all three;
  - uncertain on clear + incorrect: 0 / 6.3% / 6.3%.
  - So A passes every gate and B fails valid-alt.
- **SC-003 and SC-012:** unchanged in every variant.
- **Hand trace vs measurement:** every gate number matches. The one exception is row 18, which comes out uncertain, not partial; it doesn't break a gate.
- **B10:** fixed. Row 3's correction no longer gets partial, and echoing catch-01 s2 back now gives uncertain.
- **Two new content defects, in both A and B:**
  - **catch-05 s3:** echoing the flawed line back goes from uncertain to **partial**, the same failure B10 fixes. A new alternative, and the new `validate`/`citations` keys, match the flawed line itself, which switches the echo rule off. catch-05 is a diagnostic item.
  - **catch-04 s3:** a close paraphrase of its own whyWrong goes from met to uncertain. New keys and an alternative match inside a negation window.
- **Hidden work:** both variants fail 2 tests in `tests/practice-content.test.js` that require the pack to equal the research drafts. Merging a variant means updating those tests.
- **There are no interview or scenario labelled rows.** Backend probed 606 pieces of pack text instead. No interview or scenario part changed; 15 clean narration lines move from not_met to partial on planted stops.
- **Decision rule (lead, pending PM):** don't merge until the two defects are fixed and re-measured. Then QA grades the SC-003c holdout once, on A. A suspect fix stays only if A clears the holdout gates; otherwise take B plus whatever the holdout supports.

### learning-designer · 2026-10-15 · RESPONSE
**Answering:** the lead's EVIDENCE (the two content defects). **Concede both; fixed in `lexicon-proposal.json` rev2.** Every change is tagged `rev2` there. Backend re-measures.
- **catch-05 s3 (echo):** the correction alternative and the two keys that matched the flawed line are reworked. No correction alternative on that stop now matches its flawed line, so the echo rule fires again.
- **catch-04 s3 (negation window):** fixed with a polarity rule, not by loosening negation. A key form must have its item's polarity: no bad-state forms for a good-state item, and no phrasings that learners naturally negate when they describe the failure. The offending forms and correction alternatives are removed, and one replacement is added.
- **Applied generally:** I checked every new alternative on all 13 planted stops against its own flawed line.
  - Key forms that left an item one token short of matching a flawed line are removed (5 keys).
  - The one remaining contact is listed with its risk in the file's `rev2.tokenContacts`.
  - **The rule also catches an original alternative** on catch-04 s6 (correction), which matches its flawed line by itself. The proposed replacement changes reveal text, so it's the **PM's wording call**.
- **Row 18:** I concede the trace. It is uncertain (FR-021(a)), not partial, and no gate changes.
- **Expected after rev2 (hand-traced):** the same SC-003b gates as variant A. Variant B still fails valid-alt. Suspect tags are unchanged, plus one new rev2 alternative tagged suspect-low.
**Confidence:** medium (hand trace). **What would change my mind:** backend's re-measure showing any flawed line still switching off the echo rule, or a gate moving.

### backend-engineer · 2026-10-15 · EVIDENCE
**Answering:** the learning-designer's RESPONSE (rev2 re-measure). I used the real `matcherGrade` on scratch copies. `packs/` is unchanged, the holdout file was never opened, and rows are named by index only.
- **Validation:** A2 (all fixes) and B2 (no `suspectFixes`) both have 0 problems. No item has more than 8 alternatives.
- **SC-003b gates, A2 / B2** (verified): clear → met 100 / 100; incorrect → met 0 / 0; valid-alt → not_met 0 / 0; **valid-alt → expected 83.3 / 50 (fails)**; partial → partial or uncertain 100 / 88.9; uncertain on clear + incorrect 6.3 / 6.3.
  - Every row and dimension status is identical to rev1 A and B. A2 misses rows 3 and 18. B2 misses rows 2, 3, 6, 13 and 18. The hand trace in `rev2.expectedRemeasure` is confirmed.
- **SC-003 and SC-012:** unchanged in A2 and B2. SC-003 passes all 7 checks on 48 rows, and SC-012 is 7/7.
- **606-probe sweep** (verified): **catch-05 s3's echo is back to uncertain, and catch-04 s3's whyWrong is back to met.** Against today, A2 changes 29 probes and B2 changes 28, against 34 for rev1 A. No interview, design, followUps or challenges part changed. From rev1 A to A2, 5 probes changed, and all of them went back to today's status.
- **Rule check** ("no new key or alternative completes on a planted stop's flawed line"): **it holds in A2 and B2, with 0 completions.**
  - Contacts where a new key form hits a flawed-line token without completing: catch-02 s3 `passages` on `correct[0]` alt 0 and on `acceptableCorrections[0]` (1 of 2 needed on the alternative; 4 found, 7 needed on the correction; deliberate per rev2); catch-05 s5 `outputs` (A2 only) and `deterministic`; catch-06 s5 `truth`.
  - About 28 more single-token contacts come from plain words in new 2–3-token alternatives. They are listed in the scratch output.
- **catch-04 s6 rewording:** it stops `correct[1]` alt 0 from matching (A2 1 of 2 needed, against 2 of 2 with the original). **It does not close the echo, though.** Echoing the flawed s6 line still gets correction met, and partial overall, through FR-020: `acceptableCorrections[0]` shares 7 of its 8 tokens with the flawed line through literal words, not the lexicon.
  - **catch-05 s5 `acceptableCorrections[0]` has the same issue** (7 of 11 tokens, 7 needed).
  - Both are present today and unchanged by rev1 or rev2. So "no flawed line switches off the echo rule" is not yet true. The fix is a reveal-wording change (PM call), as with catch-01 s2 `acceptableCorrections[1]`.
- **Hidden work, unchanged:** A2 fails the 2 draft-equality tests in `tests/practice-content.test.js` (the exercise-equals-draft test and the lexicon-equals-draft test).
- **`npm test` on the real repo, fresh:** `# tests 487 / # pass 401 / # fail 0 / # todo 86`.
**Confidence:** high (executed). **What would change my mind:** a different matcher version or a different pack base than the current tree.
