// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { i18n, i18nReady } from '@/i18n'
import { LanguageSwitcher } from './LanguageSwitcher'

afterEach(async () => {
  cleanup()
  await i18n.changeLanguage('en')
})

describe('LanguageSwitcher', () => {
  it('filters languages and changes language with keyboard selection', async () => {
    await i18nReady
    await i18n.changeLanguage('en')
    render(<LanguageSwitcher />)

    fireEvent.click(screen.getByRole('button', { name: 'Language: English' }))
    const search = screen.getByRole('combobox', { name: 'Search languages' })
    fireEvent.change(search, { target: { value: 'Arabic' } })

    expect(screen.getByRole('option', { name: 'العربية, Arabic, ar' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: 'Español, Spanish, es' })).toBeNull()

    fireEvent.keyDown(search, { key: 'ArrowDown' })
    fireEvent.keyDown(search, { key: 'Enter' })

    await waitFor(() => {
      expect(document.documentElement.lang).toBe('ar')
      expect(document.documentElement.dir).toBe('rtl')
    })
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('supports type-ahead selection', async () => {
    await i18nReady
    await i18n.changeLanguage('en')
    render(<LanguageSwitcher />)

    fireEvent.click(screen.getByRole('button', { name: 'Language: English' }))
    const search = screen.getByRole('combobox', { name: 'Search languages' })
    fireEvent.keyDown(search, { key: 'd' })

    expect(search.getAttribute('aria-activedescendant')).toBe('language-option-de')
    fireEvent.keyDown(search, { key: 'Enter' })
    await waitFor(() => expect(document.documentElement.lang).toBe('de'))
  })

  it('closes on Escape and returns focus to the trigger', async () => {
    await i18nReady
    await i18n.changeLanguage('en')
    render(<LanguageSwitcher />)

    const trigger = screen.getByRole('button', { name: 'Language: English' })
    fireEvent.click(trigger)
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('listbox')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })
})
