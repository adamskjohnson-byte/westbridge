// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api'
import { i18n } from '@/i18n'
import { CardsPage } from './CardsPage'

const apiMocks = vi.hoisted(() => ({
  getCards: vi.fn(), issueCard: vi.fn(), updateCard: vi.fn(), setCardState: vi.fn(), testCardPurchase: vi.fn(),
  getMoneyAccounts: vi.fn(), getAccountTransactions: vi.fn(), toastError: vi.fn(), toastSuccess: vi.fn(),
}))

vi.mock('@/features/auth/auth-provider', () => ({ useAuth: () => ({ user: { first_name: 'Riley', last_name: 'West' } }) }))
vi.mock('@/hooks/use-card-tilt', () => ({ useCardTilt: () => ({ enabled: false, motionEnabled: false, style: {}, handlers: {} }) }))
vi.mock('./cards-api', async (importOriginal) => ({ ...(await importOriginal<typeof import('./cards-api')>()), ...apiMocks }))
vi.mock('./money-api', async (importOriginal) => ({ ...(await importOriginal<typeof import('./money-api')>()), getMoneyAccounts: apiMocks.getMoneyAccounts }))
vi.mock('./api', async (importOriginal) => ({ ...(await importOriginal<typeof import('./api')>()), getAccountTransactions: apiMocks.getAccountTransactions }))
vi.mock('sonner', () => ({ toast: { error: apiMocks.toastError, success: apiMocks.toastSuccess } }))

const card = { id: 8, account_id: 3, account_type: 'checking' as const, type: 'debit' as const, nickname: 'Everyday', last4: '1234', expiry_month: 4, expiry_year: 2030, status: 'active' as const, daily_limit_cents: 50000, spent_today_cents: 0, created_at: '2026-01-01T00:00:00Z' }

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<MemoryRouter><QueryClientProvider client={queryClient}><CardsPage/></QueryClientProvider></MemoryRouter>)
}

beforeEach(async () => {
  await i18n.changeLanguage('en')
  vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'fresh-idempotency-key') })
  apiMocks.getCards.mockResolvedValue([card])
  apiMocks.getMoneyAccounts.mockResolvedValue([{ id: 3, type: 'checking', status: 'active', nickname: 'Everyday', balance_cents: 10000 }])
  apiMocks.getAccountTransactions.mockResolvedValue({ transactions: [], meta: { page: 1, per_page: 5, total: 0, last_page: 1 } })
  apiMocks.testCardPurchase.mockReset()
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('CardsPage test purchases', () => {
  it('submits only once on a double click', async () => {
    apiMocks.testCardPurchase.mockResolvedValue({ status: 'approved', transaction_id: 50, balance_after_cents: 9000, replayed: false })
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: /try a test purchase/i }))
    fireEvent.change(await screen.findByLabelText('Merchant'), { target: { value: 'Market' } })
    fireEvent.change(screen.getByLabelText('Amount in dollars'), { target: { value: '10.00' } })
    const submit = screen.getByRole('button', { name: 'Submit test purchase' })
    fireEvent.click(submit); fireEvent.click(submit)
    await screen.findByText(/Approved/)
    expect(apiMocks.testCardPurchase).toHaveBeenCalledTimes(1)
    expect(apiMocks.testCardPurchase).toHaveBeenCalledWith(8, { merchant: 'Market', amount_cents: 1000 }, 'fresh-idempotency-key')
  })

  it('reuses the idempotency key after a network error and translates a decline', async () => {
    apiMocks.testCardPurchase.mockRejectedValueOnce(new TypeError('network')).mockRejectedValueOnce(new ApiError(422, { code: 'card_frozen', message: 'declined' }))
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: /try a test purchase/i }))
    fireEvent.change(await screen.findByLabelText('Merchant'), { target: { value: 'Market' } })
    fireEvent.change(screen.getByLabelText('Amount in dollars'), { target: { value: '10.00' } })
    const submit = screen.getByRole('button', { name: 'Submit test purchase' })
    fireEvent.click(submit)
    await waitFor(() => expect(apiMocks.toastError).toHaveBeenCalled())
    fireEvent.click(submit)
    expect(await screen.findByText(/Declined: This card is frozen/)).toBeTruthy()
    expect(apiMocks.testCardPurchase).toHaveBeenCalledTimes(2)
    expect(apiMocks.testCardPurchase.mock.calls[0][2]).toBe(apiMocks.testCardPurchase.mock.calls[1][2])
  })

  it('requires the typed confirmation before cancelling a card', async () => {
    apiMocks.setCardState.mockResolvedValue({ ...card, status: 'cancelled' })
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel card' }))
    const dialog = await screen.findByRole('dialog')
    const cancel = within(dialog).getByRole('button', { name: 'Cancel card' })
    expect((cancel as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(within(dialog).getByLabelText('Type CANCEL to continue'), { target: { value: 'CANCEL' } })
    expect((cancel as HTMLButtonElement).disabled).toBe(false)
  })
})