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
 * SSR safety: posthog-js is imported dynamically inside the effect so
 * Next.js App Router never evaluates the module during SSR. A static
 * `import posthog from 'posthog-js'` at module top causes React error
 * #418 (hydration mismatch) on App Router — confirmed in PR #28's
 * preview smoke. The dynamic-import pattern is PostHog's documented
 * Next.js App Router recommendation.
 *
 * Swap-friendliness: the sink itself is installed via `setVoiceLogSink`
 * (lib/voice/log.ts). Replacing PostHog later means replacing this file
 * + the sink adapter; no other call sites touch.
 */
import { useEffect, type ReactNode } from "react"

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

    let cancelled = false

    void import("posthog-js").then(({ default: posthog }) => {
      if (cancelled) return

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
        // hooks history events in a way that collides with App Router
        // hydration. Voice telemetry is what we care about; autocapture
        // still picks up clicks/form-submits.
        capture_pageview: false,
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
          // Stash on window for live debugging / Playwright smokes.
          // posthog-js v1 does not attach the instance to window by
          // default; without this the SDK is reachable only through the
          // bundled module reference, which can't be inspected externally.
          ;(window as unknown as { posthog: typeof posthog }).posthog = posthog
          // Install the voice-logger sink so `voiceLog(...)` calls in
          // sarvam-adapter + state-machine route to PostHog.
          setVoiceLogSink(makePosthogVoiceSink(posthog))
        },
      })
    })

    return () => {
      cancelled = true
      // Restore the default console sink on unmount. In practice the
      // provider lives at the layout root so this only fires on a full
      // app teardown (HMR, tests).
      resetVoiceLogSink()
    }
  }, [])

  return <>{children}</>
}
