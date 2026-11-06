import { describe, expect, it } from 'vitest'
import { dollarsToCents, isValidCardLimit } from './cards-api'

describe('card limit amount parsing', () => {
  it('converts decimal dollars to integer cents without float arithmetic', () => {
    expect(dollarsToCents('12')).toBe(1200)
    expect(dollarsToCents('12.3')).toBe(1230)
    expect(dollarsToCents('12.34')).toBe(1234)
  })

  it('rejects malformed or unsafe dollar values', () => {
    for (const value of ['-1.00', '1.234', '1e3', '.50', '90071992547409.92']) {
      expect(dollarsToCents(value)).toBeNull()
    }
  })

  it('validates cents limits against the configured maximum', () => {
    expect(isValidCardLimit(0, 500000)).toBe(true)
    expect(isValidCardLimit(500001, 500000)).toBe(false)
    expect(isValidCardLimit(1.5, 500000)).toBe(false)
  })
})