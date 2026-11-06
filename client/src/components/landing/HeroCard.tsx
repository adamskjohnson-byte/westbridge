import { useTranslation } from 'react-i18next'
import { CardVisual } from '@/components/ui/CardVisual'
import { landingContent } from '@/content/landing'
import { useTranslatedContent } from '@/i18n/use-translated-content'

export function HeroCard() {
  const card = useTranslatedContent(landingContent.hero.card, 'landing', 'hero.card')
  const { t } = useTranslation('landing')
  return (
    <CardVisual
      bankName={card.bankName}
      expiry={card.expires}
      holderName={card.holder}
      labels={{ holder: t('hero.card.cardholder'), expiry: t('hero.card.expiryLabel'), frozen: '', cancelled: '', accessibility: t('hero.card.ariaLabel') }}
      last4={landingContent.hero.card.last4}
      size="lg"
    />
  )
}