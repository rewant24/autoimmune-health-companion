/**
 * F05 Cycle 1 — Layer 4 (browser E2E) for Doctor visits + Blood work.
 *
 * Validates the F05 smoke checklist end-to-end against `localhost:3001`
 * backed by the dev Convex deployment (`hardy-hamster-888`). Each spec
 * mints a unique `e2e_f05_<...>` userId so rows DO NOT collide with the
 * human user smoking the preview against the same dev backend.
 *
 * Headline regression: commit 3bffb96 added the missing `userId` arg on
 *   - updateVisit
 *   - softDeleteVisit
 *   - updateBloodWork
 *   - softDeleteBloodWork
 * T2/T3 and T5/T6 explicitly catch a regression on each of those four.
 */

import { randomUUID } from 'node:crypto'
import { test, expect, type Page } from '@playwright/test'

const PROFILE_KEY = 'saha.profile.v1'
const TEST_USER_KEY = 'saha.testUser.v1'

/** Today as YYYY-MM-DD in IST — must match the helper used by the app. */
function todayIST(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/** YYYY-MM-DD for `daysOffset` from IST today. */
function istDateOffset(daysOffset: number): string {
  const istToday = todayIST()
  const [y, m, d] = istToday.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + daysOffset)
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/**
 * Seed both localStorage keys before any navigation so the agent does not
 * collide with the human user. Uses a UNIQUE userId per call so back-to-back
 * specs are isolated even though they hit the same dev Convex.
 */
async function seedTestUser(page: Page): Promise<string> {
  const testUserId = `e2e_f05_${randomUUID()}`
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
  return testUserId
}

/**
 * Wire console + pageerror to the Playwright stdout so a Convex
 * ArgumentValidationError or any other runtime exception surfaces in
 * the report instead of being swallowed by the page's catch blocks.
 *
 * Captures errors into an array the test can also assert on.
 */
function attachErrorCapture(page: Page): { errors: string[] } {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text()
      console.log(`[browser:error] ${text}`)
      errors.push(text)
    } else if (msg.type() === 'warning') {
      console.log(`[browser:warning] ${msg.text()}`)
    } else if (msg.type() === 'log') {
      const text = msg.text()
      if (/qa[:|]/.test(text)) {
        console.log(`[browser:log] ${text}`)
      }
    }
  })
  page.on('pageerror', (err) => {
    console.log(`[browser:pageerror] ${err.message}`)
    errors.push(err.message)
  })
  page.on('requestfailed', (req) => {
    console.log(
      `[browser:requestfailed] ${req.method()} ${req.url()} :: ${req.failure()?.errorText}`,
    )
  })
  return { errors }
}

/**
 * Wait until the page has read the seeded userId from localStorage. This
 * matters because the create/edit pages mount userId via `useEffect`, and
 * if a click fires before the effect runs the parent's onSubmit silently
 * no-ops (it has `if (userId === null) return`).
 */
async function waitForUserIdProvisioned(page: Page): Promise<void> {
  await page.waitForFunction(
    (key) => window.localStorage.getItem(key) !== null,
    TEST_USER_KEY,
  )
  // useEffect → setUserId hasn't necessarily flushed yet by the time the
  // form is visible. 800ms covers slow-filesystem dev compiles; without
  // this the parent's onSubmit silently no-ops on `userId === null`.
  await page.waitForTimeout(800)
}

/**
 * Ensure the Completed group in DayView is expanded. Visits + blood-work
 * events are emitted with taskState='done' so they render inside Completed,
 * not in the always-open Other events group.
 *
 * Default flipped 2026-05-09: the Completed group now starts EXPANDED, so
 * this helper is usually a no-op. Kept idempotent in case a previous test
 * step collapsed it: if `aria-expanded` is already 'true', do nothing.
 */
async function expandCompleted(page: Page): Promise<void> {
  const completedGroup = page.locator('[data-event-group="Completed"]')
  await expect(completedGroup).toBeVisible({ timeout: 10_000 })
  const toggle = completedGroup.locator('button[aria-expanded]').first()
  const expanded = await toggle.getAttribute('aria-expanded')
  if (expanded !== 'true') {
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true', {
      timeout: 5_000,
    })
  }
}

