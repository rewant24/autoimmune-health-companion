/**
 * Handler tests for `convex/checkIns.ts`.
 *
 * Approach: per the Cycle 1 plan, we avoid installing `convex-test` to keep
 * the dep surface small. Instead we import the extracted plain-function
 * handlers (`createCheckinHandler`, `listCheckinsHandler`,
 * `getCheckinHandler`) and drive them with a hand-rolled mock ctx whose
 * `db` emulates only the slice of the Convex DB API the handlers touch
 * (`query(table).withIndex(...).collect()`, `insert`, `get`). Soft-delete
 * filtering and idempotency are performed in handler code, so this level
 * of fidelity is sufficient to exercise all acceptance criteria.
 *
 * For full end-to-end coverage against the Convex runtime (indexes,
 * validators, scheduler), revisit post-MVP with `convex-test`.
 */

import { describe, it, expect } from 'vitest'
import { ConvexError } from 'convex/values'
import {
  createCheckinHandler,
  listCheckinsHandler,
  getCheckinHandler,
  type CheckinRow,
  type CreateCheckinArgs,
} from '@/convex/checkIns'

function makeCtx() {
  const rows: CheckinRow[] = []
  let nextId = 1

  const ctx = {
    db: {
      query: (_table: 'checkIns') => ({
        withIndex: (
          _name: 'by_user_date',
          cb: (q: {
            eq: (field: 'userId' | 'date', value: string) => unknown
          }) => unknown,
        ) => {
          // Capture the eq() calls to know what (userId[, date]) to match.
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
      insert: async (
        _table: 'checkIns',
        doc: Omit<CheckinRow, '_id'>,
      ): Promise<string> => {
        const id = `id_${nextId++}`
        rows.push({ ...doc, _id: id })
        return id
      },
      get: async (id: string): Promise<CheckinRow | null> =>
        rows.find((r) => r._id === id) ?? null,
    },
  }

  return { ctx, rows }
}

const baseArgs = (overrides: Partial<CreateCheckinArgs> = {}): CreateCheckinArgs => ({
  userId: 'user_A',
  date: '2026-04-25',
  pain: 5,
  mood: 'okay',
  adherenceTaken: true,
  flare: false,
  energy: 6,
  transcript: 'Today was alright, took meds, bit of knee pain.',
  stage: 'open',
  durationMs: 42000,
  providerUsed: 'web-speech',
  clientRequestId: 'req_1',
  ...overrides,
})

describe('createCheckinHandler', () => {
  it('happy path returns { id, date }', async () => {
    const { ctx, rows } = makeCtx()
    const result = await createCheckinHandler(ctx as unknown as Parameters<typeof createCheckinHandler>[0], baseArgs())
    expect(result.date).toBe('2026-04-25')
    expect(result.id).toMatch(/^id_/)
    expect(rows.length).toBe(1)
    expect(rows[0].mood).toBe('okay')
    expect(rows[0].createdAt).toBeGreaterThan(0)
  })

  it('throws on pain=0', async () => {
    const { ctx } = makeCtx()
    await expect(
      createCheckinHandler(ctx as unknown as Parameters<typeof createCheckinHandler>[0], baseArgs({ pain: 0 })),
    ).rejects.toThrow(/Invalid range for pain\/energy/)
  })

  it('throws on pain=11', async () => {
    const { ctx } = makeCtx()
    await expect(
      createCheckinHandler(ctx as unknown as Parameters<typeof createCheckinHandler>[0], baseArgs({ pain: 11 })),
    ).rejects.toThrow(/Invalid range for pain\/energy/)
  })

  it('throws on energy=0', async () => {
    const { ctx } = makeCtx()
    await expect(
      createCheckinHandler(ctx as unknown as Parameters<typeof createCheckinHandler>[0], baseArgs({ energy: 0 })),
    ).rejects.toThrow(/Invalid range for pain\/energy/)
  })

  it('throws on energy=11', async () => {
    const { ctx } = makeCtx()
    await expect(
      createCheckinHandler(ctx as unknown as Parameters<typeof createCheckinHandler>[0], baseArgs({ energy: 11 })),
    ).rejects.toThrow(/Invalid range for pain\/energy/)
  })

  it('idempotent: same (userId, date, clientRequestId) returns existing id', async () => {
    const { ctx, rows } = makeCtx()
    const first = await createCheckinHandler(
      ctx as unknown as Parameters<typeof createCheckinHandler>[0],
      baseArgs({ clientRequestId: 'req_same' }),
    )
    const second = await createCheckinHandler(
      ctx as unknown as Parameters<typeof createCheckinHandler>[0],
      baseArgs({ clientRequestId: 'req_same' }),
    )
    expect(second.id).toBe(first.id)
    expect(rows.length).toBe(1)
  })

  it('duplicate: same (userId, date) with different clientRequestId throws checkin.duplicate', async () => {
    const { ctx } = makeCtx()
    await createCheckinHandler(
      ctx as unknown as Parameters<typeof createCheckinHandler>[0],
      baseArgs({ clientRequestId: 'req_1' }),
    )
    await expect(
      createCheckinHandler(
        ctx as unknown as Parameters<typeof createCheckinHandler>[0],
        baseArgs({ clientRequestId: 'req_2' }),
      ),
    ).rejects.toMatchObject({
      data: { code: 'checkin.duplicate' },
    })
  })

  it('duplicate error is a ConvexError', async () => {
    const { ctx } = makeCtx()
    await createCheckinHandler(ctx as unknown as Parameters<typeof createCheckinHandler>[0], baseArgs())
    try {
      await createCheckinHandler(
        ctx as unknown as Parameters<typeof createCheckinHandler>[0],
        baseArgs({ clientRequestId: 'other' }),
      )
      throw new Error('expected duplicate to throw')
    } catch (e) {
      expect(e).toBeInstanceOf(ConvexError)
    }
  })
})

describe('listCheckinsHandler', () => {
  it('empty → { items: [], nextCursor: null }', async () => {
    const { ctx } = makeCtx()
    const result = await listCheckinsHandler(ctx as unknown as Parameters<typeof createCheckinHandler>[0], {
      userId: 'user_A',
    })
    expect(result.items).toEqual([])
    expect(result.nextCursor).toBeNull()
  })

  it('sorts by date descending', async () => {
    const { ctx } = makeCtx()
    for (const date of ['2026-04-23', '2026-04-25', '2026-04-24']) {
      await createCheckinHandler(
        ctx as unknown as Parameters<typeof createCheckinHandler>[0],
        baseArgs({ date, clientRequestId: `req_${date}` }),
      )
    }
    const result = await listCheckinsHandler(ctx as unknown as Parameters<typeof createCheckinHandler>[0], {
      userId: 'user_A',
    })
    expect(result.items.map((r) => r.date)).toEqual([
      '2026-04-25',
      '2026-04-24',
      '2026-04-23',
    ])
    expect(result.nextCursor).toBeNull()
  })

  it('respects limit and returns nextCursor when more remain', async () => {
    const { ctx } = makeCtx()
    for (const date of [
      '2026-04-20',
      '2026-04-21',
      '2026-04-22',
      '2026-04-23',
    ]) {
      await createCheckinHandler(
        ctx as unknown as Parameters<typeof createCheckinHandler>[0],
        baseArgs({ date, clientRequestId: `req_${date}` }),
      )
    }
    const result = await listCheckinsHandler(ctx as unknown as Parameters<typeof createCheckinHandler>[0], {
      userId: 'user_A',
      limit: 2,
    })
    expect(result.items.map((r) => r.date)).toEqual([
      '2026-04-23',
      '2026-04-22',
    ])
    expect(result.nextCursor).toBe('2026-04-22')
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
      await createCheckinHandler(
        ctx as unknown as Parameters<typeof createCheckinHandler>[0],
        baseArgs({ date, clientRequestId: `req_${date}` }),
      )
    }
    const result = await listCheckinsHandler(ctx as unknown as Parameters<typeof createCheckinHandler>[0], {
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

  it('excludes soft-deleted rows', async () => {
    const { ctx, rows } = makeCtx()
    await createCheckinHandler(
      ctx as unknown as Parameters<typeof createCheckinHandler>[0],
      baseArgs({ date: '2026-04-22', clientRequestId: 'r1' }),
    )
    await createCheckinHandler(
      ctx as unknown as Parameters<typeof createCheckinHandler>[0],
      baseArgs({ date: '2026-04-23', clientRequestId: 'r2' }),
    )
    // Soft-delete the earlier row.
    rows[0].deletedAt = Date.now()
    const result = await listCheckinsHandler(ctx as unknown as Parameters<typeof createCheckinHandler>[0], {
      userId: 'user_A',
    })
    expect(result.items.map((r) => r.date)).toEqual(['2026-04-23'])
  })

  it('scopes by userId', async () => {
    const { ctx } = makeCtx()
    await createCheckinHandler(
      ctx as unknown as Parameters<typeof createCheckinHandler>[0],
      baseArgs({ userId: 'user_A', date: '2026-04-23', clientRequestId: 'a' }),
    )
    await createCheckinHandler(
      ctx as unknown as Parameters<typeof createCheckinHandler>[0],
      baseArgs({ userId: 'user_B', date: '2026-04-23', clientRequestId: 'b' }),
    )
    const resultA = await listCheckinsHandler(ctx as unknown as Parameters<typeof createCheckinHandler>[0], {
      userId: 'user_A',
    })
    expect(resultA.items.length).toBe(1)
    expect(resultA.items[0].userId).toBe('user_A')
  })
})

describe('getCheckinHandler', () => {
  it('returns a row by id', async () => {
    const { ctx } = makeCtx()
    const created = await createCheckinHandler(ctx as unknown as Parameters<typeof createCheckinHandler>[0], baseArgs())
    const row = await getCheckinHandler(ctx as unknown as Parameters<typeof createCheckinHandler>[0], {
      id: created.id,
    })
    expect(row).not.toBeNull()
    expect(row?.date).toBe('2026-04-25')
  })

  it('returns null for unknown id', async () => {
    const { ctx } = makeCtx()
    const row = await getCheckinHandler(ctx as unknown as Parameters<typeof createCheckinHandler>[0], {
      id: 'id_does_not_exist',
    })
    expect(row).toBeNull()
  })

  it('returns null for soft-deleted row', async () => {
    const { ctx, rows } = makeCtx()
    const created = await createCheckinHandler(ctx as unknown as Parameters<typeof createCheckinHandler>[0], baseArgs())
    rows[0].deletedAt = Date.now()
    const row = await getCheckinHandler(ctx as unknown as Parameters<typeof createCheckinHandler>[0], {
      id: created.id,
    })
    expect(row).toBeNull()
  })
})
