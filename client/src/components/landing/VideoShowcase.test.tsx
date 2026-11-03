// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VideoShowcase } from './VideoShowcase'

type ObserverCallback = (entries: IntersectionObserverEntry[]) => void

class TestIntersectionObserver {
  static instances: TestIntersectionObserver[] = []
  private readonly callback: ObserverCallback

  constructor(callback: ObserverCallback) {
    this.callback = callback
    TestIntersectionObserver.instances.push(this)
  }

  observe(): void {}
  disconnect(): void {}
  unobserve(): void {}
  takeRecords(): IntersectionObserverEntry[] { return [] }

  intersect(intersectionRatio: number): void {
    this.callback([{ intersectionRatio, isIntersecting: intersectionRatio > 0 } as IntersectionObserverEntry])
  }
}

const playCalls = { count: 0 }

function mockMotionPreference(reducedMotion: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({
      matches: reducedMotion,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  })
}

beforeEach(() => {
  TestIntersectionObserver.instances = []
  playCalls.count = 0
  vi.stubGlobal('IntersectionObserver', TestIntersectionObserver)
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
    playCalls.count += 1
    Object.defineProperty(this, 'paused', { configurable: true, value: false })
    this.dispatchEvent(new Event('play'))
    return Promise.resolve()
  })
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (this: HTMLMediaElement) {
    Object.defineProperty(this, 'paused', { configurable: true, value: true })
    this.dispatchEvent(new Event('pause'))
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('VideoShowcase', () => {
  it('starts muted and unmutes when the accessible pill is clicked', async () => {
    mockMotionPreference(false)
    render(<VideoShowcase />)

    const video = document.querySelector('video')!
    expect(video.muted).toBe(true)
    expect(screen.getByRole('button', { name: 'Unmute video' }).textContent).toContain('Tap to unmute')

    await act(async () => TestIntersectionObserver.instances[0].intersect(0.5))
    fireEvent.click(screen.getByRole('button', { name: 'Unmute video' }))

    expect(video.muted).toBe(false)
    expect(screen.queryByRole('button', { name: 'Unmute video' })).toBeNull()
  })

  it('does not autoplay with reduced motion and shows a Play button', async () => {
    mockMotionPreference(true)
    render(<VideoShowcase />)

    await waitFor(() => expect(screen.getByRole('button', { name: 'Play video' })).toBeTruthy())
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled()
  })

  it('shows the Play button when autoplay is rejected', async () => {
    mockMotionPreference(false)
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValueOnce(new Error('Autoplay blocked'))
    render(<VideoShowcase />)

    await act(async () => TestIntersectionObserver.instances[0].intersect(0.5))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Play video' })).toBeTruthy())
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledOnce()
  })

  it('pauses below 20% visibility and does not resume after a manual pause', async () => {
    mockMotionPreference(false)
    render(<VideoShowcase />)
    const video = document.querySelector('video')!
    const observer = TestIntersectionObserver.instances[0]

    await act(async () => observer.intersect(0.5))
    await waitFor(() => expect(video.paused).toBe(false))
    await act(async () => observer.intersect(0.1))
    expect(video.paused).toBe(true)

    await act(async () => observer.intersect(0.5))
    await waitFor(() => expect(video.paused).toBe(false))
    fireEvent.pause(video)
    const playCallsAfterManualPause = playCalls.count

    await act(async () => observer.intersect(0.8))
    expect(playCalls.count).toBe(playCallsAfterManualPause)
  })
})