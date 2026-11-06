import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ArrowLeftRight, ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, CircleDollarSign, Copy, CreditCard, Download, FileText, Landmark, RefreshCw, ShieldAlert, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Ltr } from '@/components/ui/Ltr'
import { Money } from '@/lib/Money'
import { formatDate, formatDateTime, formatMoneyFromCents, formatSignedMoney } from '@/lib/format'
import { apiErrorMessage } from '@/lib/api-errors'
import { cn } from '@/lib/utils'
import { exportTransactions, getAccountTransactions, getDashboardSummary } from './api'
import type { DashboardAccount, DashboardTransaction } from './api'
import { dollarsToCents, filtersToApi, parseTransactionFilters } from './transaction-filters'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'

const categoryIcons = {
  transfer: ArrowLeftRight,
  deposit: CircleDollarSign,
  withdrawal: ArrowUpRight,
  bill_payment: Landmark,
  card: CreditCard,
  fee: ShieldAlert,
  interest: Sparkles,
  other: FileText,
} as const
const categoryKeys = ['transfer', 'deposit', 'withdrawal', 'bill_payment', 'card', 'fee', 'interest', 'other'] as const
const postedAtSort = 'posted_at'
const amountSort = 'amount_cents'
const descendingOrder = 'desc'
const ascendingOrder = 'asc'
const dateRangeFilter = 'date_range'
const minAmountFilter = 'min_amount_cents'
const maxAmountFilter = 'max_amount_cents'

function centsInput(value: number | undefined): string {
  if (value === undefined) return ''
  return `${Math.floor(value / 100)}.${String(value % 100).padStart(2, '0')}`
}

function dateForDaysAgo(days: number): string {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString().slice(0, 10)
}

function Pagination({ page, lastPage, onPage }: { page: number; lastPage: number; onPage: (page: number) => void }) {
  const { t, i18n } = useTranslation('common')
  const PreviousIcon = i18n.dir() === 'rtl' ? ChevronRight : ChevronLeft
  const NextIcon = i18n.dir() === 'rtl' ? ChevronLeft : ChevronRight
  const pages = [...new Set([1, page - 1, page, page + 1, lastPage].filter((value) => value >= 1 && value <= lastPage))].sort((a, b) => a - b)
  const items: (number | 'ellipsis')[] = []
  pages.forEach((value, index) => {
    if (index && value - pages[index - 1] > 1) items.push('ellipsis')
    items.push(value)
  })

  return <nav aria-label={t('dashboard.transactions.pagination')} className="flex flex-wrap items-center justify-center gap-1" role="navigation">
    <Button aria-label={t('dashboard.transactions.previousPage')} disabled={page <= 1} onClick={() => onPage(page - 1)} size="icon" variant="outline"><PreviousIcon aria-hidden="true" /></Button>
    {items.map((item, index) => item === 'ellipsis' ? <span aria-hidden="true" className="px-2 text-muted-foreground" key={index}>…</span> : <Button aria-current={page === item ? 'page' : undefined} aria-label={t('dashboard.transactions.goToPage', { page: item })} key={item} onClick={() => onPage(item)} size="icon" variant={page === item ? 'default' : 'outline'}>{item}</Button>)}
    <Button aria-label={t('dashboard.transactions.nextPage')} disabled={page >= lastPage} onClick={() => onPage(page + 1)} size="icon" variant="outline"><NextIcon aria-hidden="true" /></Button>
  </nav>
}

