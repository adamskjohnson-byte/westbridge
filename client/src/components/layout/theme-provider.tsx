import { useEffect, useState, type PropsWithChildren } from 'react'
import { ThemeContext, type Theme } from '@/hooks/use-theme'

const storageKey = 'westbridge-theme'

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system'
  try {
    const stored = window.localStorage.getItem(storageKey)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {
    return 'system'
  }
  return 'system'
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const [theme, setTheme] = useState<Theme>(readStoredTheme)

  useEffect(() => {
    const systemPreference = window.matchMedia('(prefers-color-scheme: dark)')
    const applyTheme = () => {
      const resolvedTheme = theme === 'system'
        ? systemPreference.matches ? 'dark' : 'light'
        : theme

      document.documentElement.classList.toggle('dark', resolvedTheme === 'dark')
      document.documentElement.style.colorScheme = resolvedTheme
      try {
        window.localStorage.setItem(storageKey, theme)
      } catch {
        // The theme still works for this session when storage is unavailable.
      }
    }

    applyTheme()
    if (theme === 'system') systemPreference.addEventListener('change', applyTheme)

    return () => systemPreference.removeEventListener('change', applyTheme)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}