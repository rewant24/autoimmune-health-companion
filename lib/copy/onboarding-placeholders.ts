/**
 * Onboarding Shell — copy module.
 *
 * Centralizes every onboarding string. All copy below is the final,
 * ship-ready set: R1 drafts approved by Rewant during the Onboarding
 * Shell cycle fix-pass. The constant names retain the `_PLACEHOLDER`
 * suffix only for backwards-compat with callers — no copy is pending.
 *
 * Plan reference:
 *   docs/features/00-onboarding-shell-cycle-plan.md
 *
 * Brand voice (locked via ADR-025): "endurance + together" — सह — Sanskrit
 * for *to endure* + *with*. NOT "gentle / soft / calm / kind."
 *
 * Voice anchor for each line:
 *   - Screen 1 tagline — names the condition + the company-in-it.
 *   - Screen 2 body — the doctor-visit moment as memory burden.
 *   - Screen 3 body — agency + lived expertise of the patient.
 */

// Onboarding Screen 1 tagline. R1 draft, approved by Rewant.
export const SCREEN_1_TAGLINE_PLACEHOLDER =
  "A companion for living with autoimmune. You endure — and you don't endure alone."

// Onboarding Screen 2 body copy. R1 draft, approved by Rewant.
// (Pairs with R1's Saha-voice rewrite of the Screen 2 headline.)
export const SCREEN_2_BODY_PLACEHOLDER =
  'What hurt, when, how often — autoimmune asks a lot of memory. Saha holds it for you.'

// Onboarding Screen 3 body copy. R1 draft, approved by Rewant.
// (Pairs with the locked Screen 3 headline "You take command of your own life.")
export const SCREEN_3_BODY_PLACEHOLDER =
  'You know your body better than any chart. Saha just helps you carry the record so you can act on it.'
