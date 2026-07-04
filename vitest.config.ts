import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    // `*.live.test.ts` files run under `vitest.integration.config.ts` (node env,
    // no convex/react mock, real ConvexHttpClient). Excluding them here keeps
    // `pnpm test` fast and free of network calls. Also exclude tests/integration
    // for the same reason (those have their own config).
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'tests/integration/**',
      'tests/**/*.live.test.ts',
    ],
    // Workaround: default `forks`/`threads` pools time out spawning workers
    // when the project lives on a path with spaces or `+` (this volume:
    // `/Volumes/Coding Projects + Docker/`). vmThreads sidesteps the worker
    // path resolution that hits the bug.
    pool: 'vmThreads',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      // Next resolves the bare `server-only` marker through its compiler;
      // Vite can't. Tests that import server-only modules directly
      // (e.g. lib/voice/sarvam-tts-server) need the inert stub.
      'server-only': path.resolve(__dirname, 'tests/stubs/server-only.ts'),
    },
  },
})
