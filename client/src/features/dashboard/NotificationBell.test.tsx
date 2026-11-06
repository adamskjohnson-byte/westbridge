// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import { NotificationBell } from './NotificationBell'

const mocks = vi.hoisted(() => ({ count: vi.fn(), list: vi.fn(), readAll: vi.fn() }))
vi.mock('./notifications-api', () => ({ getUnreadCount: mocks.count, getNotifications: mocks.list, readAllNotifications: mocks.readAll }))
vi.mock('@/features/auth/auth-provider', () => ({ useAuth: () => ({ user: { id: 21 } }) }))

function renderBell() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<MemoryRouter><QueryClientProvider client={client}><NotificationBell/></QueryClientProvider></MemoryRouter>)
}

beforeEach(async () => {
  await i18n.changeLanguage('en')
  mocks.count.mockReset().mockResolvedValueOnce(3).mockResolvedValue(0)
  mocks.list.mockResolvedValue({ data: [{ id: 'notice-1', type: 'card_purchase', params: { merchant: 'Market', amount_cents: 1234, last4: '1234' }, read_at: null, created_at: '2026-01-01T00:00:00Z' }], meta: { page: 1, per_page: 15, total: 1, last_page: 1 } })
  mocks.readAll.mockResolvedValue(undefined)
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('NotificationBell', () => {
  it('shows the plural unread label, translated latest notification, and clears after mark-all', async () => {
    renderBell()
    const trigger = await screen.findByRole('button', { name: '3 unread notifications' })
    fireEvent.click(trigger)
    expect(await screen.findByText('Card purchase')).toBeTruthy()
    expect(screen.getByText('Market charged $12.34 to card ending in 1234.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Mark all as read/ }))
    await waitFor(() => expect(mocks.readAll).toHaveBeenCalledOnce())
    expect(await screen.findByRole('button', { name: 'Notifications' })).toBeTruthy()
  })
})
