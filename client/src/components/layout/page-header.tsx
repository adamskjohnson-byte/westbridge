import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

type PageHeaderProps = ComponentProps<'header'> & {
  title: string
  description?: string
  eyebrow?: string
}

export function PageHeader({ className, title, description, eyebrow, ...props }: PageHeaderProps) {
  return (
    <header className={cn('mb-8 max-w-3xl', className)} {...props}>
      {eyebrow && <p className="mb-2 text-sm font-semibold text-primary">{eyebrow}</p>}
      <h1 className="type-h1">{title}</h1>
      {description && <p className="type-body mt-3 text-muted-foreground">{description}</p>}
    </header>
  )
}