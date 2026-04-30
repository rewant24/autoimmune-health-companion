/**
 * Handler tests for `convex/bloodWork.ts`.
 *
 * Same mock-ctx pattern as doctorVisits.test.ts. Covers:
 *  - createBloodWork: shape validation (markers required, name/unit non-empty,
 *    value finite, refRangeLow <= refRangeHigh, abnormal derivation),
 *    source/checkInId coupling, persistence of full marker array.
 *  - updateBloodWork: scoped patch + marker re-validation.
 *  - softDeleteBloodWork: idempotent + filtered out by listBloodWork.
 *  - listBloodWork: range filter + userId scoping + sort order.
 *  - getBloodWorkByDate.
 */

import { describe, it, expect } from 'vitest'
import { ConvexError } from 'convex/values'
import {
  createBloodWorkHandler,
  updateBloodWorkHandler,
  softDeleteBloodWorkHandler,
  listBloodWorkHandler,
  getBloodWorkByDateHandler,
  normaliseMarkers,
  type BloodWorkRow,
  type CreateBloodWorkArgs,
  type Marker,
} from '@/convex/bloodWork'

function makeCtx() {
  const rows: BloodWorkRow[] = []
  let nextId = 1

  type IdxField = 'userId' | 'date' | 'clientRequestId'
  const dbReader = {
    query: (_table: 'bloodWork') => ({
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
    get: async (id: string): Promise<BloodWorkRow | null> =>
      rows.find((r) => r._id === id) ?? null,
  }

  const ctx = {
    db: {
      ...dbReader,
      insert: async (
        _table: 'bloodWork',
        doc: Omit<BloodWorkRow, '_id'>,
      ): Promise<string> => {
        const id = `bw_${nextId++}`
        rows.push({ ...doc, _id: id })
        return id
      },
      patch: async (id: string, patch: Partial<BloodWorkRow>): Promise<void> => {
        const idx = rows.findIndex((r) => r._id === id)
        if (idx === -1) throw new Error(`patch on missing id ${id}`)
        rows[idx] = { ...rows[idx], ...patch }
      },
    },
  }

  return { ctx, rows }
}

const sampleMarker = (overrides: Partial<Marker> = {}): Marker => ({
  name: 'CRP',
  value: 12,
  unit: 'mg/L',
  refRangeLow: 0,
  refRangeHigh: 5,
  ...overrides,
})

// Each call gets a fresh idempotency token — same rationale as doctorVisits.
let bwReqCounter = 0
const baseArgs = (
  overrides: Partial<CreateBloodWorkArgs> = {},
): CreateBloodWorkArgs => ({
  userId: 'user_A',
  date: '2026-05-10',
  markers: [sampleMarker()],
  notes: 'Standard panel',
  source: 'module',
  clientRequestId: `bw_req_${++bwReqCounter}`,
  ...overrides,
})

type Ctx = Parameters<typeof createBloodWorkHandler>[0]

describe('normaliseMarkers (pure)', () => {
  it('rejects empty markers array', () => {
    expect(() => normaliseMarkers([])).toThrow(/At least one marker is required/)
  })

  it('rejects non-finite value', () => {
    expect(() =>
      normaliseMarkers([sampleMarker({ value: Number.NaN })]),
    ).toThrow(/value must be finite/)
  })

  it('rejects empty trimmed name', () => {
    expect(() =>
      normaliseMarkers([sampleMarker({ name: '   ' })]),
    ).toThrow(/name must be non-empty/)
  })

  it('rejects empty trimmed unit', () => {
    expect(() =>
      normaliseMarkers([sampleMarker({ unit: '   ' })]),
    ).toThrow(/unit must be non-empty/)
  })

  it('rejects refRangeLow > refRangeHigh', () => {
    expect(() =>
      normaliseMarkers([sampleMarker({ refRangeLow: 10, refRangeHigh: 5 })]),
    ).toThrow(/refRangeLow must be <= refRangeHigh/)
  })

  it('derives abnormal=true when value above range', () => {
    const out = normaliseMarkers([sampleMarker({ value: 12, refRangeLow: 0, refRangeHigh: 5 })])
    expect(out[0].abnormal).toBe(true)
  })

  it('derives abnormal=false when value within range', () => {
    const out = normaliseMarkers([sampleMarker({ value: 3, refRangeLow: 0, refRangeHigh: 5 })])
    expect(out[0].abnormal).toBe(false)
  })

  it('does not derive abnormal when ranges absent', () => {
    const out = normaliseMarkers([
      { name: 'CRP', value: 12, unit: 'mg/L' },
    ])
    expect(out[0].abnormal).toBeUndefined()
  })

  it('passes through explicit abnormal flag', () => {
    const out = normaliseMarkers([
      { name: 'CRP', value: 12, unit: 'mg/L', abnormal: true },
    ])
    expect(out[0].abnormal).toBe(true)
  })
})

describe('createBloodWorkHandler', () => {
  it('happy path persists row + markers array', async () => {
    const { ctx, rows } = makeCtx()
    const result = await createBloodWorkHandler(ctx as unknown as Ctx, baseArgs())
    expect(result.id).toMatch(/^bw_/)
    expect(rows.length).toBe(1)
    expect(rows[0].markers.length).toBe(1)
    expect(rows[0].markers[0].name).toBe('CRP')
    expect(rows[0].markers[0].value).toBe(12)
    // abnormal derived (12 > 5).
    expect(rows[0].markers[0].abnormal).toBe(true)
    expect(rows[0].createdAt).toBeGreaterThan(0)
  })

  it('persists multi-marker arrays in order', async () => {
    const { ctx, rows } = makeCtx()
    await createBloodWorkHandler(
      ctx as unknown as Ctx,
      baseArgs({
        markers: [
          sampleMarker({ name: 'CRP', value: 3 }),
          sampleMarker({ name: 'ESR', value: 20, unit: 'mm/hr', refRangeLow: 0, refRangeHigh: 30 }),
          { name: 'WBC', value: 7.4, unit: 'x10^9/L' },
        ],
      }),
    )
    expect(rows[0].markers.map((m) => m.name)).toEqual(['CRP', 'ESR', 'WBC'])
    expect(rows[0].markers[2].abnormal).toBeUndefined()
  })

  it('rejects empty markers[]', async () => {
    const { ctx } = makeCtx()
    await expect(
      createBloodWorkHandler(ctx as unknown as Ctx, baseArgs({ markers: [] })),
    ).rejects.toMatchObject({
      data: { code: 'bloodWork.no_markers' },
    })
  })

  it('rejects when source=check-in but checkInId missing', async () => {
    const { ctx } = makeCtx()
    await expect(
      createBloodWorkHandler(
        ctx as unknown as Ctx,
        baseArgs({ source: 'check-in' }),
      ),
    ).rejects.toMatchObject({
      data: { code: 'bloodWork.missing_check_in_id' },
    })
  })

  it('rejects when source=module but checkInId set', async () => {
    const { ctx } = makeCtx()
    await expect(
      createBloodWorkHandler(
        ctx as unknown as Ctx,
        baseArgs({ source: 'module', checkInId: 'ci_1' }),
      ),
    ).rejects.toMatchObject({
      data: { code: 'bloodWork.unexpected_check_in_id' },
    })
  })

  it('persists with source=check-in + checkInId', async () => {
    const { ctx, rows } = makeCtx()
    await createBloodWorkHandler(
      ctx as unknown as Ctx,
      baseArgs({ source: 'check-in', checkInId: 'ci_42' }),
    )
    expect(rows[0].source).toBe('check-in')
    expect(rows[0].checkInId).toBe('ci_42')
  })

  it('idempotent: same clientRequestId returns the existing row, no duplicate insert', async () => {
    const { ctx, rows } = makeCtx()
    const args = baseArgs({ clientRequestId: 'bw_idem_1' })
    const first = await createBloodWorkHandler(ctx as unknown as Ctx, args)
    expect(rows.length).toBe(1)
    const second = await createBloodWorkHandler(ctx as unknown as Ctx, args)
    expect(rows.length).toBe(1)
    expect(second.id).toBe(first.id)
  })

  it('persists clientRequestId on the row', async () => {
    const { ctx, rows } = makeCtx()
    await createBloodWorkHandler(
      ctx as unknown as Ctx,
      baseArgs({ clientRequestId: 'bw_persist' }),
    )
    expect(rows[0].clientRequestId).toBe('bw_persist')
  })

  it('error is a ConvexError', async () => {
    const { ctx } = makeCtx()
    try {
      await createBloodWorkHandler(ctx as unknown as Ctx, baseArgs({ markers: [] }))
      throw new Error('expected throw')
    } catch (e) {
      expect(e).toBeInstanceOf(ConvexError)
    }
  })
})

describe('updateBloodWorkHandler', () => {
  it('patches notes only', async () => {
    const { ctx, rows } = makeCtx()
    const created = await createBloodWorkHandler(ctx as unknown as Ctx, baseArgs())
    await updateBloodWorkHandler(ctx as unknown as Ctx, {
      bloodWorkId: created.id,
      userId: 'user_A',
      notes: 'Re-checked',
    })
    expect(rows[0].notes).toBe('Re-checked')
    expect(rows[0].markers[0].name).toBe('CRP')
  })

  it('replaces markers and re-derives abnormal', async () => {
    const { ctx, rows } = makeCtx()
    const created = await createBloodWorkHandler(ctx as unknown as Ctx, baseArgs())
    await updateBloodWorkHandler(ctx as unknown as Ctx, {
      bloodWorkId: created.id,
      userId: 'user_A',
      markers: [
        sampleMarker({ name: 'CRP', value: 2, refRangeLow: 0, refRangeHigh: 5 }),
      ],
    })
    expect(rows[0].markers[0].value).toBe(2)
    expect(rows[0].markers[0].abnormal).toBe(false)
  })

  it('rejects userId mismatch', async () => {
    const { ctx } = makeCtx()
    const created = await createBloodWorkHandler(ctx as unknown as Ctx, baseArgs())
    await expect(
      updateBloodWorkHandler(ctx as unknown as Ctx, {
        bloodWorkId: created.id,
        userId: 'user_OTHER',
        notes: 'hijack',
      }),
    ).rejects.toMatchObject({
      data: { code: 'bloodWork.not_found' },
    })
  })

  it('rejects soft-deleted row', async () => {
    const { ctx, rows } = makeCtx()
    const created = await createBloodWorkHandler(ctx as unknown as Ctx, baseArgs())
    rows[0].deletedAt = Date.now()
    await expect(
      updateBloodWorkHandler(ctx as unknown as Ctx, {
        bloodWorkId: created.id,
        userId: 'user_A',
        notes: 'x',
      }),
    ).rejects.toMatchObject({
      data: { code: 'bloodWork.not_found' },
    })
  })

  it('rejects empty markers via update', async () => {
    const { ctx } = makeCtx()
    const created = await createBloodWorkHandler(ctx as unknown as Ctx, baseArgs())
    await expect(
      updateBloodWorkHandler(ctx as unknown as Ctx, {
        bloodWorkId: created.id,
        userId: 'user_A',
        markers: [],
      }),
    ).rejects.toMatchObject({
      data: { code: 'bloodWork.no_markers' },
    })
  })
})

describe('softDeleteBloodWorkHandler', () => {
  it('sets deletedAt and is idempotent', async () => {
    const { ctx, rows } = makeCtx()
    const created = await createBloodWorkHandler(ctx as unknown as Ctx, baseArgs())
    const first = await softDeleteBloodWorkHandler(ctx as unknown as Ctx, {
      bloodWorkId: created.id,
      userId: 'user_A',
    })
    const stamp = rows[0].deletedAt
    expect(first.alreadyDeleted).toBe(false)
    await new Promise((r) => setTimeout(r, 2))
    const second = await softDeleteBloodWorkHandler(ctx as unknown as Ctx, {
      bloodWorkId: created.id,
      userId: 'user_A',
    })
    expect(second.alreadyDeleted).toBe(true)
    expect(rows[0].deletedAt).toBe(stamp)
  })

  it('soft-deleted rows excluded from listBloodWork', async () => {
    const { ctx } = makeCtx()
    const a = await createBloodWorkHandler(
      ctx as unknown as Ctx,
      baseArgs({ date: '2026-05-09' }),
    )
    await createBloodWorkHandler(
      ctx as unknown as Ctx,
      baseArgs({ date: '2026-05-10' }),
    )
    await softDeleteBloodWorkHandler(ctx as unknown as Ctx, {
      bloodWorkId: a.id,
      userId: 'user_A',
    })
    const list = await listBloodWorkHandler(ctx as unknown as Ctx, {
      userId: 'user_A',
    })
    expect(list.items.length).toBe(1)
    expect(list.items[0].date).toBe('2026-05-10')
  })

  it('rejects userId mismatch', async () => {
    const { ctx } = makeCtx()
    const created = await createBloodWorkHandler(ctx as unknown as Ctx, baseArgs())
    await expect(
      softDeleteBloodWorkHandler(ctx as unknown as Ctx, {
        bloodWorkId: created.id,
        userId: 'user_OTHER',
      }),
    ).rejects.toMatchObject({
      data: { code: 'bloodWork.not_found' },
    })
  })
})

describe('listBloodWorkHandler', () => {
  it('empty → { items: [] }', async () => {
    const { ctx } = makeCtx()
    const result = await listBloodWorkHandler(ctx as unknown as Ctx, {
      userId: 'user_A',
    })
    expect(result.items).toEqual([])
  })

  it('respects fromDate/toDate range', async () => {
    const { ctx } = makeCtx()
    for (const date of [
      '2026-04-20',
      '2026-04-22',
      '2026-04-24',
      '2026-04-26',
    ]) {
      await createBloodWorkHandler(ctx as unknown as Ctx, baseArgs({ date }))
    }
    const result = await listBloodWorkHandler(ctx as unknown as Ctx, {
      userId: 'user_A',
      fromDate: '2026-04-22',
      toDate: '2026-04-24',
    })
    expect(result.items.map((r) => r.date)).toEqual([
      '2026-04-24',
      '2026-04-22',
    ])
  })

  it('only fromDate filters lower bound', async () => {
    const { ctx } = makeCtx()
    for (const date of ['2026-04-20', '2026-04-25', '2026-04-30']) {
      await createBloodWorkHandler(ctx as unknown as Ctx, baseArgs({ date }))
    }
    const result = await listBloodWorkHandler(ctx as unknown as Ctx, {
      userId: 'user_A',
      fromDate: '2026-04-25',
    })
    expect(result.items.map((r) => r.date)).toEqual([
      '2026-04-30',
      '2026-04-25',
    ])
  })

  it('scopes by userId', async () => {
    const { ctx } = makeCtx()
    await createBloodWorkHandler(
      ctx as unknown as Ctx,
      baseArgs({ userId: 'user_A' }),
    )
    await createBloodWorkHandler(
      ctx as unknown as Ctx,
      baseArgs({ userId: 'user_B' }),
    )
    const result = await listBloodWorkHandler(ctx as unknown as Ctx, {
      userId: 'user_A',
    })
    expect(result.items.length).toBe(1)
    expect(result.items[0].userId).toBe('user_A')
  })
})

describe('getBloodWorkByDateHandler', () => {
  it('returns rows for the date and excludes soft-deleted', async () => {
    const { ctx } = makeCtx()
    const a = await createBloodWorkHandler(
      ctx as unknown as Ctx,
      baseArgs({ date: '2026-05-10' }),
    )
    await createBloodWorkHandler(
      ctx as unknown as Ctx,
      baseArgs({ date: '2026-05-10', notes: 'second' }),
    )
    await createBloodWorkHandler(
      ctx as unknown as Ctx,
      baseArgs({ date: '2026-05-11' }),
    )
    let result = await getBloodWorkByDateHandler(ctx as unknown as Ctx, {
      userId: 'user_A',
      date: '2026-05-10',
    })
    expect(result.items.length).toBe(2)
    await softDeleteBloodWorkHandler(ctx as unknown as Ctx, {
      bloodWorkId: a.id,
      userId: 'user_A',
    })
    result = await getBloodWorkByDateHandler(ctx as unknown as Ctx, {
      userId: 'user_A',
      date: '2026-05-10',
    })
    expect(result.items.length).toBe(1)
    expect(result.items[0].notes).toBe('second')
  })
})
