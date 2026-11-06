import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Bell, Check, CreditCard, Landmark, ArrowLeftRight, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatRelativeDate } from '@/lib/format'
import { formatMoneyFromCents } from '@/lib/format'
import { getNotifications, getUnreadCount, readAllNotifications } from './notifications-api'
import { useAuth } from '@/features/auth/auth-provider'

const queryKey = ['dashboard', 'notifications'] as const

function notificationMessage(type: string, params: Record<string, string | number>, t: (key: string, options?: Record<string, unknown>) => string): string {
  const allowed = ['transfer_sent', 'transfer_received', 'bill_paid', 'card_purchase', 'card_frozen', 'card_unfrozen', 'card_issued', 'card_cancelled', 'password_changed', 'session_revoked', 'low_balance', 'welcome']
  if (!allowed.includes(type)) return t('notifications.generic.body')
  return t(`notifications.${type}.body`, Object.fromEntries(Object.entries(params).map(([key, value]) => [
    key,
    key === 'account_type' && typeof value === 'string' ? t(`dashboard.${value}`) : key.endsWith('_cents') && typeof value === 'number' ? formatMoneyFromCents(value) : value,
  ])))
}

function notificationTitle(type: string, t: (key: string) => string): string {
  const allowed = ['transfer_sent', 'transfer_received', 'bill_paid', 'card_purchase', 'card_frozen', 'card_unfrozen', 'card_issued', 'card_cancelled', 'password_changed', 'session_revoked', 'low_balance', 'welcome']
  return t(`notifications.${allowed.includes(type) ? type : 'generic'}.title`)
}

function NotificationIcon({ type }: { type: string }) {
  const Icon = type.startsWith('card_') ? CreditCard : type.startsWith('transfer_') ? ArrowLeftRight : type === 'low_balance' ? ShieldAlert : type === 'bill_paid' ? Landmark : Bell
  return <Icon aria-hidden="true" className="size-4 shrink-0 text-primary" />
}

export function NotificationBell() {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const unreadQuery = useQuery({ queryKey: [...queryKey, user?.id, 'count'], queryFn: getUnreadCount, refetchOnWindowFocus: true, refetchInterval: () => document.visibilityState === 'visible' ? 60_000 : false })
  const latestQuery = useQuery({ queryKey: [...queryKey, user?.id, 'latest'], queryFn: () => getNotifications(1), enabled: open, staleTime: 15_000 })
  const readAllMutation = useMutation({ mutationFn: readAllNotifications, onSuccess: async () => { await queryClient.invalidateQueries({ queryKey }) } })

  useEffect(() => {
    const refetchOnFocus = () => { if (document.visibilityState === 'visible') void queryClient.invalidateQueries({ queryKey: [...queryKey, user?.id, 'count'] }) }
    window.addEventListener('focus', refetchOnFocus)
    return () => window.removeEventListener('focus', refetchOnFocus)
  }, [queryClient, user?.id])

  const count = unreadQuery.data ?? 0
  return <div className="relative">
    <Button aria-expanded={open} aria-haspopup="dialog" aria-label={t('notifications.bellLabel', { count })} onClick={() => setOpen((value) => !value)} size="icon" variant="ghost"><Bell aria-hidden="true"/>{count > 0 && <span aria-hidden="true" className="absolute -end-0.5 -top-0.5 grid min-h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[0.65rem] font-bold text-primary-foreground">{count > 99 ? '99+' : count}</span>}</Button>
    {open && <section aria-label={t('notifications.popoverTitle')} className="absolute end-0 top-12 z-50 w-[min(24rem,calc(100vw-2rem))] border border-border bg-popover text-popover-foreground shadow-xl" role="dialog"><div className="flex items-center justify-between gap-3 border-b border-border p-3"><h2 className="text-sm font-bold">{t('notifications.popoverTitle')}</h2><Button disabled={count === 0 || readAllMutation.isPending} onClick={() => readAllMutation.mutate()} size="sm" variant="ghost"><Check aria-hidden="true"/>{t('notifications.markAll')}</Button></div>
      {latestQuery.isPending ? <p className="p-4 text-sm text-muted-foreground">{t('dashboard.loading')}</p> : latestQuery.data?.data.length ? <ul className="max-h-[22rem] divide-y divide-border overflow-y-auto">{latestQuery.data.data.slice(0, 5).map((notification) => <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2 p-3" key={notification.id}><NotificationIcon type={notification.type}/><span className="min-w-0"><span className="flex items-start gap-2"><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{notificationTitle(notification.type, t)}</span><span className="mt-0.5 block text-sm">{notificationMessage(notification.type, notification.params, t)}</span></span>{!notification.read_at && <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"/>}<span className="sr-only">{!notification.read_at ? t('notifications.unread') : ''}</span></span><time className="mt-1 block text-xs text-muted-foreground" dateTime={notification.created_at}>{formatRelativeDate(notification.created_at)}</time></span></li>)}</ul> : <p className="p-4 text-sm text-muted-foreground">{t('notifications.empty')}</p>}
      <Link className="block border-t border-border p-3 text-center text-sm font-semibold text-primary underline" onClick={() => setOpen(false)} to="/dashboard/notifications">{t('notifications.viewAll')}</Link></section>}
  </div>
}