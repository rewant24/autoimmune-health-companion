---
number: 05
name: Doctor Visits & Blood Work
slug: doctor-visits
status: chunked
depends_on: [01-daily-checkin, 02-memory]
blocks: [06-doctor-report, 07-prepare-for-visit, 08-journey]
owner: rewant
scoping_ref: docs/scoping.md#feature-4-doctor-visits-and-blood-work
adr_refs: [ADR-019, ADR-020, ADR-031]
last_updated: 2026-04-30
---

# Feature 05 — Doctor Visits & Blood Work

## Intent

First-class timeline events: doctor visits and blood-work results. Sonakshi captures manually (simple form) or opportunistically via voice extraction during check-in ("I saw Dr. Mehta yesterday", "got my CRP back, it was 12 mg/L"). Both event types render as Memory timeline markers and anchor the F06 Doctor Report's auto-window.

## Scope in / out

- **In (MVP, this cycle):** Visit + blood-work CRUD via structured forms; voice-extracted event detection with confirm-card flow during check-in summary; Memory rendering with type-tagged pills (`APPOINTMENT`, `BLOOD WORK`).
- **Out (post-MVP backlog):** Blood-test PDF/image attachment + OCR (item 3); insurance/provider linking; multi-analyte panels beyond the MVP marker set; reference-range visualization (green/yellow/red bands).

## Dependencies

- **Reads:** F01 check-in transcripts (for extraction); F02 Memory event-types module (extends with visit + blood-work events).
- **Writes:** New Convex tables — `doctorVisits`, `bloodWork` (schema landed in pre-flight `feat/sprint-f04-f05-preflight`).
- **Blocks:** F06 (visit list + blood-work appendix in Doctor Report); F07 (next-upcoming-visit anchor); F08 (Journey timeline aggregation).

## Cycle 1 — Foundation (3 chunks, parallel)

### Files owned across this cycle (authoritative)
```
convex/doctorVisits.ts                             [5.A]
convex/bloodWork.ts                                [5.A]
tests/convex/visits.test.ts                        [5.A]
tests/convex/bloodWork.test.ts                     [5.A]
app/visits/page.tsx                                [5.B]
app/visits/new/page.tsx                            [5.B]
app/visits/[id]/page.tsx                           [5.B]
app/blood-work/page.tsx                            [5.B]
app/blood-work/new/page.tsx                        [5.B]
app/blood-work/[id]/page.tsx                       [5.B]
components/visits/VisitForm.tsx                    [5.B]
components/visits/VisitCard.tsx                    [5.B]
components/blood-work/BloodWorkForm.tsx            [5.B]
components/blood-work/MarkerInput.tsx              [5.B]
components/blood-work/BloodWorkCard.tsx            [5.B]
tests/visits/*.test.tsx                            [5.B]
tests/blood-work/*.test.tsx                        [5.B]
lib/checkin/event-extract.ts                       [5.C]
app/api/check-in/extract-event/route.ts            [5.C]
components/check-in/EventConfirmCard.tsx           [5.C]
lib/memory/event-types.ts                          [5.C — extend, see Memory coordination]
app/journey/memory/page.tsx                        [5.C — extend with new event renders]
tests/check-in/event-extract.test.ts               [5.C]
```

**Memory coordination:** `lib/memory/event-types.ts` already declares `IntakeEvent` (F04 4.C will populate the payload) and `VisitEvent` (5.C will populate). 5.C ADDS `BloodWorkEvent` to the union. Both 4.C and 5.C edit this file. Coordination via clearly-named slots — pre-flight has marked the file with `// SPRINT_F04_INTAKE_PAYLOAD` and `// SPRINT_F05_VISIT_PAYLOAD` / `// SPRINT_F05_BLOODWORK_PAYLOAD` comments. Each chunk replaces only its own slot. The merged file is validated at integrate.

### Chunk 5.A — Backend (visits + blood work)

- **Owner:** build-agent-A.
- **Status:** ready.
- **Stories:** US-5.A.1, US-5.A.2, US-5.A.3.

**US-5.A.1 — Visit CRUD**
- *As* Sonakshi *I want* to log doctor visits with date and notes *so that* my history shows when I saw whom.
- **Functional requirement:** `createVisit`, `updateVisit`, `softDeleteVisit` mutations; `listVisits({ fromDate?, toDate? })`, `getNextUpcomingVisit({ today })`, `getVisitsByDate({ date })` queries. Idempotent on `clientRequestId` for create.
- **Acceptance:**
  - **UX:** Backend-only. UX in 5.B + 5.C.
  - **UI:** none.
  - **Backend / data:** `doctorName` non-empty after trim. `visitType` from the locked enum. `date` `YYYY-MM-DD`. `getNextUpcomingVisit` returns the row with smallest `date >= today` (excludes soft-deleted). When `source: 'check-in'`, `checkInId` required; when `source: 'module'`, `checkInId` must be absent.
  - **UX copy:** none.

