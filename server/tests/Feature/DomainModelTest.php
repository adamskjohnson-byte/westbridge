<?php

namespace Tests\Feature;

use App\Enums\AccountStatus;
use App\Enums\AccountType;
use App\Enums\TransactionCategory;
use App\Enums\TransactionDirection;
use App\Enums\UserRole;
use App\Models\Account;
use App\Models\AuditLog;
use App\Models\Beneficiary;
use App\Models\Card;
use App\Models\SupportTicket;
use App\Models\Transaction;
use App\Models\Transfer;
use App\Models\User;
use App\Services\AccountNumberGenerator;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use LogicException;
use Tests\TestCase;

class DomainModelTest extends TestCase
{
    use RefreshDatabase;

    public function test_model_tests_use_an_isolated_test_database(): void
    {
        if (DB::connection()->getDriverName() === 'sqlite') {
            $this->assertSame(':memory:', DB::connection()->getDatabaseName());
            return;
        }

        $this->assertSame('mysql', DB::connection()->getDriverName());
        $this->assertSame('westbridge_e2e', DB::connection()->getDatabaseName());
    }

    public function test_user_account_and_ledger_relationships_and_enum_casts_work(): void
    {
        $user = User::factory()->create(['role' => UserRole::Admin]);
        $account = Account::factory()->for($user)->create(['type' => AccountType::Checking]);
        $transaction = Transaction::factory()->for($account)->create([
            'category' => TransactionCategory::Deposit,
        ]);

        $this->assertInstanceOf(User::class, $account->user);
        $this->assertInstanceOf(Account::class, $transaction->account);
        $this->assertTrue($user->accounts->contains($account));
        $this->assertSame(UserRole::Admin, $user->role);
        $this->assertSame(AccountType::Checking, $account->type);
        $this->assertSame(TransactionCategory::Deposit, $transaction->category);
        $this->assertTrue($account->isActive());
        $this->assertIsInt($account->balance_cents);
        $this->assertNotContains('balance_cents', $account->getFillable());
    }

    public function test_transfer_beneficiary_card_ticket_and_audit_relationships_work(): void
    {
        $user = User::factory()->create();
        $source = Account::factory()->for($user)->create();
        $destination = Account::factory()->for($user)->create();
        $transfer = Transfer::factory()->create([
            'initiated_by_user_id' => $user->id,
            'from_account_id' => $source->id,
            'to_account_id' => $destination->id,
        ]);
        $beneficiary = Beneficiary::factory()->for($user)->create();
        $card = Card::factory()->create(['user_id' => $user->id, 'account_id' => $source->id]);
        $ticket = SupportTicket::factory()->for($user)->create();
        $auditLog = AuditLog::factory()->for($user)->create();

        $this->assertSame($user->id, $transfer->initiatedBy->id);
        $this->assertSame($source->id, $transfer->fromAccount->id);
        $this->assertSame($destination->id, $transfer->toAccount->id);
        $this->assertSame($user->id, $beneficiary->user->id);
        $this->assertSame($source->id, $card->account->id);
        $this->assertSame($user->id, $ticket->user->id);
        $this->assertSame($user->id, $auditLog->user->id);
        $this->assertMatchesRegularExpression('/^[0-9A-HJKMNP-TV-Z]{26}$/i', $transfer->id);
        $this->assertFalse(Account::factory()->make(['status' => AccountStatus::Frozen])->isActive());
    }

    public function test_existing_ledger_transaction_cannot_be_saved(): void
    {
        $transaction = Transaction::factory()->create();
        $transaction->description = 'Edited ledger value';

        $this->expectException(LogicException::class);
        $transaction->save();
    }

    public function test_existing_ledger_transaction_cannot_be_updated(): void
    {
        $transaction = Transaction::factory()->create();

        $this->expectException(LogicException::class);
        $transaction->update(['description' => 'Edited ledger value']);
    }

    public function test_existing_ledger_transaction_cannot_be_deleted(): void
    {
        $transaction = Transaction::factory()->create();

        $this->expectException(LogicException::class);
        $transaction->delete();
    }

    public function test_account_number_generator_returns_unique_ten_digit_numbers(): void
    {
        $generator = app(AccountNumberGenerator::class);
        $firstNumber = $generator->generate();
        Account::factory()->create(['account_number' => $firstNumber]);

        $nextNumber = $generator->generate();

        $this->assertMatchesRegularExpression('/^[1-9][0-9]{9}$/', $firstNumber);
        $this->assertMatchesRegularExpression('/^[1-9][0-9]{9}$/', $nextNumber);
        $this->assertNotSame($firstNumber, $nextNumber);
    }

    public function test_demo_seed_data_keeps_each_checking_balance_in_sync_with_its_ledger(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->assertDatabaseCount('users', 6);
        $this->assertDatabaseCount('accounts', 10);
        $this->assertDatabaseCount('cards', 5);
        $this->assertDatabaseCount('beneficiaries', 5);

        foreach (Account::query()->where('type', AccountType::Checking)->get() as $account) {
            $balance = 0;
            $transactions = $account->transactions()->orderBy('posted_at')->get();

            $this->assertGreaterThan(20, $transactions->count());

            foreach ($transactions as $transaction) {
                $balance += $transaction->direction === TransactionDirection::Credit
                    ? $transaction->amount_cents
                    : -$transaction->amount_cents;

                $this->assertSame($balance, $transaction->balance_after_cents);
            }

            $this->assertSame($balance, $account->balance_cents);
        }
    }
}
