import { Link } from 'react-router-dom'
import { buttonVariants } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/page-header'
import { Section } from '@/components/layout/section'
import { cn } from '@/lib/utils'
import { usePageTitle } from '@/hooks/use-page-title'
import { useTranslation } from 'react-i18next'

export function NotFound() {
  const { t } = useTranslation('common')
  usePageTitle(t('notFound.title'), t('notFound.description'))

  return (
    <main id="main-content">
      <Section>
        <PageHeader title={t('notFound.title')} description={t('notFound.description')} />
        <div className="flex flex-wrap gap-3">
          <Link className={cn(buttonVariants())} to="/">{t('notFound.home')}</Link>
          <Link className={cn(buttonVariants({ variant: 'outline' }))} to="/products">{t('notFound.products')}</Link>
          <Link className={cn(buttonVariants({ variant: 'outline' }))} to="/faq">{t('notFound.help')}</Link>
          <Link className={cn(buttonVariants({ variant: 'outline' }))} to="/contact">{t('notFound.contact')}</Link>
        </div>
      </Section>
    </main>
  )
}