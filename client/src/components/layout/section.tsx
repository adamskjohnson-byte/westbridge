import type { ComponentProps } from 'react'
import { Container } from '@/components/layout/container'
import { cn } from '@/lib/utils'

type SectionProps = ComponentProps<'section'> & {
  variant?: 'cream' | 'white' | 'burgundy'
  container?: boolean
}

const variants = {
  cream: 'bg-background text-foreground',
  white: 'bg-card text-foreground',
  burgundy: 'bg-primary text-primary-foreground',
}

export function Section({ className, variant = 'cream', container = true, children, ...props }: SectionProps) {
  const content = container ? <Container>{children}</Container> : children
  return <section className={cn('section-padding', variants[variant], className)} {...props}>{content}</section>
}