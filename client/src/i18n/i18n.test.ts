import { describe, expect, it } from 'vitest'
import { baseLanguages, languages, resolveLanguage } from './languages'
import { i18n, i18nReady } from './index'

describe('language metadata', () => {
  it('marks Arabic, Urdu, and Persian as right-to-left', () => {
    expect(baseLanguages.filter((language) => language.dir === 'rtl').map((language) => language.code)).toEqual(['ar', 'ur', 'fa'])
    expect(languages.filter((language) => language.dir === 'rtl').map((language) => language.code)).toEqual(['ar'])
    expect(resolveLanguage('ar').dir).toBe('rtl')
    expect(resolveLanguage('en').dir).toBe('ltr')
    expect(resolveLanguage('fa').code).toBe('en')
  })

  it('updates the document direction when the active language changes', async () => {
    await i18nReady
    await i18n.changeLanguage('ar')
    expect(document.documentElement.lang).toBe('ar')
    expect(document.documentElement.dir).toBe('rtl')
    await i18n.changeLanguage('en')
    expect(document.documentElement.dir).toBe('ltr')
  })

  it('loads wrapped English resources for the development pseudo locale', async () => {
    await i18nReady
    await i18n.changeLanguage('pseudo')

    expect(i18n.t('hero.eyebrow', { ns: 'landing' })).toMatch(/^⟦.*⟧$/u)
    await i18n.changeLanguage('en')
  })

  it('resolves a locale-backed value when its source fallback is empty', async () => {
    await i18nReady
    await i18n.changeLanguage('en')
    await i18n.loadNamespaces('pages')

    expect(i18n.t('about.title', { ns: 'pages', defaultValue: '' })).toBe('A steadier way forward, built around people.')
  })
})
