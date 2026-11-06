import { useEffect, useRef, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useBlocker, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Check, ChevronLeft, ChevronRight, Copy, LoaderCircle, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Ltr } from '@/components/ui/Ltr'
import { Money } from '@/lib/Money'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ApiError } from '@/lib/api'
import { apiErrorMessage } from '@/lib/api-errors'
import { formatDateTime, formatMoneyFromCents } from '@/lib/format'
import { cn } from '@/lib/utils'
import { dollarsToCents } from './transaction-filters'
import { getMoneyAccounts, getBeneficiaries, lookupRecipient, getDailyLimit, createTransfer, createBeneficiary, deleteBeneficiary, getTransfers, getTransfer } from './money-api'
import type { Beneficiary, RecipientLookup, TransferFilters, TransferPayload, TransferReceipt } from './money-api'

type Tab = 'move' | 'recipients' | 'history'
type Destination = 'own' | 'beneficiary' | 'new'
type Step = 'details' | 'review' | 'receipt'
const tabIdPrefix = 'dashboard-transfer-tab-'
const dateFromFilter = 'date_from'
const dateToFilter = 'date_to'

function centsToInput(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`
}

function updateSearch(search: URLSearchParams, setSearch: (params: URLSearchParams) => void, updates: Record<string, string | null>) {
  const next = new URLSearchParams(search)
  Object.entries(updates).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key))
  if ('direction' in updates || dateFromFilter in updates || dateToFilter in updates) next.delete('page')
  setSearch(next)
}

function Progress({ step, titleRef }: { step: Step; titleRef: React.RefObject<HTMLHeadingElement | null> }) {
  const { t } = useTranslation('common')
  const steps: Step[] = ['details', 'review', 'receipt']
  return <div aria-label={t('dashboard.transfers.progress')} className="grid grid-cols-3 border-y border-border py-3" role="list">
    {steps.map((item, index) => {
      const currentIndex = steps.indexOf(step)
      const completed = index < currentIndex
      return <div aria-current={item === step ? 'step' : undefined} className="flex min-w-0 items-center gap-2 text-xs sm:text-sm" key={item} role="listitem">
        <span className={cn('grid size-7 shrink-0 place-items-center rounded-full border text-xs font-bold', completed ? 'border-primary bg-primary text-primary-foreground' : item === step ? 'border-primary text-primary' : 'border-border text-muted-foreground')}>
          {completed ? <Check aria-hidden="true" className="size-3.5" /> : index + 1}
        </span>
        <span className={cn('truncate', item === step ? 'font-bold text-foreground' : 'text-muted-foreground')}>{t(`dashboard.transfers.steps.${item}`)}</span>
      </div>
    })}
    <h2 className="sr-only" ref={titleRef} tabIndex={-1}>{t(`dashboard.transfers.steps.${step}`)}</h2>
  </div>
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return <div className="grid min-w-0 gap-1.5"><Label htmlFor={id}>{label}</Label>{children}</div>
}

function TransferSummary({ rows }: { rows: { label: string; value: React.ReactNode }[] }) {
  return <dl className="divide-y divide-border border-y border-border">
    {rows.map(({ label, value }) => <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-4 py-3" key={label}>
      <dt className="text-sm text-muted-foreground">{label}</dt><dd className="min-w-0 break-words text-end text-sm font-semibold">{value}</dd>
    </div>)}
  </dl>
}

function TransferDetailSheet({ transfer, onClose }: { transfer: TransferReceipt | null; onClose: () => void }) {
  const { t } = useTranslation('common')
  if (!transfer) return null
  const receipt = transfer
  async function copyReference() {
    await navigator.clipboard.writeText(receipt.reference)
  }
  return <Sheet onOpenChange={(open) => { if (!open) onClose() }} open>
    <SheetContent aria-describedby="transfer-detail-description" className="overflow-y-auto sm:w-[min(30rem,90vw)]">
      <SheetHeader><SheetTitle>{t('dashboard.transfers.history.detailTitle')}</SheetTitle><SheetDescription id="transfer-detail-description">{t('dashboard.transfers.history.detailDescription')}</SheetDescription></SheetHeader>
      <div className="mt-6"><p className="text-xs font-semibold text-muted-foreground">{t('dashboard.transfers.review.amount')}</p><Money cents={receipt.amount_cents}><p className="mt-1 text-2xl font-extrabold tabular-nums">{formatMoneyFromCents(receipt.amount_cents)}</p></Money></div>
      <TransferSummary rows={[
        { label: t('dashboard.transfers.receipt.date'), value: formatDateTime(receipt.created_at) },
        { label: t('dashboard.transfers.review.from'), value: <Ltr>{receipt.from.number_masked}</Ltr> },
        { label: t('dashboard.transfers.review.to'), value: <><span>{receipt.to.holder_masked}</span><Ltr><span className="mt-1 block text-xs text-muted-foreground">{receipt.to.number_masked}</span></Ltr></> },
        { label: t('dashboard.transfers.review.memo'), value: receipt.memo || t('dashboard.transfers.notProvided') },
        { label: t('dashboard.transfers.receipt.reference'), value: <span className="flex items-center justify-end gap-2"><Ltr><span className="break-all font-mono">{receipt.reference}</span></Ltr><Button aria-label={t('dashboard.transfers.receipt.copyReference')} onClick={() => void copyReference()} size="icon" variant="ghost"><Copy aria-hidden="true" /></Button></span> },
        { label: t('dashboard.transfers.receipt.newBalance'), value: <Money cents={receipt.balance_after_cents}>{formatMoneyFromCents(receipt.balance_after_cents)}</Money> },
      ]} />
    </SheetContent>
  </Sheet>
}

function transferErrorMessage(error: unknown, t: (key: string) => string): string {
  if (error instanceof ApiError && error.status === 409) return t('apiErrors.idempotency_key_reused')
  return apiErrorMessage(error, t)
}

export function TransfersPage() {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { transferId } = useParams<{ transferId: string }>()
  const [search, setSearch] = useSearchParams()
  const [tab, setTab] = useState<Tab>(transferId ? 'history' : 'move')
  const [step, setStep] = useState<Step>('details')
  const [destination, setDestination] = useState<Destination>('own')
  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [beneficiaryId, setBeneficiaryId] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [lookup, setLookup] = useState<RecipientLookup | null>(null)
  const [lookupConfirmed, setLookupConfirmed] = useState(false)
  const [lookupError, setLookupError] = useState('')
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [formError, setFormError] = useState('')
  const [receipt, setReceipt] = useState<TransferReceipt | null>(null)
  const [saveNickname, setSaveNickname] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [recipientNumber, setRecipientNumber] = useState('')
  const [recipientLookup, setRecipientLookup] = useState<RecipientLookup | null>(null)
  const [recipientConfirmed, setRecipientConfirmed] = useState(false)
  const [recipientNickname, setRecipientNickname] = useState('')
  const [recipientError, setRecipientError] = useState('')
  const [listError, setListError] = useState('')
  const stepHeading = useRef<HTMLHeadingElement>(null)
  const inFlight = useRef(false)
  const idempotencyKey = useRef<string | null>(null)

  const accountsQuery = useQuery({ queryKey: ['dashboard', 'accounts'], queryFn: getMoneyAccounts })
  const beneficiariesQuery = useQuery({ queryKey: ['dashboard', 'beneficiaries'], queryFn: getBeneficiaries })
  const limitQuery = useQuery({ queryKey: ['dashboard', 'limits'], queryFn: getDailyLimit })
  const accounts = (accountsQuery.data ?? []).filter((account) => account.status === 'active')
  const beneficiaries = beneficiariesQuery.data ?? []
  const fromAccount = accounts.find((account) => String(account.id) === fromId) ?? accounts[0]
  const ownTarget = accounts.find((account) => String(account.id) === toId)
    ?? accounts.find((account) => account.id !== fromAccount?.id)
  const savedTarget = beneficiaries.find((item) => String(item.id) === beneficiaryId)
  const parsedAmount = dollarsToCents(amount)
  const dirty = step !== 'receipt' && Boolean(fromId || toId || beneficiaryId || accountNumber || amount || memo || recipientNumber)
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname)

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (window.confirm(t('dashboard.transfers.leaveConfirm'))) blocker.proceed()
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

  useEffect(() => {
    stepHeading.current?.focus()
  }, [step])

  useEffect(() => {
    const preset = search.get('recipient')
    if (preset && beneficiaries.some((item) => String(item.id) === preset)) {
      setDestination('beneficiary')
      setBeneficiaryId(preset)
      setTab('move')
      const next = new URLSearchParams(search)
      next.delete('recipient')
      setSearch(next, { replace: true })
    }
  }, [beneficiaries, search, setSearch])

  const lookupMutation = useMutation({
    mutationFn: lookupRecipient,
    onSuccess: (result) => { setLookup(result); setLookupConfirmed(false); setLookupError('') },
    onError: (error) => { setLookup(null); setLookupConfirmed(false); setLookupError(apiErrorMessage(error, t)) },
  })
  const recipientLookupMutation = useMutation({
    mutationFn: lookupRecipient,
    onSuccess: (result) => { setRecipientLookup(result); setRecipientConfirmed(false); setRecipientError('') },
    onError: (error) => { setRecipientLookup(null); setRecipientConfirmed(false); setRecipientError(apiErrorMessage(error, t)) },
  })
  const saveRecipientMutation = useMutation({
    mutationFn: () => createBeneficiary(recipientNumber, recipientNickname || undefined),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['dashboard', 'beneficiaries'] })
      setRecipientNumber(''); setRecipientNickname(''); setRecipientLookup(null); setRecipientConfirmed(false); setSaveMessage(t('dashboard.transfers.recipients.added'))
    },
    onError: (error) => setRecipientError(apiErrorMessage(error, t)),
  })
  const removeRecipientMutation = useMutation({
    mutationFn: deleteBeneficiary,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['dashboard', 'beneficiaries'] }),
    onError: (error) => setListError(apiErrorMessage(error, t)),
  })
  const transferMutation = useMutation({
    mutationFn: ({ payload, key }: { payload: TransferPayload; key: string }) => createTransfer(payload, key),
    onSuccess: async (result) => {
      setReceipt(result); setStep('receipt'); setFormError(''); idempotencyKey.current = null
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'accounts'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'limits'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'transfers'] }),
      ])
    },
    onError: (error) => {
      setFormError(transferErrorMessage(error, t))
      if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 429) idempotencyKey.current = null
    },
    onSettled: () => { inFlight.current = false },
  })
  const saveAfterTransferMutation = useMutation({
    mutationFn: () => createBeneficiary(accountNumber, saveNickname),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['dashboard', 'beneficiaries'] }); setSaveMessage(t('dashboard.transfers.recipients.added')) },
    onError: (error) => setSaveMessage(apiErrorMessage(error, t)),
  })

  const transferFilters: TransferFilters = {
    page: Number(search.get('page') ?? '1'),
    ...(search.get('direction') && search.get('direction') !== 'all' ? { direction: search.get('direction') as TransferFilters['direction'] } : {}),
    ...(search.get(dateFromFilter) ? { [dateFromFilter]: search.get(dateFromFilter)! } : {}),
    ...(search.get(dateToFilter) ? { [dateToFilter]: search.get(dateToFilter)! } : {}),
  }
  const historyQuery = useQuery({
    queryKey: ['dashboard', 'transfers', transferFilters],
    queryFn: () => getTransfers(transferFilters),
    enabled: tab === 'history' && !transferId,
    placeholderData: keepPreviousData,
  })
  const transferDetailQuery = useQuery({
    queryKey: ['dashboard', 'transfer', transferId],
    queryFn: () => getTransfer(transferId!),
    enabled: Boolean(transferId),
  })

  useEffect(() => {
    if (transferId) setTab('history')
  }, [transferId])

  function runLookup(number: string, recipientForm = false) {
    if (!/^\d{10}$/.test(number)) {
      if (recipientForm) setRecipientError(t('dashboard.transfers.recipients.numberInvalid'))
      else setLookupError(t('dashboard.transfers.lookup.numberInvalid'))
      return
    }
    if (recipientForm) recipientLookupMutation.mutate(number)
    else lookupMutation.mutate(number)
  }

  function continueToReview() {
    setFormError('')
    if (!fromAccount || parsedAmount === null || parsedAmount < 1) { setFormError(t('dashboard.transfers.amountInvalid')); return }
    if (destination === 'own' && (!ownTarget || ownTarget.id === fromAccount.id)) { setFormError(t('dashboard.transfers.sameAccount')); return }
    if (destination === 'beneficiary' && !savedTarget) { setFormError(t('dashboard.transfers.recipients.selectRecipient')); return }
    if (destination === 'new' && (!lookup || !lookupConfirmed)) { setFormError(t('dashboard.transfers.lookup.confirmRequired')); return }
    idempotencyKey.current = crypto.randomUUID()
    setStep('review')
  }

  function transferPayload(): TransferPayload {
    if (!fromAccount || parsedAmount === null) throw new Error('Transfer details are incomplete')
    const common = { from_account_id: fromAccount.id, amount_cents: parsedAmount, ...(memo.trim() ? { memo: memo.trim() } : {}) }
    if (destination === 'own' && ownTarget) return { ...common, to_type: 'own', to_account_id: ownTarget.id }
    if (destination === 'beneficiary') return { ...common, to_type: 'beneficiary', beneficiary_id: Number(beneficiaryId) }
    return { ...common, to_type: 'account_number', account_number: accountNumber }
  }

  function confirmTransfer() {
    if (inFlight.current) return
    inFlight.current = true
    idempotencyKey.current ??= crypto.randomUUID()
    setFormError('')
    transferMutation.mutate({ payload: transferPayload(), key: idempotencyKey.current })
  }

  function newTransfer() {
    setStep('details'); setReceipt(null); setFromId(''); setToId(''); setBeneficiaryId(''); setAccountNumber(''); setLookup(null); setLookupConfirmed(false); setAmount(''); setMemo(''); setFormError(''); setSaveMessage(''); setSaveNickname(''); idempotencyKey.current = null
  }

  function chooseRecipient(item: Beneficiary) {
    setDestination('beneficiary'); setBeneficiaryId(String(item.id)); setTab('move'); setStep('details'); setReceipt(null)
  }

  const toName = destination === 'own'
    ? ownTarget?.nickname || (ownTarget ? t(`dashboard.${ownTarget.type}`) : '')
    : destination === 'beneficiary'
      ? savedTarget?.nickname || savedTarget?.name || ''
      : lookup?.holder_masked || ''
  const toNumber = destination === 'own' ? ownTarget?.number_masked : destination === 'beneficiary' ? savedTarget?.number_masked : lookup ? `•••• ${accountNumber.slice(-4)}` : ''
  const recipientCount = beneficiaries.length

  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
      <div><p className="text-xs font-semibold uppercase text-primary">{t('dashboard.eyebrow')}</p><h2 className="mt-1 text-2xl font-extrabold">{t('dashboard.transfers.title')}</h2></div>
      {tab === 'move' && <p className="text-sm text-muted-foreground">{t('dashboard.transfers.limitRemaining')} <Money cents={limitQuery.data?.remaining_cents ?? 0}>{formatMoneyFromCents(limitQuery.data?.remaining_cents ?? 0)}</Money></p>}
    </header>

    <div aria-label={t('dashboard.transfers.tabs.label')} className="flex flex-wrap gap-1 border-b border-border" role="tablist">
      {(['move', 'recipients', 'history'] as const).map((item) => <button aria-selected={tab === item} className={cn('min-h-11 border-b-2 px-3 text-sm font-semibold', tab === item ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')} id={`${tabIdPrefix}${item}`} key={item} onClick={() => setTab(item)} role="tab" type="button">{t(`dashboard.transfers.tabs.${item}`)}</button>)}
    </div>

    {tab === 'move' && <section aria-labelledby={`${tabIdPrefix}move`} className={cn('space-y-5', step === 'receipt' && 'transfer-print-root')}>
      {step !== 'receipt' && <Progress step={step} titleRef={stepHeading} />}
      {step === 'details' && <div className="max-w-3xl space-y-5">
        <h3 className="text-lg font-bold" tabIndex={-1}>{t('dashboard.transfers.steps.details')}</h3>
        {accountsQuery.isError && <p className="text-sm text-destructive" role="alert">{apiErrorMessage(accountsQuery.error, t)}</p>}
        <Field id="transfer-from" label={t('dashboard.transfers.details.from')}>
          <select className="min-h-11 w-full min-w-0 max-w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" id="transfer-from" onChange={(event) => setFromId(event.target.value)} value={fromId || String(fromAccount?.id ?? '')}>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.nickname || t(`dashboard.${account.type}`)} · {account.number_masked} · {formatMoneyFromCents(account.balance_cents)}</option>)}
          </select>
        </Field>
        <fieldset className="grid gap-2"><legend className="mb-1 text-sm font-semibold">{t('dashboard.transfers.details.to')}</legend><div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(['own', 'beneficiary', 'new'] as const).map((item) => <button aria-pressed={destination === item} className={cn('min-h-11 rounded-md border px-3 py-2 text-sm font-semibold transition-colors', destination === item ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-muted')} key={item} onClick={() => { setDestination(item); setFormError('') }} type="button">{t(`dashboard.transfers.details.destinations.${item}`)}</button>)}
        </div></fieldset>
        {destination === 'own' && <Field id="transfer-to-own" label={t('dashboard.transfers.details.myAccount')}><select className="min-h-11 w-full min-w-0 max-w-full rounded-md border border-input bg-background px-3 text-sm" id="transfer-to-own" onChange={(event) => setToId(event.target.value)} value={toId || String(accounts.find((account) => account.id !== fromAccount?.id)?.id ?? '')}>{accounts.filter((account) => account.id !== fromAccount?.id).map((account) => <option key={account.id} value={account.id}>{account.nickname || t(`dashboard.${account.type}`)} · {account.number_masked} · {formatMoneyFromCents(account.balance_cents)}</option>)}</select></Field>}
        {destination === 'beneficiary' && <Field id="transfer-beneficiary" label={t('dashboard.transfers.details.savedRecipient')}><select className="min-h-11 rounded-md border border-input bg-background px-3 text-sm" id="transfer-beneficiary" onChange={(event) => setBeneficiaryId(event.target.value)} value={beneficiaryId || String(beneficiaries[0]?.id ?? '')}><option value="">{t('dashboard.transfers.recipients.selectRecipient')}</option>{beneficiaries.map((item) => <option key={item.id} value={item.id}>{item.nickname || item.name} · {item.number_masked}</option>)}</select></Field>}
        {destination === 'new' && <div className="space-y-3">
          <Field id="transfer-number" label={t('dashboard.transfers.details.accountNumber')}><div className="flex flex-wrap gap-2"><Input autoComplete="off" inputMode="numeric" maxLength={10} onChange={(event) => { setAccountNumber(event.target.value.replace(/\D/g, '').slice(0, 10)); setLookup(null); setLookupConfirmed(false); setLookupError('') }} value={accountNumber} id="transfer-number" /><Button disabled={lookupMutation.isPending || accountNumber.length !== 10} onClick={() => runLookup(accountNumber)} type="button" variant="outline"><Search aria-hidden="true" />{lookupMutation.isPending ? t('dashboard.transfers.lookup.checking') : t('dashboard.transfers.lookup.check')}</Button></div></Field>
          <div aria-live="polite" className="min-h-6 text-sm" role="status">{lookupMutation.isPending ? t('dashboard.transfers.lookup.checking') : lookupError || (lookup ? <span className="font-semibold">{t('dashboard.transfers.lookup.result', { name: lookup.holder_masked })}</span> : '')}</div>
          {lookup && <label className="flex items-start gap-2 text-sm"><input checked={lookupConfirmed} className="mt-1 size-4 accent-primary" onChange={(event) => setLookupConfirmed(event.target.checked)} type="checkbox" /><span>{t('dashboard.transfers.lookup.confirm', { name: lookup.holder_masked })}</span></label>}
        </div>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="transfer-amount" label={t('dashboard.transfers.details.amount')}><div className="flex gap-2"><Input autoComplete="off" inputMode="decimal" onChange={(event) => setAmount(event.target.value)} placeholder="0.00" value={amount} id="transfer-amount" /><Button onClick={() => fromAccount && setAmount(centsToInput(fromAccount.balance_cents))} type="button" variant="outline">{t('dashboard.transfers.details.useBalance')}</Button></div></Field>
          <p aria-live="polite" className="self-end pb-2 text-xs text-muted-foreground">{fromAccount && parsedAmount !== null && parsedAmount > fromAccount.balance_cents ? t('dashboard.transfers.details.overBalance') : limitQuery.data && parsedAmount !== null && destination !== 'own' && parsedAmount > limitQuery.data.remaining_cents ? t('dashboard.transfers.details.overLimit') : ''}</p>
        </div>
        <Field id="transfer-memo" label={t('dashboard.transfers.details.memo')}><textarea className="min-h-24 resize-y rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" id="transfer-memo" maxLength={140} onChange={(event) => setMemo(event.target.value)} value={memo} /><span className="text-end text-xs text-muted-foreground">{memo.length}/140</span></Field>
        {formError && <p aria-live="polite" className="text-sm text-destructive" role="alert">{formError}</p>}
        <Button className="scroll-mt-20 scroll-mb-24" disabled={!accounts.length || accountsQuery.isPending} onClick={continueToReview}>{t('dashboard.transfers.actions.review')}</Button>
      </div>}

      {step === 'review' && fromAccount && <div className="max-w-2xl space-y-5">
        <h3 className="text-lg font-bold" tabIndex={-1}>{t('dashboard.transfers.steps.review')}</h3>
        <div className="space-y-4 rounded-md border border-border bg-card p-4 sm:p-6">
          <TransferSummary rows={[
            { label: t('dashboard.transfers.review.from'), value: <>{fromAccount.nickname || t(`dashboard.${fromAccount.type}`)}<Ltr><span className="mt-1 block text-xs text-muted-foreground">{fromAccount.number_masked}</span></Ltr></> },
            { label: t('dashboard.transfers.review.to'), value: <>{toName}<Ltr><span className="mt-1 block text-xs text-muted-foreground">{toNumber}</span></Ltr></> },
            { label: t('dashboard.transfers.review.amount'), value: <Money cents={parsedAmount ?? 0}>{formatMoneyFromCents(parsedAmount ?? 0)}</Money> },
            { label: t('dashboard.transfers.review.memo'), value: memo || t('dashboard.transfers.notProvided') },
            { label: t('dashboard.transfers.review.fee'), value: <Money cents={0}>{formatMoneyFromCents(0)}</Money> },
            { label: t('dashboard.transfers.review.newBalance'), value: <Money cents={Math.max(0, fromAccount.balance_cents - (parsedAmount ?? 0))}>{formatMoneyFromCents(Math.max(0, fromAccount.balance_cents - (parsedAmount ?? 0)))}</Money> },
          ]} />
        </div>
        {formError && <p aria-live="polite" className="text-sm text-destructive" role="alert">{formError} {t('dashboard.transfers.actions.retryHint')}</p>}
        <div className="flex flex-wrap gap-3"><Button className="scroll-mt-20 scroll-mb-24" disabled={transferMutation.isPending} onClick={() => { setFormError(''); setStep('details'); idempotencyKey.current = null }} variant="outline">{t('dashboard.transfers.actions.back')}</Button><Button className="scroll-mt-20 scroll-mb-24" disabled={transferMutation.isPending} onClick={confirmTransfer}>{transferMutation.isPending && <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />}{transferMutation.isPending ? t('dashboard.transfers.actions.sending') : t('dashboard.transfers.actions.confirm')}</Button></div>
      </div>}

      {step === 'receipt' && receipt && <div className="max-w-2xl space-y-5">
        <div className="grid justify-items-center gap-2 border-b border-border pb-6 text-center"><span className="grid size-12 place-items-center rounded-full bg-primary text-primary-foreground"><Check aria-hidden="true" className="size-6" /></span><h3 className="text-xl font-extrabold" ref={stepHeading} tabIndex={-1}>{t('dashboard.transfers.receipt.success')}</h3><Money cents={receipt.amount_cents}><p className="text-3xl font-extrabold tabular-nums">{formatMoneyFromCents(receipt.amount_cents)}</p></Money></div>
        <TransferSummary rows={[
          { label: t('dashboard.transfers.receipt.reference'), value: <span className="flex items-center justify-end gap-2"><Ltr><span className="break-all font-mono">{receipt.reference}</span></Ltr><Button aria-label={t('dashboard.transfers.receipt.copyReference')} onClick={() => void navigator.clipboard.writeText(receipt.reference)} size="icon" variant="ghost"><Copy aria-hidden="true" /></Button></span> },
          { label: t('dashboard.transfers.receipt.date'), value: formatDateTime(receipt.created_at) },
          { label: t('dashboard.transfers.review.from'), value: <Ltr>{receipt.from.number_masked}</Ltr> },
          { label: t('dashboard.transfers.review.to'), value: <>{receipt.to.holder_masked}<Ltr><span className="mt-1 block text-xs text-muted-foreground">{receipt.to.number_masked}</span></Ltr></> },
          { label: t('dashboard.transfers.receipt.newBalance'), value: <Money cents={receipt.balance_after_cents}>{formatMoneyFromCents(receipt.balance_after_cents)}</Money> },
        ]} />
        {destination === 'new' && <div className="grid gap-2 border-y border-border py-4 sm:grid-cols-[minmax(0,1fr)_auto]"><Field id="save-recipient-nickname" label={t('dashboard.transfers.recipients.nickname')}><Input id="save-recipient-nickname" maxLength={80} onChange={(event) => setSaveNickname(event.target.value)} value={saveNickname} /></Field><Button className="self-end" disabled={saveAfterTransferMutation.isPending || recipientCount >= 50} onClick={() => saveAfterTransferMutation.mutate()} variant="outline">{t('dashboard.transfers.receipt.saveRecipient')}</Button></div>}
        {saveMessage && <p aria-live="polite" className="text-sm text-muted-foreground" role="status">{saveMessage}</p>}
        <div className="flex flex-wrap gap-3 print:hidden"><Button onClick={newTransfer} variant="default">{t('dashboard.transfers.receipt.another')}</Button><Button onClick={() => window.location.assign('/dashboard/transactions')} variant="outline">{t('dashboard.transfers.receipt.transactions')}</Button><Button onClick={() => window.print()} variant="outline">{t('dashboard.transfers.receipt.print')}</Button></div>
      </div>}
    </section>}

    {tab === 'recipients' && <section aria-labelledby={`${tabIdPrefix}recipients`} className="grid gap-8 xl:grid-cols-[minmax(18rem,0.85fr)_minmax(0,1.15fr)]">
      <div className="space-y-4 border-b border-border pb-6 xl:border-e xl:border-b-0 xl:pe-8 xl:pb-0">
        <div className="flex items-baseline justify-between gap-2"><h3 className="text-base font-bold">{t('dashboard.transfers.recipients.addTitle')}</h3><span className="text-xs text-muted-foreground">{t('dashboard.transfers.recipients.count', { count: recipientCount })}</span></div>
        <Field id="recipient-account-number" label={t('dashboard.transfers.details.accountNumber')}><div className="flex flex-wrap gap-2"><Input autoComplete="off" inputMode="numeric" maxLength={10} onChange={(event) => { setRecipientNumber(event.target.value.replace(/\D/g, '').slice(0, 10)); setRecipientLookup(null); setRecipientConfirmed(false); setRecipientError('') }} value={recipientNumber} id="recipient-account-number" /><Button disabled={recipientLookupMutation.isPending || recipientNumber.length !== 10} onClick={() => runLookup(recipientNumber, true)} type="button" variant="outline"><Search aria-hidden="true" />{t('dashboard.transfers.lookup.check')}</Button></div></Field>
        <div aria-live="polite" className="min-h-6 text-sm" role="status">{recipientLookupMutation.isPending ? t('dashboard.transfers.lookup.checking') : recipientError || (recipientLookup ? t('dashboard.transfers.lookup.result', { name: recipientLookup.holder_masked }) : '')}</div>
        {recipientLookup && <><label className="flex items-start gap-2 text-sm"><input checked={recipientConfirmed} className="mt-1 size-4 accent-primary" onChange={(event) => setRecipientConfirmed(event.target.checked)} type="checkbox" /><span>{t('dashboard.transfers.lookup.confirm', { name: recipientLookup.holder_masked })}</span></label><Field id="recipient-nickname" label={t('dashboard.transfers.recipients.nickname')}><Input id="recipient-nickname" maxLength={80} onChange={(event) => setRecipientNickname(event.target.value)} value={recipientNickname} /></Field></>}
        {recipientError && <p aria-live="polite" className="text-sm text-destructive" role="alert">{recipientError}</p>}
        <Button disabled={!recipientLookup || !recipientConfirmed || saveRecipientMutation.isPending || recipientCount >= 50} onClick={() => saveRecipientMutation.mutate()}>{t('dashboard.transfers.recipients.add')}</Button>
        {recipientCount >= 50 && <p className="text-sm text-muted-foreground">{t('dashboard.transfers.recipients.maximum')}</p>}
        {saveMessage && <p aria-live="polite" className="text-sm text-primary" role="status">{saveMessage}</p>}
      </div>
      <div className="min-w-0">
        <h3 className="mb-3 text-base font-bold">{t('dashboard.transfers.recipients.title')}</h3>
        {listError && <p className="mb-3 text-sm text-destructive" role="alert">{listError}</p>}
        {beneficiariesQuery.isPending ? <p className="py-5 text-sm text-muted-foreground">{t('dashboard.loading')}</p> : beneficiaries.length === 0 ? <p className="border-y border-border py-8 text-sm text-muted-foreground">{t('dashboard.transfers.recipients.empty')}</p> : <ul className="divide-y divide-border border-y border-border">{beneficiaries.map((item) => <li className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-4" key={item.id}>
          <div className="min-w-0"><p className="truncate text-sm font-semibold">{item.nickname || item.name}</p>{item.nickname && <p className="truncate text-xs text-muted-foreground">{item.name}</p>}<Ltr><span className="mt-1 block text-xs text-muted-foreground">{item.number_masked}</span></Ltr></div>
          <div className="flex items-center gap-1"><Button onClick={() => chooseRecipient(item)} size="sm" variant="outline">{t('dashboard.transfers.recipients.send')}</Button><Button aria-label={t('dashboard.transfers.recipients.deleteLabel', { name: item.nickname || item.name })} disabled={removeRecipientMutation.isPending} onClick={() => { if (window.confirm(t('dashboard.transfers.recipients.deleteConfirm', { name: item.nickname || item.name }))) removeRecipientMutation.mutate(item.id) }} size="icon" variant="ghost"><Trash2 aria-hidden="true" /></Button></div>
        </li>)}</ul>}
      </div>
    </section>}

    {tab === 'history' && <section aria-labelledby={`${tabIdPrefix}history`} className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field id="history-direction" label={t('dashboard.transfers.history.direction')}><select className="min-h-10 rounded-md border border-input bg-background px-3 text-sm" id="history-direction" onChange={(event) => updateSearch(search, setSearch, { direction: event.target.value, page: null })} value={search.get('direction') ?? 'all'}><option value="all">{t('dashboard.transfers.history.all')}</option><option value="out">{t('dashboard.transfers.history.sent')}</option><option value="in">{t('dashboard.transfers.history.received')}</option><option value="own">{t('dashboard.transfers.history.own')}</option></select></Field>
        <Field id="history-from" label={t('dashboard.transfers.history.dateFrom')}><Input id="history-from" onChange={(event) => updateSearch(search, setSearch, { [dateFromFilter]: event.target.value, page: null })} type="date" value={search.get(dateFromFilter) ?? ''} /></Field>
        <Field id="history-to" label={t('dashboard.transfers.history.dateTo')}><Input id="history-to" onChange={(event) => updateSearch(search, setSearch, { [dateToFilter]: event.target.value, page: null })} type="date" value={search.get(dateToFilter) ?? ''} /></Field>
      </div>
      {historyQuery.isError && <p className="text-sm text-destructive" role="alert">{apiErrorMessage(historyQuery.error, t)}</p>}
      {transferDetailQuery.isError && <p className="text-sm text-destructive" role="alert">{apiErrorMessage(transferDetailQuery.error, t)}</p>}
      {historyQuery.data?.data.length === 0 && <p className="border-y border-border py-8 text-sm text-muted-foreground">{t('dashboard.transfers.history.empty')}</p>}
      {!!historyQuery.data?.data.length && <ul className="divide-y divide-border border-y border-border">{historyQuery.data.data.map((item) => {
        const sent = accounts.some((account) => account.id === item.from.account_id)
        return <li className="grid min-h-16 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 py-3" key={item.id}>
        <span className="grid size-8 place-items-center rounded-full bg-muted text-primary">{item.to.type === 'own' ? <ArrowLeftRight aria-hidden="true" className="size-4" /> : sent ? <ArrowUpRight aria-hidden="true" className="size-4" /> : <ArrowDownLeft aria-hidden="true" className="size-4" />}</span>
        <span className="min-w-0"><span className="block truncate text-sm font-semibold">{item.to.holder_masked}</span><time className="block text-xs text-muted-foreground" dateTime={item.created_at}>{formatDateTime(item.created_at)}</time></span>
        <div className="flex items-center gap-2"><Money cents={item.amount_cents}><span className="whitespace-nowrap text-sm font-bold tabular-nums">{formatMoneyFromCents(item.amount_cents)}</span></Money><Button aria-label={t('dashboard.transfers.history.openDetail')} onClick={() => navigate(`/dashboard/transfers/${item.id}`)} size="icon" variant="ghost"><ChevronRight aria-hidden="true" className="rtl:rotate-180" /></Button></div>
      </li>
      })}</ul>}
      {historyQuery.data && historyQuery.data.meta.last_page > 1 && <nav aria-label={t('dashboard.transfers.history.pagination')} className="flex items-center justify-center gap-2"><Button disabled={(transferFilters.page ?? 1) <= 1} onClick={() => updateSearch(search, setSearch, { page: String((transferFilters.page ?? 1) - 1) })} size="icon" variant="outline"><ChevronLeft aria-hidden="true" className="rtl:rotate-180" /></Button><span className="text-sm tabular-nums">{transferFilters.page ?? 1} / {historyQuery.data.meta.last_page}</span><Button disabled={(transferFilters.page ?? 1) >= historyQuery.data.meta.last_page} onClick={() => updateSearch(search, setSearch, { page: String((transferFilters.page ?? 1) + 1) })} size="icon" variant="outline"><ChevronRight aria-hidden="true" className="rtl:rotate-180" /></Button></nav>}
    </section>}
    {transferDetailQuery.isPending && transferId && <p aria-live="polite" className="sr-only" role="status">{t('dashboard.loading')}</p>}
    <TransferDetailSheet onClose={() => navigate(`/dashboard/transfers${search.size ? `?${search.toString()}` : ''}`)} transfer={transferDetailQuery.data ?? null} />
  </div>
}