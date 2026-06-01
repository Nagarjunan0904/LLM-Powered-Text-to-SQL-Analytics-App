/**
 * Targeted fixup verification for:
 * 1. Export CSV button (inject state to avoid POST-fetch race)
 * 2. Confirm sort works when columns are loaded
 */
import { chromium } from 'playwright'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'

const SS = 'verify_screenshots_results'
mkdirSync(SS, { recursive: true })
let n = 10
const shot = async (page, label) => {
  const p = `${SS}/${String(++n).padStart(2,'0')}_${label}.png`
  await page.screenshot({ path: p })
  console.log(`  📸 ${p}`)
}
const log = (icon, msg) => console.log(`${icon} ${msg}`)

const APP = 'D:\\AI_ML\\Projects\\LLM-Powered-Text-to-SQL-Analytics-App\\frontend\\src\\App.jsx'
const SHORT = 8_000

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const ctx  = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  const page = await ctx.newPage()
  const errors = []
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', e => errors.push(`[PAGE ERROR] ${e.message}`))

  // ── Inject 15 rows of data to verify export + pagination-less table ────
  log('', '━━ Export CSV (state-injected rows) ━━')
  const orig = readFileSync(APP, 'utf-8')

  const ROWS = JSON.stringify(
    Array.from({ length: 15 }, (_, i) => [i + 1, `Location ${i + 1}`, (1000 - i * 30)])
  )

  const patched = orig
    .replace("const [columns, setColumns]             = useState([])",
             "const [columns, setColumns]             = useState(['rank','location','trips'])")
    .replace("const [rows, setRows]                   = useState([])",
             `const [rows, setRows]                   = useState(${ROWS})`)
    .replace("const [latencyMs, setLatencyMs]         = useState(0)",
             "const [latencyMs, setLatencyMs]         = useState(2847)")

  writeFileSync(APP, patched, 'utf-8')
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  await shot(page, 'export_state_injected')

  // Confirm header bar: "15 rows returned in 2847ms"
  const header = await page.locator('text=rows returned').first().innerText()
  log(/15 rows returned in 2847ms/.test(header) ? '✅' : '❌',
    `Header: "${header}"`)

  // Confirm no pagination (15 < 25)
  const hasPag = await page.locator('button', { hasText: '← Prev' }).count() > 0
  log(!hasPag ? '✅' : '⚠️', `No pagination for 15 rows: ${!hasPag}`)

  // Confirm sort on 3 columns
  const ths = page.locator('thead th')
  const thCount = await ths.count()
  log(thCount === 3 ? '✅' : '❌', `3 column headers rendered: ${thCount}`)

  // Sort by 'trips' (col index 2) — descending by default data, clicking asc first
  await ths.nth(2).click()
  const sortAsc = await ths.nth(2).innerText()
  log(sortAsc.includes('↑') ? '✅' : '❌', `Clicking trips col → ↑ asc: ${sortAsc.includes('↑')}`)

  // First cell in trips column should now be lowest (1) in asc order
  const firstTripsCell = await page.locator('tbody tr:first-child td:nth-child(3)').innerText()
  log(firstTripsCell === '580' ? '✅' : '⚠️',  // 1000 - 14*30 = 580 (smallest)
    `Asc sort: first trips value = ${firstTripsCell} (expected 580)`)

  // Toggle to desc
  await ths.nth(2).click()
  const sortDesc = await ths.nth(2).innerText()
  log(sortDesc.includes('↓') ? '✅' : '❌', `Second click → ↓ desc: ${sortDesc.includes('↓')}`)

  const firstTripsDesc = await page.locator('tbody tr:first-child td:nth-child(3)').innerText()
  log(firstTripsDesc === '1000' ? '✅' : '⚠️',
    `Desc sort: first trips value = ${firstTripsDesc} (expected 1000)`)
  await shot(page, 'sort_descending')

  // ── Export CSV ─────────────────────────────────────────────────────────
  const exportBtn = page.locator('button', { hasText: 'Export CSV' })
  const hasExport = await exportBtn.count() > 0
  log(hasExport ? '✅' : '❌', `Export CSV button visible: ${hasExport}`)

  if (hasExport) {
    const [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 5000 }),
      exportBtn.click(),
    ])
    const filename = dl.suggestedFilename()
    log(filename === 'results.csv' ? '✅' : '❌', `Filename: "${filename}"`)

    const stream = await dl.createReadStream()
    const chunks = []
    for await (const chunk of stream) chunks.push(chunk)
    const csv = Buffer.concat(chunks).toString('utf-8')
    const lines = csv.trim().split('\n')
    log(lines[0] === 'rank,location,trips' ? '✅' : '❌',
      `CSV header row: "${lines[0]}"`)
    log(lines.length === 16 ? '✅' : '❌',  // 1 header + 15 data
      `CSV has ${lines.length} lines (expected 16)`)
    // Data rows should be in desc sort order (trips descending)
    log(lines[1].includes('1000') ? '✅' : '❌',
      `CSV row 1 (desc sort): "${lines[1]}"`)
    log('  ', `CSV preview:\n  ${lines.slice(0, 4).join('\n  ')}`)
  }
  await shot(page, 'export_csv_done')

  // ── Pagination with 60 injected rows ───────────────────────────────────
  log('', '━━ Pagination with 60 rows ━━')
  const ROWS60 = JSON.stringify(
    Array.from({ length: 60 }, (_, i) => [i + 1, `Zone ${i + 1}`, i * 1000])
  )
  const patchPag = orig
    .replace("const [columns, setColumns]             = useState([])",
             "const [columns, setColumns]             = useState(['id','zone','trips'])")
    .replace("const [rows, setRows]                   = useState([])",
             `const [rows, setRows]                   = useState(${ROWS60})`)
    .replace("const [latencyMs, setLatencyMs]         = useState(0)",
             "const [latencyMs, setLatencyMs]         = useState(4100)")
  writeFileSync(APP, patchPag, 'utf-8')
  await page.waitForTimeout(1500)
  await page.reload({ waitUntil: 'networkidle' })

  const rowsP1 = await page.locator('tbody tr').count()
  log(rowsP1 === 25 ? '✅' : '❌', `Page 1 shows ${rowsP1} rows (expected 25)`)

  const pageInfo = await page.locator('text=/Page 1 of/').first().innerText()
  log(pageInfo.includes('Page 1 of 3') ? '✅' : '❌', `Page info: "${pageInfo.trim()}"`)

  const prevDis = await page.locator('button', { hasText: '← Prev' }).isDisabled()
  log(prevDis ? '✅' : '❌', `← Prev disabled on page 1: ${prevDis}`)

  await page.locator('button', { hasText: 'Next →' }).click()
  await page.waitForTimeout(200)
  const page2Info = await page.locator('text=/Page 2 of/').first().innerText()
  log(page2Info.includes('Page 2 of 3') ? '✅' : '❌', `After Next: "${page2Info.trim()}"`)
  await shot(page, 'pagination_page2_of_3')

  // Restore
  writeFileSync(APP, orig, 'utf-8')
  log('  ', 'App.jsx restored')

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
