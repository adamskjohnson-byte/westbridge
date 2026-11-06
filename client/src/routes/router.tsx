import { createBrowserRouter, type RouteObject } from 'react-router-dom'
import { AppLayout } from '@/components/layout/app-layout'
import { AuthLayout } from '@/features/auth/auth-layout'
import { RequireAuth, RequireGuest, RequireRole, RequireVerified } from '@/features/auth/guards'
import { DashboardLayout } from '@/features/dashboard/DashboardLayout'
import { OverviewPage } from '@/features/dashboard/OverviewPage'
import { TransactionsPage } from '@/features/dashboard/TransactionsPage'
import { TransfersPage } from '@/features/dashboard/TransfersPage'
import { BillsPage } from '@/features/dashboard/BillsPage'
import { CardsPage } from '@/features/dashboard/CardsPage'
import { InsightsPage } from '@/features/dashboard/InsightsPage'
import { NotificationsPage } from '@/features/dashboard/NotificationsPage'
import { SettingsPage } from '@/features/dashboard/SettingsPage'
import { AdminLayout } from '@/features/admin/AdminLayout'
import { AdminAuditPage, AdminOverviewPage, AdminSupportPage, AdminTransactionPage, AdminUserDetailPage, AdminUsersPage } from '@/features/admin/AdminPages'
import { ForgotPasswordPage, ResetPasswordPage } from '@/features/auth/pages/password-pages'
import { LoginPage } from '@/features/auth/pages/login-page'
import { RegisterPage } from '@/features/auth/pages/register-page'
import { VerifyEmailPage, VerifyNoticePage } from '@/features/auth/pages/verification-pages'
import { Design } from '@/pages/Design'
import { Home } from '@/pages/Home'
import { NotFound } from '@/pages/NotFound'
import { PhotoCreditsPage } from '@/components/layout/PhotoCreditsPage'
import {
  AboutPage,
  BlogPage,
  BlogPostPage,
  BusinessPage,
  ContactPage,
  FaqPage,
  LegalPage,
  LoansPage,
  PersonalPage,
  ProductsPage,
  RatesPage,
  SecurityPage,
} from '@/pages/PublicPages'

const routes: RouteObject[] = [
  { index: true, element: <Home /> },
  { path: 'about', element: <AboutPage /> },
  { path: 'personal', element: <PersonalPage /> },
  { path: 'business', element: <BusinessPage /> },
  { path: 'products', element: <ProductsPage /> },
  { path: 'loans', element: <LoansPage /> },
  { path: 'rates', element: <RatesPage /> },
  { path: 'security', element: <SecurityPage /> },
  { path: 'faq', element: <FaqPage /> },
  { path: 'contact', element: <ContactPage /> },
  { path: 'blog', element: <BlogPage /> },
  { path: 'blog/:slug', element: <BlogPostPage /> },
  { path: 'privacy', element: <LegalPage page="privacy" /> },
  { path: 'terms', element: <LegalPage page="terms" /> },
  { path: 'cookies', element: <LegalPage page="cookies" /> },
  { path: 'photo-credits', element: <PhotoCreditsPage /> },
  {
    path: 'dashboard',
    element: <RequireAuth><RequireVerified><DashboardLayout /></RequireVerified></RequireAuth>,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: 'transactions', element: <TransactionsPage /> },
      { path: 'transfers', element: <TransfersPage /> },
      { path: 'transfers/:transferId', element: <TransfersPage /> },
      { path: 'bills', element: <BillsPage /> },
      { path: 'cards', element: <CardsPage /> },
      { path: 'insights', element: <InsightsPage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'accounts/:id/transactions', element: <TransactionsPage /> },
    ],
  },
  {
    path: 'admin',
    element: <RequireAuth><RequireVerified><RequireRole role="admin"><AdminLayout /></RequireRole></RequireVerified></RequireAuth>,
    children: [
      { index: true, element: <AdminOverviewPage /> },
      { path: 'users', element: <AdminUsersPage /> },
      { path: 'users/:userId', element: <AdminUserDetailPage /> },
      { path: 'transactions', element: <AdminTransactionPage /> },
      { path: 'support', element: <AdminSupportPage /> },
      { path: 'support/:ticketId', element: <AdminSupportPage /> },
      { path: 'audit', element: <AdminAuditPage /> },
    ],
  },
  { path: '*', element: <NotFound /> },
]

const authRoutes: RouteObject[] = [
  { path: 'login', element: <RequireGuest><LoginPage /></RequireGuest> },
  { path: 'register', element: <RequireGuest><RegisterPage /></RequireGuest> },
  { path: 'forgot-password', element: <ForgotPasswordPage /> },
  { path: 'reset-password', element: <ResetPasswordPage /> },
  { path: 'verify-notice', element: <RequireAuth><VerifyNoticePage /></RequireAuth> },
  { path: 'verify-email', element: <VerifyEmailPage /> },
]

if (import.meta.env.DEV) routes.push({ path: 'design', element: <Design /> })
routes.push({ path: '*', element: <NotFound /> })

export const router = createBrowserRouter([
  { element: <AppLayout />, children: routes },
  { element: <AuthLayout />, children: authRoutes },
])