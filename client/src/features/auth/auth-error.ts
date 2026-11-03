import { ApiError } from '@/lib/api'
import { apiErrorMessage } from '@/lib/api-errors'

export function authFailureMessage(error: unknown, fallbackKey: string, translate: (key: string) => string): string {
  if (error instanceof ApiError || error instanceof TypeError) return apiErrorMessage(error, translate)
  return translate(fallbackKey)
}