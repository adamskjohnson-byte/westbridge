import { Nfc } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { landingContent } from '@/content/landing'
import { useCardTilt } from '@/hooks/use-card-tilt'
import { useTranslatedContent } from '@/i18n/use-translated-content'

export function HeroCard() {
  const card = useTranslatedContent(landingContent.hero.card, 'landing', 'hero.card')
  const { t } = useTranslation('landing')
  const tilt = useCardTilt()

  return (
    <div
      aria-label={t('hero.card.ariaLabel')}
      className={`hero-card-stage${tilt.enabled ? ' hero-card-tilt-enabled' : ''}`}
      dir="ltr"
      role="img"
      {...tilt.handlers}
    >
      <div aria-hidden="true" className={`hero-card-float${tilt.motionEnabled ? ' hero-card-motion' : ''}`}>
        <div className="hero-card-back" />
        <div
          className={`hero-card-front${tilt.enabled ? ' hero-card-tilt' : ''}`}
          style={tilt.style}
        >
          <div className="hero-card-face">
            <div className="hero-card-orb" />
            <div className="hero-card-content">
              <div className="hero-card-topline">
                <div className="hero-card-chip">
                  <span />
                </div>
                <span className="hero-card-contactless"><Nfc aria-hidden="true" /></span>
              </div>
              <div className="hero-card-copy">
                <p className="hero-card-bank">{card.bankName}</p>
                <p className="hero-card-number">{card.number}</p>
                <div className="hero-card-details">
                  <div>
                    <p className="hero-card-label">{t('hero.card.cardholder')}</p>
                    <p className="hero-card-value">{card.holder}</p>
                  </div>
                  <div className="hero-card-expiry">
                    <p className="hero-card-label">{t('hero.card.expiryLabel')}</p>
                    <p className="hero-card-value">{card.expires}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}