**US-5.A.2 — Blood-work CRUD with structured markers**
- *As* Sonakshi *I want* to log blood-work results with the markers I usually track *so that* my doctor report can show trends.
- **Functional requirement:** `createBloodWork`, `updateBloodWork`, `softDeleteBloodWork` mutations; `listBloodWork({ fromDate?, toDate? })`, `getBloodWorkByDate({ date })` queries. `markers` array required and non-empty.
- **Acceptance:**
  - **UX:** Backend-only.
  - **UI:** none.
  - **Backend / data:** Each marker: `name` non-empty, `value` finite, `unit` non-empty. `refRangeLow <= refRangeHigh` when both present. `abnormal` derived at write time when both bounds are present (`value < low || value > high`); written-through value trusted on update. Empty `markers[]` rejected with `bloodWork.no_markers`.
  - **UX copy:** none.

**US-5.A.3 — Soft-delete with audit posture for both event types**
- *As* Sonakshi *I want* deletes to be reversible *so that* a mis-tap doesn't lose data.
- **Functional requirement:** `softDeleteVisit({ id })` and `softDeleteBloodWork({ id })` set `deletedAt`. List queries filter out soft-deleted. Hard delete is post-MVP (item 21 follow-on).
- **Acceptance:**
  - **UX:** Backend-only.
  - **UI:** none.
  - **Backend / data:** Idempotent — calling on an already-soft-deleted row returns `{ alreadyDeleted: true }` and does not patch `deletedAt` again.
  - **UX copy:** none.

### Chunk 5.B — Manual capture UI (forms + lists)

- **Owner:** build-agent-B.
- **Status:** ready.
- **Stories:** US-5.B.1, US-5.B.2, US-5.B.3.

**US-5.B.1 — Visit form**
- *As* Sonakshi *I want* to log a past or upcoming visit quickly *so that* I don't have to wait for a check-in.
- **Functional requirement:** `/visits/new` renders `VisitForm` (date picker, doctorName, specialty optional, visitType select, notes optional). Submit → `createVisit({ source: 'module' })` → routes to `/visits/[id]`.
- **Acceptance:**
  - **UX:** Date picker defaults to today. Notes is multi-line. Submit disabled until date + doctorName + visitType filled. Validation errors surface inline.
  - **UI:** Single-screen form, mobile-first. `VisitCard` in the list view shows date (lg), doctor + specialty (md), visitType pill (sm), notes preview (truncated).
  - **Backend / data:** `clientRequestId` per submit attempt. After save, the new visit is reachable from `/visits` and appears in `/journey/memory` for its date.
  - **UX copy:** Form title: *"Log a doctor visit"*. Date label: *"When?"*. Doctor label: *"Who did you see?"*. Specialty placeholder: *"e.g. Rheumatologist (optional)"*. Visit-type label: *"Type of visit"*. Notes placeholder: *"Anything you want to remember (optional)"*. Submit: *"Save visit"*.

**US-5.B.2 — Blood-work form with structured markers**
- *As* Sonakshi *I want* to log blood-work values *so that* my doctor report has the numbers ready.
- **Functional requirement:** `/blood-work/new` renders `BloodWorkForm` with date + a `MarkerInput` repeater. Default markers (CRP, ESR, WBC, Hb) appear pre-populated as empty fields; each can be removed; "Add marker" appends a freeform row. Each `MarkerInput`: name, value, unit, refRangeLow optional, refRangeHigh optional. Submit → `createBloodWork({ source: 'module' })`.
- **Acceptance:**
  - **UX:** Date picker defaults to today. Submit disabled until at least one marker has name + value + unit. Per-marker delete (X icon). Marker order preserved.
  - **UI:** Each marker is a card row. CRP/ESR/WBC/Hb defaults are visible pre-population (user fills value + unit; can remove if irrelevant). "Add marker" button below the list.
  - **Backend / data:** Empty `markers[]` rejected at the submit guard (matches 5.A). All numerics parsed via `Number()`; rejected if `NaN`.
  - **UX copy:** Form title: *"Log blood work"*. Date label: *"When was the test?"*. Default-marker hint: *"Common autoimmune markers (remove any you don't have)"*. Add button: *"+ Add another marker"*. Submit: *"Save results"*.

