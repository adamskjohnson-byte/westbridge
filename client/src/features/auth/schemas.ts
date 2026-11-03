import { z } from 'zod'

type Translate = (key: string) => string

export function createAuthSchemas(t: Translate) {
  const emailSchema = z.string().trim().min(1, t('forms.validation.emailRequired')).toLowerCase().email(t('forms.validation.emailInvalid')).max(254, t('forms.validation.emailMax'))
  const passwordSchema = z
    .string()
    .min(10, t('forms.validation.passwordMin'))
    .regex(/[a-z]/, t('forms.validation.passwordLowercase'))
    .regex(/[A-Z]/, t('forms.validation.passwordUppercase'))
    .regex(/[0-9]/, t('forms.validation.passwordNumber'))

  const login = z.object({
    email: emailSchema,
    password: z.string().min(1, t('forms.validation.passwordRequired')),
    remember: z.boolean(),
  })

  const register = z.object({
    first_name: z.string().trim().min(2, t('forms.validation.nameMin')).max(60, t('forms.validation.nameMax')),
    last_name: z.string().trim().min(2, t('forms.validation.nameMin')).max(60, t('forms.validation.nameMax')),
    email: emailSchema,
    password: passwordSchema,
    password_confirmation: z.string().min(1, t('forms.validation.confirmPassword')),
    accept_terms: z.boolean().refine((accepted) => accepted, t('forms.validation.acceptTerms')),
  }).refine((values) => values.password === values.password_confirmation, {
    path: ['password_confirmation'],
    message: t('forms.validation.passwordMismatch'),
  })

  const forgotPassword = z.object({ email: emailSchema })

  const resetPassword = z.object({
    password: passwordSchema,
    password_confirmation: z.string().min(1, t('forms.validation.confirmPassword')),
  }).refine((values) => values.password === values.password_confirmation, {
    path: ['password_confirmation'],
    message: t('forms.validation.passwordMismatch'),
  })

  return { login, register, forgotPassword, resetPassword }
}

type AuthSchemas = ReturnType<typeof createAuthSchemas>
export type LoginFormValues = z.infer<AuthSchemas['login']>
export type RegisterFormValues = z.infer<AuthSchemas['register']>
export type ForgotPasswordFormValues = z.infer<AuthSchemas['forgotPassword']>
export type ResetPasswordFormValues = z.infer<AuthSchemas['resetPassword']>