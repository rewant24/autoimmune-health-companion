# Features — Index & Template

> Each feature has its own MD file tracking chunks, user stories, and 4-lane acceptance. The master plan is in [`../build-plan.md`](../build-plan.md).

---

## Status vocabulary

| Status | Meaning |
|---|---|
| `scoped` | Exists in scoping doc only. No chunks defined. |
| `chunked` | Chunks + stories + acceptance written in the feature MD. |
| `ready` | Chunk has disjoint file ownership assigned and is queued for a build cycle. |
| `building` | Active build subagent is working on this chunk. |
| `in-review` | Build returned; 3 review subagents dispatched. |
| `fixing` | Review findings being addressed. |
| `second-review` | Fixes returned; one re-review agent checks the 1–2 things pass one missed. |
| `shipped` | Merged, acceptance criteria met, integration passes. |
| `learned` | Post-ship entry appended to feature MD + `architecture-changelog.md`. |

---

## Feature inventory

| # | Name | File | Status | Depends on | Blocks |
|---|---|---|---|---|---|
| 01 | Daily Voice Check-in | [`01-daily-checkin.md`](01-daily-checkin.md) | chunked | — | 02, 06, 07 |
| 02 | Memory | [`02-memory.md`](02-memory.md) | chunked | 01 | 06 |
| 03 | Patterns | [`03-patterns.md`](03-patterns.md) | scoped | 01 (≥14d data) | 05, 06 |
| 04 | Medications | [`04-medications.md`](04-medications.md) | scoped | 01 | 05 |
| 05 | Doctor Visits & Blood Work | [`05-doctor-visits.md`](05-doctor-visits.md) | scoped | 01 | 06, 08 |
| 06 | Doctor Report (Hybrid PDF) | [`06-doctor-report.md`](06-doctor-report.md) | scoped | 01, 02, 03, 04, 05 | 08 |
| 07 | Prepare-for-Visit | [`07-prepare-for-visit.md`](07-prepare-for-visit.md) | scoped | 05, 06 | — |
| 08 | Journey | [`08-journey.md`](08-journey.md) | scoped | 02, 03, 05, 06 | — |
| 09 | Community | [`09-community.md`](09-community.md) | scoped | — | — |
| 10 | Edge-case Templates | [`10-edge-case-templates.md`](10-edge-case-templates.md) | scoped | — | — |

---

## Build cycle pattern

Each cycle is one round of **3 build subagents → 3 review subagents → fix → second-pass reviewer**.

1. **Dispatch build (1 multi-tool-call message, 3 Agent calls)** — three build subagents, each given one chunk. File ownership disjoint. Each has: the chunk's user stories, acceptance criteria, files it owns, and a "do not touch" list.
2. **Integrate** — merge returned slices. Resolve any accidental overlap.
3. **Dispatch review (1 multi-tool-call message, 3 Agent calls)** — three review subagents. Each reviews the *entire* cycle's delta.
4. **Triage findings** — build a fix list grouped by chunk.
5. **Fix.** Status → `fixing`.
6. **Second review pass** — one Agent call. Prompt includes "decisions already made: X, Y, Z — don't re-litigate."
7. **Ship.** Status → `shipped`. Append changelog entry.

**Review subagent roles:**
- **Reviewer-1 (Brief alignment):** Does delta match stories + 4-lane acceptance? Flags scope creep, copy drift ("support-system" vs "caregiver").
- **Reviewer-2 (Spec violation + regression):** ADR violations? Breaks prior features' tests/flows? Schema/routing/auth check.
- **Reviewer-3 (Edge cases):** Offline, transcription fail, empty data, paywall boundary, concurrent edits, date-boundary, first/last checkin, locale/length.

---

## Chunking convention

- **One chunk = one build-subagent's slice in a single cycle.**
- Files owned by a chunk are disjoint from sibling chunks in the same cycle.
- A chunk can touch files from a *prior, shipped* cycle if extending them.
- A cycle has at most 3 chunks (the three parallel agents).
- Numbered `N.A`, `N.B`, `N.C` (cycle 1) and `N.D`, `N.E`, `N.F` (cycle 2).
- Each chunk holds 2–3 user stories. Past 3 stories → split into a new cycle.

---

## Feature MD template

```markdown
---
number: NN
name: Feature Name
slug: feature-slug
status: scoped
depends_on: [01-daily-checkin]
blocks: [06-journey, 07-patterns]
owner: rewant
scoping_ref: docs/scoping.md#feature-N-...
adr_refs: [ADR-005, ADR-014]
last_updated: 2026-04-25
---

# Feature NN — Feature Name

## Intent
One paragraph. What this feature does for Sonakshi. Why it exists.

## Scope in / out
- In: ...
- Out (deferred, linked to backlog): ...

## Dependencies
What data/features this reads. What depends on this shipping.

## Chunks

### Chunk N.A — <name>
- **Owner:** build-agent-A (Cycle X)
- **Files owned:** (exact paths, disjoint)
- **Status:** scoped | ready | building | in-review | fixing | second-review | shipped
- **Stories:** US-N.A.1, US-N.A.2

## User Stories

### US-N.A.1 — <title>
**As** Sonakshi **I want** ... **so that** ...

**Functional requirement:** ...

**Acceptance criteria:**
- **UX:** (flow, state transitions, what the user feels)
- **UI:** (components, visual states, breakpoints, accessibility)
- **Backend / data:** (schema, mutations, queries, invariants, error modes)
- **UX copy:** (exact strings; "support-system", never "caregiver/squad")

## Review notes
(Filled in after build cycles.)

## Learnings
(Filled in post-ship.)
```
