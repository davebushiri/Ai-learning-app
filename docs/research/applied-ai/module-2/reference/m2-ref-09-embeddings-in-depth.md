---
id: m2-ref-09
title: Embeddings in depth - similarity, ANN indexes, dimensions, model choice and re-embedding
module: m2
verified: 2026-10-15
status: trusted reference (no planted errors)
---

# Embeddings in depth: similarity, ANN indexes, dimensions, model choice and re-embedding

## Objective

Go past module 1's basics: explain how embedding models are used for retrieval, the similarity metrics, approximate nearest-neighbor indexes, the cost of dimensions and how to reduce it, how to choose a model, how chunking interacts with that choice, and how to migrate safely when the model changes.

## Explanation

**What an embedding model does.** It maps text to a fixed-length vector so that texts with related meaning land close together. For retrieval, the common design is a **bi-encoder**: queries and documents are embedded independently, so document vectors can be computed once, offline, and searched quickly. (A cross-encoder, used for reranking, reads query and passage together; see m2-ref-10.)

**Query vs document inputs.** Some models take an input type. Voyage AI's docs say to always set `input_type` to `query` or `document` for retrieval; it prepends a different instruction to each, which "can lead to better retrieval quality."

**Similarity metrics.** Cosine similarity (angle), dot product, and Euclidean distance.
- For vectors normalized to length 1, cosine equals dot product, and cosine and Euclidean give identical rankings (Anthropic's embeddings page, for Voyage models).
- For unnormalized vectors they can rank differently. Use the metric the model was trained for, and configure the index with the same one.

**Scores are model-specific.** A cosine of 0.8 means different things for different models. A similarity cutoff (for example "drop results below 0.75") is tuned per model on labelled queries, and retuned whenever the model changes.

**Approximate nearest-neighbor (ANN) indexes.** Exact search compares the query with every vector; at millions of vectors that's slow.
- ANN indexes such as **HNSW** (a layered proximity graph) or **IVF** (clustered lists) find most of the true nearest neighbors much faster.
- They can miss some, which is the trade.
- Parameters (for HNSW, graph degree `M` and search breadth `ef_search`) trade recall for latency and memory.
- Measure **ANN recall** by comparing the index's top-k with exact search on a sample of queries.
- **Filters** interact with ANN: filtering after the search can return fewer than k results; engines differ in how they filter during search.

**Dimensions and storage.** Raw size is roughly vectors × dimensions × bytes per value. For example, 10 million chunks × 1,024 dimensions × 4 bytes (float32) ≈ 41 GB before index overhead. Ways to shrink it:
- **Smaller output dimension.** Matryoshka-trained models put the most information in the leading dimensions, so vectors can be requested shorter (Voyage 4 models: 256, 512, 1,024 or 2,048) or truncated and re-normalized.
- **Quantization:** int8 cuts storage about 4×, binary about 32× (Voyage docs), with some loss of accuracy; a common pattern is to search on compressed vectors and rescore the top candidates at full precision.
- Every reduction costs some retrieval quality; measure it on your own queries before adopting it.

**Choosing a model.** Weigh retrieval quality on **your** queries, domain (code, legal, finance, multilingual), maximum input length, dimensions and storage, cost per token, latency, and hosting or data-residency constraints. Public leaderboards (MTEB) are a starting shortlist, not a decision: domain and query style change the ranking.

**Chunking vs model choice.** Both move retrieval quality, and which matters more depends on the documents and queries. Chunk size and boundaries, added context (Anthropic's contextual retrieval prepends a short document-level context to each chunk; Voyage offers contextualized chunk embeddings), and metadata can matter as much as a model swap. Both changes require re-embedding. Change one variable at a time and measure each on the same labelled set.

**Re-embedding when the model changes.**
- Vectors from different models live in different spaces, so queries embedded with the new model can't be compared with documents embedded by the old one.
- The documented exception is a model family whose provider states a shared space (Voyage AI's Voyage 4 series); verify that with retrieval tests too.
- A safe migration:
  1. record the model name and version with every stored vector;
  2. build a **new index** with the new model, alongside the old one;
  3. backfill the corpus and **dual-write** new documents to both indexes during the migration;
  4. evaluate both on the labelled query set (recall@k and answer quality) and retune thresholds;
  5. switch reads, keeping each query embedded with the model that matches the index it searches;
  6. keep the old index for rollback, then delete it.
- Budget the backfill: tokens, time, and API rate limits.
- Re-embed also when chunking or text preprocessing changes, because the stored vectors no longer match what the pipeline would produce.

## Systems-engineering analogy

**Changing an embedding model is like changing a coordinate measuring machine's reference frame.** Measurements taken in the old frame can't be mixed with new ones; every part is re-measured, and acceptance limits are re-derived for the new frame.

**Where it breaks down:**
- A CMM frame change is a known transformation you can compute. Between two embedding models there is, in general, no such mapping, so you re-embed from the text.
- Measurement uncertainty is characterised by the instrument maker. Similarity scores have no calibrated meaning; you derive cutoffs from your own labelled data.
- An ANN index is like a sampling inspection plan: fast, and almost always right, and you have to measure how often it misses.

## Watch for

- Use the metric the model was trained for; for normalized vectors, cosine and dot product rank identically.
- Similarity thresholds are per model and retuned on every model change.
- ANN indexes trade a little recall for speed; measure that recall against exact search.
- Fewer dimensions or quantization save storage at some cost in quality, so measure before adopting.
- A model change means a new index, a backfill, an evaluation and a rollback plan, unless the provider documents a shared vector space.

## AWS mapping (verify)

- Amazon Titan Text Embeddings V2 on Bedrock accepts output dimensions of 256, 512 or 1,024 (default 1,024), with a `normalize` flag that defaults to true; AWS reported 512 dimensions keep about 99% and 256 about 97% of the 1,024-dimension accuracy on its benchmarks. `verified: "UNVERIFIED"` (search snippets of the AWS launch post and docs mirror)
- A Bedrock knowledge base's embedding model can't be changed after creation; switching means creating a new knowledge base and re-ingesting. `verified: "UNVERIFIED"` (search snippet of the managed knowledge-base creation page; may differ between knowledge-base types)
- Amazon OpenSearch Service k-NN supports HNSW through the Faiss and Lucene engines, with filtering behaviour that differs by engine and version, and an S3 Vectors-backed engine on recent versions. `verified: "UNVERIFIED"` (search snippets, partly from 2023 material)
- Amazon S3 Vectors is a vector storage option for Bedrock knowledge bases. `verified: "UNVERIFIED"` (also module-1 claim 4)

## Sources

- Anthropic docs, Embeddings (Voyage models, dimensions, `input_type`, normalization, quantization, Matryoshka truncation): https://platform.claude.com/docs/en/build-with-claude/embeddings (fetched 2026-10-15)
- Anthropic, Introducing Contextual Retrieval (2024): https://www.anthropic.com/news/contextual-retrieval (fetched 2026-10-13 for module 1)
- MongoDB, "The Voyage 4 series now available" (2026-01-15), shared embedding space: https://www.mongodb.com/products/updates/the-voyage-4-series-now-available (search snippet only, module 1)
- Malkov and Yashunin 2016, Efficient and robust approximate nearest neighbor search using Hierarchical Navigable Small World graphs: https://arxiv.org/abs/1603.09320 (cited from memory; not fetched)
- Kusupati et al. 2022, Matryoshka Representation Learning: https://arxiv.org/abs/2205.13147 (cited from memory; not fetched)
- Muennighoff et al. 2022, MTEB: Massive Text Embedding Benchmark: https://arxiv.org/abs/2210.07316 (cited from memory; not fetched)
- Reimers and Gurevych 2019, Sentence-BERT (bi-encoders vs cross-encoders): https://arxiv.org/abs/1908.10084 (cited from memory; not fetched)
- AWS to verify: https://docs.aws.amazon.com/bedrock/latest/userguide/titan-embedding-models.html
- AWS to verify: https://docs.aws.amazon.com/bedrock/latest/userguide/kb-managed-create.html
- AWS to verify: https://docs.aws.amazon.com/opensearch-service/latest/developerguide/knn.html
