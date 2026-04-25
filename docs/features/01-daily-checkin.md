---
number: 01
name: Daily Voice Check-in
slug: daily-checkin
status: cycle-1-shipped
depends_on: []
blocks: [02-memory, 06-doctor-report, 07-prepare-for-visit]
owner: rewant
scoping_ref: docs/scoping.md#feature-1-daily-voice-check-in
adr_refs: [ADR-005]
last_updated: 2026-04-25
cycle_1_commits: [4ebe11f, b002af2, de7e72e, 1aaafd6, 24ec3d9]
---

# Feature 01 — Daily Voice Check-in

## Intent

Sonakshi opens the app, taps the orb, speaks freely for ~30–60s about her day. The system transcribes, extracts the 5 required metrics (pain 1–10, mood, medication adherence, flare flag, energy 1–10). If all 5 are covered, confirm and save (ADR-005: skip Stage 2). If some are missing, enter Stage 2 scripted fallback with tap inputs available for each metric.

## Scope in / out

- **In (MVP):** voice capture (Web Speech default + OpenAI Realtime stub), 5-metric extraction, open-first flow, scripted fallback for missing metrics, tap multimodal inputs, confirmation summary, save + error/retry.
- **Out (backlog):** language support beyond `en-IN`, full edit on past check-ins, offline mutation queue, device management.

## Dependencies

- **Reads:** user profile (tier), provider flag.
- **Blocks:** 02 Memory (needs check-in data), 06 Doctor Report (aggregates), 07 Prepare-for-Visit (references), all subsequent features.

## Files owned (feature-wide, authoritative)

```
app/(check-in)/page.tsx
app/(check-in)/layout.tsx
components/check-in/Orb.tsx
components/check-in/OrbStates.tsx
components/check-in/ScreenShell.tsx
components/check-in/ConfirmSummary.tsx
components/check-in/ScriptedPrompt.tsx
components/check-in/TapInput.tsx
lib/voice/provider.ts
lib/voice/web-speech-adapter.ts
lib/voice/openai-realtime-adapter.ts
lib/voice/types.ts
lib/checkin/state-machine.ts
lib/checkin/extract-metrics.ts
lib/checkin/coverage.ts
convex/schema.ts                  // append only — checkIns table
convex/checkIns.ts                // create, list, get
tests/check-in/*.test.ts
```

---

## Chunks

### Cycle 1 — Foundation (3 chunks, parallel)

#### Chunk 1.A — Voice capture + provider abstraction + Web Speech fallback
- **Owner:** build-agent-A
- **Files owned:**
  - `lib/voice/provider.ts`
  - `lib/voice/types.ts`
  - `lib/voice/web-speech-adapter.ts`
  - `lib/voice/openai-realtime-adapter.ts` (stub — interface only, behind a flag)
  - `tests/check-in/voice-provider.test.ts`
- **Status:** shipped (2026-04-25)
- **Stories:** US-1.A.1, US-1.A.2, US-1.A.3
- **Do-not-touch:** `convex/`, `components/`, `app/`

#### Chunk 1.B — Check-in data model + Convex mutations
- **Owner:** build-agent-B
- **Files owned:**
  - `convex/schema.ts` (append `checkIns` table only)
  - `convex/checkIns.ts` (new file)
  - `tests/check-in/convex-checkins.test.ts`
- **Status:** shipped (2026-04-25)
- **Stories:** US-1.B.1, US-1.B.2, US-1.B.3
- **Do-not-touch:** `components/`, `app/`, `lib/`

#### Chunk 1.C — Orb UI + screen shell + state machine
- **Owner:** build-agent-C
- **Files owned:**
  - `app/(check-in)/page.tsx`
  - `app/(check-in)/layout.tsx`
  - `components/check-in/Orb.tsx`
  - `components/check-in/OrbStates.tsx`
  - `components/check-in/ScreenShell.tsx`
  - `lib/checkin/state-machine.ts`
  - `tests/check-in/state-machine.test.ts`
- **Status:** shipped (2026-04-25)
- **Stories:** US-1.C.1, US-1.C.2, US-1.C.3
- **Do-not-touch:** `convex/`, `lib/voice/`

### Cycle 2 — Conversation + save (3 chunks, parallel, after Cycle 1 ships)

