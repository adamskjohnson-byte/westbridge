import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Logo } from '@/components/layout/logo'
import { NavigationMenu, NavigationMenuItem, NavigationMenuLink, NavigationMenuList } from '@/components/ui/navigation-menu'
import { PageHeader } from '@/components/layout/page-header'
import { Section } from '@/components/layout/section'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { colorTokens, typographySamples } from '@/content/design-system'
import { usePageTitle } from '@/hooks/use-page-title'
import { useTranslatedContent } from '@/i18n/use-translated-content'

function ThemeSpecimen({ theme }: { theme: 'light' | 'dark' }) {
  const { t } = useTranslation('pages')
  const { colorTokens: translatedTokens, typographySamples: translatedSamples } = useTranslatedContent({ colorTokens, typographySamples }, 'pages', 'design')
  return (
    <section className={`theme-preview theme-preview-${theme} min-w-0 rounded-xl border border-border p-5 sm:p-7`}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="type-h3">{t('design.page.themeLabel', { theme: t(`design.page.themeNames.${theme}`) })}</h2>
        <Badge variant="outline">Manrope</Badge>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {translatedTokens.map((token) => (
          <div key={token.variable} className="min-w-0">
            <div className="h-12 rounded-md border border-border" style={{ backgroundColor: `var(--${token.variable})` }} />
            <p className="mt-1 truncate text-xs font-semibold">{token.name}</p>
            <p className="truncate text-xs text-muted-foreground">{token[theme]}</p>
          </div>
        ))}
      </div>
      <Separator className="my-7" />
      <div className="space-y-4">
        <h3 className="type-h4">{t('design.page.typography')}</h3>
        {translatedSamples.map((sample) => (
          <div key={sample.name} className="grid gap-1 border-b border-border pb-3 sm:grid-cols-[6rem_1fr] sm:items-baseline">
            <span className="text-xs font-semibold text-muted-foreground">{sample.name}</span>
            <p className={sample.className}>{sample.sample}</p>
          </div>
        ))}
      </div>
      <Separator className="my-7" />
      <div className="space-y-4">
        <h3 className="type-h4">{t('design.page.buttonsAndFields')}</h3>
        <div className="flex flex-wrap gap-2">
          <Button>{t('design.page.primary')}</Button>
          <Button variant="outline">{t('design.page.outline')}</Button>
          <Button variant="secondary">{t('design.page.secondary')}</Button>
          <Button variant="ghost">{t('design.page.ghost')}</Button>
          <Button variant="destructive">{t('design.page.destructive')}</Button>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`specimen-email-${theme}`}>{t('design.page.emailAddress')}</Label>
          <Input id={`specimen-email-${theme}`} placeholder={t('design.page.emailPlaceholder')} />
          <Label htmlFor={`specimen-note-${theme}`}>{t('design.page.message')}</Label>
          <Textarea id={`specimen-note-${theme}`} placeholder={t('design.page.notePlaceholder')} />
        </div>
      </div>
      <Separator className="my-7" />
      <div className="flex flex-wrap items-center gap-6">
        <Logo size={42} />
        <span className="rounded-md bg-brand-burgundy p-3"><Logo size={42} variant="light" /></span>
      </div>
    </section>
  )
}

