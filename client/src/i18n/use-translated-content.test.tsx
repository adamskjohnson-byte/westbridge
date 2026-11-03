// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { I18nextProvider } from 'react-i18next'
import { useTranslation } from 'react-i18next'
import { i18n, i18nReady } from './index'
import { useTranslatedContent } from './use-translated-content'

afterEach(() => {
  cleanup()
  void i18n.changeLanguage('en')
})

function PublicCopyProbe() {
  const content = useTranslatedContent({ about: { title: '' } }, 'pages')
  const { t } = useTranslation('pages')
  return <><h1>{content.about.title}</h1><p>{t('about.title', { ns: 'pages', defaultValue: '' })}</p></>
}

describe('useTranslatedContent', () => {
  it('resolves locale values when source data contains no English fallback', async () => {
    await i18nReady
    await i18n.changeLanguage('en')
    await i18n.loadNamespaces('pages')

    render(
      <I18nextProvider i18n={i18n}>
        <PublicCopyProbe />
      </I18nextProvider>,
    )

    expect(screen.getByRole('heading').textContent).toBe('A steadier way forward, built around people.')
  })
})
