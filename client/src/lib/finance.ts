export type LoanCalculation = {
  monthlyPayment: number
  totalInterest: number
  totalRepayment: number
}

export type SavingsCalculation = {
  finalBalance: number
  totalContributed: number
  interestEarned: number
}

export function calculateLoanPayment(
  principal: number,
  annualRatePercent: number,
  years: number,
): LoanCalculation {
  const safePrincipal = Number.isFinite(principal) ? Math.max(0, principal) : 0
  const safeAnnualRate = Number.isFinite(annualRatePercent) ? Math.max(0, annualRatePercent) : 0
  const safeYears = Number.isFinite(years) ? Math.max(0, years) : 0
  const months = safeYears * 12

  if (safePrincipal === 0 || months === 0) {
    return {
      monthlyPayment: 0,
      totalInterest: 0,
      totalRepayment: 0,
    }
  }

  const monthlyRate = safeAnnualRate / 100 / 12

  if (monthlyRate === 0) {
    const monthlyPayment = safePrincipal / months
    return {
      monthlyPayment,
      totalInterest: 0,
      totalRepayment: safePrincipal,
    }
  }

  const growthFactor = Math.pow(1 + monthlyRate, months)
  const monthlyPayment = (safePrincipal * monthlyRate * growthFactor) / (growthFactor - 1)
  const totalRepayment = monthlyPayment * months

  return {
    monthlyPayment,
    totalInterest: totalRepayment - safePrincipal,
    totalRepayment,
  }
}

export function calculateSavingsGrowth(
  initialDeposit: number,
  monthlyContribution: number,
  annualRatePercent: number,
  years: number,
): SavingsCalculation {
  const safeInitialDeposit = Number.isFinite(initialDeposit) ? Math.max(0, initialDeposit) : 0
  const safeMonthlyContribution = Number.isFinite(monthlyContribution) ? Math.max(0, monthlyContribution) : 0
  const safeAnnualRate = Number.isFinite(annualRatePercent) ? Math.max(0, annualRatePercent) : 0
  const safeYears = Number.isFinite(years) ? Math.max(0, years) : 0
  const months = safeYears * 12
  const totalContributed = safeInitialDeposit + safeMonthlyContribution * months

  if (months === 0) {
    return {
      finalBalance: safeInitialDeposit,
      totalContributed,
      interestEarned: 0,
    }
  }

  const monthlyRate = safeAnnualRate / 100 / 12

  if (monthlyRate === 0) {
    return {
      finalBalance: totalContributed,
      totalContributed,
      interestEarned: 0,
    }
  }

  const growthFactor = Math.pow(1 + monthlyRate, months)
  const contributionFutureValue = safeMonthlyContribution * ((growthFactor - 1) / monthlyRate)
  const finalBalance = safeInitialDeposit * growthFactor + contributionFutureValue

  return {
    finalBalance,
    totalContributed,
    interestEarned: finalBalance - totalContributed,
  }
}
