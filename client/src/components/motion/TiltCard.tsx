import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'
import { useCardTilt } from '@/hooks/use-card-tilt'

type TiltCardProps = Omit<ComponentProps<'div'>, 'onPointerMove' | 'onPointerLeave' | 'style'> & {
  surfaceClassName?: string
  maxTilt?: number
}

export function TiltCard({ children, className, surfaceClassName, maxTilt = 4, ...props }: TiltCardProps) {
  const tilt = useCardTilt(maxTilt)

  return (
    <div
      {...props}
      {...tilt.handlers}
      className={cn('tilt-card', tilt.enabled && 'tilt-card-enabled', tilt.motionEnabled && 'tilt-card-motion-enabled', className)}
      role={props.role ?? 'article'}
      style={tilt.style}
    >
      <div className={cn('glass-card', surfaceClassName)}>{children}</div>
    </div>
  )
}