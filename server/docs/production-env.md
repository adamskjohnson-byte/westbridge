# Production Environment

Replace every `example.com` host, database name, CIDR, and placeholder secret before deployment. Never commit a populated `.env` or put server secrets in a `VITE_` variable.

## Required API Example

```dotenv
APP_NAME="Westbridge National Bank"
APP_ENV=production
APP_KEY=base64:GENERATE_A_UNIQUE_32_BYTE_KEY
APP_DEBUG=false
APP_URL=https://api.example.com
APP_LOCALE=en
APP_FALLBACK_LOCALE=en
APP_FAKER_LOCALE=en_US
FRONTEND_URL=https://app.example.com
SANCTUM_STATEFUL_DOMAINS=app.example.com,api.example.com

DB_CONNECTION=mysql
DB_HOST=mysql.internal.example.com
DB_PORT=3306
DB_DATABASE=westbridge_prod
DB_USERNAME=westbridge_app
DB_PASSWORD=REPLACE_WITH_A_LONG_UNIQUE_SECRET
DB_CHARSET=utf8mb4
DB_COLLATION=utf8mb4_unicode_ci
DB_FOREIGN_KEYS=true

SESSION_DRIVER=database
SESSION_LIFETIME=120
SESSION_ENCRYPT=true
SESSION_PATH=/
SESSION_DOMAIN=.example.com
SESSION_SECURE_COOKIE=true
SESSION_SAME_SITE=lax
SESSION_EXPIRE_ON_CLOSE=false

AUTH_REQUIRE_EMAIL_VERIFICATION=true
AUTH_ADMIN_2FA_REQUIRED=true
TURNSTILE_ENABLED=true
TURNSTILE_SITEKEY=LIVE_CLOUDFLARE_SITE_KEY
TURNSTILE_SECRET_KEY=LIVE_CLOUDFLARE_SECRET_KEY
TURNSTILE_EXPECTED_HOSTNAMES=app.example.com
TRUSTED_PROXIES=REPLACE_WITH_EXACT_PROXY_IPS_OR_CIDRS
TRUST_CF_CONNECTING_IP=false

MAIL_MAILER=resend
RESEND_API_KEY=re_REPLACE_WITH_VERIFIED_RESEND_KEY
MAIL_FROM_ADDRESS=security@example.com
MAIL_FROM_NAME="Westbridge National Bank"

CACHE_STORE=redis
QUEUE_CONNECTION=redis
FILESYSTEM_DISK=local
LOG_CHANNEL=stack
LOG_STACK=stderr
LOG_LEVEL=info

BANK_WELCOME_BONUS_CENTS=100000
BANK_DAILY_TRANSFER_LIMIT_CENTS=500000
BANK_CARD_DAILY_LIMIT_MAX_CENTS=500000
BANK_CARD_DEFAULT_DAILY_LIMIT_CENTS=100000
BANK_MAX_ACTIVE_CARDS=3
BANK_ADMIN_LARGE_TRANSACTION_CENTS=1000000
BANK_DEFAULT_CURRENCY=USD
```

`APP_KEY`, database credentials, mail/API keys, and Turnstile keys must be unique live values. Set `TRUSTED_PROXIES` to the exact network addresses of the reverse proxy that can reach the API. Only set `TRUST_CF_CONNECTING_IP=true` when the origin is reachable exclusively through Cloudflare and the trusted proxy list contains the actual Cloudflare proxy CIDRs. Never use `*` on a directly reachable origin.

The session config defaults `SESSION_SECURE_COOKIE` and `SESSION_ENCRYPT` to true when `APP_ENV=production`; set them explicitly as above. Configure the parent cookie domain for the SPA/API pair. `SESSION_HTTP_ONLY` is not an environment option in this app and remains true in `config/session.php`.

## Frontend Build Example

These are build-time settings. `VITE_API_URL` is public and included in the JavaScript bundle. `API_ORIGIN` is normalized to an origin and included in the generated CSP. `CSP_MODE` defaults to report-only; keep it that way until deployment reports are reviewed.

```dotenv
VITE_API_URL=https://api.example.com/api
API_ORIGIN=https://api.example.com
CSP_MODE=report-only
```

`PIXABAY_API_KEY` is consumed only by the optional local photo-fetch script. Do not expose it through `VITE_`; use a restricted build-time secret if that script is used.

## Supported Optional Variables

The API also accepts Laravel driver-specific variables. Leave them unset unless that driver is selected; use production secrets and private endpoints where applicable.

