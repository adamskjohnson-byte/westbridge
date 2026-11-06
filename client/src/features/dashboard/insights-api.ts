import { api } from '@/lib/api'

export type InsightsData = {
  currency: 'USD'
  month: string
  previous_month: string
  income_cents: number
  spending_cents: number
  net_cents: number
  savings_rate: number | null
  previous: { income_cents: number; spending_cents: number }
  by_category: { category: string; spending_cents: number; previous_spending_cents: number }[]
  top_counterparties: { name: string; spending_cents: number; count: number }[]
  largest_transactions: { reference: string; description: string; counterparty_name: string | null; amount_cents: number; posted_at: string }[]
  daily_spending: { date: string; spending_cents: number }[]
  average_daily_spending_cents: number
}

export async function getInsights(month: string): Promise<InsightsData> {
  return (await api<{ data: InsightsData }>(`/v1/insights?month=${encodeURIComponent(month)}`)).data
}

export function spendingTrend(current: number, previous: number): 'up' | 'down' | 'same' | 'noData' {
  if (previous === 0) return current === 0 ? 'same' : 'noData'
  if (current === previous) return 'same'
  return current > previous ? 'up' : 'down'
}