---
number: 05
name: Doctor Visits & Blood Work
slug: doctor-visits
status: scoped
depends_on: [01-daily-checkin]
blocks: [06-doctor-report, 07-prepare-for-visit, 08-journey]
owner: rewant
scoping_ref: docs/scoping.md#feature-4-doctor-visits-and-blood-work
adr_refs: []
last_updated: 2026-04-25
---

# Feature 05 — Doctor Visits & Blood Work

## Intent

First-class timeline events: doctor visits and blood-work results. Sonakshi captures manually (simple form) or opportunistically via voice extraction during check-in ("I saw Dr. Sharma yesterday"). Timeline markers appear in Memory and Journey. Blood-test attachments deferred post-MVP.

## Scope in / out

- **In (MVP):** event CRUD (date, doctor, visit notes, blood-work values), voice-extracted event detection, timeline markers in Memory.
- **Out (backlog):** blood-test PDF attachments, image OCR for lab reports, insurance / provider linking.

## Dependencies

- **Reads:** Feature 01 voice transcripts (for extraction).
- **Blocks:** Feature 06 Doctor Report (visits list), Feature 07 Prepare-for-Visit (upcoming visit), Feature 08 Journey (timeline).

## Chunks

Estimated: **2 cycles × 3 chunks = 6 chunks.**

**First build task = chunking cycle** (dual-track).

## Review notes
_Empty._

## Learnings
_Empty._
