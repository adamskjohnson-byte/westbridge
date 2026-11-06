import { chromium } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const allowlistPath = path.join(__dirname, 'i18n-allowlist.json')
const allowlist = JSON.parse(await readFile(allowlistPath, 'utf8'))
const baseUrl = process.env.I18N_CRAWL_URL ?? 'http://127.0.0.1:5173'
const scope = process.argv.find((argument) => argument.startsWith('--scope='))?.split('=')[1] ?? 'all'
const language = process.env.I18N_CRAWL_LANGUAGE ?? (scope === 'area-f' ? 'es' : 'pseudo')
const requestedRoute = process.argv.find((argument) => argument.startsWith('--route='))?.split('=').slice(1).join('=')

const routes = [
  '/',
  '/about',
  '/personal',
  '/business',
  '/products',
  '/loans',
  '/rates',
  '/security',
  '/faq',
  '/contact',
  '/blog',
  '/privacy',
  '/terms',
  '/cookies',
  '/photo-credits',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password?token=crawl&email=demo%40example.test',
  '/verify-notice',
  '/verify-email',
  '/admin',
  '/admin/users',
  '/admin/transactions',
  '/admin/support',
  '/admin/audit',
  '/dashboard',
  '/dashboard/transactions?q=groc&direction=credit&category=card',
  '/dashboard/transfers',
  '/dashboard/bills',
  '/dashboard/cards',
  '/dashboard/insights',
  '/dashboard/notifications',
  '/dashboard/settings',
  '/dashboard/settings?tab=profile',
  '/dashboard/settings?tab=security',
  '/dashboard/settings?tab=preferences',
  '/404-crawl-probe',
]
const areaERoutes = new Set([
  '/about', '/personal', '/business', '/products', '/loans', '/rates', '/security',
  '/faq', '/contact', '/blog', '/privacy', '/terms', '/cookies', '/photo-credits',
])
const areaGRoutes = new Set(['/login', '/register', '/forgot-password', '/reset-password', '/verify-notice', '/verify-email', '/admin', '/admin/users', '/admin/transactions', '/admin/support', '/admin/audit', '/dashboard', '/dashboard/transactions', '/dashboard/transfers', '/dashboard/bills', '/dashboard/cards', '/dashboard/insights', '/dashboard/notifications', '/dashboard/settings'])
const crawlRoutes = (scope === 'area-f' ? ['/'] : routes).filter((route) => {
  if (language !== 'en' && new URL(route, baseUrl).pathname.startsWith('/admin')) return false
  if (!requestedRoute) return true
  return new URL(route, `${baseUrl}/`).pathname === requestedRoute
})
const crawlEmail = process.env.I18N_CRAWL_EMAIL
const crawlPassword = process.env.I18N_CRAWL_PASSWORD
const adminEmail = process.env.I18N_CRAWL_ADMIN_EMAIL ?? crawlEmail
const adminPassword = process.env.I18N_CRAWL_ADMIN_PASSWORD ?? crawlPassword
const hasProtectedRoute = crawlRoutes.some((route) => new URL(route, baseUrl).pathname.startsWith('/dashboard'))
const hasAdminRoute = crawlRoutes.some((route) => new URL(route, baseUrl).pathname.startsWith('/admin'))
if (hasProtectedRoute && (!crawlEmail || !crawlPassword)) {
  throw new Error('Set I18N_CRAWL_EMAIL and I18N_CRAWL_PASSWORD to crawl authenticated dashboard pages.')
}
if (hasAdminRoute && (!adminEmail || !adminPassword)) {
  throw new Error('Set I18N_CRAWL_ADMIN_EMAIL and I18N_CRAWL_ADMIN_PASSWORD to crawl admin pages in English.')
}

function normalizeText(value) {
  return String(value).replace(/\s+/g, ' ').trim()
}

