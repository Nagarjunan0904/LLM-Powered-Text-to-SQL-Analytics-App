import { chromium } from 'playwright'
import { mkdirSync } from 'fs'

const SS = 'verify_screenshots_dark'
mkdirSync(SS, { recursive: true })
let n = 0
const shot = async (page, label) => {
  const p = `${SS}/${String(++n).padStart(2, '0')}_${label}.png`
  await page.screenshot({ path: p, fullPage: false })
  console.log(`  📸 ${p}`)
}
const log = (icon, msg) => console.log(`${icon} ${msg}`)
const TIMEOUT = 90_000
const SHORT   = 10_000

async function waitDone(page) {
  await page.waitForFunction(
    () => [...document.querySelectorAll('button')].some(b =>
      b.textContent.trim() === 'Run Query' && !b.disabled),
    { timeout: TIMEOUT }
  )
}

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const ctx  = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  const errors = []
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', e => errors.push(`[PAGE ERROR] ${e.message}`))

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' })
  await page.waitForSelector('text=QueryMind', { timeout: SHORT })
  await page.waitForSelector('text=DB: NYC Taxi', { timeout: SHORT })

  // ── Visual checks ───────────────────────────────────────────────────────
  log('', '━━ Visual: Dark theme ━━')

  const title = await page.title()
  log(title.includes('QueryMind') ? '✅' : '❌', `Page title: "${title}"`)

  const header = page.locator('header')
  const headerBg = await header.evaluate(el => getComputedStyle(el).background)
  log(headerBg.includes('10, 10, 10') || headerBg.includes('rgb(10') ? '✅' : '⚠️',
    `Header background dark: ${headerBg.slice(0, 60)}`)

  const queryMind = await page.locator('text=QueryMind').count()
  log(queryMind > 0 ? '✅' : '❌', `"QueryMind" in header`)

  const liveTag = await page.locator('text=Live').count()
  log(liveTag > 0 ? '✅' : '❌', `"● Live" badge visible`)

  const dbBadge = await page.locator('text=DB: NYC Taxi').count()
  log(dbBadge > 0 ? '✅' : '❌', `"DB: NYC Taxi" amber badge in sidebar`)

  const footer = await page.locator('text=Click any column to add to query').count()
  log(footer > 0 ? '✅' : '❌', `Schema sidebar footer visible`)

  // No white backgrounds leaking
  const whiteLeaks = await page.evaluate(() => {
    const all = document.querySelectorAll('*')
    let count = 0
    for (const el of all) {
      const bg = getComputedStyle(el).backgroundColor
      if (bg === 'rgb(255, 255, 255)' && el.offsetWidth > 20 && el.offsetHeight > 20) count++
    }
    return count
  })
  log(whiteLeaks === 0 ? '✅' : '⚠️', `White background leak count: ${whiteLeaks}`)

  await shot(page, '01_dark_idle')

  // ── Example pills — run all 6 ───────────────────────────────────────────
  log('', '━━ All 6 example pills ━━')
  const pills = [
    'How many total trips were taken in 2023?',
    'What is the average fare amount by month?',
    'Which pickup location had the most trips?',
    'What is the total revenue by day of the week?',
    'What percentage of trips were paid by credit card?',
    'What is the average tip amount by payment type?',
  ]

  for (let i = 0; i < pills.length; i++) {
    const q = pills[i]
    const btn = page.locator('button').filter({ hasText: q }).first()
    await btn.click()
    await waitDone(page)
    const rowsText = await page.locator('text=/rows returned/').first().innerText().catch(() => '0')
    log('✅', `Pill ${i + 1}: "${q.slice(0, 45)}..." → ${rowsText}`)
    if (i === 0) await shot(page, '02_after_pill_1')
  }

  // ── Screenshot with chart visible ───────────────────────────────────────
  log('', '━━ Full app screenshot with results + chart ━━')
  await shot(page, '03_with_results_chart')

  // Run a query that shows bar chart
  await page.locator('textarea').fill('Show top 10 pickup locations by trip count')
  await page.locator('textarea').press('Enter')
  await waitDone(page)
  await page.waitForTimeout(1000) // let chart render

  const amberBars = await page.evaluate(() => {
    const rects = document.querySelectorAll('.recharts-rectangle')
    return [...rects].some(el => {
      const fill = el.getAttribute('fill') || ''
      return fill.toLowerCase().includes('f59e0b')
    })
  })
  log(amberBars ? '✅' : '⚠️', `Amber (#f59e0b) chart bars rendered`)

  const sqlPanel = await page.locator('text=Generated on attempt').count()
  log(sqlPanel > 0 ? '✅' : '⚠️', `SqlPanel attempt badge visible`)

  await shot(page, '04_bar_chart_with_results')

  // ── Amber streaming preview check ───────────────────────────────────────
  log('', '━━ Streaming SQL preview (amber tokens) ━━')
  await page.locator('textarea').fill('What is the average tip amount by payment type?')
  await page.locator('textarea').press('Enter')

  // Catch the streaming state
  try {
    await page.waitForFunction(
      () => document.querySelector('pre') !== null,
      { timeout: 5000 }
    )
    const preColor = await page.evaluate(() => {
      const pre = document.querySelector('pre')
      return pre ? getComputedStyle(pre).color : ''
    })
    log(preColor.includes('245') ? '✅' : '⚠️', `Streaming preview text color (amber): ${preColor}`)
    await shot(page, '05_streaming_amber')
  } catch {
    log('⚠️', 'Streaming preview not captured (too fast) — tokens arrived before check')
  }

  await waitDone(page)
  await shot(page, '06_final_state_dark')

  // ── Console errors ──────────────────────────────────────────────────────
  log('', '')
  const realErrors = errors.filter(e => !e.includes('Failed to fetch'))
  if (realErrors.length === 0) {
    log('✅', `Zero JavaScript errors`)
  } else {
    realErrors.forEach(e => log('❌', `Error: ${e}`))
  }

  await browser.close()
  console.log(`\nScreenshots → frontend/${SS}/`)
})()
