import { useState } from 'react'
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query'
import { ArrowDownLeft, ArrowUpRight, Download, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Button, buttonVariants } from '@/components/ui/button'
import { CountUp } from '@/components/motion/CountUp'
import { Reveal } from '@/components/motion/Reveal'
import { Ltr } from '@/components/ui/Ltr'
import { usePageTitle } from '@/hooks/use-page-title'
import { formatCurrencyCents, formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAuth } from '@/features/auth/auth-provider'
import { apiErrorMessage } from '@/lib/api-errors'
import {
  getAccountTransactions,
  getDashboardAccounts,
  getTransactionsCsvUrl,
  type DashboardAccount,
  type DashboardTransaction,
} from './api'

function accountTypeLabel(type: DashboardAccount['type'], translate: (key: string) => string): string {
  return translate(`dashboard.${type}`)
}

function transactionCategoryLabel(category: DashboardTransaction['category'], translate: (key: string) => string): string {
  return translate(`dashboard.categories.${category}`)
}

function AccountItem({
  account,
  selected,
  onSelect,
}: {
  account: DashboardAccount
  selected: boolean
  onSelect: () => void
}) {
  const { t } = useTranslation('common')
  const nickname = account.nickname || accountTypeLabel(account.type, t)

  return (
    <button
      aria-pressed={selected}
      aria-label={t('dashboard.selectAccount', { name: nickname })}
      className={cn(
        'grid min-h-28 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-3 py-4 text-start transition-colors hover:bg-accent/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring',
        selected && 'bg-accent/40',
      )}
      onClick={onSelect}
      type="button"
    >
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold text-foreground">{nickname}</span>
          <span className="text-xs text-muted-foreground">{t(`dashboard.${account.status}`)}</span>
        </span>
        <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <span>{t('dashboard.accountNumber')}</span>
          <Ltr>{account.number_masked.replace(/^•+\s*/, '')}</Ltr>
        </span>
      </span>
      <CountUp cents={account.balance_cents} className="text-end text-sm font-bold tabular-nums text-foreground sm:text-base" />
    </button>
  )
}

function TransactionItem({ transaction }: { transaction: DashboardTransaction }) {
  const { t } = useTranslation('common')
  const isCredit = transaction.direction === 'credit'
  const DirectionIcon = isCredit ? ArrowDownLeft : ArrowUpRight
  const sign = isCredit ? '+' : '−'
  const amount = formatCurrencyCents(transaction.amount_cents)

  return (
    <li className="grid min-h-[4.5rem] grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-border py-3 last:border-b-0">
      <span className="grid size-9 place-items-center rounded-full border border-border bg-muted text-foreground">
        <DirectionIcon aria-hidden="true" className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-foreground">{transaction.counterparty_name || transaction.description}</span>
        <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
          <span>{transactionCategoryLabel(transaction.category, t)}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={transaction.posted_at}>{formatDate(transaction.posted_at, { day: 'numeric', month: 'short', year: 'numeric' })}</time>
          <span>{t(`dashboard.${transaction.direction}`)}</span>
        </span>
      </span>
      <Ltr>
        <span className="whitespace-nowrap text-end text-sm font-bold tabular-nums text-foreground">
          {sign}{amount}
        </span>
      </Ltr>
    </li>
  )
}

