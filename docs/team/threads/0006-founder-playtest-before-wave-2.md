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

### founder · 2026-10-13 · EVIDENCE
*Recorded by the lead from the founder's chat message on 2026-10-13. Overall: "The app is really functional."*

1. **Kind:** feature (branding). Rename "Stop the Apprentice" to something more all-encompassing. The founder asked for suggestions.
2. **Kind:** feel (UI). The UI could be more appealing. The founder asked for research on what visuals appeal to learners.
3. **Kind:** feel + feature (voice). The voice sounds robotic. The founder asked for research on voices that help people learn, and proposed a feature: let the user change voices.
4. **Kind:** bug. **Mode:** observed during play.
   - **Steps:** let the narration run for several lines.
   - **Expected:** the transcript scrolls to keep the newest line visible.
   - **Actual:** it doesn't auto-scroll, and the text overlaps the STOP button.
   - **How much it matters:** not stated.
5. **Kind:** feature (scoring). "I really like the point system." The founder asked for research on how to improve it.
6. **Kind:** feature (presentation). The talking works well. The founder asked for research on better visuals while the apprentice talks.

**Direction questions (founder):**
- **PMP:** when is the cheapest time to move to PMP content? It is the founder's own study goal, and would be a proof of concept.
- **Interview prep:** should the game also be an interview-prep tool?
- **Why these:** both are immediately usable, and the founder's network is in the same situations, so they can test and catch bugs.

The lead is running research on all of the above. The PM then sorts each item into Wave 2, F1b, F2 or later.

### founder · 2026-10-13 · DECISION
*Recorded by the lead from the founder's chat answers on 2026-10-13.*
1. **Name:** explore further. No pick yet.
2. **Order** (content now → Wave 2 + scroll fix → polish slice → F1b → PMP pack → F2): agreed in principle, but research further before taking any steps.
3. **PMP content:** yes, in parallel with Wave 2. Research free online papers and material first, then help the founder create scenarios that teach the material.
4. **New request:** learn from Lathoa (a working "spot the AI's mistake" product). Find whether it, or something similar, is open source and could be adapted, so we don't reinvent the wheel.

**Wave 2 stays on hold** until the research is in and the founder says go.

### technical-product-manager · 2026-10-13 · POSITION
**Answering:** the founder's order (DECISION above, item 2); where the scroll fix and voice ranking land; whether paper-playtest labels can be F1b's 32; the critical path to PMP; a smaller first PMP milestone. No spec edited. Every placement below waits for the founder's go.

**1. What the golden replay can and can't see** (`tests/golden/harness.mjs`). It records the `innerText` of a fixed list of ids (`:231, :237, :272, :300, :326`), each line's text and class (`:250, :274`), focus ids, and one `spoken` entry per `speechSynthesis.speak` call (`browser-stubs.js:33`). It never records scroll, geometry, `u.voice` or `u.rate`, and `getVoices()` returns `[]` (`browser-stubs.js:45`). `checkVisibility()` (`:95`) doesn't detect one element covering another. Screenshots aren't asserted.
- **Scroll fix (CSS `scroll-padding-bottom`, research option 1):** zero golden diff. The replay also can't prove the fix, so the evidence has to be an e2e bounding-box check at 390 px in voice and text mode.
- **Voice ranking:** zero diff (no voices in the stub). **One sentence per utterance:** changes `spoken` in every voice run and `outcomeLine` (`:282` takes the first utterance). The allow-list "never grows" (tasks.md:87), so this can't land in F1a.
- **Picker:** the harness finds controls by substring label (`getByLabel('Job')`, `'Read aloud'`, `:229–235`). A new label that contains those words breaks every run with a strict-mode error. Persisting the choice in localStorage fails `tests/e2e/F1a.e2e.mjs:1207–1211` (storage must stay empty, FR-011).
- **Focal line:** zero diff only if it is styled on the existing `li.current` class (`web/app.js:99–101`). A new class shows up in `line N class:`. **Progress bar:** a new id that isn't recorded, so zero diff, but also no evidence. **Points breakdown:** inside `#feedback-points` it breaks `parseInt` (`:333`); if spoken, it changes `spoken`. The web can't compute it either, because T19a forbids importing scoring in `web/`. It needs an additive StopResponse field. [ARCH: ADR 0003 amendment]

