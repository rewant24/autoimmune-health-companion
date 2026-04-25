# Autoimmune Health Companion (Saumya)

> **On session start, read these files first — in this order:**
> 1. `docs/scoping.md` — canonical product spec (Rewant-authored). Primary source of truth.
> 2. `docs/build-plan.md` — active build plan. Structure, conventions, feature breakdowns.
> 3. `docs/system-map.md` — current visual state: features, subagents, status.
> 4. `docs/product-taxonomy.md` — capability-level view of what Saumya does.
> 5. `docs/tech-stack.md` — current versions + upgrade rules.
> 6. If the user mentions a specific feature (e.g., "Check-in"), also read `docs/features/NN-slug.md`.
>
> These files are the working context for every conversation about this project. Do not skip step 1 — scoping.md is the authoritative spec and overrides any stale understanding. When scoping.md and any other doc conflict, scoping.md wins.
>
> **Also maintained continuously:** `docs/architecture-decisions.md` (ADRs, append-only), `docs/architecture-changelog.md` (dated changes), `docs/post-mvp-backlog.md` (deferred items), `docs/build-log.md` (session chronicle), `docs/features/*.md` (per-feature chunks + stories + acceptance).

## What this app does
Helps people living with autoimmune diseases log symptoms, pain, and medication daily — then surfaces patterns and correlations so patients can have better conversations with their doctors. Think of it as a personal health journal that thinks for you.

## Who it's for
- **Primary:** Patients with autoimmune diseases (e.g. arthritis, lupus) — managing variable symptoms and rotating medications
- **Secondary:** Members of the patient's support system (spouse / parent / adult child) who want a shared, patient-granted view of her condition
- **Tertiary:** Doctors who need longitudinal data at appointments, not just "how do you feel today"

## The core problem (from user research)
- Symptoms fluctuate constantly — "1 step back, 2 steps forward, 2 steps back, but 1 day forward"
- The standard 1-10 pain scale is meaningless on its own. Better framing: **pain = dysfunction level**
  - Minimal: can function but task completion is hard
  - Mid: pain present but can work a couple of hours
  - Extreme: couldn't get out of bed
- Patients can't explain their current state to doctors — it's too dynamic and changes daily
- Medical gaslighting is real — different doctors give different interpretations; data helps patients advocate for themselves
- Tracking feels like a chore — needs to be fast, low brain-effort, and give some positive feedback

## Key insights from research
- Blood tests happen every 2 weeks; doctor follow-ups every 3 months — data between visits is the gap
- Dosage changes constantly (e.g. 10 → 15 → 20 → 25mg over 3 months); this needs to be tracked
- Auto-immune conditions have direct correlations with: mental health, allergy flareups, diet, sleep, stress
- Emotions are often repressed — the app should not add to the burden
- Patients want a centralized place for all reports, progress, and trackers — not multiple apps
- Gamification and dopamine feedback loops matter — not just logging, but feeling progress
- Indian context: community and reducing loneliness around chronic illness is important

## What doctors ask at every visit
1. Morning stiffness — yes/no, duration
2. Pain scale — but framed as dysfunction (see above), not just a number
3. Medication adherence and side effects
4. New or worsening symptoms

## Core features to build (MVP)
1. **Daily check-in** — pain/dysfunction level, morning stiffness, mood, energy (fast, < 1 min)
2. **Medication log** — current meds, dosage, frequency; flag changes
3. **Symptom tracker** — log flareups, new symptoms, allergic reactions
4. **Correlation view** — simple chart showing pain vs medication vs mood over time
5. **Doctor report** — one-tap summary of the last 30 days to share at appointments

## Design principles
- Low friction — logging must take under 60 seconds
- No medical jargon in the UI — plain language only
- Positive reinforcement — celebrate streaks and improvements
- Privacy-first — health data is sensitive; no sharing without explicit user action

## Stack (TBD at scaffolding)
- Frontend: Next.js
- Database: Convex (real-time, good for time-series health logs)
- Deployment: Vercel
- Auth: GitHub (for MVP) → email/phone for real users later

## Project operating rules

### Shipping loop
- Start in Plan Mode: propose a plan, files to touch, and risk checks.
- Implement in small slices and run tests after each slice.
- Commit at stable points.

### Guardrails
- Never delete data or run destructive commands without asking.
- Prefer minimal diffs and reversible changes.
- This is a health app — never fabricate data, invent correlations, or make medical claims.

### Token efficiency
- Use subagents for token-heavy tasks (research, audits, refactors).
- Subagents must return short structured summaries.