#### Chunk 1.D — Open-first engine + LLM metric extraction
- **Owner:** build-agent-A
- **Files owned:**
  - `lib/checkin/extract-metrics.ts`
  - `lib/checkin/coverage.ts`
  - `tests/check-in/extract-metrics.test.ts`
- **Status:** scoped
- **Stories:** US-1.D.1, US-1.D.2
- **Do-not-touch:** `components/`, `app/`, `convex/`

#### Chunk 1.E — Stage 2 scripted fallback + tap multimodal inputs
- **Owner:** build-agent-B
- **Files owned:**
  - `components/check-in/ScriptedPrompt.tsx`
  - `components/check-in/TapInput.tsx`
  - `tests/check-in/scripted-prompt.test.tsx`
- **Status:** scoped
- **Stories:** US-1.E.1, US-1.E.2
- **Do-not-touch:** `lib/checkin/`, `convex/`, `app/`, `Orb*`

#### Chunk 1.F — Confirmation summary + save + error/retry
- **Owner:** build-agent-C
- **Files owned:**
  - `components/check-in/ConfirmSummary.tsx`
  - `tests/check-in/confirm-save.test.tsx`
- **Status:** scoped
- **Stories:** US-1.F.1, US-1.F.2
- **Do-not-touch:** `lib/`, `Orb*`, `ScriptedPrompt`, `TapInput`, `convex/schema.ts`

---

## User Stories

### US-1.A.1 — Provider interface
- **As** a developer **I want** a single `VoiceProvider` interface **so that** Web Speech and OpenAI Realtime can be swapped without touching the UI.
- **Functional requirement:** `interface VoiceProvider { start(): Promise<void>; stop(): Promise<Transcript>; onPartial(cb): void; onError(cb): void; capabilities: { partials: boolean; vad: boolean } }`. Factory `getVoiceProvider()` returns the active provider based on env / feature flag, defaulting to Web Speech.
- **Acceptance:**
  - **UX:** no user-visible change; provider selection invisible.
  - **UI:** none.
  - **Backend / data:** provider returns `{ text, durationMs, confidence? }`. Errors typed: `permission-denied`, `no-speech`, `network`, `unsupported`, `aborted`.
  - **UX copy:** none.

### US-1.A.2 — Web Speech fallback adapter
- **As** Sonakshi **I want** voice capture to work in browsers that block OpenAI Realtime **so that** I can still check in.
- **Functional requirement:** Web Speech API adapter implements `VoiceProvider`. Handles `SpeechRecognition` events; emits partials via `onPartial`; resolves `stop()` with final transcript. Locale defaults to `en-IN`.
- **Acceptance:**
  - **UX:** mic permission prompt appears on first use; denial routes to error template (Feature 10 hook).
  - **UI:** none in this chunk (orb lives in 1.C).
  - **Backend / data:** no data persisted here; transcript returned in-memory.
  - **UX copy:** error thrown carries key `voice.permission_denied` — resolved to user string in 1.C.

### US-1.A.3 — Realtime adapter stub
- **As** the team **I want** the OpenAI Realtime adapter scaffolded behind a flag **so that** we can implement it in a later sprint without refactoring.
- **Functional requirement:** `openai-realtime-adapter.ts` implements the interface but throws `NotImplementedError` on `start()`. Feature flag `VOICE_PROVIDER=web-speech|openai-realtime` gates selection.
- **Acceptance:**
  - **UX:** n/a.
  - **UI:** n/a.
  - **Backend / data:** flag read from env. Default `web-speech`.
  - **UX copy:** none.

### US-1.B.1 — `checkIns` table
- **As** the system **I want** a durable check-in record **so that** Memory, Patterns, and Doctor Report can read it.
- **Functional requirement:** Convex table `checkIns` with fields: `userId`, `date` (YYYY-MM-DD in IST), `createdAt`, `pain` (1–10), `mood` (enum), `adherenceTaken` (bool), `flare` (bool), `energy` (1–10), `transcript` (string), `stage` ("open" | "scripted" | "hybrid"), `durationMs`, `providerUsed`.
- **Acceptance:**
  - **UX:** n/a.
  - **UI:** n/a.
  - **Backend / data:** index on `(userId, date)` unique-ish (one check-in per user per IST day; conflict handled in 1.F). Validators enforce ranges. Schema migration documented in `architecture-changelog.md`.
  - **Time-zone contract (Cycle 1):** `date` is a bare `YYYY-MM-DD` string chosen by the *client* against the device's wall clock. Cycle 1 assumes the user is IST-fixed (Sonakshi). Cross-tz travel is a known edge case — see `post-mvp-backlog.md` §21 ("Check-in date time-zone policy").
  - **UX copy:** none.

