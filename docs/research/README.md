# From "Stop the Apprentice" to a personal learning game: research brief

*October 2026. Four research workstreams ran in parallel: learning science, domain fit, market, and personalization architecture. Their full reports are in this folder. This brief combines them and recommends a direction.*

| File | What's in it |
|---|---|
| [`learning-science.md`](learning-science.md) | Evidence on learning from mistakes, retrieval and spacing, focus, gamification, AI tutors |
| [`domain-fit.md`](domain-fit.md) | How STOP maps to PMP, product management and software architecture; mechanic variants; domain packs |
| [`market.md`](market.md) | Competitors, the gap in the market, business models, go-to-market, risks |
| [`architecture.md`](architecture.md) | Learner model, packs, session engine, data model, cost, phased roadmap |
| [`sample-scenarios/`](sample-scenarios/) | 4 draft scenarios (2 PMP, 1 product management, 1 architecture). All pass `validateScenario` |

---

## TL;DR

1. **Keep the core.** "Watch someone work, STOP them at the mistake, explain why" is backed by learning research:
   - learning from erroneous examples;
   - self-explanation (meta-analysis g ≈ .55);
   - retrieval practice.
   
   No product owns this mechanic today.
2. **Change one thing about how it teaches.** Catching mistakes helps people who already know a bit, and can *hurt* complete beginners. Each new topic needs a short **"learn the move"** step before STOP mode unlocks.
3. **Make it personal with a learner model.** The app remembers which *kinds* of mistakes you miss and brings them back on a spaced schedule. Each day it gives you a **5-minute plan** sized for focus, not a buffet of options.
4. **Build PMP first ("Stop the PM").**
   - It has a deadline (your exam) and an official weighted outline to measure progress against.
   - Its "what should the PM do NEXT" questions are frozen narrations, almost exactly our mechanic.
   - The new exam outline took effect July 9, 2026, and most prep material is still catching up.
   
   Software architecture comes second and product management third.
5. **The hackathon version becomes one "domain pack" among several.** Trades, PMP, architecture and product management all run on the same engine, so the trades demo stays alive, and that can later become a B2B pilot with apprenticeship programs.

---

## 1. The concept: you're the mentor

The apprentice becomes whoever fits the subject: a junior PM, a mid-level engineer, a new product manager or a first-year electrician. You are their mentor. Each topic follows a ladder:

| Rung | What happens | Why (evidence) |
|---|---|---|
| **1. Learn the move** | A 90-second primer, then a *guided* run where the mistake is highlighted and you only explain it | Error-spotting helps learners with some prior knowledge and hurts novices (Große & Renkl 2007; Renkl 2014) |
| **2. Stop the apprentice** | Today's game: hidden mistakes, STOP, explain what's wrong, why, and what to do instead | Self-explanation of *why something is wrong* (Siegler; Bisra et al. 2018); retrieval practice (Roediger & Karpicke 2006) |
| **3. Choose the next move** | After a STOP, pick the best of 4 plausible actions, the PMP "what should you do FIRST" format | Bridges practice to exam format; trains telling near-correct options apart |
| **4. Review what you missed** | Missed mistake types come back in 1, 3, 7, 16 and 35 days, each time in a *new* scenario | Spacing (Cepeda et al. 2008); interleaving similar concepts (Brunmair & Richter 2019, g ≈ .42) |
| **5. Boss level / reverse mode** *(later)* | Long case studies, or you narrate and the AI stops *you* | The new PMP case-set item type; producing judgment without recognition cues |

Some scenarios contain **no mistake**, and some steps sound like shortcuts but are correct. That trains you to tell the difference instead of reacting to tone, and it matches the strongest condition in the error-example research: a mix of correct and incorrect examples.

## 2. Designed for focus

This is the part aimed at your stated problem. It is good general design, not a medical claim.