| Area | Variables | Production example / guidance |
| --- | --- | --- |
| App and maintenance | `APP_MAINTENANCE_DRIVER`, `APP_MAINTENANCE_STORE`, `APP_PREVIOUS_KEYS` | `APP_MAINTENANCE_DRIVER=file`; previous encryption keys only during planned key rotation. |
| Auth | `AUTH_GUARD`, `AUTH_MODEL`, `AUTH_PASSWORD_BROKER`, `AUTH_PASSWORD_RESET_TOKEN_TABLE`, `AUTH_PASSWORD_TIMEOUT` | Keep `web`, `App\\Models\\User`, `users`, `password_reset_tokens`, and the framework timeout unless deliberately changed. |
| Broadcast / Sanctum | `BROADCAST_CONNECTION`, `SANCTUM_TOKEN_PREFIX` | `BROADCAST_CONNECTION=log` when no broadcast service is used; leave the token prefix unset unless Sanctum personal access tokens are enabled. |
| Database | `DB_URL`, `DB_SOCKET`, `DB_ENCRYPT`, `DB_TRUST_SERVER_CERTIFICATE`, `MYSQL_ATTR_SSL_CA` | Prefer explicit private host/port/user/password; enable TLS verification and provide the CA file when required by the database provider. |
| Bank limits | `BANK_API_RATE_LIMIT_PER_MINUTE` | Set a value appropriate to the API traffic and upstream protection; default is configured in the rate limiter. |
| Session customization | `SESSION_CONNECTION`, `SESSION_COOKIE`, `SESSION_PARTITIONED_COOKIE`, `SESSION_STORE`, `SESSION_TABLE` | Normally leave the connection/store unset, keep the default cookie name and `sessions` table, and use partitioned cookies only with the required `SameSite=None; Secure` cross-site deployment design. |
| Cache / database queue | `CACHE_PREFIX`, `DB_CACHE_CONNECTION`, `DB_CACHE_LOCK_CONNECTION`, `DB_CACHE_LOCK_TABLE`, `DB_QUEUE`, `DB_QUEUE_CONNECTION`, `DB_QUEUE_RETRY_AFTER`, `DB_QUEUE_TABLE`, `QUEUE_FAILED_DRIVER` | Use unique prefixes, a dedicated queue, and retry time above the longest expected job. |
| Redis | `REDIS_CLIENT`, `REDIS_CLUSTER`, `REDIS_HOST`, `REDIS_PASSWORD`, `REDIS_PORT`, `REDIS_URL`, `REDIS_USERNAME`, `REDIS_DB`, `REDIS_CACHE_DB`, `REDIS_CACHE_CONNECTION`, `REDIS_CACHE_LOCK_CONNECTION`, `REDIS_PERSISTENT`, `REDIS_PREFIX`, `REDIS_QUEUE`, `REDIS_QUEUE_CONNECTION`, `REDIS_QUEUE_RETRY_AFTER` | Use private TLS Redis, authentication, and separate production cache/queue databases or prefixes. |
| Other cache drivers | `MEMCACHED_HOST`, `MEMCACHED_PORT`, `MEMCACHED_USERNAME`, `MEMCACHED_PASSWORD`, `MEMCACHED_PERSISTENT_ID`, `DYNAMODB_CACHE_TABLE`, `DYNAMODB_ENDPOINT` | Configure only when using the corresponding managed cache service. |
| Queue drivers | `BEANSTALKD_QUEUE_HOST`, `BEANSTALKD_QUEUE`, `BEANSTALKD_QUEUE_RETRY_AFTER`, `SQS_PREFIX`, `SQS_QUEUE`, `SQS_SUFFIX` | Configure only when selecting that queue driver; use private endpoints and least-privilege cloud credentials. |
| Mail | `MAIL_URL`, `MAIL_SCHEME`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_EHLO_DOMAIN`, `MAIL_SENDMAIL_PATH`, `MAIL_LOG_CHANNEL`, `POSTMARK_TOKEN`, `POSTMARK_MESSAGE_STREAM_ID` | Not needed for Resend; if switching providers, use the provider's verified TLS endpoint and restricted credentials. |
| Logging | `LOG_DEPRECATIONS_CHANNEL`, `LOG_DEPRECATIONS_TRACE`, `LOG_DAILY_DAYS`, `LOG_STDERR_FORMATTER`, `LOG_SYSLOG_FACILITY`, `LOG_SLACK_WEBHOOK_URL`, `LOG_SLACK_USERNAME`, `LOG_SLACK_EMOJI`, `LOG_PAPERTRAIL_HANDLER`, `PAPERTRAIL_URL`, `PAPERTRAIL_PORT`, `SLACK_BOT_USER_OAUTH_TOKEN`, `SLACK_BOT_USER_DEFAULT_CHANNEL` | Send logs to an approved private sink; webhook and bot tokens are secrets. Never use `debug` in production. |
| Filesystem / cloud | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION`, `AWS_BUCKET`, `AWS_ENDPOINT`, `AWS_URL`, `AWS_USE_PATH_STYLE_ENDPOINT` | Leave unset for local storage; otherwise use a dedicated least-privilege service identity and private bucket. |
| Localization / framework | `APP_LOCALE`, `APP_FALLBACK_LOCALE`, `APP_FAKER_LOCALE`, `BCRYPT_ROUNDS`, `PHP_CLI_SERVER_WORKERS`, `VITE_APP_NAME` | Set application locales intentionally. `BCRYPT_ROUNDS` and `PHP_CLI_SERVER_WORKERS` are local/runtime tuning; `VITE_APP_NAME` is for Laravel's own Vite build, not the React client. |
| Client-only | `VITE_API_URL`, `API_ORIGIN`, `CSP_MODE`, `PIXABAY_API_KEY` | Use the examples above; never put API secrets in `VITE_*`. |

## Must Differ From Local

Production must use `APP_ENV=production`, `APP_DEBUG=false`, HTTPS API/frontend URLs, production database credentials, secure/encrypted cookies, a parent cookie domain, required email verification, live Turnstile keys, required admin 2FA, verified production email delivery, a non-debug log level, and explicit proxy trust. Do not deploy local seeded users, demo credentials, `westbridge`/`westbridge_e2e` databases, localhost URLs, dummy Turnstile keys, or the Resend onboarding sender.