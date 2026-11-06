<?php

namespace App\Providers;

use App\Models\Account;
use App\Policies\AccountPolicy;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Gate::policy(Account::class, AccountPolicy::class);

        // Centralize API, authentication, and public form request limits.
        RateLimiter::for('api', static fn (Request $request) => Limit::perMinute((int) config('bank.api_rate_limit_per_minute', 60))->by('api:ip:'.hash('sha256', (string) ($request->ip() ?? 'unknown'))));
        RateLimiter::for('auth', static function (Request $request) {
            $email = hash('sha256', strtolower(trim((string) $request->input('email', ''))));

            return Limit::perMinute(5)->by('auth:'.hash('sha256', ($request->ip() ?? 'unknown').'|'.$email));
        });
        RateLimiter::for('login', static function (Request $request) {
            $email = hash('sha256', strtolower(trim((string) $request->input('email', ''))));
            $ip = hash('sha256', (string) ($request->ip() ?? 'unknown'));

            return [
                Limit::perMinute(5)->by('login:ip-email:'.hash('sha256', $ip.'|'.$email)),
                Limit::perMinutes(15, 10)->by('login:email:'.$email),
                Limit::perMinutes(15, 30)->by('login:ip:'.$ip),
            ];
        });
        RateLimiter::for('register', static fn (Request $request) => Limit::perHour(5)->by('register:ip:'.hash('sha256', (string) ($request->ip() ?? 'unknown'))));
        RateLimiter::for('password-recovery', static function (Request $request) {
            $email = hash('sha256', strtolower(trim((string) $request->input('email', ''))));
            $ip = hash('sha256', (string) ($request->ip() ?? 'unknown'));

            return [Limit::perHour(5)->by('recovery:email:'.$email), Limit::perHour(10)->by('recovery:ip:'.$ip)];
        });
        RateLimiter::for('two-factor', static function (Request $request) {
            $challenge = hash('sha256', (string) $request->input('challenge_id', 'missing'));
            $ip = hash('sha256', (string) ($request->ip() ?? 'unknown'));

            return [Limit::perMinutes(15, 10)->by('two-factor:challenge:'.$challenge), Limit::perMinutes(15, 10)->by('two-factor:ip:'.$ip)];
        });
        RateLimiter::for('public-forms', static fn (Request $request) => Limit::perMinute(5)->by('public:ip:'.hash('sha256', (string) ($request->ip() ?? 'unknown'))));
        RateLimiter::for('transaction-export', static fn (Request $request) => Limit::perMinute(10)
            ->by($request->user()?->getAuthIdentifier() === null
                ? 'ip:'.hash('sha256', (string) ($request->ip() ?? 'unknown'))
                : 'user:'.hash('sha256', (string) $request->user()->getAuthIdentifier())));
        RateLimiter::for('recipient-lookup', static fn (Request $request) => Limit::perMinute(10)
            ->by($request->user()?->getAuthIdentifier() === null
                ? 'ip:'.hash('sha256', (string) ($request->ip() ?? 'unknown'))
                : 'user:'.hash('sha256', (string) $request->user()->getAuthIdentifier())));
        RateLimiter::for('transfers', static fn (Request $request) => Limit::perMinute(10)
            ->by($request->user()?->getAuthIdentifier() === null
                ? 'ip:'.hash('sha256', (string) ($request->ip() ?? 'unknown'))
                : 'user:'.hash('sha256', (string) $request->user()->getAuthIdentifier())));
        RateLimiter::for('card-purchases', static fn (Request $request) => Limit::perMinute(10)
            ->by($request->user()?->getAuthIdentifier() === null
                ? 'ip:'.hash('sha256', (string) ($request->ip() ?? 'unknown'))
                : 'user:'.hash('sha256', (string) $request->user()->getAuthIdentifier())));
        RateLimiter::for('admin', static fn (Request $request) => Limit::perMinute(60)
            ->by($request->user()?->getAuthIdentifier() === null
                ? 'ip:'.hash('sha256', (string) ($request->ip() ?? 'unknown'))
                : 'admin:'.hash('sha256', (string) $request->user()->getAuthIdentifier())));
        RateLimiter::for('admin-reconcile', static fn (Request $request) => Limit::perMinute(6)
            ->by($request->user()?->getAuthIdentifier() === null
                ? 'ip:'.hash('sha256', (string) ($request->ip() ?? 'unknown'))
                : 'admin-reconcile:'.hash('sha256', (string) $request->user()->getAuthIdentifier())));

        // Sign the API route, then retain its signature while sending users back to the SPA.
        VerifyEmail::createUrlUsing(static fn ($user): string => URL::temporarySignedRoute(
            'api.v1.auth.email.verify',
            now()->addMinutes(60),
            ['id' => $user->getKey(), 'hash' => sha1($user->getEmailForVerification())],
        ));
        VerifyEmail::toMailUsing(static function ($user, string $signedApiUrl) {
            $query = parse_url($signedApiUrl, PHP_URL_QUERY) ?: '';
            parse_str($query, $signedParameters);
            $frontendUrl = rtrim((string) config('services.frontend.url'), '/').'/verify-email';
            $verificationUrl = $frontendUrl.'?'.http_build_query([
                'id' => $user->getKey(),
                'hash' => sha1($user->getEmailForVerification()),
                ...$signedParameters,
            ]);

            // Email copy is English-only for now; localisation of emails comes later.
            return (new MailMessage)
                ->subject('Verify your Westbridge email address')
                ->line('Please verify your email address to complete your Westbridge account setup.')
                ->action('Verify email address', $verificationUrl)
                ->line('This link expires in 60 minutes.');
        });

        // Reset links target the SPA; the API keeps reset tokens out of backend route URLs.
        ResetPassword::createUrlUsing(static fn ($user, string $token): string => rtrim((string) config('services.frontend.url'), '/').'/reset-password?'.http_build_query([
            'token' => $token,
            'email' => $user->getEmailForPasswordReset(),
        ]));
    }
}
