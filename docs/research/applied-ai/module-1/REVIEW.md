# Module 1 review: independent verification

**Reviewer:** learning-designer (on call, independent of the author) · **Date:** 2026-10-13
**Scope:** `README.md`, `diagnostic.json`, `reference/*.md`, `exercises/*.json`, read against [thread 0007](../../../team/threads/0007-applied-ai-aws-track.md) and the F1c spec ([`spec.md`](../../../specs/F1c-practice-engine/spec.md), [`tasks.md`](../../../specs/F1c-practice-engine/tasks.md)).
**Role:** advisory. The author fixes content, the PM decides scope and spec, the architect decides matcher and technical rules, and the founder confirms facts (spec OQ-1).

## Verdict

- **Ownership note:** CLAUDE.md lists `docs/research/**` as founder-owned. The lead directed the edits below. They are logged so the founder can accept or revert each one as part of the OQ-1 accuracy sign-off.
- **Content accuracy: good, with 11 fixes made (see the fix log).** The portable claims hold up against Anthropic's docs (fetched today). None of the eight planted misconceptions is actually true, and every `whyWrong` holds. The fixes were overstatements: two "clean" lines in the zero-error controls were contestable, one embedding claim is now dated, and one of the trade-off items was contradicted by its own cited source. No AWS claim looks wrong, and all remain UNVERIFIED.
- **Assessability: blocking.** Under the matcher as specified (FR-017 to FR-022), this content will be misgraded systematically. The causes are in how the content and the spec meet, not in either one alone.
  - B2 (polarity-blind negation and red-flag rules) and B3 (`metRatio` arithmetic) are not covered by the architect's design review.
  - B1 (`|`) is fixed once the PM applies C1.
  - B4 is a smaller content gap.
- **Pedagogy: sound structure, a few tells.** Learn mode is separate from the planted modes. The zero-error controls, distractors and analogy breakdowns are all present. The weak points are tone tells (H2), a d3 item that isn't subtle (H3), and one item per concept, which leaves nothing new for spaced review (H6).
- **Interview fit:** strong on RAG, partial on embeddings and production, and nothing on agents (by design: Module 2). Given the interview date, agents are the largest gap (H7).

---

## Blocking (fix before F1c-T10 loads this content)

### B1. `|` alternatives are used throughout but are undefined in FR-017 (resolved once C1 is applied)
- **Where:** every `rubric` and `teachBack[].rubric` array, e.g. `catch-01 planted[s2].rubric.explain[0]` = `"working memory for one call|what it can see now"`.
- **Evidence:** spec FR-017 as written has no alternation. If `|` were just a separator, `"per-call working memory|what model sees in one request"` (d01) would need 5 of about 8 tokens, so the learner would have to say both phrasings.
- **Status:** the architect's design review ([review.md](../../../specs/F1c-practice-engine/review.md) **C1**) already requires this: an item is matched if any `|` alternative matches. It is blocking only until the PM applies C1 to FR-017/T03. The content needs no change. `_matcher-test-answers.json` assumes C1.

### B2. The negation rule and the red-flag rule ignore polarity, but this content is made of negations
- **Where:** FR-021(b) (a negator within 3 tokens before a matched token makes the result uncertain) and FR-022 (any red-flag match makes the result uncertain), applied to rubrics such as `"not fully deterministic at zero"`, `"faithfulness is not correctness"` and `"weights unchanged|no training"`, and red flags such as `"fine-tuning for knowledge"` and `"upgrade the model first"`.
- **Evidence:** traced by hand in `exercises/_matcher-test-answers.json`.
  - The textbook answer to catch-05 s5 ("Temperature zero is still not fully deterministic…") is predicted **uncertain**.
  - If `not`/`no` are stopwords (generic English lists include them), wrong answers match negative rubric items. "At temperature zero the answers are consistent and identical" matches `more consistent not identical` on 2 of 3 tokens.
  - In interviews, a strong answer that names and rejects an anti-pattern ("I wouldn't fine-tune for knowledge") matches the red flag and becomes uncertain. Naming the anti-pattern is itself a strong signal.
