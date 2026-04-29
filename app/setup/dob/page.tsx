'use client'

/**
 * /setup/dob — Setup B step 2.
 *
 * Onboarding Shell cycle, Build-B (Chunk B). Setup.US-2.
 *
 * 2026-04-29 tweak: optional + month/year only. Next is always enabled.
 * Orphan-month (month set without year) is allowed in the UI with an inline
 * hint, and coerced to (null, null) on persist.
 *
 * Direct-link guard: if a strictly-prior step (name) is unfilled, redirect.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import {
  composeDobMonthYear,
  DOBField,
  type DOBValue,
} from '@/components/setup/DOBField'
import { SetupShell } from '@/components/setup/SetupShell'
import {
  readProfile,
  redirectTargetForSetup,
  writeProfile,
} from '@/lib/profile/storage'

export default function SetupDobPage(): React.JSX.Element {
  const router = useRouter()
  const [value, setValue] = useState<DOBValue>({
    month: null,
    year: null,
  })

  useEffect(() => {
    const prior = readProfile()
    const target = redirectTargetForSetup('dob', prior)
    if (target !== null) {
      router.replace(`/setup/${target}`)
      return
    }
    if (prior) {
      setValue({ month: prior.dobMonth, year: prior.dobYear })
    }
  }, [router])

  const next = () => {
    const { dobMonth, dobYear } = composeDobMonthYear(value)
    writeProfile({ dobMonth, dobYear })
    router.push('/setup/email')
  }

  return (
    <SetupShell
      step={2}
      heading="When were you born?"
      subhead="Optional — helps Saha anchor patterns over time."
      disabled={false}
      onNext={next}
    >
      <DOBField value={value} onChange={setValue} />
    </SetupShell>
  )
}
