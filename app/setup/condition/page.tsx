'use client'

/**
 * /setup/condition — Setup B step 4 (final).
 *
 * Onboarding Shell cycle, Build-B (Chunk B). Setup.US-4 + Setup.US-5
 * (direct-link guard: redirects to earliest missing step if a prior field
 * is empty).
 *
 * On Next: writes condition + conditionOther and routes to /welcome.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import {
  ConditionField,
  isValidCondition,
  type ConditionFieldValue,
} from '@/components/setup/ConditionField'
import { SetupShell } from '@/components/setup/SetupShell'
import {
  readProfile,
  redirectTargetForSetup,
  writeProfile,
} from '@/lib/profile/storage'

export default function SetupConditionPage(): React.JSX.Element {
  const router = useRouter()
  const [value, setValue] = useState<ConditionFieldValue>({
    condition: null,
    conditionOther: null,
  })

  useEffect(() => {
    const prior = readProfile()
    const target = redirectTargetForSetup('condition', prior)
    if (target !== null) {
      router.replace(`/setup/${target}`)
      return
    }
    if (prior?.condition) {
      setValue({
        condition: prior.condition,
        conditionOther: prior.conditionOther,
      })
    }
  }, [router])

  const valid = isValidCondition(value)

  const next = () => {
    if (!valid) return
    writeProfile({
      condition: value.condition,
      conditionOther:
        value.condition === 'other'
          ? (value.conditionOther?.trim() ?? '')
          : null,
    })
    router.push('/welcome')
  }

  return (
    <SetupShell
      step={4}
      heading="Which condition are you living with?"
      subhead="Pick the closest one. You can always add more later."
      disabled={!valid}
      onNext={next}
    >
      <ConditionField value={value} onChange={setValue} />
    </SetupShell>
  )
}
