<!-- Research commissioned by the founder on 2026-10-13 (thread 0006). Written by a research agent; saved by the lead. -->

# PMP and interview prep as a proof of concept: research report

**What I read in the repo.** I read CLAUDE.md, docs/foundation/README.md, the decisions.md rows D22 and F1/F2/F3, docs/research/domain-fit.md, packs/demo-trades/pack.json, server/prompts/{scenario,grade}.js and the F1a tasks.md. I changed no files.

**This work is already half done.** domain-fit.md already recommends PMP first. Two PMP sample scenarios already pass `validateScenario()`: docs/research/sample-scenarios/pmp-scope-change.json and pmp-agile-conflict.json. Most of what is new below is about timing, interview prep and the plan for the founder's network.

## 1. PMP fit

**Exam facts.** A new Exam Content Outline (ECO) took effect on 9 July 2026:
- Domain weights: People 33%, Process 41%, Business Environment 26%. The old weights were 42 / 50 / 8.
- 26 tasks, down from 35. Change control and risk moved into Business Environment.
- Approach mix: about 40% predictive, 60% agile or hybrid.
- 180 questions, 240 minutes.
- New case-study sets and graphic-based items.
- Sources are medium strength: training-vendor blogs plus a mirrored copy of PMI's outline PDF. PMI's own site was blocked by the proxy, so all of this should be checked against pmi.org before we make any public exam claims.

**How well the game fits.** Most items are situational: "what should the PM do NEXT or FIRST?" The wrong answer options are typically the moves a PMI-minded PM wouldn't make: acting before assessing, skipping change control, escalating too early, or taking control instead of empowering the team.
- A narrated scenario with a planted mistake is that wrong option, played out.
- The learner's explanation of why it is wrong is the reasoning that rules out those options.
- `correctAction` is the right answer.
- **The gap:** the exam asks you to pick among four plausible options, and STOP only trains spotting the wrong move. The "choose the next move" variant (domain-fit §4) closes that gap and is graded deterministically.

**Learning evidence is modest.** A meta-analysis of learning from erroneous examples finds a weak but significant effect (g = 0.136, 42 papers). The effect is stronger when learners explain the error themselves. Some classroom studies find no advantage. This supports our explain-why design, but don't promise big gains. Source strength: strong (peer-reviewed).

**Competitors.** PMI Study Hall, PrepCast, TIA (Ramdayal) and Udemy all use multiple-choice banks with written explanations, plus mini and full mock exams. Study Hall has 10-question minis and 180-question full exams.
- None of them are voice-first.
- None make the learner produce the reasoning: you click an option and read the rationale.
- None model the learner's skill by competency and mistake type.
- **The differentiation gap is real but narrow:** spoken "explain why" practice for commutes, and a learner model by mistake type. Exam realism is not a gap; PrepCast and Study Hall own it.
- Source strength: weak to medium (PMI shop pages, vendor and forum opinion).

## 2. Legal and IP

**Copyright.** PMI holds copyright in the PMBOK Guide. Reproducing PMBOK or other standards text needs PMI's permission form and may cost a fee (pmi.org/permissions; strong source). Original scenarios aligned to the ECO's task areas are standard practice across the prep industry and don't copy PMI text. Rules:
- Store our own paraphrase plus a task reference ID. Never paste ECO enabler text or PMBOK prose.
- Never use real or recalled exam items, and don't accept user-submitted "real questions". PMI's candidate agreement forbids sharing exam content.
- LLM output can echo leaked "brain-dump" questions, so the verifier should check generated scenarios for that.

**Trademark.** PMP, PMBOK and PMI are registered marks. PMI's site terms bar uses that imply sponsorship or affiliation (strong source). A forum account says PMI requires approval before "PMP" appears in a product or service name (weak source: one person, but consistent with the terms).
- Safe default: a neutral product name, with descriptive use only, e.g. "practice for the PMP® exam".
- Add the disclaimer "Not affiliated with, endorsed by or sponsored by PMI. PMP and PMBOK are registered marks of the Project Management Institute, Inc."
- Make no pass-rate claims and don't use PMI logos.
- Have a trademark attorney check before any public or paid launch. Private network testing is low risk.

## 3. Interview prep fit

| Type | Fit with "stop and explain" | Objectivity |
|---|---|---|
| **Behavioral (STAR)** | Good **only as critique mode**: an AI candidate gives a flawed answer and the user stops it at the flaw. Flaws: missing Result, "we" instead of "I", no metrics, blaming others, rambling Situation. | Medium. Structural flaws are checkable; what makes a "good story" is subjective. |
| **PM / product case** | Good. Planted mistakes like solution-first, vanity metric, no guardrail metric, no segmentation (domain-fit §2). | Medium-low. The frameworks compete and there is no canonical source. |
| **System design** | Strong. Planted mistakes like retries without idempotency, a shared database, no timeouts (domain-fit §3). | High. These are verifiable engineering facts. |

