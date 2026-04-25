'use client'

/**
 * /setup/name — Setup B step 1.
 *
 * Onboarding Shell cycle, Build-B (Chunk B). Setup.US-1.
 *
 * Captures the name field. No upstream-step guard (this is the first step).
 * On Next: writes `name` (trimmed) to the profile and routes to /setup/dob.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { isValidName, NameField } from '@/components/setup/NameField'
import { SetupShell } from '@/components/setup/SetupShell'
import { readProfile, writeProfile } from '@/lib/profile/storage'

export default function SetupNamePage(): React.JSX.Element {
  const router = useRouter()
  const [value, setValue] = useState('')

  // Hydrate from any prior profile (e.g. user pressed back from /setup/dob).
  useEffect(() => {
    const prior = readProfile()
    if (prior?.name) setValue(prior.name)
  }, [])

  const valid = isValidName(value)

  const next = () => {
    if (!valid) return
    writeProfile({ name: value.trim() })
    router.push('/setup/dob')
  }

  return (
    <SetupShell
      step={1}
      heading="What should Saha call you?"
      subhead="First name is fine."
      disabled={!valid}
      onNext={next}
    >
      <NameField
        value={value}
        onChange={setValue}
        onSubmit={next}
        autoFocus
      />
    </SetupShell>
  )
}
