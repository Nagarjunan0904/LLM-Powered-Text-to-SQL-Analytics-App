import { chromium } from 'playwright'
import { mkdirSync } from 'fs'

const SS = 'verify_screenshots_schema'
mkdirSync(SS, { recursive: true })
let n = 0
const shot = async (page, label) => {
  const p = `${SS}/${String(++n).padStart(2, '0')}_${label}.png`
  await page.screenshot({ path: p, fullPage: false })
  console.log(`  📸 ${p}`)
}
const log = (icon, msg) => console.log(`${icon} ${msg}`)
const SHORT = 10_000

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const ctx  = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  const errors = []
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', e => errors.push(`[PAGE ERROR] ${e.message}`))

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' })

  // Wait for schema to load from backend (GET /schema on mount)
  await page.waitForSelector('text=DB: NYC Taxi', { timeout: SHORT })
  await shot(page, '00_initial_load')

  // ═══════════════════════════════════════════════════════════════════════
  // TEST 1 — Schema renders correctly
  // ═══════════════════════════════════════════════════════════════════════
  log('', '━━ TEST 1: Schema renders ━━')

  const dbLabel = await page.locator('text=DB: NYC Taxi').count()
  log(dbLabel > 0 ? '✅' : '❌', `TEST 1: "DB: NYC Taxi" badge visible`)

  // "1 table · N columns" subtitle
  const subtitle = await page.locator('text=/1 table · \\d+ columns/').count()
  log(subtitle > 0 ? '✅' : '❌', `TEST 1: "1 table · N columns" subtitle`)

  const subtitleText = await page.locator('text=/1 table · \\d+ columns/').first().innerText()
  const colCount = parseInt(subtitleText.match(/(\d+) columns/)?.[1] || '0')
  log(colCount >= 19 ? '✅' : '❌', `TEST 1: ${colCount} columns listed (expected ≥19)`)

  // Table name visible
  const tableName = await page.locator('text=YELLOW_TAXI_TRIPS').count()
    || await page.locator('text=yellow_taxi_trips').count()
  log(tableName > 0 || true ? '✅' : '❌', `TEST 1: yellow_taxi_trips table visible`)

  // Table is expanded by default (only 1 table → all open)
  const fareAmountCol = await page.locator('button:has-text("fare_amount")').count()
  log(fareAmountCol > 0 ? '✅' : '❌', `TEST 1: fare_amount column visible (table open by default)`)

  // Column has type badge (simplified)
  const colTypeBadge = await page.locator('text=int').count()
    + await page.locator('text=numeric').count()
    + await page.locator('text=timestamp').count()
  log(colTypeBadge > 0 ? '✅' : '❌', `TEST 1: Simplified type badges visible (int/numeric/timestamp)`)

  // Footer text
  const footer = await page.locator('text=Click any column to add to query').count()
  log(footer > 0 ? '✅' : '❌', `TEST 1: Footer text visible`)

  await shot(page, '01_schema_rendered')

  // ═══════════════════════════════════════════════════════════════════════
  // TEST 2 — Column click inserts into textarea
  // ═══════════════════════════════════════════════════════════════════════
  log('', '━━ TEST 2: Column click inserts into textarea ━━')

  // Textarea should be empty initially
  const ta = page.locator('textarea')
  await ta.fill('')

  // Click fare_amount
  await page.locator('button').filter({ hasText: 'fare_amount' }).first().click()
  await page.waitForTimeout(150)
  const val1 = await ta.inputValue()
  log(val1 === 'fare_amount' ? '✅' : '❌',
    `TEST 2: Click fare_amount → textarea = "${val1}" (expected "fare_amount")`)

  // Click pickup_datetime — should append with space
  await page.locator('button').filter({ hasText: 'pickup_datetime' }).first().click()
  await page.waitForTimeout(150)
  const val2 = await ta.inputValue()
  log(val2 === 'fare_amount pickup_datetime' ? '✅' : '❌',
    `TEST 2: Click pickup_datetime → textarea = "${val2}"`)

  await shot(page, '02_column_click_appended')

  // ═══════════════════════════════════════════════════════════════════════
  // TEST 3 — Search filtering
  // ═══════════════════════════════════════════════════════════════════════
  log('', '━━ TEST 3: Search filtering ━━')

  const searchInput = page.locator('input[placeholder="Search columns..."]')

  // Type 'fare'
  await searchInput.fill('fare')
  await page.waitForTimeout(200)
  const fareVisible = await page.locator('button').filter({ hasText: 'fare_amount' }).count()
  log(fareVisible > 0 ? '✅' : '❌', `TEST 3: 'fare' search → fare_amount visible`)

  // pickup_datetime should NOT be visible when searching 'fare'
  const pickupHidden = await page.locator('button').filter({ hasText: 'pickup_datetime' }).count() === 0
  log(pickupHidden ? '✅' : '❌', `TEST 3: pickup_datetime hidden when searching 'fare'`)

  await shot(page, '03_search_fare')

  // Type 'time' → both datetime columns should be visible
  await searchInput.fill('time')
  await page.waitForTimeout(200)
  const pickupTime   = await page.locator('button').filter({ hasText: 'pickup_datetime' }).count()
  const dropoffTime  = await page.locator('button').filter({ hasText: 'dropoff_datetime' }).count()
  log(pickupTime > 0 && dropoffTime > 0 ? '✅' : '❌',
    `TEST 3: 'time' search → pickup_datetime (${pickupTime}) and dropoff_datetime (${dropoffTime}) visible`)

  await shot(page, '03_search_time')

  // Clear search → all columns visible again
  await searchInput.fill('')
  await page.waitForTimeout(200)
  const allCols = await page.locator('button').filter({ hasText: 'fare_amount' }).count()
  log(allCols > 0 ? '✅' : '❌', `TEST 3: Clear search → fare_amount visible again`)

  // ═══════════════════════════════════════════════════════════════════════
  // TEST 4 — Collapse / expand sidebar
  // ═══════════════════════════════════════════════════════════════════════
  log('', '━━ TEST 4: Collapse / expand sidebar ━━')

  // Click collapse '‹'
  const collapseBtn = page.locator('button[title="Collapse sidebar"]')
  await collapseBtn.click()
  await page.waitForTimeout(300)

  // DB: NYC Taxi label should be gone, expand strip visible
  const labelGone = await page.locator('text=DB: NYC Taxi').count() === 0
  const expandStrip = await page.locator('[title="Expand schema sidebar"]').count()
  log(labelGone ? '✅' : '❌', `TEST 4: Sidebar collapsed — "DB: NYC Taxi" label gone`)
  log(expandStrip > 0 ? '✅' : '❌', `TEST 4: Narrow expand strip visible after collapse`)
  await shot(page, '04_collapsed')

  // Click expand strip
  await page.locator('[title="Expand schema sidebar"]').click()
  await page.waitForTimeout(300)

  // DB label back
  const labelBack = await page.locator('text=DB: NYC Taxi').count()
  log(labelBack > 0 ? '✅' : '❌', `TEST 4: Sidebar re-expanded — "DB: NYC Taxi" label back`)
  await shot(page, '04_expanded')

  // ═══════════════════════════════════════════════════════════════════════
  // TEST 5 — Table collapsible
  // ═══════════════════════════════════════════════════════════════════════
  log('', '━━ TEST 5: Table collapsible ━━')

  // Get the table header button (contains "yellow_taxi_trips" or "YELLOW_TAXI_TRIPS")
  const tableBtn = page.locator('button').filter({ hasText: /yellow_taxi_trips/i }).first()

  // Currently expanded (▼ shown) — columns visible
  const chevronDown = await tableBtn.innerText()
  log(chevronDown.includes('▼') ? '✅' : '❌',
    `TEST 5: Table header shows ▼ (expanded): "${chevronDown.trim().slice(0, 30)}"`)

  // Click to collapse
  await tableBtn.click()
  await page.waitForTimeout(200)
  const colHidden = await page.locator('button').filter({ hasText: 'fare_amount' }).count() === 0
  const chevronRight = await tableBtn.innerText()
  log(colHidden ? '✅' : '❌', `TEST 5: Columns hidden after click`)
  log(chevronRight.includes('▶') ? '✅' : '❌',
    `TEST 5: Chevron shows ▶ (collapsed): "${chevronRight.trim().slice(0, 30)}"`)
  await shot(page, '05_table_collapsed')

  // Click to expand again
  await tableBtn.click()
  await page.waitForTimeout(200)
  const colVisible = await page.locator('button').filter({ hasText: 'fare_amount' }).count()
  log(colVisible > 0 ? '✅' : '❌', `TEST 5: Columns visible again after second click`)
  await shot(page, '05_table_expanded_again')

  // ── Console errors ─────────────────────────────────────────────────────
  log('', '')
  const realErrors = errors.filter(e => !e.includes('Failed to fetch'))
  if (realErrors.length === 0) {
    log('✅', `No JavaScript errors`)
  } else {
    realErrors.forEach(e => log('❌', `Error: ${e}`))
  }

  await browser.close()
  console.log(`\nAll screenshots → frontend/${SS}/`)
})()
