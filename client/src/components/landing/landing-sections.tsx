import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm, type FieldPath, type FieldValues, type UseFormSetError } from 'react-hook-form'
import { z } from 'zod'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Container } from '@/components/layout/container'
import { Section } from '@/components/layout/section'
import { landingContent } from '@/content/landing'
import { submitContactMessage, type ContactFormValues } from '@/features/contact/api'
import { submitNewsletterSignup, type NewsletterSignupValues } from '@/features/newsletter/api'
import { calculateLoanPayment, calculateSavingsGrowth } from '@/lib/finance'
import { cn } from '@/lib/utils'
import { ApiError } from '@/lib/api'
import { useInView } from '@/hooks/use-in-view'
import { formatPercent } from '@/lib/format'
import { formatCurrency } from '@/lib/format'
import { toast } from 'sonner'
import { ArrowRight, ArrowRightLeft, Building2, CheckCircle2, CreditCard, Landmark, Mail, MapPin, PiggyBank, ShieldCheck, Sparkles, WalletCards } from 'lucide-react'
import { Link } from 'react-router-dom'
import { HeroCard } from '@/components/landing/HeroCard'
import { TiltCard } from '@/components/motion/TiltCard'
import { Photo } from '@/components/ui/Photo'
import { imageSlots } from '@/content/images'
import { useTranslatedContent } from '@/i18n/use-translated-content'

function useLandingContent() {
  return useTranslatedContent(landingContent, 'landing')
}

function useLandingImages() {
  return useTranslatedContent(imageSlots, 'pages', 'images')
}

const productIcons = {
  checking: WalletCards,
  savings: PiggyBank,
  'credit-cards': CreditCard,
  loans: Landmark,
  mortgages: Building2,
} as const

const featureIcons = [ArrowRightLeft, CheckCircle2, Sparkles, WalletCards, CreditCard, ShieldCheck] as const

type ApiErrorPayload = {
  message?: string
  errors?: Record<string, string[]>
}

function showPublicFormError<T extends FieldValues>(
  error: unknown,
  fields: readonly FieldPath<T>[],
  setError: UseFormSetError<T>,
  translate: (key: string) => string,
) {
  if (error instanceof ApiError && error.status === 429) {
    toast.error(translate('forms.errors.rateLimit'))
    return
  }

  if (error instanceof ApiError && error.status === 422) {
    const payload = error.body as ApiErrorPayload | null
    let mappedError = false

    for (const field of fields) {
      const message = payload?.errors?.[String(field)]?.[0]
      if (message) {
        setError(field, { type: 'server', message })
        mappedError = true
      }
    }

    if (!mappedError) toast.error(translate('forms.errors.reviewAndRetry'))
    return
  }

  if (error instanceof TypeError) {
    toast.error(translate('forms.errors.connection'))
    return
  }

  toast.error(translate('forms.errors.submit'))
}

