import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { DirectionProvider } from '@radix-ui/react-direction'
import { useTranslation } from 'react-i18next'
import { ThemeProvider } from '@/components/layout/theme-provider'
import { AuthProvider } from '@/features/auth/auth-provider'
import { router } from '@/routes/router'
import { startAppLoader } from '@/lib/app-loader'
import { i18n, i18nReady } from '@/i18n'
import { resolveLanguage } from '@/i18n/languages'
import { I18nextProvider } from 'react-i18next'
import './index.css'

const queryClient = new QueryClient()
const root = createRoot(document.getElementById('root')!)

function LocalizedApp() {
  const { i18n: currentI18n } = useTranslation()
  const direction = resolveLanguage(currentI18n.resolvedLanguage ?? currentI18n.language).dir

  return (
    <DirectionProvider dir={direction}>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </DirectionProvider>
  )
}

function renderApp() {
  root.render(
    <StrictMode>
      <I18nextProvider i18n={i18n}>
        <LocalizedApp />
      </I18nextProvider>
    </StrictMode>,
  )

  startAppLoader()
}

void i18nReady.then(renderApp, renderApp)
