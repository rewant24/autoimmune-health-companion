---
number: 04
name: Medications
slug: medications
status: chunked
depends_on: [01-daily-checkin]
blocks: [05-doctor-visits, 06-doctor-report]
owner: rewant
scoping_ref: docs/scoping.md#medications-module-decided-option-d--hybrid
adr_refs: [ADR-019, ADR-020, ADR-030]
last_updated: 2026-04-30
---

# Feature 04 — Medications

## Intent

Regimen tracker: dosage + frequency + adherence. Sonakshi enters her current medications, dose, and schedule. Daily adherence is captured opportunistically — a tappable list on Home for in-the-moment logging, plus voice-extracted simple/partial adherence and dosage changes during the daily check-in. Handles dose changes over time (e.g. 10 → 15 → 20 → 25mg over 3 months).

## Scope in / out

- **In (MVP, this cycle):** Medication CRUD via structured form; intake events (home-tap + check-in capture, deduped); dosage change audit trail; voice extraction of simple/partial adherence + dosage changes with confirm card.
- **Deferred to Cycle 2:** Voice-first regimen setup wizard (per ADR-030).
- **Out (post-MVP backlog):** Reminders/notifications (item 10), pharmacy integrations, drug interaction warnings, side-effect logging, symptom catalog beyond the required-five (item 11).

## Dependencies

- **Reads:** F01 check-in transcripts (for voice extraction), F01 `extractAttempts` cost guard.
- **Writes:** New Convex tables — `medications`, `intakeEvents`, `dosageChanges` (schema landed in pre-flight `feat/sprint-f04-f05-preflight`).
- **Blocks:** F05 (visits surface meds list at the visit), F06 (Doctor Report meds + adherence summary).

## Cycle 1 — Foundation (3 chunks, parallel)

### Files owned across this cycle (authoritative)
```
convex/medications.ts                              [4.A]
convex/intakeEvents.ts                             [4.A]
convex/dosageChanges.ts                            [4.A]
tests/convex/medications.test.ts                   [4.A]
tests/convex/intakeEvents.test.ts                  [4.A]
tests/convex/dosageChanges.test.ts                 [4.A]
app/medications/page.tsx                           [4.B]
app/medications/setup/page.tsx                     [4.B]
components/medications/RegimenList.tsx             [4.B]
components/medications/MedicationCard.tsx          [4.B]
components/medications/AddMedicationSheet.tsx      [4.B]
components/medications/DosageChangeDialog.tsx      [4.B]
tests/medications/*.test.tsx                       [4.B]
components/home/IntakeTapList.tsx                  [4.C]
lib/checkin/medication-extract.ts                  [4.C]
app/api/check-in/extract-medication/route.ts       [4.C]
components/check-in/MedicationConfirmCard.tsx      [4.C]
tests/check-in/medication-extract.test.ts          [4.C]
```

The home page (`app/home/page.tsx`) is touched by 4.B (setup-nudge integration) and 4.C (intake-tap mount). Both edits are isolated to a single named slot each — coordination handled at integration via clearly-labelled stub markers (`{/* SPRINT_F04_NUDGE_SLOT */}`, `{/* SPRINT_F04_INTAKE_SLOT */}`) added in pre-flight. Each chunk replaces its own marker.

### Chunk 4.A — Backend (medications + intake + dosage changes)

- **Owner:** build-agent-A.
- **Status:** ready.
- **Stories:** US-4.A.1, US-4.A.2, US-4.A.3.

**US-4.A.1 — Regimen CRUD**
- *As* Sonakshi *I want* to add, edit, and remove medications *so that* the app knows my current regimen.
- **Functional requirement:** `createMedication`, `updateMedication`, `deactivateMedication` mutations; `listActiveMedications`, `listAllMedications` queries. Soft-delete via `isActive: false` + `deactivatedAt`.
- **Acceptance:**
  - **UX:** Backend-only chunk; UX surfaced by 4.B.
  - **UI:** none.
  - **Backend / data:** Mutations are idempotent on `clientRequestId`. `name` non-empty after trim; `dose` non-empty after trim; `category` and `delivery` from the locked enums. `deactivateMedication` is no-op idempotent (calling on an already-inactive row returns the row, no error).
  - **UX copy:** none.

**US-4.A.2 — Idempotent intake logging with cross-path dedupe**
- *As* Sonakshi *I want* my dose log to stay accurate whether I tap from Home or mention it during the check-in *so that* I never see a "took it twice" record.
- **Functional requirement:** `logIntake({ userId, medicationId, date, takenAt, source, clientRequestId })`. Idempotent on `clientRequestId`. If a non-deleted intake row exists for `(userId, medicationId, date)` from any source, the second call is a no-op that returns the existing row id (and its `source` — first writer wins).
- **Acceptance:**
  - **UX:** none directly.
  - **UI:** none.
  - **Backend / data:** `clientRequestId` retry returns the same id. Cross-path dedupe verified by a test that runs `logIntake(home-tap)` then `logIntake(check-in)` and asserts only one row exists. `softDeleteIntake({ id, clientRequestId })` clears the dedupe (re-tap allowed after explicit delete).
  - **UX copy:** none.

