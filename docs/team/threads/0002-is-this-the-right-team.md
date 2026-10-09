# 0002: Is this the right team for the product?

**Type:** RESEARCH
**Status:** decided
**Opened by:** lead session · 2026-10-09
**Decider:** founder (team composition is a scope and direction call)
**Targets:** `.claude/agents/*`, `CLAUDE.md`, `docs/team/README.md`
**Participants:** technical-product-manager, principal-architect, backend-engineer, frontend-engineer, qa-engineer

## Context

The team today is a technical PM, a principal architect, a backend engineer, a frontend engineer and a QA engineer (`.claude/agents/`). The product (`docs/foundation/`) is unusual in five ways:
1. **Learning product:** it must actually teach. There's a learner model, a competency ladder and spaced repetition (`user-flow.md`, `data-and-evidence.md`).
2. **AI-native:** seven Claude pipelines (Subject Builder, card generation, blind verifier, grader, coach, miner). Quality depends on prompts and evals (`ai-flow.md`).
3. **Voice-first:** hands-free sessions, a hotword, barge-in, voice commands (`voice-first.md`).
4. **Evidence-driven:** a built-in experiment (trained vs. held-out items), a voice vs. text A/B test, and pre-registered success criteria (`data-and-evidence.md`).
5. **AI-built content on any subject:** generated mistakes must be correct, safe and not copyrighted.

### Research gathered by the lead (summary)

