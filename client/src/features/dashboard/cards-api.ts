import { api } from '@/lib/api'

export type BankCard = {
  id: number
  account_id: number
  account_type: 'checking' | 'savings'
  type: 'debit'
  nickname: string | null
  last4: string
  expiry_month: number
  expiry_year: number
  status: 'active' | 'frozen' | 'cancelled'
  daily_limit_cents: number
  spent_today_cents: number
  created_at: string
}

type Envelope<T> = { data: T }

export function dollarsToCents(value: string): number | null {
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(value.trim())
  if (!match) return null
  const dollars = Number(match[1])
  const cents = Number((match[2] ?? '').padEnd(2, '0') || '0')
  const total = dollars * 100 + cents
  return Number.isSafeInteger(total) ? total : null
}

export function isValidCardLimit(value: number, maximum: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= maximum
}

export async function getCards(includeCancelled = false): Promise<BankCard[]> {
  const suffix = includeCancelled ? '?include=cancelled' : ''
  return (await api<Envelope<BankCard[]>>(`/v1/cards${suffix}`)).data
}

export async function issueCard(account_id: number, nickname?: string): Promise<BankCard> {
  return (await api<Envelope<BankCard>>('/v1/cards', { method: 'POST', body: { account_id, nickname } })).data
}

export async function updateCard(id: number, payload: { nickname?: string | null; daily_limit_cents?: number }): Promise<BankCard> {
  return (await api<Envelope<BankCard>>(`/v1/cards/${id}`, { method: 'PATCH', body: payload })).data
}

export async function setCardState(id: number, action: 'freeze' | 'unfreeze' | 'cancel'): Promise<BankCard> {
  return (await api<Envelope<BankCard>>(`/v1/cards/${id}/${action}`, { method: 'POST', body: action === 'cancel' ? { confirm: true } : {} })).data
}

export type TestPurchaseResult = { status: 'approved'; transaction_id: number; balance_after_cents: number; replayed: boolean }

export async function testCardPurchase(id: number, payload: { merchant: string; amount_cents: number }, key: string): Promise<TestPurchaseResult> {
  return (await api<Envelope<TestPurchaseResult>>(`/v1/cards/${id}/test-purchase`, {
    method: 'POST', headers: { 'Idempotency-Key': key }, body: payload,
  })).data
}