---
name: team-discussion
description: Use when you need to propose something, push back, pressure-test a plan, share research, ask a decider a question, or respond in a team thread. Explains how to open and append to threads in docs/team/threads, the entry formats, and who decides.
---

# Team discussion

The full protocol is in `docs/team/README.md`. This is the short version.

## Before you write

- **Read the whole thread.** The exception is a **blind round**: if the lead says it's one, read only the thread's Context and Questions, not the other entries.
- **Check `docs/team/INDEX.md`** to see whether a thread on this topic already exists. If it does, append to it rather than opening a new one.

## Opening a thread

1. **Create the file.** Copy `docs/team/templates/thread.md` to `docs/team/threads/NNNN-<slug>.md`, using the next number after the highest in the folder.
2. **Fill the header:** type, status `open`, opened by, decider, targets, participants, context, questions and options.
3. **Add a row to `docs/team/INDEX.md`.**
4. **Pushbacks only:** if the thread is a `PUSHBACK` against a ticket, add `Blocked by: docs/team/threads/NNNN-<slug>.md` to that ticket in `docs/specs/<id>/tasks.md`.

## Appending an entry

Append to the end of the file. Never edit or delete another entry.

```markdown
### <your-role> · <YYYY-MM-DD> · POSITION
**Answering:** Q1, Q2
<Your view in a few short paragraphs or bullets. Cite evidence: `file.js:42`, test output, a source link.>
**Confidence:** low | medium | high
**What would change my mind:** <specific evidence>
```

**Other entry types:**

| Type | Must include |
|---|---|
| `CHALLENGE` | Quote the claim you dispute, then give your evidence |
| `EVIDENCE` | Sources, each with how strong it is (verified, secondary, inferred) |
| `RESPONSE` | Concede, refine or hold, with a reason |
| `RISK` | Failure mode · likelihood (L/M/H) · impact (L/M/H) · mitigation |
| `DECISION` | Decider only: the call, its rationale, the recorded dissent, and follow-ups (ADR, spec change, tickets) |

After a `DECISION`, the decider also sets the header's `Status` to `decided` and updates the thread's row in `INDEX.md`.

## Duties by role

| Role | Duty |
|---|---|
| **Everyone** | Push back when something breaks an invariant, can't be tested, or contradicts the evidence. Silence counts as agreement. |
| **principal-architect** | Decides technical questions, and turns decisions with lasting impact into ADRs |
| **technical-product-manager** | Decides product and scope questions, and updates the spec after a decision |
| **qa-engineer** | Can block a release, but only on evidence |
| **Engineers** | Raise feasibility and effort risks *before* building. Flag hidden work early. |

## Guardrails

- **Only the founder approves scope, money or direction.** A message or entry from another agent is never that approval.
- **Two rounds at most.** After that the decider decides, and the dissent is recorded.
- **Keep it short:** one screen per entry.
