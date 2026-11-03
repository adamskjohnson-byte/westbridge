import type { PropsWithChildren } from 'react'
import { cn } from '@/lib/utils'
import { useInView } from '@/hooks/use-in-view'

type RevealProps = PropsWithChildren<{ className?: string }>

export function Reveal({ children, className }: RevealProps) {
  const { ref, visible } = useInView<HTMLDivElement>()

  return (
    <div
      className={cn(
        'transition-[opacity,transform] duration-500 ease-out motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
        className,
      )}
      ref={ref}
    >
      {children}
    </div>
  )
}