import { describe, expect, it } from 'vitest'
import { calculateLoanPayment, calculateSavingsGrowth } from './finance'

describe('finance', () => {
  it('calculates a standard loan payment and totals', () => {
    const result = calculateLoanPayment(250000, 5.5, 30)

    expect(result.monthlyPayment).toBeCloseTo(1419.47, 2)
    expect(result.totalRepayment).toBeCloseTo(511010.1, 1)
    expect(result.totalInterest).toBeCloseTo(261010.1, 1)
  })

  it('handles a zero-rate loan without division by zero', () => {
    const result = calculateLoanPayment(12000, 0, 3)

    expect(result.monthlyPayment).toBe(333.3333333333333)
    expect(result.totalRepayment).toBe(12000)
    expect(result.totalInterest).toBe(0)
  })

  it('calculates savings growth with monthly contributions', () => {
    const result = calculateSavingsGrowth(5000, 250, 4.5, 5)

    expect(result.finalBalance).toBeCloseTo(23045.37, 2)
    expect(result.totalContributed).toBe(5000 + 250 * 60)
    expect(result.interestEarned).toBeCloseTo(3045.37, 2)
  })

  it('handles a zero-rate savings plan', () => {
    const result = calculateSavingsGrowth(2000, 100, 0, 2)

    expect(result.finalBalance).toBe(4400)
    expect(result.totalContributed).toBe(4400)
    expect(result.interestEarned).toBe(0)
  })
})