### US-1.B.2 — `createCheckin` mutation
- **As** the UI **I want** to persist a completed check-in **so that** it shows up in Memory.
- **Functional requirement:** mutation accepts validated payload, writes row, returns `{ id, date }`. Throws `DuplicateCheckinError` if one already exists for `(userId, date)`.
- **Acceptance:**
  - **UX:** n/a (UI consumes in 1.F).
  - **UI:** n/a.
  - **Backend / data:** idempotent on client retry if same `clientRequestId` passed. Auth required.
  - **UX copy:** error codes: `checkin.duplicate`, `checkin.invalid_range`.

### US-1.B.3 — `listCheckins` + `getCheckin` queries
- **As** Memory **I want** to read recent check-ins **so that** it can render the 30-day scroll.
- **Functional requirement:** `listCheckins({ limit, cursor, fromDate?, toDate? })` returns paged results sorted by `date desc`. `getCheckin(id)` returns one.
- **Acceptance:**
  - **UX:** n/a.
  - **UI:** n/a.
  - **Backend / data:** paywall boundary not enforced here (UI layer concern); query always returns authoritative data. Tests cover empty, 1 row, 100 rows, date-filter.
  - **UX copy:** none.

### US-1.C.1 — State machine
- **As** the check-in screen **I want** a single state machine **so that** UI and side effects stay in sync.
- **Functional requirement:** States: `idle → requesting-permission → listening → processing → confirming → saving → saved | error`. Transitions triggered by orb tap, provider events, mutation result. Implemented as pure reducer + hook `useCheckinMachine()`.
- **Acceptance:**
  - **UX:** tap on idle orb → listening within 300ms. Tap during listening → stop + processing. Any error state routes to error template (Feature 10 hook, stubbed).
  - **UI:** state drives orb visual (1.C.2) and screen content.
  - **Backend / data:** consumes `VoiceProvider` (1.A) via prop injection.
  - **UX copy:** state labels for a11y: "Tap to start", "Listening", "Processing", "Review and save".

### US-1.C.2 — Orb visual
- **As** Sonakshi **I want** a calming orb that breathes when listening **so that** I feel heard.
- **Functional requirement:** Orb is the primary tap target. 4 visual states: idle (soft pulse), listening (waveform-reactive bloom), processing (indeterminate swirl), error (dimmed red pulse). 44pt min tap target. Respects `prefers-reduced-motion`.
- **Acceptance:**
  - **UX:** one-tap start, one-tap stop. Haptic feedback if supported.
  - **UI:** Tailwind + CSS keyframes; no JS animation libs. Mobile-first; full-bleed on small screens. Orb contrast passes WCAG AA against background.
  - **Backend / data:** none.
  - **UX copy:** `aria-label="Start daily check-in"` / `"Stop check-in"` toggling by state.

### US-1.C.3 — Screen shell + routing
- **As** Sonakshi **I want** `/check-in` to be the primary action on the home screen **so that** the daily habit is frictionless.
- **Functional requirement:** `app/(check-in)/page.tsx` renders `<ScreenShell>` with orb + transient copy + error template slot. `layout.tsx` handles auth gate.
- **Acceptance:**
  - **UX:** unauthed → redirect to sign-in. Authed → orb in idle.
  - **UI:** safe-area padding; no scroll; full viewport height.
  - **Backend / data:** auth check via Convex `useQuery(currentUser)`.
  - **UX copy:** empty-first-time heading: "How's today feeling?" — subcopy: "Tap the orb and tell me in your own words."

### US-1.D.1 — Metric extraction from free-form transcript
- **As** Sonakshi **I want** the app to understand what I said in my own words **so that** I don't have to answer a questionnaire when I already explained.
- **Functional requirement:** `extractMetrics(transcript): Partial<CheckinMetrics>` calls LLM with a strict JSON schema for the 5 metrics. Returns partial if some aren't inferable. No hallucination: if unsure, omit rather than guess.
- **Acceptance:**
  - **UX:** extraction completes within 3s (p50) from transcript end.
  - **UI:** n/a.
  - **Backend / data:** LLM call routed through a server action. Prompt tested with ≥20 fixtures covering: all-5-covered, 3-of-5, 0-of-5, ambiguous pain, mood-only, medication-negation ("forgot"), flare language ("it's really bad today").
  - **UX copy:** none (prompt is internal).

