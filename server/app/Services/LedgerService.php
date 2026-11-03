<?php

namespace App\Services;

use App\Enums\AccountStatus;
use App\Enums\TransactionCategory;
use App\Enums\TransactionDirection;
use App\Enums\TransferStatus;
use App\Enums\UserStatus;
use App\Exceptions\Bank\AccountClosedException;
use App\Exceptions\Bank\AccountFrozenException;
use App\Exceptions\Bank\AccountNotFoundException;
use App\Exceptions\Bank\AccountOwnershipException;
use App\Exceptions\Bank\CurrencyMismatchException;
use App\Exceptions\Bank\DailyLimitExceededException;
use App\Exceptions\Bank\InactiveUserException;
use App\Exceptions\Bank\InsufficientFundsException;
use App\Exceptions\Bank\InvalidTransferException;
use App\Exceptions\Bank\UserNotFoundException;
use App\Models\Account;
use App\Models\AuditLog;
use App\Models\Transaction;
use App\Models\Transfer;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class LedgerService
{
    public function deposit(Account $to, int $cents, string $description): Transaction
    {
        return DB::transaction(function () use ($to, $cents, $description): Transaction {
            if ($cents <= 0) {
                throw new InvalidTransferException('Deposit amount must be greater than zero.', 'invalid_amount');
            }

            // Lock and reload the destination so concurrent deposits cannot write the same stale balance-after value.
            $account = Account::query()->whereKey($to->getKey())->lockForUpdate()->first();
            if ($account === null) {
                throw new AccountNotFoundException;
            }

            $newBalance = (int) $account->balance_cents + $cents;
            $account->balance_cents = $newBalance;
            $account->save();

            $postedAt = Carbon::now();
            $transaction = Transaction::create([
                'account_id' => $account->getKey(),
                'direction' => TransactionDirection::Credit,
                'amount_cents' => $cents,
                'balance_after_cents' => $newBalance,
                'category' => TransactionCategory::Deposit,
                'description' => $description,
                'counterparty_name' => 'Westbridge Welcome Bonus',
                'reference' => (string) Str::ulid(),
                'posted_at' => $postedAt,
                'created_at' => $postedAt,
            ]);

            AuditLog::create([
                'user_id' => $account->user_id,
                'action' => 'deposit.posted',
                'entity_type' => 'transaction',
                'entity_id' => (string) $transaction->getKey(),
                'metadata' => [
                    'account_id' => $account->getKey(),
                    'amount_cents' => $cents,
                    'currency' => $account->currency,
                ],
                'created_at' => $postedAt,
            ]);

            return $transaction;
        }, 3);
    }

    public function transfer(
        User $initiator,
        Account $from,
        Account $to,
        int $amountCents,
        ?string $memo,
        ?string $idempotencyKey,
    ): Transfer {
        return DB::transaction(function () use ($initiator, $from, $to, $amountCents, $memo, $idempotencyKey): Transfer {
            // Locking the initiator serializes same-user idempotency and daily-limit checks across concurrent requests.
            $lockedInitiator = User::query()->whereKey($initiator->getKey())->lockForUpdate()->first();
            if ($lockedInitiator === null) {
                throw new UserNotFoundException;
            }

            // Return a prior result before revalidating request details so retries never move money twice.
            if ($idempotencyKey !== null) {
                $existingTransfer = Transfer::query()
                    ->where('initiated_by_user_id', $lockedInitiator->getKey())
                    ->where('idempotency_key', $idempotencyKey)
                    ->first();

                if ($existingTransfer !== null) {
                    return $existingTransfer;
                }
            }

            // Recheck the locked user state so a stale caller model cannot authorize a suspended user.
            if ($lockedInitiator->status !== UserStatus::Active) {
                throw new InactiveUserException;
            }
            // Reject non-positive amounts before arithmetic or persistence.
            if ($amountCents <= 0) {
                throw new InvalidTransferException('Transfer amount must be greater than zero.', 'invalid_amount');
            }
            $fromId = (int) $from->getKey();
            $toId = (int) $to->getKey();

            // A self-transfer would produce misleading paired ledger rows without changing net funds.
            if ($fromId === $toId) {
                throw new InvalidTransferException('Source and destination accounts must differ.', 'same_account');
            }

            $accountIds = [$fromId, $toId];

            // A stable ascending lock order prevents two opposing transfers from deadlocking each other.
            $lockedAccounts = Account::query()
                ->whereIn('id', $accountIds)
                ->orderBy('id')
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            $lockedFrom = $lockedAccounts->get($fromId);
            $lockedTo = $lockedAccounts->get($toId);
            // Both rows must still exist after the caller supplied their earlier model instances.
            if ($lockedFrom === null || $lockedTo === null) {
                throw new AccountNotFoundException;
            }

            // Ownership is checked against the freshly loaded row, not the caller's possibly stale account object.
            if ((int) $lockedFrom->user_id !== (int) $lockedInitiator->getKey()) {
                throw new AccountOwnershipException;
            }
            // Frozen and closed accounts cannot participate on either side of a transfer.
            if ($lockedFrom->status === AccountStatus::Frozen || $lockedTo->status === AccountStatus::Frozen) {
                throw new AccountFrozenException;
            }
            if ($lockedFrom->status === AccountStatus::Closed || $lockedTo->status === AccountStatus::Closed) {
                throw new AccountClosedException;
            }
            // Currency conversion is not part of this ledger operation; both locked accounts must match.
            if ($lockedFrom->currency !== $lockedTo->currency) {
                throw new CurrencyMismatchException;
            }

            // Read balances only after both account locks are held so concurrent debits cannot spend stale funds.
            $fromBalance = (int) $lockedFrom->balance_cents;
            $toBalance = (int) $lockedTo->balance_cents;
            // Reject a debit that would violate the account's non-negative balance invariant.
            if ($fromBalance < $amountCents) {
                throw new InsufficientFundsException;
            }

            $limit = (int) config('bank.daily_transfer_limit_cents', 500000);
            $dayStart = Carbon::now()->startOfDay();
            $dayEnd = $dayStart->copy()->addDay();

            // The initiator lock makes this completed-transfer total safe from concurrent transfers by the same user.
            $outgoingToday = (int) Transfer::query()
                ->where('initiated_by_user_id', $lockedInitiator->getKey())
                ->where('status', TransferStatus::Completed->value)
                ->where('created_at', '>=', $dayStart)
                ->where('created_at', '<', $dayEnd)
                ->sum('amount_cents');

            // Compare against the remaining allowance to prevent this request from crossing the user's daily cap.
            if ($outgoingToday >= $limit || $amountCents > $limit - $outgoingToday) {
                throw new DailyLimitExceededException;
            }

            $transfer = Transfer::create([
                'initiated_by_user_id' => $lockedInitiator->getKey(),
                'from_account_id' => $lockedFrom->getKey(),
                'to_account_id' => $lockedTo->getKey(),
                'amount_cents' => $amountCents,
                'currency' => $lockedFrom->currency ?: config('bank.default_currency', 'USD'),
                'memo' => $memo,
                'status' => TransferStatus::Completed,
                'idempotency_key' => $idempotencyKey,
            ]);

            $newBalances = [
                (int) $lockedFrom->getKey() => $fromBalance - $amountCents,
                (int) $lockedTo->getKey() => $toBalance + $amountCents,
            ];
            ksort($newBalances, SORT_NUMERIC);

            // Persist balances in the same order used to acquire account locks.
            foreach ($newBalances as $accountId => $balance) {
                $account = $lockedAccounts->get($accountId);
                $account->balance_cents = $balance;
                $account->save();
            }

            $postedAt = Carbon::now();
            Transaction::create([
                'account_id' => $lockedFrom->getKey(),
                'transfer_id' => $transfer->getKey(),
                'direction' => TransactionDirection::Debit,
                'amount_cents' => $amountCents,
                'balance_after_cents' => $fromBalance - $amountCents,
                'category' => TransactionCategory::Transfer,
                'description' => 'Transfer to account '.$lockedTo->account_number,
                'counterparty_name' => 'Account '.$lockedTo->account_number,
                'reference' => (string) Str::ulid(),
                'posted_at' => $postedAt,
                'created_at' => $postedAt,
            ]);

            Transaction::create([
                'account_id' => $lockedTo->getKey(),
                'transfer_id' => $transfer->getKey(),
                'direction' => TransactionDirection::Credit,
                'amount_cents' => $amountCents,
                'balance_after_cents' => $toBalance + $amountCents,
                'category' => TransactionCategory::Transfer,
                'description' => 'Transfer from account '.$lockedFrom->account_number,
                'counterparty_name' => 'Account '.$lockedFrom->account_number,
                'reference' => (string) Str::ulid(),
                'posted_at' => $postedAt,
                'created_at' => $postedAt,
            ]);

            AuditLog::create([
                'user_id' => $lockedInitiator->getKey(),
                'action' => 'transfer.completed',
                'entity_type' => 'transfer',
                'entity_id' => (string) $transfer->getKey(),
                'metadata' => [
                    'from_account_id' => $lockedFrom->getKey(),
                    'to_account_id' => $lockedTo->getKey(),
                    'amount_cents' => $amountCents,
                    'currency' => $lockedFrom->currency,
                ],
                'created_at' => $postedAt,
            ]);

            return $transfer;
        }, 3);
    }
}
