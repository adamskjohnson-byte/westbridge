import { api } from '@/lib/api'

export type BankNotification = { id: string; type: string; params: Record<string, string | number>; read_at: string | null; created_at: string }
export type NotificationPage = { data: BankNotification[]; meta: { page: number; per_page: number; total: number; last_page: number } }
type Envelope<T> = { data: T }

export async function getNotifications(page = 1, unread = false): Promise<NotificationPage> {
  return api<NotificationPage>(`/v1/notifications?page=${page}${unread ? '&unread=1' : ''}`)
}
export async function getUnreadCount(): Promise<number> {
  return (await api<Envelope<{ count: number }>>('/v1/notifications/unread-count')).data.count
}
export async function readNotification(id: string): Promise<void> {
  await api(`/v1/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' })
}
export async function readAllNotifications(): Promise<void> {
  await api('/v1/notifications/read-all', { method: 'POST' })
}
export async function deleteNotification(id: string): Promise<void> {
  await api(`/v1/notifications/${encodeURIComponent(id)}`, { method: 'DELETE' })
}