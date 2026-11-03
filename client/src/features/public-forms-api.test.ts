import { afterEach, describe, expect, it, vi } from 'vitest'
import { submitContactMessage } from '@/features/contact/api'
import { submitNewsletterSignup } from '@/features/newsletter/api'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('public form API', () => {
  it('posts newsletter signup data to the versioned endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Thanks for subscribing.' }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await submitNewsletterSignup({ email: 'reader@example.test' })

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/newsletter$/),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'reader@example.test' }),
      }),
    )
  })

  it('posts contact data including the honeypot field', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "Message received. We'll reply soon." }), { status: 201 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const values = {
      name: 'Riley Example',
      email: 'riley@example.test',
      subject: 'Transfer question',
      message: 'I have a question about a scheduled transfer.',
      website: '',
    }

    await submitContactMessage(values)

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/contact$/),
      expect.objectContaining({ method: 'POST', body: JSON.stringify(values) }),
    )
  })
})