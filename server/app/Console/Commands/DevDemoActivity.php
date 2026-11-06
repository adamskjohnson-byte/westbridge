<?php

namespace App\Console\Commands;

use App\Enums\AccountType;
use App\Enums\TransactionCategory;
use App\Enums\TransactionDirection;
use App\Enums\TransferStatus;
use App\Models\Account;
use App\Models\Transaction;
use App\Models\Transfer;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

class DevDemoActivity extends Command
{
    protected $signature = 'dev:demo-activity {email} {--days=90}';

    protected $description = 'Generate balanced local demo ledger activity for a newly registered account';

    public function handle(): int
    {
        if (! app()->environment('local')) {
            $this->error('This command is available only when APP_ENV=local.');

            return self::FAILURE;
        }

        $days = filter_var($this->option('days'), FILTER_VALIDATE_INT);
        if ($days === false || $days < 1 || $days > 365) {
            $this->error('The days option must be an integer from 1 to 365.');

            return self::FAILURE;
        }

        $user = User::query()->where('email', strtolower(trim((string) $this->argument('email'))))->first();
        if ($user === null) {
            $this->error('No user was found for that email address.');

            return self::FAILURE;
        }

        $accounts = $user->accounts()
            ->whereIn('type', [AccountType::Checking->value, AccountType::Savings->value])
            ->orderBy('id')
            ->get();
        $checking = $accounts->firstWhere('type', AccountType::Checking);
        $savings = $accounts->firstWhere('type', AccountType::Savings);
        if ($checking === null || $savings === null) {
            $this->error('The user must have checking and savings accounts.');

            return self::FAILURE;
        }

        $existing = Transaction::query()
            ->whereIn('account_id', [$checking->getKey(), $savings->getKey()])
            ->orderBy('posted_at')
            ->orderBy('id')
            ->get();
        $welcomeRows = $existing->filter(static fn (Transaction $transaction): bool => $transaction->account_id === $checking->getKey()
            && $transaction->category === TransactionCategory::Deposit
            && $transaction->counterparty_name === 'Westbridge Welcome Bonus'
        );
        if ($existing->count() !== $welcomeRows->count() || $welcomeRows->count() > 1) {
            $this->error('This helper is only for a fresh account with no prior activity beyond its welcome bonus.');

            return self::FAILURE;
        }

        $now = CarbonImmutable::now('UTC');
        $historyEnd = $welcomeRows->isNotEmpty()
            ? CarbonImmutable::parse($welcomeRows->last()->posted_at, 'UTC')->subSecond()
            : $now;
        $start = $historyEnd->subDays($days)->startOfDay();
        $events = [];
        $sequence = 0;
        $addEvent = static function (array $event) use (&$events, &$sequence): void {
            $events[] = [...$event, 'sequence' => $sequence++];
        };

        for ($offset = 0; $offset < $days; $offset += 14) {
            $addEvent([
                'at' => $start->addDays($offset)->setTime(8, 0),
                'kind' => 'entry', 'account' => $checking,
                'direction' => TransactionDirection::Credit,
                'category' => TransactionCategory::Deposit,
                'cents' => 275000, 'description' => 'Payroll deposit',
                'counterparty' => 'Westbridge Payroll', 'priority' => 0,
            ]);
        }

        for ($offset = 0; $offset < $days; $offset++) {
            $date = $start->addDays($offset);
            if ($offset % 4 === 2) {
                $addEvent([
                    'at' => $date->setTime(12, 0),
                    'kind' => 'entry', 'account' => $checking,
                    'direction' => TransactionDirection::Debit,
                    'category' => TransactionCategory::Card,
                    'cents' => 4200 + (($offset * 137) % 7400),
                    'description' => 'Grocery purchase',
                    'counterparty' => 'Juniper Market', 'priority' => 2,
                ]);
            }
            if ($offset % 18 === 9) {
                $addEvent([
                    'at' => $date->setTime(15, 0),
                    'kind' => 'entry', 'account' => $checking,
                    'direction' => TransactionDirection::Debit,
                    'category' => TransactionCategory::Withdrawal,
                    'cents' => 6000, 'description' => 'Cash withdrawal',
                    'counterparty' => 'Westbridge ATM', 'priority' => 3,
                ]);
            }
        }

        for ($month = $start->startOfMonth(); $month <= $historyEnd; $month = $month->addMonth()) {
            foreach ([
                [$month->setDay(1)->setTime(10, 0), 118000, 'Monthly rent', 'Cedar Apartments'],
                [$month->setDay(8)->setTime(10, 30), 7800, 'Utilities payment', 'River City Utilities'],
                [$month->setDay(12)->setTime(11, 0), 1299, 'Monthly subscription', 'Juniper Streaming'],
            ] as [$at, $cents, $description, $counterparty]) {
                if ($at >= $start && $at <= $historyEnd) {
                    $addEvent([
                        'at' => $at,
                        'kind' => 'entry', 'account' => $checking,
                        'direction' => TransactionDirection::Debit,
                        'category' => $description === 'Monthly subscription' ? TransactionCategory::Card : TransactionCategory::BillPayment,
                        'cents' => $cents, 'description' => $description,
                        'counterparty' => $counterparty, 'priority' => 1,
                    ]);
                }
            }
        }

        for ($offset = 20; $offset + 7 < $days; $offset += 30) {
            $cents = 15000 + (($offset * 31) % 6000);
            $addEvent([
                'at' => $start->addDays($offset)->setTime(16, 0),
                'kind' => 'transfer', 'from' => $checking, 'to' => $savings,
                'cents' => $cents, 'description' => 'Transfer to savings', 'priority' => 4,
            ]);
            $addEvent([
                'at' => $start->addDays($offset + 7)->setTime(16, 0),
                'kind' => 'transfer', 'from' => $savings, 'to' => $checking,
                'cents' => $cents, 'description' => 'Transfer from savings', 'priority' => 4,
            ]);
        }

        $events = array_values(array_filter($events, static fn (array $event): bool => $event['at'] <= $historyEnd));
        $checkingCredits = 0;
        $checkingDebits = 0;
        foreach ($events as $event) {
            if (($event['account'] ?? null)?->getKey() === $checking->getKey()) {
                if ($event['direction'] === TransactionDirection::Credit) {
                    $checkingCredits += $event['cents'];
                } else {
                    $checkingDebits += $event['cents'];
                }
            }
        }
        if ($checkingCredits < $checkingDebits) {
            $this->error('The requested activity window cannot be balanced.');

            return self::FAILURE;
        }
        if ($checkingCredits > $checkingDebits) {
            $events[] = [
                'at' => $historyEnd,
                'kind' => 'entry', 'account' => $checking,
                'direction' => TransactionDirection::Debit,
                'category' => TransactionCategory::Other,
                'cents' => $checkingCredits - $checkingDebits,
                'description' => 'Other household expenses',
                'counterparty' => 'Local businesses', 'priority' => 9,
                'sequence' => $sequence++,
            ];
        }

        usort($events, static fn (array $left, array $right): int => [
            $left['at']->getTimestamp(), $left['priority'], $left['sequence'],
        ] <=> [
            $right['at']->getTimestamp(), $right['priority'], $right['sequence'],
        ]);

        DB::transaction(function () use ($accounts, $checking, $savings, $events, $now): void {
            $lockedAccounts = Account::query()
                ->whereIn('id', $accounts->modelKeys())
                ->orderBy('id')
                ->lockForUpdate()
                ->get()
                ->keyBy('id');
            $lockedChecking = $lockedAccounts->get($checking->getKey());
            $lockedSavings = $lockedAccounts->get($savings->getKey());
            $historicalBalances = [
                $lockedChecking->getKey() => 0,
                $lockedSavings->getKey() => 0,
            ];

            foreach ($events as $event) {
                if ($event['kind'] === 'transfer') {
                    $fromId = $event['from']->getKey();
                    $toId = $event['to']->getKey();
                    if ($historicalBalances[$fromId] < $event['cents']) {
                        throw new RuntimeException('Generated transfer would overdraw a demo account.');
                    }
                    $transfer = $this->createTransfer($event['from'], $event['to'], $event['cents'], $event['description']);
                    $this->writeTransaction($fromId, $transfer->getKey(), TransactionDirection::Debit, TransactionCategory::Transfer, $event['cents'], $historicalBalances, $event);
                    $this->writeTransaction($toId, $transfer->getKey(), TransactionDirection::Credit, TransactionCategory::Transfer, $event['cents'], $historicalBalances, $event);

                    continue;
                }

                $accountId = $event['account']->getKey();
                if ($event['direction'] === TransactionDirection::Debit && $historicalBalances[$accountId] < $event['cents']) {
                    throw new RuntimeException('Generated expense would overdraw a demo account.');
                }
                $this->writeTransaction($accountId, null, $event['direction'], $event['category'], $event['cents'], $historicalBalances, $event);
            }

            if ($historicalBalances[$lockedChecking->getKey()] !== 0 || $historicalBalances[$lockedSavings->getKey()] !== 0) {
                throw new RuntimeException('Generated historical ledger activity did not return to its opening balance.');
            }

            $liveBalances = [
                $lockedChecking->getKey() => (int) $lockedChecking->balance_cents,
                $lockedSavings->getKey() => (int) $lockedSavings->balance_cents,
            ];
            $roundTripAmount = 100;
            $firstTransferAt = $now->addSecond();
            $firstEvent = ['at' => $firstTransferAt, 'description' => 'Demo transfer to savings'];
            $firstTransfer = $this->createTransfer($lockedChecking, $lockedSavings, $roundTripAmount, $firstEvent['description']);
            $this->writeTransaction($lockedChecking->getKey(), $firstTransfer->getKey(), TransactionDirection::Debit, TransactionCategory::Transfer, $roundTripAmount, $liveBalances, $firstEvent);
            $this->writeTransaction($lockedSavings->getKey(), $firstTransfer->getKey(), TransactionDirection::Credit, TransactionCategory::Transfer, $roundTripAmount, $liveBalances, $firstEvent);

            $secondEvent = ['at' => $now->addSeconds(2), 'description' => 'Demo transfer back to checking'];
            $secondTransfer = $this->createTransfer($lockedSavings, $lockedChecking, $roundTripAmount, $secondEvent['description']);
            $this->writeTransaction($lockedSavings->getKey(), $secondTransfer->getKey(), TransactionDirection::Debit, TransactionCategory::Transfer, $roundTripAmount, $liveBalances, $secondEvent);
            $this->writeTransaction($lockedChecking->getKey(), $secondTransfer->getKey(), TransactionDirection::Credit, TransactionCategory::Transfer, $roundTripAmount, $liveBalances, $secondEvent);

        }, 3);

        $this->info('Generated ledger activity for '.$user->email.' over '.$days.' day(s).');

        return self::SUCCESS;
    }

    private function createTransfer(Account $from, Account $to, int $cents, string $memo): Transfer
    {
        return Transfer::create([
            'initiated_by_user_id' => $from->user_id,
            'from_account_id' => $from->getKey(),
            'to_account_id' => $to->getKey(),
            'amount_cents' => $cents,
            'currency' => $from->currency,
            'memo' => $memo,
            'status' => TransferStatus::Completed,
        ]);
    }

    private function writeTransaction(
        int $accountId,
        ?string $transferId,
        TransactionDirection $direction,
        TransactionCategory $category,
        int $cents,
        array &$balances,
        array $event,
    ): void {
        $balances[$accountId] += $direction === TransactionDirection::Credit ? $cents : -$cents;
        $isTransfer = $transferId !== null;
        Transaction::create([
            'account_id' => $accountId,
            'transfer_id' => $transferId,
            'direction' => $direction,
            'amount_cents' => $cents,
            'balance_after_cents' => $balances[$accountId],
            'category' => $category,
            'description' => $event['description'],
            'counterparty_name' => $isTransfer ? 'Westbridge '.$event['description'] : $event['counterparty'],
            'reference' => (string) Str::ulid(),
            'posted_at' => $event['at'],
            'created_at' => $event['at'],
        ]);
    }
}