function TransactionDetails({ transaction, account, onClose }: { transaction: DashboardTransaction | null; account: DashboardAccount | undefined; onClose: () => void }) {
  const { t } = useTranslation('common')
  if (!transaction) return null
  const selectedTransaction = transaction

  async function copyReference() {
    try {
      await navigator.clipboard.writeText(selectedTransaction.reference)
      toast.success(t('dashboard.transactions.referenceCopied'))
    } catch {
      toast.error(t('dashboard.transactions.copyFailed'))
    }
  }
  const Icon = categoryIcons[transaction.category]
  const fields = [
    [t('dashboard.transactions.dateTime'), formatDateTime(transaction.posted_at)],
    [t('dashboard.transactions.categoryLabel'), t(`dashboard.category.${transaction.category}`)],
    [t('dashboard.transactions.counterparty'), transaction.counterparty_name || t('dashboard.transactions.notAvailable')],
    [t('dashboard.transactions.direction'), t(`dashboard.${transaction.direction}`)],
    [t('dashboard.transactions.accountLabel'), account?.nickname || t(`dashboard.${account?.type ?? 'checking'}`)],
  ]

  return <Sheet open onOpenChange={(open) => { if (!open) onClose() }}>
    <SheetContent aria-describedby="transaction-detail-description" className="overflow-y-auto sm:w-[min(28rem,90vw)]">
      <SheetHeader><SheetTitle>{t('dashboard.transactions.detailTitle')}</SheetTitle><SheetDescription id="transaction-detail-description">{t('dashboard.transactions.detailDescription')}</SheetDescription></SheetHeader>
      <div className="mt-6 border-y border-border py-5"><p className="text-xs font-semibold text-muted-foreground">{t('dashboard.transactions.amountLabel')}</p><Money cents={transaction.amount_cents} direction={transaction.direction}><p className={cn('mt-1 text-2xl font-extrabold tabular-nums', transaction.direction === 'credit' ? 'text-foreground' : 'text-primary')}>{formatSignedMoney(transaction.amount_cents, transaction.direction)}</p></Money></div>
      <dl className="grid gap-4 py-5">{fields.map(([label, value]) => <div className="flex items-start justify-between gap-4" key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="max-w-[65%] text-end text-sm font-semibold">{value}</dd></div>)}
        <div className="flex items-start justify-between gap-4"><dt className="text-sm text-muted-foreground">{t('dashboard.transactions.balanceAfter')}</dt><dd className="text-end text-sm font-semibold"><Money cents={transaction.balance_after_cents}>{formatMoneyFromCents(transaction.balance_after_cents)}</Money></dd></div>
        <div className="flex items-start justify-between gap-3"><dt className="text-sm text-muted-foreground">{t('dashboard.transactions.reference')}</dt><dd className="flex max-w-[65%] items-center gap-2 text-end text-sm font-semibold"><Ltr><span className="break-all font-mono">{transaction.reference}</span></Ltr><Button aria-label={t('dashboard.transactions.copyReference')} onClick={copyReference} size="icon" variant="ghost"><Copy aria-hidden="true" /></Button></dd></div>
        <div className="flex items-start justify-between gap-4"><dt className="text-sm text-muted-foreground">{t('dashboard.transactions.description')}</dt><dd className="max-w-[65%] text-end text-sm font-semibold">{transaction.description}</dd></div>
      </dl>
      <Button className="w-full" onClick={onClose} variant="outline">{t('dashboard.transactions.closeDetails')}</Button>
      <span className="sr-only"><Icon aria-hidden="true" /></span>
    </SheetContent>
  </Sheet>
}

