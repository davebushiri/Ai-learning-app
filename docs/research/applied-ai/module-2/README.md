# Applied AI, Module 2: Agents, plus embeddings in depth

> **SPOILER WARNING: this folder contains answer keys.** Every `exercises/m2-catch-*.json` file has an `answerKey` naming the planted mistakes, and the learn, scenario, interview and diagnostic files hold the scoring rubrics. A learner should not open these files before attempting the exercises. Serve narration only; keep `answerKey` and `rubric` on the server (CLAUDE.md invariant 2).

**Status:** draft content, 2026-10-15. Written by the learning-designer at the lead's request, following the founder's 2026-10-15 decision in thread 0007 ("Write Module 2"). Not yet reviewed by a subject-matter expert. `docs/research/**` is founder-owned; the founder accepts or reverts this folder. Every AWS-specific claim is marked `UNVERIFIED` (see the verification list below).

**Learner:** the same as module 1: preparing for a 60-minute Amazon technical interview that asks for "AI fluency / experience with RAG, agents, embeddings, practical hands on experience with evidence of taking into production". Module 1 covered LLM foundations and RAG. Module 2 covers agents (tool use, the loop, workflows vs agents, memory, multi-agent, guardrails, evaluation, production failures) and embeddings in depth. It ends with a "defend my build" bridge to the founder's own app, which has **no agents and no tool calling**.

## Layout

```
module-2/
  README.md                  this file
  diagnostic.json            10 placement items + provisional starting-difficulty rule
  reference/                 11 trusted notes (no planted errors anywhere)
    m2-ref-01-tool-use.md
    m2-ref-02-agent-loop.md
    m2-ref-03-workflows-vs-agents.md
    m2-ref-04-memory-state.md
    m2-ref-05-multi-agent.md
    m2-ref-06-guardrails.md
    m2-ref-07-agent-evaluation.md
    m2-ref-08-agent-production-failures.md
    m2-ref-09-embeddings-in-depth.md
    m2-ref-10-hybrid-rerank-retrieval-eval.md
    m2-ref-11-defend-my-build-agents.md
  exercises/
    m2-learn-01..03-*.json     one correct worked example each + teach-back
    m2-catch-01..09-*.json     narration with planted errors (2 files have none) + answerKey
    m2-scenario-01-*.json      delivery-support agent design problem (customer scenario)
    m2-interview-01..04-*.json one interview question each; 04 is the defend-my-build bridge
```

Planted (flawed) statements exist **only** in `exercises/m2-catch-*.json` narration, and each is corrected in the same file's `answerKey`. The `reference/` notes and `learn` narrations are intended to be fully correct. Unlike module 1, the references have no "Common misconceptions" list that quotes the wrong claim: each note ends with a **"Watch for"** list stated only as the correct rule, so no flawed sentence appears in trusted text at all.

## Concept map

```
          tool use (model requests, code executes; schema = shape, not truth)
                                   │
                                   ▼
        AGENT LOOP: plan → act → observe ... stop reason / step cap / budget / deadline
                │                  │                         │
                ▼                  ▼                         ▼
     workflows vs agents     memory and state          multi-agent
     (who picks the next     (stateless calls,         (parallel breadth vs
      step? simplest first)   compaction, notes,        ~15x tokens; bad for
                │             system of record)         shared, dependent work)
                └──────────────────┬─────────────────────────┘
                                   ▼
        GUARDRAILS: least privilege · approval for irreversible actions ·
                    injection through tool results (lethal trifecta)
                                   │
                                   ▼
        PRODUCTION: loops · runaway cost · flaky tools · partial failure · idempotency
                                   │
                                   ▼
        EVALUATION: end state · trajectory · pass^k · cost and latency per task · monitoring
                                   │
                                   ▼
        DEFEND MY BUILD: why the app uses single calls; which habits transfer; don't overclaim

   EMBEDDINGS IN DEPTH (builds on m1-ref-06):
     metrics + normalization → ANN (recall vs speed) → dimensions / quantization
       → model choice vs chunking → re-embedding migration (new index, retune cutoffs, rollback)
       → hybrid (RRF) + reranking (reorders only) → recall@k / MRR (≠ answer correctness)
```

Suggested order: diagnostic → learn-01 → catch-01, catch-02 → learn-02 → catch-03, catch-04, catch-05 → learn-03 → catch-06 → catch-07, catch-08, catch-09 → scenario (two sittings) → interviews (04 last, after 02).

## Coverage table

Difficulty: 1 = foundational, 2 = applied, 3 = context-dependent / subtle. `P` = has planted errors, `0` = zero-error control.

