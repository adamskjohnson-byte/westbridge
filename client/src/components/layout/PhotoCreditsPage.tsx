import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Container } from '@/components/layout/container'
import { Section } from '@/components/layout/section'
import { usePageTitle } from '@/hooks/use-page-title'

type CreditEntry = {
  file: string
  user: string
  pageURL: string
  source: string
}

export function PhotoCreditsPage() {
  const { t } = useTranslation('pages')
  usePageTitle(t('photoCredits.title'), t('photoCredits.description'))
  const [entries, setEntries] = useState<CreditEntry[]>([])

  useEffect(() => {
    fetch('/images/credits.json')
      .then((response) => response.ok ? response.json() as Promise<CreditEntry[]> : [])
      .then((data) => setEntries(Array.isArray(data) ? data : []))
      .catch(() => setEntries([]))
  }, [])

  return (
    <main id="main-content">
      <Section>
        <Container className="max-w-3xl">
          <h1 className="type-h2">{t('photoCredits.title')}</h1>
          {entries.length > 0 ? (
            <ul className="mt-6 space-y-3">
              {entries.map((entry) => (
                <li key={entry.file} className="text-sm text-muted-foreground">
                  {t('photoCredits.attributionPrefix')} <a className="text-primary underline" href={entry.pageURL} rel="noreferrer" target="_blank">{entry.user}</a> {t('photoCredits.attributionSuffix')}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-6 text-sm text-muted-foreground">{t('photoCredits.empty')}</p>
          )}
        </Container>
      </Section>
    </main>
  )
}
