# Spike — Check-in confirm-card UX (housekeeping #15)

> **Status:** RECOMMENDATION — awaiting Rewant's pattern pick. No build work in this spike.
> **Date:** 2026-07-07 (W0-5 of the hardening run)
> **Feeds:** PR W2-4 (`refactor/confirm-card` — `ConfirmCard` + `ConfirmCardStack` merge). Must land before F06 clones the confirm pattern a 4th time.
> **Origin:** Backlog #15 (added 2026-05-10 after Rewant's prod smoke of PR #23). Related: `feedback_confirm_card_stack_threshold` (N≤3 finding).

## 1. Current UX (verified against main, 2026-07-07)

Two components render inside the check-in summary step when extractors detect
saveable data mid-conversation:

- `components/check-in/MedicationConfirmCard.tsx` (227 lines) — dose changes (F04).
- `components/check-in/EventConfirmCard.tsx` (353 lines) — doctor visits + blood work (F05), two `kind` variants; blood-work adds a per-marker unit `<select>` when the extractor returns `unit: null`.

Shared structure (~75–80% duplicated):

- Identical section shell (`mx-6 mt-4 rounded-2xl border p-6`, sage card vocabulary).
- Identical `prompt | saved | dismissed | error` state machine.
- **Silent dismiss** — "Not now" renders `<></>`; nothing persisted. React-state filter only.
- Error+Retry card (with the retry-guard invariant documented inline: `'error'` must stay out of the re-entry guard).
- A byte-for-byte duplicated Save/"Not now" button row — **4 copies** across the two files (prompt + error states × 2 files).

Stack behavior: cards render as plain siblings in locked order — dose changes →
`ConfirmSummary` → visit → blood-work (`app/check-in/page.tsx:1242`, set 2026-05-09).
We are **already at the N=3 grouping threshold** from
`feedback_confirm_card_stack_threshold`: a check-in that mentions a dose change,
a visit, and blood work shows three stacked cards plus the summary. F06 would
add a 4th card type.

Known problems:

1. **Dismiss is unrecoverable.** Accidental "Not now" = data gone until the next check-in happens to re-extract it. Nothing is persisted, no undo, no toast.
2. **Title reads like a question without an obvious action.** "Doctor visit on Tue, 21 Apr?" + "I heard: Dr. Mehta · Consultation" — the affordance ("save this to your visits") is implicit.
3. **No grouped presentation** for N>3 — F06 hits this immediately.
4. **`MedicationConfirmCard` has zero test coverage** (EventConfirmCard has tests).
5. EventConfirmCard's inline IST `formatDate` is one of the 13 duplicates W2-3 removes (its own comment says "TODO follow-up: lift to `lib/format/date.ts`").

## 2. Patterns evaluated

Scoring: **A** accidental-tap risk · **B** mid-conversation cognitive load ·
**C** dismiss recoverability · **D** implementation cost. 1 (bad) – 5 (good).

### P1 — Inline-confirm with undo-after-save

One primary tap ("Save") → card collapses to a saved-state row with a
time-boxed **Undo** chip; "Not now" likewise becomes a dismissed-state row with
Undo instead of vanishing.

```
┌──────────────────────────────────┐        ┌──────────────────────────────────┐
│ DOCTOR VISIT                      │  tap   │ ✓ Visit saved · Dr. Mehta        │
│ I heard: Dr. Mehta · Consultation │ ─────▶ │              [ Undo ]            │
│ Tue, 21 Apr                       │        └──────────────────────────────────┘
│ [ Save ]  [ Not now ]             │        (dismiss: "Okay, not saving this."
└──────────────────────────────────┘         + [ Undo ] — row lingers, greyed)
```

- **A: 4** — a mis-tap on either button is reversible within the session; the destructive action stops being destructive.
- **B: 4** — same card vocabulary the user already knows; one new element (Undo chip) that only appears post-action.
- **C: 5** — both save *and* dismiss become recoverable. Directly fixes problem 1.
- **D: 4** — pure component-level change: keep the state machine, add `saved-undoable`/`dismissed-undoable` states rendering a row instead of `<></>`. Undo on save = the delete mutation that already exists on every table; undo on dismiss = re-render prompt. No schema change, no gesture library.

### P2 — Swipe gestures (right = save, left = dismiss)

