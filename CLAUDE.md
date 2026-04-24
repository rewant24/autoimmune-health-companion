@AGENTS.md

<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->

# Process — Project Playbook

This project follows the **Project Process Playbook** (replaced the AI Weekender Handbook on 2026-04-24). The full playbook lives in Rewant's memory at `~/.claude/projects/-Users-rewantprakash-1/memory/reference_project_process.md` — read it at session start when working on non-trivial changes.

Short version:

**Before building**
- Discuss before building. Ask clarifying questions, never assume. Scoping doc before code.
- Scoping doc = (1) full end-to-end picture, (2) a POC to verify assumptions against real data/systems. Learnings go back into the doc; then scale up. Don't skip the POC because the plan "seems obvious."
- Rewant writes the scoping doc. I transcribe and ask focused follow-ups — never fill in his thinking.

**Research & system understanding**
- Grep the codebase before designing. Don't guess at rate limits, API behavior, or platform constraints.
- Verify project structure, deploy targets, configs, access, permissions upfront. Map every API call to its required scope.
- Store all incoming data, never filter at ingestion. Dump full schema before the first query.
- DB is the source of truth. For long-running pipelines: three independent persistence layers (authoritative store, per-item checkpoint, derived view on a timer). Never hold state in process memory.

**Build path (non-trivial work)**
1. Plan — each subagent's slice, files, acceptance criteria
2. 3 build subagents in parallel, one multi-tool-call message
3. 3 review subagents in parallel against the brief — regressions, spec violations, edge cases
4. Fix all findings (blockers, should-fixes, nits — don't defer)
5. Second review pass framed "decisions already made: X, Y, Z — don't re-litigate"
6. Ship

Coordinate, don't code. Review subagents are the safety net — no plan-approval gates.

**Quality bar**
- "The user sees ___." Write that sentence before any code. If the answer is a DB id, blank page, or internal format — the design is wrong.
- When cloning a product, use the original first. Reference is the spec, not memory.
- Verify with your own eyes. Build passing ≠ shipped. Use Playwright/browser tools for UI.
- Fix root causes, not symptoms. Reproduce end-to-end before pushing a fix.

**After shipping**
- `learnings.md` at repo root. Process failures first — what did we do first vs. what should we have done first. Not a changelog.
- Post-ship trio (parallel subagents): append learnings, commit the scope doc via its own docs PR, author NRQL monitoring queries for custom events.

**Documentation discipline (this project specifically):** Maintain four living docs continuously from day one — `docs/scoping.md`, `docs/post-mvp-backlog.md`, `docs/architecture-decisions.md` (append-only ADRs), `docs/architecture-changelog.md` (dated log of ADR changes). Plus `docs/build-log.md` (session chronicle).

**Language guardrails:** Use "support system" / "support-system member" — never "caregiver" or "squad". Community is a Slack-style peer channel only, never cohort-comparison or bio-data-sharing.

Writing style: lowercase headings, direct, no corporate tone.

# User research

Primary research lives in `./docs/research/`:
- [`sonakshi-lele-interview.md`](./docs/research/sonakshi-lele-interview.md) — Day-0 interview synthesis (patient profile, insights, patient quotes, doctor questions, personal goals, 13 themes → HMWs, MVP signals, language anchors). **Authoritative source for "what did the user say"** until more interviews are added.
- [`seed-entries.md`](./docs/research/seed-entries.md) — 18 fictional daily entries derived from the interview, for prototyping.
- `miro-export/` — source PDFs from the "Blue Sky Ideation - Lele" Miro board.

Any scoping, design, or copy decision about Sonakshi should trace back to these files, not to prior-session recollection.
