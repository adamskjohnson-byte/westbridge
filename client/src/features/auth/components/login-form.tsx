import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from './password-input'
import { FieldError } from './field-error'
import { createAuthSchemas, type LoginFormValues } from '../schemas'
import { TurnstileWidget, type TurnstileHandle } from '@/components/security/TurnstileWidget'
import type { LoginResult } from '../api'

type LoginFormProps = {
  onSubmit: (values: LoginFormValues & { turnstile_token?: string }) => Promise<LoginResult>
  pending: boolean
  serverError: string | null
  turnstile: { enabled: boolean; sitekey: string }
}

export function LoginForm({ onSubmit, pending, serverError, turnstile }: LoginFormProps) {
  const { t } = useTranslation('common')
  const loginSchema = createAuthSchemas(t).login
  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', remember: false },
    shouldFocusError: true,
  })
  const widget = useRef<TurnstileHandle>(null)
  const [token, setToken] = useState('')

  async function submit(values: LoginFormValues) {
    try {
      await onSubmit({ ...values, ...(turnstile.enabled ? { turnstile_token: token } : {}) })
    } catch (error) {
      widget.current?.reset()
      setToken('')
      throw error
    }
  }

  return (
    <form className="space-y-4" noValidate onSubmit={handleSubmit(submit)}>
      {serverError && <p aria-live="polite" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive" role="alert">{serverError}</p>}
      <div>
        <Label htmlFor="login-email">{t('forms.emailAddress')}</Label>
        <Input
          autoComplete="email"
          aria-describedby="login-email-error"
          aria-invalid={Boolean(errors.email)}
          autoCapitalize="none"
          id="login-email"
          type="email"
          {...register('email')}
        />
        <FieldError id="login-email-error" message={errors.email?.message} />
      </div>
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <Label htmlFor="login-password">{t('forms.password')}</Label>
          <Link className="text-sm font-semibold text-primary underline-offset-4 hover:underline" to="/forgot-password">{t('auth.forgotPassword')}</Link>
        </div>
        <PasswordInput
          aria-describedby="login-password-error"
          aria-invalid={Boolean(errors.password)}
          autoComplete="current-password"
          id="login-password"
          {...register('password')}
        />
        <FieldError id="login-password-error" message={errors.password?.message} />
      </div>
      <label className="flex min-h-10 items-center gap-2 text-sm text-muted-foreground">
        <input className="size-4 accent-primary" type="checkbox" {...register('remember')} />
        {t('auth.rememberMe')}
      </label>
      <TurnstileWidget action="login" enabled={turnstile.enabled} onError={() => setToken('')} onExpire={() => setToken('')} onToken={setToken} ref={widget} sitekey={turnstile.sitekey} />
      {turnstile.enabled && !token && <p className="text-xs text-muted-foreground">{t('auth.turnstile.verifyingHint')}</p>}
      <Button className="w-full" disabled={pending || (turnstile.enabled && !token)} type="submit">
        {pending ? t('auth.signingIn') : t('auth.signIn')}
      </Button>
    </form>
  )
}