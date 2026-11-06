import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src')
const localeRoot = path.join(root, 'locales')

function unwrap(node) {
  while (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node)) node = node.expression
  return node
}

function evaluate(node) {
  node = unwrap(node)
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  if (ts.isNumericLiteral(node)) return Number(node.text)
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false
  if (node.kind === ts.SyntaxKind.NullKeyword) return null
  if (ts.isIdentifier(node) && node.text === 'undefined') return null
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(evaluate)
  if (ts.isObjectLiteralExpression(node)) {
    return Object.fromEntries(node.properties.flatMap((property) => {
      if (ts.isPropertyAssignment(property)) {
        const key = property.name && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name) ? property.name.text : null)
        return key === null ? [] : [[key, evaluate(property.initializer)]]
      }
      if (ts.isShorthandPropertyAssignment(property)) return [[property.name.text, null]]
      return []
    }))
  }
  return null
}

function readExports(filename, wanted) {
  const source = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true)
  const found = {}
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement) || !statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && wanted.includes(declaration.name.text) && declaration.initializer) {
        found[declaration.name.text] = evaluate(declaration.initializer)
      }
    }
  }
  return found
}

function deepMerge(base, source) {
  if (typeof source === 'string' && source === '' && typeof base === 'string') return base
  if (Array.isArray(base) && Array.isArray(source)) {
    return Array.from({ length: Math.max(base.length, source.length) }, (_, index) => (
      index in source ? (index in base ? deepMerge(base[index], source[index]) : source[index]) : base[index]
    ))
  }
  if (!base || typeof base !== 'object' || Array.isArray(base) || !source || typeof source !== 'object' || Array.isArray(source)) return source
  return Object.fromEntries([...new Set([...Object.keys(base), ...Object.keys(source)])].map((key) => [
    key,
    key in source ? (key in base ? deepMerge(base[key], source[key]) : source[key]) : base[key],
  ]))
}

const nonTranslatableKeys = new Set([
  'amount', 'balance', 'bankName', 'captionsLabel', 'captionsSrc', 'className', 'expires', 'height', 'href', 'id', 'initials',
  'poster', 'productSlugs', 'slug', 'src', 'to', 'variable', 'width',
])

function stripLocaleData(value, parts = []) {
  if (Array.isArray(value)) return value.map((item, index) => stripLocaleData(item, [...parts, String(index)]))
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(Object.entries(value).flatMap(([key, child]) => {
    const path = [...parts, key].join('.')
    const moneyUiText = parts[0] === 'dashboard' && ['transfers', 'bills'].includes(parts[1])
    const designTokenField = parts[0] === 'design' && parts[1] === 'colorTokens' && ['dark', 'light'].includes(key)
    const designOnlyLabel = ['design.colorTokens.6.name', 'design.typographySamples.0.name'].includes(path)
    const rateValue = /^rates\.tabs\.\d+\.rows\.\d+$/.test(parts.join('.')) && key === 'rate'
    const cardNumber = path === 'hero.card.number'
    const stepNumber = /^steps\.items\.\d+\.number$/.test(path)
    const dashboardAccount = path === 'dashboardPreview.account.account'
    const numericValue = typeof child === 'number' || (typeof child === 'string' && /^\s*[-+]?\s*(?:[$€£]\s*)?\d[\d,.]*(?:\s*(?:K\+?|%|USD))?\s*$/i.test(child))
    const urlValue = typeof child === 'string' && /^(?:https?:\/\/|mailto:|#|\/)/i.test(child)
    if ((!moneyUiText && nonTranslatableKeys.has(key)) || designTokenField || designOnlyLabel || rateValue || cardNumber || stepNumber || dashboardAccount || numericValue || urlValue) return []
    return [[key, stripLocaleData(child, [...parts, key])]]
  }))
}

const landing = readExports(path.join(root, 'content/landing.ts'), ['landingContent']).landingContent
const publicContent = readExports(path.join(root, 'content/public-pages.ts'), [
  'aboutContent', 'audienceContent', 'productDetails', 'securityPageContent', 'faqCategories', 'blogPosts', 'legalPages',
])
const commonContent = {
  authPitch: readExports(path.join(root, 'content/auth.ts'), ['authPitch']).authPitch,
  navigation: {
    primaryLabel: 'Primary navigation',
    ...readExports(path.join(root, 'content/navigation.ts'), ['primaryLinks', 'footerColumns']),
  },
}
const pagesContent = {
  about: publicContent.aboutContent,
  audiences: publicContent.audienceContent,
  products: publicContent.productDetails,
  security: publicContent.securityPageContent,
  faq: publicContent.faqCategories,
  blog: publicContent.blogPosts,
  legal: publicContent.legalPages,
  images: readExports(path.join(root, 'content/images.ts'), ['imageSlots']).imageSlots,
  design: readExports(path.join(root, 'content/design-system.ts'), ['colorTokens', 'typographySamples']),
}

const sourceNamespaces = { landing, pages: pagesContent }
for (const [namespace, data] of Object.entries(sourceNamespaces)) {
  const englishFile = path.join(localeRoot, 'en', `${namespace}.json`)
  const previous = JSON.parse(fs.readFileSync(englishFile, 'utf8'))
  fs.writeFileSync(englishFile, `${JSON.stringify(stripLocaleData(deepMerge(previous, data)), null, 2)}\n`)
}

const commonFile = path.join(localeRoot, 'en', 'common.json')
const previousCommon = JSON.parse(fs.readFileSync(commonFile, 'utf8'))
const mergedCommon = deepMerge(previousCommon, commonContent)
mergedCommon.authPitch = previousCommon.authPitch
fs.writeFileSync(commonFile, `${JSON.stringify(stripLocaleData(mergedCommon), null, 2)}\n`)

const english = Object.fromEntries(['common', 'landing', 'pages', 'admin'].map((namespace) => [
  namespace,
  JSON.parse(fs.readFileSync(path.join(localeRoot, 'en', `${namespace}.json`), 'utf8')),
]))
for (const entry of fs.readdirSync(localeRoot, { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name === 'en') continue
  for (const namespace of Object.keys(english)) {
    const destination = path.join(localeRoot, entry.name, `${namespace}.json`)
    if (namespace === 'admin') {
      fs.mkdirSync(path.dirname(destination), { recursive: true })
      fs.writeFileSync(destination, '{}\n')
      continue
    }
    const locale = fs.existsSync(destination) ? JSON.parse(fs.readFileSync(destination, 'utf8')) : {}
    const merged = deepMerge(english[namespace], locale)
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    fs.writeFileSync(destination, `${JSON.stringify(merged, null, 2)}\n`)
  }
}

console.log('Synchronized English content namespaces, filled locale placeholders, and configured admin namespace fallback.')