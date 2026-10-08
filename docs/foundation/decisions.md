# Decisions and open questions

## Decided

| # | Decision | Rationale | Alternatives rejected |
|---|---|---|---|
| D1 | **Subject-agnostic engine. All subject content lives in versioned packs.** | Build the foundation once and prove it on any subject | Hard-coding a first domain (the earlier PMP-first plan) |
| D2 | **Subjects are AI-built with the learner in the loop.** Hand-authored packs use the same format. | Lifelong learning means any topic; the review step guards quality | Only curated packs: doesn't scale to personal goals |
| D3 | **Prerequisites stay shallow and editable,** marked by confidence | LLMs extract prerequisite links poorly | A deep auto-generated prerequisite graph |
| D4 | **The learner's own errors reshape the pack** (Mistake Miner) | LLM-imagined mistakes don't match real learner errors; yours do | Static AI-generated mistake libraries |
| D5 | **The competency ladder:** lesson → guided → stop → next move → review | Error-finding hurts novices without prior knowledge | Straight into hidden-mistake play |
| D6 | **Coarse rubric** (identified yes/partly/no; why 0–2; fix 0–2) plus a confidence flag and deferral | LLM-human grading agreement degrades with finer rubrics; deferral improves accuracy | A fine 0–10 score |
| D7 | **Event-sourced storage in SQLite,** projections rebuildable | Formula changes without data loss; a full audit trail for the evidence | Mutable mastery tables only |
| D8 | **xAPI-shaped events** | Familiar to L&D buyers and exportable later | A custom ad-hoc log |
| D9 | **Built-in trained vs. held-out evidence design** | The only clean way to show learning with one learner | Engagement metrics only |
| D10 | **Every AI output is stamped with prompt version and model, and prompt changes go through an eval gate** | Comparable data; no silent regressions | Editing prompts freely |
| D11 | **Vanilla JS, Node, SQLite, PWA; no framework** | Solo founder; the existing stack works and is tested | React/Next rewrite |
| D12 | **Server owns cards; the client never sees answers before grading** | Integrity of the data and the evidence | Client-held scenarios (the hackathon shortcut) |
| D13 | **The trades scenarios become `packs/demo-trades`,** used in onboarding | Keeps the hackathon work and teaches the mechanic in 30 s | Dropping them |
| D14 | **Voice-first sessions, with full text mode as an option. A within-person A/B test (randomized per session) checks the choice** | Hands-free active listening suits focus; speaking the explanation is the self-explanation step. The test confirms it for you. | Text-first with voice optional |

## Open questions

| # | Question | Options | How we'll decide |
|---|---|---|---|
| Q1 | Which 2 pilot subjects? | One you can judge plus one new to you (recommended) | You pick after Phase F1 |
| ~~Q2~~ | ~~Voice-first or text-first?~~ | Resolved: voice-first, see D14 | |
| Q3 | Grader model | Opus 5.5 low effort vs. Haiku 5.5 vs. Sonnet 5.5 | Eval set plus κ on your fairness ratings; cost per session |
| Q4 | How long is the evidence window? | 2, 3 or 4 weeks before crossover | Probe volume: we need about 20 or more probe items per arm |
| Q5 | Do probes use the same format as practice, or exam-style multiple choice? | Same format (cleaner comparison) vs. MCQ (transfer) | Probably both, tagged |
| Q6 | Reminders | None, local notifications (PWA), or email | Phase F3 |
| Q7 | Product name | "Stop the Apprentice" (umbrella), or something new | Before any public pilot |
| Q8 | Ownership with the hackathon team | Agreement, license, or a clean rewrite of the shared parts | Before commercial use |

## Build phases

| Phase | Scope | Proves |
|---|---|---|
| **F1: Engine core** | SQLite and the event log; server-owned cards; pack format and the `demo-trades` pack; subject-agnostic prompts and UI copy; deny-list test; prompt registry with versions; LLM call log | Nothing new for learners. The old game runs on the new foundation, and all tests pass. |
| **F2: Personal loop** | Subject Builder (SB-1 to SB-5) with map review; ladder stages; lesson, guided and stop cards; learner model (Elo plus Leitner); planner; Today, Session, Results and Progress screens; resume | You can build any subject and practise it daily |
| **F3: Quality and evidence** | Blind verifier and bank; nightly batch; rubric grader with confidence; fairness spot-checks; probes plus the trained/held-out experiment; evidence chart; prompt eval runner; cost dashboard | Whether it's trustworthy, and whether it teaches |
| **F4: Pilots** | Run 2 subjects for 4–8 weeks against the success criteria; Mistake Miner; next-move cards | The go/no-go data |
| **Later** | Sources and grounding, reverse mode, boss cards, multi-subject interleaving, accounts, other learners | |
