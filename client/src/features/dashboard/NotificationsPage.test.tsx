// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import { NotificationsPage } from './NotificationsPage'
import type { BankNotification } from './notifications-api'

const mocks = vi.hoisted(() => ({ list: vi.fn(), accounts: vi.fn(), read: vi.fn(), readAll: vi.fn(), remove: vi.fn() }))
vi.mock('./notifications-api', () => ({ getNotifications: mocks.list, readNotification: mocks.read, readAllNotifications: mocks.readAll, deleteNotification: mocks.remove }))
vi.mock('./api', () => ({ getDashboardAccounts: mocks.accounts }))
vi.mock('@/features/auth/auth-provider', () => ({ useAuth: () => ({ user: { id: 21 } }) }))

const types = ['transfer_sent', 'transfer_received', 'bill_paid', 'card_purchase', 'card_frozen', 'card_unfrozen', 'card_issued', 'card_cancelled', 'password_changed', 'session_revoked', 'low_balance', 'welcome']
const titles = ['Transfer sent', 'Transfer received', 'Bill paid', 'Card purchase', 'Card frozen', 'Card unfrozen', 'Card issued', 'Card cancelled', 'Password changed', 'Device signed out', 'Low balance', 'Welcome']

beforeEach(async () => {
  await i18n.changeLanguage('en')
  const notifications: BankNotification[] = types.map((type, index) => ({
    id: `notice-${index}`, type,
    params: { amount_cents: 1234, balance_cents: 5000, threshold_cents: 8000, to_masked: 'A*** B***', from_masked: 'C*** D***', biller_name: 'Water Works', merchant: 'Market', last4: '1234', account_type: 'checking' },
    read_at: null, created_at: '2026-01-01T00:00:00Z',
  }))
  notifications.push({ id: 'notice-unknown', type: 'future_type', params: {}, read_at: null, created_at: '2026-01-01T00:00:00Z' })
  mocks.list.mockResolvedValue({ data: notifications, meta: { page: 1, per_page: 15, total: 13, last_page: 1 } })
  mocks.accounts.mockResolvedValue([{ id: 1, type: 'checking' }, { id: 2, type: 'savings' }])
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<MemoryRouter><QueryClientProvider client={client}><NotificationsPage/></QueryClientProvider></MemoryRouter>)
}

describe('NotificationsPage', () => {
  it('renders every typed notification in English, formats money, and falls back for unknown types', async () => {
    renderPage()
    for (const title of titles) expect(await screen.findByText(title)).toBeTruthy()
    expect(screen.getByText('You sent $12.34 to A*** B***.')).toBeTruthy()
    expect(screen.getByText('Your Checking balance is $50.00, below your $80.00 alert.')).toBeTruthy()
    expect(screen.getByText('There\'s a new update on your account.')).toBeTruthy()
  })
})
