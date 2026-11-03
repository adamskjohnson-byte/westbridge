import enabledLanguageCodes from './enabled-languages.json'

export type LanguageDirection = 'ltr' | 'rtl'

export type Language = {
  code: string
  nativeName: string
  englishName: string
  dir: LanguageDirection
  enabled: boolean
}

const pseudoLanguage: Language = {
  code: 'pseudo',
  nativeName: 'Pseudo',
  englishName: 'Pseudo Locale',
  dir: 'ltr',
  enabled: true,
}

const enabledCodes = new Set<string>(enabledLanguageCodes)

const languageDefinitions: Omit<Language, 'enabled'>[] = [
  { code: 'en', nativeName: 'English', englishName: 'English', dir: 'ltr' },
  { code: 'zh-CN', nativeName: '简体中文', englishName: 'Chinese (Simplified)', dir: 'ltr' },
  { code: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi', dir: 'ltr' },
  { code: 'es', nativeName: 'Español', englishName: 'Spanish', dir: 'ltr' },
  { code: 'fr', nativeName: 'Français', englishName: 'French', dir: 'ltr' },
  { code: 'ar', nativeName: 'العربية', englishName: 'Arabic', dir: 'rtl' },
  { code: 'bn', nativeName: 'বাংলা', englishName: 'Bengali', dir: 'ltr' },
  { code: 'pt', nativeName: 'Português', englishName: 'Portuguese', dir: 'ltr' },
  { code: 'ru', nativeName: 'Русский', englishName: 'Russian', dir: 'ltr' },
  { code: 'ur', nativeName: 'اردو', englishName: 'Urdu', dir: 'rtl' },
  { code: 'id', nativeName: 'Bahasa Indonesia', englishName: 'Indonesian', dir: 'ltr' },
  { code: 'de', nativeName: 'Deutsch', englishName: 'German', dir: 'ltr' },
  { code: 'ja', nativeName: '日本語', englishName: 'Japanese', dir: 'ltr' },
  { code: 'sw', nativeName: 'Kiswahili', englishName: 'Swahili', dir: 'ltr' },
  { code: 'tr', nativeName: 'Türkçe', englishName: 'Turkish', dir: 'ltr' },
  { code: 'ko', nativeName: '한국어', englishName: 'Korean', dir: 'ltr' },
  { code: 'vi', nativeName: 'Tiếng Việt', englishName: 'Vietnamese', dir: 'ltr' },
  { code: 'it', nativeName: 'Italiano', englishName: 'Italian', dir: 'ltr' },
  { code: 'fa', nativeName: 'فارسی', englishName: 'Persian', dir: 'rtl' },
  { code: 'pl', nativeName: 'Polski', englishName: 'Polish', dir: 'ltr' },
]

export const baseLanguages: Language[] = languageDefinitions.map((language) => ({
  ...language,
  enabled: enabledCodes.has(language.code),
}))

const enabledBaseLanguages = baseLanguages
  .filter((language) => language.enabled)
  .sort((first, second) => enabledLanguageCodes.indexOf(first.code) - enabledLanguageCodes.indexOf(second.code))

export const languages: Language[] = import.meta.env.DEV
  ? [...enabledBaseLanguages, pseudoLanguage]
  : enabledBaseLanguages

const englishLanguage = baseLanguages.find((language) => language.code === 'en')!

function findBaseLanguage(candidate: string): Language | undefined {
  const normalized = candidate.trim().replaceAll('_', '-')
  const exact = baseLanguages.find((language) => language.code.toLowerCase() === normalized.toLowerCase())
  if (exact) return exact
  const base = normalized.split('-')[0].toLowerCase()
  if (base === 'zh') return baseLanguages.find((language) => language.code === 'zh-CN')
  return baseLanguages.find((language) => language.code.toLowerCase() === base)
}

export function isPseudoLanguage(candidate: string | null | undefined): boolean {
  if (!candidate) return false
  const normalized = candidate.trim().replaceAll('_', '-')
  return normalized.toLowerCase() === 'pseudo' || normalized.toLowerCase() === 'en-xa'
}

export const languageCodes = languages.map((language) => language.code)

export function detectLanguage(savedChoice: string | null | undefined, browserLanguages: readonly string[] = []): Language {
  if (import.meta.env.DEV && isPseudoLanguage(savedChoice)) return pseudoLanguage

  if (savedChoice) {
    const saved = findBaseLanguage(savedChoice)
    return saved?.enabled ? saved : englishLanguage
  }

  if (import.meta.env.DEV) {
    const pseudoMatch = browserLanguages.find((candidate) => isPseudoLanguage(candidate))
    if (pseudoMatch) return pseudoLanguage
  }

  for (const candidate of browserLanguages) {
    if (!candidate) continue
    const match = findBaseLanguage(candidate)
    if (match) return match.enabled ? match : englishLanguage
  }

  return englishLanguage
}

export function resolveLanguage(candidate: string | null | undefined): Language {
  if (!candidate) return englishLanguage

  if (import.meta.env.DEV && isPseudoLanguage(candidate)) return pseudoLanguage

  const match = findBaseLanguage(candidate)
  return match?.enabled ? match : englishLanguage
}
