import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { generateHeaders } from './generate-headers.mjs'

const temporaryDirectories = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('generateHeaders', () => {
  it('includes extra runtime style hashes without allowing inline scripts or eval', () => {
    const directory = mkdtempSync(join(tmpdir(), 'westbridge-csp-'))
    temporaryDirectories.push(directory)
    const extraHashesPath = join(directory, 'extra-hashes.json')
    const distDirectory = join(directory, 'dist')
    const extraHashes = [
      'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=',
      'sha256-StEaX+se6YS7pqjzrzMIA0KaX9zF/8zAhvQXZAe5epY=',
    ]

    mkdirSync(distDirectory, { recursive: true })
    writeFileSync(join(distDirectory, 'index.html'), '<script>globalThis.ready = true</script><style>body{color:black}</style>')
    writeFileSync(extraHashesPath, JSON.stringify({
      hashes: extraHashes.map((hash) => ({ hash, source: 'test library 1.0.0' })),
    }))

    const result = generateHeaders({
      distDirectory,
      extraStyleHashesPath: extraHashesPath,
      apiOriginValue: 'http://127.0.0.1:8000',
    })
    const headers = readFileSync(result.headersPath, 'utf8')
    const styleSource = headers.match(/style-src ([^;]+)/)?.[1] ?? ''
    const scriptSource = headers.match(/script-src ([^;]+)/)?.[1] ?? ''

    for (const hash of extraHashes) expect(styleSource).toContain(`'${hash}'`)
    expect(scriptSource).not.toContain("'unsafe-inline'")
    expect(scriptSource).not.toContain("'unsafe-eval'")
    expect(result.cspHeader).toBe('Content-Security-Policy-Report-Only')
  })
})