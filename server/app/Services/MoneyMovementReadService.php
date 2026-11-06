<?php

namespace App\Services;

use App\Enums\TransferStatus;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Query\Builder;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

class MoneyMovementReadService
{
    public function usedToday(User $user, ?CarbonImmutable $now = null): int
    {
        $now ??= CarbonImmutable::now('UTC');
        $start = $now->startOfDay();
        $end = $start->addDay();
        $outgoingTransfers = DB::table('transfers')
            ->join('accounts as source_accounts', 'source_accounts.id', '=', 'transfers.from_account_id')
            ->join('accounts as destination_accounts', 'destination_accounts.id', '=', 'transfers.to_account_id')
            ->where('source_accounts.user_id', $user->getKey())
            ->where('destination_accounts.user_id', '!=', $user->getKey())
            ->where('transfers.status', TransferStatus::Completed->value)
            ->where('transfers.created_at', '>=', $start)
            ->where('transfers.created_at', '<', $end)
            ->sum('transfers.amount_cents');
        $billPayments = DB::table('bill_payments')
            ->where('user_id', $user->getKey())
            ->where('status', 'completed')
            ->where('created_at', '>=', $start)
            ->where('created_at', '<', $end)
            ->sum('amount_cents');

        return (int) $outgoingTransfers + (int) $billPayments;
    }

    public function remainingToday(User $user, ?CarbonImmutable $now = null): int
    {
        return max(0, $this->dailyLimitCents() - $this->usedToday($user, $now));
    }

    public function dailyLimitCents(): int
    {
        return (int) config('bank.daily_transfer_limit_cents', 500000);
    }

    public function transfers(User $user, array $filters): LengthAwarePaginator
    {
        $query = DB::table('transfers')
            ->join('accounts as source_accounts', 'source_accounts.id', '=', 'transfers.from_account_id')
            ->join('accounts as destination_accounts', 'destination_accounts.id', '=', 'transfers.to_account_id')
            ->where(function (Builder $builder) use ($user): void {
                $builder->where('source_accounts.user_id', $user->getKey())
                    ->orWhere('destination_accounts.user_id', $user->getKey());
            });

        if (isset($filters['account_id'])) {
            $accountId = (int) $filters['account_id'];
            $query->where(function (Builder $builder) use ($accountId): void {
                $builder->where('transfers.from_account_id', $accountId)->orWhere('transfers.to_account_id', $accountId);
            });
        }
        if (($filters['direction'] ?? null) === 'in') {
            $query->where('destination_accounts.user_id', $user->getKey())->where('source_accounts.user_id', '!=', $user->getKey());
        } elseif (($filters['direction'] ?? null) === 'out') {
            $query->where('source_accounts.user_id', $user->getKey())->where('destination_accounts.user_id', '!=', $user->getKey());
        } elseif (($filters['direction'] ?? null) === 'own') {
            $query->where('source_accounts.user_id', $user->getKey())->where('destination_accounts.user_id', $user->getKey());
        }
        if (isset($filters['date_from'])) {
            $query->where('transfers.created_at', '>=', CarbonImmutable::parse($filters['date_from'], 'UTC')->startOfDay());
        }
        if (isset($filters['date_to'])) {
            $query->where('transfers.created_at', '<', CarbonImmutable::parse($filters['date_to'], 'UTC')->addDay()->startOfDay());
        }

        $query->select('transfers.id')->orderByDesc('transfers.created_at')->orderByDesc('transfers.id');
        $ids = $query->paginate(15, ['transfers.id'], 'page', (int) ($filters['page'] ?? 1));
        $items = $ids->getCollection()->isEmpty()
            ? collect()
            : \App\Models\Transfer::query()->with(['fromAccount.user', 'toAccount.user', 'transactions'])
                ->whereIn('id', $ids->getCollection()->pluck('id'))->get()
                ->sortByDesc(fn ($transfer) => $transfer->created_at->getTimestamp())
                ->values();

        return new LengthAwarePaginator($items, $ids->total(), 15, $ids->currentPage(), [
            'path' => LengthAwarePaginator::resolveCurrentPath(),
            'query' => request()->query(),
        ]);
    }

    public function transferForParty(User $user, string $transferId): \App\Models\Transfer
    {
        return \App\Models\Transfer::query()
            ->with(['fromAccount.user', 'toAccount.user', 'transactions'])
            ->whereKey($transferId)
            ->where(function ($query) use ($user): void {
                $query->whereHas('fromAccount', fn ($accounts) => $accounts->where('user_id', $user->getKey()))
                    ->orWhereHas('toAccount', fn ($accounts) => $accounts->where('user_id', $user->getKey()));
            })
            ->firstOrFail();
    }

    public function billPayments(User $user, int $page = 1): LengthAwarePaginator
    {
        return \App\Models\BillPayment::query()
            ->with(['account', 'transaction'])
            ->where('user_id', $user->getKey())
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(15, ['*'], 'page', $page);
    }
}
