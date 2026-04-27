/**
 * Tests for the `/onboarding/[step]` dynamic-segment route.
 *
 * Story: Onboarding.US-1 — invalid steps redirect to /onboarding/1; valid
 * steps 1–5 render the matching screen component.
 *
 * The page component is `async` (Next 16 — dynamic params are a Promise).
 * `redirect()` from `next/navigation` throws internally; we mock it to
 * throw a tagged error and assert the throw + URL.
 *
 * Owned by Build-A.
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// Stabilize the mocked router across renders so a fresh object on every call
// doesn't invalidate `useEffect` deps and trigger render loops.
const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
}
vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/onboarding/1',
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn((url: string) => {
    // Mimic Next's behaviour: redirect() never returns — throws internally.
    throw new Error(`__REDIRECT__:${url}`)
  }),
}))

import OnboardingStepPage from '@/app/onboarding/[step]/page'

async function renderStep(step: string): Promise<React.JSX.Element> {
  // The page is an async server component — await it to get the rendered tree.
  return await OnboardingStepPage({
    params: Promise.resolve({ step }),
  })
}

describe('/onboarding/[step] — valid steps 1–5', () => {
  it('renders Screen 1 when step=1', async () => {
    const tree = await renderStep('1')
    render(tree)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Saha')
  })

  it('renders Screen 2 when step=2', async () => {
    const tree = await renderStep('2')
    render(tree)
    const heading = screen.getByRole('heading', { level: 1 }).textContent ?? ''
    expect(heading).toMatch(/Living with autoimmune asks a lot of memory/)
  })

  it('renders Screen 3 when step=3', async () => {
    const tree = await renderStep('3')
    render(tree)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'You take command of your own life.',
    )
  })

  it('renders Screen 4 when step=4', async () => {
    const tree = await renderStep('4')
    render(tree)
    const heading = screen.getByRole('heading', { level: 1 }).textContent ?? ''
    expect(heading).toMatch(/Talk to me\. I\u2019ll remember\./)
  })

  it('renders Screen 5 when step=5 (CTA = "Start my first check-in")', async () => {
    const tree = await renderStep('5')
    render(tree)
    expect(screen.getByTestId('onboarding-cta')).toHaveTextContent(
      'Start my first check-in',
    )
  })
})

describe('/onboarding/[step] — invalid steps redirect to /onboarding/1', () => {
  it('redirects on step="0"', async () => {
    await expect(renderStep('0')).rejects.toThrow('__REDIRECT__:/onboarding/1')
  })

  it('redirects on step="6"', async () => {
    await expect(renderStep('6')).rejects.toThrow('__REDIRECT__:/onboarding/1')
  })

  it('redirects on step="abc" (non-numeric)', async () => {
    await expect(renderStep('abc')).rejects.toThrow(
      '__REDIRECT__:/onboarding/1',
    )
  })

  it('redirects on empty step', async () => {
    await expect(renderStep('')).rejects.toThrow('__REDIRECT__:/onboarding/1')
  })
})
