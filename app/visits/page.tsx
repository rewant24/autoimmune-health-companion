'use client'

/**
 * /visits — Doctor-visits module list.
 *
 * F05 Cycle 1, Chunk 5.B, US-5.B.3. Lists visits newest-first via
 * `api.doctorVisits.listVisits`. Tri-state loading / empty / populated.
 *
 * The Convex module exports for chunk 5.A may not yet be visible on this
 * branch's generated `api.d.ts`; we cast through `as any` at the call site
 * (mirroring the medications page) so the build is stable today and picks
 * up real types after `npx convex dev` regenerates.
 */

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from 'convex/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { api } from '@/convex/_generated/api'
import { BottomNav } from '@/components/nav/BottomNav'
import { VisitCard, type VisitCardData } from '@/components/visits/VisitCard'
import type { VisitType } from '@/components/visits/VisitForm'

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

type VisitDoc = {
  _id: string
  date: string
  doctorName: string
  specialty?: string
  visitType: VisitType
  notes?: string
}

export default function VisitsPage(): React.JSX.Element {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    setUserId(getOrCreateTestUserId())
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const visits = useQuery(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api as any).doctorVisits?.listVisits,
    userId === null ? 'skip' : { userId },
  ) as VisitDoc[] | undefined

  const cards: VisitCardData[] | undefined = useMemo(() => {
    if (visits === undefined) return undefined
    // newest-first: 5.A's listVisits already returns sorted, but defend the
    // ordering at the boundary so a future API tweak doesn't visually regress.
    const sorted = [...visits].sort((a, b) => b.date.localeCompare(a.date))
    return sorted.map((v) => ({
      id: v._id,
      date: v.date,
      doctorName: v.doctorName,
      specialty: v.specialty,
      visitType: v.visitType,
      notes: v.notes,
    }))
  }, [visits])

  return (
    <main
      data-testid="visits-page"
      className="grain relative min-h-screen pb-24"
      style={{ background: 'var(--bg)', color: 'var(--ink)' }}
    >
      <div className="mx-auto w-full max-w-2xl px-6 pt-8">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="type-label" style={{ color: 'var(--ink-muted)' }}>
              Doctor visits
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
              Your visits
            </h1>
          </div>
          <Link
            href="/visits/new"
            data-testid="visits-add-cta"
            className="self-end rounded-full px-5 py-2 text-[14px] font-medium"
            style={{
              background: 'var(--sage-deep)',
              color: 'var(--bg-elevated)',
            }}
          >
            + Log visit
          </Link>
        </header>

        {cards === undefined ? (
          <div
            data-testid="visits-list-loading"
            className="rounded-2xl border p-6"
            style={{
              borderColor: 'var(--rule)',
              background: 'var(--bg-card)',
              color: 'var(--ink-muted)',
            }}
          >
            <p className="type-body">Loading your visits…</p>
          </div>
        ) : cards.length === 0 ? (
          <section
            data-testid="visits-list-empty"
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
              No doctor visits logged yet.
            </p>
            <div className="mt-4">
              <Link
                href="/visits/new"
                data-testid="visits-list-empty-cta"
                className="inline-block min-h-12 rounded-full px-6 py-3 text-[15px] font-medium"
                style={{
                  background: 'var(--sage-deep)',
                  color: 'var(--bg-elevated)',
                }}
              >
                + Log visit
              </Link>
            </div>
          </section>
        ) : (
          <ul data-testid="visits-list" className="grid gap-3">
            {cards.map((v) => (
              <li key={v.id}>
                <VisitCard
                  visit={v}
                  onSelect={(id) => router.push(`/visits/${id}`)}
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
