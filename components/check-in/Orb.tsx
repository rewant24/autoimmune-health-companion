'use client'

/**
 * Orb — the primary tap target for the daily check-in screen.
 *
 * Feature 01, Chunk 1.C, US-1.C.2.
 *
 * - 4 visual states driven by `orbState` prop (idle / listening /
 *   processing / error).
 * - Min tap target is 176px (w-44 h-44) — well past the 44pt WCAG minimum.
 * - Tailwind utilities + shared `@keyframes` from `OrbStates.tsx`. No JS
 *   animation libraries.
 * - `prefers-reduced-motion` is respected via Tailwind's `motion-safe:`
 *   variants AND a media-query override on `.orb-animated`.
 * - Haptic feedback on tap via `navigator.vibrate(50)` (best-effort, wrapped
 *   in try/catch; feature-detected).
 *
 * Visual state definitions live in `OrbStates.tsx`. This component is
 * intentionally thin — it reads the map, composes the className, wires the
 * button semantics, and emits the tap.
 */

import { ORB_KEYFRAMES, ORB_STATES, type OrbVisualState } from './OrbStates'

export interface OrbProps {
  orbState: OrbVisualState
  onTap: () => void
  /**
   * Optional transient text rendered inside the orb (e.g. "Listening" or
   * the first few words of a partial transcript). Not required for
   * semantics — the aria-label covers that — but useful visually.
   */
  label?: string
  /**
   * Escape hatch for tests and wrappers. Not part of the normal UI surface.
   */
  disabled?: boolean
}

export function Orb({ orbState, onTap, label, disabled }: OrbProps): React.JSX.Element {
  const visual = ORB_STATES[orbState]

  const handleTap = (): void => {
    if (disabled) return
    // Haptic feedback — best-effort only. Feature-detected + try/catch so a
    // browser that advertises but then throws (some WebViews do) can't break
    // the tap.
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(50)
      } catch {
        // swallow — haptics are non-critical.
      }
    }
    onTap()
  }

  return (
    <>
      {/* Keyframes + reduced-motion override rendered once with the orb. */}
      <style>{ORB_KEYFRAMES}</style>
      <button
        type="button"
        aria-label={visual.ariaLabel}
        aria-live="polite"
        data-orb-state={orbState}
        disabled={disabled}
        onClick={handleTap}
        className={`orb-animated ${visual.className} disabled:opacity-60`}
      >
        {label ? (
          <span className="px-6 text-center text-sm font-medium leading-snug opacity-90">
            {label}
          </span>
        ) : null}
      </button>
    </>
  )
}
