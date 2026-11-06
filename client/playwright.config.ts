import { defineConfig, devices } from '@playwright/test'

const databaseName = process.env.DB_DATABASE ?? ''
const apiPort = process.env.E2E_API_PORT ?? '8000'
const frontendPort = process.env.E2E_WEB_PORT ?? '5173'
const apiOrigin = `http://127.0.0.1:${apiPort}`
const frontendOrigin = `http://127.0.0.1:${frontendPort}`
if (!databaseName.endsWith('_e2e')) {
  throw new Error('Playwright E2E refused to start: DB_DATABASE must end with _e2e.')
}
if (process.env.DB_CONNECTION !== 'mysql') {
  throw new Error('Playwright E2E requires DB_CONNECTION=mysql.')
}

const serverEnv = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
)
Object.assign(serverEnv, {
  APP_ENV: 'local',
  DB_CONNECTION: 'mysql',
  DB_DATABASE: databaseName,
  AUTH_REQUIRE_EMAIL_VERIFICATION: 'false',
  BANK_API_RATE_LIMIT_PER_MINUTE: '1200',
  FRONTEND_URL: frontendOrigin,
  SANCTUM_STATEFUL_DOMAINS: `127.0.0.1:${frontendPort},127.0.0.1:${apiPort}`,
  VITE_API_URL: `${apiOrigin}/api`,
})

export default defineConfig({
  testDir: './tests/e2e',
  globalTeardown: './tests/e2e/global-teardown.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  outputDir: '../qa-e2e/test-results',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: frontendOrigin,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: [
    {
      command: `php artisan serve --host 127.0.0.1 --port ${apiPort} --no-reload`,
      cwd: '../server',
      url: `${apiOrigin}/api/v1/e2e/health?database=${encodeURIComponent(databaseName)}`,
      reuseExistingServer: true,
      timeout: 30_000,
      env: serverEnv,
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${frontendPort} --strictPort`,
      cwd: '.',
      url: `${frontendOrigin}/`,
      reuseExistingServer: true,
      timeout: 30_000,
      env: serverEnv,
    },
  ],
})
