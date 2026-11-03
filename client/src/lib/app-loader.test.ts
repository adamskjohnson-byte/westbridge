// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startAppLoader } from './app-loader'

describe('app loader', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app-loader"></div>'
    document.body.style.overflow = ''
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('hides the loader and dispatches app:ready', async () => {
    vi.useFakeTimers()
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    const loader = document.getElementById('app-loader')!

    startAppLoader({
      readyPromise: Promise.resolve(),
      minDelayMs: 600,
      maxDelayMs: 2500,
      now: () => 0,
      prefersReducedMotion: false,
    })

    await Promise.resolve()
    vi.advanceTimersByTime(600)

    expect(loader.classList.contains('is-hiding')).toBe(true)
    expect(dispatchSpy).toHaveBeenCalled()
  })

  it('hides without the delay when reduced motion is enabled', () => {
    vi.useFakeTimers()
    const loader = document.getElementById('app-loader')!

    startAppLoader({
      readyPromise: Promise.resolve(),
      minDelayMs: 600,
      maxDelayMs: 2500,
      now: () => 0,
      prefersReducedMotion: true,
    })

    vi.runOnlyPendingTimers()
    vi.runOnlyPendingTimers()

    expect(loader.classList.contains('is-hiding')).toBe(true)
    expect(document.body.style.overflow).toBe('')
  })

  it('restores scroll when the maximum timeout path is taken', () => {
    vi.useFakeTimers()
    const loader = document.getElementById('app-loader')!
    document.body.style.overflow = 'auto'

    startAppLoader({
      readyPromise: Promise.resolve(),
      minDelayMs: 600,
      maxDelayMs: 10,
      now: () => 0,
      prefersReducedMotion: false,
    })

    vi.advanceTimersByTime(10)
    vi.advanceTimersByTime(400)

    expect(document.body.style.overflow).toBe('auto')
    expect(loader.isConnected).toBe(false)
  })
})
