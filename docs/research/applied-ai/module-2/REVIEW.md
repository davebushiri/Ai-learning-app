# Module 2 review: independent verification

**Reviewer:** learning-designer (on call, independent of the author session) · **Date:** 2026-10-15
**Scope:** `README.md`, `diagnostic.json`, `reference/m2-ref-01..11`, `exercises/*.json`. Read against [thread 0007](../../../team/threads/0007-applied-ai-aws-track.md), the F1c spec (FR-017 to FR-022, PD-2, PD-3) and `server/services/practice-matcher.js` (`matcher@2`, read-only), the dossier [`defend-my-build.md`](../defend-my-build.md) and the module-1 [`REVIEW.md`](../module-1/REVIEW.md).
**Role:** advisory. The author fixes content, the PM decides scope and spec, the architect decides matcher rules, and the founder confirms facts.

## Verdict

- **Ownership note:** CLAUDE.md lists `docs/research/**` as founder-owned. The lead directed the edits below. Each is logged in the fix log so the founder can accept or revert it.
- **Content accuracy: good.** Every Anthropic-sourced claim I spot-checked holds (8 pages fetched today; table below). No planted misconception is actually true, and every `whyWrong` holds. I found one oversimplified follow-up premise (F6), one AWS feature described in a way that misleads in context (F7), and several precision slips in trusted text (learn files, one `whyWrong`). All are fixed. All 18 AWS claims remain UNVERIFIED. None looks wrong, and the AgentCore GA claims match today's search snippets.
- **Separation: holds.** I found no flawed statement in `reference/` or in the learn narrations. The "Watch for" lists state only correct rules. Learn-01 had a sequencing contradiction (F4), which is not a planted error but would confuse the worked example. It is fixed.
- **Assessability: one systematic defect (F1), now fixed in content.** Under FR-017's 60% rule, a rubric alternative with three or more content tokens can match **without its negator**. PD-2 then skips the negation check because the alternative "contains a negator". So the misconception, stated positively, earns credit. I traced this by hand against `matcher@2`. 32 alternatives in 11 files had this shape, including the two defend-my-build items, where a learner's **overclaim** would have matched. The README's echo-rule claim holds on my independent hand trace: no `correct` alternative or `acceptableCorrections` entry completes on its own flawed line.
- **Honesty (ref-11, interview-04): two overclaims, both fixed** (F2). "I deliberately didn't use an agent" and "the habits … I put in the gateway" asserted a decision and an authorship that the dossier doesn't support. The interview rubric rewarded "chose not to use an agent".
- **Pedagogy: sound.** Mistakes are plausible practitioner misconceptions, the two zero-error controls are clean (after F9), difficulty broadly progresses, and the learn files are now true worked examples with a visible decision point. The weak spots are a near-replay of learn-03 inside catch-09 (F8, fixed), d3 items that are not subtle (F12), and the missing agentic-RAG bridge (F3).
- **Interview fit: strong.** Agents, embeddings in depth and production failure modes are now covered, and the founder's lack of production evidence is handled honestly. The remaining gap is **agentic RAG** (F3). The module-1 review said this belongs in module 2, and it is the natural probe where "RAG" and "agents" meet.

**Counts:** 20 findings: 3 High, 9 Medium, 8 Low. 16 are fixed or partly fixed in the drafts (fix log below). 4 (F3, F12, L7, L8), plus the unfixed part of F11, are left for the author, PM or architect.

---

## High

### F1. Negator-bearing alternatives of 3+ tokens match without the negator (polarity inversion) · FIXED (content) · architect: Later
- **Where (before the fix):**
  - catch-01 s5 `explain[0]` ("shape not correctness", "shape not values", "format not meaning", "type not value");
  - catch-03 s7 `explain[1]` ("cant show better");
  - catch-05 s5 `explain[0]` ("not fool proof", "no reliable defense", "reduces not removes");
  - catch-07 s3 `explain[0]` ("not recognized as duplicate", "duplicate not detected");
  - catch-07 s6 `explain[0]` ("not a loop control", "doesnt bound steps", "wont stop loops", "not stop loops", "doesnt stop loops");
  - catch-09 s6 `explain[0]` ("retrieval not answer", "retrieved not correct", "doesnt measure answers");
  - catch-09 s7 `explain[0]` ("no general rule");
  - learn-01 teach-back 2, learn-02 teach-back 1 and follow-up, learn-03 teach-back 3, diagnostic d02 and d06;
  - interview-01 strong signal; interview-04 `mustCover[0]` ("no live users") and follow-up ("didnt hand write the code").