**Competitors.**
- Big Interview: AI feedback is mostly about delivery (eye contact, filler words, tone), plus a STAR answer builder.
- Yoodli: focused on delivery and pace; thinner on content.
- Exponent: AI feedback on PM questions, peer rubrics for system design.
- Pramp: peer-based.
- Final Round AI: generation plus live interview copilots.
- **The gap:** none of them trains the *evaluator's eye* (critiquing a flawed answer) before you produce your own answer.

Source strength: weak. These are vendor and comparison blogs, and many are affiliate-driven.

**The catch:** the real skill in interview prep is *producing* answers. Critique mode is one step removed and would need the "reverse mode" variant (size L) to fully deliver.

## 4. Which first: PMP

| Criterion | PMP | Interview prep |
|---|---|---|
| Proof of concept | One weighted outline gives a natural competency map | Three different sub-domains; no single map |
| Founder's own use | Exam deadline, so a reason to show up daily | Only episodic, when job hunting |
| Network testing | Fits "similar situations" if they are certification-seekers | Broader appeal, but scattered |
| Data quality | Answers are checkable against PMI-preferred practice; the trained vs. held-out comparison is clean | Behavioral answers are subjective, so grader agreement (kappa) will be noisy |
| Mechanic fit | Direct (situational judgment) | Needs critique or reverse mode |

**Recommendation: PMP first. Interview prep second, starting with system design**, which is the most objective of the three.

**Caveat.** The founder is learning PMP, so they can't judge content quality. PMP therefore serves as the "subject new to you" pilot, which measures learning. A PMP-certified reviewer from the network is needed to check content correctness.

## 5. Timing in our roadmap

The prompts are trade-specific today:
- scenario.js says "trade knowledge" and "NEC, OSHA, EPA".
- grade.js says "trade job" and "trade reasoning".
- The pack schema requires the trade fields `hazardHints` and `criticalHints` (FR-019).

| Option | Cost |
|---|---|
| **(a) Now, before Wave 2** | Highest cost. The PMP pack must be squeezed into trade fields and graded by a "trade job" prompt. The pack format is still being amended (D22 has had two amendments). It competes for the backend engineer, who owns `packs/**`. It breaks the F2 hard rule. Nearly everything would be built twice. |
| **(b) Right after F1a** | Pack format v1 is stable. MOCK mode (fixtures plus the keyword grader with pack synonyms) is already pack-driven, so the founder could play locally. But live grading still says "trade job", which yields bad grades and corrupts the event log, and the events are append-only. The `pack.json` fields will likely change when W7 templates the prompts (persona, severity, grounding rules), so that work gets redone. It also can't ship under the hard rule. |
| **(c) After F1b** | Lowest rework. The pack is written once against the final templates and lands behind a passed gate. Cost: waiting for the founder's API key and the 32 hand labels. |
| **(d) As the first F2 pack** | Same cost as (c), plus waiting for the Subject Builder (SB-1 to SB-5). A hand-authored PMP pack is more valuable as the *benchmark* the Subject Builder is measured against, so don't make it wait. |

**The cheapest path splits the work:**
- **Content now, code after F1b.** Scenario narrations, mistakes, consequences and the competency map are plain data and don't depend on prompt wording, so they can be written now with no rework. The `pack.json` wiring waits for (c).
- **Proposal for the evals-engineer and architect to decide:** add a few PMP grading cases to the F1b eval set. The gate is meant to show the prompts work without trade words, and non-trades cases are the most direct evidence of that.

## 6. A minimal plan the network can use soon

**Step 1: a paper playtest, starting now, with no code.**
- 10 PMP scenarios go in a shared doc or form, in text.
- Testers mark the step where they would say STOP and write why.
- The founder plus a PMP-certified reviewer label the responses (caught, partial, wrong).
- This checks the scenarios, gathers real learner explanations with real misspellings and hedges, and can supply the founder's 32 hand labels.

**Pack contents** (paraphrased IDs only):
- **Competencies (8):**
  - People: conflict, empowering the team, stakeholder engagement.
  - Process: scope and requirements, quality, agile ceremonies and backlog.
  - Business Environment: change control, risk and compliance.
- **Mistake types (10):**
  - acts before assessing
  - bypasses change control
  - escalates too early or too late
  - directs instead of empowering the team
  - treats a symptom and skips the root cause
  - surprises a stakeholder
  - gold-plating
  - a risk with no owner or response
  - adds scope mid-sprint, bypassing the product owner
  - ethics or reporting breach (e.g. a "green" status on a red project)
