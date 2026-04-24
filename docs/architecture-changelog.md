# Architecture Changelog

> Running log of **changes** to architectural decisions. Each entry references the ADR it updates and captures what changed and why. This is separate from `architecture-decisions.md` (which is the append-only record of decisions themselves) — this file is where we track how our thinking evolved.

**Convention.**
- Newest entries at the top.
- Each entry: date, the ADR it relates to, the change, the reason.
- When an ADR is superseded entirely, add an entry here AND add a new numbered ADR in `architecture-decisions.md` that supersedes it.

---

## 2026-04-25 — F01 C1: checkIns table
- New table `checkIns` with index `by_user_date` on (userId, date).
- Enum `mood`: heavy | flat | okay | bright | great.
- `clientRequestId` for idempotent create. Soft delete via `deletedAt`.
- Existing `waitlist` untouched.

---

## 2026-04-24 — Q1 closed: "support system" is Sonakshi's word

**Related ADR:** none — this is a language/copy decision that aligns with the already-locked § Language conventions.

**What changed.** Q1 in `scoping.md` asked which word Sonakshi uses for the concept previously called "caregiving." Rewant confirmed: **"support system."** Same term already locked in the language-conventions table as the replacement for *caregiver* / *squad* (legal-risk scrub). Now also the canonical in-product word for the concept itself.

**Why.** Removes the last ambiguity between the legal-scrub decision (*"don't say caregiver"*) and the positive naming decision (*"what do we say instead"*). One word does both jobs. Scoping doc now has 0 open questions — fully finalized.

---

## 2026-04-24 — Remaining scoping open questions closed (Q3–Q21)

**Related ADRs:** ADR-003 (five-pillar nav — Community), ADR-007 (five required metrics + data model), ADR-010 (events first-class)

**What changed.**

Eleven open questions in `scoping.md` resolved in one batch. Open-question count moves from 11 to 0 — scoping doc finalized.

1. **Q3 — onboarding screens 1–3 verbatim copy:** deferred into the Thursday L2 landing-page writing session (one writing pass covering both surfaces). Screens 4–5 already locked in the previous entry.
2. **Q4 — condition dropdown source + cardinality:** AARDA master list. **Single-select for MVP**; multi-select deferred to post-MVP backlog #18. Schema stores `conditions: string[]` from day one — MVP writes a single-entry array, post-MVP writes multi-entry, zero migration.
3. **Q5 — searchable dropdown:** yes, searchable type-ahead input (client-side filter over the AARDA list).
4. **Q10 — edit/decline summary card:** inline edit before save; on decline, **discard with confirm dialog** — no draft state, no "unconfirmed" save. Two terminal states only (save or discard) keeps Memory truthful.
5. **Q12 — Memory UI:** full spec landed in § Memory landing. Horizontal calendar strip + filter tabs + reverse-chronological scroll synced to scrubber + client-side keyword search over free-flow bonus-capture text + tap-to-detail sheet with Edit/Delete (follows § Edit/cancel rules).
6. **Q13 — milestone list:** locked at **Day 1 / 7 / 30 / 90 / 180 / 365.** Visualization follows the already-locked Whoop-style ring animation (≤2s) + paired milestone closer variant + single CTA. Non-milestone streak days get no celebration.
7. **Q14 — Whoop-style charts:** 3 charts in MVP — wellness ring, 30-day streak bar, multi-metric stacked line with dose-change markers + flare shaded blocks. **Flare ↔ dosage correlation chart deferred** to post-MVP backlog #19 (build-heavy correlation detection + annotation renderer; core signal is already visible in the stacked line). Sleep/HRV overlays (blocked on wearable integration) and heatmaps (insufficient data density) also deferred.
8. **Q15 — Community channel creation:** no user-created channels for MVP. Channels **auto-created from the AARDA list** at app launch. Removes empty-room problem and a whole moderation surface.
9. **Q16 — Community discovery:** auto-join to the channel matching the user's Setup B.4 condition; related same-family channels surfaced on first entry; full AARDA list browsable/searchable. One-tap join/leave, no approval flow.
10. **Q17 — Community content types:** **text only** for MVP. No images, links-as-cards, polls, long-form. Link auto-hyperlinking fine; unfurling/preview cards not.
11. **Q18 — Community news sharing:** none for MVP. No curated feed, no AI digest, no link cards. Channels are peer conversation only.
12. **Q19 — Community identity:** pseudonym by default. Handle-only (generated suggestion, overwritable), no real name, no avatar upload, no bio.
13. **Q20 — Community moderation:** **Rewant as sole admin for MVP.** Report button on every message → admin queue. Admin actions: hide, remove from channel, global suspend. No community moderators, no automated toxicity filters, no appeals. Explicitly interim — scales only to waitlist-sized base.
14. **Q21 — Community privacy invariant:** hard invariant that Community NEVER auto-surfaces private check-in / Memory / event data. Enforced at the data layer (Community has no read access to those tables; it is its own surface). Users can voluntarily type anything into Community; app-driven auto-share paths are zero.

