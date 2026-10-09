---
name: test-driven-development
description: Use when implementing any feature, bugfix or ticket, before writing implementation code. Enforces red-green-refactor with node:test in this repo.
---

# Test-driven development

*Adapted from obra/superpowers `test-driven-development` (MIT, © 2025 Jesse Vincent). See `.claude/THIRD_PARTY.md`.*

## The rule

**No production code without a failing test first.** If you wrote code before its test, delete it and start again from the test. Don't keep it "for reference".

## The cycle

1. **Red.** Write one small test for the next behavior from the ticket's acceptance criteria. Name it after the behavior, not the function.
2. **Watch it fail.** Run only that file (`node --test tests/<file>.test.js`). It must fail *for the expected reason*: a missing function or a wrong value, not a typo or import error. If it passes immediately, it tests nothing. Fix the test.
3. **Green.** Write the minimum code that makes it pass. No extras.
4. **Watch it pass,** and run the whole suite (`npm test`). Everything stays green.
5. **Refactor** while green: names, duplication, file size. Run the suite again.
6. Repeat for the next behavior.

## What good tests look like here

- **Behavior over implementation.** Assert on outputs, HTTP responses, emitted events, and what the user sees or hears. Never assert on internal calls.
- **Before writing a test, name the production change that would make it fail.** If you can't, the test is too weak.
- **Live AI paths use `tests/helpers/fake-claude.mjs`**, set to the mode you need (hang, 429, refusal, bad JSON, and so on), with short deadlines through env vars. Never the real API.
- **Server tests** start the app on `PORT=0` through `tests/helpers/server.mjs`. Database tests use `:memory:`.
- **Deterministic:** fixed clocks, seeded randomness, free ports, and kill every child process.
- **One behavior per test.** If the name needs "and", split it.

## Red flags: stop and restart the cycle

- "Too simple to test", "I'll add tests after", "I already checked it manually".
- A test that passed the first time you ran it.
- Mocking the thing under test, or asserting on a mock's calls instead of the result.
- Skipping, disabling or loosening a test to get green.