- **Evidence (hand trace against `practice-matcher.js`):**
  - `matchAlternative` needs `ceil(0.6 × 3) = 2` of 3 tokens, and sets `hasNegator` from the alternative's tokens, whether or not the negator was found.
  - `matchItem` then marks the hit as not negated.
  - So the incorrect answer "Lowering the temperature stops loops" matches "wont stop loops" on `stop` + `loops`: catch-07 s6 explanation goes to `partial`.
  - Likewise "the system prompt is fool proof" matches "not fool proof", and "the prompt is a reliable defense" matches "no reliable defense". On interview-04, an overclaim of live users matched "no live users", and "I hand write the code" matched "didnt hand write the code".
- **Risk:** this is R3 from thread 0007: an incorrect answer earns credit, and it is the same shape as module 1's B10. On interview-04 it rewards exactly the overclaim the item exists to prevent.
- **Fixed:** every such alternative is replaced by a 2-token form, which needs both tokens (so the negator is required), or by a positive phrasing ("only shape", "not correctness", "doesnt stop", "looks new", "not foolproof", "no users", "didnt write it"). Each replacement was checked against its own flawed line, and none completes on it.
- **For the architect (Later; the founder has stopped grader tuning, so this is advisory):** a one-line rule makes the bug impossible: an alternative that contains a negator matches only if the negator token itself is found. It would need a `MATCHER_VERSION` bump.
- **For the module-1 author:** module 1 likely has the same shape (for example "more consistent not identical"). Re-check it the next time module 1 is edited.

### F2. Defend-my-build material overstated the founder's role and decisions · FIXED
- **Where:** ref-11 talking points 1 and 2 and the "one breath" answer; interview-04 `mustCover[2]` alternative "chose not to use an agent".
- **Evidence:**
  - The dossier §4 says the code is AI-written, and the founder can't claim "writing the code by hand".
  - The lead's note says the initial foundation code came from the lead AI session during the hackathon.
  - Nothing in the dossier or ADRs records agents being considered and rejected.
  - "I deliberately didn't use an agent", "the ones I put in the gateway" and "I used structured single calls" therefore assert a design decision and an authorship with no evidence. The rubric rewarded the first.
  - The table also cited the held-out set as evaluation discipline without saying the grader still fails its own gates (dossier update, 2026-10-15). An interviewer's next question ("so does the grader work?") would expose that.
- **Fixed:**
  - Talking point 1 now argues the fit ("the app doesn't need an agent, and here's why") and says explicitly not to present it as a recorded decision.
  - Point 2 now reads "the ones the app's gateway enforces", with a note that the gateway was AI-written under the founder's direction.
  - The one-breath answer now says "it uses" and adds "tested against a simulated API; no live calls or users yet".
  - The grader-gate failure has been added to the facts, the table and "Don't claim".
  - interview-04 `mustCover[2]` now reads "tasks are single step | single step | simplest design | agent unnecessary | agent overkill".
- **Still true and fine:** the app has no agents and no tool calling, and every remaining talking point maps to a dossier section.

### F3. Agentic RAG is missing · NOT FIXED (author; draft below)
- **Where:** nowhere in module 2 (grep: no "agentic RAG", no "retrieval as a tool"). The module-1 review (H7) routed it here.
- **Risk:** it is the most likely question that joins two of the hiring manager's words: "When would you let the agent decide when and what to retrieve?" The founder would have to improvise.
- **Suggested fix (author; about one paragraph plus one "Watch for" line in ref-03 or ref-10).** Draft:
  > **Agentic RAG: retrieval as a tool.** Instead of always retrieving once before generation, give the agent a `search` tool. It decides whether to search, rewrites the query, searches again when results are thin, and stops when it has enough evidence. This helps multi-hop and vague questions, and costs extra calls, latency and run-to-run variation. Keep fixed single-shot retrieval as the baseline, evaluate both on the same labelled questions (answer correctness, faithfulness, cost and latency per question), and cap the number of searches.