- **A: 1** — swipe is the *highest* accidental-action risk on a scrolling page, and this stack lives mid-scroll in the summary step. Chronic-illness users with joint pain/tremor (our actual cohort — see Sonakshi research: "tracking must not add cognitive load") are the worst-served by gesture precision.
- **B: 2** — invisible affordance; needs onboarding hint; conflicts with vertical scroll.
- **C: 1** — unless paired with P1-style undo anyway, a mis-swipe is still data loss — now easier to trigger.
- **D: 1** — pointer-event handling, threshold tuning, scroll-conflict arbitration, a11y fallback buttons anyway. Highest cost for negative safety.

### P3 — Card-as-sheet (tap card → bottom sheet with edit + save/cancel)

- **A: 3** — two-step commit is safe, but the sheet's own dismiss (backdrop tap) re-introduces the silent-loss path unless designed carefully.
- **B: 2** — a modal mid-check-in is a context switch; the summary step is exactly where the user is reviewing *everything*, and a sheet hides the rest of the review while open. For N=3 cards that's three open/close cycles.
- **C: 3** — sheet cancel can return to prompt state (recoverable), but only if the card row stays behind.
- **D: 2** — new primitive (sheet/portal, focus trap, scroll lock), new edit forms per card kind. Big for what it buys at N≤3; the edit-fields part is F06-era scope.

### P4 — Single primary action with editable fields up-front

Fields (doctor, type, date, markers, units) rendered as inline editable inputs;
one primary "Save" — "approve" becomes "this is right, save it".

- **A: 3** — single button reduces mis-tap surface, but dismiss still needs *some* affordance, and inline inputs add their own tap targets.
- **B: 2** — heaviest prompt-state card: a check-in mentioning 3 blood markers becomes a form. This is the opposite of the voice flow's "low cognitive load" goal; the unit picker already shows how quickly inline editing bloats a card.
- **C: 2** — unchanged dismiss problem unless combined with P1.
- **D: 2** — per-kind form fields, validation, controlled-input state × 3 card kinds (4 with F06).

### Grouped stack for N>3 (orthogonal — ships in W2-4 regardless of pattern)

Per `feedback_confirm_card_stack_threshold`, stacked cards work at N≤3; F06
takes us past it. Design once in `ConfirmCardStack`:

```
┌──────────────────────────────────┐
│ I also caught 4 things to save   │
│ ┌ ✓ Dose change · Tacrolimus ─┐  │   Collapsed group header with count;
│ ┌ ✓ Visit · Dr. Mehta ────────┐  │   rows expand one-at-a-time into the
│ ┌ ○ Blood work · CRP, ESR ────┐  │   full card (P1 behavior inside).
│ ┌ ○ Report note · … (F06) ────┐  │   "Save all" appears when every row
│ [ Save all ]                     │   is unambiguous (no unit pickers).
└──────────────────────────────────┘
```

Rule: N≤3 → cards render as today (individually, locked order); N≥4 → grouped
presentation. The stack component owns the rule so pages never decide.

## 3. Recommendation

**P1 — inline-confirm with undo-after-save.** Best safety-per-cost by a wide
margin: it is the only pattern that fixes dismiss recoverability *by
construction* rather than by adding a second mechanism, it preserves the card
vocabulary users have already smoked live, and it is the cheapest to build
(state-machine extension, no new primitives, no schema change). P2 is
disqualified on accidental-action risk for this cohort; P3 and P4 are
F06-era edit-flow ideas that can layer on top of P1 later if report cards
need inline editing.

Undo semantics to lock at W2-4 build time: undo-after-save calls the existing
delete mutation for the row just written; undo-after-dismiss restores the
prompt card. Undo chips persist until the check-in flow unmounts (not a 5s
toast — joint-pain users need time), then the choice becomes final.

## 4. Structural fixes that ship in W2-4 regardless of pattern choice

1. **Dismiss recoverability** — even the fallback "keep two buttons" world must stop rendering `<></>` on dismiss (P1's dismissed-row-with-undo is the fix).
2. **`MedicationConfirmCard` test coverage** — zero today; the merged `ConfirmCard` inherits EventConfirmCard's test patterns and must cover the dose-change variant + the retry-guard invariant.

Also riding W2-4 (from the plan, noted for completeness): the
`MedicationConfirmCard` + `EventConfirmCard` → `ConfirmCard`/`ConfirmCardStack`
merge (kills the 4× button row), the N>3 grouped presentation above, and the
zinc→token palette migration of the 12 affected `components/check-in/` files.

## 5. Decision needed from Rewant

Pick the pattern (recommendation: **P1**) → unblocks PR W2-4.
