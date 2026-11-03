import { useCallback, useEffect, useState, type CSSProperties, type PointerEvent } from 'react'

type CardTiltStyle = CSSProperties & {
  '--card-tilt-x'?: string
  '--card-tilt-y'?: string
  '--mx'?: string
  '--my'?: string
}

export function useCardTilt(maxTilt = 6) {
  const [motionEnabled, setMotionEnabled] = useState(() => {
    if (typeof window === 'undefined') return false
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })
  const [enabled, setEnabled] = useState(() => typeof window !== 'undefined'
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    && window.matchMedia('(hover: hover) and (pointer: fine)').matches)
  const [style, setStyle] = useState<CardTiltStyle>({})

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const hoverPointer = window.matchMedia('(hover: hover) and (pointer: fine)')
    const updateEnabled = () => {
      setMotionEnabled(!reducedMotion.matches)
      setEnabled(!reducedMotion.matches && hoverPointer.matches)
    }
    updateEnabled()
    reducedMotion.addEventListener('change', updateEnabled)
    hoverPointer.addEventListener('change', updateEnabled)

    return () => {
      reducedMotion.removeEventListener('change', updateEnabled)
      hoverPointer.removeEventListener('change', updateEnabled)
    }
  }, [])

  const onPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const horizontal = (event.clientX - bounds.left) / bounds.width - 0.5
    const vertical = (event.clientY - bounds.top) / bounds.height - 0.5
    setStyle({
      '--card-tilt-x': `${-vertical * maxTilt * 2}deg`,
      '--card-tilt-y': `${horizontal * maxTilt * 2}deg`,
      '--mx': `${Math.max(0, Math.min(1, horizontal + 0.5)) * 100}%`,
      '--my': `${Math.max(0, Math.min(1, vertical + 0.5)) * 100}%`,
    })
  }, [maxTilt])

  const onPointerLeave = useCallback(() => setStyle({}), [])

  return {
    enabled,
    motionEnabled,
    style: enabled ? style : {},
    handlers: enabled ? { onPointerMove, onPointerLeave } : {},
  }
}