- Evidence strength: this is a design pattern, not a measured result. Anthropic's research system is an example of iterative search by agents (fetched today). Any claim that it is "better" needs your own evaluation.

---

## Medium

### F4. learn-01's worked example contradicted itself at the decision point · FIXED
- **Where:** s4 sent an error back to the model, then s5 said "our code retries once". So who retried, and when?
- **Risk:** the decision point is the one thing a worked example must make unambiguous (user-flow, "the key decision point made visible").
- **Fixed:** s4 is now "first call times out; the decision point is that a read is safe to repeat, so our code retries it once after a short wait". s5 is now "had that failed too, we'd send back an error result…; this time it works". The teach-backs are unchanged and still fit.

### F5. The `both` / `against` stopwords collapse alternatives to one generic token · FIXED
- **Where:** catch-03 s4 `correct[1]` ("test both", "measure both", "evaluate both"); catch-03 s7 `explain[1]` ("measure against", "compare against"); catch-09 s7 `correct[0]` ("test both", "measure both"); interview-02 `mustCover[4]` ("evaluate both").
- **Evidence:** `both` and `against` are in `STOPWORDS`, so "test both" becomes `[test]`, which needs one token. Any answer that says "test" earns the item, including incorrect ones.
- **Fixed:** replaced with two-token forms ("test both designs", "measure against baseline", "test separately", "test chunking too", "evaluate both designs"). Each was checked against its flawed line.

### F6. catch-05's follow-up assumed the company-domain rule removes the exfiltration leg · FIXED
- **Where:** `catch-05.followUp` ("Which leg … does the email rule remove").
- **Evidence:** the helpdesk's tickets are written by staff (s1, s3), and the email rule allows any company address. A staff member can plant an injection in a ticket and receive the leaked data at their own company address. The rule narrows the leg; it doesn't remove it (lethal trifecta, Willison 2025, search snippets only; OWASP LLM06).
- **Risk:** the expert answer would be marked against the rubric.
- **Fixed:** the question now asks how much of the trifecta the rule addresses and what risk is left. The rubric gained "narrows not removes | insider | staff can still receive" and stronger mitigations. Clean line s6 is untouched and still true.

### F7. Bedrock "user confirmation" was presented as if it were the approval control · FIXED (still UNVERIFIED)
- **Where:** scenario architecture C summary ("user confirmation on the credit action"); ref-06 AWS mapping.
- **Evidence (search snippets of the AWS user guide and translated pages, today):** the agent asks the **end user** to confirm or deny. In this scenario that is the customer, who is also the author of the injected drop-off note in challenge 4. So it is neither the supervisor approval above 10 dollars nor a defence against that injection.
- **Fixed:** the scenario summary now routes approval through return of control or the billing integration, and says what user confirmation is and isn't. ref-06 says who confirms. Both stay UNVERIFIED.

### F8. catch-09 replayed learn-03's case, so it tested recall of the lesson · FIXED
- **Where:** catch-09 s1 was near-verbatim learn-03 s3 (the same "three hundred real queries … part-number lookups"), and learn-03 s7 already shows "reranked from the top fifty", which answers catch-09 s4.
- **Evidence:** retrieval practice helps when the item demands reconstruction. A re-presented case invites recognition (learning-science.md §2, "each review is a new scenario"; strong evidence for retrieval and spacing, extrapolated to item design).
- **Fixed:** catch-09 is now a support-inbox search with error-code lookups (s1, s3, follow-up). Statements, rubrics and planted ids are otherwise unchanged.

### F9. catch-02 s8 (zero-error control) was contestable · FIXED
- **Where:** "same tool with the same arguments three times in a row, we stop and flag a loop."
- **Evidence:** polling a job or parcel status legitimately repeats identical calls. An expert could stop here, and a correct stop in a zero-error set would be graded as a false alarm.
- **Fixed:** the condition is now "… and gets the same result three times in a row".

