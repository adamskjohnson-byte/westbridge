import { api } from '@/lib/api'

export type SettingsData = {
  profile: { first_name: string; last_name: string; email: string; phone: string | null }
  preferences: { locale: string | null; theme: 'light' | 'dark' | 'system'; email_activity: boolean; low_balance_threshold_cents: number | null }
  security: { two_factor_enabled: boolean; two_factor_required: boolean }
}
export type SessionInfo = { id: string; is_current: boolean; browser: string; platform: string; device_type: 'desktop' | 'mobile' | 'tablet' | 'unknown'; ip_masked: string; last_active_at: string }
type Envelope<T> = { data: T }

export async function getSettings(): Promise<SettingsData> { return (await api<Envelope<SettingsData>>('/v1/settings')).data }
export async function updateProfile(payload: Pick<SettingsData['profile'], 'first_name' | 'last_name' | 'phone'>): Promise<void> { await api('/v1/settings/profile', { method: 'PATCH', body: payload }) }
export async function updatePreferences(payload: Partial<SettingsData['preferences']>): Promise<SettingsData['preferences']> { return (await api<Envelope<SettingsData['preferences']>>('/v1/settings/preferences', { method: 'PATCH', body: payload })).data }
export async function changePassword(payload: { current_password: string; password: string; password_confirmation: string }): Promise<void> { await api('/v1/settings/password', { method: 'POST', body: payload }) }
export async function getSessions(): Promise<SessionInfo[]> { return (await api<Envelope<SessionInfo[]>>('/v1/settings/sessions')).data }
export async function revokeSession(id: string): Promise<void> { await api(`/v1/settings/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' }) }
export async function revokeOtherSessions(): Promise<void> { await api('/v1/settings/sessions/revoke-others', { method: 'POST' }) }
export type TwoFactorChallenge = { challenge_id: string; expires_in: number; resend_available_in: number; email_masked: string }
export async function startTwoFactor(payload: { purpose: 'enable' | 'disable'; password: string }): Promise<TwoFactorChallenge> { return (await api<Envelope<TwoFactorChallenge>>('/v1/settings/security/two-factor/start', { method: 'POST', body: payload })).data }
export async function confirmTwoFactor(payload: { challenge_id: string; code: string }): Promise<{ two_factor_enabled: boolean }> { return (await api<Envelope<{ two_factor_enabled: boolean }>>('/v1/settings/security/two-factor/confirm', { method: 'POST', body: payload })).data }