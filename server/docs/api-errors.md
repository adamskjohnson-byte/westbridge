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
| 419 | `csrf_mismatch` | The CSRF token is missing or invalid. |
| 422 | `validation_failed` | One or more input fields failed validation. |
| 429 | `too_many_requests` | A request limit was exceeded; `Retry-After` is included. |
| 500 | `server_error` | An unexpected server error occurred. Details are omitted when `APP_DEBUG=false`. |
| varies | Bank exception machine code | A domain-specific bank operation failed. |

## Dashboard API

Read-only dashboard routes live under `/api/v1` and require `auth:sanctum`, `verified`, and `active` middleware. Account ownership failures return `404 not_found`.

Transaction list filters use `page`, `per_page` (1-50, default 15), `q` (up to 100 characters), `direction`, repeated `category[]`, `date_from`, `date_to`, `min_amount_cents`, `max_amount_cents`, `sort` (`posted_at` or `amount_cents`), and `order` (`asc` or `desc`). Date ranges are UTC and may span at most five years.

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
