import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDownLeft, ArrowUpRight, BadgeCheck, CircleDollarSign, Copy, CreditCard, Landmark, RefreshCw, ShieldAlert, Sparkles } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { CountUp } from '@/components/motion/CountUp'
import { Ltr } from '@/components/ui/Ltr'
import { Money } from '@/lib/Money'
import { formatDate, formatMoneyFromCents, formatPercent, formatSignedMoney } from '@/lib/format'
import { apiErrorMessage } from '@/lib/api-errors'
import { cn } from '@/lib/utils'
import { useAuth } from '@/features/auth/auth-provider'
import { getAccount, getDashboardSummary } from './api'
import type { DashboardAccount, DashboardSummary, DashboardTransaction } from './api'

const categoryIcons = {
  transfer: ArrowDownLeft,
  deposit: CircleDollarSign,
  withdrawal: ArrowUpRight,
  bill_payment: Landmark,
  card: CreditCard,
  fee: ShieldAlert,
  interest: Sparkles,
  other: CircleDollarSign,
} as const

function AccountCard({ account, primary }: { account: DashboardAccount; primary: boolean }) {
  const { t } = useTranslation('common')
  const [copying, setCopying] = useState(false)
  const Icon = account.status === 'active' ? BadgeCheck : ShieldAlert
  const title = account.nickname || t(`dashboard.${account.type}`)

  async function copyNumber() {
    setCopying(true)
    try {
      const detail = await getAccount(account.id)
      await navigator.clipboard.writeText(detail.account_number)
      toast.success(t('dashboard.accountNumberCopied'))
    } catch {
      toast.error(t('dashboard.accountNumberCopyError'))
    } finally {
      setCopying(false)
    }
  }

  return (
    <article className={cn('relative min-w-0 overflow-hidden rounded-lg border border-border p-5 sm:p-6', primary ? 'bg-primary text-primary-foreground' : 'bg-card')}>
      {primary && <span aria-hidden="true" className="pointer-events-none absolute -end-10 -top-14 size-48 rounded-full border-[1.5rem] border-primary-foreground/5" />}
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn('text-xs font-semibold', primary ? 'text-primary-foreground/75' : 'text-muted-foreground')}>{t(`dashboard.${account.type}`)}</p>
          <h3 className="mt-1 truncate text-base font-bold">{title}</h3>
        </div>
        <span className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold', primary ? 'border-primary-foreground/25 bg-primary-foreground/10' : 'border-border bg-muted')}>
          <Icon aria-hidden="true" className="size-3.5" />{t(`dashboard.status.${account.status}`)}
        </span>
      </div>
      <div className="relative mt-6 flex items-end justify-between gap-3">
        <div>
          <p className={cn('text-xs', primary ? 'text-primary-foreground/75' : 'text-muted-foreground')}>{t('dashboard.accountNumber')}</p>
          <div className="mt-1 flex items-center gap-2">
            <Ltr><span className="font-mono text-sm tracking-wide">{account.number_masked}</span></Ltr>
            <Button aria-label={t('dashboard.copyAccountNumber')} className={cn('size-8', primary && 'text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground')} disabled={copying} onClick={copyNumber} size="icon" title={t('dashboard.copyAccountNumber')} variant="ghost"><Copy aria-hidden="true" /></Button>
          </div>
        </div>
        <Money cents={account.balance_cents}>
          <span className="text-end text-xl font-extrabold tabular-nums">{formatMoneyFromCents(account.balance_cents)}</span>
        </Money>
      </div>
      <Link className={cn(buttonVariants({ variant: primary ? 'secondary' : 'outline', size: 'sm' }), 'relative mt-5 w-full')} to={`/dashboard/accounts/${account.id}/transactions`}>
        {t('dashboard.viewTransactions')}
      </Link>
    </article>
  )
}

function OverviewSkeleton() {
  return (
    <div aria-live="polite" className="animate-pulse space-y-7" role="status">
      <div className="h-24 rounded-md bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2"><div className="h-52 rounded-lg bg-muted" /><div className="h-52 rounded-lg bg-muted" /></div>
      <div className="grid gap-4 sm:grid-cols-3"><div className="h-28 rounded-lg bg-muted" /><div className="h-28 rounded-lg bg-muted" /><div className="h-28 rounded-lg bg-muted" /></div>
      <div className="grid gap-6 lg:grid-cols-2"><div className="h-80 rounded-lg bg-muted" /><div className="h-80 rounded-lg bg-muted" /></div>
    </div>
  )
}

