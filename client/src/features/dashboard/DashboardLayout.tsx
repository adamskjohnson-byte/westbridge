import { startTransition, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowDownLeft, ArrowLeftRight, ChartNoAxesCombined, CircleHelp, CreditCard, LayoutDashboard, LogOut, MoreHorizontal, Receipt, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import { Logo } from '@/components/layout/logo'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useAuth } from '@/features/auth/auth-provider'
import { usePageTitle } from '@/hooks/use-page-title'
import { cn } from '@/lib/utils'
import { NotificationBell } from './NotificationBell'
import { getSettings } from './settings-api'
import { i18n } from '@/i18n'
import { useTheme } from '@/hooks/use-theme'

const liveItems = [
  { to: '/dashboard', key: 'overview', icon: LayoutDashboard, end: true },
  { to: '/dashboard/transactions', key: 'transactions', icon: ArrowDownLeft, end: false },
  { to: '/dashboard/transfers', key: 'transfers', icon: ArrowLeftRight, end: false },
  { to: '/dashboard/bills', key: 'bills', icon: Receipt, end: false },
  { to: '/dashboard/cards', key: 'cards', icon: CreditCard, end: false },
  { to: '/dashboard/insights', key: 'insights', icon: ChartNoAxesCombined, end: false },
  { to: '/dashboard/settings', key: 'settings', icon: Settings, end: false },
] as const

