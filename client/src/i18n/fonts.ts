type FontSubset = 'latin' | 'latin-ext' | 'cyrillic' | 'vietnamese'

const manropeSubsetLoaders: Record<FontSubset, (() => Promise<unknown>)[]> = {
  latin: [
    () => import('@fontsource/manrope/latin-400.css'),
    () => import('@fontsource/manrope/latin-600.css'),
    () => import('@fontsource/manrope/latin-800.css'),
  ],
  'latin-ext': [
    () => import('@fontsource/manrope/latin-ext-400.css'),
    () => import('@fontsource/manrope/latin-ext-600.css'),
    () => import('@fontsource/manrope/latin-ext-800.css'),
  ],
  cyrillic: [
    () => import('@fontsource/manrope/cyrillic-400.css'),
    () => import('@fontsource/manrope/cyrillic-600.css'),
    () => import('@fontsource/manrope/cyrillic-800.css'),
  ],
  vietnamese: [
    () => import('@fontsource/manrope/vietnamese-400.css'),
    () => import('@fontsource/manrope/vietnamese-600.css'),
    () => import('@fontsource/manrope/vietnamese-800.css'),
  ],
}

const manropeSubsetsByLanguage: Record<string, FontSubset[]> = {
  en: ['latin'],
  'zh-CN': [],
  hi: ['latin'],
  es: ['latin', 'latin-ext'],
  fr: ['latin', 'latin-ext'],
  ar: ['latin'],
  bn: ['latin'],
  pt: ['latin', 'latin-ext'],
  ru: ['latin', 'cyrillic'],
  ur: ['latin'],
  id: ['latin'],
  de: ['latin', 'latin-ext'],
  ja: [],
  sw: ['latin'],
  tr: ['latin', 'latin-ext'],
  ko: [],
  vi: ['latin', 'vietnamese'],
  it: ['latin', 'latin-ext'],
  fa: ['latin'],
  pl: ['latin', 'latin-ext'],
  pseudo: ['latin'],
}

const scriptFontLoaders: Record<string, (() => Promise<unknown>)[]> = {
  ar: [
    () => import('@fontsource/noto-sans-arabic/arabic-400.css'),
    () => import('@fontsource/noto-sans-arabic/arabic-600.css'),
    () => import('@fontsource/noto-sans-arabic/arabic-800.css'),
  ],
  fa: [
    () => import('@fontsource/noto-sans-arabic/arabic-400.css'),
    () => import('@fontsource/noto-sans-arabic/arabic-600.css'),
    () => import('@fontsource/noto-sans-arabic/arabic-800.css'),
  ],
  // Noto Sans Arabic is used for Urdu for now; Noto Nastaliq Urdu is an option later but is heavy.
  ur: [
    () => import('@fontsource/noto-sans-arabic/arabic-400.css'),
    () => import('@fontsource/noto-sans-arabic/arabic-600.css'),
    () => import('@fontsource/noto-sans-arabic/arabic-800.css'),
  ],
  hi: [
    () => import('@fontsource/noto-sans-devanagari/devanagari-400.css'),
    () => import('@fontsource/noto-sans-devanagari/devanagari-600.css'),
    () => import('@fontsource/noto-sans-devanagari/devanagari-800.css'),
  ],
  bn: [
    () => import('@fontsource/noto-sans-bengali/bengali-400.css'),
    () => import('@fontsource/noto-sans-bengali/bengali-600.css'),
    () => import('@fontsource/noto-sans-bengali/bengali-800.css'),
  ],
}

const loadedFonts = new Map<string, Promise<unknown>>()

export function loadLanguageFont(language: string): Promise<unknown> {
  const subsets = manropeSubsetsByLanguage[language]
  if (!subsets) return Promise.resolve()

  const existing = loadedFonts.get(language)
  if (existing) return existing

  const loaders = [
    ...subsets.flatMap((subset) => manropeSubsetLoaders[subset]),
    ...(scriptFontLoaders[language] ?? []),
  ]
  const loaded = Promise.all(loaders.map((load) => load())).catch(() => undefined)
  loadedFonts.set(language, loaded)
  return loaded
}
