/**
 * F04 Medications — Layer 4 (browser E2E) of the QA pass.
 *
 * Covers the user-visible flow end-to-end against `localhost:3000` backed
 * by the dev Convex deployment (`hardy-hamster-888`). One spec, five
 * sequential steps inside a single `test()` so cross-step state (the
 * Convex subscription, optimistic UI flip, regimen visibility) is
 * actually exercised across navigations.
 *
 * What is NOT covered here:
 *   - Voice flow (regimen-by-voice / dose-change-by-voice). Audio
 *     simulation in Playwright is fragile (synthetic getUserMedia,
 *     fake-audio devices, etc.) and adds little incremental coverage
 *     over the contract-level tests in Layer 2 — those exercise the
 *     STT→LLM→TTS adapter wiring directly. Voice is also a Cycle-2
 *     deliverable per ADR-030; F04 C1 ships structured-form only.
 *
 * Test-user residue: each run mints a fresh `qa_e2e_<uuid>` userId in
 * localStorage, so rows from prior runs don't leak into the current
 * run's assertions. We do NOT actively wipe via a Convex mutation —
 * residue is acceptable on dev (synthetic users, one row each), and a
 * `wipeUser` mutation is not part of F04's surface.
 */

import { randomUUID } from 'node:crypto'
import { test, expect } from '@playwright/test'

const PROFILE_KEY = 'saha.profile.v1'
const TEST_USER_KEY = 'saha.testUser.v1'

