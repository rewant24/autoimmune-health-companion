# Architecture Decisions

> Running log of architectural and product decisions that shape the app. Each entry is an **ADR (Architecture Decision Record)** — Context → Decision → Consequences → Alternatives considered. Decisions are numbered sequentially and dated. Once recorded, an ADR is **never edited**; changes are handled by adding a new ADR that supersedes it, with a cross-reference.

**Convention:**
- Status: `proposed` / `accepted` / `superseded by ADR-NNN` / `deprecated`
- When a decision changes: add the change to `architecture-changelog.md` AND supersede the relevant ADR here.

---

## ADR-001 — Methodology: Scope → POC → Build, in order

**Date:** 2026-04-23
**Status:** accepted

**Context.** This is an MVP build under time pressure with constant pull toward scaffolding-first. The Project Process Playbook prescribes a three-step discipline that prevents rework later.

**Decision.** All work follows **Scope → POC → Build** in strict order. Scoping doc is complete before any POC; POC validates any logic that could fail before any production code is written. No shortcuts.

**Consequences.**
- Pros: rework is minimized; scope creep is visible early; design decisions are deliberate.
- Cons: first few sessions feel slow (no shipped code yet); easy to feel like "we're not building."

**Alternatives considered.** Straight into Next.js scaffolding. Rejected: too much rework visible in prior MVP attempts that skipped the scope step.

---

## ADR-002 — Stack: Next.js 16 + Convex + Vercel

**Date:** 2026-04-23
**Status:** accepted

**Context.** MVP app needs: fast full-stack dev, realtime data for the voice check-in updates, easy deployment, minimal backend ops.

**Decision.** Next.js 16 (App Router, Turbopack) + Tailwind 4 + Convex (backend + realtime DB) + Vercel (hosting). No separate Node backend.

**Consequences.** Convex reactive queries give us Home dashboard realtime updates "for free." Vercel deployment is instant. Lock-in risk on Convex is medium — schema is standard enough to migrate if needed.

**Alternatives considered.** Supabase + custom Next.js API routes (more plumbing, less reactivity out of the box). Firebase (weaker developer experience for the query patterns we need).

---

## ADR-003 — Five-pillar bottom nav: Home / Medications / Journey / Community / Settings

**Date:** 2026-04-24
**Status:** accepted

**Context.** Original nav tentatively included "Check-in" as a pillar. But the voice check-in is an *act launched from Home*, not a destination. Leaving it as a pillar created structural redundancy.

**Decision.** Five pillars: **Home** (daily voice check-in + dashboard), **Medications** (regimen + adherence), **Journey** (aggregated "looking back" surface — Doctor Report, Memory history, Patterns, Flare timeline, Visit timeline), **Community** (peer support), **Settings** (plumbing).

**Consequences.** Journey absorbs the homeless-before-this rename: Doctor Report, Memory, Patterns, Flare/Visit history. Memory becomes the user-facing name for the history-of-check-ins surface (see ADR-012).

**Alternatives considered.** Keeping "Check-in" as a pillar. Rejected: double-up of Home's function.

---

## ADR-004 — Hybrid conversation shape for daily check-in

**Date:** 2026-04-24
**Status:** accepted

**Context.** Pure open-question check-in (*"how's your day?"*) leaves data gaps. Pure scripted sequence feels like a voice-answered form. Neither matches a friend-app's tone while also producing reliable data.

**Decision.** **Hybrid: open-first, scripted-fallback.** Saha opens with one warm question, listens, and only falls back to scripted probes for required metrics Sonakshi didn't cover in free-flow.

**Consequences.** Warm on good days (she talks freely), reliable on quiet days (Stage 2 fills the gaps). Increases NLP burden modestly — Saha must extract required metrics from free-form speech in real time.

**Alternatives considered.** Pure open (rejected — data gaps). Pure scripted (rejected — cold).

---

## ADR-005 — Progressive two-stage check-in screen

**Date:** 2026-04-24
**Status:** accepted

**Context.** Voice-first check-in with required structured data implies the screen needs both a voice surface AND tap controls. Dense always-visible controls dilute the voice moment's warmth.

**Decision.** **Two-stage screen.** Stage 1 = pure voice (mic + opener, no controls). Stage 2 = only-what's-missing tap controls for required metrics not covered in voice. If she covers all five in voice, Stage 2 is skipped.

**Consequences.** Voice moment stays protected. Rough-morning path (she taps to pause) still works — jumps to Stage 2 with all controls visible. Minor engineering complexity around the stage transition + live extraction.

**Alternatives considered.**
- Voice-foreground with collapsed strip (A) — rough-morning path is two taps deep.
- Always-visible controls alongside voice (B) — zero-hunting but screen feels like a dashboard.

---

## ADR-006 — Continuity-aware opener (rules engine, not LLM)

**Date:** 2026-04-24
**Status:** accepted

**Context.** The opener is the single most load-bearing line of copy. It sets whether Saha feels like a friend or a tool.

**Decision.** **Continuity-aware opener driven by a deterministic rules engine.** The opener draws on yesterday's check-in, streak state, upcoming events, and recent flare-up status to pick from a bounded set of variants. Not LLM-generated on the fly.

**Consequences.** Predictable, fast (no network round-trip), safe (no hallucinated references), i18n-friendly (fixed string keys). Requires keeping the variant set up to date.

**Alternatives considered.**
- Fixed greeting (A) — cold after the first few days.
- LLM-generated on the fly — rejected (predictability / speed / safety / i18n).

---

## ADR-007 — Five required metrics for daily check-in

**Date:** 2026-04-24
**Status:** accepted

**Context.** The check-in needs to come out with a minimum data set for the pattern engine and doctor report. Too many required items makes the fallback feel like an interrogation. Too few thins the data.

**Decision.** **Five required metrics:** pain, mood, intake adherence, flare-up flag, energy/fatigue. Everything else (stiffness, sleep, food, stress) is *bonus capture from free-flow voice only* — never probed for.

**Consequences.** Check-in stays under 60s on the median day. Pattern engine has enough signal to produce insights starting around day 14. Stiffness/sleep/etc. data will be sparse in MVP, limiting certain correlations.

**Alternatives considered.** Including stiffness as required (rejected — often covered when pain is covered). Including sleep (rejected — nice to have, not critical for MVP).

---

## ADR-008 — Multimodal input: voice OR tap

**Date:** 2026-04-24
**Status:** accepted

**Context.** Some mornings Sonakshi wants to be heard; some mornings she's too exhausted to talk but still needs to log.

**Decision.** Check-in accepts **voice OR direct tap** on the same surface. Stage 1 is voice-first (with tap-to-pause escape); Stage 2 is tap-primary. Voice-heard values auto-fill Stage 2 controls and are tap-correctable.

**Consequences.** Zero-friction on rough mornings. Voice STT must be accurate enough that auto-filled controls don't require constant correction. Adds complexity to the extraction/display sync.

**Alternatives considered.** Voice-only (rejected — forces vocalization on bad days). Tap-only (rejected — loses the friend-app warmth).

---