- **Risk:** correcting a misconception means stating a negation, so most good answers in this module are flagged. SC-004's "uncertain ≤ 10%" is likely to fail, and the learner gets "can't score" feedback where they were right. That is demotivating, and it gives no information about competence.
- **Fix (PM/architect; choose one):**
  - (a) Skip the negation check when the rubric item itself contains a negator. Treat a red flag as matched only when no negator precedes it.
  - (b) Rewrite negative rubric items positively ("varies across calls", "separate from correctness"). This is author work, done item by item.
  - (c) Grade red flags by self-rating only.

  I recommend (a): it is one rule change and keeps the content readable. The author can still do (b) where a positive phrasing is natural.

### B3. `metRatio` arithmetic: dimensions with 3 items need all 3 for "met"
- **Where:** FR-018 / `MATCHER_RULES.metRatio = 0.67`, applied to the 3-item `explain` arrays in catch-02 s3, catch-04 s3, catch-06 s5 and catch-08 s4/s5.
- **Evidence:** `ceil(0.67 × 3) = ceil(2.01) = 3`, and `ceil(0.67 × 2) = 2`. So every catch dimension in this module (2 or 3 items) requires 100% for met. The intended "two-thirds" only takes effect at n ≥ 4.
- **Fix (PM):** use `metRatio = 2/3` with a small epsilon (`ceil(n × 2/3 − 1e-9)`), or `floor`. Separately (author): keep catch `explain` arrays at 2 core items and move narrow extras ("scale varies by model", "documented by provider") out of the scored list (H1).

### B4. String follow-ups leave the trade-off readiness criterion permanently `n/a` (shape mismatches otherwise handled by C2/C12)
- **Status of the shape mismatches:** the architect's C2/C12 cover them as format mappings in T11:
  - `verified` becomes a boolean, with the original string kept in `note`;
  - `challenge`/`expected` become `question`/`rubric`;
  - architecture `id` comes from the `name`;
  - string `followUps` are allowed and self-rated only.

  `diagnostic.json` stays in research. `practice.json` and `schedule.json` are hidden work: the PM, with the learning-designer, records the plan and at most 6 diagnostic ids in thread 0007.
- **What remains a learning issue:** every `followUp` and interview `followUps` entry in module 1 is a string, so all are self-rated only. FR-053 `failureModesTradeoffs` needs a matched follow-up, so it is `n/a` for every concept. Readiness can then never show trade-off competence, which is the skill an interviewer probes most. Content-wise, the `challenges[].expected` lists already exist and map to rubrics.
- **Fix (author, small):** give `followUp` a `{question, rubric}` (2–3 items) on at least catch-06, catch-08 and the four interviews. Drafts follow; the author decides.
  - catch-06: rubric `["both stages can contribute", "right chunk ranked low|buried mid-context", "fix ranking and prompt evidence order"]`.
  - catch-08: rubric `["measure recall@k|hit rate", "measure answer quality|faithfulness", "latency and cost per query"]`.

---

## High

### H1. Rubric vocabulary is too narrow for different wording; there is no lexicon
- **Where:** most catch rubrics. Examples:
  - `"documented by provider"` (catch-05 s5) is not a concept the learner needs to say;
  - `"scale varies by model"` (catch-04 s3);
  - `"window holds the current request"` (catch-01 s2, needs `holds` and `current`);
  - `"test over repeated runs"`, where `runs` is 4 letters, so it is not stemmed and misses "run".
- **Evidence:** every `valid-alternative` answer in `_matcher-test-answers.json` is predicted not_met or uncertain. Each is correct in plain speech ("RAM for a single request", "stuck to the chunks", "junk, pricier, slower").
- **Risk:** voice answers are colloquial, and speech-to-text adds variation ("BM 25"). SC-003 needs at least 75% of valid alternatives graded met.
- **Fix:**
  - **Author:** drop or demote the narrow items.
  - **Pack owner:** adopt the draft `proposedLexicon` in `_matcher-test-answers.json`.
  - **QA:** add the 24 answers to `tests/fixtures/practice/labelled-answers.json`.

