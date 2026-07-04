/**
 * Vitest stub for Next.js's `server-only` marker import. Next resolves
 * the bare specifier through its compiler; Vite can't, so tests that
 * import server-only modules directly (e.g. `lib/voice/sarvam-tts-server`)
 * alias it here. The guard's protection is a Next build concern — in
 * tests it is intentionally inert.
 */
export {};
