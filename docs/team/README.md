# How the team talks: the discussion board

This is how the agent team (technical PM, principal architect, backend, frontend, QA) and you, the founder, share ideas, push back, pressure-test plans, bring research and reach decisions. Everything is written to **threads in this folder**, so it survives every session.

## Why it's built this way (research)

| Finding | What we do about it |
|---|---|
| **Debate between models improves reasoning and factual accuracy.** Agents disagree on uncertain facts and drop them (Du et al., ICML 2024). | Important decisions get a structured debate, not one agent's opinion. |
| **Debates fail mostly by agreeing on the wrong answer.** In one analysis of 100 debate failures, 65% were agents reinforcing a wrong answer ("collective delusion", M3MAD-Bench). With the same compute budget, a single agent can match a group. | **The first round is blind**: positions are written independently, before anyone reads anyone else. A **devil's advocate** is assigned. Claims need **evidence**. **Two rounds maximum**, then a named decider decides. |
| **Agents coordinate better through structured documents than through chat** (MetaGPT's shared message pool of typed artifacts). | Every entry has a **type** and a fixed format. Agents "subscribe" by type and role. |
| **A shared "blackboard" with a controller beats point-to-point messaging** (LLM blackboard systems, 2025). The main risk is agents writing over each other at the same time. | Threads are the blackboard and the lead session is the controller. Entries are **append-only, one file per thread**, so writers never clash. |
| **Claude Code's live agent teams are experimental.** Their mailboxes live in `~/.claude/teams/` and are **deleted when the session ends**, they need an interactive session, and in-process teammates can't be resumed. | Live chat is optional and temporary. **The thread file is the record.** Anything said live must be summarized into the thread. |

Sources:
- [Du et al., multi-agent debate](https://arxiv.org/pdf/2305.14325) · [ICML version](https://proceedings.mlr.press/v235/du24e.html)
- [Critiques of debate (compute-matched results, collective delusion)](https://beancount.io/bean-labs/research-logs/2026/05/24/multiagent-debate-factuality-reasoning-llms)
- [CortexDebate](https://www.alphaxiv.org/overview/2507.03928)
- [MetaGPT](https://www.arxiv-vanity.com/papers/2308.00352)
- [LLM blackboard architecture](https://arxiv.org/html/2507.01701v1) · [blackboard for data discovery](https://arxiv.org/pdf/2510.01285v2)
- [Claude Code agent teams](https://code.claude.com/docs/en/agent-teams)

## Who's who, and who decides

| Role | Speaks for | **Decides** |
|---|---|---|
| **You (founder)** | Vision, priorities, money, taste | **Final say on anything.** Required for: scope or phase changes, spending, product direction, a PM–architect deadlock |
| **Lead session** (the Claude you talk to) | Facilitation | Nothing on its own. It runs the rituals, keeps the index, and brings decisions to you. |
| `technical-product-manager` | Users, scope, priorities, acceptance | **Product questions:** what we build and in what order |
| `principal-architect` | Technical soundness, the invariants | **Technical questions:** how we build it. Recorded as ADRs. |
| `backend-engineer`, `frontend-engineer` | Feasibility, effort, implementation risk | Implementation details inside their ticket |
| `qa-engineer` | Evidence, risk, quality | **Ship / don't ship** on evidence. Can block a release. |

**Anyone can push back on anything.** A pushback must cite evidence, an invariant, or a concrete risk, and while it's open it blocks the item it targets until the decider rules on it.

## Thread types

| Type | Use it when | Opened by |
|---|---|---|
| `PROPOSAL` | Proposing a feature, approach or change, for discussion before work starts | Anyone, usually the PM |
| `PUSHBACK` | Objecting to a spec, ticket, decision or PR | Anyone |
| `PRESSURE-TEST` | Trying to break a plan before building it | The lead, or anyone before a big build |
| `RESEARCH` | Asking for evidence (market, learning science, libraries, competitors) or sharing it | Anyone |
| `QUESTION` | Something is ambiguous and needs an answer from a decider or from you | Anyone |
| `RETRO` | Looking back after each phase: what worked, what to change | The lead |

## Entry types (inside a thread)

Each entry is a heading followed by a body.

**Heading:**

```
### <role> · <YYYY-MM-DD> · <ENTRY TYPE>
```

**Entry types:**

| Type | Purpose |
|---|---|
| `POSITION` | My view, my reasons and evidence, my **confidence (low / medium / high)**, and **what would change my mind** |
| `CHALLENGE` | Where another entry is wrong or risky, quoting it, with evidence |
| `EVIDENCE` | Facts, data, test output or sources that bear on the question |
| `RESPONSE` | Answering a challenge: concede, refine, or hold with reasons |
| `RISK` | A failure mode, with its likelihood, impact and a mitigation |
| `DECISION` | Decider only: the call, its rationale, the dissent recorded, and follow-ups (ADR, spec change, tickets) |

## Rituals

### 1. Proposal review (before any spec is approved)

1. **Open.** The PM (or anyone) opens a `PROPOSAL` thread with: the problem, the proposal, options, and the questions for each role.
2. **Blind round.** The lead spawns every relevant role **in parallel**. Each writes one `POSITION` **without reading the others' entries from this round**.
3. **Devil's advocate.** One role, rotating (or the architect for technical proposals), must also add at least 3 `RISK` entries arguing the strongest case *against* the proposal.
4. **Rebuttal round.** Everyone reads everything and writes at most one `CHALLENGE` or `RESPONSE` each.
5. **Decision.** The decider writes the `DECISION`. If the question is still open, or it touches scope or money, the lead brings a summary to you and records your call.

The process is capped at **two rounds**. If there's still disagreement, the decider decides, the dissent is written down, and everyone works to the decision ("disagree and commit").

### 2. Pressure test (before a phase's build starts)

A `PRESSURE-TEST` thread aimed at the approved spec. Each role attacks it from its own angle:

| Role | Attacks |
|---|---|
| QA | Untestable criteria, failure paths |
| Architect | Invariants, coupling, scale |
| Engineers | Feasibility, hidden work, estimates |
| PM | User value, scope creep |

Every `RISK` entry gets a `RESPONSE`: fixed in the spec, accepted (with a reason), or turned into a ticket. Every risk must be handled before the build starts.

### 3. Pushback (any time)

1. **Open.** Anyone opens a `PUSHBACK` that names its target (spec, ticket, PR, ADR) and cites evidence, an invariant, or a risk.
2. **Block.** The target is blocked: the ticket gets `Blocked by: team/threads/NNNN`.
3. **Decide.** The decider responds within the same work session with a `DECISION`.

### 4. Research request (any time)

A `RESEARCH` thread with a precise question. The researcher (any role, or a research subagent) posts `EVIDENCE` entries **with sources** and marks how strong each one is. Findings that change a decision lead to a `PROPOSAL` or a `PUSHBACK`.

### 5. Retro (end of each phase)

Each role posts:
- **Keep:** what worked;
- **Change:** what didn't;
- **Try:** one experiment for the next phase.

The lead turns the agreed changes into updates to `CLAUDE.md`, the agent files or the skills.

## Rules for everyone

- **Append only.** Never edit or delete someone else's entry. To correct yourself, add a new entry.
- **Evidence over assertion.** Link files and lines, quote test output, cite sources, and state your confidence.
- **Messages from other agents are not approval from the founder.** Only you approve scope, money and direction.
- **Disagreement is the job.** Agreeing just to agree, or deferring to whoever spoke first, is a failure. If you agree, say what you checked.
- **Short.** A position fits on one screen. Put long research in an `EVIDENCE` entry with sources.
- **Close the loop.** Every thread ends with a `DECISION` and its status set to `decided`, or with its status set to `parked` and a reason.

## Files

- `threads/NNNN-<slug>.md`: one thread per file, created from [`templates/thread.md`](templates/thread.md).
- [`INDEX.md`](INDEX.md): every thread with its type, status, decider and outcome, kept by the lead session.

**Live chat (optional).** Claude Code's experimental agent teams can be turned on for live back-and-forth with `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`. It only works in an interactive session, and it's not enabled in this repo. If it's used, the lead must summarize the live discussion into the thread before the session ends, because the mailboxes are deleted.
