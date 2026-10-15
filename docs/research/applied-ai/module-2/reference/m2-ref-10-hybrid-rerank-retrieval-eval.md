---
id: m2-ref-10
title: Hybrid search, reranking and retrieval evaluation (recall@k)
module: m2
verified: 2026-10-15
status: trusted reference (no planted errors)
---

# Hybrid search, reranking and retrieval evaluation (recall@k)

## Objective

Explain how hybrid search merges lexical and vector results, what a reranker can and can't do, and how to evaluate retrieval with recall@k and related metrics.

## Explanation

**Hybrid search.** Run a lexical search (BM25) and a vector search, then merge the two ranked lists. Two common ways to merge:
- **Reciprocal rank fusion (RRF):** each document scores the sum of 1/(k + rank) over the lists it appears in, with k = 60 a common default (Cormack, Clarke and Büttcher, SIGIR 2009). RRF uses ranks only, so it doesn't care that BM25 and cosine scores live on different scales.
- **Score normalization:** rescale each list's scores (for example min–max) and combine them with weights. This keeps score magnitudes but needs normalization because the raw scales differ (BM25 is unbounded; cosine is bounded).

Hybrid helps most when queries mix exact identifiers (part numbers, error codes) with natural-language descriptions (module 1, m1-ref-06).

**Reranking.** A reranker (often a **cross-encoder**) reads the query and each candidate passage together and scores relevance directly. It is more accurate than comparing two independently computed vectors, and much slower, so it runs only on the first stage's top candidates.
- **A reranker only reorders the candidates it is given.** It can't recover a relevant chunk the first stage didn't return. First-stage recall at the candidate depth is the ceiling.
- So the usual pattern is: retrieve a **wide** candidate set (say 50–150) with high recall, rerank, and keep the **few** best for the prompt.
- Rerankers add latency per query; measure it at the tail (95th percentile), not just on average.
- Anthropic's 2024 contextual-retrieval experiments found that adding BM25 and then reranking reduced top-20 retrieval failures substantially on their datasets; measure on yours.

**Retrieval evaluation.** Build a labelled set: real queries, each with the chunk IDs that answer it (relevance judgments). Then:
- **recall@k:** the fraction of a query's relevant chunks that appear in the top k, averaged over queries. When each query has one relevant chunk, this equals **hit rate@k** (the share of queries with at least one relevant chunk in the top k). Say which definition you use.
- **precision@k:** the fraction of the top k that are relevant.
- **MRR (mean reciprocal rank):** the average of 1/rank of the first relevant result; rewards putting it near the top.
- **nDCG@k:** uses graded relevance and discounts lower positions.

**How to use them well:**
- Pick k to match what you actually pass to the model (and, for rerankers, measure recall at the candidate depth too).
- Compare variants on the **same** set: BM25 alone, vectors alone, hybrid, hybrid plus reranker, each chunking choice, each model. Change one thing at a time. Report latency and cost next to quality.
- Include exact-identifier queries, paraphrases, multi-hop questions, and queries with no answer in the corpus.
- Avoid labelling only what today's system retrieves, or the set will favour today's system. Pool candidates from several retrievers before judging.
- Small sets give wide uncertainty; 20–50 queries is a start, a few hundred gives steadier comparisons. Keep growing the set from logs.

**Retrieval metrics are not answer metrics.** Recall@k says the evidence was in the top k; it doesn't say the model used it correctly. Measure answer correctness and faithfulness separately (module 1, m1-ref-08).

## Systems-engineering analogy

**First-stage retrieval and reranking are like a screening inspection followed by a detailed inspection.** The quick screen passes a wide sample; the slow, precise check ranks what passed.

**Where it breaks down:**
- In inspection, the detailed check can be pointed at any part. A reranker can only score what the screen passed, so a miss in the screen is permanent.
- Inspection limits come from specifications. Relevance labels come from people judging real queries, and they are only as good as that labelling.
- Recall@k is like a detection rate for the screen. It says nothing about whether the downstream assembly (the generated answer) is correct.

## Watch for

- RRF merges by rank; score fusion needs normalization because BM25 and cosine scales differ.
- Rerankers reorder; first-stage recall at the candidate depth caps them, so retrieve wide and rerank down.
- State the recall@k definition, pick k to match the prompt, compare variants on one labelled set, and report latency and cost too.
- High recall@k does not mean correct answers.

## AWS mapping (verify)

- Amazon OpenSearch Service supports hybrid queries with a normalization processor in a search pipeline (techniques min_max and l2; combinations arithmetic, geometric and harmonic mean), added in OpenSearch 2.11. `verified: "UNVERIFIED"` (search snippets of AWS announcements)
- Bedrock knowledge bases offer hybrid search for some vector stores and reranking models on retrieved results (module-1 claim 8). `verified: "UNVERIFIED"`
- Reranker models are available through Amazon Bedrock. `verified: "UNVERIFIED"`

## Sources

- Cormack, Clarke and Büttcher 2009, Reciprocal rank fusion outperforms Condorcet and individual rank learning methods (SIGIR): https://dl.acm.org/doi/10.1145/1571941.1572114 (search snippets only, 2026-10-15)
- Anthropic, Introducing Contextual Retrieval (2024): https://www.anthropic.com/news/contextual-retrieval (fetched 2026-10-13 for module 1)
- Anthropic docs, Embeddings (Voyage rerankers): https://platform.claude.com/docs/en/build-with-claude/embeddings (fetched 2026-10-15)
- Manning, Raghavan and Schütze, Introduction to Information Retrieval, ch. 8 "Evaluation in information retrieval": https://nlp.stanford.edu/IR-book/html/htmledition/evaluation-in-information-retrieval-1.html (cited from memory; not fetched)
- Thakur et al. 2021, BEIR: A Heterogeneous Benchmark for Zero-shot Evaluation of Information Retrieval Models: https://arxiv.org/abs/2104.08663 (cited from memory; not fetched)
- Reimers and Gurevych 2019, Sentence-BERT: https://arxiv.org/abs/1908.10084 (cited from memory; not fetched)
- AWS to verify: https://docs.aws.amazon.com/opensearch-service/latest/developerguide/search-pipelines.html
- AWS to verify: https://docs.aws.amazon.com/bedrock/latest/userguide/rerank.html
