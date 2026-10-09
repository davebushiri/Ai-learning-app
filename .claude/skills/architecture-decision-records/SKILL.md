---
name: architecture-decision-records
description: Use when an architecture or technology decision is made or changed (new dependency, contract change, storage or AI-gateway change, deviation from docs/foundation). Writes a short ADR in docs/adr and indexes it in decisions.md.
---

# Architecture decision records

*Format after Michael Nygard's ADR template ("Documenting Architecture Decisions", 2011).*

## When to write one

- A new runtime dependency, or replacing one.
- Any change to a shared contract (`shared/contract.js`, `shared/events.js`, API shapes) or the database schema.
- Changes to the AI gateway's rules (deadlines, fallbacks, model routing, prompt registry).
- Deviating from anything in `docs/foundation/`.
- Choosing between options a spec flagged `[ARCH DECISION NEEDED]`.

## File

Write `docs/adr/NNNN-<kebab-title>.md`, numbered sequentially. Never edit an accepted ADR's decision; supersede it with a new one.

```markdown
# NNNN. <Decision title>

**Status:** Proposed | Accepted | Superseded by NNNN
**Date:** YYYY-MM-DD   **Deciders:** principal-architect (+ human)

## Context
<The forces at play: requirements, constraints, invariants affected, what the spec needs. Facts, with links.>

## Options considered
1. **<Option A>**: pros / cons / cost
2. **<Option B>**: …

## Decision
<What we will do, in one or two sentences.>

## Consequences
- Positive: …
- Negative / risks: …
- Follow-ups: tickets, migrations, docs to update

## Verification
<How we'll know it holds: test names, metrics, a grep check.>
```

Then add a row to the "Decided" table in `docs/foundation/decisions.md` linking the ADR.

## Good ADRs

- **One decision each, short:** a page at most.
- **Name the rejected options and why.** That's what future readers need most.
- **List licenses for new dependencies,** and confirm MIT, Apache, BSD or ISC.
- **Include a verification step,** so the decision can be checked automatically where possible.
