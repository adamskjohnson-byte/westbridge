<?php

return [
    'trusted_proxies' => (static function (): array|string|null {
        $value = trim((string) env('TRUSTED_PROXIES', ''));
        if ($value === '') return null;
        if ($value === '*') return '*';
        return array_values(array_filter(array_map('trim', explode(',', $value))));
    })(),
    'trust_cf_connecting_ip' => filter_var(env('TRUST_CF_CONNECTING_IP', false), FILTER_VALIDATE_BOOL),
    'turnstile' => [
        'enabled' => filter_var(env('TURNSTILE_ENABLED', true), FILTER_VALIDATE_BOOL),
        'secret' => env('TURNSTILE_SECRET_KEY'),
        'sitekey' => env('TURNSTILE_SITEKEY'),
        'timeout' => 5,
        'expected_hostnames' => array_values(array_filter(array_map('trim', explode(',', (string) env('TURNSTILE_EXPECTED_HOSTNAMES', ''))))),
    ],
    'two_factor' => [
        'admin_required' => filter_var(env('AUTH_ADMIN_2FA_REQUIRED', true), FILTER_VALIDATE_BOOL),
        'code_length' => 6,
        'ttl_minutes' => 10,
        'max_attempts' => 5,
        'resend_cooldown_seconds' => 60,
        'max_resends' => 3,
    ],
];