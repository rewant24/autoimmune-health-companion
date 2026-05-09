/**
 * Tests for `lib/checkin/event-extract.ts` + `app/api/check-in/extract-event/route.ts`
 * (F05 chunk 5.C, US-5.C.1 + US-5.C.2).
 *
 * Covers:
 *   - Zod schema validates well-formed responses (and uses `.nullable()` not
 *     `.optional()` per the F04 PR #19 root cause).
 *   - `extractEvents` client helper short-circuits on empty transcript and
 *     round-trips canned route responses.
 *   - Failures (non-200, malformed JSON, network) raise `EventExtractFailedError`.
 *   - Date-anchor resolver: relative phrases → fixed dates against a fixture
 *     `checkInDate`. Deterministic — no `Date.now()`.
 *   - Route handler returns `{ visits, bloodWork }`, validates request body,
 *     and crucially does NOT call `incrementAndCheck` (cost-guard invariant).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocks for the route-handler tests below ------------------------------

const generateObjectMock = vi.fn()
const gatewayMock = vi.fn((id: string) => ({ __mock: 'gateway', id }))
vi.mock('ai', () => ({
  generateObject: (...args: unknown[]) => generateObjectMock(...args),
  gateway: (id: string) => gatewayMock(id),
}))

// Importing the route AFTER the mock is registered is required.
import { POST as extractEventPost } from '@/app/api/check-in/extract-event/route'
import {
  EMPTY_EVENT_EXTRACTION,
  EventExtractFailedError,
  EventExtractionSchema,
  buildSystemPrompt,
  extractEvents,
  resolveRelativeDate,
  type ExtractedEventResult,
} from '@/lib/checkin/event-extract'

function jsonRequest(body: unknown): Request {
  return new Request('http://localhost/api/check-in/extract-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

beforeEach(() => {
  generateObjectMock.mockReset()
  gatewayMock.mockClear()
})

// =========================================================================
// Schema
// =========================================================================

describe('EventExtractionSchema', () => {
  it('accepts the empty default', () => {
    expect(EventExtractionSchema.parse(EMPTY_EVENT_EXTRACTION)).toEqual(
      EMPTY_EVENT_EXTRACTION,
    )
  })

  it('accepts a populated result with null specialty/notes/unit', () => {
    const input: ExtractedEventResult = {
      visits: [
        {
          doctorName: 'Dr. Mehta',
          date: '2026-04-29',
          specialty: null,
          visitType: 'follow-up',
          notes: null,
        },
      ],
      bloodWork: [
        {
          date: '2026-04-29',
          markers: [
            { name: 'CRP', value: 12, unit: 'mg/L' },
            { name: 'ESR', value: 30, unit: null },
          ],
          notes: null,
        },
      ],
    }
    expect(EventExtractionSchema.parse(input)).toEqual(input)
  })

  it('rejects when an optional field is `undefined` instead of null', () => {
    // This is the F04 PR #19 regression — `.optional()` would let undefined
    // through and break OpenAI structured outputs. The schema MUST use
    // `.nullable()` so the field is required-but-nullable.
    expect(() =>
      EventExtractionSchema.parse({
        visits: [
          {
            doctorName: 'Dr. M',
            date: '2026-04-29',
            // specialty intentionally missing
            visitType: 'consultation',
            notes: null,
          },
        ],
        bloodWork: [],
      }),
    ).toThrow()
  })

  it('rejects bad shapes', () => {
    expect(() =>
      EventExtractionSchema.parse({ visits: 'nope', bloodWork: [] }),
    ).toThrow()
    expect(() =>
      EventExtractionSchema.parse({
        visits: [],
        bloodWork: [{ date: '2026-04-29', markers: 'nope', notes: null }],
      }),
    ).toThrow()
  })
})

// =========================================================================
// extractEvents client helper
// =========================================================================

describe('extractEvents', () => {
  it('short-circuits empty transcript without calling fetch', async () => {
    const fetchSpy = vi.fn()
    const result = await extractEvents({
      transcript: '   ',
      userId: 'u-1',
      checkInDate: '2026-04-30',
      fetchImpl: fetchSpy as unknown as typeof fetch,
    })
    expect(result).toEqual(EMPTY_EVENT_EXTRACTION)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('round-trips a canned route response', async () => {
    const canned: ExtractedEventResult = {
      visits: [
        {
          doctorName: 'Dr. Mehta',
          date: '2026-04-29',
          specialty: 'rheumatologist',
          visitType: 'follow-up',
          notes: null,
        },
      ],
      bloodWork: [],
    }
    const fetchSpy = vi.fn(async () =>
      new Response(JSON.stringify({ result: canned }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const result = await extractEvents({
      transcript: 'Saw Dr. Mehta yesterday',
      userId: 'u-1',
      checkInDate: '2026-04-30',
      fetchImpl: fetchSpy as unknown as typeof fetch,
    })
    expect(result).toEqual(canned)
    const call = fetchSpy.mock.calls[0] as unknown as [string, RequestInit]
    const init = call[1]
    const body = JSON.parse(init.body as string)
    expect(body).toEqual({
      transcript: 'Saw Dr. Mehta yesterday',
      userId: 'u-1',
      checkInDate: '2026-04-30',
    })
  })

  it('throws EventExtractFailedError on non-200', async () => {
    const fetchSpy = vi.fn(async () =>
      new Response('{}', { status: 502 }),
    )
    await expect(
      extractEvents({
        transcript: 'x',
        userId: 'u-1',
        checkInDate: '2026-04-30',
        fetchImpl: fetchSpy as unknown as typeof fetch,
      }),
    ).rejects.toBeInstanceOf(EventExtractFailedError)
  })

  it('throws EventExtractFailedError on malformed body', async () => {
    const fetchSpy = vi.fn(async () =>
      new Response(JSON.stringify({ result: { wrong: 'shape' } }), {
        status: 200,
      }),
    )
    await expect(
      extractEvents({
        transcript: 'x',
        userId: 'u-1',
        checkInDate: '2026-04-30',
        fetchImpl: fetchSpy as unknown as typeof fetch,
      }),
    ).rejects.toBeInstanceOf(EventExtractFailedError)
  })

  it('throws EventExtractFailedError on network failure', async () => {
    const fetchSpy = vi.fn(async () => {
      throw new Error('offline')
    })
    await expect(
      extractEvents({
        transcript: 'x',
        userId: 'u-1',
        checkInDate: '2026-04-30',
        fetchImpl: fetchSpy as unknown as typeof fetch,
      }),
    ).rejects.toBeInstanceOf(EventExtractFailedError)
  })
})

// =========================================================================
// Date-anchor resolver
// =========================================================================

describe('resolveRelativeDate', () => {
  // 2026-04-29 was a Wednesday.
  const ANCHOR = '2026-04-29'

  it('passes through literal YYYY-MM-DD', () => {
    expect(resolveRelativeDate('2026-05-15', ANCHOR)).toBe('2026-05-15')
  })

  it('today → checkInDate', () => {
    expect(resolveRelativeDate('today', ANCHOR)).toBe('2026-04-29')
    expect(resolveRelativeDate('TODAY', ANCHOR)).toBe('2026-04-29')
  })

  it('yesterday → checkInDate − 1 day', () => {
    expect(resolveRelativeDate('yesterday', ANCHOR)).toBe('2026-04-28')
  })

  it('tomorrow → checkInDate + 1 day', () => {
    expect(resolveRelativeDate('tomorrow', ANCHOR)).toBe('2026-04-30')
  })

  it('next Tuesday → first Tuesday strictly after Wed Apr 29', () => {
    // Tuesday after Wed Apr 29 is May 5.
    expect(resolveRelativeDate('next Tuesday', ANCHOR)).toBe('2026-05-05')
  })

  it('next Wednesday → 7 days later (strictly after the anchor day)', () => {
    expect(resolveRelativeDate('next Wednesday', ANCHOR)).toBe('2026-05-06')
  })

  it('last Friday → first Friday strictly before Wed Apr 29 = Apr 24', () => {
    expect(resolveRelativeDate('last Friday', ANCHOR)).toBe('2026-04-24')
  })

  it('bare weekday (Friday) → next Friday on or after anchor = May 1', () => {
    expect(resolveRelativeDate('Friday', ANCHOR)).toBe('2026-05-01')
  })

  it('bare anchor weekday (Wednesday) → anchor itself', () => {
    expect(resolveRelativeDate('Wednesday', ANCHOR)).toBe('2026-04-29')
  })

  it('unknown phrase falls back to checkInDate', () => {
    expect(resolveRelativeDate('whenever', ANCHOR)).toBe(ANCHOR)
  })

  it('does NOT call Date.now() — pure', () => {
    // If the resolver depended on the current date, mocking Date.now would
    // change the result. Verifies determinism by the simple expedient of
    // calling the resolver before and after stubbing Date.now and asserting
    // identity.
    const before = resolveRelativeDate('yesterday', ANCHOR)
    const orig = Date.now
    Date.now = () => 0
    try {
      expect(resolveRelativeDate('yesterday', ANCHOR)).toBe(before)
    } finally {
      Date.now = orig
    }
  })
})

// =========================================================================
// System prompt
// =========================================================================

describe('buildSystemPrompt', () => {
  it('embeds the check-in date so the model resolves relatives against it', () => {
    const prompt = buildSystemPrompt('2026-04-30')
    expect(prompt).toContain('2026-04-30')
    expect(prompt).toContain('Resolve relative phrases')
  })

  it('lists the four visitType enum values', () => {
    const prompt = buildSystemPrompt('2026-04-30')
    expect(prompt).toContain('consultation')
    expect(prompt).toContain('follow-up')
    expect(prompt).toContain('urgent')
    expect(prompt).toContain('other')
  })

  it('repeats the no-hallucination rule', () => {
    const prompt = buildSystemPrompt('2026-04-30')
    expect(prompt).toContain('Do not invent')
  })
})

// =========================================================================
// Route handler — request validation
// =========================================================================

describe('POST /api/check-in/extract-event — request validation', () => {
  it('returns 400 on invalid JSON body', async () => {
    const res = await extractEventPost(jsonRequest('not-json{'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('event-extract.bad_request')
  })

  it('returns 400 when fields are missing', async () => {
    const res = await extractEventPost(
      jsonRequest({ transcript: 'x', userId: 'u-1' }),
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 when checkInDate is malformed', async () => {
    const res = await extractEventPost(
      jsonRequest({
        transcript: 'x',
        userId: 'u-1',
        checkInDate: 'April 30',
      }),
    )
    expect(res.status).toBe(400)
  })
})

// =========================================================================
// Cost-guard invariant — CRITICAL — ADR-020 regression surface
// =========================================================================

describe('POST /api/check-in/extract-event — cost-guard invariant', () => {
  it('does NOT increment the daily cap (no Convex call) — invariant per ADR-020', async () => {
    // The route handler must not import or invoke `incrementAndCheck`.
    // Read the source file's text and assert that no such reference appears
    // in real code (comment block mentions are stripped before checking).
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const source = await fs.readFile(
      path.resolve(
        process.cwd(),
        'app/api/check-in/extract-event/route.ts',
      ),
      'utf8',
    )
    const codeOnly = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
    expect(codeOnly).not.toContain('incrementAndCheck')
    expect(codeOnly).not.toContain('extractAttempts')
    expect(codeOnly).not.toMatch(/from\s+["']convex/)
  })

  it(
    'three extractors per check-in burn exactly ONE cap counter — ' +
      'metric increments, medication + event do not',
    async () => {
      // Locks the F05-spec invariant: one summary firing all three extractors
      // (metric + medication + event) burns exactly one cap-counter slot.
      // Static source-level assertion — counts the routes that import
      // `incrementAndCheck` from the cost-guard module. Lower-cost than
      // spinning up actual handlers; same correctness signal.
      const fs = await import('node:fs/promises')
      const path = await import('node:path')
      const stripComments = (s: string): string =>
        s
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/^\s*\/\/.*$/gm, '')
      const read = async (p: string): Promise<string> =>
        stripComments(await fs.readFile(path.resolve(process.cwd(), p), 'utf8'))

      const metricRoute = await read('app/api/check-in/extract/route.ts')
      const medicationRoute = await read(
        'app/api/check-in/extract-medication/route.ts',
      )
      const eventRoute = await read('app/api/check-in/extract-event/route.ts')

      // Exactly the metric extractor calls incrementAndCheck.
      expect(metricRoute).toContain('incrementAndCheck')
      expect(medicationRoute).not.toContain('incrementAndCheck')
      expect(eventRoute).not.toContain('incrementAndCheck')

      // Exactly the metric extractor imports from convex (it's the only
      // route that needs the Convex client to call incrementAndCheck).
      expect(metricRoute).toMatch(/from\s+["']convex/)
      expect(medicationRoute).not.toMatch(/from\s+["']convex/)
      expect(eventRoute).not.toMatch(/from\s+["']convex/)
    },
  )
})

// =========================================================================
// Route handler — LLM call
// =========================================================================

describe('POST /api/check-in/extract-event — LLM call', () => {
  it('returns 200 with canned result on success', async () => {
    const canned: ExtractedEventResult = {
      visits: [
        {
          doctorName: 'Dr. Mehta',
          date: '2026-04-29',
          specialty: 'rheumatologist',
          visitType: 'follow-up',
          notes: null,
        },
      ],
      bloodWork: [
        {
          date: '2026-04-29',
          markers: [{ name: 'CRP', value: 12, unit: 'mg/L' }],
          notes: null,
        },
      ],
    }
    generateObjectMock.mockResolvedValue({ object: canned })
    const res = await extractEventPost(
      jsonRequest({
        transcript: 'Saw Dr. Mehta yesterday, CRP was 12 mg/L',
        userId: 'u-1',
        checkInDate: '2026-04-30',
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.result).toEqual(canned)
  })

  it('uses gpt-4o-mini via gateway as the locked model id', async () => {
    generateObjectMock.mockResolvedValue({ object: EMPTY_EVENT_EXTRACTION })
    await extractEventPost(
      jsonRequest({
        transcript: 'ok',
        userId: 'u-1',
        checkInDate: '2026-04-30',
      }),
    )
    expect(gatewayMock).toHaveBeenCalledWith('openai/gpt-4o-mini')
  })

  it('embeds checkInDate in the system prompt', async () => {
    generateObjectMock.mockResolvedValue({ object: EMPTY_EVENT_EXTRACTION })
    await extractEventPost(
      jsonRequest({
        transcript: 'ok',
        userId: 'u-1',
        checkInDate: '2026-04-30',
      }),
    )
    const opts = (generateObjectMock.mock.calls[0] as unknown as unknown[])[0] as {
      system: string
    }
    expect(opts.system).toContain('2026-04-30')
  })

  it('short-circuits an empty transcript without calling the model', async () => {
    const res = await extractEventPost(
      jsonRequest({
        transcript: '   ',
        userId: 'u-1',
        checkInDate: '2026-04-30',
      }),
    )
    expect(res.status).toBe(200)
    expect(generateObjectMock).not.toHaveBeenCalled()
    const body = await res.json()
    expect(body.result).toEqual({ visits: [], bloodWork: [] })
  })

  it('returns 502 when generateObject throws', async () => {
    generateObjectMock.mockRejectedValue(new Error('schema parse failed'))
    const res = await extractEventPost(
      jsonRequest({
        transcript: 'Saw Dr. Mehta',
        userId: 'u-1',
        checkInDate: '2026-04-30',
      }),
    )
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error.code).toBe('event-extract.failed')
  })
})
