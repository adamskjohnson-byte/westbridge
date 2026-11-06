import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePageTitle } from '@/hooks/use-page-title'
import { safeRedirect } from '@/lib/safeRedirect'
import { useAppConfig, useAuth } from '../auth-provider'
import { authFailureMessage } from '../auth-error'
import { LoginForm } from '../components/login-form'
import type { LoginFormValues } from '../schemas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api'
import { resendLoginChallenge } from '../api'
import type { LoginChallenge, LoginResult } from '../api'

export function LoginPage() {
  const { t } = useTranslation('common')
  usePageTitle(t('auth.signIn'), t('auth.loginDescription'))
  const { login, verifyTwoFactor } = useAuth()
  const appConfig = useAppConfig()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [serverError, setServerError] = useState<string | null>(null)
  const [challenge, setChallenge] = useState<LoginChallenge | null>(null)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState('')
  const [resendSeconds, setResendSeconds] = useState(0)
  const [wrongAttempts, setWrongAttempts] = useState(0)
  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (result: LoginResult) => {
      if (result.kind === 'challenge') {
        setChallenge(result.challenge)
        setResendSeconds(result.challenge.resend_available_in)
        setCode('')
        return
      }
      const user = result.user
      const needsVerification = appConfig.data?.email_verification_required !== false && !user.email_verified
      navigate(needsVerification ? '/verify-notice' : safeRedirect(searchParams.get('redirect')), { replace: true })
    },
  })
  const verifyMutation = useMutation({
    mutationFn: ({ challengeId, value }: { challengeId: string; value: string }) => verifyTwoFactor(challengeId, value),
    onSuccess: (user) => {
      const needsVerification = appConfig.data?.email_verification_required !== false && !user.email_verified
      navigate(needsVerification ? '/verify-notice' : safeRedirect(searchParams.get('redirect')), { replace: true })
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        const key = error.fieldErrors.code?.[0] ?? error.fieldErrors.challenge_id?.[0]
        setCodeError(key ? t(`apiErrors.${key}`, { attempts: Math.max(0, 4 - wrongAttempts) }) : authFailureMessage(error, 'auth.errors.signIn', t))
        if (key === 'validation.two_factor_code_invalid') setWrongAttempts((attempts) => attempts + 1)
      } else setCodeError(authFailureMessage(error, 'auth.errors.signIn', t))
    },
  })
  const resendMutation = useMutation({
    mutationFn: () => resendLoginChallenge(challenge!.challenge_id),
    onSuccess: (result) => { setResendSeconds(result.resend_available_in); setCode(''); setCodeError('') },
    onError: (error) => setCodeError(error instanceof ApiError && error.status === 429 ? t('apiErrors.too_many_requests') : authFailureMessage(error, 'auth.errors.signIn', t)),
  })

  useEffect(() => {
    if (resendSeconds <= 0) return
    const timer = window.setTimeout(() => setResendSeconds((seconds) => Math.max(0, seconds - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [resendSeconds])

  async function submit(values: LoginFormValues & { turnstile_token?: string }): Promise<LoginResult> {
    setServerError(null)
    try {
      return await mutation.mutateAsync(values)
    } catch (error) {
      setServerError(authFailureMessage(error, 'auth.errors.signIn', t))
      throw error
    }
  }

  function updateCode(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 6)
    setCode(digits)
    setCodeError('')
    if (digits.length === 6 && challenge) verifyMutation.mutate({ challengeId: challenge.challenge_id, value: digits })
  }

  return (
    <section>
      <p className="mb-2 text-xs font-bold uppercase text-primary">{t('auth.welcomeBack')}</p>
      <h2 className="type-h2">{t('auth.signInHeading')}</h2>
      {challenge ? <section aria-live="polite" className="mt-2 space-y-4">
        <h3 className="type-h3">{t('auth.twoFactor.checkEmail')}</h3>
        <p className="text-sm text-muted-foreground">{t('auth.twoFactor.sentTo', { email: challenge.email_masked })}</p>
        {codeError && <p className="text-sm text-destructive" role="alert">{codeError}</p>}
        <label className="grid gap-2 text-sm font-semibold" htmlFor="two-factor-code">{t('auth.twoFactor.codeLabel')}</label>
        <Input autoComplete="one-time-code" dir="ltr" id="two-factor-code" inputMode="numeric" maxLength={6} onChange={(event) => updateCode(event.target.value)} pattern="[0-9]*" value={code} />
        <p className="min-h-5 text-xs text-muted-foreground">{resendSeconds > 0 ? t('auth.twoFactor.resendCountdown', { count: resendSeconds }) : t('auth.twoFactor.codeExpiry', { count: Math.ceil(challenge.expires_in / 60) })}</p>
        <Button className="w-full" disabled={resendSeconds > 0 || resendMutation.isPending} onClick={() => resendMutation.mutate()} type="button" variant="outline">{resendMutation.isPending ? t('auth.twoFactor.resending') : t('auth.twoFactor.resend')}</Button>
        <Button className="w-full" onClick={() => { setChallenge(null); setCode(''); setCodeError(''); setWrongAttempts(0); setServerError(null) }} type="button" variant="ghost">{t('auth.twoFactor.differentAccount')}</Button>
      </section> : <>
        <p className="mt-2 text-sm text-muted-foreground">{t('auth.loginDescription')}</p>
        <div className="mt-7">
          <LoginForm onSubmit={submit} pending={mutation.isPending || appConfig.isPending} serverError={serverError} turnstile={appConfig.data?.turnstile ?? { enabled: false, sitekey: '' }} />
        </div>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          {t('auth.newToWestbridge')} <Link className="font-bold text-primary underline-offset-4 hover:underline" to="/register">{t('auth.openAccount')}</Link>
        </p>
      </>}
    </section>
  )
}