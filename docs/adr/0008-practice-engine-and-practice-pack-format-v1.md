# 0008. A separate practice engine, practice pack format v1, and its seams

**Status:** Accepted (2026-10-13). One item needs a founder confirmation before content ships: see "Scope of the F2 hard rule".
**Date:** 2026-10-13   **Deciders:** principal-architect
**Thread:** [0007](../team/threads/0007-applied-ai-aws-track.md) · **Spec:** [F1c](../specs/F1c-practice-engine/spec.md), design review in [`review.md`](../specs/F1c-practice-engine/review.md) (ARCH-1, 2, 3, 5, 6, 7)

## Context
- The founder made an Applied AI track the immediate priority (thread 0007). Its four modes (learn, catch, scenario, interview), zero-error sets and per-dimension rubrics don't fit pack format v1 ([0006](0006-pack-format-v1.md)), whose cards need exactly 3 mistakes (`validateScenario`).
- F1a Wave 2 is on hold, and its golden replay (61 runs) must stay byte-identical. So a second engine has to sit beside the card engine without touching it.
- There is no API key (founder F-3), so grading is offline. Invariants 1, 2, 5, 6 and 7 still apply in full.
- `server/packs.js` warns about and skips every `packs/<dir>` without `pack.json`.

## Options considered
1. **Extend pack v1 and the card engine** (zero-mistake cards, modes, rubrics): rejected for now. It edits `shared/contract.js`, `shared/mock-grader.js` and the attempt routes, all F1a Wave 2 files on hold behind the golden replay.
2. **A separate practice engine, with its own format, routes and page, sharing storage, the event log and the static server** (chosen). Zero golden risk, and it can ship in days.
3. **A separate root (`practice-packs/`)** to avoid the loader clash (ARCH-1 c): rejected. The guard is one line, and `packs/**` already has an owner.
4. **Matcher in `shared/`** by extracting helpers from `shared/mock-grader.js` (ARCH-5 b): rejected. It edits F1a-T13b's file during the hold. And a server-only module makes "the browser never grades" structural, not a convention.

## Decision
**Practice engine.** It has its own routes (`/api/practice/*`), services (`server/services/practice*.js`) and page (`web/practice.html`, `web/practice/*`). It shares `server/db.js`, `appendEvents`, `putPack`, `server/http.js` and `shared/events.js`. `db.appendEvents` stays the only write path to `event`. The practice service is this engine's session engine. It never calls the card engine's services or routes, and they never call it.

**Practice pack format v1** (schema in the F1c spec, with the review's changes C1 and C2):
- Layout `packs/<id>/practice.json` (manifest, `format: "practice-v1"`), `schedule.json`, `exercises/<id>.json` and `reference/<id>.md`. It is never named `pack.json`.
- `validatePracticePack` is pure, never throws and returns problems. `loadPracticePacks` follows the `server/packs.js` pattern: validate, then skip with one `[practice]` warning; deep freeze; `Map` registries.
- Stored once through `putPack` as canonical JSON of the manifest, schedule, exercises and references. It is immutable per version, and `'conflict'` refuses the pack. Ids share the `subject_pack` key space with subject packs. The practice loader runs after `loadPacks()` and refuses an id that `getPack(id)` already holds.
- **Trust:** all practice pack text is untrusted (as in 0006). It is validated and capped, and the UI renders it as text only. Source links are set through `a.href` only after the validator's `https://` check.
- **Coexistence (ARCH-1 a):** `server/packs.js` skips, silently, a directory that has `practice.json` and no `pack.json`. That is one guarded line.

**Matcher (ARCH-5 a).** It lives in `server/services/practice-matcher.js`, which is server-only and pure. It reimplements the mock-grader techniques, and holds no subject words; any vocabulary comes from the pack's `lexicon`. It stamps `graderSource: "matcher"` and `graderVersion` (`matcher@N`), and any rule change bumps `N`.

**Speech seam (ARCH-6).** `web/practice/speech.js` is the only practice module that imports `/speech.js`. It re-exports what practice uses. Per-segment recognition comes from one additive, optional `onSegment({text, isFinal})` callback on `listen()` in `web/speech.js`; `web/app.js` doesn't pass it, so its behavior is unchanged. When F1a-T15 builds the `web/speech/` facade, it forwards `onSegment` and rewrites `web/practice/speech.js` in the same change. No other practice file changes.

**Grader seam (ARCH-7).** `createPracticeService({grader = matcherGrade})`. In F1c, `grader(input) → GraderOutput` is **synchronous**. Each request reads its events, grades and appends with no `await` in between, so no in-flight state exists. A later live grader:
- is `input => gateway.run({prompt, input, live, deadlineMs, fallback: () => matcherGrade(input)})`, a new prompt module with `VERSION` that fences every pack and learner string (inv. 5) and passes the eval gate (inv. 4);
- turns the seam async. That brings back ADR 0003 Amendment 3's in-flight join per `(attemptId, part)`, and needs its own amendment before it ships;
- widens `graderSource` additively (`"claude"`, `"fallback"`), fills `context.promptVersions`, and shows a visible fallback label (inv. 7).

**Scope of the F2 hard rule (ARCH-2).** 0006's F2 hard rule exists because a non-trades pack's text would land unfenced in a system prompt. It governs **subject packs (`pack.json`) and any pack text that enters a prompt**. Practice pack text enters no prompt in F1c, and a test makes that structural: no module under `server/ai/` or `server/prompts/` imports `server/services/practice*`, and no practice module imports `server/ai/*` or `server/prompts/*`. So the rule doesn't block F1c. Two conditions apply:
- **The founder confirms this reading in thread 0007 before F1c-T11 merges** real content. The rule's wording is a founder decision (F-0), so its scope is confirmed by the founder too. Fixture packs under `tests/` don't ship and aren't gated.
- **The live grader is the moment the F2 hard rule applies to practice packs.** It must fence pack text and pass the gate.

## Consequences
- Positive: the Applied AI track ships without touching F1a's golden surface. Answers stay server-side from day one. The engine shares the event log, so its evidence is in the same store.
- Negative / risks: **two engines, two pack formats, two keyword matchers.** That is accepted as temporary. **Convergence trigger:** before F2's Session Engine is specced, a new ADR either makes the practice engine the F2 session engine or migrates its packs. No third engine is allowed. The matcher and `shared/mock-grader.js` text helpers are consolidated once F1a-T13b has merged.
- Follow-ups: ADR 0002 Amendment 3 (practice events); review changes C1–C15 for the PM; F1a-T15 gains `web/practice/speech.js` and the `onSegment` forwarding in its Files.

## Verification
- `tests/practice-pack.test.js`: the validator and loader cases in F1c-T02, including "changed pack same version refused".
- `tests/pack.test.js`: "a directory with practice.json and no pack.json is skipped with no [packs] warning".
- A guard test (F1c-T04): "practice modules and server/ai, server/prompts never import each other" (grep).
- `tests/practice-web-state.test.js`: "no web/practice file imports server/ or mock-grader", and "only web/practice/speech.js imports /speech.js".
- The F1a golden replay shows 0 diffs after each F1c wave, including after the `onSegment` addition.
