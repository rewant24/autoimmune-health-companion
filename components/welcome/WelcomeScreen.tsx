'use client'

/**
 * WelcomeScreen — Saha-voice greeting card.
 *
 * Onboarding Shell cycle, Chunk C, Welcome.US-1.
 *
 * Locked decisions:
 *   - Brand voice = "endurance + together," NOT "gentle / soft / calm."
 *     Sanskrit सह — to endure, with.
 *   - Pulls `name` from `readProfile()`. Falls back to a graceful default
 *     ("here") if name is null (e.g. user landed on /welcome directly without
 *     completing Setup B — direct-link guard upstream redirects, but this
 *     fallback keeps the screen renderable rather than crashing).
 *   - Single CTA "Open my home page" → /home.
 *   - Marks `markOnboarded()` on mount so future visits to / show
 *     "Open your home page" instead of "Get started."
 *   - Welcome IS the welcome moment (Q7) — no email send, no toast.
 *
 * Copy is placeholder pending Rewant; tagged TODO(rewant-copy).
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'

import { markOnboarded, readProfile } from '@/lib/profile/storage'

export function WelcomeScreen(): React.JSX.Element {
  const [name, setName] = useState<string | null>(null)

  useEffect(() => {
    // Pull the name from the persisted profile and flip onboarded → true.
    // SSR-safe: storage helpers no-op outside the browser; effect runs only
    // after hydration so this is fine.
    const existing = readProfile()
    setName(existing?.name ?? null)
    markOnboarded()
  }, [])

  const greetingName = name && name.trim().length > 0 ? name : null

  return (
    <main
      className="grain relative min-h-screen flex items-center justify-center px-6 py-12"
      style={{ background: 'var(--bg)', color: 'var(--ink)' }}
    >
      <section
        data-testid="welcome-screen"
        className="w-full max-w-lg rounded-3xl border p-8 sm:p-10"
        style={{
          borderColor: 'var(--rule)',
          background: 'var(--bg-elevated)',
        }}
      >
        <p className="type-label">Welcome to Saha</p>

        {/* TODO(rewant-copy): final greeting wording — must read in the
            "endurance + together" voice, not "gentle / soft / calm." */}
        <h1
          className="mt-4"
          style={{
            fontFamily: 'var(--font-fraunces)',
            fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
            lineHeight: 1.1,
            letterSpacing: '-0.01em',
            fontVariationSettings: "'SOFT' 100, 'opsz' 48, 'wght' 420",
            color: 'var(--ink)',
          }}
        >
          {greetingName ? (
            <>
              {greetingName}, this is yours to endure
              <br />— and you don&apos;t endure alone.
            </>
          ) : (
            <>
              This is yours to endure
              <br />— and you don&apos;t endure alone.
            </>
          )}
        </h1>

        {/* TODO(rewant-copy): supporting line — keep the सह = endure + with
            framing visible without leaning on "gentle." */}
        <p
          className="type-body mt-6"
          style={{ color: 'var(--ink-muted)' }}
        >
          I&apos;ll hold the days you can&apos;t, and walk beside the days you
          can. We&apos;ll begin with one quiet check-in.
        </p>

        <div className="mt-10">
          <Link
            href="/home"
            data-testid="welcome-cta"
            className={
              'inline-flex min-h-12 items-center justify-center rounded-full ' +
              'px-7 text-[15px] font-medium transition-colors ' +
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2'
            }
            style={{
              background: 'var(--sage-deep)',
              color: 'var(--bg-elevated)',
            }}
          >
            Open my home page
          </Link>
        </div>
      </section>
    </main>
  )
}
