/**
 * Re-export shim — original `tts-adapter.ts` was renamed to
 * `web-speech-tts-adapter.ts` during voice C1 pre-flight (ADR-026).
 *
 * Kept until Wave 2 wires `SpokenOpener.tsx` (and any remaining
 * cycle-2 tests) through `getTtsProvider()` from `./provider`. Trash
 * this file at the start of Wave 2's orchestrator integration.
 */
export * from './web-speech-tts-adapter'
export type * from './web-speech-tts-adapter'
