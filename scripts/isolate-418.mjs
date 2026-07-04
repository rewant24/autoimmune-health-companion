/**
 * Isolates React #418 hydration errors across deploy targets.
 *
 * Run with env loaded (raw node does NOT read .env files like Next.js does):
 *   node --env-file=.env.local scripts/isolate-418.mjs
 *
 * Required env (only when a case targets a protected *.vercel.app preview):
 *   VERCEL_AUTOMATION_BYPASS_SECRET — from Vercel → Project Settings →
 *   Deployment Protection → Protection Bypass for Automation. Never
 *   hardcode it; it lives only in .env.local (gitignored) / Vercel env.
 * Optional:
 *   PREVIEW_URL — origin for the preview cases (the hardcoded PR preview
 *   below goes stale as branches close).
 */
import { chromium } from '@playwright/test'

const previewOrigin =
  process.env.PREVIEW_URL ||
  'https://saha-health-companion-j75l8bq44-rewant24s-projects.vercel.app'
const cases = [
  { url: `${previewOrigin}/check-in`, label: 'PR latest /check-in', bypass: true },
  { url: `${previewOrigin}/`, label: 'PR latest /', bypass: true },
  { url: 'https://www.meetsaha.com/check-in', label: 'meetsaha /check-in', bypass: false },
]

const BYPASS = cases.some((c) => c.bypass)
  ? process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  : null
if (cases.some((c) => c.bypass) && !BYPASS) {
  throw new Error(
    'Missing required env var VERCEL_AUTOMATION_BYPASS_SECRET (needed for protected preview cases). ' +
      'Set it in .env.local and run via: node --env-file=.env.local scripts/isolate-418.mjs',
  )
}

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext()
if (BYPASS) {
  await ctx.route(/saha-health-companion.*\.vercel\.app/, async (r) => {
    await r.continue({ headers: { ...r.request().headers(), 'x-vercel-protection-bypass': BYPASS } })
  })
}
for (const c of cases) {
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message.split('\n')[0]))
  try {
    const r = await page.goto(c.url, { waitUntil: 'load', timeout: 60_000 })
    await page.waitForTimeout(2500)
    const has418 = errs.some((e) => e.includes('#418'))
    console.log(`${c.label.padEnd(30)} status=${r.status()} errors=${errs.length} #418=${has418 ? 'YES' : 'no'}`)
    if (errs.length) errs.forEach(e => console.log('    - ' + e))
  } catch (e) {
    console.log(`${c.label.padEnd(30)} ERR ${e.message.split('\n')[0]}`)
  }
  await page.close()
}
await browser.close()