### F10. Red flags that fire when a good answer rejects the anti-pattern · FIXED
- **Where:** scenario `redFlags` ("blind retries", "shared admin credentials"); interview-02 `redFlags` ("agents for everything").
- **Evidence:** FR-022 discounts a red flag only when a listed negator comes within 3 tokens before it. "I'd avoid blind retries", "instead of shared admin credentials" and "the mistake is agents for everything" are natural, correct phrasings with no such negator. One red flag makes **every** dimension uncertain (FR-021). The README's own rule is "few red flags, made of rare words", and catch-05 trains the learner to say exactly "shared admin credentials".
- **Fixed:** those three alternatives are removed. The scenario keeps "retry every call blindly" and "ship on a demo | demo only". interview-02 now has `[]`, like interview-03.

### F11. Overlong single-alternative items · PARTLY FIXED
- **Where:**
  - scenario `mustCover` "timeouts, bounded retries and fallback for the scheduling service": 6 tokens, so 4 are needed, and it was the only alternative;
  - scenario transfer items "booking system is flaky: …" and "evaluate on real past conversations with repeated trials": 6 tokens, needing 4;
  - interview-04 transfer "what I did build: gateway with …".
- **Risk:** a correct short answer ("timeouts and retries, with a fallback") misses the item: 3 of the 4 needed tokens.
- **Fixed:** short alternatives were added to each.
- **Not fixed (author):** scenario `strongSignals` such as "asks clarifying questions before designing", "names at least two architectures…" and "marks AWS specifics as to-be-verified" describe behaviour, not words. The matcher will almost never fire on them. Move them to the self-rating checklist, or drop them from matching.

### F12. The d3 set isn't subtle enough, and dismissive wording is a tone tell · NOT FIXED (author)
- **Where:**
  - catch-07 s6 (temperature stops loops) is close to a module-1 catch, so it plays at d1;
  - catch-07 s3 ("the model will make up a fresh key") is less realistic than the real bug.
- **Tone tell:** 5 of the 17 planted lines dismiss something ("no further checks", "There's no need", "we won't need", "just a label", "to keep setup simple"), and no clean line does.
- **Suggested changes:**
  - catch-07 s3: make it realistic and subtle, for example "our tool wrapper generates a fresh UUID key for every call it sends". This needs a rubric rework, because "code generates key" would then echo the line.
  - catch-07 s6: make it context-dependent, for example a loop limit placed in the system prompt rather than in code.
  - Add one confidently dismissive **clean** line in two of the d2/d3 sets (for example "There's no need to re-embed when we only add new documents").

---

## Low

- **L1. catch-07 s3 `whyWrong` was imprecise · FIXED.** If an HTTP client retries the identical request, it carries the same key and is deduplicated. The failure happens when the model calls the tool again. The `whyWrong` now says so.
- **L2. A key "from the order" alone would block a legitimate second partial refund · FIXED.** learn-02 s6 and catch-07 `acceptableCorrections[0]` now say "from the order and the refund request" (as ref-08 does: order ID plus action). Scenario architecture B ("derived from the parcel") is fine, because policy allows one credit per parcel.
- **L3. learn-03 s7 "beat either model alone" was ambiguous · FIXED.** It now reads "with the new model … beat vector search alone within our latency budget".
- **L4. Scenario numbers were implausible · FIXED.**
  - 40,000 conversations a day for 120 staff is about 330 each per day. Changed to 4,000.
  - "Rejects a repeated key with the original result" is now "treats a repeated key as a duplicate, returning the original result".
- **L5. OpenSearch hybrid-search version · FIXED (label only).** My recollection is that open source introduced it in 2.10, not 2.11 (prior knowledge, **not verified**). ref-10 and README row 16 now say "check the version".
- **L6. catch-08 s3 missed the most natural phrase · FIXED.** "one trial" (used in its own acceptable correction) is added to `explain[1]`.
- **L7. The diagnostic has 10 items; `LIMITS.diagnostic` is 6.** That is fine while it stays research-only. If the PM loads module 2's diagnostic in the app, choose at most 6 ids (d01, d02, d04 control, d06, d08, d09 cover the ramp).
- **L8. One catch item per concept again (module-1 H6) · Later (PM).** Spaced review will replay items. Parallel sets are worth it for the agent-guardrail family (catch-05, learn-02, scenario challenge 4) and for retrieval evaluation (catch-09).

