<?php

return [
    'auth' => [
        'require_email_verification' => (bool) env('AUTH_REQUIRE_EMAIL_VERIFICATION', true),
    ],
    'daily_transfer_limit_cents' => (int) env('BANK_DAILY_TRANSFER_LIMIT_CENTS', 500000),
    'card_daily_limit_max_cents' => (int) env('BANK_CARD_DAILY_LIMIT_MAX_CENTS', 500000),
    'card_default_daily_limit_cents' => (int) env('BANK_CARD_DEFAULT_DAILY_LIMIT_CENTS', 100000),
    'max_active_cards' => (int) env('BANK_MAX_ACTIVE_CARDS', 3),
    'supported_locales' => ['en', 'es', 'fr', 'pt', 'de', 'it', 'tr', 'ar'],
    'api_rate_limit_per_minute' => (int) env('BANK_API_RATE_LIMIT_PER_MINUTE', 60),
    'default_currency' => env('BANK_DEFAULT_CURRENCY', 'USD'),
    'welcome_bonus_cents' => (int) env('BANK_WELCOME_BONUS_CENTS', 100000),
    'admin_large_transaction_cents' => (int) env('BANK_ADMIN_LARGE_TRANSACTION_CENTS', 500000),
    'admin_per_page_max' => 100,
    'billers' => [
        ['code' => 'north-electric', 'name' => 'Northstar Electric', 'category' => 'electricity', 'reference_pattern' => '/^NE\d{8}$/'],
        ['code' => 'river-water', 'name' => 'Riverbend Water', 'category' => 'water', 'reference_pattern' => '/^RW\d{7}$/'],
        ['code' => 'pine-internet', 'name' => 'Pinecone Internet', 'category' => 'internet', 'reference_pattern' => '/^PI\d{9}$/'],
        ['code' => 'harbor-mobile', 'name' => 'Harbor Mobile', 'category' => 'mobile', 'reference_pattern' => '/^HM\d{10}$/'],
        ['code' => 'meadow-insurance', 'name' => 'Meadow Insurance', 'category' => 'insurance', 'reference_pattern' => '/^MI\d{8}$/'],
        ['code' => 'cedar-card', 'name' => 'Cedar Credit Card', 'category' => 'credit_card', 'reference_pattern' => '/^CC\d{12}$/'],
        ['code' => 'summit-tv', 'name' => 'Summit TV', 'category' => 'tv', 'reference_pattern' => '/^ST\d{8}$/'],
        ['code' => 'state-tax', 'name' => 'Westbridge Demo Tax Office', 'category' => 'tax', 'reference_pattern' => '/^TX\d{9}$/'],
    ],
];
