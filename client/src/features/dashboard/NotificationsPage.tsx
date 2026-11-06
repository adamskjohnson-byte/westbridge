import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowLeftRight, Bell, CreditCard, Landmark, ShieldAlert, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatRelativeDate } from '@/lib/format'
import { formatMoneyFromCents } from '@/lib/format'
import { getNotifications, readAllNotifications, readNotification, deleteNotification } from './notifications-api'
import type { BankNotification } from './notifications-api'
import { getDashboardAccounts } from './api'
import type { DashboardAccount } from './api'
import { useAuth } from '@/features/auth/auth-provider'

const queryKey = ['dashboard', 'notifications'] as const

function bodyText(notification: BankNotification, t: (key: string, options?: Record<string, unknown>) => string): string {
  const known = ['transfer_sent', 'transfer_received', 'bill_paid', 'card_purchase', 'card_frozen', 'card_unfrozen', 'card_issued', 'card_cancelled', 'password_changed', 'session_revoked', 'low_balance', 'welcome']
  const params = Object.fromEntries(Object.entries(notification.params).map(([key, value]) => [
    key,
    key === 'account_type' && typeof value === 'string' ? t(`dashboard.${value}`) : key.endsWith('_cents') && typeof value === 'number' ? formatMoneyFromCents(value) : value,
  ]))
  return t(`notifications.${known.includes(notification.type) ? notification.type : 'generic'}.body`, params)
}

function titleText(type: string, t: (key: string) => string): string {
  const known = ['transfer_sent', 'transfer_received', 'bill_paid', 'card_purchase', 'card_frozen', 'card_unfrozen', 'card_issued', 'card_cancelled', 'password_changed', 'session_revoked', 'low_balance', 'welcome']
  return t(`notifications.${known.includes(type) ? type : 'generic'}.title`)
}

function destination(notification: BankNotification, accounts: DashboardAccount[]): string | null {
  if (notification.type.startsWith('card_')) return '/dashboard/cards'
  if (notification.type === 'low_balance' && typeof notification.params.account_type === 'string') {
    const account = accounts.find((item) => item.type === notification.params.account_type)
    return account ? `/dashboard/accounts/${account.id}/transactions` : '/dashboard'
  }
  if (notification.type.startsWith('transfer_') && typeof notification.params.reference === 'string') return `/dashboard/transfers/${encodeURIComponent(notification.params.reference)}`
  return null
}

export function NotificationsPage() {
  const { t } = useTranslation('common')
  const client = useQueryClient()
  const { user } = useAuth()
  const [unread, setUnread] = useState(false)
  const [page, setPage] = useState(1)
  const query = useQuery({ queryKey: [...queryKey, user?.id, 'page', page, unread], queryFn: () => getNotifications(page, unread) })
  const accountsQuery = useQuery({ queryKey: ['dashboard', 'accounts'], queryFn: getDashboardAccounts, staleTime: 60_000 })
  const invalidate = async () => { await client.invalidateQueries({ queryKey }) }
  const readMutation = useMutation({ mutationFn: readNotification, onSuccess: invalidate })
  const deleteMutation = useMutation({ mutationFn: deleteNotification, onSuccess: invalidate })
  const readAllMutation = useMutation({ mutationFn: readAllNotifications, onSuccess: invalidate })
  const notifications = query.data?.data ?? []

  return <div className="space-y-6"><div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5"><div><p className="text-sm font-semibold text-primary">{t('notifications.eyebrow')}</p><h2 className="mt-1 text-2xl font-extrabold">{t('notifications.title')}</h2></div><div className="flex items-center gap-3"><label className="flex items-center gap-2 text-sm"><input checked={unread} className="size-4 accent-primary" onChange={(event) => { setUnread(event.target.checked); setPage(1) }} type="checkbox"/>{t('notifications.unreadOnly')}</label><Button disabled={!notifications.some((item) => !item.read_at)} onClick={() => readAllMutation.mutate()} variant="outline">{t('notifications.markAll')}</Button></div></div>
    {query.isPending ? <div aria-busy="true" className="animate-pulse space-y-3">{[1, 2, 3].map((item) => <div className="h-20 bg-muted" key={item}/>)}</div> : query.isError ? <div className="flex items-center gap-3" role="alert"><p>{t('notifications.loadError')}</p><Button onClick={() => void query.refetch()} variant="outline">{t('dashboard.retry')}</Button></div> : notifications.length === 0 ? <p className="border-y border-border py-12 text-center text-sm text-muted-foreground">{t('notifications.empty')}</p> : <ul className="divide-y divide-border border-y border-border">{notifications.map((item) => { const Icon = item.type.startsWith('card_') ? CreditCard : item.type.startsWith('transfer_') ? ArrowLeftRight : item.type === 'low_balance' ? ShieldAlert : item.type === 'bill_paid' ? Landmark : Bell; const href = destination(item, accountsQuery.data ?? []); return <li className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-3 py-4" key={item.id}><Icon aria-hidden="true" className="mt-1 size-5 text-primary"/><div className="min-w-0"><button className="text-start text-sm font-semibold hover:underline" onClick={() => { if (!item.read_at) readMutation.mutate(item.id) }}>{titleText(item.type, t)}{!item.read_at && <span className="sr-only">{t('notifications.unread')}</span>}</button><p className="mt-1 text-sm">{bodyText(item, t)}</p><time className="mt-1 block text-xs text-muted-foreground" dateTime={item.created_at}>{formatRelativeDate(item.created_at)}</time>{href && <Link className="mt-1 inline-block text-xs font-semibold text-primary underline" to={href}>{t('notifications.openRelated')}</Link>}</div><div className="flex gap-1"><Button aria-label={t('notifications.markRead')} disabled={Boolean(item.read_at)} onClick={() => readMutation.mutate(item.id)} size="icon" variant="ghost">✓</Button><Button aria-label={t('notifications.delete')} onClick={() => deleteMutation.mutate(item.id)} size="icon" variant="ghost"><Trash2 aria-hidden="true"/></Button></div></li>})}</ul>}
    {query.data && query.data.meta.last_page > 1 && <div className="flex justify-center gap-3"><Button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} variant="outline">{t('dashboard.transactions.previousPage')}</Button><span className="self-center text-sm">{page} / {query.data.meta.last_page}</span><Button disabled={page >= query.data.meta.last_page} onClick={() => setPage((value) => value + 1)} variant="outline">{t('dashboard.transactions.nextPage')}</Button></div>}
  </div>
}