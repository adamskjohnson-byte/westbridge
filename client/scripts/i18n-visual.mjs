import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const screenshotDirectory = path.resolve(scriptDirectory, '../../qa-screenshots')
const baseUrl = process.env.I18N_VISUAL_URL ?? 'http://127.0.0.1:5173'
const routes = ['/', '/about', '/contact', '/login', '/register', '/faq', '/rates']
const viewports = [360, 1280]
const issues = []

await mkdir(screenshotDirectory, { recursive: true })
const browser = await chromium.launch({ headless: true })

try {
  for (const width of viewports) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 })
    const pageErrors = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await page.addInitScript(() => window.localStorage.setItem('westbridge.lang', 'ar'))

    for (const route of routes) {
      const url = new URL(route, `${baseUrl}/`).toString()
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
        await page.locator('main').first().waitFor({ state: 'attached', timeout: 15000 })
        await page.waitForFunction(() => document.documentElement.lang === 'ar' && !document.body.innerText.includes('Loading Westbridge National Bank'), undefined, { timeout: 15000 })
        await page.locator('#app-loader').waitFor({ state: 'detached', timeout: 15000 })
        await page.evaluate(async () => {
          await document.fonts.ready
          for (let position = 0; position < document.body.scrollHeight; position += window.innerHeight) {
            window.scrollTo({ top: position, behavior: 'instant' })
            await new Promise((resolve) => requestAnimationFrame(() => resolve()))
            await new Promise((resolve) => setTimeout(resolve, 80))
          }
          await new Promise((resolve) => setTimeout(resolve, 700))
          window.scrollTo({ top: 0, behavior: 'instant' })
        })

        const diagnostics = await page.evaluate(() => {
          const visible = (element) => {
            const rect = element.getBoundingClientRect()
            const style = getComputedStyle(element)
            return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
          }
          const clipped = [...document.querySelectorAll('body *')]
            .filter((element) => visible(element) && element.textContent?.trim() && !element.matches('svg, path, script, style, video, [role="img"], .sr-only, .truncate, .line-clamp-1, .line-clamp-2'))
            .filter((element) => !element.closest('.hero-card-stage, [aria-roledescription="carousel"]'))
            .filter((element) => {
              const style = getComputedStyle(element)
              if (style.textOverflow === 'ellipsis') return false
              const hidesInline = ['hidden', 'clip'].includes(style.overflowX)
              const hidesBlock = ['hidden', 'clip'].includes(style.overflowY)
              return (hidesInline && element.scrollWidth > element.clientWidth + 2)
                || (hidesBlock && element.scrollHeight > element.clientHeight + 2)
            })
            .slice(0, 8)
            .map((element) => `${element.tagName.toLowerCase()}.${String(element.className?.baseVal ?? element.className ?? '').toString().trim().split(/\s+/u).slice(0, 2).join('.')}: ${element.textContent.trim().replace(/\s+/gu, ' ').slice(0, 60)}`)
          const logo = document.querySelector('.site-navbar a[aria-label]')
          const logoRect = logo?.getBoundingClientRect()
          const navbarPresent = Boolean(document.querySelector('.site-navbar'))
          const visibleElement = (element) => {
            if (!element) return false
            const rect = element.getBoundingClientRect()
            const style = getComputedStyle(element)
            return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
          }
          const registerAction = [...document.querySelectorAll('.site-navbar a[href="/register"]')].find(visibleElement)
          const mobileMenuAction = document.querySelector('.site-navbar button[aria-controls="mobile-navigation"]')
          const action = registerAction ?? mobileMenuAction
          const actionRect = action?.getBoundingClientRect()
          const missingGlyphs = []
          const textWalker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
          let textNode
          while ((textNode = textWalker.nextNode())) {
            const parent = textNode.parentElement
            if (!parent || !visibleElement(parent) || parent.closest('script, style, noscript, [hidden], [aria-hidden="true"], .sr-only')) continue
            if (/[\u25A1\u25AF\u25FB-\u25FE\uFFFD]/u.test(textNode.textContent ?? '')) {
              missingGlyphs.push((textNode.textContent ?? '').trim().slice(0, 60))
            }
          }
          const fontLoaded = document.fonts.check('16px "Noto Sans Arabic"', 'مرحبا بالعالم')
          return {
            lang: document.documentElement.lang,
            dir: document.documentElement.dir,
            overflow: document.documentElement.scrollWidth > window.innerWidth,
            clipped,
            navbarPresent,
            logoOnInlineStart: Boolean(logoRect && logoRect.left + logoRect.width / 2 > window.innerWidth / 2),
            actionOnInlineEnd: Boolean(actionRect && actionRect.left + actionRect.width / 2 < window.innerWidth / 2),
            missingGlyphs,
            fontLoaded,
          }
        })

        const filename = `${route === '/' ? 'home' : route.slice(1).replaceAll('/', '-')}-${width}.png`
        await page.screenshot({ path: path.join(screenshotDirectory, `ar-${filename}`), fullPage: true, animations: 'disabled' })

        const routeIssues = []
        if (diagnostics.lang !== 'ar' || diagnostics.dir !== 'rtl') routeIssues.push(`expected lang=ar dir=rtl, got ${diagnostics.lang}/${diagnostics.dir}`)
        if (diagnostics.overflow) routeIssues.push('horizontal page overflow')
        if (diagnostics.navbarPresent && !diagnostics.logoOnInlineStart) routeIssues.push('navbar logo is not on the RTL inline-start')
        if (diagnostics.navbarPresent && !diagnostics.actionOnInlineEnd) routeIssues.push('navbar actions are not on the RTL inline-end')
        if (!diagnostics.fontLoaded) routeIssues.push('Noto Sans Arabic did not load for Arabic text')
        if (diagnostics.clipped.length) routeIssues.push(`possible clipped text: ${diagnostics.clipped.join(' | ')}`)
        if (diagnostics.missingGlyphs.length) routeIssues.push(`possible missing-glyph boxes: ${diagnostics.missingGlyphs.join(' | ')}`)
        if (pageErrors.length) routeIssues.push(`browser errors: ${pageErrors.join(' | ')}`)

        if (width === 360) {
          const menuButton = page.locator('.site-navbar button[aria-controls="mobile-navigation"]')
          if (await menuButton.count()) {
            await menuButton.click()
            const panel = page.locator('#mobile-navigation')
            await panel.waitFor({ state: 'visible', timeout: 3000 })
            const panelBox = await panel.boundingBox()
            if (!panelBox || panelBox.x < 0 || panelBox.x + panelBox.width > width) routeIssues.push('mobile navigation panel is misplaced or clipped')
            await page.screenshot({ path: path.join(screenshotDirectory, `ar-${route === '/' ? 'home' : route.slice(1)}-${width}-menu.png`), fullPage: true, animations: 'disabled' })
          }
        }

        if (routeIssues.length) {
          issues.push({ route, width, details: routeIssues })
          console.log(`FAIL ${route} @ ${width}px: ${routeIssues.join('; ')}`)
          if (diagnostics.clipped.length) console.log(`  clipped candidates: ${diagnostics.clipped.join(' | ')}`)
        } else {
          console.log(`PASS ${route} @ ${width}px`)
        }
      } catch (error) {
        issues.push({ route, width, details: [error.message] })
        console.log(`FAIL ${route} @ ${width}px: ${error.message}`)
      }
    }
    await page.close()
  }
} finally {
  await browser.close()
}

console.log(`\nScreenshots: ${screenshotDirectory}`)
console.log(`Visual QA: ${issues.length ? `${issues.length} route/viewport issue(s)` : 'all checks passed'}`)
if (issues.length) process.exitCode = 1