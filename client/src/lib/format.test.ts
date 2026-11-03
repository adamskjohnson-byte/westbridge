import { afterEach, describe, expect, it } from 'vitest'
import { i18n, i18nReady } from '@/i18n'
import { formatCurrency, formatCurrencyCents, formatDate, formatDateTime, formatMoneyFromCents, formatNumber, formatPercent, formatRelativeDate, formatSignedMoney } from './format'

afterEach(async () => {
  await i18n.changeLanguage('en')
})

describe('localized formatters', () => {
  it('formats numbers, USD currency, dates, and percentages using the active locale', () => {
    expect(formatNumber(1234.5)).toContain('1,234.5')
    expect(formatCurrency(1234.5)).toContain('$1,234.50')
    expect(formatCurrencyCents(123456)).toContain('$1,234.56')
    expect(formatCurrencyCents(5)).toContain('$0.05')
    expect(formatCurrencyCents(-123)).toContain('-$1.23')
    expect(formatDate('2026-01-02T12:00:00Z', { day: '2-digit', month: '2-digit', year: 'numeric' })).toMatch(/01\/02\/2026/)
    expect(formatPercent(0.125, { maximumFractionDigits: 1 })).toContain('12.5')
  })

  it('uses Latin digits for numbers, currency, dates, and percentages in RTL locales', async () => {
    await i18nReady
    for (const language of ['ar', 'fa', 'ur']) {
      await i18n.changeLanguage(language)
      expect(formatNumber(1234.5)).toMatch(/^[0-9,،.\u066B\u066C\s]+$/u)
      expect(formatCurrency(1234.5)).toMatch(/[0-9]/u)
      expect(formatCurrency(1234.5)).not.toMatch(/[\u0660-\u0669\u06F0-\u06F9]/u)
      expect(formatDate('2026-01-02T12:00:00Z')).toMatch(/[0-9]/u)
      expect(formatDate('2026-01-02T12:00:00Z')).not.toMatch(/[\u0660-\u0669\u06F0-\u06F9]/u)
      expect(formatPercent(0.125)).toMatch(/[0-9]/u)
      expect(formatPercent(0.125)).not.toMatch(/[\u0660-\u0669\u06F0-\u06F9]/u)
    }
  })

  it('formats cent boundaries exactly in English, Arabic, and German', async () => {
    await i18nReady
    const amounts = [1, 99, 100, 123456, 100000000]
    for (const locale of ['en', 'ar', 'de']) {
      const formatted = amounts.map((amount) => formatMoneyFromCents(amount, locale))
      expect(formatted[0]).toMatch(/0[.,]01/u)
      expect(formatted[1]).toMatch(/0[.,]99/u)
      expect(formatted[2]).toMatch(/1[.,]00/u)
      expect(formatted[3]).toMatch(/1[,.]234[,.]56/u)
      expect(formatted[4]).toMatch(/1[,.]000[,.]000[,.]00/u)
      expect(formatted.every((value) => !/[\u0660-\u0669\u06F0-\u06F9]/u.test(value))).toBe(true)
    }
  })

  it('formats signed money and localized date/time values', async () => {
    await i18nReady
    expect(formatSignedMoney(500, 'credit')).toBe('+$5.00')
    expect(formatSignedMoney(500, 'debit')).toBe('−$5.00')
    expect(formatDateTime('2026-01-02T12:00:00Z')).toContain('2026')
    expect(formatRelativeDate('2026-01-03T12:00:00Z', new Date('2026-01-02T12:00:00Z'))).toBe('tomorrow')
  })
})
