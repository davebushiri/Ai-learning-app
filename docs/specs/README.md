# Specs and tickets

Each feature has a folder `docs/specs/<ID>-<slug>/` containing:

| File | Written by | Purpose |
|---|---|---|
| `spec.md` | `technical-product-manager` | Problem, user stories, acceptance scenarios (voice and text), FRs, success criteria |
| `tasks.md` | `technical-product-manager` (QA appends bugs) | Tickets with owner, exact files, interfaces, acceptance criteria, tests, size and dependencies |
| `review.md` | `principal-architect` | Design review before the build, code review after |
| `qa-report.md` | `qa-engineer` | Evidence per acceptance criterion, regression, and a SHIP or DON'T SHIP verdict |

Templates and rules: [`.claude/skills/writing-specs/SKILL.md`](../../.claude/skills/writing-specs/SKILL.md). The workflow is in [`CLAUDE.md`](../../CLAUDE.md).
