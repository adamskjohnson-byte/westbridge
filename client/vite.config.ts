import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

function previewSecurityHeaders(): Record<string, string> {
  try {
    const lines = readFileSync(resolve(process.cwd(), 'dist/_headers'), 'utf8').split(/\r?\n/)
    const headerStart = lines.findIndex((line) => line.trim() === '/*')
    if (headerStart === -1) return {}
    const headers: Record<string, string> = {}
    for (const line of lines.slice(headerStart + 1)) {
      const trimmed = line.trim()
      if (!trimmed) continue
      if (trimmed.startsWith('/')) break
      const separator = trimmed.indexOf(':')
      if (separator > 0) headers[trimmed.slice(0, separator)] = trimmed.slice(separator + 1).trim()
    }
    return headers
  } catch {
    return {}
  }
}

// Vite integrates React, Tailwind CSS v4, and the shared source alias.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  preview: {
    headers: previewSecurityHeaders(),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.{test,spec}.{js,ts,jsx,tsx}', 'scripts/**/*.test.mjs'],
    setupFiles: ['./src/test/setup.ts'],
    environment: 'jsdom',
    pool: 'forks',
    maxWorkers: 2,
    isolate: true,
  },
})
