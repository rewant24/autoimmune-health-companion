# Voice C1 — A/B/C Fix Log

> Working log for the three follow-on bugs that surfaced during the
> 2026-04-27 local-smoke walk of Voice C1 (Sarvam mode). One commit per
> fix; dev-only constraint (no push, no Vercel, no Convex). Started after
> Voice C1 fix-pass commit `ff4bf29` on `feat/voice-sarvam`.

## Context

Smoke walk of Sarvam-mode voice loop in Chrome on `next dev` surfaced three
real bugs (plus one suspected #4 that the user judged collateral of #2):

- **A — "Hey Sonakshi" hardcoded across opener/closer variants.** Persona
  placeholder from scoping never got templated. Profile storage already
  has `name: string | null` (onboarding writes it); engines just don't
  read it.
- **B — StopButton + SwitchToTapsButton hidden behind BottomNav.** Both
  were `sticky bottom-4 z-10`; BottomNav is `fixed inset-x-0 bottom-0
  z-40`, so the nav sat over the buttons. Server logs confirmed
  `/api/transcribe` was firing — listening was entering, the user just
  never saw the affordance.
- **C — Autoplay blocked → silent opener.** Chrome blocks `audio.play()`
  on cold-mount when the navigation gesture didn't carry over.
  `GREETING_FAILED` lands the state machine in `idle-ready` correctly,
  but the subcopy doesn't tell the user they need to tap the speaker
  icon to hear the greeting.

Plan and ordering (A → B → C) drafted in the same session; user approved.

## Prior attempts on this issue

### Fix A — already shipped on `main` as PR #8 (`2cc3074`, 2026-04-27)

PR rewant24/autoimmune-health-companion#8 — *"fix(check-in): plumb
runtime profile name through opener/closer engines"* — already solved
exactly this on `main`:

- `OPENER_VARIANTS` flipped from `Record<key, string>` → `Record<key,
  (name: string | null) => string>` builders.
- `selectOpener` / `selectCloser` accept optional `name` (default
  `null`).
- Empty/null name collapses cleanly to a name-less form ("Hey — glad
  you're here.").
- `app/check-in/page.tsx` reads `readProfile()?.name` post-mount and
  threads it through the two `useMemo` calls + the streak closer.
- Drops `(Sonakshi)` parenthetical and gendered pronouns from the
  metric-extraction system prompt (`lib/checkin/extract-prompt.ts`).
- Tests: 588/588 passing on main; 4 new name-interpolation cases.

**Why we're touching this again:** `feat/voice-sarvam` was branched
*before* PR #8 landed on main. The voice-sarvam branch never picked up
the fix, so the same 11 "Sonakshi" hardcodes still live in
`lib/saha/variants.ts` on this branch.

**Strategy:** cherry-pick `2cc3074` onto `feat/voice-sarvam`. Conflict
expected only on `app/check-in/page.tsx` (heavy voice-c1 surface area —
~539 line diff vs. main); the other six files in `2cc3074` are
untouched on this branch since b79f494 (rebrand) and a5361ed (F01 C2
ship) — both already present.

### Fix B — no prior attempt
First time these affordances are being lifted above BottomNav. They were
introduced in voice-c1 fix-pass `ff4bf29` and predecessor commits with
the `sticky bottom-4 z-10` shape from day one.

### Fix C — no prior attempt
The `GREETING_FAILED` event was added during voice-c1 wave 2 with the
explicit intent of degrading gracefully to `idle-ready` (per voice-c1
plan §3 risk #2), but the subcopy / cue work was deferred. This fix
closes that loop.

## Constraints (this session)

- Stay on `feat/voice-sarvam`. Working tree was clean at session start.
- One commit per fix.
- No `git push`, no `vercel`, no `convex` commands until Rewant
  explicitly promotes.
- Run vitest + tsc + `next build` after each fix.
- 755/755 vitest baseline (post-`ff4bf29`).

## Per-fix log

### Fix A — name parameterization — DONE

**Status:** committed as `26a2830` (cherry-pick of `2cc3074`)

**Approach:** cherry-picked `2cc3074` from main. Auto-merged cleanly on
`app/check-in/page.tsx`; no manual conflict resolution needed.

**Files changed** (7, identical to PR #8):
- `lib/saha/variants.ts` — `OPENER_VARIANTS` + `streakMilestoneOpener`
  flipped to `(name) => string` builders; `nameOrNull()` helper for
  trim + empty normalization; null-name path collapses to "Hey —
  glad you're here." etc.
- `lib/saha/opener-engine.ts` — `selectOpener(state, name?)` threads
  through.
- `lib/saha/closer-engine.ts` — `selectCloser(state, name?)` ditto.
- `lib/checkin/extract-prompt.ts` — drops "(Sonakshi)" + gendered
  pronouns from the LLM extraction system prompt.
- `app/check-in/page.tsx` — `profileName` state populated post-mount
  via `readProfile()?.name ?? null`; passed into `selectOpener`,
  `selectCloser`, and the streak-closer call site.
- `tests/check-in/opener-engine.test.ts` — 4 new name-interpolation
  cases (interpolates, null strips, empty treated as null, streak
  builder).
- `tests/check-in/screen-shell.test.tsx` — assertion update for the
  null-name path.

**Verification:**
- `tsc --noEmit`: clean
- `npm run test:run`: **759/759** (was 755 — +4 from PR #8 cases)
- `npm run build`: clean

**Sonakshi residue:** two remaining hits, both in descriptive code
comments (`lib/checkin/types.ts:49` and `lib/saha/variants.ts:14`)
explaining the scoping persona. Not user-facing; PR #8 left them
alone too. Leaving as-is.

**Notes:**
- Author of `26a2830` is preserved as the original PR #8 author
  (rp1827@nyu.edu) since cherry-pick keeps authorship. Committer is
  the current user.
- No push.

### Fix B — float StopButton + SwitchToTapsButton above BottomNav

**Status:** pending

**Approach:** swap `sticky bottom-4 z-10` → `fixed inset-x-0 bottom-20
z-50` in both components; add bottom padding to ScreenShell so the orb
and transcript don't overlap.

**Files expected to change:**
- `components/check-in/StopButton.tsx`
- `components/check-in/SwitchToTapsButton.tsx`
- `components/check-in/ScreenShell.tsx`
- `tests/check-in/stop-button.test.tsx` (className assertion if any)
- `tests/check-in/switch-to-taps-button.test.tsx`

**Result:** _(filled in after commit)_

### Fix C — autoplay-blocked greeting cue (Option 1)

**Status:** pending

**Approach:** extend `idle-ready` state with `greetingBlocked?: boolean`
flag, set true only when reached via `GREETING_FAILED`. Conditional
subcopy; pulse the existing speaker icon on `SpokenOpener` when
`highlightSpeaker` prop is true. Respect `prefers-reduced-motion`.

**Files expected to change:**
- `lib/checkin/state-machine.ts`
- `app/check-in/page.tsx`
- `components/check-in/SpokenOpener.tsx`
- `tests/check-in/state-machine.test.ts`
- `tests/check-in/spoken-opener.test.tsx`

**Alternative (Option 2 — orb-as-greeting-trigger):** considered, not
chosen. Would change the orb→listening contract on first tap when
`GREETING_FAILED` was seen. Bigger blast radius; more state-machine
surgery. Park unless Option 1 doesn't read well in smoke.

**Result:** _(filled in after commit)_
