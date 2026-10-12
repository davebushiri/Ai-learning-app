# 0005: F1a-T07b file list misses tests/grade-prompt.test.js

**Type:** PUSHBACK
**Status:** decided
**Opened by:** backend-engineer · 2026-10-12
**Decider:** technical-product-manager
**Targets:** docs/specs/F1a-server-owned-cards/tasks.md F1a-T07b (spec rev 4.2)
**Participants:** technical-product-manager, principal-architect, qa-engineer

## Context

F1a-T07b deletes `fixtures/scenarios/{electrical,brazing,brakes}.json` and says "No file under `fixtures/scenarios/` may have an importer left". A repo-wide grep before building (`grep -rln "fixtures/scenarios" --exclude-dir=node_modules . | grep -v ^./docs`) finds one importer that is **not** in T07b's Files or Changed tests:

- `tests/grade-prompt.test.js:6`: `readFileSync(new URL('../fixtures/scenarios/electrical.json', import.meta.url))`

Deleting the fixture makes this file fail to load (ENOENT at import), so T07b can't finish within its file list. This is the same kind of gap as review.md "Code review: Wave 0" S4 (`tests/scenario-prompt-rng.test.js`), which rev 4.1 fixed by adding that file.

Other importers: `README.md:28,62,68` still mention `fixtures/scenarios/*` and `server/prompts/trades.js`. That's documentation, not an importer, and T18 already updates the README, so it doesn't block. The string literals in `tests/golden-isolation.test.js:39,42` are test inputs, not reads, so they don't block either.

## Question(s) for the team

1. (PM) Add `tests/grade-prompt.test.js` to F1a-T07b's Files, under Changed tests as "path only (`fixtures/scenarios/` → `packs/demo-trades/scenarios/`)"?

## Options (if any)

1. **Add it as a path-only edit (recommended):** a one-line change, the same as `tests/scoring.test.js`. T07a's frozen sha256 test proves the pack file is byte-identical, so the assertions are unaffected.
2. **Keep the fixtures until a later ticket:** this contradicts FR-019 ("the pack is the only copy") for T07b.

---

## Entries

### backend-engineer · 2026-10-12 · POSITION
**Answering:** Q1
Option 1. It's a path-only edit with zero assertion change. I've stopped T07b before writing any code and will resume once the ticket lists the file. No other blocker was found. One note for the build: `scripts/simulate.js` today reads `readdirSync(fixtures/scenarios)`, which runs alphabetically (brakes, brazing, electrical). To keep its output byte-identical, the pack-driven version will sort by fixture file name. That's inside the ticket, and I'm noting it here so review isn't surprised.
**Confidence:** high
**What would change my mind:** evidence that `tests/grade-prompt.test.js` is meant to be deleted or re-owned by another ticket.

### technical-product-manager · 2026-10-12 · DECISION
**Answering:** Q1
**The call:** Option 1, plus backend's two notes, all accepted.
- **F1a-B55 (resolved, rev 4.3):** `tests/grade-prompt.test.js` is added to T07b's Files and Changed tests as a path-only edit (`fixtures/scenarios/` → `packs/demo-trades/scenarios/`). No assertion changes. T07a's frozen sha256 test proves the pack file is byte-identical to the old fixture. No other F1a ticket lists this file, so it can't collide with anything.
- **F1a-B56 (resolved, rev 4.3):** the stale `README.md:28,62,68` mentions (`fixtures/scenarios/*`, `server/prompts/trades.js`) are left to T18, which already modifies `README.md`. T18's README bullet now names those lines. T07b's "no importer left" grep covers code and tests only, so the README doesn't fail it.
- **`scripts/simulate.js`:** within each pack, scenarios are played in ascending fixture file-name order (the same order as today's `readdirSync`: brakes, brazing, electrical). This is inside T07b and is written into its Interfaces line. FR-023's byte-identical simulate output still applies.

**Rationale:** this is the smallest change that keeps FR-019 ("the pack is the only copy"). Option 2 would break FR-019 for T07b. It's the same kind of gap as review "Code review: Wave 0" S4, fixed the same way.
**Dissent:** none recorded.
**Follow-ups:** tasks.md rev 4.3: T07b Files, Changed tests and the simulate note updated; T07b's "Blocked by" line removed; T18's README bullet extended; B55 and B56 filed under Bugs as resolved. No ADR is needed, no spec.md change is needed, and no prompt is touched. T07b is unblocked.
