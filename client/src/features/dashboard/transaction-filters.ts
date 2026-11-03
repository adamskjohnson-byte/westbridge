import type { DashboardTransaction, TransactionFilters } from './api'

const categories: DashboardTransaction['category'][] = ['transfer', 'deposit', 'withdrawal', 'bill_payment', 'card', 'fee', 'interest', 'other']
const pageSizes = [10, 25, 50] as const
const datePattern = /^\d{4}-\d{2}-\d{2}$/

export type ParsedTransactionFilters = TransactionFilters & { page: number; per_page: number; range?: string }

function validDate(value: string | null): value is string {
  if (!value || !datePattern.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function validCents(value: string | null): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : undefined
}

export function dollarsToCents(value: string): number | null {
  const entered = value.trim()
  if (!entered || !/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{0,2})?$/.test(entered)) return null
  const normalized = entered.replaceAll(',', '')
  const match = /^(\d+)(?:\.(\d{0,2}))?$/.exec(normalized)
  if (!match) return null
  const whole = BigInt(match[1])
  const fraction = BigInt((match[2] ?? '').padEnd(2, '0') || '0')
  const cents = whole * 100n + fraction
  return cents <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(cents) : null
}

export function parseTransactionFilters(params: URLSearchParams): ParsedTransactionFilters {
  const pageValue = Number(params.get('page'))
  const page = Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : 1
  const pageSize = Number(params.get('per_page'))
  const per_page = pageSizes.includes(pageSize as (typeof pageSizes)[number]) ? pageSize : 10
  const directionValue = params.get('direction')
  const direction = directionValue === 'credit' || directionValue === 'debit' ? directionValue : undefined
  const categoryValues = [...params.getAll('category'), ...params.getAll('category[]')]
  const category = [...new Set(categoryValues.filter((value): value is DashboardTransaction['category'] => categories.includes(value as DashboardTransaction['category'])))]
  const q = params.get('q')?.trim()
  const dateFromValue = params.get('date_from')
  const dateToValue = params.get('date_to')
  let date_from = validDate(dateFromValue) ? dateFromValue : undefined
  let date_to = validDate(dateToValue) ? dateToValue : undefined
  if (date_from && date_to) {
    const start = Date.parse(`${date_from}T00:00:00Z`)
    const end = Date.parse(`${date_to}T00:00:00Z`)
    if (start > end || end - start > 5 * 366 * 86_400_000) {
      date_from = undefined
      date_to = undefined
    }
  }
  const min_amount_cents = validCents(params.get('min_amount_cents'))
  const max_amount_cents = validCents(params.get('max_amount_cents'))
  const validAmounts = min_amount_cents === undefined || max_amount_cents === undefined || min_amount_cents <= max_amount_cents
  const sortValue = params.get('sort')
  const orderValue = params.get('order')

  return {
    page,
    per_page,
    ...(q && q.length >= 2 && q.length <= 100 ? { q } : {}),
    ...(direction ? { direction } : {}),
    ...(category.length ? { category } : {}),
    ...(date_from ? { date_from } : {}),
    ...(date_to ? { date_to } : {}),
    ...(validAmounts && min_amount_cents !== undefined ? { min_amount_cents } : {}),
    ...(validAmounts && max_amount_cents !== undefined ? { max_amount_cents } : {}),
    ...(sortValue === 'amount_cents' ? { sort: 'amount_cents' as const } : sortValue === 'posted_at' ? { sort: 'posted_at' as const } : {}),
    ...(orderValue === 'asc' || orderValue === 'desc' ? { order: orderValue } : {}),
    ...(params.get('range') && ['7', '30', '90', 'month', 'custom'].includes(params.get('range')!) ? { range: params.get('range')! } : {}),
  }
}

export function filtersToApi(filters: ParsedTransactionFilters): TransactionFilters {
  const apiFilters = { ...filters }
  delete apiFilters.range
  return apiFilters
}
