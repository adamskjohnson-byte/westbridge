# API Errors

All errors under `/api/*` are JSON and include a stable snake_case `code`. The top-level `message` is an English summary for logs and developers; clients should branch on `code` and translate `errors` values.

## Error Codes

| HTTP | Code | Meaning |
|---:|---|---|
| 401 | `unauthenticated` | No valid authenticated session. |
| 403 | `forbidden` | The request is authenticated but not allowed. |
| 403 | `account_suspended` | The user account is suspended. |
| 403 | `email_not_verified` | Email verification is required by configuration. |
| 403 | `invalid_verification_link` | The signed verification link is invalid or expired. |
| 403 | `role_forbidden` | The user does not have the required role. |
| 404 | `not_found` | The requested route or resource was not found. |
| 404 | `recipient_not_found` | No eligible external active recipient matches the request. |
| 409 | `idempotency_key_reused` | An idempotency key was reused with a different request body. |
| 419 | `csrf_mismatch` | The CSRF token is missing or invalid. |
| 422 | `validation_failed` | One or more input fields failed validation. |
| 422 | `cannot_modify_admin` | An admin may not suspend, reactivate, or freeze accounts belonging to administrators or themselves. |
| 422 | `already_in_state` | The requested user/account state is already active or suspended/frozen. |
| 429 | `too_many_requests` | A request limit was exceeded; `Retry-After` is included. |
| 500 | `server_error` | An unexpected server error occurred. Details are omitted when `APP_DEBUG=false`. |
| varies | Bank exception machine code | A domain-specific bank operation failed. |

## Dashboard API

Read-only dashboard routes live under `/api/v1` and require `auth:sanctum`, `verified`, and `active` middleware. Account ownership failures return `404 not_found`.

Transaction list filters use `page`, `per_page` (1-50, default 15), `q` (up to 100 characters), `direction`, repeated `category[]`, `date_from`, `date_to`, `min_amount_cents`, `max_amount_cents`, `sort` (`posted_at` or `amount_cents`), and `order` (`asc` or `desc`). Date ranges are UTC and may span at most five years.

## Money Movement API

Money movement routes require `auth:sanctum`, `verified`, and `active`. Transfers and bill payments require an `Idempotency-Key` UUID header. Repeating the same key and body returns the original result; reusing the key with a different body returns `409 idempotency_key_reused`. Source-account ownership is checked before destination resolution; foreign source ids return `404 not_found`. Recipient lookup is limited to 10 requests per minute per user, and transfers are limited to 10 per minute per user.

- `GET /api/v1/beneficiaries`, `POST /api/v1/beneficiaries`, and `DELETE /api/v1/beneficiaries/{id}` manage saved external recipients. Stored holder names come from the destination account owner.
- `POST /api/v1/transfers/lookup` returns only account type, masked holder name, and currency. Missing, inactive, and own account numbers all return `404 recipient_not_found`; lookup audit metadata stores only a SHA-256 hash of the account number.
- `GET /api/v1/transfers/own` returns active own accounts with masked numbers.
- `POST /api/v1/transfers`, `GET /api/v1/transfers`, and `GET /api/v1/transfers/{id}` create and read transfers. Transfer history supports `page`, `account_id`, `direction` (`in`, `out`, `own`), `date_from`, and `date_to`.
- `GET /api/v1/limits` reports the UTC-day transfer and bill-payment allowance. Own-account transfers do not count toward the limit.
- `GET /api/v1/billers`, `POST /api/v1/bill-payments`, and `GET /api/v1/bill-payments` expose the fictional biller catalog and simulated bill payments.

## Cards API

Card routes require `auth:sanctum`, `verified`, and `active`. Foreign cards and accounts return `404 not_found`. Responses expose only card `last4` and expiry metadata. Test purchases require an `Idempotency-Key` UUID, are limited to 10 per minute per user, and are committed as immutable card-linked ledger rows. Declined attempts are audited and create no ledger row.

- `GET /api/v1/cards` lists non-cancelled cards; `?include=cancelled` includes cancelled cards.
- `POST /api/v1/cards`, `PATCH /api/v1/cards/{id}`, and `POST /api/v1/cards/{id}/freeze`, `/unfreeze`, or `/cancel` manage cards. Cancellation requires `{ "confirm": true }` and is permanent.
- `POST /api/v1/cards/{id}/test-purchase` accepts a merchant and integer cents. Decline codes: `card_frozen`, `card_cancelled`, `account_frozen`, `insufficient_funds`, `card_limit_exceeded`. Reusing an idempotency key with a different body returns `409 idempotency_key_reused`.
- Account transaction lists accept an owner-scoped `card_id` filter.

## Notifications, Settings, and Insights

These routes require `auth:sanctum`, `verified`, and `active`. Notification and session actions are scoped to the current user; unknown or foreign identifiers return `404 not_found`. Notifications store only stable `type` and `params` values. Session handles are encrypted opaque values; raw session IDs are never returned.

- `GET /api/v1/notifications` supports pagination and `?unread=1`; `GET /api/v1/notifications/unread-count` returns the unread count; read, read-all, and delete actions are under `/api/v1/notifications`.
- `GET /api/v1/settings`, `PATCH /api/v1/settings/profile`, `PATCH /api/v1/settings/preferences`, `POST /api/v1/settings/password`, and session list/revocation routes manage account settings.
- `GET /api/v1/insights?month=YYYY-MM` accepts the current UTC month or a month up to 24 months earlier; it returns numeric aggregates only.

