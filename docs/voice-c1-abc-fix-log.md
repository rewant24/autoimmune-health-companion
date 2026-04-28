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

### Fix B — float StopButton + SwitchToTapsButton above BottomNav — DONE

**Status:** committed (see commit hash in log tail)

**Approach:** swapped `sticky bottom-4 z-10` → `fixed inset-x-0 z-50`
with a Tailwind arbitrary `[bottom:calc(5rem+env(safe-area-inset-bottom))]`
on both buttons. Increased ScreenShell's bottom padding to clear both
the BottomNav (~64px) and the floating button row (~44px tap target).

**Files changed (3):**
- `components/check-in/StopButton.tsx` — wrapper className flipped to
  `fixed`/`z-50`/safe-area-aware bottom; doc-comment updated.
- `components/check-in/SwitchToTapsButton.tsx` — identical change
  (these two affordances mirror each other by design).
- `components/check-in/ScreenShell.tsx` — bottom padding bumped from
  `max(1.5rem, env(safe-area-inset-bottom))` to
  `calc(8rem + env(safe-area-inset-bottom))` so the centred orb stays
  clear of both floating layers.

**Why `bottom:calc(5rem + env(safe-area-inset-bottom))` instead of
plain `bottom-20`:** BottomNav grows by `env(safe-area-inset-bottom)`
on iOS notch / home-indicator devices via its internal padding-bottom.
A plain `bottom-20` (5rem from viewport edge) would let the safe-area
eat into the gap above the nav. Adding the same env() expression to
the button keeps the ~16px breathing room consistent across devices.

**Tests touched:** none. The two test files lock in the click contract
+ fade-in + reduced-motion behaviour on the inner `<button>`; neither
asserts on the outer wrapper's positional className. All 759 tests
still pass.

**Verification:**
- `tsc --noEmit`: clean
- `npm run test:run`: **759/759** (unchanged)
- `npm run build`: clean

**Notes:**
- ScreenShell's existing `flex-col items-center justify-center` keeps
  the orb visually centred. The added bottom padding shifts the centre
  slightly upward (by half the added padding), which is the desired
  effect — the orb should never sit beneath the floating buttons.
- Manual smoke recommended to confirm orb position on real device
  viewports; vitest can't catch layout overlap.

### Fix C — autoplay-blocked greeting cue (Option 1) — DONE

**Status:** committed (see commit hash in log tail)

**Approach:** extended `idle-ready` state with `greetingBlocked?:
boolean`, set true only via the `GREETING_FAILED` route in the reducer.
Page reads the flag to swap subcopy and pass `highlightSpeaker` to
SpokenOpener. SpokenOpener renders an attention ring around the
speaker icon and switches its accessible label to "Tap to hear
greeting" when highlighted.

**Files changed (5):**
- `lib/checkin/state-machine.ts` — `idle-ready` shape gains optional
  `greetingBlocked` field; `idle-greeting` reducer split into separate
  `GREETING_PLAYED` (no flag) and `GREETING_FAILED` (`greetingBlocked:
  true`) cases.
- `components/check-in/SpokenOpener.tsx` — new optional
  `highlightSpeaker` prop. When true (and TTS is available), the
  speaker button gets `ring-2 ring-teal-400 ring-offset-2
  motion-safe:animate-pulse`. The `motion-safe:` variant means the
  pulse only animates when `prefers-reduced-motion: no-preference` —
  the ring stays visible regardless. Accessible label switches from
  "Replay" → "Tap to hear greeting" so screen readers surface the
  intent.
- `app/check-in/page.tsx` — idle-ready render block reads
  `state.greetingBlocked === true` and threads it into both the
  `highlightSpeaker` prop and the conditional subcopy ("Tap the
  speaker to hear how Saha greets you, then tap the orb to begin." vs
  the existing "Tap the orb and tell me in your own words.").
- `tests/check-in/state-machine.test.ts` — replaced the single
  GREETING_PLAYED/FAILED-equivalence test with two distinct cases:
  FAILED produces `greetingBlocked: true`; PLAYED leaves it
  undefined.
- `tests/check-in/spoken-opener.test.tsx` — three new cases under
  "highlightSpeaker prop": default (no highlight), highlight on
  (ring + pulse classes present), accessible-label swap.

**Why Option 1 over Option 2:** Option 2 (orb-as-greeting-trigger on
first tap when blocked, then listening on second tap) would alter the
TAP_ORB → requesting-permission contract that the
`useCheckinMachine` hook side-effects on. That's a bigger blast
radius — reducer + hook + tests all touch that path. Option 1 stays
purely additive: existing transitions are unchanged, the optional flag
defaults to undefined, and the visual cue rides on the existing
SpokenOpener speaker button. If smoke shows the ring isn't drawing
enough attention, we can layer Option 2 on top later — they're not
mutually exclusive.

**Verification:**
- `tsc --noEmit`: clean
- `npm run test:run`: **763/763** (was 759; +1 state-machine, +3
  SpokenOpener)
- `npm run build`: clean

