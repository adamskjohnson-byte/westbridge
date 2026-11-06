import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export default async function globalTeardown(): Promise<void> {
  const database = process.env.DB_DATABASE ?? ''
  if (!database.endsWith('_e2e')) {
    throw new Error('E2E teardown refused: DB_DATABASE does not end with _e2e.')
  }

  const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../server')
  const env = {
    ...process.env,
    APP_ENV: 'local',
    DB_CONNECTION: 'mysql',
    DB_DATABASE: database,
  }

  try {
    const output = execFileSync('php', ['artisan', 'dev:e2e-reconcile'], {
      cwd: serverRoot,
      env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    process.stdout.write(output)
  } catch (error) {
    const result = error as { stdout?: string; stderr?: string }
    process.stderr.write(result.stdout ?? '')
    process.stderr.write(result.stderr ?? '')
    throw new Error(`E2E database reconciliation failed for ${database}.`, { cause: error })
  }
}

