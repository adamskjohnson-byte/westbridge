// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DashboardLayout } from './DashboardLayout'

vi.mock('@/features/auth/auth-provider', () => ({ useAuth: () => ({ user: { first_name: 'Jamie', last_name: 'River', email: 'jamie@example.test' }, logout: vi.fn() }) }))
vi.mock('@/components/layout/LanguageSwitcher', () => ({ LanguageSwitcher: () => null }))
vi.mock('@/components/layout/theme-toggle', () => ({ ThemeToggle: () => null }))
vi.mock('@/components/layout/logo', () => ({ Logo: () => <span>Westbridge</span> }))

afterEach(cleanup)

function renderShell() {
  return render(<MemoryRouter initialEntries={['/dashboard/transactions']}><Routes><Route element={<DashboardLayout />} path="/dashboard"><Route element={<p>Transactions view</p>} path="transactions" /></Route></Routes></MemoryRouter>)
}

describe('DashboardLayout', () => {
  it('marks the active route and keeps upcoming destinations out of the tab order', () => {
    renderShell()
    const transactionLinks = screen.getAllByRole('link', { name: 'Transactions' })
    expect(transactionLinks.length).toBeGreaterThan(0)
    expect(transactionLinks.every((link) => link.getAttribute('aria-current') === 'page')).toBe(true)

    const transfers = screen.getByText('Transfers')
    expect(transfers.closest('a')).toBeNull()
    expect(transfers.closest('[aria-disabled="true"]')?.hasAttribute('tabindex')).toBe(false)
    expect(screen.getByText('Transactions view')).toBeTruthy()
  })
})
