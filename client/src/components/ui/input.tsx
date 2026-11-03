import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export function Input({ className, dir, type = 'text', ...props }: ComponentProps<'input'>) {
  const direction = ['email', 'tel', 'url', 'number', 'password'].includes(type) ? 'ltr' : undefined
  return (
    <input
      type={type}
      dir={dir ?? direction}
      className={cn(
        'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-start text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}