---
id: m1-ref-07
title: The RAG pipeline, end to end
module: m1
verified: 2026-10-13
status: trusted reference (no planted errors)
---

# The RAG pipeline, end to end

## Objective

Name and explain each stage of a RAG system (ingestion, chunking, embedding and indexing, retrieval, grounded generation, citations), the design choice made at each stage, and how to describe it in an interview.

## Explanation

RAG has two paths: an **offline (ingestion) path** that prepares the knowledge, and an **online (query) path** that answers a question.

### Offline: ingestion path

1. **Ingest / connect sources.** Pull documents from where they live (file stores, wikis, ticket systems). Record for each document: source, owner, version or last-modified date, and who may read it. Decide how changes are detected (scheduled sync, change events) because this sets **freshness**.
2. **Parse and clean.** Extract text from PDFs, HTML, slides and tables. Parsing quality is a frequent hidden cause of bad answers: a table flattened into a word soup cannot be retrieved or read correctly.
3. **Chunk.** Split documents into passages small enough to retrieve precisely and large enough to make sense alone. Options: fixed-size with overlap, structure-aware (by heading or section), semantic, or hierarchical (retrieve small chunks, return their larger parent). This is a **trade-off**: small chunks match precisely but lose surrounding context; large chunks keep context but dilute the match and use more of the context window. A common fix for lost context is to add the document title and section heading to each chunk (Anthropic's "contextual retrieval" goes further and prepends a short generated summary of where the chunk sits).
4. **Embed and index.** Embed each chunk with an embedding model; store the vector, the chunk text and its metadata in a vector store. Optionally build a keyword (BM25) index as well for hybrid search.

### Online: query path

5. **(Optional) Query processing.** Rewrite or expand the user's question, split multi-part questions, or detect that the question needs a system-of-record lookup instead.
6. **Retrieve.** Embed the query with the same embedding model, apply **metadata filters** (permissions, version, region), and return the top-k chunks by similarity, or a merged hybrid result.
7. **(Optional) Rerank.** Reorder candidates with a reranker and keep the best few.
8. **Grounded generation.** Build a prompt with clear instructions ("answer only from the sources; if they don't contain the answer, say so"), the user's question, and the retrieved chunks fenced as data (so instructions hidden inside documents are not obeyed). Generate, ideally as structured output.
9. **Citations.** Return which chunk(s) support each claim, with a link to the source document and version, so users and reviewers can check.
10. **Post-checks and logging.** Optionally run a grounding check; log query, retrieved chunk IDs, scores, prompt version, model, latency and tokens. These logs are what make failures diagnosable later (see m1-ref-08).

### Design choices to state in an interview

Chunking strategy and size; embedding model; vector store; top-k; hybrid or not; reranker or not; how permissions are enforced; how freshness is achieved; prompt and abstention policy; citation format; what is logged; how it is evaluated before release and monitored after.

## Systems-engineering analogy

**RAG is a supplier-quality and design-release flow for knowledge.** Ingestion is incoming inspection (is this document what it claims, which revision, who owns it); chunking and indexing is putting parts into a controlled stores system with labels; retrieval is picking the right parts for a work order; generation is assembly; citations are the traveler that records which lot went into which build.

**Where it breaks down:**
- In a stores system, a picker uses an exact part number. Retrieval picks by similarity, so it can pick a near-miss part (a superseded revision) without any alarm.
- An assembly station uses exactly the parts it is given. A model can add material that was never picked (hallucination) or ignore a picked part.
- Release in manufacturing happens once per revision. RAG "assembles" a new answer on every query, so quality must be monitored continuously, not just gated once.

## Common misconceptions

- "RAG is just a vector database." The store is one stage; ingestion quality, chunking, permissions, prompting and evaluation usually matter more.
- "More retrieved chunks are always better." More chunks raise the chance of including the answer but add noise, cost and latency; tune k with evaluation.
- "Chunk once and forget." Documents change; deletions and new versions must flow through, or stale chunks keep being retrieved.
- "Citations are a UI nicety." They are the main tool for user trust, review and debugging.

## AWS mapping (verify)

- **Bedrock Knowledge Bases** implements this pipeline as a managed service: you connect a data source (for example an S3 bucket; connectors for web crawler, Confluence, SharePoint and Salesforce have also been reported), choose an embedding model and a vector store, and run a **sync (ingestion job)**, for example via the `StartIngestionJob` API; syncs are reported to be incremental. `verified: "UNVERIFIED"`
- Chunking strategies reported: default, fixed-size, hierarchical, semantic and no chunking; custom chunking through a Lambda transformation has also been described. `verified: "UNVERIFIED"`
- Query APIs: `Retrieve` returns chunks (you build the prompt), and `RetrieveAndGenerate` retrieves, generates and returns citations to the source chunks. `verified: "UNVERIFIED"`
- An AWS "What's New" item (September 2026) reports scheduled automatic sync (daily, weekly or monthly) for native data source connectors, using the name "Amazon Bedrock Managed Knowledge Base". Earlier guidance said syncs had to be triggered by you, for example on a schedule with Amazon EventBridge. Check which applies. `verified: "UNVERIFIED"`
- Optional query decomposition and reranking are reported as Knowledge Base retrieval settings. `verified: "UNVERIFIED"`

## Sources

- Lewis et al., "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks", NeurIPS 2020: https://arxiv.org/abs/2005.11401 (abstract confirmed via search snippets 2026-10-13)
- Anthropic, Glossary (RAG): https://platform.claude.com/docs/en/about-claude/glossary (fetched 2026-10-13)
- Anthropic, Introducing Contextual Retrieval: https://www.anthropic.com/news/contextual-retrieval (fetched 2026-10-13)
- Anthropic, Citations: https://platform.claude.com/docs/en/build-with-claude/citations (fetched 2026-10-13)
- AWS to verify: https://docs.aws.amazon.com/bedrock/latest/userguide/kb-how-it-works.html
- AWS to verify: https://docs.aws.amazon.com/bedrock/latest/userguide/kb-chunking.html
- AWS to verify: https://docs.aws.amazon.com/bedrock/latest/userguide/kb-how-retrieval.html
- AWS to verify: https://docs.aws.amazon.com/bedrock/latest/userguide/kb-data-source-sync-ingest.html
- AWS to verify: https://aws.amazon.com/about-aws/whats-new/2026/09/amazon-bedrock-managed-knowledge-base-automatic-sync-scheduling-data-source-connectors/
