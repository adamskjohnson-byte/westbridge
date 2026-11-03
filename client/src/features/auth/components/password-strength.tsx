import { Check, Circle } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'

const passwordRules = [
  { key: 'auth.passwordRules.length', test: (value: string) => value.length >= 10 },
  { key: 'auth.passwordRules.uppercase', test: (value: string) => /[A-Z]/.test(value) },
  { key: 'auth.passwordRules.lowercase', test: (value: string) => /[a-z]/.test(value) },
  { key: 'auth.passwordRules.number', test: (value: string) => /[0-9]/.test(value) },
]

export function PasswordStrength({ password }: { password: string }) {
  const { t } = useTranslation('common')
  const passed = passwordRules.filter((rule) => rule.test(password)).length
  const percentage = (passed / passwordRules.length) * 100

  return (
    <div aria-live="polite" className="space-y-2">
      <div
        aria-label={t('auth.passwordStrength', { count: passed, total: passwordRules.length })}
        aria-valuemax={passwordRules.length}
        aria-valuemin={0}
        aria-valuenow={passed}
        className="h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
      >
        <div className="password-strength-fill h-full w-full rounded-full bg-primary" style={{ '--password-strength': percentage / 100 } as CSSProperties} />
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {passwordRules.map((rule) => {
          const met = rule.test(password)
          const Icon = met ? Check : Circle
          return (
            <li className="flex items-center gap-1.5" key={rule.key}>
              <Icon aria-hidden="true" className={met ? 'size-3.5 text-primary' : 'size-3.5'} />
              <span>{t(rule.key)}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}