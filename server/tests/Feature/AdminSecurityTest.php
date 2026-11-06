<?php

namespace Tests\Feature;

use App\Enums\AccountStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Account;
use App\Models\AuditLog;
use App\Models\SupportTicket;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class AdminSecurityTest extends TestCase
{
    use RefreshDatabase;

    public function test_every_registered_admin_route_requires_auth_verified_active_admin(): void
    {
        $admin = User::factory()->admin()->create();
        $suspendedAdmin = User::factory()->admin()->suspended()->create();
        $unverifiedAdmin = User::factory()->admin()->unverified()->create();
        $customer = User::factory()->create();
        $account = Account::factory()->for($customer)->create();
        $ticket = SupportTicket::factory()->create(['user_id' => $customer->id]);
        $routes = collect(Route::getRoutes()->getRoutes())->filter(fn ($route) => str_starts_with($route->uri(), 'api/v1/admin'));
        $this->assertNotEmpty($routes, 'Expected admin API routes to be registered.');

        foreach ($routes as $route) {
            $uri = str_replace(['{user}', '{account}', '{ticket}'], [(string) $customer->id, (string) $account->id, (string) $ticket->id], '/'.$route->uri());
            $method = collect($route->methods())->first(fn ($method) => ! in_array($method, ['HEAD', 'OPTIONS'], true));
            $payload = $this->payloadFor($uri);
            $this->actingAsGuest('web')->actingAsGuest('sanctum');
            $unauthenticated = $this->sendRouteRequest($method, $uri, $payload);
            $this->assertSame(401, $unauthenticated->status(), 'Unauthenticated admin route must return 401: '.$method.' '.$uri.' '.$unauthenticated->getContent());
            $this->actingAs($customer, 'web');
            $this->sendRouteRequest($method, $uri, $payload)->assertForbidden();
            $this->actingAs($suspendedAdmin, 'web');
            $this->sendRouteRequest($method, $uri, $payload)->assertForbidden();
            $this->actingAs($unverifiedAdmin, 'web');
            if (config('bank.auth.require_email_verification')) {
                $this->sendRouteRequest($method, $uri, $payload)->assertForbidden();
            }
            $this->actingAs($admin, 'web');
        }
    }

    public function test_user_and_account_admin_writes_require_password_reason_and_preserve_ledger(): void
    {
        $admin = User::factory()->admin()->create(['password' => Hash::make('Password123!')]);
        $customer = User::factory()->create();
        $account = Account::factory()->for($customer)->create(['balance_cents' => 7500]);
        $this->seedTransaction($account, 7500);
        config(['session.driver' => 'database']);
        $this->app['session']->forgetDrivers();
        $customerLogin = $this->withHeaders(['Origin' => 'http://127.0.0.1:5173'])->postJson('/api/v1/auth/login', [
            'email' => $customer->email,
            'password' => 'Password123!',
        ])->assertOk();
        $customerSession = $this->sessionIdFromResponse($customerLogin);
        $this->withoutHeader('Origin')->withoutHeader('Referer');
        $this->actingAs($admin, 'web');
        $before = $this->ledgerSnapshot();

        $this->postJson('/api/v1/admin/users/'.$customer->id.'/suspend', ['reason' => 'short', 'password' => 'wrong'])
            ->assertUnprocessable()->assertJsonPath('errors.reason.0', 'validation.reason_min');
        $this->postJson('/api/v1/admin/users/'.$customer->id.'/suspend', ['reason' => 'Valid review reason', 'password' => 'WrongPassword!'])
            ->assertUnprocessable()->assertJsonPath('errors.password.0', 'validation.current_password_invalid');
        $this->assertSame(UserStatus::Active, $customer->fresh()->status);
        $this->assertDatabaseHas('sessions', ['id' => $customerSession, 'user_id' => $customer->id]);
        $this->assertLedgerSnapshot($before);

        $payload = ['reason' => 'Confirmed suspicious activity', 'password' => 'Password123!'];
        $this->postJson('/api/v1/admin/users/'.$customer->id.'/suspend', $payload)->assertOk();
        $this->assertSame(UserStatus::Suspended, $customer->fresh()->status);
        $this->assertDatabaseMissing('sessions', ['id' => $customerSession]);
        $this->assertDatabaseHas('audit_logs', ['user_id' => $admin->id, 'action' => 'admin.user_suspended', 'entity_id' => (string) $customer->id]);
        $this->assertSame('Confirmed suspicious activity', AuditLog::query()->where('action', 'admin.user_suspended')->firstOrFail()->metadata['reason']);
        $this->assertLedgerSnapshot($before);
        $this->actingAsGuest('web')->actingAsGuest('sanctum')->withHeaders(['Origin' => 'http://127.0.0.1:5173'])
            ->withCookie(config('session.cookie'), $customerSession)->getJson('/api/v1/settings')->assertForbidden()->assertJsonPath('code', 'account_suspended');
        $this->actingAs($admin, 'web');
        $this->withHeaders(['Origin' => 'http://127.0.0.1:5173'])->postJson('/api/v1/auth/login', ['email' => $customer->email, 'password' => 'Password123!'])
            ->assertForbidden()->assertJsonPath('code', 'account_suspended');
        $this->app['auth']->forgetGuards();
        $this->actingAs($admin, 'web');
        $this->postJson('/api/v1/admin/users/'.$customer->id.'/suspend', $payload)->assertUnprocessable()->assertJsonPath('errors.user.0', 'validation.already_in_state');
        $this->postJson('/api/v1/admin/users/'.$customer->id.'/reactivate', $payload)->assertOk();
        $this->assertSame(UserStatus::Active, $customer->fresh()->status);
        $this->assertDatabaseHas('audit_logs', ['user_id' => $admin->id, 'action' => 'admin.user_reactivated', 'entity_id' => (string) $customer->id]);
        $this->actingAs($admin, 'web')->postJson('/api/v1/admin/accounts/'.$account->id.'/freeze', $payload)->assertOk();
        $this->assertSame(AccountStatus::Frozen, $account->fresh()->status);
        $this->assertDatabaseHas('audit_logs', ['user_id' => $admin->id, 'action' => 'admin.account_frozen', 'entity_id' => (string) $account->id]);
        $this->actingAs($admin, 'web')->postJson('/api/v1/admin/accounts/'.$account->id.'/unfreeze', $payload)->assertOk();
        $this->assertDatabaseHas('audit_logs', ['user_id' => $admin->id, 'action' => 'admin.account_unfrozen', 'entity_id' => (string) $account->id]);
        $this->assertLedgerSnapshot($before);
        $this->actingAsGuest('web')->actingAsGuest('sanctum')->withHeaders(['Origin' => 'http://127.0.0.1:5173'])
            ->withCookie(config('session.cookie'), (string) \Illuminate\Support\Str::random(40))
            ->postJson('/api/v1/auth/login', ['email' => $customer->email, 'password' => 'Password123!'])->assertOk();
    }

    public function test_admins_cannot_target_themselves_other_admins_or_closed_accounts(): void
    {
        $admin = User::factory()->admin()->create(['password' => Hash::make('Password123!')]);
        $otherAdmin = User::factory()->admin()->create();
        $ownAccount = Account::factory()->for($admin)->create();
        $adminAccount = Account::factory()->for($otherAdmin)->create();
        $customer = User::factory()->create();
        $closed = Account::factory()->for($customer)->create(['status' => AccountStatus::Closed]);
        $this->actingAs($admin, 'web');
        $payload = ['reason' => 'Administrative review', 'password' => 'Password123!'];
        foreach (['suspend', 'reactivate'] as $action) {
            $this->postJson('/api/v1/admin/users/'.$admin->id.'/'.$action, $payload)->assertUnprocessable()->assertJsonPath('errors.user.0', 'validation.cannot_modify_admin');
            $this->postJson('/api/v1/admin/users/'.$otherAdmin->id.'/'.$action, $payload)->assertUnprocessable()->assertJsonPath('errors.user.0', 'validation.cannot_modify_admin');
        }
        foreach ([$ownAccount, $adminAccount] as $protectedAccount) {
            foreach (['freeze', 'unfreeze'] as $action) {
                $this->postJson('/api/v1/admin/accounts/'.$protectedAccount->id.'/'.$action, $payload)->assertUnprocessable()->assertJsonPath('errors.account.0', 'validation.cannot_modify_admin');
            }
        }
        $this->postJson('/api/v1/admin/accounts/'.$closed->id.'/freeze', $payload)->assertUnprocessable()->assertJsonPath('errors.account.0', 'validation.account_closed');
    }

    public function test_admin_responses_redact_sensitive_fields_and_never_change_ledger(): void
    {
        $admin = User::factory()->admin()->create();
        $customer = User::factory()->create(['password' => Hash::make('CustomerSecret123!'), 'remember_token' => 'private-remember-token']);
        $account = Account::factory()->for($customer)->create(['account_number' => '1234567890', 'balance_cents' => 200]);
        $this->seedTransaction($account, 200);
        $ticket = SupportTicket::factory()->create(['user_id' => $customer->id]);
        AuditLog::create(['user_id' => $customer->id, 'action' => 'test.sensitive', 'entity_type' => 'user', 'entity_id' => (string) $customer->id, 'metadata' => ['account_number' => '1234567890', 'password' => 'secret', 'safe' => 'ok'], 'created_at' => now()]);
        $this->actingAs($admin, 'web');
        $before = $this->ledgerSnapshot();
        $json = json_encode([
            $this->getJson('/api/v1/admin/users/'.$customer->id)->assertOk()->json(),
            $this->getJson('/api/v1/admin/transactions')->assertOk()->json(),
            $this->getJson('/api/v1/admin/audit-logs')->assertOk()->json(),
        ], JSON_THROW_ON_ERROR);
        $this->assertStringNotContainsString('1234567890', $json);
        $this->assertStringNotContainsString('CustomerSecret123!', $json);
        $this->assertStringNotContainsString($customer->getRawOriginal('password'), $json);
        $this->assertStringNotContainsString('private-remember-token', $json);
        $this->assertStringNotContainsString('cvv', strtolower($json));
        $this->assertLedgerSnapshot($before);
    }

    public function test_admin_rate_limit_is_sixty_requests_per_minute(): void
    {
        $admin = User::factory()->admin()->create();
        $this->actingAs($admin, 'web');
        for ($index = 0; $index < 60; $index++) $this->getJson('/api/v1/admin/overview')->assertOk();
        $this->getJson('/api/v1/admin/overview')->assertTooManyRequests();
    }

    public function test_admin_commands_provision_and_demote_without_http_registration(): void
    {
        $this->withHeaders(['Origin' => 'http://127.0.0.1:5173'])->postJson('/api/v1/auth/register', [
            'first_name' => 'Blocked', 'last_name' => 'Admin', 'email' => 'http-admin@example.test',
            'password' => 'SecurePassword123!', 'password_confirmation' => 'SecurePassword123!', 'accept_terms' => true,
        ])->assertCreated()->assertJsonPath('data.role', 'customer');
        $this->artisan('admin:create', ['email' => 'weak-admin@example.test'])->expectsQuestion('First name', 'Weak')
            ->expectsQuestion('Last name', 'Password')->expectsQuestion('Password', 'password')->expectsQuestion('Confirm password', 'password')
            ->assertExitCode(1);
        $this->assertDatabaseMissing('users', ['email' => 'weak-admin@example.test']);
        $this->artisan('admin:create', ['email' => 'cli-admin@example.test'])->expectsQuestion('First name', 'Clio')
            ->expectsQuestion('Last name', 'River')->expectsQuestion('Password', 'StrongAdmin123!')->expectsQuestion('Confirm password', 'StrongAdmin123!')
            ->assertExitCode(0);
        $created = User::query()->where('email', 'cli-admin@example.test')->firstOrFail();
        $this->assertSame(UserRole::Admin, $created->role);
        $this->assertNotNull($created->email_verified_at);
        $this->assertDatabaseHas('audit_logs', ['action' => 'admin.created', 'entity_id' => (string) $created->id]);
        $this->artisan('admin:create', ['email' => 'cli-admin@example.test'])->expectsOutputToContain('already exists')->assertExitCode(1);
        $this->artisan('admin:demote', ['email' => $created->email])->expectsConfirmation('Demote cli-admin@example.test to customer and sign out all sessions?', 'yes')->assertExitCode(0);
        $this->assertSame(UserRole::Customer, $created->fresh()->role);
        $this->assertDatabaseHas('audit_logs', ['action' => 'admin.demoted', 'entity_id' => (string) $created->id]);
    }

    public function test_seeded_admin_is_not_created_outside_local_or_testing(): void
    {
        $previous = app()->environment();
        app()->instance('env', 'production');
        try {
            app(\Database\Seeders\DemoUsersSeeder::class)->run();
            $this->assertDatabaseMissing('users', ['email' => 'admin@westbridge.test']);
        } finally {
            app()->instance('env', $previous);
        }
    }

    private function sendRouteRequest(string $method, string $uri, array $payload): \Illuminate\Testing\TestResponse
    {
        return match ($method) {
            'GET' => $this->getJson($uri),
            'POST' => $this->postJson($uri, $payload),
            'PATCH' => $this->patchJson($uri, $payload),
            'PUT' => $this->putJson($uri, $payload),
            'DELETE' => $this->deleteJson($uri, $payload),
            default => $this->call($method, $uri),
        };
    }

    private function payloadFor(string $uri): array
    {
        return match (true) {
            str_contains($uri, '/messages') => ['type' => 'note', 'body' => 'test note', 'reason' => 'Security test reason', 'password' => 'Password123!'],
            str_contains($uri, '/suspend'), str_contains($uri, '/reactivate'), str_contains($uri, '/freeze'), str_contains($uri, '/unfreeze') => ['reason' => 'Security test reason', 'password' => 'Password123!'],
            str_contains($uri, '/tickets/') && str_contains($uri, 'tickets') => ['status' => 'closed', 'reason' => 'Security test reason', 'password' => 'Password123!'],
            default => [],
        };
    }

    private function seedTransaction(Account $account, int $balance): void
    {
        Transaction::create(['account_id' => $account->id, 'direction' => 'credit', 'amount_cents' => $balance, 'balance_after_cents' => $balance, 'category' => 'deposit', 'description' => 'Test balance', 'reference' => (string) \Illuminate\Support\Str::ulid(), 'posted_at' => now()]);
    }

    private function createSession(string $id, User $user): void
    {
        DB::table('sessions')->insert(['id' => $id, 'user_id' => $user->id, 'payload' => 'payload', 'last_activity' => now()->timestamp]);
    }

    private function sessionIdFromResponse(\Illuminate\Testing\TestResponse $response): string
    {
        $cookie = collect($response->headers->getCookies())->first(fn ($cookie): bool => $cookie->getName() === config('session.cookie'));
        $this->assertNotNull($cookie);
        return \Illuminate\Cookie\CookieValuePrefix::remove($this->app['encrypter']->decrypt($cookie->getValue(), false));
    }

    private function ledgerSnapshot(): array
    {
        return [Account::query()->orderBy('id')->pluck('balance_cents')->all(), Transaction::query()->count()];
    }

    private function assertLedgerSnapshot(array $before): void
    {
        $this->assertSame($before, $this->ledgerSnapshot());
    }
}