export function DashboardPage() {
  const { t } = useTranslation('common')
  usePageTitle(t('navbar.dashboard'), t('dashboard.description'))
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null)
  const accountsQuery = useQuery({
    queryKey: ['dashboard', 'accounts'],
    queryFn: getDashboardAccounts,
    staleTime: 30_000,
  })
  const accounts = accountsQuery.data ?? []
  const selectedAccount = accounts.find((account) => account.id === selectedAccountId) ?? accounts[0]
  const transactionsQuery = useInfiniteQuery({
    queryKey: ['dashboard', 'transactions', selectedAccount?.id],
    queryFn: ({ pageParam }) => getAccountTransactions(selectedAccount!.id, pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.meta.page < lastPage.meta.last_page ? lastPage.meta.page + 1 : undefined,
    enabled: selectedAccount !== undefined,
    staleTime: 30_000,
  })
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSettled: () => navigate('/login', { replace: true }),
  })
  const totalBalanceCents = accounts.reduce((total, account) => total + account.balance_cents, 0)
  const transactions = transactionsQuery.data?.pages.flatMap((page) => page.transactions) ?? []

  if (!user) return null

  return (
    <main className="min-h-[65vh]" id="main-content">
      <section className="layout-container py-8 sm:py-12 lg:py-14" aria-busy={accountsQuery.isPending}>
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
            <div>
              <p className="mb-1 text-xs font-bold uppercase text-primary">{t('dashboard.eyebrow')}</p>
              <h1 className="type-h1">{t('dashboard.welcome', { name: user.first_name })}</h1>
              <p className="mt-2 text-sm text-muted-foreground"><Ltr>{user.email}</Ltr></p>
            </div>
            <Button disabled={logoutMutation.isPending} onClick={() => logoutMutation.mutate()} variant="outline">
              {logoutMutation.isPending ? t('navbar.loggingOut') : t('navbar.logOut')}
            </Button>
          </div>
        </Reveal>

        {accountsQuery.isPending && (
          <p aria-live="polite" className="py-10 text-sm text-muted-foreground">{t('dashboard.loading')}</p>
        )}
        {accountsQuery.isError && (
          <div className="flex flex-wrap items-center gap-3 py-8" role="alert">
            <p className="text-sm text-destructive">{apiErrorMessage(accountsQuery.error, t) || t('dashboard.dashboardLoadError')}</p>
            <Button onClick={() => void accountsQuery.refetch()} variant="outline"><RefreshCw aria-hidden="true" />{t('dashboard.retry')}</Button>
          </div>
        )}

        {!accountsQuery.isPending && !accountsQuery.isError && (
          <>
            {accounts.length === 0 ? (
              <p className="py-10 text-sm text-muted-foreground">{t('dashboard.noAccounts')}</p>
            ) : (
              <>
                <Reveal className="grid gap-8 border-b border-border py-7 md:grid-cols-[minmax(15rem,0.8fr)_minmax(0,1.2fr)] md:gap-12 md:py-9">
                  <div className="flex flex-col justify-center">
                    <p className="text-sm font-semibold text-muted-foreground">{t('dashboard.totalBalance')}</p>
                    <CountUp cents={totalBalanceCents} className="mt-2 text-3xl font-extrabold tabular-nums text-foreground sm:text-4xl" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-foreground">{t('dashboard.accountsHeading')}</h2>
                    <div className="mt-2 divide-y divide-border border-y border-border">
                      {accounts.map((account) => (
                        <AccountItem
                          account={account}
                          key={account.id}
                          onSelect={() => setSelectedAccountId(account.id)}
                          selected={selectedAccount?.id === account.id}
                        />
                      ))}
                    </div>
                  </div>
                </Reveal>

                <Reveal className="py-7 sm:py-9">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                    <h2 className="text-base font-bold text-foreground">{t('dashboard.recentActivity')}</h2>
                    {selectedAccount && (
                      <a className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))} href={getTransactionsCsvUrl(selectedAccount.id)}>
                        <Download aria-hidden="true" />{t('dashboard.downloadCsv')}
                      </a>
                    )}
                  </div>

                  {transactionsQuery.isPending && <p aria-live="polite" className="py-6 text-sm text-muted-foreground">{t('dashboard.loading')}</p>}
                  {transactionsQuery.isError && (
                    <div className="flex flex-wrap items-center gap-3 py-6" role="alert">
                      <p className="text-sm text-destructive">{apiErrorMessage(transactionsQuery.error, t)}</p>
                      <Button onClick={() => void transactionsQuery.refetch()} variant="outline"><RefreshCw aria-hidden="true" />{t('dashboard.retry')}</Button>
                    </div>
                  )}
                  {!transactionsQuery.isPending && !transactionsQuery.isError && transactions.length === 0 && (
                    <p className="py-6 text-sm text-muted-foreground">{t('dashboard.noTransactions')}</p>
                  )}
                  {transactions.length > 0 && (
                    <ul aria-label={t('dashboard.recentActivity')} className="divide-y divide-border">
                      {transactions.map((transaction) => <TransactionItem key={transaction.id} transaction={transaction} />)}
                    </ul>
                  )}
                  {transactionsQuery.hasNextPage && (
                    <div className="pt-4">
                      <Button disabled={transactionsQuery.isFetchingNextPage} onClick={() => void transactionsQuery.fetchNextPage()} variant="outline">
                        {transactionsQuery.isFetchingNextPage ? t('dashboard.loading') : t('dashboard.loadMore')}
                      </Button>
                    </div>
                  )}
                </Reveal>
              </>
            )}
          </>
        )}
      </section>
    </main>
  )
}