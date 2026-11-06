<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\User;
use App\Notifications\PasswordChangedNotification;
use App\Notifications\WelcomeNotification;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

class AuthSpaTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['bank.auth.require_email_verification' => true]);
    }

    private function spaHeaders(): array
    {
        return ['Origin' => 'http://127.0.0.1:5173'];
    }

    public function test_registration_creates_user_accounts_welcome_deposit_and_audit(): void
    {
        Notification::fake();

        $response = $this->withHeaders($this->spaHeaders())->postJson('/api/v1/auth/register', [
            'first_name' => 'Jamie',
            'last_name' => 'River',
            'email' => '  JAMIE@Example.Test ',
            'password' => 'SecurePass123',
            'password_confirmation' => 'SecurePass123',
            'accept_terms' => true,
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.email', 'jamie@example.test')
            ->assertJsonPath('data.role', 'customer')
            ->assertJsonPath('data.email_verified', false)
            ->assertJsonMissingPath('data.status')
            ->assertJsonMissingPath('data.password');
        $this->assertEqualsCanonicalizing(
            ['id', 'first_name', 'last_name', 'email', 'role', 'email_verified', 'two_factor_enabled', 'created_at'],
            array_keys($response->json('data')),
        );

        $sessionCookie = $response->getCookie(config('session.cookie'), false);
        $this->assertNotNull($sessionCookie);
        $this->assertTrue($sessionCookie->isHttpOnly());
        $this->assertSame('lax', $sessionCookie->getSameSite());
        $this->assertFalse($sessionCookie->isSecure());

        $user = User::query()->where('email', 'jamie@example.test')->firstOrFail();
        $checking = $user->accounts()->where('type', 'checking')->firstOrFail();
        $this->assertCount(2, $user->accounts);
        $this->assertSame(100000, $checking->balance_cents);
        $this->assertDatabaseHas('transactions', [
            'account_id' => $checking->id,
            'direction' => 'credit',
            'category' => 'deposit',
            'amount_cents' => 100000,
            'balance_after_cents' => 100000,
            'counterparty_name' => 'Westbridge Welcome Bonus',
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $user->id,
            'action' => 'auth.registered',
        ]);
        Notification::assertSentTo(
            $user,
            WelcomeNotification::class,
            fn (WelcomeNotification $notification, array $channels): bool => $channels === ['database'],
        );

        $this->artisan('bank:reconcile')->assertExitCode(0);
        Notification::assertSentTo($user, VerifyEmail::class);
        $this->assertCount(1, Notification::sent($user, VerifyEmail::class));
        $verificationMail = Notification::sent($user, VerifyEmail::class)->first()->toMail($user);
        $this->assertStringStartsWith(rtrim(config('services.frontend.url'), '/').'/verify-email?', $verificationMail->actionUrl);
        parse_str((string) parse_url($verificationMail->actionUrl, PHP_URL_QUERY), $verificationQuery);
        $this->assertSame((string) $user->id, $verificationQuery['id']);
        $this->assertSame(sha1($user->email), $verificationQuery['hash']);
        $this->assertArrayHasKey('signature', $verificationQuery);
        $this->assertArrayHasKey('expires', $verificationQuery);
        $renderedVerificationMail = Notification::sent($user, VerifyEmail::class)->first()->toMail($user)->render();
        $this->assertStringContainsString('Westbridge National Bank', $renderedVerificationMail);
        $this->assertStringContainsString('Demo only. Westbridge National Bank is not a real bank. No real money is held.', $renderedVerificationMail);
        $this->assertStringContainsString('#F8F1E7', file_get_contents(resource_path('views/vendor/mail/html/themes/default.css')));
        $this->assertStringContainsString('#6B1D2A', file_get_contents(resource_path('views/vendor/mail/html/themes/default.css')));
    }

    public function test_registration_skips_verification_notification_when_policy_is_disabled(): void
    {
        Notification::fake();
        config(['bank.auth.require_email_verification' => false]);

        $response = $this->withHeaders($this->spaHeaders())->postJson('/api/v1/auth/register', [
            'first_name' => 'Jamie',
            'last_name' => 'River',
            'email' => 'jamie@example.test',
            'password' => 'SecurePass123',
            'password_confirmation' => 'SecurePass123',
            'accept_terms' => true,
        ]);

        $response->assertCreated()->assertJsonPath('data.email_verified', true);
        Notification::assertSentTo(User::query()->where('email', 'jamie@example.test')->firstOrFail(), WelcomeNotification::class);
    }

    public function test_public_config_endpoint_reflects_email_verification_policy(): void
    {
        config(['bank.auth.require_email_verification' => true]);
        $this->getJson('/api/v1/config')->assertOk()->assertJsonPath('email_verification_required', true)->assertJsonStructure(['turnstile' => ['enabled', 'sitekey'], 'two_factor_admin_required']);

        config(['bank.auth.require_email_verification' => false]);
        $this->getJson('/api/v1/config')->assertOk()->assertJsonPath('email_verification_required', false);
    }

    public function test_registration_rejects_duplicate_email_case_insensitively(): void
    {
        User::factory()->create(['email' => 'case@example.test']);

        $this->withHeaders($this->spaHeaders())->postJson('/api/v1/auth/register', [
            'first_name' => 'Jamie',
            'last_name' => 'River',
            'email' => ' CASE@EXAMPLE.TEST ',
            'password' => 'SecurePass123',
            'password_confirmation' => 'SecurePass123',
            'accept_terms' => true,
        ])->assertUnprocessable()
            ->assertJsonPath('code', 'validation_failed')
            ->assertJsonPath('errors.email.0', 'validation.email_taken');
    }

    public function test_registration_rejects_weak_password_and_missing_terms(): void
    {
        $headers = $this->spaHeaders();
        $payload = [
            'first_name' => 'Jamie',
            'last_name' => 'River',
            'email' => 'jamie@example.test',
            'password' => 'weak',
            'password_confirmation' => 'weak',
        ];

        $response = $this->withHeaders($headers)->postJson('/api/v1/auth/register', $payload)
            ->assertUnprocessable()
            ->assertJsonPath('code', 'validation_failed')
            ->assertJsonPath('errors.password.0', 'validation.password_min')
            ->assertJsonPath('errors.accept_terms.0', 'validation.terms_required');
    }

    public function test_password_complexity_failures_use_stable_validation_keys(): void
    {
        foreach ([
            'securepass123' => 'validation.password_uppercase',
            'SECUREPASS123' => 'validation.password_lowercase',
            'SecurePassword' => 'validation.password_number',
        ] as $password => $errorKey) {
            $response = $this->withHeaders($this->spaHeaders())->postJson('/api/v1/auth/register', [
                'first_name' => 'Jamie',
                'last_name' => 'River',
                'email' => "{$errorKey}@example.test",
                'password' => $password,
                'password_confirmation' => $password,
                'accept_terms' => true,
            ]);

            $response->assertUnprocessable()->assertJsonPath('code', 'validation_failed');
            $this->assertContains($errorKey, $response->json('errors.password'));
        }
    }

    public function test_login_success_normalizes_email_and_writes_audit(): void
    {
        $user = User::factory()->create(['email' => 'customer@example.test']);

        $this->withHeaders($this->spaHeaders())->postJson('/api/v1/auth/login', [
            'email' => ' CUSTOMER@EXAMPLE.TEST ',
            'password' => 'Password123!',
        ])->assertOk()->assertJsonPath('data.id', $user->id);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $user->id,
            'action' => 'auth.login_success',
        ]);
    }

    public function test_wrong_password_and_unknown_email_return_identical_errors_and_hashed_audits(): void
    {
        User::factory()->create(['email' => 'known@example.test']);
        $payload = ['email' => 'known@example.test', 'password' => 'wrong-password'];

        $wrongPassword = $this->withHeaders($this->spaHeaders())->postJson('/api/v1/auth/login', $payload);
        $unknownEmail = $this->withHeaders($this->spaHeaders())->postJson('/api/v1/auth/login', [
            'email' => 'unknown@example.test',
            'password' => 'wrong-password',
        ]);

        $wrongPassword->assertUnprocessable()->assertJsonPath('errors.email.0', 'validation.credentials_invalid');
        $unknownEmail->assertUnprocessable()->assertJsonPath('errors.email.0', 'validation.credentials_invalid');
        $this->assertSame($wrongPassword->json('errors'), $unknownEmail->json('errors'));

        $this->assertSame(2, AuditLog::query()->where('action', 'login_failed')->count());
        $audit = AuditLog::query()->where('action', 'login_failed')->firstOrFail();
        $this->assertSame(hash('sha256', 'known@example.test'), $audit->metadata['email_sha256']);
        $this->assertStringNotContainsString('known@example.test', json_encode($audit->metadata));
    }

    public function test_suspended_user_cannot_login(): void
    {
        User::factory()->suspended()->create(['email' => 'paused@example.test']);

        $this->withHeaders($this->spaHeaders())->postJson('/api/v1/auth/login', [
            'email' => 'paused@example.test',
            'password' => 'Password123!',
        ])->assertForbidden()->assertJsonPath('code', 'account_suspended');

        $this->assertDatabaseHas('audit_logs', ['action' => 'login_failed']);
    }

    public function test_login_throttle_returns_429_after_five_attempts(): void
    {
        for ($attempt = 0; $attempt < 5; $attempt++) {
            $this->withHeaders($this->spaHeaders())->postJson('/api/v1/auth/login', [
                'email' => 'limit@example.test',
                'password' => 'wrong-password',
            ])->assertUnprocessable();
        }

        $this->withHeaders($this->spaHeaders())->postJson('/api/v1/auth/login', [
            'email' => 'limit@example.test',
            'password' => 'wrong-password',
        ])->assertTooManyRequests()->assertHeader('Retry-After');
    }

    public function test_logout_invalidates_session_and_me_returns_401_afterward(): void
    {
        $user = User::factory()->create();
        $login = $this->withHeaders($this->spaHeaders())->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'Password123!',
        ])->assertOk();
        $sessionCookie = $login->getCookie(config('session.cookie'), false);
        $this->assertNotNull($sessionCookie);

        $this->withCookie(config('session.cookie'), $sessionCookie->getValue())
            ->withHeaders($this->spaHeaders())
            ->getJson('/api/v1/auth/me')->assertOk()->assertJsonPath('data.id', $user->id);

        $this->withCookie(config('session.cookie'), $sessionCookie->getValue())
            ->withHeaders($this->spaHeaders())->postJson('/api/v1/auth/logout')->assertNoContent();
        Auth::forgetGuards();
        $this->withCookie(config('session.cookie'), $sessionCookie->getValue())
            ->withHeaders($this->spaHeaders())->getJson('/api/v1/auth/me')->assertUnauthorized();
        $this->assertDatabaseHas('audit_logs', ['user_id' => $user->id, 'action' => 'auth.logout']);
    }

    public function test_unverified_user_is_blocked_and_verified_user_passes(): void
    {
        $unverified = User::factory()->unverified()->create();
        $this->actingAs($unverified, 'web');
        $this->withHeaders($this->spaHeaders())->getJson('/api/v1/test/protected/me')
            ->assertForbidden()->assertJsonPath('code', 'email_not_verified');

        Auth::forgetGuards();
        $verified = User::factory()->create();
        $this->actingAs($verified, 'web');
        $this->withHeaders($this->spaHeaders())->getJson('/api/v1/test/protected/me')
            ->assertOk()->assertJsonPath('id', $verified->id);
    }

    public function test_verified_middleware_passes_unverified_user_when_policy_is_disabled(): void
    {
        config(['bank.auth.require_email_verification' => false]);
        $unverified = User::factory()->unverified()->create();

        $this->actingAs($unverified, 'web')->withHeaders($this->spaHeaders())
            ->getJson('/api/v1/test/protected/me')
            ->assertOk()->assertJsonPath('id', $unverified->id);
    }

    public function test_role_middleware_blocks_customer_from_admin_route(): void
    {
        $customer = User::factory()->create();
        $this->actingAs($customer, 'web');

        $this->withHeaders($this->spaHeaders())->getJson('/api/v1/test/protected/admin')
            ->assertForbidden()->assertJsonPath('code', 'role_forbidden');
    }

    public function test_active_middleware_logs_out_a_suspended_session(): void
    {
        $suspended = User::factory()->suspended()->create();
        $this->actingAs($suspended, 'web')->withHeaders($this->spaHeaders())
            ->getJson('/api/v1/test/protected/me')
            ->assertForbidden()->assertJsonPath('code', 'account_suspended');

        Auth::forgetGuards();
        $this->withHeaders($this->spaHeaders())->getJson('/api/v1/auth/me')->assertUnauthorized();
    }

    public function test_csrf_cookie_endpoint_is_available(): void
    {
        $response = $this->withHeaders($this->spaHeaders())
            ->get('/sanctum/csrf-cookie')
            ->assertNoContent();

        $response->assertCookie('XSRF-TOKEN', encrypted: false);
    }

    public function test_verification_link_verifies_without_login_and_is_idempotent(): void
    {
        Notification::fake();
        $user = User::factory()->unverified()->create();
        $url = URL::temporarySignedRoute('api.v1.auth.email.verify', now()->addMinutes(60), [
            'id' => $user->id,
            'hash' => sha1($user->email),
        ]);

        $this->withHeaders($this->spaHeaders())->get($url)->assertOk();
        $this->assertNotNull($user->fresh()->email_verified_at);
        $this->assertDatabaseHas('audit_logs', ['user_id' => $user->id, 'action' => 'auth.email_verified']);

        $this->withHeaders($this->spaHeaders())->get($url)->assertOk();
        $this->assertSame(1, AuditLog::query()->where('user_id', $user->id)->where('action', 'auth.email_verified')->count());
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $user->id,
            'action' => 'auth.email_verification_already_verified',
        ]);
    }

    public function test_tampered_wrong_hash_and_expired_verification_links_are_forbidden(): void
    {
        $user = User::factory()->unverified()->create();
        $validUrl = URL::temporarySignedRoute('api.v1.auth.email.verify', now()->addMinutes(60), [
            'id' => $user->id,
            'hash' => sha1($user->email),
        ]);
        $tamperedUrl = preg_replace('/signature=[^&]+/', 'signature=bad-signature', $validUrl);

        $this->withHeaders($this->spaHeaders())->get($tamperedUrl)->assertForbidden()->assertJsonPath('code', 'invalid_verification_link');

        $wrongHashUrl = URL::temporarySignedRoute('api.v1.auth.email.verify', now()->addMinutes(60), [
            'id' => $user->id,
            'hash' => sha1('other@example.test'),
        ]);
        $this->withHeaders($this->spaHeaders())->get($wrongHashUrl)->assertForbidden()->assertJsonPath('code', 'invalid_verification_link');

        $expiredUrl = URL::temporarySignedRoute('api.v1.auth.email.verify', now()->subMinute(), [
            'id' => $user->id,
            'hash' => sha1($user->email),
        ]);
        $this->withHeaders($this->spaHeaders())->get($expiredUrl)->assertForbidden()->assertJsonPath('code', 'invalid_verification_link');

        $this->assertSame(3, AuditLog::query()->where('action', 'auth.email_verification_failed')->count());
    }

    public function test_resend_verification_sends_once_and_returns_already_verified_for_verified_users(): void
    {
        Notification::fake();
        $user = User::factory()->unverified()->create();
        $this->actingAs($user, 'web')->withHeaders($this->spaHeaders())
            ->postJson('/api/v1/auth/email/resend')
            ->assertOk()->assertJsonPath('message', 'Verification link sent.');
        Notification::assertSentTo($user, VerifyEmail::class);

        Auth::forgetGuards();
        $verified = User::factory()->create();
        $this->actingAs($verified, 'web')->withHeaders($this->spaHeaders())
            ->postJson('/api/v1/auth/email/resend')
            ->assertOk()->assertJsonPath('message', 'Already verified.');

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $verified->id,
            'action' => 'auth.verification_resend_skipped',
        ]);
    }

    public function test_resend_verification_does_not_send_when_policy_is_disabled(): void
    {
        Notification::fake();
        config(['bank.auth.require_email_verification' => false]);
        $user = User::factory()->unverified()->create();

        $this->actingAs($user, 'web')->withHeaders($this->spaHeaders())
            ->postJson('/api/v1/auth/email/resend')
            ->assertOk()->assertJsonPath('message', 'Already verified.');

        Notification::assertNothingSent();
    }

    public function test_forgot_password_is_non_enumerating_and_sends_only_for_existing_users(): void
    {
        Notification::fake();
        $user = User::factory()->create(['email' => 'reset@example.test']);

        $existing = $this->withHeaders($this->spaHeaders())->postJson('/api/v1/auth/forgot-password', ['email' => $user->email]);
        $unknown = $this->withHeaders($this->spaHeaders())->postJson('/api/v1/auth/forgot-password', ['email' => 'absent@example.test']);

        $expected = [
            'code' => 'reset_link_sent_if_exists',
            'message' => 'If that email exists, a reset link is on its way.',
        ];
        $existing->assertOk()->assertExactJson($expected);
        $unknown->assertOk()->assertExactJson($expected);
        Notification::assertSentTo($user, ResetPassword::class);
        $this->assertCount(1, Notification::sent($user, ResetPassword::class));
    }

    public function test_valid_reset_rotates_password_token_revokes_sessions_and_notifies_user(): void
    {
        Notification::fake();
        Event::fake([PasswordReset::class]);
        $user = User::factory()->create(['email' => 'reset@example.test']);
        $this->postJson('/api/v1/auth/forgot-password', ['email' => $user->email])->assertOk();
        $resetNotification = Notification::sent($user, ResetPassword::class)->first();
        $this->assertNotNull($resetNotification);
        $resetMail = $resetNotification->toMail($user);
        $this->assertStringStartsWith(rtrim(config('services.frontend.url'), '/').'/reset-password?', $resetMail->actionUrl);
        parse_str((string) parse_url($resetMail->actionUrl, PHP_URL_QUERY), $resetQuery);
        $this->assertSame($resetNotification->token, $resetQuery['token']);
        $this->assertSame($user->email, $resetQuery['email']);
        $renderedResetMail = $resetMail->render();
        $this->assertStringContainsString('Westbridge National Bank', $renderedResetMail);
        $this->assertStringContainsString('Demo only. Westbridge National Bank is not a real bank. No real money is held.', $renderedResetMail);
        $oldRememberToken = $user->remember_token;
        DB::table('sessions')->insert([
            'id' => 'other-device-session',
            'user_id' => $user->id,
            'ip_address' => '127.0.0.1',
            'user_agent' => 'Other browser',
            'payload' => 'serialized-session',
            'last_activity' => now()->timestamp,
        ]);

        $this->withHeaders($this->spaHeaders())->postJson('/api/v1/auth/reset-password', [
            'token' => $resetNotification->token,
            'email' => strtoupper($user->email),
            'password' => 'RenewedPass456',
            'password_confirmation' => 'RenewedPass456',
        ])->assertOk();

        $user->refresh();
        $this->assertNotSame($oldRememberToken, $user->remember_token);
        $this->assertSame(0, DB::table('sessions')->where('user_id', $user->id)->count());
        $this->assertTrue(Hash::check('RenewedPass456', $user->password));
        $this->assertDatabaseHas('audit_logs', ['user_id' => $user->id, 'action' => 'auth.password_reset']);
        Notification::assertSentTo($user, PasswordChangedNotification::class);
        Event::assertDispatched(PasswordReset::class);

        $this->withHeaders($this->spaHeaders())->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'Password123!',
        ])->assertUnprocessable();

        $this->postJson('/api/v1/auth/reset-password', [
            'token' => $resetNotification->token,
            'email' => $user->email,
            'password' => 'AnotherPass789',
            'password_confirmation' => 'AnotherPass789',
        ])->assertUnprocessable()
            ->assertJsonPath('code', 'validation_failed')
            ->assertJsonPath('errors.email.0', 'validation.reset_token_invalid');

        $this->assertDatabaseHas('audit_logs', ['user_id' => $user->id, 'action' => 'auth.password_reset_failed']);
    }

    public function test_invalid_and_reused_reset_tokens_return_generic_422(): void
    {
        $user = User::factory()->create(['email' => 'reset@example.test']);
        $payload = [
            'token' => 'not-a-reset-token',
            'email' => $user->email,
            'password' => 'RenewedPass456',
            'password_confirmation' => 'RenewedPass456',
        ];

        $this->postJson('/api/v1/auth/reset-password', $payload)
            ->assertUnprocessable()
            ->assertExactJson([
                'code' => 'validation_failed',
                'message' => 'The given data was invalid.',
                'errors' => ['email' => ['validation.reset_token_invalid']],
            ]);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $user->id,
            'action' => 'auth.password_reset_failed',
            'metadata' => json_encode(['email_sha256' => hash('sha256', $user->email)]),
        ]);
    }
}
