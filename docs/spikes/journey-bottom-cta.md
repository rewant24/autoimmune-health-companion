# Spike — Journey bottom CTA ("+ Log visit or blood work")

**Status:** DRAFT — recommendation pending Rewant approval.
**Date opened:** 2026-05-17.
**Source:** Housekeeping #10 reopened as Lane D of the 2026-05-09 sprint.
**Surface:** `components/memory/MemoryTab.tsx`, `LogVisitOrBloodWorkAffordance` (lines 132–195 today).
**Spec reference:** `docs/features/05-doctor-visits.md:124` — _"single button at the bottom of the day view: + Log visit or blood work"_.
**Scope:** the bottom-of-MemoryTab affordance only. Standalone `/visits` + `/blood-work` empty-state CTAs are out of scope unless the chosen pattern argues for visual consistency.

---

## 1. Current state

Native `<details>` popover. Functional but design-thin: the chevron-twist + a row of two pills popping out feels less crafted than the rest of the surface.

```tsx
<details className="rounded-2xl border" …>
  <summary data-testid="memory-log-affordance-trigger" …>
    + Log visit or blood work
  </summary>
  <div className="flex flex-wrap gap-2 px-5 pb-4">
    <Link href="/visits/new"     data-testid="memory-log-affordance-visit">      Log visit       </Link>
    <Link href="/blood-work/new" data-testid="memory-log-affordance-bloodwork">  Log blood work  </Link>
  </div>
</details>
```

**Test IDs in place today:** `memory-log-affordance`, `memory-log-affordance-trigger`, `memory-log-affordance-visit`, `memory-log-affordance-bloodwork`.

**Existing test coverage:** none. `tests/memory/c1-smoke.test.tsx` renders MemoryTab but does not interact with the affordance. So this spike does not need to refactor old tests — just author new ones for the chosen pattern.

**Why this matters now.** Voice + check-in capture is the primary path for visits/bloods (extractor + confirm cards land them automatically). The bottom affordance is the *manual catch-up* path — for entries the user wants to add without going through a voice check-in. Discoverability matters because it is the only escape hatch for that workflow inside the Journey pillar; tap-target ergonomics matter because the user is in a hurry (clinic waiting room, between meetings).

---

## 2. Alternatives

### A. Sheet-style popover (Radix `Dialog` / bottom sheet)

Tap a single primary CTA at the bottom of MemoryTab → bottom sheet slides up with two larger options + a dismiss handle.

```
┌─────────────────────────────────┐
│   + Log visit or blood work     │ ← primary CTA, full-width pill
└─────────────────────────────────┘

  on tap:
  ┌─────────────────────────────────┐
  │   ─                             │ ← drag handle
  │   What did you want to log?     │
  │                                 │
  │   🩺  Doctor visit              │ ← row with icon + label
  │       Add a new appointment     │
  │                                 │
  │   🧪  Blood work                │
  │       Record lab results        │
  │                                 │
  │       Cancel                    │
  └─────────────────────────────────┘
```

**Pros:**
- Discoverable single CTA — eye lands on one button, not two.
- Tap target on mobile is huge (44pt+ trivially).
- Sheet pattern is iOS/Android-native idiom — feels app-shaped.
- Room for icon + subtitle per option without crowding.
- Outside-tap and Esc-key dismissal handled by Radix.

**Cons:**
- Modal dismissal flow — Sonakshi has to tap twice (open sheet → tap option). Today's `<details>` is also two taps but the second tap is closer.
- Adds a Radix Dialog dependency if we don't already use it. (We don't — verified `package.json` has no `@radix-ui/react-dialog`.)
- Hand-rolling a bottom sheet without Radix means focus-trap + Esc-key + outside-click on our own — moderate implementation cost.

### B. Two side-by-side CTA pills (no popover)

Drop the popover entirely. Render both CTAs inline at the bottom of MemoryTab as two equal-weight pills under a small section header.

```
   Add to your record
┌──────────────────┐ ┌──────────────────┐
│  + Log visit     │ │  + Log blood work│
└──────────────────┘ └──────────────────┘
```

