import { beforeEach } from 'vitest'
import { i18n, i18nReady } from '@/i18n'

beforeEach(async () => {
  await i18nReady
  await i18n.changeLanguage('en')
})
