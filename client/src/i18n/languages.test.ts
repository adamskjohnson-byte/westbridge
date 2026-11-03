import { describe, expect, it } from 'vitest'
import { baseLanguages, detectLanguage, languages, resolveLanguage } from './languages'

describe('language resolution', () => {
  it('falls back to English for an unknown language', () => {
    expect(detectLanguage(null, ['xx-YY']).code).toBe('en')
    expect(resolveLanguage('xx-YY').code).toBe('en')
  })

  it('prefers the saved language over the browser language and matches browser base codes', () => {
    expect(detectLanguage('fr', ['es-MX']).code).toBe('fr')
    expect(detectLanguage(null, ['es-MX']).code).toBe('es')
    expect(detectLanguage(null, ['zh-TW']).code).toBe('en')
  })

  it('only exposes enabled languages and falls back to English for disabled saved or detected languages', () => {
    expect(languages.map((language) => language.code).filter((code) => code !== 'pseudo')).toEqual([
      'en', 'es', 'fr', 'pt', 'de', 'it', 'tr', 'ar',
    ])
    expect(baseLanguages.find((language) => language.code === 'ar')?.enabled).toBe(true)
    expect(baseLanguages.find((language) => language.code === 'fa')?.enabled).toBe(false)
    expect(detectLanguage('fa', ['fr']).code).toBe('en')
    expect(detectLanguage(null, ['fa']).code).toBe('en')
    expect(resolveLanguage('fa').code).toBe('en')
  })
})