function collectStrings(value, strings = new Set()) {
  if (typeof value === 'string') strings.add(normalizeText(value))
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, strings))
  else if (value && typeof value === 'object') Object.values(value).forEach((item) => collectStrings(item, strings))
  return strings
}

const englishStrings = language === 'pseudo' || language === 'en'
  ? new Set()
  : new Set((await Promise.all(['common', 'landing', 'pages', 'admin'].map(async (namespace) => (
    JSON.parse(await readFile(path.join(__dirname, `../src/locales/en/${namespace}.json`), 'utf8'))
  )))).flatMap((resource) => [...collectStrings(resource)]))

function isAllowed(value, route) {
  const normalized = normalizeText(value)
  if (!normalized) return true

  if (allowlist.routes?.[route]?.includes(normalized)) return true

  return allowlist.patterns.some((pattern) => new RegExp(pattern, 'i').test(normalized))
}

function dedupe(values) {
  return [...new Set(values.filter((value) => value && value.trim().length > 1))]
}

function hasUnwrappedText(value) {
  const outsidePseudo = value.replace(/⟦[^⟧]*⟧/gu, '')
  return /[\p{L}]{2,}/u.test(outsidePseudo)
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } })
await page.route('**/*', (requestRoute) => {
  if (scope === 'area-f' && requestRoute.request().url().endsWith('/src/main.tsx')) {
    return requestRoute.abort()
  }
  const resourceType = requestRoute.request().resourceType()
  if (language !== 'pseudo' && requestRoute.request().method() === 'GET'
    && new URL(requestRoute.request().url()).pathname.endsWith('/api/v1/settings')) {
    return requestRoute.fetch().then(async (response) => {
      const body = await response.json()
      if (body.data?.preferences) body.data.preferences.locale = null
      return requestRoute.fulfill({ response, json: body })
    })
  }
  if (['image', 'media', 'font'].includes(resourceType)) {
    return requestRoute.abort()
  }
  return requestRoute.continue()
})
await page.addInitScript((language) => {
  try {
    window.localStorage.setItem('westbridge.lang', language)
  } catch {
    return
  }
}, language)
const results = []
let authenticated = false
let authenticatedAs = null

