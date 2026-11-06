<?php

namespace App\Console\Commands;

use App\Enums\AccountType;
use App\Models\Account;
use App\Models\Card;
use App\Models\Transaction;
use App\Models\Transfer;
use App\Models\User;
use App\Services\LedgerService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\Process\Process;
use Throwable;

class BankStressConcurrency extends E2eCommand
{
    protected $signature = 'bank:stress-concurrency';

    protected $description = 'Run concurrent money-movement stress scenarios against an isolated MySQL E2E database';

    private array $rows = [];

    public function handle(): int
    {
        $database = $this->e2eDatabaseConfig();
        if ($database === null) {
            return self::FAILURE;
        }
        if (! $this->usesInnoDb()) {
            $this->error('Concurrency stress requires InnoDB for users, accounts, transfers, transactions, cards, bill payments, and card purchase attempts.');

            return self::FAILURE;
        }

        $limit = 500000;
        config(['bank.daily_transfer_limit_cents' => $limit]);
        $this->line('Stress database: '.$database['database']);
        $this->overdrawRace();
        $this->opposingTransfers();
        $this->idempotencyRace();
        $this->dailyLimitRace($limit);
        $this->cardRaces();
        $this->billLimitRace($limit);

        $reconcileExit = Artisan::call('bank:reconcile');
        $reconcileOutput = trim(Artisan::output());
        $this->line($reconcileOutput);
        $this->record('final reconciliation', 0, $reconcileExit === self::SUCCESS ? 1 : 0, [], 'all accounts reconcile', $reconcileExit === self::SUCCESS);
        $this->newLine();
        $this->table(['scenario', 'workers', 'succeeded', 'failed (by code)', 'expected', 'result'], $this->rows);

        return collect($this->rows)->every(fn (array $row): bool => $row[5] === 'PASS')
            ? self::SUCCESS
            : self::FAILURE;
    }

    private function overdrawRace(): void
    {
        [$sender, $source] = $this->fundedAccount(10000);
        [, $destination] = $this->fundedAccount(0);
        $payloads = [];
        for ($index = 0; $index < 8; $index++) {
            $payloads[] = $this->transferPayload($sender, $source, $destination, 6000);
        }
        $results = $this->runWorkers($payloads);
        $failures = $this->failureCounts($results);
        $pass = count(array_filter($results, fn (array $result): bool => $result['ok'])) === 1
            && ($failures['insufficient_funds'] ?? 0) === 7
            && (int) $source->fresh()->balance_cents === 4000
            && (int) $destination->fresh()->balance_cents === 6000;
        $this->record('overdraw race', 8, 1, $failures, '1 success, 7 insufficient_funds; balances 4000/6000', $pass);
    }

    private function opposingTransfers(): void
    {
        [$userA, $accountA] = $this->fundedAccount(1000000);
        [$userB, $accountB] = $this->fundedAccount(1000000);
        $initialTotal = (int) $accountA->balance_cents + (int) $accountB->balance_cents;
        $allResults = [];
        for ($round = 0; $round < 20; $round++) {
            $payloads = [];
            for ($worker = 0; $worker < 4; $worker++) {
                $payloads[] = $this->transferPayload($userA, $accountA, $accountB, 1);
                $payloads[] = $this->transferPayload($userB, $accountB, $accountA, 1);
            }
            array_push($allResults, ...$this->runWorkers($payloads));
        }
        $failures = $this->failureCounts($allResults);
        $pass = count($allResults) === 160
            && count(array_filter($allResults, fn (array $result): bool => $result['ok'])) === 160
            && (int) $accountA->fresh()->balance_cents + (int) $accountB->fresh()->balance_cents === $initialTotal;
        $this->record('opposing transfer deadlock', 160, count(array_filter($allResults, fn (array $result): bool => $result['ok'])), $failures, '160 domain outcomes, all succeed; combined balance conserved', $pass);
    }

    private function idempotencyRace(): void
    {
        [$sender, $source] = $this->fundedAccount(50000);
        [, $destination] = $this->fundedAccount(0);
        $key = (string) Str::uuid();
        $hash = hash('sha256', json_encode(['from' => $source->id, 'to' => $destination->id, 'amount' => 1000], JSON_THROW_ON_ERROR));
        $payloads = [];
        for ($index = 0; $index < 8; $index++) {
            $payloads[] = $this->transferPayload($sender, $source, $destination, 1000, $key, $hash);
        }
        $results = $this->runWorkers($payloads);
        $ids = array_values(array_unique(array_filter(array_column($results, 'transfer_id'))));
        $transferCount = Transfer::query()->where('initiated_by_user_id', $sender->id)->where('idempotency_key', $key)->count();
        $ledgerCount = Transaction::query()->where('transfer_id', $ids[0] ?? '')->count();
        $pass = count($results) === 8
            && count(array_filter($results, fn (array $result): bool => $result['ok'])) === 8
            && count($ids) === 1
            && $transferCount === 1
            && $ledgerCount === 2;
        $this->record('idempotency race', 8, count(array_filter($results, fn (array $result): bool => $result['ok'])), $this->failureCounts($results), 'one transfer, two ledger rows, one shared transfer id', $pass);
    }

