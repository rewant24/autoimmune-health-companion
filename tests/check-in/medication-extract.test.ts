/**
 * Tests for `lib/checkin/medication-extract.ts` (F04 chunk 4.C, US-4.C.2 + US-4.C.3).
 *
 * Covers:
 *   - Zod schema validates the structured-output shape.
 *   - `extractMedications` round-trips canned route responses.
 *   - Empty regimen short-circuits without calling fetch.
 *   - Failures (non-200, malformed JSON, network) raise
 *     `MedicationExtractFailedError`.
 *   - `resolveSkipped` / `resolveLoggedMedications` / `resolveDosageChanges`
 *     match case-insensitively against the regimen and drop unmatched
 *     names silently.
 *   - Same-dose dosage-change mentions are dropped (defence-in-depth for
 *     the Convex `dosage.no_change` rule).
 *
 * The route handler at `app/api/check-in/extract-medication/route.ts` is
 * exercised directly with a mocked `ai` module — the cost-guard invariant
 * (route does NOT call incrementAndCheck) is asserted there.
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
import { POST as extractMedicationPost } from '@/app/api/check-in/extract-medication/route'
import {
  EMPTY_EXTRACTION,
  MedicationExtractionSchema,
  MedicationExtractFailedError,
  buildSystemPrompt,
  extractMedications,
  resolveDosageChanges,
  resolveLoggedMedications,
  resolveSkipped,
  type RegimenMedication,
  type ExtractedMedicationResult,
} from '@/lib/checkin/medication-extract'

const REGIMEN: RegimenMedication[] = [
  { _id: 'med_1', name: 'Methotrexate', dose: '15mg' },
  { _id: 'med_2', name: 'Prednisone', dose: '10mg' },
  { _id: 'med_3', name: 'Folic acid', dose: '5mg' },
]

function jsonRequest(body: unknown): Request {
  return new Request('http://localhost/api/check-in/extract-medication', {
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

describe('MedicationExtractionSchema', () => {
  it('accepts the empty / null defaults', () => {
    const parsed = MedicationExtractionSchema.parse(EMPTY_EXTRACTION)
    expect(parsed).toEqual(EMPTY_EXTRACTION)
  })

  it('accepts a populated result', () => {
    const input: ExtractedMedicationResult = {
      simpleAdherence: { confirmed: true },
      skippedMedications: [{ medicationName: 'Prednisone' }],
      dosageChanges: [
        { medicationName: 'Prednisone', newDose: '20mg', reason: 'flare' },
      ],
    }
    expect(MedicationExtractionSchema.parse(input)).toEqual(input)
  })

  it('rejects bad shapes', () => {
    expect(() =>
      MedicationExtractionSchema.parse({ simpleAdherence: true }),
    ).toThrow()
    expect(() =>
      MedicationExtractionSchema.parse({
        simpleAdherence: null,
        skippedMedications: [{ wrongField: 'x' }],
        dosageChanges: [],
      }),
    ).toThrow()
  })
})

// =========================================================================
// extractMedications client helper
// =========================================================================

describe('extractMedications', () => {
  it('returns EMPTY_EXTRACTION immediately when regimen is empty', async () => {
    const fetchSpy = vi.fn()
    const result = await extractMedications({
      transcript: 'I took my meds',
      userId: 'u-1',
      date: '2026-04-30',
      regimen: [],
      fetchImpl: fetchSpy as unknown as typeof fetch,
    })
    expect(result).toEqual(EMPTY_EXTRACTION)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('round-trips a canned route response', async () => {
    const canned: ExtractedMedicationResult = {
      simpleAdherence: { confirmed: true },
      skippedMedications: [{ medicationName: 'Prednisone' }],
      dosageChanges: [],
    }
    const fetchSpy = vi.fn(async () =>
      new Response(JSON.stringify({ result: canned }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const result = await extractMedications({
      transcript: 'Took my meds, skipped the prednisone',
      userId: 'u-1',
      date: '2026-04-30',
      regimen: REGIMEN,
      fetchImpl: fetchSpy as unknown as typeof fetch,
    })
    expect(result).toEqual(canned)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const call = fetchSpy.mock.calls[0] as unknown as [string, RequestInit]
    const init = call[1]
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body as string)
    expect(body.regimen).toEqual(
      REGIMEN.map((m) => ({ _id: m._id, name: m.name, dose: m.dose })),
    )
  })

  it('throws MedicationExtractFailedError on non-200', async () => {
    const fetchSpy = vi.fn(async () =>
      new Response(JSON.stringify({ error: { code: 'medication-extract.failed' } }), {
        status: 502,
      }),
    )
    await expect(
      extractMedications({
        transcript: 'x',
        userId: 'u-1',
        date: '2026-04-30',
        regimen: REGIMEN,
        fetchImpl: fetchSpy as unknown as typeof fetch,
      }),
    ).rejects.toBeInstanceOf(MedicationExtractFailedError)
  })

  it('throws MedicationExtractFailedError on malformed body', async () => {
    const fetchSpy = vi.fn(async () =>
      new Response(JSON.stringify({ result: { wrong: 'shape' } }), {
        status: 200,
      }),
    )
    await expect(
      extractMedications({
        transcript: 'x',
        userId: 'u-1',
        date: '2026-04-30',
        regimen: REGIMEN,
        fetchImpl: fetchSpy as unknown as typeof fetch,
      }),
    ).rejects.toBeInstanceOf(MedicationExtractFailedError)
  })

  it('throws MedicationExtractFailedError on network failure', async () => {
    const fetchSpy = vi.fn(async () => {
      throw new Error('offline')
    })
    await expect(
      extractMedications({
        transcript: 'x',
        userId: 'u-1',
        date: '2026-04-30',
        regimen: REGIMEN,
        fetchImpl: fetchSpy as unknown as typeof fetch,
      }),
    ).rejects.toBeInstanceOf(MedicationExtractFailedError)
  })
})

// =========================================================================
// resolveSkipped / resolveLoggedMedications / resolveDosageChanges
// =========================================================================

describe('resolveSkipped', () => {
  it('matches case-insensitively', () => {
    const result: ExtractedMedicationResult = {
      simpleAdherence: null,
      skippedMedications: [{ medicationName: 'prednisone' }],
      dosageChanges: [],
    }
    expect(resolveSkipped(result, REGIMEN).map((m) => m._id)).toEqual([
      'med_2',
    ])
  })

  it('drops unmatched names silently', () => {
    const result: ExtractedMedicationResult = {
      simpleAdherence: null,
      skippedMedications: [
        { medicationName: 'Aspirin' },
        { medicationName: 'Methotrexate' },
      ],
      dosageChanges: [],
    }
    expect(resolveSkipped(result, REGIMEN).map((m) => m._id)).toEqual([
      'med_1',
    ])
  })

  it('dedupes repeated mentions', () => {
    const result: ExtractedMedicationResult = {
      simpleAdherence: null,
      skippedMedications: [
        { medicationName: 'Prednisone' },
        { medicationName: 'PREDNISONE' },
      ],
      dosageChanges: [],
    }
    expect(resolveSkipped(result, REGIMEN)).toHaveLength(1)
  })
})

describe('resolveLoggedMedications', () => {
  it('returns empty when simpleAdherence is null', () => {
    const result: ExtractedMedicationResult = {
      simpleAdherence: null,
      skippedMedications: [],
      dosageChanges: [],
    }
    expect(resolveLoggedMedications(result, REGIMEN)).toEqual([])
  })

  it('logs all medications when simpleAdherence.confirmed is true', () => {
    const result: ExtractedMedicationResult = {
      simpleAdherence: { confirmed: true },
      skippedMedications: [],
      dosageChanges: [],
    }
    expect(
      resolveLoggedMedications(result, REGIMEN).map((m) => m._id),
    ).toEqual(['med_1', 'med_2', 'med_3'])
  })

  it('logs all EXCEPT the named skipped medications (partial adherence)', () => {
    const result: ExtractedMedicationResult = {
      simpleAdherence: { confirmed: true },
      skippedMedications: [{ medicationName: 'Prednisone' }],
      dosageChanges: [],
    }
    expect(
      resolveLoggedMedications(result, REGIMEN).map((m) => m._id),
    ).toEqual(['med_1', 'med_3'])
  })

  it('returns nothing when simpleAdherence.confirmed is false', () => {
    const result: ExtractedMedicationResult = {
      simpleAdherence: { confirmed: false },
      skippedMedications: [],
      dosageChanges: [],
    }
    expect(resolveLoggedMedications(result, REGIMEN)).toEqual([])
  })
})

describe('resolveDosageChanges', () => {
  it('matches and preserves order', () => {
    const result: ExtractedMedicationResult = {
      simpleAdherence: null,
      skippedMedications: [],
      dosageChanges: [
        { medicationName: 'prednisone', newDose: '20mg', reason: 'flare' },
        { medicationName: 'Methotrexate', newDose: '20mg' },
      ],
    }
    const resolved = resolveDosageChanges(result, REGIMEN)
    expect(resolved).toHaveLength(2)
    expect(resolved[0]!.medication._id).toBe('med_2')
    expect(resolved[0]!.newDose).toBe('20mg')
    expect(resolved[0]!.reason).toBe('flare')
    expect(resolved[1]!.medication._id).toBe('med_1')
  })

  it('drops unmatched medications', () => {
    const result: ExtractedMedicationResult = {
      simpleAdherence: null,
      skippedMedications: [],
      dosageChanges: [{ medicationName: 'Aspirin', newDose: '100mg' }],
    }
    expect(resolveDosageChanges(result, REGIMEN)).toEqual([])
  })

  it('drops same-dose changes (defence-in-depth for dosage.no_change)', () => {
    const result: ExtractedMedicationResult = {
      simpleAdherence: null,
      skippedMedications: [],
      dosageChanges: [{ medicationName: 'Prednisone', newDose: '10mg' }],
    }
    expect(resolveDosageChanges(result, REGIMEN)).toEqual([])
  })

  it('whitespace + case differences are not "same-dose"', () => {
    // "10 mg" vs "10mg" — different strings, the user did say something
    // different out loud. We let the change through; the user can dismiss
    // the confirm card if it's a mishear.
    const result: ExtractedMedicationResult = {
      simpleAdherence: null,
      skippedMedications: [],
      dosageChanges: [{ medicationName: 'Prednisone', newDose: '10 mg' }],
    }
    expect(resolveDosageChanges(result, REGIMEN)).toHaveLength(1)
  })
})

// =========================================================================
// Prompt construction
// =========================================================================

describe('buildSystemPrompt', () => {
  it('lists each regimen medication with its dose', () => {
    const prompt = buildSystemPrompt(REGIMEN)
    expect(prompt).toContain('Methotrexate — 15mg')
    expect(prompt).toContain('Prednisone — 10mg')
    expect(prompt).toContain('Folic acid — 5mg')
  })

  it('renders a placeholder when regimen is empty', () => {
    const prompt = buildSystemPrompt([])
    expect(prompt).toContain('(none — return empty result)')
  })

  it('repeats the no-hallucination rule', () => {
    const prompt = buildSystemPrompt(REGIMEN)
    expect(prompt).toContain('Drop unmatched mentions silently')
  })
})

// =========================================================================
// Route handler — `app/api/check-in/extract-medication/route.ts`
// =========================================================================

describe('POST /api/check-in/extract-medication — request validation', () => {
  it('returns 400 on invalid JSON body', async () => {
    const res = await extractMedicationPost(jsonRequest('not-json{'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('medication-extract.bad_request')
  })

  it('returns 400 when fields are missing', async () => {
    const res = await extractMedicationPost(
      jsonRequest({ transcript: 'x', userId: 'u-1' }),
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 when regimen is malformed', async () => {
    const res = await extractMedicationPost(
      jsonRequest({
        transcript: 'x',
        userId: 'u-1',
        date: '2026-04-30',
        regimen: [{ _id: 1 }],
      }),
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 when date is malformed', async () => {
    const res = await extractMedicationPost(
      jsonRequest({
        transcript: 'x',
        userId: 'u-1',
        date: 'April 30',
        regimen: REGIMEN,
      }),
    )
    expect(res.status).toBe(400)
  })
})

describe('POST /api/check-in/extract-medication — cost-guard invariant', () => {
  it('does NOT increment the daily cap (no Convex call) — invariant per ADR-020', async () => {
    // The route handler must not import or invoke `incrementAndCheck`.
    // Read the source file's text and assert that no such reference
    // appears. Lightweight defence-in-depth against an accidental edit
    // that double-bills the cost guard.
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const source = await fs.readFile(
      path.resolve(
        process.cwd(),
        'app/api/check-in/extract-medication/route.ts',
      ),
      'utf8',
    )
    // The strings appear in the comment block explaining the invariant —
    // strip comments before asserting absence in real code.
    const codeOnly = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
    expect(codeOnly).not.toContain('incrementAndCheck')
    expect(codeOnly).not.toContain('extractAttempts')
    // And confirm there's no Convex import — the route uses `ai` only.
    expect(codeOnly).not.toMatch(/from\s+["']convex/)
  })
})

describe('POST /api/check-in/extract-medication — LLM call', () => {
  it('returns 200 with canned result on success', async () => {
    const canned: ExtractedMedicationResult = {
      simpleAdherence: { confirmed: true },
      skippedMedications: [{ medicationName: 'Prednisone' }],
      dosageChanges: [],
    }
    generateObjectMock.mockResolvedValue({ object: canned })
    const res = await extractMedicationPost(
      jsonRequest({
        transcript: 'Took my meds, skipped the prednisone',
        userId: 'u-1',
        date: '2026-04-30',
        regimen: REGIMEN,
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.result).toEqual(canned)
  })

  it('uses gpt-4o-mini via gateway as the locked model id', async () => {
    generateObjectMock.mockResolvedValue({
      object: EMPTY_EXTRACTION,
    })
    await extractMedicationPost(
      jsonRequest({
        transcript: 'ok',
        userId: 'u-1',
        date: '2026-04-30',
        regimen: REGIMEN,
      }),
    )
    expect(gatewayMock).toHaveBeenCalledWith('openai/gpt-4o-mini')
  })

  it('caps maxOutputTokens at 400 (larger than metric route — arrays of objects)', async () => {
    generateObjectMock.mockResolvedValue({ object: EMPTY_EXTRACTION })
    await extractMedicationPost(
      jsonRequest({
        transcript: 'ok',
        userId: 'u-1',
        date: '2026-04-30',
        regimen: REGIMEN,
      }),
    )
    const opts = (generateObjectMock.mock.calls[0] as unknown as unknown[])[0] as {
      maxOutputTokens: number
    }
    expect(opts.maxOutputTokens).toBe(400)
  })

  it('renders the regimen list inside the system prompt', async () => {
    generateObjectMock.mockResolvedValue({ object: EMPTY_EXTRACTION })
    await extractMedicationPost(
      jsonRequest({
        transcript: 'ok',
        userId: 'u-1',
        date: '2026-04-30',
        regimen: REGIMEN,
      }),
    )
    const opts = (generateObjectMock.mock.calls[0] as unknown as unknown[])[0] as { system: string }
    expect(opts.system).toContain('Methotrexate — 15mg')
    expect(opts.system).toContain('Prednisone — 10mg')
  })

  it('short-circuits an empty transcript without calling the model', async () => {
    const res = await extractMedicationPost(
      jsonRequest({
        transcript: '   ',
        userId: 'u-1',
        date: '2026-04-30',
        regimen: REGIMEN,
      }),
    )
    expect(res.status).toBe(200)
    expect(generateObjectMock).not.toHaveBeenCalled()
    const body = await res.json()
    expect(body.result).toEqual(EMPTY_EXTRACTION)
  })

  it('short-circuits an empty regimen without calling the model', async () => {
    const res = await extractMedicationPost(
      jsonRequest({
        transcript: 'I took my meds',
        userId: 'u-1',
        date: '2026-04-30',
        regimen: [],
      }),
    )
    expect(res.status).toBe(200)
    expect(generateObjectMock).not.toHaveBeenCalled()
    const body = await res.json()
    expect(body.result).toEqual(EMPTY_EXTRACTION)
  })

  it('returns 502 when generateObject throws', async () => {
    generateObjectMock.mockRejectedValue(new Error('schema parse failed'))
    const res = await extractMedicationPost(
      jsonRequest({
        transcript: 'I took my meds',
        userId: 'u-1',
        date: '2026-04-30',
        regimen: REGIMEN,
      }),
    )
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error.code).toBe('medication-extract.failed')
  })
})
