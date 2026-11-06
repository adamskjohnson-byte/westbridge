<?php

namespace App\Services;

use App\Enums\TransactionDirection;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class InsightsService
{
    public function forMonth(User $user, ?string $month): array
    {
        $now = CarbonImmutable::now('UTC');
        $month ??= $now->format('Y-m');
        $parsed = CarbonImmutable::createFromFormat('!Y-m', $month, 'UTC');
        if ($parsed === false || $parsed->format('Y-m') !== $month || $parsed->startOfMonth()->lt($now->subMonths(24)->startOfMonth()) || $parsed->startOfMonth()->gt($now->startOfMonth())) {
            throw ValidationException::withMessages(['month' => ['validation.month_invalid']]);
        }
        $start = $parsed->startOfMonth();
        $end = $start->addMonth();
        $previousStart = $start->subMonth();
        $base = $this->transactions($user);
        $totals = (clone $base)->where('transactions.posted_at', '>=', $previousStart)->where('transactions.posted_at', '<', $end)
            ->selectRaw('SUM(CASE WHEN transactions.posted_at >= ? AND transactions.direction = ? THEN transactions.amount_cents ELSE 0 END) as income_cents', [$start, TransactionDirection::Credit->value])
            ->selectRaw('SUM(CASE WHEN transactions.posted_at >= ? AND transactions.direction = ? THEN transactions.amount_cents ELSE 0 END) as spending_cents', [$start, TransactionDirection::Debit->value])
            ->selectRaw('SUM(CASE WHEN transactions.posted_at < ? AND transactions.direction = ? THEN transactions.amount_cents ELSE 0 END) as previous_income_cents', [$start, TransactionDirection::Credit->value])
            ->selectRaw('SUM(CASE WHEN transactions.posted_at < ? AND transactions.direction = ? THEN transactions.amount_cents ELSE 0 END) as previous_spending_cents', [$start, TransactionDirection::Debit->value])
            ->first();
        $categories = (clone $base)->where('transactions.direction', TransactionDirection::Debit->value)
            ->where('transactions.posted_at', '>=', $previousStart)->where('transactions.posted_at', '<', $end)
            ->select('transactions.category')->selectRaw('SUM(CASE WHEN transactions.posted_at >= ? THEN transactions.amount_cents ELSE 0 END) as spending_cents', [$start])
            ->selectRaw('SUM(CASE WHEN transactions.posted_at < ? THEN transactions.amount_cents ELSE 0 END) as previous_spending_cents', [$start])
            ->groupBy('transactions.category')->orderByDesc('spending_cents')->get();
        $top = (clone $base)->where('transactions.direction', TransactionDirection::Debit->value)
            ->where('transactions.posted_at', '>=', $start)->where('transactions.posted_at', '<', $end)
            ->whereNotNull('transactions.counterparty_name')->select('transactions.counterparty_name as name')
            ->selectRaw('SUM(transactions.amount_cents) as spending_cents')->selectRaw('COUNT(*) as count')
            ->groupBy('transactions.counterparty_name')->orderByDesc('spending_cents')->limit(5)->get();
        $largest = (clone $base)->where('transactions.direction', TransactionDirection::Debit->value)
            ->where('transactions.posted_at', '>=', $start)->where('transactions.posted_at', '<', $end)
            ->select(['transactions.reference', 'transactions.description', 'transactions.counterparty_name', 'transactions.amount_cents', 'transactions.posted_at'])
            ->orderByDesc('transactions.amount_cents')->limit(3)->get();
        $dailyExpression = DB::connection()->getDriverName() === 'sqlite' ? "strftime('%Y-%m-%d', transactions.posted_at)" : 'DATE(transactions.posted_at)';
        $dailyRows = (clone $base)->where('transactions.direction', TransactionDirection::Debit->value)
            ->where('transactions.posted_at', '>=', $start)->where('transactions.posted_at', '<', $end)
            ->selectRaw($dailyExpression.' as date')->selectRaw('SUM(transactions.amount_cents) as spending_cents')->groupByRaw($dailyExpression)->get()->keyBy('date');
        $daily = [];
        $days = $start->daysInMonth;
        for ($day = 0; $day < $days; $day++) {
            $date = $start->addDays($day)->format('Y-m-d');
            $daily[] = ['date' => $date, 'spending_cents' => (int) ($dailyRows->get($date)->spending_cents ?? 0)];
        }
        $income = (int) ($totals->income_cents ?? 0);
        $spending = (int) ($totals->spending_cents ?? 0);

        return [
            'currency' => config('bank.default_currency', 'USD'), 'month' => $month, 'previous_month' => $previousStart->format('Y-m'),
            'income_cents' => $income, 'spending_cents' => $spending, 'net_cents' => $income - $spending,
            'savings_rate' => $income === 0 ? null : round((($income - $spending) / $income), 4),
            'previous' => ['income_cents' => (int) ($totals->previous_income_cents ?? 0), 'spending_cents' => (int) ($totals->previous_spending_cents ?? 0)],
            'by_category' => $categories->map(fn ($row) => ['category' => $row->category, 'spending_cents' => (int) $row->spending_cents, 'previous_spending_cents' => (int) $row->previous_spending_cents])->all(),
            'top_counterparties' => $top->map(fn ($row) => ['name' => $row->name, 'spending_cents' => (int) $row->spending_cents, 'count' => (int) $row->count])->all(),
            'largest_transactions' => $largest->map(fn ($row) => ['reference' => $row->reference, 'description' => $row->description, 'counterparty_name' => $row->counterparty_name, 'amount_cents' => (int) $row->amount_cents, 'posted_at' => CarbonImmutable::parse($row->posted_at, 'UTC')->toISOString()])->all(),
            'daily_spending' => $daily, 'average_daily_spending_cents' => $days === 0 ? 0 : (int) round($spending / $days),
        ];
    }

    private function transactions(User $user): Builder
    {
        return DB::table('transactions')->join('accounts as insight_accounts', 'insight_accounts.id', '=', 'transactions.account_id')
            ->where('insight_accounts.user_id', $user->getKey())
            ->whereNotExists(static function (Builder $query) use ($user): void {
                $query->selectRaw('1')->from('transfers')
                    ->join('accounts as own_from', 'own_from.id', '=', 'transfers.from_account_id')
                    ->join('accounts as own_to', 'own_to.id', '=', 'transfers.to_account_id')
                    ->whereColumn('transfers.id', 'transactions.transfer_id')
                    ->where('own_from.user_id', $user->getKey())->where('own_to.user_id', $user->getKey());
            });
    }
}