import { describe, expect, it } from 'vitest'
import { spendingTrend } from './insights-api'

describe('insight trend cases', () => {
  it('distinguishes rising, falling, flat and missing previous data', () => {
    expect(spendingTrend(120, 100)).toBe('up')
    expect(spendingTrend(80, 100)).toBe('down')
    expect(spendingTrend(100, 100)).toBe('same')
    expect(spendingTrend(50, 0)).toBe('noData')
    expect(spendingTrend(0, 0)).toBe('same')
  })
})