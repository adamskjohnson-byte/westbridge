import { Link } from 'react-router-dom'
import { demoDisclaimer } from '@/content/brand'

export function NotFound() {
  return (
    <main className="page-shell">
      <h1>Page not found</h1>
      <Link to="/">Return home</Link>
      <footer className="site-footer">
        {demoDisclaimer}
      </footer>
    </main>
  )
}