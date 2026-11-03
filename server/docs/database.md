# Database Schema

All tables use InnoDB and utf8mb4. Money values use unsigned integer cents; the MySQL CHECK constraints require MySQL 8.0.16 or later. No full card number or CVV is stored.

```mermaid
erDiagram
    users ||--o{ accounts : owns
    users ||--o{ transfers : initiates
    accounts ||--o{ transfers : source
    accounts ||--o{ transfers : destination
    accounts ||--o{ transactions : records
    transfers o|--o{ transactions : posts
    users ||--o{ beneficiaries : saves
    users ||--o{ cards : owns
    accounts ||--o{ cards : funds
    users o|--o{ support_tickets : submits
    users o|--o{ audit_logs : performs

    users {
        bigint id PK
        string first_name
        string last_name
        string email UK
        string role
        string status
    }
    accounts {
        bigint id PK
        bigint user_id FK
        char account_number UK
        string type
        bigint balance_cents
        char currency
    }
    transfers {
        ulid id PK
        bigint initiated_by_user_id FK
        bigint from_account_id FK
        bigint to_account_id FK
        bigint amount_cents
        string status
    }
    transactions {
        bigint id PK
        bigint account_id FK
        ulid transfer_id FK
        bigint amount_cents
        char reference UK
        timestamp posted_at
    }
    beneficiaries {
        bigint id PK
        bigint user_id FK
        char account_number
    }
    cards {
        bigint id PK
        bigint user_id FK
        bigint account_id FK
        char last4
        smallint expiry_month
        smallint expiry_year
    }
    support_tickets {
        bigint id PK
        bigint user_id FK
        string status
        string priority
    }
    audit_logs {
        bigint id PK
        bigint user_id FK
        string action
        json metadata
    }
    newsletter_subscribers {
        bigint id PK
        string email UK
        char unsubscribe_token UK
        timestamp subscribed_at
    }
    notifications {
        uuid id PK
        string notifiable_type
        bigint notifiable_id
        string type
        text data
    }
```

- `users`: Customer/admin identity and account status.
- `accounts`: Checking and savings accounts, currency, and current cents balance.
- `transfers`: Transfer intent, participants, idempotency key, and lifecycle state.
- `transactions`: Immutable ledger entries with the resulting account balance.
- `beneficiaries`: User-saved destination account details.
- `cards`: Safe card metadata only: last four digits and expiry.
- `support_tickets`: Contact requests, optionally associated with a user.
- `audit_logs`: User-attributed or anonymous audit events with optional JSON metadata.
- `newsletter_subscribers`: Email consent, confirmation, and unsubscribe token.
- `notifications`: Laravel database notifications; created with `make:notifications-table`.

Laravel cache and queue infrastructure tables are also migrated but are omitted from this domain ER diagram.