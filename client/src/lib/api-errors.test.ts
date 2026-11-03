import { describe, expect, it } from 'vitest'
import { ApiError } from './api'
import { apiErrorMessage, apiFieldErrorMessage } from './api-errors'

const messages: Record<string, string> = {
  'apiErrors.generic': 'Something went wrong.',
  'apiErrors.network_error': 'Connection unavailable.',
  'apiErrors.validation.email_taken': 'That email is already in use.',
  'apiErrors.too_many_requests': 'Wait before trying again.',
}

const translate = (key: string): string => messages[key] ?? key

describe('API error translations', () => {
  it('shows a validation key as its translated field message', () => {
    const error = new ApiError(422, {
      code: 'validation_failed',
      errors: { email: ['validation.email_taken'] },
    })

    expect(apiFieldErrorMessage(error, 'email', translate)).toBe('That email is already in use.')
    expect(apiErrorMessage(error, translate)).toBe('That email is already in use.')
  })

  it('maps API codes and falls back for unknown keys', () => {
    expect(apiErrorMessage(new ApiError(429, { code: 'too_many_requests' }), translate)).toBe('Wait before trying again.')
    expect(apiFieldErrorMessage(new ApiError(422, { errors: { email: ['validation.new_unknown_key'] } }), 'email', translate)).toBe('Something went wrong.')
    expect(apiErrorMessage(new TypeError('fetch failed'), translate)).toBe('Connection unavailable.')
  })
})