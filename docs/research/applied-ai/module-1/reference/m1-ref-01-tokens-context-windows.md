---
id: m1-ref-01
title: Tokens and context windows
module: m1
verified: 2026-10-13
status: trusted reference (no planted errors)
---

# Tokens and context windows

## Objective

Explain what a token is, what a context window holds, why "it fits in the window" is not the same as "the model will use it well", and how this limit drives the design of RAG systems.

## Explanation

**Tokens.** A language model does not read characters or words. It reads *tokens*: units that can be words, pieces of words, characters or bytes. How many characters a token covers depends on the tokenizer and the language. Anthropic's glossary gives roughly 3.5 English characters per token for earlier Claude models and says newer models (Claude 4.7 and later) produce about 30 percent more tokens for the same text. The practical rule: never estimate cost or fit from word counts; use the provider's token-counting tool with the model you will actually call.

**The context window** is everything the model can reference while producing one response: the system prompt, the conversation history, any documents or tool results you pass in, tool definitions, *and the response being generated*. It is the model's working memory for that call. It is not the training data. Nothing in the context window changes the model's weights; when the call ends, the model keeps nothing (an application may store the conversation and send it again next time).

**Sizes and limits.** Window sizes are model-specific and change between model generations. As of the verified date, Anthropic's docs list a 1M-token window for its current models and 200k for some older ones, with a separate cap on output tokens per request (`max_tokens`). If the input alone exceeds the window, the API rejects the request.

**Bigger is not automatically better.** Anthropic's context-window guide says that as token count grows, accuracy and recall degrade ("context rot"), so curating what goes in matters as much as how much fits. Research on long contexts (Liu et al., "Lost in the Middle") found that models used information at the start or end of a long input more reliably than information in the middle. This is one reason RAG retrieves a small, relevant set of passages instead of sending everything.

**Why it matters for RAG.** Retrieved passages consume window space and money on every call. Retrieval exists partly because a corpus is larger than any window, and partly because sending only relevant text tends to give better, cheaper, faster answers. Anthropic's 2024 contextual-retrieval post suggested that a knowledge base under about 200,000 tokens can simply be placed in the prompt (with prompt caching) instead of building retrieval. Treat that as a starting heuristic to test, not a rule; access control and freshness can still argue for retrieval.

## Systems-engineering analogy

**The context window is like the RAM and input buffer of an embedded controller; the model's weights are like flashed firmware.** Each call loads a fixed-size buffer (calibration tables, sensor frames, the current request). The controller computes on that buffer and then the buffer is cleared. Reflashing firmware (training) is a separate, slow, governed process.

**Where it breaks down:**
- An overflowing controller buffer usually truncates or faults deterministically. A model's "attention" degrades gradually and unevenly long before the hard limit; content in the middle can be under-used even when it fits.
- The output shares the same budget as the input. A controller's output registers do not usually eat its input buffer.
- Tokens are not fixed-width like bytes; the same sentence can cost a different number of tokens on a different model.

## Common misconceptions

- "The context window is what the model was trained on." No: it is per-call working memory.
- "One token is one word." No: it varies by tokenizer and language.
- "If it fits, the model will use all of it equally." No: quality degrades with length and position.
- "Putting documents in the prompt teaches the model." No: weights are unchanged; the effect lasts only for that call.
- "Only the input counts toward the window." No: the generated output (including any reasoning tokens) counts too.

## AWS mapping (verify)

- Amazon Bedrock hosts models from several providers; each model has its own context window and output limit, published on the model's card or parameter page. `verified: "UNVERIFIED"`
- Bedrock Knowledge Bases sends only the top retrieved chunks to the generating model, so chunk size and the number of results set how much of the window RAG consumes. `verified: "UNVERIFIED"`

## Sources

- Anthropic, Glossary (tokens, context window): https://platform.claude.com/docs/en/about-claude/glossary (fetched 2026-10-13)
- Anthropic, Context windows: https://platform.claude.com/docs/en/build-with-claude/context-windows (fetched 2026-10-13)
- Anthropic, Introducing Contextual Retrieval (2024): https://www.anthropic.com/news/contextual-retrieval (fetched 2026-10-13)
- Liu et al., "Lost in the Middle: How Language Models Use Long Contexts" (2023): https://arxiv.org/abs/2307.03172 (not fetchable from this environment; cited from prior knowledge, check before quoting numbers)
- AWS to verify: https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters.html
