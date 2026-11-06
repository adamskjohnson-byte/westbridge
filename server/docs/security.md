# Security Overview

Westbridge is a fictional learning simulator. It must not be used for real accounts, funds, payment cards, or personal financial information.

## Protections

- Authentication uses Laravel sessions and Sanctum's stateful SPA flow, CSRF protection, secure production cookies, active/verified account checks, and server-side role authorization.
- Admin accounts can be required to complete email-code two-factor authentication. Customers can enable the same challenge flow from Security settings. Challenges expire, are single-use, and lock after the configured failed-attempt limit.
- Public registration and other public submission routes use Cloudflare Turnstile when enabled. The API independently verifies tokens with Cloudflare; the browser state alone is not trusted.
- Password changes require the current password and are audited. Admin changes require a reason and password. Sensitive actions revoke affected sessions where specified.
- Money is represented in integer cents. Ledger entries are immutable; transfers, bill payments, and card purchases are transactional and use row locks/idempotency controls. `bank:reconcile` checks stored balances against the ledger.
- Card data is limited to last four digits and expiry; full card numbers and CVV are not stored.
- API responses add `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, COOP/CORP, no-store caching, and a restrictive API CSP. HSTS is sent only for secure production requests.
- Production React builds generate Cloudflare Pages security headers and a CSP from hashes of built inline scripts/styles. CSP defaults to `Content-Security-Policy-Report-Only`; inspect reports before setting `CSP_MODE=enforce`.
- `TRUSTED_PROXIES` defaults to no trusted proxies. `TRUST_CF_CONNECTING_IP` defaults false; when enabled, the Cloudflare client-IP header is accepted only from a listed proxy address.
- `app:preflight` checks production-only configuration and reports unsafe or incomplete deployment settings.

## Known Limitations

- Email-code 2FA depends on a working mail provider and protects against neither a compromised mailbox nor phishing. It is not a hardware-key or authenticator-app implementation.
- CSP permits inline style attributes for framework-generated styles. Report-only mode is not enforcement; production reports must be reviewed before enforcement.
- The static frontend and API are deployed separately. Their exact HTTPS origins, cookie parent domain, CORS allowlist, Sanctum stateful domains, and CSP `API_ORIGIN` must agree.
- Forwarded client IPs are trustworthy only when the origin is network-restricted to the configured proxy. A broad or wildcard proxy list can make rate limits and audit IP attribution unreliable.
- Local and automated test environments intentionally use fake identities, fake mail, non-production cookies, and test Turnstile settings. These are not production security settings.
- This demo has no real banking rails, external fraud monitoring, regulatory coverage, or production incident-response service.