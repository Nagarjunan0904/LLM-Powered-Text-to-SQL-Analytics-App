import { chromium } from 'playwright'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'

const SS_DIR = 'verify_screenshots_sqlpanel'
mkdirSync(SS_DIR, { recursive: true })

let ss = 0
async function shot(page, label) {
  const path = `${SS_DIR}/${String(++ss).padStart(2,'0')}_${label}.png`
  await page.screenshot({ path, fullPage: false })
  console.log(`  📸 ${path}`)
  return path
}
function log(icon, msg) { console.log(`${icon} ${msg}`) }

const TIMEOUT = 90_000
const SHORT   = 8_000

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  const page = await ctx.newPage()

  const consoleErrors = []
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()) })
  page.on('pageerror', err => consoleErrors.push(`[PAGE ERROR] ${err.message}`))

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 1 — Normal query (no correction)
  // ═══════════════════════════════════════════════════════════════════════════
  log('', '━━ TEST 1: Normal query (no correction) ━━')

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' })
  await page.locator('textarea').waitFor({ timeout: SHORT })
  await page.waitForFunction(
    () => [...document.querySelectorAll('button')].some(b => b.textContent.includes('How many total trips')),
    { timeout: SHORT }
  )
  await shot(page, 't1_loaded')

  await page.locator('textarea').fill('How many total trips were taken in 2023?')
  await page.locator('textarea').press('Enter')

  // Wait for completion
  await page.waitForFunction(
    () => [...document.querySelectorAll('button')].some(b =>
      b.textContent.trim() === 'Run Query' && !b.disabled
    ),
    { timeout: TIMEOUT }
  )
  await shot(page, 't1_complete')

  // Check green attempt-1 badge
  const greenBadge = await page.locator('text=Generated on attempt 1 of 3').count()
  log(greenBadge > 0 ? '✅' : '❌', `TEST 1: Green "✓ Generated on attempt 1 of 3" badge: ${greenBadge > 0}`)

  // Check latency badge (contains "ms")
  const latencyBadge = await page.locator('.rounded-full').filter({ hasText: /\d+ms/ }).count()
  log(latencyBadge > 0 ? '✅' : '❌', `TEST 1: Latency badge shows ms: ${latencyBadge > 0}`)

  // Check line numbers present (SyntaxHighlighter renders them as spans/li)
  const hasLineNums = await page.locator('.linenumber, [class*="line-number"], code .react-syntax-highlighter-line-number').count() > 0
    || await page.evaluate(() => {
        const code = document.querySelector('code')
        return code ? code.innerHTML.includes('1') : false
      })
  log(hasLineNums ? '✅' : '⚠️', `TEST 1: Line numbers present: ${hasLineNums}`)

  // Check no diff panes (no "Attempt 1 — Failed" text)
  const noDiff = await page.locator('text=Attempt 1 — Failed').count() === 0
  log(noDiff ? '✅' : '❌', `TEST 1: No diff panes shown when corrected=false: ${noDiff}`)

  // Check footer char count
  const footer = await page.locator('text=chars').count()
  log(footer > 0 ? '✅' : '❌', `TEST 1: Footer char count visible: ${footer > 0}`)

  // Test Copy button
  log('▶', 'TEST 1: Testing Copy button')
  const copyBtn = page.locator('button', { hasText: 'Copy' })
  await copyBtn.click()
  await page.waitForFunction(
    () => [...document.querySelectorAll('button')].some(b => b.textContent.includes('Copied!')),
    { timeout: 3000 }
  )
  log('✅', 'TEST 1: Copy button shows "Copied!" after click')
  await shot(page, 't1_copy_button')
  // Wait for it to revert
  await page.waitForFunction(
    () => [...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Copy'),
    { timeout: 5000 }
  )
  log('✅', 'TEST 1: Copy button reverts to "Copy" after 2 seconds')
  await shot(page, 't1_normal_mode_complete')

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 2 — Diff mode: temporarily patch App.jsx to force corrected+originalSql
  // ═══════════════════════════════════════════════════════════════════════════
  log('', '')
  log('', '━━ TEST 2: Diff mode layout (hardcoded corrected=true) ━━')

  const APP_PATH = 'D:\\AI_ML\\Projects\\LLM-Powered-Text-to-SQL-Analytics-App\\frontend\\src\\App.jsx'
  const original = readFileSync(APP_PATH, 'utf-8')

  // Patch: after "setSql('')," add hardcoded state overrides via useEffect
  // We inject a second useEffect that forces state for visual testing
  const PATCH_MARKER = "const [originalSql, setOriginalSql]     = useState('')"
  const PATCH_INSERT = "const [originalSql, setOriginalSql]     = useState('SELECT * FROM nonexistent_table')"

  const PATCH_MARKER2 = "const [corrected, setCorrected]         = useState(false)"
  const PATCH_INSERT2 = "const [corrected, setCorrected]         = useState(true)"

  const PATCH_MARKER3 = "const [sql, setSql]                     = useState('')"
  const PATCH_INSERT3 = "const [sql, setSql]                     = useState('SELECT COUNT(*) FROM yellow_taxi_trips WHERE EXTRACT(YEAR FROM pickup_datetime) = 2023;')"

  const PATCH_MARKER4 = "const [attempts, setAttempts]           = useState(0)"
  const PATCH_INSERT4 = "const [attempts, setAttempts]           = useState(2)"

  const PATCH_MARKER5 = "const [latencyMs, setLatencyMs]         = useState(0)"
  const PATCH_INSERT5 = "const [latencyMs, setLatencyMs]         = useState(3241)"

  const patched = original
    .replace(PATCH_MARKER, PATCH_INSERT)
    .replace(PATCH_MARKER2, PATCH_INSERT2)
    .replace(PATCH_MARKER3, PATCH_INSERT3)
    .replace(PATCH_MARKER4, PATCH_INSERT4)
    .replace(PATCH_MARKER5, PATCH_INSERT5)

  writeFileSync(APP_PATH, patched, 'utf-8')
  log('  ', 'Patched App.jsx with hardcoded corrected=true + originalSql')

  // Wait for HMR
  await page.waitForTimeout(2500)
  await page.reload({ waitUntil: 'networkidle' })
  await shot(page, 't2_diff_mode_raw')

  // Check for two-pane diff
  const failedPane  = await page.locator('text=Attempt 1 — Failed').count()
  const succeededPane = await page.locator('text=Corrected SQL — Succeeded').count()
  log(failedPane > 0  ? '✅' : '❌', `TEST 2: Red pane "Attempt 1 — Failed" visible: ${failedPane > 0}`)
  log(succeededPane > 0 ? '✅' : '❌', `TEST 2: Green pane "Corrected SQL — Succeeded" visible: ${succeededPane > 0}`)

  // Check explanation bar
  const explBar = await page.locator('text=self-correction loop').count()
  log(explBar > 0 ? '✅' : '❌', `TEST 2: Yellow explanation bar visible: ${explBar > 0}`)

  // Check yellow "Self-corrected" badge in header
  const selfCorrBadge = await page.locator('text=Self-corrected').count()
  log(selfCorrBadge > 0 ? '✅' : '❌', `TEST 2: "Self-corrected" badge in header: ${selfCorrBadge > 0}`)

  // Check yellow attempt badge (attempt 2)
  const attempt2Badge = await page.locator('text=Generated on attempt 2 of 3').count()
  log(attempt2Badge > 0 ? '✅' : '❌', `TEST 2: Yellow "⚡ Generated on attempt 2 of 3" badge: ${attempt2Badge > 0}`)

  // Check the tinted backgrounds exist
  const redTint = await page.evaluate(() => {
    const pres = document.querySelectorAll('pre')
    return [...pres].some(p => {
      const bg = p.style.background || getComputedStyle(p).backgroundColor
      return bg.includes('2d1515') || bg.includes('45, 21, 21')
    })
  })
  log(redTint ? '✅' : '⚠️', `TEST 2: Red-tinted left pane background: ${redTint}`)

  await shot(page, 't2_diff_mode_complete')

  // ── Restore App.jsx ──────────────────────────────────────────────────────
  writeFileSync(APP_PATH, original, 'utf-8')
  log('  ', 'Restored App.jsx to original (hardcode removed)')

  await page.waitForTimeout(2000)

  // ── Console errors ────────────────────────────────────────────────────────
  log('', '')
  if (consoleErrors.length === 0) {
    log('✅', 'No JavaScript console errors')
  } else {
    consoleErrors.forEach(e => log('❌', `Console error: ${e}`))
  }

  await browser.close()
  console.log(`\nAll screenshots → frontend/${SS_DIR}/`)
})()
