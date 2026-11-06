import { Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Footer } from '@/components/layout/footer'
import { Navbar } from '@/components/layout/navbar'
import { ScrollToTop } from '@/components/layout/scroll-to-top'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useTheme } from '@/hooks/use-theme'

export function AppLayout() {
  const { t } = useTranslation('common')
  const { theme } = useTheme()
  const { pathname } = useLocation()
  const isDashboard = pathname.startsWith('/dashboard')
  const isAdmin = pathname.startsWith('/admin')
  const isApplication = isDashboard || isAdmin

  return (
    <TooltipProvider>
      <ScrollToTop />
      {!isApplication && <a className="skip-link" href="#main-content">{t('accessibility.skipToContent')}</a>}
      {!isApplication && <Navbar />}
      <Outlet />
      {!isApplication && <Footer />}
      <Toaster theme={theme} />
    </TooltipProvider>
  )
}