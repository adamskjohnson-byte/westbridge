import { spawnSync } from 'node:child_process'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const serverRoot = path.resolve(clientRoot, '../server')
const database = process.env.E2E_DATABASE ?? 'westbridge_e2e'
const forwardedArgs = process.argv.slice(2)
const skipPrepareIndex = forwardedArgs.indexOf('--skip-prepare')
const skipPrepare = skipPrepareIndex !== -1
if (skipPrepare) forwardedArgs.splice(skipPrepareIndex, 1)

if (!/^[A-Za-z0-9_]+_e2e$/.test(database)) {
  console.error('E2E_DATABASE must be a MySQL database name ending in _e2e. No commands were run.')
  process.exit(2)
}

function portAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', () => resolve(false))
    server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)))
  })
}

async function existingApiIsSafe(port) {
  const url = `http://127.0.0.1:${port}/api/v1/e2e/health?database=${encodeURIComponent(database)}`
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1500) })
    const result = await response.json().catch(() => null)
    return response.ok && result?.safe === true
  } catch {
    return false
  }
}

async function chooseApiPort() {
  if (await portAvailable(8000)) return 8000
  if (await existingApiIsSafe(8000)) {
    console.log(`Reusing API on port 8000 guarded for ${database}.`)
    return 8000
  }
  for (let port = 8001; port <= 8020; port += 1) {
    if (await portAvailable(port)) {
      console.warn(`Port 8000 is occupied by an API not verified for ${database}; leaving it untouched and using ${port}.`)
      return port
    }
  }
  throw new Error('No safe local API port is available in the 8000-8020 range.')
}

async function chooseFrontendPort() {
  if (await portAvailable(5173)) return 5173
  for (let port = 5174; port <= 5199; port += 1) {
    if (await portAvailable(port)) {
      console.warn(`Port 5173 is occupied; leaving it untouched and using ${port} for the isolated E2E frontend.`)
      return port
    }
  }
  throw new Error('No local frontend port is available in the 5173-5199 range.')
}

const apiPort = await chooseApiPort()
const frontendPort = await chooseFrontendPort()
const apiUrl = `http://127.0.0.1:${apiPort}`
const frontendUrl = `http://127.0.0.1:${frontendPort}`
const env = {
  ...process.env,
  APP_ENV: 'local',
  APP_DEBUG: 'false',
  AUTH_REQUIRE_EMAIL_VERIFICATION: 'false',
  BANK_API_RATE_LIMIT_PER_MINUTE: '1200',
  DB_CONNECTION: 'mysql',
  DB_DATABASE: database,
  E2E_API_PORT: String(apiPort),
  E2E_WEB_PORT: String(frontendPort),
  E2E_API_URL: `${apiUrl}/api`,
  E2E_FRONTEND_URL: frontendUrl,
  FRONTEND_URL: frontendUrl,
  SANCTUM_STATEFUL_DOMAINS: `127.0.0.1:${frontendPort},127.0.0.1:${apiPort}`,
  VITE_API_URL: `${apiUrl}/api`,
}

function runPhp(args, cwd = serverRoot) {
  const result = spawnSync('php', ['artisan', ...args], { cwd, env, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

runPhp(['config:clear'])
if (skipPrepare) {
  console.log(`Using existing isolated E2E database ${database}; it will not be reset.`)
} else {
  runPhp(['dev:e2e-prepare'])
}
console.log(`Running real-money-flow E2E against ${database}; UI ${frontendUrl}; API ${apiUrl}. Playwright waits up to 30 seconds for both health URLs before tests start.`)

const playwrightCli = path.join(clientRoot, 'node_modules', '@playwright', 'test', 'cli.js')
const result = spawnSync(process.execPath, [playwrightCli, 'test', '--config=playwright.config.ts', ...forwardedArgs], {
  cwd: clientRoot,
  env,
  stdio: 'inherit',
})
if (result.error) throw result.error
process.exitCode = result.status ?? 1
