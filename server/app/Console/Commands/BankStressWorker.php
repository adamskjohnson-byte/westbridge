<?php

namespace App\Console\Commands;

use App\Exceptions\Bank\BankException;
use App\Models\Account;
use App\Models\Card;
use App\Models\User;
use App\Services\LedgerService;
use Illuminate\Console\Command;
use JsonException;
use Throwable;

class BankStressWorker extends E2eCommand
{
    protected $signature = 'bank:stress-worker {scenario} {payload}';

    protected $description = 'Internal worker for bank:stress-concurrency';

    protected $hidden = true;

    public function handle(LedgerService $ledger): int
    {
        if ($this->e2eDatabaseConfig() === null) {
            return $this->emit(['ok' => false, 'code' => 'unsafe_database', 'ms' => 0]);
        }

        $startedAt = microtime(true);
        try {
            $encoded = strtr((string) $this->argument('payload'), '-_', '+/');
            $padding = strlen($encoded) % 4;
            if ($padding !== 0) $encoded .= str_repeat('=', 4 - $padding);
            $payload = json_decode(base64_decode($encoded, true) ?: '', true, 512, JSON_THROW_ON_ERROR);
            if (! is_array($payload) || ($payload['scenario'] ?? null) !== $this->argument('scenario')) {
                return $this->emit(['ok' => false, 'code' => 'invalid_payload', 'ms' => 0]);
            }

            while (microtime(true) < (float) ($payload['start_at'] ?? 0)) {
            }

            $result = match ((string) $payload['scenario']) {
                'transfer' => $this->transfer($ledger, $payload),
                'bill' => $this->bill($ledger, $payload),
                'card' => $this->card($ledger, $payload),
                default => ['ok' => false, 'code' => 'unknown_scenario'],
            };
            $result['ms'] = (int) round((microtime(true) - $startedAt) * 1000);

            return $this->emit($result);
        } catch (BankException $exception) {
            return $this->emit(['ok' => false, 'code' => $exception->machineCode(), 'ms' => (int) round((microtime(true) - $startedAt) * 1000)]);
        } catch (JsonException) {
            return $this->emit(['ok' => false, 'code' => 'invalid_payload', 'ms' => (int) round((microtime(true) - $startedAt) * 1000)]);
        } catch (Throwable) {
            return $this->emit(['ok' => false, 'code' => 'unhandled_exception', 'ms' => (int) round((microtime(true) - $startedAt) * 1000)]);
        }
    }

    private function transfer(LedgerService $ledger, array $payload): array
    {
        $transfer = $ledger->transfer(
            User::query()->findOrFail($payload['user_id']),
            Account::query()->findOrFail($payload['from_account_id']),
            Account::query()->findOrFail($payload['to_account_id']),
            (int) $payload['amount_cents'],
            'Concurrency stress operation',
            (string) $payload['idempotency_key'],
            (string) ($payload['destination_type'] ?? 'account_number'),
            (string) $payload['request_hash'],
            (string) ($payload['recipient_name'] ?? 'Stress recipient'),
        );

        return ['ok' => true, 'transfer_id' => (string) $transfer->getKey()];
    }

    private function bill(LedgerService $ledger, array $payload): array
    {
        $payment = $ledger->payBill(
            User::query()->findOrFail($payload['user_id']),
            Account::query()->findOrFail($payload['account_id']),
            (string) $payload['biller_code'],
            (string) $payload['reference_number'],
            (int) $payload['amount_cents'],
            (string) $payload['idempotency_key'],
            (string) $payload['request_hash'],
        );

        return ['ok' => true, 'transfer_id' => (string) $payment->getKey()];
    }

    private function card(LedgerService $ledger, array $payload): array
    {
        $result = $ledger->cardPurchase(
            User::query()->findOrFail($payload['user_id']),
            Card::query()->findOrFail($payload['card_id']),
            (string) $payload['merchant'],
            (int) $payload['amount_cents'],
            (string) $payload['idempotency_key'],
            (string) $payload['request_hash'],
        );
        if ($result['status'] !== 'approved') {
            return ['ok' => false, 'code' => (string) $result['code']];
        }

        return ['ok' => true];
    }

    private function emit(array $result): int
    {
        $this->output->writeln(json_encode($result, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));

        return ($result['ok'] ?? false) || isset($result['code']) ? self::SUCCESS : self::FAILURE;
    }
}