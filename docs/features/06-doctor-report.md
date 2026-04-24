---
number: 06
name: Doctor Report (Hybrid PDF)
slug: doctor-report
status: scoped
depends_on: [01-daily-checkin, 02-memory, 03-patterns, 04-medications, 05-doctor-visits]
blocks: [08-journey]
owner: rewant
scoping_ref: docs/scoping.md#feature-5-doctor-report
adr_refs: []
last_updated: 2026-04-25
---

# Feature 06 — Doctor Report (Hybrid PDF)

## Intent

One-tap PDF summarizing the last 30 days for a doctor visit. Hybrid format: summary page (trends, key changes, adherence) + appendix (full check-in log). Two views: patient-friendly (language like "dysfunction level") and doctor-friendly (clinical language). Shared via WhatsApp or phone — no hosted links in MVP.

## Scope in / out

- **In (MVP):** summary + appendix PDF generation, patient view, doctor view, WhatsApp share flow, quota (1/month free, unlimited paid).
- **Out (backlog):** hosted report URLs, doctor response / annotation, multi-language PDFs, EHR integrations.

## Dependencies

- **Reads:** Features 01, 02, 03, 04, 05 (aggregates everything).
- **Blocks:** Feature 08 Journey (appears in aggregation).

## Chunks

Estimated: **3 cycles × 3 chunks = 9 chunks** (largest feature — PDF generation + two views + share flow).

**First build task = chunking cycle** (dual-track).

## Review notes
_Empty._

## Learnings
_Empty._
