// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DashboardLayout } from './DashboardLayout'

const layoutMocks = vi.hoisted(() => ({
  user: { first_name: 'Jamie', last_name: 'River', email: 'jamie@example.test' },
  logout: vi.fn(),
  setTheme: vi.fn(),
}))
vi.mock('@/features/auth/auth-provider', () => ({ useAuth: () => ({ user: layoutMocks.user, logout: layoutMocks.logout }) }))
vi.mock('@/hooks/use-theme', () => ({ useTheme: () => ({ theme: 'system', setTheme: layoutMocks.setTheme }) }))
vi.mock('./settings-api', () => ({ getSettings: vi.fn().mockResolvedValue({ preferences: { locale: 'en', theme: 'system' } }) }))
vi.mock('@/components/layout/LanguageSwitcher', () => ({ LanguageSwitcher: () => null }))
vi.mock('@/components/layout/theme-toggle', () => ({ ThemeToggle: () => null }))
vi.mock('@/components/layout/logo', () => ({ Logo: () => <span>Westbridge</span> }))

afterEach(cleanup)

function renderShell() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/dashboard/transactions']}><Routes><Route element={<DashboardLayout />} path="/dashboard"><Route element={<p>Transactions view</p>} path="transactions" /></Route></Routes></MemoryRouter></QueryClientProvider>)
}

describe('DashboardLayout', () => {
  it('marks live routes active and exposes enabled destinations', async () => {
    renderShell()
    const transactionLinks = await screen.findAllByRole('link', { name: 'Transactions' })
    expect(transactionLinks.length).toBeGreaterThan(0)
    expect(transactionLinks.every((link) => link.getAttribute('aria-current') === 'page')).toBe(true)

    const transfers = screen.getByText('Transfers')
    expect(transfers.closest('a')?.getAttribute('href')).toBe('/dashboard/transfers')
    const cards = screen.getByText('Cards')
    expect(cards.closest('a')?.getAttribute('href')).toBe('/dashboard/cards')
    expect(screen.getByText('Transactions view')).toBeTruthy()
  })
})
