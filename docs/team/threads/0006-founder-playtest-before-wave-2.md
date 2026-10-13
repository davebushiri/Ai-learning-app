# 0006: Founder playtest before Wave 2

**Type:** RESEARCH
**Status:** open
**Opened by:** lead · 2026-10-13
**Decider:** technical-product-manager (what goes into Wave 2, F1b or later) · founder (scope)
**Targets:** the current build on `team/agents` (end of F1a Wave 1), and `docs/specs/F1a-server-owned-cards/`
**Participants:** founder; then technical-product-manager, learning-designer, principal-architect

## Context

Wave 1 changed internals only. What a player sees is still the original game, byte-identical: the 61-run golden replay proves it. Wave 2 is where the player experience changes, so the founder plays the current build first and proposes bugs and feature changes before Wave 2 starts.

One rule shapes where a change can land. F1a is a behavior-neutral refactor, held by the golden replay. A fix that changes what the learner sees or hears either:
- goes into Wave 2 as a named, allow-listed golden diff; or
- goes into F2 (the PM decides).

## How to log a finding

Tell the lead in chat, or append below. One entry per finding:

```
### founder · <date> · EVIDENCE
**Kind:** bug | feature | content | feel
**Mode:** voice | text · **Browser/device:** …
**Steps:** …
**Expected:** …
**Actual:** …
**How much it matters to you:** blocker | annoying | nice-to-have
```

## Already known (no need to log these)

- **Favicon 404.** The browser console shows one 404 on page load, for `/favicon.ico`.
- **Run-end line not shown (OI-9, deferred to F2).** "Clean job. Nobody got hurt." is spoken but not displayed, and the consequence line differs between voice and screen.
- **Grader failure (fixed in Wave 2).** When the grader fails, the browser grades by keyword itself, labelled "offline grader (fallback)". Wave 2 replaces this with the "Couldn't reach the grader" panel and Skip.
- **No "I'm not sure" option.** The only way out is submitting an empty answer, which scores as a weak catch. Scoring for "not sure" is designed for F2.
- **Trades only.** There is only the trades subject pack. Non-trades subjects come after F1b's prompt rewrite passes the live gate.
- **MOCK grading is keyword matching.** Real grading needs an API key (live mode).

---

<!-- Entries go below, append-only. -->
