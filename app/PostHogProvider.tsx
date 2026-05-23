"use client"

/**
 * PostHog bootstrap + voice-logger sink installer.
 *
 * Initializes the PostHog client on mount when `NEXT_PUBLIC_POSTHOG_KEY`
 * is present. Without the env var (local dev, preview without
 * configured env), this component is a pass-through — the voice logger
 * falls back to its default console sink so dev-mode debugging keeps
 * working without external dependencies.
 *
 * D1–D4 decision lock 2026-05-23 (see `docs/features/voice-telemetry-posthog.md`):
 *  - D1 US cloud region (`https://us.i.posthog.com` default)
 *  - D2 init in app shell (this component wraps everything in
 *    `app/layout.tsx`)
 *  - D3 session replay enabled with input masking + transcript-mask
 *    selector
 *  - D4 anonymous ID tied to existing `saha.testUser.v1` localStorage
 *    convention so sessions stitch across check-ins; identify-forward
 *    when auth lands
 *
 * Swap-friendliness: the sink itself is installed via `setVoiceLogSink`
 * (lib/voice/log.ts). Replacing PostHog later means replacing this file
 * + the sink adapter; no other call sites touch.
 */
import { useEffect, type ReactNode } from "react"
import posthog from "posthog-js"

import { setVoiceLogSink, resetVoiceLogSink } from "@/lib/voice/log"
import { makePosthogVoiceSink } from "@/lib/voice/sink-posthog"

const TEST_USER_KEY = "saha.testUser.v1"

export function PostHogProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    if (typeof window === "undefined" || !key) {
      // No-op in SSR or when the key is missing. The default console
      // sink in `lib/voice/log.ts` stays active.
      return
    }

    const host =
      process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com"

    posthog.init(key, {
      api_host: host,
      // D3: session replay enabled with masking defaults. PostHog masks
      // <input> + <textarea> + [contenteditable] by default; the extra
      // selector covers per-element opt-ins for transcript captions /
      // check-in card values that render plain text.
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: '[data-ph-mask="true"]',
      },
      // Next.js App Router: posthog-js's default `capture_pageview: true`
      // causes a React hydration mismatch (React error #418) because the
      // SDK's history-hook injects DOM state before reconciliation
      // completes. Disable here; voice telemetry is what we care about,
      // and autocapture still catches clicks/form-submits. If we later
      // need page-views, follow PostHog's documented App Router pattern
      // (separate <PageviewTracker> client component using
      // usePathname/useSearchParams).
      capture_pageview: false,
      // Avoid noisy capture in dev consoles when key is local-only.
      loaded: () => {
        // D4: stitch sessions to the existing localStorage stub if
        // present. We do not create a stub here — voice pages already
        // own that lifecycle. If absent, PostHog keeps its own
        // auto-generated anon ID and aliases forward whenever auth /
        // testUser writes one.
        const stub = window.localStorage.getItem(TEST_USER_KEY)
        if (stub) {
          posthog.identify(stub)
        }
        // Install the voice-logger sink so `voiceLog(...)` calls in
        // sarvam-adapter + state-machine route to PostHog.
        setVoiceLogSink(makePosthogVoiceSink(posthog))
      },
    })

    return () => {
      // Restore the default console sink on unmount. In practice the
      // provider lives at the layout root so this only fires on a full
      // app teardown (HMR, tests).
      resetVoiceLogSink()
    }
  }, [])

  return <>{children}</>
}
