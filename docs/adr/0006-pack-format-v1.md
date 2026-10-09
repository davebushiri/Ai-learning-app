# 0006. Pack format v1, trust and fencing of pack text, and rating keys

**Status:** Accepted (technical). Shipping any non-trades pack is held by the F2 hard rule, which is **pending founder F-0**.
**Date:** 2026-10-09   **Deciders:** principal-architect
**Thread:** [0003](../team/threads/0003-f1-engine-core-proposal.md) (W2, W7, the "hidden coupling" risk)

## Context
- D1 and D13 move the trades content out of the engine: `server/prompts/trades.js` and `fixtures/scenarios/*.json` become `packs/demo-trades/`.
- The rating labels "Someone got hurt" and "Journeyman eyes" are subject words inside `shared/scoring.js:74-79`. The clean-run line "Clean job. Nobody got hurt." is hard-coded at `web/app.js:228`.
- D2 makes packs AI-built, so pack text is untrusted. Inv. 5 says untrusted text inside prompts is fenced. Today the scenario prompt puts the pack's brief, hazards and twists in unfenced (`server/prompts/scenario.js:49-56`).
- `ai-flow.md` §3 defines the full pack format, much of which F1 has no use for.

## Options considered
1. **The full `ai-flow.md` §3 format now** (competencies, mistake types): rejected. Nothing in F1 reads it, and F2's Subject Builder defines it for real.
2. **Treat hand-authored packs as trusted**: rejected. D2 says all packs share one format and one trust level, and "trusted provenance" can't be checked once packs are user-built.
3. **`scoreRun` returns a label passed in from the pack**: rejected. Scoring would then depend on pack text. Returning a **key** keeps `shared/scoring.js` free of subject words and its tests unchanged in shape.

## Decision
**Layout.** `packs/<id>/pack.json`, plus `packs/<id>/scenarios/<scenarioId>.json` (today's fixtures, unchanged until F1b).

**Pack v1 fields:** a strict subset of `ai-flow.md` §3, plus two F1 fields marked ★.
```
{ id, version, title,
  severity: { critical, major, minor },                       // meanings in this subject
  ratings: { missedCritical, tiers: [t0, t1, t2, t3] },        // labels, best tier first
  copy: { cleanRun },                                          // ★ spoken line for a run with nothing missed
  scenarios: [{ id, label, brief, hazardHints, criticalHints?, twists?, fixture }],  // ★ F1 authored cards; superseded by competencies in F2
  safety?: { regulated, disclaimer },
  provenance: { builtBy } }
```
- **Validator.** `validatePack(p)` lives in `shared/pack.js`. It is pure, never throws, and returns a list of problems. It caps string lengths and counts, and requires exactly 4 tiers.
- **Loader.** `server/packs.js` loads packs at startup. An invalid pack is skipped with a logged error, and the server still starts.
- **Packs are immutable per version.** `subject_pack (id, version)` is inserted once. If a pack on disk differs from the stored row for the same version, the loader refuses that pack until its `version` is bumped. Events say `demo-trades@1`, so the content behind that name must never change.
- **Rating keys.** `scoreRun` returns `ratingKey`, which is `missedCritical` or `tier0` to `tier3`, in place of `rating`. The thresholds (0.85 / 0.6 / 0.3) move into `RULES.ratingTiers`, unchanged. `ratingLabel(pack.ratings, key)` in `shared/pack.js` maps a key to its label. For demo-trades, the labels are today's strings, so golden runs are unchanged.

**Trust**
- All pack text is untrusted, whoever wrote it.
- **In prompts,** pack text appears only inside a `<pack>…</pack>` fence, and the prompt states that it is data, never instructions.
- **In the UI,** it is rendered as text (`textContent` or `escapeHtml`), never as raw HTML.
- **Today's unfenced uses** in `scenario.js` and `grade.js` are a known violation. They stay on the deny-list ratchet allow-list until W7 (F1b) fences them, with a `VERSION` bump that goes through the gate ([0005](0005-ai-gateway-and-prompt-registry.md)).

**F2 hard rule (pending founder F-0).** No pack other than demo-trades ships until W7 has passed the gate and the deny-list allow-list is empty. Before W7, a non-trades pack's text would land unfenced in the system prompt.

## Consequences
- Positive: subject words leave `shared/` and `web/` in F1a. Packs are versioned evidence. The pack format grows additively toward `ai-flow.md` §3.
- Negative / risks: `scenarios[]` is an F1-only shape that F2 will replace with competency-driven generation. When it does, `pack.json` gets a version bump, not an edit. `game-balance.test.js` changes its assertion from the label to the key-plus-label pair, with the same value for demo-trades.
- Follow-ups: W2 builds the loader, validator and demo-trades pack. The thresholds stay in engine `RULES`, and only the labels live in the pack.

## Verification
- `validatePack` unit tests cover demo-trades passing, each missing field failing, and garbage input not throwing.
- A test asserts that `ratingLabel(demoTrades.ratings, key)` equals today's 5 strings for the 5 keys.
- The deny-list ratchet test, with no `shared/` or `web/` entries at F1a exit.
- A test asserts that the loader refuses a changed `pack.json` whose version wasn't bumped.
