---
number: 07
name: Prepare-for-Visit
slug: prepare-for-visit
status: scoped
depends_on: [05-doctor-visits, 06-doctor-report]
blocks: []
owner: rewant
scoping_ref: docs/scoping.md#feature-8-prepare-for-visit
adr_refs: []
last_updated: 2026-04-25
---

# Feature 07 — Prepare-for-Visit

## Intent

Tripartite pre-visit tool: (1) in-app checklist (bring meds list, insurance, prior reports), (2) inline annotations on the most recent Doctor Report, (3) "Questions for my doctor" captured in-app and surfaced in the PDF appendix. Makes Sonakshi walk into the visit prepared — she doesn't have to re-explain her baseline.

## Scope in / out

- **In (MVP):** checklist UI, annotation layer on existing Doctor Report, Questions capture flow, Questions-in-PDF.
- **Out (backlog):** calendar integration, visit reminders, voice-driven question capture.

## Dependencies

- **Reads:** Feature 05 upcoming visits, Feature 06 generated report.
- **Blocks:** none.

## Chunks

Estimated: **2 cycles × 3 chunks = 6 chunks.**

**First build task = chunking cycle** (dual-track).

## Review notes
_Empty._

## Learnings
_Empty._
