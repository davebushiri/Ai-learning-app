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
