# Feature 01 Cycle 1 (Daily Check-in — Foundation) Build Plan

> **Branch:** `feat/f01-cycle-1` off `main` at `1a4ab10` (docs scaffold)
> **Created:** 2026-04-25 · **Owner:** orchestrator (Claude Code main)
> **Methodology:** Project Process Playbook — parallel build + parallel review + second-pass.

## Resume guide

Every phase boundary gets an annotated git tag. To restart from any phase:

```bash
cd "/Volumes/Coding Projects + Docker/autoimmune-health-companion"
git checkout feat/f01-cycle-1
git reset --hard <tag>     # or: git checkout <tag> for read-only inspection
```

| Tag | What's in the tree at this tag |
|---|---|
| `f01-c1/plan-saved` | This plan file committed. Nothing built. |
| `f01-c1/pre-flight-done` | Vitest infra installed, `tests/setup.ts`, scripts in package.json. |
| `f01-c1/build-integrated` | Build-A/B/C slices merged, tests + tsc + build green. |
| `f01-c1/reviewed` | Review findings collected (no code change — review is read-only). |
| `f01-c1/fixed` | Fix pass applied, all green. |
| `f01-c1/second-pass-clean` | Second reviewer returned clean (or follow-up fixes applied). |
| `f01-c1/shipped` | Feature MD status flipped, changelog + system-map updated. |

A **phase entry** is appended to `docs/build-log.md` at every tag so a fresh session can resume without re-reading subagent transcripts.

---

**Goal:** Ship the foundation of Daily Voice Check-in — voice provider abstraction (Web Speech + OpenAI Realtime stub), Convex `checkIns` table + CRUD, and the orb UI + state machine + route.

**Architecture:** 3 disjoint chunks, one owner each.
- 1.A owns `lib/voice/**` — pure client lib, no React.
- 1.B owns `convex/**` additions — schema append + `checkIns.ts`.
- 1.C owns `app/(check-in)/**` + `components/check-in/**` + `lib/checkin/state-machine.ts` — UI + orchestration.

Integration seam = typed interfaces in `lib/voice/types.ts`. 1.C injects the provider from 1.A; does not yet call 1.B's mutation (save is wired in Cycle 2's chunk 1.F).

**Tech stack:** Next.js 16 App Router · React 19 (server components + `'use client'` for voice/orb) · TypeScript 5 strict · Convex 1.36 · Tailwind 4 · Vitest (added in pre-flight) · Web Speech API (browser-native).

**Locked decisions — do NOT re-litigate:**
- ADR-005: skip Stage 2 when open-first covers all 5 metrics.
- 48h edit window (F02 concern, not this cycle).
- Mood enum: `heavy | flat | okay | bright | great`.
- `createCheckin` is NOT called in Cycle 1; orb state-machine `onSave` is a logging no-op.
- OpenAI Realtime is a stub throwing `NotImplementedError`.
- Error templates are a slot stub; Feature 10 fills later.
- Language guardrail: "support-system", never "caregiver"/"squad".

---

## Task 0: Pre-flight (orchestrator-only, before dispatch)

**Why:** Parallel agents write to disjoint slices, but shared substrate (test runner, top-level dirs) must exist first or races + duplicate setups happen.

