---
number: 03
name: Patterns
slug: patterns
status: chunked
depends_on: [01-daily-checkin, 02-memory, 04-medications]
blocks: [06-doctor-report, 08-journey]
owner: rewant
scoping_ref: docs/scoping.md#feature-7-patterns
adr_refs: [ADR-014, ADR-015, ADR-019]
last_updated: 2026-07-08
---

# Feature 03 — Patterns

> **Note on this revision (2026-07-08).** Chunking-cycle Track A draft (session-30 overnight routing). Reconciled to `docs/scoping.md` §§ Feedback loop, Journey module, Whoop-style charts. Reviewer-subagent pass (Track B) + Rewant review still to run — status flips `chunked → ready` only after the merged fix list is applied (build-plan locked decision 6, Map 3). Front-matter `blocks` corrected from the stub's `[05-doctor-visits, 06-doctor-report]` to `[06-doctor-report, 08-journey]` — F05 shipped 2026-05-09 without F03, so it never depended on it; the stub's own Dependencies section already said 06 + 08. `depends_on` gains 02 (JourneyTabs coordination) and 04 (dose-change markers read `dosageChanges`).

## Intent

Patterns is the **"looking back with interpretation" surface inside the Journey pillar** — the retention payoff for showing up daily. It has two graduated halves (ADR-014):

1. **Visual, from day 1 — on Home.** Streak bar + week-so-far rings replace the `MetricVizPlaceholder` card, reflecting what Sonakshi logged with zero interpretation. *"Here's what you told me"* — never *"here's what it means."*
2. **Charts day 14+, verbal insights later — in Journey → Patterns.** The multi-metric stacked line (pain + mood + energy on a shared axis, dose-change markers, flare shading) unlocks once the data is dense enough to be honest. Verbal insight cards (*"your pain has been 6+ on 4 of 5 days you missed your morning dose"*) come in Cycle 2, per-insight-type data-density gated.

This split resolves an apparent scoping tension: § Short-horizon says **no pattern charts inside Journey → Patterns during days 1–14** (empty-state with unlock copy), while § Whoop-style charts ships three chart types "inside Journey Patterns + Doctor Report." Both hold: days 1–14 visual reflection lives on **Home**; the **Patterns tab** stays locked until the unlock condition, then renders the charts. The taxonomy's "Patterns chart (visual 1–14d)" refers to the Home-glance surfaces F03 builds from the same viz library.

F03 is a **read-only surface** over data other features write. No new tables, no new writes, no schema change (see § Data contracts).

## Scope in / out

- **In (MVP, both cycles):**
  - C1: Convex aggregation queries (per-day series + dose markers + flare spans + unlock state + F06 summary contract) · shared viz component library (multi-metric stacked line, wellness ring, streak bar, 7/30/90 window toggle) · `/journey/patterns` route with locked/empty states (ADR-015) · Home placeholder swap (day-1 visual reflection).
  - C2: rules-based insight engine with per-insight-type minimum-sample thresholds · Home insight card (dismissable, 14-day re-fire suppression) · per-chart verbal annotations · paid-tier gate (billing-dependent, ships inert until W4 billing lands).
