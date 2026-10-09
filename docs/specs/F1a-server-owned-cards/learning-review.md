# F1a learning review: grader and results failure states (OI-11) and run-end copy (OI-9)

**Reviewer:** learning-designer · **Date:** 2026-10-09 · **Spec reviewed:** `spec.md` (Draft) · **Status:** advice to the PM; the PM decides product questions, the architect decides contract questions.

**Scope.** F1a is a refactor frozen by golden replay. I reviewed only what the PM asked about: US2 (grader unreachable, Try again / Skip), US3 (results unreachable), their rows in the spoken/displayed copy table, the scoring consequence of Skip raised in ADR 0004, and OI-9. Everything else in the learning flow is pre-existing and out of scope. Bigger ideas are listed under "Later".

**Cost to the golden replay.** Both failure states are already allow-listed diffs ("grade request aborted", "complete request aborted"). Changing their copy, or what the results screen of those runs shows, adds **no** new golden diff. Findings 1–4 fit inside the existing allow-list. Finding 5 (OI-9) would add a third diff, and I recommend against doing it in F1a.

**Evidence caveat.** No study looks at "infrastructure failure during an error-detection game". The findings below apply general feedback research (mostly lab, school and university settings) to this case. Each finding states how strong its evidence is.

---

## Summary of findings

| # | Finding | Severity for learning | Fits F1a without new golden diffs? |
|---|---|---|---|
| 1 | Skip after a failed STOP turns a mistake the learner **caught** into a "missed" one: full penalty, possibly "Someone got hurt", and a spoken "what happened next" for it. This is unfair, and it gives the learner false feedback. | High (rare, but wrong when it happens) | Yes |
| 2 | Skip leaves **no trace in the event log**, so F2 mastery and FSRS, and the F3 catch-rate metric, will count a caught mistake as missed. This can't be fixed after the fact. | High for the evidence base | Yes (contract addition, architect's call) |
| 3 | The grader-unreachable copy doesn't say the answer is kept or what Skip costs | Medium | Yes |
| 4 | The results-unreachable copy leads with a partial score instead of the reason to retry (what you missed, and the fix). "Run another job" can lose that reveal for good. | Medium | Yes |
| 5 | OI-9: the run-end mismatch between voice and screen | Low in F1. **Waiting for F2 is acceptable**, under conditions. | n/a (defer) |
| 6 | Minor: a 4xx error makes Try again a dead end; repeated failures repeat the full spoken sentence | Low | Yes |

---

## 1. Skip scores a caught mistake as missed (ADR 0004 consequence)

**Issue.** Under ADR 0004, Skip resumes narration "without recording the STOP", so a mistake at that step "is scored as missed at run end". Consider a learner who stops on line 3 at the right moment and says the right thing, and then the network fails:
- they get `missedPenalty` (critical −300, `shared/scoring.js:17`) instead of up to +300;
- the rating becomes "Someone got hurt" (`missedCritical`);
- the run-end voice says "Here's what happened next. {consequence}" for a hazard they **did** stop;
- the results list shows it as "{severity} · missed".

**Is it fair? No.** The failure is ours, not the learner's, and it only ever costs them. Skipping a STOP on a clean step quietly avoids −75, but skipping on a real mistake costs up to 600 points of swing plus the worst rating. The run-end screen also states something false about what they did ("missed").

**Evidence and strength.**
- *Feedback has to be accurate and informational to support competence.* Deci, Koestner & Ryan (1999): informational feedback supports intrinsic motivation, controlling or punishing feedback undermines it (`learning-science.md` §5; strong meta-analysis, but about rewards, so applying it here is an extrapolation). Kluger & DeNisi (1996, *Psychological Bulletin*, 607 effect sizes): about a third of feedback interventions *lowered* performance, especially feedback that points at the self rather than the task. This source is new and cited from memory, not checked in this review. The meta-analysis is strong, but the link to this case is inferred.
- *Grading must be inspectable and disputable* (`learning-science.md` §6 design implications; anti-pattern 5). Telling a learner "missed" when they caught it is exactly the kind of grade they would want to dispute, and in F1 they can't.
- *Learner trust in the grader* is what makes the feedback usable as corrective feedback (Metcalfe 2017, secondary summary only; moderate).
- Strength overall: **moderate**. The principle is well supported; how big the harm is in this rare case is inferred.