function ComponentSpecimens() {
  const { t } = useTranslation('pages')
  const [sliderValue, setSliderValue] = useState([42])

  return (
    <Section variant="white">
      <div className="space-y-10">
        <div>
          <h2 className="type-h2">{t('design.page.componentSpecimens')}</h2>
          <p className="type-body mt-2 text-muted-foreground">{t('design.page.componentDescription')}</p>
        </div>
        <div className="grid gap-10 lg:grid-cols-2">
          <section aria-labelledby="navigation-specimen" className="space-y-4">
            <h3 className="type-h3" id="navigation-specimen">{t('design.page.navigationPanels')}</h3>
            <NavigationMenu>
              <NavigationMenuList>
                <NavigationMenuItem><NavigationMenuLink href="#specimen-card">{t('design.page.overview')}</NavigationMenuLink></NavigationMenuItem>
                <NavigationMenuItem><NavigationMenuLink href="#specimen-controls">{t('design.page.controls')}</NavigationMenuLink></NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
            <Card id="specimen-card">
              <CardHeader><CardTitle>{t('design.page.cardTitle')}</CardTitle><CardDescription>{t('design.page.cardDescription')}</CardDescription></CardHeader>
              <CardContent><p className="type-small">{t('design.page.cardContent')}</p></CardContent>
            </Card>
            <Accordion type="single" collapsible>
              <AccordionItem value="item-one">
                <AccordionTrigger>{t('design.page.accordionItem')}</AccordionTrigger>
                <AccordionContent>{t('design.page.accordionContent')}</AccordionContent>
              </AccordionItem>
            </Accordion>
            <Sheet>
              <SheetTrigger asChild><Button variant="outline">{t('design.page.openSheet')}</Button></SheetTrigger>
              <SheetContent>
                <SheetTitle>{t('design.page.sheetPanel')}</SheetTitle>
                <p className="mt-3 text-sm text-muted-foreground">{t('design.page.sheetDescription')}</p>
              </SheetContent>
            </Sheet>
          </section>
          <section aria-labelledby="controls-specimen" className="space-y-5" id="specimen-controls">
            <h3 className="type-h3" id="controls-specimen">{t('design.page.formControls')}</h3>
            <Tabs defaultValue="first">
              <TabsList><TabsTrigger value="first">{t('design.page.firstTab')}</TabsTrigger><TabsTrigger value="second">{t('design.page.secondTab')}</TabsTrigger></TabsList>
              <TabsContent value="first">{t('design.page.firstTabContent')}</TabsContent>
              <TabsContent value="second">{t('design.page.secondTabContent')}</TabsContent>
            </Tabs>
            <div className="grid gap-2">
              <Label htmlFor="specimen-select">{t('design.page.accountType')}</Label>
              <Select defaultValue="personal">
                <SelectTrigger aria-label={t('design.page.accountType')} id="specimen-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">{t('labels.personal')}</SelectItem>
                  <SelectItem value="business">{t('labels.business')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <Label htmlFor="specimen-slider">{t('design.page.exampleValue', { value: sliderValue[0] })}</Label>
              <Slider aria-label={t('design.page.exampleValue', { value: sliderValue[0] })} id="specimen-slider" max={100} onValueChange={setSliderValue} value={sliderValue} />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge>{t('design.page.defaultBadge')}</Badge>
              <Badge variant="secondary">{t('design.page.secondaryBadge')}</Badge>
              <Badge variant="outline">{t('design.page.outlineBadge')}</Badge>
              <Tooltip>
                <TooltipTrigger asChild><Button variant="outline">{t('design.page.tooltip')}</Button></TooltipTrigger>
                <TooltipContent>{t('design.page.tooltipDescription')}</TooltipContent>
              </Tooltip>
              <Button onClick={() => toast.success(t('design.page.demoToast'))}>{t('design.page.showToast')}</Button>
            </div>
          </section>
        </div>
        <section aria-labelledby="carousel-specimen" className="space-y-4">
          <h3 className="type-h3" id="carousel-specimen">{t('design.page.carousel')}</h3>
          <Carousel options={{ loop: false }}>
            <CarouselContent>
              {[t('design.page.firstSlide'), t('design.page.secondSlide'), t('design.page.thirdSlide')].map((slide) => (
                <CarouselItem key={slide}>
                  <div className="flex min-h-32 items-center justify-center rounded-xl border border-border bg-background p-6 text-center font-semibold">{slide}</div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
          </Carousel>
        </section>
      </div>
    </Section>
  )
}

export function Design() {
  const { t } = useTranslation('pages')
  usePageTitle(t('design.page.title'), t('design.page.description'))

  return (
    <main id="main-content">
      <Section>
        <PageHeader
          eyebrow={t('design.page.eyebrow')}
          title={t('design.page.title')}
          description={t('design.page.description')}
        />
        <div className="grid min-w-0 gap-6 xl:grid-cols-2">
          <ThemeSpecimen theme="light" />
          <ThemeSpecimen theme="dark" />
        </div>
      </Section>
      <ComponentSpecimens />
    </main>
  )
}