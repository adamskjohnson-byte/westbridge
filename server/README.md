# Westbridge API

Laravel 12 API-only backend for the Westbridge National Bank learning demo. Use fake money only; do not handle real financial data.

## Routes

All feature API endpoints are versioned under `/api/v1`; the infrastructure health endpoint remains `GET /api/health`. Sanctum's CSRF-cookie route is enabled; public local-file serving remains disabled.

- `GET /api/v1/config` reports the active `email_verification_required` policy.

### Money movement

All money-movement endpoints require an authenticated, verified, active session. Transfer and bill-payment requests must include an `Idempotency-Key` UUID header; retries with the same body return the original result, while a different body returns `409 idempotency_key_reused`.

- `GET|POST /api/v1/beneficiaries` list or save external recipients; `DELETE /api/v1/beneficiaries/{id}` removes an owned recipient.
- `POST /api/v1/transfers/lookup` looks up an eligible external account with masked holder details; limited to 10/minute per user.
- `GET /api/v1/transfers/own` lists active own accounts with masked numbers.
- `POST /api/v1/transfers` makes own-account or external transfers; `GET /api/v1/transfers` lists transfers and `GET /api/v1/transfers/{id}` reads a transfer involving the caller. Creation is limited to 10/minute per user.
- `GET /api/v1/limits` reports the UTC-day transfer and bill-payment allowance; transfers between the user's own accounts are excluded.
- `GET /api/v1/billers`, `POST /api/v1/bill-payments`, and `GET /api/v1/bill-payments` provide the fictional bill catalog and simulated bill payments.
- `GET|POST /api/v1/cards`, `PATCH /api/v1/cards/{id}`, and the `freeze`, `unfreeze`, and `cancel` actions manage safe virtual debit card metadata. `GET /api/v1/cards?include=cancelled` includes cancelled cards.
- `POST /api/v1/cards/{id}/test-purchase` makes an idempotent simulated purchase, limited to 10 requests per minute per user. Purchases write card-linked ledger debits and do not consume the transfer daily limit.
- `GET /api/v1/accounts/{id}/transactions?card_id={cardId}` filters an owned account's transactions to one of the user's cards.
- `GET /api/v1/notifications`, `/unread-count`, `POST /api/v1/notifications/{id}/read`, `/read-all`, and `DELETE /api/v1/notifications/{id}` manage the caller's typed notifications.
- `GET /api/v1/settings`, `PATCH /api/v1/settings/profile`, `/preferences`, `POST /api/v1/settings/password`, and `/settings/sessions` manage profile, preferences, password, and signed-in sessions.
- `GET /api/v1/insights?month=YYYY-MM` returns SQL-aggregated monthly ledger totals, category comparisons, counterparties, largest debits, and zero-filled daily spending.

### Administration

Admin endpoints are read-only except for user suspension/reactivation, account freeze/unfreeze, and support-ticket status, priority, notes, and replies. They require a verified active admin session, are limited to 60 requests per minute per admin (reconciliation: 6/minute), and never expose full account numbers or card data. User/account state changes require the admin's current password and a 10-500 character reason; all admin writes are audited. Admin list endpoints accept `page` and `per_page` (default 20, maximum 100).

- `GET /api/v1/admin/overview` returns operational aggregates and five recent audit events; `GET /api/v1/admin/system/reconcile` checks account balances against ledger rows and writes an audit event.
- `GET /api/v1/admin/users`, `/users/{id}`, `/transactions`, `/tickets`, `/tickets/{id}`, and `/audit-logs` provide filtered, paginated support and audit views; `/audit-logs/actions` returns action names.
- `POST /api/v1/admin/users/{id}/suspend|reactivate` and `/accounts/{id}/freeze|unfreeze` perform the allowed account-management actions.
- `PATCH /api/v1/admin/tickets/{id}` updates ticket status/priority; `POST /api/v1/admin/tickets/{id}/messages` stores an internal note or emails a public reply.
- `php artisan admin:create {email}` interactively creates a verified admin; `php artisan admin:demote {email}` confirms demotion and revokes sessions. Admins are never created through HTTP.

Account-number lookup responses never contain the full number. Lookup audits record a SHA-256 hash only. Source-account ownership failures return `404` before destination resolution. All balances and ledger movements use integer cents and are written through `LedgerService`.

### Public forms

