'use client'

/**
 * /blood-work — Blood-work module list.
 *
 * F05 Cycle 1, Chunk 5.B, US-5.B.3. Mirrors /visits — tri-state list via
 * `api.bloodWork.listBloodWork`.
 */

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from 'convex/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { api } from '@/convex/_generated/api'
import { BottomNav } from '@/components/nav/BottomNav'
import {
  BloodWorkCard,
  type BloodWorkCardData,
} from '@/components/blood-work/BloodWorkCard'

const TEST_USER_KEY = 'saha.testUser.v1'

function getOrCreateTestUserId(): string | null {
  if (typeof window === 'undefined') return null
  const existing = window.localStorage.getItem(TEST_USER_KEY)
  if (existing) return existing
  const fresh =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `u_${Math.random().toString(36).slice(2)}_${Date.now()}`
  window.localStorage.setItem(TEST_USER_KEY, fresh)
  return fresh
}

type BloodWorkDoc = {
  _id: string
  date: string
  markers: Array<{
    name: string
    value: number
    unit: string
    abnormal?: boolean
  }>
  notes?: string
}

export default function BloodWorkPage(): React.JSX.Element {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    setUserId(getOrCreateTestUserId())
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = useQuery(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api as any).bloodWork?.listBloodWork,
    userId === null ? 'skip' : { userId },
  ) as BloodWorkDoc[] | undefined

  const cards: BloodWorkCardData[] | undefined = useMemo(() => {
    if (rows === undefined) return undefined
    const sorted = [...rows].sort((a, b) => b.date.localeCompare(a.date))
    return sorted.map((r) => ({
      id: r._id,
      date: r.date,
      markers: r.markers.map((m) => ({
        name: m.name,
        value: m.value,
        unit: m.unit,
        abnormal: m.abnormal,
      })),
    }))
  }, [rows])

  return (
    <main
      data-testid="blood-work-page"
      className="grain relative min-h-screen pb-24"
      style={{ background: 'var(--bg)', color: 'var(--ink)' }}
    >
      <div className="mx-auto w-full max-w-2xl px-6 pt-8">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="type-label" style={{ color: 'var(--ink-muted)' }}>
              Blood work
            </p>
            <h1
              className="mt-2"
              style={{
                fontFamily: 'var(--font-fraunces)',
                fontSize: '1.75rem',
                lineHeight: 1.15,
                fontVariationSettings: "'SOFT' 100, 'opsz' 24, 'wght' 420",
              }}
            >
              Your results
            </h1>
          </div>
          <Link
            href="/blood-work/new"
            data-testid="bloodwork-add-cta"
            className="self-end rounded-full px-5 py-2 text-[14px] font-medium"
            style={{
              background: 'var(--sage-deep)',
              color: 'var(--bg-elevated)',
            }}
          >
            + Log blood work
          </Link>
        </header>

        {cards === undefined ? (
          <div
            data-testid="bloodwork-list-loading"
            className="rounded-2xl border p-6"
            style={{
              borderColor: 'var(--rule)',
              background: 'var(--bg-card)',
              color: 'var(--ink-muted)',
            }}
          >
            <p className="type-body">Loading your results…</p>
          </div>
        ) : cards.length === 0 ? (
          <section
            data-testid="bloodwork-list-empty"
            className="rounded-2xl border p-6"
            style={{
              borderColor: 'var(--rule)',
              background: 'var(--bg-card)',
              color: 'var(--ink)',
            }}
          >
            <p
              style={{
                fontFamily: 'var(--font-fraunces)',
                fontSize: '1.125rem',
                lineHeight: 1.3,
                fontVariationSettings: "'SOFT' 100, 'opsz' 24, 'wght' 420",
              }}
            >
              No results saved yet — log your latest panel so trends start showing up.
            </p>
            <div className="mt-4">
              <Link
                href="/blood-work/new"
                data-testid="bloodwork-list-empty-cta"
                className="inline-block min-h-12 rounded-full px-6 py-3 text-[15px] font-medium"
                style={{
                  background: 'var(--sage-deep)',
                  color: 'var(--bg-elevated)',
                }}
              >
                + Log blood work
              </Link>
            </div>
          </section>
        ) : (
          <ul data-testid="bloodwork-list" className="grid gap-3">
            {cards.map((b) => (
              <li key={b.id}>
                <BloodWorkCard
                  bloodWork={b}
                  onSelect={(id) => router.push(`/blood-work/${id}`)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <BottomNav />
    </main>
  )
}