| Concept | Reference | Learn | Catch | Scenario | Interview | Diagnostic |
|---|---|---|---|---|---|---|
| Tool use, who executes, schema guarantees, descriptions | ref-01 | learn-01 | catch-01 (d1, P) | tools design | int-02 | d01 |
| Agent loop, stop reasons, step caps, budgets | ref-02 | learn-01 | catch-02 (d1, 0) | challenge 6 | int-01 | d02, d04 |
| Workflows vs agents, when not to use an agent | ref-03 | — | catch-03 (d2, P) | arch. A vs B, challenge 1 | int-02, int-04 | d03 |
| Memory and state | ref-04 | — | catch-04 (d2, P) | (state per conversation) | — | d05 |
| Multi-agent trade-offs | ref-05 | — | catch-08 (d3, P, trade-off) | — | int-02 (signal) | — |
| Guardrails: least privilege, approval, injection | ref-06 | learn-02 | catch-05 (d2, P) | constraints, challenge 4 | int-02 follow-up | d06 |
| Agent evaluation: success, trajectory, pass^k, cost | ref-07 | — | catch-08 (d3, P) | challenge 5 | int-01 | d09 |
| Production failures: loops, cost, flaky tools, partial failure, idempotency | ref-08 | learn-01, learn-02 | catch-07 (d3, P) | challenges 2, 3, 6 | int-01, int-04 | d07 |
| Embeddings: metrics, ANN, dimensions, quantization | ref-09 | learn-03 | catch-06 (d2, 0) | — | int-03 | d08 |
| Model choice vs chunking; re-embedding migration | ref-09 | learn-03 | catch-06 (d2, 0), catch-09 (d3, P, trade-off) | — | int-03 | d08 |
| Hybrid search, reranking, recall@k | ref-10 | learn-03 | catch-09 (d3, P) | — | int-03 | d10 |
| Defend my build (agents) | ref-11 | — | — | — | int-04 | — |

Catch progression: catch-01, 02 (d1) → catch-03, 04, 05, 06 (d2) → catch-07, 08, 09 (d3, subtle and context-dependent). Zero-error controls: **catch-02** and **catch-06**. Trade-off items (`kind: "tradeoff"`): catch-03 (both), catch-04 s3, catch-08 s7, catch-09 s7.

## How module-1 lessons were applied (thread 0007, REVIEW.md, FR-017–FR-022)

