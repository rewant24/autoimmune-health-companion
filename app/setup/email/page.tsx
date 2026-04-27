'use client'

/**
 * /setup/email — Setup B step 3.
 *
 * Onboarding Shell cycle, Build-B (Chunk B). Setup.US-3.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { EmailField, isValidEmail } from '@/components/setup/EmailField'
import { SetupShell } from '@/components/setup/SetupShell'
import {
  readProfile,
  redirectTargetForSetup,
  writeProfile,
} from '@/lib/profile/storage'

export default function SetupEmailPage(): React.JSX.Element {
  const router = useRouter()
  const [value, setValue] = useState('')

  useEffect(() => {
    const prior = readProfile()
    const target = redirectTargetForSetup('email', prior)
    if (target !== null) {
      router.replace(`/setup/${target}`)
      return
    }
    if (prior?.email) setValue(prior.email)
  }, [router])

  const valid = isValidEmail(value)

  const next = () => {
    if (!valid) return
    writeProfile({ email: value.trim().toLowerCase() })
    router.push('/setup/condition')
  }

  return (
    <SetupShell
      step={3}
      heading="What's your email?"
      subhead="For sign-in later. Stays with Saha."
      disabled={!valid}
      onNext={next}
    >
      <EmailField
        value={value}
        onChange={setValue}
        onSubmit={next}
        autoFocus
      />
    </SetupShell>
  )
}
