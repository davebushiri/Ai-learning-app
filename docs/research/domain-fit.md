# Domain fit: PMP, product management, software architecture

*Research workstream 2 of 4. The 4 sample scenarios are in [`sample-scenarios/`](sample-scenarios/). All of them pass `validateScenario()` unchanged.*

## 1. PMP

**Exam facts.** The proxy blocked pmi.org, so these come from search-indexed PMI pages and prep vendors. Verify them before shipping any exam claims.

- **Weights.** A new Exam Content Outline took effect on **July 9, 2026**, replacing the January 2021 one.

  | Domain | Old weight | New weight | Tasks |
  |---|---|---|---|
  | People | 42% | 33% | 8 |
  | Process | 50% | 41% | 10 |
  | Business Environment | 8% | 26% | 8 |

  Tasks went from 35 to 26. **Change control and risk moved to Business Environment.**
- **Approach mix:** about 40% predictive and 60% agile/hybrid.
- **Format:** 180 questions (170 scored), 240 minutes, two 10-minute breaks.
- **Question types:** new **case/scenario sets** and **graphic-based** items, alongside multiple choice, multiple response, matching and hotspot.
- **PMBOK 8th edition** came out in November 2025, but the exam is built from the outline, not the PMBOK.

**Fit with STOP.** PMP items are situational judgment items: what should the PM do NEXT or FIRST? The "PMI mindset" behind the answers:

1. Assess before acting.
2. Go to the source and find the root cause.
3. Follow the agreed process: change control, the risk register, escalation paths.
4. Empower the team (servant leadership).
5. Escalate after acting within your own authority, and to the right person.
6. Never skip quality, and never start work on an unapproved change.

Each part of the game maps onto the exam:
- A PMP item is a frozen narration, and STOP trains recognizing the wrong move.
- The explanation trains the reasoning that defeats distractor options.
- `correctAction` is the best answer.
- `consequence` makes the rule stick.

The remaining gap is choosing among four near-correct options. **Choose the next move** closes it.

**Grader addition for this pack:** "Judge against PMI's mindset. A real-world answer that skips analysis or process is partial."

**Severity, redefined for projects:**

| Severity | Meaning |
|---|---|
| Critical | Project failure, compliance or contract breach, ethics or safety violation |
| Major | Baseline overrun, stakeholder escalation, rework |
| Minor | A communication or documentation habit that erodes trust |

**Copyright and trademark:**
- Don't reproduce exam-outline enabler text or PMBOK prose. Store our own paraphrase plus a reference ID, for example `{ "id": "BE-3", "label": "Managing and controlling changes (paraphrase)" }`.
- Never use real or recalled exam items, and don't accept user-submitted "real questions".
- PMP and PMBOK are registered marks of PMI. Use "prep for the PMP® exam" plus "Not affiliated with or endorsed by PMI".

**Samples:**
- [`pmp-scope-change.json`](sample-scenarios/pmp-scope-change.json): predictive, a hallway scope change in a regulated warehouse system. Mistakes: minor at step 3 (promised a change before it was approved), major at step 6 (no real impact analysis), critical at step 8 (the team starts building an unapproved change).
- [`pmp-agile-conflict.json`](sample-scenarios/pmp-agile-conflict.json): hybrid, two stakeholders and one sprint. Mistakes: major at step 5 (the team lead reprioritizes the backlog by seniority), minor at step 7 (no record of the decision), critical at step 9 (scope added mid-sprint and the security review skipped). Step 3 sounds like a shortcut but is good practice.

## 2. Product management

**Good "spot the mistake" material:**
- **Discovery interviews:** leading questions, pitching the solution, treating "would you use it?" as evidence (the Mom Test).
- **Discovery vs delivery:** building before the problem is validated.
- **Outcome vs output:** feature roadmaps with no target metric.
- **Metrics:** vanity metrics, no guardrail metric, peeking at A/B tests.
- **Prioritization:** invented RICE numbers, the highest-paid person's opinion, one loud customer.
- **Roadmaps:** external dates promised during discovery.
- **Launch readiness:** no rollback plan, no instrumentation, a 100% launch.
- **Stakeholders:** surprising execs.
- **PRDs:** no problem statement, no non-goals.

