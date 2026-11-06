import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/hooks/use-theme'

type TurnstileInstance = { render: (target: HTMLElement, options: Record<string, unknown>) => string; reset: (id?: string) => void; remove: (id?: string) => void }
declare global {
  interface Window { turnstile?: TurnstileInstance }
}

export type TurnstileHandle = { reset: () => void }
type TurnstileWidgetProps = {
  enabled: boolean
  sitekey: string
  action: string
  onToken: (token: string) => void
  onExpire: () => void
  onError: () => void
}

let scriptPromise: Promise<void> | null = null
const languageCodes: Record<string, string> = { ar: 'ar', de: 'de', en: 'en', es: 'es', fa: 'fa', fr: 'fr', it: 'it', pt: 'pt', tr: 'tr' }

function loadTurnstile(language: string): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-westbridge-turnstile]')
    const script = existing ?? document.createElement('script')
    script.src = `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&hl=${encodeURIComponent(language)}`
    script.async = true
    script.defer = true
    script.dataset.westbridgeTurnstile = 'true'
    script.onload = () => window.turnstile ? resolve() : reject(new Error('Turnstile API unavailable'))
    script.onerror = () => reject(new Error('Turnstile script failed'))
    if (!existing) document.head.append(script)
  }).catch((error: unknown) => {
    scriptPromise = null
    throw error
  })
  return scriptPromise
}

export const TurnstileWidget = forwardRef<TurnstileHandle, TurnstileWidgetProps>(function TurnstileWidget({ enabled, sitekey, action, onToken, onExpire, onError }, ref) {
  const { t, i18n } = useTranslation('common')
  const { theme } = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const callbacks = useRef({ onToken, onExpire, onError })
  const [loadError, setLoadError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  callbacks.current = { onToken, onExpire, onError }
  const language = languageCodes[(i18n.resolvedLanguage ?? 'en').split('-')[0]] ?? 'auto'
  const resolvedTheme = theme === 'dark' ? 'dark' : 'light'

  useImperativeHandle(ref, () => ({
    reset() {
      if (widgetIdRef.current) window.turnstile?.reset(widgetIdRef.current)
      callbacks.current.onToken('')
    },
  }), [])

  useEffect(() => {
    if (!enabled || !sitekey || !containerRef.current) return
    let cancelled = false
    const mount = async () => {
      setLoadError(false)
      try {
        await loadTurnstile(language)
        if (cancelled || !containerRef.current || !window.turnstile) return
        if (widgetIdRef.current) window.turnstile.remove(widgetIdRef.current)
        containerRef.current.replaceChildren()
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey,
          action,
          theme: resolvedTheme,
          size: 'flexible',
          language,
          callback: (token: string) => callbacks.current.onToken(token),
          'expired-callback': () => callbacks.current.onExpire(),
          'error-callback': () => callbacks.current.onError(),
        })
      } catch {
        if (!cancelled) {
          setLoadError(true)
          callbacks.current.onError()
        }
      }
    }
    void mount()
    return () => {
      cancelled = true
      if (widgetIdRef.current) window.turnstile?.remove(widgetIdRef.current)
      widgetIdRef.current = null
    }
  }, [enabled, sitekey, action, language, resolvedTheme, attempt])

  if (!enabled) return null
  return <div aria-label={t('auth.turnstile.label')} className="min-h-[4.25rem]" role="group">
    {loadError ? <div className="flex min-h-[4.25rem] items-center gap-3" role="alert"><p className="text-sm text-destructive">{t('auth.turnstile.loadError')}</p><Button onClick={() => setAttempt((value) => value + 1)} size="sm" type="button" variant="outline">{t('auth.turnstile.retry')}</Button></div> : <div aria-busy="true" ref={containerRef} />}
    <span className="sr-only" role="status">{t('auth.turnstile.accessibleStatus')}</span>
  </div>
})
