/**
 * App Router 404 (W2-1, Lane 1B). Server component — no client state
 * needed. Saha copy voice: warm, no blame, route back to solid ground.
 */

import Link from 'next/link'

export default function NotFound(): React.JSX.Element {
  return (
    <main
      data-testid="app-not-found"
      className="grain flex min-h-screen items-center justify-center px-6"
      style={{ background: 'var(--bg)', color: 'var(--ink)' }}
    >
      <section
        className="w-full max-w-md rounded-2xl border p-6"
        style={{ borderColor: 'var(--rule)', background: 'var(--bg-card)' }}
      >
        <p className="type-label" style={{ color: 'var(--ink-muted)' }}>
          Page not found
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
          I couldn&rsquo;t find that page.
        </h1>
        <p className="type-body mt-3" style={{ color: 'var(--ink-muted)' }}>
          The link may be old, or the page may have moved.
        </p>
        <div className="mt-5">
          <Link
            href="/home"
            data-testid="app-not-found-home"
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
            Back to home
          </Link>
        </div>
      </section>
    </main>
  )
}
