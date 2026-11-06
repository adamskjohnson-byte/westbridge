import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'
import { i18n, i18nReady } from '@/i18n'

afterEach(() => cleanup())

beforeEach(async () => {
  await i18nReady
  await i18n.changeLanguage('en')
})
