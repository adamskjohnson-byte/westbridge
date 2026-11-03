import { PageHeader } from '@/components/layout/page-header'
import { Section } from '@/components/layout/section'
import { usePageTitle } from '@/hooks/use-page-title'
import { useTranslation } from 'react-i18next'

export function ComingSoon({ title }: { title: string }) {
  const { t } = useTranslation('common')
  usePageTitle(title, t('comingSoon.description'))

  return (
    <main id="main-content">
      <Section>
        <PageHeader title={title} />
        <p className="type-body text-muted-foreground">{t('comingSoon.message')}</p>
      </Section>
    </main>
  )
}