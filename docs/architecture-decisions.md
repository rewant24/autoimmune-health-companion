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

**Decision.** **Hybrid: open-first, scripted-fallback.** Sakhi opens with one warm question, listens, and only falls back to scripted probes for required metrics Sonakshi didn't cover in free-flow.

**Consequences.** Warm on good days (she talks freely), reliable on quiet days (Stage 2 fills the gaps). Increases NLP burden modestly — Sakhi must extract required metrics from free-form speech in real time.

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

**Context.** The opener is the single most load-bearing line of copy. It sets whether Sakhi feels like a friend or a tool.

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

**Decision.** **"Memory"** — makes the README tagline operative (*"Sakhi means friend — the one who remembers with you"*). Used as a proper noun with possessive (*"your Memory"*). Section label inside Journey is *Memory*.

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

**Context.** Sakhi is a voice-first app. That creates tension with the playbook's default stack (Next.js web). Native mobile gives a first-class mic experience but adds an app-store review layer and slows the MVP; web ships same-day but has weaker mic UX on mobile browsers. Sonakshi uses the app primarily on her phone.

**Decision.** **MVP ships as a web app** (Next.js 16, mobile-first responsive, installable as a PWA). Voice capture via browser APIs (Web Speech API fallback; OpenAI Realtime / Vapi as the primary voice provider behind a provider interface). **Native iOS and Android apps are a post-MVP follow-on** — they wrap the same Convex backend and voice provider, so the core schema and business logic don't change between the two surfaces.

**Consequences.**
- Pros: MVP deliverable is web — fastest path to a live URL on Vercel. PWA installability gives Sonakshi a "home screen app" feel without the app-store gate. Native apps later reuse the Convex schema + voice provider abstraction with no backend rework.
- Cons: Mobile browser mic UX is passable, not great — iOS Safari in particular requires a user gesture to start mic capture, and background audio capture is not permitted. We accept this for MVP.
- Architectural implication: the voice layer is abstracted behind a provider interface from day one, so swapping Web Speech → OpenAI Realtime → a native mic bridge later is a config change, not a refactor.

**Alternatives considered.**
- **Native mobile (Expo / React Native)** — rejected for MVP: app-store review timeline doesn't clear the MVP launch window.
- **Web-only, no PWA** — rejected: losing the home-screen-app feel hurts habit formation for a daily check-in app.
- **React Native Web (shared codebase day 1)** — rejected for MVP: shared codebase is tempting but slows the MVP; simpler to ship web-only now and re-use backend + voice abstraction when native apps come later.
