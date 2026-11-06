import i18next, { type BackendModule, type ResourceKey } from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import { detectLanguage, languages, resolveLanguage } from './languages'
import { loadLanguageFont } from './fonts'
import { pseudoTransformText } from './pseudo-transform'

const localeFiles = import.meta.glob('../locales/*/*.json')
const storageKey = 'westbridge.lang'

function transformPseudoResource(resource: unknown): unknown {
  if (typeof resource === 'string') return pseudoTransformText(resource)
  if (Array.isArray(resource)) return resource.map(transformPseudoResource)
  if (typeof resource === 'object' && resource !== null) {
    return Object.fromEntries(Object.entries(resource).map(([key, value]) => [key, transformPseudoResource(value)]))
  }
  return resource
}

function isLocaleResource(value: unknown): value is ResourceKey {
  return typeof value === 'string' || (typeof value === 'object' && value !== null && !Array.isArray(value))
}

const lazyLocaleBackend: BackendModule = {
  type: 'backend',
  init: () => undefined,
  read(language, namespace, callback) {
    const pseudo = import.meta.env.DEV && language === 'pseudo'
    const resourceLanguage = pseudo ? 'en' : language
    const loader = localeFiles[`../locales/${resourceLanguage}/${namespace}.json`]
    if (!loader) {
      callback(null, {})
      return
    }

    void loader()
      .then((loadedModule) => {
        const module = loadedModule as { default?: unknown }
        const resource = isLocaleResource(module.default) ? module.default : {}
        callback(null, (pseudo ? transformPseudoResource(resource) : resource) as ResourceKey)
      })
      .catch((error: unknown) => callback(error instanceof Error ? error : new Error(String(error)), null))
  },
}

const detector = new LanguageDetector()
detector.addDetector({
  name: 'westbridgeLanguage',
  lookup() {
    let saved: string | null = null
    try {
      saved = window.localStorage.getItem(storageKey)
    } catch {
      // Continue with the browser preference when local storage is unavailable.
    }

    const candidates = navigator.languages?.length ? navigator.languages : [navigator.language]
    return detectLanguage(saved, candidates).code
  },
  cacheUserLanguage(language) {
    try {
      window.localStorage.setItem(storageKey, resolveLanguage(language).code)
    } catch {
      // Language changes still apply for the current session.
    }
  },
})

export const i18n = i18next.createInstance()

i18n.on('languageChanged', (language) => {
  const resolved = resolveLanguage(language)
  if (typeof document !== 'undefined') {
    document.documentElement.lang = resolved.code
    document.documentElement.dir = resolved.dir
  }
  void loadLanguageFont(resolved.code)
})

export const i18nReady = i18n
  .use(detector)
  .use(lazyLocaleBackend)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: languages.map((language) => language.code),
    load: 'currentOnly',
    ns: ['common', 'landing', 'pages', 'admin'],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    missingKeyHandler: import.meta.env.DEV ? (lng, ns, key, fallbackValue) => {
      console.warn(`[i18n] Missing translation: ${key} (${ns}) for ${lng}. Fallback: ${fallbackValue}`)
    } : undefined,
    detection: {
      order: ['westbridgeLanguage'],
      caches: ['westbridgeLanguage'],
    },
    react: { useSuspense: false },
  })
  .then(() => {
    const resolved = resolveLanguage(i18n.resolvedLanguage ?? i18n.language)
    if (typeof document !== 'undefined') {
      document.documentElement.lang = resolved.code
      document.documentElement.dir = resolved.dir
    }
    void loadLanguageFont(resolved.code)
  })
