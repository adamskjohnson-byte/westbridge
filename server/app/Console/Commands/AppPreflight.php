<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Throwable;

class AppPreflight extends Command
{
    protected $signature = 'app:preflight';

    protected $description = 'Check production configuration before deployment';

    private int $failures = 0;

    public function handle(): int
    {
        $frontend = (string) config('services.frontend.url');
        $frontendHost = parse_url($frontend, PHP_URL_HOST);
        $frontendPort = parse_url($frontend, PHP_URL_PORT);
        $frontendDomain = $frontendHost.($frontendPort ? ':'.$frontendPort : '');
        $stateful = (array) config('sanctum.stateful', []);
        $origins = (array) config('cors.allowed_origins', []);
        $connectionName = (string) config('database.default');
        $connection = (array) config('database.connections.'.$connectionName, []);
        $trustedProxies = config('security.trusted_proxies');

        $this->check('APP_ENV is production', app()->environment('production'), 'Set APP_ENV=production.');
        $this->check('APP_DEBUG is disabled', ! (bool) config('app.debug'), 'Set APP_DEBUG=false.');
        $this->check('APP_KEY is set', filled(config('app.key')), 'Generate and set a unique APP_KEY.');
        $this->check('APP_URL uses HTTPS', $this->https((string) config('app.url')), 'Set APP_URL=https://API_DOMAIN.');
        $this->check('FRONTEND_URL uses HTTPS', $this->https($frontend), 'Set FRONTEND_URL=https://APP_DOMAIN.');
        $this->check('Frontend host is stateful', $frontendDomain !== '' && in_array($frontendDomain, $stateful, true), 'Add APP_DOMAIN to SANCTUM_STATEFUL_DOMAINS.');
        $this->check('CORS has exactly the frontend origin', count($origins) === 1 && rtrim((string) ($origins[0] ?? ''), '/') === rtrim($frontend, '/'), 'Set the single CORS allowed origin to FRONTEND_URL.');
        $this->check('Session cookies are secure', (bool) config('session.secure'), 'Set SESSION_SECURE_COOKIE=true.');
        $domain = (string) config('session.domain', '');
        $this->check('Session cookie domain is a parent domain', str_starts_with($domain, '.') && strlen($domain) > 1, 'Set SESSION_DOMAIN=.example.test for the shared app/API parent domain.');
        $this->check('Session data is encrypted', (bool) config('session.encrypt'), 'Set SESSION_ENCRYPT=true.');
        $this->check('Email verification is required', (bool) config('bank.auth.require_email_verification', true), 'Set AUTH_REQUIRE_EMAIL_VERIFICATION=true.');

        $turnstileSecret = (string) config('security.turnstile.secret', '');
        $dummySecret = preg_match('/^[123]x/i', $turnstileSecret) === 1;
        $this->check('Turnstile is enabled with live keys', (bool) config('security.turnstile.enabled') && $turnstileSecret !== '' && ! $dummySecret && filled(config('security.turnstile.sitekey')), 'Set TURNSTILE_ENABLED=true and the live TURNSTILE_SECRET_KEY and TURNSTILE_SITEKEY.');
        $this->check('Admin two-factor is required', (bool) config('security.two_factor.admin_required'), 'Set AUTH_ADMIN_2FA_REQUIRED=true.');
        $this->check('Resend mail and API key are configured', config('mail.default') === 'resend' && filled(config('services.resend.key')), 'Set MAIL_MAILER=resend and RESEND_API_KEY.');
        $this->check('Production sender address is verified', strtolower((string) config('mail.from.address')) !== 'onboarding@resend.dev', 'Set MAIL_FROM_ADDRESS to your verified sender.', true);

        $databaseUser = (string) ($connection['username'] ?? '');
        $databasePassword = (string) ($connection['password'] ?? '');
        $this->check('Database credentials are non-root and password protected', $databaseUser !== '' && strtolower($databaseUser) !== 'root' && $databasePassword !== '', 'Use a dedicated database user with a non-empty password.');
        $this->check('Log level is not debug', strtolower((string) config('logging.channels.'.config('logging.default').'.level', config('logging.level', 'debug'))) !== 'debug', 'Set LOG_LEVEL=info or higher.', true);
        $this->check('Trusted proxy configuration is safe', $this->trustedProxyConfigIsSafe($trustedProxies), 'Set TRUSTED_PROXIES to explicit proxy IPs/CIDRs, or leave CF IP trust disabled. Do not use * on a directly reachable API.');

        $this->databaseChecks();
        $this->check('Storage directory is writable', is_writable(storage_path()), 'Make storage/ writable by the API process.');
        $this->check('Config cache exists', is_file(base_path('bootstrap/cache/config.php')), 'Run php artisan config:cache.', true);
        $this->check('Route cache exists', (glob(base_path('bootstrap/cache/routes-*.php')) ?: []) !== [], 'Run php artisan route:cache.', true);

        return $this->failures === 0 ? self::SUCCESS : self::FAILURE;
    }

    private function databaseChecks(): void
    {
        try {
            $ran = DB::table('migrations')->pluck('migration')->all();
            $files = glob(database_path('migrations/*.php')) ?: [];
            $pending = array_diff(array_map(static fn (string $file): string => basename($file, '.php'), $files), $ran);
            $this->check('No pending migrations', $pending === [], 'Run php artisan migrate --force. Pending: '.implode(', ', $pending));
            $fakeUsers = DB::table('users')->where('email', 'like', '%@westbridge.test')->orWhere('email', 'admin@westbridge.test')->count();
            $this->check('No demo identities remain', $fakeUsers === 0, 'Remove local demo users before production deployment.');
        } catch (Throwable) {
            $this->check('Database schema is readable', false, 'Verify database connectivity and run migrations.');
        }
    }

    private function check(string $label, bool $passed, string $fix, bool $warning = false): void
    {
        $status = $passed ? 'PASS' : ($warning ? 'WARN' : 'FAIL');
        $this->line(sprintf('%-5s %s%s', $status, $label, $passed ? '' : ' — '.$fix));
        if (! $passed && ! $warning) $this->failures++;
    }

    private function https(string $url): bool
    {
        return parse_url($url, PHP_URL_SCHEME) === 'https' && filled(parse_url($url, PHP_URL_HOST));
    }

    private function trustedProxyConfigIsSafe(array|string|null $proxies): bool
    {
        if ((bool) config('security.trust_cf_connecting_ip', false)) {
            return is_array($proxies) && $proxies !== [] && ! in_array('*', $proxies, true);
        }
        return $proxies === null || (is_array($proxies) && ! in_array('*', $proxies, true));
    }
}