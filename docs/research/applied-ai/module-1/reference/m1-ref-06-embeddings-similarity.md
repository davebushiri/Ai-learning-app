---
id: m1-ref-06
title: Embeddings and vector similarity (for RAG)
module: m1
verified: 2026-10-13
status: trusted reference (no planted errors)
---

# Embeddings and vector similarity (for RAG)

## Objective

Explain what an embedding is, how similarity search finds candidate passages, why semantic similarity is not relevance or truth, and when keyword search (BM25) or hybrid search does better.

## Explanation

**An embedding** is a list of numbers (a vector, often hundreds to a few thousand dimensions) produced by an *embedding model* from a piece of text. The model is trained so that texts with similar meaning get vectors that point in similar directions. Embedding models are separate from the generating LLM; Anthropic, for example, does not offer one and points to third-party providers.

**Similarity search.** At ingestion, each chunk is embedded and stored. At query time, the question is embedded with the *same* model, and the store returns the chunks whose vectors are closest. Common measures are cosine similarity, dot product and Euclidean distance. For vectors normalized to length 1, cosine and dot product are equal, and cosine and Euclidean give the same ranking. Large stores use approximate nearest-neighbor indexes, trading a little recall for speed.

**Rules that matter in practice:**
- **Same model for documents and queries.** Vectors from different embedding models are not comparable. Changing the embedding model means re-embedding the corpus.
- Some embedding models take a query/document hint (for example Voyage's `input_type`), which can improve retrieval.
- **Similarity is not relevance and not truth.** A passage can be semantically close to the question and still not answer it, be out of date, or be wrong. A similarity score is a ranking signal, not a confidence that the answer is correct, and its scale differs between models.

**Where embeddings struggle: exact tokens.** Part numbers, error codes, product SKUs, names and rare acronyms are often better found by lexical search. **BM25** is the classic lexical ranking function: it scores documents by matching query terms, weighting rare terms more, saturating repeated terms (parameter k1) and normalizing for document length (parameter b). Anthropic's contextual-retrieval post gives the example of a query for "Error code TS-999": embeddings may return general error-code content, while BM25 finds the exact string.

**Hybrid search** runs both and merges the results; a **reranker** (a model that scores query–passage pairs directly) can then reorder the top candidates. In Anthropic's 2024 experiments, adding BM25 to contextual embeddings and then reranking reduced top-20 retrieval failures substantially versus embeddings alone (their reported figures: 5.7% failure baseline to 1.9%). Those numbers are from their datasets; measure on yours.

**Metadata** (source, date, department, access group) is stored alongside each vector and used to filter results, for example "only documents this user may see" or "only the current version".

## Systems-engineering analogy

**Embedding search is like finding a part by its shape and function in a parts catalog instead of by part number.** "Bracket that holds a 12 mm sensor on a flat panel" finds good candidates even if you don't know the number. BM25 is the part-number search: exact, literal, unforgiving of synonyms.

**Where it breaks down:**
- A catalog's attributes are defined by engineers and the same for every part. Embedding dimensions are learned and not individually meaningful; you cannot inspect "dimension 412" to see why two texts matched.
- "Looks similar" in a catalog is geometric; in embeddings it is statistical and can match texts that share topic but disagree (a policy and the superseded version of it look almost identical).
- A catalog is updated in place; changing the embedding model is like changing the catalog's coordinate system, and every part must be re-catalogued.

## Common misconceptions

- "A high similarity score means the passage is correct." It means the vectors are close; check relevance, currency and authority.
- "Embeddings understand exact identifiers well." Often not; use lexical or hybrid search for IDs and codes.
- "You can mix vectors from two embedding models in one index." No: they live in different spaces.
- "The LLM produces the embeddings." Usually a separate embedding model does.
- "Vector search replaces access control." Filtering by metadata helps, but permissions must be enforced and tested, not assumed.

## AWS mapping (verify)

- Bedrock Knowledge Bases lets you choose an embedding model available on Bedrock (for example Amazon Titan Text Embeddings or Cohere Embed models). `verified: "UNVERIFIED"`
- Vector store options reported for Knowledge Bases include Amazon OpenSearch Serverless (the console's default quick-create option), OpenSearch Service managed clusters, Amazon Aurora PostgreSQL (pgvector), Amazon Neptune Analytics, Pinecone, MongoDB Atlas, Redis Enterprise Cloud, and Amazon S3 Vectors. `verified: "UNVERIFIED"` (S3 Vectors appears only indirectly in a chunking snippet; RDS PostgreSQL is reported as not supported by a forum answer only.)
- Hybrid (semantic plus keyword) search is offered for some vector stores, and reranking models can be applied to retrieved results. `verified: "UNVERIFIED"`
- Metadata filtering uses per-document metadata files (reported limit 10 KB each) to pre-filter search. `verified: "UNVERIFIED"`

## Sources

- Anthropic, Embeddings: https://platform.claude.com/docs/en/build-with-claude/embeddings (fetched 2026-10-13)
- Anthropic, Introducing Contextual Retrieval: https://www.anthropic.com/news/contextual-retrieval (fetched 2026-10-13)
- Robertson and Zaragoza, "The Probabilistic Relevance Framework: BM25 and Beyond", Foundations and Trends in Information Retrieval 3(4), 2009: https://doi.org/10.1561/1500000019 (citation and parameter roles confirmed via search snippets 2026-10-13; full text not fetched)
- Manning, Raghavan and Schütze, Introduction to Information Retrieval, Okapi BM25 section: https://nlp.stanford.edu/IR-book/html/htmledition/okapi-bm25-a-non-binary-model-1.html (not fetchable here)
- AWS to verify: https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base-supported.html
- AWS to verify: https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base-setup.html
- AWS to verify: https://docs.aws.amazon.com/bedrock/latest/userguide/kb-test-config.html