    private function dailyLimitRace(int $limit): void
    {
        [$sender, $checking] = $this->fundedAccount(1000000, AccountType::Checking);
        [, $savings] = $this->fundedAccountFor($sender, 1000000, AccountType::Savings);
        [, $destination] = $this->fundedAccount(0);
        $payloads = [];
        for ($index = 0; $index < 5; $index++) {
            $payloads[] = $this->transferPayload($sender, $checking, $destination, 100000);
            $payloads[] = $this->transferPayload($sender, $savings, $destination, 100000);
        }
        $results = $this->runWorkers($payloads);
        $failures = $this->failureCounts($results);
        $debits = (int) Transaction::query()->whereIn('account_id', [$checking->id, $savings->id])->where('direction', 'debit')->sum('amount_cents');
        $completed = Transfer::query()->where('initiated_by_user_id', $sender->id)->count();
        $pass = $completed === 5 && $debits <= $limit && $debits === 500000 && ($failures['daily_limit_exceeded'] ?? 0) === 5;
        $this->record('daily limit across accounts', 10, $completed, $failures, '5 transfers; outgoing total exactly 500000 cents, never above limit', $pass);
    }

    private function cardRaces(): void
    {
        [$user, $account] = $this->fundedAccount(10000);
        $card = Card::factory()->for($user)->for($account)->create(['daily_limit_cents' => 100000]);
        $payloads = [];
        for ($index = 0; $index < 8; $index++) {
            $payloads[] = $this->cardPayload($user, $card, 3000);
        }
        $results = $this->runWorkers($payloads);
        $failures = $this->failureCounts($results);
        $approved = (int) Transaction::query()->where('card_id', $card->id)->count();
        $pass = $approved === 3 && (int) $account->fresh()->balance_cents === 1000 && ($failures['insufficient_funds'] ?? 0) === 5;
        $this->record('card balance race', 8, $approved, $failures, '3 approvals, 5 insufficient_funds; balance 1000', $pass);

        [$limitUser, $limitAccount] = $this->fundedAccount(100000);
        $limitedCard = Card::factory()->for($limitUser)->for($limitAccount)->create(['daily_limit_cents' => 5000]);
        $limitPayloads = [];
        for ($index = 0; $index < 8; $index++) {
            $limitPayloads[] = $this->cardPayload($limitUser, $limitedCard, 3000);
        }
        $limitResults = $this->runWorkers($limitPayloads);
        $limitFailures = $this->failureCounts($limitResults);
        $limitApproved = (int) Transaction::query()->where('card_id', $limitedCard->id)->count();
        $limitPass = $limitApproved === 1
            && (int) Transaction::query()->where('card_id', $limitedCard->id)->sum('amount_cents') <= 5000
            && ($limitFailures['card_limit_exceeded'] ?? 0) === 7;
        $this->record('card daily-limit race', 8, $limitApproved, $limitFailures, '1 approval, 7 card_limit_exceeded; card spend <= 5000', $limitPass);
    }

    private function billLimitRace(int $limit): void
    {
        [$sender, $source] = $this->fundedAccount(10000000);
        [, $destination] = $this->fundedAccount(0);
        $baselineHash = hash('sha256', json_encode(['baseline' => $source->id], JSON_THROW_ON_ERROR));
        app(LedgerService::class)->transfer($sender, $source, $destination, 400000, 'Concurrency stress daily-limit baseline', (string) Str::uuid(), 'account_number', $baselineHash, 'Stress recipient');
        $payloads = [];
        for ($index = 0; $index < 8; $index++) {
            $payloads[] = [
                'scenario' => 'bill', 'user_id' => $sender->id, 'account_id' => $source->id,
                'biller_code' => 'north-electric', 'reference_number' => 'NE'.str_pad((string) $index, 8, '0', STR_PAD_LEFT),
                'amount_cents' => 100000, 'idempotency_key' => (string) Str::uuid(),
                'request_hash' => hash('sha256', 'bill-'.$source->id.'-'.$index),
            ];
        }
        $results = $this->runWorkers($payloads);
        $failures = $this->failureCounts($results);
        $billTotal = (int) Transaction::query()->where('account_id', $source->id)->where('category', 'bill_payment')->sum('amount_cents');
        $outgoingTotal = (int) Transaction::query()->where('account_id', $source->id)->where('direction', 'debit')->sum('amount_cents');
        $completed = count(array_filter($results, fn (array $result): bool => $result['ok']));
        $pass = $completed === 1 && $billTotal === 100000 && $outgoingTotal === 500000 && $outgoingTotal <= $limit
            && ($failures['daily_limit_exceeded'] ?? 0) === 7;
        $this->record('bill shares transfer daily limit', 8, $completed, $failures, '400k transfer + 100k bill; total 500k, 7 daily_limit_exceeded', $pass);
    }

