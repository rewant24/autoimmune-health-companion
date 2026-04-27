'use client'

/**
 * /setup/dob — Setup B step 2.
 *
 * Onboarding Shell cycle, Build-B (Chunk B). Setup.US-2.
 *
 * Direct-link guard: if a strictly-prior step (name) is unfilled, redirect.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import {
  composeDobIso,
  DOB_DEFAULT_YEAR,
  DOBField,
  isValidDob,
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
    day: null,
    year: DOB_DEFAULT_YEAR,
  })

  useEffect(() => {
    const prior = readProfile()
    const target = redirectTargetForSetup('dob', prior)
    if (target !== null) {
      router.replace(`/setup/${target}`)
      return
    }
    if (prior?.dobIso) {
      const [y, m, d] = prior.dobIso.split('-').map(Number)
      if (
        Number.isInteger(y) &&
        Number.isInteger(m) &&
        Number.isInteger(d)
      ) {
        setValue({ year: y, month: m, day: d })
      }
    }
  }, [router])

  const valid = isValidDob(value)

  const next = () => {
    if (!valid) return
    const iso = composeDobIso(value)
    if (iso === null) return
    writeProfile({ dobIso: iso })
    router.push('/setup/email')
  }

  return (
    <SetupShell
      step={2}
      heading="When were you born?"
      subhead="Saha uses this to anchor patterns over time."
      disabled={!valid}
      onNext={next}
    >
      <DOBField value={value} onChange={setValue} />
    </SetupShell>
  )
}
