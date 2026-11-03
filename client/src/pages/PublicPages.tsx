import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, Check, Search } from 'lucide-react'
import { Breadcrumbs, type BreadcrumbItem } from '@/components/layout/breadcrumbs'
import { PageHeader } from '@/components/layout/page-header'
import { Section } from '@/components/layout/section'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Input } from '@/components/ui/input'
import { CalculatorsSection, ContactSection } from '@/components/landing/landing-sections'
import { Photo } from '@/components/ui/Photo'
import { imageSlots } from '@/content/images'
import { landingContent } from '@/content/landing'
import {
  aboutContent,
  audienceContent,
  blogPosts,
  faqCategories,
  legalPages,
  productDetails,
  securityPageContent,
} from '@/content/public-pages'
import { usePageTitle } from '@/hooks/use-page-title'
import { cn } from '@/lib/utils'
import { formatPercent } from '@/lib/format'
import { useTranslatedContent } from '@/i18n/use-translated-content'

const pageContentSource = {
  about: aboutContent,
  audiences: audienceContent,
  products: productDetails,
  security: securityPageContent,
  faq: faqCategories,
  blog: blogPosts,
  legal: legalPages,
  images: imageSlots,
}

function usePageContent() {
  return useTranslatedContent(pageContentSource, 'pages')
}

function useLandingContent() {
  return useTranslatedContent(landingContent, 'landing')
}

type PublicPageProps = {
  title: string
  description?: string
  eyebrow?: string
  breadcrumbs: BreadcrumbItem[]
  children?: React.ReactNode
  after?: React.ReactNode
}

function PublicPage({ title, description, eyebrow, breadcrumbs, children, after }: PublicPageProps) {
  usePageTitle(title, description)

  return (
    <main id="main-content">
      <Section>
        <Breadcrumbs items={breadcrumbs} />
        <PageHeader title={title} description={description} eyebrow={eyebrow} />
        {children}
      </Section>
      {after}
    </main>
  )
}