- `POST /api/v1/newsletter` accepts an `email` and returns `200 { "message": "Thanks for subscribing." }`. Duplicate addresses receive the same response.
- `POST /api/v1/contact` accepts `name`, `email`, `subject`, `message`, and the empty honeypot field `website`; successful messages return `201 { "message": "Message received. We'll reply soon." }`.
- Both routes are limited to five requests per minute per IP. Validation failures return `422` with field errors.

Newsletter example:

```bash
curl -X POST http://localhost:8000/api/v1/newsletter \
	-H 'Accept: application/json' -H 'Content-Type: application/json' \
	-d '{"email":"reader@example.test"}'
```

Contact example:

```bash
curl -X POST http://localhost:8000/api/v1/contact \
	-H 'Accept: application/json' -H 'Content-Type: application/json' \
	-d '{"name":"Riley Example","email":"riley@example.test","subject":"Transfer question","message":"I have a question about a scheduled transfer.","website":""}'
```

## SPA authentication

Authentication uses Sanctum's first-party session-cookie flow; the API does not issue personal access tokens. The SPA first requests `GET /sanctum/csrf-cookie`, then makes credentialed requests with the decoded `XSRF-TOKEN` cookie value in the `X-XSRF-TOKEN` header.

- `POST /api/v1/auth/register` creates a customer with checking and savings accounts and a demo welcome deposit.
- `POST /api/v1/auth/login` authenticates a session; `POST /api/v1/auth/logout` invalidates it.
- `GET /api/v1/auth/me` returns the authenticated user's public profile.
- `GET /api/v1/auth/email/verify/{id}/{hash}` verifies a signed link; `POST /api/v1/auth/email/resend` sends another link for the authenticated user.
- `POST /api/v1/auth/forgot-password` sends a non-enumerating reset email; `POST /api/v1/auth/reset-password` applies a valid reset token and signs out all sessions.
- Auth routes use the `auth` rate limiter. Protected user routes use `auth:sanctum`; `verified`, `active`, and `role` middleware aliases are available.
- `AUTH_REQUIRE_EMAIL_VERIFICATION` defaults to `true`; set it to `false` locally to mark newly registered accounts verified and bypass the `verified` middleware.
- Set `FRONTEND_URL` to the single allowed SPA origin and include its host and port in `SANCTUM_STATEFUL_DOMAINS`. Session cookies are HttpOnly and SameSite=Lax, and Secure in production.

See [docs/api-errors.md](docs/api-errors.md) for stable API error codes and validation keys.

## Email delivery

Mail sends synchronously. Local development defaults to `MAIL_MAILER=log`, which intentionally writes rendered email content to the mail log; application code does not separately log verification or reset URLs. Set `MAIL_MAILER=resend` and `RESEND_API_KEY` to deliver through Laravel 12's built-in Resend transport.

## API conventions

- Keep controllers thin. Validate input with Form Requests, put business logic in `app/Services`, and serialize output with API Resources.
- Return API errors as JSON with a `message` string and optional `errors` field-to-string-array map and `code` string.
- When `APP_DEBUG=false`, never include exception details, traces, SQL, or internal paths in API responses.
- Use backed string enums from `app/Enums` for persisted domain states instead of magic strings.
- Add PHPUnit feature or unit tests for every feature and its error cases.

## Financial data invariants

- Store money as unsigned `BIGINT` cents plus a three-letter currency code. Never use PHP floats or decimal arithmetic for money.
- Any operation that moves money must execute inside `DB::transaction` and lock affected rows with `lockForUpdate()` in ascending primary-key order.
- Ledger rows in the `transactions` table are immutable. Never update or delete a ledger row; record corrections as new rows.
- Never store full card numbers or CVV values, including test or fake values. Store only permitted card metadata such as `last4` and expiry.

## Demo seed credentials

Local and testing seeders create fictional users with the shared demo-only password `Password123!`. The admin login is `admin@westbridge.test`; a customer login is `customer@westbridge.test`. These credentials are for local/testing demos only and are never seeded in production.

## Concurrency stress test

`composer stress` launches independent PHP worker processes against the configured database and exercises the real transfer, bill-payment, and card-purchase services. It must use a disposable MySQL/MariaDB database whose name ends in `_e2e`; the command refuses other environments, database names, and non-InnoDB money tables. InnoDB row locks and independent connections are required to expose transaction races; SQLite's in-memory test database runs in one process and cannot validate this behavior.

Create the dedicated database with the MySQL account configured in `server/.env` (the default XAMPP root account shown here is local-only):