- **Learning engineering teams** are multidisciplinary. IEEE ICICLE lists learning sciences, instructional design, assessment, data science, software engineering and research. A common core is a learning scientist or instructional designer, a data scientist and engineers, with a lead. ([ICICLE process](https://sagroups.ieee.org/icicle/learning-engineering-process), [ICICLE resources](https://sagroups.ieee.org/icicle/resources), [Getting Smart](https://gettingsmart.com/?p=90833), [eSchool News](https://www.eschoolnews.com/educational-leadership/2023/02/07/how-learning-science-informs-edtech-product-development/), [Eedi team](https://eedi.com/about))
- **AI products now commonly have an "evals engineer"** who owns test sets, automated graders, regression monitoring and the release gate for prompt and model changes. This is distinct from backend work. ([evals engineering 2026](https://futureagi.com/blog/what-is-evals-engineering-2026/), [AI engineer role](https://www.promptlayer.com/glossary/ai-engineer-role))
- **Voice-first products use a conversation (VUI) designer** who owns dialogue flows, prompts, error and repair handling, voice usability testing and tuning. ([Voiceflow](https://www.voiceflow.com/blog/getting-started-in-conversation-design-heres-what-you-need-to-know), [VUI vs conversation designer](https://yardstick.team/compare-roles/voice-ui-designer-vs-conversation-designer-navigating-the-future-of-digital-interaction))
- **Multi-agent research:**
  - In ChatDev and MetaGPT ablations, removing *specialized roles* caused the biggest quality drop. Specialization helps, at some extra cost. ([ChatDev](https://arxiv.org/pdf/2307.07924), [MetaGPT](https://arxiv.org/pdf/2308.00352))
  - MAST (NeurIPS 2025; 1,600+ traces across 7 frameworks) finds multi-agent failures come mainly from **system design** (role and spec problems), **inter-agent misalignment** and **weak verification**, more than from model limits. ([MAST](https://arxiv.org/html/2503.13657v3))
  - Claude Code's docs recommend **3–5 teammates**, and token cost scales with each one. ([agent teams](https://code.claude.com/docs/en/agent-teams))

Candidate gaps, for the team to test rather than accept:

| Candidate role | Would own | Currently implied by |
|---|---|---|
| Learning designer / learning scientist | The competency ladder, card types, probes, feedback wording, whether it teaches | No one (the PM partly) |
| AI / evals engineer | Prompts, schemas, the verifier, grader reliability, promptfoo evals, model routing, cost | Backend engineer |
| Conversation / voice UX designer | Spoken dialogue, voice commands, error repair, TTS pacing, earcons, voice usability | Frontend engineer |
| Data / experiment analyst | Event model, metrics, the trained vs. held-out analysis, A/B analysis, dashboards | No one (QA partly) |
| Content and safety reviewer | Accuracy and safety of AI-built subject packs, copyright, regulated topics | No one (the verifier, the founder) |
| Security / privacy reviewer | Untrusted text, local data, mic and audio privacy | Architect |

## Questions for the team

1. **(Everyone)** From where you sit, what work in `docs/foundation/` has **no clear owner**, or would be done badly by the current five? Be concrete: name files, pipelines, metrics.
2. **(Everyone)** For each candidate role above: **add as a separate agent, fold it into an existing agent (which one), or skip for now**, with your reason.
3. **(Everyone)** Is any current role **unnecessary or overlapping** at this stage (solo founder, pre-pilot)?
4. **(principal-architect)** Devil's advocate: argue the strongest case **against** adding roles, with at least 3 `RISK` entries (coordination cost, token cost, MAST-style misalignment, ownership blur).

## Options

1. **Keep 5.** Fold the gaps into existing agents' responsibilities.
2. **5 plus 2 targeted specialists** (for example a learning designer and an AI/evals engineer), with the rest folded in.
3. **5 core plus on-call specialists:** extra agents exist as definitions but are invoked only for specific rituals (pressure tests, eval gates, pilot analysis), not in every build.
4. **A larger standing team (8–10).**

---

## Entries

<!-- Round 1 (blind): positions written independently; appended by the lead in fixed role order. -->

### technical-product-manager · 2026-10-09 · POSITION
**Answering:** Q1, Q2, Q3

**Q1: Work with no owner, or that the current five would do badly (seen from where I write specs):**
- **Pre-registered pass thresholds that nobody can produce evidence for.** Two of the success criteria in `data-and-evidence.md` §5 depend on assets that no one is assigned to build. "The verifier catches ≥80% of planted defects in a seeded test set" needs a seeded defect set. "Verifier precision/recall on a hand-labelled set" needs a labelled set. I can write these as SC-### lines, but no ticket owner can build the sets or set the thresholds.
- **The eval gate.** `scripts/eval-prompts.js` (the promptfoo config, `system-architecture.md`:80, D10) and invariant 4 require that "any text change … must pass the prompt eval gate". Today the backend engineer writes the prompt and also the gate that judges it. MAST's "weak verification" failure is exactly this.
- **Open decisions that have a method but no owner.** Q3 (grader model, decided by κ plus cost), Q4 (evidence window; "≥20 probe items per arm" is a power question) and Q5 (probe format) are all in `decisions.md`. Each needs someone who runs analyses, and none of the five does.
- **Analysis code.** The randomization test, retention curves, calibration, and the voice-vs-text analysis (`voice-first.md` §6) are F3 features with nobody who owns their correctness.
- **Whether it teaches.** That covers the D5 ladder, the probe design (new scenarios, matched to severity and subtlety), and the wording of feedback and lessons. I'd be specifying pedagogy and then accepting my own work.

**Q2: Verdict per candidate role:**
- **Learning designer: add as a separate agent, on call.** It reviews F2 and F3 specs before approval, plus probe and lesson content. It advises; the PM decides scope.
- **AI/evals engineer: add as a separate agent that owns tickets.** It owns `server/prompts/*` quality, the promptfoo suite, the seeded and labelled sets, and the Q3 model routing call. The release gate for prompts moves away from whoever wrote the prompt.
- **Data/experiment analyst: fold into the evals engineer** (as "evals and measurement"). The work is the same kind: offline labelled sets plus statistics. Effort is near zero until F3.
- **Conversation/voice UX: fold into the frontend engineer and the PM.** The PM specifies spoken copy and repair flows in spec scenarios; the frontend engineer owns `web/speech/`. With one pre-pilot user, the A/B test is the usability test.
- **Content and safety reviewer: fold into the learning designer**, using a pack-review rubric, with the founder signing off on regulated subjects (`ai-flow.md` §7).
- **Security/privacy: fold into the principal architect.** Add mic, audio, export and delete checks to its standing checks.

**Q3: Overlap:** None of the five roles is unnecessary. Two overlaps need clear lines:
- **QA vs. evals.** `tests/fixtures/adversarial-inputs.json` is QA-owned today. Proposed split: QA keeps functional ship/don't-ship, and evals owns the quality thresholds for AI outputs.
- **Ticket ownership is hardcoded to three roles** in my agent file and in the `writing-specs` template. If that list isn't extended, any new agent will never be assigned a ticket.

**Confidence:** medium

**What would change my mind:** An F3 dry run where the backend engineer builds the eval gate and QA builds the seeded defect set, and the gate catches a deliberately broken grade prompt (`open-source-landscape.md`:129) with no extra role. Or token-cost data showing that a 7th agent pushes per-phase cost past what the founder will fund.

### principal-architect · 2026-10-09 · POSITION
**Answering:** Q1, Q2, Q3

**What I checked:** all five agent files, CLAUDE.md, the foundation docs, and the repo itself. There are about 1,200 lines of code (`server/index.js`, `server/llm.js`, three `shared/` files, `web/`). `docs/specs/` and `docs/adr/` hold only READMEs. We haven't started F1.

**Q1: Work that would go unowned or be done badly**
1. **The prompt eval gate has no owner (D10, `scripts/eval-prompts.js`, promptfoo).** The backend engineer writes `server/prompts/*.js` and would also write the gate that judges them. That is author-as-verifier, MAST's weak-verification pattern. No one sets the regression thresholds or keeps the hand-labelled verifier set (data-and-evidence §3, "verifier precision and recall").
2. **The experiment's statistics have no owner (data-and-evidence §4).** Nobody can check the balanced split in `evidence_assignment`, the randomization test, or the probe volume of 20 or more items per arm (decisions Q4). QA tests that code runs, not that the inference is valid.
3. **Content safety (ai-flow §7)** rests only on the blind verifier, which is the same model family as the generator.
4. **Ladder and probe design (D5, user-flow §5)** is left to the PM by default.

**Q2: Verdict per candidate role**
- **Learning designer:** fold into the PM, as a learning-design checklist in `writing-specs`. Revisit at the F2 spec, when the ladder is built.
- **AI/evals engineer:** split the role. Eval sets, thresholds and the promptfoo gate go to **QA**, which already owns `adversarial-inputs.json` and fake-Claude. Prompts and gateway code stay with backend. Model routing and cost go to the architect as ADRs (decisions Q3). This keeps the author and the verifier separate without adding an agent.
- **Conversation/voice UX:** skip. `voice-first.md` is already a detailed spec. Frontend and PM own it.
- **Data/experiment analyst:** on-call only, for the F3 pilot analysis and the pre-registration check. `shared/events.js` stays an architect-reviewed contract.
- **Content/safety reviewer:** skip as an agent. An LLM reviewer would share the verifier's blind spots. Use QA's seeded-defect set (the "≥80% caught" criterion) plus the founder.
- **Security/privacy:** fold into the architect. Add standing checks: no outbound calls except Claude, opaque IDs, mic only on while listening.

**Q3: Overlap**
No role is redundant. The one overlap is that the architect and QA both run the invariant greps by hand. Turn them into tests in `npm test` (the deny-list test is already planned) so neither has to.

**Net:** Option 1 now, with ownership written into the agent files. Use Option 3 only for an analyst at F3.

**Confidence:** medium
**What would change my mind:**
- an F1 or F2 retro showing a prompt regression or bad card that got past review;
- grader κ below 0.6 with no one able to diagnose it;
- a ladder or probe flaw found after build that a learning checklist would have caught at spec time.

### principal-architect · 2026-10-09 · RISK
**Token and coordination cost grows faster than the codebase.**
- **Failure mode:** every invocation reads CLAUDE.md plus 1,052 lines of foundation docs before touching 1,200 lines of code. Going from 5 to 7 standing roles adds about 40% to every blind round, pressure test and retro. Claude's docs recommend 3–5 teammates and say token cost grows with each one. For a solo founder, that money and context comes straight out of build capacity.
- **Likelihood:** H
- **Impact:** M
- **Mitigation:** cap the standing team at 5. Specialists are defined but invoked only for named rituals (Option 3). Each one reads only the foundation file it owns.

### principal-architect · 2026-10-09 · RISK
**MAST-style role and spec failure: two agents own the same file.**
- **Failure mode:** an evals engineer and the backend engineer both claim `server/prompts/*.js` (the text vs. the code and `VERSION`). A voice designer and the frontend engineer both claim the spoken strings, which invariant 9 says must be built once. A learning designer and the PM both claim acceptance criteria. MAST's largest failure categories are system design (disobeying role specs, unclear responsibilities) and inter-agent misalignment.
- **Concrete case:** the designer edits feedback wording and the frontend engineer edits `session.js` in the same `[P]` batch. That gives either a file collision or a displayed/spoken mismatch.
- **Likelihood:** M–H
- **Impact:** H, because invariants 4 and 9 break silently.
- **Mitigation:** one owning role per file glob, written in each agent file. Specialists produce review notes or eval files only, never product code. Ticket file lists enforce it.

### principal-architect · 2026-10-09 · RISK
**Same-model "specialists" give false assurance, with correlated errors.**
- **Failure mode:** a content/safety or learning-science agent is the same model as the generator and the blind verifier. Its "approval" adds a sign-off but no independent signal. The real gaps are human expertise (subject accuracy, learning science) and labelled data, not another prompt persona.
- **Evidence:** the README already cites M3MAD's finding that 65% of debate failures were agents reinforcing a wrong answer, and that a compute-matched single agent can match a group.
- **Likelihood:** H
- **Impact:** H, because the defect-rate and "does it teach" pilot criteria would look met without being met.
- **Mitigation:** spend the budget on verification artifacts, not roles: a seeded-defect card set, a hand-labelled grader set, founder fairness ratings and κ. Any specialist must cite one of these, not its own judgment.

### principal-architect · 2026-10-09 · RISK
**More handoffs leave more verification gaps, and decision rights blur.**
- **Failure mode:** every added stage (spec → learning review → architect → build → evals gate → QA → analyst) is another "done" report that the next agent may trust without re-running it. That is MAST's premature termination and incomplete verification. A learning designer who "decides whether it teaches" also overlaps the PM (product decisions) and QA (ship / don't ship), which breeds deadlocks the founder has to settle.
- **Likelihood:** M
- **Impact:** M–H
- **Mitigation:** add no new deciders. Specialists advise and the existing four decide. Every handoff must include fresh command output (`verification-before-completion`), and QA's ship call stays the single gate.

### backend-engineer · 2026-10-09 · POSITION
**Answering:** Q1, Q2, Q3

**Q1: work with no owner, or that I would do badly.** My agent file gives me the "AI gateway (Claude calls, prompts, schemas, fallbacks)". The repo shows the result: I ship the plumbing and nobody measures quality.
- `tests/fixtures/adversarial-inputs.json` has 32 cases, but only `tests/mock-grader.test.js` runs them, against the **keyword** grader. Nothing ever scores the live `server/prompts/grade.js` on them. `tests/grade-prompt.test.js` only checks that the input is fenced.
- `scripts/eval-prompts.js` and promptfoo, which invariant 4 relies on, don't exist. There is no `llm_call` table and no cost log, only `console.log` in `server/llm.js`.
- `grade.js` contains subject words ("trade", "journeyman", "de-energized"), which breaks invariant 1. My definition of done (fake Claude plus `npm test`) can't catch prompt problems like this.
- Nobody owns the hand-labelled sets behind "verifier ≥80% recall" and "κ ≥ 0.6", or the trained vs. held-out randomization test (`data-and-evidence.md` §4–5).
- I write a prompt and then decide whether it passed. That is the self-verification that MAST flags.

**Q2: verdict per candidate role.**
- **AI/evals engineer: add as a separate agent.** It owns `server/prompts/*`, the eval sets, the promptfoo gate, grader κ and verifier precision/recall, and model routing (Q3 in `decisions.md`). I keep `server/ai/*`: deadlines, schemas, fallbacks and `llm_call` stamping. Prompt text vs. gateway code is a clean file boundary.
- **Learning designer: on-call,** used at spec time for the competency ladder, rubric scales, probes and feedback wording. My rubric wording has no grounding in learning science.
- **Data/experiment analyst: on-call** for pilot analysis. There is no data before the pilot. I own the event schema; someone else should own the stats.
- **Content and safety reviewer: fold into the evals engineer** as a safety and copyright eval set run against SB/G outputs. The founder stays the last check.
- **Conversation/voice UX: fold into frontend.** Spoken-line rules inside prompts go to the evals owner.
- **Security/privacy: skip.** It stays with the architect.

**Q3:** No current role is redundant. Backend is the overloaded one. QA and evals overlap on adversarial sets. The split I'd propose: evals sets the quality thresholds, and QA enforces ship or don't ship.

That is Option 3, with evals as a sixth standing role.

**Confidence:** medium
**What would change my mind:** If the F1–F3 tickets turn out to include almost no prompt changes, so the grade/scenario prompts stay frozen, a promptfoo gate ticket owned by QA would be enough. That would also hold if QA could show it can run the adversarial set against the live grader and report κ without anyone new.

### frontend-engineer · 2026-10-09 · POSITION
**Answering:** Q1, Q2, Q3

**Q1. Work with no owner, or work I'd do badly.** About half of `voice-first.md` §1–2 is design, and my agent file treats it as a spec I just implement. Those parts are:
- the wording of the dialogue: the 8 s and 20 s silence prompts, how the four A–D options are read aloud, the "previously…" recap, and the announcement when the app falls back to text;
- error repair: the "change that" window, and what happens when a command is misheard as part of an explanation;
- the earcon set, which has five cues and no sounds chosen yet;
- pacing: line gaps of 0.9–1.5 s, the speaking-rate defaults, and when to auto-continue;
- usability testing with real voices on real devices.

I can build all of it, and test it with stubbed speech. What I can't do is judge whether it *feels* right. Playwright with stubs can show that the spoken text matches the displayed text. It can't show that the dialogue is understandable on a walk. The gap is already visible in the code. `web/app.js:228` hard-codes "Clean job. Nobody got hurt.", which is subject-specific wording in engine UI, so it breaks invariant 1. `web/speech.js` is a single file with no hotword, no earcons and no command grammar. Feedback wording in `user-flow.md` §6 and the hint ladder have no owner either. They're learning design, not UI.

**Q2. Verdict per candidate role.**
- **Conversation / voice UX designer:** fold into me. Add a "voice dialogue spec" step: the PM writes the copy table and repair flows in the spec, and I run a short voice usability check. The design surface is small, and the wording should match the learning designer's feedback voice.
- **Learning designer:** add as an on-call agent (Option 3). It would own the feedback, hint and probe wording, which I'd otherwise make up.
- **AI / evals engineer:** add on-call to run the prompt eval gate. It's outside my seat.
- **Data / experiment analyst:** skip for now and fold into QA. I emit the events (`mode-assigned` and so on); the analysis comes after F3.
- **Content and safety reviewer:** fold into the verifier plus the founder.
- **Security / privacy reviewer:** fold into the architect. Mic privacy (no stored audio, an indicator) is a checklist item I can follow.

**Q3. Overlap.** No current role is unnecessary. Backend and frontend could be merged while the web code is about 570 lines, but parallel tickets justify keeping them separate.

**Confidence:** medium
**What would change my mind:** If the first stubbed-voice F2 build, tried by the founder on a phone, gets lots of "change that" or fallbacks, or the founder overrides to text in more than 30% of sessions, that points to a dialogue-design gap folding can't close. In that case I'd back a separate voice UX agent.

### qa-engineer · 2026-10-09 · POSITION
**Answering:** Q1, Q2, Q3

**Q1, what has no owner.** I checked what the tests cover. A fresh `npm test` gives `# tests 97 / # pass 97 / # fail 0`, exit 0. My charter covers deterministic checks: does the code meet the spec. None of those 97 tests checks whether the AI is good. The 32 cases in `tests/fixtures/adversarial-inputs.json` run only against the keyword grader (`tests/mock-grader.test.js`), not against grader A. There is no hand-labelled set and no κ harness. Invariant 4 relies on a "prompt eval gate" that doesn't exist. There's also no seeded-defect set for the verifier, so the "≥80% of planted defects" target in `data-and-evidence.md` §5 can't be measured. Nobody owns the randomization test in §4. My charter forbids real-API calls in tests, so I'm structurally unable to measure live AI quality.

**Q2, per candidate role:**
- **AI/evals engineer: add, on call (Option 3).** They'd own grader κ, verifier precision/recall, the prompt eval gate and cost per pipeline. That's statistical work on non-deterministic output, not pass/fail. I'd do it badly. I'd take the gate's result as a ship input, the same way I take `npm test`.
- **Data/experiment analyst: add, on call, at pilot analysis only.** I keep instrumentation correctness: the right events get emitted, `condition` and `assignedMode` are stamped, and events stay append-only. The analysis (randomization test, intention-to-treat A/B) is theirs. Pre-registration stays with the PM.
- **Learning designer: add, on call.** Probes, the ladder and feedback wording decide "does it teach". I can't test that against any spec.
- **Content/safety reviewer: skip as an agent.** A Claude checking Claude's packs repeats the same blind spots. I'll automate the checkable rules (disclaimer present on regulated packs, no subject words leaking into engine fields). The founder owns correctness labels, which the κ work needs anyway.
- **Voice UX: fold into frontend-engineer.** Stubbed speech proves "spoken = displayed", not usability. The founder's own voice sessions are the real usability test.
- **Security/privacy: fold into principal-architect.** I'll add behavioral tests for fencing and answer leaks.

**Q3:** No role is unnecessary. My invariant tests and the architect's standing greps overlap, but they're complementary: behavior versus static checks. Keep both.

**Confidence:** medium
**What would change my mind:** If a deterministic, replayable eval harness (recorded grader outputs plus a labelled set) fits in `tests/` and a fresh κ run takes under 10 minutes, I'd fold evals into QA plus the backend engineer instead.

<!-- Round 2 (rebuttal): one entry each from the two roles in open disagreement. -->

### principal-architect · 2026-10-09 · RESPONSE
**Refine.** I concede QA's point. A live-API eval is a measurement, not a test, so it can't live inside QA's `npm test` charter. I'm moving to an **on-call evals agent (Option 3)**. I still hold that it must not own `server/prompts/*` or model routing. It should own **only** `evals/**`: the labelled sets, the seeded-defect set and the promptfoo config. Backend stays the single writer of prompt text. The evals agent sets thresholds, and QA enforces them. Splitting ownership by file keeps MAST's role-blur risk closed.

**How live evals run, in two tiers:**
1. **Live tier.** `scripts/eval-prompts.js` is promptfoo with a real key. It runs old and new prompts against the labelled sets and reports κ, verifier recall and cost. It isn't part of `npm test`.
   - **Trigger:** the lead session, whenever a diff touches `server/prompts/*`, `server/ai/models.js`, or a `VERSION` bump. The author never triggers it.
   - **Who runs it:** the evals agent.
   - **Cost:** a per-run spend cap the founder approves.
2. **Replay tier.** Each live run saves its outputs as cassettes in `tests/fixtures/`, which `fake-claude.mjs` replays. κ and recall are then computed deterministically in `npm test` in under 10 minutes. That meets QA's condition, so QA owns this tier.

**Decision rights don't change.** Routing (decisions Q3) is still decided by an architect ADR, using the evals agent's numbers as evidence.

### qa-engineer · 2026-10-09 · RESPONSE
**Refine.** The architect's split (eval sets, thresholds and the promptfoo gate to QA) meets the condition I gave in my "what would change my mind". With that charter amendment, I accept the eval harness and gate, but not the thresholds or the labels.

**What I'd need:**
1. A charter change: `npm run eval:live` is opt-in, needs a key and a cost cap, and runs on every `VERSION` bump. It records outputs to `tests/fixtures/recorded/<prompt>@<version>.json`, and `npm test` replays them deterministically.
2. **The founder supplies the labels.** κ needs human ground truth. If I write both the cases and the "correct" answers, I'm just checking my own work.
3. **Thresholds are pre-registered** by the PM, from `data-and-evidence.md` §5, and I don't set them.
4. The randomization test and the A/B analysis go to an on-call analyst at F3. I have no stats competence, and the architect agrees.

**Risk of being both gates.** One agent with one blind spot.
- I could ship a release that passes functional checks but has a regressed grader.
- Replay hides drift: a recording proves the code, not the current model's behavior.
- **Mitigation:**
  - the QA report shows "Functional" and "AI quality" as separate verdicts;
  - I can't waive a failed AI-quality gate without a founder `DECISION`;
  - a recording older than the prompt's `VERSION` fails the replay test.

**Confidence:** medium
**What would change my mind:** If one live κ run on the 32 adversarial cases takes more than about 30 minutes of QA time per prompt change, evals needs its own agent.

### lead session · 2026-10-09 · EVIDENCE
**Summary after two rounds (the cap). Awaiting the founder's decision.**

**Unanimous:**
- Keep all five current roles; none is redundant.
- The biggest gap is **independent AI-quality evaluation**:
  - the prompt author currently judges its own prompts;
  - the 32 adversarial cases run only against the keyword grader;
  - the eval gate (D10, invariant 4) doesn't exist.
- No separate agents for voice UX (folds into frontend, with the PM writing spoken copy and repair flows in specs), content safety (seeded-defect set plus the founder), or security and privacy (architect standing checks).

**Converged in round 2:**
- **Live evals are a measurement, not a test.** They run in two tiers:
  - a **live tier**: opt-in, with a real key and a founder-approved cost cap, triggered by any change to `server/prompts/*` or a `VERSION` bump, and never by the author;
  - a **replay tier**: recorded outputs replayed deterministically in `npm test`, owned by QA. A recording older than the prompt's `VERSION` fails the test.
- **Responsibilities:**
  - the founder supplies the human labels;
  - the PM pre-registers the thresholds;
  - backend stays the only writer of prompt text;
  - model routing is decided by an architect ADR;
  - an on-call analyst handles the F3 statistics.
- **The QA report** gets separate "Functional" and "AI quality" verdicts. A failed AI-quality gate can only be waived by a founder `DECISION`.

**Still split: who runs the live tier and owns `evals/**`:**
- **The architect (now):** an on-call evals agent that owns only `evals/**`.
- **QA (now):** QA can own it, but flags the risk of one agent being both gates, and says that if a live run costs more than about 30 minutes per prompt change, evals needs its own agent.
- **The PM and backend:** a separate evals agent.
- **Frontend:** on-call evals.

**Learning designer:** 4 of 5 say add it on call. The architect says use a PM checklist now and revisit at the F2 spec.

**Code issues the round surfaced** (each should become a ticket in F1):
1. Subject words in engine code: "Nobody got hurt" at `web/app.js:228`; "trade" and "journeyman" in `server/prompts/grade.js`.
2. Ticket ownership is hardcoded to three roles in the PM agent and the `writing-specs` skill.
3. The architect's invariant greps should become tests in `npm test`.

**Devil's-advocate guardrails** to adopt whatever the decision:
- specialists never own product code;
- one owning role per file glob;
- no new deciders;
- specialists must cite verification artifacts (labelled sets, seeded defects), not their own judgment.

### founder · 2026-10-09 · DECISION
*(The founder chose these options when asked; the lead recorded them.)*

**Decision:** keep the five core roles and add two **on-call** specialists.
1. **`evals-engineer` (on call).**
   - **Owns only** `evals/**`, `scripts/eval-prompts.js` and `tests/fixtures/recorded/`.
   - **Runs** the live, opt-in, cost-capped eval tier. It's triggered by the lead whenever `server/prompts/*`, a `VERSION` or model routing changes, and never by the prompt's author.
   - **Never edits** product code or prompt text.
2. **`learning-designer` (on call).** Reviews specs and content at spec time for whether the product teaches, citing evidence. It writes `learning-review.md` only, and advises; it doesn't decide.

**Adopted from the debate:**
- **Ownership and process:**
  - backend stays the only writer of prompt text;
  - the founder supplies the human labels;
  - the PM pre-registers the thresholds;
  - QA owns the replay tier and gives separate Functional and AI-quality verdicts. A failed AI-quality verdict can only be waived by a founder `DECISION`.
- **Specialist analysis:**
  - model routing is decided by an architect ADR;
  - the analyst stays on call for F3 and isn't defined yet.
- **Guardrails:**
  - one owning role per path (the table in `CLAUDE.md`);
  - specialists never edit product code;
  - no new deciders.
- **Not added:** a voice UX agent (that work folds into frontend, with the PM writing spoken-copy tables), a content/safety agent (seeded defects plus the founder), and a security agent (architect standing checks).

**Dissent recorded:**
- The architect preferred a PM checklist over a learning-designer agent until F2.
- QA was willing to own evals itself.

**Revisit if:**
- you override voice to text in more than 30% of sessions (consider a voice UX agent);
- per-phase token cost is too high;
- a prompt regression or teaching flaw slips through anyway.

**Follow-ups, to fold into the F1 spec as tickets:**
1. Remove subject words from engine code: `web/app.js:228` "Nobody got hurt", and "trade"/"journeyman" in `server/prompts/grade.js`.
2. Turn the architect's invariant greps (subject words, gateway deadlines, prompt `VERSION`, no answers sent to the client, append-only events, file ownership) into tests in `npm test`.
3. Scaffold `evals/`, `scripts/eval-prompts.js`, `npm run eval:live` and the replay helper. The founder labels the first grader set (the 32 adversarial cases).
4. The founder approves a per-run eval cost cap.
