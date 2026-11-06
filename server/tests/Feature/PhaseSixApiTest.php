<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\User;
use App\Models\UserSetting;
use App\Notifications\TypedNotification;
use App\Services\InsightsService;
use App\Services\NotificationService;
use App\Services\SettingsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class PhaseSixApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_notifications_store_typed_params_and_are_owner_scoped(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $user->notify(new TypedNotification('card_purchase', ['amount_cents' => 1250, 'merchant' => 'Market', 'last4' => '1234']));
        $other->notify(new TypedNotification('welcome'));
        $id = $user->notifications()->firstOrFail()->id;
        $this->actingAs($user, 'web')->getJson('/api/v1/notifications')->assertOk()
            ->assertJsonPath('data.0.type', 'card_purchase')->assertJsonPath('data.0.params.amount_cents', 1250)
            ->assertJsonMissingPath('data.0.data');
        $this->getJson('/api/v1/notifications/unread-count')->assertOk()->assertJsonPath('data.count', 1);
        $this->postJson('/api/v1/notifications/'.$id.'/read')->assertOk();
        $this->postJson('/api/v1/notifications/read-all')->assertOk();
        $this->deleteJson('/api/v1/notifications/'.$other->notifications()->firstOrFail()->id)->assertNotFound();
        $this->deleteJson('/api/v1/notifications/'.$id)->assertNoContent();
    }

    public function test_settings_preferences_and_password_requirements_are_enforced(): void
    {
        $user = User::factory()->create(['password' => Hash::make('Password123!')]);
        $this->actingAs($user, 'web');
        $this->getJson('/api/v1/settings')->assertOk()
            ->assertJsonPath('data.preferences.theme', 'system')
            ->assertJsonPath('data.preferences.email_activity', true);
        $this->patchJson('/api/v1/settings/preferences', ['locale' => 'xx', 'theme' => 'neon'])
            ->assertUnprocessable()->assertJsonPath('errors.locale.0', 'validation.locale_invalid');
        $this->patchJson('/api/v1/settings/preferences', ['locale' => 'ar', 'theme' => 'dark', 'email_activity' => false])
            ->assertOk()->assertJsonPath('data.locale', 'ar')->assertJsonPath('data.theme', 'dark');
        $this->postJson('/api/v1/settings/password', ['current_password' => 'incorrect', 'password' => 'NewPassword123!', 'password_confirmation' => 'NewPassword123!'])
            ->assertUnprocessable()->assertJsonPath('errors.current_password.0', 'validation.current_password_invalid');
        $this->postJson('/api/v1/settings/password', ['current_password' => 'Password123!', 'password' => 'Password123!', 'password_confirmation' => 'Password123!'])
            ->assertUnprocessable()->assertJsonPath('errors.password.0', 'validation.password_unchanged');
    }

    public function test_insights_return_numeric_totals_and_zero_filled_month_days(): void
    {
        $user = User::factory()->create();
        Account::factory()->for($user)->create();
        $result = app(InsightsService::class)->forMonth($user, now('UTC')->format('Y-m'));
        $this->assertSame(0, $result['income_cents']);
        $this->assertSame(0, $result['spending_cents']);
        $this->assertNull($result['savings_rate']);
        $this->assertCount(now('UTC')->daysInMonth, $result['daily_spending']);
        $this->assertSame(0, $result['daily_spending'][0]['spending_cents']);
        $this->actingAs($user, 'web')->getJson('/api/v1/insights?month=2026-99')->assertUnprocessable();
    }

    public function test_low_balance_notification_only_occurs_once_until_recovery(): void
    {
        $user = User::factory()->create();
        UserSetting::create(['user_id' => $user->id, 'low_balance_threshold_cents' => 1000]);
        $account = Account::factory()->for($user)->create(['balance_cents' => 500]);
        app(NotificationService::class)->checkLowBalance($account);
        app(NotificationService::class)->checkLowBalance($account);
        $this->assertSame(1, $user->notifications()->where('data->type', 'low_balance')->count());
        $account->balance_cents = 1500;
        $account->save();
        app(NotificationService::class)->checkLowBalance($account);
        $account->balance_cents = 500;
        $account->save();
        app(NotificationService::class)->checkLowBalance($account);
        $this->assertSame(2, $user->notifications()->where('data->type', 'low_balance')->count());
    }
}