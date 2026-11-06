<?php

namespace Tests\Feature;

use App\Enums\CardStatus;
use App\Enums\TransactionCategory;
use App\Enums\TransactionDirection;
use Carbon\CarbonImmutable;
use App\Models\Account;
use App\Models\AuditLog;
use App\Models\Card;
use App\Models\Transaction;
use App\Models\User;
use App\Services\LedgerService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class CardsApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_card_listing_is_safe_and_foreign_cards_are_hidden(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $account = Account::factory()->for($user)->create();
        $card = Card::factory()->for($user)->for($account)->create(['last4' => '4321']);
        $foreign = Card::factory()->for($other)->create();

        $this->actingAs($user, 'web')->getJson('/api/v1/cards')->assertOk()
            ->assertJsonPath('data.0.last4', '4321')
            ->assertJsonMissingPath('data.0.number')
            ->assertJsonMissingPath('data.0.cvv')
            ->assertJsonMissingPath('data.0.pan');
        $this->patchJson('/api/v1/cards/'.$foreign->id, ['nickname' => 'No'])->assertNotFound();
        $this->postJson('/api/v1/cards/'.$foreign->id.'/freeze')->assertNotFound();
        $this->assertSame(CardStatus::Active, $card->fresh()->status);
    }

    public function test_issue_enforces_active_card_limit_and_cancelled_cards_do_not_count(): void
    {
        $user = User::factory()->create();
        $account = Account::factory()->for($user)->create();
        Card::factory()->count(3)->for($user)->for($account)->create();
        $this->actingAs($user, 'web');
        $this->postJson('/api/v1/cards', ['account_id' => $account->id])->assertUnprocessable()
            ->assertJsonPath('errors.card.0', 'validation.card_limit_reached');
        Card::query()->first()->update(['status' => CardStatus::Cancelled]);
        $this->postJson('/api/v1/cards', ['account_id' => $account->id, 'nickname' => 'Travel'])->assertCreated()
            ->assertJsonPath('data.nickname', 'Travel');
        $foreign = Account::factory()->create();
        $this->postJson('/api/v1/cards', ['account_id' => $foreign->id])->assertNotFound();
    }

    public function test_freeze_is_idempotent_cancel_is_permanent_and_purchases_audit_declines(): void
    {
        $user = User::factory()->create();
        $account = Account::factory()->for($user)->create();
        $card = Card::factory()->for($user)->for($account)->create();
        $this->actingAs($user, 'web');
        $this->postJson('/api/v1/cards/'.$card->id.'/freeze')->assertOk()->assertJsonPath('data.status', 'frozen');
        $this->postJson('/api/v1/cards/'.$card->id.'/freeze')->assertOk()->assertJsonPath('data.status', 'frozen');
        $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/cards/'.$card->id.'/test-purchase', ['merchant' => 'Market', 'amount_cents' => 100])
            ->assertUnprocessable()->assertJsonPath('code', 'card_frozen');
        $this->assertDatabaseCount('transactions', 0);
        $this->assertDatabaseHas('audit_logs', ['action' => 'card_purchase.declined', 'entity_id' => (string) $card->id]);
        $this->postJson('/api/v1/cards/'.$card->id.'/unfreeze')->assertOk()->assertJsonPath('data.status', 'active');
        $this->postJson('/api/v1/cards/'.$card->id.'/cancel', ['confirm' => true])->assertOk()->assertJsonPath('data.status', 'cancelled');
        $this->postJson('/api/v1/cards/'.$card->id.'/unfreeze')->assertUnprocessable()->assertJsonPath('code', 'card_cancelled');
    }

    public function test_purchase_is_idempotent_card_linked_and_reconciles(): void
    {
        $user = User::factory()->create();
        $account = Account::factory()->for($user)->create();
        app(LedgerService::class)->deposit($account, 5000, 'Test funding');
        $card = Card::factory()->for($user)->for($account)->create(['daily_limit_cents' => 5000]);
        $key = (string) Str::uuid();
        $payload = ['merchant' => "Store\nMarket", 'amount_cents' => 1200];
        $this->actingAs($user, 'web')->withHeader('Idempotency-Key', $key)
            ->postJson('/api/v1/cards/'.$card->id.'/test-purchase', $payload)->assertOk()
            ->assertJsonPath('data.status', 'approved')->assertJsonPath('data.balance_after_cents', 3800);
        $this->postJson('/api/v1/cards/'.$card->id.'/test-purchase', $payload)->assertOk()
            ->assertJsonPath('data.replayed', true)->assertJsonPath('data.balance_after_cents', 3800);
        $this->postJson('/api/v1/cards/'.$card->id.'/test-purchase', ['merchant' => 'Another store', 'amount_cents' => 1200])
            ->assertStatus(409)->assertJsonPath('code', 'idempotency_key_reused');
        $this->assertSame(3800, $account->fresh()->balance_cents);
        $this->assertDatabaseCount('transactions', 2);
        $this->assertDatabaseHas('transactions', ['card_id' => $card->id, 'category' => TransactionCategory::Card->value, 'direction' => TransactionDirection::Debit->value, 'amount_cents' => 1200]);
        $this->assertDatabaseCount('audit_logs', 2);
        $this->artisan('bank:reconcile')->assertExitCode(0);
    }

    public function test_card_daily_limit_is_utc_day_scoped_and_independent_per_card(): void
    {
        CarbonImmutable::setTestNow('2026-11-03T00:10:00Z');
        try {
            $user = User::factory()->create();
            $account = Account::factory()->for($user)->create();
            app(LedgerService::class)->deposit($account, 20000, 'Test funding');
            $card = Card::factory()->for($user)->for($account)->create(['daily_limit_cents' => 1000]);
            $otherCard = Card::factory()->for($user)->for($account)->create(['daily_limit_cents' => 1000]);
            $this->actingAs($user, 'web');
            $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/cards/'.$card->id.'/test-purchase', ['merchant' => 'One', 'amount_cents' => 700])->assertOk();
            $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/cards/'.$card->id.'/test-purchase', ['merchant' => 'Two', 'amount_cents' => 400])->assertUnprocessable()->assertJsonPath('code', 'card_limit_exceeded');
            $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/cards/'.$otherCard->id.'/test-purchase', ['merchant' => 'Other card', 'amount_cents' => 700])->assertOk();
            CarbonImmutable::setTestNow('2026-11-04T00:00:00Z');
            $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/cards/'.$card->id.'/test-purchase', ['merchant' => 'New day', 'amount_cents' => 700])->assertOk();
        } finally {
            CarbonImmutable::setTestNow();
        }
    }
}