- **Micro-sessions of 3–6 minutes**, with an optional "one more?". Start with a daily plan, not a menu: "Today: 2 scenarios on change control, 1 review of the mistake you missed Tuesday."
- **A decision point at least every 30–40 seconds.** Quizzes placed inside lessons roughly halved mind-wandering in one study (Szpunar et al. 2013, PNAS).
- **Curiosity hooks used honestly.** Tease the consequence up front ("someone ends up in front of the change board…") and reveal "what happened next" only after you commit to an answer.
- **Interruption-proof.** The app saves after every step and resumes with a "previously…" recap.
- **Voice-first optional**: say "stop" hands-free, for walks or commutes.
- **An if-then plan at setup**, for example "After morning coffee I do one scenario." Implementation intentions have a medium-to-large effect on goal attainment (d ≈ .65). Habits take about **66 days** on average, not 21, and missing one day doesn't break them (Lally et al. 2010).
- **Weekly goals with rest days, not punishing daily streaks.**

## 3. What we must not do

1. Throw complete beginners into hidden-mistake scenarios.
2. Let the AI do the thinking: no "show me the answer" before you've tried. Hints come in stages: area of the step, then principle, then answer. In a 1,000-student study (Bastani et al. 2025, PNAS), unrestricted AI help raised practice scores by 48% and then *lowered* exam scores by 17%.
3. Use points as currency, required leaderboards, or loss-aversion streaks. They can undermine motivation (Deci, Koestner & Ryan 1999; Hanus & Fox 2015). Points should mean competence: a mastery map and how often you're right when you're confident.
4. Use long passive narration, or let bingeing become the main way to play.
5. Use **ungrounded AI "facts"** for an exam. Retrieval practice strengthens wrong facts just as well as right ones. Every mistake should cite its source, a second AI pass should verify generated scenarios, and you should be able to flag a bad grade.

## 4. Fit to your three goals

| | PMP | Software architecture | Product management |
|---|---|---|---|
| How well STOP fits | Very high: exam items are situational "what should the PM do next" questions | Very high: every pitfall has a concrete, narratable failure (double charges, outages) | High: leading interview questions, vanity metrics, premature commitments |
| Clear source of truth | Yes: the PMP Exam Content Outline (2026) and PMI's mindset | Yes: fallacies of distributed computing, SRE practice, OWASP, ADRs | Weak: frameworks such as the Mom Test, RICE, continuous discovery |
| Outside deadline that drives focus | Yes (exam date) | No | No |
| **Order** | **1st** | **2nd**. You can check correctness yourself, which reduces content risk | **3rd**. Reuses the PMP stakeholder and meeting mechanics |

**PMP facts to confirm against pmi.org before relying on them.** The proxy blocked pmi.org, so these come from search-indexed PMI pages and prep vendors:
- New outline in effect from **July 9, 2026**.
- Weights moved from 42/50/8 to **People 33 / Process 41 / Business Environment 26**, and tasks were cut from 35 to 26. **Change control and risk moved to Business Environment.**
- About 40% predictive and 60% agile/hybrid questions.
- 180 questions in 240 minutes, with **new case-set and graphic item types**.

**Copyright.** Never reproduce PMBOK or exam-outline text, and never use real or recalled exam items. Packs use our own paraphrases plus references such as "ECO 2026, Business Environment: managing changes". Include a "not affiliated with PMI" line.

## 5. How it becomes personal (architecture)

- **Domain packs replace the hardcoded trades list.** A pack holds:
  - the persona;
  - what "critical" means (injury becomes project failure, outage or compliance breach);
  - a competency map with exam weights;
  - a mistake taxonomy, twists, synonyms, validation rules, fixtures and lessons.
- **Learner model in one SQLite file**, using Node's built-in `node:sqlite`:
  - an **Elo-style rating per competency** picks difficulty. It targets about a 70% chance you'll catch the mistake, and you can see why a rating changed.
  - **review boxes per mistake type** (Leitner first, FSRS later) decide what you see again.
  - everything is rebuilt from an event log, so changing the formula never loses data.
