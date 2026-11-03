<?php

return [
    'auth' => [
        'require_email_verification' => (bool) env('AUTH_REQUIRE_EMAIL_VERIFICATION', true),
    ],
    'daily_transfer_limit_cents' => (int) env('BANK_DAILY_TRANSFER_LIMIT_CENTS', 500000),
    'default_currency' => env('BANK_DEFAULT_CURRENCY', 'USD'),
    'welcome_bonus_cents' => (int) env('BANK_WELCOME_BONUS_CENTS', 100000),
];
