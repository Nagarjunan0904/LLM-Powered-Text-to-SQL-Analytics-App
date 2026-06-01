import { chromium } from 'playwright'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'

const SS  = 'verify_screenshots_results'
mkdirSync(SS, { recursive: true })
let n = 0
const shot = async (page, label) => {
  const p = `${SS}/${String(++n).padStart(2,'0')}_${label}.png`
  await page.screenshot({ path: p })
  console.log(`  📸 ${p}`)
}
const log = (icon, msg) => console.log(`${icon} ${msg}`)

const TIMEOUT = 90_000
const SHORT   = 8_000

// Helper: wait for query to complete (Run Query re-enabled)
async function waitDone(page) {
  await page.waitForFunction(
    () => [...document.querySelectorAll('button')]
      .some(b => b.textContent.trim() === 'Run Query' && !b.disabled),
    { timeout: TIMEOUT }
  )
}

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const ctx  = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  const page = await ctx.newPage()

  const errors = []
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', e => errors.push(`[PAGE ERROR] ${e.message}`))

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' })
  await page.locator('textarea').waitFor({ timeout: SHORT })

  // ── TEST: 'n rows returned in Xms' header ──────────────────────────────
  log('', '━━ Header bar: row count + latency ━━')
  await page.locator('textarea').fill('What is the average fare amount by month?')
  await page.locator('textarea').press('Enter')
  await waitDone(page)
  await shot(page, '01_after_monthly_query')

  const headerText = await page.locator('text=rows returned').first().innerText()
  log(/\d+ rows returned in \d+ms/.test(headerText) ? '✅' : '❌',
    `Header bar text: "${headerText}"`)

  // ── TEST: column sort ──────────────────────────────────────────────────
  log('', '━━ Clickable column sort ━━')
  const headers = page.locator('thead th')
  const colCount = await headers.count()
  log('  ', `Table has ${colCount} columns`)

  // Click first column header → should sort asc (↑ appears)
  await headers.first().click()
  const afterFirstClick = await headers.first().innerText()
  log(afterFirstClick.includes('↑') ? '✅' : '❌',
    `After 1st click on col 0: indicator="${afterFirstClick}"`)

  // Click again → should toggle to desc (↓)
  await headers.first().click()
  const afterSecondClick = await headers.first().innerText()
  log(afterSecondClick.includes('↓') ? '✅' : '❌',
    `After 2nd click on col 0 (toggle desc): indicator="${afterSecondClick}"`)

  // Click a different column
  if (colCount > 1) {
    await headers.nth(1).click()
    const col1After = await headers.nth(1).innerText()
    const col0After = await headers.first().innerText()
    log(col1After.includes('↑') ? '✅' : '❌',
      `Clicking col 1 → col 1 shows ↑: ${col1After.includes('↑')}`)
    log(col0After.includes('↕') ? '✅' : '❌',
      `Clicking col 1 → col 0 reverts to ↕: ${col0After.includes('↕')}`)
  }
  await shot(page, '02_sorted_column')

  // ── TEST: pagination (need a query that returns many rows) ─────────────
  log('', '━━ Pagination: 25 rows per page ━━')
  await page.locator('textarea').fill('Show me the top 100 pickup locations by trip count')
  await page.locator('textarea').press('Enter')
  await waitDone(page)
  await shot(page, '03_after_100row_query')

  // Check if pagination controls appear
  const prevBtn = page.locator('button', { hasText: '← Prev' })
  const nextBtn = page.locator('button', { hasText: 'Next →' })
  const hasPrev = await prevBtn.count() > 0
  const hasNext = await nextBtn.count() > 0

  if (hasPrev && hasNext) {
    // Count rows on first page
    const rowsOnPage1 = await page.locator('tbody tr').count()
    log(rowsOnPage1 === 25 ? '✅' : '⚠️',
      `Page 1 shows ${rowsOnPage1} rows (expected 25)`)

    // Check "Page 1 of N" text
    const pageInfo = await page.locator('text=/Page \\d+ of \\d+/').first().innerText()
    log(pageInfo.includes('Page 1') ? '✅' : '❌', `Pagination info: "${pageInfo}"`)

    // Prev disabled on page 1
    const prevDisabled = await prevBtn.isDisabled()
    log(prevDisabled ? '✅' : '❌', `← Prev disabled on page 1: ${prevDisabled}`)

    // Click Next
    await nextBtn.click()
    await page.waitForTimeout(300)
    const rowsOnPage2 = await page.locator('tbody tr').count()
    log(rowsOnPage2 > 0 ? '✅' : '❌', `Page 2 shows ${rowsOnPage2} rows`)
    const pageInfo2 = await page.locator('text=/Page \\d+ of \\d+/').first().innerText()
    log(pageInfo2.includes('Page 2') ? '✅' : '❌', `After Next: "${pageInfo2}"`)

    // Prev now enabled
    const prevEnabled = !(await prevBtn.isDisabled())
    log(prevEnabled ? '✅' : '❌', `← Prev enabled on page 2: ${prevEnabled}`)
    await shot(page, '04_page2')

    // Click Prev → back to page 1
    await prevBtn.click()
    await page.waitForTimeout(300)
    const backPage = await page.locator('text=/Page \\d+ of \\d+/').first().innerText()
    log(backPage.includes('Page 1') ? '✅' : '❌', `After Prev: back to "${backPage}"`)
  } else {
    log('⚠️', 'Pagination not shown — query returned ≤25 rows; trying with all months query')
    // Try a query we know returns many rows
    await page.locator('textarea').fill('What is the total trips per day for the entire year 2023?')
    await page.locator('textarea').press('Enter')
    await waitDone(page)
    const hasPagination2 = await page.locator('button', { hasText: 'Next →' }).count() > 0
    log(hasPagination2 ? '✅' : '⚠️', `Pagination appears for 365-day query: ${hasPagination2}`)
    if (hasPagination2) {
      const rows2 = await page.locator('tbody tr').count()
      log(rows2 === 25 ? '✅' : '⚠️', `Page size = ${rows2}`)
    }
  }

  // ── TEST: empty state ──────────────────────────────────────────────────
  log('', '━━ Empty state (0 rows) ━━')
  // Patch App.jsx to inject empty result
  const APP = 'D:\\AI_ML\\Projects\\LLM-Powered-Text-to-SQL-Analytics-App\\frontend\\src\\App.jsx'
  const orig = readFileSync(APP, 'utf-8')
  const patched = orig
    .replace("const [columns, setColumns]             = useState([])",
             "const [columns, setColumns]             = useState(['col_a'])")
    .replace("const [rows, setRows]                   = useState([])",
             "const [rows, setRows]                   = useState([])")
    .replace("const [latencyMs, setLatencyMs]         = useState(0)",
             "const [latencyMs, setLatencyMs]         = useState(1234)")
  writeFileSync(APP, patched, 'utf-8')
  await page.waitForTimeout(2000)
  await page.reload({ waitUntil: 'networkidle' })

  const emptyText = await page.locator('text=No results returned').count()
  const zeroRow   = await page.locator('text=/0 rows returned/').count()
  log(emptyText > 0 ? '✅' : '❌', `Empty state "No results returned" visible: ${emptyText > 0}`)
  log(zeroRow > 0   ? '✅' : '❌', `"0 rows returned" in header: ${zeroRow > 0}`)
  await shot(page, '05_empty_state')
  writeFileSync(APP, orig, 'utf-8')

  // ── TEST: error state ──────────────────────────────────────────────────
  log('', '━━ Error state ━━')
  const origForError = readFileSync(APP, 'utf-8')
  const patchedErr = origForError
    .replace("const [error, setError]                 = useState(null)",
             "const [error, setError]                 = useState('relation \"bad_table\" does not exist')")
    .replace("const [columns, setColumns]             = useState([])",
             "const [columns, setColumns]             = useState(['col'])")
  writeFileSync(APP, patchedErr, 'utf-8')
  await page.waitForTimeout(2000)
  await page.reload({ waitUntil: 'networkidle' })

  const errorBox = await page.locator('text=Query error:').count()
  const errorMsg = await page.locator('text=bad_table').count()
  log(errorBox > 0 ? '✅' : '❌', `Error callout box visible: ${errorBox > 0}`)
  log(errorMsg > 0 ? '✅' : '❌', `Error message text shown: ${errorMsg > 0}`)
  await shot(page, '06_error_state')
  writeFileSync(APP, origForError, 'utf-8')

  // ── TEST: Export CSV button ────────────────────────────────────────────
  log('', '━━ Export CSV button ━━')
  await page.waitForTimeout(2000)
  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('textarea').waitFor({ timeout: SHORT })
  await page.locator('textarea').fill('What is the average fare amount by month?')
  await page.locator('textarea').press('Enter')
  await waitDone(page)

  const exportBtn = page.locator('button', { hasText: 'Export CSV' })
  const hasExport = await exportBtn.count() > 0
  log(hasExport ? '✅' : '❌', `Export CSV button present: ${hasExport}`)

  if (hasExport) {
    // Set up download listener
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 5000 }),
      exportBtn.click(),
    ])
    const filename = download.suggestedFilename()
    log(filename === 'results.csv' ? '✅' : '❌', `Download filename: "${filename}"`)

    // Read the CSV content
    const stream = await download.createReadStream()
    const chunks = []
    for await (const chunk of stream) chunks.push(chunk)
    const csv = Buffer.concat(chunks).toString('utf-8')
    const lines = csv.trim().split('\n')
    log(lines.length > 1 ? '✅' : '❌',
      `CSV has ${lines.length} lines (header + ${lines.length - 1} data rows)`)
    log('  ', `CSV header: ${lines[0]}`)
    log('  ', `CSV row 1:  ${lines[1]}`)
  }
  await shot(page, '07_export_csv')

  // ── Console errors ──────────────────────────────────────────────────────
  log('', '')
  if (errors.length === 0) {
    log('✅', 'No JavaScript console errors')
  } else {
    errors.forEach(e => log('❌', `Console error: ${e}`))
  }

  await browser.close()
  console.log(`\nScreenshots → frontend/${SS}/`)
})()
