import { Check, CircleDollarSign, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { buttonVariants } from '@/components/ui/button'
import { TiltCard } from '@/components/motion/TiltCard'
import { Section } from '@/components/layout/section'
import { landingContent } from '@/content/landing'
import { useInView } from '@/hooks/use-in-view'
import { cn } from '@/lib/utils'
import { useTranslatedContent } from '@/i18n/use-translated-content'

export function DashboardPreview() {
  const content = useTranslatedContent(landingContent.dashboardPreview, 'landing', 'dashboardPreview')
  const { t } = useTranslation('landing')
  const { ref, visible } = useInView<HTMLDivElement>()

  return (
    <Section className="bg-glow-soft overflow-hidden" id="dashboard-preview" variant="cream">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
        <div className={cn(
          'transition-all duration-500 ease-out motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none',
          visible ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0',
        )}>
          <p className="text-sm font-bold uppercase text-primary">{content.eyebrow}</p>
          <h2 className="mt-3 type-h2 max-w-xl">{content.heading}</h2>
          <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">{content.description}</p>
          <ul className="mt-6 grid gap-3">
            {content.benefits.map((benefit) => (
              <li className="flex items-start gap-3 text-sm leading-6 text-foreground" key={benefit}>
                <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-primary" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
          <Link className={cn(buttonVariants(), 'btn-gradient mt-7')} to="/register">{content.cta}</Link>
        </div>

        <div className={cn(
          'relative min-w-0 px-1 pb-5 pt-4 transition-all duration-500 ease-out motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none sm:px-7 sm:py-7',
          visible ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0',
        )} ref={ref}>
          <div className="absolute -inset-x-2 inset-y-4 rounded-[2rem] bg-primary/5 sm:inset-x-8 sm:inset-y-8" />
          <div aria-label={t('dashboardPreview.ariaLabel')} className="relative z-10 min-w-0" dir="ltr" role="img">
            <TiltCard aria-hidden="true" surfaceClassName="overflow-hidden rounded-2xl">
              <div className="flex h-11 items-center gap-1.5 border-b border-border bg-muted/60 px-4">
                <span className="size-2.5 rounded-full bg-primary/35" />
                <span className="size-2.5 rounded-full bg-brand-bronze/70" />
                <span className="size-2.5 rounded-full bg-brand-stone" />
                <div className="mx-auto me-8 h-5 w-2/5 rounded-full border border-border bg-background/80" />
              </div>
              <div className="space-y-3 p-3 sm:space-y-4 sm:p-5">
                <div className="rounded-xl border border-border bg-background p-3 sm:p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-muted-foreground">{content.account.label}</p>
                      <p className="mt-1 text-2xl font-extrabold tabular-nums text-foreground sm:text-3xl">{content.account.balance}</p>
                    </div>
                    <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[0.65rem] font-semibold text-primary">{content.account.account}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:gap-3">
                    {content.stats.map((stat) => (
                      <div className="rounded-lg border border-border bg-card p-2.5 sm:p-3" key={stat.label}>
                        <p className="text-[0.65rem] font-semibold text-muted-foreground">{stat.label}</p>
                        <p className="mt-1 text-base font-bold tabular-nums text-foreground sm:text-lg">{stat.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-background p-3 sm:p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-foreground">{content.activityLabel}</p>
                    <span className="text-[0.65rem] font-medium text-muted-foreground">{content.activityPeriod}</span>
                  </div>
                  <ul className="divide-y divide-border">
                    {content.transactions.map((transaction) => (
                      <li className="flex min-w-0 items-center justify-between gap-2 py-2" key={transaction.name}>
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-primary">
                            {transaction.name === 'Payroll' ? <CircleDollarSign aria-hidden="true" className="size-4" /> : <ShieldCheck aria-hidden="true" className="size-4" />}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-semibold text-foreground">{transaction.name}</span>
                            <span className="block text-[0.62rem] text-muted-foreground">{transaction.detail}</span>
                          </span>
                        </div>
                        <span className="shrink-0 text-xs font-bold tabular-nums text-foreground">{transaction.amount}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl border border-border bg-background p-3 sm:p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-foreground">{content.cashFlow}</p>
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-[0.65rem] font-bold text-primary">{content.cashFlowChange}</span>
                  </div>
                  <svg aria-label={t('dashboardPreview.cashFlowChartLabel')} className="mt-2 h-10 w-full" role="img" viewBox="0 0 220 44" preserveAspectRatio="none">
                    <path d="M0 31 L30 27 L58 34 L88 19 L116 23 L146 11 L180 16 L220 5" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M0 31 L30 27 L58 34 L88 19 L116 23 L146 11 L180 16 L220 5 L220 44 L0 44 Z" fill="color-mix(in srgb,var(--primary) 9%,transparent)" />
                  </svg>
                </div>
              </div>
            </TiltCard>

            <div className="absolute -start-2 top-1 z-20 hidden max-w-[calc(100%-1rem)] items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground shadow-lg sm:flex sm:-start-4 sm:top-5">
              <CircleDollarSign aria-hidden="true" className="size-4 shrink-0 text-primary" />
              <span className="truncate">{content.notification}</span>
            </div>
            <div className="absolute -end-2 bottom-1 z-20 hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground shadow-lg sm:flex sm:-end-4 sm:bottom-5">
              <ShieldCheck aria-hidden="true" className="size-4 shrink-0 text-primary" />
              <span>{content.securityNotice}</span>
            </div>
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">{content.caption}</p>
        </div>
      </div>
    </Section>
  )
}