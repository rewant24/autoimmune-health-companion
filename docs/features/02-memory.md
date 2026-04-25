---
number: 02
name: Memory
slug: memory
status: chunked
depends_on: [01-daily-checkin]
blocks: [06-doctor-report, 08-journey]
owner: rewant
scoping_ref: docs/scoping.md#memory-landing--visual--structural-spec
adr_refs: [ADR-003, ADR-012, ADR-015, ADR-019]
last_updated: 2026-04-25
---

# Feature 02 — Memory

> **Note on this revision (2026-04-25).** The previous chunking of this MD diverged from canonical scoping on five structural points (placement, calendar shape, filter set, row visuals, search). It was an unreviewed agent draft from Session 3 — F01/F02 skipped the reviewer-subagent pass that F03–10 will get. This rewrite reconciles to `scoping.md` § Memory landing — visual + structural spec. See `architecture-changelog.md` 2026-04-25 entry "F02 MD reconciled to scoping."

## Intent

Memory is the **browse-past-check-ins surface inside the Journey pillar** (ADR-003). Sonakshi taps Journey → Memory tab; she sees a horizontal **week-at-a-time** calendar strip at top, filter tabs under it (All / Check-ins / Intake events / Flare-ups / Visits), and a reverse-chronological list of day entries below. Each day groups mixed event types (check-in metrics, medication intakes, opportunistic captures) into sections with task-state visual vocabulary (empty circle / green check / red strikethrough). Tap any entry → detail sheet with [Edit] and [Delete]. Search icon on the header opens a search bar that queries free-flow transcript text.

## Scope in / out

- **In (MVP):** Memory tab inside Journey, week-at-a-time scrubber, filter tabs (5 categories), reverse-chronological day list, mixed-event grouping per day, task-state visual vocabulary, tap-to-detail sheet, edit-in-place within 48h, hard delete with confirm (per scoping line 696), keyword search (client-side debounce against transcript text), empty-state template ("Your memory starts today.").
- **Out (backlog):**
  - Full edit on past-window check-ins (post-48h) — backlog §22 (full audit history + redact-from-report).
  - Search index (Convex full-text) — backlog §23. Client-side filter for MVP (dataset small per scoping line 695).
  - Cross-linking from flare/dose markers in Patterns → Memory entry — depends on F03 / F04 surfaces; backlog §24.
  - Shared read-only view for support system — backlog §25 (architecture must not preclude per scoping line 720).
  - Offline cached read — backlog §26 (per scoping line 721 open question).

## Dependencies

- **Reads:**
  - `checkIns` table (F01, shipped) — primary event source for MVP.
  - `medicationIntakes` (F04, future) — populates "Intake events" filter and "Medication intake" day-section.
  - `doctorVisits`, `bloodWorkTests` (F05, future) — populates "Visits" filter and "Other events" day-section.