## ADR-009 — Continuity-aware closer (rules engine, evidence-led)

**Date:** 2026-04-24
**Status:** accepted

**Context.** The closer is the last thing Sonakshi hears each morning. Toxic-positivity literature flags several common phrases as harmful on bad days. Voice UI brevity research caps useful length at ≤5 words.

**Decision.** **Continuity-aware closer, same rules engine as the opener.** 7 state-specific variants, all 3–5 words, all forward-looking or witness-framed (never prescriptive). Phrases ruled out: *"one day at a time"*, *"be kind to yourself"*, *"stay strong"*, generic praise, anthropomorphizing thanks.

**Consequences.** Closer is symmetric with the opener. Variants survive i18n. Requires curated copy per state — not LLM-generated.

**Alternatives considered.**
- Fixed closer (rejected — same coldness issue as fixed opener).
- Single-register closer (A/B/C in scoping discussion) — rejected in favor of state-awareness.

---

## ADR-010 — Doctor visits + blood-work as first-class events

**Date:** 2026-04-24
**Status:** accepted

**Context.** Doctor report defaults to a *"last visit to today"* window. This requires the app to know when visits happened. Also, blood-marker changes often precede symptom changes — aligning blood-test dates to flare-ups matters clinically.

**Decision.** **Doctor visits and blood-work tests are first-class event types in the data model**, captured via two paths: (a) opportunistic extraction during voice check-in, (b) manual add via Journey "+" menu.

**Consequences.** Report window computation has a canonical anchor. Patterns chart can show visit/blood-test markers as timeline layers. Event schema is extensible to scans/procedures/referrals.

**Alternatives considered.** Visits as free-text notes inside Memory entries. Rejected — can't power the report-window default or the chart overlays.

---

## ADR-011 — Doctor report: hybrid PDF (summary + appendix); share via phone or WhatsApp only

**Date:** 2026-04-24
**Status:** accepted

**Context.** Doctors need quick scannable summaries; patients benefit from full-fidelity appendices for deeper conversations. Hosted shareable links add privacy/retention/revocation complexity.

**Decision.** **PDF is hybrid**: Page 1 one-page summary (cover + headline metrics + chart + narrative bullets + annotations), Pages 2+ full-fidelity appendix. **Sharing = phone-screen in-app view OR PDF via WhatsApp only.** No hosted links.

**Consequences.** Doctor sees the right amount on first pass; patient retains the depth. No cloud-hosted artifact means less liability/ops burden.

