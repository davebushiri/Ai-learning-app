# Applied AI, Module 1: LLM foundations and RAG basics

> **SPOILER WARNING: this folder contains answer keys.** Every `exercises/m1-catch-*.json` file has an `answerKey` naming the planted mistakes, and the scenario, interview and diagnostic files hold the scoring rubrics. A learner should not open these files before attempting the exercises. Serve narration only; keep `answerKey` and `rubric` on the server (CLAUDE.md invariant 2).

**Status:** draft content, 2026-10-13. Not yet reviewed by a subject-matter expert. Every AWS-specific claim is marked `UNVERIFIED` (see the verification list below).

**Learner:** preparing for a 60-minute Amazon technical interview that asks for "AI fluency / experience with RAG, agents, embeddings, practical hands-on experience with evidence of taking into production". Background in systems safety, design release, supplier quality, embedded controllers, CI/CD and release governance. Module 1 covers LLM foundations and RAG; embeddings only as far as RAG needs them. Agents and tool use are Module 2.

## Layout

```
module-1/
  README.md                  this file
  diagnostic.json            10 placement items + provisional starting-difficulty rule
  reference/                 8 trusted notes (no planted errors anywhere)
    m1-ref-01-tokens-context-windows.md
    m1-ref-02-inference-sampling.md
    m1-ref-03-structured-outputs.md
    m1-ref-04-hallucination-grounding.md
    m1-ref-05-prompting-rag-finetuning.md
    m1-ref-06-embeddings-similarity.md
    m1-ref-07-rag-pipeline.md
    m1-ref-08-rag-failure-separation.md
  exercises/
    m1-learn-01..03-*.json     correct narration + teach-back
    m1-catch-01..08-*.json     narration with planted errors (2 files have none) + answerKey
    m1-scenario-01-*.json      policy-assistant design problem
    m1-interview-01..04-*.json one interview question each
```

Planted (flawed) statements exist **only** in `exercises/m1-catch-*.json` narration, and each is corrected in the same file's `answerKey`. The `reference/` notes and `learn` narrations are intended to be fully correct.

## Concept map

```
                 tokens ──► context window ──► (limit + quality degrades with length)
                                 │                              │
         inference / sampling ───┤                              ▼
         (temperature ≠ truth)   │                   why retrieve only what's relevant
                                 ▼                              │
                     structured outputs                         │
                     (shape ≠ truth)                            │
                                 │                              │
                                 ▼                              ▼
                hallucination ──► grounding ──► RAG ◄── prompting vs RAG vs fine-tuning
                                                 │      (RAG changes the input, not the weights)
                    ┌────────────────────────────┼─────────────────────────────┐
                    ▼                            ▼                             ▼
          OFFLINE: ingest → parse →     ONLINE: query → filtered      grounded generation →
          chunk → embed → index         retrieval (vector / BM25 /     citations → abstention
          (+ metadata: groups,          hybrid) → rerank                     │
           version, date)                    ▲                               │
                    │                        │ embeddings + similarity       │
                    ▼                        │ (similarity ≠ relevance)      ▼
              FRESHNESS                ACCESS CONTROL               FAILURE SEPARATION
         (sync, delete superseded)  (filter before the model)   retrieval vs generation
                    └────────────────────────┴───────────────► EVALUATION before production
                                                               (retrieval metrics, faithfulness,
                                                                correctness, abstention, leakage,
                                                                thresholds as a release gate)
```

Suggested order: diagnostic → learn-01 → catch-01, catch-05 → learn-02 → catch-02, catch-03, catch-04 → learn-03 → catch-07, catch-06, catch-08 → scenario → interviews.

## Coverage table

Difficulty: 1 = foundational, 2 = applied, 3 = context-dependent / subtle. `P` = has planted errors, `0` = zero-error control.