- **Blocks:**
  - F06 Doctor Report (aggregates check-ins + events).
  - F08 Journey (Memory is one of Journey's five surfaces; F08 wraps with the Journey landing screen).
- **Architectural responsibility (this feature):** **introduces the event-type architecture** that F04 and F05 will plug into. F02 C1 ships the discriminated-union event type, the mixed-source list query shape, and the day-grouping component — all with check-ins as the only populated source. F04 and F05 land additively, no Memory refactor.

## Files owned (feature-wide)

```
app/journey/memory/page.tsx                  // Memory tab landing
app/journey/memory/[date]/page.tsx           // Detail sheet (one day)
components/memory/MemoryTab.tsx              // Header + scrubber + filter tabs + day list
components/memory/WeekScrubber.tsx           // Horizontal week-at-a-time S/M/T/W/T/F/S strip
components/memory/FilterTabs.tsx             // All / Check-ins / Intake events / Flare-ups / Visits
components/memory/DayView.tsx                // One day, grouped sections, event rows
components/memory/EventRow.tsx               // Time + title + meta + task-state icon
components/memory/EventGroup.tsx             // Section header inside a day
components/memory/CheckinDetail.tsx          // Full structured capture in detail sheet
components/memory/SearchBar.tsx              // Toggleable from header
components/memory/EmptyState.tsx             // "Your memory starts today." template
lib/memory/event-types.ts                    // Discriminated-union event type
lib/memory/filters.ts                        // Pure filter predicates
convex/checkIns.ts                           // Extend — listEventsByRange, updateCheckin, deleteCheckin
tests/memory/*.test.ts(x)
```

---

## Chunks

### Cycle 1 — Memory tab structure + scrubber + day list + event-type architecture

#### Chunk 2.A — Event-type architecture + `listEventsByRange` query + filter predicates
- **Owner:** build-agent-A
- **Files owned:**
  - `lib/memory/event-types.ts`
  - `lib/memory/filters.ts`
  - `convex/checkIns.ts` (extend — `listEventsByRange`)
  - `tests/memory/event-types.test.ts`
  - `tests/memory/filters.test.ts`
  - `tests/memory/list-events-query.test.ts`
- **Status:** scoped
- **Stories:** US-2.A.1, US-2.A.2, US-2.A.3
- **Do-not-touch:** `components/`, `app/`

#### Chunk 2.B — Memory tab shell + week scrubber + filter tabs
- **Owner:** build-agent-B
- **Files owned:**
  - `app/journey/memory/page.tsx`
  - `components/memory/MemoryTab.tsx`
  - `components/memory/WeekScrubber.tsx`
  - `components/memory/FilterTabs.tsx`
  - `tests/memory/week-scrubber.test.tsx`
  - `tests/memory/filter-tabs.test.tsx`
- **Status:** scoped
- **Stories:** US-2.B.1, US-2.B.2, US-2.B.3
- **Do-not-touch:** `convex/`, `lib/memory/`, `DayView`, `EventRow`

#### Chunk 2.C — Day view + event rows + task-state vocabulary + grouped sections
- **Owner:** build-agent-C
- **Files owned:**
  - `components/memory/DayView.tsx`
  - `components/memory/EventRow.tsx`
  - `components/memory/EventGroup.tsx`
  - `tests/memory/day-view.test.tsx`
  - `tests/memory/event-row.test.tsx`
- **Status:** scoped
- **Stories:** US-2.C.1, US-2.C.2, US-2.C.3
- **Do-not-touch:** `WeekScrubber`, `FilterTabs`, `convex/`, `lib/memory/`

### Cycle 2 — Detail sheet, edit/delete, search, empty/paywall states

#### Chunk 2.D — Detail sheet + edit-in-place (48h) + hard delete
- **Owner:** build-agent-A
- **Files owned:**
  - `app/journey/memory/[date]/page.tsx`
  - `components/memory/CheckinDetail.tsx`
  - `convex/checkIns.ts` (extend — `updateCheckin`, `deleteCheckin`)
  - `tests/memory/checkin-detail.test.tsx`
  - `tests/memory/edit-delete.test.ts`
- **Status:** scoped
- **Stories:** US-2.D.1, US-2.D.2, US-2.D.3
- **Do-not-touch:** `WeekScrubber`, `FilterTabs`, `DayView`, `EventRow`, `MemoryTab`

#### Chunk 2.E — Keyword search across transcript
- **Owner:** build-agent-B
- **Files owned:**
  - `components/memory/SearchBar.tsx`
  - `tests/memory/search.test.tsx`
- **Status:** scoped
- **Stories:** US-2.E.1
- **Do-not-touch:** all other files

#### Chunk 2.F — Empty state + integration test
- **Owner:** build-agent-C
- **Files owned:**
  - `components/memory/EmptyState.tsx`
  - `tests/memory/empty-state.test.tsx`
  - `tests/memory/integration.test.tsx`
- **Status:** scoped
- **Stories:** US-2.F.1, US-2.F.2
- **Do-not-touch:** prior chunks' source files beyond composition

---

## User Stories

### US-2.A.1 — Event-type discriminated union
- **As** Memory **I want** a single event type that can represent check-ins, intakes, flares, and visits **so that** the day list is uniform and F04 / F05 plug in additively.
- **Functional requirement:** `lib/memory/event-types.ts` exports `MemoryEvent` discriminated union: `{ type: 'check-in', ...checkInPayload } | { type: 'flare', ...flarePayload } | { type: 'intake', ...intakePayload } | { type: 'visit', ...visitPayload }`. Each variant carries `date` (YYYY-MM-DD), `time` (HH:MM), `title`, `meta`, and `taskState` (`'pending' | 'done' | 'missed'`). Helper `eventFromCheckin(row): MemoryEvent[]` produces a check-in event plus a flare event if `flare=true`. F04 / F05 will add `eventFromIntake` / `eventFromVisit` later.
- **Acceptance:**
  - **UX:** n/a.
  - **UI:** n/a.
  - **Backend / data:** pure types; unit-tested with check-in fixtures (flare=true → 2 events emitted, flare=false → 1 event).
  - **UX copy:** none.

### US-2.A.2 — `listEventsByRange` server query
- **As** Memory **I want** a single query that returns mixed events in a date range **so that** the UI doesn't need to merge sources.
- **Functional requirement:** `listEventsByRange({ fromDate, toDate, filters? }): { events: MemoryEvent[] }`. F02 C1 reads only `checkIns`; future F04 / F05 calls extend the merge. No tier clamp — every user has full history (no free tier). Returns events sorted reverse-chronological by `(date, time)`.
- **Acceptance:**
  - **UX:** n/a.
  - **UI:** n/a in this chunk.
  - **Backend / data:** uses existing `by_user_date` index; `userId` continues as client-passed arg until F01 C2 lands auth (ADR-019).
  - **UX copy:** none.

### US-2.A.3 — Filter predicate layer
- **As** Memory **I want** pure filter predicates that map to the 5 filter tabs **so that** server and client share filter logic.
- **Functional requirement:** `lib/memory/filters.ts` exports `applyFilter(events, filter): MemoryEvent[]` where `filter ∈ { 'all', 'check-ins', 'intake-events', 'flare-ups', 'visits' }`. `'all'` returns all; the rest filter by `event.type`. Pure functions, no I/O.
- **Acceptance:**
  - **UX:** in F02 C1, `'intake-events'` and `'visits'` always return empty (F04 / F05 not shipped) — this is correct, not a bug.
  - **UI:** n/a.
  - **Backend / data:** unit-tested with fixtures covering each filter against a 5-event mixed array (when fixtures simulate future event types).
  - **UX copy:** none.

### US-2.B.1 — Memory tab shell
- **As** Sonakshi **I want** a Memory screen with a clear title, search icon, scrubber, filter tabs, and a day list area **so that** the structure feels like a familiar journal.
- **Functional requirement:** `app/journey/memory/page.tsx` renders `<MemoryTab>`. `<MemoryTab>` lays out: header (title "Memory" + search icon, top-right) → `<WeekScrubber>` → `<FilterTabs>` → day list area (composed in 2.C). Tap search icon toggles `<SearchBar>` into header (search bar built in 2.E; in 2.B it's a stub).
- **Acceptance:**
  - **UX:** safe-area padding; mobile-first; no horizontal scroll on the page itself (only the scrubber strip).
  - **UI:** title centered or left-aligned per brand direction; search icon 44pt min hit target.
  - **Backend / data:** none.
  - **UX copy:** title: "Memory". Search icon `aria-label`: "Search your check-ins".

### US-2.B.2 — Week-at-a-time scrubber
- **As** Sonakshi **I want** a horizontal calendar strip showing one week at a time **so that** I can swipe to navigate weeks without scrolling endlessly.
- **Functional requirement:** `<WeekScrubber>` renders a row of 7 cells (S / M / T / W / T / F / S) with the date number on each. Selected day highlighted in the accent color (teal). Swipe left → next week. Swipe right → previous week. Today's day cell carries a today-indicator. Each cell shows a small dot if a check-in exists for that day, and a flare marker if `flare=true`. Full history navigable (no tier clamp).
- **Acceptance:**
  - **UX:** snap to week boundaries on swipe. Tap a day cell → updates selected day (parent state). Haptic tick on selection if supported.
  - **UI:** cell ~14% width × 56pt tall. Today-indicator visually distinct from selection. Month label above strip: "April 2026" — sticky, updates as Sonakshi swipes weeks.
  - **Backend / data:** reads the same `listEventsByRange` payload as the day list (state lifted to page).
  - **UX copy:** day cell `aria-label`: "Tuesday, 22 April. Check-in saved." (varies by state). Month label format: "MMMM YYYY".

### US-2.B.3 — Filter tabs
- **As** Sonakshi **I want** filter tabs immediately under the scrubber **so that** I can narrow what shows without leaving the day I'm viewing.
- **Functional requirement:** `<FilterTabs>` renders 5 tabs in fixed order: **All** (default) / **Check-ins** / **Intake events** / **Flare-ups** / **Visits**. Single-select. Tab state lifted to page; consumed by day list. Filter state reflected in URL `?filter=flare-ups` so refresh preserves.
- **Acceptance:**
  - **UX:** horizontally scrollable if cramped on small phones. Selected tab visually distinct (filled chip or underline per brand direction).
  - **UI:** 44pt min hit target per tab.
  - **Backend / data:** filter passed into `applyFilter` from US-2.A.3.
  - **UX copy:** verbatim tab labels: "All", "Check-ins", "Intake events", "Flare-ups", "Visits".

### US-2.C.1 — Day view structure
- **As** Sonakshi **I want** each day rendered as a grouped section with task states **so that** I can see at a glance what's done, missed, and pending.
- **Functional requirement:** `<DayView>` accepts `{ date, events }` and renders: day header ("Today" if today, otherwise "Tue, 22 Apr") → `<EventGroup>` per category in fixed order (Today's check-in / Medication intake / Other events) → completed items collapse into a "Completed" group at the bottom of the day. Reverse-chronological scroll loads previous days as Sonakshi scrolls past today; scroll position syncs back into the scrubber's selected-day state.
- **Acceptance:**
  - **UX:** smooth scroll; sticky day header. Completed group collapsible (tap header to expand / collapse).
  - **UI:** day header format: "Tue, 22 Apr" (IST). Section headers small, secondary text.
  - **Backend / data:** consumes filtered events from page state; calls `listEventsByRange` for new ranges as Sonakshi scrolls back.
  - **UX copy:** group labels: "Today's check-in", "Medication intake", "Other events", "Completed". Today's date row label: "Today".

### US-2.C.2 — Event row
- **As** Sonakshi **I want** each event as a clean row with time, title, and meta line **so that** I can scan a day quickly.
- **Functional requirement:** `<EventRow>` renders: task-state icon (left, 24pt) → time (HH:MM) → title (main, primary text) → meta line below (small, secondary). Task-state icon variants: empty circle (`'pending'`), green check (`'done'`), red strikethrough (`'missed'`). Tap full row to open detail sheet (wired in 2.D). Row min-height 72pt.
- **Acceptance:**
  - **UX:** entire row tappable. Visible focus ring for keyboard users.
  - **UI:** task-state icons colour-independent (icon + label hidden in `sr-only` text) — colour-blind safe per scoping. Reduced-motion: no row entrance animation.
  - **Backend / data:** receives a single `MemoryEvent` prop.
  - **UX copy:** `aria-label` for row: "{time}, {title}, {state}". Sr-only state labels: "Pending", "Done", "Missed".

### US-2.C.3 — Task-state vocabulary lock
- **As** the design system **I want** the three task states defined once **so that** Memory, Home, and Patterns share the vocabulary.
- **Functional requirement:** `<EventRow>`'s task-state icon imports from a single component (`<TaskStateIcon state>`) so future surfaces reuse it. F02 C1 ships the icons + sr-only labels; F03 / F08 import.
- **Acceptance:**
  - **UX:** n/a.
  - **UI:** consistent rendering across consumers.
  - **Backend / data:** none.
  - **UX copy:** none directly; sr-only labels per US-2.C.2.

### US-2.D.1 — Detail sheet
- **As** Sonakshi **I want** to tap an entry and see the full structured capture **so that** I can re-read what I said.
- **Functional requirement:** `app/journey/memory/[date]/page.tsx` loads check-in by `(userId, date)`. `<CheckinDetail>` renders all 5 metrics (pain / mood / medications / flare / energy) as labeled cards plus the full transcript ("What you said") plus any captured events that day (placeholders for F04 / F05; for F02 just the check-in). [Edit] and [Delete] buttons in the header.
- **Acceptance:**
  - **UX:** back navigation returns to prior scroll position in Memory list. Sheet style (full-screen on mobile, modal on desktop) per brand direction.
  - **UI:** full transcript readable; metrics as labeled cards.
  - **Backend / data:** `getCheckin(id)` already shipped F01 — wraps it.
  - **UX copy:** heading = formatted date. Section labels: "Pain", "Mood", "Medications", "Flare", "Energy", "What you said". Header buttons: "Edit", "Delete".

### US-2.D.2 — Edit-in-place within 48h
- **As** Sonakshi **I want** to fix yesterday's check-in **so that** a mistyped pain value doesn't poison Patterns.
- **Functional requirement:** `updateCheckin(id, patch)` mutation. Server enforces edit window: only if `now - createdAt < 48h` (per locked decision 2026-04-25). Past that, mutation throws `EditWindowExpired`. **Edit overwrites in place; no audit history retained in MVP** (per scoping line 696). `editedAt` timestamp written.
- **Acceptance:**
  - **UX:** edit button visible only within window. After window, button replaced by help text "Edits locked after 48 hours."
  - **UI:** edit triggers same TapInput components from F01 chunk 1.E (reuse, do not duplicate).
  - **Backend / data:** server checks window; returns typed error.
  - **UX copy:** lock text: "Locked — you can edit check-ins within 48 hours." Save button: "Save changes".

### US-2.D.3 — Hard delete with confirm
- **As** Sonakshi **I want** to delete a day I don't want to remember **so that** my Memory reflects only what I want.
- **Functional requirement:** `deleteCheckin(id)` mutation removes the row outright (per scoping line 696: "delete is irreversible and requires confirm"). Two-tap confirm: tap Delete → modal → confirm. No undo, no soft-delete, no restore path.
- **Acceptance:**
  - **UX:** modal full-screen on mobile; destructive button visually distinct. After confirm, the row disappears from the list and the user navigates back to the day view.
  - **UI:** modal: heading + body + primary destructive + secondary cancel.
  - **Backend / data:** row deleted from `checkIns` table. Mutation rejects if `userId` mismatch.
  - **UX copy:** modal heading: "Delete this check-in?" body: "This can't be undone. It'll be removed from Memory and your Doctor Report." primary: "Delete". secondary: "Keep it".

### US-2.E.1 — Keyword search across transcripts
- **As** Sonakshi **I want** to search "stiffness" and see every day I mentioned it **so that** I can find a moment without scrolling.
- **Functional requirement:** Tap search icon in `<MemoryTab>` header → `<SearchBar>` slides in. Debounced (250ms) input. Per scoping (line 695), MVP is **client-side**: load all check-ins in current scrubber range, filter `transcript.toLowerCase().includes(query.toLowerCase())`. Results render as a flat list (groups suspended) with day labels per row. Highlights matched substring in transcript snippet.
- **Acceptance:**
  - **UX:** clearing the input restores the normal day list. Empty results show "No mention of '{query}' yet."
  - **UI:** search bar replaces title in header; close (×) icon to dismiss.
  - **Backend / data:** no new mutation; reuses `listEventsByRange` payload + client-side filter (post-MVP backlog §23 covers Convex full-text index when dataset grows).
  - **UX copy:** placeholder: "Search what you've said". Empty result: "No mention of '{query}' yet."

### US-2.F.1 — First-time empty state
- **As** a new user **I want** a friendly Memory screen on day 0 **so that** I understand what goes here.
- **Functional requirement:** When user has zero events and no paywall clamp, `<EmptyState mode="first-time">` renders. Uses Feature 10 template family (illustration + title + body + primary CTA + bottom nav preserved per ADR-015). Primary CTA routes to `/check-in`.
- **Acceptance:**
  - **UX:** CTA leads to check-in.
  - **UI:** consistent with other Feature 10 templates.
  - **Backend / data:** driven by `events.length === 0 && !clampedByTier`.
  - **UX copy:** title: "Your memory starts today." body: "Tap the orb and tell me how today's feeling — your check-ins live here." primary: "Start today's check-in".

### US-2.F.2 — Integration test — full Memory flow
- **As** the team **I want** one end-to-end test of Memory **so that** regressions are caught.
- **Functional requirement:** Seed 45 check-ins across 60 days (mix: 10 with `flare=true`); assert all 60 days of events visible (no tier clamp); switch filter to "Flare-ups"; assert only flare events render; tap a check-in → detail sheet renders; edit metrics within 48h → save → assert update reflected in list; delete a check-in → confirm → assert row removed from list and from DB.
- **Acceptance:**
  - **UX:** n/a.
  - **UI:** n/a.
  - **Backend / data:** Convex test runtime; seeded fixtures in `tests/fixtures/memory-seed.ts`.
  - **UX copy:** none.

---

## Open scoping items inherited (not blocking F02 C1 build)

These are open in `scoping.md` § Open mechanics for the Journey module (line 714+); F02 C1 design is compatible with any resolution:

1. **Journey landing screen** (line 718) — tabs vs. hub. F02 C1 routes Memory at `/journey/memory` regardless; F08 wraps with the chosen Journey landing structure.
2. **Cross-linking** (line 719) — flare-up → Memory entry, dosage change → Medications. F02 C1 emits stable per-event URLs (`/journey/memory/{date}#{eventId}`) so future cross-links land correctly.
3. **Sharing scope** (line 720) — support-system shared read-only. Out of MVP; backlog §25.
4. **Offline cached read** (line 721) — out of MVP; backlog §26.

## Assumptions to validate during build

- **`stage` field surfacing in detail sheet.** ADR-021 locked the enum semantics. Detail sheet does not surface stage to Sonakshi (it's analytics-internal). Confirm with reviewers.
- **Search debounce on small device.** 250ms is a guess; test on a low-end Android during 2.E review.
- **Reverse-chronological scroll with week scrubber sync.** When Sonakshi scrolls past today, the scrubber should swipe automatically to the previous week. Edge case: scroll velocity vs. week boundary. Test on real device.

## Review notes

(Filled in after build cycles.)

## Learnings

(Filled in post-ship.)
