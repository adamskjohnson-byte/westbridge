<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;
use App\Models\UserSetting;
use App\Enums\UserRole;
use App\Notifications\TypedNotification;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class SettingsService
{
    public function get(User $user): array
    {
        $setting = $this->setting($user);

        return [
            'profile' => ['first_name' => $user->first_name, 'last_name' => $user->last_name, 'email' => $user->email, 'phone' => $user->phone],
            'preferences' => $setting->only(['locale', 'theme', 'email_activity', 'low_balance_threshold_cents']),
            'security' => [
                'two_factor_enabled' => $user->two_factor_enabled_at !== null,
                'two_factor_required' => $user->role === UserRole::Admin && (bool) config('security.two_factor.admin_required', true),
            ],
        ];
    }

    public function profile(User $user, array $data, string $ip, string $agent): User
    {
        $user->fill($data)->save();
        $this->audit($user, 'settings.profile_updated', $ip, $agent);

        return $user;
    }

    public function preferences(User $user, array $data): UserSetting
    {
        $setting = $this->setting($user);
        $setting->fill($data)->save();
        $this->audit($user, 'settings.preferences_updated');

        return $setting;
    }

    public function changePassword(User $user, array $data, string $ip, string $agent, string $currentSession): void
    {
        if (! Hash::check($data['current_password'], $user->password)) {
            throw ValidationException::withMessages(['current_password' => ['validation.current_password_invalid']]);
        }
        if (Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages(['password' => ['validation.password_unchanged']]);
        }
        DB::transaction(function () use ($user, $data, $ip, $agent, $currentSession): void {
            $user->forceFill(['password' => Hash::make($data['password']), 'remember_token' => Str::random(60)])->save();
            DB::table(config('session.table', 'sessions'))->where('user_id', $user->getKey())->where('id', '!=', $currentSession)->delete();
            $this->audit($user, 'settings.password_changed', $ip, $agent);
            DB::afterCommit(static fn () => $user->notify(new TypedNotification('password_changed')));
        }, 3);
    }

    public function sessions(User $user, string $currentSession): array
    {
        return DB::table(config('session.table', 'sessions'))->where('user_id', $user->getKey())->orderByDesc('last_activity')->get()
            ->map(fn ($session): array => $this->sessionData($session, $currentSession))->all();
    }

    public function revoke(User $user, string $handle, string $currentSession, string $ip, string $agent): void
    {
        $id = $this->decodeHandle($handle);
        if ($id === $currentSession) {
            throw ValidationException::withMessages(['session' => ['validation.cannot_revoke_current']]);
        }
        $deleted = DB::table(config('session.table', 'sessions'))->where('user_id', $user->getKey())->where('id', $id)->delete();
        if (! $deleted) {
            abort(404);
        }
        $this->audit($user, 'settings.session_revoked', $ip, $agent);
        DB::afterCommit(static fn () => $user->notify(new TypedNotification('session_revoked')));
    }

    public function revokeOthers(User $user, string $currentSession, string $ip, string $agent): void
    {
        $deleted = DB::table(config('session.table', 'sessions'))->where('user_id', $user->getKey())->where('id', '!=', $currentSession)->delete();
        $this->audit($user, 'settings.sessions_revoked', $ip, $agent, ['count' => $deleted]);
        if ($deleted > 0) {
            DB::afterCommit(static fn () => $user->notify(new TypedNotification('session_revoked')));
        }
    }

    private function setting(User $user): UserSetting
    {
        return UserSetting::query()->firstOrCreate(
            ['user_id' => $user->getKey()],
            ['theme' => 'system', 'email_activity' => true],
        );
    }

    private function sessionData(object $session, string $currentSession): array
    {
        $agent = (string) $session->user_agent;
        $browser = str_contains($agent, 'Firefox') ? 'Firefox' : (str_contains($agent, 'Edg') ? 'Edge' : (str_contains($agent, 'Chrome') ? 'Chrome' : (str_contains($agent, 'Safari') ? 'Safari' : 'Unknown')));
        $platform = str_contains($agent, 'Windows') ? 'Windows' : (str_contains($agent, 'Mac') ? 'macOS' : (str_contains($agent, 'Linux') ? 'Linux' : (str_contains($agent, 'Android') ? 'Android' : (str_contains($agent, 'iPhone') ? 'iOS' : 'Unknown'))));
        $device = preg_match('/iPad|Tablet/i', $agent) ? 'tablet' : (preg_match('/Mobile|Android|iPhone/i', $agent) ? 'mobile' : ($agent === '' ? 'unknown' : 'desktop'));
        $ip = (string) $session->ip_address;
        $maskedIp = str_contains($ip, ':') ? preg_replace('/:[^:]+$/', ':xxxx', $ip) : preg_replace('/\.\d+$/', '.xxx', $ip);

        $handle = rtrim(strtr(Crypt::encryptString((string) $session->id), '+/', '-_'), '=');

        return ['id' => $handle, 'is_current' => $session->id === $currentSession, 'browser' => $browser, 'platform' => $platform, 'device_type' => $device, 'ip_masked' => $maskedIp, 'last_active_at' => gmdate(DATE_ATOM, (int) $session->last_activity)];
    }

    private function decodeHandle(string $handle): string
    {
        try {
            $encoded = strtr($handle, '-_', '+/');
            return Crypt::decryptString($encoded.str_repeat('=', (4 - strlen($encoded) % 4) % 4));
        } catch (\Throwable) {
            abort(404);
        }
    }

    private function audit(User $user, string $action, ?string $ip = null, ?string $agent = null, array $metadata = []): void
    {
        AuditLog::create(['user_id' => $user->getKey(), 'action' => $action, 'entity_type' => 'user', 'entity_id' => (string) $user->getKey(), 'ip_address' => $ip, 'user_agent' => $agent === null ? null : mb_substr($agent, 0, 255), 'metadata' => $metadata, 'created_at' => now()]);
    }
}