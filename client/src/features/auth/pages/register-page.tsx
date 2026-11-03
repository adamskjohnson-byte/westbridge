import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useWatch, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { usePageTitle } from '@/hooks/use-page-title'
import { ApiError } from '@/lib/api'
import { apiFieldErrorMessage } from '@/lib/api-errors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAppConfig, useAuth } from '../auth-provider'
import { authFailureMessage } from '../auth-error'
import { FieldError } from '../components/field-error'
import { PasswordInput } from '../components/password-input'
import { PasswordStrength } from '../components/password-strength'
import { createAuthSchemas, type RegisterFormValues } from '../schemas'
import { useState } from 'react'

export function RegisterPage() {
  const { t } = useTranslation('common')
  usePageTitle(t('auth.openAccount'), t('auth.registerDescription'))
  const { register: createAccount } = useAuth()
  const appConfig = useAppConfig()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)
  const registerSchema = createAuthSchemas(t).register
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { first_name: '', last_name: '', email: '', password: '', password_confirmation: '', accept_terms: false },
    shouldFocusError: true,
  })
  const password = useWatch({ control: form.control, name: 'password' }) ?? ''
  const mutation = useMutation({
    mutationFn: createAccount,
    onSuccess: (user) => navigate(
      appConfig.data?.email_verification_required !== false && !user.email_verified ? '/verify-notice' : '/dashboard',
      { replace: true },
    ),
  })

  async function submit(values: RegisterFormValues): Promise<void> {
    setServerError(null)
    try {
      await mutation.mutateAsync(values)
    } catch (error) {
      if (error instanceof ApiError) {
        const fields = ['email', 'first_name', 'last_name', 'password', 'password_confirmation', 'accept_terms'] as const
        let hasFieldErrors = false
        for (const field of fields) {
          if (error.fieldErrors[field]?.length) {
            form.setError(field, { message: apiFieldErrorMessage(error, field, t) })
            hasFieldErrors = true
          }
        }
        if (!hasFieldErrors) setServerError(authFailureMessage(error, 'auth.errors.createAccount', t))
      } else {
        setServerError(authFailureMessage(error, 'auth.errors.createAccount', t))
      }
    }
  }

  const errors = form.formState.errors

  return (
    <section>
      <p className="mb-2 text-xs font-bold uppercase text-primary">{t('auth.startHere')}</p>
      <h2 className="type-h2">{t('auth.openAccount')}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{t('auth.registerDescription')}</p>
      {serverError && <p aria-live="polite" className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive" role="alert">{serverError}</p>}
      <form className="mt-6 space-y-3" noValidate onSubmit={form.handleSubmit(submit)}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="first-name">{t('forms.firstName')}</Label>
            <Input autoComplete="given-name" aria-describedby="first-name-error" aria-invalid={Boolean(errors.first_name)} id="first-name" {...form.register('first_name')} />
            <FieldError id="first-name-error" message={errors.first_name?.message} />
          </div>
          <div>
            <Label htmlFor="last-name">{t('forms.lastName')}</Label>
            <Input autoComplete="family-name" aria-describedby="last-name-error" aria-invalid={Boolean(errors.last_name)} id="last-name" {...form.register('last_name')} />
            <FieldError id="last-name-error" message={errors.last_name?.message} />
          </div>
        </div>
        <div>
          <Label htmlFor="register-email">{t('forms.emailAddress')}</Label>
          <Input autoComplete="email" autoCapitalize="none" aria-describedby="register-email-error" aria-invalid={Boolean(errors.email)} id="register-email" type="email" {...form.register('email')} />
          <FieldError id="register-email-error" message={errors.email?.message} />
        </div>
        <div>
          <Label htmlFor="register-password">{t('forms.password')}</Label>
          <PasswordInput autoComplete="new-password" aria-describedby="register-password-error" aria-invalid={Boolean(errors.password)} id="register-password" {...form.register('password')} />
          <FieldError id="register-password-error" message={errors.password?.message} />
          <PasswordStrength password={password} />
        </div>
        <div>
          <Label htmlFor="register-confirm">{t('forms.confirmPassword')}</Label>
          <PasswordInput autoComplete="new-password" aria-describedby="register-confirm-error" aria-invalid={Boolean(errors.password_confirmation)} id="register-confirm" {...form.register('password_confirmation')} />
          <FieldError id="register-confirm-error" message={errors.password_confirmation?.message} />
        </div>
        <div>
          <label className="flex min-h-10 items-start gap-2 text-sm leading-5 text-muted-foreground">
            <input aria-describedby="terms-error" aria-invalid={Boolean(errors.accept_terms)} className="mt-1 size-4 shrink-0 accent-primary" type="checkbox" {...form.register('accept_terms')} />
            <span>{t('auth.acceptTermsLead')} <Link className="font-semibold text-primary underline" to="/terms">{t('auth.demoTerms')}</Link>.</span>
          </label>
          <FieldError id="terms-error" message={errors.accept_terms?.message} />
        </div>
        <Button className="w-full" disabled={mutation.isPending || appConfig.isPending} type="submit">
          {mutation.isPending ? t('auth.creatingAccount') : t('auth.createAccount')}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-muted-foreground">
        {t('auth.alreadyHaveAccount')} <Link className="font-bold text-primary underline-offset-4 hover:underline" to="/login">{t('auth.signIn')}</Link>
      </p>
    </section>
  )
}