### H2. Planted lines can be spotted by tone (absolutes and "so" conclusions)
- **Where:** the planted lines carry the absolutes and confident conclusions, while the clean lines carry the hedges:
  - catch-01 s2 "so a bigger window means it knows more", s4 "every part of it equally well";
  - catch-02 s6 "the best way";
  - catch-04 s3 "we can be confident", s4 "reliably";
  - catch-05 s3 "always … skip", s5 "every identical question … identical answer";
  - catch-06 s6 "The fix is…";
  - catch-08 s5 "for every question".
- **Evidence:** user-flow requires that mistakes are "not given away by tone". catch-04 s7 and catch-06 s3 show the author can write confident clean lines; there just aren't enough of them.
- **Risk:** the learner learns "stop on absolutes", a surface heuristic that won't transfer to an interviewer's confident but correct claims.
- **Fix (author):** in each of catch-04 to catch-08, add or reword one clean line with an absolute that is true. Examples: "Every generated token also counts toward the window." "A schema change always needs re-testing." In each d2/d3 set, hedge one planted line ("In our case, larger chunks will usually give better answers").
- **Also catch-02 s3:** "your company documents" in an "our" narrative is a pronoun tell. Change it to "our company documents". The README pins the wording; the author decides.

### H3. catch-06 (difficulty 3) isn't subtle: s6 contradicts s3 two lines earlier
- **Where:** `catch-06 narration s6` ("upgrade to a larger model, which will know that the leave policy changed") comes right after s3 diagnosed "retrieval and freshness, not generation".
- **Risk:** a d3 slot spent on a d1 catch. The progression from obvious to subtle to trade-off weakens at the top.
- **Fix (author):** make s6 subtler and context-dependent, for example: "Since the right chunk was retrieved, we'll switch to the larger model," after logs that show **both** old and new chunks, with the old one ranked first. The error then becomes misreading a shared retrieval/ranking failure as a generation failure. Keep s5, which is genuinely subtle.

### H4. catch-08 s5 is contradicted by its own cited source (exceptions fixed; narration left to the author)
- **Where:** `catch-08 s5` "We'll retrieve the top twenty chunks for every question…", which cites Anthropic's contextual-retrieval post.
- **Evidence (fetched today):** that post says "Passing the top-20 chunks to the model is more effective than just the top-10 or top-5", and advises experimenting.
- **Risk:** a well-read learner won't stop, or will argue with the key. The error is the rationale and the untested universal rule, not the number.
- **Fixed:** the `exceptions` field now says this (see the fix log).
- **Author:** consider making the flaw unmistakable without a tone tell, e.g. "the top fifty chunks for every question, since more evidence can only help." Mirror the change in the `transfer` (currently k = 25).

### H5. Embedding-model compatibility is now dated (fixed)
- **Where:**
  - ref-06 "Vectors from different embedding models are not comparable";
  - catch-04 s6 key;
  - catch-03 s2 "…must also embed the user's question", in a **zero-error** set;
  - learn-02 teach-back "Why must…".
- **Evidence:** MongoDB/Voyage's Voyage 4 announcement (2026-01-15) describes a shared embedding space across the series, so you can index with one model and query with another. Strength: consistent across three search results including the vendor's own page; the page itself was not fetchable, so the evidence is **secondary**. Anthropic's embeddings page (fetched) lists the Voyage 4 models.
- **Fixed:** see the fix log. The core lesson stands: unrelated models need re-embedding.