function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const { ref, visible } = useInView<HTMLDivElement>()

  return (
    <div
      ref={ref}
      className={cn(
        'transition-all duration-500 ease-out motion-reduce:transition-none',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function HeroSection() {
  const { hero } = useLandingContent()
  return (
    <section id="hero" className="bg-glow-hero relative overflow-hidden">
      <Container className="relative py-12 sm:py-16 lg:py-20">
          <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
            <div className="max-w-xl">
              <Reveal>
                <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-burgundy)]">{hero.eyebrow}</p>
                <h1 className="type-display text-[var(--foreground)]">{hero.headline}</h1>
                <p className="mt-5 max-w-lg text-base text-[var(--muted-foreground)] sm:text-lg">{hero.subheadline}</p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <Link className={cn(buttonVariants({ size: 'lg' }), 'btn-gradient')} to="/register">
                    {hero.primaryCta}
                  </Link>
                  <Link className={buttonVariants({ variant: 'outline', size: 'lg' })} to={landingContent.hero.secondaryCtaHref}>
                    {hero.secondaryCta}
                  </Link>
                </div>
              </Reveal>
            </div>

            <Reveal className="w-full justify-self-center lg:justify-self-end">
              <HeroCard />
            </Reveal>
          </div>
        </Container>
    </section>
  )
}

export function TrustBarSection() {
  const { trust } = useLandingContent()

  return (
    <section id="trust" className="border-y border-[var(--border)] bg-[var(--card)]">
      <Container className="py-8 sm:py-10">
        <Reveal className="grid gap-5 text-center sm:grid-cols-2 xl:grid-cols-4">
          {trust.stats.map((stat) => (
            <TiltCard key={stat.label} surfaceClassName="h-full rounded-2xl px-4 py-6 text-center">
              <p className="text-2xl font-extrabold text-[var(--foreground)] sm:text-3xl">{stat.value}</p>
              <p className="mt-2 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--primary)]">{stat.label}</p>
              <p className="mt-2 text-xs text-[var(--muted-foreground)]">{stat.note}</p>
            </TiltCard>
          ))}
        </Reveal>
        <p className="mt-5 text-center text-xs font-medium text-[var(--muted-foreground)]">{trust.note}</p>
      </Container>
    </section>
  )
}

export function ProductsSection() {
  const { t } = useTranslation()
  const { products } = useLandingContent()
  const images = useLandingImages()

  return (
    <section id="products" className="bg-glow-soft bg-[var(--background)]">
      <Container className="py-16 sm:py-20">
        <Reveal>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">{products.eyebrow}</p>
          <h2 className="mt-3 type-h2 max-w-xl text-[var(--foreground)]">{products.title}</h2>
        </Reveal>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {products.items.map((product) => {
            const Icon = productIcons[product.slug as keyof typeof productIcons]
            const photo = images.products[product.slug as keyof typeof images.products]

            return (
              <Reveal key={product.slug} className="h-full">
                <TiltCard className="h-full overflow-hidden rounded-[1.4rem]" surfaceClassName="flex h-full flex-col overflow-hidden rounded-[1.4rem]">
                  <Photo
                    alt={photo.alt}
                    className="h-[150px] w-full border-b border-[var(--border)]"
                    height={photo.height}
                    objectPosition="center"
                    priority={false}
                    src={photo.src}
                    width={photo.width}
                  />
                  <div className="flex h-full flex-col p-5">
                    <div className="mb-4 inline-flex size-11 items-center justify-center rounded-xl bg-[var(--brand-cream)] text-[var(--primary)]">
                      <Icon aria-hidden="true" className="size-5" />
                    </div>
                    <h3 className="text-xl font-bold text-[var(--foreground)]">{product.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">{product.description}</p>
                    <Link className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-semibold text-[var(--primary)]" to={`/products#${product.slug}`}>
                      {t('actions.exploreProduct', { ns: 'pages', product: product.title })} <ArrowRight aria-hidden="true" className="size-4 rtl:rotate-180" />
                    </Link>
                  </div>
                </TiltCard>
              </Reveal>
            )
          })}
        </div>
      </Container>
    </section>
  )
}

export function WhyWestbridgeSection() {
  const { whyWestbridge } = useLandingContent()
  const images = useLandingImages()

  return (
    <Section id="why-westbridge" variant="white" className="bg-glow-soft">
      <Reveal>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">{whyWestbridge.eyebrow}</p>
        <h2 className="mt-3 type-h2 max-w-xl text-[var(--foreground)]">{whyWestbridge.title}</h2>
      </Reveal>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
          {whyWestbridge.items.map((item, index) => {
            const Icon = featureIcons[index]

            return (
              <Reveal key={index} className="h-full">
                <TiltCard className="h-full rounded-[1.4rem]" surfaceClassName="flex h-full flex-col rounded-[1.4rem] p-5">
                  <div className="mb-4 inline-flex size-11 items-center justify-center rounded-xl bg-[var(--brand-cream)] text-[var(--brand-burgundy)]">
                    <Icon aria-hidden="true" className="size-5" />
                  </div>
                  <h3 className="text-lg font-bold text-[var(--foreground)]">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">{item.description}</p>
                </TiltCard>
              </Reveal>
            )
          })}
        </div>

        <Reveal className="lg:ps-2">
          <Photo
            alt={images.sections.support.alt}
            className="h-[320px] w-full rounded-[1.5rem] border border-[var(--border)] shadow-[0_18px_40px_rgba(42,35,39,0.08)] sm:h-[360px] lg:h-[420px]"
            height={images.sections.support.height}
            objectPosition="center"
            priority={false}
            src={images.sections.support.src}
            width={images.sections.support.width}
          />
        </Reveal>
      </div>
    </Section>
  )
}

export function HowItWorksSection() {
  const { steps } = useLandingContent()

  return (
    <Section id="how-it-works" variant="burgundy" className="bg-glow-soft relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_60%)]" />
      <Container className="relative">
        <Reveal>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-cream)]/80">{steps.eyebrow}</p>
          <h2 className="mt-3 type-h2 max-w-xl text-[var(--brand-cream)]">{steps.title}</h2>
        </Reveal>

        <div className="relative mt-10 grid gap-6 md:grid-cols-3">
          <div className="pointer-events-none absolute inset-x-12 top-7 hidden h-px bg-white/20 md:block" />
          <div className="pointer-events-none absolute start-6 top-0 bottom-0 hidden w-px bg-white/20 md:hidden" />

          {steps.items.map((step) => (
            <Reveal key={step.number} className="relative">
              <TiltCard className="rounded-[1.5rem]" surfaceClassName="rounded-[1.5rem] p-5 md:min-h-[18rem]">
                <div className="mb-5 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-cream)]/70">{step.number}</span>
                  <span className="flex size-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-sm font-bold text-[var(--brand-cream)]">{step.number}</span>
                </div>
                <h3 className="text-2xl font-bold text-[var(--brand-cream)]">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[var(--brand-cream)]/80">{step.description}</p>
              </TiltCard>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  )
}

export function CalculatorsSection() {
  const { t } = useTranslation('landing')
  const { calculators } = useLandingContent()
  const [loanAmount, setLoanAmount] = useState(250000)
  const [loanRate, setLoanRate] = useState(5.5)
  const [loanYears, setLoanYears] = useState(30)
  const [initialDeposit, setInitialDeposit] = useState(5000)
  const [monthlyContribution, setMonthlyContribution] = useState(250)
  const [savingsRate, setSavingsRate] = useState(4.5)
  const [savingsYears, setSavingsYears] = useState(5)

  const loanResult = useMemo(
    () => calculateLoanPayment(loanAmount, loanRate, loanYears),
    [loanAmount, loanRate, loanYears],
  )

  const savingsResult = useMemo(
    () => calculateSavingsGrowth(initialDeposit, monthlyContribution, savingsRate, savingsYears),
    [initialDeposit, monthlyContribution, savingsRate, savingsYears],
  )

  const chartValues = useMemo(() => {
    const yearsToShow = Math.max(1, savingsYears)
    const points = Array.from({ length: Math.min(6, yearsToShow + 1) }, (_, index) => {
      const year = index
      return calculateSavingsGrowth(initialDeposit, monthlyContribution, savingsRate, year).finalBalance
    })

    const maxValue = Math.max(...points, 1)
    const minValue = Math.min(...points, 0)

    return points.map((value, index) => ({
      year: index,
      value,
      x: (index / Math.max(points.length - 1, 1)) * 100,
      y: 100 - ((value - minValue) / Math.max(maxValue - minValue, 1)) * 100,
    }))
  }, [initialDeposit, monthlyContribution, savingsRate, savingsYears])

  const chartPath = chartValues.map((point) => `${point.x},${point.y}`).join(' ')

  return (
    <section id="calculators" className="bg-[var(--background)]">
      <Container className="py-16 sm:py-20">
        <Reveal>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">{calculators.eyebrow}</p>
          <h2 className="mt-3 type-h2 max-w-xl text-[var(--foreground)]">{calculators.title}</h2>
        </Reveal>

        <div className="mt-8">
          <Tabs defaultValue="loan" className="w-full">
            <TabsList className="mb-6 w-full justify-start overflow-x-auto">
              <TabsTrigger value="loan">{calculators.loan.label}</TabsTrigger>
              <TabsTrigger value="savings">{calculators.savings.label}</TabsTrigger>
            </TabsList>

            <TabsContent value="loan">
              <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
                <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6">
                  <div className="space-y-5">
                    <div>
                      <label htmlFor="loan-amount" className="mb-2 block text-sm font-semibold text-[var(--foreground)]">{calculators.loan.amountLabel}</label>
                      <div className="flex items-center gap-3">
                        <input id="loan-amount" type="range" min={5000} max={1000000} step={5000} value={loanAmount} onChange={(event) => setLoanAmount(Number(event.target.value))} className="w-full accent-[var(--primary)]" />
                        <input aria-label={calculators.loan.amountLabel} dir="ltr" type="number" min={5000} max={1000000} step={5000} value={loanAmount} onChange={(event) => setLoanAmount(Number(event.target.value) || 0)} className="w-28 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-start text-sm font-medium text-[var(--foreground)]" />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="loan-rate" className="mb-2 block text-sm font-semibold text-[var(--foreground)]">{calculators.loan.rateLabel}</label>
                      <div className="flex items-center gap-3">
                        <input id="loan-rate" type="range" min={0} max={12} step={0.25} value={loanRate} onChange={(event) => setLoanRate(Number(event.target.value))} className="w-full accent-[var(--primary)]" />
                        <input aria-label={calculators.loan.rateLabel} dir="ltr" type="number" min={0} max={12} step={0.25} value={loanRate} onChange={(event) => setLoanRate(Number(event.target.value) || 0)} className="w-20 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-start text-sm font-medium text-[var(--foreground)]" />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="loan-years" className="mb-2 block text-sm font-semibold text-[var(--foreground)]">{calculators.loan.termLabel}</label>
                      <div className="flex items-center gap-3">
                        <input id="loan-years" type="range" min={1} max={40} step={1} value={loanYears} onChange={(event) => setLoanYears(Number(event.target.value))} className="w-full accent-[var(--primary)]" />
                        <input aria-label={calculators.loan.termLabel} dir="ltr" type="number" min={1} max={40} step={1} value={loanYears} onChange={(event) => setLoanYears(Number(event.target.value) || 1)} className="w-16 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-start text-sm font-medium text-[var(--foreground)]" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6">
                  <h3 className="text-lg font-bold text-[var(--foreground)]">{t('calculators.results.estimatedPayments')}</h3>
                  <dl className="mt-5 space-y-4">
                    <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] pb-3">
                      <dt className="text-sm text-[var(--muted-foreground)]">{t('calculators.results.monthlyPayment')}</dt>
                      <dd className="text-xl font-extrabold text-[var(--foreground)]"><bdi dir="ltr">{formatCurrency(loanResult.monthlyPayment)}</bdi></dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] pb-3">
                      <dt className="text-sm text-[var(--muted-foreground)]">{t('calculators.results.totalInterest')}</dt>
                      <dd className="text-base font-bold text-[var(--foreground)]"><bdi dir="ltr">{formatCurrency(loanResult.totalInterest)}</bdi></dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-sm text-[var(--muted-foreground)]">{t('calculators.results.totalRepayment')}</dt>
                      <dd className="text-base font-bold text-[var(--foreground)]"><bdi dir="ltr">{formatCurrency(loanResult.totalRepayment)}</bdi></dd>
                    </div>
                  </dl>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="savings">
              <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
                <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6">
                  <div className="space-y-5">
                    <div>
                      <label htmlFor="savings-deposit" className="mb-2 block text-sm font-semibold text-[var(--foreground)]">{calculators.savings.initialLabel}</label>
                      <div className="flex items-center gap-3">
                        <input id="savings-deposit" type="range" min={0} max={250000} step={250} value={initialDeposit} onChange={(event) => setInitialDeposit(Number(event.target.value))} className="w-full accent-[var(--primary)]" />
                        <input aria-label={calculators.savings.initialLabel} dir="ltr" type="number" min={0} max={250000} step={250} value={initialDeposit} onChange={(event) => setInitialDeposit(Number(event.target.value) || 0)} className="w-28 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-start text-sm font-medium text-[var(--foreground)]" />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="savings-contribution" className="mb-2 block text-sm font-semibold text-[var(--foreground)]">{calculators.savings.contributionLabel}</label>
                      <div className="flex items-center gap-3">
                        <input id="savings-contribution" type="range" min={0} max={5000} step={25} value={monthlyContribution} onChange={(event) => setMonthlyContribution(Number(event.target.value))} className="w-full accent-[var(--primary)]" />
                        <input aria-label={calculators.savings.contributionLabel} dir="ltr" type="number" min={0} max={5000} step={25} value={monthlyContribution} onChange={(event) => setMonthlyContribution(Number(event.target.value) || 0)} className="w-24 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-start text-sm font-medium text-[var(--foreground)]" />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="savings-rate" className="mb-2 block text-sm font-semibold text-[var(--foreground)]">{calculators.savings.rateLabel}</label>
                      <div className="flex items-center gap-3">
                        <input id="savings-rate" type="range" min={0} max={10} step={0.25} value={savingsRate} onChange={(event) => setSavingsRate(Number(event.target.value))} className="w-full accent-[var(--primary)]" />
                        <input aria-label={calculators.savings.rateLabel} dir="ltr" type="number" min={0} max={10} step={0.25} value={savingsRate} onChange={(event) => setSavingsRate(Number(event.target.value) || 0)} className="w-20 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-start text-sm font-medium text-[var(--foreground)]" />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="savings-years" className="mb-2 block text-sm font-semibold text-[var(--foreground)]">{calculators.savings.yearsLabel}</label>
                      <div className="flex items-center gap-3">
                        <input id="savings-years" type="range" min={1} max={30} step={1} value={savingsYears} onChange={(event) => setSavingsYears(Number(event.target.value))} className="w-full accent-[var(--primary)]" />
                        <input aria-label={calculators.savings.yearsLabel} dir="ltr" type="number" min={1} max={30} step={1} value={savingsYears} onChange={(event) => setSavingsYears(Number(event.target.value) || 1)} className="w-16 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-start text-sm font-medium text-[var(--foreground)]" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6">
                  <h3 className="text-lg font-bold text-[var(--foreground)]">{t('calculators.results.projectedBalance')}</h3>
                  <dl className="mt-5 space-y-4">
                    <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] pb-3">
                      <dt className="text-sm text-[var(--muted-foreground)]">{t('calculators.results.finalBalance')}</dt>
                      <dd className="text-xl font-extrabold text-[var(--foreground)]"><bdi dir="ltr">{formatCurrency(savingsResult.finalBalance)}</bdi></dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] pb-3">
                      <dt className="text-sm text-[var(--muted-foreground)]">{t('calculators.results.totalContributed')}</dt>
                      <dd className="text-base font-bold text-[var(--foreground)]"><bdi dir="ltr">{formatCurrency(savingsResult.totalContributed)}</bdi></dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-sm text-[var(--muted-foreground)]">{t('calculators.results.interestEarned')}</dt>
                      <dd className="text-base font-bold text-[var(--foreground)]"><bdi dir="ltr">{formatCurrency(savingsResult.interestEarned)}</bdi></dd>
                    </div>
                  </dl>

                  <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--background)] p-3" dir="ltr">
                    <svg viewBox="0 0 100 100" className="h-28 w-full" aria-label={t('calculators.results.savingsChart')} role="img">
                      <polyline
                        fill="none"
                        stroke="var(--brand-burgundy)"
                        strokeWidth="3"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        points={chartPath}
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <p className="mt-6 text-sm text-[var(--muted-foreground)]">{calculators.note}</p>
      </Container>
    </section>
  )
}

