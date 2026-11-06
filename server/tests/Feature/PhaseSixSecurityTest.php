<?php

namespace Tests\Feature;

use App\Enums\TransactionCategory;
use App\Enums\TransactionDirection;
use App\Models\Account;
use App\Models\AuditLog;
use App\Models\Card;
use App\Models\Transaction;
use App\Models\User;
use App\Models\UserSetting;
use App\Notifications\TypedNotification;
use App\Services\LedgerService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Tests\TestCase;
use Throwable;

class PhaseSixSecurityTest extends TestCase
{
    use RefreshDatabase;

    public function test_password_change_keeps_current_session_revokes_others_audits_and_notifies_by_mail(): void
    {
        Notification::fake();
        Mail::fake();

        $user = User::factory()->create(['password' => Hash::make('Password123!')]);
        UserSetting::create(['user_id' => $user->id, 'email_activity' => false]);
        $currentSession = $this->initializeSpaSession($user);
        $otherSession = 'password-other-'.$user->id;
        $this->createSession($currentSession, $user);
        $this->createSession($otherSession, $user);

        $this->actingAs($user, 'web')->postJson('/api/v1/settings/password', [
            'current_password' => 'Password123!',
            'password' => 'RenewedPass456',
            'password_confirmation' => 'RenewedPass456',
        ])->assertOk()->assertJsonPath('data.updated', true);

        $this->assertSame(1, DB::table('sessions')->where('user_id', $user->id)->count());
        $this->assertDatabaseHas('sessions', ['id' => $currentSession, 'user_id' => $user->id]);
        $this->assertDatabaseMissing('sessions', ['id' => $otherSession]);
        $this->assertTrue(Hash::check('RenewedPass456', $user->fresh()->password));
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $user->id,
            'action' => 'settings.password_changed',
        ]);
        Notification::assertSentTo($user, TypedNotification::class, fn (TypedNotification $notification, array $channels): bool => (
            $notification->type === 'password_changed' && $channels === ['database', 'mail']
        ));
    }

    public function test_password_change_rejects_wrong_current_and_unchanged_password_without_mutations(): void
    {
        Notification::fake();
        $user = User::factory()->create(['password' => Hash::make('Password123!')]);
        $sessionId = $this->initializeSpaSession($user);
        $this->createSession($sessionId, $user);
        $rememberToken = $user->remember_token;

        $this->actingAs($user, 'web')->postJson('/api/v1/settings/password', [
            'current_password' => 'WrongPassword123!',
            'password' => 'RenewedPass456',
            'password_confirmation' => 'RenewedPass456',
        ])->assertUnprocessable()->assertJsonPath('errors.current_password.0', 'validation.current_password_invalid');

        $this->postJson('/api/v1/settings/password', [
            'current_password' => 'Password123!',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
        ])->assertUnprocessable()->assertJsonPath('errors.password.0', 'validation.password_unchanged');

        $this->assertTrue(Hash::check('Password123!', $user->fresh()->password));
        $this->assertSame($rememberToken, $user->fresh()->remember_token);
        $this->assertDatabaseHas('sessions', ['id' => $sessionId, 'user_id' => $user->id]);
        $this->assertDatabaseMissing('audit_logs', ['user_id' => $user->id, 'action' => 'settings.password_changed']);
        Notification::assertNothingSent();
    }

    public function test_sessions_are_owner_scoped_mark_exactly_one_current_and_hide_raw_ids(): void
    {
        $user = User::factory()->create();
        $otherUser = User::factory()->create();
        $currentSession = $this->initializeSpaSession($user);
        $otherSession = 'list-other-'.$user->id;
        $foreignSession = 'list-foreign-'.$otherUser->id;
        $this->createSession($currentSession, $user);
        $this->createSession($otherSession, $user);
        $this->createSession($foreignSession, $otherUser);

        $response = $this->actingAs($user, 'web')->getJson('/api/v1/settings/sessions')->assertOk();
        $sessions = $response->json('data');

        $this->assertCount(2, $sessions);
        $this->assertSame(1, collect($sessions)->where('is_current', true)->count());
        $this->assertSame(1, collect($sessions)->where('is_current', false)->count());
        $this->assertNotContains($currentSession, $sessions);
        $this->assertNotContains($otherSession, $sessions);
        $this->assertNotContains($foreignSession, $sessions);
        $this->assertStringNotContainsString($currentSession, $response->getContent());
        $this->assertStringNotContainsString($otherSession, $response->getContent());
        $this->assertStringNotContainsString($foreignSession, $response->getContent());
    }

    public function test_session_revocation_audits_other_session_and_rejects_current_or_foreign_handles(): void
    {
        Notification::fake();
        $user = User::factory()->create();
        $otherUser = User::factory()->create();
        $currentSession = $this->initializeSpaSession($user);
        $otherSession = 'revoke-other-'.$user->id;
        $foreignSession = 'revoke-foreign-'.$otherUser->id;
        $this->createSession($currentSession, $user);
        $this->createSession($otherSession, $user);
        $this->createSession($foreignSession, $otherUser);

        $sessions = $this->actingAs($user, 'web')->getJson('/api/v1/settings/sessions')->assertOk()->json('data');
        $currentHandle = collect($sessions)->firstWhere('is_current', true)['id'];
        $otherHandle = collect($sessions)->firstWhere('is_current', false)['id'];
        $this->deleteJson('/api/v1/settings/sessions/'.$otherHandle)->assertOk()->assertJsonPath('data.revoked', true);
        $this->assertDatabaseMissing('sessions', ['id' => $otherSession]);
        $this->assertDatabaseHas('audit_logs', ['user_id' => $user->id, 'action' => 'settings.session_revoked']);

        $this->deleteJson('/api/v1/settings/sessions/'.$currentHandle)->assertUnprocessable()
            ->assertJsonPath('errors.session.0', 'validation.cannot_revoke_current');
        $foreignHandle = collect(app(\App\Services\SettingsService::class)->sessions($otherUser, 'not-a-session-id'))
            ->first()['id'];
        $this->actingAs($user, 'web')->deleteJson('/api/v1/settings/sessions/'.$foreignHandle)->assertNotFound();
        $this->assertDatabaseHas('sessions', ['id' => $foreignSession, 'user_id' => $otherUser->id]);
    }

    public function test_notification_email_channels_follow_security_and_activity_preferences(): void
    {
        Notification::fake();
        Mail::fake();
        $user = User::factory()->create();
        UserSetting::create(['user_id' => $user->id, 'email_activity' => true]);

        foreach (['password_changed', 'session_revoked', 'card_issued', 'card_cancelled'] as $type) {
            $user->notify(new TypedNotification($type));
        }
        foreach (['transfer_received', 'card_purchase', 'bill_paid'] as $type) {
            $user->notify(new TypedNotification($type));
        }
        foreach (['transfer_sent', 'card_frozen', 'card_unfrozen', 'welcome'] as $type) {
            $user->notify(new TypedNotification($type));
        }

        Notification::assertSentToTimes($user, TypedNotification::class, 11);
        foreach (['password_changed', 'session_revoked', 'card_issued', 'card_cancelled', 'transfer_received', 'card_purchase', 'bill_paid'] as $type) {
            Notification::assertSentTo($user, TypedNotification::class, fn (TypedNotification $notification, array $channels): bool => (
                $notification->type === $type && $channels === ['database', 'mail']
            ));
        }
        foreach (['transfer_sent', 'card_frozen', 'card_unfrozen', 'welcome'] as $type) {
            Notification::assertSentTo($user, TypedNotification::class, fn (TypedNotification $notification, array $channels): bool => (
                $notification->type === $type && $channels === ['database']
            ));
        }

        UserSetting::query()->where('user_id', $user->id)->update(['email_activity' => false]);
        $user->unsetRelation('settings');
        foreach (['transfer_received', 'card_purchase', 'bill_paid'] as $type) {
            $user->notify(new TypedNotification($type));
            Notification::assertSentTo($user, TypedNotification::class, fn (TypedNotification $notification, array $channels): bool => (
                $notification->type === $type && $channels === ['database']
            ));
        }
        $user->notify(new TypedNotification('password_changed'));
        Notification::assertSentTo($user, TypedNotification::class, fn (TypedNotification $notification, array $channels): bool => (
            $notification->type === 'password_changed' && $channels === ['database', 'mail']
        ));
    }

    public function test_rolled_back_card_purchase_does_not_create_notification(): void
    {
        Notification::fake();
        $user = User::factory()->create();
        $account = Account::factory()->for($user)->create(['balance_cents' => 5000]);
        $card = Card::factory()->for($user)->for($account)->create(['daily_limit_cents' => 5000]);
        $ledger = app(LedgerService::class);

        try {
            DB::transaction(function () use ($ledger, $user, $card): void {
                $ledger->cardPurchase($user, $card, 'Rollback Market', 1000, (string) Str::uuid(), hash('sha256', 'rollback purchase'));
                throw new \RuntimeException('Force rollback after ledger debit.');
            });
            $this->fail('The transaction should have been rolled back.');
        } catch (Throwable $exception) {
            $this->assertSame('Force rollback after ledger debit.', $exception->getMessage());
        }

        $this->assertSame(5000, $account->fresh()->balance_cents);
        $this->assertDatabaseCount('transactions', 0);
        $this->assertDatabaseCount('card_purchase_attempts', 0);
        Notification::assertNothingSent();
    }

    public function test_insights_match_ledger_expectations_and_exclude_own_account_transfers(): void
    {
        $user = User::factory()->create();
        $recipient = User::factory()->create();
        $source = Account::factory()->for($user)->create();
        $destination = Account::factory()->for($user)->create();
        $external = Account::factory()->for($recipient)->create();
        $ledger = app(LedgerService::class);
        $ledger->deposit($source, 5000, 'Test income');
        $ledger->transfer($user, $source, $destination, 3000, 'Own transfer', (string) Str::uuid(), 'own');
        $card = Card::factory()->for($user)->for($source)->create(['daily_limit_cents' => 5000]);
        $ledger->cardPurchase($user, $card, 'Test shop', 700, (string) Str::uuid(), hash('sha256', 'insights purchase'));
        $ledger->transfer($user, $source, $external, 1234, 'External transfer', (string) Str::uuid(), 'account_number');

        $ownTransferIds = DB::table('transfers')
            ->join('accounts as source_accounts', 'source_accounts.id', '=', 'transfers.from_account_id')
            ->join('accounts as destination_accounts', 'destination_accounts.id', '=', 'transfers.to_account_id')
            ->where('source_accounts.user_id', $user->id)
            ->where('destination_accounts.user_id', $user->id)
            ->pluck('transfers.id');
        $ledgerRows = Transaction::query()->whereIn('account_id', [$source->id, $destination->id])
            ->where(fn ($query) => $query->whereNull('transfer_id')->orWhereNotIn('transfer_id', $ownTransferIds))
            ->get();
        $expectedIncome = $ledgerRows->where('direction', TransactionDirection::Credit)->sum('amount_cents');
        $debits = $ledgerRows->where('direction', TransactionDirection::Debit);
        $expectedSpending = $debits->sum('amount_cents');
        $expectedCategories = $debits->groupBy(fn (Transaction $transaction): string => $transaction->category->value)
            ->map(fn ($rows): int => $rows->sum('amount_cents'))->all();
        arsort($expectedCategories, SORT_NUMERIC);

        $response = $this->actingAs($user, 'web')->getJson('/api/v1/insights?month='.now('UTC')->format('Y-m'))->assertOk();
        $this->assertSame($expectedIncome, $response->json('data.income_cents'));
        $this->assertSame($expectedSpending, $response->json('data.spending_cents'));
        $actualCategories = collect($response->json('data.by_category'))->mapWithKeys(fn (array $row): array => [$row['category'] => $row['spending_cents']])->all();
        $this->assertSame($expectedCategories, $actualCategories);
        $this->assertSame(5000, $expectedIncome);
        $this->assertSame(1934, $expectedSpending);
        $this->assertSame(['transfer' => 1234, 'card' => 700], $expectedCategories);
    }

    public function test_transfer_notifications_contain_only_masked_account_details_and_reference(): void
    {
        Mail::fake();
        $sender = User::factory()->create(['first_name' => 'Taylor', 'last_name' => 'Bennett']);
        $recipient = User::factory()->create(['first_name' => 'Casey', 'last_name' => 'River']);
        $source = Account::factory()->for($sender)->create(['account_number' => '1234567890', 'balance_cents' => 5000]);
        $destination = Account::factory()->for($recipient)->create(['account_number' => '9876543210']);

        $transfer = app(LedgerService::class)->transfer(
            $sender,
            $source,
            $destination,
            1000,
            'Secure params',
            (string) Str::uuid(),
            'account_number',
        );

        $senderNotification = $sender->notifications()->where('data->type', 'transfer_sent')->firstOrFail();
        $recipientNotification = $recipient->notifications()->where('data->type', 'transfer_received')->firstOrFail();
        $this->assertSame([
            'type' => 'transfer_sent',
            'params' => [
                'amount_cents' => 1000,
                'to_masked' => '•••• 3210',
                'reference' => $transfer->getKey(),
            ],
        ], $senderNotification->data);
        $this->assertSame([
            'type' => 'transfer_received',
            'params' => [
                'amount_cents' => 1000,
                'from_masked' => '•••• 7890',
                'reference' => $transfer->getKey(),
            ],
        ], $recipientNotification->data);
        $serializedParams = json_encode([
            $senderNotification->data,
            $recipientNotification->data,
        ], JSON_THROW_ON_ERROR);
        $this->assertStringNotContainsString($source->account_number, $serializedParams);
        $this->assertStringNotContainsString($destination->account_number, $serializedParams);
    }

    private function initializeSpaSession(User $user): string
    {
        $this->withHeaders(['Origin' => 'http://127.0.0.1:5173']);
        $this->withCredentials();
        $response = $this->actingAs($user, 'web')->getJson('/api/v1/settings/sessions')->assertOk();
        $cookie = collect($response->headers->getCookies())->first(
            fn ($candidate): bool => $candidate->getName() === config('session.cookie'),
        );
        $this->assertNotNull($cookie, 'A first-party session response should set the session cookie.');
        $sessionCookie = $this->app['encrypter']->decrypt($cookie->getValue(), false);
        $id = \Illuminate\Cookie\CookieValuePrefix::remove($sessionCookie);
        $this->withCookie(config('session.cookie'), $id);

        return $id;
    }

    private function createSession(string $id, User $user): void
    {
        DB::table('sessions')->insert([
            'id' => $id,
            'user_id' => $user->id,
            'ip_address' => '127.0.0.1',
            'user_agent' => 'Test Chrome Windows',
            'payload' => 'serialized-session',
            'last_activity' => now()->timestamp,
        ]);
    }
}
