# Westbridge API

Laravel 12 API-only backend for the Westbridge National Bank learning demo. Use fake money only; do not handle real financial data.

## Routes

All feature API endpoints are versioned under `/api/v1`; the infrastructure health endpoint remains `GET /api/health`. Sanctum's CSRF-cookie route is enabled; public local-file serving remains disabled.

- `GET /api/v1/config` reports the active `email_verification_required` policy.

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
