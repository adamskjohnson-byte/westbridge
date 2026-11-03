import { useCallback, useEffect, useRef, useState } from 'react'

export type AutoplayMode = 'on-visible' | 'on-load'
export const AUTOPLAY_MODE: AutoplayMode = 'on-visible'

type UseAutoplayVideoOptions = {
  mode?: AutoplayMode
}

export function useAutoplayVideo({ mode = AUTOPLAY_MODE }: UseAutoplayVideoOptions = {}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const userPausedRef = useRef(false)
  const visibilityPauseRef = useRef(false)
  const [canAutoplay, setCanAutoplay] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [hasEnded, setHasEnded] = useState(false)

  const playVideo = useCallback((automatic = false) => {
    const video = videoRef.current
    if (!video || (automatic && hasEnded)) return

    if (!automatic) {
      userPausedRef.current = false
    }
    if (automatic) {
      video.muted = true
      setIsMuted(true)
    }

    void video.play().then(() => {
      setIsPlaying(true)
    }).catch(() => {
      setIsPlaying(false)
    })
  }, [hasEnded])

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const connection = (navigator as Navigator & { connection?: EventTarget & { saveData?: boolean } }).connection
    const updateAutoplayPermission = () => setCanAutoplay(!reducedMotion.matches && connection?.saveData !== true)

    updateAutoplayPermission()
    reducedMotion.addEventListener('change', updateAutoplayPermission)
    connection?.addEventListener('change', updateAutoplayPermission)

    return () => {
      reducedMotion.removeEventListener('change', updateAutoplayPermission)
      connection?.removeEventListener('change', updateAutoplayPermission)
    }
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!canAutoplay || !video) return

    if (mode === 'on-load') {
      playVideo(true)
      return
    }

    if (!('IntersectionObserver' in window)) return

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.intersectionRatio >= 0.5 && !userPausedRef.current && !hasEnded) {
        playVideo(true)
      } else if (entry.intersectionRatio < 0.2 && !video.paused) {
        visibilityPauseRef.current = true
        video.pause()
      }
    }, { threshold: [0, 0.2, 0.5, 1] })

    observer.observe(video)
    return () => observer.disconnect()
  }, [canAutoplay, hasEnded, mode, playVideo])

  const handlePlay = useCallback(() => setIsPlaying(true), [])

  const handlePause = useCallback(() => {
    setIsPlaying(false)
    if (visibilityPauseRef.current) {
      visibilityPauseRef.current = false
      return
    }
    userPausedRef.current = true
  }, [])

  const handleVolumeChange = useCallback(() => {
    if (videoRef.current) setIsMuted(videoRef.current.muted)
  }, [])

  const handleEnded = useCallback(() => {
    setIsPlaying(false)
    setHasEnded(true)
  }, [])

  const toggleMute = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setIsMuted(video.muted)
  }, [])

  const replay = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = 0
    setHasEnded(false)
    userPausedRef.current = false
    playVideo(false)
  }, [playVideo])

  return {
    videoRef,
    canAutoplay,
    isPlaying,
    isMuted,
    hasEnded,
    showPlayButton: !isPlaying && !hasEnded,
    play: () => playVideo(false),
    toggleMute,
    replay,
    handlePlay,
    handlePause,
    handleVolumeChange,
    handleEnded,
  }
}