import { ApiError } from './api'

export type ApiTranslator = (key: string) => string

function translatedOrNull(translate: ApiTranslator, key: string): string | null {
  const value = translate(key)
  return value === key ? null : value
}

export function apiFieldErrorMessage(error: ApiError, field: string, translate: ApiTranslator): string {
  const fieldKey = error.fieldErrors[field]?.[0]
  if (!fieldKey) return translate('apiErrors.generic')

  return translatedOrNull(translate, `apiErrors.${fieldKey}`) ?? translate('apiErrors.generic')
}

export function apiErrorMessage(error: unknown, translate: ApiTranslator): string {
  if (error instanceof ApiError) {
    const firstFieldKey = Object.values(error.fieldErrors).flat()[0]
    if (firstFieldKey) {
      const fieldMessage = translatedOrNull(translate, `apiErrors.${firstFieldKey}`)
      if (fieldMessage) return fieldMessage
    }

    if (error.code) {
      const codeMessage = translatedOrNull(translate, `apiErrors.${error.code}`)
      if (codeMessage) return codeMessage
    }

    return translate('apiErrors.generic')
  }

  if (error instanceof TypeError) return translate('apiErrors.network_error')

  return translate('apiErrors.generic')
}