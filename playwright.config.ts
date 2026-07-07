/**
 * Playwright config — Layer 4 of the QA pass for F04 (Medications).
 *
 * Sequential execution, no retries — we want
 * deterministic signal, not flake-tolerance. Webserver builds and serves
 * the production bundle against the dev Convex (`hardy-hamster-888`) so
 * the specs exercise the real frontend↔dev-Convex round-trip without
 * dev-mode compile latency or dev-only behaviors; no mocking.
 */

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    // Local Pavlov backend often holds 3000; pin Saha to 3001 so QA never
    // collides with another project's dev server.
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'pnpm build && pnpm exec next start -p 3001',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    {
      name: 'chromium',
      // Voice-telemetry specs need their own launch flags — keep them out
      // of the default project so F04/F05 runs stay byte-identical.
      testIgnore: /voice-telemetry/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // A2 voice-telemetry harness (e2e/voice-telemetry-smoke.spec.ts).
      // Fake media device feeds the real AudioContext/AudioWorklet
      // recorder; fake UI auto-grants the mic prompt. Autoplay is pinned
      // to user-gesture-required so the cold-mount greeting TTS is
      // deterministically blocked and the spec enters the loop with an
      // orb tap (after the PostHog sink is installed) — see the spec
      // header for the race this closes.
      name: 'voice-telemetry',
      testMatch: /voice-telemetry/,
      use: {
        ...devices['Desktop Chrome'],
        // Playwright's default headless build is the stripped
        // "chromium headless shell", which has NO media-capture support —
        // getUserMedia rejects NotSupportedError there regardless of the
        // fake-device flags (verified 2026-07-08). `channel: 'chromium'`
        // opts into the full Chromium build's new headless mode, where
        // capture works.
        channel: 'chromium',
        permissions: ['microphone'],
        // The orb runs an infinite motion-safe pulse animation that keeps
        // Playwright's actionability "stable" check from ever settling.
        // The app is reduced-motion aware, so emulate it — animations off,
        // clicks land deterministically. (`reducedMotion` is a context
        // option, not a first-class test option — hence contextOptions.)
        contextOptions: { reducedMotion: 'reduce' },
        launchOptions: {
          args: [
            '--use-fake-ui-for-media-capture',
            '--use-fake-device-for-media-capture',
            '--autoplay-policy=user-gesture-required',
          ],
        },
      },
    },
  ],
})
