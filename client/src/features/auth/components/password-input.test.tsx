// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { PasswordInput } from './password-input'

afterEach(cleanup)

describe('PasswordInput', () => {
  it('keeps left-to-right text when the password is revealed', () => {
    render(<PasswordInput aria-label="Password" />)

    const input = screen.getByLabelText('Password')
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }))

    expect(input.getAttribute('type')).toBe('text')
    expect(input.getAttribute('dir')).toBe('ltr')
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeTruthy()
  })
})