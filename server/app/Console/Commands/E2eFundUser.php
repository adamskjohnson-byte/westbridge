<?php

namespace App\Console\Commands;

use App\Enums\AccountType;
use App\Models\User;
use App\Services\LedgerService;
use Illuminate\Support\Facades\DB;
use Throwable;

class E2eFundUser extends E2eCommand
{
    protected $signature = 'dev:e2e-fund {email} {amount_cents}';

    protected $description = 'Add fictional test funds through LedgerService in the isolated E2E database';

    public function handle(LedgerService $ledger): int
    {
        if ($this->e2eDatabaseConfig() === null) {
            return self::FAILURE;
        }

        $amountCents = filter_var($this->argument('amount_cents'), FILTER_VALIDATE_INT);
        if ($amountCents === false || $amountCents < 1 || $amountCents > 1000000000) {
            $this->error('amount_cents must be an integer from 1 through 1,000,000,000.');

            return self::FAILURE;
        }

        $user = User::query()->where('email', strtolower(trim((string) $this->argument('email'))))->first();
        $checking = $user?->accounts()->where('type', AccountType::Checking->value)->first();
        if ($user === null || $checking === null) {
            $this->error('An existing user with a checking account is required.');

            return self::FAILURE;
        }

        try {
            $ledger->deposit($checking, $amountCents, 'E2E test funding');
        } catch (Throwable $exception) {
            report($exception);
            $this->error('E2E funding failed without changing the configured database.');

            return self::FAILURE;
        }

        $this->info('Added '.$amountCents.' fictional cents to the E2E checking account.');

        return self::SUCCESS;
    }
}