### H6. One catch item per concept, so spaced review can only replay the same item
- **Where:** coverage table in `README.md`.
- **Evidence:** learning-science.md §2: "Each review is a **new** scenario on the same concept". Spacing and retrieval are strong evidence. Replaying an item tests memory for that item, not the concept.
- **Risk:** over a 7-day plan, a "review" on day 4 is recognition of catch-04, and readiness overstates competence just before the interview.
- **Fix (Later, PM):** one parallel catch set per high-value concept (retrieval vs generation, faithfulness vs correctness, access control, chunking and k). Same misconception, new domain (e.g. a supplier-quality archive instead of an HR handbook). Each set is about 7 statements of author work.

### H7. Interview fit: agents are absent, and production and embeddings are thin
- **Hiring manager's words:** "AI fluency / experience with RAG, agents, embeddings, practical hands-on experience with evidence of taking into production."

| Ask | Module 1 coverage | Gap | Where it belongs |
|---|---|---|---|
| RAG | Strong: pipeline, failures, evaluation, access control, freshness, when not to use RAG | Query rewriting/HyDE, GraphRAG, agentic RAG are only pointers | M1 is enough; agentic RAG goes in M2 |
| Embeddings | Basic: similarity ≠ relevance, BM25/hybrid, same-model rule, normalization | ANN indexes (HNSW, recall vs latency knobs), dimension/quantization cost, embedding migration (dual index, backfill), bi-encoder vs cross-encoder vocabulary | Curriculum B. One paragraph plus one catch item would close the most likely interview probe |
| Agents | None (pointer in scenario arch. C) | Everything | M2. **Sequence it right after M1, before day 3**, given "this week or next" |
| Production | Evaluation gate, logging, monitoring, leakage, latency target | Cost per query and caching, rate limits and fallbacks, model/prompt versioning, guardrails, PII, rollback criteria | Curriculum F (eval/ops) and E (AWS/security) |
| "Evidence of taking into production" | `followUp` prompts ask for the learner's own stories | No exercise that rehearses the founder's own production story | Defend-my-build mode (already planned, grounded in the real repo) |

- **Fix (PM, scope):** nothing new in M1 except optionally one embeddings-ops item. Put M2 (agents) next on the schedule.

---

## Medium

- **M1. Follow-ups that don't probe failure modes or trade-offs** (spec line 52, "MUST"):
  - `learn-01.followUp` ("Which of these five ideas would an interviewer probe first") and `catch-03.followUp` ("Which statement sounded most like a mistake") are about meta-recall.
  - Suggested replacements:
    - learn-01: "Name one way a schema-valid, temperature-zero answer can still be wrong in production, and the check that catches it."
    - catch-03: "Which stage in this pipeline would you instrument first if answers started going wrong, and why?"
- **M2. Learn files are lists of facts, not one worked example.**
  - user-flow asks for one correct worked example with the key decision point made visible.
  - learn-01 spans 5 concepts in 8 lines.
  - learn-03 is closest to the target (a diagnosis walk-through).
  - **Author:** recast learn-01 around one case (the "temp 0 + JSON = deterministic and correct" colleague) and narrate the decision: "Here's where I check the stop reason…".
  - Length is fine at about 60 s spoken.
- **M3. The scenario is too long for one focus-friendly sitting.** Brief, 7 clarifications, design and 6 challenges come to about 20–30 min.
  - **Fix:** split it into "clarify + design" (≈10 min) and "challenges 1–3" and "4–6" as separate sittings. Short sessions are a design principle (learning-science.md §4, 3–8 min). The evidence for fixed breaks (Pomodoro) is **weak**, so the reason for splitting is the decision-density principle, not Pomodoro.
- **M4. The diagnostic is 10 open items (≈20 min) with no feedback on detect items.**
  - d02 reads a misconception aloud ("…the model learns our documents during setup…"). If it's never corrected, the learner may encode it. Errors help when followed by corrective feedback (Metcalfe 2017, secondary summary only).
  - **Fix:** run it as two blocks of 5, and show `answer` for detect items at the end of each block. This keeps diagnostic results unassisted.
