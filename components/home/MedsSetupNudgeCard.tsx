'use client'

/**
 * MedsSetupNudgeCard — non-interactive nudge per Q6.
 *
 * Onboarding Shell cycle, Chunk C, Home.US-1.
 *
 *   - Visible but faded.
 *   - No onClick, no Link, no href — real Medications setup lands later.
 *
 * R3 review #10: `aria-disabled` is meaningful only on interactive widgets
 * (button, link, input). Applying it to a non-interactive landmark is a
 * misuse some assistive tech announces as "dimmed" without an actionable
 * target. Visual fade + zero focusable children communicates the inactive
 * state correctly.
 */

export function MedsSetupNudgeCard(): React.JSX.Element {
  return (
    <section
      data-testid="meds-setup-nudge"
      className="mx-6 mt-4 rounded-2xl border p-6"
      style={{
        borderColor: 'var(--rule)',
        background: 'var(--bg-card)',
        opacity: 0.55,
      }}
    >
      <p className="type-label">Medications</p>
      <h2
        className="mt-3"
        style={{
          fontFamily: 'var(--font-fraunces)',
          fontSize: '1.25rem',
          lineHeight: 1.2,
          fontVariationSettings: "'SOFT' 100, 'opsz' 24, 'wght' 420",
          color: 'var(--ink)',
        }}
      >
        Add your medications
      </h2>
      <p
        className="type-body mt-3"
        style={{ color: 'var(--ink-muted)' }}
      >
        Add your meds when you&apos;re ready. Saha will start tracking dose
        changes alongside your check-ins.
      </p>
    </section>
  )
}
