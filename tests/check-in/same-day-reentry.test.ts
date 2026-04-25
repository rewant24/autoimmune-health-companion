/**
 * Tests for `lib/checkin/same-day-reentry.ts`.
 *
 * Feature 01, Cycle 2, Chunk 2.F, story Reentry.US-1.J.2.
 *
 * Contract:
 *   buildAppendPayload(prior, newMetrics, transcript, declined, opts):
 *     - Returns CreateCheckinArgs with `appendedTo: prior._id`
 *     - userId + date copied from prior (same-day re-entry by definition)
 *     - metrics + declined come from the new (current) entry — pattern
 *       engine reads latest per metric.
 *     - clientRequestId and durationMs are taken from opts; providerUsed
 *       defaults to prior's value when not supplied.
 *     - Stage defaults to 'open' (the re-entry transcript is fresh voice
 *       input). Caller can override.
 */

import { describe, expect, it } from 'vitest'

import { buildAppendPayload } from '@/lib/checkin/same-day-reentry'
import {
  getTodayCheckinHandler,
  type CheckinRow,
} from '@/convex/checkIns'
import type { CheckinMetrics, Metric } from '@/lib/checkin/types'

// Mock ctx mirroring tests/check-in/convex-checkins.test.ts. Only the
// `query → withIndex → collect` slice is needed for getTodayCheckinHandler.
function makeCtx(seed: CheckinRow[] = []) {
  const rows: CheckinRow[] = [...seed]
  const ctx = {
    db: {
      query: (_table: 'checkIns') => ({
        withIndex: (
          _name: 'by_user_date',
          cb: (q: { eq: (field: 'userId' | 'date', v: string) => unknown }) => unknown,
        ) => {
          const eqs: Array<{ field: 'userId' | 'date'; value: string }> = []
          const builder: {
            eq: (f: 'userId' | 'date', v: string) => typeof builder
          } = {
            eq(field, value) {
              eqs.push({ field, value })
              return builder
            },
          }
          cb(builder)
          return {
            collect: async () =>
              rows.filter((row) =>
                eqs.every(
                  ({ field, value }) =>
                    (row as unknown as Record<string, string>)[field] === value,
                ),
              ),
          }
        },
      }),
      insert: async () => 'unused',
      get: async (id: string) => rows.find((r) => r._id === id) ?? null,
    },
  }
  return { ctx, rows }
}

const priorRow: CheckinRow = {
  _id: 'id_prior_1',
  userId: 'user_A',
  date: '2026-04-25',
  createdAt: 1_000_000,
  pain: 4,
  mood: 'okay',
  adherenceTaken: true,
  flare: 'no',
  energy: 5,
  declined: [],
  transcript: 'Morning check-in: meds taken, knee a bit sore.',
  stage: 'open',
  durationMs: 30_000,
  providerUsed: 'web-speech',
  clientRequestId: 'req_morning',
}

const newMetrics: CheckinMetrics = {
  pain: 7,
  mood: 'flat',
  adherenceTaken: null,
  flare: 'yes',
  energy: 3,
}