### US-1.D.2 — Coverage check (ADR-005)
- **As** the flow **I want** to know whether Stage 2 is needed **so that** we skip scripted prompts when open-first already covered everything.
- **Functional requirement:** `coverage(metrics): { covered: Metric[], missing: Metric[] }`. If `missing.length === 0`, state machine transitions `processing → confirming` directly. Otherwise `processing → scripted`.
- **Acceptance:**
  - **UX:** invisible decision point; user does not see Stage 2 if not needed.
  - **UI:** n/a.
  - **Backend / data:** pure function; unit-tested.
  - **UX copy:** none.

### US-1.E.1 — Scripted prompt flow for missing metrics
- **As** Sonakshi **I want** gentle follow-up questions only for the things I didn't mention **so that** it doesn't feel like a form.
- **Functional requirement:** `<ScriptedPrompt metric={...} />` renders one prompt at a time for each missing metric in fixed order (pain → mood → adherence → flare → energy). Voice answer or tap answer both accepted. Progresses to next missing metric on answer.
- **Acceptance:**
  - **UX:** each prompt full-screen, one question visible; skip allowed (marks metric as "not answered" — state machine decides if required). Back arrow returns to previous prompt.
  - **UI:** large question text; answer area below; orb remains visible for voice; tap input inline.
  - **Backend / data:** state held in reducer, not persisted until save.
  - **UX copy:** pain: "How's pain today, on 1 to 10?" · mood: "And how are you feeling in yourself?" · adherence: "Did you take your meds today?" · flare: "Is this a flare day?" · energy: "Energy — 1 low, 10 full tank?"

### US-1.E.2 — Tap input per metric type
- **As** Sonakshi **I want** to tap when my voice isn't working or I don't want to speak **so that** I can still finish.
- **Functional requirement:** `<TapInput metric={...} />` renders appropriate control: 1–10 slider (pain, energy), chip group (mood), yes/no toggle (adherence, flare). Updates reducer on change.
- **Acceptance:**
  - **UX:** controls usable one-handed on small phones. Values visible and adjustable before submit.
  - **UI:** 44pt min hit targets; slider shows numeric value above thumb; chips min 2-per-row.
  - **Backend / data:** values typed to metric's schema.
  - **UX copy:** mood chips: "heavy", "flat", "okay", "bright", "great". Adherence: "took them" / "missed". Flare: "yes, flaring" / "not a flare".

### US-1.F.1 — Confirmation summary card
- **As** Sonakshi **I want** to see what the app understood **so that** I can fix anything wrong before saving.
- **Functional requirement:** `<ConfirmSummary metrics={...} onEdit={...} onSave={...} />` displays all 5 metrics as editable rows. Tap a row → inline TapInput (1.E) to amend.
- **Acceptance:**
  - **UX:** review takes <10s to scan. Edit is one tap + one adjust + done. Save is a single tappable primary button at the bottom.
  - **UI:** each row: metric label + current value + edit affordance. Save button full-width, sticky bottom.
  - **Backend / data:** values still in reducer; save triggers `createCheckin` mutation.
  - **UX copy:** heading "Here's what I heard". Save button: "Save today's check-in". Edit affordance aria: "Edit {metric}".

### US-1.F.2 — Save + error + retry
- **As** Sonakshi **I want** a clear outcome when I save **so that** I know it worked (or what to do if not).
- **Functional requirement:** On save, call `createCheckin`. Success → transition to `saved` (brief confirmation + route to home). Error (network / duplicate / validation) → render Feature 10 save-fail template with retry button that re-invokes mutation.
- **Acceptance:**
  - **UX:** saved confirmation visible ≥1.5s with haptic tick, then auto-route. Error is non-dismissible until retry or explicit "save later" (queues in-memory for this session).
  - **UI:** success: full-screen confirmation with orb in "settled" state. Error: edge-case template with clear next action.
  - **Backend / data:** retry passes same `clientRequestId` so mutation is idempotent.
  - **UX copy:** success heading: "Got it. See you tomorrow, Saumya's here." Error: "Couldn't save just now. Try again?" Save-later button: "Keep this for later".

---

## Review notes

(Filled in after build cycles.)

## Learnings

(Filled in post-ship.)
