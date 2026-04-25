'use client'

/**
 * BottomNav — 5-pillar persistent bottom navigation.
 *
 * Onboarding Shell cycle, Chunk C, Nav.US-1.
 *
 * Locked decisions:
 *   - 5 pillars left-to-right: Home / Medications / Journey / Community / Settings.
 *   - Home + Journey are real <Link>s (Q-locked: Journey routes to /journey/memory
 *     because it has a working sub-route already).
 *   - Medications, Community, Settings are visually present but `aria-disabled="true"`,
 *     no href, no onClick (Q6: un-built feature CTAs are non-interactive).
 *   - Active item highlighted by current pathname (`usePathname`).
 *   - Mobile-first: full-width, fixed-bottom, with `safe-area-inset-bottom` padding.
 *   - This cycle renders BottomNav on `/home` only (Q5). Retrofit to /check-in
 *     and /journey/memory is a separate follow-up.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItem {
  key: 'home' | 'medications' | 'journey' | 'community' | 'settings'
  label: string
  href: string | null
  /** Pathnames that should mark this item active. */
  match: (pathname: string | null | undefined) => boolean
}

const NAV_ITEMS: ReadonlyArray<NavItem> = [
  {
    key: 'home',
    label: 'Home',
    href: '/home',
    match: (p) => p === '/home',
  },
  {
    key: 'medications',
    label: 'Medications',
    href: null,
    match: () => false, // disabled — never active
  },
  {
    key: 'journey',
    label: 'Journey',
    href: '/journey/memory',
    match: (p) => Boolean(p?.startsWith('/journey')),
  },
  {
    key: 'community',
    label: 'Community',
    href: null,
    match: () => false,
  },
  {
    key: 'settings',
    label: 'Settings',
    href: null,
    match: () => false,
  },
]

export function BottomNav(): React.JSX.Element {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Primary"
      data-testid="bottom-nav"
      className="fixed inset-x-0 bottom-0 z-40 border-t"
      // Use a raw style string so jsdom preserves the env() expression for
      // tests; React's style object drops values jsdom can't parse.
      style={{
        borderColor: 'var(--rule)',
        background: 'var(--bg-elevated)',
        // safe-area-inset-bottom for iOS notched devices.
        ['--safe' as string]: 'env(safe-area-inset-bottom)',
        paddingBottom: 'var(--safe)',
      }}
    >
      <ul className="mx-auto flex w-full max-w-2xl items-stretch justify-between">
        {NAV_ITEMS.map((item) => {
          const active = item.match(pathname)
          const disabled = item.href === null
          const baseClasses =
            'flex flex-1 flex-col items-center justify-center gap-1 ' +
            'px-2 py-3 text-[12px] min-h-12 ' +
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1'

          if (disabled) {
            return (
              <li key={item.key} className="flex flex-1">
                <button
                  type="button"
                  aria-disabled="true"
                  data-nav-key={item.key}
                  data-disabled="true"
                  className={baseClasses + ' cursor-not-allowed'}
                  style={{ color: 'var(--ink-subtle)', opacity: 0.6 }}
                  // Intentionally no onClick — Q6 says no handler at all.
                  tabIndex={0}
                >
                  <NavDot active={false} />
                  <span>{item.label}</span>
                </button>
              </li>
            )
          }

          return (
            <li key={item.key} className="flex flex-1">
              <Link
                href={item.href as string}
                data-nav-key={item.key}
                data-active={active ? 'true' : 'false'}
                aria-current={active ? 'page' : undefined}
                className={baseClasses}
                style={{
                  color: active ? 'var(--sage-deep)' : 'var(--ink-muted)',
                  fontWeight: active ? 600 : 400,
                }}
              >
                <NavDot active={active} />
                <span>{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

function NavDot({ active }: { active: boolean }): React.JSX.Element {
  return (
    <span
      aria-hidden
      className="inline-block h-1.5 w-1.5 rounded-full"
      style={{
        background: active ? 'var(--sage-deep)' : 'var(--ink-subtle)',
        opacity: active ? 1 : 0.5,
      }}
    />
  )
}
