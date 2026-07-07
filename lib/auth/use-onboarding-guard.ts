'use client'

/**
 * useOnboardingGuard — direct-link guard for post-onboarding surfaces
 * (Home.US-2 pattern, previously inlined in /home, /medications and
 * /medications/setup). Reads `readProfile()?.onboarded` in an effect so
 * SSR never touches localStorage; redirects to /onboarding/1 when the
 * profile is missing or not onboarded.
 *
 * Returns `true` only once the check has passed — callers render a blank
 * shell until then so un-onboarded users never see a flash of content.
 *
 * This is the future auth-gate mount point: W3 (auth) swaps the
 * localStorage check for a session check without touching call sites.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { readProfile } from '@/lib/profile/storage'

export function useOnboardingGuard(): boolean {
  const router = useRouter()
  const [allowed, setAllowed] = useState<boolean>(false)

  useEffect(() => {
    const profile = readProfile()
    if (!profile || profile.onboarded !== true) {
      router.replace('/onboarding/1')
      return
    }
    setAllowed(true)
  }, [router])

  return allowed
}