**Notes:**
- Reduced-motion behaviour relies on Tailwind's `motion-safe:` variant.
  In jsdom (the test environment) `prefers-reduced-motion` doesn't
  match by default, so the test verifies the class string contains
  `motion-safe:animate-pulse` rather than runtime-checking the
  computed animation.
- The `data-highlight="true"` attribute is added when highlighting so
  manual smoke can grep the DOM without depending on the className
  string format.

### Fix D — AudioContext.resume on start — DONE

**Status:** committed as `bd5ff10`

**Approach:** added `if (context.state === 'suspended') await context.resume()` in `SarvamRecorder.start()` after AudioContext construction (before `createMediaStreamSource`).

**Why:** Chrome treats an AudioContext created after an awaited promise (the `await getUserMedia` in the adapter) as past the user-gesture window and starts it `suspended`. The worklet wires up but pulls no samples → recorder produces zero PCM chunks → server-side `socket.flush()` throws "Cannot flush: no audio input has been received." `resume()` restarts the audio thread and is a no-op on already-running contexts.

**Files changed (2):**
- `lib/voice/sarvam-recorder.ts` — guarded `resume()` after context creation in `start()`.
- `tests/voice/sarvam-recorder.test.ts` — `FakeAudioContext` defaults `state: 'suspended'` (mirrors prod Chrome path), exposes `async resume() { state = 'running' }`. New lifecycle test asserts `state === 'running'` after `start()`.

**Verification:**
- `tsc --noEmit`: clean
- recorder test: 19/19 (was 18 + 1 new)
- `npm run test:run`: **764/764**
- `npm run build`: clean

**Notes:**
- Confirmed via 2026-04-28 manual smoke that this was the cause of bug #2: user tapped orb, granted mic, spoke, transcription failed with "Cannot flush". Independent of Fix E.

### Fix E — auto-progress greeting → listening — DONE

**Status:** committed as `692b2b1`

**Approach:** reducer routes `GREETING_PLAYED` from `idle-greeting` to `requesting-permission` (auto-progress, ADR-026). `GREETING_FAILED` still routes to `idle-ready { greetingBlocked: true }` for the autoplay-blocked manual-gate path. New hook effect fires `provider.start()` on entering `requesting-permission` from `idle-greeting` or `idle-ready`. The TAP_ORB interceptor was simplified to only fire `start()` on cold `idle` (where it owns the opener payload); `idle-greeting` / `idle-ready` taps now just dispatch TAP_ORB and let the new effect handle `start()`.

**Why:** the A/B/C fix-pass over-applied the manual gate to both played and failed paths. The original Voice C1 design (ADR-026) is opener → automatic listening; only the autoplay-blocked path should require a manual tap.

**Files changed (2):**
- `lib/checkin/state-machine.ts` — reducer `idle-greeting` case + `useCheckinMachine` hook (new `priorStateRef`, new `requesting-permission` effect, simplified TAP_ORB interceptor).
- `tests/check-in/state-machine.test.ts` — 2 reducer tests updated for new transition; 4 hook tests added: auto-progress fires `start()`, cold-tap regression (opener payload still attached via interceptor), no double-fire on cold tap, `greetingBlocked` manual tap fires `start()` via effect.

**Verification:**
- `tsc --noEmit`: clean
- state-machine test: 80/80 (was 76 + 4 new hook tests)
- `npm run test:run`: **768/768** (was 764 from Fix D)
- `npm run build`: clean

**Notes:**
- `app/check-in/page.tsx` idle-ready render block was left untouched. Its non-`greetingBlocked` branch is now dead state-machine code (no transition lands there) but pruning is out of scope; the live `greetingBlocked === true` path still renders the same block.
- `priorStateRef` is internal hook plumbing — not visible to the reducer, not exported. Avoids a shape change on `requesting-permission` that would touch every test that constructs that state.
- Manual smoke (Phase 3 of `~/.claude/plans/async-brewing-peacock.md`) outstanding.

### Fix F.1 — silence VAD owned by hook — DONE

**Status:** committed as `00c08a9`

**Approach:** added optional `onSilence(cb)` to `VoiceProvider`; SarvamAdapter fans the recorder's silence event out to listeners instead of calling `this.stop()` directly. The hook subscribes alongside `onPartial` / `onError`, calls `provider.stop()`, and dispatches `PROVIDER_STOPPED` with the resolved transcript — same path as a manual tap. A `stopInitiatedRef` dedupes silence + late tap into a single `stop()` invocation per turn; the ref resets when the reducer leaves `listening` / `listening-answer`.

**Why:** Fix D unblocked PCM chunk flow → recorder's silence VAD started firing for the first time → adapter's internal `stop()` POSTed the audio and got a transcript back, but discarded the returned `Promise<Transcript>`. The hook never learned about it, so the reducer was stranded in `listening` while the audio had already been processed. Users tapped a stale `<StopButton>`, which raced a second `stop()` that produced an empty POST and a `"stop() called before start()"` error. This is not a regression of Fix D — it's a pre-existing architectural gap that Fix D made observable for the first time.

