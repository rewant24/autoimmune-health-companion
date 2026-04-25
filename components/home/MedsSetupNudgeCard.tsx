'use client'

/**
 * MedsSetupNudgeCard — disabled card per Q6.
 *
 * Onboarding Shell cycle, Chunk C, Home.US-1.
 *
 *   - Visible but faded.
 *   - aria-disabled="true".
 *   - No onClick, no Link, no href.
 *   - Real Medications setup lands in a later cycle.
 */

export function MedsSetupNudgeCard(): React.JSX.Element {
  return (
    <section
      data-testid="meds-setup-nudge"
      aria-disabled="true"
      className="mx-6 mt-4 rounded-2xl border p-6"
      style={{
        borderColor: 'var(--rule)',
        background: 'var(--bg-card)',
        opacity: 0.55,
      }}
    >
      <p className="type-label">Medications</p>
      {/* TODO(rewant-copy): meds nudge phrasing pending Rewant. */}
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
        Coming soon — track every dose change alongside your check-ins.
      </p>
    </section>
  )
}
