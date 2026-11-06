import { Nfc, ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Ltr } from '@/components/ui/Ltr'
import { useCardTilt } from '@/hooks/use-card-tilt'
import { cn } from '@/lib/utils'

export type CardVisualProps = {
  nickname?: string | null
  last4: string
  expiry: string
  holderName: string
  status?: 'active' | 'frozen' | 'cancelled'
  size?: 'sm' | 'md' | 'lg'
  bankName?: string
  labels?: { holder: string; expiry: string; frozen: string; cancelled: string; accessibility: string }
}

export function CardVisual({ nickname, last4, expiry, holderName, status = 'active', size = 'lg', bankName, labels }: CardVisualProps) {
  const { t } = useTranslation('common')
  const tilt = useCardTilt()
  const stateLabel = status === 'frozen' ? (labels?.frozen ?? t('dashboard.cards.frozen')) : status === 'cancelled' ? (labels?.cancelled ?? t('dashboard.cards.cancelled')) : ''
  const ariaLabel = labels?.accessibility ?? t('dashboard.cards.visualLabel', { nickname: nickname || t('dashboard.cards.title'), last4, status: stateLabel })

  return (
    <div aria-label={ariaLabel} className={cn('hero-card-stage card-visual-stage', `card-visual-${size}`, status !== 'active' && `card-visual-${status}`, tilt.enabled && 'hero-card-tilt-enabled')} dir="ltr" role="img" {...tilt.handlers}>
      <div aria-hidden="true" className={cn('hero-card-float', tilt.motionEnabled && 'hero-card-motion')}>
        <div className="hero-card-back" />
        <div className={cn('hero-card-front', tilt.enabled && 'hero-card-tilt')} style={tilt.style}>
          <div className="hero-card-face">
            <div className="hero-card-orb" />
            <div className="hero-card-content">
              <div className="hero-card-topline">
                <div className="hero-card-chip"><span /></div>
                <span className="hero-card-contactless"><Nfc aria-hidden="true" /></span>
              </div>
              <div className="hero-card-copy">
                <p className="hero-card-bank">{bankName ?? 'WESTBRIDGE NATIONAL BANK'}</p>
                <Ltr><p className="hero-card-number">•••• •••• •••• {last4}</p></Ltr>
                <div className="hero-card-details">
                  <div className="min-w-0"><p className="hero-card-label">{labels?.holder ?? t('dashboard.cards.cardholder')}</p><p className="hero-card-value truncate">{holderName || nickname || ''}</p></div>
                  <div className="hero-card-expiry"><p className="hero-card-label">{labels?.expiry ?? t('dashboard.cards.expiry')}</p><Ltr><p className="hero-card-value">{expiry}</p></Ltr></div>
                </div>
              </div>
            </div>
          </div>
          {stateLabel && <span className="card-visual-status"><ShieldAlert aria-hidden="true" className="size-4" />{stateLabel}</span>}
        </div>
      </div>
    </div>
  )
}