**Files changed (6):**
- `lib/voice/types.ts` — `VoiceProvider` gains optional `onSilence(cb)`; web-speech adapter and OpenAI stub omit it (no VAD source).
- `lib/voice/sarvam-adapter.ts` — `silenceListeners` array + public `onSilence(cb)`; recorder.onSilenceDetected fans out to listeners instead of self-stopping.
- `lib/checkin/state-machine.ts` — `stopInitiatedRef`, `provider.onSilence?(...)` subscription in the provider-callback effect, ref-reset effect on state.kind transitions, dedupe guard in the TAP_ORB listening branch.
- `tests/voice/sarvam-adapter-streaming.test.ts` — flipped the silence test: asserts the listener fires and `recorder.stopCalls === 0` (adapter no longer auto-stops).
- `tests/voice/sarvam-adapter.test.ts` — `makeFakeRecorder` gains `onSilenceDetected` + `fireSilence` seam; new buffered-mode silence test.
- `tests/check-in/state-machine.test.ts` — `FakeProvider` gains `onSilence` + `fireSilence` seam; 2 new hook tests: silence dispatches `PROVIDER_STOPPED` end-to-end, late tap after silence is a no-op (single `stop()` call).

**Verification:**
- `tsc --noEmit`: clean
- `npm run test:run`: **771/771** (768 baseline + 3 new)
- `npm run build`: clean across 17 routes

### Fix F.2 — SarvamAdapter.stop() reentrancy guard — DONE

**Status:** committed as `ed5c369`

**Approach:** cached the in-flight stop promise on `this.stopPromise`; concurrent callers share it instead of re-running the buffered POST. The cache is set **synchronously** (before any await) so a re-entrant call sees it; the body of `stop()` is extracted into a private `runStopFlow()` so the wrapper can assign `stopPromise = this.runStopFlow()` and return immediately. Cleared in `resetTurnState` so the next turn re-arms cleanly. Serial-post-resolve behaviour is unchanged — the `!started` guard still throws `"stop() called before start()"` for callers who arrive after the turn is over.

**Why:** A second concurrent `stop()` (silence VAD racing a manual tap, or any future double-call) used to run the buffered POST a second time with now-empty `pcmChunks`, producing an empty POST that Sarvam rejected with `"Cannot flush: no audio input has been received."` First attempt at the guard set `stopPromise` *after* an `await`, so two callers that entered before the first await both progressed past the guard and fired duplicate POSTs — the test caught this on the first run; refactor to `runStopFlow()` fixed it.

**Files changed (2):**
- `lib/voice/sarvam-adapter.ts` — `stopPromise` field + `runStopFlow()` extraction; `resetTurnState` clears `stopPromise`.
- `tests/voice/sarvam-adapter.test.ts` — concurrent stop() shares one POST + same transcript; serial stop() after first resolves throws via `!started` guard (preserves existing behaviour).

**Verification:**
- `tsc --noEmit`: clean
- `npm run test:run`: **773/773** (771 baseline + 2 new)
- `npm run build`: clean across 17 routes

## Manual smoke checklist (after all five commits — A, B, C, D, E, F)

Walk these on `npm run dev` (Chrome) before declaring shipped:

- [ ] **Fix A:** profile name (set via Setup or `saha.testUser.v1` /
  profile localStorage) appears interpolated in opener — e.g. "Hey
  Rewant — glad you're here." With profile cleared / null name, line
  collapses to "Hey — glad you're here."
- [ ] **Fix B:** during a listening turn, StopButton is visible above
  the BottomNav at viewport bottom. Same for SwitchToTapsButton during
  voice-dialog states. Orb is not covered.
- [ ] **Fix C:** open `/check-in` in a fresh tab (no prior gesture).
  Chrome should block autoplay; the speaker icon next to the opener
  text shows a teal pulse ring and the subcopy reads "Tap the
  speaker to hear how Saha greets you, then tap the orb to begin."
  Tapping the speaker plays the greeting; tapping the orb proceeds to
  listening.
- [ ] **Fix F.1 (autoplay-blocked path):** after Fix C above, tap the
  orb → grant mic → speak ~3s, then stay silent ≥1.5s. Orb
  auto-progresses to "Thinking…" with the heard transcript. Network
  shows exactly one `POST /api/transcribe` (audio bytes), one SSE
  final frame with non-empty text. **No** `<StopButton>` tap required.
- [ ] **Fix F.1 (autoplay-allowed path):** after MEI grants autoplay
  (typically after one prior interaction with the page), reload
  `/check-in`. Opener plays automatically; mic prompt fires without an
  orb tap. Grant mic → speak ~3s, then stay silent. Orb
  auto-progresses just like above. **No** `"stop() called before
  start()"` in the console; **no** `"Cannot flush"` in the dev
  terminal.
- [ ] **Fix F.1 edge — tap before silence:** speak ~1s, tap StopButton
  immediately. One POST, one PROVIDER_STOPPED.
- [ ] **Fix F.1 edge — tap after silence:** speak, fall silent, wait
  for auto-stop, then tap StopButton anyway. Tap is a no-op (guard
  swallowed); no error toast.
- [ ] **Fix F.2:** during the same flow, dev tools network tab shows
  exactly one `POST /api/transcribe` per turn (not two). Mute toggle
  / reduced-motion still behave as before.
