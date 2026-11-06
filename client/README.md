# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## Photography fetch script

To populate the stock photography slots used in the landing pages, create a Pixabay API key and add it to your local environment file:

```bash
# client/.env.local
PIXABAY_API_KEY=your_key_here
```

Then run:

```bash
npm run photos
npm run photos -- --list
npm run photos -- --only mortgages --pick 3 --force
```

How to get a free Pixabay API key: https://pixabay.com/api/docs/

To replace any photo manually, drop a file with the same name into the matching folder under `public/images/<group>/`.

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## Real money-flow E2E tests

The Playwright suite uses the real local Laravel API and MySQL. It refuses to run unless the active database name ends in `_e2e`; by default it uses `westbridge_e2e`, never the normal `westbridge` database. Before the run it creates that database if needed and runs `migrate:fresh` against it, so all data in `westbridge_e2e` is disposable.

Create the dedicated database once using the MySQL account configured in `server/.env` (for the default XAMPP root account):

```sql
CREATE DATABASE westbridge_e2e CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON westbridge_e2e.* TO 'root'@'localhost';
```

Then run from `client/`:

```bash
npm run e2e
```

The runner starts or reuses Laravel on `127.0.0.1:8000` and Vite on `127.0.0.1:5173`. A reused API is accepted only when its local E2E health guard confirms the same `_e2e` database. Configure `DB_HOST`, `DB_PORT`, `DB_USERNAME`, and `DB_PASSWORD` in `server/.env` as needed. To select another dedicated database, set `E2E_DATABASE` to a name ending in `_e2e`.

Chromium must be installed for Playwright. Install it once with `npx playwright install chromium` from this directory. Failure traces, videos, and screenshots are written under the ignored root `qa-e2e/` directory only when a test fails. The suite creates unique users, seeds fictional funds through LedgerService, and runs bank reconciliation after each complete run.
