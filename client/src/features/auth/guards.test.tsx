// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from './auth-provider'
import { RequireVerified } from './guards'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('RequireVerified', () => {
  it('does not redirect an unverified user when verification is not required', async () => {
    const user = {
      id: 8,
      first_name: 'Jamie',
      last_name: 'River',
      email: 'jamie@example.test',
      role: 'customer',
      email_verified: false,
      created_at: '2026-01-01T00:00:00Z',
    }
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/v1/config')) {
        return new Response(JSON.stringify({ email_verification_required: false }), { status: 200 })
      }
      return new Response(JSON.stringify({ data: user }), { status: 200 })
    }))

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/dashboard']}>
            <RequireVerified><p>Protected dashboard</p></RequireVerified>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>,
    )

    expect(await screen.findByText('Protected dashboard')).toBeTruthy()
  })
})