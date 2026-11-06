<?php

namespace App\Services;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Mail\TwoFactorCodeMail;
use App\Models\AuditLog;
use App\Models\LoginChallenge;
use App\Models\User;
use App\Notifications\TypedNotification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;

class TwoFactorService
{
    public function requiredFor(User $user): bool
    {
        return $user->two_factor_enabled_at !== null
            || ($user->role === UserRole::Admin && (bool) config('security.two_factor.admin_required', true));
    }

    public function start(User $user, string $purpose, Request $request, bool $settingsAction = false): array
    {
        $code = $this->newCode();
        $challenge = DB::transaction(function () use ($user, $purpose, $request, $code, $settingsAction): LoginChallenge {
            $now = now();
            $expiresAt = $now->copy()->addMinutes((int) config('security.two_factor.ttl_minutes', 10));

            LoginChallenge::query()->where('user_id', $user->id)->whereNull('consumed_at')->update(['consumed_at' => $now]);
            $challenge = LoginChallenge::create([
                'user_id' => $user->id,
                'purpose' => $purpose,
                'code_hash' => $this->codeHash($code, ''),
                'attempts' => 0,
                'expires_at' => $expiresAt,
                'last_sent_at' => $now,
                'ip_address' => $request->ip(),
                'created_at' => $now,
            ]);
            $challenge->code_hash = $this->codeHash($code, (string) $challenge->id);
            $challenge->save();

            $this->audit($user, $settingsAction ? 'settings.two_factor_challenged' : 'login_2fa_challenged', $request);

            return $challenge;
        }, 3);

        Mail::to($user->email)->send(new TwoFactorCodeMail(
            $code,
            (int) config('security.two_factor.ttl_minutes', 10),
            (string) $request->ip(),
        ));

        return [
            'challenge_id' => (string) $challenge->id,
            'expires_in' => max(1, (int) config('security.two_factor.ttl_minutes', 10) * 60),
            'resend_available_in' => (int) config('security.two_factor.resend_cooldown_seconds', 60),
            'email_masked' => $this->maskEmail($user->email),
        ];
    }

    public function verifyLogin(string $challengeId, string $code, Request $request): User
    {
        $challenge = $this->verifiedChallenge($challengeId, $code, 'login');
        $user = $challenge->user;
        if ($user->status !== UserStatus::Active) {
            $this->expired();
        }

        DB::transaction(function () use ($challenge): void {
            $locked = LoginChallenge::query()->whereKey($challenge->id)->lockForUpdate()->firstOrFail();
            if ($locked->consumed_at !== null || $locked->expires_at->isPast()) $this->expired();
            $locked->consumed_at = now();
            $locked->save();
        }, 3);

        Auth::guard('web')->login($user);
        $user->forceFill(['last_login_at' => now()])->save();
        $request->session()->regenerate();
        $this->audit($user, 'login_2fa_verified', $request);

        return $user;
    }

    public function resend(string $challengeId, Request $request): array
    {
        $challenge = LoginChallenge::query()->with('user')->find($challengeId);
        if ($challenge === null || $challenge->consumed_at !== null || $challenge->expires_at->isPast()) $this->expired();
        $elapsed = now()->diffInSeconds($challenge->last_sent_at);
        $cooldown = (int) config('security.two_factor.resend_cooldown_seconds', 60);
        if ($elapsed < $cooldown) {
            $retry = max(1, $cooldown - $elapsed);
            return ['rate_limited' => true, 'retry_after' => $retry];
        }
        if ($challenge->resend_count >= (int) config('security.two_factor.max_resends', 3)) {
            $this->locked();
        }

        $code = $this->newCode();
        $challenge->forceFill([
            'code_hash' => $this->codeHash($code, (string) $challenge->id),
            'attempts' => 0,
            'resend_count' => $challenge->resend_count + 1,
            'last_sent_at' => now(),
            'ip_address' => $request->ip(),
        ])->save();
        Mail::to($challenge->user->email)->send(new TwoFactorCodeMail($code, (int) config('security.two_factor.ttl_minutes', 10), (string) $request->ip()));

        return ['rate_limited' => false, 'resend_available_in' => $cooldown];
    }

