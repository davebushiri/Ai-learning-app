<!-- Research commissioned by the founder on 2026-10-13 (thread 0006). Written by a research agent; saved by the lead. -->

## Research report: Lathoa, similar systems, reusable open source

**How this was checked.** Web search worked, but direct fetches of news.ycombinator.com, lathoa.ai, arxiv.org and substack failed (DNS or proxy 403). GitHub pages did load, so the GitHub licences below were read from the repo pages. Everything about Lathoa comes from search-engine extracts of the HN thread, lathoa.ai and two aggregator digests. Treat it as **moderate strength** (first-party claims, never seen in full) unless marked otherwise. I left out what `docs/foundation/open-source-landscape.md`, `docs/research/market.md` and `docs/research/learning-science.md` already cover (OATutor, DeepTutor, Oppia, ts-fsrs, McLaren and Adams erroneous examples, the 2510.05271 protégé study, NuVu).

---

### 1. Lessons from Lathoa

**Facts found**
- **Links:** site [lathoa.ai/en](https://lathoa.ai/en). Show HN: [item 49909648](https://news.ycombinator.com/item?id=49909648), around 2026-09-30. Reported as 45 points and 20 comments by [one digest](https://github.com/datnguyenquy94/news-radar/issues/648), and 26 points and 10 comments by [another](https://github.com/kouweizhu/agents-radar/issues/284). That is small traction, and **no user numbers are published**. I couldn't find the builder's name. A commenter says it was "built with a lot of help from Claude" (weak, second-hand).
- **How mistakes are made and verified (founder's post):** Errol's solution always contains one planted error. Before a child sees a case:
  - a plain arithmetic checker redoes the maths exactly, where it can;
  - a **second model solves the problem without seeing Errol's work**;
  - if anything disagrees, the case is discarded.

  The founder names two weak spots. The second model can make the *same* error as the first. The arithmetic check only works for English so far, because German and Greek decimal commas break the parser.
- **Grading:** the child first picks the first wrong step. Writing an explanation earns extra XP, and **speed earns bonus points**. Explanations are AI-scored ([yam.com article](https://n.yam.com/Article/20261003492204), weak). Errol answers the explanation in a "helpful learning tone". No rubric is published.
- **Loop and progression:** a case is a problem that Errol works through out loud. The kid spots the bad step, explains why it breaks, and earns a detective rank. There are three tiers (Obvious, Sneaky, Expert), and "the sneakier the catch, the bigger the rank-up". There is no open-ended chat, it claims to respect COPPA, and it runs on web, iOS and Android.
- **Pricing (lathoa.ai, moderate):**
  - Free: 1 kid, Obvious tier only, 3 cases a day.
  - Learner: $66.99/yr.
  - Parent: $95.99/yr, adds a dashboard, a weekly digest and "misconception flags".
  - Family: $143.99/yr, up to 4 kids.
  - New accounts get a 7-day Parent trial with no card.
- **Source code and stack:** no public repo. A GitHub search for "lathoa" finds nothing related. No stack is disclosed.
- **HN criticism:**
  - The two sample cases had errors "extremely basic", easy for a Year-9 child; the commenter asked for harder errors up front.
  - Debate over whether it teaches well and whether it erodes children's trust in AI (digest summary, weak).

  The only praise I saw was general interest in the idea.

**What to copy**
1. **A deterministic check before the model check.** Our blind verifier is model-only. Where a pack can say how to check a step (arithmetic, units, a code-section lookup, a checklist rule), run a non-AI check first. This also fits invariant 3, which requires a non-AI fallback.
2. **Discard on any disagreement**, and log it. The discard rate is a quality metric per pack.
3. **A named difficulty tier that is visible in the reward** ("sneakier catch, bigger rank-up"). This maps onto our ladder.
4. **The parent/manager tier sells "misconception flags".** That is our mistake-type learner model, priced as the premium feature.

**What to avoid**
1. **Correlated verifier error.** If our verifier is the same model family with similar prompts, it shares Errol's blind spots. Use a different model or temperature for the verifier, give it a different framing, and add pack-level deterministic checks.
2. **Speed bonuses.** They push learners to stop fast rather than explain well. That conflicts with our explanation-first grading and our false-alarm penalty. If timing must count, use a hazard-perception-style window (see section 2) rather than raw speed.
3. **"Always wrong."** Errol always has exactly one bug, so the learner knows a bug exists. Our clean runs and false-alarm grading are stronger. Keep them, and say so in positioning.
4. **Locale-blind parsing.** Normalise numbers and units per locale before any deterministic check.

**What users complained about:** the first cases were too easy. Our first card in a pack must not be trivial for the target user. Calibrate the starting tier (a placement card), or let users skip ahead.

---

### 2. Similar systems: what we can reuse

| System | Evidence | What to reuse |
|---|---|---|
| **HypoCompass** (CMU; students act as TAs debugging an LLM's buggy code), [arXiv 2310.05292](https://arxiv.org/pdf/2310.05292), [IJCAI'25](https://www.ijcai.org/proceedings/2025/1217) | Moderate: +12% pre-to-post on debugging, small sample. LLM-generated bugs were 4x faster to produce than human-written ones. | The closest academic twin of our loop. Its **generation prompts** (bug + distractor + bug explanation + fix) are a template for our card-generation schema. The paper also frames AI imperfection as building calibrated trust in AI, which answers Lathoa's trust criticism. |
| **TeachYou / AlgoBo** (KAIST, CHI 2024), [arXiv 2309.14534](https://arxiv.org/abs/2309.14534) | Moderate, N=40 | A "reflect-respond" pipeline keeps the AI tutee's misconception **stable across turns**. Useful if the apprentice ever pushes back ("why is that wrong?"). Its mode switch, where the tutee periodically asks "why" or "how", is a cheap way to deepen explanations. |
| **Misconception faithfulness of LLM simulators**, [arXiv 2605.12748](https://arxiv.org/pdf/2605.12748) (NeurIPS 2026) | Strong method, 7 models | LLM "students" drop their simulated misconception after *any* corrective feedback (near-zero "selective flip"). **Lesson:** don't let the live model *be* the mistaken apprentice in dialogue. Keep mistakes scripted by the server on the card (as we do). If we add rebuttal turns, test with their misaligned-feedback control. |
| **MISTAKE** (synthetic errors that stay consistent with an underlying misconception), [arXiv 2510.11502](https://arxiv.org/pdf/2510.11502) | Moderate | **Cycle consistency** as a card quality check: from the planted wrong step, can a blind model recover the intended misconception tag? If not, the mistake is noise rather than a real misconception. This is a second verifier check that costs one call. |
| **Eedi misconception work**: [Kaggle write-up](https://eedi.com/blog/from-wrong-answers-to-real-insights-how-we-used-a-kaggle-challenge-to-map-student-misconceptions), ["Explain the mistake" experiment](https://eedi.substack.com/p/can-ai-create-an-explain-the-mistake), [AI tutor blind spots, arXiv 2605.23925](https://arxiv.org/pdf/2605.23925) | Moderate | Their misconception taxonomy shows how a mistake-type learner model is built. The blind-spots paper describes a **"correct answer trap"**: graders accept right answers given with wrong reasoning. Add "right step, wrong reason" cases to our grader eval set (we already grade "wrong reason"). |
| **Teachable agents**: Betty's Brain ([Vanderbilt](https://lab.vanderbilt.edu/live/2024/06/20/bettys-brain/)), SimStudent | Strong over decades, but **no public code**. Betty's Brain is now hosted on OECD's PILA. | Design only: the agent "takes a quiz" and its failures show the learner what they taught. That is a possible "reverse mode" later. |
| **Code-review serious game CRSG** (Bilkent), [repo](https://github.com/barisardic/crsg), 132 + 280 students | Moderate | Uses a defect taxonomy (Mäntylä & Lassenius) as the classification step after the catch. That supports our "mistake type" field as something learners pick or say. |
| **UK DVSA hazard perception test**, [scoring explainer](https://support.drivingtestsuccess.com/hc/en-us/articles/202331922-How-does-the-scoring-work-in-the-Hazard-Perception-apps) | Strong (national exam for decades) | **Score the timing of a stop inside a window:** 5 points at onset, tapering to 1, 0 outside. Detect stop-spamming and give it 0. This is a proven design for our "late catch" and false-stop rules, and a better alternative to Lathoa's speed bonus. |
| **VR construction hazard spotting** ([ASCE](https://ascelibrary.com/doi/10.1061/JMENEA.MEENG-6016); AERA meta-analysis, 9 studies, d≈0.55 after correction) | Mixed to moderate; the gains depend on the hazard type | Supports a trades pack. The gain over passive training seems to come from active detection, not from immersion, so voice narration may capture much of it. |

---

### 3. Reusable open source (licence-checked)

| Repo | Licence | Activity | What we'd take | Effort |
|---|---|---|---|---|
| [mqo00/hypocompass](https://github.com/mqo00/hypocompass) | **MIT** (GitHub API) | 3 stars, pushed 2026-02 | **Design and prompts:** `llm_generate_materials.ipynb` and the supplement PDF hold the full prompts for buggy code, distractors and explanations; `system/backend/problems/` holds sample data. | Low. Read it and adapt the prompt structure into our card generator. Record it in THIRD_PARTY if any text is copied. |
| [ai-shifu/ai-shifu](https://github.com/ai-shifu/ai-shifu) | Apache-2.0 | 325 stars, active today | Not much. It's a Python LLM-teaching framework, and DeepTutor already covers that category. | High, and low value |
| [Open-TutorAi/open-tutor-ai-CE](https://github.com/Open-TutorAi/open-tutor-ai-CE) | BSD-3 (per README) | 108 stars | A reference for wiring voice STT/TTS settings. It has **no grading**. Python and SvelteKit. | High. Study only. |
| [hahahumble/speechgpt](https://github.com/hahahumble/speechgpt) | MIT | 2.7k stars | A browser voice loop using Web Speech plus optional Azure/Polly, in TypeScript. Its fallback logic is worth reading. | Low to medium. It's built with React and Vite, so we'd lift patterns, not files. Our vad-web + Web Speech plan is already stronger. |
| [emorynlp/LLM-Grading](https://github.com/emorynlp/LLM-Grading) | **No licence file**, so not usable as code | 0 stars | Its rubric-in-prompt design (deduction with a reason, invalid grade becomes 0) is less complete than ours. | Skip |
| [barisardic/crsg](https://github.com/barisardic/crsg) | **No licence**, so not usable | 7 stars | Design only (see above) | — |
| [eth-nlped/mathdial](https://github.com/eth-nlped/mathdial) | **CC BY-SA 4.0** on GitHub; the HF card says CC BY 4.0 (conflict) | 95 stars | **Data:** 2.9k tutoring dialogues with an LLM student showing common errors. Useful as grader eval material for maths packs. ShareAlike would apply to any derived dataset. Keep it in `evals/` only and never ship it. | Low for evals |
| [CMUCTAT/CTAT](https://github.com/CMUCTAT/CTAT) | Custom licence, "free for academic and research use" | 125 stars | **Not usable commercially.** Its behaviour-graph idea (a tree of correct and buggy steps) can only be read. | — |
| [apprenticelearner/AL_Core](https://github.com/apprenticelearner/AL_Core) | MIT | 15 stars | A Python/Django agent that learns from demonstrations. Not relevant to us. | Skip |
| Betty's Brain, SimStudent, USC OpenTutor | No public code found | — | Papers only | — |
| Open situational-judgment item banks | **None found** under an open licence. [arXiv 2510.22170](https://arxiv.org/pdf/2510.22170) shows that LLM-generated situational-judgment items rated by experts can match human quality. | — | Keep generating our own items with blind verification. | — |
| Eedi Kaggle data | The competition data licence was not confirmed; such data is usually restricted to the competition | — | Don't use it without a written licence. | — |

**Honest bottom line:** no repository does our core loop better than what we've designed. The only directly reusable code-level asset is HypoCompass's MIT-licensed prompts and data. Everything else is design input.

---

### 4. Recommendation

**Borrow now (F1/F2, small):**
1. **A deterministic pre-check slot in the blind verifier:** a pack-declared, non-AI check (arithmetic, units, rule lookup) that runs before the model, with locale-aware number parsing, and that discards any card where the checks disagree. This is Lathoa's best idea.
2. **Make the verifier different from the generator** (another model, framing or temperature) to lower the risk of the shared-error failure the Lathoa founder admitted.
3. **A cycle-consistency check (MISTAKE):** a blind model must recover the planted mistake's type from the wrong step, or the card is dropped.
4. **A hazard-perception timing window** for scoring a catch as on-time or late, plus a stop-spam rule. No raw speed bonus.
5. **Grader eval cases for the "correct answer trap"**, where the right step is given with the wrong reason. This goes to evals-engineer.
6. **Calibrate the starting difficulty:** the first card is not trivial, and there's a way to skip ahead. This answers the top HN complaint.

**Borrow later:**
- HypoCompass prompt patterns for code packs.
- An AlgoBo-style stable-misconception "push back" mode, tested against the 2605.12748 control first.
- A Betty's Brain-style reverse mode.
- MathDial as eval data, kept in `evals/` only.
- "Misconception flags" as the paid manager/parent tier, priced at $67–144/yr per Lathoa.

**Don't adopt:** CTAT (non-commercial licence), and the repos with no licence (LLM-Grading, CRSG).
