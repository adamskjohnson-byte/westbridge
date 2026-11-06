import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useBlocker, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Check, LogOut, RefreshCw, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PasswordInput } from '@/features/auth/components/password-input'
import { PasswordStrength } from '@/features/auth/components/password-strength'
import { useTheme, type Theme } from '@/hooks/use-theme'
import { ApiError } from '@/lib/api'
import { apiErrorMessage } from '@/lib/api-errors'
import { formatMoneyFromCents, formatRelativeDate } from '@/lib/format'
import { i18n } from '@/i18n'
import { languages } from '@/i18n/languages'
import { dollarsToCents } from './cards-api'
import { changePassword, confirmTwoFactor, getSessions, getSettings, revokeOtherSessions, revokeSession, startTwoFactor, updatePreferences, updateProfile } from './settings-api'
import { useAuth } from '@/features/auth/auth-provider'

type TabName = 'profile' | 'security' | 'preferences'
const queryKey = ['dashboard', 'settings'] as const

export function SettingsPage() {
  const { t } = useTranslation('common')
  const [params, setParams] = useSearchParams()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { theme, setTheme } = useTheme()
  const settingsQuery = useQuery({ queryKey: [...queryKey, user?.id], queryFn: getSettings })
  const selectedTab = (['profile', 'security', 'preferences'].includes(params.get('tab') ?? '') ? params.get('tab') : 'profile') as TabName
  const settings = settingsQuery.data
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [passwords, setPasswords] = useState({ current_password: '', password: '', password_confirmation: '' })
  const passwordStrong = passwords.password.length >= 10 && /[a-z]/.test(passwords.password) && /[A-Z]/.test(passwords.password) && /[0-9]/.test(passwords.password)
  const passwordUnchanged = passwords.password.length > 0 && passwords.current_password === passwords.password
  const [passwordError, setPasswordError] = useState('')
  const [twoFactorPurpose, setTwoFactorPurpose] = useState<'enable' | 'disable' | null>(null)
  const [twoFactorChallenge, setTwoFactorChallenge] = useState<{ challenge_id: string; email_masked: string } | null>(null)
  const [twoFactorPassword, setTwoFactorPassword] = useState('')
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [twoFactorError, setTwoFactorError] = useState('')
  const [locale, setLocale] = useState(i18n.resolvedLanguage ?? 'en')
  const [emailActivity, setEmailActivity] = useState(true)
  const [threshold, setThreshold] = useState('')
  const [profileDirty, setProfileDirty] = useState(false)
  const blocker = useBlocker(({ currentLocation, nextLocation }) => profileDirty && currentLocation.pathname !== nextLocation.pathname)

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (window.confirm(t('dashboard.settings.unsavedConfirm'))) blocker.proceed()
    else blocker.reset()
  }, [blocker, t])

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!profileDirty) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [profileDirty])

  useEffect(() => {
    if (!settings) return
    setFirstName(settings.profile.first_name); setLastName(settings.profile.last_name); setPhone(settings.profile.phone ?? '')
    setLocale(settings.preferences.locale ?? (i18n.resolvedLanguage ?? 'en'))
    setEmailActivity(settings.preferences.email_activity)
    setThreshold(settings.preferences.low_balance_threshold_cents === null ? '' : (settings.preferences.low_balance_threshold_cents / 100).toFixed(2))
    setTheme(settings.preferences.theme)
  }, [settings, setTheme])

  const sessionsQuery = useQuery({ queryKey: [...queryKey, 'sessions'], queryFn: getSessions, enabled: selectedTab === 'security' })
  const profileMutation = useMutation({ mutationFn: () => updateProfile({ first_name: firstName.trim(), last_name: lastName.trim(), phone: phone.trim() || null }), onSuccess: async () => { setProfileDirty(false); toast.success(t('dashboard.settings.profileSaved')); await queryClient.invalidateQueries({ queryKey }) }, onError: (error) => toast.error(apiErrorMessage(error, t)) })
  const preferencesMutation = useMutation({
    mutationFn: async () => {
      const cents = threshold.trim() ? dollarsToCents(threshold) : null
      if (threshold.trim() && (cents === null || cents > 100000000)) throw new Error(t('dashboard.settings.thresholdInvalid'))
      return updatePreferences({ locale, theme, email_activity: emailActivity, low_balance_threshold_cents: cents })
    },
    onSuccess: async (preferences) => { if (preferences.locale) { await i18n.changeLanguage(preferences.locale); localStorage.setItem('westbridge.lang', preferences.locale) } setTheme(preferences.theme); toast.success(t('dashboard.settings.preferencesSaved')); await queryClient.invalidateQueries({ queryKey }) },
    onError: (error) => toast.error(error instanceof TypeError ? apiErrorMessage(error, t) : error instanceof Error ? error.message : apiErrorMessage(error, t)),
  })
  const passwordMutation = useMutation({
    mutationFn: () => changePassword(passwords),
    onSuccess: async () => { setPasswords({ current_password: '', password: '', password_confirmation: '' }); setPasswordError(''); toast.success(t('dashboard.settings.passwordSaved')); await queryClient.invalidateQueries({ queryKey: [...queryKey, 'sessions'] }) },
    onError: (error) => { if (error instanceof ApiError) { const field = Object.keys(error.fieldErrors)[0]; const key = error.fieldErrors[field]?.[0]; setPasswordError(key ? t(`apiErrors.${key}`) : apiErrorMessage(error, t)) } else setPasswordError(apiErrorMessage(error, t)) },
  })
  const revokeMutation = useMutation({ mutationFn: revokeSession, onSuccess: async () => { toast.success(t('dashboard.settings.sessionRevoked')); await queryClient.invalidateQueries({ queryKey: [...queryKey, 'sessions'] }) }, onError: (error) => toast.error(apiErrorMessage(error, t)) })
  const revokeOthersMutation = useMutation({ mutationFn: revokeOtherSessions, onSuccess: async () => { toast.success(t('dashboard.settings.othersRevoked')); await queryClient.invalidateQueries({ queryKey: [...queryKey, 'sessions'] }) }, onError: (error) => toast.error(apiErrorMessage(error, t)) })
  const twoFactorStartMutation = useMutation({
    mutationFn: () => startTwoFactor({ purpose: twoFactorPurpose!, password: twoFactorPassword }),
    onSuccess: (challenge) => { setTwoFactorChallenge(challenge); setTwoFactorPassword(''); setTwoFactorCode(''); setTwoFactorError('') },
    onError: (error) => setTwoFactorError(apiErrorMessage(error, t)),
  })
  const twoFactorConfirmMutation = useMutation({
    mutationFn: () => confirmTwoFactor({ challenge_id: twoFactorChallenge!.challenge_id, code: twoFactorCode }),
    onSuccess: async (result) => { setTwoFactorChallenge(null); setTwoFactorPurpose(null); setTwoFactorCode(''); setTwoFactorError(''); toast.success(t(result.two_factor_enabled ? 'dashboard.settings.twoFactor.enabledToast' : 'dashboard.settings.twoFactor.disabledToast')); await queryClient.invalidateQueries({ queryKey }) },
    onError: (error) => setTwoFactorError(apiErrorMessage(error, t)),
  })

  if (settingsQuery.isPending) return <div aria-busy="true" className="animate-pulse space-y-4"><div className="h-12 bg-muted"/><div className="h-80 bg-muted"/></div>
  if (settingsQuery.isError || !settings) return <div className="flex items-center gap-3" role="alert"><p>{apiErrorMessage(settingsQuery.error, t)}</p><Button onClick={() => void settingsQuery.refetch()} variant="outline"><RefreshCw aria-hidden="true"/>{t('dashboard.retry')}</Button></div>

  return <div className="space-y-6"><div className="border-b border-border pb-5"><p className="text-sm font-semibold text-primary">{t('dashboard.settings.eyebrow')}</p><h2 className="mt-1 text-2xl font-extrabold">{t('dashboard.settings.title')}</h2></div>
    <Tabs onValueChange={(value) => setParams((previous) => { const next = new URLSearchParams(previous); next.set('tab', value); return next }, { replace: true })} value={selectedTab}><TabsList aria-label={t('dashboard.settings.tabs.label')} className="h-auto w-full justify-start overflow-x-auto rounded-none border-b border-border bg-transparent p-0"><TabsTrigger className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none" value="profile">{t('dashboard.settings.tabs.profile')}</TabsTrigger><TabsTrigger className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none" value="security">{t('dashboard.settings.tabs.security')}</TabsTrigger><TabsTrigger className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none" value="preferences">{t('dashboard.settings.tabs.preferences')}</TabsTrigger></TabsList>
      <TabsContent value="profile"><form className="max-w-2xl space-y-5" onSubmit={(event) => { event.preventDefault(); profileMutation.mutate() }}><div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-1.5"><Label htmlFor="profile-first">{t('forms.firstName')}</Label><Input autoComplete="given-name" id="profile-first" onChange={(event) => { setFirstName(event.target.value); setProfileDirty(true) }} value={firstName}/></div><div className="grid gap-1.5"><Label htmlFor="profile-last">{t('forms.lastName')}</Label><Input autoComplete="family-name" id="profile-last" onChange={(event) => { setLastName(event.target.value); setProfileDirty(true) }} value={lastName}/></div></div><div className="grid gap-1.5"><Label htmlFor="profile-phone">{t('dashboard.settings.phone')}</Label><Input autoComplete="tel" id="profile-phone" onChange={(event) => { setPhone(event.target.value); setProfileDirty(true) }} value={phone}/></div><div className="grid gap-1.5"><Label htmlFor="profile-email">{t('forms.emailAddress')}</Label><Input id="profile-email" readOnly value={settings.profile.email}/><p className="text-xs text-muted-foreground">{t('dashboard.settings.emailReadOnly')}</p></div><Button disabled={!profileDirty || profileMutation.isPending} type="submit">{t('dashboard.settings.saveChanges')}</Button></form></TabsContent>
      <TabsContent value="security"><div className="grid max-w-3xl gap-10"><section className="grid gap-3 border-b border-border pb-7"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold">{t('dashboard.settings.twoFactor.title')}</h3><p className="mt-1 text-sm text-muted-foreground">{t(settings.security.two_factor_enabled ? 'dashboard.settings.twoFactor.enabled' : 'dashboard.settings.twoFactor.disabled')}</p></div>{settings.security.two_factor_required ? <span className="border border-primary px-2 py-1 text-xs font-semibold text-primary">{t('dashboard.settings.twoFactor.requiredAdmin')}</span> : <Button onClick={() => { setTwoFactorPurpose(settings.security.two_factor_enabled ? 'disable' : 'enable'); setTwoFactorChallenge(null); setTwoFactorError('') }} variant="outline">{t(settings.security.two_factor_enabled ? 'dashboard.settings.twoFactor.disable' : 'dashboard.settings.twoFactor.enable')}</Button>}</div></section><form className="grid gap-4 border-b border-border pb-7" onSubmit={(event) => { event.preventDefault(); passwordMutation.mutate() }}><h3 className="text-base font-bold">{t('dashboard.settings.changePassword')}</h3>{passwordError && <p className="text-sm text-destructive" role="alert">{passwordError}</p>}<div className="grid gap-1.5"><Label htmlFor="current-password">{t('dashboard.settings.currentPassword')}</Label><PasswordInput autoComplete="current-password" id="current-password" onChange={(event) => setPasswords((current) => ({ ...current, current_password: event.target.value }))} value={passwords.current_password}/></div><div className="grid gap-1.5"><Label htmlFor="settings-new-password">{t('forms.newPassword')}</Label><PasswordInput autoComplete="new-password" id="settings-new-password" onChange={(event) => setPasswords((current) => ({ ...current, password: event.target.value }))} value={passwords.password}/><PasswordStrength password={passwords.password}/>{passwordUnchanged && <p className="text-xs text-destructive">{t('apiErrors.validation.password_unchanged')}</p>}</div><div className="grid gap-1.5"><Label htmlFor="settings-confirm-password">{t('forms.confirmNewPassword')}</Label><PasswordInput autoComplete="new-password" id="settings-confirm-password" onChange={(event) => setPasswords((current) => ({ ...current, password_confirmation: event.target.value }))} value={passwords.password_confirmation}/>{passwords.password_confirmation && passwords.password !== passwords.password_confirmation && <p className="text-xs text-destructive">{t('forms.validation.passwordMismatch')}</p>}</div><Button disabled={passwordMutation.isPending || !passwords.current_password || !passwordStrong || passwordUnchanged || passwords.password !== passwords.password_confirmation} type="submit">{t('dashboard.settings.updatePassword')}</Button></form>
        <section><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h3 className="text-base font-bold">{t('dashboard.settings.sessionsTitle')}</h3><Button disabled={revokeOthersMutation.isPending} onClick={() => { if (window.confirm(t('dashboard.settings.revokeOthersConfirm'))) revokeOthersMutation.mutate() }} variant="outline"><LogOut aria-hidden="true"/>{t('dashboard.settings.revokeOthers')}</Button></div>{sessionsQuery.isPending ? <p>{t('dashboard.loading')}</p> : sessionsQuery.isError ? <p role="alert">{apiErrorMessage(sessionsQuery.error, t)}</p> : <ul className="divide-y divide-border border-y border-border">{(sessionsQuery.data ?? []).map((session) => <li className="flex flex-wrap items-center justify-between gap-3 py-4" key={session.id}><div className="min-w-0"><p className="text-sm font-semibold">{t('dashboard.settings.sessionDevice', { device: t(`dashboard.settings.device.${session.device_type}`), browser: session.browser, platform: session.platform })}{session.is_current && <span className="ms-2 border border-border px-2 py-0.5 text-xs">{t('dashboard.settings.thisDevice')}</span>}</p><p className="mt-1 text-xs text-muted-foreground">{session.ip_masked} · {formatRelativeDate(session.last_active_at)}</p></div>{!session.is_current && <Button aria-label={t('dashboard.settings.revokeSession')} onClick={() => { if (window.confirm(t('dashboard.settings.revokeConfirm'))) revokeMutation.mutate(session.id) }} size="icon" variant="outline"><Trash2 aria-hidden="true"/></Button>}</li>)}</ul>}</section></div></TabsContent>
      <TabsContent value="preferences"><form className="grid max-w-2xl gap-5" onSubmit={(event) => { event.preventDefault(); preferencesMutation.mutate() }}><div className="grid gap-1.5"><Label htmlFor="settings-language">{t('languageSwitcher.listLabel')}</Label><select className="h-10 border border-input bg-background px-3 text-sm" id="settings-language" onChange={(event) => setLocale(event.target.value)} value={locale}>{languages.filter((language) => language.code !== 'pseudo').map((language) => <option key={language.code} value={language.code}>{language.nativeName}</option>)}</select></div><div className="grid gap-1.5"><Label htmlFor="settings-theme">{t('theme.label')}</Label><select className="h-10 border border-input bg-background px-3 text-sm" id="settings-theme" onChange={(event) => setTheme(event.target.value as Theme)} value={theme}>{(['light', 'dark', 'system'] as const).map((value) => <option key={value} value={value}>{t(`theme.names.${value}`)}</option>)}</select></div><label className="flex items-start gap-3 border-y border-border py-4 text-sm"><input checked={emailActivity} className="mt-0.5 size-4 accent-primary" onChange={(event) => setEmailActivity(event.target.checked)} type="checkbox"/><span>{t('dashboard.settings.emailActivity')}<span className="mt-1 block text-xs text-muted-foreground">{t('dashboard.settings.securityEmailsAlways')}</span></span></label><div className="grid gap-1.5"><Label htmlFor="low-balance-threshold">{t('dashboard.settings.lowBalance')}</Label><Input id="low-balance-threshold" inputMode="decimal" onChange={(event) => setThreshold(event.target.value)} placeholder={t('dashboard.settings.lowBalanceOff')} value={threshold}/><p className="text-xs text-muted-foreground">{threshold ? t('dashboard.settings.lowBalanceAmount', { amount: formatMoneyFromCents(dollarsToCents(threshold) ?? 0) }) : t('dashboard.settings.lowBalanceOff')}</p></div><Button disabled={preferencesMutation.isPending} type="submit"><Check aria-hidden="true"/>{t('dashboard.settings.savePreferences')}</Button></form></TabsContent>
    </Tabs>
    {twoFactorPurpose && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-foreground/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) { setTwoFactorPurpose(null); setTwoFactorChallenge(null) } }}><section aria-labelledby="two-factor-dialog-title" aria-modal="true" className="my-auto w-full max-w-md border border-border bg-background p-5 shadow-xl" role="dialog"><div className="flex items-start justify-between gap-3"><h2 className="text-lg font-bold" id="two-factor-dialog-title">{t(`dashboard.settings.twoFactor.${twoFactorChallenge ? 'enterCode' : 'confirmPassword'}`)}</h2><Button aria-label={t('dashboard.settings.twoFactor.close')} onClick={() => { setTwoFactorPurpose(null); setTwoFactorChallenge(null) }} size="icon" variant="ghost"><X aria-hidden="true"/></Button></div>{twoFactorError && <p className="mt-3 text-sm text-destructive" role="alert">{twoFactorError}</p>}{twoFactorChallenge ? <div className="mt-4 grid gap-3"><p className="text-sm text-muted-foreground">{t('dashboard.settings.twoFactor.sentTo', { email: twoFactorChallenge.email_masked })}</p><Label htmlFor="settings-two-factor-code">{t('dashboard.settings.twoFactor.code')}</Label><Input autoComplete="one-time-code" dir="ltr" id="settings-two-factor-code" inputMode="numeric" maxLength={6} onChange={(event) => setTwoFactorCode(event.target.value.replace(/\D/g, '').slice(0, 6))} value={twoFactorCode}/><Button disabled={twoFactorConfirmMutation.isPending || twoFactorCode.length !== 6} onClick={() => twoFactorConfirmMutation.mutate()}>{t('dashboard.settings.twoFactor.confirm')}</Button></div> : <form className="mt-4 grid gap-3" onSubmit={(event) => { event.preventDefault(); twoFactorStartMutation.mutate() }}><p className="text-sm text-muted-foreground">{t(`dashboard.settings.twoFactor.${twoFactorPurpose}Description`)}</p><Label htmlFor="two-factor-current-password">{t('dashboard.settings.currentPassword')}</Label><PasswordInput autoComplete="current-password" id="two-factor-current-password" onChange={(event) => setTwoFactorPassword(event.target.value)} value={twoFactorPassword}/><Button disabled={twoFactorStartMutation.isPending || !twoFactorPassword} type="submit">{t('dashboard.settings.twoFactor.sendCode')}</Button></form>}</section></div>}
  </div>
}