test('full F04 flow: empty home → setup → intake list → tap → cross-route', async ({
  page,
}) => {
  // Capture browser console + uncaught errors so a runtime exception in
  // handleTap (or any other surface) surfaces in the Playwright output
  // instead of being silently swallowed by the catch block.
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      // eslint-disable-next-line no-console
      console.log(`[browser:${msg.type()}] ${msg.text()}`)
    }
  })
  page.on('pageerror', (err) => {
    // eslint-disable-next-line no-console
    console.log(`[browser:pageerror] ${err.message}`)
  })

  // Mint a unique userId per run so residue from prior runs is irrelevant.
  const testUserId = `qa_e2e_${randomUUID()}`

  // Seed BOTH localStorage keys before any /home navigation:
  //   - saha.testUser.v1 → keys all Convex queries to this synthetic user
  //   - saha.profile.v1  → satisfies the onboarded-guard on /home and
  //     /medications, otherwise the page redirects to /onboarding/1
  await page.addInitScript(
    ({ userId, profileKey, userKey }) => {
      const now = Date.now()
      window.localStorage.setItem(userKey, userId)
      window.localStorage.setItem(
        profileKey,
        JSON.stringify({
          v: 2,
          name: 'QA',
          dobMonth: null,
          dobYear: null,
          email: 'qa@example.com',
          condition: 'rheumatoid-arthritis',
          conditionOther: null,
          onboarded: true,
          createdAtMs: now,
          updatedAtMs: now,
        }),
      )
    },
    { userId: testUserId, profileKey: PROFILE_KEY, userKey: TEST_USER_KEY },
  )

  // ------------------------------------------------------------------
  // Step 1 — Empty /home shows the setup nudge; intake-tap-list absent.
  // ------------------------------------------------------------------
  await page.goto('/home')

  // Wait for the Convex subscription to settle (page leaves the pending
  // shell when the profile guard resolves; nudge appears once the empty
  // `listActiveMedications` query returns).
  await expect(page.getByTestId('home-page')).toBeVisible()
  await expect(page.getByTestId('meds-setup-nudge')).toBeVisible()
  await expect(page.getByTestId('meds-setup-nudge-cta')).toBeVisible()

  // IntakeTapList renders nothing for empty regimens — assert absence.
  await expect(page.getByTestId('intake-tap-list')).toHaveCount(0)

  // ------------------------------------------------------------------
  // Step 2 — Setup wizard → save first medication, land on /medications.
  // ------------------------------------------------------------------
  await page.getByTestId('meds-setup-nudge-cta').click()
  await expect(page).toHaveURL(/\/medications\/setup$/)
  await expect(page.getByTestId('medications-setup-page')).toBeVisible()

  // Fields are <label htmlFor>-bound text inputs / selects — use role+name.
  await page.getByLabel('Name').fill('Methotrexate')
  await page.getByLabel('Dose').fill('5mg')
  await page.getByLabel('Frequency').fill('Once daily')
  // Category + delivery are <select>s; defaults are 'other' + 'oral'. We
  // leave them at their defaults — the form requires only name/dose/freq
  // to enable submit.

  await page.getByTestId('medications-setup-submit').click()

  // After save, the form resets but stays on /setup; saved medication is
  // visible in the saved-list section. Tap "I'm done for now" to land on
  // /medications proper.
  await expect(page.getByTestId('medications-setup-saved')).toContainText(
    'Methotrexate',
  )
  await page.getByTestId('medications-setup-done').click()
  await expect(page).toHaveURL(/\/medications$/)
  await expect(page.getByTestId('medications-page')).toBeVisible()
  await expect(page.getByTestId('regimen-list')).toContainText('Methotrexate')
  await expect(page.getByTestId('regimen-list')).toContainText('5mg')

  // ------------------------------------------------------------------
  // Step 3 — /home now hides the nudge and renders the intake-tap row.
  // ------------------------------------------------------------------
  await page.goto('/home')
  await expect(page.getByTestId('home-page')).toBeVisible()

  // Once listActiveMedications returns ≥1, MedsSetupNudgeCard returns
  // null and IntakeTapList mounts. Give the Convex subscription a few
  // extra seconds — first /home render after create fires two queries
  // (`listActiveMedications` for nudge, `getTodayAdherence` for list),
  // both round-tripping to the dev deployment.
  await expect(page.getByTestId('intake-tap-list')).toBeVisible({
    timeout: 10_000,
  })
  await expect(page.getByTestId('meds-setup-nudge')).toHaveCount(0)

  const intakeRow = page.locator('[data-testid^="intake-row-"]').first()
  await expect(intakeRow).toBeVisible()
  await expect(intakeRow).toHaveAttribute('data-taken', 'false')
  await expect(intakeRow).toContainText('Methotrexate')

  // ------------------------------------------------------------------
  // Step 4 — Tap → optimistic flip within 500ms; "Taken at HH:MM" subtext.
  // ------------------------------------------------------------------
  // IMPORTANT: scope to the <button> tag — the wrapping section also has
  // a data-testid that starts with "intake-tap-" ("intake-tap-list"), and
  // a bare prefix selector resolves to the section first in DOM order.
  // Clicking the section is a no-op and the optimistic flip never fires.
  const tapButton = page.locator('button[data-testid^="intake-tap-"]').first()
  await tapButton.click()

  // Optimistic flip is synchronous (setState in the click handler) — the
  // 1500ms budget allows for first-render hydration on the slow Docker
  // dev volume. After Convex acks the mutation the row remains taken;
  // if the mutation rejects, the optimistic flag rolls back.
  await expect(intakeRow).toHaveAttribute('data-taken', 'true', {
    timeout: 1500,
  })

  // Subtext format: "<dose> · Taken at HH:MM" — assert the literal string
  // plus a 5-char HH:MM tail (regex catches any 24-hour clock).
  await expect(intakeRow).toContainText(/Taken at \d{2}:\d{2}/)

  // ------------------------------------------------------------------
  // Step 5 — BottomNav cross-route: Journey → Medications → Home active.
  // ------------------------------------------------------------------
  // Journey pillar routes to /journey/memory (BottomNav locked decision).
  await page.locator('[data-nav-key="journey"]').click()
  await expect(page).toHaveURL(/\/journey\/memory/)
  await expect(page.getByTestId('memory-tab')).toBeVisible()

  // Today's intake event should appear under the day's "Completed" group
  // (intake events have taskState="done" → DayView routes them to the
  // Completed section). Default flipped 2026-05-09: the Completed group
  // starts EXPANDED, so the intake row is in the DOM without any tap.
  //
  // Timezone caveat: WeekScrubber defaults to `todayIST()`. The intake's
  // `date` is the device-local YYYY-MM-DD (IntakeTapList line 49–55).
  // On a Mac in IST those agree; on a non-IST runner they can differ
  // by a day and the row would be filtered out of the selected day. If
  // this assertion flakes outside IST, the spec needs to either seed
  // the scrubber to the local-today or override the device timezone.
  const completedGroup = page.locator('[data-event-group="Completed"]')
  await expect(completedGroup).toBeVisible({ timeout: 5_000 })
  // Header is the bare label when expanded; toggle starts aria-expanded=true.
  const completedToggle = completedGroup.getByRole('button', { name: /Completed/ })
  await expect(completedToggle).toHaveAttribute('aria-expanded', 'true')
  // Intake row is visible directly — no tap needed.
  await expect(
    completedGroup.locator('[data-event-type="intake"]').first(),
  ).toBeVisible()

  // Medications pillar.
  await page.locator('[data-nav-key="medications"]').click()
  await expect(page).toHaveURL(/\/medications$/)
  await expect(page.getByTestId('regimen-list')).toContainText('Methotrexate')

  // Home pillar — assert active-state attribute.
  await page.locator('[data-nav-key="home"]').click()
  await expect(page).toHaveURL(/\/home$/)
  const homePill = page.locator('[data-nav-key="home"]')
  await expect(homePill).toHaveAttribute('aria-current', 'page')
  await expect(homePill).toHaveAttribute('data-active', 'true')
})
