import { describe, expect, it } from 'vitest'
import { dollarsToCents, filtersToApi, parseTransactionFilters } from './transaction-filters'

describe('transaction filter URL parsing', () => {
  it('ignores invalid URL values and normalizes repeated categories', () => {
    const parsed = parseTransactionFilters(new URLSearchParams('page=-2&per_page=15&direction=other&category=card&category=unknown&date_from=2026-02-30&min_amount_cents=abc&sort=bogus&q=x'))
    expect(parsed).toMatchObject({ page: 1, per_page: 10, category: ['card'] })
    expect(parsed).not.toHaveProperty('direction')
    expect(parsed).not.toHaveProperty('date_from')
    expect(parsed).not.toHaveProperty('min_amount_cents')
    expect(parsed).not.toHaveProperty('q')
  })

  it('keeps only server-supported parameters for requests and exports', () => {
    const parsed = parseTransactionFilters(new URLSearchParams('page=3&per_page=25&range=30&category=card&card_id=17'))
    expect(filtersToApi(parsed)).toEqual({ page: 3, per_page: 25, category: ['card'], card_id: 17 })
  })
})

describe('dollarsToCents', () => {
  it.each([['12.34', 1234], ['0.1', 10], ['1000', 100000], ['1,000.50', 100050]])('converts %s without floating-point rounding', (value, cents) => {
    expect(dollarsToCents(value)).toBe(cents)
  })

  it.each(['', 'abc', '1.001', '-2', '1,00.50', 'not-money'])('rejects invalid amount %s', (value) => {
    expect(dollarsToCents(value)).toBeNull()
  })
})
