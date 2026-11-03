import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { usePageTitle } from '@/hooks/use-page-title'
import { ApiError } from '@/lib/api'
import { useAppConfig, useAuth } from '../auth-provider'
import { authFailureMessage } from '../auth-error'
import { resendVerification, verifyEmail } from '../api'
import { AuthSkeleton } from '../components/auth-skeleton'

export function VerifyNoticePage() {
  const { t } = useTranslation('common')
  usePageTitle(t('auth.verifyEmail'), t('auth.verifyDescription'))
  const { user, logout } = useAuth()
  const appConfig = useAppConfig()
  const navigate = useNavigate()
  const [seconds, setSeconds] = useState(60)
  const mutation = useMutation({
    mutationFn: resendVerification,
    onSuccess: () => {
      setSeconds(60)
      toast.success(t('auth.verificationLinkSent'))
    },
  })

  useEffect(() => {
    if (seconds === 0) return
    const timer = window.setTimeout(() => setSeconds((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [seconds])

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSettled: () => navigate('/login', { replace: true }),
  })
  const resendError = mutation.error
    ? authFailureMessage(mutation.error, 'auth.errors.resendVerification', t)
    : null

  if (appConfig.isPending) return <AuthSkeleton />
  if (user?.email_verified || appConfig.data?.email_verification_required === false) {
    return <Navigate replace to="/dashboard" />
  }

  return (
    <section>
      <p className="mb-2 text-xs font-bold uppercase text-primary">{t('auth.oneLastStep')}</p>
      <h2 className="type-h2">{t('auth.checkInbox')}</h2>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {t('auth.verificationSentTo', { email: user?.email })}
      </p>
      {resendError && <p aria-live="polite" className="mt-4 text-sm text-destructive" role="alert">{resendError}</p>}
      <Button className="mt-6 w-full" disabled={seconds > 0 || mutation.isPending} onClick={() => mutation.mutate()} type="button">
        {mutation.isPending ? t('auth.sending') : seconds > 0 ? t('auth.resendAvailable', { count: seconds }) : t('auth.resendVerification')}
      </Button>
      <button className="mt-5 w-full text-center text-sm font-semibold text-primary underline-offset-4 hover:underline disabled:opacity-50" disabled={logoutMutation.isPending} onClick={() => logoutMutation.mutate()} type="button">{logoutMutation.isPending ? t('navbar.loggingOut') : t('navbar.logOut')}</button>
    </section>
  )
}

export function VerifyEmailPage() {
  const { t } = useTranslation('common')
  usePageTitle(t('auth.verifyEmail'), t('auth.verifyDescription'))
  const [searchParams] = useSearchParams()
  const { user, isLoading } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const id = searchParams.get('id') ?? ''
  const hash = searchParams.get('hash') ?? ''
  const hasVerificationParams = Boolean(id && hash && searchParams.get('expires') && searchParams.get('signature'))
  const verificationQuery = useQuery({
    queryKey: ['email-verification', id, hash, searchParams.toString()],
    queryFn: () => verifyEmail(id, hash, searchParams),
    enabled: hasVerificationParams,
    retry: false,
    staleTime: Infinity,
  })
  const resendMutation = useMutation({
    mutationFn: resendVerification,
    onSuccess: () => toast.success(t('auth.verificationLinkSent')),
  })
  const resendError = resendMutation.error
    ? authFailureMessage(resendMutation.error, 'auth.errors.resendVerification', t)
    : null

  useEffect(() => {
    if (verificationQuery.isSuccess) {
      queryClient.setQueryData(['me'], (current: typeof user) => current ? { ...current, email_verified: true } : current)
    }
  }, [queryClient, user, verificationQuery.isSuccess])

  if (isLoading || (hasVerificationParams && verificationQuery.isPending)) return <AuthSkeleton />

  const invalid = !verificationQuery.isSuccess
  const invalidLink = !hasVerificationParams || (verificationQuery.error instanceof ApiError && verificationQuery.error.code === 'invalid_verification_link')
  const verificationError = verificationQuery.error
    ? authFailureMessage(verificationQuery.error, 'auth.errors.verifyEmail', t)
    : null

  if (verificationQuery.isSuccess) {
    return (
      <section>
        <p className="mb-2 text-xs font-bold uppercase text-primary">{t('auth.emailConfirmed')}</p>
        <h2 className="type-h2">{t('auth.allSet')}</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{t('auth.emailVerifiedContinue')}</p>
        <Button className="mt-6 w-full" onClick={() => navigate(user ? '/dashboard' : '/login', { replace: true })}>{t('actions.continue')}</Button>
      </section>
    )
  }

  return (
    <section>
      <p className="mb-2 text-xs font-bold uppercase text-destructive">{t('auth.linkUnavailable')}</p>
      <h2 className="type-h2">{t('auth.linkCannotBeUsed')}</h2>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {invalidLink ? t('auth.verificationLinkInvalid') : verificationError}
      </p>
      {user && !user.email_verified && (
        <Button className="mt-6 w-full" disabled={resendMutation.isPending} onClick={() => resendMutation.mutate()}>
          {resendMutation.isPending ? t('auth.sending') : t('auth.resendVerification')}
        </Button>
      )}
      {invalid && !user && <Link className="mt-6 inline-flex font-bold text-primary underline-offset-4 hover:underline" to="/login">{t('auth.signInToRequestLink')}</Link>}
      {resendError && <p aria-live="polite" className="mt-3 text-sm text-destructive" role="alert">{resendError}</p>}
    </section>
  )
}