export function RatesTableSection() {
  const { t } = useTranslation('landing')
  const { rates } = useLandingContent()
  const [activeTab, setActiveTab] = useState<string>(rates.tabs[0].id)
  const activeRows = rates.tabs.find((tab) => tab.id === activeTab)?.rows ?? rates.tabs[0].rows

  return (
    <section id="rates" className="bg-[var(--card)]">
      <Container className="py-16 sm:py-20">
        <Reveal>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">{rates.eyebrow}</p>
          <h2 className="mt-3 type-h2 max-w-xl text-[var(--foreground)]">{rates.title}</h2>
        </Reveal>

        <div className="mt-8">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6 w-full justify-start overflow-x-auto">
              {rates.tabs.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id}>{tab.label}</TabsTrigger>
              ))}
            </TabsList>

            <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--background)] p-3 sm:p-4">
              <div className="hidden md:block overflow-hidden rounded-[1rem] border border-[var(--border)]">
                <table className="w-full border-collapse text-start">
                  <thead className="bg-[var(--card)]">
                    <tr>
                      <th className="px-4 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">{t('rates.columns.product')}</th>
                      <th className="px-4 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">{t('rates.columns.rate')}</th>
                      <th className="px-4 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">{t('rates.columns.bestFor')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeRows.map((row) => (
                      <tr key={row.product} className="border-t border-[var(--border)]">
                        <td className="px-4 py-4 text-sm font-semibold text-[var(--foreground)]">{row.product}</td>
                        <td className="px-4 py-4 text-sm font-bold text-[var(--primary)]"><bdi dir="ltr">{formatPercent(Number.parseFloat(row.rate) / 100, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</bdi></td>
                        <td className="px-4 py-4 text-sm text-[var(--muted-foreground)]">{row.feature}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-3 md:hidden">
                {activeRows.map((row) => (
                  <TiltCard key={row.product} surfaceClassName="rounded-2xl p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-base font-bold text-[var(--foreground)]">{row.product}</p>
                      <span className="text-sm font-extrabold text-[var(--primary)]"><bdi dir="ltr">{formatPercent(Number.parseFloat(row.rate) / 100, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</bdi></span>
                    </div>
                    <p className="mt-2 text-sm text-[var(--muted-foreground)]">{row.feature}</p>
                  </TiltCard>
                ))}
              </div>
            </div>
          </Tabs>
        </div>
      </Container>
    </section>
  )
}

export function SecuritySection() {
  const { security } = useLandingContent()
  const images = useLandingImages()

  return (
    <Section id="security" variant="burgundy" className="bg-glow-soft relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),transparent_60%)]" />
      <Container className="relative">
        <Reveal>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-cream)]/80">{security.eyebrow}</p>
          <h2 className="mt-3 type-h2 max-w-xl text-[var(--brand-cream)]">{security.title}</h2>
        </Reveal>

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <Reveal className="order-2 lg:order-1">
            <Photo
              alt={images.sections.security.alt}
              className="h-[260px] w-full rounded-[1.5rem] border border-white/15 shadow-[0_18px_40px_rgba(25,17,19,0.18)] sm:h-[320px] lg:h-[360px]"
              height={images.sections.security.height}
              objectPosition="center"
              priority={false}
              src={images.sections.security.src}
              width={images.sections.security.width}
            />
          </Reveal>

          <ul className="order-1 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 lg:order-2">
            {security.items.map((item) => (
              <Reveal key={item}>
                <li className="flex items-start gap-3 rounded-[1.25rem] border border-white/15 bg-white/5 p-4">
                  <span className="mt-0.5 inline-flex size-8 items-center justify-center rounded-full bg-[var(--brand-cream)] text-[var(--brand-burgundy)]">
                    <ShieldCheck aria-hidden="true" className="size-4" />
                  </span>
                  <span className="text-sm font-medium leading-6 text-[var(--brand-cream)]">{item}</span>
                </li>
              </Reveal>
            ))}
          </ul>
        </div>
      </Container>
    </Section>
  )
}

export function MobileAppSection() {
  const { t } = useTranslation('landing')
  const { mobileApp } = useLandingContent()

  return (
    <section id="mobile-app" className="bg-[var(--background)]">
      <Container className="py-16 sm:py-20">
        <div className="grid items-center gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:gap-12">
          <Reveal>
              <div className="mx-auto w-[250px] rounded-[2.5rem] border-[0.75rem] border-[var(--foreground)] bg-[var(--card)] p-3 shadow-[0_24px_60px_rgba(42,35,39,0.12)]" dir="ltr">
              <div className="overflow-hidden rounded-[1.75rem] border border-[var(--border)] bg-[var(--brand-cream)] p-4">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">9:41</span>
                  <span className="rounded-full bg-[var(--background)] px-2 py-1 text-[0.58rem] font-semibold uppercase tracking-[0.12em] text-[var(--primary)]">Westbridge</span>
                </div>

                <div className="rounded-[1.3rem] bg-[var(--card)] p-3 shadow-sm">
                  <p className="text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">{t('mobileApp.available')}</p>
                  <p className="mt-2 text-2xl font-extrabold tracking-tight text-[var(--foreground)]">$8,420</p>
                  <div className="mt-3 h-16 rounded-xl bg-[var(--brand-cream)] p-2" dir="ltr">
                    <svg viewBox="0 0 120 40" className="h-full w-full" aria-label={t('mobileApp.balanceChart')} role="img">
                      <path d="M0 26 L20 22 L40 28 L60 16 L80 19 L100 12 L120 6" fill="none" stroke="var(--brand-burgundy)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between rounded-xl bg-[var(--card)] px-3 py-2">
                    <span className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted-foreground)]">{t('mobileApp.transfers')}</span>
                    <span className="text-xs font-bold text-[var(--foreground)]">$240</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-[var(--card)] px-3 py-2">
                    <span className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted-foreground)]">{t('mobileApp.spending')}</span>
                    <span className="text-xs font-bold text-[var(--foreground)]">$310</span>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">{mobileApp.eyebrow}</p>
              <h2 className="mt-3 type-h2 text-[var(--foreground)]">{mobileApp.title}</h2>
              <p className="mt-4 max-w-lg text-base leading-7 text-[var(--muted-foreground)]">{mobileApp.description}</p>

              <ul className="mt-6 space-y-3">
                {mobileApp.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-sm font-medium text-[var(--foreground)]">
                    <span className="inline-flex size-7 items-center justify-center rounded-full bg-[var(--brand-cream)] text-[var(--brand-burgundy)]">
                      <CheckCircle2 aria-hidden="true" className="size-4" />
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                {mobileApp.storeButtons.map((button) => (
                  <button key={button.label} type="button" disabled className="inline-flex flex-col items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-start text-[var(--foreground)] opacity-80">
                    <span className="text-base font-bold">{button.label}</span>
                    <span className="text-xs uppercase tracking-[0.12em] text-[var(--muted-foreground)]">{button.meta}</span>
                  </button>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  )
}

export function TestimonialsSection() {
  const { testimonials } = useLandingContent()

  return (
    <section id="testimonials" className="bg-[var(--card)]">
      <Container className="py-16 sm:py-20">
        <Reveal>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">{testimonials.eyebrow}</p>
          <h2 className="mt-3 type-h2 max-w-xl text-[var(--foreground)]">{testimonials.title}</h2>
        </Reveal>

        <div className="mt-8">
          <Carousel className="relative" options={{ loop: false, align: 'start' }}>
            <CarouselContent className="-ms-4">
              {testimonials.items.map((item) => (
                <CarouselItem key={item.name} className="ps-4 md:basis-1/2 xl:basis-1/3">
                  <TiltCard className="h-full rounded-[1.5rem]" surfaceClassName="flex h-full flex-col rounded-[1.5rem] p-5">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex size-11 items-center justify-center rounded-full bg-[var(--brand-cream)] text-sm font-extrabold text-[var(--brand-burgundy)]">{item.initials}</div>
                      <div>
                        <p className="font-semibold text-[var(--foreground)]">{item.name}</p>
                        <p className="text-xs text-[var(--muted-foreground)]">{item.role}</p>
                      </div>
                    </div>
                    <p className="text-base leading-7 text-[var(--foreground)]">“{item.quote}”</p>
                  </TiltCard>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="start-0 top-1/2" />
            <CarouselNext className="end-0 top-1/2" />
          </Carousel>
        </div>
      </Container>
    </section>
  )
}

export function BlogSection() {
  const { t } = useTranslation()
  const { blog } = useLandingContent()
  const images = useLandingImages()

  return (
    <section id="blog" className="bg-[var(--background)]">
      <Container className="py-16 sm:py-20">
        <Reveal>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">{blog.eyebrow}</p>
          <h2 className="mt-3 type-h2 max-w-xl text-[var(--foreground)]">{blog.title}</h2>
        </Reveal>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {blog.posts.map((post, index) => {
            const blogPhoto = [images.blog['tip-1'], images.blog['tip-2'], images.blog['tip-3']][index]

            return (
              <Reveal key={post.slug}>
                <TiltCard className="h-full overflow-hidden rounded-[1.5rem]" surfaceClassName="flex h-full flex-col overflow-hidden rounded-[1.5rem]">
                  <Photo
                    alt={blogPhoto.alt}
                    className="h-[180px] w-full rounded-none border-b border-[var(--border)]"
                    height={blogPhoto.height}
                    objectPosition="center"
                    priority={false}
                    src={blogPhoto.src}
                    width={blogPhoto.width}
                  />
                  <div className="flex h-full flex-col p-5">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <Badge variant="secondary">{post.category}</Badge>
                      <span className="text-xs font-medium text-[var(--muted-foreground)]">{post.readTime}</span>
                    </div>
                    <h3 className="text-xl font-bold text-[var(--foreground)]">{post.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">{post.excerpt}</p>
                    <Link className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-semibold text-[var(--primary)]" to={`/blog/${post.slug}`}>
                      {t('actions.readArticle', { ns: 'pages' })} <ArrowRight aria-hidden="true" className="size-4 rtl:rotate-180" />
                    </Link>
                  </div>
                </TiltCard>
              </Reveal>
            )
          })}
        </div>
      </Container>
    </section>
  )
}

export function FaqSection() {
  const { faq } = useLandingContent()

  return (
    <section id="faq" className="bg-[var(--card)]">
      <Container className="py-16 sm:py-20">
        <Reveal>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">{faq.eyebrow}</p>
          <h2 className="mt-3 type-h2 max-w-xl text-[var(--foreground)]">{faq.title}</h2>
        </Reveal>

        <div className="mt-8">
          <Accordion type="single" collapsible className="space-y-3">
            {faq.items.map((item, index) => (
              <AccordionItem key={index} value={String(index)} className="overflow-hidden rounded-[1.25rem] border border-[var(--border)] bg-[var(--background)] px-4">
                <AccordionTrigger className="py-4 text-start text-base font-semibold text-[var(--foreground)]">{item.question}</AccordionTrigger>
                <AccordionContent className="pb-4 pe-8 text-sm leading-6 text-[var(--muted-foreground)]">{item.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </Container>
    </section>
  )
}

const createContactSchema = (translate: (key: string) => string) => z.object({
  name: z.string().min(2, translate('forms.validation.nameMin')).max(100, translate('forms.validation.nameMax100')),
  email: z.string().email(translate('forms.validation.emailInvalid')).max(254, translate('forms.validation.emailMax')),
  subject: z.string().min(3, translate('forms.validation.subjectMin')).max(150, translate('forms.validation.subjectMax')),
  message: z.string().min(10, translate('forms.validation.messageMin')).max(2000, translate('forms.validation.messageMax')),
  website: z.string(),
})

export function ContactSection({ showHeading = true }: { showHeading?: boolean }) {
  const { t } = useTranslation('landing')
  const { contact } = useLandingContent()
  const images = useLandingImages()
  const contactSchema = useMemo(() => createContactSchema((key) => t(key, { ns: 'common' })), [t])
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: '',
      email: '',
      subject: '',
      message: '',
      website: '',
    },
  })

  const onSubmit = async (values: ContactFormValues) => {
    try {
      await submitContactMessage(values)
      toast.success(t('forms.contact.success', { ns: 'common' }))
      reset()
    } catch (error) {
      showPublicFormError<ContactFormValues>(error, ['name', 'email', 'subject', 'message'], setError, (key) => t(key, { ns: 'common' }))
    }
  }

  return (
    <section id="contact" className="bg-[var(--background)]">
      <Container className="py-16 sm:py-20">
        {showHeading && (
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">{contact.eyebrow}</p>
            <h2 className="mt-3 type-h2 max-w-xl text-[var(--foreground)]">{contact.title}</h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted-foreground)]">{contact.description}</p>
          </Reveal>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <form noValidate onSubmit={handleSubmit(onSubmit)} className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6">
            <input
              {...register('website')}
              aria-hidden="true"
              autoComplete="off"
              className="sr-only"
              tabIndex={-1}
              type="text"
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <Label htmlFor="contact-name">{contact.form.name}</Label>
                <Input id="contact-name" {...register('name')} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'contact-name-error' : undefined} className="mt-2" />
                {errors.name && <p id="contact-name-error" className="mt-2 text-sm text-[var(--destructive)]" role="alert">{errors.name.message}</p>}
              </div>

              <div className="sm:col-span-1">
                <Label htmlFor="contact-email">{contact.form.email}</Label>
                <Input id="contact-email" type="email" {...register('email')} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'contact-email-error' : undefined} className="mt-2" />
                {errors.email && <p id="contact-email-error" className="mt-2 text-sm text-[var(--destructive)]" role="alert">{errors.email.message}</p>}
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="contact-subject">{contact.form.subject}</Label>
                <Input id="contact-subject" {...register('subject')} aria-invalid={Boolean(errors.subject)} aria-describedby={errors.subject ? 'contact-subject-error' : undefined} className="mt-2" />
                {errors.subject && <p id="contact-subject-error" className="mt-2 text-sm text-[var(--destructive)]" role="alert">{errors.subject.message}</p>}
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="contact-message">{contact.form.message}</Label>
                <Textarea id="contact-message" {...register('message')} aria-invalid={Boolean(errors.message)} aria-describedby={errors.message ? 'contact-message-error' : undefined} className="mt-2" />
                {errors.message && <p id="contact-message-error" className="mt-2 text-sm text-[var(--destructive)]" role="alert">{errors.message.message}</p>}
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <Button type="submit" disabled={isSubmitting} className="btn-gradient min-w-[10rem]">
                {isSubmitting ? t('contact.sending') : contact.form.submit}
              </Button>
            </div>
          </form>

          <div className="space-y-6">
            <TiltCard surfaceClassName="rounded-[1.5rem] p-5 sm:p-6">
              <div className="mb-5 flex items-start gap-3">
                <div className="inline-flex size-10 items-center justify-center rounded-full bg-[var(--brand-cream)] text-[var(--brand-burgundy)]">
                  <MapPin aria-hidden="true" className="size-4" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[var(--foreground)]">{t('contact.branchLocator')}</h3>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">{t('contact.branchDescription')}</p>
                </div>
              </div>

              <Photo
                alt={images.sections.branch.alt}
                className="mb-4 h-40 w-full overflow-hidden rounded-[1rem] border border-[var(--border)]"
                height={images.sections.branch.height}
                objectPosition="center"
                priority={false}
                src={images.sections.branch.src}
                width={images.sections.branch.width}
              />
            </TiltCard>

            <TiltCard surfaceClassName="rounded-[1.5rem] p-5 sm:p-6">
              <div className="mb-4 flex items-start gap-3">
                <div className="inline-flex size-10 items-center justify-center rounded-full bg-[var(--brand-cream)] text-[var(--brand-burgundy)]">
                  <Mail aria-hidden="true" className="size-4" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[var(--foreground)]">{t('contact.visitBranch')}</h3>
                </div>
              </div>

              <ul className="space-y-3">
                {contact.branches.map((branch, index) => (
                  <li key={index}>
                    <TiltCard surfaceClassName="rounded-2xl bg-[var(--background)] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-[var(--foreground)]">{branch.city}</p>
                          <p className="mt-1 text-sm text-[var(--muted-foreground)]">{branch.address}</p>
                        </div>
                      </div>
                      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--primary)]">{branch.hours}</p>
                    </TiltCard>
                  </li>
                ))}
              </ul>
            </TiltCard>
          </div>
        </div>
      </Container>
    </section>
  )
}

const createNewsletterSchema = (translate: (key: string) => string) => z.object({
  email: z.string().email(translate('forms.validation.emailInvalid')).max(254, translate('forms.validation.emailMax')),
})

export function NewsletterSection() {
  const { t } = useTranslation('landing')
  const { newsletter } = useLandingContent()
  const images = useLandingImages()
  const newsletterSchema = useMemo(() => createNewsletterSchema((key) => t(key, { ns: 'common' })), [t])
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<NewsletterSignupValues>({
    resolver: zodResolver(newsletterSchema),
    defaultValues: { email: '' },
  })

  const onSubmit = async (values: NewsletterSignupValues) => {
    try {
      await submitNewsletterSignup(values)
      toast.success(t('forms.newsletter.success', { ns: 'common' }))
      reset()
    } catch (error) {
      showPublicFormError<NewsletterSignupValues>(error, ['email'], setError, (key) => t(key, { ns: 'common' }))
    }
  }

  return (
    <Section id="newsletter" variant="burgundy" className="bg-glow-soft relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: `url(${images.sections['cta-banner'].src})` }}
        />
        <div className="absolute inset-0 bg-[var(--brand-burgundy)]/80" />
      </div>
      <Container className="relative">
        <div className="glass-card flex flex-col gap-6 rounded-[1.75rem] border-white/15 bg-white/5 p-5 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-cream)]/80">{newsletter.eyebrow}</p>
            <h2 className="mt-3 type-h2 text-[var(--brand-cream)]">{newsletter.title}</h2>
          </div>

          <form noValidate onSubmit={handleSubmit(onSubmit)} className="w-full max-w-xl">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex-1">
                <Label htmlFor="newsletter-email" className="sr-only">{newsletter.placeholder}</Label>
                <Input
                  id="newsletter-email"
                  type="email"
                  placeholder={newsletter.placeholder}
                  {...register('email')}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'newsletter-email-error' : undefined}
                  className="border-white/20 bg-white/10 text-[var(--brand-cream)] placeholder:text-[var(--brand-cream)]/70"
                />
                {errors.email && <p id="newsletter-email-error" className="mt-2 text-sm text-[var(--brand-cream)]" role="alert">{errors.email.message}</p>}
              </div>
              <Button type="submit" variant="secondary" disabled={isSubmitting} className="sm:min-w-[12rem]">
                {isSubmitting ? t('newsletter.joining') : newsletter.cta}
              </Button>
            </div>
          </form>
        </div>
      </Container>
    </Section>
  )
}