**2. Misordered items**
- **Rating bug → F2, not polish.** It can't happen today, because all 3 cards have 3 mistakes. Fixing it needs a new rating key, but `RATING_KEYS` is fixed at 5 and there are exactly 4 tiers (ADR 0006). `shared/scoring.js` is sequenced T21 → T18. It ships with the zero-mistake ladder cards (spec Later:341).
- **Polish runs in parallel with F1b, not before it.** It is off the PMP critical path. F1b is mostly backend and evals work. The two meet only in `web/` (F1b's copy sweep and subject picker), so those tickets go after polish.
- **Hidden F1b work, needed before any second pack:** (a) a subject picker, because T17b plays `subjects[0]`; (b) non-trades pack fields, because `hazardHints` is required (FR-019); (c) a golden re-baseline when the "Job" label goes, because the harness looks up `getByLabel('Job')`.

**3. Placement**
- **Scroll fix → Wave 2**, as a new frontend S ticket after T17d (`web/styles.css`, maybe `app.js:105`), [P] with T16 and T18. T19b's replay covers it.
- **Voice ranker → Wave 2**, as a new S ticket after T15, touching only `web/speech/web-speech.js` (no other Wave 2 ticket edits it). It ranks **local voices only** and fixes the `male`/`Female` regex. It doesn't prefer network "Google" voices until splitting lands, because of the Chrome cutoff (voices.md §0).
- **Straight after Wave 2 (polish):** splitting, network voices, the picker, the focal line, the progress bar and the breakdown, with one golden recapture ticket.

**4. Paper labels as F1b's 32: no.** They can be a supplementary set.
- The 32 are a fixed trades set (`tests/fixtures/adversarial-inputs.json`), and the gate rule is old vs. new on its 27 non-false-alarm cases (0003:557). Labels on other inputs can't stand in for them.
- Blind rule (0003:390) requires that labellers don't see `expectedVerdict`. PMP has none, so blindness holds trivially. But the founder can't judge PMP answers (pmp report §4), so the gold labeller must be the certified reviewer. The founder can be a second rater.
- The research's "caught/partial/wrong" isn't E2. The sheet must use `goldVerdict ∈ VERDICTS` (`contract.js:23`), `alsoAcceptable`, `reasoningBand`, `unsure`, `labeller` and `date`.
- grade@1 is a trades prompt, so "new ≥ old − 2" on PMP passes trivially. A PMP set is **report-only** in F1b; I'll pre-register that in the F1b spec.
- The founder's 1–1.5 h on the real 32 can happen **today**, and that takes the labels off the critical path.

**5. Critical path to "founder studies PMP in the app" (live grading)**
F1a Wave 2 (~1–1.5 wk) → F1b spec and review (~2 d) → W7, W9 scaffold, picker and pack fields (~1–1.5 wk) → **key + 32 labels** → live gate → PMP pack (backend S–M, using reviewer-approved content from step 1) → play. Total is about 3–4 weeks of build, and the key date is the real long pole. The PMP content runs in parallel and needs the reviewer's sign-off before the pack ticket.

**6. A MOCK-only PMP pack: not by default.** A pack in `packs/` loads in every mode (T07a: no env hook), so live mode would grade it with the "trade job" prompt and write the results into the append-only log. That is shipping, and the hard rule forbids it. Keyword grading of PMP reasoning would also give the founder confident wrong feedback.
- Worth doing only if the key slips more than about 3 weeks past F1a, and only with all of: an explicit founder exception; a loader guard that refuses the pack unless `MOCK=1` and `DB_PATH=:memory:` (ADR 0006 amendment); the picker; and "practice grading, not a real grade" copy. That's about 1–1.5 d.
- Until then, the paper playtest is milestone 1.

**Confidence:** high on §1 and §4 (read from the code); medium on sizes and §6.
**What would change my mind:** the founder gives a key date within F1a (drop §6 entirely); the architect rules that `voice` is in the learner-visible golden layer; or evals shows that a PMP set fits under the $6 cap with 3 repeats and a supplied threshold.

### technical-product-manager · 2026-10-13 · RISK
**The golden replay fails at T17b on an id rename.** T17b renames `#trade-select` to `#scenario-select` (tasks.md:480). The frozen harness reads `'trade-select'` (`harness.mjs:231`), so 57 non-allow-listed runs lose that line (baseline `perfect-electrical-text.json:9`) and diff. Only T19b may edit the harness, and only `run.mjs`. · L: H · I: M (Wave 2 stalls at T17b) · Mitigation: QA files an F1a bug before Wave 2 starts. A one-line harness change, sequenced before T17b, records whichever id exists under the baseline key. The PM adds it to tasks.md on go. The architect confirms it doesn't count as an allow-list entry.

### technical-product-manager · 2026-10-13 · RISK
**Founder dependencies hold the PMP path:** the key (F-3 "later"), the 32 labels, and a PMP-certified reviewer (gold labels plus fixture sign-off). · L: H · I: H · Mitigation: get dates now. Do the 32 labels this week, independent of PMP. Recruit the reviewer during the paper playtest. F1b's scaffold builds without a key.

### technical-product-manager · 2026-10-13 · RISK
**Wrong PMP grades become permanent or get learned.** Three ways: a pack lands in `packs/` before the gate, so live grade@1 writes trades-framed grades into the append-only log; MOCK keyword grades are mistaken for real grades; or unreviewed content teaches non-PMI answers to a learner who can't spot them. · L: M · I: H · Mitigation: no PMP pack in `packs/` before the gate; any MOCK build is guarded, uses an in-memory DB and is labelled; the certified reviewer approves every fixture; the PMI disclaimer is shown.

### technical-product-manager · 2026-10-13 · RISK
**Paper-playtest data is misused or costs more than planned.** Three ways: labels on a non-E2 scale; testers' free text committed to the repo or sent to Anthropic without consent; or a PMP eval set pushing a 3-repeat run past the $6 cap. A 3-repeat run of the 32 already costs about $1.80–5.20, and about 20 PMP cases × 2 versions × 3 repeats adds about $1.10–3.20. · L: M · I: M · Mitigation: an E2-format sheet; written consent with anonymized text; the PMP set run separately or with 1 repeat (a founder money call).

### technical-product-manager · 2026-10-13 · RISK
**Voice changes stall narration or pass golden with no real evidence.** If the ranker prefers network voices, Chrome cuts off long utterances, `onend` may never fire and `play()` hangs (inv. 7). The golden replay is blind to voice and geometry, so an empty diff proves nothing about voice changes. · L: M · I: H · Mitigation: the Wave 2 ranker uses local voices only. The polish slice adds splitting plus a per-utterance watchdog. Evidence comes from unit tests on a fake voice list, e2e geometry checks and a real-browser check, not from golden.

### learning-designer · 2026-10-13 · RISK
*Appended by the lead from the learning-designer's report on the PMP scenario drafts.*
**Failure mode:** the founder labels the PMP playtest answers. Labelling means reading the answer key, which teaches all 10 mistake types before the trained-vs-held-out experiment runs. The held-out arm needs those types to appear only in probes (`data-and-evidence.md` §4). · **L:** H · **I:** H. · **Mitigation:** the founder plays all 10 cases blind as a tester, from `TESTER-COPY.md`. The PMP-certified reviewer plus one other experienced person label.

### learning-designer · 2026-10-13 · CHALLENGE
*Appended by the lead.*
`validateScenario()` in `shared/contract.js` rejects zero-mistake runs: it requires exactly one critical, one major and one minor mistake. But `user-flow.md`, `ai-flow.md` and `data-and-evidence.md` all plan clean control runs. Verified: the draft control `pmp-control-sprint-review-01.json` fails with "needs at least one mistake". The other 9 drafts pass. **Decider:** principal-architect + PM, before any clean-run card ships (F2).

### founder · 2026-10-13 · DECISION
*Recorded by the lead from the founder's chat answers on 2026-10-13, replying to the PM's questions.*
1. **API key (F-3):** held until we're ready for beta testers. So F1b's W7 live gate, and live PMP grading, wait for beta.
2. **The 32 grader labels:** the founder asked what this is. The lead explains it in chat. Still open.
3. **PMP reviewer:** the founder has a PMP-certified reviewer. The lead prepares a reviewer brief and a way to forward it.
4. **Exam date:** none registered yet.
5. **Wave 2 additions approved:** the golden-harness fix for F1a-B76, the scroll fix (founder finding #4) and the local-only voice ranker.
6. **Practice-only PMP pack: exception granted.** A MOCK-only, in-memory PMP pack for local play is allowed before F1b's gate. The PM's conditions apply:
   - a loader guard that refuses the pack unless `MOCK=1` and an in-memory database (ADR 0006 amendment);
   - a subject picker;
   - "practice grading" copy.

   This is an exception to the F2 hard rule, scoped to local MOCK play only.
7. **Tester consent:** yes. Research first how others run consent for beta and playtest data.
8. **Name:** waits until a public pilot. Keep brainstorming.
9. **New request:** research open source for building the app (a modern application UI, backend features for modern apps) so we pick up code instead of reinventing it. **End goal: a mobile app**; start with the web app.

**Wave 2 stays on hold** until the open-source research is in, because it may affect the UI and stack.