- **Out (backlog, unchanged):** flare↔dose correlation chart with automated callouts (backlog #19) · wearable overlays — sleep/HRV/heart-rate (backlog #13) · heatmaps (data density doesn't justify) · export chart as image · push notifications for insights (MVP is pull-only per scoping) · LLM-generated insight copy (scoping leans templated rules engine; see OQ-4) · first-insight celebration framing (scoping leans quiet appearance).

## Dependencies

- **Reads:** `checkIns` (pain/mood/energy/adherenceTaken/flare/declined/appendedTo, via `by_user_date`) · `dosageChanges` (dose markers, via `by_user_changed_at`) · `medications` (marker labels) · `intakeEvents` (adherence supplement, via `by_user_date`). All reads date-bounded in `withIndex` per W2-2 (feedback: memory-aggregation index bounds).
- **Blocks:** F06 Doctor Report (consumes `getPatternsSummary` + renders `MultiMetricChart` in the PDF appendix) · F08 Journey (aggregates the Patterns tab into the unified landing).
- **Identity:** pre-auth localStorage stub via `lib/auth/use-user-id.ts` (`useUserId()`), matching every shipped surface. Queries take a `userId` arg; W3 auth swaps the seam without touching F03 call sites.

### Data contracts — what exists vs what F03 creates

| Need | Existing query | Status for F03 |
|---|---|---|
| Per-day check-in metrics in range | `checkIns.listCheckins({ fromDate, toDate })` — index-bounded (W2-2) | Exists, but returns paged raw rows; F03 needs a merged per-day series → new `patterns.getPatternsSeries` (3.A) reads the index directly |
| Dose-change markers in range | `dosageChanges.listDosageChanges` — **unbounded** (collects full history) | 3.A reads `by_user_changed_at` with `gte/lte` on `changedAt` inside `getPatternsSeries`; does NOT reuse the unbounded query |
| Intake events in range | `intakeEvents.listIntakeEvents` — index is user-only, range filtered in JS | Same policy: 3.A reads `by_user_date` with bounds directly |
| Unlock state | — | New `patterns.getPatternsUnlock` (3.A) |
| Report-window aggregate for F06 | — | New `patterns.getPatternsSummary` (3.A) — the F06 contract |

**New Convex file:** `convex/patterns.ts` — queries only, zero mutations. **No new indexes:** `by_user_date` (checkIns, intakeEvents) and `by_user_changed_at` (dosageChanges) already cover every access path. **No schema change.** If a future reviewer disagrees that F03 is write-free, the only candidate write is C2 insight-dismissal state — held client-side pre-auth (see § Unlock & density logic), so the invariant stands.

## Unlock & data-density logic (ADR-014)

Three gates, increasingly strict:

1. **Home glance (streak bar + week rings): no gate.** Renders from the first saved check-in. Zero check-ins → soft empty card (*"Your patterns will appear here once you've been checking in."* — same copy as the Q4 placeholder it replaces).
2. **Patterns tab charts:** unlocked when `daysSinceFirstCheckin >= 14` **AND** `liveCheckinCount >= 8`. Constants live in `lib/patterns/unlock.ts` as named tunables (`UNLOCK_MIN_DAYS = 14`, `UNLOCK_MIN_CHECKINS = 8`); the day-14 floor is scoping-locked, the check-in count is a build-time density guard (OQ-5). Locked state is a full-screen ADR-015 template with progress (*"Day N of 14"*), never an inline banner. `today` is supplied by the client in device-local `YYYY-MM-DD` (same convention as `getTodayCheckin`); dates compare lexically.
3. **Verbal insights (C2): per-insight-type minimum samples**, on top of gate 2. E.g. pain↔adherence needs ≥4 missed-dose days observed; flare↔dose needs ≥2 flare events after a dose change. Exact N per type is a C2 tunable (scoping § confidence rules: suppress below N, surface sample size inline, co-occurrence language only — never causation).

**Insight dismissal (C2):** dismissed insights don't re-fire for the same pattern within 14 days. Pre-auth this persists in `localStorage` (`saha.dismissedInsights.v1`, keyed by insight fingerprint = type + metric pair + window) — keeps F03 zero-write. Trade-off: dismissals don't roam across devices; acceptable single-device MVP, migrates into a table with W3 auth if needed.

**Derived-value rules (locked for C1, tunables marked):**

- **Mood → numeric:** `heavy=1, flat=2, okay=3, bright=4, great=5`; plotted on the shared 0–10 axis as `value × 2`.
- **Daily wellness composite** (wellness ring + streak-bar colors): mean of available components, each normalized 0–1 — pain inverted `(10 − pain) / 9`, energy `(energy − 1) / 9`, mood `(moodScore − 1) / 4`, adherence `adherenceTaken ? 1 : 0`. Missing/declined components are **omitted and the mean renormalized** — never imputed. All components missing → no score (neutral day on the streak bar). Weights equal in C1 (scoping: "exact weights tuned during build", OQ-6).
- **Streak-bar color bands:** green ≥ 0.66, amber ≥ 0.33, red < 0.33, neutral = no data.
- **Gaps:** a day with no check-in is a **break in the line** — no interpolation. Honest display beats smooth display.
- **Append chains (same-day re-entry, F01 C2):** rows for one `(userId, date)` merge newest-`createdAt`-wins per metric, skipping `undefined`. Soft-deleted rows excluded everywhere.
- **Flare spans:** consecutive days with `flare ∈ {yes, ongoing}` merge into one shaded block; spans clip at the window edge (a span may enter or exit the visible window).

## Files owned (feature-wide, authoritative)

```
convex/patterns.ts                               [3.A]
convex/devSeed.ts                                [3.A — extend: dose changes + flare spans + 21d window]
lib/patterns/series-types.ts                     [pre-flight stub; 3.A owns after]
lib/patterns/unlock.ts                           [3.A]
lib/patterns/wellness.ts                         [3.A — pure scoring fns, consumed by query]
components/patterns/MultiMetricChart.tsx         [3.B]
components/patterns/WellnessRing.tsx             [3.B]
components/patterns/StreakBar.tsx                [3.B]
components/patterns/WindowToggle.tsx             [3.B]
components/patterns/PatternsLockedState.tsx      [3.C]
components/nav/JourneyTabs.tsx                   [3.C]
components/home/HomePatternsGlance.tsx           [3.C — replaces MetricVizPlaceholder]
app/journey/patterns/page.tsx                    [3.C]
app/home/page.tsx                                [3.C — import swap only]
app/journey/memory/page.tsx                      [3.C — mount JourneyTabs only]
tests/patterns/*.test.ts(x)                      [per chunk]
Cycle 2: lib/patterns/insights.ts, components/patterns/InsightCard.tsx,
         components/patterns/ChartAnnotation.tsx, paywall gate wiring    [3.D/3.E/3.F]
```

---

## Chunks

Estimated: **2 cycles × 3 chunks = 6 chunks** (matches build-plan §5).

| Chunk | Cycle | Name | One-liner | Status |
|---|---|---|---|---|
| 3.A | C1 | Aggregation queries + contracts | `convex/patterns.ts` read-only queries, series/unlock/summary, seed fixture | chunked |
| 3.B | C1 | Viz component library | Pure presentational SVG: stacked line, ring, streak bar, window toggle | chunked |
| 3.C | C1 | Route + unlock gate + Home swap | `/journey/patterns`, ADR-015 locked state, JourneyTabs, placeholder replacement | chunked |
| 3.D | C2 | Insight engine | Rules-based co-occurrence detectors + templated copy + density thresholds | sketched |
| 3.E | C2 | Insight surfaces | Home insight card (dismissable) + per-chart verbal annotations | sketched |
| 3.F | C2 | Paywall gate + F06 polish | Paid-tier gate (billing-dependent), granularity defaults, report-summary polish | sketched |

### Cycle 1 — Foundation (3 chunks, parallel)

Integration seam = `lib/patterns/series-types.ts`, committed as a pre-flight stub with the locked contract (pre-flight-stub pattern from the F04/F05 sprint). 3.B and 3.C import **types only**; 3.C injects query results into 3.B components as props. No chunk imports another chunk's implementation.

#### Chunk 3.A — Aggregation queries + contracts
- **Owner:** build-agent-A
- **Files owned:** `convex/patterns.ts`, `convex/devSeed.ts` (extend), `lib/patterns/series-types.ts` (fill stub), `lib/patterns/unlock.ts`, `lib/patterns/wellness.ts`, `tests/patterns/series.test.ts`, `tests/patterns/unlock.test.ts`, `tests/patterns/wellness.test.ts`
- **Status:** chunked
- **Stories:** US-3.A.1, US-3.A.2, US-3.A.3
- **Do-not-touch:** `components/`, `app/`, `convex/schema.ts`, any existing convex module

#### Chunk 3.B — Viz component library
- **Owner:** build-agent-B
- **Files owned:** `components/patterns/MultiMetricChart.tsx`, `components/patterns/WellnessRing.tsx`, `components/patterns/StreakBar.tsx`, `components/patterns/WindowToggle.tsx`, `tests/patterns/chart.test.tsx`, `tests/patterns/ring-streak.test.tsx`
- **Status:** chunked
- **Stories:** US-3.B.1, US-3.B.2, US-3.B.3
- **Do-not-touch:** `convex/`, `lib/patterns/` (import types only), `app/`, `components/home/`, `components/nav/`

#### Chunk 3.C — Route + unlock gate + Home swap
- **Owner:** build-agent-C
- **Files owned:** `app/journey/patterns/page.tsx`, `components/patterns/PatternsLockedState.tsx`, `components/nav/JourneyTabs.tsx`, `components/home/HomePatternsGlance.tsx`, `app/home/page.tsx` (import swap), `app/journey/memory/page.tsx` (mount JourneyTabs), delete `components/home/MetricVizPlaceholder.tsx`, `tests/patterns/route.test.tsx`, `tests/patterns/home-glance.test.tsx`
- **Status:** chunked
- **Stories:** US-3.C.1, US-3.C.2, US-3.C.3
- **Do-not-touch:** `convex/`, `components/patterns/MultiMetricChart|WellnessRing|StreakBar|WindowToggle` (consume as-is), `lib/patterns/` (import only)

### Cycle 2 — Insights + gate (3 chunks, parallel, after C1 ships)

C2 stories are sketched at functional-requirement level; full 4-lane acceptance gets written in a C2 chunking refresh once C1 review learnings land (same convention as F05's deferred Cycle 2).

- **3.D — Insight engine.** `lib/patterns/insights.ts`: pure detectors over the C1 series shape — pain↔adherence, pain↔flare proximity, mood↔pain, flare↔dose-change timing. Each returns `{ type, sampleSize, threshold, copy }` or nothing below threshold. Copy is a locked template catalog with inline sample sizes (*"(4 of 5 days)"*), co-occurrence phrasing only, always ending in a path to action. No LLM call (OQ-4).
- **3.E — Insight surfaces.** `InsightCard` on Home (dismissable; dismissal fingerprints in `saha.dismissedInsights.v1`; no re-fire ≤14d) + `ChartAnnotation` under each Patterns chart. Insight card design (thumbnail vs narrative) is a scoping TBD — resolve at C2 chunking.
- **3.F — Paywall gate + F06 polish.** Roadmap W4 gates: "Patterns paid-only." The stub said "paid tier only for full history." These conflict (whole-surface gate vs history clamp) — Rewant decision OQ-7; either way the gate ships behind a flag, inert until billing lands, so C1/C2 stay shippable pre-billing. Plus: default window granularity auto-pick from data span, and `getPatternsSummary` shape adjustments from F06's actual consumption.

---

## User Stories (Cycle 1 — full 4-lane acceptance)

### US-3.A.1 — `getPatternsSeries` query
- **As** the Patterns chart **I want** one query returning a per-day multi-metric series with markers **so that** components render without client-side joins.
- **Functional requirement:** `getPatternsSeries({ userId, fromDate, toDate })` → `{ days: DayPoint[], doseMarkers: DoseMarker[], flareSpans: FlareSpan[] }`. `DayPoint = { date, pain?, moodScore?, energy?, adherenceTaken?, wellness? }` (absent = not captured/declined). Merges append chains newest-wins per metric; excludes soft-deleted; computes `wellness` via `lib/patterns/wellness.ts`; derives `flareSpans` from consecutive `yes|ongoing` days; reads `dosageChanges` bounded on `changedAt` and joins `medications` for `medName` + `oldDose → newDose` labels.
- **Acceptance:**
  - **UX:** n/a (backend).
  - **UI:** n/a.
  - **Backend / data:** every table read pushes range bounds into `withIndex` (W2-2 pattern) — reviewer checks no unbounded `.collect()`. Read-only: file exports queries only. Handlers extracted (`getPatternsSeriesHandler`) with structural mock-ctx types, matching the `checkIns.ts` house pattern. Tests: empty range · single day · gaps (no interpolation data emitted) · append chain merge · declined + undefined metrics · soft-deleted excluded · flare span crossing window edge · 90-day window with 3 data points · dose change with deactivated medication (label still resolves — pull all meds, not just active).
  - **UX copy:** none.

### US-3.A.2 — `getPatternsUnlock` query + pure predicate
- **As** the Patterns route **I want** an authoritative unlock state **so that** the tab locks/unlocks consistently with ADR-014.
- **Functional requirement:** `getPatternsUnlock({ userId, today })` → `{ unlocked, firstCheckinDate, daysSinceFirst, liveCheckinCount, minDays, minCheckins }`. Decision logic is a pure function in `lib/patterns/unlock.ts` (client-reusable, unit-tested at the boundary). `today` is client-supplied device-local `YYYY-MM-DD`.
- **Acceptance:**
  - **UX:** n/a.
  - **UI:** n/a.
  - **Backend / data:** count excludes soft-deleted rows; append blocks count as **one** check-in day (count distinct dates, not rows). Boundary tests: day 13 + 20 check-ins → locked · day 14 + 8 → unlocked · day 30 + 7 → locked · zero check-ins → locked with `firstCheckinDate: null`. Constants exported, not inlined.
  - **UX copy:** none (copy consumed in 3.C).

### US-3.A.3 — `getPatternsSummary` (F06 contract) + seed fixture
- **As** F06 Doctor Report **I want** a windowed aggregate **so that** the PDF's patterns-summary section reads one stable contract.
- **Functional requirement:** `getPatternsSummary({ userId, fromDate, toDate })` → `{ painAvg?, painTrend?, moodMode?, energyAvg?, adherencePct?, flareDayCount, checkinCount, doseChangeCount }` (trend = first-half vs second-half delta direction: `up|down|flat`). Also: extend `convex/devSeed.ts` so the seeded user exercises F03 — widen to 21 days, add ≥2 dose changes and one 3-day flare span (keeps `providerUsed: "seed"` wipe semantics).
- **Acceptance:**
  - **UX:** n/a.
  - **UI:** n/a.
  - **Backend / data:** summary computed from the same series pipeline as US-3.A.1 (one code path — no drift between chart and PDF). Fields absent when zero observations (never fake zeros). Tests: full window · sparse window · all-declined window. Seed re-run is idempotent.
  - **UX copy:** none. **F06-fork note:** this contract ships in C1 regardless of the fork (build-plan §7.1.2 W4, Rewant's open decision 5). If **F06 goes first**, F06 renders its PDF without the patterns section behind a `hasPatternsSummary` check and slots it in when 3.A ships — nothing else in this feature moves. If **F03 goes first** (roadmap-recommended), F06 consumes this contract directly.

### US-3.B.1 — Multi-metric stacked line chart
- **As** Sonakshi **I want** pain, mood, and energy on one time axis with my dose changes and flares visible **so that** I can see what moves together.
- **Functional requirement:** `<MultiMetricChart days={...} doseMarkers={...} flareSpans={...} window={...} />` — pure presentational SVG (see OQ-1; default assumption: hand-rolled SVG, no chart dependency). Three lines on a shared 0–10 y-axis (mood ×2 per the locked mapping), vertical dose-change markers with tap-to-reveal label, shaded flare blocks, gaps break the line.
- **Acceptance:**
  - **UX:** legible at 320px width; tap a dose marker → small label popover (med name, old → new dose, date); tap outside dismisses. No pinch/zoom in C1.
  - **UI:** brand direction — warm, rounded, not dashboard-cold; design tokens (`var(--rule)`, `var(--bg-card)`, `type-label` etc.), no hardcoded hex; line colors distinguishable at WCAG AA against `--bg-card`; respects `prefers-reduced-motion` (no draw-in animation when set); rendered `<svg>` carries `role="img"` + `aria-label` summarizing the window.
  - **Backend / data:** zero data fetching — props only; types imported from `lib/patterns/series-types.ts`.
  - **UX copy:** legend labels: *"Pain"*, *"Mood"*, *"Energy"*. Marker popover: *"[med]: [old] → [new]"*. Flare block `aria-label`: *"Flare period, [start] to [end]"*.

### US-3.B.2 — Wellness ring + streak bar
- **As** Sonakshi **I want** a glanceable today-score and a 30-day color strip **so that** showing up visibly accumulates.
- **Functional requirement:** `<WellnessRing score={...} components={...} />` — filling ring for today's composite; tap expands the four component sub-scores (scoping-locked interaction). `<StreakBar days={...} onSelectDay={...} />` — last 30 days, green/amber/red/neutral per the locked bands; day tap emits the date (Home wires it to the Memory day view; wiring is 3.C's).
- **Acceptance:**
  - **UX:** ring animates fill on mount (skipped under `prefers-reduced-motion`); expanded state shows 4 rows (pain, mood, energy, meds) with per-component availability (*"—"* when missing, never a fake 0).
  - **UI:** ring ≥ 44pt tap target; streak day cells ≥ 8px wide with ≥ 2px gap at 320px; neutral days visually distinct from red (no-data ≠ bad day); tokens only.
  - **Backend / data:** props only; `wellness`/component values precomputed by 3.A — components never re-derive scores.
  - **UX copy:** ring center: score as integer 0–100. Expanded labels: *"Pain"*, *"Mood"*, *"Energy"*, *"Meds"*. Streak cell `aria-label`: *"[date]: [score | no check-in]"*.

### US-3.B.3 — Window toggle (7 / 30 / 90)
- **As** Sonakshi **I want** to widen the window **so that** I can see the short story and the long arc.
- **Functional requirement:** `<WindowToggle value={7|30|90} onChange={...} />` — segmented control per scoping § window granularity (7/30/90 days for the stacked line; the day/week/month re-bucketing of § report granularity is C2/3.F polish). Default auto-picks: smallest window covering ≥ 7 data days, else 7.
- **Acceptance:**
  - **UX:** single tap switches; selection persists for the session (state lifted to the page, not localStorage).
  - **UI:** segmented pill, active segment in accent; 44pt targets; `role="tablist"` semantics.
  - **Backend / data:** controlled component; auto-pick logic is a pure exported function (`defaultWindow(days)`) so 3.C and tests share it.
  - **UX copy:** segments: *"7d"*, *"30d"*, *"90d"*.

### US-3.C.1 — `/journey/patterns` route + JourneyTabs
- **As** Sonakshi **I want** a Patterns tab inside Journey **so that** the unlock has somewhere to land.
- **Functional requirement:** `app/journey/patterns/page.tsx` (client component under the existing thin `journey/layout.tsx`): `useUserId()` → `getPatternsUnlock` → locked state or chart view (`WindowToggle` + `MultiMetricChart` + `WellnessRing` header + `StreakBar`, fed by `getPatternsSeries` for the selected window). `JourneyTabs` = minimal two-tab strip (*Memory · Patterns*) mounted on both journey pages — an interim affordance until F08 decides the Journey landing (scoping open mechanic; OQ-3); additive, does not restructure Memory.
- **Acceptance:**
  - **UX:** tab switch is a route change (back button works); active tab visually distinct; Patterns reachable in ≤ 2 taps from anywhere (BottomNav Journey → Patterns tab). Loading = existing skeleton conventions, never a spinner-only screen.
  - **UI:** mobile-first; BottomNav persists (ADR-003 — no dead ends); tabs echo Memory's filter-tab visual rhythm.
  - **Backend / data:** streak-bar day tap routes to `/journey/memory` with the date selected (reuse Memory's existing day-selection mechanism; if it doesn't accept an initial-date param, minimal query-param support is in scope for this story).
  - **UX copy:** tab labels: *"Memory"*, *"Patterns"*. Page heading: *"Patterns"*.

### US-3.C.2 — Locked + empty states (ADR-015)
- **As** Sonakshi (day 3) **I want** the Patterns tab to tell me what's coming **so that** early emptiness reads as anticipation, not brokenness.
- **Functional requirement:** `<PatternsLockedState unlock={...} />` — full-screen dedicated template (illustration slot + title + body + progress + CTA), never an inline banner. Two variants: **locked** (has check-ins, threshold unmet — shows *"Day N of 14"* progress) and **fresh** (zero check-ins).
- **Acceptance:**
  - **UX:** CTA routes to `/check-in`; BottomNav preserved; progress updates reactively after each check-in (Convex reactive query — no reload).
  - **UI:** template structure matches the F10 edge-case vocabulary (F10 is unshipped — build to its documented template shape, slot-swap later); tokens only.
  - **Backend / data:** renders purely from `getPatternsUnlock`; no separate fetch.
  - **UX copy:** locked title: *"Patterns unlock once you've checked in for a couple of weeks."* body: *"Give it a few more days — I'll show you what I see."* (both scoping-verbatim) + progress *"Day {N} of 14"*. Fresh title: *"Your patterns start with your first check-in."* CTA: *"Start today's check-in"*.

### US-3.C.3 — Home glance swap (day-1 visual reflection)
- **As** Sonakshi (day 2) **I want** Home to already reflect my check-ins **so that** the app feels alive before day 14 (ADR-014's first half).
- **Functional requirement:** `<HomePatternsGlance />` replaces `<MetricVizPlaceholder />` on `/home`: `StreakBar` (30d) + compact week-so-far summary (7-day pain avg / mood trend arrow / adherence count / flare-day count — the scoping "week rings," rendered as the ring cluster if `WellnessRing` composes cheaply, else compact stat rows; visual call at build). Fetches `getPatternsSeries` (30d) itself — Home page just mounts it. Card links to `/journey/patterns` (locked state included — the locked screen sells the day-14 payoff). Delete `MetricVizPlaceholder.tsx`.
- **Acceptance:**
  - **UX:** zero check-ins → placeholder copy retained (*"Your patterns will appear here once you've been checking in."*); ≥1 check-in → real visuals; updates reactively after a save (scoping same-day feedback, <1s).
  - **UI:** same card frame/position as the old placeholder (`data-testid="metric-viz-placeholder"` replaced by `home-patterns-glance` — update any tests that keyed on it); no layout shift on Home; descriptive only — **no interpretation, no trend claims** in this window.
  - **Backend / data:** one query (30d series), reused for both strip and week summary; `useUserId()` seam.
  - **UX copy:** card label: *"Patterns"* (unchanged). Week summary labels descriptive only, e.g. *"Pain this week: avg 5"* — comparison lines like *"around your recent average"* are same-day-feedback scope, not C1.

---

## Open questions for Rewant

| # | Question | Draft's default if unanswered |
|---|---|---|
| OQ-1 | **Chart library:** hand-rolled SVG (house precedent: zero chart deps, bespoke warm-rounded brand, only 3 chart types) vs `recharts` (faster, but generic look + ~100KB). | Hand-rolled SVG |
| OQ-2 | **F06 fork** (Rewant's open decision 5, build-plan §7.3): F03-C1-first (recommended — PDF gets its patterns summary) vs F06-first. Chunking is fork-proof: `getPatternsSummary` ships in 3.A either way; F06-first just means the PDF's patterns section lands behind a `hasPatternsSummary` check. | F03 first |
| OQ-3 | **Journey nav:** interim `JourneyTabs` (Memory · Patterns) now, vs waiting for F08's Journey-landing decision. Tabs are additive and cheap to supersede. | Ship JourneyTabs |
| OQ-4 | **Verbal-insights copy source (C2):** locked template catalog (scoping leans this — predictability, speed, safety, i18n) vs LLM-worded. Affects 3.D only. | Template catalog |
| OQ-5 | **Unlock constants:** day-14 floor is scoping-locked; is `>= 8` live check-in days the right density guard? | 14d + 8 check-ins |
| OQ-6 | **Wellness composite weights:** equal weights in C1 (scoping: tune during build). | Equal, renormalized |
| OQ-7 | **Paywall shape (3.F):** roadmap W4 says "Patterns paid-only"; the old stub said "paid tier only for full history." Whole-surface gate vs free-7d/paid-history clamp. Ships flag-inert either way. | Decide at W4 |

## Out of scope (explicit)

Flare↔dose correlation chart (#19) · wearables (#13) · heatmaps · export-as-image · insight push notifications · cross-device dismissal sync pre-auth · day/week/month re-bucketing beyond the 7/30/90 windows (C2 3.F) · Journey landing/hub redesign (F08) · edit/annotate anything (F03 writes nothing).

## Review notes

_Track B reviewer findings land here (brief / spec+regression / edge cases), merged with Rewant's pass._

## Learnings

_Empty until ship._