**Severity:**
- Critical: an external commitment, a legal or privacy breach, or a large wasted investment.
- Major: a wrong build decision or a misleading conclusion.
- Minor: a technique flaw.

**Grounding:** ground each pack in named frameworks, because there's no single canonical body of knowledge: continuous discovery, the Mom Test, RICE, North Star, opportunity solution trees.

**Sample:** [`product-discovery-interview.json`](sample-scenarios/product-discovery-interview.json). Mistakes: minor at step 5 (a leading question), major at step 7 (treating a polite yes as validation), critical at step 9 (a roadmap commitment based on one interview).

## 3. Software architecture

**Good material.** Arguably the best fit of the three:
- **Distributed systems:** the fallacies of distributed computing, retries without idempotency, retry storms, no timeouts or circuit breakers, dual writes without an outbox, at-least-once treated as exactly-once.
- **Data:** a shared database between services, cache stampedes, read-after-write against replicas, non-backward-compatible migrations.
- **Resilience:** single points of failure, untested backups, no rollback path.
- **Security:** secrets in the repo, over-broad IAM, missing authorization on internal APIs, PII in logs.
- **Decisions:** no ADR, unstated trade-offs, resume-driven choices, premature microservices.
- **Incidents:** debugging before mitigating, changing many things at once, blameful postmortems.

**Severity:**
- Critical: an outage, data loss, a breach, or financial harm to customers.
- Major: coupling, a scalability ceiling.
- Minor: documentation or observability hygiene.

**Sources to name in a pack:** Deutsch's fallacies, the Google SRE books, AWS Well-Architected, OWASP Top 10, Nygard's ADR format, ATAM.

