// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DashboardPreview } from './DashboardPreview'

afterEach(cleanup)

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  })
})

describe('DashboardPreview', () => {
  it('renders the section heading, all four benefits, and the accessible mockup label', () => {
    render(<MemoryRouter><DashboardPreview /></MemoryRouter>)

    expect(screen.getByRole('heading', { name: 'A clear view of your everyday finances.' })).toBeTruthy()
    expect(screen.getByText('Spending insights that make patterns easier to spot')).toBeTruthy()
    expect(screen.getByText('Instant alerts when account activity happens')).toBeTruthy()
    expect(screen.getByText('Card controls that keep you in charge')).toBeTruthy()
    expect(screen.getByText('Monthly statements, ready when you need them')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Illustration of the Westbridge online dashboard with sample data' })).toBeTruthy()
  })
})