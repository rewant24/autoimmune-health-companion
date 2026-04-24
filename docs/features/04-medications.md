---
number: 04
name: Medications
slug: medications
status: scoped
depends_on: [01-daily-checkin]
blocks: [05-doctor-visits]
owner: rewant
scoping_ref: docs/scoping.md#feature-3-medications
adr_refs: []
last_updated: 2026-04-25
---

# Feature 04 — Medications

## Intent

Regimen tracker: dosage + frequency + adherence. Sonakshi enters her current medications, dose, and schedule. Daily adherence surfaces back into the check-in flow (and is also captured opportunistically from voice). Handles dose changes over time (e.g. 10 → 15 → 20 → 25mg over 3 months — see CLAUDE.md research insight).

## Scope in / out

- **In (MVP):** medication CRUD (name, dose, frequency, start/end date), adherence log, dose change tracking, surfaces into check-in prompts.
- **Out (backlog):** reminders/notifications, pharmacy integrations, drug interaction warnings, side-effect logging.

## Dependencies

- **Reads:** Feature 01 check-in data (adherence flag).
- **Blocks:** Feature 05 Doctor Visits (meds list visible at visits), Feature 06 Doctor Report (meds summary).

## Chunks

Estimated: **2 cycles × 3 chunks = 6 chunks.**

**First build task = chunking cycle** (dual-track as per Feature 03).

## Review notes
_Empty._

## Learnings
_Empty._
