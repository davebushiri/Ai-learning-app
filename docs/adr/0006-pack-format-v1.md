# 0006. Pack format v1, trust and fencing of pack text, and rating keys

**Status:** Accepted. The F2 hard rule is accepted (founder F-0). Amended 2026-10-09 (Amendment 1) and 2026-10-10 (Amendment 2, `putPack` insert), below.
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

## Amendment 1 (2026-10-09, F1a spec review)
Additive. Reasons are in [`docs/specs/F1a-server-owned-cards/review.md`](../specs/F1a-server-owned-cards/review.md) (B4, OI-3).
- **The keyword grader's vocabulary moves into the pack.** That's `shared/mock-grader.js:92-105` and `:122`, which this ADR missed. Pack v1 adds:
  - `copy.falseAlarmFeedback`, a required string;
  - `grading.synonyms`, optional, shaped `{[term]: string[]}`, with caps on counts and lengths in `validatePack`.

  `mockGrade(card, errorStepId, explanation, lexicon)` takes `{synonyms, falseAlarmFeedback}`, and the module holds no subject words. Synonyms are matched as data and never placed in a prompt.
- **`scenarios[]` stays flat as decided:** `{id, label, brief, hazardHints, criticalHints?, twists?, fixture}`. `fixture` is a filename under `packs/<id>/scenarios/`, and today's names are kept (`electrical.json`, `brazing.json`, `brakes.json`). Rejected: a nested `generation` object, a `cards/` directory and a `format` field. They add a second shape with no consumer.
- **Immutability covers the whole pack.** `subject_pack.json` stores `pack.json` plus every scenario file, as canonical JSON. A mismatch for the same `(id, version)` refuses that pack.
- **Rating keys as decided:** `ratings: {missedCritical, tiers: [t0, t1, t2, t3]}`, with keys `missedCritical` and `tier0`–`tier3`. Rejected: `missed-critical`, `excellent`, `solid`, `developing`, `beginning`. Evaluative names in engine code carry a judgement that belongs to the pack, and tier indices map one to one onto `RULES.ratingTiers`.
- **Fixture card ids** are `fx_<packId>_<packVersion>_<scenarioId>` ([0003](0003-server-owned-card-and-attempt-api.md)), and the loader inserts each once.

## Amendment 2 (2026-10-10, F1a-T06 build, bug F1a-B31)
Clarifies "inserted once". The rules are in [0001](0001-sqlite-storage-and-append-only-event-log.md) Amendment 1.
- **`putPack`** uses `INSERT … ON CONFLICT (id, version) DO NOTHING`, never `INSERT OR IGNORE`. When `changes` is 0, it compares the stored `json` with the incoming one and returns `'same'` or `'conflict'`. The loader refuses the pack on `'conflict'`. Using `OR IGNORE` would hide a constraint failure as `changes: 0`, and the follow-up read would then find no row.
- **`subject_pack.id` and `version` are `NOT NULL`.** SQLite allows NULL in a composite `PRIMARY KEY` on a rowid table, and NULLs never conflict, so a keyless pack row could be inserted any number of times.
- **The loader's fixture cards** go through `putCard`, which follows [0003](0003-server-owned-card-and-attempt-api.md) Amendment 4.
- **Verification:** the existing "putPack returns inserted, same, conflict" test, plus "putPack with a NULL id or version throws".

## Amendment 3 (2026-10-13, F1c design review, ARCH-2): scope of the F2 hard rule
Clarifies scope; the rule's text is unchanged. The F2 hard rule governs **subject packs (`pack.json`) and any pack text that enters a prompt**. Practice packs ([0008](0008-practice-engine-and-practice-pack-format-v1.md)) enter no prompt in F1c, and a guard test makes that structural, so the rule doesn't block them. The founder confirms this reading in [thread 0007](../team/threads/0007-applied-ai-aws-track.md) before F1c-T11 ships real content. The first practice-pack text placed in a prompt (the live grader) falls under the rule in full: it must be fenced and pass the gate.
