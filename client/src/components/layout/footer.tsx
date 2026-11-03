import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Container } from '@/components/layout/container'
import { Logo } from '@/components/layout/logo'
import { BidiText } from '@/components/ui/Ltr'
import { Separator } from '@/components/ui/separator'
import { footerColumns } from '@/content/navigation'
import { useTranslatedContent } from '@/i18n/use-translated-content'

export function Footer() {
  const { t } = useTranslation('common')
  const translatedColumns = useTranslatedContent(footerColumns, 'common', 'navigation.footerColumns')
  return (
    <footer className="border-t border-border bg-card">
      <Container className="py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div className="flex flex-col items-start gap-5">
            <Link aria-label={t('brand.homeLabel')} to="/"><Logo size={40} /></Link>
          </div>
          {translatedColumns.map((column) => (
            <div key={column.links[0]?.to ?? column.title}>
              <h2 className="mb-4 text-sm font-bold">{column.title}</h2>
              <ul className="flex flex-col gap-3 text-sm">
                {column.links.map((item) => (
                  <li key={item.to}><Link className="footer-link" to={item.to}>{item.label}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <Separator className="my-8" />
        <p className="text-xs leading-relaxed text-muted-foreground"><BidiText text={t('footer.disclaimer')} /></p>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          <a className="footer-link" href="https://pixabay.com" rel="noreferrer" target="_blank">{t('footer.photoSource')}</a>
          {' · '}
          <Link className="footer-link" to="/photo-credits">{t('footer.photoCredits')}</Link>
        </p>
      </Container>
    </footer>
  )
}