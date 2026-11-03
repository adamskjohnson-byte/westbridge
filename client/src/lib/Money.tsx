import type { ReactNode } from 'react'
import { Ltr } from '@/components/ui/Ltr'
import { formatMoneyFromCents, formatSignedMoney } from './format'

export function Money({
  cents,
  direction,
  locale,
  children,
}: {
  cents: number
  direction?: 'credit' | 'debit'
  locale?: string
  children?: ReactNode
}) {
  return <Ltr>{children ?? (direction ? formatSignedMoney(cents, direction, locale) : formatMoneyFromCents(cents, locale))}</Ltr>
}
