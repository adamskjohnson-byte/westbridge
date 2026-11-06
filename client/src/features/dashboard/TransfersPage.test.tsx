// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TransfersPage } from './TransfersPage'

const apiMocks = vi.hoisted(() => ({
  getMoneyAccounts: vi.fn(),
  getBeneficiaries: vi.fn(),
  getDailyLimit: vi.fn(),
  lookupRecipient: vi.fn(),
  createTransfer: vi.fn(),
  getTransfers: vi.fn(),
  createBeneficiary: vi.fn(),
  deleteBeneficiary: vi.fn(),
}))

vi.mock('./money-api', () => apiMocks)

const accounts = [
  { id: 1, type: 'checking', nickname: 'Everyday', number_masked: '•••• 1111', currency: 'USD', balance_cents: 10000, status: 'active' },
  { id: 2, type: 'savings', nickname: 'Reserve', number_masked: '•••• 2222', currency: 'USD', balance_cents: 2500, status: 'active' },
]
const transferReceipt = {
  id: '01JTRANSFER', reference: '01JREFERENCE', status: 'completed', amount_cents: 1234, currency: 'USD', memo: null,
  from: { account_id: 1, type: 'checking', number_masked: '•••• 1111' },
  to: { type: 'own', number_masked: '•••• 2222', holder_masked: 'J*** D***' },
  created_at: '2026-11-03T12:00:00Z', balance_after_cents: 8766,
}

function renderTransfers() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const router = createMemoryRouter([{ path: '/dashboard/transfers', element: <TransfersPage /> }], { initialEntries: ['/dashboard/transfers'] })
  return render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>)
}

async function openReview() {
  await screen.findByRole('combobox', { name: 'From account' })
  fireEvent.change(screen.getByLabelText('Amount in dollars'), { target: { value: '12.34' } })
  fireEvent.click(screen.getByRole('button', { name: 'Review transfer' }))
  await screen.findByText('Review', { selector: 'h3' })
}

describe('TransfersPage', () => {
  beforeEach(() => {
    apiMocks.getMoneyAccounts.mockResolvedValue(accounts)
    apiMocks.getBeneficiaries.mockResolvedValue([])
    apiMocks.getDailyLimit.mockResolvedValue({ daily_limit_cents: 500000, used_today_cents: 0, remaining_cents: 500000, resets_at: '2026-11-04T00:00:00Z' })
    apiMocks.getTransfers.mockResolvedValue({ data: [], meta: { page: 1, per_page: 15, total: 0, last_page: 1 } })
    apiMocks.lookupRecipient.mockResolvedValue({ account_type: 'checking', holder_masked: 'J*** D***', currency: 'USD' })
    apiMocks.createBeneficiary.mockResolvedValue({ id: 7, name: 'Jordan Doe', nickname: null, number_masked: '•••• 9999', created_at: '2026-11-03T00:00:00Z' })
    apiMocks.deleteBeneficiary.mockResolvedValue(undefined)
    apiMocks.createTransfer.mockReset()
  })

  it('shows exact cents and projected balance in Review', async () => {
    renderTransfers()
    await openReview()
    expect(screen.getByText('$12.34')).toBeTruthy()
    expect(screen.getByText('$87.66')).toBeTruthy()
    expect(screen.getByText('$0.00')).toBeTruthy()
  })

  it('requires confirmation of a looked-up recipient before Review', async () => {
    renderTransfers()
    await screen.findByRole('combobox', { name: 'From account' })
    fireEvent.click(screen.getByRole('button', { name: 'New recipient' }))
    fireEvent.change(screen.getByLabelText('10-digit account number'), { target: { value: '1234567890' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(await screen.findByText('Verified account holder: J*** D***')).toBeTruthy()
    expect(apiMocks.lookupRecipient).toHaveBeenCalledTimes(1)
    fireEvent.change(screen.getByLabelText('Amount in dollars'), { target: { value: '5.00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Review transfer' }))
    expect(await screen.findByText('Check the recipient confirmation before continuing.')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Review' })).toBeNull()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Is this who you mean: J*** D***?' }))
    fireEvent.click(screen.getByRole('button', { name: 'Review transfer' }))
    expect(await screen.findByText('Review', { selector: 'h3' })).toBeTruthy()
  })

  it('prevents duplicate submit and reuses the key after network failure', async () => {
    let finishRequest: ((value: typeof transferReceipt) => void) | undefined
    apiMocks.createTransfer
      .mockRejectedValueOnce(new TypeError('network down'))
      .mockImplementationOnce(() => new Promise((resolve) => { finishRequest = resolve }))
    renderTransfers()
    await openReview()
    const confirmButton = screen.getByRole('button', { name: 'Confirm transfer' })
    fireEvent.click(confirmButton)
    const networkAlert = await screen.findByRole('alert')
    expect(networkAlert.textContent).toContain('Unable to connect. Check your connection and try again.')
    const retryButton = screen.getByRole('button', { name: 'Confirm transfer' })
    act(() => { fireEvent.click(retryButton); fireEvent.click(retryButton) })
    await waitFor(() => expect(apiMocks.createTransfer).toHaveBeenCalledTimes(2))
    const firstKey = apiMocks.createTransfer.mock.calls[0][1]
    expect(apiMocks.createTransfer.mock.calls[1][1]).toBe(firstKey)
    expect(screen.getByRole('button', { name: 'Sending…' }).hasAttribute('disabled')).toBe(true)
    await act(async () => { finishRequest?.(transferReceipt) })
    await screen.findByText('Transfer complete')
  })

  it('creates a new idempotency key after a successful transfer', async () => {
    apiMocks.createTransfer.mockResolvedValue(transferReceipt)
    renderTransfers()
    await openReview()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm transfer' }))
    await screen.findByText('Transfer complete')
    const firstKey = apiMocks.createTransfer.mock.calls[0][1]
    fireEvent.click(screen.getByRole('button', { name: 'Make another transfer' }))
    await screen.findByRole('combobox', { name: 'From account' })
    fireEvent.change(screen.getByLabelText('Amount in dollars'), { target: { value: '12.34' } })
    fireEvent.click(screen.getByRole('button', { name: 'Review transfer' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm transfer' }))
    await waitFor(() => expect(apiMocks.createTransfer).toHaveBeenCalledTimes(2))
    expect(apiMocks.createTransfer.mock.calls[1][1]).not.toBe(firstKey)
  })
})