# Feature 06 Cycle 1 (Doctor Report — Data + In-app View) Build Plan

> **Branch:** `feat/f06-cycle-1` off `main` (branch at dispatch time; do NOT base on another feature branch — PR scope = branch base)
> **Drafted:** 2026-07-12 · **Owner:** orchestrator (Claude Code main) · **Status:** DRAFT — Track A only; Track B review pass + Rewant's OQ answers (OQ-1…OQ-12, see feature MD) pending
> **Methodology:** Project Process Playbook — parallel build + parallel review + second-pass.

## Resume guide

Every phase boundary gets an annotated git tag. To restart from any phase:

```bash
cd "/Volumes/Coding Projects + Docker/autoimmune-health-companion"
git checkout feat/f06-cycle-1
git reset --hard <tag>     # or: git checkout <tag> for read-only inspection
```

| Tag | What's in the tree at this tag |
|---|---|
| `f06-c1/plan-saved` | This plan + feature MD at `ready`. Nothing built. |
| `f06-c1/pre-flight-done` | `lib/report/report-types.ts` + `lib/report/patterns-summary.ts` (stub-or-live per fork) committed; prerequisites verified; baseline green. |
| `f06-c1/build-integrated` | 6.A/6.B/6.C slices merged; lint + tsc + tests + build green. |
| `f06-c1/reviewed` | Review findings collected (read-only phase). |
| `f06-c1/fixed` | Fix pass applied, all green. |
| `f06-c1/second-pass-clean` | Second reviewer clean (or follow-up fixes applied). |
| `f06-c1/shipped` | Feature MD chunk statuses flipped, changelog + system-map + build-log updated. |

A **phase entry** is appended to `docs/build-log.md` at every tag (same-session logging rule).

---

**Goal:** Ship the Doctor Report foundation — read-only Convex aggregation (`convex/report.ts`: window anchor / events assembly / marker trends), the pure report-composition library (`lib/report/`: fork adapter, IST bucket math, narrative rules engine, talking-points selector, headline metrics), and the `/journey/report` in-app view with granularity + window controls, ADR-015 empty/edge states, and the fork-aware Journey tab integration.

**Architecture:** 3 disjoint chunks, one owner each.
- 6.A owns `convex/report.ts` + the devSeed extension — data layer, zero React.
- 6.B owns `lib/report/**` — pure functions + the F03 fork adapter, zero React, zero Convex.
- 6.C owns `app/journey/report/**`, `components/report/**`, `components/nav/JourneyTabs.tsx` (extend-or-create) — orchestration + presentation.

Integration seams = `lib/report/report-types.ts` (locked shape: `ReportWindow`, `ReportEvents`, `MarkerTrend`, `HeadlineMetrics`, `NarrativeBullet`, `TalkingPoint`, `Granularity`) + `lib/report/patterns-summary.ts` (fork adapter — feature MD § F03 fork-proofing is the single normative spec). 6.A/6.C import types only. 6.C injects query results into presentational components as props.

