// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { PasswordStrength } from './password-strength'

afterEach(cleanup)

function StrengthHarness() {
  const [password, setPassword] = useState('')
  return (
    <>
      <label htmlFor="strength-password">Password</label>
      <input id="strength-password" onChange={(event) => setPassword(event.target.value)} value={password} />
      <PasswordStrength password={password} />
    </>
  )
}

describe('PasswordStrength', () => {
  it('updates the meter and checklist as the password changes', () => {
    render(<StrengthHarness />)
    const meter = screen.getByRole('progressbar')

    expect(meter.getAttribute('aria-valuenow')).toBe('0')
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'LongEnough1A' } })

    expect(meter.getAttribute('aria-valuenow')).toBe('4')
    expect(screen.getByText('At least 10 characters').closest('li')?.querySelector('svg')?.getAttribute('class')).toContain('text-primary')
    expect(screen.getByText('One uppercase letter').closest('li')?.querySelector('svg')?.getAttribute('class')).toContain('text-primary')
    expect(screen.getByText('One lowercase letter').closest('li')?.querySelector('svg')?.getAttribute('class')).toContain('text-primary')
    expect(screen.getByText('One number').closest('li')?.querySelector('svg')?.getAttribute('class')).toContain('text-primary')
  })
})