**Pros:**
- Zero hidden state. Sonakshi sees both options without tapping anything.
- Single tap to either flow (vs two taps today).
- No new dependency. Minimal implementation cost — replace the `<details>` with two `<Link>`s in a flex row.
- Mobile tap target is comfortable as long as we sit them ≥ 44pt high.

**Cons:**
- Two CTAs side-by-side compete for attention — neither feels primary.
- Vertical space cost — current `<details>` is one row when collapsed; this is one row of two pills plus a header label. Slightly more screen real-estate at the bottom of the day view.
- Doesn't scale — if F08 adds Journey aggregation surfaces with more event types, this row of pills can't grow.

### C. FAB pattern (floating action button)

A floating "+" button bottom-right of the Journey page, consistent with `RegimenList`'s add affordance (FAB lives in the parent page per `components/medications/RegimenList.tsx:12`). Tap → sheet menu with the two options.

```
                 ┌─────────┐
                 │   ╋     │ ← floating action button, bottom-right
                 └─────────┘

  on tap → same sheet as Alternative A
```

**Pros:**
- Visual consistency with `/medications` page — Sonakshi learns one add-pattern across surfaces.
- Always visible regardless of scroll position (current `<details>` requires scrolling to bottom of day view).
- FAB occupies almost no vertical space in the day-view region — gives the calendar scrubber + day list more room.

**Cons:**
- FAB overlaps content. On mobile with a short day list, the FAB sits over the empty space; with a full list, it covers part of the last row. Mitigated by bottom padding on the scroll container.
- Conflicts with the persistent BottomNav. `components/nav/BottomNav.tsx` is already pinned to the bottom of every page. Stacking a FAB above BottomNav means careful z-index + bottom-offset wiring. (Not impossible, but the wiring is non-trivial.)
- Discoverability of a "+" icon for *first*-time users is mediocre without a label. Sonakshi has to learn "+ in the Journey pillar means log a visit or blood work."

### D. Inline two-button row under section header (no popover, no FAB)

A static section at the bottom of MemoryTab: small caption + two pill buttons stacked vertically (not side-by-side). Closer to a list-row than a CTA group.

```
   Add to your record

   🩺  + Log doctor visit     →
   🧪  + Log blood work        →
```

**Pros:**
- Discoverable — both options are visible, labeled, and unambiguous.
- Generous tap targets — full-width rows on mobile, 44pt+ height each.
- No new dependency, no popover, no FAB.
- Scales — adding a third event type in F08 is just one more row.
- Matches the Memory tab's prevailing visual rhythm (rows of events) — feels native to the surface.

**Cons:**
- Vertical space cost is the highest of the four options — two full rows at the bottom of MemoryTab.
- Pushes the day list up when no events for the selected day (could feel "form-y" on empty days).
- Without a hover/tap affordance, the rows can read as "events" rather than "actions" — needs careful styling to land as a CTA.

---

## 3. Comparison

| Axis | A. Sheet | B. Side-by-side | C. FAB | D. Stacked rows |
|---|---|---|---|---|
| **Discoverability (first session)** | High — single visible CTA | High — both visible | Medium — "+" icon needs learning | High — both visible + labeled |
| **Tap target (mobile)** | Very large (sheet rows) | Comfortable (≥44pt pills) | Large (FAB ~56pt) | Very large (full-width rows) |
| **Taps to flow start** | 2 (open sheet → option) | 1 | 2 (FAB → option) | 1 |
| **Consistency w/ Memory surface** | Neutral | Good — pill vocabulary | Conflicts (BottomNav stack) | Strong — row vocabulary |
| **Consistency w/ Medications surface** | Neutral | Neutral | Strong — FAB matches | Neutral |
| **Implementation cost** | Medium (Radix Dialog dep OR hand-roll sheet) | Low | Medium-high (BottomNav z-index + offset) | Low |
| **Accessibility** | Strong (Radix bakes in) | Strong (native links) | Medium (FAB labeling + focus) | Strong (native links) |
| **Vertical space cost** | Low (one CTA) | Medium (one row of pills) | None (overlays content) | High (two rows) |
| **Scales to F08 event types** | Yes (sheet rows) | No (more pills crowd) | Yes (sheet rows) | Yes (more rows) |
| **Recoverability of accidental tap** | Strong (Cancel button in sheet) | N/A — direct link | Strong (Cancel in sheet) | N/A — direct link |