**Two new post-MVP backlog items (backlog #18, #19).** Multi-select conditions and Flare↔dosage correlation chart. Both have architectural hooks preserving zero-migration paths when they ship.

**Why.**
- *Community locks collectively:* the MVP Community shell had to be shippable safely with a single admin (Rewant) and zero auto-surfacing of private data. Auto-created channels from AARDA, text-only, pseudonymous, one-admin moderation — all of these pick the simplest shape that still delivers "you are not alone" without inheriting the moderation-heavy architecture of a full community platform.
- *Single-select + correlation chart deferrals:* both are valuable signals but build-heavy against the weekender clock. The schema and event model are already shaped to absorb them later without migration — the cost of shipping later is very close to the cost of shipping now, but the risk of shipping now is higher. Deferred with explicit architectural hooks.
- *Scoping doc finalized:* before this batch, 11 questions remained open. After, 0. The doc is the source of truth and the handbook's scope step is complete; per Rewant's direction we pause here before moving to POC.

---

## 2026-04-24 — Onboarding screens 4–5 locked (Voice check-in + Memory/Patterns) and nudge bank landed

**Related ADR:** ADR-006 (opener rules engine), ADR-009 (closer rules engine), ADR-014 (graduated feedback)

**What changed.**
1. **Onboarding screens 4 and 5 content locked.** Two screens, one feature each, Sakhi speaking first-person. Screen 4 = Voice check-in (*"Talk to me. I'll remember."*) — the activation story. Screen 5 = Memory + Patterns (*"Look back. See what's changed."*) — the retention payoff. Doctor Report and Community deliberately excluded from onboarding — Doctor Report lives on the landing page (revenue-track payoff), Community reveals organically.
2. **Nudge bank for non-check-in moments landed** as a new § in scoping.md. 12 lines covering intake tap, dosage/visit capture confirm, Doctor Report generation, annotation, 2+ and 7+ day return, empty Journey/Patterns, missed intake, flare flag, network-retry sync. Separate from the 7-variant closer bank already locked for check-in endings.

Closes open questions #2 and #11 in scoping.md.

**Why.**
- *Onboarding:* Rewant directed a first-person voice and inspiration-only reference to the splash-screen Figma. Two screens (not three) matches the one-feature-per-screen template; Doctor Report doesn't belong in onboarding because it dilutes the daily-use story, and Community is not part of the core loop.
- *Nudge bank:* Every non-check-in interaction still ends with a short line; not having a documented bank would produce ad-hoc copy during build that drifts in voice. Locking the bank now preserves the closer's tone across the app. Reuses closer phrases (*"I'm here"*, *"Today's its own day"*, *"Good to hear you"*) for unified voice across surfaces.

---

## 2026-04-24 — Voice architecture locked: Web PWA for MVP, native apps post-MVP

**Related ADR:** ADR-017 (new) — supplements ADR-002 (stack)

**What changed.** Previously open (Q6 in scoping.md). Voice-first architecture decided: **MVP ships as a web app (Next.js 16 mobile-first, installable as a PWA)** with browser-based voice (Web Speech API fallback, OpenAI Realtime / Vapi as primary) behind a provider interface. Native iOS + Android apps are a post-MVP follow-on reusing the Convex backend and voice provider. Post-MVP backlog item added implicitly (native wrappers).

**Why.** Weekender deliverable is Saturday 8pm on a live URL — native app-store review doesn't clear that window. Rewant confirmed mobile-first is the user reality (*"preferably it should be a mobile-based application"*) but accepted web-for-MVP with native as the follow-on. PWA installability gives the home-screen-app feel without the app-store gate. Provider-interface abstraction means swapping from browser voice to a native mic bridge later is a config change, not a refactor.

---

## 2026-04-24 — Testimonial locked as founder quote (baseline; user quote as upside-swap)

**Related ADR:** ADR-001 (handbook methodology — Thursday L2 deliverable)

**What changed.** Third aha-moment gap (named social proof) closed. Founder quote locked as the shipping baseline for the Thursday L2 landing page:

> *"No one should have to be their own medical logbook. Sakhi is for the people I've watched try."*
> — Rewant Prakash, Founder

If a Sonakshi-sourced or other waitlist-member named quote arrives before Saturday, it swaps in; the founder quote is the guaranteed baseline, not the ceiling.

**Why.** The handbook's Revenue-track aha-moment rubric asks for one named quote on the landing page. A real user quote is the strongest signal but requires a third-party reply inside a 48-hour window, which is uncertain. A founder quote is honest social proof on its own — founder-market fit is a legitimate story for an early-stage chronic-illness app — and can ship immediately. Picking B2 (mission-framed, shorter) over B1 (problem-framed, longer) reuses the *"logbook"* word from the ROI anchor and persona pitch locked earlier the same day — all three landing-page copy anchors now reinforce the same motif, and B2 is short enough to work as a pull-quote for the Thursday launch post on X / LinkedIn. Alternatives not taken: fabricating a user quote (out of bounds), leaving the space empty with a "coming soon" frame (weakest rubric outcome), waiting on Sonakshi before committing copy (risked an empty social-proof row by Thursday).

---

## 2026-04-24 — One-sentence persona pitch locked

**Related ADR:** ADR-001 (handbook methodology — Thursday L2 deliverable)

**What changed.** One-sentence persona pitch locked as: *"Sakhi is for people with chronic autoimmune conditions who shouldn't have to be their own medical logbook."* Ships on the Thursday L2 landing page and opens the public launch post.

**Why.** The handbook's Revenue-track aha-moment rubric asks for a one-sentence persona job description. Locking one reusable sentence (vs. drafting ad-hoc during the Thursday push) ensures the landing page and launch post share voice. The sentence reuses the "logbook" motif from the ROI anchor (locked same day), so both pieces of landing-page copy reinforce the same pain framing — *the invisible labor of tracking your own condition between visits.* Alternatives considered: between-visits framing, single-voice/woman-specific framing (dropped for gender narrowness), outcome-forward framing (failed the handbook's ask for a *persona* sentence).

