// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DirectionProvider } from '@radix-ui/react-direction'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeContext } from '@/hooks/use-theme'
import { i18n, i18nReady } from '@/i18n'
import { resolveLanguage } from '@/i18n/languages'
import { Navbar } from './navbar'

vi.mock('@/features/auth/auth-provider', () => ({
  useAuth: () => ({ user: null, isLoading: false, isAuthenticated: false, logout: vi.fn(), login: vi.fn(), register: vi.fn() }),
}))

function LocationText() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}</output>
}

function renderNavbar(initialEntry = '/') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ThemeContext.Provider value={{ theme: 'light', setTheme: vi.fn() }}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <DirectionProvider dir={resolveLanguage(i18n.resolvedLanguage ?? i18n.language).dir}>
            <Navbar />
            <LocationText />
          </DirectionProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeContext.Provider>,
  )
}

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('Navbar', () => {
  it('toggles aria-expanded and the inline mobile panel', () => {
    renderNavbar()
    const button = screen.getByRole('button', { name: 'Open navigation menu' })
    const panel = document.getElementById('mobile-navigation')!

    expect(button.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(button)
    expect(screen.getByRole('button', { name: 'Close navigation menu' }).getAttribute('aria-expanded')).toBe('true')
    expect(panel.getAttribute('data-open')).toBe('true')
  })

  it('closes the mobile panel on Escape and returns focus to the menu button', async () => {
    renderNavbar()
    const button = screen.getByRole('button', { name: 'Open navigation menu' })
    fireEvent.click(button)
    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => expect(screen.getByRole('button', { name: 'Open navigation menu' }).getAttribute('aria-expanded')).toBe('false'))
    expect(document.activeElement).toBe(button)
  })

  it('closes on route change and marks the active link with aria-current', async () => {
    renderNavbar('/personal')
    const activePersonalLinks = screen.getAllByRole('link', { name: 'Personal' })
    expect(activePersonalLinks.some((link) => link.getAttribute('aria-current') === 'page')).toBe(true)

    const menuButton = screen.getByRole('button', { name: 'Open navigation menu' })
    fireEvent.click(menuButton)
    fireEvent.click(screen.getAllByRole('link', { name: 'Business' }).find((link) => link.closest('#mobile-navigation'))!)

    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/business'))
    expect(screen.getByRole('button', { name: 'Open navigation menu' }).getAttribute('aria-expanded')).toBe('false')
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Open navigation menu' })))
  })

  it('keeps the logo before the actions and flips the register arrow only in RTL', async () => {
    await i18nReady
    await i18n.changeLanguage('ar')
    renderNavbar()

    const header = document.querySelector('header.site-navbar')!
    const logo = header.querySelector('a[aria-label]')!
    const registerLink = screen.getAllByRole('link').find((link) => link.getAttribute('href') === '/register')!
    const arrow = registerLink.querySelector('svg')!

    expect(document.documentElement.dir).toBe('rtl')
    expect(header.firstElementChild?.firstElementChild).toBe(logo)
    expect(logo.compareDocumentPosition(registerLink) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(arrow.classList.contains('rtl:-scale-x-100')).toBe(true)

    cleanup()
    await i18n.changeLanguage('en')
    renderNavbar()
    const englishRegisterLink = screen.getAllByRole('link').find((link) => link.getAttribute('href') === '/register')!
    expect(englishRegisterLink.querySelector('svg')?.classList.contains('rtl:-scale-x-100')).toBe(false)
  })
})
