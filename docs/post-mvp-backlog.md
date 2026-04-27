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

---

## Review cadence

This backlog is reviewed at two points:
1. **Before every build session** — quick skim to confirm nothing scoped-out has become urgent.
2. **When a user asks for a feature that's listed here** — reply with the post-MVP shape + expected timeline, don't re-scope on the fly.
