<?php

namespace App\Services;

use App\Models\Account;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Query\Builder;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

class TransactionReadService
{
    public function paginate(User $user, Account $account, array $filters): LengthAwarePaginator
    {
        $page = (int) ($filters['page'] ?? 1);
        $perPage = (int) ($filters['per_page'] ?? 15);
        $sort = $filters['sort'] ?? 'posted_at';
        $order = $filters['order'] ?? 'desc';

        return $this->filteredQuery($user, $account, $filters)
            ->select($this->transactionColumns())
            ->orderBy('transactions.'.$sort, $order)
            ->orderBy('transactions.id', $order)
            ->paginate($perPage, ['*'], 'page', $page);
    }

    public function findByReference(User $user, Account $account, string $reference): object
    {
        return $this->baseQuery($user, $account)
            ->where('transactions.reference', $reference)
            ->select($this->transactionColumns())
            ->firstOrFail();
    }

    public function filteredQuery(User $user, Account $account, array $filters): Builder
    {
        $query = $this->baseQuery($user, $account);

        if (isset($filters['q']) && $filters['q'] !== '') {
            $term = self::escapeLike((string) $filters['q']);
            $query->where(static function (Builder $search) use ($term): void {
                $search->whereRaw("transactions.description LIKE ? ESCAPE '!'", ['%'.$term.'%'])
                    ->orWhereRaw("transactions.counterparty_name LIKE ? ESCAPE '!'", ['%'.$term.'%']);
            });
        }

        if (isset($filters['direction'])) {
            $query->where('transactions.direction', $filters['direction']);
        }
        if (isset($filters['category'])) {
            $query->whereIn('transactions.category', $filters['category']);
        }
        if (isset($filters['date_from'])) {
            $dateFrom = CarbonImmutable::createFromFormat('!Y-m-d', $filters['date_from'], 'UTC');
            $query->where('transactions.posted_at', '>=', $dateFrom->startOfDay());
        }
        if (isset($filters['date_to'])) {
            $dateTo = CarbonImmutable::createFromFormat('!Y-m-d', $filters['date_to'], 'UTC');
            $query->where('transactions.posted_at', '<', $dateTo->addDay()->startOfDay());
        }
        if (isset($filters['min_amount_cents'])) {
            $query->where('transactions.amount_cents', '>=', (int) $filters['min_amount_cents']);
        }
        if (isset($filters['max_amount_cents'])) {
            $query->where('transactions.amount_cents', '<=', (int) $filters['max_amount_cents']);
        }

        return $query;
    }

    public function exportQuery(User $user, Account $account, array $filters): Builder
    {
        return $this->filteredQuery($user, $account, $filters);
    }

    private function baseQuery(User $user, Account $account): Builder
    {
        return DB::table('transactions')
            ->join('accounts as transaction_accounts', 'transaction_accounts.id', '=', 'transactions.account_id')
            ->where('transactions.account_id', $account->getKey())
            ->where('transaction_accounts.user_id', $user->getKey());
    }

    private function transactionColumns(): array
    {
        return [
            'transactions.id',
            'transactions.reference',
            'transactions.direction',
            'transactions.category',
            'transactions.amount_cents',
            'transactions.balance_after_cents',
            'transaction_accounts.currency as currency',
            'transactions.description',
            'transactions.counterparty_name',
            'transactions.posted_at',
        ];
    }

    private static function escapeLike(string $value): string
    {
        return str_replace(['!', '\\', '%', '_'], ['!!', '!\\', '!%', '!_'], $value);
    }
}
