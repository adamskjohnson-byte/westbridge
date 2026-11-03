import { cn } from '@/lib/utils'

type LogoProps = {
  size?: number
  variant?: 'default' | 'light'
  className?: string
}

export function Logo({ size = 40, variant = 'default', className }: LogoProps) {
  const light = variant === 'light'

  return (
    <span dir="ltr" className={cn('inline-flex items-center gap-2.5', className)}>
      <svg
        aria-hidden="true"
        width={size}
        height={size}
        viewBox="0 0 48 48"
        className="shrink-0"
      >
        <rect width="48" height="48" rx="11" fill={light ? 'var(--brand-cream)' : 'var(--brand-burgundy)'} />
        <polyline
          points="10,20 24,11 38,20"
          fill="none"
          stroke={light ? 'var(--brand-burgundy)' : 'var(--brand-cream)'}
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d="M15 24V34M24 24V34M33 24V34"
          stroke={light ? 'var(--brand-burgundy)' : 'var(--brand-cream)'}
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path d="M10 38H38" stroke="var(--brand-bronze)" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span className={cn('flex flex-col leading-none', light ? 'text-brand-cream' : 'text-foreground')}>
        <span className="text-[1.05rem] font-extrabold">Westbridge</span>
        <span lang="en" className="mt-1 text-[0.55rem] font-semibold uppercase">National Bank</span>
      </span>
    </span>
  )
}