export function AboutPage() {
  const { t } = useTranslation('pages')
  const { about, images } = usePageContent()
  return (
    <PublicPage title={about.title} description={about.description} eyebrow={about.eyebrow} breadcrumbs={[{ label: t('labels.about') }]}>
      <div className="space-y-12">
        <section aria-labelledby="about-story" className="space-y-6">
          <h2 className="type-h3" id="about-story">{t('about.sections.story')}</h2>
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <p className="type-body max-w-3xl text-muted-foreground">{about.story}</p>
            <Photo
              alt={images.about.headquarters.alt}
              className="h-[240px] w-full overflow-hidden rounded-[1.5rem] border border-border shadow-[0_18px_40px_rgba(42,35,39,0.08)] sm:h-[300px]"
              height={images.about.headquarters.height}
              objectPosition="center"
              src={images.about.headquarters.src}
              width={images.about.headquarters.width}
            />
          </div>
        </section>

        <section aria-labelledby="about-mission" className="rounded-xl bg-brand-burgundy p-6 text-brand-cream sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-cream/75">{t('about.sections.mission')}</p>
          <h2 className="mt-3 max-w-3xl text-2xl font-bold" id="about-mission">{about.mission}</h2>
        </section>

        <section aria-labelledby="about-values">
          <h2 className="type-h3" id="about-values">{t('about.sections.values')}</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {about.values.map((value) => (
              <Card key={value.title}>
                <CardHeader><CardTitle>{value.title}</CardTitle><CardDescription>{value.description}</CardDescription></CardHeader>
              </Card>
            ))}
          </div>
        </section>

        <section aria-labelledby="about-timeline">
          <h2 className="type-h3" id="about-timeline">{t('about.sections.timeline')}</h2>
          <ol className="mt-5 grid gap-4 sm:grid-cols-2">
            {about.timeline.map((item) => (
              <li key={item.year} className="border-s-2 border-primary ps-4">
                <p className="text-sm font-bold text-primary">{item.year}</p>
                <h3 className="mt-1 text-lg font-bold">{item.title}</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.description}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="about-leadership">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="type-h3" id="about-leadership">{t('about.sections.leadership')}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{t('about.sections.fictionalPeople')}</p>
            </div>
          </div>
          <div className="mt-5 grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <Photo
              alt={images.about.team.alt}
              className="h-[220px] w-full overflow-hidden rounded-[1.5rem] border border-border shadow-[0_18px_40px_rgba(42,35,39,0.08)] sm:h-[300px]"
              height={images.about.team.height}
              objectPosition="center"
              src={images.about.team.src}
              width={images.about.team.width}
            />
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-3">
              {about.leadership.map((person) => (
                <Card key={person.name}>
                  <CardHeader>
                    <div aria-hidden="true" className="mb-2 flex size-12 items-center justify-center rounded-full bg-brand-cream font-bold text-brand-burgundy">{person.name.split(' ').map((part) => part[0]).join('')}</div>
                    <CardTitle>{person.name}</CardTitle>
                    <CardDescription>{person.role}</CardDescription>
                  </CardHeader>
                  <CardContent><p className="text-sm leading-6 text-muted-foreground">{person.bio}</p></CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </div>
    </PublicPage>
  )
}

function AudiencePage({ audience }: { audience: 'personal' | 'business' }) {
  const { t } = useTranslation('pages')
  const { audiences, products: allProducts } = usePageContent()
  const content = audiences[audience]
  const products = allProducts.filter((product) => content.productSlugs.some((slug) => slug === product.slug))

  return (
    <PublicPage title={content.title} description={content.description} eyebrow={content.eyebrow} breadcrumbs={[{ label: t(`labels.${audience}`) }]}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {products.map((product) => (
          <Card key={product.slug} className="flex flex-col">
            <CardHeader><CardTitle>{product.title}</CardTitle><CardDescription>{product.description}</CardDescription></CardHeader>
            <CardContent className="mt-auto">
              <Link className="inline-flex items-center gap-2 text-sm font-semibold text-primary" to={`/products#${product.slug}`}>{t('actions.exploreProduct', { product: product.title })}<ArrowRight aria-hidden="true" className="size-4 rtl:rotate-180" /></Link>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link className={buttonVariants()} to={audience === 'personal' ? '/products' : '/contact'}>{content.cta}</Link>
        <Link className={buttonVariants({ variant: 'outline' })} to="/rates">{t('actions.viewRates')}</Link>
      </div>
    </PublicPage>
  )
}

export function PersonalPage() {
  return <AudiencePage audience="personal" />
}

export function BusinessPage() {
  return <AudiencePage audience="business" />
}

export function ProductsPage() {
  const { t } = useTranslation('pages')
  const { products: productContent } = usePageContent()
  return (
    <PublicPage title={t('productsPage.title')} description={t('productsPage.description')} eyebrow={t('labels.products')} breadcrumbs={[{ label: t('labels.products') }]}>
      <nav aria-label={t('productsPage.sectionsLabel')} className="mb-8 flex flex-wrap gap-x-5 gap-y-2 border-b border-border pb-4 text-sm font-semibold">
        {productContent.map((product) => <a key={product.slug} className="text-primary hover:underline" href={`#${product.slug}`}>{product.title}</a>)}
      </nav>
      <div className="space-y-5">
        {productContent.map((product, index) => (
          <section key={product.slug} id={product.slug} className="scroll-mt-24 rounded-xl border border-border bg-card p-5 sm:p-7" aria-labelledby={`${product.slug}-title`}>
            <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.12em] text-primary">{t('productsPage.itemNumber', { number: index + 1 })}</p>
                <h2 className="mt-2 type-h3" id={`${product.slug}-title`}>{product.title}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{product.description}</p>
              </div>
              <Link className={buttonVariants({ variant: 'outline' })} to={product.slug === 'loans' ? '/loans' : '/contact'}>{t('actions.askAboutProduct', { product: product.title })}</Link>
            </div>
            <ul className="mt-5 grid gap-3 sm:grid-cols-3">
              {product.highlights.map((highlight) => <li key={highlight} className="flex items-start gap-2 text-sm"><Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />{highlight}</li>)}
            </ul>
          </section>
        ))}
      </div>
    </PublicPage>
  )
}

export function LoansPage() {
  const { t } = useTranslation('pages')
  const landing = useLandingContent()
  const loanRates = landing.rates.tabs.find((tab) => tab.id === 'loans')

  return (
    <>
      <PublicPage title={t('loansPage.title')} description={t('loansPage.description')} eyebrow={t('labels.loans')} breadcrumbs={[{ label: t('labels.loans') }]} after={<CalculatorsSection />}>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { title: t('loansPage.types.personal.title'), description: t('loansPage.types.personal.description') },
            { title: t('loansPage.types.vehicle.title'), description: t('loansPage.types.vehicle.description') },
            { title: t('loansPage.types.home.title'), description: t('loansPage.types.home.description') },
          ].map((item) => <Card key={item.title}><CardHeader><CardTitle>{item.title}</CardTitle><CardDescription>{item.description}</CardDescription></CardHeader></Card>)}
        </div>
        {loanRates && <section className="mt-8" aria-labelledby="loan-rate-heading"><h2 className="type-h3" id="loan-rate-heading">{t('loansPage.rateHeading')}</h2><div className="mt-4 overflow-x-auto rounded-lg border border-border"><table className="w-full text-start text-sm"><thead className="bg-card"><tr><th className="px-4 py-3">{t('tables.product')}</th><th className="px-4 py-3">{t('tables.exampleRate')}</th><th className="px-4 py-3">{t('tables.designedFor')}</th></tr></thead><tbody>{loanRates.rows.map((row) => <tr key={row.product} className="border-t border-border"><td className="px-4 py-3 font-semibold">{row.product}</td><td className="px-4 py-3 text-primary"><bdi dir="ltr">{formatPercent(Number.parseFloat(row.rate) / 100, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</bdi></td><td className="px-4 py-3 text-muted-foreground">{row.feature}</td></tr>)}</tbody></table></div></section>}
        <p className="mt-4 text-sm text-muted-foreground">{t('loansPage.disclaimer')}</p>
      </PublicPage>
    </>
  )
}

export function RatesPage() {
  const { t } = useTranslation('pages')
  const landing = useLandingContent()
  return (
    <PublicPage title={t('ratesPage.title')} description={t('ratesPage.description')} eyebrow={t('labels.rates')} breadcrumbs={[{ label: t('labels.rates') }]}>
      <div className="space-y-8">
        {landing.rates.tabs.map((group) => (
          <section key={group.id} aria-labelledby={`${group.id}-rates-heading`}>
            <h2 className="type-h3" id={`${group.id}-rates-heading`}>{group.label}</h2>
            <div className="mt-4 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-start text-sm">
                <thead className="bg-card"><tr><th className="px-4 py-3 font-semibold">{t('tables.product')}</th><th className="px-4 py-3 font-semibold">{t('tables.illustrativeRate')}</th><th className="px-4 py-3 font-semibold">{t('tables.feature')}</th></tr></thead>
                <tbody>{group.rows.map((row) => <tr key={row.product} className="border-t border-border"><td className="px-4 py-3 font-semibold">{row.product}</td><td className="px-4 py-3 font-bold text-primary"><bdi dir="ltr">{formatPercent(Number.parseFloat(row.rate) / 100, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</bdi></td><td className="px-4 py-3 text-muted-foreground">{row.feature}</td></tr>)}</tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
      <p className="mt-8 text-sm font-medium text-muted-foreground">{t('ratesPage.disclaimer')}</p>
    </PublicPage>
  )
}

export function SecurityPage() {
  const { t } = useTranslation('pages')
  const { security } = usePageContent()
  return (
    <PublicPage title={security.title} description={security.description} eyebrow={security.eyebrow} breadcrumbs={[{ label: t('labels.security') }]}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {security.practices.map((practice) => <Card key={practice.title}><CardHeader><CardTitle>{practice.title}</CardTitle><CardDescription>{practice.description}</CardDescription></CardHeader></Card>)}
      </div>
      <section className="mt-10 rounded-xl bg-brand-burgundy p-5 text-brand-cream sm:p-7" aria-labelledby="scam-tips">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-cream/75">{t('securityPage.scamEyebrow')}</p>
        <h2 className="mt-2 type-h3" id="scam-tips">{t('securityPage.scamTitle')}</h2>
        <ul className="mt-5 grid gap-4 sm:grid-cols-2">
          {security.scamTips.map((tip) => <li key={tip} className="flex items-start gap-3 text-sm leading-6"><Check aria-hidden="true" className="mt-1 size-4 shrink-0" />{tip}</li>)}
        </ul>
      </section>
      <p className="mt-5 text-sm text-muted-foreground">{t('securityPage.disclaimer')}</p>
    </PublicPage>
  )
}

export function FaqPage() {
  const { t } = useTranslation('pages')
  const { faq: categories } = usePageContent()
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLowerCase()
  const filteredCategories = categories.map((category) => ({
    ...category,
    items: category.items.filter((item) => `${item.question} ${item.answer}`.toLowerCase().includes(normalizedQuery)),
  })).filter((category) => category.items.length > 0)

  return (
    <PublicPage title={t('faqPage.title')} description={t('faqPage.description')} eyebrow={t('labels.helpCenter')} breadcrumbs={[{ label: t('labels.faq') }]}>
      <div className="relative max-w-xl">
        <Search aria-hidden="true" className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input aria-label={t('faqPage.searchLabel')} onChange={(event) => setQuery(event.target.value)} placeholder={t('faqPage.searchPlaceholder')} value={query} className="ps-9" />
      </div>
      <div className="mt-8 space-y-8">
        {filteredCategories.length ? filteredCategories.map((category) => (
          <section key={category.id} aria-labelledby={`faq-${category.id}`}>
            <h2 className="type-h3" id={`faq-${category.id}`}>{category.name}</h2>
            <Accordion type="single" collapsible className="mt-3 divide-y divide-border rounded-lg border border-border bg-card px-4">
              {category.items.map((item) => <AccordionItem key={item.question} value={item.question}><AccordionTrigger>{item.question}</AccordionTrigger><AccordionContent>{item.answer}</AccordionContent></AccordionItem>)}
            </Accordion>
          </section>
        )) : <p className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">{t('faqPage.noResults', { query })}</p>}
      </div>
    </PublicPage>
  )
}

export function ContactPage() {
  const { t } = useTranslation('pages')
  const { contact } = useLandingContent()
  return (
    <PublicPage title={contact.title} description={contact.description} eyebrow={t('labels.contact')} breadcrumbs={[{ label: t('labels.contact') }]} after={<ContactSection showHeading={false} />} />
  )
}

export function BlogPage() {
  const { t } = useTranslation('pages')
  const { blog: posts } = usePageContent()
  return (
    <PublicPage title={t('blogPage.title')} description={t('blogPage.description')} eyebrow={t('blogPage.eyebrow')} breadcrumbs={[{ label: t('labels.blog') }]}>
      <div className="grid gap-4 lg:grid-cols-3">
        {posts.map((post) => (
          <Card key={post.slug} className="flex flex-col">
            <CardHeader>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">{post.category} · {post.readTime}</p>
              <CardTitle className="mt-2">{post.title}</CardTitle>
              <CardDescription>{post.excerpt}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <Link className="inline-flex items-center gap-2 text-sm font-semibold text-primary" to={`/blog/${post.slug}`}>{t('actions.readArticle')}<ArrowRight aria-hidden="true" className="size-4 rtl:rotate-180" /></Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </PublicPage>
  )
}

export function BlogPostPage() {
  const { t } = useTranslation('pages')
  const { blog: posts } = usePageContent()
  const { slug = '' } = useParams()
  const post = posts.find((item) => item.slug === slug)

  if (!post) {
    return <PublicPage title={t('blogPage.notFoundTitle')} description={t('blogPage.notFoundDescription')} breadcrumbs={[{ label: t('labels.blog'), to: '/blog' }, { label: t('labels.notFound') }]}><Link className={buttonVariants({ variant: 'outline' })} to="/blog">{t('blogPage.browseArticles')}</Link></PublicPage>
  }

  return (
    <PublicPage title={post.title} description={post.excerpt} eyebrow={t('blogPage.postMetadata', { category: post.category, published: post.published, readTime: post.readTime })} breadcrumbs={[{ label: t('labels.blog'), to: '/blog' }, { label: post.title }]}>
      <article className="max-w-3xl space-y-5">
        {post.paragraphs.map((paragraph) => <p key={paragraph} className="type-body text-muted-foreground">{paragraph}</p>)}
        <p className="border-s-2 border-primary ps-4 text-sm text-muted-foreground">{t('blogPage.disclaimer')}</p>
        <Link className={cn(buttonVariants({ variant: 'outline' }), 'mt-3')} to="/blog">{t('blogPage.backToInsights')}</Link>
      </article>
    </PublicPage>
  )
}

export function LegalPage({ page }: { page: keyof typeof legalPages }) {
  const { t } = useTranslation('pages')
  const { legal } = usePageContent()
  const content = legal[page]

  return (
    <PublicPage title={content.title} description={content.description} eyebrow={t('legalPage.eyebrow')} breadcrumbs={[{ label: content.title }]}>
      <p className="mb-6 rounded-md border border-primary/30 bg-brand-cream px-4 py-3 text-sm font-bold text-brand-burgundy">{t('legalPage.sampleNotice')}</p>
      <div className="max-w-3xl space-y-7">
        {content.sections.map((section) => <section key={section.heading}><h2 className="type-h4">{section.heading}</h2><p className="mt-2 text-sm leading-7 text-muted-foreground">{section.body}</p></section>)}
      </div>
    </PublicPage>
  )
}