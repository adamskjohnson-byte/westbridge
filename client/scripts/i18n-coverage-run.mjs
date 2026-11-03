import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const coverageScript = path.join(scriptDirectory, 'coverage-i18n.mjs')
const coverage = spawnSync(process.execPath, [coverageScript, ...process.argv.slice(2)], { stdio: 'inherit' })
const enableCommand = process.platform === 'win32'
  ? spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', 'npm run i18n:enable'], {
      cwd: path.resolve(scriptDirectory, '..'),
      stdio: 'inherit',
    })
  : spawnSync('npm', ['run', 'i18n:enable'], {
      cwd: path.resolve(scriptDirectory, '..'),
      stdio: 'inherit',
    })

if (coverage.error) throw coverage.error
if (enableCommand.error) throw enableCommand.error
process.exitCode = coverage.status || enableCommand.status || 0
