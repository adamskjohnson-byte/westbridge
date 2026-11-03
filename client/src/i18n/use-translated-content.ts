import { useTranslation } from 'react-i18next'
import { pseudoTransformText } from './pseudo-transform'

const untranslatedFields = new Set([
  'amount',
  'balance',
  'bankName',
  'cashFlowChange',
  'captionsSrc',
  'captionsLabel',
  'className',
  'href',
  'height',
  'id',
  'initials',
  'poster',
  'productSlugs',
  'rate',
  'slug',
  'src',
  'to',
  'variable',
  'width',
])

const untranslatedContentPaths = new Set([
  'design.colorTokens.6.name',
  'design.typographySamples.0.name',
])

function isNonTranslatableData(path: string, parentKey: string, value: string): boolean {
  if (untranslatedContentPaths.has(path)) return true
  if (untranslatedFields.has(parentKey)) return true
  if (/^hero\.card\.number$|^steps\.items\.\d+\.number$/.test(path)) return true
  if (path === 'hero.card.expires') return true
  if (path === 'dashboardPreview.account.account') return true
  if (/^rates\.tabs\.\d+\.rows\.\d+\.rate$/.test(path)) return true
  if (/^design\.colorTokens\.\d+\.(?:dark|light)$/.test(path)) return true
  if (parentKey === 'value' && /^\s*[-+]?\s*(?:[$€£]\s*)?\d[\d,.]*(?:\s*(?:K\+?|%|USD))?\s*$/i.test(value)) return true
  return /^\s*[-+]?\s*(?:[$€£]\s*)?\d[\d,.]*(?:\s*(?:K\+?|%|USD))?\s*$/i.test(value)
}

function translateTree(value: unknown, translate: (key: string, fallback: string) => string, path: string, parentKey = ''): unknown {
  if (typeof value === 'string') {
    if (isNonTranslatableData(path, parentKey, value)) return value
    if (parentKey === 'name' && /(?:about\.leadership|testimonials\.items|dashboardPreview\.transactions)/.test(path)) return value
    return translate(path, value)
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => translateTree(item, translate, `${path}.${index}`, parentKey))
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [
      key,
      translateTree(child, translate, path ? `${path}.${key}` : key, key),
    ]))
  }
  return value
}

export function useTranslatedContent<T>(source: T, namespace: 'common' | 'landing' | 'pages', prefix = ''): T {
  const { i18n, t } = useTranslation(namespace)
  const translated = translateTree(source, (key, fallback) => {
    const value = t(key, { ns: namespace, defaultValue: fallback })
    if (import.meta.env.DEV && i18n.resolvedLanguage === 'pseudo' && value === fallback) {
      return pseudoTransformText(fallback)
    }
    return value
  }, prefix)
  return translated as T
}