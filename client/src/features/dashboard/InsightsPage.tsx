import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDown, ArrowUp, CalendarDays, ChartNoAxesCombined, CircleDollarSign, CreditCard, RefreshCw, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CountUp } from '@/components/motion/CountUp'
import { Ltr } from '@/components/ui/Ltr'
import { Money } from '@/lib/Money'
import { apiErrorMessage } from '@/lib/api-errors'
import { formatDate, formatMoneyFromCents, formatPercent } from '@/lib/format'
import { getInsights, spendingTrend } from './insights-api'
import type { InsightsData } from './insights-api'

function currentMonth(): string { return new Date().toISOString().slice(0, 7) }
const monthDateSuffix = '-01T12:00:00Z'
function shiftMonth(value: string, delta: number): string {
  const [year, month] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1 + delta, 1)).toISOString().slice(0, 7)
}

function Headline({ label, cents, change, isPercent = false, noIncome = false }: { label: string; cents?: number; change?: number; isPercent?: boolean; noIncome?: boolean }) {
  const { t } = useTranslation('common')
  const changeText = change === undefined ? null : `${change > 0 ? '+' : ''}${formatPercent(change, { maximumFractionDigits: 0 })}`
  return <article className="min-w-0 border-s-2 border-primary bg-card px-4 py-4"><h3 className="text-xs font-semibold text-muted-foreground">{label}</h3>{noIncome ? <p className="mt-2 text-xl font-bold">{t('dashboard.insights.na')}</p> : isPercent ? <p className="mt-2 text-xl font-bold tabular-nums">{formatPercent(cents ?? 0, { maximumFractionDigits: 2 })}</p> : <CountUp cents={cents ?? 0} className="mt-2 block text-xl font-bold tabular-nums"/>}{changeText !== null && <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">{change !== undefined && change > 0 ? <ArrowUp aria-hidden="true" className="size-3.5"/> : <ArrowDown aria-hidden="true" className="size-3.5"/>}{t('dashboard.insights.change', { value: changeText })}</p>}</article>
}

function DailyChart({ data }: { data: InsightsData }) {
  const { t } = useTranslation('common')
  const chartData = data.daily_spending.map((item) => ({ ...item, day: item.date.slice(-2) }))
  const caption = t('dashboard.insights.dailyAccessible')
  return <section className="min-w-0 border-t border-border pt-5"><h2 className="mb-4 text-base font-bold">{t('dashboard.insights.dailyTitle')}</h2><div className="h-64 min-w-0" dir="ltr" role="img" aria-label={caption}><ResponsiveContainer height="100%" width="100%"><BarChart data={chartData}><CartesianGrid stroke="var(--border)" strokeDasharray="3 4" vertical={false}/><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}/><YAxis axisLine={false} tickLine={false} width={66} tickFormatter={(value: number) => formatMoneyFromCents(value)} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}/><Tooltip formatter={(value) => formatMoneyFromCents(Number(value))} contentStyle={{ background: 'var(--card)', borderColor: 'var(--border)', borderRadius: 4 }}/><Bar dataKey="spending_cents" fill="var(--primary)" name={t('dashboard.spending')} radius={[2, 2, 0, 0]}/></BarChart></ResponsiveContainer></div><table className="sr-only dashboard-sr-table"><caption>{caption}</caption><thead><tr><th>{t('dashboard.insights.date')}</th><th>{t('dashboard.spending')}</th></tr></thead><tbody>{chartData.map((item) => <tr key={item.date}><th>{item.date}</th><td>{formatMoneyFromCents(item.spending_cents)}</td></tr>)}</tbody></table></section>
}

