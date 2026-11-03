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
        RateLimiter::for('api', static fn (Request $request) => Limit::perMinute(60)->by($request->ip() ?? 'unknown'));
        RateLimiter::for('auth', static function (Request $request) {
            $email = hash('sha256', strtolower(trim((string) $request->input('email', ''))));

            return Limit::perMinute(5)->by(($request->ip() ?? 'unknown').'|'.$email);
        });
        RateLimiter::for('public-forms', static fn (Request $request) => Limit::perMinute(5)->by($request->ip() ?? 'unknown'));
        RateLimiter::for('transaction-export', static fn (Request $request) => Limit::perMinute(10)
            ->by($request->user()?->getAuthIdentifier() === null
                ? ($request->ip() ?? 'unknown')
                : 'user:'.$request->user()->getAuthIdentifier()));

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
