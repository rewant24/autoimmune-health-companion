# Feature 01 — Cycle 2 (Conversational Backbone) Build Plan

> **For agentic workers:** This plan follows the **Project Process Playbook** (`~/.claude/projects/-Users-rewantprakash_1/memory/reference_project_process.md`) — parallel build subagents → parallel review subagents → fix → second pass → ship. Steps inside each chunk follow TDD inside the subagent.
>
> **Branch:** `feat/f01-cycle-2` off `main` after `f01-c1/shipped`
> **Created:** 2026-04-25 · **Owner:** orchestrator (Claude Code main)
> **POC status:** Conversational POC validated by Rewant in Claude Chat (2026-04-25) — **skip POC step**.

**Goal:** Make the check-in actually conversational. Saumya speaks first with a continuity-aware opener, listens, extracts the 5 metrics from the transcript, only asks tap-controls for what she missed, presents an editable summary card, and signs off with a paired closer — all per the canonical scoping doc.

**Architecture:** 6 disjoint chunks owned by 6 subagents in two parallel waves. Wave 1 (4 chunks) is the conversational backbone. Wave 2 (2 chunks) is polish that depends on Wave 1's data shapes. Schema migration + AI Gateway provisioning happen in pre-flight (orchestrator-only) so parallel agents never touch the same schema or env file.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript 5 strict · Convex 1.36 · Tailwind 4 · Vitest · Web Speech API (input + TTS output, per ADR-018) · Vercel AI SDK + AI Gateway (`gpt-4o-mini` per ADR-020).

---

## Resume tags

| Tag | What's in the tree |
|---|---|
| `f01-c2/plan-saved` | This file committed. Nothing built. |
| `f01-c2/pre-flight-done` | Schema migration applied, AI Gateway env wired, build green. |
| `f01-c2/wave-1-integrated` | 2.A/2.B/2.C/2.D merged. Tests + tsc + build green. |
| `f01-c2/wave-2-integrated` | 2.E + 2.F merged on top. |
| `f01-c2/reviewed` | First-pass review findings collected (read-only). |
| `f01-c2/fixed` | Fix pass applied, all green. |
| `f01-c2/second-pass-clean` | Second reviewer returned clean. |
| `f01-c2/shipped` | Feature MD flipped, changelog + system-map + build-log updated. |

A phase entry is appended to `docs/build-log.md` at every tag.

---

## Context — what C1 shipped vs what scoping demands

### Shipped in C1 (`f01-c1/shipped`)
- `app/check-in/page.tsx` — orb screen, listens, shows transcript blockquote, saves with default values
- `lib/voice/*` — `VoiceProvider` interface + Web Speech adapter + Realtime stub
- `lib/checkin/state-machine.ts` — pure reducer + `useCheckinMachine` hook
- `convex/schema.ts` — `checkIns` table (binary `flare`, no `declined` array, no extraction-attempts counter)
- `convex/checkIns.ts` — `createCheckin` / `listCheckins` / `getCheckin` (userId as client-trusted arg per ADR-019)
- `components/check-in/{Orb,OrbStates,ScreenShell,ErrorSlot}.tsx`

### Scoping requirements NOT yet delivered (this cycle's scope)
| Scoping section | Requirement | Chunk |
|---|---|---|
| § Daily check-in — voice conversation | Saumya **speaks first** (TTS opener) | 2.A + 2.E |
| § The opener — continuity-aware | Rules engine selects variant from yesterday/streak/flare/upcoming-visit (ADR-006) | 2.A |
| § The closer — continuity-aware | Same rules engine, paired with opener (ADR-009) | 2.A + 2.D |
| § Conversation shape — hybrid | Live extraction of 5 metrics from transcript (ADR-007, ADR-020) | 2.B |
| § Conversation shape — hybrid | Skip Stage 2 if all 5 covered (ADR-005) | 2.B + 2.C |
| § Multimodal input — Stage 2 | "Heard you on" recap + missing-metric tap controls + skip-today | 2.C |
| § Multimodal input — Stage 2 | Three-way flare toggle (no / yes / ongoing) | pre-flight (schema) + 2.C |
| § After save — summary card | Editable rows + `Discard this check-in` link + closer line | 2.D |
| § After save — celebration | Day-1 + day-7/30/90/180/365 milestone celebration | 2.F |
| § Day-1 first-ever check-in | Force Stage 2 visible on Day 1 even when all metrics covered | 2.F |
| § Same-day re-entry — append mode | Re-entry opener variant + append-block save | 2.F |
| § Decline / discard path | "Discard this check-in" with confirm dialog | 2.D |
| § Stage 2 — graceful skip | `declined[]` distinct from missing | pre-flight (schema) + 2.C + 2.D |
| ADR-022 | localStorage save-later queue | 2.D |
| ADR-023 | `/check-in/saved` stable terminal route | 2.D |

