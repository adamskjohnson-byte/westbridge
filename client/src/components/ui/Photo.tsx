import { ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type PhotoProps = {
  src: string
  alt: string
  width: number
  height: number
  className?: string
  priority?: boolean
  objectPosition?: string
}

export function Photo({ src, alt, width, height, className, priority = false, objectPosition = 'center' }: PhotoProps) {
  return (
    <div
      aria-hidden={alt ? undefined : true}
      className={cn('relative overflow-hidden rounded-[inherit] bg-[linear-gradient(135deg,var(--brand-cream),var(--brand-stone))] text-[var(--brand-burgundy)]', className)}
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      <img
        alt={alt}
        className="h-full w-full object-cover"
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
        loading={priority ? 'eager' : 'lazy'}
        onError={(event) => {
          const target = event.currentTarget
          target.style.display = 'none'
          const fallback = target.parentElement?.querySelector('[data-fallback]') as HTMLElement | null
          if (fallback) fallback.style.display = 'flex'
        }}
        src={src}
        style={{ objectPosition }}
        width={width}
        height={height}
      />
      <div
        data-fallback
        className="absolute inset-0 hidden items-center justify-center bg-[linear-gradient(135deg,var(--brand-cream),var(--brand-stone))]"
        aria-hidden="true"
      >
        <ImageIcon aria-hidden="true" className="size-10 opacity-70" />
      </div>
    </div>
  )
}