**Tech stack:** Next.js 16 App Router · React 19 (`'use client'` for report surfaces) · TypeScript 5 strict · Convex 1.x (queries only — NO mutations, NO schema change in F06 chunks) · Tailwind 4 + design tokens · Vitest + Testing Library. No PDF work in C1 (that's 6.D/C2 — do not pull the PDF library into this cycle).

**Locked decisions — do NOT re-litigate:**
- ADR-011: hybrid report; in-app view + PDF via WhatsApp only; no hosted links (PDF itself is C2).
- Report = **computed view over the Memory, never a stored artifact** — keeps redact-per-report migration-free (scoping § Edit-before-share). C1/C2 strictly read-only over Convex; the only F06 write EVER is 6.H's flag-inert quota counter (C3).
- **Fork-proofing is contractual (feature MD § F03 fork-proofing):** the patterns block (chart, pipeline-derived headline numbers, flare narrative bullets) gates on `hasPatternsSummary` via `lib/report/patterns-summary.ts`; the events strip, always-on metrics, talking points, window/bucket logic never gate. F06 NEVER reimplements F03's series pipeline (no-drift rule) and never imports `api.patterns` / `components/patterns` outside the adapter. Do not resolve F03 OQ-2 — build for both answers.
- Day convention: `todayIST()` from `lib/format/date.ts` (F03 OQ-8 lock inherited); stored `date` strings compare verbatim; epoch fields map to IST calendar days at IST-midnight edges.
- W2-2: every range read pushes bounds into `withIndex`; one documented exemption class (first-check-in read in `getReportWindow`, annotated `// W2-2 exemption`, short-circuited).
- Cancelled events: never on page-1 surfaces or completed-counts; always in appendix/strip as greyed line items with the *"Cancelled"* pill. Soft-deleted excluded everywhere.
- Narrative = deterministic template catalog, co-occurrence phrasing only (no "caused"/"because of"/"due to" — grep-tested); talking points = rules-selected verbatim excerpts (OQ-3 default), no LLM.
- Identity: `useUserId()` seam only. If W3 auth has landed by branch time, follow `convex/checkIns.ts`'s then-current handler convention — the seam, not the mechanism, is locked.
- Copy locks: tab *"Report"* · heading *"Doctor Report"* · window line *"From your last visit on {date} to today, {date}"* / *"The last {N} days"* · granularity *"Daily / Weekly / Monthly"* · section *"Talking Points for Your Visit"* · narrative templates per US-6.B.2 · pills *"APPOINTMENT" / "BLOOD WORK" / "Cancelled"* · patterns-pending fallback *"This section fills in once Saha's pattern view is ready — your numbers are already being kept."* Language guardrail: "support-system", never "caregiver"/"squad"; first-person Saha; witness-don't-prescribe.

---

## Task 0: Pre-flight (orchestrator-only, before dispatch)

**Why:** three chunks share two contracts; prerequisites live outside F06's file set and must be verified, not assumed.

**Steps:**
- [ ] Confirm Rewant answered: OQ-2 fork state (read F03 OQ-2's resolution — determines the adapter's initial state), OQ-3 (talking-points source), OQ-4 (headline set), OQ-6 (snapshot-fix ownership), OQ-9 (no-anchor default), OQ-10 (buckets), OQ-12 (lab read source) — **stop if not**; feature-MD defaults are proposals, not decisions.
- [ ] **Prerequisite 1 — intake snapshot fix (OQ-6):** verify the F04-patch PR (`medNameAtTime`/`doseAtTime` on `intakeEvents`) is merged, or Rewant explicitly waived it for C1 (then `snapshotMissing` fallback rendering carries the load). If waived, note in build-log.
- [ ] **Prerequisite 2 — `bloodWorkMarkers` backfill:** `npx convex run migrations:backfillBloodWorkMarkers` has run in dev; prod run is Rewant's separate manual step but MUST be on the ship-gate checklist (OQ-12 rider).
- [ ] Branch `feat/f06-cycle-1` off current `main`; clean tree; `npm run lint && npm run typecheck && npm run test:run && npm run build` green baseline.
- [ ] Write `lib/report/report-types.ts` (types + doc comments only). Write `lib/report/patterns-summary.ts` in the fork-correct state: F03 shipped → live re-exports; not shipped → typed stubs + `hasPatternsSummary = false`. Add the type-mirror compatibility test stub.
- [ ] Commit: `chore(f06): pre-flight — report type contract + patterns fork adapter` · tag `f06-c1/pre-flight-done`.

---

## Task 1: Build dispatch — 3 subagents in ONE multi-tool-call message

Each prompt carries: its stories from `docs/features/06-doctor-report.md` (full 4-lane acceptance), files owned, do-not-touch list, the locked-decisions block above, the § F03 fork-proofing section verbatim, and "commit per story, Conventional Commits."

### Build-A prompt (Chunk 6.A — window + aggregation queries)

Files OWNED: `convex/report.ts`, `convex/devSeed.ts` (extend only), `tests/report/window-query.test.ts`, `tests/report/events-query.test.ts`, `tests/report/marker-trends.test.ts`

Do NOT touch: `components/**`, `app/**`, `lib/**` (types import only), `convex/schema.ts`, any other existing convex module (incl. `convex/patterns.ts` whether or not it exists).

Stories: US-6.A.1 `getReportWindow` (last live completed visit ≤ today via bounded desc read; `defaultOnDemandFrom` = anchor + 1 IST day; annotated W2-2-exempt first-check-in read, short-circuited; extracted handlers, structural mock-ctx per `convex/checkIns.ts` house pattern) · US-6.A.2 `getReportEvents` + `getMarkerTrends` (all reads index-bounded; cancelled visits included with status; deactivated-med labels resolve; intake snapshot-preferred with `snapshotMissing` join fallback; canonical-name trends off `by_user_name_date`; `direction90d` trailing-90d, null under 2 points) · US-6.A.3 devSeed **end-state** extension (35d, 2 visits + 1 cancelled, 2 blood works with CRP/ESR trend, 20d intake; wipe: checkIns by `providerUsed:"seed"`, meds/doses by `[seed] ` name prefix, visits by `[seed] ` doctorName prefix, bloodWork by reserved `seed-bloodwork-n` clientRequestIds via exact `by_user_client_request` lookups; idempotent; fork-independent — assert state, not delta).

Test approach: mock-ctx handler tests (house pattern) + fixture builders. Required cases in the feature MD acceptance (null anchors, visit-today edge, rescheduled pair, soft-deleted latest visit, canonical-name merge, soft-deleted parent excludes projections, pre/post-snapshot intake rows, seed idempotency + full wipe).

### Build-B prompt (Chunk 6.B — report composition library)

Files OWNED: `lib/report/report-types.ts` (fill from stub), `lib/report/patterns-summary.ts`, `lib/report/window.ts`, `lib/report/narrative.ts`, `lib/report/talking-points.ts`, `lib/report/headline-metrics.ts`, `tests/report/window.test.ts`, `tests/report/narrative.test.ts`, `tests/report/talking-points.test.ts`, `tests/report/headline-metrics.test.ts`

Do NOT touch: `convex/**`, `components/**`, `app/**`, `lib/patterns/**` (types import only if F03 shipped).

Stories: US-6.B.1 window + bucket math (`defaultGranularity` bands 14/90; IST Monday-start calendar buckets per OQ-10; `windowLabel` locked strings; `clampWindow` 7d floor; pure — caller supplies `today`; mean/mode/percent bucket aggregation, no fake zeros) · US-6.B.2 narrative rules engine (template catalog only; flare bullets require the fork-gated `flareSpans` input, dose/lab/visit bullets always; `NARRATIVE_DOSE_LOOKBACK_DAYS = 14` exported; banned-causation-words grep test) + talking-points selector (priority flares > worst pain > dose-change > declined > recent; `TALKING_POINTS_MAX = 8`; 140-char word-boundary excerpts; tap-only/empty transcripts skipped) · US-6.B.3 headline assembly (`core` fork-gated group + `alwaysOn` group; arrows up/down/flat/null; both-fork unit tests) + the adapter (stub types pinned against the F03 contract mirror by a compile/test guard).

Test approach: pure-function unit tests; deterministic fixtures; both fork states exercised in every consumer-facing function (pass `patternsSummary` / `flareSpans` as `undefined` and as fixture values).

### Build-C prompt (Chunk 6.C — in-app report view)

Files OWNED: `app/journey/report/page.tsx`, `components/report/{ReportView,ReportHeader,HeadlineStrip,EventsTimelineStrip,NarrativeBullets,TalkingPoints,GranularityToggle,ReportEmptyState}.tsx`, `components/nav/JourneyTabs.tsx` (extend-or-create per fork), `tests/report/route.test.tsx`, `tests/report/view.test.tsx`, `tests/report/tabs.test.tsx`

Do NOT touch: `convex/**`, `lib/report/**` (import only), `components/patterns/**` (consume ONLY via the adapter re-export), `components/memory/**` internals beyond the JourneyTabs mount.

**Interface contract:** import types from `lib/report/report-types.ts`; call `api.report.*` via `useQuery`; patterns data/components ONLY through `lib/report/patterns-summary.ts`; pass results into presentational components untransformed.

Stories: US-6.C.1 route + tab fork (compose header/strip/chart-or-fallback/events/narrative/talking-points; required-query failure → F10-shaped connection-error template + retry; JourneyTabs: extend to *Memory · Patterns · Report* if the file exists, create as *Memory · Report* if not — both branches tested, inactive branch skipped-with-reason) · US-6.C.2 ADR-015 empty states (fresh + empty-window variants; reactive after check-in save; proposed copy per feature MD flagged for Rewant) · US-6.C.3 events strip + granularity (44pt hit targets with slop, same-day clustering + count badge, cancelled greying + pill, honest-count line, popovers; toggle re-buckets narrative + aggregates via `bucketize`; session-persisted selection).

Test approach: Testing Library with mocked `useQuery`/`useUserId` and BOTH adapter states (mock the adapter module per test — `hasPatternsSummary` true/false must both render correctly); assert copy verbatim, CTA hrefs, error/empty branches, cluster badges, cancelled rendering, tab-fork branches.

---

## Task 2: Integrate slices

- [ ] `git log --name-only` cross-check: files touched vs ownership table — overlaps flagged.
- [ ] Seam check: `report-types.ts` exports vs 6.A return shapes vs 6.C props — mismatches noted for the fix list, not hot-fixed.
- [ ] Grep guards: no `.collect()` without index bounds in `convex/report.ts` except the annotated `// W2-2 exemption` · no mutation exports in `report.ts` · no `api.patterns` / `components/patterns` / `lib/patterns` imports outside `lib/report/patterns-summary.ts` · no `localStorage.getItem('saha.testUser` outside the auth seam · no causation words in the narrative catalog · no PDF-library import anywhere (C2 scope).
- [ ] `npm run lint && npm run typecheck && npm run test:run && npm run build` → green.
- [ ] Tag `f06-c1/build-integrated`.

---

## Task 3: Review dispatch — 3 reviewers in ONE multi-tool-call message

All three read the delta from `f06-c1/pre-flight-done..HEAD`.

### Review-1 (brief alignment)
- Every C1 story's 4-lane acceptance satisfied or explicitly deferred with a note.
- Copy locks verbatim (window lines, tab/heading, granularity labels, talking-points title, narrative templates, pills, patterns-pending fallback); "support-system" guardrail; first-person Saha in user-facing lines; **no causation language anywhere** (product-level no-diagnosis lock).
- Scope creep: any C2 leakage (PDF, share, visit picker, standalone summary), any C3 leakage (quota, PostHog), any write beyond devSeed, any re-implementation of F03's series pipeline (the #1 drift hazard).

### Review-2 (spec + regression)
- **Fork contract:** patterns access confined to the adapter; both fork states render; gated vs always-on split matches feature MD § F03 fork-proofing exactly; adapter types pinned against the F03 contract mirror.
- Read-only invariant: `convex/report.ts` exports queries only; no schema diff; devSeed wipe semantics per US-6.A.3 (all four marker conventions).
- W2-2: all range reads index-bounded; exactly one annotated exemption class; unbounded house queries (`listDosageChanges`, `listIntakeEvents`) NOT reused.
- Regression: `/journey/memory` unregressed by the JourneyTabs change (whichever branch ran); BottomNav active state on `/journey/report`; if F03 is live — `/journey/patterns` unregressed and `MultiMetricChart` consumed as-is (no prop changes).
- `useUserId()` seam; Next 16 idioms; `'use client'` placement; no `any` across seams; IST convention (no raw `new Date()` day derivations).

### Review-3 (edge cases)
- Windows/anchors: zero visits ever · only-upcoming visits · only-cancelled history · visit dated today (empty on-demand window guard) · rescheduled pair · anchor visit soft-deleted after view opened (reactive recompute).
- Data: zero check-ins (fresh state) · data-but-empty-window · all-metrics-declined window · window with events but no check-ins (strip + narrative render, talking points empty) · deactivated-med dose change · canonical-name variants merging into one lab trend · marker trend with 1 point (null arrow) · pre-snapshot intake rows (`snapshotMissing` rendering) · 365-day monthly window (bucket count, perf) · window shorter than one bucket · month/year boundary buckets.
- Fork: `hasPatternsSummary` false → no dead whitespace, fallback copy verbatim, always-on strip complete; true → full strip, chart present; adapter flip = zero call-site diffs (compile-level assertion).
- UI: 320px · 44pt hit targets incl. strip slop · same-day event clustering badge · cancelled-vs-completed AA distinguishability · `prefers-reduced-motion` · aria labels · popover dismissal.
- Errors: window/events query failure → error template + retry; marker-trends failure alone → lab section degrades, report still renders (non-required query).
- Reactive: check-in save while report open → narrative/strip update without reload; granularity toggle preserves scroll position.

Merge findings into one ordered fix list grouped by chunk. Tag `f06-c1/reviewed`.

---

## Task 4: Fix pass

- [ ] Triage blocker → major → minor; discard anything re-litigating locked decisions.
- [ ] Smallest-diff fixes; re-run full local gate.
- [ ] Commit: `fix(report): address F06 C1 review findings` (body lists findings) · tag `f06-c1/fixed`.

---

## Task 5: Second-pass review

One Agent call; prompt includes the locked-decisions block + first-pass fix summary; hunts the 1–2 missed items.

- [ ] Clean → tag `f06-c1/second-pass-clean`. Findings → one more fix commit max, then tag.
- **Stop condition:** blocker needing >1 further fix commit → stop, morning brief.

---

## Task 6: Ship gate

Local/CI green is **necessary, not sufficient** (ship-day rule: vitest green ≠ smoke).

- [ ] Push branch, open PR against `main`; `ci` check green.
- [ ] **Convex deploy reminder:** `convex/report.ts` is new — Vercel promote alone does NOT ship it. Prod path = `scripts/ship-prod.sh`; dev/preview = `npx convex dev` push. Same shape every rung, only data differs.
- [ ] **Backfill gate (OQ-12 rider):** confirm `migrations:backfillBloodWorkMarkers` has run in the target env BEFORE smoking lab trends — missing backfill silently drops pre-dual-write rows.
- [ ] Seed a preview user via the extended devSeed (35d fixture with visits + bloods).
- [ ] **Manual smoke on the preview URL (6 steps):** ① fresh user → Report tab shows the fresh ADR-015 template ② seeded user → header window line correct against the seeded anchor visit ③ headline strip: always-on numbers correct; patterns block matches the fork state (chart or fallback copy — never blank) ④ events strip: completed + cancelled + cluster badge render; honest-count line correct ⑤ granularity toggle re-buckets narrative (Daily→Weekly changes bullet aggregation visibly) ⑥ talking points show dated verbatim excerpts, flare day ranked first.
- [ ] Feature MD: 6.A/6.B/6.C → `shipped`; `architecture-changelog.md` entry; `system-map.md` F06 status (+ the F06→F07 edge if still missing); `build-log.md` session entry; memory MEMORY.md "Next" line.
- [ ] Commit `docs: ship F06 C1 — statuses, changelog, system-map, build-log` · tag `f06-c1/shipped`.
- [ ] **PR left open for Rewant unless explicitly told to merge.**

---

## Stop conditions (apply throughout)

- 2 fix-pass iterations still red → stop, don't ship, morning brief.
- Reviewer blocker conflicting with a locked decision → discard, note, don't wake.
- Anything requiring a `convex/schema.ts` edit, a new mutation, or a new index → stop; that breaks the F06 C1 read-only invariant and needs Rewant (the intake-snapshot fix belongs to its own pre-flight PR, never to this branch).
- Anything requiring `docs/scoping.md` edits → stop.
- Anything requiring edits inside `convex/patterns.ts` / `lib/patterns/` / `components/patterns/` → stop; F03 ownership (the 6.G chart-layer extension is C3, post-F03-ship, coordinated).
- Convex schema/functions: preview-verified; prod deploy is Rewant's separate manual step (`scripts/ship-prod.sh`).