**Risk to learning.**
1. A focus-challenged learner who has just made a correct, effortful catch is told they failed, by a dramatic consequence line. That is the most demotivating moment the game can produce, and it is undeserved.
2. They learn the wrong lesson ("I must have been wrong about that"), which weakens a correct schema.
3. They come to distrust the grade in general.

**Likelihood.** Low in F1 (one learner, local server), but not zero: the 12 s client timeout and any server restart both trigger it.

**Suggested change (two options; the PM picks, the architect rules on the contract).**

**Option B (recommended): tell the server what was skipped, and score it as "not graded".**
- `complete` accepts an optional `skippedStepIds: [int]`, the stepIds whose STOP the learner skipped after a failure. The browser knows these locally, and none of them carries an answer, so inv. 2 holds.
- The server records them (see finding 2). For each skipped stepId that has no graded STOP, it marks the mistake that `resolveStop` would have credited (same step, or one step back within `graceSteps`, not already caught) as **not graded**. A not-graded mistake gets no missed penalty, isn't counted in `maxPossible` or `missedCritical`, and appears in `missed[]` with `notGraded: true`.
- The learner still sees its summary, consequence and "Should have:" on the results screen. **Keep that reveal**: they still get the corrective feedback (the three-part rubric), just without a verdict.
- *Abuse:* a client could claim a skip it never made. With one learner, and Skip offered only after a failed request, I judge this acceptable. The event makes such claims auditable.
- *Edge case already in the spec:* if the STOP did reach the server and its response was lost, the server's graded STOP stands and the skip claim is ignored. That matches "server truth".

**Option A (minimum, if B is declined): honest copy only; browser-local labelling.**
- Server scoring is unchanged (missed penalty applies), but the learner is told the truth twice. First at Skip time, by the copy in finding 3 (variant A). Then on the results screen: the browser knows its skipped stepIds. For any `missed[]` item whose `stepId` is the skipped step or one step before it, it shows the label "{severity} · not graded (grader unreachable) · {points} pts" instead of "missed".
- When choosing the spoken "Here's what happened next" item, it picks from the truly missed items only.
- This needs no contract change. The rating stays penalized, which is still unfair, but at least it isn't a lie.

**Either way, the spec must state the consequence** (ADR 0004 asks for this). Add it to the US2 Skip scenario and the Edge cases list.

