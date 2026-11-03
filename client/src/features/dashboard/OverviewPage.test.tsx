// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OverviewPage } from './OverviewPage'

const { getDashboardSummary, getAccount } = vi.hoisted(() => ({
  getDashboardSummary: vi.fn(),
  getAccount: vi.fn(),
}))

vi.mock('@/features/auth/auth-provider', () => ({
  useAuth: () => ({ user: { first_name: 'Jamie' } }),
}))

vi.mock('./api', () => ({ getDashboardSummary, getAccount }))
vi.mock('recharts', () => ({
  Bar: () => null,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CartesianGrid: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

function renderOverview() {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}><MemoryRouter><OverviewPage /></MemoryRouter></QueryClientProvider>)
}

function summary(overrides: Record<string, unknown> = {}) {
  return {
    currency: 'USD',
    total_balance_cents: 260375,
    accounts: [{ id: 9, type: 'checking', nickname: 'Everyday checking', number_masked: '•••• 4821', currency: 'USD', balance_cents: 260375, status: 'active' }],
    month: { income_cents: 50000, spending_cents: 12500, net_cents: 37500 },
    series: [{ month: '2026-11', income_cents: 50000, spending_cents: 12500 }],
    spending_by_category: [{ category: 'card', spending_cents: 12500 }],
    recent: [{ id: 4, reference: 'R-4', direction: 'credit', amount_cents: 500, balance_after_cents: 260375, currency: 'USD', category: 'deposit', description: 'Cash deposit', counterparty_name: 'Branch deposit', posted_at: '2026-11-02T12:00:00Z' }],
    ...overrides,
  }
}

describe('OverviewPage', () => {
  it('renders a loading skeleton while the summary request is pending', () => {
    getDashboardSummary.mockReturnValue(new Promise(() => undefined))
    renderOverview()
    expect(screen.getByRole('status')).toBeTruthy()
  })

  it('renders the summary, recent activity, and copies a full number only after click', async () => {
    getDashboardSummary.mockResolvedValue(summary())
    getAccount.mockResolvedValue({ account_number: '1234564821' })
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } })
    renderOverview()

    expect(await screen.findByText('Everyday checking')).toBeTruthy()
    expect(screen.getByText('Cash deposit')).toBeTruthy()
    expect(screen.getAllByText('$2,603.75')).toHaveLength(2)
    expect(getAccount).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Copy full account number' }))
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('1234564821'))
    expect(getAccount).toHaveBeenCalledWith(9)
  })

  it('shows the empty activity message when there are no transactions', async () => {
    getDashboardSummary.mockResolvedValue(summary({ recent: [], spending_by_category: [] }))
    renderOverview()
    expect(await screen.findByText('No activity yet. Your transactions will appear here.')).toBeTruthy()
  })

  it('shows an error and retries the summary request', async () => {
    getDashboardSummary.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(summary())
    renderOverview()
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Everyday checking')).toBeTruthy()
    expect(getDashboardSummary).toHaveBeenCalledTimes(2)
  })
})