- **Rubric follow-ups everywhere.** Every `followUp` is `{question, rubric}`, and every interview `followUps` entry is too (the PM's "standard from module 2 on"), so `failureModesTradeoffs` and `defense` can be scored.
- **Several practitioner phrasings per item.** Rubric items carry 3–8 `|` alternatives, mostly 2–3 content words each, so short spoken answers can match. No item exceeds the 8-alternative cap.
- **The echo rule, checked by hand on every planted stop.** For each flawed line I listed its content tokens and checked that no `explain` or `correct` alternative, and no `acceptableCorrections` entry (graded as one item), can be completed from those tokens alone, including through the current pack lexicon (for example, `cost` is satisfied by "tokens", and `retrieve` by "search" and "find"). Alternatives that failed were removed or reworded. This is a hand trace, not a run (no shell in this session).
- **Polarity.** Where the natural correct answer to a planted stop is a negation, the item has negator-bearing alternatives (in the `cant …`, `doesnt …`, `not …` forms the matcher tokenizes), so FR-021(b) doesn't flag it. Checked on catch-04 s7, catch-05 s5, catch-07 s6 and catch-09 s4 in particular.
- **Few red flags, made of rare words.** A red flag makes every dimension `uncertain`, and good answers often mention an anti-pattern while rejecting it in words the matcher can't see as negation. Semantic anti-patterns in the scenario are therefore covered through `mustCover` rather than as red flags. `int-03` has none.
- **Tone tells reduced.** Clean lines carry true absolutes ("every run", "never shown as a success", "always gets retuned"), and some planted lines are hedged ("should also raise accuracy", "should speed them up").
- **Worked examples.** Each learn file follows one case and says "Here's the decision point" at the key step. Each is about 8 lines (about 60–75 s spoken).
- **Focus-friendly sittings.** Catch sets are 7–9 lines (3–6 min). Run the scenario in two sittings: (1) clarify and design, about 12 min; (2) challenges 1–3, then 4–6, about 8 min each. The diagnostic runs as two blocks of five.
- **No labelled answer set** was written, by instruction.

## Format notes for the pack mapping (same as module 1's T11 mapping)

- `sources[].verified` strings become a boolean plus `note`. Here `true` = `fetched-2026-10-15` or `fetched-2026-10-13`; everything else is `false`.
- Scenario `challenges[].challenge` / `expected` become `question` / `rubric`; each architecture `id` comes from its `name`.
- `int-03` has an empty `redFlags` array, which the validator allows.
- `int-04` cites the dossier through its GitHub URL (`verified: "repo-internal-2026-10-15"`) because sources must be `https://`.
- The pack lexicon is unchanged by this module. No new keys are proposed; coverage comes from item alternatives.

## Source `verified` values

| Value | Meaning |
|---|---|
| `fetched-2026-10-15` | Page fetched and read on that date (Anthropic docs and engineering posts). |
| `fetched-2026-10-13` | Fetched for module 1 and not re-fetched. |
| `search-snippet-2026-10-15` / `search-snippet-2026-10-13` | The primary page was unreachable here (OWASP, simonwillison.net, arXiv, ACM, aws.amazon.com); claims were confirmed from search-result snippets only. |
| `cited-from-memory-not-fetched` | Well-known paper or doc cited from prior knowledge; neither page nor snippet checked. |
| `repo-internal-2026-10-15` | A file in this repo, read on that date. |
| `UNVERIFIED` | AWS service-specific claim. docs.aws.amazon.com is blocked here; at most a search snippet was seen. |

## Needs verification (AWS service-specific claims)

All of these appear in `reference/` under "AWS mapping (verify)" or in the scenario's architecture C. Check each against the official page before using it with the learner.

| # | Claim | Where | Check at |
|---|---|---|---|
| 1 | The Bedrock Converse API supports tool use via a tool configuration; the application runs the tool | ref-01 | https://docs.aws.amazon.com/bedrock/latest/userguide/tool-use.html |
| 2 | Bedrock Agents define tools as action groups (OpenAPI schema or function details), fulfilled by Lambda or by return of control | ref-01, ref-06, scenario | https://docs.aws.amazon.com/bedrock/latest/userguide/agents-action-add.html, https://docs.aws.amazon.com/bedrock/latest/userguide/agents-returncontrol.html |
| 3 | Bedrock Agents can require user confirmation before an action-group function runs, positioned as a prompt-injection safeguard | ref-06, scenario | https://docs.aws.amazon.com/bedrock/latest/userguide/agents-userconfirmation.html |
| 4 | Bedrock Agents orchestrate a ReAct-style loop by default and return a trace per invocation | ref-02, ref-07 | https://docs.aws.amazon.com/bedrock/latest/userguide/agents-how.html, https://docs.aws.amazon.com/bedrock/latest/userguide/trace-events.html |
| 5 | Amazon Bedrock AgentCore went GA in October 2025 with Runtime (session isolation, sessions up to 8 hours, A2A support), Memory (short- and long-term; self-managed strategy), Gateway (APIs and Lambda as tools; connects to MCP servers), Identity, Observability (CloudWatch, OpenTelemetry) | ref-01, ref-02, ref-04, ref-05, ref-06, ref-07, scenario | https://aws.amazon.com/about-aws/whats-new/2025/10/amazon-bedrock-agentcore-available, https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/what-is-bedrock-agentcore.html |
| 6 | Bedrock Agents session attributes and an optional cross-session memory with a retention period | ref-04 | https://docs.aws.amazon.com/bedrock/latest/userguide/agents-memory.html |
| 7 | Bedrock Agents multi-agent collaboration (supervisor and collaborator agents) | ref-05 | https://docs.aws.amazon.com/bedrock/latest/userguide/agents-multi-agent-collaboration.html |
| 8 | Bedrock Guardrails content filters include a prompt-attack category | ref-06 | https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails.html |
| 9 | Action-group Lambdas run under their own IAM execution role (where least privilege is applied) | ref-06, scenario | https://docs.aws.amazon.com/bedrock/latest/userguide/agents-permissions.html |
| 10 | Step Functions can call Bedrock as a workflow step, and states support Retry (backoff) and Catch | ref-02, ref-03, ref-08 | https://docs.aws.amazon.com/step-functions/latest/dg/connect-bedrock.html, https://docs.aws.amazon.com/step-functions/latest/dg/concepts-error-handling.html |
| 11 | "Amazon Bedrock Flows" (formerly Prompt Flows) for fixed generative workflows: name and status | ref-03 | https://docs.aws.amazon.com/bedrock/latest/userguide/flows.html |
| 12 | AWS SDKs retry throttled and transient errors by default; Builders' Library articles on idempotency tokens (EC2 `ClientToken`) and jittered backoff | ref-08 | https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/, https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/ |
| 13 | Titan Text Embeddings V2: dimensions 256/512/1,024 (default 1,024), `normalize` defaults to true; 512 ≈ 99% and 256 ≈ 97% of 1,024-dim accuracy (AWS's figures) | ref-09, int-03 | https://docs.aws.amazon.com/bedrock/latest/userguide/titan-embedding-models.html |
| 14 | A Bedrock knowledge base's embedding model can't be changed after creation; switching means a new knowledge base and re-ingestion. The snippet came from a "managed knowledge base" page and may differ by knowledge-base type (links to module-1 claim 9) | ref-09, learn-03, int-03 | https://docs.aws.amazon.com/bedrock/latest/userguide/kb-managed-create.html |
| 15 | OpenSearch k-NN: HNSW via Faiss and Lucene engines, engine-specific filtering, an S3 Vectors-backed engine on OpenSearch 2.19+ | ref-09 | https://docs.aws.amazon.com/opensearch-service/latest/developerguide/knn.html |
| 16 | OpenSearch hybrid query with a normalization processor (min_max, l2; arithmetic/geometric/harmonic mean), since 2.11 | ref-10, catch-09 | https://docs.aws.amazon.com/opensearch-service/latest/developerguide/search-pipelines.html |
| 17 | Reranker models available through Amazon Bedrock | ref-10 | https://docs.aws.amazon.com/bedrock/latest/userguide/rerank.html |
| 18 | Bedrock model evaluation supports LLM-as-judge jobs (overlaps module-1 claim 11) | ref-07 | https://docs.aws.amazon.com/bedrock/latest/userguide/evaluation-judge.html |

Several exact AWS URLs above are best guesses at page names; if one 404s, search the relevant user guide for the topic.

### Non-AWS items also worth checking

- **OWASP LLM06:2025 Excessive Agency** (three root causes; human approval; authorization outside the model): search snippets only; genai.owasp.org and owasp.org were unreachable.
- **Simon Willison, "the lethal trifecta"** (2025-06-16): search snippets only.
- **τ-bench figures** (under 50% task success; pass^8 under 25% in retail): search snippets of the arXiv abstract only. https://arxiv.org/abs/2406.12045
- **RRF and k = 60** (Cormack, Clarke and Büttcher, SIGIR 2009): secondary sources only; the claim that k = 60 was tuned on TREC appears in one blog and is not used here.
- **ReAct, HNSW, Matryoshka, MTEB, BEIR, Sentence-BERT, the IR-book evaluation chapter, Stripe idempotency docs**: cited from memory.
- **Anthropic multi-agent figures** (90.2%, about 4× and 15× tokens) are from one internal evaluation in 2025 with Claude Opus 4 and Sonnet 4; models have changed since. Fetched today.
- **Defend-my-build facts** (ref-11, int-04) come from the dossier, whose counts change often. Re-read `docs/research/applied-ai/defend-my-build.md` before the interview.

## Matcher limits noticed while authoring (advisory, for the architect; Later)

- `havent`, `hasnt`, `wasnt`, `werent` and `aint` are not in `MATCHER_RULES.negators`. "I haven't shipped an agent" is the most natural honest answer to int-04, and its negation is invisible to FR-021(b) and FR-022. int-04 avoids red flags that this phrasing could trigger, and lists "havent shipped" as an alternative.
- A 3-letter item token matches only the whole word plus `s/es/ed/ing`, so the item token `run` misses "running". Items use 4+ letter forms (`runs`, `execute`) where possible.
- A red flag fires on any un-negated mention, including "a demo isn't enough" (the negator comes after). Hence the short red-flag lists.

## Proposed schedule swap (advisory; the PM decides, backend edits `schedule.json`)

Per the 2026-10-14 plan in thread 0007 ("Module 2 swap"): replace the day-4 and day-5 module-1 `catch` and `interview` ids with module-2 ids, and add a `learn` block of about 20 minutes each day, taken from that day's `review`. A suggested split that keeps look-alikes together (interleaving similar mistake types; Brunmair & Richter 2019, moderate, extrapolated):
- **Day 4, agents:** learn-01, learn-02 · catch-01, catch-02, catch-03, catch-05 · interview-02 · defend pass (ref-11, interview-04 aloud).
- **Day 5, production and embeddings:** learn-03 · catch-07, catch-06, catch-09, catch-04 · interview-03.
- **Held fresh for mock 2 (day 6):** interview-01 (agent evaluation), and the scenario's challenges 2–5 as the "agents, 10 min" slot.
- catch-08 goes into day-7 review.
