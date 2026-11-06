import { api } from '@/lib/api'

export type NewsletterSignupValues = {
  email: string
  turnstile_token?: string
}

export type NewsletterSignupResponse = {
  message: string
}

export function submitNewsletterSignup(values: NewsletterSignupValues) {
  return api<NewsletterSignupResponse>('/v1/newsletter', {
    method: 'POST',
    body: values,
  })
}
