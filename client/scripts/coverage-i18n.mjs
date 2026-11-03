import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const localesDir = path.resolve(scriptDir, '../src/locales')
const englishDir = path.join(localesDir, 'en')
const args = process.argv.slice(2)
const requestedLanguage = args.find((argument) => argument.startsWith('--language='))?.split('=')[1]
const showDetails = args.includes('--details')
const writeEnabledLanguages = args.includes('--write-enabled')
const enabledLanguagesPath = path.resolve(scriptDir, '../src/i18n/enabled-languages.json')
const threshold = 5
const nonUserFacingKeys = new Set([
  'account', 'address', 'amount', 'balance', 'cashFlowChange', 'captionsSrc', 'city', 'className', 'code', 'dark', 'expires', 'height', 'href', 'id',
  'initials', 'light', 'name', 'poster', 'productSlugs', 'rate', 'slug', 'src', 'to', 'value', 'variable', 'width', 'year',
])

function flatten(value, prefix = '', result = new Map()) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, nested] of Object.entries(value)) {
      flatten(nested, prefix ? `${prefix}.${key}` : key, result)
    }
  } else if (Array.isArray(value)) {
    value.forEach((nested, index) => flatten(nested, prefix ? `${prefix}.${index}` : String(index), result))
  } else {
    result.set(prefix, value)
  }
  return result
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function isExcluded(key, value, namespaceFile) {
  if (key.split('.').some((part) => part.startsWith('_'))) return true
  if (key.split('.').some((part) => nonUserFacingKeys.has(part))) return true
  if (namespaceFile === 'landing.json' && (/^hero\.card\.number$|^steps\.items\.\d+\.number$/.test(key) || key === 'dashboardPreview.account.account')) return true
  if (namespaceFile === 'landing.json' && /^rates\.tabs\.\d+\.rows\.\d+\.rate$/.test(key)) return true
  if (namespaceFile === 'pages.json' && ['design.colorTokens.6.name', 'design.typographySamples.0.name'].includes(key)) return true
  if (namespaceFile === 'pages.json' && /^design\.colorTokens\.\d+\.(?:dark|light)$/.test(key)) return true
  if (typeof value !== 'string' || value.trim() === '') return true
  if (/^\s*[-+]?\s*(?:[$€£]\s*)?\d[\d,.]*(?:\s*(?:K\+?|%|USD))?\s*$/i.test(value)) return true
  if (/Westbridge National Bank/i.test(value)) return true
  if (/^(?:App Store|Google Play|Marketplace)$/i.test(value)) return true
  if (/^#[0-9A-F]{3,8}$/i.test(value)) return true
  if (!/[\p{L}]{2}/u.test(value.replace(/\{\{[^}]+\}\}/g, ''))) return true
  if (/^\s*(?:[$€£¥₹]\s*)?[-+]?\d[\d,]*(?:\.\d+)?\s*(?:%|USD|US dollars?)?\s*$/i.test(value)) return true
  if (/^\s*(?:[$€£¥₹]\s*)?\d[\d,]*(?:\.\d+)?\s*(?:USD|US dollars?)\s*$/i.test(value)) return true
  return false
}

const namespaceFiles = fs.readdirSync(englishDir).filter((file) => file.endsWith('.json')).sort()
const languages = requestedLanguage && !writeEnabledLanguages
  ? [requestedLanguage]
  : fs.readdirSync(localesDir, { withFileTypes: true }).filter((entry) => entry.isDirectory() && entry.name !== 'en').map((entry) => entry.name).sort()
let failed = false
const enabledLanguages = new Set(['en'])

console.log('| Language | Identical values | Checked values | Identical rate | Result |')
console.log('|---|---:|---:|---:|---|')

for (const language of languages) {
  let identical = 0
  let checked = 0
  const identicalKeys = []

  for (const namespaceFile of namespaceFiles) {
    const sourcePath = path.join(englishDir, namespaceFile)
    const targetPath = path.join(localesDir, language, namespaceFile)
    if (!fs.existsSync(targetPath)) {
      console.error(`${language}/${namespaceFile}: missing locale namespace`)
      failed = true
      continue
    }

    const source = flatten(readJson(sourcePath))
    const target = flatten(readJson(targetPath))
    for (const [key, englishValue] of source) {
      if (isExcluded(key, englishValue, namespaceFile)) continue
      checked += 1
      const translatedValue = target.get(key)
      if (typeof translatedValue === 'string' && translatedValue.trim() === englishValue.trim()) {
        identical += 1
        identicalKeys.push(`${namespaceFile}:${key} = ${englishValue}`)
      }
    }
  }

  const rate = checked === 0 ? 0 : (identical / checked) * 100
  const result = rate < threshold ? 'PASS' : 'FAIL'
  if (rate < threshold) enabledLanguages.add(language)
  if (result === 'FAIL' && !writeEnabledLanguages) failed = true
  console.log(`| ${language} | ${identical} | ${checked} | ${rate.toFixed(2)}% | ${result} |`)
  if (showDetails && identicalKeys.length) {
    for (const identicalKey of identicalKeys) console.log(`  ${identicalKey}`)
  }
}

if (writeEnabledLanguages) {
  const preferredOrder = ['en', 'es', 'fr', 'pt', 'de', 'it', 'tr', 'ar']
  const enabled = [
    ...preferredOrder.filter((language) => enabledLanguages.has(language)),
    ...[...enabledLanguages].filter((language) => !preferredOrder.includes(language)).sort(),
  ]
  fs.writeFileSync(enabledLanguagesPath, `${JSON.stringify(enabled, null, 2)}\n`)
  const indexPath = path.resolve(scriptDir, '../index.html')
  const indexHtml = fs.readFileSync(indexPath, 'utf8')
  const updatedIndexHtml = indexHtml.replace(
    /const enabledLanguages = \[[^\]]*\];/,
    `const enabledLanguages = ${JSON.stringify(enabled)};`,
  )
  if (updatedIndexHtml === indexHtml && !indexHtml.includes(`const enabledLanguages = ${JSON.stringify(enabled)};`)) {
    throw new Error('Could not update enabled languages in index.html bootstrap script.')
  }
  fs.writeFileSync(indexPath, updatedIndexHtml)
  console.log(`Enabled languages written to ${path.relative(path.resolve(scriptDir, '..'), enabledLanguagesPath)}: ${enabled.join(', ')}`)
}

if (failed) process.exitCode = 1