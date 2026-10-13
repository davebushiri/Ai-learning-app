<!-- Draft by learning-designer, 2026-10-13, at the founder's request (thread 0006). Paper-playtest content; becomes a pack after F1b. Advisory: the PM decides scope, a PMP-certified reviewer decides content correctness. -->

# PMP scenarios: draft for the paper playtest

**Status:** draft, not yet reviewed by a PMP-certified reviewer. Every `[REVIEWER CHECK]` must be resolved before any scenario is used beyond the founder's private network.

**What this is.** Ten original, text-only scenarios: nine with planted mistakes and one zero-mistake control. Testers read the narration, write down the step where they would say STOP, and explain why. The JSON files use the same shape as `docs/research/sample-scenarios/pmp-*.json`.

**What this is not.** These are not PMI exam items, and they don't copy or paraphrase any. Nothing here claims to raise exam scores. The evidence that learning from erroneous examples helps is real but small (meta-analysis g = 0.136; see `pmp-and-interview-prep.md` §1).

> Not affiliated with, endorsed by or sponsored by PMI. PMP and PMBOK are registered marks of the Project Management Institute, Inc.

**How to use this file.**
- **Paper version for testers:** copy §3 (the scenarios) and §4 (the playtest sheet). **Cut everything from §8 (the answer key) onward.**
- **Labellers:** use §5 (label sheet) together with §8.
- **PMP reviewer:** use §6 (checklist) together with §8.

| File | Case | Approach |
|---|---|---|
| `pmp-permit-form-01.json` | 1 | Predictive |
| `pmp-vendor-slip-01.json` | 2 | Predictive |
| `pmp-timezone-team-01.json` | 3 | Agile |
| `pmp-regulator-date-01.json` | 4 | Predictive |
| `pmp-control-sprint-review-01.json` | 5 | Agile (zero-mistake control) |
| `pmp-retro-voice-01.json` | 6 | Agile |
| `pmp-kiosk-risk-01.json` | 7 | Hybrid |
| `pmp-closure-benefits-01.json` | 8 | Predictive |
| `pmp-status-amber-01.json` | 9 | Hybrid |
| `pmp-connected-claims-01.json` | 10 | Hybrid (connected steps) |

**Validation.** Cases 1–4 and 6–10 were written to pass `validateScenario()` in `shared/contract.js`. I checked them by hand: 10–12 steps each; exactly one critical, one major and one minor mistake; none in steps 1–2 or on the last step; no two mistakes adjacent; at least 3 keywords per mistake; all fields within the length limits. I had no shell, so **nobody has run the function yet**. Case 5 **fails it by design**: see finding F3.

---

## 1. The design

### 1.1 Coverage table

The 27 planted mistakes plus the control, in playtest order. ECO = PMP Examination Content Outline 2026. The Process task numbers (2.x) are unverified; see `[REVIEWER CHECK]` G1.

| Case | Scenario | Step | Approach | ECO domain | ECO task | Competency | Mistake type | Severity | Design feature |
|---|---|---|---|---|---|---|---|---|---|
| 1 | permit-form | 6 | Predictive | Process | 2.7 Quality | C5 Quality | M5 Treats a symptom, skips the root cause | major | |
| 1 | permit-form | 8 | Predictive | Process | 2.2 Scope | C4 Scope & requirements | M7 Gold-plating | critical | |
| 1 | permit-form | 10 | Predictive | People | 1.4–1.6 Stakeholders | C3 Stakeholder engagement | M6 Surprises a stakeholder | minor | Delay (semi-passive) |
| 2 | vendor-slip | 4 | Predictive | Process | 2.8 Schedule | C7 Change control | M1 Acts before assessing | major | |
| 2 | vendor-slip | 6 | Predictive | Process | 2.5 Procurement | C7 Change control | M2 Bypasses change control | critical | |
| 2 | vendor-slip | 8 | Predictive | Process | 2.9 Project status | C3 Stakeholder engagement | M6 Surprises a stakeholder | minor | |
| 3 | timezone-team | 5 | Agile | People | 1.2 Conflict | C1 Conflict | M3 Escalates too early | minor | **Premature but reasonable** |
| 3 | timezone-team | 8 | Agile | People | 1.3 Lead the team | C2 Empowering the team | M4 Directs instead of empowering | major | |
| 3 | timezone-team | 10 | Agile | Process | 2.4 Resources | C8 Risk & compliance | M10 Ethics / compliance breach | critical | |
| 4 | regulator-date | 4 | Predictive | Business Env. | 3.8 External environment | C7 Change control | M1 Acts before assessing | minor | **Premature but reasonable** |
| 4 | regulator-date | 7 | Predictive | Business Env. | 3.3 Change control | C7 Change control | M2 Bypasses change control | major | |
| 4 | regulator-date | 9 | Predictive | Business Env. | 3.2 Compliance | C8 Risk & compliance | M10 Ethics / compliance breach | critical | |
| 5 | control-sprint-review | none | Agile | (People 1.2, 1.4–1.6; Process 2.2, 2.7 as distractors) | | C6, C3, C1 | none | none | **Zero-mistake control** |
| 6 | retro-voice | 4 | Agile | People | 1.2 Conflict | C1 Conflict | M3 Too late (nearest fit) | minor | **Passive** |
| 6 | retro-voice | 7 | Agile | People | 1.3 Lead the team | C2 Empowering the team | M4 Directs instead of empowering | major | |
| 6 | retro-voice | 9 | Agile | People | 1.3 Lead the team | C1 Conflict | M10 Ethics breach | critical | |
| 7 | kiosk-risk | 5 | Hybrid | Business Env. | 3.5 Risk | C8 Risk & compliance | M8 Risk with no owner or response | major | **Passive** |
| 7 | kiosk-risk | 7 | Hybrid | Business Env. | 3.2 Compliance | C8 Risk & compliance | M10 Compliance breach | critical | |
| 7 | kiosk-risk | 9 | Hybrid | People | 1.4–1.6 Stakeholders | C3 Stakeholder engagement | M6 Surprises a stakeholder | minor | **Passive** |
| 8 | closure-benefits | 5 | Predictive | Process | 2.3 Value (and 2.10 Closure) | C4 Scope & requirements | M8 No owner (nearest fit) | major | **Passive** |
| 8 | closure-benefits | 7 | Predictive | Process | 2.5 Procurement | C8 Risk & compliance | M10 Ethics breach (conflict of interest) | critical | |
| 8 | closure-benefits | 9 | Predictive | People | 1.8 Communication | C3 Stakeholder engagement | M6 Surprises a stakeholder | minor | |
| 9 | status-amber | 5 | Hybrid | People | 1.8 Communication | C3 Stakeholder engagement | M3 Escalates too early | minor | **Premature but reasonable** |
| 9 | status-amber | 7 | Hybrid | Process | 2.2 Scope | C6 Agile ceremonies & backlog | M9 Adds scope mid-sprint, bypassing the PO | major | |
| 9 | status-amber | 9 | Hybrid | Process | 2.9 Project status | C8 Risk & compliance | M10 Reporting breach | critical | |
| 10 | connected-claims | 6 | Hybrid | Business Env. | 3.5 Risk | C8 Risk & compliance | M3 Too late (planned response not triggered) | major | **Connected** (needs step 4), passive |
| 10 | connected-claims | 9 | Hybrid | Business Env. | 3.3 Change control | C7 Change control | M2 Bypasses change control | critical | **Connected** (needs step 3) |
| 10 | connected-claims | 11 | Hybrid | Process | 2.9 Project status | C3 Stakeholder engagement | M6 Surprises a stakeholder | minor | |

