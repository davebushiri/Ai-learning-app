# Data and evidence

How the engine records what happens, and how we'll know whether it works.

## 1. Event model

Events follow the shape of **xAPI statements** (actor, verb, object, plus result and context): one immutable, timestamped record per thing that happened. We don't need a full xAPI Learning Record Store. Keeping the same shape means data could later be exported to one, which matters for B2B and L&D buyers.

```jsonc
{
  "id": "evt_01J…",                 // ULID, also the dedup key
  "at": "2026-10-09T07:42:11.204Z",
  "actor": "learner_1",
  "verb": "stopped",                // see vocabulary below
  "object": { "type": "card", "id": "card_8f2…", "step": 6 },
  "result": { "outcome": "caught", "verdict": "correct", "reasoningScore": 0.75,
              "graderSource": "live", "confidence": "high", "latencyMs": 3400 },
  "context": { "subject": "db-scaling@3", "competency": "read-replicas",
               "mistakeType": "read-after-write-on-replica", "mode": "stop",
               "subtlety": 2, "sessionId": "ses_…", "attemptId": "att_…",
               "promptVersions": { "card": "card-generate@4", "grade": "grade@7" },
               "condition": "trained" }   // evidence arm, see §4
}
```

**Verbs:**

| Group | Verbs |
|---|---|
| Session and card lifecycle | `planned`, `started`, `step-shown`, `resumed`, `abandoned`, `completed` |
| Answers and grades | `stopped`, `explained`, `graded`, `chose` (next move) |
| Feedback and probes | `flagged`, `rated-fairness`, `probe-answered` |
| Voice and mode | `mode-assigned`, `mode-switched`, `mode-fallback`, `voice-command`, `stt-corrected` |
| Subject changes | `subject-built`, `subject-edited`, `map-change-accepted` |

**Outcomes on a mistake:** `caught`, `caught_late`, `wrong_reason`, `missed`, plus `false_alarm` on a clean step and `clean_pass` when a no-mistake run is correctly left alone.

## 2. Data model (SQLite)

The event log is the source of truth. Everything marked *projection* can be dropped and rebuilt from it.

```sql
-- truth
CREATE TABLE event (id TEXT PRIMARY KEY, at TEXT, actor TEXT, verb TEXT, object_json TEXT,
                    result_json TEXT, context_json TEXT);
CREATE TABLE subject_pack (id TEXT, version INT, json TEXT, provenance_json TEXT, created_at TEXT,
                           PRIMARY KEY (id, version));
CREATE TABLE card (id TEXT PRIMARY KEY, subject_id TEXT, subject_version INT, mode TEXT,
                   competency_id TEXT, mistake_types_json TEXT, subtlety INT, json TEXT,
                   verify_json TEXT, status TEXT,        -- ok | quarantined | defect
                   prompt_version TEXT, model TEXT, source TEXT, created_at TEXT);
CREATE TABLE goal (id TEXT PRIMARY KEY, learner_id TEXT, subject_id TEXT, type TEXT,
                   target_date TEXT, weekly_sessions INT, anchor TEXT);
CREATE TABLE llm_call (id TEXT PRIMARY KEY, at TEXT, pipeline TEXT, prompt_version TEXT, model TEXT,
                       ms INT, input_tokens INT, output_tokens INT, cache_read INT, cost_usd REAL,
                       outcome TEXT);                     -- ok | fallback | refusal | timeout
CREATE TABLE evidence_assignment (learner_id TEXT, mistake_type_id TEXT, condition TEXT,  -- trained | held_out
                                  assigned_at TEXT, PRIMARY KEY (learner_id, mistake_type_id));
-- projections (rebuildable)
CREATE TABLE competency_state (learner_id TEXT, competency_id TEXT, rating REAL, attempts INT,
                               stage TEXT, last_seen_at TEXT, PRIMARY KEY (learner_id, competency_id));
CREATE TABLE review_item (learner_id TEXT, mistake_type_id TEXT, box INT, due_at TEXT, fsrs_json TEXT,
                          PRIMARY KEY (learner_id, mistake_type_id));
CREATE TABLE daily_plan (learner_id TEXT, date TEXT, plan_json TEXT, PRIMARY KEY (learner_id, date));
```

**Mastery maths** (`shared/mastery.js`, pure):
- An Elo rating per competency against card difficulty. Difficulty starts from subtlety (1000 / 1200 / 1400) and is then learned per card.
- Outcome scores:

  | Outcome | Score |
  |---|---|
  | caught + correct | 1.0 |
  | caught + partial | 0.7 |
  | caught late | 0.6 |
  | wrong reason | 0.3 |
  | missed | 0 |

