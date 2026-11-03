<?php

namespace App\Services;

use App\Enums\AccountStatus;
use App\Enums\TransactionDirection;
use App\Models\Account;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class DashboardReadService
{
    public function accounts(User $user): Collection
    {
        return $user->accounts()
            ->select(['id', 'user_id', 'type', 'nickname', 'currency', 'balance_cents', 'status', 'account_number', 'opened_at'])
            ->orderByRaw('CASE WHEN status = ? THEN 1 ELSE 0 END', [AccountStatus::Closed->value])
            ->orderBy('id')
            ->get();
    }

    public function account(User $user, int $accountId): Account
    {
        return $user->accounts()
            ->select(['id', 'user_id', 'type', 'nickname', 'currency', 'balance_cents', 'status', 'account_number', 'opened_at'])
            ->whereKey($accountId)
            ->firstOrFail();
    }

    public function summary(User $user): array
    {
        $now = CarbonImmutable::now('UTC');
        $monthStart = $now->startOfMonth();
        $nextMonthStart = $monthStart->addMonth();
        $totalBalanceCents = Account::query()
            ->where('user_id', $user->getKey())
            ->whereIn('status', [AccountStatus::Active->value, AccountStatus::Frozen->value])
            ->sum('balance_cents');

        $monthlyGroups = $this->summaryTransactions($user)
            ->where('transactions.posted_at', '>=', $monthStart)
            ->where('transactions.posted_at', '<', $nextMonthStart)
            ->select(['transactions.direction', 'transactions.category'])
            ->selectRaw('SUM(transactions.amount_cents) as total_cents')
            ->groupBy('transactions.direction', 'transactions.category')
            ->get();

        $incomeCents = 0;
        $spendingCents = 0;
        $spendingByCategory = [];
        foreach ($monthlyGroups as $group) {
            $amount = (int) $group->total_cents;
            if ($group->direction === TransactionDirection::Credit->value) {
                $incomeCents += $amount;
            } else {
                $spendingCents += $amount;
                $spendingByCategory[$group->category] = $amount;
            }
        }
        arsort($spendingByCategory, SORT_NUMERIC);
        $spendingByCategory = array_map(
            static fn (string $category, int $amount): array => [
                'category' => $category,
                'spending_cents' => $amount,
            ],
            array_keys($spendingByCategory),
            array_values($spendingByCategory),
        );

        $seriesStart = $monthStart->subMonths(5);
        $monthExpression = DB::connection()->getDriverName() === 'sqlite'
            ? "strftime('%Y-%m', transactions.posted_at)"
            : "DATE_FORMAT(transactions.posted_at, '%Y-%m')";
        $seriesRows = $this->summaryTransactions($user)
            ->where('transactions.posted_at', '>=', $seriesStart)
            ->where('transactions.posted_at', '<', $nextMonthStart)
            ->selectRaw($monthExpression.' as month')
            ->selectRaw('SUM(CASE WHEN transactions.direction = ? THEN transactions.amount_cents ELSE 0 END) as income_cents', [TransactionDirection::Credit->value])
            ->selectRaw('SUM(CASE WHEN transactions.direction = ? THEN transactions.amount_cents ELSE 0 END) as spending_cents', [TransactionDirection::Debit->value])
            ->groupByRaw($monthExpression)
            ->orderBy('month')
            ->get()
            ->keyBy('month');

        $series = [];
        for ($offset = 0; $offset < 6; $offset++) {
            $month = $seriesStart->addMonths($offset)->format('Y-m');
            $row = $seriesRows->get($month);
            $series[] = [
                'month' => $month,
                'income_cents' => (int) ($row->income_cents ?? 0),
                'spending_cents' => (int) ($row->spending_cents ?? 0),
            ];
        }

        $recent = DB::table('transactions')
            ->join('accounts as recent_accounts', 'recent_accounts.id', '=', 'transactions.account_id')
            ->where('recent_accounts.user_id', $user->getKey())
            ->select([
                'transactions.id', 'transactions.reference', 'transactions.direction',
                'transactions.category', 'transactions.amount_cents', 'transactions.balance_after_cents',
                'recent_accounts.currency as currency', 'transactions.description',
                'transactions.counterparty_name', 'transactions.posted_at',
            ])
            ->orderByDesc('transactions.posted_at')
            ->orderByDesc('transactions.id')
            ->limit(5)
            ->get();

        return [
            'currency' => 'USD',
            'total_balance_cents' => (int) $totalBalanceCents,
            'accounts' => $this->accounts($user),
            'month' => [
                'income_cents' => $incomeCents,
                'spending_cents' => $spendingCents,
                'net_cents' => $incomeCents - $spendingCents,
            ],
            'series' => $series,
            'spending_by_category' => $spendingByCategory,
            'recent' => $recent,
        ];
    }

    private function summaryTransactions(User $user): Builder
    {
        return DB::table('transactions')
            ->join('accounts as summary_accounts', 'summary_accounts.id', '=', 'transactions.account_id')
            ->where('summary_accounts.user_id', $user->getKey())
            ->whereNotExists(static function (Builder $query) use ($user): void {
                $query->selectRaw('1')
                    ->from('transfers')
                    ->join('accounts as transfer_from_accounts', 'transfer_from_accounts.id', '=', 'transfers.from_account_id')
                    ->join('accounts as transfer_to_accounts', 'transfer_to_accounts.id', '=', 'transfers.to_account_id')
                    ->whereColumn('transfers.id', 'transactions.transfer_id')
                    ->where('transfer_from_accounts.user_id', $user->getKey())
                    ->where('transfer_to_accounts.user_id', $user->getKey());
            });
    }
}