---

## 2026-04-24 — Landing-page ROI anchor locked

**Related ADR:** ADR-001 (handbook methodology — Thursday L2 landing-page deliverable)

**What changed.** Landing-page ROI anchor copy locked as: *"Stop being the logbook for your own condition. Sakhi remembers every dose change, every flare, every off day — so your doctor sees the full picture, not just today."* Replaces earlier draft (*"One visit you don't have to repeat pays for a year of Sakhi."*). Ships on the Thursday L2 landing-page push.

**Why.** The earlier draft framed the ROI as saving a repeat visit — which isn't the primary pain. Rewant clarified the pain is the *invisible labor between visits*: patients manually or mentally tracking 2–3 months of symptoms and dosage changes, then compressing it into a 10-minute OPD window. The new copy sells against that cognitive load directly — *"stop being the logbook for your own condition"* names the burden, and the dose-change / flare / off-day list spells out what Sakhi actually remembers. Closes with the doctor-outcome tie-in.

---

## 2026-04-24 — Handbook rubric positioning locked on Revenue track

**Related ADR:** ADR-001 (Scope → POC → Build methodology)

**What changed.** Added § Handbook rubric positioning to scoping.md. Revenue track (176-pt ceiling) picked as the target over Virality (164) or MaaS (164). Aha-moment features audited against the handbook's Revenue-track rubric; 4 patterns scored (sub-60s time-to-first-value ✅, obvious ROI calc ⚠️, one-sentence persona ⚠️, social proof ❌). Saturday deliverable timeline mapped to explicit Thursday / Friday / Saturday gates.

**Why.** The handbook awards most heavily on Signups (20x weight) and Revenue generated (15x), both of which Sakhi can clear with a free-tier + founder-tier pricing model and a waitlist already in motion. Virality was ruled out because chronic-illness apps live in a private category — optimizing Sakhi for shareable mechanics would distort the product. Three aha-moment patterns are addressable inside weekender scope (ROI copy on landing page, one-sentence persona pitch, one named testimonial).

---

## 2026-04-24 — Language scrub: "squad" / "caregiver" / reference-app names removed

**Related ADR:** ADR-013 (Tripartite Prepare-for-Visit), ADR-016 (Documentation discipline)

