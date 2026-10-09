---
name: verification-before-completion
description: Use before claiming any work is complete, fixed or passing, and before handing off, committing or opening a PR. Requires fresh command output as evidence for every claim.
---

# Verification before completion

*Adapted from obra/superpowers `verification-before-completion` (MIT, © 2025 Jesse Vincent). See `.claude/THIRD_PARTY.md`.*

## The rule

**No completion claim without fresh evidence from this turn.** "It should pass" and "it passed earlier" are not evidence.

## The gate (run it for every claim)

1. **Identify** the command that proves the claim.
2. **Run** it fresh and in full.
3. **Read** the output: the exit code and the pass/fail counts.
4. **Report** the claim *with* the evidence. If the output doesn't support it, report the actual status instead.

| Claim | Evidence needed in this repo | Not enough |
|---|---|---|
| Tests pass | `npm test` output showing `# fail 0` | A partial run; an earlier run |
| Acceptance criterion met | The named test that proves it, passing, or a browser check plus screenshot | "Implemented" |
| UI works | Playwright run in **text and voice mode** (speech stubbed), zero console errors, screenshots at 390 px and 1280 px | Opening the page once |
| Bug fixed | A test that reproduced the bug failed before the fix and passes after | "Code changed" |
| Fallback works | A fake-Claude scenario showing the fallback and its label within the deadline | Reading the code |
| Invariants hold | The architect's standing `grep` checks are clean | Assumption |
| Another agent finished | The diff shows the change and you re-ran its tests yourself | The agent's report |

## Red flags

- "should", "probably", "seems to".
- Celebrating before running anything.
- Trusting a sub-agent's or engineer's success report without re-running it.
- "Just this once."

## The report format

```
Ticket: F1-T03
Acceptance:
  - FR-002 server never returns answers before grading → tests/acceptance/f1.test.js "scenario payload has no answer fields" ✅
  - …
npm test: # tests 128 / # pass 128 / # fail 0
Browser: text ✅ voice ✅ (stubbed), console errors 0, screenshots: …
Deviations: none
```
