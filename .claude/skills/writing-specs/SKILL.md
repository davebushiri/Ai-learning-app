---
name: writing-specs
description: Use when turning a roadmap phase, feature idea or bug into a spec and tickets under docs/specs. Gives the exact spec.md and tasks.md templates and the rules for testable, collision-free tickets.
---

# Writing specs and tickets

*Templates adapted from GitHub Spec Kit (MIT, © GitHub, Inc.) and the task structure from obra/superpowers `writing-plans` (MIT, © 2025 Jesse Vincent). See `.claude/THIRD_PARTY.md`.*

## Folder and IDs

Each spec gets a folder, `docs/specs/<ID>-<slug>/`, where the ID is the phase plus a number (for example `F1-engine-core`). It contains:

| File | Written by |
|---|---|
| `spec.md` | PM |
| `tasks.md` | PM; QA appends bugs |
| `review.md` | Architect |
| `qa-report.md` | QA |

Ticket IDs look like `F1-T01`. Bug IDs look like `F1-B01`.

## spec.md template

```markdown
# <ID>: <Title>

**Status:** Draft | In review | Approved | Done
**Phase:** F1 | F2 | … | **Links:** docs/foundation/<relevant>.md

## Problem
<What's wrong or missing for the learner or the system, in 2–4 sentences. Why now.>

## User stories (prioritized; each independently testable)

### US1: <title> (P1)
<Plain-language journey.>
**Why P1:** …
**Independent test:** <how QA proves this story alone delivers value>
**Acceptance scenarios:**
1. Given <state>, when <action, voice mode>, then <outcome>
2. Given <state>, when <same action, text mode>, then <outcome>

### US2: … (P2)

## Edge cases
- What happens when <boundary / failure>? → <required behavior>

## Functional requirements
- **FR-001:** The system MUST …
- **FR-002:** …
- **FR-00x:** … [NEEDS CLARIFICATION: <question>]

## Events and metrics
- Emits `<verb>` with context `<fields>` (see data-and-evidence.md), used by <metric>.

## Success criteria (measurable)
- **SC-001:** <e.g. "a session resumes after reload at the same step in 100% of e2e runs">

## Non-goals / Later
- …

## Assumptions
- …
```

## tasks.md template

```markdown
# <ID>: Tickets

Legend: [P] = can run in parallel with other [P] tickets in the same group (no shared files).

## Group 1: Foundations
### <ID>-T01 [P] <title>
- **Owner:** backend-engineer | frontend-engineer | qa-engineer
- **Size:** S | M   (L means split it)
- **Depends on:** none | <ID>-T0x
- **Files:** create `path/a.js`, `tests/a.test.js`; modify `path/b.js`
- **Interfaces:**
  - Consumes: `fnName(arg: Type) → Type` from <ID>-T0x
  - Produces: `exportedName(arg: Type) → Type`, `GET /api/x → {shape}`
- **Acceptance:** FR-001, FR-003 (restate the checkable condition)
- **Tests that prove it:** `tests/a.test.js`: "<behavior name>", …
- **Notes:** <the one choice the signature doesn't settle; links>

## Bugs (QA appends)
### <ID>-B01 [blocker|major|minor] <title>
- Steps: … · Expected: … · Actual: … · Evidence: … · Suspected file: … · Owner: …
```

## Rules

1. **Testable or it doesn't ship.** Every FR maps to at least one acceptance scenario, and every scenario to at least one ticket and test.
2. **Voice and text.** Every learner-facing scenario appears in both modes.
3. **No file collisions** between `[P]` tickets. When in doubt, sequence them.
4. **Exact interfaces.** Each implementer sees only their own ticket, so names, shapes and routes must be spelled out.
5. **Right-sized.** A ticket is the smallest unit with its own test cycle that a reviewer could accept or reject on its own. Fold setup and docs into the ticket that needs them.
6. **QA tickets come first.** Each spec gets a `qa-engineer` ticket to write the acceptance tests from the scenarios, in parallel with the build.
7. **Flag, don't decide** architecture. Mark it `[ARCH DECISION NEEDED]` and let the principal architect write the ADR.
