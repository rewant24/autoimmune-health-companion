/**
 * Orb visual state map (Feature 01, Chunk 1.C, US-1.C.2).
 *
 * Each visual state collects:
 *   - `className`: Tailwind utilities applied to the orb element
 *   - `ariaLabel`: spoken by screen readers and used as the button label
 *
 * Animation is driven by `@keyframes` defined in a shared `<style>` tag
 * rendered once by `<Orb>` (keeps the component file clean and avoids a
 * CSS module build step). All motion is wrapped in a `prefers-reduced-motion`
 * guard via Tailwind's `motion-safe:` variant.
 *
 * No JS animation library — Tailwind + CSS keyframes only, per build plan
 * and the feature's locked decisions.
 */

export type OrbVisualState = 'idle' | 'listening' | 'processing' | 'error'

export interface OrbVisualDefinition {
  className: string
  ariaLabel: string
}

const BASE =
  'relative inline-flex items-center justify-center w-44 h-44 rounded-full ' +
  'select-none outline-none ring-offset-2 ring-offset-background ' +
  'focus-visible:ring-2 focus-visible:ring-teal-400 ' +
  'transition-[transform,background-color,box-shadow] duration-500'

/**
 * State → Tailwind class string + aria label. Exported so tests can
 * assert we actually map every state and that labels stay in sync with
 * the copy locked in US-1.C.2.
 */
export const ORB_STATES: Record<OrbVisualState, OrbVisualDefinition> = {
  idle: {
    className:
      `${BASE} bg-teal-500 text-white shadow-[0_0_60px_-10px_rgba(20,184,166,0.55)] ` +
      // Soft pulse — only when motion is allowed.
      'motion-safe:animate-[orb-pulse_3.2s_ease-in-out_infinite]',
    ariaLabel: 'Start daily check-in',
  },
  listening: {
    className:
      `${BASE} bg-teal-400 text-white scale-105 ` +
      'shadow-[0_0_110px_-10px_rgba(45,212,191,0.75)] ' +
      // Breathing bloom — larger, slower, more presence.
      'motion-safe:animate-[orb-bloom_2.4s_ease-in-out_infinite]',
    ariaLabel: 'Stop check-in',
  },
  processing: {
    className:
      `${BASE} bg-gradient-to-br from-teal-400 via-teal-500 to-cyan-500 ` +
      'text-white shadow-[0_0_80px_-10px_rgba(20,184,166,0.6)] ' +
      // Indeterminate swirl — rotate the gradient.
      'motion-safe:animate-[orb-swirl_2.2s_linear_infinite]',
    ariaLabel: 'Processing...',
  },
  error: {
    className:
      `${BASE} bg-red-500/70 text-white ` +
      'shadow-[0_0_60px_-10px_rgba(239,68,68,0.55)] ' +
      'motion-safe:animate-[orb-pulse_2.4s_ease-in-out_infinite]',
    ariaLabel: 'Something went wrong — tap to retry',
  },
}

/**
 * Shared keyframes. Rendered once by `<Orb>` via a `<style>` tag. Kept
 * here so visual state + its motion stay colocated.
 *
 * The media query inside the keyframe CSS is a second guard on top of
 * Tailwind's `motion-safe:` variant — defence in depth for users who
 * toggle reduced-motion at the OS level.
 */
export const ORB_KEYFRAMES = `
@keyframes orb-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50%      { transform: scale(1.04); opacity: 0.92; }
}
@keyframes orb-bloom {
  0%, 100% { transform: scale(1.05); box-shadow: 0 0 90px -10px rgba(45,212,191,0.55); }
  50%      { transform: scale(1.14); box-shadow: 0 0 140px -10px rgba(45,212,191,0.85); }
}
@keyframes orb-swirl {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
@media (prefers-reduced-motion: reduce) {
  .orb-animated { animation: none !important; transform: none !important; }
}
`
