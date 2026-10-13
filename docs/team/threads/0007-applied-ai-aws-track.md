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

### learning-designer · 2026-10-13 · RISK
**The matcher rules in F1c will misgrade the module-1 content systematically.** Full detail is in `docs/research/applied-ai/module-1/REVIEW.md` (B1–B3). Hand traces are in `exercises/_matcher-test-answers.json`.
- **Failure mode 1:** rubric items use `|` for alternatives, but FR-017 doesn't define `|`. Alternatives then merge, and learners must say both phrasings.
- **Failure mode 2:** FR-021(b) negation and FR-022 red flags ignore polarity. Correcting a misconception *is* a negation, so the textbook answer to catch-05 s5 ("not fully deterministic") is predicted uncertain. If `not` is a stopword, wrong answers match negative items. Strong interview answers that reject a red flag get flagged.
- **Failure mode 3:** `ceil(0.67 × 3) = 3`, so every 2- or 3-item dimension needs 100% for met.
- **Likelihood:** H · **Impact:** H (SC-003 valid-alternative ≥ 75% met and SC-004 uncertain ≤ 10% are both likely to fail; learner gets "can't score" when right).
- **Mitigation (PM/architect decide):**
  - (1) Split items on `|`, any alternative matches.
  - (2) Skip the negation check when the rubric item itself contains a negator; a red flag counts only when not negated.
  - (3) `metRatio = 2/3` with epsilon.
  - (4) Adopt the draft lexicon in `_matcher-test-answers.json`, and add the 24 answers to the QA labelled set.

### learning-designer · 2026-10-13 · EVIDENCE
**Answering:** OQ-1 (content accuracy, pedagogy half)
- I checked the portable claims against Anthropic docs fetched today: glossary, context windows, structured outputs, citations, reduce-hallucinations, embeddings and contextual retrieval (**verified**). arXiv and the OWASP pages were unreachable, so Lewis, Liu and RAGAS rely on secondary summaries and prior knowledge (**secondary**).
- I made 11 fixes, logged in REVIEW.md:
  - two contestable lines in zero-error controls (catch-03 s2, catch-07 s4 prompt-injection overclaim);
  - a dated "different embedding models never compatible" claim (Voyage 4 shared space; **secondary**);
  - catch-08 s5, whose own cited source recommends top-20;
  - the missing caveat that Citations and structured outputs can't be combined;
  - a temperature misconception that contradicted its own file;
  - Lewis et al. wording.
- No AWS claim looks wrong; all stay UNVERIFIED. `docs/research/**` is founder-owned, so the founder should accept or revert these edits at sign-off.
- **Pedagogy:** learn and planted modes are separate, zero-error controls exist, and every analogy states where it breaks down. Gaps:
  - tone tells (planted lines carry the absolutes);
  - catch-06 isn't subtle at d3;
  - one item per concept, so spaced review can only replay (Later: parallel sets);
  - the scenario (~25 min) and diagnostic (~20 min) need splitting for focus-friendly sittings.
- **Interview fit:** strong RAG; embeddings and production are thin; agents are absent. Recommend the PM schedule M2 (agents) immediately after M1.

**Confidence:** high on the Anthropic-sourced facts and the matcher arithmetic; medium on the matcher traces (no implementation exists yet, and the stopword list is undefined).
**What would change my mind:** a matcher@1 run on `_matcher-test-answers.json` showing clear and valid-alternative answers graded met.

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
