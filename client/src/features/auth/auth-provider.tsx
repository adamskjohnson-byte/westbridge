import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, setUnauthorizedHandler } from '@/lib/api'
import * as authApi from './api'
import type { AppConfig, AuthUser, LoginPayload, LoginResult, RegisterPayload } from './api'

const meKey = ['me'] as const
const appConfigKey = ['app-config'] as const

type AuthContextValue = {
  user: AuthUser | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (payload: LoginPayload) => Promise<LoginResult>
  verifyTwoFactor: (challengeId: string, code: string) => Promise<AuthUser>
  register: (payload: RegisterPayload) => Promise<AuthUser>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const meQuery = useQuery({
    queryKey: meKey,
    queryFn: async () => {
      try {
        return await authApi.getMe()
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null
        throw error
      }
    },
    retry: false,
  })

  useEffect(() => {
    setUnauthorizedHandler((redirectPath) => {
      queryClient.setQueryData(meKey, null)
      window.location.assign(`/login?redirect=${encodeURIComponent(redirectPath)}`)
    })

    return () => setUnauthorizedHandler(null)
  }, [queryClient])

  async function login(payload: LoginPayload): Promise<LoginResult> {
    const result = await authApi.login(payload)
    if (result.kind === 'authenticated') queryClient.setQueryData(meKey, result.user)
    return result
  }

  async function verifyTwoFactor(challengeId: string, code: string): Promise<AuthUser> {
    const user = await authApi.verifyLoginChallenge(challengeId, code)
    queryClient.setQueryData(meKey, user)
    return user
  }

  async function register(payload: RegisterPayload): Promise<AuthUser> {
    const user = await authApi.register(payload)
    queryClient.setQueryData(meKey, user)
    return user
  }

  async function logout(): Promise<void> {
    try {
      await authApi.logout()
    } finally {
      queryClient.setQueryData(meKey, null)
    }
  }

  const user = meQuery.data ?? null

  return (
    <AuthContext.Provider value={{
      user,
      isLoading: meQuery.isPending,
      isAuthenticated: user !== null,
      login,
      verifyTwoFactor,
      register,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAppConfig(enabled = true) {
  return useQuery<AppConfig>({
    queryKey: appConfigKey,
    queryFn: authApi.getConfig,
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider.')
  return context
}