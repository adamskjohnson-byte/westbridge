import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Activity, ClipboardList, CreditCard, LayoutDashboard, LogOut, Menu, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { useAuth } from '@/features/auth/auth-provider'
import { usePageTitle } from '@/hooks/use-page-title'
import { cn } from '@/lib/utils'

const items = [
  { to: '/admin', key: 'overview', icon: LayoutDashboard, end: true },
  { to: '/admin/users', key: 'users', icon: Users, end: false },
  { to: '/admin/transactions', key: 'transactions', icon: CreditCard, end: false },
  { to: '/admin/support', key: 'support', icon: Activity, end: false },
  { to: '/admin/audit', key: 'audit', icon: ClipboardList, end: false },
] as const

export function AdminLayout() {
  const { t } = useTranslation('admin')
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const titleKey = location.pathname.startsWith('/admin/users') ? 'users.title'
    : location.pathname.startsWith('/admin/transactions') ? 'transactions.title'
      : location.pathname.startsWith('/admin/support') ? 'support.title'
        : location.pathname.startsWith('/admin/audit') ? 'audit.title' : 'overview.title'
  usePageTitle(t(titleKey), t('brand'))

  async function signOut() {
    await logout()
    navigate('/login', { replace: true })
  }

  function navLinks(mobile = false) {
    return items.map(({ to, key, icon: Icon, end }) => <NavLink aria-label={t(`nav.${key}`)} className={({ isActive }) => cn('flex min-h-11 items-center gap-3 rounded-sm px-3 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground', isActive && 'bg-muted text-foreground')} end={end} key={key} onClick={() => mobile && setMobileOpen(false)} to={to}><Icon aria-hidden="true" className="size-4 shrink-0"/><span>{t(`nav.${key}`)}</span></NavLink>)
  }

  return <div className="min-h-screen bg-background text-foreground">
    <div className="flex min-h-screen">
      <aside aria-label={t('nav.navigation')} className="fixed inset-y-0 start-0 z-30 hidden w-60 flex-col border-e border-border bg-card md:flex">
        <div className="flex h-16 items-center gap-3 border-b border-border px-5"><span className="grid size-8 place-items-center bg-primary text-primary-foreground"><Activity aria-hidden="true" className="size-4"/></span><span className="font-bold">Westbridge <span className="text-primary">{t('brand')}</span></span></div>
        <nav className="grid gap-1 p-3">{navLinks()}</nav>
        <div className="mt-auto border-t border-border p-3"><NavLink className="flex min-h-10 items-center gap-3 px-3 text-sm text-muted-foreground hover:text-foreground" to="/dashboard"><LayoutDashboard aria-hidden="true" className="size-4"/>{t('nav.customerDashboard')}</NavLink><Button className="mt-1 w-full justify-start" onClick={() => void signOut()} variant="ghost"><LogOut aria-hidden="true" className="size-4"/>{t('nav.signOut')}</Button></div>
      </aside>
      <div className="flex min-h-screen min-w-0 flex-1 flex-col md:ps-60">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-3"><Sheet open={mobileOpen} onOpenChange={setMobileOpen}><SheetTrigger asChild><Button aria-label={t('nav.navigation')} className="md:hidden" size="icon" variant="ghost"><Menu aria-hidden="true"/></Button></SheetTrigger><SheetContent aria-describedby={undefined} side="left"><SheetHeader><SheetTitle>{t('brand')}</SheetTitle></SheetHeader><nav className="mt-5 grid gap-1">{navLinks(true)}<NavLink className="flex min-h-11 items-center gap-3 px-3 text-sm" onClick={() => setMobileOpen(false)} to="/dashboard">{t('nav.customerDashboard')}</NavLink></nav></SheetContent></Sheet><h1 className="truncate text-base font-bold">{t(titleKey)}</h1><span className="border border-primary px-2 py-1 text-[0.65rem] font-bold uppercase text-primary">{t('brand')}</span></div>
          <div className="flex shrink-0 items-center gap-2"><NavLink className="hidden text-sm font-medium text-muted-foreground underline sm:inline" to="/dashboard">{t('nav.customerDashboard')}</NavLink><ThemeToggle/><Button aria-label={t('nav.signOut')} onClick={() => void signOut()} size="icon" variant="ghost"><LogOut aria-hidden="true"/></Button></div>
        </header>
        <main className="min-w-0 flex-1 pb-20 md:pb-8" id="admin-main" tabIndex={-1}><div className="mx-auto w-full max-w-[96rem] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8"><Outlet/></div><footer className="border-t border-border px-4 py-4 text-center text-xs text-muted-foreground">{t('footerDisclaimer')}</footer></main>
      </div>
    </div>
    <nav aria-label={t('nav.navigation')} className="fixed inset-x-0 bottom-0 z-30 grid h-16 grid-cols-5 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden">{items.map(({to,key,icon:Icon,end})=><NavLink aria-label={t(`nav.${key}`)} className={({isActive})=>cn('flex flex-col items-center justify-center gap-1 text-[0.65rem] font-semibold text-muted-foreground',isActive&&'text-primary')} end={end} key={key} to={to}><Icon aria-hidden="true" className="size-[1.125rem]"/><span>{t(`nav.${key}`)}</span></NavLink>)}</nav>
    <span className="sr-only">{user?.email}</span>
  </div>
}
