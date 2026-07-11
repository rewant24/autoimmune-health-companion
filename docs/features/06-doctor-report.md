---
number: 06
name: Doctor Report (Hybrid PDF)
slug: doctor-report
status: chunked
depends_on: [01-daily-checkin, 02-memory, 03-patterns (soft — fork-proofed, see § F03 fork-proofing), 04-medications, 05-doctor-visits]
blocks: [07-prepare-for-visit, 08-journey]
owner: rewant
scoping_ref: docs/scoping.md#doctor-report-flow
adr_refs: [ADR-010, ADR-011, ADR-013, ADR-015, ADR-031, ADR-037]
last_updated: 2026-07-12
---

# Feature 06 — Doctor Report (Hybrid PDF)

> **Note on this revision (2026-07-12).** Chunking-cycle Track A draft (session-32 routing). Reconciled to `docs/scoping.md` §§ Doctor report flow, PDF content + layout, Auto-generated report — window granularity, Doctor-visit capture, Lab-result tracking, Edit/cancel of captured events, Prepare-for-Visit, and to ADR-011/ADR-031/ADR-037. Reviewer-subagent pass (Track B) + Rewant review still to run — status flips `chunked → ready` only after the merged fix list is applied (build-plan Map 3).
>
> **Stub reconciliations (made explicit, not silent).** The 2026-04-25 stub drifted from scoping in four places; scoping wins all four: ① the stub's *"one-tap PDF summarizing the last 30 days"* is replaced by scoping's dual-trigger model — auto-refreshed dataset (24h cadence floor, ≥1-week window, Daily/Weekly/Monthly granularity) + on-demand per-visit report defaulting to *last visit → now*; ② the stub's *"two views: patient-friendly and doctor-friendly (clinical language)"* appears nowhere in scoping — scoping specs ONE report (plain language everywhere, per the no-jargon design principle) whose page-1 summary serves the doctor's 30-second glance and whose *Talking Points* section is the patient's prep deck; the dual-language view is dropped; ③ the stub's *"quota (1/month free, unlimited paid)"* is retained but ships **flag-inert** — pricing was deferred 2026-05-09 (backlog #17), same convention as F03's 3.F paywall gate; ④ front-matter `blocks` corrected from `[08-journey]` to `[07-prepare-for-visit, 08-journey]` — F07 reads the generated report (README + system-map both show F06 → F07). `depends_on` keeps 03-patterns but marks it **soft**: PR #39's F03 OQ-2 (Rewant's open decision 5) is unresolved, and this doc is required to work under either answer (see § F03 fork-proofing).

## Intent

The Doctor Report is **the communication artifact Saha produces for doctor visits** — the tangible payoff of every check-in, intake tap, dose change, and captured event. It translates Sonakshi's fluctuating, hard-to-describe condition into something a clinician can read in an OPD's 10–15 minutes: a one-page summary for the 30-second glance, a full-fidelity appendix for depth, her own talking points alongside. Two modes, both scoping-locked (ADR-011):

1. **Auto-current in-app view** — the report always exists inside Journey; she opens it any time to see her own window. Scoping's "rebuilt every 24 hours" is satisfied by construction: the report is a **view over the Memory computed at read time** (Convex reactive queries), so it is always current — never a stored artifact. This is also what keeps the post-MVP redact-per-report path migration-free (scoping § Edit-before-share).
2. **On-demand per-visit report** — anchored to a specific visit, default window *"from your last visit on {date} to today"*, exported as a hybrid PDF (page-1 summary + appendix) and shared via **phone screen or WhatsApp only** — no hosted links, no email (ADR-011).

## Scope in / out

- **In (MVP, three cycles):**
  - C1: window + aggregation queries (`convex/report.ts`, read-only) · report composition library (`lib/report/` — narrative rules engine, headline metrics, talking-points selector, patterns fork adapter) · `/journey/report` in-app view with granularity toggle, window control, events section, empty/edge states (ADR-015) · Journey tab integration (fork-aware).
  - C2: hybrid PDF document (page-1 summary + appendix, i18n language param, F07 annotation/question slots) · generation + WhatsApp share flow (OS share sheet, download fallback) · on-demand per-visit flow + standalone one-page summary view.
  - C3: chart snapshot in PDF + patterns-block completion (fork-resolution chunk) · quota gate (1/mo free) flag-inert + core-funnel PostHog events · polish (size budget, long-window aggregation, accessibility, i18n audit).
- **Out (backlog, unchanged):** hosted/shareable report URLs (#6) · email export (scoping-explicit) · clinic-portal/EHR integration (scoping-explicit) · multi-language PDFs (#1 — the language *parameter* ships, translations don't) · redact/hide entries (post-MVP full-edit, scoping § Edit-before-share) · flare↔dose correlation chart with automated callouts (#19 — the deterministic narrative below is NOT this; see § Derived-value rules) · doctor response/annotation portal · report versioning ("which entries shown to whom") · OCR/PDF lab ingestion (#3) · dual patient/doctor language views (stub drift, dropped — see revision note).

## Dependencies

- **Reads:** `checkIns` (metrics, flares, transcripts for talking points, via `by_user_date`) · `intakeEvents` (adherence + intake timeline, via `by_user_date`) · `medications` + `dosageChanges` (dose-change layer, via `by_user_changed_at`) · `doctorVisits` (window anchor + timeline, incl. cancelled — via `by_user_date`) · `bloodWork` / `bloodWorkMarkers` (lab trends — see OQ-12 + § Pre-flight prerequisites) · **F03's `getPatternsSummary` + viz components when shipped** (soft — § F03 fork-proofing).
- **Blocks:** F07 Prepare-for-Visit (annotates + adds questions to the report this feature renders — F06 C2 reserves the two PDF slots per ADR-013 so F07 is render-only) · F08 Journey (aggregates the Report tab into the unified landing).
- **Identity:** `useUserId()` seam (`lib/auth/use-user-id.ts`), matching every shipped surface. If W3 auth lands before F06 C1 branches, follow whatever convention `convex/checkIns.ts` has at branch time — the seam is the point (build-plan §7.1.3 item 3).
- **Wave position:** W4 (build-plan §7.1.2) — F06 is half of the paid-tier value prop. W4 also notes: *"F06 also needs the intake dose/name snapshot fix"* — see § Pre-flight prerequisites.

### Data contracts — what exists vs what F06 creates

| Need | Existing | Status for F06 |
|---|---|---|
| Per-day metric series + flare spans + dose markers in range | F03's `patterns.getPatternsSeries` / `getPatternsSummary` (3.A) | **Fork-gated** — consumed only via the adapter seam (§ F03 fork-proofing); F06 never reimplements the series pipeline (no-drift rule, F03 US-3.A.3) |
| Last-visit window anchor | `doctorVisits.getNextUpcomingVisit` exists; no "most recent past visit" query | New `report.getReportWindow` (6.A) — bounded `by_user_date` read, `lte` today, desc, first live completed visit |
| Visits + blood work + dose changes + intake events assembled for one window | Per-table list queries exist (some unbounded) | New `report.getReportEvents` (6.A) reads each index directly with range bounds (W2-2); does NOT reuse the unbounded house queries |
| Lab marker trend per canonical name | `bloodWorkMarkers` table + `by_user_name_date` (ADR-037) — **no read path exists yet by design** | New `report.getMarkerTrends` (6.A) — F06 becomes the first reader; see OQ-12 + prod-backfill note |
| Historical intake med name/dose | `intakeEvents` joins `medications` — **joins to today's name/dose, history rewrites after a dose change** | Pre-flight prerequisite fix (snapshot fields), OQ-6 — assessment-flagged (M), W4-flagged |
| Report quota counter | — | C3 only (6.H), flag-inert; **the only write F06 ever makes.** C1 + C2 are strictly read-only over Convex |

**New Convex file:** `convex/report.ts` — queries only in C1/C2; the C3 quota mutation is the single sanctioned exception and ships behind the billing flag. **No new indexes:** `by_user_date` (checkIns, intakeEvents, doctorVisits, bloodWork), `by_user_changed_at` (dosageChanges), `by_user_name_date` (bloodWorkMarkers) cover every access path. **No schema change inside F06 chunks** (the intake-snapshot fields are the pre-flight prerequisite, not an F06 chunk — OQ-6).

## F03 fork-proofing — both ways (CRITICAL)

PR #39 (F03 chunking) is OPEN with F03 OQ-2 unresolved: **F03-C1-first vs F06-first** (Rewant's open decision 5, build-plan §7.1.4). This doc does not resolve it. Every F06 chunk below works under either answer; this section is the single normative spec, per-chunk notes point back here.

**The seam:** `lib/report/patterns-summary.ts` (6.B-owned, committed in pre-flight). It exports exactly one of two shapes, flipped by editing this one file when F03 3.A ships:

- **F03 shipped (or ships mid-build):** re-exports the real hooks — `hasPatternsSummary = true`, `usePatternsSummary(window)` → `api.patterns.getPatternsSummary`, `usePatternsSeries(window)` → `api.patterns.getPatternsSeries`, plus F03's viz components re-exported for the chart section.
- **F03 not shipped:** `hasPatternsSummary = false` and typed stubs returning `undefined`. The types mirror F03's locked `lib/patterns/series-types.ts` contract (`PatternsSummary`, `PatternsSeries`) so the flip is import-swap only, zero call-site edits. This is the same `hasPatternsSummary` check F03's US-3.A.3 fork note names, specified from F06's side.

**What gates on the seam (the "patterns block"), and what never does:**

| Report surface | F03 shipped | F03 NOT shipped | Why this split |
|---|---|---|---|
| Multi-metric chart (in-app + PDF snapshot) | Renders F03's `MultiMetricChart` fed by `usePatternsSeries` | Section renders the **patterns-pending fallback** (locked copy below); layout reserves no dead whitespace — the events strip moves up | Chart needs the series pipeline; rebuilding it = drift hazard F03 US-3.A.3 explicitly guards against |
| Headline numbers: pain avg + trend, mood, energy, adherence %, flare-day count, check-in count | From `getPatternsSummary` (one code path with the chart — no drift) | Omitted from the strip (strip shows only the ungated numbers below); PDF page 1 renders the same reduced strip | These come from the same merged/append-chain/gap-bridged pipeline; a second implementation WILL diverge (flare gap-bridging, intake-supplement merge — F03 OQ-9/OQ-10) |
| Headline numbers: dose-change count, visit counts (completed/cancelled), blood-work test count, latest marker values + 90d direction arrows | Always rendered | Always rendered | Plain bounded index reads over event tables — no series pipeline involved; F06-owned arithmetic |
| Events timeline strip (`EventsTimelineStrip` — visits, blood tests, dose changes across the window) | Always | Always | F06-owned, presentational, event rows only |
| Narrative bullets (flare/dose timing arithmetic) | Flare spans from `getPatternsSeries` | Flare-timing bullets suppressed; dose-change + visit + lab bullets still render | Flare spans (with gap bridging) are pipeline-derived |
| Talking Points | Always | Always | Reads transcripts directly, no pipeline |
| PDF, share flow, on-demand window, annotations/questions slots | Always | Always | Independent of F03 entirely |

**Journey tab integration (second fork surface).** F03's 3.C owns `components/nav/JourneyTabs.tsx` (interim *Memory · Patterns* strip). 6.C specifies both branches: **if `JourneyTabs` exists** (F03 shipped), 6.C extends it to *Memory · Patterns · Report* — an additive third tab; **if it does not exist** (F06-first), 6.C creates it as *Memory · Report* using the identical interim pattern F03 specs (route-change tabs, Memory's filter-tab rhythm, additive, superseded by F08's landing decision — F03 OQ-3), and F03's 3.C later adds its tab into the file F06 created. Either order composes; neither restructures Memory.

**devSeed (third fork surface).** F03's 3.A widens the fixture to 21 days + dose changes. 6.A's extension (35 days + visits + blood work) is written to apply on top of EITHER the 15-day base (F06-first) or F03's 21-day extension (F03-first) — it asserts the target end-state, not a delta (see US-6.A.3).

**Fork-resolution chunk (6.G, C3).** Whichever fork ran, 6.G closes the gap: if F06 shipped C1/C2 with the seam stubbed and F03 has since landed, 6.G flips the adapter, un-gates the patterns block, and adds the PDF chart snapshot. If F03 was live all along, 6.G is only the PDF snapshot + chart layer-extension work. Nothing in C1/C2 blocks on F03 either way — the fork changes 6.G's size, not the plan.

**Locked fallback copy (patterns-pending, F06-first only):** section title *"Patterns"*, body *"This section fills in once Saha's pattern view is ready — your numbers are already being kept."* — first-person, witness-don't-prescribe, no date promise. Renders in-app AND as a single line on PDF page 1 (never a blank box in a clinical artifact).

## Report semantics & derived-value rules (locked for C1, tunables marked)

- **Freshness.** Computed on read; always current. Strictly stronger than scoping's 24h floor; no cron, no stored report rows. If a scheduled precompute is ever needed for cost, it is an optimization invisible to this contract.
- **Day convention.** Follows the F03 Track-B lock (F03 OQ-8): `today` = `todayIST()` from `lib/format/date.ts`; window bounds are IST calendar days; `changedAt`/`takenAt` epoch values map to their IST calendar day at IST-midnight edges; stored `date` strings (device-local at write, schema Q3) compare verbatim/lexically — never re-derived. If Rewant overrules F03 OQ-8, F06 inherits the same answer — one convention, single home.
- **Auto-report window.** User-adjustable; floor 7 days (scoping: "1 week is the floor"). Default window on open: smallest of 7/30/90 covering the account's history, else 90 (aligned with F03's `defaultWindow` shape).
- **On-demand window.** Default = day after the most recent **completed, live** past visit (`date <= today`, not cancelled, not soft-deleted) → today. No prior visit on file → OQ-9 (default: trailing 30 days, with the no-anchor copy variant). Window remains user-adjustable after the default is applied.
- **Granularity (Daily / Weekly / Monthly).** One dataset, three aggregations (scoping-verbatim). Default auto-picks by history: Daily < 2 weeks, Weekly 2 weeks–3 months, Monthly 3+ months; user can override; selection is session-state, not persisted. Bucket boundaries: IST calendar weeks (Monday start) and IST calendar months — OQ-10. Weekly/Monthly aggregation rules: pain/energy = mean of available days · mood = modal value · adherence = % of days effectively-taken · flare = flare-day count in bucket · intake = taken/expected count. Aggregation is presentation-layer (in `lib/report/`), applied to the same per-day data — never a second query path.
- **Cancelled events** (scoping § Edit/cancel): NEVER on the page-1 summary or in headline counts of "visits completed"; DO appear in the appendix as line items (greyed, "Cancelled" pill vocabulary) and in the honest count line (*"3 visits scheduled, 2 completed, 1 cancelled"*). Soft-deleted rows excluded everywhere. Rescheduled pairs render as one cancelled line + one live event.
- **Narrative bullets — deterministic arithmetic, not a correlation engine.** This is scoping's *"addressed both visually and in text"* requirement, satisfied without touching backlog #19's deferred detection engine. Rules (template catalog, no LLM):
  - For each flare span in window (pipeline-derived — fork-gated): *"Flare from {start}, lasted {n} days{, still ongoing}."* If a dose change occurred within the 14 days before span start (tunable constant `NARRATIVE_DOSE_LOOKBACK_DAYS = 14`): append *" — began {k} days after {med} {old} → {new}."* **Co-occurrence phrasing only, never causation** (scoping § confidence rules; product-level lock: no diagnosis).
  - For each dose change: *"{med}: {old} → {new} on {date}."*
  - For each abnormal-flagged marker in the newest blood work: *"{marker} {value} {unit} on {date} — outside the noted range."*
  - Bullet cap on page 1: 3–5 (scoping-verbatim), priority order flares > dose changes > abnormal markers > visits; overflow renders in the appendix narrative only.
  - Annotations (F07) interleave inline where their time range matches — slot only in F06 (see § F07 slots).
- **Talking Points for Your Visit — rules-selected verbatim excerpts (OQ-3 default; no LLM in a clinical artifact).** Selector picks up to `TALKING_POINTS_MAX = 8` days in-window by priority: flare days > worst-pain days > dose-change days > days with a declined metric > most recent days; renders a short verbatim transcript excerpt per selected day (first `TALKING_POINT_EXCERPT_CHARS = 140` chars of the transcript, word-boundary truncated, quoted and dated). Framed as *her* prep deck — scannable bullets, not prose (scoping-verbatim framing). Empty transcripts and pure-Stage-2 (tap-only) days are skipped. LLM-summarized upgrade is a deliberate non-goal until Rewant reopens it (OQ-3).
- **Headline metrics strip** (page 1 + in-app header — final set is scoping's own open TBD → OQ-4). Draft default: ① avg pain (dysfunction) + trend arrow ② flare-day count ③ dose-change count ④ intake adherence % ⑤ mood trajectory — ①②④⑤ fork-gated (from `getPatternsSummary`), ③ always-on; PLUS the lab strip: latest value per tracked canonical marker present in window + 90-day direction arrow ↑↓→ (scoping § Lab-result tracking, always-on). Absent data → field omitted, never a fake zero (house rule, matches F03).
- **Language.** English MVP; every renderer (in-app and PDF) takes a `language` parameter from day one; strings through the i18n layer; PDF font pipeline must be able to embed non-Latin scripts later (scoping § PDF language). "Support system", never "caregiver"/"squad".

## Pre-flight prerequisites (before the C1 build branch, not F06 chunks)

1. **Intake dose/name snapshot fix (OQ-6).** `intakeEvents` rows carry only `medicationId`; every historical render joins to the medication's *current* name/dose, so history silently rewrites after a dose change — flagged M in the 2026-07-04 assessment; W4 names it an F06 prerequisite. Shape: add `medNameAtTime: v.optional(v.string())` + `doseAtTime: v.optional(v.string())` to `intakeEvents`, written by `logIntake` at capture time; report render prefers the snapshot and falls back to the join for pre-fix rows (marked ° in the appendix: *"°dose shown as currently recorded"*). Default ownership: a separate small F04-patch PR merged before F06 C1 branches — keeps F06's read-only invariant clean and the fix independently shippable. Prod note: schema change → `ship-prod.sh` applies (Saha shipping rule).
2. **`bloodWorkMarkers` prod backfill (OQ-12 rider).** ADR-037's dual-write is live in code but the prod backfill (`npx convex run migrations:backfillBloodWorkMarkers --prod`) is still on Rewant's pending list (session 30 ④). F06 is the **first reader** of the flattened table; the C1 ship gate must verify the backfill has run in the target environment, else pre-dual-write rows silently vanish from lab trends.
3. **Contract stub.** `lib/report/report-types.ts` committed pre-flight (pre-flight-stub pattern — shape locked in this MD): `ReportWindow`, `ReportEvents`, `MarkerTrend`, `HeadlineMetrics`, `NarrativeBullet`, `TalkingPoint`, `Granularity = "daily" | "weekly" | "monthly"`. Plus `lib/report/patterns-summary.ts` in its stubbed-or-live state per the fork (§ F03 fork-proofing).

## Files owned (feature-wide, authoritative)

```
convex/report.ts                                  [6.A]
convex/devSeed.ts                                 [6.A — extend: 35d window + visits + blood work]
lib/report/report-types.ts                        [pre-flight stub; 6.B owns after]
lib/report/patterns-summary.ts                    [6.B — the F03 fork adapter seam]
lib/report/window.ts                              [6.B — granularity defaults + IST bucket math]
lib/report/narrative.ts                           [6.B — bullet rules engine + template catalog]
lib/report/talking-points.ts                      [6.B — selector + excerpting]
lib/report/headline-metrics.ts                    [6.B — always-on metric assembly + arrows]
app/journey/report/page.tsx                       [6.C]
components/report/ReportView.tsx                  [6.C]
components/report/ReportHeader.tsx                [6.C — name, condition, window line, timestamp]
components/report/HeadlineStrip.tsx               [6.C]
components/report/EventsTimelineStrip.tsx         [6.C — visits/bloods/doses; fork-independent]
components/report/NarrativeBullets.tsx            [6.C]
components/report/TalkingPoints.tsx               [6.C]
components/report/GranularityToggle.tsx           [6.C]
components/report/ReportEmptyState.tsx            [6.C — ADR-015 template]
components/nav/JourneyTabs.tsx                    [6.C — extend if exists / create if not; § fork]
tests/report/*.test.ts(x)                         [per chunk]
Cycle 2: lib/pdf/report-document.tsx (page-1 + appendix renderers), lib/pdf/fonts.ts,
         components/report/SharePanel.tsx, components/report/VisitPicker.tsx,
         app/journey/report/summary/page.tsx (standalone one-pager)        [6.D/6.E/6.F]
Cycle 3: quota gate wiring + PostHog events, PDF chart snapshot, MultiMetricChart
         marker-layer extension (touches F03-owned file post-ship — allowed
         per chunking convention), polish                                  [6.G/6.H/6.I]
```

---

## Chunks

Estimated: **3 cycles × 3 chunks = 9 chunks** (matches build-plan §6 — largest feature).

| Chunk | Cycle | Name | One-liner | Status |
|---|---|---|---|---|
| 6.A | C1 | Window + aggregation queries | `convex/report.ts` read-only: window anchor, events assembly, marker trends; seed fixture | scoped |
| 6.B | C1 | Report composition library | Pure functions: fork adapter, bucket math, narrative rules, talking points, headline metrics | scoped |
| 6.C | C1 | In-app report view | `/journey/report`, granularity/window controls, sections, ADR-015 states, Journey tab fork | scoped |
| 6.D | C2 | PDF document | Hybrid page-1 + appendix renderers, fonts, language param, F07 slots | scoped |
| 6.E | C2 | Generate + share flow | Export CTA, progress, Web Share/WhatsApp, download fallback, size guard | scoped |
| 6.F | C2 | On-demand visit flow + standalone summary | Visit anchor picker, last-visit default window, cover fields, in-app one-pager | scoped |
| 6.G | C3 | Fork resolution + PDF chart | Flip patterns seam if F03 landed post-C1; chart snapshot into PDF; chart marker layers | scoped |
| 6.H | C3 | Quota + funnel events | 1/mo free gate flag-inert (billing-dependent), PostHog report events | scoped |
| 6.I | C3 | Polish + hardening | Long-window aggregation, size budget, a11y pass, i18n audit, F07 slot contract test | scoped |

Chunk statuses use the README vocabulary (`scoped → ready → …`); C1 chunks flip to `ready` once Rewant's OQ answers land; 6.D–6.I are `scoped` with stories sketched — full 4-lane acceptance comes at the C2/C3 chunking refreshes (same convention as F03 C2 / F05 C2).

### Cycle 1 — Report data + in-app view (3 chunks, parallel)

Integration seam = `lib/report/report-types.ts` + `lib/report/patterns-summary.ts`, committed pre-flight. 6.A and 6.C import types only; 6.C injects query results into presentational components as props; 6.B is pure functions with zero React and zero Convex. No chunk imports another chunk's implementation.

#### Chunk 6.A — Window + aggregation queries
- **Owner:** build-agent-A
- **Files owned:** `convex/report.ts`, `convex/devSeed.ts` (extend), `tests/report/window-query.test.ts`, `tests/report/events-query.test.ts`, `tests/report/marker-trends.test.ts`
- **Status:** scoped
- **Stories:** US-6.A.1, US-6.A.2, US-6.A.3
- **Do-not-touch:** `components/`, `app/`, `lib/report/` (types import only), `convex/schema.ts`, any other existing convex module (incl. `convex/patterns.ts` whether or not it exists)
- **Fork note:** zero F03 coupling — this chunk never reads `convex/patterns.ts`. Identical under both forks.

#### Chunk 6.B — Report composition library
- **Owner:** build-agent-B
- **Files owned:** `lib/report/report-types.ts` (fill stub), `lib/report/patterns-summary.ts`, `lib/report/window.ts`, `lib/report/narrative.ts`, `lib/report/talking-points.ts`, `lib/report/headline-metrics.ts`, `tests/report/window.test.ts`, `tests/report/narrative.test.ts`, `tests/report/talking-points.test.ts`, `tests/report/headline-metrics.test.ts`
- **Status:** scoped
- **Stories:** US-6.B.1, US-6.B.2, US-6.B.3
- **Do-not-touch:** `convex/`, `components/`, `app/`, `lib/patterns/` (if present: import types only, never implementation)
- **Fork note:** owns the seam. Under F03-first the adapter re-exports live hooks; under F06-first it exports the typed stub. Everything else in the chunk is fork-independent pure logic.

#### Chunk 6.C — In-app report view
- **Owner:** build-agent-C
- **Files owned:** `app/journey/report/page.tsx`, `components/report/ReportView.tsx`, `ReportHeader.tsx`, `HeadlineStrip.tsx`, `EventsTimelineStrip.tsx`, `NarrativeBullets.tsx`, `TalkingPoints.tsx`, `GranularityToggle.tsx`, `ReportEmptyState.tsx`, `components/nav/JourneyTabs.tsx` (extend-or-create per § fork), `tests/report/route.test.tsx`, `tests/report/view.test.tsx`, `tests/report/tabs.test.tsx`
- **Status:** scoped
- **Stories:** US-6.C.1, US-6.C.2, US-6.C.3
- **Do-not-touch:** `convex/`, `lib/report/` (import only), `components/patterns/` (consume via the adapter re-export only, never direct), `components/memory/` internals beyond the JourneyTabs mount
- **Fork note:** chart section renders `MultiMetricChart` via the adapter when `hasPatternsSummary`, else the locked patterns-pending fallback. JourneyTabs branch per § F03 fork-proofing. Both branches carry tests; the inactive branch's test is skipped-with-reason at build time, activated by 6.G.

### Cycle 2 — PDF + share (3 chunks, parallel, after C1 ships)

Sketched at functional-requirement level; full 4-lane acceptance at the C2 chunking refresh once C1 review learnings land.

- **6.D — PDF document.** `lib/pdf/report-document.tsx`: hybrid layout per scoping § PDF content + layout — page 1 (header: name, condition, window line, generation timestamp, Saha branding, doctor name/specialty when the anchored visit has one; headline strip; small static chart OR the patterns-pending line; 3–5 narrative bullets with annotations interleaved) + appendix (full events record incl. cancelled line items, per-marker lab timelines aligned to dose/flare context, full narrative, Talking Points as a scannable bullet list). **F07 slots reserved (ADR-013):** annotations render inline with affected time ranges, visually distinct (italic + prefix *"{name} notes:"*); *"Questions from {name}"* renders as a numbered-list section at the end of page 1; both slots take empty arrays until F07 ships — empty slot = section absent, never an empty heading. `language` param threaded; fonts embedded, self-contained file (WhatsApp constraint). Library per OQ-1 (default `@react-pdf/renderer`, client-side — health data never leaves the device to make a PDF, coherent with the no-hosted-artifact posture).
- **6.E — Generate + share flow.** `SharePanel`: export CTA → generation progress → OS share sheet (`navigator.share` with files when `canShare({files})`, else download + inline hint — OQ-8); file naming per OQ-11; size guard (warn > `PDF_SIZE_BUDGET_MB = 5` — WhatsApp-friendly per scoping); post-generation nudge line (locked bank, OQ-5 on the "90 days" parameterization); failure → ADR-015-shaped save-failed template with retry, generation never half-succeeds (no partial file offered).
- **6.F — On-demand visit flow + standalone summary.** `VisitPicker` (upcoming or recent visits from F05, provider names shown); picking a visit applies the last-visit→now default window + puts the doctor's name/specialty on the cover; zero-prior-visit branch per OQ-9. Standalone one-page summary as an in-app route (`/journey/report/summary`) mirroring PDF page 1 — scoping-explicit (*"skim it before a visit without opening the full report"*).

### Cycle 3 — Fork resolution, gates, polish (3 chunks, after C2 ships)

- **6.G — Fork resolution + PDF chart.** (a) If C1/C2 shipped with the seam stubbed and F03 has since landed: flip `lib/report/patterns-summary.ts` to live, activate the gated tests, delete the fallback branch renders — contractually a one-file flip + test activation, anything more means the seam leaked and is a review blocker. (b) Chart snapshot into the PDF: re-render the same series through PDF-native SVG primitives (no rasterization) at page-1 compressed size + appendix full size. (c) Extend `MultiMetricChart` with visit + blood-test marker layers as optional props (scoping wants all layers on the report chart; touching the shipped F03 file is allowed per the chunking convention; coordinate via F03's Learnings section).
- **6.H — Quota + funnel.** Report quota per backlog #17 draft (free = 1/month, Companion = unlimited): counter mutation in `convex/report.ts` keyed `(userId, month)`, incremented on **PDF export of an on-demand report** only (OQ-7 default — auto in-app view is always free, page-1 standalone view is always free); gate ships **flag-inert, testably** (flag absent/off → zero behavior diff, asserted by test — F03 3.F convention verbatim). PostHog core-funnel events (W4): `report_viewed`, `report_generated`, `report_shared`, `report_quota_hit` (inert until flag).
- **6.I — Polish + hardening.** Monthly aggregation over 6–12-month windows (perf + bucket-boundary correctness) · PDF size budget enforcement with real fixture data · accessibility pass on the report view (headings order, chart alt summaries, 44pt targets) · i18n string audit (no literals) · F07 slot contract test (render with fixture annotations/questions to prove the slots work before F07 builds against them) · cancelled/rescheduled rendering across in-app + PDF parity check.

---

## User Stories (Cycle 1 — full 4-lane acceptance)

### US-6.A.1 — `getReportWindow` query
- **As** the report view **I want** an authoritative window anchor **so that** auto and on-demand windows compute one way everywhere.
- **Functional requirement:** `getReportWindow({ userId, today })` → `{ lastVisit: { id, date, doctorName, specialty? } | null, upcomingVisits: VisitRef[], defaultOnDemandFrom: string | null, historyDays: number, firstCheckinDate: string | null }`. `lastVisit` = most recent live, non-cancelled visit with `date <= today` (bounded `by_user_date` read, desc, first). `defaultOnDemandFrom` = day after `lastVisit.date` (IST calendar arithmetic), null when no anchor. `today` is client-supplied `todayIST()` (§ Report semantics — day convention). `historyDays`/`firstCheckinDate` power the granularity auto-pick; the first-check-in read follows F03's documented W2-2 exemption pattern (annotated, `.order("asc")`, short-circuited).
- **Acceptance:**
  - **UX / UI:** n/a (backend).
  - **Backend / data:** every read pushes bounds into `withIndex` (W2-2) except the one annotated exemption; excludes soft-deleted; cancelled visits never anchor. Handlers extracted (`getReportWindowHandler`) with structural mock-ctx types (house pattern, `convex/checkIns.ts`). Tests: no visits → null anchor + null default · only upcoming visits → null anchor · only cancelled past visits → null anchor · anchor on `today` itself (visit today → from = tomorrow > today → empty-window guard flagged in payload) · soft-deleted latest visit skipped for the prior one · rescheduled pair anchors on the live half.
  - **UX copy:** none.

### US-6.A.2 — `getReportEvents` + `getMarkerTrends` queries
- **As** the report **I want** every event type in the window in one shape **so that** the view and the PDF assemble without client-side joins.
- **Functional requirement:** `getReportEvents({ userId, fromDate, toDate })` → `{ visits: ReportVisit[] (incl. status: completed|cancelled, from live rows + cancelled rows), doseChanges: ReportDoseChange[] (joined med name incl. deactivated meds — pull all, not just active), intakeEvents: ReportIntake[] (snapshot fields preferred, join fallback flagged `snapshotMissing: true`), bloodWork: ReportBloodWork[] }`. `getMarkerTrends({ userId, fromDate, toDate })` → `{ trends: { name (canonical), points: { date, value, unit, abnormal? }[], direction90d: "up"|"down"|"flat" | null }[] }` reading `bloodWorkMarkers.by_user_name_date` per canonical name present in window; `direction90d` computed over a trailing-90d read regardless of window (scoping-verbatim arrow), null when < 2 points.
- **Acceptance:**
  - **UX / UI:** n/a.
  - **Backend / data:** all range reads index-bounded (`by_user_date`, `by_user_changed_at` at IST-midnight epoch edges, `by_user_name_date`); no reuse of the unbounded house list queries; queries only, zero mutations. `dosageChanges` window mapping: a 23:00-IST change lands on that IST day (F03 R2-2 rule verbatim). Tests: empty window · window spanning zero events of one type (empty arrays, never absent keys) · cancelled + completed visit same window · dose change on deactivated med (label resolves) · intake rows pre/post snapshot fix (fallback flag set) · marker trend across canonical-name variants ("crp" + "CRP" → one trend, per ADR-037 canonicalization) · direction90d with 1 point → null · trend for a marker whose parent bloodWork is soft-deleted → excluded.
  - **UX copy:** none.

### US-6.A.3 — Seed fixture for a report-worthy window
- **As** the F06 ship gate **I want** the seeded user to exercise every report section **so that** preview smoke is honest.
- **Functional requirement:** extend `convex/devSeed.ts` to the **target end-state** (fork-independent — asserts state, not delta): ≥ 35 days of check-ins (keeping F03's flare spans + dose changes if present; creating equivalent ones if not), ≥ 2 doctor visits (one completed ~25 days ago — the window anchor; one upcoming), 1 cancelled visit, ≥ 2 blood-work events with CRP + ESR values forming a visible trend, intake events on ≥ 20 days. Wipe semantics extend the F03 R2-1 pattern: `checkIns` by `providerUsed: "seed"`; medications/dosage changes by the `[seed] ` name prefix; **visits by `[seed] ` doctorName prefix; bloodWork by a fixed reserved `clientRequestId` set (`seed-bloodwork-1..n`, exact-lookup via `by_user_client_request`)** — no schema change, idempotent re-run (marker projection rows follow the parent via the ADR-037 dual-write/edit path).
- **Acceptance:**
  - **UX / UI:** n/a.
  - **Backend / data:** re-run idempotent (counts stable); wipe removes every seeded row incl. `bloodWorkMarkers` projections; seeded window renders every C1 section non-empty in preview. Tests: seed-then-wipe leaves zero `[seed]`/reserved-id rows · double-seed no duplicates.
  - **UX copy:** none.

### US-6.B.1 — Window + bucket math (`lib/report/window.ts`)
- **As** the report view **I want** pure window/granularity functions **so that** in-app, summary, and PDF agree to the day.
- **Functional requirement:** exports `defaultGranularity(historyDays)` (daily < 14, weekly 14–90, monthly > 90 — the scoping bands expressed in days; constants exported) · `bucketize(days, granularity)` → IST calendar buckets (weeks Monday-start, months calendar — OQ-10) with per-bucket aggregates per § Report semantics · `windowLabel(from, to, anchor)` → the locked window-line strings · `clampWindow(from, to, floorDays = 7)`.
- **Acceptance:**
  - **UX / UI:** n/a (pure).
  - **Backend / data:** pure, no Date-now reads (caller passes `today`); bucket edges tested at month boundary, year boundary, single-day window, window shorter than one bucket (one partial bucket, labeled), 365-day monthly window (12–13 buckets). Aggregation: mean/mode/percent rules per § Report semantics; empty bucket → no fake zeros (bucket present, values absent).
  - **UX copy:** window line (locked, scoping-verbatim shape): with anchor *"From your last visit on {d MMM yyyy} to today, {d MMM yyyy}"*; without anchor *"The last {N} days"*. Granularity labels: *"Daily"*, *"Weekly"*, *"Monthly"*.

### US-6.B.2 — Narrative rules engine + talking-points selector
- **As** Sonakshi **I want** the report to say in words what the window showed **so that** her doctor reads the story, not just the plot.
- **Functional requirement:** `buildNarrative({ events, flareSpans | null, markerTrends })` → ordered `NarrativeBullet[]` per the § Report semantics template catalog (flare bullets only when `flareSpans` provided — fork-gated input; dose/visit/lab bullets always). `selectTalkingPoints({ checkIns, window })` → `TalkingPoint[]` per the locked selector rules (priority order, `TALKING_POINTS_MAX = 8`, 140-char word-boundary excerpts, tap-only days skipped). All copy from an exported template catalog — no free composition, no LLM (OQ-3).
- **Acceptance:**
  - **UX / UI:** n/a (pure).
  - **Backend / data:** deterministic given fixtures; co-occurrence phrasing asserted (test greps catalog for banned causation words: "caused", "because of", "due to" — product-level no-diagnosis lock) · flare bullet with dose change 3 days prior (in lookback) vs 20 days prior (out) · ongoing flare phrasing · bullet cap + priority-order overflow · talking-points priority (flare day beats recent day), truncation at word boundary, empty-transcript skip, all-tap-only window → empty list.
  - **UX copy (locked templates):** *"Flare from {date}, lasted {n} days."* / *"… — began {k} days after {med} {old} → {new}."* / *"{med}: {old} → {new} on {date}."* / *"{marker} {value} {unit} on {date} — outside the noted range."* Section title: *"Talking Points for Your Visit"* (scoping-verbatim). Talking-point line: *"{d MMM} — "{excerpt}""*.

### US-6.B.3 — Headline metrics + the patterns adapter seam
- **As** the page-1 summary **I want** one assembly point for the strip **so that** the fork changes what's shown, not how.
- **Functional requirement:** `assembleHeadlineMetrics({ patternsSummary | undefined, events, markerTrends })` → `HeadlineMetrics` with two groups: `core` (pain avg + trend, flare days, adherence %, mood trajectory — present only when `patternsSummary` supplied) and `alwaysOn` (dose-change count, visits completed/cancelled counts, blood-test count, lab latest values + `direction90d` arrows). Plus the fork adapter itself: `lib/report/patterns-summary.ts` per § F03 fork-proofing — `hasPatternsSummary` flag + hooks or typed stubs, types mirroring F03's locked contract.
- **Acceptance:**
  - **UX / UI:** n/a (pure + adapter).
  - **Backend / data:** with `patternsSummary` → full strip; without → `core` absent and `alwaysOn` complete (asserted both ways — the fork test is a unit test here, cheap forever); absent observations omit fields (no fake zeros); arrow thresholds tested (up/down/flat/null). Adapter: stub state returns `undefined` + `hasPatternsSummary === false`; type-compatibility test pins the stub types against `lib/report/report-types.ts`'s mirror of the F03 contract so a drift in either direction fails compile/test, not smoke.
  - **UX copy:** metric labels (proposed locks): *"Pain (avg)"*, *"Flare days"*, *"Dose changes"*, *"Meds taken"* (% value), *"Mood"*, *"Visits"*, lab rows *"{MARKER} {value} {unit} {↑|↓|→}"*.

### US-6.C.1 — `/journey/report` route + Journey tab fork
- **As** Sonakshi **I want** the report inside Journey **so that** looking back and preparing to share live in one place.
- **Functional requirement:** `app/journey/report/page.tsx` (client component under the thin `journey/layout.tsx`): `useUserId()` → `getReportWindow` + `getReportEvents` + `getMarkerTrends` (+ adapter hooks when live) → `ReportView` composed of header / headline strip / chart-or-fallback / events strip / narrative / talking points, with `GranularityToggle` + window control. `JourneyTabs` extend-or-create per § F03 fork-proofing (route-change tabs, additive, F08 supersedes later).
- **Acceptance:**
  - **UX:** reachable ≤ 2 taps (BottomNav Journey → Report tab); tab switch = route change, back button works; loading = house skeleton conventions, never spinner-only; query failure → connection-error template + retry per the F10 edge-case vocabulary (F10 unshipped — build to its documented template shape, slot-swap later; same note as F03); the page never renders a broken/partial report — sections render independently but a failed *required* query (window/events) gates the whole view to the error template.
  - **UI:** mobile-first; BottomNav persists (ADR-003 — no dead ends); tabs echo Memory's filter-tab rhythm; design tokens only; chart section fallback per § F03 fork-proofing locked copy — no dead whitespace (events strip moves up).
  - **Backend / data:** props flow untransformed from queries through `ReportView`; no fetching inside presentational components; adapter consumed only via `lib/report/patterns-summary.ts` (grep-guarded: no direct `api.patterns` / `components/patterns` imports outside the adapter).
  - **UX copy:** tab label: *"Report"*. Page heading: *"Doctor Report"*. Window line per US-6.B.1 locks. Granularity labels per US-6.B.1.

### US-6.C.2 — Empty + edge states (ADR-015)
- **As** Sonakshi (day 2) **I want** an empty report to read as anticipation **so that** the paid-tier surface never looks broken.
- **Functional requirement:** `<ReportEmptyState variant={...} />` — full-screen dedicated template (illustration slot + title + body + CTA), never inline banners. Variants: **fresh** (zero check-ins ever) and **empty-window** (data exists, selected window has none — offers widening). Renders when `getReportEvents` returns all-empty AND (no `patternsSummary` or zero check-ins in window).
- **Acceptance:**
  - **UX:** fresh CTA routes to `/check-in`; empty-window CTA widens to the smallest window with data (from `firstCheckinDate`); BottomNav preserved; updates reactively after a check-in save (no reload).
  - **UI:** template structure matches the F10 vocabulary (unshipped — documented template shape, slot-swap later); tokens only.
  - **Backend / data:** renders purely from already-fetched query results; no separate fetch.
  - **UX copy (proposed locks — flag for Rewant wordsmith, first-person Saha, witness-don't-prescribe):** fresh title: *"Your report builds itself."* body: *"Check in each day — I'll turn it into a picture your doctor can read at a glance."* CTA: *"Start today's check-in"*. Empty-window title: *"Nothing in this window yet."* body: *"Try a wider window — the record's here."* CTA: *"Show {N} days"*.
- **Fork note:** identical under both forks (keyed on events + check-ins, not on the patterns block).

### US-6.C.3 — Events timeline strip + granularity behavior
- **As** Sonakshi's doctor **I want** the window's clinical events visible at a glance **so that** the conversation starts from the record.
- **Functional requirement:** `<EventsTimelineStrip visits doseChanges bloodWork window />` — F06-owned horizontal strip: visit markers (completed solid, cancelled greyed + struck date + *"Cancelled"* pill — scoping § Edit/cancel vocabulary), blood-test markers, dose-change ticks; taps open a small detail popover (no navigation in C1). `GranularityToggle` re-buckets narrative + headline aggregates via `bucketize`; chart (when live) keeps its own 7/30/90 window control (F03-owned) — the two controls are one control when 6.G unifies them (C3).
- **Acceptance:**
  - **UX:** legible at 320px; ≥ 44pt tap targets with slop (joint-pain cohort — F03 R3-6 rule inherited); same-day multiple events cluster with a count badge (F03 R3-7 pattern); popover dismisses on outside tap; toggle single-tap, session-persisted.
  - **UI:** tokens only; `role="img"` + aria-label summarizing event counts; `prefers-reduced-motion` respected; cancelled visually distinct from completed at WCAG AA.
  - **Backend / data:** pure props; strip renders identically under both forks (fork-independence asserted by rendering with `hasPatternsSummary` false in tests).
  - **UX copy:** pills: *"APPOINTMENT"*, *"BLOOD WORK"* (F02/F05 pill vocabulary), *"Cancelled"*. Popover: visit → *"{doctorName}{, specialty} — {date}"*; blood work → *"{n} markers — {date}"*; dose → *"{med}: {old} → {new}"*. Honest-count line under the strip: *"{n} visits scheduled, {m} completed, {k} cancelled"* (omitted when k = 0).

---

## Open questions for Rewant

| # | Question | Draft's default if unanswered |
|---|---|---|
| OQ-1 | **PDF library + render side:** `@react-pdf/renderer` client-side (React model, SVG support, health data stays on-device — coherent with no-hosted-links) vs `pdf-lib` (smaller, lower-level) vs server-render-and-print (adds a transient PHI artifact on the server — disfavored). Tech-stack ledger lists this TBD. | `@react-pdf/renderer`, client-side |
| OQ-2 | **F06↔F03 fork** — this is F03's OQ-2 (Rewant's open decision 5), NOT re-decided here. Recorded so both docs point at one decision: F03-C1-first (roadmap-recommended; PDF gets its patterns block on day one) vs F06-first (patterns block lands via 6.G later). Chunking is fork-proof both ways per § F03 fork-proofing — either answer changes 6.G's size, nothing else. | Whatever F03 OQ-2 resolves to (its default: F03 first) |
| OQ-3 | **Talking-points source:** rules-selected verbatim transcript excerpts (predictable, zero hallucination in a clinical artifact, zero marginal cost) vs an LLM summarization pass at generation time (reads better; needs cost guard + hallucination posture). Scoping's rules-engine locks cover opener/closer/nudges/insights, not this — so it's a real question. | Verbatim excerpts, rules-selected; LLM stays out of MVP |
| OQ-4 | **Headline metrics — the 4–5 numbers** (scoping's own "PDF still-TBD"). Draft: pain avg + trend · flare days · dose changes · adherence % · mood trajectory, plus the lab strip (latest per marker + 90d arrow). | Draft set as listed |
| OQ-5 | **Report-ready nudge copy:** the locked bank line is *"Your report is ready — 90 days, in one place."* but windows vary (a last-visit window can be 3 weeks). Parameterize to *"{N} days, in one place."*? Amends locked copy → Rewant's call, not the draft's. | Parameterize {N} |
| OQ-6 | **Intake snapshot fix ownership:** separate F04-patch PR merged before F06 C1 branches (keeps F06 read-only; independently shippable; prod schema step via `ship-prod.sh`) vs folding into 6.A (fewer PRs, but breaks F06's read-only invariant and couples the fix to the feature train). | Separate F04-patch PR first |
| OQ-7 | **Quota semantics (6.H):** what consumes the 1/month free unit — PDF export of an on-demand report only (draft), or any PDF export incl. the auto view, or on-demand *generation* even without export? In-app viewing is free in all drafts. Ships flag-inert regardless (billing is W4). | On-demand PDF export only |
| OQ-8 | **WhatsApp share mechanics:** `navigator.share({files})` works on Android/iOS mobile browsers (the target context) but not most desktops. Draft: share-sheet when `canShare({files})`, else download + hint copy. Any need for a WhatsApp-deep-link fallback (`wa.me` can't attach files — likely no)? | Share sheet + download fallback; no deep link |
| OQ-9 | **On-demand with zero prior visits:** scoping is silent on the anchor-less default. Trailing 30 days (draft), full history, or force the user to pick? Copy uses the no-anchor window line. | Trailing 30 days |
| OQ-10 | **Bucket boundaries:** IST calendar weeks starting Monday + IST calendar months (draft), vs rolling 7/30-day buckets anchored to the window end. Calendar buckets match how doctors talk ("this week vs last week"); rolling buckets avoid partial first buckets. | IST calendar, Monday-start |
| OQ-11 | **PDF branding + filename** (scoping "PDF still-TBD"): muted footer branding (draft) vs prominent header; filename `saha-report-{from}-{to}.pdf`. | Muted footer; that filename |
| OQ-12 | **Lab-trend read source:** `bloodWorkMarkers` flattened table (ADR-037's intended trend path; canonical names prevent fragmention; **requires the prod backfill Rewant hasn't run yet** — session 30 pending ④) vs embedded `markers[]` scan (no backfill dependency, but re-implements canonicalization and scans parents). F06 would be the flattened table's first reader. | `bloodWorkMarkers`; ship gate verifies backfill ran |

## Out of scope (explicit)

Hosted report URLs (#6) · email export · clinic/EHR portals · redact-per-report (post-MVP full edit — but the data model stays redact-ready: report remains a computed view, never a stored artifact) · flare↔dose correlation *engine* + chart callouts (#19 — the deterministic narrative arithmetic here is bounded template arithmetic, not detection) · LLM anywhere in the artifact (OQ-3 default) · report version history / "what did I show whom" · push notifications (*"report refreshed"* nudges — MVP is pull-only) · offline cached report view (scoping open mechanic → rides F10/backlog #14, not F06) · multi-condition report filter (#18) · doctor-facing language mode (stub drift, dropped) · Prepare-for-Visit capture flows (F07 — F06 only reserves the render slots per ADR-013).

**Adjacent surfaces F06 does NOT own:** the Patterns tab and its unlock gate (F03) · the Journey landing/hub redesign (F08 — JourneyTabs stays the interim affordance) · visit/blood-work capture UI (F05, shipped) · annotations + questions capture (F07). The upcoming-visit reminder nudge ("visit tomorrow — generate your report?") is a scoping still-TBD that belongs to F07's proactive-surface question, not F06.

## Review notes

_Track B (3 reviewer lenses: brief fidelity / spec + regression / edge cases) + Rewant's pass pending — status flips `chunked → ready` only after the merged fix list is applied. Reviewers: the fork spec (§ F03 fork-proofing) and the stub reconciliations (revision note ①–④) are the load-bearing sections; OQ-5 and OQ-6 record calls that amend locked copy / touch another feature's files and MUST reach Rewant._

## Learnings

_Empty until ship._
