import { api } from '@/lib/api'
import type { DashboardAccount } from './api'

type Envelope<T> = { data: T }
export type MoneyPage<T> = { data: T[]; meta: { page: number; per_page: number; total: number; last_page: number } }

export type Beneficiary = {
  id: number
  name: string
  nickname: string | null
  number_masked: string
  created_at: string
}

export type RecipientLookup = { account_type: 'checking' | 'savings'; holder_masked: string; currency: 'USD' }
export type DailyLimit = { daily_limit_cents: number; used_today_cents: number; remaining_cents: number; resets_at: string }
export type Biller = { code: string; name: string; category: 'electricity' | 'water' | 'internet' | 'mobile' | 'insurance' | 'credit_card' | 'tv' | 'tax' }

export type TransferReceipt = {
  id: string
  reference: string
  status: 'completed' | 'failed'
  amount_cents: number
  currency: 'USD'
  memo: string | null
  from: { account_id: number; type: 'checking' | 'savings'; number_masked: string }
  to: { type: 'own' | 'beneficiary' | 'account_number'; number_masked: string; holder_masked: string }
  created_at: string
  balance_after_cents: number
}

export type BillPayment = {
  id: string
  biller_code: string
  biller_name: string
  reference_number: string
  amount_cents: number
  currency: 'USD'
  status: 'completed' | 'failed'
  transaction_id: number
  transaction_reference: string
  created_at: string
}

export type TransferFilters = { page?: number; direction?: 'in' | 'out' | 'own'; date_from?: string; date_to?: string }
export type TransferPayload = {
  from_account_id: number
  amount_cents: number
  memo?: string
  to_type: 'own' | 'beneficiary' | 'account_number'
  to_account_id?: number
  beneficiary_id?: number
  account_number?: string
}

export async function getMoneyAccounts(): Promise<DashboardAccount[]> {
  return (await api<Envelope<DashboardAccount[]>>('/v1/accounts')).data
}

export async function getBeneficiaries(): Promise<Beneficiary[]> {
  return (await api<Envelope<Beneficiary[]>>('/v1/beneficiaries')).data
}

export async function createBeneficiary(account_number: string, nickname?: string): Promise<Beneficiary> {
  return (await api<Envelope<Beneficiary>>('/v1/beneficiaries', { method: 'POST', body: { account_number, nickname } })).data
}

export async function deleteBeneficiary(id: number): Promise<void> {
  await api(`/v1/beneficiaries/${id}`, { method: 'DELETE' })
}

export async function lookupRecipient(account_number: string): Promise<RecipientLookup> {
  return (await api<Envelope<RecipientLookup>>('/v1/transfers/lookup', { method: 'POST', body: { account_number } })).data
}

export async function getDailyLimit(): Promise<DailyLimit> {
  return (await api<Envelope<DailyLimit>>('/v1/limits')).data
}

export async function createTransfer(payload: TransferPayload, idempotencyKey: string): Promise<TransferReceipt> {
  return (await api<Envelope<TransferReceipt>>('/v1/transfers', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: payload,
  })).data
}

export async function getTransfers(filters: TransferFilters): Promise<MoneyPage<TransferReceipt>> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  return api<MoneyPage<TransferReceipt>>(`/v1/transfers?${params}`)
}

export async function getBillers(): Promise<Biller[]> {
  return (await api<Envelope<Biller[]>>('/v1/billers')).data
}

export async function createBillPayment(payload: {
  from_account_id: number
  biller_code: string
  reference_number: string
  amount_cents: number
}, idempotencyKey: string): Promise<BillPayment> {
  return (await api<Envelope<BillPayment>>('/v1/bill-payments', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: payload,
  })).data
}

export async function getBillPayments(page: number): Promise<MoneyPage<BillPayment>> {
  return api<MoneyPage<BillPayment>>(`/v1/bill-payments?page=${page}`)
}

export async function getTransfer(id: string): Promise<TransferReceipt> {
  const response = await api<TransferReceipt | Envelope<TransferReceipt>>(`/v1/transfers/${encodeURIComponent(id)}`)
  return 'data' in response ? response.data : response
}