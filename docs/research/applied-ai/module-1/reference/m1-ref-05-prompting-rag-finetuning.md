---
id: m1-ref-05
title: Prompting vs RAG vs fine-tuning
module: m1
verified: 2026-10-13
status: trusted reference (no planted errors)
---

# Prompting vs RAG vs fine-tuning

## Objective

Choose between prompting, RAG and fine-tuning by what each actually changes, and explain why RAG does not retrain the model.

## Explanation

Three levers, three different things they change:

| Lever | What changes | Good for | Weak for |
|---|---|---|---|
| **Prompting** (instructions, examples, documents pasted in) | The input of one call | Task framing, format, tone, small fixed reference material | Large or changing corpora; per-user permissions at scale |
| **RAG** (retrieve relevant passages at query time, add them to the prompt) | The input of each call, chosen per query | Knowledge that is large, changes often, is private, needs citations or must respect who can see what | Teaching a new skill, style or output format; questions needing reasoning over the whole corpus at once |
| **Fine-tuning** (further training on examples) | The model's weights | Consistent style, format or behavior on a narrow task; sometimes smaller, cheaper models for a fixed task | Facts that change often (retraining needed each time); per-document citations; per-user access control |

**RAG does not change weights.** Anthropic's glossary describes RAG as passing retrieved documents into the context window at runtime; fine-tuning is "further training a pretrained language model using additional data". The original RAG paper (Lewis et al., 2020) did fine-tune its retriever and generator on task examples, but the knowledge itself lived in a separate document index that could be replaced without retraining. In a typical production RAG system built on a hosted model, no training happens at all: you update the index, not the model.

**Consequences of that difference:**
- **Freshness:** with RAG, updating knowledge means re-ingesting changed documents. With fine-tuning, it means another training run, evaluation and release.
- **Access control:** RAG can filter which passages a user may retrieve. Knowledge baked into weights cannot be withheld per user.
- **Auditability:** RAG can cite the passage used. A fine-tuned model cannot point to where a fact came from.
- **Deletion:** removing a document from an index is straightforward; removing a fact from weights is not.

**They combine.** A common order of attack: get the prompt right first (cheapest, fastest to iterate); add RAG when the model needs knowledge it lacks; consider fine-tuning when the remaining gap is behavior or format that prompting cannot fix, or cost/latency at scale. Each step should be justified by evaluation results.

**When not to use RAG:** the knowledge is small and stable enough to place in the prompt; the task needs no external knowledge (rewriting, formatting, classification by a rule); the answer must come from a system of record via an exact query (an order status from a database is better fetched with an API or SQL call than by semantic search over text); or the "knowledge" is really a skill or style.

## Systems-engineering analogy

**Prompting is a runtime command; RAG is a calibration table loaded at runtime from a controlled data store; fine-tuning is reflashing firmware.** You change calibration data without a software release; you reflash only when behavior must change, and that needs a full validation cycle.

**Where it breaks down:**
- A controller reads a calibration value exactly. A model reads retrieved text and may ignore, misread or go beyond it. RAG supplies evidence; it does not force use of it.
- Fine-tuning does not install facts as cleanly as flashing a table installs values; facts learned through training can be recalled imperfectly and cannot be cited.
- The "table lookup" in RAG is a similarity search that can return the wrong row. There is no exact address.

## Common misconceptions

- "RAG retrains the model on your company documents." No: RAG retrieves text at query time and places it in the prompt; the model's weights are unchanged.
- "Fine-tuning is the way to add up-to-date company knowledge." Usually the wrong tool: knowledge changes, and fine-tuned facts cannot be cited or permission-filtered.
- "A huge context window makes RAG obsolete." It shifts the threshold, but cost, latency, quality degradation with length, access control and freshness still favor retrieval for large corpora.
- "RAG is always the answer for an enterprise assistant." Not for exact system-of-record lookups, skills or small static content.

## AWS mapping (verify)

- Bedrock Knowledge Bases is AWS's managed RAG feature: it ingests documents, embeds them and stores vectors, then retrieves at query time. `verified: "UNVERIFIED"`
- Bedrock model customization (fine-tuning and continued pre-training) for supported models is a separate feature that produces a custom model. `verified: "UNVERIFIED"`
- Knowledge Bases can also connect to structured data stores and generate queries (GenerateQuery) instead of vector search. `verified: "UNVERIFIED"` (snippet only)

## Sources

- Anthropic, Glossary (RAG, fine-tuning): https://platform.claude.com/docs/en/about-claude/glossary (fetched 2026-10-13)
- Lewis et al., "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks", NeurIPS 2020: https://arxiv.org/abs/2005.11401 (abstract confirmed via search snippets 2026-10-13; full text not fetchable here)
- Anthropic, Introducing Contextual Retrieval: https://www.anthropic.com/news/contextual-retrieval (fetched 2026-10-13)
- AWS to verify: https://docs.aws.amazon.com/bedrock/latest/userguide/kb-how-it-works.html
- AWS to verify: https://docs.aws.amazon.com/bedrock/latest/userguide/custom-models.html