---

## 4. Recommendation

**B — two side-by-side CTA pills under a small section header.**

**Why over the others:**

1. **One tap to the flow.** The job is *manual catch-up logging* — the user opened MemoryTab to scroll history, then decided to add an entry. Adding a sheet between intent and action is a friction tax. Current `<details>` is two taps; alternatives A and C are also two taps; alternative B and D are one.
2. **Lowest implementation cost + zero new dependency.** B is the smallest change from today's `<details>`: replace the popover with a two-link flex row + a small caption above. No Radix dialog, no FAB z-index choreography, no focus-trap engineering. The sprint is the MVP-completion sprint — Lane B (auth) is the headline; Lane D should ship cheap and not bloat the dep tree.
3. **The "doesn't scale to F08" con is hypothetical.** F08 will likely live on its own pillar surface (Journey aggregation) with its own affordances, not bolt more event types onto this CTA. If F08 ever forces the issue, swap to Alternative A then.
4. **Consistency wins.** The Memory surface already speaks in pills (filter tabs, event-row chips). Two CTA pills slot into that vocabulary; A and C introduce sheet/FAB idioms that don't appear elsewhere in Memory.
5. **Visual hierarchy is solvable with one strong + one secondary pill.** Make "Log visit" the filled pill (sage-deep background) and "Log blood work" the outline pill — same treatment as today's `<details>` content. Resolves the "neither feels primary" con without adding a third element.

**Tradeoff accepted:** marginal extra vertical space vs today's collapsed `<details>` (one row → one row of pills + caption ≈ 24px more). Negligible on the day view.

---

## 5. Open questions for Rewant

1. **Approve recommendation B**, or pick another?
2. **Section header copy.** Options: _"Add to your record"_ / _"Log something"_ / _"Catch up your record"_ / drop the header entirely and let the pills speak for themselves. Recommend dropping the header — the labels on the pills are self-explanatory and removing it saves the vertical-space tradeoff above.
3. **Pill copy.** Current `<details>` says "Log visit" / "Log blood work" inside the popover; the trigger says "+ Log visit or blood work". For B, recommend keeping the inside-popover labels: **"Log visit"** + **"Log blood work"** with the `+` prefix on the filled (primary) one only.
4. **Visual hierarchy.** Recommend filled + outline (per § 4 reason 5). Confirm or invert.
5. **Lane D scope guardrail.** Sprint plan § Risk 9 flags scope creep — confirm we stay inside `LogVisitOrBloodWorkAffordance` and do not touch standalone `/visits` + `/blood-work` empty-state CTAs in this lane.

---

## 6. Implementation plan (post-approval, for reference)

1. Replace `LogVisitOrBloodWorkAffordance` body in `components/memory/MemoryTab.tsx` with two-link flex row.
2. Preserve all four existing data-testids (`memory-log-affordance`, `memory-log-affordance-trigger` → relabel to `memory-log-affordance-primary` if it makes semantic sense, `memory-log-affordance-visit`, `memory-log-affordance-bloodwork`). Keep names stable to avoid test churn elsewhere.
3. Add a new test `tests/memory/log-affordance.test.tsx`:
   - Renders MemoryTab; both pills visible without interaction.
   - Tap "Log visit" → asserts `href === '/visits/new'`.
   - Tap "Log blood work" → asserts `href === '/blood-work/new'`.
   - Keyboard accessibility: Tab-Tab focuses both in DOM order.
4. Single reviewer subagent pass per playbook.
5. Fix findings, open PR off `main`, single review pass, merge as squash.
6. Live smoke on `https://www.meetsaha.com/journey/memory`: tap each pill, verify both routes open, verify visual rhythm matches rest of Memory surface.
7. No `npx convex deploy` needed (no `convex/` changes).
8. Update `housekeeping_backlog.md` — move #10 to Resolved with squash hash; update sprint doc § Decision log.