| Concept | Reference | Learn | Catch | Scenario | Interview | Diagnostic |
|---|---|---|---|---|---|---|
| Tokens, context window | ref-01 | learn-01 | catch-01 (d1, P) | — | int-03 | d01, d10 |
| Inference, temperature | ref-02 | learn-01 | catch-05 (d2, P) | — | — | d03 |
| Structured outputs | ref-03 | learn-01 | catch-05 (d2, P) | (output shape) | — | d06 |
| Hallucination, grounding, citations | ref-04 | learn-02, learn-03 | catch-03 (d1, 0) | yes | int-01 | d04 |
| Prompting vs RAG vs fine-tuning | ref-05 | learn-02 | catch-02 (d1, P; contains "RAG retrains the model on your company documents") | challenge 1–2 | int-03 | d02 |
| Embeddings, similarity, BM25, hybrid | ref-06 | learn-02 | catch-04 (d2, P) | arch. B | int-01 | d05, d07 |
| RAG pipeline (ingest, chunk, index, retrieve, generate, cite) | ref-07 | learn-02 | catch-03 (d1, 0), catch-08 (d3, P, trade-offs) | yes | int-01 | d10 |
| Retrieval vs generation failure | ref-08 | learn-03 | catch-06 (d3, P) | challenge 3, 5 | int-02 | d09 |
| Freshness | ref-07, ref-08 | learn-03 | catch-06 (d3, P), catch-07 (d2, 0) | constraint + challenge 5 | int-01, int-02 | d09 |
| Access control | ref-08 | learn-03 | catch-07 (d2, 0) | constraint + challenge 4 | int-01, int-04 | d08 |
| Abstention | ref-04, ref-08 | learn-02, learn-03 | catch-03 (d1, 0), catch-07 (d2, 0) | constraint | int-04 | d04 |
| Evaluation before production (RAGAS etc.) | ref-08 | learn-03 | catch-06 (d3, P) | challenge 6 | int-04 | d10 |
| When not to use RAG / system of record | ref-05 | — | catch-08 (d3, P) | arch. C | int-03 | d10 |

Catch progression: catch-01, 02, 03 (d1, obvious) → catch-04, 05, 07 (d2) → catch-06, 08 (d3, subtle and context-dependent). Zero-error controls: catch-03 and catch-07. Trade-off items (`kind: "tradeoff"`): catch-08.

## Source `verified` values

| Value | Meaning |
|---|---|
| `fetched-2026-10-13` | Page fetched and read on that date (Anthropic docs, Anthropic contextual-retrieval post). |
| `abstract-snippet-2026-10-13` | Primary source not reachable from this environment (arXiv blocked); title, authors and abstract-level claims confirmed through search-result snippets only. |
| `cited-from-memory-not-fetched` | Well-known paper cited from prior knowledge; neither page nor snippet checked. |
| `UNVERIFIED` | AWS service-specific claim. docs.aws.amazon.com is blocked here; at most a search snippet was seen. |

## Needs verification (AWS service-specific claims)

All of these appear in `reference/` under "AWS mapping (verify)" or in the scenario's architectures. Check each against the official page before using it with the learner.