describe('buildAppendPayload', () => {
  it('sets appendedTo to the prior row _id', () => {
    const payload = buildAppendPayload(priorRow, newMetrics, 'Pain spiked this afternoon.', [], {
      clientRequestId: 'req_afternoon',
      durationMs: 22_000,
    })
    expect(payload.appendedTo).toBe('id_prior_1')
  })

  it('copies userId and date from the prior row', () => {
    const payload = buildAppendPayload(priorRow, newMetrics, 'Update.', [], {
      clientRequestId: 'req_afternoon',
      durationMs: 22_000,
    })
    expect(payload.userId).toBe('user_A')
    expect(payload.date).toBe('2026-04-25')
  })

  it('uses the new metrics, not the prior row metrics (pattern engine reads latest per metric)', () => {
    const payload = buildAppendPayload(priorRow, newMetrics, 'Update.', [], {
      clientRequestId: 'req_afternoon',
      durationMs: 22_000,
    })
    expect(payload.pain).toBe(7)
    expect(payload.mood).toBe('flat')
    expect(payload.flare).toBe('yes')
    expect(payload.energy).toBe(3)
  })

  it('omits null metrics from the payload (Convex undefined-as-skip semantics)', () => {
    const payload = buildAppendPayload(priorRow, newMetrics, 'Update.', ['adherenceTaken'], {
      clientRequestId: 'req_afternoon',
      durationMs: 22_000,
    })
    expect(payload.adherenceTaken).toBeUndefined()
  })

  it('sets the declined array verbatim', () => {
    const declined: Metric[] = ['adherenceTaken', 'flare']
    const partial: CheckinMetrics = {
      pain: 7,
      mood: 'flat',
      adherenceTaken: null,
      flare: null,
      energy: 3,
    }
    const payload = buildAppendPayload(priorRow, partial, 'Update.', declined, {
      clientRequestId: 'req_afternoon',
      durationMs: 22_000,
    })
    expect(payload.declined).toEqual(['adherenceTaken', 'flare'])
  })

  it('uses the supplied transcript verbatim', () => {
    const transcript = 'Pain went up after physio — taking it easy now.'
    const payload = buildAppendPayload(priorRow, newMetrics, transcript, [], {
      clientRequestId: 'req_afternoon',
      durationMs: 22_000,
    })
    expect(payload.transcript).toBe(transcript)
  })

  it('uses opts for clientRequestId and durationMs', () => {
    const payload = buildAppendPayload(priorRow, newMetrics, 'Update.', [], {
      clientRequestId: 'req_afternoon',
      durationMs: 22_000,
    })
    expect(payload.clientRequestId).toBe('req_afternoon')
    expect(payload.durationMs).toBe(22_000)
  })

  it("defaults providerUsed to the prior row's value when not supplied", () => {
    const payload = buildAppendPayload(priorRow, newMetrics, 'Update.', [], {
      clientRequestId: 'req_afternoon',
      durationMs: 22_000,
    })
    expect(payload.providerUsed).toBe('web-speech')
  })

  it("defaults stage to 'open' when not supplied (re-entry transcript is fresh voice input)", () => {
    const payload = buildAppendPayload(priorRow, newMetrics, 'Update.', [], {
      clientRequestId: 'req_afternoon',
      durationMs: 22_000,
    })
    expect(payload.stage).toBe('open')
  })

  it('respects an explicit stage override (e.g. hybrid when Stage 2 ran)', () => {
    const payload = buildAppendPayload(priorRow, newMetrics, 'Update.', [], {
      clientRequestId: 'req_afternoon',
      durationMs: 22_000,
      stage: 'hybrid',
    })
    expect(payload.stage).toBe('hybrid')
  })

  it('does not mutate the prior row', () => {
    const snapshot = JSON.parse(JSON.stringify(priorRow)) as CheckinRow
    buildAppendPayload(priorRow, newMetrics, 'Update.', ['mood'], {
      clientRequestId: 'req_afternoon',
      durationMs: 22_000,
    })
    expect(priorRow).toEqual(snapshot)
  })
})

describe('getTodayCheckinHandler', () => {
  type Ctx = Parameters<typeof getTodayCheckinHandler>[0]

  it('returns null when no rows exist for the user', async () => {
    const { ctx } = makeCtx()
    const row = await getTodayCheckinHandler(ctx as unknown as Ctx, {
      userId: 'user_A',
      date: '2026-04-25',
    })
    expect(row).toBeNull()
  })

  it('returns the row when one exists for (userId, date)', async () => {
    const { ctx } = makeCtx([priorRow])
    const row = await getTodayCheckinHandler(ctx as unknown as Ctx, {
      userId: 'user_A',
      date: '2026-04-25',
    })
    expect(row).not.toBeNull()
    expect(row?._id).toBe('id_prior_1')
  })

  it('ignores rows on a different date', async () => {
    const otherDateRow: CheckinRow = { ...priorRow, _id: 'id_other_date', date: '2026-04-24' }
    const { ctx } = makeCtx([otherDateRow])
    const row = await getTodayCheckinHandler(ctx as unknown as Ctx, {
      userId: 'user_A',
      date: '2026-04-25',
    })
    expect(row).toBeNull()
  })

  it('ignores rows for a different user', async () => {
    const otherUserRow: CheckinRow = { ...priorRow, _id: 'id_other_user', userId: 'user_B' }
    const { ctx } = makeCtx([otherUserRow])
    const row = await getTodayCheckinHandler(ctx as unknown as Ctx, {
      userId: 'user_A',
      date: '2026-04-25',
    })
    expect(row).toBeNull()
  })

  it('skips soft-deleted rows', async () => {
    const deletedRow: CheckinRow = { ...priorRow, deletedAt: 1_500_000 }
    const { ctx } = makeCtx([deletedRow])
    const row = await getTodayCheckinHandler(ctx as unknown as Ctx, {
      userId: 'user_A',
      date: '2026-04-25',
    })
    expect(row).toBeNull()
  })

  it('returns the original row (no appendedTo) when an append chain exists', async () => {
    const appendedRow: CheckinRow = {
      ...priorRow,
      _id: 'id_append_2',
      clientRequestId: 'req_afternoon',
      appendedTo: 'id_prior_1',
      createdAt: priorRow.createdAt + 60_000,
    }
    const { ctx } = makeCtx([priorRow, appendedRow])
    const row = await getTodayCheckinHandler(ctx as unknown as Ctx, {
      userId: 'user_A',
      date: '2026-04-25',
    })
    expect(row?._id).toBe('id_prior_1')
  })
})
