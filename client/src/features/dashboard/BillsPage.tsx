import { useEffect, useRef, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useBlocker, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Check, ChevronLeft, ChevronRight, CreditCard, Droplets, Film, Globe2, HeartPulse, LoaderCircle, Search, ShieldCheck, Smartphone, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Ltr } from '@/components/ui/Ltr'
import { Money } from '@/lib/Money'
import { ApiError } from '@/lib/api'
import { apiErrorMessage } from '@/lib/api-errors'
import { formatDateTime, formatMoneyFromCents } from '@/lib/format'
import { cn } from '@/lib/utils'
import { dollarsToCents } from './transaction-filters'
import { createBillPayment, getBillers, getBillPayments, getDailyLimit, getMoneyAccounts } from './money-api'
import type { BillPayment, Biller } from './money-api'

type Step = 'details' | 'review' | 'receipt'

const categoryIcons = {
  electricity: Zap,
  water: Droplets,
  internet: Globe2,
  mobile: Smartphone,
  insurance: ShieldCheck,
  credit_card: CreditCard,
  tv: Film,
  tax: HeartPulse,
} as const

function centsToInput(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return <div className="grid min-w-0 gap-1.5"><Label htmlFor={id}>{label}</Label>{children}</div>
}

function Summary({ rows }: { rows: { label: string; value: React.ReactNode }[] }) {
  return <dl className="divide-y divide-border border-y border-border">{rows.map(({ label, value }) => <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-4 py-3" key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="min-w-0 break-words text-end text-sm font-semibold">{value}</dd></div>)}</dl>
}

function StepProgress({ step, headingRef }: { step: Step; headingRef: React.RefObject<HTMLHeadingElement | null> }) {
  const { t } = useTranslation('common')
  const steps: Step[] = ['details', 'review', 'receipt']
  return <div aria-label={t('dashboard.bills.progress')} className="grid grid-cols-3 border-y border-border py-3" role="list">
    {steps.map((item, index) => <div aria-current={item === step ? 'step' : undefined} className="flex min-w-0 items-center gap-2 text-xs sm:text-sm" key={item} role="listitem"><span className={cn('grid size-7 shrink-0 place-items-center rounded-full border text-xs font-bold', index < steps.indexOf(step) ? 'border-primary bg-primary text-primary-foreground' : item === step ? 'border-primary text-primary' : 'border-border text-muted-foreground')}>{index < steps.indexOf(step) ? <Check aria-hidden="true" className="size-3.5" /> : index + 1}</span><span className={cn('truncate', item === step ? 'font-bold' : 'text-muted-foreground')}>{t(`dashboard.bills.steps.${item}`)}</span></div>)}
    <h2 className="sr-only" ref={headingRef} tabIndex={-1}>{t(`dashboard.bills.steps.${step}`)}</h2>
  </div>
}

function billErrorMessage(error: unknown, t: (key: string) => string): string {
  if (error instanceof ApiError && error.status === 409) return t('apiErrors.idempotency_key_reused')
  return apiErrorMessage(error, t)
}

export function BillsPage() {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  const [search, setSearch] = useSearchParams()
  const [searchText, setSearchText] = useState('')
  const [selectedBiller, setSelectedBiller] = useState<Biller | null>(null)
  const [accountId, setAccountId] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [amount, setAmount] = useState('')
  const [step, setStep] = useState<Step>('details')
  const [receipt, setReceipt] = useState<BillPayment | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [fieldError, setFieldError] = useState('')
  const headingRef = useRef<HTMLHeadingElement>(null)
  const idempotencyKey = useRef<string | null>(null)
  const inFlight = useRef(false)

  const billersQuery = useQuery({ queryKey: ['dashboard', 'billers'], queryFn: getBillers })
  const accountsQuery = useQuery({ queryKey: ['dashboard', 'accounts'], queryFn: getMoneyAccounts })
  const limitQuery = useQuery({ queryKey: ['dashboard', 'limits'], queryFn: getDailyLimit })
  const accounts = (accountsQuery.data ?? []).filter((account) => account.status === 'active')
  const account = accounts.find((item) => String(item.id) === accountId) ?? accounts[0]
  const parsedAmount = dollarsToCents(amount)
  const dirty = step !== 'receipt' && Boolean(selectedBiller || accountId || referenceNumber || amount)
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname)

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (window.confirm(t('dashboard.bills.leaveConfirm'))) blocker.proceed()
    else blocker.reset()
  }, [blocker, t])

  useEffect(() => {
    const confirmUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', confirmUnload)
    return () => window.removeEventListener('beforeunload', confirmUnload)
  }, [dirty])

  useEffect(() => { headingRef.current?.focus() }, [step])

  const paymentsPage = Math.max(1, Number(search.get('page') ?? '1') || 1)
  const paymentsQuery = useQuery({
    queryKey: ['dashboard', 'bill-payments', paymentsPage],
    queryFn: () => getBillPayments(paymentsPage),
    placeholderData: keepPreviousData,
  })
  const paymentMutation = useMutation({
    mutationFn: ({ key }: { key: string }) => {
      if (!account || !selectedBiller || parsedAmount === null) throw new Error('Payment details are incomplete')
      return createBillPayment({ from_account_id: account.id, biller_code: selectedBiller.code, reference_number: referenceNumber.trim(), amount_cents: parsedAmount }, key)
    },
    onSuccess: async (result) => {
      setReceipt(result); setStep('receipt'); setErrorMessage(''); idempotencyKey.current = null
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'accounts'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'limits'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'bill-payments'] }),
      ])
    },
    onError: (error) => {
      setErrorMessage(billErrorMessage(error, t))
      if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 429) idempotencyKey.current = null
    },
    onSettled: () => { inFlight.current = false },
  })

  const filteredBillers = (billersQuery.data ?? []).filter((biller) => `${biller.name} ${t(`dashboard.bills.categories.${biller.category}`)}`.toLocaleLowerCase().includes(searchText.trim().toLocaleLowerCase()))

  function reviewPayment() {
    setFieldError(''); setErrorMessage('')
    if (!selectedBiller) { setFieldError(t('dashboard.bills.validation.chooseBiller')); return }
    if (!account) { setFieldError(t('dashboard.bills.validation.chooseAccount')); return }
    if (!referenceNumber.trim() || referenceNumber.trim().length > 40) { setFieldError(t('dashboard.bills.validation.reference')); return }
    if (parsedAmount === null || parsedAmount < 1) { setFieldError(t('dashboard.bills.validation.amount')); return }
    idempotencyKey.current = crypto.randomUUID()
    setStep('review')
  }

  function confirmPayment() {
    if (inFlight.current) return
    inFlight.current = true
    idempotencyKey.current ??= crypto.randomUUID()
    setErrorMessage('')
    paymentMutation.mutate({ key: idempotencyKey.current })
  }

  function resetForm() {
    setSelectedBiller(null); setAccountId(''); setReferenceNumber(''); setAmount(''); setReceipt(null); setErrorMessage(''); setFieldError(''); setStep('details'); idempotencyKey.current = null
  }

  function payAgain(payment: BillPayment) {
    const biller = billersQuery.data?.find((item) => item.code === payment.biller_code)
    if (biller) setSelectedBiller(biller)
    setReferenceNumber(payment.reference_number)
    setAmount(centsToInput(payment.amount_cents))
    setReceipt(null); setStep('details'); setErrorMessage(''); setFieldError('')
  }

  function setPage(page: number) {
    const params = new URLSearchParams(search)
    if (page > 1) params.set('page', String(page))
    else params.delete('page')
    setSearch(params)
  }

  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
      <div><p className="text-xs font-semibold uppercase text-primary">{t('dashboard.eyebrow')}</p><h2 className="mt-1 text-2xl font-extrabold">{t('dashboard.bills.title')}</h2></div>
      <p className="text-sm text-muted-foreground">{t('dashboard.bills.limitRemaining')} <Money cents={limitQuery.data?.remaining_cents ?? 0}>{formatMoneyFromCents(limitQuery.data?.remaining_cents ?? 0)}</Money></p>
    </header>

    <StepProgress headingRef={headingRef} step={step} />
    {step === 'details' && <div className="grid gap-8 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
      <section aria-label={t('dashboard.bills.details.title')} className="min-w-0 space-y-4">
        <h3 className="text-base font-bold">{t('dashboard.bills.details.chooseBiller')}</h3>
        <div className="relative max-w-lg"><Search aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label={t('dashboard.bills.details.search')} className="ps-9" onChange={(event) => setSearchText(event.target.value)} placeholder={t('dashboard.bills.details.search')} value={searchText} /></div>
        {billersQuery.isError && <p className="text-sm text-destructive" role="alert">{apiErrorMessage(billersQuery.error, t)}</p>}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">{filteredBillers.map((biller) => {
          const Icon = categoryIcons[biller.category]
          return <button aria-pressed={selectedBiller?.code === biller.code} className={cn('grid min-h-28 content-start justify-items-start gap-3 rounded-md border p-3 text-start transition-colors hover:bg-muted', selectedBiller?.code === biller.code ? 'border-primary bg-primary/10' : 'border-border')} key={biller.code} onClick={() => { setSelectedBiller(biller); setFieldError('') }} type="button"><span className="grid size-9 place-items-center rounded-md bg-muted text-primary"><Icon aria-hidden="true" className="size-4" /></span><span className="min-w-0"><span className="block break-words text-sm font-bold">{biller.name}</span><span className="mt-1 block text-xs text-muted-foreground">{t(`dashboard.bills.categories.${biller.category}`)}</span></span></button>
        })}</div>
        {filteredBillers.length === 0 && <p className="border-y border-border py-6 text-sm text-muted-foreground">{t('dashboard.bills.details.noResults')}</p>}
      </section>
      <section aria-label={t('dashboard.bills.details.paymentDetails')} className="min-w-0 space-y-4 border-t border-border pt-5 xl:border-s xl:border-t-0 xl:ps-8 xl:pt-0">
        <h3 className="text-base font-bold">{t('dashboard.bills.details.paymentDetails')}</h3>
        {selectedBiller && <p className="border-s-2 border-primary ps-3 text-sm font-semibold">{selectedBiller.name}</p>}
        <Field id="bill-account" label={t('dashboard.bills.details.from')}><select className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm" id="bill-account" onChange={(event) => setAccountId(event.target.value)} value={accountId || String(account?.id ?? '')}>{accounts.map((item) => <option key={item.id} value={item.id}>{item.nickname || t(`dashboard.${item.type}`)} · {item.number_masked} · {formatMoneyFromCents(item.balance_cents)}</option>)}</select></Field>
        <Field id="bill-reference" label={t('dashboard.bills.details.reference')}><Input autoComplete="off" id="bill-reference" maxLength={40} onChange={(event) => setReferenceNumber(event.target.value)} value={referenceNumber} /><span className="text-xs text-muted-foreground">{t('dashboard.bills.details.referenceHint')}</span></Field>
        <Field id="bill-amount" label={t('dashboard.bills.details.amount')}><div className="flex gap-2"><Input autoComplete="off" id="bill-amount" inputMode="decimal" onChange={(event) => setAmount(event.target.value)} placeholder="0.00" value={amount} /><Button onClick={() => account && setAmount(centsToInput(account.balance_cents))} type="button" variant="outline">{t('dashboard.bills.details.useBalance')}</Button></div></Field>
        <p aria-live="polite" className="min-h-5 text-xs text-muted-foreground">{account && parsedAmount !== null && parsedAmount > account.balance_cents ? t('dashboard.bills.limitOrBalanceHint') : limitQuery.data && parsedAmount !== null && parsedAmount > limitQuery.data.remaining_cents ? t('dashboard.bills.limitOrBalanceHint') : ''}</p>
        {fieldError && <p aria-live="polite" className="text-sm text-destructive" role="alert">{fieldError}</p>}
        {errorMessage && <p aria-live="polite" className="text-sm text-destructive" role="alert">{errorMessage}</p>}
        <Button className="scroll-mt-20 scroll-mb-24" disabled={!selectedBiller || accountsQuery.isPending} onClick={reviewPayment}>{t('dashboard.bills.actions.review')}</Button>
      </section>
    </div>}

    {step === 'review' && selectedBiller && account && <section className="max-w-2xl space-y-5">
      <h3 className="text-lg font-bold" tabIndex={-1}>{t('dashboard.bills.steps.review')}</h3>
      <div className="rounded-md border border-border bg-card p-4 sm:p-6"><Summary rows={[
        { label: t('dashboard.bills.review.from'), value: <>{account.nickname || t(`dashboard.${account.type}`)}<Ltr><span className="mt-1 block text-xs text-muted-foreground">{account.number_masked}</span></Ltr></> },
        { label: t('dashboard.bills.review.biller'), value: selectedBiller.name },
        { label: t('dashboard.bills.review.reference'), value: <Ltr>{referenceNumber}</Ltr> },
        { label: t('dashboard.bills.review.amount'), value: <Money cents={parsedAmount ?? 0}>{formatMoneyFromCents(parsedAmount ?? 0)}</Money> },
        { label: t('dashboard.bills.review.fee'), value: <Money cents={0}>{formatMoneyFromCents(0)}</Money> },
        { label: t('dashboard.bills.review.newBalance'), value: <Money cents={Math.max(0, account.balance_cents - (parsedAmount ?? 0))}>{formatMoneyFromCents(Math.max(0, account.balance_cents - (parsedAmount ?? 0)))}</Money> },
      ]} /></div>
      {errorMessage && <p aria-live="polite" className="text-sm text-destructive" role="alert">{errorMessage} {t('dashboard.bills.actions.retryHint')}</p>}
      <div className="flex flex-wrap gap-3"><Button className="scroll-mt-20 scroll-mb-24" disabled={paymentMutation.isPending} onClick={() => { setStep('details'); setErrorMessage(''); idempotencyKey.current = null }} variant="outline">{t('dashboard.bills.actions.back')}</Button><Button className="scroll-mt-20 scroll-mb-24" disabled={paymentMutation.isPending} onClick={confirmPayment}>{paymentMutation.isPending && <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />}{paymentMutation.isPending ? t('dashboard.bills.actions.sending') : t('dashboard.bills.actions.confirm')}</Button></div>
    </section>}

    {step === 'receipt' && receipt && <section className="transfer-print-root max-w-2xl space-y-5">
      <div className="grid justify-items-center gap-2 border-b border-border pb-6 text-center"><span className="grid size-12 place-items-center rounded-full bg-primary text-primary-foreground"><Check aria-hidden="true" className="size-6" /></span><h3 className="text-xl font-extrabold">{t('dashboard.bills.receipt.success')}</h3><Money cents={receipt.amount_cents}><p className="text-3xl font-extrabold tabular-nums">{formatMoneyFromCents(receipt.amount_cents)}</p></Money></div>
      <Summary rows={[
        { label: t('dashboard.bills.review.biller'), value: receipt.biller_name },
        { label: t('dashboard.bills.review.reference'), value: <Ltr>{receipt.reference_number}</Ltr> },
        { label: t('dashboard.bills.receipt.transactionReference'), value: <Ltr><span className="break-all font-mono">{receipt.transaction_reference}</span></Ltr> },
        { label: t('dashboard.bills.receipt.date'), value: formatDateTime(receipt.created_at) },
      ]} />
      <div className="flex flex-wrap gap-3 print:hidden"><Button onClick={resetForm}>{t('dashboard.bills.receipt.another')}</Button><Button onClick={() => window.location.assign('/dashboard/transactions')} variant="outline">{t('dashboard.bills.receipt.transactions')}</Button><Button onClick={() => window.print()} variant="outline">{t('dashboard.bills.receipt.print')}</Button></div>
    </section>}

    <section aria-labelledby="recent-bills-title" className="border-t border-border pt-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3"><h3 className="text-base font-bold" id="recent-bills-title">{t('dashboard.bills.recent.title')}</h3><span className="text-xs text-muted-foreground">{t('dashboard.bills.recent.pagination')}</span></div>
      {paymentsQuery.isError && <p className="py-4 text-sm text-destructive" role="alert">{apiErrorMessage(paymentsQuery.error, t)}</p>}
      {paymentsQuery.data?.data.length === 0 && <p className="border-y border-border py-6 text-sm text-muted-foreground">{t('dashboard.bills.recent.empty')}</p>}
      {!!paymentsQuery.data?.data.length && <ul className="mt-3 divide-y divide-border border-y border-border">{paymentsQuery.data.data.map((payment) => <li className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3" key={payment.id}><div className="min-w-0"><p className="truncate text-sm font-semibold">{payment.biller_name}</p><p className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted-foreground"><Ltr>{payment.reference_number}</Ltr><time dateTime={payment.created_at}>{formatDateTime(payment.created_at)}</time></p></div><div className="flex items-center gap-2"><Money cents={payment.amount_cents}><span className="whitespace-nowrap text-sm font-bold tabular-nums">{formatMoneyFromCents(payment.amount_cents)}</span></Money><Button onClick={() => payAgain(payment)} size="sm" variant="outline">{t('dashboard.bills.recent.payAgain')}</Button></div></li>)}</ul>}
      {paymentsQuery.data && paymentsQuery.data.meta.last_page > 1 && <nav aria-label={t('dashboard.bills.recent.pagination')} className="mt-4 flex items-center justify-center gap-2"><Button aria-label={t('dashboard.bills.recent.previousPage')} disabled={paymentsPage <= 1} onClick={() => setPage(paymentsPage - 1)} size="icon" variant="outline"><ChevronLeft aria-hidden="true" className="rtl:rotate-180" /></Button><span className="text-sm tabular-nums">{paymentsPage} / {paymentsQuery.data.meta.last_page}</span><Button aria-label={t('dashboard.bills.recent.nextPage')} disabled={paymentsPage >= paymentsQuery.data.meta.last_page} onClick={() => setPage(paymentsPage + 1)} size="icon" variant="outline"><ChevronRight aria-hidden="true" className="rtl:rotate-180" /></Button></nav>}
    </section>
  </div>
}