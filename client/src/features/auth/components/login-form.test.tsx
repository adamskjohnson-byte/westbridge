// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LoginForm } from './login-form'

afterEach(cleanup)

describe('LoginForm', () => {
  it('shows validation errors for empty and invalid input', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<MemoryRouter><LoginForm onSubmit={onSubmit} pending={false} serverError={null} /></MemoryRouter>)

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('Enter your email address.')).toBeTruthy()
    expect(await screen.findByText('Enter your password.')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'not-an-email' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    await waitFor(() => expect(screen.getByText('Enter a valid email address.')).toBeTruthy())
    expect(onSubmit).not.toHaveBeenCalled()
  })
})