test.describe('F05 C1 — visits + blood work', () => {
  test.setTimeout(180_000)
  test('full F05 flow: create → edit → delete for visits + blood work + memory chips', async ({
    page,
  }) => {
    const { errors } = attachErrorCapture(page)
    await seedTestUser(page)

    const today = todayIST()
    const yesterday = istDateOffset(-1)

    // Use a unique doctor name + marker value so list assertions can scope
    // to THIS run even if Convex returns leftover rows from prior runs.
    const doctorName = `Dr. QA ${Date.now()}`

    // ------------------------------------------------------------------
    // T1 — Manual visit create + read.
    // ------------------------------------------------------------------
    await page.goto('/visits/new')
    await expect(page.getByTestId('visit-new-page')).toBeVisible()
    await expect(page.getByTestId('visit-form')).toBeVisible()
    // The page mounts userId via useEffect; without that, the parent's
    // onSubmit silently no-ops. Give it a moment so the click below
    // reliably fires the createVisit mutation.
    await waitForUserIdProvisioned(page)

    // Date defaults to today. Doctor + type required.
    await page.getByLabel('Who did you see?').fill(doctorName)
    // Default visitType = 'consultation' — leave as-is to satisfy step 1.
    await page.getByLabel('Notes').fill('automation')
    // Watch for the Convex mutation request so we can confirm it's firing.
    const convexCallPromise = page
      .waitForRequest(
        (req) =>
          /convex\.cloud/.test(req.url()) && req.method() === 'POST',
        { timeout: 20_000 },
      )
      .catch(() => null)

    await page.getByTestId('visit-form-submit').click()
    const seenConvex = await convexCallPromise
    console.log(`[qa] convex POST observed for createVisit: ${!!seenConvex}`)

    // After create, app routes to `/visits/[id]`. Land on detail then
    // navigate to the list to assert it's visible there.
    await page.waitForURL(
      (url) =>
        /\/visits\/[^/]+$/.test(url.pathname) &&
        !url.pathname.endsWith('/visits/new'),
      { timeout: 30_000 },
    )
    const visitDetailUrl = page.url()

    await page.goto('/visits')
    await expect(page.getByTestId('visits-page')).toBeVisible()
    await expect(page.getByTestId('visits-list')).toContainText(doctorName)

    // Memory: today should have a DR VISIT pill.
    await page.goto('/journey/memory')
    await expect(page.getByTestId('memory-tab')).toBeVisible()
    await expandCompleted(page)
    const visitPill = page
      .locator('[data-event-group="Completed"] [data-event-type="visit"]')
      .first()
    await expect(visitPill).toBeVisible({ timeout: 10_000 })
    await expect(visitPill).toContainText('DR VISIT')
    await expect(visitPill).toContainText(doctorName)

    // ------------------------------------------------------------------
    // T2 — Manual visit edit (regression: userId on updateVisit).
    // ------------------------------------------------------------------
    await page.goto(visitDetailUrl)
    await expect(page.getByTestId('visit-detail-page')).toBeVisible()
    await expect(page.getByTestId('visit-detail-card')).toBeVisible({
      timeout: 10_000,
    })
    await page.getByTestId('visit-detail-edit').click()
    await expect(page.getByTestId('visit-form')).toBeVisible()

    // Change date to yesterday.
    await page.getByLabel('When?').fill(yesterday)
    await page.getByTestId('visit-form-submit').click()

    // Detail card should re-render (editing=false). No error toast.
    await expect(page.getByTestId('visit-detail-card')).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByTestId('visit-form-error')).toHaveCount(0)

    // The card formats as "Monday, 5 May 2026" style — assert the year + day
    // number from `yesterday` are present (locale-flexible).
    const [yY, yM, yD] = yesterday.split('-').map(Number)
    await expect(page.getByTestId('visit-detail-card')).toContainText(
      String(yY),
    )
    await expect(page.getByTestId('visit-detail-card')).toContainText(
      String(yD),
    )

    // No ArgumentValidationError surfaced from Convex.
    expect(
      errors.find((e) => /ArgumentValidationError/i.test(e)),
    ).toBeUndefined()

    // Memory should now show the DR VISIT pill on yesterday's row.
    await page.goto('/journey/memory')
    await expect(page.getByTestId('memory-tab')).toBeVisible()
    // Move scrubber to yesterday — WeekScrubber cells are testids
    // `week-cell-YYYY-MM-DD`.
    await page.getByTestId(`week-cell-${yesterday}`).click()
    await expandCompleted(page)
    const yesterdayVisit = page
      .locator('[data-event-group="Completed"] [data-event-type="visit"]')
      .filter({ hasText: doctorName })
      .first()
    await expect(yesterdayVisit).toBeVisible({ timeout: 10_000 })

    // ------------------------------------------------------------------
    // T3 — Manual visit soft-delete (regression: userId on softDeleteVisit).
    // ------------------------------------------------------------------
    await page.goto(visitDetailUrl)
    await expect(page.getByTestId('visit-detail-card')).toBeVisible({
      timeout: 10_000,
    })
    await page.getByTestId('visit-detail-delete').click()
    const visitConfirm = page.getByTestId('visit-delete-confirm')
    await expect(visitConfirm).toBeVisible()
    // Per-surface copy locked in commit 6033da5.
    await expect(visitConfirm).toContainText(
      "Delete this doctor visit? You can\u2019t undo this.",
    )
    await page.getByTestId('visit-delete-confirm-submit').click()

    // Redirect to /visits, gone from list, no Convex error.
    await expect(page).toHaveURL(/\/visits$/, { timeout: 10_000 })
    await expect(page.getByTestId('visits-page')).toBeVisible()
    await expect(page.locator('body')).not.toContainText(doctorName, {
      timeout: 10_000,
    })
    expect(
      errors.find((e) => /ArgumentValidationError/i.test(e)),
    ).toBeUndefined()

    // Memory should no longer show the deleted visit pill on yesterday.
    await page.goto('/journey/memory')
    await page.getByTestId(`week-cell-${yesterday}`).click()
    // Wait for memory query to resolve; either the day is empty OR the
    // Completed group exists but does not contain our doctor name.
    await page.waitForTimeout(800)
    const yesterdayDoctor = page.locator(
      `[data-event-type="visit"]:has-text("${doctorName}")`,
    )
    await expect(yesterdayDoctor).toHaveCount(0)

    // ------------------------------------------------------------------
    // T4 — Manual blood-work create + read.
    // ------------------------------------------------------------------
    const crpValue = String(20 + Math.floor(Math.random() * 9))
    await page.goto('/blood-work/new')
    await expect(page.getByTestId('blood-work-new-page')).toBeVisible()
    await expect(page.getByTestId('blood-work-form')).toBeVisible()
    await waitForUserIdProvisioned(page)

    // Default markers: CRP / ESR / WBC / Hb. Marker rows are 0-indexed.
    // CRP is row 0; fill value + unit. ESR is row 1.
    const crpRow = page.locator('[data-testid="marker-row-0"]')
    await crpRow.getByLabel('Value').fill(crpValue)
    await crpRow.getByLabel('Unit').fill('mg/L')

    const esrRow = page.locator('[data-testid="marker-row-1"]')
    await esrRow.getByLabel('Value').fill('30')
    await esrRow.getByLabel('Unit').fill('mm/hr')

    await page.getByTestId('blood-work-form-submit').click()

    // After create, app routes to `/blood-work/[id]`.
    await page.waitForURL(
      (url) =>
        /\/blood-work\/[^/]+$/.test(url.pathname) &&
        !url.pathname.endsWith('/blood-work/new'),
      { timeout: 15_000 },
    )
    const bloodWorkDetailUrl = page.url()

    await page.goto('/blood-work')
    await expect(page.getByTestId('blood-work-page')).toBeVisible()
    // List card renders "{count} markers" + date pill, not numeric values.
    // Assert at least one row is present; the detail page asserts the
    // value below.
    await expect(page.getByTestId('bloodwork-list')).toBeVisible()
    await expect(
      page.getByTestId('bloodwork-list').locator('li'),
    ).toHaveCount(1, { timeout: 10_000 })

    // Memory: today should have a BLOOD WORK pill.
    await page.goto('/journey/memory')
    await expect(page.getByTestId('memory-tab')).toBeVisible()
    // Today is the default scrubber position.
    await expandCompleted(page)
    const bwPillToday = page
      .locator('[data-event-group="Completed"] [data-event-type="blood-work"]')
      .first()
    await expect(bwPillToday).toBeVisible({ timeout: 10_000 })
    await expect(bwPillToday).toContainText('BLOOD WORK')

    // ------------------------------------------------------------------
    // T5 — Manual blood-work edit (regression: userId on updateBloodWork).
    // ------------------------------------------------------------------
    await page.goto(bloodWorkDetailUrl)
    await expect(page.getByTestId('blood-work-detail-page')).toBeVisible()
    await expect(page.getByTestId('blood-work-detail-card')).toBeVisible({
      timeout: 10_000,
    })
    await page.getByTestId('blood-work-detail-edit').click()
    await expect(page.getByTestId('blood-work-form')).toBeVisible()

    // Change date to yesterday + bump CRP to 30.
    await page.getByLabel('When was the test?').fill(yesterday)
    const editCrpRow = page.locator('[data-testid="marker-row-0"]')
    await editCrpRow.getByLabel('Value').fill('30')
    await page.getByTestId('blood-work-form-submit').click()

    // Detail card should re-render with updated CRP.
    await expect(page.getByTestId('blood-work-detail-card')).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByTestId('blood-work-form-error')).toHaveCount(0)
    await expect(page.getByTestId('blood-work-detail-card')).toContainText(
      '30',
    )
    expect(
      errors.find((e) => /ArgumentValidationError/i.test(e)),
    ).toBeUndefined()

    // ------------------------------------------------------------------
    // T6 — Manual blood-work soft-delete (regression: userId on
    // softDeleteBloodWork).
    // ------------------------------------------------------------------
    await page.getByTestId('blood-work-detail-delete').click()
    const bwConfirm = page.getByTestId('blood-work-delete-confirm')
    await expect(bwConfirm).toBeVisible()
    await expect(bwConfirm).toContainText(
      "Delete these blood work results? You can\u2019t undo this.",
    )
    await page.getByTestId('blood-work-delete-confirm-submit').click()

    await expect(page).toHaveURL(/\/blood-work$/, { timeout: 10_000 })
    await expect(page.getByTestId('blood-work-page')).toBeVisible()
    await expect(page.getByTestId('bloodwork-list')).toHaveCount(0)
    expect(
      errors.find((e) => /ArgumentValidationError/i.test(e)),
    ).toBeUndefined()

    // ------------------------------------------------------------------
    // T7 — Memory filter chips: Visits / Blood work scope correctly.
    //
    // Re-create one fresh visit + one fresh blood-work for today so we
    // have one of each in memory for the chip test.
    // ------------------------------------------------------------------
    const filterDoctor = `Dr. QA Filter ${Date.now()}`
    await page.goto('/visits/new')
    await waitForUserIdProvisioned(page)
    await page.getByLabel('Who did you see?').fill(filterDoctor)
    await page.getByTestId('visit-form-submit').click()
    await page.waitForURL(
      (url) =>
        /\/visits\/[^/]+$/.test(url.pathname) &&
        !url.pathname.endsWith('/visits/new'),
      { timeout: 15_000 },
    )

    await page.goto('/blood-work/new')
    await waitForUserIdProvisioned(page)
    const filterBwRow = page.locator('[data-testid="marker-row-0"]')
    await filterBwRow.getByLabel('Value').fill('15')
    await filterBwRow.getByLabel('Unit').fill('mg/L')
    await page.getByTestId('blood-work-form-submit').click()
    await page.waitForURL(
      (url) =>
        /\/blood-work\/[^/]+$/.test(url.pathname) &&
        !url.pathname.endsWith('/blood-work/new'),
      { timeout: 15_000 },
    )

    await page.goto('/journey/memory')
    await expect(page.getByTestId('memory-tab')).toBeVisible()
    await expandCompleted(page)

    // Click the "Visits" chip.
    await page.getByTestId('filter-tab-visits').click()
    await expect(page).toHaveURL(/[?&]filter=visits/)
    // Re-expand Completed (filter changes can re-mount the section).
    await expandCompleted(page)
    // Only DR VISIT pills present.
    await expect(
      page.locator('[data-event-type="visit"]').first(),
    ).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('[data-event-type="blood-work"]')).toHaveCount(0)

    // Click the "Blood work" chip.
    await page.getByTestId('filter-tab-blood-work').click()
    await expect(page).toHaveURL(/[?&]filter=blood-work/)
    await expandCompleted(page)
    await expect(
      page.locator('[data-event-type="blood-work"]').first(),
    ).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('[data-event-type="visit"]')).toHaveCount(0)

    // ------------------------------------------------------------------
    // R3 — F01 home page loads without runtime errors. Lightweight.
    // ------------------------------------------------------------------
    await page.goto('/home')
    await expect(page.getByTestId('home-page')).toBeVisible({ timeout: 10_000 })
    expect(
      errors.find((e) => /ArgumentValidationError/i.test(e)),
    ).toBeUndefined()
  })
})
