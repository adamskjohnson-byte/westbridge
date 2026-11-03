import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { usePageTitle } from '@/hooks/use-page-title'
import { ApiError } from '@/lib/api'
import { apiFieldErrorMessage } from '@/lib/api-errors'
import { forgotPassword, resetPassword } from '../api'
import { createAuthSchemas, type ForgotPasswordFormValues, type ResetPasswordFormValues } from '../schemas'
import { FieldError } from '../components/field-error'
import { PasswordInput } from '../components/password-input'
import { PasswordStrength } from '../components/password-strength'
import { authFailureMessage } from '../auth-error'

export function ForgotPasswordPage() {
  const { t } = useTranslation('common')
  usePageTitle(t('auth.resetPassword'), t('auth.forgotDescription'))
  const [submitted, setSubmitted] = useState(false)
  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(createAuthSchemas(t).forgotPassword),
    defaultValues: { email: '' },
    shouldFocusError: true,
  })
  const mutation = useMutation({ mutationFn: (values: ForgotPasswordFormValues) => forgotPassword(values.email) })

  async function submit(values: ForgotPasswordFormValues): Promise<void> {
    try {
      await mutation.mutateAsync(values)
      setSubmitted(true)
    } catch {
      // Mutation error is rendered in the form.
    }
  }

  if (submitted) {
    return (
      <section aria-live="polite">
        <p className="mb-2 text-xs font-bold uppercase text-primary">{t('auth.nextStep')}</p>
        <h2 className="type-h2">{t('auth.checkInbox')}</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{t('auth.resetEmailSentIfExists')}</p>
        <Link className="mt-6 inline-flex font-bold text-primary underline-offset-4 hover:underline" to="/login">{t('auth.returnToSignIn')}</Link>
      </section>
    )
  }

  return (
    <section>
      <p className="mb-2 text-xs font-bold uppercase text-primary">{t('auth.accountRecovery')}</p>
      <h2 className="type-h2">{t('auth.forgotPasswordQuestion')}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('auth.forgotDescription')}</p>
      {mutation.error && <p aria-live="polite" className="mt-4 text-sm text-destructive" role="alert">{authFailureMessage(mutation.error, 'auth.errors.sendReset', t)}</p>}
      <form className="mt-6 space-y-3" noValidate onSubmit={form.handleSubmit(submit)}>
        <div>
          <Label htmlFor="forgot-email">{t('forms.emailAddress')}</Label>
          <Input autoComplete="email" autoCapitalize="none" aria-describedby="forgot-email-error" aria-invalid={Boolean(form.formState.errors.email)} id="forgot-email" type="email" {...form.register('email')} />
          <FieldError id="forgot-email-error" message={form.formState.errors.email?.message} />
        </div>
        <Button className="w-full" disabled={mutation.isPending} type="submit">
          {mutation.isPending ? t('auth.sending') : t('auth.sendResetLink')}
        </Button>
      </form>
      <Link className="mt-5 inline-flex text-sm font-semibold text-primary underline-offset-4 hover:underline" to="/login">{t('auth.backToSignIn')}</Link>
    </section>
  )
}

export function ResetPasswordPage() {
  const { t } = useTranslation('common')
  usePageTitle(t('auth.chooseNewPassword'), t('auth.resetDescription'))
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') ?? ''
  const email = searchParams.get('email') ?? ''
  const [invalidLink, setInvalidLink] = useState(false)
  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(createAuthSchemas(t).resetPassword),
    defaultValues: { password: '', password_confirmation: '' },
    shouldFocusError: true,
  })
  const password = useWatch({ control: form.control, name: 'password' }) ?? ''
  const mutation = useMutation({
    mutationFn: (values: ResetPasswordFormValues) => resetPassword({
      token,
      email,
      password: values.password,
      password_confirmation: values.password_confirmation,
    }),
    onSuccess: () => {
      toast.success(t('auth.passwordResetSuccess'))
      navigate('/login', { replace: true })
    },
    onError: (error) => {
      if (error instanceof ApiError && error.fieldErrors.email?.includes('validation.reset_token_invalid')) {
        setInvalidLink(true)
        return
      }

      if (error instanceof ApiError) {
        const fields = ['password', 'password_confirmation'] as const
        for (const field of fields) {
          if (error.fieldErrors[field]?.length) {
            form.setError(field, { message: apiFieldErrorMessage(error, field, t) })
          }
        }
      }
    },
  })

  if (!token || !email || invalidLink) {
    return (
      <section>
        <p className="mb-2 text-xs font-bold uppercase text-primary">{t('auth.resetLinkUnavailable')}</p>
        <h2 className="type-h2">{t('auth.requestNewLink')}</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{t('auth.resetLinkInvalid')}</p>
        <Link className="mt-6 inline-flex font-bold text-primary underline-offset-4 hover:underline" to="/forgot-password">{t('auth.requestNewResetLink')}</Link>
      </section>
    )
  }

  return (
    <section>
      <p className="mb-2 text-xs font-bold uppercase text-primary">{t('auth.accountRecovery')}</p>
      <h2 className="type-h2">{t('auth.chooseNewPassword')}</h2>
      <p className="mt-2 break-all text-sm text-muted-foreground">{t('auth.resetEmailLabel', { email })}</p>
      {mutation.error && !invalidLink && !(mutation.error instanceof ApiError && (mutation.error.fieldErrors.password || mutation.error.fieldErrors.password_confirmation)) && <p aria-live="polite" className="mt-4 text-sm text-destructive" role="alert">{authFailureMessage(mutation.error, 'auth.errors.resetPassword', t)}</p>}
      <form className="mt-6 space-y-3" noValidate onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <div>
          <Label htmlFor="new-password">{t('forms.newPassword')}</Label>
          <PasswordInput autoComplete="new-password" aria-describedby="new-password-error" aria-invalid={Boolean(form.formState.errors.password)} id="new-password" {...form.register('password')} />
          <FieldError id="new-password-error" message={form.formState.errors.password?.message} />
          <PasswordStrength password={password} />
        </div>
        <div>
          <Label htmlFor="new-password-confirm">{t('forms.confirmNewPassword')}</Label>
          <PasswordInput autoComplete="new-password" aria-describedby="new-password-confirm-error" aria-invalid={Boolean(form.formState.errors.password_confirmation)} id="new-password-confirm" {...form.register('password_confirmation')} />
          <FieldError id="new-password-confirm-error" message={form.formState.errors.password_confirmation?.message} />
        </div>
        <Button className="w-full" disabled={mutation.isPending} type="submit">
          {mutation.isPending ? t('auth.saving') : t('auth.saveNewPassword')}
        </Button>
      </form>
    </section>
  )
}