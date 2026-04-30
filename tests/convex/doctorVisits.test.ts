/**
 * Handler tests for `convex/doctorVisits.ts`.
 *
 * Same approach as `tests/check-in/convex-checkins.test.ts`: drive the
 * extracted plain-function handlers with a mock ctx that emulates the slice
 * of Convex's DB API the handlers touch (`query(table).withIndex(...).collect()`,
 * `insert`, `get`, `patch`). Soft-delete + scoping are enforced in handler
 * code, so this fidelity is enough.
 */

import { describe, it, expect } from 'vitest'
import { ConvexError } from 'convex/values'
import {
  createVisitHandler,
  updateVisitHandler,
  softDeleteVisitHandler,
  listVisitsHandler,
  getNextUpcomingVisitHandler,
  getVisitsByDateHandler,
  type VisitRow,
  type CreateVisitArgs,
} from '@/convex/doctorVisits'

function makeCtx() {
  const rows: VisitRow[] = []
  let nextId = 1
  let nowCounter = 1_700_000_000_000

  type IdxField = 'userId' | 'date' | 'clientRequestId'
  const dbReader = {
    query: (_table: 'doctorVisits') => ({
      withIndex: (
        _name: 'by_user_date' | 'by_user_request',
        cb: (q: { eq: (field: IdxField, value: string) => unknown }) => unknown,
      ) => {
        const eqs: Array<{ field: IdxField; value: string }> = []
        const builder = {
          eq(field: IdxField, value: string) {
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
    get: async (id: string): Promise<VisitRow | null> =>
      rows.find((r) => r._id === id) ?? null,
  }

  const ctx = {
    db: {
      ...dbReader,
      insert: async (
        _table: 'doctorVisits',
        doc: Omit<VisitRow, '_id'>,
      ): Promise<string> => {
        const id = `vid_${nextId++}`
        rows.push({ ...doc, _id: id })
        return id
      },
      patch: async (id: string, patch: Partial<VisitRow>): Promise<void> => {
        const idx = rows.findIndex((r) => r._id === id)
        if (idx === -1) throw new Error(`patch on missing id ${id}`)
        rows[idx] = { ...rows[idx], ...patch }
      },
    },
  }

  const tickNow = () => ++nowCounter
  return { ctx, rows, tickNow }
}

// Each call gets a fresh idempotency token so tests that create multiple
// rows aren't accidentally collapsed by the new server-side dedupe.
let reqCounter = 0
const baseArgs = (overrides: Partial<CreateVisitArgs> = {}): CreateVisitArgs => ({
  userId: 'user_A',
  date: '2026-05-10',
  doctorName: 'Dr. Mehta',
  specialty: 'Rheumatologist',
  visitType: 'consultation',
  notes: 'Routine review',
  source: 'module',
  clientRequestId: `req_${++reqCounter}`,
  ...overrides,
})

type Ctx = Parameters<typeof createVisitHandler>[0]

describe('createVisitHandler', () => {
  it('happy path returns { id } and persists row', async () => {
    const { ctx, rows } = makeCtx()
    const result = await createVisitHandler(ctx as unknown as Ctx, baseArgs())
    expect(result.id).toMatch(/^vid_/)
    expect(rows.length).toBe(1)
    expect(rows[0].doctorName).toBe('Dr. Mehta')
    expect(rows[0].createdAt).toBeGreaterThan(0)
    expect(rows[0].deletedAt).toBeUndefined()
  })

  it('trims doctorName', async () => {
    const { ctx, rows } = makeCtx()
    await createVisitHandler(
      ctx as unknown as Ctx,
      baseArgs({ doctorName: '  Dr. Mehta  ' }),
    )
    expect(rows[0].doctorName).toBe('Dr. Mehta')
  })

  it('rejects empty doctorName after trim', async () => {
    const { ctx } = makeCtx()
    await expect(
      createVisitHandler(ctx as unknown as Ctx, baseArgs({ doctorName: '   ' })),
    ).rejects.toMatchObject({
      data: { code: 'visit.invalid_doctor_name' },
    })
  })

  it('rejects when source is check-in but checkInId is missing', async () => {
    const { ctx } = makeCtx()
    await expect(
      createVisitHandler(
        ctx as unknown as Ctx,
        baseArgs({ source: 'check-in', checkInId: undefined }),
      ),
    ).rejects.toMatchObject({
      data: { code: 'visit.missing_check_in_id' },
    })
  })

  it('rejects when source is module but checkInId is set', async () => {
    const { ctx } = makeCtx()
    await expect(
      createVisitHandler(
        ctx as unknown as Ctx,
        baseArgs({ source: 'module', checkInId: 'ci_1' }),
      ),
    ).rejects.toMatchObject({
      data: { code: 'visit.unexpected_check_in_id' },
    })
  })

  it('persists with source=check-in + checkInId', async () => {
    const { ctx, rows } = makeCtx()
    await createVisitHandler(
      ctx as unknown as Ctx,
      baseArgs({ source: 'check-in', checkInId: 'ci_42' }),
    )
    expect(rows[0].source).toBe('check-in')
    expect(rows[0].checkInId).toBe('ci_42')
  })

  it('idempotent: same clientRequestId returns the existing row, no duplicate insert', async () => {
    const { ctx, rows } = makeCtx()
    const args = baseArgs({ clientRequestId: 'req_idem_1' })
    const first = await createVisitHandler(ctx as unknown as Ctx, args)
    expect(rows.length).toBe(1)
    const second = await createVisitHandler(ctx as unknown as Ctx, args)
    expect(rows.length).toBe(1)
    expect(second.id).toBe(first.id)
  })

  it('persists clientRequestId on the row', async () => {
    const { ctx, rows } = makeCtx()
    await createVisitHandler(
      ctx as unknown as Ctx,
      baseArgs({ clientRequestId: 'req_persist' }),
    )
    expect(rows[0].clientRequestId).toBe('req_persist')
  })
})

describe('updateVisitHandler', () => {
  it('patches only provided fields', async () => {
    const { ctx, rows } = makeCtx()
    const created = await createVisitHandler(ctx as unknown as Ctx, baseArgs())
    await updateVisitHandler(ctx as unknown as Ctx, {
      visitId: created.id,
      userId: 'user_A',
      notes: 'Updated notes',
    })
    expect(rows[0].notes).toBe('Updated notes')
    expect(rows[0].doctorName).toBe('Dr. Mehta')
    expect(rows[0].visitType).toBe('consultation')
  })

  it('rejects when userId does not match the row', async () => {
    const { ctx } = makeCtx()
    const created = await createVisitHandler(ctx as unknown as Ctx, baseArgs())
    await expect(
      updateVisitHandler(ctx as unknown as Ctx, {
        visitId: created.id,
        userId: 'user_OTHER',
        notes: 'hijack',
      }),
    ).rejects.toMatchObject({
      data: { code: 'visit.not_found' },
    })
  })

  it('rejects when row is soft-deleted', async () => {
    const { ctx, rows } = makeCtx()
    const created = await createVisitHandler(ctx as unknown as Ctx, baseArgs())
    rows[0].deletedAt = Date.now()
    await expect(
      updateVisitHandler(ctx as unknown as Ctx, {
        visitId: created.id,
        userId: 'user_A',
        notes: 'after delete',
      }),
    ).rejects.toMatchObject({
      data: { code: 'visit.not_found' },
    })
  })

  it('rejects empty doctorName after trim', async () => {
    const { ctx } = makeCtx()
    const created = await createVisitHandler(ctx as unknown as Ctx, baseArgs())
    await expect(
      updateVisitHandler(ctx as unknown as Ctx, {
        visitId: created.id,
        userId: 'user_A',
        doctorName: '   ',
      }),
    ).rejects.toMatchObject({
      data: { code: 'visit.invalid_doctor_name' },
    })
  })

  it('error is a ConvexError', async () => {
    const { ctx } = makeCtx()
    try {
      await updateVisitHandler(ctx as unknown as Ctx, {
        visitId: 'vid_does_not_exist',
        userId: 'user_A',
      })
      throw new Error('expected throw')
    } catch (e) {
      expect(e).toBeInstanceOf(ConvexError)
    }
  })
})

describe('softDeleteVisitHandler', () => {
  it('sets deletedAt and returns alreadyDeleted: false', async () => {
    const { ctx, rows } = makeCtx()
    const created = await createVisitHandler(ctx as unknown as Ctx, baseArgs())
    const result = await softDeleteVisitHandler(ctx as unknown as Ctx, {
      visitId: created.id,
      userId: 'user_A',
    })
    expect(result.alreadyDeleted).toBe(false)
    expect(rows[0].deletedAt).toBeDefined()
  })

  it('idempotent: second call returns alreadyDeleted: true and does not bump deletedAt', async () => {
    const { ctx, rows } = makeCtx()
    const created = await createVisitHandler(ctx as unknown as Ctx, baseArgs())
    const first = await softDeleteVisitHandler(ctx as unknown as Ctx, {
      visitId: created.id,
      userId: 'user_A',
    })
    const firstDeletedAt = rows[0].deletedAt
    expect(first.alreadyDeleted).toBe(false)
    // Tick clock slightly to ensure a re-patch would change the value.
    await new Promise((r) => setTimeout(r, 2))
    const second = await softDeleteVisitHandler(ctx as unknown as Ctx, {
      visitId: created.id,
      userId: 'user_A',
    })
    expect(second.alreadyDeleted).toBe(true)
    expect(rows[0].deletedAt).toBe(firstDeletedAt)
  })

  it('soft-deleted row is filtered out of listVisits', async () => {
    const { ctx } = makeCtx()
    const a = await createVisitHandler(
      ctx as unknown as Ctx,
      baseArgs({ date: '2026-05-01' }),
    )
    await createVisitHandler(
      ctx as unknown as Ctx,
      baseArgs({ date: '2026-05-02' }),
    )
    await softDeleteVisitHandler(ctx as unknown as Ctx, {
      visitId: a.id,
      userId: 'user_A',
    })
    const list = await listVisitsHandler(ctx as unknown as Ctx, {
      userId: 'user_A',
    })
    expect(list.items.length).toBe(1)
    expect(list.items[0].date).toBe('2026-05-02')
  })

  it('rejects when userId does not match', async () => {
    const { ctx } = makeCtx()
    const created = await createVisitHandler(ctx as unknown as Ctx, baseArgs())
    await expect(
      softDeleteVisitHandler(ctx as unknown as Ctx, {
        visitId: created.id,
        userId: 'user_OTHER',
      }),
    ).rejects.toMatchObject({
      data: { code: 'visit.not_found' },
    })
  })

  it('rejects when row does not exist', async () => {
    const { ctx } = makeCtx()
    await expect(
      softDeleteVisitHandler(ctx as unknown as Ctx, {
        visitId: 'vid_missing',
        userId: 'user_A',
      }),
    ).rejects.toMatchObject({
      data: { code: 'visit.not_found' },
    })
  })
})

describe('listVisitsHandler', () => {
  it('empty → { items: [] }', async () => {
    const { ctx } = makeCtx()
    const result = await listVisitsHandler(ctx as unknown as Ctx, {
      userId: 'user_A',
    })
    expect(result.items).toEqual([])
  })

  it('sorts by date descending', async () => {
    const { ctx } = makeCtx()
    for (const date of ['2026-04-23', '2026-04-25', '2026-04-24']) {
      await createVisitHandler(ctx as unknown as Ctx, baseArgs({ date }))
    }
    const result = await listVisitsHandler(ctx as unknown as Ctx, {
      userId: 'user_A',
    })
    expect(result.items.map((r) => r.date)).toEqual([
      '2026-04-25',
      '2026-04-24',
      '2026-04-23',
    ])
  })

  it('respects fromDate/toDate range filter', async () => {
    const { ctx } = makeCtx()
    for (const date of [
      '2026-04-20',
      '2026-04-21',
      '2026-04-22',
      '2026-04-23',
      '2026-04-24',
    ]) {
      await createVisitHandler(ctx as unknown as Ctx, baseArgs({ date }))
    }
    const result = await listVisitsHandler(ctx as unknown as Ctx, {
      userId: 'user_A',
      fromDate: '2026-04-21',
      toDate: '2026-04-23',
    })
    expect(result.items.map((r) => r.date)).toEqual([
      '2026-04-23',
      '2026-04-22',
      '2026-04-21',
    ])
  })

  it('scopes by userId', async () => {
    const { ctx } = makeCtx()
    await createVisitHandler(
      ctx as unknown as Ctx,
      baseArgs({ userId: 'user_A' }),
    )
    await createVisitHandler(
      ctx as unknown as Ctx,
      baseArgs({ userId: 'user_B' }),
    )
    const result = await listVisitsHandler(ctx as unknown as Ctx, {
      userId: 'user_A',
    })
    expect(result.items.length).toBe(1)
    expect(result.items[0].userId).toBe('user_A')
  })
})

describe('getNextUpcomingVisitHandler', () => {
  it('returns null when no visits exist', async () => {
    const { ctx } = makeCtx()
    const result = await getNextUpcomingVisitHandler(ctx as unknown as Ctx, {
      userId: 'user_A',
      today: '2026-05-01',
    })
    expect(result).toBeNull()
  })

  it('returns null when only past visits exist', async () => {
    const { ctx } = makeCtx()
    await createVisitHandler(ctx as unknown as Ctx, baseArgs({ date: '2026-04-20' }))
    await createVisitHandler(ctx as unknown as Ctx, baseArgs({ date: '2026-04-25' }))
    const result = await getNextUpcomingVisitHandler(ctx as unknown as Ctx, {
      userId: 'user_A',
      today: '2026-05-01',
    })
    expect(result).toBeNull()
  })

  it('returns the soonest visit on or after today', async () => {
    const { ctx } = makeCtx()
    for (const date of ['2026-04-20', '2026-05-15', '2026-05-05', '2026-06-01']) {
      await createVisitHandler(ctx as unknown as Ctx, baseArgs({ date }))
    }
    const result = await getNextUpcomingVisitHandler(ctx as unknown as Ctx, {
      userId: 'user_A',
      today: '2026-05-01',
    })
    expect(result).not.toBeNull()
    expect(result?.date).toBe('2026-05-05')
  })

  it('treats today as eligible (date >= today)', async () => {
    const { ctx } = makeCtx()
    await createVisitHandler(ctx as unknown as Ctx, baseArgs({ date: '2026-05-01' }))
    await createVisitHandler(ctx as unknown as Ctx, baseArgs({ date: '2026-05-10' }))
    const result = await getNextUpcomingVisitHandler(ctx as unknown as Ctx, {
      userId: 'user_A',
      today: '2026-05-01',
    })
    expect(result?.date).toBe('2026-05-01')
  })

  it('skips soft-deleted upcoming visits', async () => {
    const { ctx } = makeCtx()
    const earlier = await createVisitHandler(
      ctx as unknown as Ctx,
      baseArgs({ date: '2026-05-05' }),
    )
    await createVisitHandler(ctx as unknown as Ctx, baseArgs({ date: '2026-05-10' }))
    await softDeleteVisitHandler(ctx as unknown as Ctx, {
      visitId: earlier.id,
      userId: 'user_A',
    })
    const result = await getNextUpcomingVisitHandler(ctx as unknown as Ctx, {
      userId: 'user_A',
      today: '2026-05-01',
    })
    expect(result?.date).toBe('2026-05-10')
  })
})

describe('getVisitsByDateHandler', () => {
  it('returns visits matching the date for the user', async () => {
    const { ctx } = makeCtx()
    await createVisitHandler(ctx as unknown as Ctx, baseArgs({ date: '2026-05-10' }))
    await createVisitHandler(
      ctx as unknown as Ctx,
      baseArgs({ date: '2026-05-10', doctorName: 'Dr. Sharma' }),
    )
    await createVisitHandler(ctx as unknown as Ctx, baseArgs({ date: '2026-05-11' }))
    const result = await getVisitsByDateHandler(ctx as unknown as Ctx, {
      userId: 'user_A',
      date: '2026-05-10',
    })
    expect(result.items.length).toBe(2)
    expect(new Set(result.items.map((r) => r.doctorName))).toEqual(
      new Set(['Dr. Mehta', 'Dr. Sharma']),
    )
  })

  it('excludes soft-deleted', async () => {
    const { ctx } = makeCtx()
    const a = await createVisitHandler(
      ctx as unknown as Ctx,
      baseArgs({ date: '2026-05-10' }),
    )
    await createVisitHandler(
      ctx as unknown as Ctx,
      baseArgs({ date: '2026-05-10', doctorName: 'Dr. Sharma' }),
    )
    await softDeleteVisitHandler(ctx as unknown as Ctx, {
      visitId: a.id,
      userId: 'user_A',
    })
    const result = await getVisitsByDateHandler(ctx as unknown as Ctx, {
      userId: 'user_A',
      date: '2026-05-10',
    })
    expect(result.items.length).toBe(1)
    expect(result.items[0].doctorName).toBe('Dr. Sharma')
  })
})