    private function fundedAccount(int $balance, AccountType $type = AccountType::Checking): array
    {
        $user = User::factory()->create();

        return $this->fundedAccountFor($user, $balance, $type);
    }

    private function fundedAccountFor(User $user, int $balance, AccountType $type): array
    {
        $account = Account::factory()->for($user)->create(['type' => $type, 'balance_cents' => 0]);
        if ($balance > 0) {
            app(LedgerService::class)->deposit($account, $balance, 'Concurrency stress funding');
        }

        return [$user, $account->fresh()];
    }

    private function transferPayload(User $user, Account $from, Account $to, int $amount, ?string $key = null, ?string $hash = null): array
    {
        $key ??= (string) Str::uuid();
        $hash ??= hash('sha256', json_encode(['from' => $from->id, 'to' => $to->id, 'amount' => $amount, 'key' => $key], JSON_THROW_ON_ERROR));

        return [
            'scenario' => 'transfer', 'user_id' => $user->id, 'from_account_id' => $from->id,
            'to_account_id' => $to->id, 'amount_cents' => $amount, 'idempotency_key' => $key,
            'request_hash' => $hash, 'destination_type' => 'account_number', 'recipient_name' => 'Stress recipient',
        ];
    }

    private function cardPayload(User $user, Card $card, int $amount): array
    {
        $key = (string) Str::uuid();

        return [
            'scenario' => 'card', 'user_id' => $user->id, 'card_id' => $card->id,
            'merchant' => 'Concurrency Stress Shop', 'amount_cents' => $amount,
            'idempotency_key' => $key, 'request_hash' => hash('sha256', 'card-'.$card->id.'-'.$key),
        ];
    }

    private function runWorkers(array $payloads): array
    {
        $startAt = microtime(true) + 1.5;
        $processes = [];

        foreach ($payloads as $payload) {
            $payload['start_at'] = $startAt;
            $encoded = rtrim(strtr(base64_encode(json_encode($payload, JSON_THROW_ON_ERROR)), '+/', '-_'), '=');
            $process = new Process([
                PHP_BINARY, '-d', 'memory_limit=64M', 'artisan', 'bank:stress-worker', (string) $payload['scenario'], $encoded,
            ], base_path(), ['BANK_DAILY_TRANSFER_LIMIT_CENTS' => (string) config('bank.daily_transfer_limit_cents', 500000)]);
            $process->setTimeout(25);
            $process->start();
            $processes[] = $process;
        }

        $results = [];
        foreach ($processes as $process) {
            try {
                $process->wait();
                $lines = array_values(array_filter(preg_split('/\R/', trim($process->getOutput())) ?: []));
                $decoded = $lines === [] ? null : json_decode($lines[array_key_last($lines)], true);
                if ($process->isSuccessful() && is_array($decoded) && isset($decoded['ok'], $decoded['ms'])) {
                    $results[] = $decoded;
                } else {
                    $results[] = ['ok' => false, 'code' => 'worker_process_failed', 'ms' => 0];
                    $this->line(trim($process->getErrorOutput() ?: $process->getOutput()));
                }
            } catch (Throwable $exception) {
                $results[] = ['ok' => false, 'code' => 'worker_timeout', 'ms' => 0];
                $process->stop(0);
                $this->line($exception->getMessage());
            }
        }

        return $results;
    }

    private function failureCounts(array $results): array
    {
        $failures = [];
        foreach ($results as $result) {
            if (! ($result['ok'] ?? false)) {
                $code = (string) ($result['code'] ?? 'unknown_error');
                $failures[$code] = ($failures[$code] ?? 0) + 1;
            }
        }
        ksort($failures);

        return $failures;
    }

    private function usesInnoDb(): bool
    {
        $tables = DB::select("SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('users', 'accounts', 'transfers', 'transactions', 'cards', 'bill_payments', 'card_purchase_attempts')");
        $engines = collect($tables)->keyBy('TABLE_NAME');

        foreach (['users', 'accounts', 'transfers', 'transactions', 'cards', 'bill_payments', 'card_purchase_attempts'] as $table) {
            if (strtolower((string) ($engines->get($table)->ENGINE ?? '')) !== 'innodb') {
                return false;
            }
        }

        return true;
    }

    private function record(string $scenario, int $workers, int $succeeded, array $failures, string $expected, bool $pass): void
    {
        $this->rows[] = [$scenario, $workers, $succeeded, $failures === [] ? 'none' : json_encode($failures), $expected, $pass ? 'PASS' : 'FAIL'];
    }
}