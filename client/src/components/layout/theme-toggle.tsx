import { Monitor, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme, type Theme } from '@/hooks/use-theme'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/features/auth/auth-provider'
import { updatePreferences } from '@/features/dashboard/settings-api'
import { toast } from 'sonner'

const nextTheme: Record<Theme, Theme> = {
  system: 'light',
  light: 'dark',
  dark: 'system',
}

const themeIcon = {
  system: Monitor,
  light: Sun,
  dark: Moon,
}

export function ThemeToggle() {
  const { t } = useTranslation('common')
  const { isAuthenticated } = useAuth()
  const { theme, setTheme } = useTheme()
  const Icon = themeIcon[theme] ?? Monitor

  return (
    <Button
      aria-label={t('theme.toggleLabel', { current: t(`theme.names.${theme}`), next: t(`theme.names.${nextTheme[theme]}`) })}
      onClick={() => {
        const next = nextTheme[theme]
        setTheme(next)
        if (isAuthenticated) void updatePreferences({ theme: next }).catch(() => toast.error(t('dashboard.settings.preferenceSaveError')))
      }}
      size="icon"
      variant="ghost"
    >
      <Icon aria-hidden="true" />
    </Button>
  )
}