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

**Decision.** **Hybrid: open-first, scripted-fallback.** Saumya opens with one warm question, listens, and only falls back to scripted probes for required metrics Sonakshi didn't cover in free-flow.

**Consequences.** Warm on good days (she talks freely), reliable on quiet days (Stage 2 fills the gaps). Increases NLP burden modestly — Saumya must extract required metrics from free-form speech in real time.

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

**Context.** The opener is the single most load-bearing line of copy. It sets whether Saumya feels like a friend or a tool.

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

**Decision.** **"Memory"** — makes the README tagline operative (*"Saumya means gentle — the presence that remembers with you"*). Used as a proper noun with possessive (*"your Memory"*). Section label inside Journey is *Memory*.

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

**Context.** Saumya is a voice-first app. That creates tension with the playbook's default stack (Next.js web). Native mobile gives a first-class mic experience but adds an app-store review layer and slows the MVP; web ships same-day but has weaker mic UX on mobile browsers. Sonakshi uses the app primarily on her phone.

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

**Date:** 2026-04-25
**Status:** accepted

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

**Context.** F01 chunk 1.D (`extractMetrics`) needs an LLM call that takes a free-form transcript and emits structured JSON for the 5 required metrics (US-1.D.1). Three placement options were on the table: (A) Convex action, (B) Next.js Route Handler / Server Action with a direct provider SDK, (C) Vercel AI Gateway via the Vercel AI SDK from Next.js. Saumya will need an LLM call in at least three places over the MVP roadmap — F01 metric extraction, F03 Patterns insights past 14 days, F06 Doctor Report narrative.

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
- **Option A (Convex action).** Rejected: Saumya will set up Gateway anyway for F03 / F06; running two LLM call paths increases ops surface.
- **Option B (Next.js + direct OpenAI / Anthropic SDK).** Rejected: forfeits Gateway's failover, observability, and single-key model.

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
1. Check-in payload (validated metrics + transcript + `clientRequestId`) is written to `localStorage` under a versioned key (e.g. `saumya.saveLater.v1`).
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
| **F01 C2 ships, F02 not yet** | Settled-orb success + "Got it. See you tomorrow, Saumya's here." Auto-dismiss to `/` after 2s. | "View memory" CTA hidden. Home `/` shows static "You checked in today." |
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

**Date:** 2026-04-25
**Status:** accepted

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
