import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Check, CreditCard, Plus, RefreshCw, ShieldAlert, ShieldCheck, ShoppingBag, Snowflake, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Ltr } from '@/components/ui/Ltr'
import { Money } from '@/lib/Money'
import { ApiError } from '@/lib/api'
import { apiErrorMessage } from '@/lib/api-errors'
import { formatMoneyFromCents } from '@/lib/format'
import { useAuth } from '@/features/auth/auth-provider'
import { getMoneyAccounts } from './money-api'
import { getAccountTransactions } from './api'
import { dollarsToCents, getCards, isValidCardLimit, issueCard, setCardState, testCardPurchase, updateCard } from './cards-api'
import type { BankCard } from './cards-api'
import { CardVisual } from '@/components/ui/CardVisual'

type Dialog = 'issue' | 'edit' | 'cancel' | 'purchase' | null

function expiry(card: BankCard): string {
  return `${String(card.expiry_month).padStart(2, '0')}/${String(card.expiry_year).slice(-2)}`
}

function InlineDialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  const { t } = useTranslation('common')
  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-foreground/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section aria-label={title} aria-modal="true" className="my-auto w-full max-w-lg border border-border bg-background p-5 shadow-xl sm:p-7" role="dialog">
      <div className="mb-5 flex items-start justify-between gap-4"><h2 className="text-lg font-bold">{title}</h2><Button aria-label={t('dashboard.cards.close')} onClick={onClose} size="icon" variant="ghost"><X aria-hidden="true"/></Button></div>
      {children}
    </section>
  </div>
}