function MonthlyChart({ summary }: { summary: DashboardSummary }) {
  const { t } = useTranslation('common')
  const series = summary.series.map((item) => ({
    ...item,
    label: formatDate(`${item.month}-01T12:00:00Z`, { month: 'short' }),
  }))
  const tableLabel = t('dashboard.chartAccessibleSummary')

  return (
    <section aria-labelledby="cash-flow-title" className="min-w-0 border-t border-border pt-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-bold" id="cash-flow-title">{t('dashboard.sixMonthActivity')}</h2>
        <div className="flex gap-4 text-xs text-muted-foreground"><span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-primary" />{t('dashboard.income')}</span><span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-brand-bronze" />{t('dashboard.spending')}</span></div>
      </div>
      <div aria-label={tableLabel} className="h-64 min-w-0" dir="ltr" role="img">
        <ResponsiveContainer height="100%" width="100%">
          <BarChart data={series} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 4" vertical={false} />
            <XAxis axisLine={false} dataKey="label" tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} tickLine={false} />
            <YAxis axisLine={false} tickFormatter={(value: number) => formatMoneyFromCents(value)} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} tickLine={false} width={66} />
            <Tooltip formatter={(value) => formatMoneyFromCents(Number(value))} labelStyle={{ color: 'var(--foreground)' }} contentStyle={{ background: 'var(--card)', borderColor: 'var(--border)', borderRadius: 6, color: 'var(--foreground)' }} />
            <Bar dataKey="income_cents" fill="var(--primary)" name={t('dashboard.income')} radius={[3, 3, 0, 0]} />
            <Bar dataKey="spending_cents" fill="var(--brand-bronze)" name={t('dashboard.spending')} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only dashboard-sr-table"><caption>{tableLabel}</caption><thead><tr><th>{t('dashboard.month')}</th><th>{t('dashboard.income')}</th><th>{t('dashboard.spending')}</th></tr></thead><tbody>{series.map((item) => <tr key={item.month}><th>{item.month}</th><td>{formatMoneyFromCents(item.income_cents)}</td><td>{formatMoneyFromCents(item.spending_cents)}</td></tr>)}</tbody></table>
    </section>
  )
}

function SpendingCategories({ summary }: { summary: DashboardSummary }) {
  const { t } = useTranslation('common')
  const total = summary.spending_by_category.reduce((sum, item) => sum + item.spending_cents, 0)

  return (
    <section aria-labelledby="category-title" className="min-w-0 border-t border-border pt-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-base font-bold" id="category-title">{t('dashboard.spendingByCategory')}</h2><span className="text-xs text-muted-foreground">{t('dashboard.thisMonth')}</span></div>
      {summary.spending_by_category.length === 0 ? <p className="py-5 text-sm text-muted-foreground">{t('dashboard.noSpending')}</p> : (
        <ul className="grid gap-4">
          {summary.spending_by_category.map((item) => {
            const Icon = categoryIcons[item.category]
            const percent = total ? item.spending_cents / total : 0
            return <li className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2" key={item.category}>
              <span className="row-span-2 grid size-8 place-items-center rounded-md bg-muted text-primary"><Icon aria-hidden="true" className="size-4" /></span>
              <span className="min-w-0 truncate text-sm font-semibold">{t(`dashboard.category.${item.category}`)}</span>
              <span className="text-end text-xs tabular-nums text-muted-foreground">{formatPercent(percent, { maximumFractionDigits: 0 })}</span>
              <span aria-hidden="true" className="col-start-2 h-1.5 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-brand-bronze" style={{ width: `${Math.min(percent * 100, 100)}%` }} /></span>
              <Money cents={item.spending_cents}><span className="row-span-2 text-end text-sm font-bold tabular-nums">{formatMoneyFromCents(item.spending_cents)}</span></Money>
            </li>
          })}
        </ul>
      )}
    </section>
  )
}

function RecentActivity({ transactions }: { transactions: DashboardTransaction[] }) {
  const { t } = useTranslation('common')
  if (!transactions.length) return <p className="py-7 text-sm text-muted-foreground">{t('dashboard.noActivityYet')}</p>

  return <ul className="divide-y divide-border">{transactions.map((transaction) => {
    const Icon = categoryIcons[transaction.category]
    return <li className="grid min-h-[4.25rem] grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3 py-3" key={transaction.id}>
      <span className="grid size-9 place-items-center rounded-full bg-muted text-primary"><Icon aria-hidden="true" className="size-4" /></span>
      <span className="min-w-0"><span className="block truncate text-sm font-semibold">{transaction.description}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{transaction.counterparty_name || t(`dashboard.category.${transaction.category}`)}<span aria-hidden="true"> · </span><time dateTime={transaction.posted_at}>{formatDate(transaction.posted_at, { day: 'numeric', month: 'short' })}</time></span></span>
      <Money cents={transaction.amount_cents} direction={transaction.direction}><span className={cn('whitespace-nowrap text-end text-sm font-bold tabular-nums', transaction.direction === 'credit' ? 'text-foreground' : 'text-muted-foreground')}>{formatSignedMoney(transaction.amount_cents, transaction.direction)}</span></Money>
    </li>
  })}</ul>
}