**What changed.** All uses of *"caregiver"*, *"squad"*, *"squad member"*, and the reference-app name (Sandy's Squad / Kinery) removed from scoping.md, post-mvp-backlog.md, architecture-changelog.md, and docs/CLAUDE.md. Replaced with **"support system"** and **"support-system member"** where a referent was needed. The reference-app audit that informed tripartite Prepare-for-Visit is now framed as *"a reference-app audit (layout-only inspiration, workflow not ported)."*

**Why.** Rewant has prior working history with Kinery (the company behind the reference app) and flagged using their brand/product language as a legal risk. The Figma reference was used for layout and information-architecture inspiration only — never to port workflows — so scrubbing brand-adjacent terms costs nothing and removes exposure. The "caregiver" term was also flagged in the original language conventions as problematic for the Indian support-system idiom (families, not single caregivers).

---

## 2026-04-24 — Edit / cancel of captured events moved into MVP

**Related ADR:** ADR-010 (Doctor visits + blood work as first-class events)

**What changed.** Edit/cancel of captured events (appointment date fix, duplicate removal, cancelled/no-show/rescheduled status) moved from post-MVP backlog into MVP scope. New subsection added under § Doctor-visit capture. Event model gains a `status` enum (scheduled / completed / cancelled / no-show / rescheduled) and a `linkedEventId` for reschedule chains. Full *check-in content* edit (pain value, mood, flare flag) remains post-MVP — the distinction is between editing *events* (supported) vs editing *self-reported metrics* (deferred).

**Why.** Rewant flagged this as MVP-critical: opportunistic voice capture will produce wrong dates, duplicates, and rescheduled appointments within the first week of use. Without edit/cancel, the timeline degrades into noise and the Doctor Report loses credibility. Cancelled-vs-deleted distinction preserves honest signal for the pattern engine and the report.

---

## 2026-04-24 — Cohort / peer comparison removed from backlog entirely

**Related ADR:** ADR-003 (Five-pillar nav) — specifically the Community pillar's scope

**What changed.** Post-MVP item *"Cohort / peer comparison"* deleted from backlog. Community is explicitly **not** a data-comparison surface — it is a Slack-style peer channel for conversation and solidarity only. No bio-data is shared or compared across users, now or post-MVP.

**Why.** Rewant clarified the intent: Community exists to deliver the "you are not alone" emotional outcome, not to benchmark patients against each other. Cohort comparison invites consent, anonymization, and statistical-significance complexity that isn't part of the product vision at all — keeping it in the backlog was a drift risk.

---

## 2026-04-24 — Provider result attachments and support-system squad mode removed from backlog

**Related ADR:** ADR-013 (Tripartite Prepare-for-Visit)

**What changed.** Two post-MVP items dropped from backlog:
1. *Provider result attachments* — file upload + PHI storage for doctor notes / prescriptions. Removed because the reference-app inspiration was purely layout-based and this workflow was never part of Sakhi's own scope.
2. *Squad / caregiver co-use mode* — multi-user squad editing. Removed because the conceptual framing is from the reference app (Kinery / Sandy's Squad), not Sakhi's.

The *support-system shared read-only view* (backlog item #5) remains — that one is Sakhi-native and was scoped independently. Language updated to *"support system"*, never *"squad"* or *"caregiver"*.

**Why.** Rewant confirmed the reference-app Figma was inspiration only — layout patterns (cards, stepwise forms, checklists) port; workflows (squad coordination, provider file sharing) do not. Keeping those workflows in the backlog created drift toward a product shape Sakhi is not.

---

## 2026-04-24 — Monetization first-pass designed (Revenue track targeting)

**Related ADR:** ADR-001 (Scope → POC → Build — now extends to pricing on Saturday)

**What changed.** Post-MVP item #20 *"Monetization / paywall logic"* expanded from one-line placeholder into a first-pass design: two-tier **Free (Sakhi Friend) / Paid (Sakhi Companion)** model, ₹199/month or ₹1,499/year in India, $4.99/month or $39/year internationally, Razorpay + Stripe rails, waitlist early-bird gate (first 100 get 3 months free) landing on the Saturday deliverable page. Gates fall on unlimited Memory history, unlimited reports, Patterns view, and future wearable / support-system features. Daily check-in and Community stay free forever.

**Why.** The AI Weekender handbook's Revenue track (176-pt ceiling, highest of the three) awards weighted points for *actual revenue generated* and *paid signups*. A visible pricing page on Saturday — even without live checkout — converts waitlist curiosity into revenue-track evidence. An optional *"Pay ₹99 to skip the waitlist"* founder-tier seeds the *revenue generated* metric at the rubric's scoring moment.

---

## 2026-04-24 — Initial documentation discipline adopted

**Related ADR:** ADR-016 (Documentation discipline)

**What changed.** Established the four-document documentation practice: `scoping.md` + `post-mvp-backlog.md` + `architecture-decisions.md` + `architecture-changelog.md`, supplementing the existing `build-log.md`.

**Why.** Weekender scope decisions were accumulating in a single scoping doc with no structured place for deferred items, locked architectural decisions, or change history. Rewant called for explicit documentation from the get-go — including out-of-scope reasoning — so the project has complete context recoverable in any future session.

---

## 2026-04-24 — Check-in pillar renamed to Journey

**Related ADR:** ADR-003 (Five-pillar bottom nav)

**What changed.** The original bottom-nav pillar tentatively called "Check-in" was renamed to "Journey" after recognizing the check-in is an *act* launched from Home, not a destination.

**Why.** Leaving "Check-in" as a pillar created structural redundancy (the act and the destination were the same thing). Journey absorbs the previously-homeless surfaces (Doctor Report, Memory history, Patterns, Flare/Visit timelines) into one "looking back" pillar.

---

## 2026-04-24 — `[LOG]` renamed to "Memory" across all user-facing copy

**Related ADR:** ADR-012 ("Memory" as the user-facing name for check-in history)

**What changed.** Internal placeholder `[LOG]` (used throughout early scoping) was resolved to the user-facing term **"Memory"**. Find-and-replace completed across `scoping.md` (31 occurrences). Future copy uses "Memory" as a proper noun with possessive forms (*"your Memory"*).

**Why.** The original placeholder was too clinical; "Memory" ties directly to the README's brand story (*"Sakhi means friend — the one who remembers with you"*). Candidate alternatives (Journal, Timeline, Diary) were warmer than `[LOG]` but less brand-operative.

---

## 2026-04-24 — Prepare-for-Visit expanded from two to three content types

**Related ADR:** ADR-013 (Tripartite Prepare-for-Visit flow)

**What changed.** Prepare-for-Visit flow expanded from (Annotations + Questions) to (Checklists + Annotations + Questions). Checklists are Sonakshi-facing only and do NOT render in the doctor-facing PDF.

**Why.** A reference-app audit (layout-only inspiration, workflow not ported) surfaced checklists as a distinct content type — pre-visit to-dos that help a patient walk into the OPD prepared. Adding this closed a real gap without expanding the PDF surface area.

---

## 2026-04-24 — Post-save closer register shifted from affirming to witnessing

**Related ADR:** ADR-009 (Continuity-aware closer)

**What changed.** Earlier draft closer variants included *"one day at a time"* and *"be kind to yourself today"*. These were removed after a research pass flagged them as toxic-positivity-adjacent or prescriptive.

**Why.** Chronic-illness communication research (cystic fibrosis / PsA / invisible illness literature) consistently flags phrases that tell the patient how to feel — the closer should *witness*, not *prescribe*. Replacement variants use companionship framing (*"I'm here"*) and specific factual affirmation (*"Seven days. That's real."*) only at rare streak milestones.

---

## 2026-04-24 — Milestone celebrations narrowed to day 1 / 7 / 30 / 90 / 180 / 365 only

**Related ADR:** ADR-014 (Graduated feedback) / § After save — celebration in scoping.md

**What changed.** Earlier framing implied a celebration could fire on any streak day. Narrowed to only six threshold days (1, 7, 30, 90, 180, 365). No daily streak celebration.

**Why.** Daily streak reinforcement turns chronic-illness tracking into gamification fatigue. Rare milestones feel meaningful; daily milestones feel like an ask.

---

## 2026-04-24 — Doctor report default granularity made dynamic (not fixed 30-day)

**Related ADR:** ADR-011 (Doctor report hybrid PDF)

**What changed.** Original framing implied four fixed report windows (7 / 14 / 30 / 90 days). Shifted to a single auto-refreshed dataset with a Daily / Weekly / Monthly granularity toggle controlled by the user, and a default that auto-picks based on data history.

**Why.** Fixed windows don't match Sonakshi's reality — dosage cadences range from daily to monthly; flare durations from hours to weeks; doctor visits on irregular schedules. One dataset with a toggle covers every case. Pattern borrowed from Whoop's user-adjustable timeframe UI.

---

## 2026-04-24 — Pattern engine locked as rules engine, not LLM

**Related ADR:** ADR-014 (Graduated feedback)

**What changed.** Explicitly ruled out LLM-generated insights for MVP. All verbal insight copy comes from templated rules-engine output.

**Why.** Predictability, speed (no network round-trip at open), safety (no hallucinated correlations), and i18n (fixed templates translate cleanly). Also: a health app cannot tolerate tone drift or invented patterns.
