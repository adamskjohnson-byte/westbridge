import { api, apiBlob } from '@/lib/api'

export type DashboardAccount = {
  id: number
  type: 'checking' | 'savings'
  nickname: string | null
  number_masked: string
  currency: 'USD'
  balance_cents: number
  status: 'active' | 'frozen' | 'closed'
  opened_at?: string
}

export type DashboardTransaction = {
  id: number
  reference: string
  direction: 'credit' | 'debit'
  amount_cents: number
  balance_after_cents: number
  currency: 'USD'
  category: 'transfer' | 'deposit' | 'withdrawal' | 'bill_payment' | 'card' | 'fee' | 'interest' | 'other'
  description: string
  counterparty_name: string | null
  posted_at: string
}

export type DashboardSummary = {
  currency: 'USD'
  total_balance_cents: number
  accounts: DashboardAccount[]
  month: { income_cents: number; spending_cents: number; net_cents: number }
  series: { month: string; income_cents: number; spending_cents: number }[]
  spending_by_category: { category: DashboardTransaction['category']; spending_cents: number }[]
  recent: DashboardTransaction[]
}

export type TransactionFilters = {
  page?: number
  per_page?: number
  q?: string
  direction?: 'credit' | 'debit'
  category?: DashboardTransaction['category'][]
  date_from?: string
  date_to?: string
  min_amount_cents?: number
  max_amount_cents?: number
  card_id?: number
  sort?: 'posted_at' | 'amount_cents'
  order?: 'asc' | 'desc'
}

type ApiEnvelope<T> = {
  message: string
  data: T
}

export type TransactionPage = {
  transactions: DashboardTransaction[]
  meta: { page: number; per_page: number; total: number; last_page: number }
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  return api<DashboardSummary>('/v1/dashboard/summary')
}

export async function getDashboardAccounts(): Promise<DashboardAccount[]> {
  const response = await api<ApiEnvelope<DashboardAccount[]>>('/v1/accounts')
  return response.data
}

export async function getAccountTransactions(accountId: number, filters: number | TransactionFilters = 1): Promise<TransactionPage> {
  const params = new URLSearchParams()
  const values = typeof filters === 'number' ? { page: filters } : filters
  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) value.forEach((item) => params.append(`${key}[]`, String(item)))
    else if (value !== undefined && value !== '') params.set(key, String(value))
  }
  const response = await api<{ data: DashboardTransaction[]; meta: TransactionPage['meta'] }>(`/v1/accounts/${accountId}/transactions?${params}`)
  return { transactions: response.data, meta: response.meta }
}

export async function getAccount(accountId: number): Promise<DashboardAccount & { account_number: string }> {
  const response = await api<{ data: DashboardAccount & { account_number: string } }>(`/v1/accounts/${accountId}`)
  return response.data
}

export async function exportTransactions(accountId: number, filters: Omit<TransactionFilters, 'page' | 'per_page'>): Promise<{ blob: Blob; filename: string; truncated: boolean }> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (Array.isArray(value)) value.forEach((item) => params.append(`${key}[]`, String(item)))
    else if (value !== undefined && value !== '') params.set(key, String(value))
  }
  const response = await apiBlob(`/v1/accounts/${accountId}/transactions/export?${params}`)
  const disposition = response.headers.get('Content-Disposition') ?? ''
  const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] ?? 'transactions.csv'
  return { blob: response.blob, filename, truncated: response.headers.get('X-Export-Truncated') === 'true' }
}

export function getTransactionsCsvUrl(accountId: number): string {
  const apiUrl = (import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api').replace(/\/+$/, '')
  return `${apiUrl}/v1/accounts/${accountId}/transactions/export`
}