### Cycle 1 audit — gaps in shipped C1 vs scoping (carried into C2 pre-flight)
1. **`flare: v.boolean()`** — scoping demands tri-state. Migrated in pre-flight to `flare: v.union('no','yes','ongoing')`.
2. **No `declined: string[]` field** — scoping treats *declined* as distinct from *missing*. Added in pre-flight.
3. **No extraction-attempts counter** — required by ADR-020 cost guards. Added in pre-flight.
4. **State machine has no Stage 2 / discard / milestone states** — extended in 2.C / 2.D / 2.F (state-machine.ts is a *shared* file; orchestrator coordinates the diff so subagents don't conflict — see "State-machine extension protocol" below).

### Out of scope (deferred to backlog)
- Cross-timezone date handling (post-MVP backlog §21).
- Past-check-in edit UI inside Memory (F02 concern).
- Sarvam AI voice provider (ADR-018 — post-MVP).
- Auth enforcement (ADR-019 — F02).
- Pillar nav shell + `/journey` landing (F02 / F08).
- Same-day timestamped append rendering in Memory (F02 — C2 only persists the append block; F02 renders it).

---

## Locked decisions — do NOT re-litigate

- **ADR-005:** skip Stage 2 if `coverage(metrics).missing.length === 0`.
- **ADR-006:** opener is a deterministic rules engine — never LLM-generated.
- **ADR-009:** closer is the same rules engine as the opener, paired from the same state snapshot.
- **ADR-018:** Web Speech only. TTS uses `window.speechSynthesis`. No Sarvam.
- **ADR-019:** `userId` stays as a client-trusted arg. No auth this cycle.
- **ADR-020:** LLM extraction via Vercel AI SDK + AI Gateway. Default model `gpt-4o-mini`. Truncate transcript to 2000 input tokens. Cap output at 200 tokens. Per-user-per-day attempt ceiling enforced in Convex.
- **ADR-021:** `stage` enum semantics — `"open"` = all 5 from transcript; `"hybrid"` = transcript + Stage 2; `"scripted"` = no transcript at all.
- **ADR-022:** Save-later queue persists to `localStorage` key `saumya.saveLater.v1`.
- **ADR-023:** Post-save terminal route is `/check-in/saved`; Memory CTA is hidden until F02 C1 ships.
- **Mood enum:** `heavy | flat | okay | bright | great` (already shipped in C1 schema).
- **Language guardrail:** "support-system" — never "caregiver" / "squad".
- **Three-way flare:** `'no' | 'yes' | 'ongoing'`.
- **Skip semantics:** a skipped metric writes `null` to its column AND adds the metric name to the `declined: string[]` array. The pattern engine reads `declined` to render "skipped today" distinctly from "not captured."

### State-machine extension protocol

`lib/checkin/state-machine.ts` is touched by 2.B (adds `metrics`/`coverage` to events), 2.C (adds Stage 2 states), 2.D (adds `discarding` state), and 2.F (adds `celebrating` + `re-entry` states). To prevent merge collisions, **orchestrator does the state-machine extension up-front during pre-flight** (Task 0, step 6) using the union below — subagents read it as an existing seam, not a file they edit.

```typescript
// Final State union after pre-flight extension
export type State =
  | { kind: 'idle' }
  | { kind: 'requesting-permission' }
  | { kind: 'listening'; partial: string }
  | { kind: 'processing'; transcript: Transcript }
  | { kind: 'extracting'; transcript: Transcript }                          // 2.B
  | { kind: 'stage-2'; transcript: Transcript; metrics: Partial<CheckinMetrics>; missing: Metric[]; declined: Metric[] }  // 2.C
  | { kind: 'confirming'; transcript: Transcript; metrics: CheckinMetrics; declined: Metric[]; stage: StageEnum } // 2.D
  | { kind: 'discarding'; from: 'confirming' | 'stage-2' }                  // 2.D
  | { kind: 'saving' }
  | { kind: 'saved'; milestone: MilestoneKind | null }                       // 2.F
  | { kind: 'celebrating'; milestone: MilestoneKind }                       // 2.F
  | { kind: 'error'; error: VoiceError | SaveFailedError }
```

Pre-flight commits the union + the corresponding event additions + the no-op transitions. Subagents implement the transition logic for their chunk's events only.

---

## Task 0: Pre-flight (orchestrator only, before dispatch)

**Why:** Schema migration, AI Gateway env, state-machine union, and shared types must exist before parallel agents run. Anything shared goes here.

**Files touched (all by orchestrator):**
- Modify: `convex/schema.ts` — migrate `flare`, add `declined`, add `extractAttempts` table
- Modify: `convex/checkIns.ts` — extend `createCheckin` validator + `CreateCheckinArgs` to accept tri-state flare + declined
- Create: `lib/checkin/types.ts` — shared types `CheckinMetrics`, `Metric`, `StageEnum`, `MilestoneKind`, `OpenerVariant`, `ContinuityState`
- Modify: `lib/checkin/state-machine.ts` — extend `State` and `Event` unions + no-op transitions per the protocol above
- Modify: `package.json` — add `ai`, `@ai-sdk/openai`, `zod`
- Create: `.env.local.example` — document `AI_GATEWAY_API_KEY`
- Modify: `docs/architecture-changelog.md` — append migration entry

### Steps

- [ ] **0.1** — Verify clean tree on `feat/f01-cycle-2` branched from `main` at `f01-c1/shipped`. Run `npm run test:run`, `npx tsc --noEmit`, `npm run build` — confirm baseline green.

- [ ] **0.2** — Migrate Convex schema. Apply this diff to `convex/schema.ts`:

  ```typescript
  // BEFORE
  adherenceTaken: v.boolean(),
  flare: v.boolean(),
  energy: v.number(),

  // AFTER
  adherenceTaken: v.optional(v.boolean()),         // optional → null when declined
  flare: v.optional(v.union(
    v.literal('no'),
    v.literal('yes'),
    v.literal('ongoing'),
  )),
  energy: v.optional(v.number()),
  pain: v.optional(v.number()),                     // also nullable for declined
  mood: v.optional(v.union(
    v.literal('heavy'), v.literal('flat'), v.literal('okay'),
    v.literal('bright'), v.literal('great'),
  )),
  declined: v.optional(v.array(v.union(
    v.literal('pain'), v.literal('mood'),
    v.literal('adherenceTaken'), v.literal('flare'), v.literal('energy'),
  ))),
  // appendedTo: v.optional(v.id('checkIns')) — set on same-day re-entry blocks (2.F)
  appendedTo: v.optional(v.id('checkIns')),
  ```

  Add a new table for ADR-020 cost-guard:

  ```typescript
  extractAttempts: defineTable({
    userId: v.string(),
    date: v.string(), // YYYY-MM-DD
    count: v.number(),
    lastAttemptAt: v.number(),
  }).index('by_user_date', ['userId', 'date']),
  ```

- [ ] **0.3** — Push schema locally: `npx convex dev --once`. Confirm no errors. Do NOT push to deploy yet (per playbook — local-only until ship task).

- [ ] **0.4** — Update `convex/checkIns.ts` `createCheckin` validator to match the new schema (optional metrics + `declined` array + `appendedTo`). Range validation in handler stays for non-null values; null values bypass range checks. **Idempotency on `clientRequestId` must be preserved.**

- [ ] **0.5** — Create `lib/checkin/types.ts`:

  ```typescript
  export type Metric = 'pain' | 'mood' | 'adherenceTaken' | 'flare' | 'energy'
  export type Mood = 'heavy' | 'flat' | 'okay' | 'bright' | 'great'
  export type FlareState = 'no' | 'yes' | 'ongoing'
  export type StageEnum = 'open' | 'hybrid' | 'scripted'
  export type MilestoneKind = 'day-1' | 'day-7' | 'day-30' | 'day-90' | 'day-180' | 'day-365'

  export interface CheckinMetrics {
    pain: number | null            // 1–10 or null when declined
    mood: Mood | null
    adherenceTaken: boolean | null
    flare: FlareState | null
    energy: number | null          // 1–10 or null when declined
  }

  export interface ContinuityState {
    yesterday: {
      date: string                 // YYYY-MM-DD
      pain: number | null
      mood: Mood | null
      flare: FlareState | null
      isRoughDay: boolean          // pain >= 8 OR flare === 'yes'
    } | null
    streakDays: number             // consecutive days with a check-in, including today's preceding day
    lastCheckinDaysAgo: number     // 0 = yesterday, ≥2 = multi-day skip
    upcomingEvent: {               // F08 — empty in C2 (returns null)
      kind: 'doctor-visit' | 'blood-test'
      whenIso: string
      hoursFromNow: number
    } | null
    flareOngoingDays: number       // 0 unless yesterday.flare === 'ongoing'
    isFirstEverCheckin: boolean
  }

  export type OpenerVariantKey =
    | 'first-ever'
    | 'multi-day-skip'
    | 'doctor-visit-tomorrow'
    | 'blood-test-tomorrow'
    | 'streak-milestone'
    | 'flare-ongoing'
    | 'rough-yesterday'
    | 'good-yesterday'
    | 'neutral-default'
    | 'flare-fatigue-neutral'     // 5+ days ongoing → neutral, not flare-ongoing
    | 're-entry-same-day'
  ```

- [ ] **0.6** — Extend `lib/checkin/state-machine.ts` `State` + `Event` unions per the protocol above. Add no-op handlers for the new states so the existing tests still pass. **Do not implement transition logic yet** — that's the subagents' job.

- [ ] **0.7** — Install AI SDK deps: `npm install ai @ai-sdk/openai zod`. Add `AI_GATEWAY_API_KEY` placeholder to `.env.local.example`. Document in README that `AI_GATEWAY_API_KEY` must be set before running 2.B's tests / dev server.

- [ ] **0.8** — Smoke test: `npm run test:run` (existing tests must still pass), `npx tsc --noEmit`, `npm run build`. All green.

- [ ] **0.9** — Append entry to `docs/architecture-changelog.md`:

  ```markdown
  ## 2026-MM-DD — F01 C2 pre-flight schema migration

  - `checkIns.{pain, mood, adherenceTaken, flare, energy}` now optional (null = declined).
  - `checkIns.flare` migrated from `boolean` → `union('no','yes','ongoing')` per scoping.
  - `checkIns.declined: optional(array(Metric))` added.
  - `checkIns.appendedTo: optional(id('checkIns'))` added for same-day re-entry blocks.
  - New table `extractAttempts` for ADR-020 cost-guard counters.
  ```

- [ ] **0.10** — Commit: `chore(check-in): F01 C2 pre-flight — schema migration + state-machine union + AI SDK deps`. Tag `f01-c2/pre-flight-done`. Append phase entry to `docs/build-log.md`.

---

## Task 1: Wave 1 build dispatch — 4 subagents in ONE multi-tool-call message

All four prompts dispatched in a single message. File ownership is disjoint. Integration seams are typed contracts in `lib/checkin/types.ts` (created in pre-flight).

### Build-A prompt (Chunk 2.A — Opener + closer rules engine + continuity state)

**Files OWNED:**
- `lib/saumya/opener-engine.ts`
- `lib/saumya/closer-engine.ts`
- `lib/saumya/variants.ts` (locked variant catalog — opener + closer paired)
- `convex/continuity.ts` (new file — `getContinuityState` query)
- `tests/check-in/opener-engine.test.ts`
- `tests/check-in/closer-engine.test.ts`
- `tests/check-in/continuity.test.ts`

**Do NOT touch:** `app/**`, `components/**`, `lib/checkin/**`, `lib/voice/**`, any other `convex/*.ts`.

**Stories implemented:**

- **OpenerEngine.US-1.G.1** — `selectOpener(state: ContinuityState): { key: OpenerVariantKey; text: string }`. Pure function. Priority order (highest first): `first-ever > re-entry-same-day > doctor-visit-tomorrow > blood-test-tomorrow > flare-fatigue-neutral (≥5 ongoing days) > flare-ongoing > streak-milestone (only at days 7, 30, 90, 180, 365) > rough-yesterday > multi-day-skip > good-yesterday > neutral-default`.
- **OpenerEngine.US-1.G.2** — Variant catalog in `lib/saumya/variants.ts` matches the scoping doc § Example opener variants verbatim, plus `re-entry-same-day` ("Back again, Sonakshi — anything else?") and `flare-fatigue-neutral` (uses neutral copy). 11 variants total.
- **CloserEngine.US-1.G.3** — `selectCloser(state: ContinuityState): { key: OpenerVariantKey; text: string }`. Same priority order; output ≤8 words; copy matches scoping § Closer variants table verbatim. Phrases ruled out (verified in tests): "one day at a time", "be kind to yourself", "stay strong", "you're doing amazing", "thank you for trusting this".
- **Continuity.US-1.G.4** — Convex query `getContinuityState({ userId, todayIso }) → ContinuityState`. Reads `checkIns` for the previous 30 days (date desc), computes `yesterday`, `streakDays`, `lastCheckinDaysAgo`, `flareOngoingDays`, `isFirstEverCheckin`. `upcomingEvent` returns `null` (F08 stub). `isRoughDay` = `pain >= 8 || flare === 'yes'`.

**Test approach (TDD):** ≥18 unit tests. For `selectOpener`/`selectCloser`: one test per variant key + one test for priority order resolution + one test for safety rail (rough yesterday with pain=10 → still uses neutral or rough-yesterday, never references "yesterday was terrible" directly — verified by string match). For `getContinuityState`: empty history, 1 prior day, 30 prior days, gap of 3 days, ongoing flare 5 days, day-7 streak.

**Commit per story** — Conventional Commits, `feat(saumya): …`. After last commit, run `npm run test:run` — must be green.

---

### Build-B prompt (Chunk 2.B — LLM metric extraction + coverage + cost guard)

**Files OWNED:**
- `lib/checkin/extract-metrics.ts`
- `lib/checkin/coverage.ts`
- `lib/checkin/extract-prompt.ts` (the system prompt + few-shot fixtures, exported separately for test reuse)
- `app/api/check-in/extract/route.ts` (Next.js Route Handler — POST, server-only)
- `convex/extractAttempts.ts` (new — `incrementAndCheck` mutation)
- `tests/check-in/extract-metrics.test.ts`
- `tests/check-in/coverage.test.ts`
- `tests/check-in/extract-route.test.ts` (with mocked AI SDK)

**Do NOT touch:** `app/check-in/**`, `components/**`, `lib/saumya/**`, `lib/voice/**`, `convex/checkIns.ts`, `convex/continuity.ts`, `convex/schema.ts`.

**Stories implemented:**

- **Extract.US-1.D.1** — `extractMetrics(transcript: string): Promise<Partial<CheckinMetrics>>`. Calls the route handler. Route handler uses Vercel AI SDK `generateObject` with `gpt-4o-mini` via AI Gateway. Schema (`zod`):

  ```typescript
  const ExtractedMetricsSchema = z.object({
    pain: z.number().int().min(1).max(10).nullable(),
    mood: z.enum(['heavy','flat','okay','bright','great']).nullable(),
    adherenceTaken: z.boolean().nullable(),
    flare: z.enum(['no','yes','ongoing']).nullable(),
    energy: z.number().int().min(1).max(10).nullable(),
  })
  ```

  Truncate transcript to 2000 tokens (`gpt-4o-mini` tokenizer estimate: ≈ 2.7 chars/token → cap at 5400 chars). Cap output at 200 tokens. **No hallucination guardrail in the prompt:** "If you cannot reliably infer a value, return null. Do not guess. Negation counts as a value (e.g., 'I forgot my meds' → adherenceTaken: false)."

- **Extract.US-1.D.2** — Cost-guard. Before calling the LLM, the route handler invokes `convex/extractAttempts.incrementAndCheck({ userId, date })`. If `count > 5`, the route returns 429 with code `extract.daily_cap_reached`. On success, increments and proceeds.

- **Coverage.US-1.D.3** — `coverage(metrics: Partial<CheckinMetrics>): { covered: Metric[]; missing: Metric[] }`. Pure. A metric is "covered" iff its value is non-null (and for ranges, in-bounds). `missing.length === 0` triggers ADR-005 skip-Stage-2 path.

**Test approach (TDD):** ≥20 unit tests. Extract: 8 transcript fixtures from scoping doc § extraction tests (all-5-covered, 3-of-5, 0-of-5, ambiguous pain "kind of bad", mood-only, medication-negation "forgot my dose", flare language "really bad day", energy-only "knackered"). Mock the AI SDK with `vi.mock('ai')` returning canned `generateObject` results. Cost-guard: 6th call same day returns 429. Coverage: empty in → all missing; full in → all covered; pain-only in → 1 covered + 4 missing.

**Commit per story** — `feat(check-in): …`.

---

### Build-C prompt (Chunk 2.C — Stage 2 UI + recap + tap controls + skip)

**Files OWNED:**
- `components/check-in/Stage2.tsx` (top-level Stage 2 layout — recap header + missing-metrics column)
- `components/check-in/Stage2Recap.tsx` ("Heard you on" tappable list — opens an inline TapInput on tap)
- `components/check-in/MissingMetricList.tsx` (renders TapInput for each missing metric in fixed order)
- `components/check-in/TapInput.tsx` (one component, switch-on-metric: slider for pain/energy, chips for mood, yes/no for adherence, three-way for flare; per-metric "skip today" link)
- `components/check-in/HeardYouOn.tsx` (the recap row — checkmark + label + value)
- `tests/check-in/stage-2.test.tsx`
- `tests/check-in/tap-input.test.tsx`

**Do NOT touch:** `app/check-in/page.tsx`, `lib/**`, `convex/**`, `components/check-in/{Orb,OrbStates,ScreenShell,ErrorSlot,ConfirmSummary,Closer,DiscardConfirm}.tsx`.

**Integration contract:** `Stage2` receives `{ transcript, metrics, missing, declined, onMetricUpdate, onMetricDeclined, onContinue }` as props. Pure presentational — no Convex calls, no state-machine dispatch internally. Page wires it up in Task 2.

**Stories implemented:**

- **Stage2.US-1.E.1** — Layout: top header `"Heard you on:"` shows the 5 metrics with ✓ + value for covered ones, dimmed for missing. Below: header `"Just two more:"` (text adapts: 1 → "Just one more:", 0 → component returns `null`). Underneath: `MissingMetricList` renders TapInputs for each missing metric in scoping order (pain → mood → adherence → flare → energy). On Day 1, **all 5** controls render even when `missing` is empty (Day-1 tutorial — gated by a `forceAllControls` prop wired in 2.F).
- **Stage2.US-1.E.2** — Tap on a `HeardYouOn` row reveals a `TapInput` for that metric inline (correction path). Adjusting the value calls `onMetricUpdate(metric, value)`.
- **TapInput.US-1.E.3** — Per-metric controls: pain/energy = 1–10 slider with the number above the thumb; mood = 5-chip group (heavy/flat/okay/bright/great); adherence = two-toggle ("took them" / "missed"); flare = three-toggle ("not a flare" / "yes, flaring" / "still ongoing"). All 44pt min hit targets. WCAG AA contrast.
- **TapInput.US-1.E.4** — Each TapInput shows a small `"Skip today"` link below the control. Tapping calls `onMetricDeclined(metric)` and visually marks the row as `"— skipped today"`.

**Test approach (TDD):** ≥14 component tests with `@testing-library/react`. Render with combinations of covered/missing/declined; assert visible labels + count of TapInputs; click each control + assert `onMetricUpdate` called with right shape; click skip + assert `onMetricDeclined`; verify Day 1 mode shows all 5 controls; verify recap copy ("Heard you on" / "Just one more" / "Just two more").

**Commit per story** — `feat(check-in): …`.

---

### Build-D prompt (Chunk 2.D — Summary card + save + closer + discard + save-later + `/check-in/saved`)

**Files OWNED:**
- `components/check-in/ConfirmSummary.tsx` (editable rows + closer line + Save + Discard secondary link)
- `components/check-in/Closer.tsx` (renders the closer text + optional TTS play affordance — TTS itself wired in 2.E, props ready)
- `components/check-in/DiscardConfirm.tsx` (modal: "Discard this one? Nothing will be saved." + Discard / Keep editing)
- `app/check-in/saved/page.tsx` (ADR-023 stable terminal route — settled-orb success view)
- `lib/checkin/save-later.ts` (localStorage queue per ADR-022 — `enqueue`, `drain`, `clear`, versioned key `saumya.saveLater.v1`)
- `tests/check-in/confirm-summary.test.tsx`
- `tests/check-in/discard.test.tsx`
- `tests/check-in/save-later.test.ts`
- `tests/check-in/saved-route.test.tsx`

**Do NOT touch:** `app/check-in/page.tsx` (orchestrator integrates), `components/check-in/{Orb,Stage2,Stage2Recap,MissingMetricList,TapInput,HeardYouOn,MilestoneCelebration,Day1Tutorial}.tsx`, `lib/saumya/**`, `lib/checkin/extract-metrics.ts`, `convex/**`.

**Integration contract:** `ConfirmSummary` receives `{ metrics, declined, transcript, closerText, onMetricUpdate, onMetricDeclined, onSave, onDiscard, isSaving, saveError }`.

**Stories implemented:**

- **Confirm.US-1.F.1** — Heading `"Here's what I heard"`. Below: 5 metric rows, each tappable to reveal an inline `TapInput` (reuses 2.C's component — peer dependency, do not duplicate). Bonus capture line `"Plus: …"` shown only if transcript contains substantive content beyond the 5 metrics (heuristic: transcript word count > 30). Closer line rendered above the Save button via `<Closer text={closerText} />`. Primary button: full-width sticky-bottom `"Save today's check-in"`. Secondary link below: `"Discard this check-in"` opens `<DiscardConfirm>`.
- **Confirm.US-1.F.2** — Save flow. On click → call `onSave()`. While `isSaving`, button shows spinner + label "Saving…", disabled. On `saveError`: render Feature 10 save-fail template inline (reuse `ErrorSlot` from C1) with "Try again" + "Keep this for later" — the latter calls `saveLater.enqueue(payload)` + routes to `/check-in/saved` with `?queued=true`.
- **Discard.US-1.F.3** — `DiscardConfirm` is a modal with backdrop. Copy: heading "Discard this one?" / body "Nothing will be saved." / primary "Discard" / secondary "Keep editing". Pressing browser back also opens this modal (uses `history.pushState` trick or a `beforeunload` hint scoped to the route — implement with `window.history.pushState` on confirm-mount and a `popstate` listener that pops the modal). Discard confirm → fires `onDiscard()` (state-machine event from page).
- **SavedRoute.US-1.F.4** — `app/check-in/saved/page.tsx` renders the settled orb (reuses `Orb` with new `'saved'` visual variant — add the variant to `OrbStates.tsx` via ONE-LINE addition, document the addition; *only* allowed cross-cut in 2.D), the closer text (passed via search param `?closer=…` URL-encoded), and a "View memory" CTA that is hidden when `process.env.NEXT_PUBLIC_F02_C1_SHIPPED !== 'true'` (per ADR-023). Auto-dismiss to `/` after 2000ms (via `setTimeout` cleared on unmount). Visible ≥1.5s minimum.
- **SaveLater.US-1.F.5** — `lib/checkin/save-later.ts`: `enqueue(payload)` writes to `localStorage` under `saumya.saveLater.v1`; `drain(): Payload[]` reads + clears; `peek(): Payload[]` reads without clearing. Schema-versioned with leading `{ v: 1, items: [...] }`. On reload, `app/check-in/page.tsx` (wired in Task 2) calls `drain()` and re-tries each via `createCheckin`. Idempotency via `clientRequestId` is already preserved server-side.

**Test approach (TDD):** ≥18 tests. ConfirmSummary: render with covered/declined mix → correct row states; click row → TapInput appears; click Save → `onSave` called with right shape; saveError → ErrorSlot + "Keep this for later" CTA. Discard: click "Discard this check-in" → modal opens; press Discard → `onDiscard` fired; press Keep editing → modal closes, state preserved. SaveLater: enqueue → peek shows item; drain → returns + clears; v1 key shape; corrupted storage falls back to empty + logs warning. SavedRoute: rendered with `?closer=Saved.%20See%20you%20tomorrow.` → visible text matches; `NEXT_PUBLIC_F02_C1_SHIPPED=false` → no Memory CTA; auto-dismiss after 2s.

**Commit per story** — `feat(check-in): …`.

---

## Task 2: Wave 1 integration (orchestrator only)

**Why:** 2.A/2.B/2.C/2.D ship presentational + logic units. The orchestrator wires them through the page + state machine. Page modifications happen in *one* commit so subagents in Wave 2 see a stable seam.

**Files touched (orchestrator):**
- Modify: `app/check-in/page.tsx`
- Modify: `lib/checkin/state-machine.ts` (transition logic for the new states declared in pre-flight)
- Modify: `components/check-in/OrbStates.tsx` (add `'saved'` settled variant — single line)

### Steps

- [ ] **2.1** — Pull the merged Wave 1 work. Run `git log --name-only feat/f01-c2/wave-1-merged..HEAD` and verify no file-ownership overlap between A/B/C/D.
- [ ] **2.2** — Implement state-machine transition logic for events introduced by the chunks: `EXTRACT_OK`, `EXTRACT_FAIL`, `STAGE_2_DONE`, `METRIC_UPDATED`, `METRIC_DECLINED`, `DISCARD_CONFIRMED`. Tests covering each transition added to `tests/check-in/state-machine.test.ts`.
- [ ] **2.3** — Wire the page (`app/check-in/page.tsx`):
  - On mount: call `useQuery(api.continuity.getContinuityState, { userId, todayIso })` → pass result to `selectOpener` → render opener text above the orb on `idle`. (Day-1 + same-day-re-entry handling deferred to Wave 2.)
  - On `state.kind === 'processing'`: dispatch `EXTRACT_START`; call `extractMetrics(state.transcript.text)` → on success, dispatch `EXTRACT_OK` with `{ metrics, missing, stage }` (compute `stage` per ADR-021); on failure, set `metrics = {}` and treat all 5 as missing → `stage = 'scripted'`.
  - If `coverage(metrics).missing.length === 0` (and not Day 1): dispatch directly to `confirming`.
  - Else dispatch to `stage-2` and render `<Stage2>`.
  - On `Stage2.onContinue`: dispatch `STAGE_2_DONE` → transitions to `confirming`.
  - In `confirming`: render `<ConfirmSummary>` with `closerText = selectCloser(continuityState).text`, wire `onSave` (calls `createCheckin` with full payload incl. `declined[]` + `appendedTo` if same-day re-entry from Wave 2), `onDiscard` (state-machine `DISCARD_CONFIRMED` → `idle`).
  - On `state.kind === 'saved'`: navigate to `/check-in/saved?closer=<encoded>` via `router.push`.
  - On mount: drain `save-later` queue and retry pending items in the background.
- [ ] **2.4** — Add `'saved'` orb variant to `OrbStates.tsx` (single-line addition + matching CSS keyframe). Document the cross-cut in this plan's "review notes" section after ship.
- [ ] **2.5** — Run `npm run test:run`, `npx tsc --noEmit`, `npm run build`. All green.
- [ ] **2.6** — Manual smoke test on `npm run dev`: open `/check-in`, verify opener text renders, speak a full transcript covering all 5 metrics, observe Stage 2 is skipped, summary card shows extracted metrics + closer, save → routed to `/check-in/saved`. Repeat with a partial transcript (only mention pain) — Stage 2 should appear with 4 missing controls.
- [ ] **2.7** — Commit: `feat(check-in): integrate F01 C2 Wave 1 — opener engine, extraction, Stage 2, summary card, save flow`. Tag `f01-c2/wave-1-integrated`. Append phase entry to `docs/build-log.md`.

---

## Task 3: Wave 2 build dispatch — 2 subagents in ONE multi-tool-call message

Wave 2 depends on Wave 1's data shapes (especially `appendedTo` from same-day re-entry and `MilestoneKind` from celebration).

### Build-E prompt (Chunk 2.E — TTS for spoken opener + closer)

**Files OWNED:**
- `lib/voice/tts-adapter.ts` (Web Speech `speechSynthesis` adapter — `speak(text, opts)` + `cancel()` + `isAvailable()`)
- `components/check-in/SpokenOpener.tsx` (renders opener text + speaker icon button + auto-speaks once on mount unless `prefersReducedMotion` or `tts-disabled` localStorage flag)
- `tests/check-in/tts-adapter.test.ts`
- `tests/check-in/spoken-opener.test.tsx`

**Do NOT touch:** anything else.

**Integration contract:** `<SpokenOpener text={openerText} variantKey={key} />` is the new wrapper component that the page renders in `idle` state in place of the plain text from Task 2. Page integration is a Wave-2 orchestrator task.

**Stories implemented:**

- **TTS.US-1.H.1** — `tts-adapter.ts`: `isAvailable()` returns `'speechSynthesis' in window && window.speechSynthesis !== undefined`. `speak(text, { rate, pitch, voice })` queues an utterance; resolves a Promise on `end`; rejects on `error`. `cancel()` clears the queue. Default voice selection: prefer English with locale `en-IN` if available, else any English voice, else default. Voice list is loaded once and cached.
- **TTS.US-1.H.2** — `<SpokenOpener>`: renders `<p>{text}</p>` + a small speaker-icon `<button aria-label="Replay">` that calls `tts.speak(text)` on click. On mount: if `tts.isAvailable()` AND `!matchMedia('(prefers-reduced-motion: reduce)').matches` AND `localStorage.getItem('saumya.ttsDisabled') !== 'true'` → auto-`speak(text)`. On unmount: `cancel()`. If TTS unavailable → speaker icon hidden.
- **TTS.US-1.H.3** — Settings opt-out persistence — clicking and holding the speaker icon for 1s triggers a small "Mute Saumya's voice" toggle in a popover; on confirm, sets `localStorage.saumya.ttsDisabled = 'true'`. (Lightweight UX — full settings panel is post-MVP.)

**Test approach (TDD):** ≥10 tests. Mock `speechSynthesis` on `globalThis` with a controlled fake (`speak`/`cancel` spies, voice list returns a fixture). Verify auto-speak on mount; verify cancel on unmount; verify `prefersReducedMotion = true` → no auto-speak; verify `ttsDisabled = true` → no auto-speak; verify replay button calls `speak`; verify hidden when unavailable.

**Commit per story** — `feat(voice): …`.

---

### Build-F prompt (Chunk 2.F — Day-1 micro-tutorial + same-day re-entry + milestone celebration)

**Files OWNED:**
- `components/check-in/Day1Tutorial.tsx` (small tooltip ribbon under each TapInput on Day 1: "Tap any of these to correct or skip — you can also use them instead of talking.")
- `components/check-in/MilestoneCelebration.tsx` (Whoop-style ring animation — fills N rings for `day-N`. Uses CSS-only animation, ≤2s, single primary "Keep going" CTA → returns to `/`.)
- `lib/checkin/milestone.ts` (`detectMilestone(streakDaysAfterSave: number, isFirstEver: boolean): MilestoneKind | null` — returns 'day-1' when `isFirstEver`; else 'day-N' iff `streakDaysAfterSave ∈ {7,30,90,180,365}`; else null.)
- `lib/checkin/same-day-reentry.ts` (`buildAppendPayload(prior: CheckinDoc, newMetrics: CheckinMetrics, transcript: string, declined: Metric[]): CreateCheckinArgs` — sets `appendedTo: prior._id`. Pattern engine reads latest per metric.)
- `tests/check-in/milestone.test.ts`
- `tests/check-in/same-day-reentry.test.ts`
- `tests/check-in/day-1-tutorial.test.tsx`
- `tests/check-in/milestone-celebration.test.tsx`

**Do NOT touch:** anything else.

**Stories implemented:**

- **Day1.US-1.J.1** — `<Day1Tutorial>` renders a tooltip ribbon below each child. Used by `Stage2` via a render-prop pattern (Stage 2 props gain `dayOneTooltipsForcedOn?: boolean`). When `forceAllControls === true` AND `dayOneTooltipsForcedOn === true`, every TapInput gets the tooltip. Page detects Day 1 via `continuityState.isFirstEverCheckin === true` and passes both flags.
- **Reentry.US-1.J.2** — Same-day re-entry: page detects `existingCheckinForToday !== null` (via a new Convex query `getTodayCheckin` — additive, owned by 2.F in `convex/checkIns.ts`) on mount → opener variant becomes `re-entry-same-day` ("Back again, Sonakshi — anything else?"). On save: `buildAppendPayload(existing, newMetrics, transcript, declined)` produces a `CreateCheckinArgs` with `appendedTo: existing._id`. `createCheckin` accepts the field; the existing row is **not modified** — a new row is appended. Pattern engine semantics: latest row per `(userId, date)` wins per metric; F02 will render the timestamped block list.
- **Milestone.US-1.J.3** — `detectMilestone` is pure. Run after `SAVE_OK` → if non-null, transition state to `celebrating` with the kind; else go straight to `saved`. Tests cover all 6 thresholds + non-milestone cases (day-2, day-8, day-31).
- **Milestone.US-1.J.4** — `<MilestoneCelebration kind={kind} closerText={closerText} onContinue={…} />`: Whoop-style ring stack animates fills (CSS keyframes — count rings = N for day-N up to a visual cap of 30 rings displayed in a 5×6 grid for day-30+; day-90 / day-180 / day-365 use a denser cluster). Closer text rendered as overlay heading. Single "Keep going" CTA → calls `onContinue()` (state-machine `CELEBRATION_DONE` → routes to `/check-in/saved`). Animation total ≤2s; respects `prefers-reduced-motion` (collapses to a static fill).

**Test approach (TDD):** ≥12 tests. Day1Tutorial: rendered when forced, hidden otherwise. Reentry: query stub returning a prior row → opener key is 're-entry-same-day' → save payload has `appendedTo`. Milestone detection: every threshold + every non-threshold. Celebration: kind=day-7 → 7 rings rendered; reduced-motion → static. The new Convex `getTodayCheckin` query: returns null when none, returns row when one exists, ignores rows on a different date.

**Convex addition (cross-cut into 2.B/2.D's territory — explicitly carved out):** `convex/checkIns.ts` gets ONE new export: `export const getTodayCheckin = query({ args: { userId, date }, handler: ... })`. Documented in `architecture-changelog.md` as a Wave-2 additive change. Does not touch `createCheckin` or `listCheckins`.

**Commit per story** — `feat(check-in): …`.

---

## Task 4: Wave 2 integration (orchestrator only)

- [ ] **4.1** — Verify no file-ownership overlap between 2.E and 2.F.
- [ ] **4.2** — Wire `<SpokenOpener>` into `app/check-in/page.tsx` `idle` view (replaces the plain text node from Task 2).
- [ ] **4.3** — Wire `<Day1Tutorial>` flag into the Stage 2 render path: `forceAllControls = isFirstEverCheckin`, `dayOneTooltipsForcedOn = isFirstEverCheckin`.
- [ ] **4.4** — Wire same-day re-entry: page calls `getTodayCheckin` → if non-null, sets re-entry opener variant + uses `buildAppendPayload` on save.
- [ ] **4.5** — Wire milestone celebration: after `SAVE_OK`, run `detectMilestone(continuityState.streakDays + 1, continuityState.isFirstEverCheckin)`. Non-null → `celebrating` state renders `<MilestoneCelebration>`. On `onContinue` → route to `/check-in/saved`.
- [ ] **4.6** — Run `npm run test:run`, `npx tsc --noEmit`, `npm run build`. All green.
- [ ] **4.7** — Manual smoke test on `npm run dev`: simulate Day 1 by clearing localStorage + Convex `checkIns` table → verify Day-1 tutorial appears + day-1 milestone fires. Use a seed script (`scripts/seed-streak.ts`, dev-only) to insert 6 prior days → next save fires day-7 ring animation.
- [ ] **4.8** — Commit: `feat(check-in): integrate F01 C2 Wave 2 — TTS opener, Day-1 tutorial, same-day re-entry, milestone celebration`. Tag `f01-c2/wave-2-integrated`. Append phase entry to `docs/build-log.md`.

---

## Task 5: Review dispatch — 3 reviewers in ONE multi-tool-call message

All three read the delta `f01-c2/pre-flight-done..HEAD`.

### Review-1 prompt (brief alignment)
- Every story's acceptance satisfied or explicitly deferred to backlog
- Copy match: opener variants verbatim from scoping § Example opener variants; closer variants verbatim from § Closer variants table; nudge bank lines verbatim from § Nudge bank
- Day-1 micro-tutorial copy verbatim ("Tap any of these to correct or skip — you can also use them instead of talking.")
- "Heard you on:" / "Just two more:" / "Just one more:" / "Plus:" copy verbatim
- "support-system" never "caregiver" / "squad"
- Phrases ruled out by ADR-009 absent from all copy: "one day at a time", "be kind to yourself", "stay strong", "you're doing amazing", "thank you for trusting this"
- Scope creep outside the 6 chunks

### Review-2 prompt (spec + ADR + regression)
- ADR-005: skip-Stage-2 path verified (transcript covering all 5 → no Stage 2 render)
- ADR-006: opener selection is deterministic; no LLM calls in `selectOpener`
- ADR-009: closer is paired with opener from the same `ContinuityState` snapshot
- ADR-018: Web Speech only; no Sarvam imports; TTS uses `window.speechSynthesis`
- ADR-019: `userId` continues as client-trusted arg; no `ctx.auth` calls
- ADR-020: extraction route uses Vercel AI SDK; cost-guard counter increments; truncation + output cap honored; key never reaches client
- ADR-021: `stage` written per the contract (`'open'` / `'hybrid'` / `'scripted'`)
- ADR-022: `localStorage` queue under `saumya.saveLater.v1`; `clientRequestId` reused on retry
- ADR-023: `/check-in/saved` exists; Memory CTA hidden behind `NEXT_PUBLIC_F02_C1_SHIPPED`
- C1 regression: `waitlist` table unchanged; `/` route still works; existing C1 tests still green; mood enum unchanged
- Type contract: `lib/checkin/types.ts` exports match every consumer's imports; no `any` leaks

### Review-3 prompt (edge cases)
- Voice: permission-denied → opener still rendered (text only); no-speech → empty transcript → all 5 missing → Stage 2 with 5 controls
- Extraction: route 429 → `EXTRACT_FAIL` → fallback to all-missing Stage 2
- Extraction: malformed LLM response → schema parse fails → `EXTRACT_FAIL` path
- Extraction: transcript >5400 chars → truncated; verify by length assertion in test
- Stage 2: skip on every metric → `declined.length === 5` → save row has all values null + `declined` array of 5
- Same-day re-entry: 2nd save → row has `appendedTo: <id of first>`; first row untouched
- Discard: confirm → state returns to `idle`; verify nothing was written to Convex
- Save-later: drain on reload retries silently; corrupted localStorage falls back gracefully
- Day-1 + milestone: first ever check-in fires `day-1` celebration AND shows Day-1 tutorial
- Continuity safety rails: yesterday with pain=10 → opener does NOT use words like "terrible" or "awful"; flare ongoing 5+ days → opener variant is `flare-fatigue-neutral`
- WCAG AA: TapInput controls + slider thumb meet 44pt; ConfirmSummary edit affordances reachable by keyboard
- `prefers-reduced-motion`: TTS auto-speak disabled; milestone celebration collapses to static
- Voice selection: TTS picks `en-IN` voice when available; falls back gracefully

Merge findings into one ordered fix list grouped by chunk. Tag `f01-c2/reviewed`.

---

## Task 6: Fix pass

- [ ] **6.1** — Triage findings: blocker → major → minor. Discard anything that re-litigates a locked decision (see top).
- [ ] **6.2** — Apply smallest-diff fixes. One commit per chunk.
- [ ] **6.3** — Re-run `npm run test:run`, `npx tsc --noEmit`, `npm run build`. All green.
- [ ] **6.4** — Tag `f01-c2/fixed`. Append phase entry to `docs/build-log.md`.

---

## Task 7: Second-pass review

One Agent call. Prompt includes the locked-decisions list + first-pass summary. Looks for 1–2 missed items.

- [ ] **7.1** — Dispatch second-pass reviewer (Explore agent, very thorough).
- [ ] **7.2** — If clean: tag `f01-c2/second-pass-clean`.
- [ ] **7.3** — If findings: one more fix commit max, then tag `f01-c2/second-pass-clean`.

**Stop condition:** if second pass finds blocker-level issues that need more than one fix commit → stop, don't ship, flag for morning.

---

## Task 8: Ship

- [ ] **8.1** — `docs/features/01-daily-checkin.md` — chunks 1.D / 1.E / 1.F → `shipped`. Add new chunks 1.G (opener+closer engine), 1.H (TTS), 1.J (Day-1 + reentry + milestone) → `shipped`.
- [ ] **8.2** — `docs/architecture-changelog.md` — append dated entry summarizing schema migration + new tables + new routes + new components.
- [ ] **8.3** — `docs/system-map.md` — reflect Cycle 2 shipped + connection edges to F02 (Memory) and F08 (Journey upcoming-events stub).
- [ ] **8.4** — `docs/build-log.md` — session entry: what shipped, reviewer notes, surprises.
- [ ] **8.5** — `docs/post-mvp-backlog.md` — confirm cross-tz, edit-past-checkin, Sarvam adapter still listed.
- [ ] **8.6** — Push Convex schema to deploy: `npx convex deploy`. Verify on dashboard.
- [ ] **8.7** — Vercel: ensure `AI_GATEWAY_API_KEY` set in production env (per ADR-020). Ensure `NEXT_PUBLIC_F02_C1_SHIPPED=false` set so Memory CTA stays hidden.
- [ ] **8.8** — Deploy to Vercel: `git push origin feat/f01-cycle-2` (PR optional given solo workflow) → merge → auto-deploy. Verify live URL: `https://saumya-health-companion.vercel.app/check-in` runs the new flow.
- [ ] **8.9** — Update `~/.claude/projects/-Users-rewantprakash-1/memory/MEMORY.md`: Saumya "Next" line → "F02 C1 (Memory) — auth lands here per ADR-019."
- [ ] **8.10** — Commit: `docs: ship F01 C2 — update statuses, changelog, system-map, build-log`. Tag `f01-c2/shipped`.

---

## Stop conditions (apply throughout)

- After 2 fix-pass iterations still red → stop, don't ship, morning brief.
- Reviewer blocker that conflicts with a locked decision → discard, note, don't wake.
- `tsc` / `next build` / Convex push failure unresolvable without touching `scoping.md` → stop.
- Cost-guard ceiling fires repeatedly in dev (>20 attempts/day) → stop, audit prompt or extraction path.
- Any subagent crosses its `Do NOT touch` list → reject the patch, restart that chunk.

---

## Scoping coverage map (verification)

For every requirement in `docs/scoping.md` § Daily check-in (lines 257–500), there must be a chunk that delivers it.

| Scoping requirement | Cycle / Chunk |
|---|---|
| Voice-first conversation, voice OR tap | C1 (orb + provider) + C2.C (tap inputs) |
| 5 required metrics (pain/mood/adherence/flare/energy) | C2.B (extract) + C2.C (Stage 2) |
| Hybrid open-first / scripted-fallback shape (ADR-004) | C2.B (coverage) + C2.C (Stage 2) |
| Stage 2 only-what's-missing (ADR-005) | C2.C |
| Continuity-aware opener (ADR-006) | C2.A + C2.E (TTS) |
| Continuity-aware closer (ADR-009) | C2.A + C2.D (rendering) |
| Three-way flare toggle | pre-flight (schema) + C2.C (control) |
| Skip-today distinct from missing | pre-flight + C2.C + C2.D |
| Summary card editable rows | C2.D |
| Discard this check-in | C2.D |
| Save-later queue (ADR-022) | C2.D |
| `/check-in/saved` terminal route (ADR-023) | C2.D |
| Same-day re-entry append mode | C2.F |
| Day-1 micro-tutorial overlay | C2.F |
| Milestone celebration day-1/7/30/90/180/365 | C2.F |
| Spoken opener (TTS) | C2.E |
| Plus-bonus capture surfacing in summary | C2.D (heuristic) |
| LLM extraction via Vercel AI Gateway (ADR-020) | C2.B |
| `stage` enum semantics (ADR-021) | C2.B (sets) + reviewers (verify) |

---

## Review notes
*(Filled in after Task 5/Task 7.)*

## Learnings
*(Filled in post-ship.)*
