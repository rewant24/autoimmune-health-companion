# Feature 03 Cycle 1 (Patterns — Foundation) Build Plan

> **Branch:** `feat/f03-cycle-1` off `main` (branch at dispatch time; do NOT base on another feature branch — PR scope = branch base)
> **Drafted:** 2026-07-08 · **Owner:** orchestrator (Claude Code main) · **Status:** DRAFT — pending Track B reviewer pass + Rewant's OQ answers (see feature MD)
> **Methodology:** Project Process Playbook — parallel build + parallel review + second-pass.

## Resume guide

Every phase boundary gets an annotated git tag. To restart from any phase:

```bash
cd "/Volumes/Coding Projects + Docker/autoimmune-health-companion"
git checkout feat/f03-cycle-1
git reset --hard <tag>     # or: git checkout <tag> for read-only inspection
```

| Tag | What's in the tree at this tag |
|---|---|
| `f03-c1/plan-saved` | This plan + feature MD at `ready`. Nothing built. |
| `f03-c1/pre-flight-done` | `lib/patterns/series-types.ts` contract stub committed; baseline green. |
| `f03-c1/build-integrated` | 3.A/3.B/3.C slices merged; lint + tsc + tests + build green. |
| `f03-c1/reviewed` | Review findings collected (read-only phase). |
| `f03-c1/fixed` | Fix pass applied, all green. |
| `f03-c1/second-pass-clean` | Second reviewer clean (or follow-up fixes applied). |
| `f03-c1/shipped` | Feature MD chunk statuses flipped, changelog + system-map + build-log updated. |

A **phase entry** is appended to `docs/build-log.md` at every tag (same-session logging rule).

---

**Goal:** Ship the Patterns foundation — read-only Convex aggregation (`convex/patterns.ts`: series / unlock / F06 summary), the shared viz component library (multi-metric stacked line, wellness ring, streak bar, window toggle), the `/journey/patterns` route with ADR-014 unlock gating and ADR-015 locked/empty states, and the Home placeholder swap that makes days 1–14 visually alive.

**Architecture:** 3 disjoint chunks, one owner each.
- 3.A owns `convex/patterns.ts` + `lib/patterns/**` — data layer, pure functions, zero React.
- 3.B owns `components/patterns/{MultiMetricChart,WellnessRing,StreakBar,WindowToggle}.tsx` — pure presentational SVG, zero fetching.
- 3.C owns `app/journey/patterns/**`, `PatternsLockedState`, `JourneyTabs`, `HomePatternsGlance` + the two import-swap touches (`app/home/page.tsx`, `app/journey/memory/page.tsx`) — orchestration + gating.

Integration seam = `lib/patterns/series-types.ts`, committed in pre-flight with the locked shape (`DayPoint`, `DoseMarker`, `FlareSpan`, `UnlockState`, `PatternsSummary`). 3.B/3.C import types only. 3.C injects query results into 3.B components as props.

**Tech stack:** Next.js 16 App Router · React 19 (`'use client'` for chart/route surfaces) · TypeScript 5 strict · Convex 1.x (queries only — NO mutations, NO schema change) · Tailwind 4 + design tokens · Vitest + Testing Library (infra exists) · hand-rolled SVG (OQ-1 default — STOP and flag if Rewant picked otherwise).

