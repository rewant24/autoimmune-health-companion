---
number: 03
name: Patterns
slug: patterns
status: scoped
depends_on: [01-daily-checkin]
blocks: [05-doctor-visits, 06-doctor-report]
owner: rewant
scoping_ref: docs/scoping.md#feature-7-patterns
adr_refs: [ADR-014]
last_updated: 2026-04-25
---

# Feature 03 — Patterns

## Intent

Multi-metric stacked line chart showing pain, mood, energy, adherence, flare over time. Visual insights days 1–14 (chart only). Verbal insights day 14+ (ADR-014) conditional on data density — surfaces correlations and trend language like "your pain spikes on days you miss your morning dose".

## Scope in / out

- **In (MVP):** stacked line chart, 1–14d visual, 14d+ verbal insights, unlock logic based on data density, paywall (paid tier only for full history).
- **Out (backlog):** flare↔dose correlation chart, wearable data overlays, export as image.

## Dependencies

- **Reads:** Feature 01 check-in data (≥14d preferred).
- **Blocks:** Feature 06 Doctor Report (patterns summary), Feature 08 Journey (aggregation).

## Chunks

Estimated: **2 cycles × 3 chunks = 6 chunks.**

**First build task = chunking cycle.** Dual-track:
- Track A: Plan subagent drafts full feature MD (chunks + stories + 4-lane acceptance).
- Track B: 3 reviewer subagents check draft (brief / spec+regression / edge cases) in parallel with Rewant review.
- Merge → fix → `ready`.

## Review notes
_Empty until chunking cycle runs._

## Learnings
_Empty until ship._
