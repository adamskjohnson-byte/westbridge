import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from './api'

afterEach(() => {
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
})