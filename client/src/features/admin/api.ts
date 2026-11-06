import { api } from '@/lib/api'

export type Page<T> = { data: T[]; links: Record<string, string | null>; meta: { current_page: number; last_page: number; per_page: number; total: number } }
export type AuditEvent = { id: number; action: string; actor: { id: number; name: string; email: string } | null; entity_type: string | null; entity_id: string | null; ip_address: string | null; user_agent: string | null; metadata: Record<string, unknown> | null; created_at: string }
export type AdminUser = { id: number; first_name: string; last_name: string; email: string; role: 'customer' | 'admin'; status: 'active' | 'suspended'; email_verified: boolean; created_at: string; last_login_at: string | null; accounts_count: number; total_balance_cents: number }
export type AdminTransaction = { id: number; reference: string; direction: 'credit' | 'debit'; category: string; amount_cents: number; balance_after_cents: number; description: string; counterparty_name: string | null; posted_at: string; flagged_large: boolean; user: { id: number; name: string; email: string }; account: { id: number; type: string; number_masked: string } }
export type TicketMessage = { id: number; type: 'note' | 'reply'; body: string; admin: { id: number; name: string } | null; created_at: string }
export type AdminTicket = { id: number; user_id: number | null; user?: { id: number; name: string; email: string } | null; name: string; email: string; subject: string; message: string; status: 'open' | 'in_progress' | 'closed'; priority: 'low' | 'normal' | 'high'; created_at: string; updated_at: string; messages?: TicketMessage[] }
export type UserDetail = Omit<AdminUser, 'accounts_count' | 'total_balance_cents'> & { phone: string | null; accounts: Array<{ id: number; type: string; number_masked: string; balance_cents: number; status: string }>; cards_count: number; open_tickets_count: number; active_sessions_count: number; transactions: AdminTransaction[]; audit_events: AuditEvent[] }
export type Overview = { users_total: number; users_new_7d: number; users_suspended: number; tickets_open: number; transactions_24h: number; volume_24h_cents: number; total_balance_cents: number; failed_logins_24h: number; large_transactions_24h: number; latest_audit: AuditEvent[] }
export type Reconciliation = { ok: boolean; accounts_checked: number; mismatches: Array<{ account_id: number; number_masked: string; balance_cents: number; ledger_sum_cents: number }> }
export type Query = Record<string, string | number | boolean | null | undefined>
type Envelope<T> = { data: T }

function queryString(params: Query = {}): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) if (value !== null && value !== undefined && value !== '') search.set(key, String(value))
  const result = search.toString()
  return result ? `?${result}` : ''
}

export async function getOverview(): Promise<Overview> { return (await api<Envelope<Overview>>('/v1/admin/overview')).data }
export async function reconcile(): Promise<Reconciliation> { return (await api<Envelope<Reconciliation>>('/v1/admin/system/reconcile')).data }
export async function getUsers(params: Query): Promise<Page<AdminUser>> { return api<Page<AdminUser>>(`/v1/admin/users${queryString(params)}`) }
export async function getUser(id: number): Promise<UserDetail> { return (await api<Envelope<UserDetail>>(`/v1/admin/users/${id}`)).data }
export async function changeUserState(id: number, state: 'suspend' | 'reactivate', payload: { reason: string; password: string }): Promise<void> { await api(`/v1/admin/users/${id}/${state}`, { method: 'POST', body: payload }) }
export async function changeAccountState(id: number, state: 'freeze' | 'unfreeze', payload: { reason: string; password: string }): Promise<void> { await api(`/v1/admin/accounts/${id}/${state}`, { method: 'POST', body: payload }) }
export async function getTransactions(params: Query): Promise<Page<AdminTransaction>> { return api<Page<AdminTransaction>>(`/v1/admin/transactions${queryString(params)}`) }
export async function getTickets(params: Query): Promise<Page<AdminTicket>> { return api<Page<AdminTicket>>(`/v1/admin/tickets${queryString(params)}`) }
export async function getTicket(id: number): Promise<AdminTicket> { return (await api<Envelope<AdminTicket>>(`/v1/admin/tickets/${id}`)).data }
export async function updateTicket(id: number, payload: { status?: string; priority?: string; reason: string; password: string }): Promise<AdminTicket> { return (await api<Envelope<AdminTicket>>(`/v1/admin/tickets/${id}`, { method: 'PATCH', body: payload })).data }
export async function sendTicketMessage(id: number, payload: { type: 'note' | 'reply'; body: string; reason: string; password: string }): Promise<TicketMessage> { return (await api<Envelope<TicketMessage>>(`/v1/admin/tickets/${id}/messages`, { method: 'POST', body: payload })).data }
export async function getAuditLogs(params: Query): Promise<Page<AuditEvent>> { return api<Page<AuditEvent>>(`/v1/admin/audit-logs${queryString(params)}`) }
export async function getAuditActions(): Promise<string[]> { return (await api<Envelope<string[]>>('/v1/admin/audit-logs/actions')).data }
