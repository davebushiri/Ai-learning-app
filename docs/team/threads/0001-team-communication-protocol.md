# 0001: Adopt the team communication protocol

**Type:** PROPOSAL
**Status:** decided (founder to confirm)
**Opened by:** lead session · 2026-10-09
**Decider:** founder
**Targets:** `docs/team/README.md`, `.claude/skills/team-discussion`, `.claude/agents/*`
**Participants:** all roles (from F1 onward)

## Context

The founder asked for a way for the agent team to share ideas, push back, pressure-test and run product research and discussions. Claude Code subagents report only to the session that spawned them. Live agent teams are experimental and their mailboxes are deleted when a session ends. The cloud container this work runs in is also deleted. Any discussion that matters has to live in the repo.

## Options

1. **Live agent teams only.** Real-time messaging, but nothing survives the session; experimental; interactive sessions only.
2. **GitHub Issues or Discussions.** A good interface for people, but agents need API calls to read and write, it lives apart from the code, and it doesn't work offline.
3. **Markdown threads in the repo** (a blackboard), plus optional live chat that gets summarized into the thread. Durable, versioned with the code, reviewable in PRs, and agents use their normal file tools.

---

## Entries

### lead session · 2026-10-09 · POSITION
Recommend option 3. The research is in `docs/team/README.md`:
- debate helps, but mostly fails by agents agreeing on the wrong answer, so we need a blind first round, an assigned devil's advocate and a cap on rounds;
- typed, structured artifacts beat free chat (MetaGPT);
- a shared blackboard with a controller works, as long as writes don't collide (one file per thread, append-only).

GitHub Discussions can be added later as a human-friendly mirror without changing the protocol.
**Confidence:** high
**What would change my mind:** thread files getting too long to stay useful (then split them per decision), or the founder preferring to work in GitHub's UI.

### lead session · 2026-10-09 · DECISION (recorded for the founder; confirm or redirect)
The founder asked for the communication flow to be built ("share ideas, push backs, pressure test, product research and discussions"). Option 3 adopted, with the decision rights in the README. Live agent teams stay off by default. Follow-ups: update the agents and `CLAUDE.md` to use the protocol, and run the F1 proposal review with it.
