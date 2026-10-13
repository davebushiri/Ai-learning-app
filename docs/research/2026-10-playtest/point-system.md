<!-- Research commissioned by the founder on 2026-10-13 (thread 0006). Written by the learning-designer; saved by the lead. -->

## Point system review: research and 9 ranked improvements

I didn't edit any files. If you want this kept, the PM can ask me to save it as `docs/specs/F2-*/learning-review.md` and add a thread entry.

### What the current rules reward (`shared/scoring.js`)
- **Lateness is counted in steps, not seconds** (`latenessMultiplier [1, 0.5]`, line 10). The game rewards noticing at the right moment, not fast reactions. That is the right call for focus, so keep it.
- **Reasoning is a small part of the score.** `reasoningFloor: 0.5` (line 12) means a perfect explanation only doubles the points of an empty one. Yet "explain why" is the core learning move (self-explanation g = .55, `learning-science.md` §2).
- **The false-alarm penalty is about right.** With −75 and an average reasoning score, stopping on a minor mistake pays off once the learner is about 43% sure. For a critical one it pays off at about 13% sure. This avoids anti-pattern 5 (learners afraid to stop). Don't raise it.
- **Latent bug:** `rate()` (line 75) gives "Back to the classroom" when `maxPossible` is 0. A clean, silent run on a zero-mistake card, which the F2 ladder needs, would be rated as the worst tier. All three demo scenarios have 3 mistakes, so nothing shows the bug today.
- The tier names are a single label for the whole run, and "Back to the classroom" judges the person more than the task (`packs/demo-trades/pack.json:12`).

### Evidence, with strength
- **Sailer & Homner 2020** (Educational Psychology Review, meta-analysis): cognitive g = .49, which held up in rigorous studies. Motivational (.36) and behavioral (.25) effects were less stable. Game fiction and competition combined with collaboration helped behavioral outcomes. **Strong overall; weak on which single elements work.**
- **Bai, Hew & Huang 2020** (24 studies): g = .50 on achievement, with **no significant difference by element type or number of elements**. I couldn't confirm the journal from the search. **Moderate.** Together: gamification helps a little, and no element has been shown to beat the others for learning.
- **Mekler et al. 2017** (Computers in Human Behavior, experiment): points, levels and leaderboards raised output **quantity** but not intrinsic motivation or competence. **Moderate, and the task was not a learning task.**
- **Deci, Koestner & Ryan 1999** (128 studies): expected rewards that control undermine motivation; informational feedback doesn't. **Strong.** **Butler 1987/88**: comments alone beat grades, and grades plus comments did no better than grades. **Moderate; school children; I only checked secondary sources.** For us: a big number next to feedback can drown out the feedback.
- **Hanus & Fox 2015**: badges plus a leaderboard lowered motivation and exam scores. **Weak causality.** Reviews of leaderboards are mixed. Harm runs through social comparison (low achievers disengage). **Moderate.**
- **Hamari 2017**: badges increased activity in a marketplace. That is engagement, not learning, and the design was not randomized. **Weak for us.**
- **Streaks:** Duolingo's freeze and Weekend Amulet figures (+4% one-week return) are secondhand, from internal A/B tests. **Weak.** Lally 2010: one missed day doesn't derail a habit. **Moderate.**
- **Near-miss:** Clark et al. 2009 (Neuron, n = 15): near-misses make people want to keep playing because they recruit reward circuitry. This is a **warning** against designing near-misses for compulsion. **Moderate.**
- **Focus:** there are no ADHD-specific trials. Szpunar 2013 (frequent tests reduce mind-wandering) is **moderate**. Applying it to point design is inferred. Keep everything focus-friendly; make no medical claims.

### Ranked improvements (evidence first, then effort)

**1. Make the points explain themselves.** Evidence: strong (informational feedback). Effort: tiny.
- Show something like "Major 200 · on time ×1 · reasoning 3/4 ×0.88 = 175", plus one line on the weakest rubric part.
- This changes no scoring, but under invariant 9 the line must also be spoken (or be clearly labelled as display-only detail).
- **F1a Wave 2 only if** the architect confirms the golden replay doesn't cover feedback copy. Otherwise F2.

**2. Reasoning bonus with visible rubric parts (what / why / fix).**
- Score each part, show each one ticked or missing, and lower the reasoning floor, e.g. 0.5 → 0.25. That shifts weight from "stopped" to "understood".
- Evidence: self-explanation strong; three-part grading is already in `learning-science.md` §2. Effort: medium (scoring change, grader schema, simulate re-balance).
- **F2.**

**3. A mastery meter per competency becomes the headline; raw points become secondary.**
- The Elo plan is already in `data-and-evidence.md`. At run end, say "Lockout/tagout: 1120 → 1165" before the total.
- Evidence: strong (SDT competence; Sailer & Homner say no element beats another, so lead with the one that means competence). Effort: medium, and already planned.
- **F2.**

