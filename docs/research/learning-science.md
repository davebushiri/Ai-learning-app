# Learning science: what the research says about Stop the Apprentice as a lifelong-learning app

*Research workstream 1 of 4. Where only an abstract or a secondary summary was available, this report says so.*

## Ten design principles

1. **Teach the move before you test it.** Error-finding helps learners with some prior knowledge and can hurt complete novices. Use a "learn the move" warm-up with correct worked examples, then unlock STOP.
2. **"Explain why" is the core.** It is a self-explanation prompt (meta-analysis g = .55). Keep it required but short: what's wrong, why, and what to do instead.
3. **Every STOP is retrieval practice.** Space the same concepts over days with a spacing algorithm.
4. **Interleave look-alike mistakes**, such as risk vs. issue or change request vs. defect. Interleaving helps most when the categories have to be told apart.
5. **Make scenarios exam-shaped and job-shaped.** Case-based practice fits the PMP, which adds case/scenario items from July 2026. Compare two cases that share one principle.
6. **Design for focus: short, active, interruptible.** Sessions of 3–8 minutes, with a decision point every 20–40 seconds. Interspersed tests reduce mind-wandering.
7. **Use curiosity gaps honestly.** Tease the consequence, keep attention on the decision, and reveal what happened only after the learner commits.
8. **Gamify toward competence, not compulsion.** Scores should inform, not control. Streaks should be forgiving.
9. **The AI is the apprentice and the examiner, never an on-demand answer key.** Unrestricted LLM help raised practice scores and then lowered exam scores.
10. **Ground content in sources.** Each mistake cites its source, and the learner can flag a bad grade.

## 1. Erroneous examples and error detection

- **Große & Renkl (2007, *Learning and Instruction* 17(6)):** incorrect examples gave *worse* far transfer than correct ones on average. Learners with strong prior knowledge did better with a mix of correct and incorrect examples. Renkl (2014, *Cognitive Science*): only learners with enough prior knowledge profit, and weaker learners need the errors flagged for them.
- **McLaren, Adams et al. (*Computers & Education* 2012, n≈208, decimals):**
  - no difference on the immediate posttest;
  - the erroneous-examples group was better on a 1-week delayed posttest (d ≈ .62), with better self-assessment;
  - students *preferred* plain problem solving;
  - an earlier 2011 study found no advantage, so the results are mixed.
- **Booth, Lange, Koedinger & Newton (2013, *Learning and Instruction* 25):** incorrect examples improved conceptual understanding in algebra. The citation was verified, not the details.
- **Productive failure, Sinha & Kapur (2021, *RER* 91(5), 166 comparisons):** problem solving before instruction beat instruction-first on conceptual understanding and transfer (d = 0.36), with no loss on procedures. This is about generating attempts, not about spotting errors.
- **Theory:** Ohlsson (1996, *Psychological Review*), constraint-based learning from errors. Metcalfe (2017, *Annual Review of Psychology*), errors with corrective feedback help (secondary summary only).
- **Strength: moderate.** The evidence is mostly from school maths, with little on adult professionals.

**Design implications:**
- "Learn the move" mode, with STOP unlocked after a short check.
- Fade support: errors flagged, then hidden, then mixed severities with false-alarm bait.
- Some scenarios with **no mistake**, and some steps that look suspicious but are correct.
- Measure with **delayed** checks.

## 2. Retrieval, spacing, interleaving, self-explanation

- **Dunlosky et al. (2013, *PSPI* 14(1)):** practice testing and distributed practice are rated "high utility"; self-explanation and interleaving "moderate".
- **Testing effect:** Roediger & Karpicke (2006); Rowland (2014, *Psychological Bulletin*); Adesope et al. (2017, *RER*, 272 effect sizes). The advantage grows with longer retention intervals.
- **Self-explanation:** Chi et al. (1989, 1994); Bisra et al. (2018, *Educational Psychology Review*, g = .55). In Siegler's studies, explaining *why wrong answers are wrong* added learning.
- **Spacing:** Cepeda et al. (2008, *Psychological Science*): the best gap is about 20–40% of the retention interval for 1 week, and about 5–10% for 1 year.
- **Interleaving:** Brunmair & Richter (2019, *Psychological Bulletin*): g = 0.42 overall, largest for similar categories, and negative for word lists (−0.39).
- **Strength:** strong for retrieval and spacing, moderate to strong for self-explanation, moderate and material-dependent for interleaving.

**Design implications:**
- Each mistake type is a schedulable item (FSRS or SM-2):
  - missed: about 1 day;
  - partial: about 2–3 days;
  - solid: expanding intervals.
  
  Each review is a **new** scenario on the same concept.
- Grade three parts: what is wrong, which principle it breaks, and what to do instead. Add an optional confidence rating.
- Interleave look-alike concepts on purpose.
- Use the exam date as the retention target.

## 3. Scenario-based and situated learning, and transfer

