import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Integration test config — Layer 1 of the F04 QA pass.
 *
 * Runs against the live dev Convex deployment (hardy-hamster-888) using
 * `ConvexHttpClient`. Crucially:
 *   - environment is `node` (not jsdom) — we need real fetch + no DOM.
 *   - NO setupFiles — `tests/setup.ts` registers a global `convex/react`
 *     mock that would defeat the whole point of these tests.
 *   - testTimeout is generous because each Convex round-trip is real network.
 *   - pool is `threads`. `vmThreads` (used by the unit-test config to dodge a
 *     worker-spawn bug on paths with spaces) interferes with `ConvexHttpClient`
 *     because of how it isolates fetch / global state.
 *
 * Run with: `pnpm test:integration` (script in package.json).
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: [
      "tests/integration/**/*.test.ts",
      // F04 layer 2 — live LLM contract tests for /api/check-in/extract-medication.
      // Default unit-test config (jsdom + global convex/react mock) cannot run
      // these; node env + real ConvexHttpClient is required.
      "tests/api/**/*.live.test.ts",
    ],
    testTimeout: 30000,
    // Single-thread pool. `vmThreads` (used by the unit-test config to dodge a
    // worker-spawn bug on paths with spaces) interferes with `ConvexHttpClient`
    // — it isolates fetch / global state per-test in ways that break the queue.
    pool: "threads",
    isolate: true,
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
