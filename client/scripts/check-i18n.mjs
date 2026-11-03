import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const localesDir = path.resolve(scriptDir, '../src/locales')
const sourceDir = path.resolve(scriptDir, '../src')
const englishDir = path.join(localesDir, 'en')
const placeholderPattern = /\{\{\s*([^{}]+?)\s*\}\}/g

function flatten(value, prefix = '', result = new Map()) {
  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      flatten(nested, prefix ? `${prefix}.${key}` : key, result)
    }
  } else {
    result.set(prefix, value)
  }
  return result
}

function placeholders(value) {
  if (typeof value !== 'string') return []
  return [...value.matchAll(placeholderPattern)].map((match) => match[1]).sort()
}

function brandNames(value) {
  if (typeof value !== 'string') return []
  return [...new Set(value.match(/Westbridge(?: National Bank)?/gi) ?? [])]
}

function isNonTranslatable(namespace, key, value) {
  const parts = key.split('.')
  const leaf = parts.at(-1)
  if (['amount', 'balance', 'bankName', 'captionsSrc', 'className', 'expires', 'height', 'href', 'id', 'initials', 'poster', 'productSlugs', 'slug', 'src', 'to', 'variable', 'width'].includes(leaf)) return true
  if (namespace === 'landing' && (/^hero\.card\.number$|^steps\.items\.\d+\.number$/.test(key) || /^rates\.tabs\.\d+\.rows\.\d+\.rate$/.test(key))) return true
  if (namespace === 'landing' && key === 'dashboardPreview.account.account') return true
  if (namespace === 'pages' && ['design.colorTokens.6.name', 'design.typographySamples.0.name'].includes(key)) return true
  if (namespace === 'pages' && /^design\.colorTokens\.\d+\.(?:dark|light)$/.test(key)) return true
  if (typeof value === 'number') return true
  if (typeof value === 'string' && /^\s*[-+]?\s*(?:[$€£]\s*)?\d[\d,.]*(?:\s*(?:K\+?|%|USD))?\s*$/i.test(value)) return true
  return typeof value === 'string' && /^(?:https?:\/\/|mailto:|#|\/)/i.test(value)
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function collectSourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name)
    if (entry.isDirectory()) return entry.name === 'locales' ? [] : collectSourceFiles(filePath)
    return /\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\.(ts|tsx)$/.test(entry.name) ? [filePath] : []
  })
}

