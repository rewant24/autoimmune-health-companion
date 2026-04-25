'use client'

/**
 * MetricVizPlaceholder — placeholder card per Q4.
 *
 * Onboarding Shell cycle, Chunk C, Home.US-1.
 *
 * Real metric viz is F03 Patterns deliverable — do not start it here.
 * Copy is locked in Q4: "Your patterns will appear here once you've been
 * checking in."
 */

export function MetricVizPlaceholder(): React.JSX.Element {
  return (
    <section
      data-testid="metric-viz-placeholder"
      aria-label="Patterns placeholder"
      className="mx-6 mt-4 mb-8 rounded-2xl border p-6"
      style={{
        borderColor: 'var(--rule)',
        background: 'var(--bg-card)',
      }}
    >
      <p className="type-label">Patterns</p>
      <p
        className="type-body mt-4"
        style={{ color: 'var(--ink-muted)' }}
      >
        Your patterns will appear here once you&apos;ve been checking in.
      </p>
    </section>
  )
}
