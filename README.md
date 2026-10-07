# Stop the Apprentice

An AI apprentice talks through a trade job out loud and makes mistakes along the way. Some are sloppy and some are dangerous. You're the supervisor. Hit **STOP**, say what's wrong and why, and the AI grades your catch. Any mistake you miss shows up at the end as "here's what happened next."

## Quick start

```bash
cd stop-the-apprentice
npm install
npm run mock      # no API key needed: cached scenarios + keyword grading
# open http://localhost:3000 in Chrome (needed for voice input)
```

To use Claude for real, copy `.env.example` to `.env`, set `ANTHROPIC_API_KEY`, and run `npm start`. The badge in the top bar shows **MOCK** or **LIVE**.

`npm test` runs the scoring and contract tests in under a second. Run it before every push.

Requires Node 20.12 or newer.

## How it fits together

```
web/ (browser)                          server/ (Node, no framework)
  app.js     game loop + UI   ──GET /api/scenario?trade=…──▶  index.js ──▶ llm.js ──▶ Claude
  speech.js  voice out / in   ──POST /api/grade──────────▶            prompts/*.js
  api.js     fetch calls                                       │ falls back to
                                                               ▼
shared/  (imported by both browser and server)            fixtures/scenarios/*.json
  contract.js     data shapes + JSON schemas + validator
  scoring.js      points, penalties, ratings (pure functions)
  mock-grader.js  keyword grader for MOCK mode and fallbacks
```

**Demo safety:**
- If live generation fails or returns an invalid scenario, the server serves the cached fixture.
- If live grading fails, the keyword grader takes over.
- The "Use cached scenario" checkbox forces the fixture, so the demo stays the same on every run.

## The contract (agree on this first, change it only together)

Full definitions are in [`shared/contract.js`](shared/contract.js).

```jsonc
// Scenario  (GET /api/scenario)
{ "id", "trade", "title", "setting", "apprentice",
  "steps": [ { "id": 3, "line": "Not gonna bother with the tester…",
               "error": null | { "severity": "minor|major|critical",
                                 "summary", "why", "correctAction",
                                 "consequence", "keywords": [] } } ] }

// Grade  (POST /api/grade)
// request:  { scenario, stepId, errorStepId | null, explanation }
// response: { verdict: "correct|partial|wrong|false_alarm", reasoningScore: 0..1, feedback }
```

## Team split: who owns what

Each person works in their own files, so merges stay clean.

### 1. The Brain: AI and content
**Owns:** `server/prompts/*`, `server/llm.js`, `fixtures/scenarios/*`

- [ ] Run `npm start` with a key and generate 5 or more scenarios per trade. Read them as a tradesperson would: are the "correct" steps actually correct?
- [ ] Tune `SCENARIO_SYSTEM` so mistakes are catchable from the narration but not obvious.
- [ ] Tune `GRADE_SYSTEM` so it's generous to plain-language answers. Test it with messy, speech-to-text-style explanations.
- [ ] Check grading latency. If it's slow on stage, lower `GRADE_EFFORT` or try another model with `CLAUDE_MODEL`.
- [ ] Add a trade: add an entry in `server/prompts/trades.js` and save your best generated scenario as its fixture.

### 2. The Stage: frontend and voice
**Owns:** `web/*`

- [ ] Test voice in and out on the demo laptop, in Chrome, in a noisy room. Adjust `rate` and voice choice in `speech.js`.
- [ ] Tune `STEP_GAP_MS` in `app.js` so there's enough time to react without dragging.
- [ ] Polish the moments that matter: the STOP press (sound or flash?), the feedback reveal, and the "what happened next" screen.
- [ ] Make sure the whole loop works with the keyboard only (Space to stop, Enter to submit), in case the mic dies.

### 3. The Ringmaster: game, integration, and demo
**Owns:** `shared/scoring.js`, `tests/*`, deployment, demo script, pitch

- [ ] Tune `RULES` in `scoring.js`, and keep `npm test` green.
- [ ] Play every fixture start to finish. File bugs to the owner.
- [ ] Deploy anywhere that runs Node (e.g. Render or Railway: build `npm install`, start `npm start`, set `ANTHROPIC_API_KEY`).
- [ ] Write the demo script and pick the scenario. Let a judge be the one who yells STOP.
- [ ] Write the pitch paragraph: who pays (apprenticeship programs, contractors, insurers) and why "catching someone else's mistake" builds judgment.

## Sync points

| Time | Checkpoint |
|---|---|
| 0:00–0:15 | Everyone runs `npm run mock` and plays one job. Read the contract. |
| 1:00 | **Integration 1:** a live-generated electrical scenario plays end to end. |
| 2:00 | **Integration 2:** voice in and out, scoring, and the results screen on the demo laptop. |
| 2:30 | **Feature freeze.** Bug fixes and new trades only. New trades are a prompt change plus a fixture. |
| 2:30–3:00 | Rehearse twice with the cached scenario, plus once live. |

## Tunables

| Where | What |
|---|---|
| `.env` `CLAUDE_MODEL` | Model used for both calls (default `claude-opus-5-5`) |
| `.env` `SCENARIO_EFFORT` / `GRADE_EFFORT` | Thinking effort, `low`…`max` (defaults `medium` / `low`) |
| `shared/scoring.js` `RULES` | Points, grace window, penalties |
| `web/app.js` `STEP_GAP_MS` | Pause between lines |
| `web/speech.js` | Voice choice and speaking rate |

The server requests use the Claude API's server-side refusal fallback (`fallbacks: "default"`). If a safety classifier declines a request (hazard narration can trip one), the request is retried on another model instead of failing. Remove it in `server/llm.js` if you don't want it.
