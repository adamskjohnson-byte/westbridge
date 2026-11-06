import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const defaultDistDirectory = resolve(import.meta.dirname, '../dist')
const defaultExtraStyleHashesPath = resolve(import.meta.dirname, '../csp-extra-style-hashes.json')

function hashesFor(html, tagName) {
  const hashes = new Set()
  const tagPattern = new RegExp(`<${tagName}\\b([^>]*)>([\\s\\S]*?)<\\/${tagName}\\s*>`, 'gi')
  for (const match of html.matchAll(tagPattern)) {
    if (tagName === 'script' && /(?:^|\s)src\s*=/i.test(match[1])) continue
    const hash = createHash('sha256').update(match[2], 'utf8').digest('base64')
    hashes.add(`'sha256-${hash}'`)
  }
  return [...hashes].sort()
}

export function generateHeaders({
  distDirectory = defaultDistDirectory,
  apiOriginValue = process.env.API_ORIGIN,
  mode = process.env.CSP_MODE ?? 'report-only',
  extraStyleHashesPath = defaultExtraStyleHashesPath,
} = {}) {
  if (!apiOriginValue) {
    throw new Error('API_ORIGIN is required, for example https://api.example.test')
  }
  if (!['report-only', 'enforce'].includes(mode)) {
    throw new Error('CSP_MODE must be report-only or enforce')
  }

  const apiOrigin = new URL(apiOriginValue).origin
  const htmlPath = resolve(distDirectory, 'index.html')
  const headersPath = resolve(distDirectory, '_headers')
  const html = readFileSync(htmlPath, 'utf8')
  const extraStyleHashes = JSON.parse(readFileSync(extraStyleHashesPath, 'utf8')).hashes
  if (!Array.isArray(extraStyleHashes)) {
    throw new Error('Extra style hashes must be an object with a hashes array')
  }

  for (const entry of extraStyleHashes) {
    if (typeof entry.hash !== 'string' || !/^sha256-[A-Za-z0-9+/]+={0,2}$/.test(entry.hash) || typeof entry.source !== 'string') {
      throw new Error('Each extra style hash must include a valid sha256 hash and source')
    }
  }

  const scriptHashes = hashesFor(html, 'script')
  const inlineStyleHashes = hashesFor(html, 'style')
  const styleHashes = [...new Set([
    ...inlineStyleHashes,
    ...extraStyleHashes.map(({ hash }) => `'${hash}'`),
  ])].sort()
  const csp = [
    "default-src 'self'",
    `script-src 'self' ${[...scriptHashes, 'https://challenges.cloudflare.com'].join(' ')}`,
    `style-src 'self' ${styleHashes.join(' ')}`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "font-src 'self'",
    `connect-src 'self' ${apiOrigin}`,
    'frame-src https://challenges.cloudflare.com',
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ')

  const cspHeader = mode === 'enforce' ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only'
  const securityHeaders = [
    'X-Content-Type-Options: nosniff',
    'X-Frame-Options: DENY',
    'Referrer-Policy: strict-origin-when-cross-origin',
    'Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()',
    'Cross-Origin-Opener-Policy: same-origin',
    'Cross-Origin-Resource-Policy: same-site',
    'X-Permitted-Cross-Domain-Policies: none',
    'Strict-Transport-Security: max-age=31536000; includeSubDomains',
    `${cspHeader}: ${csp}`,
  ].join('\n')

  const output = [
    '/assets/*\n  Cache-Control: public, max-age=31536000, immutable',
    '/videos/*\n  Cache-Control: public, max-age=604800',
    '/index.html\n  Cache-Control: no-cache',
    `/*\n  Cache-Control: no-cache\n${securityHeaders.split('\n').map((header) => `  ${header}`).join('\n')}`,
    '',
  ].join('\n')

  writeFileSync(headersPath, output, 'utf8')
  return { headersPath, cspHeader, scriptHashes, styleHashes, apiOrigin }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = generateHeaders()
  console.log(`Generated ${result.headersPath}`)
  console.log(`${result.cspHeader} includes ${result.scriptHashes.length} inline script hash(es), ${result.styleHashes.length} inline style hash(es), and ${result.apiOrigin}`)
}