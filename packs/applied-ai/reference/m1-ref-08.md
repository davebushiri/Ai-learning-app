---
id: m1-ref-08
title: Separating RAG failures, and evaluating before production
module: m1
verified: 2026-10-13
status: trusted reference (no planted errors)
---

# Separating RAG failures, and evaluating before production

## Objective

Diagnose a bad RAG answer by locating the failing stage (retrieval vs generation, plus freshness and access control), design abstention, and describe a pre-production evaluation and release gate.

## Explanation

### The first diagnostic question: was the right evidence retrieved?

Look at the logged retrieved chunks for the failing query (this is why you log chunk IDs).

| Retrieved chunks contain the correct, current, permitted answer? | Answer correct and supported? | Failing stage | Typical fixes |
|---|---|---|---|
| No | — | **Retrieval** (or upstream: ingestion, parsing, chunking, freshness) | Fix parsing, chunking, metadata, hybrid search, query rewriting, reranking, k; re-sync stale sources |
| Yes | No (wrong, unsupported or incomplete) | **Generation** | Tighten the prompt, put key evidence first, require quotes and citations, add a grounding check, try a different model |
| Yes | Yes, but user still unhappy | **Product / expectation** | The question may be out of scope, or the source itself is wrong |

A larger or newer model will not fix a retrieval failure: the model cannot use evidence it never received. Re-indexing will not fix a generation failure where the right chunk was already in the prompt.

### Other failure classes to name separately

- **Freshness:** the index holds an old version. The answer is faithful to the retrieved chunk and still wrong. Fix with change detection and sync, version metadata, filters for "current only", and deleting superseded chunks.
- **Access control:** a user receives content they are not entitled to, or is denied content they are. Enforce permissions at retrieval (filter before the model sees anything), using the user's identity from the authenticated session, never from the question text. A prompt instruction such as "don't reveal HR files" is not access control. Test with users from different groups.
- **Abstention:** when the retrieved evidence does not answer the question, the correct output is "I can't find that in the policies", ideally with a pointer to a human. Measure both sides: answering when it should have abstained (unsupported answer), and abstaining when the answer was available (over-refusal).
- **Injected instructions in documents:** a document may contain text like "ignore previous instructions". Retrieved text is data; fence it and instruct the model accordingly. This lowers the risk but no known method prevents prompt injection completely (OWASP LLM01), so also keep the model's permissions and tools minimal, and include injected documents in the test set.

### Evaluating before production

1. **Build a test set** of realistic questions with expected answers and the source passages that support them; include unanswerable questions, questions that need the newest version, and questions from users with different permissions.
2. **Measure retrieval and generation separately.**
   - Retrieval: did the gold passage appear in the top k (recall@k / hit rate); how much retrieved text was relevant (precision / context relevance).
   - Generation: **faithfulness** (claims supported by retrieved context), **answer relevance** (addresses the question), correctness against the expected answer, citation accuracy, abstention accuracy.
   - The RAGAS paper (Es et al., 2023) proposed reference-free, LLM-scored metrics for faithfulness, answer relevance and context relevance; the RAGAS library later added others such as context precision and context recall. LLM-as-judge scores need calibrating against human labels on a sample before you trust them.
3. **Also measure** latency, cost per query, and safety cases (leakage across permission groups must be zero on the test set, not merely low).
4. **Set thresholds before running** (pre-registered), run on every change to prompt, model, chunking or embedding model, and treat it as a release gate.
5. **After launch:** log, sample real conversations for review, collect user feedback, watch for drift as documents change, and add new failures to the test set.

## Systems-engineering analogy

**This is fault isolation plus a validation gate.** When a system output is wrong, you check the signal at each interface (sensor, network, controller, actuator) to localize the fault before swapping parts. The retrieved-chunks log is the probe point between retrieval and generation. The test set with pre-set thresholds is the validation plan and gate review.

**Where it breaks down:**
- Hardware faults are usually reproducible on a bench; LLM outputs vary run to run, so you evaluate rates over many cases, not single pass/fail tests.
- A failure can be shared between stages: retrieval returns the right chunk ranked 9th of 10 in the middle of a long prompt, and the model under-uses it. Both stages contribute.
- Automated judges are themselves models with error rates. Calibrate them like a gauge (a gauge R&R study), and still spot-check with humans.

## Common misconceptions

- "If the answer is wrong, the model is the problem." Check retrieval first; it is often the cause.
- "High faithfulness means the answer is correct." Faithful to a stale or wrong source is still wrong.
- "Access control can be handled in the prompt." Enforce it in retrieval and test it.
- "Abstaining is a failure." Correct abstention is the desired behavior for unanswerable questions.
- "A demo that worked on 10 questions is ready for production." You need a representative test set, thresholds and monitoring.

## AWS mapping (verify)

- Bedrock Knowledge Bases supports metadata filtering at retrieval, which AWS blog posts describe using for access-control-style filtering (for example by department or user group). Identity-aware enforcement remains the application's responsibility to design and test. `verified: "UNVERIFIED"`
- Bedrock Guardrails contextual grounding check can block responses whose grounding or relevance scores fall below thresholds. `verified: "UNVERIFIED"`
- Amazon Bedrock offers evaluation features that include evaluating RAG / knowledge base retrieval and generation with LLM-as-judge metrics. `verified: "UNVERIFIED"` (not confirmed by any search snippet; check carefully)
- The AWS Well-Architected Generative AI Lens covers operational, security and reliability practice for generative AI workloads, including RAG. `verified: "UNVERIFIED"`

## Sources

- Es et al., "Ragas: Automated Evaluation of Retrieval Augmented Generation" (2023): https://arxiv.org/abs/2309.15217 (metric definitions confirmed via search snippets 2026-10-13)
- RAGAS documentation, available metrics: https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/ (not reachable from this environment)
- Anthropic, Reduce hallucinations: https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations (fetched 2026-10-13)
- OWASP Top 10 for LLM Applications 2025, LLM01 Prompt Injection ("it is unclear if there are fool-proof methods of prevention"): https://genai.owasp.org/llmrisk/llm01-prompt-injection/ (search snippet only, 2026-10-13; page not fetchable here)
- Anthropic, Introducing Contextual Retrieval (recall@20 failure-rate framing): https://www.anthropic.com/news/contextual-retrieval (fetched 2026-10-13)
- AWS to verify: https://docs.aws.amazon.com/bedrock/latest/userguide/kb-how-it-works.html
- AWS to verify: https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-contextual-grounding-check.html
- AWS to verify: https://docs.aws.amazon.com/bedrock/latest/userguide/evaluation-kb.html
- AWS to verify: https://aws.amazon.com/blogs/machine-learning/amazon-bedrock-knowledge-bases-now-supports-metadata-filtering-to-improve-retrieval-accuracy
- AWS to verify: https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/generative-ai-lens.html
