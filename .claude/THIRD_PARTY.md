# Third-party sources

The agent team and skills in `.claude/` were written for this project. Parts are adapted from the open-source projects below, all **MIT-licensed**. Licenses were verified from each repo's LICENSE file on 2026-10-09.

| Source | Used for | License |
|---|---|---|
| [obra/superpowers](https://github.com/obra/superpowers): `test-driven-development`, `verification-before-completion`, `writing-plans` | Adapted into `.claude/skills/test-driven-development`, `verification-before-completion`, and the ticket structure in `writing-specs` | MIT, Copyright (c) 2025 Jesse Vincent |
| [github/spec-kit](https://github.com/github/spec-kit): spec, plan and tasks templates | The `spec.md` and `tasks.md` templates in `.claude/skills/writing-specs` | MIT, Copyright GitHub, Inc. |
| [bmad-code-org/BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) | The idea of the PM → architect → developer → QA handoff sequence (no text copied) | MIT, Copyright (c) 2025 BMad Code, LLC. "BMAD" is a trademark of BMad Code, LLC. |
| [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents): backend-developer, frontend-developer, qa-expert, product-manager, architect-reviewer | Reviewed for role coverage (no text copied) | MIT, Copyright (c) 2025 VoltAgent |
| [wshobson/agents](https://github.com/wshobson/agents): backend-architect, frontend-developer | Reviewed for role coverage (no text copied) | MIT, Copyright (c) 2024 Seth Hobson |
| [affaan-m/everything-claude-code](https://github.com/affaan-m/everything-claude-code): architect, planner, code-reviewer, tdd-guide | Reviewed for role coverage (no text copied) | MIT, Copyright (c) 2026 Affaan Mustafa |
| Michael Nygard, "Documenting Architecture Decisions" (2011) | The ADR format in `.claude/skills/architecture-decision-records` | Article (format idea only) |

**MIT notice** (applies to the adapted superpowers and Spec Kit material):

> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

When you copy code from any open-source project into this repo, add a row here with the license.