**US-5.B.3 — List, edit, delete with confirm**
- *As* Sonakshi *I want* to see all my logged visits and blood work in one place *so that* I can review or correct entries.
- **Functional requirement:** `/visits` lists visits newest-first with edit/delete affordances. `/blood-work` mirrors. Detail pages `/visits/[id]` and `/blood-work/[id]` show the full record + edit + soft-delete actions. Reachability: a "Log a visit / blood work" button on `/journey/memory` links to both `/visits/new` and `/blood-work/new`.
- **Acceptance:**
  - **UX:** Edit pre-fills the form. Soft-delete confirm: *"Delete this visit / blood-work entry? You can't undo this."* (matches the F02 Memory delete language).
  - **UI:** List uses the Memory list visual rhythm. Empty states with primary CTA. Memory affordance is a single button at the bottom of the day view: *"+ Log visit or blood work"*.
  - **Backend / data:** Edit calls `updateVisit` / `updateBloodWork`; delete calls the soft-delete mutations.
  - **UX copy:** Empty state visits: *"No doctor visits logged yet."*. Empty state blood-work: *"No blood work logged yet."*. Add affordance on each: *"+ Log visit"* / *"+ Log blood work"*.

### Chunk 5.C — Voice extraction + Memory integration

- **Owner:** build-agent-C.
- **Status:** ready.
- **Stories:** US-5.C.1, US-5.C.2, US-5.C.3.

**US-5.C.1 — Voice-extract visit candidate**
- *As* Sonakshi *I want* the AI to catch when I mention a doctor visit *so that* I don't have to log it twice.
- **Functional requirement:** `extractEvents(transcript, checkInDate)` POSTs to `/api/check-in/extract-event`. The extractor returns `visits: { doctorName, date, specialty?, visitType, notes? }[]`. Relative phrases ("yesterday", "next Tuesday") resolved against `checkInDate`. Confirm card renders during the summary step; on confirm → `createVisit({ source: 'check-in', checkInId })`.
- **Acceptance:**
  - **UX:** Each extracted visit is one card with two buttons (Save / Not now). Card body shows date + doctorName + visitType. Dismissed cards are not persisted.
  - **UI:** Reuses existing F01 C2 confirm-card visual vocabulary. Card stack: dosage-change cards (from F04) appear above event cards (from F05) when both are present in the same summary.
  - **Backend / data:** `incrementAndCheck` is shared with the medication-extract route — a single check-in burns one cap counter regardless of how many extractor calls fire (coordination invariant; tested explicitly).
  - **UX copy:** Card title: *"Doctor visit on [date]?"*. Body: *"I heard: [doctorName] · [visitType]"*. Buttons: *Save* / *Not now*.

**US-5.C.2 — Voice-extract blood-work candidate**
- *As* Sonakshi *I want* the AI to catch blood-work mentions *so that* the values land in my record without re-typing.
- **Functional requirement:** Extractor returns `bloodWork: { date, markers: { name, value, unit }[], notes? }[]`. Confirm card per detected blood-work entry; on confirm → `createBloodWork({ source: 'check-in', checkInId })`.
- **Acceptance:**
  - **UX:** Confirm card shows the marker(s) detected and their values. User can dismiss without saving. Multi-marker mentions group into one card per check-in.
  - **UI:** Same confirm-card pattern as visits.
  - **Backend / data:** Marker units inferred from common conventions (mg/L for CRP, mm/hr for ESR, etc.) when the user omits — but the extractor returns `unit: null` if uncertain, and the card surfaces a unit picker.
  - **UX copy:** Card title: *"Blood work on [date]?"*. Body lines: *"I heard: [marker] [value] [unit]"* per marker. Buttons: *Save* / *Not now*.

**US-5.C.3 — Memory renders visit + blood-work markers inline**
- *As* Sonakshi *I want* my visits and blood work to show up alongside my check-ins *so that* one timeline tells the whole story.
- **Functional requirement:** `lib/memory/event-types.ts` extends with `eventFromVisit(row)` and `eventFromBloodWork(row)`. Convex `listEventsByRange` (currently in `convex/checkIns.ts`) is extended OR a new aggregation query is added in `convex/memory.ts` to merge check-ins + visits + blood-work + intake events into one feed. Memory page renders type-tagged pills per scoping § home event feed convention.
- **Acceptance:**
  - **UX:** Day view shows all event types interleaved by time. Type pill colors match the scoping convention. Tap any event opens its detail sheet (existing for check-in/flare; new for visit/blood-work routes to `/visits/[id]` or `/blood-work/[id]`).
  - **UI:** Pill labels: `APPOINTMENT` (visit), `BLOOD WORK`, `INTAKE` (F04), existing `FLARE-UP`. Visual style: small pill chip on card header.
  - **Backend / data:** Aggregation either extends `listEventsByRangeHandler` in `convex/checkIns.ts` or moves it to `convex/memory.ts`. Decision made at integrate — flagged in the chunk plan, NOT in pre-flight, to avoid blocking 4.C / 5.C build agents on a coordination decision.
  - **UX copy:** Pill labels above. Empty state unchanged.

## Cycle 2 (deferred)

Sketch:
- Blood-work PDF/image attachment + OCR (post-MVP item 3).
- Multi-analyte panels (>4 markers).
- Reference-range visualization on the marker chart.

## Review notes

_Empty until Wave 2 dispatches._

## Learnings

_Empty until ship._
