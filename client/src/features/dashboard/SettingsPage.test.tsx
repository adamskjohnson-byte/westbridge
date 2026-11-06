// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import { SettingsPage } from './SettingsPage'

const mocks = vi.hoisted(() => ({
  settings: vi.fn(), sessions: vi.fn(), updateProfile: vi.fn(), updatePreferences: vi.fn(), changePassword: vi.fn(),
  revokeSession: vi.fn(), revokeOthers: vi.fn(), toastSuccess: vi.fn(), toastError: vi.fn(), setTheme: vi.fn(),
}))
vi.mock('./settings-api', () => ({ getSettings: mocks.settings, getSessions: mocks.sessions, updateProfile: mocks.updateProfile, updatePreferences: mocks.updatePreferences, changePassword: mocks.changePassword, revokeSession: mocks.revokeSession, revokeOtherSessions: mocks.revokeOthers }))
vi.mock('@/features/auth/auth-provider', () => ({ useAuth: () => ({ user: { id: 21 } }) }))
vi.mock('@/hooks/use-theme', () => ({ useTheme: () => ({ theme: 'system', setTheme: mocks.setTheme }) }))
vi.mock('sonner', () => ({ toast: { success: mocks.toastSuccess, error: mocks.toastError } }))

const settings = { profile: { first_name: 'Riley', last_name: 'West', email: 'riley@example.test', phone: null }, preferences: { locale: 'en', theme: 'system' as const, email_activity: true, low_balance_threshold_cents: null }, security: { two_factor_enabled: false, two_factor_required: false } }
function renderPage(tab: 'profile' | 'security' | 'preferences' = 'profile') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter([{ path: '/dashboard/settings', element: <SettingsPage/> }], { initialEntries: [`/dashboard/settings?tab=${tab}`] })
  render(<QueryClientProvider client={client}><RouterProvider router={router}/></QueryClientProvider>)
}

beforeEach(async () => {
  await i18n.changeLanguage('en')
  mocks.settings.mockResolvedValue(settings)
  mocks.sessions.mockResolvedValue([
    { id: 'opaque-current', is_current: true, browser: 'Chrome', platform: 'Windows', device_type: 'desktop', ip_masked: '192.0.2.xxx', last_active_at: '2026-01-01T00:00:00Z' },
    { id: 'opaque-other', is_current: false, browser: 'Firefox', platform: 'Linux', device_type: 'desktop', ip_masked: '192.0.2.xxx', last_active_at: '2026-01-02T00:00:00Z' },
  ])
  mocks.changePassword.mockResolvedValue(undefined)
  mocks.revokeSession.mockResolvedValue(undefined)
  mocks.updatePreferences.mockResolvedValue(settings.preferences)
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('SettingsPage', () => {
  it('requires a strong, matching, changed password before enabling submit', async () => {
    renderPage('security')
    const current = await screen.findByLabelText('Current password')
    const newPassword = screen.getByLabelText('New password')
    const confirmation = screen.getByLabelText('Confirm new password')
    const submit = screen.getByRole('button', { name: 'Update password' })
    fireEvent.change(current, { target: { value: 'Password123!' } })
    fireEvent.change(newPassword, { target: { value: 'weak' } })
    fireEvent.change(confirmation, { target: { value: 'weak' } })
    expect((submit as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(newPassword, { target: { value: 'Password123!' } })
    fireEvent.change(confirmation, { target: { value: 'Password123!' } })
    expect((submit as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(newPassword, { target: { value: 'RenewedPass456' } })
    fireEvent.change(confirmation, { target: { value: 'DifferentPass789' } })
    expect((submit as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(confirmation, { target: { value: 'RenewedPass456' } })
    expect((submit as HTMLButtonElement).disabled).toBe(false)
  })

  it('hides revoke for the current device and confirms revoking another session', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderPage('security')
    const list = await waitFor(() => screen.getAllByRole('list').find((element) => within(element).queryByRole('button', { name: 'Revoke session' })))
    expect(list).toBeTruthy()
    const sessionsList = list as HTMLElement
    expect(within(sessionsList).getAllByRole('button', { name: 'Revoke session' })).toHaveLength(1)
    fireEvent.click(within(sessionsList).getByRole('button', { name: 'Revoke session' }))
    expect(confirm).toHaveBeenCalledOnce()
    await waitFor(() => expect(mocks.revokeSession.mock.calls[0]?.[0]).toBe('opaque-other'))
  })

  it('applies server preferences and reports a failed save without blocking the page', async () => {
    mocks.settings.mockResolvedValue({ ...settings, preferences: { ...settings.preferences, locale: 'ar', theme: 'dark' } })
    renderPage('preferences')
    expect(await screen.findByLabelText('Languages')).toBeTruthy()
    await waitFor(() => expect(mocks.setTheme).toHaveBeenCalledWith('dark'))
    expect((screen.getByLabelText('Languages') as HTMLSelectElement).value).toBe('ar')
    mocks.updatePreferences.mockRejectedValueOnce(new TypeError('network'))
    fireEvent.click(screen.getByRole('button', { name: 'Save preferences' }))
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith(expect.stringContaining('Unable to connect')))
  })
})