**US-4.A.3 — Dosage change audit trail**
- *As* Sonakshi *I want* every dose change saved as an event linked to the medication *so that* my doctor report can show the timeline.
- **Functional requirement:** `recordDosageChange({ userId, medicationId, oldDose, newDose, changedAt, reason?, source, checkInId? })`. Patches `medications.dose` to `newDose` on the linked row. Retains the prior value in the `dosageChanges` row for the audit trail.
- **Acceptance:**
  - **UX:** Backend-only.
  - **UI:** none.
  - **Backend / data:** `oldDose !== newDose` enforced; same-value writes throw `dosage.no_change`. The patch on `medications` and the insert into `dosageChanges` happen in the same mutation (atomic). When `source: 'check-in'`, `checkInId` is required; when `source: 'module'`, `checkInId` must be absent.
  - **UX copy:** none.

### Chunk 4.B — Module UI (regimen + setup + edit)

- **Owner:** build-agent-B.
- **Status:** ready.
- **Stories:** US-4.B.1, US-4.B.2, US-4.B.3.

**US-4.B.1 — First-time setup wizard (structured form, voice-first deferred per ADR-030)**
- *As* a new user *I want* to add my first medications quickly *so that* the rest of the app knows what to track.
- **Functional requirement:** `/medications/setup` renders a form (name, dose, frequency, category, delivery). Submit creates one medication. After first save, the wizard offers "Add another" or "Done" — the latter routes to `/medications`. The Home setup-nudge slot shows "Set up your medications" until `listActiveMedications` returns ≥1.
- **Acceptance:**
  - **UX:** Form is single-screen, mobile-first, large tap targets. Submit is disabled until name + dose + frequency + category + delivery are all filled. Saved medications stack above the form with an inline edit affordance. "Done" routes to `/medications`.
  - **UI:** Reuses the Saha visual vocabulary from onboarding (inputs, buttons, card layout). Setup-nudge integration: `app/home/page.tsx` slot `{/* SPRINT_F04_NUDGE_SLOT */}` is replaced by a `<SetupMedicationsNudge />` card that hides via a Convex query subscription.
  - **Backend / data:** Each save calls `createMedication`. `clientRequestId` per submit attempt to prevent double-creates on retry.
  - **UX copy:** Header: *"Tell me what you take."* Subhead: *"You can edit any of this later."* Submit button: *"Save medication"*. Done button: *"I'm done for now"*. Setup-nudge title: *"Set up your medications"*. Subtitle: *"So I can track your doses with you."*. CTA: *"Set up"*.

**US-4.B.2 — Add / edit / deactivate from the module**
- *As* Sonakshi *I want* to manage my regimen list *so that* it stays current as my prescriptions change.
- **Functional requirement:** `/medications` shows `RegimenList` of active medications (cards with name, dose, frequency, category pill). Tap-to-edit opens `AddMedicationSheet` pre-filled. Long-press or `⋯` menu offers Deactivate (with confirm dialog).
- **Acceptance:**
  - **UX:** List uses the Memory list visual rhythm. Empty state ("Your regimen is empty — tap + to add a medication") with a primary CTA. Edit sheet is a bottom-sheet drawer on mobile, dialog on desktop. Deactivate confirmation: *"Stop tracking [name]? Your past intake history stays."* Confirm → soft-delete via `deactivateMedication`.
  - **UI:** `MedicationCard` shows name (lg), dose (md), frequency (md, secondary), category pill (sm). Add affordance is a circular `+` button bottom-right (FAB pattern, matches Saha convention).
  - **Backend / data:** Edit calls `updateMedication`; deactivate calls `deactivateMedication`. List subscribes to `listActiveMedications`.
  - **UX copy:** Empty state: *"Your regimen is empty — add what you take."*. Add CTA: *"+ Add medication"*. Deactivate confirm: *"Stop tracking [name]?"*. Subtext: *"Your past intake history stays."*.

**US-4.B.3 — Record a dosage change from the module**
- *As* Sonakshi *I want* to record a dose change after my doctor adjusts a prescription *so that* my history reflects it without re-creating the medication.
- **Functional requirement:** `MedicationCard` has a "Dose change" affordance that opens `DosageChangeDialog`. Inputs: new dose, reason (optional). Submit calls `recordDosageChange({ source: 'module' })` which patches the medication's `dose` and inserts the audit row.
- **Acceptance:**
  - **UX:** Dialog shows current dose as the read-only "from" field; user types new dose. Reason field is freeform, optional, single-line. Save is disabled until new dose differs from current.
  - **UI:** Standard Saha dialog pattern. Two-button row: Cancel / Save change.
  - **Backend / data:** `recordDosageChange` with `source: 'module'`, no `checkInId`.
  - **UX copy:** Title: *"Dose change"*. Subhead: *"What did your doctor change it to?"*. New-dose label: *"New dose"*. Reason placeholder: *"Why? (optional — e.g., 'flare', 'tapering', 'side effects')"*. Save: *"Save change"*.