**Sample:** [`architecture-checkout-review.json`](sample-scenarios/architecture-checkout-review.json). Mistakes: major at step 4 (reading another team's database directly), critical at step 6 (retrying payments with backoff and jitter but no idempotency key), minor at step 8 (no ADR).

## 4. Mechanic variants (STOP stays the core)

| Variant | What it trains | Effort |
|---|---|---|
| **Choose the next move**: 4 options after STOP, graded deterministically | PMP "what should the PM do NEXT/FIRST" | M |
| **Fix it**: state the remedy, graded on cause and remedy separately | Producing the fix, not just recognizing the problem | S |
| **Rewind and replay** after a miss; later, branching | Learning from consequences | S (replay) / L (branching) |
| **Reverse mode**: you narrate, the AI mentor STOPs you | Unaided judgment, highest transfer | L |
| **Boss-level case**: 14–20 steps, 5–6 mistakes, some only visible by connecting two steps | PMP case sets, systems thinking | M |
| **Multi-character meeting**: steps carry a speaker | Stakeholder conflict, facilitation | M |
| **Document review**: charter, PRD, ADR or risk register as sections | Governance artifacts, PMP graphic items | M |
| **Timed incident**: score decays with time-to-STOP | The SRE mitigate-first mindset | M |
| **Daily drill** with spaced repetition | Focus and consistency | M |
| **Confidence call**: "sure" or "unsure" at STOP | Calibration, exam triage | S |

**Priorities for focus:** choose-the-next-move, the daily drill, rewind, boss levels.

## 5. Domain packs

**Trades-specific today:**
- `server/prompts/scenario.js`: apprentice, journeyman, injury-based severity, NEC/OSHA/EPA, electrical slang.
- `server/prompts/trades.js`: `hazardHints`, `criticalHints`, `twists`.
- `server/prompts/grade.js`: "trade job", "encouraging journeyman", electrical examples.
- `shared/mock-grader.js`: the electrical slang `SYNONYMS` table.
- `shared/scoring.js`: the rating labels "Someone got hurt" and "Journeyman eyes".
- `web/app.js` and `web/index.html`: copy such as "getting their tools", "Nobody got hurt", `trade-select`.
- `shared/contract.js`: the field names `trade` and `apprentice` (keep them as aliases), and a global `SCENARIO_RULES`.

**Pack shape (sketch):**
```jsonc
{
  "id": "pmp", "label": "PMP: situational judgment",
  "persona": { "character": "junior project manager", "learnerRole": "PMO mentor",
               "mentorVoice": "an encouraging senior PM", "names": ["Jordan", "Priya"] },
  "severity": { "critical": "...", "major": "...", "minor": "..." },
  "competencies": [{ "id": "BE-change", "label": "Managing and controlling changes",
                     "weight": 0.04, "approach": ["predictive","hybrid"], "source": "PMP ECO 2026, Business Environment" }],
  "approachMix": { "predictive": 0.4, "agile": 0.3, "hybrid": 0.3 },
  "mistakeTaxonomy": ["acts before assessing", "bypasses the agreed process", "escalates too early or too late", "..."],
  "criticalTaxonomy": ["unapproved change in a regulated system", "ethics or compliance breach"],
  "twists": ["the sponsor is on leave", "a vendor contract is fixed price"],
  "groundingRules": "Judge by PMI-preferred practice; paraphrase, never quote PMI text.",
  "gradingRubric": { "correctWhen": "...", "partialWhen": "real-world fix that skips analysis or process" },
  "synonyms": { "approv": ["sign off", "green light"] },
  "ratings": { "missedCritical": "The project failed its audit", "top": "Seasoned PM" },
  "ui": { "loading": "Jordan is opening the project plan…", "clean": "Clean run. The project's on track." },
  "rules": { "steps": [8, 11], "severities": { "critical": 1, "major": 1, "minor": 1 } },
  "modes": ["stop", "next-move", "boss", "document"],
  "disclaimer": "Not affiliated with PMI. PMP is a registered mark of PMI."
}
```

**Code changes:**
- Prompts become templates filled from the pack.
- Optional contract fields: `mistake.topic`, `mistake.source`, `mistake.options` with `correctIndex`, `step.speaker`, and `scenario.pack` as an alias of `trade`.
- `validateScenario(s, { rules })`.
- Ratings and UI copy come from the pack.
- Add a learner model, the one genuinely new piece.

## Recommendation: PMP first

1. The exam deadline and the weighted outline give structure and a reason to show up.
2. Exam items closely match the STOP mechanic plus choose-the-next-move, and the new case sets are effectively boss levels.
3. The July 2026 outline is new, and most question banks are still catching up.
4. Build cost is low.

**Architecture second:** it's the most "gamey" domain, and the founder can verify its correctness personally. **Product management third:** it has the weakest canonical source.

**Main risk:** scenarios that are subtly wrong by PMI's standards. Hand-check fixtures for each competency, and have the grader explain why the PMI answer differs from the real-world answer.

## Sources

The proxy blocked direct fetches, so these were read through search-indexed text:

- PMI, PMP Examination Content Outline 2026. https://www.pmi.org/-/media/pmi/documents/public/pdf/certifications/new-pmp-examination-content-outline-2026.pdf
- PMI, new exam page. https://www.pmi.org/certifications/project-management-pmp/new-exam · PMI blog: https://www.pmi.org/blog/pmp-exam-change · Pilot FAQs: https://www.pmi.org/certifications/project-management-pmp/new-exam/pilot-faqs
- https://blog.goldstandardcertifications.com/pmp-exam-transition-july-2026
- https://mypreppilot.com/pmp/learn/pmp-business-environment-domain-2026
- https://blog.masterofproject.com/new-pmp-exam/
- https://www.pocketprep.com/posts/the-new-pmp-question-types-what-the-2026-exam-actually-looks-like/
- https://www.project-management-prepcast.com/kunena/pmp-exam-discussion/14446-pmp-2026-question-types-what-actually-changes
- https://www.learningtree.com/blog/pmbok-guide-8th-edition-whats-new/
- https://www.certcrush.app/blog/pmp-exam-changes-2026
- https://www.pmlearning.org/blog/pmp-exam-content-outline-2026-what-changed
