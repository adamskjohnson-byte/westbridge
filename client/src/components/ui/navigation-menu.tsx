import * as NavigationMenuPrimitive from '@radix-ui/react-navigation-menu'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export function NavigationMenu({ className, children, ...props }: NavigationMenuPrimitive.NavigationMenuProps) {
  return (
    <NavigationMenuPrimitive.Root className={cn('relative z-10 flex max-w-max flex-1 items-center justify-center', className)} {...props}>
      {children}
      <NavigationMenuPrimitive.Viewport className="absolute start-0 top-full mt-2 h-[var(--radix-navigation-menu-viewport-height)] w-full overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md md:w-[var(--radix-navigation-menu-viewport-width)]" />
    </NavigationMenuPrimitive.Root>
  )
}

export const NavigationMenuList = NavigationMenuPrimitive.List
export const NavigationMenuItem = NavigationMenuPrimitive.Item

export function NavigationMenuTrigger({ className, children, ...props }: NavigationMenuPrimitive.NavigationMenuTriggerProps) {
  return (
    <NavigationMenuPrimitive.Trigger className={cn('group inline-flex h-10 items-center justify-center rounded-md px-3 text-sm font-semibold hover:bg-accent hover:text-accent-foreground', className)} {...props}>
      {children}
      <ChevronDown aria-hidden="true" className="ms-1 size-3 transition-transform group-data-[state=open]:rotate-180" />
    </NavigationMenuPrimitive.Trigger>
  )
}

export function NavigationMenuContent({ className, ...props }: NavigationMenuPrimitive.NavigationMenuContentProps) {
  return <NavigationMenuPrimitive.Content className={cn('start-0 top-0 w-full md:absolute md:w-auto', className)} {...props} />
}

export function NavigationMenuLink({ className, ...props }: NavigationMenuPrimitive.NavigationMenuLinkProps) {
  return <NavigationMenuPrimitive.Link className={cn('block rounded-md p-3 text-sm hover:bg-accent', className)} {...props} />
}