function CategoryChart({ data }: { data: InsightsData }) {
  const { t } = useTranslation('common')
  const caption = t('dashboard.insights.categoryAccessible')
  const chartData = data.by_category.map((item) => ({ ...item, label: t(`dashboard.category.${item.category}`) }))
  return <section className="min-w-0 border-t border-border pt-5"><div className="mb-4 flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-base font-bold">{t('dashboard.insights.categoryTitle')}</h2><div className="flex gap-4 text-xs text-muted-foreground"><span>{t('dashboard.thisMonth')}</span><span>{t('dashboard.insights.previousMonth')}</span></div></div><div className="h-64 min-w-0" dir="ltr" role="img" aria-label={caption}><ResponsiveContainer height="100%" width="100%"><BarChart data={chartData} margin={{ left: 3, right: 3 }}><CartesianGrid stroke="var(--border)" strokeDasharray="3 4" vertical={false}/><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}/><YAxis axisLine={false} tickLine={false} width={66} tickFormatter={(value: number) => formatMoneyFromCents(value)} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}/><Tooltip formatter={(value) => formatMoneyFromCents(Number(value))} contentStyle={{ background: 'var(--card)', borderColor: 'var(--border)', borderRadius: 4 }}/><Bar dataKey="spending_cents" fill="var(--primary)" name={t('dashboard.thisMonth')} radius={[2, 2, 0, 0]}/><Bar dataKey="previous_spending_cents" fill="var(--brand-bronze)" name={t('dashboard.insights.previousMonth')} radius={[2, 2, 0, 0]}/></BarChart></ResponsiveContainer></div><table className="sr-only dashboard-sr-table"><caption>{caption}</caption><thead><tr><th>{t('dashboard.transactions.categoryLabel')}</th><th>{t('dashboard.thisMonth')}</th><th>{t('dashboard.insights.previousMonth')}</th></tr></thead><tbody>{chartData.map((item) => <tr key={item.category}><th>{item.label}</th><td>{formatMoneyFromCents(item.spending_cents)}</td><td>{formatMoneyFromCents(item.previous_spending_cents)}</td></tr>)}</tbody></table></section>
}

