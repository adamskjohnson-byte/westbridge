<?php

namespace Tests\Feature;

use App\Enums\AccountStatus;
use App\Enums\TransactionCategory;
use App\Enums\TransactionDirection;
use App\Models\Account;
use App\Models\AuditLog;
use App\Models\Beneficiary;
use App\Models\Transaction;
use App\Models\Transfer;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Tests\TestCase;

class MoneyMovementApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_account_number_lookup_is_masked_audited_and_unknown_matches_inactive(): void
    {
        $user = User::factory()->create();
        $recipient = User::factory()->create(['first_name' => 'Morgan', 'last_name' => 'Vale']);
        $account = Account::factory()->for($recipient)->create(['account_number' => '1234567890']);
        $inactive = Account::factory()->for(User::factory())->create(['account_number' => '1234567891', 'status' => AccountStatus::Frozen]);
        $this->actingAs($user, 'web');

        $this->postJson('/api/v1/transfers/lookup', ['account_number' => $account->account_number])
            ->assertOk()->assertJsonPath('data.holder_masked', 'M*** V***')->assertJsonMissing(['account_number' => $account->account_number]);
        $missing = $this->postJson('/api/v1/transfers/lookup', ['account_number' => '0000000000']);
        $inactiveResponse = $this->postJson('/api/v1/transfers/lookup', ['account_number' => $inactive->account_number]);
        $missing->assertNotFound()->assertJsonPath('code', 'recipient_not_found');
        $inactiveResponse->assertNotFound()->assertExactJson($missing->json());
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $user->id,
            'action' => 'recipient_lookup',
            'metadata' => json_encode(['account_number_hash' => hash('sha256', $account->account_number)]),
        ]);
        $this->assertDatabaseMissing('audit_logs', ['metadata' => $account->account_number]);
        $own = Account::factory()->for($user)->create();
        $this->postJson('/api/v1/transfers/lookup', ['account_number' => $own->account_number])
            ->assertNotFound()->assertJsonPath('code', 'recipient_not_found');
    }

    public function test_recipient_lookup_is_limited_to_ten_per_user_per_minute(): void
    {
        $user = User::factory()->create();
        $recipient = User::factory()->create();
        $account = Account::factory()->for($recipient)->create();
        RateLimiter::clear('recipient-lookup:user:'.$user->id);
        $this->actingAs($user, 'web');

        for ($index = 0; $index < 10; $index++) {
            $this->postJson('/api/v1/transfers/lookup', ['account_number' => $account->account_number])->assertOk();
        }
        $this->postJson('/api/v1/transfers/lookup', ['account_number' => $account->account_number])
            ->assertTooManyRequests()->assertJsonPath('code', 'too_many_requests');
        $this->assertDatabaseCount('audit_logs', 10);
    }

    public function test_recipients_are_derived_unique_limited_and_owner_scoped(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $recipient = User::factory()->create(['first_name' => 'Riley', 'last_name' => 'North']);
        $account = Account::factory()->for($recipient)->create(['account_number' => '1234509876']);
        $this->actingAs($user, 'web');

        $created = $this->postJson('/api/v1/beneficiaries', ['account_number' => $account->account_number, 'nickname' => 'Rent'])->assertCreated();
        $this->assertSame('Riley North', $created->json('data.name'));
        $this->assertSame('•••• 9876', $created->json('data.number_masked'));
        $this->postJson('/api/v1/beneficiaries', ['account_number' => $account->account_number])
            ->assertUnprocessable()->assertJsonPath('errors.account_number.0', 'validation.beneficiary_exists');
        $own = Account::factory()->for($user)->create(['account_number' => '1111222233']);
        $this->postJson('/api/v1/beneficiaries', ['account_number' => $own->account_number])
            ->assertUnprocessable()->assertJsonPath('errors.account_number.0', 'validation.beneficiary_self');

        $foreign = Beneficiary::factory()->for($other)->create();
        $this->deleteJson('/api/v1/beneficiaries/'.$foreign->id)->assertNotFound();
        $this->deleteJson('/api/v1/beneficiaries/'.$created->json('data.id'))->assertNoContent();

        for ($index = 0; $index < 50; $index++) {
            Beneficiary::factory()->for($user)->create(['account_number' => (string) (2000000000 + $index)]);
        }
        $extraAccount = Account::factory()->for(User::factory())->create(['account_number' => '9999912345']);
        $this->postJson('/api/v1/beneficiaries', ['account_number' => $extraAccount->account_number])
            ->assertUnprocessable()->assertJsonPath('errors.account_number.0', 'validation.beneficiary_limit');
    }

    public function test_external_transfer_idempotency_body_hash_and_party_visibility(): void
    {
        $sender = User::factory()->create();
        $recipient = User::factory()->create(['first_name' => 'Casey', 'last_name' => 'Lane']);
        $outsider = User::factory()->create();
        $from = $this->fundedAccount($sender, 10000);
        $to = Account::factory()->for($recipient)->create(['account_number' => '7777888899']);
        $payload = [
            'from_account_id' => $from->id,
            'to_type' => 'account_number',
            'account_number' => $to->account_number,
            'amount_cents' => 2500,
            'memo' => "Lunch\nshare",
        ];
        $key = (string) Str::uuid();

        $first = $this->actingAs($sender, 'web')->withHeader('Idempotency-Key', $key)
            ->postJson('/api/v1/transfers', $payload)->assertCreated();
        $first->assertJsonPath('data.to.type', 'account_number')
            ->assertJsonPath('data.to.holder_masked', 'C*** L***')
            ->assertJsonMissing(['account_number' => $to->account_number]);
        $this->postJson('/api/v1/transfers', $payload)->assertOk()->assertJsonPath('data.id', $first->json('data.id'));
        $changed = $payload;
        $changed['amount_cents'] = 2501;
        $this->postJson('/api/v1/transfers', $changed)->assertStatus(409)->assertJsonPath('code', 'idempotency_key_reused');

        $from->refresh();
        $to->refresh();
        $this->assertSame(7500, $from->balance_cents);
        $this->assertSame(2500, $to->balance_cents);
        $this->assertDatabaseCount('transactions', 3);
        $transferId = $first->json('data.id');
        $this->getJson('/api/v1/transfers/'.$transferId)->assertOk();
        $this->actingAs($recipient, 'web')->getJson('/api/v1/transfers/'.$transferId)->assertOk();
        $this->actingAs($outsider, 'sanctum')->getJson('/api/v1/transfers/'.$transferId)->assertNotFound();
        $this->assertDatabaseHas('audit_logs', ['action' => 'recipient_lookup', 'user_id' => $sender->id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'transfer.completed', 'user_id' => $sender->id]);
    }

    public function test_saved_beneficiary_transfer_uses_verified_holder_and_stored_recipient(): void
    {
        $sender = User::factory()->create();
        $recipient = User::factory()->create(['first_name' => 'Taylor', 'last_name' => 'Quill']);
        $from = $this->fundedAccount($sender, 3000);
        $to = Account::factory()->for($recipient)->create(['account_number' => '4400112233']);
        $beneficiary = Beneficiary::factory()->for($sender)->create([
            'name' => 'Taylor Quill',
            'nickname' => 'Rent',
            'account_number' => $to->account_number,
        ]);

        $response = $this->actingAs($sender, 'web')->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/transfers', [
                'from_account_id' => $from->id,
                'to_type' => 'beneficiary',
                'beneficiary_id' => $beneficiary->id,
                'amount_cents' => 1000,
            ])->assertCreated();
        $this->assertSame('beneficiary', $response->json('data.to.type'));
        $this->assertSame('T*** Q***', $response->json('data.to.holder_masked'));
        $this->assertSame(2000, $from->fresh()->balance_cents);
        $this->assertDatabaseHas('transactions', [
            'account_id' => $from->id,
            'direction' => 'debit',
            'counterparty_name' => 'Taylor Quill',
            'description' => 'Transfer to Taylor Quill',
        ]);
    }

    public function test_own_transfer_does_not_consume_limit_and_foreign_source_is_404(): void
    {
        config(['bank.daily_transfer_limit_cents' => 1000]);
        $user = User::factory()->create();
        $other = User::factory()->create();
        $from = $this->fundedAccount($user, 5000);
        $to = $this->fundedAccount($user, 0);
        $external = Account::factory()->for($other)->create();
        $key = (string) Str::uuid();

        $this->actingAs($user, 'web')->withHeader('Idempotency-Key', $key)
            ->postJson('/api/v1/transfers', [
                'from_account_id' => $from->id,
                'to_type' => 'own',
                'to_account_id' => $to->id,
                'amount_cents' => 900,
            ])->assertCreated();
        $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/transfers', [
                'from_account_id' => $from->id,
                'to_type' => 'account_number',
                'account_number' => $external->account_number,
                'amount_cents' => 1000,
            ])->assertCreated();
        $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/transfers', [
                'from_account_id' => $from->id,
                'to_type' => 'account_number',
                'account_number' => $external->account_number,
                'amount_cents' => 1,
            ])->assertUnprocessable()->assertJsonPath('code', 'daily_limit_exceeded');
        $this->actingAs($other, 'sanctum')->postJson('/api/v1/transfers', [
            'from_account_id' => $from->id,
            'to_type' => 'own',
            'to_account_id' => $external->id,
            'amount_cents' => 10,
        ])->assertNotFound();
        $this->actingAs($user, 'sanctum')->getJson('/api/v1/limits')
            ->assertOk()->assertJsonPath('data.used_today_cents', 1000)->assertJsonPath('data.remaining_cents', 0);
        $this->getJson('/api/v1/transfers/own')->assertOk()->assertJsonCount(2, 'data');
    }

    public function test_bill_payment_is_atomic_idempotent_and_counts_toward_daily_limit(): void
    {
        config(['bank.daily_transfer_limit_cents' => 1000]);
        $user = User::factory()->create();
        $recipient = User::factory()->create();
        $from = $this->fundedAccount($user, 5000);
        $destination = Account::factory()->for($recipient)->create();
        $payload = [
            'from_account_id' => $from->id,
            'biller_code' => 'north-electric',
            'reference_number' => 'NE12345678',
            'amount_cents' => 700,
        ];
        $key = (string) Str::uuid();
        $first = $this->actingAs($user, 'web')->withHeader('Idempotency-Key', $key)
            ->postJson('/api/v1/bill-payments', $payload)->assertCreated();
        $this->postJson('/api/v1/bill-payments', $payload)->assertOk()->assertJsonPath('data.id', $first->json('data.id'));
        $this->assertSame(4300, $from->fresh()->balance_cents);
        $this->assertDatabaseHas('transactions', [
            'id' => $first->json('data.transaction_id'),
            'category' => 'bill_payment',
            'direction' => 'debit',
            'amount_cents' => 700,
            'balance_after_cents' => 4300,
        ]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'bill_payment.completed', 'user_id' => $user->id]);

        $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/transfers', [
                'from_account_id' => $from->id,
                'to_type' => 'account_number',
                'account_number' => $destination->account_number,
                'amount_cents' => 301,
            ])->assertUnprocessable()->assertJsonPath('code', 'daily_limit_exceeded');
        $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/bill-payments', [...$payload, 'reference_number' => 'bad'])
            ->assertUnprocessable()->assertJsonPath('code', 'reference_invalid');
        $this->getJson('/api/v1/billers')->assertOk()->assertJsonCount(8, 'data');
        $this->getJson('/api/v1/bill-payments')->assertOk()->assertJsonPath('meta.total', 1);
        $this->artisan('bank:reconcile')->assertExitCode(0);
    }

    public function test_transfer_requires_uuid_and_sequential_debits_cannot_overdraw(): void
    {
        $user = User::factory()->create();
        $recipient = User::factory()->create();
        $from = $this->fundedAccount($user, 1000);
        $to = Account::factory()->for($recipient)->create();
        $payload = [
            'from_account_id' => $from->id,
            'to_type' => 'account_number',
            'account_number' => $to->account_number,
            'amount_cents' => 700,
        ];

        $this->actingAs($user, 'web')->postJson('/api/v1/transfers', $payload)
            ->assertUnprocessable()->assertJsonPath('errors.idempotency_key.0', 'validation.idempotency_key_required');
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/transfers', $payload)->assertCreated();
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/transfers', [...$payload, 'amount_cents' => 400])
            ->assertUnprocessable()->assertJsonPath('code', 'insufficient_funds');
        $this->assertSame(300, $from->fresh()->balance_cents);
        $this->assertSame(1, Transaction::query()->where('account_id', $from->id)->where('direction', 'debit')->count());
    }

    public function test_api_transfer_rejects_amount_bounds_status_and_currency_mismatch(): void
    {
        $user = User::factory()->create();
        $from = $this->fundedAccount($user, 20000000);
        $frozen = Account::factory()->for($user)->create(['status' => AccountStatus::Frozen]);
        $closed = Account::factory()->for($user)->create(['status' => AccountStatus::Closed]);
        $eur = Account::factory()->for($user)->create(['currency' => 'EUR']);
        $external = Account::factory()->for(User::factory())->create();
        $this->actingAs($user, 'web');

        foreach ([0, 10000001] as $amount) {
            $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/transfers', [
                'from_account_id' => $from->id,
                'to_type' => 'account_number',
                'account_number' => $external->account_number,
                'amount_cents' => $amount,
            ])->assertUnprocessable()->assertJsonPath('code', 'amount_invalid');
        }
        foreach ([[$frozen, 'account_frozen'], [$closed, 'account_closed'], [$eur, 'currency_mismatch']] as [$target, $code]) {
            $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/transfers', [
                'from_account_id' => $from->id,
                'to_type' => 'own',
                'to_account_id' => $target->id,
                'amount_cents' => 100,
            ])->assertUnprocessable()->assertJsonPath('code', $code);
        }
    }

    public function test_fifty_mixed_transfers_and_bill_payments_reconcile(): void
    {
        config(['bank.daily_transfer_limit_cents' => 10000000]);
        $sender = User::factory()->create();
        $recipient = User::factory()->create();
        $from = $this->fundedAccount($sender, 2000000);
        $to = Account::factory()->for($recipient)->create();
        $service = app(\App\Services\LedgerService::class);

        for ($index = 0; $index < 50; $index++) {
            if ($index % 2 === 0) {
                $service->transfer(
                    $sender,
                    $from,
                    $to,
                    1000,
                    null,
                    (string) Str::uuid(),
                    'account_number',
                    hash('sha256', (string) Str::uuid()),
                    $recipient->first_name.' '.$recipient->last_name,
                    '•••• '.substr($to->account_number, -4),
                    'R*** C***',
                );
            } else {
                $reference = 'NE'.str_pad((string) $index, 8, '0', STR_PAD_LEFT);
                $service->payBill(
                    $sender,
                    $from,
                    'north-electric',
                    $reference,
                    1000,
                    (string) Str::uuid(),
                    hash('sha256', $reference),
                );
            }
        }

        $this->artisan('bank:reconcile')->assertExitCode(0);
        $this->assertSame(1950000, $from->fresh()->balance_cents);
        $this->assertDatabaseCount('transfers', 25);
        $this->assertDatabaseCount('bill_payments', 25);
    }

    private function fundedAccount(User $user, int $balanceCents): Account
    {
        $account = Account::factory()->for($user)->create();
        if ($balanceCents > 0) {
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
        }

        return $account;
    }
}