**Locked decisions — do NOT re-litigate:**
- ADR-014 gates: Home glance ungated · Patterns tab = day-14 floor AND ≥8 live check-in days · verbal insights are C2, not this cycle.
- ADR-015: locked/empty states are full-screen dedicated templates, never inline banners. BottomNav always preserved.
- Read-only invariant: F03 writes nothing. `convex/patterns.ts` exports queries only. Only allowed convex-mutation touch is extending `devSeed.ts` (internal, dev-only, `providerUsed: "seed"` wipe semantics preserved).
- W2-2 pattern: every range read pushes bounds into `withIndex` — no unbounded `.collect()` on user history. Do NOT reuse `dosageChanges.listDosageChanges` / `intakeEvents.listIntakeEvents` (unbounded); read indexes directly with bounds.
- Mood mapping `heavy=1…great=5` (×2 on the shared 0–10 axis) · wellness = renormalized mean of available components · streak bands 0.66/0.33 · gaps break the line, no interpolation · append chains merge newest-wins per metric · soft-deleted excluded.
- Identity: `useUserId()` seam only (`lib/auth/use-user-id.ts`). Never read `saha.testUser.v1` directly. Queries take `userId` arg (pre-auth convention; W3 swaps).
- Copy locks (scoping-verbatim): *"Patterns unlock once you've checked in for a couple of weeks."* · *"Give it a few more days — I'll show you what I see."* · zero-data Home card keeps *"Your patterns will appear here once you've been checking in."* Language guardrail: "support-system", never "caregiver"/"squad".
- No interpretation anywhere in C1 — descriptive numbers only. Insight language is C2.
- `date` strings are device-local `YYYY-MM-DD`, compared lexically; `today` supplied by the client (matches `getTodayCheckin`).

---

## Task 0: Pre-flight (orchestrator-only, before dispatch)

**Why:** the three chunks share one type contract; committing it first makes ownership disjoint from the first commit (pre-flight-stub pattern — shape is locked in the feature MD, so stubs are safe).

**Files touched:** create `lib/patterns/series-types.ts` (types + doc comments only, no logic), create `tests/patterns/` dir.

**Steps:**
- [ ] Confirm OQ-1 (chart lib), OQ-3 (JourneyTabs), OQ-5 (unlock constants) answered by Rewant — **stop if not**; defaults in the feature MD are proposals, not decisions.
- [ ] Branch `feat/f03-cycle-1` off current `main`; verify clean; run `npm run lint && npm run typecheck && npm run test:run && npm run build` for a green baseline.
- [ ] Write `lib/patterns/series-types.ts`: `DayPoint`, `DoseMarker`, `FlareSpan`, `PatternsSeries`, `UnlockState`, `PatternsSummary`, `WindowDays = 7 | 30 | 90`.
- [ ] Commit: `chore(f03): pre-flight — patterns series type contract` · tag `f03-c1/pre-flight-done`.

---

## Task 1: Build dispatch — 3 subagents in ONE multi-tool-call message

Each prompt carries: its stories from `docs/features/03-patterns.md` (full 4-lane acceptance), files owned, do-not-touch list, the locked-decisions block above, and "commit per story, Conventional Commits."

### Build-A prompt (Chunk 3.A — aggregation queries + contracts)

Files OWNED: `convex/patterns.ts`, `convex/devSeed.ts` (extend only), `lib/patterns/series-types.ts` (fill from stub), `lib/patterns/unlock.ts`, `lib/patterns/wellness.ts`, `tests/patterns/series.test.ts`, `tests/patterns/unlock.test.ts`, `tests/patterns/wellness.test.ts`

Do NOT touch: `components/**`, `app/**`, `convex/schema.ts`, any other existing convex module.

Stories: US-3.A.1 `getPatternsSeries` (per-day merged series + dose markers + flare spans; extracted handlers with structural mock-ctx, house pattern per `convex/checkIns.ts`) · US-3.A.2 `getPatternsUnlock` + pure predicate in `lib/patterns/unlock.ts` (exported constants `UNLOCK_MIN_DAYS = 14`, `UNLOCK_MIN_CHECKINS = 8`; append blocks count as one day) · US-3.A.3 `getPatternsSummary` (same pipeline as the series — no drift) + devSeed extension (21 days, ≥2 dose changes, one 3-day flare span, idempotent re-run).

Test approach: mock-ctx handler tests (house pattern). Fixture builders for synthetic day series. Required cases listed in the feature MD acceptance (gaps, append chains, declined, soft-deleted, span at window edge, sparse 90d, deactivated-med label).

### Build-B prompt (Chunk 3.B — viz component library)

Files OWNED: `components/patterns/MultiMetricChart.tsx`, `components/patterns/WellnessRing.tsx`, `components/patterns/StreakBar.tsx`, `components/patterns/WindowToggle.tsx`, `tests/patterns/chart.test.tsx`, `tests/patterns/ring-streak.test.tsx`