export function CardsPage() {
  const { t } = useTranslation('common')
  const { user } = useAuth()
  const client = useQueryClient()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [nickname, setNickname] = useState('')
  const [limitText, setLimitText] = useState('')
  const [issueAccount, setIssueAccount] = useState('')
  const [merchant, setMerchant] = useState('')
  const [amount, setAmount] = useState('')
  const [confirmWord, setConfirmWord] = useState('')
  const [purchaseResult, setPurchaseResult] = useState<{ status: 'approved' | 'declined'; balance?: number; reason?: string } | null>(null)
  const keyRef = useRef<string | null>(null)
  const inFlight = useRef(false)
  const cardsQuery = useQuery({ queryKey: ['dashboard', 'cards'], queryFn: () => getCards(true), staleTime: 15_000 })
  const accountsQuery = useQuery({ queryKey: ['dashboard', 'accounts'], queryFn: getMoneyAccounts })
  const cards = cardsQuery.data ?? []
  const card = cards.find((item) => item.id === selectedId) ?? cards[0]
  const accounts = (accountsQuery.data ?? []).filter((item) => item.status === 'active')
  const account = accounts.find((item) => item.id === card?.account_id)
  const maxLimit = 500000
  const purchasesQuery = useQuery({
    queryKey: ['dashboard', 'transactions', card?.account_id, 'card', card?.id],
    queryFn: () => getAccountTransactions(card!.account_id, { card_id: card!.id, per_page: 5 }),
    enabled: Boolean(card),
  })
  const activityHref = card ? `/dashboard/accounts/${card.account_id}/transactions?card_id=${card.id}` : '/dashboard/transactions'

  async function refreshCardData() {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['dashboard', 'cards'] }),
      client.invalidateQueries({ queryKey: ['dashboard', 'accounts'] }),
      client.invalidateQueries({ queryKey: ['dashboard', 'summary'] }),
      client.invalidateQueries({ queryKey: ['dashboard', 'transactions'] }),
      client.invalidateQueries({ queryKey: ['dashboard', 'notifications'] }),
    ])
  }

  const stateMutation = useMutation({
    mutationFn: (action: 'freeze' | 'unfreeze' | 'cancel') => setCardState(card!.id, action),
    onSuccess: (updatedCard, action) => {
      client.setQueryData<BankCard[]>(['dashboard', 'cards'], (current) => current?.map((item) => item.id === updatedCard.id ? updatedCard : item))
      toast.success(t(`dashboard.cards.${action}Success`))
      setDialog(null); setConfirmWord('')
      void refreshCardData()
    },
    onError: (error) => toast.error(apiErrorMessage(error, t)),
  })
  const editMutation = useMutation({
    mutationFn: () => {
      const cents = dollarsToCents(limitText)
      if (cents === null || !isValidCardLimit(cents, maxLimit)) throw new Error(t('dashboard.cards.limitInvalid'))
      return updateCard(card!.id, { nickname: nickname.trim() || null, daily_limit_cents: cents })
    },
    onSuccess: async () => { setDialog(null); await refreshCardData() },
    onError: (error) => toast.error(error instanceof Error ? error.message : apiErrorMessage(error, t)),
  })
  const issueMutation = useMutation({
    mutationFn: () => issueCard(Number(issueAccount), nickname.trim() || undefined),
    onSuccess: async (created) => { setSelectedId(created.id); setDialog(null); setNickname(''); await refreshCardData() },
    onError: (error) => toast.error(error instanceof ApiError && error.code === 'validation_failed' ? t('dashboard.cards.maximumReached') : apiErrorMessage(error, t)),
  })
  const purchaseMutation = useMutation({
    mutationFn: async () => {
      if (!card || inFlight.current) throw new Error('Purchase already in progress')
      const cents = dollarsToCents(amount)
      if (!merchant.trim() || cents === null || cents < 1 || cents > 1000000) throw new Error(t('dashboard.cards.purchaseInvalid'))
      inFlight.current = true
      keyRef.current ??= crypto.randomUUID()
      return testCardPurchase(card.id, { merchant: merchant.trim(), amount_cents: cents }, keyRef.current)
    },
    onSuccess: (result) => {
      keyRef.current = null; setPurchaseResult({ status: 'approved', balance: result.balance_after_cents })
      void refreshCardData()
    },
    onError: async (error) => {
      if (error instanceof ApiError && error.status === 422 && error.code !== 'validation_failed') {
        keyRef.current = null
        setPurchaseResult({ status: 'declined', reason: t(`apiErrors.${error.code ?? 'server_error'}`) })
      } else {
        toast.error(t('dashboard.cards.purchaseRetry'))
      }
    },
    onSettled: () => { inFlight.current = false },
  })

  if (cardsQuery.isPending) return <div aria-busy="true" className="animate-pulse space-y-6"><div className="h-72 max-w-lg bg-muted"/><div className="h-40 bg-muted"/></div>
  if (cardsQuery.isError) return <div className="flex items-center gap-3 py-12" role="alert"><p>{apiErrorMessage(cardsQuery.error, t)}</p><Button onClick={() => void cardsQuery.refetch()} variant="outline"><RefreshCw aria-hidden="true"/>{t('dashboard.retry')}</Button></div>

  return <div className="space-y-8">
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5"><div><p className="text-sm font-semibold text-primary">{t('dashboard.cards.eyebrow')}</p><h2 className="mt-1 text-2xl font-extrabold">{t('dashboard.cards.title')}</h2></div><Button onClick={() => { setNickname(''); setIssueAccount(String(accounts[0]?.id ?? '')); setDialog('issue') }}><Plus aria-hidden="true"/>{t('dashboard.cards.request')}</Button></div>
    {cards.length === 0 ? <section className="grid min-h-72 place-content-center justify-items-center gap-4 text-center"><CreditCard aria-hidden="true" className="size-10 text-muted-foreground"/><h3 className="text-lg font-bold">{t('dashboard.cards.empty')}</h3><Button onClick={() => setDialog('issue')}><Plus aria-hidden="true"/>{t('dashboard.cards.request')}</Button></section> : <>
      <div aria-label={t('dashboard.cards.switcher')} className="flex snap-x gap-4 overflow-x-auto pb-2 xl:grid xl:grid-cols-3" role="tablist">
        {cards.map((item) => <button aria-selected={card?.id === item.id} className="min-w-[220px] snap-start border-b-2 border-border px-1 pb-3 text-start aria-selected:border-primary" key={item.id} onClick={() => setSelectedId(item.id)} role="tab" type="button"><CardVisual expiry={expiry(item)} holderName={user ? `${user.first_name} ${user.last_name}` : ''} last4={item.last4} nickname={item.nickname} size="sm" status={item.status}/><span className="mt-2 block truncate text-sm font-semibold">{item.nickname || t(`dashboard.${item.account_type}`)} · <Ltr>•••• {item.last4}</Ltr></span></button>)}
      </div>
      {card && <section className="grid gap-8 border-y border-border py-7 lg:grid-cols-[minmax(17rem,0.9fr)_minmax(0,1.1fr)] lg:gap-12">
        <div><CardVisual expiry={expiry(card)} holderName={user ? `${user.first_name} ${user.last_name}` : ''} last4={card.last4} nickname={card.nickname} size="lg" status={card.status}/><p className="mt-3 text-center text-sm font-semibold">{card.nickname || t(`dashboard.${card.account_type}`)}</p></div>
        <div className="min-w-0 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4"><div><p className="text-xs text-muted-foreground">{t('dashboard.cards.linkedAccount')}</p><p className="mt-1 font-semibold">{account?.nickname || t(`dashboard.${card.account_type}`)}</p></div><span className="inline-flex items-center gap-2 text-sm font-semibold">{card.status === 'active' ? <ShieldCheck aria-hidden="true" className="size-4"/> : <ShieldAlert aria-hidden="true" className="size-4"/>}{t(`dashboard.cards.status.${card.status}`)}</span></div>
          <div><div className="flex flex-wrap justify-between gap-2 text-sm"><span className="font-semibold">{t('dashboard.cards.spentToday')}</span><span className="tabular-nums"><Money cents={card.spent_today_cents}>{formatMoneyFromCents(card.spent_today_cents)}</Money> {t('dashboard.cards.of')} <Money cents={card.daily_limit_cents}>{formatMoneyFromCents(card.daily_limit_cents)}</Money></span></div><div aria-label={t('dashboard.cards.spendingProgress')} aria-valuemax={card.daily_limit_cents} aria-valuenow={card.spent_today_cents} className="mt-2 h-2 overflow-hidden bg-muted" role="progressbar"><span className="block h-full bg-primary" style={{ width: `${Math.min(100, card.daily_limit_cents ? card.spent_today_cents / card.daily_limit_cents * 100 : 0)}%` }}/></div></div>
          <div className="flex flex-wrap items-center gap-4 border-b border-border pb-5"><label className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold"><input aria-label={card.status === 'frozen' ? t('dashboard.cards.unfreeze') : t('dashboard.cards.freeze')} checked={card.status === 'frozen'} className="size-4 accent-primary" disabled={stateMutation.isPending || card.status === 'cancelled'} onChange={(event) => stateMutation.mutate(event.target.checked ? 'freeze' : 'unfreeze')} role="switch" type="checkbox"/><span>{card.status === 'frozen' ? <Snowflake aria-hidden="true" className="inline size-4"/> : <ShieldCheck aria-hidden="true" className="inline size-4"/>}{' '}{card.status === 'frozen' ? t('dashboard.cards.unfreeze') : t('dashboard.cards.freeze')}</span></label><Button onClick={() => { setNickname(card.nickname ?? ''); setLimitText((card.daily_limit_cents / 100).toFixed(2)); setDialog('edit') }} variant="outline">{t('dashboard.cards.edit')}</Button><Button onClick={() => { setMerchant(''); setAmount(''); setPurchaseResult(null); setDialog('purchase') }} variant="outline"><ShoppingBag aria-hidden="true"/>{t('dashboard.cards.testPurchase')}</Button><Button disabled={card.status === 'cancelled'} onClick={() => { setConfirmWord(''); setDialog('cancel') }} variant="destructive">{t('dashboard.cards.cancel')}</Button></div>
          <section aria-labelledby="card-activity-title"><div className="flex items-center justify-between gap-3"><h3 className="font-bold" id="card-activity-title">{t('dashboard.cards.recentActivity')}</h3><Link className="text-sm font-semibold text-primary underline" to={activityHref}>{t('dashboard.viewAll')}</Link></div>{purchasesQuery.isPending ? <p className="py-4 text-sm text-muted-foreground">{t('dashboard.loading')}</p> : purchasesQuery.isError ? <Button className="mt-3" onClick={() => void purchasesQuery.refetch()} variant="outline"><RefreshCw aria-hidden="true"/>{t('dashboard.retry')}</Button> : purchasesQuery.data?.transactions.length ? <ul className="mt-2 divide-y divide-border">{purchasesQuery.data.transactions.map((transaction) => <li className="flex justify-between gap-3 py-3 text-sm" key={transaction.id}><span className="min-w-0 truncate">{transaction.counterparty_name || transaction.description}</span><Money cents={transaction.amount_cents}><span className="whitespace-nowrap font-semibold tabular-nums">−{formatMoneyFromCents(transaction.amount_cents)}</span></Money></li>)}</ul> : <p className="py-4 text-sm text-muted-foreground">{t('dashboard.cards.noActivity')}</p>}</section>
        </div>
      </section>}
    </>}

    {dialog === 'issue' && <InlineDialog onClose={() => setDialog(null)} title={t('dashboard.cards.requestTitle')}><form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); issueMutation.mutate() }}><p className="text-sm text-muted-foreground">{cards.filter((item) => item.status !== 'cancelled').length >= 3 ? t('dashboard.cards.maximumReached') : t('dashboard.cards.requestDescription')}</p><div className="grid gap-1.5"><Label htmlFor="card-account">{t('dashboard.cards.chooseAccount')}</Label><select className="h-10 border border-input bg-background px-3 text-sm" id="card-account" onChange={(event) => setIssueAccount(event.target.value)} value={issueAccount}>{accounts.map((item) => <option key={item.id} value={item.id}>{item.nickname || t(`dashboard.${item.type}`)}</option>)}</select></div><div className="grid gap-1.5"><Label htmlFor="card-nickname">{t('dashboard.cards.nickname')}</Label><Input id="card-nickname" maxLength={30} onChange={(event) => setNickname(event.target.value)} value={nickname}/></div><Button disabled={issueMutation.isPending || cards.filter((item) => item.status !== 'cancelled').length >= 3 || !issueAccount} type="submit">{issueMutation.isPending ? t('dashboard.loading') : t('dashboard.cards.request')}</Button></form></InlineDialog>}
    {dialog === 'edit' && card && <InlineDialog onClose={() => setDialog(null)} title={t('dashboard.cards.editTitle')}><form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); editMutation.mutate() }}><div className="grid gap-1.5"><Label htmlFor="edit-nickname">{t('dashboard.cards.nickname')}</Label><Input id="edit-nickname" maxLength={30} onChange={(event) => setNickname(event.target.value)} value={nickname}/></div><div className="grid gap-1.5"><Label htmlFor="edit-limit">{t('dashboard.cards.dailyLimit')}</Label><Input id="edit-limit" inputMode="decimal" onChange={(event) => setLimitText(event.target.value)} value={limitText}/><input aria-label={t('dashboard.cards.dailyLimit')} className="w-full accent-primary" max={maxLimit} min={0} onChange={(event) => setLimitText((Number(event.target.value) / 100).toFixed(2))} step={100} type="range" value={dollarsToCents(limitText) ?? 0}/><p className="text-xs text-muted-foreground">{t('dashboard.cards.limitMax', { amount: formatMoneyFromCents(maxLimit) })}</p></div><Button disabled={editMutation.isPending} type="submit">{t('dashboard.cards.save')}</Button></form></InlineDialog>}
    {dialog === 'cancel' && card && <InlineDialog onClose={() => setDialog(null)} title={t('dashboard.cards.cancelTitle')}><div className="grid gap-4"><p className="text-sm text-muted-foreground">{t('dashboard.cards.cancelWarning')}</p><div className="grid gap-1.5"><Label htmlFor="cancel-word">{t('dashboard.cards.typeToConfirm')}</Label><Input autoComplete="off" id="cancel-word" onChange={(event) => setConfirmWord(event.target.value)} value={confirmWord}/></div><Button disabled={confirmWord.trim().toLowerCase() !== t('dashboard.cards.confirmWord').toLowerCase() || stateMutation.isPending} onClick={() => stateMutation.mutate('cancel')} variant="destructive">{t('dashboard.cards.cancel')}</Button></div></InlineDialog>}
    {dialog === 'purchase' && card && <InlineDialog onClose={() => setDialog(null)} title={t('dashboard.cards.purchaseTitle')}><div className="grid gap-4"><p className="text-sm text-muted-foreground">{t('dashboard.cards.purchaseDemoNote')}</p><div className="grid gap-1.5"><Label htmlFor="merchant">{t('dashboard.cards.merchant')}</Label><Input id="merchant" maxLength={60} minLength={2} onChange={(event) => setMerchant(event.target.value)} value={merchant}/></div><div className="grid gap-1.5"><Label htmlFor="purchase-amount">{t('dashboard.cards.amountLabel')}</Label><Input id="purchase-amount" inputMode="decimal" onChange={(event) => setAmount(event.target.value)} value={amount}/></div>{purchaseResult && <div aria-live="polite" className="border-s-2 border-primary bg-muted p-3" role="status">{purchaseResult.status === 'approved' ? <p className="flex items-center gap-2 font-semibold"><Check aria-hidden="true"/>{t('dashboard.cards.approved')} <Money cents={purchaseResult.balance ?? 0}>{formatMoneyFromCents(purchaseResult.balance ?? 0)}</Money></p> : <p className="flex items-center gap-2 font-semibold"><ShieldAlert aria-hidden="true"/>{t('dashboard.cards.declined')}: {purchaseResult.reason}</p>}</div>}<Button disabled={purchaseMutation.isPending || !merchant.trim() || dollarsToCents(amount) === null} onClick={() => purchaseMutation.mutate()}><ShoppingBag aria-hidden="true"/>{purchaseMutation.isPending ? t('dashboard.cards.processing') : t('dashboard.cards.submitPurchase')}</Button></div></InlineDialog>}
  </div>
}