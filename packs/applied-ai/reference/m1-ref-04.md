---
id: m1-ref-04
title: Hallucination and grounding
module: m1
verified: 2026-10-13
status: trusted reference (no planted errors)
---

# Hallucination and grounding

## Objective

Define hallucination, explain why language models produce it, describe grounding techniques and their limits, and explain why citations make answers auditable but not automatically correct.

## Explanation

**Hallucination** is output that is fluent and confident but factually wrong, or not supported by (or inconsistent with) the context the model was given. Anthropic's docs describe it as text that is "factually incorrect or inconsistent with the given context".

**Why it happens.** A language model is trained to produce likely continuations of text. It has no built-in check that a statement is true, and its stored knowledge is incomplete, can be out of date, and contains nothing about your private documents. When asked about something it does not know, a likely-sounding answer is often still the most probable output.

**Two different questions to keep apart:**
- **Faithfulness / groundedness:** is every claim in the answer supported by the provided sources?
- **Correctness:** is the answer actually true? A faithful answer can be wrong if the source is wrong or out of date. An unfaithful answer can happen to be right.

**Grounding** means making the answer depend on supplied evidence rather than on the model's memory. Techniques documented by Anthropic:
- Give explicit permission to say "I don't know" (abstention).
- For long documents, extract word-for-word quotes first, then answer from the quotes.
- Require a citation for each claim, then verify each claim against a supporting quote and retract any claim without one.
- Restrict the model to the provided documents.
- Compare several runs; inconsistency can signal hallucination.

Anthropic notes these techniques reduce hallucinations but do not eliminate them; critical information still needs validation.

**RAG is the main architectural grounding technique**: retrieve relevant source text at query time and put it in the context (see m1-ref-07). It helps only if retrieval finds the right, current, permitted passages.

**Citations make answers auditable, not automatically correct.** A citation lets a person or a check trace a claim to a source. Anthropic's citations feature guarantees that citations contain valid pointers to the provided documents, which proves the quoted text exists. Whether that passage actually supports the claim, and whether the source is current and authoritative, still needs checking.

## Systems-engineering analogy

**Grounding is like traceability in design release: every requirement in a released spec must trace to an approved source (a standard, a customer requirement, a test result).** A claim without a trace is not released.

**Where it breaks down:**
- In a release process, a human checks each trace link at a gate. In a RAG system the model creates the links on every call, at runtime, and a link can point to a passage that does not really support the claim. You need automated checks and sampling, not just a one-time gate.
- A traced requirement can still be wrong if its source is wrong. Same here: faithful to a stale policy is still wrong.
- An engineer who doesn't know says so; a model's default under uncertainty is often a plausible guess unless the system allows and rewards abstention.

## Common misconceptions

- "Hallucination means the model is broken or lying." It is a normal failure mode of next-token prediction, not intent.
- "RAG eliminates hallucination." It reduces it when retrieval is good; models can still ignore, misread or go beyond the retrieved text.
- "An answer with a citation is correct." A citation shows where a claim came from; you still check support, currency and authority.
- "Lower temperature fixes hallucination." See m1-ref-02: it reduces variation, not missing knowledge.

## AWS mapping (verify)

- Amazon Bedrock Guardrails includes a contextual grounding check that scores a response's grounding in the source and its relevance to the query, and can block responses below configured thresholds (announced July 2024). `verified: "UNVERIFIED"`
- Bedrock Knowledge Bases' RetrieveAndGenerate API returns citations that point to the retrieved source chunks. `verified: "UNVERIFIED"`

## Sources

- Anthropic, Reduce hallucinations: https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations (fetched 2026-10-13)
- Anthropic, Citations: https://platform.claude.com/docs/en/build-with-claude/citations (fetched 2026-10-13)
- Es et al., "Ragas: Automated Evaluation of Retrieval Augmented Generation" (2023), definition of faithfulness: https://arxiv.org/abs/2309.15217 (abstract and metric definitions confirmed via search snippets 2026-10-13; full text not fetchable here)
- AWS to verify: https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-contextual-grounding-check.html
- AWS to verify: https://docs.aws.amazon.com/bedrock/latest/userguide/kb-how-it-works.html
