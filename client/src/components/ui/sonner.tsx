import { useDirection } from '@radix-ui/react-direction'
import { Toaster as SonnerToaster, type ToasterProps } from 'sonner'

export function Toaster(props: ToasterProps) {
  const direction = useDirection()
  return <SonnerToaster closeButton position={direction === 'rtl' ? 'top-left' : 'top-right'} {...props} />
}