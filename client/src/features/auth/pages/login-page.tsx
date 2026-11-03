import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePageTitle } from '@/hooks/use-page-title'
import { safeRedirect } from '@/lib/safeRedirect'
import { useAppConfig, useAuth } from '../auth-provider'
import { authFailureMessage } from '../auth-error'
import { LoginForm } from '../components/login-form'
import type { LoginFormValues } from '../schemas'

export function LoginPage() {
  const { t } = useTranslation('common')
  usePageTitle(t('auth.signIn'), t('auth.loginDescription'))
  const { login } = useAuth()
  const appConfig = useAppConfig()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [serverError, setServerError] = useState<string | null>(null)
  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (user) => {
      const needsVerification = appConfig.data?.email_verification_required !== false && !user.email_verified
      navigate(needsVerification ? '/verify-notice' : safeRedirect(searchParams.get('redirect')), { replace: true })
    },
  })

  async function submit(values: LoginFormValues): Promise<void> {
    setServerError(null)
    try {
      await mutation.mutateAsync(values)
    } catch (error) {
      setServerError(authFailureMessage(error, 'auth.errors.signIn', t))
    }
  }

  return (
    <section>
      <p className="mb-2 text-xs font-bold uppercase text-primary">{t('auth.welcomeBack')}</p>
      <h2 className="type-h2">{t('auth.signInHeading')}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{t('auth.loginDescription')}</p>
      <div className="mt-7">
        <LoginForm onSubmit={submit} pending={mutation.isPending || appConfig.isPending} serverError={serverError} />
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t('auth.newToWestbridge')} <Link className="font-bold text-primary underline-offset-4 hover:underline" to="/register">{t('auth.openAccount')}</Link>
      </p>
    </section>
  )
}