Do NOT touch: `convex/**`, `app/**`, `components/home/**`, `components/nav/**`, `lib/patterns/**` (import types only from `series-types.ts`).

Stories: US-3.B.1 multi-metric stacked line (hand-rolled SVG, shared 0–10 axis, dose-marker popover, flare shading, gap = line break) · US-3.B.2 wellness ring (tap-expand sub-scores; "—" for missing, never fake 0) + streak bar (30d, green/amber/red/neutral, `onSelectDay`) · US-3.B.3 window toggle (7/30/90 segmented, exported pure `defaultWindow(days)`).

Constraints: pure presentational — props in, callbacks out, zero fetching. Design tokens only (no hex). `prefers-reduced-motion` respected. 44pt targets. `role="img"` + aria-labels per acceptance. Legible at 320px.

Test approach: Testing Library render tests against fixture series (deterministic — assert marker counts, band classes, aria labels, popover toggle, reduced-motion branch).

### Build-C prompt (Chunk 3.C — route + unlock gate + Home swap)

Files OWNED: `app/journey/patterns/page.tsx`, `components/patterns/PatternsLockedState.tsx`, `components/nav/JourneyTabs.tsx`, `components/home/HomePatternsGlance.tsx`, `app/home/page.tsx` (import swap only), `app/journey/memory/page.tsx` (mount JourneyTabs only), DELETE `components/home/MetricVizPlaceholder.tsx`, `tests/patterns/route.test.tsx`, `tests/patterns/home-glance.test.tsx`

Do NOT touch: `convex/**`, 3.B's four components (consume as-is), `lib/patterns/**` (import only), `components/memory/**` internals beyond the JourneyTabs mount.

**Interface contract:** import types from `lib/patterns/series-types.ts`; call `api.patterns.*` queries via `useQuery`; pass results into 3.B components untransformed.

Stories: US-3.C.1 route + JourneyTabs (route-change tabs, Memory rhythm, streak-tap → Memory day view; add minimal query-param initial-date support to Memory ONLY if it lacks one) · US-3.C.2 locked/fresh ADR-015 templates (copy locks verbatim; reactive progress *"Day {N} of 14"*) · US-3.C.3 HomePatternsGlance swap (30d series, streak + descriptive week summary, links to `/journey/patterns`, zero-data copy retained, `data-testid` migration `metric-viz-placeholder` → `home-patterns-glance` including any existing tests that key on it).

Test approach: Testing Library with mocked `useQuery`/`useUserId`; assert gate branches (fresh / locked / unlocked), copy verbatim, CTA hrefs, testid migration.

---

## Task 2: Integrate slices

- [ ] `git log --name-only` cross-check: files touched vs ownership table — overlaps flagged.
- [ ] Seam check: `series-types.ts` exports vs 3.B prop types vs 3.C usage — mismatches noted for the fix list, not hot-fixed.
- [ ] Grep guards: no `.collect()` without index bounds in `convex/patterns.ts` · no `localStorage.getItem('saha.testUser` outside the auth seam · no mutation exports in `patterns.ts` · `MetricVizPlaceholder` fully gone (imports + tests).
- [ ] `npm run lint && npm run typecheck && npm run test:run && npm run build` → green.
- [ ] Tag `f03-c1/build-integrated`.

---

## Task 3: Review dispatch — 3 reviewers in ONE multi-tool-call message

All three read the delta from `f03-c1/pre-flight-done..HEAD`.

### Review-1 (brief alignment)
- Every C1 story's 4-lane acceptance satisfied or explicitly deferred with a note.
- Copy locks verbatim (unlock copy ×2, zero-data Home copy, tab labels); "support-system" guardrail; **no interpretation language anywhere** (C1 is descriptive-only — this is the ADR-014 line).
- Scope creep: any C2 leakage (insight wording, annotations, paywall), any writes beyond devSeed.

