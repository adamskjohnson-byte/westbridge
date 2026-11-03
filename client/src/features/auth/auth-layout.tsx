import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Toaster } from '@/components/ui/sonner'
import { Logo } from '@/components/layout/logo'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { useTheme } from '@/hooks/use-theme'
import { authPitch } from '@/content/auth'
import { useTranslatedContent } from '@/i18n/use-translated-content'

export function AuthLayout() {
  const { t } = useTranslation('common')
  const pitch = useTranslatedContent(authPitch, 'common', 'authPitch')
  const { theme } = useTheme()

  return (
    <div className="min-h-screen bg-background md:grid md:grid-cols-[minmax(19rem,0.86fr)_minmax(0,1.14fr)]">
      <a className="skip-link" href="#main-content">{t('accessibility.skipToContent')}</a>
      <aside className="relative flex flex-col justify-between overflow-hidden bg-brand-burgundy px-6 py-7 text-brand-cream sm:px-10 sm:py-9 lg:px-14 lg:py-12">
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 end-0 hidden w-16 border-s border-brand-cream/10 md:block" />
        <div className="relative z-10">
          <Logo size={42} variant="light" />
          <div className="mt-12 max-w-lg sm:mt-16 lg:mt-28">
            <p className="mb-3 text-xs font-bold uppercase text-brand-cream/75">{pitch.eyebrow}</p>
            <h1 className="type-h1 max-w-md text-brand-cream">{pitch.heading}</h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-brand-cream/85">{pitch.body}</p>
          </div>
          <ul className="mt-7 grid gap-3 text-sm sm:grid-cols-3 md:grid-cols-1 lg:mt-9">
            {pitch.benefits.map((benefit, index) => (
              <li className="flex items-start gap-3 border-t border-brand-cream/20 pt-3" key={benefit}>
                <span aria-hidden="true" className="font-bold text-brand-cream/65">0{index + 1}</span>
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative z-10 mt-8 hidden max-w-sm text-xs leading-5 text-brand-cream/75 md:block">{pitch.disclaimer}</p>
      </aside>
      <div className="auth-surface flex min-h-[55vh] flex-col px-5 py-9 sm:px-10 sm:py-12 lg:px-16 lg:py-16">
        <div className="mx-auto flex w-full max-w-lg items-center justify-end gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
        <main className="mx-auto flex w-full max-w-lg flex-1 items-center" id="main-content">
          <div className="w-full"><Outlet /></div>
        </main>
        <p className="mx-auto mt-8 max-w-lg text-center text-xs leading-5 text-muted-foreground md:hidden">{pitch.disclaimer}</p>
      </div>
      <Toaster theme={theme} />
    </div>
  )
}