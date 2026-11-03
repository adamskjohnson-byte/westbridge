<?php

namespace Tests\Feature;

use App\Enums\AccountStatus;
use App\Enums\AccountType;
use App\Enums\TransactionCategory;
use App\Enums\TransactionDirection;
use App\Enums\TransferStatus;
use App\Exceptions\Bank\AccountClosedException;
use App\Exceptions\Bank\AccountFrozenException;
use App\Exceptions\Bank\AccountOwnershipException;
use App\Exceptions\Bank\CurrencyMismatchException;
use App\Exceptions\Bank\DailyLimitExceededException;
use App\Exceptions\Bank\InactiveUserException;
use App\Exceptions\Bank\InsufficientFundsException;
use App\Exceptions\Bank\InvalidTransferException;
use App\Models\Account;
use App\Models\Transaction;
use App\Models\User;
use App\Services\LedgerService;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use LogicException;
use Tests\TestCase;

class LedgerServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_successful_transfer_updates_balances_and_writes_two_ledger_rows_and_audit(): void
    {
        $user = User::factory()->create();
        $from = $this->fundedAccount($user, 10000);
        $to = $this->fundedAccount($user, 2000);

        $transfer = app(LedgerService::class)->transfer($user, $from, $to, 2500, 'Shared lunch', 'success-key');

        $from->refresh();
        $to->refresh();
        $rows = Transaction::query()->where('transfer_id', $transfer->getKey())->orderBy('direction')->get();

        $this->assertSame(7500, $from->balance_cents);
        $this->assertSame(4500, $to->balance_cents);
        $this->assertSame(TransferStatus::Completed, $transfer->status);
        $this->assertCount(2, $rows);
        $this->assertSame(1, Transaction::query()->where('transfer_id', $transfer->getKey())->where('direction', TransactionDirection::Debit)->where('balance_after_cents', 7500)->count());
        $this->assertSame(1, Transaction::query()->where('transfer_id', $transfer->getKey())->where('direction', TransactionDirection::Credit)->where('balance_after_cents', 4500)->count());
        $this->assertSame(2, Transaction::query()->where('transfer_id', $transfer->getKey())->where('category', TransactionCategory::Transfer)->count());
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'transfer.completed',
            'entity_type' => 'transfer',
            'entity_id' => $transfer->getKey(),
        ]);
    }

    public function test_insufficient_funds_changes_nothing(): void
    {
        $user = User::factory()->create();
        $from = $this->fundedAccount($user, 1000);
        $to = $this->fundedAccount($user, 500);
        $transactionCount = Transaction::query()->count();

        try {
            app(LedgerService::class)->transfer($user, $from, $to, 1001, null, null);
            $this->fail('Expected insufficient funds to reject the transfer.');
        } catch (InsufficientFundsException) {
            $from->refresh();
            $to->refresh();
            $this->assertSame(1000, $from->balance_cents);
            $this->assertSame(500, $to->balance_cents);
            $this->assertSame($transactionCount, Transaction::query()->count());
            $this->assertDatabaseCount('transfers', 0);
            $this->assertDatabaseCount('audit_logs', 0);
        }
    }

    public function test_frozen_account_is_rejected_without_writes(): void
    {
        $user = User::factory()->create();
        $from = $this->fundedAccount($user, 2000, AccountStatus::Frozen);
        $to = $this->fundedAccount($user, 1000);

        $this->expectException(AccountFrozenException::class);
        app(LedgerService::class)->transfer($user, $from, $to, 100, null, null);
    }

    public function test_same_account_transfer_is_rejected(): void
    {
        $user = User::factory()->create();
        $account = $this->fundedAccount($user, 2000);

        $this->expectException(InvalidTransferException::class);
        app(LedgerService::class)->transfer($user, $account, $account, 100, null, null);
    }

    public function test_someone_elses_source_account_is_rejected(): void
    {
        $initiator = User::factory()->create();
        $owner = User::factory()->create();
        $from = $this->fundedAccount($owner, 2000);
        $to = $this->fundedAccount($initiator, 1000);

        $this->expectException(AccountOwnershipException::class);
        app(LedgerService::class)->transfer($initiator, $from, $to, 100, null, null);
    }

    public function test_suspended_initiator_is_rejected(): void
    {
        $user = User::factory()->suspended()->create();
        $from = Account::factory()->for($user)->create();
        $to = Account::factory()->for($user)->create();

        $this->expectException(InactiveUserException::class);
        app(LedgerService::class)->transfer($user, $from, $to, 100, null, null);
    }

    public function test_closed_account_is_rejected(): void
    {
        $user = User::factory()->create();
        $from = Account::factory()->for($user)->create(['status' => AccountStatus::Closed]);
        $to = Account::factory()->for($user)->create();

        $this->expectException(AccountClosedException::class);
        app(LedgerService::class)->transfer($user, $from, $to, 100, null, null);
    }

    public function test_currency_mismatch_is_rejected(): void
    {
        $user = User::factory()->create();
        $from = Account::factory()->for($user)->create(['currency' => 'USD']);
        $to = Account::factory()->for($user)->create(['currency' => 'EUR']);

        $this->expectException(CurrencyMismatchException::class);
        app(LedgerService::class)->transfer($user, $from, $to, 100, null, null);
    }

    public function test_same_idempotency_key_moves_money_only_once(): void
    {
        $user = User::factory()->create();
        $from = $this->fundedAccount($user, 5000);
        $to = $this->fundedAccount($user, 500);
        $service = app(LedgerService::class);

        $first = $service->transfer($user, $from, $to, 750, null, 'repeat-key');
        $second = $service->transfer($user, $from, $to, 750, null, 'repeat-key');

        $from->refresh();
        $to->refresh();
        $this->assertSame($first->getKey(), $second->getKey());
        $this->assertSame(4250, $from->balance_cents);
        $this->assertSame(1250, $to->balance_cents);
        $this->assertDatabaseCount('transfers', 1);
        $this->assertDatabaseCount('transactions', 4);
        $this->assertDatabaseCount('audit_logs', 1);
    }

    public function test_daily_transfer_limit_is_enforced(): void
    {
        config(['bank.daily_transfer_limit_cents' => 1000]);
        $user = User::factory()->create();
        $from = $this->fundedAccount($user, 5000);
        $to = $this->fundedAccount($user, 0);
        $service = app(LedgerService::class);
        $service->transfer($user, $from, $to, 700, null, 'under-limit');

        $this->expectException(DailyLimitExceededException::class);
        $service->transfer($user, $from, $to, 301, null, 'over-limit');
    }

    public function test_transfer_ledger_rows_remain_immutable(): void
    {
        $user = User::factory()->create();
        $from = $this->fundedAccount($user, 3000);
        $to = $this->fundedAccount($user, 0);
        $transfer = app(LedgerService::class)->transfer($user, $from, $to, 100, null, null);
        $ledgerRow = Transaction::query()->where('transfer_id', $transfer->getKey())->firstOrFail();

        $this->expectException(LogicException::class);
        $ledgerRow->update(['description' => 'Attempted rewrite']);
    }

    public function test_fifty_random_transfers_reconcile(): void
    {
        $this->seed(DatabaseSeeder::class);
        $accounts = Account::query()->where('type', AccountType::Checking)->with('user')->get();
        $service = app(LedgerService::class);

        for ($index = 0; $index < 50; $index++) {
            $from = $accounts->random();
            $to = $accounts->where('id', '!=', $from->id)->random();

            $service->transfer(
                $from->user,
                $from,
                $to,
                random_int(100, 1000),
                null,
                (string) Str::ulid(),
            );
        }

        $this->artisan('bank:reconcile')
            ->expectsOutputToContain('Bank reconciliation passed')
            ->assertExitCode(0);
    }

    public function test_failure_after_debit_insert_rolls_back_the_whole_transfer(): void
    {
        $user = User::factory()->create();
        $from = $this->fundedAccount($user, 3000);
        $to = $this->fundedAccount($user, 500);
        $originalTransactions = Transaction::query()->count();

        DB::unprepared("CREATE TRIGGER fail_credit_insert BEFORE INSERT ON transactions WHEN NEW.direction = 'credit' BEGIN SELECT RAISE(ABORT, 'injected credit failure'); END");

        try {
            app(LedgerService::class)->transfer($user, $from, $to, 1000, null, 'rollback-key');
            $this->fail('Expected the injected credit insertion failure.');
        } catch (QueryException) {
            $from->refresh();
            $to->refresh();
            $this->assertSame(3000, $from->balance_cents);
            $this->assertSame(500, $to->balance_cents);
            $this->assertSame($originalTransactions, Transaction::query()->count());
            $this->assertDatabaseCount('transfers', 0);
            $this->assertDatabaseCount('audit_logs', 0);
        }
    }

    public function test_bank_exceptions_render_as_422_json_with_machine_code(): void
    {
        Route::get('/api/v1/test-insufficient-funds', static function () {
            throw new InsufficientFundsException;
        });

        $this->get('/api/v1/test-insufficient-funds')
            ->assertUnprocessable()
            ->assertExactJson([
                'message' => 'The source account has insufficient funds.',
                'code' => 'insufficient_funds',
            ]);
    }

    private function fundedAccount(User $user, int $balanceCents, AccountStatus $status = AccountStatus::Active): Account
    {
        $account = Account::factory()->for($user)->create(['status' => $status]);

        if ($balanceCents === 0) {
            return $account;
        }

        $postedAt = now();
        Transaction::create([
            'account_id' => $account->id,
            'direction' => TransactionDirection::Credit,
            'amount_cents' => $balanceCents,
            'balance_after_cents' => $balanceCents,
            'category' => TransactionCategory::Deposit,
            'description' => 'Test account funding',
            'reference' => (string) Str::ulid(),
            'posted_at' => $postedAt,
            'created_at' => $postedAt,
        ]);

        $account->balance_cents = $balanceCents;
        $account->save();

        return $account;
    }
}
