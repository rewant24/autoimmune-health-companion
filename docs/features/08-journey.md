---
number: 08
name: Journey
slug: journey
status: scoped
depends_on: [02-memory, 03-patterns, 05-doctor-visits, 06-doctor-report]
blocks: []
owner: rewant
scoping_ref: docs/scoping.md#feature-6-journey-pillar
adr_refs: []
last_updated: 2026-04-25
---

# Feature 08 — Journey

## Intent

Unified "looking back" pillar. Aggregates Memory, Doctor Reports, Patterns, flare timeline, and visit timeline into one scrollable narrative view. No new data capture — this is purely an aggregation/presentation shell.

## Scope in / out

- **In (MVP):** aggregation shell, section navigation (Memory / Reports / Patterns / flares / visits), empty states when a section has no data.
- **Out (backlog):** export journey as PDF, share journey snapshot, year-in-review.

## Dependencies

- **Reads:** Features 02, 03, 05, 06.
- **Blocks:** none.

## Chunks

Estimated: **2 cycles × 3 chunks = 6 chunks** (aggregation only — no new data).

**First build task = chunking cycle** (dual-track).

## Review notes
_Empty._

## Learnings
_Empty._
