<?php

namespace Tests\Feature;

use App\Models\LoginChallenge;
use App\Models\User;
use App\Models\UserSetting;
use App\Mail\TwoFactorCodeMail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class TwoFactorTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['security.two_factor.admin_required' => false]);
        Mail::fake();
    }

    private function loginChallenge(User $user): array
    {
        $response = $this->withHeaders(['Origin' => 'http://127.0.0.1:5173'])->postJson('/api/v1/auth/login', [
            'email' => $user->email, 'password' => 'Password123!',
        ])->assertAccepted()->assertJsonPath('code', 'two_factor_required');
        $mail = Mail::sent(TwoFactorCodeMail::class)->last();
        return [$response->json('data.challenge_id'), $mail->code];
    }

    public function test_enabled_user_gets_202_without_session_then_verifies_once(): void
    {
        $user = User::factory()->create(['two_factor_enabled_at' => now()]);
        [$challengeId, $code] = $this->loginChallenge($user);
        $this->getJson('/api/v1/auth/me')->assertUnauthorized();
        $challenge = LoginChallenge::query()->findOrFail($challengeId);
        $this->assertSame($challenge->created_at->addMinutes(10)->getTimestamp(), $challenge->expires_at->getTimestamp());
        $this->assertNotSame($code, $challenge->code_hash);
        $this->assertSame(hash_hmac('sha256', $code, config('app.key').$challengeId), $challenge->code_hash);

        $this->postJson('/api/v1/auth/two-factor/verify', ['challenge_id' => $challengeId, 'code' => $code])
            ->assertOk()->assertJsonPath('data.id', $user->id)->assertJsonPath('data.two_factor_enabled', true);
        $this->assertNotNull($user->fresh()->last_login_at);
        $this->assertNotNull($challenge->fresh()->consumed_at);
        $this->getJson('/api/v1/auth/me')->assertOk();
        $this->postJson('/api/v1/auth/two-factor/verify', ['challenge_id' => $challengeId, 'code' => $code])
            ->assertUnprocessable()->assertJsonPath('errors.challenge_id.0', 'validation.two_factor_expired');
    }

    public function test_admin_requires_two_factor_when_flag_enabled(): void
    {
        config(['security.two_factor.admin_required' => true]);
        $admin = User::factory()->admin()->create();
        $this->loginChallenge($admin);
    }

    public function test_wrong_code_increments_attempts_and_locks_at_limit(): void
    {
        $user = User::factory()->create(['two_factor_enabled_at' => now()]);
        [$challengeId] = $this->loginChallenge($user);
        for ($attempt = 1; $attempt < 5; $attempt++) {
            $this->postJson('/api/v1/auth/two-factor/verify', ['challenge_id' => $challengeId, 'code' => '111111'])
                ->assertUnprocessable()->assertJsonPath('errors.code.0', 'validation.two_factor_code_invalid');
        }
        $this->postJson('/api/v1/auth/two-factor/verify', ['challenge_id' => $challengeId, 'code' => '111111'])
            ->assertUnprocessable()->assertJsonPath('errors.code.0', 'validation.two_factor_locked');
        $this->assertSame(5, LoginChallenge::query()->findOrFail($challengeId)->attempts);
    }

    public function test_expired_and_other_users_challenges_have_the_same_expired_shape(): void
    {
        $user = User::factory()->create(['two_factor_enabled_at' => now()]);
        [$challengeId, $code] = $this->loginChallenge($user);
        $this->travel(11)->minutes();
        $expired = $this->postJson('/api/v1/auth/two-factor/verify', ['challenge_id' => $challengeId, 'code' => $code])->assertUnprocessable();
        $this->travelBack();

        $other = User::factory()->create();
        UserSetting::create(['user_id' => $other->id, 'email_activity' => true]);
        $otherResponse = $this->actingAs($other, 'web')->postJson('/api/v1/settings/security/two-factor/confirm', ['challenge_id' => $challengeId, 'code' => $code])->assertUnprocessable();
        $this->assertSame($expired->json('errors'), $otherResponse->json('errors'));
    }

    public function test_resend_cooldown_and_settings_enable_disable_flow(): void
    {
        $user = User::factory()->create(['password' => Hash::make('Password123!')]);
        [$challengeId] = $this->loginChallenge(User::factory()->create(['two_factor_enabled_at' => now()]));
        $this->postJson('/api/v1/auth/two-factor/resend', ['challenge_id' => $challengeId])->assertStatus(429)->assertHeader('Retry-After');

        $this->actingAs($user, 'web')->getJson('/api/v1/settings')->assertOk()->assertJsonPath('data.security.two_factor_enabled', false);
        $started = $this->postJson('/api/v1/settings/security/two-factor/start', ['purpose' => 'enable', 'password' => 'Password123!'])->assertOk();
        $settingsChallenge = $started->json('data.challenge_id');
        $code = Mail::sent(TwoFactorCodeMail::class)->last()->code;
        $this->postJson('/api/v1/settings/security/two-factor/confirm', ['challenge_id' => $settingsChallenge, 'code' => $code])->assertOk()->assertJsonPath('data.two_factor_enabled', true);

        $this->travel(61)->seconds();
        $disable = $this->postJson('/api/v1/settings/security/two-factor/start', ['purpose' => 'disable', 'password' => 'Password123!'])->assertOk();
        $disableId = $disable->json('data.challenge_id');
        $disableCode = Mail::sent(TwoFactorCodeMail::class)->last()->code;
        $this->postJson('/api/v1/settings/security/two-factor/confirm', ['challenge_id' => $disableId, 'code' => $disableCode])->assertOk()->assertJsonPath('data.two_factor_enabled', false);
    }

    public function test_admin_cannot_disable_required_two_factor(): void
    {
        config(['security.two_factor.admin_required' => true]);
        $admin = User::factory()->admin()->create(['password' => Hash::make('Password123!'), 'two_factor_enabled_at' => now()]);
        $this->actingAs($admin, 'web')->postJson('/api/v1/settings/security/two-factor/start', ['purpose' => 'disable', 'password' => 'Password123!'])
            ->assertUnprocessable()->assertJsonPath('errors.purpose.0', 'validation.two_factor_required_for_role');
    }
}