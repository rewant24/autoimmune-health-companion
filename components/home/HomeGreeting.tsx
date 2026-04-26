'use client'

/**
 * HomeGreeting — top section of /home.
 *
 * Onboarding Shell cycle, Chunk C, Home.US-1.
 *
 *   - "Welcome, [name]" personalized when name is present.
 *   - Falls back to plain "Welcome" if name missing.
 *   - Reads profile client-side to avoid SSR localStorage access.
 */

import { useEffect, useState } from 'react'

import { readProfile } from '@/lib/profile/storage'

export function HomeGreeting(): React.JSX.Element {
  const [name, setName] = useState<string | null>(null)

  useEffect(() => {
    const profile = readProfile()
    setName(profile?.name ?? null)
  }, [])

  const trimmed = name?.trim() ?? ''
  const personalized = trimmed.length > 0

  return (
    <header data-testid="home-greeting" className="px-6 pt-10 pb-4">
      <p className="type-label">Today</p>
      <h1
        className="mt-3"
        style={{
          fontFamily: 'var(--font-fraunces)',
          fontSize: 'clamp(1.625rem, 4vw, 2.25rem)',
          lineHeight: 1.1,
          letterSpacing: '-0.01em',
          fontVariationSettings: "'SOFT' 100, 'opsz' 48, 'wght' 420",
          color: 'var(--ink)',
        }}
      >
        {personalized ? `Welcome, ${trimmed}` : 'Welcome'}
      </h1>
    </header>
  )
}
