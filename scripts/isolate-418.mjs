import { chromium } from '@playwright/test'
const BYPASS = 'ZmFXG9aJ1qRh9FOajINruF3ntawYfPNI'
const cases = [
  { url: 'https://saha-health-companion-j75l8bq44-rewant24s-projects.vercel.app/check-in', label: 'PR latest /check-in', bypass: true },
  { url: 'https://saha-health-companion-j75l8bq44-rewant24s-projects.vercel.app/', label: 'PR latest /', bypass: true },
  { url: 'https://www.meetsaha.com/check-in', label: 'meetsaha /check-in', bypass: false },
]
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext()
await ctx.route(/saha-health-companion.*\.vercel\.app/, async (r) => {
  await r.continue({ headers: { ...r.request().headers(), 'x-vercel-protection-bypass': BYPASS } })
})
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
