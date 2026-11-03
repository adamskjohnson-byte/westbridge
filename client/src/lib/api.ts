import { safeRedirect } from './safeRedirect'

const apiBaseUrl = (import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api').replace(/\/+$/, '')
const apiOrigin = apiBaseUrl.replace(/\/api$/i, '')

type FieldErrors = Record<string, string[]>
type UnauthorizedHandler = (redirectPath: string) => void

let csrfReady = false
let csrfRequest: Promise<void> | null = null
let unauthorizedHandler: UnauthorizedHandler | null = null

export class ApiError extends Error {
  readonly status: number
  readonly code: string | null
  readonly fieldErrors: FieldErrors
  readonly errors: FieldErrors
  readonly body: unknown

  constructor(status: number, body: unknown) {
    const payload = isRecord(body) ? body : {}
    super(typeof payload.message === 'string' ? payload.message : `API request failed with status ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.body = body
    this.code = typeof payload.code === 'string' ? payload.code : null
    this.fieldErrors = isRecord(payload.errors) ? payload.errors as FieldErrors : {}
    this.errors = this.fieldErrors
  }
}

type ApiRequestOptions = Omit<RequestInit, 'body' | 'credentials'> & {
  body?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function xsrfToken(): string | null {
  if (typeof document === 'undefined') return null

  const tokenCookie = document.cookie
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith('XSRF-TOKEN='))

  if (!tokenCookie) return null

  try {
    return decodeURIComponent(tokenCookie.slice('XSRF-TOKEN='.length))
  } catch {
    return tokenCookie.slice('XSRF-TOKEN='.length)
  }
}

async function ensureCsrfCookie(force = false): Promise<void> {
  if (!force && csrfReady) return
  if (csrfRequest) return csrfRequest

  csrfRequest = (async () => {
    const response = await fetch(`${apiOrigin}/sanctum/csrf-cookie`, {
      credentials: 'include',
      headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    })

    if (!response.ok) throw new ApiError(response.status, null)
    csrfReady = true
  })()

  try {
    await csrfRequest
  } finally {
    csrfRequest = null
  }
}

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler
}

function isAuthExemptEndpoint(endpoint: string): boolean {
  const path = endpoint.split('?')[0]
  return path.endsWith('/auth/login') || path.endsWith('/auth/me')
}

function handleUnauthorized(endpoint: string): void {
  if (isAuthExemptEndpoint(endpoint) || typeof window === 'undefined') return

  const redirectPath = safeRedirect(`${window.location.pathname}${window.location.search}${window.location.hash}`)
  if (unauthorizedHandler) {
    unauthorizedHandler(redirectPath)
  } else {
    window.location.assign(`/login?redirect=${encodeURIComponent(redirectPath)}`)
  }
}

function requestHeaders(options: ApiRequestOptions, token: string | null): Record<string, string> {
  const headers: Record<string, string> = {}
  new Headers(options.headers).forEach((value, key) => {
    headers[key] = value
  })
  headers.Accept = 'application/json'
  headers['X-Requested-With'] = 'XMLHttpRequest'
  if (options.body !== undefined && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }
  if (token) headers['X-XSRF-TOKEN'] = token
  return headers
}

async function sendApiRequest(endpoint: string, options: ApiRequestOptions): Promise<Response> {
  const method = (options.method ?? 'GET').toUpperCase()
  const requiresCsrf = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)

  if (requiresCsrf && typeof document !== 'undefined') {
    await ensureCsrfCookie()
  }

  const { body: requestBody, ...requestOptions } = options
  const url = `${apiBaseUrl}${endpoint}`
  const sendRequest = async () => fetch(url, {
    ...requestOptions,
    credentials: 'include',
    headers: requestHeaders(options, requiresCsrf ? xsrfToken() : null),
    body: requestBody === undefined ? undefined : JSON.stringify(requestBody),
  })

  let response = await sendRequest()
  if (response.status === 419 && typeof document !== 'undefined') {
    csrfReady = false
    await ensureCsrfCookie(true)
    response = await sendRequest()
  }

  return response
}

export async function api<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
  const response = await sendApiRequest(endpoint, options)

  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const error = new ApiError(response.status, body)
    if (response.status === 401) handleUnauthorized(endpoint)
    throw error
  }

  return body as T
}

export async function apiBlob(endpoint: string): Promise<{ blob: Blob; headers: Headers }> {
  const response = await sendApiRequest(endpoint, {})
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null)
    const error = new ApiError(response.status, body)
    if (response.status === 401) handleUnauthorized(endpoint)
    throw error
  }

  return { blob: await response.blob(), headers: response.headers }
}