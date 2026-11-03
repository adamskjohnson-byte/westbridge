import { Monitor, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme, type Theme } from '@/hooks/use-theme'
import { useTranslation } from 'react-i18next'

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
  const { theme, setTheme } = useTheme()
  const Icon = themeIcon[theme]

  return (
    <Button
      aria-label={t('theme.toggleLabel', { current: t(`theme.names.${theme}`), next: t(`theme.names.${nextTheme[theme]}`) })}
      onClick={() => setTheme(nextTheme[theme])}
      size="icon"
      variant="ghost"
    >
      <Icon aria-hidden="true" />
    </Button>
  )
}