import {
  BlogSection,
  CalculatorsSection,
  ContactSection,
  FaqSection,
  HeroSection,
  HowItWorksSection,
  MobileAppSection,
  NewsletterSection,
  ProductsSection,
  RatesTableSection,
  SecuritySection,
  TestimonialsSection,
  TrustBarSection,
  WhyWestbridgeSection,
} from '@/components/landing/landing-sections'
import { usePageTitle } from '@/hooks/use-page-title'
import { useTranslation } from 'react-i18next'
import { VideoShowcase } from '@/components/landing/VideoShowcase'
import { DashboardPreview } from '@/components/landing/DashboardPreview'

export function Home() {
  const { t } = useTranslation('landing')
  usePageTitle(t('hero.headline'), t('meta.description'))

  return (
    <main id="main-content">
      <HeroSection />
      <VideoShowcase />
      <TrustBarSection />
      <ProductsSection />
      <WhyWestbridgeSection />
      <DashboardPreview />
      <HowItWorksSection />
      <CalculatorsSection />
      <RatesTableSection />
      <SecuritySection />
      <MobileAppSection />
      <TestimonialsSection />
      <BlogSection />
      <FaqSection />
      <ContactSection />
      <NewsletterSection />
    </main>
  )
}