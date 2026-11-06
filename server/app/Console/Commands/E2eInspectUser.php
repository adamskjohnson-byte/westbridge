<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Support\Facades\DB;

class E2eInspectUser extends E2eCommand
{
    protected $signature = 'dev:e2e-inspect {email}';

    protected $description = 'Print isolated E2E user ledger facts as JSON for browser assertions';

    public function handle(): int
    {
        if ($this->e2eDatabaseConfig() === null) {
            return self::FAILURE;
        }

        $user = User::query()->where('email', strtolower(trim((string) $this->argument('email'))))->first();
        if ($user === null) {
            $this->error('E2E user was not found.');

            return self::FAILURE;
        }

        $accounts = $user->accounts()->orderBy('id')->get(['id', 'type', 'balance_cents', 'account_number']);
        $accountIds = $accounts->modelKeys();
        $transactions = DB::table('transactions')->whereIn('account_id', $accountIds)
            ->orderBy('id')
            ->get(['id', 'account_id', 'card_id', 'transfer_id', 'direction', 'category', 'amount_cents', 'balance_after_cents', 'reference', 'posted_at']);
        $transfers = DB::table('transfers')
            ->whereIn('from_account_id', $accountIds)
            ->orWhereIn('to_account_id', $accountIds)
            ->orderBy('id')
            ->get(['id', 'from_account_id', 'to_account_id', 'amount_cents', 'status', 'idempotency_key']);
        $billPayments = DB::table('bill_payments')->where('user_id', $user->getKey())
            ->orderBy('id')
            ->get(['id', 'account_id', 'amount_cents', 'status', 'transaction_id', 'idempotency_key']);
        $cards = DB::table('cards')->where('user_id', $user->getKey())->orderBy('id')
            ->get(['id', 'account_id', 'last4', 'status', 'daily_limit_cents']);
        $notifications = DB::table('notifications')->where('notifiable_type', $user::class)->where('notifiable_id', $user->getKey())
            ->orderBy('created_at')->get(['id', 'data', 'read_at', 'created_at']);

        $this->line(json_encode([
            'user' => ['id' => (int) $user->getKey(), 'email' => $user->email],
            'accounts' => $accounts,
            'transactions' => $transactions,
            'transfers' => $transfers,
            'bill_payments' => $billPayments,
            'cards' => $cards,
            'notifications' => $notifications,
        ], JSON_THROW_ON_ERROR));

        return self::SUCCESS;
    }
}
