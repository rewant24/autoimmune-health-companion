/**
 * Onboarding Shell — placeholder copy.
 *
 * Centralizes every onboarding string that is awaiting a Rewant-supplied
 * final draft. Each placeholder is tagged with `TODO(rewant-copy)` so the
 * second-pass reviewer can grep for them and confirm — none ship without
 * an explicit replacement.
 *
 * Plan reference:
 *   docs/features/00-onboarding-shell-cycle-plan.md
 *     §"Build-A prompt" → Copy strategy
 *
 * Brand voice (locked via ADR-025): "endurance + together" — सह — Sanskrit
 * for *to endure* + *with*. NOT "gentle / soft / calm / kind." Any
 * Rewant-supplied replacement must read in that voice.
 *
 * Scope of placeholders (open at time of writing):
 *   - Screen 1 — app name is locked ("Saha"); the tagline is open.
 *   - Screen 2 — body copy is open. The headline (*"A digital friend for
 *     the day-to-day…"*) is locked from scoping but flagged for brand-voice
 *     re-validation by Reviewer-1.
 *   - Screen 3 — body copy is open. Headline (*"You take command of your
 *     own life."*) is locked and already fits the new voice.
 *   - Screens 4 + 5 — copy is fully locked verbatim from scoping (also
 *     flagged for brand-voice re-validation by Reviewer-1).
 */

// TODO(rewant-copy): final tagline for Onboarding Screen 1.
export const SCREEN_1_TAGLINE_PLACEHOLDER =
  'A health companion you walk this with — endurance, together.'

// TODO(rewant-copy): final body copy for Onboarding Screen 2.
// (Headline *"A digital friend for the day-to-day…"* is locked from scoping
// but flagged for Reviewer-1 brand-voice re-validation.)
export const SCREEN_2_BODY_PLACEHOLDER =
  'Doctor visits ask a lot of memory — what hurt, when, how often. Saha holds the record so you walk in with data, not guesses.'

// TODO(rewant-copy): final body copy for Onboarding Screen 3.
// (Headline *"You take command of your own life."* is locked and already
// fits the "endurance + together" voice.)
export const SCREEN_3_BODY_PLACEHOLDER =
  'Autoimmune is yours to live with — and you do not live with it alone. Saha is the companion that helps you steer.'