- **The server stores scenarios by id.** The browser no longer holds the answers, and grades reference a stored scenario.
- **Your own material.** Paste notes or upload a PDF, retrieve passages with SQLite full-text search, and generate scenarios with quote-checked citations. The API's citations feature can't be used together with structured outputs, so the app checks quotes itself.
- **Three checks on every generated mistake:** rule validation; a second Claude pass that reviews the script *without* the answers and must flag every planted mistake and none of the correct steps; and your own flags.
- **Stack:** stay zero-build vanilla JS. Add hash routing, ES-module screens, then a PWA. No framework rewrite.
- **Cost per scenario (estimated; the app will measure it):**
  - about $0.27 all on Opus 5.5;
  - about $0.17 with cheaper models for verification and grading;
  - about $0.09 with nightly batch generation.
  
  At 3 scenarios a day that's roughly **$8–25 a month**. Most of the cost is output tokens.

## 6. Market position

- **Gap in the market.** Competitors are *passive* (video, audio, flashcards), *scripted* (branching-scenario tools), *general* (ChatGPT, Claude and Gemini study modes) or *hardware-heavy* (VR trades training). No product combines narrated task performance, planted mistakes from an expert taxonomy, graded "why" explanations, and consequence playback.
- **What's defensible:** the mechanic itself can be copied with one prompt. What can't be copied easily:
  - verified mistake libraries tied to a syllabus;
  - consistent rubric grading;
  - consequences;
  - a learner model built on which mistakes *you* miss.
- **Wedge:** "Stop the PM", sold as a **supplement** to existing PMP prep ("the judgment gym after your Udemy course"), for about $29–49 for 3 months. PMP candidates already pay $405–675 for the exam. Channels: r/pmp (~100k members), PMP Discords and LinkedIn study groups, and "can you catch the mistake?" short videos.
- **Biggest risk:** OpenAI's study mode and certification push, Gemini Guided Learning and Coursera Role Play are all adjacent. The response is to own verified content, the progress data, and a niche community.
- **Trades.** The strategically big option is a B2B pilot with an apprenticeship program. It works on a phone, where Interplay and Transfr need VR, and there is a 349k-worker construction gap and DOL funding. Pursue it once grading accuracy is proven, ideally with a trade-instructor advisor.

## 7. Roadmap

**Phase 0, this week (for personal use):**
1. `packs/` structure. Move trades into it and create a **PMP pack** with about 15 competencies weighted per the 2026 outline.
2. Generalize the prompts, validator, keyword grader and rating labels so they're driven by the pack.
3. SQLite persistence with scenarios stored by id and an event log of attempts.
4. `shared/mastery.js` (Elo) and `shared/review-queue.js` (Leitner).
5. A daily plan screen plus a small progress screen showing readiness, weakest area and this week's sessions.
6. Resume after an interruption.

Measure: do you actually open it daily (sessions per week, completion rate)? Do the PMP scenarios feel exam-relevant (flags per scenario)?

**Phase 1, weeks 2–5:**
- choose-the-next-move;
- "learn the move" guided mode;
- the verification pass;
- a nightly batch-generated scenario bank;
- adaptive subtlety and pacing;
- FSRS;
- prompt caching and a cost dashboard;
- an A/B test of a cheaper grading model;
- architecture and product-management packs;
- a PWA;
- a "stop" voice hotword.

Measure: does the app's readiness estimate predict your score on an outside PMP practice exam?

**Phase 2, months 2–4:**
- your own notes and PDFs with grounded citations;
- reverse mode;
- focus analytics feeding the planner;
- a timed exam simulation;
- accounts, and inviting 3–5 outside learners.

Measure: retention of other people. That tells you whether there's a product beyond yourself.

## 8. Decisions for you

1. **Is PMP first?** It's the recommendation. The alternative is architecture first if your PMP exam isn't scheduled.
2. **When is your PMP exam?** The planner needs a date to schedule reviews against.
3. **Product name.** "Stop the Apprentice" fits trades; "Stop the PM" fits the PMP wedge. A neutral umbrella name could wrap the packs.
4. **Voice or text first?** Text is cheaper. Voice may matter more for focus.
5. **Team.** The engine was built with your hackathon team. If this becomes a product, agree with them on ownership and licensing early.

## Caveats

- Most error-example research comes from school maths. No studies were found on adult PMP or architecture learners, or on ADHD specifically.
- PMP outline facts were confirmed only through search-indexed PMI pages and prep vendors.
- Market sizes come from low-confidence reports and are directional only. Several prices come from aggregator sites.
- Cost figures are estimates until the app logs real usage.