- **Severity:**
  - Critical: compliance or contract breach, ethics, project failure.
  - Major: baseline overrun, rework.
  - Minor: a communication habit.
- **Approach mix of the 10 scenarios:** 4 predictive, 3 agile, 3 hybrid.
- **The 10 scenarios:**
  - the 2 existing samples
  - a sponsor's hallway request
  - a vendor slip on a fixed-price contract
  - a senior dev dominating the retro
  - a regulatory deadline moved
  - a risk materializes with no owner
  - a remote-team time-zone conflict
  - a benefits review skipped at closure
  - a boss-level case set with 2 mistakes that only show up when two steps are connected

**Authoring.**
- The founder or PM writes a skeleton per scenario (competency, mistake type, target step).
- AI drafts the narration.
- A blind verifier checks: one clear mistake, PMI-preferred answer, no ECO or PMBOK text, no recalled exam items.
- A certified PMP approves every fixture.
- Hand-approved fixtures only for the pilot; AI generation waits for F3's verifier and bank.

**What the founder must provide:**
- the API key and spend approval (the $6 per run cap stands)
- the 32 hand labels
- the exam date
- one PMP-certified reviewer
- 5 to 10 testers
- a decision on name and trademark (neutral name plus disclaimer)

## Sources

**PMI (strong; pmi.org was blocked by the proxy, so these were read through search results, not fetched directly):**
- https://www.pmi.org/permissions
- https://www.pmi.org/terms
- https://www.pmi.org/shop/p-/digital-product/pmi-study-hall-pmp-plus-(subscription)/dp014

**Copy of PMI's outline (medium; third-party mirror of PMI's PDF):**
- https://backend.kayenta.de/fileadmin/kayenta/Bilder_2026/PMP-Examination-Content-Outline-2026.pdf

**Vendor blogs (medium):**
- https://www.pocketprep.com/posts/whats-changing-on-the-pmp-exam-in-2026/
- https://www.pmtraining.com/about/pmp-exam-update-july-2026

**Forums (weak):**
- https://www.projectmanagement.com/discussion-topic/134078/Questions-about-the-Proper-Use-of-PMI-Trademarks
- https://www.projectmanagement.com/discussion-topic/211817/request-for-permission-to-use-
- https://www.project-management-prepcast.com/kunena/pmp-exam-discussion/13709-is-pmi-study-hall-worth-it

**Review sites (weak):**
- https://course.careers/certifications/tia-pmp-exam-simulator
- https://brainsensei.com/tia-simulation-pmp-exam-simulator-the-ultimate-guide

**Research on learning from erroneous examples (strong):**
- https://www.leibniz-ipn.de/en/research/publications/a-framework-for-learning-from-erroneous-examples-and-meta-analysis-of-empirical-research
- https://link.springer.com/article/10.1007/s10648-025-10071-x

**Interview tools (medium to weak):**
- https://www.tryexponent.com/practice/product-management-mock-interviews (vendor's own page)
- https://www.tryexponent.com/practice/system-design-mock-interviews (vendor's own page)
- https://careers.wisc.edu/big-interview (university career-services page)
- https://www.fast.io/resources/best-ai-interview-prep-tools-2026 (comparison blog, weak)
- https://codersera.com/blog/best-free-ai-mock-interview-platforms-2026/amp/ (comparison blog, weak)
- https://hedy.ai/post/best-ai-interview-assistant-tools/ (comparison blog, weak)

**In the repo:** docs/research/domain-fit.md and its sources.

## Recommendation

Make PMP the proof of concept and leave interview prep for later, starting with system design. Use timing **(c)**: wire the pack into `packs/` right after F1b's prompt rewrite passes the live eval gate, and ship it as the first non-trades pack, before the Subject Builder. Don't do (a) or (b): a PMP pack written before F1b has to fit trade-shaped fields and a "trade job" grader. Its live grades would go permanently into the append-only event log, and its `pack.json` would be rewritten once W7 templates the prompts. Do the content work now, because it doesn't depend on prompt wording: 10 hand-checked scenarios across 8 competencies and 10 mistake types. Run them as a text paper playtest with the founder's network, labelled by the founder plus a PMP-certified reviewer. That gives testers something to use within weeks, and it can supply the 32 hand labels F1b needs. We could also propose adding a few PMP cases to the F1b eval set to show the prompts really work outside trades. Use a neutral product name with "practice for the PMP® exam" and a not-affiliated disclaimer, and get a trademark check before any public launch.
