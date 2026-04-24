---
number: 02
name: Memory
slug: memory
status: chunked
depends_on: [01-daily-checkin]
blocks: [06-doctor-report, 08-journey]
owner: rewant
scoping_ref: docs/scoping.md#feature-2-memory
adr_refs: []
last_updated: 2026-04-25
---

# Feature 02 — Memory

## Intent

Sonakshi opens Memory to see her last 30 days at a glance. Scroll through a timeline of check-ins, filter by metric or flare status, jump to a date via calendar scrubber, tap any day to see the full detail, edit or delete (MVP allows edit within 48h).

## Scope in / out

- **In (MVP):** 30-day list (free tier clamp), filter bar, calendar scrubber, detail view, edit within 48h, soft delete with undo toast, paywall banner at 30d boundary.
- **Out (backlog):** full edit on older check-ins, blood-test attachments, support-system shared read-only.

## Dependencies

- **Reads:** Feature 01 check-in data (`checkIns` table).
- **Blocks:** Feature 06 Doctor Report (aggregates), Feature 08 Journey (references).

## Files owned (feature-wide)

```
app/(memory)/page.tsx
app/(memory)/[date]/page.tsx
components/memory/CheckinList.tsx
components/memory/CheckinListItem.tsx
components/memory/CheckinDetail.tsx
components/memory/CalendarScrubber.tsx
components/memory/FilterBar.tsx
components/memory/EmptyState.tsx
components/memory/PaywallBanner.tsx
lib/memory/filters.ts
convex/checkIns.ts            // extend — update, softDelete, filtered list
tests/memory/*.test.ts
```

---

## Chunks

### Cycle 1 — List + detail + scrubber

#### Chunk 2.A — 30-day list query + pagination
- **Owner:** build-agent-A
- **Files owned:**
  - `convex/checkIns.ts` (extend — `listByRange`, `listPaged`)
  - `lib/memory/filters.ts`
  - `tests/memory/list-query.test.ts`
- **Status:** scoped
- **Stories:** US-2.A.1, US-2.A.2
- **Do-not-touch:** `components/`, `app/`

#### Chunk 2.B — List item UI + detail view
- **Owner:** build-agent-B
- **Files owned:**
  - `app/(memory)/page.tsx`
  - `app/(memory)/[date]/page.tsx`
  - `components/memory/CheckinList.tsx`
  - `components/memory/CheckinListItem.tsx`
  - `components/memory/CheckinDetail.tsx`
  - `tests/memory/list-ui.test.tsx`
- **Status:** scoped
- **Stories:** US-2.B.1, US-2.B.2, US-2.B.3
- **Do-not-touch:** `CalendarScrubber`, `FilterBar`, `convex/`

#### Chunk 2.C — Calendar scrubber
- **Owner:** build-agent-C
- **Files owned:**
  - `components/memory/CalendarScrubber.tsx`
  - `tests/memory/scrubber.test.tsx`
- **Status:** scoped
- **Stories:** US-2.C.1
- **Do-not-touch:** anything else

### Cycle 2 — Filters, edit/delete, paywall polish

#### Chunk 2.D — Filter bar (metric / flare / missed meds)
- **Owner:** build-agent-A
- **Files owned:**
  - `components/memory/FilterBar.tsx`
  - `tests/memory/filter-bar.test.tsx`
- **Status:** scoped
- **Stories:** US-2.D.1, US-2.D.2
- **Do-not-touch:** list, detail, scrubber

#### Chunk 2.E — Edit / delete + confirmations
- **Owner:** build-agent-B
- **Files owned:**
  - `convex/checkIns.ts` (extend — `updateCheckin`, `softDeleteCheckin`)
  - `components/memory/CheckinDetail.tsx` (extend — wire edit/delete buttons)
  - `tests/memory/edit-delete.test.tsx`
- **Status:** scoped
- **Stories:** US-2.E.1, US-2.E.2
- **Do-not-touch:** `CalendarScrubber`, `FilterBar`, `CheckinList`, `CheckinListItem`

#### Chunk 2.F — Empty states + paywall banner + integration tests
- **Owner:** build-agent-C
- **Files owned:**
  - `components/memory/EmptyState.tsx`
  - `components/memory/PaywallBanner.tsx`
  - `tests/memory/integration.test.tsx`
