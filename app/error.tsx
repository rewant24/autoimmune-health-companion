'use client'

/**
 * App Router error boundary (W2-1, Lane 1B). Catches render/runtime errors
 * anywhere under the root layout and offers a retry instead of a white
 * screen. Saha copy voice: first-person, no blame, one clear action.
 */

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}): React.JSX.Element {
  return (
    <main
      data-testid="app-error"
      className="grain flex min-h-screen items-center justify-center px-6"
      style={{ background: 'var(--bg)', color: 'var(--ink)' }}
    >
      <section
        className="w-full max-w-md rounded-2xl border p-6"
        style={{ borderColor: 'var(--rule)', background: 'var(--bg-card)' }}
      >
        <p className="type-label" style={{ color: 'var(--ink-muted)' }}>
          Something broke
        </p>
        <h1
          className="mt-3"
          style={{
            fontFamily: 'var(--font-fraunces)',
            fontSize: '1.25rem',
            lineHeight: 1.25,
            fontVariationSettings: "'SOFT' 100, 'opsz' 24, 'wght' 420",
          }}
        >
          I hit a snag I couldn&rsquo;t recover from.
        </h1>
        <p className="type-body mt-3" style={{ color: 'var(--ink-muted)' }}>
          Nothing you saved is lost. Let&rsquo;s try that again.
        </p>
        <div className="mt-5">
          <button
            type="button"
            data-testid="app-error-retry"
            onClick={reset}
            className={
              'inline-flex min-h-11 items-center justify-center rounded-full ' +
              'px-5 text-[15px] font-medium transition-colors ' +
              'focus-visible:outline-none focus-visible:ring-2 ' +
              'focus-visible:ring-offset-2'
            }
            style={{
              background: 'var(--sage-deep)',
              color: 'var(--bg-elevated)',
            }}
          >
            Try again
          </button>
        </div>
      </section>
    </main>
  )
}
