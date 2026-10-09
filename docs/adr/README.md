# Architecture decision records

One file per decision: `NNNN-<title>.md`, written by `principal-architect`. The format is in [`.claude/skills/architecture-decision-records/SKILL.md`](../../.claude/skills/architecture-decision-records/SKILL.md).

Decisions made before this folder existed (D1–D15) are in [`docs/foundation/decisions.md`](../foundation/decisions.md).

## Index

| ADR | Title | Status |
|---|---|---|
| [0001](0001-sqlite-storage-and-append-only-event-log.md) | Storage on `node:sqlite`, forward-only migrations, trigger-enforced append-only event log | Accepted. Render out of F1 (founder F-5 confirmed) |
| [0002](0002-event-schema-v1.md) | Event schema v1 and the F1 verb subset | Accepted; Amendment 1 (F1a review) and Amendment 2 (`notGradedStepIds`, F1a re-review), 2026-10-09 |
| [0003](0003-server-owned-card-and-attempt-api.md) | Server-owned card and attempt API, and when answers are revealed | Accepted; Amendment 1 (F1a review) and Amendment 2 (`notGraded`, `skippedStepIds` echo, complete-in-flight 409; F1a re-review), 2026-10-09 |
| [0004](0004-no-grading-in-the-browser.md) | No grading in the browser; offline and unreachable-server behavior | Accepted; Amendment 1 (2026-10-09): Skip is "not graded" (PM Option B) |
| [0005](0005-ai-gateway-and-prompt-registry.md) | AI gateway, prompt registry, `x-prompt-id`, and what counts as a prompt text change | Accepted; amended 2026-10-09 (F1a review). W7 held at the gate (founder F-4 = a) |
| [0006](0006-pack-format-v1.md) | Pack format v1, trust and fencing of pack text, and rating keys | Accepted; amended 2026-10-09 (F1a review). F2 hard rule accepted (founder F-0) |
| [0007](0007-plain-node-eval-runner.md) | A plain Node eval runner for F1, with recordings and a pinned pending ratchet | Accepted. Founder: labels yes (F-1), cap $6/run and $25/month (F-2), `grade@1`/`scenario@1` pending entries approved (F-6); key later (F-3) |
