import { describe, expect, it } from 'vitest'
import { safeRedirect } from './safeRedirect'

describe('safeRedirect', () => {
  it.each(['//evil.com', 'https://evil.com', 'javascript:alert(1)', ''])('rejects unsafe candidate %s', (candidate) => {
    expect(safeRedirect(candidate)).toBe('/dashboard')
  })

  it('keeps an internal absolute path', () => {
    expect(safeRedirect('/accounts?tab=savings')).toBe('/accounts?tab=savings')
  })
})