- **Status:** scoped
- **Stories:** US-2.F.1, US-2.F.2, US-2.F.3
- **Do-not-touch:** prior chunks' source files beyond composition

---

## User Stories

### US-2.A.1 — Range-based list with paywall boundary
- **As** Memory **I want** a query that returns at most the last 30 days for free users **so that** the paywall is enforced server-side.
- **Functional requirement:** `listByRange({ fromDate, toDate, limit, cursor, filters? })`. For free tier: `fromDate` clamped to `today - 30d`. Paid tier: no clamp. Returns `{ items, nextCursor, clampedByTier: bool }`.
- **Acceptance:**
  - **UX:** clamp not visible as an error — UI shows paywall banner when `clampedByTier` true.
  - **UI:** n/a in this chunk.
  - **Backend / data:** tier read from user record. Index `(userId, date desc)` used.
  - **UX copy:** none.

### US-2.A.2 — Filter predicate layer
- **As** Memory **I want** pure filter predicates **so that** client and server share filter logic.
- **Functional requirement:** `lib/memory/filters.ts`: `applyFilters(rows, { painMin?, painMax?, mood?, flareOnly?, missedMedsOnly? })`. Server uses same predicates for queries that can be indexed; client uses for in-memory refinement.
- **Acceptance:**
  - **UX:** n/a.
  - **UI:** n/a.
  - **Backend / data:** pure functions; unit-tested with 10+ fixtures.
  - **UX copy:** none.

### US-2.B.1 — Chronological list
- **As** Sonakshi **I want** to scroll my recent check-ins by day **so that** I can remember what I felt.
- **Functional requirement:** `<CheckinList>` renders paged results from `listByRange`. Each row = `<CheckinListItem>`. Infinite scroll uses cursor.
- **Acceptance:**
  - **UX:** smooth scroll; no layout shift on load. Day-header sticky.
  - **UI:** list rows min-height 72pt; flare days carry a small marker; missed-meds days a different marker.
  - **Backend / data:** page size 20.
  - **UX copy:** day header format: "Tue, 22 Apr" (IST). Today row: "Today".

### US-2.B.2 — List item content
- **As** Sonakshi **I want** a one-glance summary on each row **so that** I don't have to open each one.
- **Functional requirement:** row shows: date, pain number, mood chip, flare badge (if true), missed-meds badge (if true).
- **Acceptance:**
  - **UX:** tap entire row to open detail.
  - **UI:** badges colour-independent (icon + label) for colour-blind safety.
  - **Backend / data:** from list item payload.
  - **UX copy:** flare badge label: "flare". Meds badge: "missed meds".

### US-2.B.3 — Detail view
- **As** Sonakshi **I want** to open one day **so that** I can see everything — metrics, transcript, what I said.
- **Functional requirement:** `app/(memory)/[date]/page.tsx` loads one check-in by date. Renders `<CheckinDetail>` with all 5 metrics + transcript + edit/delete buttons (wired in 2.E).
- **Acceptance:**
  - **UX:** back navigation returns to prior scroll position.
  - **UI:** full transcript readable; metrics as labeled cards.
  - **Backend / data:** `getCheckin` by `(userId, date)`.
  - **UX copy:** heading = date. Section labels: "Pain", "Mood", "Medications", "Flare", "Energy", "What you said".

### US-2.C.1 — Horizontal calendar scrubber
- **As** Sonakshi **I want** a quick way to jump to a date **so that** I don't scroll endlessly.
- **Functional requirement:** horizontal-scroll strip of last 30 days (free) / full history (paid). Each cell marks presence of check-in + flare status. Tap cell → scrolls list to that date.
- **Acceptance:**
  - **UX:** current day centered on mount. Snap-scroll. Haptic tick on cell select.
  - **UI:** cell 48pt wide × 56pt tall. Clear today-indicator.
  - **Backend / data:** reads the same list payload as `<CheckinList>` (sibling, no duplicate query — lift state to page).
  - **UX copy:** month label sticky above strip: "April 2026".

