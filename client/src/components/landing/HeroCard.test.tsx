// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { i18n, i18nReady } from '@/i18n'
import { HeroCard } from './HeroCard'

function luhnValid(number: string): boolean {
  const digits = number.replace(/\D/g, '').split('').reverse().map(Number)
  const sum = digits.reduce((total, digit, index) => {
    if (index % 2 === 1) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    return total + digit
  }, 0)
  return sum % 10 === 0
}

function mockPreferences(reducedMotion: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: query.includes('prefers-reduced-motion') ? reducedMotion : true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  void i18n.changeLanguage('en')
})

describe('HeroCard', () => {
  it('renders the accessible decorative label and bank name', () => {
    mockPreferences(false)
    render(<HeroCard />)

    expect(screen.getByRole('img', { name: 'Illustration of a Westbridge debit card (demo, not a real card)' })).toBeTruthy()
    expect(screen.getByText('WESTBRIDGE NATIONAL BANK')).toBeTruthy()
  })

  it('pseudo-wraps translated content after English landing resources have loaded', async () => {
    await i18nReady
    await i18n.changeLanguage('en')
    await i18n.loadNamespaces('landing')
    await i18n.changeLanguage('pseudo')
    render(<HeroCard />)

    expect(screen.getAllByText(/^⟦.*⟧$/u).length).toBeGreaterThan(0)
  })

  it('uses the fictional card number which is not valid under Luhn', () => {
    mockPreferences(true)
    render(<HeroCard />)

    expect(screen.getByText('6248 0000 0000 2105')).toBeTruthy()
    expect(luhnValid('6248 0000 0000 2105')).toBe(false)
  })

  it('does not apply motion or tilt handlers when reduced motion is preferred', () => {
    mockPreferences(true)
    render(<HeroCard />)
    const wrapper = screen.getByRole('img', { name: 'Illustration of a Westbridge debit card (demo, not a real card)' })

    expect(wrapper.className).not.toContain('tilt-enabled')
    expect(wrapper.querySelector('.hero-card-motion')).toBeNull()
    expect(wrapper.querySelector('.hero-card-tilt')).toBeNull()
    expect(wrapper.onpointermove).toBeNull()
    expect(wrapper.onpointerleave).toBeNull()
  })
})