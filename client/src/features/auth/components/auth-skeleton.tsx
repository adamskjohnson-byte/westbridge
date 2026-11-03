import { useTranslation } from 'react-i18next'

export function AuthSkeleton() {
  const { t } = useTranslation('common')
  return (
    <main aria-busy="true" aria-label={t('auth.loadingAccount')} className="min-h-screen bg-background p-6">
      <span className="sr-only">{t('auth.checkingSession')}</span>
      <div className="mx-auto grid min-h-[70vh] max-w-5xl place-items-center">
        <div className="w-full max-w-md space-y-5" aria-hidden="true">
          <div className="h-8 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-11 w-full animate-pulse rounded bg-muted" />
          <div className="h-11 w-full animate-pulse rounded bg-muted" />
          <div className="h-11 w-1/2 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </main>
  )
}