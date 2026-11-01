# Westbridge National Bank

Westbridge is a simulated bank for learning. Use fake money only; never enter real financial or personal data.

## Prerequisites

- Node.js LTS and npm
- PHP 8.2 or newer and Composer
- MySQL

## Setup

### Client

```powershell
cd client
npm install
Copy-Item .env.example .env
npm run dev
```

### Server

Create a MySQL database named `westbridge`, then configure `server/.env` from `.env.example` with local database credentials and a generated `APP_KEY`.

```powershell
cd server
composer install
Copy-Item .env.example .env
php artisan key:generate
php artisan migrate
php artisan serve
```

The client runs at `http://localhost:5173`; the API runs at `http://localhost:8000`. The Home placeholder checks `/api/health` in development.

## Configuration Notes

- `.gitignore` excludes dependencies, build output, local environment files, and editor metadata.
- `.editorconfig` keeps whitespace and line endings consistent across editors.
- `client/vite.config.ts` enables React, Tailwind CSS v4, and the `@` source alias.
- `client/tsconfig.app.json` enables strict TypeScript checking and mirrors the source alias; `tsconfig.node.json` checks build tooling.
- `client/package.json` defines app dependencies and the development, build, lint, formatting, and test commands.
- `client/eslint.config.js` applies flat ESLint rules to JavaScript and TypeScript source.
- `client/components.json` holds shadcn/ui generator defaults.
- `client/src/index.css` imports Tailwind CSS v4 and Manrope, and defines the shared brand tokens.
- `server/.env.example` documents local Laravel and MySQL settings; do not commit `.env`.
- `server/config/cors.php` restricts credentialed API CORS requests to `FRONTEND_URL`.
- `server/bootstrap/app.php` registers API routes without web routes; `server/phpunit.xml` configures the PHPUnit test suites.

Demo only. Westbridge National Bank is not a real bank. No real money is held.