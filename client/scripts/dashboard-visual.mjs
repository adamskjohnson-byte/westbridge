import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const screenshotDirectory = path.resolve(scriptDirectory, '../../qa-screenshots')
const baseUrl = process.env.I18N_VISUAL_URL ?? 'http://127.0.0.1:5173'
const email = process.env.I18N_CRAWL_EMAIL
const password = process.env.I18N_CRAWL_PASSWORD
const languages = ['en', 'ar']
const widths = [360, 1280]

if (!email || !password) throw new Error('Set I18N_CRAWL_EMAIL and I18N_CRAWL_PASSWORD for dashboard screenshots.')
await mkdir(screenshotDirectory, { recursive: true })
const browser = await chromium.launch({ headless: true })
const issues = []

try {
  for (const language of languages) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' })
    await context.addInitScript((code) => localStorage.setItem('westbridge.lang', code), language)
    const page = await context.newPage()
    page.on('pageerror', (error) => issues.push(`${language}: ${error.message}`))
    await page.goto(new URL('/login', baseUrl).toString(), { waitUntil: 'domcontentloaded' })
    await page.locator('#login-email').fill(email)
    await page.locator('#login-password').fill(password)
    await page.locator('form button[type="submit"]').click()
    await page.waitForURL((url) => new URL(url).pathname.startsWith('/dashboard'), { timeout: 15000 })
    await page.locator('#dashboard-main').waitFor({ state: 'visible', timeout: 15000 })
    await page.locator('#cash-flow-title').waitFor({ state: 'visible', timeout: 15000 })
    await page.evaluate(() => document.fonts.ready)

    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 })
      await page.waitForTimeout(200)
      const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
      if (hasOverflow) issues.push(`${language} @ ${width}px: horizontal page overflow`)
      const filename = path.join(screenshotDirectory, `dashboard-${language}-${width}.png`)
      await page.screenshot({ path: filename, fullPage: true, animations: 'disabled' })
      console.log(`Captured ${filename}`)
    }
    await context.close()
  }
} finally {
  await browser.close()
}

if (issues.length) {
  for (const issue of issues) console.error(issue)
  process.exitCode = 1
} else {
  console.log('Dashboard screenshots captured with no browser errors or horizontal overflow.')
}
