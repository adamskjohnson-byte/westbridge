import * as SliderPrimitive from '@radix-ui/react-slider'
import { useDirection } from '@radix-ui/react-direction'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export function Slider({ className, dir, ...props }: SliderPrimitive.SliderProps) {
  const { t } = useTranslation('common')
  const direction = useDirection()
  return (
    <SliderPrimitive.Root dir={dir ?? direction} className={cn('relative flex w-full touch-none select-none items-center', className)} {...props}>
      <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      {props.value?.map((value, index) => (
        <SliderPrimitive.Thumb
          key={`${value}-${index}`}
          aria-label={props['aria-label'] ?? t('accessibility.sliderValue', { value: index + 1 })}
          className="block size-5 rounded-full border-2 border-primary bg-background shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50"
        />
      )) ?? <SliderPrimitive.Thumb className="block size-5 rounded-full border-2 border-primary bg-background shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" />}
    </SliderPrimitive.Root>
  )
}