- **Cognitive apprenticeship** (Collins, Brown & Newman 1989): modeling, coaching, scaffolding, articulation, reflection.
- **Goal-based scenarios and case-based reasoning:** Schank, Berman & Macpherson (1999); Kolodner (1997, *American Psychologist*). Mostly design-based research.
- **Analogical encoding** (Gentner, Loewenstein & Thompson 2003, *Journal of Educational Psychology*): comparing two cases transfers much better than studying them separately.
- **PMP from July 9, 2026:** People 33%, Process 41%, Business Environment 26%; about 60% agile/hybrid; new case/scenario and graphic items. Verify at pmi.org.
- **Strength:** the theory is strong. There is no direct experimental evidence on PMP scores.

**Design implications:**
- Tag each mistake with its exam-outline task and domain, and weight practice by domain.
- Debrief with "two cases, one principle".
- After a STOP, ask a 4-option "what should the PM do FIRST?" question.
- Use delayed, realistic consequences for architecture.

## 4. Focus and attention

- **Szpunar, Khan & Schacter (2013, *PNAS*):** interpolated tests roughly halved mind-wandering and improved learning. Follow-ups (Welhaf et al. 2022) are mixed. No adult-ADHD trials were found. Simon-Dack et al. (2014): students with ADHD lean toward surface study strategies, so structured active tasks probably help. That last point is an inference.
- **Curiosity:** Loewenstein (1994); Kang et al. (2009); Gruber et al. (2014, *Neuron*). Curiosity improves memory, including for incidental material.
- **Implementation intentions:** Gollwitzer & Sheeran (2006), d ≈ .65 (verified only through secondary sources).
- **Habits:** Lally et al. (2010): median 66 days, range 18–254, and a missed day doesn't derail habit formation.
- **Pomodoro:** Biwer et al. (2023, n=87): fixed breaks led to less fatigue and better concentration, with similar task completion. Evidence is weak to preliminary.

**Design implications:**
- One scenario of about 3–6 minutes by default, with an optional fixed-interval timer.
- Save after every step.
- No more than about 30–40 seconds of passive narration without a decision.
- Onboard with an if-then plan, and frame habit-building as about 2 months.
- Tease the consequence up front.

## 5. Gamification

- **Sailer & Homner (2020, *Educational Psychology Review*):**
  - cognitive g = .49 (holds up in rigorous studies);
  - motivational .36;
  - behavioral .25;
  - game fiction and social interaction act as moderators.
- **Hanus & Fox (2015):** badges plus a leaderboard lowered intrinsic motivation and exam scores (intact classes, so causality is weak).
- **Deci, Koestner & Ryan (1999, 128 studies):** expected tangible rewards undermine intrinsic motivation (d ≈ −.28 to −.40). Informational feedback doesn't. Self-determination theory: autonomy, competence, relatedness.
- **Duolingo streaks:** the evidence is internal and correlational. There is no peer-reviewed evidence that streaks improve learning.

**Design implications:**
- Scores show competence: a mastery map and calibration.
- The learner chooses domain, difficulty, persona and session length.
- Weekly targets with rest days.
- Narrative over points: a recurring apprentice who improves because *you* corrected them.

## 6. AI tutors

- **Bastani et al. (2025, *PNAS* 122(26), ~1,000 high-school students):** unrestricted GPT-4 gave +48% on practice and then −17% on the exam. A guardrailed tutor gave +127% on practice and largely avoided the harm.
- **Kestin et al. (2025, *Scientific Reports* 15:17458, Harvard physics, n≈194):** an AI tutor built on active-learning principles beat in-class active learning. The "2×" figure is from the preprint.
- **Lehmann, Cornelius & Sting (arXiv 2409.09047):** using the AI as a substitute led to shallower understanding; using it as a complement helped.
- **Fan et al. (2025, *BJET*):** "metacognitive laziness".
- **Tutor CoPilot (Wang et al. 2024):** +4 percentage points in mastery. **LearnLM/Eedi (2025 preprint):** comparable to human tutors under supervision.
- **Hallucination:** a real risk for certification content.

**Design implications:**
- The learner diagnoses first.
- Hints are staged: area of the step, then principle, then answer.
- Generate from a curated knowledge base with citations.
- Make grading inspectable, and let the learner dispute a grade.
- Run occasional closed-book recall checks.

## Five anti-patterns

1. Putting complete novices into hidden-error scenarios.
2. Letting the AI do the thinking.
3. Controlling extrinsic rewards, required leaderboards and badges, or punishing streaks.
4. Long passive narration and cramming.
5. Ungrounded, unreviewable AI content. Also, penalizing false alarms so hard that learners stop taking the risk of stopping.

## Sources