export function OverviewPage() {
  const { t } = useTranslation('common')
  const { user } = useAuth()
  const summaryQuery = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: getDashboardSummary,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })
  const currentHour = new Date().getHours()
  const greeting = currentHour < 12 ? 'morning' : currentHour < 18 ? 'afternoon' : 'evening'
  const dateLabel = formatDate(new Date(), { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  if (summaryQuery.isPending) return <OverviewSkeleton />
  if (summaryQuery.isError) return <div className="grid min-h-72 place-content-center justify-items-center gap-4 text-center" role="alert"><p className="max-w-md text-sm text-destructive">{apiErrorMessage(summaryQuery.error, t) || t('dashboard.dashboardLoadError')}</p><Button onClick={() => void summaryQuery.refetch()} variant="outline"><RefreshCw aria-hidden="true" />{t('dashboard.retry')}</Button></div>

  const summary = summaryQuery.data
  return (
    <div className="space-y-8 sm:space-y-10">
      <section className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div><p className="text-sm font-semibold text-primary">{dateLabel}</p><h2 className="mt-1 text-2xl font-extrabold sm:text-3xl">{t(`dashboard.greeting.${greeting}`, { name: user?.first_name ?? '' })}</h2></div>
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground"><Sparkles aria-hidden="true" className="size-3.5 text-brand-bronze" />{t('dashboard.demoMoney')}</span>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(16rem,0.8fr)_minmax(0,1.2fr)] lg:items-stretch" aria-label={t('dashboard.accountsHeading')}>
        <div className="flex flex-col justify-center border-s-2 border-primary ps-5 py-2">
          <p className="text-sm font-semibold text-muted-foreground">{t('dashboard.totalBalance')}</p>
          <CountUp cents={summary.total_balance_cents} className="mt-2 text-3xl font-extrabold tabular-nums sm:text-4xl" />
          <p className="mt-2 text-xs text-muted-foreground">{t('dashboard.balanceAcrossAccounts', { count: summary.accounts.length })}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {summary.accounts.length ? summary.accounts.map((account, index) => <AccountCard account={account} key={account.id} primary={index === 0} />) : <p className="py-8 text-sm text-muted-foreground">{t('dashboard.noAccounts')}</p>}
        </div>
      </section>

      <section aria-label={t('dashboard.thisMonth')}>
        <div className="mb-4 flex items-baseline justify-between gap-3"><h2 className="text-base font-bold">{t('dashboard.thisMonth')}</h2><span className="text-xs text-muted-foreground">{formatDate(new Date(), { month: 'long', year: 'numeric' })}</span></div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="border-s-2 border-primary bg-card px-4 py-4"><p className="text-xs font-semibold text-muted-foreground">{t('dashboard.income')}</p><CountUp cents={summary.month.income_cents} className="mt-2 block text-xl font-bold tabular-nums" /></div>
          <div className="border-s-2 border-brand-bronze bg-card px-4 py-4"><p className="text-xs font-semibold text-muted-foreground">{t('dashboard.spending')}</p><CountUp cents={summary.month.spending_cents} className="mt-2 block text-xl font-bold tabular-nums" /></div>
          <div className="border-s-2 border-border bg-card px-4 py-4"><p className="text-xs font-semibold text-muted-foreground">{t('dashboard.net')}</p><Money cents={Math.abs(summary.month.net_cents)}><span className="mt-2 block text-xl font-bold tabular-nums">{summary.month.net_cents >= 0 ? '+' : '−'}{formatMoneyFromCents(Math.abs(summary.month.net_cents))}</span></Money></div>
        </div>
      </section>

      <section aria-label={t('dashboard.cashFlowAndSpending')} className="grid gap-8 lg:grid-cols-2 lg:gap-10">
        <MonthlyChart summary={summary} />
        <SpendingCategories summary={summary} />
      </section>

      <section aria-labelledby="recent-activity-title" className="border-t border-border pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-bold" id="recent-activity-title">{t('dashboard.recentActivity')}</h2><Link className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))} to="/dashboard/transactions">{t('dashboard.viewAll')}</Link></div>
        <RecentActivity transactions={summary.recent} />
      </section>
    </div>
  )
}
