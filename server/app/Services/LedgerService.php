<?php

namespace App\Services;

use App\Enums\AccountStatus;
use App\Enums\CardStatus;
use App\Enums\TransactionCategory;
use App\Enums\TransactionDirection;
use App\Enums\TransferStatus;
use App\Enums\UserStatus;
use App\Exceptions\Bank\AccountClosedException;
use App\Exceptions\Bank\AccountFrozenException;
use App\Exceptions\Bank\AccountNotFoundException;
use App\Exceptions\Bank\AccountOwnershipException;
use App\Exceptions\Bank\AmountInvalidException;
use App\Exceptions\Bank\CurrencyMismatchException;
use App\Exceptions\Bank\DailyLimitExceededException;
use App\Exceptions\Bank\IdempotencyKeyReusedException;
use App\Exceptions\Bank\InactiveUserException;
use App\Exceptions\Bank\InsufficientFundsException;
use App\Exceptions\Bank\InvalidTransferException;
use App\Exceptions\Bank\RecipientNotFoundException;
use App\Exceptions\Bank\ReferenceInvalidException;
use App\Models\BillPayment;
use App\Models\Card;
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
    public function cardPurchase(User $initiator, Card $card, string $merchant, int $amountCents, string $key, string $requestHash): array
    {
        return DB::transaction(function () use ($initiator, $card, $merchant, $amountCents, $key, $requestHash): array {
            $user = User::query()->whereKey($initiator->getKey())->lockForUpdate()->firstOrFail();
            $existing = DB::table('card_purchase_attempts')->where('user_id', $user->getKey())->where('idempotency_key', $key)->first();
            if ($existing !== null) {
                if (! hash_equals((string) $existing->request_hash, $requestHash)) {
                    throw new IdempotencyKeyReusedException;
                }

                return ['status' => $existing->status, 'code' => $existing->decline_code, 'transaction_id' => $existing->transaction_id, 'balance_after_cents' => $existing->balance_after_cents, 'replayed' => true];
            }

            $lockedCard = Card::query()->whereKey($card->getKey())->lockForUpdate()->firstOrFail();
            $account = Account::query()->whereKey($lockedCard->account_id)->lockForUpdate()->firstOrFail();
            $code = match (true) {
                $lockedCard->status === CardStatus::Cancelled => 'card_cancelled',
                $lockedCard->status === CardStatus::Frozen => 'card_frozen',
                in_array($account->status, [AccountStatus::Frozen, AccountStatus::Closed], true) => 'account_frozen',
                (int) $account->balance_cents < $amountCents => 'insufficient_funds',
                $this->cardSpentToday($lockedCard) + $amountCents > (int) $lockedCard->daily_limit_cents => 'card_limit_exceeded',
                default => null,
            };
            $now = Carbon::now('UTC');
            $audit = [
                'user_id' => $user->getKey(), 'action' => $code === null ? 'card_purchase.approved' : 'card_purchase.declined',
                'entity_type' => 'card', 'entity_id' => (string) $lockedCard->getKey(),
                'metadata' => ['amount_cents' => $amountCents, 'merchant' => $merchant, 'code' => $code], 'created_at' => $now,
            ];
            if ($code !== null) {
                AuditLog::create($audit);
                DB::table('card_purchase_attempts')->insert([
                    'user_id' => $user->getKey(), 'card_id' => $lockedCard->getKey(), 'idempotency_key' => $key,
                    'request_hash' => $requestHash, 'status' => 'declined', 'decline_code' => $code,
                    'created_at' => $now, 'updated_at' => $now,
                ]);

                return ['status' => 'declined', 'code' => $code, 'transaction_id' => null, 'balance_after_cents' => (int) $account->balance_cents, 'replayed' => false];
            }

            $balance = (int) $account->balance_cents - $amountCents;
            $account->balance_cents = $balance;
            $account->save();
            $transaction = Transaction::create([
                'account_id' => $account->getKey(), 'card_id' => $lockedCard->getKey(),
                'direction' => TransactionDirection::Debit, 'amount_cents' => $amountCents,
                'balance_after_cents' => $balance, 'category' => TransactionCategory::Card,
                'description' => 'Card payment: '.$merchant, 'counterparty_name' => $merchant,
                'reference' => (string) Str::ulid(), 'posted_at' => $now, 'created_at' => $now,
            ]);
            $audit['entity_type'] = 'transaction';
            $audit['entity_id'] = (string) $transaction->getKey();
            AuditLog::create($audit);
            DB::table('card_purchase_attempts')->insert([
                'user_id' => $user->getKey(), 'card_id' => $lockedCard->getKey(), 'idempotency_key' => $key,
                'request_hash' => $requestHash, 'status' => 'approved', 'transaction_id' => $transaction->getKey(),
                'balance_after_cents' => $balance, 'created_at' => $now, 'updated_at' => $now,
            ]);
            app(NotificationService::class)->sendAfterCommit($user, 'card_purchase', [
                'amount_cents' => $amountCents, 'merchant' => $merchant, 'last4' => $lockedCard->last4,
            ]);
            app(NotificationService::class)->checkLowBalance($account, false);

            return ['status' => 'approved', 'code' => null, 'transaction_id' => $transaction->getKey(), 'balance_after_cents' => $balance, 'replayed' => false];
        }, 3);
    }

    private function cardSpentToday(Card $card): int
    {
        return (int) Transaction::query()->where('card_id', $card->getKey())
            ->where('direction', TransactionDirection::Debit)
            ->where('posted_at', '>=', Carbon::now('UTC')->startOfDay())
            ->where('posted_at', '<', Carbon::now('UTC')->addDay()->startOfDay())
            ->sum('amount_cents');
    }

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
            app(NotificationService::class)->checkLowBalance($account);

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
        ?string $destinationType = null,
        ?string $requestHash = null,
        ?string $recipientName = null,
        ?string $destinationNumberMasked = null,
        ?string $destinationHolderMasked = null,
    ): Transfer {
        return DB::transaction(function () use ($initiator, $from, $to, $amountCents, $memo, $idempotencyKey, $destinationType, $requestHash, $recipientName, $destinationNumberMasked, $destinationHolderMasked): Transfer {
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
                    if ($requestHash !== null && ! hash_equals((string) $existingTransfer->request_hash, $requestHash)) {
                        throw new IdempotencyKeyReusedException;
                    }

                    return $existingTransfer;
                }
            }

            // Recheck the locked user state so a stale caller model cannot authorize a suspended user.
            if ($lockedInitiator->status !== UserStatus::Active) {
                throw new InactiveUserException;
            }
            // Reject non-positive amounts before arithmetic or persistence.
            if ($amountCents < 1 || $amountCents > 10000000) {
                throw new AmountInvalidException;
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
            $resolvedDestinationType = $destinationType ?? ((int) $lockedTo->user_id === (int) $lockedInitiator->getKey() ? 'own' : 'account_number');
            if ($resolvedDestinationType === 'own' && (int) $lockedTo->user_id !== (int) $lockedInitiator->getKey()) {
                throw new RecipientNotFoundException;
            }
            if ($resolvedDestinationType !== 'own' && (int) $lockedTo->user_id === (int) $lockedInitiator->getKey()) {
                throw new RecipientNotFoundException;
            }

            // Read balances only after both account locks are held so concurrent debits cannot spend stale funds.
            $fromBalance = (int) $lockedFrom->balance_cents;
            $toBalance = (int) $lockedTo->balance_cents;
            // Reject a debit that would violate the account's non-negative balance invariant.
            if ($fromBalance < $amountCents) {
                throw new InsufficientFundsException;
            }

            $limit = (int) config('bank.daily_transfer_limit_cents', 500000);
            $usedToday = app(MoneyMovementReadService::class)->usedToday($lockedInitiator, Carbon::now('UTC')->toImmutable());

            if ((int) $lockedTo->user_id !== (int) $lockedInitiator->getKey()
                && ($usedToday >= $limit || $amountCents > $limit - $usedToday)) {
                throw new DailyLimitExceededException;
            }

            $recipient = $recipientName === null
                ? User::query()->whereKey($lockedTo->user_id)->first()
                : null;
            $targetName = $recipientName ?: trim(($recipient?->first_name ?? '').' '.($recipient?->last_name ?? '')) ?: 'Westbridge customer';
            $senderMasked = BeneficiaryService::maskHolder($lockedInitiator->first_name, $lockedInitiator->last_name);
            $targetHolderMasked = $destinationHolderMasked ?: BeneficiaryService::maskHolder(
                $recipient?->first_name ?? '',
                $recipient?->last_name ?? '',
            );

            $transfer = Transfer::create([
                'initiated_by_user_id' => $lockedInitiator->getKey(),
                'from_account_id' => $lockedFrom->getKey(),
                'to_account_id' => $lockedTo->getKey(),
                'destination_type' => $resolvedDestinationType,
                'destination_name' => $targetName,
                'destination_number_masked' => $destinationNumberMasked ?: BeneficiaryService::maskAccountNumber($lockedTo->account_number),
                'destination_holder_masked' => $targetHolderMasked,
                'amount_cents' => $amountCents,
                'currency' => $lockedFrom->currency ?: config('bank.default_currency', 'USD'),
                'memo' => $memo,
                'status' => TransferStatus::Completed,
                'idempotency_key' => $idempotencyKey,
                'request_hash' => $requestHash,
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
                'description' => 'Transfer to '.$targetName,
                'counterparty_name' => $targetName,
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
                'description' => 'Transfer from '.$senderMasked,
                'counterparty_name' => $senderMasked,
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
            if ((int) $lockedFrom->user_id !== (int) $lockedTo->user_id) {
                $notificationService = app(NotificationService::class);
                $notificationService->sendAfterCommit($lockedInitiator, 'transfer_sent', [
                    'amount_cents' => $amountCents,
                    'to_masked' => BeneficiaryService::maskAccountNumber($lockedTo->account_number),
                    'reference' => (string) $transfer->getKey(),
                ]);
                $recipientUser = User::query()->whereKey($lockedTo->user_id)->first();
                if ($recipientUser !== null) {
                    $notificationService->sendAfterCommit($recipientUser, 'transfer_received', [
                        'amount_cents' => $amountCents,
                        'from_masked' => BeneficiaryService::maskAccountNumber($lockedFrom->account_number),
                        'reference' => (string) $transfer->getKey(),
                    ]);
                }
            }
            app(NotificationService::class)->checkLowBalance($lockedFrom);
            app(NotificationService::class)->checkLowBalance($lockedTo, false);

            return $transfer;
        }, 3);
    }

    public function payBill(
        User $initiator,
        Account $from,
        string $billerCode,
        string $referenceNumber,
        int $amountCents,
        string $idempotencyKey,
        string $requestHash,
    ): BillPayment {
        return DB::transaction(function () use ($initiator, $from, $billerCode, $referenceNumber, $amountCents, $idempotencyKey, $requestHash): BillPayment {
            $lockedUser = User::query()->whereKey($initiator->getKey())->lockForUpdate()->firstOrFail();
            $existing = BillPayment::query()->where('user_id', $lockedUser->getKey())->where('idempotency_key', $idempotencyKey)->first();
            if ($existing !== null) {
                if (! hash_equals((string) $existing->request_hash, $requestHash)) {
                    throw new IdempotencyKeyReusedException;
                }

                return $existing;
            }
            if ($lockedUser->status !== UserStatus::Active) {
                throw new InactiveUserException;
            }
            if ($amountCents < 1 || $amountCents > 5000000) {
                throw new AmountInvalidException;
            }

            $account = Account::query()->whereKey($from->getKey())->lockForUpdate()->first();
            if ($account === null) {
                throw new AccountNotFoundException;
            }
            if ((int) $account->user_id !== (int) $lockedUser->getKey()) {
                throw new AccountOwnershipException;
            }
            if ($account->status === AccountStatus::Frozen) {
                throw new AccountFrozenException;
            }
            if ($account->status === AccountStatus::Closed) {
                throw new AccountClosedException;
            }

            $catalog = app(BillerCatalogService::class);
            $biller = $catalog->find($billerCode);
            if (preg_match($biller['reference_pattern'], $referenceNumber) !== 1) {
                throw new ReferenceInvalidException;
            }
            $usedToday = app(MoneyMovementReadService::class)->usedToday($lockedUser, Carbon::now('UTC')->toImmutable());
            $limit = (int) config('bank.daily_transfer_limit_cents', 500000);
            if ($usedToday >= $limit || $amountCents > $limit - $usedToday) {
                throw new DailyLimitExceededException;
            }
            $balance = (int) $account->balance_cents;
            if ($balance < $amountCents) {
                throw new InsufficientFundsException;
            }

            $newBalance = $balance - $amountCents;
            $account->balance_cents = $newBalance;
            $account->save();
            $postedAt = Carbon::now('UTC');
            $transaction = Transaction::create([
                'account_id' => $account->getKey(),
                'direction' => TransactionDirection::Debit,
                'amount_cents' => $amountCents,
                'balance_after_cents' => $newBalance,
                'category' => TransactionCategory::BillPayment,
                'description' => 'Bill payment: '.$biller['name'],
                'counterparty_name' => $biller['name'],
                'reference' => (string) Str::ulid(),
                'posted_at' => $postedAt,
                'created_at' => $postedAt,
            ]);
            $payment = BillPayment::create([
                'user_id' => $lockedUser->getKey(),
                'account_id' => $account->getKey(),
                'biller_code' => $biller['code'],
                'biller_name' => $biller['name'],
                'reference_number' => $referenceNumber,
                'amount_cents' => $amountCents,
                'status' => 'completed',
                'transaction_id' => $transaction->getKey(),
                'idempotency_key' => $idempotencyKey,
                'request_hash' => $requestHash,
                'created_at' => $postedAt,
            ]);
            AuditLog::create([
                'user_id' => $lockedUser->getKey(),
                'action' => 'bill_payment.completed',
                'entity_type' => 'bill_payment',
                'entity_id' => (string) $payment->getKey(),
                'metadata' => [
                    'account_id' => $account->getKey(),
                    'biller_code' => $biller['code'],
                    'amount_cents' => $amountCents,
                    'currency' => $account->currency,
                ],
                'created_at' => $postedAt,
            ]);
            app(NotificationService::class)->sendAfterCommit($lockedUser, 'bill_paid', [
                'amount_cents' => $amountCents,
                'biller_name' => $biller['name'],
            ]);
            app(NotificationService::class)->checkLowBalance($account);

            return $payment;
        }, 3);
    }
}