### Chunk 4.C — Home intake-tap + check-in voice extraction

- **Owner:** build-agent-C.
- **Status:** ready.
- **Stories:** US-4.C.1, US-4.C.2, US-4.C.3.

**US-4.C.1 — Tap-to-log intake from Home**
- *As* Sonakshi *I want* to mark a dose as taken the moment I take it *so that* I don't have to wait for the daily check-in.
- **Functional requirement:** `IntakeTapList` mounts at `app/home/page.tsx` slot `{/* SPRINT_F04_INTAKE_SLOT */}` and reads `getTodayAdherence(date)`. Each row shows the medication name + dose, taken-state pill (taken / outstanding), and a tap target. Tap → `logIntake({ source: 'home-tap', clientRequestId: nanoid() })`.
- **Acceptance:**
  - **UX:** Tap is one-touch — no confirm. Optimistic state flip with rollback on mutation error. Already-tapped row shows a tick + the time it was logged ("Taken at 09:14"). List hides if regimen is empty (the setup nudge is the surface there).
  - **UI:** Compact rows in a single card on Home. Header: "Today's doses". Each row uses the task-state vocabulary (empty circle / green check) per scoping § home event feed.
  - **Backend / data:** `clientRequestId` is generated per tap; retry collapses cleanly. Cross-path dedupe is implemented in 4.A's handler — this chunk only invokes it.
  - **UX copy:** Header: *"Today's doses"*. Empty taken-state pill: hidden (no label needed; the tap target is the affordance). Confirmation toast (after first successful tap of the day): *"Logged."*

**US-4.C.2 — Voice-extracted simple / partial adherence**
- *As* Sonakshi *I want* the AI to log my doses when I just say I took them *so that* I don't have to recite drug names.
- **Functional requirement:** `extractMedications(transcript, regimen)` POSTs to `/api/check-in/extract-medication`. The route reuses `incrementAndCheck` to share the daily cap with the metrics extractor. Simple-adherence ("took my meds") logs ALL active regimen medications as taken for the check-in's date. Partial-adherence ("skipped the steroid") logs all EXCEPT the named medication(s).
- **Acceptance:**
  - **UX:** Extraction happens during the existing summary step — no new screen. Extracted intakes write through the same dedupe path; if the user already tapped, the check-in extraction is a no-op for that medication.
  - **UI:** Summary recap shows the logged medications in the per-metric block (existing F01 C2 component, extended).
  - **Backend / data:** Extraction returns a structured object with `simpleAdherence: boolean | null`, `skipped: string[]` (medication names matched against the regimen). Unmatched names are dropped silently — no false positives. The route returns `{ logged: [...], skipped: [...] }`.
  - **UX copy:** Summary recap line: *"Logged today's doses"* (simple) / *"Logged today's doses — skipped: [name(s)]"* (partial). No new microcopy on Home.

**US-4.C.3 — Voice-extracted dosage change → confirm card → write**
- *As* Sonakshi *I want* the AI to catch when I mention a dose change *so that* my regimen stays current without me having to update it twice.
- **Functional requirement:** `extractMedications` also returns a `dosageChanges: { medicationName, newDose, oldDoseFromTranscript? }[]` slot. Each detected change renders a `MedicationConfirmCard` during the summary step. User confirms → `recordDosageChange({ source: 'check-in', checkInId })`. User dismisses → no write; flagged in the transcript only.
- **Acceptance:**
  - **UX:** Confirm card is rendered inline in the summary step, above the existing recap. Two buttons: Save / Not now. Match against active regimen by case-insensitive name; unmatched mentions render no card.
  - **UI:** Reuses the existing F01 C2 ConfirmSummary visual vocabulary. Card title: *"Dose change for [name]?"*. Body: *"I heard: [dose] → [newDose]"*. Buttons: *Save* / *Not now*.
  - **Backend / data:** `recordDosageChange` write happens AFTER `createCheckin` so `checkInId` is available. If the medication name doesn't match, the card never renders.
  - **UX copy:** As above. If user dismisses: no toast (silent; nothing was saved).

## Cycle 2 (deferred — voice-first regimen setup wizard)

Sketch for re-entry post-Cycle-1:
- New `/medications/setup-voice` flow. Uses Sarvam STT + a structured-output extraction call (zod schema for `medications[]`).
- Voice transcript → confirm-and-edit list (each parsed med becomes a card the user can edit before commit).
- Form fallback: "Switch to typing" forward-only affordance, mirrors voice C1 B3 bail-out pattern.
- Reads: existing regimen (so re-entry doesn't double-create).

## Review notes

_Empty until Wave 2 dispatches._

## Learnings

_Empty until ship._
