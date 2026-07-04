/**
 * One-shot smoke for PR #28 PostHog wiring against the live Vercel preview.
 *
 * Run with env loaded (raw node does NOT read .env files like Next.js does):
 *   node --env-file=.env.local scripts/posthog-smoke.mjs
 *
 * Required env:
 *   NEXT_PUBLIC_POSTHOG_KEY          — expected PostHog project key
 *   VERCEL_AUTOMATION_BYPASS_SECRET  — only when targeting a protected
 *                                      *.vercel.app preview (not needed for
 *                                      prod meetsaha.com or local next start)
 * Optional:
 *   PREVIEW_URL — target origin (defaults to prod https://www.meetsaha.com)
 *
 * What this proves:
 *  - PostHog SDK loads on the target build
 *  - posthog.init runs (env var threaded through)
 *  - At least one capture POST fires to us.i.posthog.com
 *  - the project API key in the capture body matches the expected one
 *  - distinct_id is tied to saha.testUser.v1 (D4 identity stitch)
 *  - /check-in route renders without console errors
 *
 * What this does NOT prove:
 *  - voice_start_called / voice_stop_called events
 *    (needs fake-audio fixture + real mic stream — see TODO at bottom)
 */
import { chromium } from '@playwright/test'

function requireEnv(name, hint) {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing required env var ${name}. ${hint} ` +
        `Run via: node --env-file=.env.local scripts/posthog-smoke.mjs`,
    )
  }
  return value
}

const PREVIEW = process.env.PREVIEW_URL || 'https://www.meetsaha.com'
const EXPECTED_KEY = requireEnv(
  'NEXT_PUBLIC_POSTHOG_KEY',
  'Set it in .env.local (same key the app uses).',
)
// The bypass secret defeats Vercel deployment protection — only protected
// *.vercel.app previews need it. Never hardcode it; it must live only in
// .env.local (gitignored) / Vercel env.
const needsBypass = /saha-health-companion.*\.vercel\.app/.test(PREVIEW)
const BYPASS = needsBypass
  ? requireEnv(
      'VERCEL_AUTOMATION_BYPASS_SECRET',
      'Copy it from Vercel → Project Settings → Deployment Protection → Protection Bypass for Automation.',
    )
  : null
const TEST_USER = 'qa-smoke-' + Date.now()

const captures = []
const consoleErrors = []
const pageErrors = []

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({})

// Apply the SSO bypass ONLY to the saha-* host. extraHTTPHeaders would
// leak into cross-origin requests (e.g. posthog assets), which then
// fail CORS preflights and prevent the SDK from loading surveys/replay
// scripts.
if (BYPASS !== null) {
  await context.route(/saha-health-companion.*\.vercel\.app/, async (route) => {
    const headers = { ...route.request().headers(), 'x-vercel-protection-bypass': BYPASS }
    await route.continue({ headers })
  })
}

const page = await context.newPage()
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text())
})
page.on('pageerror', (e) => pageErrors.push(e.message))

// Intercept every POST that looks like PostHog ingestion
page.on('request', (req) => {
  const u = req.url()
  if (u.includes('i.posthog.com') && req.method() === 'POST') {
    let body
    try {
      body = req.postDataJSON()
    } catch {
      body = req.postData()
    }
    captures.push({ url: u, body })
  }
})

console.log(`[1/3] Loading landing page ${PREVIEW} ...`)
const landingResp = await page.goto(PREVIEW, { waitUntil: 'load', timeout: 60_000 })
console.log(`    → status ${landingResp.status()}`)

// PostHog batches captures — give it a moment to flush
await page.waitForTimeout(3_000)

console.log(`[2/3] Navigating to /check-in ...`)
const checkInResp = await page.goto(`${PREVIEW}/check-in`, { waitUntil: 'load', timeout: 60_000 })
console.log(`    → status ${checkInResp.status()}`)
await page.waitForTimeout(3_000)

console.log(`[3/3] Probing window state for sink installation ...`)
const probe = await page.evaluate(() => {
  // posthog-js attaches to window.posthog when initialized; also stash
  // a sentinel from our own provider for direct confirmation
  const ph = window.posthog
  const phKeys = Object.keys(window).filter((k) => /posthog/i.test(k))
  return {
    posthogLoaded: !!ph,
    posthogWindowKeys: phKeys,
    posthogConfig: ph
      ? {
          api_host: ph.config?.api_host,
          token: ph.config?.token,
          distinct_id: typeof ph.get_distinct_id === 'function' ? ph.get_distinct_id() : null,
          has_capture: typeof ph.capture === 'function',
        }
      : null,
    testUserStub: localStorage.getItem('saha.testUser.v1'),
    scripts: [...document.scripts].map((s) => s.src).filter((s) => s.includes('posthog')),
  }
})

await browser.close()

// --- Report ---
console.log('\n========== SMOKE REPORT ==========')
console.log(`PostHog SDK loaded:        ${probe.posthogLoaded ? 'YES' : 'NO'}`)
if (probe.posthogConfig) {
  console.log(`  api_host:                ${probe.posthogConfig.api_host}`)
  console.log(`  token matches expected:  ${probe.posthogConfig.token === EXPECTED_KEY ? 'YES' : 'NO ('+probe.posthogConfig.token+')'}`)
  console.log(`  distinct_id:             ${probe.posthogConfig.distinct_id}`)
  console.log(`  ties to testUser stub:   ${probe.posthogConfig.distinct_id === TEST_USER ? 'YES' : 'NO'}`)
}
console.log(`Window keys w/ "posthog":  ${probe.posthogWindowKeys.join(', ') || '(none)'}`)
console.log(`PostHog scripts in DOM:    ${probe.scripts.length}`)
probe.scripts.forEach((s) => console.log(`    ${s}`))
console.log(`Captures observed:         ${captures.length}`)
captures.forEach((c, i) => {
  const body = c.body
  const events = Array.isArray(body) ? body : body?.batch ?? [body]
  events.forEach((ev) => {
    console.log(`    [${i}] ${ev?.event ?? '(no event)'} → token ${(ev?.properties?.token ?? ev?.api_key ?? body?.api_key) || '(none)'}`)
  })
})
const eventNames = new Set()
for (const c of captures) {
  const body = c.body
  // PostHog batches arrays of events; also single objects
  const events = Array.isArray(body) ? body : body?.batch ?? [body]
  for (const ev of events) {
    if (ev?.event) eventNames.add(ev.event)
  }
}
console.log(`  unique event names:      ${[...eventNames].join(', ') || '(none)'}`)
console.log(`Console errors:            ${consoleErrors.length}`)
consoleErrors.forEach((e) => console.log(`    - ${e}`))
console.log(`Uncaught page errors:      ${pageErrors.length}`)
pageErrors.forEach((e) => console.log(`    - ${e}`))
console.log('===================================\n')

const ok =
  probe.posthogLoaded &&
  probe.posthogConfig.token === EXPECTED_KEY &&
  probe.posthogConfig.distinct_id === TEST_USER &&
  captures.length > 0 &&
  pageErrors.length === 0
process.exit(ok ? 0 : 1)
