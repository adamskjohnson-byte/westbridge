import { i18n } from '@/i18n'

function activeLocale(): string {
  return i18n.resolvedLanguage ?? i18n.language ?? 'en'
}

export function formatNumber(value: number, options: Intl.NumberFormatOptions = {}): string {
  return new Intl.NumberFormat(activeLocale(), { ...options, numberingSystem: 'latn' }).format(value)
}

export function formatCurrency(value: number, options: Omit<Intl.NumberFormatOptions, 'style' | 'currency'> = {}): string {
  return new Intl.NumberFormat(activeLocale(), {
    ...options,
    numberingSystem: 'latn',
    style: 'currency',
    currency: 'USD',
  }).format(value)
}

export function formatCurrencyCents(cents: number, options: Omit<Intl.NumberFormatOptions, 'style' | 'currency'> = {}): string {
  const amount = BigInt(cents)
  const negative = amount < 0n
  const absolute = negative ? -amount : amount
  const whole = absolute / 100n
  const fraction = (absolute % 100n).toString().padStart(2, '0')
  const parts = new Intl.NumberFormat(activeLocale(), {
    ...options,
    numberingSystem: 'latn',
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).formatToParts(whole)
  const formatted = parts.map((part) => part.type === 'fraction' ? fraction : part.value).join('')

  return negative ? `-${formatted}` : formatted
}

export function formatMoneyFromCents(cents: number, locale = activeLocale()): string {
  const amount = BigInt(Math.trunc(cents))
  const negative = amount < 0n
  const absolute = negative ? -amount : amount
  const whole = absolute / 100n
  const fraction = (absolute % 100n).toString().padStart(2, '0')
  const parts = new Intl.NumberFormat(locale, {
    numberingSystem: 'latn',
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).formatToParts(whole)
  const formatted = parts.map((part) => part.type === 'fraction' ? fraction : part.value).join('')

  return negative ? `-${formatted}` : formatted
}

export function formatSignedMoney(cents: number, direction: 'credit' | 'debit', locale = activeLocale()): string {
  const amount = formatMoneyFromCents(Math.abs(cents), locale)
  return `${direction === 'credit' ? '+' : '−'}${amount}`
}

export function formatDate(value: Date | string | number, options: Intl.DateTimeFormatOptions = {}): string {
  const date = value instanceof Date ? value : new Date(value)
  return new Intl.DateTimeFormat(activeLocale(), { ...options, numberingSystem: 'latn' }).format(date)
}

export function formatDateTime(value: Date | string | number, options: Intl.DateTimeFormatOptions = {}): string {
  return formatDate(value, { dateStyle: 'medium', timeStyle: 'short', ...options })
}

export function formatRelativeDate(value: Date | string | number, now = new Date()): string {
  const date = value instanceof Date ? value : new Date(value)
  const days = Math.round((date.getTime() - now.getTime()) / 86_400_000)
  const unit: Intl.RelativeTimeFormatUnit = Math.abs(days) < 1 ? 'hour' : 'day'
  const amount = unit === 'hour' ? Math.round((date.getTime() - now.getTime()) / 3_600_000) : days
  return new Intl.RelativeTimeFormat(activeLocale(), { numeric: 'auto' }).format(amount, unit)
}

export function formatPercent(value: number, options: Intl.NumberFormatOptions = {}): string {
  return new Intl.NumberFormat(activeLocale(), {
    ...options,
    numberingSystem: 'latn',
    style: 'percent',
  }).format(value)
}
