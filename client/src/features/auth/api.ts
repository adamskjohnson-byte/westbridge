import { api } from '@/lib/api'

export type AuthUser = {
  id: number
  first_name: string
  last_name: string
  email: string
  role: 'customer' | 'admin'
  email_verified: boolean
  created_at: string
}

export type AppConfig = {
  email_verification_required: boolean
}

type ApiEnvelope<T> = {
  message: string
  data: T
}

export type LoginPayload = {
  email: string
  password: string
  remember: boolean
}

export type RegisterPayload = {
  first_name: string
  last_name: string
  email: string
  password: string
  password_confirmation: string
  accept_terms: boolean
}

export async function register(payload: RegisterPayload): Promise<AuthUser> {
  const response = await api<ApiEnvelope<AuthUser>>('/v1/auth/register', { method: 'POST', body: payload })
  return response.data
}

export async function login(payload: LoginPayload): Promise<AuthUser> {
  const response = await api<ApiEnvelope<AuthUser>>('/v1/auth/login', { method: 'POST', body: payload })
  return response.data
}

export async function logout(): Promise<void> {
  await api<void>('/v1/auth/logout', { method: 'POST' })
}

export async function getMe(): Promise<AuthUser> {
  const response = await api<ApiEnvelope<AuthUser>>('/v1/auth/me')
  return response.data
}

export async function getConfig(): Promise<AppConfig> {
  return api<AppConfig>('/v1/config')
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  return api('/v1/auth/forgot-password', { method: 'POST', body: { email } })
}

export async function resetPassword(payload: {
  token: string
  email: string
  password: string
  password_confirmation: string
}): Promise<{ message: string }> {
  return api('/v1/auth/reset-password', { method: 'POST', body: payload })
}

export async function verifyEmail(id: string, hash: string, query: URLSearchParams): Promise<{ message: string }> {
  const signedQuery = new URLSearchParams(query)
  signedQuery.delete('id')
  signedQuery.delete('hash')
  const suffix = signedQuery.size > 0 ? `?${signedQuery.toString()}` : ''

  return api(`/v1/auth/email/verify/${encodeURIComponent(id)}/${encodeURIComponent(hash)}${suffix}`)
}

export async function resendVerification(): Promise<{ message: string }> {
  return api('/v1/auth/email/resend', { method: 'POST' })
}