export function TransactionsPage() {
  const { t, i18n } = useTranslation('common')
  const navigate = useNavigate()
  const location = useLocation()
  const { id: routeAccountId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = parseTransactionFilters(searchParams)
  const apiFilters = filtersToApi(filters)
  const currentSearch = filters.q ?? ''
  const [searchDraft, setSearchDraft] = useState(currentSearch)
  const [minDraft, setMinDraft] = useState(centsInput(filters.min_amount_cents))
  const [maxDraft, setMaxDraft] = useState(centsInput(filters.max_amount_cents))
  const [selectedTransaction, setSelectedTransaction] = useState<DashboardTransaction | null>(null)
  const summaryQuery = useQuery({ queryKey: ['dashboard', 'summary'], queryFn: getDashboardSummary, staleTime: 30_000, refetchOnWindowFocus: true })
  const accounts = summaryQuery.data?.accounts ?? []
  const requestedAccountId = routeAccountId ? Number(routeAccountId) : undefined
  const account = accounts.find((item) => item.id === requestedAccountId) ?? accounts[0]
  const accountId = account?.id
  const transactionQuery = useQuery({
    queryKey: ['dashboard', 'transactions', accountId, apiFilters],
    queryFn: () => getAccountTransactions(accountId!, apiFilters),
    enabled: accountId !== undefined,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
  const exportMutation = useMutation({
    mutationFn: async () => {
      if (accountId === undefined) throw new Error('No account selected')
      const exportFilters = { ...apiFilters }
      delete exportFilters.page
      delete exportFilters.per_page
      return exportTransactions(accountId, exportFilters)
    },
    onSuccess: ({ blob, filename, truncated }) => {
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      toast.success(truncated ? t('dashboard.transactions.exportTruncated') : t('dashboard.transactions.exportSuccess'))
    },
    onError: (error) => {
      const status = (error as { status?: number }).status
      toast.error(status === 429 ? t('dashboard.transactions.exportRateLimited') : apiErrorMessage(error, t))
    },
  })

  useEffect(() => {
    setSearchDraft(currentSearch)
    setMinDraft(centsInput(filters.min_amount_cents))
    setMaxDraft(centsInput(filters.max_amount_cents))
  }, [currentSearch, filters.min_amount_cents, filters.max_amount_cents])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const value = searchDraft.trim()
      const next = new URLSearchParams(searchParams)
      if (value.length >= 2 && value.length <= 100) next.set('q', value)
      else next.delete('q')
      next.delete('page')
      if (next.toString() !== searchParams.toString()) setSearchParams(next)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchDraft, searchParams, setSearchParams])

  function updateParams(updates: Record<string, string | string[] | null>, resetPage = true) {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(updates)) {
      next.delete(key)
      if (key === 'category') next.delete('category[]')
      if (Array.isArray(value)) value.forEach((item) => next.append(key, item))
      else if (value !== null && value !== '') next.set(key, value)
    }
    if (resetPage) next.delete('page')
    setSearchParams(next)
  }

  function chooseRange(range: '7' | '30' | '90' | 'month' | 'custom') {
    if (range === 'custom') {
      updateParams({ range }, true)
      return
    }
    const today = new Date().toISOString().slice(0, 10)
    const from = range === 'month' ? `${today.slice(0, 7)}-01` : dateForDaysAgo(Number(range))
    updateParams({ range, date_from: from, date_to: today }, true)
  }

  function commitAmount(key: 'min_amount_cents' | 'max_amount_cents', value: string) {
    const cents = value.trim() ? dollarsToCents(value) : null
    if (value.trim() && cents === null) return
    updateParams({ [key]: cents === null ? null : String(cents) }, true)
  }

  function clearFilters() {
    setSearchDraft('')
    setMinDraft('')
    setMaxDraft('')
    setSearchParams(new URLSearchParams())
  }

  function selectAccount(value: string) {
    navigate(`/dashboard/accounts/${value}/transactions${location.search}`)
  }

  function selectRow(transaction: DashboardTransaction) {
    setSelectedTransaction(transaction)
  }

  function rowKeyDown(event: React.KeyboardEvent<HTMLTableRowElement>, transaction: DashboardTransaction) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      selectRow(transaction)
    }
  }

  function updatePage(page: number) {
    const next = new URLSearchParams(searchParams)
    if (page > 1) next.set('page', String(page))
    else next.delete('page')
    setSearchParams(next)
  }

  const result = transactionQuery.data
  const visibleFrom = result && result.meta.total ? (result.meta.page - 1) * result.meta.per_page + 1 : 0
  const visibleTo = result ? Math.min(result.meta.page * result.meta.per_page, result.meta.total) : 0
  const hasFilters = Boolean(filters.q || filters.direction || filters.category?.length || filters.date_from || filters.date_to || filters.min_amount_cents !== undefined || filters.max_amount_cents !== undefined || filters.card_id !== undefined || filters.sort || filters.order)
  const datePreset = filters.range ?? (filters.date_from || filters.date_to ? 'custom' : '')
  const isRtl = i18n.dir() === 'rtl'
  const categoriesSelected = filters.category ?? []
  const categoryLabel = categoriesSelected.length ? t('dashboard.transactions.categoriesSelected', { count: categoriesSelected.length }) : t('dashboard.transactions.categoryLabel')

  function chip(label: string, key: string, value?: string, itemKey = key) {
    return <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-xs" key={itemKey}><span className="truncate">{label}</span><button aria-label={t('dashboard.transactions.removeFilter', { filter: label })} className="grid size-5 shrink-0 place-items-center rounded-full hover:bg-background" onClick={() => {
      if (key === 'category' && value) updateParams({ category: categoriesSelected.filter((item) => item !== value) })
      else if (key === dateRangeFilter) updateParams({ date_from: null, date_to: null, range: null })
      else updateParams({ [key]: null })
    }} type="button"><X aria-hidden="true" className="size-3" /></button></span>
  }

  if (summaryQuery.isPending) return <div aria-label={t('dashboard.loading')} className="grid gap-4" role="status"><div className="h-14 animate-pulse rounded-md bg-muted" /><div className="h-72 animate-pulse rounded-md bg-muted" /></div>
  if (summaryQuery.isError) return <div className="grid min-h-64 place-content-center justify-items-center gap-4 text-center" role="alert"><p className="text-sm text-destructive">{apiErrorMessage(summaryQuery.error, t)}</p><Button onClick={() => void summaryQuery.refetch()} variant="outline"><RefreshCw aria-hidden="true" />{t('dashboard.retry')}</Button></div>
  if (!accounts.length) return <p className="py-10 text-sm text-muted-foreground">{t('dashboard.noAccounts')}</p>

  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
      <div><p className="text-xs font-semibold text-muted-foreground">{t('dashboard.eyebrow')}</p><h2 className="mt-1 text-2xl font-extrabold">{t('dashboard.transactions.title')}</h2></div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid min-w-48 gap-1.5"><Label htmlFor="transaction-account">{t('dashboard.transactions.accountLabel')}</Label><select className="h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" id="transaction-account" onChange={(event) => selectAccount(event.target.value)} value={String(account?.id ?? '')}>{accounts.map((item) => <option key={item.id} value={item.id}>{item.nickname || t(`dashboard.${item.type}`)} · {item.number_masked}</option>)}</select></div>
        <Button disabled={!account || exportMutation.isPending} onClick={() => exportMutation.mutate()} variant="outline"><Download aria-hidden="true" />{exportMutation.isPending ? t('dashboard.transactions.exportPending') : t('dashboard.transactions.exportCsv')}</Button>
      </div>
    </div>

    <section aria-label={t('dashboard.transactions.filters')} className="grid gap-4 border-b border-border pb-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(12rem,1.3fr)_repeat(3,minmax(8rem,0.7fr))]">
        <div className="grid gap-1.5"><Label htmlFor="transaction-search">{t('dashboard.transactions.search')}</Label><Input autoComplete="off" id="transaction-search" onChange={(event) => setSearchDraft(event.target.value)} placeholder={t('dashboard.transactions.searchPlaceholder')} value={searchDraft} /></div>
        <div className="grid gap-1.5"><Label htmlFor="transaction-direction">{t('dashboard.transactions.direction')}</Label><select className="h-10 rounded-md border border-input bg-background px-3 text-sm" id="transaction-direction" onChange={(event) => updateParams({ direction: event.target.value || null })} value={filters.direction ?? ''}><option value="">{t('dashboard.transactions.allDirections')}</option><option value="credit">{t('dashboard.transactions.credits')}</option><option value="debit">{t('dashboard.transactions.debits')}</option></select></div>
        <div className="grid gap-1.5"><Label htmlFor="transaction-sort">{t('dashboard.transactions.sort')}</Label><select className="h-10 rounded-md border border-input bg-background px-3 text-sm" id="transaction-sort" onChange={(event) => {
          const [sort, order] = event.target.value.split(':')
          updateParams({ sort, order })
        }} value={`${filters.sort ?? postedAtSort}:${filters.order ?? descendingOrder}`}><option value={`${postedAtSort}:${descendingOrder}`}>{t('dashboard.transactions.newest')}</option><option value={`${postedAtSort}:${ascendingOrder}`}>{t('dashboard.transactions.oldest')}</option><option value={`${amountSort}:${descendingOrder}`}>{t('dashboard.transactions.amountHigh')}</option><option value={`${amountSort}:${ascendingOrder}`}>{t('dashboard.transactions.amountLow')}</option></select></div>
        <div className="grid gap-1.5"><Label htmlFor="transaction-page-size">{t('dashboard.transactions.pageSize')}</Label><select className="h-10 rounded-md border border-input bg-background px-3 text-sm" id="transaction-page-size" onChange={(event) => updateParams({ per_page: event.target.value })} value={String(filters.per_page)}><option value="10">10</option><option value="25">25</option><option value="50">50</option></select></div>
      </div>

      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <fieldset className="min-w-0"><legend className="mb-1.5 text-sm font-medium">{t('dashboard.transactions.categoryLabel')}</legend><details className="relative"><summary className="flex h-10 min-w-48 cursor-pointer list-none items-center justify-between gap-3 rounded-md border border-input bg-background px-3 text-sm"><span>{categoryLabel}</span><ChevronRight aria-hidden="true" className={cn('size-4', isRtl ? 'rotate-180' : 'rotate-90')} /></summary><div className="absolute start-0 top-11 z-20 grid max-h-64 min-w-56 gap-1 overflow-y-auto rounded-md border border-border bg-card p-2 shadow-lg">{categoryKeys.map((category) => <label className="flex min-h-9 items-center gap-2 rounded-sm px-2 text-sm hover:bg-muted" key={category}><input checked={categoriesSelected.includes(category)} onChange={(event) => updateParams({ category: event.target.checked ? [...categoriesSelected, category] : categoriesSelected.filter((value) => value !== category) })} type="checkbox" /><span>{t(`dashboard.category.${category}`)}</span></label>)}</div></details></fieldset>
        <fieldset className="grid gap-1.5"><legend className="mb-1.5 text-sm font-medium">{t('dashboard.transactions.dateRange')}</legend><div className="flex flex-wrap gap-1">{(['7', '30', '90', 'month', 'custom'] as const).map((range) => <Button aria-pressed={datePreset === range} className="h-9 px-2.5 text-xs" key={range} onClick={() => chooseRange(range)} size="sm" variant={datePreset === range ? 'secondary' : 'outline'}>{t(`dashboard.transactions.range.${range}`)}</Button>)}</div></fieldset>
        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1.5"><Label htmlFor="date-from">{t('dashboard.transactions.dateFrom')}</Label><div className="relative"><CalendarDays aria-hidden="true" className="pointer-events-none absolute start-3 top-3 size-4 text-muted-foreground" /><Input className="ps-9" id="date-from" onChange={(event) => updateParams({ range: 'custom', date_from: event.target.value || null })} type="date" value={filters.date_from ?? ''} /></div></div>
          <div className="grid gap-1.5"><Label htmlFor="date-to">{t('dashboard.transactions.dateTo')}</Label><div className="relative"><CalendarDays aria-hidden="true" className="pointer-events-none absolute start-3 top-3 size-4 text-muted-foreground" /><Input className="ps-9" id="date-to" onChange={(event) => updateParams({ range: 'custom', date_to: event.target.value || null })} type="date" value={filters.date_to ?? ''} /></div></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1.5"><Label htmlFor="min-amount">{t('dashboard.transactions.minAmount')}</Label><Input id="min-amount" inputMode="decimal" onBlur={() => commitAmount('min_amount_cents', minDraft)} onChange={(event) => setMinDraft(event.target.value)} placeholder="0.00" value={minDraft} /></div>
          <div className="grid gap-1.5"><Label htmlFor="max-amount">{t('dashboard.transactions.maxAmount')}</Label><Input id="max-amount" inputMode="decimal" onBlur={() => commitAmount('max_amount_cents', maxDraft)} onChange={(event) => setMaxDraft(event.target.value)} placeholder="0.00" value={maxDraft} /></div>
        </div>
      </div>

      {hasFilters && <div className="flex flex-wrap items-center gap-2">{filters.q && chip(`${t('dashboard.transactions.search')}: ${filters.q}`, 'q')}{filters.direction && chip(t(`dashboard.transactions.${filters.direction === 'credit' ? 'credits' : 'debits'}`), 'direction')}{categoriesSelected.map((category) => chip(t(`dashboard.category.${category}`), 'category', category, category))}{(filters.date_from || filters.date_to) && chip(`${filters.date_from ?? '…'} – ${filters.date_to ?? '…'}`, dateRangeFilter)}{filters.min_amount_cents !== undefined && chip(`${t('dashboard.transactions.minAmount')}: ${formatMoneyFromCents(filters.min_amount_cents)}`, minAmountFilter)}{filters.max_amount_cents !== undefined && chip(`${t('dashboard.transactions.maxAmount')}: ${formatMoneyFromCents(filters.max_amount_cents)}`, maxAmountFilter)}{filters.sort && chip(t(`dashboard.transactions.${filters.sort === amountSort ? 'sortAmount' : 'sortDate'}`), 'sort')}<Button className="h-8 px-2 text-xs" onClick={clearFilters} variant="ghost">{t('dashboard.transactions.clearAll')}</Button></div>}
    </section>

    <div aria-live="polite" className="text-sm text-muted-foreground" role="status">{result ? t('dashboard.transactions.showing', { from: visibleFrom, to: visibleTo, total: result.meta.total }) : t('dashboard.loading')}</div>

    {transactionQuery.isPending && !result && <div aria-label={t('dashboard.loading')} className="grid gap-2" role="status">{Array.from({ length: 5 }, (_, index) => <div className="h-16 animate-pulse rounded-md bg-muted" key={index} />)}</div>}
    {transactionQuery.isError && <div className="flex flex-wrap items-center gap-3 py-8" role="alert"><p className="text-sm text-destructive">{apiErrorMessage(transactionQuery.error, t)}</p><Button onClick={() => void transactionQuery.refetch()} variant="outline"><RefreshCw aria-hidden="true" />{t('dashboard.retry')}</Button></div>}
    {result && result.transactions.length === 0 && <div className="grid min-h-56 place-content-center justify-items-center gap-3 text-center"><FileText aria-hidden="true" className="size-8 text-muted-foreground" /><p className="text-sm text-muted-foreground">{t(hasFilters ? 'dashboard.transactions.noMatches' : 'dashboard.noActivityYet')}</p>{hasFilters && <Button onClick={clearFilters} variant="outline">{t('dashboard.transactions.clearFilters')}</Button>}</div>}

    {result && result.transactions.length > 0 && <>
      <div aria-busy={transactionQuery.isFetching} className="hidden overflow-x-auto rounded-md border border-border md:block">
        <table className="w-full min-w-[54rem] border-collapse text-start text-sm"><caption className="sr-only">{t('dashboard.transactions.tableCaption')}</caption><thead className="bg-muted/70 text-xs text-muted-foreground"><tr>
          <th aria-sort={filters.sort === postedAtSort || !filters.sort ? (filters.order === 'asc' ? 'ascending' : 'descending') : 'none'} className="px-4 py-3 text-start font-semibold" scope="col">{t('dashboard.transactions.dateLabel')}</th><th className="px-4 py-3 text-start font-semibold" scope="col">{t('dashboard.transactions.description')}</th><th className="px-4 py-3 text-start font-semibold" scope="col">{t('dashboard.transactions.categoryLabel')}</th><th aria-sort={filters.sort === amountSort ? (filters.order === 'asc' ? 'ascending' : 'descending') : 'none'} className="px-4 py-3 text-end font-semibold" scope="col">{t('dashboard.transactions.amountLabel')}</th><th className="px-4 py-3 text-end font-semibold" scope="col">{t('dashboard.transactions.balanceAfter')}</th>
        </tr></thead><tbody className="divide-y divide-border">{result.transactions.map((transaction) => { const Icon = categoryIcons[transaction.category]; return <tr className="cursor-pointer outline-none hover:bg-muted/50 focus-visible:bg-muted/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" key={transaction.id} onClick={() => selectRow(transaction)} onKeyDown={(event) => rowKeyDown(event, transaction)} tabIndex={0}>
          <td className="whitespace-nowrap px-4 py-3"><time dateTime={transaction.posted_at}>{formatDate(transaction.posted_at, { day: 'numeric', month: 'short', year: 'numeric' })}</time></td><td className="max-w-72 px-4 py-3"><span className="block truncate font-semibold">{transaction.description}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{transaction.counterparty_name || t('dashboard.transactions.notAvailable')}</span></td><td className="whitespace-nowrap px-4 py-3"><span className="inline-flex items-center gap-2"><Icon aria-hidden="true" className="size-4 text-muted-foreground" />{t(`dashboard.category.${transaction.category}`)}</span></td><td className="whitespace-nowrap px-4 py-3 text-end"><Money cents={transaction.amount_cents} direction={transaction.direction}><span className={cn('font-semibold tabular-nums', transaction.direction === 'credit' ? 'text-foreground' : 'text-primary')}>{formatSignedMoney(transaction.amount_cents, transaction.direction)}</span></Money></td><td className="whitespace-nowrap px-4 py-3 text-end"><Money cents={transaction.balance_after_cents}>{formatMoneyFromCents(transaction.balance_after_cents)}</Money></td>
        </tr>})}</tbody></table>
      </div>
      <ul aria-busy={transactionQuery.isFetching} className="grid gap-2 md:hidden">{result.transactions.map((transaction) => { const Icon = categoryIcons[transaction.category]; return <li key={transaction.id}><button className="grid w-full grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-border bg-card p-3 text-start focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" onClick={() => selectRow(transaction)} type="button"><span className="grid size-9 place-items-center rounded-full bg-muted text-primary"><Icon aria-hidden="true" className="size-4" /></span><span className="min-w-0"><span className="block truncate text-sm font-semibold">{transaction.description}</span><span className="block truncate text-xs text-muted-foreground">{transaction.counterparty_name || t('dashboard.transactions.notAvailable')}</span><span className="mt-1 block text-xs text-muted-foreground">{formatDate(transaction.posted_at, { day: 'numeric', month: 'short' })} · {t(`dashboard.category.${transaction.category}`)}</span><span className="mt-1 block text-xs text-muted-foreground">{t('dashboard.transactions.balanceAfter')}: {formatMoneyFromCents(transaction.balance_after_cents)}</span></span><Money cents={transaction.amount_cents} direction={transaction.direction}><span className={cn('whitespace-nowrap text-end text-sm font-bold tabular-nums', transaction.direction === 'credit' ? 'text-foreground' : 'text-primary')}>{formatSignedMoney(transaction.amount_cents, transaction.direction)}</span></Money></button></li>})}</ul>
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4"><div className="text-xs text-muted-foreground">{t('dashboard.transactions.showing', { from: visibleFrom, to: visibleTo, total: result.meta.total })}</div><Pagination lastPage={result.meta.last_page} onPage={updatePage} page={result.meta.page} /></div>
    </>}

    <TransactionDetails account={account} onClose={() => setSelectedTransaction(null)} transaction={selectedTransaction} />
  </div>
}
