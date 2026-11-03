import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronRight, House } from 'lucide-react'

export type BreadcrumbItem = {
  label: string
  to?: string
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  const { t } = useTranslation('common')
  return (
    <nav aria-label={t('breadcrumbs.label')} className="mb-6">
      <ol className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <li>
          <Link aria-label={t('breadcrumbs.home')} className="inline-flex items-center gap-1 hover:text-foreground" to="/">
            <House aria-hidden="true" className="size-3.5" /> {t('breadcrumbs.home')}
          </Link>
        </li>
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="inline-flex items-center gap-2">
            <ChevronRight aria-hidden="true" className="size-3.5 rtl:rotate-180" />
            {item.to && index < items.length - 1 ? (
              <Link className="hover:text-foreground" to={item.to}>{item.label}</Link>
            ) : (
              <span aria-current="page" className="font-medium text-foreground">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}