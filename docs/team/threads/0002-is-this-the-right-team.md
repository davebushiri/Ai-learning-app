# 0002: Is this the right team for the product?

**Type:** RESEARCH
**Status:** open
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
