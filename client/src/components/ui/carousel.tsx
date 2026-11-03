import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react'
import useEmblaCarousel, { type UseEmblaCarouselType } from 'embla-carousel-react'
import type { EmblaOptionsType, EmblaPluginType } from 'embla-carousel'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useDirection } from '@radix-ui/react-direction'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

type EmblaApi = UseEmblaCarouselType[1]
type CarouselContextValue = {
  viewportRef: UseEmblaCarouselType[0]
  api: EmblaApi
  canScrollPrev: boolean
  canScrollNext: boolean
  scrollPrev: () => void
  scrollNext: () => void
}

const CarouselContext = createContext<CarouselContextValue | null>(null)

function useCarousel() {
  const context = useContext(CarouselContext)
  if (!context) throw new Error('Carousel components must be used inside Carousel')
  return context
}

type CarouselProps = PropsWithChildren<{
  options?: EmblaOptionsType
  plugins?: EmblaPluginType[]
  className?: string
  setApi?: (api: EmblaApi) => void
}>

export function Carousel({ children, options, plugins, className, setApi }: CarouselProps) {
  const direction = useDirection()
  const [viewportRef, api] = useEmblaCarousel({ ...options, direction }, plugins)
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)

  useEffect(() => {
    if (!api) return
    setApi?.(api)
    const updateButtons = () => {
      setCanScrollPrev(api.canScrollPrev())
      setCanScrollNext(api.canScrollNext())
    }
    updateButtons()
    api.on('select', updateButtons)
    api.on('reInit', updateButtons)
    return () => {
      api.off('select', updateButtons)
      api.off('reInit', updateButtons)
    }
  }, [api, setApi])

  const value: CarouselContextValue = {
    viewportRef,
    api,
    canScrollPrev,
    canScrollNext,
    scrollPrev: () => api?.scrollPrev(),
    scrollNext: () => api?.scrollNext(),
  }

  return (
    <CarouselContext.Provider value={value}>
      <div className={cn('relative', className)} aria-roledescription="carousel">
        {children}
      </div>
    </CarouselContext.Provider>
  )
}

export function CarouselContent({ className, children, ...props }: React.ComponentProps<'div'>) {
  const { viewportRef } = useCarousel()
  return (
    <div ref={viewportRef} className="overflow-hidden">
      <div className={cn('flex touch-pan-y', className)} {...props}>{children}</div>
    </div>
  )
}

export function CarouselItem({ className, ...props }: React.ComponentProps<'div'>) {
  return <div role="group" aria-roledescription="slide" className={cn('min-w-0 flex-[0_0_100%]', className)} {...props} />
}

export function CarouselPrevious({ className, ...props }: React.ComponentProps<typeof Button>) {
  const { t } = useTranslation('common')
  const { canScrollPrev, scrollPrev } = useCarousel()
  return <Button aria-label={t('carousel.previous')} className={cn('absolute start-2 top-1/2 -translate-y-1/2', className)} disabled={!canScrollPrev} onClick={scrollPrev} size="icon" variant="outline" {...props}><ArrowLeft aria-hidden="true" className="rtl:rotate-180" /></Button>
}

export function CarouselNext({ className, ...props }: React.ComponentProps<typeof Button>) {
  const { t } = useTranslation('common')
  const { canScrollNext, scrollNext } = useCarousel()
  return <Button aria-label={t('carousel.next')} className={cn('absolute end-2 top-1/2 -translate-y-1/2', className)} disabled={!canScrollNext} onClick={scrollNext} size="icon" variant="outline" {...props}><ArrowRight aria-hidden="true" className="rtl:rotate-180" /></Button>
}