function checkSourceKeys(namespaces) {
  const errors = []
  const translationCall = /\bt\(\s*(['"])([\w.-]+)\1/g
  const translationNamespace = /useTranslation\(\s*['"](common|landing|pages)['"]\s*\)/
  const explicitNamespace = /\{\s*ns:\s*['"](common|landing|pages)['"]/

  for (const filePath of collectSourceFiles(sourceDir)) {
    const source = fs.readFileSync(filePath, 'utf8')
    const defaultNamespace = source.match(translationNamespace)?.[1]
    for (const match of source.matchAll(translationCall)) {
      const options = source.slice(match.index, match.index + 160)
      const namespace = options.match(explicitNamespace)?.[1] ?? defaultNamespace
      if (!namespace) continue
      const parts = match[2].split('.')
      const exists = parts.reduce((value, part) => value && typeof value === 'object' && part in value ? value[part] : undefined, namespaces[namespace])
      const parent = parts.slice(0, -1).reduce((value, part) => value && typeof value === 'object' && part in value ? value[part] : undefined, namespaces[namespace])
      const hasPluralForms = parent && typeof parent === 'object' && `${parts.at(-1)}_one` in parent && `${parts.at(-1)}_other` in parent
      if (exists === undefined && !hasPluralForms) {
        errors.push(`${path.relative(sourceDir, filePath)}: missing English key ${namespace}:${match[2]}`)
      }
    }
  }
  return errors
}

function checkDuplicateTranslations(language, namespaces, locales) {
  if (language === 'en') return []

  const grouped = new Map()
  for (const namespace of namespaces) {
    const namespaceName = path.basename(namespace, '.json')
    const englishEntries = flatten(readJson(path.join(englishDir, namespace)))
    const localeEntries = flatten(locales[namespaceName])
    for (const [key, englishValue] of englishEntries) {
      if (typeof englishValue !== 'string' || isNonTranslatable(namespaceName, key, englishValue)) continue
      const translatedValue = localeEntries.get(key)
      if (typeof translatedValue !== 'string' || translatedValue.trim() === '' || translatedValue === englishValue) continue

      const translation = translatedValue.normalize('NFC').trim().replace(/\s+/g, ' ')
      const source = englishValue.normalize('NFC').trim().replace(/\s+/g, ' ')
      const entries = grouped.get(translation) ?? []
      entries.push({ key: `${namespaceName}:${key}`, source })
      grouped.set(translation, entries)
    }
  }

  return [...grouped.entries()].flatMap(([translation, entries]) => {
    const distinctSources = new Set(entries.map((entry) => entry.source))
    if (distinctSources.size < 2) return []
    const details = entries.map(({ key, source }) => `${key} (${JSON.stringify(source)})`).join('; ')
    return [`${language}: different English strings share ${JSON.stringify(translation)}: ${details}`]
  })
}

function checkLocales() {
  const namespaces = fs.readdirSync(englishDir).filter((file) => file.endsWith('.json')).sort()
  const languageDirs = fs.readdirSync(localesDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
  const errors = []
  const warnings = []
  const englishNamespaces = Object.fromEntries(namespaces.map((namespace) => [
    path.basename(namespace, '.json'),
    readJson(path.join(englishDir, namespace)),
  ]))
  errors.push(...checkSourceKeys(englishNamespaces))

  for (const language of languageDirs) {
    const localeNamespaces = {}
    for (const namespace of namespaces) {
      const englishFile = path.join(englishDir, namespace)
      const localeFile = path.join(localesDir, language, namespace)
      if (!fs.existsSync(localeFile)) {
        errors.push(`${language}/${namespace}: missing namespace file`)
        continue
      }

      const englishEntries = flatten(readJson(englishFile))
      const localeData = readJson(localeFile)
      localeNamespaces[path.basename(namespace, '.json')] = localeData
      const localeEntries = flatten(localeData)
      for (const [key, englishValue] of englishEntries) {
        if (isNonTranslatable(path.basename(namespace, '.json'), key, englishValue)) continue
        if (!localeEntries.has(key)) {
          errors.push(`${language}/${namespace}: missing key ${key}`)
          continue
        }
        const localeValue = localeEntries.get(key)
        if (language !== 'en') {
          for (const brandName of brandNames(englishValue)) {
            if (typeof localeValue !== 'string' || !localeValue.includes(brandName)) {
              errors.push(`${language}/${namespace}: brand name changed for ${key} (expected exact text ${JSON.stringify(brandName)})`)
            }
          }
        }
        const englishTokens = placeholders(englishValue)
        const localeTokens = placeholders(localeValue)
        const arabicCountOmission = language === 'ar' && /_(one|two)$/.test(key) && englishTokens.includes('count')
        const withoutCount = englishTokens.filter((token) => token !== 'count')
        const exactPlaceholderMatch = englishTokens.join('|') === localeTokens.join('|')
        const arabicPluralPlaceholderMatch = arabicCountOmission && withoutCount.join('|') === localeTokens.join('|')
        if (!exactPlaceholderMatch && !arabicPluralPlaceholderMatch) {
          errors.push(`${language}/${namespace}: placeholder mismatch for ${key} (expected ${englishTokens.join(', ') || 'none'}, got ${localeTokens.join(', ') || 'none'})`)
        }
      }
    }
    warnings.push(...checkDuplicateTranslations(language, namespaces, localeNamespaces))
  }

  return { errors, warnings, languageCount: languageDirs.length, namespaceCount: namespaces.length }
}

const report = checkLocales()
if (report.warnings.length) {
  console.warn(`i18n check warnings (${report.warnings.length} possible duplicate-translation groups):`)
  for (const warning of report.warnings) console.warn(`- ${warning}`)
}
if (report.errors.length) {
  console.error(`i18n check failed (${report.languageCount} languages, ${report.namespaceCount} namespaces):`)
  for (const error of report.errors) console.error(`- ${error}`)
  process.exitCode = 1
} else {
  console.log(`i18n check passed: ${report.languageCount} languages, ${report.namespaceCount} namespaces.`)
}
