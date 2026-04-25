/**
 * Tests for `<OnboardingShell>` and the five screen components.
 *
 * Stories covered:
 *   - Onboarding.US-1 — Screen 1 renders title + tagline; Next routes to /onboarding/2.
 *   - Onboarding.US-2 — Screen 2 renders locked headline; Next routes to /onboarding/3.
 *   - Onboarding.US-3 — Screen 3 renders locked headline + body placeholder; Next routes to /onboarding/4.
 *   - Onboarding.US-4 — Screen 4 renders locked Voice copy verbatim; Next routes to /onboarding/5.
 *   - Onboarding.US-5 — Screen 5 renders locked Memory copy verbatim; CTA "Start my first check-in" routes to /setup/name.
 *   - Onboarding.US-6 — Shell renders progress dots, illustration slot, sticky CTA, design tokens.
 *
 * Owned by Build-A.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const pushSpy = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushSpy,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/onboarding/1',
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn((url: string) => {
    throw new Error(`__REDIRECT__:${url}`)
  }),
}))

import { OnboardingShell } from '@/components/onboarding/OnboardingShell'
import { OnboardingScreen1 } from '@/components/onboarding/OnboardingScreen1'
import { OnboardingScreen2 } from '@/components/onboarding/OnboardingScreen2'
import { OnboardingScreen3 } from '@/components/onboarding/OnboardingScreen3'
import { OnboardingScreen4 } from '@/components/onboarding/OnboardingScreen4'
import { OnboardingScreen5 } from '@/components/onboarding/OnboardingScreen5'
import {
  SCREEN_1_TAGLINE_PLACEHOLDER,
  SCREEN_2_BODY_PLACEHOLDER,
  SCREEN_3_BODY_PLACEHOLDER,
} from '@/lib/copy/onboarding-placeholders'

describe('<OnboardingShell />', () => {
  beforeEach(() => {
    pushSpy.mockReset()
  })

  it('renders progress dots labelled "Step N of total"', () => {
    render(
      <OnboardingShell
        step={3}
        total={5}
        illustration={<span>art</span>}
        title={<>Title</>}
        body={<p>Body</p>}
        ctaLabel="Next"
        onCta={() => {}}
      />,
    )
    const group = screen.getByRole('group', { name: /step 3 of 5/i })
    expect(group).toBeInTheDocument()
    // Five dots, third active.
    const dots = group.querySelectorAll('span[data-active]')
    expect(dots).toHaveLength(5)
    expect(dots[2]?.getAttribute('data-active')).toBe('true')
  })

  it('renders illustration slot, title, body, and sticky CTA with provided label', async () => {
    const onCta = vi.fn()
    render(
      <OnboardingShell
        step={1}
        total={5}
        illustration={<span data-testid="my-illustration">art</span>}
        title={<>Hello</>}
        body={<p>World</p>}
        ctaLabel="Get going"
        onCta={onCta}
      />,
    )
    expect(screen.getByTestId('my-illustration')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Hello')
    expect(screen.getByText('World')).toBeInTheDocument()
    const cta = screen.getByTestId('onboarding-cta')
    expect(cta).toHaveTextContent('Get going')
    await userEvent.click(cta)
    expect(onCta).toHaveBeenCalledTimes(1)
  })
})

describe('<OnboardingScreen1 /> — Onboarding.US-1', () => {
  beforeEach(() => pushSpy.mockReset())

  it('renders the app name "Saha" as the title', () => {
    render(<OnboardingScreen1 />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Saha')
  })

  it('renders the placeholder tagline from the copy module', () => {
    render(<OnboardingScreen1 />)
    expect(screen.getByTestId('screen-1-tagline')).toHaveTextContent(
      SCREEN_1_TAGLINE_PLACEHOLDER,
    )
  })

  it('Next CTA routes to /onboarding/2', async () => {
    render(<OnboardingScreen1 />)
    await userEvent.click(screen.getByTestId('onboarding-cta'))
    expect(pushSpy).toHaveBeenCalledWith('/onboarding/2')
  })

  it('renders progress dots showing step 1 of 5', () => {
    render(<OnboardingScreen1 />)
    expect(
      screen.getByRole('group', { name: /step 1 of 5/i }),
    ).toBeInTheDocument()
  })
})

describe('<OnboardingScreen2 /> — Onboarding.US-2', () => {
  beforeEach(() => pushSpy.mockReset())

  it('renders the locked headline from scoping § Onboarding Screen 2', () => {
    render(<OnboardingScreen2 />)
    // Use a substring + flexible matcher to avoid em-dash brittleness.
    expect(
      screen.getByRole('heading', { level: 1 }).textContent ?? '',
    ).toMatch(/A digital friend for the day-to-day/i)
  })

  it('renders the placeholder body copy', () => {
    render(<OnboardingScreen2 />)
    expect(screen.getByTestId('screen-2-body')).toHaveTextContent(
      SCREEN_2_BODY_PLACEHOLDER,
    )
  })

  it('Next CTA routes to /onboarding/3', async () => {
    render(<OnboardingScreen2 />)
    await userEvent.click(screen.getByTestId('onboarding-cta'))
    expect(pushSpy).toHaveBeenCalledWith('/onboarding/3')
  })
})

describe('<OnboardingScreen3 /> — Onboarding.US-3', () => {
  beforeEach(() => pushSpy.mockReset())

  it('renders the locked headline "You take command of your own life."', () => {
    render(<OnboardingScreen3 />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'You take command of your own life.',
    )
  })

  it('renders the placeholder body copy', () => {
    render(<OnboardingScreen3 />)
    expect(screen.getByTestId('screen-3-body')).toHaveTextContent(
      SCREEN_3_BODY_PLACEHOLDER,
    )
  })

  it('Next CTA routes to /onboarding/4', async () => {
    render(<OnboardingScreen3 />)
    await userEvent.click(screen.getByTestId('onboarding-cta'))
    expect(pushSpy).toHaveBeenCalledWith('/onboarding/4')
  })
})

describe('<OnboardingScreen4 /> — Onboarding.US-4', () => {
  beforeEach(() => pushSpy.mockReset())

  it('renders the locked title verbatim — "Talk to me. I\u2019ll remember."', () => {
    render(<OnboardingScreen4 />)
    const title = screen.getByRole('heading', { level: 1 }).textContent ?? ''
    expect(title).toMatch(/Talk to me\. I\u2019ll remember\./)
  })

  it('renders the locked body copy verbatim', () => {
    render(<OnboardingScreen4 />)
    const body = screen.getByTestId('screen-4-body').textContent ?? ''
    expect(body).toMatch(/One minute a day\./)
    expect(body).toMatch(/I listen, I keep the record/)
    expect(body).toMatch(/never have to be your own logbook again/)
  })

  it('Next CTA routes to /onboarding/5', async () => {
    render(<OnboardingScreen4 />)
    await userEvent.click(screen.getByTestId('onboarding-cta'))
    expect(pushSpy).toHaveBeenCalledWith('/onboarding/5')
  })
})

describe('<OnboardingScreen5 /> — Onboarding.US-5', () => {
  beforeEach(() => pushSpy.mockReset())

  it('renders the locked title verbatim — "Look back. See what\u2019s changed."', () => {
    render(<OnboardingScreen5 />)
    const title = screen.getByRole('heading', { level: 1 }).textContent ?? ''
    expect(title).toMatch(/Look back\. See what\u2019s changed\./)
  })

  it('renders the locked body copy verbatim', () => {
    render(<OnboardingScreen5 />)
    const body = screen.getByTestId('screen-5-body').textContent ?? ''
    expect(body).toMatch(/Week to week, the bad days blur/)
    expect(body).toMatch(/I hold the record/)
  })

  it('CTA reads "Start my first check-in" (not "Next")', () => {
    render(<OnboardingScreen5 />)
    expect(screen.getByTestId('onboarding-cta')).toHaveTextContent(
      'Start my first check-in',
    )
  })

  it('CTA routes to /setup/name (Q1: Setup A skipped — NOT /setup/mobile)', async () => {
    render(<OnboardingScreen5 />)
    await userEvent.click(screen.getByTestId('onboarding-cta'))
    expect(pushSpy).toHaveBeenCalledWith('/setup/name')
    expect(pushSpy).not.toHaveBeenCalledWith('/setup/mobile')
  })
})