**Files touched:**
- Create: `vitest.config.ts`, `tests/setup.ts`
- Modify: `package.json` (add `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `@vitejs/plugin-react` devDeps; add `"test"` and `"test:run"` scripts)

**Steps:**
- [ ] Verify repo clean on `feat/f01-cycle-1`
- [ ] `npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom`
- [ ] Write `vitest.config.ts` (jsdom env, React plugin, `tests/setup.ts` setupFiles)
- [ ] Write `tests/setup.ts` importing `@testing-library/jest-dom/vitest`
- [ ] Add `"test": "vitest"`, `"test:run": "vitest run"` to `package.json`
- [ ] Smoke test: trivial `tests/smoke.test.ts`, run `npm run test:run`, delete
- [ ] Commit: `chore: add vitest + testing-library infra for feature 01`
- [ ] Tag `f01-c1/pre-flight-done`

---

## Task 1: Build dispatch — 3 subagents in ONE multi-tool-call message

Verbatim dispatch prompts live below. All three fire in a single message (parallel execution).

### Build-A prompt (Chunk 1.A — voice provider abstraction)

Files OWNED: `lib/voice/types.ts`, `lib/voice/provider.ts`, `lib/voice/web-speech-adapter.ts`, `lib/voice/openai-realtime-adapter.ts` (stub), `tests/check-in/voice-provider.test.ts`, `tests/check-in/web-speech-adapter.test.ts`

Do NOT touch: `convex/**`, `components/**`, `app/**`, `lib/checkin/**`

Stories: US-1.A.1 provider interface · US-1.A.2 Web Speech adapter (locale `en-IN`, typed errors) · US-1.A.3 OpenAI Realtime stub throwing `NotImplementedError`, selected by `VOICE_PROVIDER` env flag default `web-speech`.

Test approach: mock `SpeechRecognition` via a minimal fake on `globalThis`. Vitest, no React.

Commit per story (Conventional Commits, `feat(voice): …`).

### Build-B prompt (Chunk 1.B — Convex data model + mutations)

Files OWNED: `convex/schema.ts` (APPEND `checkIns` — keep `waitlist`), `convex/checkIns.ts` (new), `tests/check-in/convex-checkins.test.ts`

Do NOT touch: `components/**`, `app/**`, `lib/**`

Stories: US-1.B.1 `checkIns` table (fields + `by_user_date` index + `clientRequestId` for idempotency) · US-1.B.2 `createCheckin` mutation (validates ranges, throws `DuplicateCheckinError`, idempotent on `clientRequestId`) · US-1.B.3 `listCheckins` (paged by `date desc`, with `fromDate`/`toDate`) + `getCheckin(id)`, auth-gated.

Mood enum: `heavy | flat | okay | bright | great` (scoping-verbatim).

Migration note: append to `docs/architecture-changelog.md`.

Test approach: pick between `convex-test` (install if needed) or plain handler tests with a mock ctx. Document choice at top of test file.

Commit per story.

### Build-C prompt (Chunk 1.C — orb UI + state machine + route)

Files OWNED: `app/(check-in)/layout.tsx`, `app/(check-in)/page.tsx`, `components/check-in/Orb.tsx`, `components/check-in/OrbStates.tsx`, `components/check-in/ScreenShell.tsx`, `lib/checkin/state-machine.ts`, `tests/check-in/state-machine.test.ts`, `tests/check-in/orb.test.tsx`

Do NOT touch: `convex/**`, `lib/voice/**`, `components/check-in/ConfirmSummary|ScriptedPrompt|TapInput` (Cycle 2).

**Interface contract with Build-A:** import **types only** from `lib/voice/types.ts` — never the adapter implementation. Provider injected via prop/context. `VoiceProvider`, `Transcript`, `VoiceError` union expected.

Stories: US-1.C.1 state machine (pure reducer + `useCheckinMachine()` hook; states idle → requesting-permission → listening → processing → confirming → saving → saved|error) · US-1.C.2 orb visual (4 states, ≥44pt tap target, Tailwind + CSS keyframes only, prefers-reduced-motion, WCAG AA) · US-1.C.3 `/check-in` route with `<ScreenShell>` + orb + error-template slot stub + auth gate (redirect to `/` if no user).

`'use client'` on Orb, ScreenShell, and page.tsx. State-machine `onSave` logs only (no mutation call in C1).

Commit per story.

---

## Task 2: Integrate slices

Post-parallel: verify no file-ownership overlap, check type-contract seam, run the stack green.

- [ ] `git log --name-only --since="2 hour ago"` — cross-check owned files vs what each agent actually created
- [ ] Read `lib/voice/types.ts` exports vs what `lib/checkin/state-machine.ts` imports — mismatches noted (not fixed yet)
- [ ] `npm run test:run` → all green expected
- [ ] `npx tsc --noEmit` → clean
- [ ] `npm run build` → clean Next build
- [ ] Tag `f01-c1/build-integrated`

Any issues found here go to the fix list in Task 4 (don't pre-empt reviewer findings).

---

## Task 3: Review dispatch — 3 reviewers in ONE multi-tool-call message

All three read the delta from `f01-c1/pre-flight-done..HEAD`.

### Review-1 (brief alignment)
- Every story's 4-lane acceptance (UX/UI/backend/UX-copy) satisfied or explicitly deferred
- Copy drift: "support-system" (never caregiver/squad); mood chips verbatim; aria-labels match; empty-state copy verbatim
- Scope creep outside Cycle 1
- Missing acceptance criteria

### Review-2 (spec + regression)
- ADR-005 honored (state machine supports direct processing→confirming)
- `waitlist` table still exported; new index no collision
- `/` route still works; auth gate doesn't regress
- Type contract — `lib/voice/types.ts` exports match `app/(check-in)` imports; no `any` leaks
- Next 16 App Router idioms; `'use client'` placement

### Review-3 (edge cases)
- Voice: permission-denied, no-speech, network, unsupported, aborted paths tested
- State machine: tap during processing/saving; partial after stop(); double-tap on idle
- Convex: duplicate `(userId, date)` via `clientRequestId`; midnight-IST rollover; invalid ranges (pain=0, pain=11)
- UI: prefers-reduced-motion; 44pt tap; WCAG AA error red; aria-label toggles
- Feature 10 hook: `<ErrorSlot>` stub present?

Merge findings into one ordered fix list grouped by chunk. Tag `f01-c1/reviewed` (no code change — review is read-only; tag marks review completion).

---

## Task 4: Fix pass

- [ ] Triage: blocker → major → minor; discard anything re-litigating locked decisions (see top)
- [ ] Apply smallest-diff fixes
- [ ] Re-run tests + tsc + build
- [ ] Commit: `fix(check-in): address F01 C1 review findings` (body lists findings)
- [ ] Tag `f01-c1/fixed`

---

## Task 5: Second-pass review

One Agent call. Prompt includes the locked-decisions list + first-pass summary. Looks for 1–2 missed items.

- [ ] Dispatch second-pass reviewer
- [ ] If clean: tag `f01-c1/second-pass-clean`, proceed
- [ ] If findings: one more fix commit max, then tag `f01-c1/second-pass-clean`

**Stop condition:** if second-pass finds blocker-level issues that need more than one fix commit, stop and flag for morning.

---

## Task 6: Ship

- [ ] `docs/features/01-daily-checkin.md` — chunks 1.A/1.B/1.C → `shipped`
- [ ] `docs/architecture-changelog.md` — append dated entry
- [ ] `docs/system-map.md` — reflect Cycle 1 shipped
- [ ] `docs/build-log.md` — session entry (what shipped, reviewer notes, surprises)
- [ ] `~/.claude/projects/-Users-rewantprakash-1/memory/MEMORY.md` — update Sakhi "Next" line to Cycle 2 or pause
- [ ] Commit: `docs: ship F01 C1 — update statuses, changelog, system-map, build-log`
- [ ] Tag `f01-c1/shipped`

Morning brief: overnight summary appended to `docs/build-log.md`.

---

## Stop conditions (apply throughout)

- After 2 fix-pass iterations still red → stop, don't ship, morning brief.
- Reviewer blocker that conflicts with a locked decision → discard, note, don't wake.
- `tsc` or `next build` can't be resolved without touching `scoping.md` → stop.
- Convex schema: verified locally, **not pushed** to deployment.
- No `git push`. No force-push. Local-only.