**Alternatives considered.** Summary-only (rejected — loses the data story). Full-only (rejected — doctors won't read). Hosted link (deferred to post-MVP, see post-mvp-backlog #7).

---

## ADR-012 — "Memory" as the user-facing name for check-in history

**Date:** 2026-04-24
**Status:** accepted

**Context.** Internal placeholder `[LOG]` was too clinical / legal-sounding. Needed a warmer term.

**Decision.** **"Memory"** — makes the README tagline operative (*"Saha holds the days you can't, and walks beside the days you can"*). Used as a proper noun with possessive (*"your Memory"*). Section label inside Journey is *Memory*.

**Consequences.** Save prompt reads *"Good to save these to your Memory?"*. Journey tab is *Memory*. Slight ambiguity with the English word "memory" (used in the tagline *"data, not memory"*) — disambiguated by capitalization in app copy.

**Alternatives considered.** "Journal" (safe second), "health timeline" (too cold), "wellness journal" (branded), "my journey" (collides with Journey pillar).

---

## ADR-013 — Tripartite Prepare-for-Visit flow (Checklists + Annotations + Questions)

**Date:** 2026-04-24
**Status:** accepted

**Context.** Prior scoping had two content types — annotations + open questions. The Figma-reference audit surfaced a third: pre-visit checklists (bring blood work, pill bottles, etc.).

**Decision.** **Three content types** in Prepare-for-Visit: Checklists (for Sonakshi, in-app only), Annotations (inline on the report), Questions (dedicated "Questions from Sonakshi" section in the PDF). Checklists do NOT render on the doctor-facing PDF.

**Consequences.** Checklist generation can partially auto-seed from Journey state (recent blood test → suggest bring report). Annotations and Questions ship in the PDF as already scoped.

**Alternatives considered.** Two-part (original). Rejected — missed a real pre-visit need.

---

## ADR-014 — Graduated feedback: visual early, verbal later

**Date:** 2026-04-24
**Status:** accepted

**Context.** Day 1 Sonakshi is motivated; by day 14 she's deciding whether the app is worth her morning. The app needs to reflect her logging immediately (visual) but can't claim correlations on thin data (verbal insights would be dishonest).

**Decision.** **Graduated feedback over four timescales.** Days 1–14: visual reflection only (streak bar, week rings, activity feed). Day 14+: verbal insight cards + populated Patterns view, conditional on data density per insight type. No push notifications in MVP — pull model only.

**Consequences.** App feels alive from Day 1 without over-claiming. Retention hook lands around day 14. Pattern engine must enforce minimum-sample thresholds.

**Alternatives considered.**
- Early verbal (rejected — false positives damage trust).
- Late visual + verbal together (rejected — empty-feeling first two weeks).

---

## ADR-015 — Edge-case template: dedicated screens, never inline banners

**Date:** 2026-04-24
**Status:** accepted

**Context.** Error states are where a friend-app most proves its character. Inline red banners are easy to miss and easier to mistrust.

**Decision.** **Every edge state gets a dedicated full-screen template** (illustration + title + body + primary CTA + secondary link + bottom nav preserved). Five MVP states: connection error, voice transcription failed, save failed, offline mode, empty Journey.

**Consequences.** More screens to design, but consistent UX. Bottom nav preservation means no dead ends — she can always tap out.

**Alternatives considered.** Inline banners (rejected per rationale above).

---

## ADR-016 — Documentation discipline: scoping + backlog + ADRs + changelog from day 1

**Date:** 2026-04-24
**Status:** accepted

**Context.** MVP scope decisions get lost between sessions without structured documentation. Retroactively reconstructing "why did we decide X" is costly and error-prone.

**Decision.** Maintain **four living documents** from project start:
1. `scoping.md` — current in-scope feature definitions
2. `post-mvp-backlog.md` — deferred items with reasoning + post-MVP shape
3. `architecture-decisions.md` — this file, append-only ADRs
4. `architecture-changelog.md` — every change to any ADR gets a dated entry
5. `build-log.md` — per-session chronicle (existing convention)

**Consequences.** Slight overhead each session to update docs. Large benefit at build time: context is always recoverable. Also enables onboarding a collaborator or returning after a long break without re-deriving decisions.

**Alternatives considered.** Just scoping.md + build-log.md (rejected — doesn't capture the "why" behind decisions that are settled and out of active scope).

---

## ADR-017 — Voice-first architecture: Web PWA for MVP, native iOS/Android post-MVP

**Date:** 2026-04-24
**Status:** accepted

**Context.** Saha is a voice-first app. That creates tension with the playbook's default stack (Next.js web). Native mobile gives a first-class mic experience but adds an app-store review layer and slows the MVP; web ships same-day but has weaker mic UX on mobile browsers. Sonakshi uses the app primarily on her phone.

**Decision.** **MVP ships as a web app** (Next.js 16, mobile-first responsive, installable as a PWA). Voice capture via browser APIs (Web Speech API fallback; OpenAI Realtime / Vapi as the primary voice provider behind a provider interface). **Native iOS and Android apps are a post-MVP follow-on** — they wrap the same Convex backend and voice provider, so the core schema and business logic don't change between the two surfaces.

**Consequences.**
- Pros: MVP deliverable is web — fastest path to a live URL on Vercel. PWA installability gives Sonakshi a "home screen app" feel without the app-store gate. Native apps later reuse the Convex schema + voice provider abstraction with no backend rework.
- Cons: Mobile browser mic UX is passable, not great — iOS Safari in particular requires a user gesture to start mic capture, and background audio capture is not permitted. We accept this for MVP.
- Architectural implication: the voice layer is abstracted behind a provider interface from day one, so swapping Web Speech → OpenAI Realtime → a native mic bridge later is a config change, not a refactor.

**Alternatives considered.**
- **Native mobile (Expo / React Native)** — rejected for MVP: app-store review timeline doesn't clear the MVP launch window.
- **Web-only, no PWA** — rejected: losing the home-screen-app feel hurts habit formation for a daily check-in app.
- **React Native Web (shared codebase day 1)** — rejected for MVP: shared codebase is tempting but slows the MVP; simpler to ship web-only now and re-use backend + voice abstraction when native apps come later.

---

## ADR-018 — Voice provider for MVP: Web Speech only; Sarvam AI deferred post-MVP

> **Superseded by [ADR-026](#adr-026--voice-provider-for-production-sarvam-ai-streaming-stt--tts--multi-turn-dialog) as of 2026-04-26.** Body retained as the point-in-time rationale for the deferral.

**Date:** 2026-04-25
**Status:** superseded by ADR-026

**Context.** Earlier scoping flagged Sarvam AI (`saarika:v2.5` / `saaras:v3`) as the multilingual voice path (12–23 Indic languages including `en-IN`). REST contract was confirmed but the streaming endpoint URL was not located, API-key handling was unscoped, and no server-side proxy path was designed. Building Sarvam now would expand F01 C2 scope and pull schedule into voice provider work that the MVP feature set doesn't strictly require.

**Decision.** **Sarvam AI swap is deferred post-MVP.** Web Speech remains the active voice provider through MVP launch. `OpenAIRealtimeAdapter` stub is retained as the existing post-MVP placeholder; Sarvam adapter joins the same provider-interface seam later.

**Consequences.**
- Pros: F01 C2 ships against the already-shipped `WebSpeechAdapter` with no new provider work. Schedule clear.
- Cons: MVP voice quality is constrained by browser STT (especially weaker on iOS Safari, accented English). We accept this for the MVP test pool.
- The provider-interface seam (`lib/voice/provider.ts`) means swapping Sarvam in later is a config change, not a refactor — the cost of deferring is small.

**Alternatives considered.** Building Sarvam adapter alongside F01 C2. Rejected: scope creep + 3 unresolved scoping questions blocking implementation.

---

## ADR-019 — Authentication lands with F02 work, not F01 Cycle 2

**Date:** 2026-04-25
**Status:** accepted

**Context.** F01 C1 shipped with `userId` accepted as a client-trusted argument on `createCheckin` / `listCheckins` / `getCheckin`. The original plan (memory note + comment at `convex/checkIns.ts:206-210`) was to enforce auth in F01 C2 chunk 1.F. Sequencing review surfaced that the natural seam for auth is when Memory enters — Memory's tier-aware paywall query (US-2.A.1) already needs to read user state, and adding auth at that point is structurally cheaper than retrofitting it mid-F01 C2.

**Decision.** **Auth introduction moves out of F01 Cycle 2 and into F02 work** (likely as a new pre-cycle chunk 2.0 or as a parallel lane during F02 C1). F01 C2 ships chunks 1.D / 1.E / 1.F (extract-metrics, scripted fallback, confirmation/save) with `userId` continuing as a client-trusted arg. When auth lands, it updates mutation/query handlers to read `ctx.auth.getUserIdentity()` and drops the `userId` arg in the same patch.

**Consequences.**
- Pros: F01 C2 stays focused on the conversation flow without an auth detour. F02 starts with a security primitive that all downstream features inherit.
- Cons: F01 C2 ships with a known auth-trust gap. Mitigated by: dev-only deployment, no production users yet, single-test-user mode. Production launch is gated on F02 shipping with auth enforced.
- F01 feature MD chunk list is now: 1.A/1.B/1.C (shipped) + 1.D/1.E/1.F (C2). The "1.F = auth" shorthand in earlier memory notes is retired.

**Alternatives considered.** Keeping auth in F01 C2. Rejected: doubles C2's surface area; auth without Memory has nowhere to demonstrate tier gating. Auth before F01 C2. Rejected: blocks the conversation-flow work that's already plan-locked.

---

## ADR-020 — Metric extraction via Vercel AI Gateway + AI SDK from Next.js

**Date:** 2026-04-25
**Status:** accepted

**Context.** F01 chunk 1.D (`extractMetrics`) needs an LLM call that takes a free-form transcript and emits structured JSON for the 5 required metrics (US-1.D.1). Three placement options were on the table: (A) Convex action, (B) Next.js Route Handler / Server Action with a direct provider SDK, (C) Vercel AI Gateway via the Vercel AI SDK from Next.js. Saha will need an LLM call in at least three places over the MVP roadmap — F01 metric extraction, F03 Patterns insights past 14 days, F06 Doctor Report narrative.

**Decision.** **Option C: Vercel AI Gateway via the Vercel AI SDK, called from Next.js server-side handlers.**
- **Default model:** `gpt-4o-mini` (reliable JSON-mode, ~50–100ms latency, ≈ $0.0001 per check-in).
- **Routing:** Gateway sits between Next.js and the model provider — single API key (`AI_GATEWAY_API_KEY`), provider failover for free, cost tracking and observability built in.
- **Cost guards (universal, regardless of model):** transcript truncated at 2000 input tokens; output capped at 200 tokens; per-user-per-day attempt counter in Convex with a hard ceiling on retries within the same calendar day.
- **Server-side only.** API key never reaches the client. Convex action remains an option for callers that want a single-round-trip path; for now Next.js handler is the default.

**Consequences.**
- Pros: One Gateway billing/observability surface for F01, F03, F06 LLM work. Provider-agnostic — model swap is a config change. AI SDK fits the Next.js + Vercel stack already locked by ADR-002.
- Cons: Small Gateway markup over direct provider pricing. Two network hops (client → Next.js → Gateway → provider) vs. one for the Convex-action path; acceptable given p50 budget of 3s in US-1.D.1.
- Cost-guard counter requires a small Convex doc per (userId, date) — built alongside `extractMetrics` in chunk 1.D.

**Alternatives considered.**
- **Option A (Convex action).** Rejected: Saha will set up Gateway anyway for F03 / F06; running two LLM call paths increases ops surface.
- **Option B (Next.js + direct OpenAI / Anthropic SDK).** Rejected: forfeits Gateway's failover, observability, and single-key model.

**Amendment 2026-04-30 (F04 C1 fix-pass).** Dev/preview cap raised to 50 to support smoke replay (`process.env.NODE_ENV === 'production' ? 5 : 50` in `convex/extractAttempts.ts`). Production cap unchanged at 5. Rationale: post-MVP backlog item 22.4 — smoke testing was being interrupted by the cap during integration. Production behaviour and ADR-020's hard ceiling are unchanged.

---

## ADR-021 — `stage` enum semantics for `checkIns` records

**Date:** 2026-04-25
**Status:** accepted

**Context.** `checkIns.stage` is `v.union(v.literal("open"), v.literal("scripted"), v.literal("hybrid"))` per shipped C1 schema. The three values were locked at schema time without a written contract for when each is written. Without a contract, F01 C2 (which writes `stage`) and F03 / F08 (which read it for analytics on open-first sufficiency per ADR-005) can drift.

**Decision.** **Lock the following definitions:**

| Value | Means | Written when |
|---|---|---|
| `"open"` | User spoke freely; coverage check found all 5 metrics in the transcript. Stage 2 was skipped per ADR-005. | Open transcript → `extractMetrics` → `coverage(metrics).missing.length === 0`. |
| `"hybrid"` | User spoke freely; some metrics extracted from transcript; remaining metrics filled via Stage 2 (voice or tap). | Open transcript → coverage gap → user answers remaining via `<ScriptedPrompt>` / `<TapInput>`. |
| `"scripted"` | User did not produce a usable transcript (voice failed, permission denied, or chose tap-only). All 5 metrics came from Stage 2 tap inputs. | No usable transcript; everything via `<TapInput>`. |

**Consequences.**
- ADR-005's success metric becomes computable: open-first sufficiency rate = `count(open) / count(open + hybrid)`. If <50% after seed users, the open-first prompt or `coverage()` predicate needs work.
- F01 C2 chunk 1.D / 1.E / 1.F sets `stage` per the table; reviewers check this contract during the C2 review pass.
- Future enum expansion (e.g. a `"voice-failed-recovery"` substate) requires a new ADR + Convex schema migration.

**Alternatives considered.** Leaving the enum semantically ambiguous and inferring from other fields. Rejected: turns `stage` into dead metadata and forces every analytics query to re-derive the bucket.

---

## ADR-022 — Save-later queue with localStorage backstop

**Date:** 2026-04-25
**Status:** accepted

**Context.** US-1.F.2 specifies that on save failure (network / mutation error), the user can choose "save later" — the check-in queues for retry. Original spec said "in-memory for this session," meaning a tab close loses the queued check-in. For a daily habit app where the user may have spent 60s recording a transcript, losing that on tab close is a meaningful trust failure.

**Decision.** **Save-later queue persists to `localStorage`** (not just in-memory). On save failure:
1. Check-in payload (validated metrics + transcript + `clientRequestId`) is written to `localStorage` under a versioned key (e.g. `saha.saveLater.v1`).
2. UI offers retry now or "keep this for later."
3. On next app load (or on regaining network), a background hook reads the queue and retries each entry via `createCheckin`. Idempotency is already handled via `clientRequestId` (ADR not needed — shipped behavior at `convex/checkIns.ts:122-130`).
4. Successful retries clear their entry; failures stay in the queue.

**Consequences.**
- Pros: Tab close, browser crash, or going offline mid-save no longer loses the check-in. Retry-on-reload is invisible to the user. Idempotent server contract means no duplicate-write risk.
- Cons: localStorage is per-browser/per-device; a user who recorded on phone Safari and then opens desktop Chrome won't see the queued retry. Acceptable for MVP.
- Schema: no new fields. The queued payload uses existing `CreateCheckinArgs` shape.
- Versioned key (`v1`) means future format changes can co-exist without breaking old queue entries — bump to `v2` and migrate or drop.

**Alternatives considered.**
- **In-memory only** (original spec). Rejected per rationale above.
- **Server-side outbox table.** Rejected: requires auth (which is moving to F02) and adds Convex schema surface; localStorage achieves 95% of the value at zero schema cost.

---

## ADR-023 — Post-save confirmation route: stable `/check-in/saved` anchor

**Date:** 2026-04-25
**Status:** accepted

**Context.** After `createCheckin` succeeds, US-1.F.2 specifies a brief confirmation followed by routing to "home." But "home" is unstable through the MVP: F02 introduces Memory, F08 introduces Journey, and the natural post-save destination changes as features land. A direct route from save → `/memory` would force re-architecture each cycle.

**Decision.** **Introduce `/check-in/saved` as a stable terminal screen.** The screen itself never changes; only what's behind its CTAs evolves.

| Phase | Screen | CTAs / behavior |
|---|---|---|
| **F01 C2 ships, F02 not yet** | Settled-orb success + "Got it. See you tomorrow, Saha's here." Auto-dismiss to `/` after 2s. | "View memory" CTA hidden. Home `/` shows static "You checked in today." |
| **After F02 C1** | Same screen. | "View memory" CTA enabled → `/memory`. Home shows status + tappable card. |
| **After F08 (Journey)** | Same screen. | "View memory" → `/journey/memory` per scoping doc structure. Home gains wellness ring + streak bar. |

**Consequences.**
- Pros: Save flow never has to know which downstream features exist. CTA visibility is a feature-flag check, not a route change. F01 C2 ships a complete post-save UX without depending on F02.
- Cons: One extra route in the app (low cost). The auto-dismiss timing (2s) needs validation in F01 C2 review pass.

**Alternatives considered.**
- **Direct route to `/` (home) and let home render appropriately.** Rejected: home is a multi-purpose surface that gets aggregated content over time; bouncing the user there immediately after save loses the "your check-in landed" moment.
- **Direct route to Memory.** Rejected: Memory doesn't exist yet, and even after F02 it's the wrong default (post-save is about "today is logged," not about "browse past").

---

## ADR-024 — Product rename: Sakhi → Saumya

> **Superseded by [ADR-025](#adr-025--product-rename-saumya--saha) as of 2026-04-25.**

**Date:** 2026-04-25
**Status:** superseded by ADR-025

**Context.** Pre-launch rebrand. The earlier name *Sakhi* (Hindi for "friend") leaned on a literal label for the product's relational stance. *Saumya* (Sanskrit सौम्य — gentle, soft, calm, kind) describes the *quality* of the companion rather than the relationship category, and reads better as a unisex consumer brand across Indian and international markets.

**Decision.** Rename the product to **Saumya** everywhere — launch page, app code, package metadata, active docs (scoping, build-plan, system-map, product-taxonomy, tech-stack, features, post-MVP backlog, README, CLAUDE), prior ADRs, build-log, architecture-changelog, the planned `localStorage` save-later key (`saumya.saveLater.v1`, not yet shipped), and the Vercel project (renamed to `saumya-health-companion`).

**Exception to ADR immutability rule.** This file's preamble states ADRs are never edited. A one-time exception is taken here: ADR-001 through ADR-023 had their *Sakhi* product references replaced with *Saumya*. The decisions themselves are unchanged — only the product noun is updated. The exception is bounded: future content changes to a recorded ADR continue to require a new superseding ADR.

**Consequences.**
- Pros: Single brand across the entire codebase. Tone of voice ("gentle presence") is now embedded in the name itself. After-note line on the waitlist CTA does the meaning lift in one sentence. Vercel project + URL aligned.
- Cons: One-time edit to nominally append-only files. Existing global memory entries that describe past sessions may still read *Sakhi* — those are outside this repo and acceptable.
- Old `sakhi-health-companion.vercel.app` aliases still resolve (Vercel preserves them on rename) so existing links don't break. Removing them is a separate decision.

**Alternatives considered.**
- **Keep *Sakhi* and tighten the tagline.** Rejected: the friend framing was working, but locked the brand into a single relational frame; *Saumya* is broader and reads as a name first.
- **Soft-launch the new name post-MVP.** Rejected: pre-launch (no public users yet) is the cheapest possible moment to do this — every week later compounds the cost.
- **Preserve historical ADR text with original *Sakhi* references.** Initial draft of this ADR took this position. Rejected on Rewant's directive: full transformation reads cleaner for any future contributor and the decision content (not the noun) is what the immutability rule is meant to protect.

---

## ADR-025 — Product rename: Saumya → Saha

**Date:** 2026-04-25
**Status:** accepted

**Context.** *Saumya* (सौम्य — gentle, soft, calm, kind) was adopted in ADR-024 the same morning to replace *Sakhi*. After living with the name for a few hours of build, the gentleness framing started to feel like it *softened* the disease — autoimmune is not gentle on patients. The honest verb the product should embody is **endurance**: what autoimmune actually asks of the people who live with it. Sanskrit सह carries that meaning (*to bear, to be equal to*) and, unusually, also means *with* (the preposition). Two meanings, one word: endurance + together. That's the relational stance the product takes — Saha holds the days you can't, and walks beside the days you can.

**Decision.** Rename the product to **Saha** (सह) everywhere ADR-024 renamed it to *Saumya*: launch page (with the "endurance + together" Option B copy as the canonical brand-meaning block), app code, package metadata, active docs (scoping, build-plan, system-map, product-taxonomy, tech-stack, features, post-MVP backlog, README, CLAUDE), build-log, architecture-changelog, the `localStorage` save-later key (`saha.saveLater.v1` — not yet shipped, no migration), the TTS-disabled key (`saha.ttsDisabled` — same), the test-user key (`saha.testUser.v1` — same), the rules-engine directory (`lib/saumya/` → `lib/saha/`), and the Vercel project (renamed to `saha-health-companion`). Old hosts (`saumya-*`, `sakhi-*`, `autoimmune-*`) are 308-permanent-redirected to `saha-health-companion.vercel.app` via the Next.js proxy (`proxy.ts`, the renamed-from-middleware file convention in Next 16) so existing shared links land on the canonical host with their path preserved.

**Exception to ADR immutability rule (extension).** ADR-024 already took a one-time exception to overwrite *Sakhi* references in ADR-001 through ADR-023. ADR-025 extends that exception in two narrow ways:
- ADR-024 receives a **superseded-by** header pointing at this ADR. The body of ADR-024 is otherwise untouched and reads as the historical record of the prior rename.
- Active references to the brand in ADR-001 through ADR-023 are updated *Saumya → Saha*. The decisions themselves are unchanged; only the product noun is updated.

The exception remains bounded: future content changes to any recorded ADR still require a new superseding ADR.

**Consequences.**
- Pros: Brand reads honest about what autoimmune is. Sanskrit सह's two meanings (*endurance* + *with*) carry both the patient-facing and the support-system-facing halves of the product in one word, with no extra explanation needed in copy. Redirect proxy preserves every old link, so no inbound traffic is lost.
- Cons: Second rename in two days; signals brand instability if it happened post-launch. Pre-launch keeps the cost contained to docs + memory churn. Devanagari literacy: सह is less commonly recognized than सौम्य outside Sanskrit/Hindi readers — copy carries the meaning gloss to compensate.
- No data migration: pre-launch, zero users, all `localStorage` keys ship under the new prefix from day one.

**Alternatives considered.**
- **Sanskrit "with" only (e.g. *Saath*, *Saha* as just *with*).** Rejected as a concept (the word still works as the product name): "with" alone is warm but doesn't honor what autoimmune actually demands. The point isn't just companionship — it's enduring something hard, together.
- **Hindi *Sahna* / endurance-only framing.** Rejected: *Sahna* is the verb form ("to bear, to endure") and reads more clinical / weighty than सह; also loses the "with" half of the meaning entirely. Saha keeps both meanings live in one syllable.
- **Hold the *Saumya* name and adjust copy to lean into resilience instead.** Rejected: copy can't fix a name that softens the experience. The name is the load-bearing word; better to swap once now than to keep over-explaining the gentleness.

## ADR-026 — Voice provider for production: Sarvam AI streaming (STT + TTS) + multi-turn dialog

**Date:** 2026-04-26
**Status:** accepted (supersedes ADR-018 on the deferral)

**Context.** ADR-018 deferred Sarvam to post-MVP. Three blockers were resolved 2026-04-25: `sarvamai` JS SDK abstracts streaming WebSocket; long-lived `api-subscription-key` server-only; Vercel HTTP-streaming + SSE for STT partials and Vercel streaming `Response` for TTS audio. In the same conversation Rewant chose Option B + B3 from the dialog scoping menu — multi-turn voice with a "Switch to taps" bail-out.

**Decision.** Sarvam AI is the production voice provider for both STT and TTS. `WebSpeechAdapter` (STT) and `web-speech-tts-adapter.ts` (TTS) remain as dev/test fallbacks. New files:
- `lib/voice/sarvam-adapter.ts` (STT client, `VoiceProvider`).
- `app/api/transcribe/route.ts` (Vercel Fluid Compute STT proxy).
- `lib/voice/sarvam-tts-adapter.ts` (TTS client, new `TtsProvider`).
- `app/api/speak/route.ts` (TTS audio proxy).
- `lib/saha/follow-up-engine.ts` + `follow-up-variants.ts` (per-metric question + re-ask + decline-acknowledgement copy).

Resolvers picked by env: `VOICE_PROVIDER=sarvam` (STT), `VOICE_TTS_PROVIDER=sarvam` (TTS). Multi-turn dialog drives via 5 new states + 7 new events on the existing check-in state machine. Bail-to-taps from any voice state lands in the existing Stage 2 grid with partial metrics preserved; cycle-1 makes that path forward-only.

**Consequences.**
- Pros: live partials match the existing UX; multilingual readiness is now a config change (Hindi-next via `language_code`); key never reaches the browser; conversational flow turns into a real product differentiator vs the plain transcribe-and-tap shape of C2.
- Cons: dialog flow adds ~300 lines of state-machine + page wiring. Cost + latency budget per metric (TTS + STT + extract) is ~3–5s, multiplied by up to 5 missing metrics ⇒ worst-case ~25s of dialog after the freeform turn. Acceptable for MVP; revisit with telemetry.
- Two-deploy-target risk avoided — everything stays on Vercel.

**Alternatives considered.**
- Browser-direct with ephemeral tokens: rejected — Sarvam doesn't expose ephemeral tokens.
- Separate WebSocket service on Render/Fly: rejected — second deploy + monitoring + bill.
- REST batch (no streaming): rejected — kills live partials.
- Option B1 (no taps during dialog): rejected — punishing on iOS Safari STT failures.
- Option B2 (Stage 2 visible during dialog): rejected — two input paths racing each other is messy.
- Option C (full duplex / barge-in): out of scope for cycle 1.

**Supersedes:** ADR-018 on the deferral. ADR-018 stays in the record as the point-in-time rationale; ADR-026 is the active decision.

## ADR-027 — Voice C1 fix-pass: streaming-with-buffered-fallback upload + client-side silence VAD + state-machine-driven cold greeting

**Date:** 2026-04-27
**Status:** Accepted

**Context.** Voice C1 shipped end-to-end on a Vercel preview but failed two smoke checks: (1) the opener "How are you feeling today?" never auto-played on `/check-in` mount, and (2) live word-by-word transcript dictation never appeared on either local dev or the deployed preview. Tracing both bugs revealed pre-existing structural issues, not regressions:

- The state machine's `speaking-opener` state was gated on `TAP_ORB → requesting-permission → PERMISSION_GRANTED`, so on cold mount the opener TTS never fired without an orb tap.
- A prior commit had switched `SarvamAdapter` from streaming POST to buffered-POST-on-stop because Chrome rejects streaming request bodies on HTTP/1.1 (the `next dev` default). The buffered path POSTs the entire audio blob in one shot at `stop()`, so SSE `partial` frames are never received during recording — the `partials: true` capability flag was a lie.
- The recorder had no client-side voice-activity detection, so the only path to `stop()` was a second orb tap. Users didn't reliably discover this. The `vad: true` capability was also a lie.
- After `stop()`, the transcript flowed straight into metric extraction with no intermediate "I heard …" feedback frame.

**Decision.** Six structural fixes, shipped as a single fix-pass on `feat/voice-sarvam`:

1. **Streaming-with-buffered-fallback upload.** `SarvamAdapter` gains a `streamingMode: 'auto' | 'streaming' | 'buffered'` option. `'auto'` (default) selects streaming on HTTPS (`window.location.protocol === 'https:'`) and buffered otherwise. Streaming opens a `TransformStream`, fires `fetch(..., { body: stream, duplex: 'half' })` synchronously in `start()`, pipes recorder chunks to the writer as they arrive, and closes the writer on `stop()`. Buffered keeps the prior concat-and-POST-on-stop behaviour so local `next dev` (HTTP/1.1) still smoke-tests the data path. **Trade-off: live partials only fire on Vercel deploys.** Tests default to buffered (jsdom http: protocol) so the existing 26-test contract is preserved; new `tests/voice/sarvam-adapter-streaming.test.ts` pins the streaming mode explicitly.

2. **Client-side silence VAD.** `SarvamRecorder` exposes `onSilenceDetected(cb)` and tracks RMS over each emitted PCM chunk. Once a chunk exceeds `SPEECH_RMS_THRESHOLD = 0.02` the recorder begins counting consecutive chunks below `SILENCE_RMS_THRESHOLD = 0.01`; at `SILENCE_TRAILING_CHUNKS = 6` (1.5s at 250ms cadence) the listener fires once. Asymmetric thresholds avoid borderline-energy chunks bouncing the state. `SarvamAdapter` wires this to its own `stop()` so the user doesn't need a second tap.

3. **State-machine-driven cold greeting.** Two new states added: `idle-greeting` (TTS playing, no mic) and `idle-ready` (post-greeting, awaiting orb tap). Three new events: `START_GREETING`, `GREETING_PLAYED`, `GREETING_FAILED`. The page dispatches `START_GREETING` on mount when `ttsAvailable && state.kind === 'idle' && openerSelection.text`. A `coldGreetingDispatchedRef` ensures it fires once per page lifetime. Cleanup cancels TTS on state transition. `TAP_ORB` from `idle-greeting` skips the remaining greeting and jumps to `requesting-permission`. The hook treats `idle`, `idle-greeting`, and `idle-ready` identically for `TAP_ORB` listening kickoff but only attaches an opener payload to `PERMISSION_GRANTED` when starting from cold `idle` (avoiding double-opener after a greeting was already heard).

4. **`SpokenOpener.autoSpeak` opt-out.** New optional prop (default `true`) lets the page suppress the component's internal auto-speak so the page-level greeting effect owns playback. Without this, mounting the component in `idle` would fire `tts.speak()` once, and the immediate `START_GREETING` dispatch would unmount it (running `tts.cancel()`) and the `idle-greeting` effect would speak again — wasteful and visibly stuttering.

5. **StopButton + heard-transcript echo.** New `<StopButton>` component (mirrors the `SwitchToTapsButton` pattern) renders during `listening` + `listening-answer` with a "Tap when done" affordance. `transientCopyFor()` now echoes `"I heard: '<transcript>'"` during `processing`, `extracting`, and `extracting-answer` so the user has visible feedback that their speech landed before extraction kicks in.

6. **Honest capability flags.** With (1) and (2) in place, `SarvamAdapter.capabilities = { partials: true, vad: true }` is now truthful end-to-end on Vercel deploys. Local dev (buffered) returns the same flags but partials simply don't fire — the page handles partials being absent fine.

**Consequences.**
- Pros: cold-mount voice greeting works (Bug 1 fixed); live word-by-word transcript renders on Vercel (Bug 2 fixed); silence auto-stop ends the chicken-and-egg "tap to start, tap to stop, but I never showed you the second tap" UX trap; the production capability flags don't lie.
- Cons: streaming/buffered split means live partials are gated on the deployment target. We lose live-partials in local dev; that's the price of the Chrome HTTP/1.1 streaming-body restriction. Documented; if it ever bites we ship `next dev --experimental-https` as the fix.
- Risks: silence VAD thresholds are tuned for headset-quality input; loud rooms may never auto-stop. The visible Stop button is the safety net. Real-world tuning will likely need a follow-up.

**Alternatives considered.**
- Server-side VAD only (Sarvam's own VAD signal): blocked — there's no live socket for the server to send the signal back over. Buffered mode means a single upload-then-process round-trip with no intermediate signalling.
- Auto-play opener as a one-tap-to-greet button: rejected for v1 — a passive cold-mount greeting is the desired UX. The button-fallback pattern is documented as a backup if browser autoplay blocks fire too often during real-world testing.
- Re-using `speaking-opener` for cold mount: rejected — `speaking-opener` is gated on permission grant by design (the dialog version follows a `PERMISSION_GRANTED(opener)` payload). Decoupling cold greeting from permission is exactly the bug we're fixing.

**Supersedes / amends:** none. ADR-026 stays the source of truth for the voice provider choice; ADR-027 documents the implementation refinements that made C1 actually work end-to-end.

## ADR-028 — Voice C1 STT transport: pivot from Sarvam streaming WS to REST batch

**Date:** 2026-04-28
**Status:** Accepted

**Context.** Bug 1 — every voice check-in returned `{ type:"final", text:"", durationMs:~260 }` with no partial frames. Two earlier fix attempts failed:
- **Option A (codec swap, `pcm_s16le`)** — Sarvam's SDK accepts the value but silently fails to decode raw PCM bytes. Same empty-final.
- **Option B (prepend a 44-byte WAV header so the bytes are a real WAV file)** — same symptom. The HAR shows `final.bytes ≈ 696 KB` (~22 s of audio at 16 kHz mono 16-bit) but `text=""`. Recorder validation (objective Node.js analysis of the captured WAV) confirms the audio is fine: valid header, RMS=0.041, peak=0.31, real voice activity, no clipping/DC offset. The audio is good; the protocol path is the bug.

Walking the SDK source confirmed the root cause: Sarvam's streaming WS is **VAD-segmented**. The `flush_signal=true` query param is required for `socket.flush()` to actually trigger a final transcript; the SDK type system does not surface it. `transcribe()` enqueues an audio frame, but without `flush_signal=true` the server waits for VAD-detected silence to emit anything. Our adapter buffers the entire utterance client-side and POSTs it as one frame in <50 ms, so VAD never trips. We then force-close the socket 250 ms later and Sarvam emits zero events. The streaming WS protocol is designed for real-time mic capture with continuous segmentation; our usage pattern is buffered upload, which is exactly what REST batch is for.

**Decision.** Rip out the streaming-WS path and replace it with Sarvam's REST batch endpoint (`POST https://api.sarvam.ai/speech-to-text`, multipart form-data). New module `lib/voice/sarvam-stt-rest.ts` (`transcribeBatch`) does a thin direct `fetch` + `FormData` (file + model + mode + language_code) — no SDK indirection. The route (`app/api/transcribe/route.ts`) buffers the request body, calls `transcribeBatch`, and emits **one** SSE `final` frame back to the browser. The SSE wire shape is preserved for the adapter (still parses `data: {…}` envelopes) but no `partial` frames are ever emitted — REST batch is synchronous, so partials are conceptually impossible. Caps tightened: 1 MB / 30 s (down from 5 MB / 90 s) to match Sarvam's REST batch limits. WS module + tests deleted.

**Consequences.**
- Pros: Bug 1 closes (REST batch returns the transcript synchronously — no VAD/flush/timing race possible). Wire shape stable for the adapter (no client changes required). Fewer moving parts: one HTTP round-trip vs WebSocket connect → audio frames → flush → close → events. No more `flush_signal` / `vad_signals` query-param archaeology in our code.
- Cons: live word-by-word partials are gone. ADR-027 had restored partials on Vercel HTTPS via streaming POST → streaming WS; that path is also removed here because it shared the same broken upstream. The check-in UX falls back to "show transcript on stop()" which is what local dev already had.
- Risks: Sarvam's REST batch has a 30 s cap. Long check-ins past the cap surface as `voice.session_too_long`; ADR-027's silence VAD already triggers `stop()` well before that, so this is theoretical.

**Alternatives considered.**
- **Keep streaming WS, add `flush_signal=true` and `vad_signals=true` query params** — would likely close Bug 1 too, but keeps a streaming-segmentation protocol for a buffered-upload usage pattern. Two-way VAD signalling is over-engineering for "user finished talking, transcribe this one blob."
- **Keep streaming WS, switch to chunked transcribe (split the buffered audio into N small `transcribe()` calls)** — H2 in the bug-1 history. Closer to Sarvam's intended usage but still requires `flush_signal=true`, fragile chunk-boundary assumptions, and three more sources of timing risk.
- **Sarvam SDK's `Uploadable` REST helper** — adds an indirection awkward for a `Uint8Array` payload inside a Next.js route. Direct `fetch` + `FormData` is fewer moving parts and easier to test (single `fetchImpl` injection point).

**Supersedes / amends:** ADR-026 still defines the provider choice (Sarvam STT). ADR-027 stays the record of the streaming-with-buffered-fallback adapter shape; the **upload transport** that ADR described is replaced by REST batch as of this ADR. The SarvamRecorder + silence VAD + state-machine cold greeting from ADR-027 are unchanged — only the server-side transport flips.

## ADR-029 — Onboarding DOB: optional, month + year only (Profile schema v1 → v2)

**Status.** Accepted (2026-04-29).

**Context.** The Setup B `/setup/dob` step shipped in the Onboarding Shell cycle as a hard-required Month/Day/Year date that gated forward progress through the four-step setup. Two problems surfaced in review of the live flow:
1. Friction. Asking patients with autoimmune disease for an exact birthdate up front (a) reads like a clinical intake form, not a companion onboarding, and (b) the day-precision adds nothing — the product surfaces patterns over months/years, never per-day cohort comparisons against birthday.
2. Incompleteness. Some users will share their birth year as a rough cohort marker but won't share the month. The old form had no representation for "year only."

**Decision.**
- DOB is now **optional** in the Setup B flow. `firstMissingSetupStep()` no longer returns `'dob'` even when both fields are null.
- The field captures **month and year only**. The day component is removed entirely.
- The persisted shape changes: `Profile.dobIso: string | null` (YYYY-MM-DD) is replaced by `Profile.dobMonth: number | null` (1–12) and `Profile.dobYear: number | null`.
- Valid combinations: `(null, null)` (unassigned) · `(null, year)` (year only) · `(month, year)` (both). The `(month, null)` "orphan-month" case is surfaced in the UI as an inline correction hint but **coerced to (null, null) on persist** — Next stays enabled so the field is never a wall, the orphan month stays visible in the dropdown so the user can correct (add a year) or clear (drop the month) without losing what they typed.
- Schema version bumps `1 → 2`. **No migrator** is added: `readProfile()` already drops payloads with a stale `v` (logs once, returns null). Pre-launch, the only v1 payloads in the wild are dev/test stubs; safe to drop.

**Consequences.**
- Pros: Less invasive onboarding; users who don't want to share DOB are no longer blocked. The (null, year) case is now expressible. The data model maps cleanly onto how DOB will actually be used (cohort patterns, not date-arithmetic).
- Cons: Anyone with a v1 `saha.profile.v1` localStorage payload will be treated as fresh on next visit and routed through Setup B again. Acceptable pre-launch.
- Risks: Future analytics or pattern surfaces that assume a full birthdate need to widen to the (month?, year?) shape. Touched today: only the Setup B redirect helper. None of the F01/F02 surfaces consume DOB yet.

**Alternatives considered.**
- **Keep `dobIso: string | null` and overload the format** (e.g. `"YYYY"` for year-only, `"YYYY-MM"` for both, `"YYYY-MM-DD"` retained for backwards-compat). Rejected: every consumer would need a length check before parsing, and we'd carry the day component forever even though we don't capture it anymore.
- **Block Next on orphan-month** (option B from the build plan). Rejected: turns an optional field back into a soft wall — the worst of both worlds.
- **Silently discard the orphan month on input change** (option A). Rejected: surprising; user would see the month dropdown reset itself.

**Supersedes / amends:** Amends the Onboarding Shell cycle plan (`docs/features/00-onboarding-shell-cycle-plan.md`) — the Setup.US-2 acceptance criteria are relaxed and the locked seam type is updated. No prior ADR is superseded.

## ADR-030 — Medications module shape: Hybrid (Option D), structured-form Cycle 1 + voice-first Cycle 2

**Status.** Accepted (2026-04-30).

**Context.** Scoping § Medications module locks the Hybrid (Option D) shape for the module overall — slow-changing regimen data lives in a dedicated module, daily adherence is captured via two parallel paths (home-page intake tap + voice check-in), and dosage changes are first-class events. The remaining open call is *how regimen entry happens in Cycle 1*. Two viable shapes:
1. **Voice-first wizard:** the user speaks her regimen, an LLM structures it into a pill list, she edits.
2. **Structured form:** the user fills name / dose / frequency / category / delivery as a typed form.

Voice-first is the long-term direction (matches the rest of the app's give/get covenant); but it adds an LLM extraction surface, a confirm-and-edit UI, and a fall-back-to-form path — all of which want their own iteration loop.

**Decision.** Cycle 1 ships **structured form entry** for regimen setup. Cycle 2 adds **voice-first** as an alternative entry mode (form remains the fallback). Adherence + dosage-change voice extraction still ships in Cycle 1 — the deferred bit is *only* the regimen-setup wizard, not voice in the Medications module overall.

**Cycle 1 mechanics (locked):**
- One-time setup wizard at `/medications/setup`, reachable from the Home setup-nudge slot. Form fields: name, dose, frequency, category (enum), delivery (enum). Submit appends one `medications` row with `isActive: true`.
- Add / edit / deactivate from `/medications` (the module landing). Deactivate is soft (`isActive: false` + `deactivatedAt: number`) — intake events and dose changes reference the row.
- Home `IntakeTapList` reads `getTodayAdherence(date)` — joins active medications with today's `intakeEvents`, returns the per-med taken/outstanding state.
- Voice check-in extracts simple-adherence ("took my meds"), partial-adherence ("skipped the steroid"), and dosage-change mentions. Dosage-change writes are gated by a confirm card during the summary step (per scoping § Daily voice check-in — medication mechanics).
- Dedupe: `logIntake` is idempotent on `clientRequestId`; the same-day cross-path race (home-tap then check-in) is collapsed in the handler — if any intake row exists for `(userId, medicationId, date)`, the second insert is a no-op that returns the existing id.

**Consequences.**
- Pros: Cycle 1 is one concrete UX (form + tap + voice extraction) instead of two competing entry surfaces. Voice extraction quality can be measured against the form-baseline once both ship. Smaller blast radius for the first prod ship.
- Cons: Setup feels less "Saha-like" until Cycle 2 lands — patients who self-identify as voice-first users hit a typed form on day one.
- Risks: Voice-first Cycle 2 is non-trivial (LLM regimen parser + confirm-and-edit + fallback); the deferral risks indefinite slip if the team never carves time. Mitigation: Cycle 2 sits in `docs/features/04-medications.md` § Cycle 2 plan with concrete chunk slots so it's pickable later.

**Alternatives considered.**
- **Voice-first now (Option 1).** Rejected: adds LLM extraction + confirm UI + fallback, all on top of a brand-new module. Larger first-ship surface, harder to review.
- **Structured form forever.** Rejected: drifts from the give/get covenant. Voice-first is the right end state.
- **Both modes in Cycle 1.** Rejected: doubles the scope of the first ship and the form path becomes vestigial during build.

**Supersedes / amends:** None. Refines scoping § Medications module → *One-time setup* by locking Cycle 1 to structured form.

## ADR-031 — Doctor visits + blood work as first-class timeline events (manual form + voice extraction)

**Status.** Accepted (2026-04-30).

**Context.** Scoping § Journey module → *Doctor-visit timeline* and § Lab-result tracking — MVP slice both promise that doctor visits and blood-work results are captured during the daily flow and surface as Memory timeline markers. The MVP-slice decision (2026-04-25, scoping.md) already locked structured marker capture (CRP / ESR / WBC / Hb + free-form) as in-MVP, with PDF/image attachment + OCR deferred (post-MVP backlog item 3). What remains open is *how* events are captured in Cycle 1 and *how* they render in Memory.

**Decision.** Both visits and blood-work are first-class events with **two capture paths**, mirroring the F04 Medications shape:
1. **Manual form** at `/visits/new` and `/blood-work/new`, reachable from a "Log a visit / blood work" affordance on `/journey/memory`. Visit form fields: date, doctorName, specialty (optional), visitType (consultation / follow-up / urgent / other), notes (optional). Blood-work form fields: date, markers[] (each: name, value, unit, refRangeLow?, refRangeHigh?), notes.
2. **Voice extraction during check-in**: a candidate event surfaced as an `EventConfirmCard` during the summary step. On confirm, the row is written with `source: "check-in"` and a `checkInId` link to the originating check-in.

**Memory rendering:** both event types extend `lib/memory/event-types.ts` (`eventFromVisit`, `eventFromBloodWork`) and render in the existing F02 Memory list with type-tagged pills (`APPOINTMENT`, `BLOOD WORK`) per the scoping § Home event feed pill convention.

**Soft-delete only.** Both tables use `deletedAt: number` for delete; matches the F01 checkIns convention. Hard delete is post-MVP (item 21 follow-on).

**Date-anchor resolution.** Voice-extracted events with relative phrases ("yesterday", "next Tuesday") resolve against the check-in's `date` field (device-local YYYY-MM-DD), so the extractor stays deterministic and timezone-stable. Absolute dates ("April 28") are accepted as-is.

**Consequences.**
- Pros: One data shape per event, two write paths — review-light. The Memory surface gains visible new event types without a Memory rewrite. The F06 Doctor Report's auto-window calculation (last visit → today) gets its anchor data immediately.
- Cons: Voice extraction false-positives are non-zero; the confirm card is the only safety net. The card must be skippable so a noisy check-in doesn't trap the user.
- Risks: Form-only users may never discover the voice-extraction path. Acceptable — both surfaces are equivalent; voice is a convenience.

**Alternatives considered.**
- **Voice-only capture** (no form). Rejected: a patient with a known clinic visit shouldn't need to wait for their next check-in to log it.
- **Form-only capture** (defer voice extraction to F05 C2). Rejected: misses the highest-leverage voice-flow win — the user already volunteers this data unprompted.
- **Combined visits + blood-work table.** Rejected: their structured shapes are different enough (markers array vs. notes string) that union types in Convex would cost more than they save.

**Supersedes / amends:** None. Refines scoping § Doctor-visit timeline + § Lab-result tracking — MVP slice with the locked Cycle 1 mechanics.

