// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CardVisual } from './CardVisual'

vi.mock('@/hooks/use-card-tilt', () => ({ useCardTilt: () => ({ enabled: false, motionEnabled: false, style: {}, handlers: {} }) }))

afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('CardVisual', () => {
  it.each([
    ['frozen', 'Frozen'],
    ['cancelled', 'Cancelled'],
  ] as const)('announces the %s state with text', (status, label) => {
    render(<CardVisual expiry="04/30" holderName="Riley West" last4="1234" status={status}/>)
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain(label)
    expect(screen.getByText(label)).toBeTruthy()
  })
})