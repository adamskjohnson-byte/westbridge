import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError, setUnauthorizedHandler } from './api'

afterEach(() => {
  setUnauthorizedHandler(null)
  vi.unstubAllGlobals()
})

describe('api', () => {
  it('sends credentialed JSON requests and returns parsed data', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok' }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await api<{ status: string }>('/health')

    expect(result.status).toBe('ok')
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/health$/),
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  it('normalizes non-success responses as ApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Unavailable' }), { status: 503 }),
      ),
    )

    await expect(api('/health')).rejects.toBeInstanceOf(ApiError)
  })

  it('initializes Sanctum CSRF and sends the decoded XSRF cookie on unsafe requests', async () => {
    const cookieDocument = { cookie: '' }
    vi.stubGlobal('document', cookieDocument)
    let csrfFetchCount = 0
    let apiRequestCount = 0
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/sanctum/csrf-cookie')) {
        csrfFetchCount += 1
        cookieDocument.cookie = `XSRF-TOKEN=${csrfFetchCount === 1 ? 'csrf%2Fvalue' : 'fresh%2Fvalue'}`
        return new Response(null, { status: 204 })
      }

      apiRequestCount += 1
      if (apiRequestCount === 1) return new Response(null, { status: 419 })
      return new Response(JSON.stringify({ message: 'Logged in.' }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    await api('/v1/auth/login', { method: 'POST', body: { email: 'user@example.test', password: 'secret' } })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/\/sanctum\/csrf-cookie$/),
      expect.objectContaining({
        credentials: 'include',
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/\/api\/v1\/auth\/login$/),
      expect.objectContaining({
        credentials: 'include',
        headers: expect.objectContaining({ 'X-XSRF-TOKEN': 'csrf/value' }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      expect.stringMatching(/\/sanctum\/csrf-cookie$/),
      expect.objectContaining({ credentials: 'include' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      expect.stringMatching(/\/api\/v1\/auth\/login$/),
      expect.objectContaining({ headers: expect.objectContaining({ 'X-XSRF-TOKEN': 'fresh/value' }) }),
    )
  })

  it('refreshes CSRF and retries once after a 419 response to a read request', async () => {
    const cookieDocument = { cookie: '' }
    vi.stubGlobal('document', cookieDocument)
    let csrfFetchCount = 0
    let apiRequestCount = 0
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/sanctum/csrf-cookie')) {
        csrfFetchCount += 1
        return new Response(null, { status: 204 })
      }

      apiRequestCount += 1
      return apiRequestCount === 1
        ? new Response(null, { status: 419 })
        : new Response(JSON.stringify({ data: { status: 'ok' } }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(api('/v1/ping')).resolves.toEqual({ data: { status: 'ok' } })
    expect(csrfFetchCount).toBe(1)
    expect(apiRequestCount).toBe(2)
  })

  it('exposes API error details and invokes the unauthorized handler for protected endpoints', async () => {
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    vi.stubGlobal('window', {
      location: { pathname: '/accounts', search: '?tab=savings', hash: '#activity' },
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        message: 'This account is suspended.',
        code: 'account_suspended',
        errors: { email: ['This account is suspended.'] },
      }), { status: 401 }),
    ))

    await expect(api('/v1/accounts')).rejects.toMatchObject({
      status: 401,
      message: 'This account is suspended.',
      code: 'account_suspended',
      fieldErrors: { email: ['This account is suspended.'] },
    })
    expect(handler).toHaveBeenCalledWith('/accounts?tab=savings#activity')
  })
})