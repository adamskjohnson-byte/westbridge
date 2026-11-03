import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDirection } from '@radix-ui/react-direction'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { ArrowUpRight, ChevronDown, Menu, X } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Container } from '@/components/layout/container'
import { Logo } from '@/components/layout/logo'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import { primaryLinks } from '@/content/navigation'
import { cn } from '@/lib/utils'
import { useAuth } from '@/features/auth/auth-provider'
import { useScrolled } from '@/hooks/use-scrolled'
import { useTranslatedContent } from '@/i18n/use-translated-content'
import { Ltr } from '@/components/ui/Ltr'

function SiteLinks({ mobile = false, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  const { t } = useTranslation('common')
  const links = useTranslatedContent(primaryLinks, 'common', 'navigation.primaryLinks')
  return (
    <nav aria-label={t('navigation.primaryLabel')} className={cn('flex items-center', mobile ? 'flex-col items-stretch gap-1' : 'gap-6')}>
      {links.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          onClick={onNavigate}
          className={({ isActive }) => cn('nav-link px-2', mobile && 'mobile-nav-link w-full py-3 text-base', isActive && 'font-bold')}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}

export function Navbar() {
  const { t } = useTranslation('common')
  const direction = useDirection()
  const { user, isLoading, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isScrolled = useScrolled(8)
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSettled: () => navigate('/', { replace: true }),
  })
  const initials = user ? `${user.first_name[0] ?? ''}${user.last_name[0] ?? ''}`.toUpperCase() : ''
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const previousLocationRef = useRef(`${location.pathname}${location.search}${location.hash}`)
  const originalOverflowRef = useRef('')

  function closeMenu(returnFocus = true) {
    setMenuOpen(false)
    if (returnFocus) requestAnimationFrame(() => menuButtonRef.current?.focus())
  }

  useEffect(() => {
    const currentLocation = `${location.pathname}${location.search}${location.hash}`
    if (previousLocationRef.current !== currentLocation) {
      previousLocationRef.current = currentLocation
      if (menuOpen) closeMenu()
    }
  }, [location.pathname, location.search, location.hash, menuOpen])

  useEffect(() => {
    if (!menuOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu()
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) closeMenu()
    }
    const desktopQuery = window.matchMedia('(min-width: 1024px)')
    const onBreakpointChange = (event: MediaQueryListEvent) => {
      if (event.matches) closeMenu()
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    desktopQuery.addEventListener('change', onBreakpointChange)

    const panel = panelRef.current
    const availableHeight = window.innerHeight - (headerRef.current?.getBoundingClientRect().bottom ?? 0)
    if (panel && panel.scrollHeight > availableHeight) {
      originalOverflowRef.current = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      panel.style.maxHeight = `${Math.max(availableHeight - 16, 0)}px`
      panel.style.overflowY = 'auto'
    }

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
      desktopQuery.removeEventListener('change', onBreakpointChange)
      document.body.style.overflow = originalOverflowRef.current
      if (panel) {
        panel.style.maxHeight = ''
        panel.style.overflowY = ''
      }
    }
  }, [menuOpen])

  function accountMenu(mobile = false) {
    if (!user) return null
    const menuItems = (
      <>
        <div className="border-b border-border px-3 py-3">
          <p className="font-semibold text-foreground">{user.first_name} {user.last_name}</p>
          <p className="break-all text-xs text-muted-foreground"><Ltr>{user.email}</Ltr></p>
        </div>
        <Link className="block min-h-11 px-3 py-3 text-sm font-semibold hover:bg-accent" onClick={mobile ? () => closeMenu() : undefined} to="/dashboard">{t('navbar.dashboard')}</Link>
        <button
          className="min-h-11 w-full px-3 py-3 text-start text-sm font-semibold hover:bg-accent disabled:opacity-50"
          disabled={logoutMutation.isPending}
          onClick={() => {
            closeMenu()
            logoutMutation.mutate()
          }}
          type="button"
        >
          {logoutMutation.isPending ? t('navbar.loggingOut') : t('navbar.logOut')}
        </button>
      </>
    )

    return (
      <details className={mobile ? 'w-full' : 'relative'}>
        <summary
          aria-label={t('navbar.accountMenuLabel', { name: `${user.first_name} ${user.last_name}` })}
          className={cn('flex cursor-pointer list-none items-center gap-2 rounded-md p-1.5 hover:bg-accent [&::-webkit-details-marker]:hidden', mobile && 'min-h-11 w-full border border-border p-3')}
        >
          <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{initials}</span>
          {mobile && <span className="flex-1 text-start text-sm font-semibold">{t('navbar.account')}</span>}
          <ChevronDown aria-hidden="true" className="size-4" />
        </summary>
        <div className={cn('z-50 mt-2 overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg', mobile ? 'w-full' : 'absolute end-0 top-full w-64')}>
          {menuItems}
        </div>
      </details>
    )
  }

  const accountActions = (mobile = false) => isLoading ? (
    <div aria-hidden="true" className="h-10 w-40 animate-pulse rounded-md bg-muted" />
  ) : user ? (
    <>
      <Link className={buttonVariants({ variant: 'outline' })} onClick={mobile ? () => closeMenu(false) : undefined} to="/dashboard">{t('navbar.dashboard')}</Link>
      {accountMenu(mobile)}
    </>
  ) : (
    <>
      <Link className={cn(buttonVariants({ variant: 'ghost' }), mobile && 'min-h-11 justify-start px-2')} onClick={mobile ? () => closeMenu() : undefined} to="/login">{t('navbar.login')}</Link>
      <Link className={cn(buttonVariants(), 'btn-gradient', mobile && 'min-h-11 w-full')} onClick={mobile ? () => closeMenu() : undefined} to="/register">
        {t('navbar.openAccount')} <ArrowUpRight aria-hidden="true" className={cn(direction === 'rtl' && 'rtl:-scale-x-100')} />
      </Link>
    </>
  )

  return (
    <header ref={headerRef} className="site-navbar relative" data-scrolled={isScrolled}>
      <Container className="flex h-18 items-center justify-between gap-3">
        <Link aria-label={t('brand.homeLabel')} className="shrink-0" to="/">
          <Logo className="navbar-logo" size={38} />
        </Link>

        <div className="hidden min-w-0 flex-1 items-center justify-end gap-7 lg:flex">
          <SiteLinks />
          <div className="shrink-0">
            <LanguageSwitcher />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            {accountActions()}
          </div>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <ThemeToggle />
          <LanguageSwitcher />
          <Button
            ref={menuButtonRef}
            aria-controls="mobile-navigation"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? t('navbar.closeNavigation') : t('navbar.openNavigation')}
            onClick={() => setMenuOpen((open) => !open)}
            size="icon"
            variant="outline"
          >
            <Menu aria-hidden="true" className="menu-glyph menu-glyph-closed" />
            <X aria-hidden="true" className="menu-glyph menu-glyph-open" />
          </Button>
        </div>
      </Container>

      <div
        aria-hidden={!menuOpen}
        className="mobile-nav-panel lg:hidden"
        data-open={menuOpen}
        id="mobile-navigation"
        inert={!menuOpen}
        ref={panelRef}
      >
        <div className="mobile-nav-panel-inner">
          <SiteLinks mobile onNavigate={() => closeMenu()} />
          <div className="mt-3 grid gap-2 border-t border-border pt-3">
            {accountActions(true)}
          </div>
        </div>
      </div>
    </header>
  )
}
