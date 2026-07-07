/**
 * Playwright config — Layer 4 of the QA pass for F04 (Medications).
 *
 * Single chromium project, sequential execution, no retries — we want
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
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