- **M5. Scenario architecture A is inconsistent.** The summary uses `Retrieve` plus your own generation, but the strengths list "built-in … citations", which come from `RetrieveAndGenerate`. **Author:** reword to "Built-in chunking options and sync; citations built-in only with RetrieveAndGenerate".
- **M6. Interleave the "signal ≠ correctness" family.** Similarity score, faithfulness score, schema-valid, temperature 0 and "has a citation" are look-alike misconceptions, currently spread across catch-04, catch-05 and catch-06.
  - Interleaving helps most for confusable categories (Brunmair & Richter 2019, g = 0.42; **moderate**, material-dependent; evidence from other domains, extrapolated here).
  - **Later (PM):** a mixed review set drawn from these.
- **M7. The references quote the misconception lines word for word** in "Common misconceptions" (e.g. ref-05 line 48 = catch-02 s3's misconception).
  - This is acceptable: each is immediately refuted, a recognized format.
  - The spec's substring check passes because the full planted statement differs.
  - Note that **assist** during catch-02 reveals the answer; this is by design, since the attempt is then counted as assisted.
- **M8. The diagnostic routing rule skips learn-01/02 for difficulty-1 passers.** This is consistent with the evidence: errors help once prior knowledge exists (Große & Renkl 2007; Renkl 2014; evidence is from school maths, **extrapolated**). Keep it. Consider adding one guided step before hidden errors: for d1 catch sets only, say how many errors there are. This fades support.

## AWS claims (all still UNVERIFIED; none looks wrong)

- **Items 1–8, 10, 12, 14–17:** consistent with the reviewer's prior knowledge up to mid-2026. Nothing is contradicted.
- **Item 11 (Bedrock evaluation of knowledge bases / RAG, LLM-as-judge):** the reviewer recalls this feature being announced around late 2024. That is **prior knowledge, not verified**, so keep it UNVERIFIED but it is unlikely to be invented.
- **Item 9 ("Amazon Bedrock Managed Knowledge Base", Sept 2026):** after the reviewer's knowledge. Can't assess.
- **Item 13 (schema-constrained output on Bedrock), new evidence:** Anthropic's structured-outputs page (fetched today) says structured outputs on Amazon Bedrock are available on the *legacy* Bedrock integration for Opus 4.6, Sonnet 4.6, Sonnet 4.5, Opus 4.5 and Haiku 4.5, "and not on Claude in Amazon Bedrock". The author should add this to ref-03's AWS mapping as a pointer to check. It is exactly the kind of per-model caveat an interviewer could probe.

## Verified portable claims (fetched 2026-10-13 unless noted)

| Claim | Source | Result |
|---|---|---|
| ~3.5 chars/token on earlier models; Claude 4.7+ ≈ 30% more tokens | Anthropic glossary | Confirmed |
| 1M window on current models, 200k on others; output counts; input over the limit gets a 400 | Anthropic context-windows | Confirmed (also 128k max output) |
| "Context rot" | Anthropic context-windows | Confirmed |
| Temperature 0 not deterministic, including cloud providers | Anthropic glossary | Confirmed |
| Structured outputs: constrained decoding; refusal, max_tokens, unsupported features, enum casing | Anthropic structured-outputs | Confirmed, including `output_config.format` |
| Citations guarantee valid pointers | Anthropic citations | Confirmed. **New:** incompatible with structured outputs (400) |
| Hallucination techniques; "don't eliminate them entirely" | Anthropic reduce-hallucinations | Confirmed |
| Anthropic has no embedding model; Voyage `input_type`; normalized → cosine = dot product, same ranking as Euclidean | Anthropic embeddings | Confirmed |
| Under 200k tokens, skip RAG; 5.7% → 3.7% → 2.9% → 1.9%; TS-999 example; Sept 2024 | Anthropic contextual-retrieval | Confirmed |
| Lewis et al.: query encoder and generator fine-tuned, document encoder frozen, index swappable | arXiv unreachable; secondary summaries plus prior knowledge (§"index hot-swapping") | Consistent. Wording made precise |
| Lost in the Middle position effect; RAGAS three metrics | arXiv unreachable; prior knowledge | Consistent; keep the "cited from memory" labels |
| No fool-proof prevention of prompt injection | OWASP LLM01:2025, search snippet only | Secondary |

## Fix log (edits made by the reviewer)

| # | File · field | Before → after (summary) | Why |
|---|---|---|---|
| 1 | `reference/m1-ref-06` · "Rules that matter" | "Vectors from different embedding models are not comparable" → "…are, in general, not comparable…", plus the documented shared-space exception (Voyage 4) | Dated universal claim (H5) |
| 2 | `reference/m1-ref-06` · misconceptions, sources | Added the same qualifier; added the Voyage 4 source, marked as search snippet | H5 |
| 3 | `exercises/m1-catch-04` · `planted[s6].whyWrong`, `exceptions` | "defines its own" → "normally defines its own"; exceptions now cover shared-space families | H5. The planted error still stands, because the narration switches models with no such guarantee |
| 4 | `exercises/m1-catch-03` · `narration[s2]` (zero-error set) | "The same embedding model … must also embed the user's question." → "We embed the user's question with the same embedding model that indexed the documents." | The "must" was contestable in a clean control |
| 5 | `exercises/m1-learn-02` · `teachBack[2].question` | "Why must…" → "Why is … normally…" | H5 |
| 6 | `exercises/m1-catch-07` · `narration[s4]` (zero-error set) | "…the assistant treats that as data, not as a command." → "We fence retrieved text as data, and our tests include documents that say 'ignore your instructions'." | It claimed the model reliably ignores injected instructions. No known defense guarantees that (OWASP LLM01), so an expert would rightly stop on a "clean" line |
| 7 | `reference/m1-ref-07` · step 8; `reference/m1-ref-08` · "Injected instructions" | "so instructions … are not obeyed" → "less likely to be obeyed … reduces but does not remove"; added least privilege and injection tests; OWASP source | Same overclaim, in the trusted reference |
| 8 | `reference/m1-ref-02` · misconceptions | "Lower temperature reduces hallucination" (labelled false) → "Lower temperature **fixes** hallucination", with a note that it can cut sampling errors | The old line contradicted the same file ("higher temperature … can also increase errors"). "Reduces" is partly true |
| 9 | `reference/m1-ref-03` · "Why it matters for RAG", sources; `reference/m1-ref-07` · step 8 | Added: Anthropic Citations cannot be combined with structured outputs (400); JSON-field citations are model-written and must be validated | Verified missing caveat; a likely interview probe that links directly to catch-05 s3 |
| 10 | `exercises/m1-catch-08` · `planted[s5].exceptions` | Added Anthropic's top-20 finding; the error is the rationale, not the number | H4 |
| 11 | `reference/m1-ref-05` ¶ "RAG does not change weights"; `exercises/m1-catch-02` · `planted[s3].exceptions` | "fine-tuned its retriever and generator" → "query encoder and generator … document encoder kept fixed" | Precision. The old wording implied the whole retriever, index side included, was trained |
| 12 | `exercises/_matcher-test-answers.json` (new) | 6 planted items × 4 answers (clear, partial, valid alternative, incorrect), 2 false-interruption probes, draft lexicon | Requested acceptance tests for QA |

All edits keep the planted/clean partition unchanged: no statement moved between `planted` and `clean`. I did not run JSON validation; the edits touched string contents only.

## Left for the author (judgement calls)

- H2: tone tells, including the catch-02 pronoun.
- H3: catch-06 s6 subtlety.
- H4: catch-08 s5 narration.
- B4: rubric-bearing follow-ups.
- H1: trim the narrow rubric items.
- M1–M5.
- The item-13 AWS pointer.

## For the PM and architect

- B2 and B3: matcher rules not covered by C1–C15.
- B1: apply C1.
- H6 and M6 (Later): parallel sets and interleaved review.
- H7: sequence M2 next.
- C12 hidden work: the 7-day plan and at most 6 diagnostic ids. I'm available to draft these with the PM.

Entries are posted in thread 0007.
