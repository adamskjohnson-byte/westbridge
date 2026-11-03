import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useDirection } from '@radix-ui/react-direction'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Sheet = DialogPrimitive.Root
export const SheetTrigger = DialogPrimitive.Trigger
export const SheetClose = DialogPrimitive.Close

export function SheetContent({
  className,
  side,
  children,
  ...props
}: DialogPrimitive.DialogContentProps & { side?: 'top' | 'right' | 'bottom' | 'left' }) {
  const { t } = useTranslation('common')
  const direction = useDirection()
  const resolvedSide = side ?? (direction === 'rtl' ? 'left' : 'right')
  const sideClass = {
    top: 'inset-x-0 top-0 border-b',
    right: 'inset-y-0 end-0 h-full w-[min(22rem,88vw)] border-s',
    bottom: 'inset-x-0 bottom-0 border-t',
    left: 'inset-y-0 start-0 h-full w-[min(22rem,88vw)] border-e',
  }[resolvedSide]

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/50" />
      <DialogPrimitive.Content
        className={cn('fixed z-50 bg-background p-6 shadow-xl outline-none', sideClass, className)}
        {...props}
      >
        {children}
        <DialogPrimitive.Close aria-label={t('accessibility.closeMenu')} className="absolute end-4 top-4 rounded-md p-2 hover:bg-accent">
          <X aria-hidden="true" className="size-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1.5', className)} {...props} />
}

export function SheetTitle({ className, ...props }: DialogPrimitive.DialogTitleProps) {
  return <DialogPrimitive.Title className={cn('type-h4', className)} {...props} />
}

export function SheetDescription({ className, ...props }: DialogPrimitive.DialogDescriptionProps) {
  return <DialogPrimitive.Description className={cn('type-small text-muted-foreground', className)} {...props} />
}