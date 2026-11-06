// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BillsPage } from './BillsPage'

const apiMocks = vi.hoisted(() => ({
  getBillers: vi.fn(),
  getBillPayments: vi.fn(),
  getDailyLimit: vi.fn(),
  getMoneyAccounts: vi.fn(),
  createBillPayment: vi.fn(),
}))

vi.mock('./money-api', () => apiMocks)

const account = { id: 1, type: 'checking', nickname: 'Everyday', number_masked: '•••• 1111', currency: 'USD', balance_cents: 10000, status: 'active' }
const billers = [
  { code: 'north-electric', name: 'Northstar Electric', category: 'electricity' },
  { code: 'river-water', name: 'Riverbend Water', category: 'water' },
]
const payment = {
  id: '01JPAYMENT', biller_code: 'north-electric', biller_name: 'Northstar Electric', reference_number: 'NE12345678',
  amount_cents: 1234, currency: 'USD', status: 'completed', transaction_id: 10, transaction_reference: '01JTXREF', created_at: '2026-11-03T12:00:00Z',
}

function renderBills() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const router = createMemoryRouter([{ path: '/dashboard/bills', element: <BillsPage /> }], { initialEntries: ['/dashboard/bills'] })
  return render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>)
}

async function enterPaymentDetails() {
  await screen.findByRole('button', { name: /Northstar Electric/ })
  fireEvent.click(screen.getByRole('button', { name: /Northstar Electric/ }))
  fireEvent.change(screen.getByLabelText('Reference number'), { target: { value: 'NE12345678' } })
  fireEvent.change(screen.getByLabelText('Amount in dollars'), { target: { value: '12.34' } })
}

describe('BillsPage', () => {
  beforeEach(() => {
    apiMocks.getBillers.mockResolvedValue(billers)
    apiMocks.getBillPayments.mockResolvedValue({ data: [], meta: { page: 1, per_page: 15, total: 0, last_page: 1 } })
    apiMocks.getDailyLimit.mockResolvedValue({ daily_limit_cents: 500000, used_today_cents: 0, remaining_cents: 500000, resets_at: '2026-11-04T00:00:00Z' })
    apiMocks.getMoneyAccounts.mockResolvedValue([account])
    apiMocks.createBillPayment.mockReset()
  })

  it('filters fictional billers by search text', async () => {
    renderBills()
    await screen.findByRole('button', { name: /Northstar Electric/ })
    fireEvent.change(screen.getByRole('textbox', { name: 'Search billers' }), { target: { value: 'water' } })
    expect(screen.getByRole('button', { name: /Riverbend Water/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Northstar Electric/ })).toBeNull()
  })

  it('requires a reference and shows integer-cent totals in Review', async () => {
    renderBills()
    await screen.findByRole('button', { name: /Northstar Electric/ })
    fireEvent.click(screen.getByRole('button', { name: /Northstar Electric/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Review payment' }))
    expect(await screen.findByText('Enter a reference number of 1 to 40 characters.')).toBeTruthy()
    await enterPaymentDetails()
    fireEvent.click(screen.getByRole('button', { name: 'Review payment' }))
    expect(await screen.findByText('Review', { selector: 'h3' })).toBeTruthy()
    expect(screen.getByText('$12.34')).toBeTruthy()
    expect(screen.getByText('$87.66')).toBeTruthy()
    expect(screen.getByText('$0.00')).toBeTruthy()
  })

  it('submits a single request on rapid confirmation clicks with an idempotency key', async () => {
    let finishRequest: ((value: typeof payment) => void) | undefined
    apiMocks.createBillPayment.mockImplementation(() => new Promise((resolve) => { finishRequest = resolve }))
    renderBills()
    await enterPaymentDetails()
    fireEvent.click(screen.getByRole('button', { name: 'Review payment' }))
    await screen.findByText('Review', { selector: 'h3' })
    const confirmButton = screen.getByRole('button', { name: 'Confirm payment' })
    act(() => { fireEvent.click(confirmButton); fireEvent.click(confirmButton) })
    await waitFor(() => expect(apiMocks.createBillPayment).toHaveBeenCalledTimes(1))
    expect(apiMocks.createBillPayment.mock.calls[0][1]).toMatch(/^[0-9a-f-]{36}$/i)
    await act(async () => { finishRequest?.(payment) })
    expect(await screen.findByText('Payment complete')).toBeTruthy()
  })
})