for (const route of crawlRoutes) {
  const url = new URL(route, `${baseUrl}/`).toString()
  try {
    const isAdminRoute = new URL(route, baseUrl).pathname.startsWith('/admin')
    const routeRole = isAdminRoute ? 'admin' : 'customer'
    if ((!authenticated || (isAdminRoute && authenticatedAs !== 'admin')) && (new URL(route, baseUrl).pathname.startsWith('/dashboard') || isAdminRoute)) {
      await page.goto(new URL('/login', baseUrl).toString(), { waitUntil: 'domcontentloaded', timeout: 30000 })
      await page.locator('#login-email').waitFor({ state: 'visible', timeout: 10000 })
      await page.locator('#login-email').fill(isAdminRoute ? adminEmail : crawlEmail)
      await page.locator('#login-password').fill(isAdminRoute ? adminPassword : crawlPassword)
      await page.locator('form button[type="submit"]').click()
      await page.waitForURL((candidate) => new URL(candidate).pathname.startsWith('/dashboard'), { timeout: 15000 })
      authenticated = true
      authenticatedAs = routeRole
    }
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    if (scope === 'area-f') {
      await page.locator('#app-loader-label').waitFor({ state: 'attached', timeout: 30000 })
      await page.waitForFunction(() => document.querySelector('#app-loader-label')?.textContent !== 'Loading Westbridge National Bank', undefined, { timeout: 30000 })
    } else {
      await page.locator('main').first().waitFor({ state: 'attached', timeout: 30000 })
      await page.waitForFunction((expectedLanguage) => document.documentElement.lang === expectedLanguage && !document.body.innerText.includes('Loading Westbridge National Bank'), language, { timeout: 30000 })
    }
    if (scope === 'area-g' && areaGRoutes.has(new URL(route, baseUrl).pathname)) {
      await page.waitForFunction(() => [...document.querySelectorAll('main')].some((main) => !main.getAttribute('aria-busy')), undefined, { timeout: 30000 })
    }
    if (scope === 'area-b' && route === '/') {
      await page.waitForFunction(() => document.querySelector('#hero h1')?.textContent?.startsWith('⟦') === true, undefined, { timeout: 30000 })
    }
  } catch (error) {
    console.log(`Route ${route}: page failed to load (${error.message})`)
    results.push({ route, issues: ['page failed to load'] })
    continue
  }

  const values = await page.evaluate(({ route, scope, isAreaERoute, isAreaGRoute }) => {
    const normalizeText = (value) => String(value).replace(/\s+/g, ' ').trim()
    const seen = new Set()
    const rootsByScope = {
      'area-a': [...document.querySelectorAll('header.site-navbar, footer, .skip-link, [data-sonner-toaster]'), ...(route === '/404-crawl-probe' ? [document.querySelector('main')] : [])],
      'area-b': [...document.querySelectorAll('#hero, #trust, #video-showcase')],
      'area-c': [...document.querySelectorAll('#products, #why-westbridge, #dashboard-preview, #how-it-works, #calculators, #rates')],
      'area-d': [...document.querySelectorAll('#security, #mobile-app, #testimonials, #blog, #faq, #contact, #newsletter')],
      'area-e': isAreaERoute ? [document.querySelector('main')] : [],
      'area-f': [document.querySelector('#app-loader')],
      'area-g': isAreaGRoute ? [...document.querySelectorAll('main, .auth-surface')] : [],
    }
    const roots = scope === 'all' ? [document.body] : (rootsByScope[scope] ?? []).filter(Boolean)

    for (const root of roots) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      let node
      while ((node = walker.nextNode())) {
        const parent = node.parentElement
        if (!parent || parent.closest('script, style, noscript, [hidden], [aria-hidden="true"]')) continue
        const style = getComputedStyle(parent)
        if (style.display === 'none' || style.visibility === 'hidden') continue
        const text = normalizeText(node.textContent ?? '')
        if (text) seen.add(text)
      }

      for (const element of [root, ...root.querySelectorAll('*')]) {
        for (const attribute of ['aria-label', 'title', 'alt', 'placeholder']) {
          const value = normalizeText(element.getAttribute(attribute) ?? '')
          if (value) seen.add(value)
        }
      }
    }

    if (scope === 'area-e') {
      const title = normalizeText(document.title).replace(/\s+\|\s+Westbridge National Bank$/, '')
      const description = normalizeText(document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '')
      if (title) seen.add(title)
      if (description) seen.add(description)
    }

    return [...seen]
  }, {
    route,
    scope,
    isAreaERoute: areaERoutes.has(route),
    isAreaGRoute: areaGRoutes.has(new URL(route, baseUrl).pathname),
  })

  const candidates = dedupe(values)
    .filter((value) => value.length > 2)
    .filter((value) => !/^(https?:|mailto:|#|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})$/i.test(value))
    .filter((value) => !isAllowed(value, route))
    .filter((value) => scope === 'area-f'
      ? value === 'Loading Westbridge National Bank'
      : language === 'pseudo'
        ? hasUnwrappedText(value)
        : language !== 'en' && englishStrings.has(value))

  results.push({ route, issues: candidates })
  console.log(`Route ${route} (${language}, ${scope}): ${candidates.length} issue(s)`)
  if (candidates.length > 0) {
    for (const issue of candidates) {
      console.log(`  - ${issue}`)
    }
  }
}

await browser.close()
console.log('\nSummary:')
for (const result of results) {
  if (result.issues.length === 0) {
    console.log(`${result.route} (${language}, ${scope}) -> no untranslated user-visible strings detected`)
  } else {
    console.log(`${result.route} (${language}, ${scope}) -> ${result.issues.length} string(s): ${result.issues.join(' | ')}`)
  }
}
