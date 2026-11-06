import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAppConfig, useAuth } from './auth-provider'
import { AuthSkeleton } from './components/auth-skeleton'

function currentPath(pathname: string, search: string, hash: string): string {
  return `${pathname}${search}${hash}`
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <AuthSkeleton />
  if (!user) {
    const redirect = encodeURIComponent(currentPath(location.pathname, location.search, location.hash))
    return <Navigate replace to={`/login?redirect=${redirect}`} />
  }

  return children
}

export function RequireGuest({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth()

  if (isLoading) return <AuthSkeleton />
  return user ? <Navigate replace to="/dashboard" /> : children
}

export function RequireVerified({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth()
  const appConfig = useAppConfig(Boolean(user && !user.email_verified))

  if (isLoading) return <AuthSkeleton />
  if (!user || user.email_verified) return children
  if (appConfig.isPending) return <AuthSkeleton />
  if (appConfig.data?.email_verification_required !== false) {
    return <Navigate replace to="/verify-notice" />
  }
  return children
}

export function RequireRole({ role, children }: { role: AuthUserRole; children: ReactNode }) {
  const { user, isLoading } = useAuth()

  if (isLoading) return <AuthSkeleton />
  if (!user) return <Navigate replace to="/login" />
  if (user.role !== role) return <Navigate replace to={role === 'admin' ? '/__not-found' : '/dashboard'} />
  return children
}

type AuthUserRole = 'customer' | 'admin'