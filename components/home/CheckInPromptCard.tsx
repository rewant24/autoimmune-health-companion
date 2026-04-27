'use client'

/**
 * CheckInPromptCard — daily check-in CTA card on /home.
 *
 * Onboarding Shell cycle, Chunk C, Home.US-1.
 *
 *   - Primary button routes to /check-in.
 *   - The persistent mic-icon CTA from scoping § Home page item 6 is
 *     deferred to a polish follow-up (flagged in cycle plan).
 */

import Link from 'next/link'

export function CheckInPromptCard(): React.JSX.Element {
  return (
    <section
      data-testid="checkin-prompt-card"
      className="mx-6 mt-4 rounded-2xl border p-6"
      style={{
        borderColor: 'var(--rule)',
        background: 'var(--bg-card)',
      }}
    >
      <p className="type-label">Daily check-in</p>
      <h2
        className="mt-3"
        style={{
          fontFamily: 'var(--font-fraunces)',
          fontSize: '1.375rem',
          lineHeight: 1.2,
          fontVariationSettings: "'SOFT' 100, 'opsz' 24, 'wght' 420",
          color: 'var(--ink)',
        }}
      >
        Sixty seconds. Speak how today is.
      </h2>
      <p
        className="type-body mt-3"
        style={{ color: 'var(--ink-muted)' }}
      >
        I&apos;ll remember it for you.
      </p>
      <div className="mt-6">
        <Link
          href="/check-in"
          data-testid="checkin-prompt-cta"
          className={
            'inline-flex min-h-12 items-center justify-center rounded-full ' +
            'px-6 text-[15px] font-medium transition-colors ' +
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2'
          }
          style={{
            background: 'var(--sage-deep)',
            color: 'var(--bg-elevated)',
          }}
        >
          Start today&rsquo;s check-in
        </Link>
      </div>
    </section>
  )
}