- **Low-confidence grades** count at half weight.
- **False alarms** feed calibration, not mastery.
- **Difficulty targeting:** pick cards where P(catch) ≈ 0.7.
- **Review queue:** FSRS via `ts-fsrs` (MIT). Each mistake type is an FSRS card, and outcomes map to ratings: missed → Again, wrong reason → Hard, caught late → Good, caught → Easy.

## 3. Metrics

| Family | Metric | Definition | Why it matters |
|---|---|---|---|
| **Learning** (headline) | **Probe gain, trained vs. held-out** | Delayed probe accuracy on mistake types practised, minus accuracy on matched mistake types not yet practised | The only metric that shows the app *teaches*, rather than just that you got better at playing it |
| | Retention curve | Probe accuracy at 7, 14 and 30 days after last practice | Whether spacing works |
| | Transfer | Accuracy on boss cards and novel settings for mastered competencies | Learning, not memorizing stories |
| | Calibration | P(correct \| confident STOP) | Exam-taking skill; overconfidence warning |
| **Engagement** | Sessions per week vs. goal | | Habit formation (target: holds for 8+ weeks) |
| | Completion rate | Completed sessions over started sessions | Focus fit |
| | Time-to-STOP | Latency after a mistake line | Attention during narration |
| | Abandon step | Where sessions are dropped | Pacing problems |
| **Content quality** | Defect rate | Flags plus verifier rejections, per 100 cards | Can AI-built subjects be trusted? |
| | Verifier precision and recall | On a hand-labelled set of cards | Whether the gate itself works |
| | Grader agreement | Cohen's κ between the grader and your "was this fair?" answers, plus periodic manual relabels | Whether grades can be trusted for mastery |
| | Fallback rate | Share of grades and cards served by fallback | Reliability |
| **Mode (A/B)** | Voice vs. text: completion, catch rate, explanation quality | Randomized per session; see [`voice-first.md`](voice-first.md#6-the-ab-test-voice-vs-text) | Whether voice-first helps you |
| **Cost** | Cost per session, per learner-month | From `llm_call` | Viability |

## 4. Proving it works with one learner: the built-in experiment

One person means a within-subject, single-case design. Single-case research recommends comparable trained and untrained item sets, randomization, and a delayed retention probe. The engine builds that in:

1. **Matched split.** When a subject is built, the mistake types inside each competency are **randomly split** into *trained* and *held-out* sets, balanced by severity and subtlety (`evidence_assignment`).
2. **Practice only the trained set** for a fixed window, for example 3 weeks. Held-out mistake types appear only in probes.
3. **Probes** run at baseline (the starting check) and then weekly, mixing trained and held-out items. They're presented the same way, give no feedback until the window ends, and use **new** scenarios, so nothing is answered from memory of a story.
4. **Analysis:** the trained-minus-held-out difference in probe accuracy over time, using a randomization test that matches how items were assigned. This accounts for single-case data where observations depend on each other.
5. **Then cross over:** held-out types become trained, which gives a second test and ensures nothing stays unlearned.

The app shows this on the Progress screen ("Learning evidence") in plain words: *"On mistakes you've practised you're at 78%; on ones you haven't, 41%. That gap is what the app taught you."*

## 5. Success criteria for the pilots

These are set before the pilots start so the data can't be reread to fit.

| Question | Pilot | Pass if |
|---|---|---|
| Does it teach? | New-to-you subject | Trained vs. held-out probe gap is at least 20 percentage points at 2 weeks, holds at 30 days, and is significant on the randomization test |
| Can AI-built subjects be trusted? | Subject you can judge | Defect rate under 5 per 100 cards after verification; verifier catches at least 80% of planted defects in a seeded test set |
| Are grades trustworthy? | Both | κ ≥ 0.6 between the grader and your fairness ratings; under 10% of grades low-confidence |
| Will you keep using it? | Both | At least 75% of weekly session goals met for 6 of 8 weeks; completion ≥ 80% |
| Is it affordable? | Both | Under $15 per learner-month at your usage, measured |

If a criterion fails, the event log shows where: which pipeline, prompt version, competency or card. That diagnosis is the reason the system is event-sourced and every output is stamped.

## 6. Privacy

- **Local SQLite by default**, with one-click export (JSON of events plus packs) and delete.
- **Explanation text** is stored for grading and mining but is never sent anywhere except the Claude call that grades it.
- **Opaque learner IDs.** No email or name goes to the API.
- **Uploaded sources** stay local and are retrieved into prompts only as short chunks.
