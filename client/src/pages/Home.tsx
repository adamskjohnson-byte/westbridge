import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { brandName, demoDisclaimer } from '@/content/brand'

type HealthResponse = {
  status: 'ok'
  app: string
  time: string
}

function ApiStatus() {
  const health = useQuery({
    queryKey: ['api-health'],
    queryFn: () => api<HealthResponse>('/health'),
    retry: false,
  })

  if (!import.meta.env.DEV) return null

  return (
    <p aria-live="polite" className="api-status">
      API: {health.isSuccess ? 'ok' : health.isError ? 'unreachable' : 'checking'}
    </p>
  )
}

export function Home() {
  return (
    <main className="page-shell">
      <header className="brand-header">
        <p className="eyebrow">{brandName}</p>
        <h1>Home</h1>
      </header>
      <ApiStatus />
      <footer className="site-footer">
        {demoDisclaimer}
      </footer>
    </main>
  )
}