- Große & Renkl (2007), *Learning and Instruction* 17(6). https://mrbartonmaths.com/resourcesnew/8.%20Research/Explicit%20Instruction/Worked%20examples%20with%20mistakes.pdf
- Renkl (2014), *Cognitive Science*. https://onlinelibrary.wiley.com/doi/10.1111/cogs.12086
- Adams, McLaren et al. (2012), *Computers & Education*. https://dfki.de/web/forschung/projekte-publikationen/publikation/8598 · https://hcii.cmu.edu/project/adapterrex
- Booth et al. (2013), *Learning and Instruction* 25. https://ies.ed.gov/funding/grantsearch/details.asp?ID=906
- Sinha & Kapur (2021), *RER* 91(5). https://janfasen.nl/wp-content/uploads/2023/05/Sinha-and-Kapur-PS-I.pdf
- Ohlsson (1996), *Psychological Review* 103(2). Metcalfe (2017), *Annual Review of Psychology* 68.
- Dunlosky et al. (2013), *PSPI* 14(1). Roediger & Karpicke (2006), *Psychological Science* 17(3).
- Rowland (2014), *Psychological Bulletin* 140(6). https://courseware.epfl.ch/assets/courseware/v1/fdde2f0aa590bf3b1324077a6bf1540c/asset-v1%3AEPFL%2BDEMO%2B2020%2Btype%40asset%2Bblock/Rowland2014-meta-analysis.pdf
- Adesope et al. (2017), *RER* 87(3). https://journals.sagepub.com/doi/10.3102/0034654316689306
- Bisra et al. (2018), *Educational Psychology Review*. https://www.Gwern.net/doc/psychology/spaced-repetition/2018-bisra.pdf
- Chi et al. (1989), *Cognitive Science* 13; Chi et al. (1994), *Cognitive Science* 18.
- Cepeda et al. (2008), *Psychological Science* 19(11). https://pubmed.ncbi.nlm.nih.gov/19076480/
- Brunmair & Richter (2019), *Psychological Bulletin*. https://www.psychologie.uni-wuerzburg.de/fileadmin/06020400/2019/Brunmair_Richter_in_press__2019_META-ANALYSIS_OF_INTERLEAVED_LEARNING.pdf
- Collins, Brown & Newman (1989). Schank, Berman & Macpherson (1999). Kolodner (1997), *American Psychologist* 52(1).
- Gentner, Loewenstein & Thompson (2003), *Journal of Educational Psychology* 95(2).
- PMP July 2026 update (third-party summaries): https://www.pmtraining.com/about/pmp-exam-update-july-2026 · https://www.pocketprep.com/posts/2026-pmp-exam-business-environment-domain/
- Szpunar, Khan & Schacter (2013), *PNAS* 110. https://pmc.ncbi.nlm.nih.gov/articles/PMC3631699/ · Welhaf et al. (2022): https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8964911/
- Simon-Dack et al. (2014), *Journal of Attention Disorders*. https://journals.sagepub.com/doi/10.1177/1087054714543369
- Loewenstein (1994), *Psychological Bulletin* 116(1). Kang et al. (2009): https://authors.library.caltech.edu/records/9f1n0-x0z52 · Gruber et al. (2014): https://pmc.ncbi.nlm.nih.gov/articles/PMC4252494/
- Gollwitzer & Sheeran (2006). https://www.socmot.uni-konstanz.de/publications/implementation-intentions-and-goal-achievement-meta-analysis-effects-and-processes
- Lally et al. (2010), *European Journal of Social Psychology* 40(6). https://www.surrey.ac.uk/news/does-it-really-take-66-days-form-habit-we-asked-expert-dr-pippa-lally
- Biwer et al. (2023), *British Journal of Educational Psychology* 93. https://pubmed.ncbi.nlm.nih.gov/36859717/
- Sailer & Homner (2020), *Educational Psychology Review* 32. https://epub.ub.uni-muenchen.de/88490
- Hanus & Fox (2015), *Computers & Education* 80. https://www.smhp.psych.ucla.edu/pdfdocs/gamil.pdf
- Deci, Koestner & Ryan (1999), *Psychological Bulletin* 125(6). https://home.ubalt.edu/ntygmitc/642/Articles%20syllabus/Deci%20Koestner%20Ryan%20meta%20IM%20psy%20bull%2099.pdf
- Duolingo on streaks (company sources): https://blog.duolingo.com/how-duolingo-streak-builds-habit · https://making.duolingo.com/how-streaks-keep-duolingo-learners-committed-to-their-language-goals
- Bastani et al. (2025), *PNAS* 122(26). https://papers.ssrn.com/abstract=4895486
- Kestin et al. (2025), *Scientific Reports* 15. https://pmc.ncbi.nlm.nih.gov/articles/PMC12179260/
- Lehmann, Cornelius & Sting (2025). https://arxiv.org/abs/2409.09047v2
- Fan et al. (2025), *BJET* 56(2). https://arxiv.org/abs/2412.09315v1
- Tutor CoPilot (2024): https://nssa.stanford.edu/studies/tutor-copilot-human-ai-approach-scaling-real-time-expertise · LearnLM/Eedi (2025): https://arxiv.org/abs/2512.23633

## Caveats

- Error-example evidence comes mainly from school maths.
- No ADHD-specific trials were found.
- PMP outline facts come from prep-provider pages.
- The Kestin "2×" figure was not confirmed in the published paper.
- Gollwitzer & Sheeran, Metcalfe and the Booth details are from secondary sources only.