### US-2.D.1 — Filter controls
- **As** Sonakshi **I want** to narrow Memory to "only flare days" or "only missed-meds days" **so that** I can spot patterns.
- **Functional requirement:** chips: "All", "Flare days", "Missed meds", "High pain (≥7)". Multi-select; applied via `applyFilters` (2.A).
- **Acceptance:**
  - **UX:** filter state reflected in URL `?filters=flare,missedMeds` so refresh preserves.
  - **UI:** chip row horizontally scrollable; selected chip visually distinct.
  - **Backend / data:** filters passed to `listByRange`.
  - **UX copy:** chip labels verbatim above.

### US-2.D.2 — Empty filtered state
- **As** Sonakshi **I want** a clear message when filters match nothing **so that** I'm not confused by a blank list.
- **Functional requirement:** when filtered list empty but underlying data exists, render a filter-specific empty card.
- **Acceptance:**
  - **UX:** card offers "Clear filters" button.
  - **UI:** distinct from global empty state (2.F).
  - **Backend / data:** driven by filter metadata, not query errors.
  - **UX copy:** "No days match these filters. {Clear filters}."

### US-2.E.1 — Edit within 48h
- **As** Sonakshi **I want** to fix yesterday's check-in **so that** a mistyped pain value doesn't poison Patterns.
- **Functional requirement:** `updateCheckin(id, patch)` mutation. Server enforces edit window: only if `now - createdAt < 48h`. Past that, mutation throws `EditWindowExpired`. Post-MVP full-edit is in backlog.
- **Acceptance:**
  - **UX:** edit button visible only within window. After window, button replaced by "Edits locked after 48h" help text.
  - **UI:** edit triggers same TapInput components from Feature 01 (reuse, do not duplicate).
  - **Backend / data:** audit trail: `editedAt` timestamp written; original values not retained in MVP (ADR hook noted in review).
  - **UX copy:** lock copy: "Locked — you can edit check-ins within 48 hours."

### US-2.E.2 — Soft delete with confirmation
- **As** Sonakshi **I want** to delete a check-in **so that** a day I don't want to remember can go.
- **Functional requirement:** `softDeleteCheckin(id)` sets `deletedAt`. Queries exclude soft-deleted. No hard delete (compliance + undo hook).
- **Acceptance:**
  - **UX:** two-tap confirm (tap delete → modal → confirm). Undo toast for 5s after delete.
  - **UI:** modal full-screen on mobile; destructive button distinct.
  - **Backend / data:** row retained in DB; queries filter `deletedAt === undefined`.
  - **UX copy:** modal heading: "Delete this check-in?" body: "It'll be removed from Memory and your Doctor Report." primary: "Delete". secondary: "Keep it".

### US-2.F.1 — First-time empty state
- **As** a new user **I want** a friendly Memory screen on day 0 **so that** I understand what goes here.
- **Functional requirement:** when user has zero check-ins, render `<EmptyState mode="first-time">` with primary CTA to start a check-in.
- **Acceptance:**
  - **UX:** CTA routes to `/check-in`.
  - **UI:** illustration placeholder + heading + CTA.
  - **Backend / data:** driven by list query returning `items.length === 0` and no paywall clamp.
  - **UX copy:** "Your first check-in starts your story. — Start today's check-in".

### US-2.F.2 — Paywall banner (free tier, >30d)
- **As** Sonakshi **I want** to know when older check-ins are hidden **so that** I can decide to upgrade.
- **Functional requirement:** when `clampedByTier` true from 2.A, show `<PaywallBanner>` at list bottom. Tap → pricing page.
- **Acceptance:**
  - **UX:** banner doesn't block scroll — sits at list end.
  - **UI:** subtle, not intrusive; one primary CTA.
  - **Backend / data:** reads tier + clamp flag.
  - **UX copy:** "You're seeing the last 30 days. Sakhi Companion keeps your full history. — See plans".

### US-2.F.3 — Integration test — full Memory flow
- **As** the team **I want** one end-to-end test of Memory **so that** regressions are caught.
- **Functional requirement:** seed 45 check-ins across 60 days; sign in as free user; assert only 30 visible; assert paywall banner renders; apply flare filter; assert list filters correctly; edit a check-in within 48h; assert update visible; soft-delete; assert removal.
- **Acceptance:**
  - **UX:** n/a.
  - **UI:** n/a.
  - **Backend / data:** test uses Convex test runtime; seeded fixtures in `tests/fixtures/memory-seed.ts`.
  - **UX copy:** none.

---

## Review notes

(Filled in after build cycles.)

## Learnings

(Filled in post-ship.)
