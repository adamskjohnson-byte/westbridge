import { useEffect, useRef, useState } from 'react'
import { formatCurrencyCents } from '@/lib/format'
import { Ltr } from '@/components/ui/Ltr'

type CountUpProps = {
  cents: number
  className?: string
}

export function CountUp({ cents, className }: CountUpProps) {
  const [displayedCents, setDisplayedCents] = useState(0)
  const animated = useRef(false)

  useEffect(() => {
    if (animated.current) {
      setDisplayedCents(cents)
      return
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || cents === 0) {
      animated.current = true
      setDisplayedCents(cents)
      return
    }

    animated.current = true
    const target = BigInt(cents)
    const durationMs = 700n
    let startTime: number | null = null
    let frame = 0

    const tick = (timestamp: number) => {
      startTime ??= timestamp
      const elapsedMs = BigInt(Math.min(Number(durationMs), Math.max(0, Math.trunc(timestamp - startTime))))
      const current = target * elapsedMs / durationMs
      setDisplayedCents(Number(current))

      if (elapsedMs < durationMs) {
        frame = window.requestAnimationFrame(tick)
      } else {
        setDisplayedCents(cents)
      }
    }

    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [cents])

  return <Ltr><span className={className}>{formatCurrencyCents(displayedCents)}</span></Ltr>
}