| # | Claim | Where | Check at |
|---|---|---|---|
| 1 | Bedrock Knowledge Bases is a managed RAG pipeline: data source → chunking → embedding model → vector store; sync via ingestion job (`StartIngestionJob`); syncs are incremental | ref-05, ref-07, scenario | https://docs.aws.amazon.com/bedrock/latest/userguide/kb-how-it-works.html, https://docs.aws.amazon.com/bedrock/latest/userguide/kb-data-source-sync-ingest.html |
| 2 | Data source connectors include S3, web crawler, Confluence, SharePoint, Salesforce | ref-07 | https://docs.aws.amazon.com/bedrock/latest/userguide/data-source-connectors.html |
| 3 | Chunking strategies: default, fixed-size, hierarchical, semantic, none; custom chunking via Lambda; hierarchical not recommended with S3 vector buckets | ref-07 | https://docs.aws.amazon.com/bedrock/latest/userguide/kb-chunking.html |
| 4 | Vector store options: OpenSearch Serverless (default quick-create), OpenSearch managed cluster, Aurora PostgreSQL, Neptune Analytics, Pinecone, MongoDB Atlas, Redis Enterprise Cloud, S3 Vectors; RDS PostgreSQL not supported (forum claim) | ref-06 | https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base-supported.html |
| 5 | Embedding models on Bedrock include Amazon Titan Text Embeddings and Cohere Embed | ref-06 | https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base-supported.html |
| 6 | `Retrieve` vs `RetrieveAndGenerate`; RetrieveAndGenerate returns citations to source chunks; GenerateQuery for structured data stores | ref-04, ref-05, ref-07 | https://docs.aws.amazon.com/bedrock/latest/userguide/kb-how-retrieval.html |
| 7 | Metadata filtering via per-document metadata files (≤ 10 KB each), usable for access-control-style filtering | ref-06, ref-08, scenario | https://docs.aws.amazon.com/bedrock/latest/userguide/kb-test-config.html, https://aws.amazon.com/blogs/machine-learning/amazon-bedrock-knowledge-bases-now-supports-metadata-filtering-to-improve-retrieval-accuracy |
| 8 | Hybrid (semantic + keyword) search for some stores; reranking and query decomposition options | ref-06, ref-07 | https://docs.aws.amazon.com/bedrock/latest/userguide/kb-test-config.html |
| 9 | Scheduled automatic sync (daily/weekly/monthly) for native connectors, announced September 2026 under the name "Amazon Bedrock Managed Knowledge Base"; earlier guidance said you trigger syncs yourself (e.g. EventBridge). Is "Managed Knowledge Base" a rename or a new product? | ref-07 | https://aws.amazon.com/about-aws/whats-new/2026/09/amazon-bedrock-managed-knowledge-base-automatic-sync-scheduling-data-source-connectors/ |
| 10 | Guardrails contextual grounding check: grounding and relevance scores with thresholds that can block responses | ref-04, ref-08, scenario | https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-contextual-grounding-check.html |
| 11 | Bedrock evaluation supports RAG / knowledge-base evaluation with LLM-as-judge metrics (**no snippet confirmed this**) | ref-08 | https://docs.aws.amazon.com/bedrock/latest/userguide/evaluation-kb.html |
| 12 | Inference parameters via InvokeModel / Converse; Claude on Bedrock temperature 0–1, default 1; some newer Claude models accept temperature or top-p but not both | ref-02 | https://docs.aws.amazon.com/bedrock/latest/userguide/inference-parameters.html, https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-anthropic-claude-messages-request-response.html |
| 13 | Converse API tool use as a way to get schema-shaped output; whether schema-constrained output exists per model on Bedrock | ref-03 | https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference.html, https://docs.aws.amazon.com/bedrock/latest/userguide/tool-use.html |
| 14 | Model customization (fine-tuning, continued pre-training) is a separate Bedrock feature producing a custom model | ref-05 | https://docs.aws.amazon.com/bedrock/latest/userguide/custom-models.html |
| 15 | Per-model context windows and output limits are published per model on Bedrock | ref-01 | https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters.html |
| 16 | Well-Architected Generative AI Lens covers RAG workloads | ref-08, scenario | https://docs.aws.amazon.com/wellarchitected/latest/generative-ai-lens/generative-ai-lens.html |
| 17 | Bedrock Agents can use knowledge bases (pointer only; Module 2) | scenario arch. C | https://docs.aws.amazon.com/bedrock/latest/userguide/agents.html |

Some exact AWS URLs above (for example `evaluation-kb.html`, `data-source-connectors.html`, `kb-data-source-sync-ingest.html`) are best guesses at page names; if one 404s, search the Bedrock User Guide for the topic.

### Non-AWS items also worth checking

- Lewis et al. 2020: that the retriever (query encoder) and generator were fine-tuned end to end while the document index could be swapped without retraining. Stated in ref-05 and catch-02's `exceptions`. Confirmed at abstract level only. https://arxiv.org/abs/2005.11401
- Liu et al. 2023 "Lost in the Middle": cited from memory for the position effect (ref-01, ref-08). https://arxiv.org/abs/2307.03172
- RAGAS: original paper defines faithfulness, answer relevance, context relevance; library later added context precision and recall (snippet). https://arxiv.org/abs/2309.15217, https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/
- BM25 monograph DOI `10.1561/1500000019` not resolved here.
- Anthropic contextual-retrieval figures (5.7% → 1.9% top-20 failure) and the "under 200,000 tokens, consider skipping RAG" heuristic are from a 2024 post on Anthropic's datasets; models and windows have changed since.
