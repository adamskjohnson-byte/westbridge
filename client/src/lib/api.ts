const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api'

export class ApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, body: unknown) {
    super(`API request failed with status ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

type ApiRequestOptions = Omit<RequestInit, 'body' | 'credentials'> & {
  body?: unknown
}

export async function api<T>(
  endpoint: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })

  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiError(response.status, body)
  }

  return body as T
}