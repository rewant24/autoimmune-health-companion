# Post-MVP Backlog

> Everything explicitly **not** in scope for the MVP. Each item has a reason, a sketch of the post-MVP shape, and a note on whether the MVP architecture already leaves room for it. This document exists so we stop re-litigating scope during build, and so nothing we decided to defer gets lost.

**Source of truth convention:** items move between this doc and `scoping.md` when their status changes. If something moves into MVP scope mid-build, note it here with a `→ moved into MVP on YYYY-MM-DD` marker before deleting the entry.

---

## 1. Hindi + vernacular languages

- **Why out of MVP:** Single-developer scope; translation + voice STT/TTS in more languages is multi-week work.
- **Post-MVP shape:** Add Hindi first (largest Indian autoimmune-patient demographic overlap with target user). Then Tamil, Telugu, Marathi, Bengali in priority order. Each language requires: UI string translation, STT model support, TTS voice model, plus QA with native speakers.
- **Architectural hook:** All user-facing copy goes through an i18n string resource system from day one (per § Saha's voice → multilingual architecture in scoping.md). Adding a language is a drop-in, not a refactor.

## 2. Full edit on past check-ins

- **Why out of MVP:** Data-model versioning to preserve original values (vs. a simple overwrite) is post-MVP. MVP supports edit/cancel on *captured events* (appointments, blood tests, etc. — see scoping.md) but not on the *content* of a past check-in (pain value, mood, flare flag).
- **Post-MVP shape:** Let Sonakshi edit any past check-in field (correct a wrong pain value, remove a mistaken flare flag). Edits are tracked as deltas against the original; both values visible in audit history. Full edit + selective redact-per-report ships together.
- **Architectural hook:** Data model keeps Memory entries immutable-with-overwrites; the report is always a view, not a stored artifact. Redact can be layered on without migration.

## 3. Blood work results — full ingestion (PDF / image / OCR)

→ **Manual structured-entry slice moved INTO MVP on 2026-04-25.** MVP now captures CRP / ESR / WBC / Hb + free-form other markers as structured values per blood-test event, plotted on Patterns and surfaced in the Doctor Report. See § Lab-result tracking — MVP slice in `scoping.md`.

- **What's still post-MVP:** PDF / image attachment of the lab report itself, OCR of result PDFs, structured CSV / HL7 import, multi-analyte panels beyond the MVP marker set, and reference-range visualization (green-yellow-red bands).
- **Why still out of MVP:** PDF / image parsing is non-trivial; OCR accuracy on Indian-lab-format reports needs validation before we ship it as a clinical artifact.
- **Post-MVP shape:** Let Sonakshi attach a PDF / image to any captured blood-test event; OCR auto-populates the structured marker fields she's already using; reference-range bands render around her values per marker.
- **Architectural hook:** The structured marker fields land in MVP, so attachment + OCR + extra markers slot in additively without schema migration. Reference ranges can be added per-marker as a separate ranges table.

## 4. Push notifications for insights

- **Why out of MVP:** Notifications on chronic-illness data risk feeling alarming or intrusive. Pull model forces the app to earn attention, not demand it.
- **Post-MVP shape:** Opt-in daily or weekly digest notification (*"Saha has 2 things to show you"*) — never per-insight alerts. Strictly user-initiated opt-in during settings.
- **Architectural hook:** None needed for MVP. Notifications surface can be added later without schema changes.

## 5. Support-system shared view (read-only)

- **Why out of MVP:** Multi-user permissioning and a second UI surface for the support-system viewer are multi-week work.
- **Post-MVP shape:** Sonakshi invites a support-system member (spouse / parent / adult child). They see a **read-only** view of her Journey, scoped to what she grants (e.g. just flare history, or everything except Community). Strictly patient-initiated, revocable at any time.
- **Architectural hook:** Convex schema should support user ↔ user read-grants from day one (single `shares` table). Actual viewer UI is post-MVP. Language: *"support system"*, never *"caregiver"* or *"squad"*.

## 6. Hosted / shareable links for the doctor report

- **Why out of MVP:** Hosted links mean third-party access, retention policy, revocation UI, and security review — all post-MVP.
- **Post-MVP shape:** Generate a unique tokenized URL for a specific report + doctor. Expires after 30 days or on manual revoke. Doctor sees a minimal read-only web view.
- **Architectural hook:** Report is already a view on Memory (per scoping.md). Adding a public-URL render wouldn't require schema changes, just a new route.

## 7. Onboarding Screen 1 asset

- **Why blocked (not out of scope):** Waiting on a resized `Onboarding.jpg` from Rewant (original was 14MB, exceeded read limit). Re-share at ≤5MB or split into per-screen crops.
- **Post-MVP shape:** N/A — this is scoping completion, not a feature.

## 8. Advanced Community features

- **Why out of MVP:** Community is in scope as a pillar, but its full scope (moderation, anonymous posting, cross-posting, channel discovery, reactions) is under-scoped. Community is a Slack-style peer channel — not a cohort-comparison surface and not a data-sharing surface; it does **not** expose bio-data across users.
- **Post-MVP shape:** TBD — pending close of Community open questions in scoping.md.
- **Architectural hook:** Community pillar exists in nav. Message + thread data model TBD during Community scoping.

## 9. Voice in languages other than English

- **Why out of MVP:** See item #1.
- **Post-MVP shape:** Ties to the i18n rollout. STT/TTS providers that support Indian languages well are limited in 2026; evaluation required before expansion.
- **Architectural hook:** Voice layer abstracted behind a provider interface. Swapping providers or adding language-specific providers doesn't require app-level changes.

## 10. Reminders / alarms for medications

- **Why out of MVP:** Local notifications + schedule engine + miss-handling is a standalone feature. MVP scope = opportunistic tap + check-in capture only.
- **Post-MVP shape:** Per-medication reminder schedule (morning dose at 8am, evening at 8pm). Missed reminders surface on Home as "did you take X?" nudges.
- **Architectural hook:** Regimen model in Medications module already captures frequency. Adding reminder scheduling is additive.

## 11. Symptom catalog beyond the required-five

- **Why out of MVP:** Adding stiffness / sleep / food / stress as required probes bloats Stage 2 and lengthens the check-in past 60s. They're captured from free-flow voice only.
- **Post-MVP shape:** Add them as optional controls Sonakshi can opt into during Settings — *"also probe for sleep each day."* Per-user required-set customization.
- **Architectural hook:** Stage 2 controls are data-driven; adding more means adding to the required-metric list + the control palette.

## 12. Pattern-engine LLM generation

- **Why out of MVP:** LLM-generated insight copy risks hallucinated correlations and tone drift. Rules engine with templated copy is predictable, fast, i18n-friendly, and auditable.
- **Post-MVP shape:** Possibly never. If we ever do it, it would be LLM drafting + rules-engine validation, not LLM alone.
- **Architectural hook:** Insight copy is templated with slot-fills (metric name, threshold value, sample size). Swapping the template source is possible but not planned.

## 13. Wearable / device integration

- **Why out of MVP:** Whoop / Apple Health / Fitbit import requires OAuth per provider, data mapping, and privacy review. Whoop is our *visual* reference, not a data-source dependency.
- **Post-MVP shape:** Optional Apple Health / Whoop / Fitbit connection for sleep, HRV, resting heart rate. Feeds the pattern engine as additional signals.
- **Architectural hook:** Pattern engine is extensible on input signals (add new time-series → new correlation type).

## 14. Offline creation of new entries

- **Why out of MVP:** Offline write-queue + conflict resolution is non-trivial. Cached-read offline is enough for MVP.
- **Post-MVP shape:** New check-ins / intake taps / captures can be created offline and sync when connectivity returns. Last-write-wins on conflicts.
- **Architectural hook:** Convex mutations can be queued client-side; Convex's built-in optimistic mutation support helps but requires explicit wiring.

## 15. Native iOS and Android apps (wrapping the web MVP)

- **Why out of MVP:** App-store review timelines don't clear the MVP launch window. Web-PWA MVP (per ADR-017) gets Saha in front of real users on a live URL on launch day; native apps come next.
- **Post-MVP shape:** Native iOS and Android apps that reuse the Convex backend and the voice-provider abstraction — only the surface layer changes. Native mic APIs give first-class voice capture (including background / lock-screen capture for hands-free flare logging). App-store listings also open paid-tier monetization paths that web can't (Apple/Google in-app purchase, optional).
- **Architectural hook:** ADR-017 locks voice behind a provider interface. The mic bridge is a drop-in replacement; Convex queries/mutations are platform-agnostic. No backend changes needed when native ships.

## 16. Account sharing / multi-device sync beyond baseline

- **Why out of MVP:** Convex handles reactive multi-device reads out of the box. Anything beyond (session handoff, live-follow from a second device, explicit device management) is post-MVP.
- **Post-MVP shape:** Device management in Settings (revoke sessions, see active devices).
- **Architectural hook:** Convex auth + session management is the baseline; feature-level device control can be added.

---

## 17. Monetization — first-pass design (for MVP launch)

> **2026-05-09 amendment — DEFERRED until post-launch decision point.** Rewant's call: MVP launches **free for the first 50 users**, then revisit pricing based on willingness-to-pay signals + feature-usage telemetry from those 50. No pricing block on the landing page in this sprint. No Razorpay/Stripe integration. No founder-tier ₹99 skip-the-waitlist gate. Waitlist remains the only conversion CTA. The tier proposal below stands as draft v0 for the post-50-user revisit, not as an MVP-launch artifact. See `~/.claude/projects/-Users-rewantprakash-1/memory/project_saha_mvp_scope.md` § 2026-05-09 amendments.

This is the **only backlog item that needs a first pass before MVP launch**, because the Revenue rubric awards points for *actual revenue generated* (paid signups via Stripe/Razorpay, usage fees, premium upgrades). A clear pricing page on the landing site — even before a single transaction — seeds the story.

### Target track

**Revenue track** (176-point ceiling, highest of the three). Saha is a natural fit: chronic-illness patients have sustained willingness-to-pay, waitlist demand is already present, and the doctor-report artifact is a tangible outcome with obvious perceived value (a single visit improved = price justified).

### Tier structure (v0 proposal)

| Tier | Price (India) | Price (International) | What's unlocked |
|---|---|---|---|
| **Free — "Saha Friend"** | ₹0 | $0 | Daily voice check-in, Memory (last 30 days), 1 doctor report per month, intake tracking, Community access |
| **Paid — "Saha Companion"** | ₹199/month or ₹1,499/year (~37% off) | $4.99/month or $39/year | Unlimited Memory history, unlimited doctor reports, unlimited PDF regenerations, Patterns view (long-horizon insights), WhatsApp share, priority support, future: wearable integrations + support-system shared view |

**Why these numbers:**
- **₹199/month** anchors below the price of a single OPD consultation (₹500–1,500 in Tier-1 cities) — *"one visit you don't have to repeat pays for a year of Saha."*
- **₹1,499/year** is psychologically beneath ₹1,500 and close to one month's medication cost for many autoimmune regimens — legible as *"a fraction of what you already spend on the condition."*
- **$4.99/month** for international is the default SaaS consumer anchor and avoids the ₹→$ arithmetic.
- Annual discount at ~37% is aggressive enough to shift most paying users into annual (better LTV, lower churn work for us).

**Why a free tier at all:**
- The voice check-in + 30-day Memory is the *aha moment* — limiting it behind a paywall kills activation. Free users become paid users when they hit the *"I want to see my whole year"* or *"I need my 4th report this month"* moment, not at install.
- Chronic-illness apps with hard paywalls have high uninstall rates — the commitment to *daily* logging has to be earned first.

### Payment rails

- **India:** Razorpay (UPI + cards + netbanking). UPI is the default — lowest friction, highest success rate.
- **International:** Stripe (cards + Apple Pay + Google Pay).
- Both rails are one-line integrations from Next.js; neither blocks MVP scope.

### What ships on the waitlist / landing page by MVP launch

- **Pricing block** on the landing page (3 rows: Free / Companion Monthly / Companion Annual) — no live checkout needed yet, just *"Join waitlist — early birds get 3 months free of Companion."*
- **Waitlist → early-bird gate**: first 100 waitlist signups get a 3-months-free promo code for Companion when checkout opens. Drives waitlist conversion and seeds paid-trial funnel.
- **Optional: "Pay ₹99 to skip the waitlist" founder-tier** — pure willingness-to-pay signal. Even 5 takers is credible *revenue generated* evidence for the rubric.

### Why gate what we gate

- **Unlimited Memory history** (free = 30d): chronic illness = year-over-year patterns. The paywall lands at the moment she values the product most.
- **Unlimited doctor reports** (free = 1/month): most patients see a specialist every 3 months; 1/month covers the baseline. Heavy users (multi-doctor, frequent visits) self-select into paid.
- **Patterns view** (paid-only): long-horizon correlation insights take 2+ weeks of data to produce — by the time they unlock, she's committed. Natural upgrade moment.
- **Wearable integrations + support-system shared view** (future-paid): both are meaningful enough to defend a paid tier on their own when shipped.

### What is **not** gated (deliberately)

- **Daily check-in** — the core loop. Free forever.
- **Intake tracking** — table-stakes. Free forever.
- **Community** — "you are not alone" is an emotional outcome, not a premium feature. Free forever.
- **One report per month** — enough for most patients; demonstrates the value proposition without a paywall.

### Rubric impact

- **Signups (20x weight)** — free tier drives this without friction.
- **Revenue generated (15x)** — founder-tier + any early paid conversion through the promo moves this off zero.
- **Waitlist signups (4x)** — already the current primary metric; early-bird offer accelerates it.
- **Pain severity (2x)** — chronic illness is among the most acute ongoing pains; story is strong.
- **SOM bottoms-up (2x)** — India autoimmune prevalence: ~5–7% of adults, skew female, concentrated in Tier-1 cities — serviceable segment in the tens of millions.
- **Right to win / founder-market fit (2x)** — Rewant's proximity to the primary persona (Sonakshi) is a direct narrative.

### What's explicitly out of scope for the Saturday pass

- Live Razorpay/Stripe integration with working checkout. (Only if time allows after core flow.)
- Enterprise / clinic tier. (Post-MVP — different sales motion, different pricing model.)
- Insurance reimbursement pathway. (Post-MVP; region-specific; legal review required.)

---

## 18. Multi-select medical conditions

**Why out of MVP.** Many autoimmune patients live with more than one condition — RA + Sjögren's, lupus + Hashimoto's, psoriatic arthritis + IBD are common co-occurrences. Single-select risks feeling reductive for these users. But shipping multi-select for MVP means handling channel-membership fan-out in Community (which channel does a user with 3 conditions land in?), multi-condition doctor-report structuring, and a more complex condition-picker UI — none of which earns its keep against the MVP launch window.

**Post-MVP shape.** Setup B.4 becomes a multi-select type-ahead (user can add up to N conditions). Community auto-joins to *all* matched channels; default channel on first entry is the first-listed. Doctor Report adds a condition filter. Memory and Patterns gain a per-condition filter.

**Architectural hook.** Schema stores `conditions: string[]` from day one (ADR-007 data model). The MVP UI writes a single-entry array; the post-MVP UI writes a multi-entry array. Zero schema migration when it ships.

---

## 19. Flare ↔ dosage correlation chart

**Why out of MVP.** The clinical signal is meaningful — *"this flare started 4 days after the prednisone increase"* — and is exactly what the Doctor Report is for. But the chart is build-heavy: two time-series layers need alignment (dose-change markers overlaid on flare-period shaded blocks), correlation windows need detection logic, and annotation callouts need positioning math. The MVP multi-metric stacked line already renders both layers visually on a shared time axis (§ Whoop-style charts — MVP set); a reader can see the relationship even without the automated callout. The delta is an analytical-layer polish, not a missing feature.


**Post-MVP shape.** A dedicated chart mode in Journey-Patterns that takes the multi-metric stacked line and adds (a) correlation windows detected between dose-change events and flare periods, (b) labelled callouts on the chart (*"Flare started 4d after 10→15mg increase — subsided 7d later"*), and (c) a summary strip above the chart listing the top 3 detected correlations in the selected window. Ships in the Doctor Report appendix alongside the stacked line.

**Architectural hook.** Dose changes and flare events are both already first-class events in the data model (ADR-010 — events first-class). No schema changes required when this ships — it is purely a rendering + correlation-detection layer on top of existing data.

---

## 20. Auth enforcement for check-in endpoints

> **→ moved INTO MVP on 2026-05-09 (Lane B sprint).** No longer post-MVP. Auth is now the final MVP-completion item — needed to identify the "first 50 users" (per item #17 amendment). Lane B scope is broader than this entry described: not just the check-in endpoints, but every Convex mutation/query that takes `userId: v.string()` as a client-trusted arg (~30+ handlers across F01/F02/F04/F05). Plus `clientRequestId` unique-index migration (housekeeping #14), profile data location decision, and onboarding state-machine refactor. Sign-in methods locked: email magic link (all locales) + phone OTP (India only, locale-detected). Provider TBD via `docs/features/auth-scoping.md`. See `docs/sprints/2026-05-09-auth-ui-housekeeping.md` for the full sprint plan.

**Why out of MVP (Cycle 1 only).** Feature 01 Cycle 1 ships the voice check-in flow against Convex without a live identity layer. `createCheckin`, `listCheckins`, and `getCheckin` trust the `userId` arg from the client. This is a *deliberate* Cycle 1 deferral — not a missed requirement. Cycle 2 adds the auth slice (chunk 1.F in `docs/features/01-daily-checkin.md`).

**Post-Cycle-1 shape (i.e. what Cycle 2 does).** Swap the trusted arg for `ctx.auth.getUserIdentity()` — derive an app-level `userId` from the token identity inside the handler, drop the arg from the public validators, and add a reject path for unauthenticated callers (`ConvexError({ code: "auth.unauthenticated" })`). Also add an ownership check to `getCheckin` so a caller can't fetch another user's row by ID.

**Architectural hook.** Handler bodies are already extracted as plain functions that take a `MutationHandlerCtx` / `QueryHandlerCtx` — Cycle 2 only changes the wrapper (where `userId` comes from), not the handler. Tests already exercise the handlers with a mock ctx and won't need rewriting when auth lands.

---

## 21. Check-in date time-zone policy (IST vs. UTC)

**Why out of MVP (explicit note, not a deferred feature).** `checkIns.date` is a `YYYY-MM-DD` string. Cycle 1 trusts the *client* to choose the correct day boundary (midnight in the user's local time), and Sonakshi — the primary user — lives in IST. Spec'd behaviour: one check-in per *local* calendar day, where local = the device's wall clock.

**Post-MVP shape / known edge case.** Users who travel across time zones mid-day can produce a `duplicate` error if their device ticks over a day while the previous day's check-in hasn't been cleared. The fix is to persist a `timeZone: string` alongside each check-in (IANA zone) and normalise the day boundary server-side — deferred because the target user is IST-fixed.

**Architectural hook.** Add `timeZone: v.optional(v.string())` to the schema when this ships. The `by_user_date` index remains on the string date field; the tz is metadata for reconciliation.

---

## 22. Voice C1 — deferred polish (logged from review pass, 2026-04-27)

Captured during the cold-eyes review of `feat/voice-sarvam` @ `307dd0d`. All deferred from MVP; none affect the daily-habit loop or the give/get covenant.

**22.1 Streaming TTS decode.** `app/api/speak/route.ts` currently buffers the full Sarvam TTS response (`{ audio: Uint8Array, contentType }`) before returning it as a single `Response(audio)`. The browser plays via blob, not `MediaSource`. Acceptable for C1 because every utterance (opener, per-metric question, closer) is short — typical 2–6 seconds, ≈40–120KB. Becomes worth revisiting if utterances grow (multi-paragraph reflections) or first-byte latency on slow networks shows up in user feedback. Sarvam's chunked-response support and `MediaSource` on the client both required to ship.

**22.2 Upload progress indicator.** `SarvamAdapter` buffers PCM chunks across the listening window then POSTs once on `stop()`. For a 90-second freeform answer over 4G this is ≈1–2MB and the POST takes 100–500ms — invisible to the user. UX risk emerges if we relax the duration cap or users land on flaky networks. The `fetch` upload-progress API is unevenly supported; revisit if user research surfaces "did it submit?" anxiety post-launch. Out of scope until then.

**22.3 Per-user rate limits on `/api/transcribe` and `/api/speak`.** Both routes enforce per-connection caps (5MB body, 90s duration on transcribe; text length cap on speak) but no per-user-per-day budget. A malicious or buggy client could open many parallel connections. Cost-blast scenario is bounded by Sarvam's own API key throttling, but this is the authoritative defence layer. Tracks alongside the F03+ "abuse guards" item — revisit when auth (F02 pre-cycle 2.0) lands, since per-user rate limits assume an authenticated subject.

**22.4 Dev-only mitigation for the extract cost-guard cap (next sprint).** ADR-020 caps `/api/check-in/extract` at 5 calls per `(userId, date)` per the cost-blast defence. The cap is the same in dev as in prod — every smoke pass that re-runs the voice flow burns one of the five, and a single debug session can hit the wall in minutes (seen twice on `feat/voice-sarvam` smoke: 2026-04-27 and 2026-04-28, both required `npx convex run extractAttempts:resetForUserOnDate`). **Why:** smoke ergonomics — current workflow is "hit cap → drop to terminal → run reset script → reload page → resume smoke," which interrupts flow and hides genuine bugs behind 429s. **Post-MVP shape:** two options to evaluate — (a) **env-gated cap bump:** `DAILY_CAP = process.env.NODE_ENV === 'production' ? 5 : 50` in `convex/extractAttempts.ts`. Simplest change; also raises cap on Vercel preview deploys (acceptable — preview is dev-class). (b) **Dev-only reset button:** small UI affordance on `/check-in` gated on `NODE_ENV !== 'production'` that calls `resetForUserOnDate` for the current user/today. Targeted, but adds UI + a public mutation surface (would need to flip the helper back from `internalMutation`). **Recommendation when picked up:** start with (a) — one-line change, no UI risk, no surface-area change. Revisit (b) only if dev-class previews need a stricter cap. **Architectural hook:** none needed; the cap constant already lives in one place.

**22.6 Memory tab — tap-to-detail view for logged events (added 2026-05-01).** Surfaced during F04 C1 smoke. Today the Memory tab renders each event as a row showing time / title / meta — `EventRow` exposes an `onTap(eventId)` prop and `EventGroup` plumbs it through as `onEventTap`, but **no consumer wires a real handler** and no detail-view component exists. So Sonakshi sees that "a check-in was logged" but cannot tap to read the transcript she actually said, the pain/mood values she captured, or (post-Bug C fix) which medications she took at the time. **Why this matters:** "evidence" is the job-to-be-done per the Sonakshi research and the Rheumera competitive deep-dive — a flat read-only summary is not evidence-grade. **Post-MVP shape:** tappable row → bottom sheet or full-screen detail per event type. CheckInEvent shows transcript + structured metrics. IntakeEvent shows medication + dose + source ("logged from check-in" vs "tapped on home"). FlareEvent shows the originating check-in's transcript anchored to the flare claim. VisitEvent (after F05) shows visit details. Edit affordance gated on the 48h memory edit window per locked decision 2026-04-25. **Architectural hook:** `MemoryEvent` discriminator already drives the right branch; detail components slot in alongside `EventRow` / `EventGroup` without schema changes. Wire `onEventTap` from `MemoryTab` → `DayView` → `EventGroup` → `EventRow`.

**22.7 Voice extraction — ask "which medication?" for ambiguous adherence claims (added 2026-05-01).** Surfaced during F04 C1 smoke. Today the medication extractor (`lib/checkin/medication-extract.ts`) recognises three signals: blanket adherence ("I took my meds" → log everything), named negatives ("I skipped the steroid" → `skippedMedications`), and dose changes. There is **no `takenMedications` array for named positives** — saying "I took my methotrexate this morning" today logs nothing because the model has no slot to put it in. There is also **no clarification turn** for ambiguous singular phrasing ("I took my medication today" with no name). Per Rewant's mental model: voice should be the primary capture path, the AI should ask "which medication did you take?" when ambiguous, then log just that one and mark it on home + journal. **Why this matters:** the daily-habit covenant assumes voice can capture the day in one pass — falling back to manual home-tap for specifics breaks the loop. **Post-MVP shape:** (a) extend the extractor schema with `takenMedications: array of { medicationName }` matched against the regimen; populated when the user names specific meds positively. (b) add a clarification state to the voice state machine that fires when the transcript expresses adherence intent without a resolvable medication (heuristic: `simpleAdherence === null && takenMedications === [] && dosageChanges === [] && transcript matches /took|taking|had/ + /medicine|medication|pill|dose/`) — the AI asks "Which medication did you take?" and the user's next utterance feeds back into a constrained extraction with the regimen list. (c) `logIntake` for matched positives in the same summary step that handles blanket adherence today. **Acceptance:** "I took my methotrexate" → 1 intake row + 1 IntakeEvent visible in Memory + that med shows checked on home. "I took my medication" → AI asks "Which one?" → user names it → same outcome. Blanket "I took my meds" still logs all (unchanged). **Architectural hook:** state machine already has multiple turn types from voice C1; extending the prompt + schema is additive. Cap-guard already shared between the metric and medication extractors per ADR-020.

**22.5 Re-enable streaming-mode Sarvam upload (proper streaming-WAV header).** After the 2026-04-29 ship-day hot-fix forced `SarvamAdapter.resolveMode()` `'auto'` to always pick `'buffered'` (see `docs/hotfixes/voice-c1-streaming-pcm.md`), the streaming branch is dormant on every transport. Buffered mode is fine for C1 — sub-30s turns, one-shot upload at `stop()`, negligible memory cost — but it does add upload latency at the end of each turn (PCM goes out only after the user stops talking, instead of pipelining during). **Why revisit:** if turn lengths grow (B2 free-form longer reflections) or users land on slower 4G/3G, the post-stop upload window becomes user-visible. **Post-MVP shape:** make the streaming branch wrap PCM in a streaming WAV header. Concretely: write a 44-byte RIFF/WAVE preamble to `bodyWriter` BEFORE the first PCM chunk; leave the `data` chunk size as a sentinel (Sarvam REST batch ingests the whole upload before decode, so the size sentinel is fine). New tests for: (a) the header builder, (b) the two-chunk-write ordering (header before any PCM), (c) the abort path that fires before any PCM chunk lands (header alone is invalid — must abort cleanly), (d) buffered vs streaming parity (same Sarvam request body for the same turn). Once green, flip `resolveMode()` `'auto'` back to picking streaming on `https:` (or HTTP/2 — probe `performance.getEntries()[0].nextHopProtocol === 'h2'` if we want a more precise gate). **Architectural hook:** none — `SarvamAdapter` already has the streaming branch wired; this is filling in the deferred TODO at `lib/voice/sarvam-adapter.ts:312`.

---

## 23. Memory tab — real cross-table search (added 2026-05-09)

Surfaced during F05 C1 smoke. The Memory header had a search icon that was a no-op stub from F02 (chunk 2.E was deferred). Smoke tester reasonably expected it to work. Hidden in F05 C1 so the UI doesn't promise functionality it doesn't have. **Real shape:** a `<SearchBar />` that queries across `checkIns` (transcript text), `intakeEvents` (medication name lookup via join), `doctorVisits` (doctorName + specialty + notes), and `bloodWork` (marker names + notes). Server-side query on a new `convex/memory.ts:searchEvents` taking `{ userId, queryText, limit }`, debounced 200ms client-side, ranked by recency-tied-to-relevance. Results UI: same `EventRow` projection used by the day list, grouped by date. **Architectural hook:** the four `eventFromX` projections in `lib/memory/event-types.ts` already produce a uniform `MemoryEvent`. Search just needs a different fetch path (text-match, not date-range). Convex doesn't ship a built-in full-text index yet, so MVP version can do `collect()` + JS substring filter while row counts are small (same compromise as `listEventsByRangeHandler` today); revisit when row counts force a real search index. **Acceptance:** search "mehta" returns the doctor visit; "crp" returns the blood work entry; "skipped" returns the check-in transcript that mentioned skipping a med. **Why deferred:** F05 C1 was the last MVP feature before pricing/auth — search is its own mini-cycle and needs the auth model first (per-user search index keying is auth-dependent).

## 24. Auth Decision C lock + MSG91 build (added 2026-05-16, deferred at owner's discretion)

**Status:** RESEARCHED, recommendation drafted, **lock deferred by Rewant on 2026-05-16**. Not technically post-MVP — Decision C sits on the auth critical path and is acknowledged as high-priority. Captured here so the deferral is tracked and the revisit is a re-read, not a re-walk.

**What's been done.** Full India-friendly, price-first vendor sweep across MSG91, 2Factor.in, Plivo Verify, Twilio Verify, Fast2SMS, Authkey.io, Exotel, SMSCountry, Gupshup, Sinch Verification, Kaleyra/Tata Comms. Two scale points priced (200 SMS/mo MVP, 80,000 SMS/mo at 10k users). Sarvam ruled out (STT/TTS only, no SMS product). Twilio Verify rejected for India-only on cost (60× MSG91 at 10k scale — ~₹880k/mo vs ~₹15k/mo) AND because Convex Auth's built-in Twilio provider doesn't relieve the DLT-DIY burden in India. Full comparison tables, alternatives-considered, and gotchas live in `docs/features/auth-scoping.md` → Sub-decision C.

**Recommendation drafted (pending Rewant lock).** **MSG91 primary, 2Factor.in documented fallback.** MSG91 wins on: (a) 25,000 OTP credits/mo × 6 mo Startup Program = MVP free for the runway (covers ~6,000 users at current cadence); (b) true Verify-style API (vendor manages OTP lifecycle — no DIY brute-force protection); (c) assisted DLT registration. 2Factor wins at 10k scale (~₹9.6k/mo vs MSG91's ~₹14.4–15.2k/mo) and is the named swap target via the `lib/auth/sms-transport.ts` adapter when MSG91's startup credits expire or volume crosses 25k/mo.

**Build plan drafted.** Ten-step plan (C-1 through C-10) inline in `docs/features/auth-scoping.md` → Sub-decision C → "Build plan — MSG91". Covers: DLT + account prerequisites (Day 0 — long pole), schema additions, adapter file with code sketch, Convex Auth wiring, per-IP rate limit (defense-in-depth for the per-phone protection MSG91 already provides), sign-in UI (plain Server Actions per Swap-friendliness pattern), test plan (unit + live-gated integration + manual smoke), env-var registration (per `feedback_vercel_preview_env_pattern.md`), cost monitoring (`authAuditLog` query + monthly dashboard check), ship gates.

**Why deferred.** Rewant chose 2026-05-16 to absorb the research separately from the lock decision. Research is captured so revisiting is a re-read.

**Trigger to revisit.** Any of: (a) decision to begin the auth ship sequence (then C must lock to start the 3–7 business-day DLT clock); (b) a higher-priority lane completing and freeing scoping bandwidth; (c) a US clinical-pilot conversation that would force re-opening the Twilio Verify question on BAA grounds.

**What happens at revisit.** (1) Read Sub-decision C in `auth-scoping.md`. (2) Lock or counter the MSG91-primary recommendation. (3) Append decision-log line in `auth-scoping.md` + drop the `LOCK DEFERRED` markers. (4) Same-day: register `auth@meetsaha.com` on MSG91 + apply to Startup Program + start TRAI DLT entity registration. (5) Resume Decision D (locale detection) or whichever decision is next per the A→B→C→D→F→E→G→H walk order.

**Architectural hook (already in place).** `lib/auth/sms-transport.ts` adapter shape locked in the Swap-friendliness pattern (auth-scoping.md). Whichever vendor wins, the adapter contract (`sendPhoneOtp` → `{ requestId }`, `verifyPhoneOtp` → `boolean`) absorbs it. No architectural rework needed at lock time.

---

## 25. Voice loop survives extract-429 — second attempt (added 2026-05-23, after PR #21 closed unmerged)

**Status:** PR #21 (`fix/voice-loop-survives-extract-failure`, branch retained on origin) closed without merge on 2026-05-23 after live smoke surfaced a provider-lifecycle integration gap. Original silent-Stage-2 cliff-edge on extract-429 still lives in `main`.

**Symptom that closed PR #21.** On the preview, the 6th voice turn 429'd (daily cap), Saha spoke "How is your pain today, 1 to 10?" once, then the UI froze. No follow-up TTS, no mic restart, no further extract calls — user couldn't tap-stop, couldn't speak. HAR confirms exactly one POST to `/api/check-in/extract` returning 429 and zero follow-up `/api/speak` or `/api/transcribe` activity. React error #418 (hydration mismatch) co-fired.

**Root cause hypothesis.** PR #21 dispatched `ASK_QUESTION` (with all-5-missing seed) from the `extracting`-state catch block. The reducer routed `extracting + ASK_QUESTION → speaking-question`, but the page's voice-provider lifecycle was never designed to be re-entered from that direction. The orb-tap → opener → listening path is what normally arms the provider; arriving at `speaking-question` via the freeform-extract catch leaves the provider unarmed. The TTS effect either no-ops on a provider-state guard, or even when TTS plays, the `QUESTION_PLAYED → listening-answer` step can't restart the mic. Vitest 913/913 passed because the unit suite only exercised the reducer contract, not the page-level orchestration around it — the unit-tests-pass / integration-fails trap that `feedback_ship_day_manual_smoke.md` calls out.

**What's salvageable from the closed PR.** `lib/checkin/extract-failure-fallback.ts` + its three unit tests — the dispatch contract is fine, just dispatched from the wrong place. Branch `fix/voice-loop-survives-extract-failure` retained on origin for reference.

**Why deferred (not retried inline).** The fix is no longer the one-line catch-branch swap PR #21 attempted. A proper next attempt has to treat the freeform-extract catch as a provider-lifecycle transition, not just a state-machine event. Scoping that, building the integration-test harness for it, and re-smoking on the live URL is enough work that bundling it with the next PR train (#25 Lane D, telemetry) would dilute both.

**Post-MVP shape (next iteration).**
- Arm the voice provider explicitly before dispatching `ASK_QUESTION` from the catch branch — or route the dispatch through `speaking-opener` first, since opener-entry is the only currently-tested path into `speaking-question`.
- Add an integration test that walks the actual flow: tap orb → speak → force-429 → expect TTS to play follow-up AND mic to restart for `listening-answer`. Not a unit test of the dispatch helper.
- Ship-day live-smoke checklist (per `feedback_ship_day_manual_smoke.md`) must include the 429-fallback path before the next merge attempt. Cap-reset helper documented in PR #21 description.
- Investigate the React #418 hydration error that co-fired — possibly unrelated (longstanding) but worth eliminating to avoid noise during the next smoke.

**Trigger to revisit.** Either (a) a real user hits the extract-429 cliff-edge in prod and the silent-Stage-2 fallthrough is rated unacceptable; (b) the auth/pricing track lands and a polish pass on voice-edge-cases is scheduled; (c) Layer 2 voice telemetry (Sentry/PostHog decision pending) reveals the 429-fallthrough is more common than expected.

**Architectural hook (already in place).** Reducer transitions and the salvaged helper are in place. The missing piece is the page-level orchestration that arms the provider on this entry path.

---

## 26. Client-side TTS prefetch for catalog audio (added 2026-07-04, Q3 deferred slice)

**Status:** The 2026-07-04 voice-humanness assessment's Q3 (prefetch the 22 catalog question audios at session start, removing the TTS POST from the mid-loop silence gap) shipped only its server-side slice: `SARVAM_TTS_CACHED_RESPONSES=1` env-gates Sarvam's `enable_cached_responses` beta flag in `lib/voice/sarvam-tts-server.ts` (identical requests return provider-cached audio). Client-side prefetch was deliberately deferred.

**Why deferred.** Two reasons. (1) Q1 (Pattern A acks) changed the math the assessment was written against: mid-loop questions are now usually ack-prefixed ("Got it — pain at 7. And your energy today, 1 to 10?"), making their text value-unique — a prefetch of the 22 bare strings misses exactly the turns that dominate the loop. Still-fixed strings (openers, re-asks, decline acks, closers, give-up lines) do hit, which is what the server-side flag now covers without client complexity. (2) A client cache rewires every `speak()` call in `SarvamTtsAdapter` (blob lifetime, `cancel()` races, autoplay-policy edges) — the exact vitest-green-≠-live-audio class of change the PR #21 postmortem gates on live verification.

**Post-MVP shape.** Design alongside Pattern C / the A2 e2e harness: either (a) prefetch ack-variant × question combinations for the finite non-boundary value space (~24 ack + 22 question strings; combinations only if two-element playback proves seamless), or (b) keep single-utterance synthesis and rely on provider-side caching + streaming TTS if Sarvam's streaming endpoint matures. Measure first: the A2 harness + PostHog Layer 2 latency events should say how much of the 2.5–5 s gap is TTS synth vs upload/STT/extract before more engineering goes here.

**Trigger to revisit.** A2 harness lands (playback seams become verifiable), or telemetry shows TTS synth is the dominant slice of the mid-loop gap.

---

## HIPAA compliance / BAA readiness

> Items deferred from MVP because formal HIPAA compliance and Business Associate Agreements (BAAs) are gated on a **threshold-crossing event** — US clinical partnership, scale beyond the first 50 free users, or a deliberate decision to pursue a formal compliance posture for fundraising / enterprise sales. Architecture is HIPAA-*shaped* today (per ADR-035: audit log, soft-delete trail, MFA-ready data model, DPDP-compatible privacy policy); the items below are the operational/legal layer that turns posture into a defensible compliance stance when needed.
>
> **Trigger for revisiting this section:** any of (a) US clinical pilot conversation, (b) waitlist demand crosses 50→500 users, (c) enterprise/clinic tier moved into scope (per item #17 — currently out for Saturday pass), (d) regulatory change (DPDP rules tightened, or US-side HIPAA enforcement broadened to D2C health apps).

### H1. BAA-readiness — vendor-by-vendor BAA path comparison

**Why deferred.** Decision A locked Convex Auth (sub-processor minimization). Decision B locked Resend for magic-link email. Decision C will pick an SMS provider for phone OTP. All three vendors handle PII at MVP, but we explicitly accepted "HIPAA-grade architecture, formal BAAs deferred until threshold." The full vendor-BAA comparison was out of scope for the auth sprint walks but needs to be done before any threshold-crossing commitment.

**Scope when revisited.** For each sub-processor in the auth + voice + LLM chain, document:
- Public BAA availability (Y / N / on-request / Enterprise tier only).
- Pricing impact of BAA tier vs current tier.
- Sub-processor flow-through guarantees (does THEIR BAA cover their downstream sub-processors?).
- Migration cost from current vendor to a BAA-friendly alternative.

**Vendors in scope at the time of revisit (pre-staged from auth sprint):**
- **Email transport (Decision B = Resend).** Resend BAA path: ask their team — not publicly documented as of 2026-05-10. Alternative: AWS SES (account-wide AWS BAA) or SendGrid (Twilio BAA on request). Migration cost: low (single adapter file at `lib/auth/email-transport.ts`).
- **SMS transport (Decision C, recommendation drafted 2026-05-16: MSG91 primary, 2Factor.in fallback; lock deferred — see backlog #24).** MSG91 + 2Factor are India-local; BAA is a US legal construct so DPDP-only stance applies — re-evaluate against US-side requirements at threshold time. If a US clinical-pilot trigger fires before C locks, reopen the comparison to include Twilio Verify (BAA available on request, ~60× cost premium accepted as the price of compliance). Migration cost: low — single adapter file at `lib/auth/sms-transport.ts` per Swap-friendliness pattern.
- **Convex (DB + Auth).** Sub-processor for everything. BAA path: ask Convex directly; their public docs reference SOC 2 but not a published HIPAA tier. Migration cost: catastrophic (whole-app rewrite). Effective lock-in.
- **OpenAI / Anthropic (LLM extraction).** Both publish enterprise BAA paths gated on tier. ADR-020's data-minimization (2000-token cap) reduces but does not eliminate PII flow. Re-evaluate alongside the LLM data-minimization audit (currently deferred).
- **Sarvam (STT/TTS, voice).** India-local; same DPDP-vs-HIPAA distinction as MSG91.
- **Vercel / Razorpay / Stripe (infrastructure + payments).** Vercel publishes BAA on Enterprise tier. Razorpay = India-only (DPDP applies). Stripe BAA available; usually flowed through whoever is the merchant of record.

**Architectural hook.** The Swap-friendliness pattern locked in the auth sprint (`lib/auth/email-transport.ts`, `lib/auth/sms-transport.ts`, plain Server-Action-backed forms) means most vendor swaps at threshold time are single-adapter-file changes. Convex itself is the only deep lock-in.

### H2. Formal HIPAA controls (beyond architecture)

**Why deferred.** ADR-035 locks the *architecture-grade* HIPAA posture (audit log, soft-delete trail, MFA-ready data model, DPDP-compatible privacy policy). Below this line are the *operational* HIPAA controls — workforce training, access reviews, incident response runbooks, breach notification mechanics, risk assessments — none of which earn their keep at first-50-user MVP scale.

**Post-threshold shape.** Set up annually-cadenced controls under a designated HIPAA officer (likely Rewant at start, or a fractional compliance vendor). Workforce training (one-time + annual refresher), quarterly access reviews against the audit log, documented incident-response runbook, breach notification SLAs (60 days HIPAA, 72 hours GDPR, 72 hours DPDP) tested via tabletop.

**Architectural hook.** None — the audit log table from ADR-035 is the substrate for access reviews. Everything else is process, not code.

### H3. Session revocation surface ("log out everywhere")

**Why deferred.** Explicitly out of scope for the auth sprint (ADR-035). At first-50-user scale, account compromise is recoverable via password / magic-link reissue + Convex internal mutation to invalidate sessions.

**Post-threshold shape.** Settings → Sessions surface listing active sessions (device, IP, last-active timestamp) with per-session revoke + "log out everywhere" button. Implemented as a query against Convex Auth's session table + a public mutation that deletes session rows.

**Architectural hook.** Convex Auth maintains the session table internally. Surfacing it requires adding a `sessions:list` query and `sessions:revoke` / `sessions:revokeAll` mutations.

### H4. LLM-extraction data-minimization audit

**Why deferred.** ADR-020 caps `/api/check-in/extract` payloads at 2000 tokens, which is the current minimization stance. A formal audit (what fields actually leave Saha's perimeter, against what extraction value, with what redaction) is post-threshold work.

**Post-threshold shape.** Document the exact payload shape for every external-LLM call, identify any PII that leaves without extraction-value justification, redact or restructure as needed. Couples to BAA scope (H1) — once a BAA is in place with the LLM provider, the calculus shifts from "minimize what crosses" to "minimize what's logged at rest."

**Architectural hook.** All LLM calls go through `lib/checkin/medication-extract.ts` and similar centralized extractors. Single audit point per call site.

---

## Review cadence

This backlog is reviewed at two points:
1. **Before every build session** — quick skim to confirm nothing scoped-out has become urgent.
2. **When a user asks for a feature that's listed here** — reply with the post-MVP shape + expected timeline, don't re-scope on the fly.