**4. Fix the rating for zero-mistake runs and make the tiers about the task.**
- Rate a run with no mistakes and no false alarms as "Clean read". Rename "Back to the classroom" to something about the task, e.g. "Missed the tells".
- Reconcile "Clean job" being spoken after false alarms (already in my F1a review's "Later" list).
- Evidence: Kluger & DeNisi (feedback aimed at the self can hurt; strong meta-analysis, cited from memory). The bug is verified from the code. Effort: small.
- **F2, and required before zero-mistake cards ship.**

**5. Weekly goals with rest days; no daily streak.**
- Show "2 of 4 sessions". A missed day costs nothing. Optionally, a one-tap "light week" that halves the goal.
- Evidence: moderate (Lally; implementation intentions). Streaks are weak, correlational evidence. Effort: small to medium.
- **F2/F3 (Habit screen, already planned in `user-flow.md` §7).**

**6. Informational "near miss" feedback.**
- For late catches and "right moment, wrong reason", say what was close and what the tell was: "You caught it one line late. The tell was 'didn't re-test'."
- **Never** use near-misses as a reason to replay, or to make it feel like you almost won.
- Evidence: corrective feedback moderate to strong (Butler & Roediger 2008); Clark 2009 is the warning. Effort: small (copy plus the step reference).
- **F2.**

**7. Personal best per competency, not per scenario.**
- A per-scenario best invites replaying the same story, which teaches memorization. That breaks the "new scenario" rule and pollutes the trained vs. held-out experiment.
- Compare against your own earlier self on a competency instead ("best catch rate at subtlety 2").
- Evidence: weak to moderate (self-referenced, mastery-goal feedback; inferred). Effort: small once mastery exists.
- **Later.**

**8. Catch streak or combo within a run: advise against a multiplier.**
- A multiplier makes one miss cost more and one false alarm cost even more, which pushes learners not to stop when unsure (anti-pattern 5). It also adds a pressure mechanic that works against focus.
- If the PM wants the feel of a combo, use a non-scoring acknowledgement ("3 clean reads in a row") that resets quietly.
- Evidence: no learning evidence for combos; the risk is inferred from loss aversion and the false-alarm analysis above. Effort: small.
- **Later, and only the non-scoring version.**

**9. Badges and leaderboards: no leaderboard. Badges only as informational milestones.**
- If ever: an opt-in, friends-only leaderboard showing *improvement*, not totals. A badge only for something like "first critical caught at subtlety 3".
- Evidence: moderate that comparison harms low achievers; weak that badges help learning. Effort: medium.
- **Later.** There is one learner for now, so the social design has nobody to test it on.

**Never add:** bonuses for reaction time in seconds. The step-based grace window already handles timing without turning the game into a speed test.

### Draft thread entries (not appended)
- **RISK:** `rate()` returns "Back to the classroom" when `maxPossible` = 0 · L now, H once zero-mistake cards ship · Impact M (false negative feedback on a correct run) · Mitigation: an F2 acceptance criterion and a test for "clean read".
- **CHALLENGE:** "reasoningFloor: 0.5" gives at least half the points for stopping with no explanation. Propose 0.25 with per-part rubric credit; re-check with `npm run simulate`.

Sources:
- [Sailer & Homner 2020](https://link.springer.com/article/10.1007/s10648-019-09498-w)
- [Bai et al. 2020 summary](https://www.gbl.uzh.ch/quartz/references/Bai-et-al.-(2020)), [HKU repository](https://repository.hku.hk/handle/10722/322936)
- [Mekler et al. 2017](https://glassmanlab.seas.harvard.edu/annotated_works/mekler17.pdf)
- [Hamari 2017](https://research.utu.fi/converis/portal/detail/Publication/27336812?lang=en_GB)
- [Leaderboard review (GaLA 2020)](https://trepo.tuni.fi/bitstream/10024/130150/1/GaLA_Conf_2020_paper_leaderboard.pdf)
- [Social comparison in gamified work](https://scholarspace.manoa.hawaii.edu/items/7e2be796-8a77-4ac2-bfe5-8b851f39af88/full)
- [Clark et al. 2009](https://pmc.ncbi.nlm.nih.gov/articles/PMC2658737/)
- [Butler (secondary summary)](https://blog.mathed.net/2011/08/rysk-butlers-effects-on-intrinsic.html)
- [Duolingo streak freeze (third-party)](https://duolingo.fandom.com/wiki/Shop/Streak_freeze), [A/B figures (secondary)](https://viblo.asia/p/duolingo-streak-vi-sao-nguoi-hoc-co-giu-chuoi-ymJXDZ0qJkq)
- `docs/research/learning-science.md` §§2, 4, 5

Files read:
- /home/user/ai-learning-app/shared/scoring.js
- /home/user/ai-learning-app/packs/demo-trades/pack.json
- /home/user/ai-learning-app/web/app.js (lines 209–229)
- /home/user/ai-learning-app/docs/foundation/data-and-evidence.md
- /home/user/ai-learning-app/docs/foundation/user-flow.md
- /home/user/ai-learning-app/docs/specs/F1a-server-owned-cards/learning-review.md
