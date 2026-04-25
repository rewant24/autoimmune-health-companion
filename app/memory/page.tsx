'use client'

/**
 * /memory — thin testable Memory surface (pre-F02-C1).
 *
 * This is NOT the full F02 Memory tab from `docs/features/02-memory.md`
 * (that lives inside Journey, has a week-scrubber, 5 filter tabs, and a
 * discriminated-union event type). This is a deliberate stub built on
 * 2026-04-25 so check-ins are testable end-to-end before F02 C1 ships
 * through the playbook. When real F02 lands at /journey/memory, this
 * route can either redirect or be deleted.
 */

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'

const TEST_USER_KEY = 'saumya.testUser.v1'

export default function MemoryPage(): React.JSX.Element {
  // We can't read localStorage during SSR — defer the userId read to the
  // client. While `userId` is null we render the empty/loading state.
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const existing = window.localStorage.getItem(TEST_USER_KEY)
    if (existing) {
      setUserId(existing)
      return
    }
    // No check-ins yet — set a stable id so subsequent saves match.
    const fresh =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `u_${Math.random().toString(36).slice(2)}_${Date.now()}`
    window.localStorage.setItem(TEST_USER_KEY, fresh)
    setUserId(fresh)
  }, [])

  const result = useQuery(
    api.checkIns.listCheckins,
    userId ? { userId, limit: 50 } : 'skip',
  )

  const items = result?.items ?? []
  const isLoading = userId === null || result === undefined

  return (
    <main
      className="mx-auto flex min-h-[100svh] w-full max-w-2xl flex-col gap-6 px-6 py-10 text-zinc-900 dark:text-zinc-50"
      style={{ background: 'var(--bg-elevated)' }}
    >
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Memory</h1>
        <nav className="flex gap-3 text-sm">
          <Link href="/check-in" className="underline underline-offset-4">
            New check-in
          </Link>
          <Link href="/" className="underline underline-offset-4">
            Home
          </Link>
        </nav>
      </header>

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Your past check-ins, newest first.
      </p>

      {isLoading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((row) => (
            <CheckinRow key={row._id} row={row} />
          ))}
        </ul>
      )}
    </main>
  )
}

function EmptyState(): React.JSX.Element {
  return (
    <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-zinc-300 p-6 dark:border-zinc-700">
      <p className="text-base text-zinc-700 dark:text-zinc-200">
        Your memory starts today.
      </p>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Tap below to do your first 60-second voice check-in.
      </p>
      <Link
        href="/check-in"
        className="mt-2 rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        Start check-in
      </Link>
    </div>
  )
}

type RowProps = {
  row: {
    _id: string
    date: string
    createdAt: number
    pain: number
    mood: 'heavy' | 'flat' | 'okay' | 'bright' | 'great'
    energy: number
    transcript: string
    flare: boolean
  }
}

const MOOD_LABEL: Record<RowProps['row']['mood'], string> = {
  heavy: 'Heavy',
  flat: 'Flat',
  okay: 'Okay',
  bright: 'Bright',
  great: 'Great',
}

function CheckinRow({ row }: RowProps): React.JSX.Element {
  return (
    <li className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold">{formatDate(row.date)}</h2>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {formatTime(row.createdAt)}
        </span>
      </div>

      <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
        <span>
          <dt className="inline">Mood:</dt>{' '}
          <dd className="inline font-medium text-zinc-800 dark:text-zinc-200">
            {MOOD_LABEL[row.mood]}
          </dd>
        </span>
        <span>
          <dt className="inline">Pain:</dt>{' '}
          <dd className="inline font-medium text-zinc-800 dark:text-zinc-200">
            {row.pain}/10
          </dd>
        </span>
        <span>
          <dt className="inline">Energy:</dt>{' '}
          <dd className="inline font-medium text-zinc-800 dark:text-zinc-200">
            {row.energy}/10
          </dd>
        </span>
        {row.flare ? (
          <span className="text-rose-700 dark:text-rose-300">Flare</span>
        ) : null}
      </dl>

      {row.transcript ? (
        <p className="mt-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          {row.transcript}
        </p>
      ) : (
        <p className="mt-3 text-sm italic text-zinc-400">
          No transcript captured.
        </p>
      )}
    </li>
  )
}

function formatDate(iso: string): string {
  // iso is YYYY-MM-DD. Format as a friendly local date.
  const [y, m, d] = iso.split('-').map((s) => Number(s))
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}