export function DashboardLayout() {
  const { t } = useTranslation('common')
  const { t: adminT } = useTranslation('admin')
  const { user, logout } = useAuth()
  const { setTheme } = useTheme()
  const preferencesQuery = useQuery({ queryKey: ['dashboard', 'settings'], queryFn: getSettings, enabled: Boolean(user), staleTime: 60_000 })
  const [preferencesReady, setPreferencesReady] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const isTransactions = location.pathname.includes('/transactions')
  const pageTitle = isTransactions
    ? t('dashboard.transactions.title')
    : location.pathname.includes('/transfers')
      ? t('dashboard.transfers.title')
      : location.pathname.includes('/bills')
        ? t('dashboard.bills.title')
        : location.pathname.includes('/cards')
          ? t('dashboard.cards.title')
          : location.pathname.includes('/insights')
            ? t('dashboard.insights.title')
            : location.pathname.includes('/settings')
              ? t('dashboard.settings.title')
        : t('dashboard.overview')
  usePageTitle(pageTitle, t('dashboard.description'))

  useEffect(() => {
    mainRef.current?.focus()
  }, [location.pathname])

  useEffect(() => {
    if (!user || preferencesQuery.isPending) return
    let active = true
    async function applyPreferences() {
      if (preferencesQuery.data) {
      const { locale, theme } = preferencesQuery.data.preferences
      if (locale) {
        await i18n.changeLanguage(locale)
        try { window.localStorage.setItem('westbridge.lang', locale) } catch { /* Local preference is optional. */ }
      }
      startTransition(() => setTheme(theme))
      }
      if (active) startTransition(() => setPreferencesReady(true))
    }
    void applyPreferences()
    return () => { active = false }
  }, [preferencesQuery.data, preferencesQuery.isPending, setTheme, user])

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  if (!preferencesReady) {
    return <main aria-busy="true" className="min-h-screen animate-pulse space-y-4 bg-background p-6"><div className="h-10 w-48 bg-muted"/><div className="h-64 bg-muted"/></main>
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a className="skip-link" href="#dashboard-main">{t('accessibility.skipToContent')}</a>
      <div className="mx-auto flex min-h-screen w-full max-w-[100rem]">
        <aside aria-label={t('dashboard.shell.primaryNavigation')} className="fixed inset-y-0 start-0 z-30 hidden w-[5.25rem] flex-col border-e border-border bg-card xl:w-64 md:flex">
          <NavLink aria-label={t('brand.homeLabel')} className="flex h-20 items-center justify-center border-b border-border px-3 xl:justify-start xl:px-6" to="/dashboard">
            <Logo className="[&>span]:hidden xl:[&>span]:flex" size={36} />
          </NavLink>
          <nav aria-label={t('dashboard.shell.primaryNavigation')} className="flex-1 px-2 py-6 xl:px-3">
            <p className="hidden px-3 pb-3 text-[0.68rem] font-bold uppercase text-muted-foreground xl:block">{t('dashboard.shell.workspace')}</p>
            <div className="grid gap-1">
              {liveItems.map(({ to, key, icon: Icon, end }) => (
                <NavLink
                  aria-label={t(`dashboard.shell.${key}`)}
                  className={({ isActive }) => cn('dashboard-nav-link group relative flex min-h-11 items-center justify-center gap-3 rounded-md px-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground xl:justify-start xl:px-3', isActive && 'is-active bg-muted text-foreground')}
                  end={end}
                  key={key}
                  title={t(`dashboard.shell.${key}`)}
                  to={to}
                >
                  <Icon aria-hidden="true" className="size-[1.125rem] shrink-0" />
                  <span className="hidden xl:block">{t(`dashboard.shell.${key}`)}</span>
                  {key !== 'overview' && <span className="sr-only">{t('dashboard.shell.live')}</span>}
                </NavLink>
              ))}
              <div className="my-3 hidden border-t border-border xl:block" />
            </div>
          </nav>
          <div className="border-t border-border p-3">
            <span className="hidden items-center gap-2 text-xs text-muted-foreground xl:flex"><CircleHelp aria-hidden="true" className="size-4" />{t('dashboard.shell.demoNotice')}</span>
            <span aria-label={t('dashboard.shell.demoNotice')} className="mx-auto grid size-9 place-items-center rounded-full bg-muted text-primary xl:hidden"><CircleHelp aria-hidden="true" className="size-4" /></span>
          </div>
        </aside>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col md:ps-[5.25rem] xl:ps-64">
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6 lg:px-8">
            <h1 className="min-w-0 truncate text-base font-bold sm:text-lg">{pageTitle}</h1>
            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              <LanguageSwitcher />
              <ThemeToggle />
              <NotificationBell />
              <details className="relative ms-1">
                <summary aria-label={t('navbar.accountMenuLabel', { name: user?.first_name ?? '' })} className="grid size-10 cursor-pointer list-none place-items-center rounded-full border border-border bg-muted text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
                  {(user?.first_name?.[0] ?? 'W').toLocaleUpperCase()}
                </summary>
                <div className="absolute end-0 top-12 z-30 w-56 rounded-md border border-border bg-card p-2 shadow-lg">
                  <p className="truncate px-3 py-2 text-sm font-semibold">{user?.first_name} {user?.last_name}</p>
                  <p className="truncate px-3 pb-2 text-xs text-muted-foreground">{user?.email}</p>
                  <div className="border-t border-border pt-2">
                    {user?.role === 'admin' && <NavLink className="flex min-h-10 items-center rounded-md px-3 text-sm font-medium hover:bg-accent" to="/admin">{adminT('nav.panel')}</NavLink>}
                    <Button className="w-full justify-start" onClick={handleLogout} variant="ghost"><LogOut aria-hidden="true" />{t('navbar.logOut')}</Button>
                  </div>
                </div>
              </details>
            </div>
          </header>

          <main aria-label={pageTitle} className="min-w-0 flex-1 pb-24 md:pb-8" id="dashboard-main" ref={mainRef} tabIndex={-1}>
            <div className="mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
              <Outlet />
            </div>
          </main>

          <nav aria-label={t('dashboard.shell.mobileNavigation')} className="fixed inset-x-0 bottom-0 z-30 grid h-[4.25rem] grid-cols-3 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
            <NavLink aria-label={t('dashboard.shell.overview')} className={({ isActive }) => cn('dashboard-mobile-link flex flex-col items-center justify-center gap-1 text-[0.68rem] font-semibold text-muted-foreground', isActive && 'is-active text-primary')} end to="/dashboard"><LayoutDashboard aria-hidden="true" className="size-[1.125rem]" />{t('dashboard.shell.overview')}</NavLink>
            <NavLink aria-label={t('dashboard.shell.transactions')} className={({ isActive }) => cn('dashboard-mobile-link flex flex-col items-center justify-center gap-1 text-[0.68rem] font-semibold text-muted-foreground', isActive && 'is-active text-primary')} to="/dashboard/transactions"><ArrowDownLeft aria-hidden="true" className="size-[1.125rem]" />{t('dashboard.shell.transactions')}</NavLink>
            <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
              <SheetTrigger className="flex flex-col items-center justify-center gap-1 text-[0.68rem] font-semibold text-muted-foreground"><MoreHorizontal aria-hidden="true" className="size-[1.125rem]" />{t('dashboard.shell.more')}</SheetTrigger>
              <SheetContent aria-describedby={undefined} className="pb-[calc(1.5rem+env(safe-area-inset-bottom))]" side="bottom">
                <SheetHeader><SheetTitle>{t('dashboard.shell.more')}</SheetTitle></SheetHeader>
                <div className="mt-5 grid gap-2">
                  {liveItems.filter(({ key }) => key !== 'overview' && key !== 'transactions').map(({ to, key, icon: Icon }) => <NavLink className="flex min-h-12 items-center gap-3 rounded-md border border-border px-3 text-sm font-medium" key={key} onClick={() => setMoreOpen(false)} to={to}><Icon aria-hidden="true" className="size-4" /><span>{t(`dashboard.shell.${key}`)}</span></NavLink>)}
                  <Button className="mt-2 justify-start" onClick={handleLogout} variant="outline"><LogOut aria-hidden="true" />{t('navbar.logOut')}</Button>
                </div>
              </SheetContent>
            </Sheet>
          </nav>
        </div>
      </div>
    </div>
  )
}