### Review-2 (spec + regression)
- ADR-014 gate math (day-14 floor + count; append chains = one day) and ADR-015 template shape.
- Read-only invariant: `convex/patterns.ts` exports queries only; no schema diff; devSeed wipe semantics intact.
- W2-2: all range reads index-bounded (this is the review's #1 regression class — `dosageChanges`/`intakeEvents` house queries are unbounded traps).
- Home still renders for existing users (placeholder swap = no layout shift, testid migration complete); `/journey/memory` unregressed by JourneyTabs; BottomNav active-state still correct on `/journey/patterns`.
- `useUserId()` seam respected; Next 16 idioms; `'use client'` placement; no `any` leaks across the seam.

### Review-3 (edge cases)
- Data: zero check-ins · 1 check-in · exactly day 13/14 boundary · 8th-check-in boundary · all-metrics-declined day · append chain with conflicting metrics · soft-deleted-only date · flare `ongoing` run crossing the window edge · 90d window with 3 points · dose change on a day with no check-in · deactivated med's dose marker.
- UI: 320px width · `prefers-reduced-motion` · WCAG AA line colors · neutral-vs-red streak distinguishability · aria labels present · popover dismissal.
- Timezone/date: device-local `today` vs seeded IST dates; lexical compare assumptions; month boundary in the streak bar.
- Reactive: check-in save while locked screen open → progress updates without reload.

Merge findings into one ordered fix list grouped by chunk. Tag `f03-c1/reviewed`.

---

## Task 4: Fix pass

- [ ] Triage blocker → major → minor; discard anything re-litigating locked decisions.
- [ ] Smallest-diff fixes; re-run full local gate.
- [ ] Commit: `fix(patterns): address F03 C1 review findings` (body lists findings) · tag `f03-c1/fixed`.

---

## Task 5: Second-pass review

One Agent call; prompt includes the locked-decisions block + first-pass fix summary; hunts the 1–2 missed items.

- [ ] Clean → tag `f03-c1/second-pass-clean`. Findings → one more fix commit max, then tag.
- **Stop condition:** blocker needing >1 further fix commit → stop, morning brief.

---

## Task 6: Ship gate

Local/CI green is **necessary, not sufficient** (ship-day rule: vitest green ≠ smoke).

- [ ] Push branch, open PR against `main`; `ci` check green (~51s suite + lint).
- [ ] **Convex deploy reminder:** `convex/patterns.ts` is new — Vercel promote alone does NOT ship it. Prod path = `scripts/ship-prod.sh` (Saha shipping rule); dev/preview = `npx convex dev` push. Same shape every rung, only data differs.
- [ ] Seed a preview user via extended `devSeed.seedCheckins` (21d fixture) — F03's ship gate needs 14d+ of data to demonstrate the unlock.
- [ ] **Manual smoke on the preview URL (5 steps):** ① fresh user → Home shows zero-data copy, Patterns tab shows fresh template ② seeded user → Home glance strip + week summary render ③ Patterns tab unlocked → chart with ≥2 dose markers + flare shading, 7/30/90 toggle works ④ streak-day tap lands on the right Memory day ⑤ locked-state progress increments after a live check-in.
- [ ] Feature MD: chunk 3.A/3.B/3.C → `shipped`; `architecture-changelog.md` entry; `system-map.md` F03 status; `build-log.md` session entry; memory MEMORY.md "Next" line.
- [ ] Commit `docs: ship F03 C1 — statuses, changelog, system-map, build-log` · tag `f03-c1/shipped`.
- [ ] **PR left open for Rewant unless explicitly told to merge.**

---

## Stop conditions (apply throughout)

- 2 fix-pass iterations still red → stop, don't ship, morning brief.
- Reviewer blocker conflicting with a locked decision → discard, note, don't wake.
- Anything requiring a `convex/schema.ts` edit or a new mutation → stop; that breaks the F03 read-only invariant and needs Rewant.
- Anything requiring `docs/scoping.md` edits → stop (PR #37 pending on it).
- Convex schema/functions: preview-verified; prod deploy is Rewant's separate manual step (`scripts/ship-prod.sh`).
