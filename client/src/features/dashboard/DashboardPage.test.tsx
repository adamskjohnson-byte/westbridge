// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DashboardPage } from './DashboardPage'

const { logoutMock } = vi.hoisted(() => ({ logoutMock: vi.fn().mockResolvedValue(undefined) }))

vi.mock('@/features/auth/auth-provider', () => ({
  useAuth: () => ({
    user: { id: 12, first_name: 'Jamie', last_name: 'River', email: 'jamie@example.test', email_verified: true },
    logout: logoutMock,
  }),
}))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('DashboardPage', () => {
  it('loads scoped account activity and shows exact cents with signed directions', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/v1/accounts')) {
        return new Response(JSON.stringify({ data: [{
          id: 9,
          type: 'checking',
          nickname: 'Everyday checking',
          number_masked: '•••• 4821',
          currency: 'USD',
          balance_cents: 260375,
          status: 'active',
        }] }), { status: 200 })
      }

      return new Response(JSON.stringify({ data: [
        {
          id: 4,
          direction: 'credit',
          amount_cents: 500,
          currency: 'USD',
          category: 'deposit',
          description: 'Cash deposit',
          counterparty_name: 'Branch deposit',
          posted_at: '2026-11-02T12:00:00Z',
        },
        {
          id: 3,
          direction: 'debit',
          amount_cents: 1234,
          currency: 'USD',
          category: 'card',
          description: 'Card purchase',
          counterparty_name: 'Market',
          posted_at: '2026-11-01T12:00:00Z',
        },
      ], meta: { page: 1, per_page: 15, total: 2, last_page: 1 } }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter><DashboardPage /></MemoryRouter>
      </QueryClientProvider>,
    )

    expect(await screen.findByText('Everyday checking')).toBeTruthy()
    expect(screen.getAllByText('$2,603.75')).toHaveLength(2)
    expect(screen.getByText('4821')).toBeTruthy()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(container.textContent).toContain('+$5.00')
    expect(container.textContent).toContain('−$12.34')
  })
})