```sql
CREATE DATABASE westbridge_e2e CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON westbridge_e2e.* TO 'root'@'localhost';
```

In `server/.env`, set `DB_CONNECTION=mysql` and `DB_DATABASE=westbridge_e2e`, preserving the configured local host, port, username, and password. From `server/`, prepare the disposable schema and run the stress harness:

```powershell
php artisan dev:e2e-prepare
composer stress
```

`dev:e2e-prepare` is guarded by the same local/testing and `_e2e` checks and freshly migrates only that dedicated database. The stress harness itself creates unique users/accounts for each run and does not clear or modify pre-existing records. Run `composer stress` three times to compare repeatability; afterward use `php artisan bank:reconcile` against the same E2E database.

## Local checks

```powershell
php artisan test
php artisan route:list
```<p align="center"><a href="https://laravel.com" target="_blank"><img src="https://raw.githubusercontent.com/laravel/art/master/logo-lockup/5%20SVG/2%20CMYK/1%20Full%20Color/laravel-logolockup-cmyk-red.svg" width="400" alt="Laravel Logo"></a></p>

<p align="center">
<a href="https://github.com/laravel/framework/actions"><img src="https://github.com/laravel/framework/workflows/tests/badge.svg" alt="Build Status"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/dt/laravel/framework" alt="Total Downloads"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/v/laravel/framework" alt="Latest Stable Version"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/l/laravel/framework" alt="License"></a>
</p>

## About Laravel

Laravel is a web application framework with expressive, elegant syntax. We believe development must be an enjoyable and creative experience to be truly fulfilling. Laravel takes the pain out of development by easing common tasks used in many web projects, such as:

- [Simple, fast routing engine](https://laravel.com/docs/routing).
- [Powerful dependency injection container](https://laravel.com/docs/container).
- Multiple back-ends for [session](https://laravel.com/docs/session) and [cache](https://laravel.com/docs/cache) storage.
- Expressive, intuitive [database ORM](https://laravel.com/docs/eloquent).
- Database agnostic [schema migrations](https://laravel.com/docs/migrations).
- [Robust background job processing](https://laravel.com/docs/queues).
- [Real-time event broadcasting](https://laravel.com/docs/broadcasting).

Laravel is accessible, powerful, and provides tools required for large, robust applications.

## Learning Laravel

Laravel has the most extensive and thorough [documentation](https://laravel.com/docs) and video tutorial library of all modern web application frameworks, making it a breeze to get started with the framework.

You may also try the [Laravel Bootcamp](https://bootcamp.laravel.com), where you will be guided through building a modern Laravel application from scratch.

If you don't feel like reading, [Laracasts](https://laracasts.com) can help. Laracasts contains thousands of video tutorials on a range of topics including Laravel, modern PHP, unit testing, and JavaScript. Boost your skills by digging into our comprehensive video library.

## Laravel Sponsors

We would like to extend our thanks to the following sponsors for funding Laravel development. If you are interested in becoming a sponsor, please visit the [Laravel Partners program](https://partners.laravel.com).

### Premium Partners

- **[Vehikl](https://vehikl.com/)**
- **[Tighten Co.](https://tighten.co)**
- **[WebReinvent](https://webreinvent.com/)**
- **[Kirschbaum Development Group](https://kirschbaumdevelopment.com)**
- **[64 Robots](https://64robots.com)**
- **[Curotec](https://www.curotec.com/services/technologies/laravel/)**
- **[Cyber-Duck](https://cyber-duck.co.uk)**
- **[DevSquad](https://devsquad.com/hire-laravel-developers)**
- **[Jump24](https://jump24.co.uk)**
- **[Redberry](https://redberry.international/laravel/)**
- **[Active Logic](https://activelogic.com)**
- **[byte5](https://byte5.de)**
- **[OP.GG](https://op.gg)**

## Contributing

Thank you for considering contributing to the Laravel framework! The contribution guide can be found in the [Laravel documentation](https://laravel.com/docs/contributions).

## Code of Conduct

In order to ensure that the Laravel community is welcoming to all, please review and abide by the [Code of Conduct](https://laravel.com/docs/contributions#code-of-conduct).

## Security Vulnerabilities

If you discover a security vulnerability within Laravel, please send an e-mail to Taylor Otwell via [taylor@laravel.com](mailto:taylor@laravel.com). All security vulnerabilities will be promptly addressed.

## License

The Laravel framework is open-sourced software licensed under the [MIT license](https://opensource.org/licenses/MIT).
