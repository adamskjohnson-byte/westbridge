<?php

namespace App\Services;

use App\Enums\AccountStatus;
use App\Enums\AccountType;
use App\Enums\UserStatus;
use App\Enums\UserRole;
use App\Exceptions\Auth\AccountSuspendedException;
use App\Models\Account;
use App\Models\AuditLog;
use App\Models\User;
use App\Notifications\WelcomeNotification;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use App\Services\TwoFactorService;

class AuthService
{
    public function __construct(
        private readonly AccountNumberGenerator $accountNumberGenerator,
        private readonly LedgerService $ledgerService,
    ) {}

    public function register(array $attributes, Request $request): User
    {
        $requireEmailVerification = (bool) config('bank.auth.require_email_verification', true);
        $user = DB::transaction(function () use ($attributes, $request, $requireEmailVerification): User {
            $user = new User([
                'first_name' => $attributes['first_name'],
                'last_name' => $attributes['last_name'],
                'email' => $attributes['email'],
                'password' => $attributes['password'],
                'role' => UserRole::Customer,
                'status' => UserStatus::Active,
            ]);
            $user->email_verified_at = $requireEmailVerification ? null : now();
            $user->save();

            $checking = Account::create([
                'user_id' => $user->getKey(),
                'account_number' => $this->accountNumberGenerator->generate(),
                'type' => AccountType::Checking,
                'nickname' => 'Everyday checking',
                'currency' => config('bank.default_currency', 'USD'),
                'status' => AccountStatus::Active,
                'opened_at' => now(),
            ]);

            Account::create([
                'user_id' => $user->getKey(),
                'account_number' => $this->accountNumberGenerator->generate(),
                'type' => AccountType::Savings,
                'nickname' => 'Savings',
                'currency' => config('bank.default_currency', 'USD'),
                'status' => AccountStatus::Active,
                'opened_at' => now(),
            ]);

            $this->ledgerService->deposit(
                $checking,
                (int) config('bank.welcome_bonus_cents', 100000),
                'Westbridge welcome bonus',
            );

            $this->writeAudit($user, 'auth.registered', $request);

            return $user;
        }, 3);

        $user->notify(new WelcomeNotification);
        if ($requireEmailVerification) {
            event(new Registered($user));
        }
        Auth::guard('web')->login($user);

        // Regenerate the session ID after authentication to prevent session fixation.
        $request->session()->regenerate();

        return $user;
    }

    public function login(string $email, string $password, bool $remember, Request $request): User|array
    {
        $email = strtolower(trim($email));
        $emailHash = hash('sha256', $email);

        $result = DB::transaction(function () use ($email, $password, $remember, $request, $emailHash): array {
            $user = User::query()->where('email', $email)->first();

            // Audit login attempts without storing the submitted email or password in failure records.
            $dummyHash = '$2y$12$'.str_repeat('A', 53);
            if ($user === null) {
                Hash::check($password, $dummyHash);
                $this->writeFailedLoginAudit(null, $request, $emailHash);

                return ['failure' => 'credentials'];
            }
            if (! Hash::check($password, $user->password)) {
                $this->writeFailedLoginAudit($user, $request, $emailHash);

                return ['failure' => 'credentials'];
            }

            if ($user->status !== UserStatus::Active) {
                $this->writeFailedLoginAudit($user, $request, $emailHash);

                return ['failure' => 'suspended'];
            }

            return ['user' => $user, 'remember' => $remember];
        }, 3);

        if (($result['failure'] ?? null) === 'suspended') {
            throw new AccountSuspendedException;
        }

        if (isset($result['failure'])) {
            throw ValidationException::withMessages([
                'email' => ['validation.credentials_invalid'],
            ]);
        }

        /** @var User $user */
        $user = $result['user'];
        if (app(TwoFactorService::class)->requiredFor($user)) {
            return app(TwoFactorService::class)->start($user, 'login', $request);
        }
        Auth::guard('web')->login($user, $remember);
        $user->forceFill(['last_login_at' => now()])->save();

        // Regenerate the session ID after authentication to prevent session fixation.
        $request->session()->regenerate();
        $this->writeAudit($user, 'auth.login_success', $request);

        return $user;
    }

    public function logout(User $user, Request $request): void
    {
        $this->writeAudit($user, 'auth.logout', $request);
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
    }

    private function writeFailedLoginAudit(?User $user, Request $request, string $emailHash): void
    {
        AuditLog::create([
            'user_id' => $user?->getKey(),
            'action' => 'login_failed',
            'entity_type' => 'user',
            'entity_id' => $user === null ? null : (string) $user->getKey(),
            'ip_address' => $request->ip(),
            'user_agent' => mb_substr((string) $request->userAgent(), 0, 255),
            'metadata' => ['email_sha256' => $emailHash],
            'created_at' => now(),
        ]);
    }

    private function writeAudit(User $user, string $action, Request $request): void
    {
        AuditLog::create([
            'user_id' => $user->getKey(),
            'action' => $action,
            'entity_type' => 'user',
            'entity_id' => (string) $user->getKey(),
            'ip_address' => $request->ip(),
            'user_agent' => mb_substr((string) $request->userAgent(), 0, 255),
            'metadata' => null,
            'created_at' => now(),
        ]);
    }
}