    public function startSettings(User $user, string $purpose, string $password, Request $request): array
    {
        if (! Hash::check($password, $user->password)) {
            throw ValidationException::withMessages(['password' => ['validation.current_password_invalid']]);
        }
        if ($purpose === 'disable' && $user->role === UserRole::Admin && (bool) config('security.two_factor.admin_required', true)) {
            throw ValidationException::withMessages(['purpose' => ['validation.two_factor_required_for_role']]);
        }

        return $this->start($user, $purpose, $request, true);
    }

    public function confirmSettings(User $user, string $challengeId, string $code, Request $request): bool
    {
        $challenge = $this->verifiedChallenge($challengeId, $code, null, $user->id);
        if (! in_array($challenge->purpose, ['enable', 'disable'], true)) $this->expired();
        if ($challenge->purpose === 'disable' && $user->role === UserRole::Admin && (bool) config('security.two_factor.admin_required', true)) {
            throw ValidationException::withMessages(['purpose' => ['validation.two_factor_required_for_role']]);
        }
        DB::transaction(function () use ($challenge, $user, $request): void {
            $locked = LoginChallenge::query()->whereKey($challenge->id)->lockForUpdate()->firstOrFail();
            if ($locked->consumed_at !== null || $locked->expires_at->isPast()) $this->expired();
            $locked->consumed_at = now();
            $locked->save();
            $enabled = $locked->purpose === 'enable';
            $user->forceFill(['two_factor_enabled_at' => $enabled ? now() : null])->save();
            $this->audit($user, $enabled ? 'settings.two_factor_enabled' : 'settings.two_factor_disabled', $request);
            DB::afterCommit(static function () use ($user, $enabled): void {
                $user->notify(new TypedNotification($enabled ? 'two_factor_enabled' : 'two_factor_disabled'));
            });
        }, 3);

        return $challenge->purpose === 'enable';
    }

    private function verifiedChallenge(string $id, string $code, ?string $purpose, ?int $userId = null): LoginChallenge
    {
        $challenge = LoginChallenge::query()->with('user')->find($id);
        if ($challenge === null || $challenge->consumed_at !== null || $challenge->expires_at->isPast()
            || ($purpose !== null && $challenge->purpose !== $purpose)
            || ($userId !== null && (int) $challenge->user_id !== $userId)) {
            $this->expired();
        }
        if ($challenge->attempts >= (int) config('security.two_factor.max_attempts', 5)) $this->locked();

        $expected = $this->codeHash($code, (string) $challenge->id);
        if (! hash_equals((string) $challenge->code_hash, $expected)) {
            $challenge->increment('attempts');
            if ($challenge->attempts >= (int) config('security.two_factor.max_attempts', 5)) $this->locked();
            throw ValidationException::withMessages(['code' => ['validation.two_factor_code_invalid']]);
        }

        return $challenge;
    }

    private function newCode(): string
    {
        $length = (int) config('security.two_factor.code_length', 6);
        $max = (10 ** $length) - 1;

        return str_pad((string) random_int(0, $max), $length, '0', STR_PAD_LEFT);
    }

    private function codeHash(string $code, string $challengeId): string
    {
        return hash_hmac('sha256', $code, (string) config('app.key').$challengeId);
    }

    private function maskEmail(string $email): string
    {
        [$name, $domain] = explode('@', $email, 2);
        return mb_substr($name, 0, 1).str_repeat('*', max(1, mb_strlen($name) - 1)).'@'.$domain;
    }

    private function expired(): never
    {
        throw ValidationException::withMessages(['challenge_id' => ['validation.two_factor_expired']]);
    }

    private function locked(): never
    {
        throw ValidationException::withMessages(['code' => ['validation.two_factor_locked']]);
    }

    private function audit(User $user, string $action, Request $request): void
    {
        AuditLog::create(['user_id' => $user->id, 'action' => $action, 'entity_type' => 'user', 'entity_id' => (string) $user->id, 'ip_address' => $request->ip(), 'user_agent' => mb_substr((string) $request->userAgent(), 0, 255), 'metadata' => null, 'created_at' => now()]);
    }
}