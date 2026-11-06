// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TransactionsPage } from './TransactionsPage'

const { getDashboardSummary, getAccountTransactions, exportTransactions, toastSuccess, toastError } = vi.hoisted(() => ({
  getDashboardSummary: vi.fn(),
  getAccountTransactions: vi.fn(),
  exportTransactions: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('./api', () => ({ getDashboardSummary, getAccountTransactions, exportTransactions }))
vi.mock('sonner', () => ({ toast: { success: toastSuccess, error: toastError } }))
vi.mock('@/features/auth/auth-provider', () => ({ useAuth: () => ({ user: { first_name: 'Jamie' } }) }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

const account = { id: 8, type: 'checking', nickname: 'Everyday', number_masked: '•••• 4821', currency: 'USD', balance_cents: 50000, status: 'active' }
const transactions = [
  { id: 2, reference: 'REF-CREDIT', direction: 'credit', amount_cents: 1234, balance_after_cents: 51234, currency: 'USD', category: 'deposit', description: 'Payroll credit', counterparty_name: 'Westbridge Payroll', posted_at: '2026-11-02T12:00:00Z' },
  { id: 1, reference: 'REF-DEBIT', direction: 'debit', amount_cents: 500, balance_after_cents: 50000, currency: 'USD', category: 'card', description: 'Coffee shop', counterparty_name: 'Corner Cafe', posted_at: '2026-11-01T10:30:00Z' },
]
const summary = { currency: 'USD', total_balance_cents: 50000, accounts: [account], month: { income_cents: 1234, spending_cents: 500, net_cents: 734 }, series: [], spending_by_category: [], recent: [] }

function LocationView() {
  const location = useLocation()
  return <output data-testid="current-search">{location.search}</output>
}

function renderTransactions(search = '') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={[`/dashboard/transactions${search}`]}><Routes><Route element={<TransactionsPage />} path="/dashboard/transactions" /></Routes><LocationView /></MemoryRouter></QueryClientProvider>)
}

function transactionPage(data = transactions) {
  return { transactions: data, meta: { page: 1, per_page: 10, total: data.length, last_page: 1 } }
}

describe('TransactionsPage', () => {
  it('reads supported filters from the URL and ignores invalid values', async () => {
    getDashboardSummary.mockResolvedValue(summary)
    getAccountTransactions.mockResolvedValue(transactionPage())
    renderTransactions('?page=-4&per_page=11&q=x&direction=sideways&category=invalid&sort=bad')

    await waitFor(() => expect(getAccountTransactions).toHaveBeenCalled())
    expect(getAccountTransactions).toHaveBeenCalledWith(8, { page: 1, per_page: 10 })
  })

  it('changes filters in the URL and resets pagination to page one', async () => {
    getDashboardSummary.mockResolvedValue(summary)
    getAccountTransactions.mockResolvedValue(transactionPage())
    renderTransactions('?page=3&per_page=25&q=groc')
    const direction = await screen.findByLabelText('Direction')
    fireEvent.change(direction, { target: { value: 'credit' } })

    await waitFor(() => expect(screen.getByTestId('current-search').textContent).toContain('direction=credit'))
    const search = new URLSearchParams(screen.getByTestId('current-search').textContent ?? '')
    expect(search.get('page')).toBeNull()
    expect(search.get('per_page')).toBe('25')
    expect(search.get('q')).toBe('groc')
  })

  it('renders category filter chips without React key warnings', async () => {
    getDashboardSummary.mockResolvedValue(summary)
    getAccountTransactions.mockResolvedValue(transactionPage())
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    renderTransactions('?category=card&category=deposit')

    expect(await screen.findAllByRole('button', { name: /Remove filter/ })).toHaveLength(2)
    expect(consoleError).not.toHaveBeenCalledWith(expect.stringContaining('Each child in a list should have a unique "key" prop'))
  })

  it('renders signed credit and debit amounts and opens details with Enter', async () => {
    getDashboardSummary.mockResolvedValue(summary)
    getAccountTransactions.mockResolvedValue(transactionPage())
    renderTransactions()

    const credits = await screen.findAllByText('Payroll credit')
    expect(screen.getAllByText('+$12.34')).toHaveLength(2)
    expect(screen.getAllByText('−$5.00')).toHaveLength(2)
    fireEvent.keyDown(credits.find((item) => item.closest('tr'))!.closest('tr')!, { key: 'Enter' })
    expect(await screen.findByText('Transaction details')).toBeTruthy()
    expect(screen.getByText('REF-CREDIT')).toBeTruthy()
  })

  it('shows a clearable empty state and retries a failed transaction request', async () => {
    getDashboardSummary.mockResolvedValue(summary)
    getAccountTransactions.mockResolvedValueOnce(transactionPage([])).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(transactionPage())
    const { unmount } = renderTransactions('?q=nomatch')
    expect(await screen.findByText('No transactions match your filters')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    await waitFor(() => expect(screen.getByTestId('current-search').textContent).toBe(''))
    await waitFor(() => expect(getAccountTransactions).toHaveBeenCalledTimes(2))
    unmount()

    getAccountTransactions.mockReset().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(transactionPage())
    renderTransactions()
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }))
    expect(await screen.findAllByText('Payroll credit')).toHaveLength(2)
  })

  it('exports the current filters and reports a truncated download', async () => {
    getDashboardSummary.mockResolvedValue(summary)
    getAccountTransactions.mockResolvedValue(transactionPage())
    exportTransactions.mockResolvedValue({ blob: new Blob(['csv']), filename: 'westbridge-4821-20261103.csv', truncated: true })
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn().mockReturnValue('blob:download') })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    renderTransactions('?q=groc&direction=credit&category=card&page=2&per_page=25')

    fireEvent.click(await screen.findByRole('button', { name: 'Export CSV' }))
    await waitFor(() => expect(exportTransactions).toHaveBeenCalledWith(8, { q: 'groc', direction: 'credit', category: ['card'] }))
    expect(toastSuccess).toHaveBeenCalledWith('Exported the first 10,000 rows')
  })

  it('shows the specific rate-limit message when export returns 429', async () => {
    getDashboardSummary.mockResolvedValue(summary)
    getAccountTransactions.mockResolvedValue(transactionPage())
    exportTransactions.mockRejectedValue(Object.assign(new Error('limited'), { status: 429 }))
    renderTransactions()
    fireEvent.click(await screen.findByRole('button', { name: 'Export CSV' }))
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Too many exports, try again in a minute'))
  })
})