## Admin API

All `/api/v1/admin` routes require `auth:sanctum`, `verified`, `active`, and `role:admin`. The API is limited to 60 requests per minute per admin; reconciliation is additionally limited to 6 requests per minute. Paginated endpoints accept `page` and `per_page` (default 20, maximum 100). Responses expose account numbers masked to their last four digits and do not return password hashes, tokens, or card data.

- `GET /admin/overview` returns user, ticket, transaction, volume, balance, failed-login, large-transaction, and recent-audit aggregates.
- `GET /admin/system/reconcile` compares each account balance with its ledger sum and latest ledger balance, returns only masked account numbers, and records `admin.reconcile_run`.
- `GET /admin/users` supports `q`, `status`, `role`, `verified`, `sort` (`created_at`, `last_login_at`, `name`), and `order`. `GET /admin/users/{id}` returns profile, masked account metadata, counts, recent transactions, and audit events.
- `POST /admin/users/{id}/suspend|reactivate` and `POST /admin/accounts/{id}/freeze|unfreeze` require `reason` (10-500 characters) and the admin's current `password`. They do not modify balances or ledger entries. Stable errors include `validation.current_password_invalid`, `validation.cannot_modify_admin`, `validation.already_in_state`, and `validation.account_closed`.
- `GET /admin/transactions` supports text, user email, direction, category, dates, amount bounds, `large_only`, sorting, and pagination; each row includes masked account details and `flagged_large`.
- `GET /admin/tickets`, `GET /admin/tickets/{id}`, `PATCH /admin/tickets/{id}`, and `POST /admin/tickets/{id}/messages` manage ticket status/priority, internal notes, and emailed replies. Only reply messages are sent to the customer.
- `GET /admin/audit-logs` supports exact action or trailing-asterisk prefix, actor email, entity, IP, and date filters. `GET /admin/audit-logs/actions` returns distinct action names. Sensitive metadata keys are redacted.
- Admin identities are provisioned only with `php artisan admin:create {email}` and removed from the admin role with `php artisan admin:demote {email}`; no admin registration endpoint exists.

## Validation Keys

A 422 response uses `code: "validation_failed"` and stable keys in each field's `errors` array. The complete validation key set is:

- `validation.email_required`
- `validation.email_invalid`
- `validation.email_max`
- `validation.email_taken`
- `validation.name_required`
- `validation.name_invalid`
- `validation.name_min`
- `validation.name_max`
- `validation.subject_required`
- `validation.subject_invalid`
- `validation.subject_min`
- `validation.subject_max`
- `validation.message_required`
- `validation.message_invalid`
- `validation.message_min`
- `validation.message_max`
- `validation.password_required`
- `validation.password_invalid`
- `validation.password_min`
- `validation.password_uppercase`
- `validation.password_lowercase`
- `validation.password_number`
- `validation.password_confirmed`
- `validation.password_confirmation_required`
- `validation.password_compromised`
- `validation.terms_required`
- `validation.card_limit_reached`
- `validation.card_limit_invalid`
- `validation.card_cancel_confirmation_required`
- `validation.account_inactive`
- `validation.nickname_max`
- `validation.merchant_required`
- `validation.merchant_invalid`
- `validation.current_password_invalid`
- `validation.reason_required`
- `validation.reason_min`
- `validation.reason_max`
- `validation.password_unchanged`
- `validation.cannot_revoke_current`
- `validation.phone_invalid`
- `validation.locale_invalid`
- `validation.theme_invalid`
- `validation.email_activity_invalid`
- `validation.threshold_invalid`
- `validation.month_invalid`
- `validation.remember_invalid`
- `validation.credentials_invalid`
- `validation.reset_token_required`
- `validation.reset_token_invalid`
- `validation.page_invalid`
- `validation.per_page_invalid`
- `validation.query_invalid`
- `validation.query_max`
- `validation.direction_invalid`
- `validation.category_invalid`
- `validation.date_invalid`
- `validation.date_range_order`
- `validation.date_range_max`
- `validation.amount_invalid`
- `validation.amount_range_order`
- `validation.sort_invalid`
- `validation.order_invalid`
- `validation.account_required`
- `validation.account_invalid`
- `validation.account_number_required`
- `validation.account_number_invalid`
- `validation.nickname_max`
- `validation.beneficiary_exists`
- `validation.beneficiary_self`
- `validation.beneficiary_limit`
- `validation.recipient_not_found`
- `validation.idempotency_key_required`
- `validation.memo_max`
- `validation.destination_required`
- `validation.destination_invalid`
- `validation.destination_exclusive`
- `validation.same_account`
- `validation.transfer_direction_invalid`
- `validation.biller_required`
- `validation.reference_required`
- `validation.reference_invalid`
- `validation.cannot_modify_admin`
- `validation.already_in_state`
- `validation.account_closed`

Example:

```json
{
  "code": "validation_failed",
  "message": "The given data was invalid.",
  "errors": {
    "email": ["validation.email_taken"]
  }
}
```
