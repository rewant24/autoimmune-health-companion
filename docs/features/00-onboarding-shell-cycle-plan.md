# Onboarding Shell Cycle — Build Plan

> **For agentic workers:** This plan follows the **Project Process Playbook** (`~/.claude/projects/-Users-rewantprakash-1/memory/reference_project_process.md`) — parallel build subagents → parallel review subagents → fix → second pass → ship. Steps inside each chunk follow TDD inside the subagent.
>
> **Branch:** `feat/onboarding-shell` off `main` after `f01-c2/shipped` (and after the Saha rebrand sweep merges, if not already on `main`).
> **Created:** 2026-04-25 · **Owner:** orchestrator (Claude Code main)
> **POC status:** Not required — every screen is visual + localStorage; scoping is canonical for copy/structure already decided.

**Brand context (READ FIRST).** Project just rebranded **Saumya → Saha** (ADR-025, supersedes ADR-024). Brand framing locked as **Option B: "endurance + together"** — सह — Sanskrit, two meanings at once: *to endure* and *with*. This is a meaningful voice shift away from the prior "gentle / soft / calm / kind" Saumya framing. Some scoping copy (notably Onboarding Screen 2's headline *"A digital friend for the day-to-day…"* and possibly the Saha-first-person voice on Screens 4–5) was written under the gentleness framing and may need re-validation under the new brand. **Action:** Reviewer-1 must flag every locked copy line for Rewant to confirm it survives the rebrand voice; placeholder lines tagged `TODO(rewant-copy)` already get this scrutiny.

**Goal:** Make the live demo feel like a product, not a prototype. Build the entire first-time-user journey from `/` "Get started" → onboarding (5 screens) → setup (4 profile screens) → welcome → home page — every screen rendered, profile data persisted to `localStorage`. **No real auth, no real SMS, no real email send** — those land in the final Auth cycle. Bottom nav and home page are scaffolded so subsequent cycles slot work into a real product surface instead of an isolated `/check-in` route.

**Architecture:** 3 disjoint chunks owned by 3 subagents in **one wave** (no Wave 2). File ownership is disjoint by directory; integration is light because the surfaces are connected by route navigation only — no shared state machine, no schema migration. Pre-flight is minimal (baseline green check + plan tag).

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript 5 strict · Tailwind 4 · Vitest · existing design tokens from `app/globals.css` and `app/LandingPage.tsx` (Fraunces + Inter, sage palette, grain texture).

---

## Resume tags

| Tag | What's in the tree |
|---|---|
| `onboarding-shell/plan-saved` | This file committed. Nothing built. |
| `onboarding-shell/pre-flight-done` | Baseline green confirmed. No code changes. |
| `onboarding-shell/wave-1-integrated` | A/B/C merged. Tests + tsc + build green. Surfaces wired through. |
| `onboarding-shell/reviewed` | First-pass review findings collected (read-only). |
| `onboarding-shell/fixed` | Fix pass applied, all green. |
| `onboarding-shell/second-pass-clean` | Second reviewer returned clean. |
| `onboarding-shell/shipped` | Live on Vercel. Build-log + changelog updated. |

A phase entry is appended to `docs/build-log.md` at every tag.

---

## Context — what's shipped vs what this cycle adds

### Shipped today (post-rebrand sweep on `main`)
- `/` — marketing landing page (`app/LandingPage.tsx`, polished long-scroll). "Try the demo" footer link → `/check-in`. **Brand: Saha.**
- `/check-in` — F01 C1 + C2 voice check-in (orb, opener TTS, extraction, Stage 2, summary, save flow, milestone).
- `/check-in/saved` — post-save terminal route.
- `/journey/memory` — F02 C1 Memory tab (week scrubber, filter chips, day view).
- `/memory` → 307 → `/journey/memory`.
- `/privacy` — privacy page.
- localStorage keys already in use (post-rebrand): `saha.testUser.v1`, `saha.saveLater.v1`, `saha.ttsDisabled`.
- Live: `https://saha-health-companion.vercel.app/`.
- **No `/onboarding`, no `/setup`, no `/welcome`, no `/home`. No bottom nav anywhere.**

### What this cycle adds (scoping → chunk map)

| Scoping section | Surface | Chunk |
|---|---|---|
| § Onboarding (4–5 screens) | `/onboarding/[1-5]` (5 routes) | A |
| § Setup flow — Setup B (profile, 4 screens) | `/setup/{name,dob,email,condition}` (4 routes) | B |
| § Setup flow — welcome email + redirect | `/welcome` (visual only — no real send) | C |
| § Home page (greeting, check-in CTA, meds nudge, viz, mic, bottom nav) | `/home` | C |
| § Navigation — persistent bottom menu bar | `BottomNav` component (rendered on `/home` only this cycle) | C |
| Profile data persistence (localStorage stub) | `lib/profile/{types,storage}.ts` + tests | B |

### Out of scope (deferred)
- **Setup A (mobile verification, 2 screens)** — skipped per Q1 lock; Onboarding 5 → Setup B directly.
- **Real auth, real SMS, real email send** — final Auth cycle.
- **Real metric viz on home page** — placeholder card; F03 Patterns cycle owns the real one.
- **Bottom nav retrofit into `/check-in` and `/journey/memory`** — separate small follow-up polish cycle (per Q5).
- **`/journey` landing surface** — already in backlog; Journey pillar in nav routes to `/journey/memory` for now.
- **Medications setup, Visits, Community, Settings** — those nav pillars render disabled per Q6.
- **Onboarding 1 tagline + Screens 2/3 body copy + Setup B prompts + home greeting/nudge phrasing + welcome line wording** — Rewant fills these in `docs/scoping.md` when ready; cycle ships with placeholder copy that the second-pass reviewer flags for swap-out before tag.
- **Re-validation of previously-locked Onboarding 2–5 copy under the Saha brand voice** — flagged in Reviewer-1; Rewant decides whether each line ships as-written or gets a rewrite.

---

## Locked decisions — do NOT re-litigate

- **Q1:** Skip Setup A this cycle. Onboarding Screen 5's "Start my first check-in" CTA routes to `/setup/name`, not to mobile verification.
- **Q2:** Medical condition field = single-select from the 10 conditions on the landing page (Lupus, RA, Hashimoto's, MS, Crohn's, Psoriasis, Sjögren's, AS, T1D, Celiac) + "Other / not listed" escape hatch.
- **Q3:** DOB field = three dropdowns (Month / Day / Year). Year dropdown defaults to a sensible decade (proposal: starts at 1990, range 1925–current year).
- **Q4:** Home page metric viz = placeholder card *"Your patterns will appear here once you've been checking in."* Real viz is F03's deliverable — do not start it here.
- **Q5:** Bottom nav rendered on `/home` only. `/check-in` and `/journey/memory` are NOT modified in this cycle. Retrofit is a separate small follow-up cycle.
- **Q6:** Un-built feature CTAs are **disabled / non-interactive** (faded styling, `aria-disabled="true"`, no toast, no throwaway routes). Applies to: Medications nav pillar, Community nav pillar, Settings nav pillar, the Medications setup nudge card on home page.
- **Q7:** Welcome screen = built as visual practice. Saha-voice greeting. No actual email send, no toast about an email — the screen itself IS the welcome moment.
- **Defaults locked (no question asked):** Name field = single input *"What should Saha call you?"* (friend-voice, fits the "with you" framing). Email field = single input, standard email type.
- **Brand voice = "endurance + together," not "gentle."** ADR-025 supersedes ADR-024. Any copy written or kept this cycle must read like *"we walk this with you"* / *"this is yours to endure, and you don't endure alone"* — not *"gentle / soft / calm."* Reviewer-1 enforces.
- **Auth deferred to final cycle.** No `convex/auth.ts`, no `@convex-dev/auth` install, no Convex Auth integration in any chunk. Profile persistence is localStorage-only.
- **Marketing landing stays at `/`.** This cycle does NOT change `app/page.tsx` / `app/LandingPage.tsx` other than adding a "Get started" / "Open your home page" CTA that routes to `/onboarding/1` (or `/home` once onboarded).
- **Journey nav pillar exception:** Journey is the only un-built pillar landing with a working sub-route (`/journey/memory`). To preserve usability, Journey routes to `/journey/memory` — NOT disabled. Medications / Community / Settings are disabled.
- **Routes follow Next.js App Router conventions:** `/onboarding/1` through `/onboarding/5` use a `[step]` dynamic segment; `/setup/{name,dob,email,condition}` use four discrete folders (each step has a unique field shape, not a generic).
- **localStorage namespace:** `saha.profile.v1` (matches the post-rebrand `saha.*` convention used by F01's `saha.testUser.v1` and `saha.saveLater.v1`). Versioned shape; corrupted JSON → `readProfile` returns `null` (logs once); `writeProfile` overwrites with a fresh shape.
- **Once-onboarded behavior:** When `saha.profile.v1.onboarded === true`, the marketing landing's "Get started" CTA changes label to "Open your home page" and routes directly to `/home`. (Detected client-side; SSR shows the default label.)

---

## Profile state contract (locked seam — chunk B owns this file)

```typescript
// lib/profile/types.ts

export type Condition =
  | 'lupus' | 'rheumatoid-arthritis' | 'hashimotos' | 'multiple-sclerosis'
  | 'crohns' | 'psoriasis' | 'sjogrens' | 'ankylosing-spondylitis'
  | 'type-1-diabetes' | 'celiac' | 'other'

export interface Profile {
  v: 1
  name: string | null            // null until Setup B.1 completed
  dobIso: string | null          // YYYY-MM-DD; null until Setup B.2
  email: string | null           // null until Setup B.3
  condition: Condition | null    // null until Setup B.4
  conditionOther: string | null  // free text iff condition === 'other'; else null
  onboarded: boolean             // true after /welcome viewed
  createdAtMs: number            // Date.now() at first write
  updatedAtMs: number
}

// lib/profile/storage.ts

export const PROFILE_KEY = 'saha.profile.v1'

export function readProfile(): Profile | null
export function writeProfile(patch: Partial<Profile>): Profile  // merges, bumps updatedAtMs
export function clearProfile(): void                            // dev/test helper
export function markOnboarded(): Profile
```

The shape is **versioned via `v: 1`**; future migrations bump `v` and add a migrator. Corrupted JSON → `readProfile()` returns `null` (logs once); `writeProfile` overwrites with a fresh shape.

**Ownership refinement (2026-04-26 pre-flight):** the orchestrator stamps **both** `lib/profile/types.ts` (canonical — Build-B may not modify) **and** a thin starter `lib/profile/storage.ts` exporting all four functions in pre-flight, so Build-A/B/C can import a working seam from day one without ordering dependencies. Build-B continues to *own* `storage.ts` — it may extend the implementation (richer error handling, telemetry, etc.) but the exported function signatures plus `PROFILE_KEY` re-export are locked. Build-B also owns the deeper storage tests (round-trips per Setup-screen flow, quota-exceeded handling, etc.); the orchestrator ships `tests/profile/contract.test.ts` as the seam guard, and Build-B's tests must keep those passing.

---

## Task 0: Pre-flight (orchestrator only)

**Why:** Confirm baseline green and stamp the locked profile seam so all three Wave-1 agents start against the same shape.

### Steps

- [x] **0.1** — Confirm `main` includes the Saha rebrand merge (`b79f494`) and the SSR hardening fix (`6977284`).
- [x] **0.2** — Branch `feat/onboarding-shell-build` off `main` (post-rebrand, post-SSR-fix).
- [x] **0.3** — Run `npm run test:run`, `npx tsc --noEmit`, `npm run build`. Baseline confirmed green: 441/441 vitest.
- [x] **0.4** — Cherry-pick the plan commit (`45ee765`) onto the build branch so the plan lives alongside the code.
- [x] **0.5** — Stamp the locked seam: `lib/profile/types.ts` (canonical) + `lib/profile/storage.ts` (Build-B owns + extends; signatures locked) + `tests/profile/contract.test.ts` (seam guard).
- [x] **0.6** — Re-run `npm run test:run`, `npx tsc --noEmit`, `npm run build`. Contract tests pass on top of baseline (actual: 441 + 11 = 452 / 452 vitest; tsc clean; next build clean — 8 prerendered routes + 1 dynamic API).
- [ ] **0.7** — Commit + tag `onboarding-shell/pre-flight-done`. Append phase entry to `docs/build-log.md`. Push branch + tag.

---

## Task 1: Wave 1 build dispatch — 3 subagents in ONE multi-tool-call message

All three prompts dispatched in a single message. File ownership is disjoint by directory.

### Build-A prompt (Chunk A — Onboarding screens 1–5)

**Files OWNED:**
- `app/onboarding/[step]/page.tsx` (single dynamic-segment route — uses `params.step` to pick the screen)
- `components/onboarding/OnboardingShell.tsx` (shared layout: pastel tint background, illustration slot, title slot, body slot, sticky-bottom Next CTA, progress dots showing `step / 5`)
- `components/onboarding/OnboardingScreen1.tsx` through `OnboardingScreen5.tsx` (5 thin wrappers — title + body + illustration. Copy = scoping § Onboarding Screens 1–5 verbatim where locked; for Screen 1 + Screens 2/3 body, use the placeholder strings exported from `lib/copy/onboarding-placeholders.ts` — see Build-A's "Copy strategy" below.)
- `lib/copy/onboarding-placeholders.ts` (centralized placeholder copy with TODO markers for each open string — second-pass reviewer scans for `TODO(rewant-copy)` to flag pre-tag.)
- `tests/onboarding/onboarding-shell.test.tsx`
- `tests/onboarding/onboarding-routes.test.tsx`

**Do NOT touch:** `app/page.tsx`, `app/LandingPage.tsx`, `app/check-in/**`, `app/journey/**`, `app/memory/**`, `app/privacy/**`, `app/setup/**`, `app/welcome/**`, `app/home/**`, `components/check-in/**`, `components/nav/**`, `lib/profile/**`, `convex/**`.

**Stories implemented:**
- **Onboarding.US-1** — `/onboarding/1` renders Screen 1 (app name + tagline). CTA = "Next" → routes to `/onboarding/2`. Invalid step (`/onboarding/0`, `/onboarding/6`, `/onboarding/abc`) → redirect to `/onboarding/1`.
- **Onboarding.US-2** — Screen 2 renders the locked headline from scoping § Onboarding Screen 2. CTA = "Next" → `/onboarding/3`. **Note for reviewer:** the locked headline was authored under the prior Saumya/"gentle" framing — flag for Rewant to confirm it survives the Saha "endurance + together" voice or to supply a rewrite via `TODO(rewant-copy)`.
- **Onboarding.US-3** — Screen 3 renders the locked headline *"You take command of your own life."* CTA = "Next" → `/onboarding/4`. (This headline already fits the new brand voice.)
- **Onboarding.US-4** — Screen 4 renders the locked Voice check-in copy verbatim from scoping § Screen 4. CTA = "Next" → `/onboarding/5`. **Reviewer note as Onboarding.US-2.**
- **Onboarding.US-5** — Screen 5 renders the locked Memory + Patterns copy verbatim from scoping § Screen 5. CTA = **"Start my first check-in"** → `/setup/name` (per Q1: skip Setup A). **Reviewer note as Onboarding.US-2.**
- **Onboarding.US-6** — `OnboardingShell` provides: pastel tinted background per scoping § Brand direction; one illustration slot (each screen passes a small inline SVG or emoji-as-placeholder for now — illustrations are art-direction work for a separate cycle); progress dots showing position 1–5 of 5; sticky-bottom Next CTA. Visual treatment matches the existing landing page's design tokens (Fraunces for display copy, Inter for body, sage palette, grain texture).

**Copy strategy:** For Screen 1's tagline + Screen 2 body + Screen 3 body (Rewant-deferred copy), `lib/copy/onboarding-placeholders.ts` exports placeholder strings tagged with `// TODO(rewant-copy)` comments. Second-pass reviewer must flag every TODO — none ship without an explicit Rewant decision. Locked copy on Screens 2–5 also gets a brand-voice flag in Reviewer-1 (does it still read right under "endurance + together"?).

**Test approach (TDD):** ≥10 component tests. Render each screen → assert title + body match scoping copy (or placeholder); click Next → assert `router.push` called with the expected next route; Screen 5 Next routes to `/setup/name` not `/setup/mobile`; invalid step renders redirect to `/onboarding/1`.

**Commit per story** — Conventional Commits, `feat(onboarding): …`.

---

### Build-B prompt (Chunk B — Setup B screens + profile state lib)

**Files OWNED:**
- `lib/profile/types.ts` (matches the locked seam above — no deviations)
- `lib/profile/storage.ts` (matches the locked seam above; key = `saha.profile.v1`)
- `app/setup/name/page.tsx`
- `app/setup/dob/page.tsx`
- `app/setup/email/page.tsx`
- `app/setup/condition/page.tsx`
- `components/setup/SetupShell.tsx` (shared step layout: progress dots showing `step / 4`, sticky-bottom Next button — disabled when current field is invalid)
- `components/setup/NameField.tsx` (single text input, label *"What should Saha call you?"*)
- `components/setup/DOBField.tsx` (three dropdowns: Month / Day / Year. Defaults: Year=1990. Validation: requires all three; future date → invalid; date before 1925 → invalid; uses `Intl.DateTimeFormat` for month names.)
- `components/setup/EmailField.tsx` (single email input with HTML5 validation + lightweight client-side regex `/^\S+@\S+\.\S+$/` — second-pass reviewer can request stricter validation)
- `components/setup/ConditionField.tsx` (single-select list of 10 + "Other / not listed". Selecting Other reveals an inline free-text input; saving requires non-empty `conditionOther`.)
- `tests/profile/storage.test.ts`
- `tests/setup/setup-shell.test.tsx`
- `tests/setup/name-step.test.tsx`
- `tests/setup/dob-step.test.tsx`
- `tests/setup/email-step.test.tsx`
- `tests/setup/condition-step.test.tsx`

**Do NOT touch:** `app/page.tsx`, `app/LandingPage.tsx`, `app/check-in/**`, `app/journey/**`, `app/memory/**`, `app/privacy/**`, `app/onboarding/**`, `app/welcome/**`, `app/home/**`, `components/check-in/**`, `components/nav/**`, `components/onboarding/**`, `convex/**`.

**Stories implemented:**
- **Profile.US-1** — `lib/profile/types.ts` exports the contract above. `lib/profile/storage.ts` exports `readProfile`, `writeProfile`, `clearProfile`, `markOnboarded`. `writeProfile` deep-merges, sets `updatedAtMs`, sets `createdAtMs` once on first write. `readProfile` returns `null` for missing key, malformed JSON, or wrong `v`.
- **Setup.US-1 (Name)** — `/setup/name` renders `<NameField>`. On Next: `writeProfile({ name: trimmed })`, route to `/setup/dob`. Empty/whitespace name disables Next.
- **Setup.US-2 (DOB)** — `/setup/dob` renders `<DOBField>`. On Next: composes `dobIso = "YYYY-MM-DD"` from the three dropdowns, `writeProfile({ dobIso })`, route to `/setup/email`. Incomplete or invalid date disables Next.
- **Setup.US-3 (Email)** — `/setup/email` renders `<EmailField>`. On Next: `writeProfile({ email: trimmed.toLowerCase() })`, route to `/setup/condition`. Invalid email disables Next.
- **Setup.US-4 (Condition)** — `/setup/condition` renders `<ConditionField>`. On Next: `writeProfile({ condition, conditionOther })`, route to `/welcome`. No selection disables Next; selecting "Other" with empty free-text disables Next.
- **Setup.US-5 (Direct-link guard)** — Visiting `/setup/condition` directly without having filled prior steps must NOT crash. The step page reads `readProfile()` → if a prior required field is missing, redirect to the earliest missing step (`/setup/name` if name is null, etc.). Each step page does the same upstream check. Tests cover this.

**Test approach (TDD):** ≥18 tests. Storage round-trip (write → read → fields match); malformed-JSON handling; each step page renders the field, Next-disabled-when-invalid, valid input writes the right slice + routes correctly; direct-link to a later step redirects to the earliest unfilled step; condition "Other" reveals free-text and validation gates on it.

**Commit per story** — `feat(setup): …` and `feat(profile): …`.

---

### Build-C prompt (Chunk C — Welcome screen + Home page + BottomNav + landing CTA)

**Files OWNED:**
- `app/welcome/page.tsx`
- `app/home/page.tsx`
- `components/welcome/WelcomeScreen.tsx` (Saha-voice greeting card — pulls `name` from `readProfile()`, falls back to a graceful default if `name` is null but the user somehow lands here directly. Voice = "endurance + together," not "gentle.")
- `components/home/HomeGreeting.tsx` (top section — *"Welcome, [name]"* personalized; falls back to *"Welcome"* if name missing)
- `components/home/CheckInPromptCard.tsx` (the daily check-in CTA card — primary button routes to `/check-in`)
- `components/home/MedsSetupNudgeCard.tsx` (disabled card per Q6 — visible, faded, `aria-disabled="true"`, no `onClick`)
- `components/home/MetricVizPlaceholder.tsx` (placeholder card per Q4 — copy *"Your patterns will appear here once you've been checking in."*)
- `components/nav/BottomNav.tsx` (5-pillar horizontal nav: Home / Medications / Journey / Community / Settings. Home + Journey enabled — Home is active when on `/home`, Journey routes to `/journey/memory`. Medications, Community, Settings are visually present but `aria-disabled="true"` with no route.)
- `tests/welcome/welcome-page.test.tsx`
- `tests/home/home-page.test.tsx`
- `tests/nav/bottom-nav.test.tsx`
- `tests/landing/get-started-cta.test.tsx`

**Files SHARED (additive only — single CTA insertion):**
- `app/LandingPage.tsx` — Add a primary "Get started" / "Open your home page" CTA in the hero section. CTA target depends on `readProfile()?.onboarded` (client-side check, default behavior on SSR is "Get started" → `/onboarding/1`). The existing waitlist/email-capture sections stay unchanged. **Diff guard: Build-C must not modify any other section of `LandingPage.tsx`.**

**Do NOT touch:** `app/check-in/**`, `app/journey/**`, `app/memory/**`, `app/privacy/**`, `app/onboarding/**`, `app/setup/**`, `components/check-in/**`, `components/onboarding/**`, `components/setup/**`, `lib/profile/**` (Build-C IMPORTS this lib but does NOT modify it), `convex/**`.

**Stories implemented:**
- **Welcome.US-1** — `/welcome` renders `<WelcomeScreen>`. Saha-voice greeting using the user's name from profile (placeholder copy; Rewant-deferred). Single CTA *"Open my home page"* → `/home`. Also marks `markOnboarded()` on mount (so revisits to `/` show the "Open your home page" label).
- **Home.US-1** — `/home` composition top-to-bottom: `<HomeGreeting>` → `<CheckInPromptCard>` → `<MedsSetupNudgeCard>` (disabled) → `<MetricVizPlaceholder>` → `<BottomNav>`. Persistent mic-icon CTA from scoping § Home page item 6 is **deferred** (post-cycle polish — flagged in plan).
- **Home.US-2** — Direct-link guard: `/home` reads `readProfile()`. If `onboarded !== true`, redirect to `/onboarding/1`. Tests cover this.
- **Nav.US-1** — `<BottomNav>` renders 5 items left-to-right: Home / Medications / Journey / Community / Settings. Active item highlighted by current pathname. Home + Journey are real `<Link>`s; Medications + Community + Settings render as `<button aria-disabled="true">` with faded styling and no handler. Mobile-first: full-width fixed-bottom bar with safe-area-inset padding for iOS.
- **Landing.US-1** — Add hero "Get started" CTA. Client component reads `readProfile()?.onboarded` after mount; pre-hydration label = "Get started" → `/onboarding/1`; post-hydration when onboarded = "Open your home page" → `/home`. The waitlist email-capture stays intact (target audience is split: onboarded users press the new CTA, prospects keep using the email form).

**Test approach (TDD):** ≥14 tests. Welcome renders with name from profile; home page composition order verified; home redirects to `/onboarding/1` when not onboarded; bottom nav active state by pathname; disabled buttons have `aria-disabled` + don't navigate on click; landing-page CTA toggles label by `onboarded` flag (use `vi.mock('next/navigation')` + a profile fixture).

**Commit per story** — `feat(welcome): …`, `feat(home): …`, `feat(nav): …`, `feat(landing): …`.

---

## Task 2: Wave 1 integration (orchestrator only)

**Why:** All three chunks ship disjoint files. Integration is verifying the route chain works end-to-end and writing the smoke test.

### Steps

- [ ] **2.1** — Pull merged Wave 1 work. Run `git diff --name-only main..HEAD` and verify no file-ownership overlap between A/B/C (the only shared file is `app/LandingPage.tsx`, additive only, owned by C).
- [ ] **2.2** — Add a top-level smoke test `tests/onboarding-shell-smoke.test.tsx` that drives the full route chain: `/` → click "Get started" → `/onboarding/1` → Next ×4 → `/onboarding/5` → "Start my first check-in" → `/setup/name` → fill all four steps → `/welcome` → "Open my home page" → `/home` → bottom nav present, Home active. Assert `localStorage.saha.profile.v1` contains the expected shape after the chain.
- [ ] **2.3** — Run `npm run test:run`, `npx tsc --noEmit`, `npm run build`. All green.
- [ ] **2.4** — Manual smoke test on `npm run dev`: walk the chain from `/` to `/home`, refresh on each step (verify route is bookmarkable + state persists), test the direct-link guards (visit `/setup/condition` with empty profile → redirected; visit `/home` with empty profile → redirected to `/onboarding/1`).
- [ ] **2.5** — Commit: `feat(onboarding-shell): integrate Wave 1 — onboarding + setup + welcome + home + nav`. Tag `onboarding-shell/wave-1-integrated`. Append phase entry to `docs/build-log.md`.

---

## Task 3: Review dispatch — 3 reviewers in ONE multi-tool-call message

All three read the delta `onboarding-shell/pre-flight-done..HEAD`.

### Review-1 prompt (brief alignment + copy + brand voice)
- Every story's acceptance satisfied or explicitly deferred.
- Copy match: Screens 2–5 verbatim from scoping § Onboarding (Screen 1 tagline + Screens 2/3 body + Setup B prompts + home greeting/nudge phrasing + welcome wording are placeholder — flag every `TODO(rewant-copy)` for swap-out before tag).
- **Brand voice (Saha rebrand):** every locked copy line on Screens 2–5 was originally authored under the prior Saumya / "gentle" framing. Flag each line for Rewant to confirm it still reads right under the **"endurance + together"** voice or to supply a rewrite. Specifically scan for "gentle / soft / calm / kind" language — none should ship.
- "Saha" never "Sakhi" / "Saumya" anywhere in code or copy.
- "Support system" never "caregiver" / "squad". Saha speaks first-person on Screens 4–5 ("I'll remember", not "Saha remembers").
- CTAs match scoping: "Next" everywhere except Screen 5's "Start my first check-in", Welcome's "Open my home page".
- Scope creep beyond the 3 chunks (especially: nobody touched `/check-in` or `/journey/memory` per Q5).

### Review-2 prompt (spec + locked-decision + regression)
- Q1: `/onboarding/5` Next routes to `/setup/name` (Setup A skipped — no `/setup/mobile` route exists).
- Q2: Condition field renders the 10 conditions + "Other"; Other reveals free-text; saves correctly.
- Q3: DOB renders three dropdowns (NOT a date picker, NOT a text input); validation rejects future dates and pre-1925 dates.
- Q4: Home renders `MetricVizPlaceholder` only — NO real chart, NO Convex data fetch on home.
- Q5: `/check-in` and `/journey/memory` are byte-identical to `f01-c2/shipped` post-rebrand (no nav added there).
- Q6: Medications + Community + Settings nav buttons have `aria-disabled="true"` and no `href`/`onClick`; Medications setup nudge card is disabled the same way.
- Q7: `/welcome` route exists with a Saha-voice greeting; no email send code exists; no toast about an email.
- No `@convex-dev/auth` import anywhere. No SMS provider import. No email provider import.
- No `convex/auth.ts`. No schema migration.
- F01 + F02 regression: `/check-in` flow still works end-to-end; `/journey/memory` still renders correctly; existing tests still pass; no localStorage key collisions (F01 uses `saha.testUser.v1` and `saha.saveLater.v1`; this cycle adds `saha.profile.v1` — three distinct keys, no overlap).
- No leftover `saumya.*` localStorage references (rebrand sweep should already be clean on `main` — re-verify in this branch).
- Type contract: `lib/profile/types.ts` matches the locked seam exactly. Every consumer's import compiles.

### Review-3 prompt (edge cases + accessibility)
- Direct-link guards: `/setup/email` with no name in profile → redirect to `/setup/name`. `/home` with no condition → redirect to `/setup/condition` (or earliest missing). `/welcome` with empty profile → redirect to `/onboarding/1`.
- localStorage edge cases: corrupted JSON in `saha.profile.v1` → `readProfile` returns null, no crash, user routes through onboarding fresh. Quota-exceeded on write → graceful fallback (writes throw caught, user shown a non-blocking error, can retry).
- DOB edge cases: Feb 29 in a non-leap year → invalid; year=1925 → valid (boundary); year=current+1 → invalid.
- Email edge cases: empty → invalid; missing `@` → invalid; multiple `@` → invalid; lowercased on write.
- Condition "Other" with empty free text → Next disabled.
- Refresh on `/onboarding/3` → stays on `/onboarding/3` (route is the source of truth, not a state machine).
- Browser back from `/setup/dob` → returns to `/setup/name` with previously-entered name still in profile (writes are sticky, back button doesn't clear).
- Mobile viewport (375px width): bottom nav doesn't overlap content; safe-area-inset-bottom respected; CTAs are 44pt min hit targets; no horizontal scroll on any screen.
- Keyboard nav: every CTA reachable via Tab; Enter activates; focus visible.
- Screen reader: progress dots have `aria-label`s; disabled nav items announce as "disabled, button"; placeholder card has descriptive text.
- `prefers-reduced-motion`: any onboarding screen transitions respect it.
- WCAG AA contrast on disabled-but-visible items (sage on faded sage).
- Marketing landing not regressed: `/` still renders the full long-scroll page; the new Get-started CTA does NOT replace the waitlist form, only augments the hero.

Merge findings into one ordered fix list grouped by chunk. Tag `onboarding-shell/reviewed`.

---

## Task 4: Fix pass

- [ ] **4.1** — Triage findings: blocker → major → minor. Discard anything that re-litigates a locked decision.
- [ ] **4.2** — Apply smallest-diff fixes. One commit per chunk.
- [ ] **4.3** — Re-run `npm run test:run`, `npx tsc --noEmit`, `npm run build`. All green.
- [ ] **4.4** — Tag `onboarding-shell/fixed`. Append phase entry to `docs/build-log.md`.

---

## Task 5: Second-pass review

One Agent call. Prompt includes the locked-decisions list + first-pass summary. Looks for 1–2 missed items.

- [ ] **5.1** — Dispatch second-pass reviewer (Explore agent, very thorough).
- [ ] **5.2** — Specifically scan for every `TODO(rewant-copy)` marker — confirm each has a Rewant-supplied replacement OR is documented in the ship checklist as known-deferred.
- [ ] **5.3** — Specifically scan for any leftover `Saumya` / `Sakhi` / `saumya.*` / `sakhi.*` strings — must be zero in this branch's diff.
- [ ] **5.4** — If clean: tag `onboarding-shell/second-pass-clean`.
- [ ] **5.5** — If findings: one more fix commit max, then tag `onboarding-shell/second-pass-clean`.

**Stop condition:** if second pass finds blocker-level issues that need more than one fix commit → stop, don't ship, flag for morning.

---

## Task 6: Ship

- [ ] **6.1** — Verify deferred-copy status with Rewant (Onboarding 1 tagline, Screens 2/3 body, Setup B prompts, home greeting line + meds nudge phrasing, welcome wording, AND the brand-voice re-validation of locked Screens 2–5 copy). Either swap in real copy or explicitly accept the placeholder strings as a known follow-up tracked in `docs/post-mvp-backlog.md`.
- [ ] **6.2** — `docs/architecture-changelog.md` — append dated entry summarizing new routes (`/onboarding/[step]`, `/setup/{name,dob,email,condition}`, `/welcome`, `/home`), new components (`OnboardingShell`, `SetupShell`, `BottomNav`, `WelcomeScreen`, `Home*`), new lib (`lib/profile/`), new localStorage key (`saha.profile.v1`).
- [ ] **6.3** — `docs/system-map.md` — reflect onboarding shell shipped + connection edges (`/` → `/onboarding` → `/setup` → `/welcome` → `/home`; `/home` → `/check-in` and `/journey/memory`).
- [ ] **6.4** — `docs/build-log.md` — session entry: what shipped, reviewer notes, surprises.
- [ ] **6.5** — `docs/post-mvp-backlog.md` — confirm the follow-up polish cycle for retrofitting `BottomNav` into `/check-in` and `/journey/memory` is recorded. Confirm the persistent mic-icon CTA on home is also recorded.
- [ ] **6.6** — Vercel: no new env vars needed (no real auth, no real email send). Existing `NEXT_PUBLIC_CONVEX_URL` covers the F02 surfaces; this cycle doesn't talk to Convex.
- [ ] **6.7** — Deploy to Vercel: `git push origin feat/onboarding-shell` → PR #X → squash merge to main → auto-deploy. Verify live URLs respond:
  - `https://saha-health-companion.vercel.app/` (landing — Get started CTA visible)
  - `/onboarding/1` through `/onboarding/5`
  - `/setup/name`, `/setup/dob`, `/setup/email`, `/setup/condition`
  - `/welcome`
  - `/home`
  - `/check-in` (regression — still works)
  - `/journey/memory` (regression — still works)
- [ ] **6.8** — Update `~/.claude/projects/-Users-rewantprakash-1/memory/MEMORY.md` and `autoimmune_companion.md`: status line → "Onboarding shell SHIPPED + LIVE." Plan-file status → "Next: F02 C2 (Memory canonical search/edit/delete)."
- [ ] **6.9** — Commit: `docs: ship onboarding shell — update statuses, changelog, system-map, build-log`. Tag `onboarding-shell/shipped`.

---

## Stop conditions (apply throughout)

- After 2 fix-pass iterations still red → stop, don't ship, morning brief.
- Reviewer blocker that conflicts with a locked decision → discard, note, don't wake.
- `tsc` / `next build` failure unresolvable without touching `scoping.md` → stop.
- Any subagent crosses its `Do NOT touch` list → reject the patch, restart that chunk.
- Any subagent imports `@convex-dev/auth`, a real SMS provider, or a real email provider → reject, this is the wrong cycle.
- Any subagent reintroduces `Saumya` / `Sakhi` / `saumya.*` / `sakhi.*` strings → reject, the rebrand sweep is canonical.

---

## Scoping coverage map (verification)

| Scoping requirement | Cycle / Chunk |
|---|---|
| Onboarding Screens 1–5 (Saha first-person on 4 + 5) | A |
| Onboarding CTA rule ("Next" except Screen 5's "Start my first check-in") | A |
| Setup B — Name, DOB, email, condition (4 screens) | B |
| Profile data persistence | B (localStorage stub at `saha.profile.v1`; final Auth cycle migrates to Convex) |
| Welcome moment between Setup B and home | C (visual only — email send is final Auth cycle) |
| Home page — greeting, check-in CTA, meds nudge, viz, bottom nav | C |
| Bottom menu bar — 5 pillars (Home / Medications / Journey / Community / Settings) | C |
| Setup A — mobile verification (2 screens) | **deferred to final Auth cycle (Q1)** |
| Real email send | **deferred to final Auth cycle (Q7)** |
| Real metric viz on home | **deferred to F03 Patterns cycle (Q4)** |
| Bottom nav on `/check-in` and `/journey/memory` | **deferred to retrofit polish cycle (Q5)** |
| Persistent mic-icon CTA on home (scoping § Home page item 6) | **deferred to home-polish follow-up** |
| `/journey` landing surface | **already in backlog — out of scope here** |
| Brand-voice re-validation of pre-Saha locked copy | **handled in Reviewer-1 + Task 6.1 ship gate** |

---

## Review notes
*(Filled in after Task 3/Task 5.)*

## Learnings
*(Filled in post-ship.)*