**Draft results copy (Option B; also usable for A's label).** These are engine strings, subject-agnostic, built once and both displayed and spoken (FR-033):

| Moment | Displayed (exact) | Spoken in voice mode (exact) |
|---|---|---|
| Missed-list item, not graded | "{severity} · not graded", "**{summary}.** {consequence}", "Should have: {correctAction}" | — (list items aren't spoken today) |
| Run end, extra line when ≥1 STOP was skipped | "{n} stop wasn't graded, so it isn't in your score." / "{n} stops weren't graded, so they aren't in your score." | identical, spoken after the existing run-end line |
| Run end, nothing truly missed but ≥1 not graded | (existing: no run-end line displayed, see OI-9) | Speak only the extra line above. Do **not** speak the pack's clean-run line, because the run wasn't verifiably clean. |

(Option A wording for the extra line: "{n} stop wasn't graded, so it counted as missed.")

---

## 2. Skip is invisible to the event log, so F2 and F3 will count a catch as a miss

**Issue.** With Skip unrecorded, the `completed` event's `missedStepIds` will include a mistake the learner caught. In F2, `data-and-evidence.md` maps missed → FSRS **Again**, and the mastery projection reads these events. The F3 voice-vs-text A/B uses **catch rate** as a primary metric (`voice-first.md` §6). Inv. 6 says projections must be rebuildable from the log, but no projection can ever tell this "missed" apart from a real one, because the learner's action (Skip after a failed STOP) was never written down.

**Evidence and strength.** This is not about learning research; it follows from the spec's own design (`data-and-evidence.md` FSRS mapping, D7 and inv. 6). Strength: **verified** from the docs.

**Risk.**
- *Learning:* a wrongly scheduled "Again" pushes a concept the learner already knows back into review. That costs session time, which matters with 3–6-minute sessions.
- *Evidence:* it biases catch rate downward, and it is not random. It would be worse in whichever mode or network setting fails more, which skews the voice/text comparison.
- *Likelihood:* L in F1. *Impact:* M, because it is permanent: events can't be corrected later, and events written in F1a are the first learner history F2 will read.

**Suggested change.** If Option B is taken, record the skip in the log. Either `completed.result.skippedStepIds`, or a `stop-skipped` event (`object.step`, `result.reason: "grader-unreachable"`) written on `complete`. The exact shape is the architect's call (event schema ADR 0002). If Option B is declined, put it under the F2 learner-model spec as a known gap, and have F1a at least add `skippedStepIds` to `completed.result` (unused in F1a) so the history is recoverable. This is a small, additive contract field; the architect decides whether it fits F1a.

---

## 3. Grader-unreachable copy: say the answer is kept, and say what Skip costs

**Issue.** The current copy is "Couldn't reach the grader. Try again or skip." It is short, plain and blame-free, which is good. But:
- a voice-mode learner looking away doesn't know their explanation survived;
- nothing says what Skip does, so a learner who thinks "skip = keep my catch, move on" gets the surprise from finding 1;
- the button reads "Skip", which could mean skipping the step, the job or the grade.

**Evidence and strength.**
- `voice-first.md` §1: the session should be understandable without looking.
- Self-determination theory (autonomy needs an informed choice) is a **strong** theory. Applying it to button copy is **inferred**.
- Keeping spoken prompts short serves focus (`learning-science.md` §4: no long passive narration). That principle is **moderate**; the word counts I propose are judgment.

**Risk to learning.** An uninformed Skip leads to the unfair outcome in finding 1. Retyping the explanation because they think it's lost wastes the learner's effort and attention.

**Suggested exact copy.** This replaces the US2 row in the copy table and the US2 scenario 1 string. It is still one sentence set, built once, displayed and spoken identically; about 5 seconds at rate 1.05.

| Variant | Displayed and spoken (exact) | Buttons |
|---|---|---|
| With Option B | "Couldn't reach the grader. Your answer is still here. Try again, or skip and this stop won't be scored." | "Try again" (focused) · "Skip this stop" |
| With Option A | "Couldn't reach the grader. Your answer is still here. Try again, or skip and any mistake here counts as missed." | "Try again" (focused) · "Skip this stop" |

Keep focus on "Try again". It is the option that preserves the learner's thinking, and the server's same-`stepId` idempotency makes it safe.

---

## 4. Results-unreachable copy: lead with the reason to retry, not a partial score

**Issue.** The current copy is "Couldn't load your results. Your score so far is {total}." Two problems:
- `{total}` is the sum of STOP points only. It leaves out missed penalties, so it can be very different from the real result. In US3's own example, 270 could become −30 after a missed critical. A retry that turns 270 into −30 feels like a bait-and-switch.
- The copy puts points first. The results screen's learning value is the **reveal of missed mistakes with "what happened next" and "Should have"**, which is the corrective feedback and the curiosity payoff (`user-flow.md` §6). If the learner presses "Run another job" instead, F1a has no way to show that reveal again (no read route until F2), and the misses lose their correction.

**Evidence and strength.**
- Corrective feedback after errors is what makes error experiences productive (Metcalfe 2017, secondary only, moderate).
- Butler & Roediger (2008, *Memory & Cognition*): feedback after testing improves retention compared with testing alone. This source is new and cited from memory, not checked here; it is moderate–strong, from lab studies with general-knowledge material.
- Curiosity payoff: Gruber et al. 2014 (`learning-science.md` §4; moderate).
- Scores should inform about competence, not about points (`learning-science.md` §5, principle 8).

**Risk to learning.** The learner leaves the run without seeing what they missed or the fix. That is the single most valuable feedback in a run they got wrong.

**Suggested exact copy.** Displayed and spoken identically; focus on "Retry results"; "Run another job" stays visible (autonomy).

| Displayed and spoken (exact) | Buttons |
|---|---|
| "Couldn't load your results yet. Retry to see what you missed and the right way to do it." | "Retry results" (focused) · "Run another job" |

If the PM wants to keep a number: "Couldn't load your results yet. Points from your stops so far: {total}. Retry to see what you missed." This is accurate about what the number is, but longer. I prefer the version without it.

---

## 5. OI-9: is waiting until F2 acceptable? Yes, with conditions

**The gap.** In voice mode, a perfect run speaks "Clean job. Nobody got hurt." but doesn't display it. A run with misses speaks only "Here's what happened next. {worst consequence}", while the screen shows each miss as summary, consequence and "Should have".

**Learning assessment.**
- **Clean-run line:** low learning cost. A text-mode learner still sees the rating ("Journeyman eyes"), which carries the same competence signal. The spoken line is a motivational flourish, not information.
- **Consequence line:** a real but small learning gap. The spoken run end gives the *consequence* but not *what the mistake was* or *the fix*. Two of the three parts of the feedback rubric are only on screen. For a truly hands-free learner that would matter. **In F1 it doesn't**, because voice mode still needs buttons to stop, submit and continue (spec glossary; hotword and voice commands are F2). So the learner is looking at the screen when the results appear, and the full three-part information is there.
- Inv. 9 matters here mainly for trust and accessibility. The learning effect of exact spoken/displayed parity for short feedback is not well established. The nearby evidence is Mayer's redundancy principle, from multimedia lessons with graphics, and it points the *other* way for long text. Strength: weak/indirect.
- A refactor's golden replay is worth more than this fix right now. A third allow-listed diff weakens the safety net that proves F1a changed nothing.

**Verdict: deferring to F2 is acceptable from a learning standpoint, provided that:**
1. The F2 Results-screen spec carries it as an acceptance criterion. For each spoken miss, voice mode speaks the **summary and the fix** as well as the consequence. Draft: "Here's what happened next. {consequence} The mistake: {summary}. Should have: {correctAction}." The clean-run line is displayed too.
2. F2 must fix it before hands-free play (hotword, auto-continue) ships, because that is when the screen stops being a backstop.
3. F1a's *new* strings (findings 1, 3 and 4) don't repeat the gap. FR-033 already requires this; keep it.

---

## 6. Minor

- **4xx makes Try again a dead end.** FR-031 shows the grader-unreachable panel on a 4xx too, but a 400 or 409 will fail the same way every time, so the learner loops. Suggested change: on a 4xx, or on the second consecutive failure of any kind, move focus to "Skip this stop". The copy stays the same. This saves a focus-challenged learner from a frustrating loop. Evidence: inferred.
- **Repeated failures repeat the full sentence** (US2 scenario 5). Acceptable for F1. If the PM wants it shorter, on repeat showings only: "Still can't reach the grader. Try again, or skip this stop." (variant B). Displayed and spoken identically.
- **The word "Skip" should keep one meaning.** `voice-first.md` §2 plans the F2 voice command "skip" for "not sure, move on without a grade". The F1a button means the same thing ("move on, this stop isn't graded"), which is good. Keep that meaning in F2; don't reuse "skip" for "skip the step".

---

## Draft thread entries (not appended; the lead asked me to edit only this file)

For the PM to append to the F1a spec-review thread, or to ask me to append:

```markdown
### learning-designer · 2026-10-09 · RISK
Skip after "Couldn't reach the grader" scores a caught mistake as missed (ADR 0004): full penalty, possibly "Someone got hurt", and a spoken consequence for a hazard the learner did stop.
Likelihood L · Impact H on that run (false feedback, demotivation), M on data (FSRS "Again", catch-rate bias, permanent in the log) · Mitigation: `complete` takes `skippedStepIds`; the server scores those mistakes "not graded" and logs the skip (learning-review.md findings 1–2, Option B). Minimum: honest copy plus a browser-side "not graded" label (Option A).

### learning-designer · 2026-10-09 · CHALLENGE
"Couldn't load your results. Your score so far is {total}." The total leaves out missed penalties and puts points ahead of the corrective reveal. Proposed: "Couldn't load your results yet. Retry to see what you missed and the right way to do it." (finding 4)

### learning-designer · 2026-10-09 · POSITION
**Answering:** OI-9. Deferring to F2 is acceptable: in F1, voice mode still needs the screen, and the full three-part feedback is displayed. Conditions: an F2 acceptance criterion, a fix before hands-free play ships, and no repeat of the gap in new F1a strings.
**Confidence:** medium
**What would change my mind:** evidence that the founder plays F1 without looking at the screen.
```

---

## Later (for the PM; not F1a)

- Offline or retry queue for explanations, so Skip becomes "graded when back online" (ADR 0004 future; `system-architecture.md` §5). This removes finding 1 at its root.
- A "Still grading…" spoken cue or earcon at about 4 s, so the 12 s wait before a failure isn't silent in voice mode (F2 earcons).
- "Clean job" is spoken even after several false alarms, while the rating may say "Back to the classroom". That is a mixed message; reconcile it in the F2 Results screen.
- A way to dispute a grade (🚩, `user-flow.md` §6), which also covers "I was marked missed but I caught it".
