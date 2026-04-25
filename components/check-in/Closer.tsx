'use client'

/**
 * Closer — renders the paired closer text above the Save CTA on the
 * summary card and (later, in 2.E) on the saved-route view.
 *
 * Feature 01, Chunk 2.D, US-1.F.1.
 *
 * The text itself is selected by `lib/saumya/closer-engine.ts` (Build-A)
 * from the same `ContinuityState` snapshot used to pick the opener — so
 * opener and closer always rhyme in tone for a given session. Closer
 * lines are ≤ 8 words and never use any of the phrases ruled out by
 * ADR-009 ("one day at a time", "be kind to yourself", etc.). This
 * component is dumb — it just renders.
 *
 * The optional `onSpeak` prop is the hook for the TTS replay affordance
 * delivered in 2.E. When undefined, the speaker icon is hidden.
 */

import type { ReactNode } from 'react'

export interface CloserProps {
  text: string
  /**
   * Optional TTS replay handler. Wired by chunk 2.E (`<SpokenOpener>`'s
   * sibling for the closer). Hidden when undefined.
   */
  onSpeak?: () => void
}

export function Closer({ text, onSpeak }: CloserProps): React.JSX.Element {
  return (
    <p className="flex items-center justify-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
      <span data-testid="closer-text">{text}</span>
      {onSpeak !== undefined ? (
        <button
          type="button"
          aria-label="Replay closer"
          onClick={onSpeak}
          className={
            'inline-flex h-7 w-7 items-center justify-center rounded-full ' +
            'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }
        >
          {/* Inline speaker glyph — no icon-library dependency. */}
          <SpeakerGlyph />
        </button>
      ) : null}
    </p>
  )
}

function SpeakerGlyph(): ReactNode {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="currentColor"
    >
      <path d="M3 10v4h4l5 4V6L7 10H3zm13.5 2a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z" />
    </svg>
  )
}
