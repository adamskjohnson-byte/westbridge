<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AppPreflightTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $databaseConnection = 'database.connections.'.config('database.default');
        app()->instance('env', 'production');
        config([
            'app.env' => 'production',
            'app.debug' => false,
            'app.key' => 'base64:'.base64_encode(str_repeat('a', 32)),
            'app.url' => 'https://api.example.test',
            'services.frontend.url' => 'https://app.example.test',
            'sanctum.stateful' => ['app.example.test'],
            'cors.allowed_origins' => ['https://app.example.test'],
            'session.secure' => true,
            'session.domain' => '.example.test',
            'session.encrypt' => true,
            'bank.auth.require_email_verification' => true,
            'security.turnstile.enabled' => true,
            'security.turnstile.secret' => 'live-secret-key',
            'security.turnstile.sitekey' => 'live-site-key',
            'security.two_factor.admin_required' => true,
            'mail.default' => 'resend',
            'services.resend.key' => 're_test_key',
            'mail.from.address' => 'security@example.test',
            $databaseConnection.'.username' => 'westbridge_app',
            $databaseConnection.'.password' => 'not-empty',
            'logging.default' => 'single',
            'logging.channels.single.level' => 'info',
            'security.trusted_proxies' => null,
            'security.trust_cf_connecting_ip' => false,
        ]);
    }

    public function test_preflight_passes_a_safe_production_configuration(): void
    {
        $this->artisan('app:preflight')->assertExitCode(0);
    }

    public function test_preflight_fails_for_unsafe_production_settings(): void
    {
        config(['security.turnstile.enabled' => false]);
        $this->artisan('app:preflight')->expectsOutputToContain('Turnstile is enabled with live keys')->assertExitCode(1);

        config(['security.turnstile.enabled' => true, 'session.secure' => false]);
        $this->artisan('app:preflight')->expectsOutputToContain('Session cookies are secure')->assertExitCode(1);
    }
}