export function InsightsPage() {
  const { t } = useTranslation('common')
  const [params, setParams] = useSearchParams()
  const current = currentMonth()
  const month = /^\d{4}-\d{2}$/.test(params.get('month') ?? '') ? params.get('month')! : current
  const minMonth = shiftMonth(current, -24)
  const query = useQuery({ queryKey: ['dashboard', 'insights', month], queryFn: () => getInsights(month) })
  const data = query.data
  const spentTrend = useMemo(() => data ? spendingTrend(data.spending_cents, data.previous.spending_cents) : 'same', [data])
  const categoryTotal = data?.by_category.reduce((sum, item) => sum + item.spending_cents, 0) ?? 0
  const topCategory = data?.by_category[0]
  const largest = data?.largest_transactions[0]
  const noActivity = data && data.income_cents === 0 && data.spending_cents === 0
  function move(delta: number) { setParams((previous) => { const next = new URLSearchParams(previous); next.set('month', shiftMonth(month, delta)); return next }, { replace: true }) }
  if (query.isPending) return <div aria-busy="true" className="animate-pulse space-y-6"><div className="h-12 bg-muted"/><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map((item) => <div className="h-28 bg-muted" key={item}/>)}</div><div className="grid gap-8 lg:grid-cols-2"><div className="h-72 bg-muted"/><div className="h-72 bg-muted"/></div></div>
  if (query.isError || !data) return <div className="grid min-h-64 place-content-center justify-items-center gap-4" role="alert"><p>{apiErrorMessage(query.error, t)}</p><Button onClick={() => void query.refetch()} variant="outline"><RefreshCw aria-hidden="true"/>{t('dashboard.retry')}</Button></div>
  const change = data.previous.spending_cents === 0 ? undefined : (data.spending_cents - data.previous.spending_cents) / data.previous.spending_cents
  const topShare = topCategory && categoryTotal ? Math.round(topCategory.spending_cents / categoryTotal * 100) : 0
  return <div className="space-y-8">
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5"><div><p className="text-sm font-semibold text-primary">{t('dashboard.insights.eyebrow')}</p><h2 className="mt-1 text-2xl font-extrabold">{t('dashboard.insights.title')}</h2></div><div aria-label={t('dashboard.insights.monthSelector')} className="flex items-center gap-2"><Button aria-label={t('dashboard.insights.previous')} disabled={month <= minMonth} onClick={() => move(-1)} size="icon" variant="outline"><ChevronLeft aria-hidden="true"/></Button><span className="min-w-36 text-center text-sm font-semibold"><CalendarDays aria-hidden="true" className="me-2 inline size-4"/>{formatDate(`${month}${monthDateSuffix}`, { month: 'long', year: 'numeric' })}</span><Button aria-label={t('dashboard.insights.next')} disabled={month >= current} onClick={() => move(1)} size="icon" variant="outline"><ChevronRight aria-hidden="true"/></Button></div></div>
    {noActivity && <p className="border-s-2 border-border bg-muted px-4 py-3 text-sm">{t('dashboard.insights.empty')}</p>}
    <section aria-label={t('dashboard.insights.headlines')} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Headline label={t('dashboard.income')} cents={data.income_cents}/><Headline label={t('dashboard.spending')} cents={data.spending_cents} change={change}/><Headline label={t('dashboard.net')} cents={Math.abs(data.net_cents)} change={undefined}/><Headline label={t('dashboard.insights.savingsRate')} cents={data.savings_rate ?? 0} isPercent noIncome={data.savings_rate === null}/></section>
    <section aria-label={t('dashboard.insights.highlights')} className="grid gap-x-8 gap-y-5 border-y border-border py-5 sm:grid-cols-2 xl:grid-cols-4">
      <article className="flex gap-3"><ChartNoAxesCombined aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary"/><p className="text-sm">{t(`dashboard.insights.trends.${spentTrend}`, { amount: formatMoneyFromCents(data.spending_cents), previous: formatMoneyFromCents(data.previous.spending_cents) })}</p></article>
      <article className="flex gap-3"><CreditCard aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary"/><p className="text-sm">{topCategory ? t('dashboard.insights.topCategory', { category: t(`dashboard.category.${topCategory.category}`), share: topShare }) : t('dashboard.insights.noCategory')}</p></article>
      <article className="flex gap-3"><CircleDollarSign aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary"/><p className="text-sm">{largest ? t('dashboard.insights.largestExpense', { name: largest.counterparty_name || largest.description, amount: formatMoneyFromCents(largest.amount_cents) }) : t('dashboard.insights.noLargest')}</p></article>
      <article className="flex gap-3"><Sparkles aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary"/><p className="text-sm">{t('dashboard.insights.averageAndSavings', { amount: formatMoneyFromCents(data.average_daily_spending_cents), savings: data.savings_rate === null ? t('dashboard.insights.na') : formatPercent(data.savings_rate, { maximumFractionDigits: 1 }) })}</p></article>
    </section>
    <section aria-label={t('dashboard.insights.charts')} className="grid gap-8 lg:grid-cols-2"><DailyChart data={data}/><CategoryChart data={data}/></section>
    <section className="grid gap-8 border-t border-border pt-5 lg:grid-cols-2"><div><h2 className="text-base font-bold">{t('dashboard.insights.topMerchants')}</h2>{data.top_counterparties.length ? <ol className="mt-2 divide-y divide-border">{data.top_counterparties.map((item, index) => <li className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 py-3" key={item.name}><span className="text-sm font-bold text-muted-foreground">{index + 1}</span><span className="min-w-0 truncate text-sm font-semibold">{item.name}<span className="ms-2 text-xs font-normal text-muted-foreground">{t('dashboard.insights.purchaseCount', { count: item.count })}</span></span><Money cents={item.spending_cents}><span className="whitespace-nowrap text-sm font-bold tabular-nums">{formatMoneyFromCents(item.spending_cents)}</span></Money></li>)}</ol> : <p className="py-4 text-sm text-muted-foreground">{t('dashboard.insights.noMerchants')}</p>}</div><div><h2 className="text-base font-bold">{t('dashboard.insights.largestTransactions')}</h2>{data.largest_transactions.length ? <ul className="mt-2 divide-y divide-border">{data.largest_transactions.map((item) => <li className="flex justify-between gap-3 py-3 text-sm" key={item.reference}><span className="min-w-0"><span className="block truncate font-semibold">{item.counterparty_name || item.description}</span><time className="text-xs text-muted-foreground" dateTime={item.posted_at}>{formatDate(item.posted_at, { day: 'numeric', month: 'short' })}</time></span><Ltr><Money cents={item.amount_cents}><span className="whitespace-nowrap font-bold tabular-nums">{formatMoneyFromCents(item.amount_cents)}</span></Money></Ltr></li>)}</ul> : <p className="py-4 text-sm text-muted-foreground">{t('dashboard.insights.noLargest')}</p>}</div></section>
  </div>
}