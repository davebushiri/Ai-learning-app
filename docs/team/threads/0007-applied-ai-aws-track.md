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
