/**
 * Tests for `components/home/IntakeTapList.tsx` (F04 chunk 4.C, US-4.C.1).
 *
 * Coverage:
 *   - Hides while the Convex subscription is still resolving.
 *   - Hides when the regimen is empty.
 *   - Renders one row per medication with name + dose.
 *   - Tap → optimistic flip + `logIntake` mutation called with the
 *     expected args (`source: 'home-tap'`, fresh `clientRequestId`).
 *   - Already-taken row renders the "Taken at HH:MM" subtext and a
 *     disabled tap target (no double-log).
 *   - Mutation error rolls back the optimistic flag.
 *   - Section heading is "Today's doses".
 *
 * The `convex/react` global mock from `tests/setup.ts` is replaced with a
 * locally-controlled fake so we can drive `useQuery` results + capture
 * `useMutation` calls without standing up a ConvexProvider.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

interface AdherenceRow {
  medication: { _id: string; name: string; dose: string }
  takenToday: boolean
  lastTakenAt?: number
}

let queryResult: AdherenceRow[] | undefined = undefined
const mutationSpy = vi.fn<(args: unknown) => void>()
let mutationImpl: (args: unknown) => Promise<unknown> = async () => undefined

vi.mock('convex/react', () => ({
  useQuery: () => queryResult,
  useMutation: () => (args: unknown) => {
    mutationSpy(args)
    return mutationImpl(args)
  },
  ConvexProvider: ({ children }: { children: unknown }) => children,
  ConvexReactClient: class {},
}))

vi.mock('@/convex/_generated/api', () => ({
  api: {
    medications: {
      getTodayAdherence: '__getTodayAdherence',
    },
    intakeEvents: {
      logIntake: '__logIntake',
    },
  },
}))

import { IntakeTapList } from '@/components/home/IntakeTapList'

beforeEach(() => {
  queryResult = undefined
  mutationSpy.mockReset()
  mutationSpy.mockImplementation(async () => undefined)
  mutationImpl = async () => undefined
})

describe('<IntakeTapList />', () => {
  it('renders nothing while the subscription is still resolving', () => {
    queryResult = undefined
    const { container } = render(<IntakeTapList userIdOverride="u-1" />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when the regimen is empty', () => {
    queryResult = []
    const { container } = render(<IntakeTapList userIdOverride="u-1" />)
    expect(container.firstChild).toBeNull()
  })

  it('renders one row per medication with name + dose', () => {
    queryResult = [
      {
        medication: { _id: 'med_1', name: 'Methotrexate', dose: '15mg' },
        takenToday: false,
      },
      {
        medication: { _id: 'med_2', name: 'Prednisone', dose: '10mg' },
        takenToday: false,
      },
    ]
    render(<IntakeTapList userIdOverride="u-1" dateOverride="2026-04-30" />)
    expect(screen.getByTestId('intake-tap-list')).toBeInTheDocument()
    expect(screen.getByText("Today\u2019s doses")).toBeInTheDocument()
    expect(screen.getByText('Methotrexate')).toBeInTheDocument()
    expect(screen.getByText('Prednisone')).toBeInTheDocument()
    expect(screen.getByTestId('intake-row-med_1').getAttribute('data-taken'))
      .toBe('false')
    expect(screen.getByTestId('intake-row-med_2').getAttribute('data-taken'))
      .toBe('false')
  })

  it('renders a taken row with "Taken at HH:MM" subtext and a disabled button', () => {
    // Device-local time formatter (per F04 fix-pass — IST hardcoding
    // dropped). Compute the expected wall-clock label from the same
    // formatter the component uses so the assertion is timezone-stable
    // across CI shells regardless of TZ.
    const takenAtMs = Date.parse('2026-04-30T03:44:00Z')
    const expectedWallClock = new Date(takenAtMs).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    queryResult = [
      {
        medication: { _id: 'med_1', name: 'Methotrexate', dose: '15mg' },
        takenToday: true,
        lastTakenAt: takenAtMs,
      },
    ]
    render(<IntakeTapList userIdOverride="u-1" dateOverride="2026-04-30" />)
    const row = screen.getByTestId('intake-row-med_1')
    expect(row.getAttribute('data-taken')).toBe('true')
    expect(row.textContent).toContain(`Taken at ${expectedWallClock}`)
    const btn = screen.getByTestId('intake-tap-med_1') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    expect(btn.getAttribute('aria-pressed')).toBe('true')
  })

  it('tap optimistically flips the row and calls logIntake with source=home-tap', async () => {
    queryResult = [
      {
        medication: { _id: 'med_1', name: 'Methotrexate', dose: '15mg' },
        takenToday: false,
      },
    ]
    render(<IntakeTapList userIdOverride="u-1" dateOverride="2026-04-30" />)
    const btn = screen.getByTestId('intake-tap-med_1')
    fireEvent.click(btn)
    // Optimistic flip should land synchronously after the click handler.
    await waitFor(() =>
      expect(
        screen.getByTestId('intake-row-med_1').getAttribute('data-taken'),
      ).toBe('true'),
    )
    expect(mutationSpy).toHaveBeenCalledTimes(1)
    const callArgs = mutationSpy.mock.calls[0] as unknown as unknown[]
    const args = callArgs[0] as Record<string, unknown>
    expect(args.userId).toBe('u-1')
    expect(args.medicationId).toBe('med_1')
    expect(args.date).toBe('2026-04-30')
    expect(args.source).toBe('home-tap')
    expect(typeof args.takenAt).toBe('number')
    expect(typeof args.clientRequestId).toBe('string')
    expect((args.clientRequestId as string).length).toBeGreaterThan(0)
  })

  it('rolls back the optimistic flip when the mutation rejects', async () => {
    queryResult = [
      {
        medication: { _id: 'med_1', name: 'Methotrexate', dose: '15mg' },
        takenToday: false,
      },
    ]
    mutationImpl = async () => {
      throw new Error('boom')
    }
    render(<IntakeTapList userIdOverride="u-1" dateOverride="2026-04-30" />)
    fireEvent.click(screen.getByTestId('intake-tap-med_1'))
    // Wait for the mutation rejection to settle and the rollback to land.
    await waitFor(() =>
      expect(
        screen.getByTestId('intake-row-med_1').getAttribute('data-taken'),
      ).toBe('false'),
    )
  })

  it('subsequent taps on a pending row are ignored (no second mutation)', async () => {
    queryResult = [
      {
        medication: { _id: 'med_1', name: 'Methotrexate', dose: '15mg' },
        takenToday: false,
      },
    ]
    const resolverBox: { fn: (() => void) | null } = { fn: null }
    mutationImpl = () =>
      new Promise<undefined>((resolve) => {
        resolverBox.fn = () => resolve(undefined)
      })
    render(<IntakeTapList userIdOverride="u-1" dateOverride="2026-04-30" />)
    fireEvent.click(screen.getByTestId('intake-tap-med_1'))
    fireEvent.click(screen.getByTestId('intake-tap-med_1'))
    fireEvent.click(screen.getByTestId('intake-tap-med_1'))
    expect(mutationSpy).toHaveBeenCalledTimes(1)
    resolverBox.fn?.()
  })
})