### 1.2 Balance against the exam outline

| | People | Process | Business Environment | Total |
|---|---|---|---|---|
| ECO weight | 33% | 41% | 26% | 100% |
| Planted mistakes | 9 (33%) | 11 (41%) | 7 (26%) | 27 |

**Tasks covered by a planted mistake:**
- **People:** 1.2, 1.3, 1.4–1.6, 1.8.
- **Process:** 2.2, 2.3, 2.4, 2.5, 2.7, 2.8, 2.9.
- **Business Environment:** 3.2, 3.3, 3.5, 3.8.

**Tasks touched only by correct steps:**
- 1.7 knowledge transfer (lessons learned in cases 1 and 8);
- 2.10 closure (case 8);
- 3.1 governance (case 9's correct action).

**Tasks not covered:** 1.1, 2.1, 2.6, 3.4, 3.6 and 3.7. With 10 scenarios this is expected, and they should be the first target for the next batch.

**Approach mix:**
- **By case:** 4 predictive, 3 agile, 3 hybrid, i.e. 40% predictive and 60% agile or hybrid, matching the ECO.
- **By mistake:** 12 of 27 (44%) are predictive and 15 (56%) agile or hybrid. The control is agile.

**Severity:** 9 critical, 9 major, 9 minor. The rules applied:
- **Critical** means an ethics, compliance or contract breach.
- **Major** means a baseline slip or rework.
- **Minor** means a communication habit.

### 1.3 Competencies and mistake types

| Competency | Items | | Mistake type | Items |
|---|---|---|---|---|
| C1 Conflict | 3 | | M1 Acts before assessing | 2 |
| C2 Empowering the team | 2 | | M2 Bypasses change control | 3 |
| C3 Stakeholder engagement | 6 | | M3 Escalates too early or too late | 4 |
| C4 Scope & requirements | 2 | | M4 Directs instead of empowering | 2 |
| C5 Quality | 1 | | M5 Symptom, not root cause | 1 |
| C6 Agile ceremonies & backlog | 1 (+ control) | | M6 Surprises a stakeholder | 5 |
| C7 Change control | 5 | | M7 Gold-plating | 1 |
| C8 Risk & compliance | 7 | | M8 Risk with no owner or response | 2 |
| | | | M9 Mid-sprint scope, bypassing the PO | 1 |
| | | | M10 Ethics, compliance or reporting breach | 6 |

All 8 competencies and all 10 mistake types appear at least once. The two existing samples (`docs/research/sample-scenarios/`) add C6 and C7 items. They are best used as a guided warm-up, not as playtest cases (see F2).

### 1.4 Required design features

| Requirement | Where |
|---|---|
| A passive error (doing nothing) | Case 7 step 5 (leaves a triggered risk until Thursday); also case 6 step 4, case 7 step 9, case 8 step 5 and case 10 step 6 |
| A "premature but reasonable" best-answer mistake | Case 4 step 4 (asks the sponsor for resources before assessing); also case 3 step 5 and case 9 step 5 |
| A zero-mistake control run | Case 5 (5 of its 10 steps are deliberately suspicious but correct) |
| 2 mistakes that only show when two steps are connected | Case 10: step 6 needs step 4 (risk trigger); step 9 needs step 3 (contract clause). Its third mistake (step 11) stands alone, because the validator requires exactly three mistakes. |
| The context decides the answer | Every case gives the approach, the roles, the narrator's authority and the governing rule (baseline, contract clause, policy or status rule) in steps 1–2, or in a step before the mistake. |
| Distractor steps | Each case has at least one correct step that sounds like a shortcut. They are listed per case in §8. |
| Narrator voice | First person, an assistant PM or a Scrum Master in training, with lines of about 15–25 words. |

---

## 2. Design findings and risks (most important first)

**F1. If the founder labels these answers, PMP stops being a clean "new subject" test for the founder.**
- **Issue.** Labelling means reading the answer key. That exposes the founder to all 10 mistake types with their correct actions before the trained vs. held-out split ever runs.
- **Evidence.** `data-and-evidence.md` §4 requires held-out mistake types to "appear only in probes". Single-case designs need untrained items to stay untrained (strength: design logic, not an empirical finding).
- **Risk to learning.** The headline metric (the trained vs. held-out gap of at least 20 points) would be biased toward zero for PMP. We could then wrongly conclude that the app doesn't teach.
- **Suggested change** (the founder and PM decide):
  - **(a)** The founder plays all 10 cases **blind, as a tester**, and never reads §8. The PMP reviewer plus one other experienced tester do the labelling. A blind play also works as an informal baseline.
  - **(b)** The founder labels, and we accept that the PMP evidence result is contaminated. The founder's "new subject" pilot then moves to a different subject.
  - I recommend **(a)**. If the founder must label something, label only another tester's rows for cases they have already played blind.

**F2. Novice testers meeting hidden-error cases.**
- **Issue.** Network testers with no PM background go straight into hidden-mistake cases.
- **Evidence.** Große & Renkl 2007: incorrect examples hurt far transfer for learners with little prior knowledge. Renkl 2014: weaker learners need errors flagged. Strength: moderate, and mostly from school maths, so applying it to adult PM is an extrapolation.
- **Risk.** Novices catch little, learn little, and their low catch rates look like bad items when the items are fine.
- **Suggested change** (already in §4):
  - an optional one-page primer with one worked example before Case 1;
  - an experience field on every sheet;
  - novices analysed separately from experienced testers.
- **Later (PM):** run the two existing samples first as *guided* cases, with the mistake steps highlighted.

**F3. The zero-mistake control can't pass the validator.**
- **Issue.** `validateScenario()` requires exactly one critical, one major and one minor mistake, so Case 5 returns "needs at least one mistake". Yet `user-flow.md` §4, `ai-flow.md` and `data-and-evidence.md` §1 (`clean_pass`) all plan for clean runs, and `point-system.md` reports a latent bug that scores a zero-mistake run as the worst tier.
- **Risk.** Without clean runs, learners learn that "every card has exactly three mistakes". They then stop on whatever looks like the third, and both false alarms and calibration lose their meaning.
- **Suggested change.** Paper-only for now. Before the pack lands, the architect and PM decide on a validator mode for clean runs (Later).

**F4. A predictable count of mistakes per card.**
- **Issue.** Every validated card has exactly three mistakes, one at each severity.
- **Risk.** Testers who notice can count to three instead of judging each step. Since every minor mistake is a communication habit, the type can also hint at the severity.
- **Suggested change.** The tester instructions never say how many mistakes a case has, and the control is in the middle of the set (Case 5). *Later:* allow 1–3 mistakes per card.

**F5. Item volume and balance are fine for checking items, but too thin for the evidence experiment.**
- **Issue.** C5 and C6 have 1 item each, as do M5, M7 and M9. M10 has 6, because the severity rule sends every critical mistake to ethics, compliance or contract.
- **Evidence.** Interleaving helps most when similar categories have to be told apart (Brunmair & Richter 2019, g = 0.42; moderate).
- **Risk.** These numbers can't support a trained/held-out split within each competency. Also, M10 lumps together two things learners need to tell apart.
- **Suggested change.** Treat this batch as item validation only. *Later (PM):*
  - split M10 into "dishonest reporting" and "breaks a law, policy or contract", which makes a useful look-alike pair;
  - write the next batch for C5, C6, M5, M7 and M9.

**F6. Taxonomy gaps.**
- **Issue.** Two mistakes fit no type, so I used the nearest one:
  - Case 6 step 4 (letting someone be talked over) is tagged M3;
  - Case 8 step 5 (no benefits owner) is tagged M8.

  The 8 competencies also don't name schedule, procurement, finance or closure, although Process is 41% of the exam.
- **Risk.** Mistake-type "blind spots" in the learner model would be mislabelled.
- **Suggested change** (*Later*, PM / Subject Builder): consider the types "avoids or mishandles conflict" and "delivers output, not outcome", and a Process competency for schedule and cost.

**F7. Tone cues.**
- **Issue.** Some mistakes carry a rationalisation ("since it's only an hour", "since the project's closing anyway").
- **What I did.** I added similar casual rationalisations to correct steps (Case 5 step 8 "I don't fill the time"; Case 6 step 5; Case 1 step 5), so the tone can't separate right from wrong.
- **Risk.** If the cues stay one-sided, learners catch the tone rather than the principle.
- **Suggested change.** The reviewer checks the balance (§6, item 7).

**F8. Session length.**
- **Detail.** Reading each case takes about 1 minute. Writing the answers brings it to 3–5 minutes. That fits the 3–6 minute target (`learning-science.md` §4; Szpunar et al. 2013, moderate).
- **Suggested change.** The instructions recommend two sittings of five cases, or one case a day. All ten in one go is about 40 minutes, which is too long for focus.

**F9. Labels and the eval set.**
- **Issue.** The E2 label format (thread 0003) was defined for the 32 adversarial grader cases. Playtest rows are a different set.
- **Who decides.** Whether they join `evals/sets/grader/` is the evals-engineer's call.
- **Suggested change.** Testers' free text may be reused in an eval set, so the sheet asks for consent to that and uses tester codes, not names.

---

## 3. The scenarios (tester version: no answers)

Each case is a short story told by an assistant. Steps are numbered as in the app.

### Case 1: The bonus feature on the permit form
*Predictive. A town council's online permit form. Requirements and the test plan are signed off.*

1. I'm Nia, assistant PM on a town council's new online permit form. The plan is predictive, with signed-off requirements and a test plan.
2. Ravi is the PM. Council policy says any outside service that handles residents' data needs a signed data-processing agreement first.
3. The build finished two days early. This morning the testers start acceptance testing against the signed requirements.
4. Testers log a date bug on the application screen. Dates typed day-first are read as month-first.
5. The same date bug turns up on the renewal and payment screens. I log both, linked to the first, so the pattern is visible.
6. To keep testers moving, I ask the developers to patch each screen as the bug shows up.
7. Ravi asks for a quality summary. I pull defect counts by severity and the pass rate against the acceptance criteria.
8. Since we're ahead, I ask the developers to add address lookup through a free online map service, as a bonus for residents.
9. I check that the accessibility tests cover screen readers, since the requirements name them.
10. Testing will now run two days past the plan. I'll mention it to the council's service manager at next week's go-live meeting.
11. I add date handling to the lessons-learned log, so the next project tests it early.

### Case 2: A vendor slips on a fixed-price contract
*Predictive. Fitting out a call centre for a water utility. The equipment vendor is on a fixed-price contract with dated milestones and a written change-order clause.*

1. I'm Alex, assistant PM on the call-centre fit-out. Grace is the PM. Our schedule and cost baselines were approved last month.
2. The equipment vendor is on a fixed-price contract. Any change to price or scope needs a written change order signed by both sides.
3. Victor, the vendor's account lead, calls. The headset and switch install will be two weeks late because a part is back-ordered.
4. I message the training lead straight away and ask her to push all the agent training sessions back two weeks to match.
5. I ask Victor to send a written recovery plan with the new dates, as the contract asks for when a milestone is late.
6. Victor offers to air-freight the part for an extra fee. I tell him yes, go ahead, and we'll sort out the paperwork afterwards.
7. I log the delay in the issue log with Victor's reason, the dates, and the contract clause, so the facts are clear later.
8. I put the vendor delay at the bottom of my weekly status email, under other notes, below the good news.
9. I book thirty minutes with Grace and the contracts officer to go through Victor's recovery plan and our options.
10. I add a risk for vendor supply problems, with Grace as owner, to be reviewed at every remaining milestone.

### Case 3: Two cities, one team
*Agile. A payments team split between Lisbon and Manila. The team sets its own working agreements, and company policy says overtime must be logged and approved.*

1. I'm Kofi, Scrum Master for a payments team. Four developers are in Lisbon, and three are in Manila, seven hours ahead.
2. Bea is the product owner. The team sets its own working agreements. Company policy says all overtime must be logged and approved.
3. Sprint review and planning both start at three in the afternoon, Lisbon time. That's ten at night in Manila.
4. Carlo, in Manila, messages me privately. He's exhausted, and he feels the Lisbon side doesn't care.
5. Before talking with the team, I email both line managers and ask them to settle the meeting times between them.
6. I ask Carlo for ten minutes to hear more, and thank him for telling me directly.
7. In a short call with everyone, I share a chart of working hours. There are only two hours a day when both cities overlap.
8. I write up a new meeting schedule myself and post it in the channel as the team's final working agreement.
9. I suggest we try recorded demos, so Manila can watch the review the next morning and add comments.
10. For this Friday, I ask the Manila developers to join the ten p.m. review anyway, and keep it off their timesheets since it's only an hour.
11. At the next retrospective, we'll check whether the new rhythm is working for both cities.

### Case 4: The regulator moves the deadline
*Predictive. New allergen labels at a food manufacturer. A change board decides changes to the baselines.*

1. I'm Theo, assistant PM on the allergen-label project at a food plant. Leah is the PM, and we run a predictive plan with approved baselines.
2. Changes to the baselines go to our change board: Leah, Marco from quality, and Nadia, our sponsor. I keep the schedule up to date.
3. News this morning: the regulator has brought its labelling deadline forward six weeks. Our current plan finishes four weeks after the new date.
4. Before anything else, I email Nadia and ask her to approve weekend overtime and two contract designers.
5. I read the regulator's notice in full, and confirm with Marco exactly which products and label details are affected.
6. The team and I list options: run artwork and printing in parallel, label the top sellers first, or add a second print supplier.
7. Running in parallel looks best, so I update the schedule baseline myself and send the new dates out to the team.
8. Leah asks me to log the label-printer delivery as a risk. I add it with Marco as owner and a backup supplier as the response.
9. The new printers will arrive a week after the deadline. I tell the plant to keep shipping with old labels that week and relabel stock later.
10. I prepare a one-page summary for the board: the new date, the options, costs, risks and my recommendation.
11. Once the board decides, I'll update the plan and brief the plant supervisors on the new order of work.

### Case 5: Sprint review at the food bank
*Agile. A volunteer-scheduling app for a food bank. The narrator is the Scrum Master, and the product owner owns the backlog.*

1. I'm Ben, Scrum Master for a small team building a volunteer-scheduling app for a food bank. Zara is our product owner.
2. It's sprint review day. Managers from three food bank sites are joining to see what we built and give feedback.
3. We won't demo the reminder texts. They didn't meet the definition of done, so I'll say so plainly and they go back to the backlog.
4. A site manager asks for a printable rota. I don't promise anything. I tell her Zara will look at it with her.
5. Zara adds the rota idea to the product backlog on the spot, and says she'll order it after hearing from the other sites.
6. A developer says the sign-up page feels slow. We don't try to fix it here; we note it to look into after the review.
7. Kemi, from the largest site, talks over the others. I let her finish her point, then ask the other two sites for their view.
8. We finish ten minutes early. I don't fill the time. I thank everyone and let them go.
9. I send a short summary: what we showed, what wasn't done and why, and the new backlog ideas.
10. Tomorrow is the retrospective. The team will pick one thing to improve, and I'll facilitate.

### Case 6: One loud voice in the retrospective
*Agile. A mobile banking team. The narrator is a Scrum Master in training. The team owns its working agreements.*

1. I'm Mina, Scrum Master in training on the mobile banking team. Six developers, two-week sprints, and Ade is our product owner.
2. Today is the sprint retrospective. The team owns its working agreements. My job is to facilitate, not to decide for them.
3. Ten minutes in, Raf, our most senior developer, has answered every question himself. Joy and Tam, our newest developers, haven't spoken.
4. Raf cuts Joy off mid-sentence. I let it go; I don't want things to get awkward in front of everyone.
5. I switch to silent, anonymous writing. Everyone adds sticky notes for five minutes before anyone speaks, then we group them.
6. Most notes say code reviews take three days. I ask the team why, and they spot that most pull requests are huge.
7. I settle the fix for them: from now on, Raf approves every pull request, so quality stays high.
8. I post the agreed actions on the team board, where everyone can see them during the sprint.
9. After the retro, Raf's line manager asks who wrote the note about being talked over. I tell her it was Joy.
10. I invite Raf for a private coffee to share what I saw in the meeting and hear his side.

### Case 7: The risk nobody owned
*Hybrid. Opening a new health clinic: the fit-out follows a fixed plan and the booking app is built in sprints. Patient data is covered by health privacy law.*

1. I'm Rosa, assistant PM for a new clinic opening. The fit-out follows a fixed plan, and the booking app is built in sprints.
2. Kwame is the PM, Ines is the product owner. We review the risk register on Thursdays, and every risk should have an owner.
3. The kiosk supplier emails: our check-in kiosks are held at customs, and they can't give a release date yet.
4. I check the register. Kiosk shipping delay is listed, but the owner is blank and the response just says monitor.
5. It's already on the register, so I leave it for Thursday's review and carry on with today's tasks.
6. The developers ask for help with test data. Their booking tests need realistic names, dates of birth and appointment reasons.
7. I export a copy of real patient records from the old system and put it on the team drive for testing.
8. I remind the team that the definition of done includes accessibility checks on every booking screen.
9. I don't mention the kiosks to Dr. Osei, the clinic manager, before Friday's review; she can hear it there with everyone.
10. At the review, Ines walks stakeholders through the new booking screens and asks for feedback on the waiting list.

### Case 8: Closing out, and the benefits nobody tracks
*Predictive. Replacing self-checkout machines in twelve city libraries. The project is in closure.*

1. I'm Lena, assistant PM on replacing the self-checkout machines in the city's twelve libraries. Marta is the PM, and the plan is predictive.
2. Every machine is in, and we're in closure. The business case promised shorter queues and freed-up staff time, measured over six months.
3. Marta asks me to put together the closure pack: acceptance, contract closeout, lessons learned, and the handover to operations.
4. I check every machine against the acceptance criteria. Two branches still have failing card readers, so I log them as open defects.
5. Benefits get measured after we close, by operations, so I leave benefits tracking out of the handover pack.
6. Procurement asks me to sit on the panel scoring bids for the five-year maintenance contract. Our installer is one of the bidders.
7. The installer's rep offers me two cup-final tickets as a thank-you. I accept, since the project's closing anyway.
8. I run a lessons-learned session with the branch staff and the installers, and file the notes where future projects can find them.
9. The old machines are collected on Monday. I'll let the removal crew tell each branch when they arrive.
10. I send Marta the closure pack to review before it goes to the sponsor for sign-off.

### Case 9: Paint it amber
*Hybrid. A finance system rollout: data migration follows a fixed plan and screen setup runs in sprints. The communication plan defines red, amber and green.*

1. I'm Ivy, assistant PM on a finance system rollout at a furniture maker. Data migration follows a fixed plan; screen setup runs in sprints.
2. Paul is the PM and Mei is the product owner. Our communication plan says status goes red if a milestone forecast slips over two weeks.
3. Paul is on leave this week. He's asked me to prepare Thursday's steering committee report, and to call him if anything big comes up.
4. Migration trial two failed overnight. Anna, the data lead, says about a third of supplier records didn't load.
5. I forward Anna's message straight to the whole steering committee, so nobody can say we hid anything.
6. Anna and I go through the logs. Supplier tax codes are in the wrong format. Fixing and re-running will move the milestone three weeks.
7. Mid-sprint, the finance director's deputy asks for a new cash-flow report. It's small, so I add it to the current sprint myself.
8. Gavin, the sponsor, calls. The board meets Friday, and he asks me to show the migration as amber this month, not red.
9. Gavin knows the board best, so I mark the migration amber and describe the failed trial as a minor delay.
10. I add the tax-code problem to the issue log with Anna as owner and a target date for the re-run.
11. When Paul is back, I'll walk him through what went to the committee and why, so nothing surprises him.

### Case 10: Two lines you have to connect
*Hybrid. An insurer's claims portal: regulatory reporting follows a fixed plan and the screens are built in sprints. Read the early steps carefully.*

1. I'm Omar, assistant PM on an insurer's new claims portal. Regulatory reporting follows a fixed plan, and the screens are built in sprints.
2. Hana is the PM, and Ines is the product owner. I coordinate the release plan and keep the risk and issue logs up to date.
3. A contract note I keep pinned: the client must approve in writing any change to the claim data fields, because their auditors rely on them.
4. Top line of the risk register: if the regulator's test gateway is down for over a day, Sofia, our integration lead, switches us to the backup route.
5. Sprint planning went well. The team set its own goal: claimants can upload photos and track their claim status.
6. Monday morning. The regulator's test gateway has been down since Saturday night. I'll try it again tomorrow; these outages usually clear.
7. Ines asks me to check the photo upload against the accessibility checklist before the sprint review. I book a slot with our tester.
8. In refinement, a developer suggests merging the two claim status fields into one, to make the tracking screen simpler.
9. Ines likes it and the team has room this sprint, so I tell them to go ahead and note it in the release log.
10. I update the burndown and flag that photo upload may not finish this sprint.
11. I post the at-risk note in the team channel. The client's claims lead isn't in that channel, but she'll see it in next month's report.
12. Before the review, I walk Hana through the open risks and the contract items we're tracking.

---

## 4. Paper-playtest sheet (give this to testers)

### Before you start (2 minutes)

You'll read ten short stories. In each one, an assistant on a project team tells you what they're doing, step by step. **Some steps are mistakes. Some cases have no mistakes at all.** We don't say how many.

Your job: **write the step number where you'd say "STOP!", and why.** Stop as soon as you notice something. You don't need to be precise to the exact line.

- Do one sitting of five cases (about 20 minutes), then take a break. One case a day is fine too.
- Don't look anything up. Your first honest answer is the useful one.
- Spelling doesn't matter. Write the way you'd talk.

**Optional primer: read this if you've never studied project management.**
A project manager working the way the exam expects usually:
- finds out the facts and the impact before acting;
- sends changes to an agreed plan through the agreed change process, rather than saying yes on the spot;
- solves problems at the lowest sensible level first, and escalates when something is beyond their authority;
- lets an agile team decide *how* to do its work, and lets the product owner decide *what* comes first;
- handles people problems calmly, and privately where possible;
- tells stakeholders bad news early and directly, through the channel they actually use;
- uses the risk plan when a risk happens, and makes sure every risk has an owner;
- never hides or softens the truth, and never bends a law, policy or contract to save time.

*Worked example (not one of the ten):*
> 1. I'm on a website project. Releases need the client's sign-off. 2. The developer says the new page is ready. **3. I publish it so the client can see it live.**

*STOP at step 3.* What's wrong: it was released without the client's sign-off. Why: step 1 says releases need sign-off, so this breaks the agreed rule. Instead: send the client a preview link and wait for their approval.

### About you (tick one in each row)

| | |
|---|---|
| Tester code (no names) | ________ |
| Project-management experience | ☐ none ☐ some, not certified ☐ studying for the PMP ☐ PMP certified |
| Read the primer? | ☐ yes ☐ no |
| Date / start time / end time | ________ |
| May we reuse your written answers, without your name, to test our automatic grader? | ☐ yes ☐ no |

### Your answers (one block per case)

```
Case __      □ I would NOT stop this one (no mistakes)

STOP at step __  What's wrong: ______________________________________
                 Why it matters: ____________________________________
                 What should happen instead: ________________________
                 How sure? □ guessing  □ fairly sure  □ sure

STOP at step __  What's wrong: ______________________________________
                 Why it matters: ____________________________________
                 What should happen instead: ________________________
                 How sure? □ guessing  □ fairly sure  □ sure

STOP at step __  (add more blocks if you need them)
```

**After each case (optional, one line):** Was anything confusing or unrealistic? ____________________

---

## 5. Label sheet (for the labellers; E2 format)

This uses the E2 label format from `docs/team/threads/0003-f1-engine-core-proposal.md` (evals-engineer, 2026-10-09):
`{id, goldVerdict, alsoAcceptable[], reasoningBand, feedbackMustNot?, unsure, labeller, date}`.

Columns added for the playtest are marked ★. One row per STOP a tester wrote.

| Column | What goes in it |
|---|---|
| `id` | `PT-<testerCode>-c<case>-<n>`, e.g. `PT-T03-c4-1` |
| `scenario` ★ | Scenario id, e.g. `pmp-regulator-date-01` |
| `stopStep` ★ | The step the tester wrote |
| `creditedStep` ★ | The planted step this STOP is credited to, using the rule below, or `none` |
| `learnerText` ★ | The tester's words **verbatim**, typos included. Join the three parts with " / ". |
| `confidence` ★ | guessing / fairly sure / sure |
| `goldVerdict` | `correct` · `partial` · `wrong` · `false_alarm` |
| `alsoAcceptable[]` | Any other verdict a fair grader could give, e.g. `["partial"]` |
| `reasoningBand` | `"0"` · `"0.2–0.4"` · `"0.7"` · `"1.0"` |
| `feedbackMustNot` | Optional. Something the feedback must not say, e.g. "must not credit the ship-with-old-labels idea". |
| `unsure` | `true` if you'd want a second opinion |
| `labeller` | Your initials |
| `date` | YYYY-MM-DD |
| `notes` ★ | Free text, e.g. "found a real flaw in a 'clean' step". Copy any such row to the reviewer. |

**Crediting rule.** This mirrors the app, where a STOP one line late still lands on the right mistake.
- A STOP on a planted step, or on the step right after it, is credited to that planted step.
- Any other STOP is `false_alarm`.
- In Case 5, every STOP is `false_alarm`.

**Verdicts.** These match the app's labels: Good catch / Close / Right moment, wrong reason / False alarm.
- `correct`: names the right problem **and** a valid reason. A fix is a bonus.
- `partial`: the right problem, but the reason is missing, vague, or only half right.
- `wrong`: the right moment, but the wrong reason.
- `false_alarm`: a STOP credited to no planted step.

**What isn't a row.**
- A planted mistake no tester stopped at is a **miss**. Count it in a tally per case and step. It isn't a label row, because there's no text to grade.
- A Case 5 sheet with "no stop" ticked is a **clean pass**. Tally it.

**Blind labelling.**
- Two labellers work independently: the PMP reviewer plus one other experienced person (see F1 on the founder).
- Neither sees the other's labels.
- Tester codes only, no names.
- Report agreement as raw percent and κ. Because the false_alarm rows follow mechanically from the crediting rule, report κ both with and without them (per the evals-engineer's RISK in 0003).

**Example rows.** These are made up for illustration, not real data.

| id | scenario | stopStep | creditedStep | learnerText | confidence | goldVerdict | alsoAcceptable | reasoningBand | unsure | labeller | date | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| PT-T01-c4-1 | pmp-regulator-date-01 | 7 | 7 | changed the baseline herself / only the change board can do that / send the option to the board | sure | correct | [] | 1.0 | false | AB | 2026-10-20 | |
| PT-T01-c4-2 | pmp-regulator-date-01 | 5 | 4 | shoud of read the notice first | fairly sure | partial | ["correct"] | 0.7 | true | AB | 2026-10-20 | one step late; reason right, no fix |
| PT-T02-c5-1 | pmp-control-sprint-review-01 | 3 | none | hiding unfinished work from stakeholders | sure | false_alarm | [] | 0 | false | AB | 2026-10-20 | distractor worked as intended |

---

## 6. Review checklist (for the PMP-certified reviewer)

Tick each item per case, and resolve every `[REVIEWER CHECK]` in §8 with a short note.

1. **The context decides the answer.** The approach, roles, authority and the governing rule are stated before the mistake, and the correct action follows from them, not from trivia.
2. **One action per mistake.** Each planted step contains one wrong move that a learner can name.
3. **Plausible.** Each mistake is something a real, well-meaning PM might do, not a strawman.
4. **The correct action is the PMI-preferred one,** consistent with the 2026 ECO mindset and the Scrum Guide 2020 accountabilities. Where two answers are defensible, note which comes *first* and why.
5. **Severity:**
   - critical = ethics, compliance or contract breach;
   - major = a baseline slip or rework;
   - minor = a communication habit.
6. **The clean steps really are clean,** especially the distractors listed per case and **every step of Case 5**. If you would STOP on any clean step, say so: that's a bug.
7. **No tone giveaways.** The wrong steps don't sound guiltier than the right ones.
8. **Case 10 is solvable from the text alone:** step 6 needs step 4, and step 9 needs step 3.
9. **Originality.** Nothing resembles a real or recalled exam question, PMBOK text, ECO enabler text or Lexicon definitions. Run a similarity search against brain-dump sites if you can.
10. **Terminology** is current: change board / change control, product owner, definition of done, risk owner and trigger, benefits owner.
11. **The consequences are realistic** and proportionate, not melodramatic.
12. **Sign-off:** "I've reviewed cases __ and approve them for private playtesting." Name, PMP number (optional), date.

---

## 7. Source key

The letters refer to the source table in `pmp-free-sources.md` §1. Those licences were checked only through search snippets, and **nobody has read the cited chapters to confirm the exact passage**. Treat each citation as a chapter-level pointer, to be confirmed (G2). Every correct action below is our own paraphrase.

- **B:** PMI Code of Ethics and Professional Conduct (honesty, respect, fairness, responsibility)
- **F:** Watt, *Project Management* 2e (CC BY 4.0)
- **H:** OpenStax, *Principles of Management* (CC BY 4.0)
- **L:** Scrum Guide 2020 (CC BY-SA 4.0; paraphrase only)
- **N:** Agile Manifesto principles
- **Q:** GAO-16-89G schedule guide / GAO-20-195G cost guide
- **S:** UK Teal Book / GovS 002 (OGL v3.0)

The **principle numbers** refer to the 14 PMI-mindset principles in `pmp-free-sources.md` §2.

---

## 8. Answer key (cut here for the paper version)

Each case lists:
- **Mistakes:** the planted steps, each with what's wrong, the correct action, the consequence, the principle and the source.
- **Clean but tempting:** correct steps that sound like shortcuts.

### Case 1: pmp-permit-form-01 (predictive)

**Step 6 · major · M5 Symptom, not root cause · ECO 2.7 · C5**
- **Why it's wrong:** the same bug on three screens points to one shared cause. Patching screen by screen treats symptoms and forces retesting over and over.
- **Correct action:** find the root cause, fix it once in the shared code, and retest every screen that handles dates.
- **Consequence:** seven screens were patched over two weeks, and testing overran.
- **Principle:** 1 (analyse before acting).
- **Source:** F (quality chapter: root-cause analysis).

**Step 8 · critical · M7 Gold-plating · ECO 2.2 (with 3.2) · C4**
- **Why it's wrong:** the feature isn't in the signed requirements, and it sends residents' addresses to an outside service with no data-processing agreement, against the policy in step 2.
- **Correct action:** stick to the requirements. Raise address lookup as a change request, with a privacy check and an agreement first.
- **Consequence:** the data went to the outside service, the council had to report it to its data regulator, the feature was pulled, and go-live slipped.
- **Principles:** 2 and 13.
- **Sources:** F (scope and quality); B (responsibility).
- `[REVIEWER CHECK] RC1`: is critical right here? It's critical only because of the data rule; plain gold-plating would be major. Would PMI frame this mainly as scope or as quality?

**Step 10 · minor · M6 Surprises a stakeholder · ECO 1.4–1.6 · C3**
- **Why it's wrong:** sitting on a known slip for a week takes away the service manager's time to adjust.
- **Correct action:** tell Ravi, and with his agreement tell the service manager now, with the new date and the reason.
- **Consequence:** the launch date had already been announced in the paper, and had to be corrected.
- **Principles:** 7 and 12.
- **Source:** F (communication chapter).

**Clean but tempting:**
- Step 5: logging the repeats linked to the first is good practice. The mistake is the fix in step 6.
- Step 9: checking the accessibility tests is in scope, because the requirements name screen readers.

### Case 2: pmp-vendor-slip-01 (predictive)

**Step 4 · major · M1 Acts before assessing · ECO 2.8 · C7**
- **Why it's wrong:** dates are changed before checking the float and the dependencies.
- **Correct action:** hold the dates, check the schedule, then agree any change with Grace.
- **Consequence:** the install had three weeks of float, so training was rebooked at a cost and go-live slipped for no reason.
- **Principle:** 1.
- **Source:** Q (GAO-16-89G: critical path and float); F (schedule).

**Step 6 · critical · M2 Bypasses change control · ECO 2.5 · C7**
- **Why it's wrong:** this is a verbal price change on a fixed-price contract. Step 2 says changes need a signed change order, and the assistant has no authority to commit money.
- **Correct action:** ask for the offer in writing, then assess it with Grace and the contracts officer and decide through a change order.
- **Consequence:** an invoice dispute, legal involvement, and a payment frozen for two months.
- **Principles:** 2 and 13.
- **Sources:** F (procurement); B (responsibility).
- `[REVIEWER CHECK] RC2`: is this a contract breach (critical), or an authority and process failure (major)? A verbal yes by someone without authority may not bind the company.

**Step 8 · minor · M6 Surprises a stakeholder · ECO 2.9 · C3**
- **Why it's wrong:** burying bad news under "other notes" means the reader can easily miss it.
- **Correct action:** lead the status update with the delay, its impact and the next steps, and tell Grace directly first.
- **Consequence:** the sponsor told the board everything was on track.
- **Principles:** 12 and 8.
- **Sources:** F (communication); B (honesty).

**Clean but tempting:**
- Step 5: asking for a written recovery plan is correct, and is the contract's own route.
- Step 7: logging the facts, including the contract clause, protects both sides. It isn't adversarial.

### Case 3: pmp-timezone-team-01 (agile)

**Step 5 · minor · M3 Escalates too early · ECO 1.2 · C1 · premature but reasonable**
- **Why it's wrong:** managers may have to be involved eventually, but meeting times are a working agreement the team can set (step 2). Listen to Carlo first and try the team level first.
- **Correct action:** talk with Carlo, then facilitate a whole-team agreement. Escalate only if the team can't resolve it.
- **Consequence:** the managers imposed a time nobody liked, and Carlo felt betrayed.
- **Principle:** 3.
- **Sources:** S (GovS 002: delegated authority); H (conflict).
- `[REVIEWER CHECK] RC3`: is escalating first actually wrong in PMI's view, given that a Scrum Master has no authority over working hours? Is minor right?

**Step 8 · major · M4 Directs instead of empowering · ECO 1.3 · C2**
- **Why it's wrong:** posting a "final" working agreement takes the decision away from a self-managing team.
- **Correct action:** bring two or three options and help the team choose one to try for a sprint.
- **Consequence:** the new times were ignored, and the sprint goal was missed.
- **Principle:** 5.
- **Sources:** L (self-managing teams; the Scrum Master serves the team); N (principle 11).

**Step 10 · critical · M10 Ethics / compliance breach · ECO 2.4 · C8**
- **Why it's wrong:** asking people to keep overtime off their timesheets breaks the policy in step 2, misreports their work, and is unfair to them.
- **Correct action:** move or record the review, or get the overtime approved and logged.
- **Consequence:** an HR audit, back pay, and a formal warning for Kofi.
- **Principles:** 13 and 12.
- **Sources:** B (honesty, fairness); F (resource planning).
- `[REVIEWER CHECK] RC4`: is a breach of overtime policy critical, or major?

**Clean but tempting:**
- Step 6: listening one-to-one after the escalation is still correct, just late.
- Step 9: a Scrum Master *suggesting* an option is fine, as long as the team decides.

### Case 4: pmp-regulator-date-01 (predictive)

**Step 4 · minor · M1 Acts before assessing · ECO 3.8 · C7 · premature but reasonable**
- **Why it's wrong:** telling the sponsor early is fine, but asking for resources before anyone has read the notice or looked at options is premature.
- **Correct action:** give a short heads-up that an assessment is under way, then analyse and bring a recommendation.
- **Consequence:** overtime was approved that wasn't needed, and the team's later estimates lost credibility.
- **Principle:** 1.
- **Sources:** F (change and scope); S (tolerances).
- `[REVIEWER CHECK] RC5`: some prep material says the sponsor should be told about a regulatory change at once. The planted error is meant to be *the resource request before analysis*, not the notification. Is that line drawn clearly enough to be the "best answer" distinction?

**Step 7 · major · M2 Bypasses change control · ECO 3.3 · C7**
- **Why it's wrong:** the assistant re-baselines alone. Even a mandatory change goes to the board named in step 2.
- **Correct action:** send the option, with its impacts, to the board and ask for a fast decision.
- **Consequence:** a skipped proof check, a week of rework, and a double re-baseline.
- **Principle:** 2.
- **Sources:** F (change control); S (change control).
- `[REVIEWER CHECK] RC6`: for a mandatory regulatory change, does PMI expect the normal board, or an emergency or expedited route? Either way the assistant shouldn't act alone, but the correct-action wording may need adjusting.

**Step 9 · critical · M10 Compliance breach · ECO 3.2 · C8**
- **Why it's wrong:** shipping with old allergen labels after the deadline breaks the regulation, and puts people's health at risk.
- **Correct action:** treat it as a compliance issue, raise it with Leah and the board now, and use the backup supplier (step 8) or interim compliant labels.
- **Consequence:** an allergic reaction, a recall, and a regulator investigation.
- **Principle:** 13.
- **Sources:** B (responsibility: laws and regulations); S (assurance).

**Clean but tempting:**
- Step 5: reading the notice in full comes after step 4, but it's still the right move.
- Step 8: the risk has an owner and a response. This is the model, not a mistake.

### Case 5: pmp-control-sprint-review-01 (agile, zero-mistake control)

There are **no planted mistakes**. Every STOP is a false alarm. The suspicious-sounding steps are deliberate:

| Step | Why it's correct | Look-alike it contrasts with |
|---|---|---|
| 3 | Work that doesn't meet the definition of done isn't presented as done; say so openly and return it to the backlog (L). | Hiding status (Cases 2 and 9) |
| 4–5 | Not promising anything; the product owner takes the request into the backlog and orders it (L). | Promising on the spot (sample `pmp-scope-change-01`) |
| 6 | The review is for inspecting results and getting feedback, not for fixing on the spot; the item is noted (L). | Acting before assessing (Cases 2 and 4) |
| 7 | Letting a speaker finish, then deliberately inviting the others, is fair facilitation (H). | Letting someone be talked over (Case 6 step 4) |
| 8 | Timeboxes are maximums; finishing early is fine (L). | |

`[REVIEWER CHECK] RC7`: confirm that no step here is wrong. Step 3 relies on my memory that the Scrum Guide 2020 says items not meeting the definition of done aren't presented at the review; check it against the text. Also check step 7 for the opposite reading.

### Case 6: pmp-retro-voice-01 (agile)

**Step 4 · minor · M3 Too late (nearest type) · ECO 1.2 · C1 · passive**
- **Why it's wrong:** as facilitator, saying nothing when someone is cut off tells the quieter people they don't count.
- **Correct action:** a light, neutral move in the moment ("let's let Joy finish"), then a private one-to-one with Raf later.
- **Consequence:** Joy disengaged.
- **Principle:** 6.
- **Source:** H (conflict and teams).
- `[REVIEWER CHECK] RC8`: does PMI prefer stepping in at the moment, or only addressing it privately afterwards? Is minor right?

**Step 7 · major · M4 Directs instead of empowering · ECO 1.3 · C2**
- **Why it's wrong:** the team found the cause, so the team chooses the fix. Making Raf the single approver also creates a bottleneck.
- **Correct action:** have the team propose fixes and pick one experiment.
- **Consequence:** review time went from 3 days to 5, and the sprint goal was missed.
- **Principle:** 5.
- **Sources:** L; N (principle 11).

**Step 9 · critical · M10 Ethics breach · ECO 1.3 · C1**
- **Why it's wrong:** it names the author of a note collected as anonymous (step 5), which breaks a promise and exposes Joy.
- **Correct action:** decline to name anyone, and offer the themes and the actions instead.
- **Consequence:** Joy was confronted and moved teams, and honest notes dried up.
- **Principle:** 6, plus the Code of Ethics (respect).
- **Sources:** B (respect, confidentiality); H.
- `[REVIEWER CHECK] RC9`: is this a Code of Ethics breach (critical), or a serious trust failure (major)?

**Clean but tempting:**
- Step 5: changing the format to silent writing is facilitation, not avoidance.
- Step 10: a private conversation with Raf is the right venue for it.

### Case 7: pmp-kiosk-risk-01 (hybrid)

**Step 5 · major · M8 Risk with no owner or response · ECO 3.5 · C8 · passive**
- **Why it's wrong:** the risk has happened, so it's now an issue, with no owner and only "monitor" as a response. Waiting three days for the review wastes response time.
- **Correct action:** tell Kwame today, agree an owner, and start a response (chase customs; loan kiosks or a staffed desk).
- **Consequence:** a two-week delay, paper sign-in, and inspection findings.
- **Principle:** 9.
- **Sources:** F (risk); S (risk).
- `[REVIEWER CHECK] RC10`: confirm that "monitor" in the register doesn't make waiting defensible once the risk has actually happened.

**Step 7 · critical · M10 Compliance breach · ECO 3.2 · C8**
- **Why it's wrong:** it copies real patient records to a shared drive for testing, against the privacy law in the setting.
- **Correct action:** synthetic data, or a properly anonymised set approved by the data protection officer.
- **Consequence:** a stolen laptop, a reportable breach, and letters to every affected patient.
- **Principle:** 13.
- **Sources:** B (responsibility); S (assurance).

**Step 9 · minor · M6 Surprises a stakeholder · ECO 1.4–1.6 · C3 · passive**
- **Why it's wrong:** the clinic manager hears bad news about her own opening day for the first time in a group meeting.
- **Correct action:** call her before the review.
- **Consequence:** she felt blindsided, and took over all updates.
- **Principle:** 7.
- **Source:** F (stakeholders).

**Clean but tempting:**
- Step 4: checking the register first is right. The mistake is what happens next.
- Step 8: reminding the team of the definition of done supports quality and isn't micromanagement.

### Case 8: pmp-closure-benefits-01 (predictive)

**Step 5 · major · M8 No owner (nearest type) · ECO 2.3 / 2.10 · C4 · passive**
- **Why it's wrong:** benefits tracking is left out of the handover. If no one is named to measure the benefits after closure, nobody will.
- **Correct action:** hand over the measures, today's baseline and a named owner who accepts it, plus a review date.
- **Consequence:** nobody could show the value, and phase two funding was paused.
- **Principle:** 11.
- **Sources:** S (benefits); F (closeout).
- `[REVIEWER CHECK] RC11`: who does PMI expect to own measuring benefits after closure, and what must the PM hand over? Is major right?

**Step 7 · critical · M10 Ethics breach (conflict of interest) · ECO 2.5 · C8**
- **Why it's wrong:** Lena accepts a valuable gift from a bidder whose bid she is scoring (step 6).
- **Correct action:** decline, tell procurement, follow the gifts policy, and step off the panel if asked.
- **Consequence:** the award was challenged and re-run, delaying maintenance cover by three months.
- **Principle:** 13.
- **Sources:** B (fairness, conflicts of interest); F (procurement).
- `[REVIEWER CHECK] RC12`: which comes first in PMI's view: decline, or disclose and let procurement decide? I've written both, with decline first.

**Step 9 · minor · M6 Surprises a stakeholder · ECO 1.8 · C3**
- **Why it's wrong:** the removal crew announces the removals on the day.
- **Correct action:** give each branch manager the times a few days ahead, with a contact.
- **Consequence:** queues, and a complaint.
- **Principles:** 7 and 8.
- **Source:** F (communication).

**Clean but tempting:**
- Step 4: logging open defects at closure is honest and correct. Hiding them would be the mistake.
- Step 6: sitting on the panel is fine by itself. The conflict starts at step 7.

### Case 9: pmp-status-amber-01 (hybrid)

**Step 5 · minor · M3 Escalates too early · ECO 1.8 · C3 · premature but reasonable**
- **Why it's wrong:** transparency is right, but forwarding a raw message before knowing the cause or impact skips Paul (step 3) and the agreed route, and causes alarm without answers.
- **Correct action:** call Paul, assess the problem with Anna, then report through the plan (sooner if it can't wait).
- **Consequence:** committee members phoned Anna directly and pulled her off the fix.
- **Principles:** 1 and 8.
- **Sources:** F (communication planning); S (escalation by tolerance).
- `[REVIEWER CHECK] RC13`: could a PMI-minded reviewer see immediate full transparency as the *better* answer here? If so, this item needs its context tightened, or should be dropped.

**Step 7 · major · M9 Adds scope mid-sprint, bypassing the PO · ECO 2.2 · C6**
- **Why it's wrong:** work is added to the running sprint without the product owner.
- **Correct action:** pass the request to Mei for the product backlog.
- **Consequence:** the sprint goal was missed, and approved screens were late.
- **Principle:** 2 (in its agile form, the product owner orders the backlog).
- **Source:** L (product owner accountability; Sprint Backlog).

**Step 9 · critical · M10 Reporting breach · ECO 2.9 · C8**
- **Why it's wrong:** the slip is three weeks, which the rule in step 2 makes red. Marking it amber under sponsor pressure misleads the board.
- **Correct action:** report red with the cause and recovery plan, tell Gavin why, call Paul, and use the governance route if the pressure continues.
- **Consequence:** the board decided on false status and lost confidence in the team.
- **Principle:** 12.
- **Sources:** B (honesty); Q (credible reporting).
- `[REVIEWER CHECK] RC14`: is the order of the correct action right (report red, explain to the sponsor, inform the PM, then escalate)? Or does PMI expect the PM to be called *before* the report is changed at all?

**Clean but tempting:**
- Step 6: diagnosing the problem with Anna is the assessment step 5 skipped.
- Step 11: a debrief for Paul when he's back is good, but doesn't replace the call step 3 asked for.

### Case 10: pmp-connected-claims-01 (hybrid, connected steps)

**Step 6 · major · M3 Too late · ECO 3.5 · C8 · connected to step 4 · passive**
- **Why it's wrong:** step 4 says an outage of more than a day triggers Sofia's backup route. From Saturday night to Monday morning is already past that, but Omar waits another day and doesn't tell the risk owner.
- **Correct action:** tell Sofia now so she can trigger the planned response, and update the log.
- **Consequence:** the reporting tests missed their window, and the submission slipped a week.
- **Principle:** 9.
- **Sources:** S (risk); F (risk).
- `[REVIEWER CHECK] RC15`: should the assistant tell the owner, or trigger the response himself? I chose to tell the owner. I tagged this M3 rather than M8, because an owner and a response exist; the failure is not acting on the trigger.

**Step 9 · critical · M2 Bypasses change control · ECO 3.3 · C7 · connected to step 3**
- **Why it's wrong:** merging two claim data fields is a change the contract says needs the client's written approval. It looks like a small screen tweak, and the product owner's enthusiasm doesn't override the contract.
- **Correct action:** pause, and raise a change request with the client under the clause.
- **Consequence:** an audit mismatch, a breach claim, and a withheld payment.
- **Principle:** 2.
- **Sources:** F (contracts and change); S (change control).

**Step 11 · minor · M6 Surprises a stakeholder · ECO 2.9 · C3**
- **Why it's wrong:** the update goes to a channel the client lead isn't in, and the backup is a report a month away.
- **Correct action:** a short direct note, through the channel agreed in the communication plan.
- **Consequence:** the client lead was surprised at the demo.
- **Principle:** 8.
- **Source:** F (communication).

**Clean but tempting:**
- Step 7: the accessibility check is routine.
- Step 10: flagging the risk on the burndown is good. The mistake is who gets told, and how (step 11).
- Step 12: the briefing is correct, though it can't undo steps 6 and 9.

### General reviewer checks

- `[REVIEWER CHECK] G1`: the Process task numbers 2.1–2.10 come from one vendor's ordering (`pmp-free-sources.md` §4). Check them against PMI's 2026 ECO PDF.
- `[REVIEWER CHECK] G2`: every source letter is a chapter-level pointer that nobody has read in full. Confirm that each one supports the correct action before the pack cites it.
- `[REVIEWER CHECK] G3`: is "assistant PM" a realistic role with the authority implied in each case? Does the exam's framing ("you are the project manager") make a different narrator better?

### Type-fit notes (taxonomy, not PMI correctness)

- Case 6 step 4 is tagged M3 and Case 8 step 5 is tagged M8, as the nearest fits (F6).
- M10 covers honesty breaches (Cases 3, 6, 8, 9) as well as legal or compliance breaches (Cases 4, 7) (F5).
