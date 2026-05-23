# Voice telemetry — PostHog (Layer 2)

> **Status:** scoping (2026-05-23). Layer 1 already in main: `lib/voice/log.ts` structured logger with `setVoiceLogSink` seam. Layer 2 swaps the default console sink for PostHog. Decision locked 2026-05-23: **PostHog only, sink-swappable for future telemetry providers**.

## Why PostHog (recap from the Sentry-vs-PostHog decision)

The Layer 1 event mix is 8 behavioral (lifecycle + guard) + 1 error. PostHog fits the dominant signal: funnel analytics on `rearm_fired`, `tap_stop_skipped`, `silence_stop_skipped` reveal *how common* each race-condition guard fires in prod — which is precisely the kind of signal that would have caught PR #21's regression before users hit it. Sentry's surface is best for thrown exceptions; voice failures are silent state-machine traps, not throws.

PostHog's native exception capture covers the 1 `error` site at acceptable fidelity. If that proves too thin in practice (no sourcemap-resolved traces), add Sentry as a second sink later via the existing seam — no migration, just a multiplexing sink.

## Swap-friendliness contract (locked)

The `lib/voice/log.ts` seam is the swap point. Any future telemetry provider plugs in by implementing `VoiceLogSink` and calling `setVoiceLogSink(nextSink)`. No call sites change. Documented here so a future-Rewant (or another engineer) doesn't have to re-derive this.

```ts
// Pattern for any provider — Sentry, Datadog, custom:
import { setVoiceLogSink, type VoiceLogSink } from '@/lib/voice/log'

const myProviderSink: VoiceLogSink = {
  log(category, fields) {
    // adapt {event, source, ...rest} to the provider's API
  },
}
setVoiceLogSink(myProviderSink)
```

A **multiplexing sink** (fan out to multiple providers) is a 5-line wrapper if/when we add a second provider:

```ts
function multiplex(...sinks: VoiceLogSink[]): VoiceLogSink {
  return { log: (cat, f) => sinks.forEach(s => { try { s.log(cat, f) } catch {} }) }
}
setVoiceLogSink(multiplex(posthogSink, sentrySink))
```

## Decisions to lock (4)

### D1. PostHog cloud region — **recommend: US (`us.i.posthog.com`)**

| Region | Reasoning |
|---|---|
| **US (recommend)** | Lower latency to Vercel's default infrastructure; free tier identical; no DPDP-specific obligation today (Saha is pre-auth, no PII in voice events — only event names + structured non-PII fields). |
| EU | Picks itself only if a hard data-residency requirement lands (e.g., a future EU enterprise customer). Can be re-pointed via env var without code change. |

Pre-staging: `NEXT_PUBLIC_POSTHOG_HOST` env var makes this a single Vercel-env edit if requirements change.

### D2. Initialization location — **recommend: app shell (`app/layout.tsx`-adjacent)**

| Option | Pros | Cons |
|---|---|---|
| **App shell (recommend)** | Captures non-voice events too once we start adding them (auth funnel, check-in completion, navigation). PostHog SDK is ~15 KB gzip — acceptable for a baseline product analytics layer. | Loads on every route, including landing page. |
| Check-in page only | Lazier; voice-only surface | Doesn't pay off the "PostHog = product analytics backbone" bonus the decision rested on. |

The PostHog init code is conditional on `NEXT_PUBLIC_POSTHOG_KEY` being present — local dev without the env var = no PostHog activity = no console noise.

### D3. Session replay — **recommend: ENABLED, with masking defaults**

Session replay is PostHog's biggest differentiator for voice debugging. When a user reports "Saha got stuck on the second question," replay lets us *see* the orb state + DOM at the moment without asking the user for a HAR. For voice specifically — where the symptom is often "UI froze but I'm not sure why" — replay is high-value.

| Concern | Mitigation |
|---|---|
| PII in replay (transcripts on screen) | PostHog's default masks all `input` + `[contenteditable]`. Add `data-ph-mask="true"` to the transcript caption + check-in card values. |
| Cost (replay quota) | Free tier covers ~5,000 sessions/mo. At Saha's current scale (<100 users), unconstrained. Sample-rate the capture (`session_recording.sample_rate: 1.0` now, lower later if volume grows). |
| Performance | Replay records DOM mutations; voice page is lightweight DOM. Negligible. |

If you'd rather not ship replay on day one, flip to disabled now — re-enable later is a single config change, no migration.

### D4. Anonymous ID strategy — **recommend: tie to existing `saha.testUser.v1` localStorage stub**

| Option | Pros | Cons |
|---|---|---|
| **Tie to `saha.testUser.v1` (recommend)** | Sessions across check-ins on the same browser stitch into one PostHog person. When auth lands, `posthog.identify(realUserId)` aliases the anon ID forward — no data loss. | Tied to an existing localStorage convention that pre-dates auth. |
| Auto-generated | Zero coupling | Each PostHog person is a single session; can't track funnel across check-ins for the same user. Useless for the "how common is this race" question. |

The tie is a single `posthog.identify(localStorage.getItem('saha.testUser.v1'))` call at init.

## Implementation plan (after decisions lock)

1. **Install** `posthog-js` (client-side, `pnpm add posthog-js`).
2. **Create** `lib/voice/sink-posthog.ts` — implements `VoiceLogSink`, maps `(category, fields)` → `posthog.capture(`voice_${event}`, { category, ...fields })`. ~30 lines.
3. **Bootstrap** in a new client component `app/providers/PostHogProvider.tsx` that:
   - Guards on `NEXT_PUBLIC_POSTHOG_KEY` presence (no-op locally without env).
   - Calls `posthog.init(...)` with chosen region + replay config.
   - Calls `setVoiceLogSink(posthogSink)`.
   - Identifies the user via D4 strategy on mount.
4. **Wire** the provider into `app/layout.tsx` above existing providers.
5. **Env vars** — add to Vercel (per `feedback_vercel_preview_env_pattern.md`, expect redeploy):
   - `NEXT_PUBLIC_POSTHOG_KEY` — project API key (PostHog dashboard → Settings → Project API Key)
   - `NEXT_PUBLIC_POSTHOG_HOST` — `https://us.i.posthog.com` per D1
6. **Tests** — adapter unit test (mock posthog, assert capture shape per category). No integration test for the provider itself (PostHog SDK is the integration; we don't test their SDK).
7. **Smoke** — local dev with a test PostHog project's key in `.env.local`, walk one voice turn, confirm events land in the PostHog UI.
8. **Document** — add a one-liner to `docs/architecture-changelog.md` pointing at this doc.

Out of scope for this PR: auth-funnel events, check-in completion events, navigation events. PostHog provides those for free via autocapture, but adding deliberate event taxonomy is a separate pass once auth lands.

## What ships in PR

- `lib/voice/sink-posthog.ts` + unit test
- `app/providers/PostHogProvider.tsx`
- Wire-up in `app/layout.tsx`
- env-var entries in Vercel (manual step per the preview-env pattern)
- This scoping doc (already committed)

## Rollback path

If PostHog turns out to be the wrong call:
1. Remove the `setVoiceLogSink(posthogSink)` line — sink falls back to default console.
2. Uninstall `posthog-js`.
3. Drop the provider + env vars.
No call sites in `sarvam-adapter.ts` or `state-machine.ts` change. The seam protects us.