---

## Pedagogy checks (no finding unless listed above)

| Check | Result |
|---|---|
| Plausible practitioner misconceptions | Yes for all 17 planted lines. Strongest: schema-valid means safe, prompt rule stops injection, big window replaces memory, one trial shows reliability, reranker recovers misses, recall@k means answer accuracy. Weakest: temperature stops loops (F12). |
| Zero-error sets genuinely clean | catch-06: yes (s2 normalized ranking and s5 Matryoshka halving are verified against Anthropic's embeddings page). catch-02: yes after F9. catch-01 s4 "strict mode … always match" and s8 "only sees … never the code" are both near-verbatim from Anthropic's docs. |
| Difficulty progression | d1 → d2 → d3 holds structurally; d3 subtlety is weak in catch-07 (F12). |
| Worked examples | One case each, decision point named, about 8 lines (60–75 s). Fine after F4. |
| Session length | Catch sets of 7–9 lines (3–6 min), the scenario split into sittings, the diagnostic in two blocks. Focus-friendly. |
| Hiring-manager fit | Agents: strong. Embeddings: strong (ANN, dimensions, quantization, migration, hybrid, rerank, recall@k). RAG: module 1 plus retrieval evaluation here; agentic RAG missing (F3). Production: failure modes, evaluation, cost; the founder's own lack of production evidence is handled honestly (F2). |

## AWS claims (all still UNVERIFIED)

- **#5 (AgentCore GA):** search snippets today are consistent: GA on 2025-10-13, Runtime up to 8 hours, A2A at GA, Memory self-managed strategy, Gateway connecting to MCP servers. These are secondary sources, so keep the label.
- **#3 (user confirmation):** snippets confirm that the end user confirms. See F7.
- **#16:** version uncertain (L5).
- **#1, 2, 4, 6–15, 17, 18:** consistent with my prior knowledge; nothing is contradicted. Titan V2 (256/512/1,024, normalize defaults to true, about 99% and 97%) matches what I remember of AWS's launch material, which is also unverified.

## Verified portable claims (fetched 2026-10-15)

| Claim | Source | Result |
|---|---|---|
| Tool-use contract: the model never executes; a structured request; your code or Anthropic's servers run it | How tool use works | Confirmed (verbatim) |
| Loop exits on `end_turn`, `max_tokens`, `stop_sequence`, `refusal`; server-side loop cap leads to `pause_turn` | How tool use works | Confirmed |
| The "regex … should have been a tool call" line; when not to use tools | How tool use works | Confirmed |
| `tool_result` first in the user message; `is_error`; instructive errors; Claude retries 2–3 times; untrusted tool results kept in `tool_result` blocks | Handle tool calls | Confirmed |
| `strict: true` guarantees inputs follow the schema; tool-use system prompt of a few hundred tokens; parallel tool use can be disabled | Strict tool use; Tool use overview | Confirmed (264–804 tokens by model) |
| 90.2% (Opus 4 lead, Sonnet 4 subagents); about 4× and 15× tokens; poor fits; "50 subagents"; resume; rainbow deployments; production tracing | Multi-agent research system | Confirmed |
| Task, trial, grader, transcript and outcome definitions; pass@k and pass^k; 0.75³ ≈ 42%; "20-50 simple tasks"; graders; "overly brittle"; "Read the transcripts!" | Demystifying evals | Confirmed |
| Context rot; compaction quote; tool-result clearing; notes outside the window; sub-agent summaries; lightweight identifiers | Effective context engineering | Confirmed |
| Voyage 4 dimensions 256/512/1,024/2,048; `input_type` prompts; normalized vectors give the same ranking under cosine, dot product and Euclidean; int8 4× and binary 32×; Matryoshka truncation and renormalization | Embeddings | Confirmed (no shared-space statement on this page; module 1's secondary label stands) |
| 25,000-token tool-response cap in Claude Code; consolidation; namespacing; high-signal results; evaluation metrics | Writing tools for agents | Confirmed (the absolute-paths example is in *Building effective agents*, as ref-01 implies) |
| τ-bench < 50% and pass^8 < 25% (retail); RRF k = 60; OWASP LLM06 three causes; lethal trifecta | Not fetched (unreachable or not attempted) | Consistent with my prior knowledge; keep the snippet and memory labels |

## Fix log (edits made by this reviewer)

| # | File · field | Change | Finding |
|---|---|---|---|
| 1 | `catch-01` s5 `explain[0]` | Inverting alternatives replaced with "only shape | shape only | only types | types only | not correctness | not the values | valid but wrong | right shape wrong value" | F1 |
| 2 | `catch-03` s4 `correct[1]`; s7 `explain[1]` | Collapsed and inverting alternatives replaced with 2-token forms | F1, F5 |
| 3 | `catch-05` s5 `explain[0]` | "reduces not removes", "not fool proof", "no reliable defense" replaced | F1 |
| 4 | `catch-05` `followUp` | Question and rubric reworked (insider leg) | F6 |
| 5 | `catch-07` s3 `explain[0]`, s6 `explain[0]` | Inverting alternatives replaced | F1 |
| 6 | `catch-07` s3 `whyWrong`, `acceptableCorrections[0]` | Model re-call precision; key from order and refund request | L1, L2 |
| 7 | `catch-08` s3 `explain[1]` | Added "one trial" | L6 |
| 8 | `catch-09` s6 `explain[0]`, s7 `explain[0]` and `correct[0]`; s1, s3, `followUp` | Inverting and collapsed alternatives replaced; new domain (support inbox, error codes) | F1, F5, F8 |
| 9 | `catch-02` s8 | Added "and gets the same result" | F9 |
| 10 | `learn-01` s4, s5; teach-back 2 item 4 | Retry sequence fixed; inverting alternatives replaced | F4, F1 |
| 11 | `learn-02` s6; teach-back 1; `followUp` | Key derivation; inverting alternatives replaced | L2, F1 |
| 12 | `learn-03` s7; teach-back 3 item 2 | Clarified the comparison; inverting alternatives replaced | L3, F1 |
| 13 | `diagnostic` d02, d06 | Inverting alternatives replaced | F1 |
| 14 | `interview-01` strong signal; `interview-02` `mustCover[4]`, `redFlags` | Inverting and collapsed alternatives replaced; red flag removed | F1, F5, F10 |
| 15 | `interview-04` `mustCover[0]`, `mustCover[2]`, `followUp`, transfer | "no users", "agent unnecessary | agent overkill", "didnt write it", short transfer alternatives | F1, F2, F11 |
| 16 | `scenario-01` architecture C summary; clarifications (volume, idempotency wording); `mustCover`; transfer; `redFlags` | User-confirmation scope; 4,000 a day; short alternatives; two red flags removed | F7, L4, F11, F10 |
| 17 | `reference/m2-ref-11` | Facts (events, grader gates), talking points 1 and 2, table, one-breath answer, "Don't claim" | F2 |
| 18 | `reference/m2-ref-06` AWS mapping; `reference/m2-ref-10` AWS mapping; `README.md` row 16 and status line | Who confirms; version label; pointer to this review | F7, L5 |

Every edit keeps the planted/clean partition unchanged: no statement moved, no id changed, and no item exceeds 8 alternatives. String contents only; **no JSON validation or `matcherGrade` run** was possible here (no shell), so the traces above are by hand.

## Left for others

- **Author:** F3 (agentic RAG paragraph), F11 (strong signals that describe behaviour), F12 (d3 subtlety, dismissive tone tell), and the module-1 audit for the F1 shape.
- **Architect (Later):** the F1 rule (a negator-bearing alternative must find its negator).
- **PM:** L7 (diagnostic ids if loaded in the app), L8 (parallel sets, Later), and the README's day-4/5 swap, which I support as written.
- **Founder:** accept or revert this fix log, and re-read ref-11 before the interview.
