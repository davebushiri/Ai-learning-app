# 0004: F1a pressure test

**Type:** PRESSURE-TEST
**Status:** open
**Opened by:** lead · 2026-10-09
**Decider:** technical-product-manager (scope) · principal-architect (technical) · qa-engineer (testability)
**Targets:** `docs/specs/F1a-server-owned-cards/` (spec.md and tasks.md, revision 3, Approved)
**Participants:** qa-engineer, backend-engineer, frontend-engineer, technical-product-manager, learning-designer (on call)

## Context

F1a was approved after two design-review rounds (thread 0003; `review.md`). Before any engineer starts, each role tries to break it from its own angle (`docs/team/README.md`, ritual 2). Every `RISK` must get a `RESPONSE`: fixed in the spec, accepted with a reason, or turned into a ticket.

## Question(s) for the team

1. **QA:** Which criteria can't be tested, and which failure paths are missing?
2. **Backend and frontend:** What isn't feasible, what work is hidden, and are the estimates honest? Do the ticket interfaces hold together for the person building them?
3. **PM:** Is there user value or scope creep at risk? Is 21 tickets right for F1a?
4. **Learning designer:** The voice prompt after a silent STOP, "Say 'skip' if you're not sure" (`voice-first.md:50`). How should that learner-chosen skip be scored, compared with the grader-failure "not graded" skip?

---

<!-- Entries go below, append-only. -->
