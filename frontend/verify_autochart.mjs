import { chromium } from 'playwright'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'

const SS = 'verify_screenshots_autochart'
mkdirSync(SS, { recursive: true })
let n = 0
const shot = async (page, label) => {
  const p = `${SS}/${String(++n).padStart(2, '0')}_${label}.png`
  await page.screenshot({ path: p, fullPage: false })
  console.log(`  📸 ${p}`)
}
const log = (icon, msg) => console.log(`${icon} ${msg}`)

const APP     = 'D:\\AI_ML\\Projects\\LLM-Powered-Text-to-SQL-Analytics-App\\frontend\\src\\App.jsx'
const CLEAN   = 'D:\\AI_ML\\Projects\\LLM-Powered-Text-to-SQL-Analytics-App\\frontend\\App_clean_backup.jsx'
const SHORT   = 8_000

// Inject state from the CLEAN template (prevents double-patch issues)
async function injectState(page, cleanSrc, columns, rows) {
  const colsJson = JSON.stringify(columns)
  const rowsJson = JSON.stringify(rows)

  const patched = cleanSrc
    .replace(
      'const [columns, setColumns]             = useState([])',
      `const [columns, setColumns]             = useState(${colsJson})`
    )
    .replace(
      'const [rows, setRows]                   = useState([])',
      `const [rows, setRows]                   = useState(${rowsJson})`
    )
    .replace(
      'const [latencyMs, setLatencyMs]         = useState(0)',
      'const [latencyMs, setLatencyMs]         = useState(1234)'
    )

  writeFileSync(APP, patched, 'utf-8')
  // Let Vite compile the change before reload
  await page.waitForTimeout(2000)
  await page.reload({ waitUntil: 'networkidle' })
  // Wait for React to mount (header is always rendered)
  await page.waitForSelector('header', { timeout: SHORT })
  await page.waitForTimeout(500) // let recharts finish painting
}

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const ctx  = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  const errors = []
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', e => errors.push(`[PAGE ERROR] ${e.message}`))

  // Always patch from the clean template
  const cleanSrc = readFileSync(CLEAN, 'utf-8')

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' })

  // ═══════════════════════════════════════════════════════════════════════
  // TEST 1 — Bar Chart: 2 numeric cols, ≤100 rows → treated as categorical bar
  // ═══════════════════════════════════════════════════════════════════════
  log('', '━━ TEST 1: Bar Chart (2 numeric cols, ≤100 rows) ━━')

  await injectState(page, cleanSrc, ['pickup_location_id', 'trip_count'], [
    [132, 2800000], [161, 2650000], [237, 2100000], [236, 1950000], [162, 1800000],
    [230, 1750000], [142, 1700000], [143, 1650000], [163, 1550000], [233, 1500000],
  ])
  await shot(page, 't1_bar_chart')

  const barEl = await page.locator('.recharts-bar').count()
  log(barEl > 0 ? '✅' : '❌', `TEST 1: Recharts bar elements rendered (count=${barEl})`)

  const barLabel = await page.locator('text=Auto-detected: Bar Chart').count()
  log(barLabel > 0 ? '✅' : '❌', `TEST 1: "Auto-detected: Bar Chart" header`)

  const barFill = await page.evaluate(() => {
    const paths = document.querySelectorAll('.recharts-bar-rectangle path, .recharts-bar-rectangle rect, .recharts-rectangle')
    return [...paths].some(el => (el.getAttribute('fill') || '').toLowerCase().includes('7c3aed'))
  })
  log(barFill ? '✅' : '⚠️', `TEST 1: Purple (#7c3aed) bar fill`)

  const footer1 = await page.locator('text=/10 data points/').count()
  log(footer1 > 0 ? '✅' : '❌', `TEST 1: Footer "10 data points"`)

  const noToggle = await page.locator('button', { hasText: /^Line$/ }).count() === 0
  log(noToggle ? '✅' : '⚠️', `TEST 1: No Bar/Line toggle (correct — not bar-line case)`)

  // ═══════════════════════════════════════════════════════════════════════
  // TEST 2 — Line Chart: ISO timestamp col + numeric col
  // ═══════════════════════════════════════════════════════════════════════
  log('', '━━ TEST 2: Line Chart (date + numeric) ━━')

  await injectState(page, cleanSrc, ['month', 'total_revenue'], [
    ['2023-01-01T00:00:00', 48200000],
    ['2023-02-01T00:00:00', 42100000],
    ['2023-03-01T00:00:00', 51300000],
    ['2023-04-01T00:00:00', 49800000],
    ['2023-05-01T00:00:00', 53600000],
    ['2023-06-01T00:00:00', 50900000],
    ['2023-07-01T00:00:00', 47200000],
    ['2023-08-01T00:00:00', 48700000],
    ['2023-09-01T00:00:00', 52100000],
    ['2023-10-01T00:00:00', 55400000],
    ['2023-11-01T00:00:00', 49300000],
    ['2023-12-01T00:00:00', 51800000],
  ])
  await shot(page, 't2_line_chart')

  const lineEl = await page.locator('.recharts-line').count()
  log(lineEl > 0 ? '✅' : '❌', `TEST 2: Recharts line element rendered (count=${lineEl})`)

  const lineLabel = await page.locator('text=Auto-detected: Line Chart').count()
  log(lineLabel > 0 ? '✅' : '❌', `TEST 2: "Auto-detected: Line Chart" header`)

  const footer2 = await page.locator('text=/12 data points/').count()
  log(footer2 > 0 ? '✅' : '❌', `TEST 2: Footer "12 data points"`)

  // ═══════════════════════════════════════════════════════════════════════
  // TEST 3 — No Chart: single value (1 col × 1 row, numeric only)
  // ═══════════════════════════════════════════════════════════════════════
  log('', '━━ TEST 3: No chart for single-value result ━━')

  await injectState(page, cleanSrc, ['avg_fare'], [[14.32]])
  await shot(page, 't3_no_chart')

  const placeholder = await page.locator('text=Chart not available for this result shape').count()
  log(placeholder > 0 ? '✅' : '❌', `TEST 3: "Chart not available" placeholder`)

  const noRecharts = await page.locator('.recharts-wrapper').count() === 0
  log(noRecharts ? '✅' : '❌', `TEST 3: No Recharts wrapper rendered`)

  // ═══════════════════════════════════════════════════════════════════════
  // TEST 4 — Bar-Line toggle: 1 string + 1 date + 1 numeric
  // ═══════════════════════════════════════════════════════════════════════
  log('', '━━ TEST 4: Bar-Line toggle (string + date + numeric) ━━')

  await injectState(page, cleanSrc,
    ['zone_name', 'pickup_date', 'trip_count'],
    [
      ['JFK Airport',  '2023-01-01T00:00:00', 120000],
      ['Midtown',      '2023-02-01T00:00:00',  98000],
      ['LaGuardia',    '2023-03-01T00:00:00',  87000],
      ['Lower East',   '2023-04-01T00:00:00',  76000],
      ['Upper West',   '2023-05-01T00:00:00',  65000],
    ]
  )
  await shot(page, 't4_bar_line_toggle')

  const barBtn  = await page.locator('button', { hasText: /^Bar$/ }).count()
  const lineBtn = await page.locator('button', { hasText: /^Line$/ }).count()
  log(barBtn > 0 && lineBtn > 0 ? '✅' : '❌',
    `TEST 4: Bar + Line toggle buttons visible (bar=${barBtn}, line=${lineBtn})`)

  const barActive = await page.evaluate(() => {
    const barBtns = [...document.querySelectorAll('button')]
      .filter(b => b.textContent.trim() === 'Bar')
    return barBtns.some(b => b.classList.contains('bg-purple-600'))
  })
  log(barActive ? '✅' : '❌', `TEST 4: Bar pill active by default (purple)`)

  // Bar chart should be rendering (default active=bar)
  const defaultBarEl = await page.locator('.recharts-bar').count()
  log(defaultBarEl > 0 ? '✅' : '❌', `TEST 4: Default renders bar chart`)

  // Click Line → line chart
  await page.locator('button', { hasText: /^Line$/ }).click()
  await page.waitForTimeout(400)
  const lineAfter = await page.locator('.recharts-line').count()
  log(lineAfter > 0 ? '✅' : '❌', `TEST 4: Clicking Line → line chart appears`)
  await shot(page, 't4_after_line_toggle')

  // Header updates to Line Chart
  const lineHeaderAfter = await page.locator('text=Auto-detected: Line Chart').count()
  log(lineHeaderAfter > 0 ? '✅' : '❌', `TEST 4: Header updates to "Line Chart" after toggle`)

  // Click Bar → returns
  await page.locator('button', { hasText: /^Bar$/ }).click()
  await page.waitForTimeout(300)
  const barAfter = await page.locator('.recharts-bar').count()
  log(barAfter > 0 ? '✅' : '❌', `TEST 4: Clicking Bar → bar chart returns`)

  // ── Restore ──────────────────────────────────────────────────────────
  writeFileSync(APP, cleanSrc, 'utf-8')
  log('  ', 'App.jsx restored to clean state')

  // ── Console errors ─────────────────────────────────────────────────────
  log('', '')
  const realErrors = errors.filter(e => !e.includes('Failed to fetch'))
  if (realErrors.length === 0) {
    log('✅', `No JavaScript errors (${errors.length} network errors from page reloads filtered)`)
  } else {
    realErrors.forEach(e => log('❌', `Error: ${e}`))
  }

  await browser.close()
  console.log(`\nAll screenshots → frontend/${SS}/`)
})()
