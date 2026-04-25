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
    // Workaround: default `forks`/`threads` pools time out spawning workers
    // when the project lives on a path with spaces or `+` (this volume:
    // `/Volumes/Coding Projects + Docker/`). vmThreads sidesteps the worker
    // path resolution that hits the bug.
    pool: 'vmThreads',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
