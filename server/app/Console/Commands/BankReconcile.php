<?php

namespace App\Console\Commands;

use App\Enums\TransactionDirection;
use App\Models\Account;
use Illuminate\Console\Command;

class BankReconcile extends Command
{
    protected $signature = 'bank:reconcile';

    protected $description = 'Check account balances against their immutable transaction ledgers';

    public function handle(): int
    {
        $accounts = Account::query()
            ->with(['transactions' => static function ($query): void {
                $query->orderBy('posted_at')->orderBy('id');
            }])
            ->orderBy('id')
            ->get();

        $mismatchCount = 0;

        foreach ($accounts as $account) {
            $ledgerBalance = 0;

            foreach ($account->transactions as $transaction) {
                $amount = (int) $transaction->amount_cents;
                $ledgerBalance += $transaction->direction === TransactionDirection::Credit ? $amount : -$amount;
            }

            $lastTransaction = $account->transactions->last();
            $lastBalance = $lastTransaction === null ? 0 : (int) $lastTransaction->balance_after_cents;
            $accountBalance = (int) $account->balance_cents;

            if ($accountBalance !== $ledgerBalance || $lastBalance !== $accountBalance) {
                $mismatchCount++;
                $this->error(sprintf(
                    'Account %d mismatch: balance_cents=%d ledger_net=%d last_ledger_balance=%d',
                    $account->id,
                    $accountBalance,
                    $ledgerBalance,
                    $lastBalance,
                ));
            }
        }

        if ($mismatchCount > 0) {
            $this->error("Reconciliation found {$mismatchCount} mismatched account(s).");

            return self::FAILURE;
        }

        $this->info('Bank reconciliation passed for '.$accounts->count().' account(s).');

        return self::SUCCESS;
    }
}
